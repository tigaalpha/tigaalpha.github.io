import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class AiReportsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listByType(reportType: Tables<"ai_reports">["report_type"], limit = 10): Promise<Tables<"ai_reports">[]> {
    const { data, error } = await this.db
      .from("ai_reports")
      .select("*")
      .eq("report_type", reportType)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listForCustomer(customerId: string, reportType: Tables<"ai_reports">["report_type"]): Promise<Tables<"ai_reports">[]> {
    const { data, error } = await this.db
      .from("ai_reports")
      .select("*")
      .eq("entity_type", "customer")
      .eq("entity_id", customerId)
      .eq("report_type", reportType)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async usageLast7Days(): Promise<{ calls: number; promptTokens: number; completionTokens: number }> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db.from("ai_usage_log").select("prompt_tokens, completion_tokens").gte("created_at", since);
    if (error) throw error;
    const rows = data ?? [];
    return {
      calls: rows.length,
      promptTokens: rows.reduce((sum, r) => sum + r.prompt_tokens, 0),
      completionTokens: rows.reduce((sum, r) => sum + r.completion_tokens, 0),
    };
  }
}
