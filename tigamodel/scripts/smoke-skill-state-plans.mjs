/* Smoke: skill-state plans (docs/05 §3 / plan-v3 m08) — the REAL thinking
   core, tested against fixtures per the docs/05 §3 promise ("smoke ใหม่:
   ability ต่ำ → drill ง่ายลงจริง ≥80% ของเคส; state หาย → fallback เดิม").
   The data adapter (real learning_* rows) lands when the owner's approved
   SQL runs — this proves the decisions are correct BEFORE any data arrives,
   so activation is wiring, not new logic. Repo convention: real module via
   esbuild, plain node assertions. */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-ssp";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execSync(`npx esbuild tigamodel/teaching/skill-state-plans.js --bundle --outfile=${OUT}/ssp.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
const ssp = await import(pathToFileURL(`${OUT}/ssp.js`).href);

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

/* Fixtures: two students' ability maps + the coach's drill pool. */
const abilityWeakRhythm = [
  { skill_id: "skill:note-reading", ability: 0.8, confidence: 0.9 },
  { skill_id: "skill:steady-beat", ability: 0.3, confidence: 0.85 },
  { skill_id: "skill:basic-chords", ability: 0.6, confidence: 0.7 },
];
/* rhythm is still the weakest skill, but strong — exercises the step-up path */
const abilityStrongRhythm = [
  { skill_id: "skill:note-reading", ability: 0.95, confidence: 0.9 },
  { skill_id: "skill:steady-beat", ability: 0.8, confidence: 0.85 },
  { skill_id: "skill:basic-chords", ability: 0.9, confidence: 0.7 },
];
const lowConf = abilityWeakRhythm.map(a => a.skill_id === "skill:steady-beat" ? { ...a, confidence: 0.3 } : a);
const drills = [
  { id: "d1", skill_id: "skill:steady-beat", level: 2, title: "นับช้า 4 จังหวะ" },
  { id: "d2", skill_id: "skill:steady-beat", level: 3, title: "นับพร้อมเมโทรโนม" },
  { id: "d3", skill_id: "skill:steady-beat", level: 4, title: "syncopation พื้นฐาน" },
  { id: "d4", skill_id: "skill:note-reading", level: 3, title: "อ่านไล่ 5 ตัว" },
];

console.log("tigamodel skill-state plans smoke (docs/05 §3):");

check("weakest skill wins the plan (note-reading 0.8 vs steady-beat 0.3 → rhythm drill)", () => {
  const p = ssp.buildPersonalizedPlan(abilityWeakRhythm, drills);
  assert.strictEqual(p.skill_id, "skill:steady-beat");
  assert.ok(["d1", "d2", "d3"].includes(p.drill_id), `drill from the weak skill's pool: ${p.drill_id}`);
});

check("docs/05 §3 promise: LOW ability → plan eases a level (>=80% of cases = deterministic here, 100%)", () => {
  const p = ssp.buildPersonalizedPlan(abilityWeakRhythm, drills);
  assert.strictEqual(p.adjust, "ease");
  assert.strictEqual(p.level, 2); // base 3 − 1
});

check("HIGH ability → plan steps a level up", () => {
  const p = ssp.buildPersonalizedPlan(abilityStrongRhythm, drills);
  assert.strictEqual(p.adjust, "step-up");
  assert.strictEqual(p.level, 4);
});

check("mid ability → hold (no over-reacting)", () => {
  const mid = abilityWeakRhythm.map(a => a.skill_id === "skill:steady-beat" ? { ...a, ability: 0.55 } : a);
  const p = ssp.buildPersonalizedPlan(mid, drills);
  assert.strictEqual(p.adjust, "hold");
});

check("LOW confidence → observe, never adjust (สังเกต ≠ สรุป)", () => {
  const p = ssp.buildPersonalizedPlan(lowConf, drills);
  assert.strictEqual(p.adjust, "hold");
  assert.match(p.reason, /สังเกต/);
});

check("no ability data → null (caller keeps the current plan — honest fallback)", () => {
  assert.strictEqual(ssp.buildPersonalizedPlan([], drills), null);
  assert.strictEqual(ssp.buildPersonalizedPlan(abilityWeakRhythm, []), null);
  assert.strictEqual(ssp.buildPersonalizedPlan([{ skill_id: "x", ability: "junk" }], drills), null);
});

check("kill switch off → null (tiga_personalized_plans)", () => {
  assert.strictEqual(ssp.buildPersonalizedPlan(abilityWeakRhythm, drills, { switchOn: false }), null);
});

check("no drill pool for the weak skill → null, never a wrong-skill drill", () => {
  const p = ssp.buildPersonalizedPlan(abilityWeakRhythm, [drills[3]]); // only note-reading drills
  assert.strictEqual(p, null);
});

check("determinism: same inputs → identical plan", () => {
  const a = ssp.buildPersonalizedPlan(abilityWeakRhythm, drills);
  const b = ssp.buildPersonalizedPlan(abilityWeakRhythm, drills);
  assert.deepStrictEqual(a, b);
});

check("ability clamped into [0,1] — junk never breaks the decision", () => {
  const p = ssp.buildPersonalizedPlan(
    [{ skill_id: "skill:steady-beat", ability: 7, confidence: 0.9 }, { skill_id: "skill:note-reading", ability: -3, confidence: 0.9 }],
    drills
  );
  assert.ok(p.ability >= 0 && p.ability <= 1);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
