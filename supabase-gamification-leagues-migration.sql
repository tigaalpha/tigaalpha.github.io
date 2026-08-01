-- Weekly Leagues: a lightweight, always-resetting weekly EXP competition.
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run: every object uses if-not-exists / or-replace.
--
-- Deliberately additive only — does NOT touch profiles, get_leaderboard, or
-- get_my_rank (none of which have source in this repo; see the standing rule in
-- supabase-security-hardening-migration.sql about not editing unseen functions).
--
-- Design note: a user's tier for a given week is always DERIVED live from how
-- much EXP they earned THAT week (thresholds in _league_tier below). There is
-- deliberately NO stored "current tier" and NO promotion/demotion bookkeeping —
-- that avoids needing a cron job or any background process (this project has
-- none today), and means a user's tier can never get stuck by a bug in one.

create table if not exists league_weekly_exp (
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_key    text not null,   -- matches the client's weekKey() format, e.g. "2026-8-3"
  exp_gained  int  not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, week_key)
);
create index if not exists league_weekly_exp_week_idx on league_weekly_exp (week_key, exp_gained desc);
-- NOTE: this table grows by ~1 row/user/week forever (no automatic pruning —
-- this project has no scheduled-job infra today). Rows are tiny (4 columns);
-- if it ever becomes a real storage concern, old week_key rows can be deleted
-- manually with `delete from league_weekly_exp where week_key < '<cutoff>'`.

alter table league_weekly_exp enable row level security;
drop policy if exists "league_weekly_exp: self select" on league_weekly_exp;
create policy "league_weekly_exp: self select" on league_weekly_exp for select
  using (user_id = auth.uid());
-- no client insert/update policy at all — every write goes through
-- league_bump_exp() below, same SELECT-only-RLS-plus-SECURITY-DEFINER-RPC
-- pattern used by every other table added this session.

-- Shared 5-tier threshold ladder — keep in sync with LEAGUE_TIERS in App.tsx
-- if these numbers ever change.
create or replace function public._league_tier(p_exp int) returns int
language sql immutable as $$
  select case
    when p_exp >= 3000 then 5
    when p_exp >= 1500 then 4
    when p_exp >= 800  then 3
    when p_exp >= 300  then 2
    else 1
  end;
$$;

-- Called by the client alongside gainExp() — accumulates THIS WEEK's EXP only.
-- Amount is capped per call (mirrors the existing exp/coins delta-clamp trigger
-- in supabase-security-hardening-migration.sql) so a tampered client can't
-- claim an implausible single jump straight into the top tier.
create or replace function public.league_bump_exp(p_week_key text, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_week_key is null or length(p_week_key) > 20 then raise exception 'invalid week_key'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 2000 then raise exception 'invalid amount'; end if;
  insert into league_weekly_exp (user_id, week_key, exp_gained)
    values (auth.uid(), p_week_key, p_amount)
  on conflict (user_id, week_key) do update
    set exp_gained = league_weekly_exp.exp_gained + excluded.exp_gained, updated_at = now();
end; $$;

-- Returns the caller's tier for the given week + up to 30 peers in that SAME
-- tier, ranked by this week's EXP. A brand-new week / brand-new player with 0
-- EXP still gets a valid tier-1 result (not an error) so the client never has
-- to special-case "no data yet".
create or replace function public.get_my_league(p_week_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_my_exp int; v_tier int; v_members jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select coalesce(exp_gained, 0) into v_my_exp from league_weekly_exp where user_id = v_uid and week_key = p_week_key;
  v_my_exp := coalesce(v_my_exp, 0);
  v_tier := _league_tier(v_my_exp);

  select jsonb_agg(jsonb_build_object(
      'name', coalesce(nullif(trim(p.full_name), ''), 'Player'),
      'exp', x.exp_gained,
      'is_me', x.user_id = v_uid
    ) order by x.exp_gained desc)
    into v_members
    from (
      select lwe.user_id, lwe.exp_gained
      from league_weekly_exp lwe
      where lwe.week_key = p_week_key and _league_tier(lwe.exp_gained) = v_tier
      order by lwe.exp_gained desc
      limit 30
    ) x
    join profiles p on p.id = x.user_id;

  return jsonb_build_object('week_key', p_week_key, 'tier', v_tier, 'my_exp', v_my_exp, 'members', coalesce(v_members, '[]'::jsonb));
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying:
-- 1. select league_bump_exp('test-week', 50);  -- as your own logged-in role — should succeed
-- 2. select get_my_league('test-week');         -- should return tier 1, your own row with exp 50
-- 3. select league_bump_exp('test-week', 5000); -- should FAIL ("invalid amount")
-- 4. In the app: finish any lesson/song (anything that calls gainExp) and confirm
--    no new console errors, then open Profile → WEEKLY LEAGUE and confirm it loads.
-- ═══════════════════════════════════════════════════════════════════════════
