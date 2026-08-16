import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { GenerateResult } from "./ai-types.ts";

// Single writer for ai_usage_log -- was duplicated between ai-reports.ts
// and agent-orchestrator.ts; now every generate() call site across the app
// (chat, Strategy Room, Course Writer, ad/legal/video generators, etc.)
// logs through here so the Control Center's AI-cost tile isn't only
// counting the two features that happened to have it first.
export async function logAiUsage(admin: SupabaseClient, usage: GenerateResult["usage"], source: string): Promise<void> {
  if (!usage) return;
  await admin.rpc("log_ai_usage", {
    // ai-provider.ts stamps the real model id/slug onto every result's
    // usage.model, so the cost dashboard can break spend down per model
    // instead of lumping everything under "unknown".
    p_model: usage.model ?? "unknown",
    p_prompt_tokens: usage.promptTokens,
    p_completion_tokens: usage.completionTokens,
    p_source: source,
  });
}
