/* Smoke: §3 wiring (docs/12 m39) — runs the REAL modules (esbuild-transpile +
   import, repo convention). Covers:
   - fetchSkillStates against a stub that records the actual select it sends
     (table + columns must be real; errors → null, never throw)
   - toAbilities: real rows convert, bad rows skipped, no rows → null (no data ≠ zero ability)
   - planForLearner: switch off → null; switch on + no data → null; switch on +
     real rows → the REAL brain's plan (ability ordering respected end-to-end)
   - kill switch name stays the single source of truth (skill-state-plans.js) */

import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = mkdtempSync(join(tmpdir(), "smoke-ssw-"));
await build({
  entryPoints: [new URL("../teaching/skill-state-wiring.js", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm",
  outfile: join(OUT, "wiring.mjs"),
});
const W = await import(pathToFileURL(join(OUT, "wiring.mjs")).href);
const P = await build2("../teaching/skill-state-plans.js");
async function build2(rel) {
  const o = mkdtempSync(join(tmpdir(), "smoke-ssw2-"));
  await build({ entryPoints: [new URL(rel, import.meta.url).pathname], bundle: true, platform: "node", format: "esm", outfile: join(o, "m.mjs") });
  return import(pathToFileURL(join(o, "m.mjs")).href);
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
}

/* stub sb that records the select call and returns fixture rows */
function makeSb(rows, { failWith = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(table);
      return {
        select(cols) {
          calls.push(cols);
          return {
            then(res, rej) {
              if (failWith) return Promise.resolve({ data: null, error: failWith }).then(res, rej);
              return Promise.resolve({ data: rows, error: null }).then(res, rej);
            },
          };
        },
      };
    },
  };
}

const REAL_ROWS = [
  { skill: "rhythm", ability: 0.82, confidence: 0.71, evidence_count: 9, trend: 0.01 },
  { skill: "note_accuracy", ability: 0.31, confidence: 0.66, evidence_count: 12, trend: -0.02 },
  { skill: "ear_training", ability: 0.55, confidence: 0.4, evidence_count: 3, trend: 0 },
];

console.log("── smoke-skill-state-wiring ──");
{
  const sb = makeSb(REAL_ROWS);
  const rows = await W.fetchSkillStates(sb);
  check("fetch: real rows come back", Array.isArray(rows) && rows.length === 3);
  check("fetch: queries the REAL table", sb.calls[0] === "learner_skill_state", sb.calls[0]);
  check("fetch: selects the real columns", /skill/.test(sb.calls[1]) && /ability/.test(sb.calls[1]) && /confidence/.test(sb.calls[1]));
}
check("fetch: DB error → null (never throw into the render path)", await W.fetchSkillStates(makeSb(null, { failWith: { message: "rls" } })) === null);
check("fetch: null client → null", await W.fetchSkillStates(null) === null);
check("fetch: garbage shape → null", await W.fetchSkillStates({}) === null);

check("convert: real rows → abilities", (() => { const a = W.toAbilities(REAL_ROWS); return a.length === 3 && a[1].skill_id === "note_accuracy" && a[1].ability === 0.31; })());
check("convert: clamps out-of-range ability into [0,1]", W.toAbilities([{ skill: "x", ability: 7, confidence: 0 }])[0].ability === 1);
check("convert: bad rows skipped, not coerced", W.toAbilities([{ skill: "", ability: 0.5 }, { skill: "y", ability: "high" }, { skill: "z", ability: 0.9 }]).length === 1);
check("convert: no usable rows → null (no data ≠ zero ability)", W.toAbilities([]) === null && W.toAbilities(null) === null);

const DRILLS = [
  { skill_id: "rhythm", id: "r3", level: 3, task: { th: "โน้ตตัวดำ" }, minutes: 5 },
  { skill_id: "rhythm", id: "r4", level: 4, task: { th: "ผสมตัวดำตัวขาว" }, minutes: 5 },
  { skill_id: "note_accuracy", id: "n1", level: 1, task: { th: "หาโน้ต C" }, minutes: 5 },
  { skill_id: "note_accuracy", id: "n2", level: 2, task: { th: "โน้ตสายขาว" }, minutes: 5 },
  { skill_id: "ear_training", id: "e2", level: 2, task: { th: "แยกเสียงสูงต่ำ" }, minutes: 5 },
  { skill_id: "ear_training", id: "e3", level: 3, task: { th: "แยกช่วงเสียง" }, minutes: 5 },
];
{
  const off = await W.planForLearner({ sb: makeSb(REAL_ROWS), drills: DRILLS, switchOn: false });
  check("switch off → null (today's behavior, exactly)", off === null);
  const nodata = await W.planForLearner({ sb: makeSb([]), drills: DRILLS, switchOn: true });
  check("switch on + no data → null (never guess)", nodata === null);
  const noclient = await W.planForLearner({ sb: null, drills: DRILLS, switchOn: true });
  check("no client → null", noclient === null);
  const plan = await W.planForLearner({ sb: makeSb(REAL_ROWS), drills: DRILLS, switchOn: true });
  const expect = P.buildPersonalizedPlan(W.toAbilities(REAL_ROWS), DRILLS, { switchOn: true });
  check("switch on + real data → the REAL brain's plan (identical to calling it directly)",
    plan && JSON.stringify(plan) === JSON.stringify(expect));
  check("plan is personal: weakest tracked skill (note_accuracy 0.31) is targeted",
    JSON.stringify(plan).includes("note_accuracy"));
}
check("kill switch key stays the single source of truth", W.SKILL_STATE_WIRING_SWITCH === "tiga_personalized_plans");

console.log(`\n${fail === 0 ? "✅" : "❌"} smoke-skill-state-wiring: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
