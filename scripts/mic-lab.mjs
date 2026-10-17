/* Shared lab for the microphone detectors: bundles the REAL music-engine for Node, and synthesises a plausible piano (slightly inharmonic partials,
   faster decay upward, a hammer thump, a damper) so a detector can be scored on notes it is told the truth about. Used by bench-mic-detect.mjs.
   No speakers, no browser: frames are cut from a buffer at the microphone loop's pace (1/60 s) exactly as the real loop does. */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { build } = require("esbuild");
export const SR = 44100;
export async function loadEngine(tag = "lab") {
  const root = process.cwd(), dir = path.join(root, "node_modules", ".mic-lab"); mkdirSync(dir, { recursive: true });
  const out = path.join(dir, tag + ".mjs");
  await build({ entryPoints: [path.join(root, "music-engine.tsx")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error",
    external: ["react", "react-dom", "react/jsx-runtime"],
    plugins: [{ name: "stub", setup(b) { b.onResolve({ filter: /\?(url|raw|worker&url|worker)$/ }, (a) => ({ path: a.path, namespace: "asset" })); b.onLoad({ filter: /.*/, namespace: "asset" }, () => ({ loader: "js", contents: "export default '';" })); } }],
    define: { "import.meta.env": "{}" } });
  return await import(out + "?t=" + Date.now());
}
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
// a plausible piano note added into `out` (amp = relative level; vel scales the hammer and the brightness)
export function pianoNote(out, f0, tOn, tOff, amp, rnd, vel = 1) {
  const n0 = Math.floor(tOn * SR), len = Math.floor((tOff - tOn + 0.25) * SR), Bi = 0.0004, parts = [];
  for (let k = 1; k <= 12; k++) {
    const fk = k * f0 * Math.sqrt(1 + Bi * k * k); if (fk > 8000) break;
    parts.push({ w: 6.283185307 * fk / SR, a: amp * Math.pow(k, -0.85 - (1 - vel) * 0.7) * (k === 2 ? 1.1 : 1), tau: (1.6 / Math.pow(k, 0.6)) * SR, ph: rnd() * 6.283 });
  }
  const hold = tOff - tOn;
  for (let i = 0; i < len && n0 + i < out.length; i++) {
    let s = 0; for (const p of parts) s += p.a * Math.sin(p.w * i + p.ph) * Math.exp(-i / p.tau);
    const held = i / SR, rel = held > hold ? Math.exp(-(held - hold) / 0.02) : 1;
    out[n0 + i] += s * Math.min(1, i / (0.003 * SR)) * rel;
  }
  const hl = Math.floor(0.012 * SR);
  for (let i = 0; i < hl && n0 + i < out.length; i++) out[n0 + i] += (rnd() * 2 - 1) * amp * 0.25 * vel * Math.exp(-i / (0.004 * SR));
}
// scale a signal so the first `ms` after `t0` has the given rms, then add white room noise
export function level(sig, t0, ms, rms, noise, seed) {
  let e = 0, c = 0; for (let i = Math.floor(t0 * SR); i < Math.floor((t0 + ms / 1000) * SR) && i < sig.length; i++) { e += sig[i] ** 2; c++; }
  const g = rms / Math.sqrt(Math.max(1e-12, e / c)), rn = rng(seed); for (let i = 0; i < sig.length; i++) sig[i] = sig[i] * g + (rn() * 2 - 1) * noise;
  return sig;
}
/* the mono path: createMonoDetector fed 2048-sample frames at 60 Hz, with the analyser's dB spectrum on request */
export function runMono(ME, sig, secs, opts = {}) {
  const dets = []; let tnow = 0, curEnd = 0;
  const N = 2048, win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N);
  const re = new Float32Array(N), im = new Float32Array(N), db = new Float32Array(N / 2);
  const getDb = () => { for (let i = 0; i < N; i++) { re[i] = sig[curEnd - N + i] * win[i]; im[i] = 0; } fft(re, im); for (let k = 0; k < N / 2; k++) db[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / N + 1e-9); return db; };
  const feed = ME.createMonoDetector(SR, (d) => dets.push({ t: tnow, ...d }), getDb, { lowpassHz: ME.MONO_LOWPASS_HZ, ...opts });
  for (let k = 1; k < Math.floor(secs * 60); k++) { tnow = k / 60; curEnd = Math.round(tnow * SR); if (curEnd < N) continue; feed(sig.subarray(curEnd - N, curEnd)); }
  return dets;
}
/* the poly path's reading of ONE strike: a 16384-sample Blackman window ending at `tEnd` through the same dB -> linear magnitude step the app uses */
export function polySnapshot(ME, sig, tEnd, fn = "detectPolyNotes", extra) {
  const N = 16384, end = Math.round(tEnd * SR); if (end < N) return [];
  const re = new Float32Array(N), im = new Float32Array(N), mag = new Float32Array(N / 2);
  for (let i = 0; i < N; i++) { const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N); re[i] = sig[end - N + i] * w; im[i] = 0; }
  fft(re, im); for (let k = 0; k < N / 2; k++) { const v = 20 * Math.log10(Math.hypot(re[k], im[k]) / N + 1e-9); mag[k] = v <= -160 ? 0 : Math.pow(10, v / 20); }
  return ME[fn](mag, SR, N, extra);
}
export const NOTE_PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const nameOf = (m) => NOTE_PC[m % 12] + (Math.floor(m / 12) - 1);
