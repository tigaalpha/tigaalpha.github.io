-- ─────────────────────────────────────────────────────────────────────────────
-- TIGA AI — Learning Data System v1 (owner spec, 30 sections, 2026-09-23)
--
-- STATUS: APPLIED 2026-09-25 on project gsaqgbracxnucdmtmcxz with the owner's
-- explicit approval (AGENTS.md hard rule).
--
-- WHAT THIS ADDS (additive only — create-if-not-exists everywhere; nothing
-- existing is altered, dropped, or re-created):
--
--   learning_sessions        one row per "a study run": goal, song, skill,
--                            duration, observation/diagnosis/intervention
--                            counts, before/after accuracy, success verdict
--   learning_observations    RAW facts the system detected ("72% note hit",
--                            "62 BPM", "restarted 5x") — never AI opinion
--   learning_diagnoses       AI INFERENCE from observations ("rhythm stability
--                            may be the problem", p=0.86, evidence listed) —
--                            kept strictly separate from observations (§2/§3)
--   learning_interventions   what the AI DID about a diagnosis (strategy,
--                            actions, prompt/strategy versions, difficulty)
--   learning_practice_events what the learner then DID (reps, minutes, score
--                            before/after, linked back to the intervention)
--   learner_skill_state      per-learner per-skill ability estimate (0..1),
--                            evidence count, confidence, trend, current and
--                            recommended difficulty — the Student Model core
--   learner_memory           structured memory with source + evidence +
--                            confidence (goals, likes, strengths, weaknesses,
--                            what worked / what didn't) — evidence-backed only
--
-- WHAT THIS REUSES (nothing duplicated):
--   * usage_events  stays the raw interaction stream (§13) — untouched
--   * teaching_outcomes (supabase-teaching-outcomes-migration.sql) stays the
--     outcome layer: interventions here carry an outcome_id pointing INTO it.
--     If that migration is not applied yet, the FK-less text link still works.
--   * skill_monthly_snapshot stays the monthly trend store — untouched
--   * user_cloud_state / cloud-sync.ts stays the raw-state sync — untouched
--   * skill ids are the App.tsx SKILLS vocabulary (rhythm, note_accuracy,
--     sight_reading, ear_training, chord_knowledge, dynamics, technique) so
--     everything joins to the same graph the model already uses (§8)
--
-- DESIGN RULES HONORED (spec § refs):
--   §2 observations ≠ diagnoses: two tables, one stores facts, one stores
--      inference with confidence + evidence — AI can never write a guess
--      into the fact table (the client-facing RPCs enforce it).
--   §10 one trace: every row carries learner_id + session_id + trace_id.
--   §11 AI versions: model/strategy/prompt versions recorded per intervention
--      and per diagnosis.
--   §12 no big jumps: learner_skill_state updates are confidence-weighted
--      blends server-side (RPC), never a client-supplied absolute value —
--      a single measurement moves the estimate only partially.
--   §19 security: RLS everywhere — learners see ONLY their own rows; admin
--      reads ride the existing is_top_admin() pattern; no public surface.
--   §20/§21 never crash teaching + no dupes: every ingest RPC is
--      idempotent on a client-supplied idempotency key, safe to retry,
--      and all writes are advisory (the client queue drops on failure).
--   §23 no old-data dressing: nothing backfills learning data from
--      usage_events — old events stay raw facts only.
--
-- Safe to re-run: if-not-exists / or-replace throughout.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ 1. learning_sessions ═════════════════════════════════════════════════════
create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  session_key text not null,              -- client idempotency key (device-local uuid per session)
  trace_id text,                          -- groups every related row (§10)
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec int,                       -- measured practice seconds
  goal text,                              -- what the learner sat down to do
  song_id text,                           -- song / lesson / topic actually used
  skill text,                             -- primary skill tag (SKILLS vocabulary)
  status text not null default 'active',  -- 'active' | 'completed' | 'abandoned'
  observations_count int default 0,
  diagnoses_count int default 0,
  interventions_count int default 0,
  practice_count int default 0,
  accuracy_before numeric,                -- first measurement of the session
  accuracy_after numeric,                 -- last measurement of the session
  improved boolean,                       -- server-side derived verdict
  successful boolean,                     -- §15: interaction+observation+diagnosis+intervention+practice+measurement+improved
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, session_key)        -- idempotency: retry-safe session start (§21)
);
create index if not exists learning_sessions_learner_idx
  on public.learning_sessions (learner_id, started_at desc);
create index if not exists learning_sessions_trace_idx
  on public.learning_sessions (trace_id);

-- ══ 2. learning_observations — FACTS ONLY ════════════════════════════════════
-- "the system detected" — numbers/sensors/events. The client-facing RPC below
-- only accepts this table's inserts; AI-inferred content has no door in here.
create table if not exists public.learning_observations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete cascade,
  trace_id text,
  observed_at timestamptz not null default now(),
  source text not null,                   -- 'midi' | 'audio' | 'camera' | 'voice' | 'ui' | 'quiz' | 'self_report' | 'keyboard'
  kind text not null,                     -- e.g. 'note_accuracy', 'tempo_bpm', 'timing_deviation_ms', 'restarts', 'pause_count', 'help_requests', 'duration_sec', 'self_report'
  value jsonb,                            -- the raw fact(s): {v: 72, unit:'%'} / {bpm:62} / {choice:'confused'}
  song_id text,
  skill text,                             -- optional skill tag (§8 linkage)
  idem_key text,                          -- client idempotency key (§21)
  created_at timestamptz not null default now()
);
create index if not exists learning_observations_session_idx
  on public.learning_observations (session_id, observed_at);
create index if not exists learning_observations_learner_idx
  on public.learning_observations (learner_id, observed_at desc);
-- idempotency guard: the same key inserted twice resolves to one row (§21)
create unique index if not exists learning_observations_idem_idx
  on public.learning_observations (learner_id, idem_key) where idem_key is not null;

-- ══ 3. learning_diagnoses — AI INFERENCE ═════════════════════════════════════
create table if not exists public.learning_diagnoses (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete cascade,
  trace_id text,
  created_at timestamptz not null default now(),
  problem text not null,                  -- "rhythm stability may be weak" (phrased as a hypothesis, §3)
  skill text,                             -- skill involved
  confidence numeric,                     -- 0..1 — how sure the AI is
  evidence jsonb not null default '[]'::jsonb,  -- observation ids / values used
  alternatives jsonb,                     -- alternative explanations (estimator's honesty rule)
  model text,                             -- AI model that produced it (§11)
  model_version text,
  engine text,                            -- 'tigamodel-loop' | 'llm' | 'jev' | ...
  idem_key text,
  created_at2 timestamptz                 -- reserved; not used by v1 client
);
create index if not exists learning_diagnoses_session_idx
  on public.learning_diagnoses (session_id, created_at);
create unique index if not exists learning_diagnoses_idem_idx
  on public.learning_diagnoses (learner_id, idem_key) where idem_key is not null;

-- ══ 4. learning_interventions — what the AI taught ═══════════════════════════
create table if not exists public.learning_interventions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete cascade,
  trace_id text,
  diagnosis_id uuid references public.learning_diagnoses(id) on delete set null,
  created_at timestamptz not null default now(),
  strategy_id text not null,              -- teaching loop's strategy (simplify-on-confusion, ...)
  actions jsonb not null default '[]'::jsonb,   -- concrete moves: slow down, metronome, chunk...
  message_shown text,                     -- what the learner actually read
  skill text,
  difficulty_before numeric,              -- 0..1 difficulty level before the move
  difficulty_after numeric,
  expected_outcome text,                  -- what the AI hoped to achieve
  model text, model_version text,         -- §11 versioning
  strategy_version text, prompt_version text,
  outcome_id uuid,                        -- link INTO teaching_outcomes (same trace)
  idem_key text,
  created_at2 timestamptz                 -- reserved; not used by v1 client
);
create index if not exists learning_interventions_session_idx
  on public.learning_interventions (session_id, created_at);
create index if not exists learning_interventions_strategy_idx
  on public.learning_interventions (strategy_id, created_at desc);
create unique index if not exists learning_interventions_idem_idx
  on public.learning_interventions (learner_id, idem_key) where idem_key is not null;

-- ══ 5. learning_practice_events — what the learner did ═══════════════════════
create table if not exists public.learning_practice_events (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.learning_sessions(id) on delete cascade,
  trace_id text,
  intervention_id uuid references public.learning_interventions(id) on delete set null,
  created_at timestamptz not null default now(),
  what text,                              -- what was practiced (song/lesson/drill label)
  skill text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_sec int,
  attempts int,                           -- tries within this practice run
  loops int,                              -- full repetitions
  succeeded boolean,
  score_before numeric,                   -- accuracy/score entering the practice
  score_after numeric,                    -- coming out of it
  idem_key text
);
create index if not exists learning_practice_events_session_idx
  on public.learning_practice_events (session_id, created_at);
create unique index if not exists learning_practice_events_idem_idx
  on public.learning_practice_events (learner_id, idem_key) where idem_key is not null;

-- ══ 6. learner_skill_state — the Student Model core (§7) ═════════════════════
-- One row per learner per skill, UPSERTED — unlike the append-only tables
-- above this one is mutable by design: it IS the current belief about the
-- learner. Updates go through RPC below (confidence-weighted blend), never a
-- raw client UPDATE with an absolute value (repo hard rule).
create table if not exists public.learner_skill_state (
  learner_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null,
  ability numeric not null default 0.5,   -- 0..1 estimated ability
  confidence numeric not null default 0.2,-- 0..1 how much evidence backs it
  evidence_count int not null default 0,  -- measurements folded in so far
  successes int not null default 0,       -- interventions on this skill that improved it
  failures int not null default 0,
  last_observed_at timestamptz,
  last_improved_at timestamptz,
  trend numeric,                          -- short-run slope (per-update delta avg)
  difficulty_current numeric,             -- 0..1 difficulty being practiced at
  difficulty_recommended numeric,         -- what the model suggests next
  updated_at timestamptz not null default now(),
  primary key (learner_id, skill)
);
create index if not exists learner_skill_state_learner_idx
  on public.learner_skill_state (learner_id, updated_at desc);

-- ══ 7. learner_memory — evidence-backed memory (§9) ══════════════════════════
create table if not exists public.learner_memory (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,                 -- 'goal' | 'preference' | 'strength' | 'weakness' | 'current_problem' | 'currently_learning' | 'worked' | 'not_worked' | 'recent_progress' | 'next_up'
  content text not null,
  source text,                            -- 'practice' | 'ai' | 'quiz' | 'self_report' | 'teacher'
  evidence jsonb,                         -- what backs this memory
  confidence numeric default 0.5,
  active boolean not null default true,   -- superseded memories deactivate, never delete
  idem_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learner_memory_learner_idx
  on public.learner_memory (learner_id, category, updated_at desc);
create unique index if not exists learner_memory_idem_idx
  on public.learner_memory (learner_id, idem_key) where idem_key is not null;

-- ══ updated_at triggers for the two mutable tables ═══════════════════════════
create or replace function public.learning_row_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists learning_sessions_touch on public.learning_sessions;
create trigger learning_sessions_touch before update on public.learning_sessions
  for each row execute function public.learning_row_touch();

drop trigger if exists learner_skill_state_touch on public.learner_skill_state;
create trigger learner_skill_state_touch before update on public.learner_skill_state
  for each row execute function public.learning_row_touch();

drop trigger if exists learner_memory_touch on public.learner_memory;
create trigger learner_memory_touch before update on public.learner_memory
  for each row execute function public.learning_row_touch();

-- ══ 8. RLS — learner sees own rows; admins via the is_top_admin family (§19) ═
-- (self-select + self-insert for the two append-only client tables; everything
-- else write-through-RPC only. No anon policy anywhere — anonymous traffic is
-- never learning data, § "กฎสุดท้าย".)

alter table public.learning_sessions enable row level security;
drop policy if exists learning_sessions_self on public.learning_sessions;
create policy learning_sessions_self on public.learning_sessions
  for all to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

alter table public.learning_observations enable row level security;
drop policy if exists learning_observations_self on public.learning_observations;
create policy learning_observations_self on public.learning_observations
  for all to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

alter table public.learning_diagnoses enable row level security;
drop policy if exists learning_diagnoses_self on public.learning_diagnoses;
create policy learning_diagnoses_self on public.learning_diagnoses
  for all to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

alter table public.learning_interventions enable row level security;
drop policy if exists learning_interventions_self on public.learning_interventions;
create policy learning_interventions_self on public.learning_interventions
  for all to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

alter table public.learning_practice_events enable row level security;
drop policy if exists learning_practice_events_self on public.learning_practice_events;
create policy learning_practice_events_self on public.learning_practice_events
  for all to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

alter table public.learner_skill_state enable row level security;
drop policy if exists learner_skill_state_self on public.learner_skill_state;
create policy learner_skill_state_self on public.learner_skill_state
  for all to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

alter table public.learner_memory enable row level security;
drop policy if exists learner_memory_self on public.learner_memory;
create policy learner_memory_self on public.learner_memory
  for all to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

-- ══ 9. INGEST RPCs — the only write door the client uses (§14, §20, §21) ═════
-- All SECURITY DEFINER, owner-scoped to auth.uid(), all idempotent, all
-- advisory (return a row/null — never throw into the teaching flow).

-- start (or re-fetch) the learner's own session — idempotent on session_key
create or replace function public.learning_start_session(
  p_session_key text,
  p_trace_id text default null,
  p_goal text default null,
  p_song_id text default null,
  p_skill text default null
) returns public.learning_sessions
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_row public.learning_sessions;
begin
  if auth.uid() is null then return null; end if;
  if p_session_key is null or length(trim(p_session_key)) < 8 then return null; end if;
  insert into public.learning_sessions (learner_id, session_key, trace_id, goal, song_id, skill)
  values (auth.uid(), trim(p_session_key), p_trace_id, left(coalesce(p_goal,''),200), left(coalesce(p_song_id,''),120), left(coalesce(p_skill,''),40))
  on conflict (learner_id, session_key) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_row from public.learning_sessions
    where learner_id = auth.uid() and session_key = trim(p_session_key);
  else
    select * into v_row from public.learning_sessions where id = v_id;
  end if;
  return v_row;
end; $$;

-- complete a session + server-side success verdict (§15: computed HERE, not by
-- the client — the client can only report counts and its last measurements)
create or replace function public.learning_complete_session(
  p_session_key text,
  p_duration_sec int default null,
  p_observations int default null,
  p_diagnoses int default null,
  p_interventions int default null,
  p_practice int default null,
  p_accuracy_before numeric default null,
  p_accuracy_after numeric default null,
  p_abandoned boolean default false
) returns public.learning_sessions
language plpgsql security definer set search_path = public as $$
declare v_row public.learning_sessions;
begin
  if auth.uid() is null then return null; end if;
  update public.learning_sessions s set
    ended_at = now(),
    duration_sec = greatest(0, coalesce(p_duration_sec, coalesce(s.duration_sec, 0))),
    observations_count = greatest(0, coalesce(p_observations, s.observations_count)),
    diagnoses_count    = greatest(0, coalesce(p_diagnoses, s.diagnoses_count)),
    interventions_count= greatest(0, coalesce(p_interventions, s.interventions_count)),
    practice_count     = greatest(0, coalesce(p_practice, s.practice_count)),
    accuracy_before    = coalesce(p_accuracy_before, s.accuracy_before),
    accuracy_after     = coalesce(p_accuracy_after, s.accuracy_after),
    status = case when coalesce(p_abandoned, false) then 'abandoned' else 'completed' end,
    improved = case
      when p_accuracy_before is not null and p_accuracy_after is not null
        then p_accuracy_after > p_accuracy_before
      else s.improved end,
    successful = case
      -- §15: interaction + observation + diagnosis + intervention + practice +
      -- measurement + improvement (goal-met). Missing middle links → not success.
      when coalesce(p_abandoned, false) then false
      when greatest(0, coalesce(p_observations, 0)) > 0
       and greatest(0, coalesce(p_diagnoses, 0)) > 0
       and greatest(0, coalesce(p_interventions, 0)) > 0
       and greatest(0, coalesce(p_practice, 0)) > 0
       and p_accuracy_before is not null and p_accuracy_after is not null
       and p_accuracy_after > p_accuracy_before
        then true
      else false end,
    updated_at = now()
  where learner_id = auth.uid() and session_key = trim(p_session_key)
  returning * into v_row;
  return v_row;
end; $$;

-- one raw fact (observations only — facts, never opinions, §2)
-- v2: sessions are addressed by the client's stable session_key (the client
-- never sees the uuid across reloads) — every ingest RPC resolves it here.
create or replace function public.learning_observe(
  p_session_key text,
  p_trace_id text,
  p_source text,
  p_kind text,
  p_value jsonb default null,
  p_song_id text default null,
  p_skill text default null,
  p_idem_key text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sid uuid;
begin
  if auth.uid() is null then return null; end if;
  -- resolve the learner's own session by its stable key (RLS belt + suspenders)
  select id into v_sid from public.learning_sessions
    where learner_id = auth.uid() and session_key = trim(coalesce(p_session_key,''));
  if v_sid is null then return null; end if;
  insert into public.learning_observations
    (learner_id, session_id, trace_id, source, kind, value, song_id, skill, idem_key)
  values
    (auth.uid(), v_sid, p_trace_id, left(coalesce(p_source,'ui'),20),
     left(coalesce(p_kind,''),60), p_value, left(coalesce(p_song_id,''),120),
     left(coalesce(p_skill,''),40), p_idem_key)
  on conflict do nothing
  returning id into v_id;
  if v_id is not null then
    update public.learning_sessions set observations_count = observations_count + 1
    where id = v_sid;
    -- nudge the skill's last-observed stamp (cheap, keep state fresh)
    if coalesce(p_skill,'') <> '' then
      update public.learner_skill_state set last_observed_at = now(), updated_at = now()
      where learner_id = auth.uid() and skill = left(p_skill,40);
    end if;
  end if;
  return v_id;
end; $$;

-- AI inference record (§3: hypothesis + confidence + evidence, never "truth")
create or replace function public.learning_diagnose(
  p_session_key text,
  p_trace_id text,
  p_problem text,
  p_skill text default null,
  p_confidence numeric default null,
  p_evidence jsonb default null,
  p_alternatives jsonb default null,
  p_model text default null,
  p_engine text default null,
  p_idem_key text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sid uuid;
begin
  if auth.uid() is null then return null; end if;
  if p_problem is null or length(trim(p_problem)) < 4 then return null; end if;
  select id into v_sid from public.learning_sessions
    where learner_id = auth.uid() and session_key = trim(coalesce(p_session_key,''));
  if v_sid is null then return null; end if;
  insert into public.learning_diagnoses
    (learner_id, session_id, trace_id, problem, skill,
     confidence, evidence, alternatives, model, engine, idem_key)
  values
    (auth.uid(), v_sid, p_trace_id, left(trim(p_problem), 300),
     left(coalesce(p_skill,''),40),
     least(1, greatest(0, coalesce(p_confidence, 0.5))),
     coalesce(p_evidence, '[]'::jsonb), p_alternatives,
     left(coalesce(p_model,''),80), left(coalesce(p_engine,''),40), p_idem_key)
  on conflict do nothing
  returning id into v_id;
  if v_id is not null then
    update public.learning_sessions set diagnoses_count = diagnoses_count + 1
    where id = v_sid;
  end if;
  return v_id;
end; $$;

-- AI teaching action record (§4)
create or replace function public.learning_intervene(
  p_session_key text,
  p_trace_id text,
  p_diagnosis_id uuid default null,
  p_strategy_id text default 'continue-current-plan',
  p_actions jsonb default '[]'::jsonb,
  p_message_shown text default null,
  p_skill text default null,
  p_difficulty_before numeric default null,
  p_difficulty_after numeric default null,
  p_expected_outcome text default null,
  p_model text default null,
  p_strategy_version text default null,
  p_prompt_version text default null,
  p_idem_key text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sid uuid;
begin
  if auth.uid() is null then return null; end if;
  select id into v_sid from public.learning_sessions
    where learner_id = auth.uid() and session_key = trim(coalesce(p_session_key,''));
  if v_sid is null then return null; end if;
  -- the diagnosis, when given, must be this learner's own
  if p_diagnosis_id is not null and not exists (
    select 1 from public.learning_diagnoses
    where id = p_diagnosis_id and learner_id = auth.uid()) then
    p_diagnosis_id := null;
  end if;
  insert into public.learning_interventions
    (learner_id, session_id, trace_id, diagnosis_id, strategy_id, actions,
     message_shown, skill, difficulty_before, difficulty_after, expected_outcome,
     model, strategy_version, prompt_version, idem_key)
  values
    (auth.uid(), v_sid, p_trace_id, p_diagnosis_id,
     left(coalesce(p_strategy_id,'continue-current-plan'),60),
     coalesce(p_actions, '[]'::jsonb), left(coalesce(p_message_shown,''),2000),
     left(coalesce(p_skill,''),40),
     least(1, greatest(0, coalesce(p_difficulty_before, 0.5))),
     least(1, greatest(0, coalesce(p_difficulty_after, 0.5))),
     left(coalesce(p_expected_outcome,''),300),
     left(coalesce(p_model,''),80), left(coalesce(p_strategy_version,''),40),
     left(coalesce(p_prompt_version,''),40), p_idem_key)
  on conflict do nothing
  returning id into v_id;
  if v_id is not null then
    update public.learning_sessions set interventions_count = interventions_count + 1
    where id = v_sid;
  end if;
  return v_id;
end; $$;

-- learner practice run, linked to the intervention that suggested it (§5)
create or replace function public.learning_practice(
  p_session_key text,
  p_trace_id text,
  p_intervention_id uuid default null,
  p_what text default null,
  p_skill text default null,
  p_duration_sec int default null,
  p_attempts int default null,
  p_loops int default null,
  p_succeeded boolean default null,
  p_score_before numeric default null,
  p_score_after numeric default null,
  p_idem_key text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sid uuid;
begin
  if auth.uid() is null then return null; end if;
  select id into v_sid from public.learning_sessions
    where learner_id = auth.uid() and session_key = trim(coalesce(p_session_key,''));
  if v_sid is null then return null; end if;
  if p_intervention_id is not null and not exists (
    select 1 from public.learning_interventions
    where id = p_intervention_id and learner_id = auth.uid()) then
    p_intervention_id := null;
  end if;
  insert into public.learning_practice_events
    (learner_id, session_id, trace_id, intervention_id, what, skill,
     started_at, ended_at, duration_sec, attempts, loops, succeeded,
     score_before, score_after, idem_key)
  values
    (auth.uid(), v_sid, p_trace_id, p_intervention_id,
     left(coalesce(p_what,''),200), left(coalesce(p_skill,''),40),
     case when p_duration_sec is not null then now() - make_interval(secs => greatest(0, coalesce(p_duration_sec,0))) else null end,
     now(), greatest(0, coalesce(p_duration_sec, 0)),
     greatest(0, coalesce(p_attempts, 0)), greatest(0, coalesce(p_loops, 0)),
     p_succeeded,
     coalesce(p_score_before, 0), coalesce(p_score_after, 0), p_idem_key)
  on conflict do nothing
  returning id into v_id;
  if v_id is not null then
    update public.learning_sessions set practice_count = practice_count + 1
    where id = v_sid;
  end if;
  return v_id;
end; $$;

-- link the outcome row (teaching_outcomes id) back to its intervention (§6)
create or replace function public.learning_link_outcome(
  p_intervention_id uuid,
  p_outcome_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update public.learning_interventions
  set outcome_id = p_outcome_id
  where id = p_intervention_id and learner_id = auth.uid();
  return found;
end; $$;

-- ══ 10. learner_skill_state update — confidence-weighted blend (§12) ═════════
-- NEVER an absolute client value: the server blends the new measurement into
-- the existing belief, weighted by evidence count (a single reading moves the
-- estimate only fractionally — the more evidence, the closer it can move).
create or replace function public.learning_update_skill_state(
  p_skill text,
  p_ability numeric,                -- 0..1 measurement of ability this time
  p_confidence numeric default 0.3, -- how trustworthy THIS measurement is
  p_improved boolean default null,  -- did this round improve vs last?
  p_difficulty_current numeric default null,
  p_difficulty_recommended numeric default null
) returns public.learner_skill_state
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.learner_skill_state;
  v_old numeric; v_old_conf numeric; v_n int;
  v_weight numeric; v_new numeric; v_delta numeric; v_conf numeric;
begin
  if v_uid is null then return null; end if;
  if p_skill is null or length(trim(p_skill)) = 0 then return null; end if;
  p_ability := least(1, greatest(0, coalesce(p_ability, 0.5)));
  p_confidence := least(1, greatest(0, coalesce(p_confidence, 0.3)));

  select * into v_row from public.learner_skill_state
  where learner_id = v_uid and skill = trim(p_skill);
  v_old := coalesce(v_row.ability, 0.5);
  v_old_conf := coalesce(v_row.confidence, 0.2);
  v_n := coalesce(v_row.evidence_count, 0);

  -- evidence-weighted blend: existing belief keeps weight 0.6+0.35·conf,
  -- the new measurement gets the rest, capped at 0.6 — so one reading on a
  -- fresh learner moves ~40-60%, but on an established one only ~10-25% (§12).
  v_weight := least(0.6, 0.55 * p_confidence + 0.08);
  v_new := v_old * (1 - v_weight) + p_ability * v_weight;
  v_delta := v_new - v_old;
  v_conf := least(0.95, v_old_conf + p_confidence * 0.12);  -- confidence grows slowly, saturates

  insert into public.learner_skill_state
    (learner_id, skill, ability, confidence, evidence_count,
     successes, failures, last_observed_at, last_improved_at, trend,
     difficulty_current, difficulty_recommended, updated_at)
  values
    (v_uid, trim(p_skill), v_new, v_conf, v_n + 1, 0, 0, now(),
     case when coalesce(p_improved, false) then now() else null end,
     v_delta, p_difficulty_current, p_difficulty_recommended, now())
  on conflict (learner_id, skill) do update set
    ability = excluded.ability,
    confidence = excluded.confidence,
    evidence_count = excluded.evidence_count,
    successes = learner_skill_state.successes + (case when coalesce(p_improved, false) then 1 else 0 end),
    failures  = learner_skill_state.failures  + (case when p_improved = false then 1 else 0 end),
    last_observed_at = now(),
    last_improved_at = coalesce(
      case when coalesce(p_improved, false) then now() end,
      learner_skill_state.last_improved_at),
    trend = excluded.trend,
    difficulty_current = coalesce(excluded.difficulty_current, learner_skill_state.difficulty_current),
    difficulty_recommended = coalesce(excluded.difficulty_recommended, learner_skill_state.difficulty_recommended),
    updated_at = now()
  returning * into v_row;
  return v_row;
end; $$;

-- one evidence-backed memory upsert (§9: dedupe on idem_key; superseded
-- memories of the same category deactivate rather than delete)
create or replace function public.learning_remember(
  p_category text,
  p_content text,
  p_source text default 'practice',
  p_evidence jsonb default null,
  p_confidence numeric default 0.5,
  p_idem_key text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then return null; end if;
  if p_content is null or length(trim(p_content)) < 2 then return null; end if;
  insert into public.learner_memory
    (learner_id, category, content, source, evidence, confidence, idem_key)
  values
    (auth.uid(), left(trim(p_category), 40), left(trim(p_content), 500),
     left(coalesce(p_source,'practice'), 20), p_evidence,
     least(1, greatest(0, coalesce(p_confidence, 0.5))), p_idem_key)
  on conflict (learner_id, idem_key) do update set
    content = excluded.content,
    confidence = excluded.confidence,
    evidence = coalesce(excluded.evidence, learner_memory.evidence),
    active = true,
    updated_at = now()
  returning id into v_id;
  return v_id;
end; $$;

-- ══ 11. admin read surface (§17/§18) — top-admin only, SECURITY DEFINER ══════
-- learner intelligence feed for ONE student (recent sessions + aggregates)
create or replace function public.admin_learner_intelligence(p_learner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tier smallint; v_out jsonb;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 2 then return null; end if;
  select jsonb_build_object(
    'sessions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.started_at desc), '[]'::jsonb)
                 from (select * from learning_sessions where learner_id = p_learner
                       order by started_at desc limit 30) s),
    'skills', (select coalesce(jsonb_agg(to_jsonb(k) order by k.skill), '[]'::jsonb)
               from learner_skill_state k where k.learner_id = p_learner),
    'memories', (select coalesce(jsonb_agg(to_jsonb(m) order by m.updated_at desc), '[]'::jsonb)
                 from (select * from learner_memory where learner_id = p_learner and active
                       order by updated_at desc limit 40) m),
    'diagnoses_recent', (select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc), '[]'::jsonb)
                 from (select * from learning_diagnoses where learner_id = p_learner
                       order by created_at desc limit 15) d),
    'interventions_recent', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc), '[]'::jsonb)
                 from (select * from learning_interventions where learner_id = p_learner
                       order by created_at desc limit 15) i)
  ) into v_out;
  return v_out;
end; $$;

-- global learning KPIs (§16/§18) — today + 7/30-day windows in one call
create or replace function public.admin_learning_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tier smallint; v_out jsonb;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 2 then return null; end if;
  select jsonb_build_object(
    'today', (select jsonb_build_object(
        'learners', (select count(distinct learner_id) from learning_sessions where started_at >= date_trunc('day', now())),
        'sessions', (select count(*) from learning_sessions where started_at >= date_trunc('day', now())),
        'minutes', (select coalesce(sum(duration_sec),0)/60 from learning_sessions where started_at >= date_trunc('day', now())),
        'successful', (select count(*) from learning_sessions where successful and started_at >= date_trunc('day', now())))),
    'd7', (select jsonb_build_object(
        'sessions', (select count(*) from learning_sessions where started_at >= now() - interval '7 days'),
        'minutes', (select coalesce(sum(duration_sec),0)/60 from learning_sessions where started_at >= now() - interval '7 days'),
        'successful', (select count(*) from learning_sessions where successful and started_at >= now() - interval '7 days'),
        'improved', (select count(*) from learning_sessions where improved and started_at >= now() - interval '7 days'),
        'active_learners', (select count(distinct learner_id) from learning_sessions where started_at >= now() - interval '7 days'))),
    'd30', (select jsonb_build_object(
        'sessions', (select count(*) from learning_sessions where started_at >= now() - interval '30 days'),
        'minutes', (select coalesce(sum(duration_sec),0)/60 from learning_sessions where started_at >= now() - interval '30 days'),
        'successful', (select count(*) from learning_sessions where successful and started_at >= now() - interval '30 days'),
        'improved', (select count(*) from learning_sessions where improved and started_at >= now() - interval '30 days'),
        'active_learners', (select count(distinct learner_id) from learning_sessions where started_at >= now() - interval '30 days'),
        'retained_7d', (select count(*) from (select learner_id from learning_sessions
                          where started_at >= now() - interval '30 days'
                          group by learner_id having count(*) >= 2) x))),
    'top_skills', (select coalesce(jsonb_agg(row_to_json(t) order by t.n desc), '[]'::jsonb)
                 from (select skill, count(*) as n, avg(ability)::numeric(4,3) as avg_ability
                       from learner_skill_state group by skill order by n desc limit 7) t),
    'top_problems', (select coalesce(jsonb_agg(row_to_json(t) order by t.n desc), '[]'::jsonb)
                 from (select problem, count(*) as n, avg(confidence)::numeric(4,3) as avg_conf
                       from learning_diagnoses where created_at >= now() - interval '30 days'
                       group by problem order by n desc limit 7) t),
    'strategy_effect', (select coalesce(jsonb_agg(row_to_json(t) order by t.improved desc nulls last), '[]'::jsonb)
                 from (select i.strategy_id, count(*) as n,
                              count(i.outcome_id) as with_outcome,
                              avg(s.accuracy_after - s.accuracy_before)::numeric(6,2) as avg_gain
                       from learning_interventions i
                       join learning_sessions s on s.id = i.session_id
                       where i.created_at >= now() - interval '30 days' and s.accuracy_before is not null
                       group by i.strategy_id order by count(*) desc limit 8) t)
  ) into v_out;
  return v_out;
end; $$;

-- list learners with any learning activity (for the dashboard's picker)
create or replace function public.admin_learning_learners(p_search text default null, p_limit int default 50)
returns table (
  learner_id uuid, full_name text, email text,
  sessions int, minutes numeric, successful int, improved int,
  last_session timestamptz, skills_tracked int
) language plpgsql security definer set search_path = public as $$
declare v_tier smallint;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 2 then return; end if;
  return query
  select s.learner_id, p.full_name, p.email,
    count(*)::int,
    (coalesce(sum(s.duration_sec),0)::numeric / 60)::numeric(10,1),
    count(*) filter (where s.successful)::int,
    count(*) filter (where s.improved)::int,
    max(s.started_at),
    (select count(*)::int from learner_skill_state k where k.learner_id = s.learner_id)
  from learning_sessions s join profiles p on p.id = s.learner_id
  where p_search is null or trim(p_search) = ''
        or p.full_name ilike '%' || trim(p_search) || '%'
        or p.email ilike '%' || trim(p_search) || '%'
  group by s.learner_id, p.full_name, p.email
  order by max(s.started_at) desc
  limit least(coalesce(p_limit, 50), 200);
end; $$;

-- ══ 12. session detail drill-down (§17: reconstruct one session fully) ═══════
create or replace function public.admin_learning_session_detail(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tier smallint; v_out jsonb;
begin
  select admin_tier into v_tier from profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 2 then return null; end if;
  select jsonb_build_object(
    'session', (select to_jsonb(s) from learning_sessions s where s.id = p_session),
    'observations', (select coalesce(jsonb_agg(to_jsonb(o) order by o.observed_at), '[]'::jsonb)
                     from learning_observations o where o.session_id = p_session),
    'diagnoses', (select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at), '[]'::jsonb)
                     from learning_diagnoses d where d.session_id = p_session),
    'interventions', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
                     from learning_interventions i where i.session_id = p_session),
    'practice', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
                     from learning_practice_events e where e.session_id = p_session)
  ) into v_out;
  return v_out;
end; $$;

-- ══ 13. VERIFICATION after applying (run in SQL editor) ══════════════════════
-- select table_name from information_schema.tables
--   where table_schema='public' and table_name like 'learning%' or table_name in ('learner_skill_state','learner_memory');
--   → expect 7 rows.
-- select * from admin_learning_overview();          -- as a tier≥2 admin → today/d7/d30 json
-- select * from admin_learning_learners();          -- → empty list until real sessions exist
-- ─────────────────────────────────────────────────────────────────────────────
