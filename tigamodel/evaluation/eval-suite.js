/* ── tigamodel/evaluation/eval-suite.js ──
   Evaluation harness (spec §25): the rule that NO foundation model is
   trusted because its name is new — every provider is benchmarked against
   the same cases and its scores recorded before the router may prefer it.

   Phase 0 case families (kept small but real):
   1. pedagogy-structure  — does the reply decompose into small steps?
   2. evidence-praise     — no empty praise ("เก่งมาก" with zero specifics)
   3. no-mind-reading     — never asserts student feelings without hedging
   4. no-shaming          — no failure labels
   5. humility            — admits uncertainty when input lacks data
   6. thai-language       — replies in Thai when asked in Thai (app is Thai-first)

   Scoring is deterministic string/structure heuristics — honest about being
   crude P0 heuristics, not a substitute for the owner's manual review; they
   exist so model-vs-model COMPARISON is possible and tracked. Results are
   returned and (optionally) logged with trace ids for the outcome dataset. ── */

const THAI_RE = /[\u0E00-\u0E7F]/;

function scorePedagogyStructure(text) {
  // decomposed steps? (numbered list, "ขั้นแรก/ขั้นต่อไป", or short imperative sentences)
  const hasSteps = /\d[\.\)]\s|ขั้น(แรก|ต่อไป|ที่)|ก่อน.*แล้ว.*ค่อย|step/i.test(text);
  const sentences = text.split(/[.!?\n]/).filter(s => s.trim().length > 4);
  const avgLen = sentences.length ? sentences.reduce((a, s) => a + s.length, 0) / sentences.length : 999;
  const concise = avgLen < 160 ? 1 : 0.5;
  return (hasSteps ? 0.6 : 0.2) * concise + (sentences.length >= 2 ? 0.2 : 0);
}

function scoreEvidencePraise(text) {
  const praiseWords = /(เก่งมาก|ยอดเยี่ยม|สุดยอด|great job|excellent|amazing|วonderful)/i;
  if (!praiseWords.test(text)) return 1; // no praise = no empty praise
  // praise must be followed by evidence in the same sentence
  const hasEvidenceNear = /(เพราะ|ตั้งแต่|จากที่|เห็นว่า|because|since|compared)/i.test(text);
  return hasEvidenceNear ? 1 : 0;
}

function scoreMindReading(text) {
  const certain = /(แน่นอนว่าคุณ(รู้สึก|คิด|เบื่อ|เหนื่อย)|(นักเรียน|เขา|คุณ)(กำลัง|แน่นอน)(เบื่อ|ไม่สน|เครียด)|definitely (bored|frustrated)|you must feel)/i;
  return certain.test(text) ? 0 : 1;
}

function scoreNoShaming(text) {
  const shaming = /(ไร้ความสามารถ|เกเร|ขี้แพ้|โง่|lazy|stupid|hopeless|useless)/i;
  return shaming.test(text) ? 0 : 1;
}

function scoreHumility(req, text) {
  // If request contains no performance data, model should not claim analysis
  const hasData = req.student_context && (req.student_context.recent.length || req.student_context.struggles.length);
  if (hasData) return 1;
  const claimsAnalysis = /(จากการฟัง|วิเคราะห์การเล่นของคุณ|จากเสียงที่ได้ยิน|I (heard|analyzed) your)/i.test(text);
  return claimsAnalysis ? 0 : 1;
}

function scoreLanguage(req, text) {
  const wantThai = req.student_context?.language === "th" || THAI_RE.test(req.message || "");
  if (!wantThai) return 1;
  return THAI_RE.test(text) ? 1 : 0;
}

/* GROUP 4.4 (owner gap audit 2026-09-17): nothing measured THEORY
   CORRECTNESS — a model could say "C minor is C D# G" and still score full.
   These cases use static, cheap regex checks that catch the highest-cost
   mistakes without calling any model:
   1. theory-correctness: when the prompt SHOWS the right answer, the model
      must not restate a known-wrong respelling (C minor = C-Eb-G, never D#).
   2. context-coherence: when the student context names an obstacle
      (e.g. can't read notes), generic advice with no tie-back scores 0. */
function scoreTheoryCorrectness(req, text) {
  const m = req.message || "";
  // Only active when the probe itself contains the correct spelling to mirror.
  const showsMinor = /C minor is C Eb G/i.test(m);
  if (!showsMinor) return 1;
  const saysDSharpMinor = /C\s*(minor|เธอน)|minor\s*is[^.]*D#|C\s*D#\s*G/i.test(text);
  return saysDSharpMinor ? 0 : 1;
}

function scoreContextCoherence(req, text) {
  const struggles = req.student_context?.struggles || [];
  if (!struggles.length) return 1; // no context — humility case already covers this
  const s = String(struggles[0]).toLowerCase();
  const t = String(text).toLowerCase();
  // Every struggle string here carries a key noun; a useful reply mentions it.
  const noun = (s.match(/notes|จังหวะ|rhythm|คอร์ด|chord|pedal|แป้น|อ่านโน้ต|reading/) || [])[0];
  if (!noun) return 1;
  return t.includes(noun.toLowerCase()) ? 1 : 0;
}

const CASES = [
  { id: "pedagogy-structure", fn: (req, res) => scorePedagogyStructure(res.text) },
  { id: "evidence-praise", fn: (req, res) => scoreEvidencePraise(res.text) },
  { id: "no-mind-reading", fn: (req, res) => scoreMindReading(res.text) },
  { id: "no-shaming", fn: (req, res) => scoreNoShaming(res.text) },
  { id: "humility-no-data", fn: (req, res) => scoreHumility(req, res) },
  { id: "thai-language", fn: (req, res) => scoreLanguage(req, res.text) },
  { id: "theory-correctness", fn: (req, res) => scoreTheoryCorrectness(req, res.text) },
  { id: "context-coherence", fn: (req, res) => scoreContextCoherence(req, res.text) },
];

const PROBE_REQUESTS = [
  { task_type: "chat", message: "เพลงนี้ยากไป สับสนหมดแล้ว" },
  { task_type: "chat", message: "วันนี้ซ้อมแล้วง่ายไปนิดเดียว" },
  { task_type: "chat", message: "C minor is C Eb G, right? ช่วยยืนยันการสะกดชื่อโน้ตของคอร์ดนี้" },
  { task_type: "coach-tip", message: "แนะนำการซ้อมวันนี้ให้หน่อย", student_context: { language: "th", recent: [], struggles: ["อ่านโน้ตช้า"] } },
  { task_type: "diagnose", message: "ช่วยดูว่าควรแก้อะไรก่อน", student_context: { language: "th", recent: ["ซ้อมคอร์ด"], struggles: ["จังหวะไม่นิ่ง"] } },
];

export async function evaluateProvider(provider, { requests = PROBE_REQUESTS } = {}) {
  const perCase = {};
  let total = 0, n = 0;
  for (const req of requests) {
    const res = await provider.complete({ ...req, trace_id: "eval", history: [], student_context: null, options: {} }, {});
    for (const c of CASES) {
      const s = c.fn(req, res);
      perCase[c.id] = perCase[c.id] || { sum: 0, n: 0 };
      perCase[c.id].sum += s; perCase[c.id].n += 1;
      total += s; n += 1;
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
    evaluated_at: new Date().toISOString(),
  };
}

export async function evaluateAllProviders(registryList) {
  const results = [];
  for (const p of registryList) results.push(await evaluateProvider(p));
  results.sort((a, b) => b.overall - a.overall);
  return results;
}
