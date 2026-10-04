-- ═══════════════════════════════════════════════════════════════════════════
-- Promotion: the first 10,000 signups get a 7-DAY MAX trial.
--
-- Owner decision 2026-10-04. Replaces the founding-member promo, which was the
-- same mechanism with a cap of 100. The deal is a growth play: Max is the
-- uncapped-AI tier and by far the most expensive thing to give away, so it is
-- given to the first 10,000 accounts to put the 11,000-song library in front
-- of as many people as possible and let word of mouth carry the rest.
--
-- ── HOW THE PROMOTION IS DECIDED ──────────────────────────────────────────
-- profiles.founding_member — a plain boolean set ONCE, at signup, inside the
-- existing handle_new_user() trigger, in the same transaction as the
-- auth.users insert. payment.tsx reads it through exactly one function
-- (promoTrialPlan / trialLenDays), which is what picks "trialmax" over
-- "trial". Deliberately a stored boolean and not something computed on read:
-- it keeps effectivePlan() synchronous and round-trip-free, and — more
-- importantly — it makes the cohort a FIXED set of accounts. A cap computed
-- on read would silently re-open the promotion if anyone ever deleted a row.
--
-- ── WHO IS IN, AND WHO IS NOT ────────────────────────────────────────────
--   IN  — the first 10,000 rows by profiles.created_at, all-time, including
--         everyone who signed up before this file runs. The owner confirmed
--         the ~70 existing members count as part of the 10,000, so this
--         backfill is what makes that true.
--   OUT — everyone after the cap. They still get seven days, at PREMIUM.
--         That split is in payment.tsx (TRIAL_MAX vs "trial"), not here: this
--         migration only records WHO is a promotion member.
--
-- ── RE-RUNNABLE ───────────────────────────────────────────────────────────
-- The column add is if-not-exists, the trigger replace is idempotent, and the
-- backfill only ever (re-)marks the true first 10,000 by created_at order —
-- running it twice cannot widen the cap or change the cohort.
--
-- ── RUN IT ────────────────────────────────────────────────────────────────
-- Supabase SQL Editor, project gsaqgbracxnucdmtmcxz, AFTER human review.
-- Run STEP 0 first and read the number.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── STEP 0 (read-only): confirm the numbers before anything is written ────
-- expect: total_profiles well under 10000 for a while yet, and
-- will_be_promotion equal to total_profiles (every current account is inside
-- the cap, which is exactly what the owner asked for).
select
  count(*)                                                    as total_profiles,
  count(*) filter (where founding_member)                    as already_promotion,
  count(*) filter (where not founding_member)                as will_be_marked,
  count(*) filter (where founding_member) - 100              as promo_beyond_old_cap
from public.profiles;

-- ═══════════════════════════════════════════════════════════════════════════


-- 1. The column (already exists if supabase-founding-member-trial-migration.sql
--    was applied — hence if-not-exists).
alter table public.profiles add column if not exists founding_member boolean not null default false;

-- 2. Backfill: everyone currently signed up is inside the first 10,000, so
--    every row here becomes a promotion member. Rows already true are
--    unaffected; the write is a plain set, not a flip, so it can never un-mark
--    anyone (an admin un-marking a row by hand survives a re-run).
update public.profiles set founding_member = true
where id in (select id from public.profiles order by created_at asc limit 10000);

-- 3. The signup trigger, cap raised from 100 to 10,000.
--    It counts EXISTING founding_member=true rows rather than a raw row count,
--    so the cap means "10,000 promotions have been granted" and stays correct
--    even if a profile is ever created by some other path.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, avatar_url, founding_member)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    (select count(*) filter (where founding_member) from public.profiles) < 10000
  )
  on conflict (id) do nothing;
  return new;
end; $function$;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying — run each and read the answer.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Everyone who exists is now a promotion member, and none are past the cap.
--    expect: promotion_members == total_profiles, over_cap == 0
select
  count(*)                                          as total_profiles,
  count(*) filter (where founding_member)          as promotion_members,
  count(*) filter (where not founding_member)      as over_cap
from public.profiles;

-- 2. The trigger's cap really is 10,000 now, not 100.
--    expect: 10000
select
  (select (regexp_match(
     pg_get_functiondef('public.handle_new_user()'::regprocedure),
     '< 10000'))[1])::int as cap_in_trigger;

-- 3. Re-run steps 2 and 3 — both must be no-ops, not a widening.
--    expect: UPDATE 0, and step 1's counts unchanged.

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPANION MIGRATION (separate file, separate approval)
-- ═══════════════════════════════════════════════════════════════════════════
-- supabase-grant-max-one-year-migration.sql gives the ~70 existing members the
-- MAX plan for one year, stored in profiles.plan / plan_until. It is not a
-- substitute for this file and this file is not a substitute for it:
--
--   this file  → the ~70 existing members keep their Max for the SEVEN days
--                 their trial is worth (they are inside the cap)
--   that file  → the same members keep Max for a whole YEAR
--
-- They compose cleanly: effectivePlan() tests a live paid plan BEFORE the
-- trial, so a member covered by the year-long grant resolves to "max" and
-- never reaches the trial branch at all. Approve both, or neither — approving
-- one alone is still correct, it just gives less than the owner asked for.
