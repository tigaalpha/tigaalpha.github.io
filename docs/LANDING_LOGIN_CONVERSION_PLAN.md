# แผนพัฒนา Landing Page → เพิ่มจำนวนการล็อกอิน/สมัคร
## (Landing → Login Conversion Plan — th / en / zh) · **v3 (ปรับปรุงรอบที่ 2)**

> **v3 เปลี่ยนจาก v2 อะไร (2026-09-21):**
> ① **ตัด LINE Login ออกทั้งแผน** (เจ้าของตัดสินใจ) — แทนด้วย **Google One Tap**
> (ใช้ OAuth client เดิมที่ตั้งค่าแล้ว ไม่ต้องตั้งค่าภายนอกใหม่) ② เพิ่มมิติที่ v2 ขาด:
> **Activation** — สมัครได้แล้วต้อง "ติด" ด้วย (วัด first-lesson ≤ 24 ชม.) ไม่งั้น
> เพิ่ม signup ก็ได้แค่ตัวเลขสวยที่ไหม้ไป ③ เพิ่ม **คณิตศาสตร์การทดลองกับ traffic
> จริงที่น้อย** (v2 ตั้ง A/B แบบเก่าซึ่งสรุปไม่ได้กับ n น้อย) ④ เพิ่ม **copy ฉบับ
> พร้อมวาง** 3 ภาษา ⑤ เพิ่ม **Kill List** (สิ่งที่ห้ามทำ — กันทีมภายหลังทำพังหน้า)
> ⑥ เพิ่ม **Risk Register** ⑦ เพิ่ม **Return-visit nurture** และ **campaign-level
> attribution** (utm) — ปิดวงจรโฆษณา→หน้า→สมัคร→เรียน
>
> อ้างอิงโค้ดจริง: `landing/LandingPage1.tsx` · `landing/land-log.ts` ·
> `landing/landing-copy.ts` · `local-identity.ts` · `App.tsx` (loadProfile) ·
> `AdminActivityDashboard.tsx` · RPC `admin_landing_funnel` · ตาราง `usage_events`
>
> **เป้าหมายเดียว:** visitor → **สมัครแล้วเรียนจริง** ของ landing ทั้ง 3 ภาษา

---

## ส่วนที่ 0 — KPI, Benchmark และกฎการตัดสิน

Benchmark (Unbounce Q4-2024, 41,000 หน้า / 464M visitors): median 6.6% · ≥10% = ดี
จุดตั้งต้นเรา (จากคอมเมนต์ในโค้ด): 328 visitor → 0 สมัคร (ยุคก่อน landing v1);
21 เห็น signup card → 1 กด

| KPI | เป้า 30 วัน | เป้า 90 วัน | วัดจาก |
|---|---|---|---|
| **signed_up / visitors** (นับครบทุกสาย) | ≥ 3% | ≥ 6.6% | funnel v2 |
| view → กดเปียโน (touched) | ≥ 40% | ≥ 55% | funnel v2 |
| gate:shown → try:* | ≥ 15% | ≥ 25% | funnel v2 |
| try:* → signed_up | ≥ 35% | ≥ 50% | funnel v2 + ข้อ 4 |
| **activation: signup ที่จบบทเรียนแรก ≤ 24 ชม.** | ≥ 40% | ≥ 60% | **ใหม่ใน v3** (ข้อ 12) |
| returning share ของ traffic | < 30% | < 20% | ข้อ 3 |

**กฎทองของ v3:** ห้ามเพิ่ม signup ด้วยวิธีที่ทำ activation ตก — ตัวเลข signup ที่
ไม่เรียนต่อ = ต้นทุน Supabase/AI ฟรี ๆ ที่แบกไปเรื่อย ๆ (AI cost ต่อ trial user จริง)

---

## ส่วนที่ 1 — ข้อมูลวันนี้ (สรุป) + ช่องว่างที่ v3 ปิด

**มีอยู่แล้ว:** funnel 20+ events (view/page:xx/hero:seen/piano/q:*/ask/ai*/nudge/
gate:*/try:*/signup:email*/leave+dwell) · origin capture ครบ (stampLandingOrigin →
`profiles.signup_landing` + event `signed_up_landing:<lang>` — ทำแล้ว ไม่ทำซ้ำ) ·
admin funnel card

**ช่องว่างจริง (v3 ปิดตรงนี้):**
1. ทุก event เป็น guest — สมาชิกเก่ากลับมาเหยียบ landing มองไม่เห็น (และโดนขายซ้ำ)
2. ไม่มี anon_id → บัญชี stitching — วิเคราะห์ "ใครถึงสมัคร" ไม่ได้
3. `signed_up` สาย Google ยังไม่ถูกนับใน funnel
4. Dashboard ยังไม่แยก 3 ภาษา / ไม่แยก utm_campaign (โฆษณาก้อนไหนคุ้ม ไม่รู้)
5. **ไม่วัด activation** — signup แล้วหายไปไหน ไม่รู้ (ใหม่ v3)
6. คนที่หลุดไปแล้วกลับมาเปิด landing ซ้ำ = ถูกต้อนเริ่มใหม่เสมอ (ไม่มี nurture)
7. OTP เปิดยิงฟรี · bot ปน funnel

---

## ส่วนที่ 2 — แผน v3: 12 ข้อ + 2 ข้อความปลอดภัย (จัดลำดับด้วยคะแนน)

ลำดับ = Impact × Confidence ÷ Effort (P0 = ทำก่อนทุกกรณี)

| # | งาน | P | Impact | Effort | Confidence | Lift ที่คาด (เหตุผล) |
|---|---|---|---|---|---|---|
| 1 | Bot-filter + funnel v2 (แยก 3 ภาษา × 3 สาย × utm_campaign) | P0 | สูง | ง่าย | สูง | ไม่ lift โดยตรง แต่**ทุกการตัดสินถัดไปผิดถ้าไม่มี** |
| 2 | Returning-user detection + "ยินดีต้อนรับกลับ" hero | P0 | สูง | ง่าย | สูง | ข้อมูลสะอาด + UX เก่าไม่โดนขายซ้ำ |
| 3 | นับ signed_up สาย Google ให้ครบ (ยิง `signup:google` ทุก login จาก stamp) | P0 | สูง | ง่าย | สูง | ตัวเลข signed_up จริงอาจเพิ่ม 2-3 เท่าจากที่เห็น |
| 4 | Identity stitching (`signed_up_from:<anon_id>`) + view JOIN | P0 | สูง | ง่าย | สูง | เปิดวิเคราะห์ pre-signup ครั้งแรก |
| 5 | TTFF: hero visual-demo อัตโนมัติ + เปียโนเหนือ fold ทุกจอ | P0 | สูง | ง่าย | สูง | view→touched +10-20pt (ประตูแรกของ funnel ทั้งหมด) |
| 6 | Skip→soft-CTA (sticky บอกจะเสียอะไร + ตัวเลขจริงของคนนั้น) | P1 | กลาง | ง่าย | สูง | gate→try กลุ่ม skip +5-10pt |
| 7 | Leave-catch (dwell>45s ยังไม่เห็นข้อเสนอ → toast ยกคำถามจริงกลับมา) | P1 | กลาง | กลาง | กลาง | ชิงกลุ่มสนใจจริงก่อนหลุด |
| 8 | **Google One Tap** (แทน LINE — ใช้ client เดิม) | P1 | **สูง** | กลาง | สูง | friction ต่อการสมัครลูกศรลงแรงสุดในทุกข้อ (แตะเดียว ไม่กรอก) |
| 9 | Copy pack ใหม่ (ดราฟต์ครบ §7 — A/B ตาม §4) | P1 | กลาง | ง่าย | กลาง | gate→try +3-8pt ต่อคู่ที่ชนะ |
| 10 | OTP guard (captcha + rate ต่อ anon_id) | P1 | กลาง | ง่าย | สูง | กันต้นทุน/สแปม — ทำก่อนขยาย traffic |
| 11 | Return-visit nurture ("เมื่อวานคุณถาม… สมัครต่อได้เลย") | P1 | กลาง | ง่าย | กลาง | คนกลับมาซ้ำคือกลุ่ม convert ง่ายที่สุดที่ปัจจุบันถูกทิ้ง |
| 12 | **Activation handoff** (หลังสมัคร: พาไปเพลงแรกให้สำเร็จภายใน session แรก + วัด D1) | **P0** | **สูง** | กลาง | สูง | signup ที่ไม่เรียน = ขายที่ยังไม่จบ — เป้า ≥40% ใน 30 วัน |
| S1 | Social proof ตัวเลขจริง + auto-hide < 10 | P2 | กลาง | ง่าย | กลาง | ทำเมื่อยอดผ่าน 10/สัปดาห์เท่านั้น |
| S2 | Anonymous-first (signInAnonymously + linkIdentity — RLS ทบทวนทั้งระบบ) | P2 | **สูงมาก** | **สูง** | กลาง | friction สมัคร → ~0 ทั้งระบบ — ทำ**หลัง**ข้อมูลจาก P0/P1 บอกว่าคุ้ม |

> **ทำไม LINE ถูกแทนด้วย Google One Tap:** เป้าหมายของข้อ LINE คือ "ลด friction สมัคร"
> — One Tap ทำสิ่งเดียวกันด้วยของที่มีอยู่แล้ว (Google OAuth ตั้งค่าแล้วใน Supabase,
> แค่เพิ่ม GIS script + `try:onetap` event) ไม่มีต้นทุน setup ภายนอก และครอบคลุม
> ทุกภาษาทุกประเทศ ไม่ใช่เฉพาะไทย

### รายละเอียดข้อใหม่เฉพาะของ v3

**ข้อ 8 — Google One Tap (แทน LINE)**
- ใส่ GIS script ใน `landing/index.template.html` · แสดง One Tap ครั้งเดียวต่อ anon_id
  ต่อ 7 วัน · แสดงเมื่อ: dwell > 20s **และ** (กดเปียโนหรือถามแล้ว ≥1) — ห้ามโผล่คนเพิ่งเข้า
- สำเร็จ → `try:onetap` + `signup:onetap` · รับ ID token แล้วส่งเข้า Supabase
  `signInWithIdToken({ provider:'google', token })` (รองรับใน supabase-js)
- ตำแหน่งเสริม: ใน gate เป็นปุ่มแรกเหนือ Google ปกติ (คนที่ One Tap ไม่เด้ง ยังกดปุ่มได้)
- วัดผล: try:onetap / signed_up · เทียบ friction ก่อน-หลัง (จำนวน taps จน signed_up)

**ข้อ 11 — Return-visit nurture (ไม่ต้องแตะ DB เลย)**
- localStorage ต่อ anon_id: `{lastVisit, lastQuestion, lastLesson, playedKeys}`
- กลับมาครั้งที่ 2+: hero รองเปลี่ยนเป็น "ยินดีที่ได้เจอใหม่ — เมื่อวานคุณถาม “{q}”
  ยังไม่บันทึกคำตอบไว้ · สมัคร 30 วิ เก็บทุกอย่างไว้" + ปุ่มสมัครตรง (ไม่ผ่าน gate)
- ยิง event `return_q:shown` / `return_q:cta` · ห้ามโชว์ถ้า lastVisit เกิน 14 วัน

**ข้อ 12 — Activation handoff (ใหม่ — ปิดวงจร)**
- หลัง signed_up (ทุกสาย) redirect กลับแอปพร้อม `?welcome=1` → แอปเปิด flow
  "เพลงแรกของคุณ" ที่จบได้ใน ≤ 90 วิ (เพลงสั้นสุด + on-screen ปุ่มกดตาม) → จบ =
  confetti + โชว์ความคืบหน้าถูกเซฟ cloud แล้ว
- วัด: event `activation:first_song` ผูกกับ signup cohort (ผ่าน user_id) →
  dashboard v2 เพิ่มคอลัมน์ "D1 activated %" ต่อ ภาษา/สาย/variant — **ห้ามปรับ copy/
  variant โดยดูแค่ signed_up ตัวเดียวอีกต่อไป**

---

## ส่วนที่ 3 — วิธีทดลองที่ "ถูก" กับ traffic ของเรา (แก้จุดอ่อนของ v2)

v2 วาง A/B split คลาสสิก — **ใช้ไม่ได้กับ traffic ระดับเรา** (ที่ n≈300-1000/เดือน
การตรวจจับ lift 10pt ต้อง n ~350-400/แขน → ต้องรอหลายเดือนต่อคู่) v3 ใช้วิธี
**Sequential weekly rollout** แทน:

1. **หนึ่งการเปลี่ยนแปลงต่อสัปดาห์** (จากลำดับ P0→P1) — ไม่เปลี่ยนพร้อมกันสองอย่าง
2. วินโดว์ตัดสิน 14 วัน · เทียบ before/after ด้วย funnel v2 (distinct people)
3. **Guardrail metrics ห้ามแย่ลง:** activation % · ai:fail rate · leave rate กลาง
4. ถ้า traffic โตถึง n≥400/แขน/สัปดาห์ ค่อยเปิด split จริง (แผนข้อ 9) — ใช้ hash
   anon_id ครึ่งตัวอย่างเดิมตาม v2
5. **สูตรที่ใช้ตัดสิน:** lift = (p̂₂ − p̂₁) ต้อง > 2×SE, SE = √(p(1−p)/n) — เขียน
   คำนวณให้ใน dashboard card (แสดง "ยังสรุปไม่ได้" เมื่อ n ไม่พอ ห้ามเดา)

**เกณฑ์ตัดสินหลัง R1 (สัปดาห์ที่ 2):**
- returning share > 50% → โฆษณาโดนคนเก่า งบไป audience ใหม่ก่อน
- view→touched < 25% → ล็อกข้อ 5 ทำซ้ำก่อนอย่างอื่น
- gate→try ≥ 15% แต่ try→signed_up < 20% → ข้อ 8 (One Tap) ขึ้นก่อน
- signed_up เพิ่มแต่ activation < 25% → หยุดปรับ landing ไปแก้ข้อ 12 ทันที

---

## ส่วนที่ 4 — Copy pack พร้อมวาง (3 ภาษา — ใส่ `landing-copy.ts` ได้ทันที)

**Gate (15 วิ) — หัวการ์ด + CTA:**
- TH: หัว "เปียโนคือเรื่องของการฝึก — เก็บความคืบหน้าของคุณไว้" · CTA "สมัครฟรี 30 วัน — ไม่ต้องใส่บัตร"
- EN: "Progress only counts when it's saved — keep yours" · "Start free for 30 days — no card"
- ZH: "练习需要留下记录 — 保存你的进度" · "免费试用 30 天 — 无需刷卡"

**Sticky หลัง skip (ข้อ 6):**
- TH: "⏳ เหลือ {X} นาทีฟรี · เล่นแล้ว {N} คีย์ — สมัครเก็บผลงานนี้ไว้"
- EN: "⏳ {X} free minutes left · {N} keys played — save this session"
- ZH: "⏳ 剩余 {X} 分钟 · 已弹 {N} 键 — 保存本次进度"

**Leave-catch toast (ข้อ 7):**
- TH: "คำถาม “{q}” ของคุณยังไม่ถูกเซฟ — สมัคร 30 วิ เก็บคำตอบ + ความคืบหน้า" · ปุ่ม "เซฟด้วย Google"
- EN: "Your question “{q}” isn't saved yet — 30s to keep the answer + progress" · "Save with Google"
- ZH: "你的提问“{q}”尚未保存 — 30秒保存答案与进度" · "用 Google 保存"

**Return-visit (ข้อ 11):**
- TH: "ยินดีที่กลับมา 👋 เมื่อวานคุณถาม “{q}” — สมัครต่อให้ครบ สิทธิ์ฟรี 30 วันรออยู่"
- EN: "Welcome back 👋 Yesterday you asked “{q}” — pick up where you left off. 30-day free trial waiting"
- ZH: "欢迎回来 👋 你昨天问了“{q}” — 继续完成吧，30 天免费试用等你"

**One Tap fallback ปุ่ม (ข้อ 8):** ปุ่มเดิมทุกภาษา + badge "แตะเดียว · One tap"

> กฎ copy ทุกภาษา: ตัวเลขจริง ({N} คีย์/{X} นาที) เท่านั้น — ห้ามโม้สถิติ · ห้ามคำ
> "สุดท้าย/ด่วน" ปลอม ๆ (ผิดจริยธรรมโฆษณา + ผู้ใช้ไทยเบื่อ)

---

## ส่วนที่ 5 — Kill List (สิ่งที่**ห้าม**ทำ — ประสบการณ์/กฎหมาย/ข้อมูล)

1. ❌ ห้าม gate เปียโนหรือบทเรียนแรก — คุณค่ามาก่อนการขอ (เหตุผลที่หน้านี้เกิด)
2. ❌ ห้าม countdown ปลอม/สต็อกหมดปลอม/สังคมปลอม — PDPA + จริยธรรมโฆษณา + เจ้าของเคย
   ย้ำเรื่องกฎหมายมาก่อน
3. ❌ ห้าม email+password เป็นปุ่มแรก — OTP/Google ก่อนเสมอ (โค้ดเคยเจ็ดกับสิ่งนี้แล้ว)
4. ❌ ห้าม modal ซ้อน > 1 ชั้น หรือ gate โผล่ซ้ำหลัง skip ใน session เดียว
5. ❌ ห้ามส่งข้อมูลเด็ก (ผู้เรียนอาจเป็นเด็ก) ออกนอก analytics ที่จำเป็น — ใช้ anon
   เท่าที่ทำได้ ให้ PII น้อยที่สุดตามหลัก PDPA
6. ❌ ห้ามเปิด anonymous sign-in ก่อน RLS ผ่านการรีวิว (S2) — แขก authenticated
   ผิด policy = รูขุมขน

---

## ส่วนที่ 6 — Risk Register

| ความเสี่ยง | โอกาส | ผล | ลดความเสี่ยง |
|---|---|---|---|
| Anonymous users ถูกใช้เก็บขยะ/สแปม | กลาง | สูง (ต้นทุน) | S2 ทำทีเดียวจบ: RLS `is_anonymous` + quota ต่อ user + ลบงานที่ idle > 30 วัน (cron) |
| One Tap ไม่เด้งใน in-app browser (FB/LINE webview) | สูง | ต่ำ | มี fallback ปุ่ม Google เดิมอยู่แล้ว + `openreal` flow เดิมชวนออกเบราว์เซอร์จริง |
| OTP โดนยิงเรียงอีเมล | กลาง | กลาง (ค่าเมล/ชื่อเสียง) | ข้อ 10 captcha + rate 4 ครั้ง/ชม./anon_id |
| ตัวเลข funnel บวมจาก bot | กลาง | สูง (ตัดสินผิด) | ข้อ 1 filter + แสดง raw/raw-clean คู่กัน |
| Copy ใหม่แย่ลง | กลาง | กลาง | sequential rollout + guardrail (§3) + rollback = revert 1 commit |
| RLS พังตอน S2 | ต่ำ | **สูงมาก** | dry-run BEGIN/ROLLBACK + ทดสอบ policy ครบทุกตารางก่อน apply + ทยอย (landing ก่อน แอปหลัง) |

---

## ส่วนที่ 7 — Instrumentation spec (ให้ลูกน้อง/เอเจนต์ทำตามได้เป๊ะ)

| Event (item_id) | ยิงเมื่อ | properties เพิ่ม |
|---|---|---|
| `returning_user` | session จริงพบตอนเปิด landing | — |
| `signup:google` | แอป consume origin-stamp สำเร็จ (ทุกกรณี) | — |
| `signed_up_from:<anon_id>` | แอป first-login บันทึก stitch | — |
| `try:onetap` / `signup:onetap` | One Tap แตะ/สำเร็จ | — |
| `onetap:suppressed` | ข้ามการแสดง (in-app / เพิ่งเห็น 7 วัน) | เหตุผล |
| `return_q:shown` / `return_q:cta` | nurture แสดง/กด | lastVisitDays |
| `leavecatch:shown` / `leavecatch:cta` | toast สุดท้าย แสดง/กด | dwellSec |
| `activation:first_song` | จบเพลงแรกหลังสมัคร (แอป) | minutesSinceSignup |
| `gate:shown:<variant>` | gate แสดง (ตอนมี A/B) | variant |

ทุก event ใช้ `logLand()` เดิม (แถวเดิม คอลัมน์เดิม — **ไม่แตะ schema**) ยกเว้น
`activation:first_song` ยิงจากแอปด้วย `logUsage("land", …)` ปกติ (มี user_id อัตโนมัติ)

---

## ส่วนที่ 8 — Roadmap v3 + งาน DB ที่รออนุมัติ

| ระยะ | ข้อ | DB (รออนุมัติ) |
|---|---|---|
| **R1 (สัปดาห์ 1) วัดให้ขาว** | 1, 2, 3, 4 | `supabase-landing-funnel-v3.sql`: RPC `admin_landing_funnel_v3(p_days)` — แยกภาษา×สาย×utm + bot-filter + view `landing_signup_journeys` |
| **R2 (สัปดาห์ 2-3) ชิง lead + จบให้สมัครติด** | 5, 6, 7, 10, 11, 12 | — (frontend ล้วน) |
| **R3 (สัปดาห์ 4-6) ลด friction ถาวร** | 8, 9, S1, S2 | `supabase-landing-social-proof.sql` (RPC อ่านอย่างเดียว) · `supabase-anonymous-users-migration.sql` (S2 — dry-run + รีวิว RLS ทุกตาราง) |

**Checklist ขออนุมัติจากเจ้าของ (ครั้งเดียวจบ):**
☐ `supabase-landing-funnel-v3.sql` ☐ `supabase-landing-social-proof.sql`
☐ `supabase-anonymous-users-migration.sql` (R3 — อนุมัติทีหลังได้)

## ส่วนที่ 9 — เส้นทางข้อมูลปลายทาง (ไม่มี LINE)

```
visitor ──anon_id──► landing (TH/EN/ZH × utm_campaign)
  │  returning member? → hero "กลับมาต่อ" → แอป (นอก funnel)
  ▼
visual demo → piano → q → AI → gate/One Tap/skip-CTA/leave-catch/return-nurture
  │                                        │
  │            try:google / onetap / otp / email
  ▼                                        ▼
 signed_up (นับครบทุกสาย) ──► ?welcome=1 ──► เพลงแรก ≤ 90 วิ
                                              │
                              activation:first_song (D1) ──► dashboard
   funnel v3: ภาษา × สาย × campaign × variant × activation — ทุกช่องมี n และ SE
```
