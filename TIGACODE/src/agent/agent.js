import { TOOLS, getToolSchemas } from './tools.js';
import { confirm } from '../utils/confirm.js';
import { colors } from '../utils/ui.js';

const MAX_ITERATIONS = 25;

export async function runTurn({ provider, model, history, autoApprove, onEvent }) {
  const tools = getToolSchemas();

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await provider.chat({ model, messages: history, tools });

      if (response.toolCalls?.length) {
        history.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls });

        for (const call of response.toolCalls) {
          onEvent?.({ type: 'tool_call', call });
          const result = await executeTool(call, autoApprove);
          history.push({ role: 'tool', toolCallId: call.id, content: result });
          onEvent?.({ type: 'tool_result', call, result });
        }
        continue;
      }

      history.push({ role: 'assistant', content: response.content });
      return response.content;
    }

    throw new Error(`เกินจำนวนรอบสูงสุด (${MAX_ITERATIONS}) ในการทำงานหนึ่งครั้ง — อาจติด loop`);
  } catch (err) {
    // รักษา invariant ว่า history ต้องจบด้วย assistant message เสมอเมื่อคุมกลับไปที่ผู้ใช้
    // ไม่งั้นถ้า error เกิดกลางทาง (เช่น network error หลังทำ tool call ไปแล้วบางส่วน หรือ
    // ชนจำนวนรอบสูงสุด) history จะจบด้วย tool message ซึ่งพอผู้ใช้พิมพ์ข้อความใหม่ต่อ
    // จะกลายเป็น role ติดกันผิดลำดับ (Anthropic ปฏิเสธ user ติดกันสองข้อความ)
    if (history[history.length - 1]?.role !== 'assistant') {
      history.push({ role: 'assistant', content: `[เกิดข้อผิดพลาดระหว่างทำงาน: ${err.message}]` });
    }
    throw err;
  }
}

async function executeTool(call, autoApprove) {
  const tool = TOOLS[call.name];
  if (!tool) return `Error: ไม่รู้จัก tool "${call.name}"`;

  if (tool.dangerous && !autoApprove) {
    const argsPreview = JSON.stringify(call.arguments ?? {}).slice(0, 300);
    const approved = await confirm(`${colors.yellow(`อนุญาตให้รัน ${call.name}`)} ${argsPreview} ?`);
    if (!approved) return 'ผู้ใช้ปฏิเสธการรันคำสั่งนี้';
  }

  try {
    return await tool.execute(call.arguments ?? {});
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
