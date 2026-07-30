import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export class RateLimitError extends Error {}

/**
 * Atomically increments and checks a per-user, per-endpoint fixed-window
 * counter (see migration 0024_ai_rate_limits — the increment+check happens
 * in one SQL statement server-side, so concurrent requests from the same
 * user can't race past the limit). Throws RateLimitError, which every
 * caller below turns into a clean 429, once the window's count exceeds
 * maxRequests.
 */
export async function enforceRateLimit(
  admin: SupabaseClient,
  userId: string,
  bucket: string,
  opts: { windowMinutes: number; maxRequests: number }
): Promise<void> {
  const { data, error } = await admin.rpc("increment_rate_limit", {
    p_user_id: userId,
    p_bucket: bucket,
    p_window_minutes: opts.windowMinutes,
  });
  if (error) throw error;
  if ((data as number) > opts.maxRequests) {
    throw new RateLimitError(
      `คำขอถี่เกินไป กรุณาลองใหม่ในอีกสักครู่ (จำกัด ${opts.maxRequests} ครั้งต่อ ${opts.windowMinutes} นาที)`
    );
  }
}
