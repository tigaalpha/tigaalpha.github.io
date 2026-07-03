# API Reference

All routes live under `app/api/`. Except the LINE webhook, every route
requires an authenticated staff session (enforced by `middleware.ts`); there
is no public customer-facing API yet.

## `POST /api/ai/chat`

Send a message to the AI on behalf of a web-chat conversation.

```json
// Request
{ "conversationId": "uuid (optional — creates a new conversation if omitted)", "message": "string" }

// Response
{ "conversationId": "uuid", "reply": "string", "needsReview": false }
```

## `POST /api/line/webhook`

LINE Messaging API webhook. Verifies `X-Line-Signature` against
`LINE_CHANNEL_SECRET`; not session-authenticated. Configure this URL in the
LINE Developers console for OA `422gobjh`.

## `GET /api/bookings?start=ISO&end=ISO&teacherId=uuid`

Lists bookings in a time range, optionally filtered by teacher.

## `POST /api/bookings`

Creates a booking (checks conflicts, creates the Google Calendar event with
the correct title/color, consumes one lesson hour on completion).

```json
{ "customerId": "uuid", "teacherId": "uuid", "startTime": "ISO", "endTime": "ISO" }
```

## `PATCH /api/bookings/:id`

```json
{ "action": "reschedule", "newStart": "ISO", "newEnd": "ISO" }
{ "action": "cancel" }
{ "action": "complete" }
```

## `DELETE /api/bookings/:id`

Cancels the booking and removes its Google Calendar event.

## `GET /api/calendar/sync?start=ISO&end=ISO`

Reconciles bookings against the live Google Calendar; raises a
`conflict_booking` notification for any booking whose event was deleted or
moved outside the app. Intended to be called on a schedule (cron / edge
function trigger).

## `POST /api/knowledge/upload`

Adds a knowledge base document: chunks the text, embeds each chunk via the
configured AI provider, and stores it for RAG search.

```json
{ "title": "string", "sourceType": "pricing|promotion|teachers|policies|faq|school_info|holiday|internal_sop", "content": "string" }
```

## `DELETE /api/knowledge/upload?id=uuid`

Deletes a knowledge document and its chunks (cascade).
