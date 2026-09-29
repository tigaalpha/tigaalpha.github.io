-- ─────────────────────────────────────────────────────────────────────────────
-- Close in-game currency top-ups (Coins/Gems bought with real money)
--
-- STATUS: APPLIED 2026-09-25 on project gsaqgbracxnucdmtmcxz with the owner's
-- explicit approval (AGENTS.md hard rule). Verified right after: the RPC
-- raises 'currency top-ups are closed'; a signed-in insert of a valid
-- kind='currency' row fails RLS (42501); a kind='plan' insert passes RLS.
--
-- Owner decision 2026-09-25: TIGA no longer sells Coins or Gems for real money
-- (legal risk). The app no longer shows any top-up UI; this file closes the
-- server side too, so an old cached app or a hand-made request cannot start one:
--   * submit_currency_purchase() and attach_currency_purchase_slip() refuse.
--     Both the slip path and the Stripe path begin with submit_currency_purchase(),
--     and the currency-stripe-checkout edge function only charges for a pending
--     payments row of kind 'currency', so closing the function closes Stripe too.
--   * payments_insert_own let a signed-in user insert their own payments row
--     with ANY kind, i.e. a hand-made pending kind='currency' row that
--     currency-stripe-checkout would then charge for. The policy now refuses
--     kind = 'currency'. Plan payments (kind 'plan' / null) are unchanged.
-- Left alone on purpose: admin_review_currency_payment() (the one historical
-- approved purchase stays reviewable), Premium and School Plan payments, and
-- the free Gems/Coins rewards (Practice Mode, quiz, Prestige, notification event).
-- Re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.submit_currency_purchase(p_currency_type text, p_amount integer, p_method text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'currency top-ups are closed' using errcode = 'P0001';
end;
$$;

create or replace function public.attach_currency_purchase_slip(p_id uuid, p_slip_path text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'currency top-ups are closed' using errcode = 'P0001';
end;
$$;

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_own on public.payments
  for insert to authenticated
  with check (auth.uid() = user_id and kind is distinct from 'currency');

-- ── Verify after applying ──
-- 1. select public.submit_currency_purchase('gems', 50, 'promptpay');  → ERROR: currency top-ups are closed
-- 2. As a signed-in user: insert into payments (user_id, kind, amount, status)
--    values (auth.uid(), 'currency', 59, 'pending');                    → RLS violation
-- 3. Premium checkout (kind 'plan') still inserts as before.
