/* Smoke: Lab accuracy audit (docs/16 §2, m50) — runs the REAL web.js facade
   and the REAL lab-accuracy module (repo convention: esbuild-transpile actual
   source, import() it; supabase-client stubbed). Verifies:
   - five measured layers from the REAL modules, all passing at seeded state
   - per-layer honesty: missing inputs → layer absent (unavailable), never a
     faked number
   - overall = the mean of the measured layers; allPass requires every layer
   - history: bounded 30, newest first, survives private mode (never throws) */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-labacc";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/evaluation/lab-accuracy.js tigamodel/evaluation/retrieval-eval.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const webM = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const L = await import(pathToFileURL(`${OUT}/lab-accuracy.js`).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
}

console.log("── smoke-lab-accuracy ──");
webM.initTigamodelWeb();

/* ── 1. the REAL facade produces the full audit ── */
const audit = await webM.runModelAccuracyAudit();
{
  const ids = audit.layers.map(l => l.id);
  check("5 measured layers present (retrieval/policy/materials/quality/compliance)", ["kbRetrieval", "teachingRules", "materials", "answerQuality", "kbHealth"].every(id => ids.includes(id)), ids.join(","));
  check("retrieval layer = the real 30-probe eval, 100% at seeded state", audit.layers.find(l => l.id === "kbRetrieval").score === 100);
  check("policy layer = all 5 rule-cases correct", audit.layers.find(l => l.id === "teachingRules").score === 100);
  check("materials layer = 50/50 sets + deterministic + variety", audit.layers.find(l => l.id === "materials").pass === true);
  check("compliance layer = 0 flags over the real 17k KB", audit.layers.find(l => l.id === "kbHealth").pass === true);
  check("overall = mean of measured layers", Math.abs(audit.overall - audit.layers.reduce((s, l) => s + l.score, 0) / audit.layers.length) < 1e-9);
  check("allPass true at seeded state", audit.allPass === true);
  check("no unavailable layer", audit.unavailable.length === 0);
}

/* ── 2. answerQuality honesty: no eval run → layer absent, never faked ── */
{
  const partial = L.runModelAccuracyAudit({ getKBContext: webM.getKBContext, policy: webM.getTigamodel().policy });
  check("missing eval/generator/compliance inputs → those layers are unavailable (not zeroed)", partial.layers.every(l => ["kbRetrieval", "teachingRules"].includes(l.id)) && partial.unavailable.includes("answerQuality") && partial.unavailable.includes("kbHealth"));
  const none = L.runModelAccuracyAudit({});
  check("no inputs at all → 0 measured layers, overall null (honest empty)", none.layers.length === 0 && none.overall === null && none.allPass === false);
}

/* ── 3. policy layer catches a wrong decision (the audit can fail honestly) ── */
{
  const fakePolicy = { evaluate: () => ({ strategy_id: "wrong-strategy" }) };
  const bad = L.runModelAccuracyAudit({ policy: fakePolicy, getKBContext: webM.getKBContext });
  const pol = bad.layers.find(l => l.id === "teachingRules");
  check("a policy that answers wrong scores 0 and fails the bar (auditable, not rubber-stamped)", pol && pol.score === 0 && pol.pass === false);
}

/* ── 4. history: bounded, newest first, private-mode safe ── */
{
  const mem = new Map(); // fresh store — block 3's runs must not leak into this count
  const store = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  let rows = [];
  for (let i = 0; i < 35; i++) rows = L.saveAccuracyRun(store, { overall: 100 - i, allPass: true, layers: [] });
  // 35 saves with overall 100..66 → the 30 kept are the NEWEST 30: 66 (latest, first) .. 95
  check("history bounded at 30 runs, newest run first", rows.length === 30 && rows[0].overall === 66 && rows[29].overall === 95, `len=${rows.length} first=${rows[0] && rows[0].overall} last=${rows[29] && rows[29].overall}`);
  check("history load from empty/private store = [] (never throws)", L.loadAccuracyHistory(null).length === 0 && L.loadAccuracyHistory({}).length === 0);
  check("history save with garbage → state unchanged (never throws)", L.saveAccuracyRun(store, null).length === 30 && L.saveAccuracyRun(store, "x").length === 30);
  check("clear works", (() => { L.clearAccuracyHistory(store); return L.loadAccuracyHistory(store).length === 0; })());
}

console.log(`\n${fail === 0 ? `✅ smoke-lab-accuracy: ${pass}/${pass + fail} passed` : `❌ smoke-lab-accuracy: ${fail} FAILED`}`);
process.exit(fail ? 1 : 0);
