import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class AppAdKitsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<Tables<"app_ad_kits">[]> {
    const { data, error } = await this.db.from("app_ad_kits").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async addImage(id: string, existingImageIds: string[], imageId: string): Promise<void> {
    const { error } = await this.db
      .from("app_ad_kits")
      .update({ image_ids: [...existingImageIds, imageId] })
      .eq("id", id);
    if (error) throw error;
  }

  async addVideoClip(id: string, existingVideoClipIds: string[], videoClipId: string): Promise<void> {
    const { error } = await this.db
      .from("app_ad_kits")
      .update({ video_clip_ids: [...existingVideoClipIds, videoClipId] })
      .eq("id", id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("app_ad_kits").delete().eq("id", id);
    if (error) throw error;
  }
}
