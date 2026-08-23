import { OpenAICompatibleProvider } from './openaiCompatible.js';
import { AnthropicProvider } from './anthropic.js';
import { loadEnv } from '../config.js';

export function createProvider(providerConfig) {
  const env = loadEnv();
  const apiKey = providerConfig.apiKeyEnv ? env[providerConfig.apiKeyEnv] : undefined;
  const baseUrl =
    providerConfig.baseUrlEnv && env[providerConfig.baseUrlEnv]
      ? env[providerConfig.baseUrlEnv]
      : providerConfig.baseUrl;

  if (!apiKey) {
    throw new Error(
      `ยังไม่ได้ตั้งค่า API key: ${providerConfig.apiKeyEnv}\n` +
        `ตั้งค่าได้โดยใส่ในไฟล์ TIIGACODE/.env หรือรัน "tiigacode config set ${providerConfig.apiKeyEnv} <ค่า>"`
    );
  }

  switch (providerConfig.kind) {
    case 'anthropic':
      return new AnthropicProvider({ baseUrl, apiKey });
    case 'openai-compatible':
      return new OpenAICompatibleProvider({ baseUrl, apiKey });
    default:
      throw new Error(`ไม่รู้จัก provider kind: "${providerConfig.kind}"`);
  }
}
