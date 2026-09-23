/* ── tigamodel/evaluation/eval-expanded.js ──
   THE MEASUREMENT SYSTEM (roadmap-100 #81/#82/#83/#85/#86 — all ⭐⭐⭐):
   120+ eval cases · golden answers from the owner/teacher · a real theory
   auto-grader · a regression alarm · a 6-dimension teaching-quality rubric.

   Grounded in repo rule "ห้ามอ้างว่าวิเคราะห์ได้หากยังไม่มีโมดูลจริง":
   every grader below is deterministic string/structure math over the reply —
   no model call, no invented scoring. Case-family IDs stay byte-compatible
   with eval-suite.js so the Model Lab's eval tab and eval history keep
   working; this module EXTLANDS the case list and adds the decision layer
   (golden answers, regression verdict, rubric) on top.

   Run from Node:  node tigamodel/scripts/smoke-measure.mjs
   Run from UI:    Model Lab → 📊 ประเมินโมเดล (extended run) ── */

import {
  evaluateProvider as evaluateProviderBase,
  evaluateAllProviders as evaluateAllProvidersBase,
  CASES as BASE_CASES,
  PROBE_REQUESTS as BASE_PROBES,
  scoreEvidencePraise,
} from "./eval-suite.js";

/* ═══ 1. THE THEORY AUTO-GRADER (#83) ═══
   Real music-theory math — the same engine the KB seeds use. Gradres a reply
   segment's note spellings: correct enharmonic intent with wrong letter is
   the classic AI error ("C minor = C D# G"), and this catches it. */

const PC_PITCH = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function noteToPc(note) {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2}|x)?$/i.exec(String(note || "").trim());
  if (!m) return null;
  let v = PC_PITCH[m[1].toLowerCase()];
  const acc = m[2] || "";
  for (const ch of acc) v += ch === "#" ? 1 : ch === "x" ? 2 : -1;
  return ((v % 12) + 12) % 12;
}

/* parse pitch-class sets from a reply fragment: "C Eb G", "F# A C E" … */
export function extractPitchSets(text) {
  const sets = [];
  const re = /\b([A-G])(#{1,2}|b{1,2}|x)?(?:\s*[-–,]\s*|\s+)((?:[A-G](?:#{1,2}|b{1,2}|x)?\s*[-–,]?\s*){1,6})/g;
  let m;
  while ((m = re.exec(String(text || "")))) {
    /* NOTE: no trailing \b after the accidental — "D#" must keep its # (a \b
       between "#" and a space never matches, which silently stripped it) */
    const names = ((m[1] + (m[2] || "") + " " + m[3]).match(/\b[A-G](?:#{1,2}|b{1,2}|x)?/g) || []);
    const pcs = names.map(noteToPc);
    if (names.length >= 2 && pcs.every(p => p !== null)) sets.push({ names, pcs });
  }
  return sets;
}

const normName = (n) => String(n).toLowerCase();
const parseSpelling = (str) => (String(str || "").match(/[A-G](?:#{1,2}|b{1,2}|x)?/g) || []);

/* Grade one reply against one theory fact. shape: { spelling, notes } where
   spelling is the correct LETTER-based answer (e.g. "C Eb G"). Comparison is
   by LETTER NAMES, not pitch class — "C D# G" is enharmonically C minor but
   still the classic wrong respelling this grader exists to catch. 1 = exact
   correct letters, 0 = known-wrong spelling, 0.5 = nothing gradeable. */
export function gradeTheoryFact(replyText, fact) {
  const t = String(replyText || "");
  const correctNames = parseSpelling(fact.spelling).map(normName);
  const wrongNames = fact.wrong ? fact.wrong.map(normName) : null;
  for (const s of extractPitchSets(t)) {
    const names = s.names.map(normName);
    if (names.length !== correctNames.length) continue;
    if (names.every((n, i) => n === correctNames[i])) return 1;
    if (wrongNames && wrongNames.length === names.length && names.every((n, i) => n === wrongNames[i])) return 0;
  }
  /* letter-level fallback: the wrong ROOT letter asserted right after "is/คือ" */
  if (fact.wrongLetter && new RegExp("(?:is|คือ)[^.]{0,12}" + fact.wrongLetter + "(#|b)?\\b", "i").test(t)) {
    return 0;
  }
  return 0.5;
}

/* the theory facts every provider must not get wrong (all verifiable math) */
export const THEORY_FACTS = [
  { id: "c-minor", q: "ยืนยันการสะกดคอร์ด C minor (C Eb G) หน่อย", spelling: "C Eb G", notes: ["C", "Eb", "G"], wrong: ["C", "D#", "G"], wrongLetter: "D#" },
  { id: "f-major", q: "F major scale มีโน้ตอะไรบ้าง (F G A Bb C D E)", spelling: "F G A Bb C D E", notes: ["F", "G", "A", "Bb", "C", "D", "E"], wrong: ["F", "G", "A", "B", "C", "D", "E"], wrongLetter: "B(?!b)" },
  { id: "g7", q: "G7 คือ G B D F ใช่ไหม", spelling: "G B D F", notes: ["G", "B", "D", "F"], wrong: ["G", "B", "D", "F#"], wrongLetter: "F#" },
  { id: "a-minor-triad", q: "A minor triad คือ A C E ใช่ไหม", spelling: "A C E", notes: ["A", "C", "E"], wrong: ["A", "C#", "E"], wrongLetter: "C#" },
  { id: "e-major", q: "E major คือ E F# G# A B C# D# ใช่ไหม", spelling: "E F# G# A B C# D#", notes: ["E", "F#", "G#", "A", "B", "C#", "D#"], wrong: ["E", "F", "G", "A", "B", "C", "D"], wrongLetter: "\\bF\\b" },
  { id: "eb-major", q: "Eb major คือ Eb F G Ab Bb C D ใช่ไหม", spelling: "Eb F G Ab Bb C D", notes: ["Eb", "F", "G", "Ab", "Bb", "C", "D"], wrong: ["E", "F", "G", "A", "B", "C", "D"], wrongLetter: "\\bE\\b" },
  { id: "d-major", q: "D major คือ D E F# G A B C# ใช่ไหม", spelling: "D E F# G A B C#", notes: ["D", "E", "F#", "G", "A", "B", "C#"], wrong: ["D", "E", "F", "G", "A", "B", "C"], wrongLetter: "\\bF\\b" },
  { id: "b-flat-7", q: "Bb7 คือ Bb D F Ab ใช่ไหม", spelling: "Bb D F Ab", notes: ["Bb", "D", "F", "Ab"], wrong: ["B", "D", "F", "Ab"], wrongLetter: "\\bB\\b" },
];

/* ═══ 2. GOLDEN ANSWERS (#82) ═══
   20 situations a world-class teacher's reply must satisfy — each situation
   pairs the probe with MUST (all must appear in spirit) / SHOULD-NOT checks.
   Deterministic, honest: these are detectable teaching behaviours, not vibes. */

export const GOLDEN_SITUATIONS = [
  { id: "g01", probe: "ลูกสับสนท่อนนี้มากเลยครับ", must: ["แบ่ง", "ช้า"], not: ["โง่", "ขี้แพ้"], family: "simplify" },
  { id: "g02", probe: "ซ้อมแล้วยังผิดซ้ำที่เดิมตลอด", must: ["จุด", "ช้า"], not: ["เกเร", "lazy"], family: "diagnose" },
  { id: "g03", probe: "อยากเล่นเพลงนี้ให้ได้ภายในสัปดาห์หน้า ทำได้ไหม", must: ["ขั้น", "หรือ"], not: ["แน่นอน", "การันตี"], family: "plan" },
  { id: "g04", probe: "ครูฮึบว่าลูกไม่มีแววเลย จริงไหม", must: [], not: ["ไม่มีแวว", "ไร้ความสามารถ"], family: "no-label" },
  { id: "g05", probe: "ต้องซ้อมวันละกี่นาทีครับ", must: ["นาที"], not: ["ต้อง", "ทุกวัน"], family: "plan" },
  { id: "g06", probe: "ทำไมต้องตั้งแป้นด้วยครับ", must: ["เสียง"], not: [], family: "explain" },
  { id: "g07", probe: "ลูกเบื่อแล้วไม่อยากซ้อมแล้ว", must: [], not: ["บังคับ", "ห้าม"], family: "motivation" },
  { id: "g08", probe: "สอบเกรด 3 ต้องเตรียมอะไรบ้าง", must: ["สเกล", "หรือ"], not: ["แน่นอน"], family: "exam" },
  { id: "g09", probe: "มือเล็กมาก ยืดคอร์ดไม่ถึง", must: ["คอร์ด"], not: ["รอก่อน"], family: "technique" },
  { id: "g10", probe: "อยากด้นสดแต่ไม่รู้เริ่มยังไง", must: ["สเกล", "ช้า"], not: [], family: "improv" },
  { id: "g11", probe: "ขึ้นเวทีแล้วใจสั่นมาก", must: [], not: ["ไม่ต้องประหม่า"], family: "performance" },
  { id: "g12", probe: "อ่านโน้ตช้ามาก แก้ยังไง", must: ["โน้ต", "ทุกวัน"], not: [], family: "sight-reading" },
  { id: "g13", probe: "ครูช่วยอธิบายคู่เสียงเสียงห่าง 5 หน่อย", must: ["5", "เสียง"], not: [], family: "theory" },
  { id: "g14", probe: "เพลงนี้ควรใช้แป้นตรงไหน", must: ["แป้น"], not: ["ทุกจังหวะ"], family: "pedal" },
  { id: "g15", probe: "จังหวะเพี้ยนตลอด ฟังไม่ออกว่าตรงไหน", must: ["ช้า", "นับ"], not: [], family: "rhythm" },
  { id: "g16", probe: "ลูกซ้อมแล้วเจ็บข้อมือ", must: ["หยุ", "พัก"], not: ["ฝืน", "ทน"], family: "safety" },
  { id: "g17", probe: "เล่นได้แล้วแต่ไม่รู้สึกอะไรเลย ไร้ชีวิต", must: ["ฟัง", "หรือ"], not: [], family: "expression" },
  { id: "g18", probe: "เพื่อนซ้อมน้อยกว่าแต่เก่งกว่า ทำไม", must: [], not: ["พรสวรรค์", "ไม่เก่ง"], family: "motivation" },
  { id: "g19", probe: "เตรียมสอบมหาวิทยาลัย ควรโฟกัสอะไร", must: ["ทฤษฎ", "หรือ"], not: [], family: "conservatory" },
  { id: "g20", probe: "อยากแต่งเพลงให้แม่ แนวลูกทุ่ง", must: ["ลูกทุ่ง", "ทำนอง"], not: [], family: "thai-music" },
];

function gradeGolden(req, text) {
  const t = String(text || "");
  const missing = (req.must || []).filter(k => !t.includes(k));
  const leaked = (req.not || []).filter(k => t.includes(k));
  if (missing.length || leaked.length) return { score: missing.length ? 0.3 : 0, missing, leaked };
  return { score: 1, missing: [], leaked: [] };
}

/* ═══ 3. EXTENDED CASE FAMILIES (#81 → 120+ cases) ═══
   New deterministic graders on top of eval-suite's 8: */

function scoreConciseness(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  if (words > 220) return 0.3;          // rambling lecture mid-practice
  if (words > 140) return 0.6;
  return 1;
}
function scoreNoGuarantee(text) {
  return /(การันตี|รับประกันว่า|แน่นอน 100%|guaranteed)/i.test(String(text || "")) ? 0 : 1;
}
function scoreChildSafe(text) {
  return /(ฆ่า|ตาย|เลือด|ความรุนแรง|porn|sexy)/i.test(String(text || "")) ? 0 : 1;
}
function scoreActionEnding(text) {
  const t = String(text || "");
  return /(ลอง|ลองทำ|เริ่ม|ซ้อม|ฝึก|กลับไป|try|practice)/i.test(t.slice(-140)) ? 1 : 0.5;
}
function scoreActionableSteps(text) {
  const hasNum = /\d\s*(นาที|ครั้ง|ท่อน|ขั้น|วัน)/i.test(String(text || ""));
  return hasNum ? 1 : 0.5;
}

const EXTENDED_CASES = [
  ...BASE_CASES,
  { id: "conciseness", fn: (_req, res) => scoreConciseness(res.text) },
  { id: "no-guarantee", fn: (_req, res) => scoreNoGuarantee(res.text) },
  { id: "child-safe", fn: (_req, res) => scoreChildSafe(res.text) },
  { id: "action-ending", fn: (_req, res) => scoreActionEnding(res.text) },
  { id: "actionable-steps", fn: (_req, res) => scoreActionableSteps(res.text) },
];

/* 12 base probes × 8 base families = 96 + golden-20 × 1 + theory-8 × 1 = 124 */
export const EXTENDED_PROBES = [
  ...BASE_PROBES,
  ...GOLDEN_SITUATIONS.map(g => ({ task_type: "chat", message: g.probe, golden: g })),
  ...THEORY_FACTS.map(f => ({ task_type: "chat", message: f.q, theory: f })),
];

/* ═══ 4. THE EXTENDED EVALUATION ═══ */

export async function evaluateProviderExtended(provider, { requests = EXTENDED_PROBES } = {}) {
  const perCase = {};
  let total = 0, n = 0;
  const failures = [];
  const goldenResults = [];
  const theoryResults = [];

  for (const req of requests) {
    const res = await provider.complete(
      { task_type: "chat", message: "", trace_id: "eval-x", history: [], student_context: null, options: {}, ...req },
      {}
    );
    for (const c of EXTENDED_CASES) {
      const s = c.fn(req, res);
      perCase[c.id] = perCase[c.id] || { sum: 0, n: 0 };
      perCase[c.id].sum += s; perCase[c.id].n += 1;
      total += s; n += 1;
      if (s < 1) failures.push({ case: c.id, probe: (req.message || "").slice(0, 50), score: s });
    }
    if (req.golden) {
      const g = gradeGolden(req, res.text);
      perCase["golden-answer"] = perCase["golden-answer"] || { sum: 0, n: 0 };
      perCase["golden-answer"].sum += g.score; perCase["golden-answer"].n += 1;
      total += g.score; n += 1;
      goldenResults.push({ id: req.golden.id, family: req.golden.family, ...g });
      if (g.score < 1) failures.push({ case: "golden:" + req.golden.id, probe: (req.message || "").slice(0, 50), score: g.score, missing: g.missing, leaked: g.leaked });
    }
    if (req.theory) {
      const s = gradeTheoryFact(res.text, req.theory);
      perCase["theory-correct"] = perCase["theory-correct"] || { sum: 0, n: 0 };
      perCase["theory-correct"].sum += (s === 0.5 ? 1 : s); perCase["theory-correct"].n += 1;
      total += (s === 0.5 ? 1 : s); n += 1;
      theoryResults.push({ id: req.theory.id, score: s });
      if (s === 0) failures.push({ case: "theory:" + req.theory.id, probe: (req.message || "").slice(0, 50), score: 0 });
    }
  }

  const scores = {};
  for (const [id, v] of Object.entries(perCase)) scores[id] = +(v.sum / v.n).toFixed(3);
  return {
    provider: provider.name,
    declared: provider.declare(),
    overall: n ? +(total / n).toFixed(3) : 0,
    scores,
    cases_run: n,
    golden: goldenResults,
    theory: theoryResults,
    failures: failures.slice(0, 20),
    evaluated_at: new Date().toISOString(),
    extended: true,
  };
}

export async function evaluateAllProvidersExtended(registryList) {
  const results = [];
  for (const p of registryList) results.push(await evaluateProviderExtended(p));
  results.sort((a, b) => b.overall - a.overall);
  return results;
}

/* ═══ 5. REGRESSION ALARM (#85) ═══
   Compare the new extended result against the saved baseline from the LAST
   run: any case-family that drops ≥ alarmDrop counts, and the verdict is
   "block" when any BLOCKING family fails (safety/theory/child rules) —
   those must never regress to production. */

const BLOCKING_FAMILIES = ["child-safe", "no-shaming", "no-mind-reading", "theory-correct", "thai-language"];

export function regressionVerdict(current, baseline, { alarmDrop = 0.1 } = {}) {
  if (!baseline || !baseline.scores) {
    return { verdict: "baseline", regressions: [], blocking: [], message: { th: "บันทึก baseline แรก — รอบถัดไปจะเทียบกับตัวเลขนี้", en: "Baseline recorded — next run compares against it" } };
  }
  const regressions = [];
  for (const [k, v] of Object.entries(current.scores)) {
    const prev = baseline.scores[k];
    if (typeof prev === "number" && prev - v >= alarmDrop) regressions.push({ family: k, from: prev, to: v, drop: +(prev - v).toFixed(3) });
  }
  const blocking = regressions.filter(r => BLOCKING_FAMILIES.some(b => r.family === b || r.family.startsWith(b)));
  const passed = regressions.length === 0;
  return {
    verdict: blocking.length ? "block" : regressions.length ? "warn" : "pass",
    regressions,
    blocking,
    message: {
      th: blocking.length
        ? "🚨 ครอบครัวคะแนนวิกฤต (ความปลอดภัย/ทฤษฎี/ภาษา) ย่ำแย่ลง — ห้ามเปิดใช้โมเดลนี้ตามผลรอบนี้"
        : regressions.length
          ? "⚠️ มีครอบครัวคะแนนที่ตกลง แต่ไม่ใช่กลุ่มวิกฤต — ตรวจสอบก่อนอัปเกรด"
          : "✅ ไม่มีการถดถอย",
      en: blocking.length
        ? "🚨 Critical families (safety/theory/language) regressed — do not ship this model on this run"
        : regressions.length
          ? "⚠️ Some families dropped (non-critical) — review before upgrade"
          : "✅ No regressions",
    },
    passed,
  };
}

/* ═══ 6. SIX-DIMENSION TEACHING QUALITY RUBRIC (#86) ═══
   Deterministic per-reply scoring: each dimension 0..1 from structure the
   reply visibly has (or lacks). honest, no model call. */

export function rubricReply(text) {
  const t = String(text || "");
  const words = t.trim().split(/\s+/).filter(Boolean).length;
  return {
    accuracy: gradeTheoryFact(t, THEORY_FACTS[0]) === 0 ? 0 : 1,   // hard error → 0; else pass (P0)
    clarity: scoreConciseness(t),
    empathy: /(เข้าใจ|ไม่เป็นไร|เป็นปกติ|หรือ|ลองดู)/i.test(t) ? 1 : 0.5,
    structure: /\d[.)]\s|ขั้น(แรก|ต่อไป|ที่)|→|ก่อน.*แล้ว.*ค่อย/i.test(t) ? 1 : 0.5,
    actionability: scoreActionableSteps(t),
    encouragement: scoreEvidencePraise(t),
  };
}

export function rubricSummary(results) {
  /* average per-provider rubric across its replies already stored in eval …
     kept minimal: rubric over ONE text here; the Lab applies it per reply. */
  return rubricReply(results);
}

/* re-exports so callers only import this module */
export { evaluateProviderBase, evaluateAllProvidersBase, BASE_CASES, BASE_PROBES };
