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

  async listPending(limit = 10): Promise<Tables<"bookings">[]> {
    const { data, error } = await this.db
      .from("bookings")
      .select("*")
      .eq("status", "pending")
      .order("start_time", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  // "Trial" has no marker on the booking row itself -- only sales_status on
  // the customer -- so this fetches today+tomorrow's bookings first, then
  // cross-references customers separately, matching the two-query-then-
  // join-in-JS pattern courses.repository.ts's renewalOpportunities already uses.
  async listTrialsTodayAndTomorrow(): Promise<{ booking: Tables<"bookings">; customerId: string }[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    const bookings = await this.listBetween(start.toISOString(), end.toISOString());
    if (bookings.length === 0) return [];

    const customerIds = [...new Set(bookings.map((b) => b.customer_id))];
    const { data: customers, error } = await this.db.from("customers").select("id, sales_status").in("id", customerIds);
    if (error) throw error;
    const trialCustomerIds = new Set((customers ?? []).filter((c) => c.sales_status === "trial_booked").map((c) => c.id));

    return bookings.filter((b) => trialCustomerIds.has(b.customer_id)).map((b) => ({ booking: b, customerId: b.customer_id }));
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

  async countPending(): Promise<number> {
    const { count, error } = await this.db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (error) throw error;
    return count ?? 0;
  }

  /** Completed-lesson count per teacher, for the Teacher Performance report. */
  async countCompletedByTeacher(): Promise<Record<string, number>> {
    const { data, error } = await this.db.from("bookings").select("teacher_id").eq("status", "completed");
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (!row.teacher_id) continue;
      counts[row.teacher_id] = (counts[row.teacher_id] ?? 0) + 1;
    }
    return counts;
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
