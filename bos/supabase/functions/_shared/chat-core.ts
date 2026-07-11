import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate } from "./ai-provider.ts";
import type { ChatMessage } from "./ai-types.ts";
import { buildSystemPrompt, type PromptName } from "./prompts.ts";
import { AI_TOOLS, executeTool } from "./tools.ts";

const MAX_TOOL_ITERATIONS = 4;
const RECENT_MESSAGE_LIMIT = 12;
// FAQ answers (pricing, hours) can change, so a cached reply isn't reused forever.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface RespondResult {
  reply: string;
  needsReview: boolean;
}

async function hashQuestion(text: string): Promise<string> {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function respond(
  db: SupabaseClient,
  conversationId: string,
  customerMessage: string,
  promptContext: PromptName[] = ["sales", "booking", "knowledge", "customer_service"]
): Promise<RespondResult> {
  const { count: priorMessageCount } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  const isOpeningMessage = (priorMessageCount ?? 0) === 0;

  // AI cost optimization (Cache / Reuse Answers): an opening FAQ-style
  // question ("how much for 20 hours?") asked by a different customer
  // shouldn't cost a fresh Gemini call. Only applies to the first message —
  // once there's conversation history, a reply is context-dependent and
  // must not be reused verbatim for someone else's conversation.
  if (isOpeningMessage) {
    const questionHash = await hashQuestion(customerMessage);
    const { data: cached } = await db.from("ai_response_cache").select("*").eq("question_hash", questionHash).maybeSingle();

    if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
      await db.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: customerMessage });
      await db.from("messages").insert({
        conversation_id: conversationId,
        sender: "ai",
        content: cached.reply,
        metadata: { cached: true },
      });
      await db.from("ai_response_cache").update({ hits: cached.hits + 1 }).eq("id", cached.id);
      return { reply: cached.reply, needsReview: false };
    }
  }

  await db.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: customerMessage });

  const { data: conversation } = await db.from("conversations").select("summary").eq("id", conversationId).single();

  const { data: history } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(RECENT_MESSAGE_LIMIT);

  const systemParts = [buildSystemPrompt(promptContext)];
  if (conversation?.summary) {
    systemParts.push(`Summary of earlier messages in this conversation (not repeated below):\n${conversation.summary}`);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    ...(history ?? []).map((m: { sender: string; content: string }) => ({
      role: (m.sender === "customer" ? "user" : "assistant") as ChatMessage["role"],
      content: m.content,
    })),
  ];

  let iterations = 0;
  let usedTools = false;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1;
    const result = await generate(messages, AI_TOOLS);

    if (result.finishReason !== "tool_calls" || !result.message.toolCalls?.length) {
      await db.from("messages").insert({ conversation_id: conversationId, sender: "ai", content: result.message.content });

      // Only cache plain knowledge-lookup answers — a reply that used tools
      // (booking, CRM lookups) is specific to this customer and must not be
      // replayed to someone else.
      if (isOpeningMessage && !usedTools) {
        const questionHash = await hashQuestion(customerMessage);
        await db.from("ai_response_cache").upsert(
          { question_hash: questionHash, question_text: customerMessage, reply: result.message.content, hits: 1, created_at: new Date().toISOString() },
          { onConflict: "question_hash" }
        );
      }

      await maybeSummarize(db, conversationId, conversation?.summary ?? null);

      const { data: fresh } = await db.from("conversations").select("needs_review").eq("id", conversationId).single();
      return { reply: result.message.content, needsReview: fresh?.needs_review ?? false };
    }

    usedTools = true;
    messages.push(result.message);

    for (const call of result.message.toolCalls) {
      const toolResult = await executeTool(call, db).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
      }));
      messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(toolResult) });
    }
  }

  await db.from("conversations").update({ needs_review: true }).eq("id", conversationId);
  const fallback = "Let me check with the team and get back to you shortly!";
  await db.from("messages").insert({ conversation_id: conversationId, sender: "ai", content: fallback });
  return { reply: fallback, needsReview: true };
}

/**
 * Summarize once a conversation outgrows the recent-message window sent to
 * the model, so older context is compressed rather than silently dropped.
 * Deliberately not incremental/rolling — it only fires the first time the
 * limit is exceeded, trading perfect freshness for a bounded number of
 * extra Gemini calls per conversation (see README AI Cost Optimization).
 */
async function maybeSummarize(db: SupabaseClient, conversationId: string, existingSummary: string | null): Promise<void> {
  if (existingSummary) return;

  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId);
  if ((count ?? 0) <= RECENT_MESSAGE_LIMIT) return;

  const { data: older } = await db
    .from("messages")
    .select("sender, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit((count ?? 0) - RECENT_MESSAGE_LIMIT);
  if (!older || older.length === 0) return;

  const transcript = older.map((m: { sender: string; content: string }) => `${m.sender}: ${m.content}`).join("\n");
  const result = await generate([
    {
      role: "system",
      content: "Summarize this customer conversation in 2-3 short sentences. Keep names, numbers, and commitments made. No preamble.",
    },
    { role: "user", content: transcript },
  ]);

  await db.from("conversations").update({ summary: result.message.content }).eq("id", conversationId);
}
