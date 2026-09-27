-- Play Along: other players' runs as "ghosts" to race (Play Along batch 3).
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run: every object uses if-not-exists / or-replace.
--
-- The live duel's "find an opponent" waits up to 20 s for a real player;
-- when nobody is online it offers a race against a real run someone else
-- played on the same song — their score over time, drawn as the ghost line
-- the app already draws for your own best run. That needs other players'
-- runs on the server, which is all this file adds:
--
--   * pa_ghost_runs          each player's best run per song (score over
--                            time), at most one row per player per song
--   * pa_submit_ghost(...)   stores a run if it is the player's best on that
--                            song and looks like a real run
--   * pa_pick_ghost(song, level)  one run by SOMEONE ELSE on that song,
--                            preferring players within 2 levels
--
-- What a ghost shows about its player: the first word of their name (never
-- the e-mail), their level and that run's score, accuracy and stars. No
-- coins, gems or EXP are involved anywhere in this file, and nothing here
-- touches profiles or any existing function.
--
-- Checks on a submitted run (so a ghost is always something a person could
-- have played):
--   * song id: 1–64 chars of [a-z0-9_]
--   * samples: 2–240 points of {"t": seconds, "s": score}, t and s never
--     decreasing, t within 0–300 s, the last s equal to the final score
--   * score ≤ 1500 per second of play and ≤ 300 000 in total; accuracy
--     0–100; stars agree with the accuracy (50/75/90)
--   * at most 200 submissions a day per player

create table if not exists pa_ghost_runs (
  user_id     uuid not null references auth.users (id) on delete cascade,
  song_id     text not null,
  level       int  not null default 1,     -- the player's level when they played it
  score       int  not null,
  acc         int  not null,
  stars       int  not null,
  samples     jsonb not null,               -- [{"t": 1.2, "s": 300}, ...]
  day         date not null default current_date,
  day_count   int  not null default 1,      -- submissions that day (rate limit)
  updated_at  timestamptz not null default now(),
  primary key (user_id, song_id)
);
create index if not exists pa_ghost_runs_song_idx on pa_ghost_runs (song_id, level);

alter table pa_ghost_runs enable row level security;
drop policy if exists "pa_ghost_runs: self select" on pa_ghost_runs;
create policy "pa_ghost_runs: self select" on pa_ghost_runs for select
  using (user_id = auth.uid());
-- no client insert/update/delete policy: writes go through pa_submit_ghost(),
-- and other players' runs are read only through pa_pick_ghost().

create or replace function public.pa_submit_ghost(
  p_song_id text, p_level int, p_score int, p_acc int, p_stars int, p_samples jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  n int;
  i int;
  pt jsonb;
  t numeric; s numeric; last_t numeric := -1; last_s numeric := -1;
  prev pa_ghost_runs%rowtype;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_song_id is null or p_song_id !~ '^[a-z0-9_]{1,64}$' then return false; end if;
  if p_score is null or p_score < 0 or p_score > 300000 then return false; end if;
  if p_acc is null or p_acc < 0 or p_acc > 100 then return false; end if;
  if p_stars is null or p_stars <> (case when p_acc >= 90 then 3 when p_acc >= 75 then 2 when p_acc >= 50 then 1 else 0 end) then return false; end if;
  if p_samples is null or jsonb_typeof(p_samples) <> 'array' then return false; end if;
  n := jsonb_array_length(p_samples);
  if n < 2 or n > 240 then return false; end if;
  for i in 0 .. n - 1 loop
    pt := p_samples -> i;
    if jsonb_typeof(pt) <> 'object' or jsonb_typeof(pt -> 't') <> 'number' or jsonb_typeof(pt -> 's') <> 'number' then return false; end if;
    t := (pt ->> 't')::numeric; s := (pt ->> 's')::numeric;
    if t < 0 or t > 300 or t < last_t or s < 0 or s < last_s then return false; end if;
    last_t := t; last_s := s;
  end loop;
  if last_s <> p_score then return false; end if;
  if p_score > greatest(last_t, 1) * 1500 then return false; end if;

  select * into prev from pa_ghost_runs where user_id = u and song_id = p_song_id for update;
  if found then
    if prev.day = current_date and prev.day_count >= 200 then return false; end if;
    if p_score <= prev.score then
      update pa_ghost_runs set
        day_count = case when prev.day = current_date then prev.day_count + 1 else 1 end,
        day = current_date
      where user_id = u and song_id = p_song_id;
      return false;                         -- recorded as a try, not a new best
    end if;
    update pa_ghost_runs set
      level = greatest(1, least(coalesce(p_level, 1), 99)),
      score = p_score, acc = p_acc, stars = p_stars, samples = p_samples,
      day_count = case when prev.day = current_date then prev.day_count + 1 else 1 end,
      day = current_date, updated_at = now()
    where user_id = u and song_id = p_song_id;
  else
    insert into pa_ghost_runs (user_id, song_id, level, score, acc, stars, samples)
      values (u, p_song_id, greatest(1, least(coalesce(p_level, 1), 99)), p_score, p_acc, p_stars, p_samples);
  end if;
  return true;
end; $$;

-- One ghost for the caller to race: another player's best run on this song,
-- chosen at random among players within 2 levels of p_level, otherwise
-- among anyone. Banned players are never picked. Returns no row when
-- nobody else has played the song yet (the app then offers the caller's
-- own best, as it does today).
create or replace function public.pa_pick_ghost(p_song_id text, p_level int default 1)
returns table (name text, level int, score int, acc int, stars int, samples jsonb)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Pianist') as name,
    g.level, g.score, g.acc, g.stars, g.samples
  from pa_ghost_runs g
  join profiles p on p.id = g.user_id
  where g.song_id = p_song_id
    and g.user_id <> auth.uid()
    and not coalesce(p.banned, false)
  order by (abs(g.level - coalesce(p_level, 1)) <= 2) desc, random()
  limit 1;
$$;

revoke all on function public.pa_submit_ghost(text, int, int, int, int, jsonb) from public, anon;
grant execute on function public.pa_submit_ghost(text, int, int, int, int, jsonb) to authenticated;
revoke all on function public.pa_pick_ghost(text, int) from public, anon;
grant execute on function public.pa_pick_ghost(text, int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying (two signed-in accounts, A and B):
-- 1. As A: select pa_submit_ghost('twinkle', 3, 900, 95, 3,
--             '[{"t":0,"s":0},{"t":10,"s":400},{"t":20,"s":900}]');   → true
-- 2. As A, the same call with score 800 (and a last sample of 800)       → false
--    (not a new best; the stored run is still 900)
-- 3. As A: a run whose samples go backwards, or whose last s ≠ score     → false
-- 4. As A: select * from pa_pick_ghost('twinkle', 3);  → no row (only A has played it)
-- 5. As B: select * from pa_pick_ghost('twinkle', 3);  → A's run, first name only
-- ═══════════════════════════════════════════════════════════════════════════
