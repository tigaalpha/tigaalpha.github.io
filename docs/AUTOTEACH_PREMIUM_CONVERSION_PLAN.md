# แผน v3: Personalized Proof Funnel — Auto Teaching เป็นเครื่องยิงขายพรีเมียม 1,490฿ (D7/D15/D30)

> แทนที่แผน v2 · สถานะ: **IMPLEMENTED (สร้างแล้ว รอ release ตามขั้นตอน PR → merge main)** · 2026-09-21

---

## v3 ต่างจาก v2 อย่างไร (และสิ่งที่ build ไปแล้ววันนี้)

v2 เสนอ cap แยกกันหลายชั้น (seenMap ต่อ popup + cap 7 วันของ proof card + day-bucket ของ closing chip) ซึ่งเสี่ยง popup ซ้อนกันหลายอันในวันเดียว และยังวาง proof surface เป็น "แถบเล็กในหน้าผลฝึก" ที่คนกำลังดีใจกับคะแนนตัวเองมักไม่ทันสังเกต v3 แก้ 3 ข้อ:

1. **ผู้ว่าการขายกลาง (central sales governor)** — `tg_sell_day`: จุดขายใหม่ทุกชนิด (d7 popup, proof popup) แบ่งสล็อตเดียวกัน **1 ครั้ง/วัน** popup เดิม (d0/d15/d29/winback) คง seenMap ของตัวเอง (ถี่กว่านี้มาก และมาก่อน) ผลลัพธ์: ผู้ใช้ trial ไม่มีวันเจอขายมากกว่า 1 ชั้น/วัน ไม่ว่าซ้อมกี่รอบ
2. **Win-moment proof popup แทน chip** — ยิงจาก event `tiga:practice-done` เมื่อวงจรการสอนปิดและดีขึ้นจริง (bestDelta ≥ +5%) เป็น popup เต็มรูปแบบของครู (เห็นชัดกว่า chip เล็ก) ภายใต้ governor + cap 7 วัน + **ไม่มีหลักฐาน = ไม่มีขาย** ตลอด
3. **แยก KPI ตามภาษา landing** — เมื่อ `profiles.signup_landing` (งาน landing-origin ที่ implement ค้างไว้แล้ว) ถูก apply ที่ DB ข้อมูล funnel ทุก event จะวิเคราะห์ conversion แยก th/en/zh ได้ (แหล่งเข้ามาต่างกัน = copy ที่ได้ผลต่างกัน)

### สิ่งที่ implement แล้ว (โค้ดจริงใน repo นี้)

| ส่วน | ไฟล์ | รายละเอียด |
|---|---|---|
| Proof stats (หลักฐานก่อน/หลังจริงจาก `tg_atip_outcomes` + `tg_practice_log`) | `use-conversion.ts` → `proofStats()` | ไม่มีข้อมูล = honest null ห้ามเลข 0 หุ่น |
| Popup d7 "พิสูจน์แล้วในสัปดาห์แรก" (วัน 5–9, มีหลักฐานเท่านั้น, ครั้งเดียว) | `convD7()` + branch ใน `convPopupFor()` | เติมช่วงเงียบ d3–d14 ของ funnel เดิม |
| Popup proof จังหวะชนะ (bestDelta ≥ +5%, cap 7 วัน, governor) | `proofPopupEligible()` | ยิงจาก `tiga:practice-done` ใน App.tsx |
| Copy ส่วนตัว + fallback generic (th/en/zh ครบทุก kind) | `personalizedBody()` | จีนเห็นจีน ไทยเห็นไทย อังกฤษเห็นอังกฤษ |
| CONV_COPY สำหรับ kind ใหม่ (`d7proof`/`proof`) 3 ภาษา | CONV_COPY | กัน crash `undefined` ตามบทเรียน onTipUpdate |
| Post-purchase activation — ครูพูดทันทีหลังจ่าย (ครั้งเดียวตลอดบัญชี) | `firstPaidActivation()` + `ACTIVATION_COPY` + watcher ใน App.tsx | ปุ่ม CTA พาไปหน้าหลักและเรียก `fetchAutoTeachTip()` ให้ครูเปิดบทสนทนาใน ≤60 วิ |
| Instrumentation ครบวงจร | `logConvEvent()` → `logUsage("conv", "<id>:shown|cta|dismissed")` | ขี่ stream เดิม ไม่สร้างตารางใหม่ — อ่านย้อนได้จาก admin → usage events |
| e2e บนโค้ดจริง (transpile ด้วย esbuild) | `scripts/verify-conversion.mjs` | **45/45 ผ่าน** — ครบ governor/fallback/cap/exclusion/3 ภาษา/activation-once |

### KPI + วิธีอ่านผล (สืบจาก §8 ด้านล่าง)

- อ่านจาก admin console: usage events `item_id` ขึ้นต้น `conv:` — `<popup>:shown` กับ `<popup>:cta` เทียบกันได้ = CTR ต่อ popup, `activation:shown` = conversion ที่แท้จริง (แผนจ่ายแล้ว)
- เป้า D7 ≥ 3% / D15 สะสม ≥ 5% / D30 สะสม ≥ 7% · popup ไหน CTR < 1% → **แก้ copy ก่อนขยับตำแหน่งเสมอ**
- เก็บ baseline 3–4 วันก่อนตัดสินใจปรับอะไร (v3 §10 ข้อ 1 ทำเสร็จแล้ว — วัดได้ทันทีตั้งแต่ build นี้ขึ้นโปรดักชัน)

---

# ต่อไปนี้ = แผน v2 เดิม (ที่มาของการออกแบบ v3 — คงไว้อ้างอิง)

> แทนที่แผน v1 · 2026-09-21

---

## 0. สิ่งที่ตรวจพบแล้วทำให้ v2 ต่างจาก v1 (ข้อเท็จจริงจากโค้ดจริง)

| ข้อเท็จจริง | ผลต่อแผน |
|---|---|
| ผู้ใช้ใหม่ทุกคนได้ **trial 30 วันแบบ premium เต็ม** อยู่แล้ว (`effectivePlan`: trial ≠ free, `premium = effectivePlan !== "free"`) | ❌ ตัด v1-A3 "free ceiling 7 ครั้ง/เดือน" ทิ้ง — ขัดกลยุทธ์ที่ owner อนุมัติแล้ว ("trial เต็มรูปแบบ ไม่มีกำแพง quota") |
| Funnel ตามวันมีอยู่แล้วใน `use-conversion.ts`: welcome d1-3 → halfway d15 → closing d29-30 → winback + banner urgent 5 วันสุดท้าย | ❌ ตัด v1 ที่เสนอ popup d15/d30 ซ้ำ — ไม่สร้างระบบทับของเดิม |
| **ปัญหาจริง: popup ทั้ง 3 อันเป็น copy กลาง ๆ** ("ครึ่งทางแล้ว ไปได้ดี!") — ไม่มีตัวเลขของผู้ใช้แม้แต่ตัวเดียว ทั้งที่ข้อมูลสร้างหลักฐานมีอยู่ครบ (`tg_atip_outcomes` วงจรปิดก่อน/หลังทุก tip) | ✅ โอกาสหลักของ v2: **ฉีดหลักฐานส่วนตัวเข้า funnel เดิมทุกจุด** |
| Auto-teach ยิงตามจังหวะการสอนอยู่แล้ว (event `tiga:practice-done`: คะแนนต่ำ <65% / ทำลายสถิติ) — แต่**ไม่มีจุดขายยิงในจังหวะชนะเลย** | ✅ โอกาสที่สอง: proof moment หลังจบเซสชันที่ดีขึ้นจริง |
| ไม่มีการวัดผล funnel เลย (ไม่รู้ CTR แต่ละ popup, ไม่รู้วันที่คนซื้อเป็นวันที่เท่า) | ✅ ต้องมี instrumentation ก่อนแก้อะไร |

**แนวคิดกลาง v2:** ระบบ funnel เดิมคือ "โครงกระดูก" ที่ดีอยู่แล้ว — v2 ไม่รื้อ แต่ทำให้ทุกจุดสัมผัส**พูดถึงตัวเลขจริงของผู้ใช้คนนั้น** เพราะการขายที่แรงที่สุดคือ "ครู AI นี่ทำให้**ฉัน**ดีขึ้นจริง +X%" ไม่ใช่คำโฆษณากลาง ๆ

---

## 1. Phase 0 — Instrumentation (ทำก่อนเสมอ, ~ครึ่งวัน)

เพิ่ม event ผ่าน `logUsage()`/`logActivity()` ที่มีอยู่ (ไม่สร้างระบบใหม่, ไม่แต่ง schema):

- `conv_d0_shown` / `conv_d7_shown` / `conv_d15_shown` / `conv_d29_shown` / `conv_wb_shown`
- `conv_cta_<id>` — กด CTA จาก popup ไหน
- `proof_shown` / `proof_cta` / `proof_dismissed`
- `premium_converted` (จุดเดียวตอน `activatePremium`/Stripe สำเร็จ — เก็บ `trialDay` ณ วันซื้อ)

**KPI ที่ต้องอ่านได้จากข้อมูลชุดนี้:**
- North star: % trial → paid (สะสม D7 / D15 / D30) และ distribution ของ `trialDay` ตอนซื้อ
- รอง: CTR ต่อ popup, dismissal rate, guardrail = จำนวนวันที่ active ของผู้ใช้ trial ต้องไม่ลด

---

## 2. Phase 1 — ทำให้ 3 popup เดิมพูดภาษาของหลักฐาน (แก้ใน `use-conversion.ts` + `App.tsx` เดิม)

**หลักการ:** โครง popup, seenMap, CTA wiring, 3 ภาษา — คงเดิมทั้งหมด เปลี่ยนเฉพาะ "เนื้อหาที่แสดง" ให้ยึดข้อมูลจริง + **มี fallback กลางเสมอ** ถ้าข้อมูลยังน้อย (ผู้ใช้ซ้อมไม่พอ = ห้ามโชว์เลข 0)

### d15 halfway → "รายงานผลครึ่งทางของคุณ"
- อ่าน `readAutoTeachOutcomes()`: จำนวนวงจรที่ improved + delta รวม + จำนวนเซสชันจาก `tg_practice_log`
- มีข้อมูล: "ครึ่งทางแล้ว — ครู TIGA ช่วยคุณแม่นขึ้น **3 จุด รวม +27%** ใน 15 วัน สถิติทั้งหมดนี้จะเดินต่อเมื่อคุณล็อกราคาไว้"
- ไม่มีข้อมูล: ใช้ copy เดิม (generic)

### d29 closing → "สิ่งที่กำลังจะหายไป — ของคุณ ไม่ใช่ของใคร"
- เพิ่มบล็อกตัวเลขส่วนตัวก่อนรายการ expiring items: จำนวนเซสชัน, ใบประกาศ/บอสที่ทำได้ (`pathDoneSet`/`bossDoneSet` มีอยู่), ความจำของครู (จำนวนจุดอ่อนที่จำได้จาก `weightedStruggles`)
- "ทดลองจบในอีก 2 วัน — 23 เซสชัน, 2 ใบประกาศ และความจำ 8 จุดของครู ยังรอคุณอยู่" + CTA PromptPay เดิม

### d0 welcome → ปรับประโยคเดียว
- เพิ่ม "อีก 30 วัน ผมจะวัดผลการซ้อมของคุณจริง ๆ แล้วรายงานให้ฟังทุกความก้าวหน้า" — ปลูกความคาดหวังว่า "มีการวัดผล" เพื่อให้ d7/d15 มีน้ำหนัก

---

## 3. Phase 2 — popup D7 "หลักฐานแรกของคุณ" (ใหม่, ใน `use-conversion.ts`)

**ทำไมต้อง d7:** เป้าหมาย owner คือแปลงให้เร็วที่สุด แต่ funnel เดิมเงียบตั้งแต่ d3–d15 พอดี — d7 คือจังหวะที่วงจรปิดอันแรกน่าจะเกิดขึ้นแล้วสำหรับคนที่ซ้อมจริง

- เงื่อนไขแสดง: `trialDay === 7` **หรือ** (≥ d5 และมี outcome improved อย่างน้อย 1 รายการ — จับคนที่พิสูจน์ตัวเองเร็ว) + ยังไม่ dismiss (seenMap `"d7"`) + plan === trial
- มี improved outcome: "พิสูจน์แล้วในสัปดาห์แรก — หลังครู TIGA แนะนำ คุณแม่นขึ้น **+12%** … ผู้ที่ล็อกราคาตอนพิสูจน์ได้ จะได้ราคานี้ตลอดไป" (framing price-lock ตาม decision 2A — **ไม่มีส่วนลด**)
- ไม่มีข้อมูลพอ: **ไม่แสดง** (ต่างจาก popup อื่น — popup นี้มีไว้สำหรับคนที่มีหลักฐานเท่านั้น คนที่ยังไม่ซ้อมให้ funnel เดิมจัดการ)

---

## 4. Phase 3 — Peak-Moment Proof Card (ต่อยอด v1-A1, ปรับให้เข้ากลยุทธ์ trial)

ตำแหน่ง: ในหน้าผลฝึก (`PracticeResultView`) เป็นแถบเล็ก dismiss ได้ — ไม่ใช่ popup กั้นจอ

- เงื่อนไข: plan === trial **และ** เซสชันนี้ `recordTipOutcome` ออกผล `improved === true` (delta ≥ +5%) **และ** frequency cap (แสดงได้ทุก 7 วัน ไม่ใช่ once-ever — เก็บ timestamp ใน localStorage ใหม่ `tg_proof_last`)
- เนื้อหา 1 บรรทัด: "📈 คำแนะนำของครูได้ผล: จุดนี้ของคุณ +12% — ล็อกครูคนนี้ไว้หลังทดลองจบ" + ปุ่มเดียว → `setPricingOpen(true)`
- ไม่แสดงถ้า: premium/admin (เช็ค `plan` จาก usePayment เสมอ), guest, ผู้ใช้เพิ่งปฏิเสธ (cap ครอบ)

**กติกาเหล็กทั้งแผน (สืบจาก v1):** สูงสุด 1 จุดขายใหม่/วัน (proof card นับรวมกับ chip ใน Phase 4), ทุกอันมีปุ่มปิดชัดเจน, ปิดแล้วเงียบตาม cap, คนจ่ายแล้ว/แอดมินไม่เห็นอะไรเลย

---

## 5. Phase 4 — Closing Surge chip (d26–30, ต่อยอด banner เดิม)

Banner urgent (≤5 วันสุดท้าย) มีอยู่แล้ว — เพิ่มเฉพาะจุดที่ banner ไปไม่ถึง:

- หลังจบเซสชันที่ accuracy ≥ 80% ในช่วง 5 วันสุดท้าย: chip ท้ายหน้าผล "คุณจบเดือนแรกด้วยผลงานชิ้นนี้ — รักษาทุกสถิติไว้ต่อ" → pricing
- Cap 1 ครั้ง/วัน (day-bucket ใหม่ แยกจาก `tg_usage` เดิมเพื่อไม่ปน quota จริง)
- นี่คือ "ยิงตอนโมเมนต์ภูมิใจ" ตรงตามหลักจังหวะการสอนที่ auto-teach ใช้อยู่แล้ว (event b: ทำลายสถิติ)

---

## 6. Phase 5 — Post-purchase Activation (กันเสียใจหลังจ่าย = กัน refund)

ตอน `activatePremium`/Stripe success สำเร็จ (ครั้งแรกของบัญชี):

- หน้ายืนยัน 1 ครั้ง: "คุณล็อกราคา 1,490฿ ตลอดไปแล้ว ✅ สิ่งที่ปลดล็อกวันนี้: …" + **ยิง `fetchAutoTeachTip()` ทันที** ให้ครูพูดก่อน 60 วินาทีแรกหลังจ่าย — พิสูจน์มูลค่าในนาทีแรก

---

## 7. ไฟล์ที่แตะ (ทั้งหมดเป็น EXTEND ของเดิม — ไม่มีไฟล์/ระบบใหม่ใหญ่)

| ไฟล์ | การเปลี่ยน | ขนาด |
|---|---|---|
| `use-conversion.ts` | +ตัวช่วยอ่าน proof stats (จาก `readAutoTeachOutcomes`/`tg_practice_log`), +`convPopupFor` เพิ่ม d7, +personalize ข้อความ d15/d29 (copy ใหม่ 3 ภาษา + fallback), +cap helpers | กลาง |
| `App.tsx` | จุดเดียวที่ render `convPopup` เดิม: ส่ง proof stats เข้า, +proof card chip ในหน้าผลฝึก, +event logging, +post-purchase activation | กลาง |
| `PracticeOverlay.tsx` | รับ prop `proofChip` (เนื้อหา+CTA) — แสดง/ไม่แสดงตัดสินฝั่ง App | เล็ก |
| `i18n.ts` / `CONV_COPY` | copy 3 ภาษา (ทุกอันมี fallback generic) | เล็ก |
| `scripts/verify-conversion-funnel.mjs` (ใหม่) | e2e ตามแนว verify-autoteach: จำลอง profile d5/d7/d15/d29 + seed `tg_atip_outcomes` → ตรวจ copy ส่วนตัวแสดง, fallback ถ้าไม่มีข้อมูล, once-per-trial, premium/admin ไม่เห็น, cap 7 วัน | กลาง |

**ไม่แตะ:** `payment.tsx` (checkout เดิม), schema/SQL (local + profile เดิมพอ), เอนจินสอน/วิเคราะห์ทั้งหมด, กลยุทธ์ quota เดิม

---

## 8. คาดการณ์ผล + เกณฑ์ตัดสินใจ

อิง benchmark เดิม (education trial→paid 2–5%, ทำดี 5–8%) — กลไก v2 ต่างจากค่า median ตรงที่ขายด้วยหลักฐานส่วนตัวซึ่งเป็นจุดแข็งเฉพาะของ TIGA:

- เป้า D7 ≥ 3% / D15 สะสม ≥ 5% / D30 สะสม ≥ 7% ของผู้ใช้ trial
- ทบทวนทุก 2 สัปดาห์: ถ้า popup ไหน CTR < 1% → แก้ copy ก่อนเสมอ แล้วค่อยพิจารณาตำแหน่ง
- ถ้า proof card CTR สูงกว่า popup d7 ชัดเจน → ถ่วงน้ำหนักไปทาง moment-based มากขึ้น (ข้อมูลตัดสิน ไม่ใช่ความรู้สึก)

## 9. ความเสี่ยงหลัก

| เสี่ยง | ป้องกัน |
|---|---|
| Popup เยอะจนรำคาญ (d0/d7/d15/d29 + card + chip) | กติกา 1 จุดขาย/วัน + ทุกอัน dismiss ได้ + seenMap ครบ + premium เห็นศูนย์ |
| ผู้ใช้ข้อมูลน้อยเจอ copy ที่เว้นวรรคแปลก ๆ | ทุก personalized block มีเงื่อนไขข้อมูลขั้นต่ำ + fallback generic เดิม |
| ทำให้รู้สึกเป็น "dark pattern" | ไม่มี countdown ปลอม ไม่มีส่วนลดหลอก — framing เดียวคือ price-lock ที่ owner อนุมัติ (2A) + ตัวเลขจริงทั้งหมด |
| แก้ funnel เดิมแล้วพัง | e2e ใหม่ + ต้องผ่าน `verify-autoteach.mjs` เดิม + build ก่อน merge ทุกครั้งตาม procedure |

## 10. ลำดับลงมือ (แต่ละขั้น = build + e2e + PR → merge main)

1. **Phase 0** instrumentation → เก็บ baseline อย่างน้อย 3-4 วัน
2. **Phase 1** ปรับ d15/d29 เป็นข้อมูลส่วนตัว (ผลตอบแทนสูงสุด ความเสี่ยงต่ำสุด — แก้ copy ในกรอบเดิม)
3. **Phase 2** popup d7
4. **Phase 3** proof card
5. **Phase 4** closing chip
6. **Phase 5** post-purchase activation
