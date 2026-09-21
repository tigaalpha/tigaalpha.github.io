-- student_feedback table (Phase 4, spec §17) — durable self-reports
-- ---------------------------------------------------------------------
-- The practice-result micro-poll currently stores StudentFeedback records
-- in localStorage (tg_self_reports, last 30). This table makes them durable
-- and cross-device, so the teaching_outcomes analysis can correlate
-- "what the student SAID" with "what the student's accuracy did" — the
-- §17 principle: direct answers outrank inference, and they belong in the
-- Proprietary TIGA Teaching Dataset next to outcomes.
--
-- Write the file, wait for the owner's approval, then apply (repo hard rule).
-- Additive, re-runnable. Style mirrors supabase-teaching-outcomes-migration.sql.
-- ---------------------------------------------------------------------

create table if not exists public.student_feedback (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  session_id    text,
  question      text,
  answer        text not null,
  feedback_type text check (feedback_type in ('understanding','difficulty','enjoyment','confidence')),
  reliability   numeric check (reliability >= 0 and reliability <= 1),
  created_at    timestamptz not null default now()
);
create index if not exists student_feedback_student_idx on public.student_feedback (student_id, created_at desc);

-- Append-only like teaching_outcomes: RLS on, students insert/read own rows,
-- UPDATE/DELETE always false (a student cannot rewrite what they reported —
-- the dataset's value depends on it being honest history).
alter table public.student_feedback enable row level security;

drop policy if exists "student_feedback insert own" on public.student_feedback;
create policy "student_feedback insert own" on public.student_feedback
  for insert to authenticated
  with check (auth.uid() = student_id);

drop policy if exists "student_feedback select own" on public.student_feedback;
create policy "student_feedback select own" on public.student_feedback
  for select to authenticated
  using (auth.uid() = student_id);

drop policy if exists "student_feedback no update" on public.student_feedback;
create policy "student_feedback no update" on public.student_feedback
  for update to authenticated
  using (false);

drop policy if exists "student_feedback no delete" on public.student_feedback;
create policy "student_feedback no delete" on public.student_feedback
  for delete to authenticated
  using (false);

revoke all on public.student_feedback from anon;

-- Teacher read: a teacher of the student's school may read feedback rows for
-- their own school's students (spec §34 phase 3 — teacher dashboard needs the
-- student's words, not just numbers). Tenant-scoped via school_members; the
-- same is_school_teacher() guard every school RPC uses.
create or replace function public.school_student_feedback(p_school_id uuid, p_student uuid)
returns setof public.student_feedback
language sql stable security definer set search_path = public as $$
  select sf.*
  from public.student_feedback sf
  where sf.student_id = p_student
    and exists (
      select 1 from public.school_members m
      where m.user_id = p_student
        and m.school_id = p_school_id
        and m.status = 'active'
        and m.role = 'student'
    )
    and public.is_school_teacher(p_school_id)
  order by sf.created_at desc
  limit 50;
$$;

revoke execute on function public.school_student_feedback(uuid, uuid) from public, anon;
grant execute on function public.school_student_feedback(uuid, uuid) to authenticated;
