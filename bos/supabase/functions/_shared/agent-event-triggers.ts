// Event-driven CEO Agent runs (automation beyond the clock): the hourly
// agent-event-triggers cron calls checkEventTriggers, which fires a CEO
// workflow when a business event is detected (won-sales dropped sharply,
// no new won customer in a week) — instead of only running on a schedule
// or when the owner asks. Dedupe via agent_event_trigger_log so a
// sustained condition doesn't spawn a new workflow every hour.
//
// The pure condition math lives in agent-event-conditions.ts (unit-tested);
// this file is the DB-facing orchestration.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runWorkflow } from "./agent-orchestrator.ts";
import { checkAiBudgetExceeded } from "./ai-budget.ts";
import { logSystemEvent } from "./monitor.ts";
import { salesDropRatio, shouldTriggerSalesDrop, shouldTriggerNoNewWon } from "./agent-event-conditions.ts";

const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // don't re-trigger same event within a week

async function countWonSince(admin: SupabaseClient, since: string, before?: string): Promise<number> {
  let query = admin.from("sales_status_history").select("customer_id", { count: "exact", head: true }).eq("to_status", "won").gte("created_at", since);
  if (before) query = query.lt("created_at", before);
  const { count } = await query;
  return count ?? 0;
}

async function hasFiredRecently(admin: SupabaseClient, triggerType: string): Promise<boolean> {
  const { data } = await admin
    .from("agent_event_trigger_log")
    .select("id")
    .eq("trigger_type", triggerType)
    .gte("triggered_at", new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString())
    .limit(1);
  return (data ?? []).length > 0;
}

export interface FiredTrigger {
  triggerType: string;
  goal: string;
  detail: string;
}

export async function checkEventTriggers(admin: SupabaseClient): Promise<FiredTrigger[]> {
  const fired: FiredTrigger[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const recentStart = new Date(now - 14 * dayMs).toISOString();
  const previousStart = new Date(now - 28 * dayMs).toISOString();
  const [recentWon, previousWon] = await Promise.all([countWonSince(admin, recentStart), countWonSince(admin, previousStart, recentStart)]);

  const firedSales = await hasFiredRecently(admin, "sales_drop");
  if (!firedSales && shouldTriggerSalesDrop(recentWon, previousWon)) {
    const ratio = salesDropRatio(recentWon, previousWon) ?? 0;
    fired.push({
      triggerType: "sales_drop",
      goal: `ยอดปิดการขายลดลง ${Math.round(ratio * 100)}% (14 วันล่าสุด ${recentWon} ราย เทียบกับ 14 วันก่อนหน้า ${previousWon} ราย) — หาสาเหตุและแนะนำการแก้ไขเร่งด่วน`,
      detail: `recent=${recentWon} previous=${previousWon}`,
    });
  }

  const last7Start = new Date(now - 7 * dayMs).toISOString();
  const priorWindowStart = new Date(now - 21 * dayMs).toISOString();
  const [wonLast7, wonPrior] = await Promise.all([countWonSince(admin, last7Start), countWonSince(admin, priorWindowStart, last7Start)]);

  const firedNoWon = await hasFiredRecently(admin, "no_new_won");
  if (!firedNoWon && shouldTriggerNoNewWon(wonLast7, wonPrior)) {
    fired.push({
      triggerType: "no_new_won",
      goal: "ยังไม่มีลูกค้าใหม่ที่ปิดการขายได้เลยใน 7 วัน (ก่อนหน้านี้ 14 วันมียอดปิดอยู่) — วิเคราะห์ว่าวงจรการขายติดขัดตรงไหนและแนะนำการเร่งปิด",
      detail: `wonLast7=${wonLast7} wonPrior14=${wonPrior}`,
    });
  }

  if (fired.length === 0) return fired;

  // If the daily AI budget is already spent, don't burn more tokens on a
  // report the owner can't act on until tomorrow — log and skip.
  const budgetExceeded = await checkAiBudgetExceeded(admin);
  if (budgetExceeded) {
    await logSystemEvent(admin, "agent-event-triggers", "warning", "Event detected but skipped: AI daily budget exceeded");
    return fired;
  }

  for (const trigger of fired) {
    try {
      const workflowId = await runWorkflow(admin, trigger.goal, null);
      await admin.from("agent_event_trigger_log").insert({
        trigger_type: trigger.triggerType,
        detail: trigger.detail,
        workflow_run_id: workflowId,
      });
    } catch (error) {
      await logSystemEvent(admin, "agent-event-triggers", "error", `${trigger.triggerType}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return fired;
}
