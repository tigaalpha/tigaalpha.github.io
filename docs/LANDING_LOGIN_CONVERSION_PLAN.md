# แผนพัฒนา Landing Page → เพิ่มจำนวนการล็อกอิน/สมัคร
## (Landing → Login Conversion Plan — th / en / zh) · **v2 (ปรับปรุงรอบที่ 1)**

> v2 ปรับปรุงเมื่อ 2026-09-21 (จาก v1 ของวันเดียวกัน) — สิ่งที่เปลี่ยนในรอบนี้:
> ① ตรวจโค้ดซ้ำพบว่า **หลายข้อใน v1 ถูกทำไปแล้ว** (origin capture + `signed_up_landing`
> event + migration `supabase-signup-landing-migration.sql` มีอยู่จริง) จึงย้ายไปที่
> "ข้อที่ทำแล้ว" และปรับข้อที่ซ้ำให้เหลือแค่ส่วนที่ยังขาด ② เพิ่มกลยุทธ์ใหญ่ที่ v1 มองข้าม:
> **Supabase Anonymous Sign-In + Linking** (ผู้เยี่ยมชมมีบัญชีจริงตั้งแต่วินาทีแรก สมัคร
> = ผูก identity เท่านั้น) ③ ใส่ benchmark อุตสาหกรรม + KPI ตัวเลขจริง ④ เพิ่มคิวรักษา
> ความปลอดภัย/ความน่าเชื่อถือ (OTP-cost guard, bot filter) ⑤ ตารางงานละเอียดขึ้น
>
> อ้างอิงโค้ดจริง: `landing/LandingPage1.tsx`, `landing/land-log.ts`, `landing/landing-copy.ts`,
> `landing/landing-ai.ts`, `local-identity.ts`, `App.tsx` (loadProfile / mergeGuestProgress),
> `AdminActivityDashboard.tsx` (LandingFunnelCard), RPC `admin_landing_funnel`, ตาราง `usage_events`
>
> **เป้าหมายเดียวของแผนนี้:** เพิ่มอัตรา visitor → signed_up ของ landing ทั้ง 3 ภาษา
> (`/landing/`, `/landing-en/`, `/landing-zh/`)

---

## ส่วนที่ 0 — KPI และ Benchmark (ใหม่ใน v2)

Benchmark อุตสาหกรรม (Unbounce Conversion Benchmark Q4 2024 — 41,000 landing pages,
464M visitors): **median landing page ทั่วไป convert 6.6% · ≥10% ถือว่าดี**; หน้าประเภท
education/signup มักอยู่ราว 5–8%

ตัวเลขจริงของเราจากคอมเมนต์ในโค้ด (จุดตั้งต้นก่อน landing v1): 328 visitor → 105 ถึง
pathway → **0 สมัคร** · หลัง redesign: 21 คนเห็น signup card → 1 กด (~5% ต่อ card-view)
ซึ่งต่ำกว่า median โลกมากเมื่อวัดจาก visitor ทั้งหมด

| KPI | ปัจจุบัน (ประมาณจากโค้ด) | เป้า 30 วัน | เป้า 90 วัน |
|---|---|---|---|
| **signed_up / visitors** (นับทุกสาย) | ~0.3–1% | **≥ 3%** | **≥ 6.6% (median โลก)** |
| view → touched (กดเปียโน) | ไม่ทราบแน่ชัด — funnel มีข้อมูล | ≥ 40% | ≥ 55% |
| gate:shown → try:* | ~5% (21→1) | ≥ 15% | ≥ 25% |
| try:* → signed_up (ครบทุกสาย) | ไม่ทราบ (Google ไม่ถูกนับ) | ≥ 35% | ≥ 50% |
| returning_user share ของ traffic | มองไม่เห็น (จะวัดหลังข้อ 2) | < 30% | < 20% |

> เงื่อนไข: ตัวเลขเป้าหมายทบทวนหลังข้อมูลจริง 2 สัปดาห์แรก (หลังข้อ 1–3 เสร็จ) —
> เป้าที่ตั้งตอนนี้ตั้งบน benchmark โลก + จุดตั้งต้นจากโค้ด เท่านั้น

---

## ส่วนที่ 1 — ข้อมูลที่ระบบเก็บอยู่ "วันนี้" และช่องว่างที่เหลืออยู่จริง

### 1.1 Event ที่ landing ส่งเข้า `usage_events` (kind='land') แล้ว

| Event (`item_id`) | ความหมาย | ตำแหน่งในโค้ด |
|---|---|---|
| `view` / `page:th/en/zh` / `lang:*` | เปิดหน้า · ภาษาของ URL · สลับภาษาเอง | LandingPage1:227-331 |
| `hero:seen` · `piano` | เห็นเปียโน · กดคีย์จริง | :271, :434 |
| `q:spend`, `q:<lessonId>` · `ask` | ใช้โควตาคำถาม · ถาม AI | :388-511 |
| `ai`, `ai:limit`, `ai:fail` | AI ตอบ / โดนจำกัด / พัง | :548-559 |
| `nudge:shown` | การ์ดชวนกลางแชท | :552 |
| `gate:inapp/shown/cta/skip` | Modal สมัคร 15 วิ ครบวงจร | :445-780 |
| `try:google/email-otp/email/line` | กดปุ่มสมัครแต่ละทาง | :808-889 |
| `signup:email-otp/email` | สมัครสำเร็จ (สายอีเมล) | :872,904 |
| `leave` (+duration_ms) | dwell time | :233 |
| `openreal`, `openreal-top` | หนี in-app browser | :168,986 |

### 1.2 สิ่งที่ "ทำแล้วและใช้งานได้แล้ว" (ตรวจสอบใหม่ วันที่ 2026-09-21 — ย้ายออกจากแผน v1)

✅ **Landing-origin capture ครบวงจร** — `stampLandingOrigin(pgLang)` ยิงที่ปุ่ม Google
(:81) → แอป consume ครั้งเดียวตอน first-login → เขียน `profiles.signup_landing` + ยิง
`signed_up_landing:<lang>` เข้า analytics + เคลียร์ stamp กัน mislabel (App.tsx:9891-9909)
migration `supabase-signup-landing-migration.sql` พร้อม admin panel แยกตามภาษา
→ **ข้อ 3 และครึ่งหนึ่งของข้อ 4 ใน v1 เสร็จแล้ว ไม่ต้องทำซ้ำ**

### 1.3 ช่องว่างจริงที่ยังเหลือ (v2 แก้ตรงนี้เท่านั้น)

1. **ทุก event บน landing เป็น guest** (`user_id:null` เสมอ) — ไม่รู้ว่ากี่ % ของ traffic
   คือสมาชิกเก่าที่กลับมา และพวกเขาถูก gate ต้อนให้ "สมัครซ้ำ"
2. **ไม่มีการเชื่อม anon_id → บัญชี** — วิเคราะห์ "คนที่สมัคร ทำอะไรมาก่อน" ไม่ได้
3. **signed_up สาย Google ยังไม่ถูกนับ** — origin stamp เดินทางถึงแอปแล้ว แต่แอปยิง
   event เฉพาะเมื่อ `lang == null` (เงื่อนไข account ใหม่จริง) กรณี row ยังไม่พร้อม/
   account เก่า จะไม่มี event `signup:google` ใน funnel เลย → ตัวเลข signed_up ยังขาด
4. **Dashboard ยังไม่แยก 3 ภาษาเป็นแถวเทียบ** (`page:xx` มีใน raw data แต่ funnel card
   รวมเดียว)
5. **ไม่มีการป้องกัน/ตรวจคุณภาพข้อมูล**: bot traffic ปน funnel, OTP ฟรีถูกยิงเรียงเบอร์
   (signInWithOtp ไม่มี captcha/guard ตอนนี้)
6. **แขกที่เล่นแล้วสมัคร = เริ่มบัญชีใหม่ลอย ๆ** — `mergeGuestProgressIntoProfile` ช่วย
   รวม progress ให้แล้ว แต่ identity เปลี่ยน ทำให้ต่อพฤติกรรมก่อนสมัครไม่ได้ (ต่างจาก
   anonymous-user ของ Supabase ที่ identity เดียวกันตลอด)

---

## ส่วนที่ 2 — แผนพัฒนา v2 (10 ข้อ + 2 ข้อรักษาความปลอดภัย เรียงจากคุณค่าสูงสุด)

### ข้อ 1 — Anonymous-first: ผู้เยี่ยมชมมีบัญชีจริงตั้งแต่วินาทีแรก ★ กลยุทธ์ใหญ่ใหม่ของ v2
- **ทำอะไร:** เปิด Supabase **Anonymous Sign-Ins** — ทันทีที่เปิด landing (หรือตอนกดคีย์
  เปียโนครั้งแรก) เรียก `signInAnonymously()` แขกได้ user id จริง (JWT `is_anonymous:true`)
  ทุก event หลังจากนั้นพก `user_id` ได้ · เมื่อกดสมัคร ไม่ต้อง "สร้างบัญชีใหม่" อีกต่อไป
  แต่เป็น **`linkIdentity({provider:'google'})` / `updateUser({email})`** — identity เดียว
  กันตลอดทาง, progress บน cloud ทันที, ไม่มีบัญชี orphan
- **ทำไม:** ปิดช่องว่าง 1.3#1+#2+#6 พร้อมกัน · ตามเอกสาร Supabase: anonymous user
  แปลงเป็น permanent ด้วยการ link identity (ต้องเปิด Manual Linking) · RLS ที่มีอยู่
  ต้องทบทวนเพื่อให้ anonymous เขียนได้เฉพาะของตัวเอง (เอกสารแนะนำเช็ค `is_anonymous`
  claim ในทุก policy) — **ต้องเป็น migration ที่ระวัง และรออนุมัติก่อนรัน**
- **วัดผล:** % แขกที่มี anonymous user · signed_up/visitor เทียบก่อน-หลัง · friction
  (จำนวน field ที่ผู้ใช้กรอก) ลดจาก 3 → 0
- **ความยาก:** สูง (migration + RLS รอบด้าน) — แต่เปลี่ยนเกมที่สุด ทำเมื่อข้อ 2-4 แล้ว
- **แผนสำรอง:** ถ้า RLS ซับซ้อนเกินในรอบแรก ทำเฉพาะบน landing (เก็บ events ด้วย user_id)
  โดยแอปหลักยังใช้ guest-profile เดิม — stitch ที่ข้อ 2

### ข้อ 2 — Identity Stitching แบบไม่พึ่ง anonymous (ทำได้ทันที ไม่ต้องรอ migration)
- **ทำอะไร:** เก็บ `anon_id` ไว้ใน `localStorage` เดิม (`tg_anon_id` มีอยู่แล้ว) →
  ตอน loadProfile เจอ account ที่เพิ่งเกิด (เงื่อนไขเดียวกับ origin-capture block
  App.tsx:9891) ยิงคู่ `(user_id, anon_id)` ลง event พิเศษ `signed_up_from:<anon_id>`
  → SQL ฝั่ง dashboard JOIN กลับได้ (สร้าง view `landing_signup_journeys`)
- **ทำไม:** ได้ผลของ stitching เกือบทั้งหมดโดยไม่แตะ RLS — และกลายเป็นฐานข้อมูล
  pre-signup behavior ชุดแรกของโปรเจกต์
- **วัดผล:** % signups ที่ stitch ได้ · รายงาน "คนที่สมัคร vs ไม่สมัคร ต่างกันที่ event ไหน"
- **ความยาก:** ง่าย

### ข้อ 3 — Returning-user detection บน landing (สมาชิกเก่าไม่โดนขายซ้ำ)
- **ทำอะไร:** ตอนเปิด landing เช็ค session แบบเงียบ (dynamic import ของ supabase-client
  ตาม pattern `getSb()` ที่มีอยู่) — ถ้ามี session จริง: ยิง `returning_user` event แล้ว
  เปลี่ยน hero เป็น "ยินดีต้อนรับกลับ 👋 เข้าไปเล่นต่อ" (ปุ่มเดียว เข้า `/`) ข้าม gate/
  countdown/signup card ทั้งหมด · และ**ให้ logLand แนบ user_id ได้** เมื่อมี session
  (คง policy เดิมไว้ด้วยการส่งเป็น field แยก — ตรวจ policy insert ใน migration)
- **ทำไม:** UX สมาชิกเก่าวันนี้คือ "ถูกขายให้สมัครใหม่" และข้อมูล funnel ปนเปื้อนด้วย
  สมาชิกเก่าที่เล่นอยู่เงียบ ๆ (ตัวเลข conversion ต่ำกว่าความจริงทั้งที่ไม่ควรอยู่ใน
  population นี้เลย)
- **วัดผล:** returning share · signed_up/visitors "ล้วนแขก" หลังหัก
- **ความยาก:** ง่าย-กลาง

### ข้อ 4 — Funnel ปลายทางครบทุกสาย + เทียบ 3 ภาษาแยกแถว
- **ทำอะไร:** (ก) แอปยิง `signup:google` event ทุกครั้งที่ origin-capture block ทำงาน
  (ไม่เฉพาะ account ใหม่ — ย้าย logUsage ออกจากเงื่อนไข `lang==null` มาเป็น event ของ
  ตัวเอง) (ข) RPC ใหม่ `admin_landing_funnel_v2(p_days)` group ตาม `page:` prefix →
  LandingFunnelCard แสดง 3 แถวเทียบกัน (ต่อยอดตารางเดิม) (ค) แถว try:* แยกตามปุ่ม
  (google/otp/email) เพื่อเห็นว่าสายไหนแปลงดีสุด
- **ทำไม:** signed_up ปัจจุบันนับขาด + เทียบ 3 ภาษา/3 ปุ่มไม่ได้ ทั้งที่ data มีครบแล้ว
- **วัดผล:** ตัวเลข signed_up สมดุลกับ profiles ใหม่จริง · ตารางเทียบ 3×3 (ภาษา × สาย)
- **ความยาก:** ง่าย (RPC ใหม่ or-replace ไม่แตะของเดิม — รออนุมัติ)

### ข้อ 5 — A/B copy ปุ่มสมัครด้วย split จาก anon_id (deterministic, no flicker)
- **ทำอะไร:** hash `anonId()` → variant A/B คงที่ต่ออุปกรณ์ ทดสอบทีละคู่ 2 สัปดาห์/คู่:
  ①"ทดลองใช้ฟรี 30 วัน" vs "เริ่มเลียนเปียโนวันนี้" ② Google-first vs OTP-first (สลับลำดับ
  ปุ่มใน gate) · บันทึก `gate:shown:<variant>` · สรุปใน funnel card
- **ทำไม:** จุดรั่วที่วัดได้ชัดสุดคือ gate→try (~5%) — เดาแล้วเปลืองทุกครั้ง
- **วัดผล:** conversion per variant (ต้องมี sample ≥ ~350 คน/variant จึงสรุปได้ —
  ถ้า traffic ยังน้อย ยืดระยะ แทนการสรุปเร็ว)
- **ความยาก:** กลาง

### ข้อ 6 — เส้นทาง skip→soft-CTA: คนที่ปัด gate แต่ยังเล่น
- **ทำอะไร:** หลัง `gate:skip` เปลี่ยน sticky bar เป็น "เหลือ X นาทีของบทเรียนฟรี —
  สมัครเก็บความคืบหน้า (เล่นแล้ว N คีย์ · ถามแล้ว M คำถาม)" — ใช้ตัวเลขจริงจาก state
  ที่มีอยู่ (touched/asked)
- **ทำไม:** skip ≠ ไม่สน; คนที่ยังเล่นต่อคือ lead ร้อน แต่วันนี้ไม่มีอะไรตามหลอกไปเลย
- **วัดผล:** try:* จากกลุ่ม skip ก่อน/หลัง
- **ความยาก:** ง่าย

### ข้อ 7 — Leave-catch แบบมีของ (คนอยู่ >45 วิ ที่ยังไม่เคยเห็นข้อเสนอ)
- **ทำอะไร:** ก่อนพ้นหน้า (visibilitychange/leave window เดิมที่ยิง `leave` อยู่แล้ว)
  ถ้า dwell>45s && !saw_signup → แสดง toast สุดท้าย: "คำถาม '…' ที่คุณถาม จะถูกเก็บ
  ต่อเมื่อมีบัญชี — สมัครใน 30 วิ (Google ปุ่มเดียว)" ยกคำถามจริงของเขากลับมาจาก `msgs`
- **ทำไม:** dwell median ~2s แต่กลุ่ม >45s สนใจจริงและกำลังจะหลุดโดยไม่เคยเห็นข้อเสนอ
- **วัดผล:** % leave-catch → try/signed_up
- **ความยาก:** กลาง

### ข้อ 8 — ย่อ time-to-first-value (TTFF: time to first finger)
- **ทำอะไร:** (ก) hero เล่น visual-only demo (คีย์กดเองไร้เสียง — ไม่ติด autoplay policy)
  ทันทีที่โหลด ไม่รอ pointerdown (ข) จำกัด hero copy ≤ 1 บรรทัดทุกภาษา ให้เปียโนอยู่
  เหนือ fold ทุกจอ (ค) โหลดคำถาม canned 4 อันให้พร้อมกดก่อน AI module โหลด (la โหลด
  dynamic อยู่แล้ว)
- **ทำไม:** `piano` คือประตูที่ 1 ถ้าแขกไม่โดนคีย์ใน 2 วิ ทุกอย่างถัดไปคือศูนย์
- **วัดผล:** view→touched ≥ 40%
- **ความยาก:** ง่าย

### ข้อ 9 — Social proof จากตัวเลขจริง + auto-hide
- **ทำอะไร:** ใต้ signup card: "สัปดาห์นี้มี N คนเริ่มเรียนกับเรา" (นับจาก
  `signup_landing`/profiles 7 วันล่าสุดผ่าน RPC อ่านอย่างเดียว) — **ถ้า N < 10 ซ่อน
  อัตโนมัติ** กันผลย้อนแฉก
- **วัดผล:** gate→try ก่อน/หลังเปิด
- **ความยาก:** ง่าย

### ข้อ 10 — LINE Login (เมื่อ provider พร้อม) + ปุ่มเดียวจบ
- **ทำอะไร:** โค้ดมีครบ (`try:line` :828) — ขอแค่ตั้ง LINE channel ใน Supabase Auth
  แล้วเปิดปุ่ม · พร้อมข้อ 1 ให้ LINE เป็น `linkIdentity` ทางที่สองของ anonymous user
- **ทำไม:** ตลาดไทย = LINE; อีเมลคือ friction ที่เหลือมากที่สุด · ท้ายสุดเพราะต้องตั้ง
  ค่าภายนอก (LINE Developer console)
- **วัดผล:** try:line / signed_up รวม
- **ความยาก:** โค้ดง่าย · setup ภายนอก

### ข้อ S1 — กัน OTP ยิงฟรี (ความปลอดภัย/ต้นทุน — ทำพร้อมข้อ 5B)
- **ทำอะไร:** เพิ่ม rate-limit ฝั่ง client (นับ `try:email-otp` ต่อ anon_id/ชั่วโมง) +
  เปิด Supabase captcha (Turnstile/hCaptcha) ที่ `signInWithOtp` — เอกสาร Supabase รองรับ
  `captchaToken` ใน options
- **ทำไม:** ปุ่ม OTP เปิดให้ทุกคนยิงฟรี = ต้นทุนอีเมล + ช่องทาง spam ราชอาณาจักร
- **ความยาก:** ง่าย

### ข้อ S2 — สุขอนามัยข้อมูล funnel (bot/UA filter ใน dashboard)
- **ทำอะไร:** ใน funnel RPC v2: ตัด `ua` ที่เป็น bot/headless (รายการ fix) + ตัด
  session ที่ dwell<2s ออกจากตัว "visitors" ของ conversion (ยังแสดงรวมไว้ใน tooltip)
- **ทำไม:** A/B และ KPI ทุกตัวจะเชื่อไม่ได้ถ้าปน bot — ทำก่อนอ่านตัวเลขใด ๆ จริงจัง
- **ความยาก:** ง่าย

---

## ส่วนที่ 3 — ลำดับงาน (roadmap v2)

| ระยะ | ข้อ | งาน DB (รออนุมัติ) | ผลลัพธ์ |
|---|---|---|---|
| **R1 สัปดาห์ 1 — วัดให้ขาว** | S2, 2, 3, 4 | RPC v2 + view `landing_signup_journeys` | ตัวเลขที่เชื่อได้ · signed_up ครบ · สมาชิกเก่าไม่โดนขายซ้ำ |
| **R2 สัปดาห์ 2-3 — ชิง lead** | 6, 8, S1, 9 | — | lead กลุ่ม skip/leave ถูกชวน · TTFF สั้น · OTP ปลอดภัย |
| **R3 สัปดาห์ 4-6 — เปลี่ยนเกม** | 1, 5, 10 | **anonymous sign-in + manual linking + RLS ทบทวน** | สมัคร = ผูก identity (friction→0) · A/B copy วัดผลจริง · LINE |

**เกณฑ์ตัดสินหลัง R1 (2 สัปดาห์):**
- ถ้า returning share > 50% → ปัญหาคือ ad-attribution (คนเก่ากลับมาเหยียบ ad) —
  เลื่อนงบไปหา audience ใหม่ก่อนลงมือ R3
- ถ้า view→touched < 25% → R2 ทำข้อ 8 เป็นอันดับแรกก่อนข้ออื่น
- ถ้า gate→try ≥ 15% แต่ try→signed_up < 20% → ปัญหาอยู่ที่ฟอร์ม/provider — รีดข้อ 10
  (LINE) ขึ้นก่อน A/B copy

## ส่วนที่ 4 — งาน DB ที่รอการอนุมัติจากเจ้าของ (ตาม AGENTS.md — ไม่รันเอง)

1. `supabase-landing-funnel-v2.sql` — RPC `admin_landing_funnel_v2` (or-replace, ไม่แตะ
   ตัวเดิม) + view `landing_signup_journeys` + bot filter (ข้อ 2/4/S2)
2. `supabase-anonymous-users-migration.sql` — เปิด anonymous sign-in (ฝั่ง project
   config), ปรับ RLS ที่เกี่ยวข้องให้รู้จัก `is_anonymous`, ตาราง `landing_signups`
   (ถ้าเลือกใช้แทน view) (ข้อ 1)
3. `supabase-landing-social-proof.sql` — RPC อ่านอย่างเดียวนับ signup 7 วัน (ข้อ 9)

ทุกอย่างอื่นเป็น frontend ล้วน deploy ผ่าน main ตามปกติ

## ส่วนที่ 5 — เส้นทางข้อมูลปลายทาง (v2)

```
visitor ──signInAnonymously──► anon USER จริง (is_anonymous)
   │                                   │
   ├─ events พก user_id ครบ ───────────┤
   │                                   │
   ├─ (member เดิม? → returning_user → เข้าแอป ไม่ผ่าน funnel)
   │
   ├─ piano → q → ai → gate/leave-catch → try:*
   │                                      │
   │              linkIdentity(google|line|email OTP)  ← สมัคร = ผูก ไม่ใช่สร้าง
   ▼                                      ▼
 funnel (3 ภาษา × 3 สาย × A/B)  ◄──── signed_up (identity เดียว ต่อประวัติได้)
```

ทุก event: distinct people, conversion ต่อ step, แยกภาษา/สาย/variant, กรอง bot —
ตัดสินใจทุกอย่างถัดไปด้วยข้อมูล ไม่ใช่ความรู้สึก
