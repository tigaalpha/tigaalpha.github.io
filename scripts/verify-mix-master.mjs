#!/usr/bin/env node
/* ── verify-mix-master.mjs ── the MIX AND MASTER stage of the backing band, measured.

   node scripts/verify-mix-master.mjs            (about 3 minutes: it renders the REAL play-along-band.ts offline)

   What the stage is (play-along-band.ts node() · bass(), bus-master.ts, music-engine.tsx audioBus()):
     P05  two ducks on the pitched bus: one for a reward (a Perfect, a stinger), one for every kick (the sidechain feel)
     P14  an exciter that adds presence (3–7 kHz) from the snare / claps / mid-highs, above the player's octave
     P18  the bass's own 2nd and 3rd harmonic, so a phone speaker still plays it
     P09  a soft ceiling at the end of the bus, a seeded damped room with early reflections (verify-audio-bus-ir.mjs)
     P16  the lab renders stereo (verify-lab-stereo.mjs): correlation and what a single speaker does to the mix

   Each is switched off in turn through opts.mix, so every number below is "with" against "without" on the SAME code, not
   against an older build. Gates (AGENTS.md, "Sound, measured rather than guessed"): no clipped sample; the band 12 dB or
   more under the player's note at the 90th percentile; at most ~90 % of the energy under 250 Hz. */
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { loadBand, renderBand, renderMelodyRef, measure, spectrum, bandMix, melodyMask, stereoStats, windowDb, SR } from "./band-audio-lab.mjs";

execSync(`npx esbuild music-engine.tsx --bundle --format=esm --platform=node --external:react --outfile=node_modules/.tmp-band/lab/me.js`, { stdio: "pipe" });
execSync(`npx esbuild songs-data.ts --bundle --format=esm --platform=node --outfile=node_modules/.tmp-band/lab/songs.js`, { stdio: "pipe" });
const me = await import(pathToFileURL(join(process.cwd(), "node_modules/.tmp-band/lab/me.js")).href);
const { SONGS, SONG_GENRES, SONG_TIMESIG } = await import(pathToFileURL(join(process.cwd(), "node_modules/.tmp-band/lab/songs.js")).href);
const band = await loadBand();

let ok = 0, bad = 0;
const check = (name, cond, extra = "") => { (cond ? ok++ : bad++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "   " + extra : ""}`); };

const noteMidi = (n) => { const m = /^([A-G][#b]?)(-?\d+)$/.exec(n); if (!m) return null; const pc = me._PCI[m[1].toUpperCase()]; return pc == null ? null : (parseInt(m[2], 10) + 1) * 12 + pc; };
const bpbOf = (id) => parseInt(String(SONG_TIMESIG[id] || "4/4").split("/")[0], 10) || 4;
function prep(st, wantBpb) {
  const style = st === "default" ? "" : st;
  const c = SONGS.filter((s) => (style === "" ? true : SONG_GENRES[s.id] === style) && s.bpm && s.seq && s.seq.length > 8 && bpbOf(s.id) === wantBpb);
  const beats = (s) => s.seq.reduce((x, [, d]) => x + d, 0) / wantBpb;
  c.sort((a, b) => Math.abs(beats(a) - 24) - Math.abs(beats(b) - 24));
  const song = c[0];
  const bars = me.songChordBars(song, 0, { split: true, primary: true }).slice(0, 8);
  const endBeat = bars[bars.length - 1].at + bars[bars.length - 1].len;
  const mel = []; let beat = 0;
  for (const [note, dur] of song.seq) { if (note !== "R") { const m = noteMidi(note); if (m != null && beat < endBeat) mel.push({ beat, dur, midi: m }); } beat += dur; }
  return { st, style, song, bars, mel, bpb: wantBpb, ref: renderMelodyRef(mel, 60 / song.bpm, { lead: 0 }) };
}
const cfgOf = (p, extra = {}) => ({ bars: p.bars, bpb: p.bpb, pickup: 0, bpm: p.song.bpm, style: p.style, hand: "right", level: 2, combo: 12, lead: 0, mel: p.mel, ...extra });
const OFF = { duck: false, kick: false, exciter: false, bassEnh: false };
const sum = (p, r) => {
  const m = measure(r.wet), b = bandMix(spectrum(r.wet, SR, 4096)), mk = melodyMask(r.wet, p.mel, p.ref);
  return { peak: m.peakDb, rms: m.rmsDb, clip: m.clip, u250: b.sub.pct + b.low.pct, upper: b.upper.pct, pres: b.presence.pct, cen: b.centroidHz, p90: mk.p90Db };
};
const f1 = (v) => v.toFixed(1);

/* the gain nodes the stage adds, found by what is on them: the sidechain gain has hundreds of linear ramps, the reward gain a setTarget */
const findGains = (ctx) => {
  const gains = ctx.nodes.filter((n) => n.kind === "gain" && n.gain.ev.length > 6);
  const kickG = gains.find((n) => n.gain.ev.some((e) => e.k === "lin") && !n.gain.ev.some((e) => e.k === "tgt"));
  const hitG = gains.find((n) => n.gain.ev.some((e) => e.k === "tgt") && n.gain.ev.some((e) => e.k === "lin" && Math.abs(e.v - 0.794) < 0.01));
  return { kickG, hitG };
};

const STYLES = [["default", 4], ["classical", 3], ["baroque", 4], ["jazz", 4], ["carol", 4], ["kids", 4]];
const P = STYLES.map(([s, b]) => prep(s, b));
const rows = [];
for (const p of P) {
  const off = renderBand(band, cfgOf(p, { extra: { mix: OFF } }));
  const hits = []; for (let t = 0.5; t < 20; t += 0.75) hits.push(t);
  const on = renderBand(band, cfgOf(p, { hits }));
  const st = renderBand(band, cfgOf(p, { stereo: true }));
  rows.push({ p, off, on, hits, so: sum(p, off), sn: sum(p, on), st });
  process.stdout.write(".");
}
console.log("");

console.log("\nstyle         peak off/on   <250 Hz off/on   presence off/on   centroid off/on   p90 mask off/on");
for (const r of rows) console.log(r.p.st.padEnd(13) + `${f1(r.so.peak)}/${f1(r.sn.peak)}`.padEnd(14) + `${f1(r.so.u250)}/${f1(r.sn.u250)}`.padEnd(17) + `${r.so.pres.toFixed(2)}/${r.sn.pres.toFixed(2)}`.padEnd(18) + `${r.so.cen.toFixed(0)}/${r.sn.cen.toFixed(0)}`.padEnd(18) + `${f1(r.so.p90)}/${f1(r.sn.p90)}`);
console.log("");

/* ── gates: nothing the stage does may spend what the band's gates protect ── */
check("no clipped sample, any style, mono or stereo (L and R)", rows.every((r) => r.sn.clip === 0 && r.st.wetL.every((v) => Math.abs(v) < 0.999) && r.st.wetR.every((v) => Math.abs(v) < 0.999)));
check("peak stays 10 dB under full scale (the stage adds at most 2.5 dB: the exciter's brightness in the brightest style)", rows.every((r) => r.sn.peak <= -10 && r.sn.peak - r.so.peak <= 2.5), rows.map((r) => `${f1(r.sn.peak - r.so.peak)}`).join(" "));
check("the melody mask does not get worse by more than 0.4 dB in any style, and never crosses the 12 dB gate where it did not already", rows.every((r) => r.sn.p90 - r.so.p90 <= 0.4 && (r.sn.p90 <= -12 || r.so.p90 > -12)), rows.map((r) => `${r.p.st} ${(r.sn.p90 - r.so.p90 >= 0 ? "+" : "") + (r.sn.p90 - r.so.p90).toFixed(2)}`).join("  "));
check("energy under 250 Hz does not go UP in any style (the 90 % gate is not spent)", rows.every((r) => r.sn.u250 <= r.so.u250 + 0.2), rows.map((r) => (r.sn.u250 - r.so.u250 >= 0 ? "+" : "") + (r.sn.u250 - r.so.u250).toFixed(1)).join(" "));

/* ── P14 ── */
check("P14 · presence (2.5–6 kHz) at least triples in 5 of 6 styles", rows.filter((r) => r.sn.pres >= 3 * r.so.pres).length >= 5, rows.map((r) => `${r.so.pres.toFixed(2)}->${r.sn.pres.toFixed(2)}`).join(" "));
check("P14 · the spectral centroid rises in every style (the band stops being a muffled pad)", rows.every((r) => r.sn.cen > r.so.cen), rows.map((r) => `${r.so.cen.toFixed(0)}->${r.sn.cen.toFixed(0)}`).join(" "));
check("P14 · the energy it adds is above the player's octave: 800–2500 Hz moves by less than 0.7 points of the total", rows.every((r) => r.sn.upper - r.so.upper < 0.7), rows.map((r) => (r.sn.upper - r.so.upper).toFixed(2)).join(" "));

/* ── P18 ── */
check("P18 · the bass harmonics lower the under-250 Hz share in at least 4 of 6 styles", rows.filter((r) => r.sn.u250 < r.so.u250 - 0.1).length >= 4, rows.map((r) => (r.sn.u250 - r.so.u250).toFixed(1)).join(" "));
{
  /* the harmonics are real: a bass-only look at the first style, 130–600 Hz, with the enhancer on against off */
  const p = P[0];
  const a = renderBand(band, cfgOf(p, { extra: { mix: { ...OFF } } })), b = renderBand(band, cfgOf(p, { extra: { mix: { ...OFF, bassEnh: true } } }));
  const sa = bandMix(spectrum(a.dry, SR, 4096)), sb = bandMix(spectrum(b.dry, SR, 4096));
  check("P18 · with the harmonics the 250–800 Hz share of the band is larger and the 60–250 Hz share smaller (the energy moved up to where a phone speaker plays)", sb.mid.pct > sa.mid.pct && sb.low.pct < sa.low.pct, `mid ${sa.mid.pct.toFixed(1)}->${sb.mid.pct.toFixed(1)} %  low ${sa.low.pct.toFixed(1)}->${sb.low.pct.toFixed(1)} %`);
}

/* ── P05: the ducks, read off the automation itself ── */
{
  const r = rows[0];
  const { kickG, hitG } = findGains(r.on.ctx);
  check("P05 · the sidechain gain exists and is booked with the kicks", !!kickG && kickG.gain.ev.length >= 12, kickG ? `${kickG.gain.ev.length} events` : "not found");
  if (kickG) {
    const G = kickG.gain, evs = G.ev.filter((e) => e.k === "set").map((e) => e.t);
    let deep = 1, back = true, n = 0;
    for (const t0 of evs) { n++; deep = Math.min(deep, G.at(t0 + 0.0061)); if (G.at(t0 + 0.152) < 0.999) back = false; }
    check("P05 · every kick dips the pitched bus by 1–2.5 dB and the gain is back to unity 152 ms later", deep > 0.75 && deep < 0.92 && back, `deepest ${(20 * Math.log10(deep)).toFixed(2)} dB over ${n} kicks`);
    const hz = [0, 0.2, 0.5, 1, 2].map((t) => G.at(1e9));  // after the last event it must sit at 1
    check("P05 · the sidechain gain ends at unity (it can never leave the band ducked)", Math.abs(hz[0] - 1) < 1e-6);
  }
  check("P05 · the reward duck exists and is driven by band.duck()", !!hitG);
  if (hitG) {
    const G = hitG.gain;
    const starts = G.ev.filter((e) => e.k === "lin" && Math.abs(e.v - 0.794) < 0.01).map((e) => e.t - 0.008);   // where each duck really began (the lab pumps in 11 ms steps)
    const t0 = starts[2];
    const g0 = G.at(t0 - 0.001), g8 = G.at(t0 + 0.008), g40 = G.at(t0 + 0.04), g110 = G.at(t0 + 0.118), g300 = G.at(t0 + 0.3);
    check("P05 · a Perfect: -2 dB within 8 ms, most of it back by 110 ms, all of it by 300 ms", Math.abs(g0 - 1) < 0.02 && g8 > 0.78 && g8 < 0.81 && g110 > 0.95 && g300 > 0.995, `${[g0, g8, g40, g110, g300].map((v) => (20 * Math.log10(v)).toFixed(2)).join(" / ")} dB at -1, +8, +40, +118, +300 ms`);
  }
  /* the duck is a gain: with a stinger-free, hit-free run the sound is identical to the band without it except for the kicks */
  const o2 = renderBand(band, cfgOf(P[0], { extra: { mix: { ...OFF, kick: true } } })), o3 = renderBand(band, cfgOf(P[0], { extra: { mix: { ...OFF } } }));
  const sa = measure(o2.dry), sb = measure(o3.dry);
  check("P05 · the sidechain duck costs under 0.6 dB of average level", Math.abs(sa.rmsDb - sb.rmsDb) < 0.6, `${(sa.rmsDb - sb.rmsDb).toFixed(2)} dB`);
  const ep = renderBand(band, cfgOf(P[2], { hits: r.hits }));      // baroque: no drums at all, so the band is purely pitched
  const ee = renderBand(band, cfgOf(P[2], { extra: { mix: { ...OFF } } }));
  const dbAt = (buf, t) => windowDb(buf, SR, t + 0.012, t + 0.04);
  const drop = r.hits.slice(0, 12).map((t) => dbAt(ep.dry, t) - dbAt(ee.dry, t));
  const back = r.hits.slice(0, 12).map((t) => windowDb(ep.dry, SR, t + 0.25, t + 0.4) - windowDb(ee.dry, SR, t + 0.25, t + 0.4));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  check("P05 · on a band with no drums (baroque) the pitched voices measurably dip 12-40 ms after a hit (about -1.5 to -2.5 dB) and are back by 250 ms", mean(drop) < -1.2 && mean(drop) > -3.2 && Math.abs(mean(back)) < 0.5, `dip ${mean(drop).toFixed(2)} dB, +250 ms ${mean(back).toFixed(2)} dB`);
}

/* ── P16 stereo ── */
check("P16 · stereo: the band's two channels stay related (correlation 0.9 or more) and nothing cancels on one speaker (mono loss -0.5 dB or better)", rows.every((r) => { const s = stereoStats(r.st.dryL, r.st.dryR); return s.corr >= 0.9 && s.monoLossDb >= -0.5; }), rows.map((r) => { const s = stereoStats(r.st.dryL, r.st.dryR); return `${s.corr.toFixed(2)}/${s.monoLossDb.toFixed(2)}`; }).join(" "));
check("P16 · through the room the two ears are decorrelated a little (correlation under that of the dry band) and still do not cancel (mono loss -1.0 dB or better)", rows.every((r) => { const a = stereoStats(r.st.dryL, r.st.dryR), b = stereoStats(r.st.wetL, r.st.wetR); return b.corr < a.corr && b.monoLossDb >= -1.0; }));
check("P16 · folded to one speaker the stereo mix is within 1 dB of the unpanned one the gates were measured on", rows.every((r) => Math.abs(measure(r.st.wet).rmsDb - r.sn.rms) < 1.0), rows.map((r) => (measure(r.st.wet).rmsDb - r.sn.rms).toFixed(2)).join(" "));

console.log(`\n${ok}/${ok + bad} checks`);
process.exit(bad ? 1 : 0);
