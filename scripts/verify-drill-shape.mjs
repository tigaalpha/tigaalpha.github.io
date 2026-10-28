/* Every scale, triad and seventh-chord drill in Play Along must climb from the low tonic to the high tonic and come back down the
   same notes (melodic minor comes down as natural minor). Runs the REAL makeScaleSong / makeChordSong through esbuild. */
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "drill-"));
const out = new URL("../.drill-tmp.mjs", import.meta.url).pathname;
await build({ entryPoints: ["music-engine.tsx"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", external: ["react", "react-dom", "three", "*.css"], loader: { ".tsx": "tsx" }, define: { "import.meta.env": "{}" } });
globalThis.window = globalThis; globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, getElementById: () => null }; globalThis.localStorage = { getItem: () => null, setItem() {} };
const M = await import(out);
const CH = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const midi = (n) => { const m = n.match(/^([A-G]#?)(\d)$/); return (+m[2] + 1) * 12 + CH.indexOf(m[1]); };
let fail = 0; const bad = (m) => { fail++; console.log("FAIL " + m); };
const check = (s, name, expectDown) => {
  const n = s.seq.map((x) => midi(x[0]));
  const top = Math.max(...n), ti = n.indexOf(top);
  const up = n.slice(0, ti + 1), dn = n.slice(ti);
  if (!up.every((v, i) => i === 0 || v > up[i - 1])) bad(name + " does not strictly climb: " + n);
  if (!dn.every((v, i) => i === 0 || v < dn[i - 1])) bad(name + " does not strictly fall: " + n);
  if (n[0] !== n[n.length - 1]) bad(name + " does not end on the low tonic: " + n);
  if (top - n[0] !== 12) bad(name + " top is not an octave up: " + n);
};
for (const g of ["major", "natural minor", "harmonic minor", "melodic minor"]) {
  const list = g === "major" ? M.MAJOR_SCALE_SONGS : M.MINOR_SCALE_SONGS[g];
  for (const s of list) {
    check(s, s.en + " (" + g + ")");
    const n = s.seq.map((x) => midi(x[0])), c = (n.length - 1) / 2;
    const upSt = n.slice(0, c + 1).map((v) => v - n[0]);
    const exp = { major: [0,2,4,5,7,9,11,12], "natural minor": [0,2,3,5,7,8,10,12], "harmonic minor": [0,2,3,5,7,8,11,12], "melodic minor": [0,2,3,5,7,9,11,12] }[g];
    if (JSON.stringify(upSt) !== JSON.stringify(exp)) bad(s.en + " ascent intervals " + upSt);
    const dnSt = n.slice(c).map((v) => n[0] + 12 - v);
    const expD = g === "melodic minor" ? [0,2,4,5,7,9,10,12] : exp.map((v) => v === 12 ? 12 : v).slice().reverse().map((v) => 12 - v);
    const want = g === "melodic minor" ? [0,2,4,5,7,9,10,12] : [...exp].reverse().map((v) => 12 - v);
    if (JSON.stringify(dnSt) !== JSON.stringify(want)) bad(s.en + " descent " + dnSt + " want " + want);
  }
}
for (const t of Object.keys(M.TRIAD_SONGS)) for (const s of M.TRIAD_SONGS[t]) check(s, s.en);
for (const t of Object.keys(M.SEVENTH_SONGS)) for (const s of M.SEVENTH_SONGS[t]) check(s, s.en, "7");
console.log(fail ? fail + " FAIL" : "ALL PASS");
process.exit(fail ? 1 : 0);
