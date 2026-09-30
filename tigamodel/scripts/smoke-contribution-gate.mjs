/* Smoke: Contribution Gate (docs/09 layer 1, m25) — proves the gate ACCEPTS
   clean contributions and REJECTS every dirty class with reasons, through the
   REAL modules (kb-compliance inside). Repo convention: esbuild + plain node
   assertions. */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-gate";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execSync(`npx esbuild tigamodel/compliance/contribution-gate.js --bundle --outfile=${OUT}/gate.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
const gate = await import(pathToFileURL(`${OUT}/gate.js`).href);

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

const clean = {
  content: { title: "การฝึกนิ้ว 5 นิ้วแบบผ่อนแรง", body: "หลักการกว้าง: ฝึกห้านิ้วด้วยแรงเบาที่สุดที่ยังได้เสียงชัด ช่วยให้มือไม่เกร็งและเรียนรู้การควบคุมก่อนความเร็ว", teach: "ให้เล่นช้าแล้วดูไหล่คลาย ไม่พูดถึงความเร็วเลยใน 2 สัปดาห์แรก", domain: "technique" },
  license: "contributor-own-work",
  source: { kind: "own-work" },
  contributor: { id: "teacher-001", name: "อาจารย์สมชาย" },
};

console.log("tigamodel contribution gate smoke (docs/09 m25):");

check("clean own-work contribution → verdict 'clean' + entry returned with credit", () => {
  const r = gate.reviewContribution(clean);
  assert.strictEqual(r.verdict, "clean", JSON.stringify(r.reasons));
  assert.strictEqual(r.entry.contributor.id, "teacher-001");
  assert.strictEqual(r.entry.license, "contributor-own-work");
});

check("clean public-fact (cc-by + URL + excerpt) → clean", () => {
  const r = gate.reviewContribution({
    ...clean, license: "cc-by", source: { kind: "public-fact", url: "https://example.org/music-ed", excerpt: "Relaxed five-finger patterns are a staple of beginning technique work in widely used method traditions." },
  });
  assert.strictEqual(r.verdict, "clean", JSON.stringify(r.reasons));
});

check("public-fact WITHOUT excerpt (unverifiable claim) → rejected", () => {
  const r = gate.reviewContribution({
    ...clean, license: "cc-by", source: { kind: "public-fact", url: "https://example.org/music-ed" },
  });
  assert.ok(r.reasons.includes(gate.REJECT_REASONS.SOURCE_EXCERPT));
});

check("anonymous submission → rejected (IDENTITY)", () => {
  const r = gate.reviewContribution({ ...clean, contributor: {} });
  assert.strictEqual(r.verdict, "rejected");
  assert.ok(r.reasons.includes(gate.REJECT_REASONS.IDENTITY));
});

check("unknown license → rejected (LICENSE)", () => {
  const r = gate.reviewContribution({ ...clean, license: "sure-take-it" });
  assert.ok(r.reasons.includes(gate.REJECT_REASONS.LICENSE));
});

check("someone else's copyrighted work (kind not allowed) → rejected (SOURCE_KIND)", () => {
  const r = gate.reviewContribution({ ...clean, license: "cc-by", source: { kind: "scraped-book" } });
  assert.ok(r.reasons.includes(gate.REJECT_REASONS.SOURCE_KIND));
});

check("public-fact without URL → rejected (SOURCE_URL)", () => {
  const r = gate.reviewContribution({ ...clean, license: "public-domain", source: { kind: "public-fact" } });
  assert.ok(r.reasons.includes(gate.REJECT_REASONS.SOURCE_URL));
});

check("LONG VERBATIM copy of the attached source excerpt → rejected (SCANNER)", () => {
  const r = gate.reviewContribution({
    ...clean, license: "public-domain",
    source: { kind: "public-fact", url: "https://example.org/method", excerpt: "the student must first learn relaxation at the keyboard before ever attempting speed and control of sound quality" },
    content: { ...clean.content, body: "The famous method book states verbatim that the student must first learn relaxation at the keyboard before ever attempting speed and control of sound quality indeed" },
  });
  assert.strictEqual(r.verdict, "rejected");
  assert.ok(r.reasons.includes(gate.REJECT_REASONS.SCANNER));
  assert.ok(r.checks.verbatim > 0, JSON.stringify(r.checks));
});

check("endorsement phrasing → rejected (Getty lesson, SCANNER/trademark)", () => {
  const r = gate.reviewContribution({
    ...clean, license: "public-domain", source: { kind: "public-fact", url: "https://x.org/a", excerpt: "context line" },
    content: { ...clean.content, title: "Official partnership with a famous conservatory" },
  });
  assert.strictEqual(r.verdict, "rejected");
});

check("therapy content without the wellbeing frame → rejected", () => {
  const r = gate.reviewContribution({
    ...clean, license: "public-domain", source: { kind: "public-fact", url: "https://x.org/b", excerpt: "บริบท" },
    content: { ...clean.content, domain: "music-therapy", body: "เล่นเปียโนทุกวันช่วยรักษาโรคซึมเศร้าได้" },
  });
  assert.strictEqual(r.verdict, "rejected");
});

check("batch review: one dirty submission never poisons the crate", () => {
  const rs = gate.reviewBatch([clean, { ...clean, contributor: {} }]);
  assert.strictEqual(rs[0].verdict, "clean");
  assert.strictEqual(rs[1].verdict, "rejected");
});

check("determinism: same submission → identical verdict", () => {
  const a = gate.reviewContribution(clean);
  const b = gate.reviewContribution(clean);
  assert.deepStrictEqual(a, b);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
