// Model registry for the Strategy Room. Every model beyond Gemini goes
// through OpenRouter (one key, one prepaid balance -- see openrouter.ts) so
// availableStrategyModels() just needs to know whether OPENROUTER_API_KEY is
// set, not track seven separate vendor keys. Model slugs are env-overridable
// since providers rev their flagship model names often; the defaults here
// are best-effort and meant to be updated in Supabase secrets rather than
// requiring a redeploy when a provider ships a new model.

import { geminiProvider } from "./gemini.ts";
import { callOpenAICompatible, type SimpleChatMessage } from "./openai-compatible.ts";
import { OPENROUTER_BASE_URL, requireOpenRouterKey } from "./openrouter.ts";

export type StrategyModelId = "gemini" | "claude" | "gpt" | "grok" | "deepseek" | "kimi" | "glm";

export interface StrategyModelDef {
  id: StrategyModelId;
  label: string;
  envKey: string;
}

export const STRATEGY_MODELS: StrategyModelDef[] = [
  { id: "gemini", label: "Gemini", envKey: "GEMINI_API_KEY" },
  { id: "claude", label: "Claude (Anthropic)", envKey: "OPENROUTER_API_KEY" },
  { id: "gpt", label: "GPT (OpenAI)", envKey: "OPENROUTER_API_KEY" },
  { id: "grok", label: "Grok (xAI)", envKey: "OPENROUTER_API_KEY" },
  { id: "deepseek", label: "DeepSeek", envKey: "OPENROUTER_API_KEY" },
  { id: "kimi", label: "Kimi (Moonshot AI)", envKey: "OPENROUTER_API_KEY" },
  { id: "glm", label: "GLM (Zhipu / Z.ai)", envKey: "OPENROUTER_API_KEY" },
];

// One slug per model, all reached through the same OpenRouter connection.
const OPENROUTER_MODEL_SLUGS: Record<Exclude<StrategyModelId, "gemini">, { envVar: string; slug: string }> = {
  claude: { envVar: "ANTHROPIC_STRATEGY_MODEL", slug: "anthropic/claude-opus-5" },
  gpt: { envVar: "OPENAI_STRATEGY_MODEL", slug: "openai/gpt-5.1" },
  grok: { envVar: "XAI_STRATEGY_MODEL", slug: "x-ai/grok-4" },
  deepseek: { envVar: "DEEPSEEK_STRATEGY_MODEL", slug: "deepseek/deepseek-chat" },
  kimi: { envVar: "MOONSHOT_STRATEGY_MODEL", slug: "moonshotai/kimi-k2" },
  glm: { envVar: "ZHIPU_STRATEGY_MODEL", slug: "z-ai/glm-4.6" },
};

export function availableStrategyModels(): StrategyModelDef[] {
  return STRATEGY_MODELS.filter((m) => Boolean(Deno.env.get(m.envKey)));
}

export async function callStrategyModel(modelId: StrategyModelId, messages: SimpleChatMessage[]): Promise<string> {
  if (modelId === "gemini") {
    // Pinned to the raw Gemini provider (not ai-provider.ts's swappable
    // generate()) so the "Gemini" advisor in this side-by-side comparison
    // always means Gemini, regardless of what TIGA AI AGENT's chat model is
    // currently set to in Settings.
    const result = await geminiProvider.generate(messages, undefined, 0.7, 2048);
    return result.message.content;
  }

  const apiKey = requireOpenRouterKey();
  const { envVar, slug } = OPENROUTER_MODEL_SLUGS[modelId];
  const model = Deno.env.get(envVar) ?? slug;
  return callOpenAICompatible({ baseUrl: OPENROUTER_BASE_URL, apiKey, model }, messages);
}
