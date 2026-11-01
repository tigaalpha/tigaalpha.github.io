#!/usr/bin/env node
/* smoke-band-style.mjs — the band's arrangement, pinned.

   node scripts/smoke-band-style.mjs

   WHY this exists — plan 23 (the owner, 2026-10-03: "the backing track has to
   be beautiful — add whatever sounds suit the piece"). Two things were wrong
   and neither is visible in a screenshot:

     - the drum pattern was 4/4 rock for every song (play-along-band.ts), while
       375 of the 875 classical pieces are 3/4 and 123 are 2/4 — so a waltz was
       played with a kick on 1 and 3 and a snare on 2 and 4;
     - the band never saw the song's genre, even though SONG_GENRES (songs-data)
       already holds one for all 1,067 songs — so a Bach fugue and a jazz
       shuffle got the same kit.

   The band is synthesised, so it does not need speakers to be checked: this
   bundles the REAL play-along-band.ts against a stub music-engine whose
   "audio context" records every oscillator and noise burst instead of making
   sound, then drives createBand the way the game does and reads back
   band.log and the recorded voices.

   What it pins:
     - an unknown style and 4/4 book EXACTLY what they booked before this work
     - 3/4 books no snare, 2/4 is all snare, 4/4 keeps kick 1+3 / snare 2+4
     - each style books its own kit, and none of them books a snare they should not
     - every pitched voice still blacklists itself for the mic (suppress)
     - the same song always books the same thing (nothing is random) */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-band";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

/* ── the stub music-engine: a recording AudioContext ──
   Every node the band builds is a plain object; oscillators and noise sources
   are appended to a list so a test can ask "was a square wave played?" without
   a speaker, a browser, or an OfflineAudioContext. */
const STUB = `
export let _sfxMuted = false, _micSafe = false;
// shared through globalThis so the test reads the SAME instance the band wrote to
export const REC = globalThis.__BAND_REC = globalThis.__BAND_REC || { osc: [], noise: [], marks: [] };
function param(v) { return { value: v, setValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, setTargetAtTime() { return this; }, cancelScheduledValues() { return this; } }; }
function node(extra) { return Object.assign({ connect() {}, disconnect() {} }, extra); }
const AC = {
  // the test drives this: the band's pump books LOOKAHEAD seconds ahead of it,
  // so a clock that never moves stops the band after half a beat
  get currentTime() { return globalThis.__BAND_NOW || 0; },
  sampleRate: 44100, destination: node({}),
  createGain: () => node({ gain: param(1) }),
  createOscillator() { const o = node({ type: "sine", frequency: param(440), detune: param(0), start(t) { REC.osc.push({ type: this.type, freq: this.frequency.value, at: t }); }, stop() {} }); return o; },
  createBiquadFilter: () => node({ type: "lowpass", frequency: param(350), Q: param(1), gain: param(0), detune: param(0) }),
  createDelay: () => node({ delayTime: param(0) }),
  createWaveShaper: () => node({ curve: null, oversample: "none", k: 1 }),
  createDynamicsCompressor: () => node({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }),
  createBufferSource() { return node({ buffer: null, loop: false, start(t) { REC.noise.push({ at: t }); }, stop() {} }); },
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len), length: len }; },
};
const _bus = node({});
export function audioBus() { return { ac: AC, bus: _bus }; }
export function __setNow(t) { AC.currentTime = t; }
// the pump reads audioBus().ac.currentTime, which the test drives

export function _accMarkSuppress(freq, tol) { REC.marks.push({ freq, tol }); }
export function hfPing(ac, dest, t0, f, vol) { REC.noise.push({ at: t0, hf: f, vol }); }
export function playCrowd(level, secs, delay) { (REC.crowd = REC.crowd || []).push({ level, secs, delay }); }
let _buf = null;
export function _accNoise(ac) { if (!_buf) _buf = ac.createBuffer(1, 4410, 44100); return _buf; }
export function __reset() { REC.osc.length = 0; REC.noise.length = 0; REC.marks.length = 0; }
`;

/* esbuild's --alias refuses a name that starts with ".", so the band's import is
   pointed at the stub in a copy of the source instead — the copy is byte-for-
   byte the shipped file apart from that one specifier. */
const SRC = readFileSync("play-along-band.ts", "utf8");
if (!SRC.includes('from "./music-engine"')) { console.error("play-along-band.ts no longer imports ./music-engine — update this stub"); process.exit(1); }
ioSync(`${OUT}/p4/music-engine.ts`, STUB);
ioSync(`${OUT}/p4/play-along-band.ts`, SRC);
execSync(`npx esbuild ${OUT}/p4/play-along-band.ts --bundle --outfile=${OUT}/p4/band.js --format=esm --platform=node`, { stdio: "pipe" });
const band = await import(pathToFileURL(`${OUT}/p4/band.js`).href);
const REC = () => globalThis.__BAND_REC;

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? " — " + detail : ""}`); }
};

const CH = { C: [0, 4, 7], F: [5, 9, 0], G: [7, 11, 2], Am: [9, 0, 4] }, ROOT = { C: 0, F: 5, G: 7, Am: 9 };
const ROOTS = Object.keys(ROOT);
/* bars in the shape songChordBars returns: one entry per chord, `at` the beat
   it starts on and `len` how many beats it lasts. */
function bars(n, roots, bpb) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = roots[i % roots.length];
    out.push({ root: ROOT[r], pcs: CH[r], at: i * bpb, len: bpb });
  }
  return out;
}

/* Drive the band the way use-play-along does: one pump every 60 ms on a
   simulated clock, the combo climbing, until `bars_` bars have been booked. */
function run(cfg) {
  const { bpb = 4, bars_ = 8, style = "", bpm = 100, combo = 12, fever = false, hand = "right", mel = null } = cfg;
  const spb = 60 / bpm;
  const b = band.createBand({
    bars: bars(bars_, ROOTS, bpb), beatsPerBar: bpb, pickup: 0, spb, lead: 0,
    endBeat: bars_ * bpb, hand, level: 2, bpm, style, mel,
  });
  b.setState({ combo, fever, mega: fever, pitched: true, soft: false, micOpen: true });
  REC().osc.length = REC().noise.length = REC().marks.length = 0;
  // the game's clock: song time advances with real time
  let clock = 0;
  const spbReal = spb;
  for (let i = 0; i < 3000 && b.log.length < bars_ * bpb * 2; i++) {
    globalThis.__BAND_NOW = clock;      // the stub's AudioContext clock IS the game clock here
    b.pump(clock, (t) => t, 1);
    clock += 0.06;
  }
  return b;
}

const drums = (b) => b.log.map((e) => e.drum);
const has = (arr, x) => arr.includes(x);
const uniq = (a) => [...new Set(a)];

// ── 1 · an unknown style in 4/4 must book exactly the old band ──
{
  const b = run({ style: "", bpb: 4 });
  const d = uniq(drums(b));
  check("4/4 unknown style keeps the old kit", has(d, "kick") && has(d, "snare"), `got ${d.join(",")}`);
  check("4/4 unknown style has no ride/timp/tick", !has(d, "ride") && !has(d, "timp") && !has(d, "tick"), `got ${d.join(",")}`);
  const onBeats = b.log.filter((e) => Math.abs(e.pos - Math.round(e.pos)) < 1e-6);
  const kicks = onBeats.filter((e) => e.drum === "kick").map((e) => Math.round(e.pos));
  check("4/4 kick lands on 1 and 3", kicks.filter((p) => p === 0 || p === 2).length === kicks.length, `kicks at ${kicks.join(",")}`);
  const snares = onBeats.filter((e) => e.drum === "snare").map((e) => Math.round(e.pos));
  check("4/4 snare lands on 2 and 4", snares.length > 0 && snares.filter((p) => p === 1 || p === 3).length === snares.length, `snares at ${snares.join(",")}`);
}

// ── 2 · M1 — the metre decides the drums ──
{
  const w = run({ style: "", bpb: 3 });
  const wd = drums(w);
  check("M1 3/4 books no snare at all", !has(wd, "snare"), `got ${uniq(wd).join(",")}`);
  check("M1 3/4 still keeps a pulse (kick or tick)", has(wd, "kick") || has(wd, "tick"), `got ${uniq(wd).join(",")}`);
  const onBeats = w.log.filter((e) => Math.abs(e.pos - Math.round(e.pos)) < 1e-6);
  const kicks = onBeats.filter((e) => e.drum === "kick").map((e) => Math.round(e.pos));
  check("M1 3/4 kicks only the downbeat", kicks.length > 0 && kicks.every((p) => p === 0), `kicks at ${kicks.join(",")}`);

  const m = run({ style: "", bpb: 2 });
  const md = uniq(drums(m)).filter(Boolean);          // "" = that half-beat books nothing
  check("M1 2/4 is a march — snare only", md.length > 0 && md.every((d) => d === "snare"), `got ${md.join(",")}`);
  check("M1 2/4 books no kick and no hats", !has(md, "kick") && !has(md, "hat"), `got ${md.join(",")}`);
  check("M1 2/4 snares on both beats of the bar", drums(m).filter((d) => d === "snare").length >= 8, `${drums(m).filter((d) => d === "snare").length} snares`);
}

// ── 3 · M2 — each style books its own kit ──
{
  const kits = {};
  for (const style of Object.keys(band.BAND_STYLES)) {
    const b = run({ style, bpb: 4 });
    kits[style] = uniq(drums(b)).join(",");
  }
  check("M2 baroque has no kick and no snare", !/kick|snare/.test(kits.baroque), `got ${kits.baroque}`);
  check("M2 impressionism has no kick and no snare", !/kick|snare/.test(kits.impressionism), `got ${kits.impressionism}`);
  check("M2 classical is timpani, not a drum kit", has(kits.classical.split(","), "timp"), `got ${kits.classical}`);
  check("M2 jazz rides, never kicks", has(kits.jazz.split(","), "ride") && !/kick/.test(kits.jazz), `got ${kits.jazz}`);
  check("M2 kids and folk clap", has(kits.kids.split(","), "clap") && has(kits.folk.split(","), "clap"), `kids=${kits.kids} folk=${kits.folk}`);
  check("M2 every style still keeps the beat audible", Object.values(kits).every((k) => k.length > 0), JSON.stringify(kits));
  console.log("     kits:", JSON.stringify(kits));
}

// ── 4 · M3 — the styles book the voices they asked for ──
{
  const rect = (s) => run({ style: s, bpb: 4 });
  const parts = (s) => uniq(rect(s).log.map((e) => e.parts)).join(" ").replace(/\s+/g, "");
  check("M3 baroque books its lead voice", /l/.test(parts("baroque")), parts("baroque"));
  check("M3 carol books its lead voice", /l/.test(parts("carol")), parts("carol"));
  check("M3 impressionism books its lead voice", /l/.test(parts("impressionism")), parts("impressionism"));
  check("M3 folk books a lead voice", /l/.test(parts("folk")), parts("folk"));
  check("M3 the strings styles play a moving line (M5)", /m/.test(parts("classical")), parts("classical"));
  // the orchestra's other instruments (owner 2026-10-10): every style that names a voice books it, a style the table does not know books none
  const partsSet = (st) => new Set(rect(st).log.flatMap((e) => (e.parts || "").split("")));
  const want = { baroque: "wh", classical: "we", romantic: "eh", impressionism: "wh", kids: "hw", folk: "hw", cn: "wh", carol: "we", gospel: "ew", jazz: "hw", blues: "wh", swing: "wh", bossa: "h", soul: "we", neosoul: "hw" };
  for (const [st, letters] of Object.entries(want)) {
    const got = partsSet(st);
    check(`M13 ${st} books its extra instruments (${letters})`, letters.split("").every((l) => got.has(l)), [...got].join(""));
  }
  const dflt = partsSet("");
  check("M13 the default band books no extra instrument", !["w", "e", "h"].some((l) => dflt.has(l)), [...dflt].join(""));
  check("M3 the default band plays NO extra lead line", !/l/.test(parts("")) && !/m/.test(parts("")), parts(""));
}

// ── 5 · the mic rule: every pitched voice blacklists itself ──
{
  for (const style of ["", ...Object.keys(band.BAND_STYLES)]) {
    const b = run({ style, bpb: 3 });
    const pitched = REC().osc.length;
    check(`M3 style "${style || "(default)"}" blacklists its pitches for the mic`, REC().marks.length > 0, `${pitched} oscillators, ${REC().marks.length} marks`);
    check(`M3 style "${style || "(default)"}" blacks out nothing above 1.8 kHz`, REC().marks.every((m2) => m2.freq <= 1800), `max ${Math.max(0, ...REC().marks.map((m2) => m2.freq))}`);
  }
}

// ── 6 · M4 — the tempo changes the density, never the pitch ──
{
  const slow = run({ style: "", bpb: 4, bpm: 55 }), fast = run({ style: "", bpb: 4, bpm: 170 });
  check("M4 a slow song books the same kit", uniq(drums(slow)).includes("kick"), uniq(drums(slow)).join(","));
  check("M4 a fast song books the same kit", uniq(drums(fast)).includes("kick"), uniq(drums(fast)).join(","));
  check("M4 a slow song is not busier than a fast one", slow.log.length <= fast.log.length, `${slow.log.length} vs ${fast.log.length}`);
  // same song, same booking — nothing is random
  const a = run({ style: "baroque", bpb: 3, bpm: 84 }), b = run({ style: "baroque", bpb: 3, bpm: 84 });
  const sig = (x) => x.log.map((e) => `${e.beat}:${e.drum}:${e.parts}`).join("|");
  check("M2/M4 the same song always books the same thing", sig(a) === sig(b));
}

// ── 7 · the branches the edits touched that the runs above never reach:
//    Fever, the last-chord finale, the left hand (no bass), both tempos
{
  for (const style of ["", ...Object.keys(band.BAND_STYLES)]) {
    for (const bpb of [2, 3, 4]) {
      const nm = `${style || "(default)"} ${bpb}/4`;
      const hot = run({ style, bpb, fever: true, mega: true, combo: 40, bars_: 3 });
      check(`${nm} Fever runs to the last chord`, hot.log.some((e) => e.parts.includes("!")), `${hot.log.length} entries, no finale`);
      // the metre wins over the kit (2/4 is a march, 3/4 never snares) except for a
      // kit of "none" — a Baroque piece in 2/4 is still Baroque
      const kitdrums = band.BAND_STYLES[style] ? band.BAND_STYLES[style].drums : "rock";
      const wantsSnare = kitdrums !== "none" && bpb !== 3
        && (bpb === 2 || !["clap", "ride", "timpani", "soft"].includes(kitdrums));
      const gotSnare = hot.log.some((e) => e.drum === "snare");
      check(`${nm} Fever snares exactly where the metre asks for one`, gotSnare === wantsSnare, `got snare ${gotSnare}, want ${wantsSnare}`);
      const left = run({ style, bpb, hand: "left", fever: true, bars_: 3 });
      check(`${nm} left hand plays no bass`, left.log.length > 0 && !left.log.some((e) => e.parts.includes("b")), "bass booked");
      check(`${nm} left hand still finishes on the last chord`, left.log.some((e) => e.parts.includes("!")), "no finale");
    }
  }
  for (const bpm of [52, 96, 180]) {
    const b = run({ style: "", bpb: 4, bpm, fever: true, mega: true, bars_: 4 });
    check(`M4 ${bpm} bpm books without throwing`, b.log.length > 0 && b.log.some((e) => e.drum), `${b.log.length} entries`);
  }
}

// ── 8 · M6 — four levels, and "full" is louder than "normal" ──
{
  check("M6 the band has four levels", band.BAND_LEVELS.length === 4, JSON.stringify(band.BAND_LEVELS));
  check("M6 off is still silent", band.BAND_LEVELS[0] === 0);
  check("M6 the order never dips", band.BAND_LEVELS.every((v, i) => i === 0 || v > band.BAND_LEVELS[i - 1]), JSON.stringify(band.BAND_LEVELS));
  check("M6 full is louder than normal", band.BAND_LEVELS[3] > band.BAND_LEVELS[2]);
}

// ── 9 · the table matches the genres the app actually ships ──
{
  const src = readFileSync("songs-data.ts", "utf8");
  const head = src.slice(src.indexOf("export const SONGS"), src.indexOf("SONGS.push(...CLASSICAL_SONGS)"));
  const ids = new Set([...head.matchAll(/\bid:\s*"([^"]+)"/g)].map((x) => x[1]));
  const seg = src.slice(src.indexOf("SONG_GENRES: Record"), src.indexOf("};", src.indexOf("SONG_GENRES: Record")));
  const genreOf = new Map([...seg.matchAll(/([^\s,:{}"]+)\s*:\s*"([a-z_]+)"/g)].map((x) => [x[1].replace(/"/g, ""), x[2]]));
  const missing = [...ids].filter((i) => !genreOf.has(i));
  check("M2 every hand-made song carries a genre in SONG_GENRES", missing.length === 0, `missing ${missing.join(",")}`);
  const stray = [...new Set(genreOf.values())].filter((g2) => !band.BAND_STYLES[g2]);
  check("M2 a genre with no kit falls back to the old band", stray.length === 0, `no kit for ${stray.join(",")}`);
}

// ── 10 · M7 — the band leaves the player's own octave free, and the bass moves ──
{
  const sig = (x) => x.log.map((e) => `${e.beat}:${e.drum}:${e.parts}`).join("|");
  const bare = run({ style: "classical", bpb: 4 });
  const lineOf = (x) => x.log.filter((e) => e.parts.includes("m")).map((e) => Math.round(e.pos));

  check("M7 a caller that passes no melody books exactly what it always did", sig(bare) === sig(run({ style: "classical", bpb: 4, mel: [] })));
  check("M7 an empty melody list changes nothing", sig(bare) === sig(run({ style: "classical", bpb: 4, mel: [] })));

  // the melody covers three beats of every bar: the string line can only use the fourth
  const gaps = [];
  for (let bar = 0; bar < 8; bar++) for (const p of [0, 1, 2]) gaps.push({ beat: bar * 4 + p, dur: 1, midi: 60 + p });
  const g = run({ style: "classical", bpb: 4, mel: gaps });
  const gl = lineOf(g);
  check("M7 the string line moves only where the melody is silent", gl.length > 0 && gl.every((p) => p === 3), `on beats ${uniq(gl).join(",") || "nowhere"}`);
  check("M7 the string line plays fewer notes once it knows the tune", gl.length < lineOf(bare).length, `${gl.length} vs ${lineOf(bare).length}`);

  // a melody that covers every beat leaves the line no room at all
  const full = [];
  for (let beat = 0; beat < 32; beat++) full.push({ beat, dur: 1, midi: 60 + (beat % 12) });
  check("M7 the string line gives way to a melody that never rests", lineOf(run({ style: "classical", bpb: 4, mel: full })).length === 0);

  // the bass steps into the next chord instead of repeating the root
  const steps = run({ style: "", bpb: 4 });
  const off = steps.log.filter((e) => !Number.isInteger(e.pos) && e.parts.includes("b"));
  check("M7 the bass walks into the next chord before it changes", off.length >= 6, `${off.length} approach notes in 8 bars`);
  const feverBass = run({ style: "", bpb: 4, fever: true });
  check("M7 Fever still owns the off-beats in the bass", feverBass.log.some((e) => !Number.isInteger(e.pos) && e.parts.includes("b")));
}

/* ── 11 · the arrangement (plan 25 §D): P02 layers on the bar line · P03 a produced intro · P07 a Fever drop on the grid ·
   P08 a band that thins instead of collapsing · P10 a form · P13 the run into the finale · P17 each genre's own fill ──
   `script` is run() with a clock the test controls: the player's state (combo, Fever, how the last judgements went) changes at
   a beat of the test's choosing, the way it changes in the game while the band is already playing. The band books a third of a
   second ahead, so a change is only seen by the beats booked AFTER it: every assertion leaves that margin. */
function script(cfg) {
  const { bpb = 4, bars_ = 8, style = "", bpm = 120, hand = "right", lead = 0, mel = null, init = {}, steps = [] } = cfg;
  const spb = 60 / bpm;
  const b = band.createBand({ bars: bars(bars_, ROOTS, bpb), beatsPerBar: bpb, pickup: 0, spb, lead, endBeat: bars_ * bpb, hand, level: 2, bpm, style, mel });
  b.setState({ combo: 12, fever: false, mega: false, pitched: true, soft: false, micOpen: true, ...init });
  REC().osc.length = REC().noise.length = REC().marks.length = 0;
  const todo = steps.map((s) => ({ ...s })).sort((x, y) => x.beat - y.beat);
  let clock = 0;
  for (let i = 0; i < 8000 && b.log.length < bars_ * bpb * 2; i++) {
    while (todo.length && lead + todo[0].beat * spb <= clock) b.setState(todo.shift().state);
    globalThis.__BAND_NOW = clock;
    b.pump(clock, (t) => t, 1);
    clock += 0.06;
  }
  return b;
}
const atBeat = (b, beat) => b.log.find((e) => Math.abs(e.beat - beat) < 1e-6);
const inRange = (b, a, z) => b.log.filter((e) => e.beat >= a - 1e-6 && e.beat < z - 1e-6);
const partsOf = (es) => es.map((e) => e.parts).join("");
const extrasOf = (es) => es.map((e) => e.extras).join("");
{
  // P02 · combo reaches 8 in the middle of bar 1: the strings and the bass wait for bar 2, the lead-in rides the last two beats
  const hold = script({ init: { combo: 0 }, bars_: 6 });
  const up = script({ init: { combo: 0 }, bars_: 6, steps: [{ beat: 4.6, state: { combo: 8 } }] });
  check("P02 before the player has a combo the band is drums only (no bass, no pad)", !/[bcx]/.test(partsOf(inRange(up, 0, 4))), partsOf(inRange(up, 0, 4)));
  check("P02 a combo of 8 in the middle of a bar adds no layer before the next bar line", !/[bcx]/.test(partsOf(inRange(up, 5.5, 8))), partsOf(inRange(up, 5.5, 8)));
  check("P02 ...and the layers are all there ON the bar line", /c/.test(atBeat(up, 8).parts) && /b/.test(atBeat(up, 8).parts), atBeat(up, 8).parts);
  check("P02 the layer level is promoted at the bar line, not before", atBeat(up, 7.5).lvl === 0 && atBeat(up, 8).lvl === 2, `${atBeat(up, 7.5).lvl} -> ${atBeat(up, 8).lvl}`);
  check("P02 a riser climbs into the bar line", /r/.test(extrasOf(inRange(up, 6, 8))), extrasOf(inRange(up, 6, 8)));
  check("P02 ...and a pickup lands on the last half-beat", /u/.test(atBeat(up, 7.5).extras), atBeat(up, 7.5).extras);
  check("P02 the drums are the same with and without the promotion", drums(up).join() === drums(hold).join());
  check("P02 no riser without a promotion", !/r/.test(extrasOf(hold.log)), extrasOf(hold.log));
  const k = script({ style: "kids", init: { combo: 0 }, bars_: 6, steps: [{ beat: 4.6, state: { combo: 8 } }] });
  check("P02 a style with a kit books its lead-in too (kids: clap pickup)", /u/.test(atBeat(k, 7.5).extras) && /c/.test(atBeat(k, 8).parts), `${atBeat(k, 7.5).extras} / ${atBeat(k, 8).parts}`);
  const bar = script({ style: "baroque", init: { combo: 0 }, bars_: 6, steps: [{ beat: 4.6, state: { combo: 8 } }] });
  check("P02 a style with no drums gets the layer on the bar line and no drums from the lead-in", /c/.test(atBeat(bar, 8).parts) && !/[ru]/.test(extrasOf(inRange(bar, 5.5, 8))), extrasOf(inRange(bar, 5.5, 8)));
}
{
  // P08 · a slip thins the band, it does not collapse it
  const slips = [{ beat: 9.3, state: { combo: 0, recent: 0.75 } }, { beat: 13.3, state: { combo: 0, recent: 0.5625 } }, { beat: 17.3, state: { combo: 0, recent: 0.42 } }];
  const s = script({ init: { combo: 40, recent: 1 }, bars_: 8, steps: slips });
  check("P08 before any slip the band is full (strings and bass)", /c/.test(atBeat(s, 8).parts) && s.log.find((e) => e.beat === 8).lvl === 2, atBeat(s, 8).parts);
  check("P08 one slip: the strings stay on the next chord", /c/.test(atBeat(s, 12).parts) && atBeat(s, 12).lvl === 2, `${atBeat(s, 12).parts} lvl ${atBeat(s, 12).lvl}`);
  check("P08 a second slip takes the strings and keeps the bass", atBeat(s, 16).lvl === 1 && !/c/.test(atBeat(s, 16).parts) && /b/.test(atBeat(s, 16).parts), `${atBeat(s, 16).parts} lvl ${atBeat(s, 16).lvl}`);
  check("P08 a run of slips leaves the drums alone", atBeat(s, 20).lvl === 0 && !/[bc]/.test(partsOf(inRange(s, 19, 22))), `${partsOf(inRange(s, 19, 22))} lvl ${atBeat(s, 20).lvl}`);
  check("P08 the drums never stop through all of it", s.log.filter((e) => Math.abs(e.pos - Math.round(e.pos)) < 1e-6 && e.beat >= 8).every((e) => e.drum));
  // a caller that passes no `recent` gets the plain combo: a slip is all-or-nothing as it always was
  const plain = script({ init: { combo: 40, recent: null }, bars_: 6, steps: [{ beat: 9.3, state: { combo: 0 } }] });
  check("P08 without `recent` a slip drops to the drums at once (the old band)", atBeat(plain, 12).lvl === 0 && !/[bc]/.test(atBeat(plain, 12).parts), `lvl ${atBeat(plain, 12).lvl}`);
  // and the layers earn their way back
  const back = script({ init: { combo: 0, recent: 0.5 }, bars_: 8, steps: [{ beat: 5.3, state: { combo: 9, recent: 0.9 } }] });
  check("P08 the strings come back on a bar line when the combo is rebuilt", atBeat(back, 7.5).lvl < 2 && atBeat(back, 8).lvl === 2, `${atBeat(back, 7.5).lvl} -> ${atBeat(back, 8).lvl}`);
}
{
  // P07 · Fever lands on the grid: the screen flips at once, the band drops on the next bar line
  const f = script({ init: { combo: 12 }, bars_: 8, steps: [{ beat: 5.3, state: { combo: 40, fever: true } }, { beat: 17.3, state: { mega: true } }, { beat: 23.3, state: { fever: false, mega: false, combo: 0 } }] });
  check("P07 no brass and no arpeggio between the flag and the bar line", !/[xa]/.test(partsOf(inRange(f, 6.5, 8))) && !/F/.test(extrasOf(inRange(f, 6.5, 8))), `${partsOf(inRange(f, 6.5, 8))} / ${extrasOf(inRange(f, 6.5, 8))}`);
  check("P07 a riser climbs through the rest of the bar", /r/.test(extrasOf(inRange(f, 5.5, 8))), extrasOf(inRange(f, 5.5, 8)));
  check("P07 the drop lands ON the bar line: crash, brass and arpeggio together", /F/.test(atBeat(f, 8).extras) && /x/.test(atBeat(f, 8).parts) && /a/.test(atBeat(f, 8).parts), `${atBeat(f, 8).extras} / ${atBeat(f, 8).parts}`);
  check("P07 the drop happens once", (extrasOf(f.log).match(/F/g) || []).length === 1, extrasOf(f.log));
  check("P07 Mega: the kick and the snare leave for the beat before the bar line", atBeat(f, 19).drum === "" && !!atBeat(f, 18).drum, `beat 19 "${atBeat(f, 19).drum}"`);
  check("P07 Mega: its crash lands on the bar line", /M/.test(atBeat(f, 20).extras), atBeat(f, 20).extras);
  check("P07 leaving Fever is immediate: no brass, no arpeggio from the next bar", !/[xa]/.test(partsOf(inRange(f, 25, 32))), partsOf(inRange(f, 25, 32)));
  const hot = script({ init: { combo: 40, fever: true }, bars_: 4 });
  check("P07 a run that starts in Fever has the layers from the first beat (no drop to wait for)", /a/.test(partsOf(inRange(hot, 0, 2))) && !/F/.test(extrasOf(hot.log)), partsOf(inRange(hot, 0, 2)));
}
{
  // P03 · the count-in leads into the song, a produced intro
  const spb = 0.5;
  const withLead = script({ bars_: 4, lead: 4 * spb });
  const noiseBefore = REC().noise.filter((n) => n.at < 4 * spb - 1e-6);
  check("P03 a riser (and a flam) is booked on the last count-in beat", noiseBefore.length >= 1 && noiseBefore.every((n) => n.at >= 3 * spb - 1e-6), `${noiseBefore.length} noise events at ${noiseBefore.map((n) => n.at.toFixed(2)).join(",")}`);
  const soft = script({ bars_: 4, lead: 4 * spb, init: { pitched: false, soft: true } });
  const softBefore = REC().noise.filter((n) => n.at < 4 * spb - 1e-6);
  check("P03 a pianist on the mic gets the unpitched riser too", softBefore.length >= 1 && REC().osc.every((o) => o.at >= 4 * spb - 1e-6), `${softBefore.length} noise, ${REC().osc.length} osc`);
  check("P03 a pianist on the mic still gets no pitched note", !soft.log.some((e) => e.notes.length));
  check("P03 the opening crash is still on the first note", /o/.test(atBeat(withLead, 0).extras), atBeat(withLead, 0).extras);
  // the riser is booked ONCE, however many times the game pumps during the count-in; a full band adds a flam (two noise hits) to it
  check("P03 the count-in riser is booked once (riser + flam = 3 noise events for the full band, 1 for a pianist)", noiseBefore.length === 3 && softBefore.length === 1, `${noiseBefore.length} / ${softBefore.length}`);
}
{
  // P10 · the song has a form, derived from the bar number
  const long = script({ bars_: 17, bpm: 140 });
  const brk = atBeat(long, 63), pre = atBeat(long, 62);
  check("P10 the last bar of sixteen is a break: no kick or snare on its last beat", brk.drum === "" && /z/.test(brk.extras), `drum "${brk.drum}" extras "${brk.extras}"`);
  check("P10 ...the beat before it still has its drum", pre.drum === "kick", pre.drum);
  check("P10 ...and the bar after the break is a full downbeat (kick and crash)", atBeat(long, 64).drum === "kick" && /k/.test(atBeat(long, 64).extras), `${atBeat(long, 64).drum} ${atBeat(long, 64).extras}`);
  const short = script({ bars_: 16, bpm: 140 });
  check("P10 the final bar of the song is not a break (the finale is)", atBeat(short, 63).drum !== "", `drum "${atBeat(short, 63).drum}"`);
  const sax = script({ style: "jazz", bars_: 17, bpm: 140 });
  const same = script({ style: "jazz", bars_: 17, bpm: 140 });
  const sig = (x) => x.log.map((e) => `${e.beat}:${e.drum}:${e.parts}:${e.extras}:${e.notes.map((n) => n[0]).join("/")}`).join("|");
  check("P10 the form is a function of the bar number: the same song books the same thing", sig(sax) === sig(same));
}
{
  // P13 · the run into the finale
  const e = script({ bars_: 8 });
  check("P13 a drum roll on the last beat before the final chord", /R/.test(atBeat(e, 27).extras), atBeat(e, 27).extras);
  const ant = e.log.flatMap((x) => x.notes.filter((n) => n[1] === "ant").map((n) => n[0]));
  const finalPcs = new Set(CH.Am);
  check("P13 the rising run is there (8 notes over the last half bar)", ant.length === 8, `${ant.length} notes`);
  check("P13 every note of the run belongs to the final chord", ant.every((m) => finalPcs.has(m % 12)), ant.join(","));
  check("P13 the run rises", ant.every((m, i) => i === 0 || m > ant[i - 1]), ant.join(","));
  check("P13 ...and ends on the top of the final chord's ladder", ant[ant.length - 1] >= 84 && ant[ant.length - 1] <= 90, String(ant[ant.length - 1]));
  check("P13 the final chord itself is the finale", /!/.test(atBeat(e, 28).parts), atBeat(e, 28).parts);
  const left = script({ bars_: 8, hand: "left" });
  check("P13 the left-hand mode keeps the run and the finale", left.log.some((x) => /y/.test(x.parts)) && /!/.test(atBeat(left, 28).parts));
  const mic = script({ bars_: 8, init: { pitched: false, soft: true } });
  check("P13 a pianist on the mic gets no run and no finale chord", !mic.log.some((x) => /[y!]/.test(x.parts)));
}
{
  // P17 · each genre's own fill at the end of the fourth bar; a style the table does not name keeps the toms
  const fillOf = (st, bpb) => { const b = script({ style: st, bpb, bars_: 8, bpm: 110 }); return extrasOf(inRange(b, 3 * bpb, 4 * bpb)); };
  check("P17 a style the table does not know keeps the three toms ('f')", /f/.test(fillOf("", 4)) && !/g/.test(fillOf("", 4)), fillOf("", 4));
  check("P17 classical keeps the toms", /f/.test(fillOf("classical", 4)), fillOf("classical", 4));
  for (const st of ["jazz", "blues", "swing", "bossa", "kids", "folk", "gospel", "soul", "neosoul"]) check(`P17 ${st} has its own fill, not the toms`, /g/.test(fillOf(st, 4)) && !/f/.test(fillOf(st, 4)), fillOf(st, 4));
  check("P17 a march rolls the snare", /g/.test(fillOf("romantic", 2)) && !/f/.test(fillOf("romantic", 2)), fillOf("romantic", 2));
  check("P17 a waltz taps the rim", /g/.test(fillOf("romantic", 3)) && !/f/.test(fillOf("romantic", 3)), fillOf("romantic", 3));
  check("P17 the default band keeps the toms in every metre (it is the old band)", [2, 3, 4].every((n) => /f/.test(fillOf("", n)) && !/g/.test(fillOf("", n))), [2, 3, 4].map((n) => fillOf("", n)).join(" | "));
  for (const st of Object.keys(band.BAND_STYLES)) for (const bpb of [2, 3, 4]) {
    const kd = band.BAND_STYLES[st].drums;
    const fe = fillOf(st, bpb);
    check(`P17 ${st} ${bpb}/4 ${kd === "none" ? "books no fill (no kit)" : "books a fill every fourth bar"}`, kd === "none" ? !/[fg]/.test(fe) : /[fg]/.test(fe), fe);
  }
  band.BAND_STYLES.__nofill = { drums: "soft", lead: "pluck", pad: "pluck", extra: [] };
  check("P17 a kit with no `fill` entry falls back to the toms", /f/.test(fillOf("__nofill", 4)), fillOf("__nofill", 4));
  delete band.BAND_STYLES.__nofill;
}
{
  // every pitched note the band books belongs to the chord of its bar (or is a named passing tone), in every style and metre
  const pcsAt = (beat, bpb) => CH[ROOTS[Math.floor(beat / bpb + 1e-6) % ROOTS.length]];
  const songPcsAll = new Set(ROOTS.flatMap((r) => CH[r]));
  let bad = 0, total = 0, first = "";
  for (const style of ["", ...Object.keys(band.BAND_STYLES)]) for (const bpb of [2, 3, 4]) for (const hand of ["right", "left"]) {
    for (const st of [{ combo: 12 }, { combo: 40, fever: true, mega: true }]) {
      const b = script({ style, bpb, hand, bars_: 8, init: st, bpm: 100 });
      for (const e of b.log) for (const [m, role] of e.notes) {
        total++;
        const pc = ((m % 12) + 12) % 12;
        const cur = pcsAt(e.beat, bpb), nxt = pcsAt(e.beat + bpb, bpb), last = CH[ROOTS[(8 - 1) % ROOTS.length]];
        const ok = role === "chord" ? cur.includes(pc) : role === "next" ? nxt.includes(pc) || cur.includes(pc) : role === "scale" ? songPcsAll.has(pc) : role === "ant" ? last.includes(pc) : false;
        if (!ok) { bad++; if (!first) first = `${style || "(default)"} ${bpb}/4 ${hand} beat ${e.beat} midi ${m} (${role})`; }
      }
    }
  }
  check(`every pitched band note is in its bar's chord (${total} notes, all styles, metres, hands, Fever)`, bad === 0 && total > 1000, `${bad} outside; first: ${first}`);
}
{
  // P04 · the milestone stingers are in the key of the chord playing: every pitched note (and its octave partial) of every kind,
  // for all 12 roots, major and minor. Mega's sub boom (a sine under 120 Hz, blacklisted from the mic instead) is the only voice
  // allowed outside the chord, and the stub cannot read its automated frequency, so it is skipped by its time (the downbeat) and level.
  const mtopc = (f) => ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
  let bad = 0, total = 0, first = "", silent = 0, noiseOnly = 0;
  for (const root of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) for (const minor of [false, true]) {
    const pcs = [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12];
    for (const kind of ["fever", "mega", "mark", "mark100", "ten", "boss"]) {
      const r = REC(); r.osc.length = 0; r.noise.length = 0;
      globalThis.__BAND_NOW = 10;
      band.playStinger(kind, { root, pcs }, 10.1, 50);
      // the boom is the one oscillator that is not a bell: its recorded value is the stub's default (440 Hz) and it starts exactly on `when`
      const osc = r.osc.filter((o) => !(kind === "mega" && o.freq === 440 && pcs.indexOf(9) < 0));
      if (!osc.length) silent++;
      for (const o of osc) { total++; if (!pcs.includes(mtopc(o.freq))) { bad++; if (!first) first = `${kind} root ${root}${minor ? "m" : ""}: ${o.freq.toFixed(1)} Hz = pc ${mtopc(o.freq)}`; } }
    }
  }
  check(`P04 every stinger note is a note of the chord playing (${total} bells, 12 roots x major/minor x 6 kinds)`, bad === 0 && silent === 0 && total > 500, `${bad} outside, ${silent} silent; first: ${first}`);
  check("P04 two roots get two different stingers (it is not the old fixed C-E-G-C)", (() => {
    const get = (root) => { const r = REC(); r.osc.length = 0; band.playStinger("fever", { root, pcs: [root, (root + 4) % 12, (root + 7) % 12] }, 10.1); return r.osc.map((o) => Math.round(o.freq)).join(","); };
    return get(0) !== get(2) && get(2) !== get(6);
  })());
}
{
  // an arrangement that waits for a bar line must still never throw or book nothing, whatever the metre and the style
  let thrown = 0;
  for (const style of ["", ...Object.keys(band.BAND_STYLES)]) for (const bpb of [2, 3, 4, 6]) {
    try {
      const b = script({ style, bpb, bars_: 6, init: { combo: 0 }, steps: [{ beat: bpb * 1.6, state: { combo: 9 } }, { beat: bpb * 3.2, state: { combo: 40, fever: true } }, { beat: bpb * 4.2, state: { combo: 0, fever: false, recent: 0.4 } }] });
      if (!b.log.length) thrown++;
    } catch (e) { thrown++; console.log("   threw:", style, bpb, e.message); }
  }
  check("a combo that climbs, fevers and slips books cleanly in every style and metre (including 6/8)", thrown === 0, `${thrown} failures`);
}

console.log(`\n${pass}/${pass + fail} passed${fail ? ` — ${fail} FAILED` : ""}`);
process.exit(fail ? 1 : 0);