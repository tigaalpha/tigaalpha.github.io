// Business logic (chat-core.ts, tools.ts, content-generation edge functions)
// imports generate/embed/generateImage from here, never from a
// vendor-specific file. Which vendor generate() actually calls is picked at
// runtime from the "ai_chat_model" integration_settings row (set from
// Settings > Integrations > TIGA AI Agent Model) -- this is what lets the
// owner switch models for the whole assistant without a redeploy.
// embed()/generateImage() stay pinned to Gemini regardless of that setting:
// knowledge_chunks.embedding is a fixed-dimension pgvector column tied to
// Gemini's embedding model, and image generation is a separate Gemini-only
// capability (Image Studio), not part of what "chat model" means here.
//
// Cost tiers (see model-tiers.ts): generate() takes a `tier` argument so
// high-volume customer chat can run on a cheap model while agent strategy
// and content generation use their own configured models. Each tier falls
// back to the legacy ai_chat_model master, then to Gemini.

import { geminiProvider } from "./gemini.ts";
import type { AIProvider, ChatMessage, GeneratedImage, GenerateResult, ToolDefinition } from "./ai-types.ts";
import { generateOpenAICompatible } from "./openai-compatible.ts";
import { OPENROUTER_BASE_URL, requireOpenRouterKey } from "./openrouter.ts";
import { createAdminClient } from "./supabase-admin.ts";
import { MASTER_MODEL_SETTING_KEY, MODEL_TIER_SETTING_KEYS, resolveTierModelId, type ModelTier } from "./model-tiers.ts";

export type { AIProvider, ChatMessage, ChatRole, GeneratedImage, GenerateResult, ToolCall, ToolDefinition } from "./ai-types.ts";
export type { ModelTier } from "./model-tiers.ts";

export type ChatModelId = "gemini" | "claude" | "gpt" | "qwen" | "kimi" | "glm" | "grok" | "deepseek";

export interface ChatModelDef {
  id: ChatModelId;
  label: string;
  envKey: string;
}

// Every model but Gemini is reached through OpenRouter now (one key, one
// prepaid balance) -- see openrouter.ts for why.
export const CHAT_MODELS: ChatModelDef[] = [
  { id: "gemini", label: "Gemini 2.0 Flash", envKey: "GEMINI_API_KEY" },
  { id: "claude", label: "Claude Sonnet 5", envKey: "OPENROUTER_API_KEY" },
  { id: "gpt", label: "ChatGPT 5.1", envKey: "OPENROUTER_API_KEY" },
  { id: "qwen", label: "Qwen3 Max", envKey: "OPENROUTER_API_KEY" },
  { id: "kimi", label: "Kimi K2", envKey: "OPENROUTER_API_KEY" },
  { id: "glm", label: "GLM 4.6", envKey: "OPENROUTER_API_KEY" },
  { id: "grok", label: "Grok", envKey: "OPENROUTER_API_KEY" },
  { id: "deepseek", label: "DeepSeek V4 Flash", envKey: "OPENROUTER_API_KEY" },
];

// OpenRouter model slugs, one env var per model so the owner can repoint a
// slug (e.g. when a provider ships a new flagship) via Supabase secrets
// without a redeploy -- same escape hatch these vars already offered when
// they held each vendor's native model name.
const OPENROUTER_MODEL_SLUGS: Record<Exclude<ChatModelId, "gemini">, { envVar: string; slug: string }> = {
  claude: { envVar: "ANTHROPIC_CHAT_MODEL", slug: "anthropic/claude-sonnet-5" },
  gpt: { envVar: "OPENAI_CHAT_MODEL", slug: "openai/gpt-5.1" },
  qwen: { envVar: "DASHSCOPE_CHAT_MODEL", slug: "qwen/qwen3-max" },
  kimi: { envVar: "MOONSHOT_CHAT_MODEL", slug: "moonshotai/kimi-k2" },
  glm: { envVar: "ZHIPU_CHAT_MODEL", slug: "z-ai/glm-4.6" },
  grok: { envVar: "XAI_CHAT_MODEL", slug: "x-ai/grok-4" },
  deepseek: { envVar: "DEEPSEEK_CHAT_MODEL", slug: "deepseek/deepseek-v4-flash" },
};

const DEFAULT_CHAT_MODEL: ChatModelId = "gemini";
const MODEL_CACHE_TTL_MS = 60_000;

interface ModelCacheEntry {
  value: ChatModelId | null;
  expiresAt: number;
}

let cachedMaster: ModelCacheEntry | null = null;
const cachedTiers: Partial<Record<ModelTier, ModelCacheEntry>> = {};

async function readModelSetting(key: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("integration_settings").select("value").eq("key", key).maybeSingle();
  return typeof data?.value === "string" ? data.value : null;
}

function isValidModelId(raw: string | null | undefined): raw is ChatModelId {
  return Boolean(raw && CHAT_MODELS.some((m) => m.id === raw));
}

async function getActiveChatModel(): Promise<ChatModelId> {
  if (cachedMaster && cachedMaster.expiresAt > Date.now() && cachedMaster.value) return cachedMaster.value;
  const raw = await readModelSetting(MASTER_MODEL_SETTING_KEY);
  const value = isValidModelId(raw) ? raw : DEFAULT_CHAT_MODEL;
  cachedMaster = { value, expiresAt: Date.now() + MODEL_CACHE_TTL_MS };
  return value;
}

// Per-tier model with a fallback chain: ai_model_<tier> -> ai_chat_model
// (master) -> gemini. Results are cached 60s like the master lookup so a
// busy chat doesn't hammer integration_settings on every message.
async function getTierModel(tier: ModelTier): Promise<ChatModelId> {
  const cached = cachedTiers[tier];
  if (cached && cached.expiresAt > Date.now()) return cached.value as ChatModelId;
  const [tierValue, masterValue] = await Promise.all([
    readModelSetting(MODEL_TIER_SETTING_KEYS[tier]),
    readModelSetting(MASTER_MODEL_SETTING_KEY),
  ]);
  const resolved = resolveTierModelId(tier, { tierValue, masterValue }, CHAT_MODELS.map((m) => m.id), DEFAULT_CHAT_MODEL);
  cachedTiers[tier] = { value: resolved as ChatModelId, expiresAt: Date.now() + MODEL_CACHE_TTL_MS };
  return resolved as ChatModelId;
}

// Human-readable model name recorded in ai_usage_log.model so the cost
// dashboard can break spend down by actual model, not just "unknown".
export function modelLabel(modelId: ChatModelId): string {
  if (modelId === "gemini") return "gemini";
  return OPENROUTER_MODEL_SLUGS[modelId].slug;
}

async function generateWithModel(
  modelId: ChatModelId,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  temperature?: number,
  maxOutputTokens?: number
): Promise<GenerateResult> {
  let result: GenerateResult;
  if (modelId === "gemini") {
    result = await geminiProvider.generate(messages, tools, temperature, maxOutputTokens);
  } else {
    const apiKey = requireOpenRouterKey();
    const { envVar, slug } = OPENROUTER_MODEL_SLUGS[modelId];
    const model = Deno.env.get(envVar) ?? slug;
    result = await generateOpenAICompatible({ baseUrl: OPENROUTER_BASE_URL, apiKey, model }, messages, tools, maxOutputTokens, temperature);
  }
  // Stamp which model actually produced this result so every logAiUsage
  // caller gets a real per-model cost line without changing their call.
  if (result.usage) result.usage.model = modelLabel(modelId);
  return result;
}

export async function generate(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  temperature?: number,
  maxOutputTokens?: number,
  tier: ModelTier = "chat"
): Promise<GenerateResult> {
  const modelId = tier === "chat" ? await getActiveChatModel() : await getTierModel(tier);
  return generateWithModel(modelId, messages, tools, temperature, maxOutputTokens);
}

export function embed(text: string): Promise<number[]> {
  return geminiProvider.embed(text);
}

export function generateImage(prompt: string, referenceImage?: { mimeType: string; base64: string }): Promise<GeneratedImage> {
  return geminiProvider.generateImage(prompt, referenceImage);
}
