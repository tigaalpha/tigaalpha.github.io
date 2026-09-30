/* Smoke: Jev tie-breaker (docs/05 §5 / plan-v3 m20) — the REAL pure core.
   The docs/05 §5 promises: ties go through Jev with probability in the
   response; edge failure → the old rule-based answer, no learner-facing
   error; kill switch → plain if-else. This file proves the pure decisions;
   the async web.js wiring calls jev.choose() only when findTie() says so
   and falls back on anything less than ok:true (that contract is asserted
   here as the fallback-path behaviour). */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-jevtie";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execSync(`npx esbuild tigamodel/teaching/jev-tie-breaker.js tigamodel/teaching/policy.js tigamodel/core/schema.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });

const M = (f) => import(pathToFileURL(`${OUT}/${f}`).href);
const tb = await M("teaching/jev-tie-breaker.js");
const policyM = await M("teaching/policy.js");

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

/* The BOTH-MATCH state from the analyzer smoke: rule 1 needs confusion AND
   perceived_difficulty; rule 2 needs low understanding + repeated errors. */
const bothMatchStates = [
  { state: "confusion", probability: 0.9, confidence: 0.8, evidence: [], modalities: [], alternatives: [] },
  { state: "perceived_difficulty", probability: 0.8, confidence: 0.8, evidence: [], modalities: [], alternatives: [] },
  { state: "understanding", probability: 0.2, confidence: 0.8, evidence: [], modalities: [], alternatives: [] },
];
const bothMatchSignals = { repeated_errors: 3 };

console.log("tigamodel Jev tie-breaker smoke (docs/05 §5):");

check("findMatchingRules: BOTH rules match the same student (the hidden tie)", () => {
  const m = tb.findMatchingRules(policyM.DEFAULT_POLICY, bothMatchStates, bothMatchSignals, null);
  assert.deepStrictEqual(m.map(r => r.id).sort(), ["return-to-prerequisite", "simplify-on-confusion"]);
});

check("single match → no tie (Jev never bothered)", () => {
  const states = [{ state: "confusion", probability: 0.9, confidence: 0.8, evidence: [], modalities: [], alternatives: [] }];
  assert.strictEqual(tb.findTie(policyM.DEFAULT_POLICY, states, {}, null), null);
});

check("two matches with the SAME actions → no real tie (no Jev call)", () => {
  const p = {
    rules: [
      { id: "a", when: [{ self_report: "too_easy" }], all: false, actions: ["x", "y"], rationale: "A" },
      { id: "b", when: [{ signal: "repeated_errors", min_count: 1 }], all: false, actions: ["x", "y"], rationale: "B" },
    ],
  };
  assert.strictEqual(tb.findTie(p, [], { repeated_errors: 2 }, null), null);
});

check("REAL tie detected: question carries both rules with criteria + state text", () => {
  const t = tb.findTie(policyM.DEFAULT_POLICY, bothMatchStates, bothMatchSignals, null);
  assert.ok(t, "expected a tie");
  assert.deepStrictEqual(t.tied.sort(), ["return-to-prerequisite", "simplify-on-confusion"]);
  assert.strictEqual(t.question.type, "choice");
  assert.ok(t.question.criteria["simplify-on-confusion"].length > 10);
  assert.match(t.state, /confusion@0\.90/);
  assert.match(t.state, /repeated_errors=3/);
});

check("jevChoiceToDecision: Jev's choice becomes the decision WITH provenance", () => {
  const t = tb.findTie(policyM.DEFAULT_POLICY, bothMatchStates, bothMatchSignals, null);
  const d = tb.jevChoiceToDecision("return-to-prerequisite", { tiedRules: policyM.DEFAULT_POLICY.filter(r => t.tied.includes(r.id)), basedOn: ["confusion@0.90"] });
  assert.strictEqual(d.strategy_id, "return-to-prerequisite");
  assert.ok(d.based_on.some(b => String(b).startsWith("jev:")), `provenance attached: ${JSON.stringify(d.based_on)}`);
});

check("jevChoiceToDecision: Jev naming an unoffered rule → null (never trusted)", () => {
  const t = tb.findTie(policyM.DEFAULT_POLICY, bothMatchStates, bothMatchSignals, null);
  assert.strictEqual(tb.jevChoiceToDecision("raise-challenge", { tiedRules: policyM.DEFAULT_POLICY.filter(r => t.tied.includes(r.id)) }), null);
  assert.strictEqual(tb.jevChoiceToDecision(null, { tiedRules: [] }), null);
});

check("FALLBACK: firstMatchDecision === shipped policy.evaluate behaviour (both-match case)", () => {
  const shipped = policyM.createTeachingPolicy().evaluate(bothMatchStates, bothMatchSignals, null);
  const fallback = tb.firstMatchDecision(policyM.DEFAULT_POLICY, bothMatchStates, bothMatchSignals, null);
  assert.strictEqual(fallback.strategy_id, shipped.strategy_id);
  assert.strictEqual(fallback.strategy_id, "simplify-on-confusion");
});

check("FALLBACK: no rule matched → continue-current-plan (same as shipped)", () => {
  const d = tb.firstMatchDecision(policyM.DEFAULT_POLICY, [], {}, null);
  assert.strictEqual(d.strategy_id, "continue-current-plan");
});

check("empty/malformed inputs never throw (degrade, not crash)", () => {
  assert.deepStrictEqual(tb.findMatchingRules(null, [], {}, null), []);
  assert.strictEqual(tb.findTie({}, null, null, null), null);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
