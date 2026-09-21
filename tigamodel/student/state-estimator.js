/* ── tigamodel/student/state-estimator.js — Phase 4 foundation (spec §14–15, §17)
   Fuses OBSERVABLE SIGNALS into StudentStateEstimates. The teaching loop's
   inline estimation (teaching-loop.js) covers performance-only signals; this
   engine exists so the SAME schema can fuse MORE modalities without touching
   the loop: self-report (§17 — the student's own words weigh most), session
   signals, and recent history. Absolute rules:

   * Every output is a probability + confidence + evidence list — never an
     absolute claim about the learner ("not paying attention" is forbidden;
     "attention may be lower (p=0.54)" is the correct shape).
   * Self-report answers (§17 StudentFeedback) ALWAYS outrank inference from
     any single modality — the spec is explicit that direct answers carry
     more weight than guessing from behavior.
   * Alternative explanations are mandatory wherever inference is weak —
     a pause may be thinking, fatigue, technical trouble, not disengagement.
   * Camera/vision/audio inputs do NOT exist yet (§16: no reading mood from
     faces, ever). The estimator accepts modality weights but v1 only fuses
     self_report + session + history — honest about what it consumes.

   Pure + sync; no I/O. Errors → null (enhancement, never a crash path). ── */

import { makeStudentStateEstimate } from "../core/schema.js";

/* §17 self-report vocabulary → the state it directly evidences + weight.
   These mirror the questions the spec lists (ตรงนี้เข้าใจไหม / ง่ายไปหรือยากไป
   / อยากลองอีกครั้งไหม / ...) collapsed into the enum the UI asks. */
const SELF_REPORT_MAP = {
  understand:   { state: "understanding",         probability: 0.85, confidence: 0.9 },
  confused:     { state: "confusion",             probability: 0.85, confidence: 0.9 },
  too_easy:     { state: "perceived_difficulty",  probability: 0.2,  confidence: 0.85 },
  too_hard:     { state: "perceived_difficulty",  probability: 0.85, confidence: 0.85 },
  retry:        { state: "readiness_to_continue", probability: 0.85, confidence: 0.8 },
  frustrated:   { state: "frustration",           probability: 0.75, confidence: 0.85 },
  great:        { state: "enjoyment",             probability: 0.8,  confidence: 0.8 },
};

/* Modality weights per spec §17 (self-report > single-modality guessing).
   Vision/audio/STT are declared but 0-weight until real encoders exist. */
const MODALITY_WEIGHTS = {
  self_report:  0.5,
  session:      0.3,
  history:      0.2,
  conversation: 0.0,  // not consumed yet (§18: interface ready, encoder pending)
  vision:       0.0,  // §16: never mood-from-face; reserved for future consented signals
  audio:        0.0,
};

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/* Fuse one candidate state from multiple sources.
   sources = [{ modality, probability, confidence, evidence[], alternatives[] }]
   §17 DOMINANCE RULE: when a self_report source exists, its probability AND
   confidence ARE the output — the student's own answer is not averaged away
   by weaker inferences; other modalities remain as evidence/provenance only.
   Without a self-report, sources are weighted-mean fused by modality weight. */
function fuse(state, sources, alternatives) {
  const usable = sources.filter(s => (MODALITY_WEIGHTS[s.modality] || 0) > 0 && s.probability != null);
  if (!usable.length) return null;
  const sr = usable.find(s => s.modality === "self_report");
  let prob, conf;
  if (sr) {
    prob = clamp01(sr.probability);
    conf = clamp01(sr.confidence || 0.85);
  } else {
    const wsum = usable.reduce((a, s) => a + MODALITY_WEIGHTS[s.modality], 0);
    prob = usable.reduce((a, s) => a + s.probability * MODALITY_WEIGHTS[s.modality], 0) / wsum;
    conf = usable.reduce((a, s) => a + clamp01(s.confidence || 0.5) * MODALITY_WEIGHTS[s.modality], 0) / wsum;
  }
  const evidence = usable.flatMap(s => (s.evidence || []).slice(0, 3)).slice(0, 8);
  const alts = [...(alternatives || []), ...usable.filter(s => s !== sr).flatMap(s => s.alternatives || [])]
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
  return makeStudentStateEstimate({
    state, probability: clamp01(prob), confidence: clamp01(conf),
    evidence, modalities: usable.map(s => s.modality), alternatives: alts,
  });
}

/* estimateStates({ selfReport, session, history }) → StudentStateEstimate[]
   - selfReport: one of SELF_REPORT_MAP keys (or null)
   - session:    { accuracy, repeatedErrors, pauses, rhythmScore, durationMin }
   - history:    [{ accuracy, t }] most recent first (this week's attempts)
*/
export function estimateStates({ selfReport = null, session = null, history = null } = {}) {
  try {
    const out = [];
    const acc = session && typeof session.accuracy === "number" ? session.accuracy : null;
    const repeated = session ? (session.repeatedErrors || 0) : 0;
    const pauses = session ? (session.pauses || 0) : 0;

    /* history trend — real numbers only, needs ≥3 attempts to speak */
    let histProb = null, histEvidence = [];
    if (Array.isArray(history) && history.length >= 3) {
      const accs = history.slice(0, 3).map(h => h.accuracy).filter(a => typeof a === "number");
      if (accs.length === 3) {
        const delta = accs[0] - accs[2];
        histProb = clamp01(0.5 - delta * 0.02);          // falling accuracy → engagement risk signal
        histEvidence = [`last 3 attempts: ${accs.join("%, ")}%`];
      }
    }

    /* CONFUSION — self-report says so, or performance pattern suggests */
    {
      const sources = [];
      if (selfReport === "confused") sources.push({ modality: "self_report", probability: SELF_REPORT_MAP.confused.probability, confidence: SELF_REPORT_MAP.confused.confidence, evidence: ["student answered 'confused' directly"] });
      if (acc != null && acc < 65 && repeated >= 2) sources.push({ modality: "session", probability: Math.min(0.9, 0.5 + repeated * 0.1), confidence: 0.6, evidence: [`accuracy ${acc}%`, `${repeated} repeated error(s)`], alternatives: ["อาจซ้อมสด ๆ โดยยังไม่ได้แบ่งท่อน"] });
      const f = fuse("confusion", sources, ["อาจกำลังคิด", "อาจเหนื่อย", "อาจมีปัญหาทางเทคนิค"]);
      if (f) out.push(f);
    }

    /* PERCEIVED DIFFICULTY — self-report dominates (§17) */
    {
      const sources = [];
      if (selfReport === "too_hard") sources.push({ modality: "self_report", probability: SELF_REPORT_MAP.too_hard.probability, confidence: SELF_REPORT_MAP.too_hard.confidence, evidence: ["student answered 'too hard' directly"] });
      if (selfReport === "too_easy") sources.push({ modality: "self_report", probability: SELF_REPORT_MAP.too_easy.probability, confidence: SELF_REPORT_MAP.too_easy.confidence, evidence: ["student answered 'too easy' directly"] });
      if (acc != null && acc < 75) sources.push({ modality: "session", probability: 0.7, confidence: 0.5, evidence: ["ต้องซ้ำหลายครั้งโดยยังไม่ผ่าน"], alternatives: ["อาจแค่เหนื่อยหรือเบลอจอ"] });
      const f = fuse("perceived_difficulty", sources, ["ความยากจริงอาจต่ำกว่าที่รู้สึก"]);
      if (f) out.push(f);
    }

    /* UNDERSTANDING */
    {
      const sources = [];
      if (selfReport === "understand") sources.push({ modality: "self_report", probability: SELF_REPORT_MAP.understand.probability, confidence: SELF_REPORT_MAP.understand.confidence, evidence: ["student answered 'understood' directly"] });
      if (acc != null && acc >= 95) sources.push({ modality: "session", probability: Math.min(0.95, 0.6 + (acc - 95) * 0.07), confidence: 0.7, evidence: [`accuracy ${acc}% โดยไม่พลาดซ้ำ`] });
      const f = fuse("understanding", sources, []);
      if (f) out.push(f);
    }

    /* FRUSTRATION — mostly self-report; retries+low accuracy only hint */
    {
      const sources = [];
      if (selfReport === "frustrated") sources.push({ modality: "self_report", probability: SELF_REPORT_MAP.frustrated.probability, confidence: SELF_REPORT_MAP.frustrated.confidence, evidence: ["student reported frustration directly"] });
      if (repeated >= 3 && acc != null && acc < 60) sources.push({ modality: "session", probability: 0.55, confidence: 0.4, evidence: [`${repeated} repeated errors at ${acc}%`], alternatives: ["อาจแค่มุ่งมั่น ไม่ใช่หงุดหงิด"] });
      const f = fuse("frustration", sources, ["อาจเป็นความตั้งใจสูง", "อาจเหนื่อยกายภาพ"]);
      if (f) out.push(f);
    }

    /* HESITATION — pauses only (weak inference, alternatives mandatory) */
    if (pauses >= 3) {
      const f = fuse("hesitation", [{ modality: "session", probability: Math.min(0.85, 0.45 + pauses * 0.1), confidence: 0.55, evidence: [`${pauses} pause(s) ระหว่างเล่น`], alternatives: ["อาจกำลังอ่านโน้ต", "อาจคิดทางเทคนิค", "อาจเหนื่อย"] }], ["อาจกำลังอ่านโน้ต", "อาจเหนื่อย"]);
      if (f) out.push(f);
    }

    /* READINESS TO CONTINUE — retry answer, or inferred from flow */
    {
      const sources = [];
      if (selfReport === "retry") sources.push({ modality: "self_report", probability: SELF_REPORT_MAP.retry.probability, confidence: SELF_REPORT_MAP.retry.confidence, evidence: ["student chose 'try again'"] });
      const f = fuse("readiness_to_continue", sources, []);
      if (f) out.push(f);
    }

    /* ENJOYMENT — self-report only for now (never guessed from faces, §16) */
    if (selfReport === "great") {
      const f = fuse("enjoyment", [{ modality: "self_report", probability: SELF_REPORT_MAP.great.probability, confidence: SELF_REPORT_MAP.great.confidence, evidence: ["student reported enjoying it"] }], []);
      if (f) out.push(f);
    }

    /* ENGAGEMENT RISK — history trend (weak, history-weight only) */
    if (histProb != null && histProb >= 0.35) {
      const f = fuse("engagement_risk", [{ modality: "history", probability: histProb, confidence: 0.45, evidence: histEvidence, alternatives: ["อาจแค่ปกติของการเรียนรู้ ไม่ใช่ถอย"] }], ["อาจกำลังพักฟื้นมือ", "อาจยุ่งกับเรื่องอื่น"]);
      if (f) out.push(f);
    }

    return out;
  } catch (e) { return null; }
}

/* §17 StudentFeedback record factory — the shape the UI's micro-poll saves
   (client-side for now; the DB table comes when outcomes volume justifies). */
export function makeStudentFeedback({ studentId = null, sessionId = null, question = "", answer = "", feedbackType = null, reliability = 0.9 } = {}) {
  try {
    if (!answer && answer !== "") return null;
    const types = ["understanding", "difficulty", "enjoyment", "confidence"];
    return {
      student_id: studentId, session_id: sessionId,
      question: String(question || ""), answer: String(answer || ""),
      feedback_type: types.includes(feedbackType) ? feedbackType : null,
      timestamp: new Date().toISOString(),
      reliability: clamp01(reliability),
    };
  } catch (e) { return null; }
}

export const SELF_REPORT_OPTIONS = Object.keys(SELF_REPORT_MAP);
