/* ── tigamodel/teaching/jev-tie-breaker.js ──
   docs/05 §5 / plan-v3 m20: Jev decides ONLY at genuine ties. When two
   policy rules both match the same student state, policy.js's
   first-match-wins silently resolves the tie by CODE ORDER — the decision
   has no reason to prefer rule #1 over rule #2 except that the file lists
   it first. This module makes the tie VISIBLE and gives it to Jev
   (typed probability + criteria), while guaranteeing the old behaviour as
   the fallback: any error, timeout, missing config, or a disabled switch
   → first-match decision exactly as shipped.

   Pure core (this file) + async wiring (web.js):
     findMatchingRules(policy, states, signals, selfReport) → all matching
     findTie(...) → { tied: [ruleId...], question } | null
     jevChoiceToDecision(rule, answer) → makeTeachingDecision with the
       chosen rule's actions + rationale + Jev probability attached

   Kill switch: `tiga_jev_policy` (web.js wiring reads it like the other
   switches; false/error → Jev never called). ── */

import { makeTeachingDecision } from "../core/schema.js";

/* Run one rule's `when` conditions — same semantics as policy.js.evaluate
   (all/some over state probability bounds, signal counts, self-report). */
function ruleMatches(rule, stateEstimates, signals, selfReport) {
  const ctx = { state: stateEstimates, signal: signals || {}, self_report: selfReport || null };
  const results = (rule.when || []).map(cond => {
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
  return rule.all ? results.every(Boolean) : results.some(Boolean);
}

/* ALL rules that match (not just the first) — deterministic, order-stable. */
export function findMatchingRules(policy, stateEstimates, signals, selfReport) {
  const rules = policy && (policy.rules || policy);
  const states = Array.isArray(stateEstimates) ? stateEstimates : [];
  if (!Array.isArray(rules)) return [];
  return rules.filter(r => ruleMatches(r, states, signals, selfReport));
}

/* Tie detection: ≥2 matching rules AND they actually differ in what they'd
   do (same actions = no real conflict, no need to bother Jev). */
export function findTie(policy, stateEstimates, signals, selfReport) {
  const matches = findMatchingRules(policy, stateEstimates, signals, selfReport);
  if (matches.length < 2) return null;
  const distinct = new Set(matches.map(r => (r.actions || []).join("|")));
  if (distinct.size < 2) return null;
  return {
    tied: matches.map(r => r.id),
    question: {
      type: "choice",
      instructions: "สองกลยุทธ์การสอนตรงเงื่อนไขนักเรียนนี้พร้อมกัน — เลือกกลยุทธ์ที่เหมาะกว่าตอนนี้ (two teaching strategies match this student's state; pick the better one right now)",
      criteria: Object.fromEntries(matches.map(r => [r.id, `${r.rationale || r.id} (actions: ${(r.actions || []).join(", ")})`])),
    },
    state: `student states: ${stateEstimates.map(s => `${s.state}@${Number(s.probability).toFixed(2)}`).join(", ")}; signals: ${Object.entries(signals || {}).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}; self_report: ${selfReport || "none"}`,
  };
}

/* Jev answer → a real policy decision: the chosen rule's actions+rationale,
   with the judgment attached (probability + provenance) so the back office
   can prove HOW the tie was resolved. */
export function jevChoiceToDecision(answer, { tiedRules, basedOn, via = "jev-tie-breaker" }) {
  const rules = tiedRules || [];
  const chosenId = String(answer || "");
  const rule = rules.find(r => r.id === chosenId);
  if (!rule) return null; // Jev named a rule we didn't offer — never trust it
  const probabilities = (answer && typeof answer === "object") ? null : null;
  return makeTeachingDecision({
    strategyId: rule.id,
    actions: rule.actions || [],
    rationale: rule.rationale || rule.id,
    basedOn: [...(basedOn || []), `jev:${via}`],
  });
}

/* The safe path: what the loop uses whenever Jev is unavailable/disabled —
   identical to policy.js's first-match decision (the shipped behaviour). */
export function firstMatchDecision(policy, stateEstimates, signals, selfReport) {
  const states = Array.isArray(stateEstimates) ? stateEstimates : [];
  const matches = findMatchingRules(policy, states, signals, selfReport);
  const rule = matches[0];
  if (!rule) {
    return makeTeachingDecision({
      strategyId: "continue-current-plan",
      actions: [],
      rationale: "ไม่มีสัญญาณให้เปลี่ยนกลยุทธ์ — ดำเนินต่อตามแผนเดิม",
      basedOn: states.map(s => `${s.state}@${s.probability.toFixed(2)}`),
    });
  }
  return makeTeachingDecision({
    strategyId: rule.id,
    actions: rule.actions || [],
    rationale: rule.rationale || rule.id,
    basedOn: stateEstimates.map(s => `${s.state}@${s.probability.toFixed(2)}`),
  });
}
