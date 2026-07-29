-- Piano App: School Plan Pro (real B2B teacher/school dashboard)
-- Run this in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run: every object uses if-not-exists / or-replace / drop-if-exists.
--
-- Turns "Kru Mode" from a local-device toy into a real multi-tenant feature: a
-- teacher account sees only the real students linked to their own school, with
-- real progress data and real cross-device assignments. profiles.plan/plan_until
-- are the ONLY bridge to the rest of the app — a school-linked student ends up
-- with a normal plan value, indistinguishable from a self-paying subscriber
-- everywhere else (effectivePlan/isMaxPlan/PLAN_LABEL need zero changes).

-- ── schools ─────────────────────────────────────────────────────────────────
create table if not exists schools (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null,
  owner_id           uuid not null references auth.users (id) on delete restrict,
  plan               text not null default 'school_standard'
                       check (plan in ('school_standard','school_plus')),
  seat_quota         int  not null default 0 check (seat_quota >= 0),          -- student seats
  teacher_seat_quota int  not null default 3 check (teacher_seat_quota >= 0),  -- teacher logins
  plan_until         timestamptz,
  join_code          text not null unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists schools_owner_idx on schools (owner_id);

-- ── school_members: links a real auth.users row to a school with a role ─────
create table if not exists school_members (
  id               uuid primary key default uuid_generate_v4(),
  school_id        uuid not null references schools (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('teacher','student')),
  status           text not null default 'active' check (status in ('active','removed')),
  prior_plan       text,             -- snapshot of profiles.plan at join time, restored on removal
  prior_plan_until timestamptz,
  joined_at        timestamptz not null default now(),
  removed_at       timestamptz,
  created_by       uuid references auth.users (id),
  unique (school_id, user_id)
);
create index if not exists school_members_school_idx on school_members (school_id) where status = 'active';
create index if not exists school_members_user_idx   on school_members (user_id)   where status = 'active';

-- ── school_assignments: real, DB-backed replacement for the old local checkbox ──
create table if not exists school_assignments (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references schools (id) on delete cascade,
  member_id   uuid not null references school_members (id) on delete cascade, -- the STUDENT row
  song_id     text not null,  -- matches SONGS[].id in songs-data.ts (static client data, same convention as video_likes.file_id — not a DB FK)
  note        text,
  assigned_by uuid not null references auth.users (id),
  assigned_at timestamptz not null default now(),
  due_at      timestamptz,
  ack_at      timestamptz,    -- student marked it practiced — real, timestamped, cross-device
  created_at  timestamptz not null default now()
);
create index if not exists school_assignments_member_idx on school_assignments (member_id, assigned_at desc);

-- profiles gains a denormalized cache so the client knows "am I a teacher /
-- which school" without an extra roundtrip. This is a CONVENIENCE cache only —
-- the real access-control boundary for every RPC/RLS policy below is the
-- school_members table (client-writable only through SECURITY DEFINER RPCs,
-- never directly), so tampering with these two columns cannot grant real access
-- to anyone else's data, only self-corrupt the tamperer's own client-side UI.
alter table profiles add column if not exists school_id   uuid references schools (id);
alter table profiles add column if not exists school_role text check (school_role in ('teacher','student'));

-- ── helper functions ──────────────────────────────────────────────────────────
-- avoids RLS self-recursion on school_members; mirrors is_piano_admin() in
-- supabase-piano-video-migration.sql
create or replace function public.is_school_teacher(target_school uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from school_members
    where school_id = target_school and user_id = auth.uid()
      and role = 'teacher' and status = 'active'
  );
$$;

create or replace function public._gen_join_code() returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (ceil(random()*33))::int, 1), '')
  from generate_series(1, 7);
$$;

-- Standard ≈ Premium-equivalent, Plus ≈ Max-equivalent (matches the already-decided
-- B2B pricing: ~15% premium over each individual plan). The only place this mapping
-- lives — the rest of the app never needs to know "school" plans exist.
create or replace function public._school_plan_to_individual(p_school_plan text) returns text
language sql immutable set search_path = public as $$
  select case p_school_plan when 'school_plus' then 'max' else 'premium' end;
$$;

-- keeps profiles.school_id/school_role in sync with school_members
create or replace function public._sync_profile_school_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('tiga.allow_school_field_change', 'on', true);
  if NEW.status = 'active' then
    update profiles set school_id = NEW.school_id, school_role = NEW.role where id = NEW.user_id;
  elsif TG_OP = 'UPDATE' and NEW.status = 'removed' and OLD.status = 'active' then
    update profiles set school_id = null, school_role = null
      where id = NEW.user_id and school_id is not distinct from NEW.school_id;
  end if;
  return NEW;
end; $$;

drop trigger if exists school_members_sync_profile on school_members;
create trigger school_members_sync_profile
  after insert or update on school_members
  for each row execute function public._sync_profile_school_fields();

-- Defense in depth for the two NEW columns only (deliberately does not touch
-- plan/plan_until/admin_tier — those are pre-existing columns with their own,
-- separate protection story that is out of scope for this migration).
create or replace function public._protect_school_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tiga.allow_school_field_change', true) = 'on' then return NEW; end if;
  if NEW.school_id is distinct from OLD.school_id or NEW.school_role is distinct from OLD.school_role then
    raise exception 'school_id/school_role can only change via school_* RPCs';
  end if;
  return NEW;
end; $$;

drop trigger if exists protect_school_profile_fields on profiles;
create trigger protect_school_profile_fields
  before update on profiles
  for each row execute function public._protect_school_profile_fields();

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Reads are scoped through school_members. ALL writes go through the
-- SECURITY DEFINER RPCs below — no client-side insert/update/delete policy on
-- any of these 3 tables, since school membership is a privilege grant (it
-- silently changes a student's plan), same bucket as admin_tier/plan/banned.
alter table schools            enable row level security;
alter table school_members     enable row level security;
alter table school_assignments enable row level security;

drop policy if exists "schools: member select" on schools;
create policy "schools: member select" on schools for select
  using (id in (select school_id from school_members where user_id = auth.uid() and status = 'active'));
drop policy if exists "schools: staff select" on schools;
create policy "schools: staff select" on schools for select
  using (exists (select 1 from profiles where id = auth.uid() and admin_tier > 0));

drop policy if exists "school_members: self select" on school_members;
create policy "school_members: self select" on school_members for select
  using (user_id = auth.uid());
drop policy if exists "school_members: teacher select roster" on school_members;
create policy "school_members: teacher select roster" on school_members for select
  using (is_school_teacher(school_id));
drop policy if exists "school_members: staff select" on school_members;
create policy "school_members: staff select" on school_members for select
  using (exists (select 1 from profiles where id = auth.uid() and admin_tier > 0));

drop policy if exists "school_assignments: student select own" on school_assignments;
create policy "school_assignments: student select own" on school_assignments for select
  using (exists (select 1 from school_members m where m.id = member_id and m.user_id = auth.uid()));
drop policy if exists "school_assignments: teacher select" on school_assignments;
create policy "school_assignments: teacher select" on school_assignments for select
  using (is_school_teacher(school_id));
drop policy if exists "school_assignments: staff select" on school_assignments;
create policy "school_assignments: staff select" on school_assignments for select
  using (exists (select 1 from profiles where id = auth.uid() and admin_tier > 0));

-- ── staff-provisioning RPCs (admin_tier >= 3, same floor as admin_set_plan/admin_appoint) ──
create or replace function public.admin_create_school(
  p_name text, p_owner_email text, p_plan text, p_seat_quota int,
  p_teacher_seat_quota int default 3, p_days int default 365
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tier smallint; v_owner uuid; v_school_id uuid; v_code text;
  v_prior_plan text; v_prior_until timestamptz;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier,0) < 3 then raise exception 'insufficient admin tier'; end if;
  if p_plan not in ('school_standard','school_plus') then raise exception 'invalid plan'; end if;

  select id into v_owner from profiles where lower(email) = lower(trim(p_owner_email)) limit 1;
  if v_owner is null then raise exception 'owner must sign in to TiGA at least once first'; end if;

  v_code := _gen_join_code();
  insert into schools (name, owner_id, plan, seat_quota, teacher_seat_quota, plan_until, join_code)
    values (trim(p_name), v_owner, p_plan, p_seat_quota, p_teacher_seat_quota, now() + (p_days || ' days')::interval, v_code)
    returning id into v_school_id;

  select plan, plan_until into v_prior_plan, v_prior_until from profiles where id = v_owner;
  insert into school_members (school_id, user_id, role, prior_plan, prior_plan_until, created_by)
    values (v_school_id, v_owner, 'teacher', v_prior_plan, v_prior_until, auth.uid());

  perform set_config('tiga.allow_school_field_change', 'on', true);
  update profiles set plan = _school_plan_to_individual(p_plan),
    plan_until = now() + (p_days || ' days')::interval
    where id = v_owner;

  return v_school_id;
end; $$;

create or replace function public.admin_set_school_seats(p_school_id uuid, p_seat_quota int, p_teacher_seat_quota int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier,0) < 3 then raise exception 'insufficient admin tier'; end if;
  update schools set seat_quota = p_seat_quota, teacher_seat_quota = p_teacher_seat_quota, updated_at = now()
    where id = p_school_id;
end; $$;

create or replace function public.admin_renew_school(p_school_id uuid, p_plan text, p_days int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tier smallint; v_until timestamptz;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier,0) < 3 then raise exception 'insufficient admin tier'; end if;
  if p_plan not in ('school_standard','school_plus') then raise exception 'invalid plan'; end if;
  v_until := now() + (p_days || ' days')::interval;
  update schools set plan = p_plan, plan_until = v_until, updated_at = now() where id = p_school_id;

  perform set_config('tiga.allow_school_field_change', 'on', true);
  update profiles p set plan = _school_plan_to_individual(p_plan), plan_until = v_until
    from school_members m
    where m.school_id = p_school_id and m.status = 'active' and m.user_id = p.id;
end; $$;

-- staff list view — same shape as admin_list_students (App.tsx:7186), tier floor
-- of 1 matches its "Support (view only)" tier
create or replace function public.admin_list_schools()
returns table(
  id uuid, name text, owner_id uuid, owner_email text, owner_name text,
  plan text, seat_quota int, teacher_seat_quota int, plan_until timestamptz,
  join_code text, student_count bigint, teacher_count bigint, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier,0) < 1 then raise exception 'insufficient admin tier'; end if;
  return query
    select s.id, s.name, s.owner_id, o.email, o.full_name,
      s.plan, s.seat_quota, s.teacher_seat_quota, s.plan_until, s.join_code,
      (select count(*) from school_members m where m.school_id = s.id and m.role = 'student' and m.status = 'active'),
      (select count(*) from school_members m where m.school_id = s.id and m.role = 'teacher' and m.status = 'active'),
      s.created_at
    from schools s left join profiles o on o.id = s.owner_id
    order by s.created_at desc;
end; $$;

-- ── teacher/student self-serve RPCs (this is what stops staff from having to
--    run admin_set_plan by hand for every single student, forever) ───────────
create or replace function public.school_join(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_school schools%rowtype; v_uid uuid := auth.uid(); v_count int; v_member_id uuid;
  v_prior_plan text; v_prior_until timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_school from schools where join_code = upper(trim(p_code)) for update;
  if not found then raise exception 'invalid code'; end if;
  if v_school.plan_until is not null and v_school.plan_until < now() then raise exception 'school plan expired'; end if;
  if exists (select 1 from school_members where user_id = v_uid and status = 'active') then
    raise exception 'already an active member of a school — leave that one first';
  end if;

  select count(*) into v_count from school_members
    where school_id = v_school.id and role = 'student' and status = 'active';
  if v_count >= v_school.seat_quota then raise exception 'this school''s student seats are full — ask your teacher'; end if;

  select plan, plan_until into v_prior_plan, v_prior_until from profiles where id = v_uid;
  insert into school_members (school_id, user_id, role, prior_plan, prior_plan_until, created_by)
    values (v_school.id, v_uid, 'student', v_prior_plan, v_prior_until, v_uid)
    returning id into v_member_id;

  perform set_config('tiga.allow_school_field_change', 'on', true);
  update profiles set plan = _school_plan_to_individual(v_school.plan), plan_until = v_school.plan_until where id = v_uid;

  return jsonb_build_object('school_id', v_school.id, 'school_name', v_school.name, 'plan', v_school.plan);
end; $$;

create or replace function public.school_add_member_by_email(p_school_id uuid, p_email text, p_role text default 'student')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_school schools%rowtype; v_target uuid; v_count int; v_quota int; v_member_id uuid;
  v_prior_plan text; v_prior_until timestamptz;
begin
  if not is_school_teacher(p_school_id) then raise exception 'not a teacher of this school'; end if;
  if p_role not in ('teacher','student') then raise exception 'invalid role'; end if;
  select * into v_school from schools where id = p_school_id for update;
  if not found then raise exception 'school not found'; end if;

  select id into v_target from profiles where lower(email) = lower(trim(p_email)) limit 1;
  if v_target is null then raise exception 'no TiGA account found for that email yet — ask them to sign in once first'; end if;
  if exists (select 1 from school_members where user_id = v_target and status = 'active') then
    raise exception 'already an active member of a school';
  end if;

  v_quota := case p_role when 'teacher' then v_school.teacher_seat_quota else v_school.seat_quota end;
  select count(*) into v_count from school_members where school_id = p_school_id and role = p_role and status = 'active';
  if v_count >= v_quota then raise exception '% seats are full', p_role; end if;

  select plan, plan_until into v_prior_plan, v_prior_until from profiles where id = v_target;
  insert into school_members (school_id, user_id, role, prior_plan, prior_plan_until, created_by)
    values (p_school_id, v_target, p_role, v_prior_plan, v_prior_until, auth.uid())
    returning id into v_member_id;

  perform set_config('tiga.allow_school_field_change', 'on', true);
  update profiles set plan = _school_plan_to_individual(v_school.plan), plan_until = v_school.plan_until where id = v_target;

  return jsonb_build_object('member_id', v_member_id);
end; $$;

create or replace function public.school_remove_member(p_member_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_row school_members%rowtype;
begin
  select * into v_row from school_members where id = p_member_id for update;
  if not found then raise exception 'member not found'; end if;
  if not is_school_teacher(v_row.school_id) then raise exception 'not a teacher of this school'; end if;
  if v_row.status = 'removed' then return; end if;

  update school_members set status = 'removed', removed_at = now() where id = p_member_id;

  perform set_config('tiga.allow_school_field_change', 'on', true);
  update profiles set plan = coalesce(v_row.prior_plan, 'free'), plan_until = v_row.prior_plan_until
    where id = v_row.user_id;
end; $$;

create or replace function public.school_leave(p_school_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_row school_members%rowtype;
begin
  select * into v_row from school_members where school_id = p_school_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'not a member'; end if;
  update school_members set status = 'removed', removed_at = now() where id = v_row.id;
  perform set_config('tiga.allow_school_field_change', 'on', true);
  update profiles set plan = coalesce(v_row.prior_plan, 'free'), plan_until = v_row.prior_plan_until where id = auth.uid();
end; $$;

create or replace function public.school_rotate_join_code(p_school_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not is_school_teacher(p_school_id) then raise exception 'not a teacher of this school'; end if;
  v_code := _gen_join_code();
  update schools set join_code = v_code, updated_at = now() where id = p_school_id;
  return v_code;
end; $$;

create or replace function public.school_assign_song(p_member_id uuid, p_song_id text, p_note text default null, p_due_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_row school_members%rowtype; v_id uuid;
begin
  select * into v_row from school_members where id = p_member_id and status = 'active';
  if not found then raise exception 'member not found'; end if;
  if not is_school_teacher(v_row.school_id) then raise exception 'not a teacher of this school'; end if;
  if v_row.role <> 'student' then raise exception 'can only assign songs to students'; end if;
  if coalesce(trim(p_song_id), '') = '' then raise exception 'song_id required'; end if;

  insert into school_assignments (school_id, member_id, song_id, note, assigned_by, due_at)
    values (v_row.school_id, p_member_id, p_song_id, nullif(trim(p_note), ''), auth.uid(), p_due_at)
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.school_ack_assignment(p_assignment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update school_assignments sa set ack_at = now()
    where sa.id = p_assignment_id and sa.ack_at is null
      and exists (select 1 from school_members m where m.id = sa.member_id and m.user_id = auth.uid());
end; $$;

-- teacher-scoped equivalent of admin_list_students (App.tsx:7186) — same shape,
-- tenant-scoped instead of business-wide, plus each student's latest assignment
create or replace function public.school_roster(p_school_id uuid)
returns table(
  member_id uuid, user_id uuid, role text, joined_at timestamptz,
  email text, full_name text, exp int, lessons_done int, streak int,
  last_active date, progress jsonb,
  assigned_song_id text, assigned_note text, assigned_at timestamptz, assigned_due_at timestamptz, ack_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_teacher(p_school_id) then raise exception 'not a teacher of this school'; end if;
  return query
    select m.id, m.user_id, m.role, m.joined_at,
      p.email, p.full_name, p.exp, p.lessons_done, p.streak, p.last_active, p.progress,
      a.song_id, a.note, a.assigned_at, a.due_at, a.ack_at
    from school_members m
    join profiles p on p.id = m.user_id
    left join lateral (
      select * from school_assignments sa where sa.member_id = m.id order by sa.assigned_at desc limit 1
    ) a on true
    where m.school_id = p_school_id and m.status = 'active'
    order by m.role desc, p.last_active desc nulls last, p.exp desc;
end; $$;
