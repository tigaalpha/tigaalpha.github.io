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
  /(workspace)          Authenticated shell: dashboard, calendar, chat, students, sales, booking, knowledge, content (SEO/AEO), reports, settings, notifications
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
    /google-oauth-start  Builds the Google consent URL for Settings > Integrations (verify_jwt=true)
    /google-oauth-callback  Google redirects here after consent; exchanges code for a refresh token (verify_jwt=false — protected by a one-time state nonce instead)
    /integrations-status Tests LINE / Google Calendar / Gemini connectivity for Settings > Integrations (verify_jwt=true)
    /follow-up-conversations  Recovers abandoned sales conversations on a schedule (verify_jwt=false — protected by a cron secret instead, called by pg_cron + pg_net)
    /generate-article    Writes one SEO/AEO article grounded in the knowledge base for the Content page (verify_jwt=true)
/lib/extract-file-text.ts  Client-side .txt/.pdf/.docx text extraction for the Knowledge Base upload flow (pdfjs-dist + mammoth) — no server round-trip
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
- **Abandoned conversation recovery**: `follow-up-conversations` Edge Function runs every 6 hours (`supabase/migrations/0015_conversation_followup.sql`), finds LINE conversations mid-sales-funnel gone quiet for 48h+, and sends one natural AI follow-up per lead via LINE push
- **Full CRM qualification capture**: the AI's `update_customer_profile` tool can save every field the PRD's "Customer Qualification" section lists — age, goal, budget, experience, preferred schedule, preferred teacher (resolved via the `list_teachers` tool), parent info, and lead source

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
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALENDAR_ID=primary
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — no need to set them.)

`GOOGLE_CLIENT_ID` and `GOOGLE_REFRESH_TOKEN` are **not** set as secrets —
they're connected from the app itself at Settings → Integrations (paste the
Client ID, click "Connect Google Calendar," approve the Google consent
screen). That flow stores them in the `integration_settings` table;
`calendar.ts` reads from there first and falls back to the
`GOOGLE_CLIENT_ID` / `GOOGLE_REFRESH_TOKEN` secrets only for a project set
up the old way, before this UI existed.

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

## Performance (PRD targets, verified)

PRD targets: First Load <2s, Search <300ms, Calendar Update <500ms, AI
Response 3-5s. Measured against the actual production build (`npm run
build`, served locally, Playwright, 5 samples each, 2026-07-12):

| Target | PRD | Measured | Result |
|---|---|---|---|
| First Load — `/login` | <2000ms | avg 48ms | ✅ |
| First Load — `/dashboard` shell | <2000ms | avg 48ms | ✅ |
| First Load — `/calendar` (heaviest bundle, 252kB) | <2000ms | avg 54ms | ✅ |
| Search (in-memory filter, 500 records) | <300ms | 0.2ms | ✅ |

These are app-rendering time only (local server, no CDN/network latency to
GitHub Pages or the user's connection) — they isolate the one thing the code
controls. Real-world load time will be higher by whatever the network adds,
but the app itself has no rendering bottleneck close to the 2s budget.

**Calendar Update (<500ms) and AI Response (3-5s)** depend on live
third-party API latency (Google Calendar API, Gemini API) that can only be
observed from real production traffic with a signed-in staff session —
something this session has no credentials for. Historical Edge Function
logs (`get_logs`) show two `ai-chat` calls from earlier in this build (before
the AI provider abstraction and current prompt/tool set existed) that failed
after 13.6s and 18.1s — that code path has since been rewritten and
redeployed multiple times, so it isn't representative of the current
function. There is no fresh successful invocation to cite a real number
from. Recommended next step: after connecting Google Calendar and Gemini,
send one message via the in-app chat tester (`/chat`) and check
Supabase → Edge Functions → Logs for the actual `ai-chat` execution time —
that will be the first genuine data point against the 3-5s target.

## Environment variables

See `.env.example` for the frontend (public-only) and the Edge Functions
section above for secrets. No vendor key ever ships in the static bundle.

## Notes

- PWA installable: `public/icons/icon-{192,512}.png` (generated) + `public/sw.js` (minimal network-first service worker, registered from `components/service-worker-register.tsx`) satisfy Chrome/Edge's "Add to Home Screen" criteria.
- Settings → Integrations is the in-app connection UI for LINE, Google Calendar, and Gemini: live connection status, a "Connect Google Calendar" button that runs the OAuth consent flow end to end, the exact webhook/redirect URLs to paste into LINE Developers Console and Google Cloud Console, and step-by-step setup instructions for whichever secrets genuinely can't be entered through the app (LINE tokens, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY` — Supabase Edge Function secrets, never DB rows).
- The dynamic `/students/[id]` route was intentionally changed to `/students/detail?id=...` — static export can't pre-render dynamic segments for IDs that don't exist at build time.
- Knowledge Base accepts `.txt`, `.pdf`, and `.docx` uploads directly (in addition to pasting text) — extraction happens client-side, so no file ever leaves the browser unparsed.
- Content (`/content`) is an SEO/AEO article writer: describe a topic and target keyword, and the AI writes a full article grounded in the knowledge base (never invents pricing/teacher names), with a title tag, meta description, slug, FAQ section, and internal link ideas — following the direct-answer-first, entity-clear, schema-ready structure that both Google and AI answer engines (ChatGPT, Perplexity, AI Overviews) favor. This app doesn't manage the public marketing site's CMS, so articles are drafted here for the owner to review, edit, and copy into wherever the site actually publishes content.
