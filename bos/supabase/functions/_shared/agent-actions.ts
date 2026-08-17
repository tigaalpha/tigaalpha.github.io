// CEO Agent recommended actions -> executable actions. This file is the
// pure classification layer (deliberately free of any supabase/Deno import
// so vitest can import it directly, same convention as lead-score.ts /
// promptpay.ts); the DB-facing executor lives in agent-actions-db.ts.
//
// Low-risk internal types (create a task, show an in-app notification) run
// automatically; anything customer- or money-facing (send LINE, create a
// recurring schedule) waits for the owner's explicit approval.

export type AgentActionType =
  | "create_task"
  | "send_notification"
  | "send_line"
  | "create_schedule"
  | "draft_content"
  | "update_customer"
  | "send_email";

export interface RecommendedAction {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  action?: { type: AgentActionType; payload: Record<string, unknown> };
}

export const AUTO_EXECUTE_ACTION_TYPES: readonly AgentActionType[] = ["create_task", "send_notification", "draft_content"];

export const AGENT_ACTION_TYPE_LABELS: Record<AgentActionType, string> = {
  create_task: "สร้างงานในระบบ",
  send_notification: "แจ้งเตือนในระบบ",
  send_line: "ส่งข้อความ LINE",
  create_schedule: "สร้างกำหนดการอัตโนมัติ",
  draft_content: "ร่างคอนเทนต์เข้าปฏิทิน",
  update_customer: "อัปเดตข้อมูลลูกค้า",
  send_email: "ส่งอีเมล",
};

export const AGENT_ACTION_TYPES: readonly AgentActionType[] = [
  "create_task",
  "send_notification",
  "send_line",
  "create_schedule",
  "draft_content",
  "update_customer",
  "send_email",
];

// Anything not in the base auto list requires approval — safe default.
export function classifyAgentAction(type: AgentActionType): "auto" | "approval" {
  return AUTO_EXECUTE_ACTION_TYPES.includes(type) ? "auto" : "approval";
}

export function isAgentActionType(value: unknown): value is AgentActionType {
  return typeof value === "string" && (AGENT_ACTION_TYPES as readonly string[]).includes(value);
}

// ── Autonomy tiers (งาน #1: "AI ทำแล้วค่อยรายงาน" อย่างปลอดภัย) ──────────────
// Owner-controlled via integration_settings key `agent_autonomy_level`
// (Settings UI: หน้า AI Company). The tier decides which customer- or
// money-facing action types MAY auto-execute; the DB layer still enforces
// hard runtime guards on top (daily caps, business hours, lead score) so
// a "high" tier can never spam customers or act outside business hours.
//
//   conservative (default): only the base internal types auto-run — the
//     exact behaviour before this feature.
//   balanced: send_email to customers with an address on file, and
//     update_customer for notes-only changes (never sales status).
//   high: also send_line to hot leads (customerId/lineUserId required; DB
//     layer additionally requires lead_score >= 80 + business hours +
//     daily cap), and update_customer may change sales status.

export type AutonomyLevel = "conservative" | "balanced" | "high";

export const AUTONOMY_LEVELS: readonly AutonomyLevel[] = ["conservative", "balanced", "high"];

export const AUTONOMY_LEVEL_LABELS: Record<AutonomyLevel, string> = {
  conservative: "อนุรักษ์นิยม (ค่าเริ่มต้น) — AI ทำได้แค่งานในระบบ",
  balanced: "สมดุล — +ส่งอีเมลลูกค้าที่มีอีเมล, อัปเดตโน้ตลูกค้า",
  high: "สูง — +ส่ง LINE ถึง lead ร้อน (คะแนนสูง) ในเวลาทำการ",
};

export function isAutonomyLevel(value: unknown): value is AutonomyLevel {
  return typeof value === "string" && (AUTONOMY_LEVELS as readonly string[]).includes(value);
}

/**
 * Payload-level rule: may this action type auto-execute under this tier?
 * Pure — DB lookups (lead score, daily caps, business hours) are enforced
 * by the caller in agent-actions-db.ts, so tests stay fast and honest.
 */
export function canAutoExecuteAgentAction(type: AgentActionType, level: AutonomyLevel, payload: Record<string, unknown>): boolean {
  if (classifyAgentAction(type) === "auto") return true; // base internal types always run
  if (level === "conservative") return false;

  switch (type) {
    case "send_email": {
      if (level === "balanced" || level === "high") {
        const hasRecipient = typeof payload.email === "string" && payload.email.trim().length > 0;
        const hasCustomer = typeof payload.customerId === "string" && payload.customerId.trim().length > 0;
        return hasRecipient || hasCustomer;
      }
      return false;
    }
    case "update_customer": {
      const changesSalesStatus = typeof payload.salesStatus === "string" && payload.salesStatus.trim().length > 0;
      if (changesSalesStatus) return level === "high";
      return level === "balanced" || level === "high"; // notes-only updates
    }
    case "send_line": {
      if (level === "high") {
        const hasCustomer = typeof payload.customerId === "string" && payload.customerId.trim().length > 0;
        const hasLineUser = typeof payload.lineUserId === "string" && payload.lineUserId.trim().length > 0;
        return hasCustomer || hasLineUser;
      }
      return false;
    }
    default:
      return false;
  }
}
