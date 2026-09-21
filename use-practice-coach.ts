import { useEffect, useState } from "react";
import { coachTempoTarget, coachRecap, generateStudentExercise, studentExerciseKinds, getCoach } from "./tigamodel/web";

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

const TOPIC_RULES = [
  { test: s => s.rhythmMiss, topic: 4 },  // genRhythm
  { test: s => s.dynMiss, topic: 8 },     // genDynamics (t8 = genDynamics in GENERATORS)
  { test: s => s.missedNotes, topic: 5 }, // genSight (read the notes you missed)
  { test: s => s.anyMiss, topic: 1 },     // genIntervals — ear/hand connection
  { test: () => true, topic: 0 },         // genTheory — solid default
];

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

function nextSkillLabel() {
  try {
    const coach = getCoach();
    const next = coach && coach.nextSkill ? coach.nextSkill({}) : null;
    return next ? (next.th || next.en || null) : null;
  } catch (e) { return null; }
}

/* Main builder — pure data, no React, no DOM writes. Returns
   { tempo, recap, exercise } where any member may be null (honest hide). */
export function buildPracticeCoachData(args) {
  try {
    const { label, accuracy, missedNotes = [], rhythmPct = null, dynPct = null, practiceTarget = null, metroBpm = null, prevAccuracy = null, seed = null } = (args && typeof args === "object") ? args : {};
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
    const nextSkill = nextSkillLabel();
    const recap = coachRecap({ session, nextSkill: nextSkill ? { th: nextSkill } : null, tempo: tempo ? tempo.bpm : null });

    /* 3) NEXT EXERCISE — topic from what actually went wrong this drill,
       level from how the drill actually went, deterministic per label+day */
    const topic = pickTopic({ rhythmPct, dynPct, missedNotes });
    const level = levelFromAccuracy(accuracy);
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

/* Hook wrapper for PracticeOverlay: recomputes when the result changes. */
export function usePracticeCoach(args) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(args && args.label ? buildPracticeCoachData(args) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args && args.label, args && args.accuracy, args && args.rhythmPct, args && args.dynPct, args && args.metroBpm]);
  return data;
}
