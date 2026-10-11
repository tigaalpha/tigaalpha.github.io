/* Adventure Mode music (owner, 2026-10-11: "a fun song for every map, a different mood each").
   Every tune is ORIGINAL and made here, drawn from a few numbers per planet (tempo, scale, chord loop, bass / arpeggio / lead / drum
   patterns) and played by a small look-ahead scheduler on the audio clock, so it neither drifts nor costs a download. A boss fight
   swaps the same tune to a harder, denser arrangement. Nothing here touches the microphone; the master level is low and ducks while
   a question is open. */
export type Mood = { bpm: number; root: number; scale: number[]; prog: number[]; lead: number[]; arp: number[]; bass: number[];
  kick: string; snare: string; hat: string; wLead: OscillatorType; wBass: OscillatorType; wArp: OscillatorType; gain: number; swing?: number };

const MAJ = [0, 2, 4, 7, 9], PHR = [0, 1, 3, 5, 7, 8, 10], MIN = [0, 2, 3, 5, 7, 8, 10], LYD = [0, 2, 4, 6, 7, 9, 11];
const _ = -99;   // a rest in a lead line

export const MOODS: Record<string, Mood> = {
  /* Luma · the glowing jungle: bouncy and curious, a marimba-ish lead over a skipping bass */
  luma: { bpm: 112, root: 60, scale: MAJ, prog: [0, 3, 4, 2], wLead: "triangle", wBass: "sine", wArp: "triangle", gain: 1, swing: 0.12,
    lead: [4, _, 5, 4, _, 2, _, 0,  1, _, 2, _, 4, _, _, _,   4, _, 5, 4, _, 7, _, 5,  4, _, 2, _, 1, _, 0, _],
    arp: [0, _, 1, _, 2, _, 1, _, 0, _, 1, _, 2, 3, 2, _], bass: [1, _, _, 1, _, _, 1, _, 1, _, _, 1, _, _, 1, _],
    kick: "x..x..x...x..x..", snare: "....x.......x...", hat: "..x...x...x...x." },
  /* Ferro · the iron desert: a driving minor groove, four on the floor, a saw bass */
  ferro: { bpm: 126, root: 50, scale: PHR, prog: [0, 0, 5, 4], wLead: "sawtooth", wBass: "sawtooth", wArp: "square", gain: 0.8,
    lead: [0, _, _, 1, 0, _, 3, _,  4, _, 3, _, 1, _, 0, _,   0, _, _, 1, 0, _, 3, _,  5, _, 4, _, 3, _, 1, _],
    arp: [0, 2, _, 2, 0, 2, _, 2, 0, 2, _, 2, 0, 2, 3, 2], bass: [1, 1, _, 1, 1, _, 1, 1, 1, 1, _, 1, 1, _, 1, _],
    kick: "x...x...x...x...", snare: "....x.......x..x", hat: "x.xxx.xxx.xxx.xx" },
  /* Jovia · the gas giant, hold out for the energy: fast and tense, bright arpeggios on a pulsing bass */
  jovia: { bpm: 142, root: 57, scale: MIN, prog: [0, 5, 3, 6], wLead: "square", wBass: "sawtooth", wArp: "square", gain: 0.7,
    lead: [7, _, 7, 6, _, 4, _, 6,  7, _, 9, _, 7, _, _, _,   7, _, 7, 6, _, 4, _, 2,  4, _, 6, _, 4, _, _, _],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 3], bass: [1, _, 1, 1, _, 1, 1, _, 1, _, 1, 1, _, 1, 1, 1],
    kick: "x..x..x.x..x..x.", snare: "....x.......x...", hat: "xxxxxxxxxxxxxxxx" },
  /* Kryo · the crystal ice: slow, wide and shining; bell-like notes and almost no drums */
  kryo: { bpm: 84, root: 64, scale: LYD, prog: [0, 4, 1, 5], wLead: "sine", wBass: "sine", wArp: "sine", gain: 1.1,
    lead: [4, _, _, _, 6, _, 4, _,  2, _, _, _, 1, _, _, _,   4, _, _, _, 6, _, 7, _,  9, _, _, _, 7, _, _, _],
    arp: [0, _, 2, _, 4, _, 2, _, 0, _, 2, _, 5, _, 4, _], bass: [1, _, _, _, _, _, _, _, 1, _, _, _, _, _, 1, _],
    kick: "x.......x.......", snare: "........x.......", hat: "..x...x...x...x." },
  /* Pyra · the lava reactor: heavy and hot, a pounding groove under a snarling saw lead */
  pyra: { bpm: 136, root: 52, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 5], wLead: "sawtooth", wBass: "square", wArp: "sawtooth", gain: 0.62,
    lead: [0, _, 1, 0, _, 2, _, 3,  2, _, 1, _, 0, _, _, _,   0, _, 1, 0, _, 4, _, 3,  5, _, 4, _, 2, _, 1, _],
    arp: [0, _, 2, _, 0, _, 2, _, 0, _, 2, _, 3, _, 2, _], bass: [1, 1, _, 1, 1, _, 1, 1, 1, 1, _, 1, 1, 1, _, 1],
    kick: "x..xx..xx..xx..x", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.xx" },
  /* Nexa · the wreck city: dark and sparse, cold arpeggios drifting over a slow pulse */
  nexa: { bpm: 100, root: 55, scale: MIN, prog: [0, 5, 3, 4], wLead: "sine", wBass: "triangle", wArp: "square", gain: 0.85,
    lead: [_, _, 4, _, _, _, 2, _,  _, _, 1, _, 0, _, _, _,   _, _, 4, _, _, _, 6, _,  _, _, 5, _, 4, _, _, _],
    arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 0, 1], bass: [1, _, _, _, 1, _, _, 1, _, _, 1, _, _, _, 1, _],
    kick: "x.......x..x....", snare: "........x.......", hat: "..x...x...x...x." },
};
MOODS.cobalt = { ...MOODS.ferro, bpm: 118, root: 47, wLead: "square", gain: 0.7 };
MOODS.helios = { ...MOODS.jovia, bpm: 132, root: 62, scale: LYD, wLead: "sawtooth", gain: 0.62 };
MOODS.departure = { ...MOODS.luma, bpm: 118, gain: 0.64 };
MOODS.asteroids = { ...MOODS.nexa, bpm: 124, gain: 0.6 };
MOODS.starharvest = { ...MOODS.helios, bpm: 134, gain: 0.62 };
MOODS.gasskim = { ...MOODS.jovia, bpm: 130, gain: 0.6 };
MOODS.dyson = { ...MOODS.helios, bpm: 126, gain: 0.62 };
MOODS.voidgate = { ...MOODS.nexa, bpm: 138, gain: 0.6 };
MOODS.ashfall = { ...MOODS.pyra, bpm: 112, root: 50, scale: MIN, gain: 0.6 };
/** the boss arrangement: the same key, harder and denser. */
const BOSS = { kick: "x.x.x.x.x.x.x.xx", snare: "....x.......x.x.", hat: "xxxxxxxxxxxxxxxx", bass: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], bpmMul: 1.12 };

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const degMidi = (M: Mood, d: number) => { const n = M.scale.length, o = Math.floor(d / n); return M.root + M.scale[((d % n) + n) % n] + 12 * o; };

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext) { if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf; const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); let s = 1; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } noiseBuf = b; return b; }
export let VOICES = 0;   // note-ons booked since the last reset (the smoke test compares arrangements by it)
export const resetVoices = () => { VOICES = 0; };
function tone(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, dur: number, vol: number, atk = 0.01) {
  VOICES++; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(atk + 0.02, dur));
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function hit(ctx: BaseAudioContext, out: AudioNode, kind: "kick" | "snare" | "hat", t: number, vol: number) {
  VOICES++;
  if (kind === "kick") { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.22); return; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(ctx);
  f.type = kind === "hat" ? "highpass" : "bandpass"; f.frequency.value = kind === "hat" ? 7500 : 1800; f.Q.value = kind === "hat" ? 0.7 : 0.9;
  const d = kind === "hat" ? 0.045 : 0.13; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + d + 0.02);
}
/* ── the arrangement (owner, 2026-10-11: "more fun, more exciting, more dopamine") ──
   A 16-bar form, four sections of four bars: A (the hook), A' (the hook, a bar of variation), B (the lift: the chords climb two
   degrees and the lead answers itself a step higher) and C (the payoff: the whole tune a semitone-pair UP in key, the lead in octaves
   with a third above it). The game drives an INTENSITY (1 calm, 2 fighting, 3 peak: boss, big combo, spell ready) and the
   energy E = section + intensity - 1 (max 3) decides which layers play: E1 the groove, E2 sixteenth hats + octave doubling + snare
   ghosts + a fill every four bars, E3 the third-above harmony, a kick on every beat, open hats, a crash on every section start
   and a fill every two bars. Every bar-4 has a snare roll, the bar before B and C has a rising noise riser, and every kick briefly
   ducks the melody (a sidechain pump) so the beat punches through. */
export type Bus = { drum: AudioNode; mel: GainNode; arpL: AudioNode; arpR: AudioNode };
const SECTION_E = [1, 1, 2, 3];
const degMidiO = (M: Mood, d: number, off = 0) => degMidi(M, d) + off;
export function sectionOf(step: number) { return Math.floor(step / 64) % 4; }
export function energyOf(sec: number, intensity: number) { return Math.min(3, SECTION_E[sec] + intensity - 1); }
function crash(ctx: BaseAudioContext, out: AudioNode, t: number, vol: number) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(ctx); f.type = "highpass"; f.frequency.value = 3500; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 1); }
function riser(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, vol: number) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(ctx); f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.1); }
/** book one 16th step */
export function scheduleStep(ctx: BaseAudioContext, bus: Bus, M: Mood, step: number, t: number, boss: boolean, sps: number, intensity = 1) {
  const sec = sectionOf(step), barInSec = Math.floor((step % 64) / 16), s16 = step % 16, E = Math.min(3, energyOf(sec, intensity) + (boss ? 1 : 0)), g = M.gain, n = M.scale.length;
  const keyOff = sec === 3 ? 2 : 0;                                     // the last chorus lifts the whole tune two semitones
  const prog = sec === 2 ? M.prog.map(d => d + 2) : M.prog, rootDeg = prog[barInSec];
  const bar4 = barInSec === 3;
  const pat = (a: string, b2: string) => (boss ? b2 : a);
  // drums
  let kick = (boss ? BOSS.kick : M.kick)[s16] === "x", snare = (boss ? BOSS.snare : M.snare)[s16] === "x", hat = (boss ? BOSS.hat : M.hat)[s16] === "x";
  if (E >= 2) hat = hat || s16 % 2 === 0 || E >= 3; if (E >= 3 && s16 % 4 === 0) kick = true;
  const fill = bar4 && (E >= 3 || (E === 2 && barInSec === 3 && sec % 2 === 1) || sec === 1 || sec === 3);
  if (fill && s16 >= 12) { snare = true; if (E >= 2 || s16 >= 14) hat = false; }
  const roll = fill && s16 >= 12 ? 0.2 + (s16 - 12) * 0.07 : 0.3;
  if (kick) { hit(ctx, bus.drum, "kick", t, 0.55 * g); const d = bus.mel.gain; d.cancelScheduledValues(t); d.setValueAtTime(0.5, t); d.linearRampToValueAtTime(1, t + 0.14); }   // the pump
  if (snare) hit(ctx, bus.drum, "snare", t, roll * g);
  if (E >= 2 && !snare && s16 % 4 === 3 && s16 % 8 !== 7) hit(ctx, bus.drum, "snare", t, 0.06 * g);                  // ghost notes
  if (hat) hit(ctx, bus.drum, "hat", t, (s16 % 4 === 2 ? 0.14 : 0.08) * g * (E >= 3 && s16 % 4 === 2 ? 1.3 : 1));
  if (s16 === 0 && barInSec === 0 && (sec >= 2 || E >= 3)) crash(ctx, bus.drum, t, 0.16 * g);
  if (s16 === 0 && bar4 === false && barInSec === 2 && (sec === 1 || sec === 2)) riser(ctx, bus.drum, t, sps * 16 * 2, 0.16 * g);   // the climb into B and C
  // bass: the pattern, and in E>=2 an octave jump on the off-beats
  const b = pat(M.bass[s16] as any, BOSS.bass[s16] as any);
  if (b === 1) { const up = E >= 2 && s16 % 8 === 6; tone(ctx, bus.mel, M.wBass, hz(degMidiO(M, rootDeg, keyOff) - 24 + (up ? 12 : 0)), t, sps * 1.8, 0.26 * g, 0.008); }
  // arpeggio, alternating left and right; octave up in the big sections
  const a = M.arp[s16]; if (a !== _ && a !== undefined) { const oct = E >= 3 ? 24 : 12, st = [0, 2, 4, 7][a % 4]; tone(ctx, s16 % 2 ? bus.arpL : bus.arpR, M.wArp, hz(degMidiO(M, rootDeg + st, keyOff) + oct), t, sps * 1.4, (E >= 2 ? 0.08 : 0.06) * g, 0.004); }
  // the hook: A and A' as written, B a step higher, C an octave up in key, with a third above it at E3
  const idx = step % 32, l0 = M.lead[idx];
  if (l0 !== _ && l0 !== undefined) {
    const lift = sec === 2 ? 2 : 0, oct = sec === 3 ? n : 0, var1 = sec === 1 && bar4 ? 2 : 0, lw = boss ? "sawtooth" : sec === 3 ? "square" : M.wLead;
    const d = l0 + lift + var1 + oct;
    tone(ctx, bus.mel, lw, hz(degMidiO(M, d, keyOff) + (boss ? 0 : 12)), t, sps * 2.4, (boss ? 0.1 : 0.12) * g, 0.012);
    if (E >= 2) tone(ctx, bus.mel, "triangle", hz(degMidiO(M, d, keyOff) + 24), t, sps * 1.6, 0.04 * g, 0.01);               // octave sparkle
    if (E >= 3) tone(ctx, bus.mel, "sine", hz(degMidiO(M, d + 2, keyOff) + (boss ? 0 : 12)), t, sps * 2.2, 0.06 * g, 0.014);   // the third above
  }
}
export type AdvMusic = { start: () => void; stop: () => void; setBoss: (b: boolean) => void; setOn: (on: boolean) => void; duck: (d: boolean) => void; setIntensity: (n: number) => void; info: () => any };
function makeBus(ctx: BaseAudioContext, out: AudioNode): Bus {
  const mel = ctx.createGain(), arpL = ctx.createGain(), arpR = ctx.createGain(); mel.connect(out); arpL.connect(mel); arpR.connect(mel);
  const mk = (pan: number, dst: AudioNode) => { const P: any = (ctx as any).createStereoPanner ? (ctx as any).createStereoPanner() : null; if (P) { P.pan.value = pan; dst.disconnect(); dst.connect(P); P.connect(mel); } };
  mk(-0.45, arpL); mk(0.45, arpR);
  return { drum: out, mel, arpL, arpR };
}
export function createAdvMusic(id: string): AdvMusic | null {
  const M = MOODS[id] || MOODS.luma;
  let ctx: AudioContext | null = null, master: GainNode | null = null, bus: Bus | null = null, timer: any = 0, next = 0, step = 0, boss = false, on = true, ducked = false, steps = 0, intensity = 1;
  const vol = () => (on ? (ducked ? 0.06 : 0.24) : 0);
  const apply = () => { if (master && ctx) master.gain.setTargetAtTime(vol(), ctx.currentTime, 0.15); };
  const pump = () => {
    if (!ctx || !master || !bus) return;
    const sps = 60 / (M.bpm * (boss ? BOSS.bpmMul : 1)) / 4;
    while (next < ctx.currentTime + 0.35) { const sw = (step % 2 && M.swing) ? M.swing * sps : 0; if (on) scheduleStep(ctx, bus, M, step, next + sw, boss, sps, intensity); step++; steps++; next += sps; }
  };
  const vis = () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); };
  return {
    start() {
      if (ctx) return;
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
        ctx = new AC(); master = ctx!.createGain(); master.gain.value = 0;
        const comp = ctx!.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx!.destination); bus = makeBus(ctx!, master);
        ctx!.resume().catch(() => {}); next = ctx!.currentTime + 0.1; apply(); pump(); timer = setInterval(pump, 100);
        document.addEventListener("visibilitychange", vis);
      } catch (e) { ctx = null; }
    },
    stop() { clearInterval(timer); document.removeEventListener("visibilitychange", vis); try { if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); const c = ctx; setTimeout(() => { try { c && c.close(); } catch (e) {} }, 300); } catch (e) {} ctx = null; master = null; bus = null; },
    setBoss(b) { boss = b; }, setOn(o) { on = o; apply(); }, duck(d) { ducked = d; apply(); }, setIntensity(n) { intensity = Math.max(1, Math.min(3, Math.round(n))); },
    info: () => ({ id, bpm: M.bpm, steps, boss, on, ducked, running: !!ctx, intensity, section: sectionOf(step), energy: energyOf(sectionOf(step), intensity) }),
  };
}
/** offline render for the smoke test: peak and RMS of `bars` bars of a mood at an intensity, no speakers needed */
export async function renderPreview(id: string, bars = 4, boss = false, intensity = 1, startBar = 0) {
  const M = MOODS[id] || MOODS.luma, sps = 60 / (M.bpm * (boss ? BOSS.bpmMul : 1)) / 4, secs = bars * 16 * sps + 1.5;
  const OAC = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext; const ctx: OfflineAudioContext = new OAC(1, Math.ceil(44100 * secs), 44100);
  const comp = ctx.createDynamicsCompressor(), m = ctx.createGain(); m.gain.value = 0.24; m.connect(comp); comp.connect(ctx.destination); const bus = makeBus(ctx, m);
  resetVoices(); for (let i = 0; i < bars * 16; i++) scheduleStep(ctx, bus, M, startBar * 16 + i, 0.05 + i * sps, boss, sps, intensity); const events = VOICES;
  const buf = await ctx.startRendering(), d = buf.getChannelData(0); let pk = 0, ss = 0, bad = 0; for (let i = 0; i < d.length; i++) { const v = d[i]; if (!isFinite(v)) bad++; pk = Math.max(pk, Math.abs(v)); ss += v * v; }
  return { peak: pk, rms: Math.sqrt(ss / d.length), bad, secs, events };
}

/* ── the cinematic score (owner, 2026-10-11: a film before each map, with its own music and sound effects) ──
   Scheduled up front on its own audio context: a rising drone and pad chords, a noise riser across the build, a timpani hit and a reverse
   swell at every cut, an arpeggio that quickens, per-shot effects, and a brass-like swell when the objective card lands. */
export type CineShot = { kind: string; dur: number };
export function scheduleCineScore(ctx: BaseAudioContext, out: AudioNode, moodId: string, plan: CineShot[], tailSec = 10) {
  const M = MOODS[moodId] || MOODS.luma; const nz = noise(ctx);
  const total = plan.reduce((a, s) => a + s.dur, 0); const starts: number[] = []; let acc = 0; for (const s of plan) { starts.push(acc); acc += s.dur; }
  const T0 = 0.05, g = M.gain;
  const hs = (hzv: number, peak: number, dur: number, at: number, type: BiquadFilterType = "highpass", hz1?: number) => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gg = ctx.createGain(), t0 = T0 + at; s.buffer = nz; f.type = type; f.frequency.setValueAtTime(hzv, t0); if (hz1) f.frequency.exponentialRampToValueAtTime(Math.max(20, hz1), t0 + dur); gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.min(0.05, dur / 3)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(gg); gg.connect(out); s.start(t0); s.stop(t0 + dur + 0.05); };
  const tn = (type: OscillatorType, f0: number, f1: number, peak: number, dur: number, at: number, atk = 0.01) => { VOICES++; const o = ctx.createOscillator(), gg = ctx.createGain(), t0 = T0 + at; o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur); gg.gain.setValueAtTime(0.0001, t0); gg.gain.linearRampToValueAtTime(peak, t0 + atk); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(gg); gg.connect(out); o.start(t0); o.stop(t0 + dur + 0.05); };
  const tim = (at: number, vol: number) => { tn("sine", 95, 38, 0.5 * vol, 0.7, at); hs(500, 0.3 * vol, 0.5, at, "lowpass", 120); };
  // the drone and the chord pads
  tn("sine", hz(M.root - 36), hz(M.root - 36), 0.22, total + tailSec, 0, 3); tn("sine", hz(M.root - 29), hz(M.root - 29), 0.1, total + tailSec, 0, 4);
  for (let t = 0, i = 0; t < total + tailSec - 2; t += 4, i++) { const rd = M.prog[i % 4]; for (const st of [0, 2, 4]) { const f = hz(degMidi(M, rd + st) - 12); tn("triangle", f, f, 0.07 * g, 5, t, 1.4); tn("sine", f * 2, f * 2, 0.04 * g, 5, t, 1.6); } }
  // the build: a noise riser, thumping heart, accelerating arpeggio
  hs(300, 0.12, Math.max(4, total - 3), 0.5, "bandpass", 7000);
  for (let t = 4; t < total - 2; t += 0.9) tn("sine", 75, 42, 0.16, 0.25, t);
  let at = 6, step = 0.5; while (at < total - 1) { const rd = M.prog[Math.floor(at / 4) % 4]; tn("triangle", hz(degMidi(M, rd + [0, 2, 4, 7][Math.floor(at * 4) % 4]) + 12), hz(degMidi(M, rd + [0, 2, 4, 7][Math.floor(at * 4) % 4]) + 12), 0.05 * g, 0.4, at, 0.005); at += step; step = Math.max(0.12, step * 0.93); }
  // every cut gets a reverse swell into a timpani hit; every shot kind its own effect
  plan.forEach((s, i) => {
    const t = starts[i]; if (i) { hs(1500, 0.14, 0.5, Math.max(0, t - 0.5), "highpass", 6500); tim(t, 0.8); }
    switch (s.kind) {
      case "earth": for (let k = 0; k < 4; k++) tn("sine", 1800 + k * 300, 1800 + k * 300, 0.05, 0.08, t + 0.8 + k * 0.7); break;                                       // radio blips
      case "factory": for (let k = 0; k < 6; k++) { tn("sawtooth", 180, 520, 0.05, 0.3, t + 0.4 + k * 0.55); hs(4000, 0.1, 0.07, t + 0.7 + k * 0.55, "bandpass"); } tn("sine", 1400, 1400, 0.07, 0.4, t + 3.2); break;   // servos, sparks, the eyes light
      case "launch": hs(200, 0.3, s.dur - 0.5, t + 0.2, "lowpass", 1400); hs(900, 0.15, 1.2, t + s.dur * 0.5, "bandpass", 5000); break;                            // engines, a fly-by
      case "pad": for (let k = 0; k < 10; k++) { tn("sine", 880, 880, 0.08, 0.1, t + 0.4 + k * 0.62); hs(200, 0.04, 0.1, t + 0.4 + k * 0.62, "bandpass"); } tn("sawtooth", 50, 60, 0.12, s.dur, t, 2); break;   // the countdown ticks over a low drone
      case "liftoff": hs(160, 0.5, s.dur, t, "lowpass", 900); tn("sawtooth", 40, 120, 0.2, s.dur, t, 1.5); tn("sine", 55, 36, 0.4, 2.2, t); for (let k = 0; k < 12; k++) hs(900, 0.1, 0.4, t + k * 0.5, "bandpass", 3000); break;   // the roar of the engines
      case "earthfade": for (let k = 0; k < 8; k++) tn("triangle", hz(M.root + [0, 7, 12, 16][k % 4]), hz(M.root + [0, 7, 12, 16][k % 4]), 0.07, 3.5, t + k * 0.6, 1); hs(3000, 0.12, 2.4, t + 0.5, "bandpass", 8000); break;   // a swelling, hopeful chord
      case "approach": tn("sine", 1100, 1100, 0.08, 1.2, t + 1.2); tn("sine", 1100, 1100, 0.06, 1.2, t + 2.4); break;                                                  // sonar
      case "boss": for (let k = 0; k < 5; k++) tn("square", 700, 700, 0.07, 0.25, t + k * 0.55); tn("sawtooth", 50, 38, 0.2, s.dur - 0.5, t + 0.2, 0.8); break;          // alarm + growl
      case "strike": tn("sine", 600, 120, 0.1, 1.6, t + 0.5); hs(240, 0.55, 1.4, t + s.dur * 0.6, "lowpass", 90); tim(t + s.dur * 0.6, 1.4); break;                    // the whistle, then the blast
      case "objective": [0, 4, 7, 12].forEach((st, k) => { const f = hz(M.root + st); tn("sawtooth", f, f, 0.05 * g, 3.5, t + 0.05, 0.9); tn("sine", f * 2, f * 2, 0.04 * g, 3.5, t + 0.05, 0.9); void k; }); hs(2500, 0.25, 1.4, t, "highpass", 900); tim(t, 1.5); break;   // the swell
      default: hs(600, 0.1, 1.0, t + 0.4, "bandpass", 2400);                                                                                                               // the surface: wind
    }
  });
  // ── cinematic layer (owner, 2026-10-11: grander, more thrilling): a brass-and-strings theme, a choir pad, timpani rolls, a low "BRAAAM" on every cut, a final crescendo ──
  const brass = (mid: number, at: number, dur: number, vol: number) => { for (const dt of [-7, 0, 7]) { const f = hz(mid) * Math.pow(2, dt / 1200); tn("sawtooth", f, f, vol * 0.05 * g, dur, at, Math.min(0.5, dur * 0.35)); } tn("square", hz(mid - 12), hz(mid - 12), vol * 0.03 * g, dur, at, 0.3); };
  const theme = [0, 4, 2, 7, 4, 9, 7, 12];   // scale degrees of a rising heroic call
  for (let sec = 6, n = 0; sec < total - 1; sec += 8, n++) {
    const rd = M.prog[n % 4];
    theme.forEach((d, k) => brass(degMidi(M, rd + d) , sec + k * 0.75, k === 7 ? 3 : 0.72, 0.9 + k * 0.05));
  }
  for (let t = 3; t < total + 2; t += 6) { for (const st of [0, 2, 4, 7]) { const f = hz(degMidi(M, M.prog[Math.floor(t / 6) % 4] + st) + 12); tn("sine", f, f, 0.05 * g, 6, t, 2); tn("triangle", f * 1.005, f * 1.005, 0.03 * g, 6, t, 2.5); } }   // the choir-like pad
  for (let t = 2; t < total - 1; t += 2) for (let k = 0; k < 8; k++) tn("sine", 90 - k, 46, 0.05 + 0.012 * k, 0.22, t + k * 0.1 + Math.min(1, t / total) * 0.0);   // timpani roll
  plan.forEach((sh, i) => { if (!i) return; const t = starts[i]; tn("sawtooth", 58, 36, 0.3, 1.8, t, 0.02); tn("sawtooth", 87, 52, 0.18, 1.6, t, 0.02); hs(300, 0.28, 1.4, t, "lowpass", 140); });   // the low brass hit on every cut
  for (let k = 0; k < 6; k++) brass(M.root + [0, 7, 12, 16, 19, 24][k], Math.max(0, total - 4.2) + k * 0.3, 4, 1.2);   // the closing crescendo chord, stacked up
  hs(400, 0.3, 4, Math.max(0, total - 4.5), "bandpass", 9000); tim(Math.max(0, total - 0.3), 1.6);
  return { total, starts };
}
export type CineAudio = { stop: () => void };
export function createCineAudio(moodId: string, plan: CineShot[]): CineAudio | null {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return null; const ctx: AudioContext = new AC(); const m = ctx.createGain(); m.gain.value = 0.3; const comp = ctx.createDynamicsCompressor(); m.connect(comp); comp.connect(ctx.destination);
    ctx.resume().catch(() => {}); const r = scheduleCineScore(ctx, m, moodId, plan, 14); m.gain.setValueAtTime(0.3, ctx.currentTime + r.total + 12); m.gain.linearRampToValueAtTime(0, ctx.currentTime + r.total + 14);
    return { stop() { try { m.gain.setTargetAtTime(0, ctx.currentTime, 0.12); setTimeout(() => { try { ctx.close(); } catch (e) {} }, 500); } catch (e) {} } };
  } catch (e) { return null; }
}
export async function renderCinePreview(id: string, plan: CineShot[]) {
  const total = plan.reduce((a, s) => a + s.dur, 0) + 4; const OAC = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext; const ctx: OfflineAudioContext = new OAC(1, Math.ceil(44100 * total), 44100);
  const comp = ctx.createDynamicsCompressor(), m = ctx.createGain(); m.gain.value = 0.3; m.connect(comp); comp.connect(ctx.destination); resetVoices(); scheduleCineScore(ctx, m, id, plan, 3);
  const buf = await ctx.startRendering(), d = buf.getChannelData(0); let pk = 0, ss = 0, bad = 0; for (let i = 0; i < d.length; i++) { const v = d[i]; if (!isFinite(v)) bad++; pk = Math.max(pk, Math.abs(v)); ss += v * v; }
  return { peak: pk, rms: Math.sqrt(ss / d.length), bad, secs: total, events: VOICES };
}
