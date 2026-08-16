# Edge Function Reference

The frontend is a static export — there are no Next.js API routes. Anything
needing a secret key runs as a Supabase Edge Function under
`supabase/functions/`, called from the browser via
`supabase.functions.invoke(name, { body })` (adds the caller's JWT
automatically) or, for LINE, called directly by LINE's servers.

Every function except `line-webhook` requires a valid Supabase session
(`verify_jwt: true`) **and** a matching row in `profiles` (checked inside the
function via `requireStaff()`) — a signed-in Google account alone is not
enough.

## `ai-chat` (verify_jwt: true)

Send a message to the AI on behalf of a web-chat conversation.

```json
// Request
{ "conversationId": "uuid (optional — creates a new conversation if omitted)", "message": "string", "mode": "owner (optional)" }

// Response
{ "conversationId": "uuid", "reply": "string", "needsReview": false }
```

`mode: "owner"` is the Floating AI Assistant (bottom-right button on every page) —
the owner/staff commanding the AI directly rather than a customer conversation.
It creates the conversation on its own `internal` channel (excluded from the
customer Inbox) and uses the owner-oriented system prompt, but has access to
the exact same tools (`book_lesson`, `update_customer_profile`,
`change_sales_status`, `search_knowledge_base`, etc.) so it can act on any
department directly from the chat.

## `line-webhook` (verify_jwt: false)

LINE Messaging API webhook. Verifies `X-Line-Signature` against
`LINE_CHANNEL_SECRET` itself, since it can't carry a Supabase session.
Configure this function's URL in the LINE Developers console for OA
`422gobjh`.

## `bookings` (verify_jwt: true)

Single endpoint, dispatches on `action`:

```json
{ "action": "create", "customerId": "uuid", "teacherId": "uuid", "startTime": "ISO", "endTime": "ISO" }
{ "action": "reschedule", "bookingId": "uuid", "newStart": "ISO", "newEnd": "ISO" }
{ "action": "cancel", "bookingId": "uuid" }
{ "action": "complete", "bookingId": "uuid" }
```

`create` checks for an active course with remaining hours and teacher
conflicts, then creates the Google Calendar event with the correct
title/color before writing the booking row.

## `calendar-sync` (verify_jwt: true)

```json
// Request
{ "start": "ISO (optional, default now)", "end": "ISO (optional, default +14d)" }

// Response
{ "checked": 12, "drifted": 1 }
```

Reconciles bookings against the live Google Calendar; raises a
`conflict_booking` notification for any booking whose event was deleted or
moved outside the app. Intended to be called on a schedule (a Supabase
cron trigger, or any external scheduler hitting the function URL with a
service-role/staff JWT).

## `knowledge-upload` (verify_jwt: true)

Adds a knowledge base document: chunks the text, embeds each chunk via
Gemini, and stores it for RAG search.

```json
{ "title": "string", "sourceType": "pricing|promotion|teachers|policies|faq|school_info|holiday|internal_sop|sales_script|objection_handling|rule|example|correction", "content": "string" }
```

The last five source types are how the owner "trains" the AI (PRD "AI
Training") without touching code: `sales_script`/`objection_handling`/`rule`/`example`
are added from the Knowledge Base page; `correction` is written automatically
when the owner clicks "Correct this reply" on an AI message in the Inbox —
all of them just become more RAG-searchable knowledge, no fine-tuning.

Deletion happens directly from the browser (`knowledge_documents` delete is
allowed by RLS for staff) — no Edge Function needed for that.

PDF and DOCX files never touch this function or a server at all: the
Knowledge Base page extracts plain text from `.txt`/`.pdf`/`.docx` files
entirely in the browser (`pdfjs-dist` for PDF, `mammoth` for DOCX — see
`lib/extract-file-text.ts`) before calling this endpoint with the extracted
text, same as pasting it by hand.

## `create-payment` (verify_jwt: true)

Mint a bank-transfer payment for a customer (staff-only; the AI's
`create_payment_link` tool is the chat-side counterpart). Money goes
straight to the studio's bank account — nothing is charged here.

```json
// Request
{ "customerId": "uuid", "amount": 27000, "courseId": "uuid (optional)", "note": "renewal (optional)" }

// Response
{
  "paymentId": "uuid", "amount": 27000,
  "accountNumber": "3832557289", "bank": "SCB", "accountName": "นาย ณัฐพลญ์ พุทธโกษา",
  "referenceCode": "PP...",
  "qrUrl": "https://.../payment-qrs/...png (only when a PromptPay id is configured)",
  "instructions": "โอนเข้าบัญชี SCB เลขที่ 3832557289 ..."
}
```

Requires the studio's account configured first: `integration_settings`
key `payment_config` = `{ "account_number": "3832557289", "bank": "SCB", "name": "นาย ณัฐพลญ์ พุทธโกษา", "promptpay_id": "... (optional)", "income_category": "ค่าเรียนเปียโน/ดนตรี" }`.
When a `promptpay_id` is present the response also includes an EMVCo QR
(same algorithm as the TiGA Piano consumer app), stored on the `payments`
row (`qr_base64` for the web UI, `qr_url` when a public Storage upload
succeeded).

## `verify-payment` (verify_jwt: true, owner/admin)

The human-in-the-loop gate that closes the sale: the owner confirms the
bank transfer actually arrived in their banking app. Records the
income transaction in Accounting, moves the customer to `won`/`renewed` in
the pipeline, and thanks them on LINE. Same logic as the AI's
`mark_payment_paid` owner tool.

```json
// Request
{ "paymentId": "uuid", "note": "optional accounting note" }

// Response
{ "payment": { "...", "status": "paid" }, "transaction": { "..." } }
```

## `follow-up-conversations` (verify_jwt: false)

"Recover abandoned conversations" (PRD, AI Sales Employee). Runs on a
schedule via `pg_cron` + `pg_net` (migration `0015_conversation_followup`,
every 6 hours) — public because `pg_net` has no Supabase session to attach;
authenticated instead by a random secret in `integration_settings` (key
`cron_secret`, generated server-side, never committed to git) sent as the
`x-cron-secret` header.

Finds LINE conversations for customers still mid-funnel (`contacted` through
`renew_pending`) with no message in the last 48 hours, writes one natural
follow-up message per conversation via Gemini (referencing the conversation
summary if one exists), sends it with `push()`, and records
`last_followed_up_at` so the same lead isn't re-pinged every 6 hours.
Capped at 20 conversations per run.

```json
// Response
{ "checked": 3, "followedUp": 2 }
```

## Attendance confirmation (24h) — tools + reminder

The `attendance-reminder` cron (every 30 min) asks each student ~24h before
their lesson whether they'll attend — for weekly recurring slots
(`attendance_reminder_schedules`) and one-off bookings alike, with tappable
LINE quick replies (`✅ มาเรียน` / `❌ มาไม่ได้`).

The AI records the student's answer via the `record_attendance_confirmation`
tool (it's told to call it the moment the student answers; chat-core injects
an `[ATTENDANCE]` note whenever the customer has an upcoming unconfirmed
lesson):

- `bookings.attendance_status` / `attendance_reminder_schedules.attendance_status`
  → `confirmed` or `declined`
- the Google Calendar event is recolored (green = confirmed, red = declined)
  with a Thai status line in its description
- a `declined` answer raises an `attendance_declined` notification and
  pushes the owner on LINE

## `generate-article` (verify_jwt: true)

Generates one SEO/AEO-optimized article for the Content page (`/content`).
RAG-searches the knowledge base (same `match_knowledge_chunks` search the
customer-facing AI uses) so pricing, teacher names, and policies in the
article are grounded in real data, never invented. Forces structured output
via a single-tool function call (`return_article`) rather than parsing free
text, so the result is always well-formed. Saves the result as a `draft`
row in `articles` and returns it.

```json
// Request
{ "topic": "string", "targetKeyword": "string", "language": "th" | "en" }

// Response
{ "article": { "id": "uuid", "title": "string", "slug": "string", "meta_description": "string", "content": "markdown", "faq": [{ "question": "string", "answer": "string" }], "internal_link_ideas": ["string"], "status": "draft", ... } }
```

## `generate-image` (verify_jwt: true)

Generates one still image via Gemini (`gemini-2.5-flash-image`, override with
`AI_IMAGE_MODEL`) for the Image Studio page (`/images`) — raw material for
the Vertical Video page. Stores the result as base64 directly in
`generated_images` (small-business scale, no Storage bucket needed).

```json
// Request
{ "prompt": "string" }

// Response
{ "image": { "id": "uuid", "prompt": "string", "mime_type": "string", "image_base64": "string", ... } }
```

## `generate-video-script` (verify_jwt: true)

Writes a short vertical-video script (TikTok/Reels/Shorts) for the Video
Articles page (`/video-articles`) — hook, scene-by-scene script, caption,
and hashtags, grounded in the knowledge base. Forces structured output via
`return_video_script`.

```json
// Request
{ "topic": "string", "language": "th" | "en" }

// Response
{ "script": { "id": "uuid", "topic": "string", "hook": "string", "script": "string", "caption": "string", "hashtags": ["string"], ... } }
```

## `generate-voiceover` (verify_jwt: true)

Writes a voice-over narration script for lifestyle/travel video content, for
the Voice Over Scripts page (`/voice-over`) — a separate audience/tone from
the other writers (upper-class/upper-middle-class mothers, aspirational,
not sales-pitchy). Forces structured output via `return_voiceover`.

```json
// Request
{ "topic": "string", "language": "th" | "en" }

// Response
{ "script": { "id": "uuid", "topic": "string", "script": "string", ... } }
```

## `google-oauth-start` (verify_jwt: true)

Called from Settings → Integrations when the owner clicks "Connect Google
Calendar." Reads `google_client_id` from `integration_settings`, mints a
one-time state nonce (stored in the same table, 10-minute TTL), and returns
the Google consent-screen URL for the frontend to redirect to.

```json
// Response
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?...", "redirectUri": "https://<project>.supabase.co/functions/v1/google-oauth-callback" }
```

## `google-oauth-callback` (verify_jwt: false)

Google redirects the browser here after consent — no Supabase session is
attached, so this can't require a JWT; it's protected by the state nonce
from `google-oauth-start` instead. Exchanges `code` for tokens, stores the
`refresh_token` in `integration_settings`, and redirects back to
`/studio/settings/?googleCalendar=connected` (or `=error&googleCalendarError=...`).

## `integrations-status` (verify_jwt: true)

```json
// Response
{
  "line": { "connected": true, "detail": "Connected as \"Tiga Studio\"" },
  "googleCalendar": { "connected": false, "detail": "Google Calendar is not connected yet — connect it from Settings > Integrations." },
  "gemini": { "connected": true, "detail": "Gemini API key is valid" }
}
```

Live-tests all three: LINE (`GET /v2/bot/info`), Google Calendar (lists a
1-minute window of events), and Gemini (a minimal `embedContent` call) —
using whatever credentials are currently configured. A key-presence-only
check for Gemini would report "connected" for an expired or wrong-project
key, which is exactly the failure mode this must catch.

## Automation Round 2 (migration 0077)

New cron functions (all verify_jwt: false, guarded by `x-cron-secret`):

| Function | Cron | What it automates |
|---|---|---|
| `trial-followup` | every 30 min | Post-trial: asks for feedback ~30min after a trial lesson, offers the real course ~24h later |
| `automation-nudges` | hourly | Reactivates lapsed students (60d), offers renewal near course end (≤3h left), requests Google reviews (≥3 completed lessons), offers freed slots to the waitlist |
| `drip-runner` | every 6h | Sends drip campaigns to customers in each campaign's segment on `interval_days` cadence |
| `monthly-report` | 1st of month 08:00 | Pushes the previous month's P&L, lessons, new leads, won, pending invoices, top channels to the owner's LINE |
| `payroll-report` | 1st of month 09:00 | Computes each teacher's pay from `teacher_rates` × completed lesson minutes, pushes a summary to the owner |

New on-demand functions:

## `lesson-summary` (verify_jwt: true)

Turns rough teacher notes into a parent-friendly summary + homework, saves
to `lesson_notes`, and pushes it to the student's parent on LINE.

```json
// Request
{ "bookingId": "uuid", "notes": "เล่นคอร์ด C/G แล้วก็ฝึกเพลง Twinkle เริ่มคล่องแล้ว" }
```

## `messenger-webhook` (verify_jwt: false)

Facebook Messenger channel — same AI core as LINE. GET = Meta's
verification handshake (`MESSENGER_VERIFY_TOKEN`); POST = incoming messages
(`MESSENGER_PAGE_ACCESS_TOKEN`). Customers are matched by `messenger_psid`.

## `web-chat` (verify_jwt: false)

Public web-widget chat endpoint. Protected by the `x-web-chat-secret` header
(config in `integration_settings` key `web_chat_secret`, embedded in the
widget script) instead of a JWT. Conversations are channel `web`; the AI has
no customer tools there until the visitor identifies themselves.

## line-webhook additions

- **Image messages** are treated as transfer slips: Gemini vision extracts
  the amount/reference, matches against the customer's pending payments
  (exact reference, or unambiguous amount), and auto-confirms the payment
  (`confirmPaymentBySlip`). Unmatched slips alert the owner
  (`slip_unmatched`).
- **Audio messages** are transcribed (Gemini) and fed into the normal chat
  as text, so voice notes work like typed messages.

## Automation settings (integration_settings keys)

| Key | Meaning |
|---|---|
| `ai_budget_daily_tokens` | Daily AI token budget (0/empty = unlimited). When hit, the AI stops replying to customers and the owner is notified once. |
| `google_review_url` | Link used by the review-request nudge. |
| `web_chat_secret` | Shared secret for the public web-chat widget. |
| `teacher_rates` table | `rate_per_hour` per teacher — feeds the payroll report. |
| `drip_campaigns` table | Active campaigns with segment + template + interval. |

## Agent autonomy + cost tiers (migration 0078)

### `agent-action-execute` (verify_jwt: true, owner/admin)

Approve or reject a pending CEO Agent action. Body: `{ actionId, decision: "approve" | "reject" }`.
Approve executes the action (send LINE / create schedule); reject marks it rejected.
Low-risk types (`create_task`, `send_notification`) never need this — they
auto-execute when the workflow finishes and show as `auto_executed`.

### `agent-event-triggers` (verify_jwt: false, cron-only)

Hourly heartbeat (pg_cron) that watches for business events and fires a CEO
Agent workflow when one happens (deduped to once per week per type):

- `sales_drop` — won sales in the last 14 days down ≥30% vs the prior 14 days (baseline ≥2).
- `no_new_won` — zero won customers in the last 7 days when the prior 14 had at least one.

Skips firing when the daily AI budget is already exceeded.

### Model cost tiers (integration_settings keys)

| Key | Meaning |
|---|---|
| `ai_chat_model` | Master model — fallback for every tier. |
| `ai_model_chat` | Customer chat (LINE/web/Messenger) — the highest-volume, cheapest work. |
| `ai_model_agent` | TIGA AI Agent (CEO planner/synthesis + specialist tasks). |
| `ai_model_content` | Content generators (articles, scripts, ads, voiceover, …). |
| `ai_video_daily_limit` | Max AI video clips per day (0/empty = unlimited). Veo/Seedance are the most expensive calls in the app. |

Every `generate()` result now stamps the real model (id or OpenRouter slug)
into `ai_usage_log.model`, so the cost dashboard can break spend down per
model instead of "unknown". Gemini system prompts are also cached
(cachedContents, 1h TTL) so repeated prompts pay the cheaper cached-input
rate.

### Agent tables added

- `agent_actions` — executable recommendations with status
  (`pending_approval` → `executed`/`rejected`, or `auto_executed`/`failed`).
- `agent_event_trigger_log` — dedupe log for event triggers.
- `agent_workflow_runs.feedback` — owner 👍/👎 on a report, fed back into
  the next synthesis.
