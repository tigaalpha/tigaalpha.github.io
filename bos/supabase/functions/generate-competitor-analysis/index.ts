import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate } from "../_shared/ai-provider.ts";
import { researchWithSearch } from "../_shared/gemini.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

const RETURN_COMPETITOR_ANALYSIS_TOOL: ToolDefinition = {
  name: "return_competitor_analysis",
  description: "Return the complete competitor analysis. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "2-4 sentence overview of the competitive landscape right now, mentioning roughly how many direct and indirect competitors were found.",
      },
      competitors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The competitor's real name, as found in research — never a placeholder." },
            type: { type: "string", enum: ["direct", "indirect"] },
            category: {
              type: "string",
              description: "e.g. 'โรงเรียนสอนเปียโนในไทย' for direct competitors or 'แอปสอนเปียโนระดับโลก' for indirect ones.",
            },
            marketingChannels: {
              type: "array",
              items: { type: "string" },
              description: "Channels/tactics this competitor visibly uses right now, based only on the research (e.g. Facebook Ads, TikTok organic, SEO blog, referral program, free trial funnel).",
            },
            notes: { type: "string", description: "1-2 sentences on what stands out about their marketing approach." },
          },
          required: ["name", "type", "category", "marketingChannels", "notes"],
        },
      },
      strategies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            approach: { type: "string", enum: ["compete", "avoid"] },
            title: { type: "string", description: "Short, specific move — not a vague direction." },
            description: { type: "string", description: "1-3 sentences explaining the move and why it fits a small, owner-operated piano school." },
          },
          required: ["approach", "title", "description"],
        },
      },
    },
    required: ["summary", "competitors", "strategies"],
  },
};

interface CompetitorEntry {
  name: string;
  type: "direct" | "indirect";
  category: string;
  marketingChannels: string[];
  notes: string;
}

interface StrategyEntry {
  approach: "compete" | "avoid";
  title: string;
  description: string;
}

interface ReturnCompetitorAnalysisArgs {
  summary: string;
  competitors: CompetitorEntry[];
  strategies: StrategyEntry[];
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-competitor-analysis", { windowMinutes: 60, maxRequests: 5 });

    // Real web research first -- this is what lets the analysis name actual
    // competitors and their actual current marketing tactics instead of
    // generic guesses.
    const research = await researchWithSearch(
      `Research the current competitive landscape for a piano school business in Thailand.
1) Direct competitors: piano schools, studios, and academies operating in Thailand (Bangkok and other cities) -- find real names, and what marketing channels/tactics each currently appears to use (social media presence, ads, promotions, SEO/website, partnerships, referral programs).
2) Indirect competitors: global piano-learning mobile apps and online platforms (e.g. Simply Piano, Flowkey, Yousician, Skoove, Piano Marvel, and any others) -- find their marketing approach (free trial funnels, app store presence, influencer marketing, content marketing, pricing strategy).
List concrete named competitors found in both categories with specifics, not generic descriptions.`
    );

    const systemPrompt = `${PROMPTS.competitor_analysis}\n\n## Web research on the current competitive landscape (ground your analysis in this — cite nothing beyond it)\n${research.text}`;
    const userPrompt = `Analyze the competitive landscape for Tiga Studio (a piano school in Thailand) based on the research above. Call return_competitor_analysis with the complete result.`;

    const result = await generate(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      [RETURN_COMPETITOR_ANALYSIS_TOOL],
      0.5,
      8192
    );

    const call = result.message.toolCalls?.find((c) => c.name === "return_competitor_analysis");
    if (!call) {
      await logSystemEvent(
        admin,
        "generate-competitor-analysis",
        "warning",
        `No tool call returned (finishReason: ${result.finishReason})`
      );
      return jsonResponse({ error: "The AI didn't return a structured analysis — try again." }, 502);
    }
    const args = call.arguments as unknown as ReturnCompetitorAnalysisArgs;

    const { data: analysis, error: insertError } = await admin
      .from("competitor_analyses")
      .insert({
        summary: args.summary,
        competitors: args.competitors ?? [],
        strategies: args.strategies ?? [],
        sources: research.sources,
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ analysis }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-competitor-analysis", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-competitor-analysis", error);
  }
});
