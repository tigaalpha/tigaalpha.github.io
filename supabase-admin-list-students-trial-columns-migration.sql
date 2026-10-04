-- ═══════════════════════════════════════════════════════════════════════════
-- Give admin_list_students_v2 the columns that decide a member's REAL plan.
--
-- WHY THIS EXISTS — read this before judging it as cosmetic.
--
-- The owner opened Admin → Student Mode and saw a list where everybody read
-- FREE, while eleven members were inside their 7-day Max trial at that very
-- moment. Nothing was broken in the app: those eleven genuinely have Max.
-- The admin console was lying, because it rendered profiles.plan straight
-- from the column, and the column says "free" for every trial member.
--
-- The reason the column lies is deliberate and lives in payment.tsx: the
-- trial length is NOT stored. effectivePlan() measures
--   (now - created_at) < TRIAL_DAYS * 1 day
-- on every single read. So a trial member has no row that says "trialmax",
-- no row that says "max", and nothing at all that distinguishes them from a
-- lapsed free account except their signup date — a column the admin RPC
-- never returned.
--
-- The fix is to return created_at and founding_member, the two inputs
-- effectivePlan() needs, and let the console ask the SAME function the app
-- asks. It is deliberately not a copy of the trial rule in SQL: a second
-- implementation of "who is in a trial" would be a second thing to drift,
-- and the drift would show up as an admin console that disagrees with the
-- product.
--
-- ── WHAT IT TOUCHES ──────────────────────────────────────────────────────
-- One function definition. No table, no column, no row, no data. It cannot
-- change what any member gets; it only changes what the admin can SEE.
--
-- is_admin is deliberately NOT added: admin_tier is already returned and is
-- what grants admin rights, and the console derives is_admin from
-- admin_tier > 0 rather than trusting a second column that could disagree.
--
-- ── WHY THE SIGNATURE CHANGES ────────────────────────────────────────────
-- Adding columns to a plpgsql `returns table` changes the function's return
-- type, so it cannot be replaced in place — Postgres refuses. The old
-- (text, int, int) signature is dropped first. That is the only destructive
-- statement here and it costs nothing: the function is security definer,
-- fully recreated in the same file, and the console's only caller
-- (App.tsx AdminStudents) passes named arguments, so it is unaffected by
-- the argument list.
--
-- ── RUN ORDER ────────────────────────────────────────────────────────────
-- Run AFTER supabase-grant-max-one-year-migration.sql is reviewed. Running
-- this one first is harmless — it changes no data — but the owner wants the
-- console to be truthful at the moment the grant lands.
--
-- ── STATUS ───────────────────────────────────────────────────────────────
-- APPLIED to project gsaqgbracxnucdmtmcxz on 2026-10-04. It changed the
-- function definition only — public.profiles was not touched (70 rows before,
-- 70 rows after; 55 still on free, 10 still-active Max). Re-running it is
-- safe: the file drops and recreates the function, so it is idempotent.
--
-- ── RUN IT ───────────────────────────────────────────────────────────────
-- Supabase SQL Editor, project gsaqgbracxnucdmtmcxz, AFTER human review.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── STEP 0 (read-only): confirm the old shape before replacing it ────────
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'admin_list_students_v2';
-- expect one row: admin_list_students_v2(p_search, p_limit, p_offset)


-- ── STEP 1: replace it, with the two columns added at the END so every
--             existing positional read keeps working ─────────────────────────
drop function if exists public.admin_list_students_v2(text, int, int);
create or replace function public.admin_list_students_v2(p_search text default null, p_limit int default 200, p_offset int default 0)
returns table(
  id uuid, full_name text, email text, admin_tier smallint, banned boolean,
  plan text, plan_until timestamptz, exp int, lessons_done int, streak int,
  last_active date, progress jsonb,
  coins int, gems int,
  /* new — the two inputs effectivePlan() needs, and nothing else */
  created_at timestamptz,
  founding_member boolean
)
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select p.admin_tier into v_tier from profiles p where p.id = auth.uid();
  if coalesce(v_tier, 0) < 1 then raise exception 'insufficient admin tier'; end if;
  return query
    select p.id, p.full_name, p.email, p.admin_tier, p.banned, p.plan, p.plan_until,
      p.exp, p.lessons_done, p.streak, p.last_active, p.progress,
      p.coins, p.gems,
      p.created_at, p.founding_member
    from profiles p
    where p_search is null or trim(p_search) = ''
      or p.full_name ilike '%' || trim(p_search) || '%'
      or p.email ilike '%' || trim(p_search) || '%'
    order by p.last_active desc nulls last, p.exp desc
    limit least(coalesce(p_limit, 200), 500)
    offset greatest(coalesce(p_offset, 0), 0);
end; $$;

-- grant execute to the same roles the original had, so the console does not
-- start returning "permission denied for function admin_list_students_v2"
grant execute on function public.admin_list_students_v2(text, int, int) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after running ───────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The function exists with the new columns.
--    expect: 17 output columns, ending in created_at + founding_member
select p.proname, pg_get_function_result(p.oid) as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'admin_list_students_v2';

-- 2. The eleven members the console used to show as FREE. This is the exact
--    population effectivePlan() resolves to Max right now, computed the same
--    way the app computes it — so after the console change they must show MAX.
--    expect: 11 rows, every one of them inside the 7-day window.
select count(*) as in_max_trial_now
from public.profiles
where coalesce(plan, 'free') = 'free'
  and not coalesce(is_admin, false)
  and now() - created_at < interval '7 days';

-- 3. No row was changed by this migration — it defines a function, nothing else.
--    expect: total unchanged from whatever you counted before (70 as of 2026-10-04).
select count(*) as total_profiles from public.profiles;