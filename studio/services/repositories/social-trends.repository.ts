import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export type ManualTrendPlatform = "tiktok" | "instagram" | "facebook" | "wechat" | "alipay" | "xiaohongshu";

export class SocialTrendsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listManualItems(): Promise<Tables<"social_trend_manual_items">[]> {
    const { data, error } = await this.db.from("social_trend_manual_items").select("*").order("platform").order("rank");
    if (error) throw error;
    return data ?? [];
  }

  async addItem(platform: ManualTrendPlatform, rank: number, topic: string, detail: string | null, updatedBy: string | null) {
    const { data, error } = await this.db
      .from("social_trend_manual_items")
      .insert({ platform, rank, topic, detail, updated_by: updatedBy })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updateItem(id: string, rank: number, topic: string, detail: string | null, updatedBy: string | null) {
    const { data, error } = await this.db
      .from("social_trend_manual_items")
      .update({ rank, topic, detail, updated_by: updatedBy })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.db.from("social_trend_manual_items").delete().eq("id", id);
    if (error) throw error;
  }
}
