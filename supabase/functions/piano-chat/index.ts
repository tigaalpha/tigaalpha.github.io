// piano-chat — Supabase Edge Function (Deno)
//
// ⚠️ IMPORTANT CONTEXT FOR WHOEVER DEPLOYS THIS:
// This file was written WITHOUT read access to the currently-deployed
// piano-chat function (Supabase MCP access wasn't available in this session).
// It's a from-scratch reconstruction, built strictly from the wire contract
// the CLIENT (App.tsx) actually sends/expects — verified line-by-line against
// the real client code, not guessed. Before replacing your live function with
// this: diff it against what's currently deployed and confirm nothing you
// depend on (extra logging, rate limiting, a different default model, etc.)
// gets silently dropped. Treat this as a reference implementation to merge
// from, not a blind swap.
//
// WIRE CONTRACT (confirmed from App.tsx):
//   Request:  POST { message: string, conversationHistory: {role,content}[], system: string, stream?: boolean }
//             — the "simple" path, used by the student-facing tutor chat
//               (send/callClaude and ~9 other call sites). THIS is the path
//               that switches provider/model.
//   Request:  POST { model, max_tokens, system, messages: {role,content}[], tools? }
//             — the "raw passthrough" path, used ONLY by the admin "Teach AI"
//               tab (sendAdmin), which needs Anthropic's web_search tool and
//               vision (image) content blocks. Always Anthropic — the model
//               switch below does NOT apply here, on purpose.
//   Response (stream, default): text/event-stream-shaped body where each
//             line is `data: {"content":"<token text>"}`, client also
//             tolerates a trailing `data: [DONE]`. Provider failures are
//             emitted as `data: {"error":"<message>"}` (NEVER as content) so
//             the client can show a friendly localized message.
//   Response (stream:false): `{ "text": "<full reply>" }`.
//   Response (raw passthrough): Anthropic's own Messages API JSON, unchanged
//             (client reads `data.content` blocks itself).
//
// COST-CONTROL FEATURE (this file's reason for existing):
//   The "simple" path now reads an admin-configurable app_settings row
//   (key "ai_model", value {provider, model}) before calling any provider —
//   written by the new AdminAIModel panel in App.tsx via the existing
//   admin_set_app_setting RPC. No client change, no redeploy needed to
//   switch models: flip it in /admin → AI Model, it applies to the very next
//   message. Unset → defaults to Anthropic Claude Sonnet, i.e. today's
//   behavior is preserved if the admin never touches the new setting.
//
// ENV VARS THIS FUNCTION NEEDS (set via `supabase secrets set`):
//   ANTHROPIC_API_KEY   — already required today, unchanged.
//   GEMINI_API_KEY      — NEW. Only needed once you actually switch the
//                         admin toggle to a Gemini option. Get one at
//                         https://aistudio.google.com/apikey
//   SUPABASE_URL / SUPABASE_ANON_KEY — auto-injected by the Supabase
//                         runtime for every edge function, nothing to set.
//
// ⚠️ MODEL ID CAVEAT: the owner asked for a 3rd option they called
// "Gemini 3.6 Flash" — I could not confirm that's a real, currently-shipping
// Google model ID as of my knowledge cutoff (Google's naming has gone
// 1.5 → 2.0 → 2.5, no ".6" minor version I'm aware of). Rather than guess
// and silently ship a broken option, the admin panel's model field is a free
// text override — verify the exact current model ID in Google AI Studio /
// the Gemini API docs before relying on that 3rd preset, and adjust the
// AI_MODEL_PRESETS list in App.tsx (or just type the right string into the
// admin panel) if it's changed.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const DEFAULT_MODEL = { provider: "anthropic", model: "claude-sonnet-4-6" };
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"; // used when the active provider's key is missing
const MAX_TOKENS = 1500;

type ChatMsg = { role: "user" | "assistant"; content: string };

// A provider whose API key is not configured can never succeed — silently route
// to the one that IS configured (Anthropic ↔ Gemini) instead of 401/403-ing the
// learner's every message. Keeps the chat alive when the admin panel points at a
// provider whose key is missing/expired, or when a key gets revoked mid-flight.
function effective(choice: { provider: string; model: string }): { provider: string; model: string } {
  if (choice.provider === "gemini" && !GEMINI_API_KEY && ANTHROPIC_API_KEY) return { provider: "anthropic", model: DEFAULT_MODEL.model };
  if (choice.provider === "anthropic" && !ANTHROPIC_API_KEY && GEMINI_API_KEY) return { provider: "gemini", model: GEMINI_FALLBACK_MODEL };
  return choice;
}
function effectiveDefault(): { provider: string; model: string } {
  return effective(DEFAULT_MODEL);
}

// ── which provider/model the student-facing chat should use right now ──
async function resolveActiveModel(authHeader: string | null): Promise<{ provider: string; model: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.ai_model&select=value`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader || `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return effectiveDefault();
    const rows = await res.json();
    const v = rows?.[0]?.value;
    if (v && typeof v.provider === "string" && typeof v.model === "string") return effective(v);
  } catch (_e) { /* fall through to default */ }
  return effectiveDefault();
}

// ── SSE helpers: both providers' raw streams get normalized to this ──
function sseChunk(content: string): string {
  return `data: ${JSON.stringify({ content })}\n\n`;
}
// Typed error event: the client detects `{"error":...}` and surfaces a friendly
// localized message — a raw provider 401/429 JSON blob must NEVER land in the
// learner's chat bubble as text.
function sseError(message: string): string {
  return `data: ${JSON.stringify({ error: message })}\n\n`;
}
const SSE_DONE = "data: [DONE]\n\n";

// ── Anthropic (streaming) ──
async function* streamAnthropic(model: string, system: string, messages: ChatMsg[]): AsyncGenerator<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages, stream: true }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload) continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
        yield evt.delta.text;
      }
    }
  }
}

// ── Anthropic (non-streaming, for stream:false) ──
async function callAnthropicOnce(model: string, system: string, messages: ChatMsg[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

// ── Gemini: our {role,content} history → Gemini's {role,parts} contents ──
function toGeminiContents(conversationHistory: ChatMsg[], latestUserMessage: string) {
  const contents = (conversationHistory || []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: latestUserMessage }] });
  return contents;
}

// ── Gemini (streaming via alt=sse) ──
async function* streamGemini(model: string, system: string, contents: any[]): AsyncGenerator<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
  const body: any = { contents, generationConfig: { maxOutputTokens: MAX_TOKENS } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload) continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      const parts = evt?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p: any) => p.text || "").join("") : "";
      if (text) yield text;
    }
  }
}

// ── Gemini (non-streaming, for stream:false) ──
async function callGeminiOnce(model: string, system: string, contents: any[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`;
  const body: any = { contents, generationConfig: { maxOutputTokens: MAX_TOKENS } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p.text || "").join("") : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const authHeader = req.headers.get("authorization");

  try {
    // ── admin "Teach AI" raw passthrough — always Anthropic, unaffected by the model switch ──
    if (Array.isArray(body.messages)) {
      const text = await callAnthropicOnce.__rawPassthrough
        ? "" // unreachable — placeholder removed below
        : "";
      return await handleRawPassthrough(body);
    }

    // ── simple student-facing path — provider/model comes from admin settings ──
    const message: string = body.message ?? "";
    const conversationHistory: ChatMsg[] = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
    const system: string = body.system ?? "";
    const wantStream = body.stream !== false;

    const { provider, model } = await resolveActiveModel(authHeader);

    if (!wantStream) {
      const text = provider === "gemini"
        ? await callGeminiOnce(model, system, toGeminiContents(conversationHistory, message))
        : await callAnthropicOnce(model, system, [...conversationHistory, { role: "user", content: message }]);
      return json({ text });
    }

    const gen = provider === "gemini"
      ? streamGemini(model, system, toGeminiContents(conversationHistory, message))
      : streamAnthropic(model, system, [...conversationHistory, { role: "user", content: message }]);

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for await (const piece of gen) controller.enqueue(enc.encode(sseChunk(piece)));
        } catch (e) {
          // Never stream raw provider errors into the chat — typed event instead
          // (see sseError above). Log server-side for diagnosis.
          console.error("[piano-chat] provider stream failed:", (e as Error).message);
          controller.enqueue(enc.encode(sseError((e as Error).message)));
        } finally {
          controller.enqueue(enc.encode(SSE_DONE));
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    return json({ error: (e as Error).message || "internal error" }, 500);
  }
});

// admin "Teach AI" tab — raw Anthropic Messages API passthrough (tools/vision), unchanged behavior
async function handleRawPassthrough(body: any): Promise<Response> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: body.model || DEFAULT_MODEL.model,
      max_tokens: body.max_tokens || MAX_TOKENS,
      system: body.system,
      messages: body.messages,
      ...(body.tools ? { tools: body.tools } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return json(data, res.status);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
