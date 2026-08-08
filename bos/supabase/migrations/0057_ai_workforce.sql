-- Level 3 AI Workforce, phase 1: the shared "AI does one analysis/drafting
-- job" primitive (ai_reports), usage/cost accounting (ai_usage_log), and a
-- new approval type so an AI-drafted customer message has somewhere safe
-- to land for human review before it's ever sent (extends approval_type,
-- same pattern as cancel_paid_lesson/ad_campaign_spend in 0025).

create table ai_reports (
  id uuid primary key default uuid_generate_v4(),
  report_type text not null check (report_type in (
    'daily_briefing', 'weekly_business_report', 'student_progress', 'sales_followup_draft'
  )),
  entity_type text,
  entity_id uuid,
  title text not null,
  content text not null,
  data jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index ai_reports_type_idx on ai_reports (report_type, created_at desc);
create index ai_reports_entity_idx on ai_reports (entity_type, entity_id);

alter table ai_reports enable row level security;

-- Same tier as automation_runs -- informational output, not money-moving
-- itself (the actions that data feeds into, like sales_followup_draft's
-- approval request, carry their own stricter policy).
create policy "ai_reports: staff read" on ai_reports for select using (is_staff());

create table ai_usage_log (
  id uuid primary key default uuid_generate_v4(),
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  source text not null,
  created_at timestamptz not null default now()
);

create index ai_usage_log_created_idx on ai_usage_log (created_at desc);

alter table ai_usage_log enable row level security;
create policy "ai_usage_log: staff read" on ai_usage_log for select using (is_staff());

-- security definer + no insert/update/delete policy at all: the only way a
-- row gets written is through this function, called with the numbers the
-- server itself measured -- a client can't forge usage numbers to make the
-- cost dashboard say whatever it wants.
create or replace function log_ai_usage(p_model text, p_prompt_tokens integer, p_completion_tokens integer, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into ai_usage_log (model, prompt_tokens, completion_tokens, source)
  values (p_model, p_prompt_tokens, p_completion_tokens, p_source);
end;
$$;

alter type approval_type add value if not exists 'ai_drafted_message';

-- New automation action type ('draft_followup_message', see
-- automation-actions.ts) needs its own check-constraint-free actions.type
-- column (already just jsonb text, no constraint to update) to route
-- through, and a new check constraint value on automation_rules.trigger_type
-- is not needed since this reuses the existing 'customer_inactive' trigger.
-- Ship it as a NEW seed template (disabled by default) alongside the
-- existing "ลูกค้าเงียบหายไปนาน" one from 0053, rather than editing that row
-- in place -- the owner may already have reviewed/customized it, and this
-- keeps the plain create_task option available too.
insert into automation_rules (name, description, trigger_type, trigger_config, conditions, actions, enabled, is_template) values
(
  'ลูกค้าเงียบหายไปนาน (AI ร่างข้อความติดตามให้)',
  'เหมือนกฎ "ลูกค้าเงียบหายไปนาน" เดิม แต่ให้ AI ร่างข้อความติดตามลูกค้าคนนั้นโดยเฉพาะ แล้วส่งเข้าคิวรออนุมัติที่หน้าการอนุมัติ — ไม่ส่งให้ลูกค้าทันที ต้องกดอนุมัติ (แก้ไขข้อความก่อนได้) เอง',
  'customer_inactive',
  jsonb_build_object('days', 30, 'cooldownHours', 168),
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('type', 'draft_followup_message', 'config', jsonb_build_object())
  ),
  false, true
);
