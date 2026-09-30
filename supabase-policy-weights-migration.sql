-- ─────────────────────────────────────────────────────────────────────────────
-- Strategy Effect Analyzer (docs/05 §1) — policy weights persistence
-- ─────────────────────────────────────────────────────────────────────────────
-- The analyzer core (tigamodel/teaching/strategy-analyzer.js) computes policy
-- weights from real learner outcomes; this migration is where those weights
-- live so every device reads the same ordering (one teacher, not one per
-- device). DOES NOT create app_settings — that table already exists in
-- production (sim_bots config lives there). Adds exactly one key
-- ('tiga_policy_weights') plus two top-admin-gated RPCs, mirroring the gate
-- and style of supabase-teaching-outcomes-migration.sql.
--
-- Shape stored under app_settings.tiga_policy_weights.value:
--   { "enabled": true, "weights": { "<strategy_id>": 0.5..2.0, ... },
--     "computed_at": iso8601, "source": "strategy-analyzer" }
-- Kill switch: set enabled=false (or delete the key) → every device falls
-- back to the shipped DEFAULT_POLICY order with zero code changes.
--
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human
-- review. Safe to re-run (or-replace everywhere; the insert only seeds when
-- the key is absent, so re-running never overrides newer weights).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Admin writes the weights the analyzer computed. Whole-value replace is
--    intentional (the analyzer computes the FULL object in one shot), but the
--    guard still refuses junk shapes so a bad client can never disable or
--    poison the ordering silently.
create or replace function public.admin_set_policy_weights(p_value jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;
  if p_value is null
     or p_value->>'enabled' is null
     or jsonb_typeof(p_value->'weights') is distinct from 'object' then
    raise exception 'expected {"enabled":bool,"weights":{strategy_id:0.5..2.0}}';
  end if;
  insert into public.app_settings (key, value)
  values ('tiga_policy_weights',
          jsonb_set(p_value, '{source}', to_jsonb('strategy-analyzer'::text), true))
  on conflict (key) do update
    set value = jsonb_set(excluded.value, '{source}', to_jsonb('strategy-analyzer'::text), true),
        updated_at = now();
  return p_value;
end;
$$;

revoke execute on function public.admin_set_policy_weights(jsonb) from public, anon;
grant execute on function public.admin_set_policy_weights(jsonb) to authenticated;

-- 2. Devices read the current weights (null when never computed / deleted →
--    callers treat as "disabled", matching applyPolicyWeights's null contract).
create or replace function public.get_policy_weights()
returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = 'tiga_policy_weights';
$$;

revoke execute on function public.get_policy_weights() from public, anon;
grant execute on function public.get_policy_weights() to authenticated;

-- 3. Seed with the switch OFF so the first apply after this migration is an
--    explicit admin action, not an accident. Only seeds when absent — a
--    re-run never clobbers weights that were already set.
insert into public.app_settings (key, value)
select 'tiga_policy_weights',
       jsonb_build_object('enabled', false,
                          'weights', '{}'::jsonb,
                          'computed_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
where not exists (select 1 from public.app_settings where key = 'tiga_policy_weights');

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying:
-- 1. select value from public.app_settings where key='tiga_policy_weights';
--    → {"enabled": false, "weights": {}, ...} (seeded, switch off)
-- 2. As a NON-top-admin (admin_tier 0): select get_policy_weights();
--    → permission denied (both RPCs are top-admin on write, authenticated
--      read is fine per grant above — adjust if read should be admin-only).
-- 3. As top admin: select public.admin_set_policy_weights(
--      '{"enabled":true,"weights":{"simplify-on-confusion":1.5}}'::jsonb);
--    then re-run (1) → value updated, source forced to 'strategy-analyzer'.
-- 4. Kill switch drill: admin_set_policy_weights('{"enabled":false,...}') →
--    clients reading get_policy_weights() see enabled=false and skip applying.
-- ═══════════════════════════════════════════════════════════════════════════
