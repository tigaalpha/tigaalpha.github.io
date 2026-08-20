import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class VideoClipsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(limit = 30): Promise<Tables<"video_clips">[]> {
    const { data, error } = await this.db
      .from("video_clips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async get(id: string): Promise<Tables<"video_clips"> | null> {
    const { data, error } = await this.db.from("video_clips").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("video_clips").delete().eq("id", id);
    if (error) throw error;
  }
}
