-- Agent autonomy round: CEO Agent recommendations become executable
-- actions (auto-run low-risk ones, approve the rest), plus event-driven
-- workflows (sales drop / no-new-won triggers) and per-workflow feedback
-- that feeds the synthesis prompt.

-- 1. Owner feedback on a CEO Agent report ("useful" / "not_useful") --
-- fed back into the next synthesis so the CEO learns what the owner
-- actually wants.
alter table agent_workflow_runs add column if not exists feedback text
  check (feedback in ('useful', 'not_useful'));

-- 2. Executable recommended actions. One row per CEO recommendation that
-- carried an executable action; advisory recommendations (no action_type)
-- are never inserted -- they live only in recommended_actions jsonb.
-- status: pending_approval -> approved -> executed / failed
--         auto_executed (low-risk types run without asking)
--         rejected (owner declined)
create table if not exists agent_actions (
  id uuid primary key default uuid_generate_v4(),
  workflow_run_id uuid not null references agent_workflow_runs (id) on delete cascade,
  title text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  action_type text not null check (action_type in ('create_task', 'send_notification', 'send_line', 'create_schedule')),
  action_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected', 'executed', 'auto_executed', 'failed')),
  result text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create index agent_actions_workflow_idx on agent_actions (workflow_run_id);
create index agent_actions_status_idx on agent_actions (status, created_at desc);

alter table agent_actions enable row level security;
create policy "agent_actions: owner manages" on agent_actions for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 3. Event-trigger dedupe log: one row per trigger firing so the hourly
-- cron doesn't re-run the same condition over and over (look-back window
-- is enforced in code; this table just records what already fired).
create table if not exists agent_event_trigger_log (
  id uuid primary key default uuid_generate_v4(),
  trigger_type text not null,
  detail text,
  workflow_run_id uuid references agent_workflow_runs (id) on delete set null,
  triggered_at timestamptz not null default now()
);

create index agent_event_trigger_log_type_idx on agent_event_trigger_log (trigger_type, triggered_at desc);

alter table agent_event_trigger_log enable row level security;
create policy "agent_event_trigger_log: owner manages" on agent_event_trigger_log for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());

-- 4. Hourly event-trigger cron -- watches for business events (sales
-- drop, no new won customers) and fires a CEO Agent workflow when one
-- happens, same x-cron-secret pattern as every other heartbeat job.
select cron.schedule(
  'agent-event-triggers-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/agent-event-triggers',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
