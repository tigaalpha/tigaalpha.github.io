/* Smoke: KB retrieval eval (docs/05 §4 / plan-v3 m07) — the FIRST accuracy
   number for the 17,090-entry KB, measured against the REAL production
   retrieval path: getKBContext() from tigamodel/web.js (the function use-chat
   actually calls), transpiled from source per repo convention, with
   supabase-client stubbed and a minimal localStorage installed (same pattern
   as smoke.mjs's Phase-4 harness).

   Gate: accuracy ≥ 0.8 (docs/05 §4: "regression gate ไม้กันที่ 80% ตลอดไป").
   Also asserts the scorer's own honesty (gibberish → empty is correct; the
   header label must never count as a domain) and the classic failure the
   probes exist to catch (pedal question must not ship the jazz block). */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-retrieval";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/evaluation/retrieval-eval.js tigamodel/evaluation/eval-expanded.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const webM = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
/* both eval files live in the same dir → esbuild flattens them to OUT root */
const rm = await import(pathToFileURL(`${OUT}/retrieval-eval.js`).href);

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

console.log("tigamodel KB retrieval eval smoke (docs/05 §4):");

/* Run every probe against the REAL getKBContext. */
const scored = rm.RETRIEVAL_PROBES.map(p => {
  const block = webM.getKBContext(p.q);
  return { id: p.id, q: p.q, labels: [...rm.servedLabels(block)], score: rm.scoreRetrieval(p, rm.servedLabels(block)) };
});

check(`all ${rm.RETRIEVAL_PROBES.length} probes produce a real production block (no silent crash)`, () => {
  for (const s of scored) {
    if (s.id === "gibberish") continue; // no topical hit → may be core/empty
    assert.ok(webM.getKBContext(s.q).length > 0, `${s.id} served nothing`);
  }
});

const acc = rm.retrievalAccuracy(scored);
check(`RETRIEVAL ACCURACY = ${(acc * 100).toFixed(1)}% (gate ≥80%) — the KB's first retrieval number`, () => {
  assert.ok(acc >= rm.RETRIEVAL_GATE, `accuracy ${(acc * 100).toFixed(1)}% below gate ${rm.RETRIEVAL_GATE * 100}%`);
});

check("classic failure caught: pedal question never ships the jazz block", () => {
  const pedal = scored.find(s => s.id === "pedal-th");
  assert.ok(pedal.labels.includes("PEDAL"), `pedal entry served (got: ${pedal.labels})`);
  assert.ok(!pedal.labels.includes("JAZZ"), `jazz leaked into pedal answer: ${pedal.labels}`);
});

check("every probe reports its served labels honestly (th/en both evaluated)", () => {
  const th = scored.filter(s => /[\u0E00-\u0E7F]/.test(s.q)).length;
  const en = scored.filter(s => s.q && !/[\u0E00-\u0E7F]/.test(s.q)).length;
  assert.ok(th >= 12 && en >= 8, `th=${th}, en=${en} — too thin`);
});

check("scorer honesty: header label [TIGA KNOWLEDGE BASE] never counts as a domain", () => {
  assert.deepStrictEqual(rm.servedLabels("[TIGA KNOWLEDGE BASE — x]\n• [PEDAL] y"), new Set(["PEDAL"]));
});

check("scorer honesty: gibberish fires no topical domain (fallback core only)", () => {
  const g = scored.find(s => s.id === "gibberish");
  assert.strictEqual(g.score, 1, `gibberish served: ${g.labels}`);
  assert.ok(g.labels.includes("MOTIVATION") && g.labels.length <= 4, `fallback core stayed small: ${g.labels}`);
});

check("no-topical-hit → the small honest core (MOTIVATION + PRACTICE PLANS), not the whole KB", () => {
  const c = scored.find(s => s.id === "core-empty");
  assert.ok(c.labels.includes("MOTIVATION") && c.labels.includes("PRACTICE PLANS"), `core served: ${c.labels}`);
  assert.ok(c.labels.length <= 4, `core must stay small: ${c.labels}`);
});

check("determinism: same question twice → identical served labels", () => {
  const a = [...rm.servedLabels(webM.getKBContext("ตอนไหนควรเหยียบแป้นเพดัล"))].sort();
  const b = [...rm.servedLabels(webM.getKBContext("ตอนไหนควรเหยียบแป้นเพดัล"))].sort();
  assert.deepStrictEqual(a, b);
});

console.log(`\n  retrieval accuracy: ${(acc * 100).toFixed(1)}% (gate ${(rm.RETRIEVAL_GATE * 100).toFixed(0)}%)`);
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
