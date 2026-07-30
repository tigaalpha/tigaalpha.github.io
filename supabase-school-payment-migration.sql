-- School Plan Pro: B2B payment requests (Stripe / PromptPay / Alipay / WeChat)
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run: every object uses if-not-exists / or-replace / drop-if-exists.
--
-- Deliberately additive only — does NOT touch the existing `payments` table or its
-- (undocumented-in-this-repo) admin_review_payment RPC, to avoid any risk of breaking
-- the live consumer checkout flow. This is a fully separate table + RPC set for B2B.
--
-- The buyer-submitted amount is NEVER trusted — school_submit_payment_request()
-- computes it server-side from _school_b2b_unit_price(), which duplicates the exact
-- math of b2bPriceByCur()/b2bYearPriceByCur() in App.tsx (THB only — Stripe charges
-- in THB regardless of the buyer's display currency, same convention the existing
-- `payments` table already uses for slip records). If PLAN_PRICE.premium/max or the
-- 1.15x B2B multiplier ever changes in App.tsx, update the literals below to match.

create table if not exists school_payment_requests (
  id                 uuid primary key default uuid_generate_v4(),
  requester_id       uuid not null references auth.users (id) on delete cascade,
  institution_name   text not null,
  contact_email      text not null,
  tier               text not null check (tier in ('school_standard','school_plus')),
  seats              int  not null check (seats >= 15),
  cycle              text not null check (cycle in ('month','year')),
  amount             numeric not null,   -- THB, server-computed
  method             text not null check (method in ('stripe','promptpay','alipay','wechat')),
  slip_path          text,
  stripe_session_id  text,
  status             text not null default 'pending' check (status in ('pending','paid','approved','rejected')),
  created_at         timestamptz not null default now(),
  reviewed_at        timestamptz,
  reviewed_by        uuid references auth.users (id),
  fulfilled_at       timestamptz,   -- set once staff has actually run admin_create_school for this
  fulfilled_by       uuid references auth.users (id)
);
create index if not exists school_payment_requests_status_idx on school_payment_requests (status, created_at desc);

alter table school_payment_requests enable row level security;

drop policy if exists "school_payment_requests: self select" on school_payment_requests;
create policy "school_payment_requests: self select" on school_payment_requests for select
  using (requester_id = auth.uid());
drop policy if exists "school_payment_requests: staff select" on school_payment_requests;
create policy "school_payment_requests: staff select" on school_payment_requests for select
  using (exists (select 1 from profiles where id = auth.uid() and admin_tier > 0));
-- no client insert/update policy at all — every write goes through a SECURITY DEFINER
-- RPC below, or through the edge functions (which use the service-role key and bypass
-- RLS entirely for the Stripe verification step)

create or replace function public._school_b2b_unit_price(p_tier text, p_cycle text) returns numeric
language sql immutable set search_path = public as $$
  select case
    when p_cycle = 'year' then
      case when p_tier = 'school_plus'
        then ceil(round(3999 * 12 * 0.97) * 1.15 / 10) * 10
        else ceil(round(1490 * 12 * 0.97) * 1.15 / 10) * 10
      end
    else
      case when p_tier = 'school_plus' then ceil(3999 * 1.15 / 10) * 10 else ceil(1490 * 1.15 / 10) * 10 end
  end;
$$;

create or replace function public.school_submit_payment_request(
  p_institution_name text, p_tier text, p_seats int, p_cycle text, p_method text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_amount numeric; v_id uuid; v_email text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_tier not in ('school_standard','school_plus') then raise exception 'invalid tier'; end if;
  if p_cycle not in ('month','year') then raise exception 'invalid cycle'; end if;
  if p_method not in ('stripe','promptpay','alipay','wechat') then raise exception 'invalid method'; end if;
  if coalesce(p_seats, 0) < 15 then raise exception 'minimum 15 seats'; end if;
  if coalesce(trim(p_institution_name), '') = '' then raise exception 'institution name required'; end if;

  select email into v_email from profiles where id = v_uid;
  v_amount := _school_b2b_unit_price(p_tier, p_cycle) * p_seats;

  insert into school_payment_requests (requester_id, institution_name, contact_email, tier, seats, cycle, amount, method)
    values (v_uid, trim(p_institution_name), coalesce(v_email, ''), p_tier, p_seats, p_cycle, v_amount, p_method)
    returning id into v_id;

  return jsonb_build_object('id', v_id, 'amount', v_amount);
end; $$;

-- called by the buyer after uploading a PromptPay/Alipay/WeChat slip (mirrors the
-- existing consumer flow's manual-review model — no automated verification for these
-- three channels exists anywhere in this app, this is not a new limitation)
create or replace function public.school_attach_slip(p_id uuid, p_slip_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update school_payment_requests set slip_path = p_slip_path
    where id = p_id and requester_id = auth.uid() and status = 'pending';
end; $$;

create or replace function public.admin_list_school_payment_requests()
returns setof school_payment_requests
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 1 then raise exception 'insufficient admin tier'; end if;
  -- defensive cap, not real pagination — see admin_list_schools() for the same note.
  -- The client additionally filters this down to non-fulfilled/non-rejected rows, so
  -- in practice the visible "needs attention" list stays small regardless; this limit
  -- only guards the raw query itself against unbounded growth of the underlying table.
  return query select * from school_payment_requests order by created_at desc limit 500;
end; $$;

-- Approve/reject only — deliberately does NOT auto-create the school. A human staffer
-- still runs admin_create_school (existing "Schools" admin tab) using this request's
-- details as reference, same as every other manual-review payment channel in this app.
-- Real money + 15+ paid seats warrants a second deliberate look before provisioning,
-- not full automation, even after payment is confirmed.
create or replace function public.admin_review_school_payment(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 3 then raise exception 'insufficient admin tier'; end if;
  update school_payment_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_id;
end; $$;

-- Marks a payment request as actually provisioned. Called by the client right after
-- admin_create_school succeeds for a request that was opened via "Approve" (which
-- pre-fills the create-school form but does not create anything itself). Without this,
-- an approved-but-not-yet-created request looks identical to an approved-and-already-
-- created one in the admin list, risking either a forgotten school (customer paid,
-- never provisioned) or a duplicate one (staff re-runs Create by mistake).
create or replace function public.admin_mark_school_payment_fulfilled(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 3 then raise exception 'insufficient admin tier'; end if;
  update school_payment_requests set fulfilled_at = now(), fulfilled_by = auth.uid() where id = p_id;
end; $$;
