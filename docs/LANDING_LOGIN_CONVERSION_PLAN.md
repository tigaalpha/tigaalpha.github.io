# แผนพัฒนา Landing Page → เพิ่มจำนวนการล็อกอิน/สมัคร
## (Landing → Login Conversion Plan — th / en / zh)

> เขียนเมื่อ 2026-09-21 · อ้างอิงโค้ดจริงทั้งหมด: `landing/LandingPage1.tsx`,
> `landing/land-log.ts`, `landing/landing-copy.ts`, `landing/landing-ai.ts`,
> `local-identity.ts`, `AdminActivityDashboard.tsx` (LandingFunnelCard),
> RPC `admin_landing_funnel`, ตาราง `usage_events`
>
> **เป้าหมายเดียวของแผนนี้:** เพิ่มอัตรา visitor → signed_up ของ landing ทั้ง 3 ภาษา
> (`/landing/`, `/landing-en/`, `/landing-zh/`) โดยใช้ข้อมูลจริงตัดสินใจ

---

## ส่วนที่ 1 — ข้อมูลที่ระบบเก็บอยู่ "วันนี้" (สิ่งที่มีจริงในโค้ด)

### 1.1 Event ที่ landing ส่งเข้า `usage_events` (kind='land') แล้ว

| Event (`item_id`) | ความหมาย | ตำแหน่งในโค้ด |
|---|---|---|
| `view` | เปิดหน้า | effect เปิดหน้า (LandingPage1:227) |
| `page:th` / `page:en` / `page:zh` | เข้าจาก URL ภาษาไหน | :228 |
| `lang:th/en/zh` | สลับภาษาเองบนหน้า | :331 |
| `hero:seen` | เปียโน hero เลื่อนเข้ามาในจอ | :271 |
| `piano` | กดคีย์เปียโนจริง | :434 |
| `q:spend`, `q:<lessonId>` | ใช้โควตาคำถาม / เลือกคำถาม canned | :388-389 |
| `ask` | ส่งคำถามเข้า AI | :511 |
| `ai`, `ai:limit`, `ai:fail` | AI ตอบ / โดนจำกัด / พัง | :548-559 |
| `nudge:shown` | การ์ดชวนสมัครกลางแชทแสดง | :552 |
| `gate:inapp`, `gate:shown`, `gate:cta`, `gate:skip` | Modal สมัคร 15 วิ: แสดง/กด CTA/ปัดทิ้ง | :445-780 |
| `try:google`, `try:email-otp`, `try:email`, `try:line` | กดปุ่มสมัครแต่ละทาง | :808-889 |
| `signup:email-otp`, `signup:email` | สมัครสำเร็จ (มี session) | :872,904 |
| `leave` (+duration_ms) | ออกจากหน้า — ได้ dwell time | :233 |
| `openreal`, `openreal-top` | กด "เปิดในเบราว์เซอร์จริง" (หนี in-app browser) | :168,986 |

### 1.2 ข้อจำกัดสำคัญของข้อมูลปัจจุบัน (ช่องว่างที่แผนนี้ปิด)

1. **ทุก event บน landing เป็น guest 100%** (`user_id: null` เสมอ — policy ของตาราง
   บังคับ) แปลว่า **"คนที่ login อยู่แล้วแล้วกลับมาเหยียบ landing" มองไม่เห็นเลยในข้อมูล**
   — ไม่รู้ว่ากี่ % ของ traffic คือสมาชิกเก่า ซึ่งเพิ่งถูก gate ต้อนให้สมัครซ้ำเป็นครั้งที่สอง
   (แย่ทั้งข้อมูลและประสบการณ์)
2. **ไม่มีการเชื่อม `anon_id` → บัญชีจริง** — เมื่อคนสมัครสำเร็จ ใน `usage_events`
   จะเกิด 2 บุคคล: แขก anon คนหนึ่ง (ที่กด try/google/signup) กับ user ใหม่อีกคนหนึ่ง
   (ที่เข้าแอป) ทำให้วิเคราะห์พฤติกรรม "ก่อนสมัคร" ของคนที่สมัครจริงไม่ได้
3. **`signed_up` นับเฉพาะอีเมล** (`signup:email*`) — สาย Google ซึ่ง redirect ออกนอกหน้า
   ไม่มี event ยืนยันความสำเร็จ (OAuth กลับเข้าที่ `/` ของแอป) ตัวเลข funnel ปลายทาง
   จึงต่ำกว่าความจริงสำหรับสาย Google
4. **`stampLandingOrigin` ยิงเฉพาะสาย Google** ณ ตอนกดปุ่ม — สาย email ไม่โดน stamp
   ทำให้ทราบภาษา origin เฉพาะบางส่วนของสมาชิกใหม่
5. Funnel RPC (`admin_landing_funnel`) รวมทั้ง 3 ภาษาเป็นการ์ดเดียว — มี `page:xx`
   แยกภาษาใน raw data แต่ dashboard ยังไม่ได้แยกโชว์ per-language → เทียบ 3 ภาษาไม่ได้

---

## ส่วนที่ 2 — แผนพัฒนา 10 ข้อ (เรียงจากคุณค่าสูงสุด → ต่ำสุด)

> แต่ละข้อ: ทำอะไร · ทำไม (ยึดข้อมูล/โค้ดจริง) · สัญญาณวัดผล · ความยาก
> ข้อ 1-2 ต้องทำก่อน เพราะข้ออื่นตัดสินใจด้วยข้อมูลที่อันนี้ปลดล็อก

### ข้อ 1 — Identity Stitching: เชื่อม anon_id กับบัญชีที่สมัคร (คุณค่าสูงสุด)
- **ทำอะไร:** เก็บ `anon_id` ปัจจุบันไว้ตอนกดปุ่มสมัครทุกทาง (`try:*`); เมื่อแอป
  เห็น session แรกของ user ใหม่ บันทึกคู่ `(user_id, anon_id, landing_lang, first_events)`
  ลงตารางใหม่ `landing_signups` (additive migration: `supabase-landing-signups-migration.sql`)
- **ทำไม:** ปิดช่องว่าง 1.2 ทั้งหมด — หลังจากนี้ตอบได้ว่า "คนที่สมัคร เล่นอะไร ถามอะไร
  ใช้กี่วินาทีก่อนตัดสินใจ" ซึ่งเป็นฐานของทุกการทดลองในข้อถัด ๆ ไป
- **วัดผล:** % signups ที่ stitch สำเร็จ · กราฟเทียบพฤติกรรม pre-signup ของคนสมัคร vs ไม่สมัคร
- **ความยาก:** กลาง (มี migration + โค้ดแอปจับ first-login)

### ข้อ 2 — แยกสมาชิกเก่าออกจาก landing funnel (logged-in detection)
- **ทำอะไร:** ตอนเปิด landing ให้เช็ค session Supabase แบบเงียบ ๆ (dynamic import เหมือน
  `getSb()` ที่มีอยู่แล้ว) ถ้ามี session: บันทึก event `land:"returning_user"` แล้ว
  **เปลี่ยน hero ทั้งหน้าเป็น "ยินดีต้อนรับกลับ — ไปเล่นต่อ"** พร้อมปุ่มเข้าแอปตรง ๆ
  ไม่กวนด้วย signup card/gate/นับเวลา
- **ทำไม:** ปิดช่องว่าง 1.1 — ประสบการณ์สมาชิกเก่าบน landing ตอนนี้คือ "โดนขายให้สมัครซ้ำ"
  และข้อมูลก็ปนเปื้อน funnel (สมาชิกเก่าเข้าไปนั่งทำ `piano`, `gate:skip` ทำให้ conversion
  ต่ำกว่าความจริง) ปิดอันนี้ทั้ง UX และข้อมูลสะอาดขึ้นพร้อมกัน
- **วัดผล:** % traffic ที่เป็น returning_user · signed_up/visitors หลังหักสมาชิกเก่า (ตัวเลขจริง)
- **ความยาก:** ง่าย-กลาง

### ข้อ 3 — Fix การนับ signed_up สาย Google + stamp origin ทุกทาง
- **ทำอะไร:** (ก) ตอน OAuth กลับเข้าแอป ให้แอปยิง event กลับ `kind:'land', item_id:'signup:google'`
  (มี `stampLandingOrigin` อยู่แล้วเป็นตัวบอกว่ามาจาก landing — ใช้ตัวตรงนี้เป็นเงื่อนไข)
  (ข) ย้าย `stampLandingOrigin(lg)` ไปเรียกใน `try:*` ทุกปุ่ม (Google + email-otp + email)
- **ทำไม:** ปิดช่องว่าง 1.3 + 1.4 — funnel ปลายทางจะครบจริง และรู้ภาษา origin ของสมาชิกใหม่ 100%
- **วัดผล:** signup:google ปรากฏใน dashboard · origin coverage 100%
- **ความยาก:** ง่าย

### ข้อ 4 — Dashboard เทียบ 3 ภาษาแยกเส้น (per-language funnel)
- **ทำอะไร:** ต่อยอด `admin_landing_funnel` (หรือ RPC ใหม่ `admin_landing_funnel_v2`)
  ให้ return แยกตาม `page:th/en/zh` + สร้าง UI เป็น 3 แถวเทียบกันใน LandingFunnelCard
- **ทำไม:** โฆษณา 3 ภาษา = งบ 3 ก้อน ถ้าภาษาหนึ่ง conversion แย่กว่าอีกสองภาษาชัดเจน
  นั่นคือปัญหา copy/ตลาด ไม่ใช่หน้า — เห็นได้ทันทีด้วยข้อมูลที่เก็บอยู่แล้ว (ข้อนี้แทบไม่ต้อง
  เก็บของใหม่เลย)
- **วัดผล:** ตารางเทียบ signed_up/visitors × 3 ภาษา ใน admin
- **ความยาก:** ง่าย (data มีอยู่แล้ว แค่ group)

### ข้อ 5 — A/B ปุ่ม/สำเนาสมัครด้วย split จาก anon_id (ครึ่งตัวอย่าง deterministic)
- **ทำอะไร:** ใช้ `anonId()` ที่มีอยู่ hash เป็น A/B (คู่/คี่): ทดสอบทีละคู่
  เช่น "ทดลองใช้ฟรี 30 วัน" vs "เริ่มเลียนเปียโนวันนี้" · Google-first vs OTP-first
  บันทึก variant ลง event (`gate:shown:v2` ฯลฯ)
- **ทำไม:** จุดรั่วใหญ่ที่สุดคือ gate→try (ตามคอมเมนต์ในโค้ดเอง: 21 เห็น card 1 กด)
  การเดา copy ด้วยความรู้สึกแพงกว่าการวัด ข้อมูลตัดสิน ต้องมี variant ในข้อมูลก่อน
- **วัดผล:** conversion ต่อ variant ใน dashboard (ข้อ 4 เพิ่มช่องแสดง)
- **ความยาก:** กลาง

### ข้อ 6 — "ประตูหลังบ้าน": คนที่ skip gate ได้ครบโควตาแล้ว เจอ CTA ที่เบาลง
- **ทำอะไร:** คนที่กด `gate:skip` → ให้สิทธิ์ต่อแบบไม่มี modal ซ้ำ (มีอยู่แล้ว) แต่เปลี่ยน
  sticky bar ล่างเป็น countdown โปร่ง ๆ "เหลืออีก X นาทีของบทเรียนฟรี — สมัครเก็บความคืบหน้า"
  พร้อมความคืบหน้าที่ทำไป (เล่นไปแล้วกี่คีย์/กี่คำถาม)
- **ทำไม:** skip ≠ ไม่สนใจ — คน skip แล้วยังเล่นต่อคือ lead ที่อบอุ่นที่สุดในหน้า
  ปัจจุบัน sticky bar เดิมไม่บอก "จะเสียอะไรถ้าไม่สมัคร" (loss aversion ยังไม่ถูกใช้)
- **วัดผล:** try:* จากกลุ่ม skip · เทียบก่อน/หลัง
- **ความยาก:** ง่าย

### ข้อ 7 — Exit-intent / leave-catch แบบมีของ (มือถือ: กดกลับหรือเลื่อนขึ้นสุดเร็ว)
- **ทำอะไร:** ก่อน `leave` event ถ้าคนยังไม่เคยเห็น signup card (`saw_signup` ยังไม่มี)
  และ dwell > 45 วิ ให้ toast สุดท้ายแบบย่อ: "คำถามที่คุณถามยังไม่ถูกเซฟ — สมัครเก็บคำตอบ + ความคืบหน้า"
  (แสดงคำถามจริงของเขากลับมา — ข้อมูลมีอยู่แล้วใน `msgs`)
- **ทำไม:** dwell median ปัจจุบัน ~2 วินาที (ตามคอมเมนต์ใน land-log) แต่คนที่อยู่ >45 วิ
  คือกลุ่มที่สนใจจริงและกำลังจะหลุดมือโดยไม่เคยเห็นข้อเสนอแม้แต่ครั้งเดียว
- **วัดผล:** % leave-catch ที่กลายเป็น try:* / signed_up
- **ความยาก:** กลาง

### ข้อ 8 — ตัดต้นทุนเวลาในการเห็นคุณค่าครั้งแรก (time-to-first-value)
- **ทำอะไร:** (ก) autoplay teaser ตอนโหลด ไม่ต้องรอ pointerdown แรก (ปัจจุบัน hero เสียง
  เริ่มหลัง interaction เพราะนโยบาย autoplay — เปลี่ยนเป็น visual-only demo ที่ไม่ต้องใช้เสียง)
  (ข) ย่อ hero copy ให้ปุ่มเปียโนอยู่เหนือ fold ทุกขนาดจอ ทั้ง 3 ภาษา
- **ทำไม:** `hero:seen`/`piano` คือประตูที่ 1 ของ funnel ทั้งหมด — ถ้าคนไม่เห็นเปียโนภายใน
  2 วิ (median dwell) ทุกอย่างถัดไปคือ 0 · วัดจาก funnel ปัจจุบันได้ทันที
- **วัดผล:** view→touched conversion เพิ่มขึ้น
- **ความยาก:** ง่าย

### ข้อ 9 — Social proof จากข้อมูลจริง (ไม่ fake)
- **ทำอะไร:** แถวบาง ๆ ใต้ signup card: "ผู้เรียนสมัครสัปดาห์นี้ N คน" (นับจาก
  `landing_signups` ในข้อ 1 ช่วง 7 วัน) + ถ้ามี N<ค่าที่น่าอาย ซ่อนอัตโนมัติ
- **ทำไม:** ตัวเลขจริงใช้ได้เมื่อมันมีขนาดพอควรเท่านั้น — ระบบซ่อนเองเมื่อยังน้อย
  กันผลย้อนแฉก และเมื่อยอดโตขึ้น social proof นี้เป็นของฟรีสำหรับ conversion
- **วัดผล:** gate→try conversion ก่อน/หลังเปิด
- **ความยาก:** ง่าย (ต่อยอดข้อ 1)

### ข้อ 10 — LINE Login คืนชีพ (เมื่อ provider พร้อม)
- **ทำอะไร:** โค้ดปุ่ม LINE มีอยู่แล้วครบ (`try:line` :828) แต่ถูกปิดเพราะ provider
  ยังไม่ตั้งค่าใน Supabase — เมื่อตั้งค่าเสร็จเพียงเปิดปุ่มกลับ (โค้ดเดิม)
- **ทำไม:** ตลาดไทย = LINE เป็น identity หลัก การสมัครด้วยอีเมลเป็น friction ใหญ่ที่สุด
  ที่เหลืออยู่ · แต่วางท้ายสุดเพราะต้องตั้งค่าภายนอก (Supabase provider + LINE Developer
  console) ไม่ใช่แค่โค้ด
- **วัดผล:** try:line / signed_up รวม เทียบกับก่อนเปิด
- **ความยาก:** โค้ดง่าย · แต่ต้องมีบัญชี LINE Developer

---

## ส่วนที่ 3 — ลำดับการทำ (roadmap 3 ช่วง)

| ช่วง | ข้อ | ผลลัพธ์ |
|---|---|---|
| **สัปดาห์ 1 — วัดให้ถูกก่อน** | 1, 2, 3 | ข้อมูล funnel สมบูรณ์ · สมาชิกเก่าไม่โดนขายซ้ำ · signed_up นับครบทุกสาย |
| **สัปดาห์ 2 — เห็นภาพ + ชิง lead อุ่น** | 4, 6, 8 | เทียบ 3 ภาษาได้ · lead กลุ่ม skip ถูกชวนแบบเบา · time-to-first-value สั้นลง |
| **สัปดาห์ 3 — ปรับจูนด้วยการทดลอง** | 5, 7, 9, 10 | A/B copy · exit-catch · social proof · LINE (เมื่อ provider พร้อม) |

**สัญญาณหยุด (stop-loss):** ถ้าหลังข้อ 1-3 พบว่า traffic landing > 70% เป็น returning_user
→ ปัญหาจริงคือ attribution ของโฆษณา (คนเก่ากลับมาเหยียบ ad) ไม่ใช่ conversion —
งบถัดไปควรไปที่กลุ่มเป้าหมายใหม่ ไม่ใช่หน้า

---

## ส่วนที่ 4 — งาน DB ที่ต้อง approval จากเจ้าของก่อน (ตาม AGENTS.md)

- `supabase-landing-signups-migration.sql` (ข้อ 1): ตารางใหม่ `landing_signups`
  (user_id PK/FK → profiles, anon_id, landing_lang, created_at, first_events jsonb)
  + RLS (admin อ่านได้, service ผูก user เอง) + index — **ยังไม่รันเอง รออนุมัติ**
- `admin_landing_funnel_v2` (ข้อ 4): create-or-replace RPC ใหม่ ไม่แตะของเดิม — **รออนุมัติ**

ทุกอย่างอื่นในแผนนี้เป็นโค้ด frontend ล้วน deploy ผ่าน main ตามปกติ

---

## ส่วนที่ 5 — เส้นทางข้อมูลหลังแผนแล้ว (เป้าหมายปลายทาง)

```
visitor (anon_id) ──view──► page:xx ──┬─► hero:seen ─► piano ─► q:* ─► ai
                                      │                                │
                          (member? ──► returning_user ─► เข้าแอปเลย)    ▼
                                                              gate/nudge ─► try:*
                                                                                   │
                                              anon_id ─── stitch ───► landing_signups
                                                                                   │
                                                          signed_up (email+google) ─► แอป
```

ทุกลูกศรมีตัวเลข distinct people + conversion ต่อ step แยกภาษา แยก variant ได้ใน
admin dashboard — ตัดสินใจทุกอย่างถัดไปด้วยข้อมูล ไม่ใช่ความรู้สึก
