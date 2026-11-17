-- supabase-school-currency-migration.sql
--
-- WRITTEN, NOT APPLIED. Owner approval to apply it and to deploy the two edge functions: 2026-11-17 ("do all of these, approved").
--
-- Why (owner, 2026-11-17: the School plan card says US$28.99 per seat for an English buyer and the checkout charges THB 920): the pricing card
-- and the modal quote each language its own money (payment.tsx currencyOf: baht for Thai, yuan for Chinese, US dollars for every other
-- language) but school_submit_payment_request() prices every request in baht and school-stripe-checkout opens every card session in baht.
-- One price rule from now on: the CARD is charged in the buyer's language currency, and ONLY the card. Every manual rail (PromptPay, bank
-- transfer, Alipay, WeChat) stays baht exactly as today (owner brief 2026-11-17: "the manual channels stay in THB exactly as today"): they keep
-- using the five-argument school_submit_payment_request, and the database REFUSES to store a dollar / yuan charge on any row that is not a card row.
--
-- What it does, in ONE transaction, additive only:
--   1. two columns on school_payment_requests: charge_currency (default 'thb') and charge_amount (null for baht rows). `amount` KEEPS ITS MEANING:
--      the baht list price of the order ("THB, server-computed"): the books, the PromptPay QR, the bank transfer, and anything outside this repo
--      that sums it. A dollar row is amount = THB list price + charge_currency 'usd' + charge_amount = what the card is asked for.
--      A table CHECK makes anything else impossible (a baht row has no charge_amount; a dollar / yuan row has a positive one and is a CARD row,
--      method = 'stripe': a PromptPay, bank transfer, Alipay or WeChat row can only be baht).
--   2. _school_b2b_unit_price_cur(tier, cycle, currency): the server price table. baht -> the existing _school_b2b_unit_price (its one source),
--      usd 28.99 / 334.99, cny 210 / 2,360 per seat (month / year). The same numbers as b2bPriceByCur / b2bYearPriceByCur in payment.tsx, for
--      both tiers (b2bBaseTier pegs both to Premium); `npm run verify:school` fails when the two disagree.
--      usd month ceil(24.99 * 1.15) - 0.01 = 28.99          usd year ceil(round(24.99 * 12 * 0.97, 2) * 1.15) - 0.01 = 334.99
--      cny month ceil(176 * 1.15 / 10) * 10 = 210            cny year ceil(round(176 * 12 * 0.97) * 1.15 / 10) * 10    = 2360
--   3. school_submit_payment_request_v2(..., p_currency): the request for a dollar / yuan CARD charge (p_method must be 'stripe'). The client never
--      sends an amount: the amount and the charge are computed here from (tier, seats, cycle, currency). A NEW NAME on purpose: a second
--      school_submit_payment_request with a defaulted sixth argument makes every five-argument call "not unique" (tried on Postgres 16), which
--      would break every cached client.
--   4. a self-check that raises (so nothing is committed) if a price is not the one payment.tsx shows or the five-argument function is missing.
--
-- NOT touched: school_submit_payment_request (5 arguments, keeps returning baht), school_attach_slip, admin_list_school_payment_requests (it
-- returns the table's row type, so it carries the two new columns by itself), admin_review_school_payment, the RLS policies, every old row
-- (they read as baht by the column default).
--
-- DEPLOY ORDER IS MANDATORY. A wrong order does NOT fall back to today's baht checkout, and it can charge a buyer something other than what he was shown.
--   1. this file   2. verify-school-payment   3. school-stripe-checkout (verify_jwt true)   4. the client: pushing to main builds it on Vercel at once.
-- Steps 1 to 3 do no harm in any order among themselves: both edge functions read the row with select=* and a row without charge_* is a baht row, so they work before this
-- file is applied, and a cached old client keeps calling the five-argument function, which keeps returning baht. The CLIENT must come last. The two wrong orders, both
-- reproduced against the real code (npm run verify:school: sections B7, C5, E):
--   * the client BEFORE this file: a buyer whose card is dollars or yuan (every language but Thai) taps the card button, school_submit_payment_request_v2 does not exist, and the
--     red line shows PostgREST's raw "Could not find the function public.school_submit_payment_request_v2(...) in the schema cache". Nothing is sent to Stripe, no row is made.
--     Thai buyers and every manual rail (PromptPay, bank transfer, Alipay, WeChat) use the five-argument function and are not affected.
--   * the client and this file BEFORE school-stripe-checkout: the buyer is shown US$434.85 (or ¥3,150) and the dollar / yuan row exists, but the OLD function (live v5) ignores
--     `expect` and `cur` and charges the row's `amount`, the BAHT list price: Stripe's page asks THB 13,800, a currency and a number the buyer was never shown. If he pays, the OLD
--     verify-school-payment (live v4) marks the row paid (it checks payment_status and the metadata pairing only), the NEW one answers 409 amount_mismatch and leaves the row
--     pending while the money has been taken ("Couldn't confirm payment — contact us if you were charged"): staff have to reconcile that payment in the Stripe dashboard.
--     (From a page on www.tigaalpha.com the live v5 function answers CORS with github.io, read from its source, so the browser blocks that call instead: "Stripe unavailable",
--     nothing charged. The charge above is what a page on github.io gets.)
-- The LIVE edge functions (school-stripe-checkout v5, verify-school-payment v4, both deployed 2026-09-11) are older than the repo copies, so deploying the repo copies also ships the
-- commit 7c9d46793 changes (the www.tigaalpha.com and tigaalpha.com origins in CORS, and the return from Stripe to the domain the buyer paid from instead of always github.io):
-- diff the live source against the base commit 9762c878e before deploying.
--
-- Safe to re-run: add column if not exists, drop constraint if exists + add, create or replace, revoke / grant.
--
-- Undo (only while no dollar / yuan request exists; otherwise keep the columns):
--   drop function if exists public.school_submit_payment_request_v2(text, text, int, text, text, text);
--   drop function if exists public._school_b2b_unit_price_cur(text, text, text);
--   alter table public.school_payment_requests drop constraint if exists school_payment_requests_charge_ck,
--     drop column if exists charge_amount, drop column if exists charge_currency;
--   notify pgrst, 'reload schema';

begin;

alter table public.school_payment_requests
  add column if not exists charge_currency text    not null default 'thb',
  add column if not exists charge_amount   numeric;

alter table public.school_payment_requests drop constraint if exists school_payment_requests_charge_ck;
alter table public.school_payment_requests add constraint school_payment_requests_charge_ck check (
  (charge_currency = 'thb' and charge_amount is null)
  or (charge_currency in ('usd','cny') and charge_amount is not null and charge_amount > 0 and method = 'stripe')
);

comment on column public.school_payment_requests.amount is 'THB list price of the whole order (books, PromptPay, bank transfer). It is NOT what a dollar / yuan request charges: see charge_currency / charge_amount.';
comment on column public.school_payment_requests.charge_currency is 'thb | usd | cny: the money this request asks the buyer to pay in. thb for every row made by school_submit_payment_request().';
comment on column public.school_payment_requests.charge_amount is 'The whole order in charge_currency, at most 2 decimals. null when charge_currency is thb (then amount is the charge).';

create or replace function public._school_b2b_unit_price_cur(p_tier text, p_cycle text, p_currency text) returns numeric
language sql immutable set search_path = public as $$
  select case p_currency
    when 'thb' then public._school_b2b_unit_price(p_tier, p_cycle)
    when 'usd' then case when p_cycle = 'year' then 334.99 else 28.99 end
    when 'cny' then case when p_cycle = 'year' then 2360   else 210   end
  end;
$$;

create or replace function public.school_submit_payment_request_v2(
  p_institution_name text, p_tier text, p_seats int, p_cycle text, p_method text, p_currency text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_thb numeric; v_charge numeric; v_id uuid; v_email text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(p_tier, '') not in ('school_standard','school_plus') then raise exception 'invalid tier'; end if;
  if coalesce(p_cycle, '') not in ('month','year') then raise exception 'invalid cycle'; end if;
  if coalesce(p_currency, '') not in ('usd','cny') then raise exception 'invalid currency'; end if;
  -- only the CARD takes dollars or yuan. PromptPay, bank transfer, Alipay and WeChat are baht rails and use the five-argument function, as they always did.
  -- "is distinct from" so that a null method is refused here too, not left to the not-null constraint of the insert
  if p_method is distinct from 'stripe' then
    raise exception 'invalid method for this currency';
  end if;
  if coalesce(p_seats, 0) < 15 then raise exception 'minimum 15 seats'; end if;
  if coalesce(trim(p_institution_name), '') = '' then raise exception 'institution name required'; end if;

  select email into v_email from profiles where id = v_uid;
  v_thb    := _school_b2b_unit_price(p_tier, p_cycle) * p_seats;
  v_charge := _school_b2b_unit_price_cur(p_tier, p_cycle, p_currency) * p_seats;
  -- Stripe takes at most 8 digits of the smallest unit (99,999,999 = 999,999.99 in any currency): refuse a card request it could never open
  if p_method = 'stripe' and v_charge * 100 > 99999999 then raise exception 'too many seats for one card payment: contact us'; end if;

  insert into school_payment_requests (requester_id, institution_name, contact_email, tier, seats, cycle, amount, method, charge_currency, charge_amount)
    values (v_uid, trim(p_institution_name), coalesce(v_email, ''), p_tier, p_seats, p_cycle, v_thb, p_method, p_currency, v_charge)
    returning id into v_id;

  return jsonb_build_object('id', v_id, 'amount_thb', v_thb, 'currency', p_currency, 'charge_amount', v_charge);
end; $$;

-- signed-in buyers only, like the newer RPCs in this project (the function also refuses a null auth.uid() itself)
revoke all on function public.school_submit_payment_request_v2(text, text, int, text, text, text) from public, anon;
grant execute on function public.school_submit_payment_request_v2(text, text, int, text, text, text) to authenticated;

do $$
begin
  if to_regprocedure('public.school_submit_payment_request(text,text,integer,text,text)') is null then
    raise exception 'school_submit_payment_request (5 arguments) is missing: apply supabase-school-payment-migration.sql first';
  end if;
  if public._school_b2b_unit_price_cur('school_standard','month','thb') <> 920
     or public._school_b2b_unit_price_cur('school_standard','year','thb')  <> 10700
     or public._school_b2b_unit_price_cur('school_standard','month','usd') <> 28.99
     or public._school_b2b_unit_price_cur('school_standard','year','usd')  <> 334.99
     or public._school_b2b_unit_price_cur('school_standard','month','cny') <> 210
     or public._school_b2b_unit_price_cur('school_standard','year','cny')  <> 2360
     or public._school_b2b_unit_price_cur('school_plus','month','usd')     <> 28.99
     or public._school_b2b_unit_price_cur('school_plus','year','cny')      <> 2360 then
    raise exception 'the school price table does not match payment.tsx (baht 920 / 10700, usd 28.99 / 334.99, cny 210 / 2360): is supabase-price-799-migration.sql applied?';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- READ-BACK (read-only, one result set; run it after applying, or any time later). Expected:
--   price      cny month 210 · cny year 2360 · thb month 920 · thb year 10700 · usd month 28.99 · usd year 334.99
--   column     charge_amount numeric, nullable · charge_currency text, default 'thb'::text, not null
--   constraint school_payment_requests_charge_ck
--   function   the 5-argument school_submit_payment_request, school_submit_payment_request_v2 (security definer), both price functions
--   rows       one line per currency: every request made before this file reads thb
select 'price' as what, p_cur || ' ' || p_cycle as item, public._school_b2b_unit_price_cur('school_standard', p_cycle, p_cur)::text as value
  from (values ('month'), ('year')) c(p_cycle), (values ('thb'), ('usd'), ('cny')) u(p_cur)
union all
select 'column', column_name, data_type || ', ' || coalesce('default ' || column_default || ', ', '') || case when is_nullable = 'YES' then 'nullable' else 'not null' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'school_payment_requests' and column_name in ('charge_currency', 'charge_amount')
union all
select 'constraint', conname, pg_get_constraintdef(oid)
  from pg_constraint where conrelid = 'public.school_payment_requests'::regclass and conname = 'school_payment_requests_charge_ck'
union all
select 'function', p.oid::regprocedure::text, case when p.prosecdef then 'security definer' else 'invoker' end
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('school_submit_payment_request', 'school_submit_payment_request_v2', '_school_b2b_unit_price', '_school_b2b_unit_price_cur')
union all
select 'rows', charge_currency, count(*)::text from public.school_payment_requests group by charge_currency
order by 1, 2;
