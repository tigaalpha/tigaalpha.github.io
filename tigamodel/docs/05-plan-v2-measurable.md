# 05 — แผน v2: "ดีขึ้นอีกร้อยเท่า" — จากทิศทาง สู่ สัญญาที่วัดได้

เขียนเมื่อ 2026-09-29 บนสาขา `claude/learning-data-v1` ต่อจาก `04-state-and-millionfold-plan.md`

**สิ่งที่ v2 ทำแล้ว v1 (docs/04) ไม่ได้ทำ:**

| v1 (docs/04) | v2 (เอกสารนี้) |
|---|---|
| บอก "ทำอะไร ทำไมดี" | บอกเพิ่ม: **baseline วันนี้ → เป้าหมายตัวเลข → วัดยังไง → พังแล้วยังไง** |
| ข้อ 1 ถูกล็อกซ้ำเพราะคิดว่าต้องรอ migration | **ปลดล็อกแล้ว** — RPC `admin_strategy_effectiveness` apply อยู่แล้วใน `supabase-teaching-outcomes-migration.sql` (ตรวจจริง 2026-09-29) |
| ทุก smoke เป็น "ตรวจยังไง" แบบลอย ๆ | ทุกข้อระบุ **ชื่อไฟล์ smoke ใหม่ + เงื่อนไข pass ที่เขียนได้ทันที** |
| ไม่มีทางถอย | ทุกข้อมี **kill switch ใน `app_settings`** — ปิดได้โดยไม่ deploy ใหม่ |
| ไม่ผูก anchor กับโค้ด | ทุกข้อมี **anchor จริง** (ไฟล์/RPC/export ที่ตรวจแล้วว่ามีอยู่) |

นิยามคำว่า "เสร็จ" ของทุกข้อใน v2: **smoke ใหม่ผ่าน + eval suite ผ่าน regression gate + commit→push→CI build ผ่าน** ใน PR/merge เดียวกัน — โค้ดเขียนเสร็จอย่างเดียวไม่นับ

---

## ส่วนที่ 1: หลักคิด 5 ข้อ (สิ่งที่ทำให้ดีขึ้นร้อยเท่า)

1. **ไม่มีงานไหนไม่มีตัวเลขก่อน-หลัง** — จับ baseline ก่อนแตะโค้ดเสมอ ไม่งั้นไม่รู้ว่าดีขึ้นจริงหรือรู้สึกดี
2. **ทุกงานผูก anchor ที่มีอยู่จริง** — แผนที่อ้างไฟล์ที่ไม่มีคือนิยาย; ทุก anchor ด้านล่างตรวจด้วย grep/read วันเขียนแผน
3. **ทุกงานพังได้และหายได้ใน 1 นาที** — kill switch อยู่ใน `app_settings` ทุกชิ้น ปิดแล้วระบบกลับไปพฤติกรรมเดิมทันที
4. **ลำดับเรียงตาม "ตัวเลขที่ปลดล็อกได้เร็วที่สุด"** — ไม่ใช่ตามความสนุกของงาน
5. **SQL แตะของจริงต้องมีอนุมัติเฉพาะรายการจากเจ้าของ** (กติกาเหล็กเดิม ไม่เคยเปลี่ยน)

---

## ส่วนที่ 2: สิบโครงการแบบสัญญา (baseline → เป้า → วิธีวัด → ทางถอย)

### §1 Strategy Effect Analyzer — 🔓 ปลดล็อกแล้ว เริ่มได้ทันที
- **ทำ:** `tigamodel/teaching/strategy-analyzer.js` — อ่านผลรวมต่อ strategy ผ่าน RPC `admin_strategy_effectiveness` **ที่มีอยู่แล้ว** (อย่าเขียน SQL aggregate ซ้ำ) → คำนวณ weight (clamp 0.5–2.0, <5 ตัวอย่างต่อ strategy = ได้ 1.0) → เขียน `app_settings.tiga_policy_weights` ผ่าน RPC ใหม่ `admin_set_policy_weights` (admin-tier ≥1, upsert key เดียว) → `teaching-loop.js` อ่าน weights ตอนเลือก strategy
- **Anchor:** `admin_strategy_effectiveness` (apply แล้ว), `teaching/teaching-loop.js` (decision.strategy_id อยู่บรรทัด ~142/154), `app_settings` (มีอยู่, ใช้โดย sim_bots)
- **Baseline:** weights ไม่มีอยู่ = ทุก strategy น้ำหนักเท่ากัน (1.0)
- **เป้า:** หลัง ≥50 outcomes จริง — strategy ที่ gain ดีสุดได้ weight ≥1.2 และ teaching-loop ใช้จริงภายใน 1 สัปดาห์ (มี log ยืนยัน)
- **Smoke ใหม่:** `tigamodel/scripts/smoke-strategy-analyzer.mjs` — fixture 30 outcomes จำลอง → weights ต่างกันตาม gain จริง / ค่า clamp ไม่ทะลุ 0.5–2.0 / ตัวอย่าง <5 → 1.0 / flag ปิด → คืน null และ loop ใช้กติกาเดิม
- **Kill switch / ทางถอย:** `app_settings.tiga_policy_weights = {"enabled":false}` → loop กลับกติกาเดิมทันที; ลบ key เดียวจบ

### §2 Apply learning-data migration — ⏳ รออนุมัติเจ้าของเป็นรายการ
- **ทำ:** รัน `supabase-learning-data-migration.sql` (7 ตาราง + RLS + RPCs, เขียน re-runnable แล้ว) — **แผน apply ที่ v1 ไม่มี:** (1) dry-run `BEGIN; ... ROLLBACK;` ใน SQL Editor ก่อน (ตามธรรมเนียมที่ทำให้ admin-currency migration) (2) apply จริง (3) รัน `scripts/verify-learning-data.mjs` ต้อง 21/21 (4) เปิดแอปจริงซ้อม 1 รอบ → แถวปรากฏใน `learning_sessions`
- **Baseline:** client เขียนได้แต่ drop เงียบ — ข้อมูลฝั่งล่างทั้งหมดสูญระหว่างรอ
- **เป้า:** จากนาที apply → ข้อมูลไหลครบทุก ingest RPC ภายใน 30 นาที
- **ทางถอย:** ตารางทั้ง 7 อยู่เนมสเปซ `learning_*` ที่ไม่มีใครแตะก่อน — `drop table` ทั้งชุดคืนสถานะเดิมได้ ไม่กระทบตารางเก่า
- **เป็นเงื่อนไขของ §3 และ §9 เท่านั้น** (§1 ไม่ต้องรอแล้ว)

### §3 Personalized practice-plan ผ่าน skill_state — รอ §2
- **ทำ:** `use-practice-mode.ts` + `teaching/coach.js` อ่าน ability ต่อทักษะจาก `learning_update_skill_state` (server-blend มีอยู่แล้ว) เป็น input ของแผนซ้อม แทน mastery เฉลี่ยหยาบ
- **Baseline:** แผนซ้อมอิงค่าเฉลี่ยเดียว — คนเก่งโน้ตกุญแจแต่อ่อน rhythm ได้แผนเหมือนกัน
- **เป้า (สัญญา 2 ข้อ):** (1) smoke พิสูจน์ ability ต่ำสุด → drill ง่ายลง ≥1 ระดับ ใน ≥80% ของเคสทดสอบ (2) นักเรียนจริง 20 คนแรกได้แผนต่างกัน ≥3 รูปแบบ (วัดความหลากหลายจริง ไม่ใช่รู้สึก)
- **Smoke ใหม่:** `smoke-skill-state-plans.mjs` — fixture skill_state → เลือก drill ถูกระดับ / state หาย → fallback พฤติกรรมเดิม
- **Rollout:** flag ต่อ device เริ่ม 10% → ดู 1 สัปดาห์ → 100%
- **Kill switch:** `tiga_personalized_plans=false` → ทุกคนได้แผนแบบเดิม

### §4 Retrieval eval สำหรับ KB 17,090 entries
- **ทำ:** `evaluation/eval-expanded.js` เพิ่ม ~20 probe เคสแบบ "keywords → expected entry id" (รู้คำตอบก่อนถาม)
- **Baseline:** retrieval accuracy = ไม่เคยมีตัวเลข (124 เคสเดิมวัดแต่คำตอบ ไม่วัดการหยิบ)
- **เป้า:** มีตัวเลขครั้งแรกภายใน 3 วัน และ ≥85%; regression gate ตั้งไม้กันที่ 80% ตลอดไป
- **Smoke:** เคสใหม่รันใน suite เดิม — accuracy ต่ำกว่า 80% = merge ถูกบล็อกโดยอัตโนมัติ

### §5 Jev ตัดสินใจ policy แทน if-else (เฉพาะจุดที่กติกาเสมอกัน)
- **ทำ:** `teaching/teaching-loop.js` — เมื่อ 2 strategies คะแนนเท่ากัน/ต่างกัน <0.05 → ส่งเป็น `choice` ให้ `jev.judge()` (edge function เดิม, คีย์ฝั่ง server) → แนบ probability + เหตุผลใน response; กติกาชัดอยู่เหมือนเดิม
- **Baseline:** เสมอกัน = ตัดสินด้วยลำดับที่โค้ดเขียนไว้ (โดยไม่รู้ตัว)
- **เป้า:** เคสเสมอกัน 100% ผ่าน Jev, p95 latency รวม <1.5s, timeout/error → fallback กติกาเดิม 100% (วัดจาก smoke จำลอง network fail)
- **Smoke ใหม่:** `smoke-jev-policy.mjs` — บังคับ tie → เห็น probability ใน response / edge ล่ม → ได้คำตอบจากกติกาเดิม ไม่มีข้อผิดพลาดโชว์ผู้เรียน
- **Kill switch:** `tiga_jev_policy=false` → กลับ if-else เดิมทั้งหมด

### §6 Golden answers จากนักเรียนจริง
- **ทำ:** สรุปคำถามซ้ำ (จาก `learning_*` เมื่อ §2 apply + chat logs) → 10 เคส eval/สัปดาห์ → หน้า admin ให้เจ้าของกด approve → ยัด suite
- **Baseline:** eval ทั้งหมดมาจากหัวของคนเขียน — เสี่ยง "เก่งในของที่แต่งเอง"
- **เป้า:** ภายใน 4 สัปดาห์ suite มี ≥40 เคสจากคำถามจริง + regression gate ปกป้อง
- **วัด:** จำนวนเคสจริงใน suite (ตัวเลขเดียว โกหกไม่ได้)

### §7 Multimodal fusion v1
- **ทำ:** `student/state-estimator.js` รับ camera verdict + rhythm report + self-report พร้อมกัน ถ่วงน้ำหนักตาม confidence ของแต่ละสัญญาณ (bridge ครบจาก Phase 4 แล้ว)
- **Baseline:** สัญญาณมาถึงทีละทาง ทับกันด้วยลำดับ ไม่ได้ผสม
- **เป้า:** (1) smoke: 3 สัญญาณขัดกันแบบ deterministic → ฝั่ง confidence สูงกว่าชนะ 100% ของเคส (2) ผู้เรียนจริง: session ที่มี ≥2 สัญญาณเพิ่มขึ้น (วัดจาก events)
- **Smoke ใหม่:** `smoke-fusion.mjs` — ตารางเคสขัดกัน → ผลคาดเดาได้ทุกช่อง
- **Kill switch:** weight ของสัญญาณที่ยังไม่เชื่อถือตั้งเป็น 0 ได้รายช่อง

### §8 Cost governor ต่อ session
- **ทำ:** `providers/model-router.js` + edge `piano-chat` — เพดาน token/บาทตาม plan, พอถึงเพดาน → ลดรุ่น/จำกัดความยาว ไม่ใช่หยุดบริการ
- **Baseline:** ไม่มีเพดานต่อ session — ต้นทุนเป็นฟังก์ชันของความอดทนผู้เรียน
- **เป้า:** จำลอง session ฟรี 40 คำถาม → throttle ก่อนเกินเพดาน 100% ของกรณี, ต้นทุน/session p95 ลด ≥30% โดย eval suite ยังผ่านเท่าเดิม (**คุณภาพไม่ตกเป็นเงื่อนไขร่วม**)
- **Kill switch:** เพดาน = ค่ามหาศาล (effectively infinity) ผ่าน `app_settings`

### §9 KB expansion จากปัญหาจริง — รอ §2 + §4
- **ทำ:** อ่าน top_problems จาก `learning_diagnoses` จริง → สั่ง expansion wave ถัดไปตามปัญหาจริง
- **Baseline:** wave ใหม่ตามรายการในหัวของคนเขียน
- **เป้า:** top-3 ปัญหาจาก dashboard มี KB entries รองรับภายใน 1 wave + ผ่าน retrieval eval (§4) + **อัตรา "ตอบไม่ได้" ของแชทลด ≥50%** จาก baseline ที่จับไว้ก่อน wave
- **วัด:** ตัวเลข top_problems เทียบก่อน/หลัง wave

### §10 Realtime voice (barge-in)
- **ทำ:** `use-voice-tutor.ts` + `speech.ts` — จาก turn-based เป็นเฝ้าฟังต่อเนื่อง พูดข้ามได้
- **Baseline:** turn-based รอเสียงจบ
- **เป้า:** barge-in ทำงานบน device จริง, ความหน่วง <800ms — **ทดสอบโดยเจ้าของบนเครื่องจริงเท่านั้น** (native, headless ทดสอบไม่ได้ตาม AGENTS.md)
- **ทางถอย:** กลับ turn-based ด้วย flag

---

## ส่วนที่ 3: เส้นทาง + เงื่อนไขเริ่ม (ต่างจาก v1 ตรงที่ §1 ไม่ต้องรอแล้ว)

```
สัปดาห์นี้:   §1 (ปลดล็อก — ข้อมูลจาก teaching_outcomes ที่ไหลอยู่แล้ว)
             ∥ §2 รออนุมัติ → พออนุมัติทันทีตามแผน apply 4 ขั้น
สัปดาห์ 2:   §3 (ทันทีที่ §2 เสร็จ) → §4 → §6
สัปดาห์ 3+:  §9 (ต้องมี §4 ก่อน จะได้วัดผล wave ได้) → §5 → §7 → §8 → §10
```

เหตุผลที่เปลี่ยนจาก v1: v1 บล็อก §1 กับ §2 ไว้ด้วยกัน — ผิด เพราะ `teaching_outcomes`
(เชื้อเพลิงของ analyzer) apply แล้วและไหลจริงทุกครั้งที่ซ้อม ส่วน learning_* v1
(ตารางใหม่ 7 ใบ) เป็นเชื้อเพลิงของ §3/§9 เท่านั้น การปลดล็อกผิดตัวทำให้เสียสัปดาห์ฟรี ๆ

**ประกาศผลลัพธ์ 6 สัปดาห์ (สัญญาที่วัดได้):** ครูที่ปรับตัวจากข้อมูลนักเรียนจริงทุกสัปดาห์
(weight ≥1.2 พิสูจน์ด้วย log), แผนต่อบุคคลจาก skill_state (≥3 รูปแบบจาก 20 คน),
retrieval ≥85% (ตัวเลขครั้งแรก), ต้นทุน/session p95 −30% (eval ยังผ่านเท่าเดิม),
อัตราตอบไม่ได้ −50% — **ทุกตัวเลขมี smoke/eval คอยพิสูจน์ ไม่ผ่าน = ไม่ขึ้น production**

---

## ส่วนที่ 4: กติกาเหล็ก — ข้อเดิม 4 ข้อไม่เปลี่ยน + เพิ่ม 2 ข้อ

1. ห้ามผูกโมเดล — ทุก call ผ่าน `providers/` + คีย์ฝั่ง server เท่านั้น
2. ประเมินก่อนเชื่อ — เปลี่ยนอะไรที่โดนคำตอบผู้เรียน ต้องรัน eval suite ผ่าน regression gate ก่อนขึ้น
3. สังเกต ≠ สรุป — ทุก state ยังเป็น probability + confidence + evidence
4. client ห้ามส่งค่า absolute เข้า DB — เดินผ่าน RPC additive/blend ฝั่ง server เท่านั้น
5. **(ใหม่) ทุก feature ใหม่มี kill switch ใน `app_settings`** — ปิดได้ใน 1 นาทีโดยไม่ต้อง deploy ใหม่; feature ไหนไม่มี switch ถือว่ายังไม่จบ
6. **(ใหม่) "เสร็จ" = smoke ใหม่ผ่าน + eval ผ่าน + CI build ผ่าน ใน merge เดียวกัน** — เขียนโค้ดเสร็จอย่างเดียวไม่นับเป็นเสร็จ; และ SQL แตะของจริงยังต้องอนุมัติเฉพาะรายการจากเจ้าของเหมือนเดิมเสมอ
