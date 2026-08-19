import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class ArticlesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<Tables<"articles">[]> {
    const { data, error } = await this.db.from("articles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async get(id: string): Promise<Tables<"articles"> | null> {
    const { data, error } = await this.db.from("articles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async update(id: string, patch: Partial<Tables<"articles">>): Promise<Tables<"articles">> {
    const { data, error } = await this.db.from("articles").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("articles").delete().eq("id", id);
    if (error) throw error;
  }
}
