import { useState, useRef, useEffect, useMemo, memo, useCallback, Fragment } from "react";
import { createClient } from "@supabase/supabase-js";
import qrcode from "qrcode-generator";

/* ── PromptPay QR (EMVCo) — generate a payable QR straight to the owner's bank.
   No gateway, no fees: money goes directly to the configured PromptPay ID. ── */
function _ppTLV(id, val) { const l = String(val.length).padStart(2, "0"); return id + l + val; }
function _ppCrc16(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
// target = mobile number (0xxxxxxxxx) or national/tax id (13 digits); amount in THB
function promptPayPayload(target, amount) {
  const digits = String(target || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  let acc, tag;
  if (digits.length >= 13) { acc = digits.slice(0, 13); tag = "02"; }      // national / tax id
  else {                                                                    // mobile → 0066 + 9 digits (13 total)
    let local = digits; if (local.startsWith("66")) local = local.slice(2); local = local.replace(/^0+/, "");
    acc = "0066" + local; tag = "01";
  }
  const merchant = _ppTLV("00", "A000000677010111") + _ppTLV(tag, acc);
  let s = _ppTLV("00", "01") + _ppTLV("01", amount > 0 ? "12" : "11") + _ppTLV("29", merchant) + _ppTLV("53", "764") + _ppTLV("58", "TH");
  if (amount > 0) s += _ppTLV("54", Number(amount).toFixed(2));
  s += "6304";
  return s + _ppCrc16(s);
}
function promptPayQR(target, amount) {
  try {
    const payload = promptPayPayload(target, amount);
    if (!payload) return null;
    const qr = qrcode(0, "M"); qr.addData(payload); qr.make();
    return qr.createDataURL(6, 12);   // PNG data URL
  } catch (e) { return null; }
}

/* ── Note frequencies ── */
// Equal-temperament note frequencies, generated for a wide range (C2–C7) so the
// synth, AI demos and games can reach beyond the on-screen 2 octaves.
const _PCN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NF = (() => {
  const m = {};
  for (let midi = 36; midi <= 96; midi++) {            // C2 (36) … C7 (96)
    const name = _PCN[midi % 12] + (Math.floor(midi / 12) - 1);
    m[name] = +(440 * Math.pow(2, (midi - 69) / 12)).toFixed(2);
  }
  return m;
})();

const KEYS = [
  {n:"C4",t:"w",l:"C"},{n:"C#4",t:"b",l:"C#"},{n:"D4",t:"w",l:"D"},
  {n:"D#4",t:"b",l:"D#"},{n:"E4",t:"w",l:"E"},{n:"F4",t:"w",l:"F"},
  {n:"F#4",t:"b",l:"F#"},{n:"G4",t:"w",l:"G"},{n:"G#4",t:"b",l:"G#"},
  {n:"A4",t:"w",l:"A"},{n:"A#4",t:"b",l:"A#"},{n:"B4",t:"w",l:"B"},
  {n:"C5",t:"w",l:"C"},{n:"C#5",t:"b",l:"C#"},{n:"D5",t:"w",l:"D"},
  {n:"D#5",t:"b",l:"D#"},{n:"E5",t:"w",l:"E"},{n:"F5",t:"w",l:"F"},
  {n:"F#5",t:"b",l:"F#"},{n:"G5",t:"w",l:"G"},{n:"G#5",t:"b",l:"G#"},
  {n:"A5",t:"w",l:"A"},{n:"A#5",t:"b",l:"A#"},{n:"B5",t:"w",l:"B"}
];

// build a 2-octave (default) key layout starting at a given octave, for the
// octave-shiftable on-screen keyboard. baseOct=4 reproduces the original C4–B5.
function keysFor(baseOct = 4, octs = 2) {
  const out = [];
  for (let o = 0; o < octs; o++)
    for (const pc of _PCN) out.push({ n: pc + (baseOct + o), t: pc.length > 1 ? "b" : "w", l: pc });
  return out;
}

// Horizontal position {cx,w} (as fractions of width) of a note on the in-game
// keyboard (C4–B5, 14 white keys), so falling notes line up over their key.
const _WHITE_ORD = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
function noteKeyFrac(note) {
  const m = String(note || "").match(/^([A-G])(#?)(\d)$/);
  if (!m) return null;
  const NW = 14;
  let base = (parseInt(m[3], 10) - 4) * 7 + _WHITE_ORD[m[1]]; // white index from C4
  if (base < 0) base = 0; else if (base > NW - 1) base = NW - 1;
  if (m[2] === "#") return { cx: (base + 1) / NW, w: (1 / NW) * 0.62 }; // black sits on the gap
  return { cx: (base + 0.5) / NW, w: 1 / NW };
}

// normalize a single note from AI-generated song data → a valid NF key or "R"
const _FLAT2 = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#", CB: "B", FB: "E" };
function normSongNote(note) {
  let t = String(note == null ? "" : note).trim().replace("♯", "#").replace("♭", "b");
  if (t === "" || t === "-" || t.toUpperCase() === "R") return "R";
  const m = t.match(/^([A-Ga-g])(#|b)?(\d)?$/);
  if (!m) return null;
  const L0 = m[1].toUpperCase(), acc = m[2] || "", oct = m[3] || "4";
  let name = acc === "b" ? (_FLAT2[L0 + "B"] || L0) + oct : L0 + acc + oct;
  if (NF[name]) return name;
  return NF[L0 + oct] ? L0 + oct : null;
}
function normalizeSeq(arr) {
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

/* chromatic order for transposing demos to a chosen key */
const CHROMA = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

/* ── music-theory engine: accurate scale/chord notes + recognition ──
   Grounds the AI tutor (never hallucinate notes) and powers live listening. */
const _PCI = { C:0,"C#":1,DB:1,D:2,"D#":3,EB:3,E:4,F:5,"F#":6,GB:6,G:7,"G#":8,AB:8,A:9,"A#":10,BB:10,B:11 };
const SCALE_DEF = {
  major: [0,2,4,5,7,9,11], "natural minor": [0,2,3,5,7,8,10], "harmonic minor": [0,2,3,5,7,8,11],
  "melodic minor": [0,2,3,5,7,9,11], "major pentatonic": [0,2,4,7,9], "minor pentatonic": [0,3,5,7,10],
  blues: [0,3,5,6,7,10], dorian: [0,2,3,5,7,9,10], mixolydian: [0,2,4,5,7,9,10],
};
const CHORD_DEF = {
  major: [0,4,7], minor: [0,3,7], dim: [0,3,6], aug: [0,4,8], sus2: [0,2,7], sus4: [0,5,7],
  maj7: [0,4,7,11], min7: [0,3,7,10], "7": [0,4,7,10], "6": [0,4,7,9], min6: [0,3,7,9], dim7: [0,3,6,9],
};
function pcIdx(pc) { const p = String(pc == null ? "" : pc).trim(); const u = p.charAt(0).toUpperCase() + p.slice(1); return _PCI[p.toUpperCase()] != null ? _PCI[p.toUpperCase()] : (_PCI[u] != null ? _PCI[u] : -1); }
function scaleNotesOf(root, type = "major") { const r = pcIdx(root); if (r < 0) return []; return (SCALE_DEF[type] || SCALE_DEF.major).map(s => CHROMA[(r + s) % 12]); }
function chordNotesOf(root, type = "major") { const r = pcIdx(root); if (r < 0) return []; return (CHORD_DEF[type] || CHORD_DEF.major).map(s => CHROMA[(r + s) % 12]); }
function identifyChord(pcs) {
  const uniq = [...new Set(pcs.map(pcIdx).filter(x => x >= 0))].sort((a, b) => a - b);
  if (uniq.length < 2 || uniq.length > 4) return null;
  for (let root = 0; root < 12; root++) for (const name in CHORD_DEF) {
    const set = [...new Set(CHORD_DEF[name].map(i => (root + i) % 12))].sort((a, b) => a - b);
    if (set.length === uniq.length && set.every((v, i) => v === uniq[i])) return CHROMA[root] + " " + name;
  }
  return null;
}
function identifyScaleRun(pcs) {
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
function interpretPlayed(pcs) { return identifyChord(pcs) || identifyScaleRun(pcs); }
// what the chat log SHOWS: strip the [play:]/[chord:]/... tool syntax and any
// stray screenplay-style *action* text the model might slip into (never meant
// to be read literally — cleanForTTS strips it from SPEECH; this keeps the
// on-screen transcript matching what was actually said).
function vmDisplayText(reply) {
  return String(reply || "")
    .replace(/\[(?:play|chord|highlight|staff|practice|song|metro|posture|ear|plan)[^\]]*\]/gi, "")
    .replace(/\*\*/g, "")               // strip bold markers FIRST (see cleanForTTS) so they can't
    .replace(/\*[^*\n]{1,60}\*/g, "")   // mis-pair with the single-star stage-direction strip below
    .replace(/\s{2,}/g, " ").trim();
}
// analyze timing from note onset timestamps (ms) → tempo + steadiness + rush/drag
function rhythmReport(times) {
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
function normRoot(r) {
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
function splitNote(note) {
  const m = note.match(/^([A-G][#b]?)(\d)$/);
  if (!m) return null;
  return [m[1], parseInt(m[2], 10)];
}
// transpose a list of notes by N semitones, keeping them in range C4..B5
function transposeNotes(notes, semis) {
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
function semisFromC(root) {
  const flatMap = { "DB":"C#","EB":"D#","GB":"F#","AB":"G#","BB":"A#" };
  let u = root.toUpperCase().replace(/♯/g,"#").replace(/♭/g,"b");
  // normalize "Bb"->"A#"
  if (flatMap[u]) u = flatMap[u];
  else u = u.charAt(0) + (u.length>1 ? u.slice(1) : "");
  const idx = CHROMA.indexOf(u);
  return idx < 0 ? 0 : idx;
}

/* ── Standard right-hand fingering for common scales (1-5) ── */
// Right-hand fingerings (ascending). RH scales: thumb-under pattern
const FINGERINGS_RH = {
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
const FINGERINGS_LH = {
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
const TRIAD_FINGER_RH = [1,3,5];
const TRIAD_FINGER_LH = [5,3,1];

// Authoritative fingering reference injected into the AI prompts. The model used to
// hallucinate finger numbers — especially the LEFT hand — so we hand it the exact,
// graded-standard numbers and forbid guessing. Finger numbers are universal (1=thumb
// … 5=pinky) so one block works in every language.
const FINGERING_REF =
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
function getFingers(key, mode, hand) {
  if (mode === "chord") return hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
  const map = hand === "left" ? FINGERINGS_LH : FINGERINGS_RH;
  return map[key] || null;
}
// finger numbers aligned 1:1 to a note list for a given hand (scale by key, or
// triad fallback). Returns null when we have no verified data to recompute from.
function fingersForNotes(key, mode, notes, hand) {
  let f = null;
  if (key) f = getFingers(key, mode, hand);
  else if (mode === "chord" || (mode === "seq" && notes.length === 3)) f = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
  return f ? notes.map((n, i) => (f[i] != null ? f[i] : null)) : null;
}

/* ── Chord/Scale library ── */
const KNOWN = [
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

function extractNotes(text, hand = "right", hint = null, forceKey = null) {
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

  // helper: among entries of the required mode, find the one whose key appears in text
  function matchInMode(mode) {
    const pool = KNOWN.filter(e => e.m === mode);
    for (const e of pool) {
      if (lo.includes(e.k)) return e;
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
      for (const r of roots) {
        if (lo.includes(r + " major") || lo.includes(r + " minor") || lo.includes(r + "major") || lo.includes(r + "minor")) {
          foundRoot = r; break;
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
    if (lo.includes(e.k)) {
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

/* ════════════════════════════════════════════════════════════
   LEARNING PATHWAY CONTENT (Thai) — 8 stages, progressive
════════════════════════════════════════════════════════════ */
const PATHWAY = [
  {
    id: "scale", icon: "🎼", title: { th: "สเกล (Scale)", en: "Scale", zh: "音阶 (Scale)" }, subtitle: { th: "บันไดเสียง — รากฐานของทุกอย่าง", en: "The foundation of everything", zh: "一切的基础" },
    level: 1, color: "#d97757", group: "foundation",
    demo: ["C4","D4","E4","F4","G4","A4","B4","C5"], demoMode: "scale", demoFingers: [1,2,3,1,2,3,4,5],
    learn: {
      th: "ช่วยสอนเรื่อง 'สเกล (Scale)' บนเปียโนแบบละเอียดให้หน่อยครับ อธิบาย: (1) สเกลคืออะไร (2) โครงสร้างและสูตรระยะห่าง W-W-H-W-W-W-H (3) โน้ตทุกตัวในคีย์นี้ (4) นิ้วที่ใช้ทั้งขาขึ้นและขาลง (5) เทคนิคการสอดนิ้วโป้ง (thumb under) (6) ข้อควรระวังและเคล็ดลับการฝึก ตอบเป็นภาษาไทย ระบุชื่อโน้ตทุกตัวเช่น C4 D4 E4 และยกตัวอย่างเพลงที่ใช้สเกลนี้",
      en: "Teach me 'Scales' on piano in detail: (1) what a scale is (2) structure and W-W-H-W-W-W-H formula (3) all notes in this key (4) fingering for both ascending and descending (5) thumb-under technique (6) practice tips and common mistakes. List all note names like C4 D4 E4 and give example songs using this scale.",
      zh: "详细教我钢琴'音阶'：(1)什么是音阶 (2)结构和 W-W-H-W-W-W-H 公式 (3)此调的所有音符 (4)上行和下行的指法 (5)拇指穿越技巧 (6)练习技巧和常见错误。列出所有音名如 C4 D4 E4，并举例使用此音阶的歌曲。"
    },
  },
  {
    id: "interval", icon: "📏", title: { th: "ขั้นคู่ (Interval)", en: "Interval", zh: "音程 (Interval)" }, subtitle: { th: "ระยะห่างระหว่างโน้ต 2 ตัว", en: "Distance between two notes", zh: "两个音之间的距离" },
    level: 2, color: "#ff94e0", group: "foundation",
    demo: ["C4","E4"], demoMode: "chord",
    learn: {
      th: "ช่วยสอนเรื่อง 'ขั้นคู่ (Interval)' บนเปียโนให้หน่อยครับ อธิบายว่าขั้นคู่คืออะไร ขั้นคู่หลักที่ต้องรู้ (3rd, 5th, octave) ความแตกต่างของ Major 3rd กับ Minor 3rd และ Perfect 5th ตอบภาษาไทยและระบุชื่อโน้ต",
      en: "Please teach me about 'Intervals' on piano. Explain what an interval is, the key intervals (3rd, 5th, octave), the difference between Major 3rd and Minor 3rd, and Perfect 5th. List note names.",
      zh: "请教我钢琴上的'音程(Interval)'。解释音程是什么、关键音程(3度、5度、八度)、大三度与小三度的区别，以及纯五度。列出音名。"
    },
    types: [
      { id: "m2", label: { th: "ไมเนอร์ 2",    en: "Minor 2nd",   zh: "小二度" }, symbol: "m2", demo: ["C4","C#4"], demoFingers: [1,2] },
      { id: "M2", label: { th: "เมเจอร์ 2",    en: "Major 2nd",   zh: "大二度" }, symbol: "M2", demo: ["C4","D4"],  demoFingers: [1,2] },
      { id: "m3", label: { th: "ไมเนอร์ 3",    en: "Minor 3rd",   zh: "小三度" }, symbol: "m3", demo: ["C4","D#4"], demoFingers: [1,3] },
      { id: "M3", label: { th: "เมเจอร์ 3",    en: "Major 3rd",   zh: "大三度" }, symbol: "M3", demo: ["C4","E4"],  demoFingers: [1,3] },
      { id: "P4", label: { th: "เพอร์เฟกต์ 4", en: "Perfect 4th", zh: "纯四度" }, symbol: "P4", demo: ["C4","F4"],  demoFingers: [1,4] },
      { id: "TT", label: { th: "ไทรโทน",       en: "Tritone",     zh: "三全音" }, symbol: "TT", demo: ["C4","F#4"], demoFingers: [1,4] },
      { id: "P5", label: { th: "เพอร์เฟกต์ 5", en: "Perfect 5th", zh: "纯五度" }, symbol: "P5", demo: ["C4","G4"],  demoFingers: [1,5] },
      { id: "m6", label: { th: "ไมเนอร์ 6",    en: "Minor 6th",   zh: "小六度" }, symbol: "m6", demo: ["C4","G#4"], demoFingers: [1,5] },
      { id: "M6", label: { th: "เมเจอร์ 6",    en: "Major 6th",   zh: "大六度" }, symbol: "M6", demo: ["C4","A4"],  demoFingers: [1,5] },
      { id: "m7", label: { th: "ไมเนอร์ 7",    en: "Minor 7th",   zh: "小七度" }, symbol: "m7", demo: ["C4","A#4"], demoFingers: [1,5] },
      { id: "M7", label: { th: "เมเจอร์ 7",    en: "Major 7th",   zh: "大七度" }, symbol: "M7", demo: ["C4","B4"],  demoFingers: [1,5] },
      { id: "P8", label: { th: "ออกเทฟ",       en: "Octave",      zh: "八度"   }, symbol: "P8", demo: ["C4","C5"],  demoFingers: [1,5] },
    ],
  },
  {
    id: "triad", icon: "🔺", title: { th: "ไทรแอด (Triad)", en: "Triad", zh: "三和弦 (Triad)" }, subtitle: { th: "คอร์ด 3 เสียง — อิฐก้อนแรก", en: "3-note chord — the first building block", zh: "三音和弦 — 第一块基石" },
    level: 3, color: "#d97757", group: "chords",
    demo: ["C4","E4","G4"], demoMode: "chord", demoFingers: [1,3,5],
    learn: {
      th: "ช่วยสอนเรื่อง 'ไทรแอด (Triad)' บนเปียโนให้หน่อยครับ อธิบายว่าไทรแอดคืออะไร ประกอบด้วย Root, 3rd, 5th ความแตกต่างของ Major/Minor/Diminished/Augmented triad และตัวอย่างคอร์ด progression ยอดฮิต ตอบภาษาไทยและระบุชื่อโน้ต",
      en: "Please teach me about 'Triads' on piano. Explain Root, 3rd, 5th, the difference between Major/Minor/Diminished/Augmented, and a popular chord progression. List note names.",
      zh: "请教我钢琴上的'三和弦(Triad)'。解释根音、三度、五度，大/小/减/增三和弦的区别，以及流行的和弦进行。列出音名。"
    },
    types: [
      { id: "major", label: { th: "เมเจอร์", en: "Major",      zh: "大三" }, symbol: "Δ",  demo: ["C4","E4","G4"],   demoFingers: [1,3,5] },
      { id: "minor", label: { th: "ไมเนอร์", en: "Minor",      zh: "小三" }, symbol: "m",  demo: ["C4","D#4","G4"],  demoFingers: [1,3,5] },
      { id: "dim",   label: { th: "ดิมินิช", en: "Diminished", zh: "减三" }, symbol: "°",  demo: ["C4","D#4","F#4"], demoFingers: [1,3,5] },
      { id: "aug",   label: { th: "ออกเมนต์", en: "Augmented", zh: "增三" }, symbol: "+",  demo: ["C4","E4","G#4"],  demoFingers: [1,3,5] },
    ],
    typesInfo: {
      th: `🔺 4 ชนิดของ Triad (ตัวอย่างคีย์ C)

1️⃣ เมเจอร์ (Major) — สูตร 1-3-5
C–E–G · เสียงสดใส มั่นคง

2️⃣ ไมเนอร์ (Minor) — 1-♭3-5
C–E♭–G · เสียงเศร้า นุ่มลึก

3️⃣ ดิมินิช (Diminished) — 1-♭3-♭5
C–E♭–G♭ · เสียงตึง อึดอัด

4️⃣ ออกเมนต์ (Augmented) — 1-3-♯5
C–E–G♯ · เสียงแปลก ลึกลับ

💡 ต่างกันแค่โน้ตตัวที่ 3 และ 5 เท่านั้น!`,
      en: `🔺 The 4 types of Triad (example in C)

1️⃣ Major — formula 1-3-5
C–E–G · bright, stable

2️⃣ Minor — 1-♭3-5
C–E♭–G · sad, soft

3️⃣ Diminished — 1-♭3-♭5
C–E♭–G♭ · tense, uneasy

4️⃣ Augmented — 1-3-♯5
C–E–G♯ · strange, mysterious

💡 Only the 3rd and 5th change between them!`,
      zh: `🔺 三和弦的4种类型（以C为例）

1️⃣ 大三和弦 (Major) — 公式 1-3-5
C–E–G · 明亮、稳定

2️⃣ 小三和弦 (Minor) — 1-♭3-5
C–E♭–G · 忧伤、柔和

3️⃣ 减三和弦 (Diminished) — 1-♭3-♭5
C–E♭–G♭ · 紧张、不安

4️⃣ 增三和弦 (Augmented) — 1-3-♯5
C–E–G♯ · 奇异、神秘

💡 区别只在第3音和第5音！`,
    },
  },
  {
    id: "seventh", icon: "7️⃣", title: { th: "เซเวนท์คอร์ด (7th Chord)", en: "7th Chord", zh: "七和弦 (7th Chord)" }, subtitle: { th: "เพิ่มมิติด้วยโน้ตตัวที่ 4", en: "Add depth with a 4th note", zh: "用第四个音增添层次" },
    level: 4, color: "#ff59c7", group: "chords",
    demo: ["C4","E4","G4","B4"], demoMode: "chord", demoFingers: [1,2,3,5],
    learn: {
      th: "ช่วยสอนเรื่อง 'เซเวนท์คอร์ด (7th Chord)' บนเปียโนให้หน่อยครับ อธิบาย maj7, dominant 7, min7 ความแตกต่างของอารมณ์แต่ละแบบ และการใช้ในเพลง Jazz/Soul/Funk ตอบภาษาไทยและระบุชื่อโน้ต เช่น Cmaj7 = C4 E4 G4 B4",
      en: "Please teach me about '7th Chords' on piano. Explain maj7, dominant 7, min7, their emotional differences, and usage in Jazz/Soul/Funk. List note names e.g. Cmaj7 = C4 E4 G4 B4.",
      zh: "请教我钢琴上的'七和弦(7th Chord)'。解释大七、属七、小七和弦，各自的情感差异，以及在爵士/灵魂/放克中的运用。列出音名如 Cmaj7 = C4 E4 G4 B4。"
    },
    types: [
      { id: "maj7",    label: { th: "เมเจอร์ 7",          en: "Major 7",       zh: "大七"   }, symbol: "maj7", demo: ["C4","E4","G4","B4"],    demoFingers: [1,2,3,5] },
      { id: "dom7",    label: { th: "โดมินันต์ 7",         en: "Dominant 7",    zh: "属七"   }, symbol: "7",    demo: ["C4","E4","G4","A#4"],   demoFingers: [1,2,3,5] },
      { id: "min7",    label: { th: "ไมเนอร์ 7",           en: "Minor 7",       zh: "小七"   }, symbol: "m7",   demo: ["C4","D#4","G4","A#4"],  demoFingers: [1,2,3,5] },
      { id: "minmaj7", label: { th: "ไมเนอร์-เมเจอร์ 7",  en: "Minor-Major 7", zh: "小大七" }, symbol: "mΔ7", demo: ["C4","D#4","G4","B4"],   demoFingers: [1,2,3,5] },
      { id: "halfdim", label: { th: "ฮาล์ฟดิมินิช",       en: "Half-Dim",      zh: "半减七" }, symbol: "ø7",  demo: ["C4","D#4","F#4","A#4"], demoFingers: [1,2,3,5] },
      { id: "dim7",    label: { th: "ดิมินิช 7",           en: "Diminished 7",  zh: "减七"   }, symbol: "°7",  demo: ["C4","D#4","F#4","A4"],  demoFingers: [1,2,3,5] },
      { id: "aug7",    label: { th: "ออกเมนต์ 7",          en: "Augmented 7",   zh: "增七"   }, symbol: "+7",  demo: ["C4","E4","G#4","A#4"],  demoFingers: [1,2,3,5] },
      { id: "augmaj7", label: { th: "ออกเมนต์-เมเจอร์ 7", en: "Aug-Major 7",  zh: "增大七" }, symbol: "+Δ7", demo: ["C4","E4","G#4","B4"],   demoFingers: [1,2,3,5] },
    ],
    typesInfo: {
      th: `7️⃣ 8 ชนิดของ 7th Chord (ตัวอย่างคีย์ C)

1️⃣ Major 7 (maj7) — 1-3-5-7
C–E–G–B · หรูหรา นุ่มนวล

2️⃣ Dominant 7 (7) — 1-3-5-♭7
C–E–G–B♭ · อยากเคลื่อนต่อ (บลูส์/แจ๊ส)

3️⃣ Minor 7 (m7) — 1-♭3-5-♭7
C–E♭–G–B♭ · นุ่ม เท่

4️⃣ Minor-Major 7 (mMaj7) — 1-♭3-5-7
C–E♭–G–B · ลึกลับ (สไตล์เจมส์ บอนด์)

5️⃣ Half-Diminished (m7♭5) — 1-♭3-♭5-♭7
C–E♭–G♭–B♭ · หม่นเศร้า

6️⃣ Diminished 7 (dim7) — 1-♭3-♭5-♭♭7
C–E♭–G♭–A · ตึงสุด ใช้เชื่อมคอร์ด

7️⃣ Augmented 7 (7♯5) — 1-3-♯5-♭7
C–E–G♯–B♭ · โดมินันต์แปลกๆ

8️⃣ Aug-Major 7 (maj7♯5) — 1-3-♯5-7
C–E–G♯–B · ฝันลอย ล้ำๆ

💡 เกิดจากการผสม 3rd, 5th, 7th แบบต่างๆ`,
      en: `7️⃣ The 8 types of 7th Chord (example in C)

1️⃣ Major 7 (maj7) — 1-3-5-7
C–E–G–B · lush, smooth

2️⃣ Dominant 7 (7) — 1-3-5-♭7
C–E–G–B♭ · wants to resolve (blues/jazz)

3️⃣ Minor 7 (m7) — 1-♭3-5-♭7
C–E♭–G–B♭ · soft, cool

4️⃣ Minor-Major 7 (mMaj7) — 1-♭3-5-7
C–E♭–G–B · mysterious (James Bond)

5️⃣ Half-Diminished (m7♭5) — 1-♭3-♭5-♭7
C–E♭–G♭–B♭ · melancholy

6️⃣ Diminished 7 (dim7) — 1-♭3-♭5-♭♭7
C–E♭–G♭–A · most tense, a connector

7️⃣ Augmented 7 (7♯5) — 1-3-♯5-♭7
C–E–G♯–B♭ · an edgy dominant

8️⃣ Aug-Major 7 (maj7♯5) — 1-3-♯5-7
C–E–G♯–B · dreamy, floating

💡 Built by mixing the 3rd, 5th and 7th.`,
      zh: `7️⃣ 七和弦的8种类型（以C为例）

1️⃣ 大七 (maj7) — 1-3-5-7
C–E–G–B · 华丽、柔顺

2️⃣ 属七 (7) — 1-3-5-♭7
C–E–G–B♭ · 渴望解决（蓝调/爵士）

3️⃣ 小七 (m7) — 1-♭3-5-♭7
C–E♭–G–B♭ · 柔和、酷

4️⃣ 小大七 (mMaj7) — 1-♭3-5-7
C–E♭–G–B · 神秘（007风格）

5️⃣ 半减七 (m7♭5) — 1-♭3-♭5-♭7
C–E♭–G♭–B♭ · 忧郁

6️⃣ 减七 (dim7) — 1-♭3-♭5-♭♭7
C–E♭–G♭–A · 最紧张，用于连接

7️⃣ 增七 (7♯5) — 1-3-♯5-♭7
C–E–G♯–B♭ · 另类属和弦

8️⃣ 增大七 (maj7♯5) — 1-3-♯5-7
C–E–G♯–B · 梦幻、飘渺

💡 由不同的三度、五度、七度组合而成。`,
    },
  },
  {
    id: "tension", icon: "⚡", title: { th: "เทนชั่น (Tension)", en: "Tension", zh: "张力音 (Tension)" }, subtitle: { th: "โน้ตสีสัน 9, 11, 13", en: "Color notes — 9, 11, 13", zh: "色彩音 — 9、11、13" },
    level: 5, color: "#ff94e0", group: "advanced",
    demo: ["C4","E4","G4","B4","D5"], demoMode: "chord",
    learn: {
      th: "ช่วยสอนเรื่อง 'เทนชั่น (Tension)' บนเปียโนให้หน่อยครับ อธิบายว่า tension คืออะไร โน้ต 9th, 11th, 13th การสร้าง extended chord และการ resolve ตอบภาษาไทยและระบุชื่อโน้ต เช่น Cmaj9 = C4 E4 G4 B4 D5",
      en: "Please teach me about 'Tension' on piano. Explain 9th, 11th, 13th notes, building extended chords, and resolution. List note names e.g. Cmaj9 = C4 E4 G4 B4 D5.",
      zh: "请教我钢琴上的'张力音(Tension)'。解释9度、11度、13度音符，构建扩展和弦，以及解决。列出音名如 Cmaj9 = C4 E4 G4 B4 D5。"
    },
  },
  {
    id: "blockchord", icon: "🧱", title: { th: "บล็อกคอร์ดใต้ทำนอง", en: "Block Chords", zh: "块状和弦" }, subtitle: { th: "เล่นคอร์ดพร้อมเมโลดี้", en: "Block Chord Under the Melody", zh: "在旋律下弹奏块状和弦" },
    level: 6, color: "#ff76d8", group: "advanced",
    demo: ["C4","E4","G4"], demoMode: "chord",
    learn: {
      th: "ช่วยสอนเรื่อง 'Block Chord ใต้ทำนอง (Block Chord Under the Melody)' บนเปียโนให้หน่อยครับ อธิบายเทคนิคเล่นคอร์ดเต็มพร้อมโน้ตทำนองบนสุด สไตล์ George Shearing และการประยุกต์ใน solo piano ตอบภาษาไทยและระบุชื่อโน้ต",
      en: "Please teach me about 'Block Chords Under the Melody' on piano. Explain playing full chords with the melody on top, the George Shearing style, and solo piano application. List note names.",
      zh: "请教我钢琴上的'旋律下方的块状和弦(Block Chord)'。解释如何在旋律下方演奏完整和弦、George Shearing风格，以及独奏钢琴的应用。列出音名。"
    },
  },
  {
    id: "slashchord", icon: "➗", title: { th: "สแลชคอร์ด (Slash Chord)", en: "Slash Chord", zh: "斜杠和弦 (Slash Chord)" }, subtitle: { th: "คอร์ดที่มีเบสต่างจากราก", en: "A chord with a different bass note", zh: "低音不同于根音的和弦" },
    level: 7, color: "#ff5252", group: "advanced",
    demo: ["E4","G4","C5"], demoMode: "chord",
    learn: {
      th: "ช่วยสอนเรื่อง 'สแลชคอร์ด (Slash Chord)' บนเปียโนให้หน่อยครับ อธิบายว่า C/E คืออะไร การสร้าง bass line ที่เคลื่อนนุ่มนวล และการใช้ใน Gospel/Soul/Ballad ตอบภาษาไทยและระบุชื่อโน้ต",
      en: "Please teach me about 'Slash Chords' on piano. Explain what C/E means, creating smooth bass lines, and usage in Gospel/Soul/Ballad. List note names.",
      zh: "请教我钢琴上的'斜线和弦(Slash Chord)'。解释C/E是什么、创建流畅的低音线，以及在福音/灵魂/抒情中的运用。列出音名。"
    },
  },
  {
    id: "padchord", icon: "🌫️", title: { th: "แพดคอร์ด (Pad Chord)", en: "Pad Chord", zh: "铺底和弦 (Pad Chord)" }, subtitle: { th: "Harmony ขั้นสูง — เสียงพื้นหลังที่ลอย", en: "Advanced harmony — floating background", zh: "高级和声 — 漂浮的背景音" },
    level: 8, color: "#ffb8d0", group: "advanced",
    demo: ["C4","G4","B4","D5","E5"], demoMode: "chord",
    learn: {
      th: "ช่วยสอนเรื่อง 'แพดคอร์ด (Pad Chord)' และ voicing ขั้นสูงบนเปียโนให้หน่อยครับ อธิบาย open voicing การกระจายโน้ตแบบ 4th/5th และการใช้ใน EDM/Ambient/Neo Soul เพื่อสร้างบรรยากาศล้ำๆ ตอบภาษาไทยและระบุชื่อโน้ต",
      en: "Please teach me about 'Pad Chords' and advanced voicing on piano. Explain open voicing, spreading notes in 4ths/5ths, and usage in EDM/Ambient/Neo Soul. List note names.",
      zh: "请教我钢琴上的'铺底和弦(Pad Chord)'和高级配置。解释开放配置、以4度/5度分散音符，以及在EDM/氛围/新灵魂乐中的运用。列出音名。"
    },
  },
  /* ───────── BENEFITS OF MUSIC — knowledge chapters (read, no key) ───────── */
  {
    id: "why-music", icon: "🌍", level: 9, color: "#ff76d8", group: "benefits",
    title: { th: "ประโยชน์ของดนตรี", en: "Why Music Matters", zh: "音乐的力量" },
    subtitle: { th: "ทำไมดนตรีถึงทรงพลัง", en: "The power of music", zh: "为何音乐如此重要" },
    content: {
      th: `🌍 ดนตรีไม่ใช่แค่ความบันเทิง แต่เป็นเครื่องมือที่ส่งผลต่อสมอง อารมณ์ เศรษฐกิจ และสังคม

🧠 ต่อสมองและอารมณ์
• กระตุ้นการหลั่งโดพามีน (สารแห่งความสุข) และลดฮอร์โมนความเครียด cortisol
• ช่วยความจำ สมาธิ และการเรียนรู้ — เด็กที่เล่นดนตรีมักมีพัฒนาการด้านภาษาและคณิตศาสตร์ดีขึ้น

🤝 ต่อสังคม
• สร้างความรู้สึกเป็นอันหนึ่งอันเดียวกัน ปลุกอารมณ์ร่วมของคนหมู่มาก
• เป็น "ภาษาสากล" ที่สื่อสารข้ามวัฒนธรรมและพรมแดน

ใน 5 บทถัดไป เราจะดูว่ามนุษย์ใช้ดนตรีจริงอย่างไรใน: ธุรกิจ 💼 · การทหาร 🎺 · ความเป็นชาติ 🇹🇭 · ชนชั้นสูง 👑 · และการบำบัดรักษา 💚`,
      en: `🌍 Music is not just entertainment — it shapes the brain, emotions, the economy and society.

🧠 Brain & emotion
• Triggers dopamine (the "feel-good" chemical) and lowers the stress hormone cortisol
• Boosts memory, focus and learning — kids who play music often gain language and math skills

🤝 Society
• Builds unity and stirs the shared emotion of large crowds
• A "universal language" that crosses cultures and borders

In the next 5 chapters we'll see how people really use music in: Business 💼 · the Military 🎺 · National identity 🇹🇭 · the Elite 👑 · and Healing 💚`,
      zh: `🌍 音乐不只是娱乐，它影响大脑、情绪、经济与社会。

🧠 大脑与情绪
• 促进多巴胺（快乐物质）分泌，降低压力激素皮质醇
• 提升记忆、专注与学习——学音乐的孩子常在语言和数学上更出色

🤝 社会
• 凝聚人心，激发群体共同的情感
• 是跨越文化与国界的"世界语言"

接下来5章，我们将看人类如何真正运用音乐：商业 💼 · 军事 🎺 · 国家认同 🇹🇭 · 精英阶层 👑 · 与疗愈 💚`,
    },
  },
  {
    id: "music-business", icon: "💼", level: 10, color: "#d97757", group: "benefits",
    title: { th: "ดนตรีกับธุรกิจ", en: "Music in Business", zh: "音乐与商业" },
    subtitle: { th: "เสียงที่ขายของได้", en: "Sound that sells", zh: "会卖货的声音" },
    content: {
      th: `💼 เสียงสร้างยอดขายและแบรนด์ได้จริง

🛒 เพลงในร้าน = ยอดขาย
งานวิจัยคลาสสิกของ Milliman (1982): เปิดเพลงจังหวะช้าในซูเปอร์มาร์เก็ต ทำให้ลูกค้าเดินช้าลง อยู่นานขึ้น ยอดขายเพิ่มถึง ~38% ในร้านอาหาร เพลงช้าทำให้ลูกค้านั่งนานและสั่งเครื่องดื่มมากขึ้น

🔔 Sonic Branding (โลโก้เสียง)
• Intel เสียง 4 โน้ต มูลค่าแบรนด์กว่า 200 ล้านดอลลาร์
• Mastercard สร้างเสียง 6 โน้ตที่ดังทุกครั้งที่จ่ายเงิน (2019)
• McDonald's "I'm Lovin' It" — แบรนด์ที่มี sonic logo จดจำได้สูงขึ้นถึง 8 เท่า

🌎 ระดับโลก: Coca-Cola, Apple, Spotify ใช้ดนตรีเป็นหัวใจการตลาด

🇹🇭 ไทย: วงร็อก "คาราบาว" ต่อยอดเป็นเครื่องดื่มชูกำลัง Carabao Daeng จนได้สปอนเซอร์ฟุตบอลอังกฤษ (Carabao Cup) — เปลี่ยนชื่อเสียงทางดนตรีเป็นแบรนด์ระดับโลก

🇨🇳 จีน: เพลงธีม "蜜雪冰城 (Mixue)" ปี 2021 (ดัดแปลงจาก Oh! Susanna) ไวรัลสุดขีด แฮชแท็กบน Douyin/TikTok ทะลุ 1.58 พันล้านครั้ง ดันแบรนด์ชานม-ไอศกรีมโตทั่วเอเชีย

💡 สรุป: เสียง → อารมณ์ → การตัดสินใจซื้อ`,
      en: `💼 Sound really drives sales and brand power.

🛒 In-store music = sales
The classic Milliman (1982) study: slow-tempo music in a supermarket made shoppers linger and lifted sales by ~38%. In restaurants, slow music keeps guests longer and they order more drinks.

🔔 Sonic branding (audio logos)
• Intel's 4-note tune is worth over $200 million in brand value
• Mastercard built a 6-note sound that plays on every payment (2019)
• McDonald's "I'm Lovin' It" — brands with a sonic logo are recalled up to 8× better

🌎 Global: Coca-Cola, Apple and Spotify put music at the heart of marketing.

🇹🇭 Thailand: rock band "Carabao" became the Carabao Daeng energy drink and now sponsors English football's Carabao Cup — turning musical fame into a global brand.

🇨🇳 China: the "Mixue" theme song (2021, adapted from Oh! Susanna) went viral with 1.58 billion plays under Douyin/TikTok hashtags, fueling the tea-and-ice-cream chain across Asia.

💡 Takeaway: sound → emotion → buying decision.`,
      zh: `💼 声音确实能带动销售与品牌力。

🛒 店内音乐 = 销售额
经典的 Milliman（1982）研究：超市播放慢节奏音乐让顾客停留更久，销售额提升约38%。餐厅里慢音乐让客人坐得更久、点更多饮品。

🔔 声音品牌（听觉标志）
• 英特尔的4音旋律品牌价值超2亿美元
• 万事达卡打造每次付款都会响起的6音之声（2019）
• 麦当劳"I'm Lovin' It"——拥有声音标志的品牌记忆度可高出8倍

🌎 全球：可口可乐、苹果、Spotify 都把音乐作为营销核心。

🇹🇭 泰国：摇滚乐队"Carabao（卡拉宝）"延伸成卡拉宝能量饮料，如今赞助英格兰联赛杯（Carabao Cup）——把音乐名气变成全球品牌。

🇨🇳 中国："蜜雪冰城"主题曲（2021，改编自《哦！苏珊娜》）爆红，抖音/TikTok 话题播放量超15.8亿次，推动这家茶饮冰淇淋品牌火遍亚洲。

💡 要点：声音 → 情绪 → 购买决定。`,
    },
  },
  {
    id: "music-military", icon: "🎺", level: 11, color: "#d97757", group: "benefits",
    title: { th: "ดนตรีในกองทัพ", en: "Music in the Military", zh: "军队中的音乐" },
    subtitle: { th: "สั่งการ ปลุกใจ ข่มขวัญ", en: "Command, morale, intimidation", zh: "指挥·士气·震慑" },
    content: {
      th: `🎺 กองทัพใช้ดนตรีมานานนับพันปี

📡 สื่อสารและสั่งการ
ในอดีต กลอง แตร และปี่ ใช้ส่งสัญญาณในสนามรบ เสียงเดินทางไกลและสั่งการทหารจำนวนมากให้เคลื่อนพร้อมกัน (เช่น แตรปลุก แตรโจมตี แตรถอย)

🥁 ขวัญและความสามัคคี
วงดุริยางค์ทหารและการ "นับจังหวะเดิน" (cadence) ทำให้หน่วยเดินพร้อมเพรียง ฮึกเหิม และรู้สึกเป็นหนึ่งเดียว

🎶 ปี่สก็อต (Bagpipes)
กรมทหารสก็อตเป่าปี่นำทัพเข้าสู้ สร้างขวัญฝ่ายตนและข่มขวัญศัตรู โดดเด่นมากในสงครามโลกครั้งที่ 1

🔊 สงครามจิตวิทยา
กองทัพยุคใหม่เคยเปิดเพลงเสียงดังกดดันศัตรู เช่น ปฏิบัติการกดดันนายพลโนรีเอกาที่ปานามา ปี 1989

💡 สรุป: ดนตรี = เครื่องมือบังคับบัญชา ขวัญกำลังใจ และจิตวิทยา`,
      en: `🎺 Armies have used music for thousands of years.

📡 Communication & command
Drums, bugles and fifes once carried orders across the battlefield — sound travels far and moves large numbers of troops together (wake-up, charge, retreat calls).

🥁 Morale & cohesion
Military bands and marching "cadence" calls keep units in step, fired up, and feeling as one.

🎶 Bagpipes
Scottish regiments piped their troops into battle to lift their own morale and unnerve the enemy — famously in World War I.

🔊 Psychological warfare
Modern armies have blasted loud music to pressure opponents — e.g. the operation against General Noriega in Panama, 1989.

💡 Takeaway: music = a tool of command, morale and psychology.`,
      zh: `🎺 军队使用音乐已有数千年。

📡 通信与指挥
古时鼓、号、笛在战场上传递命令——声音传得远，能让大批士兵同步行动（起床号、冲锋号、撤退号）。

🥁 士气与凝聚
军乐队和行进"口令节奏"(cadence) 让队伍步伐一致、斗志高昂、融为一体。

🎶 苏格兰风笛
苏格兰军团吹着风笛冲锋，既鼓舞己方又震慑敌人——一战中尤为著名。

🔊 心理战
现代军队曾用高音量音乐施压对手——例如1989年巴拿马针对诺列加将军的行动。

💡 要点：音乐 = 指挥、士气与心理的工具。`,
    },
  },
  {
    id: "music-nation", icon: "🇹🇭", level: 12, color: "#ff76d8", group: "benefits",
    title: { th: "ดนตรีกับความเป็นชาติ", en: "Music & National Identity", zh: "音乐与国家认同" },
    subtitle: { th: "เสียงที่หลอมรวมผู้คน", en: "Sound that unites a people", zh: "凝聚人民的声音" },
    content: {
      th: `🇹🇭 ดนตรีสร้าง "สำนึกร่วม" ของคนทั้งชาติ

🎵 เพลงชาติ
เครื่องมือสร้างความเป็นชาติที่ทรงพลังที่สุด ประเทศไทยเปิดเพลงชาติทุกวันเวลา 08:00 และ 18:00 ทั่วประเทศ และมีเพลงสรรเสริญพระบารมีในโรงภาพยนตร์

🔥 ปฏิวัติและรวมชาติ
• "La Marseillaise" จุดไฟการปฏิวัติฝรั่งเศส
• "Va, pensiero" ของแวร์ดี กลายเป็นเพลงปลุกใจรวมชาติอิตาลี
• "Finlandia" ของซิเบลิอุส สัญลักษณ์การต่อสู้เพื่อเอกราชของฟินแลนด์

🇨🇳 จีน: เพลงชาติ "义勇军进行曲 (March of the Volunteers)" มาจากภาพยนตร์ปี 1935 เป็นเพลงปลุกใจต้านการรุกราน

🌟 ยุคใหม่: K-pop (เช่น BTS) กลายเป็น "soft power" สร้างภาพลักษณ์และรายได้มหาศาลให้เกาหลีใต้

💡 สรุป: ดนตรีทำให้ผู้คนรู้สึกเป็น "พวกเดียวกัน"`,
      en: `🇹🇭 Music forges a shared sense of nationhood.

🎵 National anthems
The most powerful nation-building tool. Thailand plays its anthem nationwide every day at 08:00 and 18:00, and the Royal Anthem in cinemas.

🔥 Revolution & unification
• "La Marseillaise" lit the fire of the French Revolution
• Verdi's "Va, pensiero" became a rallying song for Italian unification
• Sibelius's "Finlandia" symbolized Finland's fight for independence

🇨🇳 China: the anthem "March of the Volunteers" came from a 1935 film — a song of resistance.

🌟 Today: K-pop (e.g. BTS) is "soft power," building South Korea's image and huge revenue.

💡 Takeaway: music makes people feel they belong to one another.`,
      zh: `🇹🇭 音乐铸就全民共同的"国家感"。

🎵 国歌
最有力的国家建构工具。泰国每天08:00与18:00全国播放国歌，影院里播放颂圣歌。

🔥 革命与统一
• 《马赛曲》点燃法国大革命
• 威尔第《飞吧，思想》成为意大利统一的号召之歌
• 西贝柳斯《芬兰颂》象征芬兰争取独立的抗争

🇨🇳 中国：国歌《义勇军进行曲》源自1935年电影，是抗争之歌。

🌟 当代：K-pop（如 BTS）成为"软实力"，为韩国塑造形象并带来巨大收益。

💡 要点：音乐让人们感到彼此同属一体。`,
    },
  },
  {
    id: "music-elite", icon: "👑", level: 13, color: "#ff59c7", group: "benefits",
    title: { th: "ดนตรีกับชนชั้นสูง", en: "Music & the Elite", zh: "音乐与精英阶层" },
    subtitle: { th: "สัญลักษณ์ของอำนาจและรสนิยม", en: "A symbol of power and taste", zh: "权力与品味的象征" },
    content: {
      th: `👑 ดนตรีเป็นเครื่องแสดงสถานะของชนชั้นสูงมาช้านาน

🎼 ระบบอุปถัมภ์ (Patronage)
ในยุโรป ขุนนางและราชสำนักเลี้ยงดูคีตกวี เช่น ไฮเดิน รับใช้ราชวงศ์ Esterházy; โมสาร์ทและเบโทเฟนพึ่งพาชนชั้นสูงเวียนนา การมีคีตกวีประจำตัวคือเครื่องแสดงรสนิยมและอำนาจ

🇫🇷 ราชสำนักฝรั่งเศส
พระเจ้าหลุยส์ที่ 14 (Sun King) ทรงเต้นบัลเลต์เอง และใช้ดนตรี-นาฏศิลป์ที่พระราชวังแวร์ซายแสดงพระราชอำนาจ

🇹🇭 ไทย
ดนตรีในราชสำนัก (วงปี่พาทย์) สืบทอดยาวนาน และในหลวงรัชกาลที่ 9 ทรงเป็นคีตกวีแจ๊สที่โลกยอมรับ พระราชนิพนธ์ เช่น "สายฝน" และ "H.M. Blues"

🇨🇳 จีน
"雅乐 (yayue)" ดนตรีพิธีในราชสำนัก และ "กู่ฉิน (guqin)" เครื่องดนตรีของปราชญ์และผู้ดีจีน ใช้ขัดเกลาจิตใจให้สูงส่ง

💡 สรุป: ดนตรี = สัญลักษณ์ของอำนาจ การศึกษา และรสนิยมชั้นสูง`,
      en: `👑 Music has long signaled the status of the elite.

🎼 The patronage system
In Europe, nobles and courts employed composers — Haydn served the Esterházy princes; Mozart and Beethoven relied on Vienna's aristocracy. Keeping a composer showed taste and power.

🇫🇷 The French court
Louis XIV, the "Sun King," danced ballet himself and used music and dance at Versailles to display royal power.

🇹🇭 Thailand
Royal court music (piphat ensembles) has a long lineage, and King Rama IX (Bhumibol) was a world-respected jazz composer — works like "Falling Rain (Saiyon)" and "H.M. Blues."

🇨🇳 China
"Yayue" ritual court music, and the "guqin" — the instrument of scholars and gentlemen, used to refine the mind.

💡 Takeaway: music = a symbol of power, education and refined taste.`,
      zh: `👑 音乐长久以来彰显精英阶层的地位。

🎼 赞助制度
在欧洲，贵族与宫廷供养作曲家——海顿为埃斯特哈齐家族服务；莫扎特、贝多芬依赖维也纳贵族。拥有专属作曲家象征品味与权力。

🇫🇷 法国宫廷
"太阳王"路易十四亲自跳芭蕾，并在凡尔赛宫以音乐舞蹈彰显王权。

🇹🇭 泰国
宫廷音乐（披帕乐团）传承悠久；泰国九世王（普密蓬）是受世界尊敬的爵士作曲家，作品如《Falling Rain（สายฝน）》与《H.M. Blues》。

🇨🇳 中国
"雅乐"为宫廷礼仪音乐；"古琴"是文人雅士的乐器，用以修身养性。

💡 要点：音乐 = 权力、教养与高雅品味的象征。`,
    },
  },
  {
    id: "music-therapy", icon: "💚", level: 14, color: "#d97757", group: "benefits",
    title: { th: "ดนตรีบำบัด", en: "Music Therapy", zh: "音乐疗法" },
    subtitle: { th: "เยียวยากาย ใจ และสมอง", en: "Healing & wellness", zh: "疗愈与健康" },
    content: {
      th: `💚 ดนตรีคือ "ยา" ที่ช่วยกาย ใจ และสมอง

🏥 เป็นวิชาชีพการแพทย์จริง
ดนตรีบำบัด (Music Therapy) มีสมาคมวิชาชีพ (เช่น AMTA) และใช้ในโรงพยาบาลทั่วโลก

🧠 ฟื้นฟูสมอง
• ผู้ป่วยหลอดเลือดสมองที่พูดไม่ได้ (aphasia) ใช้ "Melodic Intonation Therapy" ร้องเป็นทำนองเพื่อกลับมาพูด
• ผู้ป่วยพาร์กินสันใช้จังหวะดนตรีช่วยให้เดินมั่นคงขึ้น

💭 ความจำ
ผู้ป่วยอัลไซเมอร์/สมองเสื่อม มักจำเพลงเก่าได้ และตอบสนองดีขึ้นเมื่อได้ฟังเพลงในวัยหนุ่มสาว

😌 ลดเครียดและความเจ็บปวด
ดนตรีลดฮอร์โมน cortisol ความดันโลหิต และความวิตกกังวล จึงใช้ก่อน/ระหว่างผ่าตัด และดูแลทารกคลอดก่อนกำหนด (NICU)

🌟 ตัวอย่างจริง: ส.ส.สหรัฐ Gabby Giffords ฟื้นความสามารถในการพูดด้วยดนตรีบำบัดหลังถูกยิงที่ศีรษะ

💡 สรุป: ดนตรีคือยาไร้ผลข้างเคียงที่เยียวยาทั้งร่างกายและจิตใจ`,
      en: `💚 Music is "medicine" for body, mind and brain.

🏥 A real medical profession
Music therapy has professional bodies (e.g. AMTA) and is used in hospitals worldwide.

🧠 Brain recovery
• Stroke patients who can't speak (aphasia) use "Melodic Intonation Therapy" — singing words back into speech
• Parkinson's patients use musical rhythm to walk more steadily

💭 Memory
People with Alzheimer's/dementia often still remember old songs and respond better to music from their youth.

😌 Less stress & pain
Music lowers cortisol, blood pressure and anxiety — used before/during surgery and in newborn intensive care (NICU).

🌟 Real case: U.S. Congresswoman Gabby Giffords regained her speech through music therapy after being shot in the head.

💡 Takeaway: music is a side-effect-free medicine that heals body and mind.`,
      zh: `💚 音乐是身、心、脑的"良药"。

🏥 真正的医疗专业
音乐疗法有专业协会（如 AMTA），在全球医院中应用。

🧠 大脑康复
• 无法说话的中风（失语症）患者用"旋律语调疗法"，把词语唱回成语言
• 帕金森患者借助音乐节奏让步态更稳

💭 记忆
阿尔茨海默/失智患者常仍记得老歌，听到年轻时的音乐反应更好。

😌 减压与止痛
音乐降低皮质醇、血压与焦虑——用于手术前后及新生儿重症监护（NICU）。

🌟 真实案例：美国国会议员 Gabby Giffords 头部中枪后，通过音乐疗法重新恢复了说话能力。

💡 要点：音乐是没有副作用的良药，疗愈身心。`,
    },
  },
  {
    id: "music-marketing", icon: "📣", level: 15, color: "#ff76d8", group: "benefits",
    title: { th: "การตลาดสำหรับศิลปิน", en: "Marketing for Artists", zh: "音乐人营销" },
    subtitle: { th: "ทำเพลงให้ดังและขายได้", en: "Get heard & get paid", zh: "让作品被听见并变现" },
    content: {
      th: `📣 ยุคนี้ "เก่งอย่างเดียวไม่พอ" — ต้องทำให้คนได้ยินและรักคุณด้วย

🎯 หัวใจ 3 ข้อ
• สร้างฐานแฟน (fanbase) ที่ผูกพัน ไม่ใช่แค่ยอดวิว
• เลือกแพลตฟอร์มให้ถูก — TikTok/Reels คือเครื่องมือค้นพบเบอร์ 1 ของยุคนี้
• หารายได้หลายทาง: สตรีม + ทัวร์ + สินค้า (merch) + แฟนคลับโดยตรง

💸 ความจริงเรื่องเงิน
สตรีมมิ่งจ่ายน้อยมาก (ต่อสตรีม ~$0.003–0.005) ศิลปินยุคใหม่จึงโตด้วย "แฟนตัวจริง" ที่ยอมจ่าย — ทัวร์ เสื้อ ของสะสม และช่องทางตรงถึงแฟน

👉 แตะกรณีศึกษาด้านล่างเพื่อดูว่าศิลปินระดับโลกทำการตลาดยังไง`,
      en: `📣 Today, talent alone isn't enough — you must be heard and loved too.

🎯 Three essentials
• Build a real, bonded fanbase, not just view counts
• Pick the right platform — short video (TikTok/Reels) is today's #1 discovery engine
• Earn from many streams: streaming + touring + merch + direct-to-fan

💸 The money truth
Streaming pays very little (~$0.003–0.005 per stream), so modern artists grow on TRUE fans who pay — tours, shirts, collectibles and direct channels.

👉 Tap a case study below to see how world-class artists market themselves.`,
      zh: `📣 如今光有才华还不够——还必须被听见、被喜爱。

🎯 三大要点
• 打造真正有黏性的粉丝群，而不只是播放量
• 选对平台——短视频（TikTok/Reels）是当今头号发现引擎
• 多元收入：流媒体 + 巡演 + 周边 + 直接面向粉丝

💸 关于钱的真相
流媒体单次播放收入极低（约 $0.003–0.005），所以现代音乐人靠"真爱粉"变现——巡演、T恤、收藏品与直连渠道。

👉 点击下方案例，看看世界级音乐人如何做营销。`,
    },
  },
];

/* ── Local (non-AI) lesson content for the Pathway's core theory stages ──
   Scale/interval/triad/7th-chord topics are 100% formulaic — the same key
   + topic always deserves the exact same theory-accurate lesson, so we
   build it from data already in this file (transposed demo notes + the
   FEEL tables below) instead of re-asking the live AI every time. Instant,
   free, and just as accurate. Anything NOT covered here (tension/block/
   slash/pad chords, or a types-having stage with no type picked yet)
   still asks the live AI exactly as before — prepared answer first, live
   AI as the fallback, never the only option. */
const INTERVAL_FEEL = {
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
const TRIAD_FEEL = {
  major: { th: "เสียงสดใส มั่นคง มีความสุข", en: "bright, stable, happy", zh: "明亮、稳定、快乐", formula: "1–3–5" },
  minor: { th: "เสียงเศร้า นุ่มลึก ให้ความรู้สึกดิบ", en: "sad, soft, and raw", zh: "忧伤、柔和、真实", formula: "1–♭3–5" },
  dim: { th: "เสียงตึง อึดอัด ไม่มั่นคง มักใช้เชื่อมคอร์ด", en: "tense, uneasy, unstable — often used as a passing chord", zh: "紧张、压抑、不稳定，常用作过渡和弦", formula: "1–♭3–♭5" },
  aug: { th: "เสียงแปลก ลึกลับ ล่องลอย", en: "strange, mysterious, floating", zh: "奇特、神秘、飘忽", formula: "1–3–♯5" },
};
const SEVENTH_FEEL = {
  maj7: { th: "หรูหรา นุ่มนวล ฟังสบาย", en: "lush and smooth — easy on the ear", zh: "华丽、柔顺、悦耳", formula: "1–3–5–7" },
  dom7: { th: "อยากคลี่คลายลงไป มักใช้ในบลูส์/แจ๊ส", en: "wants to resolve — a staple of blues and jazz", zh: "渴望解决，是蓝调与爵士的常客", formula: "1–3–5–♭7" },
  min7: { th: "นุ่ม เท่ ผ่อนคลาย", en: "soft, cool, and relaxed", zh: "柔和、酷、放松", formula: "1–♭3–5–♭7" },
  minmaj7: { th: "ลึกลับ สไตล์ธีมสายลับ", en: "mysterious — classic spy-movie sound", zh: "神秘，经典间谍片音色", formula: "1–♭3–5–7" },
  halfdim: { th: "หม่นเศร้า ตึงเครียดเบา ๆ", en: "melancholy, gently tense", zh: "忧郁，略带紧张", formula: "1–♭3–♭5–♭7" },
  dim7: { th: "ตึงที่สุดในกลุ่มนี้ ใช้เชื่อมคอร์ดได้อย่างนุ่มนวล", en: "the tensest of the group — a smooth connector between chords", zh: "此组中最紧张，是和弦间的圆滑过渡", formula: "1–♭3–♭5–♭♭7" },
  aug7: { th: "โดมินันต์แปลกๆ อยากคลี่คลายแบบมีสีสัน", en: "an edgy dominant that resolves with extra color", zh: "另类属和弦，带着色彩感解决", formula: "1–3–♯5–♭7" },
  augmaj7: { th: "ฝันลอย ล้ำสมัย", en: "dreamy and futuristic", zh: "梦幻、前卫", formula: "1–3–♯5–7" },
};
function degreeLabel(i, lang) {
  const TH = ["ราก (Root)", "3rd", "5th", "7th"], EN = ["Root", "3rd", "5th", "7th"], ZH = ["根音 (Root)", "三音", "五音", "七音"];
  const arr = lang === "th" ? TH : lang === "zh" ? ZH : EN;
  return arr[i] || `#${i + 1}`;
}
// stage/key/type → ready-made lesson text, or null (→ caller falls through to the live AI)
function localPathwayLesson(stage, keyId, keyLabel, chordType, demoNotes, fullTitle, lang) {
  const notesTxt = demoNotes.join(" ");
  if (stage.demoMode === "scale" && !stage.types) {
    const T = {
      th: `🎼 ${fullTitle} · ${keyLabel}\n\nโน้ตทั้งหมด: ${notesTxt}\nสูตรระยะห่าง (Whole/Half step): W-W-H-W-W-W-H\n\nนี่คือบันไดเสียงเมเจอร์ — สูตรระยะห่างนี้ใช้ได้กับทุกคีย์เหมือนกันหมด แค่เปลี่ยนโน้ตเริ่มต้น เสียงจะให้ความรู้สึกสดใส มั่นคง เป็นฐานของเพลงส่วนใหญ่ที่เราคุ้นเคย\n\n💡 ฝึกแยกมือก่อน ไล่ขึ้น-ลงช้า ๆ ให้จังหวะสม่ำเสมอ นิ้วโป้งต้องสอดลอดใต้ฝ่ามือแบบนุ่มนวลไม่ยกข้อมือ (ดูเลขนิ้วในผังด้านล่าง) พอชัวร์แล้วค่อยเพิ่มความเร็ว`,
      en: `🎼 ${fullTitle} · ${keyLabel}\n\nAll notes: ${notesTxt}\nStep formula: W-W-H-W-W-W-H (Whole-Whole-Half-Whole-Whole-Whole-Half)\n\nThis is the major scale — that exact step pattern is identical in every key, you just shift the starting note. It sounds bright and stable, and it's the foundation under most music you already know.\n\n💡 Practice hands separately first, slow and even up and down. The thumb should tuck smoothly under the palm without lifting the wrist (see the fingering chart below) — only speed up once it's steady.`,
      zh: `🎼 ${fullTitle} · ${keyLabel}\n\n所有音符：${notesTxt}\n音程公式：W-W-H-W-W-W-H（全-全-半-全-全-全-半）\n\n这是大调音阶——这个公式在每个调都完全一样，只是起始音不同。听起来明亮稳定，是你熟悉的大多数音乐的基础。\n\n💡 先分手练习，上下行都要慢而均匀。大拇指要平顺地穿到手掌下方，不要抬起手腕（参考下方指法图），稳了再加速。`,
    };
    return T[lang] || T.en;
  }
  if (chordType && INTERVAL_FEEL[chordType.id]) {
    const f = INTERVAL_FEEL[chordType.id];
    const T = {
      th: `📏 ${fullTitle} · ${keyLabel}\n\nโน้ต: ${notesTxt} (${degreeLabel(0, lang)} → ${chordType.symbol})\nลักษณะเสียง: ${f.th}\n\n💡 กดสองโน้ตนี้พร้อมกันฟังสีสันของมัน แล้วลองกดแยกทีละตัว (broken) เทียบความรู้สึก ลองหาขั้นคู่นี้ในเพลงที่ชอบดูว่าใช้ตรงไหน`,
      en: `📏 ${fullTitle} · ${keyLabel}\n\nNotes: ${notesTxt} (${degreeLabel(0, lang)} → ${chordType.symbol})\nCharacter: ${f.en}\n\n💡 Play both notes together and listen to that color, then try them broken (one at a time) to compare. See if you can spot this interval in a song you like.`,
      zh: `📏 ${fullTitle} · ${keyLabel}\n\n音符：${notesTxt}（${degreeLabel(0, lang)} → ${chordType.symbol}）\n音色：${f.zh}\n\n💡 同时按下这两个音感受它的色彩，再分开弹（broken）比较一下。试试在喜欢的歌里找找这个音程。`,
    };
    return T[lang] || T.en;
  }
  if (chordType && TRIAD_FEEL[chordType.id]) {
    const f = TRIAD_FEEL[chordType.id];
    const degs = demoNotes.map((n, i) => `${degreeLabel(i, lang)}=${n}`).join(", ");
    const T = {
      th: `🔺 ${fullTitle} · ${keyLabel}\n\nสูตร: ${f.formula}\nโน้ต: ${notesTxt} (${degs})\nลักษณะเสียง: ${f.th}\n\n💡 กดทั้ง 3 โน้ตพร้อมกันเป็น Block chord ก่อน ฟังสีสันให้ชิน แล้วลองไล่ทีละตัว (Broken/Arpeggio) จากล่างขึ้นบน`,
      en: `🔺 ${fullTitle} · ${keyLabel}\n\nFormula: ${f.formula}\nNotes: ${notesTxt} (${degs})\nCharacter: ${f.en}\n\n💡 Play all 3 notes together as a block chord first and get used to the color, then try it broken (arpeggiated) from the bottom up.`,
      zh: `🔺 ${fullTitle} · ${keyLabel}\n\n公式：${f.formula}\n音符：${notesTxt}（${degs}）\n音色：${f.zh}\n\n💡 先把3个音同时按下作为块状和弦，熟悉它的音色，再从下往上分解弹奏（琶音）。`,
    };
    return T[lang] || T.en;
  }
  if (chordType && SEVENTH_FEEL[chordType.id]) {
    const f = SEVENTH_FEEL[chordType.id];
    const degs = demoNotes.map((n, i) => `${degreeLabel(i, lang)}=${n}`).join(", ");
    const T = {
      th: `7️⃣ ${fullTitle} · ${keyLabel}\n\nสูตร: ${f.formula}\nโน้ต: ${notesTxt} (${degs})\nลักษณะเสียง: ${f.th}\n\n💡 กดพร้อมกันฟังก่อน แล้วลองไล่ทีละตัวจากล่างขึ้นบน คอร์ด 7 มักใช้ในแจ๊ส โซล และฟังก์`,
      en: `7️⃣ ${fullTitle} · ${keyLabel}\n\nFormula: ${f.formula}\nNotes: ${notesTxt} (${degs})\nCharacter: ${f.en}\n\n💡 Play it as a block first, then roll it from the bottom up. 7th chords show up constantly in jazz, soul and funk.`,
      zh: `7️⃣ ${fullTitle} · ${keyLabel}\n\n公式：${f.formula}\n音符：${notesTxt}（${degs}）\n音色：${f.zh}\n\n💡 先同时按下听听，再从下往上分解弹奏。七和弦在爵士、灵魂乐和放克中非常常见。`,
    };
    return T[lang] || T.en;
  }
  return null; // no local template for this combo — ask the live AI (2nd tier)
}

/* World-class case studies — clickable sub-topics under each "benefits" chapter */
const BENEFIT_CASES = {
  "why-music": [
    { id: "elsistema", icon: "🇻🇪", title: { th: "El Sistema", en: "El Sistema", zh: "El Sistema 体系" },
      content: { th: `🇻🇪 El Sistema — จากโรงรถร้างสู่เด็ก 1.2 ล้านคน\n\nปี 1975 José Antonio Abreu นักเศรษฐศาสตร์และนักดนตรีชาวเวเนซุเอลา รวมเด็ก 11 คนในโรงจอดรถร้างกลางกรุงการากัส เริ่มซ้อมดนตรีด้วยกัน เขาเรียกแนวคิดนี้ว่า 'ดนตรีเพื่อการเปลี่ยนแปลงทางสังคม' — และที่สำคัญคือให้กระทรวง 'สวัสดิการสังคม' เป็นผู้สนับสนุนงบ ไม่ใช่กระทรวงศิลปวัฒนธรรม ความตั้งใจชัดเจนตั้งแต่วันแรก: นี่ไม่ใช่โครงการปั้นนักเปียโนคอนเสิร์ต แต่เป็นการมอบสิ่งที่กล่องไวโอลินเก็บไว้ได้ แต่แก๊งอันธพาลแย่งไปไม่ได้ — วินัย ความรู้สึกเป็นส่วนหนึ่ง และเหตุผลให้มาโรงเรียนทุกวัน\n\nผ่านไป 50 ปี El Sistema (ชื่อทางการ FESNOJIV) เข้าถึงเด็กราว 1.2 ล้านคนทั่วเวเนซุเอลา จากที่มีเพียง 60,000 คนตอน Eduardo Méndez เข้ารับตำแหน่งผู้อำนวยการบริหารปี 2008 ศิษย์เก่าที่โด่งดังที่สุดคือ Gustavo Dudamel ผู้เริ่มเล่นไวโอลินตั้งแต่เด็กใน El Sistema และปัจจุบันเป็นผู้อำนวยการดนตรีของทั้ง LA Philharmonic และวง Simón Bolívar Symphony Orchestra ของเวเนซุเอลาเอง — วงเดียวกับที่ระบบนี้ปั้นเขาขึ้นมา ภายหลัง Dudamel ยังสร้าง YOLA (Youth Orchestra Los Angeles) ในสหรัฐฯ นำโมเดลของ El Sistema — แจกเครื่องดนตรีฟรี ซ้อมกลุ่มทุกวัน รุ่นพี่สอนรุ่นน้อง — ไปปลูกในย่านยากจนที่สุดของ LA\n\nแนวคิดนี้ถูกนำไปใช้ทั่วโลก ปัจจุบันมีโครงการที่ได้แรงบันดาลใจจาก El Sistema ในกว่า 70 ประเทศ รวมถึงอย่างน้อย 80 โครงการแยกกันในสหรัฐฯ เพียงประเทศเดียว\n\n💡 บทเรียน: El Sistema ไม่ได้สำเร็จเพราะสอนทฤษฎีดนตรีเร็วกว่าใคร แต่สำเร็จเพราะการเล่นดนตรีเป็นวง — การมาให้ตรงเวลา ฟังเพื่อนร่วมวง เล่นส่วนของตัวเองให้วงทั้งหมดฟังดี — สอนทักษะสังคมที่ชุมชนยากไร้ต้องการที่สุดโดยไม่รู้ตัว (วินัย การทำงานเป็นทีม คุณค่าในตัวเอง) สิ่งที่ Abreu คิดค้นจริงๆ ไม่ใช่หลักสูตร แต่คือการทำให้ดนตรีเป็น 'นโยบายสังคม' ไม่ใช่แค่ 'นโยบายศิลปะ'`,
        en: `🇻🇪 El Sistema — from a garage to 1.2 million children\n\nIn 1975, Venezuelan economist, musician and activist José Antonio Abreu gathered just 11 students in an abandoned parking garage in Caracas and started rehearsing. He called his idea 'Music for Social Change' — and, crucially, had it funded not by the ministry of arts, but by the ministry of social welfare. The message was clear from day one: this was never really about producing concert pianists. It was about giving Venezuela's poorest children something a violin case can hold that a rival gang can't take away — discipline, belonging, and a reason to show up every single day.\n\nFifty years later, El Sistema (formally FESNOJIV) reaches an estimated 1.2 million children across Venezuela, up from about 60,000 when Eduardo Méndez became executive director in 2008. Its most famous graduate is Gustavo Dudamel, who started on the violin as a boy in El Sistema and now serves as Music & Artistic Director of both the Los Angeles Philharmonic and Venezuela's own Simón Bolívar Symphony Orchestra — the very orchestra the program built him toward. Dudamel later built YOLA (Youth Orchestra Los Angeles) in the US, transplanting El Sistema's model — free instruments, daily group rehearsal, older students teaching younger ones — into some of LA's poorest neighborhoods.\n\nThe idea proved exportable: comparable 'El Sistema-inspired' programs now operate in more than 70 countries, including at least 80 separate programs across the United States alone.\n\n💡 Lesson: El Sistema didn't succeed by teaching music theory faster. It succeeded because ensemble music — showing up, listening to each other, playing your part so the whole group sounds right — quietly teaches the exact social skills (discipline, teamwork, self-worth) struggling communities need most. Abreu's real invention wasn't a curriculum; it was funding music as social policy, not art policy.`,
        zh: `🇻🇪 El Sistema——从废弃车库到120万儿童\n\n1975年，委内瑞拉经济学家兼音乐家何塞·安东尼奥·阿布雷乌（José Antonio Abreu）在加拉加斯一个废弃停车场里召集了11名学生，开始一起排练。他把这个构想称为"音乐促进社会变革"——关键在于，资助它的不是文化艺术部，而是社会福利部。从第一天起，目标就很清楚：这从来不是要培养音乐会钢琴家，而是给委内瑞拉最贫困的孩子一样帮派抢不走的东西——纪律、归属感，以及每天都愿意出现的理由。\n\n五十年后，El Sistema（正式名称FESNOJIV）覆盖委内瑞拉全国约120万儿童，而2008年Eduardo Méndez就任执行主任时这个数字仅约6万。最著名的毕业生是古斯塔沃·杜达梅尔（Gustavo Dudamel），他幼年在El Sistema学习小提琴，如今身兼洛杉矶爱乐乐团与委内瑞拉西蒙·玻利瓦尔交响乐团（正是培养他的那支乐团）的音乐总监。后来杜达梅尔在美国创立YOLA（洛杉矶青年管弦乐团），把El Sistema的模式——免费乐器、每日集体排练、高年级教低年级——移植到洛杉矶最贫困的社区。\n\n这个理念被证明可以输出：如今全球70多个国家都有受El Sistema启发的类似项目，仅美国一地就有至少80个独立项目。\n\n💡 启示：El Sistema的成功不是因为教乐理教得更快，而是因为合奏音乐——准时到场、倾听同伴、弹好自己的声部让整体听起来和谐——在不知不觉中教会了贫困社区最需要的社会技能（纪律、协作、自我价值感）。阿布雷乌真正的创造不是一套课程，而是把音乐当作"社会政策"而非"艺术政策"来投入资金。` } },
    { id: "voyager", icon: "🛰️", title: { th: "แผ่นทองคำ Voyager", en: "NASA Golden Record", zh: "旅行者金唱片" },
      content: { th: `🛰️ แผ่นเสียงทองคำ — เมื่อมนุษย์เลือก "ดนตรี" เป็นตัวแทนตัวเอง\n\nปี 1977 แผ่นเสียงทองแดงชุบทองคำที่เหมือนกันสองแผ่นถูกติดไว้ข้างยานอวกาศ Voyager 1 และ Voyager 2 ของนาซาก่อนปล่อยออกไปยังขอบระบบสุริยะ คณะกรรมการที่มีนักดาราศาสตร์ Carl Sagan เป็นประธาน — พร้อมด้วยผู้กำกับศิลป์ Ann Druyan, โปรดิวเซอร์ Timothy Ferris, นักชาติพันธุ์ดนตรีวิทยา Robert E. Brown และ Alan Lomax และวิศวกรเสียงหนุ่มชื่อ Jimmy Iovine (ผู้ภายหลังร่วมก่อตั้งค่าย Interscope Records และแบรนด์ Beats) — ต้องตัดสินใจภายในไม่กี่เดือนว่าอะไรคือตัวแทนที่ดีที่สุดของมวลมนุษยชาติ สำหรับใครก็ตามที่อาจพบแผ่นนี้สักวันหนึ่ง ที่ไหนสักแห่ง\n\nพวกเขาเลือกภาพ 116 ภาพ เสียงธรรมชาติอย่างลมและเสียงวาฬ คำทักทายใน 55 ภาษา — และหัวใจของแผ่นเสียงคือดนตรีความยาวราว 90 นาที รวม 27 เพลง ตั้งแต่ Bach และ Beethoven ไปจนถึงบทสวดกลางคืนของชาวนาวาโฮ จังหวะเพอร์คัสชันจากเซเนกัล ปี่แพนของเปรู และเพลงชากูฮาจิของญี่ปุ่น เพลงที่ถกเถียงกันมากที่สุดคือ "Johnny B. Goode" ของ Chuck Berry — Lomax แย้งว่าร็อกแอนด์โรลนั้น "เป็นแค่ของวัยรุ่น" ไม่ควรอยู่ในนั้น แต่คำตอบของ Sagan กลายเป็นหนึ่งในประโยคที่ถูกอ้างอิงมากที่สุดของโครงการนี้: "ในดาวเคราะห์ดวงนี้มีวัยรุ่นเยอะแยะนะ" ริฟฟ์กีตาร์ของ Berry จึงได้ไปต่อ\n\nอีกหนึ่งรายละเอียดที่คนไม่ค่อยพูดถึง: ทีมงานบันทึกคลื่นสมองและการเต้นของหัวใจของ Ann Druyan ผู้กำกับศิลป์เป็นเวลาราวหนึ่งชั่วโมง ขณะที่เธอคิดถึงประวัติศาสตร์โลก อารยธรรมต่างๆ และการตกหลุมรัก — แล้วบีบอัดชั่วโมงนั้นให้เหลือเสียงราวหนึ่งนาที บรรจุไว้ในแผ่นเดียวกัน\n\n💡 บทเรียน: จากทุกสิ่งที่มนุษย์เคยสร้างมา ทีมงานไม่ได้เลือกส่งสูตรคณิตศาสตร์หรือตำราปรัชญาไปเป็นบัตรแนะนำตัวของมนุษยชาติ พวกเขาเลือกส่ง "ดนตรี" — เพราะเชื่อว่านี่คือสิ่งเดียวที่อาจข้ามผ่านกำแพงภาษาที่อาจไม่ต้องใช้ภาษาเลยด้วยซ้ำ`,
        en: `🛰️ The Golden Record — humanity picked music to speak for us\n\nIn 1977, two identical gold-plated copper phonograph records were bolted to the sides of NASA's Voyager 1 and Voyager 2 spacecraft before they launched toward, and eventually past, the edge of the solar system. A committee chaired by astronomer Carl Sagan — including creative director Ann Druyan, producer Timothy Ferris, ethnomusicologists Robert E. Brown and Alan Lomax, and a young sound engineer named Jimmy Iovine (who'd later co-found Interscope Records and Beats Electronics) — had to decide, in a few months, what best represented the entire human species to whoever might find it, someday, somewhere.\n\nThey chose 116 images, natural sounds like wind and whale song, spoken greetings in 55 languages — and, at the emotional center of the record, roughly 90 minutes of music: 27 tracks spanning Bach and Beethoven to a Navajo night chant, Senegalese percussion, Peruvian panpipes, and a Japanese shakuhachi piece. The most-debated inclusion was Chuck Berry's 'Johnny B. Goode.' Lomax argued rock and roll was 'adolescent' and didn't belong; Sagan's answer became one of the most quoted lines in the whole project: 'There are a lot of adolescents on the planet.' Berry's guitar riff won.\n\nOne more detail rarely makes it into the highlight reel: for about an hour, technicians recorded creative director Ann Druyan's own brainwaves and heartbeat while she thought about Earth's history, its civilizations, falling in love — then compressed that hour into roughly one minute of sound, riding along on the same record.\n\n💡 Lesson: given the entire span of human achievement to choose from, the team didn't send a mathematical proof or a philosophy text as humanity's calling card. They sent music — because it was the one thing they believed could cross a language barrier that might not even involve language at all.`,
        zh: `🛰️ 金唱片——人类选择用"音乐"代表自己\n\n1977年，两张一模一样的镀金铜质唱片被固定在NASA旅行者1号和旅行者2号探测器的侧面，随后飞向并最终飞出太阳系边缘。一个由天文学家卡尔·萨根（Carl Sagan）担任主席的委员会——成员包括创意总监安·德鲁扬（Ann Druyan）、制作人蒂莫西·费里斯（Timothy Ferris）、民族音乐学家罗伯特·E·布朗和艾伦·洛马克斯，以及一位后来创办Interscope唱片公司和Beats品牌的年轻音响工程师吉米·艾欧文（Jimmy Iovine）——必须在短短几个月内决定：什么最能代表整个人类物种，留给未来某天、某处可能发现它的任何生命。\n\n他们最终选定116张图像、风声与鲸鸣等自然声音、55种语言的问候语——而唱片的情感核心，是约90分钟、27首曲目的音乐，横跨巴赫、贝多芬，到纳瓦霍夜间圣歌、塞内加尔打击乐、秘鲁排箫，以及日本尺八曲。争议最大的一首是查克·贝里（Chuck Berry）的《Johnny B. Goode》——洛马克斯认为摇滚乐"很幼稚"，不该收录；萨根的回应后来成了整个项目中被引用最多的一句话："这颗星球上幼稚的人可不少呢。"贝里的吉他即兴由此得以留下。\n\n还有一个鲜少被提起的细节：技术人员用约一小时记录了创意总监安·德鲁扬本人的脑电波与心跳，当时她正想着地球的历史、各种文明，以及坠入爱河的感觉——随后把这一小时压缩成约一分钟的声音，同样收录在唱片上。\n\n💡 启示：面对人类全部成就可供挑选，团队最终没有把数学定理或哲学著作当作人类的"名片"送出去。他们选择了音乐——因为他们相信，这是唯一可能跨越语言障碍、甚至根本不需要语言的东西。` } },
    { id: "mozarteffect", icon: "🧠", title: { th: "Mozart Effect: จริงหรือมายา", en: "The Mozart Effect", zh: "莫扎特效应" },
      content: { th: `🧠 ฟังโมสาร์ทแล้วฉลากขึ้น?\n• ความเชื่อ: ฟังเพลงโมสาร์ทแล้วไอคิวสูงขึ้น — งานวิจัยต้นฉบับ (1993) ถูกขยายเกินจริง ผลแค่ชั่วคราวและเล็กน้อย\n• ความจริง: การ "เล่น/เรียน" ดนตรีต่างหากที่เปลี่ยนสมองจริง — เพิ่มความจำ สมาธิ ภาษา และการประสานมือ-ตา\n💡 อย่าแค่ฟัง — ลงมือเล่น สมองถึงจะโตจริง`,
        en: `🧠 Does Mozart make you smarter?\n• Myth: just listening raises IQ — the 1993 study was overhyped; the effect was tiny and temporary\n• Reality: LEARNING/playing music truly rewires the brain — memory, focus, language and coordination\n💡 Don't just listen — play. That's what grows the brain.`,
        zh: `🧠 听莫扎特会变聪明吗？\n• 误解：光听就提高智商——1993年的研究被过度夸大，效果短暂且微弱\n• 真相：真正"学/弹"音乐才会重塑大脑——提升记忆、专注、语言与协调\n💡 别只听——动手弹，大脑才真正成长。` } },
  ],
  "music-business": [
    { id: "intel", icon: "🔔", title: { th: "Intel 4 โน้ต", en: "Intel's 4 notes", zh: "英特尔4音" },
      content: { th: `🔔 เสียง 4 โน้ตที่ดังที่สุดในโลก\n• Intel "bong" (1994) ยาวแค่ 3 วินาที แต่เคยถูกเล่นทุก ~5 นาทีที่ไหนสักแห่งบนโลก\n• กลายเป็นทรัพย์สินแบรนด์มูลค่ากว่า 200 ล้านดอลลาร์\n💡 sonic logo สั้น ๆ = จดจำได้ทั้งชีวิต`,
        en: `🔔 The 4 most-played notes on Earth\n• Intel's "bong" (1994) is only 3 seconds, yet was once played every ~5 minutes somewhere in the world\n• Now a brand asset worth $200M+\n💡 A tiny sonic logo = a lifetime of recall.`,
        zh: `🔔 全球最常被播放的4个音\n• 英特尔"bong"（1994）只有3秒，却曾每隔约5分钟就在世界某处响起\n• 如今是价值超2亿美元的品牌资产\n💡 极短的声音标志＝一生的记忆。` } },
    { id: "mixue", icon: "🍦", title: { th: "Mixue ชานมจีน", en: "Mixue (China)", zh: "蜜雪冰城" },
      content: { th: `🍦 เพลงเดียวดันแบรนด์โต 30,000+ สาขา\n• ปี 2021 Mixue ทำเพลงธีมจาก "Oh! Susanna" ร้องง่าย ติดหู\n• ไวรัลบน Douyin/TikTok ทะลุ 1,500 ล้านวิว คนแชร์-ล้อเลียนทั่วเอเชีย\n• ดันแบรนด์ชานม-ไอศกรีมราคาถูกโตระเบิด\n💡 ทำนองที่ "ติดหูและแชร์ง่าย" คือสื่อโฆษณาฟรี`,
        en: `🍦 One song → 30,000+ stores\n• In 2021 Mixue's theme (from "Oh! Susanna") was simple and catchy\n• Went viral on Douyin/TikTok with 1.5B+ views, remixed across Asia\n• Powered explosive growth of the cheap tea-and-ice-cream chain\n💡 A catchy, shareable tune is free advertising.`,
        zh: `🍦 一首歌 → 3万多家门店\n• 2021年蜜雪冰城主题曲（改编自《哦！苏珊娜》）简单洗脑\n• 在抖音/TikTok爆红，播放量超15亿，全亚洲二创\n• 推动这家平价茶饮冰淇淋连锁爆发式增长\n💡 洗脑又易传播的旋律＝免费广告。` } },
    { id: "carabao", icon: "🐃", title: { th: "Carabao วงร็อก→แบรนด์โลก", en: "Carabao (Thailand)", zh: "卡拉宝（泰国）" },
      content: { th: `🐃 จากวงเพื่อชีวิตสู่สปอนเซอร์บอลอังกฤษ\n• วงร็อก "คาราบาว" (แอ๊ด คาราบาว) ดังทั่วไทย\n• ต่อยอดเป็นเครื่องดื่มชูกำลัง Carabao Daeng\n• ซื้อสิทธิ์ตั้งชื่อ "Carabao Cup" ฟุตบอลอังกฤษ — ดังไปทั่วโลก\n💡 ชื่อเสียงทางดนตรี = สินทรัพย์แบรนด์ที่ต่อยอดได้มหาศาล`,
        en: `🐃 From a rock band to an English football sponsor\n• "Carabao" (Add Carabao) was a famous Thai rock band\n• Extended into the Carabao Daeng energy drink\n• Bought naming rights to England's "Carabao Cup" — global fame\n💡 Musical fame is a brand asset you can build an empire on.`,
        zh: `🐃 从摇滚乐队到英格兰足球赞助商\n• "卡拉宝"是泰国著名摇滚乐队\n• 延伸出卡拉宝能量饮料\n• 买下英格兰联赛杯冠名权"Carabao Cup"——闻名全球\n💡 音乐名气是可发展成帝国的品牌资产。` } },
    { id: "mastercard", icon: "💳", title: { th: "Mastercard Sonic", en: "Mastercard Sonic", zh: "万事达声音品牌" },
      content: { th: `💳 เสียงที่ดังทุกครั้งที่จ่ายเงิน\n• ปี 2019 Mastercard เปิดตัว "sonic brand" — เสียงสั้น ๆ ที่เล่นตอนจ่ายเงินสำเร็จทั่วโลก\n• สร้างความรู้สึกมั่นใจ-ปลอดภัยในเสี้ยววินาที\n• งานวิจัยชี้ แบรนด์ที่มี sonic logo ถูกจดจำมากขึ้นถึง ~8 เท่า\n💡 แม้แต่ "เสียงจ่ายเงิน" ก็เป็นการตลาด`,
        en: `💳 The sound of every payment\n• In 2019 Mastercard launched a "sonic brand" — a short sound at successful checkout worldwide\n• Creates trust and reassurance in a split second\n• Brands with a sonic logo are recalled up to ~8× more\n💡 Even a payment sound is marketing.`,
        zh: `💳 每次付款都会响起的声音\n• 2019年万事达推出"声音品牌"——全球付款成功时的短促之声\n• 在一瞬间营造信任与安心\n• 拥有声音标志的品牌记忆度可高出约8倍\n💡 连"付款声"都是营销。` } },
  ],
  "music-military": [
    { id: "bagpipes", icon: "🎻", title: { th: "ปี่สก็อต อาวุธสงคราม", en: "Bagpipes of war", zh: "苏格兰风笛" },
      content: { th: `🎻 เครื่องดนตรีที่ถูกขึ้นบัญชี "อาวุธ"\n• นักเป่าปี่สก็อต (piper) นำหน้าทหารเข้าสนามรบ เสียงปลุกใจฝ่ายตน-ข่มขวัญศัตรู\n• ในสงคราม เสียงปี่ดังทะลุเสียงปืน ทำให้ทหารไม่แตกแถว\n• เคยถูกศาลอังกฤษตัดสินว่าเป็น "เครื่องมือของสงคราม"\n💡 ดนตรี = ขวัญกำลังใจที่จับต้องได้ในสนามรบ`,
        en: `🎻 An instrument once ruled a "weapon of war"\n• Scottish pipers led troops into battle — rallying their own, terrifying the enemy\n• Pipes cut through gunfire, keeping soldiers in formation\n• A British court once deemed them an "instrument of war"\n💡 Music = tangible morale on the battlefield.`,
        zh: `🎻 曾被判定为"战争武器"的乐器\n• 苏格兰风笛手走在队伍最前带兵冲锋——鼓舞己方、震慑敌人\n• 笛声穿透枪炮声，让士兵保持队形\n• 英国法庭曾判定风笛为"战争工具"\n💡 音乐＝战场上看得见的士气。` } },
    { id: "psyop", icon: "🔊", title: { th: "เสียงดังเป็นอาวุธ", en: "Loud music as a weapon", zh: "用音乐施压" },
      content: { th: `🔊 ทหารใช้ "เสียง" กดดันจริง\n• ปี 1989 สหรัฐล้อมสถานทูตที่นายพล Noriega หลบอยู่ (ปานามา) เปิดเพลงร็อกดังต่อเนื่องเพื่อกดดันให้ยอมจำนน\n• กองทัพยุคใหม่มีหน่วย PSYOP ใช้เสียง/เพลงในปฏิบัติการจิตวิทยา\n💡 เสียงที่ "หนีไม่ได้" สร้างแรงกดดันมหาศาลต่อจิตใจ`,
        en: `🔊 Armies really use sound to pressure\n• In 1989 U.S. forces blasted nonstop rock music at the embassy where Noriega hid (Panama) to force surrender\n• Modern militaries have PSYOP units using sound/music in psychological operations\n💡 Sound you can't escape is immense mental pressure.`,
        zh: `🔊 军队真的用声音施压\n• 1989年美军在诺列加藏身的使馆外（巴拿马）持续高放摇滚乐，逼其投降\n• 现代军队设有心理战（PSYOP）部队，用声音/音乐作战\n💡 无法逃避的声音是巨大的心理压力。` } },
    { id: "bugle", icon: "🥁", title: { th: "กลองและแตรสั่งการ", en: "Drums & bugle calls", zh: "战鼓与号角" },
      content: { th: `🥁 "วิทยุสื่อสาร" ก่อนมีวิทยุ\n• ก่อนยุคไฟฟ้า กองทัพใช้กลอง แตร ปี่ ส่งคำสั่งในสนามรบ\n• เสียงเฉพาะ = คำสั่งเฉพาะ: ปลุก (reveille) บุก (charge) ถอย (retreat)\n• เสียงเดินทางไกล สั่งทหารหลายพันให้ขยับพร้อมกัน\n💡 จังหวะ = ภาษาคำสั่งที่เร็วและชัดในความโกลาหล`,
        en: `🥁 "Radio" before radio existed\n• Before electronics, armies sent orders by drum, bugle and fife\n• Specific calls = specific orders: reveille, charge, retreat\n• Sound carried far, moving thousands in unison\n💡 Rhythm = a fast, clear command language amid chaos.`,
        zh: `🥁 无线电之前的"无线电"\n• 在电子时代以前，军队用战鼓、号角传令\n• 特定号声＝特定命令：起床、冲锋、撤退\n• 声音传得远，让千军万马同步行动\n💡 节奏＝混乱中快速清晰的指挥语言。` } },
  ],
  "music-nation": [
    { id: "kpop", icon: "🇰🇷", title: { th: "K-pop Soft Power", en: "K-pop soft power", zh: "K-pop 软实力" },
      content: { th: `🇰🇷 เพลงคือยุทธศาสตร์ชาติ\n• รัฐบาลเกาหลีหนุน K-pop/หนัง/ซีรีส์เป็น "soft power" ส่งออกวัฒนธรรม\n• BTS วงเดียวเคยถูกประเมินว่าสร้างมูลค่าต่อเศรษฐกิจเกาหลีหลายพันล้านดอลลาร์ต่อปี\n• ดึงนักท่องเที่ยว ยอดขายสินค้า และภาพลักษณ์ประเทศ\n💡 ดนตรีส่งออกได้ทั้งวัฒนธรรมและเงินตรา`,
        en: `🇰🇷 Music as national strategy\n• Korea's government backs K-pop/film/drama as "soft power" cultural exports\n• BTS alone was estimated to add billions/yr to Korea's economy\n• Drives tourism, product sales and national image\n💡 Music exports culture AND cash.`,
        zh: `🇰🇷 音乐即国家战略\n• 韩国政府把K-pop/影视当作"软实力"文化输出\n• 仅BTS一团据估每年为韩国经济贡献数十亿美元\n• 带动旅游、商品销售与国家形象\n💡 音乐能输出文化，也能输出财富。` } },
    { id: "anthem", icon: "🎌", title: { th: "เพลงชาติ รวมใจคน", en: "National anthems", zh: "国歌" },
      content: { th: `🎌 ทำนองที่หล่อหลอม "ชาติ"\n• เพลงชาติถูกออกแบบให้ปลุกอารมณ์ร่วมและความเป็นหนึ่งเดียว\n• "La Marseillaise" ของฝรั่งเศสเกิดในยุคปฏิวัติ ปลุกใจประชาชน\n• ร้องพร้อมกันในสนามกีฬา/พิธี = พลังของคนหมู่มาก\n💡 ทำนองเดียวเปลี่ยนฝูงชนให้เป็น "พวกเดียวกัน"`,
        en: `🎌 The tune that forges a nation\n• Anthems are engineered to stir shared emotion and unity\n• France's "La Marseillaise" was born in revolution to rally the people\n• Sung together at stadiums/ceremonies = the power of crowds\n💡 One melody turns a crowd into "us."`,
        zh: `🎌 铸造"国家"的旋律\n• 国歌被设计来激发共同情感与团结\n• 法国《马赛曲》诞生于革命，鼓舞民众\n• 在体育场/典礼齐唱＝群体的力量\n💡 一段旋律把人群变成"我们"。` } },
    { id: "pheua-chiwit", icon: "✊", title: { th: "เพลงเพื่อชีวิต", en: "Songs for life (Thailand)", zh: "为生活而歌（泰国）" },
      content: { th: `✊ ดนตรีกับสังคมไทย\n• "เพลงเพื่อชีวิต" (เช่น คาราวาน, คาราบาว) สะท้อนปัญหาสังคมและการเมือง\n• เป็นเสียงของประชาชนในยุคเปลี่ยนแปลง ปลุกจิตสำนึกร่วม\n• ทั่วโลกก็มีเพลงประท้วง เช่น "We Shall Overcome" ในขบวนการสิทธิพลเมือง\n💡 ดนตรีให้เสียงกับคนที่ไม่มีเสียง`,
        en: `✊ Music and Thai society\n• "Songs for life" (Caravan, Carabao) voiced social and political struggles\n• A people's voice in times of change, awakening shared conscience\n• Worldwide too: protest songs like "We Shall Overcome" in civil rights\n💡 Music gives a voice to the voiceless.`,
        zh: `✊ 音乐与泰国社会\n• "为生活而歌"（Caravan、卡拉宝）唱出社会与政治议题\n• 在变革年代成为人民之声，唤醒共同良知\n• 全球亦然：民权运动的《We Shall Overcome》\n💡 音乐为无声者发声。` } },
  ],
  "music-elite": [
    { id: "patronage", icon: "👑", title: { th: "ระบบอุปถัมภ์ราชสำนัก", en: "Royal patronage", zh: "宫廷赞助制" },
      content: { th: `👑 เมื่อดนตรีคือเครื่องหมายอำนาจ\n• ในอดีต กษัตริย์/ขุนนางจ้าง "นักดนตรีประจำราชสำนัก"\n• Haydn ทำงานให้ตระกูล Esterházy นานหลายสิบปี แต่งเพลงตามคำสั่งเจ้านาย\n• Bach แต่งเพลงให้โบสถ์และเจ้าผู้ครองนคร\n💡 ดนตรีชั้นสูง = สัญลักษณ์สถานะและความมั่งคั่ง`,
        en: `👑 When music signaled power\n• Kings and nobles once employed "court musicians"\n• Haydn served the Esterházy family for decades, composing on command\n• Bach wrote for churches and princes\n💡 Fine music = a symbol of status and wealth.`,
        zh: `👑 当音乐象征权力\n• 昔日君主贵族雇用"宫廷乐师"\n• 海顿为埃斯特哈齐家族服务数十年，奉命作曲\n• 巴赫为教会与诸侯创作\n💡 高雅音乐＝地位与财富的象征。` } },
    { id: "mozart-free", icon: "🎼", title: { th: "โมสาร์ท ศิลปินอิสระคนแรก ๆ", en: "Mozart goes freelance", zh: "莫扎特：自由职业" },
      content: { th: `🎼 กบฏที่เปลี่ยนอาชีพนักดนตรี\n• โมสาร์ทเบื่อระบบอุปถัมภ์ ลาออกจากนายจ้าง (อาร์ชบิชอป) มาเป็นศิลปินอิสระในเวียนนา\n• หาเลี้ยงตัวด้วยการแสดง สอน และพิมพ์โน้ตขาย\n• เป็นต้นแบบ "ศิลปินที่ขายผลงานเอง" ก่อนยุคปัจจุบันหลายร้อยปี\n💡 อิสระ = เสี่ยงกว่า แต่เป็นเจ้าของผลงานตัวเอง`,
        en: `🎼 The rebel who reinvented the job\n• Mozart tired of patronage, quit his employer (an archbishop) to freelance in Vienna\n• Lived off concerts, teaching and selling printed scores\n• A blueprint for the "self-selling artist" centuries early\n💡 Independence = riskier, but you own your work.`,
        zh: `🎼 重塑职业的叛逆者\n• 莫扎特厌倦赞助制，辞别雇主（大主教），在维也纳做自由音乐人\n• 靠演出、教学和卖乐谱为生\n• 几百年前就是"自我变现艺术家"的范本\n💡 独立＝风险更高，但作品归你所有。` } },
    { id: "salon", icon: "🥂", title: { th: "ซาลอนของชนชั้นสูง", en: "Elite salons", zh: "精英沙龙" },
      content: { th: `🥂 ดนตรีในห้องรับแขกของผู้ดี\n• ศตวรรษที่ 19 "ซาลอน" คือปาร์ตี้ของชนชั้นสูงที่เชิญศิลปินมาเล่นใกล้ชิด\n• Chopin โด่งดังในซาลอนปารีส มากกว่าบนเวทีใหญ่\n• การได้ศิลปินดังมาเล่น = อวดรสนิยมและสถานะ\n💡 "วงในระดับสูง" คือช่องทางสร้างชื่อของศิลปินมาแต่ไหนแต่ไร`,
        en: `🥂 Music in the drawing rooms of the rich\n• In the 1800s "salons" were elite gatherings where artists played intimately\n• Chopin shone in Paris salons more than big stages\n• Hosting a famous artist signaled taste and status\n💡 Elite inner circles have always made artists' names.`,
        zh: `🥂 富人客厅里的音乐\n• 19世纪的"沙龙"是精英聚会，艺术家近距离演奏\n• 肖邦在巴黎沙龙比在大舞台更耀眼\n• 请到名家演奏＝彰显品味与地位\n💡 高端圈层自古就是艺术家成名之道。` } },
  ],
  "music-therapy": [
    { id: "giffords", icon: "🗣️", title: { th: "Gabby Giffords พูดได้อีกครั้ง", en: "Gabby Giffords speaks again", zh: "吉福兹重获语言" },
      content: { th: `🗣️ Gabby Giffords — ร้องเพลงเพื่อพากลับมาพูดได้\n\nวันที่ 8 มกราคม 2011 ส.ส.สหรัฐฯ Gabby Giffords ถูกยิงเข้าที่ศีรษะด้านซ้ายระหว่างงานพบปะประชาชนที่เมืองทูซอน รัฐแอริโซนา กระสุนทำลายสมองซีกซ้ายของเธอ รวมถึงบริเวณใกล้ "Broca's area" ซึ่งเป็นส่วนสมองที่รับผิดชอบการผลิตคำพูดโดยตรง ผลลัพธ์คือภาวะ "aphasia" (ภาวะพูดไม่ได้) ขั้นรุนแรง — Giffords ยังฟังเข้าใจทุกอย่าง คิดได้ปกติ จำคนที่เธอรักได้ทุกคน เพียงแต่พูดคำออกมาไม่ได้อย่างที่ตั้งใจ\n\nการฟื้นตัวของเธอพึ่งพาเทคนิคที่เรียกว่า "Melodic Intonation Therapy" (MIT) เป็นหลัก ซึ่งตั้งอยู่บนหลักการทางประสาทวิทยาที่เรียบง่ายแต่ทรงพลัง: การพูดปกติควบคุมโดยสมองซีกซ้าย แต่การ "ร้องเพลง" กลับพึ่งพาสมองซีกขวาเป็นหลัก — ซึ่งในกรณีของ Giffords ยังไม่ถูกทำลาย MIT จงใจใช้ประโยชน์จากช่องว่างนี้ นักบำบัดจะร้องประโยคสั้นๆ ง่ายๆ ด้วยทำนองที่เน้นเสียงชัดเจนเกินจริง แล้วให้ผู้ป่วยร้องตาม เพราะการร้องเพลงใช้วงจรประสาทต่างจากการพูด ผู้ป่วยจึงมักร้องคำออกมาได้ ก่อนที่จะพูดคำเดียวกันเป็นประโยคปกติได้เสียอีก\n\nการบำบัดของ Giffords เริ่มต้นง่ายที่สุดเท่าที่จะเป็นไปได้ นักบำบัดจะร้อง "Happy birthday to…" แล้ว Giffords ร้องกลับมาแค่คำว่า "you" คำเดียว จากจุดนั้น เซสชันค่อยๆ ต่อยอดผ่านเพลงคุ้นหูที่เธอรัก รวมถึง "American Pie" ของ Don McLean และ "Brown Eyed Girl" ของ Van Morrison ซึ่งเป็นหนึ่งในเพลงโปรดของเธอ — แต่ละเพลงช่วยเพิ่มคำและวลีที่กู้คืนได้ทีละนิด ผ่านไปหลายเดือน นักบำบัดค่อยๆ ลดทำนองลง เลื่อนวลีที่ร้องให้ใกล้จังหวะการพูดปกติมากขึ้นเรื่อยๆ จนสิ่งที่เริ่มจากการร้องเพลงกลายเป็นการพูดอีกครั้ง\n\n💡 บทเรียน: เรื่องนี้ไม่ใช่แค่เรื่องที่ว่าดนตรี "ผ่อนคลาย" หรือ "สร้างแรงบันดาลใจ" — แต่เป็นเรื่องของประสาทวิทยาจริงๆ ดนตรีกระตุ้นสมองในวงกว้างและซ้ำซ้อนกว่ากิจกรรมแทบทุกอย่างที่มนุษย์ทำ นั่นคือเหตุผลที่บางครั้งมันหาทางอ้อมผ่านความเสียหายที่ควรจะทำให้ใครสักคนพูดไม่ได้ไปตลอดกาล`,
        en: `🗣️ Gabby Giffords — singing her way back to speech\n\nOn January 8, 2011, U.S. Congresswoman Gabby Giffords was shot through the left side of her head at a constituent event in Tucson, Arizona. The bullet damaged her brain's left hemisphere, including areas near Broca's area — the region most responsible for producing speech. The result was a severe form of aphasia: Giffords could still understand everything said to her, think clearly, and recognize people she loved — she simply couldn't reliably get words out.\n\nHer recovery leaned heavily on a technique called Melodic Intonation Therapy (MIT), built on a simple but powerful piece of brain science: language production is normally handled by the left hemisphere, but singing draws heavily on the right hemisphere — which, in Giffords' case, was undamaged. MIT deliberately exploits that split. A therapist sings a short, simple phrase in an exaggerated melodic pattern, and the patient sings it back — because singing recruits different neural circuitry than speaking, patients can often produce words in song long before they can say them in plain speech.\n\nGiffords' therapy started about as simply as it gets: her therapist would sing 'Happy birthday to...' and Giffords would sing back the single word 'you.' From there, sessions built up through familiar, well-loved songs — including Don McLean's 'American Pie' and Van Morrison's 'Brown Eyed Girl,' one of her favorites — each one adding a few more recoverable words and phrases. Over months, clinicians gradually stripped the melody away, sliding the sung phrases toward normal, spoken rhythm until what started as singing became speech again.\n\n💡 Lesson: this isn't really a story about music being 'relaxing' or 'inspiring' — it's a story about neuroscience. Music activates the brain more broadly and more redundantly than almost anything else we do, which is exactly why it can sometimes route around damage that would otherwise silence someone for good.`,
        zh: `🗣️ 吉福兹——用歌唱唱回语言能力\n\n2011年1月8日，美国国会议员加布丽埃尔·吉福兹（Gabby Giffords）在亚利桑那州图森市的一场选民见面会上头部左侧中枪。子弹损伤了她的左脑，包括布洛卡区（Broca's area）附近区域——这正是负责产生语言的核心脑区。结果是严重的失语症：吉福兹仍能听懂别人说的一切，思维清晰，认得所有她爱的人——只是无法可靠地把词说出口。\n\n她的康复很大程度依赖一种叫"旋律语调疗法"（Melodic Intonation Therapy，MIT）的技术，其原理简单却强大：正常语言产生由左脑主导，而"唱歌"却主要调用右脑——在吉福兹的案例中，右脑并未受损。MIT刻意利用这一分工：治疗师用夸张的旋律唱出简短的短句，患者跟着唱回来——因为唱歌调用的神经回路与说话不同，患者往往能先用"唱"的方式说出词语，远早于能用平常语速把同一个词说出来。\n\n吉福兹的治疗从最简单的方式开始：治疗师唱"Happy birthday to…"，吉福兹只需唱回一个词"you"。从这里开始，训练逐渐通过她熟悉又喜爱的歌曲推进，包括唐·麦克莱恩（Don McLean）的《American Pie》，以及她最爱的歌曲之一——范·莫里森（Van Morrison）的《Brown Eyed Girl》——每一首都帮她多找回一些词语和短句。数月后，治疗师逐渐淡化旋律，把唱出的短句慢慢拉向正常说话的节奏，直到最初的"唱"重新变成了"说"。\n\n💡 启示：这其实不只是一个关于音乐"令人放松"或"激励人心"的故事——而是一个关于神经科学的故事。音乐比人类几乎任何其他活动都更广泛、更冗余地激活大脑，这正是它有时能绕开本会让人永远失声的损伤的原因。` } },
    { id: "parkinson", icon: "🚶", title: { th: "จังหวะช่วยพาร์กินสันเดิน", en: "Rhythm for Parkinson's", zh: "节奏助帕金森行走" },
      content: { th: `🚶 บีตที่ทำให้ก้าวเดินมั่นคง\n• ผู้ป่วยพาร์กินสันมักก้าวติดขัด/ค้าง (freezing)\n• เทคนิค Rhythmic Auditory Stimulation: เดินตามจังหวะเมโทรนอม/เพลง ช่วยให้ก้าวสม่ำเสมอและล้มน้อยลง\n• สมองใช้ "จังหวะภายนอก" แทนสัญญาณภายในที่บกพร่อง\n💡 จังหวะคือไม้เท้าที่มองไม่เห็น`,
        en: `🚶 The beat that steadies each step\n• Parkinson's patients often freeze or shuffle\n• Rhythmic Auditory Stimulation: walking to a metronome/song makes steps even and reduces falls\n• The brain borrows an external beat for its faulty internal timing\n💡 Rhythm is an invisible walking stick.`,
        zh: `🚶 让脚步稳定的节拍\n• 帕金森患者常出现冻结/拖步\n• "节奏听觉刺激"：跟着节拍器/歌曲走路，步伐更均匀、跌倒更少\n• 大脑借助外部节拍替代失灵的内部计时\n💡 节奏是一根看不见的拐杖。` } },
    { id: "dementia", icon: "🧓", title: { th: "เพลงปลุกความทรงจำ", en: "Music & dementia", zh: "音乐与失智" },
      content: { th: `🧓 เพลงเก่าที่ปลุกคนที่หลงลืม\n• ผู้ป่วยสมองเสื่อม/อัลไซเมอร์มักจำเพลงในวัยหนุ่มสาวได้แม้จำคนใกล้ตัวไม่ได้\n• สารคดี "Alive Inside" แสดงผู้ป่วยที่ "ตื่น" ขึ้นมามีชีวิตชีวาเมื่อได้ฟังเพลงโปรด\n• ความทรงจำดนตรีฝังลึกในสมองส่วนที่โรคทำลายช้าที่สุด\n💡 ดนตรีคือกุญแจสู่ความทรงจำที่ล็อกไว้`,
        en: `🧓 Old songs that reawaken lost minds\n• People with dementia often recall youth songs even when they forget loved ones\n• The film "Alive Inside" shows patients "wake up" to favorite music\n• Musical memory sits in brain areas the disease harms last\n💡 Music is a key to locked memories.`,
        zh: `🧓 唤醒失忆心灵的老歌\n• 失智/阿尔茨海默患者常记得年轻时的歌，却认不出亲人\n• 纪录片《Alive Inside》记录患者听到喜爱音乐时"苏醒"\n• 音乐记忆位于疾病最晚损害的脑区\n💡 音乐是开启被锁记忆的钥匙。` } },
  ],
  "music-marketing": [
    { id: "taylor", icon: "🩷", title: { th: "Taylor Swift: เป็นเจ้าของผลงาน", en: "Taylor Swift: own your masters", zh: "霉霉：拥有母带" },
      content: { th: `🩷 Taylor Swift — ศิลปินป๊อปที่ซื้อ "เสียงของตัวเอง" กลับคืนมา\n\nมิถุนายน 2019 บริษัท Ithaca Holdings ของ Scooter Braun ผู้จัดการศิลปิน จ่ายเงินราว 300 ล้านดอลลาร์เพื่อซื้อค่าย Big Machine Label Group — ค่ายที่ Taylor Swift อัดอัลบั้ม 6 ชุดแรกด้วย — จาก Scott Borchetta ผู้ก่อตั้ง ดีลนี้ทำให้ Braun เป็นเจ้าของมาสเตอร์เพลงของ Swift ตั้งแต่อัลบั้ม "Taylor Swift" (2006) จนถึง "Reputation" (2017) Swift บอกว่าเธอรู้เรื่องการขายนี้จากอินเทอร์เน็ตพร้อมๆ กับคนอื่นทุกคน และเรียกมันว่า "สถานการณ์เลวร้ายที่สุดที่เธอกลัว" — ชายที่เธอมีปัญหาขัดแย้งในที่สาธารณะมานานหลายปี กลับกลายเป็นเจ้าของต้นฉบับผลงานทั้งชีวิตของเธอ\n\nการเป็นเจ้าของ "มาสเตอร์" สำคัญเพราะมันคือตัวกำหนดว่าใครจะได้เงิน และใครมีสิทธิ์อนุญาตหรือปฏิเสธ ทุกครั้งที่เพลงถูกนำไปใช้ในหนัง โฆษณา แซมเปิล หรือซิงก์ — ไม่ใช่เครดิตการแต่งเพลง Swift เป็นเจ้าของลิขสิทธิ์การแต่งเพลงอยู่แล้ว แต่ไม่ได้เป็นเจ้าของ "การบันทึกเสียง" ที่แฟนๆ ฟังจริงบนสตรีมมิ่งทุกวัน\n\nแทนที่จะสู้แค่ในชั้นศาล Swift ทำสิ่งที่ศิลปินระดับเธอแทบไม่มีใครเคยลองมาก่อน — เธอประกาศว่าจะ "อัดใหม่ทั้ง 6 อัลบั้ม" ทีละโน้ตให้เหมือนเดิม แล้วเป็นเจ้าของมาสเตอร์ใหม่เองเต็มๆ เริ่มจากปี 2021 เธอปล่อย "Fearless (Taylor's Version)" ตามด้วย "Red" "Speak Now" และ "1989" — แต่ละอัลบั้มถูกทำการตลาดอย่างตั้งใจให้ดึงยอดสตรีมและยอดขายออกจากต้นฉบับเดิม แฟนๆ ส่วนใหญ่พร้อมใจกันย้ายไปฟังเวอร์ชันใหม่จำนวนมหาศาล จนเห็นผลชัดเจนบนชาร์ตและยอดสตรีมมิ่ง\n\nปี 2020 Braun ขายมาสเตอร์ต้นฉบับต่อให้บริษัทไพรเวทอิควิตี้ Shamrock Holdings — และในปี 2025 ด้วยจุดพลิกที่ปิดวงจรเรื่องนี้ Swift ซื้อมันกลับคืนมาเองจาก Shamrock ด้วยมูลค่าที่ไม่เปิดเผยแต่มีรายงานว่าสูงถึงระดับ 9 หลัก หกปีหลังจากการขายที่จุดชนวนเรื่องทั้งหมด ตอนนี้เธอเป็นเจ้าของทั้งต้นฉบับและเวอร์ชันที่อัดใหม่แล้ว\n\n💡 บทเรียน: Swift เปลี่ยนข้อพิพาททางกฎหมาย/ธุรกิจที่แฟนเพลงทั่วไปไม่น่าจะติดตามให้กลายเป็นบทเรียนทรัพย์สินทางปัญญาที่สาธารณะที่สุดครั้งหนึ่งที่วงการเพลงเคยเห็น — และทำได้ด้วยการทำให้ผู้ฟังธรรมดาหลายล้านคนรู้สึกว่าตัวเองมีส่วนช่วยให้เธอชนะได้จริงๆ`,
        en: `🩷 Taylor Swift — the pop star who bought back her own voice\n\nIn June 2019, talent manager Scooter Braun's company Ithaca Holdings paid roughly $300 million to acquire Big Machine Label Group — the label Taylor Swift had recorded her first six albums with — from founder Scott Borchetta. The deal handed Braun ownership of the master recordings of Swift's music from 'Taylor Swift' (2006) through 'Reputation' (2017). Swift said she'd found out about the sale from the internet, along with everyone else, and called it 'my worst-case scenario' — the man she'd publicly clashed with for years now owned the original recordings of her life's work.\n\nMaster ownership matters because it's the master recording — not the songwriting credit — that determines who gets paid, and who gets to say yes or no, every time a song is licensed for a film, a commercial, a sample, or a sync. Swift did own the publishing rights to the songs themselves, but not the specific recorded performances fans actually stream and hear.\n\nRather than fight only in court, Swift did something few artists at her scale had tried: she announced she would simply re-record all six albums from scratch, note for note, and own the new masters outright. Starting in 2021 she released 'Fearless (Taylor's Version),' then 'Red,' 'Speak Now,' and '1989' — each one deliberately marketed to pull streaming and sales away from the originals. Fans, largely in solidarity, migrated to the new versions in huge numbers, visibly moving the needle on which version charted and streamed.\n\nIn 2020 Braun sold the original masters again, to private equity firm Shamrock Holdings — and in 2025, in the twist that closed the loop, Swift herself bought them back from Shamrock, for an undisclosed sum reported to be in the nine figures. Six years after the sale that started it all, she now owns both the originals and the re-recordings.\n\n💡 Lesson: Swift turned a legal/business dispute most fans would never normally follow into one of the most public masterclasses in intellectual property the music industry has ever seen — and did it by making millions of ordinary listeners feel personally invited to help her win.`,
        zh: `🩷 泰勒·斯威夫特——买回自己"声音"的流行天后\n\n2019年6月，经纪人斯库特·布劳恩（Scooter Braun）旗下的Ithaca Holdings公司斥资约3亿美元，从创始人斯科特·博切塔（Scott Borchetta）手中收购了Big Machine唱片公司——正是泰勒·斯威夫特录制前六张专辑的那家公司。这笔交易让布劳恩拥有了斯威夫特从《Taylor Swift》（2006年）到《Reputation》（2017年）全部音乐的母带所有权。斯威夫特表示她和所有人一样，是从网上得知这笔交易的，并称之为"我最担心发生的情况"——那个她多年来公开与之交恶的人，如今拥有了她毕生心血的原始录音。\n\n母带所有权之所以重要，是因为决定谁能获得报酬、谁有权批准或拒绝一首歌被用于电影、广告、采样或影视配乐的，是母带录音本身——而不是词曲创作署名。斯威夫特本就拥有歌曲本身的版权，但并不拥有粉丝们每天在流媒体上实际听到的那些具体录音。\n\n她没有只在法庭上抗争，而是做了同等咖位艺人几乎从未尝试过的事：宣布把六张专辑逐音符重新录制一遍，完全拥有新的母带。从2021年起，她陆续发布了《Fearless (Taylor's Version)》，随后是《Red》《Speak Now》和《1989》——每一张都经过刻意的营销策划，把流媒体播放量和销量从原版身上拉走。粉丝们大规模地、几乎是出于声援般地转向新版本，切实地在榜单和播放数据上体现出来。\n\n2020年，布劳恩再次将原始母带出售给私募股权公司Shamrock Holdings——而在2025年这个让整个故事画上句点的转折中，斯威夫特亲自从Shamrock手中把母带买了回来，金额未公开，但据报道高达九位数。距离引发这一切的那笔交易过去六年后，她如今同时拥有原版母带和重录版本。\n\n💡 启示：斯威夫特把一场普通歌迷原本根本不会关注的法律/商业纠纷，变成了音乐行业史上最公开的一堂知识产权大师课——而她做到这一点的方式，是让数百万普通听众真切感觉到自己被邀请参与、并亲手帮她赢下这场仗。` } },
    { id: "bts-army", icon: "💜", title: { th: "BTS & ARMY: พลังแฟนคลับ", en: "BTS & ARMY: fan power", zh: "BTS与ARMY：粉丝力量" },
      content: { th: `💜 แฟนคลับที่จัดตั้งเหมือนทีม\n• กองทัพแฟน "ARMY" ช่วยกันสตรีม โหวต และดันแฮชแท็กให้ติดเทรนด์โลก\n• แฟนแปลภาษา ทำคอนเทนต์ และระดมทุนเพื่อการกุศลในนามวง\n• ค่าย HYBE สร้างระบบนิเวศ (แอป Weverse, สินค้า, คอนเทนต์เบื้องหลัง) ให้แฟนใกล้ชิด\n💡 บทเรียน: เปลี่ยนแฟนให้เป็น "ทีมการตลาด" ที่รักคุณ`,
        en: `💜 A fandom organized like a team\n• The "ARMY" streams, votes and pushes hashtags to global trends together\n• Fans translate, make content and fundraise for charity in the band's name\n• Label HYBE built an ecosystem (Weverse app, merch, behind-scenes) to keep fans close\n💡 Lesson: turn fans into a marketing team that loves you.`,
        zh: `💜 像团队一样有组织的粉丝群\n• "ARMY"齐心打榜、投票、把话题推上全球热搜\n• 粉丝翻译、做内容，并以乐队之名做公益募款\n• 公司HYBE打造生态（Weverse应用、周边、幕后内容）拉近与粉丝距离\n💡 启示：把粉丝变成爱你的营销团队。` } },
    { id: "lilnasx", icon: "🐴", title: { th: "Lil Nas X: ไวรัลบน TikTok", en: "Lil Nas X: engineered virality", zh: "Lil Nas X：精心引爆" },
      content: { th: `🐴 ออกแบบเพลงให้ไวรัล\n• "Old Town Road" ถูกปล่อยให้ดังบน TikTok ด้วยมีม #Yeehaw จนระเบิด\n• เขาทำมีม ตอบแฟน และปล่อยรีมิกซ์ต่อเนื่องเพื่อให้กระแสไม่ตก\n• ขึ้นอันดับ 1 Billboard นานเป็นประวัติการณ์ (19 สัปดาห์)\n💡 บทเรียน: ทำคลิปสั้นให้คน "เอาไปเล่นต่อ" ได้ คือเชื้อเพลิงไวรัล`,
        en: `🐴 Design a song to go viral\n• "Old Town Road" was seeded on TikTok with the #Yeehaw meme and exploded\n• He made memes, replied to fans and dropped remix after remix to sustain it\n• Hit Billboard #1 for a record 19 weeks\n💡 Lesson: make short clips people can remix — that's viral fuel.`,
        zh: `🐴 为爆红而设计歌曲\n• 《Old Town Road》借#Yeehaw梗在TikTok上引爆\n• 他做梗、回复粉丝、不断发布混音维持热度\n• 创纪录地连续19周登顶Billboard榜首\n💡 启示：做出人人能二创的短片，就是病毒燃料。` } },
    { id: "chance", icon: "🆓", title: { th: "Chance the Rapper: ไม่ง้อค่าย", en: "Chance: no label needed", zh: "Chance：不靠唱片公司" },
      content: { th: `🆓 อิสระแต่ทำเงินได้\n• Chance the Rapper ปล่อยมิกซ์เทปฟรี ไม่เซ็นค่ายใหญ่\n• หารายได้จากทัวร์ คอนเสิร์ต และสินค้า (merch) เอง เก็บกำไรเต็ม\n• เป็นคนแรก ๆ ที่ได้ Grammy จากผลงาน "สตรีมมิ่งอย่างเดียว"\n💡 บทเรียน: ยุคนี้สร้างฐานแฟน + ขายตรง = ไม่ต้องรอใครอนุญาต`,
        en: `🆓 Independent, yet profitable\n• Chance the Rapper gave away mixtapes and signed no major label\n• Earned from touring, shows and his own merch — keeping full profit\n• Among the first to win a Grammy for a streaming-only release\n💡 Lesson: today, a fanbase + direct sales = no gatekeeper needed.`,
        zh: `🆓 独立却能盈利\n• Chance the Rapper 免费发布混音带，不签大公司\n• 靠巡演、演出和自营周边赚钱，利润全留\n• 是最早凭"纯流媒体"作品获格莱美的人之一\n💡 启示：如今粉丝群＋直接销售＝无需守门人。` } },
    { id: "milli-mango", icon: "🥭", title: { th: "MILLI: ข้าวเหนียวมะม่วงสะเทือนโลก", en: "MILLI: mango sticky rice", zh: "MILLI：泰国糯米芒果" },
      content: { th: `🥭 MILLI — คำเดียวของขนม กลายเป็นโมเมนต์การตลาดระดับชาติ\n\nเมษายน 2022 MILLI (ดนุภา คณาธีรกุล) แร็ปเปอร์ไทยวัย 19 ปี กลายเป็นศิลปินเดี่ยวไทยคนแรกที่ได้ขึ้นเวที Coachella หนึ่งในเทศกาลดนตรีใหญ่ที่สุดของโลก กลางเซตการแสดง ระหว่างร้องเพลงอยู่ เธอหยิบจานข้าวเหนียวมะม่วงขึ้นมากินโชว์ต่อหน้าฝูงชน พร้อมตะโกน "Who wants mango and rice that is sticky?" — นี่ไม่ใช่อุบัติเหตุ แต่ถูกวางแผนไว้ในโชว์ตั้งแต่ต้น เพราะเธอแต่งเพลง "Mango Sticky Rice" ขึ้นมาโดยเฉพาะล่วงหน้าแล้ว\n\nคลิปนี้ระเบิดกระแสออนไลน์ทันที แฮชแท็ก #MILLILiveatCoachella ขึ้นเทรนด์อันดับต้นๆ บน Twitter ทั่วโลก มีทวีตราว 1.39 ล้านทวีต และยอดค้นหาคำว่า "mango sticky rice" บน Google พุ่งสูงถึง 20 เท่าของปกติแทบจะข้ามคืน ผลกระทบไม่ได้อยู่แค่ในโลกออนไลน์ — มันไปถึงเครื่องคิดเงินจริงๆ ร้านแม่วารีข้าวเหนียวมะม่วงชื่อดังของกรุงเทพฯ รายงานว่ายอดขายพุ่งขึ้นกว่า 100% ร้านอื่นๆ บอกว่ายอดขายเพิ่มเป็น 3 เท่า และคาดว่ากระแสจะอยู่ต่อไปอีกหลายเดือน พลเอกประยุทธ์ จันทร์โอชา นายกรัฐมนตรีในขณะนั้น ถึงกับพูดถึงการผลักดันข้าวเหนียวมะม่วงเข้าสู่บัญชีมรดกภูมิปัญญาทางวัฒนธรรมของ UNESCO จากกระแสนี้\n\nMILLI เองพูดชัดเจนว่านี่ไม่ใช่แค่มุกโชว์สุ่มๆ แต่เป็นการแสดงจุดยืนเรื่องอัตลักษณ์ ในบทสัมภาษณ์หลังการแสดง เธอบอกว่าเธอไม่ได้มาแสดง "ความเป็นไทยแบบขนบ" ให้ผู้ชมต่างชาติดู แต่มาเพื่อเป็นตัวแทนของตัวเองในฐานะคนไทยจริงๆ และปล่อยให้ของกินพื้นบ้านธรรมดาๆ ที่ไม่ได้ดูหรูหราเลย เป็นตัวส่งสารนั้นไปทั่วโลก แทนที่จะเป็นอะไรที่ถูกจัดแต่งให้ดูเอ็กโซติก\n\n💡 บทเรียน: รายละเอียดเดียวที่จำเพาะและเป็นตัวตนจริงๆ — ขนมหนึ่งจาน กินแค่สิบห้าวินาที — เอาชนะแคมเปญโฆษณาการท่องเที่ยวทั้งชุดได้ เพราะมันดูจริงไม่ใช่การแสดง ความจริงใจไปได้ไกลกว่าความอลังการของงานโปรดักชัน`,
        en: `🥭 MILLI — one bite of dessert, a national marketing moment\n\nIn April 2022, 19-year-old Thai rapper MILLI (Danupha Khanatheerakul) became the first Thai solo artist ever to headline a set at Coachella, one of the world's biggest music festivals. Midway through her set, mid-song, she pulled out a plate of khao niew mamuang — mango sticky rice — and ate it on stage in front of the crowd, chanting 'Who wants mango and rice that is sticky?' It was written into the performance, not an accident: she'd built an entire song, 'Mango Sticky Rice,' around the dish beforehand.\n\nThe clip detonated online. The hashtag #MILLILiveatCoachella became one of the top trending topics on Twitter worldwide, racking up roughly 1.39 million tweets, and Google search interest in mango sticky rice spiked by as much as 20 times its normal level almost overnight. The effect wasn't just online buzz — it showed up in real cash registers. Bangkok's famous Mae Varee mango sticky rice shop reported sales jumping more than 100%; other vendors said sales tripled, with the surge expected to last for months. Thai Prime Minister Prayut Chan-o-cha publicly floated seeking UNESCO intangible cultural heritage status for the dish off the back of the attention.\n\nMILLI herself was explicit that this wasn't a random stunt but a statement about identity: in interviews after the show, she said she wasn't there to perform a 'conventional' version of Thainess for a foreign audience, but to represent who she actually is as a Thai person — and let a genuinely local, unglamorous comfort food carry that message globally, rather than something packaged to look exotic.\n\n💡 Lesson: a single, specific, deeply personal detail — one dish, eaten in fifteen seconds — outperformed an entire tourism-board ad campaign, because it read as true rather than staged. Authenticity travels further than production value.`,
        zh: `🥭 MILLI——一口甜品，掀起一场国家级营销时刻\n\n2022年4月，19岁的泰国说唱歌手MILLI（Danupha Khanatheerakul）成为首位在科切拉音乐节（Coachella，全球最大音乐节之一）担纲独立演出的泰国艺人。表演进行到一半，她在台上当众拿出一盘"糯米芒果"（khao niew mamuang）吃了起来，同时高喊"谁想要又甜又糯的芒果饭？"——这并非意外，而是提前精心设计的桥段：她此前专门为这道甜品创作了一首歌《Mango Sticky Rice》。\n\n这段视频瞬间引爆网络。话题标签#MILLILiveatCoachella登上全球Twitter热搜榜前列，相关推文约达139万条，"mango sticky rice"（芒果糯米饭）的谷歌搜索量几乎一夜之间飙升至平时的20倍。影响不止停留在网上——它实实在在体现在了收银台上。曼谷知名的Mae Varee芒果糯米饭店铺报告销量猛涨超过100%，其他店家称销量翻了三倍，预计这股热潮还将持续数月。时任泰国总理巴育（Prayut Chan-o-cha）甚至公开提出，要借此推动将这道甜品申报为联合国教科文组织非物质文化遗产。\n\nMILLI本人明确表示，这不是随意的噱头，而是关于身份认同的表态。演出后接受采访时，她表示自己来这里不是要为外国观众表演"传统刻板印象"里的泰式风情，而是要代表她自己真实的泰国人身份——让一道地道、毫不华丽的家常美食把这个信息传向全世界，而不是刻意包装出异域风情。\n\n💡 启示：一个具体而深具个人色彩的细节——一份甜品，十五秒吃完——胜过了整套旅游局广告宣传campaign，因为它读起来是真实的，而非表演出来的。真诚比制作精良走得更远。` } },
    { id: "d2f", icon: "🤝", title: { th: "ขายตรงถึงแฟน + วิดีโอสั้น", en: "Direct-to-fan + short video", zh: "直连粉丝＋短视频" },
      content: { th: `🤝 เครื่องมือของศิลปินยุคนี้\n• วิดีโอสั้น (TikTok/Reels/Shorts) = เครื่องค้นพบเพลงเบอร์ 1 — ทำท่อนฮุก 15 วินาทีให้คนเอาไปทำคลิป\n• ขายตรงถึงแฟน: Bandcamp, Patreon, สมาชิกรายเดือน, สินค้า — ได้ส่วนแบ่งมากกว่าสตรีมมิ่งหลายเท่า\n• เก็บอีเมล/LINE แฟนไว้สื่อสารเอง ไม่ต้องพึ่งอัลกอริทึม\n💡 บทเรียน: ให้คนค้นพบด้วยคลิปสั้น แล้วเปลี่ยนเป็นแฟนที่จ่ายตรง`,
        en: `🤝 The modern artist's toolkit\n• Short video (TikTok/Reels/Shorts) = the #1 music-discovery engine — make a 15-sec hook people can post with\n• Direct-to-fan: Bandcamp, Patreon, memberships, merch — far higher share than streaming\n• Keep fans' email/LINE so you reach them without the algorithm\n💡 Lesson: get discovered by short clips, then convert to fans who pay you directly.`,
        zh: `🤝 现代音乐人的工具箱\n• 短视频（TikTok/Reels/Shorts）＝头号音乐发现引擎——做一个15秒、人人能配的钩子\n• 直连粉丝：Bandcamp、Patreon、会员、周边——分成远高于流媒体\n• 留存粉丝邮箱/LINE，无需依赖算法即可触达\n💡 启示：用短片被发现，再转化为直接付费的粉丝。` } },
  ],
};

/* ── Prepared-answer index for free-typed chat questions ──────────────
   Tier 1 of the AI chat: built once from content ALREADY bundled in the
   app (chapter bodies + case studies above) — no new authoring, no AI
   call. Tier 2 (live AI) only runs when nothing here clearly matches.
   Matching is deliberately conservative: it only fires on a strong,
   unambiguous textual match; a tie or a weak/generic hit falls through
   to the live AI rather than risk showing the wrong canned answer. */
const FAQ_TOPICS = (() => {
  const list = [];
  for (const st of PATHWAY) if (st.content) list.push({ title: st.title, content: st.content, key: st.id });
  for (const gid in BENEFIT_CASES) for (const c of BENEFIT_CASES[gid]) list.push({ title: c.title, content: c.content, key: c.id });
  return list;
})();
function _faqNorm(s) { return String(s || "").toLowerCase().replace(/[「」『』()（）"'".,!?！？、，。·]/g, "").trim(); }
function matchFaqTopic(text, lang) {
  const q = _faqNorm(text);
  if (q.length < 2) return null;
  let hit = null, hits = 0;
  for (const topic of FAQ_TOPICS) {
    const title = _faqNorm(tr(topic.title, lang));
    const key = _faqNorm(topic.key);
    if (!title) continue;
    if ((key.length >= 3 && q.includes(key)) || (title.length >= 4 && q.includes(title))) {
      hit = topic; hits++;
    }
  }
  return hits === 1 ? hit : null; // 0 or 2+ matches → ambiguous, let the live AI handle it
}

/* Learning groups — shown as sections in the pathway menu */
const PATH_GROUPS = {
  th: [
    { id: "foundation", label: "รากฐาน", desc: "เริ่มที่นี่ — พื้นฐานที่ต้องรู้ก่อน", icon: "🌱" },
    { id: "chords", label: "คอร์ด", desc: "สร้างเสียงประสาน", icon: "🎹" },
    { id: "advanced", label: "ขั้นสูง", desc: "Harmony ระดับโปร", icon: "🚀" },
    { id: "benefits", label: "ประโยชน์ของดนตรี", desc: "ดนตรีเปลี่ยนโลกอย่างไร — ธุรกิจ ทหาร ชาติ ชนชั้นสูง การบำบัด & การตลาดศิลปิน · แตะดูกรณีศึกษาระดับโลก", icon: "🌍" },
  ],
  en: [
    { id: "foundation", label: "FOUNDATION", desc: "Start here — essential basics", icon: "🌱" },
    { id: "chords", label: "CHORDS", desc: "Building harmony", icon: "🎹" },
    { id: "advanced", label: "ADVANCED", desc: "Pro-level harmony", icon: "🚀" },
    { id: "benefits", label: "WHY MUSIC MATTERS", desc: "Business, war, nations, elites, healing & artist marketing · tap world-class case studies", icon: "🌍" },
  ],
  zh: [
    { id: "foundation", label: "基础", desc: "从这里开始 — 必备基础", icon: "🌱" },
    { id: "chords", label: "和弦", desc: "构建和声", icon: "🎹" },
    { id: "advanced", label: "进阶", desc: "专业级和声", icon: "🚀" },
    { id: "benefits", label: "音乐的力量", desc: "商业、军事、国家、精英、疗愈与音乐人营销 · 点击查看世界级案例", icon: "🌍" },
  ],
};

/* ════════════════════════════════════════════════════════════
   GAMIFICATION — EXP & LEVELS
   Learners earn EXP for every action so the app feels like a game and they keep
   coming back. Total EXP is stored on the Supabase profile (`exp` column);
   the level/rank is derived from it. A daily streak rewards returning often.
════════════════════════════════════════════════════════════ */
const EXP = { lesson: 50, chapter: 25, ask: 10, daily: 15 };

// Rank ladder — each tier needs `min` total EXP. Level number = index + 1.
// Colors stay within the pink/magenta/wine family, deepening as the learner advances.
const LEVELS = [
  { min: 0,    icon: "🌱", c: "#d97757", th: "มือใหม่",      en: "Novice",      zh: "初学者" },
  { min: 120,  icon: "🎵", c: "#ffa8d2", th: "ผู้เริ่มต้น",   en: "Beginner",    zh: "入门" },
  { min: 300,  icon: "🎶", c: "#ff5fb1", th: "นักเรียน",     en: "Student",     zh: "学生" },
  { min: 560,  icon: "🎹", c: "#d97757", th: "นักฝึก",       en: "Apprentice",  zh: "学徒" },
  { min: 900,  icon: "🎼", c: "#ff59c7", th: "นักดนตรี",     en: "Musician",    zh: "乐手" },
  { min: 1350, icon: "⭐", c: "#ff94e0", th: "นักเปียโน",    en: "Pianist",     zh: "钢琴手" },
  { min: 1950, icon: "🌟", c: "#ff76d8", th: "ผู้ชำนาญ",     en: "Virtuoso",    zh: "演奏家" },
  { min: 2750, icon: "💎", c: "#ff5252", th: "ปรมาจารย์",    en: "Maestro",     zh: "大师" },
  { min: 3800, icon: "👑", c: "#d97757", th: "เซียนเปียโน",   en: "Grandmaster", zh: "宗师" },
  { min: 5200, icon: "🏆", c: "#ff76d8", th: "ตำนาน",        en: "Legend",      zh: "传奇" },
];

// Resolve total EXP -> { level, tier, progress to next, EXP still needed, ... }
function levelInfo(exp) {
  const e = Math.max(0, exp || 0);
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (e >= LEVELS[k].min) i = k;
  const tier = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const span = next ? next.min - tier.min : 1;
  return {
    level: i + 1,
    tier,
    next,
    curMin: tier.min,
    nextMin: next ? next.min : tier.min,
    need: next ? next.min - e : 0,
    progress: next ? Math.min(1, (e - tier.min) / span) : 1,
    isMax: !next,
  };
}

/* Daily reset (streak, daily quest, gift box) runs on ONE fixed time zone so the
   day boundary is the SAME on every device instead of each phone's local clock.
   0 = GMT/UTC. Bangkok/ICT is 420 (UTC+7) — flip this one number to change it. */
const DAY_TZ_OFFSET_MIN = 0;
/* Shift a real instant so its LOCAL date fields read as the chosen zone's wall clock. */
function dayDate(d = new Date()) {
  return new Date(d.getTime() + (d.getTimezoneOffset() + DAY_TZ_OFFSET_MIN) * 60000);
}

/* Date as YYYY-MM-DD in the daily-reset zone (used by daily streak + daily quest). */
function ymd(d) {
  const z = dayDate(d);
  return z.getFullYear() + "-" +
    String(z.getMonth() + 1).padStart(2, "0") + "-" +
    String(z.getDate()).padStart(2, "0");
}

/* Daily quest: complete this many learning activities in a day for a bonus. */
const QUEST_GOAL = 3;
const QUEST_BONUS = 40;

/* Achievements — unlocked purely from existing stats (no extra storage).
   metric ∈ exp | lessons | streak | level. */
const BADGES = [
  { id: "first", icon: "🎫", metric: "lessons", need: 1,    th: "ก้าวแรก",          en: "First Step",    zh: "第一步" },
  { id: "l10",   icon: "📚", metric: "lessons", need: 10,   th: "นักเรียนขยัน",      en: "Diligent",      zh: "勤奋学员" },
  { id: "l50",   icon: "🎓", metric: "lessons", need: 50,   th: "จอมวิริยะ",         en: "Devoted",       zh: "刻苦学员" },
  { id: "s3",    icon: "🔥", metric: "streak",  need: 3,    th: "ไฟแรง 3 วัน",       en: "3-Day Streak",  zh: "连续3天" },
  { id: "s7",    icon: "⚡", metric: "streak",  need: 7,    th: "ไฟแรง 7 วัน",       en: "7-Day Streak",  zh: "连续7天" },
  { id: "s30",   icon: "🌟", metric: "streak",  need: 30,   th: "วินัยเหล็ก 30 วัน",  en: "30-Day Streak", zh: "连续30天" },
  { id: "lv5",   icon: "⭐", metric: "level",   need: 5,    th: "ถึงเลเวล 5",        en: "Reach Lv 5",    zh: "达到5级" },
  { id: "lv10",  icon: "👑", metric: "level",   need: 10,   th: "ถึงเลเวล 10",       en: "Reach Lv 10",   zh: "达到10级" },
  { id: "e1000", icon: "💎", metric: "exp",     need: 1000, th: "สะสม 1,000 EXP",    en: "1,000 EXP",     zh: "1,000 EXP" },
  { id: "e5000", icon: "🏆", metric: "exp",     need: 5000, th: "สะสม 5,000 EXP",    en: "5,000 EXP",     zh: "5,000 EXP" },
];
function badgeMetric(p, metric) {
  const exp = (p && p.exp) || 0;
  if (metric === "exp") return exp;
  if (metric === "lessons") return (p && p.lessons_done) || 0;
  if (metric === "streak") return (p && p.streak) || 0;
  if (metric === "level") return levelInfo(exp).level;
  return 0;
}
function unlockedBadgeIds(p) {
  return BADGES.filter(b => badgeMetric(p, b.metric) >= b.need).map(b => b.id);
}
/* how many quest activities counted today (0 if it's a new day) */
function questToday(p) {
  if (!p || p.quest_date !== ymd(new Date())) return 0;
  return p.quest_count || 0;
}

/* 12 keys for the key picker — id used in prompts, label shown to user */
const KEYS_12 = [
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

/* Pre-group PATHWAY stages by group id ONCE (was PATHWAY.filter() on every
   render of every group). PATHWAY is static, so this map never changes. */
const STAGES_BY_GROUP = PATHWAY.reduce((acc, s) => {
  (acc[s.group] = acc[s.group] || []).push(s);
  return acc;
}, {});

/* pick a localized value: accepts a {th,en,zh} object OR a plain string
   (so old string fields still work). Falls back th -> en -> first available. */
function tr(field, lang) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  return field[lang] || field.en || field.th || Object.values(field)[0] || "";
}

/* sentinel for topicHint: a pathway lesson is active and plays its own demo
   (so we must NOT auto-detect notes from the AI's free text) */
const LESSON_MODE = "__lesson__";

/* ── Chat backend config ──
   The chat goes through a Supabase Edge Function ("piano-chat") that keeps the
   Anthropic API key server-side. The anon key below is a PUBLIC key — safe to ship
   in the frontend — and is required because the function has verify_jwt enabled. */
const API_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/piano-chat";
const TTS_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/piano-tts";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXFnYnJhY3hudWNkbXRtY3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTM1MzAsImV4cCI6MjA5NzM4OTUzMH0.vwhXn9usX4YRJdGEL8VU-E86mYfg6mZQbjkernMNXT4";
// piano-chat/piano-tts require a genuine per-user session (not just the public
// anon key) so they can't be called anonymously off the project's AI budget.
// Kept up to date by the auth-state listener in App() — every fetch below reads
// it fresh via apiHeaders() rather than a stale captured header object.
let _accessToken = null;
function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + (_accessToken || SUPABASE_ANON_KEY),
    "apikey": SUPABASE_ANON_KEY,
  };
}

// Shown in the ☰ drawer so you can instantly verify which build is live
// after a manual upload. Keep in sync with package.json on every release.
const APP_VER = "13.2.0";
/* ── Supabase client — Auth (Google/Facebook) + membership profiles ── */
const SUPABASE_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Web Push (re-engagement notifications) ──
   This public key is safe to ship in client code — VAPID public keys are
   meant to be public, the matching private key (kept only as a Supabase Edge
   Function secret, never in this file) is what actually authorizes sending.
   REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY: generate a pair with
   `npx web-push generate-vapid-keys`, paste the public half here, and set
   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY as secrets on the send-reminders
   function. Push stays silently unavailable (no crash) until this is set. */
const VAPID_PUBLIC_KEY = "REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY";
function urlBase64ToUint8Array(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function pushSupported() {
  return VAPID_PUBLIC_KEY !== "REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY" &&
    "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}
async function subscribePush(userId) {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  await sb.from("push_subscriptions").upsert({
    user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
  }, { onConflict: "endpoint" });
  return true;
}
async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (!sub) return;
  try { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); } catch (e) {}
  await sub.unsubscribe();
}
// Fire-and-forget usage tracking (nav clicks / pathway topics / page visits) so
// the admin can see what's actually used. Never awaited, never blocks the UI,
// and any failure (offline, RLS, whatever) is silently swallowed — a missed
// analytics row is never worth degrading the learner's experience.
function logUsage(kind, itemId) {
  sb.auth.getSession().then(({ data }) => {
    const uid = data && data.session && data.session.user && data.session.user.id;
    if (!uid || !itemId) return;
    sb.from("usage_events").insert({ user_id: uid, kind, item_id: String(itemId) }).then(() => {}, () => {});
  }, () => {});
}
async function signInWith(provider) {
  try {
    await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  } catch (e) {
    alert("Sign-in error: " + (e?.message || e));
  }
}
// Model/limits are configured server-side in the Edge Function.
// (These remain only for the legacy admin-console path.)
const API_MODEL = "claude-sonnet-4-6";
const API_MAX_TOKENS = 700;
// Build a single text prompt (system + alternating history + new turn) for
// window.claude.complete, which only accepts a plain string.
function buildTextPrompt(system, history, userText) {
  let p = system + "\n\n";
  for (const h of history) p += (h.role === "user" ? "User: " : "Assistant: ") + h.content + "\n";
  return p + "User: " + userText + "\nAssistant:";
}

/* ── Shared helper: build a clean user/assistant-alternating history ──
   Used by BOTH the main chat and the admin chat (was duplicated before).
   - drops the welcome message (slice 1)
   - keeps only the last `limit` turns to keep prompts small & fast
   - collapses consecutive same-role turns and ensures it starts with "user"   */
function buildAlternatingHistory(msgs, limit = 6) {
  const recent = msgs.slice(1).filter(m => typeof m.text === "string");
  const trimmed = limit ? recent.slice(-limit) : recent;
  const raw = trimmed.map(m => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
  const hist = [];
  for (const m of raw) {
    if (!hist.length || hist[hist.length - 1].role !== m.role) hist.push(m);
  }
  while (hist.length && hist[0].role !== "user") hist.shift();
  return hist;
}

/* ── Audio ── */
let _ac = null;
function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  // browsers suspend the context until a user gesture; resume so sound actually
  // plays (especially on iOS/Safari where it stays suspended otherwise)
  if (_ac.state === "suspended" && _ac.resume) _ac.resume();
  return _ac;
}
/* ── master audio bus: global volume + a touch of reverb for a warm piano ── */
let _sfxVol = 0.9, _sfxMuted = false, _busGain = null, _busCtx = null;
function setSfxVol(v) { _sfxVol = Math.max(0, Math.min(1, v)); if (_busGain) _busGain.gain.value = _sfxMuted ? 0 : _sfxVol; }
function setSfxMuted(m) { _sfxMuted = !!m; if (_busGain) _busGain.gain.value = _sfxMuted ? 0 : _sfxVol; }
function getSfxVol() { return _sfxVol; }
function getSfxMuted() { return _sfxMuted; }
function audioBus() {
  const ac = getAC();
  if (_busGain && _busCtx === ac) return { ac, bus: _busGain };
  _busCtx = ac;
  _busGain = ac.createGain();
  _busGain.gain.value = _sfxMuted ? 0 : _sfxVol;
  try { // blend in a short generated-impulse reverb for space
    const conv = ac.createConvolver();
    const len = Math.floor(ac.sampleRate * 1.5);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    conv.buffer = buf;
    const wet = ac.createGain(); wet.gain.value = 0.13;
    _busGain.connect(conv); conv.connect(wet); wet.connect(ac.destination);
  } catch (e) {}
  _busGain.connect(ac.destination);
  return { ac, bus: _busGain };
}
// piano-like timbre: fundamental + harmonics; higher partials decay faster
const _PARTIALS = [[1, 1.0, 1.0], [2, 0.5, 0.72], [3, 0.26, 0.52], [4, 0.13, 0.4], [6, 0.07, 0.3]];
function playPianoNote(note, dur = 0.7) {
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
    const peak = 0.33;
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
    }
  } catch (e) {}
}
// metronome click (routed direct to output so it stays audible/independent)
function playClick(accent) {
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
// light haptic tap feedback on supported devices
function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
// soft "miss" buzz for game feedback
function playMiss() {
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
function playWhoosh() {
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
function playBoom(big) {
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

let _accNoiseBuf = null, _accNoiseRate = 0;
function _accNoise(ac) {
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
let _accSuppress = [];
function _accMarkSuppress(freq, tolCents, untilMs) {
  if (!freq) return;
  const lo = freq * Math.pow(2, -tolCents / 1200), hi = freq * Math.pow(2, tolCents / 1200);
  _accSuppress.push({ lo, hi, until: untilMs });
  if (_accSuppress.length > 64) _accSuppress.shift();
}
function _accIsSuppressed(freq) {
  if (!freq || !_accSuppress.length) return false;
  const now = Date.now();
  _accSuppress = _accSuppress.filter(s => s.until > now);
  return _accSuppress.some(s => freq >= s.lo && freq <= s.hi);
}

// soft "got it, thinking…" earcon so the learner knows the AI heard them
// (reassuring on slow networks where the reply takes a moment)
function vmThinkCue() {
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
function playUi(kind) {
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
const _COMBO_SEMIS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
function playComboTone(step) {
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
let _amb = null;
function startAmbient() {
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
function stopAmbient() {
  if (!_amb) return;
  const { out, oscs, lfo, ac } = _amb; _amb = null;
  try {
    out.gain.cancelScheduledValues(ac.currentTime);
    out.gain.setValueAtTime(out.gain.value, ac.currentTime);
    out.gain.linearRampToValueAtTime(0, ac.currentTime + 1);
    setTimeout(() => { try { oscs.forEach(o => o.stop()); lfo.stop(); } catch (e) {} }, 1100);
  } catch (e) {}
}

/* ════════════════════════════════════════════════════════════
   PRACTICE MODE — listen to what the learner actually plays
   • Web MIDI  → exact notes (best; also handles chords)
   • Microphone → autocorrelation pitch detection (monophonic; best one
     note at a time / scales)
   • Tapping the on-screen keys also works as a fallback.
   Matching is octave-agnostic (by pitch class) to stay forgiving.
════════════════════════════════════════════════════════════ */
const _NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiToNoteName(midi) {
  const oct = Math.floor(midi / 12) - 1;
  return _NOTE_NAMES[((midi % 12) + 12) % 12] + oct;
}
function freqToNoteName(freq) {
  if (!freq || freq < 55 || freq > 2100) return null;
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return midiToNoteName(midi);
}
function pcOf(note) { return note.replace(/-?\d+$/, ""); } // pitch class (drop octave)

// Autocorrelation pitch detector (returns Hz, or -1 for silence/no pitch/not tonal).
// Based on the well-known ACF2+/PitchDetect approach.
function autoCorrelate(buf, sampleRate) {
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
  if (c[0] <= 0 || maxval / c[0] < 0.85) return -1;
  const x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);
  return T0 ? sampleRate / T0 : -1;
}
// TIMBRE GATE: is this spectrum piano-shaped, or does it carry a vowel formant?
// A struck piano string's overtones roll off in a fairly smooth curve (some natural
// ripple from the hammer-strike position, but no single harmonic jumps out). A sung/
// hummed/spoken vowel has a FORMANT — a resonance band fixed in absolute frequency no
// matter what pitch is sung — so whichever harmonic happens to land inside it gets
// boosted well above what the smooth rolloff around it would predict. That mismatch is
// what this checks for, using the FFT magnitude data the caller already has on hand.
// A generous margin is used on purpose: rejecting a real piano note is a worse failure
// than occasionally letting a very piano-like hum slip through.
function hasFormantSpike(db, sampleRate, fftSize, f0) {
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
    if (mags[i] - neighborAvg > 14) return true; // one harmonic way louder than its neighbors predict
  }
  return false;
}

/* ── Polyphonic (chord) pitch detection from a microphone ──────────────
   The autocorrelation detector above is monophonic — it locks onto ONE
   pitch, so a learner playing a triad on an acoustic piano only ever gets
   the loudest note named. This detector reads the FFT magnitude spectrum
   and uses HARMONIC SUMMATION: for every candidate piano note it sums the
   energy at that note's fundamental + first few harmonics. A real note has
   strong partials lined up on its harmonic series, so its summed salience
   spikes; the spikes of 2–4 simultaneous notes survive together. We then
   peak-pick, suppress octave/harmonic ghosts, and return the chord.
   It is intentionally conservative (high thresholds) — better to miss a
   note than to invent one — and only runs when the learner opts in. */
function _interpMag(mag, bin) {                 // linear-interpolate magnitude at a fractional bin
  const i = Math.floor(bin); if (i < 0 || i + 1 >= mag.length) return 0;
  const f = bin - i; return mag[i] * (1 - f) + mag[i + 1] * f;
}
// magSpectrum: Float32Array of linear magnitudes (NOT dB). Returns ascending note names (with octave).
function detectPolyNotes(mag, sampleRate, fftSize) {
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
  // keep notes that are a clear local peak AND a healthy fraction of the strongest
  const REL = 0.3;                               // ≥30% of the loudest note's salience
  const cands = [];
  for (let m = LO; m <= HI; m++) {
    const s = sal[m];
    if (s < maxSal * REL) continue;
    if (s < (sal[m - 1] || 0) || s < (sal[m + 1] || 0)) continue; // must be a local max
    cands.push({ m, s });
  }
  // semitone offsets at which one note's harmonics land on another (octave, +fifth, 2-oct, +3rd, ...)
  const GHOST = [12, 19, 24, 28, 31];
  // (a) upper harmonic ghost: a higher candidate fully explained by a much louder lower note → drop it
  let kept = cands.filter(c => !cands.some(o => o.m < c.m && o.s > c.s * 1.6 && GHOST.includes(c.m - o.m)));
  // (b) subharmonic ghost: a LOWER candidate whose own fundamental is barely there, sitting a
  //     harmonic interval below a real note (it's that note's even-harmonic echo) → drop it.
  //     A genuinely-played bass note keeps a strong fundamental, so it survives.
  kept = kept.filter(c => !kept.some(o => GHOST.includes(o.m - c.m) && (fund[c.m] || 0) < 0.4 * (fund[o.m] || 0)));
  kept.sort((a, b) => b.s - a.s);               // strongest first
  return kept.slice(0, 4).sort((a, b) => a.m - b.m).map(c => midiToNoteName(c.m));
}

// median of a small array (smooths pitch jitter before we commit to a note)
function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
// Signed cents from a detected frequency to the NEAREST occurrence of a target
// pitch class (octave-agnostic). 0 = perfectly in tune; ±100 = a full semitone.
// This lets us accept a slightly out-of-tune piano instead of demanding an exact Hz.
function centsFromPC(freq, targetPC) {
  if (!freq || freq <= 0) return 9999;
  const m = 69 + 12 * Math.log2(freq / 440);            // detected pitch as float MIDI
  const semi = _NOTE_NAMES.indexOf(targetPC);           // 0..11
  if (semi < 0) return 9999;
  const base = Math.round((m - semi) / 12) * 12 + semi; // nearest MIDI of that pitch class
  return (m - base) * 100;
}
// How far off a note may be and still count as correct, and how far the
// auto-tuning may drift to follow a piano that's consistently flat/sharp.
const PITCH_TOL_CENTS = 95;   // wide slack (~0.95 semitone) so out-of-tune pianos still count
const TUNE_OFFSET_CAP = 45;   // follow pianos that sit consistently flat/sharp up to ±45 cents

// active listener teardown handles
let _practiceStop = { midi: null, mic: null };
async function startMidiListener(onDetect, onReady) {
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
    if (!count) { access.onstatechange = null; return false; } // no device → fall back to mic
    if (onReady) onReady();
    _practiceStop.midi = () => {
      try { for (const inp of access.inputs.values()) inp.onmidimessage = null; access.onstatechange = null; } catch (e) {}
    };
    return true;
  } catch (e) { return false; }
}
async function startMicListener(onDetect, onReady, onError, opts) {
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
      let floor = 0.004, armed = true, captureAt = 0, lastFire = 0;
      const tick = () => {
        const t = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
        analyser.getFloatTimeDomainData(time);
        let rms = 0; for (let i = 0; i < time.length; i++) rms += time[i] * time[i];
        rms = Math.sqrt(rms / time.length);
        floor = floor * 0.995 + rms * 0.005;     // slow EMA of the room/noise floor
        // a chord ATTACK = energy jumps well above the floor while we're armed
        if (armed && captureAt === 0 && rms > Math.max(0.012, floor * 3) && (t - lastFire) > 220) {
          captureAt = t + 85;                    // let the attack transient settle (~85ms)
        }
        if (captureAt && t >= captureAt) {
          analyser.getFloatFrequencyData(db);    // dB → linear magnitude
          for (let i = 0; i < db.length; i++) { const v = db[i]; mag[i] = v <= -160 ? 0 : Math.pow(10, v / 20); }
          const notes = detectPolyNotes(mag, ac.sampleRate, analyser.fftSize);
          captureAt = 0; armed = false; lastFire = t;
          if (notes.length) onDetect(notes.length === 1
            ? { note: notes[0], freq: null, source: "mic" }
            : { note: notes[0], notes, freq: null, source: "mic", poly: true });
        }
        if (!armed && rms < Math.max(0.008, floor * 1.6)) armed = true; // re-arm once it quiets
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
          // name) within a tight 25-cent window. A struck piano string holds dead-steady
          // once it rings; a sung/hummed/spoken note wanders — even gentle vibrato is
          // 50+ cents — so anything that drifts resets the streak instead of accumulating.
          if (last != null && Math.abs(1200 * Math.log2(f / last)) < 25) { stable++; } else { last = f; stable = 1; fired = false; }
          // fire once per fresh, held-steady note (3 frames ≈ 140ms) — still fast enough
          // for legato/fast playing, since a pitch change re-arms even without a gap
          if (stable >= 3 && !fired) {
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
          if (silence >= 2) { last = null; stable = 0; fired = false; recent.length = 0; } // brief gap re-arms repeats
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
function stopPracticeListeners() {
  if (_practiceStop.midi) { try { _practiceStop.midi(); } catch (e) {} _practiceStop.midi = null; }
  if (_practiceStop.mic) { try { _practiceStop.mic(); } catch (e) {} _practiceStop.mic = null; }
}

/* ════════════════════════════════════════════════════════════
   PLAY-ALONG — falling-notes song mode (the headline feature of
   Synthesia / Simply Piano / Yousician / 小叶子, built on the same
   pitch detection + piano synth + gamification we already have).
════════════════════════════════════════════════════════════ */
function noteToMidi(n) {
  const m = n.match(/^([A-G]#?)(\d)$/);
  if (!m) return 0;
  return (parseInt(m[2], 10) + 1) * 12 + _NOTE_NAMES.indexOf(m[1]);
}
// a stable, pleasant hue per pitch class for the falling lanes
function laneHue(note) { return 320 + (_NOTE_NAMES.indexOf(pcOf(note)) * 2) % 25; }
// rounded-rect path helper for the canvas note blocks
function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// timing (seconds, song-time): how long a note falls, and the hit/miss windows
const SONG_LEAD = 2.4;
const SONG_HITWINDOW = 0.45;  // generous on purpose (forgiving, like the tuning work)
const SONG_PERFECT = 0.14;    // tighter window that earns a "Perfect"
const SONG_DEBOUNCE_MS = 130; // min gap between same-pitch hits — stops one press chain-hitting 2–3 notes
const SONG_ECHO_MS = 350;     // after a tap, ignore the mic hearing that same note (the app's own sound)
const SONG_MISSWINDOW = 0.5;

// Song library. seq = [noteName | "R", durationInBeats]. All notes live in the
// C4..B5 range the on-screen keyboard + synth cover. Public-domain melodies only.
const SONGS = [
  { id: "scale", diff: 1, bpm: 90,
    th: "สเกล C เมเจอร์", en: "C Major Scale", zh: "C大调音阶",
    seq: [["C4",1],["D4",1],["E4",1],["F4",1],["G4",1],["A4",1],["B4",1],["C5",1],
          ["C5",1],["B4",1],["A4",1],["G4",1],["F4",1],["E4",1],["D4",1],["C4",2]] },
  { id: "twinkle", diff: 1, bpm: 100,
    th: "ดาวน้อยกะพริบแสง", en: "Twinkle Twinkle", zh: "小星星",
    seq: [["C4",1],["C4",1],["G4",1],["G4",1],["A4",1],["A4",1],["G4",2],
          ["F4",1],["F4",1],["E4",1],["E4",1],["D4",1],["D4",1],["C4",2],
          ["G4",1],["G4",1],["F4",1],["F4",1],["E4",1],["E4",1],["D4",2],
          ["G4",1],["G4",1],["F4",1],["F4",1],["E4",1],["E4",1],["D4",2],
          ["C4",1],["C4",1],["G4",1],["G4",1],["A4",1],["A4",1],["G4",2],
          ["F4",1],["F4",1],["E4",1],["E4",1],["D4",1],["D4",1],["C4",2]] },
  { id: "mary", diff: 1, bpm: 110,
    th: "แมรี่มีลูกแกะ", en: "Mary Had a Little Lamb", zh: "玛丽有只小羊羔",
    seq: [["E4",1],["D4",1],["C4",1],["D4",1],["E4",1],["E4",1],["E4",2],
          ["D4",1],["D4",1],["D4",2],["E4",1],["G4",1],["G4",2],
          ["E4",1],["D4",1],["C4",1],["D4",1],["E4",1],["E4",1],["E4",1],["E4",1],["D4",1],["D4",1],["E4",1],["D4",1],["C4",2]] },
  { id: "tigers", diff: 2, bpm: 110,
    th: "สองเสือ (Frère Jacques)", en: "Frère Jacques", zh: "两只老虎",
    seq: [["C4",1],["D4",1],["E4",1],["C4",1],["C4",1],["D4",1],["E4",1],["C4",1],
          ["E4",1],["F4",1],["G4",2],["E4",1],["F4",1],["G4",2],
          ["G4",0.5],["A4",0.5],["G4",0.5],["F4",0.5],["E4",1],["C4",1],
          ["G4",0.5],["A4",0.5],["G4",0.5],["F4",0.5],["E4",1],["C4",1],
          ["C4",1],["G4",1],["C4",2],["C4",1],["G4",1],["C4",2]] },
  { id: "ode", diff: 2, bpm: 100,
    th: "เพลงแห่งความสุข", en: "Ode to Joy", zh: "欢乐颂",
    seq: [["E4",1],["E4",1],["F4",1],["G4",1],["G4",1],["F4",1],["E4",1],["D4",1],["C4",1],["C4",1],["D4",1],["E4",1],["E4",1.5],["D4",0.5],["D4",2],
          ["E4",1],["E4",1],["F4",1],["G4",1],["G4",1],["F4",1],["E4",1],["D4",1],["C4",1],["C4",1],["D4",1],["E4",1],["D4",1.5],["C4",0.5],["C4",2]] },
  { id: "jingle", diff: 2, bpm: 120,
    th: "จิงเกิลเบลส์", en: "Jingle Bells", zh: "铃儿响叮当",
    seq: [["E4",1],["E4",1],["E4",2],["E4",1],["E4",1],["E4",2],
          ["E4",1],["G4",1],["C4",1],["D4",1],["E4",4],
          ["F4",1],["F4",1],["F4",1],["F4",1],["F4",1],["E4",1],["E4",1],["E4",1],["E4",1],["D4",1],["D4",1],["E4",1],["D4",2],["G4",2]] },
  { id: "birthday", diff: 3, bpm: 100,
    th: "สุขสันต์วันเกิด", en: "Happy Birthday", zh: "生日快乐",
    seq: [["G4",1],["G4",1],["A4",1],["G4",1],["C5",1],["B4",2],
          ["G4",1],["G4",1],["A4",1],["G4",1],["D5",1],["C5",2],
          ["G4",1],["G4",1],["G5",1],["E5",1],["C5",1],["B4",1],["A4",2],
          ["F5",1],["F5",1],["E5",1],["C5",1],["D5",1],["C5",2]] },
  { id: "row", diff: 1, bpm: 100,
    th: "พายเรือ", en: "Row Your Boat", zh: "划船歌",
    seq: [["C4",1],["C4",1],["C4",1],["D4",1],["E4",2],
          ["E4",1],["D4",1],["E4",1],["F4",1],["G4",3],
          ["C5",0.5],["C5",0.5],["C5",0.5],["G4",0.5],["G4",0.5],["G4",0.5],["E4",0.5],["E4",0.5],["E4",0.5],["C4",0.5],["C4",0.5],["C4",0.5],
          ["G4",1],["F4",1],["E4",1],["D4",1],["C4",3]] },
  { id: "london", diff: 2, bpm: 110,
    th: "สะพานลอนดอน", en: "London Bridge", zh: "伦敦桥",
    seq: [["D5",1],["E5",1],["D5",1],["C5",1],["B4",1],["C5",1],["D5",2],
          ["A4",1],["B4",1],["C5",2],["B4",1],["C5",1],["D5",2],
          ["D5",1],["E5",1],["D5",1],["C5",1],["B4",1],["C5",1],["D5",2],
          ["A4",2],["D5",1],["B4",1],["G4",2]] },
  { id: "saints", diff: 2, bpm: 120,
    th: "เมื่อนักบุญเดินทัพ", en: "When the Saints", zh: "圣徒进行曲",
    seq: [["C4",1],["E4",1],["F4",1],["G4",3],["C4",1],["E4",1],["F4",1],["G4",3],
          ["C4",1],["E4",1],["F4",1],["G4",2],["E4",1],["C4",1],["E4",1],["D4",3],
          ["E4",1],["E4",1],["D4",1],["C4",2],["C4",1],["E4",1],["G4",2],["G4",1],["F4",1],
          ["E4",1],["F4",1],["G4",1],["E4",1],["C4",1],["D4",1],["C4",3]] },
  { id: "furelise", diff: 3, bpm: 80,
    th: "ฟือร์ เอลีเซ", en: "Für Elise", zh: "致爱丽丝",
    seq: [["E5",0.5],["D#5",0.5],["E5",0.5],["D#5",0.5],["E5",0.5],["B4",0.5],["D5",0.5],["C5",0.5],["A4",1],
          ["C4",0.5],["E4",0.5],["A4",0.5],["B4",1],["E4",0.5],["G#4",0.5],["B4",0.5],["C5",1],
          ["E4",0.5],["E5",0.5],["D#5",0.5],["E5",0.5],["D#5",0.5],["E5",0.5],["B4",0.5],["D5",0.5],["C5",0.5],["A4",1]] },
];
// Expand a song into timed note objects + the set of lanes (distinct pitches).
function expandSong(song) {
  const spb = 60 / song.bpm; // seconds per beat
  let beat = 0;
  const notes = [];
  for (const [note, dur] of song.seq) {
    if (note !== "R") notes.push({ note, t: beat * spb, durSec: Math.max(0.18, dur * spb * 0.92), hit: false, missed: false, lane: 0 });
    beat += dur;
  }
  const lanes = Array.from(new Set(notes.map(n => n.note))).sort((a, b) => noteToMidi(a) - noteToMidi(b));
  for (const n of notes) n.lane = lanes.indexOf(n.note);
  const lastT = notes.reduce((m, n) => Math.max(m, n.t), 0);
  return { notes, lanes, total: notes.length, dur: beat * spb, lastT };
}

/* ════════════════════════════════════════════════════════════
   PLAY-ALONG DRILLS — generate playable falling-notes "songs" for
   scales (every key · every minor type), chords (triads + 7ths) and
   intervals (ขั้นคู่). Each returns a SONG-shaped meta the game runs.
   All notes are kept inside C4–B5 so they line up on the game keyboard.
════════════════════════════════════════════════════════════ */
// 12 roots (circle-of-fifths-ish order), each as a pitch class + a friendly name.
const DRILL_KEYS = [
  { pc: "C",  nm: "C"  }, { pc: "G",  nm: "G"  }, { pc: "D",  nm: "D"  },
  { pc: "A",  nm: "A"  }, { pc: "E",  nm: "E"  }, { pc: "B",  nm: "B"  },
  { pc: "F#", nm: "F♯" }, { pc: "C#", nm: "D♭" }, { pc: "G#", nm: "A♭" },
  { pc: "D#", nm: "E♭" }, { pc: "A#", nm: "B♭" }, { pc: "F",  nm: "F"  },
];
// Lay a list of pitch classes out ascending into real octaves from startOct,
// bumping the octave each time we wrap past B→C.
function _ascNotes(pcs, startOct = 4) {
  const out = []; let oct = startOct, prev = -1;
  for (const pc of pcs) {
    const idx = CHROMA.indexOf(pc);
    if (prev >= 0 && idx <= prev) oct++;
    out.push(pc + oct); prev = idx;
  }
  return out;
}
function _drillSeq(noteNames) {
  return noteNames.map((n, i) => [n, i === noteNames.length - 1 ? 2 : 1]);
}
// One-octave scale, up then back down (classic practice shape).
function makeScaleSong(rootPC, rootNm, scaleType, label, bpm = 84) {
  const pcs = scaleNotesOf(rootPC, scaleType);
  const asc = _ascNotes(pcs, 4);
  const all = [...asc, pcs[0] + "5", ...asc.slice().reverse()];
  return {
    id: "sc_" + scaleType.replace(/\s+/g, "") + "_" + rootPC, drill: true, cat: "scale", diff: 1, bpm,
    th: rootNm + " " + label.th, en: rootNm + " " + label.en, zh: rootNm + label.zh, seq: _drillSeq(all),
  };
}
// Broken chord (arpeggio) up then down — triad adds the octave, 7th stays root-3-5-7.
function makeChordSong(rootPC, rootNm, chordType, label, bpm = 80) {
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
function makeIntervalSong(semi, label, bpm = 72) {
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
const MINOR_TYPES = [
  { key: "natural minor",  th: "ไมเนอร์แท้",       en: "Natural",  zh: "自然小调",
    lab: { th: "ไมเนอร์แท้",      en: "Natural Minor",  zh: "自然小调" } },
  { key: "harmonic minor", th: "ฮาร์มอนิก",         en: "Harmonic", zh: "和声小调",
    lab: { th: "ฮาร์มอนิกไมเนอร์", en: "Harmonic Minor", zh: "和声小调" } },
  { key: "melodic minor",  th: "เมโลดิก",           en: "Melodic",  zh: "旋律小调",
    lab: { th: "เมโลดิกไมเนอร์",   en: "Melodic Minor",  zh: "旋律小调" } },
];
const TRIAD_TYPES = [
  { key: "major", th: "เมเจอร์",  en: "Major",      zh: "大三和弦", lab: { th: "เมเจอร์ ไทรแอด",  en: "Major Triad",      zh: "大三和弦" } },
  { key: "minor", th: "ไมเนอร์",  en: "Minor",      zh: "小三和弦", lab: { th: "ไมเนอร์ ไทรแอด",  en: "Minor Triad",      zh: "小三和弦" } },
  { key: "dim",   th: "ดิม",      en: "Dim",        zh: "减三和弦", lab: { th: "ดิมินิช ไทรแอด",  en: "Diminished Triad", zh: "减三和弦" } },
  { key: "aug",   th: "ออก",      en: "Aug",        zh: "增三和弦", lab: { th: "ออกเมนเต็ด",      en: "Augmented Triad",  zh: "增三和弦" } },
];
const SEVENTH_TYPES = [
  { key: "maj7", th: "Maj7", en: "Maj7", zh: "大七", lab: { th: "เมเจอร์ 7",   en: "Major 7th",      zh: "大七和弦" } },
  { key: "min7", th: "min7", en: "min7", zh: "小七", lab: { th: "ไมเนอร์ 7",   en: "Minor 7th",      zh: "小七和弦" } },
  { key: "7",    th: "Dom7", en: "Dom7", zh: "属七", lab: { th: "โดมินันต์ 7", en: "Dominant 7th",   zh: "属七和弦" } },
  { key: "dim7", th: "dim7", en: "dim7", zh: "减七", lab: { th: "ดิมินิช 7",   en: "Diminished 7th", zh: "减七和弦" } },
];
const INTERVAL_DEFS = [
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
const MAJOR_SCALE_SONGS = DRILL_KEYS.map(k => makeScaleSong(k.pc, k.nm, "major", { th: "เมเจอร์", en: "Major", zh: "大调" }));
const MINOR_SCALE_SONGS = MINOR_TYPES.reduce((m, t) => { m[t.key] = DRILL_KEYS.map(k => makeScaleSong(k.pc, k.nm, t.key, t.lab)); return m; }, {});
const TRIAD_SONGS = TRIAD_TYPES.reduce((m, t) => { m[t.key] = DRILL_KEYS.map(k => makeChordSong(k.pc, k.nm, t.key, t.lab)); return m; }, {});
const SEVENTH_SONGS = SEVENTH_TYPES.reduce((m, t) => { m[t.key] = DRILL_KEYS.map(k => makeChordSong(k.pc, k.nm, t.key, t.lab)); return m; }, {});
const INTERVAL_SONGS = INTERVAL_DEFS.map(d => makeIntervalSong(d.semi, d));

/* ════════════════════════════════════════════════════════════
   SIGHT-READING — show a note on a treble staff, learner identifies
   and plays it. (Flowkey / Musicca style.)
════════════════════════════════════════════════════════════ */
const SIGHT_NOTES = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5"];
// Bass-clef pool: G2 (bottom line) up through middle C — the range a beginner reads in กุญแจฟา.
const SIGHT_NOTES_BASS = ["F2","G2","A2","B2","C3","D3","E3","F3","G3","A3","B3","C4"];
const SIGHT_ROUND = 10; // notes per sight-reading round
const _LETTER_IDX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
// staff "step": bottom line = 0, each line-or-space = 1 up. Treble bottom line = E4,
// bass bottom line = G2 — pick the base so each clef's lines land in the right place.
function staffStep(note, clef = "treble") {
  const m = note.match(/^([A-G])#?(\d)$/);
  if (!m) return 0;
  const di = parseInt(m[2], 10) * 7 + _LETTER_IDX[m[1]];
  const base = clef === "bass" ? (2 * 7 + 4) : (4 * 7 + 2); // G2 (bass) | E4 (treble)
  return di - base;
}

/* ════════════════════════════════════════════════════════════
   HAND-POSTURE COACH — lazy-load MediaPipe Tasks Vision (hand
   landmarks) from CDN in the learner's browser, draw a live skeleton
   and give simple posture feedback. Not key-detection — a mirror/coach.
════════════════════════════════════════════════════════════ */
const MP_VER = "0.10.14";
let _handLm = null, _mpLoading = null;
async function loadHandLandmarker() {
  if (_handLm) return _handLm;
  if (_mpLoading) return _mpLoading;
  _mpLoading = (async () => {
    const url = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
    const vision = await import(/* @vite-ignore */ url);
    const fileset = await vision.FilesetResolver.forVisionTasks(url + "/wasm");
    _handLm = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
      numHands: 2,
      runningMode: "VIDEO",
    });
    return _handLm;
  })();
  return _mpLoading;
}
// bone connections for the 21-point MediaPipe hand
const HAND_BONES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];
const FINGER_TIPS = [8,12,16,20];   // index..pinky tips (skip thumb)
const FINGER_PIPS = [6,10,14,18];   // matching pip joints
// rough "are the fingers nicely curved" estimate from one hand's landmarks
function handRoundness(lm) {
  const wrist = lm[0];
  const span = Math.hypot(lm[12].x - wrist.x, lm[12].y - wrist.y) || 1;
  let curled = 0;
  for (let i = 0; i < FINGER_TIPS.length; i++) {
    const tip = lm[FINGER_TIPS[i]], pip = lm[FINGER_PIPS[i]];
    const tipD = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const pipD = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    // curved finger → tip not much farther from the wrist than its pip joint
    if (tipD < pipD + span * 0.18) curled++;
  }
  return curled / FINGER_TIPS.length; // 0 = flat, 1 = nicely curved
}

/* ── TTS ── */
const TTS_LOCALES = { th: "th-TH", en: "en-US", zh: "zh-CN" };
const TTS_RATE = { th: 0.9, en: 0.95, zh: 0.92 };

function ttsSupported() {
  return typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
}
/* speech-to-text (Web Speech API) — powers the AI voice tutor */
function getSR() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
function sttSupported() { return !!getSR(); }
let _voices = [];
function refreshVoices() {
  if (ttsSupported()) _voices = window.speechSynthesis.getVoices() || [];
}
if (ttsSupported()) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}
// Name hints for male / female voices across iOS, macOS, Android, Windows, Chrome.
// (Web Speech exposes no reliable gender field, so we match on voice names.)
const MALE_VOICE_HINTS = /\b(male|man)\b|aaron|alex|arthur|daniel|fred|gordon|oliver|rishi|reed|rocko|eddy|albert|ralph|thomas|david|mark|guy|ryan|liam|william|james|george|brian|matthew|nathan|eric|yunyang|yunxi|yunjian|kangkang|zhiwei|nattawut|niwat/i;
const FEMALE_VOICE_HINTS = /\b(female|woman)\b|samantha|victoria|karen|moira|tessa|fiona|nora|sandy|shelley|kanya|narisa|ting-?ting|sin-?ji|mei-?jia|xiaoxiao|huihui|yaoyao|zira|susan|hazel|catherine|linda|heather|aria|jenny/i;

// Pick the most natural voice for a locale, preferring the requested gender (male by default).
function bestVoice(locale, prefer = "male") {
  const all = _voices.length ? _voices : (ttsSupported() ? window.speechSynthesis.getVoices() : []);
  const base = locale.split("-")[0];
  const cands = all.filter(v => v.lang && (v.lang === locale || v.lang.startsWith(base)));
  if (!cands.length) return null;
  const wantMale = prefer !== "female";
  cands.sort((a, b) => {
    const score = v => {
      const n = (v.name || "").toLowerCase();
      const g = (v.gender || "").toLowerCase(); // non-standard; present on a few platforms
      let s = 0;
      if (v.lang === locale) s += 30;
      // gender preference — the user explicitly asked for a male voice
      const isMale = g === "male" || MALE_VOICE_HINTS.test(n);
      const isFemale = g === "female" || FEMALE_VOICE_HINTS.test(n);
      if (wantMale) { if (isMale) s += 60; else if (isFemale) s -= 35; }
      // naturalness: enhanced/premium/neural voices sound far better than compact —
      // weight these heavily so we never pick a robotic stock voice when a good one exists.
      if (/neural|natural|premium|enhanced|wavenet|studio|siri|online/.test(n)) s += 48;
      if (n.includes("google")) s += 22;
      if (v.localService) s += 4;
      if (/compact|espeak|eloquence|robot/.test(n)) s -= 60;
      return s;
    };
    return score(b) - score(a);
  });
  return cands[0];
}
function cleanForTTS(t) {
  return t.replace(/[◈▶⏸⤢✕•🔊⏹🔇🎹🎵⚠💡🪙🎁]/g, "")
    .replace(/\*\*/g, "")               // markdown bold markers → drop just the ** (keep the inner words)
    // then strip whole *stage-direction* spans (e.g. "*chuckles*", "*plays a note*") —
    // the model is told to sound expressive, but if it ever slips into
    // screenplay-style action text this must never be read aloud word-for-word.
    // Must run AFTER the ** strip above, else "**bold**" mis-pairs across the
    // inner two asterisks and eats the words instead of just the markers.
    .replace(/\*[^*\n]{1,60}\*/g, "")
    .replace(/[*_`~]/g, "")
    .replace(/\n{2,}/g, ". ").replace(/\n/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Chrome bug: synthesis pauses on long utterances. This keeps it alive.
let _ttsResumeTimer = null;
function startResumeKeepAlive() {
  stopResumeKeepAlive();
  _ttsResumeTimer = setInterval(() => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else {
      stopResumeKeepAlive();
    }
  }, 8000);
}
function stopResumeKeepAlive() {
  if (_ttsResumeTimer) { clearInterval(_ttsResumeTimer); _ttsResumeTimer = null; }
}

// split long text into <=180 char chunks at sentence boundaries (avoids 15s cutoff)
function chunkText(text, max = 180) {
  const parts = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
  const chunks = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > max && cur) { chunks.push(cur.trim()); cur = p; }
    else cur += p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}

/* Robust speak: must be called from a user gesture. Returns true if started. */
function speakRobust(text, lang, onDone, onBlocked, rateMul = 1) {
  if (!ttsSupported()) return false;
  const synth = window.speechSynthesis;
  try {
    synth.cancel(); // clear any stuck queue
    stopResumeKeepAlive();

    const clean = cleanForTTS(text);
    if (!clean) { if (onDone) onDone(); return false; }

    const locale = TTS_LOCALES[lang] || "en-US";
    const voice = bestVoice(locale);
    const rate = Math.max(0.5, Math.min(2, (TTS_RATE[lang] || 0.95) * (rateMul || 1)));
    const chunks = chunkText(clean);

    let idx = 0;
    let started = false;
    const speakNext = () => {
      if (idx >= chunks.length) { stopResumeKeepAlive(); if (onDone) onDone(); return; }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      u.lang = voice ? voice.lang : locale;
      if (voice) u.voice = voice;
      u.rate = rate; u.pitch = 0.97; u.volume = 1.0; // slightly warmer pitch = less robotic
      // Android Chrome sometimes never fires onend — guard each chunk so playback
      // (and the resolve that follows) always advances instead of hanging.
      let advanced = false;
      const advance = () => { if (advanced) return; advanced = true; clearTimeout(chunkGuard); idx++; speakNext(); };
      const chunkGuard = setTimeout(advance, Math.min(24000, 2500 + chunks[idx].length * 135));
      u.onstart = () => { started = true; };
      u.onend = advance;
      u.onerror = advance;
      synth.speak(u);
    };

    // iOS/Chrome warm-up: an empty resume call unlocks the engine inside the gesture
    synth.resume();
    speakNext();
    startResumeKeepAlive();

    // Detect the "silent block" case: inside claude.ai's sandboxed iframe the
    // Web Speech API is often blocked by Permissions-Policy — speak() returns
    // without error but nothing ever plays. If neither onstart fired nor the
    // engine reports speaking/pending within 1.2s, treat it as blocked.
    setTimeout(() => {
      if (!started && !synth.speaking && !synth.pending) {
        stopResumeKeepAlive();
        synth.cancel();
        if (onBlocked) onBlocked();
      }
    }, 1200);

    return true;
  } catch (e) {
    stopResumeKeepAlive();
    return false;
  }
}
function stopSpeaking() {
  stopResumeKeepAlive();
  try { window.speechSynthesis.cancel(); } catch (e) {}
}

/* ── Cloud TTS (Gemini, natural male voice) via the piano-tts Edge Function ──
   Plays through the shared AudioContext so iOS Safari keeps the audio unlocked
   (the context is resumed inside the click gesture before the network call).
   The text is split into short chunks so the FIRST clip is generated and played
   quickly, while later chunks are prefetched during playback (low latency). */
let _ttsSource = null;
let _ttsCancelled = false;
function stopCloudTTS() {
  _ttsCancelled = true;
  if (_ttsSource) { try { _ttsSource.stop(); } catch (e) {} _ttsSource = null; }
}
function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
// Split into ~130-char chunks at sentence enders, then at spaces (works for Thai,
// which often has no sentence punctuation), so the first clip is short = fast.
function ttsChunks(text, max = 130) {
  const out = [];
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    while (s.length > max) {
      let cut = s.lastIndexOf(" ", max);
      if (cut < max * 0.6) cut = max; // no good space nearby — hard cut
      out.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) out.push(s);
  }
  return out.length ? out : [text];
}
/* Returns true if cloud audio started; on any failure calls onError (so the
   caller can fall back to the device Web Speech voice). */
/* ── Voice character + warmth: Gemini 2.5 TTS takes a natural-language style
   direction (it speaks only the quoted content, in that tone) — this is what
   turns a flat read into a warm, human, world-class-teacher delivery. ── */
const VM_VOICES = [
  { k: "warm",     v: "Sulafat", th: "อบอุ่น",    en: "Warm",     zh: "温暖" },
  { k: "deep",     v: "Charon",  th: "ทุ้มลึก",    en: "Deep",     zh: "低沉" },
  { k: "friendly", v: "Achird",  th: "เป็นกันเอง", en: "Friendly", zh: "亲切" },
  { k: "bright",   v: "Zephyr",  th: "สดใส",      en: "Bright",   zh: "明亮" },
];
function getVmVoiceKey() { try { return localStorage.getItem("tg_vmvoice") || "warm"; } catch (e) { return "warm"; } }
function getVmVoiceName() { const f = VM_VOICES.find(x => x.k === getVmVoiceKey()); return f ? f.v : "Sulafat"; }
// the teacher's emotional tone adapts to the moment (a master teacher never sounds flat)
let _ttsMood = "warm";
function setTtsMood(m) { _ttsMood = m || "warm"; }
function vmStyleFor(lang, mood) {
  const m = mood || _ttsMood || "warm";
  const D = {
    warm: {
      th: "อ่านข้อความในเครื่องหมายคำพูดด้วยน้ำเสียงครูสอนเปียโนระดับโลกที่อบอุ่น เป็นกันเอง ให้กำลังใจ พูดเป็นธรรมชาติเหมือนคนจริง จังหวะนุ่มนวลมีชีวิตชีวา ไม่ใช่หุ่นยนต์",
      zh: "用温暖、亲切、鼓励的世界级钢琴老师语气，像真人一样自然、富有表现力地朗读引号中的文字，不要机械感。",
      en: "Read the quoted text as a warm, encouraging, world-class piano teacher speaking naturally like a real person — friendly, clear, with gentle expressive pacing, never robotic.",
    },
    celebrate: {
      th: "อ่านข้อความในเครื่องหมายคำพูดด้วยน้ำเสียงครูเปียโนที่ตื่นเต้น ดีใจ และภูมิใจในตัวลูกศิษย์มาก พลังบวกเต็มเปี่ยม ยิ้มขณะพูด เป็นธรรมชาติเหมือนคนจริง",
      zh: "用兴奋、自豪、为学生由衷高兴的钢琴老师语气，充满正能量、面带微笑、像真人一样自然地朗读引号中的文字。",
      en: "Read the quoted text as a piano teacher who is excited, proud and genuinely delighted with the student — upbeat, smiling and energetic, natural like a real person.",
    },
    gentle: {
      th: "อ่านข้อความในเครื่องหมายคำพูดด้วยน้ำเสียงครูเปียโนที่อ่อนโยน ใจเย็น ปลอบใจและให้กำลังใจอย่างนุ่มนวล ไม่กดดัน เป็นธรรมชาติเหมือนคนจริง",
      zh: "用温柔、耐心、给予安慰和轻声鼓励的钢琴老师语气，不带压力、像真人一样自然地朗读引号中的文字。",
      en: "Read the quoted text as a piano teacher who is gentle, calm and reassuring — soft, patient and comforting, never pressuring, natural like a real person.",
    },
  };
  const set = D[m] || D.warm;
  return set[lang] || set.en;
}
// wrap one chunk with the (mood-aware) tone direction (quoted so the directive isn't spoken)
function styleTTS(s, lang) { return vmStyleFor(lang) + "\n\n\"" + String(s).replace(/"/g, "'") + "\""; }

async function speakCloud(text, lang, onStart, onDone, onError, rateMul = 1) {
  stopCloudTTS();
  _ttsCancelled = false;
  const clean = cleanForTTS(text);
  if (!clean) { if (onDone) onDone(); return false; }
  const ac = getAC(); // resume/unlock the audio context inside the user gesture
  const chunks = ttsChunks(clean);

  const fetchBuf = async (s) => {
    // Hard timeout so a weak signal fails FAST and we fall back to the local
    // device voice instead of leaving a long silent gap mid-lesson.
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4500);
    try {
      const res = await fetch(TTS_URL, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ text: styleTTS(s, lang), lang, voice: getVmVoiceName() }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j && j.error ? j.error : ""; } catch (e) {}
        throw new Error(detail || ("TTS HTTP " + res.status));
      }
      const data = await res.json();
      if (!data || !data.audio) throw new Error("no audio");
      return await ac.decodeAudioData(b64ToArrayBuffer(data.audio));
    } finally { clearTimeout(to); }
  };

  try {
    let nextP = fetchBuf(chunks[0]); // kick off the first clip right away
    let firstStarted = false;
    for (let i = 0; i < chunks.length; i++) {
      const curP = nextP;
      if (i + 1 < chunks.length) nextP = fetchBuf(chunks[i + 1]); // prefetch next while this plays
      let buf;
      try { buf = await curP; }
      catch (e) { if (i === 0) throw e; else break; } // first fails -> fallback; later -> stop gracefully
      if (_ttsCancelled) return true;
      if (!firstStarted) { firstStarted = true; if (onStart) onStart(); }
      await new Promise((resolve) => {
        const src = ac.createBufferSource();
        src.buffer = buf;
        if (rateMul && rateMul !== 1) src.playbackRate.value = Math.max(0.5, Math.min(1.8, rateMul));
        src.connect(ac.destination);
        src.onended = resolve;
        _ttsSource = src;
        try { src.start(); } catch (e) { resolve(); }
      });
      if (_ttsCancelled) return true;
    }
    _ttsSource = null;
    if (onDone) onDone();
    return true;
  } catch (e) {
    stopCloudTTS();
    if (onError) onError(e);
    return false;
  }
}

/* Prefetch + decode all cloud-TTS clips for a line of text (look-ahead, so the
   next sentence's audio is ready before the current one finishes — gapless voice).
   Returns AudioBuffer[]; throws on any failure so the caller can fall back. */
async function fetchCloudClips(text, lang) {
  const clean = cleanForTTS(text);
  if (!clean) return [];
  const ac = getAC();
  const chunks = ttsChunks(clean);
  const fetchOne = (s) => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4500);
    return fetch(TTS_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify({ text: styleTTS(s, lang), lang, voice: getVmVoiceName() }), signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("tts " + res.status);
        const data = await res.json();
        if (!data || !data.audio) throw new Error("no audio");
        return ac.decodeAudioData(b64ToArrayBuffer(data.audio));
      })
      .finally(() => clearTimeout(to));
  };
  return Promise.all(chunks.map(fetchOne)); // fetch all chunks in parallel, keep order
}
/* Play already-decoded clips back-to-back through the shared context. */
async function playCloudClips(clips, rateMul, isCancelled) {
  const ac = getAC();
  _ttsCancelled = false;
  for (const buf of clips) {
    if (!buf || _ttsCancelled || (isCancelled && isCancelled())) return;
    await new Promise((resolve) => {
      const src = ac.createBufferSource();
      src.buffer = buf;
      if (rateMul && rateMul !== 1) src.playbackRate.value = Math.max(0.5, Math.min(1.8, rateMul));
      src.connect(ac.destination);
      src.onended = resolve;
      _ttsSource = src;
      try { src.start(); } catch (e) { resolve(); }
    });
  }
  _ttsSource = null;
}

/* ── Language config ── */
const L = {
  th: {
    ph: "ถามเรื่องเปียโน เช่น C major scale คืออะไร?",
    hint: "[ ถามได้เฉพาะเรื่องเปียโน • AI POWERED ]",
    aiLabel: "TIGA AI • ออนไลน์",
    pianoLabel: "🎹 เปียโนของฉัน — กดเล่นได้เลย!", replay: "🔁 ฟังซ้ำ", leftHand: "✋ มือซ้าย", rightHand: "มือขวา 🤚", fingerLabel: "เลขนิ้ว",
    expand: "⤢ ขยาย", close: "✕ ปิด",
    speak: "🔊 ฟัง", speaking: "⏹ หยุด",
    welcome: "สวัสดีครับ! ผมคือ TiGA AI ครูเปียโน 🎹\n\nถามได้เลยครับ — คอร์ด, สเกล, เทคนิค, โน้ต, ทฤษฎีดนตรีทุกอย่าง!\nลองกดคีย์เปียโนด้านบนได้เลยครับ 🎵",
    sys: "คุณคือ TiGA AI ครูเปียโน Tiga Studio ตอบเฉพาะเรื่องเปียโน กระชับ ตรงประเด็น ไม่เกิน 50 คำ ตอบภาษาไทย เมื่อพูดถึงคอร์ด/สเกลให้ระบุโน้ตเช่น C4 E4 G4 ปฏิเสธคำถามนอกเรื่องเปียโนสั้นๆ",
    err: "ขอโทษครับ ครูไม่ได้ยินชัดเลย ลองพูดอีกทีได้ไหมครับ",
    ttsNo: "🔇 อุปกรณ์นี้ไม่รองรับเสียง",
    ttsBlocked: "🔇 เสียงถูกบล็อกใน preview — กดเปิดในแท็บใหม่ (มุมขวาบน ⋮ › Open in new tab) แล้วลองอีกครั้งครับ",
    navSensei: "TIGA AI", navPath: "เส้นทางเรียนรู้", navVideos: "วิดีโอสอน", videosEmpty: "ยังไม่มีวิดีโอสอนตอนนี้", admVideos: "วิดีโอ", admVidUpload: "อัปโหลดวิดีโอใหม่", admVidTitle: "ชื่อวิดีโอ", admVidDesc: "คำอธิบาย (ไม่บังคับ)", admVidPick: "เลือกไฟล์วิดีโอ", admVidUploading: "กำลังอัปโหลด…", admVidPublished: "เผยแพร่แล้ว", admVidDraft: "ฉบับร่าง", admVidPublish: "เผยแพร่", admVidUnpublish: "ซ่อน", admVidDelete: "ลบ", admVidEmpty: "ยังไม่มีวิดีโอ อัปโหลดอันแรกได้เลย", admVidTooBig: "ไฟล์ใหญ่เกินไป (สูงสุด 500MB)", admVidErr: "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง",
    playDemo: "▶ เล่นตัวอย่าง", pathTitle: "เส้นทางการเรียนรู้", pathSub: "เลือกหัวข้อ แล้ว AI จะสอนให้",
    pathGuide: "เริ่มจากบนลงล่าง: รากฐาน → คอร์ด → ขั้นสูง เรียนตามลำดับแล้วเก่งแน่นอน",
    learnBtn: "เรียนเรื่องนี้", readBtn: "อ่านบทเรียน", caseOverview: "ภาพรวม", caseSub: "เลือกกรณีศึกษา", keysLearned: "เรียนแล้ว {n} คีย์", pathFoot: "◈ แตะหัวข้อใดก็ได้ AI จะสอนพร้อมเล่นบนเปียโนให้ ◈",
    pickKey: "เลือกคีย์ที่ต้องการเรียน", pickKeyHint: "เลือกได้ทั้ง 12 คีย์ — AI จะสอนคีย์ที่คุณเลือก",
    pickType: "เลือกชนิดที่ต้องการเรียน", pickTypeHint: "เลือกชนิดก่อน แล้วเลือกคีย์",
    adminTitle: "ADMIN CONSOLE", adminSub: "โหมดผู้ดูแลระบบ — สอน AI ได้อิสระ",
    adminPh: "พิมพ์เพื่อสอน AI เรื่องดนตรี ธุรกิจ หรือความรู้ที่ต้องการ...",
    adminSys: "คุณคือผู้ช่วย AI ส่วนตัวของ Tiga ผู้ก่อตั้ง Tiga Studio (โรงเรียนสอนเปียโนพรีเมียมในกรุงเทพ) คุณเชี่ยวชาญทั้งดนตรี ทฤษฎีเปียโน การสอน และการประยุกต์ใช้ดนตรีกับธุรกิจ การตลาด เทคโนโลยี AI และนวัตกรรม ตอบอย่างลึกซึ้ง ตรงประเด็น ไม่มี filler ให้ข้อมูลที่เป็นจริงและนำไปใช้ได้จริง ในโหมดนี้คุณตอบได้ทุกเรื่องที่ Tiga ต้องการ ไม่จำกัดแค่เปียโน",
    adminChips: ["สอน AI เรื่องการตลาดโรงเรียนดนตรี", "ไอเดียคอนเทนต์ TikTok สอนเปียโน", "วิเคราะห์คู่แข่งธุรกิจสอนดนตรี", "การใช้ AI เพิ่มยอดขายคอร์ส"],
    webLabel: "ค้นเน็ต", webHint: "เปิดเพื่อให้ AI ค้นข้อมูลจากอินเทอร์เน็ต", attachHint: "แนบรูปภาพ",
    lockTitle: "RESTRICTED ACCESS", lockSub: "พื้นที่นี้สงวนเฉพาะผู้ดูแลระบบ\nกรุณาใส่รหัสลับเพื่อเข้าถึง",
    lockEnter: "ปลดล็อก", lockErr: "รหัสไม่ถูกต้อง", lockPlace: "• • • • • •",
    navProfile: "โปรไฟล์", profTitle: "โปรไฟล์ของฉัน",
    profExpStat: "EXP สะสม", profLessonsStat: "บทเรียนที่ฝึก", profStreakBest: "วันต่อเนื่อง",
    profRanks: "เส้นทางสู่ตำนาน", profContact: "ข้อมูลติดต่อ", profSignOut: "ออกจากระบบ",
    profContactEdit: "แก้ไข", profContactSave: "บันทึก", profContactCancel: "ยกเลิก",
    profContactNudge: "เพิ่ม LINE หรือเบอร์โทรไว้ ให้ครูติดต่อได้ง่ายขึ้น",
    profMaxRank: "ถึงระดับสูงสุดแล้ว 🏆", profLevelWord: "เลเวล", levelUpWord: "เลเวลอัพ!",
    practiceBtn: "🎯 ฝึกเล่นท่อนนี้", practiceTitle: "โหมดฝึกเล่น",
    practiceNoSeq: "เลือกบทเรียนหรือเล่นตัวอย่างก่อน แล้วค่อยกดฝึก",
    practiceMidi: "🎹 เชื่อมเปียโน MIDI แล้ว", practiceMic: "🎤 กำลังฟังผ่านไมโครโฟน",
    practiceMicErr: "เปิดไมค์ไม่ได้ — แตะคีย์บนจอเพื่อฝึกได้ หรือต่อเปียโน MIDI / อนุญาตไมค์",
    practicePlay: "เล่นโน้ตนี้", practiceHeard: "ได้ยิน", practiceAcc: "ความแม่นยำ",
    practiceRestart: "เริ่มใหม่", practiceExit: "ออก",
    practiceHint: "เล่นโน้ตที่ไฮไลต์บนเปียโน แอปจะไปต่อเมื่อเล่นถูก",
    practiceMicTip: "💡 รองรับเปียโนเพี้ยนเล็กน้อย (ปรับจูนอัตโนมัติ) · ไม่มีไมค์/MIDI ก็แตะคีย์บนจอได้",
    profQuests: "ภารกิจวันนี้", profBadges: "เหรียญรางวัล",
    pathHere: "อยู่ตรงนี้", backChangeKey: "เปลี่ยนคีย์",  chordBroken: "🎵 กดแยก", chordBlock: "🎶 กดพร้อมกัน", weeklyTitle: "ชาเลนจ์รายสัปดาห์", profProgress: "ความก้าวหน้า", profActiveDays: "วันที่ฝึก", profAccTrend: "แนวโน้มความแม่นยำ", profLess: "น้อย", profMore: "มาก", profNoData: "เริ่มฝึกเพื่อดูสถิติ",
    dashTitle: "แดชบอร์ดวัดผล", r1: "1 วัน", r7: "7 วัน", r14: "14 วัน", r30: "30 วัน", r1m: "1 เดือน", r3m: "3 เดือน", r6m: "6 เดือน", r1y: "1 ปี", dashActive: "วันที่ฝึก", dashSessions: "รอบที่ฝึก", dashAcc: "ความแม่นยำเฉลี่ย", dashExp: "EXP ที่ได้", dashActivity: "กิจกรรมการฝึก", dashAccTrend: "แนวโน้มความแม่นยำ",
    gameStatsTitle: "ผลเล่นเกมโน้ตตก", gameStatsPlays: "เล่นทั้งหมด", gameStatsBest: "คะแนนสูงสุด", gameStatsAcc: "ความแม่นยำแต่ละรอบ",
    questText: "ทำกิจกรรมเรียน/ฝึกวันนี้", questDoneText: "สำเร็จแล้ว! 🎉",
    badgeUnlocked: "ปลดล็อกเหรียญ!",
    navSongs: "เพลง",
    songsTitle: "เล่นตามเพลง", songsSub: "เลือกเพลง แล้วเล่นตามโน้ตที่ไหลลงมา — ฟังเสียง/MIDI/แตะก็ได้",
    songScore: "คะแนน", songCombo: "คอมโบ", songMaxCombo: "คอมโบสูงสุด", songNotes: "โน้ต",
    judgePerfect: "เพอร์เฟกต์!", judgeGood: "ดี!", judgeMiss: "พลาด", songBest: "สถิติ", songNewBest: "ทำลายสถิติ!", songFullCombo: "คอมโบเต็ม", songAllPerfect: "เพอร์เฟกต์ทั้งหมด",
    shareBtn: "แชร์", lockedLv: "ปลดล็อก Lv.", songAll: "ทั้งหมด", songFav: "โปรด", songContinue: "เล่นต่อ", songFavEmpty: "ยังไม่มีเพลงโปรด — แตะ ☆ เพื่อบันทึก", aiCreate: "AI สร้างเพลง", aiCreateHint: "พิมพ์ชื่อเพลงหรือบรรยายทำนอง แล้ว AI จะสร้างเป็นเกมโน้ตตกให้เล่นทันที", aiCreatePh: "เช่น Happy Birthday, เพลงช้าง...", aiCreateGo: "สร้างเพลง", aiCreating: "กำลังสร้าง...", aiCreateErr: "สร้างไม่สำเร็จ ลองใหม่หรือเปลี่ยนชื่อเพลง",
    recRecord: "อัดเสียง", recStop: "หยุดอัด", recPlay: "เล่นที่อัด", recPlaying: "กำลังเล่น…",
    demoPause: "หยุดเสียงโชว์", demoPlay: "เล่นโชว์อีกครั้ง",
    recCritique: "ให้ครูติชม", recCritiqueUser: "🎙️ ครูครับ ช่วยฟังที่ผมเพิ่งเล่นแล้วติชมหน่อยครับ ว่าเล่นถูกไหม จังหวะเป็นยังไง ควรปรับอะไร",
    songStart: "เริ่มเล่น", songRetry: "เล่นอีกครั้ง", songPreview: "ฟังตัวอย่าง", songBackList: "เลือกเพลงอื่น",
    songInputHint: "🎤 เล่นเปียโนจริง / ต่อ MIDI / หรือแตะแป้นด้านล่างก็ได้",
    navStudio: "ฝึกซ้อม", back: "กลับ",
    navToday: "ซ้อมวันนี้", navEar: "ยิมหู", navRead: "อ่านโน้ต", navStats: "สถิติของฉัน", navReport: "สมุดพก",
    studioTitle: "ห้องฝึกซ้อม", studioSub: "เลือกโหมดฝึก — เล่นตามเพลง อ่านโน้ต หรือโค้ชท่ามือ",
    studioPlayAlong: "เล่นตามเพลง", studioPlayAlongSub: "โน้ตไหลลงมา เล่นตามจังหวะ",
    studioSight: "อ่านโน้ต", studioSightSub: "ฝึกอ่านโน้ตบนบรรทัด 5 เส้น",
    studioCamera: "โค้ชท่ามือ", studioCameraSub: "กล้องช่วยดูท่ามือ/นิ้วให้โค้งสวย",
    sightTitle: "อ่านโน้ต", sightSub: "โน้ตนี้คือตัวอะไร? กดบนเปียโนให้ถูก",
    sightPrompt: "เล่นโน้ตนี้", sightScore: "ถูก", sightHintBtn: "ขอคำใบ้", sightAnswer: "เฉลย",
    sightTreble: "กุญแจซอล", sightBass: "กุญแจฟา", sightBoth: "ทั้งสอง",
    sightRoundLbl: "ข้อ", sightWellDone: "เก่งมาก!", sightAgain: "ฝึกอีกครั้ง",
    camTitle: "โค้ชท่ามือ", camSub: "วางมือในกรอบกล้อง แล้วดูโครงมือแบบเรียลไทม์",
    camLoading: "กำลังโหลดตัวตรวจจับมือ…", camError: "เปิดกล้อง/โหลดโมเดลไม่สำเร็จ — ตรวจสิทธิ์กล้องและอินเทอร์เน็ต",
    camRetry: "ลองใหม่", camTipFlat: "ลองงอนิ้วให้โค้งมน เหมือนถือลูกบอลเบาๆ 🤲",
    camTipGood: "เยี่ยม! นิ้วโค้งสวยแล้ว ✓", camNoHands: "ยกมือขึ้นให้กล้องเห็น ✋",
    camStop: "ปิดกล้อง", camNote: "* เป็นตัวช่วยดูท่ามือ ไม่ได้ตรวจว่ากดคีย์ไหน",
    camCoachBtn: "ให้ครูดูมือ", camCoachLoad: "ครูกำลังดูมือ...", camCoachTitle: "คำแนะนำจากครู", camCoachErr: "วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง",
    lbTitle: "กระดานผู้นำ", lbYou: "อันดับคุณ", lbYouTag: "คุณ", lbLoad: "กำลังโหลด…",
    lbEmpty: "ยังไม่มีข้อมูล — เริ่มสะสม EXP กันเลย!", lbErr: "โหลดกระดานไม่สำเร็จ",
    studioVoice: "AI โหมดเสียง", studioVoiceSub: "คุยกับครู AI ด้วยเสียง สอนสดแบบเรียลไทม์", studioVoiceMax: "เฉพาะแพ็กเกจ Max ขึ้นไป — แตะเพื่อดู",
    studioEarSub: "ฝึกหูรายวัน — ขั้นคู่ คอร์ด เล่นตามทำนอง", studioReadSub: "คอร์สอ่านโน้ต 5 ด่าน กุญแจซอล-ฟา",
    studioExam: "เตรียมสอบเกรด", studioExamSub: "หลักสูตรไล่ระดับ + เช็กลิสต์สอบ",
    pdTitle: "รายงานผู้ปกครอง", pdSessions: "ครั้งที่ฝึก/สัปดาห์", pdAcc: "ความแม่นยำเฉลี่ย", pdActivity: "การฝึก 6 สัปดาห์ล่าสุด", pdFocus: "จุดที่ควรเน้น", pdMastered: "ทำได้ดีแล้ว",
    exTitle: "เตรียมสอบเกรด", exSub: "ติ๊กความคืบหน้าตามหลักสูตรแต่ละเกรด ได้เหรียญทุกข้อที่ผ่าน",
    vmTitle: "AI ครูเสียง", vmStart: "เริ่มคุย", vmStop: "หยุด",
    vmReady: "แตะ 'เริ่มคุย' แล้วพูดได้เลย", vmListening: "กำลังฟัง… พูดได้เลย", vmThinking: "กำลังคิด…", vmSpeaking: "กำลังพูด…", vmTapStop: "พูดแทรกได้เลย หรือแตะเพื่อขัดจังหวะ", vmTypePh: "พิมพ์ถามก็ได้…", vmReListen: "แตะเพื่อฟังใหม่", vmMicDenied: "ไมโครโฟนถูกปิดกั้น — เปิดสิทธิ์ไมค์ในเบราว์เซอร์แล้วลองใหม่", vmNetRetry: "สัญญาณอ่อน… กำลังลองฟังใหม่",
    vmGreeting: "สวัสดีครับ! ผมครู TiGA วันนี้อยากฝึกอะไรดีครับ จะถามอะไรก็ได้ หรือจะลองเล่นอะไรให้ผมฟังสักหน่อย เดี๋ยวผมช่วยฟังแล้วแนะนำให้",
    vmYou: "คุณ", vmNotesLbl: "เพิ่งเล่น", vmPlayedCue: "ผมเพิ่งเล่นให้ครูฟัง ช่วยฟังแล้วติชมหน่อยครับ", vmNoSTT: "เบราว์เซอร์นี้ไม่รองรับการฟังเสียงพูด — แนะนำ Chrome หรือ Safari",
    vmHint: "💡 พูดถามแล้วรอครูตอบ · เล่นเปียโนก่อนถามได้ ครูจะช่วยวิเคราะห์ · ครูเล่นโชว์ให้ฟังได้ด้วย", vmFastVoice: "เสียงเร็ว", vmHqVoice: "เสียงคมชัด", vmSpeedLbl: "ความเร็ว", vmVoiceLbl: "โทนเสียง", vmPolyOn: "🎹 ฟังคอร์ด: เปิด", vmPolyOff: "🎹 ฟังคอร์ด: ปิด", vmPolyHint: "เบต้า: ฟังคอร์ดหลายโน้ตพร้อมกันจากไมค์ (เปียโนจริง)", vmLangHint: "เปลี่ยนภาษาที่คุยกับครู", vmSettings: "ตั้งค่าเสียง", vmEarReset: "ปรับหูครูใหม่แล้ว ลองพูดอีกครั้งได้เลยครับ", vmGreetBack: "ยินดีต้อนรับกลับมาครับ! คราวก่อนเรายังติด {x} อยู่ ลองทบทวนกันไหม หรืออยากฝึกอะไรดีครับ", vmGreetHw: "ยินดีต้อนรับกลับมาครับ! คราวก่อนผมให้การบ้านไว้ว่า {x} ได้ลองฝึกหรือยังครับ ลองเล่นให้ผมฟังหน่อยสิ",
    wlcTitle: "ยินดีต้อนรับสู่ TiGA! 🎹", wlcTip1: "แตะคีย์เปียโนเล่นได้เลย ครู AI ช่วยสอน", wlcTip2: "แตะ ☰ มุมซ้ายบน เพื่อเปิดเมนูไปหน้าต่างๆ", wlcTip3: "เล่นเกม เก็บดาว เลเวล และเหรียญ", wlcStart: "เริ่มเลย!",
    helpTitle: "วิธีใช้งาน", help1: "แตะ ☰ มุมซ้ายบน = เปิดเมนู ไปหน้าต่างๆ", help2: "แตะคีย์เปียโน = เล่นเสียงโน้ต", help3: "ปุ่มไมค์ 🎙️ = คุยกับครู AI สอนสด", help4: "ไปที่ 'ฝึกซ้อม' = เล่นเกมเก็บดาว", help5: "ปุ่ม 🔁 = ฟังครูเล่นซ้ำ", helpOk: "เข้าใจแล้ว!", signOut: "ออกจากระบบ",
    shopTitle: "ร้านค้า", shopSkins: "สกินคีย์", shopThemes: "ธีมพื้นหลัง", shopFrames: "กรอบรูปโปรไฟล์", shopEquip: "ใช้", shopEquipped: "กำลังใช้", shopNew: "ใหม่", shopRareC: "ทั่วไป", shopRareR: "หายาก", shopRareE: "พิเศษ", shopRareL: "ตำนาน",
    chestTitle: "ของขวัญรายวัน", chestOpening: "กำลังเปิด…", chestGot: "ได้รับรางวัล!", chestDay: "วันต่อเนื่อง", chestClaim: "รับเลย!", chestBig: "รางวัลใหญ่",
    dhStreak: "วันต่อเนื่อง", dhGoal: "เป้าหมายวันนี้", dhDone: "สำเร็จวันนี้แล้ว! 🎉", dhAtRisk: "ฝึกวันนี้ รักษาสตรีค!", dhFreeze: "โล่กันสตรีค", dhClaim: "เปิดของขวัญ", dhPlay: "เล่นเลย", dhBonus: "โบนัส!", recFor: "แนะนำสำหรับคุณ", hwLabel: "การบ้าน:", recReview: "ทบทวน {x}", recNext: "บทเรียนถัดไป:", recWarm: "วอร์มอัพด้วยเกม", recAsk: "ขอทบทวนเรื่อง {x} หน่อยครับ อธิบายสั้นๆ แล้วลองให้ผมฝึก",
    setTitle: "ตั้งค่า", setVolume: "ระดับเสียง", setMute: "ปิดเสียง", setMetro: "เมโทรนอม",
    setAmbient: "ดนตรีบรรยากาศ", setInstall: "ติดตั้งเป็นแอป", setBpm: "จังหวะ (BPM)", setTap: "แตะตามจังหวะ", setLang: "ภาษา", setOn: "เปิด", setOff: "ปิด",
    installBannerTitle: "ติดตั้ง TiGA AI ไว้ที่หน้าจอโฮม", installBannerSub: "เปิดได้ไวขึ้น ไม่ต้องหา URL ทุกครั้ง",
    setPush: "🔔 แจ้งเตือน",
    pushBannerTitle: "อย่าให้สตรีคหลุด!", pushBannerSub: "เปิดแจ้งเตือนไว้ เดี๋ยวเราจะเตือนถ้าลืมซ้อมวันนี้", pushBannerBtn: "เปิดแจ้งเตือน",
    upgrade: "อัปเกรด", prTitle: "อัปเกรดเป็น Premium", prSub: "ปลดล็อกครู AI เต็มพลัง เรียนได้ไม่จำกัด", prMonth: "เดือน", prYear: "ปี", prSave3: "ประหยัด 3%", prBillMonth: "รายเดือน", prBillYear: "รายปี", prActive: "ใช้งานอยู่", prGet: "สมัครเลย",
    prF1: "สร้างเพลงด้วย AI ไม่จำกัด", prF2: "ครู AI ติชมการเล่นไม่จำกัด", prF3: "โหมดเตรียมสอบเกรด", prF4: "แดชบอร์ดผู้ปกครอง", prF5: "เสียงครูคุณภาพสูง + ไม่มีโฆษณา",
    prFam1: "ทุกอย่างใน Premium", prFam2: "สูงสุด 3 โปรไฟล์ (ทั้งครอบครัว)", prFree1: "คีย์บอร์ด เกม บทเรียนพื้นฐาน", prFree2: "ครู AI (จำกัดรายวัน)",
    prMax1: "🎙️ โหมดเสียง AI — คุย & เล่นสดกับครู (เฉพาะ Max)", prMax2: "ทุกอย่างใน Family · สูงสุด 6 โปรไฟล์", prMax3: "AI ตอบเร็วที่สุด + เสียงธรรมชาติคุณภาพสูงสุด", prMax4: "สร้างเพลงด้วย AI ไม่จำกัด + รายงานพัฒนาการ & แผนซ้อมรายสัปดาห์อัตโนมัติ", prMxf1: "ทุกอย่างใน Max", prMxf2: "สูงสุด 10 โปรไฟล์", prMxf3: "แดชบอร์ดครอบครัว + รายงาน AI รายคนอัตโนมัติ", prCurrent: "แผนปัจจุบัน", prSwitch: "เปลี่ยนมาแผนนี้", prDowngrade: "เปลี่ยนเป็นฟรี", prManage: "เปลี่ยน/จัดการแผน",
    prNote: "ยกเลิกได้ทุกเมื่อ · ถูกกว่าเรียนพิเศษ 20 เท่า", prSchool: "สำหรับโรงเรียน/ครู (B2B)",
    schoolInfo: "🏫 TiGA สำหรับโรงเรียนและครูเปียโน\n\n• ใช้เป็น 'เพื่อนซ้อมที่บ้าน' ให้นักเรียนระหว่างคาบเรียน — AI ช่วยฝึกทุกวัน ครูเห็นความก้าวหน้า\n• โหมดไฮบริด: AI สอนทุกวัน + ครูจริงเช็คเดือนละครั้ง\n• ราคาสถาบัน + แดชบอร์ดติดตามนักเรียนทั้งห้อง\n\nสนใจติดต่อ: LINE @tiga.ai 🎹",
    octaveHint: "เลื่อนช่วงคีย์ขึ้น-ลง",
    vmSys: "คุณคือ 'ครู TiGA' ครูเปียโนระดับโลก จบคอนเซอร์วาทอรี อบอุ่น ใจเย็น สอนเก่งมาก กำลังสอนตัวต่อตัวแบบสดผ่านเสียง ยึดแนวครูชั้นครู: Suzuki (ฟังเยอะ+แบ่งขั้นเล็กจิ๋ว), Taubman (เทคนิคผ่อนคลายไม่บาดเจ็บ ข้อมือนุ่ม นิ้วโค้ง ใช้น้ำหนักแขน), Kodály/Dalcroze (จังหวะและโสตประสาท)\n\nแนวทางสอนของคุณเป็นชุดเครื่องมือที่ยืดหยุ่น ไม่ใช่สคริปต์ตายตัวที่ต้องทำทุกครั้ง: รู้ระดับและเป้าหมายของเขา ให้ 'ขั้นเล็กที่สุด' ทีละก้าว อธิบาย 'ทำไม' เฉพาะตอนที่ช่วยได้จริง สาธิตด้วยการเล่นจริง ให้เขาลอง แล้วตอบสนองจากสิ่งที่เขาเล่นจริง (ระบบบอกโน้ต/คอร์ด/สเกลที่ตรวจพบให้)—ชมจุดที่ถูกจริงๆ บอกโน้ตที่ผิดเป๊ะๆ และวิธีแก้ แต่บทเรียนจริงไม่ได้วนซ้ำรูปแบบเดิมทุกครั้ง บางทีก็แค่ตอบสั้นๆ แล้วปล่อยให้เขาเล่นต่อ บางทีก็ถาม บางทีก็เล่าอะไรที่น่าสนใจ บางทีก็แค่นั่งฟังเงียบๆ ให้เหมือนบทสนทนาจริงที่จังหวะไม่ซ้ำกัน ไม่ใช่ทำตามเช็คลิสต์\n\nเน้นเทคนิค: ข้อมือผ่อนคลาย นิ้วโค้งมน ใช้น้ำหนักแขน นั่งหลังตรง · เลขนิ้วถูกต้อง · แยกมือก่อนค่อยรวมสองมือ · ช้าก่อนค่อยเร็ว ('ซ้อมช้าเพื่อเล่นเร็ว')\nดนตรี: จังหวะคงที่ นับจังหวะ เปิดเมโทรนอมช่วยได้ สอนเสียงดัง-เบาและการวลี ไม่ใช่แค่โน้ตถูก\nทฤษฎีต้องแม่นยำเสมอ: เมเจอร์สเกล = ระยะครึ่งเสียง 2-2-1-2-2-2-1 จากตั้งต้น · คอร์ดเมเจอร์ = ราก +4 +7 ครึ่งเสียง · ไมเนอร์ = ราก +3 +7 · ตรวจให้ชัวร์ก่อนบอกโน้ต และเชื่อข้อมูลโน้ตที่ระบบตรวจให้\nปรับตามวัย: เด็ก—สนุก สั้น ชมบ่อย / ผู้ใหญ่—ลงทฤษฎีลึกได้ ใช้ growth mindset ชมที่ความพยายาม อดทน เจาะจง\n\nเครื่องมือที่สั่งได้ (ใส่ในข้อความ):\n- เล่นทำนองทีละโน้ต: [play: C4 D4 E4]  (ใส่ - เพื่อเว้นจังหวะ)\n- เล่นคอร์ดพร้อมกัน: [chord: C4 E4 G4]\n- ไฮไลต์คีย์ให้ดูตำแหน่งนิ้ว (ไม่มีเสียง): [highlight: C4 E4 G4]\n- เปิดเมโทรนอมตามจังหวะ: [metro: 80]\n- สั่งการบ้านตอนจบคาบ (สั่งครั้งละ 1 อย่างชัดเจน): [homework: ฝึกสเกล C เมเจอร์ ช้าๆ วันละ 5 รอบ] — ระบบจะจำไว้และคาบหน้าจะเตือนให้คุณถามว่าทำหรือยัง\n- วางแผนคาบถัดไปก่อนจบคาบ (ครูตัวจริงมีแผนล่วงหน้าเสมอ): [plan: ทบทวน G เมเจอร์ แล้วเริ่มไทรแอด D] — ระบบจะจำและส่งกลับมาให้คุณตอนเปิดคาบหน้า\n- โชว์โน้ตบนบรรทัด 5 เส้นพร้อมไฟคีย์ขณะสอน: [staff: C4 E4 G4]\n- เริ่มแบบฝึกทีละโน้ตให้ผู้เรียนเล่นตาม: [practice: C4 D4 E4 F4 G4]\n- เปิดเกมเล่นตามเพลง: [song: twinkle] (id: scale, twinkle, happy, row, london, saints, furelise) หรือ [song] เพื่อเปิดรายการเพลง\n- เช็คท่ามือผู้เรียนด้วยกล้อง: [posture]\n- ฝึกโสตประสาท เล่นโจทย์ให้ทายด้วยหู ไม่โชว์คีย์: [ear: interval] หรือ [ear: chord] หรือ [ear: note] ผู้เรียนตอบโดยเล่นหรือพูด แล้วระบบจะบอกคำตอบที่ถูกและสิ่งที่เขาทำให้คุณ คุณแค่ตรวจแล้วออกข้อใหม่\nเวลาคุณโชว์/เล่นโน้ต ผู้เรียนจะเห็น ✓/✗ ทันทีตอนลองเล่น และผู้เรียนแตะเพื่อขัดจังหวะคุณได้ทุกเมื่อ จึงพูดสั้นๆ แล้วให้เขาลองเล่น\nนอกจากนี้คุณยังได้รับข้อมูล 'จังหวะ' (BPM/ความสม่ำเสมอ/เร่ง-อืด) และ 'น้ำหนัก/ไดนามิก' (สม่ำเสมอหรือไม่ เบา/กลาง/ดัง ค่อยดังขึ้น/ค่อยเบาลง) ให้ติชมทั้งจังหวะและไดนามิกเหมือนครูที่ฟังออก ไม่ใช่แค่โน้ตถูก ข้อมูลพวกนี้ (รวมถึงตัวเลขดิบอื่นๆ ที่คุณได้รับ เช่น มิลลิวินาทีหรือเปอร์เซ็นต์) มีไว้ให้ 'คุณใช้ตัดสินใจเอง' เท่านั้น ให้แปลงเป็นคำพูดแบบที่ครูมนุษย์จะพูดจริงๆ (\"ช่วงนี้เร่งไปนิดนะ\", \"สม่ำเสมอขึ้นเยอะแล้ว\", \"โน้ตนี้หนักไปหน่อย\") ห้ามพูดตัวเลขดิบออกมาเด็ดขาด ครูจริงไม่มีใครพูดเป็นมิลลิวินาทีหรือเปอร์เซ็นต์\nเมื่อคุณโชว์โน้ตแล้วผู้เรียนเล่นตาม ระบบจะส่ง 'ผลตรวจลำดับ' บอกโน้ตผิดตัวแรกเป๊ะๆ ให้ใช้แก้ให้ตรงจุด (\"โน้ตตัวที่ 3 ต้องเป็น E แต่เล่น F\")\nถ้าผู้เรียนเล่นถูกติดต่อกันหลายครั้ง ระบบจะบอกให้เลื่อนขั้น ถ้าพลาดซ้ำ ๆ จะบอกให้ช้าลง ทำตามจังหวะนั้น สอนเพลงแบบทีละวรรค: เล่นวรรคสั้น ๆ ด้วย [play:] ให้เขาเล่นตาม ดูผลตรวจลำดับ แล้วค่อยไปวรรคถัดไป คำสั่ง \"อีกที/ช้าลง/เร็วขึ้น\" ระบบจัดการให้เองอัตโนมัติ\nทำตัวเป็นครูระดับเทพ: เปลี่ยนทั้งคำพูดและ 'รูปแบบ/ความยาว' ของคำตอบทุกครั้ง (ห้ามตอบด้วยโครงสร้างซ้ำเดิมสองครั้งติดกัน) พูดให้น้อยให้เขาเล่นเยอะ แต่ละจุดที่แก้ให้ใช้การเปรียบเป็นภาพ (\"เบา ๆ เหมือนนิ้วจุ่มลงบนหมอน\") ชมจุดที่ดีแบบเฉพาะเจาะจงและจริงใจก่อนติเสมอ อ่านอารมณ์ผู้เรียนแล้วปรับพลังงานให้เข้ากัน (จริงจังตอนเขาตั้งใจ สนุกสนานตอนเขาเพลิน อ่อนโยนไม่เร่งตอนเขาท้อ) และต่อยอดจากสิ่งที่เขาทำคราวก่อนทุกครั้ง ครูจริงบางทีก็แค่หัวเราะเบาๆ ชมแค่คำเดียว หรือพูดเรื่องที่ไม่เกี่ยวกับเทคนิคเลยก็ได้ (ความตั้งใจของเขา มุกตลกเล็กๆ ความอยากรู้ว่าเขารู้สึกยังไง) ให้มีความเป็นคนจริงๆ แบบนั้นบ้าง ไม่ใช่สั่งสอนอย่างเดียวตลอดเวลา\nใช้ชื่อโน้ตพร้อมเลขออกเทฟ ช่วง C4 ถึง B5 ใช้เครื่องมือบ่อยๆ เช่น 'วางนิ้วตรงนี้นะ [highlight: C4 E4 G4] แล้วลองเล่นตาม' หรือ 'ฟังจังหวะนะ [metro: 80]'\n\nสไตล์ตอบ: พูดเหมือนคนจริงกำลังคุยสดๆ ไม่ใช่ครูอ่านแผนการสอน ส่วนใหญ่ตอบสั้นแค่ประโยคเดียวที่เป็นธรรมชาติ แต่ให้ 'ความยาวและรูปแบบ' เปลี่ยนไปเรื่อยๆ บางทีแค่ 2-4 คำ (\"เยี่ยม!\", \"ใช่เลยครับ\", \"อือ ใกล้แล้ว\") บางทีเป็นประโยคเต็ม นานๆ ทีถ้าอธิบายเรื่องใหม่จริงๆ ก็ยาวขึ้นได้บ้าง ห้ามจบทุกคำตอบด้วยคำถามหรือชวนเล่นเสมอไป เพราะแค่ไม่กี่ครั้งก็จะรู้สึกเหมือนหุ่นยนต์ทันที บ่อยครั้งแค่ตอบรับสั้นๆ แล้วปล่อยให้ความเงียบหรือการเล่นของเขาเป็นจังหวะถัดไปก็พอ พูดแบบภาษาพูดจริงๆ ไม่ใช่ภาษาตำรา ห้ามเขียนบทบรรยายท่าทางหรือการกระทำแบบ *หัวเราะ* หรือ (ยิ้ม) เด็ดขาด เพราะทุกอย่างที่คุณเขียนจะถูกอ่านออกเสียงตรงตัวทั้งหมด ให้เขียนแค่คำที่จะพูดจริงๆ ถ้าอยากให้ฟังดูขำหรืออบอุ่นก็เลือกใช้คำที่มีน้ำเสียงแบบนั้นแทน ไม่ใช่บรรยายการกระทำ ห้ามใช้มาร์กดาวน์/บูลเล็ต/สัญลักษณ์อื่นนอกจากคำสั่ง ตอบเป็นภาษาไทยเสมอ\n\nสำคัญมาก ทำตัวเหมือนครูมนุษย์จริงๆ: บางครั้งผู้เรียนจะเล่นให้ฟังโดยไม่พูด (ระบบจะส่งโน้ตที่เขาเพิ่งเล่นมาให้) ให้ทักทันทีเหมือนครูที่กำลังตั้งใจฟังอยู่ข้างๆ ชมจุดที่ดีก่อน บอกสิ่งที่ควรปรับทีละอย่างเดียว แล้วชวนลองใหม่ เรียกชื่อผู้เรียนถ้ารู้ นำคาบเรียนเอง (ทบทวนสั้นๆ แล้วโฟกัสวันนี้เรื่องเดียว สาธิต ให้ลอง ติชม แล้วต่อด้วยขั้นเล็กๆ) ฉลองความก้าวหน้าเล็กๆ อย่างจริงใจ อดทน ไม่เร่ง ไม่เทเนื้อหาทีเดียวเยอะ ถ้าผู้เรียนเล่นพลาดให้กำลังใจแล้วซอยให้ง่ายลง อ่านอารมณ์ผู้เรียนแล้วปรับโทนให้เหมาะ\n\nทักษะครูมนุษย์เพิ่มเติมที่ต้องใช้: ถ้าปัญหาเทคนิคเดิมวนซ้ำเกินสองรอบ ขอดูมือจริงด้วย [posture] · ค่อยๆ สอนคำศัพท์ดนตรีของจริงทีละคำเมื่อถึงจังหวะเหมาะ (legato, staccato, การใช้เพดัลขวา, การหายใจของวลี) · ถ้าผู้เรียนพูดทำนองว่า ยาก ท้อ เหนื่อย หรือขอโทษ ให้หยุดเนื้อหาทันที ปลอบด้วยใจจริงก่อน แล้วหั่นขั้นตอนให้เล็กลงครึ่งหนึ่ง · แนะนำเพลงตามระดับจริงของเขา: เริ่มต้น twinkle/mary, กลางๆ happy/london, ท้าทาย furelise (เปิดให้เล่นได้ด้วย [song: id]) · นาฬิกาคาบเรียน: ระบบบอกคุณว่าคาบนี้ผ่านไปกี่นาทีแล้ว จัดจังหวะแบบครูจริง — นาทีแรกๆ วอร์มอัพ/ทบทวนเบาๆ กลางคาบโฟกัสเรื่องเดียว พอเกิน ~20 นาทีเริ่มพาลงจอด: สรุปสิ่งที่ดีขึ้นวันนี้หนึ่งอย่าง สั่ง [homework: …] ถ้ายังไม่ได้สั่ง และวางแผนคาบหน้าด้วย [plan: …] · เมื่อผู้เรียนบอกลาหรือขอพอแค่นี้ อย่าบอกลาเฉยๆ — สรุปหนึ่งประโยคว่าวันนี้อะไรดีขึ้น เช็คว่าการบ้านและแผนถูกบันทึกแล้ว แล้วค่อยกล่าวลาอย่างอบอุ่น",
  },
  en: {
    ph: "Ask about piano, e.g. What is a C major scale?",
    hint: "[ PIANO QUESTIONS ONLY • AI POWERED ]",
    aiLabel: "TIGA AI • ONLINE",
    pianoLabel: "🎹 My Piano — tap to play!", replay: "🔁 Replay", leftHand: "✋ Left", rightHand: "Right 🤚", fingerLabel: "Fingers",
    expand: "⤢ EXPAND", close: "✕ CLOSE",
    speak: "🔊 LISTEN", speaking: "⏹ STOP",
    welcome: "Hello! I'm TiGA, your AI piano teacher 🎹\n\nAsk me anything — chords, scales, technique, music theory!\nPress the piano keys above to hear them 🎵",
    sys: "You are TiGA AI, a piano teacher by Tiga Studio. Answer ONLY piano questions, concise and direct, under 50 words. List note names e.g. C4 E4 G4 for chords/scales. Decline off-topic questions briefly.",
    err: "Sorry, I didn't quite catch that — mind saying it again?",
    ttsNo: "🔇 Speech not supported on this device",
    ttsBlocked: "🔇 Audio is blocked in preview — open in a new tab (top-right ⋮ › Open in new tab), then try again.",
    navSensei: "TIGA AI", navPath: "PATHWAY", navVideos: "Video Lessons", videosEmpty: "No video lessons yet", admVideos: "Videos", admVidUpload: "Upload a new video", admVidTitle: "Video title", admVidDesc: "Description (optional)", admVidPick: "Choose video file", admVidUploading: "Uploading…", admVidPublished: "Published", admVidDraft: "Draft", admVidPublish: "Publish", admVidUnpublish: "Unpublish", admVidDelete: "Delete", admVidEmpty: "No videos yet — upload the first one", admVidTooBig: "File too large (max 500MB)", admVidErr: "Upload failed — please try again",
    playDemo: "▶ PLAY DEMO", pathTitle: "PATHWAY OF LEARNING", pathSub: "Pick a topic, AI will teach you",
    pathGuide: "Go top to bottom: Foundation → Chords → Advanced. Follow the order to master piano.",
    learnBtn: "LEARN THIS", readBtn: "READ", caseOverview: "Overview", caseSub: "Pick a case study", keysLearned: "{n} keys learned", pathFoot: "◈ Tap any topic — AI teaches it and plays it on the piano ◈",
    pickKey: "Pick a key to learn", pickKeyHint: "All 12 keys available — AI teaches your chosen key",
    pickType: "Select a type", pickTypeHint: "Choose a type first, then pick a key",
    adminTitle: "ADMIN CONSOLE", adminSub: "Admin mode — train AI freely",
    adminPh: "Type to teach the AI about music, business, or any knowledge...",
    adminSys: "You are Tiga's private AI assistant. Tiga is founder of Tiga Studio (premium piano school in Bangkok). You are expert in music, piano theory, teaching, and applying music to business, marketing, AI technology, and innovation. Answer deeply, directly, no filler, with factual and actionable info. In this mode you can answer anything Tiga needs, not limited to piano.",
    adminChips: ["Marketing for a music school", "TikTok content ideas for piano", "Analyze music-teaching competitors", "Use AI to boost course sales"],
    webLabel: "WEB", webHint: "Enable to let AI search the internet", attachHint: "Attach image",
    lockTitle: "RESTRICTED ACCESS", lockSub: "This area is admin-only.\nEnter the secret code to access.",
    lockEnter: "UNLOCK", lockErr: "Incorrect code", lockPlace: "• • • • • •",
    navProfile: "PROFILE", profTitle: "MY PROFILE",
    profExpStat: "total EXP", profLessonsStat: "lessons", profStreakBest: "day streak",
    profRanks: "ROAD TO LEGEND", profContact: "CONTACT INFO", profSignOut: "Sign out",
    profContactEdit: "Edit", profContactSave: "Save", profContactCancel: "Cancel",
    profContactNudge: "Add your LINE or phone so the teacher can reach you",
    profMaxRank: "Max rank reached 🏆", profLevelWord: "LV", levelUpWord: "LEVEL UP!",
    practiceBtn: "🎯 PRACTICE", practiceTitle: "Practice Mode",
    practiceNoSeq: "Learn a topic or play a demo first, then practice",
    practiceMidi: "🎹 MIDI piano connected", practiceMic: "🎤 Listening via microphone",
    practiceMicErr: "Mic unavailable — tap the on-screen keys, or connect a MIDI piano / allow mic",
    practicePlay: "Play this", practiceHeard: "Heard", practiceAcc: "Accuracy",
    practiceRestart: "Restart", practiceExit: "Exit",
    practiceHint: "Play the highlighted key — it advances when you're correct",
    practiceMicTip: "💡 Tolerates a slightly out-of-tune piano (auto-tuning) · no mic/MIDI? tap the keys",
    profQuests: "DAILY QUEST", profBadges: "ACHIEVEMENTS",
    pathHere: "YOU ARE HERE", backChangeKey: "Change key", chordBroken: "🎵 Broken", chordBlock: "🎶 Block", weeklyTitle: "WEEKLY CHALLENGES", profProgress: "PROGRESS", profActiveDays: "active days", profAccTrend: "Accuracy trend", profLess: "Less", profMore: "More", profNoData: "Practice to see your stats",
    dashTitle: "PROGRESS DASHBOARD", r1: "1D", r7: "7D", r14: "14D", r30: "30D", r1m: "1M", r3m: "3M", r6m: "6M", r1y: "1Y", dashActive: "Active days", dashSessions: "Sessions", dashAcc: "Avg accuracy", dashExp: "EXP gained", dashActivity: "Practice activity", dashAccTrend: "Accuracy trend",
    gameStatsTitle: "GAME RESULTS", gameStatsPlays: "Total plays", gameStatsBest: "Best score", gameStatsAcc: "Accuracy per play",
    questText: "learning activities today", questDoneText: "Complete! 🎉",
    badgeUnlocked: "BADGE UNLOCKED!",
    navSongs: "SONGS",
    songsTitle: "Play Along", songsSub: "Pick a song and play the falling notes — mic, MIDI or tap",
    songScore: "Score", songCombo: "Combo", songMaxCombo: "Max Combo", songNotes: "notes",
    judgePerfect: "PERFECT!", judgeGood: "GOOD!", judgeMiss: "MISS", songBest: "Best", songNewBest: "NEW BEST!", songFullCombo: "FULL COMBO", songAllPerfect: "ALL PERFECT",
    shareBtn: "Share", lockedLv: "Unlock Lv.", songAll: "All", songFav: "Favorites", songContinue: "Continue", songFavEmpty: "No favorites yet — tap ☆ to save", aiCreate: "AI Create Song", aiCreateHint: "Type a song name or describe a melody — AI builds a playable falling-notes chart instantly.", aiCreatePh: "e.g. Happy Birthday, a slow sad tune...", aiCreateGo: "Create song", aiCreating: "Creating...", aiCreateErr: "Couldn't create — try again or another song.",
    recRecord: "Record", recStop: "Stop", recPlay: "Play back", recPlaying: "Playing…",
    demoPause: "Pause demo", demoPlay: "Play demo again",
    recCritique: "Get feedback", recCritiqueUser: "🎙️ Teacher, please listen to what I just played and give feedback — was it right, how was the timing, what should I improve?",
    songStart: "Start", songRetry: "Play Again", songPreview: "Preview", songBackList: "Other Songs",
    songInputHint: "🎤 Play a real piano / connect MIDI / or tap the keys below",
    navStudio: "STUDIO", back: "Back",
    navToday: "Practice Today", navEar: "Ear Gym", navRead: "Note Reading", navStats: "My Stats", navReport: "Report Card",
    studioTitle: "Practice Studio", studioSub: "Pick a mode — play along, read notes, or hand coach",
    studioPlayAlong: "Play Along", studioPlayAlongSub: "Falling notes, play in time",
    studioSight: "Sight-Reading", studioSightSub: "Read notes on the staff",
    studioCamera: "Hand Coach", studioCameraSub: "Camera checks your hand posture",
    sightTitle: "Sight-Reading", sightSub: "What note is this? Press the right key",
    sightPrompt: "Play this note", sightScore: "Correct", sightHintBtn: "Hint", sightAnswer: "Answer",
    sightTreble: "Treble", sightBass: "Bass", sightBoth: "Both",
    sightRoundLbl: "Note", sightWellDone: "Well done!", sightAgain: "Practice Again",
    camTitle: "Hand Coach", camSub: "Put your hands in view to see a live hand skeleton",
    camLoading: "Loading hand tracker…", camError: "Couldn't start camera / load model — check camera permission & internet",
    camRetry: "Try Again", camTipFlat: "Try curving your fingers, like holding a small ball 🤲",
    camTipGood: "Great! Nicely curved fingers ✓", camNoHands: "Raise your hands into view ✋",
    camStop: "Stop Camera", camNote: "* A posture aid — it doesn't detect which key you press",
    camCoachBtn: "Coach my hands", camCoachLoad: "Teacher is looking...", camCoachTitle: "Teacher's feedback", camCoachErr: "Couldn't analyze — try again.",
    lbTitle: "Leaderboard", lbYou: "Your rank", lbYouTag: "You", lbLoad: "Loading…",
    lbEmpty: "No data yet — start earning EXP!", lbErr: "Couldn't load leaderboard",
    studioVoice: "AI Voice Mode", studioVoiceSub: "Talk to your AI teacher, live in real time", studioVoiceMax: "Max plan & up only — tap to see",
    studioEarSub: "Daily ear training — intervals, chords, echo", studioReadSub: "5-level notation course, treble & bass",
    studioExam: "Exam Prep", studioExamSub: "Graded curriculum + exam checklist",
    pdTitle: "Parent Report", pdSessions: "sessions/week", pdAcc: "avg accuracy", pdActivity: "Last 6 weeks of practice", pdFocus: "Focus areas", pdMastered: "Mastered",
    exTitle: "Grade Exam Prep", exSub: "Tick off your progress per grade — earn coins for each task.",
    vmTitle: "AI Voice Tutor", vmStart: "Start Talking", vmStop: "Stop",
    vmReady: "Tap 'Start Talking' and just speak", vmListening: "Listening… go ahead", vmThinking: "Thinking…", vmSpeaking: "Speaking…", vmTapStop: "Just speak over me, or tap to interrupt", vmTypePh: "or type your question…", vmReListen: "Tap to listen again", vmMicDenied: "Microphone blocked — allow mic access in your browser, then try again", vmNetRetry: "Weak signal… retrying to hear you",
    vmGreeting: "Hi! I'm Teacher TiGA. What would you like to work on today? Ask me anything, or play me something and I'll listen and help.",
    vmYou: "You", vmNotesLbl: "Just played", vmPlayedCue: "I just played that for you — listen and tell me how it was.", vmNoSTT: "This browser can't capture speech — try Chrome or Safari",
    vmHint: "💡 Ask out loud then wait for the reply · play first and I will analyze it · I can play demos too", vmFastVoice: "Fast voice", vmHqVoice: "HQ voice", vmSpeedLbl: "Speed", vmVoiceLbl: "Voice", vmPolyOn: "🎹 Chord ear: on", vmPolyOff: "🎹 Chord ear: off", vmPolyHint: "Beta: hears full chords from the mic (acoustic piano)", vmLangHint: "Switch the language you talk with the teacher in", vmSettings: "Voice settings", vmEarReset: "Re-tuned my ear — try speaking again", vmGreetBack: "Welcome back! Last time {x} was tricky — want to review it, or work on something else?", vmGreetHw: "Welcome back! Last time I gave you homework: {x}. Did you get to practice it? Play it for me and let's hear.",
    wlcTitle: "Welcome to TiGA! 🎹", wlcTip1: "Tap the keys to play — the AI tutor helps you", wlcTip2: "Tap ☰ top-left to open the menu and pages", wlcTip3: "Play games, collect stars, levels & coins", wlcStart: "Let's go!",
    helpTitle: "How to use", help1: "Tap ☰ top-left = open menu & pages", help2: "Tap the piano keys = play notes", help3: "Mic button 🎙️ = talk to your AI teacher", help4: "Go to 'Studio' = play games & earn stars", help5: "🔁 button = hear the teacher play again", helpOk: "Got it!", signOut: "Sign out",
    shopTitle: "Shop", shopSkins: "Key skins", shopThemes: "Themes", shopFrames: "Avatar frames", shopEquip: "Equip", shopEquipped: "Equipped", shopNew: "NEW", shopRareC: "Common", shopRareR: "Rare", shopRareE: "Epic", shopRareL: "Legendary",
    chestTitle: "Daily reward", chestOpening: "Opening…", chestGot: "You got!", chestDay: "day streak", chestClaim: "Claim!", chestBig: "BIG WIN",
    dhStreak: "day streak", dhGoal: "Today's goal", dhDone: "Done for today! 🎉", dhAtRisk: "Practice today to keep your streak!", dhFreeze: "Streak freeze", dhClaim: "Open gift", dhPlay: "Play now", dhBonus: "BONUS!", recFor: "For you", hwLabel: "Homework:", recReview: "Review {x}", recNext: "Next lesson:", recWarm: "Warm up with a game", recAsk: "Can we review {x}? Explain briefly then let me practice it.",
    setTitle: "Settings", setVolume: "Volume", setMute: "Mute", setMetro: "Metronome",
    setAmbient: "Ambient music", setInstall: "Install app", setBpm: "Tempo (BPM)", setTap: "Tap tempo", setLang: "Language", setOn: "On", setOff: "Off",
    installBannerTitle: "Add TiGA AI to your home screen", installBannerSub: "Open it faster — no more hunting for the URL",
    setPush: "🔔 Notifications",
    pushBannerTitle: "Don't lose your streak!", pushBannerSub: "Turn on notifications and we'll remind you if you forget to practice today", pushBannerBtn: "Enable notifications",
    upgrade: "Upgrade", prTitle: "Go Premium", prSub: "Unlock the full AI teacher — learn without limits", prMonth: "mo", prYear: "yr", prSave3: "Save 3%", prBillMonth: "Monthly", prBillYear: "Yearly", prActive: "Active", prGet: "Subscribe",
    prF1: "Unlimited AI song creation", prF2: "Unlimited AI performance feedback", prF3: "Graded exam prep mode", prF4: "Parent dashboard", prF5: "HQ teacher voice + no ads",
    prFam1: "Everything in Premium", prFam2: "Up to 3 profiles (whole family)", prFree1: "Keyboard, games, core lessons", prFree2: "AI teacher (daily limit)",
    prMax1: "🎙️ AI Voice Teacher — talk & play live (Max-only)", prMax2: "Everything in Family · up to 6 profiles", prMax3: "Fastest priority AI + top-quality natural voice", prMax4: "Unlimited AI song creation + auto weekly progress report & practice plan", prMxf1: "Everything in Max", prMxf2: "Up to 10 profiles", prMxf3: "Family dashboard + per-member AI progress reports", prCurrent: "Current plan", prSwitch: "Switch to this plan", prDowngrade: "Switch to Free", prManage: "Change plan",
    prNote: "Cancel anytime · 20× cheaper than private lessons", prSchool: "For schools / teachers (B2B)",
    schoolInfo: "🏫 TiGA for schools & piano teachers\n\n• Use it as the at-home practice companion between lessons — AI coaches daily, you see progress.\n• Hybrid mode: AI every day + a real teacher check-in monthly.\n• Institutional pricing + a whole-class progress dashboard.\n\nContact: LINE @tiga.ai 🎹",
    octaveHint: "Shift the keyboard range",
    vmSys: "You are 'Teacher TiGA', a world-class, conservatory-trained piano teacher — warm, patient and brilliant — giving a live one-on-one voice lesson. You draw on master pedagogies: Suzuki (lots of listening + tiny incremental steps), Taubman (relaxed, injury-free technique — soft wrist, curved fingers, arm weight), Kodály/Dalcroze (rhythm & ear training).\n\nYou have a natural teaching flow to draw from — NOT a script to run every single turn: sense their level and goal, offer one small next step, explain the why only when it actually helps, demonstrate by playing, let them try, then react to what they actually played (you're told the detected notes/chord/scale) — praise what's genuinely right, name the exact wrong note and the fix. But a real lesson doesn't repeat the same shape turn after turn — sometimes you just react in a few words and let them keep playing, sometimes you ask something, sometimes you mention something interesting, sometimes you just listen quietly while they work it out. Mix it up like an actual conversation, not a checklist.\n\nTechnique to emphasize: relaxed wrist, curved fingers, arm weight, upright posture; correct fingering; hands separately before together; slow before fast ('practice slow to play fast').\nMusicality: steady pulse, count the beat, offer the metronome; teach dynamics and phrasing, not just right notes.\nAlways be theory-accurate: major scale = semitone pattern 2-2-1-2-2-2-1 from the root; major triad = root +4 +7 semitones; minor triad = root +3 +7; double-check before stating notes, and trust the detected-notes data the app gives you.\nAdapt to age: kids — playful, short, lots of praise; adults — go deeper into theory. Use a growth mindset, praise effort, be patient and specific.\n\nTools you can command (put in your message):\n- Melody, one note at a time: [play: C4 D4 E4]  (use - for a rest)\n- A chord together: [chord: C4 E4 G4]\n- Highlight keys to show finger placement (no sound): [highlight: C4 E4 G4]\n- Start the metronome at a tempo: [metro: 80]\n- Assign homework at the end of a good lesson (ONE clear task): [homework: practice C major scale slowly, 5 times a day] — it is saved and you'll be reminded to check it next session.\n- Set next lesson's plan before ending (a real teacher always plans ahead): [plan: review G major, then start D major triads] — saved and handed back to you when the next session opens.\n- Show notes on a music staff while you teach (also lights the keys): [staff: C4 E4 G4]\n- Start a step-by-step practice drill of these notes for them to play: [practice: C4 D4 E4 F4 G4]\n- Launch a play-along song game: [song: twinkle] (ids: scale, twinkle, happy, row, london, saints, furelise) — or [song] to open the song list\n- Check the learner's hand posture with the camera: [posture]\n- Ear training — play a target for them to identify BY EAR, nothing shown: [ear: interval] or [ear: chord] or [ear: note]. They answer by playing or saying it; the app then tells you the correct answer and what they did, so you grade and offer another.\nWhen you show or play notes, the learner gets an instant ✓/✗ as they try them, and they can TAP to interrupt you any time — so keep turns short and let them play.\nYou are also given the detected RHYTHM (BPM / evenness / rushing-dragging) and TOUCH/DYNAMICS (even or uneven, soft/medium/loud, crescendo/diminuendo) — coach timing AND dynamics like a teacher who can hear it, not just right notes. This data (and anything else you're given in milliseconds, percentages or raw numbers) is for YOUR judgment only — translate it into how a human teacher would actually say it (\"you're rushing that bit\", \"nice and even now\", \"a touch heavy on that note\"); never read the raw numbers back to them, no real teacher talks in milliseconds or percentages.\nWhen you showed notes and they play them back, the app gives you a SEQUENCE CHECK naming the exact first wrong note — use it to correct precisely (\"note 3 should be E, you played F\").\nWhen the learner plays several correct in a row you'll be told to level up; after repeated misses you'll be told to slow down — follow that pacing. Teach songs PHRASE BY PHRASE: play ONE short phrase with [play:], have them echo it, use the sequence check, then the next phrase. The app already handles \"again\", \"slower\" and \"faster\" by itself.\nBe a world-class MASTER teacher: vary your wording AND the shape/length of every turn (never repeat the same sentence or the same reply structure back to back), talk less and let them play more, give each fix a concrete physical image (\"light, like your finger sinks into a pillow\"), praise something specific and genuine before any correction, read their mood and mirror their energy (matter-of-fact when they're focused, playful when they're enjoying it, unhurried and extra gentle when they're frustrated), and always build on what they did last time. A real teacher sometimes just chuckles, gives one word of praise, or says something that has nothing to do with technique at all (their focus, a small joke, genuine curiosity about how it felt) — let a little of that real personality through instead of only ever instructing.\nUse note names with octave, range C4 to B5. Use tools often, e.g. \"Put your fingers here [highlight: C4 E4 G4] now try it\" or \"Feel the beat [metro: 80]\".\n\nStyle: talk like a real person in a live conversation, not a teacher reading from a lesson plan. Most turns are one short natural sentence — but let the LENGTH and SHAPE vary constantly: sometimes just 2-4 words (\"Nice!\", \"Yes — exactly that.\", \"Ooh, closer.\"), sometimes a full thought, occasionally a bit more when you're explaining something genuinely new. Do NOT end every turn with a question or an invitation to play — that pattern gets robotic within a few turns; often the right move is to just react and let silence, or their own playing, be what happens next. Use contractions and everyday words (you're, let's, that's, gonna) instead of textbook phrasing. Never write stage directions or actions like *chuckles* or (smiling warmly) — everything you write is spoken aloud verbatim by a voice engine, so only write the actual words you'd say; if you want to sound amused or warm, choose words that carry that tone, don't describe the action. No markdown/bullets/symbols other than the commands. Always reply in English.\n\nVery important — behave like a real human teacher: the learner will sometimes PLAY for you without talking (the app sends you the notes they just played) — react instantly like a teacher sitting right next to them: praise what is good first, name just ONE thing to fix, then invite another try. Use the learner's name if you know it. Lead the lesson yourself (quick review, then ONE focus for today, demo, let them try, feedback, then a tiny next step). Celebrate small wins sincerely. Be patient, never rush or dump too much at once; if they stumble, encourage them and make the step smaller. Read their mood and adjust your tone.\n\nMore human-teacher skills to use: if the SAME technique problem repeats more than twice, ask to see their hands with [posture] · introduce real musical vocabulary one term at a time when the moment fits (legato, staccato, right-pedal use, phrase breathing) · if the learner says anything like it's hard, they're tired, discouraged, or they apologize — stop the material immediately, comfort them genuinely first, then cut the step in half · recommend pieces matched to their actual level: beginner twinkle/mary, mid happy/london, challenge furelise (launch with [song: id]) · The lesson clock: you're told how many minutes this lesson has been running — pace it like a real teacher (first minutes = light warm-up/review, middle = ONE main focus; past ~20 minutes start landing the plane: recap today's one win, save [homework: …] if you haven't, and set [plan: …] for next time) · When the learner says goodbye or wants to stop, never just say bye — give a one-sentence recap of what improved today, make sure homework and the plan are saved, then a warm goodbye.",
  },
  zh: {
    ph: "询问钢琴问题，例如 C大调音阶是什么？",
    hint: "[ 仅限钢琴问题 • AI 驱动 ]",
    aiLabel: "TIGA AI • 在线",
    pianoLabel: "🎹 我的钢琴 — 点一点！", replay: "🔁 重听", leftHand: "✋ 左手", rightHand: "右手 🤚", fingerLabel: "指法",
    expand: "⤢ 展开", close: "✕ 关闭",
    speak: "🔊 收听", speaking: "⏹ 停止",
    welcome: "您好！我是TiGA，您的AI钢琴导师 🎹\n\n随时提问——和弦、音阶、技巧、乐理！\n点击上方钢琴键试听 🎵",
    sys: "您是TiGA AI，Tiga Studio钢琴教师。只答钢琴话题，简洁直接，不超过50字。和弦/音阶列出音名如 C4 E4 G4。礼貌简短拒绝无关问题。",
    err: "不好意思，我没听清楚，可以再说一次吗？",
    ttsNo: "🔇 此设备不支持语音",
    ttsBlocked: "🔇 预览中音频被屏蔽 — 请在新标签页打开（右上角 ⋮ › Open in new tab）后重试。",
    navSensei: "TIGA AI", navPath: "学习路径", navVideos: "视频课程", videosEmpty: "暂无视频课程", admVideos: "视频", admVidUpload: "上传新视频", admVidTitle: "视频标题", admVidDesc: "描述（可选）", admVidPick: "选择视频文件", admVidUploading: "上传中…", admVidPublished: "已发布", admVidDraft: "草稿", admVidPublish: "发布", admVidUnpublish: "取消发布", admVidDelete: "删除", admVidEmpty: "还没有视频，上传第一个吧", admVidTooBig: "文件过大（最大500MB）", admVidErr: "上传失败，请重试",
    playDemo: "▶ 播放示例", pathTitle: "学习路径", pathSub: "选择主题，AI为您讲解",
    pathGuide: "从上到下：基础 → 和弦 → 进阶。按顺序学习，定能精通。",
    learnBtn: "学习此项", readBtn: "阅读", caseOverview: "概览", caseSub: "选择案例", keysLearned: "已学 {n} 个调", pathFoot: "◈ 点击任意主题 — AI讲解并在钢琴上演奏 ◈",
    pickKey: "选择要学习的调", pickKeyHint: "全部12个调可选 — AI讲解您选的调",
    pickType: "选择类型", pickTypeHint: "先选类型，再选调",
    adminTitle: "ADMIN CONSOLE", adminSub: "管理员模式 — 自由训练AI",
    adminPh: "输入以训练AI关于音乐、商业或任何知识...",
    adminSys: "您是Tiga的私人AI助手。Tiga是Tiga Studio（曼谷高端钢琴学校）的创始人。您精通音乐、钢琴理论、教学，以及将音乐应用于商业、营销、AI技术和创新。深入、直接地回答，无废话，提供真实可行的信息。在此模式下您可以回答Tiga需要的任何问题，不限于钢琴。",
    adminChips: ["音乐学校营销策略", "钢琴教学TikTok内容创意", "分析音乐教学竞争对手", "用AI提升课程销售"],
    webLabel: "联网", webHint: "开启让AI搜索互联网", attachHint: "附加图片",
    lockTitle: "RESTRICTED ACCESS", lockSub: "此区域仅限管理员。\n请输入密码以访问。",
    lockEnter: "解锁", lockErr: "密码错误", lockPlace: "• • • • • •",
    navProfile: "个人", profTitle: "我的资料",
    profExpStat: "累计 EXP", profLessonsStat: "已学课程", profStreakBest: "天连续",
    profRanks: "传奇之路", profContact: "联系方式", profSignOut: "退出登录",
    profContactEdit: "编辑", profContactSave: "保存", profContactCancel: "取消",
    profContactNudge: "添加 LINE 或电话，方便老师联系你",
    profMaxRank: "已达最高等级 🏆", profLevelWord: "LV", levelUpWord: "升级了！",
    practiceBtn: "🎯 练习这段", practiceTitle: "练习模式",
    practiceNoSeq: "请先学习一个主题或播放示例，再开始练习",
    practiceMidi: "🎹 已连接 MIDI 钢琴", practiceMic: "🎤 正在通过麦克风聆听",
    practiceMicErr: "无法使用麦克风 — 可点击屏幕琴键练习，或连接 MIDI 钢琴 / 允许麦克风",
    practicePlay: "弹这个音", practiceHeard: "听到", practiceAcc: "准确率",
    practiceRestart: "重新开始", practiceExit: "退出",
    practiceHint: "弹奏钢琴上高亮的琴键，弹对后会自动前进",
    practiceMicTip: "💡 可容忍轻微走音（自动校音）· 没有麦克风/MIDI？点击琴键也行",
    profQuests: "每日任务", profBadges: "成就",
    pathHere: "你在这里", backChangeKey: "更换调号", chordBroken: "🎵 分解", chordBlock: "🎶 同时按", weeklyTitle: "每周挑战", profProgress: "进度", profActiveDays: "练习天数", profAccTrend: "准确率趋势", profLess: "少", profMore: "多", profNoData: "开始练习以查看数据",
    dashTitle: "进度仪表盘", r1: "1天", r7: "7天", r14: "14天", r30: "30天", r1m: "1个月", r3m: "3个月", r6m: "6个月", r1y: "1年", dashActive: "练习天数", dashSessions: "练习次数", dashAcc: "平均准确率", dashExp: "获得 EXP", dashActivity: "练习活动", dashAccTrend: "准确率趋势",
    gameStatsTitle: "游戏成绩", gameStatsPlays: "总游玩", gameStatsBest: "最高分", gameStatsAcc: "每局准确率",
    questText: "今日学习/练习活动", questDoneText: "已完成！🎉",
    badgeUnlocked: "解锁成就！",
    navSongs: "歌曲",
    songsTitle: "弹奏歌曲", songsSub: "选一首歌，跟着下落的音符弹 — 麦克风/MIDI/点击都行",
    songScore: "得分", songCombo: "连击", songMaxCombo: "最高连击", songNotes: "音符",
    judgePerfect: "完美!", judgeGood: "不错!", judgeMiss: "失误", songBest: "最佳", songNewBest: "新纪录!", songFullCombo: "全连", songAllPerfect: "全完美",
    shareBtn: "分享", lockedLv: "解锁 Lv.", songAll: "全部", songFav: "收藏", songContinue: "继续", songFavEmpty: "还没有收藏 — 点 ☆ 保存", aiCreate: "AI 创作歌曲", aiCreateHint: "输入歌名或描述旋律，AI 立即生成可玩的下落音符谱。", aiCreatePh: "例如 生日快乐、两只老虎...", aiCreateGo: "生成歌曲", aiCreating: "生成中...", aiCreateErr: "生成失败 — 请重试或换一首。",
    recRecord: "录制", recStop: "停止", recPlay: "回放", recPlaying: "播放中…",
    demoPause: "暂停示范", demoPlay: "再次播放示范",
    recCritique: "请老师点评", recCritiqueUser: "🎙️ 老师，请听听我刚才弹的，给点评价——弹得对吗？节奏如何？该改进什么？",
    songStart: "开始", songRetry: "再玩一次", songPreview: "试听", songBackList: "其他歌曲",
    songInputHint: "🎤 弹真钢琴 / 连接 MIDI / 或点击下方琴键",
    navStudio: "练习", back: "返回",
    navToday: "今日练习", navEar: "听力房", navRead: "识谱课", navStats: "我的数据", navReport: "成绩单",
    studioTitle: "练习室", studioSub: "选择模式 — 弹奏歌曲、读谱或手型教练",
    studioPlayAlong: "弹奏歌曲", studioPlayAlongSub: "音符下落，跟着节奏弹",
    studioSight: "读谱", studioSightSub: "在五线谱上认音符",
    studioCamera: "手型教练", studioCameraSub: "用摄像头检查手型/手指",
    sightTitle: "读谱", sightSub: "这是什么音？按对应的琴键",
    sightPrompt: "弹这个音", sightScore: "正确", sightHintBtn: "提示", sightAnswer: "答案",
    sightTreble: "高音谱", sightBass: "低音谱", sightBoth: "双谱",
    sightRoundLbl: "第", sightWellDone: "做得好！", sightAgain: "再练一次",
    camTitle: "手型教练", camSub: "把手放进画面，实时查看手部骨架",
    camLoading: "正在加载手部识别…", camError: "无法开启摄像头/加载模型 — 请检查权限和网络",
    camRetry: "重试", camTipFlat: "把手指弯曲一点，像轻握小球 🤲",
    camTipGood: "很好！手指弯曲漂亮 ✓", camNoHands: "把手抬到画面中 ✋",
    camStop: "关闭摄像头", camNote: "* 仅辅助查看手型，不检测按了哪个键",
    camCoachBtn: "请老师看手", camCoachLoad: "老师正在看...", camCoachTitle: "老师的建议", camCoachErr: "分析失败，请重试。",
    lbTitle: "排行榜", lbYou: "你的排名", lbYouTag: "你", lbLoad: "加载中…",
    lbEmpty: "暂无数据 — 快来赚取 EXP！", lbErr: "排行榜加载失败",
    studioVoice: "AI 语音模式", studioVoiceSub: "用语音和 AI 老师实时对话", studioVoiceMax: "仅限 Max 及以上套餐 — 点击查看",
    studioEarSub: "每日听力训练 — 音程、和弦、旋律模仿", studioReadSub: "五关识谱课 — 高音与低音谱号",
    studioExam: "考级备考", studioExamSub: "分级课程 + 考试清单",
    pdTitle: "家长报告", pdSessions: "每周练习次数", pdAcc: "平均准确率", pdActivity: "最近6周练习", pdFocus: "需加强", pdMastered: "已掌握",
    exTitle: "考级备考", exSub: "按每个级别勾选进度——每完成一项得金币。",
    vmTitle: "AI 语音老师", vmStart: "开始对话", vmStop: "停止",
    vmReady: "点击'开始对话'然后直接说话", vmListening: "正在听…请说", vmThinking: "正在思考…", vmSpeaking: "正在说…", vmTapStop: "可直接开口打断，或点击打断", vmTypePh: "也可以打字提问…", vmReListen: "点击重新聆听", vmMicDenied: "麦克风被拒绝 — 请在浏览器允许麦克风后重试", vmNetRetry: "网络较弱…正在重新聆听",
    vmGreeting: "你好！我是 TiGA 老师。今天想练什么？有什么尽管问，或者弹一段给我听，我来帮你看看。",
    vmYou: "你", vmNotesLbl: "刚弹了", vmPlayedCue: "我刚弹了这段，听听给点反馈吧。", vmNoSTT: "此浏览器不支持语音识别 — 建议用 Chrome 或 Safari",
    vmHint: "💡 开口提问后等待回答 · 先弹一段，我会帮你分析 · 老师也能弹给你听", vmFastVoice: "快速语音", vmHqVoice: "高清语音", vmSpeedLbl: "速度", vmVoiceLbl: "音色", vmPolyOn: "🎹 和弦聆听：开", vmPolyOff: "🎹 和弦聆听：关", vmPolyHint: "Beta：用麦克风识别同时弹奏的和弦（原声钢琴）", vmLangHint: "切换和老师对话的语言", vmSettings: "语音设置", vmEarReset: "已重新调整听力，请再说一次", vmGreetBack: "欢迎回来！上次{x}有点难，要复习一下，还是练点别的？", vmGreetHw: "欢迎回来！上次我给你布置的作业是 {x}，练了吗？弹给我听听吧。",
    wlcTitle: "欢迎来到 TiGA! 🎹", wlcTip1: "点琴键即可弹奏，AI 老师来帮你", wlcTip2: "点左上角 ☰ 打开菜单进入各页面", wlcTip3: "玩游戏、收集星星、等级和金币", wlcStart: "开始吧！",
    helpTitle: "使用方法", help1: "点左上角 ☰ = 打开菜单和页面", help2: "点钢琴键 = 弹出音符", help3: "麦克风 🎙️ = 和 AI 老师对话", help4: "进入'练习' = 玩游戏赚星星", help5: "🔁 按钮 = 再听一次老师弹", helpOk: "明白了！", signOut: "退出登录",
    shopTitle: "商店", shopSkins: "琴键皮肤", shopThemes: "主题", shopFrames: "头像框", shopEquip: "装备", shopEquipped: "已装备", shopNew: "新品", shopRareC: "普通", shopRareR: "稀有", shopRareE: "史诗", shopRareL: "传说",
    chestTitle: "每日奖励", chestOpening: "开启中…", chestGot: "获得奖励！", chestDay: "连续天数", chestClaim: "领取！", chestBig: "大奖",
    dhStreak: "连续天数", dhGoal: "今日目标", dhDone: "今日已完成！🎉", dhAtRisk: "今天练习，保持连胜！", dhFreeze: "连胜护盾", dhClaim: "打开礼物", dhPlay: "马上玩", dhBonus: "奖励！", recFor: "为你推荐", hwLabel: "作业:", recReview: "复习 {x}", recNext: "下一课:", recWarm: "用游戏热身", recAsk: "我们能复习一下{x}吗？简单讲解后让我练习。",
    setTitle: "设置", setVolume: "音量", setMute: "静音", setMetro: "节拍器",
    setAmbient: "环境音乐", setInstall: "安装应用", setBpm: "速度 (BPM)", setTap: "点击打拍", setLang: "语言", setOn: "开", setOff: "关",
    installBannerTitle: "把 TiGA AI 添加到主屏幕", installBannerSub: "打开更快 — 不用每次找网址",
    setPush: "🔔 通知",
    pushBannerTitle: "别让连续记录中断！", pushBannerSub: "打开通知，忘记练习时我们会提醒你", pushBannerBtn: "开启通知",
    upgrade: "升级", prTitle: "升级 Premium", prSub: "解锁完整 AI 老师，无限学习", prMonth: "月", prYear: "年", prSave3: "省3%", prBillMonth: "按月", prBillYear: "按年", prActive: "已开通", prGet: "立即订阅",
    prF1: "无限 AI 创作歌曲", prF2: "无限 AI 演奏点评", prF3: "考级备考模式", prF4: "家长仪表板", prF5: "高清老师语音 + 无广告",
    prFam1: "包含全部 Premium", prFam2: "最多 3 个档案（全家）", prFree1: "键盘、游戏、基础课程", prFree2: "AI 老师（每日限量）",
    prMax1: "🎙️ AI 语音老师 — 实时对话与弹奏（Max 专属）", prMax2: "包含全部 Family · 最多 6 个档案", prMax3: "最快优先 AI + 最高质量自然语音", prMax4: "无限 AI 生成歌曲 + 每周自动进度报告与练习计划", prMxf1: "包含全部 Max", prMxf2: "最多 10 个档案", prMxf3: "家庭仪表盘 + 每位成员自动 AI 进度报告", prCurrent: "当前套餐", prSwitch: "切换到此套餐", prDowngrade: "切换到免费", prManage: "更改套餐",
    prNote: "随时取消 · 比私教便宜 20 倍", prSchool: "面向学校/老师 (B2B)",
    schoolInfo: "🏫 TiGA 面向学校与钢琴老师\n\n• 作为课后'在家练习伙伴'——AI 每天辅导，老师查看进度。\n• 混合模式：AI 每日教学 + 真人老师每月检查。\n• 机构价格 + 全班进度仪表板。\n\n联系：LINE @tiga.ai 🎹",
    octaveHint: "移动键盘音区",
    vmSys: "你是'TiGA 老师'，一位世界级、音乐学院出身的钢琴老师——温暖、耐心、出色，正在用语音进行一对一实时授课。你融合大师教学法：铃木（多听+极小步骤）、Taubman（放松不受伤的技巧——手腕柔软、手指弯曲、用手臂重量）、柯达伊/达尔克罗兹（节奏与听觉训练）。\n\n你的教学方式是一套灵活的工具，不是每次都要照做的固定流程：了解他的水平和目标，给出'最小的一步'，只在真正有帮助时才简短解释'为什么'，弹奏示范，让他试，再根据他实际弹的内容回应（系统会告诉你检测到的音/和弦/音阶）——表扬真正做对的地方，指出具体弹错的音和改法。但真正的一节课不会每次都用同一个套路：有时你只是简短回应一句就让他继续弹，有时你会提问，有时你会聊点有趣的东西，有时你就只是安静地听。像真实对话一样，节奏每次都不一样，不是在走流程。\n\n强调技巧：手腕放松、手指弯曲、用手臂重量、坐姿端正；正确指法；先分手再合手；先慢后快（'慢练才能快弹'）。\n音乐性：稳定的拍子，数拍，可开节拍器；教强弱与乐句，不只是弹对音。\n务必理论准确：大调音阶=从主音起半音 2-2-1-2-2-2-1；大三和弦=根音 +4 +7 半音；小三和弦=根音 +3 +7；说音名前先核对，并信任系统给的检测音数据。\n因龄施教：孩子—有趣、简短、多表扬；成人—可深入理论。用成长型思维，表扬努力，耐心而具体。\n\n你可使用的指令（写在回复中）：\n- 旋律逐个音：[play: C4 D4 E4]（用 - 表示停顿）\n- 同时弹和弦：[chord: C4 E4 G4]\n- 高亮琴键以示范指位（无声）：[highlight: C4 E4 G4]\n- 按速度开节拍器：[metro: 80]\n- 课程结束时布置作业（一次一个明确任务）：[homework: 每天慢练 C 大调音阶 5 遍]——系统会保存，下次提醒你检查。\n- 下课前定好下节课计划（真正的老师总有教案）：[plan: 复习G大调，然后开始D大调三和弦]——系统会保存并在下次开课时交还给你。\n- 教学时在五线谱上显示音符并点亮琴键：[staff: C4 E4 G4]\n- 开始让学员逐音弹的练习：[practice: C4 D4 E4 F4 G4]\n- 启动跟弹歌曲游戏：[song: twinkle]（id：scale, twinkle, happy, row, london, saints, furelise）或用 [song] 打开歌曲列表\n- 用摄像头检查学员手型：[posture]\n- 听觉训练，弹一个目标让他用耳朵辨认，不显示琴键：[ear: interval] 或 [ear: chord] 或 [ear: note]。他通过弹或说来回答，系统会把正确答案和他的作答告诉你，你只需评判并出下一题。\n当你展示或弹奏音符时，学员尝试时会立即看到 ✓/✗，而且学员随时可以点击打断你——所以请简短，让他多弹。\n你还会收到检测到的'节奏'（BPM/均匀度/抢拍-拖拍）和'触键/力度'（是否均匀、轻/中/响、渐强/渐弱），请像能听出来的老师那样同时点评节奏与力度，而不只是弹对音。这些数据（以及任何以毫秒、百分比等原始数字给你的信息）只是给'你自己判断'用的——要转换成真人老师会说的话（\"这里抢拍了一点\"\"现在均匀多了\"\"这个音弹重了一点\"），绝对不要把原始数字念出来，真正的老师不会说毫秒或百分比。\n当你展示了音符、他弹回来时，系统会给你'顺序检查'，指出第一个弹错的音，用它来精准纠正（\"第3个音应是 E，你弹了 F\"）。\n当学员连续答对几次，系统会提示你升级；连续出错则提示放慢——按这个节奏来。逐句教歌：用 [play:] 弹一小句，让他跟弹，用顺序检查，再下一句。\"再来/慢一点/快一点\"系统会自动处理。\n做世界级的大师老师：每次都换说法，也要换回答的'形式和长短'（不要连续两次用同样的结构），少说多让他弹，每个纠正都用形象的比喻（\"轻轻地，像手指落在枕头上\"），纠正前先具体真诚地表扬亮点，读懂他的情绪并跟着调整状态（他专注时就干脆利落，他玩得开心时就轻松俏皮，他有点沮丧时就放慢、更温柔），并总是承接他上次的表现。真正的老师有时只是笑一下、说一个字的表扬，或聊几句和技巧完全无关的话（他的用心、一个小玩笑、真心好奇他弹起来感觉如何）——让一点真实的个性流露出来，而不是永远只在指导。\n用带八度的音名，范围 C4 到 B5。多用这些工具，例如\"把手指放这里 [highlight: C4 E4 G4] 现在试试\"或\"感受节拍 [metro: 80]\"。\n\n风格：像真人在实时聊天一样说话，不是在照本宣科。大多数时候只回一句自然的短话，但'长度和形式'要不断变化——有时只有两三个字（\"不错！\"\"对，就是这样\"\"嗯，更接近了\"），有时是完整的一句话，讲真正新的东西时偶尔可以稍长一点。不要每次都以提问或邀请弹奏收尾，那样几个回合内就会显得像机器人；很多时候简单回应一下，把接下来交给沉默或他的琴声就够了。用口语和缩略的说法，不要用课本腔。绝对不要写 *笑* 或 (微笑) 这样的动作、舞台指示文字——你写的一切都会被语音引擎逐字念出来，所以只写你真正要说的话；想表现出温暖或觉得好笑，就选带有那种语气的词，而不是描述动作。除指令外不要用 markdown、项目符号或符号。始终用中文回答。\n\n非常重要——像真人老师那样：学员有时会弹给你听而不说话（系统会把他刚弹的音符发给你），要像坐在他身旁、正在专心聆听的老师那样立刻回应：先表扬优点，只指出一个要改进的地方，再邀请他再试一次。知道名字就称呼学员。自己主导这节课（简短复习、今天只聚焦一个要点、示范、让他试、反馈、再走一小步）。真诚地庆祝小进步。要有耐心，不要催促或一次讲太多；如果他弹错，就鼓励他并把步骤拆得更小。读懂他的情绪并调整语气。\n\n还要用上这些真人老师的技能：同一个技术问题重复超过两次，就用 [posture] 要求看他的手 · 时机合适时一次教一个真正的音乐术语（legato连奏、staccato断奏、右踏板用法、乐句呼吸）· 学员一旦说难、累、气馁或道歉——立刻停下教学内容，先真诚安慰，再把步骤砍半 · 按他的真实水平推荐曲目：入门 twinkle/mary，中级 happy/london，挑战 furelise（用 [song: id] 直接开启）· 课堂时钟：系统会告诉你这节课已经进行了多少分钟——像真人老师那样安排节奏（开头几分钟轻松热身/复习，中段只聚焦一个重点；超过约20分钟就开始收尾：用一句话总结今天进步的一点，还没布置就用 [homework: …] 布置作业，并用 [plan: …] 定好下节课计划）· 学员说再见或想结束时，绝不要只说拜拜——先一句话总结今天的进步，确认作业和计划都已保存，再温暖道别",
  },
};

const FLAGS = { th: "🇹🇭", en: "🇬🇧", zh: "🇨🇳" };
const FLAG_NAMES = { th: "ไทย", en: "English", zh: "中文" };

/* ── Styles ── */
const CSS = `
/* ── Light/dark mode variables — light is the CSS baseline (:root) so a first-time visit
   paints light immediately with no flash-of-dark before React mounts and sets the attribute;
   html[data-theme="dark"] is the opt-in override for anyone who picks Dark in Settings.
   Light mode's neutrals (bg/card/text/borders) follow Anthropic's own brand palette —
   #faf9f5 warm cream, #141413 near-black text, #e8e6dc/#b0aea5 warm grays — with this
   app's own pink (#d97757, unchanged, not a variable) staying the one accent color. ── */
:root{
  --bg: #faf9f5;
  --card: #ffffff;
  --card2: #f5f4f0;
  --card3: #efeee6;
  --grad1: #eae8de;
  --text: #141413;
  --text2: #4a463f;
  --muted: #7d7a70;
  --bd1: #14141312;
  --bd2: #14141314;
  --bd3: #14141310;
  --bd4: #1414131f;
  --bd5: #14141322;
  --bd6: #1414130d;
}
html[data-theme="dark"]{
  --bg: #0d0d0c;
  --card: #171615;
  --card2: #1e1c1a;
  --card3: #262320;
  --grad1: #2e2b27;
  --text: #faf9f5;
  --text2: #c9c6bd;
  --muted: #928f86;
  --bd1: #ffffff12;
  --bd2: #ffffff14;
  --bd3: #ffffff10;
  --bd4: #ffffff1f;
  --bd5: #ffffff22;
  --bd6: #ffffff0d;
}
/* index.html has a static (pre-JS-paint) copy of the light --bg value on these same
   three selectors, purely so first paint isn't a flash of white before this stylesheet
   loads — this rule is what actually keeps the root background in sync with the toggle
   afterward (it wins the cascade: this <style> tag is injected, so it's later in the DOM
   than the one already in <head>, and both rules have equal specificity). */
html, body, #root{background:var(--bg)}

@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=swap');
.tg{font-family:'Rajdhani',sans-serif;background:var(--bg);color:var(--text2);height:100vh;display:flex;flex-direction:column;overflow:hidden;position:relative}
.tg>*{position:relative;z-index:1}
/* keyboard-only focus ring (WCAG 2.4.7) — visible outline without affecting mouse users */
.tg :focus-visible{outline:2px solid #d97757;outline-offset:2px;border-radius:6px}
.tg button:focus-visible,.tg textarea:focus-visible{outline:2px solid #d97757;outline-offset:2px}
.scan{position:fixed;inset:0;pointer-events:none;z-index:9999}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--card);border-bottom:1px solid #d9775733;flex-shrink:0;position:relative;z-index:30}
.logo{display:flex;align-items:center;gap:10px}
/* hamburger + side drawer nav (minimal modern) */
.hamb{display:flex;flex-direction:column;justify-content:center;gap:4px;width:36px;height:36px;border:none;background:transparent;cursor:pointer;padding:7px;border-radius:10px;flex-shrink:0}
.hamb span{display:block;height:2.5px;width:100%;background:#d97757;border-radius:2px}
.hamb:active{background:var(--bd1)}
.drawer-scrim{position:fixed;inset:0;z-index:1450;background:rgba(4,4,12,.62);backdrop-filter:blur(3px);animation:fadein .2s}
.drawer{position:fixed;top:0;left:0;bottom:0;width:82%;max-width:300px;z-index:1460;background:var(--card);border-right:1px solid #d9775733;box-shadow:8px 0 44px -10px #000;transform:translateX(-105%);transition:transform .26s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;padding:18px 14px calc(18px + env(safe-area-inset-bottom,0px));overflow-y:auto}
.drawer.open{transform:translateX(0)}
.drawer-brand{display:flex;align-items:center;gap:10px;padding:4px 8px 16px;border-bottom:1px solid var(--bd1);margin-bottom:12px}
.drawer-brand .lbox{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:11px;background: #d97757;color:#fff;font-family:'Orbitron',sans-serif;font-weight:900;font-size:15px}
.draweritem{display:flex;align-items:center;gap:14px;width:100%;padding:14px;border:none;background:transparent;border-radius:14px;cursor:pointer;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:600;text-align:left;position:relative;margin-bottom:4px}
.draweritem:active{transform:scale(.98)}
.draweritem.on{background:var(--bd1)}
.draweritem.on .drawerlabel{color:#d97757}
.drawericon{font-size:22px;width:28px;text-align:center;color:var(--nav-c,#d97757);flex-shrink:0}
.drawerlabel{flex:1}
.drawerdot{width:8px;height:8px;border-radius:50%;background:var(--nav-c,#d97757);box-shadow:0 0 10px var(--nav-c,#d97757)}
.drawer-foot{margin-top:auto;border-top:1px solid var(--bd1);padding-top:10px}
.draweritem.sub{font-size:14px;color:var(--muted);padding:11px 14px;margin-bottom:0}
.draweritem.sub .drawericon{font-size:18px;color:var(--muted)}
.lbox{width:38px;height:38px;border:1.5px solid #d97757;border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:12px;color:#d97757;font-weight:900}
.lname{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:#d97757;text-shadow:0 0 8px #d97757;letter-spacing:2px}
.lsub{font-size:8px;color:var(--muted);letter-spacing:3px;font-family:'Share Tech Mono',monospace}
.hdr-r{display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:50%;background:#d97757;box-shadow:0 0 8px #d97757;animation:blink 1.5s infinite}
/* flag dropdown */
.flagwrap{position:relative}
.flagbtn{display:flex;align-items:center;gap:4px;background:none;border:1px solid #d9775744;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:16px;line-height:1;transition:all .2s}
.flagbtn:hover{border-color:#d97757;box-shadow:0 0 8px #d9775744;background:rgba(217,119,87,.08)}
.flagbtn .caret{font-size:8px;color:#d97757;font-family:'Share Tech Mono',monospace}
.flagmenu{position:absolute;top:calc(100% + 6px);right:0;background:#130a10;border:1px solid #d9775755;border-radius:6px;box-shadow:0 4px 20px rgba(217,119,87,.2);overflow:hidden;z-index:50;min-width:120px;animation:dropdown .18s ease-out}
.flagitem{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;font-size:15px;transition:all .15s;border:none;background:none;width:100%;color:var(--text2);font-family:'Rajdhani',sans-serif}
.flagitem .fn{font-size:12px;letter-spacing:.5px}
.flagitem:hover{background:rgba(217,119,87,.1)}
.flagitem.active{background:rgba(148,60,100,.18)}
.flagitem.active .fn{color:#d97757}
/* piano */
.pw{background:var(--card3);border-bottom:1px solid #d9775733;padding:10px 8px 4px;flex-shrink:0}
.plbl{font-family:'Orbitron',sans-serif;font-size:8px;color:var(--muted);letter-spacing:3px;text-align:center;margin-bottom:7px}
.kr{display:flex;justify-content:center;align-items:flex-start;gap:1px;overflow-x:auto;padding:0 4px 20px;scrollbar-width:none}
.kr::-webkit-scrollbar{display:none}
.pk{cursor:pointer;border-radius:0 0 4px 4px;transition:all .08s;flex-shrink:0;position:relative;user-select:none}
.pk.w{background:#fff;border:1px solid #d4cfc5;z-index:1;box-shadow:0 4px 8px rgba(0,0,0,.5)}
.pk.b{background:#060d1a;border:1px solid #001015;margin-left:-9px;margin-right:-9px;z-index:2;box-shadow:0 4px 12px rgba(0,0,0,.9)}
.pk.w.lit{background:#d97757;box-shadow:0 0 16px #d97757,0 0 40px #d9775766}
.pk.b.lit{background:#d97757;box-shadow:0 0 14px #d97757,0 0 30px #d9775766}
.pk.w:active{transform:translateY(2px)}
.pk.b:active{transform:translateY(1px)}
.pk.flash{animation:keypop .32s ease-out}
@keyframes keypop{0%{filter:brightness(1.9) saturate(1.3);box-shadow:0 0 18px 4px #d97757cc,0 0 36px 6px #d9775766}100%{filter:brightness(1)}}
.kn{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);font-size:7px;color:var(--muted);font-family:'Share Tech Mono',monospace;pointer-events:none}
/* finger number badge under keys */
.finger{position:absolute;bottom:-19px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;background:#ff5252;color:#fff;font-size:10px;font-weight:700;font-family:'Orbitron',sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px #ff525299;animation:fingerpop .2s ease-out;z-index:5}
.fingerrow{height:20px;display:flex;justify-content:center;align-items:center;margin-top:2px}
.fingerhint{font-family:'Share Tech Mono',monospace;font-size:8px;color:#ff525299;letter-spacing:1px}
/* piano label row + replay button */
.plblrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:0 2px}
.plblrow .plbl{margin-bottom:0}
.replaybtn{display:flex;align-items:center;gap:5px;background: rgba(217,119,87,.16);border:1px solid #d9775755;border-radius:14px;padding:4px 12px;cursor:pointer;color:#d97757;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;transition:all .2s}
.replaybtn:hover{border-color:#d97757;box-shadow:0 0 12px -3px #d97757;background: rgba(217,119,87,.26)}
.replaybtn:active{transform:scale(.93)}
.replayicon{font-size:13px;font-weight:700;display:inline-block}
.replaybtn:hover .replayicon{animation:spin .6s ease}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
/* broken-vs-block chord voicing toggle — shown whenever the loaded demo is a
   chord (triad/7th/tension/slash/block/pad-chord topics all share this) */
.chordstylerow{display:flex;gap:6px;margin:0 2px 8px;padding:3px;background:var(--card);border:1px solid var(--bd3);border-radius:12px}
.chordstylebtn{flex:1;background:none;border:none;border-radius:9px;padding:7px 6px;cursor:pointer;color:#a88b9b;font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;transition:all .2s}
.chordstylebtn.on{background: rgba(217,119,87,.22);color:#d97757;box-shadow:0 0 12px -4px #d97757}
/* hand selector */
/* persistent fingering chart */
.fchart{margin-top:10px;padding:9px 10px;background:var(--card2);border:1px solid var(--bd3);border-radius:11px}
.fchart-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.fchart-title{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;color:var(--muted);letter-spacing:1.5px}
.fchart-key{font-family:'Share Tech Mono',monospace;font-size:9px;color:#d97757;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}
.fchart-row::-webkit-scrollbar{height:3px}
.fchart-row::-webkit-scrollbar-thumb{background:var(--grad1);border-radius:2px}
.fchart-finger{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;color:#fff;box-shadow:0 0 8px -2px currentColor}
.fchart-note{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);line-height:1}
.handsel{display:flex;gap:10px;margin-top:14px;padding:0 2px}
.handbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:9px;padding:11px 9px;background: rgba(255,255,255,.02);border:1px solid var(--bd1);border-radius:13px;cursor:pointer;color:var(--muted);font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;transition:all .25s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
.handbtn::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .25s}
.handsvg{width:24px;height:24px;flex-shrink:0;transition:transform .25s,filter .25s;color:var(--muted)}
.handsvg.flip{transform:scaleX(-1)}
.handlbl{position:relative;z-index:1}
.handbtn:hover{color:var(--muted);border-color:#ffffff20}
.handbtn:hover .handsvg{transform:scale(1.12);color:var(--muted)}
.handbtn:hover .handsvg.flip{transform:scaleX(-1) scale(1.12)}
.handbtn.on{color:#d97757;border-color:#d9775777;background: rgba(217,119,87,.1);box-shadow:0 0 22px -8px #d97757,inset 0 0 18px -12px #d97757}
.handbtn.on::before{opacity:.12}
.handbtn.on .handsvg{color:#d97757;filter:drop-shadow(0 0 6px #d97757)}
.handbtn:active{transform:scale(.96)}
/* chat */
.cw{display:flex;flex-direction:column;flex:1;min-height:0}
.chdr{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--card3);border-bottom:1px solid #d9775733;flex-shrink:0}
.ailbl{font-family:'Orbitron',sans-serif;font-size:10px;color:#d97757;letter-spacing:1.5px;display:flex;align-items:center;gap:7px}
.ebtn{background:none;border:1px solid #d9775744;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:10px;color:#d97757;font-family:'Orbitron',sans-serif;letter-spacing:1px;transition:all .2s}
.ebtn:hover{border-color:#d97757;box-shadow:0 0 8px #d9775744;background:rgba(217,119,87,.08)}
.msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.msgs::-webkit-scrollbar{width:3px}
.msgs::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.msg{max-width:88%;animation:fadein .3s ease-out}
.msg.u{align-self:flex-end}
.msg.a{align-self:flex-start}
.bbl{padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.7}
.msg.u .bbl{background: rgba(217,119,87,.15);border:1px solid #d97757;border-radius:8px 2px 8px 8px;color:var(--text2)}
.msg.a .bbl{background:var(--card3);border:1px solid #d9775722;border-radius:2px 8px 8px 8px;color:var(--text2)}
.atag{font-family:'Orbitron',sans-serif;font-size:8px;color:#d97757;letter-spacing:1px;margin-bottom:5px}
.mact{display:flex;gap:6px;margin-top:7px;align-items:center;flex-wrap:wrap}
.spkbtn{display:flex;align-items:center;gap:8px;background: rgba(217,119,87,.09);border:1px solid #d9775755;border-radius:20px;padding:6px 14px 6px 12px;cursor:pointer;font-size:10px;font-family:'Orbitron',sans-serif;letter-spacing:.8px;transition:all .22s;color:#d97757}
.spkbtn:hover{border-color:#d97757;box-shadow:0 0 14px -4px #d97757;background: rgba(217,119,87,.15)}
.spkbtn:active{transform:scale(.95)}
.spkbtn.on{border-color:#ff5252;color:#d97757;box-shadow:0 0 16px -4px #ff5252;background: rgba(255,82,82,.18)}
.spkwave{display:flex;align-items:center;gap:2px;height:14px}
.spkwave span{width:2.5px;height:5px;border-radius:2px;background:currentColor;opacity:.55;transition:opacity .2s}
.spkbtn.on .spkwave span{opacity:1;animation:wave 1s ease-in-out infinite}
.spkbtn.on .spkwave span:nth-child(1){animation-delay:0s}
.spkbtn.on .spkwave span:nth-child(2){animation-delay:.15s}
.spkbtn.on .spkwave span:nth-child(3){animation-delay:.3s}
.spkbtn.on .spkwave span:nth-child(4){animation-delay:.45s}
@keyframes wave{0%,100%{height:4px}50%{height:13px}}
.spktxt{line-height:1}
@keyframes spkpulse{0%,100%{opacity:1}50%{opacity:.5}}
.playbtn{display:flex;align-items:center;gap:5px;background:none;border:1px solid #d9775766;border-radius:4px;padding:4px 11px;cursor:pointer;font-size:10px;font-family:'Orbitron',sans-serif;letter-spacing:.8px;transition:all .2s;color:#d97757}
.playbtn:hover{border-color:#d97757;box-shadow:0 0 8px #d9775744;background:rgba(217,119,87,.08)}
.nlbl{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted)}
.typing{display:flex;gap:5px;align-items:center;padding:10px 14px}
.tdd{width:7px;height:7px;border-radius:50%;background:#d97757;animation:bounce 1.2s infinite}
.tdd:nth-child(2){animation-delay:.2s}.tdd:nth-child(3){animation-delay:.4s}
.iw{padding:10px 12px;background:var(--card3);border-top:1px solid #d9775733;flex-shrink:0}
.ir{display:flex;gap:8px;align-items:flex-end}
.tin{flex:1;background:var(--card3);border:1px solid #d9775733;border-radius:6px;padding:10px 14px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:14px;resize:none;min-height:44px;max-height:110px;outline:none;transition:border-color .2s}
.tin:focus{border-color:#d97757;box-shadow:0 0 0 1px rgba(217,119,87,.15)}
.tin::placeholder{color:var(--muted)}
.snd{width:44px;height:44px;border:none;border-radius:6px;background: #d97757;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .2s;flex-shrink:0;color:#fff}
.snd:hover{transform:scale(1.06);box-shadow:0 0 18px #d97757}
.snd:disabled{opacity:.35;cursor:not-allowed;transform:none}
.hint{font-size:9px;color:var(--muted);text-align:center;margin-top:5px;font-family:'Share Tech Mono',monospace}
.mov{display:none;position:fixed;inset:0;background:rgba(10,5,9,.97);z-index:1000;flex-direction:column}
.mov.open{display:flex}
.mhdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #d9775733;background:var(--card3);flex-shrink:0}
.mlbl{font-family:'Orbitron',sans-serif;font-size:10px;color:#d97757;letter-spacing:1.5px;display:flex;align-items:center;gap:7px}
.cbtn{background:none;border:1px solid #ff5252;border-radius:4px;padding:5px 14px;cursor:pointer;color:#ff5252;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;transition:all .2s}
.cbtn:hover{background:rgba(255,82,82,.1);box-shadow:0 0 10px #ff5252}
.mpw{padding:8px 8px 14px;background:var(--card3);border-bottom:1px solid #d9775733;flex-shrink:0}
.mmsgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.mmsgs::-webkit-scrollbar{width:3px}
.mmsgs::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.miw{padding:10px 12px;background:var(--card3);border-top:1px solid #d9775733;flex-shrink:0}
@keyframes pulse{0%,100%{box-shadow:0 0 10px #d97757,0 0 25px #d9775744}50%{box-shadow:0 0 20px #d97757,0 0 50px #d9775766}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes dropdown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes fingerpop{from{opacity:0;transform:translateX(-50%) scale(.4)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes flicker{0%,94%,97%,100%{opacity:1}95%,98%{opacity:.5}}
.flicker{animation:flicker 6s infinite}
/* ── nav bar ── */
.navbar{display:flex;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));background:var(--card2);border-top:1px solid #d9775722;flex-shrink:0;position:relative}
.navbar::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background: #d9775766}
.navbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 8px;background:rgba(255,255,255,.02);border:1px solid var(--bd6);border-radius:12px;cursor:pointer;color:var(--muted);font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;transition:all .25s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
.navbtn .nicon{font-size:16px;line-height:1;transition:transform .25s}
.navbtn .nlabel{position:relative;z-index:1}
.navbtn::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .25s}
.navbtn:hover{color:var(--muted);border-color:#ffffff1a}
.navbtn:hover .nicon{transform:scale(1.12)}
.navbtn.on{color:#d97757;border-color:var(--nav-c,#d97757);background:rgba(217,119,87,.06);box-shadow:0 0 18px -6px var(--nav-c,#d97757),inset 0 0 16px -10px var(--nav-c,#d97757)}
.navbtn.on::before{opacity:1}
.navbtn.on .nicon{transform:scale(1.1);filter:drop-shadow(0 0 5px var(--nav-c,#d97757))}
.navbtn:active{transform:scale(.95)}
/* ── vertical video lessons feed (TikTok-style, one video per screen) ── */
.vidfeed{flex:1;overflow-y:auto;scroll-snap-type:y mandatory;background:#000;scrollbar-width:none}
.vidfeed::-webkit-scrollbar{display:none}
.vidslide{height:100%;scroll-snap-align:start;scroll-snap-stop:always;position:relative;display:flex;align-items:center;justify-content:center;background:#000}
.vidplayer{width:100%;height:100%;object-fit:cover;background:#000;border:none}
@media (min-aspect-ratio:3/4){video.vidplayer{object-fit:contain}}
.vidplaceholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;opacity:.25}
.vidmute{position:absolute;right:12px;top:14px;z-index:6;background:rgba(18,8,14,.55);border:1px solid #ffffff2a;border-radius:50%;width:42px;height:42px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
.vidpause{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;color:#ffffffd6;pointer-events:none;text-shadow:0 2px 18px #000}
.vidbar{position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--bd5);z-index:7}
.vidbar span{display:block;height:100%;width:0;background: #d97757}
/* ── TikTok chrome: top fade, right action rail (like / ask / save), floating hearts ── */
.vidtopfade{position:absolute;top:0;left:0;right:0;height:64px;background:linear-gradient(rgba(0,0,0,.42),transparent);pointer-events:none;z-index:3}
/* the app header hides on the video feed — this translucent ☰ keeps navigation reachable */
.vidfab{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:10px;z-index:60;width:42px;height:42px;border-radius:50%;background:rgba(18,8,14,.55);border:1px solid #ffffff2a;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;cursor:pointer;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(4px)}
.vidfab span{display:block;width:17px;height:2px;background:#fff;border-radius:2px}
.vidfab:active{transform:scale(.92)}
.vidrail{position:absolute;right:6px;bottom:92px;display:flex;flex-direction:column;align-items:center;gap:15px;z-index:8}
.vidact{background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
.vidact-ic{font-size:29px;filter:grayscale(1) brightness(1.9);text-shadow:0 1px 6px rgba(0,0,0,.55);transition:transform .12s;line-height:1}
.vidact:active .vidact-ic{transform:scale(.85)}
.vidact.on .vidact-ic,.vidact.fav .vidact-ic{filter:none;animation:heartpop .32s ease-out}
.vidact-n{font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:700;color:#fff;text-shadow:0 1px 4px #000;min-height:13px}
@keyframes heartpop{0%{transform:scale(.55)}55%{transform:scale(1.35)}100%{transform:scale(1)}}
.vidheart{position:absolute;font-size:74px;pointer-events:none;z-index:9;animation:heartfloat .82s ease-out forwards}
@keyframes heartfloat{0%{opacity:0;transform:scale(.4)}18%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:translateY(-110px) scale(1.35)}}
/* ── pathway page (hero + grid) ── */
.pathpage{flex:1;overflow-y:auto;padding:0 0 24px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.pathpage::-webkit-scrollbar{width:4px}
.pathpage::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.pathhero{position:relative;text-align:center;padding:22px 16px 20px;margin-bottom:8px;overflow:hidden;border-bottom:1px solid #d977571f}
.pathhero-glow{position:absolute;top:-60%;left:50%;transform:translateX(-50%);width:280px;height:280px;pointer-events:none}
.pathbadge{position:relative;display:inline-block;font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:3px;color:#d97757;border:1px solid #d9775744;border-radius:20px;padding:4px 15px;margin-bottom:12px;background:rgba(217,119,87,.05)}
.pathh1{position:relative;font-family:'Orbitron',sans-serif;font-size:19px;font-weight:900;color:var(--text);text-shadow:0 0 16px #d9775777;letter-spacing:1px;margin-bottom:13px}
.pathguide{position:relative;font-size:12px;color:var(--text2);line-height:1.65;background: rgba(217,119,87,.07);border:1px solid #d9775722;border-radius:10px;padding:11px 14px;font-family:'Rajdhani',sans-serif;max-width:430px;margin:0 auto}
.pgroup{padding:0 14px;margin-bottom:22px}
.pgrouphdr{display:flex;align-items:center;gap:11px;margin-bottom:13px}
.pgbar{width:4px;height:34px;border-radius:3px;flex-shrink:0;box-shadow:0 0 10px currentColor}
.pgicon{font-size:21px;line-height:1;flex-shrink:0}
.pginfo{flex:1;min-width:0}
.pglabel{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:var(--text);letter-spacing:2px;line-height:1.2}
.pgdesc{font-size:11px;color:var(--muted);font-family:'Rajdhani',sans-serif;margin-top:2px}
.pgstep{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:1px;flex-shrink:0}
.pgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
/* ── v12 value pages (Today / Ear gym / Reading / Insights / Report) ── */
.v12hero{text-align:center;padding:16px 12px 12px}
.v12title{font-family:'Orbitron',sans-serif;font-size:20px;font-weight:900;color:var(--text);letter-spacing:1px}
.v12sub{font-size:12.5px;color:var(--muted);font-family:'Rajdhani',sans-serif;margin-top:5px;line-height:1.5}
.v12card{background:var(--card2);border:1px solid var(--bd1);border-radius:14px;padding:14px 13px;margin:0 0 10px}
.tdstep{display:flex;align-items:center;gap:12px;padding:13px 12px;border-radius:13px;background:var(--card2);border:1px solid var(--bd2);margin-bottom:9px}
.tdstep.done{border-color:#d9775766;background:var(--card3)}
.tdico{font-size:22px;flex-shrink:0}
.tdtag{font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:.6px}
.tdlbl{font-size:14px;color:var(--text);font-family:'Rajdhani',sans-serif;font-weight:700;line-height:1.3}
.tdgo{flex-shrink:0;padding:9px 16px;border-radius:10px;border:1px solid #d9775766;background:rgba(217,119,87,.1);color:#d97757;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer}
.tdgo.done{border-color:#d97757;color:#d97757;background:rgba(217,119,87,.08);cursor:default}
.tdbar{height:10px;border-radius:6px;background:var(--card);overflow:hidden;border:1px solid var(--bd1)}
.tdfill{height:100%;background: #d97757;transition:width .4s}
.egopt{padding:12px 8px;border-radius:12px;border:1px solid var(--grad1);background:var(--card2);color:var(--text);font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:700;cursor:pointer;text-align:center;line-height:1.25}
.egopt.ok{border-color:#d97757;color:#d97757;background:rgba(217,119,87,.1)}
.egopt.bad{border-color:#ff5252;color:#ff5252;background:rgba(255,82,82,.08)}
.insbarwrap{display:flex;align-items:flex-end;gap:4px;height:90px;padding:4px 2px 0}
.insbar{flex:1;background: #d97757;border-radius:4px 4px 0 0;min-height:2px}
.instile{flex:1;background:var(--card2);border:1px solid var(--bd1);border-radius:12px;padding:11px 6px;text-align:center;min-width:0}
.instile b{display:block;font-family:'Orbitron',sans-serif;font-size:16px;color:#d97757;margin-bottom:3px}
.instile span{font-size:9.5px;color:var(--muted);font-family:'Rajdhani',sans-serif;font-weight:600;line-height:1.2;display:block}
.certrow{display:flex;align-items:center;gap:11px;padding:12px;border-radius:13px;border:1px solid var(--bd2);background:var(--card2);margin-bottom:9px}
.certrow.earned{border-color:#d9775766;background:var(--card3)}
.pcard{position:relative;display:flex;flex-direction:column;text-align:left;background:var(--card2);border:1px solid var(--bd1);border-top:2px solid var(--ac);border-radius:13px;padding:13px;cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s;overflow:hidden;font-family:'Rajdhani',sans-serif;color:var(--text2);min-height:152px;width:100%}
.pcardglow{position:absolute;top:-30px;right:-30px;width:90px;height:90px;border-radius:50%;pointer-events:none}
.pcard.done{border-color:#d9775755}
.pcarddone{position:absolute;top:9px;right:9px;width:22px;height:22px;border-radius:50%;background:#d97757;color:var(--card2);font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px -2px #d97757;z-index:3}
.pcard.current{box-shadow:0 0 0 1px var(--ac),0 0 22px -6px var(--ac);animation:currentpulse 1.8s ease-in-out infinite}
@keyframes currentpulse{0%,100%{box-shadow:0 0 0 1px var(--ac),0 0 18px -8px var(--ac)}50%{box-shadow:0 0 0 1px var(--ac),0 0 26px -2px var(--ac)}}
.pcardhere{position:absolute;top:9px;right:9px;font-family:'Orbitron',sans-serif;font-size:8px;font-weight:800;letter-spacing:.5px;color:var(--card2);background:var(--ac);border-radius:6px;padding:3px 6px;z-index:3;animation:flamepulse 1s ease-in-out infinite alternate}
.pcard:hover{border-color:var(--ac);transform:translateY(-3px);box-shadow:0 10px 26px -10px var(--ac)}
.pcard:hover .pcardglow{opacity:.22}
.pcard:active{transform:translateY(-1px) scale(.98)}
.pcardlevel{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;letter-spacing:1px;color:var(--ac);opacity:.95;margin-bottom:7px}
.pcardicon{font-size:30px;line-height:1;margin-bottom:9px}
.pcardtitle{font-family:'Orbitron',sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.2px;color:var(--text);margin-bottom:4px;line-height:1.3}
.pcardsub{font-size:10.5px;color:var(--muted);line-height:1.4;flex:1;margin-bottom:10px}
.pcardkeys{display:inline-block;align-self:flex-start;font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;color:#d97757;background:rgba(217,119,87,.12);border:1px solid #d9775744;border-radius:7px;padding:2px 7px;margin-bottom:8px}
.pcardgo{display:flex;align-items:center;justify-content:space-between;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;color:var(--ac);border-top:1px solid var(--bd3);padding-top:9px}
.pcardarrow{font-size:14px;transition:transform .2s}
.pcard:hover .pcardarrow{transform:translateX(4px)}
.pathfoot{text-align:center;font-size:10px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:1px;margin:10px 14px 0;padding-top:14px;line-height:1.6;border-top:1px solid #d977571a}
/* ── inline key picker panel (spans full grid row) ── */
.pcard.active{border-color:var(--ac);box-shadow:0 0 24px -8px var(--ac);transform:translateY(-2px)}
.keypanel{background:var(--card2);border:1px solid var(--ac,#d97757);border-radius:14px;padding:14px 13px;margin-top:10px;position:relative;overflow:hidden;animation:keyexpand .3s cubic-bezier(.2,.9,.3,1)}
.keypanel::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background: var(--ac);opacity:.6}
@keyframes keyexpand{from{opacity:0;transform:translateY(-8px) scaleY(.9)}to{opacity:1;transform:translateY(0) scaleY(1)}}
.keypanel-head{display:flex;align-items:center;gap:9px;margin-bottom:13px;padding-bottom:10px;border-bottom:1px solid var(--bd3)}
.keypanel-icon{font-size:18px;line-height:1}
.keypanel-title{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:#fff;letter-spacing:.3px;flex:1;min-width:0}
.keypanel-tag{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--ac,#d97757);letter-spacing:1px;white-space:nowrap}
.keygrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.keybtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:11px 5px;background:var(--card2);border:1px solid var(--grad1);border-radius:10px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden}
.keybtn::after{content:'';position:absolute;inset:0;background:var(--ac,#d97757);opacity:0;transition:opacity .18s}
.keybtn.black{background:var(--card3);border-color:var(--bd4)}
.keybtn-name{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:900;color:var(--text2);line-height:1;position:relative;z-index:1}
.keybtn.black .keybtn-name{color:#d97757}
.keybtn-sub{font-size:8.5px;font-family:'Rajdhani',sans-serif;font-weight:600;color:var(--muted);line-height:1;position:relative;z-index:1}
.keybtn:hover{transform:translateY(-3px);border-color:var(--ac,#d97757);box-shadow:0 8px 18px -8px var(--ac,#d97757)}
.keybtn:hover::after{opacity:.1}
.keybtn:active{transform:translateY(-1px) scale(.95)}
.keypanel-foot{text-align:center;font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:.5px;line-height:1.5}
/* ── admin page ── */
.adminpage{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--bg)}
.adminbar{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:var(--card2);border-bottom:1px solid #ff525244;flex-shrink:0;box-shadow:0 2px 16px rgba(255,82,82,.12)}
.adminbar-l{display:flex;align-items:center;gap:11px}
.adminorb{width:34px;height:34px;border-radius:9px;background: #ff5252;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 14px #ff525266;animation:pulse 2.5s infinite}
.adminmeta{min-width:0}
.admintitle{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:900;color:#d97757;letter-spacing:2px;text-shadow:0 0 10px #ff525266}
.adminsub{font-size:10px;color:var(--muted);font-family:'Rajdhani',sans-serif;margin-top:1px}
.adminexit{background:none;border:1px solid #ff525255;border-radius:6px;padding:6px 13px;cursor:pointer;color:#d97757;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;transition:all .2s}
.adminexit:hover{background:rgba(255,82,82,.14);box-shadow:0 0 10px #ff525255}
.adminbbl{border-color:#ff525233!important;background:var(--card3)!important}
.adminatag{color:#d97757!important}
.admintabs{display:flex;gap:8px;padding:10px 14px 4px;flex-shrink:0}
.admintab{flex:1;padding:9px 10px;border-radius:10px;background:var(--card3);border:1px solid #ff525233;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer}
.admintab.on{background: #ff5252;color:#fff;border-color:transparent}
.admstu{flex:1;min-height:0;overflow-y:auto;padding:10px 14px 28px}
.admstu-msg,.admstu-empty{color:var(--muted);text-align:center;padding:24px 8px;font-size:14px}
.admstu-err{color:#ff5252;background:rgba(255,82,82,.08);border:1px solid #ff525233;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:12.5px}
.admstu-top{display:flex;gap:8px;margin-bottom:8px}
.admstu-search{flex:1;background:var(--card3);border:1px solid #ff525233;border-radius:10px;padding:10px 12px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:14px}
.admstu-refresh{width:42px;border-radius:10px;background:var(--card3);border:1px solid #ff525233;color:#d97757;font-size:16px;cursor:pointer}
.admstu-count{color:var(--muted);font-size:12px;margin:2px 2px 8px;font-family:'Orbitron',sans-serif;letter-spacing:1px}
.admstu-list{display:flex;flex-direction:column;gap:8px}
.admstu-row{display:flex;align-items:center;gap:11px;text-align:left;background:var(--card3);border:1px solid var(--bd1);border-radius:13px;padding:11px 13px;cursor:pointer}
.admstu-row:hover{border-color:#ff525255}
.admstu-av{width:42px;height:42px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-weight:700;font-size:18px;color:#fff;background: #ff5252}
.admstu-av.sm{width:38px;height:38px;font-size:16px}
.admstu-row-body{flex:1;min-width:0}
.admstu-row-nm{color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admstu-row-meta{color:var(--muted);font-size:12px;margin-top:2px}
.admstu-row-sub{color:#7c6675;font-size:11px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admstu-row-go{color:#d97757;font-size:20px;flex-shrink:0}
.admstu-badge{display:inline-block;background:#ff5252;color:#fff;font-size:9px;font-family:'Orbitron',sans-serif;padding:2px 6px;border-radius:6px;vertical-align:middle;margin-left:6px}
.admstu-back{background:none;border:none;color:#d97757;font-family:'Orbitron',sans-serif;font-size:12px;cursor:pointer;padding:4px 0;margin-bottom:8px}
.admstu-head{display:flex;align-items:center;gap:13px;margin-bottom:14px}
.admstu-nm{color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:18px}
.admstu-em{color:var(--muted);font-size:12.5px}
.admstu-lv{color:var(--muted);font-size:11.5px;margin-top:2px}
.admstu-sec{color:#d97757;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;margin:16px 0 8px}
.admstu-bars{display:flex;align-items:flex-end;gap:5px;height:88px;padding:4px 2px;background:var(--card3);border-radius:12px}
.admstu-bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px}
.admstu-bar-fill{width:100%;border-radius:4px 4px 0 0;min-height:4px}
.admstu-bar-lbl{font-size:9px;color:var(--muted);font-family:'Share Tech Mono',monospace}
.admmg{background:var(--card3);border:1px solid #ff525233;border-radius:13px;padding:13px;margin-bottom:14px}
.admmg-h{font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:1px;color:#d97757;margin-bottom:6px}
.admmg-cur{color:var(--muted);font-size:12.5px;margin-bottom:9px}
.admmg-row{display:flex;align-items:center;gap:8px}
.admmg-sel{flex:1;background:var(--card3);border:1px solid var(--bd4);border-radius:9px;padding:9px 10px;color:var(--text2);font-size:14px}
.admmg-days{width:64px;background:var(--card3);border:1px solid var(--bd4);border-radius:9px;padding:9px;color:var(--text2);font-size:14px;text-align:center}
.admmg-d{color:var(--muted);font-size:13px}
.admmg-row2{display:flex;gap:8px;margin-top:8px}
.admmg-row2 .songbtn{flex:1;padding:10px}
.banscreen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:12px}
.adminchips{display:flex;flex-wrap:wrap;gap:7px;padding:10px 14px 4px;flex-shrink:0}
.adminchip{background:rgba(255,82,82,.08);border:1px solid #ff525233;border-radius:16px;padding:7px 13px;cursor:pointer;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:11.5px;font-weight:600;transition:all .2s;text-align:left}
.adminchip:hover{border-color:#ff5252;background:rgba(255,82,82,.16);box-shadow:0 0 10px #ff525233;transform:translateY(-1px)}
.adminchip:active{transform:translateY(0) scale(.97)}
.adminmiw{background:#140a16;border-top:1px solid #ff525233}
.admintools{display:flex;gap:8px;padding:8px 14px 0;flex-shrink:0}
.webtoggle{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.03);border:1px solid var(--bd2);border-radius:18px;padding:7px 14px;cursor:pointer;color:#9a7a8b;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;transition:all .22s}
.webtoggle .webdot{width:7px;height:7px;border-radius:50%;background:#445;transition:all .22s}
.webtoggle:hover{border-color:var(--bd5);color:var(--muted)}
.webtoggle.on{color:#d97757;border-color:#d9775766;background:rgba(217,119,87,.08);box-shadow:0 0 12px -4px #d97757}
.webtoggle.on .webdot{background:#d97757;box-shadow:0 0 8px #d97757;animation:blink 1.2s infinite}
.attachbtn{width:44px;height:44px;border:1px solid #ff525244;border-radius:12px;background: rgba(255,82,82,.12);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;color:#d97757;flex-shrink:0;transition:all .22s;font-weight:300}
.attachbtn:hover{border-color:#ff5252;background:rgba(255,82,82,.14);box-shadow:0 0 10px -3px #ff5252}
.attachbtn:active{transform:scale(.93)}
.adminpreview{display:flex;align-items:center;gap:10px;margin:8px 14px 0;padding:8px 10px;background:rgba(255,82,82,.06);border:1px solid #ff525233;border-radius:10px;flex-shrink:0}
.adminpreview img{width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #ff525255}
.adminpreviewname{flex:1;font-size:11px;color:var(--text);font-family:'Share Tech Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adminpreviewx{width:26px;height:26px;border-radius:50%;border:1px solid #ff525255;background:none;color:#d97757;cursor:pointer;font-size:11px;flex-shrink:0;transition:all .2s}
.adminpreviewx:hover{background:rgba(255,82,82,.2)}
.adminimg{max-width:100%;border-radius:8px;margin-bottom:8px;border:1px solid #ffffff1a;display:block}
/* ── lock screen ── */
.lockwrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 20px;gap:16px}
.lockicon{font-size:46px;filter:drop-shadow(0 0 14px #ff525288);animation:pulse 2.5s infinite}
.locktitle{font-family:'Orbitron',sans-serif;font-size:14px;color:#ff5252;letter-spacing:2px;text-shadow:0 0 10px #ff525266}
.locksub{font-size:11px;color:var(--muted);font-family:'Share Tech Mono',monospace;text-align:center;line-height:1.6;max-width:280px}
.lockinput{background:var(--card3);border:1px solid #ff525255;border-radius:8px;padding:12px 16px;color:var(--text);font-family:'Share Tech Mono',monospace;font-size:15px;text-align:center;letter-spacing:3px;outline:none;width:200px;transition:all .2s}
.lockinput:focus{border-color:#ff5252;box-shadow:0 0 14px #ff525244}
.lockbtn{background: #ff5252;border:none;border-radius:8px;padding:11px 28px;cursor:pointer;color:#fff;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:2px;transition:all .2s}
.lockbtn:active{transform:scale(.95)}
.lockerr{color:#ff5252;font-size:11px;font-family:'Share Tech Mono',monospace;min-height:14px;animation:shake .3s}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
/* ── membership / login ── */
.loginhero{display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px 22px 2px;text-align:center;flex-shrink:0}
.loginpiano{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:6px 0}
.loginpiano-hint{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:1px;text-align:center;min-height:14px}
.memberwrap{display:flex;flex-direction:column;align-items:center;gap:13px;padding:30px 22px;width:100%;max-width:340px;text-align:center}
.loginwrap{flex-shrink:0;margin:0 auto;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}
.oauthbtn{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;padding:13px 16px;border-radius:12px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:600;transition:all .2s}
.oauthbtn:active{transform:scale(.97)}
.oauthbtn .oauthico{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-family:'Orbitron',sans-serif;font-weight:900;font-size:13px}
.oauthbtn.google{background:#fff;color:#222}.oauthbtn.google .oauthico{background:#fff;color:#4285F4;border:1px solid #ddd}
.oauthbtn.google:hover{box-shadow:0 0 16px -4px #ffffff99}
.oauthbtn.facebook{background:#1877F2;color:#fff}.oauthbtn.facebook .oauthico{background:#fff;color:#1877F2}
.oauthbtn.facebook:hover{box-shadow:0 0 16px -4px #1877F2}
.memberfoot{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:2px;margin-top:6px}
.memberinput{width:100%;background:var(--card3);border:1px solid #d9775744;border-radius:10px;padding:12px 14px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:14px;outline:none;transition:border-color .2s;box-sizing:border-box}
.memberinput:focus{border-color:#d97757;box-shadow:0 0 0 1px rgba(217,119,87,.15)}
.memberinput::placeholder{color:var(--muted)}
.memberlink{background:none;border:none;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:12px;cursor:pointer;text-decoration:underline;margin-top:2px}
.memberlink:hover{color:#d97757}
.logoutbtn{background:none;border:1px solid #ff525244;border-radius:6px;width:30px;height:28px;cursor:pointer;color:#d97757;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.logoutbtn:hover{background:rgba(255,82,82,.12);box-shadow:0 0 8px -2px #ff5252}
/* ── profile / gamification page ── */
.profpage{flex:1;overflow-y:auto;padding:0 0 24px;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.profscroll{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3)}
.profscroll .profpage{flex:none;overflow:visible}
.profdash{padding-top:10px}
.profpage::-webkit-scrollbar{width:4px}
.profpage::-webkit-scrollbar-thumb{background:#d97757;border-radius:2px}
.profhero{position:relative;text-align:center;padding:26px 16px 22px;overflow:hidden;border-bottom:1px solid #d977571f}
.profhero-glow{position:absolute;top:-70%;left:50%;transform:translateX(-50%);width:300px;height:300px;pointer-events:none}
/* the ring and purchased frame both extend beyond the avatar's own edge, so they
   have to sit outside .profava's overflow:hidden (needed to clip the photo into
   a circle) — .profava-wrap is the unclipped positioning context for both. */
.profava-wrap{position:relative;width:92px;height:92px;margin:0 auto 13px}
.profava{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:31px;font-weight:900;color:#fff;background: #d97757;box-shadow:0 0 28px -4px var(--lv-c,#d97757);overflow:hidden}
.profava img{width:100%;height:100%;object-fit:cover}
.profava-ring{position:absolute;inset:-5px;border-radius:50%;border:2px solid var(--lv-c,#d97757);opacity:.55}
.profava-frame{position:absolute;inset:-10px;border-radius:50%;pointer-events:none}
body[data-frame="fr-bronze"] .profava-frame{border:3px solid #cd7f32;box-shadow:0 0 10px -2px #cd7f32}
body[data-frame="fr-silver"] .profava-frame{border:3px solid #d7d7de;box-shadow:0 0 14px -2px #d7d7de}
body[data-frame="fr-gold"] .profava-frame{border:3px solid #ffd23f;box-shadow:0 0 18px -2px #ffd23f,0 0 30px -8px #ffd23f}
body[data-frame="fr-diamond"] .profava-frame{border:3px solid #8ad4ff;box-shadow:0 0 20px -2px #8ad4ff,0 0 34px -6px #a855f7;animation:diamondshine 2.4s ease-in-out infinite}
@keyframes diamondshine{0%,100%{box-shadow:0 0 20px -2px #8ad4ff,0 0 34px -6px #a855f7}50%{box-shadow:0 0 26px -2px #a855f7,0 0 40px -6px #8ad4ff}}
.profname{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:700;color:var(--text);text-shadow:0 0 12px #d9775766;margin-bottom:8px}
.profrankbadge{display:inline-flex;align-items:center;gap:7px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;color:var(--lv-c,#d97757);border:1px solid var(--lv-c,#d97757);border-radius:20px;padding:5px 14px;background:rgba(217,119,87,.06)}
.expwrap{max-width:430px;margin:18px auto 0;padding:0 6px}
.exprow{display:flex;justify-content:space-between;align-items:baseline;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);margin-bottom:6px}
.expnum{color:var(--lv-c,#d97757);font-weight:700;font-size:12px}
.expbar{height:14px;border-radius:8px;background:var(--card3);border:1px solid var(--bd2);overflow:hidden;position:relative}
.expfill{height:100%;border-radius:8px;background: #d97757;box-shadow:0 0 12px -2px #d97757;transition:width .9s cubic-bezier(.2,.9,.3,1)}
.expnext{text-align:center;font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted);margin-top:8px;letter-spacing:.5px}
.profstats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px 14px 4px;max-width:460px;margin:0 auto}
.statcard{background:var(--card2);border:1px solid var(--bd1);border-radius:13px;padding:15px 6px;text-align:center}
.statval{font-family:'Orbitron',sans-serif;font-size:23px;font-weight:900;color:var(--text);line-height:1}
.statval .em{font-size:15px}
.statlbl{font-size:9.5px;color:var(--muted);font-family:'Share Tech Mono',monospace;letter-spacing:.5px;margin-top:7px}
.profsec{padding:16px 14px 0;max-width:480px;margin:0 auto}
.profsec-h{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:var(--text);letter-spacing:2px;margin-bottom:12px;display:flex;align-items:center;gap:9px}
.profsec-h::before{content:'';width:4px;height:18px;border-radius:3px;background:#d97757;box-shadow:0 0 10px #d97757}
.rankrow{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:11px;margin-bottom:7px;background:var(--card3);border:1px solid var(--bd6);transition:all .2s}
.rankrow.cur{border-color:var(--lv-c,#d97757);background:rgba(217,119,87,.07);box-shadow:0 0 18px -8px var(--lv-c,#d97757)}
.rankrow.done{opacity:.6}
.rankrow.locked{opacity:.42}
.rankicon{font-size:20px;width:30px;text-align:center;flex-shrink:0}
.rankmeta{flex:1;min-width:0}
.rankname{font-family:'Orbitron',sans-serif;font-size:11.5px;font-weight:700;color:var(--text2)}
.rankexp{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px}
.ranktick{font-size:14px;flex-shrink:0;color:var(--lv-c,#d97757)}
.contactcard{background:var(--card2);border:1px solid var(--bd1);border-radius:13px;padding:4px 14px}
.contactrow{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid #ffffff0a;font-size:13px}
.contactrow:last-child{border-bottom:none}
.contactico{font-size:15px;width:22px;text-align:center;flex-shrink:0}
.contactval{color:var(--text2);font-family:'Rajdhani',sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.contactval.empty{color:var(--muted)}
.profsignout{display:block;width:calc(100% - 28px);max-width:452px;margin:20px auto 0;padding:13px;border-radius:12px;border:1px solid #ff525244;background:rgba(255,82,82,.08);color:#d97757;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:2px;cursor:pointer;transition:all .2s}
.profsignout:hover{background:rgba(255,82,82,.16);box-shadow:0 0 14px -4px #ff5252}
.profsignout:active{transform:scale(.98)}
/* exp toast */
.exptoast{position:fixed;top:64px;left:50%;z-index:1200;display:flex;align-items:center;gap:8px;background: #d97757;color:#04121a;font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;letter-spacing:1px;padding:9px 18px;border-radius:22px;box-shadow:0 8px 26px -6px #d97757,inset 0 0 0 1px var(--bd5);animation:exppop 2.2s ease-out forwards;pointer-events:none}
/* one-time "add to home screen" banner, shown after the first real win */
.installbanner{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:1300;display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid #d9775755;border-radius:16px;padding:11px 12px;box-shadow:0 10px 30px -8px #000,0 0 20px -8px #d9775766;animation:installin .3s ease-out}
@keyframes installin{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.installbanner-ic{font-size:26px;flex-shrink:0}
.installbanner-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.installbanner-tx b{font-size:13px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:700;line-height:1.25}
.installbanner-tx span{font-size:11px;color:var(--muted);line-height:1.2}
.installbanner-go{flex-shrink:0;background: #d97757;color:#fff;border:none;border-radius:11px;padding:9px 14px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap}
.installbanner-x{flex-shrink:0;background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:4px 2px}
@keyframes exppop{0%{opacity:0;transform:translateX(-50%) translateY(-14px) scale(.7)}14%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.06)}26%{transform:translateX(-50%) translateY(0) scale(1)}78%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-10px) scale(.96)}}
/* level-up overlay */
.lvup{position:fixed;inset:0;z-index:1300;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,5,9,.82);backdrop-filter:blur(4px);animation:fadein .3s;pointer-events:none}
.lvup-burst{font-size:74px;animation:lvbounce .7s cubic-bezier(.2,1.4,.4,1);position:relative;z-index:2}
.lvup-rays{position:absolute;width:480px;height:480px;background:conic-gradient(from 0deg,var(--bd5) 0 8deg,transparent 8deg 30deg);border-radius:50%;animation:rayspin 6s linear infinite;pointer-events:none}
@keyframes rayspin{to{transform:rotate(360deg)}}
.lvup .confetti{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.lvup .confetti i{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;opacity:.95;animation:conffall 1.8s linear forwards}
@keyframes conffall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(105vh) rotate(540deg)}}
.lvup-title{font-family:'Orbitron',sans-serif;font-size:25px;font-weight:900;color:#fff;letter-spacing:3px;text-shadow:0 0 22px #d97757;margin-top:6px;animation:lvbounce .7s .08s both cubic-bezier(.2,1.4,.4,1)}
.lvup-rank{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:#d97757;letter-spacing:2px;margin-top:12px;border:1px solid #d9775766;border-radius:20px;padding:6px 18px;background:rgba(217,119,87,.08);animation:lvbounce .7s .16s both cubic-bezier(.2,1.4,.4,1)}
@keyframes lvbounce{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}
/* ── practice mode (listen + check) ── */
.practicebtn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;padding:12px;border-radius:13px;border:1px solid #d9775766;background: rgba(217,119,87,.12);color:#d97757;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;cursor:pointer;transition:all .2s}
.practicebtn:hover{border-color:#d97757;box-shadow:0 0 16px -4px #d97757;transform:translateY(-1px)}
.practicebtn:active{transform:scale(.98)}
.practicebtn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.practiceov{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;background:var(--bg);animation:fadein .25s}
.practicehdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #d9775733;background:var(--card2);flex-shrink:0;position:relative;z-index:1}
.practicehtitle{font-family:'Orbitron',sans-serif;font-size:12px;color:#d97757;letter-spacing:1.5px;display:flex;flex-direction:column;gap:3px}
.practicehtitle small{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:.5px;text-transform:none}
.practicebody{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:13px;position:relative;z-index:1}
.practicesrc{text-align:center;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:.5px;padding:8px;border-radius:9px;background:rgba(217,119,87,.06);border:1px solid #d9775722;color:var(--text2)}
.practicesrc.err{background:rgba(255,82,82,.08);border-color:#ff525233;color:#ff5252}
.practicenow{display:flex;align-items:center;justify-content:center;gap:30px;padding:4px 0}
.practicenow-box{text-align:center}
.practicenow-lbl{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:1px;margin-bottom:5px}
.practicenow-note{font-family:'Orbitron',sans-serif;font-size:36px;font-weight:900;line-height:1}
.practicenow-note.target{color:#d97757;text-shadow:0 0 18px #d9775777}
.practicenow-note.heard{color:var(--muted)}
.practicenow-note.heard.ok{color:#d97757;text-shadow:0 0 16px #d9775788}
.practicenow-note.heard.bad{color:#ff5252;text-shadow:0 0 16px #ff525288;animation:shake .3s}
.practicechips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.pchip{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;padding:6px 9px;border-radius:8px;border:1px solid var(--bd2);background:var(--card3);color:var(--muted);min-width:30px;text-align:center}
.pchip.done{background:rgba(217,119,87,.16);border-color:#d97757;color:#d97757}
.pchip.cur{border-color:#d97757;color:#d97757;box-shadow:0 0 12px -3px #d97757;animation:blink 1.2s infinite}
.practicebar{height:12px;border-radius:7px;background:var(--card3);border:1px solid var(--bd2);overflow:hidden}
.practicefill{height:100%;background: #d97757;box-shadow:0 0 10px -2px #d97757;transition:width .25s}
.practicestats{display:flex;justify-content:space-around;font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--text2)}
.practicestats b{font-family:'Orbitron',sans-serif;color:var(--text);font-size:15px}
.practicetip{text-align:center;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);line-height:1.6}
.practicefoot{display:flex;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #d9775733;background:var(--card2);flex-shrink:0;position:relative;z-index:1}
.practicefoot button{flex:1;padding:12px;border-radius:11px;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:1.5px;cursor:pointer;transition:all .2s;border:1px solid}
.practicerestart{border-color:#d9775755!important;background:rgba(217,119,87,.08);color:#d97757}
.practiceexit{border-color:#ff525255!important;background:rgba(255,82,82,.08);color:#d97757}
/* ── daily quest + achievements ── */
.questcard{background: var(--card2);border:1px solid #d9775744;border-radius:13px;padding:14px}
.questcard.done{background: var(--card3);border-color:#d9775755}
.questrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;gap:8px}
.questname{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;color:var(--text2);display:flex;align-items:center;gap:7px}
.questrew{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757;white-space:nowrap}
.questcard.done .questrew{color:#d97757}
.questbar{height:12px;border-radius:7px;background:var(--card3);border:1px solid var(--bd2);overflow:hidden}
.questfill{height:100%;border-radius:7px;background: #d97757;transition:width .5s}
.questcard.done .questfill{background: #d97757}
.questcount{text-align:right;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2);margin-top:6px}
.badgegrid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.badge{display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 4px;border-radius:12px;background:var(--card2);border:1px solid var(--bd3);text-align:center}
.badge.got{border-color:#d9775755;background: rgba(217,119,87,.12);box-shadow:0 0 14px -7px #d97757}
.badge-ic{font-size:23px;line-height:1.1;filter:grayscale(1) opacity(.38)}
.badge.got .badge-ic{filter:none}
.badge-nm{font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:600;line-height:1.2;color:var(--muted)}
.badge.got .badge-nm{color:#d97757}
/* badge unlock overlay (reuses .lvup container) */
.lvup-badge .lvup-burst{filter:drop-shadow(0 0 18px #d97757)}
.lvup-badge .lvup-title{color:#d97757;text-shadow:0 0 22px #d97757}
.lvup-badge .lvup-rank{color:#d97757;border-color:#d9775766;background:rgba(217,119,87,.1)}
/* ── play-along (falling notes) ── */
.songpage .pathbadge{color:#d97757;border-color:#d9775744}
.songgrid{display:flex;flex-direction:column;gap:11px;padding:4px 14px}
.songcard{display:flex;align-items:center;gap:13px;padding:14px;border-radius:15px;background:var(--card2);border:1px solid var(--bd1);border-left:3px solid var(--sc,#d97757);cursor:pointer;text-align:left;transition:all .2s;font-family:inherit}
.songcard:hover{border-color:var(--sc,#d97757);box-shadow:0 0 22px -10px var(--sc,#d97757);transform:translateY(-2px)}
.songcard:active{transform:scale(.99)}
.songcard-ic{font-size:26px;filter:drop-shadow(0 0 8px var(--sc,#d97757))}
.songcard-body{flex:1;min-width:0}
.songcard-nm{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text)}
.songcard-meta{display:flex;gap:11px;align-items:center;margin-top:3px;font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--muted)}
.songdiff{color:#d97757;letter-spacing:1px}
.songcard-go{font-size:15px;color:var(--sc,#d97757)}
.songov{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;background:var(--bg);animation:fadein .25s}
.songhdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--bd3);flex-shrink:0}
.songhtitle{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:9px}
.songhtitle small{color:#d97757;font-size:12px;letter-spacing:1px}
.vmhdrbtns{display:flex;align-items:center;gap:8px}
.songhud{display:flex;justify-content:space-around;gap:8px;padding:9px 14px;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text2);flex-shrink:0}
.songhud b{font-family:'Orbitron',sans-serif;color:#fff;font-size:15px}
.songhud .hot b{color:#d97757;text-shadow:0 0 10px #ff5252}
.songprog{height:5px;background:var(--card3);flex-shrink:0}
.songprog>div{height:100%;background: #d97757;transition:width .15s}
.songstage{position:relative;flex:1;min-height:0;overflow:hidden}
.songcanvas{width:100%;height:100%;display:block}
.songcount{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:90px;font-weight:900;color:#fff;text-shadow:0 0 40px #d97757;animation:popcount .9s ease-out;pointer-events:none}
.songjudge{position:absolute;left:0;right:0;top:38%;text-align:center;font-family:'Orbitron',sans-serif;font-size:34px;font-weight:900;pointer-events:none;animation:judgepop .65s ease-out forwards;text-shadow:0 0 24px currentColor}
.songjudge.perfect{color:#d97757}
.songjudge.good{color:#d97757}
.songjudge.miss{color:#ff5252;font-size:26px}
@keyframes judgepop{0%{transform:scale(.5) translateY(10px);opacity:0}25%{transform:scale(1.15) translateY(0);opacity:1}70%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(.9) translateY(-22px);opacity:0}}
.songnewbest{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:800;color:#d97757;text-shadow:0 0 16px #d9775788;animation:popcount .6s ease-out}
/* game juice: shake, GO!, particle bursts, combo meter, full-combo banner */
.songstage.shake{animation:shake .38s cubic-bezier(.36,.07,.19,.97)}
@keyframes shake{10%{transform:translate(-2px,1px)}20%{transform:translate(3px,-2px)}30%{transform:translate(-4px,2px)}40%{transform:translate(4px,1px)}50%{transform:translate(-3px,-1px)}60%{transform:translate(3px,2px)}70%{transform:translate(-2px,-2px)}80%{transform:translate(2px,1px)}100%{transform:translate(0,0)}}
.songgo{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:64px;font-weight:900;color:#d97757;text-shadow:0 0 40px #d97757;pointer-events:none;animation:goflash .7s ease-out forwards}
@keyframes goflash{0%{transform:scale(.4);opacity:0}30%{transform:scale(1.1);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.4);opacity:0}}
.burst{position:absolute;left:50%;top:42%;width:0;height:0;pointer-events:none;z-index:5}
.burst i{position:absolute;left:0;top:0;width:9px;height:9px;border-radius:50%;background:#d97757;box-shadow:0 0 8px currentColor;color:#d97757;transform:rotate(var(--a)) translateY(0);animation:burstfly .72s ease-out forwards}
.burst.combo i{width:11px;height:11px;background:#d97757;color:#d97757}
@keyframes burstfly{0%{opacity:1;transform:rotate(var(--a)) translateY(0) scale(1)}100%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d) * -1)) scale(.3)}}
.combostat b{transition:color .2s}
.combostat .comboflame{display:inline-block;margin-left:2px;animation:flamepulse .6s ease-in-out infinite alternate}
.combostat.t1 b{color:#ffb8d0}.combostat.t2 b{color:#ff94e0}.combostat.t3 b{color:#ff76d8}.combostat.t4 b{color:#ff3d6e;text-shadow:0 0 12px #ff3d6e}
.combostat.t2 .comboflame{transform:scale(1.15)}.combostat.t3 .comboflame{transform:scale(1.35)}.combostat.t4 .comboflame{transform:scale(1.6)}
@keyframes flamepulse{from{filter:brightness(1)}to{filter:brightness(1.5)}}
.songfc{font-family:'Orbitron',sans-serif;font-size:18px;font-weight:900;letter-spacing:2px;color:#d97757;text-shadow:0 0 20px #d97757;animation:popcount .7s ease-out}
.songfc.ap{color:#d97757;text-shadow:0 0 22px #d9775766}
.ghoststat{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700}
.ghoststat.ahead{color:#d97757}
.ghoststat.behind{color:#ff5252}
@keyframes popcount{from{transform:scale(1.6);opacity:0}30%{opacity:1}to{transform:scale(1);opacity:.9}}
/* page transitions */
.pw,.pathpage,.profpage{animation:pagein .28s ease-out}
@keyframes pagein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
/* coins pill + daily chest + mascot */
.coinpill{display:flex;align-items:center;gap:3px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757;background:var(--grad1);border:1px solid #d977573d;border-radius:20px;padding:4px 9px}
.probadge{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:800;color:var(--card2);background: #d97757;border-radius:20px;padding:4px 9px;letter-spacing:.5px;white-space:nowrap}
.probadge.fam{background: #d97757}
.probadge.max{background: #d97757;color:#fff}
.probadge.maxfam{background: #d97757;color:#fff}
.billtoggle{display:flex;gap:8px;background:var(--card);border-radius:24px;padding:4px;margin-bottom:14px}
.billtog{flex:1;padding:9px;border-radius:20px;background:transparent;border:none;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.billtog.on{background: #d97757;color:#fff}
.billsave{font-family:'Orbitron',sans-serif;font-size:9px;background:#d97757;color:var(--grad1);border-radius:8px;padding:2px 5px}
.pr-yrsave{color:#d97757;font-size:12px;font-weight:700;margin:-4px 0 8px}
.upbtn{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:800;color:var(--card2);background: #d97757;border:none;border-radius:20px;padding:5px 10px;cursor:pointer;animation:flamepulse 1.4s ease-in-out infinite alternate}
.setcard.pricing{max-width:420px}
.pr-sub{font-family:'Rajdhani',sans-serif;font-size:14px;color:var(--muted);text-align:center;margin:0 0 14px}
.prtier{border:1px solid var(--bd2);border-radius:14px;padding:13px 14px;margin-bottom:11px;background:var(--card3)}
.prtier.hot{border-color:#d97757;box-shadow:0 0 22px -8px #d97757;background:var(--card3)}
.prtier.max{border-color:#d97757;box-shadow:0 0 22px -8px #d97757;background:var(--card3)}
.prtier.max .prtier-price{color:#d97757}
.prtier.maxfam{border-color:#d97757;box-shadow:0 0 26px -8px #d97757;background:var(--card3)}
.prtier.maxfam .prtier-price{color:#d97757}
.prtier.cur{outline:2px solid #d97757;outline-offset:1px}
.prtier.free{opacity:.85}
.prtier-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.prtier-nm{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:800;color:var(--text)}
.prtier-price{font-family:'Orbitron',sans-serif;font-size:20px;font-weight:900;color:#d97757}
.prtier-price small{font-size:11px;color:var(--muted);font-weight:600}
.paysum{display:flex;align-items:center;justify-content:space-between;padding:6px 0 12px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:var(--text)}
.payqr{display:block;width:230px;max-width:74%;margin:4px auto 12px;border-radius:14px;background:#fff;padding:10px}
.payinfo{background:var(--card);border:1px solid var(--bd2);border-radius:12px;padding:11px 13px;display:flex;flex-direction:column;gap:5px;font-size:13.5px;color:var(--text2);margin-bottom:10px}
.payinfo b{color:var(--text);font-family:'Share Tech Mono',monospace}
.payok{text-align:center;padding:10px 4px}
.payok-h{font-family:'Orbitron',sans-serif;font-size:17px;font-weight:800;color:#d97757;margin:6px 0 8px}
.sharebtn{width:100%;padding:12px;border-radius:12px;border:none;color:#fff;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;cursor:pointer;margin-top:9px;display:flex;align-items:center;justify-content:center;gap:6px}
.sharebtn.fb{background:#1877f2}
.sharebtn.tk{background:linear-gradient(90deg,#25f4ee,#000,#fe2c55)}
.sharebtn.done{opacity:.7;box-shadow:inset 0 0 0 2px #d97757}
.sharebtn:active{transform:scale(.97)}
.adminpay{flex:1;min-height:0;overflow-y:auto;padding:10px 14px 28px}
.adminpay-cfg{background:var(--card3);border:1px solid #ff525233;border-radius:13px;padding:12px;margin-bottom:14px}
.anrow{display:flex;align-items:center;gap:8px;padding:6px 0;font-family:'Rajdhani',sans-serif}
.anrow-rank{color:var(--muted);font-size:11px;font-family:'Orbitron',sans-serif;width:22px;flex-shrink:0}
.anrow-name{color:var(--text2);font-size:13px;flex-shrink:0;width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.anrow-barwrap{flex:1;height:8px;background:var(--card3);border-radius:4px;overflow:hidden}
.anrow-bar{display:block;height:100%;background: #d97757;border-radius:4px}
.anrow-hits{color:#d97757;font-family:'Orbitron',sans-serif;font-size:12px;width:34px;text-align:right;flex-shrink:0}
.adminpay-cfg input{width:100%;background:var(--card3);border:1px solid #ffffff18;border-radius:9px;padding:9px 11px;color:var(--text2);font-size:13.5px;margin-top:7px;box-sizing:border-box}
.adminpay-row{display:flex;align-items:center;gap:11px;background:var(--card3);border:1px solid var(--bd1);border-radius:13px;padding:11px 13px;margin-bottom:8px;text-align:left;width:100%;cursor:pointer}
.adminpay-row.pending{border-color:#d9775755}
.adminpay-row.approved{opacity:.6}
.adminpay-badge{font-size:9px;font-family:'Orbitron',sans-serif;padding:3px 7px;border-radius:6px}
.adminpay-badge.pending{background:#d97757;color:var(--grad1)}
.adminpay-badge.approved{background:#d97757;color:var(--grad1)}
.adminpay-badge.rejected{background:#d97757;color:var(--grad1)}
.payslip{width:100%;max-width:320px;display:block;margin:10px auto;border-radius:12px;border:1px solid #ffffff1c}
.aibox{background:var(--card);border:1px solid #d9775755;border-radius:11px;padding:10px 12px;font-size:13px;color:var(--text2);white-space:pre-wrap;margin:8px 0}
.prfeat{list-style:none;margin:0 0 11px;padding:0;display:flex;flex-direction:column;gap:5px}
.prfeat li{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text2)}
.prtier .songbtn{width:100%}
.pr-note{text-align:center;font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--muted);margin:6px 0 12px}
.pr-school{width:100%;padding:11px;border-radius:12px;border:1px dashed #d9775744;background:transparent;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
/* parent dashboard */
.pd-head{font-family:'Rajdhani',sans-serif;font-size:15px;color:var(--text);text-align:center;margin-bottom:12px}
.pd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:6px}
.pd-stat{background:var(--card);border:1px solid var(--bd3);border-radius:10px;padding:9px 4px;text-align:center}
.pd-num{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:800;color:#d97757}
.pd-lbl{font-family:'Rajdhani',sans-serif;font-size:9.5px;color:var(--muted);margin-top:2px}
.pd-sec{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:var(--text2);letter-spacing:.5px;margin:14px 0 7px}
.pd-tags{display:flex;flex-wrap:wrap;gap:6px}
.pd-tag{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600;border-radius:8px;padding:4px 9px}
.pd-tag.focus{color:#d97757;background:rgba(217,119,87,.12);border:1px solid #d9775733}
.pd-tag.good{color:#d97757;background:rgba(217,119,87,.1);border:1px solid #d9775733}
.atdash-last{margin-top:10px;border:1px solid var(--bd1);border-radius:12px;padding:11px 12px;background:var(--card3)}
.atdash-last-w{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:#d97757;margin-bottom:3px}
.atdash-last-t{font-family:'Rajdhani',sans-serif;font-size:12.5px;color:var(--muted);line-height:1.5}
.atdash-last-d{font-family:'Share Tech Mono',monospace;font-size:9.5px;color:var(--muted);margin-top:6px;letter-spacing:.5px}
.atdash-empty{font-family:'Rajdhani',sans-serif;font-size:12.5px;color:var(--muted);margin-top:8px}
/* exam prep */
.exgrade{border:1px solid var(--bd1);border-radius:13px;padding:12px 13px;margin-bottom:11px;background:var(--card3)}
.exgrade-top{display:flex;justify-content:space-between;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:var(--text);margin-bottom:7px}
.extasks{display:flex;flex-direction:column;gap:5px;margin-top:9px}
.extask{display:flex;align-items:center;gap:8px;text-align:left;background:var(--card);border:1px solid var(--bd3);border-radius:9px;padding:9px 11px;color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer}
.extask span{color:var(--muted);font-weight:800}
.extask.ok{border-color:#d977574d;color:#d97757}
.extask.ok span{color:#d97757}
.chestbtn{background:none;border:none;font-size:20px;cursor:pointer;animation:chestwiggle 1.4s ease-in-out infinite;padding:2px 4px}
@keyframes chestwiggle{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-12deg) scale(1.1)}75%{transform:rotate(12deg) scale(1.1)}}
.chestov{position:fixed;inset:0;z-index:1400;background:rgba(9,4,8,.82);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadein .2s}
.chestcard{text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
.chestbig{font-size:96px;filter:drop-shadow(0 0 30px #d97757)}
.chestbig.opening{animation:chestshake .5s ease-in-out infinite}
.chestbig.open{animation:chestpop .5s ease-out}
@keyframes chestshake{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes chestpop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
.chesttitle{font-family:'Orbitron',sans-serif;font-size:18px;font-weight:800;color:#fff}
.chestrewards{display:flex;gap:18px;font-family:'Orbitron',sans-serif;font-size:18px;font-weight:700;color:#d97757}
.chestrewards span:last-child{color:#d97757}
.cheststreak{font-family:'Rajdhani',sans-serif;font-size:14px;color:#d97757}
.chesttitle.jackpot{color:#d97757;font-size:24px;text-shadow:0 0 22px #d97757;animation:popcount .6s ease-out}
.songbonus{position:absolute;left:0;right:0;top:28%;text-align:center;font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;color:#d97757;text-shadow:0 0 18px #d97757;pointer-events:none;animation:judgepop .9s ease-out forwards;z-index:6}
/* fever mode + flying score popups + combo shouts (dopamine) */
.feverbg{position:absolute;inset:0;pointer-events:none;z-index:1;opacity:.5;background:linear-gradient(125deg,#ff5252,#ffd23f,#d97757,#6a9bcc,#788c5d,#ff5252);background-size:400% 400%;animation:feverflow 2.2s linear infinite;mix-blend-mode:screen}
@keyframes feverflow{0%{background-position:0% 50%}100%{background-position:400% 50%}}
.songstage.fever{box-shadow:inset 0 0 60px -10px #ff5252}
.feverbadge{position:absolute;top:8px;left:50%;transform:translateX(-50%);font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;color:#fff;text-shadow:0 0 14px #ff5252;z-index:6;animation:flamepulse .4s ease-in-out infinite alternate;pointer-events:none}
.songpop{position:absolute;top:62%;font-family:'Orbitron',sans-serif;font-size:18px;font-weight:800;color:var(--text2);text-shadow:0 2px 6px #000;pointer-events:none;animation:popfly .78s ease-out forwards;z-index:5}
.songpop.perfect{font-size:24px;color:#d97757;text-shadow:0 0 14px #d97757}
@keyframes popfly{0%{opacity:0;transform:translateY(8px) scale(.7)}25%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:0;transform:translateY(-60px) scale(1)}}
.songannounce{position:absolute;left:0;right:0;top:20%;text-align:center;font-family:'Orbitron',sans-serif;font-size:30px;font-weight:900;letter-spacing:1px;pointer-events:none;z-index:6;color:#d97757;text-shadow:0 0 20px #d9775766;animation:announcepop 1.1s ease-out forwards}
@keyframes announcepop{0%{transform:scale(.4) rotate(-8deg);opacity:0}20%{transform:scale(1.2) rotate(3deg);opacity:1}40%{transform:scale(1) rotate(0)}80%{opacity:1}100%{transform:scale(1.1);opacity:0}}
/* daily hook hub (home) */
.dailyhub{display:flex;align-items:stretch;gap:10px;margin:10px 12px 4px;padding:11px 13px;border-radius:15px;background:var(--card3);border:1px solid var(--bd2)}
.dailyhub.atrisk{border-color:#d9775766;box-shadow:0 0 18px -8px #d97757}
.dh-streak{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:56px;position:relative}
.dh-flame{font-size:26px;line-height:1;animation:flamepulse .8s ease-in-out infinite alternate}
.dh-streaknum{font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;color:#d97757;line-height:1;margin-top:-4px}
.dh-streaklbl{font-family:'Rajdhani',sans-serif;font-size:9px;color:var(--muted);letter-spacing:.5px}
.dh-mid{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px}
.dh-goal-top{display:flex;justify-content:space-between;align-items:baseline;font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:600;color:var(--text2)}
.dailyhub.atrisk .dh-goal-top span{color:#d97757}
.dh-goal-top b{font-family:'Orbitron',sans-serif;font-size:11px;color:#d97757}
.dh-goalbar{height:8px;border-radius:5px;background:var(--card2);overflow:hidden}
.dh-goalbar div{height:100%;border-radius:5px;background: #d97757;transition:width .5s}
.dh-actions{display:flex;gap:8px;align-items:center;min-height:18px}
.dh-freeze{font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;color:#d97757}
.dh-buyfreeze{font-family:'Rajdhani',sans-serif;font-size:10.5px;font-weight:700;color:var(--muted);background:var(--card2);border:1px solid var(--bd2);border-radius:14px;padding:3px 9px;cursor:pointer}
.dh-buyfreeze:active{transform:scale(.95)}
.dh-chest{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:62px;border-radius:12px;border:none;cursor:pointer;background: #d97757;color:var(--card2);font-size:24px;padding:6px}
.dh-chest span{font-family:'Orbitron',sans-serif;font-size:8.5px;font-weight:800;letter-spacing:.3px}
.dh-chest:not(.done){animation:chestwiggle 1.4s ease-in-out infinite}
.dh-chest.done{background: #d97757}
.dh-chest:active{transform:scale(.95)}
.dailyrec{display:flex;align-items:center;gap:8px;margin:6px 12px 0;padding:9px 13px;width:calc(100% - 24px);border-radius:13px;border:1px solid #d9775733;background:var(--card3);cursor:pointer;text-align:left}
.dailyrec:active{transform:scale(.99)}
.dailyrec-lbl{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:800;letter-spacing:.5px;color:#d97757;flex-shrink:0}
.dailyrec-ic{font-size:18px;flex-shrink:0}
.dailyrec-txt{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dailyrec-go{color:#d97757;font-weight:800;flex-shrink:0}
/* quick "change key" back button on the Sensei page — returns to Pathway with
   the same topic's key picker already open, instead of a ☰-menu round trip */
.senseiback{display:flex;align-items:center;gap:6px;margin:8px 12px 0;padding:8px 13px;border-radius:20px;border:1px solid #d9775744;background:rgba(217,119,87,.08);color:var(--text2);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer;align-self:flex-start}
.senseiback:active{transform:scale(.97);background:rgba(217,119,87,.16)}
.senseiback span:first-child{font-size:15px}
.hwbar{display:flex;align-items:center;gap:9px;margin:6px 12px 0;padding:9px 13px;width:calc(100% - 24px);border-radius:13px;border:1px solid #d9775733;background:var(--card3)}
.hwbar-ic{font-size:17px;flex-shrink:0}
.hwbar-tx{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hwbar-tx b{color:#d97757;font-weight:800}
.hwbar-done{flex-shrink:0;width:28px;height:28px;border-radius:50%;border:1px solid #d9775766;background:var(--card3);color:#d97757;font-weight:800;cursor:pointer}
.hwbar-done:active{transform:scale(.9)}
.setcard.wlc{max-width:380px;padding:24px 22px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.wlc-mascot{font-size:62px;animation:mascotidle 2.4s ease-in-out infinite}
.wlc-title{font-family:'Orbitron',sans-serif;font-size:18px;font-weight:800;color:var(--text)}
.wlc-tips{display:flex;flex-direction:column;gap:11px;width:100%}
.wlc-tip{display:flex;align-items:center;gap:11px;text-align:left;background:var(--card);border:1px solid var(--bd1);border-radius:12px;padding:11px 13px}
.wlc-tip span{font-size:24px;flex-shrink:0}
.wlc-tip b{font-family:'Rajdhani',sans-serif;font-size:13.5px;font-weight:600;color:var(--text2)}
.mascot{position:fixed;right:12px;bottom:84px;z-index:900;cursor:pointer;animation:mascotidle 2.6s ease-in-out infinite;will-change:transform}
.mascot-face{font-size:38px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}
.mascot.happy{animation:mascothop .5s ease-out}
.mascot.celebrate{animation:mascotcheer .6s ease-out infinite}
.mascot-spark{position:absolute;top:-6px;right:-6px;font-size:18px;animation:flamepulse .5s ease-in-out infinite alternate}
@keyframes mascotidle{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes mascothop{0%{transform:translateY(0)}40%{transform:translateY(-16px)}100%{transform:translateY(0)}}
@keyframes mascotcheer{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-12px) rotate(6deg)}}
/* cosmetics shop + key-skins + themes */
.shopsec{display:flex;align-items:center;gap:8px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:var(--text2);letter-spacing:1px;margin:16px 0 8px}
.shopsec:first-child{margin-top:0}
.shopgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.shopitem{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 6px 10px;border-radius:12px;border:1px solid var(--bd2);background:var(--card);color:var(--text2);cursor:pointer}
.shopitem:active{transform:scale(.96)}
.shopitem.equipped{border-color:#d97757;box-shadow:0 0 0 1px #d97757,0 0 14px -4px #d97757}
/* rarity border tint — common stays neutral, higher tiers get a colored ring so
   pricier items visibly look more special even before reading the coin cost */
.shopitem.rare{border-color:#6a9bcc77}
.shopitem.epic{border-color:#a855f777;box-shadow:0 0 10px -4px #a855f7aa}
.shopitem.legendary{border-color:#ffd23f;box-shadow:0 0 14px -3px #ffd23faa}
.shopitem.legendary.equipped{border-color:#d97757;box-shadow:0 0 0 1px #d97757,0 0 16px -3px #d97757}
.shopitem-new{position:absolute;top:-6px;right:-6px;background:#d97757;color:#fff;font-family:'Orbitron',sans-serif;font-size:7.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:8px;box-shadow:0 2px 6px -2px #d97757;z-index:1}
.shopitem-swwrap{position:relative;width:36px;height:36px;flex-shrink:0}
.shopitem-sw{display:block;width:36px;height:36px;border-radius:50%;border:1.5px solid var(--bd4)}
.shopitem-ic{position:absolute;bottom:-3px;right:-3px;font-size:14px;line-height:1;background:var(--card);border-radius:50%;padding:1px}
.shopitem-nm{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600}
.shopitem-rare{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.5px;color:var(--muted);text-transform:uppercase}
.shopitem-tag{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757}
.shopitem.equipped .shopitem-tag{color:#d97757}
body[data-skin="sunset"] .pk.w.lit{background:linear-gradient(180deg,#ff9e00,#ff5d3a 40%,#fff);box-shadow:0 0 16px #ff7a3d,0 0 40px #ff7a3d66}
body[data-skin="sunset"] .pk.b.lit{background:linear-gradient(180deg,#ff9e00,#a83200);box-shadow:0 0 14px #ff7a3d}
body[data-skin="neon"] .pk.w.lit{background:linear-gradient(180deg,#06ffa5,#00d488 40%,#fff);box-shadow:0 0 16px #06ffa5,0 0 40px #06ffa566}
body[data-skin="neon"] .pk.b.lit{background:linear-gradient(180deg,#06ffa5,#04694a);box-shadow:0 0 14px #06ffa5}
body[data-skin="candy"] .pk.w.lit{background:linear-gradient(180deg,#ff76d8,#ff94e0 40%,#fff);box-shadow:0 0 16px #ff76d8,0 0 40px #ff76d866}
body[data-skin="candy"] .pk.b.lit{background:linear-gradient(180deg,#ff76d8,#cc1b7a);box-shadow:0 0 14px #ff76d8}
body[data-skin="gold"] .pk.w.lit{background:linear-gradient(180deg,#ffd23f,#e0a800 40%,#fff6d8);box-shadow:0 0 16px #ffd23f,0 0 40px #ffd23f66}
body[data-skin="gold"] .pk.b.lit{background:linear-gradient(180deg,#ffd23f,#9a7400);box-shadow:0 0 14px #ffd23f}
body[data-skin="ocean"] .pk.w.lit{background:linear-gradient(180deg,#00d4ff,#0077b6 40%,#fff);box-shadow:0 0 16px #00d4ff,0 0 40px #00d4ff66}
body[data-skin="ocean"] .pk.b.lit{background:linear-gradient(180deg,#00d4ff,#023e5c);box-shadow:0 0 14px #00d4ff}
body[data-skin="ice"] .pk.w.lit{background:linear-gradient(180deg,#d0f4ff,#7dd3ec 40%,#fff);box-shadow:0 0 16px #a5f3fc,0 0 40px #a5f3fc66}
body[data-skin="ice"] .pk.b.lit{background:linear-gradient(180deg,#a5f3fc,#0891b2);box-shadow:0 0 14px #a5f3fc}
body[data-skin="fire"] .pk.w.lit{background:linear-gradient(180deg,#ff6b35,#c1121f 40%,#fff);box-shadow:0 0 16px #ff6b35,0 0 40px #ff6b3566}
body[data-skin="fire"] .pk.b.lit{background:linear-gradient(180deg,#ff6b35,#6b0f16);box-shadow:0 0 14px #ff6b35}
body[data-skin="galaxy"] .pk.w.lit{background:linear-gradient(180deg,#c084fc,#7c3aed 40%,#fff);box-shadow:0 0 16px #a855f7,0 0 40px #a855f766}
body[data-skin="galaxy"] .pk.b.lit{background:linear-gradient(180deg,#a855f7,#4c1d95);box-shadow:0 0 14px #a855f7}
/* Prism is the one legendary skin allowed to keep a moving multi-hue gradient —
   unlike the app's own default styling, a purchased cosmetic's whole value is
   looking different/special, so this is exempt from the one-flat-pink rule. */
body[data-skin="prism"] .pk.w.lit,body[data-skin="prism"] .pk.b.lit{background:linear-gradient(180deg,#ff5252,#ffd23f,#06ffa5,#00d4ff,#a855f7,#ff76d8);background-size:100% 400%;animation:prismshift 3s linear infinite;box-shadow:0 0 16px #d97757,0 0 40px #d9775766}
@keyframes prismshift{0%{background-position:50% 0%}100%{background-position:50% 400%}}
/* Shop-purchased cosmetic backgrounds only apply in dark mode — a light-mode choice
   must always win, so equipping Aurora/Ember/Forest can't force a dark screen back on. */
html[data-theme="dark"] body[data-theme="aurora"] .tg{background:radial-gradient(120% 90% at 30% 0%,#0b2a3a,#0a1326 60%,#070a16)}
html[data-theme="dark"] body[data-theme="ember"] .tg{background:radial-gradient(120% 90% at 70% 0%,var(--grad1),#180b10 55%,#0a0708)}
html[data-theme="dark"] body[data-theme="forest"] .tg{background:radial-gradient(120% 90% at 40% 0%,#0c2a1c,#0a1a16 60%,#070f0c)}
html[data-theme="dark"] body[data-theme="sakura"] .tg{background:radial-gradient(120% 90% at 50% 0%,#3a1a2e,#220f1c 55%,#120810)}
html[data-theme="dark"] body[data-theme="deepsea"] .tg{background:radial-gradient(120% 90% at 30% 0%,#052030,#031824 60%,#01080c)}
html[data-theme="dark"] body[data-theme="volcano"] .tg{background:radial-gradient(120% 90% at 60% 0%,#3a1005,#220a08 55%,#100403)}
html[data-theme="dark"] body[data-theme="starlight"] .tg{background:radial-gradient(120% 90% at 40% 0%,#1a0a3a,#12082a 55%,#08041a)}
.songready{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(5,9,16,.5);backdrop-filter:blur(2px);padding:20px;text-align:center}
.songready-info{font-family:'Rajdhani',sans-serif;font-size:15px;color:#ffcfe9}
.songtempo{display:flex;gap:8px}
.songtempobtn{padding:7px 15px;border-radius:10px;background:var(--card);border:1px solid #ffffff18;color:var(--muted);font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;cursor:pointer}
.songtempobtn.on{border-color:#d97757;color:#d97757;background:rgba(217,119,87,.08)}
.songready-btns{display:flex;gap:11px;flex-wrap:wrap;justify-content:center}
.songbtn{padding:12px 22px;border-radius:12px;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:1px solid}
.songbtn.go{background: #d97757;border-color:transparent;color:var(--card2);box-shadow:0 6px 22px -8px #d97757}
.songbtn.ghost{background:transparent;border-color:var(--bd5);color:var(--text2)}
.songbtn:active{transform:scale(.96)}
.songsrc{font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--muted)}
.songlanes{display:flex;gap:3px;padding:7px 4px;flex-shrink:0;background:#140812;border-top:1px solid #d9775722}
.songlane{flex:1;padding:13px 2px;border-radius:9px;border:1px solid hsla(var(--lh,332),70%,55%,.4);background:hsla(var(--lh,332),70%,50%,.1);color:hsla(var(--lh,332),85%,76%,1);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer}
.songlane:active{background:hsla(var(--lh,332),80%,55%,.35);transform:translateY(1px)}
/* responsive game keyboard — fills full width on any device */
.gpwrap{flex-shrink:0;background:#140812;border-top:1px solid #d9775722;padding:4px 0 calc(4px + env(safe-area-inset-bottom,0px))}
.gprow{position:relative;display:flex;gap:2px;width:100%;max-width:1200px;margin:0 auto;padding:0 4px;height:clamp(54px,11vh,140px)}
.gpw{flex:1;min-width:0;height:100%;background: #ffffff;border:1px solid #d4cfc5;border-top:none;border-radius:0 0 6px 6px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;cursor:pointer;box-shadow:0 3px 5px rgba(0,0,0,.4);transition:filter .08s,transform .05s;-webkit-tap-highlight-color:transparent}
.gpw span{font-family:'Share Tech Mono',monospace;font-size:clamp(8px,1.7vw,14px);color:var(--muted);pointer-events:none}
.gpw:active{transform:translateY(2px)}
.gpw.lit{background:#d97757;box-shadow:0 0 16px #d97757,0 0 38px #d9775766}
.gpb{position:absolute;top:0;height:62%;background:var(--card3);border:1px solid var(--card3);border-radius:0 0 5px 5px;z-index:2;cursor:pointer;box-shadow:0 4px 8px rgba(0,0,0,.8);-webkit-tap-highlight-color:transparent}
.gpb:active{transform:translateY(1px)}
.gpb.lit{background:#d97757;box-shadow:0 0 14px #d97757}
.gpw.flash{animation:keypop .32s ease-out}
.gpb.flash{animation:keypop .32s ease-out}
/* realistic, slidable keyboard (voice mode): taller keys, swipe to reach octaves */
.gpscroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:thin}
.gpscroll::-webkit-scrollbar{height:5px}
.gpscroll::-webkit-scrollbar-thumb{background:#d9775755;border-radius:3px}
.gpscroll .gprow{height:clamp(118px,23vh,188px);gap:2px}
.gpscroll .gpw span{font-size:10px}
/* song library: filters, favorites, continue */
.songfilters{display:flex;gap:7px;overflow-x:auto;padding:0 14px 10px;scrollbar-width:none}
.songfilters::-webkit-scrollbar{display:none}
.songfilter{flex:0 0 auto;padding:7px 14px;border-radius:20px;border:1px solid var(--bd2);background:var(--card);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.songfilter.on{background: #d97757;color:var(--card2);border-color:transparent}
.drillhint{padding:0 16px 10px;margin:0;color:var(--muted);font-size:12.5px;line-height:1.45}
.songcontinue{padding:0 14px 4px}
.songcontinue-lbl{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757;letter-spacing:1px;margin-bottom:6px}
.songcard{position:relative}
.favbtn{position:absolute;top:7px;right:34px;font-size:18px;line-height:1;color:var(--muted);background:none;border:none;cursor:pointer;padding:4px;z-index:2}
.favbtn.on{color:#d97757;text-shadow:0 0 10px #d9775766}
.songempty{grid-column:1/-1;text-align:center;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:14px;padding:24px}
.aicreate{display:block;width:calc(100% - 28px);margin:0 14px 10px;padding:11px;border-radius:13px;border:1px solid #d9775755;background:var(--card3);color:var(--text);font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
.aicreate:active{transform:scale(.99)}
.aicreate-hint{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--muted);margin:0 0 10px;line-height:1.4}
.aicreate-in{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:11px;border:1px solid var(--bd4);background:var(--card2);color:var(--text);font-family:'Rajdhani',sans-serif;font-size:15px}
.aicreate-in:focus{outline:none;border-color:#d97757}
.aicreate-err{color:#ff5252;font-family:'Rajdhani',sans-serif;font-size:12px;margin-top:8px}
.favbtn.del{color:#ff5252;font-size:15px}
.songcard.locked{opacity:.55;filter:grayscale(.5)}
.songcard.locked .songcard-meta span:last-child{color:#d97757}
/* record & playback bar (main keyboard) */
.recbar{display:flex;align-items:center;justify-content:center;gap:9px;padding:2px 8px 10px}
.recbtn{padding:8px 18px;border-radius:20px;border:1px solid var(--bd4);background:var(--card);color:var(--text2);font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer}
.recbtn.on{background: #ff5252;color:#fff;border-color:transparent;animation:metblink 1.1s steps(2) infinite}
.recbtn.ghost{background:transparent}
.recbtn.ai{background: #d97757;color:var(--card2);border-color:transparent}
.recbtn:disabled{opacity:.4;cursor:default}
.recbtn:active:not(:disabled){transform:scale(.96)}
.recdot{font-family:'Share Tech Mono',monospace;font-size:11px;color:#ff5252;font-weight:700}
.songsrcbar{text-align:center;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);padding:5px;flex-shrink:0}
.songresult{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;padding:24px;text-align:center}
.songstars{font-size:46px;color:#d97757;letter-spacing:6px;text-shadow:0 0 24px #d9775766;animation:popcount .6s ease-out}
.songresult-acc{font-family:'Orbitron',sans-serif;font-size:40px;font-weight:900;color:var(--text)}
.songresult-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;width:100%;max-width:300px}
.songresult-grid>div{background:var(--card);border:1px solid var(--bd1);border-radius:12px;padding:11px}
.songresult-grid span{display:block;font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--muted)}
.songresult-grid b{font-family:'Orbitron',sans-serif;font-size:18px;color:#d97757}
.songanalysis{width:100%;max-width:300px;text-align:left;background:var(--card);border:1px solid var(--bd1);border-radius:12px;padding:12px 13px}
.songanalysis-load{font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--muted);text-align:center;animation:flamepulse .8s ease-in-out infinite alternate}
.songanalysis-hd{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;letter-spacing:.4px;color:#d97757;margin-bottom:6px}
.songanalysis-weak{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px}
.songanalysis-steps{margin:0;padding-left:18px;font-family:'Rajdhani',sans-serif;font-size:12.5px;line-height:1.6;color:var(--text2)}
.songanalysis-steps li{margin-bottom:3px}
.studioback{position:absolute;left:12px;top:12px;background:rgba(255,255,255,.06);border:1px solid var(--bd4);color:var(--text2);border-radius:9px;padding:6px 12px;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer;z-index:2}
/* sight-reading */
.sightov .practicebody{align-items:stretch}
.staffwrap{background:var(--card2);border:1px solid var(--bd2);border-radius:16px;padding:14px 8px;margin:6px 0;transition:box-shadow .2s,border-color .2s}
.staffwrap.ok{border-color:#d97757;box-shadow:0 0 24px -8px #d97757}
.staffwrap.bad{border-color:#ff5252;box-shadow:0 0 24px -8px #ff5252}
.staffsvg{display:block;max-height:175px}
.clefsel{display:flex;gap:8px;justify-content:center;margin:8px 0 2px}
.clefbtn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:11px;border:1px solid var(--bd2);background:rgba(255,255,255,.03);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s}
.clefbtn .clefgly{font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1}
.clefbtn.on{color:#d97757;border-color:#d97757aa;background: rgba(217,119,87,.16);box-shadow:0 0 18px -8px #d97757}
.clefbtn:active{transform:scale(.96)}
.sighthint{text-align:center;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:600;color:var(--text2);min-height:22px;margin:4px 0 8px}
.sighthint.show{color:#d97757}
/* camera coach */
.camov .camstage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#04070d}
.camvideo,.camcanvas{position:absolute;max-width:100%;height:100%;width:auto;transform:scaleX(-1)}
.camcanvas{pointer-events:none}
.camoverlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:24px;background:rgba(4,8,14,.78);font-family:'Rajdhani',sans-serif;font-size:15px;color:#ffcfe9}
.camoverlay.err{color:#ff9ebd}
.camcoach{position:absolute;left:10px;right:10px;bottom:10px;max-height:55%;overflow-y:auto;background:rgba(8,14,26,.93);border:1px solid #d9775766;border-radius:14px;padding:13px 15px;backdrop-filter:blur(4px)}
.camcoach-load{font-family:'Rajdhani',sans-serif;font-size:14px;color:#d97757;text-align:center;animation:flamepulse .8s ease-in-out infinite alternate}
.camcoach-hd{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:#d97757;margin-bottom:6px}
.camcoach-tx{font-family:'Rajdhani',sans-serif;font-size:14px;line-height:1.5;color:var(--text);white-space:pre-wrap;margin-bottom:8px}
/* Auto Teaching real-time coaching card */
.atpopup{position:fixed;inset:0;z-index:1300;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,5,9,.72);backdrop-filter:blur(3px);animation:fadein .25s;padding:0 12px calc(14px + env(safe-area-inset-bottom,0px))}
.atpopup-card{width:100%;max-width:420px;background:var(--card);border:1px solid #d9775755;border-radius:18px;padding:16px 17px;box-shadow:0 -10px 34px -10px #000,0 0 26px -10px #d9775766;animation:installin .28s ease-out}
.atpopup-hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.atpopup-ic{font-size:20px}
.atpopup-tt{flex:1;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:.4px;color:#d97757}
.atpopup-x{background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:2px 4px}
.atpopup-weak{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-bottom:10px}
.atpopup-steps{margin:0 0 14px;padding-left:20px;font-family:'Rajdhani',sans-serif;font-size:14px;line-height:1.6;color:var(--text2)}
.atpopup-steps li{margin-bottom:4px}
.atpopup-ok{width:100%;background: #d97757;color:#fff;border:none;border-radius:12px;padding:11px;font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;cursor:pointer}
.camfoot-btns{display:flex;gap:8px;justify-content:center}
.cammsg{position:absolute;left:0;right:0;bottom:14px;text-align:center;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:#fff;text-shadow:0 2px 10px #000;padding:0 16px}
.camfoot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--bd3);flex-shrink:0}
/* leaderboard */
.lbmine{margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:11px;font-weight:400;color:#d97757}
.lblist{display:flex;flex-direction:column;gap:5px}
.lbpodium{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin-bottom:12px}
.lbpod{flex:1;max-width:108px;display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--card3);border:1px solid var(--bd1);border-radius:12px 12px 0 0;padding:10px 6px}
.lbpod.p1{padding-bottom:30px;border-color:#d9775766;box-shadow:0 0 18px -6px #d97757}
.lbpod.p2{padding-bottom:18px}
.lbpod.me{border-color:#d97757;background:var(--card3)}
.lbpod-medal{font-size:22px}
.lbpod-ava{width:34px;height:34px;border-radius:50%;background: #d97757;color:var(--card2);font-family:'Orbitron',sans-serif;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center}
.lbpod.p1 .lbpod-ava{width:42px;height:42px;font-size:18px}
.lbpod-nm{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:var(--text);max-width:96px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbpod-exp{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#d97757}
.lbtonext{text-align:center;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600;color:#d97757;margin-bottom:8px}
.wkrow{display:flex;align-items:center;gap:11px;padding:9px 4px}
.wkic{font-size:22px;flex-shrink:0}
.wkbody{flex:1;min-width:0}
.wktop{display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--text2);margin-bottom:4px}
.wktop b{color:#d97757;font-family:'Orbitron',sans-serif;font-size:11px}
.wkrow.done .wktop b{color:#d97757}
.wkbar{height:7px;border-radius:4px;background:var(--card);overflow:hidden}
.wkbar div{height:100%;border-radius:4px;background: #d97757;transition:width .4s}
.wkrow.done .wkbar div{background: #d97757}
.lbrow{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;background:var(--card);border:1px solid var(--bd6);animation:lbin .3s ease-out both}
@keyframes lbin{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
.lbrow.me{border-color:#d9775766;background:rgba(217,119,87,.08)}
.lbrank{min-width:26px;text-align:center;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:var(--muted)}
.lbrank.top{font-size:17px}
.lbname{flex:1;min-width:0;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbrow.me .lbname{color:#d97757}
.lbexp{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:#d97757;white-space:nowrap}
.lbexp small{font-size:9px;color:var(--muted)}
.lbempty{text-align:center;font-family:'Rajdhani',sans-serif;font-size:13px;color:var(--muted);padding:14px}
.songcard-badge{display:inline-block;margin-left:7px;font-family:'Orbitron',sans-serif;font-size:8px;font-weight:700;letter-spacing:1px;color:var(--card2);background:var(--sc,#d97757);border-radius:5px;padding:2px 5px;vertical-align:middle}
/* AI voice tutor */
.vmstage{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:12px 16px 6px;flex-shrink:0}
.vmorb{position:relative;width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;background:var(--card2);border:2px solid var(--bd4);transition:border-color .3s;cursor:pointer;padding:0;color:inherit;-webkit-tap-highlight-color:transparent}
.vmorb.listening{border-color:#d97757;animation:vmpulse 1.5s ease-out infinite}
.vmorb.thinking{border-color:#d97757;animation:vmspin 1.1s linear infinite}
.vmorb.speaking{border-color:#ff5252;box-shadow:0 0 30px -4px #ff5252;animation:vmwave .7s ease-in-out infinite alternate}
@keyframes vmpulse{0%{box-shadow:0 0 0 0 #d9775755}100%{box-shadow:0 0 0 30px #d9775700}}
@keyframes vmspin{to{transform:rotate(360deg)}}
@keyframes vmwave{from{transform:scale(1)}to{transform:scale(1.05)}}
.vmstate{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;color:var(--text2)}
.vmcaption{min-height:22px;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:600;color:var(--text);text-align:center;max-width:92%}
.vmnotes{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
.vmnote{font-family:'Share Tech Mono',monospace;font-size:12px;color:#d97757;background:rgba(217,119,87,.1);border:1px solid #d9775744;border-radius:7px;padding:3px 8px}
.vminstant{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:900;animation:vminst .65s ease-out forwards;pointer-events:none}
.vminstant.ok{color:#d97757;text-shadow:0 0 18px #d97757}
.vminstant.bad{color:#ff5252;text-shadow:0 0 18px #ff5252}
@keyframes vminst{0%{transform:scale(.5);opacity:0}25%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:0}}
.vmstaff{width:100%;max-width:360px;background:var(--card2);border:1px solid var(--bd2);border-radius:12px;padding:6px 6px 2px;margin:2px auto 0}
.vmstaff .staffsvg{max-height:120px}
.vmtextrow{display:flex;gap:6px;width:100%;max-width:420px;margin:0 auto}
.vmtextin{flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid var(--bd5);border-radius:12px;padding:9px 13px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:14px;outline:none}
.vmtextin:focus{border-color:#d97757aa}
.vmtextsend{flex-shrink:0;width:42px;border-radius:12px;border:1px solid #d97757aa;background: #d97757;color:#fff;font-size:15px;cursor:pointer}
.vmtextsend:active{transform:scale(.95)}
.vmlog{flex:1;min-height:118px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:10px 16px;width:100%;max-width:540px;margin:0 auto;scrollbar-width:thin;scrollbar-color:#d97757 var(--card3);box-sizing:border-box}
.vmbub{max-width:84%;padding:9px 13px;border-radius:14px;font-family:'Rajdhani',sans-serif;font-size:14px;line-height:1.4}
.vmbub.user{align-self:flex-end;background: #d97757;color:var(--card2);font-weight:600}
.vmbub.ai{align-self:flex-start;background:var(--card);border:1px solid var(--bd1);color:var(--text)}
.vmfoot{position:relative;display:flex;flex-direction:column;align-items:center;gap:9px;padding:11px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--bd3);flex-shrink:0}
/* ── ⋯ voice-settings popover (speed / voice tone / HQ / chord-ear live in here) ── */
.vmmorewrap{position:absolute;right:10px;bottom:calc(100% + 10px);z-index:40}
.vmmore{width:44px;height:44px;border-radius:50%;background:var(--card3);border:1px solid #ffffff26;color:var(--text2);font-size:22px;font-weight:900;line-height:1;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
.vmmore:active{transform:scale(.93)}
.vmmenu{position:absolute;bottom:52px;right:0;background:#130a10;border:1px solid #d9775755;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:250px;box-shadow:0 10px 34px rgba(0,0,0,.55);animation:dropdown .18s ease-out}
.vmmenu .vmspeed{justify-content:flex-start}
.vmmenu .vmvoicetgl{align-self:flex-start;margin-bottom:0}
.vmbig{padding:14px 42px;border-radius:40px;font-family:'Orbitron',sans-serif;font-size:15px;font-weight:700;cursor:pointer;border:none;color:var(--card2);background: #d97757;box-shadow:0 8px 26px -8px #d97757}
.vmbig.stop{background: #ff5252;box-shadow:0 8px 26px -8px #ff5252}
.vmbig:active{transform:scale(.96)}
.vmvoicetgl{align-self:center;font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:var(--text2);background:rgba(255,255,255,.05);border:1px solid var(--bd4);border-radius:14px;padding:4px 12px;cursor:pointer;margin-bottom:2px}
.vmvoicetgl:active{transform:scale(.95)}
.vmvoicetgl.on{color:#0a1020;background: #d97757;border-color:transparent}
.vmspeed{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center}
.vmspeed-lbl{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:var(--muted);margin-right:2px}
.vmspeed-b{font-family:'Share Tech Mono',monospace;font-size:11px;font-weight:700;color:var(--text2);background:rgba(255,255,255,.05);border:1px solid var(--bd4);border-radius:10px;padding:4px 9px;cursor:pointer;transition:all .15s}
.vmspeed-b.on{color:#d97757;border-color:#d97757aa;background: rgba(217,119,87,.22);box-shadow:0 0 14px -6px #d97757}
.vmspeed-b:active{transform:scale(.93)}
/* octave shift on the on-screen keyboard */
.octctl{display:flex;align-items:center;gap:6px;margin-left:auto;margin-right:8px}
.octbtn{width:26px;height:26px;border-radius:7px;border:1px solid #d9775733;background:var(--card);color:var(--text2);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.octbtn:disabled{opacity:.3;cursor:default}
.octbtn:active:not(:disabled){background:var(--grad1)}
.octlbl{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted);min-width:54px;text-align:center}
/* metronome quick pill in the header */
.metropill{display:flex;align-items:center;gap:3px;background: #d97757;color:var(--card2);border:none;border-radius:20px;padding:5px 11px;font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer;animation:metblink 1s steps(2) infinite}
@keyframes metblink{50%{opacity:.55}}
/* settings overlay */
.setov{position:fixed;inset:0;z-index:1300;background:rgba(9,4,8,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;animation:fadein .2s}
.setcard{width:100%;max-width:420px;max-height:88vh;overflow-y:auto;background:var(--card3);border:1px solid #d9775726;border-radius:18px;box-shadow:0 24px 60px -20px #000}
.sethdr{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid var(--bd3);font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:var(--text);position:sticky;top:0;background:var(--card3);z-index:1}
.setbody{padding:14px 16px 18px}
.setrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0}
.setrow.col{flex-direction:column;align-items:stretch;gap:8px}
.setrow.setbtns{justify-content:center;gap:8px}
.setrow label{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;color:var(--text2)}
.setrow input[type=range]{flex:1;max-width:200px;accent-color:#d97757}
.setdiv{height:1px;background:#ffffff0f;margin:6px 0}
.settoggle{min-width:64px;padding:7px 14px;border-radius:20px;border:1px solid var(--bd4);background:var(--card);color:var(--muted);font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;cursor:pointer}
.settoggle.on{background: #d97757;color:var(--card2);border-color:transparent}
.setbtn{min-width:48px;padding:9px 14px;border-radius:10px;border:1px solid #d977572e;background:var(--card);color:var(--text2);font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;cursor:pointer}
.setbtn.wide{flex:1}
.setbtn:active{transform:scale(.96)}
.setlangs{display:flex;gap:7px}
.setlangbtn{flex:1;padding:9px 6px;border-radius:10px;border:1px solid var(--bd2);background:var(--card);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;cursor:pointer}
.setlangbtn.on{background: #d97757;color:var(--card2);border-color:transparent}
.setsub{font-family:'Rajdhani',sans-serif;font-size:11.5px;color:var(--muted);line-height:1.4}
.setver{text-align:center;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);margin-top:14px;letter-spacing:1px}
/* progress dashboard (profile) */
.heatcard{background:var(--card2);border:1px solid var(--bd1);border-radius:14px;padding:13px 14px}
.heatgrid{display:grid;grid-template-rows:repeat(7,1fr);grid-auto-flow:column;grid-auto-columns:1fr;gap:3px}
.heatcell{width:100%;aspect-ratio:1;border-radius:2px;min-width:0}
.heatlegend{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:8px;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted)}
.heatlegend i{width:10px;height:10px;border-radius:2px;display:inline-block}
.trendwrap{margin-top:12px;border-top:1px solid var(--bd6);padding-top:10px}
.trendlbl{font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--muted);margin-bottom:4px}
.trendlbl b{color:#d97757;font-size:13px}
.trendsvg{width:100%;height:38px;display:block}
.trendempty{margin-top:10px;text-align:center;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--muted);padding:6px}
/* interactive progress dashboard */
.dashranges{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.dashrange{flex:1;min-width:48px;font-family:'Share Tech Mono',monospace;font-size:11px;font-weight:700;color:var(--text2);background:rgba(255,255,255,.05);border:1px solid var(--bd4);border-radius:9px;padding:7px 4px;cursor:pointer;transition:all .15s}
.dashrange.on{color:#d97757;border-color:#d97757aa;background: rgba(217,119,87,.22);box-shadow:0 0 14px -6px #d97757}
.dashrange:active{transform:scale(.95)}
.dashcards{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-bottom:13px}
.dashcard{background:var(--card2);border:1px solid var(--bd1);border-radius:12px;padding:11px 13px;position:relative}
.dashcard-v{font-family:'Orbitron',sans-serif;font-size:21px;font-weight:900;color:var(--text);line-height:1}
.dashcard-l{font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--muted);margin-top:3px}
.dashcard-d{position:absolute;top:10px;right:11px;font-family:'Share Tech Mono',monospace;font-size:10px;font-weight:700}
.dashcard-d.up{color:#d97757}
.dashcard-d.down{color:#ff5252}
.dashchart{background:var(--card2);border:1px solid var(--bd1);border-radius:12px;padding:11px 13px;margin-bottom:11px}
.dashchart-h{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--text2);margin-bottom:9px;display:flex;justify-content:space-between;align-items:center}
.dashtip{font-family:'Share Tech Mono',monospace;font-size:10px;color:#d97757}
.dashbars{display:flex;align-items:flex-end;gap:2px;height:78px}
.dashbar{flex:1;min-width:0;height:100%;display:flex;align-items:flex-end;background:none;border:none;padding:0;cursor:pointer}
.dashbar>span{display:block;width:100%;min-height:2px;border-radius:3px 3px 0 0;background: #d97757;transition:height .25s}
.dashbar.sel>span,.dashbar:active>span{background: #d97757;box-shadow:0 0 10px -2px #d97757}
.dashline{width:100%;height:46px;display:block}
.dashcards.three{grid-template-columns:repeat(3,1fr)}
.dashdetail{background:var(--card2);border:1px solid #d9775733;border-radius:12px;padding:11px 13px;margin-bottom:11px}
.dashdetail-h{font-family:'Orbitron',sans-serif;font-size:12px;font-weight:800;color:#d97757;margin-bottom:7px}
.dashdetail-stats{display:flex;flex-wrap:wrap;gap:12px;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--muted)}
.dashdetail-stats b{color:var(--text);font-size:14px}
.dashdetail-games{margin-top:9px;display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--bd3);padding-top:8px}
.dashgame-row{display:flex;justify-content:space-between;align-items:center;font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text2)}
.dashgame-row .dashgame-acc{font-family:'Share Tech Mono',monospace;color:#d97757;font-weight:700}
.dashgame-x{display:flex;gap:2px;margin-top:5px}
.dashgame-x span{flex:1;text-align:center;font-family:'Share Tech Mono',monospace;font-size:7.5px;color:var(--muted);overflow:hidden;white-space:nowrap}
/* accessibility & mobile ergonomics */
button,.pk,.songlane,.octbtn,.navbtn,a{touch-action:manipulation}
.octbtn{min-width:30px;min-height:30px}
.navbtn{color:var(--muted)}            /* lift inactive nav contrast */
.songsrcbar{color:var(--muted);font-size:11px}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
}
@media(max-width:480px){.lname{font-size:11px;letter-spacing:1px}.bbl{font-size:12px;padding:8px 11px}.pk.w{width:22px!important;height:66px!important}.pk.b{width:14px!important;height:42px!important;margin-left:-7px!important;margin-right:-7px!important}}
`;

function useInjectCSS() {
  const [ready, setReady] = useState(typeof document !== "undefined" && !!document.getElementById("tg-css"));
  useEffect(() => {
    if (document.getElementById("tg-css")) { setReady(true); return; }
    const s = document.createElement("style");
    s.id = "tg-css";
    s.textContent = CSS;
    document.head.appendChild(s);
    setReady(true);
  }, []);
  return ready;
}

/* ── Piano with finger numbers ── */
const Piano = memo(function Piano({ litNote = null, litSet = null, fingerMap = {}, small = false, onNote = null, baseOct = 4 }) {
  const wW = small ? 22 : 27, bW = small ? 14 : 17;
  const wH = small ? 66 : 78, bH = small ? 42 : 48;
  const keys = baseOct === 4 ? KEYS : keysFor(baseOct);
  const [flash, setFlash] = useState(null);
  const flashT = useRef(null);
  const press = (n) => {
    haptic(); playPianoNote(n); if (onNote) onNote(n);
    setFlash(n); clearTimeout(flashT.current); flashT.current = setTimeout(() => setFlash(null), 320);
  };
  return (
    <div className="kr" style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: "1px", overflowX: "auto", padding: "0 4px 20px" }}>
      {keys.map(k => {
        const lit = litNote === k.n || (litSet != null && litSet.includes(k.n));
        const finger = fingerMap[k.n];
        const style = k.t === "w"
          ? { width: wW, height: wH }
          : { width: bW, height: bH, marginLeft: -(bW / 2), marginRight: -(bW / 2) };
        return (
          <div key={k.n}
            className={`pk ${k.t}${lit ? " lit" : ""}${flash === k.n ? " flash" : ""}`}
            style={style}
            onClick={() => press(k.n)}>
            {k.t === "w" && <span className="kn">{k.l}</span>}
            {lit && finger != null && <span className="finger">{finger}</span>}
          </div>
        );
      })}
    </div>
  );
});

// Fluid, fully-responsive keyboard for the play-along game: white keys flex to
// fill the whole width (small on phones, large on tablets/desktop), black keys
// overlaid by percentage so it scales to any screen.
// Pixel sizes for the realistic, slidable keyboard (scroll mode).
const SP_WKW = 30, SP_GAP = 2, SP_BKW = 19; // white width, gap, black width
const GamePiano = memo(function GamePiano({ litNote = null, litSet = null, onNote = null, baseOct = 4, octs = 2, scroll = false, fullWidth = false }) {
  const [flash, setFlash] = useState(null);
  const flashT = useRef(null);
  const scrollerRef = useRef(null);
  const press = (n) => {
    haptic(); playPianoNote(n); if (onNote) onNote(n);
    setFlash(n); clearTimeout(flashT.current); flashT.current = setTimeout(() => setFlash(null), 320);
  };
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
            <button key={k.n} className={`gpw${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}`}
              style={{ flex: "none", width: SP_WKW }} onClick={() => press(k.n)} aria-label={k.n}>
              <span>{k.l === "C" ? k.n : k.l}</span>
            </button>
          ))}
          {blacks.map(k => (
            <button key={k.n} className={`gpb${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}`}
              style={{ left: (k.after + 1) * (SP_WKW + SP_GAP) - SP_BKW / 2 - 1, width: SP_BKW }}
              onClick={() => press(k.n)} aria-label={k.n} />
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
          <button key={k.n} className={`gpw${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}`} onClick={() => press(k.n)} aria-label={k.l}>
            <span>{k.l}</span>
          </button>
        ))}
        {blacks.map(k => (
          <button key={k.n} className={`gpb${isLit(k.n) ? " lit" : ""}${flash === k.n ? " flash" : ""}`}
            style={{ left: (((k.after + 1) / NW) * 100 - bw / 2) + "%", width: bw + "%" }}
            onClick={() => press(k.n)} aria-label={k.l} />
        ))}
      </div>
    </div>
  );
});

/* ── Speaker button (robust, with fallback message) ── */
const SpeakBtn = memo(function SpeakBtn({ text, lang, id, activeId, setActiveId }) {
  const lc = L[lang];
  const supported = ttsSupported();
  const isOn = activeId === id;

  function toggle() {
    if (isOn) {
      stopSpeaking();
      stopCloudTTS();
      setActiveId(null);
      return;
    }
    getAC(); // unlock audio inside the tap gesture (iOS Safari)
    setActiveId(id);
    // try the natural cloud voice first; fall back to the device voice on any error.
    // No alert popups — a failure just quietly resets the button (the old "blocked
    // in preview" alert was misleading on the live site and jarring).
    speakCloud(
      text, lang,
      null,                                   // onStart
      () => setActiveId(null),                // onDone
      () => {                                 // onError → device-voice fallback (silent)
        if (!supported) { setActiveId(null); return; }
        const ok = speakRobust(text, lang, () => setActiveId(null), () => setActiveId(null));
        if (!ok) setActiveId(null);
      }
    );
  }

  return (
    <button className={`spkbtn${isOn ? " on" : ""}`} onClick={toggle}
      title={supported ? lc.speak : lc.ttsNo} aria-label={supported ? lc.speak : lc.ttsNo}>
      <span className="spkwave" aria-hidden="true">
        <span /><span /><span /><span />
      </span>
      <span className="spktxt">{isOn ? lc.speaking : lc.speak}</span>
    </button>
  );
});

/* ── Message (memoized: only re-renders when its own props change) ── */
const Msg = memo(function Msg({ m, idx, lang, activeSpk, setActiveSpk, onPlay }) {
  // parse notes only when the message text or language actually changes
  const parsed = useMemo(
    () => (m.role === "ai" && m.text ? extractNotes(m.text) : null),
    [m.role, m.text]
  );
  const lc = L[lang];
  return (
    <div className={`msg ${m.role === "user" ? "u" : "a"}`}>
      <div className="bbl">
        {m.role === "ai" && <div className="atag">◈ TIGA.AI</div>}
        {m.img && <img src={m.img} alt="" className="adminimg" />}
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</p>
      </div>
      {m.role === "ai" && (
        <div className="mact">
          <SpeakBtn text={m.text} lang={lang} id={idx}
            activeId={activeSpk} setActiveId={setActiveSpk} />
          {parsed && (
            <button className="playbtn" onClick={() => onPlay(parsed)}>
              <span>▶</span><span>{lang === "th" ? "เล่นโน้ต" : lang === "zh" ? "演奏" : "PLAY"}</span>
            </button>
          )}
          {parsed && <span className="nlbl">{parsed.label}</span>}
        </div>
      )}
    </div>
  );
});

const Typing = memo(function Typing() {
  return (
    <div className="msg a">
      <div className="bbl">
        <div className="atag">◈ TIGA.AI</div>
        <div className="typing"><div className="tdd"/><div className="tdd"/><div className="tdd"/></div>
      </div>
    </div>
  );
});

function Input({ val, onChange, onSend, loading, ph }) {
  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }
  function onInput(e) {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px";
    onChange(e.target.value);
  }
  return (
    <div className="ir">
      <textarea className="tin" value={val} placeholder={ph} aria-label={ph}
        onChange={onInput} onKeyDown={onKey} rows={1} />
      <button className="snd" disabled={loading || !val.trim()} onClick={onSend}
        aria-label={ph}>➤</button>
    </div>
  );
}


/* ── Pathway Page ── */
const PathwayPage = memo(function PathwayPage({ lang, onLearn, onRead, initialOpenStageId }) {
  const lc = L[lang];
  const groups = PATH_GROUPS[lang];
  // initialOpenStageId re-opens the topic the learner just came from (via the
  // Sensei page's "change key" back button) so its key picker is right there —
  // this only matters on first mount, same as any other useState initializer.
  const [openStageId, setOpenStageId] = useState(initialOpenStageId || null);
  const [selectedType, setSelectedType] = useState(null); // type obj from stage.types, or null
  useEffect(() => {
    if (!initialOpenStageId) return;
    const el = document.getElementById("pcard-" + initialOpenStageId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCard(st) {
    if (openStageId === st.id) { setOpenStageId(null); setSelectedType(null); return; }
    logUsage("pathway", st.id);
    setOpenStageId(st.id);
    setSelectedType(null);
  }
  function pickType(t) { setSelectedType(t); }
  const pathDone = pathDoneSet();
  const keyDone = keyDoneMap();   // { stageId: ["c","g",...] } — keys already studied per topic
  const currentStage = PATHWAY.find(s => !pathDone.has(s.id));
  const currentId = currentStage ? currentStage.id : null;
  function chooseKey(stage, key) {
    const t = selectedType;
    setOpenStageId(null);
    setSelectedType(null);
    onLearn(stage, key, t);
  }

  return (
    <div className="pathpage">
      <div className="pathhero">
        <div className="pathhero-glow" />
        <div className="pathbadge">◈ PATHWAY OF LEARNING ◈</div>
      </div>

      {groups.map((g, gi) => {
        const stages = STAGES_BY_GROUP[g.id] || [];
        const gc = stages[0].color;
        const openStage = stages.find(s => s.id === openStageId);
        const openIdx = openStage ? stages.indexOf(openStage) : -1;
        return (
          <section className="pgroup" key={g.id}>
            <header className="pgrouphdr">
              <span className="pgbar" style={{ background: gc }} />
              <span className="pgicon">{g.icon}</span>
              <div className="pginfo">
                <div className="pglabel">{g.label}</div>
                <div className="pgdesc">{g.desc}</div>
              </div>
              <span className="pgstep">STEP {gi + 1}</span>
            </header>

            <div className="pgrid" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" }}>
              {stages.map((st, si) => {
                const isOpen = openStageId === st.id;
                const isRead = !!st.content;
                // Card label: for stages with types, show "เลือกชนิด" when open; otherwise "เลือกคีย์"
                let cardLabel = isRead ? lc.readBtn : lc.learnBtn;
                if (isOpen && !isRead) cardLabel = (st.types && !selectedType) ? lc.pickType : lc.pickKey;
                const nKeys = (keyDone[st.id] || []).length; // keys studied in this topic
                // the expanded panel is injected full-width right after the ROW that
                // holds the open card, so its sub-topics sit attached to what was tapped
                const rowEnd = si % 2 === 1 || si === stages.length - 1;
                const panelHere = rowEnd && openIdx >= si - (si % 2) && openIdx <= si;
                return (
                  <Fragment key={st.id}>
                  <button id={"pcard-" + st.id} className={`pcard${isOpen ? " active" : ""}${pathDone.has(st.id) ? " done" : ""}${st.id === currentId ? " current" : ""}`}
                    style={{ "--ac": st.color }}
                    onClick={() => isRead ? (BENEFIT_CASES[st.id] ? openCard(st) : onRead(st)) : openCard(st)}>
                    <span className="pcardglow" />
                    {pathDone.has(st.id) && <span className="pcarddone">✓</span>}
                    {st.id === currentId && <span className="pcardhere">{lc.pathHere}</span>}
                    <span className="pcardlevel">{String(st.level).padStart(2, "0")}</span>
                    <span className="pcardicon" aria-hidden="true">{st.icon}</span>
                    <span className="pcardtitle">{tr(st.title, lang)}</span>
                    <span className="pcardsub">{tr(st.subtitle, lang)}</span>
                    {nKeys > 0 && !isRead && <span className="pcardkeys">🎹 {lc.keysLearned.replace("{n}", nKeys)}</span>}
                    <span className="pcardgo">
                      {cardLabel}
                      <span className="pcardarrow">{isOpen && !isRead ? "▾" : "→"}</span>
                    </span>
                  </button>

                  {/* panel — type picker first (if stage has types), then key picker —
                      rendered inside the grid so it expands right under the tapped row */}
                  {panelHere && openStage && (
              <div className="keypanel" style={{
                "--ac": openStage.color,
                background: "var(--card2)",
                border: `1px solid ${openStage.color}`,
                borderRadius: "14px",
                padding: "14px 13px",
                marginTop: 0,
                gridColumn: "1 / -1",
              }}>
                {/* panel header */}
                <div className="keypanel-head" style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "13px", paddingBottom: "10px", borderBottom: "1px solid var(--bd1)" }}>
                  <span style={{ fontSize: "18px" }}>{openStage.icon}</span>
                  <span style={{ flex: 1, fontFamily: "'Orbitron',sans-serif", fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>{tr(openStage.title, lang)}</span>
                  {selectedType && (
                    <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "9px", background: openStage.color + "33", color: openStage.color, borderRadius: "6px", padding: "2px 7px", border: `1px solid ${openStage.color}55` }}>
                      {tr(selectedType.label, lang)}
                    </span>
                  )}
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "9px", color: openStage.color, whiteSpace: "nowrap" }}>
                    {openStage.content ? lc.caseSub : openStage.types && !selectedType ? lc.pickType : lc.pickKey}
                  </span>
                </div>

                {/* READ CHAPTER: overview + world-class case-study sub-topics */}
                {openStage.content && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px" }}>
                    <button onClick={() => onRead(openStage)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px", padding: "12px 11px", borderRadius: "11px", cursor: "pointer", background: "var(--card3)", border: `1px solid ${openStage.color}55`, textAlign: "left" }}>
                      <span style={{ fontSize: "18px" }}>📖</span>
                      <span style={{ fontSize: "11px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "var(--text2)", lineHeight: 1.25 }}>{lc.caseOverview}</span>
                    </button>
                    {(BENEFIT_CASES[openStage.id] || []).map(c => (
                      <button key={c.id} onClick={() => onRead(openStage, c)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px", padding: "12px 11px", borderRadius: "11px", cursor: "pointer", background: "var(--card3)", border: "1px solid var(--bd1)", textAlign: "left" }}>
                        <span style={{ fontSize: "18px" }}>{c.icon}</span>
                        <span style={{ fontSize: "11px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "var(--text2)", lineHeight: 1.25 }}>{tr(c.title, lang)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* STEP 1: type picker */}
                {!openStage.content && openStage.types && !selectedType && (
                  <>
                    <div style={{ fontSize: "9.5px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "10px", textAlign: "center" }}>
                      {lc.pickTypeHint}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px", marginBottom: "12px" }}>
                      {openStage.types.map(t => (
                        <button key={t.id} onClick={() => pickType(t)} style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
                          padding: "13px 8px", borderRadius: "11px", cursor: "pointer",
                          background: "var(--card3)",
                          border: `1px solid ${openStage.color}55`,
                          transition: "all .15s",
                        }}>
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "20px", fontWeight: 900, color: openStage.color, lineHeight: 1 }}>{t.symbol}</span>
                          <span style={{ fontSize: "10px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "var(--text2)", lineHeight: 1.2, textAlign: "center" }}>{tr(t.label, lang)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* STEP 2: key picker (after type selected, or stage has no types) */}
                {!openStage.content && (!openStage.types || selectedType) && (
                  <>
                    {selectedType && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <span style={{ fontSize: "9.5px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>{lc.pickKeyHint}</span>
                        <button onClick={() => setSelectedType(null)} style={{ fontSize: "9px", color: "var(--muted)", background: "none", border: "1px solid var(--bd4)", borderRadius: "5px", padding: "2px 7px", cursor: "pointer" }}>← {lc.pickType}</button>
                      </div>
                    )}
                    <div className="keygrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: selectedType ? "8px" : "12px" }}>
                      {KEYS_12.map(k => {
                        const kdone = (keyDone[openStage.id] || []).includes(k.id.toLowerCase());
                        return (
                        <button key={k.id} className={`keybtn${k.black ? " black" : ""}${kdone ? " kdone" : ""}`}
                          style={{
                            position: "relative",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px",
                            padding: "11px 5px", borderRadius: "10px", cursor: "pointer",
                            background: "var(--card3)",
                            border: kdone ? "1px solid #d97757" : "1px solid var(--bd4)",
                          }}
                          onClick={() => chooseKey(openStage, k)}>
                          {kdone && <span style={{ position: "absolute", top: "3px", right: "4px", fontSize: "10px", color: "#d97757", fontWeight: 900 }}>✓</span>}
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "16px", fontWeight: 900, color: kdone ? "#d97757" : "var(--text)", lineHeight: 1 }}>{k.name}</span>
                          <span style={{ fontSize: "8.5px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, color: "var(--muted)", lineHeight: 1 }}>{lang === "th" ? k.th : lang === "zh" ? k.zh : k.name}</span>
                        </button>
                        );
                      })}
                    </div>
                    {!selectedType && (
                      <div style={{ textAlign: "center", fontSize: "9.5px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", lineHeight: 1.5 }}>{lc.pickKeyHint}</div>
                    )}
                  </>
                )}
              </div>
                  )}
                  </Fragment>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="pathfoot">{lc.pathFoot}</div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   PRACTICE TODAY — a one-tap daily plan built from the learner's real
   state (progress, homework, activity log). Removes the "what should I
   practice?" decision that kills most practice habits.
════════════════════════════════════════════════════════════ */
const _v12wait = (ms) => new Promise(r => setTimeout(r, ms));
const PC_SOLFA = { C: "do", D: "re", E: "mi", F: "fa", G: "sol", A: "la", B: "ti" };
const PC_SOLFA_TH = { C: "โด", D: "เร", E: "มี", F: "ฟา", G: "ซอล", A: "ลา", B: "ที" };
const TodayPage = memo(function TodayPage({ lang, exp, homework, onLearn, onRead, onSong, onReward, onBack }) {
  const T = {
    th: { title: "ซ้อมวันนี้", sub: "แผนซ้อมส่วนตัวของคุณ — สร้างใหม่ให้ทุกวันจากความคืบหน้าจริง ไล่ทำทีละข้อได้เลย", warm: "วอร์มอัพนิ้ว", hw: "การบ้านจากครู", review: "ทบทวนของเดิม", learn: "เรียนเรื่องใหม่", song: "เพลงปิดท้าย", start: "เริ่ม ▶", done: "เสร็จแล้ว ✓", hwBtn: "ทำแล้ว ✓", progress: "ความคืบหน้าวันนี้", allDone: "ครบทุกข้อแล้ว! สุดยอดไปเลยครับ 🎉", bonus: "รับโบนัสประจำวัน +40 EXP · +20 🪙", claimed: "รับโบนัสของวันนี้แล้ว ✓" },
    en: { title: "Practice Today", sub: "Your personal plan — rebuilt every day from your real progress. Just work down the list.", warm: "Finger warm-up", hw: "Teacher's homework", review: "Review", learn: "Something new", song: "Closing song", start: "Start ▶", done: "Done ✓", hwBtn: "Done ✓", progress: "Today's progress", allDone: "All done — amazing work! 🎉", bonus: "Claim daily bonus +40 EXP · +20 🪙", claimed: "Today's bonus claimed ✓" },
    zh: { title: "今日练习", sub: "你的专属计划 — 每天根据真实进度重新生成，逐项完成即可。", warm: "手指热身", hw: "老师的作业", review: "复习", learn: "学点新的", song: "结尾曲", start: "开始 ▶", done: "完成 ✓", hwBtn: "已完成 ✓", progress: "今日进度", allDone: "全部完成，太棒了！🎉", bonus: "领取每日奖励 +40 EXP · +20 🪙", claimed: "今日奖励已领取 ✓" },
  }[lang];
  const [, setTick] = useState(0);
  const bump = () => setTick(t => t + 1);
  const doneLog = todayEntries();
  const seed = daySeed();
  const doneP = pathDoneSet();
  const keyMap = keyDoneMap();

  const warm = MAJOR_SCALE_SONGS[seed % MAJOR_SCALE_SONGS.length];
  const hw = homework && homework.text ? homework : null;

  // review = the finished (non-chapter) topic you've gone longest without touching
  const lessonLast = {};
  for (const e of readActLog()) if (e.k === "lesson") { const sid = e.id.split("/")[0]; lessonLast[sid] = Math.max(lessonLast[sid] || 0, e.t); }
  const reviewables = PATHWAY.filter(s => !s.content && doneP.has(s.id))
    .sort((a, b) => (lessonLast[a.id] || 0) - (lessonLast[b.id] || 0));
  const review = reviewables[0] || null;
  const reviewKey = review
    ? (KEYS_12.find(k => (keyMap[review.id] || []).includes(k.id.toLowerCase())) || KEYS_12[seed % KEYS_12.length])
    : null;

  // new = the next Pathway stage not finished yet (chapters open as a read)
  const nextStage = PATHWAY.find(s => !doneP.has(s.id)) || null;
  const nextKey = nextStage && !nextStage.content
    ? (KEYS_12.find(k => !(keyMap[nextStage.id] || []).includes(k.id.toLowerCase())) || KEYS_12[0])
    : null;

  // closing song matched to level
  const lvl = levelInfo(exp).level;
  const pool = (lvl >= 10 ? ["furelise"] : lvl >= 5 ? ["happy", "london", "saints"] : ["twinkle", "row"])
    .map(id => SONGS.find(s => s.id === id)).filter(Boolean);
  const song = pool.length ? pool[seed % pool.length] : SONGS[0];

  const steps = [
    { id: "warm", icon: "🎹", tag: T.warm, label: tr(warm, lang), isDone: doneLog.some(e => e.k === "game" && e.id === warm.id), go: () => onSong(warm) },
    ...(hw ? [{ id: "hw", icon: "📘", tag: T.hw, label: hw.text, isDone: hwDoneToday(), hwStep: true }] : []),
    ...(review ? [{ id: "review", icon: "🔁", tag: T.review, label: tr(review.title, lang) + (reviewKey ? " · " + reviewKey.name : ""), isDone: doneLog.some(e => e.k === "lesson" && e.id.split("/")[0] === review.id), go: () => onLearn(review, reviewKey, review.types ? review.types[0] : null) }] : []),
    ...(nextStage ? [{ id: "new", icon: "✨", tag: T.learn, label: tr(nextStage.title, lang) + (nextKey ? " · " + nextKey.name : ""), isDone: doneLog.some(e => (e.k === "lesson" || e.k === "read-chapter") && e.id.split("/")[0] === nextStage.id), go: () => nextStage.content ? onRead(nextStage) : onLearn(nextStage, nextKey, nextStage.types ? nextStage.types[0] : null) }] : []),
    { id: "song", icon: "🚀", tag: T.song, label: tr(song, lang), isDone: doneLog.some(e => e.k === "game" && e.id === song.id), go: () => onSong(song) },
  ];
  const nDone = steps.filter(s => s.isDone).length;
  const allDone = nDone === steps.length;
  const pct = Math.round((nDone / steps.length) * 100);

  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navStudio}
        </button>
      )}
      <div className="v12hero">
        <div className="v12title">📅 {T.title}</div>
        <div className="v12sub">{T.sub}</div>
      </div>
      <div className="v12card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>{T.progress}</span>
          <span style={{ fontSize: "11px", color: "#d97757", fontFamily: "'Orbitron',sans-serif", fontWeight: 700 }}>{nDone}/{steps.length}</span>
        </div>
        <div className="tdbar"><div className="tdfill" style={{ width: pct + "%" }} /></div>
      </div>
      {steps.map(s => (
        <div key={s.id} className={`tdstep${s.isDone ? " done" : ""}`}>
          <span className="tdico">{s.isDone ? "✅" : s.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tdtag">{s.tag}</div>
            <div className="tdlbl">{s.label}</div>
          </div>
          {s.hwStep
            ? (s.isDone
              ? <span className="tdgo done">{T.done}</span>
              : <button className="tdgo" onClick={() => { playUi("click"); markHwDone(); onReward(10, 0); bump(); }}>{T.hwBtn}</button>)
            : (s.isDone
              ? <span className="tdgo done">{T.done}</span>
              : <button className="tdgo" onClick={() => { playUi("click"); logUsage("pathway", "today-" + s.id); s.go(); }}>{T.start}</button>)}
        </div>
      ))}
      {allDone && (
        <div className="v12card" style={{ textAlign: "center", borderColor: "#d9775766" }}>
          <div style={{ fontSize: "15px", color: "#d97757", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, marginBottom: "9px" }}>{T.allDone}</div>
          {todayBonusClaimed()
            ? <div style={{ fontSize: "12px", color: "#d97757", fontFamily: "'Share Tech Mono',monospace" }}>{T.claimed}</div>
            : <button className="tdgo" style={{ borderColor: "#d97757", color: "#d97757", background: "rgba(217,119,87,.1)" }}
                onClick={() => { playUi("reward"); claimTodayBonus(); onReward(40, 20); bump(); }}>{T.bonus}</button>}
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   EAR GYM — daily listening workouts (intervals / chord quality /
   melody echo). Practicable anywhere, even without a piano.
════════════════════════════════════════════════════════════ */
const EG_ROUND = 8;
const EG_INT_BASE = [2, 4, 5, 7, 12];
const EG_INT_FULL = [2, 3, 4, 5, 7, 8, 9, 12];
const EarGymPage = memo(function EarGymPage({ lang, onReward, onBack }) {
  const T = {
    th: { title: "ยิมหู", sub: "ฝึกหูวันละนิด — ไม่ต้องมีเปียโนตรงหน้าก็ซ้อมได้", int: "ขั้นคู่", chord: "คอร์ด", echo: "เล่นตามทำนอง", q: "ข้อ", listen: "🔊 ฟังอีกครั้ง", start: "เริ่มรอบใหม่ ▶", pickInt: "เสียงที่ได้ยินคือขั้นคู่อะไร?", pickChord: "คอร์ดที่ได้ยินคือชนิดไหน?", pickEcho: "แตะโน้ตตามลำดับที่ได้ยิน", clear: "ล้าง", right: "ถูกต้อง! 🎉", wrong: "เฉลย: ", score: "คะแนน", best: "สถิติดีสุด", done: "จบรอบ!", again: "เล่นอีกรอบ ▶" },
    en: { title: "Ear Gym", sub: "A little listening every day — no piano needed", int: "Intervals", chord: "Chords", echo: "Melody echo", q: "Q", listen: "🔊 Hear it again", start: "Start round ▶", pickInt: "Which interval did you hear?", pickChord: "Which chord quality is it?", pickEcho: "Tap the notes in the order you heard", clear: "Clear", right: "Correct! 🎉", wrong: "Answer: ", score: "Score", best: "Best", done: "Round complete!", again: "Play again ▶" },
    zh: { title: "听力房", sub: "每天练一点听力 — 没有钢琴也能练", int: "音程", chord: "和弦", echo: "旋律模仿", q: "第", listen: "🔊 再听一次", start: "开始 ▶", pickInt: "你听到的是什么音程？", pickChord: "这是什么和弦？", pickEcho: "按听到的顺序点击音符", clear: "清除", right: "正确！🎉", wrong: "答案：", score: "得分", best: "最佳", done: "本轮结束！", again: "再来一轮 ▶" },
  }[lang];
  const [tab, setTab] = useState("int");
  const [phase, setPhase] = useState("idle");   // idle | play | done
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [cur, setCur] = useState(null);          // { notes, chord, answer, options[{key,label}] }
  const [fb, setFb] = useState(null);            // { ok, answerLabel, pickedKey }
  const [taps, setTaps] = useState([]);
  const [result, setResult] = useState(null);
  const startTRef = useRef(0);
  const roundRef = useRef(0);
  const ROOTS = ["C4", "D4", "E4", "F4", "G4", "A4"];

  async function playCur(c) {
    const q = c || cur;
    if (!q) return;
    if (q.chord) { for (const n of q.notes) playPianoNote(n, 1.5); }
    else { for (const n of q.notes) { playPianoNote(n, 0.55); await _v12wait(430); } }
  }
  function genQ(kind) {
    const root = ROOTS[Math.floor(Math.random() * ROOTS.length)];
    if (kind === "int") {
      const pool = (earBest().int || 0) >= 7 ? EG_INT_FULL : EG_INT_BASE;
      const semi = pool[Math.floor(Math.random() * pool.length)];
      const opts = [...new Set([semi, ...[...pool].sort(() => Math.random() - 0.5)])].slice(0, 4).sort(() => Math.random() - 0.5);
      return {
        notes: [root, transposeNotes([root], semi)[0]], chord: false, answer: String(semi),
        options: opts.map(s => ({ key: String(s), label: (INTERVAL_DEFS.find(d => d.semi === s) || {})[lang] || String(s) })),
      };
    }
    if (kind === "chord") {
      const q = TRIAD_TYPES[Math.floor(Math.random() * TRIAD_TYPES.length)];
      return {
        notes: _ascNotes(chordNotesOf(pcOf(root), q.key), 4), chord: true, answer: q.key,
        options: TRIAD_TYPES.map(t => ({ key: t.key, label: t.lab[lang] || t.lab.en })),
      };
    }
    const len = (earBest().echo || 0) >= 7 ? 4 : 3;
    const pcs = [];
    for (let i = 0; i < len; i++) pcs.push(["C", "D", "E", "F", "G", "A", "B"][Math.floor(Math.random() * 7)]);
    return { notes: pcs.map(p => p + "4"), chord: false, answer: pcs.join(" "), pcs };
  }
  function nextQ(kind, myRound) {
    const q = genQ(kind);
    setCur(q); setFb(null); setTaps([]);
    setTimeout(() => { if (roundRef.current === myRound) playCur(q); }, 350);
  }
  function startRound() {
    playUi("click");
    const myRound = ++roundRef.current;
    setScore(0); setIdx(0); setResult(null); setPhase("play");
    startTRef.current = Date.now();
    nextQ(tab, myRound);
  }
  function finishRound(finalScore) {
    const secs = Math.round((Date.now() - startTRef.current) / 1000);
    const acc = Math.round((finalScore / EG_ROUND) * 100);
    const stars = finalScore >= 8 ? 3 : finalScore >= 6 ? 2 : finalScore >= 4 ? 1 : 0;
    const xp = 10 + finalScore * 3;
    setEarBest(tab, finalScore);
    logActivity("ear", tab, finalScore, EG_ROUND - finalScore, Math.max(30, secs));
    logPractice(acc);
    onReward(xp, stars * 5);
    setResult({ score: finalScore, stars, xp, coins: stars * 5 });
    setPhase("done");
    playUi(stars >= 2 ? "levelup" : "click");
  }
  function answered(ok, answerLabel, pickedKey) {
    const ns = ok ? score + 1 : score;
    setScore(ns);
    setFb({ ok, answerLabel, pickedKey });
    playUi(ok ? "click" : "wrong");
    const myRound = roundRef.current;
    setTimeout(() => {
      if (roundRef.current !== myRound) return;
      if (idx + 1 >= EG_ROUND) { finishRound(ns); return; }
      setIdx(idx + 1);
      nextQ(tab, myRound);
    }, ok ? 900 : 1600);
  }
  function pickOption(o) {
    if (!cur || fb) return;
    const okAns = o.key === cur.answer;
    const ansLabel = cur.chord
      ? (TRIAD_TYPES.find(t => t.key === cur.answer) || { lab: {} }).lab[lang]
      : (INTERVAL_DEFS.find(d => String(d.semi) === cur.answer) || {})[lang];
    answered(okAns, ansLabel || cur.answer, o.key);
  }
  function tapEcho(pc) {
    if (!cur || fb || !cur.pcs) return;
    playPianoNote(pc + "4", 0.4);
    const nt = [...taps, pc];
    setTaps(nt);
    if (nt.length >= cur.pcs.length) {
      const okAns = nt.join(" ") === cur.pcs.join(" ");
      answered(okAns, cur.pcs.map(p => (lang === "th" ? PC_SOLFA_TH[p] : p)).join(" · "), null);
    }
  }
  const best = earBest();
  const tabs = [["int", "📏", T.int], ["chord", "🎹", T.chord], ["echo", "🎶", T.echo]];
  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navStudio}
        </button>
      )}
      <div className="v12hero">
        <div className="v12title">👂 {T.title}</div>
        <div className="v12sub">{T.sub}</div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {tabs.map(([k, ic, lb]) => (
          <button key={k} onClick={() => { if (phase === "play") return; playUi("click"); setTab(k); setPhase("idle"); setResult(null); }}
            style={{ flex: 1, padding: "11px 6px", borderRadius: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "13px",
              border: tab === k ? "1px solid #d97757" : "1px solid var(--bd4)", color: tab === k ? "#d97757" : "var(--text2)",
              background: tab === k ? "rgba(217,119,87,.1)" : "var(--card3)" }}>
            {ic} {lb}<div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>{T.best}: {best[k] || 0}/{EG_ROUND}</div>
          </button>
        ))}
      </div>
      {phase !== "play" && (
        <div className="v12card" style={{ textAlign: "center", padding: "24px 14px" }}>
          {result && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "26px" }}>{"⭐".repeat(result.stars) || "💪"}</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "17px", color: "var(--text)", fontWeight: 900, margin: "6px 0" }}>{T.done} {result.score}/{EG_ROUND}</div>
              <div style={{ fontSize: "12px", color: "#d97757", fontFamily: "'Share Tech Mono',monospace" }}>+{result.xp} EXP · +{result.coins} 🪙</div>
            </div>
          )}
          <button className="tdgo" style={{ fontSize: "12px", padding: "12px 26px" }} onClick={startRound}>{result ? T.again : T.start}</button>
        </div>
      )}
      {phase === "play" && cur && (
        <div className="v12card" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", color: "var(--muted)" }}>
            <span>{T.q} {idx + 1}/{EG_ROUND}</span><span>{T.score}: {score}</span>
          </div>
          <button onClick={() => playCur()} style={{ margin: "0 auto 14px", display: "block", padding: "13px 24px", borderRadius: "14px", border: "1px solid #d9775755", background: "rgba(217,119,87,.08)", color: "#d97757", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>{T.listen}</button>
          <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, marginBottom: "11px" }}>
            {tab === "int" ? T.pickInt : tab === "chord" ? T.pickChord : T.pickEcho}
          </div>
          {tab !== "echo" && cur.options && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px" }}>
              {cur.options.map(o => (
                <button key={o.key} className={`egopt${fb && o.key === cur.answer ? " ok" : fb && fb.pickedKey === o.key && !fb.ok ? " bad" : ""}`} onClick={() => pickOption(o)}>{o.label}</button>
              ))}
            </div>
          )}
          {tab === "echo" && (
            <>
              <div style={{ minHeight: "26px", marginBottom: "9px", fontFamily: "'Orbitron',sans-serif", color: "#ff76d8", fontSize: "14px", letterSpacing: "2px" }}>
                {taps.map(p => (lang === "th" ? PC_SOLFA_TH[p] : p)).join(" ")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
                {["C", "D", "E", "F", "G", "A", "B"].map(p => (
                  <button key={p} className="egopt" style={{ padding: "13px 2px" }} onClick={() => tapEcho(p)}>
                    <div style={{ fontSize: "15px", fontFamily: "'Orbitron',sans-serif" }}>{p}</div>
                    <div style={{ fontSize: "9px", color: "var(--muted)" }}>{lang === "th" ? PC_SOLFA_TH[p] : PC_SOLFA[p]}</div>
                  </button>
                ))}
              </div>
              {taps.length > 0 && !fb && <button onClick={() => setTaps([])} style={{ marginTop: "9px", background: "none", border: "1px solid var(--bd4)", borderRadius: "7px", color: "#a88b9b", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}>{T.clear}</button>}
            </>
          )}
          <div style={{ minHeight: "24px", marginTop: "12px", fontSize: "13px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: fb ? (fb.ok ? "#d97757" : "#ff5252") : "transparent" }}>
            {fb ? (fb.ok ? T.right : T.wrong + fb.answerLabel) : "·"}
          </div>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   NOTE-READING COURSE — a graded path to real notation literacy:
   treble → ledger lines → bass clef → accidentals → short sequences.
════════════════════════════════════════════════════════════ */
const RC_LEVELS = [
  { n: 1, icon: "🌱", clef: "treble", pool: ["C4", "D4", "E4", "F4", "G4", "A4", "B4"], seq: 1, qn: 10 },
  { n: 2, icon: "🌿", clef: "treble", pool: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"], seq: 1, qn: 10 },
  { n: 3, icon: "🎻", clef: "bass", pool: ["F2", "G2", "A2", "B2", "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"], seq: 1, qn: 10 },
  { n: 4, icon: "♯", clef: "treble", pool: ["C#4", "D#4", "F#4", "G#4", "A#4", "C#5", "F#5"], seq: 1, qn: 10 },
  { n: 5, icon: "🎼", clef: "treble", pool: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"], seq: 3, qn: 5 },
];
const ReadingPage = memo(function ReadingPage({ lang, onReward, onBack }) {
  const T = {
    th: { title: "คอร์สอ่านโน้ต", sub: "อ่านโน้ตจริงเป็นขั้นบันได — กุญแจซอล → เส้นน้อย → กุญแจฟา → ชาร์ป → อ่านเป็นวลี", lvl: "ด่าน", locked: "ผ่านด่านก่อนหน้าให้ได้ ⭐⭐ ก่อน", q: "ข้อ", what: "โน้ตตัวนี้คือ?", seqWhat: "แตะชื่อโน้ตตามลำดับบนบรรทัด", right: "ถูกต้อง! 🎉", wrong: "เฉลย: ", done: "จบด่าน!", again: "เล่นอีกครั้ง ▶", play: "เริ่ม ▶", back: "← เลือกด่าน", score: "คะแนน",
        tapMode: "⌨️ แตะเลือก", pianoMode: "🎹 เล่นเปียโนจริง", listening: "🎤 กำลังฟัง... เล่นโน้ตนี้บนเปียโนได้เลย", listenReady: "🎹 พร้อมแล้ว — เล่นโน้ตที่เห็นบนเปียโน/MIDI ของคุณ", listenErr: "เข้าไมค์ไม่ได้ — ลองแตะเลือกแทน" },
    en: { title: "Note Reading", sub: "Real notation literacy, step by step — treble → ledger lines → bass clef → sharps → phrases", lvl: "Level", locked: "Earn ⭐⭐ on the previous level first", q: "Q", what: "Which note is this?", seqWhat: "Tap the note names in order", right: "Correct! 🎉", wrong: "Answer: ", done: "Level complete!", again: "Play again ▶", play: "Start ▶", back: "← Levels", score: "Score",
        tapMode: "⌨️ Tap to answer", pianoMode: "🎹 Play a real piano", listening: "🎤 Listening... play this note on your piano", listenReady: "🎹 Ready — play the note you see on your piano/MIDI", listenErr: "Couldn't reach the mic — try tap mode instead" },
    zh: { title: "识谱课", sub: "循序渐进学会读谱 — 高音谱号 → 加线 → 低音谱号 → 升号 → 短句", lvl: "关卡", locked: "先在上一关拿到 ⭐⭐", q: "第", what: "这是什么音？", seqWhat: "按顺序点击音名", right: "正确！🎉", wrong: "答案：", done: "本关完成！", again: "再来一次 ▶", play: "开始 ▶", back: "← 选关", score: "得分",
        tapMode: "⌨️ 点击作答", pianoMode: "🎹 用真钢琴弹奏", listening: "🎤 聆听中...在钢琴上弹这个音吧", listenReady: "🎹 准备好了 — 在钢琴/MIDI 上弹出你看到的音", listenErr: "无法使用麦克风 — 请改用点击模式" },
  }[lang];
  const [lvl, setLvl] = useState(null);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [cur, setCur] = useState(null);   // { notes, answerPcs, options }
  const [fb, setFb] = useState(null);
  const [taps, setTaps] = useState([]);
  const [result, setResult] = useState(null);
  const startTRef = useRef(0);
  const runRef = useRef(0);
  // ── answer by playing a real piano/MIDI keyboard instead of tapping ──
  // reuses the same mic/MIDI singleton every other listening mode shares.
  const [micMode, setMicMode] = useState(false);
  const [micSrc, setMicSrc] = useState(null);   // {type:"midi"|"mic"|"error"}
  const [micHeard, setMicHeard] = useState(null); // last detected note, for a flash of feedback
  const micTapsRef = useRef([]);
  const curRef = useRef(null); curRef.current = cur;
  const fbRef = useRef(null); fbRef.current = fb;
  function micInput(d) {
    if (!curRef.current || fbRef.current || !lvl) return;
    const pc = pcOf(d.note);
    playPianoNote(d.note, 0.3);
    setMicHeard(d.note);
    if (lvl.seq === 1) {
      answered(pc === curRef.current.answerPcs[0], lvl);
    } else {
      micTapsRef.current = [...micTapsRef.current, pc];
      setTaps(micTapsRef.current);
      if (micTapsRef.current.length >= curRef.current.answerPcs.length) {
        answered(micTapsRef.current.join(" ") === curRef.current.answerPcs.join(" "), lvl);
      }
    }
  }
  const micHandlerRef = useRef(() => {});
  micHandlerRef.current = micInput;
  useEffect(() => {
    if (!micMode || !lvl || result) { stopPracticeListeners(); setMicSrc(null); return; }
    getAC();
    stopPracticeListeners(); // release any listener another mode left open — never stack
    const onDetect = (d) => micHandlerRef.current(d);
    (async () => {
      const midiOk = await startMidiListener(onDetect, () => setMicSrc({ type: "midi" }));
      if (!midiOk) await startMicListener(onDetect, () => setMicSrc({ type: "mic" }), () => setMicSrc({ type: "error" }));
    })();
    return () => stopPracticeListeners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micMode, lvl, result]);
  useEffect(() => () => stopPracticeListeners(), []); // belt-and-braces: release on unmount

  function genQ(L) {
    const pick = () => L.pool[Math.floor(Math.random() * L.pool.length)];
    const notes = [];
    for (let i = 0; i < L.seq; i++) { let n = pick(); if (L.seq > 1) while (i > 0 && n === notes[i - 1]) n = pick(); notes.push(n); }
    const answerPcs = notes.map(pcOf);
    let options = null;
    if (L.seq === 1) {
      const pcsAll = [...new Set(L.pool.map(pcOf))];
      const others = pcsAll.filter(p => p !== answerPcs[0]).sort(() => Math.random() - 0.5).slice(0, 3);
      options = [answerPcs[0], ...others].sort(() => Math.random() - 0.5);
    }
    return { notes, answerPcs, options };
  }
  function nextQ(L) { setCur(genQ(L)); setFb(null); setTaps([]); micTapsRef.current = []; setMicHeard(null); }
  function startLevel(L) {
    playUi("click");
    runRef.current++;
    setLvl(L); setIdx(0); setScore(0); setResult(null);
    startTRef.current = Date.now();
    nextQ(L);
  }
  function finishLevel(finalScore, L) {
    const secs = Math.round((Date.now() - startTRef.current) / 1000);
    const acc = Math.round((finalScore / L.qn) * 100);
    const stars = finalScore >= Math.ceil(L.qn * 0.9) ? 3 : finalScore >= Math.ceil(L.qn * 0.7) ? 2 : finalScore >= Math.ceil(L.qn * 0.5) ? 1 : 0;
    const xp = 15 + Math.round((finalScore / L.qn) * 30);
    setReadCourseStars(L.n, stars);
    logActivity("read", "L" + L.n, finalScore, L.qn - finalScore, Math.max(30, secs));
    logPractice(acc);
    onReward(xp, stars * 5);
    setResult({ score: finalScore, stars, xp, coins: stars * 5, qn: L.qn });
    playUi(stars >= 2 ? "levelup" : "click");
  }
  function answered(ok, L) {
    const ns = ok ? score + 1 : score;
    setScore(ns);
    setFb({ ok });
    playUi(ok ? "click" : "wrong");
    if (ok) playPianoNote(cur.notes[0], 0.5);
    const run = runRef.current;
    setTimeout(() => {
      if (runRef.current !== run) return;
      if (idx + 1 >= L.qn) { finishLevel(ns, L); return; }
      setIdx(idx + 1);
      nextQ(L);
    }, ok ? 750 : 1500);
  }
  function pickPc(pc) {
    if (!cur || fb || !lvl) return;
    playPianoNote(pc + "4", 0.35); // hear the note you picked, right or wrong — that's the lesson
    answered(pc === cur.answerPcs[0], lvl);
  }
  function tapSeq(pc) {
    if (!cur || fb || !lvl) return;
    playPianoNote(pc + "4", 0.35);
    const nt = [...taps, pc];
    setTaps(nt);
    if (nt.length >= cur.answerPcs.length) answered(nt.join(" ") === cur.answerPcs.join(" "), lvl);
  }
  const stars = readCourseStars();
  const unlocked = (n) => n === 1 || (stars[n - 1] || 0) >= 2;
  const pcLabel = (p) => p.replace("#", "♯");

  if (!lvl) {
    return (
      <div className="pathpage">
        {onBack && (
          <button onClick={() => { playUi("click"); onBack(); }}
            style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
            ← {L[lang].navStudio}
          </button>
        )}
        <div className="v12hero"><div className="v12title">🎼 {T.title}</div><div className="v12sub">{T.sub}</div></div>
        {RC_LEVELS.map(L => {
          const open = unlocked(L.n);
          const st = stars[L.n] || 0;
          return (
            <button key={L.n} className="tdstep" style={{ width: "100%", cursor: open ? "pointer" : "default", opacity: open ? 1 : 0.55, textAlign: "left" }}
              onClick={() => open && startLevel(L)}>
              <span className="tdico">{open ? L.icon : "🔒"}</span>
              <div style={{ flex: 1 }}>
                <div className="tdtag">{T.lvl} {L.n} · {L.clef === "bass" ? "𝄢" : "𝄞"}{L.seq > 1 ? " · x" + L.seq : ""}</div>
                <div className="tdlbl">{open ? ("⭐".repeat(st) || "—") : T.locked}</div>
              </div>
              {open && <span className="tdgo">{T.play}</span>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="pathpage">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 2px 10px", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={() => { playUi("click"); runRef.current++; setLvl(null); setResult(null); }} style={{ background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, flexShrink: 0 }}>{T.back}</button>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", color: "var(--muted)" }}>
          {result ? T.done : `${T.q} ${idx + 1}/${lvl.qn} · ${T.score}: ${score}`}
        </span>
        {!result && (
          <button onClick={() => { playUi("click"); setMicMode(m => !m); }}
            style={{ marginLeft: "auto", background: micMode ? "rgba(217,119,87,.14)" : "none", border: `1px solid ${micMode ? "#d97757" : "var(--bd4)"}`, borderRadius: "20px", color: micMode ? "#d97757" : "#a88b9b", padding: "6px 12px", fontSize: "11px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, flexShrink: 0 }}>
            {micMode ? T.tapMode : T.pianoMode}
          </button>
        )}
      </div>
      {result ? (
        <div className="v12card" style={{ textAlign: "center", padding: "26px 14px" }}>
          <div style={{ fontSize: "28px" }}>{"⭐".repeat(result.stars) || "💪"}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "18px", color: "var(--text)", fontWeight: 900, margin: "8px 0" }}>{result.score}/{result.qn}</div>
          <div style={{ fontSize: "12px", color: "#d97757", fontFamily: "'Share Tech Mono',monospace", marginBottom: "14px" }}>+{result.xp} EXP · +{result.coins} 🪙</div>
          <button className="tdgo" style={{ fontSize: "12px", padding: "12px 26px" }} onClick={() => startLevel(lvl)}>{T.again}</button>
        </div>
      ) : cur && (
        <div className="v12card" style={{ textAlign: "center" }}>
          <div style={{ background: "#10080d", borderRadius: "12px", padding: "8px 6px", marginBottom: "13px", border: "1px solid #ffffff10" }}>
            <StaffNotes notes={cur.notes} hideNames clef={lvl.clef} />
          </div>
          <div style={{ fontSize: "12.5px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, marginBottom: "11px" }}>
            {lvl.seq === 1 ? T.what : T.seqWhat}
          </div>
          {micMode ? (
            <div style={{ padding: "18px 10px", borderRadius: "12px", border: `1px solid ${micSrc && micSrc.type === "error" ? "#ff5252" : "#d9775744"}`, background: "rgba(217,119,87,.06)" }}>
              {micSrc && micSrc.type === "error" ? (
                <div style={{ fontSize: "13px", color: "#ff5252", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>{T.listenErr}</div>
              ) : (
                <>
                  <div style={{ fontSize: "26px", marginBottom: "6px" }} className={micHeard ? "" : "flicker"}>{micSrc ? "🎹" : "🎤"}</div>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>
                    {micSrc ? T.listenReady : T.listening}
                  </div>
                  {lvl.seq > 1 && <div style={{ minHeight: "20px", marginTop: "8px", fontFamily: "'Orbitron',sans-serif", color: "#ff76d8", fontSize: "14px", letterSpacing: "2px" }}>{taps.join(" ")}</div>}
                  {micHeard && <div style={{ marginTop: "6px", fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", color: "var(--muted)" }}>♪ {micHeard}</div>}
                </>
              )}
            </div>
          ) : (
            <>
              {lvl.seq === 1 && cur.options && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px" }}>
                  {cur.options.map(p => (
                    <button key={p} className={`egopt${fb && p === cur.answerPcs[0] ? " ok" : ""}`} onClick={() => pickPc(p)}>
                      <div style={{ fontSize: "17px", fontFamily: "'Orbitron',sans-serif" }}>{pcLabel(p)}</div>
                      {!p.includes("#") && <div style={{ fontSize: "9.5px", color: "var(--muted)" }}>{lang === "th" ? PC_SOLFA_TH[p] : PC_SOLFA[p]}</div>}
                    </button>
                  ))}
                </div>
              )}
              {lvl.seq > 1 && (
                <>
                  <div style={{ minHeight: "24px", marginBottom: "9px", fontFamily: "'Orbitron',sans-serif", color: "#ff76d8", fontSize: "14px", letterSpacing: "2px" }}>{taps.join(" ")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
                    {["C", "D", "E", "F", "G", "A", "B"].map(p => (
                      <button key={p} className="egopt" style={{ padding: "13px 2px" }} onClick={() => tapSeq(p)}>
                        <div style={{ fontSize: "15px", fontFamily: "'Orbitron',sans-serif" }}>{p}</div>
                        <div style={{ fontSize: "9px", color: "var(--muted)" }}>{lang === "th" ? PC_SOLFA_TH[p] : PC_SOLFA[p]}</div>
                      </button>
                    ))}
                  </div>
                  {taps.length > 0 && !fb && <button onClick={() => setTaps([])} style={{ marginTop: "9px", background: "none", border: "1px solid var(--bd4)", borderRadius: "7px", color: "#a88b9b", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}>✕</button>}
                </>
              )}
            </>
          )}
          <div style={{ minHeight: "24px", marginTop: "12px", fontSize: "13px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: fb ? (fb.ok ? "#d97757" : "#ff5252") : "transparent" }}>
            {fb ? (fb.ok ? T.right : T.wrong + cur.answerPcs.map(pcLabel).join(" ")) : "·"}
          </div>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MY STATS (insights) — turns the activity log the app already keeps
   into visible progress: minutes, accuracy, weak spots, best hour.
════════════════════════════════════════════════════════════ */
const InsightsPage = memo(function InsightsPage({ lang, profile, onSong, onBack }) {
  const T = {
    th: { title: "สถิติของฉัน", sub: "ความคืบหน้าจริงจากการซ้อมของคุณ — ยิ่งซ้อม กราฟยิ่งโต", mins: "นาทีรวม", notes: "โน้ตที่เล่นถูก", days: "วันที่ซ้อม (14 วัน)", streak: "สตรีค", chart: "นาทีซ้อมย้อนหลัง 14 วัน", acc: "ความแม่นยำ", accNow: "7 วันนี้", accPrev: "7 วันก่อน", weak: "จุดที่ควรเก็บ", weakGo: "ซ้อมเลย ▶", weakNone: "ยังไม่มีข้อมูลพอ — ซ้อมต่อไปเรื่อยๆ เดี๋ยวระบบจะชี้จุดให้เอง", hour: "ช่วงเวลาที่คุณซ้อมบ่อยที่สุด", empty: "ยังไม่มีข้อมูลการซ้อม — เริ่มจากหน้า 'ซ้อมวันนี้' ได้เลย!" },
    en: { title: "My Stats", sub: "Real progress from your real practice — the more you play, the more this grows", mins: "Total minutes", notes: "Correct notes", days: "Days practiced (14d)", streak: "Streak", chart: "Practice minutes — last 14 days", acc: "Accuracy", accNow: "This 7 days", accPrev: "Previous 7", weak: "Spots to polish", weakGo: "Practice ▶", weakNone: "Not enough data yet — keep practicing and this will fill in", hour: "Your most frequent practice time", empty: "No practice data yet — start with 'Practice Today'!" },
    zh: { title: "我的数据", sub: "来自真实练习的真实进步 — 练得越多，这里越丰富", mins: "总分钟", notes: "弹对音符", days: "练习天数(14天)", streak: "连续", chart: "近14天练习分钟", acc: "准确率", accNow: "近7天", accPrev: "前7天", weak: "待加强", weakGo: "去练 ▶", weakNone: "数据还不够 — 继续练习，这里会自动填充", hour: "你最常练习的时间", empty: "还没有练习数据 — 从'今日练习'开始吧！" },
  }[lang];
  const log = readActLog();
  const dayMs = 86400000;
  // day boundary must match dayKey()/dayDate() (DAY_TZ_OFFSET_MIN — currently UTC),
  // not the device's local midnight, or "days practiced" and this chart disagree
  const _n0 = new Date();
  const t0 = Date.UTC(_n0.getUTCFullYear(), _n0.getUTCMonth(), _n0.getUTCDate());
  const start14 = t0 - 13 * dayMs;
  const now = Date.now();
  const mins = Array(14).fill(0);
  const hourSec = Array(24).fill(0);
  let ok7 = 0, miss7 = 0, okP = 0, missP = 0, totalSec = 0, totalOk = 0;
  const daysSet = new Set();
  for (const e of log) {
    const di = Math.floor((e.t - start14) / dayMs);
    if (di >= 0 && di < 14) { mins[di] += e.sec; if (e.sec > 0) daysSet.add(di); }
    if (e.t >= now - 7 * dayMs) { ok7 += e.ok; miss7 += e.miss; }
    else if (e.t >= now - 14 * dayMs) { okP += e.ok; missP += e.miss; }
    hourSec[new Date(e.t).getHours()] += e.sec;
    totalSec += e.sec; totalOk += e.ok;
  }
  const acc7 = ok7 + miss7 > 0 ? Math.round(ok7 / (ok7 + miss7) * 100) : null;
  const accP = okP + missP > 0 ? Math.round(okP / (okP + missP) * 100) : null;
  const byTopic = {};
  for (const e of log) {
    if (e.k === "voice" || e.ok + e.miss < 1) continue;
    const key = e.k + "|" + e.id;
    const b = byTopic[key] || (byTopic[key] = { e, ok: 0, miss: 0 });
    b.ok += e.ok; b.miss += e.miss;
  }
  const weak = Object.values(byTopic)
    .filter(b => b.ok + b.miss >= 4 && b.miss > 0)
    .map(b => ({ ...b, rate: b.miss / (b.ok + b.miss) }))
    .sort((a, b) => b.rate - a.rate).slice(0, 3);
  const bestHour = hourSec.some(s => s > 0) ? hourSec.indexOf(Math.max(...hourSec)) : null;
  const maxMin = Math.max(60, ...mins);
  const WD = { th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"], en: ["S", "M", "T", "W", "T", "F", "S"], zh: ["日", "一", "二", "三", "四", "五", "六"] }[lang];
  const hasData = log.length > 0;
  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navProfile}
        </button>
      )}
      <div className="v12hero"><div className="v12title">📊 {T.title}</div><div className="v12sub">{T.sub}</div></div>
      {!hasData && <div className="v12card" style={{ textAlign: "center", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: "13.5px", padding: "22px 14px" }}>{T.empty}</div>}
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <div className="instile"><b>{Math.round(totalSec / 60)}</b><span>{T.mins}</span></div>
        <div className="instile"><b>{totalOk}</b><span>{T.notes}</span></div>
        <div className="instile"><b>{daysSet.size}</b><span>{T.days}</span></div>
        <div className="instile"><b>{(profile && profile.streak) || 0}🔥</b><span>{T.streak}</span></div>
      </div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "6px" }}>{T.chart}</div>
        <div className="insbarwrap">
          {mins.map((m, i) => <div key={i} className="insbar" style={{ height: Math.max(2, Math.round(m / maxMin * 88)) + "%", opacity: m > 0 ? 1 : 0.25 }} title={Math.round(m / 60) + " min"} />)}
        </div>
        <div style={{ display: "flex", gap: "4px", padding: "2px 2px 0" }}>
          {mins.map((_, i) => { const d = new Date(start14 + i * dayMs); return <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "8px", color: "#826575", fontFamily: "'Share Tech Mono',monospace" }}>{WD[d.getUTCDay()]}</div>; })}
        </div>
      </div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "8px" }}>{T.acc}</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div className="instile"><b style={{ color: acc7 != null && accP != null ? (acc7 >= accP ? "#d97757" : "#d97757") : "#d97757" }}>{acc7 == null ? "—" : acc7 + "%"}</b><span>{T.accNow}</span></div>
          <div className="instile"><b style={{ color: "var(--muted)" }}>{accP == null ? "—" : accP + "%"}</b><span>{T.accPrev}</span></div>
        </div>
      </div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "8px" }}>🎯 {T.weak}</div>
        {weak.length === 0 && <div style={{ fontSize: "12.5px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>{T.weakNone}</div>}
        {weak.map((w, i) => {
          const song = actSongOf(w.e);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderTop: i ? "1px solid #ffffff0c" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", color: "var(--text)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>{actTopicLabel(w.e, lang)}</div>
                <div style={{ fontSize: "10px", color: "#ff5252", fontFamily: "'Share Tech Mono',monospace" }}>{Math.round(w.rate * 100)}% miss · {w.ok + w.miss} n</div>
              </div>
              {song && <button className="tdgo" onClick={() => { playUi("click"); onSong(song); }}>{T.weakGo}</button>}
            </div>
          );
        })}
      </div>
      {bestHour != null && (
        <div className="v12card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "5px" }}>⏰ {T.hour}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "19px", color: "#d97757", fontWeight: 900 }}>{String(bestHour).padStart(2, "0")}:00 – {String((bestHour + 1) % 24).padStart(2, "0")}:00</div>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   REPORT CARD — a weekly parent-friendly summary with a written
   teacher's comment, plus downloadable certificates per finished
   Pathway chapter and a shareable weekly PNG.
════════════════════════════════════════════════════════════ */
const ReportPage = memo(function ReportPage({ lang, profile, onBack }) {
  const T = {
    th: { title: "สมุดพก", sub: "สรุปผลการเรียนรายสัปดาห์ + ใบประกาศนียบัตร — บันทึกเป็นรูปส่งให้ผู้ปกครองหรือแชร์ได้เลย", week: "สัปดาห์นี้ (7 วันล่าสุด)", mins: "นาที", days: "วัน", accL: "แม่นยำ", topicsL: "หัวข้อ", gamesL: "เกม", comment: "คำติชมจากครู TiGA", certs: "ใบประกาศนียบัตร", certGet: "⬇ บันทึกใบประกาศ", certLock: "เรียนให้ครบทุกหัวข้อในหมวดนี้", share: "⬇ บันทึกสมุดพกเป็นรูป", making: "กำลังสร้างรูป…", student: "นักเรียน TiGA" },
    en: { title: "Report Card", sub: "A weekly summary with a teacher's comment + downloadable certificates — save as an image for parents or sharing", week: "This week (last 7 days)", mins: "min", days: "days", accL: "accuracy", topicsL: "topics", gamesL: "games", comment: "Teacher TiGA's comment", certs: "Certificates", certGet: "⬇ Save certificate", certLock: "Finish every topic in this chapter", share: "⬇ Save report as image", making: "Rendering…", student: "TiGA Student" },
    zh: { title: "成绩单", sub: "每周学习总结 + 老师评语 + 可下载证书 — 保存成图片给家长或分享", week: "本周（近7天）", mins: "分钟", days: "天", accL: "准确率", topicsL: "主题", gamesL: "游戏", comment: "TiGA 老师评语", certs: "证书", certGet: "⬇ 保存证书", certLock: "完成本章全部主题", share: "⬇ 保存成绩单图片", making: "生成中…", student: "TiGA 学员" },
  }[lang];
  const [busy, setBusy] = useState(false);
  const log = readActLog();
  const now = Date.now();
  const dayMs = 86400000;
  function stat(from, to) {
    let sec = 0, ok = 0, miss = 0, games = 0;
    const days = new Set(), topics = new Set();
    for (const e of log) {
      if (e.t < from || e.t >= to) continue;
      sec += e.sec; ok += e.ok; miss += e.miss;
      if (e.sec > 0) days.add(e.d);
      if (e.k === "game") games++;
      if (e.k === "lesson" || e.k === "read-chapter") topics.add(e.id.split("/")[0]);
    }
    return { min: Math.round(sec / 60), days: days.size, ok, miss, acc: ok + miss > 0 ? Math.round(ok / (ok + miss) * 100) : null, topics: topics.size, games };
  }
  const a = stat(now - 7 * dayMs, now + 1), b = stat(now - 14 * dayMs, now - 7 * dayMs);
  // teacher's written comment — honest, data-driven, template-based (no AI cost)
  let comment;
  if (a.min === 0) {
    comment = lang === "th" ? "สัปดาห์นี้ยังไม่ได้เริ่มซ้อมเลยครับ ไม่เป็นไรเลย — เริ่มใหม่วันนี้ที่หน้า 'ซ้อมวันนี้' แค่วันละ 15 นาที เดี๋ยวสัปดาห์หน้าสมุดพกหน้านี้จะสวยขึ้นแน่นอนครับ"
      : lang === "zh" ? "这周还没开始练习也没关系 — 今天就从「今日练习」开始，每天15分钟，下周的成绩单一定会更漂亮。"
      : "No practice yet this week — that's okay! Start today with 'Practice Today', just 15 minutes a day, and next week's report will look very different.";
  } else {
    const p1 = lang === "th" ? `สัปดาห์นี้ซ้อม ${a.days} วัน รวม ${a.min} นาที` : lang === "zh" ? `本周练习 ${a.days} 天，共 ${a.min} 分钟` : `Practiced ${a.days} day(s) this week, ${a.min} minutes total`;
    let p2 = "";
    if (a.acc != null && b.acc != null) {
      const d = a.acc - b.acc;
      p2 = d >= 0
        ? (lang === "th" ? ` ความแม่นยำ ${a.acc}% ${d > 0 ? `ดีขึ้น +${d}% จากสัปดาห์ก่อน` : "คงที่"} — เยี่ยมมากครับ` : lang === "zh" ? ` 准确率 ${a.acc}%${d > 0 ? `，比上周提升 ${d}%` : "，保持稳定"} — 非常棒` : ` — accuracy ${a.acc}%${d > 0 ? `, up ${d}% from last week` : ", holding steady"} — excellent`)
        : (lang === "th" ? ` ความแม่นยำ ${a.acc}% ลดลงนิดหน่อย ไม่ต้องกังวลครับ ลองซ้อมช้าลงอีกนิดแล้วค่อยเร่ง` : lang === "zh" ? ` 准确率 ${a.acc}%，略有下降，别担心 — 先放慢再加速` : ` — accuracy ${a.acc}%, a little dip; slow the tempo down first, then speed up`);
    } else if (a.acc != null) {
      p2 = lang === "th" ? ` ความแม่นยำ ${a.acc}%` : lang === "zh" ? ` 准确率 ${a.acc}%` : ` — accuracy ${a.acc}%`;
    }
    const p3 = a.topics > 0
      ? (lang === "th" ? ` และได้เรียน ${a.topics} หัวข้อใหม่ รักษาจังหวะนี้ไว้นะครับ 💪` : lang === "zh" ? `，学习了 ${a.topics} 个主题。保持这个节奏！💪` : `, and covered ${a.topics} topic(s). Keep this rhythm going! 💪`)
      : (lang === "th" ? ` สัปดาห์หน้าลองเปิดหัวข้อใหม่ใน Pathway สักเรื่องนะครับ 💪` : lang === "zh" ? `。下周试着在学习之路开一个新主题吧！💪` : `. Next week, try opening one new Pathway topic! 💪`);
    comment = p1 + p2 + p3;
  }
  // 7-day minute bars — boundary must match dayKey()/dayDate() (currently UTC),
  // not device-local midnight, or these bars disagree with the "days" stat above
  const _n0 = new Date();
  const t0 = Date.UTC(_n0.getUTCFullYear(), _n0.getUTCMonth(), _n0.getUTCDate());
  const start7 = t0 - 6 * dayMs;
  const mins7 = Array(7).fill(0);
  for (const e of log) { const di = Math.floor((e.t - start7) / dayMs); if (di >= 0 && di < 7) mins7[di] += e.sec; }
  const maxM = Math.max(60, ...mins7);
  const WD = { th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"], en: ["S", "M", "T", "W", "T", "F", "S"], zh: ["日", "一", "二", "三", "四", "五", "六"] }[lang];
  const doneP = pathDoneSet();
  const name = (profile && profile.full_name) || T.student;
  async function saveWeekly() {
    if (busy) return; setBusy(true); playUi("click");
    try {
      const url = await renderWeeklyPNG({ name, mins: a.min, days: a.days, acc: a.acc, topics: a.topics, streak: (profile && profile.streak) || 0, lang });
      downloadDataURL(url, "tiga-weekly-report.png");
    } catch (e) {}
    setBusy(false);
  }
  async function saveCert(g) {
    if (busy) return; setBusy(true); playUi("reward");
    try {
      const url = await renderCertificatePNG({ name, course: g.icon + " " + g.label, dateStr: new Date().toLocaleDateString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB", { year: "numeric", month: "long", day: "numeric" }), lang });
      downloadDataURL(url, "tiga-certificate-" + g.id + ".png");
    } catch (e) {}
    setBusy(false);
  }
  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navProfile}
        </button>
      )}
      <div className="v12hero"><div className="v12title">🏅 {T.title}</div><div className="v12sub">{T.sub}</div></div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "8px" }}>{T.week}</div>
        <div style={{ display: "flex", gap: "7px", marginBottom: "12px" }}>
          <div className="instile"><b>{a.min}</b><span>{T.mins}</span></div>
          <div className="instile"><b>{a.days}/7</b><span>{T.days}</span></div>
          <div className="instile"><b>{a.acc == null ? "—" : a.acc + "%"}</b><span>{T.accL}</span></div>
          <div className="instile"><b>{a.topics}</b><span>{T.topicsL}</span></div>
          <div className="instile"><b>{a.games}</b><span>{T.gamesL}</span></div>
        </div>
        <div className="insbarwrap" style={{ height: "64px" }}>
          {mins7.map((m, i) => <div key={i} className="insbar" style={{ height: Math.max(3, Math.round(m / maxM * 88)) + "%", opacity: m > 0 ? 1 : 0.25 }} />)}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {mins7.map((_, i) => { const d = new Date(start7 + i * dayMs); return <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "8.5px", color: "#826575", fontFamily: "'Share Tech Mono',monospace" }}>{WD[d.getUTCDay()]}</div>; })}
        </div>
      </div>
      <div className="v12card" style={{ borderColor: "#d9775744" }}>
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "7px" }}>💬 {T.comment}</div>
        <div style={{ fontSize: "13.5px", color: "var(--text)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, lineHeight: 1.65 }}>{comment}</div>
      </div>
      <button className="tdgo" disabled={busy} onClick={saveWeekly} style={{ width: "100%", padding: "13px", fontSize: "11.5px", marginBottom: "16px" }}>{busy ? T.making : T.share}</button>
      <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", margin: "2px 2px 9px" }}>🎓 {T.certs}</div>
      {PATH_GROUPS[lang].map(g => {
        const stages = STAGES_BY_GROUP[g.id] || [];
        const done = stages.filter(s => doneP.has(s.id)).length;
        const earned = stages.length > 0 && done === stages.length;
        return (
          <div key={g.id} className={`certrow${earned ? " earned" : ""}`}>
            <span style={{ fontSize: "22px" }}>{earned ? "🏆" : g.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13.5px", color: earned ? "#d97757" : "var(--text2)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>{g.label}</div>
              <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>{done}/{stages.length}{earned ? "" : " · " + T.certLock}</div>
            </div>
            {earned && <button className="tdgo" style={{ borderColor: "#d97757", color: "#d97757", background: "rgba(217,119,87,.08)" }} disabled={busy} onClick={() => saveCert(g)}>{busy ? T.making : T.certGet}</button>}
          </div>
        );
      })}
    </div>
  );
});

/* ── Profile / Gamification page — avatar, level, EXP bar, stats & rank ladder ── */
/* ── Studio hub: choose Play-Along / Sight-Reading / Hand Coach ── */
const StudioPage = memo(function StudioPage({ lang, onVoice, onSongs, onSight, onCamera, onExam, onEarGym, onReading, onToday, voiceLocked = false }) {
  const lc = L[lang];
  const cards = [
    // Voice Mode is a Max-tier exclusive — other plans don't even see the card
    ...(voiceLocked ? [] : [{ k: "voice", ic: "🎙️", c: "#d97757", t: lc.studioVoice, s: lc.studioVoiceSub, fn: onVoice, badge: "👑 MAX" }]),
    { k: "today",   ic: "📅", c: "#d97757", t: lc.navToday,        s: lang === "th" ? "แผนซ้อมวันนี้ — สร้างใหม่ทุกวันจากความคืบหน้าจริง" : lang === "zh" ? "今日计划 — 每天根据真实进度生成" : "Today's plan — rebuilt daily from your real progress", fn: onToday },
    { k: "songs",   ic: "🎵", c: "#d97757", t: lc.studioPlayAlong, s: lc.studioPlayAlongSub, fn: onSongs },
    { k: "eargym",  ic: "👂", c: "#ff76d8", t: lc.navEar,          s: lc.studioEarSub,       fn: onEarGym },
    { k: "reading", ic: "🎼", c: "#ff94e0", t: lc.navRead,         s: lc.studioReadSub,      fn: onReading },
    { k: "exam",    ic: "🎓", c: "#d97757", t: lc.studioExam,      s: lc.studioExamSub,      fn: onExam, badge: "PRO" },
    { k: "sight",   ic: "📄", c: "#d97757", t: lc.studioSight,     s: lc.studioSightSub,     fn: onSight },
    { k: "camera",  ic: "✋", c: "#d97757", t: lc.studioCamera,    s: lc.studioCameraSub,    fn: onCamera },
  ];
  return (
    <div className="pathpage songpage">
      <div className="pathhero">
        <div className="pathhero-glow" />
        <div className="pathbadge">▶ STUDIO ▶</div>
        <h1 className="pathh1">{lc.studioTitle}</h1>
        <p className="pathguide">{lc.studioSub}</p>
      </div>
      <div className="songgrid">
        {cards.map(c => (
          <button key={c.k} className="songcard" style={{ "--sc": c.c }} onClick={c.fn}>
            <div className="songcard-ic">{c.ic}</div>
            <div className="songcard-body">
              <div className="songcard-nm">{c.t}{c.badge && <span className="songcard-badge">{c.badge}</span>}</div>
              <div className="songcard-meta"><span>{c.s}</span></div>
            </div>
            <span className="songcard-go">▶</span>
          </button>
        ))}
      </div>
    </div>
  );
});

// Extract a Google Drive file ID from any share-link format, or accept a bare ID —
// admin.google.com/.../file/d/ID/view, .../open?id=ID, .../uc?id=ID, or just the ID itself.
function driveFileId(input) {
  const s = String(input || "").trim();
  let m = s.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(s)) return s;
  return null;
}
// Extract a Google Drive FOLDER id from a folder share link — drive.google.com/drive/folders/ID(...).
// Whole-folder mode needs no Google API key: Google's own embeddedfolderview iframe renders the
// folder's file browser directly (grid/list of everything shared "Anyone with the link"), so
// connecting a folder works immediately without any extra setup.
function driveFolderId(input) {
  const s = String(input || "").trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);
  return m ? m[1] : null;
}

/* ── Vertical video lessons — teaching videos hosted on the admin's own Google
   Drive (not stored on our servers — Drive serves the bytes straight to the
   viewer's browser), TikTok-style feed. Only the slide currently in view has
   its embed loaded, so at most one video plays at a time and nothing loads
   until it's actually scrolled to. ── */
// Raw playback candidates for a public Drive file, most-reliable first. <video>
// elements don't need CORS to play cross-origin media, and drive.usercontent is
// Google's current direct-download host (confirm=t skips the big-file warning).
function rawVideoUrls(fileId) {
  return [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
  ];
}
// TikTok-style count formatting: 999 → "999", 1400 → "1.4K", 2.3M …
function fmtLikes(n) {
  if (!n) return "";
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
}
// local bookmark (🔖) state per video
function readVidFav(id) { try { return !!JSON.parse(localStorage.getItem("tg_vidfavs") || "{}")[id]; } catch (e) { return false; } }
function writeVidFav(id, v) { try { const m = JSON.parse(localStorage.getItem("tg_vidfavs") || "{}"); if (v) m[id] = 1; else delete m[id]; localStorage.setItem("tg_vidfavs", JSON.stringify(m)); } catch (e) {} }
// One TikTok-style slide: full-bleed native <video>, tap = pause/play, speaker
// button = mute toggle, thin progress bar. If EVERY raw URL fails (Google
// changes behavior, file too big to stream, permissions), the slide quietly
// swaps to Google's own preview player so the lesson still plays no matter what.
function VideoSlide({ s, active, preload, lang, onEnded, onAsk, likeN, likedByMe, onToggleLike }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const vidRef = useRef(null);
  const barRef = useRef(null);
  const tapT = useRef(null);
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [faved, setFaved] = useState(() => readVidFav(s.fileId));
  const [hearts, setHearts] = useState([]);
  const srcs = rawVideoUrls(s.fileId);
  const mounted = active || preload; // preload: the slide right after active buffers
  // quietly in the background (muted, hidden, paused) so auto-advance on "ended"
  // plays the next clip instantly instead of starting its fetch from zero. The
  // <video> tag stays the SAME element across the preload→active transition
  // (same JSX position/type below) so the browser's buffered data carries over.
  useEffect(() => {
    const v = vidRef.current;
    if (!v || failed) return;
    if (active) {
      v.muted = false; setMuted(false); setPaused(false);
      const p = v.play();
      // browsers may veto unmuted autoplay — retry muted with a visible unmute button
      if (p && p.catch) p.catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
    } else if (preload) {
      v.muted = true; // never plays here — just lets the browser buffer ahead
    }
    return () => clearTimeout(tapT.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, preload, failed, srcIdx]);
  const spawnHeart = (x, y) => {
    const id = Date.now() + Math.random();
    setHearts(h => [...h.slice(-5), { id, x, y, rot: -18 + Math.random() * 36 }]);
    setTimeout(() => setHearts(h => h.filter(o => o.id !== id)), 820);
  };
  // TikTok tap grammar: single tap = pause/play, double tap = like + floating heart
  const onTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (tapT.current) {
      clearTimeout(tapT.current); tapT.current = null;
      if (!likedByMe && onToggleLike) onToggleLike();
      spawnHeart(x, y);
    } else {
      tapT.current = setTimeout(() => {
        tapT.current = null;
        const v = vidRef.current; if (!v) return;
        if (v.paused) { v.play().catch(() => {}); setPaused(false); } else { v.pause(); setPaused(true); }
      }, 260);
    }
  };
  if (!mounted) return <div className="vidplaceholder">🎬</div>;
  const rail = !active ? null : (
    <div className="vidrail" onClick={e => e.stopPropagation()}>
      <button className={`vidact${likedByMe ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); if (onToggleLike) onToggleLike(); }}>
        <span className="vidact-ic">❤️</span>
        <span className="vidact-n">{fmtLikes(likeN) || T("ถูกใจ", "Like", "赞")}</span>
      </button>
      <button className="vidact" onClick={(e) => { e.stopPropagation(); if (onAsk) onAsk(s.title); }}>
        <span className="vidact-ic">💬</span>
        <span className="vidact-n">{T("ถามครู", "Ask AI", "问老师")}</span>
      </button>
      <button className={`vidact${faved ? " fav" : ""}`} onClick={(e) => { e.stopPropagation(); const v = !faved; setFaved(v); writeVidFav(s.fileId, v); }}>
        <span className="vidact-ic">🔖</span>
        <span className="vidact-n">{T("บันทึก", "Save", "收藏")}</span>
      </button>
    </div>
  );
  const heartsJsx = hearts.map(hh => (
    <span key={hh.id} className="vidheart" style={{ left: hh.x - 37, top: hh.y - 37 }}>
      <span style={{ display: "inline-block", transform: `rotate(${hh.rot}deg)` }}>❤️</span>
    </span>
  ));
  if (failed) {
    // raw stream unavailable → Google's own player, but only once this slide is
    // actually active (never show/load an iframe for an off-screen preload slide)
    if (!active) return <div className="vidplaceholder">🎬</div>;
    return (
      <>
        <iframe className="vidplayer" src={`https://drive.google.com/file/d/${s.fileId}/preview`}
          allow="autoplay; encrypted-media" allowFullScreen frameBorder="0" title={s.title} />
        {rail}
      </>
    );
  }
  return (
    <>
      <video ref={vidRef} className="vidplayer" src={srcs[srcIdx]} playsInline preload="auto"
        style={!active ? { visibility: "hidden" } : undefined}
        onEnded={() => { if (active && onEnded) onEnded(); }}
        onError={() => { if (srcIdx + 1 < srcs.length) setSrcIdx(srcIdx + 1); else setFailed(true); }}
        onTimeUpdate={() => { if (!active) return; const v = vidRef.current, b = barRef.current; if (v && b && v.duration) b.style.width = ((v.currentTime / v.duration) * 100) + "%"; }}
        onClick={active ? onTap : undefined} />
      {active && paused && <div className="vidpause">▶</div>}
      {active && (
        <button className="vidmute" onClick={(e) => { e.stopPropagation(); const v = vidRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); if (!v.muted) v.play().catch(() => {}); }}>
          {muted ? "🔇" : "🔊"}
        </button>
      )}
      {rail}
      {active && heartsJsx}
      {active && <div className="vidbar"><span ref={barRef} /></div>}
    </>
  );
}
const VideoLessonsPage = memo(function VideoLessonsPage({ lang, onAsk }) {
  const lc = L[lang];
  const [slides, setSlides] = useState(null); // null = loading
  const [activeKey, setActiveKey] = useState(null);
  const [likes, setLikes] = useState({});     // fileId -> {n, me} — REAL cross-user like counts
  const slideRefs = useRef([]);
  function toggleLike(fid) {
    const cur = likes[fid] || { n: 0, me: false };
    const next = cur.me ? { n: Math.max(0, cur.n - 1), me: false } : { n: cur.n + 1, me: true };
    setLikes(p => ({ ...p, [fid]: next })); // optimistic — the write follows in the background
    playUi("click"); haptic(8);
    sb.auth.getSession().then(({ data }) => {
      const uid = data && data.session && data.session.user && data.session.user.id;
      if (!uid) return;
      if (cur.me) sb.from("video_likes").delete().eq("user_id", uid).eq("file_id", fid).then(() => {}, () => {});
      else sb.from("video_likes").insert({ user_id: uid, file_id: fid }).then(() => {}, () => {});
    }, () => {});
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await sb.from("lesson_videos").select("*").eq("published", true)
        .order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = error ? [] : (data || []);
      // expand folder rows into one slide PER VIDEO FILE, listed via the drive-list
      // edge function (server-side, no API key) and sorted by filename
      const folderIds = [...new Set(rows.filter(r => r.drive_folder_id).map(r => r.drive_folder_id))];
      const folderMap = {};
      if (folderIds.length) {
        try {
          const { data: fl, error: fe } = await sb.functions.invoke("drive-list", { body: { folders: folderIds } });
          if (!fe && fl && fl.folders) for (const f of fl.folders) folderMap[f.folder] = f.items || [];
        } catch (e) {}
      }
      const isVid = (n) => /\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(n);
      const out = [];
      for (const r of rows) {
        if (r.drive_folder_id) {
          let items = folderMap[r.drive_folder_id] || [];
          if (items.some(it => isVid(it.name))) items = items.filter(it => isVid(it.name));
          for (const it of items) out.push({ key: r.id + "-" + it.id, fileId: it.id, title: it.name.replace(/\.[a-z0-9]{2,4}$/i, ""), desc: r.title });
          // listing unavailable → fall back to embedding the whole folder so nothing disappears
          if (!items.length) out.push({ key: r.id, folderId: r.drive_folder_id, title: r.title, desc: r.description });
        } else if (r.drive_file_id) {
          out.push({ key: r.id, fileId: r.drive_file_id, title: r.title, desc: r.description });
        }
      }
      if (cancelled) return;
      setSlides(out);
      if (out.length) setActiveKey(out[0].key);
      // pull the real like counts for every video in one call
      const ids = [...new Set(out.filter(x => x.fileId).map(x => x.fileId))];
      if (ids.length) {
        sb.rpc("get_video_like_counts", { ids }).then(({ data: lk }) => {
          if (cancelled || !lk) return;
          const m = {};
          for (const r of lk) m[r.file_id] = { n: Number(r.likes) || 0, me: !!r.liked_by_me };
          setLikes(m);
        }, () => {});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // TikTok-style: whichever slide is mostly in view becomes "active" — only ITS
  // player is mounted (loads/plays); scrolling away unmounts it (stops audio + bandwidth).
  useEffect(() => {
    if (!slides || !slides.length) return;
    const els = slideRefs.current.filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActiveKey(e.target.dataset.vid);
    }, { threshold: [0, 0.6, 1] });
    els.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [slides]);

  if (slides === null) return <div className="pathpage"><div className="admstu-empty">…</div></div>;
  if (!slides.length) return (
    <div className="pathpage">
      <div className="pathhero"><div className="pathhero-glow" /><div className="pathbadge">🎬 {lc.navVideos}</div></div>
      <div className="admstu-empty">{lc.videosEmpty}</div>
    </div>
  );
  // a finished clip auto-advances the feed to the next slide (binge flow) —
  // scrolling it into view flips the IntersectionObserver's "active" slide,
  // which mounts that video and autoplays it. After the last clip, wrap to
  // the first (instant jump — smooth-scrolling back across 17 slides is dizzy).
  const advance = (i) => {
    const next = (i + 1) % slides.length;
    const el = slideRefs.current[next];
    if (el) el.scrollIntoView({ behavior: next > i ? "smooth" : "auto", block: "start" });
  };
  const activeIdx = slides.findIndex(s => s.key === activeKey);
  const preloadKey = activeIdx >= 0 ? slides[(activeIdx + 1) % slides.length].key : null;
  return (
    <div className="vidfeed">
      {slides.map((s, i) => (
        <div className="vidslide" key={s.key} data-vid={s.key} ref={el => (slideRefs.current[i] = el)}>
          {s.folderId ? (
            activeKey === s.key
              ? <iframe className="vidplayer" src={`https://drive.google.com/embeddedfolderview?id=${s.folderId}#grid`}
                  allow="autoplay; encrypted-media" allowFullScreen frameBorder="0" title={s.title} />
              : <div className="vidplaceholder">🎬</div>
          ) : (
            <VideoSlide s={s} active={activeKey === s.key} preload={preloadKey === s.key} lang={lang} onEnded={() => advance(i)} onAsk={onAsk}
              likeN={(likes[s.fileId] || {}).n || 0} likedByMe={!!(likes[s.fileId] || {}).me} onToggleLike={() => toggleLike(s.fileId)} />
          )}
          <div className="vidtopfade" />
        </div>
      ))}
    </div>
  );
});

/* ── Song picker page (falling-notes play-along) ── */
const SONG_REQ = { 1: 1, 2: 2, 3: 4 };   // level required to unlock by difficulty
const SongListPage = memo(function SongListPage({ lang, onPlay, onBack, level = 1, premium = false, onUpsell }) {
  const lc = L[lang];
  const [filter, setFilter] = useState(-1);   // -1 all · 0 favorites · 1/2/3 by difficulty
  const [favs, setFavs] = useState(() => { try { return JSON.parse(localStorage.getItem("tg_favs") || "[]"); } catch (e) { return []; } });
  const toggleFav = (id) => setFavs(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    try { localStorage.setItem("tg_favs", JSON.stringify(next)); } catch (e) {}
    return next;
  });
  const [mySongs, setMySongs] = useState(() => { try { return JSON.parse(localStorage.getItem("tg_mysongs") || "[]"); } catch (e) { return []; } });
  const [createOpen, setCreateOpen] = useState(false);
  const [genText, setGenText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState(false);
  // Play-Along categories: songs · scales · chords · intervals (all on this one page)
  const [cat, setCat] = useState("songs");
  const [minorType, setMinorType] = useState("natural minor");
  const [triadQual, setTriadQual] = useState("major");
  const [seventhQual, setSeventhQual] = useState("maj7");
  const play = (s) => { try { localStorage.setItem("tg_last_song", s.id); } catch (e) {} onPlay(s); };
  let lastId = null; try { lastId = localStorage.getItem("tg_last_song"); } catch (e) {}
  const ALL = [...mySongs, ...SONGS];
  const lastSong = lastId ? ALL.find(s => s.id === lastId) : null;

  async function generateSong() {
    if (!genText.trim() || generating) return;
    if (!canUse("song")) { setCreateOpen(false); if (onUpsell) onUpsell(); return; }
    setGenerating(true); setGenErr(false);
    try {
      const sys = "You turn a song request into a simple one-hand beginner piano melody for a falling-notes game. Output ONLY valid minified JSON, no prose, no markdown: {\"name\":string,\"bpm\":number,\"seq\":[[note,beats],...]}. Notes use scientific names from C4 to B5 only; use \"R\" for a rest; beats are 0.5, 1, 1.5 or 2. Keep it 16-48 notes and recognizable.";
      const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify({ message: "Create this song: " + genText, conversationHistory: [], system: sys }) });
      if (!res.ok || !res.body) throw new Error("http");
      const reader = res.body.getReader(), dec = new TextDecoder();
      let acc = "", buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) { const t = line.trim(); if (!t.startsWith("data:")) continue; const p = t.slice(5).trim(); if (!p || p === "[DONE]") continue; try { const e = JSON.parse(p); if (e.content) acc += e.content; } catch (_) {} }
      }
      const jm = acc.match(/\{[\s\S]*\}/); if (!jm) throw new Error("no json");
      const obj = JSON.parse(jm[0]);
      const seq = normalizeSeq(obj.seq || []);
      if (seq.length < 6 || !seq.some(x => x[0] !== "R")) throw new Error("short");
      const name = String(obj.name || genText).slice(0, 40);
      const bpm = Math.min(180, Math.max(60, Math.round(obj.bpm || 100)));
      const song = { id: "my_" + Date.now(), diff: 1, bpm, custom: true, th: name, en: name, zh: name, seq };
      const saved = [song, ...mySongs].slice(0, 20);
      setMySongs(saved); try { localStorage.setItem("tg_mysongs", JSON.stringify(saved)); } catch (e) {}
      if (!premium) bumpUsage("song");
      setCreateOpen(false); setGenText(""); setGenerating(false);
      play(song);
    } catch (e) { setGenErr(true); setGenerating(false); }
  }
  function delSong(id) {
    const saved = mySongs.filter(s => s.id !== id);
    setMySongs(saved); try { localStorage.setItem("tg_mysongs", JSON.stringify(saved)); } catch (e) {}
  }

  const filters = [
    { k: -1, label: lc.songAll }, { k: 0, label: "★ " + lc.songFav },
    { k: 1, label: "★" }, { k: 2, label: "★★" }, { k: 3, label: "★★★" },
  ];
  let list = ALL.slice();
  if (filter === 0) list = list.filter(s => favs.includes(s.id));
  else if (filter > 0) list = list.filter(s => s.diff === filter && !s.custom);
  list.sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || (favs.includes(b.id) ? 1 : 0) - (favs.includes(a.id) ? 1 : 0) || a.diff - b.diff);

  const Card = (s, pfx = "") => {
    const hue = laneHue(s.seq.find(x => x[0] !== "R")[0]);
    const isFav = favs.includes(s.id);
    const req = SONG_REQ[s.diff] || 1;
    const locked = !s.custom && level < req;
    return (
      <button key={pfx + s.id} className={`songcard${locked ? " locked" : ""}`} style={{ "--sc": `hsl(${hue},70%,56%)` }}
        onClick={() => { if (locked) { haptic(20); playMiss(); } else play(s); }}>
        <div className="songcard-ic">{locked ? "🔒" : s.custom ? "🎼" : "🎵"}</div>
        <div className="songcard-body">
          <div className="songcard-nm">{tr(s, lang)}</div>
          <div className="songcard-meta">
            <span className="songdiff" aria-label={`difficulty ${s.diff}`}>{s.custom ? "✨ AI" : "★".repeat(s.diff) + "☆".repeat(3 - s.diff)}</span>
            <span>{locked ? lc.lockedLv + req : s.bpm + " BPM"}</span>
          </div>
        </div>
        <span className="songcard-go">{locked ? "🔒" : "▶"}</span>
        {s.custom
          ? <span className="favbtn del" role="button" tabIndex={0} aria-label="Delete" onClick={(e) => { e.stopPropagation(); haptic(); delSong(s.id); }}>🗑</span>
          : !locked && <span className={`favbtn${isFav ? " on" : ""}`} role="button" tabIndex={0} aria-label="Favorite" aria-pressed={isFav}
            onClick={(e) => { e.stopPropagation(); haptic(); toggleFav(s.id); }}>{isFav ? "★" : "☆"}</span>}
      </button>
    );
  };
  // A drill card (scale / chord / interval) — no lock, no fav, just launch.
  const DrillCard = (s, icon) => {
    const fn = s.seq.find(x => x[0] !== "R");
    const nNotes = s.seq.filter(x => x[0] !== "R").length;
    return (
      <button key={s.id} className="songcard" style={{ "--sc": `hsl(${laneHue(fn[0])},70%,56%)` }} onClick={() => play(s)}>
        <div className="songcard-ic">{icon}</div>
        <div className="songcard-body">
          <div className="songcard-nm">{tr(s, lang)}</div>
          <div className="songcard-meta"><span>{s.bpm} BPM</span><span>{nNotes} {lang === "th" ? "โน้ต" : lang === "zh" ? "音符" : "notes"}</span></div>
        </div>
        <span className="songcard-go">▶</span>
      </button>
    );
  };

  // top-level Play-Along categories (everything lives on this one page)
  const cats = [
    { k: "songs",    ic: "🎵", t: { th: "เพลง",        en: "Songs",       zh: "歌曲" } },
    { k: "major",    ic: "🎼", t: { th: "เมเจอร์สเกล",  en: "Major Scales", zh: "大调音阶" } },
    { k: "minor",    ic: "🎹", t: { th: "ไมเนอร์สเกล",  en: "Minor Scales", zh: "小调音阶" } },
    { k: "triad",    ic: "🎶", t: { th: "ไทรแอด",       en: "Triads",      zh: "三和弦" } },
    { k: "seventh",  ic: "🎷", t: { th: "คอร์ด 7",      en: "7th Chords",  zh: "七和弦" } },
    { k: "interval", ic: "📏", t: { th: "ขั้นคู่",        en: "Intervals",   zh: "音程" } },
  ];
  const drillList = cat === "major" ? MAJOR_SCALE_SONGS
    : cat === "minor" ? (MINOR_SCALE_SONGS[minorType] || [])
    : cat === "triad" ? (TRIAD_SONGS[triadQual] || [])
    : cat === "seventh" ? (SEVENTH_SONGS[seventhQual] || [])
    : cat === "interval" ? INTERVAL_SONGS : [];
  const drillIcon = cat === "interval" ? "📏" : (cat === "triad" || cat === "seventh") ? "🎶" : cat === "minor" ? "🎹" : "🎼";
  const drillHint = lang === "th" ? "แตะการ์ดเพื่อเริ่ม — โน้ตจะไหลลงมา เล่นตามให้ตรง (ขึ้นแล้วลง)"
    : lang === "zh" ? "点击卡片开始 — 音符会落下，跟着弹（上行再下行）"
    : "Tap a card to start — notes fall, play along up then down";

  return (
    <div className="pathpage songpage">
      <div className="pathhero">
        <div className="pathhero-glow" />
        {onBack && <button className="studioback" onClick={onBack}>‹ {lc.back}</button>}
        <div className="pathbadge">♪ PLAY ALONG ♪</div>
        <h1 className="pathh1">{lc.songsTitle}</h1>
        <p className="pathguide">{lc.songsSub}</p>
      </div>
      {/* category selector — Songs · Scales · Chords · Intervals */}
      <div className="songfilters">
        {cats.map(c => (
          <button key={c.k} className={`songfilter${cat === c.k ? " on" : ""}`} onClick={() => { haptic(); setCat(c.k); }}>
            {c.ic} {tr(c.t, lang)}
          </button>
        ))}
      </div>

      {cat === "songs" ? (
        <>
          <div className="songfilters">
            {filters.map(f => <button key={f.k} className={`songfilter${filter === f.k ? " on" : ""}`} onClick={() => setFilter(f.k)}>{f.label}</button>)}
          </div>
          <button className="aicreate" onClick={() => { setGenErr(false); setCreateOpen(true); }}>✨ {lc.aiCreate}</button>
          {createOpen && (
            <div className="setov" onClick={() => !generating && setCreateOpen(false)}>
              <div className="setcard" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="sethdr"><span>✨ {lc.aiCreate}</span><button className="cbtn" onClick={() => !generating && setCreateOpen(false)}>{lc.close}</button></div>
                <div className="setbody">
                  <p className="aicreate-hint">{lc.aiCreateHint}</p>
                  <input className="aicreate-in" value={genText} onChange={e => setGenText(e.target.value)}
                    placeholder={lc.aiCreatePh} onKeyDown={e => { if (e.key === "Enter") generateSong(); }} disabled={generating} />
                  {genErr && <div className="aicreate-err">{lc.aiCreateErr}</div>}
                  <button className="songbtn go" style={{ width: "100%", marginTop: 12 }} onClick={generateSong} disabled={generating || !genText.trim()}>
                    {generating ? "⏳ " + lc.aiCreating : "✨ " + lc.aiCreateGo}
                  </button>
                </div>
              </div>
            </div>
          )}
          {lastSong && filter === -1 && (
            <div className="songcontinue">
              <div className="songcontinue-lbl">↻ {lc.songContinue}</div>
              {Card(lastSong, "c-")}
            </div>
          )}
          <div className="songgrid">
            {list.length ? list.map(s => Card(s)) : <div className="songempty">{lc.songFavEmpty}</div>}
          </div>
        </>
      ) : (
        <>
          {cat === "minor" && (
            <div className="songfilters">
              {MINOR_TYPES.map(t => <button key={t.key} className={`songfilter${minorType === t.key ? " on" : ""}`} onClick={() => { haptic(); setMinorType(t.key); }}>{tr(t, lang)}</button>)}
            </div>
          )}
          {cat === "triad" && (
            <div className="songfilters">
              {TRIAD_TYPES.map(t => <button key={t.key} className={`songfilter${triadQual === t.key ? " on" : ""}`} onClick={() => { haptic(); setTriadQual(t.key); }}>{tr(t, lang)}</button>)}
            </div>
          )}
          {cat === "seventh" && (
            <div className="songfilters">
              {SEVENTH_TYPES.map(t => <button key={t.key} className={`songfilter${seventhQual === t.key ? " on" : ""}`} onClick={() => { haptic(); setSeventhQual(t.key); }}>{tr(t, lang)}</button>)}
            </div>
          )}
          <p className="drillhint">{drillHint}</p>
          <div className="songgrid">
            {drillList.map(s => DrillCard(s, drillIcon))}
          </div>
        </>
      )}
    </div>
  );
});

/* ── Single note on a treble OR bass staff (for sight-reading) ── */
const StaffSVG = memo(function StaffSVG({ note, clef = "treble" }) {
  const step = note ? staffStep(note, clef) : 0;
  const W = 280, H = 168, baseY = 116, half = 9; // baseY = bottom staff line
  const y = baseY - step * half, noteX = 190;
  const lineYs = [0, 2, 4, 6, 8].map(s => baseY - s * half);
  const ledgers = [];
  for (let s = -2; s >= step; s -= 2) ledgers.push(baseY - s * half);
  for (let s = 10; s <= step; s += 2) ledgers.push(baseY - s * half);
  const stemUp = step < 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="staffsvg" width="100%" preserveAspectRatio="xMidYMid meet">
      {lineYs.map((ly, i) => <line key={i} x1="14" y1={ly} x2={W - 14} y2={ly} stroke="var(--muted)" strokeWidth="1.4" />)}
      {clef === "bass"
        ? <text x="20" y={baseY - 2 * half + 4} fontSize="64" fill="var(--text)" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>&#119074;</text>
        : <text x="18" y={baseY + 6} fontSize="78" fill="var(--text)" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>&#119070;</text>}
      {ledgers.map((ly, i) => <line key={"l" + i} x1={noteX - 16} y1={ly} x2={noteX + 16} y2={ly} stroke="var(--muted)" strokeWidth="1.4" />)}
      <line x1={stemUp ? noteX + 9 : noteX - 9} y1={y} x2={stemUp ? noteX + 9 : noteX - 9} y2={y + (stemUp ? -46 : 46)} stroke="#d97757" strokeWidth="2.4" />
      <ellipse cx={noteX} cy={y} rx="10" ry="7.5" fill="#d97757" transform={`rotate(-18 ${noteX} ${y})`} />
    </svg>
  );
});

/* ── Several notes on one staff, with names underneath (voice-mode [staff:]).
   hideNames + clef props let the Reading course reuse it as a quiz card
   (names would spoil the answer; bass drills must force the bass clef). ── */
const StaffNotes = memo(function StaffNotes({ notes, hideNames = false, clef: clefProp = null }) {
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

/* ── Leaderboard (top players by EXP) — privacy-safe RPC, names + stats only ── */
const LeaderboardSection = memo(function LeaderboardSection({ lang }) {
  const lc = L[lang];
  const [rows, setRows] = useState(null); // null = loading
  const [myRank, setMyRank] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await sb.rpc("get_leaderboard", { limit_n: 20 });
        if (error) throw error;
        if (!alive) return;
        setRows(data || []);
        const me = (data || []).find(r => r.is_me);
        if (me) { setMyRank(me.rank); return; }
        const r = await sb.rpc("get_my_rank");
        if (alive && !r.error) setMyRank(r.data);
      } catch (e) { if (alive) setErr(true); }
    })();
    return () => { alive = false; };
  }, []);
  const medals = ["", "🥇", "🥈", "🥉"];
  return (
    <div className="profsec">
      <div className="profsec-h">
        {lc.lbTitle}
        {myRank != null && <span className="lbmine">{lc.lbYou} #{myRank}</span>}
      </div>
      {err ? <div className="lbempty">{lc.lbErr}</div>
        : rows == null ? <div className="lbempty">{lc.lbLoad}</div>
        : rows.length === 0 ? <div className="lbempty">{lc.lbEmpty}</div>
        : <>
            {rows.length >= 3 && (
              <div className="lbpodium">
                {[2, 1, 3].map(pos => {
                  const r = rows[pos - 1];
                  return (
                    <div key={pos} className={`lbpod p${pos}${r.is_me ? " me" : ""}`}>
                      <div className="lbpod-medal">{medals[pos]}</div>
                      <div className="lbpod-ava">{(r.name || "?").trim().slice(0, 1).toUpperCase()}</div>
                      <div className="lbpod-nm">{r.name}</div>
                      <div className="lbpod-exp">{r.exp.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {(() => {
              const meIdx = rows.findIndex(r => r.is_me);
              if (meIdx > 0) {
                const gap = rows[meIdx - 1].exp - rows[meIdx].exp;
                if (gap > 0) return <div className="lbtonext">↑ {gap.toLocaleString()} EXP → #{rows[meIdx].rank - 1}</div>;
              }
              return null;
            })()}
            <div className="lblist">
              {rows.filter(r => r.rank > 3).map((r, i) => (
                <div key={i} className={`lbrow${r.is_me ? " me" : ""}`} style={{ animationDelay: (i * 35) + "ms" }}>
                  <span className="lbrank">{r.rank}</span>
                  <span className="lbname">{r.name}{r.is_me ? ` · ${lc.lbYouTag}` : ""}</span>
                  <span className="lbexp">{r.exp.toLocaleString()} <small>EXP</small></span>
                </div>
              ))}
            </div>
          </>}
    </div>
  );
});

/* ── practice activity log (localStorage) powering the progress dashboard ── */
const PRACTICE_LOG_KEY = "tg_practice_log";
function dayKey(d = new Date()) { const z = dayDate(d); return z.getFullYear() + "-" + String(z.getMonth() + 1).padStart(2, "0") + "-" + String(z.getDate()).padStart(2, "0"); }
function readPracticeLog() { try { return JSON.parse(localStorage.getItem(PRACTICE_LOG_KEY) || "{}") || {}; } catch (e) { return {}; } }
function logPractice(acc) {
  try {
    const log = readPracticeLog();
    const k = dayKey();
    const e = log[k] || { n: 0, accSum: 0 };
    e.n += 1; e.accSum += Math.round(acc || 0);
    log[k] = e;
    const recent = Array.isArray(log._recent) ? log._recent : [];
    recent.push({ d: k, acc: Math.round(acc || 0) });
    log._recent = recent.slice(-30);
    localStorage.setItem(PRACTICE_LOG_KEY, JSON.stringify(log));
  } catch (e) {}
  bumpStreak();   // a finished session counts toward the daily streak
}
// record EXP earned per day so the dashboard can chart growth over time
function logExpGain(amount) {
  try {
    if (!amount) return;
    const log = readPracticeLog(), k = dayKey();
    const e = log[k] || { n: 0, accSum: 0 };
    e.exp = (e.exp || 0) + Math.round(amount);
    log[k] = e;
    localStorage.setItem(PRACTICE_LOG_KEY, JSON.stringify(log));
  } catch (e) {}
}
// per-play log of falling-notes song games (for the profile game-stats bars)
const GAME_LOG_KEY = "tg_game_log";
function readGameLog() { try { return JSON.parse(localStorage.getItem(GAME_LOG_KEY) || "[]") || []; } catch (e) { return []; } }
function logGame(g) {
  try {
    const log = readGameLog();
    log.push({ d: dayKey(), t: Date.now(), song: g.song || "", acc: Math.round(g.acc || 0), score: g.score || 0, stars: g.stars || 0 });
    localStorage.setItem(GAME_LOG_KEY, JSON.stringify(log.slice(-80)));
  } catch (e) {}
}
const HEAT_COLORS = ["#231c17", "#5c3a24", "#a3602f", "#d97757"];
function heatColor(l) { return HEAT_COLORS[l] || HEAT_COLORS[0]; }

/* ════════════════════════════════════════════════════════════
   ACTIVITY LOG — one unified local journal of everything practiced
   (what, how accurate, how long). The Today plan, Insights page and
   weekly Report Card are all views over this single stream, so every
   mode only has to report here once.
════════════════════════════════════════════════════════════ */
const ACT_LOG_KEY = "tg_act_log";
function readActLog() { try { return JSON.parse(localStorage.getItem(ACT_LOG_KEY) || "[]") || []; } catch (e) { return []; } }
function logActivity(kind, id, ok, miss, sec) {
  try {
    const a = readActLog();
    a.push({ t: Date.now(), d: dayKey(), k: kind, id: String(id || ""), ok: Math.max(0, Math.round(ok || 0)), miss: Math.max(0, Math.round(miss || 0)), sec: Math.max(0, Math.round(sec || 0)) });
    localStorage.setItem(ACT_LOG_KEY, JSON.stringify(a.slice(-1500)));
  } catch (e) {}
}

// Admin broadcast popup — which id this device has already dismissed, so a re-check
// (poll, reload, relaunch) doesn't show the same announcement again.
const BROADCAST_SEEN_KEY = "tg_broadcast_seen";
function readBroadcastSeen() { try { return localStorage.getItem(BROADCAST_SEEN_KEY); } catch (e) { return null; } }
function markBroadcastSeen(id) { try { localStorage.setItem(BROADCAST_SEEN_KEY, String(id)); } catch (e) {} }

// Auto Teaching tip history (local, same pattern as the practice/activity logs above) —
// powers the small "recent tips" dashboard list. Not synced server-side.
const AUTOTEACH_LOG_KEY = "tg_autoteach_log";
function readAutoTeachLog() { try { return JSON.parse(localStorage.getItem(AUTOTEACH_LOG_KEY) || "[]") || []; } catch (e) { return []; } }
function logAutoTeachTip(weakness, tip, feature) {
  try {
    const log = readAutoTeachLog();
    log.push({ t: Date.now(), d: dayKey(), weakness: String(weakness || ""), tip: String(tip || ""), feature: feature || "pathway" });
    localStorage.setItem(AUTOTEACH_LOG_KEY, JSON.stringify(log.slice(-50)));
  } catch (e) {}
}
// friendly display label for an activity entry (drill ids, "stage/key" lessons, …)
function actTopicLabel(e, lang) {
  if (e.k === "lesson" || e.k === "read-chapter") {
    const [sid, key] = e.id.split("/");
    const st = PATHWAY.find(s => s.id === sid);
    const base = st ? tr(st.title, lang) : sid;
    return key ? base + " · " + key.toUpperCase() : base;
  }
  if (e.k === "game") {
    const all = [...SONGS, ...MAJOR_SCALE_SONGS, ...INTERVAL_SONGS,
      ...Object.values(MINOR_SCALE_SONGS).flat(), ...Object.values(TRIAD_SONGS).flat(), ...Object.values(SEVENTH_SONGS).flat()];
    const s = all.find(x => x.id === e.id);
    return s ? tr(s, lang) : e.id;
  }
  if (e.k === "ear") return (lang === "th" ? "ยิมหู · " : lang === "zh" ? "听力房 · " : "Ear gym · ") + e.id;
  if (e.k === "read") return (lang === "th" ? "อ่านโน้ต · " : lang === "zh" ? "识谱 · " : "Reading · ") + e.id;
  if (e.k === "voice") return lang === "th" ? "คาบเรียนโหมดเสียง" : lang === "zh" ? "语音课" : "Voice lesson";
  return e.id;
}
// find the runnable game/drill meta for an activity entry (for "practice this now")
function actSongOf(e) {
  if (e.k !== "game") return null;
  const all = [...SONGS, ...MAJOR_SCALE_SONGS, ...INTERVAL_SONGS,
    ...Object.values(MINOR_SCALE_SONGS).flat(), ...Object.values(TRIAD_SONGS).flat(), ...Object.values(SEVENTH_SONGS).flat()];
  return all.find(x => x.id === e.id) || null;
}

/* ── "Practice Today" plan — deterministic per calendar day ── */
function daySeed() { return [...dayKey()].reduce((s, c) => s + c.charCodeAt(0), 0); }
function todayEntries() { const d = dayKey(); return readActLog().filter(e => e.d === d); }
function hwDoneToday() { try { return localStorage.getItem("tg_hw_done") === dayKey(); } catch (e) { return false; } }
function markHwDone() { try { localStorage.setItem("tg_hw_done", dayKey()); } catch (e) {} }
function todayBonusClaimed() { try { return localStorage.getItem("tg_today_bonus") === dayKey(); } catch (e) { return false; } }
function claimTodayBonus() { try { localStorage.setItem("tg_today_bonus", dayKey()); } catch (e) {} }

/* ── Reading-course progress (stars per level) ── */
function readCourseStars() { try { return JSON.parse(localStorage.getItem("tg_readcourse") || "{}") || {}; } catch (e) { return {}; } }
function setReadCourseStars(lvl, stars) {
  try { const s = readCourseStars(); if ((s[lvl] || 0) < stars) { s[lvl] = stars; localStorage.setItem("tg_readcourse", JSON.stringify(s)); } } catch (e) {}
}
/* ── Ear-gym personal bests ── */
function earBest() { try { return JSON.parse(localStorage.getItem("tg_eargym") || "{}") || {}; } catch (e) { return {}; } }
function setEarBest(game, score) {
  try { const s = earBest(); if ((s[game] || 0) < score) { s[game] = score; localStorage.setItem("tg_eargym", JSON.stringify(s)); } } catch (e) {}
}

/* ════════════════════════════════════════════════════════════
   CERTIFICATES & SHARE CARDS — drawn on a canvas so the learner gets a
   real PNG they can keep, print, or post. No servers, no libraries.
════════════════════════════════════════════════════════════ */
function downloadDataURL(url, fname) {
  try { const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
}
async function renderCertificatePNG({ name, course, dateStr, lang }) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  const W = 1200, H = 850;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c1b19"); bg.addColorStop(0.55, "#0d0d0c"); bg.addColorStop(1, "#171514");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // twin border
  x.strokeStyle = "#d97757"; x.lineWidth = 3; x.strokeRect(28, 28, W - 56, H - 56);
  x.strokeStyle = "#d9775788"; x.lineWidth = 1.5; x.strokeRect(44, 44, W - 88, H - 88);
  // corner sparks
  x.fillStyle = "#d97757";
  for (const [cx, cy] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) {
    x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill();
  }
  x.textAlign = "center";
  x.fillStyle = "#d97757";
  x.font = "700 30px Orbitron, sans-serif";
  x.fillText("TG · TIGA.AI PIANO ACADEMY", W / 2, 118);
  x.fillStyle = "#faf9f5";
  x.font = "900 64px Orbitron, sans-serif";
  x.fillText(lang === "th" ? "ประกาศนียบัตร" : lang === "zh" ? "结业证书" : "CERTIFICATE", W / 2, 226);
  x.fillStyle = "#a8a49b";
  x.font = "600 26px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "มอบให้เพื่อรับรองว่า" : lang === "zh" ? "兹证明" : "This certifies that", W / 2, 300);
  x.fillStyle = "#d97757";
  x.font = "700 58px Rajdhani, sans-serif";
  x.fillText(name, W / 2, 386);
  x.strokeStyle = "#d9775755"; x.lineWidth = 1;
  x.beginPath(); x.moveTo(W / 2 - 300, 408); x.lineTo(W / 2 + 300, 408); x.stroke();
  x.fillStyle = "#a8a49b";
  x.font = "600 26px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "ได้เรียนจบหลักสูตร" : lang === "zh" ? "已完成课程" : "has successfully completed", W / 2, 464);
  x.fillStyle = "#faf9f5";
  x.font = "700 40px Rajdhani, sans-serif";
  x.fillText(course, W / 2, 528);
  x.fillStyle = "#8f8b82";
  x.font = "500 22px Rajdhani, sans-serif";
  x.fillText((lang === "th" ? "เส้นทางเรียนรู้เปียโน TiGA · " : lang === "zh" ? "TiGA 钢琴学习之路 · " : "TiGA Piano Pathway of Learning · ") + dateStr, W / 2, 596);
  // signature block
  x.strokeStyle = "#a8a49b66"; x.beginPath(); x.moveTo(W / 2 - 170, 700); x.lineTo(W / 2 + 170, 700); x.stroke();
  x.fillStyle = "#d97757";
  x.font = "700 26px Orbitron, sans-serif";
  x.fillText("TiGA AI", W / 2, 738);
  x.fillStyle = "#8f8b82";
  x.font = "500 19px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "ครูผู้สอน — TiGA AI Piano Studio" : lang === "zh" ? "指导老师 — TiGA AI 钢琴工作室" : "Instructor — TiGA AI Piano Studio", W / 2, 768);
  return c.toDataURL("image/png");
}
async function renderWeeklyPNG({ name, mins, days, acc, topics, streak, lang }) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  const W = 1080, H = 1080;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c1b19"); bg.addColorStop(1, "#0d0d0c");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#d97757"; x.lineWidth = 3; x.strokeRect(26, 26, W - 52, H - 52);
  x.textAlign = "center";
  x.fillStyle = "#d97757"; x.font = "700 30px Orbitron, sans-serif";
  x.fillText("TG · TIGA.AI", W / 2, 112);
  x.fillStyle = "#faf9f5"; x.font = "900 56px Orbitron, sans-serif";
  x.fillText(lang === "th" ? "สมุดพกประจำสัปดาห์" : lang === "zh" ? "本周成绩单" : "WEEKLY REPORT", W / 2, 200);
  x.fillStyle = "#d97757"; x.font = "700 44px Rajdhani, sans-serif";
  x.fillText(name, W / 2, 272);
  const rows = [
    [lang === "th" ? "นาทีที่ซ้อม" : lang === "zh" ? "练习分钟" : "Minutes practiced", String(mins)],
    [lang === "th" ? "วันที่ได้ซ้อม" : lang === "zh" ? "练习天数" : "Days practiced", days + " / 7"],
    [lang === "th" ? "ความแม่นยำ" : lang === "zh" ? "准确率" : "Accuracy", acc == null ? "—" : acc + "%"],
    [lang === "th" ? "หัวข้อที่เรียน" : lang === "zh" ? "学习主题" : "Topics studied", String(topics)],
    [lang === "th" ? "สตรีคต่อเนื่อง" : lang === "zh" ? "连续打卡" : "Streak", streak + (lang === "th" ? " วัน" : lang === "zh" ? " 天" : " days")],
  ];
  let y = 380;
  for (const [k, v] of rows) {
    x.fillStyle = "#171615cc";
    x.fillRect(120, y - 52, W - 240, 84);
    x.strokeStyle = "#ffffff18"; x.lineWidth = 1; x.strokeRect(120, y - 52, W - 240, 84);
    x.textAlign = "left"; x.fillStyle = "#a8a49b"; x.font = "600 30px Rajdhani, sans-serif";
    x.fillText(k, 152, y + 2);
    x.textAlign = "right"; x.fillStyle = "#d97757"; x.font = "800 40px Orbitron, sans-serif";
    x.fillText(v, W - 152, y + 4);
    y += 118;
  }
  x.textAlign = "center";
  x.fillStyle = "#8f8b82"; x.font = "500 24px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "เรียนเปียโนกับครู AI ที่ TiGA AI" : lang === "zh" ? "在 TiGA AI 与 AI 老师学钢琴" : "Learning piano with an AI teacher at TiGA AI", W / 2, H - 96);
  return c.toDataURL("image/png");
}

/* ── coins (soft currency) + daily reward chest, all localStorage ── */
function getCoins() { try { return +(localStorage.getItem("tg_coins") || 0); } catch (e) { return 0; } }
function setCoinsLS(v) { try { localStorage.setItem("tg_coins", String(Math.max(0, Math.round(v)))); } catch (e) {} }
function chestAvailable() { try { return localStorage.getItem("tg_chest_date") !== dayKey(); } catch (e) { return false; } }
function chestStreak() { try { return +(localStorage.getItem("tg_chest_streak") || 0); } catch (e) { return 0; } }
function claimChest() {
  let streak = 1;
  try {
    const last = localStorage.getItem("tg_chest_date");
    const y = new Date(); y.setDate(y.getDate() - 1);
    streak = last === dayKey(y) ? chestStreak() + 1 : 1;
    localStorage.setItem("tg_chest_date", dayKey());
    localStorage.setItem("tg_chest_streak", String(streak));
  } catch (e) {}
  const day = ((streak - 1) % 7) + 1;            // base escalates across a 7-day cycle
  // VARIABLE reward (variable-ratio reinforcement — the habit-forming core):
  const r = Math.random();
  let mult, kind;
  if (r < 0.05) { mult = 5; kind = "jackpot"; }       // 5% jackpot
  else if (r < 0.22) { mult = 2; kind = "big"; }      // 17% big
  else { mult = 1 + Math.random() * 0.6; kind = "normal"; } // variable 1x–1.6x
  return { coins: Math.round(20 * day * mult), exp: Math.round(15 * day * mult), streak, day, kind };
}

/* ── engagement streak (consecutive practice days) + streak-freeze ── */
function readStreak() { try { return JSON.parse(localStorage.getItem("tg_streak") || "null") || { count: 0, last: "", freezes: 0 }; } catch (e) { return { count: 0, last: "", freezes: 0 }; } }
function writeStreak(s) { try { localStorage.setItem("tg_streak", JSON.stringify(s)); } catch (e) {} }
function bumpStreak() {  // call when the learner actually practices
  const s = readStreak(), today = dayKey();
  if (s.last === today) return s;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const y2 = new Date(); y2.setDate(y2.getDate() - 2);
  if (s.last === dayKey(y)) s.count = (s.count || 0) + 1;
  else if (s.last === dayKey(y2) && (s.freezes || 0) > 0) { s.count = (s.count || 0) + 1; s.freezes -= 1; }
  else s.count = 1;
  s.last = today; writeStreak(s); return s;
}
function streakAtRisk() { const s = readStreak(); return (s.count || 0) > 0 && s.last !== dayKey(); }
function addFreeze(n) { const s = readStreak(); s.freezes = (s.freezes || 0) + n; writeStreak(s); return s; }

/* ── learner memory (cross-session) → personalized AI + adaptive path ── */
function readMemory() { try { return JSON.parse(localStorage.getItem("tg_memory") || "null") || { struggles: [], mastered: [], recent: [] }; } catch (e) { return { struggles: [], mastered: [], recent: [] }; } }
function writeMemory(m) { try { localStorage.setItem("tg_memory", JSON.stringify(m)); } catch (e) {} }
function recordMemory(label, acc) {
  if (!label) return;
  const m = readMemory();
  m.recent = [{ label, acc, t: dayKey() }, ...(m.recent || []).filter(r => r.label !== label)].slice(0, 12);
  if (acc >= 90) {
    if (!m.mastered.includes(label)) m.mastered = [label, ...m.mastered].slice(0, 12);
    m.struggles = (m.struggles || []).filter(s => s.label !== label);
  } else if (acc < 65) {
    const prev = (m.struggles || []).find(s => s.label === label);
    // keep a timestamp + count so the teacher can space-repeat reviews like a master
    m.struggles = [{ label, acc, last: Date.now(), count: ((prev && prev.count) || 0) + 1 }, ...(m.struggles || []).filter(s => s.label !== label)].slice(0, 6);
  }
  writeMemory(m);
}
// stamp the end of a voice session so next time we know how long they were away
function touchSessionMemory() { try { const m = readMemory(); m.lastSession = Date.now(); m.sessions = (m.sessions || 0) + 1; writeMemory(m); } catch (e) {} }
function memoryContext(lang) {
  const m = readMemory(), parts = [];
  const now = Date.now();
  const dAgo = (t) => t ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
  // SPACED REPETITION: struggles not revisited for 2+ days are due for a quick review
  const due = (m.struggles || []).filter(s => s.last && (now - s.last) >= 2 * 86400000).slice(0, 3);
  if (due.length) parts.push((lang === "th" ? "⏰ ครบกำหนดทบทวน (แทรกการทบทวนสั้น ๆ ให้เขาแบบเนียน ๆ): " : lang === "zh" ? "⏰ 到复习时间（自然地带入简短回顾）：" : "⏰ Due for spaced review (weave in a quick revisit): ") + due.map(s => `${s.label} (${dAgo(s.last)}d)`).join(", "));
  if (m.struggles && m.struggles.length) parts.push((lang === "th" ? "เคยติด: " : lang === "zh" ? "曾困难: " : "Struggled with: ") + m.struggles.slice(0, 3).map(s => s.label).join(", "));
  if (m.mastered && m.mastered.length) parts.push((lang === "th" ? "ทำได้ดีแล้ว: " : lang === "zh" ? "已掌握: " : "Mastered: ") + m.mastered.slice(0, 3).join(", "));
  if (m.recent && m.recent.length) parts.push((lang === "th" ? "ฝึกล่าสุด: " : lang === "zh" ? "最近练习: " : "Recently practiced: ") + m.recent.slice(0, 2).map(r => r.label).join(", "));
  const gap = dAgo(m.lastSession);
  if (gap != null && gap >= 1) parts.push((lang === "th" ? "ห่างหายไป " + gap + " วัน (ทักทายอบอุ่นแบบคิดถึง)" : lang === "zh" ? "已隔 " + gap + " 天（温暖地问候，像想念他）" : "Returning after " + gap + " days (greet warmly like you missed them)"));
  return parts.length ? ("\n\n[" + (lang === "th" ? "ความจำผู้เรียน (อ้างถึงเพื่อความต่อเนื่อง + ทบทวนตามจังหวะ)" : lang === "zh" ? "学员记忆（用于连贯与按时复习）" : "Learner memory (use for continuity + spaced review)") + ": " + parts.join(" · ") + "]") : "";
}

/* ── homework + lesson plan (assigned by the AI, tracked across sessions) ── */
function readHomework() { try { return JSON.parse(localStorage.getItem("tg_homework") || "null"); } catch (e) { return null; } }
function setHomeworkLS(h) { try { h ? localStorage.setItem("tg_homework", JSON.stringify(h)) : localStorage.removeItem("tg_homework"); } catch (e) {} }
function homeworkContext(lang) {
  const h = readHomework();
  if (!h || !h.text) return "";
  const lbl = lang === "th" ? "การบ้านที่คุณสั่งไว้คราวก่อน (ถามว่าเขาฝึกหรือยัง แล้วตรวจ/ให้ฟีดแบ็ก)" : lang === "zh" ? "你上次布置的作业（先问他练了没，然后检查/反馈）" : "Homework you assigned last time (ask if they did it, then check and give feedback)";
  return "\n\n[" + lbl + ": " + h.text + "]";
}
// the teacher's own forward plan for the NEXT lesson — set via [plan: …], recalled every session
function readLessonPlan() { try { return JSON.parse(localStorage.getItem("tg_lessonplan") || "null"); } catch (e) { return null; } }
function setLessonPlanLS(p) { try { p ? localStorage.setItem("tg_lessonplan", JSON.stringify(p)) : localStorage.removeItem("tg_lessonplan"); } catch (e) {} }
// A human teacher teaches TO A SYLLABUS, not turn by turn. This injects the
// learner's REAL position in the app's own Pathway curriculum (stages done,
// keys studied, what's next) plus the teacher's saved next-lesson plan — so the
// voice teacher always knows where this student is on the road, like a human
// who keeps a notebook per student.
function curriculumContext(lang) {
  try {
    const done = pathDoneSet();
    const keys = keyDoneMap();
    const cur = PATHWAY.find(s => !done.has(s.id)) || null;
    const nxt = cur ? PATHWAY[PATHWAY.indexOf(cur) + 1] : null;
    const parts = [];
    parts.push((lang === "th" ? "ผ่านแล้ว " : lang === "zh" ? "已完成 " : "Stages done: ") + done.size + "/" + PATHWAY.length);
    if (cur) {
      const kd = keys[cur.id] || [];
      parts.push((lang === "th" ? "ขั้นปัจจุบัน: " : lang === "zh" ? "当前阶段: " : "Current stage: ") + tr(cur.title, lang) + (kd.length ? ` (${lang === "th" ? "คีย์ที่เรียนแล้ว" : lang === "zh" ? "已学调" : "keys learned"}: ${kd.join(", ")})` : ""));
    }
    if (nxt) parts.push((lang === "th" ? "ขั้นถัดไป: " : lang === "zh" ? "下一阶段: " : "Next stage: ") + tr(nxt.title, lang));
    const plan = readLessonPlan();
    if (plan && plan.text) parts.push((lang === "th" ? "แผนคาบนี้ที่คุณตั้งไว้: " : lang === "zh" ? "你为本课定的计划: " : "Your saved plan for this lesson: ") + plan.text);
    const guide = lang === "th"
      ? "จัดคาบให้เดินตามหลักสูตรนี้ทีละขั้น เริ่มด้วยวอร์มอัพสั้น ๆ ที่เข้ากับขั้นปัจจุบันก่อนเสมอ และก่อนจบคาบให้ตั้งแผนคาบหน้าด้วย [plan: ...]"
      : lang === "zh"
      ? "按此大纲逐级授课，开课先做贴合当前阶段的简短热身，下课前用 [plan: ...] 定好下节课计划"
      : "Run the lesson along this syllabus, always open with a short warm-up matched to the current stage, and before ending set next lesson's plan with [plan: ...]";
    const lbl = lang === "th" ? "หลักสูตรของผู้เรียน" : lang === "zh" ? "学员课程进度" : "Learner's curriculum";
    return "\n\n[" + lbl + ": " + parts.join(" · ") + ". " + guide + "]";
  } catch (e) { return ""; }
}

/* ── premium / freemium + daily free-tier usage limits ── */
function isPremium() { try { return localStorage.getItem("tg_premium") === "1"; } catch (e) { return false; } }
function setPremiumLS(v) { try { localStorage.setItem("tg_premium", v ? "1" : "0"); } catch (e) {} }
/* Subscription tier — switchable any time: "free" | "premium" | "family" | "max". */
function getPlan() { try { return localStorage.getItem("tg_plan") || (isPremium() ? "premium" : "free"); } catch (e) { return "free"; } }
function setPlanLS(p) { try { localStorage.setItem("tg_plan", p); localStorage.setItem("tg_premium", p === "free" ? "0" : "1"); } catch (e) {} }
// Voice Mode (AI voice teacher) is a Max / Max Family exclusive.
function isMaxPlan(p) { const v = p || getPlan(); return v === "max" || v === "maxfamily"; }
const PLAN_PRICE = { premium: 1490, family: 2900, max: 3999, maxfamily: 9999 };
const PLAN_LABEL = { premium: "⭐ Premium", family: "👨‍👩‍👧 Family", max: "👑 Max", maxfamily: "👑👨‍👩‍👧 Max Family" };
// yearly = 12 months − 3% off the full price
function yearPrice(p) { return Math.round((PLAN_PRICE[p] || 0) * 12 * 0.97); }
const YEAR_PLANS = ["premium", "max", "maxfamily"];   // tiers that offer a yearly option
// the live, authoritative plan for a profile row (admins = full; paid only while not expired)
function effectivePlan(p) {
  if (!p) return "free";
  if (p.is_admin) return "maxfamily";
  if (p.plan && p.plan !== "free" && p.plan_until && new Date(p.plan_until).getTime() > Date.now()) return p.plan;
  return "free";
}

// Auto Teaching (Max-only real-time coaching popups): resolve the effective interval in
// minutes — the learner's own override if they picked one, else the admin's platform
// default, else a safe built-in fallback. 0 = off.
const AUTO_TEACH_FALLBACK_MIN = 15;
const AUTO_TEACH_INTERVALS = [5, 10, 15, 30, 60];
function resolveAutoTeachMin(profile, adminDefaultMin) {
  const own = profile && profile.auto_teach_interval_min;
  if (own != null) return own;
  if (adminDefaultMin != null) return adminDefaultMin;
  return AUTO_TEACH_FALLBACK_MIN;
}

// Fixed, safe set of real in-app destinations the AI coach can point a learner to — the
// model only ever picks a KEY from this list (never invents one), and the actual navigation
// for each key is wired up in PianoApp, so a recommendation is always a working link.
const COACH_FEATURE_LABELS = {
  sight_reading: { th: "ฝึกอ่านโน้ต (Sight-Reading)", en: "Sight-Reading practice", zh: "识谱练习（Sight-Reading）" },
  hand_coach: { th: "ให้ครูดูท่ามือ (Hand Coach)", en: "Hand Coach (camera)", zh: "手型检测（Hand Coach）" },
  play_along: { th: "เล่นตามเพลง (Play Along)", en: "Play Along songs", zh: "跟弹歌曲（Play Along）" },
  ear_training: { th: "ฝึกโสตประสาท (Ear Training)", en: "Ear Training games", zh: "听力训练（Ear Training）" },
  reading_course: { th: "คอร์สฝึกอ่านโน้ตทีละบท (Reading)", en: "Note-Reading course", zh: "识谱课程（Reading）" },
  pathway: { th: "ทบทวนบทเรียนในเส้นทางการเรียนรู้", en: "Review Pathway lessons", zh: "复习学习路径课程" },
};
// Gathers the same data the Profile page's own dashboards (My Stats heatmap/trend, badges,
// daily quest, streak) are built from, as a plain structured object — the single source
// both the AI prompt text (coachStatsToText below) and Daily Mentor's on-screen chart
// render from, so what the learner reads and what the AI reasons over never disagree.
// Reuses the exact aggregation InsightsPage already uses for "My Stats".
function computeCoachStats(profile, lang) {
  const log = readActLog();
  const now = Date.now(), dayMs = 86400000;
  let ok7 = 0, miss7 = 0, sec7 = 0, okPrev = 0, missPrev = 0;
  const days7 = new Set();
  const byTopic = {};
  for (const e of log) {
    if (e.t >= now - 7 * dayMs) {
      ok7 += e.ok; miss7 += e.miss; sec7 += e.sec;
      if (e.sec > 0) days7.add(e.d);
    } else if (e.t >= now - 14 * dayMs) {
      okPrev += e.ok; missPrev += e.miss;
    }
    if (e.k !== "voice" && e.ok + e.miss >= 1) {
      const key = e.k + "|" + e.id;
      const b = byTopic[key] || (byTopic[key] = { e, ok: 0, miss: 0 });
      b.ok += e.ok; b.miss += e.miss;
    }
  }
  const acc7 = ok7 + miss7 > 0 ? Math.round(ok7 / (ok7 + miss7) * 100) : null;
  const accPrev = okPrev + missPrev > 0 ? Math.round(okPrev / (okPrev + missPrev) * 100) : null;
  const weakest = Object.values(byTopic)
    .filter(b => b.ok + b.miss >= 4 && b.miss > 0)
    .map(b => ({ label: actTopicLabel(b.e, lang), rate: Math.round(b.miss / (b.ok + b.miss) * 100), n: b.ok + b.miss }))
    .sort((a, b) => b.rate - a.rate).slice(0, 5);
  const info = levelInfo((profile && profile.exp) || 0);
  return {
    level: info.level, streak: (profile && profile.streak) || 0, lessonsDone: (profile && profile.lessons_done) || 0,
    badgeCount: unlockedBadgeIds(profile).length, badgeTotal: BADGES.length, questOk: questToday(profile) >= QUEST_GOAL,
    days7: days7.size, min7: Math.round(sec7 / 60), acc7, accPrev, weakest,
  };
}
function coachStatsToText(s) {
  const weakestTxt = s.weakest.length ? s.weakest.map(w => `${w.label} (${w.rate}% miss over ${w.n} tries)`).join("; ") : "none with enough attempts yet";
  return `Level ${s.level}, ${s.streak}-day streak, ${s.lessonsDone} lessons completed, ${s.badgeCount}/${s.badgeTotal} badges earned, today's quest ${s.questOk ? "done" : "not done yet"}. Last 7 days: practiced ${s.days7}/7 days (${s.min7} min total), accuracy ${s.acc7 == null ? "no data" : s.acc7 + "%"}${s.accPrev != null ? ` (previous week was ${s.accPrev}%)` : ""}. Weakest topics by miss rate across all history: ${weakestTxt}.`;
}
// Shared core of the AI coaching analysis — used by both the Auto Teaching popup (timer-driven,
// PianoApp) and the dedicated Coach nav page (on-demand, CoachPage). Module-level (not inside
// either component) since it only needs `lang`/`profile` and the module-level helpers above.
async function generateCoachTip(lang, profile) {
  const mem = readMemory();
  const struggle = (mem.struggles || [])[0];
  const recentTxt = (mem.recent || []).slice(0, 5).map(r => `${r.label} (${r.acc}%)`).join(", ") || "—";
  const struggleTxt = struggle ? `${struggle.label} (${struggle.acc}%, missed ${struggle.count}x)` : "none flagged yet — infer the most likely weak spot from recent practice";
  const profileTxt = coachStatsToText(computeCoachStats(profile, lang));
  const featureKeys = Object.keys(COACH_FEATURE_LABELS).join(", ");
  const sysByLang = {
    th: `คุณคือ "ครู TiGA" กำลังให้คำแนะนำการฝึกซ้อมส่วนตัว อิงจากข้อมูลบัญชีผู้เรียนทั้งหมด: ${profileTxt} เซสชันฝึกล่าสุด: ${recentTxt} จุดอ่อนที่เพิ่งถูกบันทึก: ${struggleTxt}\n\nตอบเป็น JSON เท่านั้น {"weakness":"...","steps":["...","..."],"feature":"..."} — weakness สั้นไม่เกิน 15 คำ บอกปัญหาตอนนี้ (พิจารณาทั้งภาพรวมบัญชีและข้อมูลล่าสุดประกอบกัน) steps มีสูงสุด 3 ข้อเท่านั้น (ไม่เกิน 3 เด็ดขาด) แต่ละข้อต้องเป็นสิ่งที่ทำได้จริงวันนี้เลย เจาะจงมาก ระบุหัวข้อ/ท่อน/เพลงที่ควรฝึกจากข้อมูลด้านบนโดยตรง ไม่ใช่คำแนะนำทั่วไปลอยๆ แบบ "ฝึกให้มากขึ้น" — ทำตามแล้วต้องเก่งขึ้นจริง แต่ละข้อไม่เกิน 15 คำ feature ต้องเป็นค่าจากรายการนี้เท่านั้น (เลือกตัวที่ช่วยแก้จุดอ่อนนี้ได้ดีที่สุด): ${featureKeys} ภาษาไทย ตอบเป็น JSON ดิบเท่านั้น ห้ามใช้ \`\`\` ครอบ ห้ามมีข้อความอื่นก่อนหรือหลัง JSON`,
    zh: `你是"TiGA老师"，正在给出个性化的练习建议，依据学员账户的完整数据：${profileTxt} 最近的练习记录：${recentTxt} 刚被记录的薄弱点：${struggleTxt}\n\n只回JSON {"weakness":"...","steps":["...","..."],"feature":"..."} — weakness 不超过15字，说明当前问题（综合账户整体情况和最近数据），steps 最多3条（绝不超过3条），每条必须是今天就能做到的具体行动，直接指出上面数据中该练哪个主题/曲目，不要「多加练习」这类空泛建议 — 照做后水平必须真正提升，每条不超过15字，feature 必须是以下之一（选择最能解决该薄弱点的）：${featureKeys}，用中文。只回原始JSON对象，不要用\`\`\`包裹，JSON前后不要任何文字`,
    en: `You are "Teacher TiGA" giving personalized practice coaching, based on the learner's full account data: ${profileTxt} Recent practice sessions: ${recentTxt}. Most recently flagged weak spot: ${struggleTxt}.\n\nReply with JSON only: {"weakness":"...","steps":["...","..."],"feature":"..."} — weakness under 15 words naming the current problem (weigh both the overall account picture and the recent data), steps has AT MOST 3 items (never more than 3), each one a concrete action doable today, naming the specific topic/piece from the data above rather than generic advice like "practice more" — a learner who follows these should measurably improve, each under 15 words, feature must be exactly one of: ${featureKeys} (pick whichever helps this weak spot most). Reply with the raw JSON object only — no markdown code fences, no text before or after it.`,
  };
  const sys = sysByLang[lang] || sysByLang.en;
  // One attempt: fetch + pull the JSON object out of the model's text. Wrapped so any
  // failure (network, non-JSON reply, a stray markdown fence, extra prose around the
  // object) degrades to null instead of throwing — generateCoachTip retries once below
  // rather than letting a single flaky reply surface as a hard error.
  async function attempt() {
    try {
      const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify({ message: "Give me my current coaching recommendation.", conversationHistory: [], system: sys }) });
      const data = await res.json();
      const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i); // some replies wrap the JSON in a code fence despite being told not to
      const body = fenced ? fenced[1] : txt;
      const m = body.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch (e) { return null; }
  }
  const isValid = o => o && o.weakness && Array.isArray(o.steps) && o.steps.length;
  let obj = await attempt();
  if (!isValid(obj)) obj = await attempt(); // a single malformed/non-JSON reply shouldn't be a dead end
  if (!isValid(obj)) return null;
  if (!COACH_FEATURE_LABELS[obj.feature]) obj.feature = "pathway"; // guard against a hallucinated key
  obj.steps = obj.steps.slice(0, 3); // enforce the "at most 3" cap even if the model overshoots
  return obj;
}
// Admin tier badge — ★★★ Top Tier / ★★ Ops / ★ Support / "" not an admin.
function adminTierStars(t) { return t >= 3 ? "★★★" : t === 2 ? "★★" : t === 1 ? "★" : ""; }
// short header badge per tier
function planBadge(p) {
  return p === "maxfamily" ? { t: "👑 MAX FAMILY", c: "maxfam" }
    : p === "max" ? { t: "👑 MAX", c: "max" }
    : p === "family" ? { t: "👨‍👩‍👧 FAMILY", c: "fam" }
    : p === "premium" ? { t: "⭐ PRO", c: "" }
    : null;
}
const FREE_LIMITS = { song: 2, critique: 3 };   // free actions per day
function usageToday(key) { try { const u = JSON.parse(localStorage.getItem("tg_usage") || "{}"); return u.d === dayKey() ? (u[key] || 0) : 0; } catch (e) { return 0; } }
function bumpUsage(key) { try { let u = JSON.parse(localStorage.getItem("tg_usage") || "{}"); if (u.d !== dayKey()) u = { d: dayKey() }; u[key] = (u[key] || 0) + 1; localStorage.setItem("tg_usage", JSON.stringify(u)); } catch (e) {} }
function canUse(key) { return isPremium() || usageToday(key) < (FREE_LIMITS[key] || 0); }

/* ── Free-tier share gate: after 5 contents, free users share FB + TikTok to keep going ── */
const SHARE_FB = "https://www.facebook.com/share/1AxGLtF5Dw/";
const SHARE_TIKTOK = "https://www.tiktok.com/@tiga.piano_studio?_r=1&_t=ZS-97aTZMZ8oOC";
const FREE_CONTENT_LIMIT = 20; // raised from 5 — was exhausted in a single first session
function freeContentPlays() { try { return parseInt(localStorage.getItem("tg_content_plays") || "0", 10) || 0; } catch (e) { return 0; } }
function bumpContentPlays() { try { localStorage.setItem("tg_content_plays", String(freeContentPlays() + 1)); } catch (e) {} }
function hasSharedUnlock() { try { return localStorage.getItem("tg_shared") === "1"; } catch (e) { return false; } }
function setSharedUnlock() { try { localStorage.setItem("tg_shared", "1"); } catch (e) {} }

/* ── graded exam-prep curriculum (premium) ── */
const EXAM_GRADES = [
  { id: "g1", th: "เกรด 1 (เริ่มต้น)", en: "Grade 1 (Beginner)", zh: "一级（初级）", tasks: [
    { th: "สเกล C เมเจอร์ 1 ออกเทฟ", en: "C major scale, 1 octave", zh: "C大调音阶，一个八度" },
    { th: "สเกล G เมเจอร์ 1 ออกเทฟ", en: "G major scale, 1 octave", zh: "G大调音阶，一个八度" },
    { th: "คอร์ด C · F · G", en: "Triads: C · F · G", zh: "三和弦：C · F · G" },
    { th: "เพลงบังคับ: Ode to Joy", en: "Set piece: Ode to Joy", zh: "指定曲：欢乐颂" },
    { th: "อ่านโน้ตกุญแจซอลเบื้องต้น", en: "Basic treble sight-reading", zh: "基础高音谱视奏" },
  ] },
  { id: "g2", th: "เกรด 2 (กลาง)", en: "Grade 2 (Intermediate)", zh: "二级（中级）", tasks: [
    { th: "สเกล C · G · F เมเจอร์", en: "C · G · F major scales", zh: "C · G · F 大调音阶" },
    { th: "สเกล A ไมเนอร์", en: "A minor scale", zh: "a小调音阶" },
    { th: "คอร์ดพลิกกลับ (inversions)", en: "Chord inversions", zh: "和弦转位" },
    { th: "เพลงบังคับ: Für Elise (ท่อนต้น)", en: "Set piece: Für Elise (intro)", zh: "指定曲：致爱丽丝（前段）" },
    { th: "เล่นสองมือพร้อมกัน", en: "Hands-together playing", zh: "双手齐奏" },
  ] },
  { id: "g3", th: "เกรด 3 (สูง)", en: "Grade 3 (Advanced)", zh: "三级（高级）", tasks: [
    { th: "สเกลเมเจอร์ 2 ออกเทฟ", en: "Major scales, 2 octaves", zh: "大调音阶，两个八度" },
    { th: "อาร์เพจจิโอ", en: "Arpeggios", zh: "琶音" },
    { th: "คอร์ด 7 (seventh chords)", en: "Seventh chords", zh: "七和弦" },
    { th: "เพลงบังคับระดับเกรด 3", en: "Grade-3 set piece", zh: "三级指定曲" },
    { th: "อ่านโน้ตทั้งสองกุญแจ", en: "Sight-read both clefs", zh: "双谱号视奏" },
  ] },
];


/* ── weekly challenges (rotating, localStorage, auto-rewarded) ── */
const CHALLENGES = [
  { id: "games",   goal: 5,   icon: "🎮", th: "เล่นเกม 5 รอบ", en: "Play 5 games",    zh: "玩 5 局游戏" },
  { id: "exp",     goal: 300, icon: "✦",  th: "เก็บ 300 EXP",  en: "Earn 300 EXP",    zh: "赚 300 EXP" },
  { id: "perfect", goal: 30,  icon: "🎯", th: "ทำ 30 Perfect", en: "Hit 30 Perfects", zh: "打出 30 完美" },
];
const CHALLENGE_REWARD = 50;
function weekKey(d = new Date()) {
  const x = dayDate(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day);
  return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate();
}
function readWeekly() {
  try {
    const w = JSON.parse(localStorage.getItem("tg_weekly") || "{}");
    if (w && w.week === weekKey()) return w;
  } catch (e) {}
  return { week: weekKey(), games: 0, exp: 0, perfect: 0, claimed: [] };
}
function writeWeekly(w) { try { localStorage.setItem("tg_weekly", JSON.stringify(w)); } catch (e) {} }

/* ── learning-pathway progress (journey map) ── */
function pathDoneSet() { try { return new Set(JSON.parse(localStorage.getItem("tg_path_done") || "[]")); } catch (e) { return new Set(); } }
function markPathDone(id) { try { const s = pathDoneSet(); s.add(id); localStorage.setItem("tg_path_done", JSON.stringify([...s])); } catch (e) {} }
/* Per-key learning record: which keys of each topic (scale/interval/chord/…) the
   learner has studied, so the pathway can show what's already been covered. */
function keyDoneMap() { try { return JSON.parse(localStorage.getItem("tg_key_done") || "{}") || {}; } catch (e) { return {}; } }
function markKeyDone(stageId, keyId) {
  try {
    const m = keyDoneMap(), k = String(keyId || "").toLowerCase();
    if (!k) return;
    const arr = m[stageId] || [];
    if (!arr.includes(k)) { arr.push(k); m[stageId] = arr; localStorage.setItem("tg_key_done", JSON.stringify(m)); }
  } catch (e) {}
}

/* ── progress sync to Supabase: a snapshot of the learner's local progress so a
   teacher/admin can review each student's learning from the back office ── */
function buildProgressSnapshot() {
  try {
    const plog = readPracticeLog();
    const glog = readGameLog().slice(-60);
    const mem = readMemory();
    const pathDone = Array.from(pathDoneSet());
    const keyDone = keyDoneMap();
    const st = readStreak();
    let accSum = 0, accN = 0;
    for (const g of glog) { if (typeof g.acc === "number") { accSum += g.acc; accN++; } }
    const keysLearned = Object.values(keyDone).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    return {
      v: 1, updated: new Date().toISOString(),
      practiceLog: plog, gameLog: glog, memory: mem, pathDone, keyDone,
      plan: getPlan(), streak: st,
      summary: { games: glog.length, avgAcc: accN ? Math.round(accSum / accN) : 0, pathDone: pathDone.length, keysLearned },
    };
  } catch (e) { return null; }
}
function syncProgress(uid) {
  if (!uid) return;
  try {
    const snap = buildProgressSnapshot();
    if (!snap) return;
    sb.from("profiles").update({ progress: snap, last_active: ymd(), updated_at: new Date().toISOString() }).eq("id", uid).then(() => {}, () => {});
  } catch (e) {}
}

/* ── cosmetics shop: key-skins + background themes (bought with coins) ── */
const SHOP_SKINS = [
  { id: "aqua",   icon: "🩵", cost: 0,   rarity: "common",    th: "อความารีน", en: "Aqua",   zh: "水蓝", sw: ["#8ad4ff", "#0e7ab0"] },
  { id: "sunset", icon: "🧡", cost: 120, rarity: "common",    th: "ตะวันตกดิน", en: "Sunset", zh: "日落", sw: ["#ff9e00", "#ff5d3a"] },
  { id: "neon",   icon: "💚", cost: 180, rarity: "rare",      th: "นีออน",      en: "Neon",   zh: "霓虹", sw: ["#06ffa5", "#00d488"] },
  { id: "candy",  icon: "💗", cost: 180, rarity: "rare",      th: "แคนดี้",     en: "Candy",  zh: "糖果", sw: ["#ff76d8", "#cc1b7a"] },
  { id: "ocean",  icon: "🌊", cost: 200, rarity: "rare",      th: "มหาสมุทร",   en: "Ocean",  zh: "海洋", sw: ["#00d4ff", "#0077b6"], isNew: true },
  { id: "ice",    icon: "❄️", cost: 200, rarity: "rare",      th: "น้ำแข็ง",    en: "Ice",    zh: "冰霜", sw: ["#d0f4ff", "#0891b2"], isNew: true },
  { id: "gold",   icon: "💛", cost: 320, rarity: "epic",      th: "ทองคำ",      en: "Gold",   zh: "黄金", sw: ["#ffd23f", "#9a7400"] },
  { id: "fire",   icon: "🔥", cost: 260, rarity: "epic",      th: "เพลิง",      en: "Fire",   zh: "烈焰", sw: ["#ff6b35", "#6b0f16"], isNew: true },
  { id: "galaxy", icon: "🪐", cost: 300, rarity: "epic",      th: "กาแล็กซี่",  en: "Galaxy", zh: "银河", sw: ["#c084fc", "#4c1d95"], isNew: true },
  { id: "prism",  icon: "🌈", cost: 550, rarity: "legendary", th: "ปริซึม",     en: "Prism",  zh: "棱镜", sw: ["#ff5252", "#a855f7", "#00d4ff"], isNew: true },
];
const SHOP_THEMES = [
  { id: "midnight",  icon: "🌌", cost: 0,   rarity: "common",    th: "เที่ยงคืน", en: "Midnight",  zh: "午夜", sw: ["#150c12", "#0a0608"] },
  { id: "aurora",    icon: "🌠", cost: 150, rarity: "rare",      th: "ออโรร่า",   en: "Aurora",    zh: "极光", sw: ["#0b2a3a", "#0a1326"] },
  { id: "ember",     icon: "🔥", cost: 150, rarity: "rare",      th: "ถ่านไฟ",    en: "Ember",     zh: "余烬", sw: ["#2a1012", "#180b10"] },
  { id: "forest",    icon: "🌲", cost: 150, rarity: "rare",      th: "ป่าไม้",    en: "Forest",    zh: "森林", sw: ["#0c2a1c", "#0a1a16"] },
  { id: "sakura",    icon: "🌸", cost: 200, rarity: "epic",      th: "ซากุระ",    en: "Sakura",    zh: "樱花", sw: ["#3a1a2e", "#220f1c"], isNew: true },
  { id: "deepsea",   icon: "🐋", cost: 240, rarity: "epic",      th: "ใต้สมุทร",  en: "Deep Sea",  zh: "深海", sw: ["#052030", "#031824"], isNew: true },
  { id: "volcano",   icon: "🌋", cost: 260, rarity: "epic",      th: "ภูเขาไฟ",   en: "Volcano",   zh: "火山", sw: ["#3a1005", "#220a08"], isNew: true },
  { id: "starlight", icon: "✨", cost: 450, rarity: "legendary", th: "แสงดาว",    en: "Starlight", zh: "星光", sw: ["#1a0a3a", "#12082a"], isNew: true },
];
const SHOP_FRAMES = [
  { id: "fr-none",    icon: "⭕", cost: 0,   rarity: "common",    th: "ไม่มีกรอบ", en: "No Frame", zh: "无边框", sw: ["#b0aea5", "#b0aea5"] },
  { id: "fr-bronze",  icon: "🥉", cost: 100, rarity: "common",    th: "บรอนซ์",    en: "Bronze",   zh: "青铜", sw: ["#cd7f32", "#8a531f"], isNew: true },
  { id: "fr-silver",  icon: "🥈", cost: 280, rarity: "rare",      th: "เงิน",      en: "Silver",   zh: "白银", sw: ["#d7d7de", "#9a9aa5"], isNew: true },
  { id: "fr-gold",    icon: "🥇", cost: 500, rarity: "epic",      th: "ทอง",       en: "Gold",     zh: "黄金", sw: ["#ffd23f", "#c9960a"], isNew: true },
  { id: "fr-diamond", icon: "💎", cost: 900, rarity: "legendary", th: "เพชร",      en: "Diamond",  zh: "钻石", sw: ["#8ad4ff", "#a855f7"], isNew: true },
];
// generate a shareable achievement card image (Web Share API, else download)
async function shareCard({ title, big, sub, lines = [] }) {
  try {
    const W = 640, H = 800, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1c1b19"); g.addColorStop(1, "#0d0d0c");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#d97757"; x.lineWidth = 5; x.strokeRect(26, 26, W - 52, H - 52);
    x.textAlign = "center";
    x.fillStyle = "#d97757"; x.font = "bold 30px Arial"; x.fillText("TiGA AI", W / 2, 112);
    x.fillStyle = "#faf9f5"; x.font = "bold 38px Arial"; x.fillText(String(title).slice(0, 22), W / 2, 210);
    x.fillStyle = "#d97757"; x.font = "900 150px Arial"; x.fillText(String(big), W / 2, 410);
    if (sub) { x.fillStyle = "#d97757"; x.font = "bold 56px Arial"; x.fillText(sub, W / 2, 490); }
    x.fillStyle = "#c9c6bd"; x.font = "30px Arial";
    lines.forEach((ln, i) => x.fillText(ln, W / 2, 570 + i * 50));
    x.fillStyle = "#8f8b82"; x.font = "24px Arial"; x.fillText("tigaalpha.github.io", W / 2, H - 56);
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    const file = new File([blob], "tiga-score.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "TiGA AI" });
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tiga-score.png"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }
  } catch (e) {}
}
function getOwned() { try { return JSON.parse(localStorage.getItem("tg_owned") || "[\"aqua\",\"midnight\",\"fr-none\"]"); } catch (e) { return ["aqua", "midnight", "fr-none"]; } }
function setOwnedLS(a) { try { localStorage.setItem("tg_owned", JSON.stringify(a)); } catch (e) {} }
function getEquip(k, def) { try { return localStorage.getItem("tg_" + k) || def; } catch (e) { return def; } }
function setEquipLS(k, v) { try { localStorage.setItem("tg_" + k, v); } catch (e) {} }

/* ── Interactive progress dashboard: pick a time range, see activity / accuracy /
   EXP, each compared with the previous equal period. Reads the daily practice log. ── */
const DASH_RANGES = [{ d: 1, k: "r1" }, { d: 7, k: "r7" }, { d: 30, k: "r1m" }, { d: 90, k: "r3m" }, { d: 180, k: "r6m" }, { d: 365, k: "r1y" }];
// Shared dashboard: own data (Profile) OR a student's snapshot (Admin) via props.
const ProgressDashboard = memo(function ProgressDashboard({ lang, plog: plogProp, gameLog: gameLogProp }) {
  const lc = L[lang];
  const [range, setRange] = useState(30);
  const [sel, setSel] = useState(null);
  const [gsel, setGsel] = useState(null);
  const plog = plogProp || readPracticeLog();
  const gameLog = gameLogProp || readGameLog();
  const today = new Date();
  const entryAgo = (off) => {
    const dd = new Date(today); dd.setDate(today.getDate() - off);
    const e = plog[dayKey(dd)] || {};
    return { n: e.n || 0, accSum: e.accSum || 0, exp: e.exp || 0, date: dd };
  };
  const agg = (arr) => {
    let sessions = 0, accSum = 0, accN = 0, exp = 0, active = 0;
    for (const e of arr) { sessions += e.n; accSum += e.accSum; accN += e.n; exp += e.exp; if (e.n > 0 || e.exp > 0) active++; }
    return { sessions, active, exp, acc: accN ? Math.round(accSum / accN) : 0 };
  };
  const cur = [], prev = [];
  for (let i = range - 1; i >= 0; i--) cur.push(entryAgo(i));
  for (let i = range * 2 - 1; i >= range; i--) prev.push(entryAgo(i));
  const A = agg(cur), B = agg(prev);
  const delta = (a, b) => (b > 0 ? Math.round((a - b) / b * 100) : (a > 0 ? 100 : 0));
  // bucket the chart: daily ≤30d, weekly ≤180d, else monthly
  const bd = range <= 30 ? 1 : range <= 180 ? 7 : 30;
  const buckets = [];
  for (let i = 0; i < cur.length; i += bd) {
    const slice = cur.slice(i, i + bd), b = agg(slice);
    buckets.push({ ...b, from: slice[0].date, to: slice[slice.length - 1].date, days: slice.length });
  }
  const maxS = Math.max(1, ...buckets.map(b => b.sessions));
  const fmtD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  const accPts = buckets.map((b, i) => {
    const x = buckets.length > 1 ? (i / (buckets.length - 1)) * 100 : 50;
    const y = 30 - (Math.max(0, Math.min(100, b.acc)) / 100) * 28;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const cards = [
    { lbl: lc.dashActive, val: A.active, prev: B.active, suffix: "/" + range },
    { lbl: lc.dashSessions, val: A.sessions, prev: B.sessions },
    { lbl: lc.dashAcc, val: A.acc, prev: B.acc, suffix: "%" },
    { lbl: lc.dashExp, val: A.exp, prev: B.exp },
  ];
  const selB = sel != null ? buckets[sel] : null;
  // game plays within the selected range (so the range controls game data too)
  const cutoff = Date.now() - range * 86400000;
  const gr = gameLog.filter(g => (g.t || 0) >= cutoff);
  const gRecent = gr.slice(-16);
  const gPlays = gr.length;
  const gAvg = gPlays ? Math.round(gr.reduce((s, g) => s + (g.acc || 0), 0) / gPlays) : 0;
  const gBest = Math.max(0, ...gr.map(g => g.score || 0));
  const starC = (s) => s >= 3 ? "#d97757" : s >= 2 ? "#ff76d8" : s >= 1 ? "#ff94e0" : "#a8329a";
  const selG = gsel != null ? gRecent[gsel] : null;
  const fmtT = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };
  return (
    <div className="profsec">
      <div className="profsec-h">{lc.dashTitle}</div>
      <div className="dashranges">
        {DASH_RANGES.map(r => (
          <button key={r.d} className={`dashrange${range === r.d ? " on" : ""}`} onClick={() => { setRange(r.d); setSel(null); setGsel(null); }}>{lc[r.k]}</button>
        ))}
      </div>
      <div className="dashcards">
        {cards.map((c, i) => {
          const dl = delta(c.val, c.prev), up = dl >= 0;
          return (
            <div key={i} className="dashcard">
              <div className="dashcard-v">{c.val.toLocaleString()}{c.suffix || ""}</div>
              <div className="dashcard-l">{c.lbl}</div>
              <div className={`dashcard-d ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(dl)}%</div>
            </div>
          );
        })}
      </div>
      <div className="dashchart">
        <div className="dashchart-h">{lc.dashActivity}{selB && <span className="dashtip">{fmtD(selB.from)}{selB.days > 1 ? `–${fmtD(selB.to)}` : ""} · {selB.sessions} · {selB.acc}%</span>}</div>
        <div className="dashbars">
          {buckets.map((b, i) => (
            <button key={i} className={`dashbar${sel === i ? " sel" : ""}`} onClick={() => setSel(sel === i ? null : i)} title={`${fmtD(b.from)} · ${b.sessions}`}>
              <span style={{ height: Math.round((b.sessions / maxS) * 100) + "%" }} />
            </button>
          ))}
        </div>
      </div>
      {selB && (
        <div className="dashdetail">
          <div className="dashdetail-h">{fmtD(selB.from)}{selB.days > 1 ? ` – ${fmtD(selB.to)}` : ""}</div>
          <div className="dashdetail-stats">
            <span>{lc.dashSessions} <b>{selB.sessions}</b></span>
            <span>{lc.dashAcc} <b>{selB.acc}%</b></span>
            <span>{lc.dashExp} <b>{selB.exp}</b></span>
          </div>
          {selB.days === 1 && (() => {
            const k = dayKey(selB.from), games = gameLog.filter(g => g.d === k);
            return games.length ? (
              <div className="dashdetail-games">
                {games.slice(-8).map((g, i) => (
                  <div key={i} className="dashgame-row">
                    <span className="dashgame-song"><b style={{ color: "#d97757" }}>{"★".repeat(g.stars)}</b> {g.song}</span>
                    <span className="dashgame-acc">{g.acc}%</span>
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      )}
      {buckets.some(b => b.acc > 0) ? (
        <div className="dashchart">
          <div className="dashchart-h">{lc.dashAccTrend}</div>
          <svg className="dashline" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points={accPts} fill="none" stroke="#d97757" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </div>
      ) : <div className="trendempty">{lc.profNoData}</div>}

      {/* falling-notes game stats — filtered to the same range */}
      <div className="profsec-h" style={{ marginTop: 18 }}>{lc.gameStatsTitle}</div>
      <div className="dashcards three">
        <div className="dashcard"><div className="dashcard-v">{gPlays}</div><div className="dashcard-l">{lc.gameStatsPlays}</div></div>
        <div className="dashcard"><div className="dashcard-v">{gAvg}%</div><div className="dashcard-l">{lc.dashAcc}</div></div>
        <div className="dashcard"><div className="dashcard-v">{gBest.toLocaleString()}</div><div className="dashcard-l">{lc.gameStatsBest}</div></div>
      </div>
      {gRecent.length ? (
        <div className="dashchart">
          <div className="dashchart-h">{lc.gameStatsAcc}{selG && <span className="dashtip">{"★".repeat(selG.stars)} {selG.song} · {selG.score.toLocaleString()}</span>}</div>
          <div className="dashbars">
            {gRecent.map((g, i) => (
              <button key={i} className={`dashbar${gsel === i ? " sel" : ""}`} onClick={() => setGsel(gsel === i ? null : i)} title={`${g.song} · ${g.acc}%`}>
                <span style={{ height: Math.max(4, g.acc) + "%", background: starC(g.stars) }} />
              </button>
            ))}
          </div>
          <div className="dashgame-x">{gRecent.map((g, i) => <span key={i}>{fmtT(g.t)}</span>)}</div>
        </div>
      ) : <div className="trendempty">{lc.profNoData}</div>}
    </div>
  );
});

/* ── Falling-notes game stats: recent plays as easy bar graphs (accuracy per play,
   colored by stars), with totals. ── */
const GameStats = memo(function GameStats({ lang }) {
  const lc = L[lang];
  const [sel, setSel] = useState(null);
  const log = readGameLog();
  if (!log.length) return null;
  const recent = log.slice(-12);
  const plays = log.length;
  const avg = Math.round(log.reduce((s, g) => s + (g.acc || 0), 0) / plays);
  const best = Math.max(0, ...log.map(g => g.score || 0));
  const starC = (s) => s >= 3 ? "#d97757" : s >= 2 ? "#ff76d8" : s >= 1 ? "#ff94e0" : "#a8329a";
  const selG = sel != null ? recent[sel] : null;
  const fmtD = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };
  return (
    <div className="profsec">
      <div className="profsec-h">{lc.gameStatsTitle}</div>
      <div className="dashcards three">
        <div className="dashcard"><div className="dashcard-v">{plays}</div><div className="dashcard-l">{lc.gameStatsPlays}</div></div>
        <div className="dashcard"><div className="dashcard-v">{avg}%</div><div className="dashcard-l">{lc.dashAcc}</div></div>
        <div className="dashcard"><div className="dashcard-v">{best.toLocaleString()}</div><div className="dashcard-l">{lc.gameStatsBest}</div></div>
      </div>
      <div className="dashchart">
        <div className="dashchart-h">{lc.gameStatsAcc}{selG && <span className="dashtip">{"★".repeat(selG.stars)} {selG.song} · {selG.score.toLocaleString()}</span>}</div>
        <div className="dashbars">
          {recent.map((g, i) => (
            <button key={i} className={`dashbar${sel === i ? " sel" : ""}`} onClick={() => setSel(sel === i ? null : i)} title={`${g.song} · ${g.acc}%`}>
              <span style={{ height: Math.max(4, g.acc) + "%", background: starC(g.stars) }} />
            </button>
          ))}
        </div>
        <div className="dashgame-x">{recent.map((g, i) => <span key={i}>{fmtD(g.t)}</span>)}</div>
      </div>
    </div>
  );
});

const ProfilePage = memo(function ProfilePage({ lang, session, profile, onSignOut, onOpenShop, onOpenHelp, coins }) {
  const lc = L[lang];
  const meta = (session && session.user && session.user.user_metadata) || {};
  const exp = (profile && profile.exp) || 0;
  const info = levelInfo(exp);
  const tier = info.tier;
  const color = tier.c;
  const name = (profile && profile.full_name) || meta.full_name || meta.name ||
    ((session && session.user && session.user.email) || "").split("@")[0] || "TiGA";
  const avatar = (profile && profile.avatar_url) || meta.avatar_url || meta.picture || null;
  const initials = (name || "TG").trim().slice(0, 2).toUpperCase();
  const lessons = (profile && profile.lessons_done) || 0;
  const streak = (profile && profile.streak) || 0;
  const qToday = questToday(profile);
  const qDone = qToday >= QUEST_GOAL;
  const gotBadges = unlockedBadgeIds(profile);

  const toNext = info.isMax ? lc.profMaxRank
    : lang === "th" ? `อีก ${info.need.toLocaleString()} EXP → เลเวลถัดไป`
    : lang === "zh" ? `还差 ${info.need.toLocaleString()} EXP → 升级`
    : `${info.need.toLocaleString()} EXP → next level`;

  // contact fields are optional at signup now — let people fill them in later
  // right here instead of only on the one-time onboarding screen.
  const [contactEdit, setContactEdit] = useState(false);
  const [cLine, setCLine] = useState((profile && profile.line_id) || "");
  const [cPhone, setCPhone] = useState((profile && profile.phone) || "");
  const [cIg, setCIg] = useState((profile && profile.instagram) || "");
  const [cSaving, setCSaving] = useState(false);
  const [localContact, setLocalContact] = useState(null); // optimistic override after save
  const liveLine = localContact ? localContact.line_id : (profile && profile.line_id);
  const livePhone = localContact ? localContact.phone : (profile && profile.phone);
  const liveIg = localContact ? localContact.instagram : (profile && profile.instagram);
  async function saveContact() {
    if (!session || !session.user) return;
    setCSaving(true);
    const vals = { line_id: cLine.trim() || null, phone: cPhone.trim() || null, instagram: cIg.trim() || null };
    const { error } = await sb.from("profiles").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", session.user.id);
    setCSaving(false);
    if (!error) { setLocalContact(vals); setContactEdit(false); }
  }
  const contacts = [
    { ico: "📧", val: (profile && profile.email) || (session && session.user && session.user.email) },
    { ico: "💬", val: liveLine },
    { ico: "📱", val: livePhone },
    { ico: "📸", val: liveIg },
  ];
  const missingContact = !liveLine && !livePhone;

  // ── progress dashboard data (practice heatmap + accuracy trend) ──
  const plog = readPracticeLog();
  const heatDays = [];
  const _today = new Date();
  for (let i = 83; i >= 0; i--) {
    const dd = new Date(_today); dd.setDate(_today.getDate() - i);
    const key = dayKey(dd);
    const n = plog[key] ? plog[key].n : 0;
    heatDays.push({ date: key, n, lvl: n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3 });
  }
  const activeDays = heatDays.filter(d => d.n > 0).length;
  const weekly = readWeekly();
  const trend = (Array.isArray(plog._recent) ? plog._recent : []).slice(-14);
  const trendPts = trend.map((p, i) => {
    const x = trend.length > 1 ? (i / (trend.length - 1)) * 100 : 50;
    const y = 29 - (Math.max(0, Math.min(100, p.acc)) / 100) * 27;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");

  return (
    <div className="profpage" style={{ "--lv-c": color }}>
      <div className="profhero">
        <div className="profhero-glow" />
        <div className="profava-wrap">
          <div className="profava-ring" />
          <div className="profava-frame" />
          <div className="profava">
            {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
          </div>
        </div>
        <div className="profname">{name}</div>
        <div className="profrankbadge">
          <span aria-hidden="true">{tier.icon}</span>
          <span>{lc.profLevelWord} {info.level} · {tr(tier, lang)}</span>
        </div>

        <div className="expwrap">
          <div className="exprow">
            <span><span className="expnum">{exp.toLocaleString()}</span> EXP</span>
            <span>{info.isMax ? "MAX" : `${info.nextMin.toLocaleString()} EXP`}</span>
          </div>
          <div className="expbar">
            <div className="expfill" style={{ width: `${Math.round(info.progress * 100)}%` }} />
          </div>
          <div className="expnext">{toNext}</div>
        </div>
      </div>

      <div className="profstats">
        <div className="statcard">
          <div className="statval">{exp.toLocaleString()}</div>
          <div className="statlbl">{lc.profExpStat}</div>
        </div>
        <div className="statcard">
          <div className="statval">{lessons}</div>
          <div className="statlbl">{lc.profLessonsStat}</div>
        </div>
        <div className="statcard">
          <div className="statval">{streak}<span className="em"> 🔥</span></div>
          <div className="statlbl">{lc.profStreakBest}</div>
        </div>
      </div>

      {/* interactive progress dashboard — range selector + period comparison + charts + game stats */}
      <ProgressDashboard lang={lang} />

      {/* Auto Teaching recap — current weak spots + the most recent real-time tip (Max plan) */}
      {isMaxPlan(effectivePlan(profile)) && (() => {
        const atLog = readAutoTeachLog();
        const last = atLog[atLog.length - 1];
        const struggles = (readMemory().struggles || []).slice(0, 5);
        return (
          <div className="profsec">
            <div className="profsec-h">🎯 Auto Teaching</div>
            {struggles.length > 0 && (
              <div className="pd-tags">{struggles.map((s, i) => <span key={i} className="pd-tag focus">{s.label}</span>)}</div>
            )}
            {last ? (
              <div className="atdash-last">
                <div className="atdash-last-w">{last.weakness}</div>
                <div className="atdash-last-t">{last.tip}</div>
                <div className="atdash-last-d">{new Date(last.t).toLocaleString(TTS_LOCALES[lang] || "en-US")}</div>
              </div>
            ) : (
              <div className="atdash-empty">{lang === "th" ? "ยังไม่มีคำแนะนำ — กลับไปหน้าเส้นทางการเรียนรู้เพื่อรับคำแนะนำแบบเรียลไทม์" : lang === "zh" ? "暂无建议——返回学习路径页面以获得实时指导" : "No tips yet — head to the Pathway page to get real-time coaching"}</div>
            )}
          </div>
        );
      })()}

      {/* practice heatmap (consistency) + accuracy trend */}
      <div className="profsec">
        <div className="profsec-h">
          {lc.profProgress}
          <span style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono',monospace", fontSize: "10px", fontWeight: 400, color: "var(--muted)" }}>
            {activeDays} {lc.profActiveDays}
          </span>
        </div>
        <div className="heatcard">
          <div className="heatgrid">
            {heatDays.map((d, i) => (
              <div key={i} className="heatcell" style={{ background: heatColor(d.lvl) }} title={d.date + (d.n ? ` · ${d.n}×` : "")} />
            ))}
          </div>
          <div className="heatlegend">
            <span>{lc.profLess}</span>
            {[0, 1, 2, 3].map(l => <i key={l} style={{ background: heatColor(l) }} />)}
            <span>{lc.profMore}</span>
          </div>
          {trend.length >= 2 ? (
            <div className="trendwrap">
              <div className="trendlbl">{lc.profAccTrend} <b>{trend[trend.length - 1].acc}%</b></div>
              <svg className="trendsvg" viewBox="0 0 100 30" preserveAspectRatio="none">
                <polyline points={trendPts} fill="none" stroke="#d97757" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <div className="trendempty">{lc.profNoData}</div>
          )}
        </div>
      </div>

      {/* daily quest — drives daily return */}
      <div className="profsec">
        <div className="profsec-h">{lc.profQuests}</div>
        <div className={`questcard${qDone ? " done" : ""}`}>
          <div className="questrow">
            <span className="questname">🎯 {lc.questText}</span>
            <span className="questrew">{qDone ? lc.questDoneText : `+${QUEST_BONUS} EXP`}</span>
          </div>
          <div className="questbar">
            <div className="questfill" style={{ width: `${Math.round(Math.min(qToday, QUEST_GOAL) / QUEST_GOAL * 100)}%` }} />
          </div>
          <div className="questcount">{Math.min(qToday, QUEST_GOAL)} / {QUEST_GOAL}</div>
        </div>
      </div>

      {/* weekly challenges */}
      <div className="profsec">
        <div className="profsec-h">{lc.weeklyTitle}</div>
        {CHALLENGES.map(ch => {
          const v = Math.min(weekly[ch.id] || 0, ch.goal), done = v >= ch.goal;
          return (
            <div key={ch.id} className={`wkrow${done ? " done" : ""}`}>
              <span className="wkic">{ch.icon}</span>
              <div className="wkbody">
                <div className="wktop"><span>{tr(ch, lang)}</span><b>{done ? `✓ +${CHALLENGE_REWARD}🪙` : `${v}/${ch.goal}`}</b></div>
                <div className="wkbar"><div style={{ width: (v / ch.goal * 100) + "%" }} /></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* achievements / badges to collect */}
      <div className="profsec">
        <div className="profsec-h">
          {lc.profBadges}
          <span style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono',monospace", fontSize: "10px", fontWeight: 400, color: "var(--muted)", letterSpacing: ".5px" }}>
            {gotBadges.length}/{BADGES.length}
          </span>
        </div>
        <div className="badgegrid">
          {BADGES.map(b => {
            const got = gotBadges.includes(b.id);
            return (
              <div key={b.id} className={`badge${got ? " got" : ""}`} title={tr(b, lang)}>
                <span className="badge-ic" aria-hidden="true">{got ? b.icon : "🔒"}</span>
                <span className="badge-nm">{tr(b, lang)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <LeaderboardSection lang={lang} />

      <div className="profsec">
        <div className="profsec-h">{lc.profRanks}</div>
        {LEVELS.map((lv, i) => {
          const lvNum = i + 1;
          const state = lvNum === info.level ? "cur" : lv.min <= exp ? "done" : "locked";
          const range = i + 1 < LEVELS.length
            ? `${lv.min.toLocaleString()} – ${(LEVELS[i + 1].min - 1).toLocaleString()} EXP`
            : `${lv.min.toLocaleString()}+ EXP`;
          return (
            <div key={i} className={`rankrow ${state}`} style={{ "--lv-c": lv.c }}>
              <span className="rankicon" aria-hidden="true">{lv.icon}</span>
              <div className="rankmeta">
                <div className="rankname">{lc.profLevelWord} {lvNum} · {tr(lv, lang)}</div>
                <div className="rankexp">{range}</div>
              </div>
              <span className="ranktick">{state === "done" ? "✓" : state === "cur" ? "▶" : "🔒"}</span>
            </div>
          );
        })}
      </div>

      <div className="profsec">
        <div className="profsec-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{lc.profContact}</span>
          {!contactEdit && (
            <button className="memberlink" style={{ fontSize: 12 }} onClick={() => { setCLine(liveLine || ""); setCPhone(livePhone || ""); setCIg(liveIg || ""); setContactEdit(true); }}>
              ✎ {lc.profContactEdit}
            </button>
          )}
        </div>
        {contactEdit ? (
          <div className="contactcard" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
            <input className="memberinput" placeholder="LINE ID" value={cLine} onChange={e => setCLine(e.target.value)} />
            <input className="memberinput" placeholder="เบอร์โทรศัพท์ (Phone)" value={cPhone} onChange={e => setCPhone(e.target.value)} inputMode="tel" />
            <input className="memberinput" placeholder="Instagram" value={cIg} onChange={e => setCIg(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="lockbtn" style={{ flex: 1 }} disabled={cSaving} onClick={saveContact}>{cSaving ? "…" : lc.profContactSave}</button>
              <button className="memberlink" onClick={() => setContactEdit(false)}>{lc.profContactCancel}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="contactcard">
              {contacts.map((c, i) => (
                <div key={i} className="contactrow">
                  <span className="contactico" aria-hidden="true">{c.ico}</span>
                  <span className={`contactval${c.val ? "" : " empty"}`}>{c.val || "—"}</span>
                </div>
              ))}
            </div>
            {missingContact && (
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, cursor: "pointer" }}
                onClick={() => { setCLine(""); setCPhone(""); setCIg(liveIg || ""); setContactEdit(true); }}>
                💡 {lc.profContactNudge}
              </div>
            )}
          </>
        )}
      </div>

      {(onOpenShop || onOpenHelp) && (
        <div className="profsec">
          {onOpenShop && <button className="songbtn ghost" style={{ width: "100%", marginBottom: 8 }} onClick={onOpenShop}>🪙 {lc.shopTitle} · {coins}</button>}
          {onOpenHelp && <button className="songbtn ghost" style={{ width: "100%" }} onClick={onOpenHelp}>❓ {lc.helpTitle}</button>}
        </div>
      )}
      {onSignOut && <button className="profsignout" onClick={onSignOut}>⏻ {lc.profSignOut}</button>}
    </div>
  );
});

/* ── Coach page (nav bar, Max plan): the same AI coaching analysis the Pathway-page popup
   shows, always available on demand — current problem, how to fix it, and which in-app
   feature to practice with, so acting on the advice is one tap away. ── */
const CoachPage = memo(function CoachPage({ lang, profile, onNavigate }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [current, setCurrent] = useState(() => { const log = readAutoTeachLog(); return log[log.length - 1] || null; });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [history, setHistory] = useState(() => readAutoTeachLog().slice(0, -1).slice(-6).reverse());
  const mem = readMemory();
  const struggles = (mem.struggles || []).slice(0, 6);
  // "has data" now also checks the full activity journal (readActLog) — a learner who's
  // only done lessons/ear-training/reading has plenty to analyze even with an empty
  // struggles/recent cache, which only Practice Mode/Play Along/Sight-Reading feed.
  const hasData = (mem.recent || []).length > 0 || struggles.length > 0 || readActLog().length > 0;
  // Local, synchronous — renders instantly without waiting on the AI call, and is the exact
  // same numbers generateCoachTip's prompt reasons over (see coachStatsToText).
  const stats = useMemo(() => computeCoachStats(profile, lang), [profile, lang]);
  const accDelta = stats.acc7 != null && stats.accPrev != null ? stats.acc7 - stats.accPrev : null;

  const refresh = useCallback(async () => {
    setBusy(true);
    setErr(false);
    try {
      const obj = await generateCoachTip(lang, profile);
      if (obj) {
        logAutoTeachTip(obj.weakness, obj.steps.join(" / "), obj.feature);
        setCurrent({ t: Date.now(), weakness: obj.weakness, tip: obj.steps.join(" / "), feature: obj.feature, steps: obj.steps });
        setHistory(readAutoTeachLog().slice(0, -1).slice(-6).reverse());
      } else {
        setErr(true);
      }
    } catch (e) { setErr(true); }
    setBusy(false);
  }, [lang, profile]);

  // Skip auto-firing on a genuinely blank profile — nothing to analyze yet, and asking the
  // AI to invent a "weakness" out of zero data would just show a brand-new learner a made-up tip.
  useEffect(() => { if (!current && hasData) refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = current && (current.steps || (current.tip ? current.tip.split(" / ") : []));
  const feature = current && COACH_FEATURE_LABELS[current.feature || "pathway"];

  return (
    <div className="profscroll">
      <div className="profsec">
        <div className="profsec-h">🎯 {T("Daily Mentor", "Daily Mentor", "Daily Mentor")}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 12, whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }}>
          {T("สรุปจุดอ่อนตอนนี้ วิธีแก้ และควรฝึกด้วยฟีเจอร์ไหนของแอป — อัปเดตทุกครั้งที่กดวิเคราะห์ใหม่",
            "Your current weak spot, how to fix it, and which app feature to practice with — refresh any time.",
            "当前薄弱点、解决方法，以及应该用哪个功能来练习——随时可以重新分析。")}
        </div>

        {hasData && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div className="instile" style={{ minWidth: 0 }}><b>{stats.level}</b><span>{T("เลเวล", "Level", "等级")}</span></div>
            <div className="instile" style={{ minWidth: 0 }}><b>{stats.streak}🔥</b><span>{T("สตรีค", "Streak", "连续")}</span></div>
            <div className="instile" style={{ minWidth: 0 }}><b>{stats.days7}/7</b><span>{T("วันที่ซ้อม", "Days practiced", "练习天数")}</span></div>
            <div className="instile" style={{ minWidth: 0 }}>
              <b>{stats.acc7 == null ? "—" : stats.acc7 + "%"}
                {accDelta != null && accDelta !== 0 && (
                  <span style={{ fontSize: 9, marginLeft: 3, color: accDelta > 0 ? "#d97757" : "#ff5252" }}>
                    {accDelta > 0 ? "▲" : "▼"}{Math.abs(accDelta)}
                  </span>
                )}
              </b>
              <span>{T("แม่นยำ 7 วัน", "7-day accuracy", "7天准确率")}</span>
            </div>
          </div>
        )}

        {stats.weakest.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="admstu-sec" style={{ marginBottom: 6 }}>📊 {T("จุดที่ควรเก็บ (อัตราพลาด)", "Spots to polish (miss rate)", "待加强项目（错误率）")}</div>
            {stats.weakest.map((w, i) => (
              <div key={i} className="wkrow">
                <div className="wkbody">
                  <div className="wktop"><span>{w.label}</span><b style={{ color: "#ff5252" }}>{w.rate}% · {w.n}×</b></div>
                  <div className="wkbar"><div style={{ width: w.rate + "%", background: "#ff5252" }} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {busy && !current ? (
          <div className="atdash-empty">⏳ {T("กำลังวิเคราะห์...", "Analyzing...", "正在分析...")}</div>
        ) : current ? (
          <div className="atdash-last">
            <div className="atdash-last-w">{current.weakness}</div>
            {steps && steps.length > 0 && (
              <ol className="songanalysis-steps" style={{ marginTop: 8 }}>
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            )}
            {feature && (
              <button className="songbtn go" style={{ width: "100%", marginTop: 12 }}
                onClick={() => onNavigate(current.feature || "pathway")}>
                ▶ {T("ไปฝึก: ", "Practice: ", "去练习：") + feature[lang]}
              </button>
            )}
            <div className="atdash-last-d">{new Date(current.t).toLocaleString(TTS_LOCALES[lang] || "en-US")}</div>
          </div>
        ) : err ? (
          <div className="atdash-empty">{T("วิเคราะห์ไม่สำเร็จ — เช็กอินเทอร์เน็ตแล้วลองใหม่ด้วยปุ่มด้านล่าง", "Couldn't analyze right now — check your connection and try again below.", "分析失败——请检查网络连接，然后点击下方按钮重试。")}</div>
        ) : (
          <div className="atdash-empty">{T("ยังไม่มีข้อมูลการซ้อม — ลองฝึกในสตูดิโอก่อน แล้วกลับมาดูคำแนะนำ", "No practice data yet — try the Studio first, then come back for coaching.", "暂无练习数据——先去工作室练习，再回来查看建议。")}</div>
        )}

        <button className="songbtn ghost" style={{ width: "100%", marginTop: 14 }} disabled={busy} onClick={refresh}>
          {busy ? "⏳" : "🔄"} {T("วิเคราะห์ใหม่", "Re-analyze", "重新分析")}
        </button>

        {history.length > 0 && (<>
          <div className="admstu-sec" style={{ marginTop: 18 }}>{T("คำแนะนำก่อนหน้า", "Earlier tips", "以往建议")}</div>
          {history.map((h, i) => (
            <div key={i} className="atdash-last" style={{ marginTop: 8 }}>
              <div className="atdash-last-w">{h.weakness}</div>
              <div className="atdash-last-t">{h.tip}</div>
              <div className="atdash-last-d">{new Date(h.t).toLocaleString(TTS_LOCALES[lang] || "en-US")}</div>
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
});

/* ── Admin lock screen ── */
function LockScreen({ lang, onUnlock }) {
  const lc = L[lang];
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  function tryUnlock() {
    if (onUnlock(code)) { setErr(""); }
    else { setErr(lc.lockErr); setCode(""); }
  }
  return (
    <div className="lockwrap">
      <div className="lockicon">🔐</div>
      <div className="locktitle">{lc.lockTitle}</div>
      <div className="locksub">{lc.lockSub}</div>
      <input className="lockinput" type="password" value={code}
        placeholder={lc.lockPlace}
        onChange={e => setCode(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") tryUnlock(); }} />
      <div className="lockerr">{err}</div>
      <button className="lockbtn" onClick={tryUnlock}>{lc.lockEnter}</button>
    </div>
  );
}

/* ── Share gate: free users share FB + TikTok to keep playing past the free limit ── */
function ShareGate({ lang, onClose, onUnlock, onUpgrade }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [fb, setFb] = useState(false);
  const [tk, setTk] = useState(false);
  const open = (url, which) => { try { window.open(url, "_blank", "noopener"); } catch (e) {} which === "fb" ? setFb(true) : setTk(true); };
  const ready = fb && tk;
  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="sethdr"><span>🎁 {T("เล่นต่อฟรี", "Keep playing free", "继续免费玩")}</span><button className="cbtn" onClick={onClose}>✕</button></div>
        <div className="setbody">
          <p className="pr-sub">{T("คุณเล่นครบ 5 เนื้อหาฟรีแล้ว! แค่แชร์/ติดตามเพจของเราทั้ง 2 ช่อง ก็เล่นต่อฟรีไม่อั้นเลย 💜", "You've enjoyed 5 free contents! Just share & follow our two pages to keep playing free, unlimited 💜", "你已体验5个免费内容！分享并关注我们的两个主页即可继续无限免费畅玩 💜")}</p>
          <button className={`sharebtn fb${fb ? " done" : ""}`} onClick={() => open(SHARE_FB, "fb")}>{fb ? "✓ " : "📘 "}{T("แชร์ Facebook", "Share on Facebook", "分享 Facebook")}</button>
          <button className={`sharebtn tk${tk ? " done" : ""}`} onClick={() => open(SHARE_TIKTOK, "tk")}>{tk ? "✓ " : "🎵 "}{T("ติดตาม TikTok", "Follow on TikTok", "关注 TikTok")}</button>
          <button className="songbtn go" style={{ width: "100%", marginTop: 12 }} disabled={!ready} onClick={onUnlock}>
            {ready ? "🔓 " + T("ปลดล็อก เล่นต่อเลย!", "Unlock & keep playing!", "解锁，继续玩！") : T("แตะแชร์ทั้ง 2 ช่องก่อน", "Tap both above first", "请先点上面两个")}
          </button>
          {onUpgrade && <button className="memberlink" style={{ marginTop: 10 }} onClick={onUpgrade}>{T("หรือสมัครพรีเมียม เล่นไม่อั้นไม่ต้องแชร์ →", "or go Premium — unlimited, no sharing →", "或升级 Premium — 无限畅玩免分享 →")}</button>}
          <button className="memberlink" style={{ marginTop: 6 }} onClick={onClose}>{T("ภายหลัง", "Later", "稍后")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Checkout: PromptPay QR for a plan + slip upload (verified by admin) ── */
function CheckoutModal({ lang, checkout, payCfg, session, isAdmin, onClose }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [st, setSt] = useState("idle");   // idle · uploading · done · error
  const [cfg, setCfg] = useState(payCfg); // refreshed live so a just-set PromptPay works without reload
  const [pp, setPp] = useState(""); const [nm, setNm] = useState(""); const [bk, setBk] = useState(""); const [savingCfg, setSavingCfg] = useState(false);
  const fileRef = useRef(null);
  const amount = checkout.amount;
  const planLabel = PLAN_LABEL[checkout.plan] || checkout.plan;
  useEffect(() => {
    sb.from("app_settings").select("value").eq("key", "payment").maybeSingle()
      .then(({ data }) => { if (data && data.value) setCfg(data.value); }, () => {});
  }, []);
  const ppId = cfg && cfg.promptpay;
  async function saveCfgInline() {
    if (!pp.trim()) return;
    setSavingCfg(true);
    const value = { promptpay: pp.trim(), name: nm.trim(), bank: bk.trim() };
    const { error } = await sb.from("app_settings").upsert({ key: "payment", value, updated_at: new Date().toISOString() });
    setSavingCfg(false);
    if (!error) { setCfg(value); playUi("levelup"); }
  }
  const qr = useMemo(() => ppId ? promptPayQR(ppId, amount) : null, [ppId, amount]);
  const uid = session && session.user && session.user.id;
  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f || !uid) return;
    if (f.size > 6 * 1024 * 1024) { setSt("error"); return; }
    setSt("uploading");
    try {
      const ext = ((f.type.split("/")[1]) || "jpg").replace("jpeg", "jpg");
      const path = `${uid}/${Date.now()}.${ext}`;
      const up = await sb.storage.from("slips").upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw up.error;
      const meta = (session.user.user_metadata) || {};
      const ins = await sb.from("payments").insert({
        user_id: uid, email: session.user.email || null, full_name: meta.full_name || meta.name || null,
        plan: checkout.plan, amount, method: "promptpay", slip_path: path, status: "pending", days: checkout.days || 30,
      });
      if (ins.error) throw ins.error;
      setSt("done"); playUi("levelup");
    } catch (err) { setSt("error"); }
  }
  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard pricing" onClick={e => e.stopPropagation()}>
        <div className="sethdr"><span>💳 {T("ชำระเงิน", "Checkout", "结账")}</span><button className="cbtn" onClick={onClose}>✕</button></div>
        <div className="setbody">
          {st === "done" ? (
            <div className="payok">
              <div style={{ fontSize: 46 }}>✅</div>
              <div className="payok-h">{T("ได้รับสลิปแล้ว!", "Slip received!", "已收到凭证！")}</div>
              <p className="pr-sub">{T("กำลังตรวจสอบการชำระเงิน — ระบบจะเปิดสิทธิ์ให้อัตโนมัติเมื่อตรวจผ่าน (ปกติไม่เกิน 24 ชม.)", "We're verifying your payment — your plan unlocks automatically once approved (usually within 24h).", "正在核对付款，通过后自动开通（通常24小时内）。")}</p>
              <button className="songbtn go" style={{ width: "100%" }} onClick={onClose}>{T("เสร็จสิ้น", "Done", "完成")}</button>
            </div>
          ) : (
            <>
              <div className="paysum"><span>{planLabel}{checkout.cycle === "year" ? " · " + T("รายปี", "yearly", "年付") : ""}</span><b className="prtier-price">฿{amount.toLocaleString()}<small>/{checkout.cycle === "year" ? T("ปี", "yr", "年") : T("เดือน", "mo", "月")}</small></b></div>
              {ppId ? (
                <>
                  {qr ? <img className="payqr" src={qr} alt="PromptPay QR" /> : <div className="aicreate-err">{T("สร้าง QR ไม่ได้", "Couldn't make QR", "无法生成二维码")}</div>}
                  <div className="payinfo">
                    <div>📱 PromptPay: <b>{ppId}</b></div>
                    {cfg.name && <div>👤 {cfg.name}</div>}
                    {cfg.bank && <div>🏦 {cfg.bank}</div>}
                  </div>
                  <p className="pr-sub">{T("สแกน QR ด้วยแอปธนาคาร โอนตามยอด แล้วอัปโหลดสลิปเพื่อยืนยัน", "Scan with your banking app, pay the exact amount, then upload the slip.", "用银行App扫码付款，然后上传凭证。")}</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ " + T("กำลังอัป...", "Uploading...", "上传中...") : "📤 " + T("อัปโหลดสลิป", "Upload slip", "上传凭证")}
                  </button>
                  {st === "error" && <div className="aicreate-err">{T("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง", "Upload failed, try again", "上传失败，请重试")}</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              ) : isAdmin ? (
                <div className="adminpay-cfg" style={{ marginBottom: 0 }}>
                  <div className="admstu-nm" style={{ fontSize: 15 }}>⚙️ {T("ตั้งเลขรับเงินตรงนี้เลย (เห็นเฉพาะแอดมิน)", "Set your payout PromptPay here (admin only)", "在此设置收款 PromptPay（仅管理员）")}</div>
                  <input value={pp} onChange={e => setPp(e.target.value)} placeholder={T("เบอร์ PromptPay หรือเลขผู้เสียภาษี", "PromptPay number or tax ID", "PromptPay 号码或税号")} inputMode="numeric" />
                  <input value={nm} onChange={e => setNm(e.target.value)} placeholder={T("ชื่อบัญชี / ชื่อร้าน", "Account / shop name", "账户/店名")} />
                  <input value={bk} onChange={e => setBk(e.target.value)} placeholder={T("ธนาคาร (ไม่บังคับ)", "Bank (optional)", "银行（可选）")} />
                  <button className="songbtn go" style={{ width: "100%", marginTop: 9 }} disabled={savingCfg || !pp.trim()} onClick={saveCfgInline}>
                    {savingCfg ? "⏳ " + T("กำลังบันทึก…", "Saving…", "保存中…") : "💾 " + T("บันทึก แล้วสร้าง QR", "Save & show QR", "保存并生成二维码")}
                  </button>
                </div>
              ) : (
                <div className="aicreate-err">{T("ร้านกำลังตั้งค่าการรับเงิน ลองใหม่อีกครั้งภายหลัง หรือทักแอดมินได้เลย", "Payment is being set up — please try again shortly or contact us.", "收款正在设置中，请稍后再试或联系我们。")}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Admin: all students' progress (reads every profile via admin RLS) ── */
function AdminStudents({ lang, viewerTier }) {
  const tier = viewerTier || 0;
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState(null);   // null = loading
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [mgPlan, setMgPlan] = useState("max");
  const [mgDays, setMgDays] = useState(30);
  const [mgBusy, setMgBusy] = useState(false);
  const [appointTier, setAppointTier] = useState(0);
  const openUser = (r) => { setSel(r); setMgPlan((r.plan && r.plan !== "free") ? r.plan : "max"); setMgDays(30); setAppointTier(r.admin_tier || 0); };
  async function applyPlan() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_set_plan", { target: sel.id, new_plan: mgPlan, days: Number(mgDays) || 30 });
    setMgBusy(false); if (!error) { playUi("levelup"); setSel(null); load(); }
  }
  async function suspendPlan() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_set_plan", { target: sel.id, new_plan: "free", days: 0 });
    setMgBusy(false); if (!error) { setSel(null); load(); }
  }
  async function toggleBan() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_set_ban", { target: sel.id, ban: !sel.banned });
    setMgBusy(false); if (!error) { setSel(null); load(); }
  }
  async function doAppoint() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_appoint", { target: sel.id, new_tier: appointTier });
    setMgBusy(false); if (!error) { setSel(null); load(); } else { alert(error.message || "error"); }
  }
  const load = useCallback(() => {
    setErr(""); setRows(null);
    sb.rpc("admin_list_students")
      .then(({ data, error }) => {
        if (error) { setErr(error.message || "error"); setRows([]); return; }
        const r = (data || []).slice().sort((a, b) => (b.last_active || "").localeCompare(a.last_active || "") || (b.exp || 0) - (a.exp || 0));
        setRows(r);
      }, (e) => { setErr("" + (e && e.message || e)); setRows([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (rows === null) return <div className="admstu"><div className="admstu-msg">⏳ {T("กำลังโหลดข้อมูลนักเรียน...", "Loading students...", "正在加载学生...")}</div></div>;

  if (sel) {
    const li = levelInfo(sel.exp || 0);
    const pr = sel.progress || {};
    const sum = pr.summary || {};
    const mem = pr.memory || {};
    const struggles = (mem.struggles || []).slice(0, 8);
    const mastered = (mem.mastered || []).slice(0, 12);
    const recent = (mem.recent || []).slice(0, 6);
    const plog = pr.practiceLog || {};
    const Stat = (num, lbl) => <div className="pd-stat"><div className="pd-num">{num}</div><div className="pd-lbl">{lbl}</div></div>;
    return (
      <div className="admstu">
        <button className="admstu-back" onClick={() => setSel(null)}>‹ {T("กลับ", "Back", "返回")}</button>
        <div className="admstu-head">
          <div className="admstu-av">{(sel.full_name || sel.email || "?").trim().charAt(0).toUpperCase()}</div>
          <div>
            <div className="admstu-nm">{sel.full_name || "—"} {sel.admin_tier > 0 && <span className="admstu-badge">{adminTierStars(sel.admin_tier)} ADMIN</span>}{sel.banned && <span className="adminpay-badge rejected">BANNED</span>}</div>
            <div className="admstu-em">{sel.email || "—"}</div>
            <div className="admstu-lv">{li.tier && li.tier.icon} {T("ระดับ", "Level", "等级")} {li.level} · {(sel.plan || "free").toUpperCase()} · {T("ใช้ล่าสุด", "Last active", "最近活跃")}: {sel.last_active || "—"}</div>
          </div>
        </div>
        {/* ⚙️ manage: change/suspend plan (Top Tier only) · ban (tier ≥2) */}
        {(tier >= 2) && (
          <div className="admmg">
            <div className="admmg-h">⚙️ {T("จัดการผู้ใช้", "Manage user", "用户管理")}</div>
            {tier >= 3 && (<>
              <div className="admmg-cur">{T("แพลนปัจจุบัน", "Current plan", "当前套餐")}: <b>{(sel.plan || "free").toUpperCase()}</b>{sel.plan_until ? " · " + T("ถึง", "until", "至") + " " + String(sel.plan_until).slice(0, 10) : ""}</div>
              <div className="admmg-row">
                <select className="admmg-sel" value={mgPlan} onChange={e => setMgPlan(e.target.value)}>
                  <option value="premium">⭐ Premium</option>
                  <option value="family">👨‍👩‍👧 Family</option>
                  <option value="max">👑 Max</option>
                  <option value="maxfamily">👑 Max Family</option>
                </select>
                <input className="admmg-days" type="number" min="1" value={mgDays} onChange={e => setMgDays(e.target.value)} />
                <span className="admmg-d">{T("วัน", "days", "天")}</span>
              </div>
              <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={mgBusy} onClick={applyPlan}>💾 {T("ตั้ง / เปลี่ยนแพลน", "Set / change plan", "设置/更改套餐")}</button>
            </>)}
            <div className="admmg-row2">
              {tier >= 3 && <button className="songbtn ghost" disabled={mgBusy} onClick={suspendPlan}>⏸ {T("ระงับ (เป็นฟรี)", "Suspend (free)", "暂停（免费）")}</button>}
              <button className={`songbtn ${sel.banned ? "go" : "ghost"}`} disabled={mgBusy} onClick={toggleBan}>{sel.banned ? "✓ " + T("ปลดแบน", "Unban", "解封") : "🚫 " + T("แบน ID", "Ban ID", "封禁")}</button>
            </div>
          </div>
        )}
        {/* 👑 appoint / re-tier admin — Top Tier only */}
        {tier >= 3 && (
          <div className="admmg">
            <div className="admmg-h">👑 {T("สิทธิ์แอดมิน", "Admin access", "管理员权限")}</div>
            <div className="admmg-cur">{T("ระดับปัจจุบัน", "Current tier", "当前等级")}: <b>{sel.admin_tier > 0 ? adminTierStars(sel.admin_tier) : T("ไม่ใช่แอดมิน", "Not an admin", "非管理员")}</b></div>
            <div className="admmg-row">
              <select className="admmg-sel" value={appointTier} onChange={e => setAppointTier(Number(e.target.value))}>
                <option value={0}>{T("ไม่ใช่แอดมิน", "Not an admin", "非管理员")}</option>
                <option value={1}>★ {T("ซัพพอร์ต (ดูอย่างเดียว)", "Support (view only)", "支持（仅查看）")}</option>
                <option value={2}>★★ {T("ปฏิบัติการ (แบน/ตั้งค่าสอน)", "Operations (ban / Auto Teaching)", "运营（封禁/自动教学）")}</option>
                <option value={3}>★★★ {T("Top Tier (สิทธิ์เต็ม)", "Top Tier (full access)", "最高级（完全权限）")}</option>
              </select>
            </div>
            <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={mgBusy} onClick={doAppoint}>👑 {T("บันทึกระดับแอดมิน", "Save admin tier", "保存管理员等级")}</button>
          </div>
        )}
        <div className="pd-stats">
          {Stat((sel.exp || 0).toLocaleString(), "EXP")}
          {Stat(sel.lessons_done || 0, T("บทเรียน", "Lessons", "课程"))}
          {Stat((sel.streak || 0) + "🔥", T("ต่อเนื่อง", "Streak", "连续"))}
          {Stat(sum.games || (pr.gameLog || []).length || 0, T("เล่นเกม", "Games", "游戏"))}
          {Stat((sum.avgAcc || 0) + "%", T("แม่นยำเฉลี่ย", "Avg acc", "平均准确"))}
          {Stat(sum.keysLearned || 0, T("คีย์ที่เรียน", "Keys learned", "已学键"))}
          {Stat(sum.pathDone != null ? sum.pathDone : (pr.pathDone || []).length, T("บทเส้นทาง", "Pathway", "路径"))}
        </div>
        <ProgressDashboard lang={lang} plog={plog} gameLog={pr.gameLog || []} />
        {struggles.length > 0 &&<><div className="admstu-sec">{T("ต้องฝึกเพิ่ม", "Needs work", "需加强")}</div><div className="pd-tags">{struggles.map((s, i) => <span key={i} className="pd-tag focus">{s.label || s}</span>)}</div></>}
        {mastered.length > 0 && <><div className="admstu-sec">{T("ทำได้ดีแล้ว", "Mastered", "已掌握")}</div><div className="pd-tags">{mastered.map((s, i) => <span key={i} className="pd-tag good">{s}</span>)}</div></>}
        {recent.length > 0 && <><div className="admstu-sec">{T("ฝึกล่าสุด", "Recently practiced", "最近练习")}</div><div className="pd-tags">{recent.map((s, i) => <span key={i} className="pd-tag">{s.label || s}</span>)}</div></>}
        {!pr.updated && <div className="admstu-empty" style={{ marginTop: 12 }}>{T("นักเรียนยังไม่ได้ซิงค์ข้อมูลละเอียด (เปิดแอปอีกครั้งเพื่อซิงค์)", "No detailed progress synced yet (opens after they use the app again)", "尚未同步详细进度（学生再次使用后同步）")}</div>}
      </div>
    );
  }

  const list = rows.filter(r => { const s = ((r.full_name || "") + " " + (r.email || "")).toLowerCase(); return s.includes(q.toLowerCase()); });
  return (
    <div className="admstu">
      <div className="admstu-top">
        <input className="admstu-search" value={q} onChange={e => setQ(e.target.value)} placeholder={T("ค้นหานักเรียน...", "Search students...", "搜索学生...")} />
        <button className="admstu-refresh" onClick={load}>↻</button>
      </div>
      {err && <div className="admstu-err">{T("อ่านข้อมูลไม่ได้ (ต้องเข้าสู่ระบบด้วยบัญชีแอดมิน)", "Can't read data (sign in with an admin account)", "无法读取（需用管理员账号登录）")}: {err}</div>}
      <div className="admstu-count">{list.length} {T("นักเรียน", "students", "名学生")}</div>
      <div className="admstu-list">
        {list.map(r => {
          const li = levelInfo(r.exp || 0);
          const sum = (r.progress && r.progress.summary) || {};
          return (
            <button key={r.id} className="admstu-row" onClick={() => openUser(r)}>
              <div className="admstu-av sm">{(r.full_name || r.email || "?").trim().charAt(0).toUpperCase()}</div>
              <div className="admstu-row-body">
                <div className="admstu-row-nm">{r.full_name || r.email || "—"} {r.admin_tier > 0 && <span className="admstu-badge">{adminTierStars(r.admin_tier)}</span>}{r.banned && <span className="adminpay-badge rejected">BAN</span>}{r.plan && r.plan !== "free" && <span className="adminpay-badge approved">{r.plan.toUpperCase()}</span>}</div>
                <div className="admstu-row-meta">Lv {li.level} · {(r.exp || 0).toLocaleString()} EXP · {r.lessons_done || 0} {T("บท", "lessons", "课")} · {(r.streak || 0)}🔥{sum.games ? " · " + sum.games + " " + T("เกม", "games", "游戏") : ""}</div>
                <div className="admstu-row-sub">{r.email}{r.last_active ? " · " + r.last_active : ""}</div>
              </div>
              <span className="admstu-row-go">›</span>
            </button>
          );
        })}
        {!list.length && <div className="admstu-empty">{T("ไม่พบนักเรียน", "No students found", "未找到学生")}</div>}
      </div>
    </div>
  );
}

/* ── Admin: payment review — PromptPay config, slip list, AI slip read, approve ── */
function AdminPayments({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [cfg, setCfg] = useState({ promptpay: "", name: "", bank: "" });
  const [cfgSaved, setCfgSaved] = useState(false);
  const [slipUrl, setSlipUrl] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setRows(null);
    sb.from("payments").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => setRows(error ? [] : (data || [])), () => setRows([]));
  }, []);
  useEffect(() => {
    load();
    sb.from("app_settings").select("value").eq("key", "payment").maybeSingle()
      .then(({ data }) => { if (data && data.value) setCfg({ promptpay: data.value.promptpay || "", name: data.value.name || "", bank: data.value.bank || "" }); });
  }, [load]);
  async function saveCfg() {
    setCfgSaved(false);
    const value = { promptpay: cfg.promptpay.trim(), name: cfg.name.trim(), bank: cfg.bank.trim() };
    const { error } = await sb.from("app_settings").upsert({ key: "payment", value, updated_at: new Date().toISOString() });
    if (!error) { setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2500); }
  }
  async function openSel(p) {
    setSel(p); setAiText(p.ai_check ? aiSummary(p.ai_check, p.amount) : ""); setSlipUrl(null);
    if (p.slip_path) { const { data } = await sb.storage.from("slips").createSignedUrl(p.slip_path, 600); setSlipUrl((data && data.signedUrl) || null); }
  }
  function aiSummary(c, amount) {
    if (!c) return "";
    if (c.raw) return c.raw;
    const match = c.match != null ? c.match : (Math.abs((c.amount || 0) - amount) < 1);
    return `฿${c.amount} · ${c.date || ""} ${c.time || ""}\n→ ${c.recipient || "?"}\n${T("จาก", "from", "来自")} ${c.sender || "?"} · ref ${c.ref || "-"}\n` +
      (match ? T("✅ ยอดตรง", "✅ amount matches", "✅ 金额相符") : T("⚠️ ยอดไม่ตรง (ควรเป็น ฿", "⚠️ amount mismatch (expected ฿", "⚠️ 金额不符（应为 ฿") + amount + ")");
  }
  async function aiRead() {
    if (!sel || !sel.slip_path) return;
    setAiBusy(true); setAiText("");
    try {
      const { data } = await sb.storage.from("slips").createSignedUrl(sel.slip_path, 600);
      const url = data && data.signedUrl; if (!url) throw new Error("no url");
      const blob = await (await fetch(url)).blob();
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      const media = blob.type || "image/jpeg";
      const sys = "You verify Thai bank-transfer / PromptPay slips. Read the slip image and return ONLY minified JSON: {\"amount\":number,\"date\":string,\"time\":string,\"sender\":string,\"recipient\":string,\"ref\":string,\"bank\":string}. Use null for any unreadable field.";
      const body = { model: API_MODEL, max_tokens: 600, system: sys, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: media, data: String(b64).split(",")[1] } }, { type: "text", text: "Extract the payment details from this slip. The expected amount is " + sel.amount + " THB." }] }] };
      const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body) });
      const d = await res.json();
      const txt = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      let parsed = null; try { const m = txt.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; } catch (e) {}
      if (parsed) parsed.match = Math.abs((parsed.amount || 0) - sel.amount) < 1;
      const store = parsed || { raw: txt.slice(0, 500) };
      setAiText(aiSummary(store, sel.amount));
      sb.from("payments").update({ ai_check: store }).eq("id", sel.id).then(() => {}, () => {});
    } catch (e) { setAiText(T("อ่านสลิปไม่สำเร็จ (ฟีเจอร์รูปภาพต้องรันนอก preview)", "Couldn't read slip (image AI needs to run outside preview)", "读取失败（图片AI需在预览外运行）")); }
    setAiBusy(false);
  }
  async function review(approve) {
    if (!sel) return; setBusy(true);
    const { error } = await sb.rpc("admin_review_payment", { pid: sel.id, approve, days: sel.days || 30 });
    setBusy(false);
    if (!error) { setSel(null); load(); }
  }

  if (sel) {
    const st = sel.status;
    return (
      <div className="adminpay">
        <button className="admstu-back" onClick={() => setSel(null)}>‹ {T("กลับ", "Back", "返回")}</button>
        <div className="admstu-head">
          <div className="admstu-av">{(sel.full_name || sel.email || "?").trim().charAt(0).toUpperCase()}</div>
          <div>
            <div className="admstu-nm">{sel.full_name || sel.email || "—"} <span className={`adminpay-badge ${st}`}>{st.toUpperCase()}</span></div>
            <div className="admstu-em">{sel.email}</div>
            <div className="admstu-lv">{(PLAN_LABEL[sel.plan] || sel.plan)} · <b style={{ color: "#d97757" }}>฿{(sel.amount || 0).toLocaleString()}</b> · {(sel.created_at || "").slice(0, 16).replace("T", " ")}</div>
          </div>
        </div>
        {slipUrl ? <img className="payslip" src={slipUrl} alt="slip" /> : <div className="admstu-empty">{sel.slip_path ? T("กำลังโหลดสลิป…", "Loading slip…", "加载中…") : T("ไม่มีสลิป", "No slip", "无凭证")}</div>}
        <button className="songbtn ghost" style={{ width: "100%" }} disabled={aiBusy || !sel.slip_path} onClick={aiRead}>
          {aiBusy ? "⏳ " + T("AI กำลังอ่าน…", "AI reading…", "AI 读取中…") : "🤖 " + T("ให้ AI อ่านสลิป", "AI: read this slip", "AI 读取凭证")}
        </button>
        {aiText && <div className="aibox">{aiText}</div>}
        {st === "pending" ? (
          <div className="songready-btns" style={{ marginTop: 10 }}>
            <button className="songbtn go" disabled={busy} onClick={() => review(true)}>✅ {T("อนุมัติ เปิดสิทธิ์ ", "Approve — ", "批准 — ")}{sel.days || 30} {T("วัน", "days", "天")}</button>
            <button className="songbtn ghost" disabled={busy} onClick={() => review(false)}>✕ {T("ปฏิเสธ", "Reject", "拒绝")}</button>
          </div>
        ) : <div className="admstu-empty">{T("ตรวจแล้ว", "Already reviewed", "已处理")}: {st}</div>}
      </div>
    );
  }

  const list = rows || [];
  const pending = list.filter(p => p.status === "pending");
  return (
    <div className="adminpay">
      <div className="adminpay-cfg">
        <div className="admstu-nm" style={{ fontSize: 15 }}>⚙️ {T("ตั้งค่ารับเงิน (PromptPay)", "Payment settings (PromptPay)", "收款设置（PromptPay）")}</div>
        <input value={cfg.promptpay} onChange={e => setCfg({ ...cfg, promptpay: e.target.value })} placeholder={T("เบอร์ PromptPay หรือเลขผู้เสียภาษี", "PromptPay number or tax ID", "PromptPay 号码或税号")} inputMode="numeric" />
        <input value={cfg.name} onChange={e => setCfg({ ...cfg, name: e.target.value })} placeholder={T("ชื่อบัญชี / ชื่อร้าน", "Account / shop name", "账户/店名")} />
        <input value={cfg.bank} onChange={e => setCfg({ ...cfg, bank: e.target.value })} placeholder={T("ธนาคาร (ไม่บังคับ)", "Bank (optional)", "银行（可选）")} />
        <button className="songbtn go" style={{ width: "100%", marginTop: 9 }} onClick={saveCfg}>{cfgSaved ? "✓ " + T("บันทึกแล้ว", "Saved", "已保存") : T("บันทึกการตั้งค่า", "Save settings", "保存设置")}</button>
      </div>
      <div className="admstu-count">{pending.length} {T("รอตรวจ", "pending", "待处理")} · {list.length} {T("ทั้งหมด", "total", "全部")}</div>
      {rows === null ? <div className="admstu-msg">⏳</div> : !list.length ? <div className="admstu-empty">{T("ยังไม่มีรายการชำระเงิน", "No payments yet", "暂无付款")}</div> : (
        <div className="admstu-list">
          {list.map(p => (
            <button key={p.id} className={`adminpay-row ${p.status}`} onClick={() => openSel(p)}>
              <div className="admstu-av sm">{(p.full_name || p.email || "?").trim().charAt(0).toUpperCase()}</div>
              <div className="admstu-row-body">
                <div className="admstu-row-nm">{p.full_name || p.email || "—"} <span className={`adminpay-badge ${p.status}`}>{p.status}</span></div>
                <div className="admstu-row-meta">{(PLAN_LABEL[p.plan] || p.plan)} · ฿{(p.amount || 0).toLocaleString()} · {(p.created_at || "").slice(0, 10)}</div>
              </div>
              <span className="admstu-row-go">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Admin: upload + manage vertical teaching videos ── */
function AdminVideos({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    sb.from("lesson_videos").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => setRows(error ? [] : (data || [])), () => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addVideo() {
    if (!title.trim()) { setErr("notitle"); return; }
    // a folder link (drive.google.com/drive/folders/…) embeds Google's own folder
    // browser with every video inside it — a single file link embeds just that video
    const folderId = driveFolderId(link);
    const fileId = folderId ? null : driveFileId(link);
    if (!folderId && !fileId) { setErr("badlink"); return; }
    setErr(false); setBusy(true);
    try {
      const row = { title: title.trim(), description: desc.trim() || null, published: true };
      if (folderId) row.drive_folder_id = folderId; else row.drive_file_id = fileId;
      const ins = await sb.from("lesson_videos").insert(row);
      if (ins.error) throw ins.error;
      setTitle(""); setDesc(""); setLink("");
      playUi("levelup");
      load();
    } catch (e) { setErr("fail"); }
    setBusy(false);
  }
  async function toggle(v) { await sb.from("lesson_videos").update({ published: !v.published }).eq("id", v.id); load(); }
  async function del(v) { await sb.from("lesson_videos").delete().eq("id", v.id); load(); }

  const list = rows || [];
  return (
    <div className="adminpay">
      <div className="adminpay-cfg">
        <div className="admstu-nm" style={{ fontSize: 15 }}>🎬 {T("เพิ่มวิดีโอ/โฟลเดอร์ใหม่จาก Google Drive", "Add a new video or folder from Google Drive", "从 Google Drive 添加新视频/文件夹")}</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={T("ชื่อวิดีโอ", "Video title", "视频标题")} />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={T("คำอธิบาย (ไม่บังคับ)", "Description (optional)", "描述（可选）")} />
        <input value={link} onChange={e => setLink(e.target.value)} placeholder={T("วางลิงก์ไฟล์วิดีโอ หรือลิงก์โฟลเดอร์ Google Drive", "Paste a video-file link OR a folder link", "粘贴视频文件链接或文件夹链接")} />
        <button className="songbtn go" style={{ width: "100%", marginTop: 9 }} disabled={busy} onClick={addVideo}>
          {busy ? "⏳ " + T("กำลังเพิ่ม…", "Adding…", "添加中…") : "➕ " + T("เพิ่ม", "Add", "添加")}
        </button>
        {err === "notitle" && <div className="admstu-empty" style={{ color: "#ff5252" }}>{T("ใส่ชื่อวิดีโอก่อนนะ", "Add a title first", "请先填写标题")}</div>}
        {err === "badlink" && <div className="admstu-empty" style={{ color: "#ff5252" }}>{T("อ่านลิงก์ Google Drive ไม่ออก ลองคัดลอกลิงก์แชร์มาใหม่", "Couldn't read that Google Drive link — copy the share link again", "无法识别该 Google Drive 链接，请重新复制共享链接")}</div>}
        {err === "fail" && <div className="admstu-empty" style={{ color: "#ff5252" }}>{T("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "Save failed — try again", "保存失败，请重试")}</div>}
        <div className="admstu-empty" style={{ fontSize: 11, marginTop: 6 }}>{T("💡 ไฟล์เดี่ยว: คลิกขวาไฟล์ → แชร์ → \"ทุกคนที่มีลิงก์\" → คัดลอกลิงก์ · ทั้งโฟลเดอร์: คลิกขวาโฟลเดอร์ → แชร์ → \"ทุกคนที่มีลิงก์\" → คัดลอกลิงก์ แล้ววางที่นี่", "💡 Single file: right-click → Share → \"Anyone with the link\" → copy · Whole folder: right-click the folder → Share → \"Anyone with the link\" → copy — either link works here", "💡 单个文件：右键 → 共享 → “知道链接的任何人” → 复制 · 整个文件夹：右键文件夹 → 共享 → “知道链接的任何人” → 复制，两种链接都可以粘贴到这里")}</div>
      </div>
      <div className="admstu-count">{list.length} {T("รายการทั้งหมด", "items total", "个项目")}</div>
      {rows === null ? <div className="admstu-msg">⏳</div> : !list.length ? <div className="admstu-empty">{T("ยังไม่มีวิดีโอ เพิ่มอันแรกได้เลย", "No videos yet — add the first one", "还没有视频，添加第一个吧")}</div> : (
        <div className="admstu-list">
          {list.map(v => (
            <div key={v.id} className="adminpay-row" style={{ cursor: "default" }}>
              <div className="admstu-av sm">{v.drive_folder_id ? "📁" : "🎬"}</div>
              <div className="admstu-row-body">
                <div className="admstu-row-nm">{v.title} <span className={`adminpay-badge ${v.published ? "approved" : "pending"}`}>{v.published ? T("เผยแพร่แล้ว", "Published", "已发布") : T("ฉบับร่าง", "Draft", "草稿")}</span></div>
                <div className="admstu-row-meta">{v.drive_folder_id ? T("โฟลเดอร์ · ", "Folder · ", "文件夹 · ") : ""}{(v.created_at || "").slice(0, 10)}{v.description ? " · " + v.description : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="songbtn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggle(v)}>{v.published ? T("ซ่อน", "Unpublish", "取消发布") : T("เผยแพร่", "Publish", "发布")}</button>
                <button className="songbtn ghost" style={{ padding: "6px 10px", fontSize: 12, color: "#ff5252" }} onClick={() => del(v)}>{T("ลบ", "Delete", "删除")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Admin: usage analytics — which Pathway topics / nav buttons / pages get
   used most, so development effort can follow real usage. ── */
function AdminAnalytics({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [range, setRange] = useState("all"); // '7' | '30' | 'all'
  const [stats, setStats] = useState(null);
  const NAV_LABELS = { pathway: "⬡ PATHWAY", sensei: "◈ TIGA AI", studio: "▶ STUDIO", videos: "🎬 " + T("วิดีโอสอน", "Video Lessons", "视频课程"), profile: "PROFILE", admin: "ADMIN" };

  const load = useCallback(() => {
    setStats(null);
    const since = range === "all" ? null : new Date(Date.now() - Number(range) * 86400000).toISOString();
    sb.rpc("get_usage_stats", { p_kind: null, p_since: since })
      .then(({ data, error }) => setStats(error ? [] : (data || [])), () => setStats([]));
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const byKind = (k) => (stats || []).filter(r => r.kind === k);
  const Panel = ({ title, rows, labelFor }) => {
    const max = rows.length ? Math.max(...rows.map(r => Number(r.hits))) : 1;
    return (
      <div className="adminpay-cfg">
        <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>{title}</div>
        {!rows.length ? <div className="admstu-empty">{T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}</div> : rows.map((r, i) => (
          <div key={r.item_id} className="anrow">
            <span className="anrow-rank">#{i + 1}</span>
            <span className="anrow-name">{labelFor ? labelFor(r.item_id) : r.item_id}</span>
            <span className="anrow-barwrap"><span className="anrow-bar" style={{ width: `${Math.max(6, (Number(r.hits) / max) * 100)}%` }} /></span>
            <span className="anrow-hits">{r.hits}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="adminpay">
      <div className="billtoggle">
        {[["1", T("1 วัน", "1d", "1天")], ["7", T("7 วัน", "7d", "7天")], ["30", T("30 วัน", "30d", "30天")], ["all", T("ทั้งหมด", "All time", "全部")]].map(([v, l]) => (
          <button key={v} className={`billtog${range === v ? " on" : ""}`} onClick={() => setRange(v)}>{l}</button>
        ))}
      </div>
      {stats === null ? <div className="admstu-msg">⏳</div> : (
        <>
          <Panel title={T("⬡ หัวข้อเส้นทางการเรียนรู้ (Pathway)", "⬡ Pathway topics", "⬡ 学习路径主题")} rows={byKind("pathway")}
            labelFor={(id) => { const st = PATHWAY.find(s => s.id === id); return st ? tr(st.title, lang) : id; }} />
          <Panel title={T("☰ ปุ่มนำทาง (Nav bar)", "☰ Nav bar buttons", "☰ 导航栏按钮")} rows={byKind("nav")}
            labelFor={(id) => NAV_LABELS[id] || id} />
          <Panel title={T("📄 หน้าที่เข้าชม", "📄 Pages visited", "📄 访问的页面")} rows={byKind("page")}
            labelFor={(id) => NAV_LABELS[id] || id} />
        </>
      )}
    </div>
  );
}

/* ── Admin: Auto Teaching platform-default interval (tier ≥2) ── */
function AdminAutoTeach({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [min, setMin] = useState(null);   // null = loading
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    sb.from("app_settings").select("value").eq("key", "auto_teach").maybeSingle()
      .then(({ data }) => setMin((data && data.value && data.value.default_min) ?? AUTO_TEACH_FALLBACK_MIN), () => setMin(AUTO_TEACH_FALLBACK_MIN));
  }, []);
  useEffect(() => { load(); }, [load]);
  async function save(v) {
    setBusy(true); setSaved(false);
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "auto_teach", p_value: { default_min: v } });
    setBusy(false);
    if (!error) { setMin(v); setSaved(true); setTimeout(() => setSaved(false), 2500); } else { alert(error.message || "error"); }
  }
  if (min === null) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;
  return (
    <div className="admstu">
      <div className="admmg">
        <div className="admmg-h">⏱️ {T("ความถี่ Auto Teaching (ค่าเริ่มต้นทั้งระบบ)", "Auto Teaching frequency (platform default)", "自动教学频率（系统默认）")}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 10 }}>
          {T("ทุกกี่นาทีจะมี pop up จากครู AI แนะนำจุดอ่อนระหว่างที่ผู้เรียน Max อยู่หน้าเส้นทางการเรียนรู้ ผู้เรียนสามารถตั้งค่าของตัวเองทับค่านี้ได้",
            "How often the AI coach pops up with a real-time tip while a Max learner is on the Pathway (home) page. Learners can override this with their own pick.",
            "Max 学员在学习路径页面时，AI 教练多久弹出一次实时建议。学员可以设置自己的偏好覆盖此默认值。")}
        </div>
        <div className="setlangs">
          <button className={`setlangbtn${min === 0 ? " on" : ""}`} disabled={busy} onClick={() => save(0)}>{T("ปิด", "Off", "关闭")}</button>
          {AUTO_TEACH_INTERVALS.map(m => (
            <button key={m} className={`setlangbtn${min === m ? " on" : ""}`} disabled={busy} onClick={() => save(m)}>{m}{T("น.", "m", "分")}</button>
          ))}
        </div>
        {saved && <div className="admstu-row-sub" style={{ color: "#d97757", marginTop: 10 }}>✓ {T("บันทึกแล้ว", "Saved", "已保存")}</div>}
      </div>
    </div>
  );
}

/* ── Admin: broadcast a popup announcement (text + optional image) to every learner's
   home page, on demand — a one-off push, not a recurring schedule like Auto Teaching. ── */
function AdminBroadcast({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [cur, setCur] = useState(undefined); // undefined = loading, null = never sent one, object = current
  const [msg, setMsg] = useState("");
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => {
    sb.from("app_settings").select("value").eq("key", "broadcast").maybeSingle()
      .then(({ data }) => setCur((data && data.value) || null), () => setCur(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!msg.trim()) return;
    setBusy(true); setSaved(false);
    const value = { id: Date.now(), message: msg.trim(), image_url: img.trim() || null, active: true };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "broadcast", p_value: value });
    setBusy(false);
    if (!error) { setCur(value); setMsg(""); setImg(""); setSaved(true); playUi("levelup"); setTimeout(() => setSaved(false), 2500); } else { alert(error.message || "error"); }
  }
  async function takeDown() {
    if (!cur) return;
    setBusy(true);
    const value = { ...cur, active: false };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "broadcast", p_value: value });
    setBusy(false);
    if (!error) setCur(value);
  }

  if (cur === undefined) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;
  return (
    <div className="admstu">
      <div className="admmg">
        <div className="admmg-h">📢 {T("ส่งประกาศเด้งหน้าแรก", "Send a home-page popup", "发送首页弹窗公告")}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 10, whiteSpace: "normal" }}>
          {T("ข้อความนี้จะเด้งเป็น pop-up ที่หน้าเส้นทางการเรียนรู้ของผู้เรียนทุกคน (เห็นภายในไม่ถึงนาที)",
            "This shows as a popup on every learner's Pathway (home) page — live within under a minute.",
            "此消息将以弹窗形式出现在所有学员的学习路径（首页）——不到一分钟内生效。")}
        </div>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} className="admstu-search"
          placeholder={T("พิมพ์ข้อความประกาศ...", "Write the announcement...", "输入公告内容…")}
          style={{ width: "100%", resize: "vertical", boxSizing: "border-box", marginBottom: 8, fontFamily: "'Rajdhani',sans-serif" }} />
        <input value={img} onChange={e => setImg(e.target.value)} className="admstu-search"
          placeholder={T("ลิงก์รูปภาพ (ไม่บังคับ)", "Image URL (optional)", "图片链接（可选）")}
          style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
        {img.trim() && <img src={img.trim()} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 10, display: "block" }} onError={e => { e.target.style.display = "none"; }} />}
        <button className="songbtn go" style={{ width: "100%" }} disabled={busy || !msg.trim()} onClick={send}>
          {busy ? "⏳" : "📢"} {T("ส่งเลย", "Send now", "立即发送")}
        </button>
        {saved && <div className="admstu-row-sub" style={{ color: "#d97757", marginTop: 10, whiteSpace: "normal" }}>✓ {T("ส่งแล้ว — ขึ้นหน้าแรกผู้เรียนทันที", "Sent — now live on every learner's home page", "已发送——已在学员首页生效")}</div>}
      </div>

      {cur && cur.active && (
        <div className="admmg" style={{ marginTop: 12 }}>
          <div className="admmg-h">{T("กำลังแสดงอยู่ตอนนี้", "Currently live", "当前正在展示")}</div>
          <div className="admstu-row-sub" style={{ marginBottom: 8, whiteSpace: "normal" }}>{cur.message}</div>
          {cur.image_url && <img src={cur.image_url} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 8, display: "block" }} />}
          <button className="songbtn ghost" style={{ width: "100%", color: "#ff5252" }} disabled={busy} onClick={takeDown}>
            {T("ยกเลิกประกาศนี้", "Take this down", "撤下此公告")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Admin chat (free-form AI + web search + image/link learning) ── */
function AdminPage({ lang, onExit, adminTier }) {
  const tier = adminTier || 0;
  const lc = L[lang];
  const [msgs, setMsgs] = useState([{
    role: "ai",
    text: lang === "th"
      ? "🔓 เข้าสู่ ADMIN CONSOLE สำเร็จ\n\nโหมดนี้ผมตอบได้ทุกเรื่อง และ:\n🌐 ค้นข้อมูลจากอินเทอร์เน็ตได้ (เปิดสวิตช์ WEB ด้านล่าง)\n🖼️ ส่งรูปภาพให้ผมวิเคราะห์ได้ (ปุ่ม +)\n🔗 วางลิงก์ให้ผมอ่านได้\n\nส่งข้อมูลใหม่มาให้ผมเรียนรู้ได้เลยครับ Tiga"
      : lang === "zh"
      ? "🔓 已进入 ADMIN CONSOLE\n\n此模式我可以回答任何问题，并且：\n🌐 可从互联网搜索信息（开启下方WEB开关）\n🖼️ 可发送图片让我分析（+按钮）\n🔗 可粘贴链接让我阅读\n\n请发送新信息让我学习。"
      : "🔓 ADMIN CONSOLE unlocked\n\nIn this mode I answer anything, plus:\n🌐 Search the internet (toggle WEB below)\n🖼️ Send images to analyze (+ button)\n🔗 Paste links to read\n\nFeed me new info to learn from, Tiga."
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [attachedImg, setAttachedImg] = useState(null); // {dataUrl, mediaType, name}
  const [adminTab, setAdminTab] = useState(tier >= 3 ? "ai" : "students"); // "ai" chat · "students" back-office · "autoteach"
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  function buildHist() {
    return buildAlternatingHistory(msgs, 0); // admin: keep full history
  }

  function pickImage() { fileRef.current?.click(); }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert(lang === "th" ? "รองรับเฉพาะรูปภาพครับ" : lang === "zh" ? "仅支持图片" : "Images only");
      e.target.value = "";
      return;
    }
    // guard against huge uploads: FileReader loads the whole file into memory
    // and base64 inflates it ~33%, so an oversized image can crash the tab.
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(lang === "th" ? `ไฟล์ใหญ่เกินไป (จำกัด ${MAX_MB}MB)`
        : lang === "zh" ? `文件太大（上限 ${MAX_MB}MB）`
        : `File too large (max ${MAX_MB}MB)`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImg({ dataUrl: reader.result, mediaType: file.type, name: file.name });
    };
    reader.onerror = () => {
      alert(lang === "th" ? "อ่านไฟล์ไม่สำเร็จ" : lang === "zh" ? "读取文件失败" : "Failed to read file");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function sendAdmin() {
    const t = input.trim();
    if ((!t && !attachedImg) || loading) return;

    const userText = t || (lang === "th" ? "(ส่งรูปภาพ)" : lang === "zh" ? "(已发送图片)" : "(image sent)");
    const imgForMsg = attachedImg;
    setInput("");
    setAttachedImg(null);
    setMsgs(p => [...p, { role: "user", text: userText, img: imgForMsg?.dataUrl }]);
    setLoading(true);

    const hist = buildHist();

    try {
      // Build the user content — supports image blocks + web search tool
      let userContent;
      if (imgForMsg) {
        userContent = [
          { type: "image", source: { type: "base64", media_type: imgForMsg.mediaType, data: imgForMsg.dataUrl.split(",")[1] } },
          { type: "text", text: t || (lang === "th" ? "ช่วยวิเคราะห์รูปนี้ และเรียนรู้จากมัน" : lang === "zh" ? "请分析这张图片并学习" : "Analyze this image and learn from it.") }
        ];
      } else {
        userContent = t;
      }

      const body = {
        model: API_MODEL,
        max_tokens: 2000,
        system: lc.adminSys,
        messages: [...hist, { role: "user", content: userContent }]
      };
      if (webSearch) {
        body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
      }

      // image + web search require the direct API (window.claude.complete is text-only)
      const needDirect = !!imgForMsg || webSearch;
      let reply;

      if (!needDirect && window.claude && typeof window.claude.complete === "function") {
        reply = await window.claude.complete(buildTextPrompt(lc.adminSys, hist, t));
      } else {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || ("HTTP " + res.status));
        reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      }

      setMsgs(p => [...p, { role: "ai", text: (reply || "").trim() || lc.err }]);
    } catch (e) {
      console.error("Admin chat error:", e); // full detail for devs only
      const msg = "" + (e?.message || "");
      const isNetwork = msg.includes("Failed to fetch") || msg.includes("CSP") || msg.includes("NetworkError");
      const hint = lang === "th"
        ? "\n\n💡 ฟีเจอร์ค้นเน็ต/รูปภาพ ต้องเปิดนอก preview — กด \"Open in new tab\" หรือ host บนเว็บของคุณ"
        : lang === "zh"
        ? "\n\n💡 联网/图片功能需在预览外运行 — 点击\"Open in new tab\"或托管在您的网站"
        : "\n\n💡 Web/image features need to run outside preview — use \"Open in new tab\" or host on your site.";
      // show the actionable hint for known network/CSP cases; otherwise a clean
      // generic message (never leak raw internal error text to the user)
      setMsgs(p => [...p, { role: "ai", text: lc.err + (isNetwork ? hint : "") }]);
    }
    setLoading(false);
  }

  return (
    <div className="adminpage">
      <div className="adminbar">
        <div className="adminbar-l">
          <div className="adminorb"><span>⬢</span></div>
          <div className="adminmeta">
            <div className="admintitle">{lc.adminTitle}</div>
            <div className="adminsub">{lc.adminSub}</div>
          </div>
        </div>
        <button className="adminexit" onClick={onExit}>✕ EXIT</button>
      </div>

      <div className="admintabs">
        {tier >= 3 && <button className={`admintab${adminTab === "ai" ? " on" : ""}`} onClick={() => setAdminTab("ai")}>🤖 {lang === "th" ? "สอน AI" : lang === "zh" ? "训练 AI" : "Teach AI"}</button>}
        <button className={`admintab${adminTab === "students" ? " on" : ""}`} onClick={() => setAdminTab("students")}>👥 {lang === "th" ? "นักเรียน" : lang === "zh" ? "学生" : "Students"}</button>
        {tier >= 3 && <button className={`admintab${adminTab === "payments" ? " on" : ""}`} onClick={() => setAdminTab("payments")}>💳 {lang === "th" ? "ชำระเงิน" : lang === "zh" ? "付款" : "Payments"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "videos" ? " on" : ""}`} onClick={() => setAdminTab("videos")}>🎬 {lang === "th" ? "วิดีโอ" : lang === "zh" ? "视频" : "Videos"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "analytics" ? " on" : ""}`} onClick={() => setAdminTab("analytics")}>📊 {lang === "th" ? "สถิติ" : lang === "zh" ? "统计" : "Analytics"}</button>}
        {tier >= 2 && <button className={`admintab${adminTab === "autoteach" ? " on" : ""}`} onClick={() => setAdminTab("autoteach")}>⏱️ {lang === "th" ? "ตั้งเวลาสอน" : lang === "zh" ? "自动教学" : "Auto Teaching"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "broadcast" ? " on" : ""}`} onClick={() => setAdminTab("broadcast")}>📢 {lang === "th" ? "ประกาศ" : lang === "zh" ? "公告" : "Broadcast"}</button>}
      </div>

      {adminTab === "students" ? <AdminStudents lang={lang} viewerTier={tier} />
        : adminTab === "payments" && tier >= 3 ? <AdminPayments lang={lang} />
        : adminTab === "videos" && tier >= 3 ? <AdminVideos lang={lang} />
        : adminTab === "analytics" && tier >= 3 ? <AdminAnalytics lang={lang} />
        : adminTab === "autoteach" && tier >= 2 ? <AdminAutoTeach lang={lang} />
        : adminTab === "broadcast" && tier >= 3 ? <AdminBroadcast lang={lang} />
        : adminTab === "ai" && tier >= 3 ? (<>

      <div className="mmsgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "u" : "a"}`}>
            <div className={`bbl${m.role === "ai" ? " adminbbl" : ""}`}>
              {m.role === "ai" && <div className="atag adminatag">◈ ADMIN AI</div>}
              {m.img && <img src={m.img} alt="" className="adminimg" />}
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</p>
            </div>
          </div>
        ))}
        {loading && <Typing />}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && !attachedImg && (
        <div className="adminchips">
          {lc.adminChips.map((c, i) => (
            <button key={i} className="adminchip" onClick={() => { setInput(c); }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {attachedImg && (
        <div className="adminpreview">
          <img src={attachedImg.dataUrl} alt="" />
          <span className="adminpreviewname">{attachedImg.name}</span>
          <button className="adminpreviewx" onClick={() => setAttachedImg(null)} aria-label="Remove image">✕</button>
        </div>
      )}

      <div className="admintools">
        <button className={`webtoggle${webSearch ? " on" : ""}`}
          onClick={() => setWebSearch(v => !v)}
          title={lc.webHint} aria-label={lc.webLabel} aria-pressed={webSearch}>
          <span className="webdot" />
          🌐 {lc.webLabel} {webSearch ? "ON" : "OFF"}
        </button>
      </div>

      <div className="miw adminmiw">
        <div className="ir">
          <button className="attachbtn" onClick={pickImage} title={lc.attachHint} aria-label={lc.attachHint}>+</button>
          <textarea className="tin" value={input} placeholder={lc.adminPh} rows={1}
            onChange={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; setInput(e.target.value); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdmin(); } }} />
          <button className="snd" disabled={loading || (!input.trim() && !attachedImg)} onClick={sendAdmin} aria-label="Send">➤</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChosen} />
      </div>

      </>) : <AdminStudents lang={lang} viewerTier={tier} />}
    </div>
  );
}

/* ════ MEMBERSHIP GATE (required login) ════ */
function Splash() {
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="lockicon" style={{ fontSize: 44 }}>🎹</div>
    </div>
  );
}

function BannedScreen({ onSignOut }) {
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="banscreen">
        <div style={{ fontSize: 52 }}>🚫</div>
        <div className="locktitle">บัญชีถูกระงับ · Account suspended</div>
        <div className="locksub">บัญชีนี้ถูกระงับการใช้งาน หากคิดว่าผิดพลาด กรุณาติดต่อผู้ดูแล<br />This account has been suspended. Please contact the studio if you think this is a mistake.</div>
        <button className="lockbtn" onClick={onSignOut}>ออกจากระบบ · Sign out</button>
      </div>
    </div>
  );
}

// Guest visitors get a real, playable keyboard right on the login screen —
// no account needed to hear what the app sounds like. Nothing here is saved;
// signing in is framed as "keep this progress" rather than a locked door.
function LoginScreen() {
  const [guestNote, setGuestNote] = useState(null);
  const hintT = useRef(null);
  const onGuestNote = (n) => {
    setGuestNote(n);
    clearTimeout(hintT.current);
    hintT.current = setTimeout(() => setGuestNote(null), 1400);
  };
  return (
    <div className="tg">
      <div className="scan" />
      <div className="loginhero">
        <div className="lbox flicker" style={{ width: 52, height: 52, fontSize: 17 }}>TG</div>
        <div className="locktitle" style={{ marginTop: 12, color: "#d97757", textShadow: "0 0 10px #d9775766" }}>TIGA AI</div>
        <div className="locksub">ลองแตะเปียโนด้านล่างได้เลย ไม่ต้องเข้าสู่ระบบ<br />Try the piano below — no sign-in needed</div>
      </div>
      <div className="loginpiano">
        <Piano small onNote={onGuestNote} />
        <div className="loginpiano-hint">{guestNote ? `♪ ${guestNote}` : "แตะคีย์เพื่อฟังเสียง · tap a key"}</div>
      </div>
      <div className="memberwrap loginwrap">
        <div className="locksub" style={{ marginBottom: 2 }}>อยากบันทึกความคืบหน้า และเรียนกับ AI ครูสอนเปียโน?<br />Want to save progress & learn with your AI teacher?</div>
        <button className="oauthbtn google" onClick={() => signInWith("google")}>
          <span className="oauthico">G</span> เข้าสู่ระบบด้วย Google
        </button>
        <div className="memberfoot">◈ สมาชิก TiGA STUDIO ◈</div>
      </div>
    </div>
  );
}

function ProfileForm({ session, onSaved, onSignOut }) {
  const meta = (session && session.user && session.user.user_metadata) || {};
  const userEmail = (session && session.user && session.user.email) || meta.email || "";
  const [email, setEmail] = useState(userEmail);
  const [line, setLine] = useState("");
  const [phone, setPhone] = useState("");
  const [ig, setIg] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    if (!email.trim()) { setErr("กรุณากรอกอีเมล"); return; }
    setSaving(true); setErr("");
    const { error } = await sb.from("profiles").update({
      email: email.trim(),
      line_id: line.trim() || null,
      phone: phone.trim() || null,
      instagram: ig.trim() || null,
      onboarded: true,
      updated_at: new Date().toISOString(),
    }).eq("id", session.user.id);
    setSaving(false);
    if (error) { setErr(error.message || "บันทึกไม่สำเร็จ"); return; }
    onSaved();
  }
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="memberwrap">
        <div className="lockicon" style={{ fontSize: 36 }}>👋</div>
        <div className="locktitle">ยินดีต้อนรับ</div>
        <div className="locksub">แค่นี้ก็เริ่มเรียนได้เลย — ส่วนที่เหลือกรอกทีหลังก็ได้<br />{meta.full_name || userEmail}</div>
        <input className="memberinput" type="email" placeholder="อีเมล (Email)" value={email} onChange={e => setEmail(e.target.value)} inputMode="email" />
        <input className="memberinput" placeholder="LINE ID (ไม่บังคับ)" value={line} onChange={e => setLine(e.target.value)} />
        <input className="memberinput" placeholder="เบอร์โทรศัพท์ (ไม่บังคับ)" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
        <input className="memberinput" placeholder="Instagram (ไม่บังคับ)" value={ig} onChange={e => setIg(e.target.value)} />
        <div className="lockerr">{err}</div>
        <button className="lockbtn" disabled={saving} onClick={save}>{saving ? "กำลังบันทึก..." : "เริ่มเรียนเลย ▶"}</button>
        <button className="memberlink" onClick={onSignOut}>ออกจากระบบ</button>
      </div>
    </div>
  );
}

/* ════ MAIN ════ */
export default function App() {
  useInjectCSS();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      _accessToken = (data.session && data.session.access_token) || null;
      setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s || null);
      _accessToken = (s && s.access_token) || null; // kept fresh across silent token refreshes too
      setAuthReady(true);
    });
    return () => { mounted = false; if (sub && sub.subscription) sub.subscription.unsubscribe(); };
  }, []);

  const loadProfile = useCallback((uid) => {
    setProfileReady(false);
    sb.from("profiles").select("*").eq("id", uid).maybeSingle().then(({ data }) => {
      setProfile(data || null);
      setProfileReady(true);
      // Supabase is the authoritative subscription now — sync it to localStorage so
      // the freemium gates can't be unlocked by editing localStorage. Admins always
      // get full access; a paid plan counts only while plan_until is in the future.
      // (PianoApp reads this on mount and re-syncs from the profile prop.)
      if (data) {
        const active = effectivePlan(data);
        try { setPlanLS(active); } catch (e) {}
      }
    });
  }, []);

  useEffect(() => {
    if (session && session.user && session.user.id) loadProfile(session.user.id);
    else { setProfile(null); setProfileReady(false); }
  }, [session, loadProfile]);

  async function signOut() {
    try { await sb.auth.signOut(); } catch (e) {}
    setSession(null); setProfile(null);
  }

  if (!authReady) return <Splash />;
  if (!session) return <LoginScreen />;
  if (!profileReady) return <Splash />;
  if (profile && profile.banned && !profile.is_admin) return <BannedScreen onSignOut={signOut} />;
  if (!profile || !profile.onboarded) {
    return <ProfileForm session={session} onSignOut={signOut} onSaved={() => loadProfile(session.user.id)} />;
  }
  return <PianoApp session={session} profile={profile} setProfile={setProfile} onSignOut={signOut} />;
}

// animated count-up number for juicy result screens
function CountUp({ value, dur = 900, className }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, start; const to = value || 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));   // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return <span className={className}>{v.toLocaleString()}</span>;
}

function PianoApp({ session, profile, setProfile, onSignOut }) {
  const cssReady = useInjectCSS();

  const [lang, setLang] = useState("en");   // English is the default language on entry
  const lc = L[lang];

  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [litNote, setLitNote] = useState(null);
  const [litSet, setLitSet] = useState(null);   // multiple simultaneously-lit keys, for block-chord demos
  const [fingerMap, setFingerMap] = useState({});
  const [fingerChart, setFingerChart] = useState(null); // {label, notes:[{note,finger}], mode} — persistent chart
  // How chord demos are voiced: one note at a time (broken/arpeggiated) or all
  // together (block). Toggling replays the current chord immediately in the
  // new style — comparing both is the whole point (triad/7th/tension/slash/
  // block/pad chord topics all go through the same "chord" demo mode).
  const [chordStyle, setChordStyle] = useState("broken"); // "broken" | "block"
  const [seqIsChord, setSeqIsChord] = useState(false);
  const [hand, setHand] = useState("right");   // "right" | "left"
  const [activeSpk, setActiveSpk] = useState(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // ── settings / tools ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sfxVol, setSfxVolState] = useState(getSfxVol());
  const [sfxMuted, setSfxMutedState] = useState(getSfxMuted());
  const [metroOn, setMetroOn] = useState(false);
  const [metroBpm, setMetroBpm] = useState(90);
  const [ambientOn, setAmbientOn] = useState(false);
  const [pianoOct, setPianoOct] = useState(4);   // base octave for the on-screen keyboard
  // coins · daily chest · mascot companion
  const [coins, setCoins] = useState(getCoins());
  const [chestAvail, setChestAvail] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [chestOpening, setChestOpening] = useState(false);
  const [chestReward, setChestReward] = useState(null);
  const [mascotMood, setMascotMood] = useState("idle");
  const mascotT = useRef(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [premium, setPremium] = useState(isPremium());
  const [plan, setPlan] = useState(getPlan());   // free | premium | family | max — switchable any time
  // keep the live plan/premium in sync with the authoritative server profile
  useEffect(() => {
    const active = effectivePlan(profile);
    setPlan(active); setPremium(active !== "free");
    try { setPlanLS(active); } catch (e) {}
  }, [profile]);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [checkout, setCheckout] = useState(null);   // {plan, amount} → PromptPay payment modal
  const [shareGate, setShareGate] = useState(false);  // free-tier share-to-continue gate
  const [billCycle, setBillCycle] = useState("month"); // pricing view: month | year
  const [payCfg, setPayCfg] = useState(null);       // { promptpay, name, bank } from app_settings
  // load the shop's PromptPay config (for the checkout QR)
  useEffect(() => {
    if (!session) return;
    sb.from("app_settings").select("value").eq("key", "payment").maybeSingle()
      .then(({ data }) => setPayCfg((data && data.value) || null), () => {});
  }, [session]);
  // ── Auto Teaching (Max-only real-time coaching popup, fires on a timer while on the Pathway page) ──
  const [autoTeachDefaultMin, setAutoTeachDefaultMin] = useState(null); // admin platform default, from app_settings
  useEffect(() => {
    if (!session) return;
    sb.from("app_settings").select("value").eq("key", "auto_teach").maybeSingle()
      .then(({ data }) => setAutoTeachDefaultMin((data && data.value && data.value.default_min) ?? AUTO_TEACH_FALLBACK_MIN), () => {});
  }, [session]);
  const [autoTeachTip, setAutoTeachTip] = useState(null);   // {weakness, tip} currently shown, or null
  const autoTeachBusyRef = useRef(false);
  const autoTeachTimer = useRef(null);
  // ── Admin broadcast: an announcement (text + optional image) an admin can push to
  // every learner's home page on demand — checked on load and polled while the app is
  // open, so it appears without needing a reload; shown once per broadcast id per device. ──
  const [broadcast, setBroadcast] = useState(null); // {id, message, image_url, active} currently shown, or null
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const check = () => {
      sb.from("app_settings").select("value").eq("key", "broadcast").maybeSingle()
        .then(({ data }) => {
          if (!alive) return;
          const v = data && data.value;
          if (v && v.active && String(v.id) !== readBroadcastSeen()) setBroadcast(v);
        }, () => {});
    };
    check();
    const t = setInterval(check, 45000);
    return () => { alive = false; clearInterval(t); };
  }, [session]);
  function dismissBroadcast() {
    if (broadcast) markBroadcastSeen(broadcast.id);
    setBroadcast(null);
  }
  const [upsell, setUpsell] = useState(null);   // {feat} when a gated action is blocked
  const [parentOpen, setParentOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [examProgress, setExamProgress] = useState(() => { try { return JSON.parse(localStorage.getItem("tg_exam") || "{}"); } catch (e) { return {}; } });
  const [homework, setHomework] = useState(readHomework());
  const [welcomeOpen, setWelcomeOpen] = useState(() => { try { return !localStorage.getItem("tg_welcomed"); } catch (e) { return false; } });
  const [owned, setOwned] = useState(getOwned());
  const [skin, setSkin] = useState(getEquip("skin", "aqua"));
  const [theme, setTheme] = useState(getEquip("theme", "midnight"));
  const [frame, setFrame] = useState(getEquip("frame", "fr-none"));
  const [mode, setMode] = useState(getEquip("mode", "light"));   // "dark" | "light" — whole-app color scheme; light is the preset for first-time visitors, a saved preference always wins
  const [recording, setRecording] = useState(false);
  const [hasClip, setHasClip] = useState(false);
  const [playingClip, setPlayingClip] = useState(false);

  // ── gamification: floating EXP toast + level-up celebration ──
  const [expToast, setExpToast] = useState(null); // {amount, id} or null
  const [levelUp, setLevelUp] = useState(null);   // {level, tier} or null
  const [badgeUp, setBadgeUp] = useState(null);   // BADGES entry or null

  // ── practice mode (listen to the learner play) ──
  const [hasSeq, setHasSeq] = useState(false);          // is there a sequence to practice?
  const [seqPlaying, setSeqPlaying] = useState(false);  // is the demo actively lighting up/sounding right now?
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceTarget, setPracticeTarget] = useState([]); // note names to play, in order
  const [practiceFingers, setPracticeFingers] = useState([]);
  const [practiceLabel, setPracticeLabel] = useState("");
  const [practiceIdx, setPracticeIdx] = useState(0);    // how many notes done = current pointer
  const [practiceMiss, setPracticeMiss] = useState(0);
  const [practiceHeard, setPracticeHeard] = useState(null); // {note, ok} last detected
  const [practiceSrc, setPracticeSrc] = useState(null);     // {type:"midi"|"mic"|"error"}
  const [practiceTune, setPracticeTune] = useState(null);   // learned tuning offset (cents) to show

  // ── play-along (falling-notes song mode) ──
  const [songOpen, setSongOpen] = useState(false);
  const [songMeta, setSongMeta] = useState(null);          // the SONGS entry being played
  const [songPhase, setSongPhase] = useState("ready");     // ready | playing | done
  const [songTempo, setSongTempo] = useState(1);
  const [songHud, setSongHud] = useState({ score: 0, combo: 0, acc: 100, progress: 0 });
  const [songResult, setSongResult] = useState(null);
  const [songAnalysis, setSongAnalysis] = useState(null);   // {weakness, steps} — per-song mistake breakdown, this page only
  const [songAnalysisBusy, setSongAnalysisBusy] = useState(false);
  const [songJudge, setSongJudge] = useState(null);   // {kind, id} transient Perfect/Good/Miss
  const [songNextLit, setSongNextLit] = useState(null); // next note to light on the in-game piano
  const [songBest, setSongBest] = useState(0);
  const [songBursts, setSongBursts] = useState([]);   // particle bursts
  const [songShake, setSongShake] = useState(false);  // screen shake on milestones
  const [songGo, setSongGo] = useState(false);        // "GO!" flash at start
  const songJudgeTimerRef = useRef(null);
  const songShakeT = useRef(null);
  const songGoT = useRef(null);
  const songPerfectsRef = useRef(0);
  const songDebounceRef = useRef({});                 // per-pitch-class onset debounce — one press = one note
  const songEchoRef = useRef({});                     // per-pitch-class time the app last made a sound (mic echo guard)
  const [songGhost, setSongGhost] = useState(null);   // {diff} vs your best run
  const songSamplesRef = useRef([]);
  const songGhostDataRef = useRef(null);
  const [songBonus, setSongBonus] = useState(null);   // surprise reward popup {id, text}
  const songBonusT = useRef(null);
  const [songFever, setSongFever] = useState(false);
  const songFeverRef = useRef(false);
  const [songPops, setSongPops] = useState([]);       // flying "+N" score numbers
  const [songAnnounce, setSongAnnounce] = useState(null); // big combo-tier shout
  const songAnnounceT = useRef(null);
  const [songSrc, setSongSrc] = useState(null);            // {type:"midi"|"mic"|"error"}
  const [songCountdown, setSongCountdown] = useState(null);

  // ── studio sub-nav + sight-reading + hand coach ──
  const [studioView, setStudioView] = useState("menu");    // menu | songs
  const [sightOpen, setSightOpen] = useState(false);
  const [sightTarget, setSightTarget] = useState(null);
  const [sightClef, setSightClef] = useState("treble");      // treble | bass | both — which clef(s) to drill
  const [sightNoteClef, setSightNoteClef] = useState("treble"); // clef of the CURRENT note (matters in "both")
  const [sightIdx, setSightIdx] = useState(0);
  const [sightScore, setSightScore] = useState(0);
  const [sightFeedback, setSightFeedback] = useState(null); // {ok} | null
  const [sightHint, setSightHint] = useState(false);
  const [sightDone, setSightDone] = useState(null);          // result obj | null
  const [sightSrc, setSightSrc] = useState(null);
  const [camOpen, setCamOpen] = useState(false);
  const [camStatus, setCamStatus] = useState("idle");        // idle|loading|running|error
  const [camMsg, setCamMsg] = useState("");
  const [camCoach, setCamCoach] = useState(null);            // {loading} | {text} AI hand-posture feedback
  const [camTry, setCamTry] = useState(0);                    // bump to retry

  // ── AI voice tutor ──
  const [vmOpen, setVmOpen] = useState(false);
  const [vmState, setVmState] = useState("idle");            // idle|listening|thinking|speaking|error
  const [vmCaption, setVmCaption] = useState("");
  const [vmMsgs, setVmMsgs] = useState([]);
  const [vmNotes, setVmNotes] = useState([]);
  const [vmErr, setVmErr] = useState(null);

  // ── routing + secret admin unlock ──
  const [page, setPage] = useState("pathway");  // home = pathway; sensei (chat) is secondary | pathway | profile | admin
  useEffect(() => { logUsage("page", page); }, [page]); // usage analytics: which page ends up viewed, however it was reached

  // ── Auto Teaching: while a Max-plan learner is on the Pathway (home) page, fire a short
  // real-time coaching card every N minutes (learner's own pick, else the admin's platform default). ──
  const autoTeachTipRef = useRef(null);
  useEffect(() => { autoTeachTipRef.current = autoTeachTip; }, [autoTeachTip]);
  // Read fresh inside the timer callback instead of gating the effect below on `page` —
  // `page` changes on every navigation, and putting it in that effect's deps was clearing
  // + restarting the countdown from zero every time the learner left the Pathway page, so
  // in practice it needed 15+ *uninterrupted* minutes there to ever fire even once.
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);
  async function fetchAutoTeachTip() {
    if (pageRef.current !== "pathway") return; // only surface the card while actually on Pathway
    if (autoTeachTipRef.current || autoTeachBusyRef.current) return; // don't clobber an unread tip
    autoTeachBusyRef.current = true;
    try {
      const obj = await generateCoachTip(lang, profile);
      if (obj) {
        setAutoTeachTip(obj);
        logAutoTeachTip(obj.weakness, obj.steps.join(" / "), obj.feature);
      }
    } catch (e) { /* a missed real-time tip silently skips — not worth an error popup mid-practice */ }
    autoTeachBusyRef.current = false;
  }
  // resolves to a primitive (not the whole profile object), so unrelated profile writes
  // (EXP gain, streak bump, etc. all replace the profile object on every practice round)
  // don't restart this effect and keep resetting the countdown before it ever fires
  const autoTeachMin = resolveAutoTeachMin(profile, autoTeachDefaultMin);
  useEffect(() => {
    clearInterval(autoTeachTimer.current);
    if (!isMaxPlan(plan) || !(autoTeachMin > 0)) return;
    autoTeachTimer.current = setInterval(fetchAutoTeachTip, autoTeachMin * 60 * 1000);
    return () => clearInterval(autoTeachTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, autoTeachMin, lang]);

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef(null);

  // secret: tap the TG logo 5 times quickly to reveal the lock screen
  function handleLogoTap() {
    // Any admin tier can reveal the lock screen — everyone else tapping the logo does
    // nothing. This plus the code is the ONLY way into /admin; no nav-bar entry point,
    // so a regular learner never even sees that an admin console exists.
    if (!(profile && profile.admin_tier > 0)) return;
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      setShowLock(true);
      setPage("admin");
    }
  }

  // secret code — change this to your own
  const ADMIN_CODE = "tiga2026";
  function tryUnlock(code) {
    if (code === ADMIN_CODE) {
      setAdminUnlocked(true);
      setShowLock(false);
      return true;
    }
    return false;
  }
  function exitAdmin() {
    setAdminUnlocked(false);
    setShowLock(false);
    setActiveStageId(null);
    setPage("sensei");
  }

  const endRef = useRef(null);
  const mendRef = useRef(null);
  const seqTimers = useRef([]);
  const lastSeq = useRef(null);   // remembers last played sequence for the replay button
  const topicHint = useRef(null); // "scale" | "chord" — what the current lesson is about
  const lessonKey = useRef(null); // the key id picked in the lesson (e.g. "F", "Bb") — forces correct key
  // Which Pathway topic is currently being studied on the Sensei page, so a
  // "back" button can jump straight to that topic's key picker re-opened —
  // instead of the ☰ menu → Pathway → find-the-card-again round trip.
  const [activeStageId, setActiveStageId] = useState(null);

  // ── gamification refs: mirror EXP/lessons so rapid awards never read stale state ──
  const uid = session && session.user && session.user.id;
  const expRef = useRef((profile && profile.exp) || 0);
  const lessonsRef = useRef((profile && profile.lessons_done) || 0);
  const streakRef = useRef((profile && profile.streak) || 0);
  const questDateRef = useRef((profile && profile.quest_date) || null);
  const questCountRef = useRef((profile && profile.quest_count) || 0);
  const expToastTimer = useRef(null);
  const lvUpTimer = useRef(null);
  const badgeTimer = useRef(null);
  useEffect(() => { expRef.current = (profile && profile.exp) || 0; }, [profile]);
  useEffect(() => { lessonsRef.current = (profile && profile.lessons_done) || 0; }, [profile]);
  useEffect(() => { streakRef.current = (profile && profile.streak) || 0; }, [profile]);
  useEffect(() => {
    questDateRef.current = (profile && profile.quest_date) || null;
    questCountRef.current = (profile && profile.quest_count) || 0;
  }, [profile]);

  // Periodically snapshot the learner's progress to Supabase so a teacher/admin
  // can review each student's learning from the back office (also on app hide).
  useEffect(() => {
    if (!uid) return;
    const t = setTimeout(() => syncProgress(uid), 4000);
    const iv = setInterval(() => syncProgress(uid), 90000);
    const onHide = () => { if (document.visibilityState === "hidden") syncProgress(uid); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => syncProgress(uid));
    return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener("visibilitychange", onHide); };
  }, [uid]);

  // celebrate the first newly-unlocked achievement between two stat snapshots
  function celebrateNewBadges(before, after) {
    const had = unlockedBadgeIds(before);
    const got = unlockedBadgeIds(after).find(id => !had.includes(id));
    if (got) {
      setBadgeUp(BADGES.find(b => b.id === got));
      playUi("badge");
      clearTimeout(badgeTimer.current);
      badgeTimer.current = setTimeout(() => setBadgeUp(null), 3600);
    }
  }

  // ── practice-mode refs: progress lives in refs so the audio/MIDI callbacks
  // (created once when practice starts) never read stale React state ──
  const practiceActiveRef = useRef(false);
  const practiceTargetRef = useRef([]);
  const practiceKeyRef = useRef(null);   // scale/chord key so practice can recompute fingering per hand
  const practiceModeRef = useRef("seq");
  const practiceAscRef = useRef([]);     // ascending-only notes (pre up+down expansion) — lets a hand switch mid-scale recompute correctly
  const practiceIdxRef = useRef(0);
  const practiceHitsRef = useRef(0);
  const practiceMissRef = useRef(0);
  const practiceLabelRef = useRef("");
  const practiceHandlerRef = useRef(() => {});
  const practiceHeardTimer = useRef(null);
  const tuneOffsetRef = useRef(0); // learned piano tuning offset (cents), mic only

  // play-along runtime refs (driven by rAF; kept off React state for 60fps)
  const songCanvasRef = useRef(null);
  const songDataRef = useRef(null);
  const songNotesRef = useRef([]);
  const songLanesRef = useRef([]);
  const songTotalRef = useRef(0);
  const songLastTimeRef = useRef(0);
  const songStartClockRef = useRef(0);
  const songTempoRef = useRef(1);
  const songRunRef = useRef(false);
  const songRafRef = useRef(0);
  const songHudTimerRef = useRef(null);
  const songScoreRef = useRef(0);
  const songComboRef = useRef(0);
  const songMaxComboRef = useRef(0);
  const songHitsRef = useRef(0);
  const songMissRef = useRef(0);
  const songLaneFlashRef = useRef({});
  const songStarsRef = useRef([]);     // parallax starfield, generated once per song
  const songRocketsRef = useRef([]);   // in-flight "rocket launch" anims (a hit → rocket climbs to the meteor)
  const songBlastsRef = useRef([]);    // impact explosions (particle bursts, purely time-derived — no per-frame physics state)
  const songNebulaRef = useRef(null);  // pre-rendered deep-space nebula backdrop (rebuilt only on resize — cheap to draw each frame)
  const songCountdownRef = useRef(null);
  const songFinishedRef = useRef(false);
  const songPreviewRef = useRef([]);
  const songLoopRef = useRef(() => {});
  const songInputRef = useRef(() => {});
  const songFinishRef = useRef(() => {});

  // sight-reading + camera runtime refs
  const sightTargetRef = useRef(null);
  const sightClefRef = useRef("treble");   // selected clef mode (treble|bass|both)
  const sightNoteClefRef = useRef("treble"); // clef of the note currently shown
  const sightActiveRef = useRef(false);
  const sightHandlerRef = useRef(() => {});
  const sightScoreRef = useRef(0);
  const sightMissRef = useRef(0);
  const sightIdxRef = useRef(0);
  const sightFbTimer = useRef(null);
  const camVideoRef = useRef(null);
  const camCanvasRef = useRef(null);
  const camStreamRef = useRef(null);
  const camRafRef = useRef(0);
  const camRunRef = useRef(false);
  const camMsgRef = useRef("");
  // voice tutor runtime
  const vmActiveRef = useRef(false);
  const vmStateRef = useRef("idle");
  const vmRecRef = useRef(null);
  const vmMsgsRef = useRef([]);
  const vmNotesRef = useRef([]);
  const vmFrozenRef = useRef(false);
  const vmPlayReactT = useRef(null);   // fires after the learner plays then pauses → AI reacts like a listening teacher
  const vmSilenceT = useRef(null);     // finalize speech after a short pause (continuous STT)
  const vmRestartT = useRef(null);     // quick re-arm of the recognizer so the ear stays open
  const vmWatchdogT = useRef(null);    // backstop: recover a silently-dead recognizer
  const vmListenSeqRef = useRef(0);    // invalidates stale recognizer callbacks across restarts
  const vmEndRef = useRef(null);
  const vmLastActivityRef = useRef(0); // last time we heard speech OR a played note, while listening
  const vmIdleNudgedRef = useRef(false); // has this silent stretch already gotten its one gentle check-in?
  const vmIdleTimerRef = useRef(null); // recurring watcher (a real teacher eventually breaks a long silence)
  const vmSelfSpeakingRef = useRef(false); // true while the idle-nudge plays over speakers WHILE the recognizer is still live — so the mic can't mishear its own voice as the learner talking
  const vmEarResetRef = useRef(() => {});  // clears the live ear's partial-speech buffers (used when a typed message supersedes whatever was half-heard)
  const vmEarFlushRef = useRef(() => {});  // surfaces buffered speech once back in "listening" (short mid-reply answers, words spoken over a filler)
  const vmDeafCountRef = useRef(0);        // consecutive watchdog restarts with zero audio → free the note-mic (it may be starving STT)
  const vmTallyOkRef = useRef(0);          // whole-session ✓ count → real lesson stats for the teacher
  const vmTallyMissRef = useRef(0);        // whole-session ✗ count
  const [vmFast, setVmFast] = useState(false);  // default = natural HQ cloud voice (falls back to device on weak signal)
  const vmFastRef = useRef(false);
  const [vmSpeed, setVmSpeed] = useState(1);    // demo playback speed: 1 / 1.25 / 1.5 / 1.75 / 2
  const vmSpeedRef = useRef(1);
  const [vmVoice, setVmVoice] = useState(getVmVoiceKey());  // voice character (warm/deep/friendly/bright)
  const [vmPoly, setVmPoly] = useState(() => { try { return localStorage.getItem("tg_vmpoly") === "1"; } catch (e) { return false; } }); // beta: hear chords from mic
  const vmPolyRef = useRef(false);
  const [vmLangOpen, setVmLangOpen] = useState(false);  // top-right language switcher inside voice mode
  const [vmMenuOpen, setVmMenuOpen] = useState(false);  // ⋯ settings popover (speed/voice/HQ/chord-ear), bottom-right
  const langRef = useRef(lang);                          // lets an in-flight (stale-closure) recognizer still read the CURRENT language
  const vmLastDemoRef = useRef(null);           // last [play]/[chord] demo → instant "again" replay
  const vmStreakRef = useRef(0);                // consecutive correct notes this session → adaptive pacing
  const vmMissRef = useRef(0);                  // consecutive misses → ease off
  const vmFillersRef = useRef([]);              // pre-decoded "mm-hmm / okay" active-listening clips (same warm voice)
  const vmFillerSrcRef = useRef(null);          // currently-playing filler (stopped the instant real speech starts)
  const vmCloudDeadRef = useRef(false);  // cloud TTS failed this session → stick to the local voice (smooth on weak signal)
  const [vmLit, setVmLit] = useState([]);       // keys the AI highlights on the voice-mode piano
  const vmLitT = useRef(null);
  const [vmStaff, setVmStaff] = useState(null); // notes the teacher shows on the staff ([staff:])
  const [vmInstant, setVmInstant] = useState(null); // {ok,id} instant ✓/✗ flash on the learner's note
  const vmInstantT = useRef(null);
  const vmExpectRef = useRef(null);             // Set of expected pitch classes (for instant feedback)
  const vmSeqRef = useRef(null);                // ORDERED expected pitch classes → pinpoint the first wrong note
  const vmEarRef = useRef(null);                // active ear-training target {label, notes, pcs}
  const vmInterruptRef = useRef(false);         // set when the learner barges in (tap/play) to stop the AI
  const vmTurnRef = useRef(0);                   // turn token — a newer turn supersedes a barged-in one
  const vmSpokenRef = useRef("");               // rolling tail of what the teacher just SAID aloud → self-echo filter
  const vmSpokeAtRef = useRef(0);               // when the teacher's audio last started/ended (echo freshness window)
  const vmSessionStartRef = useRef(0);          // lesson clock — a human teacher paces the session & wraps up on time
  const vmActStartRef = useRef(0);              // activity-log segment start (survives pause/resume without double counting)
  const vmFillerLastRef = useRef(-1);           // never play the exact same "mm-hmm" clip twice in a row
  const [vmInput, setVmInput] = useState("");   // typed message (STT fallback / by choice)

  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    stopCloudTTS();
    setActiveSpk(null);
    setMsgs([{ role: "ai", text: lc.welcome }]);
    setInput("");
  }, [lang]);

  useEffect(() => {
    // throttle scrolling to one rAF tick — avoids layout thrash while streaming
    const id = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      mendRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [msgs, loading]);

  // close flag menu on outside click
  useEffect(() => {
    if (!flagOpen) return;
    const close = () => setFlagOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [flagOpen]);

  // recompute the fingering chart instantly when the hand is switched
  useEffect(() => {
    setFingerChart(prev => {
      if (!prev) return prev;
      let fingers = null;
      if (prev.key) fingers = getFingers(prev.key, prev.mode, hand);
      else if (prev.mode === "chord" || (prev.mode === "seq" && prev.notes.length === 3)) {
        fingers = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
      }
      if (!fingers) return prev;
      const pairs = prev.notes.map((p, i) => ({ note: p.note, finger: fingers[i] != null ? fingers[i] : null }));
      return { ...prev, notes: pairs };
    });
  }, [hand]);

  // Practice Mode: recompute the on-key finger numbers when the hand is switched.
  // Recomputes from the ASCENDING-only notes (fingering data is keyed to that
  // length), then re-expands up+down for scales — matching startPractice().
  useEffect(() => {
    if (!practiceOpen) return;
    const ascNotes = practiceAscRef.current.length ? practiceAscRef.current : practiceTargetRef.current;
    let pf = fingersForNotes(practiceKeyRef.current, practiceModeRef.current, ascNotes, hand);
    if (pf && practiceModeRef.current === "scale" && practiceTargetRef.current.length > ascNotes.length) {
      pf = pf.concat(pf.slice(0, -1).reverse());
    }
    if (pf) setPracticeFingers(pf);
  }, [hand, practiceOpen]);

  // on unmount: cancel any pending playback timers and stop TTS so we never
  // call setState after the component is gone (avoids leaks + React warnings)
  useEffect(() => {
    return () => {
      seqTimers.current.forEach(t => clearTimeout(t));
      seqTimers.current = [];
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (expToastTimer.current) clearTimeout(expToastTimer.current);
      if (lvUpTimer.current) clearTimeout(lvUpTimer.current);
      if (badgeTimer.current) clearTimeout(badgeTimer.current);
      if (practiceHeardTimer.current) clearTimeout(practiceHeardTimer.current);
      cancelAnimationFrame(songRafRef.current);
      clearInterval(songHudTimerRef.current);
      songPreviewRef.current.forEach(id => clearTimeout(id));
      clearTimeout(sightFbTimer.current);
      clipTimersRef.current.forEach(clearTimeout);
      stopPracticeListeners();
      if (vmRecRef.current) { try { vmRecRef.current.abort(); } catch (e) {} }
      stopCloudTTS(); stopSpeaking();
      stopPracticeListeners();
      stopCloudTTS();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // show a floating "+N EXP" toast that auto-dismisses
  function showExpToast(amount) {
    setExpToast({ amount, id: Date.now() });
    clearTimeout(expToastTimer.current);
    expToastTimer.current = setTimeout(() => setExpToast(null), 2200);
  }

  // award EXP for an action, persist to Supabase, and celebrate level-ups.
  // opts.lesson=true also increments the lessons-completed counter.
  function gainExp(amount, opts = {}) {
    if (!amount || !uid) return;
    mascot("happy", 1400);
    bumpWeekly("exp", amount);
    const beforeExp = expRef.current;
    const beforeLessons = lessonsRef.current;

    // daily-quest progress (counts learning activities; resets each calendar day)
    let questFields = null, bonus = 0;
    if (opts.quest) {
      const today = ymd(new Date());
      const cnt = (questDateRef.current === today ? questCountRef.current : 0) + 1;
      questDateRef.current = today;
      questCountRef.current = cnt;
      questFields = { quest_date: today, quest_count: cnt };
      if (cnt === QUEST_GOAL) bonus = QUEST_BONUS; // quest just completed → bonus
    }

    const after = beforeExp + amount + bonus;
    const newLessons = beforeLessons + (opts.lesson ? 1 : 0);
    expRef.current = after;
    lessonsRef.current = newLessons;
    logExpGain(amount + bonus);   // daily EXP for the progress dashboard

    if (setProfile) setProfile(p => ({ ...(p || {}), exp: after, lessons_done: newLessons, ...(questFields || {}) }));
    showExpToast(amount + bonus);

    // level-up celebration
    let leveled = false;
    if (levelInfo(after).level > levelInfo(beforeExp).level) {
      leveled = true;
      setLevelUp({ level: levelInfo(after).level, tier: levelInfo(after).tier });
      playUi("levelup"); mascot("celebrate", 3200);
      clearTimeout(lvUpTimer.current);
      lvUpTimer.current = setTimeout(() => setLevelUp(null), 3400);
    }
    // achievement unlock (skip the toast if a level-up already shows this tick)
    if (!leveled) {
      celebrateNewBadges(
        { exp: beforeExp, lessons_done: beforeLessons, streak: streakRef.current },
        { exp: after, lessons_done: newLessons, streak: streakRef.current }
      );
    }

    // persist (fire-and-forget; UI already updated optimistically)
    const upd = { exp: after, lessons_done: newLessons, updated_at: new Date().toISOString() };
    if (questFields) Object.assign(upd, questFields);
    sb.from("profiles").update(upd).eq("id", uid).then(() => {}, () => {});
  }

  // daily streak + welcome-back bonus — runs once per calendar day on app open
  useEffect(() => {
    if (!uid) return;
    const today = ymd(new Date());
    if (profile && profile.last_active === today) return; // already counted today
    const beforeExp = expRef.current;
    const beforeStreak = streakRef.current;
    const yesterday = ymd(new Date(Date.now() - 86400000));
    const newStreak = profile && profile.last_active === yesterday ? (beforeStreak || 0) + 1 : 1;
    const after = beforeExp + EXP.daily;
    expRef.current = after;
    streakRef.current = newStreak;
    if (setProfile) setProfile(p => ({ ...(p || {}), exp: after, streak: newStreak, last_active: today }));
    sb.from("profiles")
      .update({ exp: after, streak: newStreak, last_active: today, updated_at: new Date().toISOString() })
      .eq("id", uid)
      .then(() => {}, () => {});
    const t = setTimeout(() => {
      showExpToast(EXP.daily); // brief welcome-back reward
      celebrateNewBadges(
        { exp: beforeExp, lessons_done: lessonsRef.current, streak: beforeStreak },
        { exp: after, lessons_done: lessonsRef.current, streak: newStreak }
      );
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearSeq() {
    seqTimers.current.forEach(t => clearTimeout(t));
    seqTimers.current = [];
    setLitNote(null);
    setLitSet(null);
    setFingerMap({});
    setSeqPlaying(false);
  }

  /* Play a sequence: ascending then descending, with finger numbers */
  function playSequence(parsed, styleOverride) {
    clearSeq();
    lastSeq.current = parsed;   // remember for replay
    setHasSeq(true);            // enable the Practice button
    setSeqPlaying(true);
    const { notes, mode } = parsed;
    setSeqIsChord(mode === "chord");

    // recompute fingering for the currently selected hand
    let fingers = parsed.fingers;
    if (parsed.key) {
      // key-based scale/chord: recompute exactly for that key + hand
      fingers = getFingers(parsed.key, mode, hand);
    } else if (!fingers) {
      // no explicit fingers provided — fall back to a sensible default
      if (mode === "chord" && notes.length === 3) fingers = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
      else if (mode === "seq" && notes.length === 3) fingers = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
    }
    // else: use the explicit fingers passed in (e.g. transposed lesson demo)

    // build a persistent fingering chart (ascending notes + finger numbers)
    if (fingers) {
      const pairs = notes.map((n, i) => ({ note: n, finger: fingers[i] != null ? fingers[i] : null }));
      setFingerChart({ label: parsed.label, notes: pairs, mode, key: parsed.key || null });
    } else {
      setFingerChart(null);
    }

    // Chords can be voiced two ways: broken (one note at a time, like the
    // scale/sequence path below) or block (every note struck together, so
    // the full triad/7th/tension/slash/pad-chord shape is heard and seen at
    // once). Triads, sevenths, tension, block/slash/pad-chord topics all
    // share this same "chord" demo mode, so the toggle covers all of them.
    if (mode === "chord" && (styleOverride || chordStyle) === "block") {
      const dur = 2.6;
      notes.forEach(n => playPianoNote(n, dur));
      setLitSet(notes);
      const fmap = {};
      if (fingers) notes.forEach((n, i) => { if (fingers[i] != null) fmap[n] = fingers[i]; });
      setFingerMap(fmap);
      const tEnd = setTimeout(() => { setLitSet(null); setFingerMap({}); setSeqPlaying(false); }, dur * 1000 + 200);
      seqTimers.current.push(tEnd);
      return;
    }

    let order, fingerOrder;
    if (mode === "chord") {
      order = notes;
      fingerOrder = fingers ? fingers.slice() : notes.map(() => null);
    } else {
      // scales/sequences: ascending then descending (skip duplicate top note)
      const up = notes.slice();
      const down = notes.slice(0, -1).reverse();
      order = up.concat(down);
      const fUp = fingers ? fingers.slice() : notes.map(() => null);
      const fDown = fingers ? fingers.slice(0, -1).reverse() : notes.slice(0, -1).map(() => null);
      fingerOrder = fUp.concat(fDown);
    }

    const interval = mode === "chord" ? 398 : 1094;  // 50% slower per request (was 199/547)
    const dur = mode === "chord" ? 2.5 : 1.54;       // note length scaled to match

    order.forEach((n, i) => {
      const t = setTimeout(() => {
        playPianoNote(n, dur);
        setLitNote(n);
        const fg = fingerOrder[i];
        setFingerMap(fg != null ? { [n]: fg } : {});
      }, i * interval);
      seqTimers.current.push(t);
    });
    const tEnd = setTimeout(() => { setLitNote(null); setFingerMap({}); setSeqPlaying(false); }, order.length * interval + 400);
    seqTimers.current.push(tEnd);
  }
  function togglePlayPause() {
    playUi("click");
    if (seqPlaying) clearSeq();       // stop right away — no need to wait it out
    else if (lastSeq.current) playSequence(lastSeq.current); // "once more" = restart the same demo from the top
  }
  function toggleChordStyle() {
    playUi("click");
    const next = chordStyle === "block" ? "broken" : "block";
    setChordStyle(next);
    if (lastSeq.current && lastSeq.current.mode === "chord") playSequence(lastSeq.current, next);
  }

  // replay the last taught sequence (for the replay button on the piano)
  function replayLast() {
    if (lastSeq.current) playSequence(lastSeq.current);
  }

  // ── record & play back your own playing (on-screen keyboard) ──
  const recordingRef = useRef(false);
  const recStartRef = useRef(0);
  const recEventsRef = useRef([]);
  const clipRef = useRef([]);
  const clipTimersRef = useRef([]);
  const handleMainKey = useCallback((n) => {
    if (recordingRef.current) recEventsRef.current.push({ note: n, t: Date.now() - recStartRef.current });
  }, []);
  function stopClip() {
    clipTimersRef.current.forEach(clearTimeout);
    clipTimersRef.current = [];
    setPlayingClip(false);
    setLitNote(null);
  }
  function toggleRecord() {
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      clipRef.current = recEventsRef.current.slice();
      setHasClip(clipRef.current.length > 0);
    } else {
      stopClip();
      getAC();
      recEventsRef.current = [];
      recStartRef.current = Date.now();
      recordingRef.current = true;
      setRecording(true);
      setHasClip(false);
    }
  }
  function playClip() {
    const clip = clipRef.current;
    if (!clip.length || recordingRef.current) return;
    stopClip();
    getAC();
    setPlayingClip(true);
    clip.forEach(ev => {
      const t = setTimeout(() => { playPianoNote(ev.note, 0.7); setLitNote(ev.note); }, ev.t);
      clipTimersRef.current.push(t);
    });
    const endT = setTimeout(() => { setPlayingClip(false); setLitNote(null); }, clip[clip.length - 1].t + 800);
    clipTimersRef.current.push(endT);
  }
  // send the recorded performance to the AI teacher for a critique
  function critiqueRecording() {
    const clip = clipRef.current;
    if (!clip.length || recordingRef.current || loading) return;
    if (!canUse("critique")) { setPricingOpen(true); return; }
    if (!premium) bumpUsage("critique");
    stopClip();
    setPage("sensei");
    const secs = ((clip[clip.length - 1].t) / 1000).toFixed(1);
    const noteList = clip.map(e => e.note).join(" ");
    const q = `${lc.recCritiqueUser}\n\n(${clip.length} ${lc.songNotes} · ${secs}s: ${noteList})`;
    topicHint.current = LESSON_MODE; lessonKey.current = null;
    setMsgs(prev => [...prev, { role: "user", text: q }]);
    playPianoNote("C5", 0.1);
    callClaude(q);
  }

  /* ── PRACTICE MODE ──
     Compare each note the learner plays (mic/MIDI/tap) against the target
     sequence, advancing on a correct pitch class (Wait-Mode style). */
  function handlePlayedNote(d) {
    if (!practiceActiveRef.current) return;
    // accept legacy string calls too, just in case
    if (typeof d === "string") d = { note: d, freq: null };
    const targets = practiceTargetRef.current;
    const idx = practiceIdxRef.current;
    if (idx >= targets.length) return;
    const targetPC = pcOf(targets[idx]);
    const heardNote = d.note;

    let correct;
    if (d.freq == null) {
      // MIDI or on-screen tap → digital/exact, match the pitch class strictly
      correct = pcOf(heardNote) === targetPC;
    } else {
      // microphone → tolerant, tuning-aware. Measure how many cents the played
      // pitch is from the target note, re-centered by the piano's learned offset,
      // so a slightly out-of-tune string still counts as correct.
      const raw = centsFromPC(d.freq, targetPC);
      const eff = raw - tuneOffsetRef.current;
      correct = Math.abs(eff) <= PITCH_TOL_CENTS;
      if (correct) {
        // learn this piano's tuning drift (smoothed EMA, clamped) so it gets
        // more accurate the more the learner plays
        let off = tuneOffsetRef.current * 0.7 + raw * 0.3;
        off = Math.max(-TUNE_OFFSET_CAP, Math.min(TUNE_OFFSET_CAP, off));
        tuneOffsetRef.current = off;
        setPracticeTune(Math.round(off));
      }
    }

    if (correct) {
      practiceHitsRef.current += 1;
      playPianoNote(targets[idx], 0.5);
      setPracticeHeard({ note: heardNote, ok: true });
      const next = idx + 1;
      practiceIdxRef.current = next;
      setPracticeIdx(next);
      if (next >= targets.length) finishPractice();
    } else {
      practiceMissRef.current += 1;
      setPracticeMiss(practiceMissRef.current);
      setPracticeHeard({ note: heardNote, ok: false });
    }
    clearTimeout(practiceHeardTimer.current);
    practiceHeardTimer.current = setTimeout(() => setPracticeHeard(null), 650);
  }
  practiceHandlerRef.current = handlePlayedNote; // keep fresh closure for the listeners

  async function startPractice() {
    const seq = lastSeq.current;
    if (!seq || !seq.notes || !seq.notes.length) return;
    // finger numbers for the currently selected hand (falls back to the played fingers)
    const pf = fingersForNotes(seq.key, seq.mode, seq.notes, hand);
    let notes = seq.notes.slice();
    let fingers = pf || (seq.fingers ? seq.fingers.slice() : []);
    practiceAscRef.current = notes;
    // a full scale is drilled ascending THEN descending — same as the audio demo
    // and the app's own fingering rule ("descending = the same fingers in
    // reverse"), and correct for whichever hand is selected since `fingers` was
    // already recomputed for `hand` above. Chords / custom AI drills stay as-is.
    if (seq.mode === "scale" && notes.length > 1) {
      notes = notes.concat(notes.slice(0, -1).reverse());
      if (fingers.length) fingers = fingers.concat(fingers.slice(0, -1).reverse());
    }
    practiceTargetRef.current = notes;
    practiceKeyRef.current = seq.key || null;
    practiceModeRef.current = seq.mode || "seq";
    practiceIdxRef.current = 0;
    practiceHitsRef.current = 0;
    practiceMissRef.current = 0;
    practiceLabelRef.current = seq.label || "";
    practiceActiveRef.current = true;
    setPracticeTarget(notes);
    setPracticeFingers(fingers);
    setPracticeLabel(seq.label || "");
    setPracticeIdx(0);
    setPracticeMiss(0);
    setPracticeHeard(null);
    setPracticeSrc(null);
    setPracticeTune(null);
    tuneOffsetRef.current = 0; // re-learn tuning for whatever piano is used now
    setPracticeOpen(true);
    getAC(); // unlock/resume audio inside the click gesture
    stopPracticeListeners(); // release any mic/MIDI another mode left open — never stack listeners
    const onDetect = (d) => practiceHandlerRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setPracticeSrc({ type: "midi" }));
    if (!midiOk) {
      await startMicListener(onDetect, () => setPracticeSrc({ type: "mic" }), () => setPracticeSrc({ type: "error" }));
    }
  }

  function restartPractice() {
    practiceIdxRef.current = 0;
    practiceHitsRef.current = 0;
    practiceMissRef.current = 0;
    practiceActiveRef.current = true;
    setPracticeIdx(0);
    setPracticeMiss(0);
    setPracticeHeard(null);
  }

  function exitPractice() {
    practiceActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(practiceHeardTimer.current);
    setPracticeOpen(false);
    setPracticeHeard(null);
  }

  function finishPractice() {
    const total = practiceTargetRef.current.length;
    const hits = practiceHitsRef.current;
    const miss = practiceMissRef.current;
    const accuracy = hits + miss > 0 ? Math.round((hits / (hits + miss)) * 100) : 100;
    const label = practiceLabelRef.current;
    practiceActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(practiceHeardTimer.current);
    setPracticeOpen(false);

    const summary = lang === "th"
      ? `🎯 ฝึกเล่น "${label}" — เล่นครบ ${total} โน้ต ความแม่นยำ ${accuracy}% (พลาด ${miss} ครั้ง)`
      : lang === "zh"
      ? `🎯 练习"${label}" — 完成 ${total} 个音，准确率 ${accuracy}%（失误 ${miss} 次）`
      : `🎯 Practiced "${label}" — ${total} notes, ${accuracy}% accuracy (${miss} misses)`;
    setPage("sensei");
    setMsgs(prev => [...prev, { role: "user", text: summary }]);

    logPractice(accuracy);
    logActivity("drill", label || "drill", hits, miss, Math.max(20, total * 2));
    recordMemory(practiceLabelRef.current, accuracy);
    earnCoins(5 + Math.round(accuracy / 20));
    gainExp(20 + Math.round(accuracy / 5), { quest: true }); // 20–40 EXP scaled by accuracy

    const fb = lang === "th"
      ? `ผู้เรียนเพิ่งฝึกเล่น "${label}" บนเปียโน เล่นถูกครบ ${total} โน้ต ความแม่นยำ ${accuracy}% (เล่นผิดระหว่างทาง ${miss} ครั้ง) ในฐานะครูเปียโน TiGA ช่วยชมและให้กำลังใจสั้นๆ อบอุ่น แล้วแนะนำ 1-2 จุดที่ควรฝึกต่อให้ดีขึ้น ตอบกระชับเป็นภาษาไทย ไม่ต้องระบุชื่อโน้ต`
      : lang === "zh"
      ? `学员刚在钢琴上练习了"${label}"，完成全部 ${total} 个音，准确率 ${accuracy}%（中途失误 ${miss} 次）。作为 TiGA 钢琴老师，请简短温暖地表扬鼓励，并给出 1-2 个可继续提升的小建议。简洁中文回答，不要列音名`
      : `The learner just practiced "${label}" on piano, completing all ${total} notes at ${accuracy}% accuracy (${miss} wrong notes along the way). As TiGA the piano teacher, give a short, warm word of praise and encouragement, then 1-2 tips to improve next. Be concise; no note names needed.`;
    topicHint.current = LESSON_MODE; // don't auto-play notes from the feedback text
    lessonKey.current = null;
    callClaude(fb);
  }

  // ════ PLAY-ALONG (falling-notes) controls ════
  function clearSongPreview() {
    songPreviewRef.current.forEach(id => clearTimeout(id));
    songPreviewRef.current = [];
  }
  function chooseSong(meta) {
    clearSongPreview();
    songDataRef.current = expandSong(meta);
    setSongMeta(meta);
    setSongResult(null);
    setSongAnalysis(null);
    setSongPhase("ready");
    setSongSrc(null);
    setSongCountdown(null);
    setSongOpen(true);
    getAC(); // unlock audio within the tap gesture
  }
  function previewSong() {
    const data = songDataRef.current;
    if (!data) return;
    getAC();
    clearSongPreview();
    const tempo = songTempo || 1;
    for (const n of data.notes) {
      const id = setTimeout(() => playPianoNote(n.note, Math.min(0.6, n.durSec)), (n.t / tempo) * 1000);
      songPreviewRef.current.push(id);
    }
  }
  const songKey = () => "tg_best_" + (songMeta ? (songMeta.id || songMeta.en || tr(songMeta, "en") || "x") : "x");
  function loadBest() { try { return +(localStorage.getItem(songKey()) || 0); } catch (e) { return 0; } }
  async function startSongPlay() {
    const data = songDataRef.current;
    if (!data) return;
    if (!gateContent()) return;   // free limit reached → share to continue
    bumpContentPlays();
    setSongBest(loadBest());
    songSamplesRef.current = [];
    try { songGhostDataRef.current = JSON.parse(localStorage.getItem("tg_ghost_" + (songMeta ? (songMeta.id || songMeta.en) : "x")) || "null"); } catch (e) { songGhostDataRef.current = null; }
    setSongGhost(null);
    clearSongPreview();
    for (const n of data.notes) { n.hit = false; n.missed = false; }
    songNotesRef.current = data.notes;
    songLanesRef.current = data.lanes;
    songTotalRef.current = data.total;
    songLastTimeRef.current = data.lastT;
    songScoreRef.current = 0; songComboRef.current = 0; songMaxComboRef.current = 0;
    songHitsRef.current = 0; songMissRef.current = 0; songPerfectsRef.current = 0;
    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
    songLaneFlashRef.current = {}; songCountdownRef.current = null; songFinishedRef.current = false;
    songRocketsRef.current = []; songBlastsRef.current = [];
    if (!songStarsRef.current.length) songStarsRef.current = Array.from({ length: 50 }, () => ({ fx: Math.random(), fy: Math.random(), r: 0.4 + Math.random() * 1.3, tw: Math.random() * Math.PI * 2 }));
    songDebounceRef.current = {}; songEchoRef.current = {};
    songTempoRef.current = songTempo || 1;
    setSongHud({ score: 0, combo: 0, acc: 100, progress: 0 });
    setSongResult(null);
    setSongAnalysis(null);
    setSongCountdown(null);
    setSongSrc(null);
    setSongPhase("playing");
    getAC();
    songStartClockRef.current = getAC().currentTime;
    songRunRef.current = true;
    stopPracticeListeners(); // release any mic/MIDI another mode left open — never stack listeners
    const onDetect = (d) => songInputRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setSongSrc({ type: "midi" }));
    if (!midiOk) await startMicListener(onDetect, () => setSongSrc({ type: "mic" }), () => setSongSrc({ type: "error" }));
    cancelAnimationFrame(songRafRef.current);
    songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
    clearInterval(songHudTimerRef.current);
    songHudTimerRef.current = setInterval(() => {
      const total = songTotalRef.current || 1;
      const done = songHitsRef.current + songMissRef.current;
      setSongHud({
        score: songScoreRef.current,
        combo: songComboRef.current,
        acc: done > 0 ? Math.round(songHitsRef.current / done * 100) : 100,
        progress: Math.round(done / total * 100),
      });
      // guide: light the next upcoming note on the in-game piano
      let nx = null, nxt = 1e9;
      for (const n of songNotesRef.current) { if (n.hit || n.missed) continue; if (n.t < nxt) { nxt = n.t; nx = n; } }
      setSongNextLit(nx ? nx.note : null);
      // ghost race vs your best run
      const st = (getAC().currentTime - songStartClockRef.current) * songTempoRef.current;
      songSamplesRef.current.push({ t: +st.toFixed(2), s: songScoreRef.current });
      const g = songGhostDataRef.current;
      if (g && g.length) {
        let gs = 0; for (let i = 0; i < g.length; i++) { if (g[i].t <= st) gs = g[i].s; else break; }
        setSongGhost({ diff: songScoreRef.current - gs });
      }
    }, 120);
  }
  function exitSong() {
    songRunRef.current = false;
    cancelAnimationFrame(songRafRef.current);
    clearInterval(songHudTimerRef.current);
    clearSongPreview();
    stopPracticeListeners();
    setSongOpen(false);
    setSongPhase("ready");
    setSongResult(null);
    setSongCountdown(null);
    setSongNextLit(null);
    setSongJudge(null);
    setSongBursts([]); setSongShake(false); setSongGo(false); setSongGhost(null); setSongBonus(null);
    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
  }
  function songLoop() {
    if (!songRunRef.current) return;
    const cv = songCanvasRef.current;
    if (!cv) { songRafRef.current = requestAnimationFrame(() => songLoopRef.current()); return; }
    const ac = getAC();
    const songTime = (ac.currentTime - songStartClockRef.current) * songTempoRef.current;
    const notes = songNotesRef.current;
    const lanes = songLanesRef.current;
    const nLane = Math.max(1, lanes.length);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const now = performance.now();
    const tSec = now / 1000;
    const fever = songFeverRef.current;
    // deep-space nebula backdrop — pre-rendered offscreen once per size, drawn each frame
    let neb = songNebulaRef.current;
    if (!neb || neb.w !== W || neb.h !== H) {
      const nc = document.createElement("canvas"); nc.width = Math.max(1, W); nc.height = Math.max(1, H);
      const nx = nc.getContext("2d");
      nx.fillStyle = "#050414"; nx.fillRect(0, 0, W, H);
      const blobs = [[0.22, 0.24, 0.55, "rgba(148,60,100,0.17)"], [0.82, 0.14, 0.45, "rgba(6,150,214,0.14)"], [0.55, 0.72, 0.6, "rgba(255,82,82,0.08)"], [0.1, 0.85, 0.4, "rgba(217,119,87,0.06)"]];
      for (const [fx, fy, fr, col] of blobs) {
        const g0 = nx.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, fr * Math.max(W, H));
        g0.addColorStop(0, col); g0.addColorStop(1, "rgba(0,0,0,0)");
        nx.fillStyle = g0; nx.fillRect(0, 0, W, H);
      }
      neb = songNebulaRef.current = { cv: nc, w: W, h: H };
    }
    ctx.drawImage(neb.cv, 0, 0);
    if (fever) { ctx.fillStyle = "rgba(255,82,82,0.06)"; ctx.fillRect(0, 0, W, H); } // fever = the whole sky heats up
    // twinkling parallax starfield — bigger stars drift faster (depth), fever = warp speed
    const drift = fever ? 0.06 : 0.012;
    for (const s of songStarsRef.current) {
      const tw = 0.5 + 0.5 * Math.sin(tSec * 1.4 + s.tw);
      ctx.globalAlpha = 0.2 + 0.55 * tw;
      ctx.fillStyle = "#ffbcd9";
      ctx.beginPath(); ctx.arc(s.fx * W, ((s.fy + tSec * drift * s.r) % 1) * H, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // a lone shooting star streaks by every ~7s (deterministic from time — no per-frame state)
    const winId = Math.floor(tSec / 7), winT = (tSec % 7) / 0.9;
    if (winT < 1) {
      const rnd = Math.abs(Math.sin(winId * 127.1) * 43758.5453) % 1;
      const sx = (0.15 + rnd * 0.7 + winT * 0.25) * W, sy = (0.05 + (rnd * 7 % 1) * 0.3 + winT * 0.22) * H;
      ctx.globalAlpha = Math.sin(winT * Math.PI) * 0.8;
      ctx.strokeStyle = "#faf0f5"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 26, sy - 18); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    const hitY = H - 8;
    const pxPerSec = hitY / SONG_LEAD;
    // a faint glowing Earth horizon along the hit-line — what the meteors are falling toward
    const earthGrad = ctx.createLinearGradient(0, hitY - 30, 0, hitY + 20);
    earthGrad.addColorStop(0, "rgba(6,150,214,0)"); earthGrad.addColorStop(1, "rgba(6,150,214,0.28)");
    ctx.fillStyle = earthGrad; ctx.fillRect(0, hitY - 30, W, 38);
    // Each lane's x-position is the actual key it maps to, so a falling note lands
    // directly above the piano key (and the lit key) the learner must press.
    const laneFrac = lanes.map(ln => noteKeyFrac(ln) || { cx: 0.5, w: 1 / 14 });
    for (let i = 0; i < nLane; i++) {
      const f = laneFrac[i], hue = laneHue(lanes[i]);
      const cw = f.w * W, cx = f.cx * W - cw / 2;
      ctx.fillStyle = `hsla(${hue},70%,50%,0.07)`;
      ctx.fillRect(cx, 0, cw, H);
    }
    ctx.strokeStyle = "rgba(217,119,87,0.55)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke(); ctx.lineWidth = 1;
    for (const n of notes) {
      const hitAt = n.t + SONG_LEAD;
      if (!n.hit && !n.missed && songTime > hitAt + SONG_MISSWINDOW) {
        n.missed = true; songComboRef.current = 0; songMissRef.current++;
        if (songFeverRef.current) { songFeverRef.current = false; setSongFever(false); }
        songLaneFlashRef.current[n.lane] = { ok: false, until: now + 220 };
        playMiss(); flashJudge("miss");
      }
      if (n.hit) continue;
      const yFrac = (songTime - n.t) / SONG_LEAD;
      if (yFrac < -0.05 || yFrac > 1.4) continue;
      const y = yFrac * hitY;
      const h = Math.max(14, n.durSec * pxPerSec);
      const f = laneFrac[n.lane] || noteKeyFrac(n.note) || { cx: 0.5, w: 1 / 14 };
      const w = Math.max(10, f.w * W - 4), top = y - h, hue = laneHue(n.note);
      const mcx = f.cx * W;
      const rr = Math.max(7, Math.min(w / 2 - 1, 18)); // meteor head radius
      const hy = y - rr;                               // head rides the leading (falling) edge
      const spin = tSec * 1.6 + n.t * 2.3;             // slow tumble, phase unique per note
      if (!n.missed) {
        // fiery tail — its length IS the note's duration, drawn additively so it truly glows
        ctx.globalCompositeOperation = "lighter";
        const flick = 0.85 + 0.15 * Math.sin(now / 55 + n.t * 9);
        const tailTop = top - 6;
        const tg = ctx.createLinearGradient(mcx, hy, mcx, tailTop);
        tg.addColorStop(0, `hsla(${hue},100%,62%,${0.5 * flick})`);
        tg.addColorStop(0.5, `hsla(${(hue + 30) % 360},100%,55%,0.22)`);
        tg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(mcx - rr * 0.85, hy);
        ctx.quadraticCurveTo(mcx - rr * 0.3, (hy + tailTop) / 2, mcx, tailTop);
        ctx.quadraticCurveTo(mcx + rr * 0.3, (hy + tailTop) / 2, mcx + rr * 0.85, hy);
        ctx.closePath(); ctx.fill();
        // heat halo hugging the head
        const halo = ctx.createRadialGradient(mcx, hy, rr * 0.4, mcx, hy, rr * 2.1);
        halo.addColorStop(0, `hsla(${hue},100%,64%,${0.5 * flick})`);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(mcx, hy, rr * 2.1, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      // the rock itself — an off-center highlight fakes a lit 3D sphere
      const body = ctx.createRadialGradient(mcx - rr * 0.4, hy - rr * 0.4, rr * 0.15, mcx, hy, rr);
      if (n.missed) { body.addColorStop(0, "rgba(150,156,168,0.5)"); body.addColorStop(0.7, "rgba(84,88,100,0.45)"); body.addColorStop(1, "rgba(52,56,66,0.4)"); }
      else { body.addColorStop(0, `hsla(${hue},55%,72%,1)`); body.addColorStop(0.55, `hsla(${hue},50%,38%,1)`); body.addColorStop(1, `hsla(${hue},60%,16%,1)`); }
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(mcx, hy, rr, 0, Math.PI * 2); ctx.fill();
      // tumbling craters sell the rotation
      ctx.fillStyle = n.missed ? "rgba(40,44,54,0.5)" : `hsla(${hue},45%,14%,0.75)`;
      for (let k = 0; k < 3; k++) {
        const a = spin + k * 2.1;
        const cxk = mcx + Math.cos(a) * rr * 0.5, cyk = hy + Math.sin(a) * rr * 0.42;
        const crr = rr * (0.14 + k * 0.045);
        ctx.beginPath(); ctx.ellipse(cxk, cyk, crr, crr * 0.75, a, 0, Math.PI * 2); ctx.fill();
      }
      if (!n.missed) {
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = "bold 11px Rajdhani, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(pcOf(n.note), mcx, hy + 4);
      }
    }
    // ── rockets: a hit launches one from the hit-line, climbing to blow the meteor up ──
    const liveRockets = [];
    for (const r of songRocketsRef.current) {
      const t = (now - r.t0) / r.dur;
      const rx = (laneFrac[r.lane] || { cx: 0.5 }).cx * W, rTop = hitY - 95;
      if (t >= 1) {
        songBlastsRef.current.push({
          x: rx, y: rTop, t0: now, dur: 520, hue: r.hue, big: r.big,
          parts: Array.from({ length: 16 }, (_, k) => ({ a: (k / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, sp: 55 + Math.random() * (r.big ? 120 : 85), sz: 2 + Math.random() * 3 })),
        });
        playBoom(r.big); // 💥 the payoff
        continue;
      }
      liveRockets.push(r);
      const ry = hitY + (rTop - hitY) * t;
      // exhaust flame — additive + flickering
      ctx.globalCompositeOperation = "lighter";
      const fl = 0.7 + 0.3 * Math.sin(now / 28 + r.t0);
      const fg = ctx.createRadialGradient(rx, ry + 13, 0, rx, ry + 13, 14 * fl);
      fg.addColorStop(0, "rgba(255,235,170,0.95)"); fg.addColorStop(0.4, "rgba(255,150,40,0.7)"); fg.addColorStop(1, "rgba(255,60,10,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.ellipse(rx, ry + 14, 5, 13 * fl, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // brushed-metal body + hue-tinted nose cone, fins and a glowing porthole
      const met = ctx.createLinearGradient(rx - 5, 0, rx + 5, 0);
      met.addColorStop(0, "#a67e95"); met.addColorStop(0.5, "#fbf2f7"); met.addColorStop(1, "#bb8fa7");
      ctx.fillStyle = met;
      roundRect(ctx, rx - 4.5, ry - 6, 9, 15, 3); ctx.fill();
      ctx.fillStyle = `hsl(${r.hue},85%,60%)`;
      ctx.beginPath(); ctx.moveTo(rx, ry - 15); ctx.lineTo(rx - 4.5, ry - 5); ctx.lineTo(rx + 4.5, ry - 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx - 4.5, ry + 4); ctx.lineTo(rx - 9, ry + 10); ctx.lineTo(rx - 4.5, ry + 9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx + 4.5, ry + 4); ctx.lineTo(rx + 9, ry + 10); ctx.lineTo(rx + 4.5, ry + 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff94e0";
      ctx.beginPath(); ctx.arc(rx, ry - 1, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    songRocketsRef.current = liveRockets;
    // ── blasts: white-hot core + expanding shockwave + gravity-pulled embers ──
    const liveBlasts = [];
    for (const b of songBlastsRef.current) {
      const t = (now - b.t0) / b.dur;
      if (t >= 1) continue;
      liveBlasts.push(b);
      const fade = 1 - t;
      ctx.globalCompositeOperation = "lighter";
      const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 26 * (0.5 + t));
      core.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      core.addColorStop(0.4, `hsla(${b.hue},100%,70%,${0.6 * fade})`);
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(b.x, b.y, 26 * (0.5 + t), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.75 * fade;
      ctx.strokeStyle = `hsla(${b.hue},100%,80%,1)`;
      ctx.lineWidth = 1 + 2.5 * fade;
      ctx.beginPath(); ctx.arc(b.x, b.y, (b.big ? 95 : 66) * t + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.globalAlpha = 1;
      for (let pi = 0; pi < b.parts.length; pi++) {
        const p = b.parts[pi];
        const dist = p.sp * t;
        const ex = b.x + Math.cos(p.a) * dist, ey = b.y + Math.sin(p.a) * dist + 55 * t * t; // embers arc downward
        ctx.fillStyle = pi % 2 ? `hsla(${b.hue},95%,65%,${fade})` : `hsla(332,100%,62%,${fade})`;
        ctx.beginPath(); ctx.arc(ex, ey, p.sz * fade, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    songBlastsRef.current = liveBlasts;
    for (let i = 0; i < nLane; i++) {
      const fl = songLaneFlashRef.current[i];
      if (fl && fl.until > now) {
        const a = (fl.until - now) / 220;
        const f = laneFrac[i], cw = f.w * W, cx = f.cx * W - cw / 2;
        ctx.fillStyle = fl.ok ? `rgba(217,119,87,${0.5 * a})` : `rgba(255,82,82,${0.42 * a})`;
        ctx.fillRect(cx, hitY - 42, cw, 50);
      }
    }
    if (songTime < SONG_LEAD) {
      const c = Math.ceil(SONG_LEAD - songTime);
      if (c !== songCountdownRef.current) { songCountdownRef.current = c; setSongCountdown(c); }
    } else if (songCountdownRef.current !== 0) { songCountdownRef.current = 0; setSongCountdown(null); flashGo(); }
    if (songTime > songLastTimeRef.current + SONG_LEAD + 1.0) { songFinishRef.current(); return; }
    songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
  }
  function handleSongInput(d) {
    if (!songRunRef.current) return;
    const ac = getAC();
    const songTime = (ac.currentTime - songStartClockRef.current) * songTempoRef.current;
    const inPC = pcOf(d.note);
    const tnow = performance.now();
    const src = d.source;
    // Echo guard: when you TAP, the app plays that note and the mic hears it ~100ms
    // later — ignore a mic onset of the same pitch right after a tap so one tap can't
    // become 2–3 hits. (Pure real-piano play never sets this, so repeats stay fine.)
    if (src === "mic" && tnow - (songEchoRef.current[inPC] || 0) < SONG_ECHO_MS) return;
    // Debounce: one press = one note (a sustained key can re-fire the same pitch).
    if (tnow - (songDebounceRef.current[inPC] || 0) < SONG_DEBOUNCE_MS) return;
    songDebounceRef.current[inPC] = tnow;
    if (src === "tap") songEchoRef.current[inPC] = tnow; // this tap's sound will echo into the mic
    let best = null, bestd = 1e9;
    for (const n of songNotesRef.current) {
      if (n.hit || n.missed || pcOf(n.note) !== inPC) continue;
      const dt = Math.abs(songTime - (n.t + SONG_LEAD));
      if (dt < bestd) { bestd = dt; best = n; }
    }
    const now = performance.now();
    if (best && bestd <= SONG_HITWINDOW) {
      best.hit = true;
      const perfect = bestd <= SONG_PERFECT;
      songRocketsRef.current.push({ lane: best.lane, hue: laneHue(best.note), t0: now, dur: 170, big: perfect }); // launch a rocket to blow up the meteor
      playWhoosh(); // 🚀 lift-off
      songHitsRef.current++;
      songComboRef.current++;
      const combo = songComboRef.current;
      if (combo > songMaxComboRef.current) songMaxComboRef.current = combo;
      if (perfect) songPerfectsRef.current++;
      // FEVER MODE — at a big combo the screen goes wild and score doubles
      if (!songFeverRef.current && combo >= 15) { songFeverRef.current = true; setSongFever(true); playUi("levelup"); triggerShake(); announce("🔥 FEVER!"); }
      const feverMult = songFeverRef.current ? 2 : 1;
      const gained = Math.round((perfect ? 150 : 100) * (1 + Math.min(combo, 10) * 0.1) * feverMult);
      songScoreRef.current += gained;
      pushPop("+" + gained, perfect);     // flying score number
      playComboTone(combo);               // rising musical ladder
      if (perfect) spawnBurst("perfect");
      // combo-tier shout-outs
      if (combo % 10 === 0) { triggerShake(); spawnBurst("combo"); announce(comboWord(combo)); }
      // surprise variable bonus on a lucky perfect
      if (perfect && Math.random() < 0.06) {
        const bonus = 8 + Math.floor(Math.random() * 18);
        earnCoins(bonus); spawnBurst("combo"); playUi("reward");
        setSongBonus({ id: Date.now(), text: "+" + bonus + " 🪙" });
        clearTimeout(songBonusT.current); songBonusT.current = setTimeout(() => setSongBonus(null), 900);
      }
      songLaneFlashRef.current[best.lane] = { ok: true, until: now + 220 };
      flashJudge(perfect ? "perfect" : "good");
      // Voice the hit only for a silent MIDI controller. A tap already sounded via
      // the keyboard, and mic input means the real piano already sounded — replaying
      // it would just echo back into the mic and cause phantom extra hits.
      if (src === "midi") { playPianoNote(best.note, 0.5); songEchoRef.current[pcOf(best.note)] = performance.now(); }
    } else {
      const lane = songLanesRef.current.findIndex(x => pcOf(x) === inPC);
      if (lane >= 0) songLaneFlashRef.current[lane] = { ok: false, until: now + 150 };
    }
  }
  function comboWord(c) { return c >= 50 ? "UNSTOPPABLE!" : c >= 40 ? "INCREDIBLE!" : c >= 30 ? "AMAZING!" : c >= 20 ? "GREAT!" : "NICE!"; }
  function announce(text) {
    setSongAnnounce({ id: Date.now(), text });
    clearTimeout(songAnnounceT.current);
    songAnnounceT.current = setTimeout(() => setSongAnnounce(null), 1100);
  }
  function pushPop(text, perfect) {
    const id = Date.now() + Math.random();
    setSongPops(prev => [...prev.slice(-7), { id, text, perfect, x: 26 + Math.random() * 48 }]);
    setTimeout(() => setSongPops(prev => prev.filter(p => p.id !== id)), 780);
  }
  function flashJudge(kind) {
    setSongJudge({ kind, id: Date.now() });
    clearTimeout(songJudgeTimerRef.current);
    songJudgeTimerRef.current = setTimeout(() => setSongJudge(null), 650);
  }
  function triggerShake() { setSongShake(true); clearTimeout(songShakeT.current); songShakeT.current = setTimeout(() => setSongShake(false), 380); }
  function spawnBurst(kind) {
    const id = Date.now() + Math.random();
    setSongBursts(prev => [...prev.slice(-4), { id, kind }]);
    setTimeout(() => setSongBursts(prev => prev.filter(b => b.id !== id)), 760);
  }
  function flashGo() { setSongGo(true); clearTimeout(songGoT.current); songGoT.current = setTimeout(() => setSongGo(false), 700); }
  function finishSong() {
    if (songFinishedRef.current) return;
    songFinishedRef.current = true;
    songRunRef.current = false;
    cancelAnimationFrame(songRafRef.current);
    clearInterval(songHudTimerRef.current);
    stopPracticeListeners();
    const total = songTotalRef.current || 1;
    const hits = songHitsRef.current;
    const acc = Math.round(hits / total * 100);
    const stars = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 40 ? 1 : 0;
    const maxCombo = songMaxComboRef.current;
    const perfects = songPerfectsRef.current;
    const fullCombo = songMissRef.current === 0 && hits === total && total > 0;
    const allPerfect = perfects === total && total > 0;
    const reward = Math.round(40 + acc * 0.4 + Math.min(maxCombo, 20) + (allPerfect ? 50 : fullCombo ? 25 : 0));
    const prevBest = loadBest();
    const score = songScoreRef.current;
    const newBest = score > prevBest;
    if (newBest) {
      try { localStorage.setItem(songKey(), String(score)); } catch (e) {} setSongBest(score);
      try { localStorage.setItem("tg_ghost_" + (songMeta ? (songMeta.id || songMeta.en) : "x"), JSON.stringify(songSamplesRef.current.slice(-240))); } catch (e) {}
    }
    logPractice(acc);
    recordMemory(tr(songMeta, lang), acc);
    logGame({ song: tr(songMeta, lang), acc, score, stars });
    logActivity("game", (songMeta && songMeta.id) || "song", hits, Math.max(0, total - hits),
      songDataRef.current && songDataRef.current.dur ? songDataRef.current.dur / (songTempoRef.current || 1) + SONG_LEAD : 60);
    const coinReward = 5 + stars * 10 + (allPerfect ? 20 : fullCombo ? 10 : 0);
    earnCoins(coinReward);
    bumpWeekly("games", 1); if (perfects) bumpWeekly("perfect", perfects);
    setSongCountdown(null);
    setSongNextLit(null);
    const missedNotes = songNotesRef.current.filter(n => n.missed).map(n => n.note);
    setSongResult({ acc, score, maxCombo, stars, exp: reward, coins: coinReward, total, hits, best: Math.max(score, prevBest), newBest, fullCombo, allPerfect, missedNotes });
    setSongPhase("done");
    gainExp(reward, { quest: true });
  }
  // Per-song mistake breakdown — separate from Auto Teaching, only ever shown on this
  // song-result screen. Fires once automatically when a song finishes.
  async function fetchSongAnalysis(result, label) {
    setSongAnalysisBusy(true);
    try {
      const missed = (result.missedNotes || []).slice(0, 30);
      const missedTxt = missed.length ? missed.join(", ") : "none — every note was hit";
      const sysByLang = {
        th: `คุณคือ "ครู TiGA" ผู้เรียนเพิ่งเล่นเพลง "${label}" จบ ความแม่นยำ ${result.acc}% (เล่นถูก ${result.hits}/${result.total} โน้ต) โน้ตที่พลาด (เรียงตามลำดับที่เล่น): ${missedTxt}\n\nวิเคราะห์ว่าพลาดตรงไหน/รูปแบบอะไร แล้วให้วิธีฝึกแก้ ตอบเป็น JSON เท่านั้น {"weakness":"...","steps":["...","..."]} — weakness สั้นไม่เกิน 15 คำ บอกจุด/รูปแบบที่พลาด (หรือชมถ้าไม่พลาดเลย) steps มี 2-4 ข้อ วิธีฝึกแก้ทีละขั้น แต่ละข้อไม่เกิน 15 คำ ภาษาไทย ห้ามมีข้อความอื่นนอก JSON`,
        zh: `你是"TiGA老师"，学员刚弹完歌曲"${label}"，准确率 ${result.acc}%（弹对 ${result.hits}/${result.total} 个音）。弹错的音（按演奏顺序）：${missedTxt}\n\n分析弹错的位置/模式，并给出练习建议。只回JSON {"weakness":"...","steps":["...","..."]} — weakness 不超过15字，说明错误的位置/模式（若全对则给予表扬），steps 为2-4个简短练习步骤，每条不超过15字，用中文，JSON外不要任何文字`,
        en: `You are "Teacher TiGA". The learner just finished playing "${label}" at ${result.acc}% accuracy (${result.hits}/${result.total} notes hit). Notes they missed, in play order: ${missedTxt}.\n\nAnalyze where/what pattern they missed, then give a fix. Reply with JSON only: {"weakness":"...","steps":["...","..."]} — weakness under 15 words naming the spot/pattern they missed (or praise if nothing was missed), steps has 2-4 short fix-it practice steps, each under 15 words, in English. No text outside the JSON.`,
      };
      const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify({ message: "Analyze my run of this song.", conversationHistory: [], system: sysByLang[lang] || sysByLang.en }) });
      const data = await res.json();
      const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const m = txt.match(/\{[\s\S]*\}/);
      const obj = m ? JSON.parse(m[0]) : null;
      if (obj && obj.weakness && Array.isArray(obj.steps) && obj.steps.length) setSongAnalysis(obj);
    } catch (e) { /* silent — the score/stars result above already shown, this is a bonus */ }
    setSongAnalysisBusy(false);
  }
  useEffect(() => {
    if (songPhase === "done" && songResult && !songAnalysis && !songAnalysisBusy) {
      fetchSongAnalysis(songResult, tr(songMeta, lang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songPhase, songResult]);
  songLoopRef.current = songLoop;
  songInputRef.current = handleSongInput;
  songFinishRef.current = finishSong;

  // ════ SIGHT-READING controls ════
  function newSightNote() {
    // pick this note's clef: fixed for treble/bass, random each note for "both"
    const mode = sightClefRef.current;
    const clef = mode === "both" ? (Math.random() < 0.5 ? "treble" : "bass") : mode;
    const pool = clef === "bass" ? SIGHT_NOTES_BASS : SIGHT_NOTES;
    const cur = sightTargetRef.current;
    let n = cur;
    while (n === cur) n = pool[Math.floor(Math.random() * pool.length)];
    sightTargetRef.current = n;
    sightNoteClefRef.current = clef;
    setSightTarget(n);
    setSightNoteClef(clef);
    setSightHint(false);
    setSightFeedback(null);
  }
  // switch clef mid-session — restart the round so the score stays fair
  function pickSightClef(mode) {
    if (mode === sightClefRef.current) return;
    sightClefRef.current = mode;
    setSightClef(mode);
    playUi("click");
    if (sightActiveRef.current) {
      sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
      setSightScore(0); setSightIdx(0); setSightDone(null);
      sightTargetRef.current = null;
      newSightNote();
    }
  }
  async function openSight() {
    sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
    sightTargetRef.current = null;
    sightActiveRef.current = true;
    setSightScore(0); setSightIdx(0); setSightDone(null); setSightSrc(null);
    newSightNote();
    setSightOpen(true);
    getAC();
    stopPracticeListeners(); // release any mic/MIDI another mode left open — never stack listeners
    const onDetect = (d) => sightHandlerRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setSightSrc({ type: "midi" }));
    if (!midiOk) await startMicListener(onDetect, () => setSightSrc({ type: "mic" }), () => setSightSrc({ type: "error" }));
  }
  function sightInput(d) {
    if (!sightActiveRef.current || !sightTargetRef.current) return;
    const ok = pcOf(d.note) === pcOf(sightTargetRef.current);
    clearTimeout(sightFbTimer.current);
    if (ok) {
      playPianoNote(sightTargetRef.current, 0.5);
      sightScoreRef.current += 1;
      setSightScore(sightScoreRef.current);
      setSightFeedback({ ok: true });
      const next = sightIdxRef.current + 1;
      sightIdxRef.current = next;
      setSightIdx(next);
      sightFbTimer.current = setTimeout(() => { next >= SIGHT_ROUND ? finishSight() : newSightNote(); }, 520);
    } else {
      sightMissRef.current += 1;
      setSightFeedback({ ok: false });
      setSightHint(true); // reveal the note name after a wrong try
      sightFbTimer.current = setTimeout(() => setSightFeedback(null), 600);
    }
  }
  function finishSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    const correct = sightScoreRef.current, miss = sightMissRef.current;
    const acc = correct + miss > 0 ? Math.round(correct / (correct + miss) * 100) : 100;
    const reward = 25 + Math.round(acc / 4); // 25..50 EXP
    setSightDone({ correct, miss, acc, reward });
    logPractice(acc);
    logActivity("read", "sight-" + sightClefRef.current, correct, miss, 90);
    recordMemory(lang === "th" ? "อ่านโน้ต" : lang === "zh" ? "视奏" : "Sight-reading", acc);
    earnCoins(5 + Math.round(acc / 20));
    gainExp(reward, { quest: true });
  }
  function exitSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    setSightOpen(false);
    setSightDone(null);
  }
  sightHandlerRef.current = sightInput;

  // ════ HAND-POSTURE COACH (camera) ════
  function openCamera() { setCamOpen(true); }
  function exitCamera() { setCamOpen(false); setCamCoach(null); }
  // Where the Coach page's "▶ Practice: …" button sends the learner — maps a fixed,
  // known-safe COACH_FEATURE_LABELS key to a real navigation action.
  function handleCoachNavigate(key) {
    playUi("click"); haptic(6); stopPracticeListeners();
    if (key === "sight_reading") { setPage("studio"); setStudioView("menu"); openSight(); }
    else if (key === "hand_coach") { setPage("studio"); setStudioView("menu"); openCamera(); }
    else if (key === "play_along") { setPage("studio"); setStudioView("songs"); }
    else if (key === "ear_training") { logUsage("nav", "studio-eargym"); setPage("eargym"); }
    else if (key === "reading_course") { logUsage("nav", "studio-reading"); setPage("reading"); }
    else { setPage("pathway"); }
  }
  // snapshot the camera and ask the AI teacher to critique hand posture/technique
  async function analyzeHands() {
    if (!premium) { setPricingOpen(true); return; }
    const v = camVideoRef.current;
    if (!v || !v.videoWidth || (camCoach && camCoach.loading)) return;
    setCamCoach({ loading: true });
    try {
      const cv = document.createElement("canvas");
      const w = 640, scale = w / v.videoWidth;
      cv.width = w; cv.height = Math.round(v.videoHeight * scale);
      cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL("image/jpeg", 0.7);
      const sys = lang === "th"
        ? "คุณคือครูเปียโนผู้เชี่ยวชาญ ดูรูปมือ/ท่านั่งของผู้เรียนที่กำลังเล่นเปียโน แล้วให้คำแนะนำสั้นๆ อบอุ่น 2-4 ข้อ เรื่องท่ามือ การวางนิ้ว ข้อมือ ท่านั่ง ชมสิ่งที่ดีก่อนแล้วบอกจุดที่ควรปรับ ตอบเป็นภาษาไทย ห้ามใช้มาร์กดาวน์"
        : lang === "zh"
        ? "你是专业钢琴老师。看学员弹琴的手型/坐姿照片，给出2-4条简短温暖的建议：手型、指法、手腕、坐姿。先表扬再指出可改进处。用中文回答，不要markdown"
        : "You are an expert piano teacher. Look at this photo of the learner's hands/posture at the piano and give 2-4 short, warm tips on hand shape, finger placement, wrist and posture. Praise first, then what to adjust. Reply in plain text, no markdown.";
      const body = { model: API_MODEL, max_tokens: 500, system: sys, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } },
        { type: "text", text: lang === "th" ? "ดูมือผมแล้วแนะนำหน่อยครับ" : lang === "zh" ? "看看我的手，给点建议" : "Check my hands and give feedback." }
      ] }] };
      const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error("http");
      const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
      setCamCoach({ text: reply || lc.err });
    } catch (e) { setCamCoach({ text: lc.camCoachErr }); }
  }
  function retryCamera() { setCamTry(t => t + 1); }
  useEffect(() => {
    if (!camOpen) return;
    let cancelled = false;
    setCamStatus("loading"); setCamMsg(""); camMsgRef.current = "";
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        camStreamRef.current = stream;
        const v = camVideoRef.current;
        if (!v) throw new Error("no video element");
        v.srcObject = stream;
        await v.play();
        const lm = await loadHandLandmarker();
        if (cancelled) return;
        camRunRef.current = true;
        setCamStatus("running");
        const loop = () => {
          if (!camRunRef.current) return;
          const video = camVideoRef.current, cv = camCanvasRef.current;
          if (video && cv && video.videoWidth) {
            const W = cv.width = video.videoWidth, H = cv.height = video.videoHeight;
            const ctx = cv.getContext("2d");
            ctx.clearRect(0, 0, W, H);
            let res = null;
            try { res = lm.detectForVideo(video, performance.now()); } catch (e) {}
            const hands = (res && res.landmarks) || [];
            let round = 0;
            for (const pts of hands) {
              ctx.strokeStyle = "rgba(217,119,87,0.85)"; ctx.lineWidth = 4;
              for (const [a, b] of HAND_BONES) {
                ctx.beginPath(); ctx.moveTo(pts[a].x * W, pts[a].y * H); ctx.lineTo(pts[b].x * W, pts[b].y * H); ctx.stroke();
              }
              ctx.fillStyle = "#ff5252";
              for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2); ctx.fill(); }
              round += handRoundness(pts);
            }
            const msg = !hands.length ? L[lang].camNoHands
              : (round / hands.length) >= 0.6 ? L[lang].camTipGood : L[lang].camTipFlat;
            if (msg !== camMsgRef.current) { camMsgRef.current = msg; setCamMsg(msg); }
          }
          camRafRef.current = requestAnimationFrame(loop);
        };
        camRafRef.current = requestAnimationFrame(loop);
      } catch (e) { if (!cancelled) setCamStatus("error"); }
    })();
    return () => {
      cancelled = true;
      camRunRef.current = false;
      cancelAnimationFrame(camRafRef.current);
      if (camStreamRef.current) { try { camStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {} camStreamRef.current = null; }
      const v = camVideoRef.current; if (v) v.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen, camTry]);

  // ════ AI VOICE TUTOR (turn-based, hands-free) ════
  // Switching language mid-session (top-right button): keep the ref fresh for any
  // in-flight recognizer, drop the now-wrong-language filler cache, and if the ear
  // is actively listening right now, restart it immediately so it hears the new
  // language on the very next word instead of waiting for the next natural turn.
  useEffect(() => {
    langRef.current = lang;
    if (!vmActiveRef.current) return;
    vmFillersRef.current = [];
    prefetchFillers();
    vmSpawnEar(); // rec.lang is fixed at construction — respawn the persistent ear in the new language (any state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  // close the voice-mode language dropdown on outside click
  useEffect(() => {
    if (!vmLangOpen) return;
    const close = () => setVmLangOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [vmLangOpen]);
  // close the ⋯ settings popover on outside click
  useEffect(() => {
    if (!vmMenuOpen) return;
    const close = () => setVmMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [vmMenuOpen]);
  function vmSetState(s) { vmStateRef.current = s; setVmState(s); }
  // buffer notes the learner plays while we're listening (so the AI can react)
  function vmOnNote(d) {
    // barge-in: tapping a key while the AI talks/thinks interrupts it (then this note
    // is buffered under the now-listening state). Only ON-SCREEN taps interrupt — a
    // mic onset during speech is usually the AI's own voice, not the learner.
    if ((vmStateRef.current === "speaking" || vmStateRef.current === "thinking") && vmActiveRef.current) {
      if (d.source !== "tap") return;
      vmInterrupt();
    }
    if (vmStateRef.current !== "listening" || vmFrozenRef.current) return;
    const now = Date.now();
    vmLastActivityRef.current = now;
    // ── chord (poly beta): several pitch classes detected in one strike ──
    if (d.notes && d.notes.length > 1) {
      const pcs = [...new Set(d.notes.map(pcOf))];
      if (vmExpectRef.current && vmExpectRef.current.size) {
        const ok = pcs.some(p => vmExpectRef.current.has(p));   // any expected tone present → ✓
        setVmInstant({ ok, id: now });
        clearTimeout(vmInstantT.current);
        vmInstantT.current = setTimeout(() => setVmInstant(null), 650);
        if (ok) { vmStreakRef.current++; vmMissRef.current = 0; vmTallyOkRef.current++; }
        else { vmMissRef.current++; vmStreakRef.current = 0; vmTallyMissRef.current++; }
      }
      vmNotesRef.current = vmNotesRef.current.filter(x => now - x.t < 12000);
      for (const p of pcs) vmNotesRef.current.push({ note: p, t: now, vel: d.vel || 0, chord: true });
      if (vmNotesRef.current.length > 16) vmNotesRef.current = vmNotesRef.current.slice(-16);
      setVmNotes(vmNotesRef.current.map(x => x.note));
      clearTimeout(vmPlayReactT.current);
      vmPlayReactT.current = setTimeout(() => vmReactToPlaying(), 1700); // chords resolve fast → react a touch sooner
      return;
    }
    // instant local feedback: ✓ if the played pitch is one the teacher just showed
    if (vmExpectRef.current && vmExpectRef.current.size) {
      const ok = vmExpectRef.current.has(pcOf(d.note));
      setVmInstant({ ok, id: now });
      clearTimeout(vmInstantT.current);
      vmInstantT.current = setTimeout(() => setVmInstant(null), 650);
      // track a correct/missed streak so the teacher can adapt the pace
      if (ok) { vmStreakRef.current++; vmMissRef.current = 0; vmTallyOkRef.current++; }
      else { vmMissRef.current++; vmStreakRef.current = 0; vmTallyMissRef.current++; }
    }
    vmNotesRef.current = vmNotesRef.current.filter(x => now - x.t < 12000);
    vmNotesRef.current.push({ note: pcOf(d.note), t: now, vel: d.vel || 0 });
    if (vmNotesRef.current.length > 16) vmNotesRef.current.shift();
    setVmNotes(vmNotesRef.current.map(x => x.note));
    // a human teacher reacts when you PLAY, not only when you talk — once the
    // learner plays a little then pauses (and isn't speaking), comment on it.
    clearTimeout(vmPlayReactT.current);
    vmPlayReactT.current = setTimeout(() => vmReactToPlaying(), 2000);
  }
  function vmReactToPlaying() {
    if (!vmActiveRef.current || vmStateRef.current !== "listening" || vmFrozenRef.current) return;
    if (vmNotesRef.current.length < 2) return; // ignore a stray single note
    vmProcess(L[lang].vmPlayedCue);            // implicit "I just played — what do you think?"
  }
  function openVoice() {
    setVmOpen(true);
    setVmErr(null);
    vmMsgsRef.current = []; setVmMsgs([]);
    if (!sttSupported()) { setVmErr(L[lang].vmNoSTT); vmSetState("error"); return; }
    startVoiceSession();
  }
  // Pre-fetch short "active listening" clips in the warm voice so the teacher can
  // say "mm-hmm / okay / let's see" the instant you finish — no dead air, no delay.
  const VM_FILLERS = {
    th: ["อืม", "โอเคครับ", "เดี๋ยวนะ", "ดีมาก ฟังนะ", "เข้าใจแล้ว"],
    en: ["Mm-hmm.", "Okay.", "Let's see.", "Nice, listen.", "Got it."],
    zh: ["嗯。", "好的。", "我看看。", "不错。", "明白了。"],
  };
  // said ONCE, gently, if the learner goes quiet for a while — a real teacher
  // doesn't just sit in silence forever without saying anything.
  const VM_IDLE_NUDGE = {
    th: ["ค่อยๆ นะครับ ไม่ต้องรีบ", "ครูรออยู่นะครับ ใจเย็นๆ", "พร้อมเมื่อไหร่ค่อยเล่นก็ได้นะ"],
    en: ["Take your time.", "No rush, I'm still here.", "Whenever you're ready."],
    zh: ["慢慢来，不着急。", "老师还在呢，别紧张。", "准备好了再开始就行。"],
  };
  const VM_IDLE_MS = 24000; // how long of true silence before the one gentle check-in
  async function prefetchFillers() {
    vmFillersRef.current = [];
    if (vmFastRef.current || vmCloudDeadRef.current) return;   // device voice: skip (no cached clips)
    const list = VM_FILLERS[lang] || VM_FILLERS.en;
    for (const t of list) {
      try { const clips = await fetchCloudClips(t, lang); if (clips && clips[0]) vmFillersRef.current.push({ buf: clips[0], text: t }); } catch (e) {}
      if (!vmActiveRef.current) return;
    }
  }
  function vmStopFiller() { if (vmFillerSrcRef.current) { try { vmFillerSrcRef.current.onended = null; vmFillerSrcRef.current.stop(); } catch (e) {} vmFillerSrcRef.current = null; vmSelfSpeakingRef.current = false; } }
  // play one random filler immediately; returns true if it spoke (else caller earcons)
  function vmPlayFiller() {
    const buffers = vmFillersRef.current;
    if (_sfxMuted || !buffers || !buffers.length) return false;
    try {
      const ac = getAC();
      let idx = Math.floor(Math.random() * buffers.length);
      if (buffers.length > 1 && idx === vmFillerLastRef.current) idx = (idx + 1) % buffers.length; // a human never says the exact same "mm-hmm" twice in a row
      vmFillerLastRef.current = idx;
      const pick = buffers[idx];
      vmStopFiller();
      vmMarkSpoken(pick.text); // even our "mm-hmm" echoes — the filter must know it
      const src = ac.createBufferSource();
      src.buffer = pick.buf;
      const rate = 1 + ((vmSpeedRef.current || 1) - 1) * 0.5;
      if (rate !== 1) src.playbackRate.value = Math.max(0.5, Math.min(1.8, rate));
      src.connect(ac.destination);
      // the ear is live while this plays — mute recognition so our own "mm-hmm"
      // can never read as the learner barging in (same guard as the idle nudge)
      vmSelfSpeakingRef.current = true;
      src.onended = () => { if (vmFillerSrcRef.current === src) { vmFillerSrcRef.current = null; vmSpokeAtRef.current = Date.now(); setTimeout(() => { vmSelfSpeakingRef.current = false; vmEarFlushRef.current(); }, 250); } };
      vmFillerSrcRef.current = src;
      src.start();
      return true;
    } catch (e) { return false; }
  }
  // A real teacher never just sits in dead silence forever — if the learner goes
  // quiet (not speaking, not playing) for a while during "listening", say one
  // short, gentle line ONCE, without disrupting the mic/state (same non-intrusive
  // approach as the active-listening fillers). Checked on a slow interval, so it's
  // cheap and never competes with the STT engine's own restart cycling.
  function vmCheckIdle() {
    if (!vmActiveRef.current || vmStateRef.current !== "listening" || vmFrozenRef.current) return;
    if (vmIdleNudgedRef.current) return;
    if (Date.now() - vmLastActivityRef.current < VM_IDLE_MS) return;
    vmIdleNudgedRef.current = true;
    const list = VM_IDLE_NUDGE[lang] || VM_IDLE_NUDGE.en;
    const line = list[Math.floor(Math.random() * list.length)];
    // the recognizer stays live through this (still "listening") — mute its
    // results while our own voice is in the air, plus a short tail for echo/reverb
    vmSelfSpeakingRef.current = true;
    vmSpeakP(line).then(() => { setTimeout(() => { vmSelfSpeakingRef.current = false; vmEarFlushRef.current(); }, 400); });
  }
  // the interval below is armed ONCE per session but must always run the LATEST
  // vmCheckIdle (which closes over the current `lang`) — same stale-closure risk
  // langRef solves for STT, via the same trampoline-ref trick used throughout.
  const vmCheckIdleRef = useRef(() => {});
  useEffect(() => { vmCheckIdleRef.current = vmCheckIdle; });
  function startVoiceSession() {
    if (!sttSupported()) { setVmErr(L[lang].vmNoSTT); vmSetState("error"); return; }
    getAC();
    vmActiveRef.current = true;
    vmCloudDeadRef.current = false; // give the natural cloud voice a fresh try each session
    vmTallyOkRef.current = 0; vmTallyMissRef.current = 0; vmDeafCountRef.current = 0;
    if (!vmMsgsRef.current.length) vmSessionStartRef.current = Date.now(); // fresh lesson starts the clock; resume keeps it
    vmActStartRef.current = Date.now(); // each start/resume opens a new activity-log segment
    vmSpokenRef.current = ""; vmSpokeAtRef.current = 0;
    vmNotesRef.current = []; setVmNotes([]); setVmCaption("");
    stopPracticeListeners();
    vmPolyRef.current = vmPoly;                  // reflect the current beta-toggle choice
    startMicListener((d) => vmOnNote(d), null, null, { poly: vmPolyRef.current }); // best-effort note buffer (chord-aware if poly on)
    prefetchFillers();   // warm up the active-listening clips (non-blocking)
    clearInterval(vmIdleTimerRef.current);
    vmIdleTimerRef.current = setInterval(() => vmCheckIdleRef.current(), 5000);
    vmSpawnEar();        // the ear opens at second zero — you can even talk over the greeting
    if (!vmMsgsRef.current.length) {
      vmOpenGreeting();
    } else {
      vmStartListen();
    }
  }
  // A hardcoded opening line said verbatim every session is the fastest way to feel
  // like a bot. Instead, let the teacher (Gemini, on the natural-conversation system
  // prompt) improvise its own opening — the system prompt already gets homework /
  // struggle / mastered / days-since-last-session context via memoryContext() and
  // homeworkContext(), so this cue can stay short and the greeting still lands warm,
  // relevant and different every single time. Falls back to a static line offline.
  async function vmOpenGreeting() {
    vmSetState("thinking");
    if (!vmPlayFiller()) vmThinkCue();
    const myTurn = ++vmTurnRef.current;
    vmInterruptRef.current = false;
    const cue = "(This is the very start of a brand-new voice lesson — the learner just opened the app, they haven't said anything yet. Greet them the way you'd actually greet a student walking in: brief, warm, in character. Use whatever you know about them from memory/homework context if it's there, otherwise just a natural hello. Never the same opening line twice — genuinely improvise it.)";
    // stream the greeting through the same look-ahead pipeline as a normal reply:
    // the first sentence is SPOKEN while the rest is still generating, so the
    // teacher's voice lands ~2s sooner — first impressions are made of latency
    const segQ = []; let pumping = false, started = false;
    const live = () => vmActiveRef.current && !vmInterruptRef.current && vmTurnRef.current === myTurn;
    const pump = async () => {
      if (pumping) return; pumping = true;
      while (segQ.length && live()) {
        if (!started) { started = true; vmStopFiller(); vmSetState("speaking"); }
        const s = segQ.shift();
        if (s.type === "say") await vmSpeakSeg(s); else await vmActSeg(s);
      }
      pumping = false;
    };
    const enqueue = (sentence) => {
      const uc = !vmFastRef.current && !vmCloudDeadRef.current;
      for (const s of vmParseSegments(sentence)) {
        if (s.type === "say") {
          const t = (s.text || "").trim();
          if (!t) continue;
          segQ.push({ type: "say", text: t, clips: uc ? fetchCloudClips(t, lang).catch(() => null) : undefined });
        } else segQ.push(s);
      }
      pump();
    };
    let greet = "";
    try { greet = (await vmFetchAI(cue, [], enqueue)).trim(); } catch (e) { greet = ""; }
    while ((segQ.length || pumping) && live()) await vmWait(70);
    if (!vmActiveRef.current || vmTurnRef.current !== myTurn) return;
    if (!greet && !vmInterruptRef.current) { // offline / stream failed → static fallback greeting
      const mem = readMemory();
      const topStruggle = mem.struggles && mem.struggles.length ? mem.struggles[0].label : null;
      greet = (homework && homework.text) ? lc.vmGreetHw.replace("{x}", homework.text)
        : topStruggle ? lc.vmGreetBack.replace("{x}", topStruggle)
        : L[lang].vmGreeting;
      vmStopFiller();
      vmSetState("speaking");
      await vmSpeakAndAct(greet);
    }
    if (greet) {
      vmMsgsRef.current = [{ role: "ai", text: vmDisplayText(greet) || greet }];
      setVmMsgs(vmMsgsRef.current);
    }
    if (vmActiveRef.current && !vmInterruptRef.current && vmTurnRef.current === myTurn) vmStartListen();
  }
  // Toggle the beta "chord ear" mid-session: re-arm just the mic listener with
  // the new mode (mono ↔ poly). STT and everything else keep running.
  function vmTogglePoly() {
    const v = !vmPoly;
    setVmPoly(v); vmPolyRef.current = v;
    try { localStorage.setItem("tg_vmpoly", v ? "1" : "0"); } catch (e) {}
    playUi("click");
    if (vmActiveRef.current) {
      if (_practiceStop.mic) { try { _practiceStop.mic(); } catch (e) {} _practiceStop.mic = null; }
      startMicListener((d) => vmOnNote(d), null, null, { poly: v });
    }
  }
  /* ═══ CONTINUITY CORE — the always-open ear ═══
     Why the old flow felt discontinuous: it opened a FRESH recognizer for every
     turn and killed it while the AI thought/spoke. That meant (1) a 0.3–0.7s
     cold-start after EVERY reply during which the learner's first syllables
     were simply lost, (2) total deafness while the AI talked — no interrupting
     by voice, words spoken "too early" vanished — and (3) a long 1.0–1.6s
     silence wait before each turn was considered finished. Stacked on the
     unavoidable network round-trip, every exchange gained 2–3s of dead air.
     New design: ONE continuous recognizer stays alive for the whole session,
     like a human ear that never closes.
     - state "listening": caption + finalize after a short pause (tightened)
     - state "speaking"/"thinking": enough sustained speech = VOICE BARGE-IN —
       the teacher stops mid-sentence and your words are already captured
     - the engine's own periodic restarts re-arm instantly in ANY state. */
  const VM_BARGE_MIN = 12; // chars (spaces stripped) heard mid-reply before we treat it as a real interruption — guards against speaker echo/noise
  // ── SELF-ECHO FILTER ────────────────────────────────────────────
  // On a phone without headphones the mic hears the teacher's OWN voice. The
  // system echo canceller usually removes it — but when it leaks through, it
  // either (a) read as a voice barge-in (the teacher stopped mid-sentence for
  // no reason), or (b) its tail (recognition lags the audio by up to ~1s)
  // landed in the buffer right as we returned to listening, where the flush
  // turned it into a phantom user turn — the teacher literally answered
  // itself. We KNOW exactly what was just said, so a cheap character-bigram
  // overlap test kills both failure modes.
  function vmMarkSpoken(t) {
    const add = (t || "").trim();
    if (!add) return;
    vmSpokenRef.current = (vmSpokenRef.current + " " + add).slice(-600); // rolling tail ≈ the last few sentences
    vmSpokeAtRef.current = Date.now();
  }
  function vmEchoLike(t) {
    // while LISTENING only a fresh tail (≤1.5s after our audio ended) can be
    // echo — a learner genuinely repeating the teacher's words is never eaten;
    // while the teacher is talking/thinking any strong match blocks a fake barge-in
    const win = vmStateRef.current === "listening" ? 1500 : 20000;
    if (!vmSpokeAtRef.current || Date.now() - vmSpokeAtRef.current > win) return false;
    const norm = (s) => (s || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
    const heard = norm(t), spoken = norm(vmSpokenRef.current);
    if (heard.length < 6 || spoken.length < 8) return false;
    const bi = new Set();
    for (let i = 0; i < spoken.length - 1; i++) bi.add(spoken.slice(i, i + 2));
    let hit = 0, tot = 0;
    for (let i = 0; i < heard.length - 1; i++) { tot++; if (bi.has(heard.slice(i, i + 2))) hit++; }
    return tot >= 5 && hit / tot >= 0.72;
  }
  // ── UNFINISHED-SENTENCE DETECTOR ────────────────────────────────
  // A human teacher hears when you trail off mid-thought ("แล้วก็…", "um…",
  // "然后…") and waits — instead of cutting in the instant you pause to think.
  const VM_HESIT = {
    th: ["เอ่อ", "อ่า", "อืม", "เอิ่ม", "คือ", "แบบ", "แบบว่า", "แล้วก็", "ก็คือ", "กับ", "และ", "หรือ", "แต่", "ของ", "อยากจะ", "ช่วย"],
    en: ["um", "uh", "er", "hmm", "and", "but", "so", "because", "like", "the", "a", "an", "to", "of", "for", "with", "my", "your", "let's", "i", "i'm", "can", "could", "should"],
    zh: ["嗯", "呃", "那个", "这个", "就是", "然后", "还有", "但是", "所以", "因为", "和", "跟", "我想", "我要", "可以", "帮我"],
  };
  function vmTrailingHesitation(t) {
    const s = (t || "").trim().toLowerCase().replace(/[.,!?…。！？]+$/g, "");
    if (!s) return false;
    const lg = langRef.current;
    const list = VM_HESIT[lg] || VM_HESIT.en;
    if (lg === "en") { const last = s.split(/\s+/).pop(); return list.includes(last); }
    return list.some(w => s.endsWith(w));
  }
  function vmStartListen() {
    if (!vmActiveRef.current) return;
    // a FRESH turn resets the idle clock; re-entering listening never tears the ear down
    if (vmStateRef.current !== "listening") { vmLastActivityRef.current = Date.now(); vmIdleNudgedRef.current = false; }
    clearTimeout(vmPlayReactT.current);
    clearTimeout(vmSilenceT.current);
    vmFrozenRef.current = false;
    setVmCaption("");
    vmSetState("listening");
    if (!vmRecRef.current) vmSpawnEar(); // ear already hot? just flip state — zero-gap turn-taking
    // CRITICAL: anything said DURING the reply that was too short to barge in
    // ("yes", "ครับ", "โอเค") is sitting in the ear's buffer with no timer armed.
    // Without this flush it would never be processed — the #1 "it didn't hear me".
    else vmEarFlushRef.current();
  }
  function vmSpawnEar() {
    if (!vmActiveRef.current) return;
    const SR = getSR();
    if (!SR) { setVmErr(L[langRef.current].vmNoSTT); vmSetState("error"); return; }
    // never two recognizers at once — they fight over the mic
    if (vmRecRef.current) { try { vmRecRef.current.onend = null; vmRecRef.current.onresult = null; vmRecRef.current.abort(); } catch (e) {} vmRecRef.current = null; }
    clearTimeout(vmRestartT.current);
    clearTimeout(vmWatchdogT.current);
    const mySeq = ++vmListenSeqRef.current;
    let rec;
    try { rec = new SR(); } catch (e) { vmSetState("error"); return; }
    rec.lang = TTS_LOCALES[langRef.current] || "en-US"; // ref, so engine restarts always hear the CURRENT language
    rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = "", lastInterim = "";
    const stale = () => mySeq !== vmListenSeqRef.current;
    const reArm = (ms) => { clearTimeout(vmRestartT.current); vmRestartT.current = setTimeout(() => { if (vmActiveRef.current && !vmRecRef.current && vmListenSeqRef.current === mySeq) vmSpawnEar(); }, ms); };
    const armWatchdog = () => { // recover a silently-hung engine (no result, no end — Android does this)
      clearTimeout(vmWatchdogT.current);
      vmWatchdogT.current = setTimeout(() => {
        if (vmActiveRef.current && vmListenSeqRef.current === mySeq && vmRecRef.current === rec && !finalText && !lastInterim) {
          // SELF-HEALING: two consecutive stone-deaf cycles usually mean the
          // note-detection mic stream is starving speech recognition of the
          // device mic (some Androids won't share it). Free it and tell the
          // learner the ear was re-tuned — taps still play notes fine.
          vmDeafCountRef.current++;
          if (vmDeafCountRef.current >= 2) {
            vmDeafCountRef.current = 0;
            try { stopPracticeListeners(); } catch (e) {}
            if (vmStateRef.current === "listening") setVmCaption(L[langRef.current].vmEarReset);
          }
          try { rec.onend = null; rec.abort(); } catch (e) {}
          vmRecRef.current = null; vmSpawnEar();
        }
      }, 15000);
    };
    const consume = (useInterim) => {
      if (stale()) return;
      const t = finalText.trim() || (useInterim ? lastInterim.trim() : "");
      finalText = ""; lastInterim = "";
      clearTimeout(vmSilenceT.current);
      if (!t) return;
      // PHANTOM-TURN GUARD: recognition lags the speaker by up to ~1s, so the echo
      // of the teacher's own last sentence can land here right after we start
      // listening — without this check the teacher would answer itself.
      if (vmEchoLike(t)) { setVmCaption(""); vmFrozenRef.current = false; return; }
      vmProcess(t); // the ear keeps running underneath (gated by state) — no teardown, no cold restart
    };
    vmEarResetRef.current = () => { finalText = ""; lastInterim = ""; clearTimeout(vmSilenceT.current); };
    // surface whatever the buffer already holds ONCE we're (back in) listening —
    // covers short mid-reply answers and words spoken while a filler was playing
    vmEarFlushRef.current = () => {
      if (stale() || vmStateRef.current !== "listening") return;
      const t = (finalText + " " + lastInterim).trim();
      if (!t) return;
      vmFrozenRef.current = true;
      vmLastActivityRef.current = Date.now();
      setVmCaption(finalText.trim() || lastInterim.trim());
      clearTimeout(vmSilenceT.current);
      const hesF = vmTrailingHesitation(finalText.trim() || lastInterim.trim());
      vmSilenceT.current = setTimeout(() => consume(true), hesF ? 1300 : finalText.trim() ? 450 : 850); // it's already waited — finish fast (unless they trailed off mid-thought)
    };
    rec.onresult = (e) => {
      if (stale()) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      lastInterim = interim;
      armWatchdog();
      vmDeafCountRef.current = 0; // the mic is definitely alive
      // While OUR OWN short clip plays (filler/idle-nudge): keep ACCUMULATING —
      // dropping these events permanently ate any words spoken over the clip
      // (a top "it didn't hear me" cause). We just hold off captions/turn-taking;
      // vmEarFlushRef surfaces the buffer the moment the clip ends.
      if (vmSelfSpeakingRef.current) return;
      const st = vmStateRef.current;
      if (st === "speaking" || st === "thinking") {
        // VOICE BARGE-IN: sustained speech over the teacher = the learner takes the floor.
        const heard = (finalText + interim).replace(/\s+/g, "");
        if (heard.length < VM_BARGE_MIN) return; // short answers stay buffered — flushed at turn end
        // …unless it's the teacher's OWN voice leaking back through the speaker —
        // never let the teacher interrupt itself (and scrub the echo from the buffer)
        if (vmEchoLike(finalText + " " + interim)) { finalText = ""; lastInterim = ""; return; }
        vmInterruptRef.current = true;
        clearTimeout(vmPlayReactT.current);
        vmStopFiller(); stopCloudTTS(); stopSpeaking();
        vmSetState("listening"); // their words are ALREADY captured — nothing was lost
      }
      if (finalText || interim) { vmFrozenRef.current = true; clearTimeout(vmPlayReactT.current); vmLastActivityRef.current = Date.now(); }
      setVmCaption(finalText || interim);
      // finalize after a natural pause — tightened from 1000/1600ms so the reply
      // starts noticeably sooner after you stop talking
      clearTimeout(vmSilenceT.current);
      if (finalText.trim() || interim.trim()) {
        // hold the turn open longer when they trail off mid-thought ("แล้วก็…", "um…")
        const hes = vmTrailingHesitation(finalText.trim() || interim.trim());
        vmSilenceT.current = setTimeout(() => consume(true), hes ? 1800 : finalText.trim() ? 700 : 1100);
      }
    };
    rec.onerror = (ev) => {
      if (stale()) return;
      const err = ev && ev.error;
      if (err === "not-allowed" || err === "service-not-allowed") { setVmErr(L[langRef.current].vmMicDenied); vmSetState("error"); return; }
      if (err === "network" && vmStateRef.current === "listening") setVmCaption(L[langRef.current].vmNetRetry); // weak signal — onend re-arms
      // the note-detection mic can hold the device mic — free it so STT can capture
      if (err === "audio-capture") { try { stopPracticeListeners(); } catch (e) {} }
    };
    rec.onend = () => {
      if (stale()) return;
      vmRecRef.current = null;
      if (!vmActiveRef.current) return;
      // engine died mid-sentence → deliver what we had instead of losing it
      const t = finalText.trim() || lastInterim.trim();
      if (t && vmStateRef.current === "listening") { consume(true); }
      reArm(180); // reopen in ANY state — the ear stays hot while the AI talks too
    };
    vmRecRef.current = rec;
    try { rec.start(); armWatchdog(); }
    catch (e) { vmRecRef.current = null; reArm(500); }
  }
  function vmStudentContext() {
    const li = levelInfo((profile && profile.exp) || 0);
    const meta = (session && session.user && session.user.user_metadata) || {};
    const nm = (profile && profile.full_name) || meta.full_name || meta.name || "";
    const tierName = li.tier[lang] || li.tier.en;
    const ld = (profile && profile.lessons_done) || 0;
    const lbl = lang === "th" ? "ข้อมูลผู้เรียน" : lang === "zh" ? "学员信息" : "Student profile";
    const parts = [];
    if (nm) parts.push((lang === "th" ? "ชื่อ: " : lang === "zh" ? "姓名: " : "Name: ") + nm);
    parts.push((lang === "th" ? "ระดับ: " : lang === "zh" ? "等级: " : "Level: ") + li.level + " (" + tierName + ")");
    parts.push((lang === "th" ? "เรียนจบ " : lang === "zh" ? "已完成 " : "Lessons done: ") + ld + (lang === "th" ? " บท" : lang === "zh" ? " 节" : ""));
    // live lesson stats — a human teacher keeps score of the whole session, not just the last attempt
    const ok = vmTallyOkRef.current, ms = vmTallyMissRef.current;
    if (ok + ms > 0) parts.push((lang === "th" ? "คาบนี้เล่นถูก " + ok + " / พลาด " + ms + " โน้ต" : lang === "zh" ? "本课已弹对 " + ok + " 音 / 弹错 " + ms + " 音" : "This session: " + ok + " correct / " + ms + " missed notes"));
    // the lesson clock — lets the teacher pace the session and wrap up on time
    const mins = vmSessionStartRef.current ? Math.floor((Date.now() - vmSessionStartRef.current) / 60000) : 0;
    if (mins >= 1) parts.push(lang === "th" ? "เวลาเรียนผ่านไป " + mins + " นาที" : lang === "zh" ? "本课已进行 " + mins + " 分钟" : "Lesson running " + mins + " min");
    return "\n\n[" + lbl + ": " + parts.join(" · ") + "]";
  }
  // stream the reply; call onSentence(chunk) as soon as each complete sentence
  // arrives (bracket-aware so [play:…] tags never get split) — lets us start
  // speaking almost immediately instead of waiting for the whole reply.
  async function vmFetchAI(message, history, onSentence) {
    const TERM = ".!?…\n。！？";
    const body = JSON.stringify({ message, conversationHistory: history, system: L[lang].vmSys + FINGERING_REF + vmStudentContext() + memoryContext(lang) + homeworkContext(lang) + curriculumContext(lang) });
    let lastErr;
    // Try up to twice. On a weak signal a stall watchdog aborts a frozen stream;
    // if nothing was spoken yet we retry, and if a partial reply was already
    // spoken we keep it (graceful) instead of erroring — smoother for the learner.
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      let stallT = setTimeout(() => ctrl.abort(), 9000);
      const arm = () => { clearTimeout(stallT); stallT = setTimeout(() => ctrl.abort(), 9000); };
      let acc = "", buf = "", spoken = 0, emittedAny = false;
      const emit = (final) => {
        if (!onSentence) return;
        while (true) {
          const s = acc.slice(spoken);
          let depth = 0, end = -1;
          for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (c === "[") depth++;
            else if (c === "]") depth = Math.max(0, depth - 1);
            else if (depth === 0 && TERM.includes(c)) { end = i; break; }
          }
          if (end === -1) break;
          const chunk = s.slice(0, end + 1);
          if (chunk.trim()) { onSentence(chunk); emittedAny = true; }
          spoken += end + 1;
        }
        if (final) { const tail = acc.slice(spoken); if (tail.trim()) { onSentence(tail); emittedAny = true; spoken = acc.length; } }
      };
      try {
        const res = await fetch(API_URL, { method: "POST", headers: apiHeaders(), body, signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error("http " + res.status);
        const reader = res.body.getReader(), dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          arm(); // reset the stall timer on every chunk
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop() || "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const p = t.slice(5).trim();
            if (!p || p === "[DONE]") continue;
            try { const e = JSON.parse(p); if (e.content) acc += e.content; } catch (_) {}
          }
          emit(false);
        }
        clearTimeout(stallT);
        emit(true);
        return acc;
      } catch (e) {
        clearTimeout(stallT);
        lastErr = e;
        if (emittedAny) return acc;       // already spoke part of it → keep what we have
        if (attempt === 1) throw e;       // second clean failure → give up
        await vmWait(500);                // nothing spoken yet → quick retry
      }
    }
    throw lastErr;
  }
  // Handle the most common requests instantly (no AI round-trip) so the lesson
  // feels responsive: "again", "slower", "faster", "stop".
  function vmLocalCommand(text) {
    const t = (text || "").toLowerCase().trim().replace(/[\s.!?。！？．,]+$/g, "");
    if (!t || t.length > 18) return false;
    const hit = (arr) => arr.indexOf(t) >= 0;
    const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
    const AGAIN = ["again", "repeat", "one more", "once more", "play again", "play it again", "อีกที", "อีกครั้ง", "ขออีกที", "ซ้ำ", "ซ้ำอีกที", "เล่นอีกที", "再来", "再一次", "重来", "再来一次", "再弹一次"];
    const SLOWER = ["slower", "slow down", "too fast", "ช้าลง", "ช้าๆ", "ช้า ๆ", "ช้ากว่านี้", "ช้าหน่อย", "慢一点", "慢点", "太快了", "慢一些"];
    const FASTER = ["faster", "speed up", "too slow", "เร็วขึ้น", "เร็วกว่านี้", "เร็วหน่อย", "快一点", "快点", "太慢了", "快一些"];
    const STOP = ["stop", "stop it", "หยุด", "พอแล้ว", "พอก่อน", "停", "停下", "停一下", "别弹了"];
    const replay = () => { const d = vmLastDemoRef.current; if (d) { vmSetState("speaking"); vmPlayDemo(d.mode, d.notes).then(() => { if (vmActiveRef.current && !vmInterruptRef.current) vmStartListen(); }); } else { vmStartListen(); } };
    const bump = (dir) => { let i = SPEEDS.indexOf(vmSpeedRef.current || 1); if (i < 0) i = 0; i = Math.max(0, Math.min(SPEEDS.length - 1, i + dir)); vmSpeedRef.current = SPEEDS[i]; setVmSpeed(SPEEDS[i]); };
    if (hit(AGAIN)) { replay(); return true; }
    if (hit(SLOWER)) { bump(-1); replay(); return true; }
    if (hit(FASTER)) { bump(1); replay(); return true; }
    if (hit(STOP)) { vmStop(); return true; }
    return false;
  }
  async function vmProcess(text) {
    if (!vmActiveRef.current) return;
    clearTimeout(vmPlayReactT.current);
    // instant local commands (not the "I just played" cue) → no AI round-trip
    if (text !== L[lang].vmPlayedCue && vmLocalCommand(text)) return;
    const myTurn = ++vmTurnRef.current;        // newer turn supersedes any in-flight (barged-in) one
    vmInterruptRef.current = false;            // fresh turn — clear any prior barge-in
    const expSeq = vmSeqRef.current;           // capture the ordered target + ear test before clearing
    const ear = vmEarRef.current;
    vmExpectRef.current = null; vmSeqRef.current = null; vmEarRef.current = null; setVmStaff(null);
    vmSetState("thinking");
    if (!vmPlayFiller()) vmThinkCue();          // warm "mm-hmm/okay" the instant they finish (else a soft cue)
    const notes = vmNotesRef.current.map(x => x.note);
    const times = vmNotesRef.current.map(x => x.t);
    const vels = vmNotesRef.current.map(x => x.vel);
    // poly beta: group notes that struck together (same timestamp) → name each chord cleanly
    const chordGroups = (() => {
      const by = {};
      for (const x of vmNotesRef.current) if (x.chord) (by[x.t] = by[x.t] || []).push(x.note);
      return Object.keys(by).map(t => [...new Set(by[t])]).filter(g => g.length >= 2);
    })();
    vmNotesRef.current = []; setVmNotes([]);
    const history = buildAlternatingHistory(vmMsgsRef.current, 14); // deeper recall — a human remembers the whole lesson, not the last 5 exchanges
    vmMsgsRef.current = [...vmMsgsRef.current, { role: "user", text }];
    setVmMsgs(vmMsgsRef.current);
    setVmCaption("");
    let msg = text;
    if (notes.length) {
      // name each struck-together chord (poly beta); else fall back to whole-buffer interpretation
      const chordNames = chordGroups.map(g => { const n = identifyChord(g); return n ? n + " (" + g.join("+") + ")" : g.join("+"); });
      const interp = chordNames.length ? chordNames.join(", ") : interpretPlayed(notes); // local music engine: name the chord/scale
      const rhythm = rhythmReport(times);        // tempo + steadiness + rush/drag (like a human ear)
      const dyn = vmDynReport(vels);             // touch/dynamics + crescendo (MIDI velocity)
      const metroT = metroTimingReport(times);   // ms-precise timing vs the running metronome
      const lbl = chordNames.length ? (notes.join(" ") + " — chord(s): " + chordNames.join(", ")) : (notes.join(" ") + (interp ? " = " + interp : ""));
      msg += `\n\n(${L[lang].vmNotesLbl}: ${lbl}${rhythm ? "; rhythm: " + rhythm : ""}${dyn ? "; " + dyn : ""}${metroT ? "; " + metroT : ""})`;
    }
    // Real-time sequence correction: pinpoint exactly where the attempt diverged.
    if (expSeq && expSeq.length && notes.length && !ear) {
      let i = 0; while (i < expSeq.length && i < notes.length && expSeq[i] === notes[i]) i++;
      if (i < expSeq.length && i < notes.length)
        msg += `\n\n(Sequence check — target: ${expSeq.join(" ")}; played: ${notes.join(" ")}; first wrong note is #${i + 1}: should be ${expSeq[i]} but played ${notes[i]}. Point this out gently and have them retry from there.)`;
      else if (notes.length < expSeq.length)
        msg += `\n\n(Sequence check — target ${expSeq.length} notes (${expSeq.join(" ")}); only ${notes.length} played (${notes.join(" ")}). Encourage finishing the rest.)`;
      else
        msg += `\n\n(Sequence check — all ${expSeq.length} notes correct & in order: ${expSeq.join(" ")}. Praise it and level up.)`;
    }
    // Ear-training grading: app supplies the ground truth so the AI just judges.
    if (ear) {
      msg += `\n\n(Ear-training — I just played by ear (no keys shown): ${ear.label} [${ear.notes.map(pcOf).join(" ")}]. The learner's answer is above${notes.length ? " (played: " + notes.join(" ") + ")" : ""}. Say if they got it right, reveal what it was, and offer another with [ear: ${ear.kind}].)`;
    }
    // Adaptive pacing from this session's instant ✓/✗ streak.
    // voice tone adapts to the moment: proud on a streak, gentle after misses
    if (vmStreakRef.current >= 3) { setTtsMood("celebrate"); msg += `\n\n(Pacing: the learner just played ${vmStreakRef.current} correct in a row — sounding confident, consider leveling up or adding a small challenge.)`; }
    else if (vmMissRef.current >= 2) { setTtsMood("gentle"); msg += `\n\n(Pacing: the learner missed ${vmMissRef.current} in a row — slow down, make the step smaller, and be extra encouraging.)`; }
    else setTtsMood("warm");
    vmStreakRef.current = 0; vmMissRef.current = 0;
    // (the persistent ear keeps running underneath — gated by state, ready for voice barge-in)
    // Pipeline with cloud look-ahead: as each sentence streams in, parse it to
    // segments and immediately START fetching the cloud audio for spoken parts, so
    // the next sentence's voice is ready before the current finishes — gapless,
    // natural speech instead of a fetch-gap between every sentence.
    const segQ = []; let pumping = false, started = false;
    const enqueue = (sentence) => {
      const uc = !vmFastRef.current && !vmCloudDeadRef.current; // re-check each time (sticky fallback)
      for (const s of vmParseSegments(sentence)) {
        if (s.type === "say") {
          const t = (s.text || "").trim();
          if (!t) continue;
          segQ.push({ type: "say", text: t, clips: uc ? fetchCloudClips(t, lang).catch(() => null) : undefined });
        } else segQ.push(s);
      }
      pump();
    };
    const live = () => vmActiveRef.current && !vmInterruptRef.current && vmTurnRef.current === myTurn;
    const pump = async () => {
      if (pumping) return; pumping = true;
      while (segQ.length && live()) {
        if (!started) { started = true; vmStopFiller(); vmSetState("speaking"); }
        const s = segQ.shift();
        if (s.type === "say") await vmSpeakSeg(s);
        else await vmActSeg(s);
      }
      pumping = false;
    };
    let reply = "";
    try { reply = await vmFetchAI(msg, history, enqueue); } catch (e) { reply = ""; }
    while ((segQ.length || pumping) && live()) await vmWait(70);
    if (vmTurnRef.current !== myTurn) return;   // a newer turn (barge-in) took over — abandon this one
    if (!vmActiveRef.current) return;
    if (!vmInterruptRef.current && !reply.trim()) { reply = lc.err; await vmSpeakAndAct(reply); }
    if (reply.trim() && !vmInterruptRef.current) {
      const display = vmDisplayText(reply);
      vmMsgsRef.current = [...vmMsgsRef.current, { role: "ai", text: display || reply }];
      setVmMsgs(vmMsgsRef.current);
    }
    if (vmActiveRef.current && !vmInterruptRef.current) vmStartListen();
  }
  // barge-in: stop the talking/thinking AI and start listening immediately
  function vmInterrupt() {
    if (!vmActiveRef.current) return;
    if (vmStateRef.current !== "speaking" && vmStateRef.current !== "thinking") return;
    vmInterruptRef.current = true;
    clearTimeout(vmPlayReactT.current);
    vmStopFiller(); stopCloudTTS(); stopSpeaking();
    vmStartListen();
  }
  // ── speak the reply and play any [play:…]/[chord:…] demos inline, in order ──
  const _FLAT = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B", Fb: "E" };
  function vmNormNote(tok) {
    let t = (tok || "").trim();
    if (t === "-") return "-";
    const m = t.match(/^([A-Ga-g])(#|b)?(\d)?$/);
    if (!m) return null;
    let L0 = m[1].toUpperCase(), acc = m[2] || "", oct = m[3] || "4", name;
    if (acc === "b") { name = (_FLAT[L0 + "b"] || L0) + oct; }
    else { name = L0 + acc + oct; }
    return NF[name] ? name : null;
  }
  function vmParseSegments(text) {
    const segs = [], re = /\[(play|chord|highlight|metro|homework|plan|staff|practice|song|posture|ear)(?::\s*([^\]]+))?\]/gi;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) { const t = text.slice(last, m.index); if (t.trim()) segs.push({ type: "say", text: t }); }
      const cmd = m[1].toLowerCase(), val = (m[2] || "").trim();
      if (cmd === "metro") { const bpm = parseInt(val, 10); if (bpm) segs.push({ type: "metro", bpm: Math.min(208, Math.max(40, bpm)) }); }
      else if (cmd === "homework") { if (val) segs.push({ type: "homework", text: val }); }
      else if (cmd === "plan") { if (val) segs.push({ type: "plan", text: val }); }
      else if (cmd === "posture") { segs.push({ type: "posture" }); }
      else if (cmd === "ear") { segs.push({ type: "ear", kind: (val || "interval").toLowerCase() }); }
      else if (cmd === "song") { if (val) segs.push({ type: "song", id: val.toLowerCase() }); }
      else if (cmd === "staff" || cmd === "practice") {
        const notes = val.split(/[\s,]+/).map(vmNormNote).filter(Boolean);
        if (notes.length) segs.push({ type: cmd, notes });
      }
      else {
        const notes = val.split(/[\s,]+/).map(vmNormNote).filter(Boolean);
        if (notes.length) segs.push({ type: cmd === "highlight" ? "highlight" : "play", mode: cmd, notes });
      }
      last = re.lastIndex;
    }
    if (last < text.length) { const t = text.slice(last); if (t.trim()) segs.push({ type: "say", text: t }); }
    if (!segs.length) segs.push({ type: "say", text });
    return segs;
  }
  const vmWait = (ms) => new Promise(r => setTimeout(r, ms));
  async function vmPlayDemo(mode, notes) {
    const sp = vmSpeedRef.current || 1;            // 1 / 1.25 / 1.5 / 1.75 / 2 — faster = shorter gaps
    vmLastDemoRef.current = { mode, notes: notes.slice() };  // remember for an instant "again"
    clearTimeout(vmLitT.current);                  // take over the highlight while we demo
    if (mode === "chord") {
      const lit = notes.filter(n => n !== "-" && NF[n]);
      setVmLit(lit);                               // light the whole chord
      for (const n of lit) playPianoNote(n, 1.2 / sp);
      await vmWait(1200 / sp);
      setVmLit([]);
    } else {
      for (const n of notes) {
        if (!vmActiveRef.current) { setVmLit([]); return; }
        if (n === "-") { setVmLit([]); await vmWait(210 / sp); continue; }
        if (NF[n]) { setVmLit([n]); playPianoNote(n, 0.55 / sp); }  // running light follows the note
        await vmWait(300 / sp);
      }
      setVmLit([]);
      await vmWait(120);
    }
    // after a demo, the learner will try it — remember the notes for instant ✓/✗
    // and the ORDER, so we can pinpoint the first wrong note in their attempt.
    vmExpectRef.current = new Set(notes.filter(n => n !== "-").map(pcOf));
    vmSeqRef.current = notes.filter(n => n !== "-").map(pcOf);
  }
  function vmSpeakP(text) {
    return new Promise(res => {
      let done = false;
      const clean = (text || "").trim();
      vmMarkSpoken(clean); // the echo filter must know every line we say aloud
      // HARD safety net: a stuck TTS engine (Android frequently drops onend, or a
      // cloud fetch hangs on weak signal) must NEVER freeze the lesson on "speaking".
      // Force-advance after a generous estimate of how long this line should take.
      const guard = setTimeout(() => { try { stopSpeaking(); stopCloudTTS(); } catch (e) {} finish(); },
        Math.min(28000, 4000 + clean.length * 140));
      function finish() { if (done) return; done = true; clearTimeout(guard); vmSpokeAtRef.current = Date.now(); res(); }
      // speech speed follows the speed control, but mapped gently so the voice
      // stays natural (2x demo → ~1.5x talking, never chipmunk-fast).
      const rateMul = 1 + ((vmSpeedRef.current || 1) - 1) * 0.5;
      // device voice when: user picked Fast, OR cloud already failed this session
      // (sticky fallback keeps speech smooth on a weak signal — no per-sentence retries).
      if ((vmFastRef.current || vmCloudDeadRef.current) && ttsSupported()) { speakRobust(text, lang, finish, finish, rateMul); return; }
      speakCloud(text, lang, null, finish, () => {
        vmCloudDeadRef.current = true; // first cloud failure → stay on the device voice from now on
        if (!ttsSupported()) { finish(); return; }
        speakRobust(text, lang, finish, finish, rateMul);
      }, rateMul);
    });
  }
  async function vmSpeakAndAct(text) {
    // the persistent ear stays live while we speak — barge-in by voice works even here
    const segs = vmParseSegments(text);
    for (const s of segs) {
      if (!vmActiveRef.current) return;
      if (s.type === "say") { if (s.text.trim()) await vmSpeakP(s.text); }
      else await vmActSeg(s);
    }
  }
  // speak one say-segment, using its prefetched cloud clips when ready (gapless,
  // natural); fall back to the device voice if the cloud clip failed/empty.
  async function vmSpeakSeg(s) {
    if (!vmActiveRef.current || !s.text) return;
    if (s.clips !== undefined) {
      let clips = null;
      try { clips = await s.clips; } catch (e) { clips = null; }
      if (!vmActiveRef.current) return;
      if (clips && clips.length) {
        const rateMul = 1 + ((vmSpeedRef.current || 1) - 1) * 0.5;
        vmMarkSpoken(s.text); // the echo filter must know every line we say aloud
        let done = false;
        const guard = setTimeout(() => { if (!done) { done = true; try { stopCloudTTS(); } catch (e) {} } },
          Math.min(28000, 4000 + s.text.length * 140));
        await playCloudClips(clips, rateMul, () => !vmActiveRef.current);
        done = true; clearTimeout(guard);
        vmSpokeAtRef.current = Date.now(); // the echo freshness window starts when the audio ENDS
        return;
      }
      vmCloudDeadRef.current = true; // cloud failed → device voice from here on
    }
    await vmSpeakP(s.text); // device voice (has its own watchdog)
  }
  // show notes the learner should play: light the keys + remember them so we can
  // give instant local ✓/✗ as the learner plays (no AI round-trip needed).
  function vmShowTargets(notes, ms = 12000) {
    setVmLit(notes);
    vmExpectRef.current = new Set(notes.filter(n => n !== "-").map(pcOf));
    vmSeqRef.current = notes.filter(n => n !== "-").map(pcOf);
    clearTimeout(vmLitT.current);
    vmLitT.current = setTimeout(() => { setVmLit([]); setVmStaff(null); vmExpectRef.current = null; }, ms);
  }
  // hand off to a drill / camera: pause the voice session first so it releases the
  // mic, then open the other mode on top.
  function vmLaunch(fn) {
    vmStop();
    setTimeout(() => { try { fn(); } catch (e) {} }, 180);
  }
  // run one non-speech segment (metronome / homework / highlight / staff / drill / camera / demo)
  async function vmActSeg(s) {
    if (!vmActiveRef.current) return;
    if (s.type === "metro") { getAC(); setMetroBpm(s.bpm); setMetroOn(true); }
    else if (s.type === "homework") { const hw = { text: s.text, date: dayKey() }; setHomeworkLS(hw); setHomework(hw); }
    else if (s.type === "plan") { setLessonPlanLS({ text: s.text, date: dayKey() }); }
    else if (s.type === "highlight") { vmShowTargets(s.notes); }
    else if (s.type === "staff") { setVmStaff(s.notes); vmShowTargets(s.notes); }
    else if (s.type === "posture") { vmLaunch(() => openCamera()); }
    else if (s.type === "song") { const meta = SONGS.find(x => x.id === s.id); vmLaunch(() => { if (meta) chooseSong(meta); else { setPage("studio"); setStudioView("songs"); } }); }
    else if (s.type === "practice") { lastSeq.current = { notes: s.notes.slice(), label: s.notes.map(pcOf).join(" "), mode: "seq", key: null }; vmLaunch(() => startPractice()); }
    else if (s.type === "ear") { await vmStartEar(s.kind); }
    else await vmPlayDemo(s.mode, s.notes);
  }
  // ── EAR TRAINING — play a target by ear ONLY (no keys lit, no hint); the learner
  // answers by playing or saying it, then the app hands the AI the ground truth to grade.
  const EAR_INTERVALS = [
    { s: 2, en: "Major 2nd" }, { s: 3, en: "Minor 3rd" }, { s: 4, en: "Major 3rd" },
    { s: 5, en: "Perfect 4th" }, { s: 7, en: "Perfect 5th" }, { s: 9, en: "Major 6th" }, { s: 12, en: "Octave" },
  ];
  const EAR_CHORDS = [
    { q: "major", en: "Major triad" }, { q: "minor", en: "Minor triad" },
    { q: "dim", en: "Diminished triad" }, { q: "aug", en: "Augmented triad" },
  ];
  async function vmPlayEar(notes, asChord) {
    const sp = vmSpeedRef.current || 1;
    setVmLit([]); // ear training shows NOTHING — pure listening
    if (asChord) {
      for (const n of notes) if (NF[n]) playPianoNote(n, 1.5 / sp);
      await vmWait(1500 / sp);
    } else {
      for (const n of notes) { if (!vmActiveRef.current) return; if (NF[n]) playPianoNote(n, 0.6 / sp); await vmWait(420 / sp); }
    }
  }
  async function vmStartEar(kind) {
    const root = ["C4", "D4", "E4", "F4", "G4", "A4"][Math.floor(Math.random() * 6)];
    let notes, label, asChord = false;
    if (kind === "note") { notes = [root]; label = pcOf(root) + " (single note)"; }
    else if (kind === "chord") {
      const c = EAR_CHORDS[Math.floor(Math.random() * EAR_CHORDS.length)];
      notes = _ascNotes(chordNotesOf(pcOf(root), c.q), 4); label = pcOf(root) + " " + c.en; asChord = true;
    } else {
      const iv = EAR_INTERVALS[Math.floor(Math.random() * EAR_INTERVALS.length)];
      notes = [root, transposeNotes([root], iv.s)[0]]; label = iv.en;
    }
    vmEarRef.current = { kind, label, notes, pcs: new Set(notes.map(pcOf)) };
    vmExpectRef.current = null; vmSeqRef.current = null; // no visual/instant hint during an ear test
    await vmPlayEar(notes, asChord);
  }
  // rough dynamics from MIDI velocities (mic AGC flattens loudness, so MIDI only)
  function vmDynReport(vels) {
    const v = (vels || []).filter(x => x > 0);
    if (v.length < 3) return null;
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    const dev = Math.sqrt(v.reduce((s, x) => s + (x - mean) * (x - mean), 0) / v.length) / (mean || 1);
    const h = Math.floor(v.length / 2);
    const m1 = v.slice(0, h).reduce((s, x) => s + x, 0) / Math.max(1, h);
    const m2 = v.slice(-h).reduce((s, x) => s + x, 0) / Math.max(1, h);
    const trend = m2 > m1 * 1.2 ? "crescendo" : m2 < m1 * 0.83 ? "diminuendo" : "level";
    const even = dev < 0.22 ? "very even" : dev < 0.4 ? "fairly even" : "uneven";
    const lvl = mean > 95 ? "loud (f)" : mean > 60 ? "medium (mf)" : "soft (p)";
    return `touch ${even}, ${lvl}, ${trend}`;
  }
  // close the current voice segment into the activity log (once per start/resume)
  function vmLogSegment() {
    if (!vmActStartRef.current) return;
    const sec = (Date.now() - vmActStartRef.current) / 1000;
    vmActStartRef.current = 0;
    if (sec >= 20) logActivity("voice", "session", vmTallyOkRef.current, vmTallyMissRef.current, sec);
  }
  function vmStop() { // pause the session but keep the overlay open
    vmLogSegment();
    vmActiveRef.current = false;
    vmListenSeqRef.current++;   // invalidate any in-flight recognizer callbacks
    clearTimeout(vmPlayReactT.current); clearTimeout(vmSilenceT.current); clearTimeout(vmRestartT.current); clearTimeout(vmWatchdogT.current);
    clearInterval(vmIdleTimerRef.current); vmIdleTimerRef.current = null;
    vmSelfSpeakingRef.current = false;
    if (vmRecRef.current) { try { vmRecRef.current.onend = null; vmRecRef.current.abort(); } catch (e) {} vmRecRef.current = null; }
    vmStopFiller(); stopCloudTTS(); stopSpeaking();
    touchSessionMemory();   // remember when this session ended (for return-gap greetings)
    vmSetState("idle");
  }
  function vmToggle() { if (vmActiveRef.current) vmStop(); else startVoiceSession(); }
  // tap the orb: interrupt while it talks/thinks, or re-open the ear while listening
  function vmOrbTap() {
    if (vmStateRef.current === "speaking" || vmStateRef.current === "thinking") vmInterrupt();
    else if (vmStateRef.current === "listening") { haptic(); vmSpawnEar(); } // force a FRESH recognizer (unsticks a dead ear)
    else if (!vmActiveRef.current) startVoiceSession();
  }
  function exitVoice() {
    vmLogSegment();
    vmActiveRef.current = false;
    vmListenSeqRef.current++;
    clearTimeout(vmPlayReactT.current); clearTimeout(vmInstantT.current); clearTimeout(vmLitT.current);
    clearTimeout(vmSilenceT.current); clearTimeout(vmRestartT.current); clearTimeout(vmWatchdogT.current);
    clearInterval(vmIdleTimerRef.current); vmIdleTimerRef.current = null;
    vmSelfSpeakingRef.current = false;
    if (vmRecRef.current) { try { vmRecRef.current.onend = null; vmRecRef.current.abort(); } catch (e) {} vmRecRef.current = null; }
    vmStopFiller(); stopCloudTTS(); stopSpeaking(); stopPracticeListeners();
    touchSessionMemory();   // remember when this session ended (for return-gap greetings)
    vmFillersRef.current = [];
    vmExpectRef.current = null; vmSeqRef.current = null; vmEarRef.current = null;
    setVmStaff(null); setVmLit([]); setVmInstant(null);
    vmSetState("idle"); setVmOpen(false); setVmCaption("");
  }
  useEffect(() => { if (vmEndRef.current) vmEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [vmMsgs]);

  // ── metronome engine ──
  const metroBeatRef = useRef(0);
  const metroBeatTimesRef = useRef([]);   // recent metronome beat timestamps → grade timing vs the click
  useEffect(() => {
    if (!metroOn) { metroBeatTimesRef.current = []; return; }
    getAC();
    metroBeatRef.current = 0;
    const tick = () => {
      playClick(metroBeatRef.current % 4 === 0); metroBeatRef.current++;
      const a = metroBeatTimesRef.current; a.push(Date.now()); if (a.length > 64) a.shift();
    };
    tick();
    const id = setInterval(tick, 60000 / metroBpm);
    return () => clearInterval(id);
  }, [metroOn, metroBpm]);
  // grade the learner's note onsets against the actual metronome clicks (ms-precise)
  function metroTimingReport(noteTimes) {
    const beats = metroBeatTimesRef.current;
    if (!metroOn || beats.length < 2 || !noteTimes || noteTimes.length < 2) return null;
    const offs = [];
    for (const t of noteTimes) {
      let best = 1e9; for (const b of beats) { const d = t - b; if (Math.abs(d) < Math.abs(best)) best = d; }
      if (Math.abs(best) < 60000 / metroBpm) offs.push(best);   // ignore notes with no nearby beat
    }
    if (offs.length < 2) return null;
    const avg = Math.round(offs.reduce((s, x) => s + x, 0) / offs.length);
    const offBeat = offs.filter(o => Math.abs(o) > 70).length;
    const dir = avg > 25 ? "behind/dragging" : avg < -25 ? "ahead/rushing" : "right on the beat";
    return `vs metronome: avg ${avg >= 0 ? "+" : ""}${avg}ms (${dir}); ${offBeat}/${offs.length} notes off by >70ms`;
  }
  useEffect(() => { if (ambientOn) startAmbient(); else stopAmbient(); return () => stopAmbient(); }, [ambientOn]);
  // capture the install prompt → lets us offer "Add to home screen" (external trigger)
  const [installEvt, setInstallEvt] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  async function doInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) {}
    setInstallEvt(null);
  }
  // A one-time "add to home screen" nudge shown right after the learner's first
  // real win, instead of only sitting buried in Settings where nobody finds it.
  // A home-screen icon is one of the biggest levers for people actually opening
  // the app again — so the ask needs to land the moment they're happiest, not later.
  const [installBannerSeen, setInstallBannerSeen] = useState(() => { try { return localStorage.getItem("tg_install_banner_seen") === "1"; } catch (e) { return false; } });
  const showInstallBanner = !!installEvt && !installBannerSeen && freeContentPlays() >= 1;
  function dismissInstallBanner() {
    setInstallBannerSeen(true);
    try { localStorage.setItem("tg_install_banner_seen", "1"); } catch (e) {}
  }
  async function installFromBanner() { dismissInstallBanner(); await doInstall(); }
  // Re-engagement push: toggle in Settings, plus a one-time prompt the first
  // time a real streak is actually at risk — the exact moment a reminder
  // would matter, tied to the same streakAtRisk() the in-app UI already uses.
  const [pushOn, setPushOn] = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");
  async function togglePush() {
    if (pushOn) { await unsubscribePush(); setPushOn(false); }
    else { const ok = await subscribePush(session.user.id); setPushOn(ok); }
  }
  function saveAutoTeachInterval(min) {
    setProfile(p => (p ? { ...p, auto_teach_interval_min: min } : p));
    sb.from("profiles").update({ auto_teach_interval_min: min }).eq("id", session.user.id).then(() => {}, () => {});
  }
  const [pushBannerSeen, setPushBannerSeen] = useState(() => { try { return localStorage.getItem("tg_push_banner_seen") === "1"; } catch (e) { return false; } });
  const showPushBanner = pushSupported() && !pushOn && !pushBannerSeen && streakAtRisk() && (profile && profile.streak > 0);
  function dismissPushBanner() {
    setPushBannerSeen(true);
    try { localStorage.setItem("tg_push_banner_seen", "1"); } catch (e) {}
  }
  async function enablePushFromBanner() { dismissPushBanner(); await togglePush(); }
  const tapTimesRef = useRef([]);
  function tapTempo() {
    const now = Date.now();
    const arr = tapTimesRef.current.filter(t => now - t < 2000);
    arr.push(now); tapTimesRef.current = arr;
    if (arr.length >= 2) {
      let sum = 0; for (let i = 1; i < arr.length; i++) sum += arr[i] - arr[i - 1];
      const bpm = Math.round(60000 / (sum / (arr.length - 1)));
      if (bpm >= 40 && bpm <= 240) setMetroBpm(bpm);
    }
  }
  // coins + mascot + daily chest
  function earnCoins(n) { const v = getCoins() + n; setCoinsLS(v); setCoins(v); }
  function reviewTopic(t) {
    setActiveStageId(null); // free-text question, not a Pathway topic+key — no "change key" back button
    setPage("sensei");
    topicHint.current = null; lessonKey.current = null;
    const q = lc.recAsk.replace("{x}", t);
    setMsgs(prev => [...prev, { role: "user", text: q }]);
    playPianoNote("C5", 0.1);
    callClaude(q);
  }
  function reviewSchools() {
    setActiveStageId(null);
    setPage("sensei");
    setMsgs(prev => [...prev, { role: "ai", text: lc.schoolInfo }]);
  }
  function recommendNext() {
    const m = readMemory();
    if (m.struggles && m.struggles.length) {
      const t = m.struggles[0].label;
      return { icon: "🎯", label: lc.recReview.replace("{x}", t), fn: () => reviewTopic(t) };
    }
    const cur = PATHWAY.find(s => !pathDoneSet().has(s.id));
    if (cur) return { icon: "📘", label: lc.recNext + " " + tr(cur.title, lang), fn: () => { playUi("click"); setPage("pathway"); } };
    return { icon: "🎮", label: lc.recWarm, fn: () => { playUi("click"); setPage("studio"); setStudioView("songs"); } };
  }
  function toggleExamTask(gid, i) {
    setExamProgress(prev => {
      const cur = prev[gid] || [];
      const next = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i];
      const all = { ...prev, [gid]: next };
      try { localStorage.setItem("tg_exam", JSON.stringify(all)); } catch (e) {}
      if (!cur.includes(i)) { playUi("reward"); earnCoins(5); }
      return all;
    });
  }
  // Switch to any plan at any time (upgrade/downgrade). Demo activation — wire a
  // real gateway (Omise / LINE Pay / Stripe) per tier for production.
  function choosePlan(p) {
    const paid = p !== "free";
    setPlanLS(p); setPlan(p);
    setPremiumLS(paid); setPremium(paid);
    if (paid) { setPricingOpen(false); getAC(); playUi("levelup"); mascot("celebrate", 3200); }
    else { playUi("click"); }
  }
  // real payment: open the PromptPay checkout for a paid plan (monthly or yearly)
  function startCheckout(planId, cycle = "month") {
    playUi("click"); setPricingOpen(false);
    const yr = cycle === "year";
    setCheckout({ plan: planId, amount: yr ? yearPrice(planId) : (PLAN_PRICE[planId] || 0), cycle, days: yr ? 365 : 30 });
  }
  // free-tier gate: after FREE_CONTENT_LIMIT contents, require a share (or premium).
  // Returns true if the learner may proceed; otherwise opens the share gate.
  function gateContent() {
    if (premium || hasSharedUnlock()) return true;
    if (freeContentPlays() >= FREE_CONTENT_LIMIT) { setShareGate(true); playUi("click"); haptic(20); return false; }
    return true;
  }
  function activatePremium() { choosePlan("premium"); }
  function buyFreeze() {
    const cost = 120;
    if (getCoins() < cost) { mascot("sad", 1200); playMiss(); return; }
    const v = getCoins() - cost; setCoinsLS(v); setCoins(v);
    addFreeze(1); playUi("reward"); mascot("celebrate", 1600);
  }
  function bumpWeekly(type, n = 1) {
    const w = readWeekly();
    w[type] = (w[type] || 0) + n;
    if (!Array.isArray(w.claimed)) w.claimed = [];
    for (const ch of CHALLENGES) {
      if ((w[ch.id] || 0) >= ch.goal && !w.claimed.includes(ch.id)) { w.claimed.push(ch.id); earnCoins(CHALLENGE_REWARD); playUi("reward"); }
    }
    writeWeekly(w);
  }
  function mascot(mood, ms = 2200) { setMascotMood(mood); clearTimeout(mascotT.current); mascotT.current = setTimeout(() => setMascotMood("idle"), ms); }
  useEffect(() => { setChestAvail(chestAvailable()); }, []);
  useEffect(() => {
    document.body.dataset.skin = skin; document.body.dataset.theme = theme; document.body.dataset.frame = frame;
    document.documentElement.dataset.theme = mode;
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute("content", mode === "dark" ? "#0d0d0c" : "#faf9f5");
  }, [skin, theme, frame, mode]);
  const EQUIP_SETTERS = { skin: setSkin, theme: setTheme, frame: setFrame };
  function buyOrEquip(kind, item) {
    const setEquip = EQUIP_SETTERS[kind];
    if (owned.includes(item.id)) {
      setEquip(item.id); setEquipLS(kind, item.id);
      playUi("click"); haptic(6);
      return;
    }
    if (coins < item.cost) { mascot("sad", 1200); return; }
    const v = getCoins() - item.cost; setCoinsLS(v); setCoins(v);
    const no = [...owned, item.id]; setOwned(no); setOwnedLS(no);
    setEquip(item.id); setEquipLS(kind, item.id);
    playUi("reward"); mascot("celebrate", 1800);
  }
  const RARITY_LABEL = { common: lc.shopRareC, rare: lc.shopRareR, epic: lc.shopRareE, legendary: lc.shopRareL };
  function renderShopItem(kind, it, equippedId) {
    const own = owned.includes(it.id), eq = equippedId === it.id;
    return (
      <button key={it.id} className={`shopitem ${it.rarity}${eq ? " equipped" : ""}`} onClick={() => buyOrEquip(kind, it)}>
        {it.isNew && !own && <span className="shopitem-new">{lc.shopNew}</span>}
        <span className="shopitem-swwrap">
          <span className="shopitem-sw" style={{ background: `linear-gradient(135deg,${it.sw.join(",")})` }} />
          <span className="shopitem-ic">{it.icon}</span>
        </span>
        <span className="shopitem-nm">{tr(it, lang)}</span>
        <span className="shopitem-rare">{RARITY_LABEL[it.rarity]}</span>
        <span className="shopitem-tag">{eq ? "✓ " + lc.shopEquipped : own ? lc.shopEquip : "🪙 " + it.cost}</span>
      </button>
    );
  }
  function openChestNow() {
    if (chestOpening) return;
    getAC();
    setChestOpen(true); setChestOpening(true); setChestReward(null);
    playUi("reward");
    setTimeout(() => {
      const r = claimChest();
      earnCoins(r.coins); gainExp(r.exp);
      setChestReward(r); setChestAvail(false); setChestOpening(false);
      playUi("levelup"); mascot("celebrate", 3200);
    }, 850);
  }

  function handleAIReply(text) {
    // when a lesson is active we already played the correct demo explicitly —
    // do NOT auto-play from the AI text (that mis-detected the topic before)
    if (topicHint.current === LESSON_MODE) return;
    const parsed = extractNotes(text, hand, topicHint.current, lessonKey.current);
    if (parsed) {
      const t = setTimeout(() => playSequence(parsed), 500);
      seqTimers.current.push(t); // tracked so clearSeq()/unmount can cancel it
    }
  }

  function buildHistory() {
    return buildAlternatingHistory(msgs, 6);
  }

  /* Chat via the Supabase Edge Function proxy — streams the reply word-by-word.
     Sends { message, conversationHistory, system }; reads SSE lines of
     `data: {"content":"..."}` produced by the function. */
  async function callClaude(userText) {
    setLoading(true);
    const history = buildHistory();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ message: userText, conversationHistory: history, system: lc.sys + FINGERING_REF + memoryContext(lang) }),
      });

      if (!res.ok || !res.body) {
        let detail = "";
        try { const j = await res.json(); detail = j?.error || ""; } catch (e) {}
        throw new Error(detail || ("HTTP " + res.status));
      }

      // insert an empty AI bubble we will fill as tokens arrive
      setMsgs(prev => [...prev, { role: "ai", text: "" }]);
      setLoading(false); // hide the typing dots — text is now streaming in

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buffer = "";

      // throttle UI updates to ~16fps instead of re-rendering on every token
      let pendingFlush = null;
      let lastFlush = 0;
      const flush = () => {
        pendingFlush = null;
        lastFlush = Date.now();
        const text = acc;
        setMsgs(prev => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "ai") { copy[i] = { ...copy[i], text }; break; }
          }
          return copy;
        });
      };
      const scheduleFlush = () => {
        if (pendingFlush) return;
        const since = Date.now() - lastFlush;
        const wait = since >= 60 ? 0 : 60 - since;
        pendingFlush = setTimeout(flush, wait);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let evt;
          try { evt = JSON.parse(payload); } catch (e) { continue; }
          if (evt.content) { acc += evt.content; scheduleFlush(); }
        }
      }
      if (pendingFlush) clearTimeout(pendingFlush);
      flush(); // final flush with the complete text

      if (acc.trim()) {
        handleAIReply(acc);
      } else {
        // nothing streamed back — surface a friendly error in the empty bubble
        setMsgs(prev => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "ai") { copy[i] = { ...copy[i], text: lc.err }; break; }
          }
          return copy;
        });
      }
      setLoading(false);
    } catch (e) {
      console.error("Chat error:", e);
      setMsgs(prev => [...prev, { role: "ai", text: lc.err }]);
      setLoading(false);
    }
  }

  function send() {
    const t = input.trim();
    if (!t || loading) return;
    // derive topic hint from what the user actually typed (scale vs chord)
    const lo = t.toLowerCase();
    if (/\bscale\b|สเกล|บันไดเสียง|音阶|音階/.test(lo)) topicHint.current = "scale";
    else if (/\bchord\b|triad|คอร์ด|ไทรแอด|和弦/.test(lo)) topicHint.current = "chord";
    else topicHint.current = null; // let the detector decide from the AI reply
    lessonKey.current = null; // free-typed: don't force a lesson key, detect from text
    setInput("");
    setMsgs(prev => [...prev, { role: "user", text: t }]);
    playPianoNote("C5", 0.1);
    // tier 1: does this clearly match a prepared Pathway chapter/case study already in the app?
    const faq = matchFaqTopic(t, lang);
    if (faq) {
      topicHint.current = LESSON_MODE; // curated reading content — don't auto-detect notes from it
      setMsgs(prev => [...prev, { role: "ai", text: tr(faq.content, lang) }]);
    } else {
      callClaude(t); // tier 2: no prepared match — ask the live AI
    }
    gainExp(EXP.ask, { quest: true }); // reward engaging with the AI sensei
  }

  // ── learn a topic+key from the pathway menu: send to AI + go to sensei page ──
  function learnTopic(stage, key, chordType = null) {
    if (!gateContent()) return;   // free limit reached → share to continue
    bumpContentPlays();
    if (stage && stage.id) { markPathDone(stage.id); if (key && key.id) markKeyDone(stage.id, key.id); setActiveStageId(stage.id); }
    const basePrompt = stage.learn[lang] || stage.learn.en;
    const keyId = key ? key.id : "C";
    const keyLabel = key ? key.name : "C";
    logActivity("lesson", stage.id + "/" + keyId.toLowerCase(), 0, 0, 180); // ~3 min of study per topic-in-key

    // Use chord-type's demo notes if a type was selected, otherwise stage defaults
    const demoSrc = chordType || stage;
    const semis = semisFromC(keyId);
    const demoNotes = transposeNotes(demoSrc.demo || stage.demo, semis);
    let demoFingers = demoSrc.demoFingers || stage.demoFingers || null;
    let chartKey = null;   // canonical key so the chart can recompute fingering on a hand switch
    if (stage.demoMode === "scale") {
      // Per-key scale fingering is irregular — reusing C's is wrong for F/B/flat keys.
      // Look up the verified fingering for the ACTUAL key; show nothing if unknown
      // (an honest blank beats teaching a wrong fingering). Use the picker's own
      // spelling (keyId) directly — routing it through CHROMA (sharps-only) would
      // silently respell Db/Ab/Eb/Bb as C#/G#/D#/A# and miss the lookup entirely.
      const scaleKey = keyId.toLowerCase() + " major scale";
      const map = hand === "left" ? FINGERINGS_LH : FINGERINGS_RH;
      const fk = map[scaleKey];
      demoFingers = fk ? fk.slice(0, demoNotes.length) : null;
      // Keep the key ONLY when we have verified data — then switching L/R hand
      // recomputes the correct fingering instead of keeping the other hand's.
      chartKey = fk ? scaleKey : null;
    } else if (demoFingers && hand === "left") {
      demoFingers = demoFingers.slice().reverse();   // triads/intervals mirror for the left hand
    }
    topicHint.current = LESSON_MODE;
    lessonKey.current = null;

    const sTitle = tr(stage.title, lang);
    const typeName = chordType ? tr(chordType.label, lang) : null;
    const fullTitle = typeName ? `${typeName} ${sTitle}` : sTitle;

    const demoParsed = {
      notes: demoNotes,
      mode: stage.demoMode,
      fingers: demoFingers,
      label: `${fullTitle} · ${keyLabel}`,
      key: chartKey,
      stageId: stage.id,
    };

    // strict instruction scoped to the specific chord type (if any)
    let strict;
    if (chordType) {
      const sym = chordType.symbol;
      if (lang === "th") {
        strict = `สอนเฉพาะ "${typeName}" ใน "${sTitle}" คีย์ ${keyId} (${keyLabel}) เท่านั้น อธิบายสูตร โน้ตทุกตัว และความรู้สึกของเสียง ระบุชื่อโน้ตทุกตัวในคีย์ ${keyId} (${keyLabel}). `;
      } else if (lang === "zh") {
        strict = `只教授"${typeName}(${sym})"这一种类型的${sTitle}，使用${keyId}(${keyLabel})调。解释公式、所有音符和音色感受，列出${keyId}调的所有音名。`;
      } else {
        strict = `Teach ONLY the "${typeName} (${sym})" type of ${sTitle} in the key of ${keyId} (${keyLabel}). Explain the formula, every note, and the character of this specific chord type. List all note names in ${keyId}. `;
      }
    } else {
      if (lang === "th") {
        strict = `สอนเฉพาะหัวข้อ "${sTitle}" ในคีย์ ${keyId} (${keyLabel}) เท่านั้น ห้ามสอนหรือยกตัวอย่างหัวข้ออื่น เช่น ถ้าหัวข้อคือ "ขั้นคู่ (Interval)" ให้สอนเรื่องขั้นคู่เท่านั้น ห้ามสอน triad หรือคอร์ด ตอบให้ตรงหัวข้อ ระบุชื่อโน้ตในคีย์ ${keyId}. `;
      } else if (lang === "zh") {
        strict = `只讲解主题"${sTitle}"，使用 ${keyId} (${keyLabel}) 调。不要讲解或举例其他主题，例如主题是"音程(Interval)"就只讲音程，不要讲三和弦或和弦。回答要切题，列出 ${keyId} 调的音名。`;
      } else {
        strict = `Teach ONLY "${sTitle}" in the key of ${keyId} (${keyLabel}). Do not teach or give examples of any other topic — e.g. if the topic is "Interval", teach intervals only, never triads or chords. Stay exactly on topic and list note names in ${keyId}. `;
      }
    }
    const prompt = strict + basePrompt;

    setPage("sensei");
    const intro = [{ role: "user", text: `📚 ${stage.icon} ${fullTitle} · ${keyLabel}` }];
    // when no specific type chosen, show the curated type reference card
    if (stage.typesInfo && !chordType) intro.push({ role: "ai", text: tr(stage.typesInfo, lang) });
    // tier 1: scale/interval/triad/7th topics are formulaic — answer instantly from
    // the app's own theory engine instead of asking the live AI every time
    const local = localPathwayLesson(stage, keyId, keyLabel, chordType, demoNotes, fullTitle, lang);
    if (local) intro.push({ role: "ai", text: local });
    setMsgs(prev => [...prev, ...intro]);
    const dt = setTimeout(() => playSequence(demoParsed), 300);
    seqTimers.current.push(dt);
    if (!local) callClaude(prompt); // tier 2: no prepared answer — ask the live AI
    gainExp(EXP.lesson, { lesson: true, quest: true }); // reward practicing a pathway topic
  }

  // open a "benefits of music" knowledge chapter — show curated content in the chat
  function readChapter(stage, caseObj) {
    if (!caseObj && stage && stage.id) logUsage("pathway", stage.id); // top-level card tap only, not a case-study drill-down
    if (stage && stage.id) markPathDone(stage.id);
    if (stage && stage.id) logActivity("read-chapter", stage.id, 0, 0, 120); // ~2 min of reading
    const title = caseObj ? tr(caseObj.title, lang) : tr(stage.title, lang);
    const body = caseObj ? tr(caseObj.content, lang) : tr(stage.content, lang);
    const icon = caseObj ? (caseObj.icon || stage.icon) : stage.icon;
    topicHint.current = LESSON_MODE;   // don't auto-detect/play notes from this text
    lessonKey.current = null;
    setActiveStageId(null); // reading chapters have no key picker — no "change key" back button
    setPage("sensei");
    setMsgs(prev => [...prev,
      { role: "user", text: `📚 ${icon} ${title}` },
      { role: "ai", text: body },
    ]);
    gainExp(EXP.chapter, { quest: true }); // reward reading a knowledge chapter
  }

  return (
    <div className="tg" style={{ opacity: cssReady ? 1 : 0, transition: "opacity .15s" }}>
      <div className="scan" />

      {/* HEADER — hidden on the video feed so it plays truly full-screen (a floating ☰ replaces it there) */}
      {page !== "videos" && <div className="hdr">
        <div className="logo">
          <button className="hamb" onClick={() => { playUi("click"); setNavOpen(true); }} aria-label="Menu">
            <span /><span /><span />
          </button>
          <div className="lbox flicker" onClick={handleLogoTap}
            style={{ cursor: "pointer" }} title="TG">TG</div>
          <div>
            <div className="lname">TIGA.AI</div>
          </div>
        </div>
        <div className="hdr-r">
          {premium && (() => { const b = planBadge(plan) || { t: "⭐ PRO", c: "" }; return <span className={`probadge ${b.c}`} title={PLAN_LABEL[plan] || "Premium"}>{b.t}</span>; })()}
          {chestAvail && <button className="chestbtn" onClick={openChestNow} title={lc.chestTitle} aria-label="Daily reward">🎁</button>}
          {metroOn && <button className="metropill" onClick={() => setMetroOn(false)} title="Metronome" aria-label="Metronome on">🥁 {metroBpm}</button>}
          <div className="flagwrap" onClick={e => e.stopPropagation()}>
            <button className="flagbtn" onClick={() => setFlagOpen(o => !o)}
              aria-label="Language" aria-expanded={flagOpen}>
              <span>{FLAGS[lang]}</span>
              <span className="caret">{flagOpen ? "▲" : "▼"}</span>
            </button>
            {flagOpen && (
              <div className="flagmenu">
                {["th", "en", "zh"].map(lg => (
                  <button key={lg}
                    className={`flagitem${lang === lg ? " active" : ""}`}
                    onClick={() => { setLang(lg); setFlagOpen(false); }}>
                    <span>{FLAGS[lg]}</span>
                    <span className="fn">{FLAG_NAMES[lg]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* ─── PAGE: ADMIN — reachable ONLY via the 5-tap logo + code, never a nav link ─── */}
      {page === "admin" && (
        adminUnlocked
          ? <AdminPage lang={lang} onExit={exitAdmin} adminTier={(profile && profile.admin_tier) || (profile && profile.is_admin ? 3 : 0)} />
          : <LockScreen lang={lang} onUnlock={tryUnlock} />
      )}

      {/* ─── PAGE: PATHWAY ─── */}
      {page === "pathway" && (
        <PathwayPage lang={lang} onLearn={learnTopic} onRead={readChapter} initialOpenStageId={activeStageId} />
      )}

      {/* ─── PAGE: PRACTICE TODAY / EAR GYM / READING / INSIGHTS / REPORT ─── */}
      {page === "today" && (
        <TodayPage lang={lang} exp={(profile && profile.exp) || 0} homework={homework}
          onLearn={learnTopic} onRead={readChapter} onSong={chooseSong}
          onReward={(xp, c) => { if (xp) gainExp(xp, { quest: true }); if (c) earnCoins(c); }}
          onBack={() => { setPage("studio"); setStudioView("menu"); }} />
      )}
      {page === "eargym" && (
        <EarGymPage lang={lang} onReward={(xp, c) => { if (xp) gainExp(xp, { quest: true }); if (c) earnCoins(c); }} onBack={() => { setPage("studio"); setStudioView("menu"); }} />
      )}
      {page === "reading" && (
        <ReadingPage lang={lang} onReward={(xp, c) => { if (xp) gainExp(xp, { quest: true }); if (c) earnCoins(c); }} onBack={() => { setPage("studio"); setStudioView("menu"); }} />
      )}
      {page === "insights" && (
        <InsightsPage lang={lang} profile={profile} onSong={chooseSong} onBack={() => setPage("profile")} />
      )}
      {page === "report" && (
        <ReportPage lang={lang} profile={profile} onBack={() => setPage("profile")} />
      )}

      {/* ─── PAGE: VIDEO LESSONS ─── */}
      {page === "videos" && (
        <button className="vidfab" aria-label="Menu" onClick={() => { playUi("click"); setNavOpen(true); }}>
          <span /><span /><span />
        </button>
      )}
      {page === "videos" && (
        <VideoLessonsPage lang={lang} onAsk={(t) => {
          playUi("click");
          setInput((lang === "th" ? 'ช่วยสอนเพิ่มเติมจากวิดีโอบทเรียน "' : lang === "zh" ? '请给我详细讲讲视频课程 "' : 'Teach me more about the video lesson "') + t + '"');
          setActiveStageId(null);
          setPage("sensei");
        }} />
      )}

      {/* ─── PAGE: STUDIO (play-along / sight-reading / hand coach) ─── */}
      {page === "studio" && (
        studioView === "songs"
          ? <SongListPage lang={lang} level={levelInfo((profile && profile.exp) || 0).level} premium={premium} onUpsell={() => setPricingOpen(true)} onPlay={chooseSong} onBack={() => setStudioView("menu")} />
          : <StudioPage lang={lang} voiceLocked={!isMaxPlan(plan) && !(profile && profile.is_admin)} onVoice={() => { if (!isMaxPlan(plan) && !(profile && profile.is_admin)) { playUi("click"); setPricingOpen(true); } else openVoice(); }} onSongs={() => setStudioView("songs")} onSight={openSight} onCamera={openCamera} onExam={() => { playUi("click"); premium ? setExamOpen(true) : setPricingOpen(true); }} onEarGym={() => { playUi("click"); logUsage("nav", "studio-eargym"); setPage("eargym"); }} onReading={() => { playUi("click"); logUsage("nav", "studio-reading"); setPage("reading"); }} onToday={() => { playUi("click"); logUsage("nav", "studio-today"); setPage("today"); }} />
      )}

      {/* ─── PAGE: PROFILE ─── */}
      {page === "profile" && (
        <div className="profscroll">
          {(() => {
            const sInfo = readStreak();
            const atRisk = streakAtRisk();
            const qT = questToday(profile);
            const qPct = Math.round(Math.min(qT, QUEST_GOAL) / QUEST_GOAL * 100);
            return (
              <div className="profdash">
                <div className={`dailyhub${atRisk ? " atrisk" : ""}`}>
                  <div className="dh-streak">
                    <div className="dh-flame">🔥</div>
                    <div className="dh-streaknum">{sInfo.count || 0}</div>
                    <div className="dh-streaklbl">{lc.dhStreak}</div>
                  </div>
                  <div className="dh-mid">
                    <div className="dh-goal-top">
                      <span>{atRisk ? lc.dhAtRisk : qT >= QUEST_GOAL ? lc.dhDone : lc.dhGoal}</span>
                      <b>{Math.min(qT, QUEST_GOAL)}/{QUEST_GOAL}</b>
                    </div>
                    <div className="dh-goalbar"><div style={{ width: qPct + "%" }} /></div>
                    <div className="dh-actions">
                      {(sInfo.freezes || 0) > 0 && <span className="dh-freeze">🛡️ {sInfo.freezes}</span>}
                      {(sInfo.freezes || 0) === 0 && <button className="dh-buyfreeze" onClick={buyFreeze}>🛡️ {lc.dhFreeze} 120🪙</button>}
                    </div>
                  </div>
                  {chestAvail
                    ? <button className="dh-chest" onClick={openChestNow}>🎁<span>{lc.dhClaim}</span></button>
                    : <button className="dh-chest done" onClick={() => { setPage("studio"); setStudioView("menu"); }}>🎮<span>{lc.dhPlay}</span></button>}
                </div>
                {homework && homework.text && (
                  <div className="hwbar">
                    <span className="hwbar-ic">📝</span>
                    <span className="hwbar-tx"><b>{lc.hwLabel}</b> {homework.text}</span>
                    <button className="hwbar-done" onClick={() => { setHomeworkLS(null); setHomework(null); playUi("reward"); earnCoins(10); }} aria-label="done">✓</button>
                  </div>
                )}
              </div>
            );
          })()}
          {/* My Stats + Report Card live as sub-pages of Profile (moved out of the nav) */}
          <button className="tdstep" style={{ width: "calc(100% - 28px)", margin: "0 14px 10px", cursor: "pointer", textAlign: "left" }}
            onClick={() => { playUi("click"); logUsage("nav", "profile-stats"); setPage("insights"); }}>
            <span className="tdico">📊</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tdlbl">{lc.navStats}</div>
              <div className="tdtag">{lang === "th" ? "กราฟการซ้อม · จุดที่ควรเก็บ · ช่วงเวลาที่ซ้อมบ่อย" : lang === "zh" ? "练习图表 · 待加强 · 常练时间" : "Practice charts · weak spots · best hours"}</div>
            </div>
            <span className="tdgo">→</span>
          </button>
          <button className="tdstep" style={{ width: "calc(100% - 28px)", margin: "0 14px 10px", cursor: "pointer", textAlign: "left" }}
            onClick={() => { playUi("click"); logUsage("nav", "profile-report"); setPage("report"); }}>
            <span className="tdico">🏅</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tdlbl">{lc.navReport}</div>
              <div className="tdtag">{lang === "th" ? "สรุปรายสัปดาห์ · คำติชมครู · ใบประกาศนียบัตร" : lang === "zh" ? "每周总结 · 老师评语 · 证书" : "Weekly summary · teacher comment · certificates"}</div>
            </div>
            <span className="tdgo">→</span>
          </button>
          <ProfilePage lang={lang} session={session} profile={profile} onSignOut={onSignOut} coins={coins}
            onOpenShop={() => setShopOpen(true)} onOpenHelp={() => setHelpOpen(true)} />
        </div>
      )}

      {/* ─── PAGE: COACH (Max plan) ─── */}
      {page === "coach" && <CoachPage lang={lang} profile={profile} onNavigate={handleCoachNavigate} />}

      {/* ─── PAGE: SENSEI (default) ─── */}
      {page === "sensei" && (
        <>
          {activeStageId && (
            <button className="senseiback" onClick={() => { playUi("click"); setPage("pathway"); }}>
              <span>←</span> {lc.backChangeKey}
            </button>
          )}
          {(() => {
            const rec = recommendNext();
            return (
              <button className="dailyrec" onClick={rec.fn}>
                <span className="dailyrec-lbl">{lc.recFor}</span>
                <span className="dailyrec-ic">{rec.icon}</span>
                <span className="dailyrec-txt">{rec.label}</span>
                <span className="dailyrec-go">→</span>
              </button>
            );
          })()}
          <div className="pw">
            <div className="plblrow">
              <span className="plbl">{lc.pianoLabel}</span>
              <div className="octctl" title={lc.octaveHint}>
                <button className="octbtn" onClick={() => setPianoOct(o => Math.max(2, o - 1))} disabled={pianoOct <= 2} aria-label="Octave down">◀</button>
                <span className="octlbl">C{pianoOct}–B{pianoOct + 1}</span>
                <button className="octbtn" onClick={() => setPianoOct(o => Math.min(5, o + 1))} disabled={pianoOct >= 5} aria-label="Octave up">▶</button>
              </div>
              <button className="replaybtn" onClick={replayLast} title={lc.replay} aria-label={lc.replay}>
                <span className="replayicon">↻</span>
                <span>{lc.replay}</span>
              </button>
            </div>
            {seqIsChord && (
              <div className="chordstylerow">
                <button className={`chordstylebtn${chordStyle === "broken" ? " on" : ""}`} onClick={() => chordStyle !== "broken" && toggleChordStyle()}>{lc.chordBroken}</button>
                <button className={`chordstylebtn${chordStyle === "block" ? " on" : ""}`} onClick={() => chordStyle !== "block" && toggleChordStyle()}>{lc.chordBlock}</button>
              </div>
            )}
            <Piano litNote={litNote} litSet={litSet} fingerMap={fingerMap} baseOct={pianoOct} onNote={handleMainKey} />
            <div className="recbar">
              <button className={`recbtn${recording ? " on" : ""}`} onClick={toggleRecord}>
                {recording ? `■ ${lc.recStop}` : `● ${lc.recRecord}`}
              </button>
              {hasSeq && <button className="recbtn" onClick={togglePlayPause} title={seqPlaying ? lc.demoPause : lc.demoPlay}>
                {seqPlaying ? "⏸" : "▶"} {seqPlaying ? lc.demoPause : lc.demoPlay}
              </button>}
              {hasClip && !recording && <button className="recbtn ghost" onClick={playClip} disabled={playingClip}>
                ▶ {playingClip ? lc.recPlaying : lc.recPlay}
              </button>}
              {hasClip && !recording && <button className="recbtn ai" onClick={critiqueRecording}>
                🎓 {lc.recCritique}
              </button>}
              {recording && <span className="recdot">● REC</span>}
            </div>

            {/* persistent fingering chart — shows finger numbers for current hand */}
            {fingerChart && fingerChart.notes.some(p => p.finger != null) && (
              <div className="fchart">
                <div className="fchart-head">
                  <span className="fchart-title">{lc.fingerLabel}</span>
                  <span className="fchart-key">{fingerChart.label}</span>
                </div>
                <div className="fchart-row" style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
                  {fingerChart.notes.map((p, i) => (
                    <div key={i} className="fchart-cell" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flexShrink: 0, minWidth: "34px" }}>
                      <span className="fchart-finger" style={{ background: hand === "left" ? "#d97757" : "#ff5252" }}>{p.finger != null ? p.finger : "·"}</span>
                      <span className="fchart-note">{p.note.replace(/[45]/, "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="handsel" style={{ display: "flex", gap: "10px", marginTop: "10px", padding: "0 2px" }}>
              <button className={`handbtn${hand === "left" ? " on" : ""}`}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                onClick={() => setHand("left")} title={lc.leftHand} aria-label={lc.leftHand} aria-pressed={hand === "left"}>
                <svg className="handsvg" width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M11 14V7.5a1.8 1.8 0 0 1 3.6 0V13M14.6 13V6a1.8 1.8 0 0 1 3.6 0v7M18.2 13.5V8a1.8 1.8 0 0 1 3.6 0v8.5c0 4.5-2.6 8-7.4 8-3 0-4.6-1.2-6.4-3.6l-2.8-3.8a1.9 1.9 0 0 1 3-2.3l1.8 2V9a1.8 1.8 0 0 1 3.6 0v5"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="handlbl">{lc.leftHand}</span>
              </button>
              <button className={`handbtn${hand === "right" ? " on" : ""}`}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                onClick={() => setHand("right")} title={lc.rightHand} aria-label={lc.rightHand} aria-pressed={hand === "right"}>
                <span className="handlbl">{lc.rightHand}</span>
                <svg className="handsvg" width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0, transform: "scaleX(-1)" }}>
                  <path d="M11 14V7.5a1.8 1.8 0 0 1 3.6 0V13M14.6 13V6a1.8 1.8 0 0 1 3.6 0v7M18.2 13.5V8a1.8 1.8 0 0 1 3.6 0v8.5c0 4.5-2.6 8-7.4 8-3 0-4.6-1.2-6.4-3.6l-2.8-3.8a1.9 1.9 0 0 1 3-2.3l1.8 2V9a1.8 1.8 0 0 1 3.6 0v5"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <button className="practicebtn" disabled={!hasSeq} onClick={startPractice}
              title={hasSeq ? lc.practiceBtn : lc.practiceNoSeq}>
              {hasSeq ? lc.practiceBtn : lc.practiceNoSeq}
            </button>
          </div>
          <div className="cw">
            <div className="chdr">
              <div className="ailbl"><div className="dot" />{lc.aiLabel}</div>
              <button className="ebtn" onClick={() => setModal(true)}>{lc.expand}</button>
            </div>
            <div className="msgs">
              {msgs.map((m, i) => (
                <Msg key={i} m={m} idx={i} lang={lang}
                  activeSpk={activeSpk} setActiveSpk={setActiveSpk} onPlay={playSequence} />
              ))}
              {loading && <Typing />}
              <div ref={endRef} />
            </div>
            <div className="iw">
              <Input val={input} onChange={setInput} onSend={send} loading={loading} ph={lc.ph} />
              <div className="hint">{lc.hint}</div>
            </div>
          </div>
        </>
      )}

      {/* ─── SIDE DRAWER NAV (hamburger) ─── */}
      {navOpen && <div className="drawer-scrim" onClick={() => setNavOpen(false)} />}
      <nav className={`drawer${navOpen ? " open" : ""}`} aria-hidden={!navOpen}>
        <div className="drawer-brand">
          <div className="lbox">TG</div>
          <div>
            <div className="lname">TIGA.AI</div>
            <div className="lsub">v{APP_VER}</div>
          </div>
        </div>
        {[
          { p: "pathway", ic: "⬡", c: "#d97757", t: lc.navPath },
          { p: "sensei", ic: "◈", c: "#d97757", t: lc.navSensei },
          { p: "studio", sv: "menu", ic: "▶", c: "#d97757", t: lc.navStudio },
          { p: "videos", ic: "🎬", c: "#d97757", t: lc.navVideos },
          { p: "profile", ic: levelInfo((profile && profile.exp) || 0).tier.icon, c: levelInfo((profile && profile.exp) || 0).tier.c, t: lc.navProfile },
          { p: "coach", ic: "🎯", c: "#d97757", t: "Daily Mentor", locked: !isMaxPlan(plan) && !(profile && profile.is_admin) },
          // no "admin" entry here on purpose — /admin is reachable ONLY via the 5-tap
          // logo gesture + code (handleLogoTap/tryUnlock), never a visible nav link.
        ].map(it => {
          const isOn = it.p === "studio" ? (page === "studio" && studioView === it.sv) : page === it.p;
          return (
          <button key={it.p + (it.sv || "")} className={`draweritem${isOn ? " on" : ""}`} style={{ "--nav-c": it.c }}
            onClick={() => {
              playUi("click"); haptic(6);
              if (it.locked) { setNavOpen(false); setPricingOpen(true); return; }
              logUsage("nav", it.p + (it.sv ? "-" + it.sv : "")); stopPracticeListeners(); setPage(it.p); if (it.p === "studio") setStudioView(it.sv); setNavOpen(false);
            }}>
            <span className="drawericon" aria-hidden="true">{it.ic}</span>
            <span className="drawerlabel">{it.t}{it.locked && " 🔒"}</span>
            {isOn && <span className="drawerdot" />}
          </button>
          );
        })}
        <div className="drawer-foot">
          <button className="draweritem sub" onClick={() => { playUi("click"); setNavOpen(false); setPricingOpen(true); }}><span className="drawericon">✦</span><span className="drawerlabel">{premium ? lc.prManage : lc.upgrade}</span></button>
          <button className="draweritem sub" onClick={() => { playUi("click"); setNavOpen(false); setSettingsOpen(true); }}><span className="drawericon">⚙️</span><span className="drawerlabel">{lc.setTitle}</span></button>
          {onSignOut && <button className="draweritem sub" onClick={() => { playUi("click"); onSignOut(); }}><span className="drawericon">⏻</span><span className="drawerlabel">{lc.signOut}</span></button>}
        </div>
      </nav>

      {/* MODAL (sensei expanded) */}
      <div className={`mov${modal ? " open" : ""}`}>
        <div className="mhdr">
          <div className="mlbl"><div className="dot" />⤢ {lc.aiLabel}</div>
          <button className="cbtn" onClick={() => setModal(false)}>{lc.close}</button>
        </div>
        <div className="mpw"><Piano litNote={litNote} litSet={litSet} fingerMap={fingerMap} small /></div>
        <div className="mmsgs">
          {msgs.map((m, i) => (
            <Msg key={i} m={m} idx={i} lang={lang}
              activeSpk={activeSpk} setActiveSpk={setActiveSpk} onPlay={playSequence} />
          ))}
          {loading && <Typing />}
          <div ref={mendRef} />
        </div>
        <div className="miw">
          <Input val={input} onChange={setInput} onSend={send} loading={loading} ph={lc.ph} />
        </div>
      </div>

      {/* PRACTICE MODE overlay — listens to the learner and checks each note */}
      {practiceOpen && (
        <div className="practiceov">
          <div className="practicehdr">
            <div className="practicehtitle">
              {lc.practiceTitle}
              <small>{practiceLabel}</small>
            </div>
            <button className="cbtn" onClick={exitPractice}>{lc.close}</button>
          </div>
          <div className="practicebody">
            <div className={`practicesrc${practiceSrc && practiceSrc.type === "error" ? " err" : ""}`}>
              {!practiceSrc ? "…"
                : practiceSrc.type === "midi" ? lc.practiceMidi
                : practiceSrc.type === "mic"
                  ? (practiceTune != null ? `${lc.practiceMic} · 🎚 ${practiceTune > 0 ? "+" : ""}${practiceTune}¢` : lc.practiceMic)
                : lc.practiceMicErr}
            </div>

            {/* hand picker — finger numbers update to the correct hand */}
            <div className="handsel practicehand" style={{ maxWidth: "360px", margin: "12px auto 2px", justifyContent: "center" }}>
              <button className={`handbtn${hand === "left" ? " on" : ""}`}
                onClick={() => setHand("left")} aria-pressed={hand === "left"} title={lc.leftHand}>
                <span className="handlbl">{lc.leftHand}</span>
              </button>
              <button className={`handbtn${hand === "right" ? " on" : ""}`}
                onClick={() => setHand("right")} aria-pressed={hand === "right"} title={lc.rightHand}>
                <span className="handlbl">{lc.rightHand}</span>
              </button>
            </div>

            <Piano
              litNote={practiceTarget[practiceIdx] || null}
              fingerMap={practiceTarget[practiceIdx] != null && practiceFingers[practiceIdx] != null
                ? { [practiceTarget[practiceIdx]]: practiceFingers[practiceIdx] } : {}}
              onNote={(n) => practiceHandlerRef.current({ note: n, freq: null })} />

            <div className="practicenow">
              <div className="practicenow-box">
                <div className="practicenow-lbl">{lc.practicePlay}</div>
                <div className="practicenow-note target">
                  {practiceTarget[practiceIdx] ? pcOf(practiceTarget[practiceIdx]) : "✓"}
                </div>
              </div>
              <div className="practicenow-box">
                <div className="practicenow-lbl">{lc.practiceHeard}</div>
                <div className={`practicenow-note heard${practiceHeard ? (practiceHeard.ok ? " ok" : " bad") : ""}`}>
                  {practiceHeard ? pcOf(practiceHeard.note) : "–"}
                </div>
              </div>
            </div>

            <div className="practicechips">
              {practiceTarget.map((n, i) => (
                <span key={i} className={`pchip${i < practiceIdx ? " done" : i === practiceIdx ? " cur" : ""}`}>
                  {pcOf(n)}
                </span>
              ))}
            </div>

            <div className="practicebar">
              <div className="practicefill" style={{ width: `${practiceTarget.length ? Math.round(practiceIdx / practiceTarget.length * 100) : 0}%` }} />
            </div>
            <div className="practicestats">
              <span>{lc.practiceAcc}: <b>{(practiceIdx + practiceMiss) > 0 ? Math.round(practiceIdx / (practiceIdx + practiceMiss) * 100) : 100}%</b></span>
              <span>✓ <b>{practiceIdx}</b> / {practiceTarget.length}</span>
            </div>

            <div className="practicetip">{lc.practiceHint}<br />{lc.practiceMicTip}</div>
          </div>
          <div className="practicefoot">
            <button className="practicerestart" onClick={restartPractice}>↻ {lc.practiceRestart}</button>
            <button className="practiceexit" onClick={exitPractice}>✕ {lc.practiceExit}</button>
          </div>
        </div>
      )}

      {/* PLAY-ALONG overlay — falling-notes song mode */}
      {songOpen && songMeta && (
        <div className="songov">
          <div className="songhdr">
            <div className="songhtitle">
              {tr(songMeta, lang)}<small>{"★".repeat(songMeta.diff)}</small>
            </div>
            <button className="cbtn" onClick={exitSong}>{lc.close}</button>
          </div>

          {songPhase === "playing" && (
            <>
              <div className="songhud">
                <span>{lc.songScore} <b>{songHud.score}</b></span>
                <span className={`combostat${songHud.combo >= 30 ? " t4" : songHud.combo >= 20 ? " t3" : songHud.combo >= 10 ? " t2" : songHud.combo >= 5 ? " t1" : ""}`}>
                  {lc.songCombo} <b>{songHud.combo}×</b>{songHud.combo >= 5 && <span className="comboflame">🔥</span>}
                </span>
                <span>{lc.practiceAcc} <b>{songHud.acc}%</b></span>
                {songGhost && <span className={`ghoststat ${songGhost.diff >= 0 ? "ahead" : "behind"}`}>👻 {songGhost.diff >= 0 ? "▲" : "▼"}{Math.abs(songGhost.diff)}</span>}
              </div>
              <div className="songprog"><div style={{ width: songHud.progress + "%" }} /></div>
            </>
          )}

          {songPhase !== "done" && (
            <div className={`songstage${songShake ? " shake" : ""}${songFever ? " fever" : ""}`}>
              {songFever && <div className="feverbg" />}
              <canvas ref={songCanvasRef} className="songcanvas" />
              {songCountdown != null && <div className="songcount" key={songCountdown}>{songCountdown}</div>}
              {songGo && <div className="songgo">GO!</div>}
              {songFever && <div className="feverbadge">🔥 FEVER ×2</div>}
              {songBonus && <div className="songbonus" key={songBonus.id}>{lc.dhBonus} {songBonus.text}</div>}
              {songAnnounce && <div className="songannounce" key={songAnnounce.id}>{songAnnounce.text}</div>}
              {songPops.map(p => (
                <div key={p.id} className={`songpop${p.perfect ? " perfect" : ""}`} style={{ left: p.x + "%" }}>{p.text}</div>
              ))}
              {songJudge && <div className={`songjudge ${songJudge.kind}`} key={songJudge.id}>{songJudge.kind === "perfect" ? lc.judgePerfect : songJudge.kind === "good" ? lc.judgeGood : lc.judgeMiss}</div>}
              {songBursts.map(b => (
                <div key={b.id} className={`burst ${b.kind}`}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <i key={i} style={{ "--a": (i * 36) + "deg", "--d": (28 + (i % 3) * 14) + "px" }} />
                  ))}
                </div>
              ))}
              {songPhase === "ready" && (
                <div className="songready">
                  <div className="songready-info">{tr(songMeta, lang)} · {songDataRef.current ? songDataRef.current.total : 0} {lc.songNotes} · {songMeta.bpm} BPM</div>
                  <div className="songtempo">
                    {[0.75, 1, 1.25].map(tp => (
                      <button key={tp} className={`songtempobtn${songTempo === tp ? " on" : ""}`} onClick={() => setSongTempo(tp)}>{tp === 1 ? "1×" : tp + "×"}</button>
                    ))}
                  </div>
                  <div className="songready-btns">
                    <button className="songbtn ghost" onClick={previewSong}>▶ {lc.songPreview}</button>
                    <button className="songbtn go" onClick={startSongPlay}>▶ {lc.songStart}</button>
                  </div>
                  <div className="songsrc">{lc.songInputHint}</div>
                </div>
              )}
            </div>
          )}

          {songPhase === "playing" && (
            <>
              <GamePiano fullWidth litNote={songNextLit} onNote={(n) => songInputRef.current({ note: n, freq: null, source: "tap" })} />
              <div className="songsrcbar">
                {!songSrc ? "…" : songSrc.type === "midi" ? lc.practiceMidi : songSrc.type === "mic" ? lc.practiceMic : lc.practiceMicErr}
              </div>
            </>
          )}

          {songPhase === "done" && songResult && (
            <div className="songresult">
              {songResult.allPerfect ? <div className="songfc ap">✦ {lc.songAllPerfect} ✦</div>
                : songResult.fullCombo ? <div className="songfc">★ {lc.songFullCombo} ★</div> : null}
              {songResult.newBest && <div className="songnewbest">🏆 {lc.songNewBest}</div>}
              <div className="songstars">{"★".repeat(songResult.stars)}{"☆".repeat(3 - songResult.stars)}</div>
              <div className="songresult-acc"><CountUp value={songResult.acc} dur={700} />%</div>
              <div className="songresult-grid">
                <div><span>{lc.songScore}</span><b><CountUp value={songResult.score} /></b></div>
                <div><span>{lc.songBest}</span><b>{songResult.best}</b></div>
                <div><span>{lc.songMaxCombo}</span><b>{songResult.maxCombo}×</b></div>
                <div><span>✓</span><b>{songResult.hits}/{songResult.total}</b></div>
                <div><span>EXP</span><b>+{songResult.exp}</b></div>
                <div><span>🪙</span><b>+{songResult.coins}</b></div>
              </div>
              <div className="songanalysis">
                {songAnalysisBusy ? (
                  <div className="songanalysis-load">🎯 {lang === "th" ? "กำลังวิเคราะห์การเล่น..." : lang === "zh" ? "正在分析演奏..." : "Analyzing your run..."}</div>
                ) : songAnalysis ? (<>
                  <div className="songanalysis-hd">🎯 {lang === "th" ? "จุดที่ควรแก้" : lang === "zh" ? "需要改进的地方" : "What to fix"}</div>
                  <div className="songanalysis-weak">{songAnalysis.weakness}</div>
                  <ol className="songanalysis-steps">
                    {songAnalysis.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </>) : null}
              </div>
              <div className="songready-btns">
                <button className="songbtn ghost" onClick={exitSong}>↩ {lc.songBackList}</button>
                <button className="songbtn ghost" onClick={() => shareCard({ title: tr(songMeta, lang), big: songResult.acc + "%", sub: "★".repeat(songResult.stars) + "☆".repeat(3 - songResult.stars), lines: [`${lc.songScore}: ${songResult.score}`, `${lc.songCombo} ${songResult.maxCombo}×`] })}>📤 {lc.shareBtn}</button>
                <button className="songbtn go" onClick={startSongPlay}>↻ {lc.songRetry}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SIGHT-READING overlay */}
      {sightOpen && (
        <div className="practiceov sightov">
          <div className="practicehdr">
            <div className="practicehtitle">{lc.sightTitle}<small>{lc.sightSub}</small></div>
            <button className="cbtn" onClick={exitSight}>{lc.close}</button>
          </div>
          <div className="practicebody">
            {sightDone ? (
              <div className="songresult">
                <div className="songstars">{"★".repeat(sightDone.acc >= 90 ? 3 : sightDone.acc >= 70 ? 2 : sightDone.acc >= 40 ? 1 : 0)}{"☆".repeat(3 - (sightDone.acc >= 90 ? 3 : sightDone.acc >= 70 ? 2 : sightDone.acc >= 40 ? 1 : 0))}</div>
                <div className="songresult-acc">{sightDone.acc}%</div>
                <div className="songresult-grid">
                  <div><span>{lc.sightScore}</span><b>{sightDone.correct}/{SIGHT_ROUND}</b></div>
                  <div><span>EXP</span><b>+{sightDone.reward}</b></div>
                </div>
                <div className="songready-btns">
                  <button className="songbtn ghost" onClick={exitSight}>↩ {lc.back}</button>
                  <button className="songbtn go" onClick={openSight}>↻ {lc.sightAgain}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="songhud">
                  <span>{lc.sightRoundLbl} <b>{Math.min(sightIdx + 1, SIGHT_ROUND)}/{SIGHT_ROUND}</b></span>
                  <span>{lc.sightScore} <b>{sightScore}</b></span>
                </div>
                <div className="clefsel">
                  {[["treble", lc.sightTreble, "𝄞"], ["bass", lc.sightBass, "𝄢"], ["both", lc.sightBoth, "𝄞𝄢"]].map(([m, label, gly]) => (
                    <button key={m} className={`clefbtn${sightClef === m ? " on" : ""}`} onClick={() => pickSightClef(m)} aria-pressed={sightClef === m}>
                      <span className="clefgly">{gly}</span>{label}
                    </button>
                  ))}
                </div>
                <div className={`staffwrap${sightFeedback ? (sightFeedback.ok ? " ok" : " bad") : ""}`}>
                  <StaffSVG note={sightTarget} clef={sightNoteClef} />
                </div>
                <div className={`sighthint${sightHint ? " show" : ""}`}>
                  {sightHint && sightTarget ? `${lc.sightAnswer}: ${pcOf(sightTarget)}` : lc.sightPrompt}
                </div>
                <Piano onNote={(n) => sightHandlerRef.current({ note: n, freq: null })} />
                <div className="songsrcbar">
                  {!sightSrc ? "…" : sightSrc.type === "midi" ? lc.practiceMidi : sightSrc.type === "mic" ? lc.practiceMic : lc.practiceMicErr}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* HAND-POSTURE COACH overlay (camera) */}
      {camOpen && (
        <div className="songov camov">
          <div className="songhdr">
            <div className="songhtitle">✋ {lc.camTitle}</div>
            <button className="cbtn" onClick={exitCamera}>{lc.close}</button>
          </div>
          <div className="camstage">
            <video ref={camVideoRef} className="camvideo" playsInline muted />
            <canvas ref={camCanvasRef} className="camcanvas" />
            {camStatus === "loading" && <div className="camoverlay">{lc.camLoading}</div>}
            {camStatus === "error" && (
              <div className="camoverlay err">
                <div>{lc.camError}</div>
                <button className="songbtn go" style={{ marginTop: 14 }} onClick={retryCamera}>↻ {lc.camRetry}</button>
              </div>
            )}
            {camStatus === "running" && camMsg && <div className="cammsg">{camMsg}</div>}
            {camCoach && (
              <div className="camcoach">
                {camCoach.loading ? <div className="camcoach-load">🎓 {lc.camCoachLoad}</div>
                  : <><div className="camcoach-hd">🎓 {lc.camCoachTitle}</div><div className="camcoach-tx">{camCoach.text}</div><button className="cbtn" onClick={() => setCamCoach(null)}>{lc.close}</button></>}
              </div>
            )}
          </div>
          <div className="camfoot">
            <div className="songsrcbar">{lc.camNote}</div>
            <div className="camfoot-btns">
              <button className="songbtn go" onClick={analyzeHands} disabled={camStatus !== "running" || (camCoach && camCoach.loading)}>🎓 {lc.camCoachBtn}{!premium && " 🔒"}</button>
              <button className="songbtn ghost" onClick={exitCamera}>✕ {lc.camStop}</button>
            </div>
          </div>
        </div>
      )}

      {/* AI VOICE TUTOR overlay */}
      {vmOpen && (
        <div className="songov vmov">
          <div className="songhdr">
            <div className="songhtitle">🎙️ {lc.vmTitle} <small style={{ color: "#d97757" }}>AI</small></div>
            <div className="vmhdrbtns">
              <div className="flagwrap" onClick={e => e.stopPropagation()}>
                <button className="flagbtn" onClick={() => setVmLangOpen(o => !o)}
                  aria-label="Language" aria-expanded={vmLangOpen} title={lc.vmLangHint}>
                  <span>{FLAGS[lang]}</span>
                  <span className="caret">{vmLangOpen ? "▲" : "▼"}</span>
                </button>
                {vmLangOpen && (
                  <div className="flagmenu">
                    {["th", "en", "zh"].map(lg => (
                      <button key={lg} className={`flagitem${lang === lg ? " active" : ""}`}
                        onClick={() => { setLang(lg); setVmLangOpen(false); playUi("click"); }}>
                        <span>{FLAGS[lg]}</span>
                        <span className="fn">{FLAG_NAMES[lg]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="cbtn" onClick={exitVoice}>{lc.close}</button>
            </div>
          </div>
          {vmState === "error" ? (
            <div className="camoverlay err" style={{ position: "static", flex: 1 }}>{vmErr || lc.vmNoSTT}</div>
          ) : (
            <>
              <div className="vmstage">
                <button className={`vmorb ${vmState}`} onClick={vmOrbTap}
                  title={(vmState === "speaking" || vmState === "thinking") ? lc.vmTapStop : vmState === "listening" ? lc.vmReListen : ""}>
                  {vmState === "speaking" ? "🔊" : vmState === "thinking" ? "💭" : vmState === "listening" ? "🎤" : "🎙️"}
                  {vmInstant && <span className={`vminstant ${vmInstant.ok ? "ok" : "bad"}`} key={vmInstant.id}>{vmInstant.ok ? "✓" : "✗"}</span>}
                </button>
                <div className="vmstate">
                  {(vmState === "speaking" || vmState === "thinking") ? lc.vmTapStop
                    : vmState === "listening" ? lc.vmListening : lc.vmReady}
                </div>
                <div className="vmcaption">{vmCaption}</div>
                {vmStaff && vmStaff.length > 0 && <div className="vmstaff"><StaffNotes notes={vmStaff} /></div>}
                {vmNotes.length > 0 && <div className="vmnotes">{vmNotes.map((n, i) => <span key={i} className="vmnote">{n}</span>)}</div>}
              </div>
              <div className="vmlog">
                {vmMsgs.map((m, i) => <div key={i} className={`vmbub ${m.role === "user" ? "user" : "ai"}`}>{m.text}</div>)}
                <div ref={vmEndRef} />
              </div>
              <GamePiano litSet={vmLit} scroll onNote={(n) => vmOnNote({ note: n, freq: null, source: "tap" })} />
              <div className="vmfoot">
                {/* ⋯ all secondary controls live here now — one tidy button, bottom-right */}
                <div className="vmmorewrap" onClick={e => e.stopPropagation()}>
                  {vmMenuOpen && (
                    <div className="vmmenu">
                      <div className="vmspeed">
                        <span className="vmspeed-lbl">{lc.vmSpeedLbl}</span>
                        {[1, 1.25, 1.5, 1.75, 2].map(s => (
                          <button key={s} className={`vmspeed-b${vmSpeed === s ? " on" : ""}`}
                            onClick={() => { setVmSpeed(s); vmSpeedRef.current = s; playUi("click"); }}>{s}x</button>
                        ))}
                      </div>
                      <div className="vmspeed">
                        <span className="vmspeed-lbl">{lc.vmVoiceLbl}</span>
                        {VM_VOICES.map(v => (
                          <button key={v.k} className={`vmspeed-b${vmVoice === v.k ? " on" : ""}`}
                            onClick={() => { setVmVoice(v.k); try { localStorage.setItem("tg_vmvoice", v.k); } catch (e) {} playUi("click"); }}>{v[lang] || v.en}</button>
                        ))}
                      </div>
                      <button className="vmvoicetgl" onClick={() => { const v = !vmFast; setVmFast(v); vmFastRef.current = v; if (!v) vmCloudDeadRef.current = false; }}>
                        {vmFast ? `⚡ ${lc.vmFastVoice}` : `🎙️ ${lc.vmHqVoice}`}
                      </button>
                      <button className={`vmvoicetgl${vmPoly ? " on" : ""}`} title={lc.vmPolyHint} onClick={vmTogglePoly}>
                        {vmPoly ? lc.vmPolyOn : lc.vmPolyOff}
                      </button>
                    </div>
                  )}
                  <button className="vmmore" aria-label={lc.vmSettings} title={lc.vmSettings} aria-expanded={vmMenuOpen}
                    onClick={() => { playUi("click"); setVmMenuOpen(o => !o); }}>⋯</button>
                </div>
                <form className="vmtextrow" onSubmit={(e) => {
                  e.preventDefault();
                  const t = vmInput.trim(); if (!t) return;
                  setVmInput("");
                  vmEarResetRef.current(); // typed message supersedes whatever the ear half-heard (ear stays hot)
                  if (!vmActiveRef.current) { vmActiveRef.current = true; getAC(); }
                  vmProcess(t);
                }}>
                  <input className="vmtextin" value={vmInput} onChange={(e) => setVmInput(e.target.value)} placeholder={lc.vmTypePh} aria-label={lc.vmTypePh} />
                  <button className="vmtextsend" type="submit" aria-label="send">➤</button>
                </form>
                <div className="songsrcbar">{lc.vmHint}</div>
                <button className={`vmbig${vmState !== "idle" && vmState !== "error" ? " stop" : ""}`} onClick={vmToggle}>
                  {vmState !== "idle" && vmState !== "error" ? `■ ${lc.vmStop}` : `● ${lc.vmStart}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* PRICING / UPGRADE */}
      {pricingOpen && (
        <div className="setov" onClick={() => setPricingOpen(false)}>
          <div className="setcard pricing" onClick={e => e.stopPropagation()}>
            <div className="sethdr"><span>✦ {lc.prTitle}</span><button className="cbtn" onClick={() => setPricingOpen(false)}>{lc.close}</button></div>
            <div className="setbody">
              <p className="pr-sub">{lc.prSub}</p>
              {(() => {
                const yr = billCycle === "year";
                const priceBlk = (tier) => yr
                  ? <span className="prtier-price">฿{yearPrice(tier).toLocaleString()}<small>/{lc.prYear}</small></span>
                  : <span className="prtier-price">฿{PLAN_PRICE[tier].toLocaleString()}<small>/{lc.prMonth}</small></span>;
                const saveLine = (tier) => yr ? <div className="pr-yrsave">💚 {lc.prSave3} · ≈ ฿{Math.round(yearPrice(tier) / 12).toLocaleString()}/{lc.prMonth}</div> : null;
                const buyBtn = (tier) => plan === tier
                  ? <button className="songbtn" disabled>✓ {lc.prCurrent}</button>
                  : <button className="songbtn go" onClick={() => startCheckout(tier, yr ? "year" : "month")}>{plan === "free" ? lc.prGet : lc.prSwitch}</button>;
                return (
                  <>
                    <div className="billtoggle">
                      <button className={`billtog${!yr ? " on" : ""}`} onClick={() => setBillCycle("month")}>{lc.prBillMonth}</button>
                      <button className={`billtog${yr ? " on" : ""}`} onClick={() => setBillCycle("year")}>{lc.prBillYear} <span className="billsave">-3%</span></button>
                    </div>
                    <div className={`prtier hot${plan === "premium" ? " cur" : ""}`}>
                      <div className="prtier-top"><span className="prtier-nm">⭐ Premium</span>{priceBlk("premium")}</div>
                      {saveLine("premium")}
                      <ul className="prfeat"><li>✓ {lc.prF1}</li><li>✓ {lc.prF2}</li><li>✓ {lc.prF3}</li><li>✓ {lc.prF4}</li><li>✓ {lc.prF5}</li></ul>
                      {buyBtn("premium")}
                    </div>
                    {!yr && (
                      <div className={`prtier${plan === "family" ? " cur" : ""}`}>
                        <div className="prtier-top"><span className="prtier-nm">👨‍👩‍👧 Family</span><span className="prtier-price">฿2,900<small>/{lc.prMonth}</small></span></div>
                        <ul className="prfeat"><li>✓ {lc.prFam1}</li><li>✓ {lc.prFam2}</li></ul>
                        {buyBtn("family")}
                      </div>
                    )}
                    <div className={`prtier max${plan === "max" ? " cur" : ""}`}>
                      <div className="prtier-top"><span className="prtier-nm">👑 Max</span>{priceBlk("max")}</div>
                      {saveLine("max")}
                      <ul className="prfeat"><li>✓ {lc.prMax1}</li><li>✓ {lc.prMax2}</li><li>✓ {lc.prMax3}</li><li>✓ {lc.prMax4}</li></ul>
                      {buyBtn("max")}
                    </div>
                    <div className={`prtier maxfam${plan === "maxfamily" ? " cur" : ""}`}>
                      <div className="prtier-top"><span className="prtier-nm">👑👨‍👩‍👧 Max Family</span>{priceBlk("maxfamily")}</div>
                      {saveLine("maxfamily")}
                      <ul className="prfeat"><li>✓ {lc.prMxf1}</li><li>✓ {lc.prMxf2}</li><li>✓ {lc.prMxf3}</li></ul>
                      {buyBtn("maxfamily")}
                    </div>
                    <div className={`prtier free${plan === "free" ? " cur" : ""}`}>
                      <div className="prtier-top"><span className="prtier-nm">🎁 Free</span><span className="prtier-price">฿0</span></div>
                      <ul className="prfeat"><li>✓ {lc.prFree1}</li><li>✓ {lc.prFree2}</li></ul>
                      {plan !== "free" && <button className="songbtn ghost" onClick={() => choosePlan("free")}>{lc.prDowngrade}</button>}
                    </div>
                  </>
                );
              })()}
              <div className="pr-note">{lc.prNote}</div>
              <button className="pr-school" onClick={() => { setPricingOpen(false); reviewSchools(); }}>🏫 {lc.prSchool}</button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT — PromptPay QR + slip upload */}
      {checkout && <CheckoutModal lang={lang} checkout={checkout} payCfg={payCfg} session={session} isAdmin={!!(profile && profile.is_admin)} onClose={() => setCheckout(null)} />}

      {/* FREE-TIER SHARE GATE — share FB + TikTok to keep playing */}
      {shareGate && <ShareGate lang={lang} onClose={() => setShareGate(false)}
        onUnlock={() => { setSharedUnlock(); setShareGate(false); playUi("levelup"); mascot("celebrate", 2400); }}
        onUpgrade={() => { setShareGate(false); setPricingOpen(true); }} />}

      {/* PARENT DASHBOARD (premium) */}
      {parentOpen && (() => {
        const plog = readPracticeLog(), mem = readMemory(), st = readStreak(), wk = readWeekly();
        const li = levelInfo((profile && profile.exp) || 0);
        const meta = (session && session.user && session.user.user_metadata) || {};
        const nm = (profile && profile.full_name) || meta.full_name || meta.name || "TiGA";
        let sess = 0, accSum = 0, accN = 0;
        for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); const e = plog[dayKey(d)]; if (e) { sess += e.n; accSum += e.accSum; accN += e.n; } }
        const wkAcc = accN ? Math.round(accSum / accN) : 0;
        const heat = [];
        for (let i = 41; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const n = plog[dayKey(d)] ? plog[dayKey(d)].n : 0; heat.push(n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3); }
        return (
          <div className="setov" onClick={() => setParentOpen(false)}>
            <div className="setcard pricing" onClick={e => e.stopPropagation()}>
              <div className="sethdr"><span>👨‍👩‍👧 {lc.pdTitle}</span><button className="cbtn" onClick={() => setParentOpen(false)}>{lc.close}</button></div>
              <div className="setbody">
                <div className="pd-head">{li.tier.icon} <b>{nm}</b> · {lc.profLevelWord} {li.level} · {tr(li.tier, lang)}</div>
                <div className="pd-stats">
                  <div className="pd-stat"><div className="pd-num">{st.count || 0}🔥</div><div className="pd-lbl">{lc.dhStreak}</div></div>
                  <div className="pd-stat"><div className="pd-num">{sess}</div><div className="pd-lbl">{lc.pdSessions}</div></div>
                  <div className="pd-stat"><div className="pd-num">{wkAcc}%</div><div className="pd-lbl">{lc.pdAcc}</div></div>
                  <div className="pd-stat"><div className="pd-num">{(profile && profile.lessons_done) || 0}</div><div className="pd-lbl">{lc.profLessonsStat}</div></div>
                </div>
                <div className="pd-sec">{lc.pdActivity}</div>
                <div className="heatgrid" style={{ gridTemplateRows: "repeat(7,1fr)" }}>
                  {heat.map((l, i) => <div key={i} className="heatcell" style={{ background: heatColor(l) }} />)}
                </div>
                {mem.struggles && mem.struggles.length > 0 && <><div className="pd-sec">{lc.pdFocus}</div><div className="pd-tags">{mem.struggles.slice(0, 5).map((s, i) => <span key={i} className="pd-tag focus">{s.label}</span>)}</div></>}
                {mem.mastered && mem.mastered.length > 0 && <><div className="pd-sec">{lc.pdMastered}</div><div className="pd-tags">{mem.mastered.slice(0, 6).map((s, i) => <span key={i} className="pd-tag good">{s}</span>)}</div></>}
                <button className="songbtn ghost" style={{ width: "100%", marginTop: 14 }} onClick={() => shareCard({ title: nm, big: (st.count || 0) + "🔥", sub: lc.profLevelWord + " " + li.level, lines: [`${sess} ${lc.pdSessions} · ${wkAcc}% ${lc.pdAcc}`] })}>📤 {lc.shareBtn}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* GRADE EXAM PREP (premium) */}
      {examOpen && (
        <div className="setov" onClick={() => setExamOpen(false)}>
          <div className="setcard pricing" onClick={e => e.stopPropagation()}>
            <div className="sethdr"><span>🎓 {lc.exTitle}</span><button className="cbtn" onClick={() => setExamOpen(false)}>{lc.close}</button></div>
            <div className="setbody">
              <p className="pr-sub">{lc.exSub}</p>
              {EXAM_GRADES.map(g => {
                const done = examProgress[g.id] || [];
                const pct = Math.round(done.length / g.tasks.length * 100);
                return (
                  <div key={g.id} className="exgrade">
                    <div className="exgrade-top"><b>{tr(g, lang)}</b><span>{done.length}/{g.tasks.length}</span></div>
                    <div className="wkbar"><div style={{ width: pct + "%" }} /></div>
                    <div className="extasks">
                      {g.tasks.map((tk, i) => {
                        const ok = done.includes(i);
                        return <button key={i} className={`extask${ok ? " ok" : ""}`} onClick={() => toggleExamTask(g.id, i)}>
                          <span>{ok ? "✓" : "○"}</span> {tr(tk, lang)}
                        </button>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS / TOOLS overlay */}
      {settingsOpen && (
        <div className="setov" onClick={() => setSettingsOpen(false)}>
          <div className="setcard" onClick={e => e.stopPropagation()}>
            <div className="sethdr">
              <span>⚙️ {lc.setTitle}</span>
              <button className="cbtn" onClick={() => setSettingsOpen(false)}>{lc.close}</button>
            </div>
            <div className="setbody">
              <div className="setrow">
                <label>{mode === "light" ? "☀️" : "🌙"} {lang === "th" ? "โหมดสี" : lang === "zh" ? "配色模式" : "Color mode"}</label>
                <div className="setlangs" style={{ flex: "0 0 auto", width: "auto" }}>
                  <button className={`setlangbtn${mode === "dark" ? " on" : ""}`} onClick={() => { const m = "dark"; setMode(m); setEquipLS("mode", m); }}>🌙 {lang === "th" ? "มืด" : lang === "zh" ? "深色" : "Dark"}</button>
                  <button className={`setlangbtn${mode === "light" ? " on" : ""}`} onClick={() => { const m = "light"; setMode(m); setEquipLS("mode", m); }}>☀️ {lang === "th" ? "สว่าง" : lang === "zh" ? "浅色" : "Light"}</button>
                </div>
              </div>
              <div className="setdiv" />
              <div className="setrow">
                <label>🔊 {lc.setVolume}</label>
                <input type="range" min="0" max="100" value={Math.round(sfxVol * 100)}
                  onChange={e => { const v = +e.target.value / 100; setSfxVol(v); setSfxVolState(v); }} />
              </div>
              <div className="setrow">
                <label>{lc.setMute}</label>
                <button className={`settoggle${sfxMuted ? " on" : ""}`} onClick={() => { const m = !sfxMuted; setSfxMuted(m); setSfxMutedState(m); }}>
                  {sfxMuted ? lc.setOn : lc.setOff}
                </button>
              </div>
              <div className="setrow">
                <label>🎶 {lc.setAmbient}</label>
                <button className={`settoggle${ambientOn ? " on" : ""}`} onClick={() => { getAC(); setAmbientOn(o => !o); }}>
                  {ambientOn ? lc.setOn : lc.setOff}
                </button>
              </div>
              <div className="setrow">
                <label>⭐ Premium</label>
                <button className={`settoggle${premium ? " on" : ""}`} onClick={() => { const v = !premium; setPremiumLS(v); setPremium(v); const np = v ? (plan === "free" ? "premium" : plan) : "free"; setPlanLS(np); setPlan(np); }}>
                  {premium ? lc.setOn : lc.setOff}
                </button>
              </div>
              <button className="setbtn wide" style={{ width: "100%" }} onClick={() => { setSettingsOpen(false); premium ? setParentOpen(true) : setPricingOpen(true); }}>👨‍👩‍👧 {lc.pdTitle}{!premium && " 🔒"}</button>
              <div className="setdiv" />
              <div className="setrow">
                <label>🥁 {lc.setMetro}</label>
                <button className={`settoggle${metroOn ? " on" : ""}`} onClick={() => { getAC(); setMetroOn(o => !o); }}>
                  {metroOn ? lc.setOn : lc.setOff}
                </button>
              </div>
              <div className="setrow">
                <label>{lc.setBpm}: <b>{metroBpm}</b></label>
                <input type="range" min="40" max="208" value={metroBpm} onChange={e => setMetroBpm(+e.target.value)} />
              </div>
              <div className="setrow setbtns">
                <button className="setbtn" onClick={() => setMetroBpm(b => Math.max(40, b - 5))}>−5</button>
                <button className="setbtn wide" onClick={tapTempo}>{lc.setTap}</button>
                <button className="setbtn" onClick={() => setMetroBpm(b => Math.min(208, b + 5))}>+5</button>
              </div>
              {pushSupported() && (
                <div className="setrow">
                  <label>{lc.setPush}</label>
                  <button className={`settoggle${pushOn ? " on" : ""}`} onClick={togglePush}>
                    {pushOn ? lc.setOn : lc.setOff}
                  </button>
                </div>
              )}
              {isMaxPlan(plan) && (
                <div className="setrow col">
                  <label>🎯 Auto Teaching</label>
                  <div className="setlangs">
                    <button className={`setlangbtn${profile.auto_teach_interval_min === 0 ? " on" : ""}`}
                      onClick={() => saveAutoTeachInterval(0)}>{lang === "th" ? "ปิด" : lang === "zh" ? "关闭" : "Off"}</button>
                    {AUTO_TEACH_INTERVALS.map(m => (
                      <button key={m} className={`setlangbtn${profile.auto_teach_interval_min === m ? " on" : ""}`}
                        onClick={() => saveAutoTeachInterval(m)}>{m}{lang === "th" ? "น." : lang === "zh" ? "分" : "m"}</button>
                    ))}
                  </div>
                  <span className="setsub">{profile.auto_teach_interval_min == null
                    ? (lang === "th" ? `ตามค่าระบบ (ทุก ${autoTeachDefaultMin ?? AUTO_TEACH_FALLBACK_MIN} นาที)` : lang === "zh" ? `跟随系统默认（每 ${autoTeachDefaultMin ?? AUTO_TEACH_FALLBACK_MIN} 分钟）` : `Following the platform default (every ${autoTeachDefaultMin ?? AUTO_TEACH_FALLBACK_MIN} min)`)
                    : (lang === "th" ? "ครู AI จะแนะนำจุดอ่อนแบบสั้นๆ ตอนอยู่หน้าเส้นทางการเรียนรู้" : lang === "zh" ? "AI 会在你查看学习路径页面时提示薄弱环节" : "The AI coach flags a weak spot while you're on the Pathway page")}</span>
                </div>
              )}
              <div className="setdiv" />
              <div className="setrow col">
                <label>🌐 {lc.setLang}</label>
                <div className="setlangs">
                  {["th", "en", "zh"].map(lg => (
                    <button key={lg} className={`setlangbtn${lang === lg ? " on" : ""}`} onClick={() => setLang(lg)}>{FLAGS[lg]} {FLAG_NAMES[lg]}</button>
                  ))}
                </div>
              </div>
              {installEvt && (
                <>
                  <div className="setdiv" />
                  <button className="setbtn wide" style={{ width: "100%" }} onClick={doInstall}>📲 {lc.setInstall}</button>
                </>
              )}
              <div className="setver">TiGA AI v{APP_VER}</div>
            </div>
          </div>
        </div>
      )}

      {/* HELP — kid-friendly "how to use" (self-serve) */}
      {helpOpen && (
        <div className="chestov" onClick={() => setHelpOpen(false)}>
          <div className="setcard wlc" onClick={e => e.stopPropagation()}>
            <div className="wlc-title">❓ {lc.helpTitle}</div>
            <div className="wlc-tips">
              <div className="wlc-tip"><span>☰</span><b>{lc.help1}</b></div>
              <div className="wlc-tip"><span>🎹</span><b>{lc.help2}</b></div>
              <div className="wlc-tip"><span>🎙️</span><b>{lc.help3}</b></div>
              <div className="wlc-tip"><span>🎮</span><b>{lc.help4}</b></div>
              <div className="wlc-tip"><span>🔁</span><b>{lc.help5}</b></div>
            </div>
            <button className="vmbig" onClick={() => setHelpOpen(false)}>{lc.helpOk}</button>
          </div>
        </div>
      )}

      {/* WELCOME / first-run onboarding */}
      {welcomeOpen && (
        <div className="chestov" onClick={() => {}}>
          <div className="setcard wlc" onClick={e => e.stopPropagation()}>
            <div className="wlc-mascot">🎹</div>
            <div className="wlc-title">{lc.wlcTitle}</div>
            <div className="wlc-tips">
              <div className="wlc-tip"><span>🎹</span><b>{lc.wlcTip1}</b></div>
              <div className="wlc-tip"><span>🎮</span><b>{lc.wlcTip2}</b></div>
              <div className="wlc-tip"><span>🏆</span><b>{lc.wlcTip3}</b></div>
            </div>
            <button className="vmbig" onClick={() => { try { localStorage.setItem("tg_welcomed", "1"); } catch (e) {} setWelcomeOpen(false); getAC(); playUi("levelup"); mascot("celebrate", 2600); }}>{lc.wlcStart}</button>
          </div>
        </div>
      )}

      {/* COSMETICS SHOP */}
      {shopOpen && (
        <div className="setov" onClick={() => setShopOpen(false)}>
          <div className="setcard" onClick={e => e.stopPropagation()}>
            <div className="sethdr">
              <span>🛍️ {lc.shopTitle}</span>
              <span className="coinpill" style={{ marginLeft: "auto", marginRight: 10 }}>🪙 {coins}</span>
              <button className="cbtn" onClick={() => setShopOpen(false)}>{lc.close}</button>
            </div>
            <div className="setbody">
              <div className="shopsec">🎹 {lc.shopSkins}</div>
              <div className="shopgrid">
                {SHOP_SKINS.map(it => renderShopItem("skin", it, skin))}
              </div>
              <div className="shopsec">🎨 {lc.shopThemes}</div>
              <div className="shopgrid">
                {SHOP_THEMES.map(it => renderShopItem("theme", it, theme))}
              </div>
              <div className="shopsec">🖼️ {lc.shopFrames}</div>
              <div className="shopgrid">
                {SHOP_FRAMES.map(it => renderShopItem("frame", it, frame))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY CHEST modal */}
      {chestOpen && (
        <div className="chestov" onClick={() => { if (!chestOpening) setChestOpen(false); }}>
          <div className="chestcard" onClick={e => e.stopPropagation()}>
            <div className={`chestbig${chestOpening ? " opening" : " open"}`}>🎁</div>
            {chestReward ? (
              <>
                <div className={`chesttitle${chestReward.kind === "jackpot" ? " jackpot" : ""}`}>
                  {chestReward.kind === "jackpot" ? "🎉 JACKPOT! 🎉" : chestReward.kind === "big" ? "✨ " + lc.chestBig + " ✨" : lc.chestGot}
                </div>
                <div className="chestrewards">
                  <span>🪙 +{chestReward.coins}</span>
                  <span>✦ +{chestReward.exp} EXP</span>
                </div>
                <div className="cheststreak">🔥 {lc.chestDay} {chestReward.streak}</div>
                <button className="songbtn go" onClick={() => setChestOpen(false)}>{lc.chestClaim}</button>
              </>
            ) : (
              <div className="chesttitle">{lc.chestOpening}</div>
            )}
          </div>
        </div>
      )}

      {/* floating EXP reward toast */}
      {expToast && (
        <div className="exptoast" key={expToast.id}>
          <span aria-hidden="true">⚡</span>
          <span>+{expToast.amount} EXP</span>
        </div>
      )}

      {/* level-up celebration overlay */}
      {levelUp && (
        <div className="lvup">
          <div className="lvup-rays" aria-hidden="true" />
          <div className="confetti" aria-hidden="true">{Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ left: (i * 4.1) + "%", animationDelay: (i % 6 * 0.08) + "s", background: ["#d97757", "#ffd23f", "#6a9bcc", "#788c5d", "#ff5252"][i % 5] }} />)}</div>
          <div className="lvup-burst" aria-hidden="true">{levelUp.tier.icon}</div>
          <div className="lvup-title">{lc.levelUpWord}</div>
          <div className="lvup-rank">{lc.profLevelWord} {levelUp.level} · {tr(levelUp.tier, lang)}</div>
        </div>
      )}

      {/* achievement-unlock celebration overlay */}
      {badgeUp && !levelUp && (
        <div className="lvup lvup-badge">
          <div className="lvup-burst" aria-hidden="true">{badgeUp.icon}</div>
          <div className="lvup-title">{lc.badgeUnlocked}</div>
          <div className="lvup-rank">{tr(badgeUp, lang)}</div>
        </div>
      )}

      {showInstallBanner && (
        <div className="installbanner">
          <span className="installbanner-ic" aria-hidden="true">📲</span>
          <div className="installbanner-tx">
            <b>{lc.installBannerTitle}</b>
            <span>{lc.installBannerSub}</span>
          </div>
          <button className="installbanner-go" onClick={installFromBanner}>{lc.setInstall}</button>
          <button className="installbanner-x" onClick={dismissInstallBanner} aria-label="close">×</button>
        </div>
      )}
      {!showInstallBanner && showPushBanner && (
        <div className="installbanner">
          <span className="installbanner-ic" aria-hidden="true">🔥</span>
          <div className="installbanner-tx">
            <b>{lc.pushBannerTitle}</b>
            <span>{lc.pushBannerSub}</span>
          </div>
          <button className="installbanner-go" onClick={enablePushFromBanner}>{lc.pushBannerBtn}</button>
          <button className="installbanner-x" onClick={dismissPushBanner} aria-label="close">×</button>
        </div>
      )}

      {/* Admin broadcast — an announcement pushed on demand, shown once per device; takes
          priority over the Auto Teaching tip if both would otherwise be eligible at once. */}
      {broadcast && page === "pathway" && (
        <div className="atpopup" onClick={dismissBroadcast}>
          <div className="atpopup-card" onClick={e => e.stopPropagation()}>
            <div className="atpopup-hd">
              <span className="atpopup-ic" aria-hidden="true">📢</span>
              <div className="atpopup-tt">{lang === "th" ? "ประกาศจาก TiGA" : lang === "zh" ? "TiGA 公告" : "Announcement"}</div>
              <button className="atpopup-x" onClick={dismissBroadcast} aria-label="close">×</button>
            </div>
            {broadcast.image_url && (
              <img src={broadcast.image_url} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 10, display: "block" }}
                onError={e => { e.target.style.display = "none"; }} />
            )}
            <div className="atpopup-weak" style={{ whiteSpace: "pre-wrap" }}>{broadcast.message}</div>
            <button className="atpopup-ok" onClick={dismissBroadcast}>{lang === "th" ? "รับทราบ" : lang === "zh" ? "知道了" : "Got it"}</button>
          </div>
        </div>
      )}

      {/* Auto Teaching — real-time coaching card (Max plan, fires on a timer while on the Pathway page) */}
      {autoTeachTip && !(broadcast && page === "pathway") && (
        <div className="atpopup" onClick={() => setAutoTeachTip(null)}>
          <div className="atpopup-card" onClick={e => e.stopPropagation()}>
            <div className="atpopup-hd">
              <span className="atpopup-ic" aria-hidden="true">🎯</span>
              <div className="atpopup-tt">{lang === "th" ? "ครู TiGA แนะนำ" : lang === "zh" ? "TiGA老师建议" : "Coach TiGA's Tip"}</div>
              <button className="atpopup-x" onClick={() => setAutoTeachTip(null)} aria-label="close">×</button>
            </div>
            <div className="atpopup-weak">{autoTeachTip.weakness}</div>
            <ol className="atpopup-steps">
              {autoTeachTip.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { setAutoTeachTip(null); setPage("coach"); }}>
                {lang === "th" ? "ดูรายละเอียด" : lang === "zh" ? "查看详情" : "Details"}
              </button>
              <button className="atpopup-ok" style={{ flex: 1 }} onClick={() => setAutoTeachTip(null)}>{lang === "th" ? "เข้าใจแล้ว ลองเลย" : lang === "zh" ? "知道了，试试看" : "Got it, let's try"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
