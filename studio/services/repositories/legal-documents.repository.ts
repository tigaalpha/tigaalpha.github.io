import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class LegalDocumentsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRecent(limit = 50): Promise<Tables<"legal_documents">[]> {
    const { data, error } = await this.db.from("legal_documents").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}
