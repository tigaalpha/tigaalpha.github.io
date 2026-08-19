import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const FETCH_TIMEOUT_MS = 8000;
const TOP_N = 10;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface TrendItem {
  rank: number;
  topic: string;
  detail?: string;
}

interface TrendStatus {
  connected: boolean;
  detail: string;
  items?: TrendItem[];
}

// Google has no official trends API. This is the same undocumented JSON
// endpoint the trends.google.com website itself calls -- widely relied on
// by other trend-tracking tools, but Google can change or rate-limit it
// without notice, so failures are caught and surfaced as "not available"
// rather than breaking the page.
async function checkGoogleTrends(geo: string): Promise<TrendStatus> {
  try {
    const response = await fetchWithTimeout(
      `https://trends.google.com/trends/api/dailytrends?hl=th&tz=-420&geo=${encodeURIComponent(geo)}&ns=15`
    );
    if (!response.ok) {
      return { connected: false, detail: `Google Trends ตอบกลับ ${response.status} (อาจถูกจำกัดชั่วคราว)` };
    }
    const raw = await response.text();
    // Response is prefixed with ")]}'," to prevent JSON hijacking -- strip
    // everything up to the first "{" before parsing.
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) throw new Error("Unexpected response shape");
    const data = JSON.parse(raw.slice(jsonStart)) as {
      default?: {
        trendingSearchesDays?: Array<{
          trendingSearches?: Array<{
            title?: { query?: string };
            formattedTraffic?: string;
            articles?: Array<{ title?: string }>;
          }>;
        }>;
      };
    };
    const searches = data.default?.trendingSearchesDays?.[0]?.trendingSearches ?? [];
    const items: TrendItem[] = searches.slice(0, TOP_N).map((s, i) => ({
      rank: i + 1,
      topic: s.title?.query ?? s.articles?.[0]?.title ?? "-",
      detail: s.formattedTraffic ? `ค้นหา ${s.formattedTraffic}` : undefined,
    }));
    if (items.length === 0) return { connected: false, detail: "ไม่พบข้อมูลเทรนด์ในขณะนี้" };
    return { connected: true, detail: "ข้อมูลสดจาก Google Trends", items };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "ดึงข้อมูล Google Trends ไม่สำเร็จ" };
  }
}

async function checkYouTubeTrending(apiKey: string | undefined, regionCode: string): Promise<TrendStatus> {
  if (!apiKey) return { connected: false, detail: "ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY (ดูวิธีที่หน้า Settings)" };

  try {
    const params = new URLSearchParams({
      part: "snippet,statistics",
      chart: "mostPopular",
      regionCode,
      maxResults: String(TOP_N),
      key: apiKey,
    });
    const response = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
    if (!response.ok) {
      const body = await response.text();
      return { connected: false, detail: `YouTube ปฏิเสธคำขอ (${response.status}): ${body.slice(0, 200)}` };
    }
    const data = (await response.json()) as {
      items?: Array<{
        snippet?: { title?: string; channelTitle?: string };
        statistics?: { viewCount?: string };
      }>;
    };
    const items: TrendItem[] = (data.items ?? []).map((v, i) => ({
      rank: i + 1,
      topic: v.snippet?.title ?? "-",
      detail: [v.snippet?.channelTitle, v.statistics?.viewCount ? `${Number(v.statistics.viewCount).toLocaleString("th-TH")} วิว` : null]
        .filter(Boolean)
        .join(" · "),
    }));
    if (items.length === 0) return { connected: false, detail: "ไม่พบวิดีโอกำลังนิยมในขณะนี้" };
    return { connected: true, detail: "ข้อมูลสดจาก YouTube Data API", items };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "ดึงข้อมูล YouTube Trending ไม่สำเร็จ" };
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    // Shares the same YouTube Data API daily quota concern as
    // marketing-channel-status -- see the comment there.
    await enforceRateLimit(admin, userId, "social-trends-status", { windowMinutes: 5, maxRequests: 10 });

    const geo = Deno.env.get("SOCIAL_TRENDS_GEO") ?? "TH";

    const [google, youtube] = await Promise.all([
      checkGoogleTrends(geo),
      checkYouTubeTrending(Deno.env.get("YOUTUBE_API_KEY"), geo),
    ]);

    return jsonResponse({ google, youtube });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return await handleUnexpectedError(admin, "social-trends-status", error);
  }
});
