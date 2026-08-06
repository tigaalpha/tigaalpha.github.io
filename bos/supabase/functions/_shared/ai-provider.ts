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
import { generateClaudeChat } from "./claude.ts";
import { createAdminClient } from "./supabase-admin.ts";

export type { AIProvider, ChatMessage, ChatRole, GeneratedImage, GenerateResult, ToolCall, ToolDefinition } from "./ai-types.ts";

export type ChatModelId = "gemini" | "claude" | "gpt" | "qwen" | "kimi" | "glm" | "grok";

export interface ChatModelDef {
  id: ChatModelId;
  label: string;
  envKey: string;
}

// Model name defaults are env-overridable (e.g. ANTHROPIC_CHAT_MODEL) since
// providers rev their flagship model names often -- update the Supabase
// secret rather than requiring a redeploy when a provider ships a new one.
export const CHAT_MODELS: ChatModelDef[] = [
  { id: "gemini", label: "Gemini 2.0 Flash", envKey: "GEMINI_API_KEY" },
  { id: "claude", label: "Claude Sonnet 5", envKey: "ANTHROPIC_API_KEY" },
  { id: "gpt", label: "ChatGPT 5.1", envKey: "OPENAI_API_KEY" },
  { id: "qwen", label: "Qwen3.5 Max", envKey: "DASHSCOPE_API_KEY" },
  { id: "kimi", label: "Kimi K2", envKey: "MOONSHOT_API_KEY" },
  { id: "glm", label: "GLM 5.2", envKey: "ZHIPU_API_KEY" },
  { id: "grok", label: "Grok (ฟรี)", envKey: "XAI_API_KEY" },
];

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

function requireKey(envKey: string): string {
  const value = Deno.env.get(envKey);
  if (!value) throw new Error(`${envKey} is not configured in Supabase secrets.`);
  return value;
}

async function generateWithModel(
  modelId: ChatModelId,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  temperature?: number,
  maxOutputTokens?: number
): Promise<GenerateResult> {
  switch (modelId) {
    case "gemini":
      return geminiProvider.generate(messages, tools, temperature, maxOutputTokens);
    case "claude": {
      const apiKey = requireKey("ANTHROPIC_API_KEY");
      const model = Deno.env.get("ANTHROPIC_CHAT_MODEL") ?? "claude-sonnet-5";
      return generateClaudeChat(apiKey, model, messages, tools, maxOutputTokens, temperature);
    }
    case "gpt": {
      const apiKey = requireKey("OPENAI_API_KEY");
      const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
      const model = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5.1";
      return generateOpenAICompatible({ baseUrl, apiKey, model }, messages, tools, maxOutputTokens, temperature);
    }
    case "qwen": {
      const apiKey = requireKey("DASHSCOPE_API_KEY");
      const baseUrl = Deno.env.get("DASHSCOPE_BASE_URL") ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
      const model = Deno.env.get("DASHSCOPE_CHAT_MODEL") ?? "qwen3.5-max";
      return generateOpenAICompatible({ baseUrl, apiKey, model }, messages, tools, maxOutputTokens, temperature);
    }
    case "kimi": {
      const apiKey = requireKey("MOONSHOT_API_KEY");
      const baseUrl = Deno.env.get("MOONSHOT_BASE_URL") ?? "https://api.moonshot.ai/v1";
      const model = Deno.env.get("MOONSHOT_CHAT_MODEL") ?? "kimi-k2-0905-preview";
      return generateOpenAICompatible({ baseUrl, apiKey, model }, messages, tools, maxOutputTokens, temperature);
    }
    case "glm": {
      const apiKey = requireKey("ZHIPU_API_KEY");
      const baseUrl = Deno.env.get("ZHIPU_BASE_URL") ?? "https://api.z.ai/api/paas/v4";
      const model = Deno.env.get("ZHIPU_CHAT_MODEL") ?? "glm-5.2";
      return generateOpenAICompatible({ baseUrl, apiKey, model }, messages, tools, maxOutputTokens, temperature);
    }
    case "grok": {
      const apiKey = requireKey("XAI_API_KEY");
      const baseUrl = Deno.env.get("XAI_BASE_URL") ?? "https://api.x.ai/v1";
      const model = Deno.env.get("XAI_CHAT_MODEL") ?? "grok-4-fast-free";
      return generateOpenAICompatible({ baseUrl, apiKey, model }, messages, tools, maxOutputTokens, temperature);
    }
  }
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
