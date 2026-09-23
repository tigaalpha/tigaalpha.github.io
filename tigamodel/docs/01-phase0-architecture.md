# 01-phase0-architecture.md — TIGA Piano Intelligence: Phase 0

## สถาปัตยกรรมตามสเปค ปรับให้เข้ากับของจริงใน repo

```
แอปเปียโน (App.tsx + hooks ที่มีอยู่ — ยังไม่แตะใน P0)
      ↓ (เมื่อ Phase 1 เริ่ม เสียบผ่าน use-tigamodel hook)
TIGA Piano Intelligence (โฟลเดอร์ tigamodel/)
  ├── core/schema.js            ภาษากลาง TIGARequest/TIGAResponse/StudentContext/...
  ├── teaching/
  │     philosophy.js           หลักการสอน 15 ข้อ + ข้อห้าม (data, ไม่ใช่ prompt กระจาย)
  │     policy.js               กติกา IF state THEN actions (configurable table)
  │     teaching-loop.js        วงจร OBSERVE→…→ADAPT (rule-based ก่อน)
  ├── student/student-model.js  รวมข้อมูลจริงที่แอปมี (tg_memory/progress) เป็นสคีมากลาง
  ├── knowledge/knowledge-base.js  KB โครง structured + seed ชุดแรก
  ├── providers/
  │     provider-interface.js   LanguageModelProvider + registry (สัญญาเดียวของทุก provider)
  │     existing-backend-adapter.js  ← adapter ตัวแรก: ยิงผ่าน piano-chat edge function
  │     mock-provider.js        deterministic สำหรับทดสอบ/ออฟไลน์
  │     model-router.js         เลือก provider ตาม task/policy (cost/latency/quality/privacy)
  ├── evaluation/eval-suite.js  benchmark + ชุดทดสอบแรก (ข้อ 25)
  └── index.js                  buildPianoIntelligence() ประกอบทุกส่วน
      ↓ (Phase 1+)
piano-chat edge function = provider "existing-backend" ตัวแรก
      ↓ (ของเดิมที่มีอยู่แล้ว ไม่แตะ)
Anthropic / Gemini / DeepSeek / OpenRouter / (อนาคต: Qwen, GLM, Kimi, Llama, Grok …)
```

**หัวใจของการออกแบบ:** เราไม่สร้าง Model Router ใหม่ — `piano-chat` เป็น router ระดับ
production อยู่แล้ว (per-feature model จาก `app_settings.ai_models` + fallback ladder)
`tigamodel` วางตัวเป็นชั้น "ความฉลาดทางการสอน" เหนือขึ้นไป และมอง backend เดิมเป็น
provider หนึ่งใน registry — เมื่อวันหน้ามี provider ตรง (OpenRouter หลายรุ่น, self-host)
เพิ่ม adapter ใหม่ ไม่ต้องแก้ core

## ทำไม Phase 0 ยังไม่ถูก import เข้าแอป (จงใจ)

1. ห้ามเสี่ยง bundle production ที่มีผู้ใช้จริงก่อนผ่าน evaluation
2. ข้อ 35 ของสเปค: "ห้ามสร้างระบบขนาดใหญ่ก่อนตรวจสอบของจริง" — P0 คือหลักฐานว่าโครงสร้าง
   คิดถูก ผ่าน smoke test จริง และพร้อมให้ P1 ต่อยอดโดยไม่ต้องรื้อ
3. จุดเชื่อมที่ปลอดภัยที่สุดใน P1 คือ `coach-tip` / `practice-plan` (มี ai-cache รองรับอยู่แล้ว)

## เส้นทาง Phase 1-5 (ปรับจากข้อ 34 ของสเปคให้ตรง repo)

| Phase | สิ่งที่ทำ | เงื่อนไขเริ่ม |
|---|---|---|
| P0 (ตอนนี้) | โครงสร้าง + สคีมา + provider/adapter/mock/router + philosophy/policy + student-model view + KB seed + eval suite | ✅ ไม่ต้องรอ |
| P1 | เสียบ coach-tip/practice-plan ผ่าน tigamodel (ยังยิง piano-chat เดิม), เก็บ outcome dataset (SQL migration ใหม่: teaching_outcomes), admin panel ดูผล eval | owner อนุมัติ migration |
| P2 | Practice Coach: ต่อ use-practice-mode signal (pauses/repeated errors/rhythm) เข้า teaching-loop แบบ rule-based จริง, self-report UI ตามข้อ 17 | ข้อมูล P1 มีพอ |
| P3 | Student-state estimation (probability+evidence) จาก performance+conversation — ไม่ใช้ใบหน้าเป็นหลักฐานเดียว, multimodal fusion โครง | ข้อมูล P2 |
| P4 | Realtime voice + camera dual-mode (มี MediaPipe รองรับอยู่แล้ว) | P3 เสถียร |
| P5 | Specialist small models / LoRA ถ้าข้อมูล+เหตุผลทางต้นทุนชัด (ข้อ 31) | eval ชี้ว่าคุ้ม |

## การเปลี่ยน foundation model (ข้อ 7 ของสเปค) — ขั้นตอนจริง

1. เพิ่ม/แก้ adapter ใน `providers/` (หรือแค่เปลี่ยน model ใน admin AI Models panel — มีอยู่แล้ว)
2. รัน `evaluation/eval-suite.js` เทียบ baseline (มี record ต่อ run)
3. ผ่านเกณฑ์ → เปิดใช้; ไม่ผ่าน → ยังคงโมเดลเดิม
4. TIGA Core ไม่ถูกแตะเลยในทุกขั้น
