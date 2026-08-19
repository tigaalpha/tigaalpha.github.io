import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { computeNextRun, type ScheduleRecurrence } from "@/lib/compute-next-run";

type ScheduleInput = {
  label: string;
  instruction: string;
  recurrenceType: ScheduleRecurrence["recurrenceType"];
  intervalDays?: number | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  timeOfDay: string;
  runOnceAt?: string | null;
};

function toRecurrence(input: ScheduleInput): ScheduleRecurrence {
  return {
    recurrenceType: input.recurrenceType,
    intervalDays: input.intervalDays ?? null,
    dayOfWeek: input.dayOfWeek ?? null,
    dayOfMonth: input.dayOfMonth ?? null,
    timeOfDay: input.timeOfDay,
    runOnceAt: input.runOnceAt ?? null,
  };
}

export class AgentSchedulesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listSchedules(): Promise<Tables<"agent_schedules">[]> {
    const { data, error } = await this.db.from("agent_schedules").select("*").order("next_run_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async createSchedule(input: ScheduleInput, createdBy: string | null): Promise<Tables<"agent_schedules">> {
    const nextRun = computeNextRun(toRecurrence(input), new Date());
    if (!nextRun) throw new Error("กำหนดเวลานี้ไม่มีรอบถัดไป (ตรวจสอบวันที่/เวลาที่เลือก)");

    const { data, error } = await this.db
      .from("agent_schedules")
      .insert({
        label: input.label,
        instruction: input.instruction,
        recurrence_type: input.recurrenceType,
        interval_days: input.intervalDays ?? null,
        day_of_week: input.dayOfWeek ?? null,
        day_of_month: input.dayOfMonth ?? null,
        time_of_day: input.timeOfDay,
        run_once_at: input.runOnceAt ?? null,
        next_run_at: nextRun.toISOString(),
        created_by: createdBy,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updateSchedule(id: string, input: ScheduleInput): Promise<Tables<"agent_schedules">> {
    const nextRun = computeNextRun(toRecurrence(input), new Date());
    if (!nextRun) throw new Error("กำหนดเวลานี้ไม่มีรอบถัดไป (ตรวจสอบวันที่/เวลาที่เลือก)");

    const { data, error } = await this.db
      .from("agent_schedules")
      .update({
        label: input.label,
        instruction: input.instruction,
        recurrence_type: input.recurrenceType,
        interval_days: input.intervalDays ?? null,
        day_of_week: input.dayOfWeek ?? null,
        day_of_month: input.dayOfMonth ?? null,
        time_of_day: input.timeOfDay,
        run_once_at: input.runOnceAt ?? null,
        next_run_at: nextRun.toISOString(),
        active: true,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async toggleActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.db.from("agent_schedules").update({ active }).eq("id", id);
    if (error) throw error;
  }

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await this.db.from("agent_schedules").delete().eq("id", id);
    if (error) throw error;
  }
}
