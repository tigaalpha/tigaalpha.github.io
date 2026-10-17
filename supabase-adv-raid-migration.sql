-- Adventure: the community weekly raid (plan 35). One shared kill counter per week for every player, with the checks done on the SERVER
-- (level A of "server fairness": the server refuses what cannot be true, it does not simulate the fight).
-- Additive and re-runnable. Pays NOTHING (no coins, EXP or crystals): it is an honour counter, so a cheater can at worst move a bar.
-- The client calls it fail-soft; while this is not applied the raid line simply shows nothing.
-- Week number = floor(unix seconds / 604800), the same number the client computes with Date.now() / 604800000.

create table if not exists public.adv_raid_week (
  week  integer primary key,
  total bigint not null default 0
);
create table if not exists public.adv_raid_user (
  week    integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  added   integer not null default 0,
  last_at timestamptz not null default now(),
  primary key (week, user_id)
);
alter table public.adv_raid_week enable row level security;
alter table public.adv_raid_user enable row level security;
-- no direct access at all: the two functions below are the only way in and out
drop policy if exists adv_raid_week_read on public.adv_raid_week;

create or replace function public.adv_raid_week_now() returns integer language sql stable as $$
  select floor(extract(epoch from now()) / 604800)::integer
$$;

-- add this player's kills from one cleared map. Refuses: signed out, more than 60 kills in one call, calls under 20 s apart,
-- and more than 1500 kills per player per week. Returns the new weekly total (or -1 when refused).
create or replace function public.adv_raid_add(p_n integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); wk integer := public.adv_raid_week_now(); n integer; prev_at timestamptz; prev_added integer; tot bigint;
begin
  if uid is null or p_n is null or p_n < 1 then return -1; end if;
  n := least(p_n, 60);
  select last_at, added into prev_at, prev_added from public.adv_raid_user where week = wk and user_id = uid;
  if found then
    if prev_at > now() - interval '20 seconds' then return -1; end if;
    if prev_added + n > 1500 then n := 1500 - prev_added; end if;
    if n < 1 then return -1; end if;
    update public.adv_raid_user set added = added + n, last_at = now() where week = wk and user_id = uid;
  else
    insert into public.adv_raid_user (week, user_id, added) values (wk, uid, n);
  end if;
  insert into public.adv_raid_week (week, total) values (wk, n)
    on conflict (week) do update set total = public.adv_raid_week.total + n returning total into tot;
  return tot;
end $$;

create or replace function public.adv_raid_get() returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select total from public.adv_raid_week where week = public.adv_raid_week_now()), 0)
$$;

revoke all on function public.adv_raid_add(integer) from public, anon;
revoke all on function public.adv_raid_get() from public, anon;
grant execute on function public.adv_raid_add(integer) to authenticated;
grant execute on function public.adv_raid_get() to authenticated;
