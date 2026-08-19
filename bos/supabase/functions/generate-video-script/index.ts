import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, generateWithModel, embed } from "../_shared/ai-provider.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";

const RETURN_SCRIPT_TOOL: ToolDefinition = {
  name: "return_video_script",
  description: "Return the complete finished video script. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      hook: { type: "string", description: "The first 1-2 seconds of spoken/on-screen text — must stop the scroll. Plain text only, no brackets or scene descriptions." },
      script: {
        type: "string",
        description: "Full article paragraphs as plain text narration only. NO scene descriptions, NO visual directions, NO bracketed text, NO camera angles. Pure text meant to be read aloud. Ends with the CTA.",
      },
      caption: { type: "string", description: "Short social caption, 1-3 sentences. Plain text only." },
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

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-video-script", { windowMinutes: 60, maxRequests: 10 });

    const { topic, language, model } = await req.json();
    if (!topic) return jsonResponse({ error: "topic is required" }, 400);

    // "all" = generate in all 3 languages at once
    const langs: string[] = language === "all" ? ["th", "en", "zh"] : [language === "en" ? "en" : language === "zh" ? "zh" : "th"];

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

    const scripts: Array<Record<string, unknown>> = [];
    for (const lang of langs) {
      const langLabel = lang === "th" ? "Thai" : lang === "en" ? "English" : "Chinese (Mandarin)";
      const userPrompt = `Write a vertical video script.\nTopic: ${topic}\nLanguage: ${langLabel}\n\nCall return_video_script with the complete result.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ];
      const result = model
        ? await generateWithModel(model, messages, [RETURN_SCRIPT_TOOL], 0.8, 2048)
        : await generate(messages, [RETURN_SCRIPT_TOOL], 0.8, 2048, "content");
      await logAiUsage(admin, result.usage, "generate-video-script");

      const call = result.message.toolCalls?.find((c) => c.name === "return_video_script");
      const args = call ? (call.arguments as unknown as ReturnScriptArgs) : null;
      if (!args) continue; // skip failed language, don't abort the whole batch

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
      if (!insertError && script) scripts.push(script);
    }

    return jsonResponse({ scripts, count: scripts.length }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-video-script", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-video-script", error);
  }
});
