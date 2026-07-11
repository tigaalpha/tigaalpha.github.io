// Provider-agnostic types shared by every AI provider implementation and by
// the business logic that calls them (chat-core.ts, tools.ts). Nothing in
// here may reference a specific vendor.

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GenerateResult {
  message: ChatMessage;
  finishReason: "stop" | "tool_calls" | "length" | "error";
}

/** Implemented once per vendor (Gemini today; swap in OpenAI/Claude/etc without touching business logic). */
export interface AIProvider {
  generate(messages: ChatMessage[], tools?: ToolDefinition[], temperature?: number, maxOutputTokens?: number): Promise<GenerateResult>;
  embed(text: string): Promise<number[]>;
}
