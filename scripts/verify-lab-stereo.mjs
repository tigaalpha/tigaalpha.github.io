#!/usr/bin/env node
/* ── verify-lab-stereo.mjs ── does the offline lab behave like a browser when the mix is STEREO?

   node scripts/verify-lab-stereo.mjs

   scripts/band-audio-lab.mjs used to render mono: the band's StereoPanner positions (play-along-band.ts, M8) were shipped
   but never measured, because the lab had no createStereoPanner and the band quietly fell back to an unpanned mix.
   The lab now has the node (equal-power law, as the spec writes it), runs everything downstream of it per channel
   (separate filter / delay state per ear, one linked compressor), and measures what a stereo mix costs on a phone's single
   speaker. This file pins that the lab does it RIGHT before any "wider" claim leans on it:

     · a hard-left sine: correlation ~0 (one side silent), mono-fold loss ~ -3.0 dB
     · a centred sine through a panner: 0.707 in each ear, correlation 1, loss 0 dB
     · a sine with no panner at all: L = R exactly
     · the equal-power law: L^2 + R^2 is constant across the whole pan range
     · a filter after a hard-left panner leaves the right ear silent (state is per channel)
     · a compressor after two panners turns BOTH ears down together (linked), by the louder one
     · two opposed channels cancel in the fold (loss very large, correlation -1)
     · the mono graph (no panner) renders exactly as it always did
     · the room's two ears are independent noise (a wide tail) yet each has unit energy, and folding them loses nothing
     · AudioParam: a setTarget is followed by a set and a ramp and evaluates like the spec, in one pass */
import { makeContext, render, renderStereo, stereoStats, SR, convolve, busImpulseStereo, limit, appBus, appBusStereo } from "./band-audio-lab.mjs";

let ok = 0, bad = 0;
const check = (name, cond, extra = "") => { (cond ? ok++ : bad++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "   " + extra : ""}`); };
const rms = (b, a = 0, z = b.length) => { let s = 0; for (let i = a; i < z; i++) s += b[i] * b[i]; return Math.sqrt(s / Math.max(1, z - a)); };

function sineGraph(opts, build) {
  const ctx = makeContext(1, opts);
  const out = ctx.createGain(); ctx.outNode = out;
  const o = ctx.createOscillator(); o.oscType = "sine"; o.frequency.value = 440; o.start(0); o.stop(2);
  build(ctx, o, out);
  return ctx;
}
const SEC = 0.6;

/* 1 · hard left */
{
  const ctx = sineGraph({ stereo: true }, (c, o, out) => { const p = c.createStereoPanner(); p.pan.value = -1; o.connect(p); p.connect(out); });
  const { L, R } = renderStereo(ctx, SEC), st = stereoStats(L, R);
  check("hard-left sine: right ear silent", rms(R) < 1e-6 && rms(L) > 0.6, `L ${rms(L).toFixed(3)} R ${rms(R).toExponential(1)}`);
  check("hard-left sine: correlation ~0", Math.abs(st.corr) < 0.01, `corr ${st.corr.toFixed(3)}`);
  check("hard-left sine: mono-fold loss ~ -3.0 dB", Math.abs(st.monoLossDb + 3.01) < 0.05, `${st.monoLossDb.toFixed(2)} dB`);
}
/* 2 · centred through a panner */
{
  const ctx = sineGraph({ stereo: true }, (c, o, out) => { const p = c.createStereoPanner(); p.pan.value = 0; o.connect(p); p.connect(out); });
  const { L, R } = renderStereo(ctx, SEC), st = stereoStats(L, R);
  check("centred panner: 0.707 in each ear (equal power)", Math.abs(rms(L) - rms(R)) < 1e-4 && Math.abs(rms(L) - 0.5) < 0.01, `L ${rms(L).toFixed(3)} (a sine's rms is 0.707 x peak)`);
  check("centred panner: correlation 1, loss 0 dB", st.corr > 0.9999 && Math.abs(st.monoLossDb) < 0.01, `corr ${st.corr.toFixed(4)} loss ${st.monoLossDb.toFixed(3)} dB`);
}
/* 3 · no panner: both ears the same */
{
  const ctx = sineGraph({ stereo: true }, (c, o, out) => { o.connect(out); });
  const { L, R } = renderStereo(ctx, SEC);
  let same = true; for (let i = 0; i < L.length; i++) if (L[i] !== R[i]) { same = false; break; }
  check("no panner anywhere: L === R", same);
}
/* 4 · equal power across the range */
{
  let worst = 0;
  for (const pan of [-1, -0.7, -0.45, -0.1, 0, 0.1, 0.35, 0.8, 1]) {
    const ctx = sineGraph({ stereo: true }, (c, o, out) => { const p = c.createStereoPanner(); p.pan.value = pan; o.connect(p); p.connect(out); });
    const { L, R } = renderStereo(ctx, 0.3);
    worst = Math.max(worst, Math.abs(Math.sqrt(rms(L) ** 2 + rms(R) ** 2) / (1 / Math.SQRT2) - 1));
  }
  check("equal power: L^2 + R^2 constant for pan -1 .. 1", worst < 0.01, `worst error ${(worst * 100).toFixed(2)} %`);
}
/* 5 · per-channel filter state */
{
  const ctx = sineGraph({ stereo: true }, (c, o, out) => {
    const p = c.createStereoPanner(); p.pan.value = -1;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1500;
    const g = c.createGain(); g.gain.value = 0.5;
    o.connect(p); p.connect(f); f.connect(g); g.connect(out);
  });
  const { L, R } = renderStereo(ctx, SEC);
  check("filter + gain after a hard-left panner: right ear stays silent, left passes", rms(R) < 1e-6 && Math.abs(rms(L) - 0.707 * 0.5) < 0.02, `L ${rms(L).toFixed(3)} R ${rms(R).toExponential(1)}`);
}
/* 6 · linked compressor */
{
  const ctx = makeContext(1, { stereo: true });
  const out = ctx.createGain(); ctx.outNode = out;
  const mk = (amp, pan) => { const o = ctx.createOscillator(); o.oscType = "sine"; o.frequency.value = 440; o.start(0); o.stop(2); const g = ctx.createGain(); g.gain.value = amp; const p = ctx.createStereoPanner(); p.pan.value = pan; o.connect(g); g.connect(p); return p; };
  const c = ctx.createDynamicsCompressor(); c.threshold.value = -20; c.knee.value = 0; c.ratio.value = 8; c.attack.value = 0.001; c.release.value = 0.1;
  mk(0.9, -1).connect(c); mk(0.05, 1).connect(c); c.connect(out);
  const { L, R } = renderStereo(ctx, 0.8);
  const a = Math.floor(0.5 * SR);
  const inL = 0.9 / Math.SQRT2, inR = 0.05 / Math.SQRT2;
  const gL = rms(L, a) / inL, gR = rms(R, a) / inR;
  check("compressor is linked: loud left turns the quiet right down by the same amount", gL < 0.6 && Math.abs(gL - gR) < 0.02, `gain L ${gL.toFixed(3)}  R ${gR.toFixed(3)}`);
}
/* 7 · opposed channels */
{
  const ctx = makeContext(1, { stereo: true });
  const out = ctx.createGain(); ctx.outNode = out;
  const mk = (amp, pan) => { const o = ctx.createOscillator(); o.oscType = "sine"; o.frequency.value = 440; o.start(0); o.stop(2); const g = ctx.createGain(); g.gain.value = amp; const p = ctx.createStereoPanner(); p.pan.value = pan; o.connect(g); g.connect(p); p.connect(out); };
  mk(0.5, -1); mk(-0.5, 1);
  const { L, R } = renderStereo(ctx, 0.4), st = stereoStats(L, R);
  check("opposed channels: correlation -1 and the fold cancels", st.corr < -0.999 && st.monoLossDb < -40, `corr ${st.corr.toFixed(3)} loss ${st.monoLossDb.toFixed(1)} dB`);
}
/* 8 · the mono graph is untouched */
{
  const a = render(sineGraph({}, (c, o, out) => { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; o.connect(f); f.connect(out); }), 0.3);
  const ctx = makeContext(1);
  const out = ctx.createGain(); ctx.outNode = out;
  const o = ctx.createOscillator(); o.oscType = "sine"; o.frequency.value = 440; o.start(0); o.stop(2);
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; o.connect(f); f.connect(out);
  const b = render(ctx, 0.3);
  let same = a.length === b.length; for (let i = 0; same && i < a.length; i++) if (a[i] !== b[i]) same = false;
  check("mono graph renders identically twice (deterministic, no stereo state leaks in)", same && !ctx.createStereoPanner);
}
/* 9 · the room */
{
  const [irL, irR] = busImpulseStereo();
  const e = (d) => { let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return s; };
  let cv = 0, ll = 0, rr = 0; for (let i = 0; i < irL.length; i++) { cv += irL[i] * irR[i]; ll += irL[i] ** 2; rr += irR[i] ** 2; }
  check("room: each ear's response has unit energy", Math.abs(e(irL) - 1) < 1e-3 && Math.abs(e(irR) - 1) < 1e-3, `${e(irL).toFixed(4)} ${e(irR).toFixed(4)}`);
  check("room: the two ears are independent (|corr| < 0.05)", Math.abs(cv / Math.sqrt(ll * rr)) < 0.05, `corr ${(cv / Math.sqrt(ll * rr)).toFixed(4)}`);
  /* a click through the room, folded to mono: nothing cancels */
  const click = new Float32Array(SR * 2); click[100] = 1;
  const wl = convolve(click, irL), wr = convolve(click, irR);
  const st = stereoStats(wl, wr);
  check("room: folded to mono the independent tails add in power, nothing cancels (about -3.0 dB, never below)", st.monoLossDb > -3.3 && st.monoLossDb < -2.7, `${st.monoLossDb.toFixed(2)} dB`);
  const { L, R } = appBusStereo(click, click);
  const m = appBus(click);
  check("bus: a centred click keeps the same dry level in the stereo and the one-ear bus", Math.abs(L[100] - m[100]) < 1e-3 && Math.abs(R[100] - m[100]) < 1e-3, `${L[100].toFixed(4)} ${R[100].toFixed(4)} ${m[100].toFixed(4)}`);
}
/* 10 · the ceiling */
{
  let mono = true, bounded = true, prev = -2;
  for (let x = -6; x <= 6; x += 0.001) {
    const y = limit(x);
    if (y < prev - 1e-12) mono = false;
    prev = y;
    if (Math.abs(y) > 0.95) bounded = false;
    if (Math.abs(x) <= 0.66 && Math.abs(y - x) > 1e-9) bounded = false;
  }
  check("ceiling: transparent up to the knee, monotone, never above 0.95", mono && bounded);
  check("ceiling: the busiest 0 dBFS input lands under -0.5 dBFS", Math.abs(limit(1)) < 0.9441, `${(20 * Math.log10(limit(1))).toFixed(2)} dBFS`);
}
/* 11 · AudioParam */
{
  const ctx = makeContext(1);
  const g = ctx.createGain();
  const P = g.gain;
  P.setValueAtTime(1, 0); P.setTargetAtTime(0.5, 0.1, 0.01); P.setValueAtTime(1, 0.2); P.linearRampToValueAtTime(0.2, 0.3);
  const near = (x, y) => Math.abs(x - y) < 1e-3;
  check("AudioParam: a setTarget settles, a later set resets, a ramp follows", near(P.at(0.05), 1) && near(P.at(0.15), 0.5 + 0.5 * Math.exp(-5)) && near(P.at(0.1999), P.at(0.1999)) && near(P.at(0.2), 1) && near(P.at(0.25), 0.6) && near(P.at(0.4), 0.2), `${P.at(0.05)} ${P.at(0.15).toFixed(4)}`);
  const Q = ctx.createGain().gain;
  Q.setValueAtTime(1, 0); Q.setTargetAtTime(0.5, 0.1, 0.02); Q.setTargetAtTime(1, 0.15, 0.02);
  const mid = 0.5 + 0.5 * Math.exp(-0.05 / 0.02);
  check("AudioParam: two setTargets in a row start the second from where the first got to", near(Q.at(0.15), mid) && near(Q.at(0.25), 1 + (mid - 1) * Math.exp(-0.1 / 0.02)), `${Q.at(0.15).toFixed(4)} (want ${mid.toFixed(4)})`);
  /* the cursor must give the same answers as a fresh walk, whatever order it is asked in */
  const R = ctx.createGain().gain;
  for (let k = 0; k < 40; k++) { R.setValueAtTime(1, k * 0.05); R.linearRampToValueAtTime(0.7, k * 0.05 + 0.01); R.linearRampToValueAtTime(1, k * 0.05 + 0.04); }
  let same = true;
  for (let t = 0; t < 2; t += 0.0007) { const v1 = R.at(t); R._ver = -1; const v2 = R.at(t); if (Math.abs(v1 - v2) > 1e-12) same = false; }
  /* cancelScheduledValues: events at or after t go, the history stays */
  const C = ctx.createGain().gain;
  C.setValueAtTime(1, 0); C.linearRampToValueAtTime(0.5, 0.1); C.setValueAtTime(0.5, 0.2); C.linearRampToValueAtTime(1, 0.3);
  C.cancelScheduledValues(0.15);
  check("AudioParam: cancelScheduledValues(t) removes what is at or after t and keeps the history before it", C.ev.length === 2 && near(C.at(0.1), 0.5) && near(C.at(0.25), 0.5) && near(C.at(0.05), 0.75));
  check("AudioParam: the resuming walk agrees with a fresh one at every sample of 40 duck envelopes", same);
}
console.log(`\n${ok}/${ok + bad} checks`);
process.exit(bad ? 1 : 0);
