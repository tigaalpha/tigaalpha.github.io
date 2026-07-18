import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/ai-provider.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";

const RETURN_VOICEOVER_TOOL: ToolDefinition = {
  name: "return_voiceover",
  description: "Return the complete finished voice-over script. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "Full narration script: opening line, 3-6 short beats (each with a bracketed visual note), and a closing line.",
      },
    },
    required: ["script"],
  },
};

interface ReturnVoiceoverArgs {
  script: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    const userId = await requireStaff(admin, req);

    const { topic, language } = await req.json();
    if (!topic) return jsonResponse({ error: "topic is required" }, 400);
    const lang = language === "en" ? "en" : "th";

    // Only pull knowledge-base context if the topic plausibly references the
    // business — lifestyle/travel topics usually won't match anything, and
    // that's fine (the prompt already tells the model not to invent details).
    const embedding = await embed(topic);
    const { data: matches } = await admin.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      match_count: 4,
      min_similarity: 0.6,
    });

    const knowledgeContext = (matches ?? []).length
      ? (matches as { content: string }[]).map((m: { content: string }, i: number) => `[${i + 1}] ${m.content}`).join("\n\n")
      : "No related knowledge base entries — do not invent specific business/place details not given in the topic.";

    const systemPrompt = `${PROMPTS.voiceover}\n\n## Knowledge base context (only use if relevant to the topic)\n${knowledgeContext}`;
    const userPrompt = `Write a voice-over script.\nTopic: ${topic}\nLanguage: ${lang === "th" ? "Thai" : "English"}\n\nCall return_voiceover with the complete result.`;

    const result = await generate(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      [RETURN_VOICEOVER_TOOL],
      0.8,
      2048
    );

    const call = result.message.toolCalls?.find((c) => c.name === "return_voiceover");
    const args = call ? (call.arguments as unknown as ReturnVoiceoverArgs) : null;
    if (!args) return jsonResponse({ error: "The AI didn't return a structured script — try again." }, 502);

    const { data: script, error: insertError } = await admin
      .from("voiceover_scripts")
      .insert({ topic, script: args.script, language: lang, created_by: userId })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ script }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
