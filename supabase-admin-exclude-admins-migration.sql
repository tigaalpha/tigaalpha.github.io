-- ─────────────────────────────────────────────────────────────────────────────
-- Admin analytics: exclude the owner's own (tier-3 admin) account on demand
--
-- Owner request (2026-09-18): the three admin analytics panels — สถิติ,
-- กิจกรรมผู้ใช้, ผู้เข้าชม — should be able to EXCLUDE the owner's own admin
-- account from every number. The owner uses the app daily for development and
-- testing, which inflates "real customer" figures they read for business
-- decisions. The data must reflect actual customers only.
--
-- Design:
--   • Every RPC these three panels call gains ONE new optional parameter,
--     p_exclude_admins boolean default TRUE. Default-on because the owner's
--     stated default is "customers only"; passing false restores raw numbers.
--     (Optional + defaulted = additive: the previous two-arg overloads keep
--     working untouched, so the app can deploy before or after this file.)
--   • "Admin account" = profiles.admin_tier >= 3 (the owner tier), resolved
--     through one helper, admin_account_ids(), so the rule lives in one place.
--   • Anonymous rows (user_id is null) are never excluded — signed-out
--     visitors are exactly the traffic the owner wants to see.
--   • admin_activity_user_detail (one person's trail) is untouched on purpose:
--     it answers "what did THIS account do", and being asked about a specific
--     account is not a population question.
--   • get_usage_stats (สถิติ page) has no in-repo definition to upgrade
--     safely, so the page switches to a NEW in-repo function,
--     admin_usage_stats, with the same row shape plus the exclusion flag.
--     The old function is left alone as the client's automatic fallback.
--   • admin_landing_funnel (marketing landing card) also has no in-repo body;
--     rewriting a live SECURITY DEFINER function from a UI-shape guess would
--     risk breaking the card, so it keeps its behavior and the checkbox does
--     not affect it. It measures /landing/ traffic specifically.
--
-- Additive + re-runnable (create or replace / if not exists style throughout).
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- Helper: the account ids that count as "the owner's own testing accounts".
-- Tier 3 = owner only (same threshold as is_top_admin()).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_account_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p where coalesce(p.admin_tier, 0) >= 3;
$$;

revoke execute on function public.admin_account_ids() from public, anon;
grant  execute on function public.admin_account_ids() to authenticated;

comment on function public.admin_account_ids() is
  'Profiles the owner asked to be able to exclude from the analytics panels: admin_tier >= 3 (the owner and any co-owner). Anonymous visitor rows are never affected.';


-- ═════════════════════════════════════════════════════════════════════════════
-- กิจกรรมผู้ใช้ (User Activity page) — overview / users / hourly
-- Bodies match supabase-admin-metrics-accuracy-migration.sql (the live
-- definitions) + the new flag. Filter shape everywhere:
--   (not p_exclude_admins or user_id is null
--        or user_id <> all (select id from public.admin_account_ids()))
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_activity_overview(
  p_since timestamptz default null,
  p_include_sim boolean default true,
  p_exclude_admins boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;

  select jsonb_build_object(
    'totals', coalesce((
      select jsonb_build_object(
        'users', count(distinct t.user_id),
        'events', count(*),
        'page_time_ms', coalesce(sum(public.clamp_dwell_ms(t.duration_ms)), 0),
        'score_events', count(*) filter (where t.kind = 'score'),
        'member_events', count(*) filter (where t.user_id is not null),
        'member_ms', coalesce(sum(public.clamp_dwell_ms(t.duration_ms)) filter (where t.user_id is not null), 0),
        'visitors', count(distinct t.anon_id) filter (where t.user_id is null),
        'visitor_events', count(*) filter (where t.user_id is null),
        'visitor_ms', coalesce(sum(public.clamp_dwell_ms(t.duration_ms)) filter (where t.user_id is null), 0))
      from public.usage_events t
      where (p_since is null or t.created_at >= p_since)
        and t.kind not in ('boot','land')
        and (p_include_sim or not t.simulated)
        and (not p_exclude_admins or t.user_id is null
             or t.user_id <> all (select id from public.admin_account_ids()))), '{}'::jsonb),
    'boot', coalesce((
      select jsonb_build_object(
        'n', count(*) filter (where public.is_real_boot_ms(duration_ms)),
        'dropped', count(*) filter (where not public.is_real_boot_ms(duration_ms)),
        'median_ms', coalesce(round(percentile_cont(0.5) within group (
                       order by duration_ms) filter (where public.is_real_boot_ms(duration_ms))), 0),
        'p90_ms', coalesce(round(percentile_cont(0.90) within group (
                       order by duration_ms) filter (where public.is_real_boot_ms(duration_ms))), 0),
        'over3s', count(*) filter (where public.is_real_boot_ms(duration_ms) and duration_ms >= 3000))
      from public.usage_events
      where kind = 'boot' and not simulated
        and (p_since is null or created_at >= p_since)
        and (not p_exclude_admins or user_id is null
             or user_id <> all (select id from public.admin_account_ids()))), '{}'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', t.item_id, 'hits', t.hits, 'total_ms', t.total_ms,
        'avg_ms', round(t.avg_ms), 'member_ms', t.member_ms, 'visitor_ms', t.visitor_ms))
      from (
        select item_id, count(*) as hits,
               sum(public.clamp_dwell_ms(duration_ms)) as total_ms,
               avg(public.clamp_dwell_ms(duration_ms)) as avg_ms,
               coalesce(sum(public.clamp_dwell_ms(duration_ms)) filter (where user_id is not null), 0) as member_ms,
               coalesce(sum(public.clamp_dwell_ms(duration_ms)) filter (where user_id is null), 0) as visitor_ms
        from public.usage_events
        where kind = 'page' and (p_since is null or created_at >= p_since)
          and (p_include_sim or not simulated)
          and (not p_exclude_admins or user_id is null
               or user_id <> all (select id from public.admin_account_ids()))
        group by item_id order by sum(public.clamp_dwell_ms(duration_ms)) desc nulls last limit 20
      ) t), '[]'::jsonb),
    'buttons', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (select item_id, count(*) as hits from public.usage_events
            where kind = 'nav' and (p_since is null or created_at >= p_since)
              and (p_include_sim or not simulated)
              and (not p_exclude_admins or user_id is null
                   or user_id <> all (select id from public.admin_account_ids()))
            group by item_id order by count(*) desc limit 25) t), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (select item_id, count(*) as hits from public.usage_events
            where kind = 'score' and (p_since is null or created_at >= p_since)
              and (p_include_sim or not simulated)
              and (not p_exclude_admins or user_id is null
                   or user_id <> all (select id from public.admin_account_ids()))
            group by item_id order by count(*) desc limit 15) t), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', r.kind, 'item_id', r.item_id, 'duration_ms', r.duration_ms,
        'created_at', r.created_at, 'simulated', r.simulated,
        'who', case when r.simulated then public.sim_bot_name(r.user_id)
               when r.user_id is null then '👤 ' || coalesce(left(r.anon_id, 6), '?')
               else coalesce((select nullif(p.full_name, '') from public.profiles p where p.id = r.user_id),
                    (select split_part(p.email, '@', 1) from public.profiles p where p.id = r.user_id), '—') end))
      from (select user_id, anon_id, kind, item_id,
                   public.clamp_dwell_ms(duration_ms) as duration_ms, created_at, simulated
            from public.usage_events
            where (p_since is null or created_at >= p_since)
              and kind <> 'land'
              and (p_include_sim or not simulated)
              and (not p_exclude_admins or user_id is null
                   or user_id <> all (select id from public.admin_account_ids()))
            order by created_at desc limit 40) r), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke execute on function public.admin_activity_overview(timestamptz, boolean, boolean) from public, anon;
grant  execute on function public.admin_activity_overview(timestamptz, boolean, boolean) to authenticated;


create or replace function public.admin_activity_users(
  p_since timestamptz default null,
  p_include_sim boolean default true,
  p_exclude_admins boolean default true
)
returns table(user_id uuid, display_name text, email text, events bigint,
              page_time_ms numeric, last_seen timestamptz, simulated boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  return query
  with e as (
    select * from public.usage_events
    where usage_events.user_id is not null
      and usage_events.kind not in ('boot','land')
      and (p_since is null or created_at >= p_since)
      and (not p_exclude_admins
           or usage_events.user_id <> all (select id from public.admin_account_ids()))
  ),
  per_user as (
    select e.user_id as uid, bool_or(e.simulated) as sim, count(*) as ev,
           sum(public.clamp_dwell_ms(e.duration_ms)) as ms, max(e.created_at) as seen
    from e group by e.user_id
  )
  select u.uid,
    case when u.sim then public.sim_bot_name(u.uid)
         else coalesce((select nullif(p.full_name, '') from public.profiles p where p.id = u.uid),
              (select split_part(p.email, '@', 1) from public.profiles p where p.id = u.uid), '—') end,
    case when u.sim then '' else coalesce((select p.email from public.profiles p where p.id = u.uid), '') end,
    u.ev, u.ms, u.seen, u.sim
  from per_user u
  where p_include_sim or not u.sim
  order by u.sim asc, u.seen desc nulls last;
end;
$$;

revoke execute on function public.admin_activity_users(timestamptz, boolean, boolean) from public, anon;
grant  execute on function public.admin_activity_users(timestamptz, boolean, boolean) to authenticated;


create or replace function public.admin_activity_hourly(
  p_since timestamptz default null,
  p_include_sim boolean default true,
  p_exclude_admins boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;

  return jsonb_build_object(
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'h', s.h,
               'events',  coalesce(c.events, 0),
               'users',   coalesce(c.users, 0),
               'time_ms', coalesce(c.time_ms, 0)
             ) order by s.h)
      from generate_series(0, 23) as s(h)
      left join (
        select
          extract(hour from (created_at at time zone 'Asia/Bangkok'))::int as h,
          count(*)::bigint as events,
          count(distinct coalesce(user_id::text, anon_id))::bigint as users,
          coalesce(sum(public.clamp_dwell_ms(duration_ms)), 0)::bigint as time_ms
        from public.usage_events
        where (p_since is null or created_at >= p_since)
          and kind not in ('boot','land')
          and (p_include_sim or not simulated)
          and (not p_exclude_admins or user_id is null
               or user_id <> all (select id from public.admin_account_ids()))
        group by 1
      ) c on c.h = s.h
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_activity_hourly(timestamptz, boolean, boolean) from anon;
grant  execute on function public.admin_activity_hourly(timestamptz, boolean, boolean) to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- ผู้เข้าชม (Visitors page) — anon overview + per-visitor list.
-- Exclusion happens at the base CTE: any row belonging to a tier-3 admin
-- disappears before grouping, so an anon_id the owner created while signed in
-- no longer counts as a "converted" visitor either.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_anon_overview(
  p_since timestamptz default null,
  p_gate_ms integer default 5000,
  p_exclude_admins boolean default true
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
  per2 as (
    select p.*,
           (p.uid is not null and u.created_at >= p.first_seen) as is_new_signup,
           (p.uid is not null and u.created_at <  p.first_seen) as is_returning,
           (select i.provider from auth.identities i where i.user_id = p.uid order by i.created_at asc limit 1) as provider
    from per p left join auth.users u on u.id = p.uid
  ),
  anononly as (select * from per2 where not converted),
  boots as (select duration_ms, coalesce(nullif(item_id, ''), '?') as net from e where kind = 'boot')
  select jsonb_build_object(
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

revoke execute on function public.admin_anon_overview(timestamptz, integer, boolean) from public, anon;
grant  execute on function public.admin_anon_overview(timestamptz, integer, boolean) to authenticated;


create or replace function public.admin_anon_visitors(
  p_since timestamptz default null,
  p_limit integer default 200,
  p_exclude_admins boolean default true
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

revoke execute on function public.admin_anon_visitors(timestamptz, integer, boolean) from public, anon;
grant  execute on function public.admin_anon_visitors(timestamptz, integer, boolean) to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- สมัครสมาชิก (sign-up method split, shown on both pages): drop the owner's
-- account from the google/email/total counts so "สมัครใหม่" means customers.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_signup_methods(
  p_since timestamptz default null,
  p_exclude_admins boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  select jsonb_build_object(
    'google',     count(*) filter (where f.provider = 'google'),
    'email',      count(*) filter (where f.provider = 'email'),
    'other',      count(*) filter (where f.provider is null or f.provider not in ('google','email')),
    'total',      count(*),
    'google_new', count(*) filter (where f.provider = 'google' and (p_since is null or f.created_at >= p_since)),
    'email_new',  count(*) filter (where f.provider = 'email'  and (p_since is null or f.created_at >= p_since)),
    'other_new',  count(*) filter (where (f.provider is null or f.provider not in ('google','email'))
                                        and (p_since is null or f.created_at >= p_since)),
    'total_new',  count(*) filter (where p_since is null or f.created_at >= p_since),
    'latest_google', max(f.created_at) filter (where f.provider = 'google'),
    'latest_email',  max(f.created_at) filter (where f.provider = 'email')
  ) into v
  from (
    select u.id, u.created_at,
           (select i.provider from auth.identities i
             where i.user_id = u.id order by i.created_at asc limit 1) as provider
    from auth.users u
    where (not p_exclude_admins or not exists (
            select 1 from public.profiles p
            where p.id = u.id and coalesce(p.admin_tier, 0) >= 3))
  ) f;
  return v;
end;
$$;

revoke execute on function public.admin_signup_methods(timestamptz, boolean) from public, anon;
grant  execute on function public.admin_signup_methods(timestamptz, boolean) to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- อุปกรณ์ (device mix + width histogram on กิจกรรมผู้ใช้): same flag. These two
-- were gated to is_top_admin() when created — the guard stays as-is.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_device_mix(
  p_since timestamptz default null,
  p_exclude_admins boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;
  return jsonb_build_object(
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dev',      t.dev,
        'people',   t.people,
        'signed_in', t.signed_in,
        'signed_out', t.signed_out,
        'events',   t.events,
        'page_ms',  t.page_ms,
        'med_ms',   t.med_ms))
      from (
        select coalesce(e.dev, '?') as dev,
               count(distinct e.anon_id) as people,
               count(*) filter (where e.user_id is not null) as signed_in,
               count(*) filter (where e.user_id is null) as signed_out,
               count(*) as events,
               coalesce(sum(e.duration_ms), 0) as page_ms,
               coalesce(percentile_cont(0.5) within group (order by e.duration_ms)
                        filter (where e.duration_ms is not null), 0) as med_ms
        from public.usage_events e
        where (p_since is null or e.created_at >= p_since)
          and (not p_exclude_admins or e.user_id is null
               or e.user_id <> all (select id from public.admin_account_ids()))
        group by coalesce(e.dev, '?')
        order by count(distinct e.anon_id) desc
      ) t), '[]'::jsonb),
    'total_people', coalesce((select count(distinct anon_id) from public.usage_events
                              where (p_since is null or created_at >= p_since)
                                and (not p_exclude_admins or user_id is null
                                     or user_id <> all (select id from public.admin_account_ids()))), 0),
    'webviews_people', coalesce((select count(distinct anon_id) from public.usage_events
                                 where (p_since is null or created_at >= p_since)
                                   and ua like '%webview%'
                                   and (not p_exclude_admins or user_id is null
                                        or user_id <> all (select id from public.admin_account_ids()))), 0)
  );
end;
$$;

revoke execute on function public.admin_device_mix(timestamptz, boolean) from public, anon;
grant execute on function public.admin_device_mix(timestamptz, boolean) to authenticated;


create or replace function public.admin_device_widths(
  p_since timestamptz default null,
  p_exclude_admins boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'bucket',   t.bucket,
      'people',   t.people,
      'events',   t.events,
      'med_w',    t.med_w)), '[]'::jsonb)
  from (
    select case
             when e.dev_w is null then '?'
             when e.dev_w < 400 then '<400 (มือถือแนวตั้ง)'
             when e.dev_w < 600 then '400-599 (มือถือแนวนอน)'
             when e.dev_w < 900 then '600-899 (แท็บเล็ต)'
             else '900+ (เดสก์ท็อป)'
           end as bucket,
           count(distinct e.anon_id) as people,
           count(*) as events,
           coalesce(percentile_cont(0.5) within group (order by e.dev_w)
                    filter (where e.dev_w is not null), 0) as med_w
    from public.usage_events e
    where (p_since is null or e.created_at >= p_since)
      and (not p_exclude_admins or e.user_id is null
           or e.user_id <> all (select id from public.admin_account_ids()))
    group by 1
    order by min(coalesce(e.dev_w, 0))
  ) t);
end;
$$;

revoke execute on function public.admin_device_widths(timestamptz, boolean) from public, anon;
grant execute on function public.admin_device_widths(timestamptz, boolean) to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- สถิติ (Analytics page): NEW in-repo replacement for get_usage_stats.
--
-- get_usage_stats exists only in the live database (no definition was ever
-- committed), so it cannot be upgraded safely from here. The panel switches to
-- this function; until the panel's new build ships, the old function keeps
-- serving the old build untouched. Row shape is exactly what the panel reads:
--   { kind, item_id, hits, member_hits, visitor_hits }
-- (member = signed-in, visitor = signed-out — same split the old rows showed
-- in brackets). boot/land are excluded like every other feature-ranking list;
-- p_kind null = all kinds (the panel filters per-list client-side).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_usage_stats(
  p_kind text default null,
  p_since timestamptz default null,
  p_include_sim boolean default true,
  p_exclude_admins boolean default true,
  p_limit integer default 500
)
returns table(kind text, item_id text, hits bigint, member_hits bigint, visitor_hits bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  return query
  select t.kind, t.item_id,
         count(*)::bigint as hits,
         count(*) filter (where t.user_id is not null)::bigint as member_hits,
         count(*) filter (where t.user_id is null)::bigint as visitor_hits
  from public.usage_events t
  where (p_kind is null or t.kind = p_kind)
    and t.kind not in ('boot','land')
    and (p_include_sim or not t.simulated)
    and (p_since is null or t.created_at >= p_since)
    and (not p_exclude_admins or t.user_id is null
         or t.user_id <> all (select id from public.admin_account_ids()))
  group by t.kind, t.item_id
  order by count(*) desc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

revoke execute on function public.admin_usage_stats(text, timestamptz, boolean, boolean, integer) from public, anon;
grant  execute on function public.admin_usage_stats(text, timestamptz, boolean, boolean, integer) to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying (as the owner account, admin_tier >= 3):
-- 1. select public.admin_activity_overview(null, true, false);
--    vs select public.admin_activity_overview(null, true, true);
--    -> totals.events drops when true (the owner's own rows leave), and
--       'users' no longer includes the tier-3 account.
-- 2. select * from public.admin_usage_stats(null, null, true, true, 10);
--    -> ranked rows, no boot/land, owner's item hits gone.
-- 3. Old overloads still work (app deployed before this migration):
--    select public.admin_activity_overview(null, true); -> same as before.
-- 4. As a NON-admin account every function above must FAIL (admin only).
-- ═════════════════════════════════════════════════════════════════════════════
