import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { listEventsBetween } from "../_shared/calendar.ts";

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

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    await requireStaff(admin, req);

    const [line, googleCalendar, gemini] = await Promise.all([checkLine(), checkGoogleCalendar(), checkGemini()]);

    return jsonResponse({ line, googleCalendar, gemini });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
