# TIIGACODE

TIIGACODE คือ coding agent ที่ทำงานในเทอร์มินัล ในแนวทางเดียวกับ Claude Code แต่ออกแบบให้
**สลับ/เชื่อมต่อ AI model ได้หลายเจ้า** ผ่าน API ของแต่ละเจ้าเอง ไม่ผูกกับผู้ให้บริการรายเดียว

โฟลเดอร์นี้เป็นโปรเจกต์แยกต่างหาก ไม่เกี่ยวข้องกับแอปเปียโนหลักของ repo นี้ — ไม่มี
dependency ร่วมกัน ไม่กระทบ build/deploy ของแอปหลักแต่อย่างใด (เหมือน `studio/`/`bos/`
ที่เป็นโปรเจกต์อิสระในตัวเองอยู่แล้ว)

รองรับโมเดลต่อไปนี้ (ตั้งค่าไว้ให้เป็นค่าเริ่มต้น แก้ไข/เพิ่มเองได้ทั้งหมด):

| โมเดล | ผู้ให้บริการ | provider kind |
|---|---|---|
| Claude Sonnet 5 / Opus 5 | Anthropic | `anthropic` |
| ChatGPT (GPT-5) | OpenAI | `openai-compatible` |
| GLM-5.2 / GLM-5.3 | Zhipu AI (open.bigmodel.cn) | `openai-compatible` |
| Qwen3.8-Max / Qwen 3.7 | Alibaba Cloud (DashScope compatible-mode) | `openai-compatible` |
| Kimi K3 | Moonshot AI | `openai-compatible` |
| MiMo 2.5 | Xiaomi (ต้องระบุ endpoint เอง) | `openai-compatible` |

## ทำไม config พวกนี้ถึงเป็น "ค่าเริ่มต้นที่ต้องตรวจสอบเอง"

ชื่อรุ่นโมเดล (เช่น `glm-5.2`, `qwen3.8-max`, `kimi-k3`, `mimo-2.5`) เปลี่ยนบ่อยมาก และ
ผู้ให้บริการแต่ละเจ้าอาจตั้งชื่อ model id ในระบบจริงไม่ตรงกับชื่อการตลาดเป๊ะ ๆ — ทุกชื่อรุ่น
ในเครื่องมือนี้ถูกเก็บเป็น **ข้อความล้วน ๆ ใน `src/defaultModels.json`** ไม่ได้ hardcode ไว้ในโค้ด
ดังนั้นถ้าผู้ให้บริการเปลี่ยนชื่อรุ่นหรือ endpoint สามารถแก้ได้ทันทีโดยไม่ต้องแตะโค้ดเลย
(ดูหัวข้อ "เพิ่ม/แก้โมเดล" ด้านล่าง) — ก่อนใช้งานจริงควรตรวจสอบชื่อรุ่นปัจจุบันจากเอกสารของ
แต่ละผู้ให้บริการอีกครั้ง

MiMo ของ Xiaomi ไม่มี public hosted API ที่เป็นทางการเทียบเท่ารายอื่น (ส่วนใหญ่เผยแพร่เป็น
open-weight model ให้ไป self-host) — ถ้าจะใช้ ต้อง self-host เอง (เช่นผ่าน vLLM/SGLang) หรือใช้
ผู้ให้บริการ inference ที่ host ให้ แล้วใส่ base URL ของเขาไว้ที่ `MIMO_BASE_URL`

## เริ่มต้นใช้งาน

ต้องมี Node.js >= 18.17 — **ไม่มี dependency ภายนอกเลย ไม่ต้องรัน `npm install`**
(ใช้ Node built-in ทั้งหมด: `fetch`, `readline`, `fs`, `child_process`)

```bash
cd TIIGACODE
cp .env.example .env
# แก้ .env ใส่ API key เฉพาะผู้ให้บริการที่จะใช้จริง (ใส่แค่ตัวที่จะใช้ก็พอ)

node bin/tiigacode.js
```

หรือติดตั้งเป็นคำสั่ง global ในเครื่อง:

```bash
cd TIIGACODE
npm link
tiigacode
```

## การใช้งาน

```bash
tiigacode                        # เปิดโหมดสนทนาต่อเนื่อง (REPL)
tiigacode --model glm-5.2        # เริ่มด้วยโมเดลที่ระบุ
tiigacode -p "สรุปไฟล์นี้ให้หน่อย"   # ยิงคำถามครั้งเดียวแล้วจบ (non-interactive)
tiigacode models                 # แสดงรายชื่อโมเดลที่ตั้งค่าไว้
tiigacode config set OPENAI_API_KEY sk-xxxx   # บันทึกคีย์ไว้ที่ ~/.tiigacode/config.json
tiigacode --help                 # แสดงวิธีใช้ทั้งหมด
```

ภายในโหมด REPL:

```
/model <id>   สลับโมเดล เช่น /model kimi-k3
/models       แสดงรายชื่อโมเดลทั้งหมด
/clear        เคลียร์ประวัติการสนทนา
/help         แสดงคำสั่งทั้งหมด
/exit         ออกจากโปรแกรม
```

Agent เรียกใช้เครื่องมือเหล่านี้ได้ผ่าน function calling ของแต่ละโมเดล:
`read_file`, `write_file`, `edit_file`, `list_dir`, `glob`, `grep`, `run_bash`

**`write_file` / `edit_file` / `run_bash` จะถามยืนยันก่อนทุกครั้ง** ไม่ว่าโมเดลไหนจะเป็นคนขอ
(เพราะบางโมเดลเชื่อถือได้น้อยกว่า Claude และอาจโดน prompt injection จากเนื้อไฟล์ที่อ่านเข้ามา
แล้วพยายามสั่งรันคำสั่งอันตราย) ถ้าต้องการข้ามการถามยืนยัน (ยอมรับความเสี่ยงเอง) ใช้ flag
`--auto-approve`

## เพิ่ม/แก้โมเดล

สร้างไฟล์ `~/.tiigacode/models.json` (ไม่ต้องใส่ทุก field ใส่แค่ส่วนที่จะ override) เช่น

```json
{
  "models": [
    { "id": "glm-5.2", "model": "glm-5.2-plus" }
  ]
}
```

ค่านี้จะ merge ทับ `src/defaultModels.json` เฉพาะ id ที่ตรงกัน หรือจะเพิ่ม provider/โมเดลใหม่
ทั้งหมดก็ได้ (เช่น DeepSeek, Mistral, หรือโมเดล local ผ่าน Ollama) ตราบใดที่ endpoint ปลายทาง
เป็น OpenAI-compatible chat completions (`"kind": "openai-compatible"`) หรือ Anthropic
Messages API (`"kind": "anthropic"`)

## โครงสร้างโฟลเดอร์

```
TIIGACODE/
├── bin/tiigacode.js             entry point ของคำสั่ง CLI
├── src/
│   ├── cli.js                   parse argument / คำสั่งย่อย (models, config, --help)
│   ├── repl.js                  โหมดสนทนาต่อเนื่อง
│   ├── config.js                โหลด API key จาก .env / ~/.tiigacode/config.json / env จริง
│   ├── models.js                registry ของโมเดล+provider ที่ตั้งค่าไว้
│   ├── defaultModels.json       ค่าเริ่มต้นของ models.js (แก้ได้อิสระ ไม่ต้องแตะโค้ด)
│   ├── providers/
│   │   ├── anthropic.js         adapter สำหรับ Anthropic Messages API
│   │   ├── openaiCompatible.js  adapter สำหรับ OpenAI-compatible chat completions
│   │   │                        (ใช้ได้กับ OpenAI, GLM, Qwen, Kimi, MiMo self-host ฯลฯ)
│   │   └── index.js             factory เลือก adapter จาก provider config
│   ├── agent/
│   │   ├── agent.js             agent loop: ยิง prompt -> โมเดล -> tool call -> วนซ้ำ
│   │   ├── tools.js             เครื่องมือที่ agent เรียกใช้ได้ (มี schema ให้แต่ละโมเดล)
│   │   └── systemPrompt.js      system prompt ของ agent
│   └── utils/                   helper เล็ก ๆ (สี ANSI, glob matcher, .env parser, ถาม y/N)
├── .env.example
├── .gitignore
└── package.json
```

## ข้อจำกัดที่ควรรู้

- **ยังไม่ได้ทดสอบกับ API key จริงของทุกผู้ให้บริการ** — โค้ดเขียนตามสเปก OpenAI-compatible
  chat completions / Anthropic Messages API ที่แต่ละเจ้าประกาศไว้สาธารณะ แต่บางเจ้าอาจมี
  quirk เฉพาะตัว (รูปแบบ auth header, การรองรับ tool-calling ไม่ครบ ฯลฯ) — ถ้าเจอ error ให้
  อ่านข้อความที่พิมพ์ออกมา (มี HTTP status + response body เต็ม ๆ) เพื่อ debug แล้วปรับที่
  `src/providers/*.js` หรือ `models.json` ตามนั้น
- ยังไม่รองรับ streaming (รอ response เต็มก่อนค่อยแสดงผล ไม่มี token ไหลทีละตัว)
- ไม่มี sandbox ให้ `run_bash` — รันจริงบนเครื่องผู้ใช้ ต้องอ่านคำสั่งก่อนกด y ทุกครั้ง
- ต้องมี `bash` ในเครื่อง (Linux / macOS / WSL / Git Bash บน Windows)
