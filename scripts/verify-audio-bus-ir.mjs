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

import { convolve, fft, SR, db, busImpulseStereo, limit, BUS_PARTS } from "./band-audio-lab.mjs";

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
  /* The two rows before the last are history (the bus as it was, and as it was with only the pre-delay): kept so the
     new room is always judged against them. The last two rows are the bus NOW, each ear of it, built by the very
     function the browser calls (bus-master.ts, bundled by the lab). */
  const [irL, irR] = busImpulseStereo();
  return [
    { name: "WAS: decay only, wet 0.13", wet: 0.13, ir: mk(ir_shipped), shipped: true },
    { name: "WAS: + 18 ms pre-delay", wet: 0.13, ir: mk((r) => ir_shaped(r, { preMs: 18 })), was: true },
    { name: "NOW: room, left ear (bus-master.ts)", wet: BUS_PARTS.BUS_WET, ir: irL, ship: true },
    { name: "NOW: room, right ear (bus-master.ts)", wet: BUS_PARTS.BUS_WET, ir: irR, ship: true, right: true },
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
function dryNote(dur, f = 440) {
  const n = Math.floor(SR * 3.4);
  const d = new Float32Array(n);
  const start = Math.floor(0.01 * SR);
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

/* Properties of the response ITSELF, which a single sine probe cannot show (a noise response convolved with one note's four
   partials is Rayleigh-lucky or Rayleigh-unlucky: two realisations of the same room differ by 1-2 dB). */
function irFacts(ir) {
  const e = (a, z) => { let s = 0; for (let i = Math.floor(a * SR); i < Math.min(ir.length, Math.floor(z * SR)); i++) s += ir[i] * ir[i]; return s; };
  const total = e(0, 9);
  // centroid of the late tail, 0.8-1.5 s, by FFT
  const N = 16384, re = new Float32Array(N), im = new Float32Array(N);
  const a0 = Math.floor(0.8 * SR);
  for (let i = 0; i < N && a0 + i < ir.length; i++) re[i] = ir[a0 + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const f = k * SR / N, p = re[k] * re[k] + im[k] * im[k]; num += f * p; den += p; }
  return { erShare: e(0.024, 0.11) / total, lateHz: Math.round(num / den) };
}

/* Six notes, not one. A noise response seen through one note's four partials is a lucky or unlucky draw (Rayleigh: the
   same recipe measures 1-2 dB apart from one realisation, or one ear, to the next, and its tail at +1 s up to 7 dB), so the
   level the gates act on is the power average over G3, C4, E4, A4, D5, G5 — the notes the melody actually spends its time on. */
function sixNotes(ir, wet, NOTE_END, TAIL, half) {
  let pw = 0, pd = 0, pt = 0;
  for (const f of [196, 262, 330, 440, 587, 784]) {
    const dn = dryNote(0.7, f), wn = convolve(dn, ir);
    pw += Math.pow(rms(wn, 0, NOTE_END) * wet, 2); pd += Math.pow(rms(dn, 0, NOTE_END), 2);
    const sp = convolve(dryNote(0.22, f), ir);
    let t = 0; for (let i = TAIL; i < Math.min(sp.length, TAIL + half); i++) t += Math.pow(sp[i] * wet, 2);
    pt += t / half;
  }
  return { pw, pd, pt };
}

export function measureCandidate(c) {
  /* Probe 1 — a full-length note: how loud does the app actually play? */
  const dry = dryNote(0.7);
  const wetOnly = convolve(dry, c.ir);
  const out = new Float32Array(dry.length);
  for (let i = 0; i < dry.length; i++) out[i] = limit(dry[i] * 0.9 + wetOnly[i] * c.wet);

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

  /* the early-reflection window: energy 50-110 ms after the note against the first 50 ms */
  let eER = 0;
  for (let i = Math.floor(0.05 * SR); i < Math.floor(0.11 * SR); i++) eER += wetSig[i] * wetSig[i];

  let energy = 0;
  for (let i = 0; i < c.ir.length; i++) energy += c.ir[i] * c.ir[i];

  const six = sixNotes(c.ir, c.wet, NOTE_END, TAIL, half);

  return {
    name: c.name,
    shipped: !!c.shipped,
    ship: !!c.ship,
    was: !!c.was,
    wet: c.wet,
    ...irFacts(c.ir),
    irEnergy: +energy.toFixed(3),
    wetDry6Db: +(10 * Math.log10(six.pw / six.pd)).toFixed(1),
    hiss6Db: +(10 * Math.log10(six.pt / 6) - db(pk)).toFixed(1),
    six,
    wetDryDb: +(db(rms(wetOnly, 0, NOTE_END) * c.wet) - db(dryRms)).toFixed(1),
    totalDb: +(db(rms(out, 0, NOTE_END)) - db(dryRms)).toFixed(1),
    hissFloorDb: +(db(rms(tailWindow)) - db(pk)).toFixed(1),
    decay60Db: +(db(rms(tailWindow)) - db(rms(earlier))).toFixed(1),
    tailHz: Math.round(centroidHz(tailWindow, SR)),
    noteHz: Math.round(centroidHz(dry.subarray(0, NOTE_END), SR)),
    onsetShareDb,
    erDb: +(10 * Math.log10(Math.max(1e-12, eER))).toFixed(1),
    peakDbfs: +db(pk).toFixed(1),
    clip,
  };
}

/* ── run ────────────────────────────────────────────────────────────────── */
const rows = candidates().map(measureCandidate);
/* The old room was drawn from Math.random on every page load, so "the old level" is not one number: the row above is one
   draw. Measured over 20 draws (six notes, unity gain, the same probe): the old room added 0.1 dB wet-over-dry in the
   music's range on average, with a spread of 0.9 dB (one page load -1.4, another +2.8). With the wet gain of 0.13 that is
   -17.6 dB, and that average is what the new, seeded room has to match. */
const OLD_ROOM = { unityDb: 0.1, wetDry6Db: +(0.1 + 20 * Math.log10(0.13)).toFixed(1) };
const proposed = rows.filter((r) => !r.shipped);
const chosen = rows.find((r) => r.ship);
const now = rows.filter((r) => r.ship);
const wasPre = rows.find((r) => r.was);

/* With the browser normalising, wet/dry should land near the wet gain itself, so
   the level assertions are about "the room stays under the note" rather than about
   a fixed number. The one assertion that has to be TRUE is the pre-delay's: it
   exists to take reverb off the attack, so it has to measurably do that, or it is
   decoration and should not ship. */
const CHECKS = [
  ["every candidate is unit-energy", proposed.every((r) => Math.abs(r.irEnergy - 1) < 0.01)],
  ["wet/dry at or under -12 dB (power average of six notes)", proposed.every((r) => r.wetDry6Db <= -12)],
  ["hiss floor at or under -45 dB (power average of six notes)", proposed.every((r) => r.hiss6Db <= -45)],
  ["peak under -1 dBFS, nothing clips", proposed.every((r) => r.peakDbfs <= -1 && r.clip === 0)],
  ["pre-delay takes reverb off the attack by 3 dB or more (both ears of the new room vs the old flat tail)", now.every((r) => r.onsetShareDb <= rows[0].onsetShareDb - 3)],
  ["shipped response is NOT too loud (retracts the earlier +17 dB claim)", rows[0].wetDry6Db <= -12],
  /* P09 · the bus now ends in a ceiling: it must be invisible on ordinary play and only act when sounds stack */
  ["P09 · peak with the ceiling in the path stays at or under the old -7.9 dBFS (it is transparent below -3.6)", now.every((r) => r.peakDbfs <= -7.7)],
  [`P09 · wet/dry of the new room within 0.5 dB of the OLD room's average over 20 random draws (${OLD_ROOM.wetDry6Db} dB; six-note average)`, now.every((r) => Math.abs(r.wetDry6Db - OLD_ROOM.wetDry6Db) <= 0.5)],
  ["new room · the hiss between notes stays under -46 dB (the old room's draw measures -49; the gate on any room is -45)", now.every((r) => r.hiss6Db <= -46)],
  ["new room · the late tail (0.8-1.5 s) is DARKER than the old white one: centroid at least 35 % lower (damping)", now.every((r) => r.lateHz <= rows[0].lateHz * 0.65)],
  ["new room · its attack is no more smeared than the plain pre-delay was (within 1.5 dB)", now.every((r) => r.onsetShareDb <= wasPre.onsetShareDb + 1.5)],
  ["new room · the early reflections are there: 24-110 ms holds at least 1.25 x the share of energy the old response had", now.every((r) => r.erShare >= wasPre.erShare * 1.25)],
  ["P09 · twenty loud sounds stacked: the ceiling keeps every sample under 0.95 and below it nothing moves", (() => { let worst = 0, moved = 0; for (let k = 0; k < 20000; k++) { const x = Math.sin(k * 0.013) * 0.12 * 20 * Math.sin(k * 0.0007); worst = Math.max(worst, Math.abs(limit(x))); if (Math.abs(x) < 0.66 && limit(x) !== x) moved++; } return worst < 0.95 && moved === 0; })()],
];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ sr: SR, rows, checks: CHECKS.map(([n, ok]) => ({ n, ok })) }, null, 2));
} else {
  const L = (s, n) => String(s).padEnd(n);
  console.log(`app master bus reverb — sr ${SR}, one playPianoNote A4 then silence`);
  console.log(`(convolver normalised, as ConvolverNode.normalize=true does in every browser)\n`);
  console.log(
    L("response", 38) + L("wetDry", 9) + L("wetDry x6", 11) + L("total", 9) + L("hiss", 9) + L("hiss x6", 9) + L("peak", 9) + L("tailHz", 8) + L("onset", 9) + L("ER dB", 8) + "clip",
  );
  for (const r of rows) {
    console.log(
      L(r.name, 38) +
        L(r.wetDryDb.toFixed(1) + " dB", 9) +
        L(r.wetDry6Db.toFixed(1) + " dB", 11) +
        L(r.totalDb.toFixed(1) + " dB", 9) +
        L(r.hissFloorDb.toFixed(1) + " dB", 9) +
        L(r.hiss6Db.toFixed(1) + " dB", 9) +
        L(r.peakDbfs.toFixed(1) + " dB", 9) +
        L(r.tailHz + "Hz", 8) +
        L(r.onsetShareDb.toFixed(1) + " dB", 9) +
        L(r.erDb.toFixed(1), 8) +
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
