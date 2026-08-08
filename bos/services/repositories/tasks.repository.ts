import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

interface TaskInput {
  title: string;
  description?: string | null;
  priority?: "low" | "medium" | "high";
  dueAt?: string | null;
  customerId?: string | null;
}

export class TasksRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listOpen(): Promise<Tables<"tasks">[]> {
    const { data, error } = await this.db.from("tasks").select("*").eq("status", "open").order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  }

  async create(input: TaskInput, createdBy: string | null): Promise<Tables<"tasks">> {
    const { data, error } = await this.db
      .from("tasks")
      .insert({
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "medium",
        due_at: input.dueAt ?? null,
        customer_id: input.customerId ?? null,
        created_by: createdBy,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async setStatus(id: string, status: "open" | "done" | "cancelled"): Promise<void> {
    const { error } = await this.db.from("tasks").update({ status }).eq("id", id);
    if (error) throw error;
  }
}
