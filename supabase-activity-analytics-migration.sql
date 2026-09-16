-- ─────────────────────────────────────────────────────────────────────────────
-- Activity Analytics migration (additive + re-runnable)
--
-- 1. usage_events: + duration_ms (page dwell time), + simulated (demo-bot rows)
-- 2. is_top_admin(): admin_tier >= 3 guard (the owner only)
-- 3. admin_activity_* RPCs: per-user / per-page / per-button / score analytics
--    — every one gated to is_top_admin(), never exposes raw rows to others
-- 4. admin_sim_config() + sim_tick(): demo-bot generator that populates the
--    ADMIN DASHBOARD ONLY. Simulated rows are flagged simulated = true and are
--    never shown to real learners anywhere in the app.
--
-- Matches the style of the other supabase-*.sql files: if-not-exists / or
-- replace, safe to run repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. columns + indexes ─────────────────────────────────────────────────────
alter table public.usage_events add column if not exists duration_ms bigint;
alter table public.usage_events add column if not exists simulated boolean not null default false;

create index if not exists usage_events_created_at_idx on public.usage_events (created_at desc);
create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

-- ── 2. top-admin guard (tier 3 = owner) ─────────────────────────────────────
create or replace function public.is_top_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.admin_tier >= 3 from public.profiles p where p.id = auth.uid()),
    false);
$$;

-- Stable display names for simulated users, derived from the uuid so every
-- query agrees on the name without a roster table.
create or replace function public.sim_bot_name(p_id uuid)
returns text
language sql immutable set search_path = public as $$
  select (array[
    'Ploy', 'Mick', 'Fah', 'Bee', 'Ton', 'Nok', 'Aom', 'Guy', 'Yui', 'Peak',
    'Mai', 'Oat', 'Pang', 'Tle', 'Ice', 'Bell', 'Note', 'Jeen', 'Kwan', 'Dew',
    'Art', 'Petch', 'Mint', 'Boom', 'Champ', 'Earn', 'Palm', 'View', 'God', 'Jane',
    'Preaw', 'Best', 'Golf', 'First', 'Mild', 'Nam', 'Ohm', 'Pun', 'Run', 'Sun',
    'Tara', 'Um', 'Win', 'Ying', 'Zen', 'Boss', 'Cake', 'Donut', 'Fai', 'Gift'
  ])[1 + (('x' || substr(p_id::text, 1, 8))::bit(32)::bigint % 50)];
$$;


-- ── 3a. users overview: who was active, how long, when last ─────────────────
-- display name: real users → profile full_name/email; sim users → bot name.
create or replace function public.admin_activity_users(p_since timestamptz default null)
returns table (
  user_id uuid,
  display_name text,
  email text,
  events bigint,
  page_time_ms numeric,
  last_seen timestamptz,
  simulated boolean
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
    u.simulated
  from per_user u
  order by u.simulated asc, u.last_seen desc nulls last;
$$;

-- ── 3b. per-user drill-down (pages + dwell, buttons, score, recent) ─────────
create or replace function public.admin_activity_user_detail(p_user uuid, p_since timestamptz default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', t.item_id, 'hits', t.hits,
        'total_ms', t.total_ms, 'avg_ms', round(t.avg_ms)))
      from (
        select item_id, count(*) as hits, sum(duration_ms) as total_ms, avg(duration_ms) as avg_ms
        from public.usage_events
        where user_id = p_user and kind = 'page' and (p_since is null or created_at >= p_since)
        group by item_id
        order by sum(duration_ms) desc nulls last
        limit 25
      ) t), '[]'::jsonb),
    'buttons', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (
        select item_id, count(*) as hits
        from public.usage_events
        where user_id = p_user and kind = 'nav' and (p_since is null or created_at >= p_since)
        group by item_id
        order by count(*) desc
        limit 30
      ) t), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (
        select item_id, count(*) as hits
        from public.usage_events
        where user_id = p_user and kind = 'score' and (p_since is null or created_at >= p_since)
        group by item_id
        order by count(*) desc
        limit 20
      ) t), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', r.kind, 'item_id', r.item_id,
        'duration_ms', r.duration_ms, 'created_at', r.created_at))
      from (
        select kind, item_id, duration_ms, created_at
        from public.usage_events
        where user_id = p_user and (p_since is null or created_at >= p_since)
        order by created_at desc
        limit 60
      ) r), '[]'::jsonb)
  );
$$;

-- ── 3c. global overview (top pages by dwell, top buttons, score flow) ───────
create or replace function public.admin_activity_overview(p_since timestamptz default null, p_include_sim boolean default true)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'totals', coalesce((
      select jsonb_build_object(
        'users', count(distinct t.user_id),
        'events', count(*),
        'page_time_ms', coalesce(sum(t.duration_ms), 0),
        'score_events', count(*) filter (where t.kind = 'score'))
      from public.usage_events t
      where (p_since is null or t.created_at >= p_since)
        and (p_include_sim or not t.simulated)), '{}'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', t.item_id, 'hits', t.hits,
        'total_ms', t.total_ms, 'avg_ms', round(t.avg_ms)))
      from (
        select item_id, count(*) as hits, sum(duration_ms) as total_ms, avg(duration_ms) as avg_ms
        from public.usage_events
        where kind = 'page' and (p_since is null or created_at >= p_since)
          and (p_include_sim or not simulated)
        group by item_id
        order by sum(duration_ms) desc nulls last
        limit 20
      ) t), '[]'::jsonb),
    'buttons', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (
        select item_id, count(*) as hits
        from public.usage_events
        where kind = 'nav' and (p_since is null or created_at >= p_since)
          and (p_include_sim or not simulated)
        group by item_id
        order by count(*) desc
        limit 25
      ) t), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', t.item_id, 'hits', t.hits))
      from (
        select item_id, count(*) as hits
        from public.usage_events
        where kind = 'score' and (p_since is null or created_at >= p_since)
          and (p_include_sim or not simulated)
        group by item_id
        order by count(*) desc
        limit 15
      ) t), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', r.kind, 'item_id', r.item_id, 'duration_ms', r.duration_ms,
        'created_at', r.created_at, 'simulated', r.simulated,
        'who', case when r.simulated then public.sim_bot_name(r.user_id)
               else coalesce((select nullif(p.full_name, '') from public.profiles p where p.id = r.user_id),
                    (select split_part(p.email, '@', 1) from public.profiles p where p.id = r.user_id), '—') end))
      from (
        select user_id, kind, item_id, duration_ms, created_at, simulated
        from public.usage_events
        where (p_since is null or created_at >= p_since)
        order by created_at desc
        limit 40
      ) r), '[]'::jsonb)
  );
$$;

-- ── 4. demo-bot generator (ADMIN DASHBOARD ONLY — never shown to learners) ──


-- Config lives in app_settings (key 'sim_bots'):
-- {enabled, bots, intensity, max_real_users, override_auto_off}
-- intensity = events per bot per tick (1..5). Phase-out = lower bots/enabled.
-- max_real_users = auto-shutdown threshold (default 50): sim_tick disables
-- itself once this many distinct REAL users have been seen in the last 30d.
-- override_auto_off = owner's explicit choice to KEEP RUNNING past the
-- threshold (change of mind) — sim_tick honours this and stays on.
create or replace function public.admin_sim_config(p_enabled boolean default null, p_bots int default null, p_intensity int default null, p_max_real_users int default null, p_override_auto_off boolean default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cur jsonb;
  v_real int;
  v_max int;
  v_override boolean;
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;

  select value into v_cur from public.app_settings where key = 'sim_bots';
  if v_cur is null then
    v_cur := jsonb_build_object('enabled', false, 'bots', 0, 'intensity', 2, 'max_real_users', 50, 'override_auto_off', false);
  end if;

  if p_enabled is not null or p_bots is not null or p_intensity is not null or p_max_real_users is not null or p_override_auto_off is not null then
    v_cur := jsonb_build_object(
      'enabled', coalesce(p_enabled, (v_cur->>'enabled')::boolean),
      'bots', greatest(0, least(50, coalesce(p_bots, (v_cur->>'bots')::int))),
      'intensity', greatest(1, least(5, coalesce(p_intensity, (v_cur->>'intensity')::int))),
      'max_real_users', greatest(1, coalesce(p_max_real_users, (v_cur->>'max_real_users')::int, 50)),
      'override_auto_off', coalesce(p_override_auto_off, (v_cur->>'override_auto_off')::boolean, false));
    insert into public.app_settings (key, value) values ('sim_bots', v_cur)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  v_max := coalesce((v_cur->>'max_real_users')::int, 50);
  v_override := coalesce((v_cur->>'override_auto_off')::boolean, false);
  v_real := public.sim_real_user_count();
  -- report live status so the dashboard can show why bots are (or aren't) running
  return jsonb_set(jsonb_set(
    v_cur,
    '{real_users}', to_jsonb(v_real)),
    '{auto_disabled}',
    to_jsonb(v_real >= v_max and not v_override));
end;
$$;

-- One generation tick: creates plausible page/nav/score events spread over the
-- last 10 minutes for each enabled bot. Called by the admin dashboard (and
-- throttled client-side). Returns rows created.
create or replace function public.sim_tick()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb;
  v_bots int;
  v_intensity int;
  v_created int := 0;
  v_id uuid;
  v_i int;
  v_k int;
  v_pages text[] := array['pathway','sensei','studio','videos','profile','today','insights','eargym','reading','challenging','songs'];
  v_navs text[] := array['studio-eargym','studio-reading','studio-today','studio-quick','studio-analytics','coach-challenging','nav-pathway','nav-profile'];
  v_scores text[] := array['exp:lesson','exp:practice','exp:quest','exp:game','coins:chest'];
begin
  if not public.is_top_admin() then
    return 0;
  end if;

  select value into v_cfg from public.app_settings where key = 'sim_bots';
  if v_cfg is null or not coalesce((v_cfg->>'enabled')::boolean, false) then
    return 0;
  end if;

  -- AUTO-SHUTDOWN: once the real audience has arrived (>= max_real_users
  -- distinct real users in the last 30 days), retire the bots — UNLESS the
  -- owner explicitly chose to keep them running (override_auto_off = true,
  -- settable from the admin dashboard at any time).
  if public.sim_real_user_count() >= coalesce((v_cfg->>'max_real_users')::int, 50)
     and not coalesce((v_cfg->>'override_auto_off')::boolean, false) then
    if coalesce((v_cfg->>'enabled')::boolean, false) then
      update public.app_settings
        set value = jsonb_set(value, '{enabled}', 'false'::jsonb)
        where key = 'sim_bots';
    end if;
    return 0;
  end if;

  v_bots := coalesce((v_cfg->>'bots')::int, 0);
  v_intensity := coalesce((v_cfg->>'intensity')::int, 2);

  -- throttle: at most one tick per 5 minutes
  if v_cfg ? 'last_tick' and (v_cfg->>'last_tick')::timestamptz > now() - interval '5 minutes' then
    return 0;
  end if;

  for v_i in 1..v_bots loop
    v_id := md5('tiga-sim-bot-' || v_i)::uuid;
    for v_k in 1..v_intensity loop
      insert into public.usage_events (user_id, kind, item_id, duration_ms, simulated, created_at)
      values (
        v_id,
        'page',
        v_pages[1 + floor(random() * array_length(v_pages, 1))::int],
        -- plausible dwell: 30s .. 8min
        (30000 + floor(random() * 450000))::bigint,
        true,
        now() - (random() * interval '10 minutes')
      );
      v_created := v_created + 1;
    end loop;
    -- most ticks also include a button press and sometimes a score event
    if random() < 0.7 then
      insert into public.usage_events (user_id, kind, item_id, simulated, created_at)
      values (v_id, 'nav', v_navs[1 + floor(random() * array_length(v_navs, 1))::int], true, now() - (random() * interval '10 minutes'));
      v_created := v_created + 1;
    end if;
    if random() < 0.5 then
      insert into public.usage_events (user_id, kind, item_id, simulated, created_at)
      values (v_id, 'score', v_scores[1 + floor(random() * array_length(v_scores, 1))::int], true, now() - (random() * interval '10 minutes'));
      v_created := v_created + 1;
    end if;
  end loop;

  update public.app_settings
    set value = jsonb_set(value, '{last_tick}', to_jsonb(now()))
    where key = 'sim_bots';

  return v_created;
end;
$$;

-- ── 5. AUTO-SHUTDOWN: stop bots once the real audience has arrived ─────────
-- The launch plan: run bots only while the app feels empty, then retire them.
-- sim_tick refuses to generate (and flips enabled=false) once the number of
-- DISTINCT REAL (non-simulated) users seen in the last 30 days reaches 50.
-- The threshold lives in the sim_bots config as 'max_real_users' so the owner
-- can change it from the dashboard without another migration.
create or replace function public.sim_real_user_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::int
  from public.usage_events
  where not simulated
    and created_at >= now() - interval '30 days';
$$;

create or replace function public.sim_purge(p_older_than_days int default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_deleted int := 0;
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;

  -- p_older_than_days null → delete ALL simulated rows; otherwise only rows
  -- older than that many days (lets the owner fade old bot data out while
  -- keeping recent history readable).
  with del as (
    delete from public.usage_events
    where simulated
      and (p_older_than_days is null or created_at < now() - make_interval(days => p_older_than_days))
    returning 1
  )
  select count(*) into v_deleted from del;

  return v_deleted;
end;
$$;
