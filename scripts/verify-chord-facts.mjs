/* Every CHORD / TRIAD / INTERVAL fact this app teaches, checked against an
   independent oracle built from first principles (not from the app's tables).

   The oracle:
   • an interval is TWO facts — the NUMBER (letter names spanned) and the
     QUALITY (semitones); a note is spelled right only if BOTH agree
   • a triad is named for its third (major/minor) or its fifth (dim/aug)
   • a seventh chord's name fixes all three of third/fifth/seventh
   • in a major key the diatonic triad on each degree is a fixed quality
   • a scale degree's LETTER is fixed: degree 7 of any key is the letter a
     minor 7th up, not "the nearest spelling" — that is what makes B♯ the
     leading tone of C♯ major and not C

   Reference: Open Music Theory, "Triads" (viva.pressbooks.pub) —
   "A major triad's third is major and its fifth is perfect… A diminished
   triad's third is minor and its fifth is diminished, while an augmented
   triad's third is major and its fifth is augmented." Plus the standard
   interval table (Wikipedia/Open Music Theory "Intervals").

   Run: node scripts/verify-chord-facts.mjs */
import * as core from "../tigamodel/knowledge/expansion-core.js";
import * as scale from "../tigamodel/knowledge/expansion-scale.js";
import * as summit from "../tigamodel/knowledge/expansion-summit.js";
import * as learner from "../tigamodel/knowledge/expansion-learner.js";
import * as canvas from "../tigamodel/knowledge/expansion-canvas.js";
import * as matrix from "../tigamodel/knowledge/expansion-matrix.js";
import * as peaks from "../tigamodel/knowledge/expansion-peaks.js";
import * as deep from "../tigamodel/knowledge/expansion-deep.js";
import * as finalw from "../tigamodel/knowledge/expansion-final.js";

let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("PASS  " + name);
  else { fail++; console.log("FAIL  " + name + (detail ? "\n        " + detail : "")); }
};
const report = (list, n = 8) =>
  list.length ? "  " + list.slice(0, n).join("\n  ") + (list.length > n ? `\n  … ${list.length} total` : "") : "  (none)";

/* ── the oracle ─────────────────────────────────────────────────────────── */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCV = { "#": 1, b: -1, "♯": 1, "♭": -1, "\u{1d12a}": 2, "\u{1d12b}": -2 };
/* The app prints glyphs (E♯) while this oracle emits ASCII (E#); fold both to
   "letter + accidental count" so the two are comparable at all. */
const parse = (s) => {
  const t = String(s);
  let acc = 0;
  for (const ch of t.slice(1)) acc += ACCV[ch] || 0;
  return { letter: t[0].toUpperCase(), acc };
};
/* canonical form used for every comparison below */
const fold = (s) => { const { letter, acc } = parse(s); return letter + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc)); };
const pcOf = (s) => { const { letter, acc } = parse(s); return ((LETTER_PC[letter] + acc) % 12 + 12) % 12; };
const spell = (letter, acc) => letter + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc));
const wrapAcc = (a) => { let n = a; if (n > 6) n -= 12; if (n < -6) n += 12; return n; };
/* the note that must follow `from` when the interval is `semis` semitones in
   direction `dir` at the given DEGREE — the degree is what fixes the letter */
const spellInterval = (fromName, degree, semis, dir) => {
  const { letter } = parse(fromName);
  const fromPc = pcOf(fromName);
  const steps = dir === "up" ? degree - 1 : -(degree - 1);
  const target = LETTERS[(((LETTERS.indexOf(letter) + steps) % 7) + 7) % 7];
  const want = dir === "up" ? (fromPc + semis) % 12 : (fromPc - semis + 12) % 12;
  return fold(spell(target, wrapAcc(want - LETTER_PC[target])));
};
/* semitone counts each interval NUMBER can carry (maj/min/aug/dim) */
const NUMBERS_FOR_SEMITONES = {
  0: [1, 8], 1: [1, 2], 2: [1, 2], 3: [2, 3], 4: [3], 5: [3, 4],
  6: [4, 5], 7: [5], 8: [5, 6], 9: [6], 10: [6, 7], 11: [7], 12: [8],
};
/* which spellings of `semis` semitones are legal at all (degree unknown) */
const legalSpellings = (fromName, semis, dir = "up") =>
  (NUMBERS_FOR_SEMITONES[semis] || [1]).map((n) => spellInterval(fromName, n, semis, dir));
/* A chord is spelled right iff each tone carries the letter its DEGREE names
   (root, 3rd, 5th, 7th…) and the pitch that degree demands. The degree list
   comes from the chord type's own labels, so this is not circular: the oracle
   checks the letter/pitch agreement, it does not re-pick the degrees. */
const chordSpellingOk = (rootName, tones, semisList, degreeList) => {
  for (let i = 0; i < tones.length; i++) {
    if (spellInterval(rootName, degreeList[i], semisList[i], "up") !== fold(tones[i])) return false;
  }
  return true;
};
/* degree numbers a chord type declares, read off its own labels */
const degreesOf = (ch) => {
  const nums = ch.deg.map((d) => parseInt(String(d).replace(/[^\d]/g, ""), 10));
  if (nums[0] !== 1) nums.unshift(1);
  return nums;
};
const stripOct = (s) => String(s).replace(/\d+$/, "");
const semisFromDegrees = (ch) => ch.steps;
const MAJ_STEPS = [0, 2, 4, 5, 7, 9, 11];
/* every note NAME in a printed body that looks like a real note */
const NOTE_RE = /\b([A-Ga-g])(?:##|bb|♯|♭|\u{1d12a}|\u{1d12b}|#|b)*\d?\b/g;

/* ══ 1. CHORD FORMULA TABLE (expansion-core CHORD_TYPES) ═════════════════ */
console.log("=== 1. CHORD_TYPES: the formula table every chord entry is built from ===");
/* textbook chord formulas, transcribed from Open Music Theory / Wikipedia.
   Each is [root, third, fifth(, seventh…)] in semitones. */
const CANON = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
  maj6: [0, 4, 7, 9], min6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], mMaj7: [0, 3, 7, 11],
  maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14], dom9: [0, 4, 7, 10, 14],
  min11: [0, 3, 7, 10, 14, 17], dom13: [0, 4, 7, 10, 14, 21],
};
const formulaBad = [];
for (const [k, want] of Object.entries(CANON)) {
  const got = core.CHORD_TYPES[k];
  if (!got) { formulaBad.push(`${k}: missing from CHORD_TYPES`); continue; }
  if (got.steps.join(",") !== want.join(",")) formulaBad.push(`${k}: app [${got.steps}] vs textbook [${want}]`);
}
ok("every chord formula in the table matches the textbook", formulaBad.length === 0, formulaBad.join("; "));

console.log("\n=== 2. Chord degree labels: does each label match the tone it describes? ===");
/* deg[] lists the intervals ABOVE the root, in order — `maj` writes the root
   out as "1" and every other type omits it, so the arrays are deliberately not
   index-aligned with steps[]. Read them the way the printed string reads them:
   the labels, in order, are the tones after the root. */
const SEMIS_FOR_NUMBER = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 };
const degBad = [];
for (const [k, ch] of Object.entries(core.CHORD_TYPES)) {
  const labels = ch.deg.map(String);
  const tones = labels[0] === "1" ? labels.slice(1) : labels;
  if (tones.length !== ch.steps.length - 1) {
    degBad.push(`${k}: ${tones.length} degree labels for ${ch.steps.length - 1} tones above the root`);
    continue;
  }
  const nums = degreesOf(ch);
  tones.forEach((label, i) => {
    const m = label.match(/^([♭#]*)(\d+)$/);
    if (!m) { degBad.push(`${k}: unparseable degree label "${label}"`); return; }
    const num = +m[2];
    const alt = (m[1].match(/♭/g) || []).length * -1 + (m[1].match(/#/g) || []).length;
    const want = SEMIS_FOR_NUMBER[num];
    if (want == null) { degBad.push(`${k}: degree ${label} is not a chord tone I can verify`); return; }
    if (nums[i + 1] !== num) degBad.push(`${k}: label "${label}" is written at position ${i + 1} but names degree ${num}, so the two disagree about the chord's shape`);
    if (ch.steps[i + 1] !== want + alt) {
      degBad.push(`${k}: label "${label}" claims ${want + alt} semitones but the ${["", "root", "third", "fifth", "seventh", "ninth"][i + 1] || "tone"} is ${ch.steps[i + 1]}`);
    }
  });
}
ok("every chord degree label matches the tone it names", degBad.length === 0, degBad.slice(0, 8).join("\n        "));

console.log("\n=== 3. genChords: is every chord spelled correctly at every root? ===");
const chordBad = [];
for (const e of core.genChords()) {
  const { type, root, notes } = e.meta;
  const tones = notes.map(stripOct);
  if (!chordSpellingOk(root, tones, semisFromDegrees(core.CHORD_TYPES[type]), degreesOf(core.CHORD_TYPES[type]))) {
    chordBad.push(`${root}${type}: taught ${notes.join(" ")} — a chord's tones must be spelled root, third, fifth… in ascending letter order`);
  }
}
const uniqChordBad = [...new Set(chordBad)];
console.log(uniqChordBad.length ? "  " + uniqChordBad.slice(0, 8).join("\n  ") + (uniqChordBad.length > 8 ? `\n  … ${uniqChordBad.length} wrong chords` : "") : "  (none)");
ok("every chord is spelled root-3rd-5th-… in ascending letters",
   uniqChordBad.length === 0,
   `${uniqChordBad.length} chord entries name a quality and then spell the tones as a different chord.`);

console.log("\n=== 4. genDiatonic: is the diatonic triad on each degree right? ===");
/* Open Music Theory: in major, 1-4-5 are major, 2-3-6 are minor, 7 is diminished */
const MAJ_QUALITY = ["maj", "min", "min", "maj", "maj", "min", "dim"];
const diatonicBad = [];
for (const e of core.genDiatonic()) {
  const want = MAJ_QUALITY[e.meta.degree - 1];
  const got = (e.body.match(/องศาที่ \d+ = คอร์ด \S+?(maj|min|dim)\b/) || [])[1];
  if (got && got !== want) diatonicBad.push(`${e.meta.key} degree ${e.meta.degree}: taught ${got}, should be ${want}`);
  /* and the chord root must carry the LETTER of that scale degree */
  const keyRoot = stripOct(e.meta.notes[0]);
  const spelled = spellInterval(e.meta.key, e.meta.degree, MAJ_STEPS[e.meta.degree - 1], "up");
  const taught = (e.body.match(/องศาที่ \d+ = คอร์ด (\S+?)(?:maj|min|dim)\b/) || [])[1];
  if (taught && fold(taught) !== spelled) {
    diatonicBad.push(`${e.meta.key} degree ${e.meta.degree}: the chord root is taught as ${taught}; degree ${e.meta.degree} of ${e.meta.key} major is spelled ${spelled}`);
  }
}
ok("the diatonic triad on every major-key degree has the textbook quality and spelling",
   diatonicBad.length === 0, report([...new Set(diatonicBad)], 8));

console.log("\n=== 5. genIntervals: every interval name and target note ══════════════");
const intBad = [];
for (const e of core.genIntervals()) {
  const { root, semitones: s, target } = e.meta;
  const taught = e.title.match(/\+ (.+?) =/)[1];
  const legal = legalSpellings(root, s, "up");
  if (legal.indexOf(fold(target)) < 0) {
    intBad.push(`${root} + ${taught} = ${target} · correct spelling: ${legal.join(" or ")}`);
  }
}
const uniqInt = [...new Set(intBad)];
console.log(uniqInt.length ? "  " + uniqInt.slice(0, 8).join("\n  ") + (uniqInt.length > 8 ? `\n  … ${uniqInt.length} wrong` : "") : "  (none)");
ok("every interval target note is spelled correctly for its size",
   uniqInt.length === 0, `${uniqInt.length} of ${core.genIntervals().length} entries name an interval and spell the note as a different interval.`);

/* ══ 6. every other generator's printed notes ═════════════════════════════
   Each check below states what the entry TEACHES and re-derives the note from
   that statement alone — the key, the scale degree, the roman numeral, the
   inversion index, the interval's name. The chroma walk this replaced could
   not do that: it only knew a pitch, so on an accidental root the letter came
   out wrong while the pitch looked fine. */
console.log("\n=== 6. Spelling of the notes every other chord/interval generator prints ===");

/* the standard quality tables, transcribed from Wikipedia / Open Music Theory */
const INTERVAL_SEMIS = { m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6, tritone: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12 };
/* the degree each named interval spells to (tritone = aug 4th / dim 5th) */
const INTERVAL_DEGREES = { m2: [2], M2: [2], m3: [3], M3: [3], P4: [4], TT: [4, 5], tritone: [4, 5], P5: [5], m6: [6], M6: [6], m7: [7], M7: [7], P8: [8] };
const DIATONIC_QUALITY = ["maj", "min", "min", "maj", "maj", "min", "dim"];
/* degree of a major scale → the note name, letter-first. THE helper: every
   "which note is this degree of this key" question goes through here. */
const degreeName = (key, deg) => spellInterval(key, deg, MAJ_STEPS[deg - 1], "up");
const romanDegree = (r) => {
  const t = String(r).replace(/[^IViv]/g, "").toUpperCase();
  return ({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 })[t];
};
/* the semitones+degrees of a chord, by its type, from a given root name */
const chordShape = (type, rootName) => {
  const ch = core.CHORD_TYPES[type];
  return ch ? { semis: ch.steps, degrees: degreesOf(ch), rootName } : null;
};
/* every printed note must be spelled the way its own declared statement says */
const checkTones = (bad, id, rootName, tones, semis, degrees) => {
  const t = tones.map(stripOct);
  for (let i = 0; i < t.length; i++) {
    const want = spellInterval(rootName, degrees[i], semis[i], "up");
    if (fold(t[i]) !== want) { bad.push(`${id}: tone ${i + 1} taught ${t[i]}, must be ${want} (degree ${degrees[i]} of ${rootName})`); return; }
  }
};
const checkScale = (bad, id, key, notes, steps, degrees) => {
  for (let i = 0; i < notes.length; i++) {
    const want = spellInterval(key, degrees[i], steps[i], "up");
    if (fold(stripOct(notes[i])) !== want) { bad.push(`${id}: note ${i + 1} taught ${notes[i]}, must be ${want}`); return; }
  }
};
/* the semitones + degrees of an inversion: bass is the i-th chord tone, the
   rest of the chord sits an octave up on top of it */
const invertShape = (type, inv) => {
  const { semis, degrees } = chordShape(type, "C");
  const s = semis.slice(inv).concat(semis.slice(0, inv).map((x) => x + 12));
  const d = degrees.slice(inv).concat(degrees.slice(0, inv).map((x) => x + 7));
  return { s, d };
};
/* the chord token is "I: C" / "ii7: Dm7" — roman numeral, colon, note name */
const parseRomanChord = (token) => {
  const m = String(token).match(/^\s*([IViv]+(?:maj7|m7|7|m)?)\s*:\s*(\S+?)(maj7|m7|7|m)?\s*$/);
  if (!m) return null;
  return { roman: m[1], chord: m[2], suffix: m[3] || "" };
};
const QUAL_FROM_SUFFIX = { "": "maj", m: "min", m7: "min7", "7": "dom7", maj7: "maj7" };

const suites = [];
const suite = (label, fn, entries) => suites.push({ label, fn, entries });

/* ── summit ───────────────────────────────────────────────────────────── */
suite("expansion-summit.genVoicings", (bad) => {
  for (const e of summit.genVoicings()) {
    const s = chordShape(e.meta.type, e.meta.key);
    checkTones(bad, e.id, e.meta.key, e.meta.tones, s.semis, s.degrees);
  }
}, summit.genVoicings());

suite("expansion-summit.genChordToneRoles", (bad) => {
  for (const e of summit.genChordToneRoles()) {
    const s = chordShape(e.meta.type, e.meta.key);
    const tones = (e.body.match(/\(([^)]+)\)/) || [])[1];
    if (tones) checkTones(bad, e.id, e.meta.key, tones.split("-"), s.semis, s.degrees);
    /* the tone it singles out must be one of that chord's tones */
    if (s && legalSpellings(e.meta.key, 0).indexOf(fold(e.meta.tone)) < 0 && !tones) bad.push(`${e.id}: tone "${e.meta.tone}"`);
    const idx = tones ? tones.split("-").map(stripOct).map(fold).indexOf(fold(e.meta.tone)) : -1;
    if (tones && idx < 0) bad.push(`${e.id}: "${e.meta.tone}" is not one of the chord tones it lists (${tones})`);
  }
}, summit.genChordToneRoles());

suite("expansion-summit.genIntervalPairs", (bad) => {
  for (const e of summit.genIntervalPairs()) {
    const semis = INTERVAL_SEMIS[e.meta.interval];
    if (semis == null) { bad.push(`${e.id}: interval id "${e.meta.interval}" is not an interval I know`); continue; }
    const up = legalSpellings(e.meta.from, semis, "up");
    if (up.indexOf(fold(e.meta.up)) < 0) bad.push(`${e.id}: ${e.meta.from} up ${semis} semitones taught as ${e.meta.up}, must be ${up.join(" or ")}`);
    const down = legalSpellings(e.meta.from, semis, "down");
    if (down.indexOf(fold(e.meta.down)) < 0) bad.push(`${e.id}: ${e.meta.from} down ${semis} semitones taught as ${e.meta.down}, must be ${down.join(" or ")}`);
  }
}, summit.genIntervalPairs());

suite("expansion-summit.genProgressionKeys", (bad) => {
  for (const e of summit.genProgressionKeys()) {
    for (const tok of e.meta.chords) {
      const p = parseRomanChord(tok);
      if (!p) { bad.push(`${e.id}: cannot read chord "${tok}"`); continue; }
      const deg = romanDegree(p.roman);
      const wantRoot = degreeName(e.meta.key, deg);
      const taughtRoot = fold(p.chord);
      if (taughtRoot !== wantRoot) bad.push(`${e.id}: ${p.roman} of ${e.meta.key} is taught as root ${taughtRoot}, must be ${wantRoot}`);
      /* The printed suffix must agree with the chord's real quality on that degree.
         A plain triad is diatonic (I/IV/V major, ii/vi minor), but V7 is a
         DOMINANT seventh whatever the key — that is the whole point of it —
         so only the triads are held to the diatonic table. Blues turns even I
         and IV into dominant 7ths, which is the idiom, not a mistake. */
      const q = QUAL_FROM_SUFFIX[p.suffix];
      if (q && e.meta.progression !== "12-bar-blues") {
        const isSeventh = /7$/.test(q);
        if (isSeventh) {
          if (q === "dom7" && deg !== 5 && deg !== 2) bad.push(`${e.id}: ${tok} puts a dominant 7th on degree ${deg}; only V (and ii, as a borrowed minor 7th) take one`);
        } else if (DIATONIC_QUALITY[deg - 1] !== q) {
          bad.push(`${e.id}: ${tok} claims ${q}, but degree ${deg} of ${e.meta.key} major is ${DIATONIC_QUALITY[deg - 1]}`);
        }
      }
      if (p.suffix && fold(p.chord + p.suffix.replace(/maj7|m7|7|m$/, "")) === "") bad.push(`${e.id}: unparseable chord "${tok}"`);
    }
  }
}, summit.genProgressionKeys());

const CADENCE_DEGREES = { authentic: [5, 1], half: [1, 5], plagal: [4, 1], deceptive: [5, 6] };
suite("expansion-summit.genCadenceKeys", (bad) => {
  for (const e of summit.genCadenceKeys()) {
    const degs = CADENCE_DEGREES[e.meta.type];
    e.meta.chords.forEach((c, i) => {
      const want = degreeName(e.meta.key, degs[i]);
      if (fold(c) !== want) bad.push(`${e.id}: ${e.meta.type} chord ${i + 1} in ${e.meta.key} taught as ${c}, must be ${want}`);
    });
  }
}, summit.genCadenceKeys());

/* ── learner: the interval and chord tables it teaches by ear ─────────── */
suite("expansion-learner.genEarIntervals", (bad) => {
  for (const e of learner.genEarIntervals()) {
    const want = INTERVAL_SEMIS[e.meta.interval];
    if (want == null) bad.push(`${e.id}: unknown interval id "${e.meta.interval}"`);
    else if (e.meta.semitones !== want) bad.push(`${e.id}: ${e.meta.interval} taught as ${e.meta.semitones} semitones, must be ${want}`);
  }
}, learner.genEarIntervals());

suite("expansion-learner.genEarChords", (bad) => {
  for (const e of learner.genEarChords()) {
    const qid = (e.id.match(/earchord:(.+)$/) || [])[1];
    const s = chordShape(qid, "C");
    if (!s) continue;
    const printed = (e.body.match(/\(([^)]+)\)/) || [])[1];
    if (!printed) continue;
    checkTones(bad, e.id, "C", printed.split("-"), s.semis, s.degrees);
  }
}, learner.genEarChords());

/* ── canvas ──────────────────────────────────────────────────────────── */
suite("expansion-canvas.genFiveFinger", (bad) => {
  for (const e of canvas.genFiveFinger()) {
    checkScale(bad, e.id, e.meta.key, e.meta.notes, MAJ_STEPS.slice(0, 5), [1, 2, 3, 4, 5]);
  }
}, canvas.genFiveFinger());

suite("expansion-canvas.genChordInSong", (bad) => {
  for (const e of canvas.genChordInSong()) {
    const printed = (e.body.match(/\(([^)]+)\)/) || [])[1];
    if (!printed) continue;
    /* the chord name carries both the root and the quality: Am is A + minor */
    const label = e.meta.chord;
    const qid = /m$/.test(label) ? "min" : "maj";
    const rootName = fold(label.replace(/m$/, ""));
    const s = chordShape(qid, rootName);
    checkTones(bad, e.id, rootName, printed.split("-"), s.semis, s.degrees);
  }
}, canvas.genChordInSong());

/* ── matrix ──────────────────────────────────────────────────────────── */
suite("expansion-matrix.genInversions", (bad) => {
  for (const e of matrix.genInversions()) {
    const { s, d } = invertShape(e.meta.chord, e.meta.inversion);
    checkTones(bad, e.id, e.meta.root, e.meta.notes, s, d);
    /* the printed bass must be the chord tone that is actually in the bass */
    const printedBass = (e.body.match(/เสียงต่ำสุด = (\S+?)\)/) || [])[1];
    if (printedBass && fold(printedBass) !== fold(e.meta.notes[0])) {
      bad.push(`${e.id}: says the lowest note is ${printedBass} but lists ${e.meta.notes.join(" ")}`);
    }
  }
}, matrix.genInversions());

suite("expansion-matrix.genArpeggios", (bad) => {
  for (const e of matrix.genArpeggios()) {
    const n = e.meta.notes.length;
    const semis = [], degrees = [];
    for (let i = 0; i < n; i++) {
      /* a two-octave arpeggio repeats the chord's degrees an octave up */
      semis.push(i < 3 ? e.meta.notes.length && [0, 3, 7, 10, 11][i] : 0);
      degrees.push(0);
    }
    /* derive from the chord type instead of guessing: degree d, then d+7, d+14… */
    const shape = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10] }[e.meta.chord];
    const degs = { maj: [1, 3, 5], min: [1, 3, 5], dom7: [1, 3, 5, 7] }[e.meta.chord];
    const per = shape.length;
    for (let i = 0; i < n; i++) {
      semis[i] = shape[i % per] + 12 * Math.floor(i / per);
      degrees[i] = degs[i % per] + 7 * Math.floor(i / per);
    }
    checkTones(bad, e.id, e.meta.root, e.meta.notes, semis, degrees);
  }
}, matrix.genArpeggios());

const MATRIX_CADENCE = { authentic: [5, 1], half: [4, 5], plagal: [4, 1], deceptive: [5, 6] };
suite("expansion-matrix.genCadences", (bad) => {
  for (const e of matrix.genCadences()) {
    /* the body reads "… = G4 B4 D5 → C4 E4 G4 · ความรู้สึก: …", notes separated by
       commas or spaces depending on the generator — accept either */
    const printed = (e.body.match(/= ([^·]+)/) || [])[1] || "";
    const groups = printed.split("→").map((g) => g.trim().split(/[\s,]+/).filter(Boolean));
    MATRIX_CADENCE[e.meta.type].forEach((deg, i) => {
      const tones = groups[i] || [];
      if (!tones.length) { bad.push(`${e.id}: no chord printed for ${e.meta.type} part ${i + 1}`); return; }
      const rootName = degreeName(e.meta.key, deg);
      const q = DIATONIC_QUALITY[deg - 1];
      if (fold(tones[0]) !== rootName) { bad.push(`${e.id}: ${e.meta.type} in ${e.meta.key} prints ${tones[0]} where degree ${deg} (${rootName}) belongs`); return; }
      const s = chordShape(q, rootName);
      checkTones(bad, e.id, rootName, tones, s.semis, s.degrees);
    });
  }
}, matrix.genCadences());

suite("expansion-matrix.genHarmonization", (bad) => {
  for (const e of matrix.genHarmonization()) {
    const taught = (e.body.match(/โน้ต (\S+?) \(องศา/) || [])[1];
    const want = degreeName(e.meta.key, e.meta.degree);
    if (taught && fold(taught) !== want) bad.push(`${e.id}: degree ${e.meta.degree} of ${e.meta.key} taught as ${taught}, must be ${want}`);
  }
}, matrix.genHarmonization());

/* ── peaks ───────────────────────────────────────────────────────────── */
suite("expansion-peaks.genInversions", (bad) => {
  for (const e of peaks.genInversions()) {
    const inv = e.meta.position === "root" ? 0 : e.meta.position === "1st" ? 1 : 2;
    const { s, d } = invertShape(e.meta.type, inv);
    checkTones(bad, e.id, e.meta.key, e.meta.notes, s, d);
  }
}, peaks.genInversions());

suite("expansion-peaks.genDegrees", (bad) => {
  for (const e of peaks.genDegrees()) {
    const want = degreeName(e.meta.key, e.meta.degree);
    if (fold(e.meta.note) !== want) bad.push(`${e.id}: degree ${e.meta.degree} of ${e.meta.key} taught as ${e.meta.note}, must be ${want}`);
  }
}, peaks.genDegrees());

/* the canonical mode formulas, transcribed from the mode theory standard */
const MODE_CANON = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};
/* a mode sits on degrees 1-7 of its own tonic, so those are the degrees its
   notes carry — that is what keeps Dorian's minor 3rd an F and not an E♯ */
suite("expansion-peaks.genModes", (bad) => {
  for (const e of peaks.genModes()) {
    checkScale(bad, e.id, e.meta.tonic, e.meta.notes, MODE_CANON[e.meta.mode], [1, 2, 3, 4, 5, 6, 7]);
  }
}, peaks.genModes());

/* the canonical exotic-scale formulas, and the degrees their notes carry */
const EXOTIC_CANON = {
  "minor-blues": { steps: [0, 3, 5, 6, 7, 10], degrees: [1, 3, 4, 5, 5, 7] },
  "major-pent": { steps: [0, 2, 4, 7, 9], degrees: [1, 2, 3, 5, 6] },
  "minor-pent": { steps: [0, 3, 5, 7, 10], degrees: [1, 3, 4, 5, 7] },
  "whole-tone": { steps: [0, 2, 4, 6, 8, 10], degrees: [1, 2, 3, 4, 5, 6] },
  /* half-whole diminished is 1 b2 #2 3 #4 5 6 b7: both forms of the 2nd letter */
  "dim-hw": { steps: [0, 1, 3, 4, 6, 7, 9, 10], degrees: [1, 2, 2, 3, 4, 5, 6, 7] },
  /* the chromatic scale uses BOTH forms of each letter: C C♯ D D♯ E F F♯ G G♯
     A A♯ B. Degrees 1…12 instead would ask for C, D, E, F♭ — real note names,
     but not the ones anyone plays or reads. */
  chromatic: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], degrees: [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7] },
};
suite("expansion-peaks.genExoticScales", (bad) => {
  for (const e of peaks.genExoticScales()) {
    const canon = EXOTIC_CANON[e.meta.scale];
    if (!canon) { bad.push(`${e.id}: unknown scale "${e.meta.scale}"`); continue; }
    checkScale(bad, e.id, e.meta.key, e.meta.notes, canon.steps, canon.degrees);
  }
}, peaks.genExoticScales());

/* a transposition distance names a PITCH, not an interval, so only the pitch
   class is a fact here — the letter is a choice the teacher may make either way */
suite("expansion-peaks.genTransposition", (bad) => {
  for (const e of peaks.genTransposition()) {
    if (pcOf(e.meta.up) !== (pcOf(e.meta.key) + e.meta.distance) % 12) bad.push(`${e.id}: ${e.meta.key} up ${e.meta.distance} taught as ${e.meta.up}`);
    if (pcOf(e.meta.down) !== (pcOf(e.meta.key) - e.meta.distance + 12) % 12) bad.push(`${e.id}: ${e.meta.key} down ${e.meta.distance} taught as ${e.meta.down}`);
  }
}, peaks.genTransposition());

/* ── deep ────────────────────────────────────────────────────────────── */
const DEEP_QUAL = { maj: "maj", maj7: "maj7", maj9: "maj9", "6": "maj6", sus2: "sus2", sus4: "sus4" };
suite("expansion-deep.genDegreeVocabulary", (bad) => {
  for (const e of deep.genDegreeVocabulary()) {
    const rootName = degreeName(e.meta.key, e.meta.degree);
    const titleRoot = (e.title.match(/:\s*(\S+?)(?:maj7|maj9|6|sus2|sus4|maj|min)?$/) || [])[1];
    if (titleRoot && fold(titleRoot) !== rootName) bad.push(`${e.id}: the chord root on degree ${e.meta.degree} of ${e.meta.key} is titled ${titleRoot}, must be ${rootName}`);
    const s = chordShape(DEEP_QUAL[e.meta.quality], rootName);
    checkTones(bad, e.id, rootName, e.meta.notes, s.semis, s.degrees);
  }
}, deep.genDegreeVocabulary());

suite("expansion-deep.genKeyPracticePlans", (bad) => {
  for (const e of deep.genKeyPracticePlans()) {
    /* the three chords are between "I-IV-V:" and the instruction that follows,
       so the tail ("สลับ 8 ครั้ง") must not be read as a note name */
    const triads = (e.body.match(/คอร์ด I-IV-V: (.+?)(?= สลับ| ③)/) || [])[1]
      .split("/")
      .map((g) => g.trim().split(/[\s-]+/).filter(Boolean))
      .filter((g) => g.length);
    const expected = [1, 4, 5];   /* the entry says "คอร์ด I-IV-V", in that order */
    triads.forEach((tones, i) => {
      if (i >= expected.length) return;
      const rootName = degreeName(e.meta.key, expected[i]);
      if (fold(tones[0]) !== rootName) { bad.push(`${e.id}: I-IV-V chord ${i + 1} in ${e.meta.key} starts on ${tones[0]}, must be ${rootName}`); return; }
      const s = chordShape(DIATONIC_QUALITY[expected[i] - 1], rootName);
      checkTones(bad, e.id, rootName, tones, s.semis, s.degrees);
    });
    if (triads.length !== 3) bad.push(`${e.id}: says "คอร์ด I-IV-V" but prints ${triads.length} chords`);
    /* the scale it prints must be the key's own major scale, degrees 1-8 */
    const scaleTxt = (e.body.match(/ช้า ([^②]+?) ②/) || [])[1];
    if (scaleTxt) checkScale(bad, e.id, e.meta.key, scaleTxt.trim().split(/\s+/), MAJ_STEPS.concat([12]), [1, 2, 3, 4, 5, 6, 7, 8]);
  }
}, deep.genKeyPracticePlans());

suite("expansion-deep.genProgressionFragments", (bad) => {
  for (const e of deep.genProgressionFragments()) {
    /* each chord prints as "I (C: C4-E4-G4)" */
    const groups = (e.body.match(/major — [^:]+: (.+?)(?= ·|$)/) || [])[1]?.split("→") || [];
    e.meta.degrees.forEach((deg, i) => {
      /* each chord prints as "I (C: C4-E4-G4)" — the name before the colon is the
         chord root, the run after it is the tones */
      const tok = (groups[i] || "").match(/\(([^:]+): ([^)]+)\)/);
      if (!tok) { bad.push(`${e.id}: nothing printed for degree ${deg}`); return; }
      const rootName = degreeName(e.meta.key, deg);
      if (fold(tok[1].trim()) !== rootName) { bad.push(`${e.id}: degree ${deg} of ${e.meta.key} prints the root as ${tok[1].trim()}, must be ${rootName}`); return; }
      const s = chordShape(DIATONIC_QUALITY[deg - 1], rootName);
      checkTones(bad, e.id, rootName, tok[2].split(/[-\s]+/), s.semis, s.degrees);
    });
  }
}, deep.genProgressionFragments());

suite("expansion-deep.genTransposition", (bad) => {
  for (const e of deep.genTransposition()) {
    const s = chordShape("maj", fold(e.meta.to));
    const printed = (e.body.match(/คอร์ด I ใหม่ = (.+?) —/) || [])[1];
    if (printed) checkTones(bad, e.id, fold(e.meta.to), printed.trim().split(/\s+/), s.semis, s.degrees);
    /* the shift is SIGNED and in the range −11…11 ("up 3" / "down 1"), so it
       is compared as a signed difference, not folded into 0…11 */
    const real = pcOf(e.meta.to) - pcOf(e.meta.from);
    if (real !== e.meta.semitones) bad.push(`${e.id}: claims ${e.meta.semitones} semitones from ${e.meta.from} to ${e.meta.to}, which is ${real}`);
    /* and the words it prints must agree with that sign */
    const saysUp = /ขึ้น/.test(e.body), saysDown = /ลง/.test(e.body);
    if ((e.meta.semitones > 0) !== saysUp || (e.meta.semitones < 0) !== saysDown) {
      bad.push(`${e.id}: body says "${saysUp ? "up" : "down"}" but the shift is ${e.meta.semitones}`);
    }
  }
}, deep.genTransposition());

/* ── final ───────────────────────────────────────────────────────────── */
suite("expansion-final.genHandVoicings", (bad) => {
  for (const e of finalw.genHandVoicings()) {
    const s = chordShape(e.meta.chord, e.meta.root);
    const rh = (e.body.match(/มือขวา: (.+?) \(สีสัน\)/) || [])[1];
    if (rh) checkTones(bad, e.id, e.meta.root, rh.trim().split(/\s+/), s.semis, s.degrees);
    /* left hand is root + fifth, and the fifth must carry the letter of degree 5 */
    const lh = (e.body.match(/มือซ้าย: (\S+) \+ (\S+)/) || []);
    if (lh.length === 3) {
      if (fold(lh[1]) !== fold(e.meta.root)) bad.push(`${e.id}: left hand root ${lh[1]} ≠ chord root ${e.meta.root}`);
      const wantFifth = spellInterval(e.meta.root, 5, 7, "up");
      if (fold(lh[2]) !== wantFifth) bad.push(`${e.id}: left-hand fifth taught as ${lh[2]}, must be ${wantFifth}`);
    }
  }
}, finalw.genHandVoicings());

for (const s of suites) {
  const bad = [];
  let threw = null;
  try { s.fn(bad); } catch (err) { threw = String(err && err.stack || err); }
  if (threw) { ok(s.label, false, threw.split("\n").slice(0, 3).join("\n        ")); continue; }
  ok(`${s.label} (${s.entries.length} entries)`, bad.length === 0, report([...new Set(bad)], 8));
}

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fail ? 1 : 0);