import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { getGoogleAccessToken } from "../_shared/google-auth.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

// Populates marketing_metric_snapshots so the Marketing Dashboard can show
// history/date-range trends -- marketing-channel-status/index.ts (the
// existing live "is this connected right now" check) is deliberately not
// reused here: this function sums recent posts/videos for engagement
// totals, a different shape (pagination + summing) that would mean
// threading a mode flag through the existing function for little benefit.
// Runs hourly via cron (see migration 0062) and on-demand from the
// dashboard's "sync now" button (staff, rate-limited).
//
// Also includes Social Blade scraping (no API key needed) as an additional
// data source for follower counts from YouTube, TikTok, Instagram, Facebook.

const GRAPH_VERSION = "v19.0";
const FETCH_TIMEOUT_MS = 8000;

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function insertSnapshot(admin: SupabaseAdmin, channel: string, metric: string, value: number, source: "auto" | "manual"): Promise<void> {
  const { error } = await admin.from("marketing_metric_snapshots").insert({ channel, metric, value, source });
  if (error) throw error;
}

function looksLikeChannelId(value: string): boolean {
  return /^UC[a-zA-Z0-9_-]{22}$/.test(value);
}

async function syncYouTube(admin: SupabaseAdmin): Promise<{ ok: boolean; detail: string }> {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  const { data: setting } = await admin.from("integration_settings").select("value").eq("key", "youtube_channel_handle").maybeSingle();
  const handleOrId = setting?.value ?? null;
  if (!apiKey || !handleOrId) return { ok: false, detail: "YouTube not configured" };

  let channelId = handleOrId.trim();
  if (!looksLikeChannelId(channelId)) {
    const handle = channelId.startsWith("@") ? channelId : `@${channelId}`;
    const resolveResponse = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`);
    if (!resolveResponse.ok) return { ok: false, detail: `resolve handle failed (${resolveResponse.status})` };
    const resolveData = (await resolveResponse.json()) as { items?: Array<{ id: string }> };
    const resolvedId = resolveData.items?.[0]?.id;
    if (!resolvedId) return { ok: false, detail: "channel not found" };
    channelId = resolvedId;
  }

  const statsResponse = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${apiKey}`);
  if (!statsResponse.ok) return { ok: false, detail: `channel stats failed (${statsResponse.status})` };
  const statsData = (await statsResponse.json()) as {
    items?: Array<{
      statistics?: { subscriberCount?: string; viewCount?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  };
  const channel = statsData.items?.[0];
  if (!channel) return { ok: false, detail: "channel not found" };

  await insertSnapshot(admin, "youtube", "followers", Number(channel.statistics?.subscriberCount ?? 0), "auto");
  await insertSnapshot(admin, "youtube", "views", Number(channel.statistics?.viewCount ?? 0), "auto");

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (uploadsPlaylistId) {
    const recentResponse = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&key=${apiKey}`
    );
    if (recentResponse.ok) {
      const recentData = (await recentResponse.json()) as { items?: Array<{ snippet?: { resourceId?: { videoId?: string } } }> };
      const videoIds = (recentData.items ?? []).map((item) => item.snippet?.resourceId?.videoId).filter((id): id is string => Boolean(id));
      if (videoIds.length > 0) {
        const statsResponse2 = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(",")}&key=${apiKey}`);
        if (statsResponse2.ok) {
          const videoStatsData = (await statsResponse2.json()) as { items?: Array<{ statistics?: { likeCount?: string; commentCount?: string } }> };
          let totalLikes = 0;
          let totalComments = 0;
          for (const video of videoStatsData.items ?? []) {
            totalLikes += Number(video.statistics?.likeCount ?? 0);
            totalComments += Number(video.statistics?.commentCount ?? 0);
          }
          // Sum across the last 10 uploads, not literal all-time totals --
          // a bounded, quota-safe proxy for engagement trend, same
          // trade-off documented for Facebook below.
          await insertSnapshot(admin, "youtube", "likes", totalLikes, "auto");
          await insertSnapshot(admin, "youtube", "comments", totalComments, "auto");
        }
      }
    }
  }

  return { ok: true, detail: "synced" };
}

async function syncFacebook(admin: SupabaseAdmin): Promise<{ ok: boolean; detail: string }> {
  const { data: account } = await admin.from("social_accounts").select("access_token, metadata").eq("platform", "facebook").maybeSingle();
  if (!account?.access_token) return { ok: false, detail: "Facebook not connected" };

  const pageId = (account.metadata as Record<string, unknown> | null)?.pageId as string | undefined;
  if (!pageId) return { ok: false, detail: "no Page ID" };

  const pageResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=fan_count&access_token=${encodeURIComponent(account.access_token)}`);
  if (!pageResponse.ok) return { ok: false, detail: `page fetch failed (${pageResponse.status})` };
  const pageData = (await pageResponse.json()) as { fan_count?: number };
  await insertSnapshot(admin, "facebook", "followers", pageData.fan_count ?? 0, "auto");

  const postsResponse = await fetchWithTimeout(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/posts?fields=likes.summary(true),comments.summary(true),shares&limit=20&access_token=${encodeURIComponent(account.access_token)}`
  );
  if (postsResponse.ok) {
    const postsData = (await postsResponse.json()) as {
      data?: Array<{ likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; shares?: { count?: number } }>;
    };
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    for (const post of postsData.data ?? []) {
      totalLikes += post.likes?.summary?.total_count ?? 0;
      totalComments += post.comments?.summary?.total_count ?? 0;
      totalShares += post.shares?.count ?? 0;
    }
    // Sum across the last 20 posts, not all-time -- same bounded-proxy
    // trade-off as YouTube above, avoids paginating the entire post
    // history on every hourly tick.
    await insertSnapshot(admin, "facebook", "likes", totalLikes, "auto");
    await insertSnapshot(admin, "facebook", "comments", totalComments, "auto");
    await insertSnapshot(admin, "facebook", "shares", totalShares, "auto");
  }

  return { ok: true, detail: "synced" };
}

async function syncInstagram(admin: SupabaseAdmin): Promise<{ ok: boolean; detail: string }> {
  const { data: account } = await admin.from("social_accounts").select("access_token, metadata").eq("platform", "instagram").maybeSingle();
  if (!account?.access_token) return { ok: false, detail: "Instagram not linked (needs instagram_basic permission + a Business/Creator account linked to the connected Facebook Page)" };

  const igUserId = (account.metadata as Record<string, unknown> | null)?.igUserId as string | undefined;
  if (!igUserId) return { ok: false, detail: "no Instagram user ID" };

  const profileResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}?fields=followers_count&access_token=${encodeURIComponent(account.access_token)}`);
  if (!profileResponse.ok) return { ok: false, detail: `profile fetch failed (${profileResponse.status})` };
  const profileData = (await profileResponse.json()) as { followers_count?: number };
  await insertSnapshot(admin, "instagram", "followers", profileData.followers_count ?? 0, "auto");

  // like_count/comments_count on the media edge only needs instagram_basic
  // (unlike saves/shares/reach, which need instagram_manage_insights -- not
  // requested, so those stay manual-entry only, same bounded-recent-content
  // proxy as YouTube/Facebook above.
  const mediaResponse = await fetchWithTimeout(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media?fields=like_count,comments_count&limit=10&access_token=${encodeURIComponent(account.access_token)}`
  );
  if (mediaResponse.ok) {
    const mediaData = (await mediaResponse.json()) as { data?: Array<{ like_count?: number; comments_count?: number }> };
    let totalLikes = 0;
    let totalComments = 0;
    for (const media of mediaData.data ?? []) {
      totalLikes += media.like_count ?? 0;
      totalComments += media.comments_count ?? 0;
    }
    await insertSnapshot(admin, "instagram", "likes", totalLikes, "auto");
    await insertSnapshot(admin, "instagram", "comments", totalComments, "auto");
  }

  return { ok: true, detail: "synced" };
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const SB_FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeoutLong(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SB_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractNumber(html: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/[,.\s]/g, "");
      const num = Number(cleaned);
      if (Number.isFinite(num) && num >= 0) return num;
    }
  }
  return null;
}

function extractUsernameFromUrl(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    if (platform === "youtube") {
      // https://www.youtube.com/@username or /user/username or /c/channelname
      const pathMatch = u.pathname.match(/^\/@([^/]+)/) || u.pathname.match(/^\/user\/([^/]+)/) || u.pathname.match(/^\/c\/([^/]+)/);
      return pathMatch?.[1] ?? null;
    }
    if (platform === "tiktok") {
      // https://www.tiktok.com/@username
      const pathMatch = u.pathname.match(/^\/(@[^/]+)/);
      return pathMatch?.[1]?.replace(/^@/, "") ?? null;
    }
    if (platform === "instagram") {
      // https://www.instagram.com/username/
      const pathMatch = u.pathname.match(/^\/([a-zA-Z0-9._]+)\/?$/);
      return pathMatch?.[1] ?? null;
    }
    if (platform === "facebook") {
      // https://www.facebook.com/pagename or /pages/pagename/ID
      const pathMatch = u.pathname.match(/^\/([a-zA-Z0-9.]+)\/?$/);
      return pathMatch?.[1] ?? null;
    }
  } catch { /* not a URL */ }
  return null;
}

// ── YouTube direct scrape (uses API if key available, falls back to HTML) ──
async function scrapeYouTubeDirect(admin: SupabaseAdmin, url: string): Promise<{ ok: boolean; detail: string }> {
  const username = extractUsernameFromUrl(url, "youtube");
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  
  if (apiKey && username) {
    // Try API: resolve handle → channel ID → stats
    try {
      const handle = username.startsWith("@") ? username : `@${username}`;
      const resolveResp = await fetchWithTimeoutLong(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`
      );
      if (resolveResp.ok) {
        const resolveData = (await resolveResp.json()) as { items?: Array<{ id: string }> };
        const channelId = resolveData.items?.[0]?.id;
        if (channelId) {
          const statsResp = await fetchWithTimeoutLong(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`
          );
          if (statsResp.ok) {
            const statsData = (await statsResp.json()) as { items?: Array<{ statistics?: { subscriberCount?: string; viewCount?: string } }> };
            const stats = statsData.items?.[0]?.statistics;
            if (stats?.subscriberCount) {
              await insertSnapshot(admin, "youtube", "followers", Number(stats.subscriberCount), "auto");
              return { ok: true, detail: `YouTube subscribers: ${Number(stats.subscriberCount).toLocaleString()}` };
            }
          }
        }
      }
    } catch { /* fall through to HTML */ }
  }

  // Fallback: try to extract from page HTML
  try {
    const resp = await fetchWithTimeoutLong(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return { ok: false, detail: `HTTP ${resp.status}` };
    const html = await resp.text();
    const subs = extractNumber(html, [
      /"subscriberCountText"\s*:\s*\{"simpleText"\s*:\s*"([0-9,.]+)/,
      /"subscriberCount"\s*:\s*"([0-9,.]+)"/,
      /subscriberCount.*?"text"\s*:\s*"([0-9,.]+)/,
    ]);
    if (subs != null) {
      await insertSnapshot(admin, "youtube", "followers", subs, "auto");
      return { ok: true, detail: `YouTube subscribers: ${subs.toLocaleString()}` };
    }
    return { ok: false, detail: "Could not extract subscriber count" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

// ── TikTok direct scrape ──
async function scrapeTikTokDirect(admin: SupabaseAdmin, url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const resp = await fetchWithTimeoutLong(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return { ok: false, detail: `HTTP ${resp.status}` };
    const html = await resp.text();
    // TikTok embeds data in SIGI_STATE or __UNIVERSAL_DATA_FOR_REHYDRATION__
    const followers = extractNumber(html, [
      /"followerCount"\s*:\s*(\d+)/,
      /"fans"\s*:\s*(\d+)/,
      /followers.*?(\d[\d,.]*)/i,
      /"stats"\s*:\s*\{[^}]*"followerCount"\s*:\s*(\d+)/,
    ]);
    if (followers != null) {
      await insertSnapshot(admin, "tiktok", "followers", followers, "auto");
      return { ok: true, detail: `TikTok followers: ${followers.toLocaleString()}` };
    }
    return { ok: false, detail: "Could not extract follower count (TikTok may require JavaScript)" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

// ── Instagram direct scrape ──
async function scrapeInstagramDirect(admin: SupabaseAdmin, url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const resp = await fetchWithTimeoutLong(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return { ok: false, detail: `HTTP ${resp.status}` };
    const html = await resp.text();
    // Instagram includes follower count in meta tags and script data
    const followers = extractNumber(html, [
      /"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)/,
      /"follower_count"\s*:\s*(\d+)/,
      /content="([\d,.]+)\s+Followers"/i,
      /"users"\s*:\s*(\d+)/,
    ]);
    if (followers != null) {
      await insertSnapshot(admin, "instagram", "followers", followers, "auto");
      return { ok: true, detail: `Instagram followers: ${followers.toLocaleString()}` };
    }
    return { ok: false, detail: "Could not extract follower count (Instagram may require login)" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

// ── Facebook direct scrape ──
async function scrapeFacebookDirect(admin: SupabaseAdmin, url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const resp = await fetchWithTimeoutLong(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return { ok: false, detail: `HTTP ${resp.status}` };
    const html = await resp.text();
    const likes = extractNumber(html, [
      /"fan_count"\s*:\s*(\d+)/,
      /"like_count"\s*:\s*(\d+)/,
      /content="([\d,.]+)\s+people like this"/i,
      /"followersCount"\s*:\s*(\d+)/,
    ]);
    if (likes != null) {
      await insertSnapshot(admin, "facebook", "followers", likes, "auto");
      return { ok: true, detail: `Facebook likes: ${likes.toLocaleString()}` };
    }
    return { ok: false, detail: "Could not extract like count" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

// ── X/Twitter direct scrape ──
async function scrapeXDirect(admin: SupabaseAdmin, url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const resp = await fetchWithTimeoutLong(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return { ok: false, detail: `HTTP ${resp.status}` };
    const html = await resp.text();
    const followers = extractNumber(html, [
      /"followers_count"\s*:\s*(\d+)/,
      /"Friends"\s*:\s*"([0-9,.]+)/,
      /content="([\d,.]+)\s+Followers"/i,
      /data-followerscount="(\d+)"/,
    ]);
    if (followers != null) {
      await insertSnapshot(admin, "x", "followers", followers, "auto");
      return { ok: true, detail: `X followers: ${followers.toLocaleString()}` };
    }
    return { ok: false, detail: "Could not extract follower count (X may require JavaScript)" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

async function syncPlatformUrls(admin: SupabaseAdmin): Promise<Record<string, { ok: boolean; detail: string; url?: string }>> {
  const [ytUrl, ttUrl, igUrl, fbUrl, xUrl] = await Promise.all([
    admin.from("integration_settings").select("value").eq("key", "social_blade_youtube").maybeSingle(),
    admin.from("integration_settings").select("value").eq("key", "social_blade_tiktok").maybeSingle(),
    admin.from("integration_settings").select("value").eq("key", "social_blade_instagram").maybeSingle(),
    admin.from("integration_settings").select("value").eq("key", "social_blade_facebook").maybeSingle(),
    admin.from("integration_settings").select("value").eq("key", "social_blade_x").maybeSingle(),
  ]);

  const results: Record<string, { ok: boolean; detail: string; url?: string }> = {};

  const scrapers: Array<{ channel: string; url: string | null; fn: (u: string) => Promise<{ ok: boolean; detail: string }> }> = [
    { channel: "youtube", url: ytUrl.data?.value?.trim() || null, fn: (u) => scrapeYouTubeDirect(admin, u) },
    { channel: "tiktok", url: ttUrl.data?.value?.trim() || null, fn: (u) => scrapeTikTokDirect(admin, u) },
    { channel: "instagram", url: igUrl.data?.value?.trim() || null, fn: (u) => scrapeInstagramDirect(admin, u) },
    { channel: "facebook", url: fbUrl.data?.value?.trim() || null, fn: (u) => scrapeFacebookDirect(admin, u) },
    { channel: "x", url: xUrl.data?.value?.trim() || null, fn: (u) => scrapeXDirect(admin, u) },
  ];

  for (const job of scrapers) {
    if (job.url) {
      results[job.channel] = await job.fn(job.url);
      results[job.channel].url = job.url;
    } else {
      results[job.channel] = { ok: false, detail: "Not configured — กรอก URL ช่องทางในหน้า Marketing Channels" };
    }
  }

  return results;
}

function normalizeSearchConsoleSiteUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const resourceId = url.searchParams.get("resource_id");
    if (resourceId) return resourceId;
  } catch {
    // not a URL -- already a bare identifier like "sc-domain:example.com"
  }
  return raw;
}

async function syncSearchConsole(admin: SupabaseAdmin): Promise<{ ok: boolean; detail: string }> {
  const { data: setting } = await admin.from("integration_settings").select("value").eq("key", "google_search_console_site_url").maybeSingle();
  if (!setting?.value) return { ok: false, detail: "Search Console not configured" };
  const siteUrl = normalizeSearchConsoleSiteUrl(setting.value);

  const token = await getGoogleAccessToken();
  const response = await fetchWithTimeout(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ startDate: isoDateDaysAgo(28), endDate: isoDateDaysAgo(3), dimensions: ["query"], rowLimit: 25 }),
  });
  if (!response.ok) return { ok: false, detail: `Search Console query failed (${response.status})` };

  const data = (await response.json()) as { rows?: Array<{ clicks: number }> };
  const totalClicks = (data.rows ?? []).reduce((sum, row) => sum + row.clicks, 0);
  // Labeled "views" in the schema for a consistent metric key across
  // channels, but this is Google Search clicks, not pageviews from all
  // sources -- the dashboard UI captions it honestly (no GA connected).
  await insertSnapshot(admin, "website", "views", totalClicks, "auto");

  return { ok: true, detail: "synced" };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  const isCron = await checkCronSecret(admin, req);

  try {
    if (!isCron) {
      const userId = await requireStaff(admin, req);
      await enforceRateLimit(admin, userId, "marketing-metrics-snapshot", { windowMinutes: 15, maxRequests: 5 });
    }

    const results = await Promise.allSettled([syncYouTube(admin), syncFacebook(admin), syncSearchConsole(admin), syncInstagram(admin)]);
    const [youtube, facebook, searchConsole, instagram] = results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, detail: r.status === "rejected" ? String(r.reason) : "unknown error" }));

    // Platform URL scraping — runs alongside API-based syncs
    const platformUrls = await syncPlatformUrls(admin);

    // Latest metrics snapshot from DB for the dashboard display
    const { data: latestMetrics } = await admin
      .from("marketing_metric_snapshots")
      .select("channel, metric, value, captured_at")
      .order("captured_at", { ascending: false })
      .limit(50);

    // Deduplicate: keep only the latest per channel+metric
    const latestByChannel: Record<string, Record<string, { value: number; captured_at: string }>> = {};
    for (const row of latestMetrics ?? []) {
      if (!latestByChannel[row.channel]) latestByChannel[row.channel] = {};
      if (!latestByChannel[row.channel][row.metric]) {
        latestByChannel[row.channel][row.metric] = { value: row.value, captured_at: row.captured_at };
      }
    }

    return jsonResponse({ youtube, facebook, searchConsole, instagram, platformUrls, latestMetrics: latestByChannel });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return await handleUnexpectedError(admin, "marketing-metrics-snapshot", error);
  }
});
