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
//   Request:  POST { message: string, conversationHistory: {role,content}[], system: string, stream?: boolean, feature?: string }
//             — the "simple" path, used by the student-facing tutor chat
//               (send/callClaude), the AI Voice Tutor, play-along style/analysis,
//               AI reports/plans and ~9 other call sites. THIS is the path
//               that switches provider/model per feature.
//             — `feature` names WHICH product surface the call comes from
//               ("chat" | "voice" | "song-style" | "song-analysis" | "compose" |
//               "song-gen" | "coach-tip" | "weekly-report" | "practice-plan" |
//               "camera" | "slip-check" | "admin-chat"). The admin "AI Models"
//               panel stores one {provider, model} per feature under the
//               app_settings "ai_models" key, so every feature can run on a
//               different model independently. Missing feature → "chat".
//   Request:  POST { model, max_tokens, system, messages: {role,content}[], tools?, feature? }
//             — the "raw passthrough" path, used by the camera hand-posture
//               coach (feature "camera"), the admin slip-reader ("slip-check")
//               and the admin "Teach AI" tab ("admin-chat", which needs
//               Anthropic's web_search tool + vision image blocks). The
//               provider is resolved per-feature too: anthropic and gemini are
//               both supported (vision); deepseek has no vision models, so a
//               deepseek choice on one of these falls back to the default.
//               admin-chat is locked to Anthropic because its web_search tool
//               only exists there.
//   Response (stream, default): text/event-stream-shaped body where each
//             line is `data: {"content":"<token text>"}`, client also
//             tolerates a trailing `data: [DONE]`. Provider failures are
//             emitted as `data: {"error":"<message>"}` (NEVER as content) so
//             the client can show a friendly localized message.
//   Response (stream:false): `{ "text": "<full reply>" }`.
//   Response (raw passthrough): Anthropic's own Messages API JSON, unchanged
//             (client reads `data.content` blocks itself) — Gemini raw replies
//             are normalized to that same `{content:[{type:"text",...}]}` shape.
//
// PER-FEATURE MODEL SELECTION (this file's reason for existing):
//   Reads an admin-configurable app_settings row (key "ai_models", value
//   { "<feature>": {provider, model, ...} }) before calling any provider —
//   written by the AdminAIModels panel in App.tsx via the existing
//   admin_set_app_setting RPC. Resolution order for a request:
//     ai_models[feature] → ai_models["default"] → legacy "ai_model" key →
//     built-in default (Anthropic Claude Sonnet). No client change, no
//   redeploy needed to switch models: flip it in /admin → AI Models, it
//   applies to the very next request of that feature.
//
// ENV VARS THIS FUNCTION NEEDS (set via `supabase secrets set`):
//   ANTHROPIC_API_KEY   — required for Anthropic (the default).
//   GEMINI_API_KEY      — for Gemini options. https://aistudio.google.com/apikey
//   DEEPSEEK_API_KEY    — for DeepSeek V4 options. https://platform.deepseek.com
//   SUPABASE_URL / SUPABASE_ANON_KEY — auto-injected by the Supabase
//                         runtime for every edge function, nothing to set.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const DEFAULT_MODEL = { provider: "anthropic", model: "claude-sonnet-4-6" };
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"; // used when the active provider's key is missing
const MAX_TOKENS = 1500;
// DeepSeek V4 Pro is a reasoning model — its chain-of-thought consumes part of
// the token budget, so give it more room than the 1500 used elsewhere or a long
// answer can be cut off / come back empty.
const DEEPSEEK_MAX_TOKENS = 4000;

type ChatMsg = { role: "user" | "assistant"; content: string };

// A provider whose API key is not configured can never succeed — silently route
// to one that IS configured (Anthropic ↔ Gemini ↔ DeepSeek) instead of
// 401/403-ing the learner's every message. Keeps the chat alive when the admin
// panel points at a provider whose key is missing/expired, or when a key gets
// revoked mid-flight.
function effective(choice: { provider: string; model: string }): { provider: string; model: string } {
  const hasKey = (p: string) =>
    p === "gemini" ? !!GEMINI_API_KEY : p === "deepseek" ? !!DEEPSEEK_API_KEY : !!ANTHROPIC_API_KEY;
  if (!hasKey(choice.provider)) {
    if (ANTHROPIC_API_KEY) return { provider: "anthropic", model: DEFAULT_MODEL.model };
    if (GEMINI_API_KEY) return { provider: "gemini", model: GEMINI_FALLBACK_MODEL };
    if (DEEPSEEK_API_KEY) return { provider: "deepseek", model: "deepseek-v4-flash" };
  }
  return choice;
}
function effectiveDefault(): { provider: string; model: string } {
  return effective(DEFAULT_MODEL);
}

// ── which provider/model a given FEATURE should use right now ──
// Resolution: ai_models[feature] → ai_models["default"] → legacy ai_model → built-in default.
async function resolveActiveModel(authHeader: string | null, feature: string): Promise<{ provider: string; model: string }> {
  const pick = (map: Record<string, any>, key: string) => {
    const v = map && map[key];
    if (v && typeof v.provider === "string" && typeof v.model === "string") return effective(v);
    return null;
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=in.(ai_models,ai_model)&select=key,value`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader || `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (res.ok) {
      const rows = await res.json();
      const models = (rows || []).find((r: any) => r?.key === "ai_models")?.value || null;
      if (models) {
        const f = pick(models, feature) || pick(models, "default");
        if (f) return f;
      }
      const legacy = (rows || []).find((r: any) => r?.key === "ai_model")?.value;
      const l = pick({ legacy }, "legacy");
      if (l) return l;
    }
  } catch (_e) { /* fall through to default */ }
  return effectiveDefault();
}

// ── SSE helpers: every provider's raw stream gets normalized to this ──
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

// ── DeepSeek (OpenAI-compatible API, streaming) ──
async function* streamDeepSeek(model: string, system: string, messages: ChatMsg[]): AsyncGenerator<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: DEEPSEEK_MAX_TOKENS,
      stream: true,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...messages,
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${detail.slice(0, 300)}`);
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
      if (!payload || payload === "[DONE]") continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      // reasoning models emit thinking in delta.reasoning_content — only ever
      // surface delta.content (the actual reply) to the learner.
      const piece = evt?.choices?.[0]?.delta?.content;
      if (typeof piece === "string" && piece) yield piece;
    }
  }
}

// ── DeepSeek (non-streaming) ──
async function callDeepSeekOnce(model: string, system: string, messages: ChatMsg[]): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: DEEPSEEK_MAX_TOKENS,
      stream: false,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...messages,
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const authHeader = req.headers.get("authorization");
  const feature = typeof body.feature === "string" && body.feature ? body.feature : "chat";

  try {
    // ── raw passthrough (camera / slip-check / admin Teach AI) — provider
    // resolved per feature; deepseek falls back (no vision); admin-chat stays Anthropic ──
    if (Array.isArray(body.messages)) {
      return await handleRawPassthrough(body, authHeader, feature);
    }

    // ── simple student-facing path — provider/model comes from admin settings ──
    const message: string = body.message ?? "";
    const conversationHistory: ChatMsg[] = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
    const system: string = body.system ?? "";
    const wantStream = body.stream !== false;

    const { provider, model } = await resolveActiveModel(authHeader, feature);

    if (!wantStream) {
      const text = provider === "gemini"
        ? await callGeminiOnce(model, system, toGeminiContents(conversationHistory, message))
        : provider === "deepseek"
        ? await callDeepSeekOnce(model, system, [...conversationHistory, { role: "user", content: message }])
        : await callAnthropicOnce(model, system, [...conversationHistory, { role: "user", content: message }]);
      return json({ text });
    }

    const gen = provider === "gemini"
      ? streamGemini(model, system, toGeminiContents(conversationHistory, message))
      : provider === "deepseek"
      ? streamDeepSeek(model, system, [...conversationHistory, { role: "user", content: message }])
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

// ── raw passthrough: Anthropic-style body, per-feature provider ──
//   "camera"/"slip-check" need vision → anthropic or gemini (deepseek has no
//   vision, so a deepseek choice falls back to the default).
//   "admin-chat" needs Anthropic's web_search tool → always Anthropic (model ID
//   still switchable among Anthropic models via ai_models).
// Replies are normalized to Anthropic's {content:[{type:"text",...}]} JSON
// shape so the client's fetchChatCompletion parsing is unchanged.
async function handleRawPassthrough(body: any, authHeader: string | null, feature: string): Promise<Response> {
  if (feature === "admin-chat") {
    const cfg = await resolveActiveModel(authHeader, "admin-chat");
    const model = cfg.provider === "anthropic" ? cfg.model : DEFAULT_MODEL.model;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: body.model || model,
        max_tokens: body.max_tokens || MAX_TOKENS,
        system: body.system,
        messages: body.messages,
        ...(body.tools ? { tools: body.tools } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    return json(data, res.status);
  }

  // camera / slip-check — resolve the feature's model; deepseek has no vision,
  // so a deepseek choice deterministically falls back to the Anthropic default
  // (never routes a deepseek model id into the Anthropic API).
  const cfg = await resolveActiveModel(authHeader, feature);
  const { provider, model } = cfg.provider === "deepseek"
    ? { provider: "anthropic", model: DEFAULT_MODEL.model }
    : cfg;

  if (provider === "gemini") {
    try {
      const text = await callGeminiRaw(model, body);
      return json({ content: [{ type: "text", text }] });
    } catch (e) {
      return json({ error: (e as Error).message || "gemini raw failed" }, 502);
    }
  }

  // anthropic (default) — exact same call as before
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: body.model || model,
      max_tokens: body.max_tokens || MAX_TOKENS,
      system: body.system,
      messages: body.messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return json(data, res.status);
}

// Convert the Anthropic-style raw body (text + image content blocks) to a Gemini
// generateContent request. Supports the base64 image blocks the camera coach and
// the slip-reader send — that's what makes vision features switchable to Gemini.
async function callGeminiRaw(model: string, body: any): Promise<string> {
  const contents = (body.messages || []).map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: (Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content || "" }]).map((b: any) =>
      b.type === "image"
        ? { inline_data: { mime_type: b.source?.media_type || "image/jpeg", data: b.source?.data || "" } }
        : { text: b.text || "" }
    ),
  }));
  const g: any = { contents, generationConfig: { maxOutputTokens: body.max_tokens || MAX_TOKENS } };
  if (body.system) g.systemInstruction = { parts: [{ text: body.system }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(g) });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p.text || "").join("") : "";
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
