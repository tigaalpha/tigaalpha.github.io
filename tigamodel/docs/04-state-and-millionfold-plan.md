# 04 — สถานะ TIGA MODEL ล่าสุด + แผนพัฒนา "ดีขึ้นล้านเท่า"

ตรวจเมื่อ 2026-09-29 บนสาขา `claude/learning-data-v1` — ทุกตัวเลขด้านล่างมาจาก
การรัน smoke suite จริงในวันตรวจ ไม่ใช่การอ้างจากเอกสารเก่า

---

## ส่วนที่ 1: สถานะจริงวันนี้ (ตรวจแล้ว ไม่ใช่เชื่อ)

### 1.1 ผล smoke suite ทั้ง 10 ชุด — ผ่านหมดหลังแก้ 2 จุด

| Suite | ผล | หมายเหตุ |
|---|---|---|
| smoke (แกนรวม) | 43/43 ✅ | |
| smoke-expansion (KB) | 16/16 ✅ | **KB รวม 17,090 entries** (โตจาก 16,882) |
| smoke-self-learn | 9/9 ✅ | |
| smoke-reasoning (loop/graph/coach) | 14/14 ✅ | |
| smoke-measure (eval/rubric/regression) | 25/25 ✅ | |
| smoke-capability | **11/11 ✅** (เดิม 10/11) | แก้ smoke check ที่เทียบผิด — ดู 1.3 |
| smoke-diagnosis | 11/11 ✅ | |
| smoke-camera-game | 33/33 ✅ | |
| smoke-unified (100×1M) | 9/9 ✅ | |
| smoke-roadmap-1m | 24/24 ✅ | |

### 1.2 โครงสร้างที่มีจริงและถูก "ใช้จริงใน production" แล้ว

ต่างจากตอน Phase 0 (ที่จงใจไม่แตะแอป) — ตอนนี้ tigamodel ถูก import และทำงาน
ในหน้าผากของผู้เรียนจริงแล้ว ผ่าน `tigamodel/web.js` (production surface):

| ชั้น | ไฟล์ | ตัวเรียกใช้จริง (production) |
|---|---|---|
| Capability Hub — ทุกหน้าผากกิน INTENT ไม่ใช่โมดูล | `hub.js` | App.tsx, use-sight-reading, use-play-along, ProfileDashboard, AdminAIModels |
| วงจรสอน OBSERVE→…→ADAPT หลังซ้อมทุกครั้ง | `teaching/teaching-loop.js` | use-practice-mode (`runTeachingLoopForPractice`), use-play-along, use-camera-coach |
| Skill graph 80 โหนด + hint ladder + recap | `teaching/skill-graph.js`, `coach.js` | แชทจริง, PracticeOverlay (self-report + rerun loop) |
| Student model ฉีดเข้าแชทจริง | `student/student-model.js` | use-chat (`getStudentContextBlock`) |
| State estimator (probability+evidence) | `student/state-estimator.js` | PracticeOverlay, web.js |
| Practice Coach (tempo/recap/next-exercise) | `teaching/coach.js` + `generator.js` | PracticeOverlay |
| การ์ดความรู้ + ควิซ 30 วิ (server-paid gems) | `knowledge/teach-cards.js` | App.tsx Auto Teaching 2.0 |
| Eval suite 124 เคส + regression gate | `evaluation/eval-expanded.js` | Model Lab (admin tier 3) |
| Self-learner (owner master switch) | `learning/self-learner.js` | Admin → Model Lab |
| Jev typed judgment (System One) | `jev/jev-judgment.js` | ผ่าน edge function `jev-judge` (คีย์ฝั่ง server เท่านั้น) |
| Learning Data v1 (§1–§21) | `learning-data.ts` + 7 ตารางใหม่ | main.tsx, use-practice-mode, use-autoteach — **migration SQL ยังรออนุมัติ apply** |

### 1.3 สิ่งที่แก้ในวันตรวจ

1. **smoke-capability เคย fail 1 ข้อ** — ไม่ใช่บั๊กของ generator: `generateExercise`
   คืน object ใหม่ทุกครั้ง (by design) แต่ smoke เทียบด้วย identity (`!==`)
   ยืนยันแล้วว่า seeded PRNG ตรงกัน byte-for-byte (`JSON.stringify` เท่ากัน 100%)
   → แก้ smoke ให้เทียบเนื้อหา ไม่ใช่ identity — ตอนนี้ 11/11
2. คำไทยใน `teaching/generator.js` ที่ถูกตัดครึ่งคำ ("คำถามจบลงที่เร") → แก้เป็น "คำถามจบลงที่เสียงที่สอง"

### 1.4 ข้อเท็จจริงเชิงระบบที่สำคัญที่สุด

**ท่อส่งข้อมูลผลลัพธ์การสอนมีครบแล้ว แต่ยังไม่มี "เครื่องอ่าน" ที่หมุนกลับเข้าโมเดลอัตโนมัติ:**

```
สัญญาณซ้อม (practice signals)  ──▶ teaching-loop ยิงทุกครั้ง ──▶ teaching_outcomes (Supabase, apply แล้ว)
การ์ดครู + การกดตามคำแนะนำ      ──▶ learning_interventions       ──▶ learning_* v1 (SQL รออนุมัติ)
ผลซ้อม before/after             ──▶ learning_practice_events
ความจำผู้เรียน (evidence-backed) ──▶ learner_memory / learner_skill_state
                                                    │
                                                    ▼
                              ❌ ไม่มี job อ่านมาปรับ policy/KB/strategy weights อัตโนมัติ
```

นี่คือช่องว่างที่ให้คุณค่าสูงสุดของทั้งระบบ — ทุกอย่างรอบข้างสร้างไว้พร้อมแล้ว
แต่ลูปสุดท้าย "ข้อมูลจริง → โมเดลเก่งขึ้นเอง" ยังต้องมีคนมานั่งดู admin dashboard

---

## ส่วนที่ 2: แผนพัฒนา "ดีขึ้นล้านเท่า" ฉบับทำได้จริง

หลักเดิมจาก `03-roadmap-1m.md`: คุณภาพคูณกันข้ามมิติ ไม่ใช่บวกกัน
แผนนี้จึงเรียงตาม **"มิติไหนคูณได้มากที่สุดต่องานที่ลงไป"** — ไม่ใช่รายการยอดนิยม

### ตารางลำดับ 1–10 (คุณค่าสูง → ต่ำ)

| # | งาน | ทำไมคูณเลขโต | ไฟล์ที่เกี่ยว | ตรวจยังไง |
|---|---|---|---|---|
| 1 | 🔒 **Strategy Effect Analyzer** — job อ่าน `teaching_outcomes` + `learning_interventions/practice_events` รายสัปดาห์ → คำนวณ avg gain ต่อ strategy → ปรับน้ำหนัก policy table อัตโนมัติ (เขียน `app_settings.tiga_policy_weights`) | เปลี่ยนโมเดลจาก "ครูที่จำกติกาได้" เป็น "ครูที่เรียนจากนักเรียนจริงทุกสัปดาห์" — มิติ "เหมาะกับผู้เรียน" คูณทุกคำแนะนำที่ออกไป | ใหม่: `teaching/strategy-analyzer.js` + admin ปุ่มรัน | รันจริงกับข้อมูลจริง ≥30 outcomes → เห็น strategy ที่ต่างกันได้ weight ต่างกัน |
| 2 | 🔒 **Apply learning-data migration** — ปลดล็อกข้อมูลฝั่งล่างทั้งหมด (observations/diagnoses/interventions/practice/skill_state) ที่ client รออยู่แล้ว | ไม่มีข้อมูล = ข้อ 1, 3, 4 ทำไม่ได้ — นี่คือปิดวาล์วน้ำเข้าเขื่อน | `supabase-learning-data-migration.sql` (เขียนไว้แล้ว รออนุมัติ) | verification ท้ายไฟล์ + หน้า 🎓 ข้อมูลผู้เรียนใน admin มีข้อมูลจริง |
| 3 | **Personalized practice-plan ผ่าน skill_state** — เมื่อข้อ 2 apply: `learning_update_skill_state` (server-blend แล้ว) กลายเป็นแหล่ง ability ต่อทักษะ → แผนซ้อม/เพลงถัดไปอ่านจากมัน ไม่ใช่ค่าเฉลี่ยหยาบ | มิติ "เหมาะกับผู้เรียน" × "เนื้อหาถูกที่" — คนละเส้นทางจริงเป็นครั้งแรกในระดับโน้ต | `use-practice-mode.ts`, `tigamodel/teaching/coach.js`, `hub.js` | smoke ใหม่: ability ต่ำ → เลือก drill ง่ายลงจริง |
| 4 | **Retrieval eval สำหรับ KB** — 124 เคสเดิมวัด "ตอบดีไหม" แต่ไม่วัด "หยิบความรู้ถูกไหม": เพิ่ม probe ที่รู้ว่าควรเสิร์ฟ entry ไหน (keywords→expected id) | ความรู้ 17,090 entries ที่หยิบผิดเรื่องมีค่าเท่ากับ 0 — มิติ "ความถูกต้อง" คูณทั้งชั้น KB | `evaluation/eval-expanded.js` (+~20 เคส), `knowledge/knowledge-base.js` | รัน suite ใหม่ → retrieval accuracy มีตัวเลขครั้งแรก |
| 5 | **Jev ตัดสินใจ policy แทน if-else เดิม** — จุดที่ policy เลือก strategy อยู่บนกติกามือ; ใช้ `jev.judge()` แบบ `choice` เมื่อกติกาเสมอกัน/ไม่ชัด (มี fallback เป็นกติกาเดิมเสมอ) | มิติ "วิธีสอน" ได้ตัดสินใจแบบมีความน่าจะเป็น + เหตุผลแนบ โดยไม่ปรับ prompt เลย | `teaching/teaching-loop.js`, `jev/jev-judgment.js` (ผ่าน edge function เดิม) | smoke ใหม่: กรณีกติกาเสมอกัน → เรียก Jev และแนบ probability ใน response |
| 6 | **Golden answers จากนักเรียนจริง** — สรุปคำถามซ้ำของนักเรียนจริง (จาก learning_* + chat) เป็นเคส eval ใหม่ 10 เคส/สัปดาห์ ให้เจ้าของ approve | eval ที่สะท้อนคำถามจริงคูณค่าของทุกการเปลี่ยนโมเดลในอนาคต — ป้องกัน "เก่งในของที่เราแต่งเอง" | `evaluation/eval-expanded.js`, หน้า admin อนุมัติ | เคสใหม่เข้า suite + regression gate ปกป้องมันตลอดไป |
| 7 | **Multimodal fusion v1** — state estimator รับ camera verdict + rhythm report + self-report พร้อมกันแบบถ่วงน้ำหนักตาม confidence (bridge เชื่อมไว้หมดแล้วใน Phase 4) | มิติ "เข้าใจผู้เรียน" คูณเพราะเห็นสิ่งที่ข้อความเดียวบอกไม่ได้ — และทุกสัญญาณมีอยู่แล้ว แค่ยังไม่ผสม | `student/state-estimator.js`, `multimodal/interfaces.js` | smoke: สัญญาณ 3 ทางขัดกัน → ค่าที่ confidence สูงกว่าชนะ |
| 8 | **Cost governor ต่อ session** — จำกัด token/บาทตาม plan (free/premium) ที่ `model-router` + `piano-chat` | ต้นทุนที่คุมได้ = กล้าเปิดความฉลาดให้ผู้เรียนทุกคน — มิติ "ความเร็ว/สนุก" ไม่โดนตัดเพราะบิล | `providers/model-router.js`, edge function `piano-chat` | จำลอง session ฟรี 40 คำถาม → โดน throttle ก่อนเกินเพดาน |
| 9 | **KB expansion จากข้อมูลจริง** — อ่าน `top_problems` (learning_diagnoses จริง) → สั่งเขียน expansion wave ถัดไปตามปัญหาที่เจอจริง ไม่ใช่ตามรายการในหัว | ทุก entry ที่เติมตอบปัญหาจริงของผู้เรียนจริง = มิติ "ความถูกต้อง×เหมาะผู้เรียน" พร้อมกัน | `knowledge/expansion-*.js` (จาก analyzer ข้อ 1) | ปัญหา top-3 จาก dashboard มี KB entries รองรับภายใน wave ถัดไป |
| 10 | **Realtime voice (P4 เดิม)** — Voice Tutor เป็น turn-based; ยกระดับเป็น barge-in แบบเฝ้าผู้เรียน | สนุกขึ้นชัดเจน แต่ต้นทุน latency/โครงสร้างสูง — จึงอยู่ท้ายตาราง | `use-voice-tutor.ts`, `speech.ts` | ทดสอบบนเครื่องจริงเท่านั้น (native) |

🔒 = ต้องได้อนุมัติ migration ก่อน (ข้อ 2 เป็นเงื่อนไขของข้อ 1, 3, 9)

### เส้นทางที่แนะนำ (รวมเป็น 3 ลูป)

```
ลูปข้อมูล (สัปดาห์นี้):   ข้อ 2 (อนุมัติ SQL) → ข้อ 1 (analyzer) → ข้อ 3 (ใช้ skill_state จริง)
ลูปคุณภาพ (สัปดาห์หน้า):  ข้อ 4 (retrieval eval) → ข้อ 6 (golden จากของจริง) → ข้อ 9 (KB ตามปัญหาจริง)
ลูปอัจฉริยะ (ต่อจากนั้น):  ข้อ 5 (Jev ตัดสินใจ) → ข้อ 7 (fusion) → ข้อ 8 (governor) → ข้อ 10 (voice)
```

เหตุผลของลำดับ: ลูปแรกปิดวงจร "ข้อมูลจริง → โมเดลดีขึ้น" ซึ่งทำให้ทุกงานหลังจากนี้
มีตัวเลขจริงวัดผล — ถ้าทำลูปอัจฉริยะก่อน เราจะไม่มีทางรู้ว่ามันดีขึ้นจริงหรือแค่รู้สึกดี

### กติกาเหล็กที่ยังใช้เหมือนเดิม (ไม่เปลี่ยนแม้ตัวเลขดีขึ้น)

1. ห้ามผูกโมเดล — ทุก call ผ่าน `providers/` + คีย์ฝั่ง server เท่านั้น
2. ประเมินก่อนเชื่อ — เปลี่ยนอะไรที่โดนคำตอบผู้เรียน ต้องรัน eval suite ผ่าน regression gate ก่อนขึ้น
3. สังเกต ≠ สรุป — ทุก state ยังเป็น probability + confidence + evidence เท่านั้น
4. client ห้ามส่งค่า absolute เข้า DB — ยังเดินผ่าน RPC additive/blend ฝั่ง server เหมือนเดิม
