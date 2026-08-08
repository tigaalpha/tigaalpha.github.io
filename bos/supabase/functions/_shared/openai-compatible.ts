// Generic adapter for any provider that ships an OpenAI-compatible
// /chat/completions endpoint — covers GPT (OpenAI), Grok (xAI), Qwen
// (Alibaba DashScope), DeepSeek, Kimi (Moonshot), and GLM (Zhipu/Z.ai) with
// the same request/response shape, differing only in base URL / API key /
// model name.

import type { ChatMessage, GenerateResult, ToolDefinition } from "./ai-types.ts";

export interface SimpleChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface SimpleCompletionResult {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

// Plain text completion, no tool calling — used by the Strategy Room, which
// only needs a single free-text answer per advisor.
export async function callOpenAICompatible(config: OpenAICompatibleConfig, messages: SimpleChatMessage[]): Promise<SimpleCompletionResult> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${config.baseUrl} returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.baseUrl} returned no completion content`);
  return { content, usage: data.usage ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 } : undefined };
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_call_id: m.toolCallId ?? "" };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

// Full tool-calling completion — used by TIGA AI AGENT (chat-core.ts) via
// ai-provider.ts's swappable generate(), same request shape as
// callOpenAICompatible plus the standard OpenAI `tools`/`tool_calls` fields
// that every provider registered in ai-provider.ts's CHAT_MODELS also speaks.
export async function generateOpenAICompatible(
  config: OpenAICompatibleConfig,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  maxOutputTokens = 1024,
  temperature = 0.6
): Promise<GenerateResult> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: toOpenAIMessages(messages),
    temperature,
    max_tokens: maxOutputTokens,
  };
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`${config.baseUrl} returned ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: OpenAIToolCall[] }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  const message = choice?.message;
  const toolCalls = (message?.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
  }));

  return {
    message: { role: "assistant", content: message?.content ?? "", toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
    finishReason: toolCalls.length > 0 ? "tool_calls" : choice?.finish_reason === "length" ? "length" : "stop",
    usage: data.usage ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 } : undefined,
  };
}
