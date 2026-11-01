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
import { loadBand, renderBand, renderMelodyRef, render, measure, spectrum, bandMix, barCurve, melodyMask, melodyOctaveShare, windowDb, writeWav, stereoStats, db, SR } from "./band-audio-lab.mjs";

const JSON_OUT = process.argv.includes("--json");
const WAV_OUT = process.argv.includes("--wav");
/* --stereo : also render the band with its StereoPanner positions (the plain run leaves every voice unpanned, which is
              what every number in docs 23/24 was measured on) and report L/R correlation, the cost of a phone's single
              speaker, per-channel peak and clips.
   --ab     : also render each style with the mix-and-master stage switched OFF (opts.mix, play-along-band.ts) and print what
              it changed — the before/after of P05 (ducks), P14 (exciter), P18 (bass harmonics) and the low cut.
   --hits   : with --ab, the "after" render also gets a duck() on every beat of the song, the worst case for the duck. */
const STEREO = process.argv.includes("--stereo");
const AB = process.argv.includes("--ab");
const HITS = process.argv.includes("--hits");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
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
const MIXOFF = { duck: false, kick: false, exciter: false, bassEnh: false };
const abRows = [], stRows = [];
for (const want of STYLES) {
  if (ONLY.length && !ONLY.includes(want.style || "default")) continue;
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
  const summary = (rr, label) => {
    const m = measure(rr.wet), sp = spectrum(rr.wet, SR, 4096), bm = bandMix(sp), mk = melodyMask(rr.wet, mel, ref);
    return { label, peakDb: m.peakDb, rmsDb: m.rmsDb, clip: m.clip, under250: bm.sub.pct + bm.low.pct, upper: bm.upper.pct, presence: bm.presence.pct, air: bm.air.pct, centroid: bm.centroidHz, median: mk.medianDb, p90: mk.p90Db, minDb: mk.minDb };
  };
  if (AB) {
    const cfg = { bars, bpb: got.bpb, pickup, bpm: song.bpm, style: want.style, hand: "right", level: 2, combo: 12, fever: false, lead: 0, mel };
    const off = renderBand(band, { ...cfg, extra: { mix: MIXOFF } });
    const hits = HITS ? Array.from({ length: Math.floor(r.songLen / r.spb) }, (_, k) => k * r.spb + 0.3) : null;
    const on = renderBand(band, { ...cfg, hits });
    abRows.push({ label: want.label, off: summary(off, "off"), on: summary(on, "on") });
  }
  if (STEREO) {
    const st = renderBand(band, { bars, bpb: got.bpb, pickup, bpm: song.bpm, style: want.style, hand: "right", level: 2, combo: 12, fever: false, lead: 0, mel, stereo: true });
    const sd = stereoStats(st.dryL, st.dryR), sw = stereoStats(st.wetL, st.wetR);
    const pk = (b) => db(b.reduce((a, v) => Math.max(a, Math.abs(v)), 0));
    let clip = 0; for (const b of [st.wetL, st.wetR]) for (let i = 0; i < b.length; i++) if (Math.abs(b[i]) >= 0.999) clip++;
    const wide = summary(st, "stereo");
    stRows.push({ label: want.label, dry: sd, wet: sw, peakL: pk(st.wetL), peakR: pk(st.wetR), clip, foldRms: wide.rmsDb, monoRms: row.rmsDb, foldPeak: wide.peakDb });
  }
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

if (AB) {
  const f = (v, n = 1) => (v >= 0 ? " " : "") + v.toFixed(n);
  console.log("\n── mix & master: the band without it (off) and with it (on) ─────────────────────────" + (HITS ? "  [on: a duck on every beat]" : ""));
  console.log(pad("style", 22) + ["peak off", "on", "RMS off", "on", "<250Hz off", "on", "upper off", "on", "pres off", "on", "centroid off", "on"].map((h) => pad(h, 10)).join(""));
  for (const a of abRows) console.log(pad(a.label, 22) + [a.off.peakDb, a.on.peakDb, a.off.rmsDb, a.on.rmsDb, a.off.under250, a.on.under250, a.off.upper, a.on.upper, a.off.presence, a.on.presence, a.off.centroid, a.on.centroid].map((v, i) => pad(f(v, i >= 10 ? 0 : 1), 10)).join(""));
  console.log("\n── melody mask, band minus the player's note (must stay under -12 dB at the 90th percentile) ──");
  console.log(pad("style", 22) + ["median off", "on", "p90 off", "on", "quietest off", "on", "clips on"].map((h) => pad(h, 13)).join(""));
  for (const a of abRows) console.log(pad(a.label, 22) + [a.off.median, a.on.median, a.off.p90, a.on.p90, a.off.minDb, a.on.minDb, a.on.clip].map((v) => pad(f(v), 13)).join(""));
  const mean = (k, w) => abRows.reduce((s, a) => s + a[w][k], 0) / abRows.length;
  console.log(pad("MEAN", 22) + `<250 Hz ${mean("under250", "off").toFixed(1)} -> ${mean("under250", "on").toFixed(1)} %   upper ${mean("upper", "off").toFixed(2)} -> ${mean("upper", "on").toFixed(2)} %   presence ${mean("presence", "off").toFixed(2)} -> ${mean("presence", "on").toFixed(2)} %   centroid ${mean("centroid", "off").toFixed(0)} -> ${mean("centroid", "on").toFixed(0)} Hz   p90 mask ${mean("p90", "off").toFixed(1)} -> ${mean("p90", "on").toFixed(1)} dB`);
}
if (STEREO) {
  const f = (v, n = 2) => (v >= 0 ? " " : "") + v.toFixed(n);
  console.log("\n── stereo (the band's PAN positions + the room's two ears) ───────────────────────");
  console.log(pad("style", 22) + ["corr band", "mono loss", "corr out", "mono loss", "peak L", "peak R", "clips", "fold-mono"].map((h) => pad(h, 11)).join(""));
  for (const a of stRows) console.log(pad(a.label, 22) + [f(a.dry.corr), f(a.dry.monoLossDb) + " dB", f(a.wet.corr), f(a.wet.monoLossDb) + " dB", f(a.peakL, 1), f(a.peakR, 1), String(a.clip), f(a.foldRms - a.monoRms, 1) + " dB"].map((v) => pad(v, 11)).join(""));
  console.log("(mono loss: 0 dB = same signal in both ears, -3.0 dB = unrelated channels (a healthy wide mix), below -3 dB = parts cancel on a single speaker; fold-mono = RMS of the stereo mix folded to one speaker minus RMS of the unpanned mix)");
}
console.log("\n── RMS per bar, dB ────────────────────────────────────────────────────────────");
for (const r of rows) console.log(pad(r.label, 22) + r.bars_.map((v) => v.toFixed(0).padStart(6)).join(""));
console.log("");

/* ── the produced intro (plan 25 P03) and the form (P10), measured ──
   A count-in of four beats, then the song: the riser on the last count-in beat (is there sound where there was none), and the filter
   that opens over the first two bars (the spectral centroid of bar 0, bar 1 and bar 3 — it should rise), then 17 bars in a row for
   how far the song moves (the dB between its quietest and loudest 4-bar window). */
{
  const got = pick("", 4);
  const song = got.s;
  let bars = me.songChordBars(song, 0, { split: true, primary: true });
  const spb = 60 / song.bpm, lead = 4 * spb;
  bars = bars.slice(0, 8);
  const endBeat = bars[bars.length - 1].at + bars[bars.length - 1].len;
  const mel = melodyOf(song).filter((n) => n.beat < endBeat);
  const r = renderBand(band, { bars, bpb: got.bpb, pickup: 0, bpm: song.bpm, style: "", hand: "right", level: 2, combo: 12, lead, mel });
  const barS = got.bpb * spb;
  // % of the bar's energy above 250 Hz (everything but the sub and low bands): what the opening filter lets through
  const cen = (a) => { const m = bandMix(spectrum(r.wet.subarray(Math.floor(a * SR), Math.floor((a + barS) * SR)), SR, 4096)); return +(100 - m.sub.pct - m.low.pct).toFixed(1); };
  const before = windowDb(r.wet, SR, lead - spb, lead), gap = windowDb(r.wet, SR, 0, lead - spb);
  const c0 = cen(lead), c1 = cen(lead + barS), c3 = cen(lead + 3 * barS);
  console.log("── the intro (P03) ─────────────────────────────────────────────────────────────");
  console.log(`  last count-in beat: ${before.toFixed(1)} dB (the riser; the beats before it ${gap.toFixed(1)} dB) · energy above 250 Hz: bar 0 ${c0} %, bar 1 ${c1} %, bar 3 ${c3} % · clipped ${measure(r.wet).clip}`);
  console.log("");
  console.log("── 17 bars in a row: verse, chorus (bars 8-15), the break before bar 16 (P10) ──────────────────────");
  console.log(pad("style", 22) + pad("bars", 6) + pad("p90 dB", 9) + pad("median dB", 11) + pad("<250 Hz %", 11) + pad("movement dB", 13) + pad("clipped", 9) + "RMS per bar");
  for (const want of [STYLES[0], STYLES[1], STYLES[5], STYLES[7], STYLES[8], STYLES[10]]) {
    const g2 = pick(want.style, want.bpb);
    if (!g2) continue;
    const sg = g2.s;
    let b3 = me.songChordBars(sg, 0, { split: true, primary: true }).filter((c) => c.at < 17 * g2.bpb);
    const e3 = b3[b3.length - 1].at + b3[b3.length - 1].len;
    const mel3 = melodyOf(sg).filter((n) => n.beat < e3);
    const r3 = renderBand(band, { bars: b3, bpb: g2.bpb, pickup: 0, bpm: sg.bpm, style: want.style, hand: "right", level: 2, combo: 12, lead: 0, mel: mel3 });
    const ref3 = renderMelodyRef(mel3, 60 / sg.bpm, { lead: 0 });
    const mk = melodyMask(r3.wet, mel3, ref3), mx = bandMix(spectrum(r3.wet, SR, 4096));
    const bc = barCurve(r3.wet, SR, r3.spb, r3.bpb).slice(0, Math.min(16, Math.floor(e3 / g2.bpb)));
    console.log(pad(want.label, 22) + pad(Math.round(e3 / g2.bpb), 6) + pad(mk.p90Db.toFixed(1), 9) + pad(mk.medianDb.toFixed(1), 11) + pad((mx.sub.pct + mx.low.pct).toFixed(1), 11) + pad((Math.max(...bc) - Math.min(...bc)).toFixed(1), 13) + pad(measure(r3.wet).clip, 9) + bc.map((v) => v.toFixed(0).padStart(4)).join(""));
  }
}
