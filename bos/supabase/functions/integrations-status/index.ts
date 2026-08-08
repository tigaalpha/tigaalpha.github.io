import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { listEventsBetween } from "../_shared/calendar.ts";
import { OPENROUTER_BASE_URL } from "../_shared/openrouter.ts";

interface CheckResult {
  connected: boolean;
  detail: string;
}

async function checkLine(): Promise<CheckResult> {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) return { connected: false, detail: "LINE_CHANNEL_ACCESS_TOKEN is not set." };

  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { connected: false, detail: `LINE rejected the access token (${response.status}).` };
    const data = (await response.json()) as { displayName?: string };
    return { connected: true, detail: data.displayName ? `Connected as "${data.displayName}"` : "Connected" };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "Request to LINE failed." };
  }
}

async function checkGoogleCalendar(): Promise<CheckResult> {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 60_000);
    await listEventsBetween(now.toISOString(), soon.toISOString());
    return { connected: true, detail: "Connected" };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "Google Calendar check failed." };
  }
}

// Actually calls Gemini (a real key-presence check would falsely report
// "connected" for an expired/typo'd/wrong-project key — the exact failure
// mode that made ai-chat/generate-article/knowledge-upload fail silently).
async function checkGemini(): Promise<CheckResult> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return { connected: false, detail: "GEMINI_API_KEY is not set." };

  const model = Deno.env.get("AI_EMBEDDING_MODEL") ?? "gemini-embedding-001";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text: "ping" }] },
          outputDimensionality: 768,
        }),
      }
    );
    if (!response.ok) {
      const body = await response.text();
      return { connected: false, detail: `Gemini rejected the API key (${response.status}): ${body.slice(0, 200)}` };
    }
    return { connected: true, detail: "Gemini API key is valid" };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "Request to Gemini failed." };
  }
}

// Every non-Gemini chat model (TIGA AI AGENT + Strategy Room) shares one
// OpenRouter connection, so one GET /models check (validates the key
// without spending tokens) covers all of them -- no need to ping seven
// separate vendor APIs.
async function checkOpenAICompatibleModels(envKey: string, baseUrl: string): Promise<CheckResult> {
  const key = Deno.env.get(envKey);
  if (!key) return { connected: false, detail: `${envKey} is not set.` };

  try {
    const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) {
      const body = await response.text();
      return { connected: false, detail: `Rejected the API key (${response.status}): ${body.slice(0, 200)}` };
    }
    return { connected: true, detail: "API key is valid" };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "Request failed." };
  }
}

// Marketing Channels page needs a real channel to check; this Settings
// badge just needs to know the key itself works, so it hits the cheapest
// endpoint that doesn't depend on any channel/handle being configured yet.
async function checkYouTube(): Promise<CheckResult> {
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (!key) return { connected: false, detail: "YOUTUBE_API_KEY is not set." };

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/i18nRegions?part=snippet&key=${key}`);
    if (!response.ok) {
      const body = await response.text();
      return { connected: false, detail: `YouTube rejected the API key (${response.status}): ${body.slice(0, 200)}` };
    }
    return { connected: true, detail: "YouTube API key is valid" };
  } catch (error) {
    return { connected: false, detail: error instanceof Error ? error.message : "Request to YouTube failed." };
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const [line, googleCalendar, gemini, youtube, openrouter] = await Promise.all([
      checkLine(),
      checkGoogleCalendar(),
      checkGemini(),
      checkYouTube(),
      checkOpenAICompatibleModels("OPENROUTER_API_KEY", OPENROUTER_BASE_URL),
    ]);

    return jsonResponse({ line, googleCalendar, gemini, youtube, openrouter });
  } catch (error) {
    return await handleUnexpectedError(admin, "integrations-status", error);
  }
});
