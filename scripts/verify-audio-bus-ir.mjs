/* ── What the master bus reverb actually does to every sound in the app ────
   music-engine.tsx audioBus() builds a 1.5 s noise impulse response by hand and
   feeds it to a ConvolverNode at a fixed wet gain of 0.13.

   FIRST, THE FACT THAT SETTLES THE LEVEL — and the one that retracts an earlier
   conclusion. ConvolverNode.normalize DEFAULTS TO TRUE: MDN says "its default
   value is true in order to achieve a more uniform output level from the
   convolver, when loaded with diverse impulse responses", and the Web Audio 1.1
   spec says that when it is true the node "will first perform a scaled RMS-power
   analysis of the buffer" before convolving. music-engine.tsx never touches
   normalize, so every browser already rescales the hand-built response. The
   earlier claim that this bus runs +17 dB hot was a property of this lab's raw
   convolver, not of the app.

   So the question worth measuring is no longer "is the bus too loud" but "what
   does the tail do, and is the shape worth changing":

     wetDry     wet RMS relative to dry RMS. With the browser normalising, this
                should land near the wet gain itself (-17.7 dB for 0.13).
     hissFloor  RMS still sounding 1.0 s after a short note has died, relative to
                the signal's peak: the noise floor heard between notes.
     onset      how much of the wet arrives in the first 40 ms after the note
                starts, relative to the next 200 ms. This is what a pre-delay
                moves, and it is the number that decides whether the piano's
                attack stays clean or gets smeared.
     tailHz     spectral centroid of the leftover tail, against the note's.

   Every candidate below is normalised the way a browser normalises, because
   that is how all of them are heard. Browsers differ by a small implementation
   constant on top of this, so read absolute bus level as +/- a dB and every
   RATIO here as solid.

   Run: node scripts/verify-audio-bus-ir.mjs           (table + PASS/FAIL)
        node scripts/verify-audio-bus-ir.mjs --json    (machine-readable) */

import { convolve, SR, db } from "./band-audio-lab.mjs";

function mkRnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

/* ── the impulse responses under test ───────────────────────────────────── */

/* Normalise to unit energy (sum of squares = 1) — what ConvolverNode does to
   every response anyway. Applying it by hand is a no-op in a browser, but it is
   what makes this offline number agree with the online one. */
function unitEnergy(ir) {
  let e = 0;
  for (let i = 0; i < ir.length; i++) e += ir[i] * ir[i];
  const k = e > 0 ? 1 / Math.sqrt(e) : 0;
  for (let i = 0; i < ir.length; i++) ir[i] *= k;
  return ir;
}

/* The shipped shape: noise under a (1 - i/len)^2.6 decay, no pre-delay, copied
   verbatim from music-engine.tsx audioBus(). If this drifts from the source, the
   numbers stop being about the app. */
export function ir_shipped(rnd) {
  const len = Math.floor(SR * 1.5);
  const ir = new Float32Array(len);
  for (let i = 0; i < len; i++) ir[i] = rnd() * Math.pow(1 - i / len, 2.6);
  return unitEnergy(ir);
}

/* The same decay, pushed back by `preMs` of silence so the tail does not sit on
   top of the attack. */
export function ir_shaped(rnd, { preMs = 0, decay = 2.6, sec = 1.5 } = {}) {
  const pre = Math.round((preMs / 1000) * SR);
  const len = Math.floor(SR * sec);
  const ir = new Float32Array(pre + len);
  for (let i = 0; i < len; i++) ir[pre + i] = rnd() * Math.pow(1 - i / len, decay);
  return unitEnergy(ir);
}

/* The wet gain is deliberately not a variable here. 0.13 is what audioBus() has
   always used and it measures at -14.8 dB under the note, which is a room and not
   a flood; raising it to 0.20 was tried and lands at -11.0 dB, closer to the
   edge than this app's other material deserves. */
export function candidates() {
  const mk = (build) => build(mkRnd(777));
  return [
    { name: "SHIPPED: decay only, wet 0.13", wet: 0.13, ir: mk(ir_shipped), shipped: true },
    { name: "SHIPP THAT: + 18 ms pre-delay", wet: 0.13, ir: mk((r) => ir_shaped(r, { preMs: 18 })), ship: true },
  ];
}

/* ── measurement ────────────────────────────────────────────────────────── */

const rms = (b, a = 0, z = b.length) => {
  let s = 0;
  for (let i = a; i < z; i++) s += b[i] * b[i];
  return Math.sqrt(s / Math.max(1, z - a));
};
const peak = (b) => {
  let p = 0;
  for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); if (v > p) p = v; }
  return p;
};

/* Spectral centroid over a Hann-windowed DFT, coarse bins are plenty to tell
   "2 kHz hiss" from "400 Hz rumble". */
function centroidHz(buf, sr) {
  let num = 0, den = 0;
  const N = Math.min(buf.length, 8192);
  for (let bin = 2; bin < 400; bin++) {
    const f = (bin * sr) / N;
    if (f > 16000) break;
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      const x = buf[i] * w;
      const ph = ((2 * Math.PI * bin * i) / N) % (2 * Math.PI);
      re += x * Math.cos(ph);
      im -= x * Math.sin(ph);
    }
    const mag = Math.sqrt(re * re + im * im);
    num += f * mag;
    den += mag;
  }
  return den > 0 ? num / den : 0;
}

/* A piano note at the level playPianoNote really produces (peak 0.33, five
   partials, exponential decay, 6 ms attack), then silence.

   `dur` is the note's own length in seconds, and it matters: a 0.7 s note is
   still ringing at -18 dB a second and a half later, which would drown the very
   thing we are trying to measure. So the two probes below use different lengths:
   the long one for how loud the bus really plays (peak, clipping, total level),
   the short one for what the room is left holding once the note has gone. */
function dryNote(dur) {
  const n = Math.floor(SR * 3.4);
  const d = new Float32Array(n);
  const start = Math.floor(0.01 * SR);
  const f = 440;
  for (const [mul, amp, dscale] of [[1, 1.0, 1.0], [2, 0.5, 0.72], [3, 0.26, 0.52], [4, 0.13, 0.4], [6, 0.07, 0.3]]) {
    if (f * mul > 12000) continue;
    const w = 2 * Math.PI * f * mul;
    for (let i = start; i < n; i++) {
      const t = i / SR - 0.01;
      if (t < 0) continue;
      d[i] += 0.33 * amp * Math.exp(-t / (dur * dscale)) * Math.sin(w * t);
    }
  }
  for (let i = 0; i < Math.floor(0.006 * SR); i++) d[start + i] *= i / (0.007 * SR);
  return d;
}

export function measureCandidate(c) {
  /* Probe 1 — a full-length note: how loud does the app actually play? */
  const dry = dryNote(0.7);
  const wetOnly = convolve(dry, c.ir);
  const out = new Float32Array(dry.length);
  for (let i = 0; i < dry.length; i++) out[i] = dry[i] * 0.9 + wetOnly[i] * c.wet;

  const NOTE_END = Math.floor(SR * 1.6);
  const dryRms = rms(dry, 0, NOTE_END);
  const pk = peak(out);
  let clip = 0;
  for (let i = 0; i < out.length; i++) if (Math.abs(out[i]) > 1) clip++;

  /* Probe 2 — a short note, so that at +1.0 s only the room is left sounding.
     Everything below is measured on the WET PATH ALONE (wet-only x wet gain),
     never on the mix: the mix still contains the note itself, and the whole
     point is to know what the room is holding once the note has gone. */
  const probe = dryNote(0.22);
  const probeWet = convolve(probe, c.ir);
  const wetSig = new Float32Array(probeWet.length);
  for (let i = 0; i < probeWet.length; i++) wetSig[i] = probeWet[i] * c.wet;

  const TAIL = Math.floor(SR * 1.0);
  const half = Math.floor(SR * 0.5);
  const tailWindow = wetSig.subarray(TAIL, Math.min(wetSig.length, TAIL + half));
  const earlier = wetSig.subarray(TAIL - half, TAIL);

  // the attack: what the pre-delay buys is reverb energy that does NOT arrive in
  // the first 40 ms, so the piano's own attack stays clean
  const onsetEnd = Math.floor(0.05 * SR);
  const onsetStart = Math.floor(0.01 * SR);
  const lateEnd = Math.floor(0.25 * SR);
  let e1 = 0, e2 = 0;
  for (let i = onsetStart; i < onsetEnd; i++) e1 += wetSig[i] * wetSig[i];
  for (let i = onsetEnd; i < lateEnd; i++) e2 += wetSig[i] * wetSig[i];
  const onsetShareDb = +(10 * Math.log10(Math.max(1e-12, e1) / Math.max(1e-12, e2))).toFixed(1);

  let energy = 0;
  for (let i = 0; i < c.ir.length; i++) energy += c.ir[i] * c.ir[i];

  return {
    name: c.name,
    shipped: !!c.shipped,
    ship: !!c.ship,
    wet: c.wet,
    irEnergy: +energy.toFixed(3),
    wetDryDb: +(db(rms(wetOnly, 0, NOTE_END) * c.wet) - db(dryRms)).toFixed(1),
    totalDb: +(db(rms(out, 0, NOTE_END)) - db(dryRms)).toFixed(1),
    hissFloorDb: +(db(rms(tailWindow)) - db(pk)).toFixed(1),
    decay60Db: +(db(rms(tailWindow)) - db(rms(earlier))).toFixed(1),
    tailHz: Math.round(centroidHz(tailWindow, SR)),
    noteHz: Math.round(centroidHz(dry.subarray(0, NOTE_END), SR)),
    onsetShareDb,
    peakDbfs: +db(pk).toFixed(1),
    clip,
  };
}

/* ── run ────────────────────────────────────────────────────────────────── */
const rows = candidates().map(measureCandidate);
const proposed = rows.filter((r) => !r.shipped);
const chosen = rows.find((r) => r.ship);

/* With the browser normalising, wet/dry should land near the wet gain itself, so
   the level assertions are about "the room stays under the note" rather than about
   a fixed number. The one assertion that has to be TRUE is the pre-delay's: it
   exists to take reverb off the attack, so it has to measurably do that, or it is
   decoration and should not ship. */
const CHECKS = [
  ["every candidate is unit-energy", proposed.every((r) => Math.abs(r.irEnergy - 1) < 0.01)],
  ["wet/dry at or under -12 dB", proposed.every((r) => r.wetDryDb <= -12)],
  ["hiss floor at or under -45 dB", proposed.every((r) => r.hissFloorDb <= -45)],
  ["peak under -1 dBFS, nothing clips", proposed.every((r) => r.peakDbfs <= -1 && r.clip === 0)],
  ["pre-delay takes reverb off the attack by 3 dB or more", chosen.onsetShareDb <= rows[0].onsetShareDb - 3],
  ["shipped response is NOT too loud (retracts the earlier +17 dB claim)", rows[0].wetDryDb <= -12],
];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ sr: SR, rows, checks: CHECKS.map(([n, ok]) => ({ n, ok })) }, null, 2));
} else {
  const L = (s, n) => String(s).padEnd(n);
  console.log(`app master bus reverb — sr ${SR}, one playPianoNote A4 then silence`);
  console.log(`(convolver normalised, as ConvolverNode.normalize=true does in every browser)\n`);
  console.log(
    L("response", 38) + L("wetDry", 9) + L("total", 9) + L("hiss", 9) + L("peak", 9) + L("tailHz", 8) + L("onset", 9) + "clip",
  );
  for (const r of rows) {
    console.log(
      L(r.name, 38) +
        L(r.wetDryDb.toFixed(1) + " dB", 9) +
        L(r.totalDb.toFixed(1) + " dB", 9) +
        L(r.hissFloorDb.toFixed(1) + " dB", 9) +
        L(r.peakDbfs.toFixed(1) + " dB", 9) +
        L(r.tailHz + "Hz", 8) +
        L(r.onsetShareDb.toFixed(1) + " dB", 9) +
        r.clip,
    );
  }
  console.log(`\nnote centroid for comparison: ${rows[0].noteHz} Hz`);
  console.log("");
  let ok = 0;
  for (const [n, good] of CHECKS) {
    console.log(`${good ? "PASS" : "FAIL"}  ${n}`);
    if (good) ok++;
  }
  console.log(`\n${ok}/${CHECKS.length} checks`);
  process.exit(ok === CHECKS.length ? 0 : 1);
}
