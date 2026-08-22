-- Founding-member trial: the first 100 signups (by created_at, all-time —
-- including whoever has already signed up before this migration runs) get a
-- 90-day free trial instead of the standard 7 days. Run in Supabase SQL
-- Editor (project gsaqgbracxnucdmtmcxz) AFTER human review. Safe to re-run:
-- the column add is if-not-exists, the trigger replace is idempotent, and
-- the backfill UPDATE only ever (re-)marks the true first 100 by created_at
-- order — running it twice doesn't change the outcome.
--
-- Design note: deliberately a plain boolean set ONCE at signup (inside the
-- existing handle_new_user() trigger, in the same transaction as the
-- auth.users insert), not something computed on every read. That keeps
-- effectivePlan()/trialDaysLeft() in payment.tsx exactly as fast and
-- synchronous as they already are — no new network round-trip, they just
-- read profiles.founding_member as a plain field like every other column
-- profile already carries. The trigger counts EXISTING founding_member=true
-- rows (not a raw row count) specifically so this stays correct even if a
-- future non-founding-member row is ever created some other way — the cap
-- is "100 founding members have been granted," not "100 profiles exist".
--
-- Deliberately additive to profiles (one new column, one trigger replace) —
-- does not touch any other table.

alter table public.profiles add column if not exists founding_member boolean not null default false;

-- Backfill: whoever's ALREADY among the first 100 by signup order becomes a
-- founding member retroactively — including anyone whose original 7-day
-- trial has already lapsed, which extends (not restarts) their trial up to
-- 90 days from their real original created_at. This is the intended
-- behavior for "the first 100 users get 3 months", not a bug: a promo like
-- this is meant to reward the earliest signups, lapsed trial or not.
update public.profiles set founding_member = true
where id in (select id from public.profiles order by created_at asc limit 100);

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
    (select count(*) filter (where founding_member) from public.profiles) < 100
  )
  on conflict (id) do nothing;
  return new;
end; $function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying:
-- select count(*) filter (where founding_member) as founding_members,
--        count(*) as total_profiles
--   from public.profiles;
-- -- founding_members should be min(100, total_profiles) right after this runs.
--
-- select id, email, created_at, founding_member from public.profiles
--   order by created_at asc limit 5;
-- -- confirms the earliest signups are correctly marked true.
