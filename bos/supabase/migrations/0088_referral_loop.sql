-- ═══════════════════════════════════════════════════════════════════════════
-- Referral loop: make code-based referral attribution actually work end to end.
--
-- Migration 0077 created the referrals table, customers.referral_code, and the
-- payment-time reward reminder, but nothing ever SET referred_customer_id —
-- the web-chat lead form and the LINE AI both had no way to accept a referral
-- code, so a shared code could never be linked to the friend who arrived with
-- it. This migration adds the missing pieces:
--
--   1. referrals.referred_name / referrals.referred_phone  — captured from the
--      web widget / LINE even before the friend becomes a full customer row,
--      so attribution is never lost.
--   2. customers.acquired_via_referral_code  — the code the lead came in with,
--      stamped at lead-creation time (cheap per-customer display + audit).
--   3. One attribute function: public.apply_referral_code() — resolves a code
--      to its referrer, attaches the referred customer, and notifies the owner.
--      Shared by web-chat (widget lead form / ?ref= URL) and the LINE AI tool,
--      so both surfaces behave identically. Safe to call twice: re-calling with
--      the same code is a no-op.
--   4. public.referral_stats() — one RPC for the Referral Tracking page so the
--      dashboard reads REAL table data (previously it regex-scraped customer
--      notes and lead_source strings, which never matched reality).
--
-- Run in Supabase SQL Editor AFTER human review (project gsaqgbracxnucdmtmcxz).
-- Safe to re-run: everything is if-not-exists / or-replace / drop-if-exists-
-- then-create. No existing rows are modified; the partial unique index only
-- constrains FUTURE rows. The payments.ts reward hook needs NO change: it
-- fires on referrals.referred_customer_id + reward_granted=false, which this
-- function now actually populates.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.referrals add column if not exists referred_name text;
alter table public.referrals add column if not exists referred_phone text;
alter table public.customers add column if not exists acquired_via_referral_code text;

-- 0077 made referrals.referral_code table-level UNIQUE, which caps every code
-- at ONE referred friend ever. Codes are multi-use — one happy customer can
-- bring several friends, each rewarded separately by the payments.ts hook — so
-- the table-level unique goes, replaced by "one referral row per referred
-- CUSTOMER" (partial unique index below) and the per-code dedupe inside
-- apply_referral_code().
alter table public.referrals drop constraint if exists referrals_referral_code_key;

-- One referral row per referred customer — re-calling apply_referral_code with
-- the same customer is a no-op, not a duplicate (and a lead can't be claimed
-- by two different referrers' codes).
drop index if exists referrals_referred_customer_uniq;
create unique index if not exists referrals_referred_customer_uniq
  on public.referrals (referred_customer_id)
  where referred_customer_id is not null;

create index if not exists referrals_code_idx on public.referrals (referral_code, created_at desc);

create or replace function public.apply_referral_code(
  p_referral_code text,
  p_referred_customer_id uuid,
  p_referred_name text default null,
  p_referred_phone text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(p_referral_code));
  v_referrer uuid;
  v_referral_id uuid;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_code');
  end if;
  if p_referred_customer_id is null and coalesce(p_referred_name, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'name_required');
  end if;

  -- The referrer is whoever owns the code (customers.referral_code, created by
  -- the owner/AI via create_referral_link).
  select c.id into v_referrer
    from public.customers c
    where upper(c.referral_code) = v_code
    limit 1;
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  -- Existing customer paying it forward? Don't let them self-refer.
  if p_referred_customer_id is not null and p_referred_customer_id = v_referrer then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  -- Already attributed? Idempotent per (code, referred customer) pair — codes
  -- are MULTI-USE (one referrer can bring several friends, each rewarded
  -- separately by the payments.ts hook), but the same friend twice is a no-op
  -- (widget retries / AI double-calls). Name-only capture dedupes the same way
  -- on the name so a visitor re-submitting the form doesn't stack rows.
  if p_referred_customer_id is not null then
    select id into v_referral_id
      from public.referrals
      where referral_code = v_code and referred_customer_id = p_referred_customer_id
      limit 1;
    if v_referral_id is not null then
      return jsonb_build_object('ok', true, 'referral_id', v_referral_id, 'status', 'already');
    end if;
  else
    select id into v_referral_id
      from public.referrals
      where referral_code = v_code
        and referred_customer_id is null
        and referred_name = p_referred_name
      limit 1;
    if v_referral_id is not null then
      return jsonb_build_object('ok', true, 'referral_id', v_referral_id, 'status', 'already');
    end if;
  end if;

  insert into public.referrals (referral_code, referrer_customer_id, referred_customer_id, referred_name, referred_phone)
  values (v_code, v_referrer, p_referred_customer_id, p_referred_name, p_referred_phone)
  on conflict (referred_customer_id) where referred_customer_id is not null do nothing
  returning id into v_referral_id;

  -- Null returning id here can only mean the per-referred-customer unique
  -- index swallowed the insert (a concurrent attribution of the SAME customer
  -- won the race) — so it is the 'already' case, not a failure.
  if v_referral_id is null and p_referred_customer_id is not null then
    select id into v_referral_id
      from public.referrals
      where referral_code = v_code and referred_customer_id = p_referred_customer_id
      limit 1;
    return jsonb_build_object('ok', v_referral_id is not null, 'referral_id', v_referral_id, 'status', 'already');
  end if;

  -- Stamp the lead's acquisition code (per-customer audit/display).
  if p_referred_customer_id is not null then
    update public.customers
      set acquired_via_referral_code = v_code
      where id = p_referred_customer_id and acquired_via_referral_code is null;
  end if;

  -- Owner notification (type referral_created — added to the enum in 0077).
  -- Only for genuinely new attributions, never for idempotent no-ops.
  insert into public.notifications (type, title, body, customer_id)
  values (
    'referral_created',
    'ได้ลูกค้าใหม่จากรีเฟอรัล 🎁',
    case
      when p_referred_name is not null and p_referred_name <> ''
        then 'โค้ด ' || v_code || ' — ลูกค้าใหม่: ' || p_referred_name
      else 'โค้ด ' || v_code || ' ถูกใช้แล้ว'
    end,
    v_referrer
  );

  return jsonb_build_object('ok', true, 'referral_id', v_referral_id, 'status', 'created');
end;
$$;

-- Read model for the Referral Tracking page: everything the dashboard shows,
-- computed from the referrals table in one round trip. Staff-readable (RLS on
-- referrals already restricts to staff; this SECURITY DEFINER view would
-- otherwise bypass it, so re-check is_staff() explicitly).
create or replace function public.referral_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_staff() then null else
    (
      with r as (
        select
          ref.id,
          ref.referral_code,
          ref.referrer_customer_id,
          ref.referred_customer_id,
          ref.referred_name,
          ref.referred_phone,
          ref.reward_granted,
          ref.created_at,
          rc.name as referrer_name,
          rc.phone as referrer_phone,
          referred_c.sales_status as referred_sales_status
        from public.referrals ref
        left join public.customers rc on rc.id = ref.referrer_customer_id
        left join public.customers referred_c on referred_c.id = ref.referred_customer_id
      )
      select jsonb_build_object(
        'referrals', coalesce(jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'code', r.referral_code,
            'referrerName', coalesce(r.referrer_name, '—'),
            'referrerPhone', r.referrer_phone,
            'referredName', coalesce(r.referred_name, referred_c.name, 'ลูกค้าใหม่'),
            'referredPhone', r.referred_phone,
            'status', case
              when r.referred_customer_id is null then 'code_shared'
              when r.reward_granted then 'rewarded'
              when r.referred_sales_status = 'won' then 'converted'
              when r.referred_sales_status in ('trial_booked', 'trial_completed') then 'trial'
              else 'pending'
            end,
            'createdAt', r.created_at
          ) order by r.created_at desc
        ), '[]'::jsonb),
        'totals', (
          select jsonb_build_object(
            'total', count(*),
            'attributed', count(r.referred_customer_id),
            'converted', count(*) filter (where r.referred_sales_status = 'won'),
            'rewardsPending', count(*) filter (where r.referred_customer_id is not null and r.referred_sales_status = 'won' and not r.reward_granted)
          )
          from r
        )
      )
      from r
    )
  end
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying:
-- 1. select upper(referral_code), count(*) from public.customers
--      where referral_code is not null group by 1;        -- codes exist?
-- 2. As staff: select public.referral_stats();            -- shape check
--    As anon:  select public.referral_stats();            -- must be NULL
-- 3. select public.apply_referral_code('TIGAXXX', null, 'ทดสอบ', '0800000000');
--    -> {"ok": true, ...} then check referrals row + notification created.
--    Re-run the same call -> {"status": "already"} (name dedupe).
-- 4. Multi-use check: attribute TWO different customers with the same code —
--    both must succeed (one referrer can bring several friends), while the
--    same customer twice must stay a no-op.
-- ═══════════════════════════════════════════════════════════════════════════
