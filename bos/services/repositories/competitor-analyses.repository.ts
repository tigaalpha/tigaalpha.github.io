import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class CompetitorAnalysesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<Tables<"competitor_analyses">[]> {
    const { data, error } = await this.db.from("competitor_analyses").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("competitor_analyses").delete().eq("id", id);
    if (error) throw error;
  }
}
