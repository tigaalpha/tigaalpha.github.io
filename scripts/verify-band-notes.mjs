#!/usr/bin/env node
/* verify-band-notes.mjs — does the band only play notes that belong to the song?

   node scripts/verify-band-notes.mjs

   The band is an arrangement now (voice-led pads, walking bass, a counter-line, a harp run into the last chord, brass, an arpeggio),
   and every one of those is chosen by code from the song's own chords. A wrong note in a backing track is the one mistake a learner
   hears at once and cannot explain, so this checks it instead of trusting the code: it drives the REAL play-along-band.ts, with the
   chords the game really derives (songChordBars) for real songs from songs-data.ts, through a combo that climbs, goes into Fever and
   Mega, slips and recovers, in both hands, and tests every pitched note the band books (band.log[].notes, [midi, role]):

     chord   a note of the chord playing at that beat (root, third, fifth)
     next    a note of the NEXT chord (the bass stepping into it), or of the current one
     scale   a pitch class that some chord of the song uses (the walking bass passing through the song's own scale)
     ant     a note of the song's LAST chord (the run that leads into the finale)

   plus: every note is a real MIDI number in a playable range, every booking time is finite, and the band never throws. No speakers:
   the audio context is a recorder (the same trick scripts/smoke-band-style.mjs uses). */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-band-notes";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p`, { recursive: true });

const STUB = `
export let _sfxMuted = false, _micSafe = false;
function param(v) { return { value: v, setValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, setTargetAtTime() { return this; }, cancelScheduledValues() { return this; } }; }
function node(extra) { return Object.assign({ connect() {}, disconnect() {} }, extra); }
const AC = {
  get currentTime() { return globalThis.__BAND_NOW || 0; },
  sampleRate: 44100, destination: node({}),
  createGain: () => node({ gain: param(1) }),
  createOscillator() { return node({ type: "sine", frequency: param(440), detune: param(0), start() {}, stop() {} }); },
  createBiquadFilter: () => node({ type: "lowpass", frequency: param(350), Q: param(1), gain: param(0), detune: param(0) }),
  createDelay: () => node({ delayTime: param(0) }),
  createWaveShaper: () => node({ curve: null, oversample: "none" }),
  createDynamicsCompressor: () => node({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }),
  createBufferSource() { return node({ buffer: null, loop: false, start() {}, stop() {} }); },
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len), length: len }; },
  createStereoPanner() { return node({ pan: param(0) }); },
};
const _bus = node({});
export function audioBus() { return { ac: AC, bus: _bus }; }
export function _accMarkSuppress() {}
export function hfPing() {}
export function playCrowd() {}
export function _accNoise(ac) { return ac.createBuffer(1, 4410, 44100); }
`;
const SRC = readFileSync("play-along-band.ts", "utf8");
if (!SRC.includes('from "./music-engine"')) { console.error("play-along-band.ts no longer imports ./music-engine"); process.exit(1); }
writeFileSync(`${OUT}/p/music-engine.ts`, STUB);
writeFileSync(`${OUT}/p/play-along-band.ts`, SRC);
execSync(`npx esbuild ${OUT}/p/play-along-band.ts --bundle --outfile=${OUT}/band.js --format=esm --platform=node`, { stdio: "pipe" });
execSync(`npx esbuild music-engine.tsx --bundle --format=esm --platform=node --external:react --outfile=${OUT}/me.js`, { stdio: "pipe" });
execSync(`npx esbuild songs-data.ts --bundle --format=esm --platform=node --outfile=${OUT}/songs.js`, { stdio: "pipe" });
const band = await import(pathToFileURL(join(process.cwd(), OUT, "band.js")).href);
const me = await import(pathToFileURL(join(process.cwd(), OUT, "me.js")).href);
const { SONGS, SONG_GENRES, SONG_TIMESIG } = await import(pathToFileURL(join(process.cwd(), OUT, "songs.js")).href);

const _PCI = me._PCI;
const noteMidi = (n) => { const m = /^([A-G][#b]?)(-?\d+)$/.exec(n); if (!m) return null; const pc = _PCI[m[1].toUpperCase()]; return pc == null ? null : (parseInt(m[2], 10) + 1) * 12 + pc; };
const bpbOf = (id) => parseInt(String(SONG_TIMESIG[id] || "4/4").split("/")[0], 10) || 4;
const pcm = (x) => ((x % 12) + 12) % 12;

// a spread of real songs: up to four per genre (preferring different metres), plus the songs the app has no genre for
const byGenre = new Map();
for (const s of SONGS) {
  if (!s.seq || !s.bpm || s.seq.length < 8) continue;
  const g = SONG_GENRES[s.id] || "(none)";
  const arr = byGenre.get(g) || [];
  if (arr.length < 4 && !arr.some((x) => bpbOf(x.id) === bpbOf(s.id) && arr.length >= 2)) arr.push(s);
  byGenre.set(g, arr);
}
const picks = [...byGenre.entries()].flatMap(([g, arr]) => arr.map((s) => ({ g, s })));

let notes = 0, bad = 0, songsRun = 0, thrown = 0;
const badList = [];
const roles = { chord: 0, next: 0, scale: 0, ant: 0, other: 0 };
const perStyle = new Map();

function drive(song, style, hand, plan) {
  const bpb = bpbOf(song.id);
  const pickup = typeof me.pickupBeatsOf === "function" ? (me.pickupBeatsOf(song.seq, bpb) || 0) : 0;
  let bars = me.songChordBars(song, pickup, { split: true, primary: true });
  if (!bars.length) return;
  bars = bars.filter((b) => b.at < pickup + 24 * bpb);        // 24 bars is long enough to reach every part of the arrangement
  const endBeat = bars[bars.length - 1].at + bars[bars.length - 1].len;
  const mel = []; let beat = 0;
  for (const [n, d] of song.seq) { if (n !== "R") { const midi = noteMidi(n); if (midi != null && beat < endBeat) mel.push({ beat, dur: d, midi }); } beat += d; }
  const spb = 60 / song.bpm;
  const b = band.createBand({ bars, beatsPerBar: bpb, pickup, spb, lead: 0, endBeat, hand, level: 2, bpm: song.bpm, style, mel });
  b.setState({ combo: 0, fever: false, mega: false, pitched: true, soft: false, micOpen: true, recent: 1 });
  const chordOf = (bt) => { let c = bars[0]; for (const x of bars) { if (x.at <= bt + 1e-6) c = x; else break; } return c; };
  const songPcs = new Set(); for (const x of bars) for (let i = 0; i < Math.min(3, x.pcs.length); i++) songPcs.add(pcm(x.pcs[i]));
  const lastC = bars[bars.length - 1];
  const todo = plan(bpb).map((p) => ({ ...p })).sort((x, y) => x.beat - y.beat);
  const seen = new WeakSet();
  let clock = 0;
  const scan = () => {
    for (const e of b.log) {
      if (seen.has(e)) continue; seen.add(e);
      if (!Number.isFinite(e.when) || !Number.isFinite(e.beat)) { bad++; badList.push(`${song.id}: non-finite booking time`); }
      const cur = chordOf(e.beat), nxt = bars.find((x) => x.at > cur.at + 1e-6) || cur;
      for (const [m, role] of e.notes) {
        notes++; roles[role] = (roles[role] || 0) + 1;
        const pc = pcm(m);
        const trip = (c) => [0, 1, 2].map((i) => pcm(c.pcs[i] == null ? c.root : c.pcs[i]));
        const ok = Number.isInteger(m) && m >= 24 && m <= 108 && (
          role === "chord" ? trip(cur).includes(pc)
          : role === "next" ? trip(nxt).includes(pc) || trip(cur).includes(pc)
          : role === "scale" ? songPcs.has(pc)
          : role === "ant" ? trip(lastC).includes(pc)
          : false);
        if (!ok) { bad++; if (badList.length < 12) badList.push(`${song.id} [${style || "default"} ${bpb}/4 ${hand}] beat ${e.beat} midi ${m} (${role}) over ${JSON.stringify(cur.pcs)} root ${cur.root}`); }
      }
    }
  };
  for (let i = 0; i < 6000 && clock < (endBeat + 6) * spb + 3; i++) {
    while (todo.length && todo[0].beat * spb <= clock) b.setState(todo.shift().state);
    globalThis.__BAND_NOW = clock;
    b.pump(clock, (t) => t, 1);
    scan();
    clock += 0.06;
  }
  songsRun++;
  perStyle.set(style || "(default)", (perStyle.get(style || "(default)") || 0) + 1);
}

const ride = (bpb) => [
  { beat: bpb * 1.5, state: { combo: 9 } },
  { beat: bpb * 3.5, state: { combo: 30, fever: true } },
  { beat: bpb * 6.5, state: { combo: 60, mega: true } },
  { beat: bpb * 9.2, state: { combo: 0, fever: false, mega: false, recent: 0.6 } },
  { beat: bpb * 11.5, state: { combo: 12, recent: 0.9 } },
  { beat: bpb * 14.5, state: { combo: 40, fever: true, mega: true, recent: 1 } },
];
const hot = () => [{ beat: 0, state: { combo: 40, fever: true, mega: true } }];

for (const { g, s } of picks) {
  const style = band.BAND_STYLES[g] ? g : "";
  for (const hand of ["right", "left"]) {
    for (const plan of [ride, hot]) {
      try { drive(s, style, hand, plan); } catch (e) { thrown++; badList.push(`${s.id} [${style || "default"} ${hand}] threw: ${e.message}`); }
    }
  }
}

console.log(`${songsRun} runs over ${picks.length} real songs, ${[...perStyle.keys()].length} styles: ${notes} pitched notes booked (${Object.entries(roles).map(([k, v]) => `${k} ${v}`).join(", ")})`);
if (badList.length) for (const l of badList) console.log("  BAD " + l);
const ok = bad === 0 && thrown === 0 && notes > 5000 && roles.ant > 0 && roles.next > 0 && roles.scale > 0;
console.log(ok ? "PASS every pitched note the band books belongs to its bar's chord or to the song's scale, nothing threw" : `FAIL ${bad} notes outside the chord, ${thrown} throws, ${notes} notes in total`);
rmSync(OUT, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
