/* Every scale and chord the app can build, in every key, checked against music theory with an independent oracle:
   Play Along drills (makeScaleSong / makeChordSong) and what the chat / Teacher page play (extractNotes). */
import { build } from "esbuild";
const out = new URL("../.theory-tmp.mjs", import.meta.url).pathname;
await build({ entryPoints: ["music-engine.tsx"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", external: ["react", "react-dom", "three"], define: { "import.meta.env": "{}" } });
globalThis.window = globalThis; globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, getElementById: () => null }; globalThis.localStorage = { getItem: () => null, setItem() {} };
const M = await import(out);
const CH = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const midi = (n) => { const m = n.match(/^([A-G]#?)(\d)$/); return (+m[2] + 1) * 12 + CH.indexOf(m[1]); };
const SC = { major: [0,2,4,5,7,9,11], "natural minor": [0,2,3,5,7,8,10], "harmonic minor": [0,2,3,5,7,8,11], "melodic minor": [0,2,3,5,7,9,11] };
const DOWN = { ...SC, "melodic minor": SC["natural minor"] };
const CD = { major: [0,4,7], minor: [0,3,7], dim: [0,3,6], aug: [0,4,8], maj7: [0,4,7,11], min7: [0,3,7,10], "7": [0,4,7,10], dim7: [0,3,6,9] };
let fail = 0, n = 0; const bad = (m) => { fail++; console.log("FAIL " + m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rel = (arr) => arr.map((v) => v - arr[0]);
/* shape = up through the notes to the root an octave up, then the same notes back down to the start */
const shape = (steps) => [...steps, 12, ...[...steps].reverse()];
const names = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
// 1. Play Along drills
for (const t of Object.keys(SC)) for (const s of (t === "major" ? M.MAJOR_SCALE_SONGS : M.MINOR_SCALE_SONGS[t])) {
  n++; const m = s.seq.map((x) => midi(x[0]));
  const want = [...SC[t], 12, ...[...DOWN[t]].reverse()];
  if (!eq(rel(m), [...SC[t], 12, ...[...DOWN[t]].reverse().map((v) => v)].map((v, i) => i <= 7 ? v : v) ) && !eq(rel(m), want)) bad("drill " + s.en + " " + rel(m));
}
for (const t of Object.keys(CD)) for (const s of (M.TRIAD_SONGS[t] || M.SEVENTH_SONGS[t])) {
  n++; const m = s.seq.map((x) => midi(x[0]));
  if (!eq(rel(m), shape(CD[t]))) bad("chord drill " + s.en + " " + rel(m));
}
// 2. What the chat / Teacher page plays
const ROOTS = ["C","D♭","D","E♭","E","F","F♯","G","A♭","A","B♭","B"], ASC = { "D♭": "C#", "E♭": "D#", "F♯": "F#", "A♭": "G#", "B♭": "A#" };
const pc = (r) => names[ASC[r] || r];
for (const r of ROOTS) for (const [q, txt] of [["major", "major scale"], ["natural minor", "natural minor scale"], ["harmonic minor", "harmonic minor scale"], ["melodic minor", "melodic minor scale"]]) {
  n++; const x = M.extractNotes(`${r} ${txt}`, "right", "scale", r);
  if (!x || !x.notes) { bad("no scale for " + r + " " + q); continue; }
  const m = x.notes.map(midi);
  if (m[0] % 12 !== pc(r)) bad("wrong root " + r + " " + q);
  const want = [...SC[q], 12, ...[...DOWN[q]].reverse()];
  if (!eq(rel(m), want)) bad(`scale ${r} ${q}: ${rel(m)} want ${want}`);
  if (x.fingers && x.fingers.length !== m.length) bad(`fingers ${r} ${q}: ${x.fingers.length} for ${m.length} notes`);
}
const CT = [["major", "major chord"], ["minor", "minor chord"], ["dim", "diminished chord"], ["aug", "augmented chord"], ["maj7", "major 7th chord"], ["min7", "minor 7th chord"], ["7", "dominant 7th chord"], ["dim7", "diminished 7th chord"]];
for (const r of ROOTS) for (const [t, txt] of CT) {
  n++; const x = M.extractNotes(`${r} ${txt}`, "right", "chord", r);
  if (!x || !x.notes) { bad("no chord for " + r + " " + t); continue; }
  const m = x.notes.map(midi);
  if (m[0] % 12 !== pc(r)) bad("wrong chord root " + r + " " + t);
  const up = rel(m).slice(0, CD[t].length);
  if (!eq(up, CD[t])) bad(`chord ${r} ${t}: ${rel(m)} want start ${CD[t]}`);
}
if (process.env.SHOW) { for (const q of ["C major chord","G minor 7th chord","B diminished chord"]) { const x = M.extractNotes(q,"right","chord","C"); console.log(q, x && x.notes.join(" "), x && x.mode, x && x.fingers && x.fingers.join("")); } }
console.log(fail ? `${fail} FAIL of ${n} checks` : `ALL ${n} PASS`);
process.exit(fail ? 1 : 0);
