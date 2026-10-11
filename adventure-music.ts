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
/** the boss arrangement: the same key, harder and denser. */
const BOSS = { kick: "x.x.x.x.x.x.x.xx", snare: "....x.......x.x.", hat: "xxxxxxxxxxxxxxxx", bass: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], bpmMul: 1.12 };

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const degMidi = (M: Mood, d: number) => { const n = M.scale.length, o = Math.floor(d / n); return M.root + M.scale[((d % n) + n) % n] + 12 * o; };

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext) { if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf; const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); let s = 1; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } noiseBuf = b; return b; }
function tone(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, dur: number, vol: number, atk = 0.01) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(atk + 0.02, dur));
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function hit(ctx: BaseAudioContext, out: AudioNode, kind: "kick" | "snare" | "hat", t: number, vol: number) {
  if (kind === "kick") { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.22); return; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(ctx);
  f.type = kind === "hat" ? "highpass" : "bandpass"; f.frequency.value = kind === "hat" ? 7500 : 1800; f.Q.value = kind === "hat" ? 0.7 : 0.9;
  const d = kind === "hat" ? 0.045 : 0.13; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + d + 0.02);
}
/** book one 16th step (0..31 across two bars, the chord moves every bar of a 4-bar loop) */
export function scheduleStep(ctx: BaseAudioContext, out: AudioNode, M: Mood, step: number, t: number, boss: boolean, secPerStep: number) {
  const s16 = step % 16, bar = Math.floor(step / 16) % 4, lead = step % 32;
  const rootDeg = M.prog[bar], g = M.gain;
  const kick = (boss ? BOSS.kick : M.kick)[s16] === "x", snare = (boss ? BOSS.snare : M.snare)[s16] === "x", hat = (boss ? BOSS.hat : M.hat)[s16] === "x";
  if (kick) hit(ctx, out, "kick", t, 0.55 * g); if (snare) hit(ctx, out, "snare", t, 0.3 * g); if (hat) hit(ctx, out, "hat", t, (s16 % 4 === 2 ? 0.14 : 0.08) * g);
  const b = boss ? BOSS.bass[s16] : M.bass[s16];
  if (b === 1) tone(ctx, out, M.wBass, hz(degMidi(M, rootDeg) - 24), t, secPerStep * 1.8, 0.26 * g, 0.008);
  const a = M.arp[s16]; if (a !== _ && a !== undefined) tone(ctx, out, M.wArp, hz(degMidi(M, rootDeg + [0, 2, 4, 7][a % 4]) + 12), t, secPerStep * 1.4, (boss ? 0.09 : 0.065) * g, 0.004);
  const l = M.lead[lead]; if (l !== _ && l !== undefined) tone(ctx, out, boss ? "sawtooth" : M.wLead, hz(degMidi(M, l) + (boss ? 0 : 12)), t, secPerStep * 2.4, (boss ? 0.1 : 0.12) * g, 0.012);
}
export type AdvMusic = { start: () => void; stop: () => void; setBoss: (b: boolean) => void; setOn: (on: boolean) => void; duck: (d: boolean) => void; info: () => any };
export function createAdvMusic(id: string): AdvMusic | null {
  const M = MOODS[id] || MOODS.luma;
  let ctx: AudioContext | null = null, master: GainNode | null = null, timer: any = 0, next = 0, step = 0, boss = false, on = true, ducked = false, steps = 0;
  const vol = () => (on ? (ducked ? 0.06 : 0.22) : 0);
  const apply = () => { if (master && ctx) master.gain.setTargetAtTime(vol(), ctx.currentTime, 0.15); };
  const pump = () => {
    if (!ctx || !master) return;
    const sps = 60 / (M.bpm * (boss ? BOSS.bpmMul : 1)) / 4;
    while (next < ctx.currentTime + 0.35) { const sw = (step % 2 && M.swing) ? M.swing * sps : 0; if (on) scheduleStep(ctx, master, M, step, next + sw, boss, sps); step++; steps++; next += sps; }
  };
  const vis = () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); };
  return {
    start() {
      if (ctx) return;
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
        ctx = new AC(); master = ctx!.createGain(); master.gain.value = 0; master.connect(ctx!.destination);
        const comp = ctx!.createDynamicsCompressor(); master.disconnect(); master.connect(comp); comp.connect(ctx!.destination);
        ctx!.resume().catch(() => {}); next = ctx!.currentTime + 0.1; apply(); pump(); timer = setInterval(pump, 100);
        document.addEventListener("visibilitychange", vis);
      } catch (e) { ctx = null; }
    },
    stop() { clearInterval(timer); document.removeEventListener("visibilitychange", vis); try { if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); const c = ctx; setTimeout(() => { try { c && c.close(); } catch (e) {} }, 300); } catch (e) {} ctx = null; master = null; },
    setBoss(b) { boss = b; }, setOn(o) { on = o; apply(); }, duck(d) { ducked = d; apply(); },
    info: () => ({ id, bpm: M.bpm, steps, boss, on, ducked, running: !!ctx }),
  };
}
/** offline render for the smoke test: peak and RMS of a few bars of a mood, no speakers needed */
export async function renderPreview(id: string, bars = 4, boss = false) {
  const M = MOODS[id] || MOODS.luma, sps = 60 / (M.bpm * (boss ? BOSS.bpmMul : 1)) / 4, secs = bars * 16 * sps + 1.2;
  const OAC = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext; const ctx: OfflineAudioContext = new OAC(1, Math.ceil(44100 * secs), 44100);
  const comp = ctx.createDynamicsCompressor(), m = ctx.createGain(); m.gain.value = 0.22; m.connect(comp); comp.connect(ctx.destination);
  for (let i = 0; i < bars * 16; i++) scheduleStep(ctx, m, M, i, 0.05 + i * sps, boss, sps);
  const buf = await ctx.startRendering(), d = buf.getChannelData(0); let pk = 0, ss = 0, bad = 0; for (let i = 0; i < d.length; i++) { const v = d[i]; if (!isFinite(v)) bad++; pk = Math.max(pk, Math.abs(v)); ss += v * v; }
  return { peak: pk, rms: Math.sqrt(ss / d.length), bad, secs };
}
