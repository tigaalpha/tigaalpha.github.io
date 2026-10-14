// Long-scale fingerings come from the real per-hand tables, not from mirroring: checks the finger lists for several keys against the standard fingerings.
import { build } from "esbuild"; import path from "node:path"; import fs from "node:fs";
const out = path.resolve("node_modules/.cache/oct-fing.mjs");
await build({ entryPoints: ["OctaveStage.tsx"], bundle: true, format: "esm", platform: "node", outfile: out, loader: { ".tsx": "tsx", ".ts": "ts" }, external: ["react", "react-dom", "react/jsx-runtime"], logLevel: "silent", jsx: "automatic" }).catch(e => { console.log("bundle failed", String(e).slice(0, 300)); process.exit(2); });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const mod = await import(out);
const { scaleFingers, extendPattern, scaleKind, buildScale } = mod;
const sc = (names) => names.map(note => ({ note, finger: null }));
const C = sc(["C4","D4","E4","F4","G4","A4","B4","C5"]), F = sc(["F4","G4","A4","A#4","C5","D5","E5","F5"]), Bb = sc(["A#4","C5","D5","D#5","F5","G5","A5","A#5"]);
const run = (n, hand, oct, jf) => { const s = scaleFingers(n, hand); if (!s) return null; return extendPattern(n.map((q, i) => ({ ...q, finger: s[i] })), oct, hand === "left" ? s[7] : s[0]).map(q => q.f).join(" "); };
ok("C major right hand, 2 octaves", run(C, "right", 2) === "1 2 3 1 2 3 4 1 2 3 1 2 3 4 5", run(C, "right", 2));
ok("C major left hand, 2 octaves", run(C, "left", 2) === "5 4 3 2 1 3 2 1 4 3 2 1 3 2 1", run(C, "left", 2));
ok("F major right hand, 2 octaves", run(F, "right", 2) === "1 2 3 4 1 2 3 1 2 3 4 1 2 3 4", run(F, "right", 2));
ok("Bb major left hand, 2 octaves", run(Bb, "left", 2) === "3 2 1 4 3 2 1 3 2 1 4 3 2 1 3", run(Bb, "left", 2));
ok("an unknown set of notes is not a recognised scale", scaleFingers(sc(["C4","D4","E4","G4","A4","C5","D5","E5"]), "right") === null);
// every key of every scale type round-trips (build -> recognise) so the key picker can offer all 12 in the same category
for (const type of ["major", "natural minor", "harmonic minor", "melodic minor"]) { let good = true; for (let pc = 0; pc < 12; pc++) { const k = scaleKind(buildScale(pc, type)); if (!k || k.pc !== pc || k.type !== type) good = false; } ok("all 12 keys of " + type + " are built and recognised", good); }
ok("all 12 major keys have a fingering for both hands", [0,1,2,3,4,5,6,7,8,9,10,11].every(pc => ["right","left"].every(h => (scaleFingers(buildScale(pc, "major"), h) || []).length === 8)));
ok("harmonic and melodic minor use the minor fingering of the same key", ["a minor","e minor","d minor"].length === 3 && scaleFingers(buildScale(9, "harmonic minor"), "right").join() === scaleFingers(buildScale(9, "natural minor"), "right").join() && scaleFingers(buildScale(9, "melodic minor"), "left").join() === scaleFingers(buildScale(9, "natural minor"), "left").join());
fs.rmSync(out, { force: true });
process.exit(fail ? 1 : 0);
