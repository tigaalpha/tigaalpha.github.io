# Tiga AI BOS — Setup จริงทั้งระบบ (Runbook)

เอกสารนี้คือลำดับขั้นตอนที่ทำให้ระบบทั้งหมด "มีชีวิต" ตั้งแต่หลัง pull repo ใหม่ ไปจนถึงใช้งานจริง
(edge functions ที่ deploy, migrations ที่ apply, secrets ที่ตั้ง, ช่องทางที่เชื่อม, cron ที่ทำงาน, และข้อมูล
วัด AI response จริง)

> ต้องใช้สิทธิ์เจ้าของ Supabase project + บัญชีภายนอกตามขั้น A — งานใน docs นี้ทำที่
> Supabase Dashboard / CLI และ console ของผู้ให้บริการ ไม่ใช่ในโค้ด

---

## ลำดับรวม

| # | ขั้นตอน | ที่ไหน | ใช้เวลาประมาณ |
|---|---|---|---|
| A | เตรียมบัญชีภายนอก (Google/LINE/Meta/OpenRouter) | console ภายนอก | 30–60 นาที |
| B | Deploy edge functions ทั้งหมด (~74 ตัว) | Supabase CLI | 10 นาที |
| C | ตั้ง secrets | Supabase Dashboard / CLI | 10 นาที |
| D | Apply migrations 79 ตัว (สร้างตาราง + cron) | Supabase SQL Editor / CLI | 5 นาที |
| E | ตั้งค่าหลัง deploy (payment_config, profiles, งบ AI) | SQL Editor | 5 นาที |
| F | เชื่อม Google Calendar | ในแอพ Settings → Integrations | 5 นาที |
| G | วาง LINE webhook URL | LINE Developers Console | 5 นาที |
| H | ตั้ง Messenger (Facebook Inbox) | Meta Developers + Supabase | 10 นาที |
| I | ตรวจ cron ทั้งหมดทำงานจริง | SQL + Edge Function logs | 15 นาที |
| J | วัด AI response จริง (เป้า 3–5s) | Supabase logs | 5 นาที |

---

## A. บัญชีภายนอกที่ต้องเตรียม

| บริการ | ใช้ทำอะไร | ต้องได้อะไร |
|---|---|---|
| Google Cloud (AI Studio) | Gemini (แชท/embedding/รูป) | `GEMINI_API_KEY` |
| OpenRouter | โมเดลสำรองของ TIGA AI Agent (Claude/GPT/Grok/…) | `OPENROUTER_API_KEY` + เติม Credits |
| Google Cloud (OAuth) | เชื่อม Google Calendar | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (Redirect URI = `{SUPABASE_URL}/functions/v1/google-oauth-callback`) |
| LINE Developers | LINE OA รับ/ตอบลูกค้า | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` |
| Meta Developers | Facebook Page (โพสต์อัตโนมัติ) + Messenger | App ID, `META_APP_SECRET`, `MESSENGER_VERIFY_TOKEN`, `MESSENGER_PAGE_ACCESS_TOKEN` |
| TikTok Developers | โพสต์รูป/วิดีโอไป TikTok อัตโนมัติ (Content Posting API) | `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` (Redirect URI = `{SUPABASE_URL}/functions/v1/tiktok-oauth-callback`) |
| X Developer | โพสต์ข้อความ/รูป/คลิปไป X (Twitter) อัตโนมัติ | `X_API_KEY` + `X_API_SECRET` (Callback URL = `{SUPABASE_URL}/functions/v1/x-oauth-callback`) |
| Fal.ai / Runway (ไม่บังคับ) | Video Studio (generate-video-*) | `FAL_API_KEY`, `RUNWAY_API_KEY` |
| Bland AI (ไม่บังคับ แต่แนะนำ) | AI รับสายโทรศัพท์ (voice agent) — webhook รับผลเข้า CRM | `BLAND_API_KEY` (ถ้าจะโทรออกเอง) |
| Google Cloud (YouTube API) | Marketing Channels | `YOUTUBE_API_KEY` |

---

## B. Deploy edge functions

```bash
cd bos
supabase login
supabase link --project-ref <PROJECT_REF>   # เช่น tzgktczefypwhhmyxlmj

# deploy ทุกฟังก์ชัน (ไม่รวม _shared และ deno.json ที่เป็น dependency)
for fn in $(ls supabase/functions | grep -v "^_shared$" | grep -v "^deno.json$"); do
  supabase functions deploy "$fn"
done
```

- `verify_jwt` ของแต่ละฟังก์ชันตั้งไว้ใน `supabase/config.toml` แล้ว (`supabase functions deploy`
  อ่านค่าจากตรงนี้โดยอัตโนมัติ — ฟังก์ชัน webhook/cron เป็น `verify_jwt = false` อยู่แล้ว)
- หลัง deploy ครั้งแรก ให้ยืนยันบน Dashboard ว่า config ตรงกัน (Settings → Functions)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` ถูก inject ให้อัตโนมัติ — **ห้าม**ตั้งเป็น secret เอง

## C. ตั้ง secrets

Supabase Dashboard → Edge Functions → Secrets (หรือ `supabase secrets set KEY=value`):

| Secret | จำเป็น? | หมายเหตุ |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | AI หลัก (แชท/embedding/รูป) |
| `OPENROUTER_API_KEY` | ตามการตั้งค่า | ถ้าใช้โมเดล non-Gemini กับ TIGA AI Agent |
| `LINE_CHANNEL_SECRET` | ✅ | LINE webhook |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | LINE push ถึงลูกค้า/เจ้าของ |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google Calendar OAuth |
| `META_APP_SECRET` | ตามการใช้งาน | Facebook Page connect |
| `MESSENGER_VERIFY_TOKEN` | ตามการใช้งาน | Messenger webhook handshake |
| `MESSENGER_PAGE_ACCESS_TOKEN` | ตามการใช้งาน | Messenger ตอบลูกค้า |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | ตามการใช้งาน | TikTok Content Posting API (โพสต์อัตโนมัติ) |
| `X_API_KEY` / `X_API_SECRET` | ตามการใช้งาน | X (Twitter) OAuth 1.0a (โพสต์อัตโนมัติ) |
| `YOUTUBE_API_KEY` | ตามการใช้งาน | Marketing Channels |
| `FAL_API_KEY` / `RUNWAY_API_KEY` | ไม่บังคับ | Video Studio |
| `CRON_SECRET` | ✅ | กัน cron ปลอมเรียกฟังก์ชัน (ต้องตรงกับค่าใน migrations) |
| `AI_MODEL`, `AI_EMBEDDING_MODEL`, `AI_IMAGE_MODEL`, `AI_VIDEO_MODEL`, `SOCIAL_TRENDS_GEO` | legacy/optional | ค่า fallback เก่า — ปกติตั้งใน app แล้ว |

`GOOGLE_CLIENT_ID` / `GOOGLE_REFRESH_TOKEN` **ไม่ต้องตั้งเป็น secret** — เชื่อมจากในแอพ
(Settings → Integrations → Connect Google Calendar) แล้วเก็บลงตาราง `integration_settings` อัตโนมัติ

## D. Apply migrations

รันไฟล์ใน `supabase/migrations/` เรียงตามลำดับ (0001 → 0079) ผ่าน SQL Editor หรือ `supabase db push`

- migrations สร้างตาราง + RLS + ฟังก์ชัน + **cron jobs** (ขั้น I)
- ต้องเปิด extension `pg_cron` (และ `pgvector` สำหรับ knowledge base) — ถ้า `db push` ไม่ได้เปิดให้
  เปิดเองใน SQL Editor: `create extension if not exists pg_cron;`

## E. ตั้งค่าหลัง deploy (SQL)

```sql
-- 1) บัญชีรับเงิน (ใช้โดย create-payment / verify-payment / AI tool)
insert into integration_settings (key, value) values ('payment_config', '{"account_number":"3832557289","bank":"SCB","name":"นาย ณัฐพลญ์ พุทธโกษา","promptpay_id":"<เลขพร้อมเพย์ ถ้ามี>"}');

-- 2) งบ AI ต่อวัน (tokens) — 0/ไม่ตั้ง = ไม่จำกัด (ตั้งในแอพได้ที่ Settings → Integrations)
insert into integration_settings (key, value) values ('ai_budget_daily_tokens', '100000');

-- 3) LINE ID ของเจ้าของ (รับแจ้งเตือน เช่น ลูกค้าขอคุยกับคน / เกินงบ AI)
insert into integration_settings (key, value) values ('owner_line_user_id', '<LINE userId ของเจ้าของ>');

-- 4) ให้สิทธิ์ตัวเองหลัง login Google ครั้งแรก (RLS บล็อกทุกอย่างก่อนมี row นี้)
insert into profiles (id, full_name, role)
select id, email, 'owner' from auth.users where email = 'you@example.com';

-- 5) กุญแจสำหรับ web chat widget (ฝังในเว็บ — Settings → Integrations มีปุ่มสุ่ม/แสดงโค้ดฝัง)
insert into integration_settings (key, value) values ('web_chat_secret', '<สุ่ม 32 ตัวอักษร>');

-- 6) กุญแจสำหรับ voice agent webhook (Bland ส่ง x-voice-secret มาตรงค่านี้)
insert into integration_settings (key, value) values ('voice_agent_secret', '<สุ่ม 32 ตัวอักษร>');
```

## F. เชื่อม Google Calendar

1. ตั้ง `GOOGLE_CLIENT_SECRET` (ขั้น C) + ใส่ Client ID ในแอพ Settings → Integrations → Google Calendar
2. กด **Connect Google Calendar** → อนุมัติ OAuth
3. ยืนยัน `integrations-status` แสดง `connected: true` (หน้า Settings / Control Center)

## G. LINE webhook

1. LINE Developers Console → ผู้ให้บริการ/OA ที่ใช้ (OA `422gobjh`) → Messaging API → Webhook URL:
   `{SUPABASE_URL}/functions/v1/line-webhook`
2. กด Verify — ต้องได้สถานะ success (secret `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` ต้องตั้งแล้ว)

## H. Messenger (Facebook Inbox)

ทำตาม UI ในแอพ Settings → Integrations → **Messenger (Facebook Inbox)**:

1. ตั้ง `MESSENGER_VERIFY_TOKEN` (ค่าอะไรก็ได้ เช่น `tiga-verify-1`)
2. Meta Developers → แอป → Messenger → Webhooks → Subscribe with URL
   `{SUPABASE_URL}/functions/v1/messenger-webhook` + Verify Token เดียวกัน
3. Messenger → Settings → Page Access Token → ตั้งเป็น `MESSENGER_PAGE_ACCESS_TOKEN`
4. Facebook Page connect (สำหรับโพสต์อัตโนมัติ) — ตาม Section Facebook ในหน้าเดียวกัน

---

## H2. เชื่อม TikTok + X (โพสต์อัตโนมัติหลายช่องทาง)

ทำตาม UI ในแอพ Settings → Integrations → **TikTok** / **X (Twitter)**:

**TikTok**
1. [developers.tiktok.com](https://developers.tiktok.com) → สร้างแอป (Business) → เปิดโปรดักต์ **Content Posting API** + **Login Kit**
2. ตั้ง Redirect URI = `{SUPABASE_URL}/functions/v1/tiktok-oauth-callback`
3. ตั้ง secrets `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` (ขั้น C)
4. กด Connect TikTok → ติ๊กสิทธิ์ `user.info.basic`, `video.publish`, `photo.share`
   - โหมด Sandbox: โพสต์ได้ 3 ครั้ง/วัน และบังคับส่วนตัว (SELF_ONLY) — ส่งแอปตรวจสอบถึงจะโพสต์สาธารณะ
   - โพสต์รูปใช้ Direct Post (photo mode), วิดีโอใช้ PULL_FROM_URL — media ต้องเป็น URL สาธารณะ (ที่เก็บใน Supabase Storage เป็น public อยู่แล้ว)

**X (Twitter)**
1. [developer.x.com](https://developer.x.com) → สร้างแอป → ตั้งสิทธิ์ **Read and Write** (+ Upload media)
2. ตั้ง Callback URL = `{SUPABASE_URL}/functions/v1/x-oauth-callback`
3. ตั้ง secrets `X_API_KEY` + `X_API_SECRET` (Consumer Key/Secret)
4. กด Connect X → อนุมัติในหน้าของ X (OAuth 1.0a — จำเป็นสำหรับอัปโหลดรูป/วิดีโอ)
   - แผนฟรีโพสต์ได้ ~1,500 ครั้ง/เดือน; วิดีโอ >5MB ยังต้อง chunked upload (ยังไม่รองรับ — จะขึ้น error ชัดเจน)

**ช่องทางทั้งหมดที่ publish ได้** (หน้า Marketing → คิวโพสต์): facebook, line, x, website (ข้อความล้วน) +
instagram, tiktok (ต้องแนบ media URL) — โพสต์เดียวส่งได้พร้อมกันทุกช่องทาง

---

## H3. AI Voice Agent รับสาย (Bland AI หรือบริการ voice ใดก็ได้)

ระบบมี `voice-agent-webhook` พร้อมรับผลจากการโทรแล้ว (สร้าง/หาลูกค้าด้วยเบอร์ → บันทึกสาย → สร้างแชทช่อง
`phone` → แจ้ง owner ทาง LINE) — ขั้นตอนเชื่อม:

1. สมัคร [Bland.ai](https://www.bland.ai) → สร้าง Inbound Agent (หรือใช้ API สร้าง path) — ใช้ภาษาไทย, พูดแนะนำ
   คอร์ส/เก็บเบอร์/นัดทดลองเรียน แล้วจบสายด้วยสถานะ (`booked` / `callback` / อื่นๆ)
2. ตั้ง `voice_agent_secret` ใน DB (ขั้น E ข้อ 6) — webhook ตรวจ header `x-voice-secret` ตรงค่านี้
3. ตั้ง Webhook URL ใน Bland = `{SUPABASE_URL}/functions/v1/voice-agent-webhook`
   ส่ง JSON: `{ "call_id", "phone", "status", "summary", "transcript_url", "direction" }`
   (Bland ส่ง `call_id`, `phone`, `summary`, `status` อยู่แล้ว — map field ตามเอกสาร Bland)
4. ทดสอบโทรจริง → ดูหน้า `/voice` ในแอพ (รายการสาย + สรุป) และแจ้งเตือน LINE

> ถ้าจะให้ AI **โทรออกเอง** (ทวงนัด/ติดตามลูกค้า) ต้องตั้ง secret `BLAND_API_KEY` แล้วเขียนฟังก์ชันโทรออก
> (มี `reschedule-assistant` / `payment-followup` คอยส่ง LINE อยู่แล้ว — โทรออกเป็นขั้นถัดไป ไม่บังคับ)

## H4. Web Chat Widget (ฝังแชทบอทลงเว็บไซต์)

1. ตั้ง `web_chat_secret` (ขั้น E ข้อ 5) หรือกดสร้างใน Settings → Integrations → **เว็บแชท (Widget)**
2. ในหน้าเดียวกันคัดลอกโค้ดฝัง (script + config) ไปวางก่อน `</body>` ของเว็บใดก็ได้
   — หรือดูตัวอย่างได้ที่ `/studio/widget-demo.html`
3. ลูกค้าที่คุยผ่าน widget จะเข้า Inbox เดียวกับ LINE (ช่อง `web`) — ไม่ต้องตั้งค่าอื่นเพิ่ม

---

## I. ตรวจ cron ทั้งหมดทำงานจริง

cron jobs ถูกสร้างตอน apply migrations (ขั้น D) — ตรวจว่าได้ถูกสร้างครบและฟังก์ชันที่อ้างถึง deploy แล้ว:

```sql
select jobname, schedule, active from cron.job order by jobname;
```

ตาราง 24 งานที่ควรเห็น (ฟังก์ชันทั้งหมดนี้มีอยู่ใน `supabase/functions/` แล้ว):

| cron.jobname | ฟังก์ชันที่เรียก | ตารางเวลา (UTC) | ทำงานเมื่อไหร่ (ไทย) |
|---|---|---|---|
| system-health-check | system-health-check | ทุก 15 นาที | ตลอดเวลา |
| agent-schedule-runner | agent-schedule-runner | ทุก 5 นาที | ตลอดเวลา |
| automation-engine-runner | automation-engine-runner | ทุก 5 นาที | ตลอดเวลา |
| receipt-drive-sync | receipt-drive-sync | ทุก 5 นาที | ตลอดเวลา |
| trial-offer-nudge | trial-offer-nudge | ทุก 15 นาที | ตลอดเวลา |
| attendance-reminder | attendance-reminder | ทุก 30 นาที | ตลอดเวลา |
| trial-followup | trial-followup | ทุก 30 นาที | ตลอดเวลา |
| automation-nudges | automation-nudges | ทุก 1 ชม. | ตลอดเวลา |
| drip-runner | drip-runner | ทุก 6 ชม. | ตลอดเวลา |
| follow-up-abandoned-conversations | follow-up-conversations | ทุก 6 ชม. | ตลอดเวลา |
| marketing-metrics-snapshot | marketing-metrics-snapshot | ทุก 1 ชม. | ตลอดเวลา |
| agent-event-triggers-hourly | agent-event-triggers | ทุก 1 ชม. | ตลอดเวลา |
| ai-daily-briefing | ai-briefing-runner | 00:00 | 07:00 |
| ai-weekly-business-report | ai-briefing-runner | จันทร์ 01:00 | จันทร์ 08:00 |
| marketing-manual-entry-reminder | marketing-manual-entry-reminder | จันทร์ 02:00 | จันทร์ 09:00 |
| ceo-agent-weekly-run | agent-orchestrator | จันทร์ 03:00 | จันทร์ 10:00 |
| monthly-report | monthly-report | 1 ของเดือน 08:00 | 1 ของเดือน 15:00 |
| payroll-report | payroll-report | 1 ของเดือน 09:00 | 1 ของเดือน 16:00 |
| payment-followup-hourly | payment-followup | ทุก 1 ชม. | ตลอดเวลา (ทวงใบแจ้งชำระค้าง) |
| coo-agent-morning | coo-agent | 00:00 | 07:00 (สรุปงานเช้า) |
| coo-agent-evening | coo-agent | 11:00 | 18:00 (สรุปงานเย็น) |
| kb-self-learn-daily | kb-self-learn | 01:00 | 08:00 (ร่างคำตอบใหม่เข้า KB) |
| content-calendar-weekly | content-calendar | จันทร์ 04:00 | จันทร์ 11:00 (วางแผนเนื้อหา) |
| video-repurpose-weekly | video-repurpose | อาทิตย์ 04:00 | อาทิตย์ 11:00 (ตัดคลิปสั้น) |
| reschedule-assistant-hourly | reschedule-assistant | ทุก 1 ชม. | ตลอดเวลา (เสนอเลื่อนคาบ) |

**ตรวจว่า cron ทำงานจริง (ไม่ใช่แค่ถูกสร้าง):** เปิด Supabase Dashboard → Edge Functions → Logs
กรองด้วยชื่อฟังก์ชัน (เช่น `system-health-check`) — ต้องเห็นการ invoke ทุก 15 นาที
ฟังก์ชัน cron ทั้งหมด require header `x-cron-secret` ตรงกับ secret `CRON_SECRET` (ตั้งในขั้น C) — ถ้าเห็น
401 ใน log แปลว่า secret ไม่ตรงกับค่าที่ฝังใน migrations

## J. วัด AI response จริง (เป้า PRD 3–5s)

1. หลังเชื่อม Gemini แล้ว เปิดแอพ → `/chat` (Inbox) → ส่งข้อความจริง 1 ข้อความ
2. Supabase Dashboard → Edge Functions → เลือกฟังก์ชัน `chat-core` (หรือ `ai-chat`) → Logs
   → ดู execution time ของการ invoke นั้น
3. จดตัวเลขลง README (Performance section) — นี่คือ data point แรกเทียบเป้า 3–5s
   (ค่าแรกอาจสูงเพราะ cold start; วัด 2–3 ครั้งแล้วเอาค่าเฉลี่ย)

---

## K. อัปเดตโค้ดครั้งถัดไป

```bash
git pull
cd bos
npm install
npm run typecheck && npm run lint && npm run test
for fn in $(ls supabase/functions | grep -v "^_shared$" | grep -v "^deno.json$"); do
  supabase functions deploy "$fn"
done
npm run build        # แล้ว sync out/ → studio/ ที่ root (ขั้นตอนใน README)
```

> หมายเหตุ: โค้ด edge function ทั้งหมดอยู่ใน repo นี้แล้ว (`bos/supabase/functions/`) —
> deploy จาก repo เสมอ อย่าแก้ฟังก์ชันที่ Dashboard เพราะจะไม่มี version control
