/* ── tigamodel/core/schema.js ──
   The intermediate schemas TIGA Core speaks. NOTHING in tigamodel (except
   provider adapters) may reference a specific foundation model, provider
   wire format, or SDK — adapters translate these objects to/from each
   provider's own shape. Phase 0 keeps them as plain JS objects with a
   validator, not classes: zero-dependency, tree-shakable, and matches how
   the rest of this repo (no TypeScript checking) does data.

   Design notes baked into the field choices (spec §7, §13, §14, §15, §27):
   - Student states are ALWAYS {probability, confidence, evidence[]} — never
     bare booleans, never absolute truths. Multiple hypotheses allowed.
   - Observation ≠ inference: TIGAObservation carries raw signals only;
     TIGAStudentState is the inferred layer on top.
   - Every response carries trace_id, provider metadata and confidence so
     eval-suite and the router's metrics can log the full decision chain. ── */

let _traceCounter = 0;
export function newTraceId(prefix = "tg") {
  _traceCounter = (_traceCounter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${_traceCounter.toString(36)}`;
}

/* ── request/response: the only shapes TIGA Core ever sends up / receives ── */

export function makeTIGARequest({ taskType = "chat", message = "", history = [], studentContext = null, options = {} } = {}) {
  return {
    trace_id: newTraceId(),
    task_type: validateTaskType(taskType),
    message: String(message || ""),
    history: (history || []).slice(-20).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })),
    student_context: studentContext ? validateStudentContext(studentContext) : null,
    options, // { max_tokens, temperature, privacy_mode, latency_budget_ms, prefer_provider, ... }
  };
}

export const TASK_TYPES = ["chat", "diagnose", "lesson-plan", "exercise", "coach-tip", "weekly-report", "practice-plan", "feedback", "performance-analysis", "vision", "audio"];

function validateTaskType(t) {
  if (!TASK_TYPES.includes(t)) return "chat"; // unknown task → default path, never throw
  return t;
}

export function makeTIGAResponse({ text = "", traceId = null, provider = null, model = null, status = "ok", confidence = null, metadata = null } = {}) {
  return {
    trace_id: traceId || newTraceId("tg-res"),
    status, // "ok" | "uncertain" | "error" | "refused"
    text: String(text || ""),
    confidence: confidence == null ? null : Math.max(0, Math.min(1, Number(confidence))),
    provider, // string like "existing-backend" | "mock" — NEVER a model name in core
    model, // informational only, set by adapter
    metadata: metadata || {},
  };
}

/* ── student context: the merged view student-model.js produces (spec §13) ── */

export function validateStudentContext(sc) {
  return {
    student_id: String(sc.student_id || "anon"),
    age_group: sc.age_group || null, // "child" | "teen" | "adult" | null = unknown
    experience_level: sc.experience_level || null, // informational, self-reported or inferred-from-data (never asserted)
    goals: Array.isArray(sc.goals) ? sc.goals.slice(0, 10) : [],
    strengths: Array.isArray(sc.strengths) ? sc.strengths.slice(0, 12) : [],
    struggles: Array.isArray(sc.struggles) ? sc.struggles.slice(0, 6) : [],
    mastered: Array.isArray(sc.mastered) ? sc.mastered.slice(0, 12) : [],
    recent: Array.isArray(sc.recent) ? sc.recent.slice(0, 12) : [],
    practice_habits: sc.practice_habits || null, // { days_active, avg_minutes, streak } — estimated, nullable
    preferred_explanations: sc.preferred_explanations || null, // e.g. "analogy" | "step-by-step" | "demonstration" — with confidence
    effective_strategies: Array.isArray(sc.effective_strategies) ? sc.effective_strategies.slice(0, 8) : [],
    ineffective_strategies: Array.isArray(sc.ineffective_strategies) ? sc.ineffective_strategies.slice(0, 8) : [],
    language: sc.language || "th",
    consent: { camera: false, mic: false, data_storage: true, ...(sc.consent || {}) },
  };
}

/* ── observation vs inferred state (spec §15) — the core epistemic contract ── */

export function makeObservation({ modality = "conversation", signal = "", value = null, timestamp = null } = {}) {
  return { modality, signal: String(signal || ""), value, timestamp: timestamp || new Date().toISOString() };
}

export function makeStudentStateEstimate({ state, probability, confidence, evidence = [], modalities = [], alternatives = [] } = {}) {
  if (probability == null || confidence == null) throw new Error("state estimates need probability AND confidence");
  return {
    state: String(state),
    probability: clamp01(probability),
    confidence: clamp01(confidence),
    evidence: evidence.map(String).slice(0, 8),
    modalities: modalities.map(String),
    alternative_explanations: alternatives.map(String).slice(0, 5),
    timestamp: new Date().toISOString(),
  };
}

/* ── teaching decision (output of policy.js, input to feedback/response) ── */

export function makeTeachingDecision({ strategyId, actions = [], rationale = "", basedOn = [] } = {}) {
  return { strategy_id: String(strategyId), actions: actions.map(String).slice(0, 6), rationale: String(rationale || ""), based_on: basedOn, timestamp: new Date().toISOString() };
}

/* ── diagnosis (spec §8 Diagnosis Engine shape, rule-based in P0) ── */

export function makeDiagnosis({ issues = [], confidence = 0, source = "rule" } = {}) {
  return {
    issues: (issues || []).map(i => ({
      code: String(i.code || "unknown"), // e.g. "rhythm_uneven", "note_miss_repeated", "concept_gap:<topic>"
      detail: String(i.detail || ""),
      evidence: Array.isArray(i.evidence) ? i.evidence.map(String).slice(0, 6) : [],
      confidence: clamp01(i.confidence != null ? i.confidence : confidence),
    })).slice(0, 8),
    source, // "rule" | "model" | "teacher"
    timestamp: new Date().toISOString(),
  };
}

function clamp01(v) { const n = Number(v); if (Number.isNaN(n)) return 0; return Math.max(0, Math.min(1, n)); }
