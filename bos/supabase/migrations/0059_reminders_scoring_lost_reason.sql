-- Three Level 2/3 follow-ups in one migration:
-- 1. Lesson reminder automation (a few hours before start_time, not the
--    existing 24h-ahead "lessons today" digest) -- reuses the Level 2
--    automation engine (automation_rules/automation-engine-runner) rather
--    than a bespoke cron function, same way course_ending_soon/
--    customer_inactive already work as periodic-condition rules.
-- 2. Deterministic lead scoring (rule-based, not AI -- distinct from the
--    AI-narrative reports in ai_reports) computed on every customers
--    insert/update so it's always current, no separate recompute job.
-- 3. lost_reason on sales_status_history, captured when a customer moves
--    to 'lost' (see the new status-change UI on the student detail page).

-- --- 1. Lesson reminder trigger type -----------------------------------

do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'automation_rules' and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%trigger_type%';
  if con_name is not null then
    execute format('alter table automation_rules drop constraint %I', con_name);
  end if;
end $$;

alter table automation_rules add constraint automation_rules_trigger_type_check check (trigger_type in (
  'customer_created', 'sales_status_changed', 'booking_created', 'booking_cancelled',
  'course_ending_soon', 'course_expired', 'customer_inactive', 'booking_starting_soon'
));

-- Enabled by default (unlike the other seed templates) -- this is a
-- direct, explicit feature request meant to be live immediately, not an
-- optional suggestion the owner has to opt into.
insert into automation_rules (name, description, trigger_type, trigger_config, conditions, actions, enabled, is_template) values
(
  'เตือนลูกค้าก่อนถึงเวลาเรียน',
  'ส่งข้อความ LINE เตือนลูกค้าล่วงหน้าไม่กี่ชั่วโมงก่อนถึงเวลาคาบเรียน (เฉพาะลูกค้าที่เคยทักแชท LINE มาแล้ว)',
  'booking_starting_soon',
  jsonb_build_object('hoursBefore', 3, 'cooldownHours', 24),
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('type', 'send_line_message', 'config', jsonb_build_object())),
  true, true
);

-- --- 2. Lead scoring ------------------------------------------------

alter table customers add column lead_score smallint not null default 0;

create or replace function compute_lead_score_row(
  p_sales_status sales_status, p_learning_goal text, p_budget text, p_last_contact_at timestamptz, p_created_at timestamptz
) returns smallint
language plpgsql
stable
as $$
declare
  score smallint;
  reference_time timestamptz := coalesce(p_last_contact_at, p_created_at);
  days_since_contact numeric;
begin
  score := case p_sales_status
    when 'new_lead' then 10
    when 'contacted' then 20
    when 'qualified' then 30
    when 'interested' then 40
    when 'trial_booked' then 60
    when 'trial_completed' then 70
    when 'negotiating' then 80
    when 'waiting_decision' then 85
    when 'won' then 100
    when 'renew_pending' then 90
    when 'renewed' then 100
    when 'lost' then 0
    else 10
  end;

  if p_learning_goal is not null and p_learning_goal <> '' then score := score + 10; end if;
  if p_budget is not null and p_budget <> '' then score := score + 5; end if;

  days_since_contact := extract(epoch from (now() - reference_time)) / 86400;
  if days_since_contact <= 7 then
    score := score + 5;
  elsif days_since_contact > 30 and p_sales_status not in ('won', 'lost', 'renewed') then
    score := score - 10;
  end if;

  return greatest(0, least(100, score));
end;
$$;

create or replace function trg_customers_lead_score() returns trigger
language plpgsql set search_path = public as $$
begin
  new.lead_score := compute_lead_score_row(new.sales_status, new.learning_goal, new.budget, new.last_contact_at, new.created_at);
  return new;
end;
$$;

create trigger customers_lead_score before insert or update on customers
  for each row execute function trg_customers_lead_score();

-- Backfill existing rows (the trigger only fires on future writes).
update customers set lead_score = compute_lead_score_row(sales_status, learning_goal, budget, last_contact_at, created_at);

-- --- 3. Lost reason tracking -----------------------------------------

alter table sales_status_history add column lost_reason text check (lost_reason in (
  'price', 'timing', 'competitor', 'no_response', 'not_interested', 'other'
));
