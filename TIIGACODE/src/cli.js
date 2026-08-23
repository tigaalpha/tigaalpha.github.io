import { existsSync, readFileSync } from 'node:fs';
import { startRepl } from './repl.js';
import { loadRegistry, listModels, resolveModel, getDefaultModelId } from './models.js';
import { runTurn } from './agent/agent.js';
import { createProvider } from './providers/index.js';
import { buildSystemPrompt } from './agent/systemPrompt.js';
import { getGlobalConfigPath, ensureConfigDir, saveGlobalConfig } from './config.js';
import { colors } from './utils/ui.js';

const USAGE = `TIIGACODE — multi-model coding agent

การใช้งาน:
  tiigacode                        เปิดโหมดสนทนาต่อเนื่อง (REPL)
  tiigacode --model <id>           เริ่มด้วยโมเดลที่ระบุ
  tiigacode -p "<คำถาม>"            ยิงคำถามครั้งเดียวแล้วจบ (non-interactive)
  tiigacode models                 แสดงรายชื่อโมเดลที่ตั้งค่าไว้
  tiigacode config path            แสดงตำแหน่งไฟล์ config
  tiigacode config set <KEY> <val> บันทึกค่า (เช่น API key) ไว้ที่ config global

ตัวเลือก:
  -m, --model <id>      เลือกโมเดล (ดูรายชื่อด้วย "tiigacode models")
  -p, --print <text>    โหมดยิงครั้งเดียว ไม่เปิด REPL
  --auto-approve        ข้ามการถามยืนยันก่อนรัน write_file/edit_file/run_bash (เสี่ยงเอง)
  -h, --help            แสดงข้อความนี้`;

export async function main(argv) {
  const args = argv.slice(2);

  if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    console.log(USAGE);
    return;
  }

  const command = args[0];

  if (command === 'models') {
    const registry = loadRegistry();
    console.log(
      listModels(registry)
        .map((m) => `${m.id.padEnd(16)} ${m.label}  [provider: ${m.provider}]`)
        .join('\n')
    );
    return;
  }

  if (command === 'config') {
    handleConfigCommand(args.slice(1));
    return;
  }

  const flags = parseFlags(args);

  if (flags.print !== undefined) {
    await runOnce(flags);
    return;
  }

  await startRepl({ modelId: flags.model, autoApprove: flags.autoApprove });
}

function parseFlags(args) {
  const flags = { model: undefined, print: undefined, autoApprove: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--model' || a === '-m') flags.model = args[++i];
    else if (a === '--print' || a === '-p') flags.print = args[++i];
    else if (a === '--auto-approve' || a === '--yolo') flags.autoApprove = true;
  }
  return flags;
}

async function runOnce({ model: modelId, print, autoApprove }) {
  const registry = loadRegistry();
  const entry = resolveModel(modelId ?? getDefaultModelId(registry), registry);
  const provider = createProvider(entry.providerConfig);
  const history = [
    { role: 'system', content: buildSystemPrompt({ cwd: process.cwd() }) },
    { role: 'user', content: print },
  ];
  const reply = await runTurn({ provider, model: entry.model, history, autoApprove });
  console.log(reply);
}

function handleConfigCommand(args) {
  const sub = args[0];
  if (sub === 'path') {
    console.log(getGlobalConfigPath());
    return;
  }
  if (sub === 'set') {
    const [key, ...valueParts] = args.slice(1);
    const value = valueParts.join(' ');
    if (!key || !value) {
      console.log('ใช้แบบ: tiigacode config set <KEY> <value>   เช่น tiigacode config set ANTHROPIC_API_KEY sk-ant-xxxx');
      return;
    }
    const path = getGlobalConfigPath();
    ensureConfigDir();
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    current[key] = value;
    saveGlobalConfig(current);
    console.log(colors.green(`บันทึก ${key} ไว้ที่ ${path} แล้ว`));
    return;
  }
  console.log('คำสั่งที่ใช้ได้: tiigacode config path | tiigacode config set <KEY> <value>');
}
