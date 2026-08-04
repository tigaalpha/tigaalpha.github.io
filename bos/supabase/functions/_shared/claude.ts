// Anthropic Messages API adapter — the one Strategy Room provider that
// doesn't speak the OpenAI-compatible /chat/completions shape (separate
// system field, x-api-key header, different response envelope).

import type { SimpleChatMessage } from "./openai-compatible.ts";
import type { ChatMessage, GenerateResult, ToolDefinition } from "./ai-types.ts";

const BASE_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export async function callClaude(apiKey: string, model: string, messages: SimpleChatMessage[]): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      system: system || undefined,
      messages: conversation,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic API returned no text content");
  return text;
}

interface ClaudeContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

// Anthropic requires strictly alternating user/assistant turns, so every
// tool-result ChatMessage that follows an assistant's tool_use turn must be
// merged into a single user turn (one tool_result block per call) rather
// than emitted as separate consecutive messages the way OpenAI allows.
function toClaudeMessages(messages: ChatMessage[]): { role: "user" | "assistant"; content: ClaudeContentBlock[] }[] {
  const out: { role: "user" | "assistant"; content: ClaudeContentBlock[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "tool") {
      const block: ClaudeContentBlock = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const last = out[out.length - 1];
      if (last && last.role === "user") last.content.push(block);
      else out.push({ role: "user", content: [block] });
      continue;
    }

    if (m.role === "assistant") {
      const content: ClaudeContentBlock[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const call of m.toolCalls ?? []) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
      }
      out.push({ role: "assistant", content });
      continue;
    }

    out.push({ role: "user", content: [{ type: "text", text: m.content }] });
  }
  return out;
}

// Full tool-calling completion — used by TIGA AI AGENT (chat-core.ts) via
// ai-provider.ts's swappable generate().
export async function generateClaudeChat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  maxOutputTokens = 1024,
  temperature = 0.6
): Promise<GenerateResult> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");

  const body: Record<string, unknown> = {
    model,
    system: system || undefined,
    messages: toClaudeMessages(messages),
    max_tokens: maxOutputTokens,
    temperature,
  };
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  }

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Anthropic API returned ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = (await response.json()) as { content?: ClaudeContentBlock[]; stop_reason?: string };
  const blocks = data.content ?? [];
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const toolCalls = blocks
    .filter((b): b is ClaudeContentBlock & { id: string; name: string } => b.type === "tool_use" && Boolean(b.id) && Boolean(b.name))
    .map((b) => ({ id: b.id, name: b.name, arguments: b.input ?? {} }));

  return {
    message: { role: "assistant", content: text, toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
    finishReason: toolCalls.length > 0 ? "tool_calls" : data.stop_reason === "max_tokens" ? "length" : "stop",
  };
}
