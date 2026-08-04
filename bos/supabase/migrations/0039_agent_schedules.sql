-- TIGA AI AGENT scheduled runs: the owner writes a natural-language
-- instruction once and picks a recurrence; agent-schedule-runner (invoked
-- by pg_cron every 5 minutes, see 0040_agent_schedule_cron_job.sql) feeds
-- that instruction to the same owner-mode respond() used by the Floating
-- Assistant, so scheduled runs can use every OWNER_TOOLS action too
-- (recording transactions, writing Knowledge Base entries, etc).

create table agent_schedules (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  instruction text not null,
  recurrence_type text not null check (recurrence_type in ('once', 'daily', 'every_n_days', 'weekly', 'monthly')),
  interval_days smallint,
  day_of_week smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 31),
  time_of_day time not null,
  run_once_at timestamptz,
  active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('success', 'error')),
  last_run_result text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_schedules_due_idx on agent_schedules (next_run_at) where active;

create trigger agent_schedules_set_updated_at
  before update on agent_schedules
  for each row execute function set_updated_at();

alter table agent_schedules enable row level security;

-- Same sensitivity tier as transactions (0018_transactions.sql) -- a
-- schedule can trigger record_transaction on the owner's behalf, so
-- configuring schedules needs the same owner/admin gate.
create policy "agent_schedules: owner manages" on agent_schedules for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());
