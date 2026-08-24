// Logic ที่ใช้ร่วมกันระหว่าง server.js (รันในเครื่อง) กับ api/*.js (Vercel serverless
// functions) — เพื่อไม่ให้ต้องเขียนซ้ำสองที่ ทั้งคู่ import ไฟล์นี้ไฟล์เดียว
import { loadRegistry, resolveModel, listModels, getDefaultModelId } from '../src/models.js';
import { createProvider } from '../src/providers/index.js';

const MAX_MESSAGES = 200;

export async function chat({ modelId, messages }) {
  const registry = loadRegistry();
  const entry = resolveModel(modelId ?? getDefaultModelId(registry), registry);
  const provider = createProvider(entry.providerConfig);

  const cleanMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES);

  if (cleanMessages.length === 0) {
    throw new Error('ไม่มีข้อความให้ส่ง');
  }

  const result = await provider.chat({ model: entry.model, messages: cleanMessages });
  return { content: result.content };
}

export function models() {
  const registry = loadRegistry();
  return { models: listModels(registry), defaultModel: getDefaultModelId(registry) };
}
