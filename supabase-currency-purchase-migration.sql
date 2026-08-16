-- Currency purchases: buy Coins/Gems with real money (PromptPay / Alipay / WeChat slip-upload)
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run: every object uses if-not-exists / or-replace.
--
-- Deliberately additive only — extends the existing `payments` table with 3 new
-- nullable/defaulted columns (kind, currency_type, currency_amount) rather than
-- creating a parallel table, since this reuses the exact same PromptPay/Alipay/
-- WeChat slip-upload + admin-review pipeline the consumer plan checkout already
-- uses (see BuyCurrencyModal in payment.tsx, modeled directly on SchoolCheckoutModal).
-- Existing rows/columns/RLS on `payments` are untouched; existing plan-purchase
-- rows get kind='plan' via the column default and remain unaffected.
--
-- No Stripe path in this pass — QR/slip only. Deliberately deferred (see the header
-- comment above BuyCurrencyModal in payment.tsx for why).
--
-- The buyer-submitted amount is NEVER trusted — submit_currency_purchase() computes
-- price server-side from _currency_package_price(), which duplicates the exact
-- COIN_PACKAGES/GEM_PACKAGES table in payment.tsx. If those packages ever change,
-- update the literals below to match.
--
-- Crediting is strictly additive (coins = coins + amount / gems = gems + amount),
-- never a client-writable absolute value — the same class of hole the security-
-- hardening migration's exp/coins clamp trigger exists to catch if ever attempted
-- directly. The clamp trigger's threshold (single-update increases over +100,000)
-- is far above the largest package here (3,000 coins / 300 gems), so it will never
-- interfere with a legitimate approval.

alter table public.payments add column if not exists kind text not null default 'plan';
alter table public.payments add column if not exists currency_type text;   -- 'coins' | 'gems', only set when kind='currency'
alter table public.payments add column if not exists currency_amount int;  -- only set when kind='currency'

create or replace function public._currency_package_price(p_currency_type text, p_amount int) returns int
language sql immutable set search_path = public as $$
  select case
    when p_currency_type = 'coins' then
      case p_amount when 500 then 49 when 1200 then 99 when 3000 then 199 else null end
    when p_currency_type = 'gems' then
      case p_amount when 50 then 59 when 120 then 129 when 300 then 299 else null end
    else null
  end;
$$;

create or replace function public.submit_currency_purchase(p_currency_type text, p_amount int, p_method text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_price int; v_id uuid; v_email text; v_name text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_currency_type not in ('coins','gems') then raise exception 'invalid currency type'; end if;
  if p_method not in ('promptpay','alipay','wechat') then raise exception 'invalid method'; end if;

  v_price := public._currency_package_price(p_currency_type, p_amount);
  if v_price is null then raise exception 'invalid package'; end if;

  select email, full_name into v_email, v_name from profiles where id = v_uid;

  insert into public.payments (user_id, email, full_name, plan, amount, method, status, days, kind, currency_type, currency_amount)
    values (v_uid, coalesce(v_email, ''), v_name, 'currency', v_price, p_method, 'pending', 0, 'currency', p_currency_type, p_amount)
    returning id into v_id;

  return jsonb_build_object('id', v_id, 'price', v_price);
end; $$;

-- called by the buyer after uploading a PromptPay/Alipay/WeChat slip (mirrors
-- school_attach_slip / the existing consumer flow's manual-review model)
create or replace function public.attach_currency_purchase_slip(p_id uuid, p_slip_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.payments set slip_path = p_slip_path
    where id = p_id and user_id = auth.uid() and kind = 'currency' and status = 'pending';
  if not found then raise exception 'request not found or not yours'; end if;
end; $$;

-- Approve/reject a pending currency purchase. Approval credits coins/gems ADDITIVELY
-- (never overwrites) and only on the transition out of 'pending', so a request can't
-- be approved twice and double-credit the buyer.
create or replace function public.admin_review_currency_payment(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_tier smallint; v_row public.payments;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 1 then raise exception 'insufficient admin tier'; end if;

  select * into v_row from public.payments where id = p_id and kind = 'currency' and status = 'pending';
  if not found then raise exception 'request not found or already reviewed'; end if;

  if p_approve then
    if v_row.currency_type = 'coins' then
      update public.profiles set coins = coalesce(coins, 0) + v_row.currency_amount where id = v_row.user_id;
    elsif v_row.currency_type = 'gems' then
      update public.profiles set gems = coalesce(gems, 0) + v_row.currency_amount where id = v_row.user_id;
    end if;
    update public.payments set status = 'approved' where id = p_id;
  else
    update public.payments set status = 'rejected' where id = p_id;
  end if;
end; $$;
