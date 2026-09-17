-- ─────────────────────────────────────────────────────────────────────────────
-- TIGA Piano Intelligence — Teaching Outcome Dataset (Phase 1, spec §24)
--
-- STATUS: WRITTEN, NOT YET APPLIED — needs the owner's explicit per-migration
-- approval (AGENTS.md hard rule) before running on project gsaqgbracxnucdmtmcxz.
--
-- Why: the spec's most valuable asset is the proprietary dataset of
--   "which teaching strategy, for which kind of student problem, in which
--    situation, actually worked." Nothing in the current schema records
--    strategy → response → measured outcome. This table is that record.
--
-- Design:
--   * additive only (create table if not exists) — re-runnable, touches nothing
--   * client may INSERT own rows only (RLS: auth.uid() = student_id) and may
--     never UPDATE (append-only, like usage_events) — no writable score field
--   * effectiveness_score is set later by server-side analysis, not by the
--     client (no client-writable absolute values — repo hard rule)
--   * ai_runs are admin-visible only via the existing is_top_admin() family
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.teaching_outcomes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  session_id text,
  trace_id text,
  strategy_id text not null,
  actions jsonb not null default '[]'::jsonb,
  initial_states jsonb not null default '[]'::jsonb,   -- probability+evidence snapshots
  signals jsonb,                                        -- practice stats that drove the decision
  self_report text,
  message_shown text,
  performance_before numeric,
  performance_after numeric,
  outcome text,                                         -- 'improved' | 'worse' | 'same' | 'abandoned'
  effectiveness_score numeric,                          -- SERVER-computed only, null until analysis
  confidence numeric,
  created_at timestamptz not null default now()
);

create index if not exists teaching_outcomes_strategy_idx
  on public.teaching_outcomes (strategy_id, created_at desc);
create index if not exists teaching_outcomes_student_idx
  on public.teaching_outcomes (student_id, created_at desc);

-- Append-only: insert own rows; never update/delete.
alter table public.teaching_outcomes enable row level security;

drop policy if exists teaching_outcomes_insert_own on public.teaching_outcomes;
create policy teaching_outcomes_insert_own on public.teaching_outcomes
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists teaching_outcomes_no_update on public.teaching_outcomes;
create policy teaching_outcomes_no_update on public.teaching_outcomes
  for update to authenticated
  using (false);

-- Server-side scoring: strategy effectiveness aggregated across students.
-- Called by scheduled analysis (P1b) — gated to top admin like the analytics family.
create or replace function public.admin_strategy_effectiveness(p_since timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'strategy_id', t.strategy_id,
      'n', t.n,
      'avg_before', t.avg_before,
      'avg_after', t.avg_after,
      'delta', t.avg_after - t.avg_before,
      'improved', t.improved))
    from (
      select strategy_id,
             count(*) as n,
             avg(performance_before) as avg_before,
             avg(performance_after) as avg_after,
             count(*) filter (where outcome = 'improved') as improved
      from public.teaching_outcomes
      where (p_since is null or created_at >= p_since)
        and performance_before is not null and performance_after is not null
      group by strategy_id
      order by count(*) desc
    ) t), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_strategy_effectiveness(timestamptz) from public, anon;
grant execute on function public.admin_strategy_effectiveness(timestamptz) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying:
-- 1. As a signed-in user: insert a row with student_id = own uid → succeeds.
-- 2. insert with another user's uid → RLS rejects.
-- 3. update any row → rejected (append-only).
-- 4. As top admin: select public.admin_strategy_effectiveness(null); → jsonb.
--    As a non-admin: same call must FAIL.
-- ═══════════════════════════════════════════════════════════════════════════
