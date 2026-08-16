-- AI-first solo operator round: the owner runs the business with AI doing
-- the day-to-day work — payment followups, KB self-learning, content
-- pipeline, voice receptionist logs, reschedule offers. New cron jobs use
-- the same hardcoded x-cron-secret value as 0078 (matches CRON_SECRET).

-- 1) Payment followup tracking (payment-followup function)
alter table payments add column if not exists last_reminded_at timestamptz;
alter table payments add column if not exists remind_count int not null default 0;

-- 2) Reschedule offer tracking (reschedule-assistant function)
alter table bookings add column if not exists reschedule_offered_at timestamptz;

-- 3) KB self-learning drafts — AI proposes answers for questions it
-- couldn't answer / customers ask repeatedly; owner approves → becomes a
-- real knowledge_documents row (kb-draft-action).
create table if not exists kb_drafts (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  draft_answer text not null,
  source_conversation_id uuid references conversations (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index kb_drafts_status_idx on kb_drafts (status, created_at desc);

alter table kb_drafts enable row level security;
create policy "kb_drafts: staff read" on kb_drafts for select using (is_staff());
create policy "kb_drafts: owner manages" on kb_drafts for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 4) Content calendar — AI-planned content pipeline (content-calendar,
-- video-repurpose). Owner approves in the app, then publishes manually or
-- via social-publish.
create table if not exists content_calendar (
  id uuid primary key default uuid_generate_v4(),
  kind text not null default 'article' check (kind in ('article', 'short', 'social', 'ad')),
  title text not null,
  body text,
  platform text,
  planned_date date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'skipped')),
  created_at timestamptz not null default now()
);

create index content_calendar_status_idx on content_calendar (status, planned_date);

alter table content_calendar enable row level security;
create policy "content_calendar: staff read" on content_calendar for select using (is_staff());
create policy "content_calendar: owner manages" on content_calendar for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 5) Voice call logs (voice-agent-webhook — AI receptionist e.g. Bland)
create table if not exists voice_call_logs (
  id uuid primary key default uuid_generate_v4(),
  call_id text unique,
  direction text not null default 'inbound',
  phone text,
  customer_id uuid references customers (id) on delete set null,
  status text,
  summary text,
  transcript_url text,
  created_at timestamptz not null default now()
);

create index voice_call_logs_created_idx on voice_call_logs (created_at desc);

alter table voice_call_logs enable row level security;
create policy "voice_call_logs: staff read" on voice_call_logs for select using (is_staff());

-- 6) Social post media URLs — enables image/video posts (Instagram/TikTok/
-- YouTube need an attached media, unlike Facebook text posts).
alter table social_posts add column if not exists media_urls text[] not null default '{}';

-- 7) Cron jobs (all verify against integration_settings cron_secret like
-- system-health-check; the literal below matches the CRON_SECRET secret).
select cron.schedule(
  'payment-followup-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/payment-followup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'coo-agent-morning',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/coo-agent',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'coo-agent-evening',
  '11 0 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/coo-agent',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'kb-self-learn-daily',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/kb-self-learn',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'content-calendar-weekly',
  '0 4 * * 1',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/content-calendar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'video-repurpose-weekly',
  '0 4 * * 0',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/video-repurpose',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'reschedule-assistant-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/reschedule-assistant',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
