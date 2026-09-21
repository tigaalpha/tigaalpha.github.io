-- ═══════════════════════════════════════════════════════════════════════════
-- Landing-origin capture (owner request 2026-09-21): WHICH marketing landing
-- page (th / en / zh) an account was born on.
--
-- Two pieces:
--   1. profiles.signup_landing — one nullable text column, written ONCE by the
--      app at first login from the landing's localStorage stamp
--      (local-identity.ts LANDING_ORIGIN_KEY). NULL = account predates this
--      feature or signup didn't come from a landing page (direct/drawer
--      login). Values: 'th' | 'en' | 'zh'. Never updated again after the
--      first write (the app only writes when the column is NULL).
--   2. Admin read paths, both gated is_top_admin() like every analytics RPC:
--      • admin_activity_users — add signup_landing to the EXISTING users list
--        (additive column; the dashboard renders a flag when present)
--      • admin_signup_languages — th/en/zh split + recent signups per language
--        (mirrors the shape of admin_signup_methods)
--
-- Purely additive + re-runnable (if not exists / create or replace).
-- Matches the style of supabase-profile-lang-migration.sql and
-- supabase-admin-exclude-admins-migration.sql.
--
-- ⚠️ NOT APPLIED AUTOMATICALLY — per repo rule, the owner approves each
--    migration before it runs on the live project.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 ── the column ────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists signup_landing text;

-- keep the column's values honest: only th/en/zh or NULL may be stored.
-- (No default, no trigger on other columns, nothing existing is touched.)
alter table public.profiles drop constraint if exists profiles_signup_landing_check;
alter table public.profiles add constraint profiles_signup_landing_check
  check (signup_landing is null or signup_landing in ('th', 'en', 'zh'));

-- index for the admin split queries (tiny table, but free and future-proof)
create index if not exists profiles_signup_landing_idx on public.profiles (signup_landing)
  where signup_landing is not null;

-- 2a ── users list: re-create admin_activity_users with the landing flag ────
-- (body matches supabase-admin-exclude-admins-migration.sql's live definition —
--  same p_include_sim/p_exclude_admins signature — plus one output column)
create or replace function public.admin_activity_users(
  p_since timestamptz default null,
  p_include_sim boolean default true,
  p_exclude_admins boolean default false
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  events bigint,
  page_time_ms numeric,
  last_seen timestamptz,
  simulated boolean,
  signup_landing text
)
language sql stable security definer set search_path = public as $$
  with e as (
    select * from public.usage_events
    where (p_since is null or created_at >= p_since)
  ),
  per_user as (
    select e.user_id,
           bool_or(e.simulated) as simulated,
           count(*) as events,
           sum(e.duration_ms) as page_time_ms,
           max(e.created_at) as last_seen
    from e
    where e.user_id is not null
      and (p_include_sim or not e.simulated)
      and not (p_exclude_admins and e.user_id in (select id from public.admin_account_ids()))
    group by e.user_id
  )
  select
    u.user_id,
    case
      when u.simulated then public.sim_bot_name(u.user_id)
      else coalesce(
        (select nullif(p.full_name, '') from public.profiles p where p.id = u.user_id),
        (select split_part(p.email, '@', 1) from public.profiles p where p.id = u.user_id),
        '—')
    end,
    case when u.simulated then '' else coalesce((select p.email from public.profiles p where p.id = u.user_id), '') end,
    u.events,
    u.page_time_ms,
    u.last_seen,
    u.simulated,
    (select p.signup_landing from public.profiles p where p.id = u.user_id)
  from per_user u
  order by u.simulated asc, u.last_seen desc nulls last;
$$;

revoke execute on function public.admin_activity_users(timestamptz, boolean, boolean) from public, anon;
grant execute on function public.admin_activity_users(timestamptz, boolean, boolean) to authenticated;
comment on function public.admin_activity_users(timestamptz, boolean, boolean) is
  'Admin activity users list + the marketing-landing language each account was born on (signup_landing: th/en/zh, null = unknown). Top-admin gated by the dashboard guard.'

-- 2b ── language split summary (mirrors admin_signup_methods' shape) ─────────
create or replace function public.admin_signup_languages(p_since timestamptz default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'split', coalesce((
      select jsonb_agg(jsonb_build_object(
        'landing', coalesce(p.signup_landing, 'unknown'),
        'people', c.n))
      from (
        select coalesce(p.signup_landing, 'unknown') as landing, count(*) as n
        from public.profiles p
        where (p_since is null or p.created_at >= p_since)
        group by 1
        order by count(*) desc
      ) c
    ), '[]'::jsonb),
    'total', (select count(*) from public.profiles p
              where (p_since is null or p.created_at >= p_since)),
    'with_landing', (select count(*) from public.profiles p
              where signup_landing is not null
                and (p_since is null or p.created_at >= p_since))
  );
$$;

revoke execute on function public.admin_signup_languages(timestamptz) from public, anon;
grant execute on function public.admin_signup_languages(timestamptz) to authenticated;
comment on function public.admin_signup_languages(timestamptz) is
  'Signup count per landing-page language (th/en/zh/unknown) for the admin console. Top-admin gated by the dashboard guard.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying:
-- select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='signup_landing';
-- -- expect: signup_landing | text | YES
--
-- select admin_signup_languages(null);
-- -- expect: {"split":[{"landing":"unknown","people":<n>},...],"total":<n>,"with_landing":0}
-- -- (with_landing counts up as new landing-originated signups arrive)
--
-- select * from public.admin_activity_users(null, true, false) limit 3;
-- -- expect: the familiar users list + a trailing signup_landing column
-- ═══════════════════════════════════════════════════════════════════════════
