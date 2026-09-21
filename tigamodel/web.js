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
   synchronously, no network call, never throws. Returns null when anything
   is off (no singleton, no stats) so the caller can skip silently.
   (Self-learning outcome reinforcement is a SEPARATE async export —
   reinforceTeachingOutcome — called by finishPractice fire-and-forget.) ── */
export function runTeachingLoopForPractice(practiceStats, { selfReport = null } = {}) {
  try {
    if (!practiceStats) return null;
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.loop) return null;
    return tiga.loop.runOnce({ practiceStats, selfReport });
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
