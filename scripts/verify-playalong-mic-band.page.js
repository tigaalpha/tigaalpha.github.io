// The page half of scripts/verify-playalong-mic-band.mjs — runs in Chromium, one page per scenario.
// The REAL music-engine (its sound functions, blacklist and note detector) and the REAL band run on an
// OfflineAudioContext that is paused every 1/60 s, the pace of the microphone loop, so the game and the detector
// see the sound as it comes and the blacklist is filled as the game fills it. The speaker is a phone's
// (300 Hz – 9 kHz, a little drive) and the microphone hears it and a synthetic piano.
import * as ME from "REAL_ME";
import * as B from "REAL_BAND";

const SR = 44100;
const T0 = 1.7e12;
const NOTE_PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAME = (m) => NOTE_PC[m % 12] + (Math.floor(m / 12) - 1);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CH = { C: [0, 4, 7], F: [5, 9, 0], G: [7, 11, 2], Am: [9, 0, 4] };
const ROOT = { C: 0, F: 5, G: 7, Am: 9 };
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
// a plausible piano: slightly inharmonic partials, faster decay upward, a hammer thump, a damper when the key comes up
function pianoNote(out, f0, tOn, tOff, amp, rnd) {
  const n0 = Math.floor(tOn * SR), len = Math.floor((tOff - tOn + 0.25) * SR), Bi = 0.0004, parts = [];
  for (let k = 1; k <= 12; k++) {
    const fk = k * f0 * Math.sqrt(1 + Bi * k * k); if (fk > 8000) break;
    parts.push({ w: 6.283185307 * fk / SR, a: amp * Math.pow(k, -0.85) * (k === 2 ? 1.1 : 1), tau: (1.6 / Math.pow(k, 0.6)) * SR, ph: rnd() * 6.283 });
  }
  const hold = tOff - tOn;
  for (let i = 0; i < len && n0 + i < out.length; i++) {
    let s = 0; for (const p of parts) s += p.a * Math.sin(p.w * i + p.ph) * Math.exp(-i / p.tau);
    const held = i / SR, rel = held > hold ? Math.exp(-(held - hold) / 0.02) : 1;
    out[n0 + i] += s * Math.min(1, i / (0.003 * SR)) * rel;
  }
  const hl = Math.floor(0.012 * SR);
  for (let i = 0; i < hl && n0 + i < out.length; i++) out[n0 + i] += (rnd() * 2 - 1) * amp * 0.25 * Math.exp(-i / (0.004 * SR));
}

/* One song, played by one kind of player, with the game's sounds coming out of a phone next to its microphone. */
window.__run = async function (cfg) {
  const {
    input = "mic",              // "mic": a real piano heard by the microphone · "tap": the player taps the screen
    accomp = "track",           // "track" (the band) or "metro" (the click)
    bpm = 96, bpb = 4, hand = "right", level = 2, kind = false,
    melody,                     // [{ beat, midi, len }] — what the player plays
    prog, seconds,
    spGain = 0,                 // the phone's volume at the microphone
    pianoRms = 0.05, noise = 0.0008, drive = 1,
    seed = 7, measure = false,  // measure: play the game alone and only report how loud the speaker is at the mic
  } = cfg;
  const total = seconds;
  const real = new OfflineAudioContext(1, Math.round(SR * total), SR);
  // everything the app plays goes to `destination`; ours is a phone speaker feeding the microphone
  const speakerIn = real.createGain();
  const hp1 = real.createBiquadFilter(), hp2 = real.createBiquadFilter(), lp = real.createBiquadFilter(), sat = real.createWaveShaper();
  hp1.type = hp2.type = "highpass"; hp1.frequency.value = hp2.frequency.value = 300; hp1.Q.value = hp2.Q.value = 0.7;
  lp.type = "lowpass"; lp.frequency.value = 9000;
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * drive * 2) / Math.tanh(drive * 2); } sat.curve = curve;
  const spG = real.createGain(), micMix = real.createGain(), analyser = real.createAnalyser();
  analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;
  speakerIn.connect(hp1); hp1.connect(hp2); hp2.connect(lp); lp.connect(sat); sat.connect(spG); spG.connect(micMix);
  micMix.connect(analyser); const silent = real.createGain(); silent.gain.value = 0; analyser.connect(silent); silent.connect(real.destination);
  // the app gets this context, with our speaker as its destination
  const ac = new Proxy(real, { get(t, k) { if (k === "destination") return speakerIn; if (k === "state") return "running"; if (k === "resume") return () => Promise.resolve(); const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
  window.AudioContext = function () { return ac; };
  window.requestIdleCallback = undefined;
  const seedR = rng(seed * 31 + 1); Math.random = () => seedR();
  let simNow = 0; Date.now = () => T0 + simNow * 1000;
  // the player and the piano
  const spb = 60 / bpm, lead = 2.4;
  const prand = rng(seed + 5);
  const notes = melody.map((m, i) => ({ i, midi: m.midi, name: NOTE_NAME(m.midi), pc: NOTE_PC[m.midi % 12], due: lead + m.beat * spb, press: lead + m.beat * spb + (prand() - 0.5) * 0.05, len: Math.min(m.len || 0.5, 0.55), skip: !!m.skip, hit: false, missed: false, beat: m.beat }));
  const piano = new Float32Array(Math.round(SR * total));
  if (input === "mic") { const pr = rng(seed + 9); for (const n of notes) if (!n.skip) pianoNote(piano, mtof(n.midi), n.press, n.press + n.len, 1, pr); }
  let pr2 = 0, pc = 0; for (const n of notes) { if (n.skip) continue; const a = Math.floor(n.press * SR), b = a + Math.floor(0.3 * SR); for (let i = a; i < Math.min(b, piano.length); i++) { pr2 += piano[i] ** 2; pc++; } }
  const gp = input === "mic" && pc && pianoRms > 0 ? pianoRms / Math.sqrt(pr2 / pc) : 0;
  const pianoBuf = real.createBuffer(1, piano.length, SR); pianoBuf.copyToChannel(piano, 0);
  const pianoSrc = real.createBufferSource(); pianoSrc.buffer = pianoBuf; const pg = real.createGain(); pg.gain.value = gp; pianoSrc.connect(pg); pg.connect(micMix); pianoSrc.start(0);
  const nz = real.createBuffer(1, piano.length, SR), nd = nz.getChannelData(0), nr = rng(99); for (let i = 0; i < nd.length; i++) nd[i] = (nr() * 2 - 1) * noise;
  const nzSrc = real.createBufferSource(); nzSrc.buffer = nz; nzSrc.connect(micMix); nzSrc.start(0);
  spG.gain.value = spGain;
  // the game
  const bars = []; { let at = 0; for (const name of prog) { const len = bpb === 4 ? 2 : bpb; bars.push({ at, len, root: ROOT[name], quality: "maj", pcs: CH[name] }); at += len; } }
  const endBeat = Math.max(...notes.map(n => n.beat)) + 2;
  const band = B.createBand({ bars, beatsPerBar: bpb, pickup: 0, spb, lead, endBeat, hand, level: accomp === "track" ? level : 0 });
  const totalNotes = notes.filter(n => !n.skip).length;
  const st = { combo: 0, fever: false, lastSrc: "tap", tapped: false, hits: 0, wrong: 0, wrongList: [], strays: [], missed: 0, micHits: 0, dets: 0, micSafeFrames: 0, frames: 0 };
  const feverAt = Math.max(10, Math.ceil(totalNotes * 0.3)), megaAt = Math.max(20, Math.ceil(totalNotes * 0.6));
  const marks = new Set([0.25, 0.5, 0.75, 1].map(f => Math.max(1, Math.ceil(totalNotes * f))));
  const echo = {}, debounce = {};
  const later = [];   // [time, fn]
  const winOf = (src) => 0.25 + (src === "mic" ? 0.06 : 0) + (kind ? 0.1 : 0);
  const soundHit = (n, src) => {                                // what hitNote does, sound-wise
    ME.playWhoosh();
    later.push([ac.currentTime + 0.17, () => ME.playBoom(false)]);
    B.playChordDing(band.chordAt(n.beat || 0), st.combo);
    if (!st.fever && st.combo >= feverAt) { st.fever = true; ME.playUi("levelup"); }
    else if (st.fever && st.combo === megaAt) ME.playUi("levelup");
    if (marks.has(st.combo)) ME.playUi("levelup");
  };
  const press = (name, src, tnow) => {                          // handleSongInput, as far as scoring goes
    const pcn = name.replace(/-?\d+$/, "");
    if (src === "mic" && tnow - (echo[name] || 0) < 0.35) return;
    if (src === "mic" && st.tapped && st.lastSrc === "tap") {   // a tapper's microphone counts only when it lands on a due note
      let hit = false; for (const n of notes) if (!n.hit && !n.missed && !n.skip && n.pc === pcn && Math.abs(tnow - n.due) <= winOf("mic")) hit = true;
      if (!hit) return;
    }
    if (tnow - (debounce[name] || 0) < 0.13) return;
    debounce[name] = tnow;
    if (src === "tap") { echo[name] = tnow; st.tapped = true; }
    st.lastSrc = src;
    const win = winOf(src);
    let open = 0;
    for (const n of notes) if (!n.skip && Math.abs(tnow - n.due) <= win && !n.hit && !n.missed) open++;
    let best = null, bd = 1e9;
    for (const n of notes) { if (n.hit || n.missed || n.skip || n.name !== name) continue; const d = Math.abs(tnow - n.due); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > win) { best = null; bd = 1e9; for (const n of notes) { if (n.hit || n.missed || n.skip || n.pc !== pcn) continue; const d = Math.abs(tnow - n.due); if (d < bd) { bd = d; best = n; } } }
    if (best && bd <= win) { best.hit = true; st.hits++; if (src === "mic") st.micHits++; st.combo++; soundHit(best, src); }
    else if (open > 0) { st.wrong++; st.combo = 0; st.fever = false; st.wrongList.push(name + "@" + tnow.toFixed(2)); }
    else st.strays.push(name + "@" + tnow.toFixed(2));
  };
  let tnow = 0;
  const N = 2048, buf = new Float32Array(N), db = new Float32Array(N / 2);
  const feed = ME.createMonoDetector(SR, (d) => { st.dets++; press(d.note, "mic", tnow); }, () => { analyser.getFloatFrequencyData(db); return db; }, { lowpassHz: ME.MONO_LOWPASS_HZ });
  // the metronome's clicks
  const clicks = []; if (accomp === "metro") for (let k = -3; k <= endBeat; k++) clicks.push({ t: lead + k * spb, acc: (((k % bpb) + bpb) % bpb) === 0, done: false });
  let lastPump = -1, tapIdx = 0;
  const dt = 1 / 60, nFrames = Math.floor(total / dt) - 1;
  const ps = []; for (let k = 1; k <= nFrames; k++) ps.push(real.suspend(Math.round(k * dt * SR / 128) * 128 / SR));
  const done = real.startRendering();
  let spSumSq = 0, spCnt = 0;
  for (let k = 0; k < nFrames; k++) {
    await ps[k];
    tnow = real.currentTime; simNow = tnow;
    analyser.getFloatTimeDomainData(buf);
    if (measure && tnow > lead - 0.2 && tnow < lead + endBeat * spb) { for (let i = N - 800; i < N; i++) spSumSq += buf[i] * buf[i]; spCnt += 800; }
    // taps: the app plays its own note for the player
    if (input === "tap") while (tapIdx < notes.length && notes[tapIdx].press <= tnow + 0.03) { const n = notes[tapIdx++]; if (n.skip) continue; ME.playPianoNote(n.name, 0.7); press(n.name, "tap", Math.max(tnow, n.press)); }
    if (!measure) feed(buf);                                    // the microphone
    // a note whose window has passed
    for (const n of notes) if (!n.hit && !n.missed && tnow > n.due + winOf(st.lastSrc)) { n.missed = true; if (!n.skip) st.missed++; st.combo = 0; st.fever = false; ME.playMiss(); }
    while (later.length && later[0][0] <= tnow) later.shift()[1]();
    for (const c of clicks) if (!c.done && c.t - 0.05 <= tnow) { c.done = true; ME.playClickAt(c.t, c.acc); }
    // the band, every ~60 ms, for whoever the game takes the player to be (use-play-along.ts bandPump)
    if (tnow - lastPump >= 0.06) {
      lastPump = tnow;
      const onPiano = !(st.lastSrc === "tap" && st.tapped);      // the mic is open: until a tap is heard the player is taken for a pianist
      ME.setMicSafe(onPiano);
      band.setState({ combo: st.combo, fever: st.fever, mega: st.fever && st.combo >= megaAt, pitched: !onPiano, soft: onPiano, micOpen: true });
      st.frames++; if (onPiano) st.micSafeFrames++;
      band.pump(tnow, (x) => x, 1, 0);
    }
    real.resume();
  }
  await done;
  if (measure) return { spRms: Math.sqrt(spSumSq / Math.max(1, spCnt)) };
  return { notes: totalNotes, hits: st.hits, micHits: st.micHits, wrong: st.wrong, wrongList: st.wrongList, strays: st.strays, missed: st.missed, dets: st.dets, micSafeFrames: st.micSafeFrames, frames: st.frames };
};

/* The detector on its own: a piano through createMonoDetector, frame by frame. */
window.__unit = function () {
  const run = (sig, secs) => {
    const dets = []; let tnow = 0, curEnd = 0;
    const N = 2048, win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N);
    const prev = new Float32Array(N / 2), dbOut = new Float32Array(N / 2), re = new Float32Array(N), im = new Float32Array(N);
    const getDb = () => { for (let i = 0; i < N; i++) { re[i] = sig[curEnd - N + i] * win[i]; im[i] = 0; } fft(re, im); for (let k = 0; k < N / 2; k++) { prev[k] = 0.8 * prev[k] + 0.2 * Math.hypot(re[k], im[k]) / N; dbOut[k] = 20 * Math.log10(prev[k] + 1e-12); } return dbOut; };
    const feed = ME.createMonoDetector(SR, (d) => dets.push({ t: tnow, note: d.note }), getDb, { lowpassHz: ME.MONO_LOWPASS_HZ });
    for (let k = 1; k < Math.floor(secs * 60); k++) { tnow = k / 60; curEnd = Math.round(tnow * SR); if (curEnd < N) continue; feed(sig.subarray(curEnd - N, curEnd)); }
    return dets;
  };
  const pcOf = (nm) => nm.replace(/-?\d+$/, "");
  const scale = []; let right = 0;
  for (let m = 48; m <= 84; m++) {                                  // C3 … C6, each key alone
    const sig = new Float32Array(Math.round(1.4 * SR)), r = rng(m), rn = rng(500 + m);
    pianoNote(sig, mtof(m), 0.2, 0.62, 1, r);
    let e = 0, c = 0; for (let i = Math.floor(0.2 * SR); i < Math.floor(0.5 * SR); i++) { e += sig[i] ** 2; c++; }
    const g = 0.05 / Math.sqrt(e / c); for (let i = 0; i < sig.length; i++) sig[i] = sig[i] * g + (rn() * 2 - 1) * 0.004;
    const d = run(sig, 1.4).filter(x => x.t >= 0.2);
    const ok = d.length >= 1 && pcOf(d[0].note) === NOTE_PC[m % 12] && d.every(x => pcOf(x.note) === NOTE_PC[m % 12]);
    if (ok) right++; else scale.push(m);
  }
  // the same key twice
  let again = 0;
  for (const m of [48, 55, 60, 62, 67, 72, 79]) {
    const sig = new Float32Array(Math.round(2.2 * SR)), r = rng(m + 3), rn = rng(900 + m);
    pianoNote(sig, mtof(m), 0.2, 0.62, 1, r); pianoNote(sig, mtof(m), 1.0, 1.42, 1, r);
    let e = 0, c = 0; for (let i = Math.floor(0.2 * SR); i < Math.floor(0.5 * SR); i++) { e += sig[i] ** 2; c++; }
    const g = 0.05 / Math.sqrt(e / c); for (let i = 0; i < sig.length; i++) sig[i] = sig[i] * g + (rn() * 2 - 1) * 0.004;
    const d = run(sig, 2.2);
    if (d.filter(x => x.t < 0.9).length === 1 && d.filter(x => x.t >= 1.0).length === 1) again++;
  }
  // a note that rings on while something loud and noisy drowns it for 200 ms: it must not fire a second time
  let once = 0;
  const bursts = [];
  for (const m of [55, 60, 62, 64, 67, 69]) {
    const sig = new Float32Array(Math.round(2.0 * SR)), r = rng(m + 7), rn = rng(1300 + m);
    pianoNote(sig, mtof(m), 0.2, 1.5, 1, r);                          // held
    let e = 0, c = 0; for (let i = Math.floor(0.2 * SR); i < Math.floor(0.5 * SR); i++) { e += sig[i] ** 2; c++; }
    const g = 0.05 / Math.sqrt(e / c);
    for (let i = 0; i < sig.length; i++) { const t = i / SR; sig[i] = sig[i] * g + (rn() * 2 - 1) * 0.004 + (t > 0.55 && t < 0.75 ? (rn() * 2 - 1) * 0.12 * Math.sin(Math.PI * (t - 0.55) / 0.2) : 0); }
    const n = run(sig, 2.0).length; bursts.push(n);
    if (n === 1) once++;
  }
  return { scaleRight: right, scaleTotal: 37, scaleMissed: scale, again, againTotal: 7, once, onceTotal: 6, bursts };
};
