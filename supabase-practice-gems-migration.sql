-- Practice Mode gems
-- ------------------------------------------------------------------
-- Gems are the one currency a client may never write: _protect_gems_columns
-- (supabase-gamification-gems-migration.sql) rejects EVERY direct update to
-- profiles.gems, so the only ways to get one are the prestige grant, a real
-- purchase, or a function like this that the server itself is in charge of.
--
-- Practice Mode is meant to be the one place gems can be EARNED rather than
-- bought, and they are meant to stay rare next to coins. So the server, not
-- the client, decides:
--   * one gem per grant, never a handful;
--   * a hard daily ceiling (PRACTICE_GEM_DAILY), reset on the UTC date;
--   * no input from the caller at all — nothing to inflate or replay.
-- The worst a tampered client can do is claim its daily allowance without
-- having practised, which is the same exposure the daily chest already has.
--
-- Review this file, then run it in the Supabase SQL Editor.
-- ------------------------------------------------------------------

alter table public.profiles add column if not exists practice_gems_day  date;
alter table public.profiles add column if not exists practice_gems_today int not null default 0;

-- The daily-counter columns are bookkeeping for this function, so they get the
-- same treatment as gems themselves: no client may write them directly.
create or replace function public._protect_gems_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = NEW.id then
    if NEW.gems is distinct from OLD.gems
       or NEW.gems_prestige_claimed is distinct from OLD.gems_prestige_claimed
       or NEW.practice_gems_day is distinct from OLD.practice_gems_day
       or NEW.practice_gems_today is distinct from OLD.practice_gems_today then
      raise exception 'gems can only change via grant_gems_for_prestige/grant_practice_gem/spend_gems_for_coins, not a direct write';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists protect_gems_columns on public.profiles;
create trigger protect_gems_columns
  before update on public.profiles
  for each row execute function public._protect_gems_columns();

-- Grant one practice gem, if today's allowance has any left.
-- Returns { granted, remaining, gems } — granted is 0 when the cap is spent,
-- which is a normal outcome and not an error.
create or replace function public.grant_practice_gem() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_cap   int  := 3;                  -- PRACTICE_GEM_DAILY
  v_day   date;
  v_today int;
  v_gems  int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select practice_gems_day, practice_gems_today, gems
    into v_day, v_today, v_gems
    from public.profiles where id = v_uid for update;

  if v_day is distinct from current_date then
    v_day := current_date; v_today := 0;
  end if;

  if v_today >= v_cap then
    return jsonb_build_object('granted', 0, 'remaining', 0, 'gems', coalesce(v_gems, 0));
  end if;

  update public.profiles
     set gems = coalesce(gems, 0) + 1,
         practice_gems_day = v_day,
         practice_gems_today = v_today + 1
   where id = v_uid
   returning gems into v_gems;

  return jsonb_build_object('granted', 1, 'remaining', v_cap - (v_today + 1), 'gems', v_gems);
end $$;

revoke all on function public.grant_practice_gem() from public;
grant execute on function public.grant_practice_gem() to authenticated;
