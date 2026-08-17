-- 0085: auto-provision profiles บน auth.users — สมาชิกใหม่ที่สมัครหลัง
-- migration นี้ได้ profile อัตโนมัติ (คนแรกของระบบ = owner, คนถัดไป = staff)
-- ครอบคลุมสมาชิกที่สมัครใหม่; สำหรับบัญชีที่ login อยู่แล้วแต่ยังไม่มี row
-- ให้ใช้ edge function bootstrap-profile (AuthGuard เรียกให้อัตโนมัติหลัง
-- login) — รวมกันแล้วไม่ต้องสร้าง profile ด้วยมือตามขั้นตอน E4 เดิมอีก

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_role user_role;
begin
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Owner'
  );

  if not exists (select 1 from profiles) then
    v_role := 'owner';
  else
    v_role := 'staff';
  end if;

  insert into profiles (id, full_name, role)
  values (new.id, v_full_name, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
