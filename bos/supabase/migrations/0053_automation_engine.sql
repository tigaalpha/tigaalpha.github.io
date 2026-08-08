-- Level 2: core automation engine (trigger -> condition -> action).
--
-- Complements agent_schedules (0039/0040 — free-text LLM instructions on a
-- clock) rather than replacing it: agent_schedules can't react to a data
-- change (a customer's sales status flipping, a booking landing) or a
-- threshold (a course running low on hours) — it only ever fires on a
-- schedule. This engine handles the other two trigger shapes:
--   - event-driven: a DB trigger enqueues a row into automation_events the
--     instant something happens (customer created, sales_status changed,
--     booking created/cancelled) — DB-level so no insert/update code path
--     can forget to enqueue.
--   - periodic-condition: course_ending_soon / course_expired /
--     customer_inactive have no single discrete row-change that means "this
--     just became true" — automation-engine-runner scans for these
--     directly each tick instead (see the edge function).
-- Rules are pure data (trigger_type + trigger_config + conditions + ordered
-- actions) evaluated by automation-engine-runner against a small, fixed
-- action registry (_shared/automation-actions.ts) — deliberately not a
-- generic arbitrary-code executor.

alter type notification_type add value if not exists 'automation';

create table automation_rules (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in (
    'customer_created', 'sales_status_changed', 'booking_created', 'booking_cancelled',
    'course_ending_soon', 'course_expired', 'customer_inactive'
  )),
  trigger_config jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  is_template boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger automation_rules_set_updated_at
  before update on automation_rules
  for each row execute function set_updated_at();

create table automation_events (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index automation_events_unprocessed_idx on automation_events (created_at) where not processed;

create table automation_runs (
  id uuid primary key default uuid_generate_v4(),
  rule_id uuid not null references automation_rules (id) on delete cascade,
  event_id uuid references automation_events (id) on delete set null,
  entity_type text,
  entity_id uuid,
  status text not null check (status in ('success', 'failed', 'skipped')),
  actions_result jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index automation_runs_rule_idx on automation_runs (rule_id, started_at desc);
create index automation_runs_started_idx on automation_runs (started_at desc);

-- Minimal generic task engine — its own feature, but shipped alongside the
-- engine since "create_task" is one of the four actions in the registry
-- and is meaningless without a table to write to.
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  customer_id uuid references customers (id) on delete set null,
  assigned_to uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  automation_rule_id uuid references automation_rules (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_due_idx on tasks (status, due_at);
create trigger tasks_set_updated_at before update on tasks for each row execute function set_updated_at();
create trigger tasks_audit after insert or update or delete on tasks for each row execute function log_audit_event();

alter table automation_rules enable row level security;
alter table automation_events enable row level security;
alter table automation_runs enable row level security;
alter table tasks enable row level security;

-- Rules can execute record-touching actions (change sales status, message a
-- customer on LINE) -- same owner/admin tier as agent_schedules.
create policy "automation_rules: owner manages" on automation_rules for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());

-- Events/runs are written only by the engine (service role); staff can read
-- for transparency, same is_staff() tier as most operational tables.
create policy "automation_events: staff read" on automation_events for select using (is_staff());
create policy "automation_runs: staff read" on automation_runs for select using (is_staff());

-- Tasks are a day-to-day staff tool (teachers/staff need to see and
-- complete follow-ups too), not owner-only.
create policy "tasks: staff manage" on tasks for all using (is_staff()) with check (is_staff());

create or replace function enqueue_automation_event(
  p_event_type text, p_entity_type text, p_entity_id uuid, p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into automation_events (event_type, entity_type, entity_id, payload)
  values (p_event_type, p_entity_type, p_entity_id, p_payload);
end;
$$;

create or replace function trg_automation_customer_created() returns trigger
language plpgsql set search_path = public as $$
begin
  perform enqueue_automation_event('customer_created', 'customer', new.id, jsonb_build_object('name', new.name));
  return new;
end;
$$;
create trigger automation_customer_created after insert on customers
  for each row execute function trg_automation_customer_created();

create or replace function trg_automation_sales_status_changed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.sales_status is distinct from old.sales_status then
    perform enqueue_automation_event('sales_status_changed', 'customer', new.id,
      jsonb_build_object('from', old.sales_status, 'to', new.sales_status));
  end if;
  return new;
end;
$$;
create trigger automation_sales_status_changed after update on customers
  for each row execute function trg_automation_sales_status_changed();

create or replace function trg_automation_booking_created() returns trigger
language plpgsql set search_path = public as $$
begin
  perform enqueue_automation_event('booking_created', 'booking', new.id,
    jsonb_build_object('customerId', new.customer_id, 'startTime', new.start_time));
  return new;
end;
$$;
create trigger automation_booking_created after insert on bookings
  for each row execute function trg_automation_booking_created();

create or replace function trg_automation_booking_cancelled() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform enqueue_automation_event('booking_cancelled', 'booking', new.id,
      jsonb_build_object('customerId', new.customer_id, 'startTime', new.start_time));
  end if;
  return new;
end;
$$;
create trigger automation_booking_cancelled after update on bookings
  for each row execute function trg_automation_booking_cancelled();

-- Seeded templates -- disabled by default. The owner reviews and enables
-- whichever make sense from the Automation page, and can edit
-- thresholds/actions from there too.
insert into automation_rules (name, description, trigger_type, trigger_config, conditions, actions, enabled, is_template) values
(
  'คอร์สใกล้หมดชั่วโมง',
  'แจ้งเตือนเจ้าของ + สร้างงานติดตามเมื่อคอร์สเหลือชั่วโมงน้อย',
  'course_ending_soon',
  jsonb_build_object('thresholdHours', 2, 'cooldownHours', 72),
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('type', 'notify_owner', 'config', jsonb_build_object('title', 'คอร์สใกล้หมดชั่วโมง')),
    jsonb_build_object('type', 'create_task', 'config', jsonb_build_object('title', 'ติดตามต่ออายุคอร์ส', 'dueInDays', 2, 'priority', 'high'))
  ),
  false, true
),
(
  'ลูกค้าเงียบหายไปนาน',
  'สร้างงานติดตามลูกค้าที่ไม่มีความเคลื่อนไหว (last_contact_at) เกิน 30 วัน และยังไม่ปิดสถานะ won/lost',
  'customer_inactive',
  jsonb_build_object('days', 30, 'cooldownHours', 168),
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('type', 'create_task', 'config', jsonb_build_object('title', 'ติดต่อลูกค้าที่เงียบไป', 'dueInDays', 1, 'priority', 'medium'))
  ),
  false, true
),
(
  'ลูกค้าสถานะ Lost — แจ้งเจ้าของ',
  'แจ้งเตือนเจ้าของทันทีเมื่อลูกค้าถูกปิดสถานะเป็น Lost',
  'sales_status_changed',
  '{}'::jsonb,
  jsonb_build_array(jsonb_build_object('field', 'to', 'operator', 'eq', 'value', 'lost')),
  jsonb_build_array(
    jsonb_build_object('type', 'notify_owner', 'config', jsonb_build_object('title', 'ลูกค้าสถานะ Lost'))
  ),
  false, true
),
(
  'จองคาบเรียนใหม่ — แจ้งเจ้าของ',
  'แจ้งเตือนเจ้าของทุกครั้งที่มีการจองคาบเรียนใหม่ผ่านระบบ',
  'booking_created',
  '{}'::jsonb,
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('type', 'notify_owner', 'config', jsonb_build_object('title', 'มีการจองคาบเรียนใหม่'))
  ),
  false, true
);
