# TIGA.AI — Google Play listing pack (copy-paste ready)

Package: `com.tigaalpha.tigaai` · Privacy policy: https://tigaalpha.github.io/privacy-policy.html
Graphics: `store-assets/icon-512.png` (512x512, full-bleed, Play rounds it itself), `store-assets/feature-graphic-1024x500.png`.
Screenshots (2–8, phone, 16:9 or 9:16, min 320 px): take them from a release build on a real phone — Pathway, Practice, AI Teacher, Games, Play Along.

## Build for Play (the OTA / purchase switch is ONE flag)
`VITE_OTA_ENABLED=false npm run build && npx cap sync android && cd android && ./gradlew bundleRelease`
That flag also turns on the Play build rules: self-update off, **no pricing, checkout or "keep Premium" screen** (Play only allows digital subscriptions through Google Play Billing). Members who already pay keep every feature (plan is read from the account); buying happens on the website.

## Store listing text

### English (default)
- **App name (≤30):** TIGA.AI — Learn Piano
- **Short description (≤80):** Learn piano with real songs, an AI teacher, ear training and games.
- **Full description (≤4000):**
TIGA.AI teaches you piano step by step, in Thai, English or Chinese.
• Learning Pathway: scales, intervals, chords and sight-reading, one clear step at a time.
• Play Along: falling-note songs with a live backing band, from folk and classical to jazz — thousands of pieces.
• AI Teacher and Daily Mentor: ask a question, get a short answer you can play on the keyboard, and a daily plan built from your own practice.
• Practice mode: play on any piano or the on-screen keys; the app listens and tells you which notes to fix.
• Ear training, note reading and video lessons.
• Games that you charge by learning: fight, explore and shoot aliens — and answer music questions along the way.
Free to start, with a 7-day trial of every feature. Needs an internet connection.

### ไทย
- **ชื่อ:** TIGA.AI — เรียนเปียโน
- **คำอธิบายสั้น:** เรียนเปียโนด้วยเพลงจริง ครู AI ฝึกหู และเกมสนุก
- **คำอธิบายเต็ม:**
TIGA.AI สอนเปียโนทีละขั้น ใช้ได้ทั้งภาษาไทย อังกฤษ และจีน
• เส้นทางการเรียนรู้: สเกล ช่วงเสียง คอร์ด และการอ่านโน้ต ทีละก้าวที่ชัดเจน
• Play Along: เล่นตามโน้ตที่ไหลลงมา พร้อมวงดนตรีประกอบ ตั้งแต่เพลงพื้นบ้าน คลาสสิก ไปจนถึงแจ๊ส หลายพันเพลง
• ครู AI และ Daily Mentor: ถามคำถามแล้วได้คำตอบสั้นๆ ที่กดฟังบนคีย์บอร์ดได้ พร้อมแผนฝึกประจำวันจากการฝึกจริงของคุณ
• โหมดฝึก: เล่นบนเปียโนจริงหรือคีย์บนจอ แอปฟังและบอกว่าโน้ตไหนต้องแก้
• ฝึกหู อ่านโน้ต และวิดีโอบทเรียน
• เกมที่ชาร์จพลังได้ด้วยการเรียน: ต่อสู้ สำรวจ และยิงเอเลี่ยน พร้อมตอบคำถามดนตรีระหว่างเล่น
เริ่มใช้ฟรี พร้อมทดลองทุกฟีเจอร์ 7 วัน ต้องใช้อินเทอร์เน็ต

### 中文（简体）
- **名称：** TIGA.AI — 学钢琴
- **简短说明：** 用真实歌曲、AI 老师、练耳和游戏学钢琴。
- **完整说明：** TIGA.AI 一步一步教你弹钢琴，支持泰语、英语和中文。学习路径（音阶、音程、和弦、视奏）、跟弹歌曲（多种风格、数千首）、AI 老师与每日导师、练习模式（用真钢琴或屏幕键盘，应用会听并指出需要改正的音）、练耳与视频课程，以及通过学习来充能的游戏。免费开始，含 7 天全功能试用，需要联网。

### What's new (release notes, ≤500)
First release on Google Play: Learning Pathway, Play Along, AI Teacher, practice mode, ear training and games.

## Console answers

**Category:** Education · **Tags:** music, piano, learning · **Contact:** owner e-mail + website https://tigaalpha.github.io

**App content → Target audience and content:** choose **13+** (recommended) — the app is a general learning app; it has a "kid mode" for younger learners but is not directed at under-13s. **If you instead tick any under-13 band, Google's Families Policy applies** (certified ad/analytics SDKs only, stricter data rules, teacher-approved/Designed-for-Families review) and the app must be re-checked. Decide before submitting; it is hard to reverse.
**Ads:** No ads. **Government app:** No. **News app:** No. **COVID:** No. **Financial features:** No (subscriptions are not sold in the Android build).
**In-app purchases / "Contains ads":** the Play build contains no purchase flow. Do NOT tick "offers in-app purchases" unless Play Billing is added later.

**Data safety (answer exactly; it must match the privacy policy):**
| Data | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Email, name | Yes | No | Account, app functionality | No |
| User IDs | Yes | No | Account | No |
| Audio (microphone) | Processed on device for note detection; voice-tutor audio is sent to speech services | Yes (speech/AI providers, to provide the feature) | App functionality | Yes (feature) |
| Photos/video (camera) | Hand coach is processed on device; nothing is stored or sent | No | App functionality | Yes |
| App activity, in-app actions (practice results, progress) | Yes | No | App functionality, personalisation, analytics | No |
| Other user-generated content (AI chat messages) | Yes (sent to AI providers to answer) | Yes (AI providers) | App functionality | No |
| Crash/diagnostic logs | Yes (usage_events error rows) | No | Analytics | No |
| Payment info | Not collected in the Android build | — | — | — |
Encryption in transit: **Yes**. Deletion: **Yes — in the app (menu → Delete account) and by contacting us**; enter the privacy-policy URL in the "Delete account URL" field too (add `#delete` section if needed).
Declare that data is **not sold**.

**Permissions to explain if asked:** CAMERA (hand-shape coach, optional), RECORD_AUDIO (note detection / voice tutor, optional), POST_NOTIFICATIONS (practice reminders, optional), INTERNET. No location, contacts, SMS, storage, accessibility or background-location permissions.

**Content rating questionnaire (IARC):** Reference/Education app; no violence toward people (the games shoot cartoon/alien creatures — answer "fantasy violence: mild/infrequent" truthfully for Alien Hunt and Adventure), no sexual content, no gambling, no drugs, **user interaction: yes** (online rooms / chat with AI; no free-text chat between users except room presets) — answer per the actual features; **shares location: no**; **digital purchases: no** in this build. Expect rating ~PEGI 7 / Everyone 10+ because of fantasy violence.

**AI-generated content policy:** the AI chat and tutor generate text. Declare it; the in-app persona has safety rules (no personal data, no sexual/violent/illegal content, self-harm answered with care). Make sure there is an in-app way to report a bad answer (settings → contact / feedback) — if you do not have a report button, add one before submission.

**App access for reviewers (REQUIRED, the most common rejection):** the app needs an account. Create a reviewer account (e-mail + password, not magic-link, not Google-only), put the credentials under *App access → Provide instructions*, and make sure it works without SMS/e-mail codes. Reviewers cannot use e-mail links.

**Pre-launch checklist**
1. Create the release keystore and `android/keystore.properties` (see PLAY_STORE_GUIDE.md), back it up in two places.
2. Build with `VITE_OTA_ENABLED=false` (above). Bump nothing by hand: versionCode comes from package.json.
3. Upload AAB to Internal testing, install on a real phone: log in with the reviewer account, open mic/camera prompts, play a song, open the menu → Delete account (use a throwaway account).
4. New personal developer accounts must run a **closed test with ≥12 testers for 14 days** before Production access (Google rule since Nov 2023 for new personal accounts) — start this early.
5. Fill listing, graphics, Data safety, Content rating, Target audience, App access, Ads, privacy URL; then submit.
