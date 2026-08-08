import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

type Channel = Tables<"marketing_metric_snapshots">["channel"];
type Metric = Tables<"marketing_metric_snapshots">["metric"];

export class MarketingMetricsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async snapshotsSince(sinceISO: string): Promise<Tables<"marketing_metric_snapshots">[]> {
    const { data, error } = await this.db
      .from("marketing_metric_snapshots")
      .select("*")
      .gte("captured_at", sinceISO)
      .order("captured_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async logManualSnapshot(channel: Channel, metric: Metric, value: number, createdBy: string | null): Promise<Tables<"marketing_metric_snapshots">> {
    const { data, error } = await this.db
      .from("marketing_metric_snapshots")
      .insert({ channel, metric, value, source: "manual", created_by: createdBy })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
}
