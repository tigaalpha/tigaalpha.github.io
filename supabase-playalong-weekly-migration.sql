-- Play Along: the song of the week and its board (Play Along batch 3).
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run: every object uses if-not-exists / or-replace.
--
-- What it adds, and nothing else:
--   * pa_weekly_rotation  26 songs; the week's song is picked from it by the
--                         week number, so there is no weekly admin chore and
--                         no scheduled job (this project has none).
--   * pa_weekly_scores    one row per player per week: their best run of that
--                         week's song.
--   * pa_weekly_song()          → this week's song (the client shows it)
--   * pa_submit_weekly(...)     → records a run, keeps the best, drops
--                                  impossible ones
--   * pa_weekly_board(limit)    → the top of this week's board + the caller
--   * pa_my_weekly_badges()     → the weeks the caller finished 1st–3rd
--
-- Rewards: the board hands out an honour badge (top 3 of a finished week)
-- and NOTHING else — no coins, no gems, no EXP — so there is no reason to
-- fake a score (owner rule 2026-09-25: coins/gems come only from playing,
-- admins, or the one notification reward). Nothing here touches profiles,
-- coins, exp or any existing function.
--
-- A run only counts when it is the week's song, played right-handed at
-- normal speed or faster (the client sends only those), and it passes the
-- server's own checks against the song's note count and length:
--   score  ≤ notes × 1500   (300 a note × the combo multiplier, which stays
--                             under 2.5 for 48 notes, × 2 for Fever)
--   max combo ≤ notes; accuracy 0–100; stars agree with the accuracy
--   (50/75/90); the run took at least 70% of the song's length at 1× (the
--   fastest tempo is 1.25×, so a real run is never shorter than 80%)
-- and at most 60 runs a week are accepted per player.
-- A run that fails is not an error the app has to handle: it is simply not
-- recorded (the RPC returns false).

create table if not exists pa_weekly_rotation (
  idx        int  primary key,          -- 0..n-1; week n plays idx (n mod count)
  song_id    text not null,
  notes      int  not null check (notes between 1 and 200),   -- right-hand notes
  length_ms  int  not null check (length_ms between 1000 and 600000)  -- at 1× tempo
);
alter table pa_weekly_rotation enable row level security;
drop policy if exists "pa_weekly_rotation: read" on pa_weekly_rotation;
create policy "pa_weekly_rotation: read" on pa_weekly_rotation for select using (true);

-- The first 26 weeks: level 1–2 songs of 14–40 s that are open to every
-- plan, genres spread out, starting with a Thai song. Numbers are from
-- songs-data.ts (notes = right-hand notes, length at the song's own bpm).
insert into pa_weekly_rotation (idx, song_id, notes, length_ms) values
  (0,  'maew_miao',          33, 23571),
  (1,  'molihua',            37, 31364),
  (2,  'deep_river',         22, 29091),
  (3,  'swing_low',          24, 22143),
  (4,  'battle_hymn',        36, 26111),
  (5,  'soul_call_response', 19, 16364),
  (6,  'old_kentucky',       20, 20000),
  (7,  'songbie',            34, 40000),
  (8,  'home_road',          22, 19375),
  (9,  'fishermen_cn',       20, 25263),
  (10, 'old_folks_home',     25, 23333),
  (11, 'minuet_boc',         23, 16250),
  (12, 'shenandoah',         25, 28421),
  (13, 'ode',                30, 19200),
  (14, 'moon_high_cn',       17, 27273),
  (15, 'marines_hymn',       25, 16000),
  (16, 'sleeping_b',         22, 16250),
  (17, 'she_coming',         36, 17500),
  (18, 'hallelujah_h',       33, 16071),
  (19, 'home_sweet_home',    35, 37500),
  (20, 'longing_cn',         20, 26667),
  (21, 'first_noel',         25, 23333),
  (22, 'nessun_dorma',       22, 28333),
  (23, 'this_old_man',       28, 17222),
  (24, 'mi_babbino',         22, 33636),
  (25, 'michael_row',        31, 24667)
on conflict (idx) do nothing;

create table if not exists pa_weekly_scores (
  week_start  date not null,            -- Monday, Bangkok time
  user_id     uuid not null references auth.users (id) on delete cascade,
  song_id     text not null,
  score       int  not null,
  acc         int  not null,
  stars       int  not null,
  max_combo   int  not null,
  runs        int  not null default 1,  -- runs submitted this week (rate limit)
  updated_at  timestamptz not null default now(),
  primary key (week_start, user_id)
);
create index if not exists pa_weekly_scores_board_idx on pa_weekly_scores (week_start, score desc);
-- ~1 row per active player per week, forever (no pruning job exists); rows
-- are small. Old weeks can be removed by hand if ever needed:
--   delete from pa_weekly_scores where week_start < '<cutoff>';

alter table pa_weekly_scores enable row level security;
drop policy if exists "pa_weekly_scores: self select" on pa_weekly_scores;
create policy "pa_weekly_scores: self select" on pa_weekly_scores for select
  using (user_id = auth.uid());
-- no client insert/update/delete policy: every write goes through
-- pa_submit_weekly() below (the project's SELECT-only-RLS-plus-SECURITY-
-- DEFINER pattern), and the board is read through pa_weekly_board().

-- This week's Monday in Bangkok time.
create or replace function public._pa_week_start(p_at timestamptz default now()) returns date
language sql stable as $$
  select date_trunc('week', (p_at at time zone 'Asia/Bangkok'))::date;
$$;

-- The rotation entry for a given week (week 0 = the week of 2026-09-28).
create or replace function public._pa_week_song(p_week date)
returns table (song_id text, notes int, length_ms int)
language sql stable set search_path = public as $$
  select r.song_id, r.notes, r.length_ms
  from pa_weekly_rotation r
  where r.idx = (
    (((p_week - date '2026-09-28') / 7) % (select count(*) from pa_weekly_rotation))
    + (select count(*) from pa_weekly_rotation)
  ) % (select count(*) from pa_weekly_rotation);
$$;

create or replace function public.pa_weekly_song()
returns table (week_start date, song_id text, notes int, length_ms int, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select w.wk, s.song_id, s.notes, s.length_ms,
         ((w.wk + 7)::timestamp at time zone 'Asia/Bangkok') as ends_at
  from (select public._pa_week_start() as wk) w
  cross join lateral public._pa_week_song(w.wk) s;
$$;

create or replace function public.pa_submit_weekly(
  p_song_id text, p_score int, p_acc int, p_stars int, p_max_combo int, p_duration_ms int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  wk date := public._pa_week_start();
  s record;
  prev pa_weekly_scores%rowtype;
begin
  if u is null then raise exception 'not authenticated'; end if;
  select * into s from public._pa_week_song(wk);
  if s.song_id is null or p_song_id is distinct from s.song_id then return false; end if;
  -- the run must be one this song can produce
  if p_score is null or p_score < 0 or p_score > s.notes * 1500 then return false; end if;
  if p_acc is null or p_acc < 0 or p_acc > 100 then return false; end if;
  if p_stars is null or p_stars <> (case when p_acc >= 90 then 3 when p_acc >= 75 then 2 when p_acc >= 50 then 1 else 0 end) then return false; end if;
  if p_max_combo is null or p_max_combo < 0 or p_max_combo > s.notes then return false; end if;
  if p_duration_ms is null or p_duration_ms < s.length_ms * 0.7 or p_duration_ms > s.length_ms * 4 + 60000 then return false; end if;

  select * into prev from pa_weekly_scores where week_start = wk and user_id = u for update;
  if found then
    if prev.runs >= 60 then return false; end if;
    update pa_weekly_scores set
      runs = prev.runs + 1,
      score = greatest(prev.score, p_score),
      acc = case when p_score > prev.score then p_acc else prev.acc end,
      stars = case when p_score > prev.score then p_stars else prev.stars end,
      max_combo = case when p_score > prev.score then p_max_combo else prev.max_combo end,
      updated_at = case when p_score > prev.score then now() else prev.updated_at end
    where week_start = wk and user_id = u;
  else
    insert into pa_weekly_scores (week_start, user_id, song_id, score, acc, stars, max_combo)
      values (wk, u, s.song_id, p_score, p_acc, p_stars, p_max_combo);
  end if;
  return true;
end; $$;

-- The top of this week's board, plus the caller's own row and rank even
-- when they are not in the top. A player shows by first name only (the
-- first word of full_name), never the e-mail. Banned players are left out.
-- Ties rank by who got there first.
create or replace function public.pa_weekly_board(p_limit int default 20)
returns table (rank int, name text, score int, stars int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select
      (row_number() over (order by w.score desc, w.updated_at asc))::int as rank,
      coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Pianist') as name,
      w.score, w.stars,
      (w.user_id = auth.uid()) as is_me
    from pa_weekly_scores w
    join profiles p on p.id = w.user_id
    where w.week_start = public._pa_week_start()
      and not coalesce(p.banned, false)
  )
  select r.rank, r.name, r.score, r.stars, r.is_me
  from ranked r
  where r.rank <= greatest(1, least(coalesce(p_limit, 20), 50)) or r.is_me
  order by r.rank;
$$;

-- Finished weeks where the caller placed 1st–3rd: the honour badges.
create or replace function public.pa_my_weekly_badges()
returns table (week_start date, song_id text, place int)
language sql stable security definer set search_path = public as $$
  select x.week_start, x.song_id, x.place
  from (
    select w.week_start, w.song_id, w.user_id,
           (row_number() over (partition by w.week_start order by w.score desc, w.updated_at asc))::int as place
    from pa_weekly_scores w
    join profiles p on p.id = w.user_id
    where w.week_start < public._pa_week_start()
      and not coalesce(p.banned, false)
  ) x
  where x.user_id = auth.uid() and x.place <= 3
  order by x.week_start desc;
$$;

revoke all on function public.pa_submit_weekly(text, int, int, int, int, int) from public, anon;
grant execute on function public.pa_submit_weekly(text, int, int, int, int, int) to authenticated;
revoke all on function public.pa_weekly_board(int) from public, anon;
grant execute on function public.pa_weekly_board(int) to authenticated;
revoke all on function public.pa_my_weekly_badges() from public, anon;
grant execute on function public.pa_my_weekly_badges() to authenticated;
grant execute on function public.pa_weekly_song() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying (as a signed-in user, e.g. from the app's
-- console with sb.rpc):
-- 1. select * from pa_weekly_song();
--      → this week's Monday, one song id, its notes and length
-- 2. select pa_submit_weekly('<that song id>', 5000, 92, 3, 20, <length_ms>);
--      → true; select * from pa_weekly_board(20) shows you
-- 3. select pa_submit_weekly('<that song id>', 999999, 92, 3, 20, <length_ms>);
--      → false (score over notes × 1500); the board still shows 5000
-- 4. select pa_submit_weekly('<that song id>', 5000, 92, 1, 20, <length_ms>);
--      → false (1 star does not match 92%)
-- 5. select pa_submit_weekly('<that song id>', 5000, 92, 3, 20, 1000);
--      → false (too short to be a real run)
-- 6. select pa_submit_weekly('some_other_song', 100, 50, 1, 5, 20000);
--      → false (not this week's song)
-- ═══════════════════════════════════════════════════════════════════════════
