import { SUPABASE_ANON_KEY } from "./supabase-client";

/* ── Chat backend config ──
   The chat goes through a Supabase Edge Function ("piano-chat") that keeps the
   Anthropic API key server-side. The anon key below is a PUBLIC key — safe to ship
   in the frontend — and is required because the function has verify_jwt enabled. */
export const API_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/piano-chat";
export const TTS_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/piano-tts";

// piano-chat/piano-tts require a genuine per-user session (not just the public
// anon key) so they can't be called anonymously off the project's AI budget.
// Kept up to date by the auth-state listener in App() via setAccessToken() —
// every fetch below reads it fresh via apiHeaders() rather than a stale captured
// header object.
let _accessToken: string | null = null;
export function setAccessToken(token: string | null) { _accessToken = token; }
export function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + (_accessToken || SUPABASE_ANON_KEY),
    "apikey": SUPABASE_ANON_KEY,
  };
}

/* ── shared LLM call plumbing ──
   11 call sites across the app each used to hand-roll their own
   fetch+response-handling against API_URL: the 4 hook-owned ones (chat's
   callClaude, voice-tutor's vmFetchAI, play-along's styleTransform/
   fetchSongAnalysis, camera-coach's analyzeHands) plus 6 still directly in
   App.tsx (composeGenerate, SongListPage's generateSong, generateCoachTip's
   attempt(), AdminPayments' aiRead slip-checker, AdminPage's own diagnostic
   chat, the AI Weekly Report/Practice Plan generator). Two shapes cover all
   11: streamChatCompletion (SSE, `data: {"content":"..."}` lines) for the
   ones that stream, fetchChatCompletion (plain JSON, either a `{text}`
   shape when the request set `stream:false` or Anthropic-native `{content:
   [...]}` blocks otherwise) for the ones that don't. Callers still build
   their own request body (the shape differs - {message,conversationHistory,
   system} for most, a raw {model,max_tokens,system,messages} Anthropic-
   style body with an image block for analyzeHands/aiRead, an optional
   `tools` field for AdminPage's web-search chat) and still own their own
   response parsing (incremental UI flush, sentence-boundary TTS
   segmentation, JSON-blob extraction, etc.) - only the fetch/stream-read/
   error-shape boilerplate is shared. */

// POSTs `body` to the chat backend and streams the SSE response, calling
// onStart() once the response is confirmed ok (before any bytes are read -
// callers that need to swap a "thinking" indicator for a live bubble at
// exactly this moment use it) and onChunk(accumulatedTextSoFar) each time
// new content arrives. onRawChunk() fires on every stream read, including
// ones with no parseable content - callers doing their own stall-watchdog
// (vmFetchAI) reset their timer here rather than only on content chunks, to
// exactly match the original per-hook implementation this replaces. Returns
// the final accumulated text; throws on a non-ok/bodyless response.
//
// Stall protection (stallMs, default 9s - the same value vmFetchAI already
// used for its own hand-rolled watchdog): only kicks in when the caller
// doesn't pass their own `signal` - vmFetchAI supplies one and is left
// completely alone, unchanged from before this existed. Every OTHER caller
// (found by the stability audit to have no timeout at all - a hung
// connection left their loading state stuck true forever, buttons
// permanently disabled) now gets one for free with zero changes at their
// call site. Resets on every stream read, not just content-bearing ones -
// a slow-but-actively-connected response is never killed, only a
// genuinely stalled one.
export async function streamChatCompletion(body, { onStart, onChunk, onRawChunk, signal, stallMs = 20000, connectMs = 30000 } = {}) {
  /* ── why this is three budgets and not one ──
     It used to be a single 9-second timer, armed BEFORE the fetch and only
     ever reset after the first successful read. That one budget had to cover
     the connection, the edge function's cold start, its lookup of the admin's
     chosen model, AND the provider's time to its first token — and a
     reasoning model on a phone's mobile data will not do all of that in nine
     seconds. When it overran, the abort landed in the caller's catch and the
     learner was told "the AI is a bit busy", which was never true: nothing
     was busy, we hung up on it. The tell was a pair of bubbles — an empty one
     from onStart, then the error — which can only happen if the response had
     already arrived.

     So: `connectMs` covers everything up to the response headers, and
     `stallMs` covers SILENCE BETWEEN READS once the stream is open. The
     server also sends a keep-alive comment every few seconds while a
     provider is thinking, so a live-but-slow answer resets this on schedule
     and only a genuinely dead connection ever trips it. */
  let ctrl = null, timer = null;
  const armTo = (ms) => {
    if (!ctrl) return;
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), ms);
  };
  if (!signal) {
    ctrl = new AbortController();
    signal = ctrl.signal;
    armTo(connectMs);
  }
  const arm = () => armTo(stallMs);

  const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    clearTimeout(timer);
    let detail = "";
    try { const j = await res.json(); detail = j?.error || ""; } catch (e) {}
    throw new Error(detail || ("HTTP " + res.status));
  }
  if (onStart) onStart();
  // the connection is up; from here the only thing worth aborting on is silence
  arm();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = "", buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    arm();
    if (onRawChunk) onRawChunk();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt;
      try { evt = JSON.parse(payload); } catch (e) { continue; }
      // Typed error event (new piano-chat contract): abort the stream and let the
      // caller's catch show a friendly message. Also treats legacy `[error: ...]`
      // content chunks the same way — a raw provider 401/429 blob must never
      // reach a chat bubble as visible text.
      if (evt.error) { throw new Error(typeof evt.error === "string" ? evt.error : "AI request failed"); }
      if (evt.content) {
        if (evt.content.startsWith("[error:") || evt.content.startsWith("\n[error:")) {
          throw new Error(evt.content.replace(/^\n?\[error:\s*/, "").trim() || "AI request failed");
        }
        acc += evt.content; if (onChunk) onChunk(acc);
      }
    }
  }
  clearTimeout(timer);
  return acc;
}

// POSTs `body` to the chat backend and awaits the full (non-streaming) JSON
// response. The backend replies with a plain `{text: "..."}` shape when the
// request body sets `stream: false`, and the Anthropic-native
// `{content: [{type:"text",...}]}` blocks shape otherwise - callers that
// never send `stream: false` never see a `data.text` field, so checking it
// first is a no-op for them (falls straight through to the blocks join,
// unchanged). Throws on a non-ok response, preferring the backend's own
// `error.message` when present (richer than a bare status for callers that
// log it) and falling back to "HTTP <status>".
//
// Timeout protection (timeoutMs, default 25s - generous, since the whole
// response has to finish generating server-side before any bytes come
// back at all, unlike the streaming helper above): same opt-out-by-
// supplying-your-own-signal rule as streamChatCompletion. No current
// caller passes one, so every one of them gets this for free.
export async function fetchChatCompletion(body, { signal, timeoutMs = 25000 } = {}) {
  let ctrl = null, timer = null;
  if (!signal && timeoutMs) {
    ctrl = new AbortController();
    signal = ctrl.signal;
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
  }
  const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body), signal });
  if (timer) clearTimeout(timer);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || ("HTTP " + res.status));
  return (typeof data.text === "string" ? data.text : "") || (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}
