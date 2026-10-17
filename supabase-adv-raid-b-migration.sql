-- Adventure raid, level B: the server COMPARES the reports of the pilots in one room (plan 35). Additive and re-runnable.
-- Room kills are shared (every client counts the whole room's kills), so honest pilots of one room report about the same number.
-- adv_raid_add2 therefore: stores each pilot's report (room, map, kills, seconds), caps a report by what the OTHER pilots of the same
-- room and map reported in the last 15 minutes (1.25 x the highest of them + 3), caps a lone report by what the clock allows
-- (2 kills per second, at most 40, and the map must have run 20 s), and only then adds to the weekly total. Pays nothing.
create table if not exists public.adv_raid_report (
  id         bigserial primary key,
  room       text not null check (room ~ '^[A-Z0-9]{6}$'),
  map_id     text not null check (map_id ~ '^[a-z0-9]{2,24}$'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kills      integer not null,
  secs       integer not null,
  counted    integer not null,
  created_at timestamptz not null default now()
);
create index if not exists adv_raid_report_room_idx on public.adv_raid_report (room, map_id, created_at desc);
alter table public.adv_raid_report enable row level security;   -- no policies: the function below is the only way in

create or replace function public.adv_raid_add2(p_n integer, p_room text, p_map text, p_secs integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); wk integer := public.adv_raid_week_now(); n integer; prev_at timestamptz; prev_added integer; tot bigint; others integer;
begin
  if uid is null or p_n is null or p_n < 1 or p_secs is null or p_secs < 20 then return -1; end if;
  if p_room is null or p_room !~ '^[A-Z0-9]{6}$' or p_map is null or p_map !~ '^[a-z0-9]{2,24}$' then return -1; end if;
  n := least(p_n, 60, p_secs * 2, 40 + case when p_secs > 120 then 20 else 0 end);
  select max(kills) into others from public.adv_raid_report
    where room = p_room and map_id = p_map and user_id <> uid and created_at > now() - interval '15 minutes';
  if others is not null then n := least(n, floor(others * 1.25)::integer + 3); end if;
  select last_at, added into prev_at, prev_added from public.adv_raid_user where week = wk and user_id = uid;
  if found then
    if prev_at > now() - interval '20 seconds' then return -1; end if;
    if prev_added + n > 1500 then n := 1500 - prev_added; end if;
    if n < 1 then return -1; end if;
    update public.adv_raid_user set added = added + n, last_at = now() where week = wk and user_id = uid;
  else
    insert into public.adv_raid_user (week, user_id, added) values (wk, uid, n);
  end if;
  insert into public.adv_raid_report (room, map_id, user_id, kills, secs, counted) values (p_room, p_map, uid, p_n, p_secs, n);
  insert into public.adv_raid_week (week, total) values (wk, n)
    on conflict (week) do update set total = public.adv_raid_week.total + n returning total into tot;
  delete from public.adv_raid_report where created_at < now() - interval '2 days';
  return tot;
end $$;
revoke all on function public.adv_raid_add2(integer, text, text, integer) from public, anon;
grant execute on function public.adv_raid_add2(integer, text, text, integer) to authenticated;
