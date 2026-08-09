-- Level 5 Wave 3, chunk 1: cash flow risk alert -- reuses the same
-- trend-based forecast already built for revenue_drop (Wave 1's
-- computeCashFlowForecast), fires only on high-confidence, actually-
-- negative cash flow, not just decelerating growth.

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
  'course_ending_soon', 'course_expired', 'customer_inactive', 'booking_starting_soon',
  'revenue_drop', 'cash_flow_risk'
));

-- Disabled by default (proactive suggestion, matching revenue_drop's
-- convention, not an explicit request) -- the owner opts in from the
-- Automation dashboard.
insert into automation_rules (name, description, trigger_type, trigger_config, conditions, actions, enabled, is_template) values
(
  'แจ้งเตือนความเสี่ยงกระแสเงินสด',
  'เทียบแนวโน้มกระแสเงินสด 45 วันล่าสุด แจ้งเจ้าของเฉพาะเมื่อข้อมูลเชื่อถือได้และกำลังขาดทุนสุทธิจริง',
  'cash_flow_risk',
  jsonb_build_object('cooldownHours', 24),
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('type', 'notify_owner', 'config', jsonb_build_object('title', 'ความเสี่ยงกระแสเงินสด'))),
  false, true
);
