// Thin Gemini REST wrapper (Deno-compatible, no SDK). This is the only file
// that knows Gemini's request/response shape — everything else talks to the
// AIProvider interface in ai-provider.ts.

import type { AIProvider, ChatMessage, GenerateResult, ToolDefinition } from "./ai-types.ts";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown>; thoughtSignature?: string };
  functionResponse?: { name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function apiKey(): string {
  return Deno.env.get("GEMINI_API_KEY")!;
}

// The friendly-message wrapper below only changes *what the user sees* on
// failure — it does nothing for *whether the request actually succeeds*.
// 429 (per-minute quota) and 5xx are frequently transient; a bare fetch
// with no retry means every one of those blips hard-fails the whole
// feature (chat reply, article/video/voiceover draft, embedding) even
// though the exact same request would likely succeed a second later.
// Capped at 2 retries with exponential backoff + jitter to stay well
// inside the edge function's execution time budget.
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    if (response.ok || attempt >= MAX_RETRIES || !RETRYABLE_STATUS.has(response.status)) {
      return response;
    }
    await response.body?.cancel().catch(() => {});
    const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 250;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// Gemini's error bodies are raw Google API JSON (quota metrics, rpc types,
// retry info) — never fit for a user-facing chat bubble. Translate the
// common cases into plain Thai and fall back to a short generic message
// rather than ever surfacing the raw body to the frontend.
async function friendlyErrorMessage(response: Response, context: string): Promise<string> {
  const rawText = await response.text();

  if (response.status === 429) {
    return "ระบบ AI มีผู้ใช้งานเยอะในขณะนี้ (โควต้าเต็ม) กรุณาลองใหม่อีกครั้งในอีกสักครู่";
  }

  let apiMessage: string | undefined;
  try {
    const parsed = JSON.parse(rawText) as { error?: { message?: string } };
    apiMessage = parsed.error?.message;
  } catch {
    // not JSON — ignore, we'll use the generic fallback below
  }

  if (response.status >= 500) {
    return "ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
  }

  return apiMessage
    ? `${context}: ${apiMessage}`
    : `${context} ล้มเหลว (${response.status}) กรุณาลองใหม่อีกครั้ง`;
}

function model(): string {
  return Deno.env.get("AI_MODEL") ?? "gemini-2.0-flash";
}

function embeddingModel(): string {
  return Deno.env.get("AI_EMBEDDING_MODEL") ?? "gemini-embedding-001";
}

function imageModel(): string {
  return Deno.env.get("AI_IMAGE_MODEL") ?? "gemini-2.5-flash-image";
}

// knowledge_chunks.embedding is vector(768) — gemini-embedding-001 defaults to
// 3072 dims, so truncate via outputDimensionality. pgvector's <=> operator
// normalizes by vector norm, so truncation without re-normalizing is fine.
const EMBEDDING_DIMENSIONS = 768;

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: message.toolCallId ?? "tool", response: { content: message.content } } }],
      });
      continue;
    }

    if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.arguments, thoughtSignature: call.thoughtSignature } });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    contents.push({ role: "user", parts: [{ text: message.content }] });
  }

  return contents;
}

async function generate(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  temperature = 0.6,
  maxOutputTokens = 1024
): Promise<GenerateResult> {
  const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content);

  const body: Record<string, unknown> = {
    contents: toGeminiContents(messages),
    generationConfig: { temperature, maxOutputTokens },
  };

  if (systemMessages.length > 0) {
    body.systemInstruction = { parts: [{ text: systemMessages.join("\n\n---\n\n") }] };
  }

  if (tools && tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
  }

  const response = await fetchWithRetry(`${BASE_URL}/${model()}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await friendlyErrorMessage(response, "AI ตอบกลับ"));
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  };

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();

  const toolCalls = parts
    .filter((part): part is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => Boolean(part.functionCall))
    .map((part, index) => ({
      id: `${part.functionCall.name}-${index}`,
      name: part.functionCall.name,
      arguments: part.functionCall.args,
      thoughtSignature: part.functionCall.thoughtSignature,
    }));

  return {
    message: { role: "assistant", content: text, toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
    finishReason: toolCalls.length > 0 ? "tool_calls" : candidate?.finishReason === "MAX_TOKENS" ? "length" : "stop",
  };
}

async function embed(text: string): Promise<number[]> {
  const response = await fetchWithRetry(`${BASE_URL}/${embeddingModel()}:embedContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${embeddingModel()}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    throw new Error(await friendlyErrorMessage(response, "การค้นหาข้อมูล"));
  }

  const data = (await response.json()) as { embedding?: { values?: number[] } };
  return data.embedding?.values ?? [];
}

interface GeneratedImage {
  mimeType: string;
  base64: string;
}

async function generateImage(prompt: string): Promise<GeneratedImage> {
  // Every image here feeds vertical-video content (see Image Studio), so
  // request a 9:16 portrait render directly instead of generating square
  // and cropping afterward.
  const response = await fetchWithRetry(`${BASE_URL}/${imageModel()}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "9:16" } },
    }),
  });

  if (!response.ok) {
    throw new Error(await friendlyErrorMessage(response, "การสร้างภาพ"));
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  };

  const imagePart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imagePart?.inlineData) {
    throw new Error("AI ไม่สามารถสร้างภาพจากคำสั่งนี้ได้ ลองปรับคำอธิบายแล้วลองใหม่อีกครั้ง");
  }

  return { mimeType: imagePart.inlineData.mimeType, base64: imagePart.inlineData.data };
}

// Vision understanding (screenshot -> text) is Gemini-specific and not part
// of the vendor-agnostic AIProvider interface (that's for the swappable
// text-chat path only) -- callers that need this import it directly from
// here, same as generateImage.
async function understandImage(mimeType: string, base64: string, instructionPrompt: string): Promise<string> {
  const response = await fetchWithRetry(`${BASE_URL}/${model()}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType, data: base64 } }, { text: instructionPrompt }],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    throw new Error(await friendlyErrorMessage(response, "การอ่านภาพ"));
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("AI ไม่สามารถอ่านภาพนี้ได้ ลองใหม่อีกครั้ง");
  return text;
}

export interface WebResearchResult {
  text: string;
  sources: { title: string; url: string }[];
}

// Gemini's server-side Google Search grounding tool -- a different mechanism
// from the app's own function-calling `tools` array in generate() above
// (Gemini rejects a request that mixes google_search with function
// declarations in the same call), so this is a separate request shape.
// Gemini-specific and not part of the swappable AIProvider interface, same
// reasoning as generateImage/understandImage -- only Gemini exposes this
// particular grounding tool, and callers that need real external web
// research (e.g. Online Course Writer) import it directly from here.
async function researchWithSearch(query: string): Promise<WebResearchResult> {
  const response = await fetchWithRetry(`${BASE_URL}/${model()}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    throw new Error(await friendlyErrorMessage(response, "การค้นหาข้อมูลจากเว็บ"));
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: GeminiPart[] };
      groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
    }>;
  };

  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((chunk) => ({ title: chunk.web?.title ?? chunk.web?.uri ?? "", url: chunk.web?.uri ?? "" }))
    .filter((s) => s.url);

  if (!text) throw new Error("ไม่สามารถค้นหาข้อมูลจากเว็บได้ในขณะนี้ ลองใหม่อีกครั้ง");
  return { text, sources };
}

export const geminiProvider: AIProvider = { generate, embed, generateImage };
export { understandImage, researchWithSearch };
