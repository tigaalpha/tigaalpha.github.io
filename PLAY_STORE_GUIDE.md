# คู่มือขึ้น Google Play Store — TIGA.AI (Play Store Guide)

> ไทยก่อน / English below. คู่มือนี้สำหรับเจ้าของแอป — เตรียมทุกอย่างให้ครบ
> แล้วค่อยกดอัปโหลดครั้งแรก (ย้อนกลับยากหลังเปิดตัว)

## ค่าใช้จ่าย (Cost)

| รายการ | ค่าใช้จ่าย |
|---|---|
| **บัญชีนักพัฒนา Google Play** | **$25 จ่ายครั้งเดียว** (ไม่เสียรายปี) |
| Apple App Store | $99/ปี — **ไม่ต้องจ่าย** เพราะ iOS ใช้เป็น PWA (Add to Home Screen) |
| โฮสต์เว็บ/OTA | ฟรีอยู่แล้ว (GitHub Pages) |
| Supabase / AI API | เท่าที่ใช้อยู่แล้ว (ไม่มีค่าใช้จ่ายเพิ่มจากการขึ้น Play) |

**สรุป: เสียครั้งเดียว $25 (~900 บาท) ก็ขึ้นได้เลย ไม่มีค่าใช้จ่ายซ่อนเร้น**

## สถานะความพร้อมตอนนี้ (What's already ready)

- ✅ **App ID / แพ็กเกจ**: `com.tigaalpha.tigaai` — ไม่ซ้ำกับใคร
- ✅ **targetSdk 36** — ผ่านข้อกำหนดล่าสุดของ Google (ต้อง ≥35)
- ✅ **ไอคอน + Splash** — ครบทั้ง `mipmap` และ `core-splashscreen`
- ✅ **นโยบายความเป็นส่วนตัว** — `privacy-policy.html` (ไทย + อังกฤษ) → จะโฮสต์ที่
  `https://tigaalpha.github.io/privacy-policy.html` (หลัง push ไฟล์นี้ขึ้น main แล้ว)
- ✅ **ระบบอัปเดตตัวเอง (OTA)** — มีแล้ว แต่**ต้องปิดสำหรับ build ที่ลง Play** (ทำไว้แล้วในโค้ด ดูขั้นตอน 3)
- ✅ **Versioning อัตโนมัติ** — `versionCode`/`versionName` อ่านจาก `package.json` ตรงๆ
  (เช่น 13.7.18 → versionCode 130718) ขยับขึ้นทุก release อัตโนมัติ

## ขั้นตอนขึ้น Play Store (ทีละขั้น)

### 1. สร้างบัญชีนักพัฒนา Google Play
- ไปที่ https://play.google.com/console → สมัครบัญชีนักพัฒนา → จ่าย **$25** ครั้งเดียว
- รอยืนยัน (ปกติไม่กี่ชั่วโมง–2 วัน บางครั้งขอเอกสาร)

### 2. สร้าง release key (ทำครั้งเดียว เก็บให้ดี!)
```bash
keytool -genkey -v -keystore android/app/tiga-release.jks -keyalg RSA \
        -keysize 2048 -validity 10000 -alias tiga-release
```
- **สำรองไฟล์ `tiga-release.jks` + รหัสผ่าน ไว้ 2 ที่** (Google Drive + แฟลชไดรฟ์)
  — ถ้าหาย จะอัปเดตแอปบน Play ไม่ได้อีกเลย
- ก๊อป `android/keystore.properties.example` → `android/keystore.properties`
  แล้วใส่ค่าจริง (ไฟล์นี้โดน gitignore แล้ว — ไม่ขึ้น GitHub)

### 3. Build release AAB (ปิด OTA)
```bash
VITE_OTA_ENABLED=false npm run build
npx cap sync android
cd android && ./gradlew bundleRelease
```
- AAB อยู่ที่ `android/app/build/outputs/bundle/release/app-release.aab`
- `VITE_OTA_ENABLED=false` → แอปจะ**ไม่**พยายามโหลด OTA zip เอง (บน Play อัปเดต
  ต้องผ่าน Play เท่านั้น กันแอปพัง/ขัดนโยบาย) และจะไม่เด้งปุ่ม "ดาวน์โหลด APK" ด้วย
- ถ้า build บอก unsigned → แปลว่า `keystore.properties` ไม่เจอ กลับไปขั้น 2

### 4. อัปโหลด + ตั้งค่าใน Play Console
- **App signing**: เลือก "Google Play App Signing" (ค่าเริ่มต้น — ปลอดภัยสุด
  เราเก็บ upload key ส่วน Google เก็บ signing key)
- อัปโหลด AAB ข้อ 3 → กรอก **App listing**: ชื่อ/คำอธิบาย/ไอคอน/สกรีนช็อต/ฟีเจอร์กราฟิก
  (แนะนำ ภาษาไทย + อังกฤษ + จีน ให้ตรงกับในแอป)
- **Privacy policy**: URL = `https://tigaalpha.github.io/privacy-policy.html`
- **Data safety** (แบบสอบถาม): เลือกตามจริง —
  - ข้อมูลส่วนตัว: อีเมล, ชื่อ → เก็บในเครื่อง/เซิร์ฟเวอร์
  - ไมโครโฟน/กล้อง → ใช้เฉพาะตอนเปิดใช้ฟีเจอร์ (ไม่เก็บ)
  - ข้อมูลการชำระเงิน → ผู้ให้บริการภายนอก (Stripe/PromptPay ฯลฯ) แอปไม่เก็บ
  - การเข้ารหัสส่งข้อมูล (TLS) = ใช่, การลบข้อมูล = มีช่องทาง (ติดต่อเจ้าของ)
- **Content rating**: ทำแบบสอบถาม (ตอบว่าไม่มีเนื้อหาวัยผู้ใหญ่ ระบุว่ามีผู้ใช้เป็นเด็กได้ → ตั้ง "Designed for families" ถ้าต้องการ)
- **Account deletion**: Play กำหนดว่าแอปที่ให้สมัครบัญชี ต้องมีทางลบบัญชี
  (ในแอปหรือผ่านเว็บ) — ตอนนี้ใน privacy policy ระบุให้ติดต่อเจ้าของเพื่อขอลบ
  **แนะนำ**: เพิ่มปุ่ม "ลบบัญชี" ในหน้าโปรไฟล์แอปด้วย (บอกได้เลย เดี๋ยวทำให้ —
  ต้องเพิ่ม RPC ฝั่ง Supabase ซึ่งจะขออนุมัติ SQL จากคุณก่อน)

### 5. ทดสอบก่อนเปิดตัว
- ไปที่ **Testing → Internal testing** → สร้างเทสเตอร์ 1-5 คน (อีเมล Gmail) →
  กด Promote AAB ขึ้น track นี้ → ส่งลิงก์ Opt-in ให้เทสเตอร์
- เทสต์บนเครื่องจริง: ล็อกอิน, เรียน, ครู AI (เสียง ElevenLabs), ซื้อเหรียญ, อัปเดต

### 6. เปิดตัว
- Internal testing ผ่านเรียบร้อย → **Promote → Production** → กรอกประกาศนโยบาย
  (ถ้ามีใน-app purchase ต้องเปิด "Products") → กด Submit → Google ตรวจ 1-7 วัน
  (รอบแรกอาจช้า รอบถัดไปเร็ว)

## หลังเปิดตัว (Post-launch)

- **อัปเดตแอป**: push โค้ดใหม่ขึ้น main → build AAB ใหม่ด้วย `VITE_OTA_ENABLED=false`
  → versionCode ขยับอัตโนมัติ → อัปโหลด AAB ใหม่ → ตรวจผ่านภายในไม่กี่ชั่วโมง
- **OTA ในตัวแอป**: ใช้ได้เฉพาะผู้ใช้ที่ติดตั้ง APK ตรง (นอก Play) — ผู้ใช้ที่ลงจาก Play
  จะอัปเดตผ่าน Play ตามปกติ
- **ลบช่องทาง APK ตรง (แนะนำทีหลัง)**: เมื่อ Play เปิดตัวจริง อาจปิดปุ่มดาวน์โหลด APK
  ในเว็บ (อยู่ใน `App.tsx` — `showInstallPromo`) กันผู้ใช้ลงของเก่า/คนละ version
- **iOS**: ยังเป็น PWA ฟรี — ถ้าวันไหนอยากได้แอป native บน App Store ค่อยจ่าย
  $99/ปี แล้วทำตามขั้นตอนเดียวกัน (แต่ Apple ไม่อนุญาต OTA — อัปเดตผ่าน App Store เท่านั้น)

---

# English summary

- **Cost**: a one-time **$25** Google Play developer registration (no annual fee).
  Apple's $99/yr is not needed — iOS stays a PWA.
- **Ready**: package id `com.tigaalpha.tigaai`, targetSdk 36, icons/splash,
  privacy policy (`privacy-policy.html`, live at
  `https://tigaalpha.github.io/privacy-policy.html`), auto versioning.
- **Build for Play**: create a release keystore → `android/keystore.properties`
  (gitignored; template in `keystore.properties.example`) → build with
  `VITE_OTA_ENABLED=false npm run build && npx cap sync android && cd android && ./gradlew bundleRelease`.
  OTA self-update and the in-app "new APK" prompt are disabled on those builds;
  Play owns updates there.
- **Console checklist**: upload the AAB, fill listing, privacy policy URL,
  data-safety questionnaire, content rating, account-deletion path (currently
  via owner contact — an in-app delete button is recommended, needs one
  Supabase RPC, ask the developer).
- **Launch path**: Internal testing track → promote to Production. After launch,
  update = new AAB with a bumped versionCode (automatic from package.json).
