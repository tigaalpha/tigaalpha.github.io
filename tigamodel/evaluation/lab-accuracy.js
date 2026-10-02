/* ── tigamodel/evaluation/lab-accuracy.js — docs/16 §2 (m50) ──
   THE MODEL'S ACCURACY AUDIT, as data — the same numbers the CI scorecard
   prints, computable in the browser from the REAL production modules, so
   TIGA MODEL LAB's new 🎯 ความแม่นยำ tab can render them live (and an admin
   can re-run any time the model changes).

   Layers (each answers ONE business question, all from real modules):
     1. kbRetrieval   — "ครูหยิบความรู้ถูกเรื่องไหม" — the 30-probe retrieval
                        eval (m07) served through the REAL getKBContext.
     2. teachingRules — "ครูตัดสินใจถูกกฎไหม" — policy fires on the right
                        states (scorecard bar 3's cases).
     3. materials     — "ครูผลิตสื่อได้ครบไหม" — exercise generator across
                        topics × levels, deterministic re-generation.
     4. answerQuality — "คำตอบมีคุณภาพไหม" — the extended eval suite's best
                        provider overall (the lab's own eval number).
     5. kbHealth      — "คลังความรู้สะอาดไหม" — kb-compliance flags over the
                        REAL KB (legal + provenance, steel rule 7).

   Every layer returns { name, score (0..100), bar, detail, pass }.
   Pure + sync (callers supply computed results); malformed input never
   throws; deterministic ordering. NO invented numbers — a layer the caller
   couldn't compute is reported as unavailable, never faked. ── */

import { RETRIEVAL_PROBES, RETRIEVAL_GATE, servedLabels, scoreRetrieval, retrievalAccuracy } from "./retrieval-eval.js";

/* Policy rule-cases (same decisions the CI scorecard's bar 3 asserts):
   each case = the learner state/signals/self-report and the strategy the
   teaching policy MUST pick. */
export const POLICY_ACCURACY_CASES = [
  { id: "confusion-hard", label: "สับสน+ยาก → ลดความซับซ้อน", expect: "simplify-on-confusion",
    states: [{ state: "confusion", probability: 0.9, confidence: 0.9, evidence: ["x"], modalities: [], alternatives: [] }, { state: "perceived_difficulty", probability: 0.85, confidence: 0.9, evidence: ["x"], modalities: [], alternatives: [] }], signals: {}, selfReport: null },
  { id: "low-understanding-repeat", label: "เข้าใจต่ำ+พลาดซ้ำ → ย้อนพื้นฐาน", expect: "return-to-prerequisite",
    states: [{ state: "understanding", probability: 0.2, confidence: 0.9, evidence: ["x"], modalities: [], alternatives: [] }], signals: { repeated_errors: 3 }, selfReport: null },
  { id: "too-easy", label: "บอกว่าง่าย → เพิ่มท้าทาย", expect: "raise-challenge",
    states: [], signals: {}, selfReport: "too_easy" },
  { id: "too-hard", label: "บอกว่ายาก → ลดภาระ", expect: "simplify-on-hard-report",
    states: [], signals: {}, selfReport: "too_hard" },
  { id: "no-signal", label: "ไม่มีสัญญาณ → ดำเนินต่อ", expect: "continue-current-plan",
    states: [], signals: {}, selfReport: null },
];

export const MATERIALS_TOPICS = 10;
export const MATERIALS_LEVELS = 5;
export const MATERIALS_VARIETY_MIN = 6;

/* ── Layer 1: KB retrieval accuracy (needs { getKBContext }) ── */
export function auditKbRetrieval({ getKBContext } = {}) {
  if (typeof getKBContext !== "function") return null;
  const scored = RETRIEVAL_PROBES.map(p => ({ score: scoreRetrieval(p, servedLabels(getKBContext(p.q))) }));
  const acc = retrievalAccuracy(scored);
  return {
    score: acc * 100,
    bar: RETRIEVAL_GATE * 100,
    pass: acc >= RETRIEVAL_GATE,
    detail: `${RETRIEVAL_PROBES.length} probes (th/en) ผ่าน ${scored.filter(s => s.score === 1).length} — gate ${RETRIEVAL_GATE * 100}%`,
  };
}

/* ── Layer 2: teaching policy decisions (needs { policy }) ── */
export function auditTeachingRules({ policy } = {}) {
  if (!policy || typeof policy.evaluate !== "function") return null;
  const cases = POLICY_ACCURACY_CASES.map(c => {
    let got = null;
    try { got = policy.evaluate(c.states, c.signals, c.selfReport).strategy_id; } catch (e) { got = null; }
    return { id: c.id, label: c.label, expect: c.expect, got, ok: got === c.expect };
  });
  const ok = cases.filter(c => c.ok).length;
  return {
    score: (ok / cases.length) * 100,
    bar: 100,
    pass: ok === cases.length,
    detail: cases.map(c => `${c.ok ? "✓" : "✗"} ${c.label}`).join(" · "),
    cases,
  };
}

/* ── Layer 3: exercise material generation (needs { generateStudentExercise, kinds }) ── */
export function auditMaterials({ generateStudentExercise, kinds } = {}) {
  if (typeof generateStudentExercise !== "function" || !Array.isArray(kinds) || !kinds.length) return null;
  let made = 0, tried = 0;
  for (let t = 0; t < kinds.length; t++) for (let lvl = 1; lvl <= MATERIALS_LEVELS; lvl++) {
    tried++;
    const ex = generateStudentExercise(t, lvl, `lab-${t}-${lvl}`);
    if (ex && ex.task && ex.task.th) made++;
  }
  const det = JSON.stringify(generateStudentExercise(4, 2, 42)) === JSON.stringify(generateStudentExercise(4, 2, 42));
  const variety = new Set([...Array(8)].map((_, i) => { const x = generateStudentExercise(1, 3, i + 1); return x && x.task && x.task.th; })).size;
  const pct = (made / tried) * 100;
  return {
    score: pct,
    bar: 100,
    pass: pct === 100 && det && variety >= MATERIALS_VARIETY_MIN,
    detail: `${made}/${tried} ชุด (${kinds.length} หัวข้อ × ${MATERIALS_LEVELS} ระดับ) · สร้างซ้ำได้เหมือนเดิม: ${det ? "ใช่" : "ไม่"} · ความหลากหลาย ${variety} แบบ`,
  };
}

/* ── Layer 4: answer quality (needs { bestOverall } from the eval suite run) ── */
export function auditAnswerQuality({ bestOverall, casesRun, provider } = {}) {
  if (!Number.isFinite(bestOverall)) return null; // honest: no eval run → no number, never a guess
  const pct = bestOverall * 100;
  return {
    score: pct,
    bar: 75,
    pass: pct >= 75,
    detail: `${casesRun ?? 0} เคสกับ provider "${provider ?? "-"}" — ชุดเดียวกับ Model Lab ใช้กันเปลี่ยนโมเดล`,
  };
}

/* ── Layer 5: KB health (needs { auditResult }) from compliance/kb-compliance auditKB ── */
export function auditKbHealth({ auditResult, kbCount } = {}) {
  if (!auditResult || !Number.isFinite(auditResult.checked)) return null;
  const pct = 100 - Math.min(100, auditResult.flags.length);
  return {
    score: pct,
    bar: 100,
    pass: !!auditResult.clean,
    detail: `ตรวจจริง ${auditResult.checked.toLocaleString()} entries${kbCount != null ? ` (KB ${Number(kbCount).toLocaleString()})` : ""} · flag: ${auditResult.flags.length} · ที่มาไม่จดทะเบียน: ${auditResult.unregistered}`,
  };
}

/* ── The whole audit, assembled from the REAL web.js accessors ──
   runModelAccuracyAudit({ getKBContext, policy, generateStudentExercise,
   kinds, bestOverall, casesRun, provider, auditResult, kbCount }) */
export function runModelAccuracyAudit(args = {}) {
  const layers = [];
  const r = auditKbRetrieval(args); if (r) layers.push({ id: "kbRetrieval", name: "การหยิบความรู้ถูกเรื่อง (retrieval)", ...r });
  const t = auditTeachingRules(args); if (t) layers.push({ id: "teachingRules", name: "การตัดสินใจสอนถูกกฎ (policy)", ...t });
  const m = auditMaterials(args); if (m) layers.push({ id: "materials", name: "การผลิตสื่อการสอน (แบบฝึกหัด)", ...m });
  const a = auditAnswerQuality(args); if (a) layers.push({ id: "answerQuality", name: "คุณภาพคำตอบ (eval suite)", ...a });
  const h = auditKbHealth(args); if (h) layers.push({ id: "kbHealth", name: "คลังความรู้สะอาดเชิงกฎหมาย (compliance)", ...h });
  const scored = layers.filter(l => Number.isFinite(l.score));
  const overall = scored.length ? scored.reduce((s, l) => s + l.score, 0) / scored.length : null;
  const allPass = scored.length > 0 && scored.every(l => l.pass);
  return {
    overall,
    allPass,
    layers,
    unavailable: ["kbRetrieval", "teachingRules", "materials", "answerQuality", "kbHealth"].filter(id => !layers.some(l => l.id === id)),
    ranAt: null, // deterministic core — the caller stamps its own time for display/history
  };
}

/* History: per-browser (localStorage, the lab's own store pattern). Bounded,
   newest first, never throws (quota/private mode → memory only). */
const ACC_HISTORY_KEY = "tiga_lab_accuracy_history";
export function loadAccuracyHistory(store) {
  try {
    const raw = store && store.getItem ? store.getItem(ACC_HISTORY_KEY) : null;
    const v = raw ? JSON.parse(raw) : null;
    return v && Array.isArray(v.rows) ? v.rows : [];
  } catch (e) { return []; }
}
export function saveAccuracyRun(store, run) {
  try {
    if (!run || typeof run !== "object") return loadAccuracyHistory(store); // garbage in → state unchanged
    const prev = loadAccuracyHistory(store);
    // newest first, bounded — Array.from copies first so the stored snapshot
    // is independent of any later mutation (spread+slice keeps references)
    const rows = Array.from([{ ...run, saved_at: run.saved_at || new Date().toISOString() }, ...prev]).slice(0, 30);
    if (store && store.setItem) store.setItem(ACC_HISTORY_KEY, JSON.stringify({ rows }));
    return rows;
  } catch (e) { return loadAccuracyHistory(store); }
}
export function clearAccuracyHistory(store) {
  try { if (store && store.removeItem) store.removeItem(ACC_HISTORY_KEY); } catch (e) { /* private mode */ }
}
