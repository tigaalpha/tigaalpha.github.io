import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

const GRAPH_VERSION = "v19.0";
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface WebsiteStatus {
  connected: boolean;
  detail: string;
  responseTimeMs?: number;
  statusCode?: number;
}

async function checkWebsite(url: string | null): Promise<WebsiteStatus> {
  if (!url) return { connected: false, detail: "ยังไม่ได้ตั้งค่า URL เว็บไซต์" };

  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(url, { method: "GET" });
    const responseTimeMs = Date.now() - startedAt;
    return {
      connected: response.ok,
      detail: response.ok ? "เว็บไซต์ตอบสนองปกติ" : `เว็บไซต์ตอบกลับ ${response.status}`,
      responseTimeMs,
      statusCode: response.status,
    };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "เชื่อมต่อเว็บไซต์ไม่สำเร็จ" };
  }
}

interface YouTubeStatus {
  connected: boolean;
  detail: string;
  title?: string;
  thumbnail?: string;
  subscriberCount?: number;
  viewCount?: number;
  videoCount?: number;
  latestVideo?: { title: string; videoId: string; publishedAt: string };
}

function looksLikeChannelId(value: string): boolean {
  return /^UC[a-zA-Z0-9_-]{22}$/.test(value);
}

async function checkYouTube(apiKey: string | undefined, handleOrId: string | null): Promise<YouTubeStatus> {
  if (!apiKey) return { connected: false, detail: "YOUTUBE_API_KEY ยังไม่ได้ตั้งค่า" };
  if (!handleOrId) return { connected: false, detail: "ยังไม่ได้ตั้งค่า YouTube handle หรือ Channel ID" };

  try {
    let channelId = handleOrId.trim();

    if (!looksLikeChannelId(channelId)) {
      const handle = channelId.startsWith("@") ? channelId : `@${channelId}`;
      const resolveResponse = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`
      );
      if (!resolveResponse.ok) {
        const body = await resolveResponse.text();
        return { connected: false, detail: `YouTube ปฏิเสธ (${resolveResponse.status}): ${body.slice(0, 200)}` };
      }
      const resolveData = (await resolveResponse.json()) as { items?: Array<{ id: string }> };
      const resolvedId = resolveData.items?.[0]?.id;
      if (!resolvedId) return { connected: false, detail: `ไม่พบช่อง YouTube สำหรับ "${handleOrId}"` };
      channelId = resolvedId;
    }

    const statsResponse = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`
    );
    if (!statsResponse.ok) {
      const body = await statsResponse.text();
      return { connected: false, detail: `YouTube ปฏิเสธ (${statsResponse.status}): ${body.slice(0, 200)}` };
    }
    const statsData = (await statsResponse.json()) as {
      items?: Array<{
        snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
        statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    };
    const channel = statsData.items?.[0];
    if (!channel) return { connected: false, detail: `ไม่พบช่อง YouTube สำหรับ "${handleOrId}"` };

    const result: YouTubeStatus = {
      connected: true,
      detail: "เชื่อมต่อสำเร็จ",
      title: channel.snippet?.title,
      thumbnail: channel.snippet?.thumbnails?.default?.url,
      subscriberCount: Number(channel.statistics?.subscriberCount ?? 0),
      viewCount: Number(channel.statistics?.viewCount ?? 0),
      videoCount: Number(channel.statistics?.videoCount ?? 0),
    };

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (uploadsPlaylistId) {
      const latestResponse = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${apiKey}`
      );
      if (latestResponse.ok) {
        const latestData = (await latestResponse.json()) as {
          items?: Array<{ snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }>;
        };
        const latest = latestData.items?.[0]?.snippet;
        if (latest?.resourceId?.videoId) {
          result.latestVideo = {
            title: latest.title ?? "",
            videoId: latest.resourceId.videoId,
            publishedAt: latest.publishedAt ?? "",
          };
        }
      }
    }

    return result;
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "เชื่อมต่อ YouTube ไม่สำเร็จ" };
  }
}

interface FacebookStatus {
  connected: boolean;
  detail: string;
  name?: string;
  fanCount?: number;
  link?: string;
}

async function checkFacebook(admin: ReturnType<typeof createAdminClient>): Promise<FacebookStatus> {
  const { data: account } = await admin
    .from("social_accounts")
    .select("access_token, metadata")
    .eq("platform", "facebook")
    .maybeSingle();

  if (!account?.access_token) {
    return { connected: false, detail: "ยังไม่ได้เชื่อมต่อ Facebook Page — ไปที่ Settings > Integrations" };
  }

  const pageId = (account.metadata as Record<string, unknown> | null)?.pageId as string | undefined;
  if (!pageId) return { connected: false, detail: "ไม่พบ Page ID ที่เชื่อมต่อไว้" };

  try {
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=fan_count,name,link&access_token=${encodeURIComponent(account.access_token)}`
    );
    if (!response.ok) {
      const body = await response.text();
      return { connected: false, detail: `Facebook ปฏิเสธ token (${response.status}): ${body.slice(0, 200)}` };
    }
    const data = (await response.json()) as { fan_count?: number; name?: string; link?: string };
    return { connected: true, detail: "เชื่อมต่อสำเร็จ", name: data.name, fanCount: data.fan_count, link: data.link };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "เชื่อมต่อ Facebook ไม่สำเร็จ" };
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    await requireStaff(admin, req);

    const { data: settingsRows } = await admin
      .from("integration_settings")
      .select("key, value")
      .in("key", ["marketing_website_url", "youtube_channel_handle"]);
    const settings = Object.fromEntries((settingsRows ?? []).map((row: { key: string; value: string | null }) => [row.key, row.value]));

    const [website, youtube, facebook] = await Promise.all([
      checkWebsite(settings.marketing_website_url ?? null),
      checkYouTube(Deno.env.get("YOUTUBE_API_KEY"), settings.youtube_channel_handle ?? null),
      checkFacebook(admin),
    ]);

    return jsonResponse({ website, youtube, facebook });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
