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

// Anything not in the auto list requires approval — safe default.
export function classifyAgentAction(type: AgentActionType): "auto" | "approval" {
  return AUTO_EXECUTE_ACTION_TYPES.includes(type) ? "auto" : "approval";
}

export function isAgentActionType(value: unknown): value is AgentActionType {
  return typeof value === "string" && (AGENT_ACTION_TYPES as readonly string[]).includes(value);
}
