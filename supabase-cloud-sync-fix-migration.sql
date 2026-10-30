-- Fix: sync_cloud_state() failed on EVERY call with "column reference "key" is ambiguous" (the OUT columns key / value / client_ts of RETURNS TABLE clash with the
-- table columns inside INSERT ... ON CONFLICT). The client swallowed the error, so user_cloud_state stayed empty for every user. `#variable_conflict use_column`
-- makes the table columns win. Same behaviour otherwise. Re-runnable.
create or replace function public.sync_cloud_state(p_updates jsonb)
returns table(key text, value jsonb, updated_at timestamptz, client_ts timestamptz)
language plpgsql security definer set search_path to 'public' as $function$
#variable_conflict use_column
declare
  u uuid := auth.uid();
  k text;
  e jsonb;
  v jsonb;
  ts bigint;
  ts_ts timestamptz;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception 'invalid payload';
  end if;
  for k, e in select * from jsonb_each(p_updates)
  loop
    if length(k) > 64 or k = '' then continue; end if;
    if not (e ? 'v') or not (e ? 'ts') then continue; end if;
    v := coalesce(e->'v', 'null'::jsonb);
    begin
      ts := (e->>'ts')::bigint;
    exception when others then continue;
    end;
    if ts is null or ts <= 0 then continue; end if;
    ts_ts := to_timestamp(ts / 1000.0);
    ts_ts := least(greatest(ts_ts, '2000-01-01'::timestamptz), now() + interval '5 minutes');
    insert into user_cloud_state (user_id, key, value, client_ts)
      values (u, k, v, ts_ts)
    on conflict (user_id, key) do update
      set value = excluded.value, client_ts = excluded.client_ts, updated_at = now()
      where user_cloud_state.client_ts < excluded.client_ts;
  end loop;
  return query
    select s.key, s.value, s.updated_at, s.client_ts
    from user_cloud_state s
    where s.user_id = u
    order by s.key;
end; $function$;
