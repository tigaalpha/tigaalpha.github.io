#!/usr/bin/env node
/* ── band-audio-lab.mjs ── the backing track, rendered offline and measured.

   WHY this exists — the owner asked whether the band "เพราะ" (sounds good), and
   the answer has to be a number, not an opinion. play-along-band.ts is pure
   Web Audio (oscillators, filters, a compressor, a delay) and the container has
   no browser and no speakers, so this module implements the slice of the Web
   Audio API the band uses — close enough that the waveform it writes is the
   waveform the app makes — and drives the REAL play-along-band.ts through it.

   What is modelled, and how exactly:
     · AudioParam   setValueAtTime / exponentialRampToValueAtTime /
                   linearRampToValueAtTime / setTargetAtTime, with the ramp END
                   times the spec means, interpolated per sample.
     · oscillators  sine, square, saw, triangle. The two-edged waveforms go
                   through PolyBLEP: a naive saw aliases into energy that is not
                   really there, and every brightness number below would be a
                   lie. Triangle is a leaky integrator on a band-limited square,
                   which is how a subtractive synthesiser makes one.
     · filters      RBJ cookbook biquads (lowpass, highpass, bandpass), the
                   coefficients WebKit computes, re-solved every 64 samples so a
                   filter sweep stays a sweep.
     · noise        one deterministic table (the app's own _accNoise is
                   Math.random, so the measurement would otherwise move run to
                   run — here every number is repeatable).
     · compressor   feed-forward with attack/release and a soft knee. An
                   approximation of DynamicsCompressorNode and the one place
                   where the offline level can differ from a real browser.
     · delay        a real delay line; the echo loop closes once per block,
                   which costs 5.8 ms of the feedback path.
     · the app bus  gain 0.9 (_sfxVol) plus the app's own 1.5 s reverb tail —
                   the band plays through it, so leaving it out would misreport
                   how wet the mix is. Convolved by partitioned overlap-save.

   It is not an emulator of the whole API and does not try to be.

   scripts/analyze-band-sound.mjs drives this; the numbers land in
   tigamodel/docs/23 §11. */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const SR = 44100;
const BLOCK = 256;

/* ── FFT (radix-2, in place): the analysis windows and the reverb convolution ── */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i], ti = im[i]; re[i] = re[j]; im[i] = im[j]; re[j] = tr; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
const nextPow2 = (x) => { let n = 1; while (n < x) n <<= 1; return n; };

/* partitioned overlap-save: y = x (*) ir, whole signal, any length */
export function convolve(x, ir) {
  const P = nextPow2(Math.max(ir.length * 2, 2048));
  const H = P / 2;
  const parts = Math.ceil(ir.length / H);
  const hr = new Float32Array(parts * P), hi = new Float32Array(parts * P);
  for (let p = 0; p < parts; p++) {
    hr.set(ir.subarray(p * H, Math.min(ir.length, (p + 1) * H)), p * P);
    fft(hr.subarray(p * P, p * P + P), hi.subarray(p * P, p * P + P));
  }
  const y = new Float32Array(x.length + ir.length);
  const xr = new Float32Array(P), xi = new Float32Array(P), zr = new Float32Array(P), zi = new Float32Array(P);
  for (let off = 0; off < x.length; off += H) {
    const n = Math.min(H, x.length - off);
    xr.fill(0); xi.fill(0); xr.set(x.subarray(off, off + n));
    fft(xr, xi);
    /* every partition is a filter in its own right: its H outputs land H
       samples further along (overlap-add) */
    for (let p = 0; p < parts; p++) {
      const base = p * P;
      for (let k = 0; k < P; k++) {
        const ar = hr[base + k], ai = hi[base + k];
        const br = xr[k], bi = xi[k];
        zr[k] = br * ar - bi * ai; zi[k] = -(br * ai + bi * ar);   // conjugate: the inverse
      }
      fft(zr, zi);
      const o = off + p * H;
      for (let i = 0; i < Math.min(H, y.length - o); i++) y[o + i] += zr[i] / P;
    }
  }
  return y;
}

/* ── AudioParam ── */
class Param {
  constructor(v = 0) { this.value = v; this.ev = []; }
  setValueAtTime(v, t) { this.ev.push({ t, v, k: "set" }); return this; }
  exponentialRampToValueAtTime(v, t) { this.ev.push({ t, v, k: "exp" }); return this; }
  linearRampToValueAtTime(v, t) { this.ev.push({ t, v, k: "lin" }); return this; }
  setTargetAtTime(v, t, tau) { this.ev.push({ t, v, k: "tgt", tau }); return this; }
  cancelScheduledValues(t) { this.ev = this.ev.filter((e) => e.t > t); return this; }
  /* A ramp's time is when it ENDS: the value between the previous event and
     `t` is the interpolation, which is what the exponentialRamp in
     play-along-band.ts means when it writes "0.0001 at when + 0.22". */
  at(t) {
    let v = this.value, tt = -Infinity;
    for (const e of this.ev) {
      if (e.k === "set") {
        if (t >= e.t) { v = e.v; tt = e.t; continue; }
        return v;
      }
      if (e.k === "tgt") {
        if (t >= e.t) { v = e.v + (v - e.v) * Math.exp(-(t - e.t) / (e.tau || 0.01)); tt = t; continue; }
        return v;
      }
      const v0 = v, T = e.t - tt, dt = t - tt;
      if (t >= e.t) { v = e.v; tt = e.t; continue; }
      if (T <= 1e-9) return e.v;
      if (e.k === "lin") return v0 + (e.v - v0) * Math.max(0, dt) / T;
      if (v0 <= 1e-9 || e.v <= 1e-9) return Math.max(1e-6, e.v);
      return Math.max(1e-6, v0 * Math.pow(e.v / v0, Math.max(0, dt) / T));
    }
    return v;
  }
}

/* ── nodes ── */
let UID = 0;
class N {
  constructor(ctx, kind) {
    this.ctx = ctx; this.kind = kind; this.id = UID++;
    this.src = []; this.dst = [];
    this.buf = new Float32Array(BLOCK);
    this.from = Infinity; this.until = -Infinity;
  }
  // an LFO wired into an AudioParam (the band's vibrato) is a modulation of a few cents: it does not change level or spectrum
  // balance, so the lab accepts the connection and does not render it
  connect(n) { if (n instanceof Param) return n; n.src.push(this); this.dst.push(n); return n; }
  disconnect() { for (const n of this.src) n.dst = n.dst.filter((d) => d !== this); this.src = []; }
  in(i) { let s = 0; for (const n of this.src) s += n.buf[i]; return s; }
  /* when this node can still make a sound — lets the renderer skip the ~95 %
     of nodes that are asleep at any moment */
  bounds() {
    if (!this.src.length) return;                 // a source sets its own
    let from = Infinity, until = -Infinity;
    for (const n of this.src) { if (n.from < from) from = n.from; if (n.until > until) until = n.until; }
    this.from = from;
    this.until = this.kind === "delay" ? until + 3 : until;   // and its tail
  }
}

class Gain extends N {
  constructor(ctx) { super(ctx, "gain"); this.gain = new Param(1); }
  run(t0) {
    const b = this.buf, g = this.gain;
    b.fill(0);
    for (let i = 0; i < BLOCK; i++) b[i] = this.in(i) * g.at(t0 + i / SR);
  }
}

class Biquad extends N {
  constructor(ctx) {
    super(ctx, "filter");
    this.frequency = new Param(350); this.Q = new Param(1); this.gain = new Param(0);
    this.filterType = "lowpass";
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; this.c = [0, 0, 0, 0, 0];
  }
  /* the band writes f.type = "lowpass" — the DOM property name, which the node
     kind ("filter") would otherwise shadow */
  get type() { return this.filterType; }
  set type(v) { this.filterType = v; }
  coeffs(f, q) {
    const w0 = 2 * Math.PI * Math.min(Math.max(20, f), SR * 0.47) / SR, cw = Math.cos(w0), sw = Math.sin(w0);
    const alpha = sw / (2 * Math.max(1e-4, q));
    let b0, b1, b2, a0, a1, a2;
    if (this.filterType === "highpass") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
    else if (this.filterType === "bandpass") { b0 = alpha; b1 = 0; b2 = -alpha; }
    else if (this.filterType === "highshelf" || this.filterType === "lowshelf") {
      const A = Math.pow(10, this.gain.at(this.ctx.currentTime) / 40);
      const beta = 2 * Math.sqrt(A) * alpha;
      if (this.filterType === "highshelf") { b0 = A * ((A + 1) + (A - 1) * cw + beta); b1 = -2 * A * (A - 1) - beta * (A + 1); b2 = A * ((A + 1) + (A - 1) * cw - beta); }
      else { b0 = A * ((A + 1) - (A - 1) * cw); b1 = 2 * A * (A - 1); b2 = A * ((A + 1) - (A - 1) * cw); }
      a0 = A + 1 - (A - 1) * cw + beta; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - beta;
      this.c = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
      return;
    }
    else { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
    /* the RBJ cookbook's shelf terms, which is why a0/a1/a2 are written below */
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    this.c = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  run(t0) {
    const b = this.buf, CH = 64;
    b.fill(0);
    for (let s0 = 0; s0 < BLOCK; s0 += CH) {
      this.coeffs(this.frequency.at(t0 + s0 / SR), this.Q.at(t0 + s0 / SR));
      const c = this.c, b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
      for (let s = 0; s < CH; s++) {
        const i = s0 + s, x = this.in(i);
        const y = b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
        this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
        b[i] = y;
      }
    }
  }
}

class Delay extends N {
  constructor(ctx, maxSec = 2) {
    super(ctx, "delay");
    this.delayTime = new Param(0);
    this.L = Math.ceil(maxSec * SR) + 8;
    this.line = new Float32Array(this.L);
    this.w = 0;
    this.from = 0;                             // always live: the loop feeds it
  }
  _d() { return Math.min(this.L - 2, Math.max(0, Math.round(this.delayTime.at(this.ctx.currentTime) * SR))); }
  run() {
    const b = this.buf, ds = this._d();
    for (let i = 0; i < BLOCK; i++) b[i] = this.line[(((this.w - ds) % this.L) + this.L) % this.L];
  }
  /* the feedback is summed after the rest of the block has run, so the echo
     loop closes one block late (5.8 ms) */
  flush() {
    const b = this.buf, ds = this._d();
    for (let i = 0; i < BLOCK; i++) {
      this.line[this.w] = this.in(i);
      this.w = (this.w + 1) % this.L;
      b[i] = this.line[(((this.w - ds) % this.L) + this.L) % this.L];
    }
  }
}

class Compressor extends N {
  constructor(ctx) {
    super(ctx, "comp");
    this.threshold = new Param(-24); this.knee = new Param(30);
    this.ratio = new Param(12); this.attack = new Param(0.003); this.release = new Param(0.25);
    this.env = 0;
  }
  run(t0) {
    const b = this.buf, thr = this.threshold.at(t0), knee = this.knee.at(t0),
      ratio = this.ratio.at(t0), atk = this.attack.at(t0), rel = this.release.at(t0);
    const ca = atk > 0 ? 1 - Math.exp(-1 / (atk * SR)) : 1, cr = rel > 0 ? 1 - Math.exp(-1 / (rel * SR)) : 1;
    b.fill(0);
    for (let i = 0; i < BLOCK; i++) {
      const x = this.in(i), a = Math.abs(x);
      this.env = a > this.env ? this.env + (a - this.env) * ca : this.env + (a - this.env) * cr;
      const over = 20 * Math.log10(this.env + 1e-9) - thr;
      let gr = 0;                                       // dB of REDUCTION, positive
      if (knee > 0 && over > -knee / 2 && over < knee / 2) gr = (1 - 1 / ratio) * (over + knee / 2) * (over + knee / 2) / (2 * knee);
      else if (over >= 0) gr = over * (1 - 1 / ratio);
      this.grDb = gr; this.envDb = 20 * Math.log10(this.env + 1e-9);
      b[i] = x * Math.pow(10, -gr / 20);
    }
  }
}

class Shaper extends N {
  constructor(ctx) { super(ctx, "shaper"); this.curve = new Float32Array(2049).fill(0); this.k = 1; this.oversample = "none"; }
  run() {
    const b = this.buf, c = this.curve, n = c.length - 1;
    b.fill(0);
    for (let i = 0; i < BLOCK; i++) {
      const x = this.in(i) * this.k;
      let p = ((Math.max(-1, Math.min(1, x)) + 1) / 2) * n;
      const i0 = Math.max(0, Math.min(n - 1, Math.floor(p)));
      b[i] = c[i0] + (c[i0 + 1] - c[i0]) * (p - i0);
    }
  }
}

class Osc extends N {
  constructor(ctx) {
    super(ctx, "osc");
    this.oscType = "sine"; this.frequency = new Param(440); this.detune = new Param(0);
    this.ph = 0; this.tri = 0; this.t0 = 0; this.t1 = Infinity; this.running = false;
  }
  start(t) { this.t0 = t; this.running = true; this.from = t; }
  stop(t) { this.t1 = t; this.until = Math.max(this.until, t); }
  /* PolyBLEP as a CORRECTION added to the naive waveform (the canonical two-
     sample form): a naive saw or square aliases energy that is not in the
     signal, which would make every brightness and level number below a lie. */
  _blep(ph, dt) {
    if (dt <= 0) return 0;
    if (ph < dt) { const t = ph / dt; return t + t - t * t - 1; }
    if (ph > 1 - dt) { const t = (ph - 1) / dt; return t * t + t + t + 1; }
    return 0;
  }
  run(t0) {
    const b = this.buf, ty = this.oscType, det = this.detune.at(t0);
    b.fill(0);
    for (let i = 0; i < BLOCK; i++) {
      const t = t0 + i / SR;
      if (t < this.t0 || t >= this.t1) continue;
      const f = this.frequency.at(t) * Math.pow(2, det / 1200);
      if (!(f > 0) || !(f < SR * 0.49)) continue;
      const dt = f / SR;
      let v;
      if (ty === "sine") v = Math.sin(2 * Math.PI * this.ph);
      else if (ty === "square") v = (this.ph < 0.5 ? 1 : -1) + this._blep(this.ph, dt) + this._blep((this.ph + 0.5) % 1, dt);
      else if (ty === "sawtooth") v = 2 * this.ph - 1 + this._blep(this.ph, dt);
      else { this.tri = (this.tri + 4 * dt * (this.ph < 0.5 ? 1 : -1)) * (1 - Math.min(0.4, 2 * dt)); v = Math.max(-1, Math.min(1, this.tri)); }
      this.ph += dt; if (this.ph >= 1) this.ph -= 1;
      b[i] = v;
    }
  }
}

class Noise extends N {
  constructor(ctx, table) { super(ctx, "noise"); this.table = table; this.loop = false; this.t0 = 0; this.t1 = Infinity; }
  start(t) { this.t0 = t; this.from = t; }
  stop(t) { this.t1 = t; this.until = Math.max(this.until, t); }
  run(t0) {
    const b = this.buf, T = this.table, L = T.length;
    b.fill(0);
    for (let i = 0; i < BLOCK; i++) {
      const t = t0 + i / SR;
      if (t < this.t0 || t >= this.t1) continue;
      const idx = Math.floor((t - this.t0) * SR);
      if (idx >= L && !this.loop) continue;
      b[i] = T[this.loop ? idx % L : idx];
    }
  }
}

/* ── the context ── */
export function makeContext(seed = 12345) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const ctx = {
    sampleRate: SR, currentTime: 0, nodes: [],
    createGain: () => ctx._add(new Gain(ctx)),
    createBiquadFilter: () => ctx._add(new Biquad(ctx)),
    createDelay: (max = 2) => ctx._add(new Delay(ctx, max)),
    createDynamicsCompressor: () => ctx._add(new Compressor(ctx)),
    createWaveShaper: () => ctx._add(new Shaper(ctx)),
    createOscillator: () => ctx._add(new Osc(ctx)),
    createBufferSource: () => ctx._add(new Noise(ctx, ctx.noiseTable)),
    createBuffer: (ch, len) => ({ length: len, getChannelData: () => new Float32Array(len) }),
    _add(n) { ctx.nodes.push(n); return n; },
  };
  ctx.noiseTable = new Float32Array(Math.floor(SR * 0.3));
  for (let i = 0; i < ctx.noiseTable.length; i++) ctx.noiseTable[i] = rnd();
  ctx.destination = ctx.createGain();
  return ctx;
}

/* Render the graph to a mono Float32Array. The order is a depth-first pass with
   the edges that close the echo loop dropped, so the delay is read before the
   filter and gain that feed it back. */
export function render(ctx, seconds) {
  const total = Math.ceil(seconds * SR);
  const out = new Float32Array(total);
  const order = [], seen = new Set();
  const visit = (n) => {
    if (seen.has(n)) return;
    seen.add(n);
    for (const s of n.src) { if (n.kind === "delay" && s.kind !== "delay") continue; visit(s); }
    order.push(n);
  };
  for (const n of ctx.nodes) visit(n);
  /* a node can only sound while one of its sources can, and the order above
     puts every source before the node it feeds — so two passes carry "when am I
     awake" the whole way from a source up to the master */
  for (let p = 0; p < 2; p++) for (const n of order) n.bounds();
  const dest = ctx.outNode || ctx.destination;
  dest.from = 0;
  for (let b = 0; b * BLOCK < total; b++) {
    const t0 = (b * BLOCK) / SR;
    ctx.currentTime = t0;
    for (const n of order) {
      if (t0 < n.from - 1e-3 || t0 > n.until) { if (n.kind !== "delay") n.buf.fill(0); continue; }
      n.run(t0);
    }
    for (const n of order) if (n.kind === "delay") n.flush();
    const o = b * BLOCK, len = Math.min(BLOCK, total - o), d = dest.buf;
    for (let i = 0; i < len; i++) out[o + i] = d[i];
  }
  return out;
}

/* the app's own bus: gain 0.9, then the 1.5 s reverb tail it builds off the
   critical path (music-engine.tsx audioBus).

   THE CONVOLVER HERE IS NORMALISED, AND IT HAS TO BE. ConvolverNode.normalize
   defaults to TRUE in the Web Audio API (MDN: "its default value is true in
   order to achieve a more uniform output level"), and the spec says that when it
   is true the node "first perform[s] a scaled RMS-power analysis of the buffer"
   before convolving. music-engine.tsx never sets normalize, so every browser
   already applies that scaling for us.

   This lab used to convolve the raw impulse response and therefore ran ~+17 dB
   hotter than the real app, which is where a "the bus is +17 dB too loud"
   conclusion came from — a conclusion about the lab, not about the app. The
   scaling below is 1/sqrt(sum h^2): the equal-energy reading of the spec's
   "scaled RMS-power analysis". Browsers differ by a small constant on top of
   this (the exact normalisation is implementation-defined), so treat absolute
   bus level as +/- a dB or so and every RATIO measured through here as solid. */
export function appBus(dry, seed = 777) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const ir = busImpulse(seed);
  const wet = convolve(dry, ir);
  const out = new Float32Array(dry.length);
  for (let i = 0; i < dry.length; i++) out[i] = dry[i] * 0.9 + wet[i] * 0.13;
  return out;
}

/* The impulse response audioBus() builds, in the shape it builds it after the
   fix: a short pre-delay so the piano's own attack stays clean, then the noise
   tail under the same (1 - i/len)^2.6 decay, then unit energy — the last step is
   redundant in a browser (normalising an already-normalised response is a no-op)
   but it is what makes the offline number equal the browser's. */
export function busImpulse(seed = 777) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const len = Math.floor(SR * 1.5);
  const pre = Math.round(SR * 0.018);
  const ir = new Float32Array(pre + len);
  for (let i = 0; i < len; i++) ir[pre + i] = rnd() * Math.pow(1 - i / len, 2.6);
  let e = 0;
  for (let i = 0; i < ir.length; i++) e += ir[i] * ir[i];
  const k = e > 0 ? 1 / Math.sqrt(e) : 0;
  for (let i = 0; i < ir.length; i++) ir[i] *= k;
  return ir;
}

/* ── the band itself ──────────────────────────────────────────────────────
   Bundles the REAL play-along-band.ts against a music-engine stub wired to this
   offline context, so every number below is the shipped code's number. */
export async function loadBand() {
  const OUT = "node_modules/.tmp-band/lab";
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "p"), { recursive: true });
  const SRC = readFileSync("play-along-band.ts", "utf8");
  if (!SRC.includes('from "./music-engine"')) throw new Error("play-along-band.ts no longer imports ./music-engine");
  writeFileSync(join(OUT, "p", "music-engine.ts"), `
export let _sfxMuted = false, _micSafe = false;
export function audioBus() { const L = globalThis.__LAB; return { ac: L.ac, bus: L.bus }; }
export function _accMarkSuppress() {}
export function _accNoise(ac) { return ac.noiseTable; }
`);
  writeFileSync(join(OUT, "p", "play-along-band.ts"), SRC);
  execSync(`npx esbuild ${OUT}/p/play-along-band.ts --bundle --outfile=${OUT}/band.js --format=esm --platform=node`, { stdio: "pipe" });
  return await import(pathToFileURL(join(process.cwd(), OUT, "band.js")).href);
}

/* One song's backing track, rendered dry and after the app's bus. */
export function renderBand(band, cfg) {
  const {
    bars, bpb, pickup = 0, bpm, style = "", hand = "right", level = 2,
    combo = 12, fever = false, mega = false, lead = 0, tail = 2.5, mel = null,
    feverBars = null, extra = {},
  } = cfg;
  const spb = 60 / bpm;
  const endBeat = bars.length ? bars[bars.length - 1].at + bars[bars.length - 1].len : 8;
  const ctx = makeContext();
  const dest = ctx.createGain();
  ctx.outNode = dest;
  globalThis.__LAB = { ac: ctx, bus: dest };
  const b = band.createBand({ bars, beatsPerBar: bpb, pickup, spb, lead, endBeat, hand, level, bpm, style, mel, feverBars, ...extra });
  b.setState({ combo, fever, mega, pitched: true, soft: false, micOpen: true });
  const songLen = lead + (endBeat + 1) * spb;
  for (let c = 0; c <= songLen; c += 1 / 90) { ctx.currentTime = c; b.pump(c, (t) => t, 1); }
  /* cut() is deliberately NOT called: in the game it happens when the player
     stops, and calling it here would fade the master at t=0 and silence the
     whole render. */
  const dry = render(ctx, songLen + tail);
  return { dry, wet: appBus(dry), sr: SR, band: b, ctx, songLen, spb, bpb };
}

/* The player's own note, rendered the way music-engine.tsx plays it
   (playPianoNote: five sine partials, peak 0.33·velocity, a lowpass at f·6+1800).
   This is the reference the masking number is measured against — "the player's
   note" has to be a level the app really produces, not one I invented. */
export const PIANO_PARTIALS = [[1, 1.0, 1.0], [2, 0.5, 0.72], [3, 0.26, 0.52], [4, 0.13, 0.4], [6, 0.07, 0.3]];

export function renderMelodyRef(mel, spb, { lead = 0, velocity = 1 } = {}) {
  const ctx = makeContext(4242);
  const dest = ctx.createGain();
  ctx.outNode = dest;
  globalThis.__LAB = { ac: ctx, bus: dest };
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
  lp.connect(dest);
  let end = 0;
  for (const n of mel) {
    const f = 440 * Math.pow(2, (n.midi - 69) / 12);
    const at = lead + n.beat * spb;
    const dur = Math.max(0.18, n.dur * spb * 0.92);
    end = Math.max(end, at + dur + 1);
    for (const [mul, amp, dscale] of PIANO_PARTIALS) {
      if (f * mul > 12000) continue;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.oscType = "sine"; o.frequency.value = f * mul;
      const peak = 0.33 * velocity;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(1e-4, peak * amp), at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur * dscale + 0.06);
      o.connect(g); g.connect(lp);
      o.start(at); o.stop(at + dur * dscale + 0.14);
    }
  }
  return appBus(render(ctx, Math.max(2, end + 1.5)));
}

/* ── measurement ── */
export const db = (x) => 20 * Math.log10(Math.max(1e-9, x));

export function measure(buf, sr = SR) {
  let peak = 0, sum = 0, clip = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > peak) peak = a;
    if (a >= 0.999) clip++;
    sum += buf[i] * buf[i];
  }
  const rms = Math.sqrt(sum / buf.length);
  return { peakDb: db(peak), rmsDb: db(rms), crestDb: db(peak) - db(rms), clip, lenS: buf.length / sr };
}

/* Welch spectrum */
export function spectrum(buf, sr = SR, win = 4096) {
  const hop = win / 2, re = new Float32Array(win), im = new Float32Array(win);
  const acc = new Float32Array(win / 2);
  let frames = 0;
  for (let o = 0; o + win <= buf.length; o += hop) {
    for (let i = 0; i < win; i++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (win - 1));
      re[i] = buf[o + i] * w; im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < win / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  return { acc: Array.from(acc, (v) => v / Math.max(1, frames)), sr, win, hzPerBin: sr / win, winSum: win * 0.5 };
}

const BANDS = [["sub", 20, 60], ["low", 60, 250], ["mid", 250, 800], ["upper", 800, 2500], ["presence", 2500, 6000], ["air", 6000, 14000]];

export function bandMix(spec) {
  const total = spec.acc.reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const [name, lo, hi] of BANDS) {
    /* Half-open on purpose. Rounding both ends to the nearest bin and reading the
       range inclusively counted every BOUNDARY bin twice — one in the band below
       and one in the band above — and a single spike on a boundary came out as
       200 % of the total energy. It looked fine on the styles with little
       sub-bass and inflated exactly the ones with the most of it, which are the
       styles this measurement exists to judge. The last bin of a band is one
       before the first bin of the next, so the bands tile the spectrum exactly
       once and their percentages must add up to 100. */
    const k0 = Math.max(1, Math.round(lo / spec.hzPerBin));
    const k1 = Math.max(k0, Math.min(spec.acc.length - 1, Math.round(hi / spec.hzPerBin) - 1));
    let e = 0;
    for (let k = k0; k <= k1; k++) e += spec.acc[k];
    out[name] = { pct: 100 * e / total };
  }
  out.centroidHz = spec.acc.reduce((a, v, k) => a + v * k * spec.hzPerBin, 0) / total;
  return out;
}

/* how much the song breathes: RMS of every bar */
export function barCurve(buf, sr, spb, bpb) {
  const barLen = Math.max(1, Math.round(spb * bpb * sr));
  const out = [];
  for (let o = 0; o + barLen <= buf.length; o += barLen) {
    let e = 0;
    for (let i = 0; i < barLen; i++) e += buf[o + i] * buf[o + i];
    out.push(db(Math.sqrt(e / barLen)));
  }
  return out;
}

/* How much of the band's own energy sits inside ±1 semitone of each melody
   note: the player has to hear themselves, so this is the number that says
   whether there is room. Reported as dB in a 1/3-octave-ish window. */
/* How much the band's own energy sits under a melody note, measured against the
   player's own note rendered at the level the app really plays it. Negative =
   the player is on top of the band, which is what has to happen. */
export function melodyMask(wet, melody, ref, sr = SR) {
  if (!melody || !melody.length || !ref) return null;
  const a = spectrum(wet, sr, 8192), b = spectrum(ref, sr, 8192);
  const out = [];
  for (const n of melody) {
    const f = 440 * Math.pow(2, (n.midi - 69) / 12);
    const k0 = Math.max(1, Math.round((f * Math.pow(2, -1 / 12)) / a.hzPerBin));
    const k1 = Math.min(a.acc.length - 1, Math.round((f * Math.pow(2, 1 / 12)) / a.hzPerBin));
    const band = (() => { let e = 0; for (let k = k0; k <= k1; k++) e += a.acc[k]; return db(Math.sqrt(e / Math.max(1, k1 - k0 + 1) / a.winSum)); })();
    const note = (() => { let e = 0; for (let k = k0; k <= k1; k++) e += b.acc[k]; return db(Math.sqrt(e / Math.max(1, k1 - k0 + 1) / b.winSum)); })();
    out.push(band - note);
  }
  const s = out.slice().sort((x, y) => x - y);
  return {
    medianDb: s[Math.floor(s.length / 2)],
    p90Db: s[Math.floor((s.length - 1) * 0.9)],
    minDb: s[0],
    n: s.length,
  };
}

/* the same energy split the melody hears: how much of the band is under the
   melody's own octave (C4–C6) at all */
export function melodyOctaveShare(wet, sr = SR) {
  const spec = spectrum(wet, sr, 4096);
  const k0 = Math.max(1, Math.round(261.6 / spec.hzPerBin)), k1 = Math.min(spec.acc.length - 1, Math.round(1046.5 / spec.hzPerBin));
  let tot = 0, mel = 0;
  for (let k = 0; k < spec.acc.length; k++) tot += spec.acc[k];
  for (let k = k0; k <= k1; k++) mel += spec.acc[k];
  return 100 * mel / (tot || 1);
}

export function windowDb(buf, sr, t0, t1) {
  const a = Math.max(0, Math.round(t0 * sr)), b = Math.min(buf.length, Math.round(t1 * sr));
  let e = 0;
  for (let i = a; i < b; i++) e += buf[i] * buf[i];
  return db(Math.sqrt(e / Math.max(1, b - a)));
}

export function writeWav(path, buf, sr = SR) {
  const n = buf.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * 32767))), 44 + i * 2);
  writeFileSync(path, b);
}