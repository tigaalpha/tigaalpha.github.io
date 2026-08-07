-- Skill Tracking: monthly per-skill score snapshots, for a real month-over-
-- month trend chart ("has Sight Reading improved in the last 2 months?").
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run: every object uses if-not-exists / or-replace.
--
-- Design note: like league_weekly_exp, there is no server-side scheduler
-- here — this project has no cron/background-job infra today. A snapshot
-- row is written by the CLIENT, at most once per calendar month per
-- learner, the next time they open the app after the month rolls over (see
-- maybeSnapshotSkills() in App.tsx). This means the exact "day" captured
-- per month varies by when someone happens to open the app that month, and
-- a learner who skips a whole month simply has a gap in their history —
-- both are accepted trade-offs of having no scheduler, same as every other
-- "period" table in this project.
--
-- Deliberately additive only — does NOT touch profiles or any other table.

create table if not exists skill_monthly_snapshot (
  user_id    uuid not null references auth.users (id) on delete cascade,
  month_key  text not null,   -- matches the client's monthKey() format, e.g. "2026-8"
  skill      text not null,   -- matches App.tsx's SKILLS ids, e.g. "sight_reading"
  score      int  not null,
  n          int  not null default 0,   -- attempt count the score was based on, for context
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key, skill)
);
create index if not exists skill_monthly_snapshot_user_idx on skill_monthly_snapshot (user_id, skill, month_key);
-- NOTE: like league_weekly_exp, this grows by up to ~7 rows/user/month
-- forever (no automatic pruning — no scheduled-job infra today). Rows are
-- tiny (5 small columns); if it ever becomes a real storage concern, old
-- month_key rows can be deleted manually with
-- `delete from skill_monthly_snapshot where month_key < '<cutoff>'`.

alter table skill_monthly_snapshot enable row level security;
drop policy if exists "skill_monthly_snapshot: self select" on skill_monthly_snapshot;
create policy "skill_monthly_snapshot: self select" on skill_monthly_snapshot for select
  using (user_id = auth.uid());
-- no client insert/update policy at all — every write goes through
-- upsert_skill_snapshot() below, same SELECT-only-RLS-plus-SECURITY-DEFINER-RPC
-- pattern used by every other table added this project.

-- Called by the client once per scored skill, at most once per calendar
-- month (see maybeSnapshotSkills() in App.tsx). Bounds-checked so a
-- tampered client can't write nonsense into a learner's own history.
create or replace function public.upsert_skill_snapshot(p_month_key text, p_skill text, p_score int, p_n int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_month_key is null or length(p_month_key) > 20 then raise exception 'invalid month_key'; end if;
  if p_skill is null or length(p_skill) > 40 then raise exception 'invalid skill'; end if;
  if p_score is null or p_score < 0 or p_score > 100 then raise exception 'invalid score'; end if;
  if p_n is null or p_n < 0 or p_n > 100000 then raise exception 'invalid n'; end if;
  insert into skill_monthly_snapshot (user_id, month_key, skill, score, n)
    values (auth.uid(), p_month_key, p_skill, p_score, p_n)
  on conflict (user_id, month_key, skill) do update
    set score = excluded.score, n = excluded.n, updated_at = now();
end; $$;

-- Returns the caller's own skill-score history (all skills, all months on
-- record), so the client can render a trend without one round-trip per
-- skill. p_limit bounds how many *months* are returned, not rows.
create or replace function public.get_my_skill_history(p_limit int default 12)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb;
  cutoff_months text[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select array_agg(month_key) into cutoff_months from (
    select distinct month_key from skill_monthly_snapshot
    where user_id = auth.uid()
    order by month_key desc
    limit greatest(1, least(p_limit, 60))
  ) m;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select month_key, skill, score, n
    from skill_monthly_snapshot
    where user_id = auth.uid() and month_key = any(cutoff_months)
    order by month_key asc
  ) t;
  return result;
end; $$;
