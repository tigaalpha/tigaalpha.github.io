import "server-only";
import { env } from "@/lib/env";
import type { AIProvider, ChatMessage, GenerateOptions, GenerateResult, ToolCall } from "@/types/ai";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") continue; // sent via systemInstruction instead

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

function systemInstruction(messages: ChatMessage[]): string | undefined {
  const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content);
  return systemMessages.length > 0 ? systemMessages.join("\n\n---\n\n") : undefined;
}

export class GeminiProvider implements AIProvider {
  private apiKey = env.ai.apiKey();
  private model = env.ai.model();
  private embeddingModel = env.ai.embeddingModel();

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const body: Record<string, unknown> = {
      contents: toGeminiContents(options.messages),
      generationConfig: {
        temperature: options.temperature ?? 0.6,
        maxOutputTokens: options.maxOutputTokens ?? 1024,
      },
    };

    const instruction = systemInstruction(options.messages);
    if (instruction) {
      body.systemInstruction = { parts: [{ text: instruction }] };
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: options.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];
    }

    const response = await fetch(`${BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini generateContent failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const text = parts
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    const toolCalls: ToolCall[] = parts
      .filter((part): part is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => Boolean(part.functionCall))
      .map((part, index) => ({
        id: `${part.functionCall.name}-${index}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args,
      }));

    return {
      message: {
        role: "assistant",
        content: text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finishReason: toolCalls.length > 0 ? "tool_calls" : candidate?.finishReason === "MAX_TOKENS" ? "length" : "stop",
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount ?? 0,
            completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${BASE_URL}/${this.embeddingModel}:embedContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${this.embeddingModel}`,
        content: { parts: [{ text }] },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini embedContent failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { embedding?: { values?: number[] } };
    return data.embedding?.values ?? [];
  }
}
