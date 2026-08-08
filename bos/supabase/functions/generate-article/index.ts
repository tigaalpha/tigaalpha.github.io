import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/ai-provider.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Mirrors features/content/topics.ts CORE_KEYWORDS_BY_LANG — every article must include all of these,
// translated per language (same meaning, same order across the three lists).
const CORE_KEYWORDS_BY_LANG: Record<"th" | "en" | "zh", string[]> = {
  th: [
    "สอนเปียโน",
    "เรียนเปียโน",
    "สอนดนตรี",
    "เรียนดนตรี",
    "คอร์สสอนเปียโน",
    "คอร์สสอนดนตรี",
    "ครูสอนเปียโนออนไลน์",
    "ครูสอนดนตรีออนไลน์",
  ],
  en: [
    "piano teaching",
    "learn piano",
    "music teaching",
    "learn music",
    "piano course",
    "music course",
    "online piano teacher",
    "online music teacher",
  ],
  zh: ["钢琴教学", "学钢琴", "音乐教学", "学音乐", "钢琴课程", "音乐课程", "在线钢琴老师", "在线音乐老师"],
};

function missingCoreKeywords(title: string, content: string, lang: "th" | "en" | "zh"): string[] {
  const haystack = `${title}\n${content}`;
  return CORE_KEYWORDS_BY_LANG[lang].filter((k) => !haystack.includes(k));
}

const RETURN_ARTICLE_TOOL: ToolDefinition = {
  name: "return_article",
  description: "Return the complete finished article. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Article H1 / SEO title tag, under 60 characters, includes the target keyword naturally." },
      metaDescription: { type: "string", description: "120-160 characters, a genuine reason to click, includes the target keyword." },
      slug: { type: "string", description: "Lowercase, hyphenated, English characters, short — even for a Thai article." },
      articleMarkdown: {
        type: "string",
        description:
          "Full article body in Markdown (## for H2, ### for H3). Do not repeat the H1 title at the top — start directly with the direct-answer opening paragraph. Must naturally include every one of the required core keywords listed in the instructions at least once each.",
      },
      faq: {
        type: "array",
        items: {
          type: "object",
          properties: { question: { type: "string" }, answer: { type: "string" } },
          required: ["question", "answer"],
        },
        description: "3-5 self-contained FAQ Q&A pairs, grounded in the knowledge base.",
      },
      internalLinkIdeas: {
        type: "array",
        items: { type: "string" },
        description: "2-3 internal link anchor-text ideas, e.g. 'link the phrase \"trial lesson\" to the booking page'.",
      },
    },
    required: ["title", "metaDescription", "slug", "articleMarkdown", "faq"],
  },
};

interface ReturnArticleArgs {
  title: string;
  metaDescription: string;
  slug: string;
  articleMarkdown: string;
  faq: { question: string; answer: string }[];
  internalLinkIdeas?: string[];
}

async function generateArticle(admin: SupabaseClient, systemPrompt: string, userPrompt: string): Promise<ReturnArticleArgs | null> {
  const result = await generate(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    [RETURN_ARTICLE_TOOL],
    0.7,
    4096
  );
  await logAiUsage(admin, result.usage, "generate-article");

  const call = result.message.toolCalls?.find((c) => c.name === "return_article");
  return call ? (call.arguments as unknown as ReturnArticleArgs) : null;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-article", { windowMinutes: 60, maxRequests: 10 });

    const { topic, targetKeyword, language } = await req.json();
    if (!topic || !targetKeyword) {
      return jsonResponse({ error: "topic and targetKeyword are required" }, 400);
    }
    const lang = language === "en" || language === "zh" ? language : "th";
    const langLabel = lang === "en" ? "English" : lang === "zh" ? "Chinese (Simplified, Mandarin)" : "Thai";

    // Ground the article in real business facts — same RAG search the
    // customer-facing AI uses, so pricing/teachers/policies can't be invented.
    const embedding = await embed(`${topic} ${targetKeyword}`);
    const { data: matches, error: searchError } = await admin.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      match_count: 8,
      min_similarity: 0.5,
    });
    if (searchError) throw searchError;

    const knowledgeContext = (matches ?? []).length
      ? (matches as { content: string }[]).map((m, i) => `[${i + 1}] ${m.content}`).join("\n\n")
      : "No matching knowledge base entries found — write in general, honest terms and avoid specific claims (exact prices, teacher names) that aren't verifiable.";

    const coreKeywords = CORE_KEYWORDS_BY_LANG[lang];
    const coreKeywordsList = coreKeywords.map((k) => `"${k}"`).join(", ");
    const systemPrompt = `${PROMPTS.seo_writer}\n\n## Required core keywords\nEvery article must naturally include ALL of these core keywords at least once each, in addition to the target keyword: ${coreKeywordsList}. These are already translated into ${langLabel} with the same meaning as the business's Thai search terms — use them exactly as given, do not translate them again or substitute synonyms. Weave them in naturally across headings/body — never as an unnatural stuffed list.\n\n## Business knowledge base (ground all facts in this — never invent)\n${knowledgeContext}`;
    const userPrompt = `Write an SEO/AEO article.\nTopic: ${topic}\nTarget keyword: ${targetKeyword}\nLanguage: ${langLabel}\nRequired core keywords (must all appear exactly as written, already translated into ${langLabel}): ${coreKeywordsList}\n\nCall return_article with the complete result.`;

    let args = await generateArticle(admin, systemPrompt, userPrompt);
    if (!args) {
      return jsonResponse({ error: "The AI didn't return a structured article — try again." }, 502);
    }

    // One retry if the model missed any required core keyword — cheap
    // insurance against an instruction the model just glossed over.
    let missing = missingCoreKeywords(args.title, args.articleMarkdown, lang);
    if (missing.length > 0) {
      const retryPrompt = `${userPrompt}\n\nYour previous draft was missing these required core keywords: ${missing.map((k) => `"${k}"`).join(", ")}. Rewrite the complete article so every required core keyword appears naturally, then call return_article again with the full corrected result.`;
      const retried = await generateArticle(admin, systemPrompt, retryPrompt);
      if (retried) {
        args = retried;
        missing = missingCoreKeywords(args.title, args.articleMarkdown, lang);
      }
    }

    const { data: article, error: insertError } = await admin
      .from("articles")
      .insert({
        title: args.title,
        slug: args.slug,
        target_keyword: targetKeyword,
        meta_description: args.metaDescription,
        content: args.articleMarkdown,
        faq: args.faq ?? [],
        internal_link_ideas: args.internalLinkIdeas ?? [],
        language: lang,
        status: "draft",
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ article, missingCoreKeywords: missing }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-article", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-article", error);
  }
});
