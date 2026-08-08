// OpenRouter (https://openrouter.ai) proxies dozens of model vendors behind
// one OpenAI-compatible /chat/completions endpoint and one prepaid balance —
// the owner tops up once instead of holding a separate paid account with
// Anthropic, OpenAI, xAI, Moonshot, Zhipu, Alibaba, and DeepSeek. Every
// non-Gemini chat model (TIGA AI AGENT's model switcher + Strategy Room)
// routes through here. Gemini stays on its own direct GEMINI_API_KEY
// connection deliberately (it's already connected, and it's also the only
// provider used for embeddings and Image Studio generation, neither of
// which OpenRouter offers) — as do the image/video generation providers in
// video-providers.ts (fal.ai, Runway), which are a separate concern from
// chat models and already connected on their own keys.

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function requireOpenRouterKey(): string {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY — ไปที่ openrouter.ai สร้าง API key แล้ววางใน Supabase Dashboard > Edge Functions > Secrets"
    );
  }
  return key;
}
