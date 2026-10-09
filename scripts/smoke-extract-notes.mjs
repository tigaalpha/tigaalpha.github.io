// What the chat PRINTS and what the play chip PLAYS must be the same scale (owner report 2026-10-09). Runs the real extractNotes().
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const root = process.cwd();
const dir = path.join(root, "node_modules", ".smoke-pm"); mkdirSync(dir, { recursive: true });
const out = path.join(dir, "en.mjs");
await build({ entryPoints: [path.join(root, "music-engine.tsx")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error",
  external: ["react", "react-dom", "react/jsx-runtime"],
  plugins: [{ name: "stub", setup(b) {
    b.onResolve({ filter: /\?(url|raw|worker&url|worker)$/ }, (a) => ({ path: a.path, namespace: "asset" }));
    b.onLoad({ filter: /.*/, namespace: "asset" }, () => ({ loader: "js", contents: "export default '';" }));
  } }], define: { "import.meta.env": "{}" } });
const { extractNotes } = await import(out);
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const NAT_C = ["C4", "D4", "D#4", "F4", "G4", "G#4", "A#4", "C5"];
const screenshot = "🎼 ไมเนอร์ (Natural) สเกล (Scale) · C\n\nโน้ตทั้งหมด: C D E♭ F G A♭ B♭ C\nสูตรระยะห่าง: W-H-W-W-H-W-W\n\nไมเนอร์ธรรมชาติ — เทียบกับเมเจอร์คือลดขั้น 3, 6 และ 7";
let r = extractNotes(screenshot);
check("Thai natural-minor lesson plays C natural minor (the reported bug)", r && same(r.notes, NAT_C), r && r.label + " " + r.notes.join(","));
check("…and its chip no longer says MAJOR", r && /MINOR/.test(r.label) && !/MAJOR/.test(r.label), r && r.label);
r = extractNotes("🎼 ไมเนอร์ (Harmonic) สเกล (Scale) · C\nC D E♭ F G A♭ B C");
check("Thai harmonic minor raises the 7th (B natural)", r && same(r.notes, ["C4", "D4", "D#4", "F4", "G4", "G#4", "B4", "C5"]), r && r.notes.join(","));
r = extractNotes("🎼 ไมเนอร์ (Melodic) สเกล (Scale) · C\nขึ้น: C D E♭ F G A B C");
check("Thai melodic minor goes up raised and comes down natural", r && same(r.notes, ["C4", "D4", "D#4", "F4", "G4", "A4", "B4", "C5", "A#4", "G#4", "G4", "F4", "D#4", "D4", "C4"]), r && r.notes.join(","));
r = extractNotes("🎼 Major scale · D\nD E F# G A B C# D");
check("English major header still plays D major", r && same(r.notes, ["D4", "E4", "F#4", "G4", "A4", "B4", "C#5", "D5"]), r && r.notes.join(","));
r = extractNotes("🎼 自然小调 音阶 · A\nA B C D E F G A");
check("Chinese natural minor header plays A natural minor", r && same(r.notes, ["A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"]), r && r.notes.join(","));
r = extractNotes("🎼 Natural minor scale · Eb");
check("a flat root keeps its pitches (E♭ natural minor)", r && same(r.notes, ["D#4", "F4", "F#4", "G#4", "A#4", "B4", "C#5", "D#5"]), r && r.notes.join(","));
r = extractNotes("C major scale is bright and settled, nothing raised.");
check("plain prose about C major scale is still C major", r && same(r.notes, ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]), r && r.label);
r = extractNotes("ไมเนอร์ c scale คือเสียงเศร้า นุ่ม", "right", "scale");
check("a Thai minor answer with the scale hint now reads minor, not major", r && /MINOR/.test(r.label), r && r.label);
r = extractNotes("ไมเนอร์ธรรมชาติของ C สเกล\nโน้ตทั้งหมด: C D E♭ F G A♭ B♭ C\nเศร้า นุ่ม");
check("no header, but the printed notes are played as printed (C natural minor)", r && same(r.notes, NAT_C) && /NATURAL MINOR/.test(r.label), r && r.label + " " + r.notes.join(","));
r = extractNotes("A scale is a ladder of notes. A B C is not a scale, and neither is C D E.");
check("loose letters in prose are not mistaken for a scale", !r || !/NATURAL|HARMONIC|MELODIC/.test(r.label), r && r.label);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
