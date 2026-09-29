/* Smoke: KB legal-compliance scanner (docs/07 items A+C+D, plan-v3 m16) —
   runs the REAL scanner against the REAL full KB (all ~17k entries seeded
   exactly as production does) AND against dirty fixtures that MUST be caught
   (a scanner that can't catch dirt is decoration). Repo convention: real
   modules via esbuild, plain node assertions. */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-compliance";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/compliance/kb-compliance.js --bundle --outfile=${OUT}/comp.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const webM = await import(pathToFileURL(`${OUT}/web.js`).href);
const comp = await import(pathToFileURL(`${OUT}/comp.js`).href);
/* pure data module — import the REAL source registry directly */
const { SOURCES } = await import(pathToFileURL("tigamodel/knowledge/university-sources.js").href);

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

webM.initTigamodelWeb();
const kb = webM.getKnowledgeBaseForTest();
const entries = [...kb._entries.values()];

console.log("tigamodel KB legal-compliance smoke (docs/07 A+C+D):");

/* ── the REAL KB, every entry ── */
const report = comp.auditKB(entries, SOURCES);

check(`scanned the REAL KB — ${report.checked.toLocaleString()} entries (no shortcut)`, () => {
  assert.ok(report.checked > 15000, `only ${report.checked} — not the real KB`);
});

check(`A1 attribution: 0 untraceable citations across the whole KB`, () => {
  assert.strictEqual(report.unregistered, 0, report.flags.filter(f => f.check === "attribution").slice(0, 5).map(f => `${f.id}: ${f.detail}`).join("; "));
});

check("A2 verbatim: 0 long copied passages from any stored source excerpt", () => {
  const hits = report.flags.filter(f => f.check === "verbatim-en" || f.check === "verbatim-thzh");
  assert.strictEqual(hits.length, 0, hits.slice(0, 5).map(f => `${f.id}: ${f.detail}`).join("; "));
});

check("C trademark: 0 endorsement/partnership phrasings anywhere", () => {
  const hits = report.flags.filter(f => f.check === "trademark");
  assert.strictEqual(hits.length, 0, hits.slice(0, 5).map(f => `${f.id}: ${f.detail}`).join("; "));
});

check("D therapy: every health/therapy entry carries its wellbeing frame in-body", () => {
  const therapy = entries.filter(e => e.domain === "music-therapy" || e.domain === "health");
  assert.ok(therapy.length > 0, "scanner should see the real therapy entries");
  const hits = report.flags.filter(f => f.check === "therapy-frame" || f.check === "therapy-claim");
  assert.strictEqual(hits.length, 0, hits.slice(0, 5).map(f => `${f.id}: ${f.detail}`).join("; "));
});

check("REAL KB verdict: CLEAN (0 flags of any kind)", () => {
  assert.deepStrictEqual(report.flags, [], JSON.stringify(report.flags.slice(0, 5)));
});

/* ── dirty fixtures: the scanner MUST catch each class ── */
const baseEntry = { id: "t:1", domain: "rhythm", title: "ok", body: "steady beat practice helps", source: "tiga-original" };
const dirtySource = {
  "test-src": { title: "Test source", url: "https://example.com/x", site: "example.com", read_at: "2026-09-29",
    notes: "The conservatory accepts students from age three through doctoral study with a large public program" },
};

check("scanner catches a LONG VERBATIM copy (12 shared words from source excerpt)", () => {
  const dirty = [{ ...baseEntry, source: "test-src", body: "Students begin at age three; the conservatory accepts students from age three through doctoral study with a large public program indeed" }];
  const r = comp.auditKB(dirty, dirtySource);
  assert.ok(r.flags.some(f => f.check === "verbatim-en"), JSON.stringify(r.flags));
});

check("scanner catches an UNREGISTERED source id", () => {
  const dirty = [{ ...baseEntry, source: "random-blog-123" }];
  const r = comp.auditKB(dirty, dirtySource);
  assert.ok(r.flags.some(f => f.check === "attribution"));
});

check("scanner catches ENDORSEMENT phrasing (Getty lesson)", () => {
  const dirty = [{ ...baseEntry, title: "Official partnership with Berklee" }];
  const r = comp.auditKB(dirty, {});
  assert.ok(r.flags.some(f => f.check === "trademark"));
});

check("scanner catches a therapy entry WITHOUT the wellbeing frame", () => {
  const dirty = [{ ...baseEntry, domain: "music-therapy", body: "music therapy helps everyone relax deeply" }];
  const r = comp.auditKB(dirty, {});
  assert.ok(r.flags.some(f => f.check === "therapy-frame"));
});

check("scanner catches CURE/DIAGNOSIS claims in therapy entries", () => {
  const dirty = [{ ...baseEntry, domain: "music-therapy", body: "หลักการทั่วไป (wellbeing frame: ไม่ใช่บริการทางการแพทย์) — และดนตรีรักษาโรคซึมเศร้าได้" }];
  const r = comp.auditKB(dirty, {});
  assert.ok(r.flags.some(f => f.check === "therapy-claim"), JSON.stringify(r.flags));
});

check("clean paraphrase from a registered source passes (no false positive)", () => {
  const clean = [{ ...baseEntry, source: "test-src", body: "ตัวอย่างการถอดความ: หลักการที่นำมาใช้คือผู้เรียนทุกวัยควรมีเส้นทางของตัวเอง (paraphrased principle, ages three to doctoral)" }];
  const r = comp.auditKB(clean, dirtySource);
  assert.deepStrictEqual(r.flags, []);
});

check("determinism: same KB → identical report", () => {
  const a = comp.auditKB(entries, SOURCES);
  const b = comp.auditKB(entries, SOURCES);
  assert.deepStrictEqual(a, b);
});

console.log(`\n  real KB: ${report.checked.toLocaleString()} entries, flags=${report.flags.length} (${JSON.stringify(report.byCheck)})`);
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
