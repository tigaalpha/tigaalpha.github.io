// Smoke test: import the REAL practice-spot.ts source (esbuild-transformed)
// and assert every plan §5.2 case that can be proven without React/DOM.
// Pattern: tigamodel/scripts/smoke-jev-tasks.mjs (AGENTS.md "transpile the
// real source and import it" verification guidance).
// Covers S1-S8 (buildSpotTarget) + S9-S10 (scoreRhythmMode).
// S11 (Jev task #13) lands with C1 — see plan §5.2 table.
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const src = readFileSync("practice-spot.ts", "utf8");
const js = transformSync(src, { loader: "ts", format: "esm", target: "esnext" }).code;
const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const { buildSpotTarget, scoreRhythmMode, SPOT_CAP_NOTES, SPOT_CAP_CHORDS } = mod;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.error("  ✗ " + name + (extra ? " — " + JSON.stringify(extra) : "")); }
}

// note helper: accept either bare strings or {note} objects (both shapes exist)
const N = x => (typeof x === "string" ? x : x && x.note);
const names = arr => (arr || []).map(N);

console.log("S1 seq — cut missed indexes in song order");
{
  const target = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];
  const r = buildSpotTarget({ target, mode: "seq", wrongByIdx: { 3: 2, 7: 1 }, label: "สเกล C", bpm: 72, key: "c scale" });
  check("two notes kept", r && r.notes.length === 2, r);
  check("song order (F4, C5)", names(r.notes).join(",") === "F4,C5", names(r.notes));
  check("mode seq", r.mode === "seq");
  check("noExpand set", r.noExpand === true);
  check("label suffixed", r.label === "สเกล C · จุดพลาด");
  check("bpm carried (T6)", r.bpm === 72);
  check("key carried", r.key === "c scale");
}

console.log("S2 scale — no double expansion (T2)");
{
  // ascending source 8 notes; startPractice would expand to 15. Misses are
  // recorded against the EXPANDED target — idx 1 = D4 (asc), idx 10 = G4 (the
  // descending leg: indices 8..14 are B4 A4 G4 F4 E4 D4 C4's reverse at
  // 8..14 = B4,A4,G4,F4,E4,D4,C4 → idx 10 = G4). Both re-anchor onto the
  // ascending source by name.
  const asc = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
  const target = asc.concat(asc.slice(0, -1).reverse()); // 15
  const r = buildSpotTarget({ target, ascNotes: asc, mode: "scale", wrongByIdx: { 1: 1, 10: 2 }, label: "สเกล C" });
  check("cut maps onto ascending only", r && r.notes.length === 2, r && names(r.notes));
  check("names D4 + G4", names(r.notes).join(",") === "D4,G4", names(r.notes));
  check("emitted as seq (startPractice can't re-expand)", r.mode === "seq");
  check("no chord window", r.chordGroupSize === 0 && r.chordSizes == null);
}

console.log("S3 chord/block — whole-chord cut (T4)");
{
  const target = ["C4", "E4", "G4", "F4", "A4", "C5", "G4", "B4", "D5", "C5", "E5", "G5"];
  const r = buildSpotTarget({ target, mode: "chord", chordGroupSize: 3, wrongByIdx: { 3: 1, 5: 2 }, label: "คอร์ด" });
  check("whole chord 2 kept (3 notes)", r && r.notes.length === 3, r && names(r.notes));
  check("chord notes correct", names(r.notes).join(",") === "F4,A4,C5", names(r.notes));
  check("uniform gs re-derived = 3", r.chordGroupSize === 3);
  check("chordSizes null on uniform", r.chordSizes == null);
  check("mode stays chord", r.mode === "chord");
}

console.log("S3b prog mixed sizes — per-chord sizes kept");
{
  const sizes = [3, 3, 4, 3];
  const target = ["C4", "E4", "G4", "F4", "A4", "C5", "G4", "B4", "D5", "F5", "C5", "E5", "G5"];
  const r = buildSpotTarget({ target, mode: "prog", chordSizes: sizes, wrongByIdx: { 8: 3, 11: 1 }, label: "prog" });
  // chord 3 = bounds [6,10) size 4 (chordSizes[2]), chord 4 = [10,13) size 3 —
  // kept in song order, so sizes read [4,3]
  check("both chords kept", r && r.notes.length === 7, r && names(r.notes));
  check("non-uniform → gs 0 + sizes", r.chordGroupSize === 0 && Array.isArray(r.chordSizes) && r.chordSizes.join(",") === "4,3", r);
}

console.log("S4 cap — worst-first within cap, song order restored");
{
  const target = Array.from({ length: 20 }, (_, i) => "C" + (4 + Math.floor(i / 12)));
  const wrong = {};
  for (let i = 0; i < 20; i++) wrong[i] = 20 - i; // idx 0 worst
  const r = buildSpotTarget({ target, mode: "seq", wrongByIdx: wrong, label: "cap" });
  check("≤ 12 notes", r && r.notes.length === SPOT_CAP_NOTES, r && r.notes.length);
  check("kept worst-first set, restored to song order", r && names(r.notes)[0] === "C4" && r.notes.length === 12);
  const chordT = Array.from({ length: 21 }, (_, i) => "C" + (4 + Math.floor(i / 12)));
  const rc = buildSpotTarget({ target: chordT, mode: "chord", chordGroupSize: 3, wrongByIdx: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 1])), label: "capc" });
  check("chord cap 4", rc && rc.notes.length === SPOT_CAP_CHORDS * 3, rc && rc.notes.length);
}

console.log("S5 nothing missed — null (button hidden)");
{
  const r = buildSpotTarget({ target: ["C4", "D4"], mode: "seq", wrongByIdx: {}, label: "x" });
  check("null", r === null);
  const r2 = buildSpotTarget({ target: ["C4", "D4"], mode: "seq", label: "x" });
  check("null without data", r2 === null);
}

console.log("S6 fallback pitch-classes (no per-index data)");
{
  const target = ["C4", "D4", "E4", "F4", "G4", "A4"];
  const r = buildSpotTarget({ target, mode: "seq", fallbackPcs: ["F#", "F#"], label: "fb" });
  check("empty when pc not in target", r === null, r);
  const target2 = ["C4", "D4", "E4", "F#4", "G4", "A4"];
  const r2 = buildSpotTarget({ target: target2, mode: "seq", fallbackPcs: ["F#"], label: "fb" });
  check("picked the F#4", r2 && names(r2.notes).join(",") === "F#4", r2 && names(r2.notes));
}

console.log("S7 progression identifiers stripped (T3)");
{
  const r = buildSpotTarget({ target: ["C4", "D4", "E4"], mode: "seq", wrongByIdx: { 0: 1 }, label: "s" });
  check("no stageId field", r && !("stageId" in r));
  check("no bossGroup field", r && !("bossGroup" in r));
}

console.log("S8 malformed inputs — null, never throw");
{
  check("empty target", buildSpotTarget({ target: [], mode: "seq", wrongByIdx: { 0: 1 } }) === null);
  check("no args", buildSpotTarget() === null);
  check("out-of-range idx clamped/ignored", (() => { const r = buildSpotTarget({ target: ["C4"], mode: "seq", wrongByIdx: { 9: 3 } }); return r === null; })());
}

console.log("S9 rhythm regression — evenness unchanged");
{
  // identical inputs to the original scoreRhythm: expect identical outputs
  const t = [0, 500, 1000, 1500, 2000, 2500, 3000];
  const r = scoreRhythmMode(t, null);
  check("even spacing all ok", r && r.ok === 6 && r.miss === 0, r);
  const t2 = [0, 500, 1010, 2200, 2300, 2400, 3600];
  // IOIs [500,510,1190,100,100,1200], mean 600, ±35% = ±210 → ok: 500,510 only
  // (100ms gaps are 500ms from the mean — the metric measures DISTANCE from
  // average, so very-short gaps miss too; verified against the original
  // scoreRhythm() formula in use-practice-mode.ts lines 56-71, in-code)
  const r2 = scoreRhythmMode(t2, null);
  check("irregular spaced count (matches original formula exactly)", r2 && r2.ok === 2 && r2.miss === 4, r2);
  check("short array null", scoreRhythmMode([0, 100, 200], null) === null);
}

console.log("S10 rhythm beat mode ±20%");
{
  const beat = 500;
  const t = [0, 500, 1000, 1500, 2000, 2500, 3000];   // all on beat
  const r = scoreRhythmMode(t, beat);
  check("on-beat all ok", r && r.ok === 6 && r.miss === 0, r);
  const t2 = [0, 500, 1400, 1900, 2400, 2900, 3400]; // gaps 500,900,500...
  const r2 = scoreRhythmMode(t2, beat);
  check("off-beat counted", r2 && r2.ok === 5 && r2.miss === 1, r2);
  const t3 = [0, 600, 1200, 1800, 2400, 3000, 3600]; // +20% exactly = boundary ok
  const r3 = scoreRhythmMode(t3, beat);
  check("boundary ±20% inclusive", r3 && r3.ok === 6, r3);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) { console.error("SMOKE FAILED"); process.exit(1); }
console.log("SMOKE OK");
