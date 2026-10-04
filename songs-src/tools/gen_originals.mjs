/* gen_originals.mjs — writes TiGA's own practice pieces (songs-src/originals/*.json).

     node songs-src/tools/gen_originals.mjs --count=10000
     node songs-src/tools/gen_originals.mjs --count=10000 --out=songs-src/originals

   WHY THIS EXISTS
   The public-domain ceiling for this app was measured, not guessed: 1,185 pieces in the
   library plus roughly 1,000–1,500 more reachable from Mutopia = about 2,200–2,700. Ten
   thousand playable pieces is therefore not reachable by harvesting scores, however long the
   harvest runs. It IS reachable by composing: a piece written here is ours, so it carries no
   third-party licence question at all, and it costs nothing to produce.

   THE RULE THIS FILE FOLLOWS, STATED HONESTLY
   Nothing is copied. Every note is generated from a seeded pseudo-random walk constrained by
   ordinary tonal rules — the diatonic scale of the key and mode, chord tones on the strong
   beats, the leading tone resolving upward at the cadence, mostly stepwise motion with the
   leaps kept small and the tritone never taken as a melodic leap. No motif, phrase or bar of
   any existing piece is used as an input. The "knowledge" taken from the 1,185 pieces already
   in the library is statistical, not musical: how wide a range a piece of a given level spans,
   how far it leaps, how fast its notes move, how long it lasts (all measured by
   scripts/build-songs.mjs levelOf/profileOf), plus the shared vocabulary of keys, modes,
   meters and cadences.

   DETERMINISM IS THE POINT
   Piece n is a pure function of n: the same command writes byte-identical files on any
   machine, forever. That is what makes the library auditable — a reviewer can regenerate piece
   #8123 and compare, and scripts/verify-originals.mjs can re-check every note of every piece
   without trusting this file.

   WHY SEEDED AND NOT A MODEL
   A model call per piece would cost money per regeneration, would not be reproducible, and
   could not be verified note by note. The app already trusts this approach: music-engine.tsx
   composes scale, chord and interval drills by rule (makeScaleSong / makeChordSong /
   makeIntervalSong) and ships them as real playable songs. This is that idea at library size. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADJ as ADJ_RAW, NOUN as NOUN_RAW, PLACE as PLACE_RAW } from "./originals-lexicon.mjs";
/* levelOf is the app's own measure of how hard a piece is (scripts/build-songs.mjs) — the
   same one that levels the 1,185 classical pieces. A generated piece is not told what level
   it is; it is MEASURED with that function, which is why scripts/verify-originals.mjs can
   re-derive the number and get the same one. */
import { levelOf } from "../../scripts/build-songs.mjs";

/* the lexicon keeps each idea as one row; here it becomes an object so the title templates
   can read a language by name instead of by position. ADJ/NOUN rows are [th, en, zh];
   PLACE rows are written [en, th, zh] because an English place phrase carries its own
   preposition ("at dusk") and reading that column as Thai put "at dusk" into a Thai title. */
const rows = (r) => r.map(([th, en, zh]) => ({ th, en, zh }));
const ADJ = rows(ADJ_RAW), NOUN = rows(NOUN_RAW);
const PLACE = PLACE_RAW.map(([en, th, zh]) => ({ th, en, zh }));

/* why a draw was thrown away, counted rather than guessed at — printed at the end */
const rejects = {};
const bump = (k) => { rejects[k] = (rejects[k] || 0) + 1; };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* ── seeded PRNG ──────────────────────────────────────────────────────────────────
   mulberry32: 32 bits of state, uniform enough for music decisions, and — the reason it is
   here — the same index always walks the same path on any machine and any Node version. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash32 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ── pitch ───────────────────────────────────────────────────────────────────────
   The app's own key table is sharps-only (music-engine.tsx KEYS / _PCN), so every note
   name written here is a sharp. Nothing in the pipeline has to respell anything. */
const SHARP_PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/* PCN holds the NATURAL letters only; a sharp is that letter plus one. Looking the whole
   token up ("C#") finds nothing and yields NaN, which made every sharp note invisible to
   the range check — 2 of 8 notes "belonging to the key" is what that produced. */
const midiOf = (n) => { const m = /^([A-G]#?)([0-9])$/.exec(n); return m ? 12 * (+m[2] + 1) + PCN[m[1][0]] + (m[1].length === 2 ? 1 : 0) : null; };
const nameOf = (m) => SHARP_PC[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

/* ── modes ─────────────────────────────────────────────────────────────────────────
   Offsets in semitones from the tonic. The seven that can carry a singable melody are here;
   "aeolian" is left out because it is natural minor under another name. */
const MODES = {
  "major":          [0, 2, 4, 5, 7, 9, 11],
  "natural minor":  [0, 2, 3, 5, 7, 8, 10],
  "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
  "dorian":         [0, 2, 3, 5, 7, 9, 10],
  "mixolydian":     [0, 2, 4, 5, 7, 9, 10],
  "lydian":         [0, 2, 4, 6, 7, 9, 11],
  "phrygian":       [0, 1, 3, 5, 7, 8, 10],
};
/* A mode is written major-minor or a mode built on the minor third; the name decides which
   side of the circle a piece may use, so the progressions below read as they should. */
const MINORISH = new Set(["natural minor", "harmonic minor", "phrygian"]);

/* ── rhythm banks ─────────────────────────────────────────────────────────────────
   Every pattern is a list of note lengths that adds up to one full bar of its meter, so the
   bar arithmetic can never be wrong by construction — the check in verify-originals.mjs
   exists to catch a mistake in this table, not to police the melody. */
const RHYTHM = {
  "4/4": {
    1: [[4], [2, 2], [2, 1, 1], [1, 1, 2], [1, 1, 1, 1], [3, 1], [1, 3], [2, 1.5, 0.5], [1.5, 1.5, 1]],
    2: [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [1, 0.5, 0.5, 2], [2, 0.5, 0.5, 1], [1.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 2], [0.5, 0.5, 1, 1, 1], [1, 1, 1, 0.5, 0.5]],
    3: [[0.5, 0.5, 1, 1, 1], [0.5, 0.5, 0.5, 0.5, 2], [1, 0.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, 1, 0.25, 0.25, 1.5], [0.5, 0.5, 0.5, 0.5, 1, 1], [1.5, 0.5, 0.5, 1.5], [0.25, 0.25, 1, 1, 1]],
  },
  "3/4": {
    1: [[3], [2, 1], [1, 2], [1, 1, 1], [1.5, 1.5], [2, 0.5, 0.5]],
    2: [[1, 1, 1], [0.5, 0.5, 2], [1, 0.5, 0.5, 1], [1.5, 0.5, 1], [0.5, 1, 1.5], [2, 0.5, 0.5]],
    3: [[0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 1], [1, 1, 0.5, 0.5], [0.5, 1, 0.5, 1]],
  },
  "2/4": {
    1: [[2], [1, 1]],
    2: [[0.5, 0.5, 1], [1, 0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1, 1]],
    3: [[0.5, 0.5, 0.5, 0.5], [1, 0.25, 0.25, 0.5], [0.5, 0.5, 1]],
  },
};

/* ── chord progressions, as scale degrees (0 = tonic) ─────────────────────────────
   Real ones, not random walks: a descending fifths bass (i–vi–IV–V), the cadential six-four,
   the plagal turn, the deceptive ending on the submediant. Each is spelled as the degrees
   it uses so it works in every mode without a transposition table. */
const PROGS = {
  major: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [1, 4, 0, 0], [5, 3, 0, 4], [0, 4, 0, 5], [0, 1, 4, 0], [0, 0, 3, 4], [5, 4, 0, 0], [0, 4, 5, 0]],
  minor: [[0, 5, 2, 4], [0, 3, 4, 0], [0, 0, 3, 4], [0, 5, 0, 4], [0, 6, 3, 4], [5, 4, 0, 0], [0, 2, 4, 0], [0, 3, 4, 5]],
};

/* the pool a piece draws from, by how hard it is meant to be */
const POOL = {
  1: { tonic: ["C", "G", "F", "D", "A", "E"], modes: ["major", "natural minor", "major", "dorian"], meters: ["4/4", "4/4", "3/4"], bars: [[8, 10], [8, 12]], tempo: [56, 96], prog: "major" },
  2: { tonic: ["C", "G", "D", "A", "F", "E", "Bb", "Eb"], modes: ["major", "natural minor", "harmonic minor", "dorian", "mixolydian"], meters: ["4/4", "4/4", "4/4", "3/4"], bars: [[10, 14], [10, 16]], tempo: [66, 112], prog: "major" },
  3: { tonic: ["C", "G", "D", "A", "E", "B", "F", "Bb", "Eb", "Ab", "Db", "F#"], modes: ["major", "harmonic minor", "lydian", "phrygian", "mixolydian", "dorian"], meters: ["4/4", "4/4", "3/4", "2/4"], bars: [[12, 16], [12, 20]], tempo: [76, 138], prog: "minor" },
};

const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const rint = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/* A tune's fingerprint: the first twelve notes by name plus the interval between each and the
   next. Ten notes that use fewer than three pitch classes (a held note, a trill) say nothing
   about which tune it is, so those pieces get no fingerprint and are never called duplicates.
   The rule is the one scripts/verify-originals.mjs applies, and it is why this runs HERE as
   well: at ten thousand pieces a birthday collision is not rare (121 of the first ten
   thousand came out identical), and two identical tunes in one library is a real defect. */
const signatureOf = (notes) => {
  if (new Set(notes.map(n => midiOf(n) % 12)).size < 3) return null;
  const head = notes.slice(0, 12);
  return head.join(" ") + "|" + head.slice(1).map((n, i) => midiOf(n) - midiOf(head[i])).join(",");
};

/* The pitches of one mode as real midi numbers around the middle of the keyboard. The
   octave loop runs 3..6 so the list covers C3..B6 no matter which pitch class the tonic is:
   an earlier version built these from the tonic's own pitch class only, which produced a
   list sitting near midi 0 and silently collapsed every melody onto one note. */
function scaleMidis(tonicPc, mode) {
  const steps = MODES[mode];
  const out = [];
  for (let oct = 3; oct <= 6; oct++) for (const s of steps) out.push(tonicPc + s + oct * 12);
  return [...new Set(out)].sort((a, b) => a - b);
}

/* Compose one piece. Returns {bars, key, mode, meter, bpm, level, pickup} or null if the
   walk produced something the ranges do not allow (never expected; checked anyway). */
function compose(idx, level, rnd) {
  const P = POOL[level];
  const keyName = pick(rnd, P.tonic);
  const mode = pick(rnd, P.modes);
  const meter = pick(rnd, P.meters);
  const bpb = parseInt(meter, 10);
  const tonicPc = PCN[keyName[0]] + (keyName.length > 1 ? (keyName[1] === "#" ? 1 : -1) : 0);
  const scale = scaleMidis(((tonicPc % 12) + 12) % 12, mode);
  const scaleSet = new Set(scale.map(m => ((m % 12) + 12) % 12));

  // how wide this level may wander, and how eagerly it leaps — the two numbers that decide
  // whether a piece lands at level 1 or level 3 under the app's own levelOf() rule
  const span = level === 1 ? 12 : level === 2 ? 16 : 19;
  const leapOdds = level === 1 ? 0.16 : level === 2 ? 0.28 : 0.40;
  const restOdds = level === 1 ? 0.05 : level === 2 ? 0.08 : 0.11;
  const rhythmTier = level;

  const [bLo, bHi] = pick(rnd, P.bars);
  const totalBars = rint(rnd, bLo, bHi);
  const bpm = rint(rnd, P.tempo[0], P.tempo[1]);
  const pickup = rnd() < (level === 1 ? 0.08 : 0.15) ? 1 : 0;

  const progName = P.prog === "minor" && !MINORISH.has(mode) ? "minor" : pick(rnd, ["major", "minor"]);
  const progBank = PROGS[progName];
  const chordAt = (bar) => progBank[bar % progBank.length];

  // the register: a comfortable centre, then clamped to the level's span
  const centre = 67 + rint(rnd, -3, 3);
  /* The window the melody may use. It is snapped to the notes the MODE actually has inside
     C4..B5: an earlier version fell back to the bare centre pitch when the window held no
     scale note at all, which put a foreign note (E natural in a B lydian piece) into the
     middle of the tune — scripts/verify-originals.mjs caught it at 18% in key. */
  const inKeyboard = scale.filter(m => m >= 60 && m <= 83);
  if (inKeyboard.length < 3) return null;
  let lo = Math.max(60, centre - Math.floor(span / 2));
  let hi = Math.min(83, centre + Math.ceil(span / 2));
  // the TONIC must always be inside the window, or the closing note snaps to the next scale
  // degree above it and a C-major piece ends on D (40 of the first 500 did, until this)
  const tonicPitch = tonicPc + 60;
  if (tonicPitch < lo) lo = tonicPitch;
  if (tonicPitch > hi) hi = tonicPitch;
  if (inKeyboard.filter(m => m >= lo && m <= hi).length < 3) { lo = inKeyboard[0]; hi = inKeyboard[inKeyboard.length - 1]; }
  const inRange = (m) => m >= lo && m <= hi;
  const nearestInRange = (m, dir) => {          // walk the scale until a note is inside the window
    let best = null, bestD = Infinity;
    for (const s of scale) for (let o = -12; o <= 12; o += 12) {
      const cand = s + o; if (!inRange(cand)) continue;
      const d = Math.abs(cand - m) + (dir && Math.sign(cand - m) !== dir ? 4 : 0);
      if (d < bestD) { bestD = d; best = cand; }
    }
    // never fall back to a pitch outside the mode: snap to the mode's own nearest note
    if (best == null) { best = inKeyboard[0]; for (const c of inKeyboard) if (Math.abs(c - m) < Math.abs(best - m)) best = c; }
    return best;
  };

  // the triad on a scale degree, as pitch classes — what a melody should favour on a strong beat
  const chordTones = (deg) => {
    const steps = MODES[mode];
    const at = (k) => steps[((deg + k) % steps.length + steps.length) % steps.length];
    return new Set([0, 1, 2].map(k => ((tonicPc + at(deg + k)) % 12 + 12) % 12));
  };

  let cur = nearestInRange(tonicPc + 60, 0);          // the piece opens on its own tonic
  const scaleSteps = scale;
  const stepNear = (from, dir) => {
    const idx = scaleSteps.findIndex(s => s === from);
    if (idx < 0) return nearestInRange(from, dir);
    let i = idx + dir;
    while (i >= 0 && i < scaleSteps.length && !inRange(scaleSteps[i])) i += dir;
    return (i >= 0 && i < scaleSteps.length) ? scaleSteps[i] : nearestInRange(from, dir);
  };

  const bars = [];
  const phraseBars = level === 3 ? 4 : pick(rnd, [2, 2, 4]);
  let noteCount = 0;

  for (let b = 0; b < totalBars; b++) {
    const deg = chordAt(b);
    const tones = chordTones(deg);
    const isLastBar = b === totalBars - 1;
    const isPhraseEnd = isLastBar || (b + 1) % phraseBars === 0;
    const isFinalPhrase = isLastBar;
    // a pickup bar holds the PICKUP itself, not a shortened bar: that is how the engine
    // (pickupBeatsOf) and scripts/verify-songs.mjs read it — first bar = pickup beats,
    // every other bar a full one, so the whole piece is pickup + (bars-1) x meter.
    const beatsThisBar = (b === 0 && pickup) ? pickup : bpb;
    const bank = RHYTHM[meter][rhythmTier] || RHYTHM[meter][1];
    // Only a pattern whose lengths add up to THIS bar is used, so the bar arithmetic can
    // never come out wrong. A shorter pickup bar often has no pattern of its own — a 2/4
    // bar with a one-beat pickup — and then the bar is filled with the longest values that
    // still divide it, which is what a player would write there anyway.
    let pattern = bank.filter(p => p.reduce((a, x) => a + x, 0) === beatsThisBar);
    if (!pattern.length) {
      const flat = [];
      let left = beatsThisBar;
      for (const unit of [2, 1, 0.5]) { while (left >= unit) { flat.push(unit); left = +(left - unit).toFixed(4); if (left < unit) break; } }
      if (left > 0) flat.push(left);
      pattern = flat.length ? [flat] : [[beatsThisBar]];   // ONE pattern, wrapped — a bare
    }                                                      // list of lengths would be picked
    pattern = pick(rnd, pattern);                          // from a second time and hand back
                                                             // a single number as the bar

    let pos = 0; const toks = [];
    for (let i = 0; i < pattern.length; i++) {
      const d = pattern[i];
      const onBeat = Math.abs(pos % 1) < 1e-9;
      const strong = onBeat && (pos === 0 || (bpb === 4 && pos === 2) || (bpb === 3 && pos === 0) || pos === bpb - 1);
      const lastTok = i === pattern.length - 1;

      // the last bar closes the piece: the leading tone resolves up to the tonic, then home.
      // The two share the slot's length, so the bar still adds up to a whole one.
      if (isFinalPhrase && lastTok) {
        const head = d >= 2 ? Math.floor(d / 2 * 4) / 4 : 0;
        if (head > 0) {
          const lt = nearestInRange(tonicPc + 60 + MODES[mode][6], 0);
          toks.push(nameOf(lt) + ":" + head); cur = lt; noteCount += 1; pos += head;
        }
        const tonic = nearestInRange(tonicPc + 60, 0);
        toks.push(nameOf(tonic) + ":" + +(d - head).toFixed(4)); cur = tonic;
        noteCount += 1; pos += d - head;
        continue;
      }
      // a phrase that is not the last one settles on the dominant (a half close)
      if (isPhraseEnd && lastTok && rnd() < 0.7) {
        const dom = nearestInRange(tonicPc + 60 + 7, 0);
        toks.push(nameOf(dom) + ":" + d); cur = dom; noteCount += 1; pos += d;
        continue;
      }
      // a breath, but never the closing note of the piece and never a beat on the downbeat
      if (d >= 1 && onBeat && pos > 0 && !isPhraseEnd && rnd() < restOdds) { toks.push("R:" + d); pos += d; continue; }

      let next;
      if (strong && tones.has(((cur) % 12 + 12) % 12) === false && rnd() < 0.55) {
        // a chord tone near where we are — the voice-leading rule that keeps a melody singable
        const cands = [...tones].map(pc => nearestInRange(pc + Math.round((cur - (cur % 12)) / 12) * 12, 0))
          .filter(inRange);
        // the NEAREST chord tone, not a random one: choosing at random made the line leap
        // to the far side of the chord and straight back, which reads as a saw, not a tune
        next = cands.length ? cands.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a))
          : stepNear(cur, rnd() < 0.5 ? -1 : 1);
      } else if (rnd() < leapOdds) {
        const dir = rnd() < 0.5 ? -1 : 1;
        const size = pick(rnd, level === 1 ? [2, 2, 3] : [2, 3, 4, 5]);
        let cand = cur; let got = 0;
        for (let s = 0; s < size; s++) { cand = stepNear(cand, dir); if (cand !== cur) got++; }
        const semi = Math.abs(cand - cur);
        // the tritone is a chordal interval, not a melodic leap a beginner should read
        next = semi === 6 || semi > 7 ? stepNear(cur, dir) : cand;
      } else {
        next = stepNear(cur, rnd() < 0.5 ? -1 : 1);
      }
      if (!inRange(next)) next = nearestInRange(next, 0);
      if (next === cur && rnd() < 0.4) next = stepNear(cur, rnd() < 0.5 ? -1 : 1);
      cur = next;
      toks.push(nameOf(cur) + ":" + d); noteCount += 1; pos += d;
    }
    bars.push(toks.join(" "));
  }

  // keep out of the sequencer's no-man's land: too few notes, or longer than two minutes
  const totalBeats = bars.reduce((a, bar) => a + bar.split(/\s+/).reduce((x, t) => x + +t.split(":")[1], 0), 0);
  const secs = Math.round(totalBeats * 60 / bpm);
  if (noteCount < 16 || noteCount > 170) { bump(noteCount < 16 ? "too few notes" : "too many notes"); return null; }
  if (secs < 15 || secs > 115) { bump(secs < 15 ? "too short" : "too long"); return null; }

  // a melody may not wander outside C4..B5, the only keys the app draws
  for (const bar of bars) for (const t of bar.split(/\s+/)) {
    const n = t.split(":")[0]; if (n === "R") continue;
    const m = midiOf(n); if (m < 60 || m > 83) { bump("note out of C4..B5: " + n); return null; }
  }
  const allNotes = bars.join(" ").split(/\s+/).filter(Boolean).map(t => t.split(":")[0]).filter(n => n !== "R");
  return { id: `og_${String(idx + 1).padStart(6, "0")}`, era: "original", key: keyName, mode, meter, bpm, pickup, bars, level: levelOf({ bars, bpm }), notes: noteCount, sig: signatureOf(allNotes) };
}

/* ── titles ───────────────────────────────────────────────────────────────────────
   Three languages that say the SAME thing, not three translations of a template: every entry
   in the lexicon carries its Thai, English and Chinese form together, and a title is built
   by joining entries, so "quiet" is always the same word in all three. Templates keep the
   word order natural in each language (English puts the adjective first, Chinese puts the
   place first, Thai puts the head noun first) — so the three read as one title. */
/* The words are ENUMERATED, not sampled. Sampling 4,000 titles out of the ~14,400 the two
   banks can make would collide often (coupon collector), so each form walks its own cross
   product with its OWN counter — sharing one counter between two forms had the two forms
   produce byte-identical titles and reject all but the first. Within a form every title is
   distinct by construction; the caller still drops any repeat, because two DIFFERENT forms
   can land on the same string. */
const formCount = [0, 0, 0, 0, 0];
function titleFor(n) {
  const A = ADJ.length, N = NOUN.length, P = PLACE.length;
  const form = n % 5;
  /* form0 and form1 are the same shape, so they draw from ONE counter. They
     used to have one each and both counted from zero, which made every form1
     title a form0 duplicate — a fifth of the shelf thrown away on a title that
     was guaranteed to be rejected. Sharing formCount[0] makes them a single
     walk of the pair grid: 40,000 successive pairs out of a grid that has to
     be wider than 40,000 or this stalls. Walking it twice, even along the
     other axis, does NOT help — both forms cover every (adjective, noun)
     pair, so they collide wherever their two index ranges overlap. */
  const p = form < 2 ? formCount[0]++ : formCount[form]++;
  if (form < 2) {                                    // quality + noun, two of the five slots
    const a = ADJ[p % A], nw = NOUN[Math.floor(p / A) % N];
    return { th: `${nw.th}${a.th}`, en: `${a.en} ${nw.en}`, zh: `${a.zh}的${nw.zh}` };
  }
  if (form === 2) {                                  // quality + noun + place
    const a = ADJ[p % A], nw = NOUN[Math.floor(p / A) % N], pl = PLACE[Math.floor(p / (A * N)) % P];
    return { th: `${nw.th}${a.th}${pl.th}`, en: `${a.en} ${nw.en} ${pl.en}`, zh: `${pl.zh}${a.zh}的${nw.zh}` };
  }
  if (form === 3) {                                  // noun + place
    const nw = NOUN[p % N], pl = PLACE[Math.floor(p / N) % P];
    return { th: `${nw.th}${pl.th}`, en: `${nw.en} ${pl.en}`, zh: `${pl.zh}${nw.zh}` };
  }
  const a = ADJ[p % A], a2 = ADJ[Math.floor(p / A) % A], nw = NOUN[Math.floor(p / (A * A)) % N];
  return { th: `${nw.th}${a.th}${a2.th}`, en: `${a.en} ${a2.en} ${nw.en}`, zh: `${a.zh}${a2.zh}的${nw.zh}` };
}

/** the note-signatures of every song already in the app, so a new piece cannot be one of them */
async function existingAppSignatures() {
  const { build } = await import("esbuild");
  const { pathToFileURL } = await import("node:url");
  const r = await build({
    stdin: {
      contents: `import { SONGS } from "./songs-data";
        export const SIGS = SONGS.map(s => (s.seq || []).filter(x => x[0] !== "R").map(x => x[0]));`,
      resolveDir: ROOT, loader: "ts",
    },
    bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
  });
  const tmp = path.join(ROOT, "node_modules/.cache", "originals-gen-songs.mjs");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, r.outputFiles[0].text);
  const { SIGS } = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
  return new Set(SIGS.filter(Boolean).map(signatureOf).filter(Boolean));
}

/* ── run ─────────────────────────────────────────────────────────────────────────── */
async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? "1" : m[2]] : [a, "1"];
  }));
  const COUNT = parseInt(args.count || "10000", 10);
  const OUT = path.resolve(ROOT, args.out || "songs-src/originals");
  const PER_FILE = parseInt(args.per || "500", 10);

  const pieces = [];
  const seenEn = new Set(), seenTh = new Set(), seenZh = new Set(), seenSig = new Set();
  /* The app's own pieces are a fixed set of tunes that will never change. A draw
     that lands on one of them is not a new piece, it is a copy of a song that is
     already in the library under someone else's name — and at 100,000 draws the
     odds of hitting one are no longer theoretical (one draw did, and
     verify-originals refused the whole build over it). So the signatures of the
     existing library are loaded here and rejected at the draw, exactly the way
     a duplicate among the new pieces already was. */
  for (const sig of await existingAppSignatures()) seenSig.add(sig);
  let idx = 0, guard = 0;
  while (pieces.length < COUNT && guard < COUNT * 60) {
    // the attempt number is part of the seed on purpose: a rejected draw must try a
    // DIFFERENT piece, not replay the same one forever
    const rnd = mulberry32(hash32("tiga-orig-v1:" + idx + ":" + guard));
    // an even spread of levels: easier first so a beginner opening the shelf lands on one
    const r = rnd();
    const level = r < 0.42 ? 1 : r < 0.78 ? 2 : 3;
    const p = compose(idx, level, rnd);
    guard++;
    if (!p) continue;
    const t = titleFor(pieces.length);
    if (seenEn.has(t.en) || seenTh.has(t.th) || seenZh.has(t.zh)) { bump("title already used"); continue; }
    if (p.sig) { if (seenSig.has(p.sig)) { bump("tune already written"); continue; } seenSig.add(p.sig); }
    seenEn.add(t.en); seenTh.add(t.th); seenZh.add(t.zh);
    const { sig, ...rest } = p;
    pieces.push({ ...rest, en: t.en, th: t.th, zh: t.zh });
    idx++;
  }

  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith(".json"))) fs.unlinkSync(path.join(OUT, f));
  for (let i = 0; i < pieces.length; i += PER_FILE) {
    const part = pieces.slice(i, i + PER_FILE);
    fs.writeFileSync(path.join(OUT, `orig-${String(i / PER_FILE).padStart(3, "0")}.json`), JSON.stringify(part));
  }
  const byLevel = pieces.reduce((a, p) => (a[p.level] = (a[p.level] || 0) + 1, a), {});
  console.log(`gen_originals: ${pieces.length} original pieces in ${Math.ceil(pieces.length / PER_FILE)} files -> ${path.relative(ROOT, OUT)}`);
  console.log(`  levels: ${Object.entries(byLevel).map(([k, v]) => `${k}=${v}`).join(" ")} · titles unique: en ${seenEn.size} th ${seenTh.size} zh ${seenZh.size}`);
  const groups = {};
  for (const k of Object.keys(rejects)) { const g = k.split(":")[0]; groups[g] = (groups[g] || 0) + rejects[k]; }
  console.log(`  attempts ${guard}, kept ${pieces.length}, rejected: ${Object.entries(groups).map(([k, v]) => `${k}=${v}`).join(" ") || "none"}`);
  console.log(`  examples: ${JSON.stringify(pieces.slice(0, 3).map(p => ({ id: p.id, en: p.en, th: p.th, zh: p.zh, key: p.key, mode: p.mode, bars: p.bars.length })))}`);
}
main();