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
{ "conversationId": "uuid (optional — creates a new conversation if omitted)", "message": "string" }

// Response
{ "conversationId": "uuid", "reply": "string", "needsReview": false }
```

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
  "gemini": { "connected": true, "detail": "GEMINI_API_KEY is set" }
}
```

Live-tests LINE (`GET /v2/bot/info`) and Google Calendar (lists a 1-minute
window of events) using whatever credentials are currently configured;
Gemini is only checked for key presence, not a real call, to avoid burning
quota on every status refresh.
