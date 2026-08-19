-- Generic audit trail: the audit_log table existed since 0006 but nothing
-- ever wrote to it. One trigger function, attached to every table an owner
-- would want a history of, logs actor + before/after diff.
--
-- actor_id is auth.uid() when the write came from the browser (RLS-scoped
-- client); it's null for writes made by Edge Functions via the service role
-- (AI tool calls, LINE webhook) — those are still logged, just attributed to
-- "system" rather than a specific staff member.

create or replace function log_audit_event() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_diff jsonb;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_diff := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_diff := to_jsonb(new);
  else
    v_entity_id := new.id;
    v_diff := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  end if;

  insert into audit_log (actor_id, action, entity_type, entity_id, diff)
  values (auth.uid(), tg_op, tg_table_name, v_entity_id, v_diff);

  return coalesce(new, old);
end;
$$;

create trigger customers_audit
  after insert or update or delete on customers
  for each row execute function log_audit_event();

create trigger bookings_audit
  after insert or update or delete on bookings
  for each row execute function log_audit_event();

create trigger courses_audit
  after insert or update or delete on courses
  for each row execute function log_audit_event();

create trigger sales_status_history_audit
  after insert on sales_status_history
  for each row execute function log_audit_event();
