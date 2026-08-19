import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

// Scrapes Social Blade public profile pages for follower/subscriber counts.
// No API key required — reads public HTML and extracts numbers via regex.
// Profile URLs are stored in integration_settings:
//   social_blade_youtube  → https://socialblade.com/youtube/user/USERNAME
//   social_blade_tiktok   → https://socialblade.com/tiktok/user/USERNAME
//   social_blade_instagram → https://socialblade.com/instagram/user/USERNAME
// Runs hourly via cron (see migration) and on-demand from the dashboard.

const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

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

async function insertSnapshot(
  admin: SupabaseAdmin,
  channel: string,
  metric: string,
  value: number,
): Promise<void> {
  const { error } = await admin
    .from("marketing_metric_snapshots")
    .insert({ channel, metric, value, source: "auto" });
  if (error) throw error;
}

/**
 * Extract a number from Social Blade HTML. Social Blade wraps stats in
 * specific div patterns — we try multiple regex patterns to be resilient
 * to minor markup changes. Returns null if nothing matches.
 */
function extractNumber(html: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      // Social Blade uses commas: "1,234,567" — strip them
      const cleaned = match[1].replace(/[,.\s]/g, "");
      const num = Number(cleaned);
      if (Number.isFinite(num) && num >= 0) return num;
    }
  }
  return null;
}

// ── YouTube ──────────────────────────────────────────────────────
// Social Blade YouTube page shows:
//   Subscribers: "1,234,567"
//   Video Views: "98,765,432"
// These appear in divs with class "youtube-stats-up-header" or similar

const YT_SUBSCRIBER_PATTERNS = [
  /Subscribers\s*<\/span>\s*<span[^>]*>([0-9,.]+)/i,
  /subscriber[s]?\s*<\/(?:div|span|h\d)>\s*<(?:div|span)[^>]*>\s*([0-9,.]+)/i,
  /youtube-stats.*?subscribers?.*?>([0-9,.]+)/is,
  />([0-9,.]+)\s*<\/(?:span|div)>\s*<.*?(?:sub|follow)/is,
];

const YT_VIEWS_PATTERNS = [
  /Video Views?\s*<\/span>\s*<span[^>]*>([0-9,.]+)/i,
  /views?\s*<\/(?:div|span|h\d)>\s*<(?:div|span)[^>]*>\s*([0-9,.]+)/i,
  /total\s*views?.*?>([0-9,.]+)/is,
];

async function scrapeYouTube(
  admin: SupabaseAdmin,
  profileUrl: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetchWithTimeout(profileUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const html = await response.text();

    const subscribers = extractNumber(html, YT_SUBSCRIBER_PATTERNS);
    const views = extractNumber(html, YT_VIEWS_PATTERNS);

    if (subscribers != null) {
      await insertSnapshot(admin, "youtube", "followers", subscribers);
    }
    if (views != null) {
      await insertSnapshot(admin, "youtube", "views", views);
    }

    if (subscribers == null && views == null) {
      return { ok: false, detail: "Could not extract stats from page — Social Blade may have changed layout" };
    }

    return {
      ok: true,
      detail: `subscribers=${subscribers ?? "n/a"}, views=${views ?? "n/a"}`,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

// ── TikTok ───────────────────────────────────────────────────────
// Social Blade TikTok page shows:
//   Followers: "1,234,567"
//   Likes: "98,765,432"
//   Videos: "123"

const TT_FOLLOWER_PATTERNS = [
  /Followers?\s*<\/span>\s*<span[^>]*>([0-9,.]+)/i,
  /followers?\s*<\/(?:div|span|h\d)>\s*<(?:div|span)[^>]*>\s*([0-9,.]+)/i,
  /tiktok-stats.*?followers?.*?>([0-9,.]+)/is,
  />([0-9,.]+)\s*<\/(?:span|div)>\s*<.*?(?:follow)/is,
];

const TT_LIKES_PATTERNS = [
  /(?:Total\s*)?Likes?\s*<\/span>\s*<span[^>]*>([0-9,.]+)/i,
  /likes?\s*<\/(?:div|span|h\d)>\s*<(?:div|span)[^>]*>\s*([0-9,.]+)/i,
];

async function scrapeTikTok(
  admin: SupabaseAdmin,
  profileUrl: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetchWithTimeout(profileUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const html = await response.text();

    const followers = extractNumber(html, TT_FOLLOWER_PATTERNS);
    const likes = extractNumber(html, TT_LIKES_PATTERNS);

    if (followers != null) {
      await insertSnapshot(admin, "tiktok", "followers", followers);
    }
    if (likes != null) {
      await insertSnapshot(admin, "tiktok", "likes", likes);
    }

    if (followers == null && likes == null) {
      return { ok: false, detail: "Could not extract stats from page" };
    }

    return {
      ok: true,
      detail: `followers=${followers ?? "n/a"}, likes=${likes ?? "n/a"}`,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

// ── Instagram ────────────────────────────────────────────────────
// Social Blade Instagram page shows:
//   Followers: "1,234,567"
//   Following: "456"
//   Uploads: "789"

const IG_FOLLOWER_PATTERNS = [
  /Followers?\s*<\/span>\s*<span[^>]*>([0-9,.]+)/i,
  /followers?\s*<\/(?:div|span|h\d)>\s*<(?:div|span)[^>]*>\s*([0-9,.]+)/i,
  /instagram-stats.*?followers?.*?>([0-9,.]+)/is,
  />([0-9,.]+)\s*<\/(?:span|div)>\s*<.*?(?:follow)/is,
];

const IG_POSTS_PATTERNS = [
  /(?:Uploads?|Posts?)\s*<\/span>\s*<span[^>]*>([0-9,.]+)/i,
  /(?:uploads?|posts?)\s*<\/(?:div|span|h\d)>\s*<(?:div|span)[^>]*>\s*([0-9,.]+)/i,
];

async function scrapeInstagram(
  admin: SupabaseAdmin,
  profileUrl: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetchWithTimeout(profileUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const html = await response.text();

    const followers = extractNumber(html, IG_FOLLOWER_PATTERNS);
    const posts = extractNumber(html, IG_POSTS_PATTERNS);

    if (followers != null) {
      await insertSnapshot(admin, "instagram", "followers", followers);
    }
    // Store posts count as a metric so the dashboard can show it
    if (posts != null) {
      await insertSnapshot(admin, "instagram", "views", posts);
    }

    if (followers == null && posts == null) {
      return { ok: false, detail: "Could not extract stats from page" };
    }

    return {
      ok: true,
      detail: `followers=${followers ?? "n/a"}, posts=${posts ?? "n/a"}`,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function getProfileUrl(
  admin: SupabaseAdmin,
  key: string,
): Promise<string | null> {
  const { data } = await admin
    .from("integration_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value?.trim() || null;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  const isCron = await checkCronSecret(admin, req);

  try {
    if (!isCron) {
      const userId = await requireStaff(admin, req);
      await enforceRateLimit(admin, userId, "social-blade-scraper", {
        windowMinutes: 60,
        maxRequests: 10,
      });
    }

    const [ytUrl, ttUrl, igUrl] = await Promise.all([
      getProfileUrl(admin, "social_blade_youtube"),
      getProfileUrl(admin, "social_blade_tiktok"),
      getProfileUrl(admin, "social_blade_instagram"),
    ]);

    const results: Record<string, { ok: boolean; detail: string; url?: string }> = {};

    if (ytUrl) {
      results.youtube = await scrapeYouTube(admin, ytUrl);
      results.youtube.url = ytUrl;
    } else {
      results.youtube = { ok: false, detail: "Not configured (set social_blade_youtube in integration_settings)" };
    }

    if (ttUrl) {
      results.tiktok = await scrapeTikTok(admin, ttUrl);
      results.tiktok.url = ttUrl;
    } else {
      results.tiktok = { ok: false, detail: "Not configured (set social_blade_tiktok in integration_settings)" };
    }

    if (igUrl) {
      results.instagram = await scrapeInstagram(admin, igUrl);
      results.instagram.url = igUrl;
    } else {
      results.instagram = { ok: false, detail: "Not configured (set social_blade_instagram in integration_settings)" };
    }

    return jsonResponse(results);
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return await handleUnexpectedError(admin, "social-blade-scraper", error);
  }
});
