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
   The 5 call sites (chat's callClaude, voice-tutor's vmFetchAI, play-along's
   styleTransform/fetchSongAnalysis, camera-coach's analyzeHands) each used to
   hand-roll their own fetch+response-handling against API_URL. Two shapes
   cover all 5: streamChatCompletion (SSE, `data: {"content":"..."}` lines)
   for the 3 that stream, fetchChatCompletion (plain JSON) for the 2 that
   don't. Callers still build their own request body (the shape differs -
   {message,conversationHistory,system} for 4 of them, a raw {model,
   max_tokens,system,messages} Anthropic-style body with an image block for
   analyzeHands) and still own their own response parsing (incremental UI
   flush, sentence-boundary TTS segmentation, JSON-blob extraction, etc.) -
   only the fetch/stream-read/error-shape boilerplate is shared. */

// POSTs `body` to the chat backend and streams the SSE response, calling
// onStart() once the response is confirmed ok (before any bytes are read -
// callers that need to swap a "thinking" indicator for a live bubble at
// exactly this moment use it) and onChunk(accumulatedTextSoFar) each time
// new content arrives. onRawChunk() fires on every stream read, including
// ones with no parseable content - callers doing their own stall-watchdog
// (vmFetchAI) reset their timer here rather than only on content chunks, to
// exactly match the original per-hook implementation this replaces. Returns
// the final accumulated text; throws on a non-ok/bodyless response.
export async function streamChatCompletion(body, { onStart, onChunk, onRawChunk, signal } = {}) {
  const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    let detail = "";
    try { const j = await res.json(); detail = j?.error || ""; } catch (e) {}
    throw new Error(detail || ("HTTP " + res.status));
  }
  if (onStart) onStart();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = "", buffer = "";
  while (true) {
    const { done, value } = await reader.read();
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
      if (evt.content) { acc += evt.content; if (onChunk) onChunk(acc); }
    }
  }
  return acc;
}

// POSTs `body` to the chat backend and awaits the full (non-streaming) JSON
// response, returning the joined text of every `type: "text"` content
// block. Throws on a non-ok response (checked after parsing, matching the
// stricter of the two original call sites this replaces).
export async function fetchChatCompletion(body) {
  const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error("HTTP " + res.status);
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}
