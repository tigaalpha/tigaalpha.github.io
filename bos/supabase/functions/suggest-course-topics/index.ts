import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate } from "../_shared/ai-provider.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

const SUGGESTION_COUNT = 10;

const RETURN_TOPIC_SUGGESTIONS_TOOL: ToolDefinition = {
  name: "return_topic_suggestions",
  description: `Return exactly ${SUGGESTION_COUNT} lesson topic suggestions for the online piano course. Call this exactly once.`,
  parameters: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        minItems: SUGGESTION_COUNT,
        maxItems: SUGGESTION_COUNT,
        items: {
          type: "object",
          properties: {
            moduleTitle: { type: "string", description: "Short course module name this lesson belongs under." },
            topic: { type: "string", description: "The specific lesson topic — student-facing, concrete, not generic." },
            whyItWorks: {
              type: "string",
              description: "1 short sentence on why this resonates with Gen Z / Gen Alpha piano learners specifically.",
            },
          },
          required: ["moduleTitle", "topic", "whyItWorks"],
        },
      },
    },
    required: ["suggestions"],
  },
};

interface TopicSuggestion {
  moduleTitle: string;
  topic: string;
  whyItWorks: string;
}

const SYSTEM_PROMPT = `You are a curriculum ideator for an online piano course, brainstorming lesson
topics specifically for Gen Z (born ~1997-2012) and Gen Alpha (born ~2010+)
learners.

## What makes a topic land with this audience
- Connects piano technique/theory to things they already love: game music,
  anime/K-pop soundtracks, viral songs, short-form video trends, meme
  culture, lo-fi/chill beats -- without being cringe about it.
- Framed around a fast, visible win ("play this in 10 minutes") over a
  slow academic build-up.
- Speaks to self-expression, creating content (a clip worth posting), or
  social/collaborative music-making, not just solo practice discipline.
- Still teaches something real and specific -- never a gimmick with no
  actual piano skill behind it.

## Output
Exactly 10 distinct suggestions, each with a short module name, a specific
lesson topic (not generic), and one sentence on why it resonates with this
audience. Vary difficulty level and musical style across the 10 so it reads
like a real course outline, not 10 versions of the same idea. Write in Thai.`;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "suggest-course-topics", { windowMinutes: 60, maxRequests: 20 });

    const result = await generate(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Suggest ${SUGGESTION_COUNT} piano lesson topics. Call return_topic_suggestions with the complete result.` },
      ],
      [RETURN_TOPIC_SUGGESTIONS_TOOL],
      0.9,
      2048
    );

    const call = result.message.toolCalls?.find((c) => c.name === "return_topic_suggestions");
    if (!call) {
      return jsonResponse({ error: "The AI didn't return suggestions — try again." }, 502);
    }
    const args = call.arguments as unknown as { suggestions: TopicSuggestion[] };

    return jsonResponse({ suggestions: args.suggestions ?? [] });
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "suggest-course-topics", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSystemEvent(admin, "suggest-course-topics", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
