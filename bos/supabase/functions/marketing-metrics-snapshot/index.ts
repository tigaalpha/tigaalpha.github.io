import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
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

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
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
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCron = Boolean(cronSecret) && req.headers.get("x-cron-secret") === cronSecret;

  try {
    if (!isCron) {
      const userId = await requireStaff(admin, req);
      await enforceRateLimit(admin, userId, "marketing-metrics-snapshot", { windowMinutes: 15, maxRequests: 5 });
    }

    const results = await Promise.allSettled([syncYouTube(admin), syncFacebook(admin), syncSearchConsole(admin)]);
    const [youtube, facebook, searchConsole] = results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, detail: r.status === "rejected" ? String(r.reason) : "unknown error" }));

    return jsonResponse({ youtube, facebook, searchConsole });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return await handleUnexpectedError(admin, "marketing-metrics-snapshot", error);
  }
});
