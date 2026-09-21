# แผนพัฒนา Landing Page → เพิ่มจำนวนการล็อกอิน/สมัคร
## (Landing → Login Conversion Plan — th / en / zh) · **v4 (ปรับปรุงรอบที่ 3 — execution-grade)**

> **v4 ยกระดับจาก v3 อะไร:** v3 เป็นแผนที่ดีแต่ยังเป็น "เอกสาร" — v4 ทำให้เป็น
> **"ระบบปฏิบัติการ"** ที่เอาไปรันได้ทันที:
> ① **แผนเดิมมีหลุมใหญ่ตัวหนึ่ง:** ปัจจุบันแขก 80% หลุดไปก่อนสมัคร แล้วจบเลย — v4 เพิ่ม
> **Lead Capture ที่ไม่ใช่การสมัคร** (คำถาม/บทเรียนที่เก็บลงลิงก์ส่วนตัว + ที่อยู่
> คืนได้บนมือถือ = PWA install prompt แทน signup) และเพิ่ม **Viral Loop** (แชร์บัตร
> ความคืบหน้าที่มีของจริงติด utm) ซึ่งเป็นช่องเดียวที่ CAC = 0 ② เพิ่ม **หน่วย
> ประสบการณ์แรกที่พังอยู่:** bundle landing 3.4 MB single-file = first paint ช้าบน 4G
> ไทย → แผน perf มีงบหน่วงที่ชัดเจน (ทุก 100ms = conversion −1%) ③ เพิ่ม **7-14-30
> วันคุกกี้ส่งคืน** ④ เพิ่ม **runbook ผู้รับผิดชอบ + SLA + สัญญาณเตือน** ⑤ จัดงานใหม่
> เป็น **work package พร้อม accept criteria** ที่คัดลอกให้ใครก็ทำต่อได้

> อ้างอิงโค้ดจริง: `landing/LandingPage1.tsx` (1,014 บรรทัด) · `landing/land-log.ts` ·
> `landing/landing-copy.ts` · `landing/index.template.html` (og แยกภาษาครบแล้ว) ·
> `local-identity.ts` (anonId/trafficSource/stampLandingOrigin) · `App.tsx`
> (loadProfile · shareCard/navigator.share · ?challenge= loop เดิมของแอป) ·
> `AdminActivityDashboard.tsx` · bundle landing = **3.4 MB single JS**

---

## §0 KPI + สมดุลสามทางที่แผนต้องรักษา

Benchmark: median 6.6%, ≥10% = ดี (Unbounce Q4-2024) · เราตอนนี้ ~0.3-1%

| KPI | 30 วัน | 90 วัน |
|---|---|---|
| signed_up/visitors (ครบทุกสาย) | ≥ 3% | ≥ 6.6% |
| **captured_leads / visitors** (ใหม่ v4: ลิงก์คืน/PWA/install) | ≥ 8% | ≥ 15% |
| view → touched | ≥ 40% | ≥ 55% |
| gate → try | ≥ 15% | ≥ 25% |
| try → signed_up | ≥ 35% | ≥ 50% |
| **activation: จบเพลงแรก ≤ 24 ชม.** | ≥ 40% | ≥ 60% |
| **D7 retention ของ signup cohort** | ≥ 25% | ≥ 35% |
| **viral: sessions จาก share-links / ทั้งหมด** | ≥ 3% | ≥ 8% |
| First Contentful Paint (4G, โทรศัพท์ระดับกลาง) | < 2.0s | < 1.5s |

**สมดุลสามทาง (แผนไหนทำ KPI ตัวใดตก เท่ากับล้มแผนนั้น):**
Signup เพิ่ม แต่ Activation/Retention ตก = ห้าม · Lead เพิ่มแต่ Signup ตก = ปรับข้อเสนอ ·
Traffic เพิ่มแต่ FCP แย่ลง = ห้าม (ทุก 100ms ช้าลง ≈ conversion −1%)

---

## §1 ปัญหาโครงสร้างที่ v4 มองเห็นแล้ว v1-v3 มองข้าม

1. **Funnel วันนี้เป็นทางเดียว มีทางออกเดียว:** ไม่สมัคร = หายไปเลย ไม่มี "กักตัวแขก"
   ไว้คุยต่อ — แขกที่ถาม AI แล้วออก คือ lead ที่ดีที่สุดในโลกที่ระบบทิ้งทันที
2. **Landing ไม่มีวงจรของตัวเอง:** ทุก visitor ต้องมาจากโฆษณา (เงิน) — แอปหลังสมัครมี
   ?challenge= และ share แล้ว แต่ landing ไม่มีอะไรให้แชร์เลย แขกที่พอใจไม่มีทางพาเพื่อนมา
3. **3.4 MB ก่อนแตะคีย์แรก:** single-file bundle ใหญ่เกิน — บนเน็ตมือถือไทย median
   แขกอยู่ ~2 วิ แต่หน้ายังไม่พร้อมให้เล่นทัน · เสียคนก่อนเห็นของ
4. **การเดินทาง 3 ภาษาขาดตอนกลาง:** og แยกภาษาแล้ว แต่ URL แชร์ออกไปไม่พกภาษา/แคมเปญ —
   เพื่อนที่ได้ลิงก์เด้งเข้าหน้าภาษาผิด (ไทยแชร์ให้เพื่อนจีน = แขกหาย)

---

## §2 งานทั้งหมด — 4 Work Stream, 20 Work Package (พร้อม accept criteria)

### 🟦 Stream A — DATA TRUTH (ทำก่อน ทุกอย่างตัดสินด้วยมัน)

**A1. Funnel v3 RPC + bot filter** (P0 · ง่าย · 3-4 ชม.)
RPC `admin_landing_funnel_v3(p_days int default 30)` แยกแถวตาม (ภาษา × สายสมัคร ×
utm_campaign) + กรอง UA bot list + แสดง raw/clean คู่กัน + คอลัมน์ n และ SE ต่อเซลล์
✔ เสร็จเมื่อ: dashboard โชว์ตาราง 3×N ได้ และ RPC เดิมไม่โดนแตะ (or-replace ใหม่ล้วน)

**A2. Returning-user split** (P0 · ง่าย · 2 ชม.)
Landing เช็ค session (dynamic import ตาม `getSb()` pattern) → `returning_user` event +
hero สลับ "กลับมาต่อ 👋 เข้าไปเล่น" ไม่ผ่าน gate · logLand แนบ user_id เมื่อมี session
✔ เสร็จเมื่อ: funnel แสดง % returning และ signed_up/visitors "ล้วนแขก" แยกได้

**A3. นับ signup ครบทุกสาย** (P0 · ง่าย · 2 ชม.)
ย้าย `signup:google` event ออกจากเงื่อนไข `lang==null` (App.tsx block เดิม) มายิงทุก
login ที่มี stamp ✔ เสร็จเมื่อ: sum(signup events) = count(profiles ที่มี signup_landing)

**A4. Identity stitching** (P0 · ง่าย · 3 ชม.)
ตอน first-login ยิง `signed_up_from:<anon_id>` (anon_id จาก localStorage เดิม) + view
`landing_signup_journeys` JOIN พฤติกรรม pre-signup ครบ ✔ เสร็จเมื่อ: ≥90% signup มี
journey ครบจาก view เดียว

### 🟩 Stream B — FIRST EXPERIENCE (ประตูที่ 1: ให้แขกเห็นของให้ไวและเล่นจบ)

**B1. Perf: 3.4MB → เป้า <1.2MB ก่อน interactive** (P0 · กลาง · 2-3 วัน)
แยก: (ก) AI module + supabase เป็น dynamic เพิ่มขึ้นจากเดิม (ข) เสียงตัวอย่าง/คลิป
ออกเป็น lazy (ค) precompress + long-cache (หน้าแชร์ผ่าน GitHub Pages มี CDN ฟรี)
งบ: FCP <2.0s บน throttled 4G ✔ เสร็จเมื่อ: วัด Lighthouse mobile ≥ 85 + FCP เป้า

**B2. TTFF: visual demo auto-play** (P0 · ง่าย · 3 ชม.)
คีย์ hero กดเอง (visual-only ไม่มีเสียง = ไม่ติด autoplay policy) วนซ้ำ 8 วิ · เมื่อ
แขกแตะเองครั้งแรก demo หยุดทันที ✔ เสร็จเมื่อ: view→touched ≥ 40%

**B3. Copy บทเรียนแรก 3 ภาษา เหนือ fold** (P1 · ง่าย · 2 ชม.)
hero ≤ 1 บรรทัด + ปุ่มใหญ่ "เริ่มเลย ไม่ต้องสมัคร" — ตาม copy pack §6 ✔ เสร็จเมื่อ:
touched ที่ hero ไม่ต้อง scroll ≥ 60% ของ touched ทั้งหมด

**B4. Aha-instrumentation** (P0 · ง่าย · 2 ชม.)
เพิ่ม event ระดับ "อ้าว มันเล่นได้จริง": `aha:heard` (เสียงเปียโนดังครั้งแรก) ·
`aha:watched` (ดู AI เล่นคำตอบจบ ≥1 คำถาม) — สองตัวนี้คือตัวทำนาย signup ที่แม่นกว่า
dwell มาก ✔ เสร็จเมื่อ: dashboard เทียบ conversion ของคนที่มี/ไม่มี aha ได้

### 🟨 Stream C — CAPTURE & RETURN (จาก 80% ที่หลุด → กลายเป็น lead ที่คุยต่อได้)

**C1. "ส่งผลงานให้ตัวเอง" = lead ที่ไม่ใช่การสมัคร** (P0 · กลาง · 1-2 วัน) ★หัวใจ v4
หลังแขกเล่นจบคำถามแรก (aha:watched) ปุ่ม "บันทึกผลงานนี้ส่งให้ฉัน": สร้างลิงก์
`/landing/?replay=<anon_id>` ที่เปิดกลับมาเจอ "คำถาม-คำตอบ-บทเรียนที่เล่นไป" ครบ + ปุ่ม
แชร์ (Web Share) + ปุ่มบันทึกเป็น PWA/โฮมสกรีน (มือถือ) — ไม่ต้องอีเมล ไม่ต้องรหัส
(เก็บ state ฝั่ง client ผ่าน URL + localStorage; server ไม่เพิ่มตารางใน phase นี้)
✔ เสร็จเมื่อ: captured_leads ≥ 8% · 30% ของลิงก์ถูกเปิดซ้ำภายใน 7 วัน

**C2. Return-visit nurture** (P1 · ง่าย · 4 ชม.)
เปิด landing รอบสอง (มี replay/lastQuestion) → "เมื่อวานคุณถาม “{q}” — เริ่มต่อเลยไหม"
+ CTA สมัครตรง หมดอายุ 14 วัน ✔ เสร็จเมื่อ: return_q:cta → try ≥ 15%

**C3. Gate/skip/leave เดิม อัปเกรดตาม v3** (P1 — คงข้อ 6,7,10 เดิมทั้งหมด: sticky บอก
เงื่อนไขเสีย + leave-catch + OTP captcha guard) ✔ ไม่ซ้ำในเอกสารนี้ — อ้าง v3 §2 ข้อ 6,7,10

**C4. 7-14-30 นูเจิลด้วยหน้าเดิม** (P2 · ง่าย · 4 ชม.)
ลิงก์ replay อายุ 30 วัน: วัน 7/14/30 เปิดมาเจอข้อความ/ข้อเสนอต่างกัน (7: "ยังเล่นฟรีได้
อีก X นาที" · 14: ชวนสมัครจริงจัง · 30: "ข้อมูลของคุณจะถูกลบ — สมัครเก็บไว้") — ทุกอย่าง
คำนวณจาก timestamp ใน URL ไม่ต้องเก็บเซิร์ฟเวอร์ ✔ เสร็จเมื่อ: replay-link → signed_up
มีค่านอนศูนย์ใน funnel v3

### 🟪 Stream D — GROWTH LOOP (วงจรที่ CAC=0 — สิ่งที่ v1-v3 ไม่มีเลย)

**D1. Progress Share Card บน landing** (P1 · กลาง · 1 วัน)
หลัง aha:watched: "ภูมิใจเสนอความคืบหน้าของคุณ" — สร้างการ์ด (canvas → PNG) มี: คีย์ที่
เล่น · คำถามที่ถาม · บทเรียนที่ผ่าน · โลโก้ + ลิงก์ utm ที่**แนบภาษาผู้รับให้เลือก**
(ปุ่ม 3 ธง) — ใช้ navigator.share (มีไฟล์) ตกมอง clipboard ✔ เสร็จเมื่อ: share_cta ≥
5% ของคนที่เห็น · เพื่อนที่มาจาก card (utm=share,anon=<id>) เดิน funnel ถึง touched ≥ 40%

**D2. เพื่อนมาถึงถูกที่ถูกต้อง (deeplink ภาษา+แคมเปญ)** (P1 · ง่าย · 2 ชม.)
ทุกลิงก์แชร์พก `?lang=<ของผู้รับ>&utm_source=share&utm_campaign=<anon ผู้ส่ง>` — og
ของ 3 ภาษามีอยู่แล้ว (landing/index.template.html) หน้าเลือกภาษาเมื่อ lang=share ไม่ตรง
สถานที่ ✔ เสร็จเมื่อ: bounce ของ traffic สาย share < traffic สาย ad

**D3. Double-sided bonus (เมื่อ D1 ผ่าน)** (P2 · กลาง · 1 วัน)
ผู้ส่ง (เมื่อเป็นสมาชิก +30 วันฟรีหากเพื่อนสมัคร) / ผู้รับ (ลิงก์เปิดโบนัสเริ่มต้น) —
**กติกาป้องกันตุ๋น:** นับเมื่อเพื่อน *จบบทเรียนแรก* (activation) เท่านั้น ไม่ใช่แค่สมัคร
✔ เสร็จเมื่อ: ≥3% sessions มาจาก share · มีส่วนแบ่ง activation เท่ากันทั้งสองฝั่ง

**D4. One Tap ตาม v3 ข้อ 8** (P1 — คงเดิม: GIS + signInWithIdToken + `try:onetap`)

---

## §3 วิธีทดสอบ (คงของ v3 + เพิ่ม 2 กฎ)

1. Sequential weekly rollout — หนึ่งการเปลี่ยนต่อสัปดาห์ วินโดว์ 14 วัน
2. lift ต้อง > 2×SE (dashboard คำนวณ + แสดง "ยังสรุปไม่ได้" เมื่อ n ไม่พอ)
3. **กฎใหม่ A:** ทุกการทดลองต้องประกาศ guardrail ก่อนเริ่ม (activation % · ai:fail ·
   FCP) — ตัวไหนแย่ลง > 10% ยกเลิกทันทีแม้ signed_up ขึ้น
4. **กฎใหม่ B:** stream C/D วัดเป็น cohort 30 วัน ห้ามสรุปก่อนอายุ cohort ครบ
   (nurture/loop ต้องเวลา การสรุปไว = ทิ้งงานที่กำลังออกผล)

**เกณฑ์ตัดสินหลัง R1 (สัปดาห์ที่ 2)** — คง v3 เต็ม: returning>50% → งบไป audience ใหม่;
touched<25% → ล็อก B2; gate→try ดีแต่ try→signup<20% → D4; signup ขึ้น activation<25%
→ หยุด landing แก้ข้อ 12 (activation handoff) ทันที

---

## §4 Runbook (ใครทำอะไร เมื่อไร — ผู้รับงานอาจเป็นเอเจนต์รอบถัดไป)

| สัปดาห์ | งาน | ผู้รับ | SLA | สัญญาณเตือน (alert) |
|---|---|---|---|---|
| 1 | A1-A4 + B4 | 1 เอเจนต์ | PR ภายใน 5 วันทำการ | funnel v2 ว่าง 7 วัน = แจ้งเจ้าของ |
| 2 | B1 (perf) | 1 เอเจนต์ | PR + Lighthouse แนบ | FCP >2.5s บน throttled = กลับมาแก้ |
| 3 | B2 + B3 + C1 | 1 เอเจนต์ | PR ภายใน 5 วัน | view→touched ตก >10pt = revert |
| 4 | C2 + C4 + D1 | 1 เอเจนต์ | PR + ทดสอบ headless แนบ | captured_leads <3% = ปรับข้อเสนอ |
| 5-6 | D2 + D3 + C3/D4 (v3) | 1 เอเจนต์ | ตามลำดับ | share-loop share<1% = หยุด D3 |
| ต่อเนื่อง | อ่าน funnel ทุกจันทร์ + ตัดสิน sequential test | เจ้าของ+เอเจนต์ | รายงาน 1 หน้า/สัปดาห์ | — |

ทุก PR: build ผ่าน + headless flow ผ่าน 0 error + ไม่แตะ schema โดยไม่มีอนุมัติ (กฎ
AGENTS.md) + bump APP_VER + push main (เจ้าของอนุญาตล่วงหน้าแล้ว)

---

## §5 งาน DB ที่รออนุมัติ (ครบชุดเดียว — ตาม AGENTS.md ไม่รันเอง)

| ไฟล์ | ข้อ | เนื้อหา |
|---|---|---|
| `supabase-landing-funnel-v3.sql` | A1, A4 | RPC `admin_landing_funnel_v3(p_days)` + view `landing_signup_journeys` (or-replace, ไม่แตะของเดิม) |
| `supabase-landing-social-proof.sql` | S1(v3) | RPC อ่านอย่างเดียว นับ signup 7 วัน |
| `supabase-anonymous-users-migration.sql` | S2(v3) | anonymous sign-in + RLS รีวิว (dry-run BEGIN/ROLLBACK แนบ) — อนุมัติทีหลังได้ |

**ไม่มีตารางใหม่ใน phase C (replay-link) ตามดีไซน์ client-side — จงใจ เพื่อให้
Stream C ขึ้นได้โดยไม่ต้องรออนุมัติ SQL แม้แต่ไฟล์เดียว**

---

## §6 Copy pack 3 ภาษา (เพิ่มจาก v3 — ส่วนของ Stream C/D)

**C1 ปุ่มส่งผลงาน:**
- TH: "📤 ส่งผลงานนี้ให้ฉัน — เปิดใหม่ได้ทุกเมื่อ ไม่ต้องสมัคร"
- EN: "📤 Send this to me — open it again anytime, no sign-up"
- ZH: "📤 发给我 — 随时重开，无需注册"

**C4 ข้อความ 7/14/30 วัน:**
- 7 TH: "สัปดาห์แล้ว — ผลงานของคุณยังอยู่ เล่นต่ออีก {X} นาทีฟรี" / EN: "One week on —
  your work is still here. {X} free minutes left" / ZH: "一周了 — 你的作品还在，剩 {X} 分钟免费"
- 14 TH: "ครึ่งทาง — สมัคร 30 วิ เก็บทุกอย่างถาวร + ฟรี 30 วัน" / EN: "Halfway — 30s to
  keep everything forever + 30 free days" / ZH: "过半 — 30秒永久保存 + 免费30天"
- 30 TH: "ข้อมูลฝึกของคุณจะถูกลบใน 7 วัน — สมัครเก็บไว้" / EN: "Your practice data is
  deleted in 7 days — save it with an account" / ZH: "练习数据将于7天后删除 — 立即注册保存"

**D1 การ์ดแชร์ (หัวการ์ด):**
- TH: "ฉันเพิ่งเรียน “{q}” กับครูเปียโน AI — มันเล่นให้ดูจริง 🎹" · EN: "I just learned
  “{q}” with an AI piano teacher — it really plays 🎹" · ZH: "我刚跟AI钢琴老师学了
  “{q}” — 它真的会弹 🎹"

**กฎเดิมคงอยู่:** ตัวเลขจริงเท่านั้น ห้าม countdown ปลอม (PDPA + จริยธรรมโฆษณา)

---

## §7 Kill List (คง v3 เต็ม + เพิ่ม 2)

1-6 ตาม v3 (ห้าม gate บทเรียนแรก · ห้ามปลอม/ตุ๋น · ห้าม email-first · ห้าม modal ซ้อน ·
PII น้อยสุด · ห้ามเปิด anonymous ก่อน RLS รีวิว)
7. ❌ ห้ามแชร์ออกไปโดยไม่มี lang/utm ในลิงก์ — เพื่อนเข้าผิดภาษา = แขกหาย + ข้อมูลเละ
8. ❌ ห้ามทำ replay-link เก็บ PII ใด ๆ (ไม่อีเมล ไม่ชื่อ) ใน phase C — ถ้าจำเป็นต้องมี
   ให้ย้ายไป phase anonymous (S2) ที่ RLS ผ่านการรีวิวแล้วเท่านั้น

---

## §8 Risk Register (เพิ่ม 2 แถวจาก v3)

| ความเสี่ยง | โอกาส | ผล | ลด |
|---|---|---|---|
| (v3 ครบ 6 แถว — anonymous spam · One Tap in-app · OTP ยิง · bot บวม · copy แย่ · RLS พัง) | | | |
| **replay-link ถูกใช้เป็นช่องเก็บขยะ/ขนาด URL บวม** | กลาง | กลาง | จำกัด state ≤ 2KB + TTL 30 วัน + ยิง event ตรวจขนาด |
| **perf patch ทำ hero เพี้ยนบน iOS เก่า** | กลาง | กลาง | ทดสอบ headless บน iOS UA + feature-detect ทุก API ใหม่ |

---

## §9 ลำดับความคืบหน้าสรุปย่อ (ตัวเดียวเห็นทุกอย่าง)

```
Stream A (วัดให้ขาว)    □ A1 □ A2 □ A3 □ A4          ← สัปดาห์ 1
Stream B (แรกพบ)        □ B1 □ B2 □ B3 □ B4          ← สัปดาห์ 2-3
Stream C (กัก lead)     □ C1 □ C2 □ C3(v3) □ C4      ← สัปดาห์ 3-4
Stream D (วงจรโต)       □ D1 □ D2 □ D3 □ D4(v3)      ← สัปดาห์ 5-6
S (v3):                 □ OTP guard □ social proof □ anonymous-first (R3)
เป้า 90 วัน: signed_up ≥ 6.6% · capture ≥ 15% · activation ≥ 60% · share ≥ 8% · FCP < 1.5s
```
