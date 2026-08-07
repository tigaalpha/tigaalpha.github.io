import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface DataHealthFinding {
  category: string;
  severity: "critical" | "warning" | "info";
  description: string;
  entity_type: string;
  entity_id: string | null;
  suggested_fix: string;
}

export class DataHealthRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async report(): Promise<DataHealthFinding[]> {
    const { data, error } = await this.db.rpc("data_health_report");
    if (error) throw error;
    return data ?? [];
  }
}
