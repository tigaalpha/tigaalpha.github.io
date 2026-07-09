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
{ "title": "string", "sourceType": "pricing|promotion|teachers|policies|faq|school_info|holiday|internal_sop", "content": "string" }
```

Deletion happens directly from the browser (`knowledge_documents` delete is
allowed by RLS for staff) — no Edge Function needed for that.
