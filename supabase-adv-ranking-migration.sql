-- Adventure: best times per map, with the checks done on the SERVER (plan 33, O5 — the part of "server authority" that can be done without
-- a game server). WRITTEN, NOT APPLIED: the owner reviews and runs this in the Supabase SQL editor. The app calls it fail-soft, so nothing
-- breaks while it is not applied (the Best times panel just shows an empty list).
-- Additive and re-runnable. A row is ONE best time per player per map. The client reports "I cleared <map> in <secs>"; the server refuses what
-- cannot be true instead of trusting it: a time under the map's minimum, more than one submit a few seconds apart, a name that is not 1-14 chars.
-- Nothing here pays coins, EXP or crystals: it is a leaderboard only, so a cheater can at worst put a false time on a board.

create table if not exists public.adv_best_times (
  user_id    uuid not null references auth.users(id) on delete cascade,
  map_id     text not null check (char_length(map_id) between 2 and 24),
  secs       integer not null check (secs between 8 and 7200),
  pilot      text not null check (char_length(pilot) between 1 and 14),
  updated_at timestamptz not null default now(),
  primary key (user_id, map_id)
);
create index if not exists adv_best_times_rank_idx on public.adv_best_times (map_id, secs asc);

alter table public.adv_best_times enable row level security;
-- anyone signed in may read the boards; nobody writes directly (the RPC below is the only way in)
drop policy if exists adv_best_read on public.adv_best_times;
create policy adv_best_read on public.adv_best_times for select to authenticated using (true);

-- the fastest a map can honestly be cleared, in seconds (a floor, not a target): measured from the shortest real runs, rounded down
create or replace function public.adv_min_secs(p_map text) returns integer language sql immutable as $$
  select case
    when p_map in ('arkbuild') then 20            -- a placement puzzle: eight moves is a few seconds of tapping plus reading
    when p_map in ('arkfarm','arkherd') then 140  -- the farms run a 150 s clock; a win cannot come much earlier
    when p_map in ('shadow') then 48              -- the evade map is a fixed 50 s
    when p_map in ('jovia','marscolony') then 85  -- survival maps hold out ~90 s
    else 25
  end
$$;

create or replace function public.adv_submit_time(p_map text, p_secs integer, p_pilot text)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); last_at timestamptz;
begin
  if uid is null then return false; end if;
  if p_map is null or char_length(p_map) not between 2 and 24 or p_map !~ '^[a-z0-9]+$' then return false; end if;
  if p_secs is null or p_secs < public.adv_min_secs(p_map) or p_secs > 7200 then return false; end if;
  if p_pilot is null or char_length(btrim(p_pilot)) not between 1 and 14 then return false; end if;
  select updated_at into last_at from public.adv_best_times where user_id = uid order by updated_at desc limit 1;
  if last_at is not null and last_at > now() - interval '5 seconds' then return false; end if;   -- no flooding
  insert into public.adv_best_times (user_id, map_id, secs, pilot) values (uid, p_map, p_secs, left(btrim(p_pilot), 14))
  on conflict (user_id, map_id) do update
    set secs = least(public.adv_best_times.secs, excluded.secs), pilot = excluded.pilot, updated_at = now();
  return true;
end $$;

create or replace function public.adv_top_times(p_map text, p_limit integer default 10)
returns table (pilot text, secs integer) language sql stable security definer set search_path = public as $$
  select pilot, secs from public.adv_best_times where map_id = p_map order by secs asc, updated_at asc limit least(greatest(p_limit, 1), 25)
$$;

revoke all on function public.adv_submit_time(text, integer, text) from public;
revoke all on function public.adv_top_times(text, integer) from public;
grant execute on function public.adv_submit_time(text, integer, text) to authenticated;
grant execute on function public.adv_top_times(text, integer) to authenticated;
