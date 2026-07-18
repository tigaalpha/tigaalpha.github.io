import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class VoiceoverScriptsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<Tables<"voiceover_scripts">[]> {
    const { data, error } = await this.db.from("voiceover_scripts").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("voiceover_scripts").delete().eq("id", id);
    if (error) throw error;
  }
}
