-- Strategy outcomes: cross-device teaching evidence for the TIGA model (plan docs/TIGA_MODEL_DEV_PLAN.md 4.4)
-- ⚠️ NOT APPLIED YET — awaiting the human owner's explicit per-migration approval
-- (repo hard rule). Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) only after review.
-- Safe to re-run: every object uses if-not-exists / or-replace.
--
-- WHY THIS EXISTS
--   reinforceTeachingFromOutcome() today learns from tg_atip_outcomes on ONE
--   device (localStorage), so the policy engine can only trust evidence the
--   current device collected. This table is the central aggregate that makes
--   "กลยุทธ์ที่เลือกมี evidence จริง" a cross-device property of the model.
--
-- PRIVACY BY DESIGN (no migration of existing tables, nothing user-scoped)
--   • NO user_id, NO session id, NO IP, NO free text — only strategy ids,
--     coarse accuracy buckets, a nullable self-report enum, and a signed
--     outcome. Rows cannot be linked back to an account.
--   • Direct SELECT is denied to anon/authenticated (no SELECT policy → deny
--     by default). Readers go through the aggregate-only RPC below, which
--     returns COUNTs, never rows. service_role (Model Lab) bypasses RLS as usual.
--   • Client-writable values are enum/bucket-checked server-side; the outcome
--     column is clamped to {-1,0,1} by the RPC — no client-supplied absolutes.
--
-- CONSUMER (wave 4 of the plan): the teaching policy engine weights strategies
--   by improved/same/worse evidence; tigamodel's self-learner reads the RPC,
--   never the table directly. Until that wiring ships, this table is write-only
--   telemetry — harmless if deployed alone.

create table if not exists public.strategy_outcomes (
  id bigint generated always as identity primary key,
  strategy_id text not null,
  surface text not null default 'practice',          -- 'practice' | 'song' | 'sight_reading' | 'camera'
  lang text not null default 'th',                   -- 'th' | 'en' | 'zh'
  accuracy_bucket smallint not null check (accuracy_bucket between 0 and 3),  -- 0:<50, 1:50-74, 2:75-89, 3:>=90
  self_report text,                                  -- nullable: 'too_easy'|'too_hard'|'understand'|'confused'|'retry'|'frustrated'|'great'
  outcome smallint not null check (outcome in (-1, 0, 1)),  -- +1 next bucket better, 0 same, -1 worse
  created_at timestamptz not null default now()
);

create index if not exists strategy_outcomes_evidence_idx
  on public.strategy_outcomes (strategy_id, outcome);

alter table public.strategy_outcomes enable row level security;

-- INSERT only (telemetry from the app). No SELECT/UPDATE/DELETE policies:
-- anon + authenticated can append, nobody can read rows over the client API.
create policy strategy_outcomes_insert_policy
  on public.strategy_outcomes
  for insert
  to anon, authenticated
  with check (
    strategy_id is not null
    and surface in ('practice','song','sight_reading','camera')
    and lang in ('th','en','zh')
    and outcome in (-1, 0, 1)
    and accuracy_bucket between 0 and 3
  );

-- One append path. Everything the client sends is validated/clamped here, so
-- the with-check policy above is defense-in-depth, not the only gate.
create or replace function public.submit_strategy_outcome(
  p_strategy_id text,
  p_surface text default 'practice',
  p_lang text default 'th',
  p_accuracy_bucket smallint default null,
  p_self_report text default null,
  p_outcome smallint default 0
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_strategy_id is null or length(p_strategy_id) = 0 or length(p_strategy_id) > 80 then
    raise exception 'invalid strategy_id';
  end if;
  if p_surface not in ('practice','song','sight_reading','camera') then raise exception 'invalid surface'; end if;
  if p_lang not in ('th','en','zh') then raise exception 'invalid lang'; end if;
  if p_self_report is not null and p_self_report not in
      ('too_easy','too_hard','understand','confused','retry','frustrated','great') then
    raise exception 'invalid self_report';
  end if;
  if p_outcome not in (-1, 0, 1) then raise exception 'invalid outcome'; end if;
  if p_accuracy_bucket is null then p_accuracy_bucket := 1; end if;
  if p_accuracy_bucket not between 0 and 3 then raise exception 'invalid accuracy_bucket'; end if;

  insert into public.strategy_outcomes
    (strategy_id, surface, lang, accuracy_bucket, self_report, outcome)
  values
    (p_strategy_id, p_surface, p_lang, p_accuracy_bucket, p_self_report, p_outcome);
end; $$;

-- Aggregate-only read for the policy engine (and the Model Lab evidence card):
-- counts per strategy, never a row. Denies nothing at table level is needed —
-- this simply never exposes rows.
create or replace function public.strategy_evidence(p_strategy_id text)
returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_build_object(
    'strategy_id', p_strategy_id,
    'total', count(*),
    'improved', count(*) filter (where outcome = 1),
    'same',     count(*) filter (where outcome = 0),
    'worse',    count(*) filter (where outcome = -1),
    'with_self_report', count(*) filter (where self_report is not null)
  ), jsonb_build_object('strategy_id', p_strategy_id, 'total', 0, 'improved', 0, 'same', 0, 'worse', 0, 'with_self_report', 0))
  from public.strategy_outcomes
  where strategy_id = p_strategy_id;
$$;

revoke all on function public.strategy_evidence(text) from anon;
grant execute on function public.strategy_evidence(text) to authenticated;
grant execute on function public.submit_strategy_outcome(text, text, text, smallint, text, smallint) to anon, authenticated;
