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
