import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

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

/**
 * Standard catch-all for an edge function's outer try/catch: logs the real
 * error server-side (visible on the System Health page) but only ever
 * returns a generic message to the caller. Postgres constraint/column names
 * and raw vendor API response bodies must not reach the client -- use a
 * specific, intentional jsonResponse() instead of this helper for errors
 * that are meant to be shown as-is (e.g. RateLimitError, a validation 400).
 */
export async function handleUnexpectedError(admin: SupabaseClient, source: string, error: unknown): Promise<Response> {
  const message = error instanceof Error ? error.message : "Unknown error";
  await logSystemEvent(admin, source, "error", message);
  return jsonResponse({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง หากยังไม่หายให้แจ้งผู้ดูแลระบบ" }, 500);
}
