/* Does every note a lesson or a drill can put on the piano actually LAND on a
   key and SOUND?

   The orange light on a key is `.pk.lit` in app-styles.ts; it is applied by
   <Piano> when `litNote === k.n || litSet.includes(k.n)` (music-engine.tsx),
   and k.n comes from the sharps-only KEYS / keysFor() tables. The synth is the
   same story: playPianoNote() looks the name up in NF, which is built from
   _PCN — sharps only. So one flat that escapes into a note name is a note that
   is simultaneously INVISIBLE and SILENT, and no amount of CSS fixes it.

   This is the checker for that whole boundary: PATHWAY stage x type option x
   all 12 keys, the Play-Along scale drills x all three hand modes, and the
   chat path's scale table — every note put through the app's own functions and
   then asked the two questions that matter (is there a frequency? is there a
   key?). Plus the textbook pitch content, checked semitone by semitone against
   an oracle written here rather than imported from the app.

   Run: sh scripts/verify-scale-lights.mjs */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const BUNDLE = ROOT + ".smoke-lights.mjs";
rmSync(BUNDLE, { force: true });
execFileSync(ROOT + "node_modules/.bin/esbuild", ["scripts/_lights-entry.mjs", "--bundle", "--format=esm",
  "--platform=node", "--outfile=" + BUNDLE, "--external:react", "--external:react-dom", "--log-level=error"],
  { cwd: ROOT, stdio: "inherit" });
process.on("exit", () => rmSync(BUNDLE, { force: true }));

const M = await import(BUNDLE);
const { PATHWAY, KEYS_12, transposeNotes, semisFromC, NF, noteToMidi, KEYS, keysFor,
  MAJOR_SCALE_SONGS, MINOR_SCALE_SONGS, expandSong, gpKeyBox, extractNotes } = M;

/* ── the three sharps-only tables the piano and the synth are built from ── */
const pianoKeys = (baseOct) => (baseOct === 4 ? KEYS : keysFor(baseOct)).map((k) => k.n);
const canLight = (n, baseOct) => pianoKeys(baseOct).includes(n);
const canSound = (n) => NF[n] != null && noteToMidi(n) > 0;
/* pitch class of a sharps-only name, from the octave-independent table */
const pc = (n) => CHROMA.indexOf(String(n).replace(/-?\d+$/, ""));
const CHROMA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("PASS  " + name);
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};
const list = (arr) => arr.join(" ");

/* ── oracle: the textbook scale, as semitones above the tonic ── */
const TEXTBOOK = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],   // ASCENDING form; the descent reverts
};

/* D♭ and A♭ minor are conventionally written as C♯ and G♯ minor, and the app
   respells them on purpose (see MINOR_TONIC_RESPELL). The oracle follows the
   same convention or it would "fail" correct output. */
const KEY_PC = { C: 0, G: 7, D: 2, A: 9, E: 4, B: 11, "F#": 6, Cb: 11, "C#": 1, Db: 1,
  "G#": 8, Ab: 8, "D#": 3, Eb: 3, "A#": 10, Bb: 10, F: 5 };

console.log("=== A. transposeNotes' contract: sharps out, always ===");
{
  const cases = [
    [["C4", "D4", "E4"], 0, ["C4", "D4", "E4"]],
    [["C4", "D4", "Eb4", "F4", "G4", "Ab4", "Bb4", "C5"], 0, ["C4", "D4", "D#4", "F4", "G4", "G#4", "A#4", "C5"]],
    [["C4", "Eb4", "Ab4", "Bb4"], 2, ["D4", "F4", "A#4", "C5"]],
    [["Eb4", "Ab4", "Bb4"], 11, ["D5", "G5", "A5"]],
    [["B♭4", "E♭4"], 0, ["A#4", "D#4"]],            // glyph accidentals
    [["Db4", "Gb4", "Cb4", "Fb4"], 0, ["C#4", "F#4", "B4", "E4"]],
    [["C4", "R", "D4"], 0, ["C4", "R", "D4"]],      // rests survive untouched
    [["C4"], 0, ["C4"]],
    [["Bb4", "Ab4", "G4", "F4", "Eb4", "D4", "C4"], 0, ["A#4", "G#4", "G4", "F4", "D#4", "D4", "C4"]],
  ];
  const wrong = cases.filter(([inp, s, want]) => list(transposeNotes(inp, s)) !== list(want))
    .map(([inp, s, want]) => `in ${list(inp)} +${s} -> ${list(transposeNotes(inp, s))}, want ${list(want)}`);
  ok("transposeNotes returns sharps-only names with the right pitch and octave (9 cases)",
     wrong.length === 0, wrong.join("\n        "));
  ok("transposeNotes(0) still normalises — the short-circuit that skipped it is gone",
     list(transposeNotes(["Eb4", "Ab4", "Bb4"], 0)) === "D#4 G#4 A#4",
     `got ${list(transposeNotes(["Eb4", "Ab4", "Bb4"], 0))}`);
  ok("transposeNotes passes a rest through",
     transposeNotes(["C4", "R", "Eb4"], 0)[1] === "R");
}

console.log("\n=== B. THE REPORTED BUG: C natural minor's black keys (E♭ A♭ B♭) ===");
{
  const scaleStage = PATHWAY.find((s) => s.id === "scale");
  const byId = Object.fromEntries(scaleStage.types.map((t) => [t.id, t]));
  const nat = transposeNotes(byId.natural_minor.demo, semisFromC("C"));
  ok("C natural minor plays D#4 G#4 A#4 (E♭ A♭ B♭) — the three black keys that stayed dark",
     list(nat) === "C4 D4 D#4 F4 G4 G#4 A#4 C5", `got ${list(nat)}`);
  ok("all eight of C natural minor's notes both sound and light a key",
     nat.every((n) => canSound(n) && canLight(n, 4)),
     nat.filter((n) => !canSound(n) || !canLight(n, 4)).join(" "));
  /* the three notes the owner named, checked one by one */
  const want = ["D#4", "G#4", "A#4"];
  ok("each of E♭ A♭ B♭ maps to exactly one lit black key", want.every((n) => canLight(n, 4) && canSound(n)),
     want.filter((n) => !canLight(n, 4)).join(" "));
  ok("they are black keys, not white ones",
     ["D#4", "G#4", "A#4"].every((n) => KEYS.some((k) => k.n === n && k.t === "b")));
  /* and the lesson text still PRINTS the flats — print and playback are separate layers */
  ok("the lesson text keeps the correct spelling (this function only touches playback)",
     list(byId.natural_minor.demo).includes("Eb4") && list(byId.natural_minor.demo).includes("Ab4")
     && list(byId.natural_minor.demo).includes("Bb4"), list(byId.natural_minor.demo));
}

console.log("\n=== C. every scale lesson, 12 keys x 4 types, on every piano octave ===");
{
  const scaleStage = PATHWAY.find((s) => s.id === "scale");
  const dead = [], dark = [];
  let n = 0;
  for (const key of KEYS_12) {
    const semis = semisFromC(key.id);
    for (const type of scaleStage.types) {
      const notes = transposeNotes(type.demo, semis);
      n++;
      /* the desktop lesson keyboard is C4..B5; a 2-octave keyboard can be
         parked at 3, 4 or 5, so a note counts as reachable if ANY of them shows it */
      for (const note of notes) {
        if (!canSound(note)) dead.push(`${key.id} ${type.id}: "${note}" is silent`);
        if (![3, 4, 5].some((b) => canLight(note, b))) dark.push(`${key.id} ${type.id}: "${note}" lights nowhere`);
      }
      /* pitch content, against the textbook semitones */
      const rootPc = KEY_PC[key.id];
      if (rootPc == null) { console.log("  (no oracle pc for key " + key.id + ")"); continue; }
      const up = notes.slice(0, 8).map((x) => ((pc(x) - rootPc) % 12 + 12) % 12);
      const want = TEXTBOOK[type.scaleType];
      /* the demo carries the octave as its 8th note, so degrees 1-7 are the
         first seven and the 8th must be the tonic again */
      if (list(up.slice(0, 7)) !== list(want) || up[7] !== 0) {
        dead.push(`${key.id} ${type.id}: degrees ${list(up)}, want ${list(want)} 0`);
      }
    }
  }
  ok(`all ${n} scale lessons play textbook pitches in all 12 keys`, dead.length === 0,
     [...new Set(dead)].join("\n        "));
  ok(`all ${n} scale lessons put every note on a visible key`, dark.length === 0,
     [...new Set(dark)].join("\n        "));
}

console.log("\n=== D. melodic minor's descent (the printed lesson says natural minor) ===");
{
  const scaleStage = PATHWAY.find((s) => s.id === "scale");
  const mel = scaleStage.types.find((t) => t.id === "melodic_minor");
  for (const key of ["C", "G", "F", "D#"]) {
    const semis = semisFromC(key);
    const notes = transposeNotes(mel.demo, semis);
    const rootPc = KEY_PC[key];
    const deg = notes.slice(8).map((x) => ((pc(x) - rootPc) % 12 + 12) % 12);
    const want = [10, 8, 7, 5, 3, 2, 0];     // degrees 7..1, all unraised
    ok(`melodic minor in ${key} descends as natural minor, and every note lights`,
       list(deg) === list(want) && notes.every((x) => canSound(x) && [3, 4, 5].some((b) => canLight(x, b))),
       `${key}: descent degrees ${list(deg)} (want ${list(want)})`);
  }
}

console.log("\n=== E. the Play-Along scale drills, all 3 hand modes ===");
{
  const drills = [...MAJOR_SCALE_SONGS, ...Object.values(MINOR_SCALE_SONGS).flat()];
  const HANDS = { right: [4, 2], left: [2, 2], both: [3, 4] };
  const bad = [];
  for (const s of drills) {
    for (const [hand, [bo, oc]] of Object.entries(HANDS)) {
      const d = expandSong(s, hand);
      const keys = new Set(keysFor(bo, oc).map((k) => k.n));
      for (const note of d.notes) {
        if (!keys.has(note.note)) bad.push(`${s.id} [${hand}] "${note.note}" is on no key`);
        else if (!gpKeyBox(note.note, bo, oc)) bad.push(`${s.id} [${hand}] "${note.note}" gets no running light`);
        else if (!canSound(note.note)) bad.push(`${s.id} [${hand}] "${note.note}" is silent`);
      }
    }
  }
  ok(`${drills.length} scale drills x 3 hand modes: every note lights and sounds`,
     bad.length === 0, [...new Set(bad)].slice(0, 20).join("\n        "));
}

console.log("\n=== F. the chat path's scale table ===");
{
  const bad = [];
  for (const e of M.KNOWN) {
    if (e.m !== "scale") continue;
    for (const n of e.n) if (!canSound(n) || ![3, 4, 5].some((b) => canLight(n, b))) bad.push(`${e.k}: "${n}"`);
  }
  ok("every scale the chat can play is audible and visible", bad.length === 0, bad.join(" "));
  /* the reported symptom, one layer up: ask the extractor for C minor and see
     that it hands playSequence three lit black keys */
  const got = extractNotes("C minor scale", "right", "scale", "C");
  ok("asking the chat for C minor yields the same eight notes the lesson plays",
     got && list(got.notes) === "C4 D4 D#4 F4 G4 G#4 A#4 C5", got && list(got.notes));
  const maj = extractNotes("C major scale", "right", "scale", "C");
  ok("...and C major still yields the major scale (the fix must not flip it)",
     maj && list(maj.notes) === "C4 D4 E4 F4 G4 A4 B4 C5", maj && list(maj.notes));
}

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);