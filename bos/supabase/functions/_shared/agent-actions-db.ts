// DB-facing half of agent-actions: executes an approved/auto action against
// real tables and registers a workflow's recommendations as agent_actions
// rows. Kept separate from agent-actions.ts (pure, unit-tested) because
// this file needs the supabase client, the LINE pusher, and schedule math —
// which the test-visible pure file must stay free of.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import * as line from "./line.ts";
import { computeNextRun } from "./schedule.ts";
import { sendEmail } from "./email.ts";
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

    case "draft_content": {
      const title = str(payload, "title", "คอนเทนต์จาก CEO Agent");
      const body = str(payload, "body", str(payload, "content", ""));
      const platform = str(payload, "platform", "");
      const kindRaw = str(payload, "kind", "article");
      const kind = kindRaw === "short" || kindRaw === "social" || kindRaw === "ad" ? kindRaw : "article";
      const plannedRaw = str(payload, "plannedDate");
      const plannedDate = plannedRaw && /^\d{4}-\d{2}-\d{2}$/.test(plannedRaw) ? plannedRaw : null;
      const { error } = await admin.from("content_calendar").insert({
        kind,
        title: title.slice(0, 200),
        body: body || null,
        platform: platform || null,
        planned_date: plannedDate,
        status: "draft",
      });
      if (error) return { ok: false, message: `ร่างคอนเทนต์ไม่สำเร็จ: ${error.message}` };
      return { ok: true, message: `เพิ่มร่าง "${title.slice(0, 60)}" เข้าปฏิทินคอนเทนต์แล้ว (รออนุมัติ)` };
    }

    case "update_customer": {
      const customerId = str(payload, "customerId");
      if (!customerId) return { ok: false, message: "ไม่มี customerId — อัปเดตลูกค้าไม่ได้" };

      const VALID_SALES_STATUSES = [
        "new_lead", "contacted", "qualified", "interested", "trial_booked", "trial_completed",
        "negotiating", "waiting_decision", "won", "lost", "renew_pending", "renewed",
      ];
      const patch: Record<string, unknown> = {};
      const name = str(payload, "name");
      if (name) patch.name = name;
      const phone = str(payload, "phone");
      if (phone) patch.phone = phone;
      const email = str(payload, "email");
      if (email) patch.email = email;
      const notes = str(payload, "notes");
      if (notes) patch.notes = notes;
      const budget = str(payload, "budget");
      if (budget) patch.budget = budget;
      const learningGoal = str(payload, "learningGoal");
      if (learningGoal) patch.learning_goal = learningGoal;
      const experienceLevel = str(payload, "experienceLevel");
      if (experienceLevel) patch.experience_level = experienceLevel;
      const preferredSchedule = str(payload, "preferredSchedule");
      if (preferredSchedule) patch.preferred_schedule = preferredSchedule;
      const salesStatus = str(payload, "salesStatus");
      if (salesStatus && VALID_SALES_STATUSES.includes(salesStatus)) patch.sales_status = salesStatus;

      if (Object.keys(patch).length === 0) return { ok: false, message: "ไม่มีข้อมูลให้อัปเดตลูกค้า" };

      const { data: existing } = await admin.from("customers").select("sales_status").eq("id", customerId).maybeSingle();
      if (!existing) return { ok: false, message: "ไม่พบลูกค้าที่ระบุ" };

      const { error } = await admin.from("customers").update(patch).eq("id", customerId);
      if (error) return { ok: false, message: `อัปเดตลูกค้าไม่สำเร็จ: ${error.message}` };

      if (patch.sales_status && patch.sales_status !== existing.sales_status) {
        await admin
          .from("sales_status_history")
          .insert({
            customer_id: customerId,
            from_status: existing.sales_status,
            to_status: patch.sales_status as string,
            note: "CEO Agent (อนุมัติโดยเจ้าของ)",
          })
          .catch(() => {});
      }
      return { ok: true, message: "อัปเดตข้อมูลลูกค้าแล้ว" };
    }

    case "send_email": {
      let to = str(payload, "email");
      const customerId = str(payload, "customerId");
      const subject = str(payload, "subject", "ข้อความจาก Tiga Studio");
      const body = str(payload, "body", str(payload, "message", ""));
      if (!body) return { ok: false, message: "ไม่มีเนื้อหาอีเมล" };
      if (!to && customerId) {
        const { data: customer } = await admin.from("customers").select("email").eq("id", customerId).maybeSingle();
        to = customer?.email ?? "";
      }
      if (!to) return { ok: false, message: "ไม่มีอีเมลผู้รับ — ระบุ email หรือ customerId ที่มีอีเมล" };
      const result = await sendEmail(admin, { to, subject, text: body });
      return result;
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
