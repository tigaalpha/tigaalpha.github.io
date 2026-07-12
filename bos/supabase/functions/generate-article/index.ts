import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/ai-provider.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";

// Mirrors features/content/topics.ts CORE_KEYWORDS — every article must include all of these.
const CORE_KEYWORDS = ["เรียนเปียโน", "สอนเปียโน", "เรียนดนตรี", "สอนดนตรี", "คอร์สเรียนเปียโน", "คอร์สเรียนดนตรี"];

function missingCoreKeywords(title: string, content: string): string[] {
  const haystack = `${title}\n${content}`;
  return CORE_KEYWORDS.filter((k) => !haystack.includes(k));
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

async function generateArticle(systemPrompt: string, userPrompt: string): Promise<ReturnArticleArgs | null> {
  const result = await generate(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    [RETURN_ARTICLE_TOOL],
    0.7,
    4096
  );

  const call = result.message.toolCalls?.find((c) => c.name === "return_article");
  return call ? (call.arguments as unknown as ReturnArticleArgs) : null;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    const userId = await requireStaff(admin, req);

    const { topic, targetKeyword, language } = await req.json();
    if (!topic || !targetKeyword) {
      return jsonResponse({ error: "topic and targetKeyword are required" }, 400);
    }
    const lang = language === "en" ? "en" : "th";

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

    const coreKeywordsList = CORE_KEYWORDS.map((k) => `"${k}"`).join(", ");
    const systemPrompt = `${PROMPTS.seo_writer}\n\n## Required core keywords\nEvery article must naturally include ALL of these core keywords at least once each, in addition to the target keyword: ${coreKeywordsList}. Weave them in naturally across headings/body — never as an unnatural stuffed list.\n\n## Business knowledge base (ground all facts in this — never invent)\n${knowledgeContext}`;
    const userPrompt = `Write an SEO/AEO article.\nTopic: ${topic}\nTarget keyword: ${targetKeyword}\nLanguage: ${lang === "th" ? "Thai" : "English"}\nRequired core keywords (must all appear): ${coreKeywordsList}\n\nCall return_article with the complete result.`;

    let args = await generateArticle(systemPrompt, userPrompt);
    if (!args) {
      return jsonResponse({ error: "The AI didn't return a structured article — try again." }, 502);
    }

    // One retry if the model missed any required core keyword — cheap
    // insurance against an instruction the model just glossed over.
    let missing = missingCoreKeywords(args.title, args.articleMarkdown);
    if (missing.length > 0) {
      const retryPrompt = `${userPrompt}\n\nYour previous draft was missing these required core keywords: ${missing.map((k) => `"${k}"`).join(", ")}. Rewrite the complete article so every required core keyword appears naturally, then call return_article again with the full corrected result.`;
      const retried = await generateArticle(systemPrompt, retryPrompt);
      if (retried) {
        args = retried;
        missing = missingCoreKeywords(args.title, args.articleMarkdown);
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
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
