-- Level 1 hardening follow-up: two tables never got wired into the audit
-- trail. agent_schedules controls automated TIGA AI AGENT runs (including
-- record_transaction, which touches money) — the same accountability
-- reasoning that got transactions/profiles/ad_campaigns audited in 0045/
-- 0046 applies here too. teachers is a lower-stakes staff record but cheap
-- to include for consistency.
--
-- integration_settings.value and google_calendar_connections.refresh_token
-- are real secrets (API keys / OAuth refresh tokens) — reusing the plain
-- log_audit_event() trigger on them would copy those secrets in cleartext
-- into audit_log on every change, widening the blast radius of a leak. A
-- redacting variant logs that a change happened (who, when, which row)
-- without ever storing the secret value itself.

create or replace function log_audit_event_redacted() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb;
  v_key text;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_old := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_new := to_jsonb(new);
  else
    v_entity_id := new.id;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  foreach v_key in array tg_argv loop
    if v_old is not null and v_old ? v_key then
      v_old := jsonb_set(v_old, array[v_key], '"[REDACTED]"');
    end if;
    if v_new is not null and v_new ? v_key then
      v_new := jsonb_set(v_new, array[v_key], '"[REDACTED]"');
    end if;
  end loop;

  if tg_op = 'DELETE' then
    v_diff := v_old;
  elsif tg_op = 'INSERT' then
    v_diff := v_new;
  else
    v_diff := jsonb_build_object('old', v_old, 'new', v_new);
  end if;

  insert into audit_log (actor_id, action, entity_type, entity_id, diff)
  values (auth.uid(), tg_op, tg_table_name, v_entity_id, v_diff);

  return coalesce(new, old);
end;
$$;

create trigger agent_schedules_audit
  after insert or update or delete on agent_schedules
  for each row execute function log_audit_event();

create trigger teachers_audit
  after insert or update or delete on teachers
  for each row execute function log_audit_event();

-- integration_settings has no "id" column (key is the primary key) — the
-- generic log_audit_event()/log_audit_event_redacted() both key off
-- old/new.id, which would error on a table without one. Give it its own
-- tiny redacting trigger that uses "key" as the entity id instead.
create or replace function log_integration_settings_audit() returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_diff jsonb;
begin
  if tg_op = 'DELETE' then
    v_diff := jsonb_build_object('key', old.key, 'value', '[REDACTED]');
  elsif tg_op = 'INSERT' then
    v_diff := jsonb_build_object('key', new.key, 'value', '[REDACTED]');
  else
    v_diff := jsonb_build_object('key', new.key, 'old_value', '[REDACTED]', 'new_value', '[REDACTED]');
  end if;

  insert into audit_log (actor_id, action, entity_type, entity_id, diff)
  values (auth.uid(), tg_op, 'integration_settings', null, v_diff);

  return coalesce(new, old);
end;
$$;

create trigger integration_settings_audit
  after insert or update or delete on integration_settings
  for each row execute function log_integration_settings_audit();

create trigger google_calendar_connections_audit
  after insert or update or delete on google_calendar_connections
  for each row execute function log_audit_event_redacted('refresh_token');
