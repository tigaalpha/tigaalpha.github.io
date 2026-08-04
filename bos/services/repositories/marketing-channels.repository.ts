import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class MarketingChannelsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listManualStats(): Promise<Tables<"marketing_channel_manual_stats">[]> {
    const { data, error } = await this.db.from("marketing_channel_manual_stats").select("*");
    if (error) throw error;
    return data ?? [];
  }

  async upsertManualStat(
    channel: "tiktok" | "x" | "instagram",
    followers: number,
    note: string | null,
    updatedBy: string | null
  ): Promise<Tables<"marketing_channel_manual_stats">> {
    const { data, error } = await this.db
      .from("marketing_channel_manual_stats")
      .upsert({ channel, followers, note, updated_by: updatedBy }, { onConflict: "channel" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
}
