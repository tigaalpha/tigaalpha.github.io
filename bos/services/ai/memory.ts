import "server-only";
import type { AIProvider, ChatMessage } from "@/types/ai";
import type { ConversationsRepository } from "@/services/repositories/conversations.repository";

const RECENT_MESSAGE_LIMIT = 12;
const SUMMARIZE_THRESHOLD = 24;

/**
 * Conversation memory: keeps the AI's context window small (cost
 * optimization step "Summarize Long Chats" + "Limit Context" in the PRD) by
 * summarizing older turns instead of replaying the full transcript.
 */
export class MemoryService {
  constructor(private readonly ai: AIProvider, private readonly conversations: ConversationsRepository) {}

  async buildContext(conversationId: string): Promise<ChatMessage[]> {
    const messages = await this.conversations.listMessages(conversationId, SUMMARIZE_THRESHOLD + RECENT_MESSAGE_LIMIT);

    if (messages.length <= RECENT_MESSAGE_LIMIT) {
      return messages.map((m) => ({
        role: m.sender === "customer" ? "user" : "assistant",
        content: m.content,
      }));
    }

    const older = messages.slice(0, messages.length - RECENT_MESSAGE_LIMIT);
    const recent = messages.slice(messages.length - RECENT_MESSAGE_LIMIT);

    const summary = await this.summarize(older.map((m) => `${m.sender}: ${m.content}`).join("\n"));
    await this.conversations.setSummary(conversationId, summary);

    return [
      { role: "system", content: `Conversation summary so far:\n${summary}` },
      ...recent.map((m) => ({
        role: (m.sender === "customer" ? "user" : "assistant") as ChatMessage["role"],
        content: m.content,
      })),
    ];
  }

  private async summarize(transcript: string): Promise<string> {
    const result = await this.ai.generate({
      messages: [
        {
          role: "system",
          content: "Summarize this customer service conversation in 3-5 bullet points: key facts, decisions made, and open questions. Be concise.",
        },
        { role: "user", content: transcript },
      ],
      temperature: 0.2,
      maxOutputTokens: 300,
    });

    return result.message.content;
  }
}
