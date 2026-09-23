-- ─────────────────────────────────────────────────────────────────────────────
-- Sim Leaderboard migration (additive + re-runnable)
--
-- 1. sim_bot_name: expands the roster to 50 unique names (one per possible
--    bot, bots are md5('tiga-sim-bot-' || i) for i in 1..bots).
-- 2. get_leaderboard_v2(p_limit): same shape as the existing get_leaderboard
--    (rank / name / exp / is_me) PLUS an explicit is_bot column. When the demo-
--    bot system is enabled (app_settings.sim_bots), each enabled bot appears on
--    the board under its stable random name with a deterministic EXP value —
--    always flagged is_bot = true so the frontend can show it transparently
--    with a 🤖 badge. Bots never appear when bots are disabled or auto-shutdown
--    has fired (unless override_auto_off is set).
--
-- Deliberately additive: does NOT modify the original get_leaderboard /
-- get_my_rank (whose source isn't in this repo). The client tries v2 first and
-- falls back to the original RPC if v2 is missing.
--
-- Transparency note (agreed with owner): bots on the public leaderboard carry
-- a visible 🤖 badge in the UI. They are practice companions for beginners to
-- compete against, not fake users.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. 50-name bot roster ────────────────────────────────────────────────────
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

-- ── 2. leaderboard v2: real players + flagged bots, one ranked list ─────────
create or replace function public.get_leaderboard_v2(p_limit int default 20)
returns table (
  rank  int,
  name  text,
  exp   int,
  is_me boolean,
  is_bot boolean
)
language sql stable security definer set search_path = public as $$
  with cfg as (
    select value from public.app_settings where key = 'sim_bots'
  ),
  bot_cfg as (
    select
      least(coalesce((c.value->>'bots')::int, 0), 50) as n,
      coalesce((c.value->>'enabled')::boolean, false) as enabled,
      coalesce((c.value->>'override_auto_off')::boolean, false) as override_auto_off,
      coalesce((c.value->>'max_real_users')::int, 50) as max_real_users
    from cfg c
  ),
  active_bots as (
    select b.n from bot_cfg b
    where b.enabled and b.n > 0
      and (b.override_auto_off or public.sim_real_user_count() < b.max_real_users)
  ),
  bot_rows as (
    select
      generate_series(1, ab.n) as i
    from active_bots ab
  ),
  real_rows as (
    -- real players (same shape the original board shows)
    select
      p.id as uid,
      coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1), 'Pianist') as name,
      greatest(coalesce(p.exp, 0), 0) as exp,
      false as is_bot,
      (p.id = auth.uid()) as is_me
    from public.profiles p
    where not coalesce(p.banned, false)
    order by p.exp desc nulls last
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  ),
  combined as (
    select uid, name, exp, is_bot, is_me from real_rows
    union all
    -- demo bots: stable name + stable plausible EXP per bot index
    select
      md5('tiga-sim-bot-' || b.i)::uuid as uid,
      public.sim_bot_name(md5('tiga-sim-bot-' || b.i)::uuid) as name,
      (150 + (('x' || substr(md5('tiga-exp-seed-' || b.i), 1, 8))::bit(32)::bigint % 8350))::int as exp,
      true as is_bot,
      false as is_me
    from bot_rows b
  )
  select
    (row_number() over (order by c.exp desc, c.uid))::int,
    c.name,
    c.exp,
    c.is_me,
    c.is_bot
  from combined c;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying:
-- 1. As any signed-in user: select * from get_leaderboard_v2(20);
--    -> real top players; zero bot rows while sim_bots.enabled = false.
-- 2. After enabling bots from the admin dashboard (admin_sim_config(p_enabled=>true, p_bots=>10)):
--    -> up to 10 extra rows, all is_bot = true, names from sim_bot_name.
-- 3. Turn bots off -> bot rows disappear from v2 immediately (config-driven).
-- ═══════════════════════════════════════════════════════════════════════════
