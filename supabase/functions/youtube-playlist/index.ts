// youtube-playlist — Supabase Edge Function (Deno)
//
// Resolves a YouTube playlist id into its individual videos via the official
// YouTube Data API, so the app's Video Lessons page can show each video as its
// own swipeable slide (see App.tsx VideoPage). The CLIENT now falls back to a
// full-playlist videoseries embed when this call fails, so a broken/missing
// function degrades gracefully — but the per-video feed is the better UX and
// this is the function that powers it.
//
// ⚠️ CORS CONTEXT (why this file exists as a rewrite):
// The previously-deployed version of this function (and of piano-chat)
// hardcoded `Access-Control-Allow-Origin: https://tigaalpha.github.io`, which
// CORS-blocks the call from the Capacitor Android app (origin
// `capacitor://localhost`) and any non-github.io host — video lessons and AI
// chat silently broke there. This reconstruction uses the same wildcard CORS
// as the repo's piano-chat. Deploying this REPLACES the pinned-origin version.
//
// WIRE CONTRACT (confirmed from App.tsx):
//   Request:  POST { playlistId: string }  (no auth required — anon key ok)
//   Response: { items: [{ videoId: string, title: string, position: number }] }
//   Failure:  400 { error }  /  500 { error }
//
// ENV VARS THIS FUNCTION NEEDS (set via `supabase secrets set`):
//   YOUTUBE_API_KEY — a YouTube Data API v3 key (Google Cloud Console).
//   SUPABASE_URL / SUPABASE_ANON_KEY — auto-injected by the runtime; used here
//   only for the anonymous-origin CORS preflight path (not strictly required).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";
const MAX_PER_PAGE = 50; // YouTube Data API cap per playlistItems page

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function fetchPage(playlistId: string, pageToken?: string): Promise<{ items: any[]; nextPageToken?: string }> {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("playlistId", playlistId);
  url.searchParams.set("maxResults", String(MAX_PER_PAGE));
  url.searchParams.set("key", YOUTUBE_API_KEY);
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let playlistId: string;
  try {
    const body = await req.json();
    playlistId = String((body as any).playlistId || "").trim();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }
  if (!playlistId || playlistId.length > 64 || !/^[a-zA-Z0-9_-]{10,64}$/.test(playlistId)) {
    return json({ error: "invalid playlistId" }, 400);
  }
  if (!YOUTUBE_API_KEY) return json({ error: "YOUTUBE_API_KEY not configured" }, 500);

  try {
    // Follow pagination so playlists longer than 50 videos resolve fully.
    const items: any[] = [];
    let next: string | undefined;
    do {
      const page = await fetchPage(playlistId, next);
      for (const it of page.items || []) {
        const snippet = it.snippet || {};
        // skip deleted/unavailable videos (snippet.title is replaced by YouTube)
        if (!snippet.title || snippet.title === "Deleted video" || snippet.title === "Private video") continue;
        const videoId = snippet.resourceId && snippet.resourceId.videoId;
        if (!videoId) continue;
        items.push({ videoId, title: snippet.title, position: it.snippet.position ?? items.length });
      }
      next = page.nextPageToken;
    } while (next && items.length < 500); // hard cap: don't let one huge playlist blow up the response

    return json({ items });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed to resolve playlist" }, 500);
  }
});
