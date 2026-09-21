import { useEffect, useState } from "react";
import { coachTempoTarget, coachRecap, generateStudentExercise, studentExerciseKinds, getCoach, getCoachDiagnosis } from "./tigamodel/web";
import { readAutoTeachOutcomes } from "./use-autoteach";

/* ── use-practice-coach.ts — TIGA Practice Coach (Phase 2, spec §34) ──
   Wires the ALREADY-BUILT model engines (coach.tempoTarget / coach.recap /
   generator.generateExercise — smoke-tested but never connected to a
   surface) into the practice result screen, fed by the learner's REAL
   practice record:

   1. TEMPO: tg_practice_log accuracy for THIS drill + the drill's own
      suggested BPM (practiceTarget[].bpm, set by the song/drum track) →
      coach.tempoTarget's flow-band decision (hold / +5 / −8 with reasons).
      No BPM anywhere → tempo section hides honestly.
   2. RECAP: coach.recap 3 lines + ≤15-min homework, from accuracy,
      last-week accuracy (tg_memory), worst real spot (highest-miss note),
      and the skill graph's actual next skill.
   3. NEXT EXERCISE: generateStudentExercise on a topic chosen from the
      coach's diagnosis of this drill (rhythm miss → rhythm topic, dynamic
      miss → dynamics, else theory/technique from the drill label) — the
      generator's real content, never invented.

   Pure data lives in buildPracticeCoachData (sync, no hooks) so the Node
   smoke test can esbuild-import the REAL file. The hook is a thin wrapper.
   Everything is best-effort: null means "no data — hide the section". ── */

/* Topic ids are the GENERATOR's own table (GENERATOR_KINDS, smoke-verified):
   0 theory · 1 technique · 2 sight · 3 ear · 4 expression · 5 practice-plan
   · 6 psych · 7 thai · 8 performance · 9 improv. First matching rule wins:
   dynamics → expression (crescendo/echo drills), missed pitches → sight
   reading, repeated failure/timing → the practice-plan "fix the stuck spot"
   (slow + isolate — the honest pedagogy for rhythm problems too). */
const TOPIC_RULES = [
  { test: s => s.dynMiss, topic: 4 },        // genExpression — dynamics
  { test: s => s.missedNotes, topic: 2 },    // genSight — read the notes you missed
  { test: s => s.anyMiss, topic: 5 },        // genPractice — "แก้จุดติดขัด" plan (slow/isolate)
  { test: () => true, topic: 0 },            // genTheory — solid default
];

/* The teaching loop's chosen strategy ALSO steers the exercise: a strategy is
   a teaching decision, so the next exercise must obey it (spec §21 loop —
   RESPOND then ADAPT, not just advise). Effects compose with signal rules. */
const STRATEGY_EFFECTS = {
  "return-to-prerequisite":       { topic: 5, levelBias: -1 },
  "simplify-on-confusion":        { topic: 5, levelBias: -1 },
  "simplify-on-hard-report":      { topic: 5, levelBias: -1 },
  "ease-off-on-low-engagement":   { topic: 6, levelBias: 0 },  // psych — motivation drills
  "raise-challenge":              { topic: null, levelBias: +1 },
  "continue-current-plan":        { topic: null, levelBias: 0 },
};

function pickTopic({ rhythmPct, dynPct, missedNotes }) {
  const sig = {
    rhythmMiss: rhythmPct != null && rhythmPct < 75,
    dynMiss: dynPct != null && dynPct < 75,
    missedNotes: Array.isArray(missedNotes) && missedNotes.length > 0,
    anyMiss: (rhythmPct != null && rhythmPct < 75) || (dynPct != null && dynPct < 75) || (Array.isArray(missedNotes) && missedNotes.length > 0),
  };
  const rule = TOPIC_RULES.find(r => r.test(sig));
  return rule ? rule.topic : 0;
}

function levelFromAccuracy(acc) {
  const a = typeof acc === "number" ? acc : 60;
  return a >= 95 ? 5 : a >= 85 ? 4 : a >= 70 ? 3 : a >= 50 ? 2 : 1;
}

/* OUTCOMES-DRIVEN LEVEL (Phase 2 finisher): how have THIS learner's past
   coach-guided attempts actually gone? Local, real data only:
     winRate = resolved tips where the next accuracy beat the last attempt —
   a high win rate earns a +1 level nudge (the tips are landing), a poor one
   a −1 (they aren't — don't push harder on a struggling learner). Bounded
   ±1, needs ≥3 resolved records to speak at all (small-n honesty). */
function levelBiasFromOutcomes() {
  try {
    const list = readAutoTeachOutcomes().filter(r => r && r.resolved && r.outcome);
    if (list.length < 3) return 0;
    const wins = list.filter(r => r.outcome.improved === true).length;
    const rate = wins / list.length;
    return rate >= 0.7 ? +1 : rate < 0.4 ? -1 : 0;
  } catch (e) { return 0; }
}

function drillBpm(target) {
  try {
    const arr = Array.isArray(target) ? target : [];
    for (const n of arr) { if (n && typeof n.bpm === "number" && n.bpm > 0) return n.bpm; }
  } catch (e) {}
  return null;
}

function logAccuracyFor(label) {
  try {
    const log = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem("tg_practice_log")) || "null");
    if (!log || !Array.isArray(log.recent)) return null;
    const rows = log.recent.filter(r => r && r.label === label && typeof r.acc === "number");
    return rows.length ? rows[rows.length - 1].acc : null;
  } catch (e) { return null; }
}

function memoryAccuracyFor(label) {
  try {
    const m = JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem("tg_memory")) || "null");
    if (!m || !Array.isArray(m.recent)) return null;
    const prev = m.recent.find(r => r && r.label === label);
    return prev && prev.acc != null ? prev.acc : null;
  } catch (e) { return null; }
}

function worstMissedNote(missedNotes) {
  try {
    if (!Array.isArray(missedNotes) || !missedNotes.length) return null;
    const counts = new Map();
    for (const n of missedNotes) counts.set(String(n), (counts.get(String(n)) || 0) + 1);
    let best = null, n = 0;
    for (const [k, v] of counts) if (v > n) { best = k; n = v; }
    return best;
  } catch (e) { return null; }
}

function nextSkillNode() {
  try {
    const coach = getCoach();
    const next = coach && coach.nextSkill ? coach.nextSkill({}) : null;
    return next || null; // full skill-graph node {th,en,zh,...} — recap picks the language
  } catch (e) { return null; }
}

/* Main builder — pure data, no React, no DOM writes. Returns
   { tempo, recap, exercise } where any member may be null (honest hide). */
export function buildPracticeCoachData(args) {
  try {
    const { label, accuracy, missedNotes = [], rhythmPct = null, dynPct = null, practiceTarget = null, metroBpm = null, prevAccuracy = null, seed = null, strategyId = null, lang = "th" } = (args && typeof args === "object") ? args : {};
    if (typeof label !== "string" || !label) return null;

    /* 1) TEMPO — only when the drill itself carries a BPM suggestion */
    const currentBpm = drillBpm(practiceTarget);
    const logAcc = logAccuracyFor(label);
    const tempoSrc = currentBpm != null ? {
      currentBpm,
      goalBpm: currentBpm,
      accuracy: (typeof accuracy === "number" ? accuracy : logAcc),
      cleanReps: (typeof accuracy === "number" && accuracy >= 95) ? 3 : 0,
    } : null;
    const tempo = tempoSrc ? coachTempoTarget(tempoSrc) : null;

    /* 2) RECAP — real before/after/worst-spot; skill-graph next step */
    const worst = worstMissedNote(missedNotes);
    const session = {
      accuracy: typeof accuracy === "number" ? accuracy : null,
      weekAgoAccuracy: prevAccuracy != null ? prevAccuracy : memoryAccuracyFor(label),
      worstSpotLabel: worst,
    };
    const nextSkill = nextSkillNode();
    const recap = coachRecap({ session, nextSkill, tempo: tempo ? tempo.bpm : null, lang });

    /* 3) NEXT EXERCISE — three honest signals compose:
       (a) what went wrong in THIS drill (signals → topic),
       (b) the teaching loop's strategy (a teaching DECISION — the exercise
           must obey it, spec §21 RESPOND→ADAPT),
       (c) this learner's real tip win-rate (tips landing → +1 level).
       Level = accuracy level + strategy bias + outcome bias, clamped 1..5. */
    const eff = (strategyId && STRATEGY_EFFECTS[strategyId]) || {};
    const topic = (eff.topic != null) ? eff.topic : pickTopic({ rhythmPct, dynPct, missedNotes });
    const level = Math.max(1, Math.min(5,
      levelFromAccuracy(accuracy)
      + (eff.levelBias || 0)
      + levelBiasFromOutcomes()));
    const daySeed = Math.floor(Date.now() / 86400000);
    const ex = generateStudentExercise(topic, level, (seed != null ? seed : daySeed) + topic * 17 + level);
    const kinds = studentExerciseKinds();
    const kindLabel = kinds && kinds[topic] ? kinds[topic].kind : null;

    return {
      tempo: tempo && tempo.bpm ? tempo : null,
      recap: recap || null,
      exercise: ex ? { ...ex, topic, level, kindLabel } : null,
      worstMissed: worst,
    };
  } catch (e) { return null; }
}

/* TEACHER-SIDE parent report (Phase 3 finisher): the SAME story the
   in-app parent popup tells, but computed from a student's SYNCED progress
   snapshot (school_roster → profiles.progress) instead of this device's
   localStorage. No storage access at all — the caller hands the snapshot
   in, so it stays tenant-safe by construction. Same honest-null contract. */
export function buildParentReportData(pr, { days = 14 } = {}) {
  try {
    if (!pr || typeof pr !== "object") return null;
    const plog = pr.practiceLog || {};
    const mem = pr.memory || {};
    const sum = pr.summary || {};
    const series = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let wkAcc = [], prevAcc = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const e = plog[k];
      const acc = e && e.n > 0 ? Math.round(e.accSum / e.n) : null;
      series.push({ day: k, acc, sessions: e ? e.n : 0 });
      if (acc != null) { (i < 7 ? wkAcc : prevAcc).push(acc); }
    }
    const avg = xs => xs.length ? Math.round(xs.reduce((s2, x) => s2 + x, 0) / xs.length) : null;
    const thisWeek = avg(wkAcc), lastWeek = avg(prevAcc);
    const topMiss = (mem.noteMisses || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0] || null;
    const improvements = (mem.struggles || [])
      .filter(s2 => s2.acc != null && s2.acc >= 65 && s2.last && Date.now() - s2.last <= 7 * 86400000)
      .map(s2 => ({ label: s2.label, delta: null }));
    return {
      series, weeklyAvg: thisWeek, prevAvg: lastWeek,
      trend: (thisWeek != null && lastWeek != null) ? thisWeek - lastWeek : null,
      sessions7: series.slice(-7).reduce((s2, d) => s2 + d.sessions, 0),
      avgAcc: sum.avgAcc || null, games: sum.games || null,
      improvements: improvements.slice(0, 4),
      topMiss: topMiss ? topMiss.label : null,
    };
  } catch (e) { return null; }
}

/* Hook wrapper for PracticeOverlay: recomputes when the result changes. */
export function usePracticeCoach(args) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(args && args.label ? buildPracticeCoachData(args) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args && args.label, args && args.accuracy, args && args.rhythmPct, args && args.dynPct, args && args.metroBpm, args && args.lang]);
  return data;
}

/* ══ PARENT REPORT BUILDER (Phase 2 finisher #2) ══
   The existing parent popup shows TODAY's counters; this adds the VISUAL
   trend + the coach's story, computed from the same local records the app
   already keeps (no new storage): 14-day accuracy bars from tg_practice_log,
   minutes from tg_act_log, the coach's diagnosis of the top struggle
   (getCoachDiagnosis — every claim backed by a real number), what actually
   IMPROVED this week (tg_memory: masteries + resolved tips that went up),
   and next week's homework focus. Everything nullable — a field the data
   can't support is simply absent. */
export function buildParentReport({ days = 14 } = {}) {
  try {
    if (typeof localStorage === "undefined") return null;
    const plog = JSON.parse(localStorage.getItem("tg_practice_log") || "{}") || {};
    const act = JSON.parse(localStorage.getItem("tg_act_log") || "[]") || [];
    const mem = JSON.parse(localStorage.getItem("tg_memory") || "null") || {};

    /* 14-day series — practice-log accuracy per day + minutes from act log */
    const dayMs = 86400000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const series = [];
    let wkAcc = [], prevAcc = [], minutes7 = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * dayMs);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const e = plog[k];
      const acc = e && e.n > 0 ? Math.round(e.accSum / e.n) : null;
      series.push({ day: k, acc, sessions: e ? e.n : 0 });
      if (acc != null) { (i < 7 ? wkAcc : prevAcc).push(acc); }
    }
    const cutoff = Date.now() - 7 * dayMs;
    for (const a of act) { if (a && a.t >= cutoff) minutes7 += Math.round(a.sec || 0) / 60; }

    /* honest trend: needs both weeks present to speak */
    const avg = xs => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
    const thisWeek = avg(wkAcc), lastWeek = avg(prevAcc);
    const trend = (thisWeek != null && lastWeek != null) ? thisWeek - lastWeek : null;

    /* what actually improved — real signals only */
    const improvements = [];
    for (const r of readAutoTeachOutcomes()) {
      if (r && r.resolved && r.outcome && r.outcome.improved === true && r.topic) {
        improvements.push({ label: r.topic, delta: r.outcome.delta });
      }
    }
    for (const s of (mem.struggles || [])) {
      if (s.acc != null && s.acc >= 65 && s.last && Date.now() - s.last <= 7 * dayMs) {
        improvements.push({ label: s.label, delta: null, note: "past-65" });
      }
    }

    /* coach's diagnosis of the top struggle (null when nothing on record);
       shape: { what:{label,acc,count,trend}, why[], how[], meta:{bpm,...} } */
    const diag = getCoachDiagnosis();

    /* homework focus = the worst real spot, from the same builder the result
       screen uses — one voice for parent and child */
    const topMiss = (mem.noteMisses || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0] || null;

    return {
      series,
      weeklyAvg: thisWeek, prevAvg: lastWeek, trend,
      minutes7: Math.round(minutes7),
      sessions7: series.slice(-7).reduce((s, d) => s + d.sessions, 0),
      improvements: improvements.slice(0, 4),
      focus: diag ? { label: diag.what ? diag.what.label : null, acc: diag.what ? diag.what.acc : null, why: diag.why || [], how: diag.how || [], bpm: diag.meta ? diag.meta.bpm : null } : null,
      homeworkNote: topMiss ? `โฟกัสโน้ต ${topMiss.label} — เล่นช้า 3 รอบให้สมบูรณ์ทุกวัน` : null,
    };
  } catch (e) { return null; }
}
