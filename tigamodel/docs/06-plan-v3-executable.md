# 06 — แผน v3: แผนที่บังคับตัวเองได้ (Executable Plan)

ต่อจาก `04` (ทิศทาง) และ `05` (วัดได้) — v3 ตอบคำถามเดียว:
**"ใครเช็คว่าแผนเป็นจริง เมื่อไหร่ ด้วยอะไร?"** → คำตอบคือ `node scripts/plan-check.mjs`
รันได้ทุกเมื่อ โดยใครก็ได้ และมันปฏิเสธที่จะเชื่อเอกสาร — มันรัน smoke จริง

---

## ส่วนที่ 1: v3 ต่างจาก v2 ตรงไหน (จากร้อยเท่า → พันเท่า)

| ระดับ | คำถามที่ตอบ | กลไก |
|---|---|---|
| v1 (docs/04) | ทำอะไร ทำไม | ตาราง 1–10 + 3 ลูป |
| v2 (docs/05) | รู้ได้ไหมว่าสำเร็จ | baseline/เป้าตัวเลข/kill switch/anchor ต่อข้อ |
| **v3 (เอกสารนี้)** | **ใครบังคับให้เป็นจริง** | **แผนเป็นโค้ด + auditor รัน smoke จริง + สถานะอนุมัติเจ้าของเป็นข้อมูล** |

ความแข็งของ v3 มาจาก 4 คุณสมบัติของ `tigamodel/plan/plan-v3.mjs`:

1. **Deterministic** — ไม่มีนาฬิกา/สุ่ม/env คอมมิตเดิมได้แผนเดิมเสมอ CI จะ diff ได้
2. **Evidence ต้องมีจริง** — auditor ตรวจทุก path ที่อ้าง; อ้างไฟล์ที่ไม่มี = fail (และมันเคย catch ตัวเองตอนเขียน — docs/06 หาย → 22/23 จนกว่าไฟล์นี้จะถูกเขียน)
3. **Smoke ถูกรันจริง ไม่ใช่เชื่อคำบรรยาย** — ไมล์สโตน done/code ต้องผ่าน smoke ตัวจริงทุกครั้งที่ auditor รัน
4. **อนุมัติเจ้าของเป็นข้อมูล ไม่ใช่ความจำ** — `OWNER_APPROVALS` ในไฟล์คือแหล่งความจริงเดียว; ไมล์สโตนที่อ้างว่าเสร็จทั้งที่ SQL ยังไม่ได้อนุมัติ ถูกประกาศเป็น `VIOLATION` ทันที (กติกาเหล็กข้อ 6 กลายเป็นโค้ด)

## ส่วนที่ 2: สิ่งที่ส่งมอบใน v3 วันนี้

### §1 Strategy Effect Analyzer — **โค้ดเสร็จสมบูรณ์ รอเปิดสวิตช์เท่านั้น**

ปิดลูปที่หายทั้งระบบ (docs/04 §1.4: "ท่อมีครบแต่ไม่มีเครื่องอ่าน") ด้วยชิ้นส่วน:

| ชิ้น | ไฟล์ | สถานะ |
|---|---|---|
| Core: delta→weight (clamp 0.5–2.0, <5 ตัวอย่าง = 1.0) | `tigamodel/teaching/strategy-analyzer.js` | ✅ smoke 9/9 |
| เชื่อม policy จริง: reorder กฎตาม weight (first-match-wins ไม่ถูกปลอมแต้ม) | ฟังก์ชัน `applyPolicyWeights` เดียวกัน | ✅ พิสูจน์ END-TO-END ผ่าน `createTeachingPolicy()` จริงว่าเปลี่ยนการตัดสิน |
| Smoke ตามสัญญาใน docs/05 §1 ครบทุกข้อ | `tigamodel/scripts/smoke-strategy-analyzer.mjs` | ✅ 9/9 (รวม kill switch, malformed rows, stable sort) |
| SQL: `app_settings.tiga_policy_weights` + RPC set/get + seed switch-off | `supabase-policy-weights-migration.sql` | ✅ อนุมัติแล้ว — รอเจ้าของกด Run ใน SQL Editor |

ทำไม reorder ไม่ใช่ "แก้เล่น ๆ": `policy.js` เลือกกฎแรกที่ match — กฎที่ข้อมูลจริงบอกว่าได้ผล
จึงได้ลองก่อนเมื่อนักเรียนตรงเงื่อนไขหลายกฎพร้อมกัน ส่วน probability ของ state ไม่ถูกแตะ
(กติกาเหล็กข้อ 3 ยังอยู่ครบ)

**ทางเปิดใช้งานหลังอนุมัติ SQL:** top admin รัน `admin_set_policy_weights('{"enabled":true,"weights":{...}}')`
— weights มาจากการรัน analyzer กับ `admin_strategy_effectiveness` (RPC ที่ apply แล้ว)
**ทางปิด:** `enabled:false` → ทุกอุปกรณ์กลับลำดับ DEFAULT_POLICY เดิมทันที ไม่ต้อง deploy

### §4 Retrieval eval — **ส่งมอบแล้ว: KB มีตัวเลขครั้งแรกในประวัติ**

| ชิ้น | ไฟล์ | สถานะ |
|---|---|---|
| Probe 24 คำถามจริง (th/en) + scorer + gate | `tigamodel/evaluation/retrieval-eval.js` | ✅ |
| Smoke: ยิงเข้า `getKBContext()` **ตัวจริง** (production path ที่แชทใช้) | `tigamodel/scripts/smoke-retrieval.mjs` | ✅ 8/8 |

**ผล:** accuracy **100%** บน probe ที่ครอบ 19 โดเมน (เป้า ≥85%, **gate ไม้กันที่ 80% ตลอดไป** —
แก้ KB/keywords ให้ accuracy ตกต่ำกว่านี้ไม่ได้ ถ้าตก = CI แดง) รวม classic failure ที่ต้องไม่เกิด:
ถามเรื่อง pedal ต้องไม่ได้บล็อก jazz, gibberish ต้องไม่ยิงโดเมนสุ่ม, ถามเปล่า ๆ ได้ core
เล็ก (motivation+planning) ไม่ใช่ทั้ง KB — probe ออกแบบให้รู้คำตอบล่วงหน้า (known-answer)
จึงโกหกไม่ได้ และได้เรียนรู้เพิ่มว่า fallback core ของ `getKBContext` มาจาก
self-learner seeded entries จริง ไม่ใช่ค่าว่าง (ระบบพัฒนาไปจากที่ docs/04 เคยบันทึก)

### §3 ของแผน (docs/05) — กลไก plan-as-code

| ชิ้น | ไฟล์ |
|---|---|
| แผนฉบับโค้ด (14 ไมล์สโตน + กติกาเหล็ก 6 ข้อ + สถานะอนุมัติ) | `tigamodel/plan/plan-v3.mjs` |
| Auditor: evidence/DAG/รัน smoke/approvals/kill switches | `scripts/plan-check.mjs` — **ปัจจุบัน 23/23** |

## ส่วนที่ 3: วิธีใช้งาน (สำหรับเจ้าของและเอเจนต์คนถัดไป)

```bash
node scripts/plan-check.mjs        # ตรวจว่าแผนยังซื่อสัตย์ต่อความจริงใน repo
node tigamodel/scripts/smoke-strategy-analyzer.mjs   # ตัวเดียวของ §1
```

- ก่อน merge อะไรที่แตะ tigamodel: รัน plan-check — มันจะบอกเองว่าไมล์สโตนไหนโกหก
- เปลี่ยนสถานะไมล์สโตน / เพิ่มไมล์สโตน: แก้ `plan-v3.mjs` เท่านั้น (docs เดินตาม ไม่ใช่ย้อนกลับ)
- อนุมัติ SQL: พูดในบทสนทนากับเอเจนต์ → เอเจนต์เปลี่ยน `approved: true` ใน `OWNER_APPROVALS`
  พร้อม reference ข้อความอนุมัติ → จึง apply ตาม VERIFICATION ท้ายไฟล์ SQL → รัน plan-check
  ยืนยันไม่มี VIOLATION

## ส่วนที่ 4: คิวงานถัดไป (จาก `nextActions()` ของแผนจริง — ไม่ใช่ความเห็น)

**อัปเดตสถานะ 2026-09-29:** เจ้าของอนุมัติ SQL ทั้งสองตัวแล้วในบทสนทนา ("อนุญาต ให้ทำได้ทั้งสองข้อ")
— `OWNER_APPROVALS` ใน plan-v3.mjs บันทึกอนุมัติแล้ว เหลือขั้น apply ซึ่งทำได้จากเครื่องเจ้าของเท่านั้น
(sandbox ไม่มี database credential ตามธรรมเนียม repo — ทุก migration ออกแบบให้รันใน Supabase SQL Editor):

1. **Supabase SQL Editor** (project `gsaqgbracxnucdmtmcxz`) → paste → Run:
   - `supabase-learning-data-migration.sql` → แล้วรัน `node scripts/verify-learning-data.mjs` (ต้อง 21/21)
   - `supabase-policy-weights-migration.sql` → แล้วตรวจตาม VERIFICATION ท้ายไฟล์ (seed ต้องเป็น `enabled:false`)
2. **พร้อมลงมือ (ไม่ติดอะไร):** §5 Jev policy, §7 fusion, §8 governor, §10 voice
3. **ปลดล็อกทันทีเมื่อ apply เสร็จ:** §3 (แผนเฉพาะบุคคล) + §9 (KB ตามปัญหาจริง) + เปิดสวิตช์ §1 (admin_set_policy_weights)

กติกาเหล็กทั้ง 6 ข้ออยู่ใน `STEEL_RULES` ของ `plan-v3.mjs` — ฉบับโค้ดคือฉบับจริง
เอกสารนี้อธิบายมัน ไม่ได้เป็นเจ้าของมัน
