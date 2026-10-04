#!/usr/bin/env node
/* ── analyze-band-sound.mjs ── is the backing track beautiful? MEASURED.

   node scripts/analyze-band-sound.mjs            (table + the numbers)
   node scripts/analyze-band-sound.mjs --json     (machine readable)
   node scripts/analyze-band-sound.mjs --wav      (also write .wav per style)

   It renders the REAL play-along-band.ts offline (scripts/band-audio-lab.mjs),
   through the app's own bus, for real songs taken from songs-data.ts — the same
   songChordBars() the game feeds it — and reports:

     level        peak / RMS / crest, and how many samples clip
     balance      energy per band, sub → air, and the spectral centroid
     movement     RMS of every bar: does the song breathe, or sit flat?
     mask         how loud the band is inside ±1 semitone of each melody note
                 (the player has to hear themselves over it)
     room         the tail after the last note stops (the app's 1.5 s bus reverb)

   Nothing here is an opinion. The numbers go into tigamodel/docs/23 §11. */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadBand, renderBand, renderMelodyRef, render, measure, spectrum, bandMix, barCurve, melodyMask, melodyOctaveShare, windowDb, writeWav, db, SR } from "./band-audio-lab.mjs";

const JSON_OUT = process.argv.includes("--json");
const WAV_OUT = process.argv.includes("--wav");
const MAX_BARS = 8;                  // long enough to hear an arrangement, short enough to render every style

/* the app's own data, bundled so the analysis uses the same bars the game does */
const ME = "node_modules/.tmp-band/lab/me.js";
execSync(`npx esbuild music-engine.tsx --bundle --format=esm --platform=node --external:react --outfile=${ME}`, { stdio: "pipe" });
execSync(`npx esbuild songs-data.ts --bundle --format=esm --platform=node --outfile=node_modules/.tmp-band/lab/songs.js`, { stdio: "pipe" });

const me = await import(pathToFileURL(join(process.cwd(), ME)).href);
const { SONGS, SONG_GENRES, SONG_TIMESIG } = await import(pathToFileURL(join(process.cwd(), "node_modules/.tmp-band/lab/songs.js")).href);
const band = await loadBand();
const _PCI = me._PCI;

const noteMidi = (n) => {
  const m = /^([A-G][#b]?)(-?\d+)$/.exec(n);
  if (!m) return null;
  const pc = _PCI[m[1].toUpperCase().replace("B", "B")];
  if (pc == null) return null;
  return (parseInt(m[2], 10) + 1) * 12 + pc;
};
const beatsPerBarOf = (id) => parseInt(String(SONG_TIMESIG[id] || "4/4").split("/")[0], 10) || 4;
const melodyOf = (song) => {
  const out = [];
  let beat = 0;
  for (const [note, dur] of song.seq) {
    if (note !== "R") { const midi = noteMidi(note); if (midi != null) out.push({ beat, dur, midi }); }
    beat += dur;
  }
  return out;
};

/* one real song per style — the longest one with the fewest bars, so the
   excerpt stays musical and the render stays quick */
function pick(style, wantBpb) {
  const cands = SONGS.filter((s) => (style === "" ? true : SONG_GENRES[s.id] === style) && s.bpm && s.seq && s.seq.length > 8);
  const scored = cands.map((s) => {
    const bpb = beatsPerBarOf(s.id);
    const beats = s.seq.reduce((a, [, d]) => a + d, 0);
    return { s, bpb, bars: beats / bpb, fit: (wantBpb && bpb === wantBpb ? 100 : 0) - Math.abs(beats / bpb - 24) };
  }).filter((x) => (wantBpb ? x.bpb === wantBpb : true));
  scored.sort((a, b) => b.fit - a.fit);
  return scored[0] || null;
}

const STYLES = [
  { style: "", bpb: 4, label: "default (no style)" },
  { style: "classical", bpb: 3, label: "classical 3/4" },
  { style: "baroque", bpb: 4, label: "baroque" },
  { style: "romantic", bpb: 4, label: "romantic" },
  { style: "impressionism", bpb: 4, label: "impressionism" },
  { style: "jazz", bpb: 4, label: "jazz" },
  { style: "folk", bpb: 4, label: "folk" },
  { style: "kids", bpb: 4, label: "kids" },
  { style: "carol", bpb: 4, label: "carol" },
  { style: "gospel", bpb: 4, label: "gospel" },
  { style: "soul", bpb: 4, label: "soul" },
];

const rows = [];
for (const want of STYLES) {
  const got = pick(want.style, want.bpb);
  if (!got) { console.log(`skip ${want.style}: no song`); continue; }
  const song = got.s;
  const pickup = 0;
  let bars = me.songChordBars(song, pickup, { split: true, primary: true });
  if (bars.length > MAX_BARS) bars = bars.slice(0, MAX_BARS);
  const endBeat = bars[bars.length - 1].at + bars[bars.length - 1].len;
  const mel = melodyOf(song).filter((n) => n.beat < endBeat);
  const r = renderBand(band, {
    bars, bpb: got.bpb, pickup, bpm: song.bpm, style: want.style, hand: "right",
    level: 2, combo: 12, fever: false, lead: 0, mel,
  });
  /* the band's raw sum, before its own compressor: a level that does not depend
     on how exactly a browser's DynamicsCompressorNode behaves */
  const raw = renderBand(band, { bars, bpb: got.bpb, pickup, bpm: song.bpm, style: want.style, level: 2, combo: 12, lead: 0, mel });
  const comp = raw.ctx.nodes.find((n) => n.kind === "comp");
  if (comp) { comp.threshold.value = 0; comp.ratio.value = 1; }
  const rawBuf = render(raw.ctx, raw.songLen + 2.5);
  const ref = renderMelodyRef(mel, 60 / song.bpm, { lead: 0 });
  const spec = spectrum(r.wet, SR, 4096);
  const mix = bandMix(spec);
  const curve = barCurve(r.wet, SR, r.spb, r.bpb);
  const body = curve.slice(0, Math.min(8, curve.length));
  const roomT = r.songLen + 0.15;
  const row = {
    label: want.label,
    song: song.id, bpm: song.bpm, bpb: got.bpb, bars: bars.length,
    ...measure(r.wet),
    dryPeakDb: +measure(r.dry).peakDb.toFixed(1),
    dryRmsDb: +measure(r.dry).rmsDb.toFixed(1),
    rawPeakDb: +measure(rawBuf).peakDb.toFixed(1),
    peakFull: want.style === "" ? measure(renderBand(band, { bars, bpb: got.bpb, pickup, bpm: song.bpm, style: want.style, level: 3, combo: 12, lead: 0, mel }).wet).peakDb : null,
    balance: Object.fromEntries(Object.entries(mix).filter(([k]) => k !== "centroidHz").map(([k, v]) => [k, +v.pct.toFixed(1)])),
    centroidHz: Math.round(mix.centroidHz),
    bars_: body,
    arcDb: body.length ? +(Math.max(...body) - Math.min(...body)).toFixed(1) : 0,
    arcDryDb: (() => { const d = barCurve(r.dry, SR, r.spb, r.bpb).slice(0, 6); return d.length ? +(Math.max(...d) - Math.min(...d)).toFixed(1) : 0; })(),
    busGainDb: +(measure(r.wet).rmsDb - measure(r.dry).rmsDb).toFixed(1),
    mask: melodyMask(r.wet, mel, ref),
    melOctavePct: +melodyOctaveShare(r.wet).toFixed(1),
    roomDb: windowDb(r.wet, SR, roomT, roomT + 0.4),
    bodyDb: windowDb(r.wet, SR, r.spb, r.songLen),
  };
  rows.push(row);
  if (WAV_OUT) {
    mkdirSync("node_modules/.tmp-band/wav", { recursive: true });
    writeWav(`node_modules/.tmp-band/wav/${want.style || "default"}.wav`, r.wet);
  }
  process.stdout.write(".");
}
console.log("");

if (JSON_OUT) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }

const pad = (s, n) => String(s).padEnd(n);
console.log("\n── level and movement ──────────────────────────────────────────────────────────");
console.log(pad("style", 22) + pad("song", 18) + pad("bpm", 6) + pad("raw peak", 11) + pad("band out", 10) + pad("peak dBFS", 11) + pad("RMS", 8) + pad("crest", 8) + pad("clip", 8) + pad("arc dB", 8) + pad("arc dry", 9) + "peak@full");
void 0;
for (const r of rows) console.log(pad(r.label, 22) + pad(r.song, 18) + pad(r.bpm, 6) + pad(r.rawPeakDb, 11) + pad(r.dryPeakDb, 10) + pad(r.peakDb.toFixed(1), 11) + pad(r.rmsDb.toFixed(1), 8) + pad(r.crestDb.toFixed(1), 8) + pad(r.clip, 8) + pad(r.arcDb, 8) + pad(r.arcDryDb, 9) + (r.peakFull == null ? "—" : r.peakFull.toFixed(1)));

console.log("\n── tonal balance (% of energy) ────────────────────────────────────────────────");
console.log(pad("style", 22) + ["sub", "low", "mid", "upper", "presence", "air", "centroid Hz"].map((h) => pad(h, 9)).join(""));
for (const r of rows) console.log(pad(r.label, 22) + ["sub", "low", "mid", "upper", "presence", "air"].map((k) => pad(r.balance[k].toFixed(1), 9)).join("") + pad(r.centroidHz, 9));

console.log("\n── can the player hear their own note? (band vs the app's own piano note, ±1 semitone) ──");
console.log(pad("style", 22) + pad("median dB", 12) + pad("p90 dB", 10) + pad("quietest", 10) + pad("band in C4-C6", 17) + pad("room tail", 12) + "body dB");
for (const r of rows) console.log(pad(r.label, 22) + pad(r.mask.medianDb.toFixed(1), 12) + pad(r.mask.p90Db.toFixed(1), 10) + pad(r.mask.minDb.toFixed(1), 10) + pad(r.melOctavePct + " %", 17) + pad(r.roomDb.toFixed(1), 12) + r.bodyDb.toFixed(1));

console.log("\n── RMS per bar, dB ────────────────────────────────────────────────────────────");
for (const r of rows) console.log(pad(r.label, 22) + r.bars_.map((v) => v.toFixed(0).padStart(6)).join(""));
console.log("");