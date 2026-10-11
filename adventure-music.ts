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
