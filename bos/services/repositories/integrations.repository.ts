import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export class IntegrationsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async get(key: string): Promise<string | null> {
    const { data, error } = await this.db.from("integration_settings").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const { error } = await this.db.from("integration_settings").upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
  }
}
