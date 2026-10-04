/* Scale facts the app PRINTS to the student, checked against the textbook
   spelling. This is the layer the owner sees: the Pathway "Scale" lesson and
   the scale drill the piano plays.
   Run: sh scripts/verify-scale-spelling.mjs
   music-engine.tsx is TSX, so the shell wrapper bundles it with the project's
   own esbuild into .smoke-me.mjs (deleted on exit) and node imports that. */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const BUNDLE = new URL("../.smoke-me.mjs", import.meta.url).pathname;
rmSync(BUNDLE, { force: true });
execFileSync("./node_modules/.bin/esbuild", ["music-engine.tsx", "--bundle", "--format=esm",
  "--platform=node", "--outfile=" + BUNDLE, "--external:react", "--external:react-dom", "--log-level=error"],
  { cwd: new URL("..", import.meta.url).pathname, stdio: "inherit" });
process.on("exit", () => rmSync(BUNDLE, { force: true }));

const { spellScale, SCALE_TYPES, KEYS_12, CHROMA, scaleNotesOf, MINOR_SCALE_SONGS, MAJOR_SCALE_SONGS } = await import(BUNDLE);

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("PASS  " + name);
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};/* Fold any accidental spelling — ASCII (# b) and glyph (♯ ♭ 𝄪 𝄫) — into one
   canonical "Letter+accidental-count" form. Glyphs are matched BY CODE POINT
   (they live in the SMP and are trivially swapped or mistyped as literals);
   ♯=0x266F ♭=0x266D 𝄪=0x1D12A double-sharp 𝄫=0x1D12B double-flat. */
/* NB \u takes exactly FOUR hex digits: "\u1d12a" silently parses as \u1d12 + "a".
   Anything outside the BMP needs the brace form \u{1d12a}. */
const ACC = { "#": 1, b: -1, "\u266f": 1, "\u266d": -1, "\u{1d12a}": 2, "\u{1d12b}": -2 };
const parse = (s) => {
  const t = String(s);
  let acc = 0;
  for (const ch of t.slice(1)) {
    const v = ACC[ch];
    if (v == null) throw new Error("unrecognised accidental in " + JSON.stringify(s));
    acc += v;
  }
  return { letter: t[0].toUpperCase(), acc };
};
const norm = (s) => { const { letter, acc } = parse(s); return letter + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc)); };
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (n) => { const { letter, acc } = parse(n); return ((LETTER_PC[letter] + acc) % 12 + 12) % 12; };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
/* independent oracle: spell a scale by walking letters from the tonic */
const oracle = (tonicId, semis) => {
  const t = norm(tonicId);
  const li0 = LETTERS.indexOf(t[0].toUpperCase());
  const rootPc = pcOf(t);
  return semis.map((s, i) => {
    const letter = LETTERS[(li0 + i) % 7];
    const want = (rootPc + s) % 12;
    for (const a of [-2, -1, 0, 1, 2]) {
      if ((((LETTER_PC[letter] + a) % 12) + 12) % 12 === want) return norm(letter + (a > 0 ? "#".repeat(a) : "b".repeat(-a)));
    }
    /* a degree with no spelling within a double accidental is itself a bug */
    return letter + "?";
  });
};

/* D♭/A♭ minor are conventionally WRITTEN as C♯/G♯ minor (the app respells
   them deliberately — see MINOR_TONIC_RESPELL in music-engine.tsx). The oracle
   has to apply the same convention or it will "fail" correct output. */
const RESPELL = { Db: "C#", Ab: "G#" };

console.log("=== A. spellScale: what the Pathway lesson PRINTS, 12 keys x 4 types ===");
let wrong = [];
for (const k of KEYS_12) {
  for (const [t, def] of Object.entries(SCALE_TYPES)) {
    const minor = t !== "major";
    const shown = spellScale(k.id, def.up, { minor }).map(norm);
    const want = oracle(minor ? (RESPELL[k.id] || k.id) : k.id, def.up);
    if (shown.join(" ") !== want.join(" ")) wrong.push(`${k.id} ${t}\n          shown ${shown.join(" ")}\n          right ${want.join(" ")}`);
  }
}
ok(`all 48 printed major/minor scales are spelled correctly (${KEYS_12.length * 4} cases)`,
   wrong.length === 0, wrong.join("\n        "));

console.log("\n=== B. melodic minor descent is printed as natural minor ===");
const kAb = KEYS_12.find((k) => k.id === "Ab");
const mel = spellScale(kAb.id, SCALE_TYPES.melodic_minor.up, { minor: true }).map(norm)
  .concat(spellScale(kAb.id, SCALE_TYPES.melodic_minor.down, { minor: true }).slice(1).map(norm));
/* The printed descent is degrees 7..1 inclusive (down[] carries the octave,
   and the code drops the shared top note with slice(1)). */
const nat = oracle(RESPELL.Ab, [0, 2, 3, 5, 7, 8, 10]);   // degrees 1..7
const natDescent = nat.slice().reverse();                 // degrees 7..1
ok("A♭ melodic minor descent equals A♭ natural minor",
   mel.slice(8).join(" ") === natDescent.join(" "),
   `descent shown: ${mel.slice(8).join(" ")} vs natural-minor descent ${natDescent.join(" ")}`);

console.log("\n=== C. scaleNotesOf (what the piano PLAYS) vs spellScale (what it PRINTS) ===");
/* note names carry an octave ("C4", "Bb5"); strip it before reading the pitch */
const pcOfName = (n) => pcOf(String(n).replace(/[0-9]+$/, ""));
let playWrong = [];
for (const k of KEYS_12) {
  /* the printed list ends on the octave; scaleNotesOf has no octave, so
     compare the seven degrees and check the octave repeats the tonic. */
  const printed = spellScale(k.id, SCALE_TYPES.major.up, { minor: false }).map(norm);
  const played = scaleNotesOf(CHROMA[pcOf(norm(k.id))], "major").map((pc) => pcOfName(pc));
  if (printed.length !== 8 || pcOf(printed[7]) !== pcOf(printed[0]) ||
      printed.slice(0, 7).map(pcOfName).join(",") !== played.join(",")) {
    playWrong.push(`${k.id}: printed ${printed.join(" ")} vs played pcs ${played.join(",")}`);
  }
}
ok("printed and played pitch classes agree in all 12 keys", playWrong.length === 0, playWrong.join("\n        "));

console.log("\n=== D. minor-form pitches match what the app claims in prose ===");
ok("natural minor has no raised degree", SCALE_TYPES.natural_minor.up.join(",") === "0,2,3,5,7,8,10,12");
ok("harmonic minor raises ONLY the 7th", SCALE_TYPES.harmonic_minor.up.join(",") === "0,2,3,5,7,8,11,12");
ok("melodic minor raises the 6th and 7th going up", SCALE_TYPES.melodic_minor.up.join(",") === "0,2,3,5,7,9,11,12");

console.log("\n=== E. the drill the piano actually plays: does it descend like melodic minor claims? ===");
const melSong = MINOR_SCALE_SONGS["melodic minor"].find((s) => s.id === "sc_melodicminor_C");
const notes = melSong.seq.map(([n]) => n);
const upOnly = notes.slice(0, 8);
ok("melodic-minor drill ASCENDS with the raised 6th and 7th",
   upOnly.map(pcOfName).join(",") === "0,2,3,5,7,9,11,0",
   `ascending notes: ${upOnly.join(" ")}`);
/* The symmetric scales must still come back down exactly as they went up —
   only melodic minor differs. The run is asc(7) + octave + descent(6), so the
   descent is degrees 7..2, i.e. the ascent with its tonic and octave dropped. */
ok("the other three scale types are unchanged (up, octave, back down to the tonic)",
   ["major", "natural minor", "harmonic minor"].every((t) => {
     const song = (t === "major" ? MAJOR_SCALE_SONGS : MINOR_SCALE_SONGS[t]).find((s) => s.id.endsWith("_C"));
     const ns = song.seq.map(([n]) => pcOfName(n));
     /* 14 notes: 7 up, the octave, 6 back down to the tonic */
     return ns.length === 15 && ns[0] === ns[14] &&
       ns.slice(1, 7).join() === ns.slice(8, 14).reverse().join();
   }));
const descent = notes.slice(8);
/* the run is asc(7) + octave + descent(7), so the descent is degrees 7..1 */
ok("melodic-minor drill DESCENDS as natural minor (what the lesson text promises in th/en/zh)",
   descent.map(pcOfName).join(",") === "10,8,7,5,3,2,0",
   `descent notes: ${descent.join(" ")} = pcs ${descent.map(pcOfName)} — the lesson text says the descent reverts to natural minor (♭6 ♭7), so the piano is contradicting the text it teaches`);
/* an octave number of 0 or below cannot be played: this is what caught the
   first attempt at the descent, whose register walk ran away to B-1 */
ok("every scale drill stays in a playable register (octaves 3-5)",
   [...MAJOR_SCALE_SONGS, ...Object.values(MINOR_SCALE_SONGS).flat()]
     .every((s) => s.seq.every(([n]) => n !== "R" && +n.match(/\d+$/)[0] >= 3 && +n.match(/\d+$/)[0] <= 5)),
   "a note name with octave 0 or below cannot be played");

console.log("\n=== F. key-signature claim: 'the 12 minors differ from major only in degrees 6-7' ===");
const deg = (pc, root) => (((pc - root) % 12) + 12) % 12;
/* Natural minor = major with degrees 3, 6 and 7 each lowered a semitone. The
   lesson text says all three minors "share degrees 1-5" — verify that too. */
const NAT = SCALE_TYPES.natural_minor.up;
const MAJ = SCALE_TYPES.major.up;
ok("natural minor = major with ♭3 ♭6 ♭7",
   NAT[2] === MAJ[2] - 1 && NAT[5] === MAJ[5] - 1 && NAT[6] === MAJ[6] - 1,
   `minor [${NAT}] vs major [${MAJ}]`);
ok("the three minors share degrees 1-5 (as the lesson text promises)",
   ["harmonic_minor", "melodic_minor"].every((t) =>
     SCALE_TYPES[t].up.slice(0, 5).join(",") === NAT.slice(0, 5).join(",")));

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);