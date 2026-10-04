/* Every INTERVAL this app teaches, by name — checked against an independent
   oracle.

   An interval has TWO independent facts: the NUMBER (how many letter names the
   span covers: C→E is a 3rd) and the QUALITY (how many semitones: C→E is 4).
   A generator that walks only a chroma table gets the semitones right and the
   letter wrong, producing entries like "major 2nd down from D♭ = B" — B♭ is the
   major 2nd; D♭→B spelled out is a minor 7th.

   The oracle below derives the letter the interval MUST use (including
   augmented/diminished cases), then checks the app agrees.
   Run: node scripts/verify-scale-interval-names.mjs */
import { genEarMatrix } from "../tigamodel/knowledge/expansion-final.js";
import { genIntervalInChord } from "../tigamodel/knowledge/expansion-scale.js";

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("PASS  " + name);
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCV = { "#": 1, b: -1, "♯": 1, "♭": -1, "\u{1d12a}": 2, "\u{1d12b}": -2 };
const parse = (s) => { let acc = 0; for (const ch of String(s).slice(1)) acc += ACCV[ch] || 0; return { letter: String(s)[0].toUpperCase(), acc }; };
/* the app prints glyphs (D♭) and this oracle emits ASCII (Db); compare the
   folded "letter + accidental count" form, never the raw strings */
const fold = (s) => { const { letter, acc } = parse(s); return letter + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc)); };
const pcOf = (s) => { const { letter, acc } = parse(s); return ((LETTER_PC[letter] + acc) % 12 + 12) % 12; };
const spell = (letter, acc) => fold(letter + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc)));

/* Which interval NUMBERS can carry a given semitone count. An augmented 4th and
   a diminished 5th are both 6 semitones, so several numbers are legal — the
   generator may pick either. What it may NEVER do is pick a number that
   cannot carry that many semitones. */
const NUMBERS_FOR_SEMITONES = {
  0: [1, 8],   // unison / octave
  1: [1, 2],   // augmented unison / minor 2nd
  2: [1, 2],   // doubly-augmented 2nd / major 2nd
  3: [2, 3],   // augmented 2nd / minor 3rd
  4: [3],      // major 3rd
  5: [3, 4],   // augmented 3rd / perfect 4th
  6: [4, 5],   // augmented 4th / diminished 5th (the tritone)
  7: [5],      // perfect 5th
  8: [5, 6],   // diminished 6th / minor 6th
  9: [6],      // major 6th
  10: [6, 7],  // augmented 6th / minor 7th
  11: [7],     // major 7th
  12: [8],     // octave
};

/* The spelling an interval of `semitones` MUST have, given the root's letter.
   Walking up `number-1` letters from the tonic and asking what accidental
   lands on the target pitch is exactly what a teacher does. */
const spellInterval = (rootName, semitones, dir) => {
  const { letter, acc } = parse(rootName);
  const rootPc = pcOf(rootName);
  const nums = NUMBERS_FOR_SEMITONES[semitones];
  /* the generator is free to choose any legal number, so return the set of
     legal spellings — a taught name is correct if it matches ANY of them */
  return nums.map((n) => {
    const steps = dir === "up" ? n - 1 : -(n - 1);
    const target = LETTERS[(((LETTERS.indexOf(letter) + steps) % 7) + 7) % 7];
    const want = dir === "up" ? (rootPc + semitones) % 12 : (rootPc - semitones + 12) % 12;
    let a = want - LETTER_PC[target];
    if (a > 6) a -= 12;
    if (a < -6) a += 12;
    return spell(target, a);
  });
};

console.log("=== 1. genEarMatrix: every interval the app teaches, 12 roots x 12 sizes x 2 directions ===");
const conflicts = new Map();
for (const e of genEarMatrix()) {
  const { root, semitones: s, dir, target } = e.meta;
  const legal = spellInterval(root, s, dir);
  const key = `${root}|${s}|${dir}`;
  if (conflicts.has(key)) continue;
  if (legal.map(fold).indexOf(fold(target)) < 0) {
    const taught = e.title.match(/ฟัง: \S+ → \S+ \(([^,]+),/)[1];
    conflicts.set(key, `ฟัง: ${root} → ${target} (${taught}, ${dir})  ·  correct spelling: ${legal.join(" or ")}`);
  }
}
const list = [...conflicts.values()];
console.log(list.length ? "  " + list.slice(0, 12).join("\n  ") + (list.length > 12 ? `\n  … ${list.length} distinct wrong entries` : "") : "  (none)");
ok("every interval note name is a legal spelling for that interval size",
   conflicts.size === 0,
   `${conflicts.size} of 288 entries name an interval and then spell it as a different interval. Example: "major 2nd down from D♭ = B" — the major 2nd below D♭ is B♭; D♭→B is a minor 7th, so the ear drill teaches the wrong pair.`);

console.log("\n=== 2. genIntervalInChord: the interval named inside each chord ===");
const chordBad = [];
for (const e of genIntervalInChord()) {
  const m = e.meta;
  const spelled = e.body.match(/คอร์ด ([^—]+) —/);
  const target = e.title.match(/โน้ต (\S+) คือ/);
  if (!spelled || !target) continue;
  const rootName = spelled[1].trim().split("-")[0];
  const semis = (pcOf(target[1]) - pcOf(rootName) + 12) % 12;
  const legal = spellInterval(rootName, semis, "up");
  if (legal.map(fold).indexOf(fold(target[1])) < 0) chordBad.push(`${rootName} → ${target[1]} = ${semis} semitones, but the letters must spell ${legal.join(" or ")}`);
}
console.log(chordBad.length ? "  " + [...new Set(chordBad)].slice(0, 8).join("\n  ") : "  (none)");
ok("every 'interval inside a chord' entry spells its chord tone correctly",
   chordBad.length === 0, [...new Set(chordBad)].slice(0, 4).join("; "));

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);