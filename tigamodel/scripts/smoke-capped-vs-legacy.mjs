/* Smoke: capped vs legacy, measured (docs/14 §2, m46).

   Proves the two claims the plan asks for, on the REAL production function
   (tigamodel/web.js getKBContext) and the REAL retrieval probes:
     1. NO QUALITY REGRESSION — with the cap ON, no probe scores lower than with
        the legacy path (same scorer the retrieval gate uses)
     2. MEASURABLE COST DROP — the characters actually shipped, plus a
        clearly-labelled chars/4 token estimate (never presented as a tokenizer
        count)
   Also checks determinism and that a broken block cannot fake a pass.

   Run: node tigamodel/scripts/smoke-capped-vs-legacy.mjs  (exit 1 on any fail) */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-capped-eval";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/evaluation/capped-eval.js --bundle --outfile=${OUT}/capped-eval.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const web = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const { compareCappedVsLegacy, TOKEN_ESTIMATE_CHARS_PER_TOKEN } = await import(pathToFileURL(`${OUT}/capped-eval.js`).href);
await web.ensureTigamodelWeb();

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

console.log("smoke-capped-vs-legacy (docs/14 §2, m46):\n");

web.kbHotPath().clearHot();
const legacy = (q) => { web.setKbHotPathEnabled(false); const b = web.getKBContext(q); web.setKbHotPathEnabled(true); return b; };
const capped = (q) => { web.kbHotPath().clearHot(); return web.getKBContext(q); };
const report = compareCappedVsLegacy({ legacy, capped });

check(`all ${report.probes} real probes measured`, () => {
  assert.ok(report.probes >= 24, `expected the full probe set, got ${report.probes}`);
  assert.strictEqual(report.rows.length, report.probes);
});

check("QUALITY: capped never scores below legacy (no regression)", () => {
  assert.deepStrictEqual(report.regressions, [], `regressions: ${JSON.stringify(report.regressions)}`);
  assert.ok(report.noRegression);
  assert.ok(report.accuracyCapped >= report.accuracyLegacy,
    `capped accuracy ${report.accuracyCapped} < legacy ${report.accuracyLegacy}`);
  console.log(`     · legacy ${(report.accuracyLegacy * 100).toFixed(1)}% · capped ${(report.accuracyCapped * 100).toFixed(1)}% (${report.cappedCorrect}/${report.probes})`);
});

check("COST: the capped block ships far fewer characters, per probe and in total", () => {
  assert.ok(report.cappedChars < report.legacyChars, `${report.cappedChars} !< ${report.legacyChars}`);
  const worse = report.rows.filter(r => r.cappedChars > r.legacyChars);
  assert.deepStrictEqual(worse.map(r => r.id), [], "no probe may grow");
  console.log(`     · ${report.legacyChars.toLocaleString()} → ${report.cappedChars.toLocaleString()} chars (ลด ${(report.shrink * 100).toFixed(1)}%)`);
});

check("the token number is an ESTIMATE and says so", () => {
  assert.strictEqual(report.tokenEstimate.charsPerToken, TOKEN_ESTIMATE_CHARS_PER_TOKEN);
  assert.ok(/ประมาณการ/.test(report.tokenEstimate.note), "the note must mark it as an estimate");
  assert.ok(report.tokenEstimate.capped < report.tokenEstimate.legacy);
  assert.ok(/tokenizer/.test(report.tokenEstimate.note), "it must say it is NOT a tokenizer count");
});

check("determinism: measuring twice gives the same numbers", () => {
  const again = compareCappedVsLegacy({ legacy, capped });
  assert.deepStrictEqual(again.rows, report.rows);
  assert.strictEqual(again.cappedChars, report.cappedChars);
});

check("a broken/missing block cannot fake a pass", () => {
  const bad = compareCappedVsLegacy({ legacy: () => "", capped: () => "" });
  assert.strictEqual(bad.noRegression, true, "no regression when both are empty…");
  assert.strictEqual(bad.accuracyCapped, 0, "…but the accuracy is honestly 0, not a pass");
  assert.strictEqual(bad.cappedChars, 0);
  const onlyCapped = compareCappedVsLegacy({ legacy: () => "", capped: () => "• [PEDAL] x — วิธีสอน: y" });
  assert.strictEqual(onlyCapped.noRegression, true, "capped scoring HIGHER than legacy is not a regression");
  assert.ok(onlyCapped.accuracyCapped > onlyCapped.accuracyLegacy, "and it must show up as a measured win");
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
