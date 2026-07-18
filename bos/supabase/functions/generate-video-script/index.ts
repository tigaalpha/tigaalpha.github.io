import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/ai-provider.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";

const RETURN_SCRIPT_TOOL: ToolDefinition = {
  name: "return_video_script",
  description: "Return the complete finished video script. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      hook: { type: "string", description: "The first 1-2 seconds of spoken/on-screen text — must stop the scroll." },
      script: {
        type: "string",
        description: "Full numbered scene-by-scene script. Each scene: one short spoken line plus a one-line visual direction in brackets. Ends with the CTA scene.",
      },
      caption: { type: "string", description: "Short social caption, 1-3 sentences." },
      hashtags: { type: "array", items: { type: "string" }, description: "5-8 hashtags, no leading # needed." },
    },
    required: ["hook", "script", "caption", "hashtags"],
  },
};

interface ReturnScriptArgs {
  hook: string;
  script: string;
  caption: string;
  hashtags: string[];
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

    // Ground the script in real business facts, same RAG search as the other writers.
    const embedding = await embed(topic);
    const { data: matches, error: searchError } = await admin.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      match_count: 6,
      min_similarity: 0.5,
    });
    if (searchError) throw searchError;

    const knowledgeContext = (matches ?? []).length
      ? (matches as { content: string }[]).map((m, i) => `[${i + 1}] ${m.content}`).join("\n\n")
      : "No matching knowledge base entries found — write in general, honest terms and avoid specific claims (exact prices, teacher names) that aren't verifiable.";

    const systemPrompt = `${PROMPTS.video_script}\n\n## Business knowledge base (ground all facts in this — never invent)\n${knowledgeContext}`;
    const userPrompt = `Write a vertical video script.\nTopic: ${topic}\nLanguage: ${lang === "th" ? "Thai" : "English"}\n\nCall return_video_script with the complete result.`;

    const result = await generate(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      [RETURN_SCRIPT_TOOL],
      0.8,
      2048
    );

    const call = result.message.toolCalls?.find((c) => c.name === "return_video_script");
    const args = call ? (call.arguments as unknown as ReturnScriptArgs) : null;
    if (!args) return jsonResponse({ error: "The AI didn't return a structured script — try again." }, 502);

    const { data: script, error: insertError } = await admin
      .from("video_scripts")
      .insert({
        topic,
        hook: args.hook,
        script: args.script,
        caption: args.caption,
        hashtags: args.hashtags ?? [],
        language: lang,
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ script }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
