import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class CourseArticlesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<Tables<"course_articles">[]> {
    const { data, error } = await this.db.from("course_articles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async get(id: string): Promise<Tables<"course_articles"> | null> {
    const { data, error } = await this.db.from("course_articles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async update(id: string, patch: Partial<Tables<"course_articles">>): Promise<Tables<"course_articles">> {
    const { data, error } = await this.db.from("course_articles").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("course_articles").delete().eq("id", id);
    if (error) throw error;
  }
}
