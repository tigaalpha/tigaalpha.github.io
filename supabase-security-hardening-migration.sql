-- Security hardening for the PRE-EXISTING profiles table + admin_list_students.
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review AND
-- the manual testing steps at the bottom. Safe to re-run.
--
-- Context: a security audit found that App.tsx writes many `profiles` columns
-- (exp, coins, streak, lessons_done, quest fields, contact info) via plain
-- `sb.from("profiles").update(...)` calls, which only works if that table's RLS
-- UPDATE policy allows it. The concern: if that policy is a simple
-- `USING (auth.uid() = id)` with no per-column restriction (the client code gives
-- no way to confirm or rule this out — this repo has no copy of the current RLS),
-- then the SAME call shape also lets a user write admin_tier/is_admin/plan/
-- plan_until/banned on their own row directly — a full admin + lifetime-plan
-- takeover with one request, no RPC bug needed at all.
--
-- This migration does NOT touch or replace any existing table, policy, or
-- function — it only ADDS two new triggers. That's deliberate: I do not have the
-- current source of profiles' RLS policies or of admin_set_plan/admin_set_ban/
-- admin_appoint (created directly via the SQL editor in earlier sessions, not in
-- this repo), so rewriting any of them blind risked either failing to close the
-- hole (if I guessed the policy shape wrong) or breaking a currently-working
-- staff tool (if I guessed an RPC's internals wrong). A trigger is additive and
-- independently enforced by Postgres regardless of what the existing RLS policy
-- says, so it's safe to add without knowing that policy's current shape.

-- ── 1. Block direct client writes to admin/plan/ban columns ──────────────────
-- Distinguishes "a client called sb.from('profiles').update(...) directly" from
-- "this write is happening inside a SECURITY DEFINER admin RPC" using
-- current_user, NOT a custom config flag — Postgres itself sets current_user to
-- the function's OWNER (not 'authenticated') for the duration of any SECURITY
-- DEFINER function call, regardless of who invoked it. That means this works
-- WITHOUT modifying admin_set_plan/admin_set_ban/admin_appoint at all, as long as
-- those three are declared SECURITY DEFINER (true of every other admin RPC in
-- this codebase I've seen or written — near-certain here too, but see the
-- required manual test at the bottom before relying on this).
create or replace function public._protect_sensitive_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if NEW.admin_tier is distinct from OLD.admin_tier
      or NEW.is_admin is distinct from OLD.is_admin
      or NEW.plan is distinct from OLD.plan
      or NEW.plan_until is distinct from OLD.plan_until
      or NEW.banned is distinct from OLD.banned
    then
      raise exception 'admin_tier/is_admin/plan/plan_until/banned can only be changed by an admin action, not directly';
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists protect_sensitive_profile_fields on profiles;
create trigger protect_sensitive_profile_fields
  before update on profiles
  for each row execute function public._protect_sensitive_profile_fields();

-- ── 2. Clamp implausible single-update jumps in exp/coins ────────────────────
-- exp/coins are written client-side as absolute values with no server
-- recomputation anywhere in this app (confirmed: `sb.from("profiles").update({exp:
-- X})`/`{coins: Y}` at several call sites, all client-computed). A real fix is
-- moving reward grants to a delta-based server RPC — too large a change to make
-- blind here. This is a cheap interim guard: real single actions in this app
-- grant on the order of 10s-100s of exp/coins, so a jump of +100,000 in one
-- UPDATE is never legitimate and almost certainly forged (e.g. the confirmed
-- `localStorage.setItem` → coin-merge-on-login path, or a direct profiles.update
-- call). Only increases are clamped — spending (coins going down) is untouched,
-- so real shop purchases still work at any price.
create or replace function public._clamp_reward_field_deltas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if NEW.exp is distinct from OLD.exp and coalesce(NEW.exp, 0) - coalesce(OLD.exp, 0) > 100000 then
      raise exception 'exp increase too large for a single update (got +%), rejected as implausible', coalesce(NEW.exp,0) - coalesce(OLD.exp,0);
    end if;
    if NEW.coins is distinct from OLD.coins and coalesce(NEW.coins, 0) - coalesce(OLD.coins, 0) > 100000 then
      raise exception 'coins increase too large for a single update (got +%), rejected as implausible', coalesce(NEW.coins,0) - coalesce(OLD.coins,0);
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists clamp_reward_field_deltas on profiles;
create trigger clamp_reward_field_deltas
  before update on profiles
  for each row execute function public._clamp_reward_field_deltas();

-- ── 3. admin_list_students_v2 — bounded, searchable replacement ──────────────
-- The existing admin_list_students() (not in this repo) has no LIMIT and its
-- authorization check can't be confirmed from here. Rather than replace it blind
-- (risking breaking the currently-working Students admin tab if I guess its
-- return shape or auth logic wrong), this adds a NEW function alongside it —
-- admin_list_students() is untouched and still works exactly as it does today.
-- App.tsx's AdminStudents has been switched to call this one instead (see the
-- commit that includes this file). Column shape matches exactly what
-- AdminStudents already reads from the old function's result.
create or replace function public.admin_list_students_v2(p_search text default null, p_limit int default 200, p_offset int default 0)
returns table(
  id uuid, full_name text, email text, admin_tier smallint, banned boolean,
  plan text, plan_until timestamptz, exp int, lessons_done int, streak int,
  last_active date, progress jsonb
)
language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select p.admin_tier into v_tier from profiles p where p.id = auth.uid();
  if coalesce(v_tier, 0) < 1 then raise exception 'insufficient admin tier'; end if;
  return query
    select p.id, p.full_name, p.email, p.admin_tier, p.banned, p.plan, p.plan_until,
      p.exp, p.lessons_done, p.streak, p.last_active, p.progress
    from profiles p
    where p_search is null or trim(p_search) = ''
      or p.full_name ilike '%' || trim(p_search) || '%'
      or p.email ilike '%' || trim(p_search) || '%'
    order by p.last_active desc nulls last, p.exp desc
    limit least(coalesce(p_limit, 200), 500)
    offset greatest(coalesce(p_offset, 0), 0);
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- REQUIRED MANUAL TEST — do this BEFORE trusting the trigger in section 1, and
-- again right after applying it, in this exact order:
--
-- 1. From a NON-admin test account (or via the SQL editor `set role authenticated;
--    set request.jwt.claims = '{"sub":"<a non-admin user's uuid>"}';`), attempt:
--      update profiles set admin_tier = 3 where id = auth.uid();
--    BEFORE this migration: if that succeeds, the hole described above is real
--    and live right now. AFTER this migration: it must fail with the trigger's
--    exception message. If it still succeeds after applying, the trigger isn't
--    catching the actual write path in use — stop and investigate rather than
--    assuming it's fixed.
-- 2. As a real admin, through the actual app UI (not raw SQL), exercise every
--    admin action that touches these columns: change a user's plan (Students
--    tab → set/change plan), suspend a plan, ban/unban a user, appoint/re-tier
--    an admin. Every one of these must still work exactly as before. If ANY of
--    them starts failing with this migration's exception message, it means
--    admin_set_plan/admin_set_ban/admin_appoint is NOT declared SECURITY
--    DEFINER (or is owned by a role Postgres also treats as 'authenticated') —
--    in that case, DROP TRIGGER protect_sensitive_profile_fields ON profiles;
--    immediately to restore staff access, then come back for a different fix
--    (the RPCs themselves would need to be made SECURITY DEFINER, which is a
--    change to functions whose current source isn't available here).
-- ═══════════════════════════════════════════════════════════════════════════
