-- Level 5 phase 1: closes the loop on the Level 4 CEO Agent (its report was
-- previously dead-end prose -- now it can also emit structured, human-
-- approved recommended actions) and adds one more periodic-condition
-- automation trigger (revenue_drop) for the Owner Control Center.

-- --- 1. Structured CEO Agent recommendations --------------------------

alter table agent_workflow_runs add column recommended_actions jsonb;

-- --- 2. Revenue drop alert trigger type --------------------------------

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
  'course_ending_soon', 'course_expired', 'customer_inactive', 'booking_starting_soon', 'revenue_drop'
));

-- Disabled by default (unlike booking_starting_soon, this is a proactive
-- suggestion, not an explicit feature request) -- the owner opts in from
-- the Automation dashboard.
insert into automation_rules (name, description, trigger_type, trigger_config, conditions, actions, enabled, is_template) values
(
  'แจ้งเตือนรายได้ลดลงผิดปกติ',
  'เทียบรายได้สุทธิ 7 วันล่าสุดกับ 7 วันก่อนหน้า แจ้งเจ้าของถ้าลดลงเกินเกณฑ์ที่กำหนด',
  'revenue_drop',
  jsonb_build_object('thresholdPercent', 20, 'cooldownHours', 24),
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('type', 'notify_owner', 'config', jsonb_build_object('title', 'รายได้ลดลงผิดปกติ'))),
  false, true
);
