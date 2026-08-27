import readline from 'node:readline';
import { loadRegistry, resolveModel, getDefaultModelId, listModels } from './models.js';
import { createProvider } from './providers/index.js';
import { runTurn } from './agent/agent.js';
import { buildSystemPrompt } from './agent/systemPrompt.js';
import { colors, banner } from './utils/ui.js';

function printEvent(event) {
  if (event.type === 'tool_call') {
    console.log(colors.dim(`  → ${event.call.name}(${JSON.stringify(event.call.arguments ?? {})})`));
  }
}

async function handleCommand(input, ctx) {
  const [cmd, ...rest] = input.slice(1).split(' ');
  switch (cmd) {
    case 'exit':
    case 'quit':
      return 'exit';
    case 'help':
      console.log(
        [
          '/model <id>   สลับโมเดล',
          '/models       แสดงรายชื่อโมเดลทั้งหมด',
          '/clear        เคลียร์ประวัติการสนทนา',
          '/help         แสดงข้อความนี้',
          '/exit         ออกจากโปรแกรม',
        ].join('\n')
      );
      return undefined;
    case 'models':
      console.log(listModels(ctx.registry).map((m) => `  ${m.id.padEnd(16)} ${m.label}`).join('\n'));
      return undefined;
    case 'model': {
      const id = rest.join(' ').trim();
      if (!id) {
        console.log('ใช้แบบ: /model <id> — พิมพ์ /models เพื่อดูรายการ');
        return undefined;
      }
      try {
        ctx.setModel(id);
        console.log(colors.green(`สลับไปใช้โมเดล: ${id}`));
      } catch (err) {
        console.error(colors.red(err.message));
      }
      return undefined;
    }
    case 'clear':
      ctx.history.length = 1; // เก็บ system prompt ไว้บรรทัดแรก
      console.log(colors.dim('เคลียร์ประวัติการสนทนาแล้ว'));
      return undefined;
    default:
      console.log(colors.red(`ไม่รู้จักคำสั่ง: /${cmd} — พิมพ์ /help`));
      return undefined;
  }
}

export async function startRepl({ modelId, autoApprove }) {
  const registry = loadRegistry();
  let currentModelId = modelId ?? getDefaultModelId(registry);
  // resolveModel แค่ดู registry เฉยๆ ไม่ได้ตรวจ API key — เพื่อให้เปิด REPL ได้เสมอ
  // แม้ยังไม่ได้ตั้งค่าคีย์ของโมเดล default ก็ตาม (จะไปเช็คคีย์ตอนส่งข้อความจริงแทน)
  let currentEntry = resolveModel(currentModelId, registry);

  const history = [{ role: 'system', content: buildSystemPrompt({ cwd: process.cwd() }) }];

  console.log(banner());
  console.log(colors.dim(`โมเดลปัจจุบัน: ${currentModelId} (${currentEntry.model})`));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.green('› '),
  });
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input.startsWith('/')) {
      const result = await handleCommand(input, {
        registry,
        setModel: (id) => {
          // resolveModel มาก่อน ถ้า id ผิดจะ throw และ currentEntry/currentModelId เดิมไม่ถูกแตะ
          currentEntry = resolveModel(id, registry);
          currentModelId = id;
        },
        history,
      });
      if (result === 'exit') {
        rl.close();
        return;
      }
      rl.prompt();
      return;
    }

    // ถ้าข้อความก่อนหน้ายังไม่ได้รับคำตอบ (เช่นรอบที่แล้ว error ก่อนเรียกโมเดลเลย เพราะ
    // ยังไม่ได้ตั้งค่า API key) ให้ต่อท้ายข้อความเดิมแทนการเพิ่ม user message ใหม่ซ้อนกัน —
    // มิฉะนั้นบางผู้ให้บริการ (เช่น Anthropic) จะปฏิเสธ history ที่มี user ติดกัน 2 ข้อความ
    const last = history[history.length - 1];
    if (last?.role === 'user') {
      last.content = `${last.content}\n${input}`;
    } else {
      history.push({ role: 'user', content: input });
    }

    try {
      const provider = createProvider(currentEntry.providerConfig);
      const reply = await runTurn({
        provider,
        model: currentEntry.model,
        history,
        autoApprove,
        onEvent: printEvent,
      });
      console.log(`\n${colors.cyan('●')} ${reply}\n`);
    } catch (err) {
      console.error(colors.red(`เกิดข้อผิดพลาด: ${err.message}`));
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(colors.dim('\nลาก่อน'));
    process.exit(0);
  });
}
