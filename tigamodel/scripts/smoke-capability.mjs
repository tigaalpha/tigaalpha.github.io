/* smoke-capability.mjs — the honest readiness engine (owner directive
   "แผน 1M 13% → 100%"). Proves on REAL code:
     • engine walks all 1,000 routes and is deterministic
     • every route score comes from named capabilities with sane math
     • summary aggregation is honest (ready+partial+gaps === total)
     • generator produces real, varied, deterministic exercises for all 10 topics
     • KB depth probe reads the REAL seeded KB (imported, not mirrored)
   Repo convention: esbuild the real source, import it, never a copy.

   Run: node tigamodel/scripts/smoke-capability.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-capability";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const FILES = [
  "tigamodel/teaching/capability-engine.js",
  "tigamodel/teaching/generator.js",
  "tigamodel/teaching/skill-graph.js",
  "tigamodel/knowledge/knowledge-base.js",
  "tigamodel/knowledge/university-seed.js",
  "tigamodel/knowledge/expansion-learner.js",
  "tigamodel/knowledge/expansion-stage.js",
  "tigamodel/knowledge/expansion-stage2.js",
];

fs.rmSync(OUT, { recursive: true, force: true });
execSync(`npx esbuild ${FILES.join(" ")} --bundle tigamodel/web.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js --log-level=error`, { stdio: "pipe", cwd: ROOT });
const mod = (f) => import(url.pathToFileURL(path.join(OUT, f)));

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

async function main() {
  console.log("tigamodel capability engine + generator smoke:");

  const web = await mod("web.js");
  web.ensureTigamodelWeb();
  const eng = web.getCapabilityEngine();

  check("engine walks all 1,000 routes", () => {
    const routes = eng.allRoutes();
    if (routes.length !== 1000) throw new Error(`got ${routes.length}`);
  });

  check("deterministic: same route → same score twice", () => {
    const a = eng.scoreRoute(3, 5, 5);
    const b = eng.scoreRoute(3, 5, 5);
    if (a.score !== b.score) throw new Error(`${a.score} vs ${b.score}`);
  });

  check("every route carries named capability parts", () => {
    for (const r of eng.allRoutes()) {
      if (!Object.keys(r.parts).length) throw new Error(`T${r.t}M${r.m}S${r.s} has no parts`);
      for (const v of Object.values(r.parts)) if (!(v >= 0 && v <= 1)) throw new Error(`part out of range: ${v}`);
      if (!(r.score >= 0 && r.score <= 1)) throw new Error(`score out of range: ${r.score}`);
    }
  });

  check("summary is honest: ready+partial+gaps === total", () => {
    const s = eng.summary();
    if (s.ready + s.partial + s.gaps !== s.total) throw new Error(`${s.ready}+${s.partial}+${s.gaps} != ${s.total}`);
    if (s.readyPct !== Math.round((s.ready / s.total) * 1000) / 10) throw new Error("pct math wrong");
  });

  check("100% READY verdict from the REAL KB (owner directive)", () => {
    const s = eng.summary();
    if (s.ready !== 1000 || s.readyPct !== 100) throw new Error(`ready=${s.ready} (${s.readyPct}%)`);
  });

  check("KB probe reads REAL seeded KB per topic (theory deep, performance ≥120)", () => {
    const th = eng.kbProbe(0), perf = eng.kbProbe(8);
    if (th.entries < 500) throw new Error(`theory entries: ${th.entries}`);
    if (perf.entries < 120) throw new Error(`performance entries: ${perf.entries}`);
    if (th.teach / th.entries < 0.7) throw new Error("theory teach coverage < 70%");
  });

  const gen = web; // generator surface verified through the REAL web bundle

  check("generator: all 10 topics produce real exercises at levels 1-5", () => {
    for (let t = 0; t < 10; t++) for (let lv = 1; lv <= 5; lv++) {
      const x = gen.generateStudentExercise(t, lv, 11);
      if (!x || !x.title || !x.task || !Array.isArray(x.steps) || x.steps.length < 2 || !x.check) {
        throw new Error(`bad exercise T${t} L${lv}`);
      }
    }
  });

  check("generator: deterministic per seed (consistency quality bar)", () => {
    const a = gen.generateStudentExercise(4, 2, 42);
    const b = gen.generateStudentExercise(4, 2, 42);
    if (a.task !== b.task) throw new Error("same seed gave different exercise");
  });

  check("generator: varies across seeds (student never gets identical sheet)", () => {
    const tasks = new Set();
    for (let s = 1; s <= 8; s++) tasks.add(gen.generateStudentExercise(1, 3, s).task);
    if (tasks.size < 2) throw new Error(`only ${tasks.size} variants in 8 seeds`);
  });

  check("generator: theory math is REAL (major-steps semitone offsets)", () => {
    const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    const MAJOR = [0, 2, 4, 5, 7, 9, 11];
    let checked = 0;
    for (let s = 1; s <= 10 && checked < 6; s++) {
      const x = gen.generateStudentExercise(0, 1, s);
      if (x.kind !== "theory-scale") continue;
      const notes = x.meta.notes.map(n => n.slice(0, -1)); // strip octave
      if (notes.length !== 7) throw new Error(`bad scale: ${notes.join("-")}`);
      const rootPc = PC[notes[0]];
      for (let i = 0; i < 7; i++) {
        const want = (rootPc + MAJOR[i]) % 12;
        if (PC[notes[i]] !== want) throw new Error(`degree ${i} of ${notes[0]} major: got ${notes[i]}, want pc ${want}`);
      }
      checked++;
    }
    if (checked < 3) throw new Error("not enough scale exercises seen");
  });

  check("web.js exports the production surface (exercise + sheet + engine)", () => {
    if (typeof web.generateStudentExercise !== "function") throw new Error("no export");
    if (typeof web.generateStudentSheet !== "function") throw new Error("no export");
    const sheet = web.generateStudentSheet(3, 3);
    if (!Array.isArray(sheet) || sheet.length !== 10) throw new Error("sheet must cover 10 topics");
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  fs.rmSync(OUT, { recursive: true, force: true });
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });
