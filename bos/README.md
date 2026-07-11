# Tiga AI Business Operating System (Tiga AI BOS)

An AI-first business operating system for Tiga Studio (piano school): an AI
Employee that handles reception, customer service, booking, calendar
management, sales, CRM, and course renewal — backed by a real database and
editable, RAG-powered knowledge base rather than a hardcoded chatbot.

## Stack

- **Frontend**: Next.js 15 (App Router, **static export**), React 19, TypeScript (strict), Tailwind CSS, hand-rolled shadcn-style UI primitives, FullCalendar, Framer Motion. Ships as plain static HTML/JS — hosted on GitHub Pages, same as the existing Tiga Piano AI site.
- **Backend**: Supabase (Postgres + pgvector + RLS) + **Supabase Edge Functions** (Deno) for anything that needs a secret key.
- **AI**: Google Gemini (Developer API, free tier), called only from Edge Functions — the Gemini key never reaches the browser.
- **Integrations**: LINE Messaging API, Google Calendar API, Google OAuth (Supabase Auth, client-side).

## Why static + Edge Functions

This app is deployed as a static site (like the existing piano-school site at
the repo root), not a Node server. GitHub Pages can't run server code, and
secrets (Gemini key, Google client secret, LINE tokens) can never be shipped
in a client-side JS bundle. So the split is:

- **Static frontend** (this Next.js app, `output: 'export'`): all reads/writes
  that a signed-in staff member is allowed to do directly, protected by
  Postgres Row Level Security (`is_staff()`), talking to Supabase straight
  from the browser.
- **Supabase Edge Functions** (`supabase/functions/*`): the few operations
  that need a secret — calling Gemini, calling Google Calendar, calling
  LINE. The browser calls these via `supabase.functions.invoke(...)`, never
  holding the underlying credentials itself.

Route protection is client-side only (`features/auth/components/auth-guard.tsx`)
since static export has no middleware — the real security boundary is
Postgres RLS, not this guard.

## Architecture

```
/app                    Next.js routes (App Router, all client components)
  /(workspace)          Authenticated shell: dashboard, calendar, chat, students, sales, booking, knowledge, reports, settings, notifications
  /login
/components/ui          Reusable design-system primitives (Button, Card, Badge, Input, EmptyState, Skeleton)
/features/<name>        Feature-scoped components/hooks, one folder per PRD module
  /auth                  LoginCard, AuthGuard (client-side session check + redirect)
/services
  /supabase/client.ts    Single browser Supabase client (plain @supabase/supabase-js)
  /repositories          Repository pattern — one class per aggregate (customers, courses, bookings, sales, notifications, conversations, knowledge, teachers), usable from any client
/supabase
  /migrations            SQL migrations (schema, RLS policies, triggers)
  /functions
    /_shared             ai-provider.ts (vendor-agnostic interface, selects by AI_PROVIDER), ai-types.ts, gemini.ts (the Gemini implementation), calendar.ts (fetch-based, no SDKs), line.ts, prompts.ts, tools.ts, chat-core.ts, text.ts, auth.ts, cors.ts, supabase-admin.ts
    /ai-chat             Web chat endpoint (verify_jwt=true)
    /line-webhook        LINE webhook (verify_jwt=false — authenticated by X-Line-Signature instead)
    /bookings            Create/reschedule/cancel/complete a lesson (verify_jwt=true)
    /calendar-sync       Reconciles bookings vs. live Google Calendar (verify_jwt=true)
    /knowledge-upload    Chunks + embeds a knowledge base document (verify_jwt=true)
/prompts                 Source-of-truth markdown for AI prompts (mirrored into supabase/functions/_shared/prompts.ts, since Edge Functions can't read arbitrary repo files at runtime — keep both in sync)
/types                    Shared TypeScript types (database schema)
/docs/API.md              Edge Function reference
```

## Key business rules implemented

- **Calendar event naming**: `<lesson-number><StudentName>`, e.g. `1TONY` … `40TONY`
- **Calendar color rules**: yellow (Banana) for a normal lesson, green (Basil) for the final lesson of a course — final lesson also means "collect payment / discuss renewal"
- **Automatic hour tracking**: a DB trigger increments `current_hour` / decrements `remaining_hour` whenever a booking flips to `completed`, and fires renewal notifications at 1 hour remaining and at course completion (`supabase/migrations/0008_hour_tracking.sql`)
- **No double-booking**: a DB constraint trigger rejects overlapping bookings per teacher; the `bookings` Edge Function also pre-checks before writing
- **AI cost optimization** (`supabase/functions/_shared/chat-core.ts`): opening-message replies are cached (`ai_response_cache`, 6h TTL) so identical FAQ questions from different customers don't each cost a Gemini call; message history sent to the model is capped at 12 messages, with everything older compressed into a one-time conversation summary instead of silently dropped; knowledge base search happens via function-calling before the model needs to guess

## Getting started

### 1. Frontend

```bash
cd bos
npm install
cp .env.example .env.local   # only NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are needed here
npm run dev                  # http://localhost:3000
npm run typecheck && npm run lint && npm run build   # build output goes to /out
```

### 2. Database

Apply migrations in `supabase/migrations/` in numeric order (Supabase SQL editor, or `supabase db push` with the CLI).

### 3. Edge Functions

Deploy each folder under `supabase/functions/` (excluding `_shared` and `deno.json`, which are dependencies, not functions themselves):

```bash
supabase functions deploy ai-chat
supabase functions deploy line-webhook --no-verify-jwt
supabase functions deploy bookings
supabase functions deploy calendar-sync
supabase functions deploy knowledge-upload
```

Then set their secrets (Project Settings → Edge Functions → Secrets, or `supabase secrets set`):

```
AI_PROVIDER=gemini
GEMINI_API_KEY=...
AI_MODEL=gemini-flash-latest
AI_EMBEDDING_MODEL=text-embedding-004
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_CALENDAR_ID=primary
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — no need to set them.)

### 4. First login / granting yourself access

Every table's RLS policy requires a matching row in `profiles` (`is_staff()`).
Signing in with Google creates a Supabase `auth.users` row but **not** a
`profiles` row — until one exists, a freshly-logged-in user sees an empty
app everywhere (RLS blocks all reads). After your first Google login, run:

```sql
insert into profiles (id, full_name, role)
select id, email, 'owner' from auth.users where email = 'you@example.com';
```

### 5. Publishing to GitHub Pages

`next.config.ts` sets `basePath: '/studio'` and `output: 'export'`. `npm run build`
produces `/out` — copy its contents into a `/studio` folder at the repo root
and commit, so it's served at `https://tigaalpha.github.io/studio/`
alongside the existing site at the repo root. Change `BASE_PATH` in
`lib/constants.ts` (and `next.config.ts`, which imports it) if you want a
different path — also update the hardcoded `/studio` paths in
`public/manifest.webmanifest` (`start_url`, `scope`, icon `src`s), since a
static manifest can't reference the TS constant.

## Environment variables

See `.env.example` for the frontend (public-only) and the Edge Functions
section above for secrets. No vendor key ever ships in the static bundle.

## Notes

- PWA installable: `public/icons/icon-{192,512}.png` (generated) + `public/sw.js` (minimal network-first service worker, registered from `components/service-worker-register.tsx`) satisfy Chrome/Edge's "Add to Home Screen" criteria.
- `GOOGLE_REFRESH_TOKEN` is a single-tenant refresh token for the studio's own Google Calendar (obtained once via an OAuth consent flow); there's no UI to (re)generate it yet.
- The dynamic `/students/[id]` route was intentionally changed to `/students/detail?id=...` — static export can't pre-render dynamic segments for IDs that don't exist at build time.
