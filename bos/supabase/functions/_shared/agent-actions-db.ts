// DB-facing half of agent-actions: executes an approved/auto action against
// real tables and registers a workflow's recommendations as agent_actions
// rows. Kept separate from agent-actions.ts (pure, unit-tested) because
// this file needs the supabase client, the LINE pusher, and schedule math —
// which the test-visible pure file must stay free of.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import * as line from "./line.ts";
import { computeNextRun } from "./schedule.ts";
import type { AgentActionType, RecommendedAction } from "./agent-actions.ts";
import { classifyAgentAction } from "./agent-actions.ts";

function str(payload: Record<string, unknown>, key: string, fallback = ""): string {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export interface AgentActionResult {
  ok: boolean;
  message: string;
}

// Execute one approved/auto action. Returns a short Thai result string that
// lands in agent_actions.result and the report UI.
export async function executeAgentAction(admin: SupabaseClient, type: AgentActionType, payload: Record<string, unknown>, workflowRunId: string): Promise<AgentActionResult> {
  switch (type) {
    case "create_task": {
      const title = str(payload, "title", str(payload, "taskTitle", "งานจาก CEO Agent"));
      const description = str(payload, "description", str(payload, "taskDescription", ""));
      const priorityRaw = str(payload, "priority", "medium");
      const priority = priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";
      const { error } = await admin.from("tasks").insert({
        title,
        description: description || null,
        priority,
        source_workflow_run_id: workflowRunId,
        created_by: null,
      });
      if (error) return { ok: false, message: `สร้างงานไม่สำเร็จ: ${error.message}` };
      return { ok: true, message: `สร้างงาน "${title}" แล้ว` };
    }

    case "send_notification": {
      const title = str(payload, "title", "คำแนะนำจาก CEO Agent");
      const body = str(payload, "body", str(payload, "message", ""));
      const { error } = await admin.from("notifications").insert({
        type: "automation",
        title: title.slice(0, 120),
        body: body.slice(0, 500),
      });
      if (error) return { ok: false, message: `แจ้งเตือนไม่สำเร็จ: ${error.message}` };
      return { ok: true, message: "แจ้งเตือนในระบบแล้ว" };
    }

    case "send_line": {
      let lineUserId = str(payload, "lineUserId");
      const customerId = str(payload, "customerId");
      const message = str(payload, "message");
      if (!message) return { ok: false, message: "ไม่มีข้อความให้ส่ง" };
      if (!lineUserId && customerId) {
        const { data: customer } = await admin.from("customers").select("line_user_id").eq("id", customerId).maybeSingle();
        lineUserId = customer?.line_user_id ?? "";
      }
      if (!lineUserId) return { ok: false, message: "ลูกค้านี้ยังไม่มี LINE User ID — ส่งไม่ได้ ต้องส่งเอง" };
      await line.push(lineUserId, message);
      return { ok: true, message: "ส่ง LINE แล้ว" };
    }

    case "create_schedule": {
      const label = str(payload, "label", "งานอัตโนมัติจาก CEO Agent");
      const instruction = str(payload, "instruction", str(payload, "message", ""));
      if (!instruction) return { ok: false, message: "กำหนดการไม่มีคำสั่ง (instruction)" };
      const recurrenceType = str(payload, "recurrenceType", "daily") as "once" | "daily" | "every_n_days" | "weekly" | "monthly";
      const timeOfDay = str(payload, "timeOfDay", "09:00");
      const runOnceAt = str(payload, "runOnceAt");
      const nextRun = computeNextRun(
        {
          recurrenceType,
          intervalDays: Number.isFinite(Number(payload.intervalDays)) && Number(payload.intervalDays) > 0 ? Number(payload.intervalDays) : 1,
          dayOfWeek: Number.isFinite(Number(payload.dayOfWeek)) ? Number(payload.dayOfWeek) : 1,
          dayOfMonth: Number.isFinite(Number(payload.dayOfMonth)) ? Number(payload.dayOfMonth) : 1,
          timeOfDay,
          runOnceAt: runOnceAt || null,
        },
        new Date()
      );
      if (!nextRun) return { ok: false, message: "กำหนดการแบบครั้งเดียวต้องมีวันที่ (runOnceAt)" };
      const { error } = await admin.from("agent_schedules").insert({
        label: label.slice(0, 120),
        instruction,
        recurrence_type: recurrenceType,
        interval_days: recurrenceType === "every_n_days" ? (Number.isFinite(Number(payload.intervalDays)) && Number(payload.intervalDays) > 0 ? Number(payload.intervalDays) : 1) : null,
        day_of_week: recurrenceType === "weekly" ? (Number.isFinite(Number(payload.dayOfWeek)) ? Number(payload.dayOfWeek) : 1) : null,
        day_of_month: recurrenceType === "monthly" ? (Number.isFinite(Number(payload.dayOfMonth)) ? Number(payload.dayOfMonth) : 1) : null,
        time_of_day: timeOfDay,
        run_once_at: recurrenceType === "once" ? runOnceAt || null : null,
        active: true,
        next_run_at: nextRun.toISOString(),
        created_by: null,
      });
      if (error) return { ok: false, message: `สร้างกำหนดการไม่สำเร็จ: ${error.message}` };
      return { ok: true, message: `สร้างกำหนดการ "${label}" แล้ว` };
    }

    default:
      return { ok: false, message: `ไม่รู้จัก action type: ${type}` };
  }
}

// Called by agent-orchestrator when a workflow completes: persist each
// executable recommendation as an agent_actions row, running the auto ones
// immediately. Returns the number of actions registered.
export async function registerWorkflowActions(
  admin: SupabaseClient,
  workflowRunId: string,
  recommendedActions: RecommendedAction[]
): Promise<number> {
  let registered = 0;
  for (const action of recommendedActions) {
    if (!action.action) continue; // advisory recommendation — stays in jsonb only
    const type = action.action.type;
    const classification = classifyAgentAction(type);

    const { data: row, error } = await admin
      .from("agent_actions")
      .insert({
        workflow_run_id: workflowRunId,
        title: action.title,
        description: action.description,
        priority: action.priority,
        action_type: type,
        action_payload: action.action.payload,
        status: classification === "auto" ? "auto_executed" : "pending_approval",
      })
      .select("id")
      .single();
    if (error || !row) continue;
    registered += 1;

    if (classification === "auto") {
      const result = await executeAgentAction(admin, type, action.action.payload, workflowRunId).catch((err) => ({
        ok: false,
        message: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      }));
      await admin
        .from("agent_actions")
        .update({
          status: result.ok ? "auto_executed" : "failed",
          result: result.message,
          executed_at: new Date().toISOString(),
        })
        .eq("id", row.id as string);
    }
  }
  return registered;
}
