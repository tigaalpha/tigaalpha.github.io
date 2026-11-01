/* ── bus-master.ts ── the two pure pieces of the app's master bus (music-engine.tsx audioBus).

   They live in a module of their own, with no Web Audio and no React in it, for one reason: scripts/band-audio-lab.mjs and
   scripts/verify-audio-bus-ir.mjs bundle THIS FILE and use the very same numbers the browser uses. The bus measurements used to
   carry a hand-copied version of the impulse response ("copied verbatim from music-engine.tsx — if this drifts from the source the
   numbers stop being about the app"); a shared module cannot drift.

     buildBusImpulse(sr, rnd)   the room: a stereo impulse response, built by hand
     LIMIT_CURVE                the soft ceiling every game sound ends in
*/

/* ── the room ───────────────────────────────────────────────────────────────
   What a small hall does, in the order the ear meets it:
     1 · 18 ms of nothing. The note arrives before its reflections do, so the piano's attack stays an attack
         (measured: scripts/verify-audio-bus-ir.mjs, the "onset" column).
     2 · a handful of early reflections, a different set in each ear, 24–104 ms after the note: the wall and the ceiling.
         They are what tells the head the room has a size; they are kept weak (about 14 % of the tail's energy) and late
         enough that the first 50 ms stay as clean as the plain pre-delay made them.
     3 · the tail: noise under the decay the bus has always had, (1 − t)^2.6 over 1.5 s, but
         · it rises over the first 25 ms instead of starting at full level (a diffuse field takes a moment to build),
         · it is DAMPED: a one-pole low-pass whose corner falls from about 11 kHz to about 2 kHz along the tail, which is
           what air and soft furniture do — the old tail was white all the way down and hissed at the end,
         · the left and the right ear get independent noise, so the room is wide, and it still folds to mono without a hole
           (two uncorrelated tails add in power, they do not cancel).
   Every channel is scaled to unit energy: ConvolverNode.normalize defaults to true, so a browser rescales the response anyway
   and this makes the offline number equal the browser's. */
/* The room is the SAME room on every device: it is built from a seeded generator, not Math.random. A noise response seen
   through one note is a lucky or unlucky draw (the same recipe measured 1-2 dB apart from one realisation, one ear, to the
   next, and its tail at +1 s up to 7 dB), so with a random room each player would hear a slightly different level of room
   and the offline lab would be measuring a room nobody has. With a seed, what the lab measures IS what plays. */
export function busRnd(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const BUS_SEED = 6;   // chosen by scripts/band-audio-lab.mjs over seeds 1–24: the one whose two ears land on the same level (2.41 / 2.40 dB; the field ran 1.7–3.8)

const ER_L = [[24, 1.0], [33, -0.82], [41, 0.7], [55, -0.62], [68, 0.5], [83, -0.4], [99, 0.3]];
const ER_R = [[27, -0.92], [37, 0.76], [47, -0.66], [60, 0.56], [74, -0.46], [90, 0.36], [104, -0.28]];
const ER_SHARE = 0.14;      // early reflections / tail, in energy

export function buildBusImpulse(sr: number, rnd: () => number): Float32Array[] {
  /* The noise is drawn on a fixed 44.1 kHz grid and resampled (linearly: the damping has taken everything above
     ~11 kHz out by the time it matters) to whatever rate this device runs at, so a 44.1 kHz phone and a 48 kHz
     laptop get the same room and the lab, which runs at 44.1, measures what both of them play. */
  const BASE = 44100;
  const pre = Math.round(sr * 0.018);
  const len = Math.floor(sr * 1.5);
  const lenB = Math.floor(BASE * 1.5);
  const rise = Math.max(1, Math.round(BASE * 0.025));
  const out: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const tb = new Float32Array(lenB);
    let lp = 0;
    for (let i = 0; i < lenB; i++) {
      const x = i / lenB;
      const env = Math.pow(1 - x, 2.6) * (i < rise ? Math.pow(Math.sin((i / rise) * Math.PI / 2), 2) : 1);
      const a = 0.2 + 0.58 * Math.pow(x, 0.7);            // the damping pole: 0.2 (≈ 11 kHz) → 0.78 (≈ 1.7 kHz)
      lp = a * lp + (1 - a) * (rnd() * 2 - 1);
      tb[i] = lp * env;
    }
    const d = new Float32Array(pre + len);
    let eTail = 0;
    for (let i = 0; i < len; i++) {
      const p = (i / Math.max(1, len - 1)) * (lenB - 1), i0 = Math.floor(p), f = p - i0;
      const v = tb[i0] * (1 - f) + tb[Math.min(lenB - 1, i0 + 1)] * f;
      d[pre + i] = v; eTail += v * v;
    }
    /* the early reflections, scaled to ER_SHARE of the tail's energy; each is two samples wide so it is not a click */
    const taps = ch === 0 ? ER_L : ER_R;
    let eTap = 0;
    for (const [, g] of taps) eTap += 1.5 * g * g;
    const k = Math.sqrt((ER_SHARE * eTail) / Math.max(1e-9, eTap));
    for (const [ms, g] of taps) {
      const i = Math.round((ms / 1000) * sr);
      if (i + 1 < d.length) { d[i] += g * k; d[i + 1] += g * k * 0.5; }
    }
    let e = 0;
    for (let i = 0; i < d.length; i++) e += d[i] * d[i];
    const s = e > 0 ? 1 / Math.sqrt(e) : 0;
    for (let i = 0; i < d.length; i++) d[i] *= s;
    out.push(d);
  }
  return out;
}

/* How much of the room is mixed in. The old flat tail was blended at 0.13. A damped tail puts the same unit of energy
   into fewer frequencies — the highs it throws away have to go somewhere, and they pile up in the 150 Hz–3 kHz that the
   music lives in — so, measured over six notes (196–784 Hz), the same 0.13 would have been +2.3 dB louder where it counts
   (old room: 0.1 dB wet-over-dry at unity gain on average over 20 random draws, sd 0.9; this one: 2.41 dB in both ears).
   0.13 × 10^(−(2.41−0.1)/20) = 0.100 puts the room back at the level the app has always had on average, so "a room, not a flood" still holds. */
export const BUS_WET = 0.100;

/* ── the ceiling ────────────────────────────────────────────────────────────
   Every game sound now ends in this one curve (a WaveShaper, so it is memoryless, has no make-up gain and no look-ahead —
   a DynamicsCompressorNode used as a limiter adds an automatic make-up gain of about +1.7 dB at this setting and a 6 ms
   latency, neither of which the offline lab can model, so its numbers would not be the browser's).
   It is exactly transparent up to LIM_KNEE (−3.6 dBFS) — the bus' measured peak is −7.9 dBFS, so on ordinary play it does
   nothing at all — and above it a tanh knee leans on the signal and lands every input, however large, at or under
   about −0.9 dBFS (the input is clamped at ±1 by the WaveShaper, which lands on 0.899): when a stinger, the crowd, the ding and the band stack up, they are rounded, not clipped. */
export const LIM_KNEE = 0.66, LIM_CEIL = 0.95;
export function limitOne(x: number): number {
  const s = x < 0 ? -1 : 1, a = Math.abs(x);
  if (a <= LIM_KNEE) return x;
  return s * (LIM_KNEE + (LIM_CEIL - LIM_KNEE) * Math.tanh((a - LIM_KNEE) / (LIM_CEIL - LIM_KNEE)));
}
export function makeLimitCurve(n = 2049): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = limitOne((i / (n - 1)) * 2 - 1);
  return c;
}
export const LIMIT_CURVE = makeLimitCurve();
