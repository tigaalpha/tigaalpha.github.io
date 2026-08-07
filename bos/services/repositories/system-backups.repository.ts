import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class SystemBackupsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRecent(limit = 14): Promise<Tables<"system_backups">[]> {
    const { data, error } = await this.db
      .from("system_backups")
      .select("id, taken_at, row_counts, verified, verify_detail, status, error_detail")
      .order("taken_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Tables<"system_backups">[];
  }

  /** Full row dump for one backup, fetched separately (and only on demand) since it can be large. */
  async getFull(id: string): Promise<Tables<"system_backups"> | null> {
    const { data, error } = await this.db.from("system_backups").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }
}
