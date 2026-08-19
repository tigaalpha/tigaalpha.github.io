import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class GeneratedImagesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(limit = 60): Promise<Tables<"generated_images">[]> {
    const { data, error } = await this.db
      .from("generated_images")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("generated_images").delete().eq("id", id);
    if (error) throw error;
  }
}
