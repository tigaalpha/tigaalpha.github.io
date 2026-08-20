# Deploy อัตโนมัติ (ตั้งครั้งเดียวจบ — หลังจากนั้นไม่ต้องทำอะไรอีก)

ระบบมี workflow `bos-deploy.yml` ที่จะ **deploy เองทั้งหมด** ทุกครั้งที่โค้ดใน
`bos/supabase/**` ถูก push ขึ้น GitHub:
- ✅ deploy edge functions ทั้ง ~95 ตัว
- ✅ ตั้ง secrets ของฟังก์ชัน
- ✅ apply migrations ที่ยังไม่เคย run

**สิ่งที่ต้องทำมีครั้งเดียว: เพิ่ม GitHub secrets ประมาณ 15 นาที**
(ผมทำขั้นตอนนี้แทนคุณไม่ได้เพราะเป็นบัญชีของคุณ — แต่ทำตามนี้ได้เลย ทีละคลิก)

---

## วิธีเพิ่ม GitHub secrets (ทีละคลิก)

1. เปิด repo ใน GitHub → แถบ **Settings** (บนสุด)
2. เมนูซ้ายล่าง → **Secrets and variables** → **Actions**
3. ปุ่มเขียว **New repository secret** — เพิ่มทีละตัว:

| ชื่อ secret | ค่าที่ต้องใส่ | หาได้จากไหน |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | **จำเป็น** — token สำหรับ deploy | supabase.com → คลิกอวาตาร์มุมขวาบน → **Account settings** → **Access tokens** → **Generate new token** → คัดลอก |
| `SUPABASE_DB_PASSWORD` | **จำเป็น** — รหัสผ่านฐานข้อมูล | supabase.com → เลือกโปรเจกต์ → **Database** → ถ้าลืมรหัส กด **Reset database password** แล้วใช้รหัสใหม่ |
| `GEMINI_API_KEY` | (ถ้ามี) | aistudio.google.com → Get API key |
| `LINE_CHANNEL_SECRET` | (ถ้ามี) | LINE Developers Console → Messaging API channel |
| `LINE_CHANNEL_ACCESS_TOKEN` | (ถ้ามี) | LINE Developers Console → Messaging API → Issue |
| `GOOGLE_CLIENT_SECRET` | (ถ้ามี) | Google Cloud Console → OAuth client |
| `RESEND_API_KEY` | (ถ้ามี) | resend.com → API Keys |
| `TIKTOK_CLIENT_SECRET` | (ถ้ามี) | TikTok Developers → App |
| `X_API_SECRET` | (ถ้ามี) | developer.x.com → App |
| `CRON_SECRET` | (ไม่ต้องใส่ก็ได้) | ระบบสุ่มให้ในฐานข้อมูลแล้ว — ใส่ได้ถ้ามีของเดิม |

> **Hint:** ใส่ `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` ก่อน 2 ตัวนี้ก็พอให้
> ระบบ deploy + apply migrations ได้ ส่วน key ของ LINE/Google/Gemini/etc.
> ใส่ทีหลังเมื่อไหร่ก็ได้ — ระบบจะตั้งให้อัตโนมัติใน push ถัดไป

4. ใส่เสร็จ → บอกผม **"ใส่ secrets ครบแล้ว"** → ผมจะ push ให้อัตโนมัติ
   (หรือคุณกด push อะไรก็ได้) → ดูผลที่ GitHub → **Actions** → แท็บ
   **BOS Supabase Deploy** ต้องขึ้นเขียว ✅

---

## ถ้าอยากให้ผม deploy ให้เลยวันนี้ (ไม่ต้องรอ GitHub)

อีกทางเลือก: วาง key ลงใน Freebuff **API Keys** tab แล้วบอกผม —
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- (และ key อื่นๆ ที่มี เช่น GEMINI/LINE/RESEND)

ผมจะ deploy ฟังก์ชัน + apply migrations (0083/0084/0085) + ตั้ง secrets
ให้ทันที แล้วแอปก็จะทำงานเต็มรูปแบบทันที

---

## หลังตั้งเสร็จ — ชีวิตประจำวัน

- แก้โค้ด → push → ระบบ deploy เอง ✅
- เพิ่มฟังก์ชันใหม่ → push → deploy เอง ✅
- เพิ่ม migration ใหม่ → push → apply เอง ✅
- เปลี่ยน key → แก้ GitHub secret → push ว่างๆ → ตั้งค่าให้ใหม่ ✅

**งานที่ยังต้องใช้มือคุณ (ทำแทนไม่ได้จริงๆ):** เชื่อมบัญชีธุรกิจกับ LINE /
Google / Meta / TikTok / X ผ่านหน้าเว็บของแต่ละเจ้า — เพราะต้องยืนยันตัวตนว่า
คุณเป็นเจ้าของบัญชี (ขั้นตอนละ 5-15 นาที ตามคำแนะนำในหน้า Settings ของแอป)
