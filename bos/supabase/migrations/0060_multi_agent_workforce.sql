-- Level 4 Multi-Agent Company, phase 1: a CEO Agent that takes a
-- business-level goal, breaks it into sub-questions for specialized
-- agents (Sales/Marketing/Finance/Business Analyst — see
-- _shared/agents.ts), runs them in parallel against real CRM data, and
-- synthesizes one strategic report. agent_task_runs is simultaneously the
-- execution log, the task-handoff record, and the human-control-center
-- data source -- one table instead of three separate stores for what the
-- checklist listed as three items.

create table agent_workflow_runs (
  id uuid primary key default uuid_generate_v4(),
  goal text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  final_report text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index agent_workflow_runs_created_idx on agent_workflow_runs (created_at desc);

create table agent_task_runs (
  id uuid primary key default uuid_generate_v4(),
  workflow_run_id uuid not null references agent_workflow_runs (id) on delete cascade,
  agent_id text not null,
  question text not null,
  status text not null check (status in ('success', 'failed')),
  output text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index agent_task_runs_workflow_idx on agent_task_runs (workflow_run_id);

alter table agent_workflow_runs enable row level security;
alter table agent_task_runs enable row level security;

-- Business-strategy data (revenue targets, cross-functional analysis) --
-- same tier as Accounting/Strategy Room, not general staff.
create policy "agent_workflow_runs: owner manages" on agent_workflow_runs for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());
create policy "agent_task_runs: owner reads" on agent_task_runs for select using (is_owner_or_admin());
