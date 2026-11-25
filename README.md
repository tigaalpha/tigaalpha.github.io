# TIGA.AI

TIGA.AI is an AI-powered piano-learning product for learners, teachers, and piano schools. The main app combines interactive piano practice, lessons, song play-along, music theory, AI tutoring, learning progress, and gamified activities; the repository also contains a separate business operations platform for TIGA Studio.

- **Live piano app:** [www.tigaalpha.com](https://www.tigaalpha.com/)
- **Repository:** [tigaalpha/tigaalpha.github.io](https://github.com/tigaalpha/tigaalpha.github.io)
- **Mobile:** Capacitor-based Android app and an installable iOS PWA. Native build and store steps are in [`MOBILE_BUILD.md`](MOBILE_BUILD.md) and [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md).

## Product capabilities

The main piano app is a React single-page application with a guest-first learning pathway and localized interfaces in Thai, English, Mandarin Chinese, Arabic, Japanese, Russian, Spanish, French, Hindi, and Korean. Its codebase includes:

- Piano keyboard, practice modes, sight-reading, song play-along, metronome, sound effects, and music-learning content.
- AI chat and voice tutor, learning plans and coaching, progress tracking, and a song catalog with original and public-domain repertoire.
- Camera-based hand/posture coaching, MIDI and microphone input, and native speech features where the platform supports them.
- Gamification and interactive game/adventure experiences, including multiplayer-oriented features.
- Accounts, cloud sync, subscriptions, school plans, payment flows, blog/content pages, and administrative dashboards.

Some features require a signed-in account, device hardware, Supabase configuration, or deployed Edge Functions. A successful frontend build does not verify those live integrations or device-only behavior.

## Repository architecture

The repository hosts several related but independently built products:

```text
.
├── App.tsx, main.tsx, *.tsx, *.ts   Main TIGA.AI piano app and feature modules
├── index.template.html              Main SPA HTML template
├── landing/                         Lightweight marketing landing-page app and its own Vite config
├── public/                          Static web assets, PWA files, and generated catalog assets
├── songs-src/                       Song source data and generation tools
├── blog-src/, blog-data/             Blog article sources and generated locale data
├── i18n-src/                         Source catalogs for additional app languages
├── scripts/                         Build, verification, content-generation, and release utilities
├── tigamodel/                       Piano-specific teaching intelligence, knowledge, and evaluation modules
├── supabase/                        Main app Edge Functions and Supabase CLI configuration
├── android/, ios/                    Capacitor native projects
├── updates/                          Native app OTA update manifest and bundles
├── bos/                              TIGA Agent business-operations app source (separate Next.js project)
├── studio/                           Static-exported Studio site served under /studio
├── api/                              Small serverless blog/sitemap/404 handlers
└── server/adv-room/                  Experimental WebSocket room server (not deployed)
```

### Main piano app

`main.tsx` initializes page-level learning data, language/catalog state, identity handoff, and app boot telemetry before mounting `App.tsx`. `App.tsx` is the integration/glue layer; the UI and domain code are split into top-level components, hooks, and modules. For example:

- **App shell and shared services:** `app-shell.tsx`, `shared-infra.ts`, `supabase-client.ts`
- **Practice and music:** `music-engine.tsx`, `use-practice-mode.ts`, `use-sight-reading.ts`, `use-play-along.ts`, `songs-data.ts`
- **AI and speech:** `ai-backend.ts`, `ai-cache.ts`, `ai-chat-context.ts`, `chat-ui.tsx`, `speech.ts`, `native-stt.ts`
- **Learning and sync:** `learning-data.ts`, `learner-signal.ts`, `learning-session-gate.ts`, `cloud-sync.ts`, `pathway-data.ts`
- **Payments and plans:** `payment.tsx`, `use-payment.ts`, `PricingOverlay.tsx`
- **Localization:** `i18n.ts`, `i18n-*.ts`, `i18n-src/`, `lang-extra.ts`

The main app has one Supabase client singleton in `supabase-client.ts`; app modules should import it rather than creating another client. Browser-shipped Supabase anon keys are public credentials; never add service-role keys, payment secrets, or provider API keys to client code.

### Other applications and services

- **Marketing landing page (`landing/`):** a separate Vite entry and bundle, intentionally kept independent from the full piano app so visitors do not download the full product bundle. Its configuration is in `vite.landing.config.ts`.
- **TIGA Agent (`bos/`):** a distinct Next.js 15 / React 19 / TypeScript business-operations system for TIGA Studio. It covers AI-assisted customer service, bookings, calendar, sales/CRM, marketing/content, finance, and staff operations. It has its own dependencies, scripts, Supabase project, and README at [`bos/README.md`](bos/README.md).
- **`studio/`:** the exported static Studio site and generated output. Its deployment is separate from the piano SPA; consult the BOS documentation and workflows before changing or regenerating it.
- **Main Supabase functions:** `supabase/functions/` contains server-side endpoints such as piano chat/voice, payment, reporting, and content functions. A Git commit does not necessarily deploy these functions. See the operational cautions below.
- **Adventure room service:** `server/adv-room/` contains a Node/WebSocket transport and room core. The transport source explicitly says it is not deployed; it requires a persistent Node host and authentication hardening before use with real rewards.

## Technology

- **Main app:** React 18, Vite 5, JavaScript/JSX with `.ts`/`.tsx` files, and esbuild transpilation. The root app does not run TypeScript type-checking; a passing build only confirms that bundling succeeded.
- **Native wrapper:** Capacitor 8 for Android and iOS, with platform-specific speech, app, and updater plugins.
- **Audio and graphics:** Web Audio APIs, Three.js, React Three Fiber, and postprocessing libraries.
- **Backend:** Supabase Auth, Postgres, Storage, Row Level Security, and Edge Functions; Stripe and local payment integrations are used by the relevant flows.
- **Separate TIGA Agent app:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase, and its own Edge Functions. Unlike the root piano app, this project defines type-check, lint, and test scripts.

## Getting started: piano app

Requirements: Node.js 22 is used in repository workflows. Install the root dependencies and start the Vite development server:

```bash
npm ci
npm run dev
```

To create and preview a production build:

```bash
npm run build
npm run preview
```

The root `build` script runs sprite/catalog generation checks and project-specific static checks before Vite builds the app. It also performs post-build processing; use its output as the canonical web build rather than invoking Vite directly. The resulting app is written to `dist/`.

Useful focused checks (see `package.json` for the complete and current script list):

```bash
npm run verify:hooks
npm run verify:names
npm run verify:cloudsync
npm run verify:android
npm run songs:check
node scripts/smoke-app-boot.mjs
```

There is no general root `npm test` suite. The repository has focused smoke and verification scripts, some of which need the production bundle, Playwright/Chromium, jsdom, or access to remote services. Read each script's requirements and report skipped or unavailable checks accurately. A build does not type-check the main app and does not replace browser or real-device testing.

### Building the native apps

The Capacitor projects wrap the built web app in `dist/`:

```bash
npm ci
npm run build
npx cap sync android
```

Open `android/` in Android Studio for a device build. iOS builds require macOS and Xcode. For release signing, OTA, Play Store versioning, and release requirements, read [`MOBILE_BUILD.md`](MOBILE_BUILD.md) and [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md) first. Do not change the pinned Android `versionCode` formula or its base numbers.

### Running TIGA Agent (`bos/`)

This is an independent project with its own `package.json` and lockfile:

```bash
cd bos
npm ci
cp .env.example .env.local
npm run dev
```

Then use `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` from `bos/` as needed. Its local frontend uses public Supabase configuration; model-provider and integration secrets belong in the Edge Function environment, never in the browser bundle. Consult [`bos/README.md`](bos/README.md) and its setup docs for database, authentication, and function requirements.

## Content and generated files

- `songs-src/` contains the source data for repertoire. `songs-classical.ts` and other catalog outputs are generated; update their source and use the builders/checkers rather than editing generated output by hand. See [`songs-src/README.md`](songs-src/README.md).
- `blog-src/` contains blog article sources. The build generates static data used by the app and public blog pages.
- Additional translation catalogs are maintained under `i18n-src/` and compiled by the repository scripts. Follow existing localization helpers and validation rather than inserting a hard-coded language-specific UI string.
- `bundle/` and checked-in static directories may contain build/deployment artifacts. Do not assume every checked-in generated file is hand-maintained; check the corresponding build script before changing it.

## Deployment and operational notes

- Changes to the main app are delivered through the repository's `main` branch. The configured Vercel project automatically starts a Production deployment when changes are pushed; deployment status is available in the [TIGA Vercel project](https://vercel.com/tiga2/tigaa). Do not run a separate `vercel deploy` as part of the normal push flow.
- The repository also contains GitHub Pages-compatible site content and separately managed static exports. Check the relevant workflow/configuration and project instructions before assuming every directory has the same deployment target.
- Android debug builds are produced by `.github/workflows/android-debug-build.yml` for its configured branches and paths. They are for testing, not Play Store releases.
- In particular, inspect `.github/workflows/bos-deploy.yml` before changing `bos/supabase/**`: that workflow can deploy BOS Edge Functions, set provided secrets, and apply pending database migrations on matching pushes.
- Root app Supabase SQL migrations and root `supabase/functions/` require separate operational handling. Do not apply a migration to the live database or deploy a function without the owner's explicit approval for that operation. A Git push alone does not deploy the root app's Edge Functions.
- Never commit secrets, signing credentials, or real payment keys. Never use destructive remote Git operations without explicit owner approval.

## Further documentation

- [`AGENTS.md`](AGENTS.md) — owner decisions, coding rules, delivery workflow, and detailed test guidance. Read it before making changes.
- [`docs/agents-history.md`](docs/agents-history.md) — detailed feature history and implementation constraints.
- [`MOBILE_BUILD.md`](MOBILE_BUILD.md) — Android/iOS builds and native update process.
- [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md) and [`PLAY_STORE_LISTING.md`](PLAY_STORE_LISTING.md) — Play Store readiness and listing material.
- [`songs-src/README.md`](songs-src/README.md) — music-source, licensing, and catalog-generation rules.
- [`tigamodel/README.md`](tigamodel/README.md) — piano-intelligence modules and evaluation workflow.
- [`bos/README.md`](bos/README.md) — TIGA Agent architecture and setup.

---

# TIGA.AI (ภาษาไทย)

TIGA.AI คือผลิตภัณฑ์เรียนเปียโนด้วย AI สำหรับผู้เรียน ครู และโรงเรียนสอนดนตรี แอปหลักรวมบทเรียน การฝึกเปียโน การเล่นตามเพลง ทฤษฎีดนตรี ครู AI การติดตามพัฒนาการ และระบบเกมไว้ด้วยกัน ภายใน repository เดียวกันยังมีระบบบริหารธุรกิจสำหรับ TIGA Studio ซึ่งพัฒนาและ deploy แยกจากแอปเปียโน

- **แอปเปียโน:** [www.tigaalpha.com](https://www.tigaalpha.com/)
- **Repository:** [tigaalpha/tigaalpha.github.io](https://github.com/tigaalpha/tigaalpha.github.io)
- **มือถือ:** แอป Android ที่ห่อด้วย Capacitor และ iOS PWA ที่ติดตั้งจากเบราว์เซอร์ได้ อ่าน [`MOBILE_BUILD.md`](MOBILE_BUILD.md) และ [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md) สำหรับขั้นตอน build และเผยแพร่

## ความสามารถของผลิตภัณฑ์

แอปเปียโนหลักเป็น React single-page application มี Learning Pathway ที่เริ่มใช้งานแบบ guest ได้ และรองรับ UI 10 ภาษา ได้แก่ ไทย อังกฤษ จีนกลาง อาหรับ ญี่ปุ่น รัสเซีย สเปน ฝรั่งเศส ฮินดี และเกาหลี ความสามารถหลักใน codebase ประกอบด้วย:

- คีย์บอร์ดเปียโน โหมดฝึกอ่านโน้ต เล่นตามเพลง เมโทรนอม เอฟเฟกต์เสียง และบทเรียนดนตรี
- แชทและครูเสียง AI แผนฝึกซ้อม การโค้ช การติดตามผล และคลังเพลงต้นฉบับกับเพลงคลาสสิกที่เป็นสาธารณสมบัติ
- โค้ชท่ามือผ่านกล้อง การรับโน้ตจาก MIDI/ไมโครโฟน และฟีเจอร์เสียง native ตามความสามารถของอุปกรณ์
- ระบบเกมและ gamification รวมถึงประสบการณ์ adventure และฟีเจอร์ที่รองรับการเล่นหลายคน
- บัญชีผู้ใช้ cloud sync แผนสมาชิก แผนสำหรับโรงเรียน ระบบชำระเงิน บล็อก/คอนเทนต์ และแดชบอร์ดผู้ดูแล

ฟีเจอร์บางส่วนต้องเข้าสู่ระบบ ใช้ฮาร์ดแวร์ของอุปกรณ์ ตั้งค่า Supabase หรือ deploy Edge Function แล้ว การ build frontend ผ่านไม่ได้ยืนยันว่าระบบออนไลน์หรือฟีเจอร์ที่ใช้ฮาร์ดแวร์จริงทำงานครบ

## โครงสร้าง Repository

Repository นี้รวมหลายผลิตภัณฑ์ที่เกี่ยวข้องกัน แต่ build แยกกัน:

```text
.
├── App.tsx, main.tsx, *.tsx, *.ts   แอป TIGA.AI เรียนเปียโนและโมดูลฟีเจอร์ต่าง ๆ
├── index.template.html              HTML template ของแอปหลัก
├── landing/                         แอปหน้า Marketing แยก entry และ Vite config
├── public/                          ไฟล์ static, PWA และ asset ที่ใช้กับแอป
├── songs-src/                       ข้อมูลต้นทางเพลงและเครื่องมือสร้างคลังเพลง
├── blog-src/, blog-data/             แหล่งบทความและข้อมูลภาษาที่สร้างอัตโนมัติ
├── i18n-src/                         ต้นทางแค็ตตาล็อกภาษาเพิ่มเติม
├── scripts/                         สคริปต์ build, ตรวจสอบ, สร้างคอนเทนต์ และ release
├── tigamodel/                       ระบบ intelligence สำหรับการสอนเปียโน ความรู้ และการประเมินผล
├── supabase/                        Edge Functions และ config ของแอปหลัก
├── android/, ios/                    โปรเจกต์ native ที่สร้างด้วย Capacitor
├── updates/                          manifest และ bundle สำหรับ OTA ของแอปมือถือ
├── bos/                              TIGA Agent ระบบบริหารธุรกิจ (Next.js แยกโปรเจกต์)
├── studio/                           static export ของเว็บไซต์ Studio ที่ให้บริการใต้ /studio
├── api/                              serverless handlers ขนาดเล็กสำหรับ blog/sitemap/404
└── server/adv-room/                  WebSocket room server สำหรับทดลอง (ยังไม่ deploy)
```

### แอปเปียโนหลัก

`main.tsx` เริ่มต้นระบบข้อมูลการเรียน ภาษา/แค็ตตาล็อก การส่งต่อ identity และ telemetry ก่อน mount `App.tsx` ส่วน `App.tsx` เป็นชั้นเชื่อมหน้าจอและ state เข้าด้วยกัน โดยแยก UI และ logic ตามหน้าที่เป็น component, hook และ module เช่น:

- **App shell และ service กลาง:** `app-shell.tsx`, `shared-infra.ts`, `supabase-client.ts`
- **การฝึกและดนตรี:** `music-engine.tsx`, `use-practice-mode.ts`, `use-sight-reading.ts`, `use-play-along.ts`, `songs-data.ts`
- **AI และเสียง:** `ai-backend.ts`, `ai-cache.ts`, `ai-chat-context.ts`, `chat-ui.tsx`, `speech.ts`, `native-stt.ts`
- **ระบบการเรียนและ sync:** `learning-data.ts`, `learner-signal.ts`, `learning-session-gate.ts`, `cloud-sync.ts`, `pathway-data.ts`
- **การชำระเงินและแผนสมาชิก:** `payment.tsx`, `use-payment.ts`, `PricingOverlay.tsx`
- **ภาษา:** `i18n.ts`, `i18n-*.ts`, `i18n-src/`, `lang-extra.ts`

แอปหลักใช้ Supabase client singleton ตัวเดียวจาก `supabase-client.ts` ให้ module อื่น import จากไฟล์นี้แทนการสร้าง client เพิ่ม Supabase anon key ที่ส่งไปกับ browser เป็น public key; ห้ามใส่ service-role key, secret สำหรับรับชำระเงิน หรือ provider API key ใน client code

### แอปและ service อื่น

- **หน้า Marketing (`landing/`):** Vite entry และ bundle แยกจากแอปเปียโน เพื่อไม่ให้ผู้เข้าชมหน้าโฆษณาต้องดาวน์โหลด bundle ทั้งผลิตภัณฑ์ config อยู่ใน `vite.landing.config.ts`
- **TIGA Agent (`bos/`):** ระบบบริหารธุรกิจ TIGA Studio แยกต่างหาก ใช้ Next.js 15 / React 19 / TypeScript ครอบคลุมบริการลูกค้าและ AI การจอง ปฏิทิน การขาย/CRM การตลาด/คอนเทนต์ การเงิน และงานทีม มี dependencies, scripts, Supabase project และ README ของตนเองที่ [`bos/README.md`](bos/README.md)
- **`studio/`:** static export และไฟล์ที่สร้างสำหรับเว็บไซต์ Studio การ deploy แยกจากแอปเปียโน ควรอ่านเอกสาร BOS และ workflow ก่อนแก้หรือสร้าง output ใหม่
- **Supabase functions ของแอปหลัก:** `supabase/functions/` มี endpoint ฝั่ง server เช่น piano chat/voice การชำระเงิน รายงาน และคอนเทนต์ การ commit เข้า Git ไม่ได้แปลว่า deploy function แล้ว ดูข้อควรระวังด้านการดำเนินงานด้านล่าง
- **Adventure room service:** `server/adv-room/` มี WebSocket transport และ room core โดย source ระบุว่ายังไม่ deploy ต้องมี Node host ที่รันต่อเนื่องและเพิ่มการตรวจสอบตัวตนก่อนนำไปใช้กับ reward จริง

## เทคโนโลยี

- **แอปหลัก:** React 18, Vite 5, JavaScript/JSX ในไฟล์ `.ts`/`.tsx` และ esbuild transpilation โปรเจกต์ root ไม่ได้ตรวจ TypeScript types; build ผ่านยืนยันเพียงว่า bundle ได้
- **Native wrapper:** Capacitor 8 สำหรับ Android/iOS พร้อม plugin สำหรับ speech, app และ updater
- **เสียงและกราฟิก:** Web Audio APIs, Three.js, React Three Fiber และ postprocessing libraries
- **Backend:** Supabase Auth, Postgres, Storage, Row Level Security และ Edge Functions; flow ที่เกี่ยวข้องใช้ Stripe และช่องทางรับเงินในพื้นที่
- **TIGA Agent แยกโปรเจกต์:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase และ Edge Functions ของตนเอง ต่างจากแอป root ตรงที่มี scripts สำหรับ type-check, lint และ test

## เริ่มใช้งานแอปเปียโน

ต้องมี Node.js; workflow ใน repository ใช้ Node.js 22 ติดตั้ง dependencies ที่ root แล้วเริ่ม Vite development server:

```bash
npm ci
npm run dev
```

สร้าง production build และเปิด preview:

```bash
npm run build
npm run preview
```

สคริปต์ `build` ของ root ตรวจ sprite/catalog และ static checks ของโปรเจกต์ก่อนสั่ง Vite build และทำ post-build processing ต่อ ควรใช้ผลลัพธ์ของ script นี้เป็น web build หลัก ไม่ควรเรียก Vite ตรง ๆ แทน ผลลัพธ์แอปอยู่ใน `dist/`

คำสั่งตรวจสอบเฉพาะส่วนที่มีประโยชน์ (ดู `package.json` สำหรับรายการและคำสั่งล่าสุด):

```bash
npm run verify:hooks
npm run verify:names
npm run verify:cloudsync
npm run verify:android
npm run songs:check
node scripts/smoke-app-boot.mjs
```

ที่ root ไม่มีชุดทดสอบรวมแบบ `npm test` แต่มี smoke tests และ verification scripts หลายรายการ บางตัวต้องมี production bundle, Playwright/Chromium, jsdom หรือการเชื่อมต่อบริการออนไลน์ อ่านข้อกำหนดของแต่ละ script และรายงานกรณีที่ข้ามหรือรันไม่ได้ตามจริง การ build ไม่ได้ตรวจ type ของแอปหลัก และใช้แทนการทดสอบบน browser หรืออุปกรณ์จริงไม่ได้

### Build แอปมือถือ

โปรเจกต์ Capacitor ใช้ web app ที่ build ไว้ใน `dist/`:

```bash
npm ci
npm run build
npx cap sync android
```

เปิดโฟลเดอร์ `android/` ด้วย Android Studio เพื่อ build บนอุปกรณ์ การ build iOS ต้องใช้ macOS และ Xcode อ่าน [`MOBILE_BUILD.md`](MOBILE_BUILD.md) และ [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md) ก่อนจัดการ signing, OTA, versionCode และการเผยแพร่ ห้ามแก้สูตรหรือเลขฐานของ Android `versionCode` ที่กำหนดไว้

### รัน TIGA Agent (`bos/`)

เป็นโปรเจกต์แยก มี `package.json` และ lockfile ของตัวเอง:

```bash
cd bos
npm ci
cp .env.example .env.local
npm run dev
```

ใช้ `npm run lint`, `npm run typecheck`, `npm run test` และ `npm run build` จาก `bos/` ได้ตามต้องการ frontend ใช้ public Supabase config ส่วน secrets ของ AI provider และ integration ต้องอยู่ใน environment ของ Edge Functions เท่านั้น ไม่ใส่ใน browser bundle ดู [`bos/README.md`](bos/README.md) และเอกสาร setup สำหรับฐานข้อมูล การยืนยันตัวตน และ function ที่ต้องตั้งค่า

## คอนเทนต์และไฟล์ที่สร้างอัตโนมัติ

- `songs-src/` เก็บข้อมูลต้นทางเพลง ส่วน `songs-classical.ts` และ output ของคลังเพลงอื่นเป็น generated files ให้แก้ source แล้วใช้ builder/checker แทนการแก้ไฟล์ generated โดยตรง อ่าน [`songs-src/README.md`](songs-src/README.md)
- `blog-src/` เก็บ source บทความ ส่วน build จะสร้าง static data สำหรับ blog ภายในแอปและหน้าเว็บ
- แค็ตตาล็อกภาษาเพิ่มเติมอยู่ภายใต้ `i18n-src/` และสร้างด้วย scripts ใน repository ใช้ localization helpers และ validation ตามรูปแบบเดิม แทนการใส่ข้อความแยกภาษาแบบ hard-code
- `bundle/` และ static directories ที่ commit ไว้อาจเป็น artifacts ที่สร้างจาก build อย่าสมมติว่าไฟล์ทั้งหมดแก้ด้วยมือ ให้ตรวจ script ที่เป็นต้นทางก่อน

## การ deploy และข้อควรระวัง

- การเปลี่ยนแปลงแอปหลักส่งผ่าน branch `main` โปรเจกต์ Vercel ที่ตั้งค่าไว้จะเริ่ม Production deployment เมื่อมีการ push ตรวจสถานะได้ที่ [TIGA Vercel project](https://vercel.com/tiga2/tigaa) ไม่ต้องสั่ง `vercel deploy` แยกใน workflow ปกติ
- Repository ยังมีเนื้อหาที่รองรับ GitHub Pages และ static export ที่ deploy แยกกัน ตรวจ workflow/config ของแต่ละส่วนก่อนสรุปว่าใช้ deployment target เดียวกันทั้งหมด
- Android debug build สร้างโดย `.github/workflows/android-debug-build.yml` ตาม branch และ path ที่กำหนด เป็น build สำหรับทดสอบ ไม่ใช่ release สำหรับ Play Store
- ก่อนแก้ `bos/supabase/**` ให้อ่าน `.github/workflows/bos-deploy.yml` เพราะ push ที่ตรงเงื่อนไขอาจ deploy BOS Edge Functions ตั้ง secrets ที่มีให้ และ apply migrations ที่ค้างอยู่
- SQL migrations และ `supabase/functions/` ของแอป root ต้องจัดการแยกต่างหาก ห้าม apply migration กับฐานข้อมูลจริงหรือ deploy function โดยไม่มีการอนุมัติที่ชัดเจนจากเจ้าของสำหรับการดำเนินการนั้น การ push Git เพียงอย่างเดียวไม่ได้ deploy Edge Functions ของแอป root
- ห้าม commit secrets, signing credentials หรือ payment keys จริง และห้ามใช้คำสั่ง Git ระยะไกลที่ทำลายข้อมูลโดยไม่มีอนุมัติชัดเจน

## เอกสารเพิ่มเติม

- [`AGENTS.md`](AGENTS.md) — ข้อตกลงและข้อจำกัดจากเจ้าของ วิธีทำงาน ขั้นตอนส่งงาน และแนวทางทดสอบ อ่านก่อนแก้โค้ด
- [`docs/agents-history.md`](docs/agents-history.md) — ประวัติฟีเจอร์และรายละเอียดข้อจำกัดในการพัฒนา
- [`MOBILE_BUILD.md`](MOBILE_BUILD.md) — การ build Android/iOS และ OTA
- [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md) และ [`PLAY_STORE_LISTING.md`](PLAY_STORE_LISTING.md) — ความพร้อมและข้อมูลสำหรับ Play Store
- [`songs-src/README.md`](songs-src/README.md) — แหล่งข้อมูลเพลง ลิขสิทธิ์ และขั้นตอนสร้างคลังเพลง
- [`tigamodel/README.md`](tigamodel/README.md) — โครงสร้าง piano intelligence และการประเมินผล
- [`bos/README.md`](bos/README.md) — สถาปัตยกรรมและการเริ่มใช้งาน TIGA Agent
