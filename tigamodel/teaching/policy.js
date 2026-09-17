/* ── tigamodel/teaching/policy.js ──
   Teaching Policy engine (spec §22): a CONFIGURABLE table of
   IF [state conditions] THEN [actions] — evaluated against Student State
   Estimates (probability+confidence, never hard claims). Not hard-coded in
   prompts: the selected strategy + actions are returned as structured data
   (TIGATeachingDecision) that prompt builders / UI / outcome-dataset logging
   all consume consistently.

   Default policy ships with the spec's examples; owner/experts can edit
   thresholds or add strategies by editing DEFAULT_POLICY (or passing a
   custom one to createTeachingPolicy) — core code never changes. ── */

import { makeTeachingDecision } from "../core/schema.js";

export const DEFAULT_POLICY = [
  {
    id: "simplify-on-confusion",
    when: [
      { state: "confusion", min_probability: 0.7 },
      { state: "perceived_difficulty", min_probability: 0.7 },
    ],
    all: true, // every condition must hold
    actions: ["reduce_complexity", "demonstrate", "ask_short_question", "request_student_attempt"],
    rationale: "นักเรียนสับสนและรู้สึกยาก — ลดความซับซ้อน สาธิต แล้วให้ลองทำเองทีละขั้น",
  },
  {
    id: "return-to-prerequisite",
    when: [
      { state: "understanding", max_probability: 0.4 },
      { signal: "repeated_errors", min_count: 2 },
    ],
    all: true,
    actions: ["return_to_prerequisite", "change_explanation", "use_simpler_example", "reduce_task_size"],
    rationale: "เข้าใจยังต่ำและพลาดซ้ำ — ย้อนไปทักษะพื้นฐานก่อน เปลี่ยนวิธีอธิบาย ลดขนาดงาน",
  },
  {
    id: "ease-off-on-low-engagement",
    when: [
      { state: "engagement", max_probability: 0.35 },
      { signal: "task_difficulty_high", min_count: 1 },
    ],
    all: true,
    actions: ["shorten_activity", "change_exercise", "provide_achievable_step", "ask_self_report"],
    rationale: "มีส่วนร่วมลดลงบนงานที่ยาก — สั้นลง เปลี่ยนแบบฝึก ให้ขั้นที่สำเร็จได้ และถามความรู้สึกตรง ๆ",
  },
  {
    id: "raise-challenge",
    when: [{ self_report: "too_easy" }],
    all: false,
    actions: ["increase_challenge", "add_variation", "increase_tempo_carefully", "introduce_musical_application"],
    rationale: "นักเรียนบอกว่าง่ายไป — เพิ่มความท้าทายอย่างระวัง พร้อมการประยุกต์ทางดนตรี",
  },
  {
    id: "simplify-on-hard-report",
    when: [{ self_report: "too_hard" }],
    all: false,
    actions: ["simplify", "reduce_tempo", "isolate_section", "demonstrate", "reduce_cognitive_load"],
    rationale: "นักเรียนบอกว่ายากไป — ลดความเร็ว ตัดเฉพาะท่อนที่ติด สาธิต ลดภาระความคิด",
  },
];

export function createTeachingPolicy({ policy = DEFAULT_POLICY } = {}) {
  function evaluate(stateEstimates = [], signals = {}, selfReport = null) {
    for (const rule of policy) {
      const ctx = { state: stateEstimates, signal: signals || {}, self_report: selfReport || null };
      const results = rule.when.map(cond => {
        if (cond.state != null) {
          const est = stateEstimates.find(s => s.state === cond.state);
          if (!est) return false;
          if (cond.min_probability != null && est.probability < cond.min_probability) return false;
          if (cond.max_probability != null && est.probability > cond.max_probability) return false;
          return true;
        }
        if (cond.signal != null) {
          const v = (signals || {})[cond.signal];
          if (v == null) return false;
          if (cond.min_count != null && v < cond.min_count) return false;
          return true;
        }
        if (cond.self_report != null) return selfReport === cond.self_report;
        return false;
      });
      const matched = rule.all ? results.every(Boolean) : results.some(Boolean);
      if (matched) {
        return makeTeachingDecision({
          strategyId: rule.id,
          actions: rule.actions,
          rationale: rule.rationale,
          basedOn: stateEstimates.map(s => `${s.state}@${s.probability.toFixed(2)}`),
        });
      }
    }
    // no rule matched → neutral continue-with-current-plan strategy
    return makeTeachingDecision({
      strategyId: "continue-current-plan",
      actions: [],
      rationale: "ไม่มีสัญญาณให้เปลี่ยนกลยุทธ์ — ดำเนินต่อตามแผนเดิม",
      basedOn: stateEstimates.map(s => `${s.state}@${s.probability.toFixed(2)}`),
    });
  }
  return { evaluate, rules: policy };
}
