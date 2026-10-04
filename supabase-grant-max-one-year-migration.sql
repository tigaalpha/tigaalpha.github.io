-- ═══════════════════════════════════════════════════════════════════════════
-- Grant Max for one year to every existing signed-in member.
--
-- Owner decision 2026-10-04: the free trial is now 7 days at FULL Max level
-- (payment.tsx TRIAL_DAYS_STANDARD/FOUNDING = 7, isMaxPlan("trial") = true), and
-- every member who had already signed up should be given the Max plan for one
-- year, counted from the date this migration is approved and run.
--
-- WHY A MIGRATION IS NEEDED AT ALL — the trial alone would not do this.
-- The trial length is not stored anywhere: effectivePlan() measures
-- (now - profiles.created_at) < TRIAL_DAYS * 1 day on every read. Every
-- existing member signed up more than 7 days ago, so under the new rule they
-- all resolve to "free" the moment this file lands, with nothing left to give
-- them Max. These rows therefore need a real, stored entitlement — a plan plus
-- a plan_until date — which is what this UPDATE writes.
--
-- The 7-day trial still governs everyone who signs up from now on: nothing
-- here touches new signups, and profiles.founding_member is left alone (it no
-- longer changes anything, since both trial lengths are now the same 7, but
-- the column is not ours to clean up here).
--
-- ── WHAT IT TOUCHES ──────────────────────────────────────────────────────
-- Only public.profiles.plan and public.profiles.plan_until. No new columns,
-- no table creation, no trigger replacement, no change to handle_new_user() —
-- so it cannot affect signup behaviour.
--
-- ── WHO IS SKIPPED, AND WHY (each is a deliberate non-change) ─────────────
--   admins  — effectivePlan() already maps an admin to "maxfamily", which is
--             strictly ABOVE Max. Writing plan='max' here would DOWNGRADE
--             them, so they are excluded outright.
--   banned  — a suspended account gains nothing from a free year, and
--             granting it would be the wrong direction to err in.
--   already-active Max / MaxFamily — anyone whose plan_until is still in the
--             future is left exactly as they are. Owner decision 2026-10-04:
--             "คนที่อยู่แพ็กเกจ Max อยู่แล้ว ก็ให้เขาใช้แพ็กเกจ Max ไปได้หนึ่งปี
--             เหมือนเดิม / คนที่ได้ฟรีหนึ่งปีไปก็ให้เขาใช้ฟรีหนึ่งปีเหมือนเดิม" — the
--             people who already hold the free year KEEP it. Re-granting
--             would silently roll their expiry forward another 365 days and
--             cost nothing to the owner while quietly over-promising.
--
-- ── MEASURED AGAINST THE LIVE DATABASE (2026-10-04, project
--    gsaqgbracxnucdmtmcxz) ────────────────────────────────────────────────
-- The counts below were read from public.profiles, not estimated. Total 70.
--
--   granted  56 rows = 55 on plan='free' + 1 on plan='max' with an
--                    ALREADY-EXPIRED plan_until (that one is a lapsed Max,
--                    and the owner asked for lapsed people to be put back
--                    on Max too).
--   kept     11 rows = 10 already-active Max (267-337 days left) + 1
--                    already-active MaxFamily (~27 years left).
--   skipped   3 rows = admins. effectivePlan() renders them MaxFamily, i.e.
--                    above Max, so nothing is owed to them.
--
-- Note the 55 free rows are NOT all "free" to the app: 11 of them signed up
-- within the last 7 days and are inside their Max trial RIGHT NOW, because
-- the trial is computed from created_at on every read and never written to
-- the column. See supabase-admin-list-students-trial-columns-migration.sql —
-- without it the admin console keeps showing those eleven as FREE.
--
-- ── RE-RUNNABLE ───────────────────────────────────────────────────────────
-- The WHERE clause only matches rows that are free, unset, or lapsed. After
-- the first run those rows read plan='max' with a FUTURE plan_until, so a
-- second run matches none of them and changes nothing. It does not stack a
-- second year, and it cannot shorten a real subscription.
--
-- ── RUN IT ────────────────────────────────────────────────────────────────
-- Supabase SQL Editor, project gsaqgbracxnucdmtmcxz, AFTER human review.
-- Run STEP 0 first and read the numbers: the owner expects ~70 members. If
-- the total does not match what was expected, STOP and reconcile before
-- running STEP 1 — this file grants to every eligible row, not to a list.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── STEP 0 (read-only): see who this will touch, and how many ─────────────
-- Run this FIRST. Everything after it changes data.
select
  count(*)                                                        as total_profiles,
  count(*) filter (where coalesce(is_admin, false))               as admins_skipped,
  count(*) filter (where coalesce(banned, false))                 as banned_skipped,
  count(*) filter (
    where not coalesce(is_admin, false)
      and not coalesce(banned, false)
      and not (plan is not null and plan <> 'free'
               and plan_until is not null and plan_until > now())
  )                                                               as will_be_granted_max
from public.profiles;

-- Breakdown of what those eligible rows currently are:
select plan, count(*)
from public.profiles
where not coalesce(is_admin, false)
  and not coalesce(banned, false)
  and not (plan is not null and plan <> 'free'
           and plan_until is not null and plan_until > now())
group by plan
order by 2 desc;


-- ── STEP 1 (write): the grant ─────────────────────────────────────────────
-- One year is measured from the moment this statement runs, i.e. from the
-- approval date — not from each row's own created_at. A member who signed up
-- a year and a half ago still gets a full year from today; that is what "1
-- ปี นับจากวันที่อนุมัติ" means, and it is the difference between a genuine
-- gift and a re-label of the trial they already used.
update public.profiles
set
  plan       = 'max',
  plan_until = now() + interval '1 year'
where not coalesce(is_admin, false)
  and not coalesce(banned, false)
  and not (plan is not null and plan <> 'free'
           and plan_until is not null and plan_until > now());


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after running STEP 1 — run each of these and read the answer.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. How many now hold Max, and for how long. Every granted row must land on
--    plan='max' with a plan_until about a year out; the window column should
--    read ~365 days (364–366 is normal, leap years included).
select
  count(*)                                                     as max_members,
  count(*) filter (where plan_until > now())                   as still_active,
  round(avg(extract(epoch from (plan_until - now())) / 86400)) as avg_days_left,
  min(plan_until)                                              as earliest_expiry,
  max(plan_until)                                              as latest_expiry
from public.profiles
where plan = 'max';

-- 2. Nobody was left half-applied (Max with an already-expired date).
--    expect: 0
select count(*) as max_but_expired
from public.profiles
where plan = 'max' and (plan_until is null or plan_until <= now());

-- 3. Admins kept their higher tier. effectivePlan() gives admins maxfamily
--    regardless of this column, but the row itself must not say 'max'.
--    expect: 0 admins on plan='max'
select count(*) as admins_downgraded
from public.profiles
where coalesce(is_admin, false) and plan = 'max';

-- 4. Re-runnability proof: re-running STEP 1 must return "UPDATE 0", because
--    every granted row now has a future plan_until.
-- ═══════════════════════════════════════════════════════════════════════════
