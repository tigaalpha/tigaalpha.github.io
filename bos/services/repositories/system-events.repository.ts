import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class SystemEventsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRecent(limit = 100): Promise<Tables<"system_events">[]> {
    const { data, error } = await this.db.from("system_events").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Non-"info" events only, for a "problems worth knowing about" list (e.g. the Dashboard). */
  async recentProblems(limit = 5): Promise<Tables<"system_events">[]> {
    const { data, error } = await this.db
      .from("system_events")
      .select("*")
      .neq("severity", "info")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}
