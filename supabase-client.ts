import { createClient } from "@supabase/supabase-js";

/* ── Supabase client — Auth (Google/Facebook) + membership profiles ──
   The anon key below is a PUBLIC key — safe to ship in the frontend. */
export const SUPABASE_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXFnYnJhY3hudWNkbXRtY3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTM1MzAsImV4cCI6MjA5NzM4OTUzMH0.vwhXn9usX4YRJdGEL8VU-E86mYfg6mZQbjkernMNXT4";
// flowType: "pkce" is required for native-auth.ts's redirect handler, which reads
// the OAuth result as a ?code= query param (exchangeCodeForSession) — the default
// "implicit" flow returns #access_token=... in the URL fragment instead, which that
// handler never looks at, so sign-in would silently never complete on native. Safe
// for the web sign-in path too: detectSessionInUrl (on by default) auto-completes
// either flow the same way on page load, no separate code needed there.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: "pkce" },
});
