// Business logic (chat-core.ts, tools.ts) imports generate/embed from here,
// never from a vendor-specific file — swapping AI vendors is an env var
// change (AI_PROVIDER), not a code change.

import { geminiProvider } from "./gemini.ts";
import type { AIProvider, ChatMessage, GeneratedImage, GenerateResult, ToolDefinition } from "./ai-types.ts";

export type { AIProvider, ChatMessage, ChatRole, GeneratedImage, GenerateResult, ToolCall, ToolDefinition } from "./ai-types.ts";

const PROVIDERS: Record<string, AIProvider> = {
  gemini: geminiProvider,
};

function getProvider(): AIProvider {
  const name = Deno.env.get("AI_PROVIDER") ?? "gemini";
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown AI_PROVIDER "${name}" — available: ${Object.keys(PROVIDERS).join(", ")}`);
  return provider;
}

export function generate(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  temperature?: number,
  maxOutputTokens?: number
): Promise<GenerateResult> {
  return getProvider().generate(messages, tools, temperature, maxOutputTokens);
}

export function embed(text: string): Promise<number[]> {
  return getProvider().embed(text);
}

export function generateImage(prompt: string): Promise<GeneratedImage> {
  return getProvider().generateImage(prompt);
}
