// Generic adapter for any provider that ships an OpenAI-compatible
// /chat/completions endpoint — covers GPT (OpenAI), Grok (xAI), DeepSeek,
// Kimi (Moonshot), and GLM (Zhipu/Z.ai) with the same request/response
// shape, differing only in base URL / API key / model name. Kept separate
// from ai-provider.ts (the tool-calling AIProvider interface used by the
// customer-facing chat) since the Strategy Room only needs plain text
// completion, not tool calls, embeddings, or image generation.

export interface SimpleChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function callOpenAICompatible(config: OpenAICompatibleConfig, messages: SimpleChatMessage[]): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${config.baseUrl} returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.baseUrl} returned no completion content`);
  return content;
}
