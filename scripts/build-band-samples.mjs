#!/usr/bin/env node
/* build-band-samples.mjs — a ONE-TIME dev tool (needs the network). It fetches a few General MIDI instruments from the
   pre-rendered FluidR3_GM soundfont published by gleitz/midi-js-soundfonts, keeps only every STRIDE-th note inside a useful range
   (the sampler in band-samples.ts bends the nearest kept note by at most one semitone), and writes them as plain MP3 files into
   public/band-samples/<instrument>/<midi>.mp3 together with manifest.json and CREDITS.md. The app serves them from its own host;
   nothing is fetched from a third party at run time.

     node scripts/build-band-samples.mjs            (writes public/band-samples/)

   LICENCE: the soundfont is "Released under Creative Commons Attribution 3.0" according to the repository the files come from
   (https://github.com/gleitz/midi-js-soundfonts, FluidR3_GM, generated from FluidR3_GM.sf2). Attribution is required, so CREDITS.md
   is written next to the files and the app's credits line names it (see band-samples.ts `BAND_SAMPLES_CREDIT`).
   MP3, not OGG: Safari / iOS cannot decode Ogg Vorbis through decodeAudioData. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "band-samples");
const BASE = "https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/";
const STRIDE = 3;
// instrument file name -> [lowest, highest] MIDI note kept
const SET = {
  acoustic_bass: [28, 55],
  electric_bass_finger: [28, 55],
  string_ensemble_1: [48, 84],
  electric_piano_1: [48, 84],
  acoustic_guitar_nylon: [40, 76],
  brass_section: [48, 79],
  flute: [60, 93],
  orchestral_harp: [48, 90],
  pizzicato_strings: [48, 84],
};
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (n) => { const m = /^([A-G])([b#]?)(-?\d)$/.exec(n); if (!m) return -1; return (+m[3] + 1) * 12 + NAMES[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0); };

fs.mkdirSync(OUT, { recursive: true });
const manifest = { source: "FluidR3_GM via gleitz/midi-js-soundfonts, CC BY 3.0", stride: STRIDE, instruments: {} };
let total = 0;
for (const [inst, [lo, hi]] of Object.entries(SET)) {
  const url = BASE + inst + "-mp3.js";
  const res = await fetch(url);
  if (!res.ok) { console.error("FAILED", url, res.status); process.exit(1); }
  const text = await res.text();
  const re = /"([A-G][b#]?-?\d)"\s*:\s*"data:audio\/mp3;base64,([^"]+)"/g;
  const all = []; let m;
  while ((m = re.exec(text))) all.push([midiOf(m[1]), m[2]]);
  all.sort((a, b) => a[0] - b[0]);
  const dir = path.join(OUT, inst); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const kept = []; let bytes = 0;
  for (const [mid, b64] of all) {
    if (mid < lo || mid > hi || (mid - lo) % STRIDE !== 0) continue;
    const buf = Buffer.from(b64, "base64"); fs.writeFileSync(path.join(dir, mid + ".mp3"), buf); kept.push(mid); bytes += buf.length;
  }
  manifest.instruments[inst] = { notes: kept, bytes };
  total += bytes;
  console.log(inst.padEnd(24), String(all.length).padStart(3), "notes in the font,", String(kept.length).padStart(2), "kept,", (bytes / 1024).toFixed(0).padStart(5), "KB");
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest));
fs.writeFileSync(path.join(OUT, "CREDITS.md"), `# Band samples

Instrument samples for the Play Along backing band come from the **FluidR3_GM** General MIDI soundfont, as pre-rendered by
[gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (generated from FluidR3_GM.sf2).
That repository states: "Released under Creative Commons Attribution 3.0 license" (https://creativecommons.org/licenses/by/3.0/us/).

Only every ${STRIDE}rd note of a few instruments is kept (see manifest.json); the files were not otherwise processed.
Attribution: FluidR3_GM soundfont, via gleitz/midi-js-soundfonts, CC BY 3.0.
`);
console.log("total", (total / 1024 / 1024).toFixed(2), "MB in", Object.keys(SET).length, "instruments ->", OUT);
