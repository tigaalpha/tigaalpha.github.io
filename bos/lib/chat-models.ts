// Mirrors CHAT_MODELS in supabase/functions/_shared/ai-provider.ts — Deno
// can't read this frontend file, so the list is duplicated. This is the
// model TIGA AI AGENT (and the rest of the assistant's chat/tool-calling —
// customer chat) actually calls, not the Strategy Room's side-by-side
// compare. Used by both the Settings > Integrations card and the Floating
// Assistant's inline model switcher.

export interface ChatModelOption {
  id: string;
  label: string;
  statusKey: "gemini" | "claude" | "gpt" | "qwen" | "kimi" | "glm" | "grok";
  secretName: string;
  signupUrl: string;
}

export const CHAT_MODELS: ChatModelOption[] = [
  { id: "gemini", label: "Gemini 2.0 Flash", statusKey: "gemini", secretName: "GEMINI_API_KEY", signupUrl: "https://aistudio.google.com/apikey" },
  { id: "claude", label: "Claude Sonnet 5", statusKey: "claude", secretName: "ANTHROPIC_API_KEY", signupUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gpt", label: "ChatGPT 5.1", statusKey: "gpt", secretName: "OPENAI_API_KEY", signupUrl: "https://platform.openai.com/api-keys" },
  { id: "qwen", label: "Qwen3.5 Max", statusKey: "qwen", secretName: "DASHSCOPE_API_KEY", signupUrl: "https://bailian.console.alibabacloud.com/" },
  { id: "kimi", label: "Kimi K2", statusKey: "kimi", secretName: "MOONSHOT_API_KEY", signupUrl: "https://platform.moonshot.ai/console/api-keys" },
  { id: "glm", label: "GLM 5.2", statusKey: "glm", secretName: "ZHIPU_API_KEY", signupUrl: "https://open.bigmodel.cn/usercenter/apikeys" },
  { id: "grok", label: "Grok (ฟรี)", statusKey: "grok", secretName: "XAI_API_KEY", signupUrl: "https://console.x.ai" },
];

export const DEFAULT_CHAT_MODEL_ID = "gemini";

export function chatModelLabel(id: string): string {
  return CHAT_MODELS.find((m) => m.id === id)?.label ?? id;
}
