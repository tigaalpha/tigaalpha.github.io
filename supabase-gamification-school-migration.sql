-- School Plan Pro add-ons: a student-facing peer leaderboard, and a
-- teacher-set cooperative "Class Quest" (shared EXP goal for the whole class).
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run.
--
-- Context: SchoolDashboard (supabase-school-plan-migration.sql) already gives
-- TEACHERS full per-student visibility. Students themselves had none — no way
-- to see classmates at all. This closes that gap with two additive, low-risk
-- pieces built entirely on the existing schools/profiles.school_id structure;
-- neither touches any existing table, policy, or RPC from that migration.
--
-- Requires supabase-school-plan-migration.sql already applied (uses its
-- `is_school_teacher(uuid)` helper and the `schools`/profiles.school_id shape).

-- ── 1. Student-facing school leaderboard (no new table) ─────────────────────
create or replace function public.get_school_leaderboard(p_school_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from profiles where id = v_uid and school_id = p_school_id) then
    raise exception 'not a member of that school';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', coalesce(nullif(trim(x.full_name), ''), 'Student'),
      'exp', x.exp, 'is_me', x.id = v_uid
    ) order by x.exp desc), '[]'::jsonb)
    into v_result
    from (
      select id, full_name, exp from profiles
      where school_id = p_school_id
      order by exp desc
      limit 50
    ) x;
  return v_result;
end; $$;

-- ── 2. Class Quest — cooperative, teacher-set shared EXP goal ───────────────
create table if not exists school_quests (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references schools (id) on delete cascade,
  goal_exp    int  not null check (goal_exp > 0),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);
create index if not exists school_quests_active_idx on school_quests (school_id, ends_at desc);

create table if not exists school_quest_contributions (
  quest_id         uuid not null references school_quests (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  exp_contributed  int  not null default 0,
  primary key (quest_id, user_id)
);

alter table school_quests enable row level security;
drop policy if exists "school_quests: school members select" on school_quests;
create policy "school_quests: school members select" on school_quests for select
  using (exists (select 1 from profiles where id = auth.uid() and school_id = school_quests.school_id));

alter table school_quest_contributions enable row level security;
drop policy if exists "school_quest_contributions: school members select" on school_quest_contributions;
create policy "school_quest_contributions: school members select" on school_quest_contributions for select
  using (exists (
    select 1 from school_quests q join profiles p on p.school_id = q.school_id
    where q.id = school_quest_contributions.quest_id and p.id = auth.uid()
  ));
-- no client insert/update policy on either table — writes only via the RPCs below

create or replace function public.school_set_quest(p_school_id uuid, p_goal_exp int, p_days int default 7) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_school_teacher(p_school_id) then raise exception 'not a teacher of this school'; end if;
  if p_goal_exp is null or p_goal_exp <= 0 then raise exception 'invalid goal'; end if;
  if p_days is null or p_days <= 0 or p_days > 30 then raise exception 'invalid duration'; end if;
  insert into school_quests (school_id, goal_exp, ends_at, created_by)
    values (p_school_id, p_goal_exp, now() + (p_days || ' days')::interval, auth.uid())
    returning id into v_id;
  return v_id;
end; $$;

-- Called alongside gainExp() for every student, same as league_bump_exp. The
-- school is looked up from the CALLER's own profile row, never from a
-- client-passed school/quest id — so there is no id to guess/forge to inflate
-- a different school's total, and nothing happens (not an error) for a
-- student not currently in any school or with no active quest right now.
create or replace function public.school_quest_bump(p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_school uuid; v_quest uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 2000 then raise exception 'invalid amount'; end if;
  select school_id into v_school from profiles where id = v_uid;
  if v_school is null then return; end if;
  select id into v_quest from school_quests
    where school_id = v_school and now() between starts_at and ends_at
    order by created_at desc limit 1;
  if v_quest is null then return; end if;
  insert into school_quest_contributions (quest_id, user_id, exp_contributed)
    values (v_quest, v_uid, p_amount)
  on conflict (quest_id, user_id) do update
    set exp_contributed = school_quest_contributions.exp_contributed + excluded.exp_contributed;
end; $$;

create or replace function public.get_school_quest(p_school_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_quest school_quests%rowtype; v_total int; v_mine int; v_top jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from profiles where id = v_uid and school_id = p_school_id) then
    raise exception 'not a member of that school';
  end if;

  select * into v_quest from school_quests
    where school_id = p_school_id and now() between starts_at and ends_at
    order by created_at desc limit 1;
  if not found then return jsonb_build_object('active', false); end if;

  select coalesce(sum(exp_contributed), 0) into v_total from school_quest_contributions where quest_id = v_quest.id;
  select coalesce(exp_contributed, 0) into v_mine from school_quest_contributions where quest_id = v_quest.id and user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
      'name', coalesce(nullif(trim(p.full_name), ''), 'Student'), 'exp', x.exp_contributed
    ) order by x.exp_contributed desc), '[]'::jsonb)
    into v_top
    from (select user_id, exp_contributed from school_quest_contributions where quest_id = v_quest.id order by exp_contributed desc limit 10) x
    join profiles p on p.id = x.user_id;

  return jsonb_build_object(
    'active', true, 'goal_exp', v_quest.goal_exp, 'ends_at', v_quest.ends_at,
    'total_exp', v_total, 'my_exp', coalesce(v_mine, 0), 'top', v_top,
    'complete', v_total >= v_quest.goal_exp
  );
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying (use a real school + a teacher + student account):
-- 1. select get_school_leaderboard('<a school id you belong to>'); as a student
--    -> your own school's roster ranked by exp; as a stranger school id -> FAILS
-- 2. As the teacher: select school_set_quest('<school id>', 500, 7);
-- 3. As a student in that school: select school_quest_bump(50); then
--    select get_school_quest('<school id>'); -> total_exp reflects the bump
-- 4. As a non-teacher: select school_set_quest('<school id>', 500, 7);
--    -> must FAIL ("not a teacher of this school")
-- ═══════════════════════════════════════════════════════════════════════════
