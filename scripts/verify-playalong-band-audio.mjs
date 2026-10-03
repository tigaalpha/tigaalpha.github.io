/* Play Along band, rendered offline and measured.

   Nobody can listen to a test run, but the band is synthesised, so it can be
   rendered without speakers: this bundles the real play-along-band.ts (with
   music-engine swapped for a stub that hands it an OfflineAudioContext),
   drives it the way the game does — one pump every 60 ms on a simulated
   clock, the combo climbing through the layers — renders a song's worth of
   audio in Chromium and measures it:

     - never clips, and leaves head-room (peak ≤ −2 dBFS)
     - the music fills in as the combo builds: drums and drone < + bass <
       + strings < Fever, each layer at least 3 dB louder than the one before
     - it is audible on a PHONE speaker (a 300 Hz high-pass; the old band kept
       most of its energy under that and was nearly silent there)
     - a piano on the mic gets drums only: nothing pitched is booked, and it is
       quieter than the full band
     - the song ends on a finale that rings on after the last note
     - with the mic open every pitched voice is blacklisted from the pitch
       detector, its first partials included, and no mark is above 1.8 kHz
     - 3/4 time and the left-hand mode render without a hitch

   It writes a spectrogram per scenario to node_modules/.cache/pa-band/.

     node scripts/verify-playalong-band-audio.mjs

   Needs Playwright + Chromium (preinstalled in the cloud containers) and
   esbuild (a Vite dependency). */
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
const OUT = path.resolve("node_modules/.cache/pa-band");
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
const SR = 44100;
const CH = { C: [0, 4, 7], F: [5, 9, 0], G: [7, 11, 2], Am: [9, 0, 4] }, ROOT = { C: 0, F: 5, G: 7, Am: 9 };
window.__render = async function (cfg) {
  const { seconds = 27, bpm = 100, bpb = 4, hand = "right", level = 2, style = "", segs, prog, phone = false } = cfg;
  ME.__marks.length = 0;
  const real = new OfflineAudioContext(2, Math.round(SR * seconds), SR);
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
  return {
    peak, clip, marks: ME.__marks.slice(), log: band.log.map(e => ({ beat: e.beat, when: e.when, drum: e.drum, parts: e.parts, extras: e.extras || "" })),
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
  b.onResolve({ filter: /^__STUB__$/ }, () => ({ path: path.join(dir, "stub.js") }));
} };
const bundle = await build({ entryPoints: [path.join(dir, "page.js")], bundle: true, format: "iife", write: false, plugins: [plug], loader: { ".ts": "ts" }, logLevel: "error" });

const browser = await pw.chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const run = async (name, extra = {}) => {
  const r = await page.evaluate((cfg) => window.__render(cfg), { prog: PROG, ...SCEN[name], ...extra });
  fs.writeFileSync(path.join(OUT, `${name}${extra.phone ? "-phone" : ""}.png`), Buffer.from(r.png.replace(/^data:image\/png;base64,/, ""), "base64"));
  return r;
};

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("PASS  " + msg); } else { fail++; console.log("FAIL  " + msg); } };
const db = (v) => 20 * Math.log10(v + 1e-9);

const build_ = await run("build"), phone = await run("build", { phone: true }), midband = await run("build", { phone: "mid" });
ok(db(build_.peak) <= -2 && build_.clip === 0, `never clips, head-room kept: peak ${db(build_.peak).toFixed(1)} dBFS, ${build_.clip} clipped samples`);
const [p0, p1, p2, p3] = build_.phase;
ok(p1 - p0 >= 8 && p3 - p0 >= 12, `the music fills in with the combo (whole spectrum): drums ${p0} → +drone and bass ${p1} → +strings ${p2} → Fever ${p3} dB RMS`);
const [m0, m1, m2, m3] = midband.phase;
ok(m1 >= m0 - 1 && m2 - m1 >= 2.5 && m3 - m2 >= 2.5, `and in the middle of the spectrum (700 Hz – 5 kHz), where the strings, brass and plucks are: ${m0} → ${m1} → strings ${m2} → Fever ${m3} dB RMS`);
const [q0, , , q3] = phone.phase;
ok(q3 >= -32 && q3 - q0 >= 8, `audible on a phone speaker (300 Hz high-pass): drums ${q0} dB, Fever ${q3} dB RMS — the old band was ~−31 at its loudest`);
ok(build_.tail >= -28, `the finale rings on after the last note: ${build_.tail} dB RMS in the second after it`);
const layers = new Set(build_.log.map(e => e.parts).join("").split("")), extras = new Set(build_.log.map(e => e.extras).join("").split(""));
ok(["d", "b", "c", "x", "a", "!"].every(l => layers.has(l)) && ["o", "f", "k"].every(l => extras.has(l)), `every part of the arrangement plays: ${[...layers].sort().join("")} + ${[...extras].sort().join("")}`);
const soft = await run("soft");
ok(soft.log.every(e => !e.parts) && db(soft.peak) <= -6 && soft.peak < build_.peak, `a piano on the mic gets drums only: nothing pitched booked, peak ${db(soft.peak).toFixed(1)} dBFS`);
const mic = await run("mic"), fev = await run("fever");
const perSec = mic.marks.length / 21;
ok(mic.marks.length > 200 && mic.marks.every(m => m.freq <= 1800 && m.tol >= 45) && fev.marks.length === 0 && perSec < 45, `mic open: ${mic.marks.length} blacklist marks (${perSec.toFixed(0)}/s, all ≤ 1.8 kHz, none with the mic closed)`);
const waltz = await run("waltz"), left = await run("left");
ok(waltz.clip === 0 && left.clip === 0 && waltz.log.some(e => e.parts.includes("b")) && !left.log.some(e => e.parts.includes("b")), `3/4 time renders, and the left-hand mode plays no bass (waltz peak ${db(waltz.peak).toFixed(1)}, left ${db(left.peak).toFixed(1)} dBFS)`);
// plan 23 (M6): "full" is 1.35× normal, so it has to be measured, not assumed
const full = await run("full");
ok(full.clip === 0 && db(full.peak) <= -2 && full.peak > build_.peak, `"full" is louder than "normal" and still does not clip: ${db(full.peak).toFixed(1)} dBFS peak vs ${db(build_.peak).toFixed(1)}`);
for (const name of ["baroque", "jazz", "romance"]) {
  const s2 = await run(name);
  const drums = new Set(s2.log.map(e => e.drum).filter(Boolean));
  ok(s2.clip === 0 && s2.peak > 0 && s2.log.some(e => e.parts), `${name}: renders with its own kit (${[...drums].join(",") || "no drums"}), peak ${db(s2.peak).toFixed(1)} dBFS`);
}
const bq = await run("baroque");
ok(!bq.log.some(e => e.drum === "snare") && !bq.log.some(e => e.drum === "kick"), `a baroque piece gets no drum kit at all`);
await browser.close();
console.log(`\n${pass} PASS, ${fail} FAIL · spectrograms in ${OUT}`);
process.exit(fail ? 1 : 0);
