-- ─────────────────────────────────────────────────────────────────────────────
-- Admin metrics accuracy migration  (additive + re-runnable)
--
-- Audit of every number on the two admin panels the owner asked about:
--   • User Activity  (AdminActivity)
--   • Visitors who never logged in  (AnonVisitorsPanel)
--
-- Seven defects found, all fixed here. Each is documented at its fix site.
-- No table or column changes; only function bodies.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 1 — dwell time counted wall-clock while the app was not on screen.
--
-- App.tsx measures a page view as (leave time − enter time) and flushes it when
-- the tab hides. Nothing pauses that clock, so a tab left open records the time
-- the phone was in someone's pocket as time spent learning. The evidence, from
-- the live table:
--
--   kind=page  n=903   median 3.9s   p90 64s   MAX 280 MINUTES
--   kind=boot  n=393   median 680ms  p90 2.3s  MAX 225 MINUTES
--
-- Every one of the extreme rows is a signed-out tab parked on `pathway`, and
-- the worst `boot` rows are timestamped within 3 seconds of a matching 4-hour
-- `page` row — the same abandoned tab, counted twice.
--
-- Effect on what the owner reads: the "เล่นเฉลี่ยคนละ" tile said 2 min 24 s
-- while the median visitor stayed 1.1 seconds. Six rows out of 903 were
-- carrying the tile.
--
-- The clamp below is the floor under that. 30 minutes per single page view is
-- the session-timeout ceiling every analytics product uses, and it sits inside
-- the natural gap in this data (the real tail runs …5.6, 15.9, 17.3, 18.7,
-- 26 min, then jumps to 65, 82, 175, 247, 263, 280).
--
-- NULL is preserved rather than folded to 0 so avg() denominators are unchanged.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.clamp_dwell_ms(p bigint)
returns bigint language sql immutable parallel safe as $$
  select case when p is null then null
              else least(greatest(p, 0), 1800000)   -- 30 minutes
         end;
$$;

comment on function public.clamp_dwell_ms(bigint) is
  'Ceiling for one page view (30 min). The client clock does not stop when the tab is hidden, so an abandoned tab reports wall-clock; this bounds it.';


-- Boot samples are DROPPED rather than clamped: a capped 60s still asserts
-- "someone watched a loading screen for a minute", which pollutes the median,
-- the p90 and the over-3s rate the load card is built on. The threshold sits in
-- this data's own gap — plausible boots top out at 36.5s, the next value up is
-- 241.6s — and discards exactly the 5 background-tab samples out of 393.
create or replace function public.is_real_boot_ms(p bigint)
returns boolean language sql immutable parallel safe as $$
  select p is not null and p >= 0 and p < 60000;
$$;

comment on function public.is_real_boot_ms(bigint) is
  'A boot sample is a real load time only under 60s. Above that the tab was opened in the background and performance.now() measured the wait, not the load.';


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 2 — admin_activity_overview and admin_activity_user_detail are
-- SECURITY DEFINER, granted to `authenticated`, and have NO admin guard.
--
-- Verified by impersonating a non-admin signed-in account (admin_tier 1,
-- is_admin false): it read all 40 rows of the live activity feed including real
-- member display names, the member/visitor totals, and — by passing the owner's
-- uuid to admin_activity_user_detail — 60 rows of the owner's own page history.
--
-- Every sibling RPC on both panels already raises 'admin only'. These two were
-- written in `language sql`, which cannot raise, and the guard was never added.
-- Both are rewritten in plpgsql below with the same guard as their siblings.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_activity_overview(
  p_since timestamptz default null,
  p_include_sim boolean default true
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
        -- NOTE: this counts anon_ids seen on a signed-OUT row, so somebody who
        -- browsed as a guest and then signed up is counted here AND as a member.
        -- That is the question this tile asks ("how much traffic arrives signed
        -- out"). The visitor panel's "ยังไม่ล็อกอิน" asks a different one
        -- ("who never made an account") and is legitimately a smaller number.
        'visitors', count(distinct t.anon_id) filter (where t.user_id is null),
        'visitor_events', count(*) filter (where t.user_id is null),
        'visitor_ms', coalesce(sum(public.clamp_dwell_ms(t.duration_ms)) filter (where t.user_id is null), 0))
      from public.usage_events t
      where (p_since is null or t.created_at >= p_since)
        and t.kind not in ('boot','land')
        and (p_include_sim or not t.simulated)), '{}'::jsonb),
    -- load time, kept apart from everything above because it is not time spent
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
        and (p_since is null or created_at >= p_since)), '{}'::jsonb),
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
        group by item_id order by sum(public.clamp_dwell_ms(duration_ms)) desc nulls last limit 20
      ) t), '[]'::jsonb),
    'buttons', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (select item_id, count(*) as hits from public.usage_events
            where kind = 'nav' and (p_since is null or created_at >= p_since)
              and (p_include_sim or not simulated)
            group by item_id order by count(*) desc limit 25) t), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (select item_id, count(*) as hits from public.usage_events
            where kind = 'score' and (p_since is null or created_at >= p_since)
              and (p_include_sim or not simulated)
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
              and kind <> 'land'                       -- landing page has its own panel
              and (p_include_sim or not simulated)
            order by created_at desc limit 40) r), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 3 — admin_activity_user_detail: no admin guard (see DEFECT 2), and its
-- `recent` feed showed `boot` and `land` rows that every aggregate on the same
-- page excludes, so a member's timeline listed more events than their own row
-- claimed they had.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_activity_user_detail(
  p_user uuid,
  p_since timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;

  select jsonb_build_object(
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', t.item_id, 'hits', t.hits,
        'total_ms', t.total_ms, 'avg_ms', round(t.avg_ms)))
      from (
        select item_id, count(*) as hits,
               sum(public.clamp_dwell_ms(duration_ms)) as total_ms,
               avg(public.clamp_dwell_ms(duration_ms)) as avg_ms
        from public.usage_events
        where user_id = p_user and kind = 'page' and (p_since is null or created_at >= p_since)
        group by item_id
        order by sum(public.clamp_dwell_ms(duration_ms)) desc nulls last
        limit 25
      ) t), '[]'::jsonb),
    'buttons', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (
        select item_id, count(*) as hits
        from public.usage_events
        where user_id = p_user and kind = 'nav' and (p_since is null or created_at >= p_since)
        group by item_id order by count(*) desc limit 30
      ) t), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (
        select item_id, count(*) as hits
        from public.usage_events
        where user_id = p_user and kind = 'score' and (p_since is null or created_at >= p_since)
        group by item_id order by count(*) desc limit 20
      ) t), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', r.kind, 'item_id', r.item_id,
        'duration_ms', r.duration_ms, 'created_at', r.created_at))
      from (
        select kind, item_id, public.clamp_dwell_ms(duration_ms) as duration_ms, created_at
        from public.usage_events
        where user_id = p_user and (p_since is null or created_at >= p_since)
          and kind not in ('boot','land')   -- match every aggregate on this page
        order by created_at desc limit 60
      ) r), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 4 — admin_activity_users.page_time_ms carried the same uncapped dwell.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_activity_users(
  p_since timestamptz default null,
  p_include_sim boolean default true
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


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 5 — admin_anon_overview: uncapped dwell (DEFECT 1) fed the four tiles
-- this panel is mostly read for, plus the whole "เล่นนานแค่ไหนก่อนจะออก"
-- distribution and the load-time card.
--
-- Measured on the live table, all-time, signed-out visitors only:
--       average each   2 min 24 s  →  38 s
--       total time     21 h  2 m   →  5 h 30 m
--       longest        280 min     →  30 min
--       median         1.1 s       →  1.1 s   (unchanged — medians resist this)
--
-- The gate buckets (under/mid/well-past 10s) are unchanged at 36 people: no
-- capped visitor was anywhere near the 10-second boundary.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_anon_overview(
  p_since timestamptz default null,
  p_gate_ms integer default 5000
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
  ),
  per as (
    select anon_id,
           bool_or(user_id is not null) as converted,
           count(*) filter (where kind <> 'boot') as events,
           count(*) filter (where kind <> 'boot') as real_events,
           coalesce(sum(public.clamp_dwell_ms(duration_ms)) filter (where kind <> 'boot'), 0) as dwell,
           max(ua) as ua, max(src) as src, min(created_at) as first_seen,
           -- did this visitor ever change page? The gate's effect depends on
           -- [isGuest, page], so it cannot fire for anyone who never did.
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
    -- MEASURED, not assumed: how many were actually shown the sign-up screen,
    -- and how many never changed page so it could not have been raised at all.
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


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 6 — the per-visitor row counted `boot` as an event; nothing else on
-- the page did. admin_anon_overview excludes it from every total, the dwell
-- figures exclude it, and the load card above the list says in so many words
-- "เวลานี้ไม่ถูกนับรวมในตัวเลขด้านล่าง". 393 boot rows spread over 307 of the
-- ~540 visitors, so most rows in the list read one event higher than the page's
-- own totals allow. Now counted the same way as everywhere else.
-- (dwell is clamped here too, so a row agrees with the tiles above it.)
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_anon_visitors(
  p_since timestamptz default null,
  p_limit integer default 200
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


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 7 — the per-visitor trail listed `land` rows. Landing-page events are
-- excluded from every aggregate on both panels on purpose (they have their own
-- funnel card), so a visitor who arrived via /landing/ opened a trail far
-- longer than the row above it said. 570 land rows across 281 anon_ids — on
-- those visitors the trail was mostly rows the page refuses to count.
-- Dwell is clamped to match, and boot rows keep their real value but are now
-- labelled, since the trail is the one place raw evidence is useful.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_anon_visitor_detail(
  p_anon text,
  p_limit integer default 200
)
returns table(created_at timestamptz, kind text, item_id text,
              duration_ms bigint, signed_in boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  return query
  select u.created_at, u.kind, u.item_id,
         case when u.kind = 'boot' then u.duration_ms
              else public.clamp_dwell_ms(u.duration_ms) end,
         (u.user_id is not null)
  from public.usage_events u
  where u.anon_id = p_anon and u.simulated = false
    and u.kind <> 'land'        -- excluded from every total on this page
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 2000));
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 8 — admin_signup_methods double-counts anyone with two linked
-- identities: it joins auth.users to auth.identities and counts
-- `distinct u.id` per provider, so one person who signed up by email and later
-- linked Google is counted in BOTH the google and the email column while
-- `total` counts them once — google + email would exceed total and the split
-- would read as more than 100%.
--
-- Nobody has two identities today (22 users, 22 identity rows), so no number on
-- screen is currently wrong. But linking a second provider is a normal thing
-- for a user to do and it would break silently. Fixed by collapsing to one
-- provider per user (their first, the door they actually came in through) —
-- the same rule admin_anon_overview already uses — before counting.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_signup_methods(
  p_since timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  select jsonb_build_object(
    -- all-time, so the card is never blank just because nobody joined this week
    'google',     count(*) filter (where f.provider = 'google'),
    'email',      count(*) filter (where f.provider = 'email'),
    'other',      count(*) filter (where f.provider is null or f.provider not in ('google','email')),
    'total',      count(*),
    -- and the same split inside whatever range the panel is showing
    'google_new', count(*) filter (where f.provider = 'google' and (p_since is null or f.created_at >= p_since)),
    'email_new',  count(*) filter (where f.provider = 'email'  and (p_since is null or f.created_at >= p_since)),
    'other_new',  count(*) filter (where (f.provider is null or f.provider not in ('google','email'))
                                        and (p_since is null or f.created_at >= p_since)),
    'total_new',  count(*) filter (where p_since is null or f.created_at >= p_since),
    'latest_google', max(f.created_at) filter (where f.provider = 'google'),
    'latest_email',  max(f.created_at) filter (where f.provider = 'email')
  ) into v
  from (
    -- one row per account: the provider of the identity they opened it with.
    -- LEFT JOIN, so an account with no identity row at all still reaches
    -- `total` instead of vanishing from it.
    select u.id, u.created_at,
           (select i.provider from auth.identities i
             where i.user_id = u.id order by i.created_at asc limit 1) as provider
    from auth.users u
  ) f;
  return v;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DEFECT 9 — the "ช่วงเวลาที่ผู้ใช้เข้ามา" 24-hour histogram has never once
-- rendered. The panel calls admin_activity_hourly; the function was written to
-- supabase-activity-hourly-migration.sql but never applied, so the RPC does not
-- exist, the call fails, and the card silently skips itself.
--
-- Created here, with three changes from that draft:
--   • kind guard: the draft counted `boot` and `land` rows, which every other
--     number on the panel excludes — the peak hour would have been the hour
--     with the most page loads, not the most activity.
--   • `users` counted distinct user_id only, which is NULL for a signed-out
--     visitor, so the bar labelled "คน" would have ignored the majority of the
--     traffic. Now counts distinct people, member or visitor.
--   • is_app_admin(), matching every other RPC these two panels call, instead
--     of is_top_admin() — an admin who can read every other number on the page
--     but not this one chart is a split with nothing behind it.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_activity_hourly(
  p_since timestamptz default null,
  p_include_sim boolean default true
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
        group by 1
      ) c on c.h = s.h
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_activity_hourly(timestamptz, boolean) from anon;
grant  execute on function public.admin_activity_hourly(timestamptz, boolean) to authenticated;
