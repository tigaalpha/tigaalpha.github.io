import { useState, useRef, useEffect, useMemo, memo, useCallback, Fragment } from "react";
import { SONGS, SONG_TIMESIG } from "./songs-data";

/* ── music-engine.tsx ──
   Music theory tables (scales/chords/intervals/fingerings), the Web Audio
   synthesis + game-SFX bus, pitch/chord detection (autocorrelation + FFT
   harmonic summation), mic/MIDI input listeners, play-along song generation,
   and the Piano/GamePiano/Staff rendering components. Extracted from App.tsx
   verbatim — no logic changes — as part of the App.tsx modularization.
   Word-for-word diff against the pre-extraction App.tsx before merging any
   further changes on top of this file. ── */

export const _PCN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NF = (() => {
  const m = {};
  for (let midi = 36; midi <= 96; midi++) {            // C2 (36) … C7 (96)
    const name = _PCN[midi % 12] + (Math.floor(midi / 12) - 1);
    m[name] = +(440 * Math.pow(2, (midi - 69) / 12)).toFixed(2);
  }
  return m;
})();

export const KEYS = [
  {n:"C4",t:"w",l:"C"},{n:"C#4",t:"b",l:"C#"},{n:"D4",t:"w",l:"D"},
  {n:"D#4",t:"b",l:"D#"},{n:"E4",t:"w",l:"E"},{n:"F4",t:"w",l:"F"},
  {n:"F#4",t:"b",l:"F#"},{n:"G4",t:"w",l:"G"},{n:"G#4",t:"b",l:"G#"},
  {n:"A4",t:"w",l:"A"},{n:"A#4",t:"b",l:"A#"},{n:"B4",t:"w",l:"B"},
  {n:"C5",t:"w",l:"C"},{n:"C#5",t:"b",l:"C#"},{n:"D5",t:"w",l:"D"},
  {n:"D#5",t:"b",l:"D#"},{n:"E5",t:"w",l:"E"},{n:"F5",t:"w",l:"F"},
  {n:"F#5",t:"b",l:"F#"},{n:"G5",t:"w",l:"G"},{n:"G#5",t:"b",l:"G#"},
  {n:"A5",t:"w",l:"A"},{n:"A#5",t:"b",l:"A#"},{n:"B5",t:"w",l:"B"}
];

export function keysFor(baseOct = 4, octs = 2) {
  const out = [];
  for (let o = 0; o < octs; o++)
    for (const pc of _PCN) out.push({ n: pc + (baseOct + o), t: pc.length > 1 ? "b" : "w", l: pc });
  return out;
}

export const _WHITE_ORD = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
export function noteKeyFrac(note, baseOct = 4, nwOverride) {
  const m = String(note || "").match(/^([A-G])(#?)(\d)$/);
  if (!m) return null;
  // nwOverride: total white keys in visible piano range.
  // Single-hand = 14 (2 octaves), both-hand = 28 (4 octaves).
  const NW = nwOverride || 14;
  let base = (parseInt(m[3], 10) - baseOct) * 7 + _WHITE_ORD[m[1]];
  if (base < 0) base = 0; else if (base > NW - 1) base = NW - 1;
  if (m[2] === "#") return { cx: (base + 1) / NW, w: (1 / NW) * 0.62 };
  return { cx: (base + 0.5) / NW, w: 1 / NW };
}

export const _FLAT2 = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#", CB: "B", FB: "E" };
export function normSongNote(note) {
  let t = String(note == null ? "" : note).trim().replace("♯", "#").replace("♭", "b");
  if (t === "" || t === "-" || t.toUpperCase() === "R") return "R";
  const m = t.match(/^([A-Ga-g])(#|b)?(\d)?$/);
  if (!m) return null;
  const L0 = m[1].toUpperCase(), acc = m[2] || "", oct = m[3] || "4";
  let name = acc === "b" ? (_FLAT2[L0 + "B"] || L0) + oct : L0 + acc + oct;
  if (NF[name]) return name;
  return NF[L0 + oct] ? L0 + oct : null;
}
export function normalizeSeq(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const it of arr) {
    if (!Array.isArray(it)) continue;
    const n = normSongNote(it[0]);
    if (n === null) continue;
    let b = +it[1]; if (!b || b <= 0) b = 1; b = Math.min(4, Math.max(0.25, b));
    out.push([n, b]);
  }
  return out;
}

export const CHROMA = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export const _PCI = { C:0,"C#":1,DB:1,D:2,"D#":3,EB:3,E:4,F:5,"F#":6,GB:6,G:7,"G#":8,AB:8,A:9,"A#":10,BB:10,B:11 };
export const SCALE_DEF = {
  major: [0,2,4,5,7,9,11], "natural minor": [0,2,3,5,7,8,10], "harmonic minor": [0,2,3,5,7,8,11],
  "melodic minor": [0,2,3,5,7,9,11], "major pentatonic": [0,2,4,7,9], "minor pentatonic": [0,3,5,7,10],
  blues: [0,3,5,6,7,10], dorian: [0,2,3,5,7,9,10], mixolydian: [0,2,4,5,7,9,10],
};
export const CHORD_DEF = {
  major: [0,4,7], minor: [0,3,7], dim: [0,3,6], aug: [0,4,8], sus2: [0,2,7], sus4: [0,5,7],
  maj7: [0,4,7,11], min7: [0,3,7,10], "7": [0,4,7,10], "6": [0,4,7,9], min6: [0,3,7,9], dim7: [0,3,6,9],
};
export function pcIdx(pc) { const p = String(pc == null ? "" : pc).trim(); const u = p.charAt(0).toUpperCase() + p.slice(1); return _PCI[p.toUpperCase()] != null ? _PCI[p.toUpperCase()] : (_PCI[u] != null ? _PCI[u] : -1); }
export function scaleNotesOf(root, type = "major") { const r = pcIdx(root); if (r < 0) return []; return (SCALE_DEF[type] || SCALE_DEF.major).map(s => CHROMA[(r + s) % 12]); }
export function chordNotesOf(root, type = "major") { const r = pcIdx(root); if (r < 0) return []; return (CHORD_DEF[type] || CHORD_DEF.major).map(s => CHROMA[(r + s) % 12]); }
export function identifyChord(pcs) {
  const uniq = [...new Set(pcs.map(pcIdx).filter(x => x >= 0))].sort((a, b) => a - b);
  if (uniq.length < 2 || uniq.length > 4) return null;
  for (let root = 0; root < 12; root++) for (const name in CHORD_DEF) {
    const set = [...new Set(CHORD_DEF[name].map(i => (root + i) % 12))].sort((a, b) => a - b);
    if (set.length === uniq.length && set.every((v, i) => v === uniq[i])) return CHROMA[root] + " " + name;
  }
  return null;
}
export function identifyScaleRun(pcs) {
  const uniq = [...new Set(pcs.map(pcIdx).filter(x => x >= 0))];
  if (uniq.length < 5) return null;
  let best = null;
  for (let root = 0; root < 12; root++) for (const name in SCALE_DEF) {
    const steps = SCALE_DEF[name]; if (steps.length < 5) continue;
    const set = new Set(steps.map(s => (root + s) % 12));
    if (uniq.every(u => set.has(u)) && (!best || steps.length < best.len)) best = { label: CHROMA[root] + " " + name, len: steps.length };
  }
  return best ? best.label : null;
}
export function interpretPlayed(pcs) { return identifyChord(pcs) || identifyScaleRun(pcs); }

export function rhythmReport(times) {
  if (!times || times.length < 3) return "";
  const iois = [];
  for (let i = 1; i < times.length; i++) { const d = times[i] - times[i - 1]; if (d > 0 && d < 4000) iois.push(d); }
  if (iois.length < 2) return "";
  const mean = iois.reduce((a, b) => a + b, 0) / iois.length;
  if (mean <= 0) return "";
  const variance = iois.reduce((a, b) => a + (b - mean) * (b - mean), 0) / iois.length;
  const cv = Math.sqrt(variance) / mean;            // 0 = perfectly even
  const bpm = Math.round(60000 / mean);
  const h = Math.floor(iois.length / 2);
  const a1 = iois.slice(0, h).reduce((a, b) => a + b, 0) / Math.max(1, h);
  const a2 = iois.slice(h).reduce((a, b) => a + b, 0) / Math.max(1, iois.length - h);
  const trend = a2 < a1 * 0.9 ? "rushing (speeding up)" : a2 > a1 * 1.12 ? "dragging (slowing down)" : "steady tempo";
  const even = cv < 0.15 ? "very even notes" : cv < 0.3 ? "fairly even" : "uneven note lengths";
  return `~${bpm} BPM, ${even}, ${trend}`;
}

// normalize flats/symbols to the sharp spelling used in NF
export function normRoot(r) {
  const map = { "DB":"C#", "EB":"D#", "GB":"F#", "AB":"G#", "BB":"A#",
                "D♭":"C#", "E♭":"D#", "G♭":"F#", "A♭":"G#", "B♭":"A#",
                "F♯":"F#", "C♯":"C#", "G♯":"G#", "D♯":"D#", "A♯":"A#" };
  const u = r.toUpperCase().replace(/♯/g,"#").replace(/♭/g,"b");
  if (map[u]) return map[u];
  // "Bb" style
  const m2 = { "DB":"C#","EB":"D#","GB":"F#","AB":"G#","BB":"A#" };
  const up = r.charAt(0).toUpperCase() + r.slice(1);
  if (m2[up.toUpperCase()]) return m2[up.toUpperCase()];
  return r.charAt(0).toUpperCase() + (r.length>1 ? r.slice(1).replace(/♯/g,"#").replace(/♭/g,"b") : "");
}
// split a note like "C#4" -> ["C#", 4]
export function splitNote(note) {
  const m = note.match(/^([A-G][#b]?)(\d)$/);
  if (!m) return null;
  return [m[1], parseInt(m[2], 10)];
}
// transpose a list of notes by N semitones, keeping them in range C4..B5
export function transposeNotes(notes, semis) {
  if (!semis) return notes.slice();
  return notes.map(note => {
    const sp = splitNote(note);
    if (!sp) return note;
    let idx = CHROMA.indexOf(sp[0].replace("b", "#") === sp[0] ? sp[0] : sp[0]);
    // handle flats by mapping to sharps
    const flatMap = { "Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#" };
    let name = flatMap[sp[0]] || sp[0];
    idx = CHROMA.indexOf(name);
    if (idx < 0) return note;
    let oct = sp[1];
    let abs = idx + semis;
    oct += Math.floor(abs / 12);
    abs = ((abs % 12) + 12) % 12;
    return CHROMA[abs] + oct;
  });
}
// semitone distance from C to the chosen root
export function semisFromC(root) {
  const flatMap = { "DB":"C#","EB":"D#","GB":"F#","AB":"G#","BB":"A#" };
  let u = root.toUpperCase().replace(/♯/g,"#").replace(/♭/g,"b");
  // normalize "Bb"->"A#"
  if (flatMap[u]) u = flatMap[u];
  else u = u.charAt(0) + (u.length>1 ? u.slice(1) : "");
  const idx = CHROMA.indexOf(u);
  return idx < 0 ? 0 : idx;
}

export const FINGERINGS_RH = {
  "c major scale":  [1,2,3,1,2,3,4,5],
  "g major scale":  [1,2,3,1,2,3,4,5],
  "d major scale":  [1,2,3,1,2,3,4,5],
  "a major scale":  [1,2,3,1,2,3,4,5],
  "e major scale":  [1,2,3,1,2,3,4,5],
  "b major scale":  [1,2,3,1,2,3,4,5],
  "f major scale":  [1,2,3,4,1,2,3,4],
  "f# major scale": [2,3,4,1,2,3,1,2],
  "db major scale": [2,3,1,2,3,4,1,2],
  "ab major scale": [3,4,1,2,3,1,2,3],
  "eb major scale": [3,1,2,3,4,1,2,3],
  "bb major scale": [2,1,2,3,1,2,3,4],
  "a minor scale":  [1,2,3,1,2,3,4,5],
  "e minor scale":  [1,2,3,1,2,3,4,5],
  "d minor scale":  [1,2,3,1,2,3,4,5],
  "f minor scale":  [1,2,3,4,1,2,3,4],
  "c scale":        [1,2,3,1,2,3,4,5],
  "g scale":        [1,2,3,1,2,3,4,5],
  "pentatonic":     [1,2,3,4,5,1],
  "pentatonic scale":[1,2,3,4,5,1],
  "blues":          [1,2,3,4,1,2,3],
  "blues scale":    [1,2,3,4,1,2,3],
};
// Left-hand fingerings (ascending, low→high). Standard graded fingerings.
export const FINGERINGS_LH = {
  "c major scale":  [5,4,3,2,1,3,2,1],
  "g major scale":  [5,4,3,2,1,3,2,1],
  "d major scale":  [5,4,3,2,1,3,2,1],
  "a major scale":  [5,4,3,2,1,3,2,1],
  "e major scale":  [5,4,3,2,1,3,2,1],
  "b major scale":  [4,3,2,1,4,3,2,1],
  "f major scale":  [5,4,3,2,1,3,2,1],
  "f# major scale": [4,3,2,1,3,2,1,4],
  "db major scale": [3,2,1,4,3,2,1,3],
  "ab major scale": [3,2,1,4,3,2,1,3],
  "eb major scale": [3,2,1,4,3,2,1,3],
  "bb major scale": [3,2,1,4,3,2,1,2],
  "a minor scale":  [5,4,3,2,1,3,2,1],
  "e minor scale":  [5,4,3,2,1,3,2,1],
  "d minor scale":  [5,4,3,2,1,3,2,1],
  "f minor scale":  [5,4,3,2,1,3,2,1],
  "c scale":        [5,4,3,2,1,3,2,1],
  "g scale":        [5,4,3,2,1,3,2,1],
  "pentatonic":     [5,4,3,2,1,5],
  "pentatonic scale":[5,4,3,2,1,5],
  "blues":          [5,4,3,2,1,2,1],
  "blues scale":    [5,4,3,2,1,2,1],
};
// triad fingering (root position): RH = 1-3-5, LH = 5-3-1
export const TRIAD_FINGER_RH = [1,3,5];
export const TRIAD_FINGER_LH = [5,3,1];

export const FINGERING_REF =
  "\n\n[FINGERING FACTS — authoritative. Use these EXACT finger numbers; never invent or guess them. 1=thumb,2=index,3=middle,4=ring,5=pinky.]\n" +
  "Scales, ASCENDING (low→high pitch):\n" +
  "• Right hand — C, G, D, A, E, B major and A, E, D minor = 1 2 3 1 2 3 4 5\n" +
  "• Right hand — F major and F minor = 1 2 3 4 1 2 3 4\n" +
  "• Right hand — F# major = 2 3 4 1 2 3 1 2\n" +
  "• Right hand — Db major = 2 3 1 2 3 4 1 2\n" +
  "• Right hand — Ab major = 3 4 1 2 3 1 2 3\n" +
  "• Right hand — Eb major = 3 1 2 3 4 1 2 3\n" +
  "• Right hand — Bb major = 2 1 2 3 1 2 3 4\n" +
  "• Left hand — C, G, D, A, E, F major and A, E, D, F minor = 5 4 3 2 1 3 2 1\n" +
  "• Left hand — B major = 4 3 2 1 4 3 2 1\n" +
  "• Left hand — F# major = 4 3 2 1 3 2 1 4\n" +
  "• Left hand — Db, Ab, Eb major = 3 2 1 4 3 2 1 3\n" +
  "• Left hand — Bb major = 3 2 1 4 3 2 1 2\n" +
  "• DESCENDING = the very same fingers played in reverse order.\n" +
  "Triads (root position): right hand = 1 3 5 · left hand = 5 3 1.\n" +
  "Technique: ascending right hand passes the THUMB UNDER (after finger 3); ascending left hand crosses finger 3 OVER the thumb. " +
  "If a key is not in this list, teach the principle — do NOT invent finger numbers.";

// pick fingering for a key by hand

export function getFingers(key, mode, hand) {
  if (mode === "chord") return hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
  const map = hand === "left" ? FINGERINGS_LH : FINGERINGS_RH;
  return map[key] || null;
}
// finger numbers aligned 1:1 to a note list for a given hand (scale by key, or
// triad fallback). Returns null when we have no verified data to recompute from.
export function fingersForNotes(key, mode, notes, hand) {
  let f = null;
  if (key) f = getFingers(key, mode, hand);
  // The 1-3-5/5-3-1 fallback is shaped for a 3-note ROOT-POSITION TRIAD only —
  // applying it to any "chord" regardless of note count silently truncated a
  // 4-note seventh chord to 3 fingers (the 4th note got no finger at all),
  // since a "chord" with a caller-supplied 4-entry `fingers` array (see
  // buildStageDemoSeq's own demoFingers) never reached this fallback: the
  // caller only falls back to fingersForNotes()'s result when it's non-null,
  // so a plausible-looking-but-wrong 3-note answer here masked the correct
  // one instead of yielding to it.
  else if ((mode === "chord" || mode === "seq") && notes.length === 3) f = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
  return f ? notes.map((n, i) => (f[i] != null ? f[i] : null)) : null;
}

/* ── Chord/Scale library ── */
export const KNOWN = [
  {k:"c major scale",n:["C4","D4","E4","F4","G4","A4","B4","C5"],m:"scale"},
  {k:"d major scale",n:["D4","E4","F#4","G4","A4","B4","C#5","D5"],m:"scale"},
  {k:"e major scale",n:["E4","F#4","G#4","A4","B4","C#5","D#5","E5"],m:"scale"},
  {k:"f major scale",n:["F4","G4","A4","A#4","C5","D5","E5","F5"],m:"scale"},
  {k:"g major scale",n:["G4","A4","B4","C5","D5","E5","F#5","G5"],m:"scale"},
  {k:"a major scale",n:["A4","B4","C#5","D5","E5","F#5","G#5","A5"],m:"scale"},
  {k:"b major scale",n:["B4","C#5","D#5","E5","F#5","G#5","A#5","B5"],m:"scale"},
  {k:"f# major scale",n:["F#4","G#4","A#4","B4","C#5","D#5","F5","F#5"],m:"scale"},
  {k:"bb major scale",n:["A#4","C5","D5","D#5","F5","G5","A5","A#5"],m:"scale"},
  {k:"eb major scale",n:["D#4","F4","G4","G#4","A#4","C5","D5","D#5"],m:"scale"},
  {k:"ab major scale",n:["G#4","A#4","C5","C#5","D#5","F5","G5","G#5"],m:"scale"},
  {k:"db major scale",n:["C#4","D#4","F4","F#4","G#4","A#4","C5","C#5"],m:"scale"},
  {k:"a minor scale",n:["A4","B4","C5","D5","E5","F5","G5","A5"],m:"scale"},
  {k:"e minor scale",n:["E4","F#4","G4","A4","B4","C5","D5","E5"],m:"scale"},
  {k:"d minor scale",n:["D4","E4","F4","G4","A4","A#4","C5","D5"],m:"scale"},
  {k:"g minor scale",n:["G4","A4","A#4","C5","D5","D#5","F5","G5"],m:"scale"},
  {k:"b minor scale",n:["B4","C#5","D5","E5","F#5","G5","A5","B5"],m:"scale"},
  {k:"c minor scale",n:["C4","D4","D#4","F4","G4","G#4","A#4","C5"],m:"scale"},
  {k:"f# minor scale",n:["F#4","G#4","A4","B4","C#5","D5","E5","F#5"],m:"scale"},
  {k:"c# minor scale",n:["C#4","D#4","E4","F#4","G#4","A4","B4","C#5"],m:"scale"},
  {k:"f minor scale",n:["F4","G4","G#4","A#4","C5","C#5","D#5","F5"],m:"scale"},
  {k:"c scale",n:["C4","D4","E4","F4","G4","A4","B4","C5"],m:"scale"},
  {k:"g scale",n:["G4","A4","B4","C5","D5","E5","F#5","G5"],m:"scale"},
  {k:"a scale",n:["A4","B4","C#5","D5","E5","F#5","G#5","A5"],m:"scale"},
  {k:"d scale",n:["D4","E4","F#4","G4","A4","B4","C#5","D5"],m:"scale"},
  {k:"e scale",n:["E4","F#4","G#4","A4","B4","C#5","D#5","E5"],m:"scale"},
  {k:"f scale",n:["F4","G4","A4","A#4","C5","D5","E5","F5"],m:"scale"},
  {k:"pentatonic scale",n:["C4","D4","E4","G4","A4","C5"],m:"scale"},
  {k:"pentatonic",n:["C4","D4","E4","G4","A4","C5"],m:"scale"},
  {k:"blues scale",n:["C4","D#4","F4","F#4","G4","A#4","C5"],m:"scale"},
  {k:"blues",n:["C4","D#4","F4","F#4","G4","A#4","C5"],m:"scale"},
  {k:"chromatic",n:["C4","C#4","D4","D#4","E4","F4","F#4","G4","G#4","A4","A#4","B4","C5"],m:"scale"},
  // triads
  {k:"c major",n:["C4","E4","G4"],m:"chord"},{k:"c maj",n:["C4","E4","G4"],m:"chord"},
  {k:"d major",n:["D4","F#4","A4"],m:"chord"},{k:"d maj",n:["D4","F#4","A4"],m:"chord"},
  {k:"e major",n:["E4","G#4","B4"],m:"chord"},{k:"e maj",n:["E4","G#4","B4"],m:"chord"},
  {k:"f major",n:["F4","A4","C5"],m:"chord"},{k:"f maj",n:["F4","A4","C5"],m:"chord"},
  {k:"g major",n:["G4","B4","D5"],m:"chord"},{k:"g maj",n:["G4","B4","D5"],m:"chord"},
  {k:"a major",n:["A4","C#5","E5"],m:"chord"},{k:"a maj",n:["A4","C#5","E5"],m:"chord"},
  {k:"b major",n:["B4","D#5","F#5"],m:"chord"},{k:"b maj",n:["B4","D#5","F#5"],m:"chord"},
  {k:"f# major",n:["F#4","A#4","C#5"],m:"chord"},{k:"f# maj",n:["F#4","A#4","C#5"],m:"chord"},
  {k:"bb major",n:["A#4","D5","F5"],m:"chord"},{k:"bb maj",n:["A#4","D5","F5"],m:"chord"},
  {k:"eb major",n:["D#4","G4","A#4"],m:"chord"},{k:"eb maj",n:["D#4","G4","A#4"],m:"chord"},
  {k:"ab major",n:["G#4","C5","D#5"],m:"chord"},{k:"ab maj",n:["G#4","C5","D#5"],m:"chord"},
  {k:"db major",n:["C#4","F4","G#4"],m:"chord"},{k:"db maj",n:["C#4","F4","G#4"],m:"chord"},
  {k:"a minor",n:["A4","C5","E5"],m:"chord"},{k:"a min",n:["A4","C5","E5"],m:"chord"},
  {k:"e minor",n:["E4","G4","B4"],m:"chord"},{k:"e min",n:["E4","G4","B4"],m:"chord"},
  {k:"d minor",n:["D4","F4","A4"],m:"chord"},{k:"d min",n:["D4","F4","A4"],m:"chord"},
  {k:"g minor",n:["G4","A#4","D5"],m:"chord"},{k:"g min",n:["G4","A#4","D5"],m:"chord"},
  {k:"c minor",n:["C4","D#4","G4"],m:"chord"},{k:"c min",n:["C4","D#4","G4"],m:"chord"},
  {k:"f minor",n:["F4","G#4","C5"],m:"chord"},{k:"f min",n:["F4","G#4","C5"],m:"chord"},
  {k:"b minor",n:["B4","D5","F#5"],m:"chord"},{k:"b min",n:["B4","D5","F#5"],m:"chord"},
  {k:"bb minor",n:["A#4","C#5","F5"],m:"chord"},{k:"bb min",n:["A#4","C#5","F5"],m:"chord"},
  {k:"f# minor",n:["F#4","A4","C#5"],m:"chord"},{k:"f# min",n:["F#4","A4","C#5"],m:"chord"},
].sort((a,b) => b.k.length - a.k.length);

export function extractNotes(text, hand = "right", hint = null, forceKey = null) {
  const lo = text.toLowerCase();

  // The explicit hint (from the lesson the user picked) ALWAYS wins.
  let scaleFirst, chordFirst;
  if (hint === "scale") { scaleFirst = true; chordFirst = false; }
  else if (hint === "chord") { scaleFirst = false; chordFirst = true; }
  else {
    const wantsScale = /\bscale\b|สเกล|บันไดเสียง|音阶|音階/.test(lo);
    const wantsChord = /\bchord\b|triad|คอร์ด|ไทรแอด|和弦/.test(lo);
    scaleFirst = wantsScale && !wantsChord;
    chordFirst = wantsChord && !wantsScale;
  }

  // ── HIGHEST PRIORITY: an explicit key was chosen in the lesson picker ──
  // Build the exact entry for {forceKey + mode} and use it directly, ignoring
  // whatever other keys the AI may mention (e.g. comparing to C major).
  if (forceKey) {
    const root = forceKey.toLowerCase()          // "F#" -> "f#", "Bb" -> "bb"
      .replace(/♯/g, "#").replace(/♭/g, "b");
    const wantMode = scaleFirst ? "scale" : chordFirst ? "chord" : null;
    if (wantMode) {
      // try common qualifiers for this key+mode
      const candidates = wantMode === "scale"
        ? [`${root} major scale`, `${root} minor scale`, `${root} scale`]
        : [`${root} major`, `${root} minor`, `${root} maj`, `${root} min`];
      for (const cand of candidates) {
        const hit = KNOWN.find(e => e.k === cand && e.m === wantMode);
        if (hit) {
          const fingers = getFingers(hit.k, hit.m, hand);
          return { notes: hit.n, label: hit.k.toUpperCase(), mode: hit.m, fingers, key: hit.k };
        }
      }
      // last resort: any entry of this mode starting with the root
      const any = KNOWN.find(e => e.m === wantMode && e.k.startsWith(root));
      if (any) {
        const fingers = getFingers(any.k, any.m, hand);
        return { notes: any.n, label: any.k.toUpperCase(), mode: any.m, fingers, key: any.k };
      }
    }
  }

  // A key name only counts when it stands as its own word. Plain substring
  // matching meant the ordinary phrase "the major scale" contained "e major
  // scale", so a D-major lesson silently played, highlighted and labelled
  // itself as E major.
  const mentions = (k) => new RegExp("(?<![a-z#])" + k + "(?![a-z])").test(lo);

  // helper: among entries of the required mode, find the one whose key appears in text
  function matchInMode(mode) {
    const pool = KNOWN.filter(e => e.m === mode);
    for (const e of pool) {
      if (mentions(e.k)) return e;
    }
    return null;
  }

  // When a mode is forced, FIRST try to find a root mentioned in the text and
  // map it to that mode. e.g. text "F major" + hint scale  ->  "f major scale".
  if (scaleFirst || chordFirst) {
    const wantMode = scaleFirst ? "scale" : "chord";
    let e = matchInMode(wantMode);
    if (!e) {
      const roots = ["a#","c#","d#","f#","g#","ab","bb","db","eb","gb","a","b","c","d","e","f","g"];
      const qualifiers = lo.includes("minor") || lo.includes("min ") || /\bm\b/.test(lo) ? "minor" : "major";
      let foundRoot = null;
      // Our own lesson text states the key in its header ("🎼 Major scale · D").
      // That is authoritative — trust it over whatever the prose happens to contain.
      const hdr = /·[ \t]*([A-Ga-g][#b♯♭]?)[ \t]*$/m.exec(text);
      if (hdr) foundRoot = hdr[1].toLowerCase().replace(/♯/g, "#").replace(/♭/g, "b");
      for (const r of roots) {
        if (foundRoot) break;
        if (mentions(r + " major") || mentions(r + " minor") || mentions(r + "major") || mentions(r + "minor")) {
          foundRoot = r;
        }
      }
      if (foundRoot) {
        const want = wantMode === "scale"
          ? `${foundRoot} ${qualifiers} scale`
          : `${foundRoot} ${qualifiers}`;
        e = KNOWN.find(x => x.k === want) || KNOWN.find(x => x.m === wantMode && x.k.startsWith(foundRoot));
      }
    }
    if (e) {
      const fingers = getFingers(e.k, e.m, hand);
      return { notes: e.n, label: e.k.toUpperCase(), mode: e.m, fingers, key: e.k };
    }
  }

  // no forced mode (or nothing matched): plain longest-key-first scan
  for (const e of KNOWN) {
    if (mentions(e.k)) {
      const fingers = getFingers(e.k, e.m, hand);
      return { notes: e.n, label: e.k.toUpperCase(), mode: e.m, fingers, key: e.k };
    }
  }

  const rx = /(?<![A-Za-z])([A-Ga-g][#b]?)([45])(?!\d)/g;
  const raw = [];
  for (const m of text.matchAll(rx)) {
    let n = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    n = n.replace(/Bb/,"A#").replace(/Eb/,"D#").replace(/Ab/,"G#").replace(/Db/,"C#").replace(/Gb/,"F#");
    n = n + m[2];
    if (NF[n] && !raw.includes(n)) raw.push(n);
  }
  if (raw.length) {
    const mode = (scaleFirst || raw.length >= 5) ? "scale" : "seq";
    const fingers = mode === "seq" && raw.length === 3 ? (hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH) : null;
    return { notes: raw, label: raw.join(" · "), mode, fingers, key: null };
  }
  return null;
}

export const INTERVAL_FEEL = {
  m2: { th: "เสียงเสียดสีที่สุด ตึงเครียด ต้องการคลี่คลายทันที", en: "the sharpest, most dissonant clash — it wants to resolve immediately", zh: "最尖锐、最不协和，急切地想要解决" },
  M2: { th: "ขั้นก้าวเล็ก ๆ ที่ทำนองส่วนใหญ่ใช้เดินเสียง", en: "a small melodic step — most tunes move by this distance", zh: "小步进，大多数旋律都靠它移动" },
  m3: { th: "เศร้า อบอุ่น เป็นฐานของคอร์ดไมเนอร์ทุกตัว", en: "sad and warm — the backbone of every minor chord", zh: "忧伤而温暖，是所有小三和弦的基础" },
  M3: { th: "สดใส มั่นคง เป็นฐานของคอร์ดเมเจอร์ทุกตัว", en: "bright and confident — the backbone of every major chord", zh: "明亮稳固，是所有大三和弦的基础" },
  P4: { th: "เปิดกว้าง ค่อนข้างมั่นคง แต่ยังรอการคลี่คลาย", en: "open and fairly stable, but still leans toward resolving", zh: "开阔而较稳定，但仍倾向于解决" },
  TT: { th: "ไม่มั่นคงที่สุดในดนตรี ฉายา 'ขั้นคู่ปีศาจ'", en: "the most unstable interval in music — nicknamed 'the devil's interval'", zh: "音乐中最不稳定的音程，绰号'魔鬼音程'" },
  P5: { th: "มั่นคงและทรงพลังที่สุด เป็นฐานของคอร์ดแทบทุกชนิด", en: "the most stable and powerful — almost every chord is built on it", zh: "最稳定有力，几乎所有和弦都建立在它之上" },
  m6: { th: "หวานปนเศร้า ให้ความรู้สึกโรแมนติก", en: "bittersweet — has a romantic, wistful color", zh: "苦乐参半，带着浪漫的色彩" },
  M6: { th: "หวาน อบอุ่น ให้ความรู้สึกมีความหวัง", en: "sweet, warm, and hopeful", zh: "甜美温暖，充满希望" },
  m7: { th: "กลิ่นอายแจ๊สซี่ อยากคลี่คลายลงมา", en: "jazzy — it wants to resolve downward", zh: "带着爵士味，渴望向下解决" },
  M7: { th: "ฝันลอย ซับซ้อน หรูหรา", en: "dreamy, sophisticated, and lush", zh: "梦幻、精致、华丽" },
  P8: { th: "โน้ตตัวเดียวกันในเสียงที่สูงขึ้น กลมกลืนที่สุดเท่าที่จะเป็นได้", en: "the same note an octave up — the most perfectly blended sound possible", zh: "同一个音高八度，是最完美融合的声音" },
};
export const TRIAD_FEEL = {
  major: { th: "เสียงสดใส มั่นคง มีความสุข", en: "bright, stable, happy", zh: "明亮、稳定、快乐", formula: "1–3–5" },
  minor: { th: "เสียงเศร้า นุ่มลึก ให้ความรู้สึกดิบ", en: "sad, soft, and raw", zh: "忧伤、柔和、真实", formula: "1–♭3–5" },
  dim: { th: "เสียงตึง อึดอัด ไม่มั่นคง มักใช้เชื่อมคอร์ด", en: "tense, uneasy, unstable — often used as a passing chord", zh: "紧张、压抑、不稳定，常用作过渡和弦", formula: "1–♭3–♭5" },
  aug: { th: "เสียงแปลก ลึกลับ ล่องลอย", en: "strange, mysterious, floating", zh: "奇特、神秘、飘忽", formula: "1–3–♯5" },
};
export const SEVENTH_FEEL = {
  maj7: { th: "หรูหรา นุ่มนวล ฟังสบาย", en: "lush and smooth — easy on the ear", zh: "华丽、柔顺、悦耳", formula: "1–3–5–7" },
  dom7: { th: "อยากคลี่คลายลงไป มักใช้ในบลูส์/แจ๊ส", en: "wants to resolve — a staple of blues and jazz", zh: "渴望解决，是蓝调与爵士的常客", formula: "1–3–5–♭7" },
  min7: { th: "นุ่ม เท่ ผ่อนคลาย", en: "soft, cool, and relaxed", zh: "柔和、酷、放松", formula: "1–♭3–5–♭7" },
  minmaj7: { th: "ลึกลับ สไตล์ธีมสายลับ", en: "mysterious — classic spy-movie sound", zh: "神秘，经典间谍片音色", formula: "1–♭3–5–7" },
  halfdim: { th: "หม่นเศร้า ตึงเครียดเบา ๆ", en: "melancholy, gently tense", zh: "忧郁，略带紧张", formula: "1–♭3–♭5–♭7" },
  dim7: { th: "ตึงที่สุดในกลุ่มนี้ ใช้เชื่อมคอร์ดได้อย่างนุ่มนวล", en: "the tensest of the group — a smooth connector between chords", zh: "此组中最紧张，是和弦间的圆滑过渡", formula: "1–♭3–♭5–♭♭7" },
  aug7: { th: "โดมินันต์แปลกๆ อยากคลี่คลายแบบมีสีสัน", en: "an edgy dominant that resolves with extra color", zh: "另类属和弦，带着色彩感解决", formula: "1–3–♯5–♭7" },
  augmaj7: { th: "ฝันลอย ล้ำสมัย", en: "dreamy and futuristic", zh: "梦幻、前卫", formula: "1–3–♯5–7" },
};

export const KEYS_12 = [
  { id: "C",  name: "C",  th: "โด",        zh: "C",  black: false },
  { id: "G",  name: "G",  th: "ซอล",       zh: "G",  black: false },
  { id: "D",  name: "D",  th: "เร",        zh: "D",  black: false },
  { id: "A",  name: "A",  th: "ลา",        zh: "A",  black: false },
  { id: "E",  name: "E",  th: "มี",        zh: "E",  black: false },
  { id: "B",  name: "B",  th: "ที",        zh: "B",  black: false },
  { id: "F",  name: "F",  th: "ฟา",        zh: "F",  black: false },
  { id: "F#", name: "F♯", th: "ฟาชาร์ป",   zh: "F♯", black: true  },
  { id: "Db", name: "D♭", th: "เรแฟลต",    zh: "D♭", black: true  },
  { id: "Ab", name: "A♭", th: "ลาแฟลต",    zh: "A♭", black: true  },
  { id: "Eb", name: "E♭", th: "มีแฟลต",    zh: "E♭", black: true  },
  { id: "Bb", name: "B♭", th: "ทีแฟลต",    zh: "B♭", black: true  },
];

export const LESSON_MODE = "__lesson__";

export let _ac = null;
export function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  // browsers suspend the context until a user gesture; resume so sound actually
  // plays (especially on iOS/Safari where it stays suspended otherwise)
  if (_ac.state === "suspended" && _ac.resume) _ac.resume();
  return _ac;
}
/* ── master audio bus: global volume + a touch of reverb for a warm piano ── */
export let _sfxVol = 0.9, _sfxMuted = false, _busGain = null, _busCtx = null;
export function setSfxVol(v) { _sfxVol = Math.max(0, Math.min(1, v)); if (_busGain) _busGain.gain.value = _sfxMuted ? 0 : _sfxVol; }
export function setSfxMuted(m) { _sfxMuted = !!m; if (_busGain) _busGain.gain.value = _sfxMuted ? 0 : _sfxVol; }
export function getSfxVol() { return _sfxVol; }
export function getSfxMuted() { return _sfxMuted; }
export function audioBus() {
  const ac = getAC();
  if (_busGain && _busCtx === ac) return { ac, bus: _busGain };
  _busCtx = ac;
  _busGain = ac.createGain();
  _busGain.gain.value = _sfxMuted ? 0 : _sfxVol;
  _busGain.connect(ac.destination);
  /* ── the reverb tail is built OFF the critical path ──
     The impulse response is a hundred and thirty thousand samples of noise
     under a decay curve, generated by hand. It used to be built inline, which
     meant whatever asked for sound FIRST paid for it: opening a PvP fight
     spent ninety milliseconds here before the arena could draw, and that is a
     tail nobody has heard yet. The dry bus is live the moment this returns;
     the convolver joins it on the next idle turn — the same impulse, the same
     blend, just not in front of the first frame. */
  const addTail = () => {
    if (!_busGain || _busCtx !== ac) return;
    try {
      const conv = ac.createConvolver();
      const len = Math.floor(ac.sampleRate * 1.5);
      const buf = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      conv.buffer = buf;
      const wet = ac.createGain(); wet.gain.value = 0.13;
      _busGain.connect(conv); conv.connect(wet); wet.connect(ac.destination);
    } catch (e) {}
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(addTail, { timeout: 500 });
  else setTimeout(addTail, 0);
  return { ac, bus: _busGain };
}
// piano-like timbre: fundamental + harmonics; higher partials decay faster
export const _PARTIALS = [[1, 1.0, 1.0], [2, 0.5, 0.72], [3, 0.26, 0.52], [4, 0.13, 0.4], [6, 0.07, 0.3]];
// Every oscillator/gain pair playPianoNote has started that hasn't finished
// ringing out yet — tracked so stopAllPianoNotes() can actually silence them
// (self-pruned via each oscillator's own onended, so this never grows unbounded).
export let _activeNotes = [];
export function playPianoNote(note, dur = 0.7, velocity = 1) {
  try {
    if (_sfxMuted) return;
    const f = NF[note]; if (!f) return;
    // This plays through the same speaker any active mic-based pitch listener is
    // listening to (Practice Mode's "correct!" confirmation, Play Along, etc.) — on
    // a phone without headphones the mic hears its own echo and can misread it as
    // the learner's next note. Blacklist this exact pitch for as long as it's
    // audible, same mechanism the falling-notes game already uses for its own sfx.
    _accMarkSuppress(f, 50, Date.now() + dur * 1000 + 300);
    const { ac, bus } = audioBus();
    const t0 = ac.currentTime;
    const lp = ac.createBiquadFilter();   // mellow the top end a touch
    lp.type = "lowpass";
    lp.frequency.value = Math.min(9000, f * 6 + 1800);
    lp.connect(bus);
    const peak = 0.33 * Math.max(0.001, Math.min(1, velocity));
    for (const [mul, amp, dscale] of _PARTIALS) {
      if (f * mul > 12000) continue;
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * mul;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);            // ADSR: fast attack, exp decay
      g.gain.exponentialRampToValueAtTime(peak * amp, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * dscale + 0.06);
      osc.connect(g); g.connect(lp);
      osc.start(t0); osc.stop(t0 + dur * dscale + 0.14);
      const entry = { osc, g };
      _activeNotes.push(entry);
      osc.onended = () => { const i = _activeNotes.indexOf(entry); if (i >= 0) _activeNotes.splice(i, 1); };
    }
  } catch (e) {}
}
// Press-and-hold pair for the on-screen keyboard: startPianoNote() begins the
// tone with a gentle decay-while-held (real piano keys keep losing energy even
// sustained, they just don't go silent) and does NOT schedule a stop —
// releasePianoNote() ramps whichever gain the hold-decay has reached down to
// silence over releaseTime. Kept separate from playPianoNote() (a fire-and-
// forget one-shot used by demo playback, chime feedback, backing chords, etc.)
// rather than folding hold-detection into it, since those callers don't have
// a "release" moment to call back into.
export function startPianoNote(note, velocity = 1) {
  try {
    if (_sfxMuted) return null;
    const f = NF[note]; if (!f) return null;
    // Hold duration isn't known yet, so suppress mic self-echo for a generous
    // window; releasePianoNote() re-suppresses for the release tail below.
    _accMarkSuppress(f, 50, Date.now() + 6000);
    const { ac, bus } = audioBus();
    const t0 = ac.currentTime;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    // brighter timbre at higher velocity — a harder hammer strike excites more
    // high-frequency content on a real piano too
    lp.frequency.value = Math.min(9000, f * 6 + 1800 + velocity * 900);
    lp.connect(bus);
    const peak = 0.33 * Math.max(0.15, Math.min(1, velocity));
    const voices = [];
    for (const [mul, amp, dscale] of _PARTIALS) {
      if (f * mul > 12000) continue;
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * mul;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak * amp, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * amp * 0.4), t0 + 2.2);
      osc.connect(g); g.connect(lp);
      osc.start(t0);
      const entry = { osc, g };
      _activeNotes.push(entry);
      osc.onended = () => { const i = _activeNotes.indexOf(entry); if (i >= 0) _activeNotes.splice(i, 1); };
      voices.push(entry);
    }
    return { note, voices };
  } catch (e) { return null; }
}
export function releasePianoNote(handle, releaseTime = 0.22) {
  if (!handle) return;
  try {
    const ac = _busCtx || getAC();
    const t0 = ac.currentTime;
    const f = NF[handle.note];
    if (f) _accMarkSuppress(f, 50, Date.now() + releaseTime * 1000 + 200);
    for (const { osc, g } of handle.voices) {
      const cur = g.gain.value;
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(Math.max(cur, 0.0001), t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + releaseTime);
      osc.stop(t0 + releaseTime + 0.05);
    }
  } catch (e) {}
}
// metronome click (routed direct to output so it stays audible/independent)
export function playClick(accent) {
  try {
    const ac = getAC(), t0 = ac.currentTime;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 2000 : 1300;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t0 + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + 0.06);
  } catch (e) {}
}

export function playMiss() {
  try {
    const ac = getAC(), t0 = ac.currentTime;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(175, t0);
    osc.frequency.exponentialRampToValueAtTime(85, t0 + 0.18);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + 0.22);
  } catch (e) {}
}
// rocket launch — a quick airy whoosh (band-passed noise sweeping upward).
// Pure noise = no periodic pitch, so the game's autocorrelation mic gate ignores it.
export function playWhoosh() {
  try {
    if (_sfxMuted) return;
    const { ac, bus } = audioBus(), t0 = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = _accNoise(ac); src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(420, t0);
    bp.frequency.exponentialRampToValueAtTime(3400, t0 + 0.17);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start(t0); src.stop(t0 + 0.22);
  } catch (e) {}
}
// meteor impact — deep cinematic boom (sub sine drop) + debris crackle (filtered noise).
// The sine sweep lives at 120→34Hz, far below the game's C4 (261.6Hz) note range,
// and gets a suppression band anyway so the mic can never mistake it for a note.
export function playBoom(big) {
  try {
    if (_sfxMuted) return;
    const { ac, bus } = audioBus(), t0 = ac.currentTime;
    const o = ac.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(34, t0 + 0.28);
    const og = ac.createGain();
    og.gain.setValueAtTime(big ? 0.5 : 0.34, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(og); og.connect(bus); o.start(t0); o.stop(t0 + 0.34);
    const n = ac.createBufferSource(); n.buffer = _accNoise(ac);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(2600, t0);
    lp.frequency.exponentialRampToValueAtTime(320, t0 + 0.25);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(big ? 0.28 : 0.18, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    n.connect(lp); lp.connect(ng); ng.connect(bus); n.start(t0); n.stop(t0 + 0.3);
    _accMarkSuppress(70, 1000, Date.now() + 350);
  } catch (e) {}
}

export let _accNoiseBuf = null, _accNoiseRate = 0;
export function _accNoise(ac) {
  if (_accNoiseBuf && _accNoiseRate === ac.sampleRate) return _accNoiseBuf;
  const len = Math.floor(ac.sampleRate * 0.3);
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  _accNoiseBuf = b; _accNoiseRate = ac.sampleRate; return b;
}
// ── Self-noise suppression ──────────────────────────────────────────
// The falling-notes game's own sound effects (e.g. the meteor-impact boom)
// play through the SAME speaker the mic listens through, so on a phone
// without headphones the mic can hear them and mistake it for a note the
// player pressed. Since we generate those sounds ourselves we know exactly
// which frequency is sounding and for how long, so we blacklist those bands
// from pitch detection while they're active — the player's live piano notes
// (any other frequency) are unaffected.
export let _accSuppress = [];
export function _accMarkSuppress(freq, tolCents, untilMs) {
  if (!freq) return;
  const lo = freq * Math.pow(2, -tolCents / 1200), hi = freq * Math.pow(2, tolCents / 1200);
  _accSuppress.push({ lo, hi, until: untilMs });
  if (_accSuppress.length > 64) _accSuppress.shift();
}
export function _accIsSuppressed(freq) {
  if (!freq || !_accSuppress.length) return false;
  const now = Date.now();
  _accSuppress = _accSuppress.filter(s => s.until > now);
  return _accSuppress.some(s => freq >= s.lo && freq <= s.hi);
}

export function stopAllPianoNotes() {
  const ac = _busCtx || getAC();
  const now = ac.currentTime;
  for (const { osc, g } of _activeNotes) {
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);       // freeze at wherever its ramp currently is
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.stop(now + 0.04);
    } catch (e) {}
  }
  _activeNotes = [];
  _accSuppress = [];
}

// soft "got it, thinking…" earcon so the learner knows the AI heard them
// (reassuring on slow networks where the reply takes a moment)
export function vmThinkCue() {
  try {
    if (_sfxMuted) return;
    const { ac, bus } = audioBus();
    const t0 = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(520, t0); o.frequency.exponentialRampToValueAtTime(720, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 0.3);
  } catch (e) {}
}
// short synthesized UI sounds (click / level-up / badge / reward)
export function playUi(kind) {
  try {
    if (_sfxMuted) return;
    const ac = getAC();
    const seq = kind === "levelup" ? [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.28]]
      : kind === "badge" ? [[784, 0], [1175, 0.1]]
      : kind === "reward" ? [[659, 0], [988, 0.08]]
      : kind === "wrong" ? [[233, 0], [185, 0.1]]
      : [[620, 0]]; // click
    const isClick = kind === "click";
    for (const [f, t] of seq) {
      const t0 = ac.currentTime + t;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = isClick ? "triangle" : "sine";
      osc.frequency.value = f;
      const tail = isClick ? 0.07 : 0.24;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(isClick ? 0.1 : 0.18, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + tail);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + tail + 0.03);
    }
  } catch (e) {}
}
// rising combo tone — climbs a pentatonic ladder as the streak grows (auditory reward)
export const _COMBO_SEMIS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
export function playComboTone(step) {
  try {
    if (_sfxMuted) return;
    const ac = getAC(), t0 = ac.currentTime;
    const semis = _COMBO_SEMIS[Math.min(step - 1, _COMBO_SEMIS.length - 1)] || 0;
    const f = 523.25 * Math.pow(2, semis / 12);
    // Same self-echo guard as playPianoNote/playBoom — this is a clean tone inside the
    // piano's detectable range, fired on every Play Along hit while the mic keeps listening,
    // so without this the reward chime itself could be misheard as the next note.
    _accMarkSuppress(f, 50, Date.now() + 380);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.17, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.connect(g); g.connect(ac.destination);
    o.start(t0); o.stop(t0 + 0.2);
  } catch (e) {}
}
// optional generative ambient pad for menus (off by default)
export let _amb = null;
export function startAmbient() {
  try {
    if (_amb) return;
    const ac = getAC();
    const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
    const filt = ac.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 800; filt.connect(out);
    const oscs = [130.81, 196.0, 246.94, 392.0].map(f => {       // Cmaj7 pad
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ac.createGain(); g.gain.value = 0.11; o.connect(g); g.connect(filt); o.start(); return o;
    });
    out.gain.linearRampToValueAtTime(0.05, ac.currentTime + 3);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.05;
    const lg = ac.createGain(); lg.gain.value = 280; lfo.connect(lg); lg.connect(filt.frequency); lfo.start();
    _amb = { out, oscs, lfo, ac };
  } catch (e) {}
}
export function stopAmbient() {
  if (!_amb) return;
  const { out, oscs, lfo, ac } = _amb; _amb = null;
  try {
    out.gain.cancelScheduledValues(ac.currentTime);
    out.gain.setValueAtTime(out.gain.value, ac.currentTime);
    out.gain.linearRampToValueAtTime(0, ac.currentTime + 1);
    setTimeout(() => { try { oscs.forEach(o => o.stop()); lfo.stop(); } catch (e) {} }, 1100);
  } catch (e) {}
}

export const _NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
export function midiToNoteName(midi) {
  const oct = Math.floor(midi / 12) - 1;
  return _NOTE_NAMES[((midi % 12) + 12) % 12] + oct;
}
export function freqToNoteName(freq) {
  if (!freq || freq < 55 || freq > 2100) return null;
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return midiToNoteName(midi);
}
export function pcOf(note) { return note.replace(/-?\d+$/, ""); } // pitch class (drop octave)

export function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length, rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.006) return -1; // sensitivity: lower gate so soft/light key presses still register
  let r1 = 0, r2 = SIZE - 1; const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const b = buf.slice(r1, r2); SIZE = b.length;
  if (SIZE < 8) return -1;
  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE - i; j++) c[i] += b[j] * b[j + i];
  let d = 0; while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  let T0 = maxpos;
  if (T0 <= 0) return -1;
  // CLARITY GATE: how strongly the signal repeats at its own best period, normalized
  // by its energy at lag 0. A clean piano note self-correlates near 1.0; unpitched
  // sound (room noise, speech, a cough) has no stable period and scores much lower.
  // This is what actually stops the detector from "hearing" a note in silence/noise —
  // the RMS gate above only checks loudness, not whether the sound is tonal at all.
  if (c[0] <= 0 || maxval / c[0] < 0.78) return -1; // loosened further so light/soft presses still clear this gate
  const x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);
  return T0 ? sampleRate / T0 : -1;
}

export function hasFormantSpike(db, sampleRate, fftSize, f0) {
  if (!f0 || !db || !db.length) return false;
  const binHz = sampleRate / fftSize;
  const magAt = (freq) => {
    const bin = Math.round(freq / binHz);
    if (bin < 1 || bin >= db.length - 1) return -160;
    return Math.max(db[bin - 1], db[bin], db[bin + 1]); // ±1 bin tolerates quantization
  };
  const H = 6; // fundamental + 5 overtones
  const mags = []; for (let n = 1; n <= H; n++) mags.push(magAt(f0 * n));
  for (let i = 1; i < H - 1; i++) {
    const neighborAvg = (mags[i - 1] + mags[i + 1]) / 2;
    if (mags[i] - neighborAvg > 16) return true; // one harmonic way louder than its neighbors predict
  }
  return false;
}

export function _interpMag(mag, bin) {                 // linear-interpolate magnitude at a fractional bin
  const i = Math.floor(bin); if (i < 0 || i + 1 >= mag.length) return 0;
  const f = bin - i; return mag[i] * (1 - f) + mag[i + 1] * f;
}
// magSpectrum: Float32Array of linear magnitudes (NOT dB). Returns ascending note names (with octave).
export function detectPolyNotes(mag, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  const HARM = 7;                                // partials summed per candidate
  const W = [0, 1, 0.85, 0.7, 0.55, 0.42, 0.32, 0.24]; // harmonic weights (index = partial #)
  const LO = 43, HI = 91;                        // G2 .. G6 — the realistic teaching range
  const sal = {}, fund = {};                     // total salience + bare-fundamental energy per MIDI note
  let maxSal = 0;
  for (let m = LO; m <= HI; m++) {
    const f0 = 440 * Math.pow(2, (m - 69) / 12);
    let s = 0;
    for (let h = 1; h <= HARM; h++) {
      const f = f0 * h; if (f >= sampleRate / 2) break;
      const e = _interpMag(mag, f / binHz);
      s += e * W[h]; if (h === 1) fund[m] = e;    // remember the note's own fundamental
    }
    sal[m] = s; if (s > maxSal) maxSal = s;
  }
  if (maxSal <= 0) return [];
  // ── IS ANYTHING ACTUALLY BEING PLAYED? ──────────────────────────────
  // Every other test here is RELATIVE ("keep notes within X% of the loudest"),
  // which means that on pure room noise there is still always a "loudest", so a
  // purely relative detector happily reports a handful of confident notes out of
  // silence — measured at 6 phantom notes on 12/12 noise samples, ~95% of which
  // contained one of a given chord's target pitch classes. That, not echo, is the
  // main reason practice could credit notes nobody played.
  // The fix is a test with an absolute meaning: a real struck note towers over its
  // own PITCH NEIGHBOURHOOD, whereas noise energy is spread smoothly across
  // neighbouring candidates with nothing standing out. Comparing each note to the
  // average of its neighbours (rather than to a global average) is invariant to
  // both mic gain and overall spectral tilt — important because phone AGC hugely
  // amplifies low rumble (traffic/fans/handling), which is exactly what fools a
  // global comparison into "hearing" bass notes.
  const LC_R = 7, LC_GUARD = 1;                  // neighbourhood = ±7 semitones, ignoring immediate neighbours (own spectral leakage)
  const LC_PRESENT = 3.0;                        // best contrast below this ⇒ nothing is being played at all
  const LC_CAND = 1.3;                           // per-note floor; deliberately low so a quiet inner voice beside two loud ones survives
  const localAvgSal = (m) => {
    let sum = 0, n = 0;
    for (let k = m - LC_R; k <= m + LC_R; k++) {
      if (k < LO || k > HI || Math.abs(k - m) <= LC_GUARD) continue;
      sum += sal[k]; n++;
    }
    return n ? sum / n : 0;
  };
  const contrast = {};
  let bestContrast = 0;
  for (let m = LO; m <= HI; m++) {
    const la = localAvgSal(m);
    contrast[m] = la > 0 ? sal[m] / la : 0;
    if (contrast[m] > bestContrast) bestContrast = contrast[m];
  }
  if (bestContrast < LC_PRESENT) return [];      // silence/noise only — report nothing rather than inventing a chord
  // keep notes that are a clear local peak AND a healthy fraction of the strongest.
  // A beginner rarely strikes every note of a chord at even loudness — the inner
  // or top voice is often noticeably softer than the thumb/root — so this is kept
  // fairly forgiving on purpose; the ghost filters below do the precision work.
  const REL = 0.22;                              // ≥22% of the loudest note's salience
  // Chord TONES are harmonically related by design (a fifth's own 2nd harmonic
  // sits almost exactly where its root's 3rd harmonic lands, a third's 2nd
  // harmonic near the root's 5th, etc.) — a semitone gap like that isn't one of
  // the octave-ish GHOST intervals checked below, so on its own a genuinely
  // played root note can make an UNPLAYED fifth/third look like it has real
  // salience purely from borrowed harmonic energy, even though nothing is
  // actually sounding at that note's own fundamental. Requiring a candidate's
  // bare fundamental (fund[m], the h=1 term) to carry a real share of its total
  // salience — not just its higher harmonics — rejects that phantom directly:
  // a genuinely struck note always has a present fundamental, a borrowed-
  // harmonic phantom almost never does.
  const FUND_SHARE_MIN = 0.15;
  const cands = [];
  for (let m = LO; m <= HI; m++) {
    const s = sal[m];
    if (s < maxSal * REL) continue;
    if (s < (sal[m - 1] || 0) || s < (sal[m + 1] || 0)) continue; // must be a local max
    if ((fund[m] || 0) < s * FUND_SHARE_MIN) continue;
    if (contrast[m] < LC_CAND) continue;          // smeared/tilt energy, not a note of its own
    cands.push({ m, s });
  }
  // semitone offsets at which one note's harmonics land on another (octave, +fifth, 2-oct, +3rd, ...)
  const GHOST = [12, 19, 24, 28, 31];
  // (a) upper harmonic ghost: a higher candidate fully explained by a much louder lower note → drop it.
  //     But if its OWN fundamental bin is clearly present, it's a real (often octave-doubled) note
  //     that just happens to sit on a ghost interval — keep it, mirroring the fundamental-strength
  //     check filter (b) already uses below, instead of discarding it on salience alone.
  let kept = cands.filter(c => !cands.some(o =>
    o.m < c.m && o.s > c.s * 1.6 && GHOST.includes(c.m - o.m) && (fund[c.m] || 0) < 0.45 * (fund[o.m] || 0)));
  // (b) subharmonic ghost: a LOWER candidate whose own fundamental is barely there, sitting a
  //     harmonic interval below a real note (it's that note's even-harmonic echo) → drop it.
  //     A genuinely-played bass note keeps a strong fundamental, so it survives.
  kept = kept.filter(c => !kept.some(o => GHOST.includes(o.m - c.m) && (fund[c.m] || 0) < 0.4 * (fund[o.m] || 0)));
  kept.sort((a, b) => b.s - a.s);               // strongest first
  return kept.slice(0, 6).sort((a, b) => a.m - b.m).map(c => midiToNoteName(c.m)); // 6 = room for tension/added-note chords, not just triads
}

// median of a small array (smooths pitch jitter before we commit to a note)
export function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function centsFromPC(freq, targetPC) {
  if (!freq || freq <= 0) return 9999;
  const m = 69 + 12 * Math.log2(freq / 440);            // detected pitch as float MIDI
  const semi = _NOTE_NAMES.indexOf(targetPC);           // 0..11
  if (semi < 0) return 9999;
  const base = Math.round((m - semi) / 12) * 12 + semi; // nearest MIDI of that pitch class
  return (m - base) * 100;
}
// How far off a note may be and still count as correct, and how far the
// auto-tuning may drift to follow a piano that's consistently flat/sharp.
export const PITCH_TOL_CENTS = 95;   // wide slack (~0.95 semitone) so out-of-tune pianos still count
export const TUNE_OFFSET_CAP = 45;   // follow pianos that sit consistently flat/sharp up to ±45 cents

export let _practiceStop = { midi: null, mic: null };
/* Both listeners now run TOGETHER (see acquireListener), which means one
   physical press can be reported twice: a MIDI keyboard's own speaker, or the
   app's synth playing the note back, is audible to the microphone. A pitch
   class that arrives twice from DIFFERENT sources inside this window is the
   same press heard twice, not two presses — 140ms is far shorter than any
   deliberate repeat of the same note, so nothing real is ever swallowed. */
export const DUP_WINDOW_MS = 140;
export async function startMidiListener(onDetect, onReady) {
  if (!navigator.requestMIDIAccess) return false;
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    let count = 0;
    const attach = () => {
      count = 0;
      for (const inp of access.inputs.values()) {
        count++;
        inp.onmidimessage = (m) => {
          const s = m.data[0], n = m.data[1], v = m.data[2];
          // MIDI is digital → exact pitch (freq:null = match strictly)
          if ((s & 0xf0) === 0x90 && v > 0) onDetect({ note: midiToNoteName(n), freq: null, source: "midi", vel: v });
        };
      }
    };
    attach();
    access.onstatechange = attach;
    // No device attached: report failure so the caller knows there is no MIDI,
    // but the caller now starts the microphone REGARDLESS of this answer —
    // a learner with a MIDI controller plugged in may still be playing an
    // acoustic piano, and the old either/or silently switched one of them off.
    if (!count) { access.onstatechange = null; return false; }
    if (onReady) onReady();
    _practiceStop.midi = () => {
      try { for (const inp of access.inputs.values()) inp.onmidimessage = null; access.onstatechange = null; } catch (e) {}
    };
    return true;
  } catch (e) { return false; }
}
export async function startMicListener(onDetect, onReady, onError, opts) {
  opts = opts || {};
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }, // AGC boosts soft notes so light presses register
    });
    const ac = getAC();
    const src = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    let raf = 0;
    if (opts.poly) {
      // ── Polyphonic (chord) path: onset-triggered harmonic-summation ──
      analyser.fftSize = 16384;                 // ~2.7 Hz/bin @44.1k — fine enough to split chord tones
      analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
      const time = new Float32Array(analyser.fftSize);
      const db = new Float32Array(analyser.frequencyBinCount);
      const mag = new Float32Array(analyser.frequencyBinCount);
      const captureNotes = () => {
        analyser.getFloatFrequencyData(db);      // dB → linear magnitude
        for (let i = 0; i < db.length; i++) { const v = db[i]; mag[i] = v <= -160 ? 0 : Math.pow(10, v / 20); }
        // Drop any note that's an echo of audio WE just played — the demo
        // preview (which can still be ringing when Practice Mode opens) or the
        // "correct!" confirmation chime, both routed through playPianoNote,
        // which already blacklists its own frequency band via _accMarkSuppress.
        // The monophonic listener already respects that blacklist; this path
        // didn't, which is exactly how a chord could grade itself "correct"
        // before the learner has touched a key.
        return detectPolyNotes(mag, ac.sampleRate, analyser.fftSize).filter(n => !_accIsSuppressed(NF[n]));
      };
      // A real chord strike is never perfectly simultaneous across fingers, and
      // the first ~90ms is dominated by hammer/attack noise that muddies the
      // harmonic read — so ONE instantaneous snapshot systematically misses
      // staggered or quieter notes (usually the exact ones a beginner struggles
      // with). Take two snapshots per strike instead and union whatever's newly
      // seen; the caller (handlePlayedNote) already no-ops a repeat of a note
      // it already matched, so re-seeing the same note across snapshots is safe.
      const CAPTURE_OFFSETS = [95, 230];
      // ONSET WINDOW: the analyser's time buffer is the full fftSize — 16384
      // samples ≈ 370ms — so an RMS taken over all of it is far too smeared to
      // show an attack at all: a struck note only nudges that average, which is
      // why a "loud enough" test alone let steady room noise trip the detector.
      // Measure the most recent ~46ms instead, where a real attack is a genuine
      // step change, and require BOTH loudness over the room floor AND a sharp
      // rise. Steady rumble (fans, traffic, handling) is loud but never jumps,
      // so it stops triggering captures entirely — which matters because that's
      // the only moment noise ever gets a chance to be read as notes.
      const ONSET_WIN = 2048;
      let floor = 0.004, armed = true, captures = [], seenThisOnset = null, lastFire = 0, prevRms = 0;
      const tick = () => {
        const t = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
        analyser.getFloatTimeDomainData(time);
        let rms = 0;
        for (let i = time.length - ONSET_WIN; i < time.length; i++) rms += time[i] * time[i];
        rms = Math.sqrt(rms / ONSET_WIN);
        floor = floor * 0.995 + rms * 0.005;     // slow EMA of the room/noise floor
        // a chord ATTACK = a sharp RISE that also clears the room floor by a wide margin
        if (armed && !captures.length && rms > Math.max(0.02, floor * 6) && rms > prevRms * 1.5 && (t - lastFire) > 220) {
          captures = CAPTURE_OFFSETS.map(off => t + off);
          seenThisOnset = new Set();
          armed = false;                         // disarm right at the attack, not after the first capture
        }
        prevRms = rms;
        if (captures.length && t >= captures[0]) {
          captures.shift();
          captureNotes().forEach(n => seenThisOnset.add(n));
          if (!captures.length) {                // last snapshot of this strike → report the whole chord at once
            lastFire = t;
            const all = Array.from(seenThisOnset);
            seenThisOnset = null;
            // Always report as a poly batch (even a single note) so the grader can
            // tell "one lone note was heard" from "several notes struck together" —
            // block-chord practice needs that distinction to reject stray blips.
            if (all.length) onDetect({ note: all[0], notes: all, freq: null, source: "mic", poly: true });
          }
        }
        if (!armed && !captures.length && rms < Math.max(0.008, floor * 1.6)) armed = true; // re-arm once it quiets
        raf = requestAnimationFrame(tick);
      };
      if (onReady) onReady();
      raf = requestAnimationFrame(tick);
    } else {
      // ── Monophonic path (default): autocorrelation, best one note at a time ──
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const db = new Float32Array(analyser.frequencyBinCount);
      let last = null, stable = 0, silence = 2, fired = false;
      const recent = []; // last few raw frequencies → median smooths jitter & octave glitches
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let f = autoCorrelate(buf, ac.sampleRate);
        if (f > 0 && _accIsSuppressed(f)) f = -1; // ignore the game's own backing track, not a real key press
        const note = f > 0 ? freqToNoteName(f) : null;
        if (note) {
          silence = 0;
          recent.push(f); if (recent.length > 4) recent.shift();
          // PITCH-STABILITY GATE: compare raw frequency (not just the quantized note
          // name) within a 30-cent window. A struck piano string holds dead-steady
          // once it rings; a sung/hummed/spoken note wanders — even gentle vibrato is
          // 50+ cents — so anything that drifts resets the streak instead of accumulating.
          if (last != null && Math.abs(1200 * Math.log2(f / last)) < 30) { stable++; } else { last = f; stable = 1; fired = false; }
          // fire once per fresh, held-steady note (2 frames ≈ 93ms — faster and more
          // forgiving of a quieter/noisier signal than requiring a 3rd frame) — still
          // fast enough for legato/fast playing, since a pitch change re-arms even
          // without a gap
          if (stable >= 2 && !fired) {
            const med = median(recent.slice(-3));
            const medNote = freqToNoteName(med) || note;
            analyser.getFloatFrequencyData(db);
            if (!hasFormantSpike(db, ac.sampleRate, analyser.fftSize, med)) {
              fired = true;
              onDetect({ note: medNote, freq: med, source: "mic" });
            }
          }
        } else {
          if (silence < 10) silence++;
          if (silence >= 3) { last = null; stable = 0; fired = false; recent.length = 0; } // brief gap re-arms repeats
        }
        raf = requestAnimationFrame(tick);
      };
      if (onReady) onReady();
      raf = requestAnimationFrame(tick);
    }
    _practiceStop.mic = () => {
      try { cancelAnimationFrame(raf); src.disconnect(); stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    };
    return true;
  } catch (e) { if (onError) onError(e); return false; }
}
export function stopPracticeListeners() {
  if (_practiceStop.midi) { try { _practiceStop.midi(); } catch (e) {} _practiceStop.midi = null; }
  if (_practiceStop.mic) { try { _practiceStop.mic(); } catch (e) {} _practiceStop.mic = null; }
}

/* ════════════════════════════════════════════════════════════
   PLAY-ALONG — falling-notes song mode (the headline feature of
   Synthesia / Simply Piano / Yousician / 小叶子, built on the same
   pitch detection + piano synth + gamification we already have).
════════════════════════════════════════════════════════════ */
export function noteToMidi(n) {
  const m = n.match(/^([A-G]#?)(\d)$/);
  if (!m) return 0;
  return (parseInt(m[2], 10) + 1) * 12 + _NOTE_NAMES.indexOf(m[1]);
}
// a stable, pleasant hue per pitch class for the falling lanes
export function laneHue(note) { return 320 + (_NOTE_NAMES.indexOf(pcOf(note)) * 2) % 25; }
// rounded-rect path helper for the canvas note blocks
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const SONG_LEAD = 2.4;
export const SONG_HITWINDOW = 0.45;  // generous on purpose (forgiving, like the tuning work)
export const SONG_PERFECT = 0.14;    // tighter window that earns a "Perfect"
export const SONG_DEBOUNCE_MS = 130; // min gap between same-pitch hits — stops one press chain-hitting 2–3 notes
export const SONG_ECHO_MS = 350;     // after a tap, ignore the mic hearing that same note (the app's own sound)
export const SONG_MISSWINDOW = 0.5;

// Heuristic melody fingering — NOT a lookup against verified pedagogy (unlike
// fingersForNotes/FINGERINGS_RH/LH just above, which only cover named
// scales/chords and return null for a real song's melody). Walks the
// interval between each pair of consecutive notes and moves one finger in
// that direction (RH: pitch up = higher finger, toward the pinky; LH
// mirrored, since its thumb sits on the high side); when a run would need a
// 6th finger, it re-anchors on the edge finger that leaves room to keep
// going, standing in for a real thumb-under/finger-crossing position shift.
// Always returns a valid 1-5 finger per note; it won't always match exactly
// how a teacher would finger the same passage.
export function heuristicFingers(notes, hand = "right") {
  const midis = (notes || []).map(noteToMidi);
  if (!midis.length) return [];
  const dir0 = midis.length > 1 ? Math.sign((hand === "left" ? -1 : 1) * (midis[1] - midis[0])) : 0;
  const fingers = [dir0 > 0 ? 1 : dir0 < 0 ? 5 : 3];
  for (let i = 1; i < midis.length; i++) {
    const semis = midis[i] - midis[i - 1];
    const dir = (hand === "left" ? -1 : 1) * semis;
    let f = fingers[i - 1] + Math.round(dir * 7 / 12); // semitones -> ~diatonic finger-steps
    if (f < 1) f = dir < 0 ? 5 : 1;
    else if (f > 5) f = dir > 0 ? 1 : 5;
    fingers.push(f);
  }
  return fingers;
}

// Diatonic triad qualities by scale degree (I..vii), major and natural minor.
const _DEG_QUALITY_MAJ = ["major", "minor", "minor", "major", "major", "minor", "dim"];
const _DEG_QUALITY_MIN = ["minor", "dim", "major", "minor", "minor", "major", "major"];
// Detect a song's key by fitting the melody against all 24 keys, weighting
// each pitch class by how LONG it sounds rather than how often it appears.
//
// The previous version simply took the last note as the tonic. That reads
// well for tunes that end where they started, but these arrangements often
// don't: Jingle Bells here ends on G while using only white keys, so it was
// labelled G major — a key whose signature demands F♯ — against a melody
// that plays F♮ throughout. A wrong key is not a cosmetic problem: it prints
// the wrong key signature and then an accidental on every note that
// disagrees with it. Ending on the tonic is still a real cue, so it stays,
// as a bonus rather than as the whole answer.
export function detectSongKey(song) {
  const seq = (song.seq || []).filter(([n]) => n !== "R");
  if (!seq.length) return { root: 0, minor: false };
  const w = new Array(12).fill(0);
  for (const [n, d] of seq) { const p = pcIdx(pcOf(n)); if (p >= 0) w[p] += (+d || 1); }
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const lastPc = pcIdx(pcOf(seq[seq.length - 1][0]));
  const firstPc = pcIdx(pcOf(seq[0][0]));
  let best = null;
  for (let root = 0; root < 12; root++) {
    for (const minor of [false, true]) {
      const steps = minor ? SCALE_DEF["natural minor"] : SCALE_DEF.major;
      let inKey = steps.reduce((sum, x) => sum + w[(root + x) % 12], 0);
      // a raised 7th is ordinary in a minor key (harmonic minor), not an error
      if (minor) inKey += w[(root + 11) % 12];
      // A note the key can't contain is the strongest evidence AGAINST that
      // key, so it counts against the score harder than an in-key note counts
      // for it. Without this the "ends on the tonic" bonus can carry a key
      // the melody plainly contradicts — a white-key tune ending on G was
      // being called G major even though it plays F♮ throughout.
      const out = (total - inKey) / total;
      let score = inKey / total - 1.6 * out;
      score += 0.30 * (w[root] / total);                       // tonic weight
      score += 0.12 * (w[(root + 7) % 12] / total);            // dominant weight
      score += 0.10 * (w[(root + (minor ? 3 : 4)) % 12] / total); // the third decides major vs minor
      if (lastPc === root) score += 0.22;                      // ending on the tonic
      if (firstPc === root) score += 0.06;
      if (!best || score > best.score) best = { score, root, minor };
    }
  }
  return { root: best.root, minor: best.minor };
}
// Generate a simple left-hand accompaniment for a song that has no authored
// second part of its own (songs-data.ts is a single melody line — see the
// header comment below). This is a harmonization HEURISTIC, not real chord
// inference: per bar, it scores each of the 7 diatonic triads in the song's
// detected key by how much of that bar's melody (weighted by note length)
// falls on one of the triad's own tones, favors staying on the previous
// bar's chord (harmonic inertia) and landing on I/V for the final bar
// (cadence), then renders the winner as a classic beginner "oom-pah" bass:
// root on beat 1, 5th at the bar's midpoint — one octave (3) below the
// melody's own C4 floor. Returns [{note, beat, dur}, ...] in beat-space,
// matching the units expandSong() already uses for the melody itself.
export function generateAccompaniment(song, pickup = 0) {
  const timeSig = SONG_TIMESIG[song.id] || "4/4";
  const beatsPerBar = parseInt(String(timeSig).split("/")[0], 10) || 4;
  const key = detectSongKey(song);
  const scaleSteps = key.minor ? SCALE_DEF["natural minor"] : SCALE_DEF.major;
  const qualities = key.minor ? _DEG_QUALITY_MIN : _DEG_QUALITY_MAJ;
  const degreeRoots = scaleSteps.map(s => (key.root + s) % 12);

  let beat = 0;
  const melNotes = [];
  for (const [note, dur] of song.seq) {
    if (note !== "R") melNotes.push({ pc: pcIdx(pcOf(note)), beat, dur });
    beat += dur;
  }
  const totalBeats = beat;
  if (!melNotes.length || totalBeats < 1) return [];

  const events = [];
  let prevDeg = 0;
  // Bars are walked from the pickup onward so the accompaniment's own bars
  // line up with the ones the staff actually draws — an accompaniment on a
  // different bar grid than the melody it accompanies is simply wrong.
  const barStarts = [];
  if (pickup > 0) barStarts.push({ at: 0, len: pickup });
  for (let b = pickup; b < totalBeats - 1e-6; b += beatsPerBar) barStarts.push({ at: b, len: Math.min(beatsPerBar, totalBeats - b) });
  for (const { at: barStart, len: barLen } of barStarts) {
    if (barLen < 0.5) continue; // trailing sliver — not worth a chord of its own
    const weight = new Array(12).fill(0);
    for (const n of melNotes) if (n.beat >= barStart - 1e-9 && n.beat < barStart + barLen - 1e-9) weight[n.pc] += n.dur;
    let bestScore = -1, bestDeg = prevDeg;
    for (let deg = 0; deg < 7; deg++) {
      const triad = CHORD_DEF[qualities[deg]].map(s => (degreeRoots[deg] + s) % 12);
      let score = triad.reduce((s, pc) => s + weight[pc], 0);
      if (deg === prevDeg) score += 0.35; // harmonic inertia
      if (barStart + barLen >= totalBeats - 1e-9 && (deg === 0 || deg === 4)) score += 0.5; // cadence
      if (score > bestScore) { bestScore = score; bestDeg = deg; }
    }
    prevDeg = bestDeg;
    const rootPc = CHROMA[degreeRoots[bestDeg]], fifthPc = CHROMA[(degreeRoots[bestDeg] + 7) % 12];
    // Split the bar exactly in half — root then fifth. The old version gave
    // the root a flat 2 beats and started the fifth at the bar's midpoint,
    // which in any meter that isn't 4/4 made the two OVERLAP and the bar add
    // up to more than a bar (3/4: a 2-beat root under a fifth starting at
    // 1.5, totalling 3.5 beats in a 3-beat bar).
    const halfBar = +(barLen / 2).toFixed(6);
    if (halfBar < 0.24) { events.push({ note: rootPc + "3", beat: barStart, dur: barLen }); continue; }
    events.push({ note: rootPc + "3", beat: barStart, dur: halfBar });
    events.push({ note: fifthPc + "3", beat: +(barStart + halfBar).toFixed(6), dur: +(barLen - halfBar).toFixed(6) });
  }
  return events;
}

// Song library. seq = [noteName | "R", durationInBeats]. All notes live in the
// C4..B5 range the on-screen keyboard + synth cover. Public-domain melodies only.
// Get note type name from beat duration
export function noteTypeName(durBeats) {
  if (durBeats >= 4) return "w";     /* whole note (semibreve) */
  if (durBeats >= 2) return "h";     /* half note (minim) */
  if (durBeats >= 1) return "q";     /* quarter note (crotchet) */
  if (durBeats >= 0.5) return "e";   /* eighth note (quaver) */
  if (durBeats >= 0.25) return "s";  /* 16th note (semiquaver) */
  return "x";                         /* 32nd note (demisemiquaver) */
}
// Generate a simple bass-line (left-hand accompaniment) from a melody song.
// Alternates root/5th for musical variety, pitched in octaves 2-3.
export function generateBassLine(song) {
  const melodyNotes = (song.seq || []).filter(([n]) => n !== "R");
  if (!melodyNotes.length) return [];
  const rootPC = pcOf(melodyNotes[0][0]);
  const rootIdx = CHROMA.indexOf(rootPC);
  if (rootIdx < 0) return [];
  const fifthPC = CHROMA[(rootIdx + 7) % 12];
  const pat = [rootPC + "2", fifthPC + "2", rootPC + "3", fifthPC + "2"];
  const bassSeq = []; let pi = 0;
  for (const [n, d] of song.seq) {
    if (n !== "R") { bassSeq.push([pat[pi % pat.length], d]); pi++; }
    else bassSeq.push(["R", d]);
  }
  return bassSeq;
}
// Expand a song into timed note objects + the set of lanes (distinct pitches).
//
// hand: "right" (default) = the melody, i.e. the right-hand part. "left" = the
// LEFT-HAND part on its own, not the melody moved to the other hand — that's
// what "practise hands separately" means, and it's the half a learner
// actually can't already read. "both" = the two parts together.
//
// Accepts either expandSong(song, "left") or expandSong(song, {hand:"left"}).
export function expandSong(song, opts) {
  const handArg = typeof opts === "string" ? opts : (opts && opts.hand) || "right";
  const handMode = handArg === "left" ? "left" : handArg === "both" ? "both" : "right";
  const spb = 60 / song.bpm; // seconds per beat
  const timeSig = SONG_TIMESIG[song.id] || "4/4";
  const beatsPerBar = parseInt(String(timeSig).split("/")[0], 10) || 4;
  const pickup = pickupBeatsOf(song.seq, beatsPerBar);
  let beat = 0;
  const melodyNotes = [];
  for (const [note, dur] of song.seq) {
    if (note !== "R") melodyNotes.push({ note, t: beat * spb, beat, durBeats: dur, durSec: Math.max(0.18, dur * spb * 0.92), hit: false, missed: false, lane: 0, hand: "right" });
    beat += dur;
  }
  // The left-hand part comes from generateAccompaniment(), which picks a real
  // chord per BAR by scoring the seven diatonic triads against that bar's own
  // melody (see there). The older generateBassLine() — still exported, nothing
  // else calls it — put one bass note under every single melody note at the
  // melody's own rhythm and never changed chord for the whole song, so an
  // eighth-note run got an eighth-note bass and the harmony never moved.
  const bassNotes = generateAccompaniment(song, pickup).map(e => ({
    note: e.note, t: e.beat * spb, beat: e.beat, durBeats: e.dur,
    durSec: Math.max(0.18, e.dur * spb * 0.92), hit: false, missed: false, lane: 0, hand: "left",
  }));
  const notes = handMode === "left" ? bassNotes
    : handMode === "both" ? [...melodyNotes, ...bassNotes].sort((a, b) => a.t - b.t)
    : [...melodyNotes];
  // Finger numbers, computed independently per hand-voice in its own
  // chronological order — the two parts are two independent hands, each with
  // their own finger progression.
  const rightNotes = notes.filter(n => n.hand === "right");
  const leftNotes = notes.filter(n => n.hand === "left");
  const rf = heuristicFingers(rightNotes.map(n => n.note), "right");
  const lf = heuristicFingers(leftNotes.map(n => n.note), "left");
  rightNotes.forEach((n, i) => { n.finger = rf[i]; });
  leftNotes.forEach((n, i) => { n.finger = lf[i]; });
  const lanes = Array.from(new Set(notes.map(n => n.note))).sort((a, b) => noteToMidi(a) - noteToMidi(b));
  for (const n of notes) n.lane = lanes.indexOf(n.note);
  const lastT = notes.reduce((m, n) => Math.max(m, n.t), 0);
  // Engrave both voices once, here, where the notes are — the reading staff
  // then just draws the window it needs instead of re-deriving bar/tie/rest
  // structure on every HUD tick. srcIdx points back into `notes`, so a
  // glyph can always find out whether its note has been hit or missed.
  const idxOf = new Map(notes.map((n, i) => [n, i]));
  const engrave = (voice) => buildNotation(
    voice.map(n => ({ note: n.note, beat: n.beat, durBeats: n.durBeats })), beatsPerBar, pickup
  ).map(g => ({ ...g, srcIdx: g.srcIdx == null ? null : idxOf.get(voice[g.srcIdx]) }));
  const notation = {
    beatsPerBar, pickup, timeSig,
    right: engrave(rightNotes),
    left: engrave(leftNotes),
  };
  return { notes, lanes, total: notes.length, dur: beat * spb, lastT, notation, hand: handMode };
}
// Objective technique descriptors derived straight from a song's own note
// sequence — no new authoring/tagging needed. songs-data.ts has no hand or
// skill field at all (every song is a single melody line), so this is the
// honest ceiling for "recommend by technique" without commissioning new
// arrangements with a real second (left-hand) part.
export function songTechniqueProfile(song) {
  const notes = (song.seq || []).filter(([n]) => n !== "R").map(([n]) => n);
  if (!notes.length) return null;
  const midis = notes.map(noteToMidi).filter(m => m > 0);
  const range = midis.length ? Math.max(...midis) - Math.min(...midis) : 0;
  let leapSum = 0, maxLeap = 0;
  for (let i = 1; i < midis.length; i++) {
    const d = Math.abs(midis[i] - midis[i - 1]);
    leapSum += d; if (d > maxLeap) maxLeap = d;
  }
  const avgLeap = midis.length > 1 ? leapSum / (midis.length - 1) : 0;
  const blackPct = Math.round(notes.filter(n => n.includes("#")).length / notes.length * 100);
  return { range, avgLeap, maxLeap, blackPct, noteCount: notes.length };
}
// Estimate a 1/2/3 diff tier for a song with no human-assigned difficulty (AI-generated
// melodies) from its own songTechniqueProfile(). Thresholds are calibrated against the
// 192-song curated library's own diff:1/2/3 interval statistics (median range 9/12/14
// semitones, avgLeap 2.0/2.3/2.7, maxLeap 5/5/7) and deliberately biased toward the lower
// edge of each tier, so an ambiguous AI-generated song is never rated easier than it plays.
export function estimateSongDifficulty(profile) {
  if (!profile) return 1;
  const { range, avgLeap, maxLeap } = profile;
  let diff = 1;
  if (range >= 11 || avgLeap >= 2.3 || maxLeap >= 7) diff = 2;
  if (range >= 14 || avgLeap >= 2.7 || maxLeap >= 10) diff = 3;
  return diff;
}

export const DRILL_KEYS = [
  { pc: "C",  nm: "C"  }, { pc: "G",  nm: "G"  }, { pc: "D",  nm: "D"  },
  { pc: "A",  nm: "A"  }, { pc: "E",  nm: "E"  }, { pc: "B",  nm: "B"  },
  { pc: "F#", nm: "F♯" }, { pc: "C#", nm: "D♭" }, { pc: "G#", nm: "A♭" },
  { pc: "D#", nm: "E♭" }, { pc: "A#", nm: "B♭" }, { pc: "F",  nm: "F"  },
];
// Lay a list of pitch classes out ascending into real octaves from startOct,
// bumping the octave each time we wrap past B→C.
export function _ascNotes(pcs, startOct = 4) {
  const out = []; let oct = startOct, prev = -1;
  for (const pc of pcs) {
    const idx = CHROMA.indexOf(pc);
    if (prev >= 0 && idx <= prev) oct++;
    out.push(pc + oct); prev = idx;
  }
  return out;
}
export function _drillSeq(noteNames) {
  return noteNames.map((n, i) => [n, i === noteNames.length - 1 ? 2 : 1]);
}
// One-octave scale, up then back down (classic practice shape).
export function makeScaleSong(rootPC, rootNm, scaleType, label, bpm = 84) {
  const pcs = scaleNotesOf(rootPC, scaleType);
  const asc = _ascNotes(pcs, 4);
  const all = [...asc, pcs[0] + "5", ...asc.slice().reverse()];
  return {
    id: "sc_" + scaleType.replace(/\s+/g, "") + "_" + rootPC, drill: true, cat: "scale", diff: 1, bpm,
    th: rootNm + " " + label.th, en: rootNm + " " + label.en, zh: rootNm + label.zh, seq: _drillSeq(all),
  };
}
// Broken chord (arpeggio) up then down — triad adds the octave, 7th stays root-3-5-7.
export function makeChordSong(rootPC, rootNm, chordType, label, bpm = 80) {
  const pcs = chordNotesOf(rootPC, chordType);
  const asc = _ascNotes(pcs, 4);
  const all = pcs.length >= 4
    ? [...asc, ...asc.slice(0, -1).reverse()]
    : [...asc, pcs[0] + "5", ...asc.slice().reverse()];
  return {
    id: "ch_" + chordType + "_" + rootPC, drill: true, cat: "chord", diff: 1, bpm,
    th: rootNm + " " + label.th, en: rootNm + " " + label.en, zh: rootNm + label.zh, seq: _drillSeq(all),
  };
}
// Melodic interval played up from five roots, so the ear & hand learn its shape.
export function makeIntervalSong(semi, label, bpm = 72) {
  const roots = ["C4", "D4", "E4", "F4", "G4"];
  const seq = [];
  roots.forEach((r, i) => {
    const top = transposeNotes([r], semi)[0];
    seq.push([r, 1], [top, 1.5]);
    if (i < roots.length - 1) seq.push(["R", 0.5]);
  });
  if (seq.length) seq[seq.length - 1] = [seq[seq.length - 1][0], 2];
  return { id: "iv_" + semi, drill: true, cat: "interval", diff: 1, bpm, th: label.th, en: label.en, zh: label.zh, seq };
}

// scale-type metadata for the Minor sub-selector
export const MINOR_TYPES = [
  { key: "natural minor",  th: "ไมเนอร์แท้",       en: "Natural",  zh: "自然小调",
    lab: { th: "ไมเนอร์แท้",      en: "Natural Minor",  zh: "自然小调" } },
  { key: "harmonic minor", th: "ฮาร์มอนิก",         en: "Harmonic", zh: "和声小调",
    lab: { th: "ฮาร์มอนิกไมเนอร์", en: "Harmonic Minor", zh: "和声小调" } },
  { key: "melodic minor",  th: "เมโลดิก",           en: "Melodic",  zh: "旋律小调",
    lab: { th: "เมโลดิกไมเนอร์",   en: "Melodic Minor",  zh: "旋律小调" } },
];
export const TRIAD_TYPES = [
  { key: "major", th: "เมเจอร์",  en: "Major",      zh: "大三和弦", lab: { th: "เมเจอร์ ไทรแอด",  en: "Major Triad",      zh: "大三和弦" } },
  { key: "minor", th: "ไมเนอร์",  en: "Minor",      zh: "小三和弦", lab: { th: "ไมเนอร์ ไทรแอด",  en: "Minor Triad",      zh: "小三和弦" } },
  { key: "dim",   th: "ดิม",      en: "Dim",        zh: "减三和弦", lab: { th: "ดิมินิช ไทรแอด",  en: "Diminished Triad", zh: "减三和弦" } },
  { key: "aug",   th: "ออก",      en: "Aug",        zh: "增三和弦", lab: { th: "ออกเมนเต็ด",      en: "Augmented Triad",  zh: "增三和弦" } },
];
export const SEVENTH_TYPES = [
  { key: "maj7", th: "Maj7", en: "Maj7", zh: "大七", lab: { th: "เมเจอร์ 7",   en: "Major 7th",      zh: "大七和弦" } },
  { key: "min7", th: "min7", en: "min7", zh: "小七", lab: { th: "ไมเนอร์ 7",   en: "Minor 7th",      zh: "小七和弦" } },
  { key: "7",    th: "Dom7", en: "Dom7", zh: "属七", lab: { th: "โดมินันต์ 7", en: "Dominant 7th",   zh: "属七和弦" } },
  { key: "dim7", th: "dim7", en: "dim7", zh: "减七", lab: { th: "ดิมินิช 7",   en: "Diminished 7th", zh: "减七和弦" } },
];
export const INTERVAL_DEFS = [
  { semi: 1,  th: "คู่ 2 ไมเนอร์ · m2",   en: "Minor 2nd · m2",  zh: "小二度 · m2" },
  { semi: 2,  th: "คู่ 2 เมเจอร์ · M2",   en: "Major 2nd · M2",  zh: "大二度 · M2" },
  { semi: 3,  th: "คู่ 3 ไมเนอร์ · m3",   en: "Minor 3rd · m3",  zh: "小三度 · m3" },
  { semi: 4,  th: "คู่ 3 เมเจอร์ · M3",   en: "Major 3rd · M3",  zh: "大三度 · M3" },
  { semi: 5,  th: "คู่ 4 เพอร์เฟกต์ · P4", en: "Perfect 4th · P4", zh: "纯四度 · P4" },
  { semi: 6,  th: "ไทรโทน · TT",          en: "Tritone · TT",    zh: "三全音 · TT" },
  { semi: 7,  th: "คู่ 5 เพอร์เฟกต์ · P5", en: "Perfect 5th · P5", zh: "纯五度 · P5" },
  { semi: 8,  th: "คู่ 6 ไมเนอร์ · m6",   en: "Minor 6th · m6",  zh: "小六度 · m6" },
  { semi: 9,  th: "คู่ 6 เมเจอร์ · M6",   en: "Major 6th · M6",  zh: "大六度 · M6" },
  { semi: 10, th: "คู่ 7 ไมเนอร์ · m7",   en: "Minor 7th · m7",  zh: "小七度 · m7" },
  { semi: 11, th: "คู่ 7 เมเจอร์ · M7",   en: "Major 7th · M7",  zh: "大七度 · M7" },
  { semi: 12, th: "ออกเทฟ · P8",          en: "Octave · P8",     zh: "八度 · P8" },
];

// Pre-generate every drill once (pure data, cheap, stable ids).
export const MAJOR_SCALE_SONGS = DRILL_KEYS.map(k => makeScaleSong(k.pc, k.nm, "major", { th: "เมเจอร์", en: "Major", zh: "大调" }));
export const MINOR_SCALE_SONGS = MINOR_TYPES.reduce((m, t) => { m[t.key] = DRILL_KEYS.map(k => makeScaleSong(k.pc, k.nm, t.key, t.lab)); return m; }, {});
export const TRIAD_SONGS = TRIAD_TYPES.reduce((m, t) => { m[t.key] = DRILL_KEYS.map(k => makeChordSong(k.pc, k.nm, t.key, t.lab)); return m; }, {});
export const SEVENTH_SONGS = SEVENTH_TYPES.reduce((m, t) => { m[t.key] = DRILL_KEYS.map(k => makeChordSong(k.pc, k.nm, t.key, t.lab)); return m; }, {});
export const INTERVAL_SONGS = INTERVAL_DEFS.map(d => makeIntervalSong(d.semi, d));

export const SIGHT_NOTES = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5"];

export const SIGHT_NOTES_BASS = ["F2","G2","A2","B2","C3","D3","E3","F3","G3","A3","B3","C4"];

export const _LETTER_IDX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Staff position of a LETTER+octave (not a pitch) — a staff line means a
// letter, which is why C♯ and C sit on the identical line and are told apart
// by the accidental printed in front of them, never by height. step 0 = the
// bottom line of the staff (E4 treble, G2 bass).
export function staffStepFor(letter, oct, clef = "treble") {
  const li = _LETTER_IDX[letter];
  if (li == null) return 0;
  const base = clef === "bass" ? (2 * 7 + 4) : (4 * 7 + 2); // G2 (bass) | E4 (treble)
  return oct * 7 + li - base;
}
export function staffStep(note, clef = "treble") {
  const m = note.match(/^([A-G])#?(\d)$/);
  if (!m) return 0;
  return staffStepFor(m[1], parseInt(m[2], 10), clef);
}

/* ── Key signatures & note spelling ──
   Everything below exists so the play-along staff can be read as real
   notation rather than as dots at approximately-right heights: a signature
   the notes are actually spelled against, and accidentals printed only
   where the signature doesn't already account for them. ── */
// Accidentals in a key's signature: + = that many sharps, − = that many
// flats, keyed by tonic pitch class (CHROMA order). Straight off the circle
// of fifths; the enharmonic choice at the far side is the conventional one
// (D♭ major over C♯ major, etc.).
export const KEYSIG_MAJOR = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
export const KEYSIG_MINOR = { 9: 0, 4: 1, 11: 2, 6: 3, 1: 4, 8: 5, 3: 6, 2: -1, 7: -2, 0: -3, 5: -4, 10: -5 };
// The fixed order signature accidentals are written in, and where each sits
// on a TREBLE staff. A bass staff writes the identical shape two steps
// lower, which is exactly how the two clefs relate (see staffStepFor).
export const SIG_SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
export const SIG_FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
export const SIG_SHARP_STEPS = { F: 8, C: 5, G: 9, D: 6, A: 3, E: 7, B: 4 };
export const SIG_FLAT_STEPS = { B: 4, E: 7, A: 3, D: 6, G: 2, C: 5, F: 1 };
export const KEY_NAME_MAJOR = { 0: "C", 7: "G", 2: "D", 9: "A", 4: "E", 11: "B", 6: "F♯", 1: "D♭", 8: "A♭", 3: "E♭", 10: "B♭", 5: "F" };
export const KEY_NAME_MINOR = { 9: "Am", 4: "Em", 11: "Bm", 6: "F♯m", 1: "C♯m", 8: "G♯m", 3: "E♭m", 2: "Dm", 7: "Gm", 0: "Cm", 5: "Fm", 10: "B♭m" };
// A song's signature, derived from the same detectSongKey() the left-hand
// accompaniment is harmonized against — so what's printed and what's played
// can never disagree about the key.
export function keySignatureOf(song) {
  const k = detectSongKey(song);
  const sig = (k.minor ? KEYSIG_MINOR : KEYSIG_MAJOR)[k.root];
  const name = (k.minor ? KEY_NAME_MINOR : KEY_NAME_MAJOR)[k.root] || CHROMA[k.root] || "C";
  return { sig: sig == null ? 0 : sig, name, root: k.root, minor: k.minor };
}
// The staff steps a signature's accidentals occupy, in writing order.
export function keySignatureMarks(sig, clef = "treble") {
  const shift = clef === "bass" ? -2 : 0;
  const n = Math.abs(sig);
  const order = sig >= 0 ? SIG_SHARP_ORDER : SIG_FLAT_ORDER;
  const steps = sig >= 0 ? SIG_SHARP_STEPS : SIG_FLAT_STEPS;
  return order.slice(0, n).map(L => ({ letter: L, step: steps[L] + shift, glyph: sig >= 0 ? "♯" : "♭" }));
}
const _SPELL_ORDER = ["C", "D", "E", "F", "G", "A", "B"];
// Spell a note the way this key signature would actually write it, and say
// whether an accidental has to be printed in front of it.
//
// songs-data.ts names every black key as a sharp, but a flat key genuinely
// spells them as flats — F♯ inside E♭ major is really G♭, a different LINE of
// the staff, not just a different name. And a note the signature already
// alters needs no accidental of its own, which is the entire point of having
// a signature; printing one on every black key (or none at all, as before)
// are both simply wrong notation.
export function spellNoteInKey(note, sig) {
  const m = String(note == null ? "" : note).match(/^([A-G])(#?)(\d)$/);
  if (!m) return null;
  const sharped = m[2] === "#";
  let letter = m[1], oct = parseInt(m[3], 10), acc = null; // acc: "#" | "b" | "n" | null
  const sharpLetters = SIG_SHARP_ORDER.slice(0, Math.max(0, sig));
  const flatLetters = SIG_FLAT_ORDER.slice(0, Math.max(0, -sig));
  if (sharped) {
    if (sig < 0) {
      const i = _SPELL_ORDER.indexOf(letter);
      letter = _SPELL_ORDER[(i + 1) % 7];        // C♯→D♭, A♯→B♭ … the letter above
      if (letter === "C") oct += 1;              // B♯ can't arise from our data, but stay honest
      acc = flatLetters.includes(letter) ? null : "b";
    } else {
      acc = sharpLetters.includes(letter) ? null : "#";
    }
  } else if (sharpLetters.includes(letter) || flatLetters.includes(letter)) {
    acc = "n";                                   // signature alters this letter — cancel it explicitly
  }
  return { letter, oct, acc };
}
/* ── Note values & engraving ──
   The full set a beginner score uses, longest first, measured in beats where
   a quarter note = 1: ตัวกลม whole · ตัวขาว half · ตัวดำ quarter · เขบ็ต
   1/2/3 ชั้น eighth/16th/32nd, each with its dotted form (a dot adds half
   the note's own value again). ── */
export const NOTE_VALUES = [
  { beats: 4,     head: "open",   stem: false, flags: 0, dots: 0, name: "whole" },
  { beats: 3,     head: "open",   stem: true,  flags: 0, dots: 1, name: "dotted half" },
  { beats: 2,     head: "open",   stem: true,  flags: 0, dots: 0, name: "half" },
  { beats: 1.5,   head: "closed", stem: true,  flags: 0, dots: 1, name: "dotted quarter" },
  { beats: 1,     head: "closed", stem: true,  flags: 0, dots: 0, name: "quarter" },
  { beats: 0.75,  head: "closed", stem: true,  flags: 1, dots: 1, name: "dotted eighth" },
  { beats: 0.5,   head: "closed", stem: true,  flags: 1, dots: 0, name: "eighth" },
  { beats: 0.375, head: "closed", stem: true,  flags: 2, dots: 1, name: "dotted 16th" },
  { beats: 0.25,  head: "closed", stem: true,  flags: 2, dots: 0, name: "16th" },
  { beats: 0.125, head: "closed", stem: true,  flags: 3, dots: 0, name: "32nd" },
];
export function noteValueOf(beats) {
  const b = +beats || 1;
  for (const v of NOTE_VALUES) if (b >= v.beats - 0.001) return v;
  return NOTE_VALUES[NOTE_VALUES.length - 1];
}
// Break a duration into real note values, longest first. Anything that isn't
// a single value becomes several TIED values, which is how notation writes a
// duration with no glyph of its own — the pieces always sum to exactly the
// duration asked for, never more and never less.
export function decomposeDur(beats) {
  const out = [];
  let left = +(+beats).toFixed(6);
  let guard = 0;
  while (left > 0.0625 && guard++ < 24) {
    const v = NOTE_VALUES.find(x => x.beats <= left + 1e-6);
    if (!v) break;
    out.push(v);
    left = +(left - v.beats).toFixed(6);
  }
  return out.length ? out : [NOTE_VALUES[NOTE_VALUES.length - 1]];
}
// How many beats of PICKUP (anacrusis) a song starts with — an incomplete
// first measure, borrowed from the last one.
//
// These melodies were authored as playable note streams, not as engraved
// scores, so about half of them don't divide into whole bars from beat 0.
// Where they don't, the leftover is a pickup — but only if aligning that way
// actually agrees with the music: the alignment chosen is whichever one has
// FEWER notes crossing a bar line, since a bar line falling mid-note is the
// signature of a wrongly-placed bar line.
export function pickupBeatsOf(seq, beatsPerBar) {
  const durs = (seq || []).map(([, d]) => +d || 0);
  const total = durs.reduce((a, b) => a + b, 0);
  const leftover = +(total % beatsPerBar).toFixed(6);
  if (!leftover) return 0;
  const crossings = (offset) => {
    let beat = 0, n = 0;
    for (const d of durs) {
      const a = beat - offset, b = beat + d - offset - 1e-9;
      if (a >= -1e-9 && Math.floor(a / beatsPerBar + 1e-9) !== Math.floor(b / beatsPerBar)) n++;
      beat += d;
    }
    return n;
  };
  return crossings(leftover) <= crossings(0) ? leftover : 0;
}
// Engrave one voice: turn {note, beat, durBeats} events into the glyphs a
// score would actually print. Three things happen here that raw durations
// can't express on their own, and all three are why a bar used to add up to
// the wrong amount:
//   • a note running past a bar line is SPLIT at the line into tied pieces
//     (notation never lets a note head cross a bar line),
//   • every gap becomes a REST, decomposed the same way,
//   • the final bar is padded with rests,
// so every bar sums to exactly one bar's worth of time, by construction.
export function buildNotation(events, beatsPerBar, pickup = 0) {
  const glyphs = [];
  // where the bar containing `beat` ends
  const barEndAfter = (beat) => (beat < pickup - 1e-9)
    ? pickup
    : pickup + (Math.floor((beat - pickup) / beatsPerBar + 1e-9) + 1) * beatsPerBar;
  const emit = (kind, note, srcIdx, startBeat, dur) => {
    const pieces = [];
    let b = +startBeat.toFixed(6), left = +(+dur).toFixed(6);
    let guard = 0;
    while (left > 0.0625 && guard++ < 64) {
      const chunk = Math.min(left, +(barEndAfter(b) - b).toFixed(6));
      if (chunk <= 0) break;
      for (const v of decomposeDur(chunk)) { pieces.push({ beat: b, value: v }); b = +(b + v.beats).toFixed(6); }
      left = +(left - chunk).toFixed(6);
    }
    pieces.forEach((p, i) => glyphs.push({
      kind, note, srcIdx, beat: p.beat, dur: p.value.beats, value: p.value,
      // a tie binds the pieces of one held note; a rest is never tied
      tieFrom: kind === "note" && i > 0,
      tieTo: kind === "note" && i < pieces.length - 1,
    }));
  };
  let cursor = 0;
  (events || []).forEach((n, i) => {
    const beat = +(+n.beat).toFixed(6);
    if (beat > cursor + 1e-6) emit("rest", null, null, cursor, +(beat - cursor).toFixed(6));
    emit("note", n.note, i, beat, +n.durBeats || 1);
    cursor = Math.max(cursor, +(beat + (+n.durBeats || 1)).toFixed(6));
  });
  // complete the last bar, so no bar is ever left short
  if (cursor > 0) {
    const end = barEndAfter(cursor - 1e-6);
    if (end > cursor + 1e-6) emit("rest", null, null, cursor, +(end - cursor).toFixed(6));
  }
  return glyphs;
}

/* ── beamRuns ──
   Which flagged notes beam together, and which stand alone with a flag. This
   is the musical half of beaming — kept out of the drawing component so every
   song in the library can be audited against it (see the beaming audit).

   Standard engraving practice, applied here:
     • the beam unit is the metre's beat — a quarter in every x/4 metre, a
       dotted quarter in a compound metre (6/8, 9/8, 12/8);
     • a beam never crosses a bar line, never spans a rest, and never bridges
       a gap in time;
     • in 4/4 a clean run of eighths filling half a bar is beamed as one group
       of four, the way published piano music sets it — but never across the
       middle of the bar, which would bury beat 3;
     • a single flagged note alone in its beam unit keeps its flag.

   `glyphs` are buildNotation() output, in beat order, for ONE voice. Returns
   arrays of indices into that list, each of length >= 2. ── */
export function beamFlagsOf(g) { return (g.value || noteValueOf(g.dur)).flags; }
export function beamRuns(glyphs, opts) {
  const o = opts || {};
  const beatsPerBar = o.beatsPerBar || 4;
  const sigDenom = o.sigDenom || 4;
  const pickup = o.pickup || 0;
  const skip = o.skip || (() => false);
  const beamUnit = (sigDenom === 8 && beatsPerBar % 3 === 0) ? 1.5 : 1;
  // A pickup measure is the TAIL of a notional full bar, so its beat grid is
  // counted BACK from the bar line rather than forward from zero — that is
  // what puts a 3.5-beat pickup's eighths on the beats a full bar gives them.
  const barKeyOf = (beat) => beat < pickup - 1e-9 ? "p" : String(Math.floor((beat - pickup) / beatsPerBar + 1e-9));
  const barBeatOf = (beat) => {
    if (beat < pickup - 1e-9) return beatsPerBar - (pickup - beat);
    const rel = beat - pickup;
    return rel - Math.floor(rel / beatsPerBar + 1e-9) * beatsPerBar;
  };
  const unitKeyOf = (beat) => barKeyOf(beat) + ":" + Math.floor(barBeatOf(beat) / beamUnit + 1e-9);

  // 1. maximal runs of flagged notes sharing a beam unit and touching in time
  const runs = [];
  let cur = [];
  const close = () => { if (cur.length > 1) runs.push(cur); cur = []; };
  for (let i = 0; i < (glyphs || []).length; i++) {
    const g = glyphs[i];
    if (g.kind === "rest" || beamFlagsOf(g) < 1 || skip(g)) { close(); continue; }
    if (cur.length) {
      const prev = glyphs[cur[cur.length - 1]];
      const touching = Math.abs(g.beat - (prev.beat + prev.dur)) < 1e-6;
      if (!touching || unitKeyOf(g.beat) !== unitKeyOf(prev.beat)) close();
    }
    cur.push(i);
  }
  close();

  // 2. in 4/4, two adjacent all-eighth beats inside the same half-bar are
  //    beamed as one group of four
  if (beatsPerBar === 4 && sigDenom === 4) {
    for (let r = 0; r < runs.length - 1; r++) {
      const a = runs[r], b = runs[r + 1];
      if (a.length + b.length !== 4) continue;
      const aFirst = glyphs[a[0]], aLast = glyphs[a[a.length - 1]], bFirst = glyphs[b[0]];
      const allEighths = a.concat(b).every(i => Math.abs(glyphs[i].dur - 0.5) < 1e-6);
      const touching = Math.abs(bFirst.beat - (aLast.beat + aLast.dur)) < 1e-6;
      const start = barBeatOf(aFirst.beat);
      const onHalfBar = Math.abs(start) < 1e-6 || Math.abs(start - 2) < 1e-6;
      if (allEighths && touching && onHalfBar && barKeyOf(aFirst.beat) === barKeyOf(bFirst.beat)) {
        runs.splice(r, 2, a.concat(b));
        r--;
      }
    }
  }
  return runs;
}

/* ── beamLayout ──
   Turns beam groups into drawing instructions. Split out of the staff
   component for the same reason beamRuns is: the geometry is the half a
   reader actually SEES, so it has to be checkable without a browser.

   Per group: one stem direction for all of it, chosen by the note furthest
   from the middle line (the average breaks a tie between two equally far on
   opposite sides); one beam through the ideal stem ends, its slant capped so
   it never reads as a ramp, then pushed outward until no stem in the group
   falls under the minimum length; and extra beams for 16ths and shorter,
   stacked toward the heads, drawn only across the span two neighbours share
   and otherwise cut down to a hook.

   Coordinates come in as plain arrays indexed like the glyph list. Returns
   `info` (glyph index -> the stem override that glyph must draw with) and
   `bars` (the beam parallelograms, in drawing order). ── */
export function beamLayout(runs, geom) {
  const { steps, xs, flags, base, half } = geom;
  const states = geom.states || [];
  // The band the beam has to stay inside. A group spanning a wide interval —
  // the arpeggio figures in Bach's Prelude in C are the real case — pushes its
  // beam a long way from the staff, and without this it lands off the top of
  // the drawing and is simply clipped away.
  const bandTop = geom.bandTop == null ? -Infinity : geom.bandTop;
  const bandBottom = geom.bandBottom == null ? Infinity : geom.bandBottom;
  const info = new Map(), bars = [];
  const thick = half * 0.95, gap = half * 1.55, rx = half * 0.95;

  // Place one group's beam for a given stem direction, and report how far it
  // still escapes the band afterwards, so the caller can compare directions.
  function place(run, up) {
    const dir = up ? -1 : 1;
    const st = run.map(i => steps[i]);
    const ys = st.map(v => base - v * half);
    const sxs = run.map(i => (up ? xs[i] + rx - 0.7 : xs[i] - rx + 0.7));
    const maxFlags = Math.max.apply(null, run.map(i => flags[i]));
    // a beam through the ideal stem ends, its slant capped, then pushed out
    // until no stem in the group falls under the minimum length
    const ideal = half * 6.2, minLen = half * 3.4, floor = half * 2.2;
    const span = sxs[sxs.length - 1] - sxs[0];
    let y1 = ys[0] + dir * ideal, y2 = ys[ys.length - 1] + dir * ideal;
    const maxSlant = Math.min(half * 3.5, Math.abs(span) * 0.28);
    if (Math.abs(y2 - y1) > maxSlant) y2 = y1 + Math.sign(y2 - y1) * maxSlant;
    const yAt = (x) => (Math.abs(span) < 1e-6 ? y1 : y1 + (y2 - y1) * ((x - sxs[0]) / span));
    const clearOf = (k) => (yAt(sxs[k]) - ys[k]) * dir - (maxFlags - 1) * gap;
    let push = 0;
    for (let k = 0; k < run.length; k++) if (clearOf(k) < minLen) push = Math.max(push, minLen - clearOf(k));
    y1 += dir * push; y2 += dir * push;
    // …then pull it back inside the band if it escaped, but never far enough
    // to let the tightest stem in the group collapse onto its note head
    const outBy = up ? bandTop - Math.min(y1, y2) : Math.max(y1, y2) - bandBottom;
    if (outBy > 0) {
      let room = Infinity;
      for (let k = 0; k < run.length; k++) room = Math.min(room, clearOf(k) - floor);
      const move = Math.min(outBy, Math.max(0, room));
      y1 -= dir * move; y2 -= dir * move;
    }
    const escaped = Math.max(0, up ? bandTop - Math.min(y1, y2) : Math.max(y1, y2) - bandBottom);
    return { up, dir, ys, sxs, maxFlags, yAt, escaped };
  }

  for (const run of (runs || [])) {
    const st = run.map(i => steps[i]);
    // the note furthest from the middle line (step 4) sets the direction
    let far = -1, farStep = 4;
    for (const v of st) { const d = Math.abs(v - 4); if (d > far) { far = d; farStep = v; } }
    const split = st.some(v => Math.abs(v - 4) === far && (v < 4) !== (farStep < 4));
    const avg = st.reduce((x, y) => x + y, 0) / st.length;
    const natural = (far <= 0 || split) ? avg <= 4 : farStep < 4;
    let P = place(run, natural);
    // only overrule the standard direction when it genuinely does not fit and
    // the other one does better
    if (P.escaped > 0) { const alt = place(run, !natural); if (alt.escaped < P.escaped) P = alt; }
    const { up, dir, ys, sxs, maxFlags, yAt } = P;
    run.forEach((gi, k) => info.set(gi, { up, beamY: yAt(sxs[k]) }));

    for (let L = 1; L <= maxFlags; L++) {
      const off = -dir * (L - 1) * gap;   // extra beams stack toward the heads
      // a segment per adjacent pair, so each can carry the colour of the note
      // it leaves; they are collinear, so it still reads as one beam
      for (let k = 0; k < run.length - 1; k++) {
        if (flags[run[k]] < L || flags[run[k + 1]] < L) continue;
        const xa = sxs[k] - (k === 0 ? 0.8 : 0), xb = sxs[k + 1] + (k === run.length - 2 ? 0.8 : 0);
        bars.push({ x1: xa, x2: xb, y1: yAt(xa) + off, y2: yAt(xb) + off, dir, t: thick, level: L, state: states[run[k]] });
      }
      if (L === 1) continue;
      // an extra beam with no neighbour to join becomes a hook, pointing back
      // into the group (forward only when it is the group's first note)
      for (let k = 0; k < run.length; k++) {
        if (flags[run[k]] < L) continue;
        if ((k > 0 && flags[run[k - 1]] >= L) || (k < run.length - 1 && flags[run[k + 1]] >= L)) continue;
        const w = half * 1.9, back = k > 0 ? -1 : 1;
        const xa = Math.min(sxs[k], sxs[k] + back * w), xb = Math.max(sxs[k], sxs[k] + back * w);
        bars.push({ x1: xa, x2: xb, y1: yAt(xa) + off, y2: yAt(xb) + off, dir, t: thick, level: L, hook: true, state: states[run[k]] });
      }
    }
  }
  return { info, bars };
}

// light haptic tap feedback on supported devices
export function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

// Shared press/hold/release + multi-touch logic for Piano and GamePiano.
// One pointer per finger is tracked independently (Map keyed by pointerId) so
// chords (several fingers down at once) and glissando (one finger sliding
// across keys) both work — a key sounds the instant it's touched, keeps
// ringing while held, and releases into its natural decay when that specific
// finger lifts, regardless of what any other active finger is doing.
//
// Deliberately NOT using setPointerCapture: capturing would keep every
// subsequent event targeted at the key first touched, which is exactly wrong
// for glissando (each key crossed while sliding is supposed to sound in
// turn). Un-captured pointermove naturally fires on whichever key element is
// currently under the finger, which is all the glissando transition below needs.
//
// onNote() — the scoring/matching callback several callers pass in (Sight-
// Reading, the main free-play handler, Voice Tutor input, Song-Play input) —
// fires only on the initial press of each finger, never on a glissando
// transition: those callers expect one discrete "the learner played X" event
// per deliberate press, and firing it for every key a slide sweeps through
// would over-count practice credit / spam wrong-note matching in a scored
// context. The slide still sounds and lights up normally either way.
function usePianoKeys(onNote) {
  const [held, setHeld] = useState(() => new Set());
  const [flash, setFlash] = useState(null);
  const flashT = useRef(null);
  const activeRef = useRef(new Map()); // pointerId -> { note, handle }

  const velocityFromPointer = (e) => {
    const p = typeof e.pressure === "number" ? e.pressure : 0.5;
    // 0.5 is the spec-mandated sentinel for "device doesn't report real
    // pressure" (true of nearly every phone touchscreen) — treat that as
    // full velocity so ordinary taps sound exactly as loud as before this
    // change, rather than quieter by default. Only a genuinely-varying
    // reading (stylus, pressure-capable trackpad) drives real dynamics.
    if (p === 0.5 || p === 0) return 1;
    return Math.max(0.35, Math.min(1, p * 1.15));
  };
  const flashNote = (n) => { setFlash(n); clearTimeout(flashT.current); flashT.current = setTimeout(() => setFlash(null), 320); };
  const endNote = (pointerId) => {
    const entry = activeRef.current.get(pointerId);
    if (!entry) return;
    activeRef.current.delete(pointerId);
    releasePianoNote(entry.handle);
    const stillHeld = Array.from(activeRef.current.values()).some(v => v.note === entry.note);
    if (!stillHeld) setHeld(prev => (prev.has(entry.note) ? (() => { const n = new Set(prev); n.delete(entry.note); return n; })() : prev));
  };
  const onKeyPointerDown = (e, note) => {
    e.preventDefault();
    /* A pointer whose release happened OFF the keyboard (finger slid past the
       edge, the browser cancelled the gesture, a scroll took over) never fired
       onPointerUp on any key, so its entry stayed in activeRef forever. This
       used to `return` on that — and because touch pointerIds are recycled on
       Android, the next press that happened to reuse that id was silently
       swallowed. That is the "sometimes the on-screen keys just do nothing"
       bug. Recover from the stale entry instead of being defeated by it. */
    if (activeRef.current.has(e.pointerId)) endNote(e.pointerId);
    const handle = startPianoNote(note, velocityFromPointer(e));
    activeRef.current.set(e.pointerId, { note, handle });
    haptic();
    if (onNote) onNote(note);
    setHeld(prev => { const n = new Set(prev); n.add(note); return n; });
    flashNote(note);
  };
  /* The safety net for the above: the window hears every release and cancel,
     including the ones that happen outside the keyboard entirely. Deliberately
     NOT setPointerCapture — capturing would pin every later event to the key
     first touched, which is exactly what glissando must not do. */
  useEffect(() => {
    const release = (e) => endNote(e.pointerId);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyPointerMove = (e, note) => {
    const entry = activeRef.current.get(e.pointerId);
    if (!entry || note === entry.note) return;
    releasePianoNote(entry.handle);
    const handle = startPianoNote(note, 1);
    activeRef.current.set(e.pointerId, { note, handle });
    haptic();
    setHeld(prev => {
      const n = new Set(prev);
      const stillHeldOld = Array.from(activeRef.current.values()).some(v => v.note === entry.note && v !== entry);
      if (!stillHeldOld) n.delete(entry.note);
      n.add(note);
      return n;
    });
    flashNote(note);
  };
  const onKeyPointerUp = (e) => endNote(e.pointerId);
  // Global fallback: if a finger lifts (or the gesture is cancelled — an
  // incoming call, an OS gesture) off the keyboard entirely, no per-key
  // handler ever fires for it. Without this a slide-off would leave that
  // voice ringing at its decay-while-held floor forever.
  useEffect(() => {
    const onUp = (e) => endNote(e.pointerId);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      for (const { handle } of activeRef.current.values()) releasePianoNote(handle);
      activeRef.current.clear();
    };
  }, []);

  return { held, flash, onKeyPointerDown, onKeyPointerMove, onKeyPointerUp };
}

export const Piano = memo(function Piano({ litNote = null, litSet = null, fingerMap = {}, small = false, onNote = null, baseOct = 4 }) {
  const keys = baseOct === 4 ? KEYS : keysFor(baseOct);
  const { held, flash, onKeyPointerDown, onKeyPointerMove, onKeyPointerUp } = usePianoKeys(onNote);
  // White keys flex to fill whatever width the container has (phone or tablet) —
  // no fixed pixel width, so nothing ever overflows into a horizontal scroll.
  // Black keys are positioned by percentage over the white-key row, the same
  // technique GamePiano already uses for the Play-Along keyboard.
  const whites = [], blacks = [];
  let wi = -1;
  for (const k of keys) { if (k.t === "w") { whites.push(k); wi++; } else blacks.push({ ...k, after: wi }); }
  const NW = whites.length;
  const bw = (100 / NW) * 0.62; // black key width, as a % of the row
  const renderKey = (k) => {
    const lit = litNote === k.n || (litSet != null && litSet.includes(k.n));
    const finger = fingerMap[k.n];
    return (
      <div key={k.n}
        className={`pk ${k.t}${lit ? " lit" : ""}${flash === k.n ? " flash" : ""}${held.has(k.n) ? " pressed" : ""}`}
        style={k.t === "b" ? { left: (((k.after + 1) / NW) * 100 - bw / 2) + "%", width: bw + "%" } : undefined}
        onPointerDown={(e) => onKeyPointerDown(e, k.n)}
        onPointerMove={(e) => onKeyPointerMove(e, k.n)}
        onPointerUp={onKeyPointerUp}>
        {k.t === "w" && <span className="kn">{k.l}</span>}
        {lit && finger != null && <span className="finger">{finger}</span>}
      </div>
    );
  };
  return (
    <div className={`kr${small ? " kr-sm" : ""}`}>
      {whites.map(renderKey)}
      {blacks.map(renderKey)}
    </div>
  );
});

export const SP_WKW = 30, SP_GAP = 2, SP_BKW = 19; // white width, gap, black width
export const GamePiano = memo(function GamePiano({ litNote = null, litSet = null, fingerMap = null, onNote = null, baseOct = 4, octs = 2, scroll = false, fullWidth = false }) {
  const { held, flash, onKeyPointerDown, onKeyPointerMove, onKeyPointerUp } = usePianoKeys(onNote);
  const scrollerRef = useRef(null);
  const isLit = (n) => (litSet && litSet.includes(n)) || litNote === n;
  // start the slidable keyboard centered on middle C (C4 = white index 14 of C2..B6)
  useEffect(() => {
    if (!scroll) return;
    const el = scrollerRef.current; if (!el) return;
    el.scrollLeft = Math.max(0, 14 * (SP_WKW + SP_GAP) - 8);
  }, [scroll]);
  // when the teacher highlights keys, slide them into view if they're off-screen
  useEffect(() => {
    if (!scroll) return;
    const el = scrollerRef.current; if (!el) return;
    const lit = (litSet && litSet[0]) || litNote;
    if (!lit) return;
    const m = lit.match(/^([A-G]#?)(\d)$/); if (!m) return;
    const wOrd = { C: 0, "C#": 0, D: 1, "D#": 1, E: 2, F: 3, "F#": 3, G: 4, "G#": 4, A: 5, "A#": 5, B: 6 };
    const wIdx = (parseInt(m[2], 10) - 2) * 7 + (wOrd[m[1]] || 0);
    const x = wIdx * (SP_WKW + SP_GAP);
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - SP_WKW) {
      el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2 + SP_WKW), behavior: "smooth" });
    }
  }, [scroll, litSet, litNote]);

  if (scroll) {
    // Realistic, slidable keyboard: fixed narrow/tall keys over a wide range
    // (C2–B6). ~2 octaves show on a phone, ~4 on a tablet; slide for the rest.
    const seq = keysFor(2, 5); // C2..B6
    const whites = [], blacks = []; let wi = -1;
    for (const k of seq) { if (k.t === "w") { whites.push(k); wi++; } else blacks.push({ ...k, after: wi }); }
    const rowW = whites.length * SP_WKW + (whites.length - 1) * SP_GAP;
    return (
      <div className="gpwrap gpscroll" ref={scrollerRef}>
        <div className="gprow gprow-fixed" style={{ width: rowW, maxWidth: "none", margin: 0 }}>
          {whites.map(k => (
            <button key={k.n} className={`gpw${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}${held.has(k.n) ? " pressed" : ""}`}
              style={{ flex: "none", width: SP_WKW }}
              onPointerDown={(e) => onKeyPointerDown(e, k.n)} onPointerMove={(e) => onKeyPointerMove(e, k.n)} onPointerUp={onKeyPointerUp}
              aria-label={k.n}>
              <span>{k.l === "C" ? k.n : k.l}</span>
              {isLit(k.n) && fingerMap && fingerMap[k.n] != null && <span className="gpfinger">{fingerMap[k.n]}</span>}
            </button>
          ))}
          {blacks.map(k => (
            <button key={k.n} className={`gpb${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}${held.has(k.n) ? " pressed" : ""}`}
              style={{ left: (k.after + 1) * (SP_WKW + SP_GAP) - SP_BKW / 2 - 1, width: SP_BKW }}
              onPointerDown={(e) => onKeyPointerDown(e, k.n)} onPointerMove={(e) => onKeyPointerMove(e, k.n)} onPointerUp={onKeyPointerUp}
              aria-label={k.n}>
              {isLit(k.n) && fingerMap && fingerMap[k.n] != null && <span className="gpfinger">{fingerMap[k.n]}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const seq = keysFor(baseOct, octs);
  const whites = [], blacks = [];
  let wi = -1;
  for (const k of seq) { if (k.t === "w") { whites.push(k); wi++; } else blacks.push({ ...k, after: wi }); }
  const NW = whites.length;
  const bw = (100 / NW) * 0.62;
  return (
    <div className="gpwrap">
      <div className="gprow" style={fullWidth ? { maxWidth: "none", margin: 0, padding: 0, gap: 0 } : undefined}>
        {whites.map(k => (
          <button key={k.n} className={`gpw${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}${held.has(k.n) ? " pressed" : ""}`}
            onPointerDown={(e) => onKeyPointerDown(e, k.n)} onPointerMove={(e) => onKeyPointerMove(e, k.n)} onPointerUp={onKeyPointerUp}
            aria-label={k.l}>
            <span>{k.l}</span>
            {isLit(k.n) && fingerMap && fingerMap[k.n] != null && <span className="gpfinger">{fingerMap[k.n]}</span>}
          </button>
        ))}
        {blacks.map(k => (
          <button key={k.n} className={`gpb${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}${held.has(k.n) ? " pressed" : ""}`}
            style={{ left: (((k.after + 1) / NW) * 100 - bw / 2) + "%", width: bw + "%" }}
            onPointerDown={(e) => onKeyPointerDown(e, k.n)} onPointerMove={(e) => onKeyPointerMove(e, k.n)} onPointerUp={onKeyPointerUp}
            aria-label={k.l}>
            {isLit(k.n) && fingerMap && fingerMap[k.n] != null && <span className="gpfinger">{fingerMap[k.n]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
});

export const PC_SOLFA = { C: "do", D: "re", E: "mi", F: "fa", G: "sol", A: "la", B: "ti" };
export const PC_SOLFA_TH = { C: "โด", D: "เร", E: "มี", F: "ฟา", G: "ซอล", A: "ลา", B: "ที" };

export const EG_INT_BASE = [2, 4, 5, 7, 12];
export const EG_INT_FULL = [2, 3, 4, 5, 7, 8, 9, 12];
export const EG_INT_MASTER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const RC_LEVELS = [
  { n: 1, icon: "🌱", clef: "treble", pool: ["C4", "D4", "E4", "F4", "G4", "A4", "B4"], seq: 1, qn: 10 },
  { n: 2, icon: "🌿", clef: "treble", pool: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"], seq: 1, qn: 10 },
  { n: 3, icon: "🎻", clef: "bass", pool: ["F2", "G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"], seq: 1, qn: 10 },
  { n: 4, icon: "♯", clef: "treble", pool: ["C#4", "D#4", "F#4", "G#4", "A#4", "C#5", "F#5"], seq: 1, qn: 10 },
  { n: 5, icon: "🎼", clef: "treble", pool: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"], seq: 3, qn: 5 },
  { n: 6, icon: "🪜", clef: "bass", pool: ["C2", "D2", "E2", "D4", "E4", "F4"], seq: 1, qn: 10 },
];

export const CHORD_MOODS = [
  { emoji: "☀️", th: "สดใส", en: "Happy",     zh: "开心",
    prog: [["C","C4,E4,G4"],["F","F4,A4,C5"],["G","G4,B4,D5"],["C","C4,E4,G4"]],
    desc: { th: "C–F–G–C · สว่าง มีความสุข", en: "C–F–G–C · Bright & joyful", zh: "C–F–G–C · 明亮愉快" } },
  { emoji: "🌧️", th: "เศร้า",  en: "Sad",      zh: "忧伤",
    prog: [["Am","A4,C5,E5"],["F","F4,A4,C5"],["C","C4,E4,G4"],["G","G4,B4,D5"]],
    desc: { th: "Am–F–C–G · อ่อนโยน ซึ้งใจ", en: "Am–F–C–G · Tender & melancholic", zh: "Am–F–C–G · 温柔忧郁" } },
  { emoji: "⚡",  th: "พลังงาน",en: "Energetic",zh: "激情",
    prog: [["G","G4,B4,D5"],["D","D4,F#4,A4"],["Em","E4,G4,B4"],["C","C4,E4,G4"]],
    desc: { th: "G–D–Em–C · ขับเคลื่อน มีพลัง", en: "G–D–Em–C · Driving & powerful", zh: "G–D–Em–C · 充满活力" } },
  { emoji: "🌙",  th: "สงบ",   en: "Calm",     zh: "平静",
    prog: [["Fmaj7","F4,A4,C5,E5"],["Am7","A4,C5,E5,G5"],["Dm7","D4,F4,A4,C5"],["G7","G4,B4,D5,F5"]],
    desc: { th: "Fmaj7–Am7–Dm7–G7 · ผ่อนคลาย", en: "Fmaj7–Am7–Dm7–G7 · Dreamy & calm", zh: "Fmaj7–Am7–Dm7–G7 · 宁静梦幻" } },
  { emoji: "💔",  th: "คิดถึง", en: "Longing",  zh: "思念",
    prog: [["Cm","C4,Eb4,G4"],["Ab","Ab4,C5,Eb5"],["Eb","Eb4,G4,Bb4"],["Bb","Bb4,D5,F5"]],
    desc: { th: "Cm–Ab–Eb–Bb · ถวิลหา คิดถึง", en: "Cm–Ab–Eb–Bb · Wistful & longing", zh: "Cm–Ab–Eb–Bb · 思念哀愁" } },
  { emoji: "🎉",  th: "ตื่นเต้น",en: "Excited", zh: "兴奋",
    prog: [["E","E4,G#4,B4"],["B","B4,D#5,F#5"],["A","A4,C#5,E5"],["E","E4,G#4,B4"]],
    desc: { th: "E–B–A–E · สนุกสนาน ตื่นเต้น", en: "E–B–A–E · Festive & exciting", zh: "E–B–A–E · 欢快刺激" } },
];

export const StaffSVG = memo(function StaffSVG({ note, clef = "treble" }) {
  const step = note ? staffStep(note, clef) : 0;
  const W = 280, H = 168, baseY = 116, half = 9; // baseY = bottom staff line
  const y = baseY - step * half, noteX = 190;
  const lineYs = [0, 2, 4, 6, 8].map(s => baseY - s * half);
  const ledgers = [];
  for (let s = -2; s >= step; s -= 2) ledgers.push(baseY - s * half);
  for (let s = 10; s <= step; s += 2) ledgers.push(baseY - s * half);
  const stemUp = step < 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="staffsvg" width="100%" preserveAspectRatio="xMidYMid meet" style={{ background: "var(--card)", borderRadius: 12 }}>
      <rect width={W} height={H} style={{ fill: "var(--card)" }} rx="8" />
      {lineYs.map((ly, i) => <line key={i} x1="14" y1={ly} x2={W - 14} y2={ly} style={{ stroke: "#d97757" }} strokeWidth="1.4" />)}
      {clef === "bass"
        ? <text x="20" y={baseY - 2 * half + 4} fontSize="64" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fill: "#d97757" }}>&#119074;</text>
        : <text x="18" y={baseY + 6} fontSize="78" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fill: "#d97757" }}>&#119070;</text>}
      {ledgers.map((ly, i) => <line key={"l" + i} x1={noteX - 16} y1={ly} x2={noteX + 16} y2={ly} style={{ stroke: "#d97757" }} strokeWidth="1.4" />)}
      <line x1={stemUp ? noteX + 9 : noteX - 9} y1={y} x2={stemUp ? noteX + 9 : noteX - 9} y2={y + (stemUp ? -46 : 46)} style={{ stroke: "#d97757" }} strokeWidth="2.4" />
      <ellipse cx={noteX} cy={y} rx="10" ry="7.5" style={{ fill: "#d97757" }} transform={`rotate(-18 ${noteX} ${y})`} />
    </svg>
  );
});

/* ── Several notes on one staff, with names underneath (voice-mode [staff:]).
   hideNames + clef props let the Reading course reuse it as a quiz card
   (names would spoil the answer; bass drills must force the bass clef). ── */
export const StaffNotes = memo(function StaffNotes({ notes, hideNames = false, clef: clefProp = null }) {
  const list = (notes || []).filter(Boolean);
  const W = 300, H = 152, baseY = 100, half = 8;
  const octs = list.map(n => parseInt((n.match(/\d/) || ["4"])[0], 10));
  const clef = clefProp || (octs.length && Math.min(...octs) < 4 ? "bass" : "treble"); // low notes → bass clef
  const startX = 58, gap = Math.min(36, (W - startX - 18) / Math.max(1, list.length));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="staffsvg" width="100%" preserveAspectRatio="xMidYMid meet">
      {[0, 2, 4, 6, 8].map((s, i) => { const ly = baseY - s * half; return <line key={i} x1="10" y1={ly} x2={W - 10} y2={ly} stroke="var(--muted)" strokeWidth="1.3" />; })}
      {clef === "bass"
        ? <text x="14" y={baseY - 2 * half + 3} fontSize="56" fill="var(--text)" style={{ fontFamily: "Georgia, serif" }}>&#119074;</text>
        : <text x="12" y={baseY + 5} fontSize="68" fill="var(--text)" style={{ fontFamily: "Georgia, serif" }}>&#119070;</text>}
      {list.map((n, i) => {
        const step = staffStep(n, clef);
        const y = baseY - step * half, x = startX + i * gap;
        const ledgers = [];
        for (let s = -2; s >= step; s -= 2) ledgers.push(baseY - s * half);
        for (let s = 10; s <= step; s += 2) ledgers.push(baseY - s * half);
        return (
          <g key={i}>
            {ledgers.map((ly, k) => <line key={k} x1={x - 12} y1={ly} x2={x + 12} y2={ly} stroke="var(--muted)" strokeWidth="1.3" />)}
            {n.includes("#") && <text x={x - 21} y={y + 5} fontSize="20" fill="var(--muted)" style={{ fontFamily: "Georgia, serif" }}>&#9839;</text>}
            <ellipse cx={x} cy={y} rx="9" ry="6.8" fill="#d97757" transform={`rotate(-18 ${x} ${y})`} />
            {!hideNames && <text x={x} y={baseY + 30} fontSize="11" fill="var(--muted)" textAnchor="middle" style={{ fontFamily: "'Share Tech Mono',monospace" }}>{pcOf(n)}</text>}
          </g>
        );
      })}
    </svg>
  );
});

/* ── PlayAlongStaff ──
   Real notation for the play-along reading strip: a proper clef per hand
   (grand staff when both hands play), the song's actual key signature,
   accidentals only where the signature doesn't already account for them,
   and note heads/stems/flags/dots that mean the duration they're drawn for.
   Horizontal position comes from a note's BEAT, not its index in the array,
   so a half note visibly occupies twice the space of a quarter and — the
   reason it matters most — the two staves of a grand staff line up
   vertically on the beat, which index-based spacing can never do. ── */
export const PlayAlongStaff = memo(function PlayAlongStaff({ notes, startBeat = 0, spanBeats = 20, songMeta, handMode = "right" }) {
  // Track the real container size so the drawing is stretched to EXACTLY fill
  // the element's box (width-wise) on any screen/orientation — a fixed-width
  // viewBox letterboxes the staff (empty black on both sides) on anything
  // wider than ~350px. Height is fixed via CSS, so glyphs keep their size and
  // only the horizontal spread changes.
  const grand = handMode === "both";
  const H = grand ? 200 : 150;
  const half = grand ? 6 : 7;                      // half a staff space = one step
  const wrapRef = useRef(null);
  const [wbW, setWbW] = useState(520);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => {
      setWbW(Math.max(260, Math.round((el.clientWidth * H) / Math.max(1, el.clientHeight))));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [H]);

  const list = (notes || []).filter(Boolean).slice(0, 64);
  const timeSig = (songMeta && SONG_TIMESIG[songMeta.id]) || "4/4";
  const beatsPerBar = parseInt(String(timeSig).split("/")[0], 10) || 4;
  const sigDenom = parseInt(String(timeSig).split("/")[1], 10) || 4;
  // The song's own pickup (anacrusis), recomputed from the same sequence and
  // by the same function expandSong() engraved the glyphs against, so the bar
  // grid drawn here is the one the glyphs were split on. 98 of the 348 songs
  // carry a pickup; without this the bar lines — and every beam group, which
  // must never cross one — would sit a beat or three out on all of them.
  const pickup = useMemo(() => pickupBeatsOf((songMeta && songMeta.seq) || [], beatsPerBar), [songMeta, beatsPerBar]);
  const { sig, name: keyName } = songMeta ? keySignatureOf(songMeta) : { sig: 0, name: "C" };
  const sigMarksTreble = keySignatureMarks(sig, "treble");
  const sigMarksBass = keySignatureMarks(sig, "bass");

  // Single-staff clef follows the music's own range, exactly as a real score
  // would: the left-hand mode plays the SAME C4–B5 melody, which genuinely
  // belongs in treble clef — forcing it into bass would bury every note under
  // ledger lines for no musical reason. A genuinely low part gets bass.
  // The left-hand part really is a bass part now, so left-hand mode gets a
  // bass clef outright. For the melody, the clef still follows its own range
  // (a genuinely low melody would get bass too).
  const drawnMidis = list.map(g => noteToMidi(g.note || "")).filter(m => m > 0);
  const avgMidi = drawnMidis.length ? drawnMidis.reduce((a, b) => a + b, 0) / drawnMidis.length : 67;
  const soloClef = handMode === "left" ? "bass" : (avgMidi < 60 ? "bass" : "treble"); // 60 = middle C

  const W = wbW;
  // left-hand furniture: clef, then the key signature, then the time signature
  const sigW = Math.abs(sig) * 9;
  const sigX0 = 52;
  const timeX = sigX0 + sigW + (sigW ? 14 : 6);
  const startX = timeX + 26;
  const pxPerBeat = (W - startX - 20) / Math.max(1, spanBeats);
  const xOf = (beat) => startX + (beat - startBeat) * pxPerBeat;

  const topBase = grand ? 30 + 8 * half : 95;                 // bottom line of the upper staff
  const bassBase = grand ? topBase + 8 * half + 8 * half : null; // one full staff-height gap below it
  const COLOR = { past: "rgba(255,255,255,.32)", current: "#ffd166", future: "#d97757" };
  const LINE = "rgba(255,255,255,.45)";
  const linesOf = (base) => [0, 2, 4, 6, 8].map(s => base - s * half);

  // ── one staff's furniture: 5 lines, clef, key signature, time signature ──
  function staffFurniture(base, clef, marks, tag) {
    const ly = linesOf(base);
    const fs = 3.6 * half;
    return (
      <g key={tag}>
        {ly.map((y, i) => <line key={i} x1="8" y1={y} x2={W - 8} y2={y} stroke={LINE} strokeWidth="1.4" />)}
        {clef === "bass"
          ? <text x="10" y={base - 4 * half + half * 0.6} fontSize={7.6 * half} fill="rgba(255,255,255,.85)" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>&#119074;</text>
          : <text x="8" y={base + half * 0.6} fontSize={7.6 * half} fill="rgba(255,255,255,.85)" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>&#119070;</text>}
        {marks.map((m, i) => (
          <text key={i} x={sigX0 + i * 9} y={base - m.step * half + half * 0.75}
            fontSize={4.2 * half} textAnchor="middle" fill="rgba(255,255,255,.85)"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{m.glyph}</text>
        ))}
        <text x={timeX} y={base - 6 * half + fs * 0.36} fontSize={fs} textAnchor="middle" fill="rgba(255,255,255,.85)" style={{ fontFamily: "Georgia, serif", fontWeight: 700 }}>{String(timeSig).split("/")[0]}</text>
        <text x={timeX} y={base - 2 * half + fs * 0.36} fontSize={fs} textAnchor="middle" fill="rgba(255,255,255,.85)" style={{ fontFamily: "Georgia, serif", fontWeight: 700 }}>{String(timeSig).split("/")[1]}</text>
      </g>
    );
  }

  // ── a rest, drawn as paths so it never depends on a font having the
  //    Musical Symbols block. Positions are the standard ones: the whole rest
  //    hangs UNDER the 4th line, the half rest sits ON the middle line, and
  //    the flagged rests centre on the middle line with one blob per flag
  //    (เขบ็ต 1/2/3 ชั้น). ──
  function renderRest(g, i, base, clef) {
    const x = xOf(g.beat), color = COLOR[g.state] || COLOR.future;
    const mid = base - 4 * half, line4 = base - 6 * half;
    const w = half * 1.45, t = half * 0.62;
    const val = g.value;
    const key = clef + "-r" + i;
    if (val.flags === 0 && val.head === "open" && !val.stem) {           // whole
      return <g key={key}><rect x={x - w / 2} y={line4} width={w} height={t} fill={color} />
        {val.dots > 0 && <circle cx={x + w / 2 + half * 0.6} cy={line4 - half * 0.5} r={half * 0.28} fill={color} />}</g>;
    }
    if (val.head === "open") {                                           // half (and dotted half)
      return <g key={key}><rect x={x - w / 2} y={mid - t} width={w} height={t} fill={color} />
        {val.dots > 0 && <circle cx={x + w / 2 + half * 0.6} cy={mid - half * 1.5} r={half * 0.28} fill={color} />}</g>;
    }
    if (val.flags === 0) {                                               // quarter — the zigzag
      return (
        <g key={key}>
          <path d={`M${x - half * 0.55},${mid - half * 2.6} L${x + half * 0.6},${mid - half * 1.1} L${x - half * 0.5},${mid + half * 0.4} L${x + half * 0.68},${mid + half * 1.9}`}
            fill="none" stroke={color} strokeWidth={half * 0.42} strokeLinejoin="miter" strokeLinecap="butt" />
          <path d={`M${x + half * 0.68},${mid + half * 1.9} q${-half * 1.5},${-half * 0.55} ${-half * 0.95},${half * 1.15}`}
            fill="none" stroke={color} strokeWidth={half * 0.3} strokeLinecap="round" />
          {val.dots > 0 && <circle cx={x + half * 1.15} cy={mid - half} r={half * 0.28} fill={color} />}
        </g>
      );
    }
    // eighth / 16th / 32nd — a slanted stem carrying one blob per flag
    const top = mid - half * (0.6 + val.flags * 0.95), bottom = mid + half * 1.8;
    return (
      <g key={key}>
        <line x1={x + half * 0.5} y1={top} x2={x - half * 0.42} y2={bottom} stroke={color} strokeWidth={half * 0.28} strokeLinecap="round" />
        {Array.from({ length: val.flags }).map((_, f) => {
          const cy = top + f * half * 0.95 + half * 0.2;
          const cx = x + half * 0.5 - (cy - top) * 0.27;
          return <g key={f}>
            <circle cx={cx - half * 0.42} cy={cy} r={half * 0.36} fill={color} />
            <path d={`M${cx - half * 0.42},${cy - half * 0.3} q${half * 0.7},${-half * 0.35} ${half * 0.5},${half * 0.15}`} fill="none" stroke={color} strokeWidth={half * 0.22} />
          </g>;
        })}
        {val.dots > 0 && <circle cx={x + half * 1.1} cy={mid - half} r={half * 0.28} fill={color} />}
      </g>
    );
  }

  // Where a note glyph sits on this staff, spelled for the key — the one
  // place both the glyph renderer and the beam layout ask.
  function stepOf(g, clef) {
    if (!g || g.kind === "rest" || !g.note) return null;
    const sp = spellNoteInKey(g.note, sig);
    if (!sp) return null;
    return staffStepFor(sp.letter, sp.oct, clef);
  }

  /* ── beaming ──
     Engraved music never leaves a run of short notes flapping with one flag
     each: notes shorter than a quarter are joined by a beam when they share
     a beat, and that beam is what makes the pulse readable at a glance. A
     lone flag is only ever correct for a note standing by itself inside its
     own beam unit. The rules applied here are the standard ones:
       • the beam unit is the metre's beat — a quarter in every x/4 metre,
         a dotted quarter in a compound metre (6/8, 9/8, 12/8);
       • a beam never crosses a bar line, never spans a rest, and never
         bridges a gap in time;
       • in 4/4 a clean run of eighths filling half a bar is beamed as one
         group of four, the way published piano music sets it — but never
         across the middle of the bar, which would bury beat 3;
       • the whole group shares ONE stem direction, chosen by the note
         furthest from the middle line (the average breaks a tie);
       • 16ths and 32nds get their extra beams only across the span they
         share with a neighbour of the same value; with no such neighbour
         the extra beam becomes a short hook pointing back into the group,
         which is how a dotted-eighth/16th pair is set. ── */
  // Returns the per-glyph stem overrides (direction + where the stem stops)
  // and the beam segments to draw for one staff's worth of glyphs.
  function layoutBeams(glyphs, clef, base) {
    if (!glyphs || !glyphs.length) return { info: new Map(), bars: [] };

    // 1+2. which notes beam together — the musical half of the job, kept out
    //      of the component so it can be audited against every song
    const runs = beamRuns(glyphs, { beatsPerBar, sigDenom, pickup, skip: g => stepOf(g, clef) == null });

    // 3. geometry — also its own pure function, so the drawing can be audited.
    //    The band keeps a wide group's beam on the page: below the "Key:"
    //    caption, and on a grand staff inside its own half, never running
    //    down into the other hand's staff.
    const isBass = grand && base === bassBase;
    return beamLayout(runs, {
      steps: glyphs.map(g => stepOf(g, clef)),
      xs: glyphs.map(g => xOf(g.beat)),
      flags: glyphs.map(g => (g.kind === "rest" ? 0 : beamFlagsOf(g))),
      states: glyphs.map(g => g.state),
      base, half,
      bandTop: isBass ? topBase + 10 : 20,
      bandBottom: grand && !isBass ? bassBase - 8 * half - 8 : H - 6,
    });
  }

  // a beam segment: a parallelogram whose OUTER edge is the stem end, its
  // thickness falling inward toward the note heads
  const renderBeam = (b, k) => (
    <path key={k} d={`M${b.x1},${b.y1} L${b.x2},${b.y2} L${b.x2},${b.y2 - b.dir * b.t} L${b.x1},${b.y1 - b.dir * b.t} Z`}
      fill={COLOR[b.state] || COLOR.future} />
  );

  // ── one glyph, fully notated ──
  function renderGlyph(g, i, base, clef, next, beam) {
    if (g.kind === "rest") return renderRest(g, i, base, clef);
    const sp = spellNoteInKey(g.note, sig);
    if (!sp) return null;
    const step = staffStepFor(sp.letter, sp.oct, clef);
    const x = xOf(g.beat), y = base - step * half;
    const val = g.value || noteValueOf(g.dur);
    const isCurrent = g.state === "current";
    const color = COLOR[g.state] || COLOR.future;
    const rx = half * 0.95, ry = half * 0.8;
    // ledger lines, one per line-position the note reaches past the staff
    const ledgers = [];
    for (let s = -2; s >= step; s -= 2) ledgers.push(base - s * half);
    for (let s = 10; s <= step; s += 2) ledgers.push(base - s * half);
    // stems: up from the right of the head below the middle line, down from
    // the left on or above it — the standard rule. Extra flags need a longer
    // stem to hang from.
    // A beamed note takes its direction and its stem end from the GROUP —
    // one shared direction and one shared beam is the whole point of beaming.
    const up = beam ? beam.up : step < 4;
    const stemLen = half * (6.2 + Math.max(0, val.flags - 1) * 1.1);
    const stemX = up ? x + rx - 0.7 : x - rx + 0.7;
    const stemEnd = beam ? beam.beamY : (up ? y - stemLen : y + stemLen);
    // an augmentation dot sits in a space beside the head, never on a line
    const dotY = step % 2 === 0 ? y - half : y;
    // a tie binds this head to the next piece of the same held note; it
    // curves away from the stem, as ties always do
    let tie = null;
    if (g.tieTo && next) {
      const nx = xOf(next.beat), d = up ? 1 : -1;
      tie = <path d={`M${x + rx * 0.6},${y + d * ry * 1.5} Q${(x + nx) / 2},${y + d * ry * 3.6} ${nx - rx * 0.6},${y + d * ry * 1.5}`}
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />;
    }
    return (
      <g key={clef + "-" + i}>
        {isCurrent && <>
          <rect className="pastaff-cur" x={x - half * 2.1} y={base - 8 * half - 6} width={half * 4.2} height={8 * half + 12} rx="8" fill="#ffd16633" />
          <path d={`M${x - 7},${base + half * 2.6} L${x + 7},${base + half * 2.6} L${x},${base + half * 1.1} Z`} fill="#ffd166" />
        </>}
        {ledgers.map((ly2, k) => <line key={k} x1={x - rx - 4} y1={ly2} x2={x + rx + 4} y2={ly2} stroke={g.state === "past" ? "rgba(255,255,255,.25)" : LINE} strokeWidth="1.4" />)}
        {/* an accidental is never repeated on the tail of a tie — the first
            head of the tied group already carries it */}
        {sp.acc && !g.tieFrom && (
          <text x={x - rx - 5} y={y + half * 0.62} fontSize={3.6 * half} textAnchor="end" fill={color}
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{sp.acc === "#" ? "♯" : sp.acc === "b" ? "♭" : "♮"}</text>
        )}
        {val.stem && <line x1={stemX} y1={y} x2={stemX} y2={stemEnd} stroke={color} strokeWidth="1.6" />}
        {/* a flag is drawn only on a note that is NOT beamed — a beamed
            note's tail is the beam, and drawing both is the classic error */}
        {!beam && Array.from({ length: val.flags }).map((_, f) => (
          <path key={f}
            d={`M${stemX},${stemEnd + (up ? f * half * 1.1 : -f * half * 1.1)} q${half * 1.6},${up ? half * 1.1 : -half * 1.1} ${half * 1.1},${up ? half * 3 : -half * 3}`}
            fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        ))}
        <ellipse cx={x} cy={y} rx={isCurrent ? rx * 1.12 : rx} ry={isCurrent ? ry * 1.12 : ry}
          fill={val.head === "open" ? "none" : color} stroke={val.head === "open" ? color : "none"} strokeWidth="2"
          transform={`rotate(-18 ${x} ${y})`} />
        {val.dots > 0 && <circle cx={x + rx + 4} cy={dotY} r={half * 0.28} fill={color} />}
        {tie}
      </g>
    );
  }
  // bar lines land on real measure boundaries, spanning both staves on a
  // grand staff exactly as piano notation does
  const barBeats = [];
  // Bars run from the END of the pickup measure onward — an anacrusis is a
  // short first bar, so its bar line falls at `pickup`, not at beat 4.
  if (pickup > 1e-9 && pickup > startBeat + 0.01 && pickup <= startBeat + spanBeats) barBeats.push(pickup);
  const firstBar = pickup + Math.max(0, Math.ceil((startBeat - pickup) / beatsPerBar)) * beatsPerBar;
  for (let b = firstBar; b <= startBeat + spanBeats; b += beatsPerBar) if (b > startBeat + 0.01 && b > pickup + 1e-9) barBeats.push(b);
  const barTop = topBase - 8 * half;
  const barBottom = grand ? bassBase : topBase;

  const trebleNotes = grand ? list.filter(n => n.hand !== "left") : list;
  const bassNotes = grand ? list.filter(n => n.hand === "left") : [];
  // Each staff is one voice, so each beams independently — a beam never
  // joins the right hand to the left.
  const trebleBeams = layoutBeams(trebleNotes, grand ? "treble" : soloClef, topBase);
  const bassBeams = grand ? layoutBeams(bassNotes, "bass", bassBase) : { info: new Map(), bars: [] };

  return (
    <svg ref={wrapRef} viewBox={`0 0 ${W} ${H}`} className="pastaff" preserveAspectRatio="xMidYMid meet">
      {/* Which hand this staff is for — stated outright in the one-hand modes
          so there's never any doubt which part is on the page. */}
      <text x="8" y="14" fontSize="12" fill="rgba(255,255,255,.6)" style={{ fontFamily: "'Share Tech Mono',monospace" }}>
        Key: {keyName}{handMode === "left" ? " · L.H." : handMode === "right" ? " · R.H." : ""}
      </text>
      {grand && <>
        <text x={W - 10} y={topBase - 8 * half - 4} fontSize="11" textAnchor="end" fill="rgba(255,255,255,.45)" style={{ fontFamily: "'Share Tech Mono',monospace" }}>R.H.</text>
        <text x={W - 10} y={bassBase - 8 * half - 4} fontSize="11" textAnchor="end" fill="rgba(255,255,255,.45)" style={{ fontFamily: "'Share Tech Mono',monospace" }}>L.H.</text>
      </>}
      {staffFurniture(topBase, grand ? "treble" : soloClef, grand ? sigMarksTreble : (soloClef === "bass" ? sigMarksBass : sigMarksTreble), "top")}
      {grand && staffFurniture(bassBase, "bass", sigMarksBass, "bottom")}
      {/* grand-staff brace + the vertical rule joining the two staves */}
      {grand && <>
        <path d={`M6,${barTop} q-5,${(barBottom - barTop) / 4} 0,${(barBottom - barTop) / 2} q5,${(barBottom - barTop) / 4} 0,${(barBottom - barTop) / 2}`}
          fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" />
        <line x1="8" y1={barTop} x2="8" y2={barBottom} stroke={LINE} strokeWidth="1.6" />
      </>}
      {barBeats.map((b, i) => (
        <line key={"bar" + i} x1={xOf(b) - pxPerBeat * 0.35} y1={barTop} x2={xOf(b) - pxPerBeat * 0.35} y2={barBottom}
          stroke="rgba(255,255,255,.55)" strokeWidth="1.6" />
      ))}
      {trebleBeams.bars.map((b, i) => renderBeam(b, "tb" + i))}
      {grand && bassBeams.bars.map((b, i) => renderBeam(b, "bb" + i))}
      {trebleNotes.map((n, i) => renderGlyph(n, i, topBase, grand ? "treble" : soloClef, trebleNotes[i + 1], trebleBeams.info.get(i)))}
      {grand && bassNotes.map((n, i) => renderGlyph(n, i, bassBase, "bass", bassNotes[i + 1], bassBeams.info.get(i)))}
    </svg>
  );
});

export const _PC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
export function _backingChordNotes(rootPc: string, startOct: number): string[] {
  const ri = _PC.indexOf(rootPc); if (ri < 0) return [];
  return [0, 4, 7].map(s => { const ni = ri + s; return _PC[ni % 12] + (startOct + Math.floor(ni / 12)); });
}
export function playBackingChord(rootPc: string) {
  const notes = _backingChordNotes(rootPc, 4);
  notes.forEach((n, i) => setTimeout(() => playPianoNote(n, 0.6), i * 70));
}
export function songTonic(meta: any): string {
  const seq = (meta.seq || []).filter(([n]: any) => n !== "R");
  const last = seq[seq.length - 1]?.[0] || "C4";
  return last.replace(/\d/, "");
}
// E5: Song detector — match note sequence against song openings
export function detectSongMatch(heardNotes: string[]): any[] {
  if (!heardNotes.length) return [];
  const norm = (n: string) => n.replace(/\d/, "");
  const heard = heardNotes.map(norm);
  const results: any[] = [];
  for (const s of SONGS) {
    const openNotes = (s.seq || []).filter(([n]: any) => n !== "R").slice(0, 8).map(([n]: any) => norm(n));
    let score = 0;
    for (let i = 0; i < Math.min(heard.length, openNotes.length); i++) {
      if (heard[i] === openNotes[i]) score += 2;
      else if (openNotes.includes(heard[i])) score += 0.5;
    }
    results.push({ song: s, score });
  }
  return results.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}
