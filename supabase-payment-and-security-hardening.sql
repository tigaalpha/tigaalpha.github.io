-- ─────────────────────────────────────────────────────────────────────────────
-- Payment fulfilment + security hardening. Already applied to the live project;
-- checked in so the database is described in the repo rather than only in the
-- dashboard. Every statement is idempotent and safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ONE THB PRICE TABLE ─────────────────────────────────────────────────────
-- Must match PLAN_PRICE in payment.tsx and PRICES.thb in the stripe-checkout
-- edge function. These three drifted apart once; this trigger held the copy
-- that never got fixed, so slip-paid Max Family sales were booked at 4919
-- instead of 9999 and Premium at 1499 instead of 1490.
create or replace function public._plan_price_thb(p_plan text)
returns integer language sql immutable set search_path = public as $$
  select case p_plan
    when 'premium'   then 1490
    when 'family'    then 2900
    when 'max'       then 3999
    when 'maxfamily' then 9999
    else null
  end;
$$;

-- 2. IDEMPOTENT CARD FULFILMENT ──────────────────────────────────────────────
-- The Stripe webhook and the app's verify-on-return call both run these. They
-- key off the Checkout Session id and no-op the second time, so whichever
-- arrives first does the work. EXECUTE is service_role only: they credit money
-- and extend paid plans, so no signed-in user may call them directly.
create or replace function public.fulfill_plan_purchase(
  p_uid uuid, p_plan text, p_days integer, p_amount integer, p_ref text, p_email text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing uuid;
begin
  if p_uid is null or coalesce(p_ref, '') = '' then raise exception 'uid and ref required'; end if;
  if public._plan_price_thb(p_plan) is null then raise exception 'unknown plan %', p_plan; end if;

  select id into v_existing from public.payments where note = p_ref limit 1;
  if found then return jsonb_build_object('status', 'already', 'payment_id', v_existing); end if;

  -- Stacks onto whatever is left rather than replacing it, so paying again
  -- part-way through a month adds to the remaining time.
  update public.profiles
     set plan = p_plan,
         plan_until = greatest(coalesce(plan_until, now()), now()) + (p_days || ' days')::interval,
         updated_at = now()
   where id = p_uid;

  insert into public.payments (user_id, email, plan, amount, days, method, status, note, reviewed_at)
    values (p_uid, p_email, p_plan, p_amount, p_days, 'stripe', 'approved', p_ref, now())
    returning id into v_existing;

  return jsonb_build_object('status', 'fulfilled', 'payment_id', v_existing, 'plan', p_plan, 'days', p_days);
end;
$$;

create or replace function public.fulfill_currency_purchase(p_id uuid, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.payments;
begin
  select * into v_row from public.payments where id = p_id and kind = 'currency';
  if not found then raise exception 'currency purchase not found'; end if;
  if v_row.status = 'approved' then
    return jsonb_build_object('status', 'already', 'currency_type', v_row.currency_type, 'amount', v_row.currency_amount);
  end if;
  if v_row.status <> 'pending' then raise exception 'purchase is %', v_row.status; end if;

  if v_row.currency_type = 'coins' then
    update public.profiles set coins = coalesce(coins, 0) + v_row.currency_amount where id = v_row.user_id;
  elsif v_row.currency_type = 'gems' then
    update public.profiles set gems = coalesce(gems, 0) + v_row.currency_amount where id = v_row.user_id;
  else
    raise exception 'unknown currency type %', v_row.currency_type;
  end if;

  update public.payments set status = 'approved', note = p_ref, reviewed_at = now() where id = p_id;
  return jsonb_build_object('status', 'fulfilled', 'currency_type', v_row.currency_type, 'amount', v_row.currency_amount);
end;
$$;

revoke all on function public.fulfill_plan_purchase(uuid, text, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.fulfill_currency_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.fulfill_plan_purchase(uuid, text, integer, integer, text, text) to service_role;
grant execute on function public.fulfill_currency_purchase(uuid, text) to service_role;

-- 3. LET SERVICE-SIDE FULFILMENT GRANT A PLAN ────────────────────────────────
-- This trigger reverts plan/plan_until unless the caller is an app admin, which
-- is right for a signed-in user editing their own row. But PostgREST DOES set
-- request.jwt.claims for a service-key request (role service_role, no sub), so
-- is_app_admin() was false and the write was silently reverted — the exact path
-- every Stripe sale runs through. The charge succeeded, the receipt row was
-- written, and the plan quietly stayed 'free'. Slip approvals were unaffected
-- because those run under a real admin's JWT, which is why it went unnoticed.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare claims jsonb;
begin
  if current_setting('request.jwt.claims', true) is null then
    return new;   -- raw DB session (dashboard/migrations), not a PostgREST call
  end if;

  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  if (claims ->> 'role') = 'service_role' then
    return new;   -- stripe-webhook / verify-stripe-payment fulfilment
  end if;

  if tg_op = 'INSERT' then
    if not public.is_app_admin() then
      new.is_admin := false; new.plan := 'free'; new.plan_until := null; new.banned := false;
    end if;
    return new;
  end if;

  if not public.is_app_admin() then
    if new.is_admin   is distinct from old.is_admin   then new.is_admin   := old.is_admin;   end if;
    if new.plan       is distinct from old.plan       then new.plan       := old.plan;       end if;
    if new.plan_until is distinct from old.plan_until then new.plan_until := old.plan_until; end if;
    if new.banned     is distinct from old.banned     then new.banned     := old.banned;     end if;
  end if;
  return new;
end;
$$;

-- 4. CLOSE THE TABLES THAT HAD RLS OFF ───────────────────────────────────────
-- Both sat in public with RLS off AND select/insert/update granted to anon —
-- and the anon key ships in the client bundle. ai_rate_limits is the one that
-- mattered: anyone could rewrite the rate-limit counters, i.e. run up the AI
-- bill. Neither is used by this project (they belong to tiga-ai-bos), and
-- service_role bypasses RLS, so any server-side writer is unaffected.
alter table public.ai_rate_limits enable row level security;
alter table public.system_events  enable row level security;
revoke all on public.ai_rate_limits from anon, authenticated;
revoke all on public.system_events  from anon, authenticated;

-- 5. UNGUARDED SECURITY DEFINER FUNCTIONS ────────────────────────────────────
-- cleanup_old_usage_events() is a bare DELETE on usage_events, and
-- increment_rate_limit() takes the user id as an argument, so anyone could burn
-- through someone else's AI quota. Neither had any check inside; neither is
-- called by this app. Every other definer function the advisor flags carries
-- its own guard (is_app_admin / admin_tier / is_school_teacher / auth.uid()),
-- so those keep their grants — blanket-revoking would break the app for nothing.
revoke execute on function public.cleanup_old_usage_events() from anon, authenticated, public;
revoke execute on function public.increment_rate_limit(uuid, text, integer) from anon, authenticated, public;
grant execute on function public.cleanup_old_usage_events() to service_role;
grant execute on function public.increment_rate_limit(uuid, text, integer) to service_role;

-- 6. PIN search_path ON THE PERMISSION HELPERS ───────────────────────────────
-- Both answer "is this caller allowed to do admin things?" while resolving
-- `profiles` through whatever search_path the caller happens to have.
create or replace function public.is_owner_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and (is_admin = true or school_role in ('owner', 'admin'))
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;
