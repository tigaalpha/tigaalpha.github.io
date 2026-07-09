import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, CourseHours } from "@/types/database";

export class CoursesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Tables<"courses"> | null> {
    const { data, error } = await this.db.from("courses").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async findActiveForCustomer(customerId: string): Promise<Tables<"courses"> | null> {
    const { data, error } = await this.db
      .from("courses")
      .select("*")
      .eq("customer_id", customerId)
      .gt("remaining_hour", 0)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async listForCustomer(customerId: string): Promise<Tables<"courses">[]> {
    const { data, error } = await this.db
      .from("courses")
      .select("*")
      .eq("customer_id", customerId)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listNearingCompletion(maxRemainingHour = 1): Promise<Tables<"courses">[]> {
    const { data, error } = await this.db
      .from("courses")
      .select("*")
      .gt("remaining_hour", 0)
      .lte("remaining_hour", maxRemainingHour)
      .order("remaining_hour", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async create(customerId: string, totalHours: CourseHours, extra: Partial<Database["public"]["Tables"]["courses"]["Insert"]> = {}): Promise<Tables<"courses">> {
    const { data, error } = await this.db
      .from("courses")
      .insert({ customer_id: customerId, total_hours: totalHours, current_hour: 0, remaining_hour: totalHours, ...extra })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
}
