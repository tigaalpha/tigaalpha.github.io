-- Fixes two broken Admin Console tabs. Safe to re-run. Run in Supabase SQL
-- Editor (project gsaqgbracxnucdmtmcxz).
--
-- 1. Schools tab ("column reference "id" is ambiguous"): admin_list_schools()
--    declares a RETURNS TABLE column named `id`, which in plpgsql becomes a
--    variable visible through the whole function body. The tier check below
--    referenced the bare column name `id`, which collided with that variable.
--    Fix: qualify it as profiles.id. This replaces the function in place —
--    same name/signature, so no app code or client change is needed.
create or replace function public.admin_list_schools()
returns table(
  id uuid, name text, owner_id uuid, owner_email text, owner_name text,
  plan text, seat_quota int, teacher_seat_quota int, plan_until timestamptz,
  join_code text, student_count bigint, teacher_count bigint, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where profiles.id = auth.uid();
  if coalesce(v_tier,0) < 1 then raise exception 'insufficient admin tier'; end if;
  return query
    select s.id, s.name, s.owner_id, o.email, o.full_name,
      s.plan, s.seat_quota, s.teacher_seat_quota, s.plan_until, s.join_code,
      (select count(*) from school_members m where m.school_id = s.id and m.role = 'student' and m.status = 'active'),
      (select count(*) from school_members m where m.school_id = s.id and m.role = 'teacher' and m.status = 'active'),
      s.created_at
    from schools s left join profiles o on o.id = s.owner_id
    order by s.created_at desc
    limit 500;
end; $$;

-- 2. Students tab ("Could not find the function ... in the schema cache"):
--    admin_list_students_v2() was written in an earlier security-review pass
--    (see supabase-security-hardening-migration.sql) but was never actually
--    run against this database, so PostgREST has never seen it. App.tsx
--    already calls it — this just creates what the client is expecting.
--    This does NOT touch or remove the old admin_list_students().
create or replace function public.admin_list_students_v2(p_search text default null, p_limit int default 200, p_offset int default 0)
returns table(
  id uuid, full_name text, email text, admin_tier smallint, banned boolean,
  plan text, plan_until timestamptz, exp int, lessons_done int, streak int,
  last_active date, progress jsonb
)
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select p.admin_tier into v_tier from profiles p where p.id = auth.uid();
  if coalesce(v_tier, 0) < 1 then raise exception 'insufficient admin tier'; end if;
  return query
    select p.id, p.full_name, p.email, p.admin_tier, p.banned, p.plan, p.plan_until,
      p.exp, p.lessons_done, p.streak, p.last_active, p.progress
    from profiles p
    where p_search is null or trim(p_search) = ''
      or p.full_name ilike '%' || trim(p_search) || '%'
      or p.email ilike '%' || trim(p_search) || '%'
    order by p.last_active desc nulls last, p.exp desc
    limit least(coalesce(p_limit, 200), 500)
    offset greatest(coalesce(p_offset, 0), 0);
end; $$;
