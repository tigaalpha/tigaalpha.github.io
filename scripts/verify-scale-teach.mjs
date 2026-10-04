/* Verify the Scale facts this app TEACHES, by running the app's own code.
   Every check must exit non-zero on any wrong fact. No tolerances, no
   "close enough" — a note name is either spelled correctly or it is not. */
import { genNoteRoles, genScalePatterns, genKeyLadders } from "../tigamodel/knowledge/expansion-scale.js";
import { readFileSync } from "node:fs";

/* music-engine.tsx is TSX, which plain node cannot import. Reading the literal
   out of the source is honest here: the claim under test is about the numbers
   written in the file, not about transpiled behaviour. */
const scaleDefSrc = readFileSync(new URL("../music-engine.tsx", import.meta.url), "utf8");
const scaleDefBlock = scaleDefSrc.match(/export const SCALE_DEF = \{([\s\S]*?)\n\};/)[1];
const SCALE_DEF = {};
for (const m of scaleDefBlock.matchAll(/"?([a-zA-Z0-9 ]+)"?\s*:\s*\[([^\]]+)\]/g)) {
  SCALE_DEF[m[1].trim()] = m[2].split(",").map((s) => +s.trim());
}

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};

/* ── Reference: how a major scale MUST be spelled, in the app's own key names ──
   Key of X = X, X+2, X+4, X+5, X+7, X+9, X+11, with each step taking the
   NEAREST letter name. Gb is the only "sharp key" the app names, so it is the
   one place where naming the black keys as flats shows up. */
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/* the app prints accidentals as glyphs (F♯) and this oracle writes ASCII (F#);
   fold both to "letter + accidental count" before comparing */
const ACCV = { "#": 1, b: -1, "♯": 1, "♭": -1, "\u{1d12a}": 2, "\u{1d12b}": -2 };
const fold = (s) => {
  const t = String(s);
  let acc = 0;
  for (const ch of t.slice(1)) acc += ACCV[ch] || 0;
  return t[0].toUpperCase() + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc));
};
const pcOfName = (n) => {
  const f = fold(n);
  let v = LETTER_PC[f[0]];
  if (f.includes("#")) v += 1;
  if (f.includes("b")) v -= 1;
  return (v + 12) % 12;
};
/* the correct spelling of a scale degree: same letter as expected, right pc */
const correctMajor = (root) => {
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const rootPc = pcOfName(root);
  const startIdx = LETTERS.indexOf(root[0]);   /* parse the name, do not search by pc */
  return [0, 2, 4, 5, 7, 9, 11, 12].map((s, i) => {
    const letter = LETTERS[(startIdx + i) % 7];
    const wantPc = (rootPc + s) % 12;
    const base = LETTER_PC[letter];
    for (const alt of [-2, -1, 0, 1, 2]) if (((base + alt) % 12 + 12) % 12 === wantPc) return letter + (alt > 0 ? "#".repeat(alt) : "b".repeat(-alt));
    return letter + "?";
  });
};

console.log("=== 1. genKeyLadders: the scale notes each key is taught with ===");
const ladders = genKeyLadders();
const seen = new Map();
for (const e of ladders) {
  const key = e.title.match(/คีย์ (\S+)/)[1];
  if (seen.has(key)) continue;
  const m = e.body.split("(")[1].split(")")[0];
  seen.set(key, m.trim().replace(/…$/, "").split(" ").map((n) => fold(n.replace(/[0-9]+$/, ""))));
}
for (const [key, taught] of seen) {
  const correct = correctMajor(key);
  ok(`key ${key}: taught ${taught.join(" ")}`, taught.join(" ") === correct.join(" "),
     `correct spelling is ${correct.join(" ")}`);
}

console.log("\n=== 2. genScalePatterns: does each printed label name the degrees it emits? ===");
const pats = genScalePatterns();
const Cmajor = correctMajor("C");
/* Degree = letter position in the scale, PLUS an octave for anything above the
   tonic's octave (the 8th degree sits one octave up). Ignoring the octave made
     the oracle report the closing note as degree 1 — a bug in the CHECKER. */
const degOf = (n) => {
  const oct = +String(n).match(/(\d+)$/)[1];
  const i = Cmajor.findIndex((s) => fold(n.replace(/[0-9]/g, "")) === s);
  return i < 0 ? -1 : i + (oct - 4) * 7;
};
/* every pattern, for a key with no accidentals so degrees read off C major */
let labelBad = [];
for (const pid of ["thirds", "fourths", "step-back", "triads", "pairs"]) {
  const e = pats.find((x) => x.meta.pattern === pid && x.meta.key === "C");
  const label = e.body.match(/แบบ "([^"]*)"/)[1];
  const seq = e.body.match(/major แบบ "[^"]*": ([^·]*)·/)[1].trim().split(" ");
  const emitted = seq.map(degOf).map((d) => (d < 0 ? "?" : d + 1));
  /* the label lists distinct degrees with repeats collapsed; compare like for like */
  const collapse = (arr) => arr.filter((d, i) => i === 0 || d !== arr[i - 1]);
  /* the label must state the degrees it emits — a student drilling the
     printed figure must be drilling the figure the code plays */
  const claimed = (label.match(/\d+(-\d+)+/g) || []).pop();
  const agree = !claimed || claimed === collapse(emitted).join("-");
  console.log(`  ${pid.padEnd(9)} label "${label}"${claimed ? "" : " (no degree list)"}  →  emits ${emitted.join("-")}`);
  if (!agree) labelBad.push(`${pid}: label says ${claimed}, code emits ${emitted.join("-")}`);
}
ok("every scale-pattern label names the degrees it actually emits",
   labelBad.length === 0, labelBad.join("; "));

console.log("\n=== 3. SCALE_DEF (what the piano actually plays) vs the same patterns ===");
ok("melodic minor in SCALE_DEF is the ASCENDING form only (no descent)",
   SCALE_DEF["melodic minor"].join(",") === "0,2,3,5,7,9,11",
   "melodic minor descends as natural minor; a single step list cannot express both");

console.log("\n=== 4. genNoteRoles: coverage claim 'C3-B5, 36 notes' ===");
const roles = genNoteRoles();
const notes = [...new Set(roles.map((e) => e.meta.note))];
const oct5 = notes.filter((n) => n.endsWith("5")).sort();
console.log("        distinct notes generated: " + notes.length);
console.log("        octave-5 notes present: " + oct5.join(" "));
ok("note roles cover the C3-B5 range the source comment claims (36 notes)",
   notes.length === 36 && oct5.includes("B5"),
   `got ${notes.length} notes; the C-guard "SH.indexOf(pc) > 6" skips G,Ab,A,Bb,B at octave 5, so the top note is ${oct5[oct5.length - 1]} not B5`);

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);