-- ═══════════════════════════════════════════════════════════════════════════
-- Give Pro (Premium) for 7 days to everyone in the app who does not have it.
--
-- Owner decision 2026-10-05:
--   "ทุกคนที่อยู่ในแอปพลิเคชันขณะนี้จะได้แพ็กเกจ Pro ฟรี 7 วัน เฉพาะคนที่ยังไม่ได้ Pro
--    ส่วนคนที่ได้อยู่แล้วไม่ต้องไปทำอะไรกับเขา ให้เขาใช้ต่อไปแบบเดิม"
-- and, on the two questions that decide the WHERE clause:
--   "Pro"            = the existing Premium plan (not a new tier)
--   trial members    = NOT counted; they keep their 7-day trial untouched
--   length           = 7 days
--
-- ── WHY A MIGRATION IS NEEDED ──────────────────────────────────────────────
-- Same reason as supabase-grant-max-one-year-migration.sql: the trial length is
-- never stored. effectivePlan() (payment.tsx) recomputes it from created_at on
-- every read — `now - created_at < TRIAL_DAYS * 1 day` with TRIAL_DAYS_STANDARD
-- = 7. So a member who signed up more than 7 days ago resolves to "free"
-- immediately, with nothing left in the database to give them Pro. Only a real
-- stored entitlement — a plan plus a plan_until — can carry the gift, and that
-- is what the UPDATE below writes.
--
-- 7 days is also exactly the trial, which is deliberate: there is no cliff
-- between a member who signed up yesterday (trial, 7 days) and one who signed up
-- a year ago (this grant, 7 days). Same length, same features, no awkward
-- "why does the new account get longer than mine" question.
--
-- ── WHAT IT TOUCHES ──────────────────────────────────────────────────────
-- Only public.profiles.plan and public.profiles.plan_until. No new columns, no
-- table creation, no trigger replacement, no change to handle_new_user(), and
-- nothing that touches new signups.
--
-- On the security trigger (supabase-security-hardening-migration.sql,
-- _protect_sensitive_profile_fields): it raises on any change to
-- plan/plan_until, but only `if current_user = 'authenticated'`. The Supabase
-- SQL Editor runs as the editor role, not 'authenticated', so this UPDATE is
-- not blocked by it. The same UPDATE issued through a client `authenticated`
-- session WOULD be rejected — which is the trigger doing its job.
--
-- ── THE WHERE CLAUSE IS A MIRROR OF effectivePlan(), NOT A SECOND RULE ──────
-- This matters more than it looks. effectivePlan() answers "what can this
-- profile actually use" in this order:
--     1. is_admin                 -> premium
--     2. plan <> 'free' AND plan_until > now()  -> canonicalPlan(plan)
--     3. now - created_at < 7 days -> trial
--     4. otherwise                -> free
-- A row is therefore ALREADY holding Pro when rule 1, 2 or 3 fires. Granting
-- on any other basis would either overwrite a live subscription or hand a
-- second 7 days to somebody inside their trial. Each predicate below maps to
-- one of those rules, and scripts/smoke-pro-grant.mjs fails the build if this
-- file and payment.tsx ever stop agreeing.
--
-- ── WHO IS SKIPPED, AND WHY (each is a deliberate non-change) ─────────────
--   admins          — effectivePlan() already gives them premium. Writing
--                     plan='premium' would be a no-op at best; excluded so the
--                     verification query can assert they were never touched.
--   banned          — a suspended account gains nothing from a free week, and
--                     granting it would be the wrong direction to err in.
--   active paid     — anyone with plan <> 'free' AND plan_until in the future,
--                     INCLUDING the legacy strings 'max'/'maxfamily'/'family'/
--                     'trialmax' that canonicalPlan() folds into premium.
--                     Owner: "คนที่ได้อยู่แล้วไม่ต้องไปทำอะไรกับเขา" — they
--                     keep exactly what they have. Re-granting would silently
--                     roll their expiry forward and over-promise.
--   in trial        — created_at within 7 days. Owner: "ไม่นับ ให้ทดลอง 7 วัน
--                     ตามเดิม". Writing plan='premium' here would also knock
--                     them out of the trial (isTrialPlan() reads the plan
--                     string), so the countdown UI would disappear for a
--                     member who is entitled to it.
--
-- WHO *IS* GRANTED: members who signed up more than 7 days ago, are not
-- admins, are not banned, and are not currently paying — including LAPSED
-- subscribers (plan='max' with plan_until in the past). Those are genuinely
-- "free" to the app right now, which is the test the owner's rule uses, and
-- the one-year grant included lapsed people for the same reason.
--
-- ── INTERACTION WITH THE ONE-YEAR GRANT (2026-10-04) ─────────────────────
-- supabase-grant-max-one-year-migration.sql set plan='max' with plan_until a
-- year out. IF that file was already run, those rows are "active paid" here and
-- this file skips every one of them — exactly as the owner asked ("คนที่ได้อยู่
-- แล้วไม่ต้องไปทำอะไร"). IF it was NOT run, STEP 0 below shows the difference
-- in the "kept_active_paid" column before anything is written. Read STEP 0
-- first either way: this file grants to every eligible row, not to a list, so
-- if the numbers are not what the owner expects, STOP and reconcile.
--
-- ── RE-RUNNABLE ───────────────────────────────────────────────────────────
-- After the first run, every granted row reads plan='premium' with a FUTURE
-- plan_until, so it matches the "active paid" exclusion and a second run
-- changes nothing. It cannot stack a second 7 days, and it cannot shorten a
-- real subscription.
--
-- ── RUN IT ───────────────────────────────────────────────────────────────
-- Supabase SQL Editor, project gsaqgbracxnucdmtmcxz, AFTER human review.
-- Run STEP 0 first and read the numbers. If the total does not match what was
-- expected, STOP and reconcile before running STEP 1.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── STEP 0 (read-only): see who this will touch, and how many ─────────────
-- Run this FIRST. Everything after it changes data.
select
  count(*)                                                     as total_profiles,
  count(*) filter (where coalesce(is_admin, false)
                      or coalesce(admin_tier, 0) > 0)          as admins_skipped,
  count(*) filter (where coalesce(banned, false))              as banned_skipped,
  count(*) filter (
    where plan is not null and plan <> 'free'
      and plan_until is not null and plan_until > now()
  )                                                            as kept_active_paid,
  count(*) filter (
    where created_at is not null
      and created_at > now() - interval '7 days'
  )                                                            as kept_in_trial,
  count(*) filter (
    where not coalesce(is_admin, false)
      and coalesce(admin_tier, 0) <= 0
      and not coalesce(banned, false)
      and not (plan is not null and plan <> 'free'
               and plan_until is not null and plan_until > now())
      and not (created_at is not null
               and created_at > now() - interval '7 days')
  )                                                            as will_be_granted
from public.profiles;

-- Breakdown of what those eligible rows currently are.
select plan, count(*)
from public.profiles
where not coalesce(is_admin, false)
  and coalesce(admin_tier, 0) <= 0
  and not coalesce(banned, false)
  and not (plan is not null and plan <> 'free'
           and plan_until is not null and plan_until > now())
  and not (created_at is not null
           and created_at > now() - interval '7 days')
group by plan
order by 2 desc;

-- Lapsed subscribers are inside the grant set and worth seeing on their own:
-- they paid once, their plan_until is in the past, and this gives them a week
-- back. expect: the same number the one-year migration called "lapsed".
select count(*) as lapsed_in_grant_set
from public.profiles
where plan is not null and plan <> 'free'
  and (plan_until is null or plan_until <= now());


-- ── STEP 1 (write): the grant ─────────────────────────────────────────────
-- 7 days is measured from the moment this statement runs, i.e. from the
-- approval date — not from each row's created_at. A member who signed up a
-- year ago gets a full week from today.
update public.profiles
set
  plan       = 'premium',
  plan_until = now() + interval '7 days'
where not coalesce(is_admin, false)
  and coalesce(admin_tier, 0) <= 0
  and not coalesce(banned, false)
  and not (plan is not null and plan <> 'free'
           and plan_until is not null and plan_until > now())
  and not (created_at is not null
           and created_at > now() - interval '7 days');


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after running STEP 1 — run each of these and read the answer.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. How many now hold Pro, and for how long. Every granted row must land on
--    plan='premium' with a plan_until about a week out; avg_days_left should
--    read ~7 (6.99–7.01 is normal, the spread is the seconds between rows).
select
  count(*)                                                     as premium_members,
  count(*) filter (where plan_until > now())                   as still_active,
  round(avg(extract(epoch from (plan_until - now())) / 86400), 2) as avg_days_left,
  min(plan_until)                                              as earliest_expiry,
  max(plan_until)                                              as latest_expiry
from public.profiles
where plan = 'premium';

-- 2. Nobody was left half-applied (Pro with an already-expired date).
--    expect: 0
select count(*) as premium_but_expired
from public.profiles
where plan = 'premium' and (plan_until is null or plan_until <= now());

-- 3. Admins were never rewritten. effectivePlan() gives admins premium anyway,
--    but the row itself must not have been touched.
--    expect: 0
select count(*) as admins_rewritten
from public.profiles
where (coalesce(is_admin, false) or coalesce(admin_tier, 0) > 0)
  and plan = 'premium'
  and plan_until > now()
  and plan_until <= now() + interval '7 days';

-- 4. Trial members kept plan='free' — this grant must not cancel their trial
--    countdown. Count rows inside the trial window that are NOT free.
--    expect: 0
select count(*) as trial_members_rewritten
from public.profiles
where created_at > now() - interval '7 days'
  and not coalesce(is_admin, false)
  and not coalesce(banned, false)
  and plan <> 'free';

-- 5. Re-runnability proof: re-running STEP 1 must report "UPDATE 0", because
--    every granted row now has a future plan_until and is excluded as already
--    holding Pro.
-- ═══════════════════════════════════════════════════════════════════════════
