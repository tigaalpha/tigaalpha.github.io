import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

/** Single current business-health snapshot shown on the Dashboard — see get()/upsert() below. */
export class BusinessSnapshotRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async get(): Promise<Tables<"business_snapshot"> | null> {
    const { data, error } = await this.db
      .from("business_snapshot")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsert(patch: Database["public"]["Tables"]["business_snapshot"]["Insert"]): Promise<Tables<"business_snapshot">> {
    const existing = await this.get();
    if (existing) {
      const { data, error } = await this.db.from("business_snapshot").update(patch).eq("id", existing.id).select("*").single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await this.db.from("business_snapshot").insert(patch).select("*").single();
    if (error) throw error;
    return data;
  }
}
