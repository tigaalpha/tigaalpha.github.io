import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate, type ChatMessage } from "./gemini.ts";
import { buildSystemPrompt, type PromptName } from "./prompts.ts";
import { AI_TOOLS, executeTool } from "./tools.ts";

const MAX_TOOL_ITERATIONS = 4;
const RECENT_MESSAGE_LIMIT = 12;

export interface RespondResult {
  reply: string;
  needsReview: boolean;
}

export async function respond(
  db: SupabaseClient,
  conversationId: string,
  customerMessage: string,
  promptContext: PromptName[] = ["sales", "booking", "knowledge", "customer_service"]
): Promise<RespondResult> {
  await db.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: customerMessage });

  const { data: history } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(RECENT_MESSAGE_LIMIT);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(promptContext) },
    ...(history ?? []).map((m: { sender: string; content: string }) => ({
      role: (m.sender === "customer" ? "user" : "assistant") as ChatMessage["role"],
      content: m.content,
    })),
  ];

  let iterations = 0;
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1;
    const result = await generate(messages, AI_TOOLS);

    if (result.finishReason !== "tool_calls" || !result.message.toolCalls?.length) {
      await db.from("messages").insert({ conversation_id: conversationId, sender: "ai", content: result.message.content });
      const { data: conversation } = await db.from("conversations").select("needs_review").eq("id", conversationId).single();
      return { reply: result.message.content, needsReview: conversation?.needs_review ?? false };
    }

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
