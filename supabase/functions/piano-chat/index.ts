// piano-chat — Supabase Edge Function (Deno)
//
// This file IS the deployed function — deploy from here. (It began as a
// reconstruction from the client's wire contract, written without read access
// to the live copy; on 2026-09-10 the live copy was read back, confirmed to
// match, and this has been the source of truth since.)
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
//   DEEPSEEK_API_KEY    — for DeepSeek V4 options (direct API). https://platform.deepseek.com
//   OPENROUTER_API_KEY  — routes any chat-type feature through OpenRouter and
//                         is what makes the free tier possible. NOTE: OpenRouter
//                         RETIRES free routes without notice — on 2026-09-10 it
//                         dropped the free DeepSeek V3 route every feature here
//                         was pointed at, and as of that date lists no free
//                         DeepSeek route at all. Free ids therefore live in
//                         FREE_LADDER below and are walked in order, so a
//                         retirement costs a moment rather than the feature.
//                         https://openrouter.ai/keys
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
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const DEFAULT_MODEL = { provider: "anthropic", model: "claude-sonnet-4-6" };
/* Free OpenRouter routes, best first, checked against the live
   /api/v1/models catalogue on 2026-09-10. That check is why this list exists:
   the previous built-in chat default was "deepseek/deepseek-chat-v3-0324:free"
   and OpenRouter had RETIRED it — there is now no free DeepSeek route at all,
   every deepseek/* id is priced, so "free DeepSeek" cannot be honoured by any
   spelling. "openrouter/free" is last on purpose: it is OpenRouter's own
   router over whatever is free that day, so the final rung cannot itself go
   missing the way a named id can. */
const FREE_LADDER = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
];
// Built-in default for the student chat feature ("chat") ONLY — owner request
// 2026-09: TIGA Chat runs free, every other feature keeps the Anthropic
// default. An admin ai_models["chat"] choice always overrides this; it only
// decides what happens while that row is empty.
const CHAT_DEFAULT_MODEL = { provider: "openrouter", model: FREE_LADDER[0] };
// Last resort once EVERY free rung is gone: the cheapest paid route on the
// same key. Deliberately at the end of the chain rather than second — see
// providerChain.
const CHAT_SECOND_CHOICE = { provider: "openrouter", model: "deepseek/deepseek-v4-flash" };
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"; // used when the active provider's key is missing
const MAX_TOKENS = 1500;
// DeepSeek V4 Pro is a reasoning model — its chain-of-thought consumes part of
// the token budget, so give it more room than the 1500 used elsewhere or a long
// answer can be cut off / come back empty.
const DEEPSEEK_MAX_TOKENS = 4000;

type ChatMsg = { role: "user" | "assistant"; content: string };

const hasKey = (p: string) =>
  p === "gemini" ? !!GEMINI_API_KEY
  : p === "deepseek" ? !!DEEPSEEK_API_KEY
  : p === "openrouter" ? !!OPENROUTER_API_KEY
  : !!ANTHROPIC_API_KEY;

// A provider whose API key is not configured can never succeed — silently route
// to one that IS configured (Anthropic ↔ Gemini ↔ DeepSeek ↔ OpenRouter) instead
// of 401/403-ing the learner's every message. Keeps the chat alive when the
// admin panel points at a provider whose key is missing/expired, or when a key
// gets revoked mid-flight.
function effective(choice: { provider: string; model: string }): { provider: string; model: string } {
  if (!hasKey(choice.provider)) {
    if (ANTHROPIC_API_KEY) return { provider: "anthropic", model: DEFAULT_MODEL.model };
    if (GEMINI_API_KEY) return { provider: "gemini", model: GEMINI_FALLBACK_MODEL };
    if (DEEPSEEK_API_KEY) return { provider: "deepseek", model: "deepseek-v4-flash" };
    if (OPENROUTER_API_KEY) return { provider: "openrouter", model: FREE_LADDER[0] };
  }
  return choice;
}

// The ordered provider/model chain for one request: the admin's (or built-in)
// choice first, then every OTHER provider with a configured key.
function providerChain(primary: { provider: string; model: string }, _feature: string): Array<{ provider: string; model: string }> {
  const rest = nextProvidersWithKey(primary.provider).map((p) => ({ provider: p, model: defaultModelFor(p) }));
  /* A free route's next hop has to be another FREE route on the same key.
     Hopping straight to the paid one — which is what this did — means choosing
     "free" quietly starts billing the moment the free side hiccups, which is
     the opposite of what choosing it asked for. Walk the rest of the ladder
     first; the paid rung stays, but at the END, after free is exhausted. */
  if (primary.provider === "openrouter" && isFreeRoute(primary.model)) {
    const rungs = FREE_LADDER.filter((m) => m !== primary.model).map((m) => ({ provider: "openrouter", model: m }));
    const paid = hasKey(CHAT_SECOND_CHOICE.provider) ? [CHAT_SECOND_CHOICE] : [];
    return [primary, ...rungs, ...paid, ...rest];
  }
  return [primary, ...rest];
}

// Built-in model id for a provider (used when falling back away from the admin's
// chosen provider, where their custom model id may not exist).
function defaultModelFor(p: string): string {
  return p === "gemini" ? GEMINI_FALLBACK_MODEL
    : p === "deepseek" ? "deepseek-v4-flash"
    : p === "openrouter" ? FREE_LADDER[0]   // free rung, never bill by accident
    : DEFAULT_MODEL.model;
}

// Providers that have a usable key, in the built-in preference order — this is
// the auth-failure fallback chain (see isAuthError / withAuthFallback).
function nextProvidersWithKey(exclude: string): string[] {
  return ["anthropic", "gemini", "deepseek", "openrouter"].filter((p) => p !== exclude && hasKey(p));
}

// A key that is present but invalid/expired answers 401/403 — treat those as
// "route to the next provider with a key" rather than failing the learner. Only
// auth errors trigger this: quota (429) and provider outages (5xx) surface as-is
// so the admin actually notices them.
function isAuthError(msg: string): boolean {
  return /(401|403|unauthorized|authentication|invalid api key|not authorized|permission denied|api key|credential)/i.test(msg);
}
/* ── free routes are rate-limited, not billed ──
   OpenRouter's ":free" models answer 429 once the hour's free quota is spent.
   For a PAID model a 429 is a real problem the admin should see, which is why
   quota errors normally surface as-is. For a free one it is the expected
   steady state, and the whole appeal of picking it — no cost — evaporates if
   choosing it means the chat dies whenever the quota runs out. So a 429 from
   a free route is treated exactly like an auth failure: move quietly to the
   next configured provider and answer the learner. */
const isFreeRoute = (model: string) =>
  /:free$/i.test(model || "") || model === "openrouter/free";
function isRateLimit(msg: string): boolean {
  return /(429|rate.?limit|too many requests|quota)/i.test(msg);
}
/* ── a route that no longer exists ──
   OpenRouter RETIRES free routes. On 2026-09-10 every feature was pointed at
   "deepseek/deepseek-chat-v3-0324:free" and OpenRouter had removed it:
     404 "This model is unavailable for free. The paid version is available
          now - use this slug instead: deepseek/deepseek-chat-v3-0324"
   isTransient below happens to catch that on the word "unavailable", but only
   by accident and with the wrong meaning: retirement is permanent, so the hop
   must go to another FREE rung rather than being retried as a blip. Naming the
   case keeps the log honest about why the chain moved. */
function isDeadRoute(msg: string): boolean {
  return /(\b404\b|no endpoints found|not a valid model|model not found|unavailable for free|deprecated)/i.test(msg);
}
/* ── transient failures are invisible to the learner, so fall through ──
   2026-09-10 live probe of the then-deployed function: a TIGA Chat request
   died with `Gemini 503: high demand` while other providers sat unused — the
   chain only hopped on auth errors and free-route 429s, so ONE provider's
   outage was a TOTAL outage for the learner (the recurring "AI asks but never
   answers" report). A provider-side outage (5xx family: "overloaded", "high
   demand", "service unavailable", "try again later") or an account wall the
   learner cannot fix (OpenRouter 402 "Insufficient credits") is not their
   problem to see: hop to the next configured provider instead. A PAID model's
   429 still surfaces as-is (isRateLimit is deliberately NOT folded in here) —
   that is the one failure the admin genuinely needs to notice. Mid-stream
   failures still throw: a half-spliced answer would be worse than an error. */
function isTransient(msg: string): boolean {
  // "try again later" is deliberately NOT matched: a paid model's 429 often
  // carries that phrase, and hopping on it would contradict the rule above
  // that a paid 429 must surface so the admin sees real quota exhaustion.
  return /(\b5\d\d\b|internal server error|service unavailable|overloaded|high demand|bad gateway|gateway timeout|temporarily unavailable|unavailable)/i.test(msg)
    || /(402|insufficient (credits|funds|balance)|credit balance|out of credits)/i.test(msg);
}
function effectiveDefault(): { provider: string; model: string } {
  return effective(DEFAULT_MODEL);
}

// ── which provider/model a given FEATURE should use right now ──
// Resolution: ai_models[feature] → ai_models["default"] → legacy ai_model → built-in default
// (the built-in default is the free ladder's top rung for "chat", Anthropic for everything else).
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
  return feature === "chat" ? effective(CHAT_DEFAULT_MODEL) : effectiveDefault();
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

// ── OpenRouter (OpenAI-compatible API, streaming) — same wire shape as DeepSeek
// direct; the model id is the OpenRouter route id (a FREE_LADDER rung, or a
// paid id like "deepseek/deepseek-v4-flash"). X-Title names the app in the
// OpenRouter dashboard.
async function* streamOpenRouter(model: string, system: string, messages: ChatMsg[]): AsyncGenerator<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "X-Title": "TIGA.AI",
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
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 300)}`);
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
      const piece = evt?.choices?.[0]?.delta?.content;
      if (typeof piece === "string" && piece) yield piece;
    }
  }
}

// ── OpenRouter (non-streaming, for stream:false) ──
async function callOpenRouterOnce(model: string, system: string, messages: ChatMsg[]): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "X-Title": "TIGA.AI",
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
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// ── auth-failure fallback (see isAuthError) ──
function mkStream(p: string, m: string, system: string, full: ChatMsg[]): AsyncGenerator<string> {
  return p === "gemini"
    ? streamGemini(m, system, toGeminiContents(full.slice(0, -1), full[full.length - 1]?.content || ""))
    : p === "deepseek" ? streamDeepSeek(m, system, full)
    : p === "openrouter" ? streamOpenRouter(m, system, full)
    : streamAnthropic(m, system, full);
}

// Streaming with auth fallback: a 401/403 on the FIRST token switches to the
// next provider with a configured key; a mid-stream failure is never spliced
// across providers (would corrupt the partial reply already sent).
async function* withAuthFallback(entries: Array<{ provider: string; model?: string; gen: AsyncGenerator<string> }>): AsyncGenerator<string> {
  for (let i = 0; i < entries.length; i++) {
    let yielded = false;
    try {
      for await (const piece of entries[i].gen) { yielded = true; yield piece; }
      /* A provider can answer 200 and stream NOTHING (a reasoning model that
         burned its budget thinking) — the client used to rescue this with its
         own second round, doubling the wait. Empty stream + more chain left →
         try the next provider here, where it costs nothing. */
      if (yielded || i >= entries.length - 1) return;
      console.error(`[piano-chat] ${entries[i].provider}/${entries[i].model} streamed zero content -> trying ${entries[i + 1].provider}/${entries[i + 1].model}`);
      continue;
    } catch (e) {
      if (yielded) throw e;
      const msg = (e as Error)?.message || "";
      const m = entries[i].model || "";
      const freeExhausted = isFreeRoute(m) && isRateLimit(msg);
      const dead = isDeadRoute(msg);
      const transient = isTransient(msg);
      if ((isAuthError(msg) || freeExhausted || dead || transient) && i < entries.length - 1) {
        const why = dead ? "route retired" : freeExhausted ? "free quota spent" : transient ? "transient provider failure" : "auth failed";
        console.error(`[piano-chat] ${entries[i].provider}/${m} ${why} (${msg.slice(0, 160)}) -> trying ${entries[i + 1].provider}/${entries[i + 1].model}`);
        continue;
      }
      throw e;
    }
  }
}

// Non-streaming twin of withAuthFallback.
async function callWithAuthFallback(provider: string, model: string, system: string, full: ChatMsg[], feature = ""): Promise<string> {
  const chain = providerChain({ provider, model }, feature);
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    try {
      const text = c.provider === "gemini"
        ? await callGeminiOnce(c.model, system, toGeminiContents(full.slice(0, -1), full[full.length - 1]?.content || ""))
        : c.provider === "deepseek" ? await callDeepSeekOnce(c.model, system, full)
        : c.provider === "openrouter" ? await callOpenRouterOnce(c.model, system, full)
        : await callAnthropicOnce(c.model, system, full);
      // same empty-reply rule as the streaming path: try the next provider
      // rather than returning a blank the client has to rescue
      if (text.trim() || i >= chain.length - 1) return text;
      console.error(`[piano-chat] ${c.provider}/${c.model} returned zero content -> trying ${chain[i + 1].provider}/${chain[i + 1].model}`);
      continue;
    } catch (e) {
      const msg = (e as Error)?.message || "";
      // same rule as the streaming path: a spent free quota is not an error,
      // and neither is a provider outage or an out-of-credits wall
      const freeExhausted = isFreeRoute(c.model) && isRateLimit(msg);
      const dead = isDeadRoute(msg);
      const transient = isTransient(msg);
      if ((isAuthError(msg) || freeExhausted || dead || transient) && i < chain.length - 1) {
        const why = dead ? "route retired" : freeExhausted ? "free quota spent" : transient ? "transient provider failure" : "auth failed";
        console.error(`[piano-chat] ${c.provider}/${c.model} ${why} (${msg.slice(0, 160)}) -> trying ${chain[i + 1].provider}/${chain[i + 1].model}`);
        continue;
      }
      throw e;
    }
  }
  throw new Error("no provider available");
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

    // The full message list every provider call needs (Gemini gets its own
    // {role,parts} shape via toGeminiContents).
    const full = [...conversationHistory, { role: "user", content: message }];

    if (!wantStream) {
      const text = await callWithAuthFallback(provider, model, system, full, feature);
      return json({ text });
    }

    // Chain: the admin's (or built-in) choice first, then the rest of the free
    // ladder if that choice was free, then the paid rung, then every other
    // provider with a key. Auth failures, spent free quotas, retired routes and
    // provider outages all hop down it automatically.
    const chain = providerChain({ provider, model }, feature);
    const gen = withAuthFallback(chain.map((c) => ({ provider: c.provider, model: c.model, gen: mkStream(c.provider, c.model, system, full) })));

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        /* ── keep-alive ──
           A provider thinking about its first token sends nothing, and the
           client cannot tell that apart from a dead connection: its stall
           watchdog was aborting perfectly healthy requests and the learner
           was told the AI was busy. A comment line is valid SSE that every
           parser ignores, but it IS a read on the client, which is what
           resets that watchdog. Sent whenever the stream has been silent for
           a few seconds — before the first token and between later ones, so
           a slow reasoning model is never mistaken for a hung one. */
        let lastSent = Date.now();
        const ping = setInterval(() => {
          if (Date.now() - lastSent < 4000) return;
          try { controller.enqueue(enc.encode(": keep-alive\n\n")); lastSent = Date.now(); } catch (_e) {}
        }, 2000);
        try {
          for await (const piece of gen) {
            controller.enqueue(enc.encode(sseChunk(piece)));
            lastSent = Date.now();
          }
        } catch (e) {
          // Never stream raw provider errors into the chat — typed event instead
          // (see sseError above). Log server-side for diagnosis.
          console.error("[piano-chat] provider stream failed:", (e as Error).message);
          controller.enqueue(enc.encode(sseError((e as Error).message)));
        } finally {
          clearInterval(ping);
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

  // camera / slip-check — resolve the feature's model; deepseek/openrouter
  // (the OpenRouter presets are DeepSeek V4 chat models) have no vision, so a
  // choice there deterministically falls back to the Anthropic default (never
  // routes a chat-model id into a vision call).
  const cfg = await resolveActiveModel(authHeader, feature);
  const { provider, model } = cfg.provider === "deepseek" || cfg.provider === "openrouter"
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
