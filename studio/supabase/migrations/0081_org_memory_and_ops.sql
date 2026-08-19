-- 0081: organizational memory + ops layer.
-- company_policies (owner decisions -> AI follows them), ai_evals (AI
-- answer quality scoring), events (recitals/exams/competitions),
-- event_participants, ad_spend_entries (ad attribution), winback_campaigns
-- (lapsed-student offers), voice_call_logs extras for outbound calls.

-- 1) Company policies — the "organizational memory": every time the owner
-- approves/edits an AI action the decision can be saved here, and chat-core
-- injects active policies into every AI reply's system prompt.
create table if not exists company_policies (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  source_type text not null default 'manual' check (source_type in ('manual', 'approval', 'kb')),
  active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table company_policies enable row level security;
create policy "company_policies: staff read" on company_policies for select using (is_staff());
create policy "company_policies: owner manages" on company_policies for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 2) AI answer evaluations (LLM-as-judge daily sampling).
create table if not exists ai_evals (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references messages (id) on delete set null,
  conversation_id uuid references conversations (id) on delete cascade,
  channel text,
  reply_text text not null,
  score int not null check (score between 1 and 5),
  reason text,
  model text,
  created_at timestamptz not null default now()
);
create index ai_evals_created_idx on ai_evals (created_at desc);
alter table ai_evals enable row level security;
create policy "ai_evals: staff read" on ai_evals for select using (is_staff());
create policy "ai_evals: owner manages" on ai_evals for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 3) Events (recitals, exams, competitions, workshops).
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  event_type text not null default 'recital' check (event_type in ('recital', 'exam', 'competition', 'workshop', 'other')),
  start_time timestamptz not null,
  end_time timestamptz,
  location text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_start_idx on events (start_time desc);
alter table events enable row level security;
create policy "events: staff read" on events for select using (is_staff());
create policy "events: owner manages" on events for all using (is_owner_or_admin()) with check (is_owner_or_admin());

create table if not exists event_participants (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  piece text,
  status text not null default 'invited' check (status in ('invited', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  unique (event_id, customer_id)
);
alter table event_participants enable row level security;
create policy "event_participants: staff read" on event_participants for select using (is_staff());
create policy "event_participants: owner manages" on event_participants for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 4) Ad spend entries — manual + future API sync, for attribution math.
create table if not exists ad_spend_entries (
  id uuid primary key default uuid_generate_v4(),
  platform text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  spend_date date not null default current_date,
  campaign_name text,
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ad_spend_date_idx on ad_spend_entries (spend_date desc);
alter table ad_spend_entries enable row level security;
create policy "ad_spend_entries: staff read" on ad_spend_entries for select using (is_staff());
create policy "ad_spend_entries: owner manages" on ad_spend_entries for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 5) Win-back campaigns — AI drafts an offer for a lapsed student; owner
-- approves; then it's sent (payment link + LINE push).
create table if not exists winback_campaigns (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  offer_text text not null,
  offer_amount numeric(12, 2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sent', 'converted', 'dismissed')),
  payment_id uuid references payments (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index winback_campaigns_status_idx on winback_campaigns (status, created_at desc);
alter table winback_campaigns enable row level security;
create policy "winback_campaigns: staff read" on winback_campaigns for select using (is_staff());
create policy "winback_campaigns: owner manages" on winback_campaigns for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 6) Teachers can receive their monthly payslip on LINE directly.
alter table teachers add column if not exists line_user_id text;

-- 7) Voice call extras for outbound calls (Bland AI).
alter table voice_call_logs add column if not exists call_id text;
alter table voice_call_logs add column if not exists recording_url text;
alter table voice_call_logs add column if not exists amount numeric(12, 2);
alter table voice_call_logs add column if not exists payment_id uuid references payments (id) on delete set null;

-- 8) Cron jobs.
select cron.schedule(
  'winback-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/winback-runner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'ai-eval-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/ai-eval-runner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
