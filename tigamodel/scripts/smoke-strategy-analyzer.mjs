/* Smoke: Strategy Effect Analyzer (docs/05 §1) — runs the REAL module
   (repo convention: transpile the actual source, never a hand-mirrored copy).
   Covers the exact promises made in docs/05 §1:
   - 30-outcome fixture → different strategies get different weights
   - clamp never leaves 0.5–2.0
   - <5 samples per strategy → weight stays 1.0 (unknown ≠ good ≠ bad)
   - kill switch (enabled:false / foreign shape) → null, rules unchanged
   - real effect: reordering DEFAULT_POLICY changes which rule wins when two
     rules both match the same student state (proved through the real
     createTeachingPolicy().evaluate, not a mock)
   No test framework in this repo; plain node assertions with clear output. */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-analyzer";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(
  `npx esbuild tigamodel/teaching/strategy-analyzer.js tigamodel/teaching/policy.js tigamodel/core/schema.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`,
  { stdio: "pipe" }
);

const M = (f) => import(pathToFileURL(`${OUT}/${f}`).href);
const analyzer = await M("teaching/strategy-analyzer.js");
const policyM = await M("teaching/policy.js");

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

/* Fixture shaped exactly like admin_strategy_effectiveness rows. 30 real
   outcomes: "simplify-on-confusion" helped (positive delta), "ease-off-on-
   low-engagement" hurt (negative delta), "return-to-prerequisite" is a
   coin-flip around zero, "raise-challenge" has too few samples to judge. */
const rows = [];
for (let i = 0; i < 12; i++) rows.push({ strategy_id: "simplify-on-confusion", n: 12, avg_before: 0.4, avg_after: 0.7, delta: 0.30, improved: 9 });
for (let i = 0; i < 10; i++) rows.push({ strategy_id: "return-to-prerequisite", n: 10, avg_before: 0.45, avg_after: 0.47, delta: 0.02, improved: 5 });
for (let i = 0; i < 6; i++) rows.push({ strategy_id: "ease-off-on-low-engagement", n: 6, avg_before: 0.5, avg_after: 0.42, delta: -0.08, improved: 2 });
rows.push({ strategy_id: "raise-challenge", n: 2, avg_before: 0.3, avg_after: 0.6, delta: 0.30, improved: 2 });

console.log("tigamodel strategy analyzer smoke:");

check("30-outcome fixture → strategies get DIFFERENT weights (not flat)", () => {
  const w = analyzer.computePolicyWeights(rows);
  assert.ok(w["simplify-on-confusion"] > w["return-to-prerequisite"], "winner should outrank coin-flip");
  assert.ok(w["return-to-prerequisite"] > w["ease-off-on-low-engagement"], "coin-flip should outrank loser");
  assert.notStrictEqual(w["simplify-on-confusion"], w["ease-off-on-low-engagement"]);
});

check("weights are clamped inside [0.5, 2.0] even for extreme deltas", () => {
  const extreme = [
    { strategy_id: "mega-win", n: 50, delta: 99, improved: 50 },
    { strategy_id: "mega-loss", n: 50, delta: -99, improved: 0 },
  ];
  const w = analyzer.computePolicyWeights(extreme);
  assert.ok(w["mega-win"] <= analyzer.WEIGHT_MAX, `win clamped: ${w["mega-win"]}`);
  assert.ok(w["mega-loss"] >= analyzer.WEIGHT_MIN, `loss clamped: ${w["mega-loss"]}`);
});

check("<5 samples → weight 1.0 (unknown ≠ good ≠ bad)", () => {
  const w = analyzer.computePolicyWeights(rows);
  assert.strictEqual(w["raise-challenge"], 1.0, "2 samples must stay neutral");
  assert.strictEqual(analyzer.computePolicyWeights([{ strategy_id: "x", n: 4, delta: 5 }])["x"], 1.0);
});

check("malformed rows are skipped, never crash the analyzer", () => {
  const w = analyzer.computePolicyWeights([null, {}, { strategy_id: "", n: 9, delta: 1 }, { strategy_id: "ok", n: 9, delta: 1 }]);
  assert.ok(Number.isFinite(w["ok"]) && w["ok"] >= analyzer.WEIGHT_MIN && w["ok"] <= analyzer.WEIGHT_MAX, "valid row survives");
  assert.ok(!("" in w) && !("undefined" in w), "empty/missing ids are dropped");
  assert.deepStrictEqual(analyzer.computePolicyWeights("not-an-array"), {}, "non-array → empty object, no throw");
});

check("kill switch: enabled:false → applyPolicyWeights returns null, rules untouched", () => {
  const rules = policyM.DEFAULT_POLICY.slice();
  assert.strictEqual(analyzer.applyPolicyWeights(rules, { enabled: false, weights: { "simplify-on-confusion": 2.0 } }), null);
  assert.deepStrictEqual(rules, policyM.DEFAULT_POLICY);
});

check("foreign shapes (null / no enabled / bad weights) → null, no crash", () => {
  const rules = policyM.DEFAULT_POLICY;
  assert.strictEqual(analyzer.applyPolicyWeights(rules, null), null);
  assert.strictEqual(analyzer.applyPolicyWeights(rules, { weights: { a: 2 } }), null);
  assert.strictEqual(analyzer.applyPolicyWeights(rules, { enabled: true, weights: "junk" }), null);
  assert.strictEqual(analyzer.applyPolicyWeights(rules, { enabled: true, weights: { "no-such-rule": 2 } }), null);
});

check("REAL effect: weights REORDER DEFAULT_POLICY (stable for unweighted rules)", () => {
  const rules = policyM.DEFAULT_POLICY.slice();
  const out = analyzer.applyPolicyWeights(rules, {
    enabled: true,
    weights: { "ease-off-on-low-engagement": 2.0, "simplify-on-confusion": 1.0 },
  });
  assert.ok(Array.isArray(out) && out.length === rules.length, "same rules, new order");
  assert.strictEqual(out[0].id, "ease-off-on-low-engagement", "highest weight first");
  assert.deepStrictEqual([...out].sort((a, b) => rules.findIndex(r => r.id === a.id) - rules.findIndex(r => r.id === b.id)), rules, "same multiset of rules");
  // stable: unweighted rules keep their original relative order
  const tail = out.filter(r => !["ease-off-on-low-engagement"].includes(r.id)).map(r => r.id);
  const tailOrig = rules.filter(r => r.id !== "ease-off-on-low-engagement").map(r => r.id);
  assert.deepStrictEqual(tail, tailOrig);
});

check("END-TO-END through the REAL policy: reordering changes the decision", () => {
  // A student state where BOTH "simplify-on-confusion" and "return-to-prerequisite"
  // match: rule 1 needs confusion≥0.7 AND perceived_difficulty≥0.7 (all:true);
  // rule 2 needs understanding≤0.4 AND repeated_errors≥2. Without weights,
  // first-match-wins picks "simplify-on-confusion" (rule #1).
  const states = [
    { state: "confusion", probability: 0.9, confidence: 0.8, evidence: [], modalities: [], alternatives: [] },
    { state: "perceived_difficulty", probability: 0.8, confidence: 0.8, evidence: [], modalities: [], alternatives: [] },
    { state: "understanding", probability: 0.2, confidence: 0.8, evidence: [], modalities: [], alternatives: [] },
  ];
  const signals = { repeated_errors: 3 };
  const base = policyM.createTeachingPolicy();
  assert.strictEqual(base.evaluate(states, signals, null).strategy_id, "simplify-on-confusion");

  const reordered = analyzer.applyPolicyWeights(policyM.DEFAULT_POLICY, {
    enabled: true,
    weights: { "return-to-prerequisite": 2.0, "simplify-on-confusion": 0.6 },
  });
  const boosted = policyM.createTeachingPolicy({ policy: reordered });
  assert.strictEqual(
    boosted.evaluate(states, signals, null).strategy_id,
    "return-to-prerequisite",
    "weight-boosted rule must win when it also matches"
  );
});

check("weights that match NO rule / disabled flag never change decisions", () => {
  const states = [{ state: "confusion", probability: 0.9, confidence: 0.8, evidence: [], modalities: [], alternatives: [] }];
  const base = policyM.createTeachingPolicy();
  const expected = base.evaluate(states, {}, null).strategy_id;
  const noop = analyzer.applyPolicyWeights(policyM.DEFAULT_POLICY, { enabled: true, weights: { "rule-not-in-table": 2.0 } });
  assert.strictEqual(noop, null);
  const off = analyzer.applyPolicyWeights(policyM.DEFAULT_POLICY, { enabled: false, weights: { "simplify-on-confusion": 2.0 } });
  assert.strictEqual(off, null);
  assert.strictEqual(policyM.createTeachingPolicy().evaluate(states, {}, null).strategy_id, expected);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
