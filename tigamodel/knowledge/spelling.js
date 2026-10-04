/* ── tigamodel/knowledge/spelling.js ──────────────────────────────────────
   THE note speller every knowledge generator must use.

   Why this file exists
   ────────────────────
   The expansion generators used to name notes by walking a CHROMA table:

       const SH = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", ...];
       SH[(rootIdx + semitones) % 12]

   That produces the right PITCH and the wrong NAME whenever the root is
   spelled with an accidental. It is how "C♯ major" came to be taught as
   "C♯ F G♯" — F natural is not E♯, so the chord was named as a major triad and
   then spelled as something else entirely (C♯–F is a diminished fourth).
   A student who reads notes learns the wrong letter; a student who only
   hears it never notices. Both are taught the wrong thing.

   Music names notes by LETTER FIRST. A chord stacks thirds, a triad's
   letters are always root–third–fifth (–seventh…), and the accidental is
   whatever closes the gap between that letter's natural pitch and the pitch
   the interval demands. So that is what this does:

       spellChord("C#", [0, 4, 7])   → ["C♯", "E♯", "G♯"]   (was C♯ F G♯)
       spellChord("Eb", [0, 3, 7])   → ["E♭", "G♭", "B♭"]   (was E♭ G B♭)
       spellScale("F#", major)       → F♯ G♯ A♯ B C♯ D♯ E♯ F♯

   Reference for the rules implemented here:
   • Open Music Theory, "Triads" — "A major triad's third is major and its
     fifth is perfect… A diminished triad's third is minor and its fifth is
     diminished, while an augmented triad's third is major and its fifth is
     augmented." (viva.pressbooks.pub/openmusictheory)
   • Open Music Theory / Wikipedia, "Intervals (music)" — the semitone count
     of each interval number in each quality.
   • A chord stacks in thirds ⇒ the letters of its tones ascend by one or two
     letter names each; that constraint is what makes the spelling unique. ── */

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
export const LETTER_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/* −2..+2 have single glyphs; beyond that the accidentals are repeated. A
   THREE-accidental note does exist — F𝄯 is the major 7th of F𝄪, and F𝄪 is
   degree 6 of A♯ major — and the comment here used to claim nothing was
   clamped while the code clamped to ±2. That silently printed F𝄪 where F𝄯
   belonged: same letter, wrong pitch, wrong interval, and nothing warned. */
const ACC_GLYPH = { "-2": "\u{1D12B}", "-1": "♭", "0": "", "1": "♯", "2": "\u{1D12A}" };
function accGlyph(n) {
  const k = String(n);
  if (ACC_GLYPH[k] != null) return ACC_GLYPH[k];
  return n < 0 ? "♭".repeat(-n) : "♯".repeat(n);
}
const spellName = (letter, acc) => letter + accGlyph(acc);

/* "Eb" / "E♭" / "E#bb" → { letter, acc }
   The `u` flag matters here: without it a regex sees `\u{1D12A}` as the
   literal text "u{1D12A}", so it never matched the actual double-sharp and
   every 𝄪/𝄫 name fell through to the "unparseable → C" default. That made
   D♯ major's mediant (F𝄪) parse as the note C — the same wrong letter this
   whole file exists to prevent, one layer down. */
export function splitNote(name) {
  const m = String(name == null ? "C" : name)
    .replace("♯", "#").replace("♭", "b")
    .replace(/\u{1D12A}/gu, "##").replace(/\u{1D12B}/gu, "bb")
    .match(/^([A-Ga-g])(#{0,2}|b{0,2})$/u);
  if (!m) return { letter: "C", acc: 0 };
  const acc = (m[2].match(/#/g) || []).length - (m[2].match(/b/g) || []).length;
  return { letter: m[1].toUpperCase(), acc };
}

export function pcOf(name) {
  const { letter, acc } = splitNote(name);
  return ((LETTER_SEMI[letter] + acc) % 12 + 12) % 12;
}

/* Wrap an accidental difference into the nearest octave-equivalent. ±2 covers
   every note name in ordinary use; beyond that the accidental is real and must
   be kept (F𝄯 = a major 7th above F𝄪), so it is never clamped down to ±2 — that
   turned a major 7th into an octave and printed a wrong pitch. */
function normAcc(a) {
  let n = a;
  while (n > 6) n -= 12;
  while (n < -6) n += 12;
  return n;
}

/* The one primitive: the note NAME that sits `semitones` above `fromName`,
   taking the letter its DEGREE names and the accidental that closes the gap.
   `degree` is the interval number (1 = unison/root, 3 = third, 5 = fifth…).
   Callers that only know a semitone count should pass a degree that CAN carry
   that many semitones — spellChord does that for them. */
export function spellInterval(fromName, degree, semitones, dir = "up") {
  const { letter } = splitNote(fromName);
  const fromPc = pcOf(fromName);
  const steps = dir === "up" ? degree - 1 : -(degree - 1);
  const target = LETTERS[(((LETTERS.indexOf(letter) + steps) % 7) + 7) % 7];
  const want = dir === "up" ? (fromPc + semitones) % 12 : (fromPc - semitones + 12) % 12;
  return spellName(target, normAcc(want - LETTER_SEMI[target]));
}

/* The semitone count each interval degree has in its PLAIN form (its major,
   perfect, or minor form), and the accidental that names the chromatic
   variants — so a degree can carry its own count ±1 or ±2 semitones. */
const PLAIN_SEMIS = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12, 9: 14, 10: 16, 11: 17, 12: 19, 13: 21, 14: 23, 15: 24 };

/* Which interval DEGREES can carry a given semitone count — computed from the
   table above rather than transcribed, so the compound intervals (9th, 11th,
   13th) are covered too; a hand-written list stopped at an octave and threw on
   every chord that climbs past one. An augmented 4th and a diminished 5th are
   both 6 semitones, so several degrees are legal and the caller picks; what is
   never legal is a degree that cannot hold that count at all. Degrees are
   listed smallest-first, which is what makes a 9th spell as a 2nd on top of
   the octave rather than some other letter. */
export const DEGREES_FOR_SEMITONES = (() => {
  const byCount = {};
  for (const key of Object.keys(PLAIN_SEMIS)) {
    const deg = +key;
    for (let a = -2; a <= 2; a++) {
      const semis = PLAIN_SEMIS[deg] + a;
      if (semis < 0) continue;
      (byCount[semis] = byCount[semis] || []).push(deg);
    }
  }
  for (const k of Object.keys(byCount)) byCount[k].sort((a, b) => a - b);
  return byCount;
})();

/* Spell a chord or scale built on `rootName` from its semitone offsets.
   `degrees` is optional and, when given, names each tone's interval number
   explicitly (a sus2 chord's second IS a 2nd, whatever its semitones). When
   it is omitted the number is chosen as the smallest one that can carry the
   semitone count — which is exactly how a chord stacks.

   Returns names WITHOUT octave numbers; the callers add the octave they
   already computed, because octave placement is about register and is
   correct in the chroma walk. Only the LETTER is what was wrong. */
export function spellFrom(rootName, steps, degrees) {
  const { letter } = splitNote(rootName);
  const rootPc = pcOf(rootName);
  return steps.map((sem, i) => {
    let degree;
    if (degrees && degrees[i] != null) {
      degree = degrees[i];
    } else {
      const legal = DEGREES_FOR_SEMITONES[sem];
      if (!legal || !legal.length) throw new Error("no interval degree carries " + sem + " semitones");
      /* prefer the plain degree whose own count already equals the target,
         so C major's third spells E (degree 3) rather than D♯ (degree 2) */
      degree = legal.find((d) => PLAIN_SEMIS[d] === sem);
      if (degree == null) degree = legal[0];
    }
    return spellInterval(rootName, degree, sem, "up");
  });
}

/* The degrees a chord stacks in: a triad is 1-3-5, a seventh chord 1-3-5-7, a
   ninth 1-3-5-7-9. This exists because the semitone count alone CANNOT name the
   letter: 3 semitones is a minor 3rd (E♭) and an augmented 2nd (D♯) at once,
   and the pitch-class walk that guessed picked D♯ — so "C minor" was taught as
   C D♯ G, a chord with no name. Callers that build a chord from a quality name
   must say which degrees it stacks; the alternative is a wrong letter. */
export const stackDegrees = (count) => Array.from({ length: count }, (_, i) => 1 + i * 2);

/* The degrees a scale built on `stepCount` notes occupies: degrees 1, 2, 3 …
   A scale is a plain stack, so unlike a chord it needs no help — but passing
   them explicitly is what stops a minor 3rd being spelled as a flat 2nd. */
export const stepDegrees = (count) => Array.from({ length: count }, (_, i) => i + 1);

/* Which degree a sus chord suspends, since the third is replaced. */
export const SUS_DEGREES = { sus2: [1, 2, 5], sus4: [1, 4, 5] };

/* Same, for a descending run: degrees walk the letters backwards. */
export function spellFromDown(rootName, steps, degrees) {
  const { letter } = splitNote(rootName);
  return steps.map((sem, i) => {
    let degree;
    if (degrees && degrees[i] != null) degree = degrees[i];
    else {
      const legal = DEGREES_FOR_SEMITONES[sem];
      if (!legal || !legal.length) throw new Error("no interval degree carries " + sem + " semitones");
      degree = legal.find((d) => PLAIN_SEMIS[d] === sem);
      if (degree == null) degree = legal[0];
    }
    return spellInterval(rootName, degree, sem, "down");
  });
}

/* Attach octave numbers to already-spelled names, walking ascending from
   startOct and bumping the octave each time the letter goes backwards. This
   is the register logic the chroma walk used to do — kept, because register
   is the one thing it got right. */
export function withOctaves(names, startOct = 4) {
  const out = [];
  let oct = startOct;
  let prevLetterIdx = -1;
  for (const n of names) {
    const li = LETTERS.indexOf(splitNote(n).letter);
    if (prevLetterIdx >= 0 && li <= prevLetterIdx) oct++;
    out.push(n + oct);
    prevLetterIdx = li;
  }
  return out;
}

/* Spell + octave in one step: the shape nearly every generator wants. */
export function spellWithOctaves(rootName, steps, startOct = 4, degrees) {
  return withOctaves(spellFrom(rootName, steps, degrees), startOct);
}