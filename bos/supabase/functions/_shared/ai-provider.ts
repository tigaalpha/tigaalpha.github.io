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

import { geminiProvider } from "./gemini.ts";
import type { AIProvider, ChatMessage, GeneratedImage, GenerateResult, ToolDefinition } from "./ai-types.ts";
import { generateOpenAICompatible } from "./openai-compatible.ts";
import { OPENROUTER_BASE_URL, requireOpenRouterKey } from "./openrouter.ts";
import { createAdminClient } from "./supabase-admin.ts";

export type { AIProvider, ChatMessage, ChatRole, GeneratedImage, GenerateResult, ToolCall, ToolDefinition } from "./ai-types.ts";

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

const CHAT_MODEL_SETTING_KEY = "ai_chat_model";
const DEFAULT_CHAT_MODEL: ChatModelId = "gemini";
const MODEL_CACHE_TTL_MS = 60_000;

let cachedModel: { value: ChatModelId; expiresAt: number } | null = null;

async function getActiveChatModel(): Promise<ChatModelId> {
  if (cachedModel && cachedModel.expiresAt > Date.now()) return cachedModel.value;

  const admin = createAdminClient();
  const { data } = await admin.from("integration_settings").select("value").eq("key", CHAT_MODEL_SETTING_KEY).maybeSingle();
  const raw = data?.value as ChatModelId | undefined;
  const value = raw && CHAT_MODELS.some((m) => m.id === raw) ? raw : DEFAULT_CHAT_MODEL;

  cachedModel = { value, expiresAt: Date.now() + MODEL_CACHE_TTL_MS };
  return value;
}

async function generateWithModel(
  modelId: ChatModelId,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  temperature?: number,
  maxOutputTokens?: number
): Promise<GenerateResult> {
  if (modelId === "gemini") return geminiProvider.generate(messages, tools, temperature, maxOutputTokens);

  const apiKey = requireOpenRouterKey();
  const { envVar, slug } = OPENROUTER_MODEL_SLUGS[modelId];
  const model = Deno.env.get(envVar) ?? slug;
  return generateOpenAICompatible({ baseUrl: OPENROUTER_BASE_URL, apiKey, model }, messages, tools, maxOutputTokens, temperature);
}

export async function generate(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  temperature?: number,
  maxOutputTokens?: number
): Promise<GenerateResult> {
  const modelId = await getActiveChatModel();
  return generateWithModel(modelId, messages, tools, temperature, maxOutputTokens);
}

export function embed(text: string): Promise<number[]> {
  return geminiProvider.embed(text);
}

export function generateImage(prompt: string, referenceImage?: { mimeType: string; base64: string }): Promise<GeneratedImage> {
  return geminiProvider.generateImage(prompt, referenceImage);
}
