import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import * as line from "./line.ts";
import { draftSalesFollowup } from "./ai-reports.ts";

// Fixed, safe action registry -- deliberately NOT a generic arbitrary-code
// executor. Each action reuses an existing side-effect path where one
// already exists (LINE push via _shared/line.ts, notification/sales-status
// writes matching the patterns already used elsewhere in this codebase)
// rather than duplicating that logic.

export interface ActionSpec {
  type: string;
  config: Record<string, unknown>;
}

export interface ActionContext {
  entityType: string;
  entityId: string;
  customerId: string | null;
  summary: string;
  ruleId?: string;
}

export interface ActionResult {
  type: string;
  ok: boolean;
  detail?: string;
}

export async function executeAction(db: SupabaseClient, action: ActionSpec, ctx: ActionContext): Promise<ActionResult> {
  switch (action.type) {
    case "notify_owner":
      return notifyOwner(db, action, ctx);
    case "send_line_message":
      return sendLineMessage(db, action, ctx);
    case "create_task":
      return createTask(db, action, ctx);
    case "change_sales_status":
      return changeSalesStatus(db, action, ctx);
    case "draft_followup_message":
      return draftFollowupMessage(db, action, ctx);
    default:
      return { type: action.type, ok: false, detail: `Unknown action type: ${action.type}` };
  }
}

async function notifyOwner(db: SupabaseClient, action: ActionSpec, ctx: ActionContext): Promise<ActionResult> {
  const { error } = await db.from("notifications").insert({
    type: "automation",
    title: String(action.config.title ?? "Automation"),
    body: ctx.summary,
    customer_id: ctx.customerId,
  });
  if (error) return { type: action.type, ok: false, detail: error.message };
  return { type: action.type, ok: true };
}

async function sendLineMessage(db: SupabaseClient, action: ActionSpec, ctx: ActionContext): Promise<ActionResult> {
  if (!ctx.customerId) return { type: action.type, ok: false, detail: "No customer on this event" };

  const { data: customer, error } = await db.from("customers").select("line_user_id").eq("id", ctx.customerId).maybeSingle();
  if (error) return { type: action.type, ok: false, detail: error.message };
  // LINE can only push to a user who has already added the OA as a friend
  // (opened a chat at least once) -- a lead with no line_user_id yet can't
  // be proactively messaged this way, so this action is skipped, not
  // treated as a failure, for that customer.
  if (!customer?.line_user_id) return { type: action.type, ok: false, detail: "Customer has no LINE connection yet" };

  const message = String(action.config.message ?? ctx.summary);
  try {
    await line.push(customer.line_user_id, message);
    return { type: action.type, ok: true };
  } catch (err) {
    return { type: action.type, ok: false, detail: err instanceof Error ? err.message : "LINE push failed" };
  }
}

async function createTask(db: SupabaseClient, action: ActionSpec, ctx: ActionContext): Promise<ActionResult> {
  const dueInDays = Number(action.config.dueInDays ?? 3);
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + (Number.isFinite(dueInDays) ? dueInDays : 3));

  const priority = String(action.config.priority ?? "medium");
  const { error } = await db.from("tasks").insert({
    title: String(action.config.title ?? "Follow up"),
    description: ctx.summary,
    priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
    due_at: dueAt.toISOString(),
    customer_id: ctx.customerId,
    automation_rule_id: ctx.ruleId ?? null,
    status: "open",
  });
  if (error) return { type: action.type, ok: false, detail: error.message };
  return { type: action.type, ok: true };
}

// Never sends anything itself -- has the AI draft a personalized message
// (_shared/ai-reports.ts:draftSalesFollowup) and files it as a pending
// ai_drafted_message approval request instead, so a human reviews/edits
// it before it ever reaches a customer (see approvals/index.ts).
async function draftFollowupMessage(db: SupabaseClient, _action: ActionSpec, ctx: ActionContext): Promise<ActionResult> {
  if (!ctx.customerId) return { type: "draft_followup_message", ok: false, detail: "No customer on this event" };

  try {
    await draftSalesFollowup(db, ctx.customerId);
    return { type: "draft_followup_message", ok: true };
  } catch (err) {
    return { type: "draft_followup_message", ok: false, detail: err instanceof Error ? err.message : "Failed to draft follow-up message" };
  }
}

async function changeSalesStatus(db: SupabaseClient, action: ActionSpec, ctx: ActionContext): Promise<ActionResult> {
  if (!ctx.customerId) return { type: action.type, ok: false, detail: "No customer on this event" };

  const status = String(action.config.status ?? "");
  const { data: customer, error: fetchErr } = await db.from("customers").select("sales_status").eq("id", ctx.customerId).maybeSingle();
  if (fetchErr) return { type: action.type, ok: false, detail: fetchErr.message };
  if (!customer) return { type: action.type, ok: false, detail: "Customer not found" };

  const { error: historyErr } = await db
    .from("sales_status_history")
    .insert({ customer_id: ctx.customerId, from_status: customer.sales_status, to_status: status, note: "Automation rule" });
  if (historyErr) return { type: action.type, ok: false, detail: historyErr.message };

  const { error: updateErr } = await db.from("customers").update({ sales_status: status }).eq("id", ctx.customerId);
  if (updateErr) return { type: action.type, ok: false, detail: updateErr.message };
  return { type: action.type, ok: true };
}
