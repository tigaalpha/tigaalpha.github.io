-- Gems: a second, rarer currency — deliberately NOT earned from routine play
-- (unlike coins), only from real milestones. v1 has exactly one earn source
-- (Prestige tier-ups) and one spend sink (convert to coins); both are safe to
-- extend later by following the same idempotent-claim-counter pattern.
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run.
--
-- Why gems get STRICTER protection than coins from day one: coins are still
-- written client-side as an absolute value (`profiles.coins = X`), interim-
-- guarded only by the delta-clamp trigger in
-- supabase-security-hardening-migration.sql (which blocks large single
-- INCREASES but not decreases). That was a pragmatic patch on a pre-existing
-- pattern, not a design to repeat. Gems has no client write path at all —
-- every gem balance change goes through a SECURITY DEFINER RPC that
-- independently re-derives the amount from server-side state, and the
-- trigger below rejects 100% of direct client writes, not just large ones.

alter table profiles add column if not exists gems int not null default 0;
alter table profiles add column if not exists gems_prestige_claimed int not null default 0;

create or replace function public._protect_gems_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if NEW.gems is distinct from OLD.gems or NEW.gems_prestige_claimed is distinct from OLD.gems_prestige_claimed then
      raise exception 'gems can only change via grant_gems_for_prestige/spend_gems_for_coins, not a direct write';
    end if;
  end if;
  return NEW;
end; $$;
drop trigger if exists protect_gems_columns on profiles;
create trigger protect_gems_columns
  before update on profiles
  for each row execute function public._protect_gems_columns();
-- (uses the same current_user = 'authenticated' SECURITY DEFINER trick as
-- protect_sensitive_profile_fields in supabase-security-hardening-migration.sql
-- — see that file for why this works without touching any existing RPC.)

create or replace function public._prestige_tier(p_exp int) returns int
language sql immutable as $$
  select case when p_exp >= 5200 then (p_exp - 5200) / 2000 else 0 end; -- mirrors prestigeInfo() in App.tsx
$$;

-- Idempotent: computes the caller's CURRENT prestige tier from their real exp,
-- compares against how many tiers' worth of gems they've already claimed, and
-- only grants the difference. Calling this twice in a row (or 100 times) after
-- the same exp value is a safe no-op the second time onward.
create or replace function public.grant_gems_for_prestige() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_exp int; v_tier int; v_claimed int; v_new_gems int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select exp, gems_prestige_claimed into v_exp, v_claimed from profiles where id = v_uid;
  v_tier := _prestige_tier(coalesce(v_exp, 0));
  if v_tier <= coalesce(v_claimed, 0) then
    return jsonb_build_object('granted', 0, 'tier', v_tier);
  end if;
  v_new_gems := (v_tier - v_claimed) * 5; -- 5 gems per prestige tier
  update profiles set gems = coalesce(gems, 0) + v_new_gems, gems_prestige_claimed = v_tier where id = v_uid;
  return jsonb_build_object('granted', v_new_gems, 'tier', v_tier);
end; $$;

-- Fixed exchange rate, computed server-side — the client never sends a coin
-- amount, only how many gems to spend.
create or replace function public.spend_gems_for_coins(p_gems int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_have int; v_coins int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_gems is null or p_gems <= 0 then raise exception 'invalid amount'; end if;
  select gems into v_have from profiles where id = v_uid;
  if coalesce(v_have, 0) < p_gems then raise exception 'not enough gems'; end if;
  v_coins := p_gems * 25; -- 1 gem = 25 coins
  update profiles set gems = gems - p_gems, coins = coalesce(coins, 0) + v_coins where id = v_uid;
  return jsonb_build_object('spent', p_gems, 'coins', v_coins);
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying:
-- 1. update profiles set exp = 7200 where id = auth.uid(); -- as yourself, simulates 1 prestige tier
-- 2. select grant_gems_for_prestige(); -- should return {granted: 5, tier: 1}
-- 3. select grant_gems_for_prestige(); -- again -> {granted: 0, tier: 1} (idempotent)
-- 4. select spend_gems_for_coins(5);   -- should succeed, coins +125, gems -5
-- 5. select spend_gems_for_coins(999); -- should FAIL ("not enough gems")
-- 6. As non-admin: update profiles set gems = 9999 where id = auth.uid();
--    -> must FAIL with the trigger's exception message
-- ═══════════════════════════════════════════════════════════════════════════
