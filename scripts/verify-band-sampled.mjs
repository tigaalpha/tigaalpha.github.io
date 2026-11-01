/* verify-band-sampled.mjs — the band with real instrument samples against the same band synthesised, rendered offline in Chromium (OfflineAudioContext, no speakers needed).

   Serves public/ over HTTP so the real loader (fetch + decodeAudioData of the shipped MP3s) runs, bundles the real play-along-band.ts with the lab's music-engine stub, renders each
   styled scenario twice (samples off / samples on) and checks that the sampled band is a drop-in: nothing clips, the level stays within 2 dB of the synthesised band, no extra energy
   in the player's octave (800-2500 Hz), the mic blacklist marks every sampled note too, and the samples really were used (and not used for the default band).

     node scripts/verify-band-sampled.mjs        (calibrate: SAMPLE_K in play-along-band.ts, from the dB differences printed here) */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

let pwm;
try { pwm = await import("playwright"); } catch (e) {
  try { pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); }
  catch (e2) { console.error("Playwright is not installed (npm i -g playwright)."); process.exit(1); }
}
const pw = pwm.chromium ? pwm : pwm.default;
const EXE = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const OUT = path.resolve("node_modules/.cache/pa-band-sampled");
fs.mkdirSync(OUT, { recursive: true });

// ── what the band imports from music-engine, on an offline context ──
const STUB = `
let _ac = null, _bus = null;
export let _sfxMuted = false, _micSafe = false;
export function __setContext(ac, path) {
  _ac = ac; _bus = ac.createGain(); _bus.gain.value = 0.9;
  if (!path) { _bus.connect(ac.destination); return; }
  // what a phone speaker plays (nothing below ~300 Hz, nothing above ~9 kHz), or only the middle of the
  // spectrum (700 Hz – 5 kHz), where the strings, the brass and the plucks live and the bass does not
  const mid = path === "mid";
  const hp1 = ac.createBiquadFilter(), hp2 = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
  hp1.type = hp2.type = "highpass"; hp1.frequency.value = hp2.frequency.value = mid ? 700 : 300; hp1.Q.value = hp2.Q.value = 0.7;
  lp.type = "lowpass"; lp.frequency.value = mid ? 5000 : 9000;
  _bus.connect(hp1); hp1.connect(hp2); hp2.connect(lp); lp.connect(ac.destination);
}
export function audioBus() { return { ac: _ac, bus: _bus }; }
export const __marks = [];
export function _accMarkSuppress(freq, tol, until) { __marks.push({ freq, tol }); }
export function hfPing(ac, dest, t0, f, vol, tail) {
  const src = ac.createBufferSource(); src.buffer = _accNoise(ac); src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + tail);
  src.connect(bp); bp.connect(g); g.connect(dest); src.start(t0); src.stop(t0 + tail + 0.03);
}
export function playCrowd() {}
let _buf = null;
export function _accNoise(ac) {
  if (_buf) return _buf;
  const len = Math.floor(ac.sampleRate * 0.3), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  let s = 12345; for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  _buf = b; return b;
}
`;
// ── the page: render one scenario and measure it ──
const PAGE = `
import * as B from "__BAND__";
import * as ME from "__STUB__";
import * as S from "__SAMPLES__";
const SR = 44100;
const CH = { C: [0, 4, 7], F: [5, 9, 0], G: [7, 11, 2], Am: [9, 0, 4] }, ROOT = { C: 0, F: 5, G: 7, Am: 9 };
window.__render = async function (cfg) {
  const { seconds = 27, bpm = 100, bpb = 4, hand = "right", level = 2, style = "", segs, prog, phone = false } = cfg;
  ME.__marks.length = 0;
  const real = new OfflineAudioContext(2, Math.round(SR * seconds), SR);
  S._clearBandSamples(); S._stats.played = 0; S._stats.by = {};
  let loaded = null; if (cfg.samples) { loaded = await B.preloadBandSamples(real, style); if (cfg.only) for (const nm of B.bandSampleNames(style)) if (!cfg.only.includes(nm)) S._unloadBandSample(nm); }
  let fake = 0;
  // the band reads ac.currentTime for its look-ahead window: hand it a clock advanced by hand
  const ac = new Proxy(real, { get(t, k) { if (k === "currentTime") return fake; const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
  ME.__setContext(ac, phone);
  const spb = 60 / bpm, lead = 2.4, bars = []; let at = 0;
  for (const name of prog) { const len = bpb === 4 ? 2 : bpb; bars.push({ at, len, root: ROOT[name], quality: "maj", pcs: CH[name] }); at += len; }
  const endBeat = at;
  const band = B.createBand({ bars, beatsPerBar: bpb, pickup: 0, spb, lead, endBeat, hand, level, bpm, style });
  const stateAt = (beat) => { let st = {}; for (const [from, s] of segs) if (beat >= from) st = { ...st, ...s }; return st; };
  const songEnd = lead + endBeat * spb + 3;
  for (let t = 0; t < songEnd; t += 0.06) { fake = t; band.setState(stateAt((t - lead) / spb)); band.pump(t, x => x, 1, 0); }
  const buf = await real.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const rmsDb = (a, b) => { let s = 0, c = 0; for (let i = Math.floor(a * SR); i < Math.min(n, Math.floor(b * SR)); i++) { const v = (L[i] + R[i]) / 2; s += v * v; c++; } return 20 * Math.log10(Math.sqrt(s / Math.max(1, c)) + 1e-9); };
  let peak = 0, clip = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a > 0.99) clip++; }
  // a spectrogram, log-frequency, for a human to look at
  const N = 2048, hop = 1024, frames = Math.floor((n - N) / hop), cw = Math.min(1200, frames), H = 200;
  const fft = (re, im) => { const m = re.length; for (let i = 1, j = 0; i < m; i++) { let bit = m >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } } for (let len = 2; len <= m; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < m; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const tt = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = tt; } } } };
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = H; const cx = cv.getContext("2d"); cx.fillStyle = "#000"; cx.fillRect(0, 0, cw, H);
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let fr = 0; fr < frames; fr++) {
    for (let i = 0; i < N; i++) { re[i] = ((L[fr * hop + i] + R[fr * hop + i]) / 2) * win[i]; im[i] = 0; }
    fft(re, im);
    const x = Math.floor(fr / frames * cw), col = new Float32Array(H);
    for (let k = 1; k < N / 2; k++) { const f = k * SR / N; if (f < 40 || f > 12000) continue; const y = H - 1 - Math.floor(Math.log(f / 40) / Math.log(300) * (H - 1)); col[y] = Math.max(col[y], Math.hypot(re[k], im[k]) / N); }
    for (let y = 0; y < H; y++) { const v = Math.max(0, Math.min(1, (20 * Math.log10(col[y] + 1e-9) + 90) / 60)); if (v > 0.02) { cx.fillStyle = "rgb(" + Math.round(255 * Math.min(1, v * 1.6)) + "," + Math.round(255 * Math.max(0, v * 1.6 - 0.6)) + "," + Math.round(255 * v * 0.5) + ")"; cx.fillRect(x, y, 2, 1); } }
  }
  const lastNoteEnd = lead + endBeat * spb;
  // where the energy sits (one big FFT of the mono mix): <250, 250-800, 800-2500, >2500 Hz
  let share = [0, 0, 0, 0], bandDb = [0, 0, 0, 0]; { let m = 1; while (m < n) m <<= 1; m = Math.min(m, 1 << 21); const re = new Float32Array(m), im = new Float32Array(m); for (let i = 0; i < Math.min(n, m); i++) re[i] = (L[i] + R[i]) / 2; fft(re, im); let tot = 0; for (let k = 1; k < m / 2; k++) { const f = k * SR / m, e = re[k] * re[k] + im[k] * im[k]; tot += e; share[f < 250 ? 0 : f < 800 ? 1 : f < 2500 ? 2 : 3] += e; } bandDb = share.map(x => +(10 * Math.log10(x / (m * m) + 1e-30)).toFixed(1)); share = share.map(x => +(100 * x / tot).toFixed(2)); }
  return {
    bandDb, share, played: S._stats.played, by: { ...S._stats.by }, loaded, peak, clip, marks: ME.__marks.slice(), log: band.log.map(e => ({ beat: e.beat, when: e.when, drum: e.drum, parts: e.parts, extras: e.extras || "" })),
    // the four phases of the build scenario (beats 0–8, 8–16, 16–24, 24+), and the finale's tail
    phase: [0, 8, 16, 24].map((b, i) => +rmsDb(lead + (b + 1) * spb, lead + (b + (i < 3 ? 8 : 6)) * spb).toFixed(1)),
    whole: +rmsDb(lead + spb, lead + (endBeat - 1) * spb).toFixed(1),
    tail: +rmsDb(lastNoteEnd + 0.1, lastNoteEnd + 1.1).toFixed(1),
    png: cv.toDataURL("image/png"),
  };
};
`;
const PROG = ["C", "C", "F", "C", "C", "F", "G", "C", "C", "F", "C", "F", "Am", "F", "G", "C"];
const CLEAN = { combo: 0, fever: false, mega: false, pitched: true, soft: false, micOpen: false };
const SCEN = {
  build: { segs: [[-99, CLEAN], [8, { combo: 3 }], [16, { combo: 8 }], [24, { combo: 24, fever: true }], [28, { combo: 30, mega: true }]] },
  fever: { segs: [[-99, { ...CLEAN, combo: 30, fever: true }]] },
  soft: { segs: [[-99, { ...CLEAN, combo: 30, pitched: false, soft: true }]] },
  mic: { segs: [[-99, { ...CLEAN, combo: 30, fever: true, micOpen: true }]] },
  waltz: { bpb: 3, bpm: 120, segs: [[-99, { ...CLEAN, combo: 30, fever: true }]] },
  left: { hand: "left", segs: [[-99, { ...CLEAN, combo: 30, fever: true }]] },
  // plan 23: the band's new fourth level, and the styles that pick their own kit
  full: { level: 3, segs: [[-99, { ...CLEAN, combo: 30, fever: true, mega: true }]] },
  baroque: { style: "baroque", bpb: 3, bpm: 96, segs: [[-99, { ...CLEAN, combo: 30 }]] },
  jazz: { style: "jazz", segs: [[-99, { ...CLEAN, combo: 30, fever: true }]] },
  romance: { style: "romantic", segs: [[-99, { ...CLEAN, combo: 30 }]] },
};

const dir = path.join(OUT, "src"); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "stub.js"), STUB);
fs.writeFileSync(path.join(dir, "page.js"), PAGE);
const bandPath = path.resolve("play-along-band.ts");
const plug = { name: "stub", setup(b) {
  b.onResolve({ filter: /music-engine$/ }, () => ({ path: path.join(dir, "stub.js") }));
  b.onResolve({ filter: /^__BAND__$/ }, () => ({ path: bandPath }));
  b.onResolve({ filter: /^__SAMPLES__$/ }, () => ({ path: path.resolve("band-samples.ts") }));
  b.onResolve({ filter: /^__STUB__$/ }, () => ({ path: path.join(dir, "stub.js") }));
} };
const bundle = await build({ entryPoints: [path.join(dir, "page.js")], bundle: true, format: "iife", write: false, plugins: [plug], loader: { ".ts": "ts" }, logLevel: "error" });

import http from "node:http";
const PUB = path.resolve("public");
const server = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split("?")[0]); const f = u === "/" ? null : path.join(PUB, u); if (!f) { s.writeHead(200, { "content-type": "text/html" }); return s.end("<!doctype html><meta charset=utf8><body></body>"); } if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : f.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream" }); s.end(fs.readFileSync(f)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const URL = "http://127.0.0.1:" + server.address().port + "/";
const browser = await pw.chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
await page.goto(URL);
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const run = async (name, extra = {}) => {
  const r = await page.evaluate((cfg) => window.__render(cfg), { prog: PROG, ...SCEN[name], ...extra });
  fs.writeFileSync(path.join(OUT, `${name}${extra.phone ? "-phone" : ""}.png`), Buffer.from(r.png.replace(/^data:image\/png;base64,/, ""), "base64"));
  return r;
};

const STYLES_DIAG = { romantic: { style: 'romantic' }, kids: { style: 'kids' }, baroque: { style: 'baroque', bpb: 3, bpm: 96 } };
const FEVER = { segs: [[-99, { ...CLEAN, combo: 30, fever: true }]] };
if (process.env.DIAG) {
  const style = process.env.DIAG, cfg = STYLES_DIAG[style] || { style };
  const base = await page.evaluate((c) => window.__render(c), { prog: PROG, ...FEVER, ...cfg, samples: false });
  console.log("synth", base.whole, "bands dB (<250/250-800/800-2500/>2500)", base.bandDb.join(" "));
  for (const only of [["acoustic_bass"], ["electric_bass_finger"], ["string_ensemble_1"], ["brass_section"], ["flute"]]) {
    const r = await page.evaluate((c) => window.__render(c), { prog: PROG, ...FEVER, ...cfg, samples: true, only });
    console.log(only[0].padEnd(22), "played", String(r.played).padStart(3), "whole", String(r.whole).padStart(6), "d", (r.whole - base.whole).toFixed(1).padStart(5), "bands diff", r.bandDb.map((v, i) => (v - base.bandDb[i]).toFixed(1)).join(" "));
  }
  await browser.close(); server.close(); process.exit(0);
}
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("PASS  " + msg); } else { fail++; console.log("FAIL  " + msg); } };
const db = (v) => 20 * Math.log10(v + 1e-9);
const STYLES = { romantic: { style: "romantic" }, classical: { style: "classical", bpb: 3, bpm: 96 }, gospel: { style: "gospel" }, soul: { style: "soul" }, jazz: { style: "jazz" }, kids: { style: "kids" }, baroque: { style: "baroque", bpb: 3, bpm: 96 }, impressionism: { style: "impressionism" } };
const rows = [];
for (const [name, cfg] of Object.entries(STYLES)) {
  const synth = await page.evaluate((c) => window.__render(c), { prog: PROG, ...FEVER, ...cfg, samples: false });
  const smp = await page.evaluate((c) => window.__render(c), { prog: PROG, ...FEVER, ...cfg, samples: true });
  const d = +(smp.whole - synth.whole).toFixed(1);
  rows.push({ name, synth: synth.whole, smp: smp.whole, d, sh: synth.share.join("/"), sh2: smp.share.join("/"), by: JSON.stringify(smp.by) });
  ok(smp.loaded === true, `${name}: the instruments for the style load through the real loader`);
  ok(synth.played === 0 && smp.played > 20, `${name}: samples are used only when loaded (${synth.played} off, ${smp.played} on: ${JSON.stringify(smp.by)})`);
  ok(smp.clip === 0 && db(smp.peak) <= -2, `${name}: the sampled band does not clip: peak ${db(smp.peak).toFixed(1)} dBFS (synth ${db(synth.peak).toFixed(1)})`);
  ok(Math.abs(d) <= 2, `${name}: level within 2 dB of the synthesised band: ${smp.whole} vs ${synth.whole} dB RMS (${d >= 0 ? "+" : ""}${d})`);
  const bd = smp.bandDb.map((v, i) => +(v - synth.bandDb[i]).toFixed(1));
  ok(bd[2] <= 1.0, `${name}: no more energy in the player's octave (800-2500 Hz): ${bd[2] >= 0 ? "+" : ""}${bd[2]} dB against the synthesised band`);
  ok(bd[3] <= 1.5, `${name}: no more air above 2.5 kHz: ${bd[3] >= 0 ? "+" : ""}${bd[3]} dB`);
  ok(Math.abs(bd[0]) <= 1.5, `${name}: the bass keeps its weight (below 250 Hz): ${bd[0] >= 0 ? "+" : ""}${bd[0]} dB`);
  const mic = await page.evaluate((c) => window.__render(c), { prog: PROG, segs: [[-99, { ...CLEAN, combo: 30, fever: true, micOpen: true }]], ...cfg, samples: true });
  const micS = await page.evaluate((c) => window.__render(c), { prog: PROG, segs: [[-99, { ...CLEAN, combo: 30, fever: true, micOpen: true }]], ...cfg, samples: false });
  ok(mic.marks.length >= micS.marks.length * 0.97 && mic.marks.every(m => m.freq <= 1800 && m.tol >= 45), `${name}: the mic blacklist marks every sampled note too: ${mic.marks.length} marks (synth ${micS.marks.length}), all <= 1.8 kHz`);
}
const def = await page.evaluate((c) => window.__render(c), { prog: PROG, ...FEVER, samples: true });
ok(def.played === 0, `the default band (no style) never uses a sample (${def.played} sampled notes)`);
console.table(rows);
await browser.close(); server.close();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
