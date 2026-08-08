import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Surfaces token usage by source (feature), not a dollar figure -- no
// pricing table exists in this app, and guessing per-model rates would be
// stale the moment a provider changes pricing. Coverage is partial: only
// ai-reports.ts and agent-orchestrator.ts call log_ai_usage today (most
// AI features, e.g. Strategy Room, sales chat, aren't instrumented yet).
export class AiUsageRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

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
