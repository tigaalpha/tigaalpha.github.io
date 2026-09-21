/* ── tigamodel/web.js ──
   Browser-side assembly of TIGA Piano Intelligence for the Model Lab and
   Phase 1 feature wiring. Lives in its own entry file (not index.js) so the
   Node smoke test and the app bundle never fight over environment-specific
   imports: this file may touch window/localStorage/the app's supabase
   client; index.js must not.

   Phase 1 note (owner approved direction): the existing-backend adapter
   reuses the app's piano-chat edge function, so the Model Lab tests the
   REAL production path (same per-feature model routing the students hit),
   with the signed-in admin's JWT — which also means ai_models config
   applies, exactly like production. ── */

import { buildPianoIntelligence } from "./index.js";
import { createExistingBackendAdapter } from "./providers/existing-backend-adapter.js";
import { createMockProvider } from "./providers/mock-provider.js";
import { registerProvider, listProviders } from "./providers/provider-interface.js";
import { createTeachingPolicy } from "./teaching/policy.js";
import { createTeachingLoop } from "./teaching/teaching-loop.js";
import { evaluateProvider, evaluateAllProviders } from "./evaluation/eval-suite.js";
import { makeTIGARequest } from "./core/schema.js";
import { createUniversitySeededKnowledgeBase } from "./knowledge/university-seed.js";
import { linkUniversityKnowledge } from "./knowledge/university-links.js";
import { seedGlobalTheory } from "./knowledge/global-theory-seed.js";
import { seedGlobalPedagogy } from "./knowledge/global-pedagogy-seed.js";
import { seedPianoCraft } from "./knowledge/piano-craft-seed.js";
import { seedTeacherCraft } from "./knowledge/teacher-craft-seed.js";
import { seedRepertoireForms } from "./knowledge/repertoire-forms-seed.js";
import { seedLearnerSkills } from "./knowledge/learner-skills-seed.js";
import { seedMatrixExpansion } from "./knowledge/expansion-matrix.js";
import { seedDeepExpansion } from "./knowledge/expansion-deep.js";
import { seedFinalExpansion } from "./knowledge/expansion-final.js";
import { seedScaleExpansion } from "./knowledge/expansion-scale.js";
import { seedCanvasExpansion } from "./knowledge/expansion-canvas.js";
import { seedSummitExpansion } from "./knowledge/expansion-summit.js";
import { seedKnowledgeExpansion } from "./knowledge/expansion-core.js";
import { seedRepertoireExpansion } from "./knowledge/expansion-repertoire.js";
import { seedPedagogyExpansion } from "./knowledge/expansion-pedagogy.js";
import { seedPeaksExpansion } from "./knowledge/expansion-peaks.js";
import { seedLearnerWave } from "./knowledge/expansion-learner.js";
import { seedStageWave } from "./knowledge/expansion-stage.js";
import { seedStageTwoWave } from "./knowledge/expansion-stage2.js";
import { buildStudentContextFromApp } from "./student/student-model.js";
import { createCapabilityEngine } from "./teaching/capability-engine.js";
import { generateExercise, generateSheet } from "./teaching/generator.js";
import { createUnifiedPlan } from "./roadmap-unified.js";
import { buildCoachContextBlock, practiceTimeBudget, buildDiagnosis, buildStudentSnapshot } from "./coach/diagnosis.js";
import { SOURCES, COVERAGE, GLOBAL_COVERAGE, listSourceIds } from "./knowledge/university-sources.js";
import { createSelfLearner } from "./learning/self-learner.js";
import { sharedSkillGraph } from "./teaching/skill-graph.js";
import { createCoach } from "./teaching/coach.js";
import { plmItem, plmParse, plmRank, plmSample, plmStats, PLM_TOTAL, PLM_DIMENSIONS } from "./roadmap-1m.js";
import { evaluateProviderExtended, evaluateAllProvidersExtended, regressionVerdict, rubricReply, EXTENDED_PROBES, THEORY_FACTS, GOLDEN_SITUATIONS } from "./evaluation/eval-expanded.js";
import { sb } from "../supabase-client";

/* Singleton per page load — the lab rebuilds providers when the session
   token changes (login/logout) via reinit(). */
let _tiga = null;

export function initTigamodelWeb() {
  _tiga = buildPianoIntelligence({
    providers: [
      { name: "mock", adapter: createMockProvider() },
    ],
    routerPolicy: { prefer_privacy: "balanced", prefer_cost: "balanced", min_quality: 0, provider_overrides: {}, fallback_provider: "mock" },
  });
  // Upgrade the KB to the university-sourced seed (Thai first, then US/RU/FR/
  // CN/JP/KR/UK — every entry carries a source actually read on 2026-09-17).
  try {
    _tiga.kb = createUniversitySeededKnowledgeBase();
    linkUniversityKnowledge(_tiga.kb);
    seedGlobalTheory(_tiga.kb);   // global music-theory facts (2026-09-17 sweep)
    seedGlobalPedagogy(_tiga.kb); // teaching methods + practice science
    seedPianoCraft(_tiga.kb);     // GROUP 1: pedal/dynamics/jazz — app-teached topics (gap audit)
    seedTeacherCraft(_tiga.kb);   // GROUP 2+3: memory/ear/stage-fright/motivation/deep-theory
    seedRepertoireForms(_tiga.kb); // gap round 2 #1/#4/#5: eras, forms, left-hand patterns
    seedLearnerSkills(_tiga.kb);   // gap round 2 #6/#7/#10: improv how-to, transpose, special populations
    // 10,000-item knowledge expansion (owner directive 2026-09-18): computed
    // music-theory grid — every entry real & verifiable, zero filler.
    seedMatrixExpansion(_tiga.kb);
    seedDeepExpansion(_tiga.kb);
    seedFinalExpansion(_tiga.kb);
    seedScaleExpansion(_tiga.kb);
    seedCanvasExpansion(_tiga.kb);
    seedSummitExpansion(_tiga.kb);
    seedKnowledgeExpansion(_tiga.kb);
    seedRepertoireExpansion(_tiga.kb);
    seedPedagogyExpansion(_tiga.kb);
    seedPeaksExpansion(_tiga.kb);
    // learner wave (owner directive "ใช้ได้จริงๆ"): memory/ear/sight-reading/
    // special-populations/Thai-keyboard/plans/motivation — the knowledge the
    // production chat teacher actually adapts with.
    seedLearnerWave(_tiga.kb);
    // stage & craft wave: deepens performance/improv/accompaniment (capability
    // engine flagged these as the thinnest real domains)
    seedStageWave(_tiga.kb);
    seedStageTwoWave(_tiga.kb); // completes performance-domain depth (T8 kb=1.0)
  } catch (e) { /* keep the base seed if anything unexpected happens */ }
  // Reasoning layer (roadmap #62/#73/#75/#78): skill graph + coach (hint
  // ladder, adaptive tempo, recap) — pure, sync, no model call. Attached to
  // the singleton AND used to rebuild the loop so prerequisite suggestions
  // work inside runTeachingLoopForPractice.
  try {
    const sg = sharedSkillGraph();
    _tiga.skillGraph = sg;
    _tiga.coach = createCoach({ skillGraph: sg });
    _tiga.loop = createTeachingLoop({ policy: _tiga.policy, kb: _tiga.kb, skillGraph: sg });
  } catch (e) { /* reasoning layer is an enhancement, never a failure path */ }
  return _tiga;
}

/* Direct accessors for surfaces that only need the reasoning layer (Model
   Lab coach tab) without the full tiga instance. */
export function getSkillGraph() {
  if (!_tiga) initTigamodelWeb();
  return _tiga && _tiga.skillGraph ? _tiga.skillGraph : sharedSkillGraph();
}
export function getCoach() {
  if (!_tiga) initTigamodelWeb();
  return _tiga && _tiga.coach ? _tiga.coach : createCoach({ skillGraph: sharedSkillGraph() });
}

/* Async session-aware init: registers the existing-backend adapter with the
   current JWT when a session exists. Called once by the Model Lab on mount. */
export async function ensureTigamodelWeb() {
  if (!_tiga) initTigamodelWeb();
  try {
    if (sb && sb.auth) {
      const { data } = await sb.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (token) {
        // re-register with a fresh token (adapter closes over it)
        registerProvider("existing-backend", createExistingBackendAdapter({ accessToken: token }));
      }
    }
  } catch (e) {}
  return _tiga;
}

/* ── Capability engine (owner directive: แผน 1M 13% → 100%): scores every
   t×m×s route across kb/reasoning/surface/measure/evolve from REAL module
   state — the honest successor to module-route coverage. The KB index is
   injected from the real seeded KB so depth numbers are live. ── */
let _capEngine = null;
function kbEntriesIndex(kb) {
  const idx = new Map();
  if (!kb || !kb._entries) return idx;
  for (const [, e] of kb._entries) {
    if (!idx.has(e.domain)) idx.set(e.domain, []);
    idx.get(e.domain).push(e);
  }
  return idx;
}
export function getCapabilityEngine() {
  if (!_capEngine) {
    const tiga = _tiga || initTigamodelWeb();
    _capEngine = createCapabilityEngine({ kbEntries: kbEntriesIndex(tiga && tiga.kb) });
  }
  return _capEngine;
}
export function capabilitySummary() { return getCapabilityEngine().summary(); }
export function capabilityWorklist(limit = 50) { return getCapabilityEngine().worklist(limit); }

/* ── Exercise generation (capability "gen"): real KB-backed exercises from
   computed data — deterministic per seed, level 1-5, every topic. ── */
export function generateStudentExercise(topic, level, seed) {
  try { return generateExercise(topic, level, seed); } catch (e) { return null; }
}
export function generateStudentSheet(level, seed) {
  try { return generateSheet(level, seed); } catch (e) { return null; }
}

/* The 10 real exercise topics the generator can build (Phase 2 Practice
   Coach needs to offer an honest "next exercise" — the topic list IS the
   generator's own topic table, not invented labels). Stable order. */
import { GENERATOR_KINDS as _GENERATOR_KINDS } from "./teaching/generator.js";
export function studentExerciseKinds() {
  try { return _GENERATOR_KINDS(); } catch (e) { return []; }
}

/* ══ PHASE 3 — TEACHER DASHBOARD ADVICE (spec §34) ══
   The teacher's SchoolDashboard already shows every student's SYNCED real
   state (school_roster → profiles.progress: practiceLog/gameLog/memory/
   summary). What it lacks is the TIGA layer: WHAT the teacher should DO
   about each student in the next lesson. teacherAdviceFor(pr) turns one
   student's synced progress into a pre-lesson brief, using the same engines
   the student-facing coach uses (getCoachDiagnosis builds what/why/how from
   real numbers) plus honest risk flags. EVERY field is derived from the
   student's own record — nothing guessed, null when no data. Pure + sync.

   pr = the progress snapshot shape App.tsx buildProgressSnapshot() writes:
   { practiceLog:{YYYY-MM-DD:{n,accSum}}, memory:{struggles[],mastered[],
     noteMisses[]}, summary:{games,avgAcc,pathDone}, streak:{count} } ── */
export function teacherAdviceFor(pr) {
  try {
    if (!pr || typeof pr !== "object") return null;
    const mem = pr.memory || {};
    const plog = pr.practiceLog || {};
    const sum = pr.summary || {};

    /* risk flags — each one a concrete, checkable condition */
    const now = Date.now();
    const days = (ts) => Math.floor((now - ts) / 86400000);
    const flags = [];
    let lastDayTs = null;
    for (const k of Object.keys(plog)) {
      if (k.startsWith("_")) continue;
      const ts = new Date(k + "T00:00:00").getTime();
      if (!Number.isNaN(ts) && (lastDayTs == null || ts > lastDayTs)) lastDayTs = ts;
    }
    const daysIdle = lastDayTs != null ? Math.floor((now - 86400000 * new Date().getTimezoneOffset() / 1440 - lastDayTs) / 86400000) : null;
    if (daysIdle != null && daysIdle >= 5) flags.push({ id: "idle", icon: "😴", th: `ห่างหาย ${daysIdle} วัน — ควรถามก่อนว่าติดอะไร`, en: `Away ${daysIdle} days — ask what's blocking first`, zh: `缺席 ${daysIdle} 天——先了解原因` });
    const topMiss = (mem.noteMisses || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0] || null;
    if (topMiss && (topMiss.count || 0) >= 3) flags.push({ id: "note", icon: "🎼", th: `โน้ต ${topMiss.label} พลาดซ้ำ ${topMiss.count} ครั้ง`, en: `Note ${topMiss.label} missed ${topMiss.count}×`, zh: `音符 ${topMiss.label} 已错 ${topMiss.count} 次` });
    const hardStruggles = (mem.struggles || []).filter(s => (s.acc || 0) < 50 && s.last && days(s.last) <= 14);
    if (hardStruggles.length > 0) flags.push({ id: "stuck", icon: "🧱", th: `ติดจริง: ${hardStruggles[0].label} (${hardStruggles[0].acc}%)`, en: `Stuck: ${hardStruggles[0].label} (${hardStruggles[0].acc}%)`, zh: `卡住：${hardStruggles[0].label}（${hardStruggles[0].acc}%）` });
    if ((sum.avgAcc || 0) >= 85 && (sum.games || 0) >= 5) flags.push({ id: "ready", icon: "🚀", positive: true, th: "เก่งขึ้นจริง — พร้อมท้าทายเพลงใหม่", en: "Ready for a new challenge piece", zh: "可以挑战新曲目" });

    /* the coach's diagnosis engine — what/why/how from real numbers
       (getCoachDiagnosis reads localStorage; here we pass the student's
       SYNCED memory directly to the underlying builder instead) */
    let focus = null;
    try {
      const d = buildDiagnosis({ memory: mem, practiceLog: plog });
      if (d) focus = { label: d.what.label, acc: d.what.acc, trend: d.what.trend, why: d.why, how: d.how, bpm: d.meta ? d.meta.bpm : null };
    } catch (e) {}

    /* lesson plan for the next session — from the real time-budget engine */
    let plan = null;
    try {
      const b = practiceTimeBudget(30, { memory: mem });
      if (b && Array.isArray(b.parts)) plan = { total: b.total, focus: b.focus || null, parts: b.parts.map(p => ({ key: p.key, minutes: p.minutes, label: p.label || null })) };
    } catch (e) {}

    return { flags, focus, plan, summary: { avgAcc: sum.avgAcc || null, games: sum.games || null, pathDone: sum.pathDone || null, daysIdle } };
  } catch (e) { return null; }
}

/* ══ PHASE 4 — ADAPTIVE TEACHER (spec §14–15, §17, §21) ══
   Three exports power the self-report micro-poll on the practice result
   screen: the state estimator (multi-source fusion), the feedback record
   factory, and a loop re-run where the student's answer steers the decision
   (direct answer REPLACES performance guesses — spec §17's "คำตอบโดยตรงของ
   นักเรียนควรมีน้ำหนักสูงกว่าการเดาจากใบหน้าเพียงอย่างเดียว"). ── */
import { estimateStates as _estimateStates, makeStudentFeedback, SELF_REPORT_OPTIONS } from "./student/state-estimator.js";
export function estimateStudentStates(args) {
  try { return _estimateStates(args || {}); } catch (e) { return null; }
}
export function newStudentFeedback(args) {
  try { return makeStudentFeedback(args || {}); } catch (e) { return null; }
}
export const SELF_REPORT_CHOICES = SELF_REPORT_OPTIONS;

/* Re-run the loop with the learner's answer folded in. stats = the SAME
   practiceStats the first run got (plus weekAgoAccuracy) — the caller holds
   them; here we only fuse the report. Returns the full new loop result. */
export async function rerunLoopWithSelfReport(practiceStats, selfReport) {
  try {
    if (!selfReport || !SELF_REPORT_STATE_KEYS[selfReport]) return null;
    if (!_tiga) initTigamodelWeb();          // idempotent; the poll may be the first tigamodel touch of the session
    if (!_tiga || !_tiga.loop) return null;
    return await _tiga.loop.runOnce({ practiceStats, selfReport });
  } catch (e) { return null; }
}
const SELF_REPORT_STATE_KEYS = { confused: 1, too_easy: 1, too_hard: 1, understand: 1, frustrated: 1, retry: 1, great: 1 };

/* P4a — CAMERA→LOOP BRIDGE (spec §18/§19, real wiring): the camera coach's
   hand-posture detector already measures real frames ({round, wrist, thumb}
   averages in camSignalWindow). This turns those MEASURED values into loop
   observations — only what the detector actually saw, never mood/attention
   (§16). Caller passes the window the UI already computed; null/empty → no
   observation (honest). Returns [{modality, signal, value}] for runOnce. */
export function visionObservationsFromWindow(win) {
  try {
    if (!Array.isArray(win) || win.length < 5) return null;   // too few frames = no claim
    const n = win.length;
    const avg = k => win.reduce((s, w) => s + (typeof w[k] === "number" ? w[k] : 0), 0) / n;
    const mRound = avg("round"), mWrist = avg("wrist");
    const obs = [];
    if (mRound < 0.6) obs.push({ modality: "vision", signal: "hand_shape", value: { code: "hand_posture_flat", detail: "รูปมือแบนระหว่างเล่น (ค่าเฉลี่ยจากกล้อง)", confidence: Math.min(0.7, 0.4 + (0.6 - mRound)) } });
    if (mWrist < 0.55) obs.push({ modality: "vision", signal: "wrist_position", value: { code: "wrist_collapsed", detail: "ข้อมือยุบล่างระหว่างเล่น", confidence: Math.min(0.7, 0.4 + (0.55 - mWrist)) } });
    return obs.length ? obs : null;
  } catch (e) { return null; }
}

/* P4b — STT ANSWER PATH (spec §17/§18): a self-report answer SPOKEN instead
   of tapped. Maps the transcript to the self-report vocabulary; anything
   unmatched → null (the caller falls back to the tap UI). Thai/English/
   Chinese keywords, all exact words a learner would actually say. */
const SR_SPEECH_MAP = [
  [/เข้าใจ(แล้ว)?|แล้ว|got ?it|underst(o|a)od|understand|明白|懂了/, "understand"],
  [/งง|confus|ไม่เข้าใจ|不明白|懵/, "confused"],
  [/ง่าย(ไป|เกิน)|too ?easy|太简单/, "too_easy"],
  [/ยาก(ไป|เกิน)|too ?hard|太难/, "too_hard"],
  [/ลอง(อีก|ใหม่)|อีกครั้ง|retry|again|再来|再试/, "retry"],
  [/หงุดหงิด|โมโห|frustrat|烦躁|烦/, "frustrated"],
  [/สนุก|มันส์|fun|好玩|有趣/, "great"],
];
export function selfReportFromTranscript(text) {
  try {
    const t = String(text || "").toLowerCase();
    if (!t.trim()) return null;
    for (const [re, key] of SR_SPEECH_MAP) if (re.test(t)) return key;
    return null;
  } catch (e) { return null; }
}

/* ── THE UNIFIED PLAN (owner directive: รวมแผน 100 + แผน 1M เป็นแผ่นเดียว):
   100 streams × their 1M cells, one work order, statuses verified by the
   capability engine (a "done" tick without real capability never shows done). ── */
let _unified = null;
export function getUnifiedPlan() {
  if (!_unified) {
    const tiga = _tiga || initTigamodelWeb();
    _unified = createUnifiedPlan({ kbEntries: kbEntriesIndex(tiga && tiga.kb) });
  }
  return _unified;
}
export function unifiedSummary() { return getUnifiedPlan().summary(); }
export function unifiedWorkOrder(limit) { return getUnifiedPlan().workOrder(limit); }

/* ── AI PIANO COACH P0 (master product directive): WHAT/WHY/HOW diagnosis +
   time-adaptive practice budget + honest student snapshot — all from data
   the app already records (tg_memory + tg_practice_log). No new schema. ── */
export function getCoachDiagnosis() {
  try {
    const memory = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_memory") || "null") : null;
    const practiceLog = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_practice_log") || "null") : null;
    return buildDiagnosis({ memory, practiceLog });
  } catch (e) { return null; }
}
export function getPracticeTimeBudget(minutes) {
  try {
    const memory = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_memory") || "null") : null;
    return practiceTimeBudget(minutes, { memory });
  } catch (e) { return practiceTimeBudget(minutes, {}); }
}
export function getCoachContextBlock() {
  try {
    const memory = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_memory") || "null") : null;
    const practiceLog = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_practice_log") || "null") : null;
    return buildCoachContextBlock({ memory, practiceLog });
  } catch (e) { return ""; }
}

export function getTigamodel() { return _tiga; }

/* ── Self-Learning (owner directive 2026-09-18): the model can learn from
   the owner's admin-chat teaching and reinforce strategies from practice
   outcomes — gated behind ONE master switch the owner flips in Model Lab
   (app_settings.ai_self_learn.enabled). Singleton alongside _tiga. ── */
let _learner = null;

function ensureSelfLearner() {
  if (_learner) return _learner;
  _learner = createSelfLearner({
    load: async () => {
      try {
        const r = await sb.from("app_settings").select("value").eq("key", "ai_self_learn").maybeSingle();
        return r && r.data && r.data.value ? r.data.value : null;
      } catch (e) { return null; }
    },
    save: async (snapshot) => {
      const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_self_learn", p_value: snapshot });
      if (error) throw new Error(error.message || "save failed");
    },
  });
  return _learner;
}

export function getSelfLearner() { return ensureSelfLearner(); }
export async function isSelfLearningEnabled() { try { return await ensureSelfLearner().isEnabled(); } catch (e) { return false; } }
export async function setSelfLearningEnabled(on) { return ensureSelfLearner().setEnabled(on); }
export async function learnFromAdminTeaching(replyText) {
  try { return await ensureSelfLearner().learnFromAdmin(replyText); } catch (e) { return { learned: 0, error: String(e?.message || e) }; }
}
export async function reinforceTeachingOutcome(signal) {
  try { return await ensureSelfLearner().reinforceOutcome(signal); } catch (e) { return { applied: false }; }
}
export async function getLearnedKBContextAsync(matchText) {
  try { return await ensureSelfLearner().getLearnedKBContext(matchText); } catch (e) { return ""; }
}

/* ── P2 wiring (owner-approved direction, 2026-09-17): run the teaching loop
   on REAL practice signals from inside the app. Used by use-practice-mode's
   finishPractice() after every drill: app-native signals (accuracy, repeated
   errors, pauses, rhythm) go in, the policy selects a strategy, the KB adds
   a teach tip, and a { text, strategy_id } object comes back — all locally,
   no network call, never throws. Returns null when anything is off (no
   singleton, no stats) so the caller can skip silently.
   (Self-learning outcome reinforcement is a SEPARATE async export —
   reinforceTeachingOutcome — called by finishPractice fire-and-forget.)

   ASYNC — bug fix (found twice, independently): runOnce() has been `async`
   since the Phase 0 skeleton (3d8c3cd8), but this wrapper was sync and
   returned the raw Promise — finishPractice() read .response/.decision off
   the Promise → undefined → the "🧠 TIGA Model วิเคราะห์" verdict NEVER
   rendered on any practice result. (Found by this branch's verify-finish-
   practice-flow e2e AND by verify-autoteach on main.) Now a real async
   function returning the resolved loop result (or null) — callers await it.
   Also passes `lang` through so the verdict speaks the app's language, and
   `observations` (main's addition) straight to the loop. ── */
export async function runTeachingLoopForPractice(practiceStats, { selfReport = null, lang = "th", observations = null } = {}) {
  try {
    if (!practiceStats && !(Array.isArray(observations) && observations.length)) return null;
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.loop) return null;
    return await tiga.loop.runOnce({ practiceStats, selfReport, lang, observations: observations || [] });
  } catch (e) { return null; }
}

/* Coaching helpers for practice surfaces (roadmap #73/#75/#78): the hint
   rung for the current obstacle, the tempo decision in the flow band, and a
   3-line recap + homework. All pure/sync — fire and render, never throws. */
export function coachHintFor(practiceStats) {
  try { return getCoach().rungFor(practiceStats || {}); } catch (e) { return 0; }
}
export function coachHintText(rung, ctx) {
  try { return getCoach().renderHint(rung, ctx || {}); } catch (e) { return null; }
}
export function coachTempoTarget(args) {
  try { return getCoach().tempoTarget(args || {}); } catch (e) { return null; }
}
export function coachRecap(args) {
  try { return getCoach().recap(args || {}); } catch (e) { return null; }
}

/* The strategy_id from the loop, in the UI's three languages — rendered by
   PracticeOverlay's result card so the learner sees WHICH teaching move the
   model chose, not just its text. Kept here (not in i18n.ts) because it is
   tigamodel's vocabulary, not the piano app's. */
export const TIGA_STRATEGY_LABELS = {
  "simplify-on-confusion": { th: "🧩 ลดความซับซ้อน — แบ่งท่อนใหม่", en: "🧩 Simplify — break it into chunks", zh: "🧩 降低难度 — 分段练习" },
  "return-to-prerequisite": { th: "↩️ กลับไปพื้นฐานก่อน", en: "↩️ Back to the prerequisite", zh: "↩️ 回到基础练习" },
  "ease-off-on-low-engagement": { th: "🌙 ผ่อนความเข้ม วันนี้สั้นพอ", en: "🌙 Ease off — keep today short", zh: "🌙 放松强度 — 今天短练即可" },
  "raise-challenge": { th: "🚀 เพิ่มความท้าทายให้", en: "🚀 Raise the challenge", zh: "🚀 增加挑战" },
  "simplify-on-hard-report": { th: "🧩 ช้าลงแล้วแบ่งท่อน", en: "🧩 Slow down and isolate", zh: "🧩 减速分段" },
  "continue-current-plan": { th: "✅ ทำต่อตามแผนเดิมได้", en: "✅ Continue the current plan", zh: "✅ 按原计划继续" },
};
export function tigaStrategyLabel(id, lang) {
  const t = TIGA_STRATEGY_LABELS[id];
  return t ? (t[lang] || t.en) : null;
}

/* ── 1,000,000-item development plan (owner directive 2026-09-18): the
   combinatorial capability-spec space in roadmap-1m.js. Thin pass-throughs
   so the Model Lab never imports the raw module (same pattern as the coach
   accessors above). All pure/sync, never throws. ── */
export function plm1mItem(i) { try { return plmItem(i); } catch (e) { return null; } }
export function plm1mParse(code) { try { return plmParse(code); } catch (e) { return null; } }
export function plm1mRank(args) { try { return plmRank(args || {}); } catch (e) { return { rows: [], nextOffset: null, exhausted: true }; } }
export function plm1mSample(seed) { try { return plmSample(seed); } catch (e) { return null; } }
export function plm1mStats() { try { return plmStats(); } catch (e) { return { total: PLM_TOTAL, started: 0, open: PLM_TOTAL, startedPct: 0, buckets: [], byDim: [], modules: [] }; } }
export { PLM_TOTAL as PLM1M_TOTAL, PLM_DIMENSIONS as PLM1M_DIMENSIONS };

/* University knowledge source registry (for the Model Lab's ความรู้ tab). */
export function getUniversitySources() { return { sources: SOURCES, coverage: COVERAGE, globalCoverage: GLOBAL_COVERAGE, ids: listSourceIds() }; }

/* ── KB → student-facing teacher prompt (GROUP 4.1 of the owner's gap
   audit 2026-09-17; retrieval refinement is gap round 2, item #2). The KB
   seeds are static per page load, so the per-entry index is built once and
   cached; per MESSAGE the caller passes the student's text and only the
   entries whose keywords/domain match are rendered — asking about pedal no
   longer ships the jazz block. No match at all → a small always-useful
   core (motivation/planning) instead of nothing. ── */
let _kbIndex = null;
const KB_DOMAIN_LABEL = {
  pedal: "PEDAL", expression: "EXPRESSION", technique: "TECHNIQUE",
  jazz: "JAZZ", "ear-training": "EAR TRAINING", memorization: "MEMORIZATION",
  "practice-planning": "PRACTICE PLANS", performance: "PERFORMANCE",
  motivation: "MOTIVATION", culture: "THAI MUSIC", rhythm: "RHYTHM",
  theory: "THEORY", harmony: "HARMONY", repertoire: "REPERTOIRE",
  form: "FORM", accompaniment: "ACCOMPANIMENT", improvisation: "IMPROVISATION",
  "learner-differences": "LEARNER DIFFERENCES",
  "sight-reading": "SIGHT READING",
};
const KB_DOMAIN_KEYWORDS = {
  "sight-reading": ["อ่านโน้ต", "อ่านสายตา", "sight", "reading", "ledger", "บรรทัดโน้ต", "ตัวโน้ต", "กวาดตา"],
  pedal: ["pedal", "แป้น", "เหยียบ", "sustain", "sostenuto", "una corda"],
  expression: ["dynamic", "crescendo", "ดัง", "เบา", "rubato", "expression", "แสดงออก", "cresc", "sfz", "เน้นเสียง"],
  technique: ["ท่า", "นั่ง", "ศอก", "ไหล่", "ข้อมือ", "นิ้ว", "posture", "hand position", "เจ็บ", "เมื่อย", "tension", "technique", "curved"],
  jazz: ["jazz", "blues", "swing", "comping", "voicing", "บลูส์", "แจ๊ส", "12-bar", "riff"],
  "ear-training": ["ฟัง", "หู", "ear", "interval", "คู่เสียง", "dictation", "แยกเสียง"],
  memorization: ["จำ", "ท่องจำ", "memoriz", "ลืม", "memory"],
  "practice-planning": ["ซ้อม", "practice", "แผน", "กี่นาที", "นาที", "ตาราง", "ฝึก", "plan", "วันละ"],
  performance: ["ขึ้นเล่น", "เวที", "ใจสั่น", "ประหม่า", "stage", "anxiety", "ประกวด", "การแสดง"],
  motivation: ["เบื่อ", "เลิก", "ท้อ", "แรงใจ", "motivat", "รางวัล", "แต้ม", "ชม", "streak", "อยากเล่น"],
  culture: ["เพลงไทย", "ลูกทุ่ง", "หมอลำ", "thai music", "ขิม", "จะเข้"],
  rhythm: ["จังหวะ", "rhythm", "beat", "note value", "ครึ่งจังหวะ", "crotchet", "quaver", "โน้ตตัว"],
  theory: ["ทฤษฎี", "theory", "บันไดเสียง", "scale", "mode", "คู่เสียง", "interval", "key", "คีย์", "เซมิโทน", "solfege", "transpose", "ย้ายคีย์"],
  harmony: ["คอร์ด", "chord", "harmony", "inversion", "voice leading", "modulation", "เปลี่ยนคีย์", "cadence", "7th", "slash", "tension"],
  repertoire: ["เพลงคลาสสิก", "ยุค", "baroque", "คลาสสิก", "โรแมนติก", "bach", "mozart", "beethoven", "chopin", "ผู้แต่ง", "composer"],
  form: ["ฟอร์ม", "form", "ABA", "rondo", "โซนาต", "sonatina", "sonata", "variation", "โครงเพลง"],
  accompaniment: ["ประกอบ", "มือซ้าย", "left hand", "alberti", "ostinato", "เบส", "bass", "arpeggio", "บล็อกคอร์ด", "accomp"],
  improvisation: ["ด้นสด", "improvis", "แต่งเพลง", "แต่งสด"],
  "learner-differences": ["adhd", "สมาธิ", "เด็ก", "ลูก", "มือเล็ก", "ยืดไม่ถึง", "ผู้สูง", "พิเศษ", "hyperfocus", "child"],
};

function buildKbIndex(tiga) {
  const byDomain = new Map();
  for (const e of (tiga.kb ? tiga.kb._entries.values() : [])) {
    if (!e.teach || !KB_DOMAIN_LABEL[e.domain]) continue;
    if (!byDomain.has(e.domain)) byDomain.set(e.domain, []);
    byDomain.get(e.domain).push(e);
  }
  return byDomain;
}

export function getKBContext(matchText) {
  try {
    // sync init — ensureTigamodelWeb() is async and would return a Promise here
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.kb) return "";
    if (!_kbIndex) _kbIndex = buildKbIndex(tiga);
    if (!_kbIndex.size) return "";

    const text = String(matchText || "").toLowerCase();
    let domains = [];
    if (text) {
      for (const [d, kws] of Object.entries(KB_DOMAIN_KEYWORDS)) {
        if (kws.some(k => text.includes(k))) domains.push(d);
      }
    }
    // no topical hit → serve a small always-relevant core, not the whole KB
    if (!domains.length) domains = ["motivation", "practice-planning"];
    const top = domains.slice(0, 4); // cap: at most 4 domains per message

    const lines = [];
    for (const d of top) {
      const label = KB_DOMAIN_LABEL[d];
      for (const e of (_kbIndex.get(d) || [])) {
        lines.push(`• [${label}] ${e.title} — วิธีสอน: ${e.teach}`);
      }
    }
    if (!lines.length) {
      // switch-gated learned knowledge still injects even without a topical
      // seed hit — fire-and-forget cache warm (async fn, safe to ignore)
      const lr = ensureSelfLearner();
      lr.getLearnedKBContext(matchText).catch(() => {});
      return "";
    }
    return (
      "\n\n[TIGA KNOWLEDGE BASE — curated teaching knowledge with sources. Use these when relevant; follow the วิธีสอน (how to teach) guidance. Do not contradict them.]\n" +
      lines.join("\n") + "\n"
    );
  } catch (e) { return ""; }
}

/* ── Student-aware teaching block for PRODUCTION callers (use-chat). Reads
   the same localStorage memory the app already tracks (tg_memory), formats
   it through the real student-model schema, and returns a compact prompt
   block. The teacher then answers as a teacher who KNOWS this student —
   struggles by name, respects the mastered list, never re-explains what is
   already solid. Honest-gap rule: fields the app doesn't track stay absent,
   never guessed. Empty string when there is no memory at all (new student). ── */
export function getStudentContextBlock() {
  try {
    const raw = (typeof localStorage !== "undefined") ? localStorage.getItem("tg_memory") : null;
    if (!raw) return ""; // brand-new student — nothing to personalize (honest gap, not a guess)
    const mem = JSON.parse(raw);
    const hasSignal = mem && ((mem.struggles && mem.struggles.length) || (mem.mastered && mem.mastered.length) || (mem.recent && mem.recent.length) || mem.sessions);
    if (!hasSignal) return "";
    const ctx = buildStudentContextFromApp({});
    if (!ctx) return "";
    const lines = [];
    if (ctx.mastered && ctx.mastered.length) lines.push(`ทักษะที่ทราบว่าทำได้แล้ว (อย่าอธิบายซ้ำ ให้ต่อยอด): ${ctx.mastered.join(", ")}`);
    if (ctx.struggles && ctx.struggles.length) lines.push(`จุดที่เคยติดขัด (โอกาสที่ควรเสนอช่วย แต่ถามก่อนว่าอยากซ้อมจุดนี้ไหม): ${ctx.struggles.join(", ")}`);
    if (ctx.recent && ctx.recent.length) lines.push(`ผลการซ้อมล่าสุด: ${ctx.recent.join(" · ")}`);
    if (ctx.practice_habits && ctx.practice_habits.sessions_total) lines.push(`จำนวนเซสชันซ้อมทั้งหมด: ${ctx.practice_habits.sessions_total}`);
    if (ctx.experience_level) lines.push(`ระดับที่แอปบันทึกไว้: ${ctx.experience_level}`);
    if (!lines.length) return "";
    return `\n\n[ข้อมูลนักเรียนจากแอป — ใช้ปรับการสอนเป็นของคนนี้ อ้างอิงได้ว่า 'เธอทำผ่าน X มาแล้ว' ห้ามกุข้อมูลนอกนี้]\n${lines.map(l => "• " + l).join("\n")}\n`;
  } catch (e) { return ""; /* memory malformed → teach without it, never break the chat */ }
}

/* Learned-knowledge injection for callers that CAN await (use-chat / admin
   chat build their system prompt asynchronously anyway). Returns the static
   KB slice + the switch-gated learned block in one string, so production
   surfaces only ever call this. Empty when nothing matches / switch OFF. */
export async function getFullKBContext(matchText) {
  const base = getKBContext(matchText);
  let learned = "";
  // BUGFIX (owner directive "ใช้ได้จริงๆ"): was `if (_learner)` — but _learner
  // is null until someone calls ensureSelfLearner(), so production chat NEVER
  // received learned knowledge even with the switch ON. Create it now; the
  // learner reads its own switch and returns "" when disabled.
  try { learned = await ensureSelfLearner().getLearnedKBContext(matchText); } catch (e) { /* off or error → skip */ }
  return base + learned;
}

/* ── Measurement system (roadmap #81/#82/#83/#85/#86): extended 124-case eval
   + regression alarm with a localStorage baseline (key separate from the
   quick-eval history so the two never clobber each other). ── */
const EVAL_X_BASELINE_KEY = "tiga_lab_eval_extended_baseline";
export function loadEvalExtendedBaseline() {
  try {
    const raw = localStorage.getItem(EVAL_X_BASELINE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : null;
  } catch (e) { return null; }
}
export async function runExtendedEvalWithRegression() {
  try {
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.providers) return { error: "not initialized" };
    const results = await evaluateAllProvidersExtended(tiga.providers.list());
    const baseline = loadEvalExtendedBaseline();
    const head = results[0] || null;
    const verdict = regressionVerdict(head || { scores: {} }, baseline && baseline.scores ? baseline : null);
    try {
      localStorage.setItem(EVAL_X_BASELINE_KEY, JSON.stringify(head ? { provider: head.provider, scores: head.scores, overall: head.overall, cases_run: head.cases_run, saved_at: new Date().toISOString() } : {}));
    } catch (e) { /* quota/private mode — baseline stays in-memory for this session */ }
    return { results, verdict };
  } catch (e) { return { error: String(e?.message || e) };
  }
}
export { evaluateProviderExtended, regressionVerdict, rubricReply, EXTENDED_PROBES as EVALX_PROBES, THEORY_FACTS as EVALX_THEORY_FACTS, GOLDEN_SITUATIONS as EVALX_GOLDEN_SITUATIONS };

/* ── Lab/Backoffice local stores ──
   Chat sessions and eval runs from the admin's testing persist on-device
   (localStorage, same pattern as the referral code and guest profile) so the
   owner can review past model tests and compare eval scores before/after a
   model switch (spec §25: never switch on vibes). Server-side history comes
   with the teaching_outcomes migration — these stores keep the lab useful
   today without waiting on it. */
const CHAT_STORE_KEY = "tiga_lab_chat_sessions";
const EVAL_STORE_KEY = "tiga_lab_eval_runs";

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : fallback;
  } catch (e) { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota/private mode — store is best-effort */ }
}

/* ── TIGA Capability Hub — the intent façade the whole app speaks to ──
   Surfaces ask for INTENTS (sight-reading setup, song-result explanation,
   quest hints, learner summaries) — never for a module by name. Each intent
   consults its domains in priority order and falls back to an honest
   baseline, so registering a smarter engine later upgrades every surface
   with zero UI changes (spec: the app must keep benefiting from every
   future TIGA MODEL improvement).
   Registered NOW (real engines, already smoke-tested):
     skill-graph  → skill-graph.js (80-node map: clef/level/next-skill)
     coach        → coach/diagnosis.js (tempo bands, weak-spot targeting)
     diagnosis    → coach/diagnosis.js buildDiagnosis (learner summary lines)
     teaching-loop→ (reserved: state-aware quest framing — registers when
                    the loop exposes a sync probe) */
import { createTigaHub } from "./hub.js";
import { buildDiagnosis as _hubDiag } from "./coach/diagnosis.js";
/* engine calls are wrapped so a throwing engine degrades to the next domain
   (or the baseline) instead of breaking the surface that asked */
function attempt(fn) { try { const v = fn(); return v == null ? null : v; } catch (e) { return null; } }
const _hubSG = sharedSkillGraph();
export const tigaHub = createTigaHub();
tigaHub.registerEngine("skill-graph", {
  recommendSightReading(mem, cur) {
    const struggles = ((mem && mem.struggles) || []).map(s => (s && typeof s === "object") ? (s.label || s.th || s.en || s.code || "") : (typeof s === "string" ? s : "")).filter(Boolean);
    const nxt = attempt(() => _hubSG.nextSkill({}) || null);
    const hint = nxt && nxt.id ? ` → ก้าวถัดไป: ${nxt.th || nxt.en || nxt.id}` : "";
    const tip = struggles.length
      ? { th: `อ่านโน้ตชุดที่พลาดบ่อย (${struggles.slice(0, 2).join(", ")}) ก่อน${hint}`, en: `Drill the notes you miss most (${struggles.slice(0, 2).join(", ")})${hint}`, zh: `先练最容易错的音（${struggles.slice(0, 2).join("、")}）${hint}` }
      : { th: `ทักษะถัดไป: ${nxt ? (nxt.th || nxt.en || nxt.id) : "ทบทวนที่ชำนาญ"}`, en: `Next skill: ${nxt ? (nxt.en || nxt.th || nxt.id) : "review what you know"}`, zh: `下一技能：${nxt ? (nxt.th || nxt.en || nxt.id) : "复习已掌握内容"}` };
    return { clef: (cur && cur.clef) || "treble", tip, nextSkill: nxt || null };
  },
  nextQuestHint(mem, profile) {
    const nxt = attempt(() => _hubSG.nextSkill({}) || null);
    const struggles = ((mem && mem.struggles) || []).map(s => (s && typeof s === "object") ? (s.label || s.th || s.en || s.code || "") : (typeof s === "string" ? s : "")).filter(Boolean);
    const tip = struggles.length
      ? { th: `ภารกิจวันนี้: ซ้อมท่อนที่มี "${struggles[0] && (struggles[0].label || struggles[0])}" ให้ชนะ 1 รอบ${nxt ? ` (มุ่งสู่ ${nxt.th || nxt.en || nxt.id})` : ""}`, en: `Today's quest: win one run containing "${struggles[0] && (struggles[0].label || struggles[0])}"${nxt ? ` (toward ${nxt.en || nxt.th || nxt.id})` : ""}`, zh: `今日任务：赢一局含“${struggles[0] && (struggles[0].label || struggles[0])}”的曲子${nxt ? `（迈向${nxt.th || nxt.en || nxt.id}）` : ""}` }
      : { th: `ภารกิจวันนี้: ${nxt ? `ฝึกทักษะ "${nxt.th || nxt.en || nxt.id}"` : "จบซ้อม 3 รอบให้ครบ"}`, en: `Today's quest: ${nxt ? `practice "${nxt.en || nxt.th || nxt.id}"` : "finish 3 practice rounds"}`, zh: `今日任务：${nxt ? `练习“${nxt.th || nxt.en || nxt.id}”` : "完成3次练习"}` };
    return { tip, nextSkill: nxt || null };
  },
}, { note: "80-node skill map (real nextSkill engine)" });
tigaHub.registerEngine("coach", {
  explainSongResult(result, mem) {
    const acc = result && (typeof result.acc === "number" ? result.acc : result.accuracy);
    if (acc == null) return null;
    const d = attempt(() => _hubDiag({ memory: mem || null })) || null;
    const stars = result.stars != null ? result.stars : (acc >= 95 ? 3 : acc >= 85 ? 2 : acc >= 70 ? 1 : 0);
    const what = d && d.what ? d.what : null;
    const focusLabel = what ? what.label : null;
    const tip = stars >= 3
      ? { th: "🔥 ครบ 3 ดาว! รอบหน้าลองเปิดเมโทรนอมเร็วขึ้น 5 BPM", en: "🔥 3 stars! Next round, try +5 BPM on the metronome", zh: "🔥 三星！下次节拍器加快5" }
      : focusLabel
        ? { th: `🎯 โฟกัส "${focusLabel}"${what && typeof what.acc === "number" ? ` (ล่าสุด ${what.acc}%)` : ""} — ซ้อมช้า 3 ครั้งให้สมบูรณ์ แล้วค่อยเร่ง`, en: `🎯 Focus "${focusLabel}"${what && typeof what.acc === "number" ? ` (last ${what.acc}%)` : ""} — 3 slow perfect passes before speeding up`, zh: `🎯 专注“${focusLabel}”${what && typeof what.acc === "number" ? `（上次${what.acc}%）` : ""}，慢速完美弹3次再加速` }
        : { th: "🎯 ผ่อนความเร็ว 15% แล้วซ้อมท่อนสั้นที่พลาด กลับมาเต็มความเร็วหลังผ่าน 2 รอบ", en: "🎯 Slow to 85%, drill the missed short section, return after 2 clean passes", zh: "🎯 放慢15%练错段，两次全对后回原速" };
    return { tip, stars, acc, focus: focusLabel || null };
  },
}, { note: "diagnosis engine: real tempo bands + weak-spot targeting" });
tigaHub.registerEngine("diagnosis", {
  learnerSummary(mem, plog, profile) {
    const d = attempt(() => _hubDiag({ memory: mem || null, practiceLog: plog || null })) || null;
    const accs = plog && typeof plog === "object" ? Object.values(plog).map(v => v && v.acc).filter(a => typeof a === "number") : [];
    const avg = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;
    const struggles = (mem && mem.struggles) || [];
    return {
      avgAcc: avg, rounds: accs.length, topStruggle: struggles[0] || null,
      streak: profile && typeof profile.streak === "number" ? profile.streak : null,
      line: avg == null ? null : {
        th: `ความแม่นเฉลี่ย ${avg}% จาก ${accs.length} รอบซ้อม${struggles[0] ? ` · จุดต้องเก็บ: ${struggles[0]}` : ""}`, en: `${avg}% average accuracy over ${accs.length} rounds${struggles[0] ? ` · weak spot: ${struggles[0]}` : ""}`, zh: `平均准确率 ${avg}%（${accs.length} 次练习）${struggles[0] ? ` · 薄弱点：${struggles[0]}` : ""}` },
    };
  },
}, { note: "buildDiagnosis learner lines (real engine)" });

/* ── Phase 5: attach the capability engine (real t×m×s scoring from the
   seeded KB) so hub.capability()/summary() report 🟢🟡⚪ from live state,
   and mount the first deep SPECIALISTS — one engine deep in ONE topic
   domain, consulted specialist-first by every topic-tagged intent. New
   specialists land here as one registerSpecialist call: zero UI change. ── */
try { tigaHub.attachCapabilityEngine(() => getCapabilityEngine()); } catch (e) { /* capability view degrades to engine/baseline status */ }
tigaHub.registerSpecialist("technique", {
  explainSongResult(result, mem) {
    const acc = result && (typeof result.acc === "number" ? result.acc : result.accuracy);
    if (acc == null) return null;
    const tempo = attempt(() => coachTempoTarget({ accuracy: acc, bpm: result.bpm })) || null;
    const bpmTxt = tempo && tempo.bpm ? ` ที่ ${tempo.bpm} BPM` : "";
    const decision = tempo && tempo.decision ? tempo.decision : "";
    return {
      specialist: "technique",
      tip: acc < 75
        ? { th: `🎹 (ผู้เชี่ยวชาญเทคนิค) ลดจังหวะ${bpmTxt || " 15%"} แล้วซ้อมมือแยกสองมือ — มือซ้ายช้าได้ก่อน ค่อยรวมเมื่อเล่นได้ 3 รอบติด`, en: `🎹 (technique specialist) Drop the tempo${bpmTxt || " 15%"} and hands-separate — left hand first, combine after 3 clean passes`, zh: `🎹（技术专长）放慢速度${bpmTxt || "15%"}，分手练习——先练左手，3次全对后再合手` }
        : { th: `🎹 (ผู้เชี่ยวชาญเทคนิค) เล่นได้แล้ว${bpmTxt ? " " + bpmTxt.trim() : ""} — เพิ่มน้ำหนักกดคีย์ให้เสียงลึกเท่ากันทั้ง 5 นิ้ว จะได้น้ำเสียงสม่ำเสมอ`, en: `🎹 (technique specialist) Solid${bpmTxt ? " at " + bpmTxt.trim() : ""} — now even out key weight across all five fingers for a consistent tone`, zh: `🎹（技术专长）已稳定${bpmTxt ? "（" + bpmTxt.trim() + "）" : ""}——让五指下键力度均匀，音色统一` },
      tempo,
    };
  },
}, { note: "hands-separate / tempo-ladder depth (real coach tempo engine)" });
tigaHub.registerSpecialist("theory", {
  /* Knowledge-drop ranking (P6): the played note's own fact unless this
     learner already collected it — then no drop claim (caller keeps its
     own behavior). Teaches unheard facts first. */
  knowledgeForNote(noteName, ctx) {
    const cands = (ctx && ctx.candidates) || {};
    const shelf = (ctx && ctx.shelf) || [];
    const pc = String(noteName || "").replace(/-?\d+$/, "");
    if (!cands[pc]) return null;
    if (shelf.some(x => x && x.pc === pc)) return null; // already learned — rotate elsewhere
    return { fact: cands[pc], reason: "unheard", via: "theory" };
  },
  explainSongResult(result, mem) {
    const acc = result && (typeof result.acc === "number" ? result.acc : result.accuracy);
    if (acc == null) return null;
    return {
      specialist: "theory",
      tip: acc >= 90
        ? { th: "🎼 (ผู้เชี่ยวชาญทฤษฎี) ลองหาคอร์ด I–IV–V ในท่อนนี้ก่อนเล่นรอบหน้า — เห็นโครงสร้างแล้วจะอ่านโน้ตเร็วขึ้นเอง", en: "🎼 (theory specialist) Before the next run, find the I–IV–V chords in this piece — seeing structure makes reading faster", zh: "🎼（理论专长）下次演奏前先找 I–IV–V 和弦——看清结构，读谱更快" }
        : { th: "🎼 (ผู้เชี่ยวชาญทฤษฎี) ไล่ชื่อโน้ต 5 ตัวแรกของแต่ละท่อนก่อนเล่น — สมองจะเตรียมตำแหน่งมือให้ล่วงหน้า", en: "🎼 (theory specialist) Name the first five notes of each section before playing — your hand learns where to go", zh: "🎼（理论专长）弹奏前先说出每段前五个音——手会提前到位" },
    };
  },
}, { note: "structure-first reading (chord functions, key geography)" });
tigaHub.registerSpecialist("sight-reading", {
  recommendSightReading(mem, cur) {
    const struggles = ((mem && mem.struggles) || []).map(s => (s && typeof s === "object") ? (s.label || s.th || s.en || s.code || "") : (typeof s === "string" ? s : "")).filter(Boolean);
    return {
      specialist: "sight-reading",
      clef: (cur && cur.clef) || "treble",
      tip: struggles.length
        ? { th: `👁️ (ผู้เชี่ยวชาญอ่านโน้ต) วันนี้เน้น "${struggles[0]}" — อ่านชื่อโน้ตออกเสียงก่อนกดคีย์ทุกครั้ง จะจำตำแหน่งได้เร็วขึ้น 2 เท่า`, en: `👁️ (sight-reading specialist) Focus on "${struggles[0]}" — say each note name aloud before pressing; recognition doubles`, zh: `👁️（识谱专长）今天专注"${struggles[0]}"——按键前先读出音名，识谱速度翻倍` }
        : { th: "👁️ (ผู้เชี่ยวชาญอ่านโน้ต) ลองโหมด sprint — อ่านโน้ตให้เร็วที่สุดใน 60 วินาที ฝึกสายตาให้ไวกว่ามือ", en: "👁️ (sight-reading specialist) Try sprint mode — read as fast as you can in 60s; train the eyes ahead of the hands", zh: "👁️（识谱专长）试试冲刺模式——60秒内读谱，让眼睛快过手" },
    };
  },
}, { note: "eyes-ahead-of-hands drill depth" });

/* topic → exercise topic of the capability engine (t index): a tag hint →
   real exercise kind from the real generator */
tigaHub.registerSpecialist("repertoire", {
  /* Smart Daily Song: pick from the app's REAL song list using the real
     learner record — struggle coverage first, then the skill graph's next
     domain, never the 3-star set from the past week. Ties → deterministic
     day-hash so two devices agree. No candidate fits → null (caller keeps
     its day-hash pick; nothing invented). */
  recommendDailySong(songs, ctx) {
    if (!Array.isArray(songs) || !songs.length) return null;
    const mem = (ctx && ctx.memory) || {};
    const log = (ctx && ctx.practiceLog) || {};
    const starMap = (ctx && ctx.starMap) || {};
    const struggles = ((mem.struggles) || []).map(x => (x && typeof x === "object") ? (x.label || "") : String(x || "")).filter(Boolean);
    const dayKey = (ctx && ctx.dayKey) || "";
    let h = 0; for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) | 0;
    const dayHash = Math.abs(h);
    const starOf = (song) => starMap[song.id || song.en || ""] || 0;
    const mastered3 = songs.filter(s => starOf(s) >= 3);
    let pool = songs.filter(s => starOf(s) < 3);
    if (!pool.length) pool = songs.slice(); // everyone at 3 stars → all eligible again
    // 1) songs whose title matches a real struggle label (the "fix my weak spot" pick)
    const labelOf = (s) => (s && (s.en || s.th || s.zh || s.id)) || "";
    const cover = pool.filter(s => { const t = labelOf(s); return struggles.some(x => x && (t.includes(x) || x.includes(t))); });
    if (cover.length) { const s = cover[dayHash % cover.length]; return { song: s, reason: { th: `ซ้อมจุดที่ติง "${struggles[0]}" ผ่านเพลงนี้`, en: `Targets your weak spot "${struggles[0]}"`, zh: `针对弱点“${struggles[0]}”` }, via: "repertoire" }; }
    // 2) otherwise rotate not-yet-3-star songs deterministically per day
    const fresh = pool.filter(s => starOf(s) < 3);
    const pick = (fresh.length ? fresh : pool)[dayHash % (fresh.length ? fresh.length : pool.length)];
    if (pick && mastered3.includes(pick)) return null;
    return { song: pick, reason: { th: "เพลงที่ยังไม่ได้ดาวเต็ม — เก็บ 3 ดาวให้ครบวันนี้", en: "Not yet 3-starred — collect the last star today", zh: "还没满星——今天拿下最后一颗星" }, via: "repertoire" };
  },
  nextQuestHint(mem, profile, opts) {
    if (!opts || !opts.dailySong) return null; // only the tie-in voice
    return { tip: { th: `🎵 เพลงประจำวันวันนี้ (🎵 ${opts.dailySong}) จบ 1 รอบ = ภารกิจสำเร็จ`, en: `🎵 One run of today's song (🎵 ${opts.dailySong}) completes the quest`, zh: `🎵 弹一次今日曲目（🎵 ${opts.dailySong}）即完成任务` } };
  },
  chatStartersFor(mem, plog, profile) {
    const struggles = ((mem && mem.struggles) || []).map(x => (x && typeof x === "object") ? (x.label || x.th || "") : String(x || "")).filter(Boolean);
    const recent = (mem && mem.recent) || [];
    if (!struggles.length && !recent.length) return null; // nothing real → static pool
    const out = [];
    if (struggles[0]) out.push({ question: { th: `เห็นว่า "${struggles[0]}" ยังติงอยู่ — อยากลองวิธีซ้อมแบบอื่นไหม`, en: `"${struggles[0]}" is still tricky — want a different way to drill it?`, zh: `“${struggles[0]}”还有点难——换个练法？` }, contextLabel: struggles[0] });
    if (recent[0]) out.push({ question: { th: `รอบล่าสุดเล่น "${typeof recent[0] === "object" ? (recent[0].label || recent[0].song || "") : recent[0]}" มา — อยากเล่าประสบการณ์ให้ฟังไหม`, en: `You just played "${typeof recent[0] === "object" ? (recent[0].label || recent[0].song || "") : recent[0]}" — want to tell me how it went?`, zh: `刚弹完“${typeof recent[0] === "object" ? (recent[0].label || recent[0].song || "") : recent[0]}”——想聊聊感觉吗？` }, contextLabel: "recent" });
    if (out.length) return { starters: out, via: "repertoire" };
    return null;
  },
}, { note: "Smart Daily Song + personalized openers (real song list + real memory)" });
tigaHub.registerSpecialist("ear-training", {
  recommendSightReading(mem, cur) {
    return { specialist: "ear-training", clef: (cur && cur.clef) || "treble", tip: { th: "👂 (ผู้เชี่ยวชาญฝึกหู) ปิดตา 10 วินาทีก่อนเริ่ม — ฟังโน้ตในหัวก่อนเห็นบนหน้าจอ", en: "👁️ (ear specialist) Close your eyes for 10s first — hear the note before you see it", zh: "👂（练耳专长）先闭眼10秒——先在脑中听音再看屏幕" } };
  },
}, { note: "sound-before-sight drills" });

export function loadChatSessions() { return readStore(CHAT_STORE_KEY, []); }
export function appendChatSession(session) {
  const next = [session, ...loadChatSessions()].slice(0, 50); // newest first, cap 50
  writeStore(CHAT_STORE_KEY, next);
  return next;
}
export function deleteChatSession(id) {
  writeStore(CHAT_STORE_KEY, loadChatSessions().filter(s => s.id !== id));
  return loadChatSessions();
}
export function clearChatSessions() { writeStore(CHAT_STORE_KEY, []); }

export function loadEvalRuns() { return readStore(EVAL_STORE_KEY, []); }
export function saveEvalRun(run) {
  const next = [{ ...run, saved_at: new Date().toISOString() }, ...loadEvalRuns()].slice(0, 30);
  writeStore(EVAL_STORE_KEY, next);
  return next;
}
export function clearEvalRuns() { writeStore(EVAL_STORE_KEY, []); }

export { evaluateProvider, evaluateAllProviders, makeTIGARequest, createTeachingLoop, createTeachingPolicy };
