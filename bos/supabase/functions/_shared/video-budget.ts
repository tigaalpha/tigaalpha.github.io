// Daily video-generation budget (cost control): Veo/Seedance/etc. clips are
// by far the most expensive AI call in the app, so the owner can cap how
// many clips get generated per day via integration_settings key
// `ai_video_daily_limit` (0/empty = unlimited). Checked before any clip is
// kicked off — a batch request for N clips needs N remaining slots.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const VIDEO_DAILY_LIMIT_SETTING_KEY = "ai_video_daily_limit";

export interface VideoBudgetCheck {
  allowed: boolean;
  remaining: number | null;
  message?: string;
}

export async function checkVideoDailyBudget(admin: SupabaseClient, requestedCount = 1): Promise<VideoBudgetCheck> {
  const { data: cfg } = await admin.from("integration_settings").select("value").eq("key", VIDEO_DAILY_LIMIT_SETTING_KEY).maybeSingle();
  const limit = Number(cfg?.value ?? 0);
  if (!Number.isFinite(limit) || limit <= 0) return { allowed: true, remaining: null };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await admin
    .from("video_clips")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString())
    .not("status", "eq", "error");
  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);
  if (remaining < requestedCount) {
    return {
      allowed: false,
      remaining,
      message: `ถึงวงเงินสร้างวิดีโอของวันนี้แล้ว (${limit} คลิป/วัน ใช้ไป ${used}) — เพิ่มค่า ai_video_daily_limit ใน Settings หรือรอวันพรุ่งนี้`,
    };
  }
  return { allowed: true, remaining };
}
