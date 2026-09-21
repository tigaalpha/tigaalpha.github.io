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
  async function runOnce({ observations = [], practiceStats = null, selfReport = null, studentContext = null, history = [], lang = "th" } = {}) {
    // UI language for every learner-facing string below (owner request
    // 2026-09-21: the verdict must match the app's language mode — Chinese
    // users got Thai, Thai users got mixed EN). Defaults to Thai, the
    // product's home language, for any unknown value.
    const L = LANGS[lang] || LANGS.th;
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
          evidence: [L.accE(acc), L.repE(repeated)],
          alternatives: L.confusedAlt,
        }));
        states.push(est({
          state: "perceived_difficulty", probability: 0.7, confidence: 0.5,
          evidence: [L.hardE], alternatives: L.hardAlt,
        }));
      }
      if (acc != null && acc >= 95) {
        states.push(est({
          state: "understanding", probability: Math.min(0.95, 0.6 + (acc - 95) * 0.07), confidence: 0.7,
          evidence: [L.masteredE(acc)], alternatives: [],
        }));
      }
      if (pauses >= 3) {
        states.push(est({
          state: "hesitation", probability: Math.min(0.85, 0.45 + pauses * 0.1), confidence: 0.55,
          evidence: [L.pauseE(pauses)], alternatives: L.pauseAlt,
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
      if ((practiceStats.repeatedErrors || 0) >= 2) issues.push({ code: "repeated_error", detail: practiceStats.repeatedErrorLabel || L.sameSpot, evidence: ["repeated_errors >= 2"], confidence: 0.6 });
      if (typeof practiceStats.rhythmScore === "number" && practiceStats.rhythmScore < 60) issues.push({ code: "rhythm_uneven", detail: L.rhythmIssue, evidence: [`rhythmScore ${practiceStats.rhythmScore}`], confidence: 0.55 });
      if (typeof practiceStats.accuracy === "number" && practiceStats.accuracy < 50) issues.push({ code: "note_accuracy_low", detail: L.accIssue, evidence: [`accuracy ${practiceStats.accuracy}`], confidence: 0.6 });
      if ((practiceStats.pauses || 0) >= 3 && !(typeof practiceStats.accuracy === "number" && practiceStats.accuracy < 50)) issues.push({ code: "hesitation", detail: L.hesitIssue, evidence: [`pauses ${practiceStats.pauses}`], confidence: 0.5 });
      if (typeof practiceStats.accuracy === "number" && practiceStats.accuracy >= 85 && typeof practiceStats.speedRatio === "number" && practiceStats.speedRatio > 1.15) issues.push({ code: "speed_uneven", detail: L.rushIssue, evidence: [`speedRatio ${practiceStats.speedRatio}`], confidence: 0.5 });
      if (typeof practiceStats.accuracy === "number" && typeof practiceStats.weekAgoAccuracy === "number" && practiceStats.weekAgoAccuracy > 0 && practiceStats.accuracy - practiceStats.weekAgoAccuracy < 3) issues.push({ code: "progress_stall", detail: L.stallIssue, evidence: [`acc ${practiceStats.accuracy} vs ${practiceStats.weekAgoAccuracy} a week ago`], confidence: 0.5 });
    }
    // 4b. OBSERVATION-DRIVEN ISSUES (Phase 4, spec §18/§21): any modality may
    // send observations — camera hand-posture, STT answers, session events.
    // Each observation that carries {code, detail} in its value becomes a
    // real diagnosis issue; unknown shapes are ignored. Vision NEVER infers
    // mood/attention (§16) — only what the detector actually measured.
    for (const o of obs) {
      const v = o && o.value;
      if (v && typeof v === "object" && v.code && typeof v.code === "string") {
        issues.push({ code: String(v.code).slice(0, 40), detail: String(v.detail || v.signal || o.signal || "observation"), evidence: [`${o.modality}: ${o.signal}`].slice(0, 4), confidence: Math.min(0.7, Math.max(0.3, Number(v.confidence) || 0.5)) });
      }
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
    const message = composeMessage(decision, { selfReport, practiceStats, studentContext, L });
    const kbTip = kbTipFor(issues, kb, L);
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

/* UI language table (2026-09-21). Everything learner-facing the loop emits —
   state evidence, alternatives, issue details, the verdict message and the
   KB tip prefix — comes from here so the result screen speaks the app's
   current language. th stays the default; en/zh are full translations, not
   fallbacks. */
const LANGS = {
  th: {
    accE: (a) => `ความแม่นยำ ${a}%`,
    repE: (n) => `พลาดซ้ำ ${n} ครั้ง`,
    masteredE: (a) => `ความแม่นยำ ${a}% โดยไม่พลาดซ้ำ`,
    pauseE: (n) => `หยุด ${n} ครั้งระหว่างเล่น`,
    confusedAlt: ["อาจยังไม่คุ้นกับทำนอง", "อาจซ้อมสด ๆ โดยยังไม่ได้แบ่งท่อน"],
    hardAlt: ["อาจแค่เหนื่อยหรือเบลอจอ"],
    hardE: "ต้องซ้ำหลายครั้งโดยยังไม่ผ่าน",
    pauseAlt: ["อาจกำลังอ่านโน้ต", "อาจคิดทางเทคนิค", "อาจเหนื่อย"],
    sameSpot: "ท่อนเดิมพลาดซ้ำ",
    rhythmIssue: "จังหวะไม่สม่ำเสมอ",
    accIssue: "ความแม่นยำโน้ตต่ำ",
    hesitIssue: "หยุดคิดบ่อยระหว่างเล่น",
    rushIssue: "เร่งจังหวะเมื่อท่องคุ้น",
    stallIssue: "ความแม่นยำไม่คืบหน้าเป็นสัปดาห์",
    kbPrefix: "ความรู้ที่เกี่ยว",
    kbI18n: null,   // th reads the seeded KB text directly
    tooEasy: "เยี่ยมเลย! งั้นครูเพิ่มชั้นนิดนึง — ลองใส่น้ำหนักของเสียงให้ต่างกันระหว่างมือขวา-มือซ้าย แล้วฟังว่าเพลงเปลี่ยนไปไหม",
    tooHard: "ไม่เป็นไร เราช้าลงและตัดเฉพาะจุดที่ติด: เล่นแค่ 2 ห้องแรกด้วยความเร็วที่สบายมือ แล้วให้ครูฟังก่อนค่อยต่อ",
    simplify: "เราแบ่งใหม่นะ: เล่นช้า ๆ แค่ท่อนแรก ตามด้วยการนับจังหวะเบา ๆ ถ้าติดตรงไหนบอกครู ค่อยแก้ทีละจุด",
    prerequisite: "ก่อนต่อ เรากลับไปหัวข้อพื้นฐานที่ตัวนี้พักอยู่สักแป๊บ แล้วกลับมาที่เพลงนี้จะง่ายขึ้นเยอะ",
    shorten: "วันนี้ไม่ต้องยาว — จบด้วยขั้นเล็ก ๆ ที่สำเร็จได้ชัวร์ แล้วพรุ่งนี้ค่อยเพิ่ม",
    praise: "เก่งขึ้นจริง ๆ ตั้งแต่ครั้งก่อน (ชมตามผลจริง) — ครั้งหน้าลองเพิ่มความเร็วขึ้นนิดเดียว แล้วรักษาความนิ่งของจังหวะเดิมไว้",
    neutral: "ทำต่อตามแผนเดิมได้เลย — ถ้าอยากเปลี่ยนอะไรบอกครูได้ตลอด",
  },
  en: {
    accE: (a) => `accuracy ${a}%`,
    repE: (n) => `${n} repeated error(s)`,
    masteredE: (a) => `accuracy ${a}% with no repeated misses`,
    pauseE: (n) => `${n} pause(s) while playing`,
    confusedAlt: ["maybe the melody isn't familiar yet", "maybe it was sight-played without chunking first"],
    hardAlt: ["maybe just tired or screen fatigue"],
    hardE: "needed many repeats without getting through",
    pauseAlt: ["maybe reading the notes", "maybe thinking through technique", "maybe tired"],
    sameSpot: "the same passage keeps breaking",
    rhythmIssue: "uneven rhythm",
    accIssue: "note accuracy is low",
    hesitIssue: "frequent mid-play hesitation",
    rushIssue: "rushing once the passage feels familiar",
    stallIssue: "accuracy hasn't moved in a week",
    kbPrefix: "Teaching note",
    kbI18n: "en",
    tooEasy: "Great! Let's raise it a notch — try balancing the sound differently between right and left hands, and listen how the piece changes.",
    tooHard: "That's okay — let's slow down and cut to the sticking point: play just the first 2 bars at a comfortable speed, let me hear, then continue.",
    simplify: "Let's re-chunk it: play slowly, first phrase only, with a light count aloud. Tell me where it sticks and we'll fix one spot at a time.",
    prerequisite: "Before moving on, let's revisit the underlying basics for a moment — coming back to this piece will feel much easier.",
    shorten: "Keep today short — end on a small step you can definitely land, then build tomorrow.",
    praise: "Genuinely better than last time (praise fits the real result) — next round try a touch more speed while keeping the same steady rhythm.",
    neutral: "Keep going with the current plan — tell me anytime you'd like to change something.",
  },
  zh: {
    accE: (a) => `准确率 ${a}%`,
    repE: (n) => `重复错误 ${n} 次`,
    masteredE: (a) => `准确率 ${a}%，没有重复失误`,
    pauseE: (n) => `演奏中停顿 ${n} 次`,
    confusedAlt: ["可能旋律还不熟", "可能是一上来就整段弹，没有分段"],
    hardAlt: ["可能只是累了或屏幕看久了"],
    hardE: "反复多次仍未通过",
    pauseAlt: ["可能在读谱", "可能在想指法", "可能累了"],
    sameSpot: "同一段反复出错",
    rhythmIssue: "节奏不均匀",
    accIssue: "音符准确率偏低",
    hesitIssue: "演奏中频繁停顿",
    rushIssue: "熟练之后越弹越快",
    stallIssue: "一周内准确率没有进步",
    kbPrefix: "教学提示",
    kbI18n: "zh",
    tooEasy: "太棒了！那老师加一点难度——试试让左右手的音量有所区分，听听曲子有什么变化。",
    tooHard: "没关系，我们放慢速度、只练卡住的地方：先用舒服的速度弹前两小节，让我听一听再继续。",
    simplify: "我们重新分段：只慢速弹第一句，轻轻数着拍子。哪里卡住告诉老师，我们一个点一个点地解决。",
    prerequisite: "继续之前，先回到这个知识点的基础练一小会儿，再回来弹这首会容易很多。",
    shorten: "今天不用练太久——用一个肯定能完成的小步骤收尾，明天再往上加。",
    praise: "真的比上次进步了（按真实结果表扬）——下次试着稍微加快一点点，同时保持原来稳定的节奏。",
    neutral: "按原计划继续就好——想调整什么随时告诉老师。",
  },
};

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

/* The six KB tips the loop can surface, in en/zh (owner request: the verdict
   must not mix languages — the seeded KB entries themselves are Thai-authored,
   so for en/zh we use these authored translations of exactly the teach lines
   the loop reads; th keeps the original KB text via the kb.get path below). */
const KB_TIP_I18N = {
  "sci:deliberate-practice": {
    en: { title: "Deliberate practice — how to practice better, not just more", teach: "Isolate the spot that keeps breaking into a small, focused exercise with a clear goal — don't just replay the whole piece." },
    zh: { title: "刻意练习：练得更准，而不只是更久", teach: "把总是出错的那一小段单独拎出来，带着明确目标反复练——而不是整首一遍遍弹过。" },
  },
  "ex:slow-count-aloud": {
    en: { title: "Play slowly and count out loud", teach: "Drop the tempo until the rhythm is even, count aloud while playing, then speed up only when it stays steady." },
    zh: { title: "慢速弹并大声数拍", teach: "把速度降到节奏完全均匀为止，边弹边大声数拍，稳定了再提速。" },
  },
  "sci:chunking": {
    en: { title: "Chunking — small pieces win", teach: "Break the passage into 2–4 note chunks, master each one, then link them back together." },
    zh: { title: "分块练习：小块更容易成功", teach: "把乐句拆成每 2–4 个音的小块，逐块练熟，然后再连起来。" },
  },
  "tcraft:ear-ladder": {
    en: { title: "Train the inner ear", teach: "Frequent hesitation usually means the listening base isn't solid yet — sing the next phrase in your head before playing it." },
    zh: { title: "训练内心听觉", teach: "频繁停顿通常说明听觉基础还不够稳——弹之前先在脑子里把下一句唱出来。" },
  },
  "err:rushing": {
    en: { title: "Rushing is the hands outrunning the count", teach: "When a passage feels familiar the tempo creeps up on its own — set the beat first, keep it, and let speed come later." },
    zh: { title: "越弹越快＝手跑到了拍子前面", teach: "弹熟之后速度会不自觉变快——先把拍子定住并保持，速度以后再加。" },
  },
  "tcraft:session-shape": {
    en: { title: "Shape the session around the hard spot", teach: "A week without progress usually means the session never isolated the difficult bar — open with it, fix it, then play the piece." },
    zh: { title: "围绕难点安排练习", teach: "一周没进步，通常是因为练习没有单独攻克那个难小节——先练它、修好它，再弹整首。" },
  },
};

function kbTipFor(issues, kb, L) {
  try {
    if (!kb || !Array.isArray(issues)) return null;
    for (const issue of issues) {
      const id = ISSUE_KB[issue && issue.code];
      if (!id) continue;
      if (L.kbI18n && KB_TIP_I18N[id] && KB_TIP_I18N[id][L.kbI18n]) {
        const t = KB_TIP_I18N[id][L.kbI18n];
        return `[${L.kbPrefix}] ${t.title} — ${t.teach}`;
      }
      const e = typeof kb.get === "function" ? kb.get(id) : null;
      if (e && e.teach) return `[${L.kbPrefix}] ${e.title} — ${e.teach}`;
    }
  } catch (err) { /* KB tip is an enhancement, never a failure path */ }
  return null;
}

function composeMessage(decision, { selfReport, practiceStats, L } = {}) {
  const a = decision.actions;
  if (selfReport === "too_easy") return L.tooEasy;
  if (selfReport === "too_hard") return L.tooHard;
  if (a.includes("reduce_complexity") || a.includes("simplify")) return L.simplify;
  if (a.includes("return_to_prerequisite")) return L.prerequisite;
  if (a.includes("shorten_activity")) return L.shorten;
  if (practiceStats && typeof practiceStats.accuracy === "number" && practiceStats.accuracy >= 95) return L.praise;
  return L.neutral;
}
