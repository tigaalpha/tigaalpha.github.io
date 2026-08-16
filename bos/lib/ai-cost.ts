// Per-model cost estimates (USD per 1M tokens) used to turn ai_usage_log
// token counts into a rough $ figure on the AI Cost page. Prices are
// approximate public list prices — providers change them frequently, so the
// dashboard is explicitly labeled an estimate. When a model's price moves,
// update the numbers here (and add entries for any new model slugs from
// supabase/functions/_shared/ai-provider.ts OPENROUTER_MODEL_SLUGS).
//
// `model` values come from ai-provider.ts modelLabel(): "gemini" or the
// OpenRouter slug (e.g. "anthropic/claude-sonnet-5").
export interface ModelCost {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPer1M: number;
  /** USD per 1,000,000 output (completion) tokens. */
  outputPer1M: number;
  label: string;
}

export const MODEL_COSTS: Record<string, ModelCost> = {
  gemini: { inputPer1M: 0.3, outputPer1M: 1.5, label: "Gemini 2.0 Flash" },
  "anthropic/claude-sonnet-5": { inputPer1M: 3, outputPer1M: 15, label: "Claude Sonnet 5" },
  "openai/gpt-5.1": { inputPer1M: 1.25, outputPer1M: 10, label: "ChatGPT 5.1" },
  "qwen/qwen3-max": { inputPer1M: 1.2, outputPer1M: 6, label: "Qwen3 Max" },
  "moonshotai/kimi-k2": { inputPer1M: 1, outputPer1M: 8, label: "Kimi K2" },
  "z-ai/glm-4.6": { inputPer1M: 1.5, outputPer1M: 5, label: "GLM 4.6" },
  "x-ai/grok-4": { inputPer1M: 3, outputPer1M: 15, label: "Grok" },
  "deepseek/deepseek-v4-flash": { inputPer1M: 0.27, outputPer1M: 1.1, label: "DeepSeek V4 Flash" },
};

/** Fallback for models without an entry — conservative mid-range estimate. */
export const UNKNOWN_MODEL_COST: ModelCost = { inputPer1M: 1, outputPer1M: 3, label: "Unknown model" };

export function modelCost(model: string): ModelCost {
  return MODEL_COSTS[model] ?? UNKNOWN_MODEL_COST;
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const cost = modelCost(model);
  return (promptTokens / 1_000_000) * cost.inputPer1M + (completionTokens / 1_000_000) * cost.outputPer1M;
}
