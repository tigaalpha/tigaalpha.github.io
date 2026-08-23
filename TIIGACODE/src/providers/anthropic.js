// Adapter สำหรับ Anthropic Messages API (โครงสร้าง content-block ต่างจาก OpenAI-style)
export class AnthropicProvider {
  constructor({ baseUrl = 'https://api.anthropic.com', apiKey, version = '2023-06-01' }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.version = version;
  }

  async chat({ model, messages, tools, temperature = 0.7, maxTokens = 4096 }) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system');

    const body = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: toWireMessages(rest),
    };
    if (systemMsg?.content) body.system = systemMsg.content;
    if (tools?.length) {
      body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.version,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} จาก ${this.baseUrl}: ${text.slice(0, 800)}`);
    }

    const data = await res.json();
    let content = '';
    const toolCalls = [];
    for (const block of data.content ?? []) {
      if (block.type === 'text') content += block.text;
      else if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
    }
    return { content, toolCalls, raw: data };
  }
}

function stringify(content) {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function toWireMessages(generic) {
  const out = [];
  let pendingResults = null;

  const flush = () => {
    if (pendingResults) {
      out.push(pendingResults);
      pendingResults = null;
    }
  };

  for (const m of generic) {
    if (m.role === 'tool') {
      pendingResults ??= { role: 'user', content: [] };
      pendingResults.content.push({
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: stringify(m.content),
      });
      continue;
    }
    flush();
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments ?? {} });
      }
      out.push({ role: 'assistant', content: blocks });
    } else {
      out.push({ role: m.role, content: m.content ?? '' });
    }
  }
  flush();
  return out;
}
