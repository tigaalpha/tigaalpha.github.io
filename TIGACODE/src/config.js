import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadDotEnv } from './utils/dotenv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = join(__dirname, '..');
export const CONFIG_DIR = join(homedir(), '.tigacode');
const GLOBAL_CONFIG_PATH = join(CONFIG_DIR, 'config.json');

function loadGlobalConfig() {
  if (!existsSync(GLOBAL_CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

export function saveGlobalConfig(config) {
  ensureConfigDir();
  writeFileSync(GLOBAL_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function getGlobalConfigPath() {
  return GLOBAL_CONFIG_PATH;
}

// ลำดับความสำคัญ (น้อย -> มาก): TIGACODE/.env  <  ~/.tigacode/config.json  <  process.env
export function loadEnv() {
  const dotEnv = loadDotEnv(join(PROJECT_ROOT, '.env'));
  const globalConfig = loadGlobalConfig();
  return { ...dotEnv, ...globalConfig, ...process.env };
}
