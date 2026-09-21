/* ── piano-guard.ts ──
   The LISTENING TEACHER for mic-based note analysis (practice mode +
   play-along). Owner request: "ระบบวิเคราะห์ที่เก่งแบบครูเก่งๆ":
     1. PIANO-ONLY — speech/noise must never be graded as a played note.
     2. OUT-OF-TUNE PIANOS PASS — a note with the right pitch class on a
        detuned piano must still be credited (the tuning already learned
        per-piano must be SHARED across modes, not re-learned from zero).
     3. TESTABLE & ROBUST FOR MANY NOTES — pure functions on plain frames,
        exercised by a committed smoke test; batch-safe for chords.

   Everything here is a pure function of numbers the callers ALREADY have
   (autocorrelation clarity, spectrum flatness data, detected cents) — no
   second source of truth, no new audio passes. ── */

// ═══ 1. PIANO-LIKELIHOOD GUARD ═══
// A struck piano note is: (a) spectrally harmonic — energy concentrated at
// integer multiples of f0, not smeared flat like breath/fricatives, and
// (b) rhythmically stable — a string rings dead-steady, while speech glides
// (vowels slide 50+ cents even inside one syllable). The mic listeners
// already measure both; this guard turns them into ONE decision a teacher
// would make: "was that a piano key, or a mouth/room?"
//
//   clarity     — autocorrelation peak/energy ratio (0..1); piano ≈ >0.8
//   centsSpread — max raw-pitch drift across the stability window (cents);
//                 piano ≈ <15, speech/vibrato ≈ 50+
//   harmRatio   — fraction of total spectral energy sitting on the first 8
//                 harmonics vs the whole bin range (0..1); piano ≈ >0.55,
//                 white-ish noise/sibilants ≈ low. Optional (pass null when
//                 the caller has no spectrum handy — e.g. legacy paths).
export function isPianoLike({ clarity, centsSpread, harmRatio = null }) {
  if (!(clarity > 0)) return false;                    // no periodic pitch at all
  if (clarity < 0.62) return false;                    // too noisy/aperiodic to be a struck string
  if (centsSpread != null && centsSpread > 45) return false; // gliding = voice, not a ringing string
  if (harmRatio != null && harmRatio < 0.42) return false;   // smeared spectrum = breath/noise
  return true;
}

// ═══ 2. SHARED PER-PIANO TUNING MEMORY ═══
// use-practice-mode already learns the piano's cents offset (EMA, clamped)
// but only inside practice mode — play-along re-learned from zero every
// session. A real teacher walks into the room ONCE and knows the piano for
// the whole lesson. This module owns that memory (localStorage-backed, the
// app's standard persistence pattern) and both modes read/write the SAME
// store through these helpers.
const TUNE_KEY = "tg_piano_tune_v1";   // { off: cents EMA, n: samples }
function readTune() {
  try { return JSON.parse(localStorage.getItem(TUNE_KEY) || "null") || { off: 0, n: 0 }; }
  catch (e) { return { off: 0, n: 0 }; }
}
function writeTune(t) { try { localStorage.setItem(TUNE_KEY, JSON.stringify(t)); } catch (e) {} }

export function getPianoTuneOffset() { return readTune().off || 0; }
// Called with the RAW cents error of a note confidently matched. Same
// smoothing + clamp as the original practice-mode code (0.7/0.3 EMA, ±45c),
// so behavior is unchanged — it's just now shared and persistent.
export function learnPianoTune(rawCents) {
  const prev = readTune();
  const blended = prev.n > 0 ? (prev.off * 0.7 + rawCents * 0.3) : rawCents;
  const off = Math.max(-45, Math.min(45, blended));
  writeTune({ off, n: Math.min(999, (prev.n || 0) + 1) });
  return off;
}
// Which mode learned this tuning (debug/UX copy only — both modes share it).
export function pianoTuneSampleCount() { return readTune().n || 0; }
export function resetPianoTune() { writeTune({ off: 0, n: 0 }); }

// ═══ 3. TEACHER-GRADE NOTE VERDICT ═══
// One function both modes can call for the "is this THE right note?" answer,
// replacing the divergent per-mode math with a single, testable rule:
//   • freq == null → digital source (MIDI/tap/poly-batch): exact pitch class.
//   • else mic: measure cents from the target pitch class, re-centered by the
//     SHARED per-piano offset; a note within tolerance passes — exactly the
//     "pitch correct but sound detuned → still credit it" rule the owner
//     asked for. Genuine NEW evidence also updates the shared tuning memory
//     (only when the raw reading is trustworthy, i.e. not itself explained
//     by an already-learned offset — otherwise the EMA would chase its own
//     tail and slowly walk off).
export const TEACHER_TOL_CENTS = 95;      // unchanged from practice mode's value
// Pitch classes reach this module in TWO shapes: a note-name string ("C")
// from music-engine's pcOf(), or a 0–11 number from tests/other callers.
// Accept both so no caller can silently mismatch types.
function _normPC(pc) {
  if (typeof pc === "number") return pc >= 0 && pc <= 11 ? pc : -1;
  return _NN.indexOf(pc);
}
export function teacherJudgeNote({ freq = null, note = null, targetPC }) {
  const pc = _normPC(targetPC);
  if (freq == null) {
    return { ok: pc >= 0 && !!note && pcOfLocal(note) === pc, cents: null, learned: false };
  }
  const raw = centsFromPCLocal(freq, pc);
  const learned = getPianoTuneOffset();
  const eff = raw - learned;
  const ok = Math.abs(eff) <= TEACHER_TOL_CENTS;
  // Only fold in readings that carry NEW tuning information: if the raw error
  // is small, the note was simply in tune with A440 (weak evidence — skip);
  // if it's huge and already within tolerance after re-centering, it mostly
  // confirms the learned offset (also skip). The informative band is "raw
  // error exists but the learned offset explains it" — exactly when the
  // per-piano drift is real and worth reinforcing.
  const informative = ok && Math.abs(raw) > 8 && Math.abs(raw) <= 60 && Math.sign(raw) === Math.sign(learned || raw);
  let newOff = learned;
  if (informative) newOff = learnPianoTune(raw);
  return { ok, cents: Math.round(eff), learned: informative, tuneOffset: newOff };
}

/* tiny local copies of the two 3-line helpers (pcOf/centsFromPC live in
   music-engine, which imports React — keeping this module dependency-free
   makes it importable by tests without a DOM; the functions mirror the
   originals exactly and the smoke test asserts they agree with the real
   ones on the shared sample space). */
const _NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function pcOfLocal(n) {
  const m = /^([A-G]#?)/.exec(n || "");
  return m ? _NN.indexOf(m[1]) : -1;
}
export function centsFromPCLocal(freq, targetPC) {
  if (!freq || freq <= 0) return 9999;
  const midi = 69 + 12 * Math.log2(freq / 440);
  const semi = typeof targetPC === "number"
    ? (targetPC >= 0 && targetPC <= 11 ? targetPC : -1)
    : _NN.indexOf(targetPC);
  if (semi < 0) return 9999;
  const base = Math.round((midi - semi) / 12) * 12 + semi;
  return (midi - base) * 100;
}
