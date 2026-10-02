#!/usr/bin/env node
/* plan-check.mjs — THE PLAN'S AUDITOR (docs/06).
   Re-verifies tigamodel/plan/plan-v3.mjs against repository reality:
     1. every referenced evidence path exists
     2. deps form a sane DAG (no unknown ids, no cycles)
     3. done/code milestones pass their smoke — by actually RUNNING it
     4. approvals are consistent: nothing claims progress past an unapproved
        owner gate (milestoneStatus is the single source of truth)
     5. kill switches promised in acceptance lines exist as files naming them
   Exit 1 on any failure. Run: node scripts/plan-check.mjs */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const planPath = "tigamodel/plan/plan-v3.mjs";
let plan;
try {
  execSync(`npx esbuild ${planPath} --bundle --outfile=node_modules/.tmp-plan-v3.js --format=esm --platform=node --loader:.mjs=js`, { stdio: "pipe" });
  plan = await import(pathToFileURL("node_modules/.tmp-plan-v3.js").href);
} catch (e) {
  console.error(`❌ cannot load the plan module itself:\n${String(e.stderr || e.message)}`);
  process.exit(1);
}

let passed = 0, failed = 0;
const ok = (name) => { console.log(`  ✅ ${name}`); passed++; };
const bad = (name, detail) => { console.log(`  ❌ ${name}\n     ${detail}`); failed++; };

const milestones = plan.MILESTONES;
const byId = new Map(milestones.map(m => [m.id, m]));

console.log("plan-check: auditing the plan as code (docs/06)\n");

/* 1 — evidence paths exist */
console.log("1) evidence paths exist");
for (const m of milestones) {
  const missing = m.evidence.filter(p => !existsSync(p));
  if (missing.length === 0) ok(`${m.id}: ${m.evidence.length} path(s) verified`);
  else bad(m.id, `missing: ${missing.join(", ")}`);
}

/* 2 — deps form a sane DAG */
console.log("\n2) dependency graph");
{
  const unknown = milestones.flatMap(m => m.deps.filter(d => !byId.has(d)));
  if (unknown.length === 0) ok("no deps pointing at unknown milestones");
  else bad("deps", `unknown ids: ${[...new Set(unknown)].join(", ")}`);

  const stateRank = { done: 3, code: 2, "awaiting-owner": 1, planned: 0 };
  const violations = milestones.flatMap(m =>
    m.deps
      .map(d => byId.get(d))
      .filter(dep => stateRank[dep.state] < stateRank[m.state])
      .map(dep => `${m.id} (${m.state}) depends on ${dep.id} (${dep.state})`)
  );
  if (violations.length === 0) ok("no milestone claims a state ahead of its deps");
  else violations.forEach(v => bad("state ordering", v));
}

/* 3 — done/code milestones pass their smoke, really */
console.log("\n3) smokes actually pass");
const SMOKES = {
  "m01-state-audit": ["tigamodel/scripts/smoke.mjs", "tigamodel/scripts/smoke-capability.mjs"],
  "m04-strategy-analyzer": ["tigamodel/scripts/smoke-strategy-analyzer.mjs"],
  "m07-retrieval-eval": ["tigamodel/scripts/smoke-retrieval.mjs"],
  "m08-skill-state-plans": ["tigamodel/scripts/smoke-skill-state-plans.mjs"],
  "m15-scorecard": ["scripts/tiga-scorecard.mjs"],
  "m25-contribution-gate": ["tigamodel/scripts/smoke-contribution-gate.mjs", "tigamodel/scripts/smoke-kb-compliance.mjs"],
  "m20-jev-policy": ["tigamodel/scripts/smoke-jev-policy.mjs", "tigamodel/scripts/smoke-reasoning.mjs"],
  "m12-fusion": ["tigamodel/scripts/smoke-fusion.mjs"],
  "m32-speed-answer-cache": ["tigamodel/scripts/smoke-answer-cache.mjs"],
  "m34-speed-kb-hotset": ["tigamodel/scripts/smoke-kb-hot-path.mjs"],
  "m44-hot-path-switch": ["tigamodel/scripts/smoke-kb-hot-path-switch.mjs"],
  "m13-cost-governor": ["tigamodel/scripts/smoke-cost-governor.mjs"],
  "m22-cost-governor": ["tigamodel/scripts/smoke-cost-governor.mjs"],
  "m39-skill-state-wiring": ["tigamodel/scripts/smoke-skill-state-wiring.mjs"],
  "m40-outcomes-counter": ["tigamodel/scripts/smoke-outcomes-report.mjs"],
  "m43-top-problems-queue": ["tigamodel/scripts/smoke-problems-queue.mjs"],
  "m50-accuracy-audit": ["tigamodel/scripts/smoke-lab-accuracy.mjs"],
  "m52-global-coverage-wave": ["tigamodel/scripts/smoke-coverage-wave.mjs"],
};
for (const [id, scripts] of Object.entries(SMOKES)) {
  const m = byId.get(id);
  if (!m || !["done", "code"].includes(m.state)) { ok(`${id}: skipped (state=${m ? m.state : "missing"})`); continue; }
  for (const s of scripts) {
    try {
      const out = execSync(`node ${s} 2>/dev/null`, { encoding: "utf8", timeout: 180000 });
      const tail = out.trim().split("\n").pop();
      ok(`${id}: ${s} → ${tail}`);
    } catch (e) {
      bad(id, `${s} FAILED:\n${String(e.stdout || e.message).split("\n").slice(-8).join("\n")}`);
    }
  }
}

/* 4 — approvals consistent with claimed states */
console.log("\n4) owner approvals");
{
  const approvals = new Map(plan.OWNER_APPROVALS.map(a => [a.item, a]));
  let consistent = true;
  for (const m of milestones) {
    if (!m.needsApproval) continue;
    const a = approvals.get(m.needsApproval);
    if (!a) { bad(m.id, `needsApproval points at unknown item ${m.needsApproval}`); consistent = false; continue; }
    const status = plan.milestoneStatus(m);
    if (status.startsWith("VIOLATION")) { bad(m.id, status); consistent = false; }
  }
  if (consistent) ok("no milestone claims progress past an unapproved owner gate");
  const pending = plan.OWNER_APPROVALS.filter(a => !a.approved);
  ok(pending.length > 0
    ? `${pending.length} SQL migration(s) awaiting owner approval: ${pending.map(a => a.label.split(" (")[0]).join("; ")}`
    : "all owner approvals granted");
}

/* 5 — kill switches promised in acceptance lines are real */
console.log("\n5) kill switches");
{
  const SWITCHES = [
    { switch: "tiga_policy_weights", file: "supabase-policy-weights-migration.sql" },
    { switch: "tiga_personalized_plans", file: "tigamodel/teaching/skill-state-plans.js" },
    { switch: "tiga_jev_policy", file: "tigamodel/teaching/teaching-loop.js" },
    { switch: "DEFAULT_CHANNEL_WEIGHTS", file: "tigamodel/multimodal/fusion.js" },
    { switch: "tiga_answer_cache", file: "tigamodel/performance/answer-cache.js" },
    { switch: "tiga_kb_hot_path", file: "tigamodel/performance/kb-hot-path.js" },
    { switch: "tiga_cost_governor", file: "tigamodel/performance/cost-governor.js" },
  ];
  for (const { switch: sw, file } of SWITCHES) {
    if (!existsSync(file)) { bad(sw, `planned switch file missing: ${file}`); continue; }
    const m = milestones.find(x => x.acceptance.includes(sw));
    if (!m) continue;
    const state = byId.get(m.id).state;
    if (state === "done" || state === "code") {
      const body = readFileSync(file, "utf8");
      if (!body.includes(sw)) bad(sw, `promised in ${m.id} acceptance but not found in ${file}`);
      else ok(`${sw} present in ${file}`);
    } else ok(`${sw}: planned in ${m.id} (file reserved: ${file})`);
  }
}

console.log(`\nplan-check: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
