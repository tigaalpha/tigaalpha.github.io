// Adapter เดียวใช้ได้กับทุกผู้ให้บริการที่ทำ REST API แบบ OpenAI chat completions
// (OpenAI จริง, Zhipu GLM, Alibaba Qwen compatible-mode, Moonshot Kimi, MiMo self-host ฯลฯ)
export class OpenAICompatibleProvider {
  constructor({ baseUrl, apiKey, extraHeaders = {} }) {
    if (!baseUrl) {
      throw new Error('ต้องระบุ baseUrl สำหรับ provider นี้ (ดู TIGACODE/README.md หัวข้อ "เพิ่ม/แก้โมเดล")');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.extraHeaders = extraHeaders;
  }

  async chat({ model, messages, tools, temperature = 0.7, maxTokens }) {
    const body = {
      model,
      messages: toWireMessages(messages),
      temperature,
    };
    if (maxTokens) body.max_tokens = maxTokens;
    if (tools?.length) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body.tool_choice = 'auto';
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} จาก ${this.baseUrl}: ${text.slice(0, 800)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message ?? {};
    const toolCalls = (msg.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function?.name,
      arguments: parseArgs(tc.function?.arguments),
    }));

    return { content: msg.content ?? '', toolCalls, raw: data };
  }
}

function parseArgs(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

function stringify(content) {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function toWireMessages(generic) {
  const out = [];
  for (const m of generic) {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) },
        })),
      });
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: stringify(m.content) });
    } else {
      out.push({ role: m.role, content: m.content ?? '' });
    }
  }
  return out;
}
