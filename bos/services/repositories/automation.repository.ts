import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class AutomationRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRules(): Promise<Tables<"automation_rules">[]> {
    const { data, error } = await this.db.from("automation_rules").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async toggleRule(id: string, enabled: boolean): Promise<void> {
    const { error } = await this.db.from("automation_rules").update({ enabled }).eq("id", id);
    if (error) throw error;
  }

  async deleteRule(id: string): Promise<void> {
    const { error } = await this.db.from("automation_rules").delete().eq("id", id);
    if (error) throw error;
  }

  async listRecentRuns(limit = 30): Promise<Tables<"automation_runs">[]> {
    const { data, error } = await this.db.from("automation_runs").select("*").order("started_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async runCounts(sinceDays = 7): Promise<{ success: number; failed: number; skipped: number }> {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db.from("automation_runs").select("status").gte("started_at", since);
    if (error) throw error;
    const counts = { success: 0, failed: 0, skipped: 0 };
    for (const row of data ?? []) counts[row.status as "success" | "failed" | "skipped"] += 1;
    return counts;
  }
}
