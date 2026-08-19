import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { generate } from "../_shared/ai-provider.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// KB self-learning (Feature #6): the studio's knowledge base only grows
// when the owner feeds it manually today. This cron finds the conversations
// where the AI escalated (needs_review) or fell back — i.e. the real gaps
// customers hit — and drafts a grounded KB answer for the owner to approve
// with one tap (kb-draft-action). Frequent cached questions are also mined
// (hits >= 3 = clearly asked often).
const MAX_DRAFTS_PER_RUN = 3;
const LOOKBACK_DAYS = 7;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Conversations the AI escalated / couldn't answer, with their last message.
    const { data: flagged } = await admin
      .from("conversations")
      .select("id, summary, updated_at, messages(content)")
      .eq("needs_review", true)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(10);
    const candidates: string[] = [];
    for (const conv of flagged ?? []) {
      const msgs = Array.isArray(conv.messages) ? conv.messages : [];
      const lastCustomer = [...msgs].reverse().find((m: { content: string }) => typeof m.content === "string" && m.content.trim().length > 3);
      if (lastCustomer && typeof lastCustomer.content === "string" && lastCustomer.content.length < 500) {
        candidates.push(lastCustomer.content.trim());
      }
    }

    // Frequently asked questions (cached answers with many hits).
    const { data: cached } = await admin
      .from("ai_response_cache")
      .select("question_text, hits")
      .gte("hits", 3)
      .order("hits", { ascending: false })
      .limit(5);
    for (const row of cached ?? []) {
      if (typeof row.question_text === "string" && row.question_text.trim().length < 200) candidates.push(row.question_text.trim());
    }

    // Dedupe against existing drafts / documents (cheap exact + prefix match).
    const unique = Array.from(new Set(candidates.map((q) => q.toLowerCase().replace(/\s+/g, " "))));
    const { data: existing } = await admin.from("kb_drafts").select("question");
    const existingQuestions = new Set((existing ?? []).map((d) => d.question.toLowerCase()));
    const questions = unique.filter((q) => !existingQuestions.has(q)).slice(0, MAX_DRAFTS_PER_RUN);

    let drafted = 0;
    for (const question of questions) {
      const result = await generate([
        {
          role: "system",
          content:
            "You are the TIGA studio staff. Write a short, accurate, friendly Thai KB answer for this customer question, " +
            "plain text (no markdown, no lists). If you genuinely cannot answer from what you know, say so honestly and " +
            "recommend checking with the owner. 2-4 sentences.",
        },
        { role: "user", content: question },
      ]);
      await logAiUsage(admin, result.usage, "kb-self-learn");
      const answer = result.message.content.trim();
      if (!answer) continue;

      await admin.from("kb_drafts").insert({ question, draft_answer: answer });
      drafted += 1;
    }

    if (drafted > 0) await logSystemEvent(admin, "kb-self-learn", "info", `${drafted} drafts created`);
    return jsonResponse({ candidates: unique.length, drafted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "kb-self-learn", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
