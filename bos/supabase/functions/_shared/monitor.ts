import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Fire-and-forget system event logging. Never throws — a logging failure
 * must not break the request that triggered it. Called from the catch
 * blocks of AI-backed edge functions so error spikes (e.g. sustained Gemini
 * quota exhaustion) are visible in system_events instead of only showing up
 * as individual failed requests nobody notices until a user complains.
 */
export async function logSystemEvent(
  admin: SupabaseClient,
  source: string,
  severity: "info" | "warning" | "error",
  message: string
): Promise<void> {
  try {
    await admin.from("system_events").insert({ source, severity, message: message.slice(0, 2000) });
  } catch {
    // logging must never throw into the caller's error path
  }
}
