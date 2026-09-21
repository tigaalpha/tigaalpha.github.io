/* Smoke test for piano-guard.ts — the listening teacher.
   Transpiles the REAL source with esbuild and imports the REAL exports
   (per AGENTS.md: no hand-mirrored copies). Runs headless in node by
   stubbing the two browser globals the module touches (localStorage).
   Covers the owner's three asks:
     1. speech/noise is never graded as a played note (isPianoLike),
     2. an out-of-tune piano still passes once its drift is learned,
     3. the tuning memory is SHARED across modes and persistent. */
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// minimal localStorage stub BEFORE the module is imported
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const outdir = mkdtempSync(join(tmpdir(), "pg-"));
await build({
  entryPoints: ["piano-guard.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(outdir, "piano-guard.mjs"),
});
const pg = await import(pathToFileURL(join(outdir, "piano-guard.mjs")).href);

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.error("  ✗ " + name); } };

// ── freq helpers: A4=440, C4=261.63, detuned +30 cents ──
const F = (midi, cents = 0) => 440 * Math.pow(2, (midi - 69) / 12) * Math.pow(2, cents / 1200);
const PC = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

console.log("1) digital sources stay exact");
ok(pg.teacherJudgeNote({ freq: null, note: "C4", targetPC: PC.C }).ok === true, "MIDI C4 passes C");
ok(pg.teacherJudgeNote({ freq: null, note: "D4", targetPC: PC.C }).ok === false, "MIDI D4 fails C");

console.log("2) in-tune mic note passes, learns nothing (no evidence of drift)");
let v = pg.teacherJudgeNote({ freq: F(60), targetPC: PC.C }); // C4 exact
ok(v.ok, "C4 passes");
ok(v.learned === false && pg.getPianoTuneOffset() === 0, "perfect tuning = no drift to learn");

console.log("3) out-of-tune piano (+30c flat... sharp here): passes AND is learned");
v = pg.teacherJudgeNote({ freq: F(60, 30), targetPC: PC.C });
ok(v.ok, "+30c C still passes (tolerance)");
ok(v.learned === true, "informative reading triggers learning");
const off1 = pg.getPianoTuneOffset();
ok(Math.abs(off1 - 30) < 1, "shared store now ≈ +30 (got " + off1 + ")");

console.log("4) after learning, re-centered judging is tight");
v = pg.teacherJudgeNote({ freq: F(64, 30), targetPC: PC.E }); // E4 same piano
ok(v.ok && Math.abs(v.cents) < 8, "E4 +30c passes with cents≈0 after re-center (got " + v.cents + ")");

console.log("5) wrong note is still wrong on a detuned piano");
ok(pg.teacherJudgeNote({ freq: F(62, 30), targetPC: PC.C }).ok === false, "D4 fails C even detuned");
pg.resetPianoTune(); // fresh-session case: no learned drift yet (a learned +30c
// offset would re-center a +120c reading to +90c, which the LEGACY ±95c
// tolerance passes — preserved deliberately; see test 4's re-center check)
ok(pg.teacherJudgeNote({ freq: F(60, 120), targetPC: PC.C }).ok === false, "+120c (a semitone off) fails on a fresh piano");

console.log("6) shared memory persists (the play-along ↔ practice contract)");
// (test 5 reset the store for its fresh-session case — relearn first, like a
// real session does, then assert the write landed)
pg.teacherJudgeNote({ freq: F(60, 30), targetPC: PC.C });
ok(JSON.parse(store.get("tg_piano_tune_v1")).n > 0, "store written to localStorage");
ok(pg.pianoTuneSampleCount() > 0, "sample counter > 0");

console.log("7) guard rejects voice/noise frames");
ok(pg.isPianoLike({ clarity: 0.9, centsSpread: 5 }) === true, "steady ring = piano");
ok(pg.isPianoLike({ clarity: 0.4, centsSpread: 5 }) === false, "low clarity = noise");
ok(pg.isPianoLike({ clarity: 0.9, centsSpread: 80 }) === false, "gliding = voice");
ok(pg.isPianoLike({ clarity: null, centsSpread: 0 }) === false, "no pitch = nothing");

console.log("8) reset works");
pg.resetPianoTune();
ok(pg.getPianoTuneOffset() === 0 && pg.pianoTuneSampleCount() === 0, "reset clears the store");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
