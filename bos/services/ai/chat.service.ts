import "server-only";
import type { AIProvider, ChatMessage } from "@/types/ai";
import type { Repositories } from "@/services/repositories";
import type { BookingService } from "@/services/business/booking.service";
import type { CalendarService } from "@/services/google/calendar.service";
import { RagService } from "@/services/ai/rag";
import { MemoryService } from "@/services/ai/memory";
import { buildSystemPrompt, type PromptName } from "@/services/ai/prompts";
import { AI_TOOLS, executeTool } from "@/services/ai/tools";

const MAX_TOOL_ITERATIONS = 4;

export interface RespondInput {
  conversationId: string;
  customerMessage: string;
  promptContext?: PromptName[];
}

export interface RespondResult {
  reply: string;
  needsReview: boolean;
}

/**
 * Orchestrates a single AI turn: load prompts + memory, call the provider,
 * execute any requested tools, and loop until the model produces a final
 * reply (or MAX_TOOL_ITERATIONS is hit, in which case we fail safe to a
 * human handoff rather than looping forever).
 */
export class ChatService {
  private readonly rag: RagService;
  private readonly memory: MemoryService;

  constructor(
    private readonly ai: AIProvider,
    private readonly repos: Repositories,
    private readonly booking: BookingService,
    private readonly calendar: CalendarService
  ) {
    this.rag = new RagService(ai, repos.knowledge);
    this.memory = new MemoryService(ai, repos.conversations);
  }

  async respond(input: RespondInput): Promise<RespondResult> {
    await this.repos.conversations.addMessage(input.conversationId, "customer", input.customerMessage);

    const systemPrompt = await buildSystemPrompt(input.promptContext ?? ["sales", "booking", "knowledge", "customer_service"]);
    const history = await this.memory.buildContext(input.conversationId);

    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...history];

    let iterations = 0;
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations += 1;
      const result = await this.ai.generate({ messages, tools: AI_TOOLS });

      if (result.finishReason !== "tool_calls" || !result.message.toolCalls?.length) {
        await this.repos.conversations.addMessage(input.conversationId, "ai", result.message.content);
        const conversation = await this.getConversationReviewState(input.conversationId);
        return { reply: result.message.content, needsReview: conversation };
      }

      messages.push(result.message);

      for (const call of result.message.toolCalls) {
        const toolResult = await executeTool(call, {
          repos: this.repos,
          booking: this.booking,
          calendar: this.calendar,
          rag: this.rag,
        }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));

        messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(toolResult) });
      }
    }

    await this.repos.conversations.setNeedsReview(input.conversationId, true);
    const fallback = "Let me check with the team and get back to you shortly!";
    await this.repos.conversations.addMessage(input.conversationId, "ai", fallback);
    return { reply: fallback, needsReview: true };
  }

  private async getConversationReviewState(conversationId: string): Promise<boolean> {
    const conversations = await this.repos.conversations.listNeedingReview();
    return conversations.some((c) => c.id === conversationId);
  }
}
