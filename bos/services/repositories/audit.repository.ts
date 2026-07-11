import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class AuditRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRecent(limit = 50): Promise<Tables<"audit_log">[]> {
    const { data, error } = await this.db
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}
