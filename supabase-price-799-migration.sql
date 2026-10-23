-- Premium price cut to 799 THB / month (owner, 2026-10-22). NOT APPLIED: needs the owner's approval.
-- The two server-side price functions still hold the old figures (checked read-only on the live DB 2026-10-23).
--  1. _plan_price_thb: only used by fulfill_plan_purchase() to refuse an unknown plan, so no customer is
--     charged from it today, but it must keep matching PLAN_PRICE in payment.tsx.
--  2. _school_b2b_unit_price: THIS ONE CHARGES. School / studio seats are priced here (the client only shows a
--     preview), so until it is changed the pricing card says about 920 THB a seat while the request is created at
--     1,720 THB. The client pegs BOTH school tiers to the Premium price (b2bBaseTier), so both tiers use 799 here.
-- Yearly = round(799 * 12 * 0.97) = 9,300, then the 15 % studio markup, rounded up to a multiple of 10.
create or replace function public._plan_price_thb(p_plan text)
returns integer language sql immutable set search_path = public as $$
  select case p_plan
    when 'premium'   then 799
    when 'family'    then 799
    when 'max'       then 799
    when 'maxfamily' then 799
    else null
  end;
$$;

create or replace function public._school_b2b_unit_price(p_tier text, p_cycle text) returns numeric
language sql immutable set search_path = public as $$
  select case
    when p_cycle = 'year' then ceil(round(799 * 12 * 0.97) * 1.15 / 10) * 10
    else ceil(799 * 1.15 / 10) * 10
  end;
$$;
-- check: select _school_b2b_unit_price('school_standard','month'), _school_b2b_unit_price('school_standard','year');  -- 920, 10700
