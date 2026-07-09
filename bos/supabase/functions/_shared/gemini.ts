// Thin Gemini REST wrapper (Deno-compatible, no SDK). Mirrors the interface
// used by the AI provider layer in /bos/services/ai — kept intentionally
// separate since Edge Functions run in Deno, not Next.js.

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GenerateResult {
  message: ChatMessage;
  finishReason: "stop" | "tool_calls" | "length" | "error";
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

function apiKey(): string {
  return Deno.env.get("GEMINI_API_KEY")!;
}

function model(): string {
  return Deno.env.get("AI_MODEL") ?? "gemini-flash-latest";
}

function embeddingModel(): string {
  return Deno.env.get("AI_EMBEDDING_MODEL") ?? "text-embedding-004";
}

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "tool") {
      contents.push({
        role: "function",
        parts: [{ functionResponse: { name: message.toolCallId ?? "tool", response: { content: message.content } } }],
      });
      continue;
    }

    if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.arguments } });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    contents.push({ role: "user", parts: [{ text: message.content }] });
  }

  return contents;
}

export async function generate(
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

  const response = await fetch(`${BASE_URL}/${model()}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gemini generateContent failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  };

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();

  const toolCalls: ToolCall[] = parts
    .filter((part): part is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => Boolean(part.functionCall))
    .map((part, index) => ({ id: `${part.functionCall.name}-${index}`, name: part.functionCall.name, arguments: part.functionCall.args }));

  return {
    message: { role: "assistant", content: text, toolCalls: toolCalls.length > 0 ? toolCalls : undefined },
    finishReason: toolCalls.length > 0 ? "tool_calls" : candidate?.finishReason === "MAX_TOKENS" ? "length" : "stop",
  };
}

export async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${BASE_URL}/${embeddingModel()}:embedContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: `models/${embeddingModel()}`, content: { parts: [{ text }] } }),
  });

  if (!response.ok) {
    throw new Error(`Gemini embedContent failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { embedding?: { values?: number[] } };
  return data.embedding?.values ?? [];
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= CHUNK_SIZE) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}
