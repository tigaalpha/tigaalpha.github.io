-- supabase-admin-anon-clean-visitors-migration.sql
--
-- NOT APPLIED. Written 2026-11-26 (Step 3.3). Run only with the owner's explicit approval for THIS file (AGENTS.md hard rule). Order: after supabase-admin-exclude-admins-migration.sql (it replaces the two
-- functions that file defines); independent of supabase-landing-funnel-v3.sql.
--
-- What it does, in one transaction:
--   1. public.is_bot_ua(ua text): true when the stored user-agent text looks like a program. SAME regex as campaign-funnel.ts BOT_UA_SRC and local-identity.ts BOT_UA_RE: change all three together.
--      usage_events.ua is the coarse browser KIND written by the client (uaKind()), and new rows say "bot" outright; older rows of a crawler that ran the page say "desktop" and stay in the old numbers.
--   2. admin_anon_overview / admin_anon_visitors get p_exclude_bots (default true) and p_exclude_bounce (default false; a bounce = one event and never signed in). The old 3-argument signatures are DROPPED
--      and replaced (two overloads with defaults would make PostgREST refuse a call by name); every old call still works because the new arguments have defaults. The overview also returns
--      excluded_bots, excluded_bounce and filters so the screen can say how many people were cut.
--   Nothing else is touched. To undo: re-run the two function definitions of supabase-admin-exclude-admins-migration.sql.

begin;

create or replace function public.is_bot_ua(ua text)
returns boolean
language sql immutable parallel safe as $$
  select lower(coalesce(ua, '')) ~ 'bot|crawl|spider|headless|preview|slurp|curl|wget|python|okhttp|monitor|uptime|facebookexternalhit|facebot|lighthouse|pingdom|gtmetrix|axios|node-fetch|go-http';
$$;
grant execute on function public.is_bot_ua(text) to authenticated;

drop function if exists public.admin_anon_overview(timestamptz, integer, boolean);
drop function if exists public.admin_anon_visitors(timestamptz, integer, boolean);

create or replace function public.admin_anon_overview(
  p_since timestamptz default null,
  p_gate_ms integer default 5000,
  p_exclude_admins boolean default true,
  p_exclude_bots boolean default true,
  p_exclude_bounce boolean default false
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb; g bigint := greatest(1000, coalesce(p_gate_ms, 15000));
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  with e as (
    select * from public.usage_events
    where simulated = false and anon_id is not null and kind <> 'land'
      and (p_since is null or created_at >= p_since)
      and (not p_exclude_admins or user_id is null
           or user_id <> all (select id from public.admin_account_ids()))
      and (not p_exclude_bots or not public.is_bot_ua(ua))
  ),
  per as (
    select anon_id,
           bool_or(user_id is not null) as converted,
           count(*) filter (where kind <> 'boot') as events,
           count(*) filter (where kind <> 'boot') as real_events,
           coalesce(sum(public.clamp_dwell_ms(duration_ms)) filter (where kind <> 'boot'), 0) as dwell,
           max(ua) as ua, max(src) as src, min(created_at) as first_seen,
           count(distinct item_id) filter (where kind = 'page') as pages_seen,
           bool_or(kind = 'gate') as gate_seen,
           (array_agg(user_id) filter (where user_id is not null))[1] as uid
    from e group by anon_id
  ),
  perk as (   -- the people who stay after the bounce switch (a member is never a bounce)
    select * from per where not (p_exclude_bounce and events <= 1 and not converted)
  ),
  per2 as (
    select p.*,
           (p.uid is not null and u.created_at >= p.first_seen) as is_new_signup,
           (p.uid is not null and u.created_at <  p.first_seen) as is_returning,
           (select i.provider from auth.identities i where i.user_id = p.uid order by i.created_at asc limit 1) as provider
    from perk p left join auth.users u on u.id = p.uid
  ),
  anononly as (select * from per2 where not converted),
  boots as (select duration_ms, coalesce(nullif(item_id, ''), '?') as net from e where kind = 'boot')
  select jsonb_build_object(
    'excluded_bots', (select count(distinct x.anon_id) from public.usage_events x
                       where x.simulated = false and x.anon_id is not null and x.kind <> 'land'
                         and (p_since is null or x.created_at >= p_since) and public.is_bot_ua(x.ua)),
    'excluded_bounce', (select count(*) from per where p_exclude_bounce and events <= 1 and not converted),
    'filters', jsonb_build_object('bots', p_exclude_bots, 'bounce', p_exclude_bounce),
    'visitors',  (select count(*) from per2),
    'anon_only', (select count(*) from anononly),
    'converted', (select count(*) from per2 where converted),
    'new_signups', (select count(*) from per2 where is_new_signup),
    'returning',   (select count(*) from per2 where is_returning),
    'events',    (select coalesce(sum(events), 0) from per2),
    'dwell_ms',  (select coalesce(sum(dwell), 0) from anononly),
    'avg_ms',    (select coalesce(round(avg(dwell)), 0) from anononly),
    'median_ms', (select coalesce(round(percentile_cont(0.5) within group (order by dwell)), 0) from anononly),
    'max_ms',    (select coalesce(max(dwell), 0) from anononly),
    'gate_ms',   g,
    'under30',   (select count(*) from anononly where dwell < g),
    'mid',       (select count(*) from anononly where dwell >= g and dwell < g * 3),
    'reached',   (select count(*) from anononly where dwell >= g),
    'well_past', (select count(*) from anononly where dwell >= g * 3),
    'bounced',   (select count(*) from per2 where real_events <= 1),
    'gate_shown',      (select count(*) from anononly where gate_seen),
    'never_navigated', (select count(*) from anononly where pages_seen <= 1),
    'navigated',       (select count(*) from anononly where pages_seen > 1),
    'boot', (select jsonb_build_object(
               'n',      count(*) filter (where public.is_real_boot_ms(duration_ms)),
               'dropped', count(*) filter (where not public.is_real_boot_ms(duration_ms)),
               'median_ms', coalesce(round(percentile_cont(0.5) within group (
                              order by duration_ms) filter (where public.is_real_boot_ms(duration_ms))), 0),
               'p75_ms',    coalesce(round(percentile_cont(0.75) within group (
                              order by duration_ms) filter (where public.is_real_boot_ms(duration_ms))), 0),
               'p90_ms',    coalesce(round(percentile_cont(0.90) within group (
                              order by duration_ms) filter (where public.is_real_boot_ms(duration_ms))), 0),
               'over3s',    count(*) filter (where public.is_real_boot_ms(duration_ms) and duration_ms >= 3000),
               'by_net', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                            select jsonb_build_object('net', net, 'n', count(*),
                              'median_ms', round(percentile_cont(0.5) within group (order by duration_ms))) as x
                            from boots where public.is_real_boot_ms(duration_ms)
                            group by net order by count(*) desc limit 6) t)
             ) from boots),
    'browsers',  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                    select jsonb_build_object('ua', coalesce(ua, '?'), 'n', count(*)) as x
                    from per2 group by ua order by count(*) desc limit 12) t),
    'sources',   (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                    select jsonb_build_object('src', coalesce(nullif(src, ''), 'direct'), 'n', count(*)) as x
                    from per2 group by src order by count(*) desc limit 12) t),
    'features',  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                    select jsonb_build_object('kind', kind, 'item', item_id,
                                              'n', count(*), 'people', count(distinct anon_id),
                                              'ms', coalesce(sum(public.clamp_dwell_ms(duration_ms)), 0)) as x
                    from e where user_id is null and kind <> 'boot'
                    group by kind, item_id order by count(distinct anon_id) desc, count(*) desc limit 25) t),
    'exits',     (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                    select jsonb_build_object('kind', l.kind, 'item', l.item_id, 'n', count(*)) as x
                    from (select distinct on (anon_id) anon_id, kind, item_id from e
                          where user_id is null and kind <> 'boot'
                          order by anon_id, created_at desc) l
                    group by l.kind, l.item_id order by count(*) desc limit 15) t),
    'signup_methods', (select jsonb_build_object(
        'google',  count(*) filter (where provider = 'google'),
        'email',   count(*) filter (where provider = 'email'),
        'other',   count(*) filter (where provider is not null and provider not in ('google','email')),
        'unknown', count(*) filter (where provider is null))
      from per2 where is_new_signup),
    'returning_methods', (select jsonb_build_object(
        'google',  count(*) filter (where provider = 'google'),
        'email',   count(*) filter (where provider = 'email'),
        'other',   count(*) filter (where provider is not null and provider not in ('google','email')),
        'unknown', count(*) filter (where provider is null))
      from per2 where is_returning)
  ) into v;
  return v;
end;
$$;

revoke execute on function public.admin_anon_overview(timestamptz, integer, boolean, boolean, boolean) from public, anon;
grant  execute on function public.admin_anon_overview(timestamptz, integer, boolean, boolean, boolean) to authenticated;


create or replace function public.admin_anon_visitors(
  p_since timestamptz default null,
  p_limit integer default 200,
  p_exclude_admins boolean default true,
  p_exclude_bots boolean default true,
  p_exclude_bounce boolean default false
)
returns table(anon_id text, events bigint, dwell_ms numeric, first_seen timestamptz,
              last_seen timestamptz, ua text, src text, converted boolean,
              last_item text, provider text, is_new_signup boolean, boot_ms bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  return query
  with e as (
    select ue.anon_id as aid, ue.user_id, ue.duration_ms, ue.created_at,
           ue.ua, ue.src, ue.kind, ue.item_id
    from public.usage_events ue
    where ue.simulated = false and ue.anon_id is not null and ue.kind <> 'land'
      and (p_since is null or ue.created_at >= p_since)
      and (not p_exclude_admins or ue.user_id is null
           or ue.user_id <> all (select id from public.admin_account_ids()))
      and (not p_exclude_bots or not public.is_bot_ua(ue.ua))
  ),
  p as (
    select ev.aid as aid,
           count(*) filter (where ev.kind <> 'boot') as n_events,
           coalesce(sum(public.clamp_dwell_ms(ev.duration_ms)) filter (where ev.kind <> 'boot'), 0) as n_dwell,
           max(ev.duration_ms) filter (where ev.kind = 'boot'
                                       and public.is_real_boot_ms(ev.duration_ms)) as n_boot,
           min(ev.created_at) as t_first,
           max(ev.created_at) as t_last,
           max(ev.ua) as s_ua, max(ev.src) as s_src,
           bool_or(ev.user_id is not null) as is_conv,
           (array_agg(ev.user_id) filter (where ev.user_id is not null))[1] as uid
    from e ev group by ev.aid
    having not (p_exclude_bounce and count(*) filter (where ev.kind <> 'boot') <= 1 and not bool_or(ev.user_id is not null))
  )
  select p.aid, p.n_events, p.n_dwell, p.t_first, p.t_last, p.s_ua, p.s_src, p.is_conv,
         (select x.kind || ' · ' || x.item_id from e x
           where x.aid = p.aid and x.kind <> 'boot' order by x.created_at desc limit 1),
         (select i.provider from auth.identities i where i.user_id = p.uid order by i.created_at asc limit 1),
         (p.uid is not null and u.created_at >= p.t_first),
         p.n_boot::bigint
  from p left join auth.users u on u.id = p.uid
  order by p.t_last desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

revoke execute on function public.admin_anon_visitors(timestamptz, integer, boolean, boolean, boolean) from public, anon;
grant  execute on function public.admin_anon_visitors(timestamptz, integer, boolean, boolean, boolean) to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- สมัครสมาชิก (sign-up method split, shown on both pages): drop the owner's
-- account from the google/email/total counts so "สมัครใหม่" means customers.

commit;
