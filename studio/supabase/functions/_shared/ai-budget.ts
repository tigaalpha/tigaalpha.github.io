// Daily AI cost guard (feature #13) — the owner sets a daily token budget in
// integration_settings key `ai_budget_daily_tokens` (0/empty = unlimited).
// chat-core checks this before every generation; when exceeded, the AI stops
// answering customers and the owner is notified once per day instead of the
// studio silently racking up API spend.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const AI_BUDGET_REPLY =
  "ขอโทษค่ะ ระบบ AI ถึงวงเงินใช้งานของวันนี้แล้ว เจ้าของร้านกำลังตรวจสอบอยู่ รบกวนลองทักใหม่ในวันพรุ่งนี้ หรือติดต่อเจ้าของร้านโดยตรงนะคะ 😊";

export async function checkAiBudgetExceeded(admin: SupabaseClient): Promise<boolean> {
  const { data: cfg } = await admin.from("integration_settings").select("value").eq("key", "ai_budget_daily_tokens").maybeSingle();
  const budget = Number(cfg?.value ?? 0);
  if (!Number.isFinite(budget) || budget <= 0) return false;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await admin.from("ai_usage_log").select("prompt_tokens, completion_tokens").gte("created_at", start.toISOString());
  const used = (data ?? []).reduce((sum, row) => sum + (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0), 0);
  return used >= budget;
}
