import { sb } from "./supabase-client";

/* ── learning-data.ts — TIGA AI Learning Data System v1 (owner spec, 2026-09-23)
   Client side of the §1-§21 loop: ผู้เรียน → เริ่มเรียน → สังเกต → วิเคราะห์ →
   AI สอน → ฝึก → วัดผล → อัปเดตข้อมูลผู้เรียน.

   Design rules honored (mirroring supabase-learning-data-migration.sql):
   §2  observations = FACTS the system detected (never AI opinion).
   §3  diagnoses    = AI INFERENCE with confidence + evidence — phrased as a
        hypothesis, never as truth.
   §4  interventions= what the AI DID (strategy, actions, versions).
   §5  practice     = what the learner DID, linked to the intervention.
   §10 one trace: every row carries learner + session + trace ids.
   §11 versions: model/strategy/prompt recorded per record.
   §12 no big jumps: ability updates go through the server blend RPC — the
        client only sends a measurement, never a final value (repo hard rule:
        client-writable absolutes are the known-bad pattern).
   §15 success verdict: computed SERVER-side (learning_complete_session); the
        client only reports counts and its own last measurements.
   §20 never crash teaching: every call is fire-and-forget, every failure is
        swallowed into the offline queue, every retry is idempotent.
   §21 no dupes: each record carries a stable idem key — retrying inserts the
        same row once.

   Everything degrades to a silent no-op for guests (no account → no learning
   data; the RLS policies make that impossible server-side anyway) and when
   the RPCs haven't been applied yet (PGRST202 → queued, not lost, and dropped
   after 48h so the queue can't grow forever). */

const QUEUE_KEY = "tg_learning_queue";
const SESSION_KEY = "tg_learning_session";
const TRAJECTORY_KEY = "tg_learning_traj";
const QUEUE_MAX = 300;
const QUEUE_TTL = 48 * 3600 * 1000; // §: the queue is a buffer, not an archive

/* ── tiny local helpers (best-effort storage, never throw) ─────────────────── */
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* ── idempotency keys (§21): stable per logical record ─────────────────────── */
let idemSeq = 0;
function idem(prefix) {
  // crypto.randomUUID exists on every target we ship; the fallback is for
  // exotic webviews only and only has to be collision-free within a device.
  const u = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${(idemSeq++).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}:${u}`;
}

function signedIn() {
  try { return !!(sb && sb.auth && sb.auth._sessionReady && sb.auth._sessionReady()); } catch (e) {}
  return true; // can't tell → attempt the call; RLS/auth rejects it harmlessly
}

/* ── offline queue (§20/§21): every failed write retries once, later ───────── */
function enqueue(item) {
  const q = lsGet(QUEUE_KEY) || [];
  q.push({ ...item, ts: Date.now() });
  lsSet(QUEUE_KEY, q.slice(-QUEUE_MAX));
}
function pruneQueue(q) {
  const now = Date.now();
  return (q || []).filter(x => now - (x.ts || now) < QUEUE_TTL).slice(-QUEUE_MAX);
}
let flushing = false;
export function flushLearningQueue() {
  if (flushing) return;
  const q = pruneQueue(lsGet(QUEUE_KEY));
  if (!q.length) return;
  flushing = true;
  lsSet(QUEUE_KEY, []); // take ownership of the entries now; re-enqueue on failure
  (async () => {
    const failed = [];
    for (const item of q) {
      try {
        const { error } = await sb.rpc(item.fn, item.args || {});
        if (error) { if (isMissingRpc(error)) continue; throw new Error(error.message); }
      } catch (e) { failed.push(item); }
    }
    if (failed.length) lsSet(QUEUE_KEY, pruneQueue([...(lsGet(QUEUE_KEY) || []), ...failed]));
    flushing = false;
  })();
}
function isMissingRpc(err) {
  // PGRST202 = "Could not find the function … in the schema cache": the
  // migration hasn't been applied on this project yet. Drop, don't retry —
  // the queue would otherwise fill with 300 entries per device for nothing.
  return err && (err.code === "PGRST202" || (err.message || "").includes("schema cache"));
}

async function callRpc(fn, args) {
  try {
    const { error } = await sb.rpc(fn, args);
    if (error) {
      if (isMissingRpc(error)) return null;           // feature not deployed yet → silent
      throw new Error(error.message || String(error));
    }
    return true;
  } catch (e) {
    enqueue({ fn, args });
    return null;
  }
}

/* ── session lifecycle (§1) ─────────────────────────────────────────────────── */
// One learning session per app launch (not per song): the spec's session is
// "a study run", which in TIGA is the visit — songs/practices inside it become
// practice events. Stable per launch via sessionStorage so a mid-session
// reload continues the SAME session instead of forking a new one.
export function startLearningSession(goal) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null; // SSR/prerender safety
    let s = lsGet(SESSION_KEY);
    if (s && s.key) return s; // already started this visit
    const key = idem("sess");
    s = { key, trace: idem("trace"), goal: String(goal || "practice"), startedAt: Date.now(),
          observations: 0, diagnoses: 0, interventions: 0, practice: 0,
          accuracyBefore: null, accuracyAfter: null };
    lsSet(SESSION_KEY, s);
    callRpc("learning_start_session", {
      p_session_key: s.key, p_trace_id: s.trace, p_goal: s.goal,
      p_song_id: null, p_skill: null,
    });
    return s;
  } catch (e) { return null; }
}

function currentSession() {
  try {
    const s = lsGet(SESSION_KEY);
    if (!s || !s.key) return null;
    // a session older than 12h is stale (device slept through the night) —
    // silently roll over rather than appending to yesterday's run
    if (Date.now() - s.startedAt > 12 * 3600 * 1000) return null;
    return s;
  } catch (e) { return null; }
}

function sessionKey() { const s = currentSession(); return s ? s.key : null; }
function traceId()    { const s = currentSession(); return s ? s.trace : null; }

function bumpSession(field, n = 1) {
  const s = lsGet(SESSION_KEY);
  if (!s) return;
  s[field] = (s[field] || 0) + n;
  lsSet(SESSION_KEY, s);
}

/* ── §2 observations — FACTS ONLY. Callers pass measured values. ───────────── */
export function learningObserve(source, kind, value, opts = {}) {
  const sk = sessionKey();
  const idKey = idem("obs");
  bumpSession("observations");
  if (!sk || !signedIn()) return null;
  return callRpc("learning_observe", {
    // v2 contract: the RPC resolves the session from the client's stable
    // session_key (the uuid never crosses to the client) — arg names must
    // match supabase-learning-data-migration.sql exactly.
    p_session_key: sk,
    p_trace_id: traceId(),
    p_source: String(source || "ui").slice(0, 20),
    p_kind: String(kind || "").slice(0, 60),
    p_value: value == null ? null : (typeof value === "object" ? value : { v: value }),
    p_song_id: opts.songId ? String(opts.songId).slice(0, 120) : null,
    p_skill: opts.skill ? String(opts.skill).slice(0, 40) : null,
    p_idem_key: idKey,
  });
}

/* ── §3 diagnoses — AI INFERENCE with confidence + evidence. ───────────────── */
export function learningDiagnose(problem, opts = {}) {
  const sk = sessionKey();
  bumpSession("diagnoses");
  if (!sk || !signedIn()) return null;
  return callRpc("learning_diagnose", {
    p_session_key: sk,
    p_trace_id: traceId(),
    p_problem: String(problem || "").slice(0, 300),
    p_skill: opts.skill ? String(opts.skill).slice(0, 40) : null,
    p_confidence: typeof opts.confidence === "number" ? opts.confidence : null,
    p_evidence: Array.isArray(opts.evidence) ? opts.evidence : null,
    p_alternatives: opts.alternatives || null,
    p_model: opts.model ? String(opts.model).slice(0, 80) : null,
    p_engine: opts.engine ? String(opts.engine).slice(0, 40) : null,
    p_idem_key: idem("dx"),
  });
}

/* ── §4 interventions — what the AI taught. ────────────────────────────────── */
export function learningIntervene(opts = {}) {
  const sk = sessionKey();
  bumpSession("interventions");
  if (!sk || !signedIn()) return null;
  return callRpc("learning_intervene", {
    p_session_key: sk,
    p_trace_id: traceId(),
    p_diagnosis_id: opts.diagnosisId || null,
    p_strategy_id: opts.strategyId ? String(opts.strategyId).slice(0, 60) : "continue-current-plan",
    p_actions: Array.isArray(opts.actions) ? opts.actions : [],
    p_message_shown: opts.message ? String(opts.message).slice(0, 2000) : null,
    p_skill: opts.skill ? String(opts.skill).slice(0, 40) : null,
    p_difficulty_before: typeof opts.difficultyBefore === "number" ? opts.difficultyBefore : null,
    p_difficulty_after: typeof opts.difficultyAfter === "number" ? opts.difficultyAfter : null,
    p_expected_outcome: opts.expected ? String(opts.expected).slice(0, 300) : null,
    p_model: opts.model ? String(opts.model).slice(0, 80) : null,
    p_strategy_version: opts.strategyVersion ? String(opts.strategyVersion).slice(0, 40) : null,
    p_prompt_version: opts.promptVersion ? String(opts.promptVersion).slice(0, 40) : null,
    p_idem_key: idem("iv"),
  });
}

/* ── §5 practice — what the learner did after the AI taught. ───────────────── */
export function learningPractice(opts = {}) {
  const sk = sessionKey();
  bumpSession("practice");
  if (!sk || !signedIn()) return null;
  return callRpc("learning_practice", {
    p_session_key: sk,
    p_trace_id: traceId(),
    p_intervention_id: opts.interventionId || null,
    p_what: opts.what ? String(opts.what).slice(0, 200) : null,
    p_skill: opts.skill ? String(opts.skill).slice(0, 40) : null,
    p_duration_sec: Math.max(0, Math.round(opts.durationSec || 0)) || null,
    p_attempts: opts.attempts == null ? null : Math.max(0, Math.round(opts.attempts)),
    p_loops: opts.loops == null ? null : Math.max(0, Math.round(opts.loops)),
    p_succeeded: typeof opts.succeeded === "boolean" ? opts.succeeded : null,
    p_score_before: typeof opts.scoreBefore === "number" ? opts.scoreBefore : null,
    p_score_after: typeof opts.scoreAfter === "number" ? opts.scoreAfter : null,
    p_idem_key: idem("pr"),
  });
}

/* ── §15 session complete — the SERVER decides success; we only report. ────── */
export function completeLearningSession(abandoned = false) {
  const s = lsGet(SESSION_KEY);
  if (!s || !s.key) return;
  if (!signedIn()) { lsSet(SESSION_KEY, null); return; }
  callRpc("learning_complete_session", {
    p_session_key: s.key,
    p_duration_sec: Math.max(0, Math.round((Date.now() - s.startedAt) / 1000)),
    p_observations: s.observations || 0,
    p_diagnoses: s.diagnoses || 0,
    p_interventions: s.interventions || 0,
    p_practice: s.practice || 0,
    p_accuracy_before: typeof s.accuracyBefore === "number" ? s.accuracyBefore : null,
    p_accuracy_after: typeof s.accuracyAfter === "number" ? s.accuracyAfter : null,
    p_abandoned: !!abandoned,
  });
  lsSet(SESSION_KEY, null); // one complete per session, even if the RPC is queued
}

/* ── measurement bookkeeping: the session's first/last accuracy (§15) ──────── */
export function recordSessionAccuracy(pct) {
  const s = lsGet(SESSION_KEY);
  if (!s || typeof pct !== "number" || !isFinite(pct)) return;
  if (s.accuracyBefore == null) s.accuracyBefore = pct;
  s.accuracyAfter = pct;
  lsSet(SESSION_KEY, s);
}

/* ── §12 skill state — the server blends; we never send an absolute belief ─── */
export function updateLearnerSkill(skill, ability01, opts = {}) {
  if (!signedIn()) return null;
  return callRpc("learning_update_skill_state", {
    p_skill: String(skill || "").slice(0, 40),
    p_ability: Math.min(1, Math.max(0, ability01)),
    p_confidence: Math.min(1, Math.max(0, typeof opts.confidence === "number" ? opts.confidence : 0.3)),
    p_improved: typeof opts.improved === "boolean" ? opts.improved : null,
    p_difficulty_current: typeof opts.difficultyCurrent === "number" ? opts.difficultyCurrent : null,
    p_difficulty_recommended: typeof opts.difficultyRecommended === "number" ? opts.difficultyRecommended : null,
  });
}

/* ── §9 evidence-backed memory ─────────────────────────────────────────────── */
export function rememberLearner(category, content, opts = {}) {
  if (!signedIn()) return null;
  return callRpc("learning_remember", {
    p_category: String(category || "").slice(0, 40),
    p_content: String(content || "").slice(0, 500),
    p_source: String(opts.source || "practice").slice(0, 20),
    p_evidence: opts.evidence || null,
    p_confidence: Math.min(1, Math.max(0, typeof opts.confidence === "number" ? opts.confidence : 0.5)),
    p_idem_key: idem("mem"),
  });
}

/* ── wiring helpers the app actually calls ─────────────────────────────────── */

/* ── §3 diagnosis — deterministic inference from THIS run's facts. Written as
   a hypothesis ("may need…") with confidence + evidence, never as truth, and
   only when there is an actual weakness signal — a clean ≥75% run writes no
   diagnosis row. engine="client-heuristic" marks WHO inferred it. ── */
function maybeDiagnose(d, acc) {
  try {
    if (acc == null || acc >= 75) return;
    const evidence = [];
    if (d.misses != null) evidence.push({ misses: d.misses });
    if (d.noteMisses && d.noteMisses.length) evidence.push({ note_misses: d.noteMisses.slice(0, 6) });
    if (typeof d.scoreBefore === "number") evidence.push({ previous_accuracy: d.scoreBefore });
    learningDiagnose(`อาจต้องฝึกความแม่นยำเพิ่มใน "${String(d.songId || "practice").slice(0, 60)}" (รอบนี้ ${Math.round(acc)}%)`, {
      skill: "note_accuracy",
      confidence: Math.min(0.9, 0.5 + (75 - acc) / 200),
      evidence,
      alternatives: [{ note: "อาจเป็นการลองผิดลองถูกเพลงใหม่ ไม่ใช่จุดอ่อนถาวร" }],
      model: "tigamodel-signals",
      engine: "client-heuristic",
    });
  } catch (e) { /* §20 */ }
}

// practice-done event payload → observations + accuracy + skill update, in one
// call. accuracy is a 0-100 percentage; ability is its 0-1 sibling. Facts here
// only — the event's numbers were MEASURED by the practice engine.
export function recordPracticeResult(payload) {
  try {
    const d = payload || {};
    const acc = typeof d.accuracy === "number" ? d.accuracy : null;
    if (acc != null) recordSessionAccuracy(acc);
    pushTrajectoryPoint(acc);
    maybeDiagnose(d, acc);
    learningObserve("ui", "note_accuracy", acc != null ? { v: acc, unit: "%" } : null,
      { songId: d.songId, skill: "note_accuracy" });
    if (d.durationSec) learningObserve("ui", "duration_sec", { v: Math.round(d.durationSec) },
      { songId: d.songId });
    if (d.misses != null) learningObserve("ui", "miss_count", { v: d.misses }, { songId: d.songId });
    if (d.noteMisses && d.noteMisses.length) {
      learningObserve("ui", "note_misses", { labels: d.noteMisses.slice(0, 8) }, { songId: d.songId });
    }
    if (typeof d.isNewBest === "boolean") {
      learningObserve("ui", "personal_best", { v: d.isNewBest }, { songId: d.songId });
    }
    if (acc != null) {
      // §12: the server blends — we only report the measurement + a bounded
      // "did this beat the learner's own last attempt" signal.
      updateLearnerSkill("note_accuracy", acc / 100,
        { improved: typeof d.improved === "boolean" ? d.improved
          : (typeof d.scoreBefore === "number" ? acc > d.scoreBefore : undefined),
          confidence: 0.45 });
    }
    if (d.strategyId) {
      // §5 follow-up link: the model's teaching verdict for THIS drill is the
      // intervention; the practice event carries it back (outcome joins later
      // via strategy effect analysis).
      learningIntervene({
        strategyId: d.strategyId,
        message: d.strategyText || d.what || "",
        skill: "note_accuracy",
        expected: d.strategyText || null,
        model: "tigamodel",
        strategyVersion: "v1", promptVersion: "v1",
      });
    }
    learningPractice({
      what: d.songId || d.what || "practice",
      skill: "note_accuracy",
      durationSec: d.durationSec,
      attempts: d.attempts,
      succeeded: typeof d.improved === "boolean" ? d.improved : (acc != null && acc >= 65),
      scoreBefore: typeof d.scoreBefore === "number" ? d.scoreBefore : null,
      scoreAfter: acc,
    });
  } catch (e) { /* §20 — never crash practice */ }
}

/* the learner tapped "follow" on a coach tip (§7 behavior fact) */
export function recordTipFollowed(feature) {
  try {
    return learningObserve("ui", "coach_tip_followed", { feature: feature || null });
  } catch (e) { return null; }
}

// The tip the coach showed IS the intervention (§4): record it with the
// strategy the model picked, the exact message, and version stamps so §11
// "which strategy worked" can later be answered from real data.
export function recordCoachIntervention(tip, strategy) {
  try {
    if (!tip) return null;
    return learningIntervene({
      strategyId: (strategy && strategy.strategyId) || tip.strategy || "continue-current-plan",
      actions: Array.isArray(tip.steps) ? tip.steps.slice(0, 3) : [],
      message: tip.weakness || "",
      skill: tip.feature || null,
      expected: tip.topic || null,
      model: strategy && strategy.modelText ? "tigamodel+llm" : "tigamodel",
      strategyVersion: "v1",
      promptVersion: "v1",
    });
  } catch (e) { return null; }
}

// The learner followed the tip — link that practice run back to it (§5).
export function recordFollowUpPractice(feature, ok, accAfter) {
  try {
    return learningPractice({
      what: `follow-up:${feature || "coach"}`,
      skill: feature || null,
      succeeded: !!ok,
      scoreAfter: typeof accAfter === "number" ? accAfter : null,
    });
  } catch (e) { return null; }
}

/* ── trajectory for the win-moment proof + admin charts (tiny, local) ─────── */
export function pushTrajectoryPoint(pct) {
  try {
    if (typeof pct !== "number" || !isFinite(pct)) return;
    const arr = lsGet(TRAJECTORY_KEY) || [];
    arr.push({ t: Date.now(), v: Math.round(pct) });
    lsSet(TRAJECTORY_KEY, arr.slice(-40));
  } catch (e) {}
}
export function readTrajectory() { return lsGet(TRAJECTORY_KEY) || []; }

/* ── boot: start the session + flush anything the last visit queued ───────── */
let wired = false;
export function initLearningData() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (wired) return; // StrictMode double-mounts — one session per page, always
    wired = true;
    startLearningSession("app-open");
    flushLearningQueue();
    wirePracticeDone();
    window.addEventListener("pagehide", () => { try { completeLearningSession(false); } catch (e) {} });
    document.addEventListener("visibilitychange", () => {
      try { if (document.visibilityState === "hidden") completeLearningSession(false); } catch (e) {}
    });
  } catch (e) {}
}

/* ── the app's own "practice finished" event → learning data (§2/§5/§15) ────
   use-practice-mode.ts dispatches tiga:practice-done with RAW measured values
   (accuracy %, misses, duration, note-miss labels, the strategy the model
   picked). Subscribing here instead of inside App.tsx keeps the write path in
   one file — and App.tsx (13k lines) cannot be touched without a pickaxe.
   Everything is fire-and-forget: if the RPCs aren't applied yet the writes
   queue/drop silently, exactly like every other call in this module. ── */
function wirePracticeDone() {
  try {
    if (typeof window === "undefined" || !window.addEventListener) return;
    window.addEventListener("tiga:practice-done", (e) => {
      try { recordPracticeResult((e && e.detail) || {}); } catch (err) { /* §20 */ }
    });
  } catch (e) {}
}
