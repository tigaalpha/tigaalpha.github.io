export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present when role is "tool": which tool call this message answers. */
  toolCallId?: string;
  /** Present when role is "assistant" and it requested tool calls. */
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
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  message: ChatMessage;
  finishReason: "stop" | "tool_calls" | "length" | "error";
  usage?: { promptTokens: number; completionTokens: number };
}

/**
 * Business logic depends only on this interface — never on a specific
 * vendor SDK. Swapping AI_PROVIDER in the environment swaps the
 * implementation with no changes elsewhere.
 */
export interface AIProvider {
  generate(options: GenerateOptions): Promise<GenerateResult>;
  embed(text: string): Promise<number[]>;
}
