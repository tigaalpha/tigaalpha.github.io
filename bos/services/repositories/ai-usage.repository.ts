import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Reads ai_usage_log — every generate() call site across the app logs
// through log_ai_usage (see supabase/functions/_shared/usage-logging.ts),
// so this covers chat, Strategy Room, content generators, agents, etc.
export interface AiUsageRow {
  id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  source: string;
  created_at: string;
}

export class AiUsageRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Raw recent rows (newest first) — the AI Cost page aggregates by
   *  model/source/day and applies per-model price estimates in the client. */
  async listRecent(days = 30, limit = 5000): Promise<AiUsageRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db
      .from("ai_usage_log")
      .select("id, model, prompt_tokens, completion_tokens, source, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AiUsageRow[];
  }

  async bySourceLast30Days(): Promise<{ source: string; totalTokens: number }[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db.from("ai_usage_log").select("source, prompt_tokens, completion_tokens").gte("created_at", since);
    if (error) throw error;

    const totals: Record<string, number> = {};
    for (const row of data ?? []) {
      totals[row.source] = (totals[row.source] ?? 0) + row.prompt_tokens + row.completion_tokens;
    }

    return Object.entries(totals)
      .map(([source, totalTokens]) => ({ source, totalTokens }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }
}
