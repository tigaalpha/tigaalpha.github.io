import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate } from "../_shared/ai-provider.ts";
import { researchWithSearch } from "../_shared/gemini.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

const RETURN_LESSON_ARTICLE_TOOL: ToolDefinition = {
  name: "return_lesson_article",
  description: "Return the complete finished lesson article. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Lesson title, specific and student-facing (not generic)." },
      summary: { type: "string", description: "1-2 sentence summary of what the student learns in this lesson." },
      contentMarkdown: {
        type: "string",
        description:
          "Full lesson body in Markdown (## for section headings, ### for subsections). Do not repeat the title at the top — start directly with the lesson content. Every technical claim must be grounded in the research context given in the prompt.",
      },
    },
    required: ["title", "summary", "contentMarkdown"],
  },
};

interface ReturnLessonArgs {
  title: string;
  summary: string;
  contentMarkdown: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-course-article", { windowMinutes: 60, maxRequests: 10 });

    const { moduleTitle, topic, language } = await req.json();
    if (!moduleTitle || !topic) {
      return jsonResponse({ error: "moduleTitle and topic are required" }, 400);
    }
    const lang = language === "en" || language === "zh" ? language : "th";
    const langLabel = lang === "en" ? "English" : lang === "zh" ? "Chinese (Simplified, Mandarin)" : "Thai";

    // Real web research first -- this is what lets the lesson teach actual
    // piano technique/theory instead of only what's in the business's own
    // Knowledge Base (which covers pricing/policies/teachers, not pedagogy).
    const research = await researchWithSearch(
      `Research accurate, well-established information for teaching this piano lesson topic: "${topic}" (module: "${moduleTitle}"). Include concrete technique details, common beginner mistakes, and practice methods where relevant. Write a clear factual summary, not a lesson plan.`
    );

    const systemPrompt = `${PROMPTS.course_writer}\n\n## Web research for this topic (ground the lesson in this — cite nothing beyond it)\n${research.text}`;
    const userPrompt = `Write a lesson article.\nCourse module: ${moduleTitle}\nLesson topic: ${topic}\nLanguage: ${langLabel}\n\nCall return_lesson_article with the complete result.`;

    const result = await generate(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      [RETURN_LESSON_ARTICLE_TOOL],
      0.7,
      4096
    );

    const call = result.message.toolCalls?.find((c) => c.name === "return_lesson_article");
    if (!call) {
      return jsonResponse({ error: "The AI didn't return a structured lesson — try again." }, 502);
    }
    const args = call.arguments as unknown as ReturnLessonArgs;

    const { data: courseArticle, error: insertError } = await admin
      .from("course_articles")
      .insert({
        module_title: moduleTitle,
        topic,
        title: args.title,
        summary: args.summary,
        content: args.contentMarkdown,
        sources: research.sources,
        language: lang,
        status: "draft",
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ courseArticle }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-course-article", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSystemEvent(admin, "generate-course-article", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
