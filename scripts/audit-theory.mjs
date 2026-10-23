// Audits the app's hand-written music-theory tables against theory computed from first principles.
import fs from "node:fs";
const src = fs.readFileSync("music-engine.tsx", "utf8");
const grab = (name) => { const i = src.indexOf(`export const ${name}`); const j = src.indexOf("\n]", i); return eval("(" + src.slice(src.indexOf("[", i), j + 2) + ")"); };
const KNOWN = grab("KNOWN");
const PC = { c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11 };
const midi = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); const b = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); return 12 * (+m[3] + 1) + b; };
const FIX = { "pentatonic scale": [0,2,4,7,9], pentatonic: [0,2,4,7,9], "blues scale": [0,3,5,6,7,10], blues: [0,3,5,6,7,10], chromatic: [0,1,2,3,4,5,6,7,8,9,10,11] };
const SC = { major: [0, 2, 4, 5, 7, 9, 11], "natural minor": [0, 2, 3, 5, 7, 8, 10], "harmonic minor": [0, 2, 3, 5, 7, 8, 11], "melodic minor": [0, 2, 3, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const CH = { major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], diminished: [0, 3, 6], aug: [0, 4, 8], augmented: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], "7": [0, 4, 7, 10], dom7: [0, 4, 7, 10], dim7: [0, 3, 6, 9] };
let bad = 0, checked = 0, skipped = [];
for (const e of KNOWN) {
  const ms = e.n.map(midi); let m = /^([a-g][#b]?) (.+?) (scale|chord|arpeggio)$/.exec(e.k);
  if (!m) { const t = /^([a-g][#b]?) (major|maj|minor|min)$/.exec(e.k); if (t) m = [0, t[1], t[2].startsWith("maj") ? "major" : "minor", "chord"]; else { const u = /^([a-g]) scale$/.exec(e.k); if (u) m = [0, u[1], "major", "scale"]; } }
  if (!m && FIX[e.k]) { checked++; const d = FIX[e.k].concat([12]).map(x => x % 12); const g = ms.map(x => x % 12); if (g.join() !== d.join() || ms[0] % 12 !== 0) { bad++; console.log("FIXED MISMATCH", e.k, e.n.join(" ")); } continue; }
  if (!m) { skipped.push(e.k); continue; }
  const root = PC[m[1]]; let def = m[3] === "scale" ? SC[m[2]] : CH[m[2]] || CH[m[2].replace(" ", "")];
  if (!def) { skipped.push(e.k); continue; }
  checked++;
  if (m[3] === "scale") {
    const want = def.concat([12]).map(x => (root + x) % 12), got = ms.map(x => x % 12);
    const asc = ms.every((x, i) => i === 0 || x > ms[i - 1]);
    if (ms[0] % 12 !== root || got.join() !== want.join() || !asc) { bad++; console.log("SCALE MISMATCH", e.k, e.n.join(" "), "want pcs", want.join()); }
  } else {
    const want = new Set(def.map(x => (root + x) % 12)), got = new Set(ms.map(x => x % 12));
    if (want.size !== got.size || [...want].some(x => !got.has(x)) || ms[0] % 12 !== root) { bad++; console.log("CHORD MISMATCH", e.k, e.n.join(" ")); }
  }
}
console.log(`KNOWN: ${KNOWN.length} entries, ${checked} checked against theory, ${bad} mismatches, skipped ${skipped.length}:`, skipped.join(" | ").slice(0, 400));
process.exit(bad ? 1 : 0);
