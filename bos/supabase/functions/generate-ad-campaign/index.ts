import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/ai-provider.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

// AI drafts strategy/creative only — it never spends money or calls any ad
// platform's API. The campaign stays status='draft' here; it only becomes
// 'approved' via the approvals workflow (approvals/index.ts), and even then
// this app has no Meta/Google Ads API credentials connected, so "approved"
// produces a ready-to-paste brief for staff to execute manually in the ad
// platform's own UI, not an autonomous spend.
const CAMPAIGN_PROMPT = `# Ad Campaign Drafting Prompt — AI Marketing Strategist

Draft a paid ad campaign brief for Tiga Studio (a piano school), grounded in the Knowledge Base — never invent pricing, teacher names, or claims not backed by it.

Given a platform, objective, and optional budget hint, produce:
- targetAudience: who to target (demographics, interests, geography) and why, 2-4 sentences.
- budgetSuggestion: a realistic starting daily/total budget range for this objective and platform, with brief reasoning. If the requester gave a budget hint, work within it.
- adCopy: the actual ad text (headline + body), ready to paste into Ads Manager. Match the platform's typical format and length.
- creativeBrief: what the accompanying image/video should show, 2-4 sentences — description only, not the asset itself.

Never invent a specific budget as a hard commitment — always frame it as a starting suggestion for a human to confirm before spending real money.`;

const RETURN_CAMPAIGN_TOOL: ToolDefinition = {
  name: "return_campaign",
  description: "Return the complete campaign draft. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      targetAudience: { type: "string" },
      budgetSuggestion: { type: "string" },
      adCopy: { type: "string" },
      creativeBrief: { type: "string" },
    },
    required: ["targetAudience", "budgetSuggestion", "adCopy", "creativeBrief"],
  },
};

interface CampaignArgs {
  targetAudience: string;
  budgetSuggestion: string;
  adCopy: string;
  creativeBrief: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-ad-campaign", { windowMinutes: 60, maxRequests: 10 });

    const { platform, objective, budgetHint } = await req.json();
    if (typeof platform !== "string" || !platform.trim() || typeof objective !== "string" || !objective.trim()) {
      return jsonResponse({ error: "platform and objective (non-empty strings) are required" }, 400);
    }
    if (budgetHint !== undefined && budgetHint !== null && typeof budgetHint !== "string") {
      return jsonResponse({ error: "budgetHint must be a string if provided" }, 400);
    }

    const embedding = await embed(`${platform} ${objective}`);
    const { data: matches } = await admin.rpc("match_knowledge_chunks", { query_embedding: embedding, match_count: 6, min_similarity: 0.5 });
    const knowledgeContext = (matches ?? []).length
      ? (matches as { content: string }[]).map((m, i) => `[${i + 1}] ${m.content}`).join("\n\n")
      : "No matching knowledge base entries found — write in general, honest terms and avoid specific claims that aren't verifiable.";

    const systemPrompt = `${CAMPAIGN_PROMPT}\n\n## Business knowledge base (ground all facts in this — never invent)\n${knowledgeContext}`;
    const userPrompt = `Platform: ${platform}\nObjective: ${objective}\n${budgetHint ? `Budget hint from requester: ${budgetHint}\n` : ""}\nCall return_campaign with the complete draft.`;

    const result = await generate(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      [RETURN_CAMPAIGN_TOOL],
      0.7,
      2048
    );

    const call = result.message.toolCalls?.find((c) => c.name === "return_campaign");
    const args = call ? (call.arguments as unknown as CampaignArgs) : null;
    if (!args) return jsonResponse({ error: "The AI didn't return a structured campaign — try again." }, 502);

    const { data: campaign, error: insertError } = await admin
      .from("ad_campaigns")
      .insert({
        platform,
        objective,
        target_audience: args.targetAudience,
        budget_suggestion: args.budgetSuggestion,
        ad_copy: args.adCopy,
        creative_brief: args.creativeBrief,
        status: "draft",
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ campaign }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-ad-campaign", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-ad-campaign", error);
  }
});
