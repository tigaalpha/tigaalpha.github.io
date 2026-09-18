# tigamodel — TIGA Piano Intelligence

ชั้นปัญญาเฉพาะทางด้านการสอนเปียโนที่ทำงาน**เหนือ** foundation model จากผู้ให้บริการหลายราย
TIGA ไม่สร้าง foundation model และไม่ผูกกับผู้ให้บริการใดรายหนึ่ง — เครื่องยนต์พื้นฐาน
(GPT/Claude/Gemini/GLM/Qwen/DeepSeek/Kimi/Llama) เปลี่ยนได้ตลอด สิ่งที่ต้องคงอยู่คือ
ความรู้ วิธีสอน ความจำนักเรียน นโยบายการสอน ระบบประเมินผล และข้อมูลผลลัพธ์การสอนของ TIGA

## สถานะ: Phase 0 (ตรวจของจริงแล้ว ออกแบบให้เล็กที่สุดแต่ต่อยอดได้)

**กติกาเหล็ก (ดู docs/00-audit.md ประกอบ):**

1. **ห้ามผูกโมเดล** — ทุกการเรียกโมเดลผ่าน `providers/` เท่านั้น ห้ามเรียก API ผู้ให้บริการตรง ๆ ใน engine ใด ๆ
2. **อย่าสร้างซ้ำสิ่งที่มีอยู่** — แอปมี `piano-chat` edge function เป็น router ระดับ production อยู่แล้ว
   Phase 0 adapter แรกของเราคือ "ห่อ backend เดิม" ไม่ใช่ parallel stack ใหม่
3. **สคีมากลาง** — TIGA Core รู้จักเฉพาะ `core/schema` (TIGARequest/TIGAResponse/StudentContext/...)
   adapter เป็นผู้แปลงไป-กลับ
4. **ประเมินก่อนเชื่อ** — เปลี่ยนโมเดล = รัน `evaluation/` กับ baseline ก่อนเปิดใช้เสมอ
5. **สังเกต ≠ สรุป** — ทุก state ของนักเรียนเป็น probability + confidence + evidence เท่านั้น
   (ดู `teaching/philosophy.js` ข้อห้าม)
6. **ความปลอดภัยเด็ก/ข้อมูล** — consent ก่อนใช้กล้อง/ไมค์เก็บข้อมูลยาว, ห้ามส่งข้อมูลเด็กไป provider
   โดยไม่ผ่านนโยบาย, ไม่มีการจำใบหน้า
7. **ไม่มี secret ใน frontend** — คีย์ provider อยู่ฝั่ง edge function เท่านั้น

## โครงสร้างปัจจุบัน (Phase 0)

```
tigamodel/
  README.md                ← คุณอยู่นี่
  index.js                 ← entry point: buildPianoIntelligence() — ประกอบทุกส่วน
  core/
    schema.js              ← สคีมากลาง (validate/factory) — ภาษากลางของทั้งระบบ
  providers/
    provider-interface.js  ← LanguageModelProvider interface + registry + สัญญา
    existing-backend-adapter.js  ← adapter ตัวแรก: ยิงผ่าน piano-chat edge function (ของจริงที่ใช้อยู่)
    mock-provider.js       ← deterministic mock สำหรับทดสอบ/ออฟไลน์/CI — ไม่ยิงเน็ต
    model-router.js        ← เลือก provider ตาม task type + policy (cost/latency/quality/privacy)
  teaching/
    philosophy.js          ← หลักการสอน 15 ข้อ + ข้อห้าม (จากสเปค TIGA Piano Intelligence)
    policy.js              ← Teaching Policy engine: กติกา IF state THEN actions (configurable ไม่ hard-code)
    teaching-loop.js       ← วงจรสอน OBSERVE→…→ADAPT (Phase 0: rule-based บนสถานะที่มีจริง)
    skill-graph.js         ← Skill graph 80 โหนด + prerequisite edges (nextSkill/weakestAncestor/unlockOrder)
    coach.js               ← บันไดใบ้ 4 ชั้น + ความยากปรับตาม flow ±10% + recap 3 ข้อ + เกณฑ์ mastery
  student/
    student-model.js       ← Student Model: รวมข้อมูลที่แอปมีจริง (tg_memory/progress) เป็นสคีมากลาง
  knowledge/
    knowledge-base.js      ← โครง structured KB (fact/principle/strategy + confidence + source) + seed ชุดแรก
  evaluation/
    eval-suite.js          ← benchmark harness + test cases ชุดแรก (ประเมิน provider ทุกตัวก่อนเปิดใช้)
  roadmap-100.js           ← แผน 100 สิ่ง (structured data) + roadmapProgress()
  roadmap-1m.js            ← แผน 1,000,000 สิ่ง: เจเนอเรตเตอร์ 6 มิติ × 10 ค่า = 10⁶ สเปกไม่ซ้ำ + rank/filter/sample/stats
  docs/
    00-audit.md            ← สิ่งที่ตรวจพบใน repo จริง / ขาดอะไร / ต้องแก้อะไร
    01-phase0-architecture.md ← สถาปัตยกรรม Phase 0 + แผน Phase 1-5
    02-roadmap-100.md      ← แผน 100 สิ่ง (ฉบับเล่าเรื่อง) + บันทึกการทำจริง
    03-roadmap-1m.md       ← แผน 1,000,000 สิ่ง: วิเคราะห์ "ดีขึ้น 1 ล้านเท่า" + วิธีใช้ backlog
```

**สิ่งที่ตั้งใจไม่ทำใน Phase 0** (มีในสเปคแต่ยังไม่มีข้อมูล/โมดูลจริงรองรับ — ทำแล้วผิดหลัก
"ห้ามอ้างว่าวิเคราะห์ได้หากยังไม่มีโมดูล"): vision/audio fusion, student-state จากกล้อง,
performance analysis เชิงลึก, fine-tuning, GPU/self-host ทุกชนิด
(โครง interface เผื่อไว้แล้วใน `core/schema.js` + `providers/provider-interface.js`)

## เริ่มใช้

```js
import { buildPianoIntelligence } from "./tigamodel/index.js";
const tiga = buildPianoIntelligence();
const reply = await tiga.chat({ message: "...", studentContext: {...} });
```

ทดสอบ (repo นี้ไม่มี test framework — ใช้แนวทาง transpile+import ตาม AGENTS.md):

```bash
node tigamodel/scripts/smoke.mjs
node tigamodel/scripts/smoke-expansion.mjs
node tigamodel/scripts/smoke-self-learn.mjs
node tigamodel/scripts/smoke-reasoning.mjs
```
