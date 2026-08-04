// Anthropic Messages API adapter — the one Strategy Room provider that
// doesn't speak the OpenAI-compatible /chat/completions shape (separate
// system field, x-api-key header, different response envelope).

import type { SimpleChatMessage } from "./openai-compatible.ts";

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
