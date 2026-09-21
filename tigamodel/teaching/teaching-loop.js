/* ── tigamodel/teaching/teaching-loop.js ──
   The REAL-TIME TEACHING LOOP (spec §21): OBSERVE → UNDERSTAND → ESTIMATE
   STUDENT STATE → DIAGNOSE → SELECT STRATEGY → RESPOND → (observe again …).
   Phase 0 runs the loop RULE-BASED on signals the app already produces
   (practice accuracy, repeated errors, pauses, self-reports) — no camera,
   no face reading, no unverifiable claims.

   Honest scope notes:
   - estimateStudentState() here is a deliberately conservative rule-based
     estimator: it only infers what the provided observations directly
     support, always with probability + confidence + alternative
     explanations (spec §15). It is NOT the P3 statistical estimator.
   - The loop returns everything as data so the outcome dataset (§24) can
     log observation → decision → response → measured result later. ── */

import { makeStudentStateEstimate, makeDiagnosis, makeObservation } from "../core/schema.js";

/* Phase 4 (spec §17): self-report vocabulary → the state it directly
   evidences. The student's own answer outranks inference — these values
   REPLACE any performance-guessed estimate of the same state (5b below). */
const SELF_REPORT_STATE = {
  confused:   { state: "confusion",            probability: 0.85, confidence: 0.9 },
  too_easy:   { state: "perceived_difficulty", probability: 0.2,  confidence: 0.85 },
  too_hard:   { state: "perceived_difficulty", probability: 0.85, confidence: 0.85 },
  understand: { state: "understanding",        probability: 0.85, confidence: 0.9 },
  frustrated: { state: "frustration",          probability: 0.75, confidence: 0.85 },
};

function est({ state, probability, confidence, evidence, alternatives }) {
  return makeStudentStateEstimate({ state, probability, confidence, evidence, modalities: ["performance", "conversation"], alternatives });
}

export function createTeachingLoop({ policy, kb, skillGraph } = {}) {
  async function runOnce({ observations = [], practiceStats = null, selfReport = null, studentContext = null, history = [] } = {}) {
    // 1-2. UNDERSTAND: normalize whatever arrived into observations
    const obs = (observations || []).map(o => makeObservation(o));

    // 3. ESTIMATE STUDENT STATE (rule-based, conservative, evidence-bound)
    const states = [];
    const signals = {};
    if (practiceStats) {
      const acc = typeof practiceStats.accuracy === "number" ? practiceStats.accuracy : null;
      const repeated = practiceStats.repeatedErrors || 0;
      const pauses = practiceStats.pauses || 0;
      signals.repeated_errors = repeated;
      signals.pauses = pauses;
      if (acc != null && acc < 65 && repeated >= 2) {
        states.push(est({
          state: "confusion", probability: Math.min(0.9, 0.5 + repeated * 0.1),
          confidence: 0.6,
          evidence: [`accuracy ${acc}%`, `${repeated} repeated error(s)`],
          alternatives: ["อาจยังไม่คุ้นกับทำนอง", "อาจซ้อมสด ๆ โดยยังไม่ได้แบ่งท่อน"],
        }));
        states.push(est({
          state: "perceived_difficulty", probability: 0.7, confidence: 0.5,
          evidence: ["ต้องซ้ำหลายครั้งโดยยังไม่ผ่าน"], alternatives: ["อาจแค่เหนื่อยหรือเบลอจอ"],
        }));
      }
      if (acc != null && acc >= 95) {
        states.push(est({
          state: "understanding", probability: Math.min(0.95, 0.6 + (acc - 95) * 0.07), confidence: 0.7,
          evidence: [`accuracy ${acc}% โดยไม่พลาดซ้ำ`], alternatives: [],
        }));
      }
      if (pauses >= 3) {
        states.push(est({
          state: "hesitation", probability: Math.min(0.85, 0.45 + pauses * 0.1), confidence: 0.55,
          evidence: [`${pauses} pause(s) ระหว่างเล่น`], alternatives: ["อาจกำลังอ่านโน้ต", "อาจคิดทางเทคนิค", "อาจเหนื่อย"],
        }));
      }
    }

    // 4. DIAGNOSE (rule codes the KB/exercise selectors can consume later).
    // Gap round 2 #8: three more codes from signals the app already produces —
    // hesitation (pauses), early-speed (rushing when accuracy is fine), and
    // progress-stall (a week of practice without accuracy growth when the
    // caller supplies history). Each maps to a KB tip via ISSUE_KB below.
    const issues = [];
    if (practiceStats) {
      if ((practiceStats.repeatedErrors || 0) >= 2) issues.push({ code: "repeated_error", detail: String(practiceStats.repeatedErrorLabel || "ท่อนเดิมพลาดซ้ำ"), evidence: ["repeated_errors >= 2"], confidence: 0.6 });
      if (typeof practiceStats.rhythmScore === "number" && practiceStats.rhythmScore < 60) issues.push({ code: "rhythm_uneven", detail: "จังหวะไม่สม่ำเสมอ", evidence: [`rhythmScore ${practiceStats.rhythmScore}`], confidence: 0.55 });
      if (typeof practiceStats.accuracy === "number" && practiceStats.accuracy < 50) issues.push({ code: "note_accuracy_low", detail: "ความแม่นยำโน้ตต่ำ", evidence: [`accuracy ${practiceStats.accuracy}`], confidence: 0.6 });
      if ((practiceStats.pauses || 0) >= 3 && !(typeof practiceStats.accuracy === "number" && practiceStats.accuracy < 50)) issues.push({ code: "hesitation", detail: "หยุดคิดบ่อยระหว่างเล่น", evidence: [`pauses ${practiceStats.pauses}`], confidence: 0.5 });
      if (typeof practiceStats.accuracy === "number" && practiceStats.accuracy >= 85 && typeof practiceStats.speedRatio === "number" && practiceStats.speedRatio > 1.15) issues.push({ code: "speed_uneven", detail: "เร่งจังหวะเมื่อท่องคุ้น", evidence: [`speedRatio ${practiceStats.speedRatio}`], confidence: 0.5 });
      if (typeof practiceStats.accuracy === "number" && typeof practiceStats.weekAgoAccuracy === "number" && practiceStats.weekAgoAccuracy > 0 && practiceStats.accuracy - practiceStats.weekAgoAccuracy < 3) issues.push({ code: "progress_stall", detail: "ความแม่นยำไม่คืบหน้าเป็นสัปดาห์", evidence: [`acc ${practiceStats.accuracy} vs ${practiceStats.weekAgoAccuracy} a week ago`], confidence: 0.5 });
    }
    const diagnosis = makeDiagnosis({ issues });

    // 5b. SELF-REPORT FUSION (Phase 4, spec §17): the student's own words
    // outrank inference. When a self-report maps to a state the loop already
    // estimated from performance, the reported value REPLACES the guessed
    // one (direct answer > guessing); when no such estimate existed, the
    // report CREATES one — a "too hard" answer must reach the policy even
    // if the accuracy number looked fine. see use of updateOrAdd below.
    if (selfReport && SELF_REPORT_STATE[selfReport]) {
      const { state, probability, confidence } = SELF_REPORT_STATE[selfReport];
      const est2 = makeStudentStateEstimate({
        state, probability, confidence,
        evidence: ["student answered directly (self-report)"],
        modalities: ["self_report"],
        alternatives: [],
      });
      const i = states.findIndex(s => s.state === state);
      if (i >= 0) states[i] = est2; else states.push(est2);
    }

    // 5. SELECT STRATEGY via configurable policy
    const decision = policy.evaluate(states, signals, selfReport);

    // 6. RESPOND — Phase 0 composes the message FROM the decision (no model
    // needed); Phase 1 passes this decision+context to a provider for the
    // natural-language rendering. The KB now feeds the response: issue codes
    // map to knowledge entries, whose `teach` line becomes the appended tip
    // (GROUP 4.2 of the owner's gap audit 2026-09-17 — the loop previously
    // never read the KB at all). Unknown id / missing kb → no tip, no crash.
    const message = composeMessage(decision, { selfReport, practiceStats, studentContext });
    const kbTip = kbTipFor(issues, kb);
    const finalText = kbTip ? `${message}\n\n${kbTip}` : message;

    // Roadmap #62/#75 wiring: when the policy sends the learner BACK to a
    // prerequisite, the skill graph names the concrete weakest ancestor
    // (from the caller-supplied mastery map) instead of a vague "go back".
    // No graph/mastery data → absent field, never a guess.
    let prerequisiteSuggestion = null;
    try {
      if (decision.strategy_id === "return-to-prerequisite" && skillGraph && practiceStats && practiceStats.mastery && practiceStats.strugglingSkillId) {
        const wa = skillGraph.weakestAncestor(practiceStats.mastery, practiceStats.strugglingSkillId);
        if (wa) prerequisiteSuggestion = { skill_id: wa.id, th: wa.th, en: wa.en, domain: wa.domain };
      }
    } catch (e) { prerequisiteSuggestion = null; }

    return {
      observations: obs,
      states,
      diagnosis,
      decision,
      prerequisite_suggestion: prerequisiteSuggestion,
      response: { text: finalText, strategy_id: decision.strategy_id },
      trace: { ts: new Date().toISOString(), signals },
    };
  }

  return { runOnce };
}

/* Issue code → KB entry id. Every id here must exist in the seeds; the lookup
   is defensive anyway (knowledge-base drops unknown ids silently). */
const ISSUE_KB = {
  repeated_error: "sci:deliberate-practice",   // ซ้อมจุดเดิมพลาดซ้ำ → ซ้อมที่จุดอ่อนแบบตั้งเป้า
  rhythm_uneven: "ex:slow-count-aloud",        // จังหวะไม่นิ่ง → เล่นช้า+นับออกเสียง
  note_accuracy_low: "sci:chunking",           // โน้ตพลาดเยอะ → ย่อยเป็นท่อนเล็ก
  hesitation: "tcraft:ear-ladder",             // หยุดคิดบ่อย → ฐานฟังยังไม่แน่น (audiation ค้ำการอ่านข้างหน้า)
  speed_uneven: "err:rushing",                 // เร่งเมื่อคุ้น → มือเร็วกว่าสมองนับ ไม่ใช่เจตนา
  progress_stall: "tcraft:session-shape",      // ไม่คืบหน้า → รูปเซสชันอาจขาดช่วงจุดติดแบบตั้งใจ
};

function kbTipFor(issues, kb) {
  try {
    if (!kb || !Array.isArray(issues)) return null;
    for (const issue of issues) {
      const id = ISSUE_KB[issue && issue.code];
      if (!id) continue;
      const e = typeof kb.get === "function" ? kb.get(id) : null;
      if (e && e.teach) return `[KB] ${e.title} — ${e.teach}`;
    }
  } catch (err) { /* KB tip is an enhancement, never a failure path */ }
  return null;
}

function composeMessage(decision, { selfReport, practiceStats } = {}) {
  const a = decision.actions;
  if (selfReport === "too_easy") return "เยี่ยมเลย! งั้นครูเพิ่มชั้นนิดนึง — ลองใส่น้ำหนักของเสียงให้ต่างกันระหว่างมือขวา-มือซ้าย แล้วฟังว่าเพลงเปลี่ยนไปไหม";
  if (selfReport === "too_hard") return "ไม่เป็นไร เราช้าลงและตัดเฉพาะจุดที่ติด: เล่นแค่ 2 ห้องแรกด้วยความเร็วที่สบายมือ แล้วให้ครูฟังก่อนค่อยต่อ";
  if (a.includes("reduce_complexity") || a.includes("simplify")) return "เราแบ่งใหม่นะ: เล่นช้า ๆ แค่ท่อนแรก ตามด้วยการนับจังหวะเบา ๆ ถ้าติดตรงไหนบอกครู ค่อยแก้ทีละจุด";
  if (a.includes("return_to_prerequisite")) return "ก่อนต่อ เรากลับไปหัวข้อพื้นฐานที่ตัวนี้พักอยู่สักแป๊บ แล้วกลับมาที่เพลงนี้จะง่ายขึ้นเยอะ";
  if (a.includes("shorten_activity")) return "วันนี้ไม่ต้องยาว — จบด้วยขั้นเล็ก ๆ ที่สำเร็จได้ชัวร์ แล้วพรุ่งนี้ค่อยเพิ่ม";
  if (practiceStats && typeof practiceStats.accuracy === "number" && practiceStats.accuracy >= 95) return "เก่งขึ้นจริง ๆ ตั้งแต่ครั้งก่อน (ชมตามผลจริง) — ครั้งหน้าลองเพิ่มความเร็วขึ้นนิดเดียว แล้วรักษาความนิ่งของจังหวะเดิมไว้";
  return "ทำต่อตามแผนเดิมได้เลย — ถ้าอยากเปลี่ยนอะไรบอกครูได้ตลอด";
}
