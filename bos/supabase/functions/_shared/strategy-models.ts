// Model registry for the Strategy Room. Every model beyond Gemini needs its
// own API key (Supabase secret) before it's usable -- availableStrategyModels()
// tells the frontend which ones are actually connected. Model IDs/base URLs
// are env-overridable since frontier providers rev their flagship model
// names often; the defaults here are best-effort and meant to be updated in
// Supabase secrets rather than requiring a redeploy when a provider ships a
// new model.

import { geminiProvider } from "./gemini.ts";
import { callOpenAICompatible, type SimpleChatMessage } from "./openai-compatible.ts";
import { callClaude } from "./claude.ts";

export type StrategyModelId = "gemini" | "claude" | "gpt" | "grok" | "deepseek" | "kimi" | "glm";

export interface StrategyModelDef {
  id: StrategyModelId;
  label: string;
  envKey: string;
}

export const STRATEGY_MODELS: StrategyModelDef[] = [
  { id: "gemini", label: "Gemini", envKey: "GEMINI_API_KEY" },
  { id: "claude", label: "Claude (Anthropic)", envKey: "ANTHROPIC_API_KEY" },
  { id: "gpt", label: "GPT (OpenAI)", envKey: "OPENAI_API_KEY" },
  { id: "grok", label: "Grok (xAI)", envKey: "XAI_API_KEY" },
  { id: "deepseek", label: "DeepSeek", envKey: "DEEPSEEK_API_KEY" },
  { id: "kimi", label: "Kimi (Moonshot AI)", envKey: "MOONSHOT_API_KEY" },
  { id: "glm", label: "GLM (Zhipu / Z.ai)", envKey: "ZHIPU_API_KEY" },
];

export function availableStrategyModels(): StrategyModelDef[] {
  return STRATEGY_MODELS.filter((m) => Boolean(Deno.env.get(m.envKey)));
}

function requireKey(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured in Supabase secrets.`);
  return value;
}

export async function callStrategyModel(modelId: StrategyModelId, messages: SimpleChatMessage[]): Promise<string> {
  switch (modelId) {
    case "gemini": {
      // Pinned to the raw Gemini provider (not ai-provider.ts's swappable
      // generate()) so the "Gemini" advisor in this side-by-side comparison
      // always means Gemini, regardless of what TIGA AI AGENT's chat model
      // is currently set to in Settings.
      const result = await geminiProvider.generate(messages, undefined, 0.7, 2048);
      return result.message.content;
    }
    case "claude": {
      const apiKey = requireKey("ANTHROPIC_API_KEY");
      const model = Deno.env.get("ANTHROPIC_STRATEGY_MODEL") ?? "claude-opus-5";
      return callClaude(apiKey, model, messages);
    }
    case "gpt": {
      const apiKey = requireKey("OPENAI_API_KEY");
      const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
      const model = Deno.env.get("OPENAI_STRATEGY_MODEL") ?? "gpt-5.1";
      return callOpenAICompatible({ baseUrl, apiKey, model }, messages);
    }
    case "grok": {
      const apiKey = requireKey("XAI_API_KEY");
      const baseUrl = Deno.env.get("XAI_BASE_URL") ?? "https://api.x.ai/v1";
      const model = Deno.env.get("XAI_STRATEGY_MODEL") ?? "grok-4";
      return callOpenAICompatible({ baseUrl, apiKey, model }, messages);
    }
    case "deepseek": {
      const apiKey = requireKey("DEEPSEEK_API_KEY");
      const baseUrl = Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com/v1";
      const model = Deno.env.get("DEEPSEEK_STRATEGY_MODEL") ?? "deepseek-chat";
      return callOpenAICompatible({ baseUrl, apiKey, model }, messages);
    }
    case "kimi": {
      const apiKey = requireKey("MOONSHOT_API_KEY");
      const baseUrl = Deno.env.get("MOONSHOT_BASE_URL") ?? "https://api.moonshot.ai/v1";
      const model = Deno.env.get("MOONSHOT_STRATEGY_MODEL") ?? "moonshot-v1-8k";
      return callOpenAICompatible({ baseUrl, apiKey, model }, messages);
    }
    case "glm": {
      const apiKey = requireKey("ZHIPU_API_KEY");
      const baseUrl = Deno.env.get("ZHIPU_BASE_URL") ?? "https://api.z.ai/api/paas/v4";
      const model = Deno.env.get("ZHIPU_STRATEGY_MODEL") ?? "glm-5.2";
      return callOpenAICompatible({ baseUrl, apiKey, model }, messages);
    }
    default: {
      const exhaustive: never = modelId;
      throw new Error(`Unknown strategy model: ${exhaustive}`);
    }
  }
}
