# Tiga AI Business Operating System (Tiga AI BOS)

An AI-first business operating system for Tiga Studio (piano school): an AI
Employee that handles reception, customer service, booking, calendar
management, sales, CRM, and course renewal — backed by a real database and
editable, RAG-powered knowledge base rather than a hardcoded chatbot.

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS, hand-rolled shadcn-style UI primitives, FullCalendar, Framer Motion
- **Backend**: Supabase (Postgres + pgvector + RLS), Next.js Route Handlers
- **AI**: Google Gemini (Developer API, free tier) behind a provider interface — swap `AI_PROVIDER` to change vendors without touching business logic
- **Integrations**: LINE Messaging API, Google Calendar API, Google OAuth (Supabase Auth)

## Architecture

Clean architecture with a strict dependency direction: **UI → services (business logic) → repositories → Supabase**. AI vendor code lives only in `services/ai/gemini.ts`; everything else depends on the `AIProvider` interface in `types/ai.ts`.

```
/app                    Next.js routes (App Router)
  /(workspace)          Authenticated shell: dashboard, calendar, chat, students, sales, booking, knowledge, reports, settings, notifications
  /api                  Route handlers: AI chat, LINE webhook, calendar sync, bookings, knowledge upload
  /login, /auth/callback
/components/ui          Reusable design-system primitives (Button, Card, Badge, Input, EmptyState, Skeleton)
/features/<name>        Feature-scoped components/hooks, one folder per PRD module
/services
  /ai                   provider.ts (interface + factory), gemini.ts, rag.ts, prompts.ts, tools.ts, memory.ts, chunk.ts
  /google                Google Calendar service
  /line                  LINE messaging service
  /supabase              Browser / server / admin Supabase clients
  /repositories           Repository pattern — one class per aggregate (customers, courses, bookings, sales, notifications, conversations, knowledge, teachers)
  /business               Business logic services (booking rules: naming, color, conflict checks, hour tracking)
  container.ts            Dependency-injection wiring for API routes
/prompts                 Owner-editable AI prompts (system, sales, booking, calendar, knowledge, customer_service, renewal, owner) — no redeploy needed to change AI behavior
/supabase/migrations      SQL migrations (schema, RLS policies, triggers)
/types                    Shared TypeScript types (database schema, AI interfaces)
/docs/API.md              API route reference
```

## Key business rules implemented

- **Calendar event naming**: `<lesson-number><StudentName>`, e.g. `1TONY` … `40TONY` (`services/business/booking.service.ts`)
- **Calendar color rules**: yellow (Banana) for a normal lesson, green (Basil) for the final lesson of a course — final lesson also means "collect payment / discuss renewal" (`services/google/calendar.service.ts`)
- **Automatic hour tracking**: a DB trigger increments `current_hour` / decrements `remaining_hour` whenever a booking flips to `completed`, and fires renewal notifications at 1 hour remaining and at course completion (`supabase/migrations/0008_hour_tracking.sql`)
- **No double-booking**: a DB constraint trigger rejects overlapping bookings per teacher; the booking service also pre-checks before writing
- **AI cost optimization order** (PRD priority): Knowledge Base search → conversation memory/summarization → Gemini generation, so the model is only called when the knowledge base can't answer directly

## Getting started

```bash
cd bos
npm install
cp .env.example .env.local   # fill in Supabase / Gemini / Google / LINE credentials
```

Apply the database schema (via Supabase CLI or the SQL editor, in order):

```bash
supabase db push   # or run each file in supabase/migrations/ in numeric order
```

Run the app:

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Environment variables

See `.env.example`. All AI, Google, and LINE configuration is environment-driven — no vendor keys or endpoints are hardcoded in source.

## Notes

- `public/manifest.webmanifest` references `public/icons/icon-192.png` and `icon-512.png` — add real PNG icons before shipping as an installable PWA.
- `GOOGLE_REFRESH_TOKEN` is a single-tenant refresh token for the studio's own Google Calendar (obtained once via an OAuth consent flow); this app does not yet implement a UI to (re)generate it.
