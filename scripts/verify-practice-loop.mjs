/* One-off verification: run the teaching loop exactly the way
   use-practice-mode.ts's finishPractice() now feeds it — real shapes,
   real boundary values. Uses the actual tigamodel source via esbuild
   transpile + import (repo convention: no hand-mirrored copies). */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tiga-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(
  `npx esbuild tigamodel/teaching/teaching-loop.js tigamodel/teaching/policy.js tigamodel/teaching/philosophy.js tigamodel/knowledge/knowledge-base.js tigamodel/knowledge/university-seed.js tigamodel/knowledge/university-links.js tigamodel/knowledge/global-theory-seed.js tigamodel/knowledge/global-pedagogy-seed.js tigamodel/knowledge/piano-craft-seed.js tigamodel/knowledge/teacher-craft-seed.js tigamodel/knowledge/repertoire-forms-seed.js tigamodel/knowledge/learner-skills-seed.js tigamodel/core/schema.js tigamodel/knowledge/university-sources.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`,
  { stdio: "pipe" }
);

const loopM = await import(pathToFileURL(`${OUT}/teaching/teaching-loop.js`).href);
const kbSeed = await import(pathToFileURL(`${OUT}/knowledge/university-seed.js`).href);
const kbUni = await import(pathToFileURL(`${OUT}/knowledge/university-links.js`).href);
const t1 = await import(pathToFileURL(`${OUT}/knowledge/global-theory-seed.js`).href);
const t2 = await import(pathToFileURL(`${OUT}/knowledge/global-pedagogy-seed.js`).href);
const t3 = await import(pathToFileURL(`${OUT}/knowledge/piano-craft-seed.js`).href);
const t4 = await import(pathToFileURL(`${OUT}/knowledge/teacher-craft-seed.js`).href);
const t5 = await import(pathToFileURL(`${OUT}/knowledge/repertoire-forms-seed.js`).href);
const t6 = await import(pathToFileURL(`${OUT}/knowledge/learner-skills-seed.js`).href);

import assert from "node:assert";

// same assembly web.js uses
const kb = kbSeed.createUniversitySeededKnowledgeBase();
kbUni.linkUniversityKnowledge(kb);
t1.seedGlobalTheory(kb);
t2.seedGlobalPedagogy(kb);
t3.seedPianoCraft(kb);
t4.seedTeacherCraft(kb);
t5.seedRepertoireForms(kb);
t6.seedLearnerSkills(kb);

const policyMod = await import(pathToFileURL(`${OUT}/teaching/policy.js`).href);
const loop = loopM.createTeachingLoop({ policy: policyMod.createTeachingPolicy(), kb });

let n = 0;
async function runCase(name, stats, expect) {
  n++;
  const out = await loop.runOnce({ practiceStats: stats });
  assert.ok(out && out.response && typeof out.response.text === "string" && out.response.text.length > 10, `case ${n} (${name}): response text missing`);
  assert.ok(out.decision && out.decision.strategy_id, `case ${n}: strategy missing`);
  console.log(`  ✓ ${name}`);
  console.log(`      strategy=${out.decision.strategy_id} states=${out.states.map(s => s.state + "@" + s.probability.toFixed(2)).join(",") || "none"}`);
  if (expect && expect.strategy) assert.equal(out.decision.strategy_id, expect.strategy, `case ${n}: expected ${expect.strategy}`);
  if (expect && expect.tipIncludes) assert.ok(out.response.text.includes(expect.tipIncludes), `case ${n}: KB tip expected containing "${expect.tipIncludes}", got: ${out.response.text}`);
  return out;
}

console.log("Teaching loop on real practice-signal shapes (as finishPractice feeds them):");

// 1. struggling run: low accuracy, broken combo, several misses, 3 pauses
await runCase("struggle: 45% acc, 4 miss, combo 0, 3 pauses, rhythm 50",
  { accuracy: 45, repeatedErrors: 4, repeatedErrorLabel: "C Major Scale", pauses: 3, rhythmScore: 50, speedRatio: null, weekAgoAccuracy: 70 },
  { strategy: "simplify-on-confusion", tipIncludes: "KB" });

// 2. great run: 98% accuracy, no misses, no pauses
await runCase("mastery: 98% acc, 0 miss, 0 pauses",
  { accuracy: 98, repeatedErrors: 0, pauses: 0, rhythmScore: 92, speedRatio: null, weekAgoAccuracy: 95 },
  { strategy: "continue-current-plan" });

// 3. hesitation only: decent accuracy but many pauses
await runCase("hesitation: 78% acc, 1 miss, 4 pauses",
  { accuracy: 78, repeatedErrors: 0, pauses: 4, rhythmScore: 75, speedRatio: null, weekAgoAccuracy: null },
  { strategy: "continue-current-plan" });

// 4. progress stall: accuracy flat vs last time
await runCase("stall: 72% now vs 70% a week ago, misses >= 4",
  { accuracy: 72, repeatedErrors: 4, repeatedErrorLabel: "Ode to Joy", pauses: 0, rhythmScore: 70, speedRatio: null, weekAgoAccuracy: 70 });

// 5. typical mid run: nothing notable — must NOT crash, must give the neutral line
await runCase("neutral: 85% acc, 1 miss, 1 pause",
  { accuracy: 85, repeatedErrors: 0, pauses: 1, rhythmScore: null, speedRatio: null, weekAgoAccuracy: null });

// 6. the exact shape a guest's first-ever drill produces (no memory, no rhythm)
await runCase("first-ever drill: 60% acc, 5 miss, 0 pauses, no rhythm, no history",
  { accuracy: 60, repeatedErrors: 5, repeatedErrorLabel: "Twinkle", pauses: 0, rhythmScore: null, speedRatio: null, weekAgoAccuracy: null },
  { strategy: "simplify-on-confusion" });

// 7. speed uneven path (accuracy fine but rushing) — needs speedRatio which
//    finishPractice passes as null today, so this just proves null stays safe
await runCase("null speedRatio + all signals present",
  { accuracy: 90, repeatedErrors: 0, pauses: 0, rhythmScore: 88, speedRatio: null, weekAgoAccuracy: 88 });

console.log(`\nAll ${n} practice-loop cases passed ✅`);
