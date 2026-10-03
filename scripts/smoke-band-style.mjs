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

console.log(`\n${pass}/${pass + fail} passed${fail ? ` — ${fail} FAILED` : ""}`);
process.exit(fail ? 1 : 0);