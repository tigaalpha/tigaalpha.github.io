import { createClient } from "@supabase/supabase-js";

/* ── Supabase client — Auth (Google/Facebook) + membership profiles ──
   The anon key below is a PUBLIC key — safe to ship in the frontend. */
export const SUPABASE_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXFnYnJhY3hudWNkbXRtY3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTM1MzAsImV4cCI6MjA5NzM4OTUzMH0.vwhXn9usX4YRJdGEL8VU-E86mYfg6mZQbjkernMNXT4";
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
