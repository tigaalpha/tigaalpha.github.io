// Mirrors CHAT_MODELS in supabase/functions/_shared/ai-provider.ts — Deno
// can't read this frontend file, so the list is duplicated. This is the
// model TIGA AI AGENT (and the rest of the assistant's chat/tool-calling —
// customer chat) actually calls, not the Strategy Room's side-by-side
// compare. Used by both the Settings > Integrations card and the Floating
// Assistant's inline model switcher.
//
// Every model but Gemini is reached through one OpenRouter connection (see
// supabase/functions/_shared/openrouter.ts) — statusKey/secretName/signupUrl
// are the same for all of them so the owner tops up once instead of hunting
// down a separate paid account per model vendor.

export interface ChatModelOption {
  id: string;
  label: string;
  statusKey: "gemini" | "openrouter";
  secretName: string;
  signupUrl: string;
}

const OPENROUTER_SIGNUP = { secretName: "OPENROUTER_API_KEY", signupUrl: "https://openrouter.ai/keys" } as const;

export const CHAT_MODELS: ChatModelOption[] = [
  { id: "gemini", label: "Gemini 2.0 Flash", statusKey: "gemini", secretName: "GEMINI_API_KEY", signupUrl: "https://aistudio.google.com/apikey" },
  { id: "claude", label: "Claude Sonnet 5", statusKey: "openrouter", ...OPENROUTER_SIGNUP },
  { id: "gpt", label: "ChatGPT 5.1", statusKey: "openrouter", ...OPENROUTER_SIGNUP },
  { id: "qwen", label: "Qwen3 Max", statusKey: "openrouter", ...OPENROUTER_SIGNUP },
  { id: "kimi", label: "Kimi K2", statusKey: "openrouter", ...OPENROUTER_SIGNUP },
  { id: "glm", label: "GLM 4.6", statusKey: "openrouter", ...OPENROUTER_SIGNUP },
  { id: "grok", label: "Grok", statusKey: "openrouter", ...OPENROUTER_SIGNUP },
  { id: "deepseek", label: "DeepSeek V4 Flash", statusKey: "openrouter", ...OPENROUTER_SIGNUP },
];

export const DEFAULT_CHAT_MODEL_ID = "gemini";

export function chatModelLabel(id: string): string {
  return CHAT_MODELS.find((m) => m.id === id)?.label ?? id;
}
