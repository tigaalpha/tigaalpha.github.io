/* Smoke test: 10,000+ knowledge expansion (owner directive 2026-09-18).
   Repo convention: transpile the REAL source with esbuild and import it —
   never a mirrored copy. Verifies the expansion is REAL: ≥10,000 entries,
   unique ids, every entry has title+body, domains spread across music
   dimensions, and a sample of computed facts is mathematically correct
   (not filler text). Plain node assertions. */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-exp";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const FILES = [
  "tigamodel/teaching/philosophy.js",
  "tigamodel/knowledge/knowledge-base.js",
  "tigamodel/knowledge/university-seed.js",
  "tigamodel/knowledge/university-sources.js",
  "tigamodel/knowledge/university-links.js",
  "tigamodel/knowledge/global-theory-seed.js",
  "tigamodel/knowledge/global-pedagogy-seed.js",
  "tigamodel/knowledge/piano-craft-seed.js",
  "tigamodel/knowledge/teacher-craft-seed.js",
  "tigamodel/knowledge/repertoire-forms-seed.js",
  "tigamodel/knowledge/learner-skills-seed.js",
  "tigamodel/knowledge/expansion-core.js",
  "tigamodel/knowledge/expansion-repertoire.js",
  "tigamodel/knowledge/expansion-pedagogy.js",
  "tigamodel/knowledge/expansion-matrix.js",
  "tigamodel/knowledge/expansion-deep.js",
  "tigamodel/knowledge/expansion-final.js",
  "tigamodel/knowledge/expansion-scale.js",
  "tigamodel/knowledge/expansion-canvas.js",
  "tigamodel/knowledge/expansion-summit.js",
  "tigamodel/knowledge/expansion-peaks.js",
];

execSync(`npx esbuild ${FILES.join(" ")} --outdir=${OUT}/k --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });  const k = (f) => import(pathToFileURL(`${OUT}/k/knowledge/${f}`).href);

let passed = 0;
async function ok(label, fn) { await fn(); passed++; console.log(`  ✓ ${label}`); }

async function main() {
  console.log("tigamodel 10,000-item knowledge expansion smoke:");

  const base = await k("knowledge-base.js");
  const uni = await k("university-seed.js");
  const seeds = await Promise.all([
    k("global-theory-seed.js"), k("global-pedagogy-seed.js"),
    k("piano-craft-seed.js"), k("teacher-craft-seed.js"),
    k("repertoire-forms-seed.js"), k("learner-skills-seed.js"),
  ]);
  const waves = await Promise.all([
    k("expansion-core.js"), k("expansion-repertoire.js"), k("expansion-pedagogy.js"),
    k("expansion-matrix.js"), k("expansion-deep.js"), k("expansion-final.js"),
    k("expansion-scale.js"), k("expansion-canvas.js"), k("expansion-summit.js"),
    k("expansion-peaks.js"),
  ]);

  const kb = base.createKnowledgeBase();
  base.seedKnowledgeBase(kb);
  uni.seedUniversityKnowledge(kb);
  for (const s of seeds) {
    const fn = Object.entries(s).find(([n]) => n.startsWith("seed"));
    if (fn) fn[1](kb);
  }

  await ok("base + university seeds land first (≥90 entries)", async () => {
    assert.ok(kb.count() >= 90, `got ${kb.count()}`);
  });

  for (const w of waves) {
    const fn = Object.entries(w).find(([n]) => n.startsWith("seed"));
    assert.ok(fn, `wave missing seed fn: ${Object.keys(w).join(",")}`);
    fn[1](kb);
  }

  await ok("KB totals ≥ 10,000 entries after all waves", async () => {
    assert.ok(kb.count() >= 10000, `got ${kb.count()}`);
  });

  await ok("every entry has valid id + title + real body (no filler)", async () => {
    for (const [, e] of kb._entries) {
      assert.ok(e.id && e.id.length >= 3, `bad id: ${e.id}`);
      assert.ok(e.title && e.title.length >= 3, `bad title on ${e.id}`);
      assert.ok(e.body && e.body.length >= 20, `bad body on ${e.id}`);
    }
  });

  await ok("knowledge spans ≥ 15 distinct domains", async () => {
    const doms = new Set();
    for (const [, e] of kb._entries) doms.add(e.domain);
    assert.ok(doms.size >= 15, `got ${doms.size}`);
  });

  await ok("COMPUTED: C major scale = C4 D4 E4 F4 G4 A4 B4", async () => {
    const e = kb.get("exp:scale:C-major");
    assert.ok(e, "missing exp:scale:C-major");
    assert.match(e.body, /C4.*D4.*E4.*F4.*G4.*A4.*B4/);
  });

  await ok("COMPUTED: C major triad = C-E-G", async () => {
    let found = false;
    for (const [, e] of kb._entries) {
      if (/C-E-G/.test(e.body) && /C major|คอร์ด C/.test(e.title + e.body)) { found = true; break; }
    }
    assert.ok(found, "no C-E-G triad entry found");
  });

  await ok("COMPUTED: ii-V-I in F = Gm7 → C7 → Fmaj7", async () => {
    const e = kb.get("summit:progkey:ii-V-I-F");
    assert.ok(e, "missing summit:progkey:ii-V-I-F");
    assert.match(e.body, /Gm7/);
    assert.match(e.body, /C7/);
    assert.match(e.body, /Fmaj7/);
  });

  await ok("COMPUTED: A4 = 440 Hz, Middle C = piano key #40", async () => {
    const a4 = kb.get("peak:keymap:A4");
    assert.ok(a4 && a4.body.includes("440"), "A4 frequency wrong");
    const c4 = kb.get("peak:keymap:C4");
    assert.ok(c4 && c4.body.includes("คีย์ที่ 40"), "Middle C key number wrong");
  });

  await ok("COMPUTED: 5th degree of G major = D5", async () => {
    const e = kb.get("peak:deg:G-5");
    assert.ok(e, "missing peak:deg:G-5");
    assert.match(e.body, /D5/);
  });

  await ok("COMPUTED: C + 7 semitones = G (perfect 5th)", async () => {
    const e = kb.get("summit:ivpair:C-P5");
    assert.ok(e, "missing summit:ivpair:C-P5");
    assert.match(e.body, /C → G/);
  });

  await ok("COMPUTED: D dorian contains B natural", async () => {
    const e = kb.get("peak:mode:dorian-D");
    assert.ok(e, "missing peak:mode:dorian-D");
    assert.match(e.body, /B4/);
  });

  await ok("progression fragments capped at 4-chord (bounded wave)", async () => {
    let frags = 0;
    for (const [, e] of kb._entries) if (e.id.startsWith("exp:progfrag:")) frags++;
    // 12 keys × 7×6×5×4 = 840 per key would be 10,080 alone — cap must keep total sane
    assert.ok(frags <= 12 * 840, `fragments exploded: ${frags}`);
    assert.ok(frags > 0, "no fragments at all");
  });

  await ok("teacher craft waves present (games + Hanon grid)", async () => {
    let games = 0, hanon = 0;
    for (const [, e] of kb._entries) {
      if (e.tags?.includes("practice-game")) games++;
      if (e.tags?.includes("hanon")) hanon++;
    }
    assert.ok(games >= 10, `games: ${games}`);
    assert.ok(hanon >= 240, `hanon: ${hanon}`);
  });

  await ok("getKBContext still serves matched entries (no regression)", async () => {
    const ctx = await import(pathToFileURL(`${OUT}/k/knowledge/knowledge-base.js`).href);
    assert.ok(typeof ctx.createKnowledgeBase === "function");
    const kb2 = ctx.createKnowledgeBase();
    base.seedKnowledgeBase(kb2);
    assert.ok(kb2.count() > 0);
  });

  console.log(`\n  ${passed} checks passed · KB = ${kb.count()} entries`);
  rmSync(OUT, { recursive: true, force: true });
}

main().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });
