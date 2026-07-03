import "server-only";
import type { AIProvider } from "@/types/ai";
import { env } from "@/lib/env";
import { GeminiProvider } from "./gemini";

let cachedProvider: AIProvider | null = null;

/**
 * Returns the configured AI provider. Business logic must always go through
 * this factory (and the AIProvider interface) — never import GeminiProvider
 * or any vendor SDK directly outside this file.
 */
export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = env.ai.provider();

  switch (providerName) {
    case "gemini":
      cachedProvider = new GeminiProvider();
      return cachedProvider;
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${providerName}`);
  }
}
