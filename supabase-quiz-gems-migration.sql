-- Knowledge-quiz gems (Auto Teaching 2.0) + gems-trigger fix
-- ------------------------------------------------------------------
-- Owner-approved plan: tigamodel/docs/02-auto-teaching-plan.md §4.2
-- (approved 2026-09-20 with TTS excluded). The knowledge quiz in the
-- auto-teach popup pays +5 gems on a correct answer. Following the repo
-- hard rule, gems are the one currency a client may never write:
-- _protect_gems_columns rejects every direct update, so the ONLY paths
-- are SECURITY DEFINER functions that the server itself is in charge of.
-- The server, not the client, decides:
--   * one reward of +5 gems per UTC day (hard cap — bounded economy);
--   * p_card_id is accepted for future analytics only and NEVER affects
--     the amount — nothing to inflate or replay;
--   * no correct/wrong input at all — the client cannot claim more by
--     lying about the answer (an incorrect answer simply doesn't call it).
-- The worst a tampered client can do is claim its daily allowance without
-- answering, the same exposure the practice-gem and daily chest already have.
--
-- ALSO INCLUDED — FIX for a real bug this file introduces nothing of, but
-- which supabase-practice-gems-migration.sql left behind: that file
-- re-created _protect_gems_columns with the guard
--     if auth.uid() = NEW.id then raise ...
-- Inside a SECURITY DEFINER grant RPC, auth.uid() STILL reports the calling
-- user (it reads the request JWT, not the function role), and the RPC updates
-- that very user's row — so the guard fires against grant_practice_gem's own
-- update and the RPC has been rejecting itself (the client treats the error
-- as "silently grants nothing", which is why it went unnoticed). The original
-- gems migration used the correct form for exactly this reason:
--     if current_user = 'authenticated' then raise ...   -- definer RPCs run
-- as the function owner, so they pass; direct client writes don't.
-- This file re-creates the trigger with the correct form and adds the two
-- new quiz columns to the protected set. Re-runnable, additive only.
-- Review this file, then run it in the Supabase SQL Editor (or the owner
-- can ask Codebuff to apply it via the Management API as before).
-- ------------------------------------------------------------------

alter table public.profiles add column if not exists quiz_gems_day  date;
alter table public.profiles add column if not exists quiz_gems_today int not null default 0;

create or replace function public._protect_gems_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if NEW.gems is distinct from OLD.gems
       or NEW.gems_prestige_claimed is distinct from OLD.gems_prestige_claimed
       or NEW.practice_gems_day is distinct from OLD.practice_gems_day
       or NEW.practice_gems_today is distinct from OLD.practice_gems_today
       or NEW.quiz_gems_day is distinct from OLD.quiz_gems_day
       or NEW.quiz_gems_today is distinct from OLD.quiz_gems_today then
      raise exception 'gems can only change via grant_gems_for_prestige/grant_practice_gem/grant_quiz_gem/spend_gems_for_coins, not a direct write';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists protect_gems_columns on public.profiles;
create trigger protect_gems_columns
  before update on public.profiles
  for each row execute function public._protect_gems_columns();

-- Grant the day's quiz reward: +5 gems on the FIRST correct answer of the day,
-- 0 afterwards (cap is per-day on the server, reset on the UTC date).
-- Returns { granted, remaining, gems } — granted is 0 when the cap is spent,
-- which is a normal outcome and not an error.
create or replace function public.grant_quiz_gem(p_card_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_cap   int  := 5;                  -- QUIZ_GEM_DAILY (paid once)
  v_day   date;
  v_today int;
  v_gems  int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select quiz_gems_day, quiz_gems_today, gems
    into v_day, v_today, v_gems
    from public.profiles where id = v_uid for update;

  if v_day is distinct from current_date then
    v_day := current_date; v_today := 0;
  end if;

  if v_today >= v_cap then
    return jsonb_build_object('granted', 0, 'remaining', 0, 'gems', coalesce(v_gems, 0));
  end if;

  update public.profiles
     set gems = coalesce(gems, 0) + v_cap,
         quiz_gems_day = v_day,
         quiz_gems_today = v_today + v_cap
   where id = v_uid
   returning gems into v_gems;

  return jsonb_build_object('granted', v_cap, 'remaining', v_cap - (v_today + v_cap), 'gems', v_gems);
end $$;

revoke all on function public.grant_quiz_gem(text) from public;
grant execute on function public.grant_quiz_gem(text) to authenticated;
