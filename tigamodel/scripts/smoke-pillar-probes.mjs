/* smoke-pillar-probes.mjs — plan v3.8 ระลอก 13 (13.1) per-pillar capability
   probes. Proves on REAL code (esbuild + import — repo convention):
     • the 5 owner pillars are the same domains the MeasurePanel reports,
       each carrying the SAME per-pillar floor the knowledge-pillars smoke
       enforces (14/14/12/10/40, cross-checked verbatim — one bar, not two)
     • capabilityPillars() returns all five, weakest-first, every field real
       (entry counts from the seeded KB, teach coverage, honest score)
     • the score formula is verifiable: min(1, depth×(0.7+0.3×teachQ)) —
       recomputed independently from the reported counts and matched exactly
     • an unknown domain degrades honestly (0 entries, score 0, not ready,
       no throw) — never a guessed readiness
     • today's KB clears every pillar's own floor (and if a future edit
       starves one, THIS smoke is what fails — the bench bar "weakest ขอมุม
       5 ขุม" then reports the truth)
     • web.js pass-throughs agree with the engine
   Run: node tigamodel/scripts/smoke-pillar-probes.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-pillars";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

fs.rmSync(OUT, { recursive: true, force: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(OUT, "web.js")).href);
const cap = await import(url.pathToFileURL(path.join(ROOT, "tigamodel", "teaching", "capability-engine.js")).href);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

console.log("tigamodel capability engine (13.1 pillar probes):");
web.ensureTigamodelWeb();
const eng = web.getCapabilityEngine();

check("vocabulary: exactly the 5 owner pillars, each at the pillars smoke's own per-pillar floor", () => {
  const list = cap.PILLAR_DOMAINS;
  if (!Array.isArray(list) || list.length !== 5) throw new Error(`got ${list && list.length}`);
  const want = ["music-marketing", "music-business", "music-education-market", "music-therapy", "music-innovation"];
  for (const p of list) {
    if (!want.includes(p.domain)) throw new Error(`unexpected domain: ${p.domain}`);
    for (const lg of ["th", "en", "zh"]) if (!p[lg]) throw new Error(`${p.domain}.${lg} missing`);
  }
  /* one bar, two places, smoke-checked: each pillar's floor here must equal
     the checkFile(expectMin) in smoke-knowledge-pillars.mjs verbatim */
  const src = fs.readFileSync(path.join(ROOT, "tigamodel", "scripts", "smoke-knowledge-pillars.mjs"), "utf8");
  for (const p of list) {
    const re = new RegExp('checkFile\\([^\\n]*"' + p.domain + '",\\s*' + p.min + "\\s*\\)");
    if (!re.test(src)) throw new Error(`${p.domain} floor ${p.min} does not match the pillars smoke's checkFile bar`);
  }
});

check("capabilityPillars: all 5, weakest-first, fields real", () => {
  const rows = web.capabilityPillars();
  if (!Array.isArray(rows) || rows.length !== 5) throw new Error(`got ${rows && rows.length}`);
  for (let i = 1; i < rows.length; i++) if (rows[i - 1].score > rows[i].score) throw new Error("not sorted weakest-first");
  for (const r of rows) {
    if (typeof r.entries !== "number" || r.entries < 0) throw new Error(`${r.domain}: bad entries`);
    if (r.teach > r.entries) throw new Error(`${r.domain}: teach > entries`);
    if (r.score < 0 || r.score > 1) throw new Error(`${r.domain}: score out of range ${r.score}`);
    if (typeof r.ready !== "boolean") throw new Error(`${r.domain}: ready not boolean`);
  }
});

check("score formula verifiable: min(1, depth×(0.7+0.3×teachQ)) recomputed exactly", () => {
  for (const r of web.capabilityPillars()) {
    const depth = r.entries >= r.min ? 1 : r.entries / r.min;
    const teachQ = r.entries ? r.teach / r.entries : 0;
    const want = Math.min(1, depth * (0.7 + 0.3 * teachQ));
    if (Math.abs(r.score - want) > 1e-9) throw new Error(`${r.domain}: reported ${r.score}, formula ${want}`);
    if (r.ready !== (r.entries >= r.min && r.teach === r.entries)) throw new Error(`${r.domain}: ready mismatch`);
  }
});

check("unknown domain degrades honestly (no guessed readiness, no throw)", () => {
  const r = eng.pillarProbe("music-astrology");
  if (!r) throw new Error("returned null");
  if (r.entries !== 0 || r.score !== 0 || r.ready !== false) throw new Error(`not honest: ${JSON.stringify(r)}`);
  if (eng.pillarProbe(null) === undefined) throw new Error("null domain must still return a probe object");
});

check("today's KB clears every pillar's own floor (marketing 14 / business 14 / edu 12 / therapy 10 / innovation 40)", () => {
  for (const r of web.capabilityPillars()) {
    if (r.entries < r.min) throw new Error(`${r.domain}: ${r.entries} < ${r.min} — the bench bar will now report this truthfully`);
    if (!r.ready) throw new Error(`${r.domain}: entries ok but teach coverage incomplete (${r.teach}/${r.entries})`);
  }
});

check("weakest-of-5 is computable and agrees with an independent recount (same score formula)", () => {
  const rows = web.capabilityPillars();
  const weakest = rows[0];
  const kb = web.getKnowledgeBaseForTest();
  const minOf = (d) => cap.PILLAR_DOMAINS.find(x => x.domain === d).min;
  const recount = rows.map(r => {
    let n = 0, teach = 0;
    try { for (const [, e] of kb._entries) if (e.domain === r.domain) { n++; if (e.teach) teach++; } } catch (e) {}
    const depth = n >= minOf(r.domain) ? 1 : n / minOf(r.domain);
    const teachQ = n ? teach / n : 0;
    return { domain: r.domain, n, score: Math.min(1, depth * (0.7 + 0.3 * teachQ)) };
  }).sort((a, b) => a.score - b.score)[0];
  if (recount.domain !== weakest.domain) throw new Error(`engine says ${weakest.domain}, recount says ${recount.domain}`);
  if (recount.n !== weakest.entries) throw new Error(`engine counted ${weakest.entries}, recount ${recount.n}`);
  if (Math.abs(recount.score - weakest.score) > 1e-9) throw new Error(`score mismatch ${recount.score} vs ${weakest.score}`);
});

check("web.js pass-throughs exist and agree with the engine", () => {
  const viaWeb = web.capabilityPillars();
  const viaEng = eng.pillars();
  if (JSON.stringify(viaWeb.map(r => r.domain)) !== JSON.stringify(viaEng.map(r => r.domain))) throw new Error("order mismatch");
  const one = web.capabilityPillarProbe("music-therapy");
  if (!one || one.domain !== "music-therapy") throw new Error("pillarProbe pass-through broken");
});

console.log(`\n  ${passed} passed, ${failed} failed`);
fs.rmSync(OUT, { recursive: true, force: true });
if (failed > 0) process.exit(1);
