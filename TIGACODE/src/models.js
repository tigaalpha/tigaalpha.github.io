import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_DIR } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRegistry = JSON.parse(readFileSync(join(__dirname, 'defaultModels.json'), 'utf8'));

function loadUserRegistry() {
  const path = join(CONFIG_DIR, 'models.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`[tigacode] คำเตือน: อ่าน ${path} ไม่ได้ (${err.message}) — ใช้ค่า default แทน`);
    return null;
  }
}

function mergeRegistry(base, override) {
  if (!override) return base;
  const merged = {
    defaultModel: override.defaultModel ?? base.defaultModel,
    providers: { ...base.providers, ...(override.providers ?? {}) },
    models: [...base.models],
  };
  for (const m of override.models ?? []) {
    const idx = merged.models.findIndex((x) => x.id === m.id);
    if (idx >= 0) merged.models[idx] = { ...merged.models[idx], ...m };
    else merged.models.push(m);
  }
  return merged;
}

// รวมค่าเริ่มต้นใน defaultModels.json เข้ากับ override ของผู้ใช้ที่
// ~/.tigacode/models.json (ถ้ามี) — override เฉพาะ field/id ที่ระบุ ที่เหลือใช้ default
export function loadRegistry() {
  return mergeRegistry(defaultRegistry, loadUserRegistry());
}

export function listModels(registry = loadRegistry()) {
  return registry.models;
}

export function getDefaultModelId(registry = loadRegistry()) {
  return registry.defaultModel;
}

export function resolveModel(idOrModelString, registry = loadRegistry()) {
  const entry = registry.models.find((m) => m.id === idOrModelString);
  if (!entry) {
    throw new Error(`ไม่รู้จักโมเดล "${idOrModelString}" — พิมพ์ "tigacode models" เพื่อดูรายการที่ตั้งค่าไว้`);
  }
  const providerConfig = registry.providers[entry.provider];
  if (!providerConfig) {
    throw new Error(`ไม่พบ provider "${entry.provider}" ที่อ้างถึงโดยโมเดล "${entry.id}"`);
  }
  return { ...entry, providerConfig };
}
