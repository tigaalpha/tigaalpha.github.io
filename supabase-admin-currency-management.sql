-- Admin Currency Management: let admins directly adjust coins, gems, and exp
-- for any student. Re-runnable (uses or-replace).
--
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.

-- 1. Update admin_list_students_v2 to also return coins & gems.
--    The DROP is required, not optional: this adds two OUT columns, and
--    Postgres refuses "create or replace" when a function's return type
--    changes ("cannot change return type of existing function"). Without it
--    this whole migration aborts on its first statement — which is exactly
--    why the admin console shipped with a Save button whose RPC did not
--    exist, and why saving raised "Could not find the function
--    public.admin_adjust_currency(...) in the schema cache".
drop function if exists public.admin_list_students_v2(text, int, int);
create or replace function public.admin_list_students_v2(p_search text default null, p_limit int default 200, p_offset int default 0)
returns table(
  id uuid, full_name text, email text, admin_tier smallint, banned boolean,
  plan text, plan_until timestamptz, exp int, lessons_done int, streak int,
  last_active date, progress jsonb,
  coins int, gems int
)
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select p.admin_tier into v_tier from profiles p where p.id = auth.uid();
  if coalesce(v_tier, 0) < 1 then raise exception 'insufficient admin tier'; end if;
  return query
    select p.id, p.full_name, p.email, p.admin_tier, p.banned, p.plan, p.plan_until,
      p.exp, p.lessons_done, p.streak, p.last_active, p.progress,
      p.coins, p.gems
    from profiles p
    where p_search is null or trim(p_search) = ''
      or p.full_name ilike '%' || trim(p_search) || '%'
      or p.email ilike '%' || trim(p_search) || '%'
    order by p.last_active desc nulls last, p.exp desc
    limit least(coalesce(p_limit, 200), 500)
    offset greatest(coalesce(p_offset, 0), 0);
end; $$;

-- 2. Admin function to directly set coins, gems, and exp for a student.
--    Uses absolute SET (not additive) since this is admin override, not a purchase.
--    Requires admin_tier >= 3 (Top Tier only).
create or replace function public.admin_adjust_currency(
  target uuid,
  p_coins int default null,
  p_gems int default null,
  p_exp int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 3 then raise exception 'insufficient admin tier — Top Tier required'; end if;

  if target is null then raise exception 'target user required'; end if;
  -- none of these has any meaning below zero; reject rather than store junk
  if p_coins is not null and p_coins < 0 then raise exception 'coins cannot be negative'; end if;
  if p_gems  is not null and p_gems  < 0 then raise exception 'gems cannot be negative'; end if;
  if p_exp   is not null and p_exp   < 0 then raise exception 'exp cannot be negative'; end if;

  update profiles set
    coins = coalesce(p_coins, coins),
    gems  = coalesce(p_gems, gems),
    exp   = coalesce(p_exp, exp)
  where id = target;

  if not found then raise exception 'target user not found'; end if;
end; $$;

-- Applied to production (project gsaqgbracxnucdmtmcxz) as migration
-- `admin_currency_management`, after a BEGIN/ROLLBACK dry run confirmed both
-- functions are created with the exact argument names the client sends.
