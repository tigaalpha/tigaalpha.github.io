import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { computeNextRun, type ScheduleRecurrence } from "@/lib/compute-next-run";

export interface AttendanceScheduleWithCustomer extends Tables<"attendance_reminder_schedules"> {
  customerName: string;
}

interface ScheduleInput {
  customerId: string;
  dayOfWeek: number;
  timeOfDay: string;
}

function toRecurrence(input: ScheduleInput): ScheduleRecurrence {
  return { recurrenceType: "weekly", intervalDays: null, dayOfWeek: input.dayOfWeek, dayOfMonth: null, timeOfDay: input.timeOfDay, runOnceAt: null };
}

export class AttendanceRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<AttendanceScheduleWithCustomer[]> {
    const { data: schedules, error } = await this.db.from("attendance_reminder_schedules").select("*").order("next_occurrence_at", { ascending: true });
    if (error) throw error;
    if (!schedules || schedules.length === 0) return [];

    const customerIds = [...new Set(schedules.map((s) => s.customer_id))];
    const { data: customers, error: customersError } = await this.db.from("customers").select("id, name").in("id", customerIds);
    if (customersError) throw customersError;
    const nameById = new Map((customers ?? []).map((c) => [c.id, c.name]));

    return schedules.map((s) => ({ ...s, customerName: nameById.get(s.customer_id) ?? "ไม่ทราบชื่อ" }));
  }

  async create(input: ScheduleInput, createdBy: string | null): Promise<Tables<"attendance_reminder_schedules">> {
    const nextOccurrence = computeNextRun(toRecurrence(input), new Date());
    if (!nextOccurrence) throw new Error("กำหนดเวลานี้ไม่มีรอบถัดไป (ตรวจสอบวัน/เวลาที่เลือก)");

    const { data, error } = await this.db
      .from("attendance_reminder_schedules")
      .insert({
        customer_id: input.customerId,
        day_of_week: input.dayOfWeek,
        time_of_day: input.timeOfDay,
        next_occurrence_at: nextOccurrence.toISOString(),
        created_by: createdBy,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, input: ScheduleInput): Promise<Tables<"attendance_reminder_schedules">> {
    const nextOccurrence = computeNextRun(toRecurrence(input), new Date());
    if (!nextOccurrence) throw new Error("กำหนดเวลานี้ไม่มีรอบถัดไป (ตรวจสอบวัน/เวลาที่เลือก)");

    const { data, error } = await this.db
      .from("attendance_reminder_schedules")
      .update({
        customer_id: input.customerId,
        day_of_week: input.dayOfWeek,
        time_of_day: input.timeOfDay,
        next_occurrence_at: nextOccurrence.toISOString(),
        last_reminded_occurrence: null,
        active: true,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async toggleActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.db.from("attendance_reminder_schedules").update({ active }).eq("id", id);
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from("attendance_reminder_schedules").delete().eq("id", id);
    if (error) throw error;
  }
}
