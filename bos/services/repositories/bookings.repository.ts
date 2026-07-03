import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class BookingsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Tables<"bookings"> | null> {
    const { data, error } = await this.db.from("bookings").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByGoogleEventId(eventId: string): Promise<Tables<"bookings"> | null> {
    const { data, error } = await this.db.from("bookings").select("*").eq("google_event_id", eventId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async listBetween(start: string, end: string, teacherId?: string): Promise<Tables<"bookings">[]> {
    let query = this.db
      .from("bookings")
      .select("*")
      .gte("start_time", start)
      .lte("start_time", end)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (teacherId) query = query.eq("teacher_id", teacherId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async listToday(): Promise<Tables<"bookings">[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return this.listBetween(start.toISOString(), end.toISOString());
  }

  async listTomorrow(): Promise<Tables<"bookings">[]> {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return this.listBetween(start.toISOString(), end.toISOString());
  }

  async hasConflict(teacherId: string, startTime: string, endTime: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .from("bookings")
      .select("id")
      .eq("teacher_id", teacherId)
      .neq("status", "cancelled")
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (excludeId) query = query.neq("id", excludeId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async countAll(): Promise<{ total: number; completed: number; cancelled: number }> {
    const [total, completed, cancelled] = await Promise.all([
      this.db.from("bookings").select("id", { count: "exact", head: true }),
      this.db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
      this.db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
    ]);

    if (total.error) throw total.error;
    if (completed.error) throw completed.error;
    if (cancelled.error) throw cancelled.error;

    return { total: total.count ?? 0, completed: completed.count ?? 0, cancelled: cancelled.count ?? 0 };
  }

  async create(input: Database["public"]["Tables"]["bookings"]["Insert"]): Promise<Tables<"bookings">> {
    const { data, error } = await this.db.from("bookings").insert(input).select("*").single();
    if (error) throw error;
    return data;
  }

  async update(id: string, patch: Database["public"]["Tables"]["bookings"]["Update"]): Promise<Tables<"bookings">> {
    const { data, error } = await this.db.from("bookings").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async cancel(id: string): Promise<Tables<"bookings">> {
    return this.update(id, { status: "cancelled" });
  }
}
