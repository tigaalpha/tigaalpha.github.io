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
import { isDormant, overdueStage, isStaleLead, isContentDrought } from "./agent-guardian-conditions.ts";

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

  // ── Guardian Agents (งาน #2): เฝ้าธุรกิจแทนเจ้าของ ───────────────────────
  // ลูกค้าเงียบ, ค้างชำระ (ขั้นบันได 3/7/14 วัน), lead ค้าง, content แล้ง

  const dormantStart = new Date(now - 30 * dayMs).toISOString();
  const { data: recentBookings } = await admin.from("bookings").select("customer_id").gte("start_time", dormantStart);
  const activeCustomerIds = new Set((recentBookings ?? []).map((b) => b.customer_id as string));
  const { data: wonCustomers } = await admin
    .from("customers")
    .select("id, name, last_contact_at")
    .in("sales_status", ["won", "renewed"]);
  const dormantCount = (wonCustomers ?? []).filter((c) => !activeCustomerIds.has(c.id)).length;
  const firedDormant = await hasFiredRecently(admin, "customer_dormant");
  if (!firedDormant && dormantCount >= 1) {
    fired.push({
      triggerType: "customer_dormant",
      goal: `${dormantCount} ลูกค้าปัจจุบัน (won/renewed) ไม่มีคาบเรียนเลยเกิน 30 วัน — วิเคราะห์ว่าใครควรได้รับ win-back/touch base และเรียงลำดับตามมูลค่า`,
      detail: `dormant=${dormantCount}`,
    });
  }

  const overdue = (await admin.from("payments").select("id, created_at").eq("status", "pending")) ?? { data: [] };
  let maxOverdueStage: 1 | 2 | 3 | null = null;
  let overdueCount = 0;
  for (const p of (overdue as { data: { id: string; created_at: string }[] }).data ?? []) {
    const days = Math.floor((now - new Date(p.created_at).getTime()) / dayMs);
    const stage = overdueStage(days);
    if (stage !== null) {
      overdueCount += 1;
      if (maxOverdueStage === null || stage > maxOverdueStage) maxOverdueStage = stage;
    }
  }
  const stageLabels: Record<number, string> = { 1: "เกิน 3 วัน", 2: "เกิน 7 วัน", 3: "เกิน 14 วัน (เร่งด่วน)" };
  const firedOverdue = await hasFiredRecently(admin, "payment_overdue");
  if (!firedOverdue && maxOverdueStage !== null) {
    fired.push({
      triggerType: "payment_overdue",
      goal: `มี ${overdueCount} ใบแจ้งชำระค้าง (เก่าที่สุด ${stageLabels[maxOverdueStage]}) — เรียงลำดับการทวงตามขั้นบันได: นัดแรกแบบสุภาพ ครั้งถัดไปจริงจังขึ้น และแนะนำท่าทีที่เหมาะสมรายลูกค้า`,
      detail: `overdue=${overdueCount} maxStage=${maxOverdueStage}`,
    });
  }

  const staleStart = new Date(now - 7 * dayMs).toISOString();
  const { data: staleLeads } = await admin
    .from("customers")
    .select("id, last_contact_at, created_at")
    .in("sales_status", ["new_lead", "contacted", "qualified", "interested", "trial_booked", "trial_completed", "negotiating", "waiting_decision"]);
  const staleCount = (staleLeads ?? []).filter((c) =>
    isStaleLead(c.last_contact_at ? new Date(c.last_contact_at).getTime() : null, c.created_at ? new Date(c.created_at).getTime() : null, now)
  ).length;
  const firedStale = await hasFiredRecently(admin, "stale_lead");
  if (!firedStale && staleCount >= 1) {
    fired.push({
      triggerType: "stale_lead",
      goal: `${staleCount} lead ค้างไม่มีการติดต่อเกิน 7 วัน — เสนอข้อความติดตามที่เหมาะสมรายคน (อ้างอิงช่วงที่คุยค้างไว้) เพื่อไม่ให้หลุด pipeline`,
      detail: `stale=${staleCount}`,
    });
  }

  const { count: publishedLast7 } = await admin
    .from("content_calendar")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .gte("created_at", new Date(now - 7 * dayMs).toISOString());
  const firedDrought = await hasFiredRecently(admin, "content_drought");
  if (!firedDrought && isContentDrought(publishedLast7 ?? 0)) {
    fired.push({
      triggerType: "content_drought",
      goal: "ยังไม่มีคอนเทนต์ที่เผยแพร่เลยใน 7 วัน — วางแผนคอนเทนต์ 3-5 ชิ้นสำหรับสัปดาห์หน้า (โพสต์/วิดีโอ/บทความ) ตามสิ่งที่เคยได้ผล" ,
      detail: `published7d=${publishedLast7 ?? 0}`,
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
