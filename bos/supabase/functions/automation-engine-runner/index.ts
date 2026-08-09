import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { evaluateConditions, type Condition } from "../_shared/automation-conditions.ts";
import { executeAction, type ActionSpec, type ActionContext, type ActionResult } from "../_shared/automation-actions.ts";
import { sumTransactions, computeCashFlowForecast } from "../_shared/business-metrics.ts";

// Heartbeat (pg_cron, every 5 min — see 0054_automation_engine_cron_job.sql):
// 1. drains automation_events (DB-trigger-enqueued: customer_created,
//    sales_status_changed, booking_created, booking_cancelled) against any
//    enabled rule of that trigger_type, in event order, bounded per tick;
// 2. separately scans for the three periodic-condition trigger types
//    (course_ending_soon, course_expired, customer_inactive), which have no
//    discrete "this just became true" row-change to hang a DB trigger off
//    of, applying each rule's own cooldown so the same entity doesn't
//    refire every tick while the condition stays true.
const EVENT_BATCH_LIMIT = 50;

interface RuleRow {
  id: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Condition[];
  actions: ActionSpec[];
}

interface EventRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
}

async function runActionsAndLog(
  admin: SupabaseClient,
  rule: RuleRow,
  eventId: string | null,
  ctx: ActionContext
): Promise<void> {
  const results: ActionResult[] = [];
  const ctxWithRule: ActionContext = { ...ctx, ruleId: rule.id };
  for (const action of rule.actions) {
    results.push(await executeAction(admin, action, ctxWithRule));
  }
  const status = results.length === 0 ? "skipped" : results.every((r) => r.ok) ? "success" : "failed";
  await admin.from("automation_runs").insert({
    rule_id: rule.id,
    event_id: eventId,
    entity_type: ctx.entityType,
    entity_id: ctx.entityId,
    status,
    actions_result: results,
    error: status === "failed" ? results.filter((r) => !r.ok).map((r) => r.detail).join("; ") : null,
    finished_at: new Date().toISOString(),
  });
}

async function processEvents(admin: SupabaseClient, rules: RuleRow[]): Promise<number> {
  const { data: events, error } = await admin
    .from("automation_events")
    .select("id, event_type, entity_type, entity_id, payload")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(EVENT_BATCH_LIMIT);
  if (error) throw error;
  if (!events || events.length === 0) return 0;

  const rulesByTrigger = new Map<string, RuleRow[]>();
  for (const rule of rules) {
    const list = rulesByTrigger.get(rule.trigger_type) ?? [];
    list.push(rule);
    rulesByTrigger.set(rule.trigger_type, list);
  }

  for (const event of events as EventRow[]) {
    const matchingRules = rulesByTrigger.get(event.event_type) ?? [];
    for (const rule of matchingRules) {
      if (!evaluateConditions(rule.conditions, event.payload)) continue;
      const customerId = event.entity_type === "customer" ? event.entity_id : (event.payload.customerId as string | undefined) ?? null;
      await runActionsAndLog(admin, rule, event.id, {
        entityType: event.entity_type,
        entityId: event.entity_id,
        customerId,
        summary: describeEvent(event),
      });
    }
    await admin.from("automation_events").update({ processed: true }).eq("id", event.id);
  }

  return events.length;
}

function describeEvent(event: EventRow): string {
  switch (event.event_type) {
    case "customer_created":
      return `ลูกค้าใหม่: ${event.payload.name ?? "-"}`;
    case "sales_status_changed":
      return `เปลี่ยนสถานะ: ${event.payload.from ?? "-"} → ${event.payload.to ?? "-"}`;
    case "booking_created":
      return `จองคาบเรียนใหม่: ${event.payload.startTime ?? "-"}`;
    case "booking_cancelled":
      return `ยกเลิกคาบเรียน: ${event.payload.startTime ?? "-"}`;
    default:
      return event.event_type;
  }
}

// Has this rule already fired for this entity within its cooldown window?
// Prevents a still-true condition (course still low on hours, customer
// still inactive) from re-firing every 5-minute tick.
async function withinCooldown(admin: SupabaseClient, ruleId: string, entityId: string, cooldownHours: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("rule_id", ruleId)
    .eq("entity_id", entityId)
    .gte("started_at", since);
  if (error) throw error;
  return (count ?? 0) > 0;
}

const RENEWAL_ALREADY_HANDLED_STATUSES = ["renew_pending", "renewed", "lost"];

async function processCourseThresholdRule(admin: SupabaseClient, rule: RuleRow): Promise<void> {
  const thresholdHours = Number(rule.trigger_config.thresholdHours ?? 2);
  const cooldownHours = Number(rule.trigger_config.cooldownHours ?? 72);

  const query = admin.from("courses").select("id, remaining_hour, total_hours, customer_id, customers(name, sales_status)");
  const { data: courses, error } =
    rule.trigger_type === "course_expired" ? await query.eq("remaining_hour", 0) : await query.gt("remaining_hour", 0).lte("remaining_hour", thresholdHours);
  if (error) throw error;

  for (const course of courses ?? []) {
    if (await withinCooldown(admin, rule.id, course.id, cooldownHours)) continue;
    if (!evaluateConditions(rule.conditions, { remainingHour: course.remaining_hour, totalHours: course.total_hours })) continue;

    const customer = (course as { customers?: { name?: string; sales_status?: string } | null }).customers;
    // Already being handled (a renewal conversation is underway) or
    // already resolved -- another reminder would just be noise.
    if (customer?.sales_status && RENEWAL_ALREADY_HANDLED_STATUSES.includes(customer.sales_status)) continue;

    // A previous reminder from this same rule is still open -- don't
    // stack a duplicate on top of it just because the cooldown window
    // (which only prevents re-firing for this *course*, not this
    // *customer's outstanding task*) has passed.
    const { count: openTaskCount } = await admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", course.customer_id)
      .eq("automation_rule_id", rule.id)
      .eq("status", "open");
    if ((openTaskCount ?? 0) > 0) continue;

    const customerName = customer?.name ?? "-";
    await runActionsAndLog(admin, rule, null, {
      entityType: "course",
      entityId: course.id,
      customerId: course.customer_id,
      summary: `คอร์สของ ${customerName} เหลือ ${course.remaining_hour} ชั่วโมง`,
    });
  }
}

async function processInactiveCustomerRule(admin: SupabaseClient, rule: RuleRow): Promise<void> {
  const days = Number(rule.trigger_config.days ?? 30);
  const cooldownHours = Number(rule.trigger_config.cooldownHours ?? 168);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const { data: customers, error } = await admin
    .from("customers")
    .select("id, name, last_contact_at, created_at, sales_status")
    .not("sales_status", "in", "(won,lost)");
  if (error) throw error;

  for (const customer of customers ?? []) {
    const lastActivity = new Date(customer.last_contact_at ?? customer.created_at).getTime();
    if (lastActivity >= cutoff) continue;
    if (await withinCooldown(admin, rule.id, customer.id, cooldownHours)) continue;
    if (!evaluateConditions(rule.conditions, { salesStatus: customer.sales_status })) continue;

    await runActionsAndLog(admin, rule, null, {
      entityType: "customer",
      entityId: customer.id,
      customerId: customer.id,
      summary: `ลูกค้า ${customer.name} ไม่มีความเคลื่อนไหวเกิน ${days} วัน`,
    });
  }
}

// Reminds a customer a few hours before their lesson (distinct from the
// existing "lessons today" daily digest, which is an internal owner-facing
// summary, not a customer-facing heads-up). Cooldown-based dedup (same
// mechanism as course_ending_soon/customer_inactive) is what keeps this
// from re-firing every 5-minute tick for the same booking while it stays
// inside the reminder window.
async function processBookingReminderRule(admin: SupabaseClient, rule: RuleRow): Promise<void> {
  const hoursBefore = Number(rule.trigger_config.hoursBefore ?? 3);
  const cooldownHours = Number(rule.trigger_config.cooldownHours ?? 24);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

  const { data: bookings, error } = await admin
    .from("bookings")
    .select("id, title, start_time, customer_id, customers(name, line_user_id)")
    .neq("status", "cancelled")
    .gte("start_time", now.toISOString())
    .lte("start_time", windowEnd.toISOString());
  if (error) throw error;

  for (const booking of bookings ?? []) {
    if (await withinCooldown(admin, rule.id, booking.id, cooldownHours)) continue;
    if (!evaluateConditions(rule.conditions, {})) continue;

    const customerName = (booking as { customers?: { name?: string } | null }).customers?.name ?? "-";
    const timeStr = new Date(booking.start_time).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

    await runActionsAndLog(admin, rule, null, {
      entityType: "booking",
      entityId: booking.id,
      customerId: booking.customer_id,
      summary: `อีกไม่กี่ชั่วโมงถึงเวลาคาบเรียน "${booking.title}" ของ ${customerName} เวลา ${timeStr} — อย่าลืมมาเรียนนะครับ/คะ`,
    });
  }
}

// Compares net revenue (income - expense) over the trailing 7 days
// against the 7 days before that. entityId is today's date so this fires
// at most once/day (there's no per-row entity for a company-wide KPI).
async function processRevenueDropRule(admin: SupabaseClient, rule: RuleRow): Promise<void> {
  const thresholdPercent = Number(rule.trigger_config.thresholdPercent ?? 20);
  const cooldownHours = Number(rule.trigger_config.cooldownHours ?? 24);
  const todayKey = new Date().toISOString().slice(0, 10);

  if (await withinCooldown(admin, rule.id, todayKey, cooldownHours)) return;

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: transactions, error } = await admin.from("transactions").select("type, amount, transaction_date").gte("transaction_date", fourteenDaysAgo);
  if (error) throw error;

  const recentRows = (transactions ?? []).filter((t) => t.transaction_date >= sevenDaysAgo);
  const priorRows = (transactions ?? []).filter((t) => t.transaction_date < sevenDaysAgo);
  const netRecentWeek = sumTransactions(recentRows).profit;
  const netPriorWeek = sumTransactions(priorRows).profit;

  if (netPriorWeek <= 0) return;
  const dropPercent = ((netPriorWeek - netRecentWeek) / netPriorWeek) * 100;
  if (dropPercent < thresholdPercent) return;
  if (!evaluateConditions(rule.conditions, { dropPercent })) return;

  await runActionsAndLog(admin, rule, null, {
    entityType: "kpi",
    entityId: todayKey,
    customerId: null,
    summary: `รายได้สุทธิ 7 วันล่าสุด ${netRecentWeek.toLocaleString("th-TH")} บาท ลดลง ${dropPercent.toFixed(0)}% จาก 7 วันก่อนหน้า (${netPriorWeek.toLocaleString("th-TH")} บาท)`,
  });
}

// Same trend comparison as computeCashFlowForecast already uses for the
// CEO Agent's Finance Agent (Wave 1) -- fires only when confidence is
// "high" (never alert off thin data) and the trend is actually negative
// on average, not just decelerating growth.
async function processCashFlowRiskRule(admin: SupabaseClient, rule: RuleRow): Promise<void> {
  const cooldownHours = Number(rule.trigger_config.cooldownHours ?? 24);
  const todayKey = new Date().toISOString().slice(0, 10);

  if (await withinCooldown(admin, rule.id, todayKey, cooldownHours)) return;

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const { data: transactions, error } = await admin.from("transactions").select("type, amount, transaction_date").gte("transaction_date", ninetyDaysAgo.toISOString().slice(0, 10));
  if (error) throw error;

  const fortyFiveDaysAgoStr = fortyFiveDaysAgo.toISOString().slice(0, 10);
  const recentRows = (transactions ?? []).filter((t) => t.transaction_date >= fortyFiveDaysAgoStr);
  const olderRows = (transactions ?? []).filter((t) => t.transaction_date < fortyFiveDaysAgoStr);

  const forecast = computeCashFlowForecast(recentRows, olderRows, 45);
  if (forecast.confidence !== "high") return;
  if (forecast.trend !== "down") return;
  if (forecast.avgDailyNet >= 0) return;
  if (!evaluateConditions(rule.conditions, { avgDailyNet: forecast.avgDailyNet, trend: forecast.trend })) return;

  await runActionsAndLog(admin, rule, null, {
    entityType: "kpi",
    entityId: todayKey,
    customerId: null,
    summary: `แนวโน้มกระแสเงินสดกำลังลดลง — ขาดทุนสุทธิเฉลี่ย ${Math.abs(forecast.avgDailyNet).toLocaleString("th-TH")} บาท/วัน ในช่วง 45 วันล่าสุด`,
  });
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  // Guards against the same automation_events row or the same rule's
  // cooldown check being processed twice if this tick overlaps a still-
  // running previous invocation (both are read-then-later-write, not
  // atomic) -- one lock at the top covers every rule processor instead of
  // adding per-processor locking. Never held past this request/response.
  const { data: lockAcquired } = await admin.rpc("try_lock_automation_engine");
  if (!lockAcquired) {
    return jsonResponse({ skipped: true, reason: "a previous run is still in progress" });
  }

  try {
    const { data: rules, error: rulesErr } = await admin
      .from("automation_rules")
      .select("id, trigger_type, trigger_config, conditions, actions")
      .eq("enabled", true);
    if (rulesErr) throw rulesErr;
    const enabledRules = (rules ?? []) as RuleRow[];

    const eventsProcessed = await processEvents(admin, enabledRules);

    for (const rule of enabledRules.filter((r) => r.trigger_type === "course_ending_soon" || r.trigger_type === "course_expired")) {
      await processCourseThresholdRule(admin, rule);
    }
    for (const rule of enabledRules.filter((r) => r.trigger_type === "customer_inactive")) {
      await processInactiveCustomerRule(admin, rule);
    }
    for (const rule of enabledRules.filter((r) => r.trigger_type === "booking_starting_soon")) {
      await processBookingReminderRule(admin, rule);
    }
    for (const rule of enabledRules.filter((r) => r.trigger_type === "revenue_drop")) {
      await processRevenueDropRule(admin, rule);
    }
    for (const rule of enabledRules.filter((r) => r.trigger_type === "cash_flow_risk")) {
      await processCashFlowRiskRule(admin, rule);
    }

    return jsonResponse({ eventsProcessed, activeRules: enabledRules.length });
  } catch (error) {
    return await handleUnexpectedError(admin, "automation-engine-runner", error);
  } finally {
    await admin.rpc("unlock_automation_engine");
  }
});
