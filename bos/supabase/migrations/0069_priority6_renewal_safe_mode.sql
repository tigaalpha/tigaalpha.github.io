-- Priority 6, Chunk 1: Renewal Assistant needs a report_type value to save
-- its draft under (same dynamic drop/recreate-constraint pattern already
-- used for automation_rules.trigger_type in 0066). No other schema change
-- needed here -- Safe Mode reuses the existing schema-free
-- integration_settings key/value store, and the daily-briefing on-demand
-- trigger is an auth change in the edge function, not a schema change.

do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'ai_reports' and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%report_type%';
  if con_name is not null then
    execute format('alter table ai_reports drop constraint %I', con_name);
  end if;
end $$;

alter table ai_reports add constraint ai_reports_report_type_check check (report_type in (
  'daily_briefing', 'weekly_business_report', 'student_progress', 'sales_followup_draft', 'renewal_draft'
));
