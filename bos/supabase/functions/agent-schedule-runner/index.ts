import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { respond } from "../_shared/chat-core.ts";
import { computeNextRun } from "../_shared/schedule.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

const RESULT_SNIPPET_LENGTH = 200;
const CONVERSATION_SETTING_KEY = "agent_scheduled_runs_conversation_id";

async function getOrCreateScheduledRunsConversation(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data: existing } = await admin
    .from("integration_settings")
    .select("value")
    .eq("key", CONVERSATION_SETTING_KEY)
    .maybeSingle();
  if (existing?.value) return existing.value;

  const { data: created, error } = await admin.from("conversations").insert({ channel: "internal" }).select("id").single();
  if (error) throw error;
  await admin.from("integration_settings").upsert({ key: CONVERSATION_SETTING_KEY, value: created.id }, { onConflict: "key" });
  return created.id;
}

interface ScheduleRow {
  id: string;
  instruction: string;
  recurrence_type: "once" | "daily" | "every_n_days" | "weekly" | "monthly";
  interval_days: number | null;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  run_once_at: string | null;
  next_run_at: string;
  created_by: string | null;
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  try {
    const { data: due, error } = await admin
      .from("agent_schedules")
      .select("*")
      .eq("active", true)
      .lte("next_run_at", new Date().toISOString());
    if (error) throw error;
    if (!due || due.length === 0) return jsonResponse({ ran: 0 });

    const convId = await getOrCreateScheduledRunsConversation(admin);

    let ranCount = 0;
    for (const schedule of due as ScheduleRow[]) {
      try {
        const result = await respond(admin, convId, schedule.instruction, ["owner", "sales", "booking", "knowledge"], schedule.created_by);

        const nextRun = computeNextRun(
          {
            recurrenceType: schedule.recurrence_type,
            intervalDays: schedule.interval_days,
            dayOfWeek: schedule.day_of_week,
            dayOfMonth: schedule.day_of_month,
            timeOfDay: schedule.time_of_day,
            runOnceAt: schedule.run_once_at,
          },
          new Date(schedule.next_run_at)
        );

        await admin
          .from("agent_schedules")
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: "success",
            last_run_result: result.reply.slice(0, RESULT_SNIPPET_LENGTH),
            next_run_at: nextRun ? nextRun.toISOString() : schedule.next_run_at,
            active: nextRun !== null,
          })
          .eq("id", schedule.id);
        ranCount += 1;
      } catch (scheduleError) {
        const message = scheduleError instanceof Error ? scheduleError.message : "Unknown error";
        await logSystemEvent(admin, "agent-schedule-runner", "error", `Schedule ${schedule.id}: ${message}`);
        await admin
          .from("agent_schedules")
          .update({ last_run_at: new Date().toISOString(), last_run_status: "error", last_run_result: message.slice(0, RESULT_SNIPPET_LENGTH) })
          .eq("id", schedule.id);
      }
    }

    return jsonResponse({ ran: ranCount, due: due.length });
  } catch (error) {
    return await handleUnexpectedError(admin, "agent-schedule-runner", error);
  }
});
