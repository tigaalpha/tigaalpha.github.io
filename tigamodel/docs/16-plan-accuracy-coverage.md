# 16 — แผนปรับปรุง: **โมเดลวัดตัวเองได้ + คลังความรู้ครบ 5 หมวดจากทั่วโลก**

คำสั่งเจ้าของ (2026-09-30 / ต่อเนื่อง 2026-10-01):
*"(1) ฟีเจอร์วัดความแม่นยำโมเดลใน TIGA MODEL LAB · (2) ตรวจ+เติม KB 5 หมวด — ดนตรี /
สอนเปียโน / การตลาดดนตรี / นวัตกรรมดนตรี / ดนตรีบำบัด จากทั่วโลก ให้ครบ ·
(3) พัฒนาโมเดลนี้ให้เก่งขึ้นอีก"*

กติกาเหล็กที่ยังใช้เหมือนเดิมทุกข้อ: คุณภาพเป็นเงื่อนไขร่วม (ข้อ 2) · ห้ามแต่งตัวเลข
(ข้อ 3) · retrieval gate ≥80% (ข้อ 5) · therapy ต้องมี wellbeing marker ใน body
(compliance A1: แหล่ง tiga-* own-work ผ่านได้) · kill switch ทุกฟีเจอร์ default OFF
(ข้อ 1 — สองชิ้นในเอกสารนี้เป็น "อ่านอย่างเดียว/ข้อมูลล้วน" จึงไม่มีสวิตช์ให้ปิด:
การ audit ไม่เปลี่ยนพฤติกรรมคำตอบใด ๆ และคลังความรู้เป็นข้อมูลที่ seed ทุกหน้าอยู่แล้ว
แบบเดียวกับคลังเดิม)

## ส่วนที่ 1: 体检 ก่อนวางแผน — วัดจริง 2026-09-30 (17,148 entries)

| หมวด | ผลตรวจ | verdict |
|---|---|---|
| ดนตรี (ทฤษฎี/สเกล/คอร์ด/แนวเพลง ฯลฯ) | 14,916 | ✅ ครบ |
| สอนเปียโน (pedagogy) | 2,296 | ✅ ครบ |
| การตลาดดนตรี | 48 (นับรวมครอบครัว marketing-family) | ⚠️ บางมาก |
| นวัตกรรมดนตรี | กระจัดกระจาย ไม่มี domain ของตัวเอง | ⚠️ บางมาก |
| ดนตรีบำบัด | 10 | ⚠️ บางมาก |

ที่มา: 68 สถาบัน (ไทย/สหรัฐ/รัสเซีย/ฝรั่งเศส/จีน/ญี่ปุ่น/เกาหลี/UK/ฮังการี/เยอรมนี/
สวิตเซอร์แลนด์/แคนาดา …) — หมวดที่ครบอยู่แล้วไม่แตะ หมวดที่บางต้องเติมแบบ
**ไม่สร้างตัวเลข ไม่ก๊อปสำนวน แหล่งเป็น tiga-*** ทั้งหมด

## ส่วนที่ 2: ชิ้นจริงรอบนี้ — TIGA MODEL LAB วัดความแม่นยำ 5 ชั้น (m50)

`evaluation/lab-accuracy.js` + wiring `runModelAccuracyAudit()` ใน web.js + tab
"🎯 ความแม่นยำ" ใน `TigamodelLab.tsx` — หน้าเดียวเห็นโมเดลทั้งตัว:

| ชั้น | วัดจาก | ตัวเลขจริง (seeded state) |
|---|---|---|
| kbRetrieval | retrieval eval 30 probes บนเส้นทาง production | 100% |
| teachingRules | policy rules 5 กรณี (gun ยิงถูกกฎ) | 100% |
| materials | exercise generator 10 หัวข้อ × 5 ระดับ + ความหลากหลาย | 100% |
| answerQuality | eval suite จริง (provider registry) | ตาม eval รอบนั้น |
| kbHealth | auditKB บนคลังจริง (ที่มา/ก๊อป/trademark/สุขภาพ) | 0 flag |

กติกาชั้นนี้: **ชั้นไหนข้อมูลไม่พอต้องบอก `unavailable` อย่างซื่อสัตย์ ห้ามเดา ห้ามแต่ง**
· ประวัติเก็บใน localStorage จำกัด 30 รอบ (ใหม่สุดอยู่บนสุด) ล้างได้ ·
state ทั้งหมดอยู่ใน `lab-accuracy` store (ไม่ useState ของ app หลัก — กติกาเดียวกับ
play-along store) · smoke `smoke-lab-accuracy.mjs` 15/15

## ส่วนที่ 3: คลัง 5 หมวด — เติม 3 หมวดบางด้วย wave สองชุด (m52)

`knowledge/global-coverage-wave.js` — 48 entries ใหม่ ภาษาไทยนำ + gloss EN/ZH,
แหล่ง `tiga-*` ทั้งหมด, ไม่มีสถิติแต่ง, teach line ทุกตัว:

| หมวด (domain) | ก่อน (2026-09-30) | หลัง wave 1 (6) | หลัง wave 2 (+10) = รอบนี้ |
|---|---|---|---|
| การตลาด music-marketing | 20 | 26 | **36** |
| นวัตกรรม innovation (domain ใหม่) | 0 | 6 | **16** |
| บำบัด music-therapy | 10 | 16 | **26** |
| **รวม entries ในคลัง** | 17,148 | 17,166 | **17,196 (+48)** |

เนื้อหาเป็น craft principle ที่ใช้จริงทั่วโลก (ไม่ใช่ภูมิศาสตร์ประดับ): release cadence /
trial lesson / recital-as-proof / word of mouth · MIDI, backing band, adaptive software,
accessible tech · community music, rhythm regulation, ISO-adjacent wellbeing framing …

**บทเรียนที่ฝังไว้เป็น gate (แก้ของจริงในรอบนี้):**
1. gloss ต้องเป็นรูป `(EN: …) (ZH: …)` — รูป `(EN: … | ZH: …)` โดน gate "ครบ 3 ภาษา"
   ของ `smoke-knowledge-pillars` (ตรวจ literal `(ZH: `)
2. ถ้อยคำ frame therapy ห้ามมีคำว่า *วินิจฉัย / แทนที่นักบำบัด* — scanner ของ
   `kb-compliance` ไม่เข้าใจการปฏิเสธ ประโยค "ไม่วินิจฉัย…" จะ flag เป็น
   `therapy-claim` เอง (เกิดขึ้นจริง 6 flag → ด่าน 6 ของ scorecard ตก → แก้เป็น
   ถ้อยคำแบบ `music-therapy.js` เดิม: "ไม่ใช่บริการทางการแพทย์")

**ส่วนที่สำคัญที่สุด — คลังต้อง "เสิร์ฟได้จริง" ไม่ใช่คลังที่ตายเฉย:**
domain `innovation` / `music-marketing` / `music-therapy` ลงทะเบียนใน
`KB_DOMAIN_LABEL` + `KB_DOMAIN_KEYWORDS` (web.js) และ `SERVED_LABELS`
(retrieval-eval) → คำถามจริงได้ `[MUSIC INNOVATION]` / `[MUSIC MARKETING]` /
`[MUSIC THERAPY]` กลับมา พร้อม probe 6 ตัวใหม่ (th/en ต่อหมวด) —

## ส่วนที่ 4: ผล verify ทั้งชุด (วัดจริง 2026-10-01)

| ด่าน | ผล |
|---|---|
| retrieval (30 probes, gate ≥80%) | 100% |
| kb-compliance (17,196 entries) | 0 flag · 13/13 |
| knowledge-pillars | 22/0 |
| smoke-coverage-wave (ใหม่) | 13/0 |
| smoke-lab-accuracy | 15/15 |
| plan-check (plan-as-code) | m50/m52 ลงทะเบียนแล้ว · รัน smoke จริงทุก milestone |
| scorecard | ด่าน 1–11 (ด่าน 11 = accuracy+coverage ใหม่) |
| build | ผ่าน |

## ส่วนที่ 5: งานถัดไปในแผน (ยังไม่ทำ — รอเจ้าของสั่ง)

- **m44/m47**: ผูก kill switch `tiga_kb_hot_path` / `tiga_cost_governor` เข้า
  app_settings (เปิด-ปิดได้ไม่ต้อง deploy)
- **m35/m48/m49**: routing สายสั้น · budget/timeout ต่อ call · สะพาน governor→router
- **m45/m46**: hot counts ข้ามเซสชัน · eval พิสูจน์ capped ไม่แพ้ legacy
- **วงจร A/B/C** ยังติดข้อมูลจริง (ห้ามปลอม): B รอ teaching_outcomes ≥50 (ตอนนี้ 5) ·
  A รอเจ้าของเปิด `tiga_personalized_plans` · C รอ learning_diagnoses ระบุทักษะ
- **ผลิตภัณฑ์**: เปิดสวิตช์ตัวไหน = คำสั่งเจ้าของเท่านั้น (default OFF เสมอ)
