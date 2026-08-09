import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, CourseHours } from "@/types/database";

const RENEWAL_ALREADY_HANDLED_STATUSES = ["renew_pending", "renewed", "lost"];

export interface RenewalOpportunity {
  courseId: string;
  customerId: string;
  customerName: string;
  remainingHour: number;
  totalHours: number;
}

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

  /** Total remaining paid hours across every active course, for the Dashboard. */
  async sumRemainingHours(): Promise<number> {
    const { data, error } = await this.db.from("courses").select("remaining_hour").gt("remaining_hour", 0);
    if (error) throw error;
    return (data ?? []).reduce((sum, row) => sum + row.remaining_hour, 0);
  }

  // Real, current renewal opportunities -- not a stored "probability"
  // (no data exists to honestly support one). A course is nearing
  // completion, its customer hasn't already moved to renew_pending/
  // renewed/lost, and no open task is already tracking it -- visible
  // whether or not the course_ending_soon automation rule is enabled.
  async renewalOpportunities(maxRemainingHour = 2): Promise<RenewalOpportunity[]> {
    const { data: courses, error } = await this.db
      .from("courses")
      .select("id, remaining_hour, total_hours, customer_id")
      .gt("remaining_hour", 0)
      .lte("remaining_hour", maxRemainingHour);
    if (error) throw error;
    if (!courses || courses.length === 0) return [];

    const customerIds = [...new Set(courses.map((c) => c.customer_id))];
    const [{ data: customers, error: customersErr }, { data: openTasks, error: tasksErr }] = await Promise.all([
      this.db.from("customers").select("id, name, sales_status").in("id", customerIds),
      this.db.from("tasks").select("customer_id").eq("status", "open").in("customer_id", customerIds),
    ]);
    if (customersErr) throw customersErr;
    if (tasksErr) throw tasksErr;

    const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
    const customerIdsWithOpenTask = new Set((openTasks ?? []).map((t) => t.customer_id).filter((id): id is string => id !== null));

    const opportunities: RenewalOpportunity[] = [];
    for (const course of courses) {
      const customer = customerById.get(course.customer_id);
      if (!customer) continue;
      if (RENEWAL_ALREADY_HANDLED_STATUSES.includes(customer.sales_status)) continue;
      if (customerIdsWithOpenTask.has(course.customer_id)) continue;
      opportunities.push({
        courseId: course.id,
        customerId: course.customer_id,
        customerName: customer.name,
        remainingHour: course.remaining_hour,
        totalHours: course.total_hours,
      });
    }
    return opportunities.sort((a, b) => a.remainingHour - b.remainingHour);
  }
}
