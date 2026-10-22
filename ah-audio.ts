/* Alien Hunt sound (plan 38): procedural guns, explosions, alien and UI sounds, plus a driving battle tune on a look-ahead scheduler. Nothing is downloaded.
   The tune follows the fight (more layers with the wave and the aliens near), ducks and goes dull while a tune-up question is open. */
import type { Ev } from "./ah-engine";

let ctx: AudioContext | null = null, master: GainNode, musicBus: GainNode, musicLp: BiquadFilterNode, sfxBus: GainNode, noiseBuf: AudioBuffer;
const KEY = "tg_ah_snd";
export const soundOn = (): boolean => { try { return localStorage.getItem(KEY) !== "0"; } catch (e) { return true; } };
export const setSoundOn = (v: boolean) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} if (master && ctx) master.gain.value = v ? 0.6 : 0; };

/** call inside a tap: creates or resumes the audio context */
export function warm(): AudioContext | null {
  try {
    if (!ctx) {
      const w = window as any; ctx = w.__tgCineCtx || new (w.AudioContext || w.webkitAudioContext)(); w.__tgCineCtx = ctx;
      const c = ctx as AudioContext;
      master = c.createGain(); master.gain.value = soundOn() ? 0.6 : 0;
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -9; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.15;
      master.connect(lim); lim.connect(c.destination);
      sfxBus = c.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musicLp = c.createBiquadFilter(); musicLp.type = "lowpass"; musicLp.frequency.value = 18000; musicBus = c.createGain(); musicBus.gain.value = 0.5; musicBus.connect(musicLp); musicLp.connect(master);
      noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if ((ctx as AudioContext).state !== "running") (ctx as AudioContext).resume().catch(() => {});
  } catch (e) { ctx = null; }
  return ctx;
}

const noise = (t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, bus: AudioNode = sfxBus, q = 0.7) => {
  const c = ctx as AudioContext, s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
};
const tone = (t: number, dur: number, type: OscillatorType, f0: number, f1: number, vol: number, bus: AudioNode = sfxBus) => {
  const c = ctx as AudioContext, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
};

export function sfx(kind: string, w?: string) {
  if (!ctx || !soundOn()) return; const t = ctx.currentTime + 0.001;
  switch (kind) {
    case "shot": {   // one clearly different voice per gun (owner 2026-10-18); every one has a body (low thump), a crack or sizzle, and a tail
      const sub = (f: number, d: number, v: number) => tone(t, d, "sine", f, f * 0.3, v), tail = (d: number, f: number, v: number) => noise(t + 0.03, d, "lowpass", f, 120, v, sfxBus, 0.5);
      if (w === "pistol") { noise(t, 0.05, "highpass", 5000, 2500, 0.8); tone(t, 0.1, "square", 1500, 300, 0.22); tone(t, 0.12, "sine", 240, 60, 0.9); tone(t + 0.02, 0.18, "triangle", 880, 440, 0.12); tail(0.18, 1800, 0.3); }
      else if (w === "rifle") { noise(t, 0.06, "highpass", 3500, 1500, 0.8); tone(t, 0.1, "sawtooth", 520, 90, 0.3); sub(150, 0.12, 0.8); noise(t, 0.14, "bandpass", 1600, 500, 0.4, sfxBus, 1.5); tail(0.22, 1400, 0.25); }
      else if (w === "shotgun") { noise(t, 0.42, "lowpass", 3200, 220, 1.4); noise(t, 0.1, "highpass", 2800, 900, 0.9); sub(110, 0.35, 1.3); tone(t, 0.3, "sawtooth", 330, 50, 0.4); noise(t + 0.4, 0.05, "highpass", 2600, 2600, 0.35); noise(t + 0.47, 0.05, "highpass", 2000, 2000, 0.3); tail(0.6, 900, 0.4); }
      else if (w === "laser") { tone(t, 0.1, "sawtooth", 2400, 300, 0.32); tone(t, 0.07, "square", 3000, 1100, 0.13); tone(t + 0.01, 0.12, "triangle", 1200, 200, 0.15); noise(t, 0.04, "highpass", 7000, 7000, 0.1); }
      else if (w === "rail") { tone(t, 0.12, "sine", 80, 40, 1.3); tone(t + 0.1, 0.55, "sawtooth", 3200, 90, 0.5); tone(t + 0.1, 0.45, "sine", 110, 28, 1.3); noise(t + 0.1, 0.35, "highpass", 5000, 900, 0.7); tone(t + 0.12, 0.7, "triangle", 1500, 180, 0.22); noise(t + 0.2, 0.7, "bandpass", 700, 200, 0.3, sfxBus, 2); }
      else if (w === "arc") { for (let i = 0; i < 4; i++) { noise(t + i * 0.03, 0.06, "bandpass", 3000 + i * 600, 900, 0.5, sfxBus, 5); tone(t + i * 0.03, 0.06, "sawtooth", 200 + i * 400, 1600, 0.12); } tone(t, 0.3, "square", 90, 700, 0.14); noise(t + 0.1, 0.3, "highpass", 4500, 1500, 0.3); }
      else if (w === "beam") { tone(t, 0.06, "sine", 1700, 1450, 0.2); tone(t, 0.06, "triangle", 860, 800, 0.12); tone(t, 0.06, "sine", 3400, 3000, 0.07); noise(t, 0.03, "highpass", 8000, 8000, 0.06); }
      else if (w === "pulsar") { for (let i = 0; i < 3; i++) { tone(t + i * 0.04, 0.08, "square", 1700 - i * 250, 450, 0.18); noise(t + i * 0.04, 0.03, "highpass", 5000, 3000, 0.15); } sub(190, 0.14, 0.5); tone(t, 0.2, "triangle", 300, 900, 0.1); }
      else if (w === "nova") { tone(t, 0.4, "sawtooth", 140, 1100, 0.3); tone(t, 0.4, "square", 70, 560, 0.12); tone(t + 0.14, 0.55, "sine", 1600, 90, 0.5); sub(75, 0.5, 1.3); noise(t + 0.14, 0.3, "highpass", 3800, 1000, 0.55); tone(t + 0.14, 0.6, "triangle", 600, 60, 0.3); }
      else if (w === "storm") { tone(t, 0.05, "sawtooth", 2600, 700, 0.15); tone(t + 0.016, 0.05, "square", 2200, 900, 0.11); tone(t, 0.07, "sine", 330, 120, 0.22); noise(t, 0.03, "highpass", 8000, 8000, 0.09); noise(t + 0.02, 0.05, "bandpass", 2000, 900, 0.1, sfxBus, 2); }
      else if (w === "cryo") { noise(t, 0.12, "bandpass", 6500, 3000, 0.24); tone(t, 0.1, "sine", 3000, 3800, 0.1); tone(t, 0.1, "triangle", 1500, 2100, 0.09); noise(t, 0.2, "highpass", 8000, 5000, 0.12); tone(t + 0.02, 0.14, "sine", 4200, 2800, 0.06); }
      else if (w === "rpg") { noise(t, 0.06, "highpass", 3000, 1500, 0.6); sub(70, 0.45, 1.5); noise(t, 0.5, "lowpass", 3000, 150, 1.2); noise(t + 0.06, 0.7, "bandpass", 1400, 300, 0.9, sfxBus, 0.6); tone(t + 0.05, 0.6, "sawtooth", 180, 40, 0.4); noise(t + 0.2, 0.9, "highpass", 2500, 600, 0.3); }
      else if (w === "salvo") { noise(t, 0.2, "bandpass", 1500, 350, 0.7, sfxBus, 0.8); tone(t, 0.2, "sawtooth", 420, 90, 0.35); sub(95, 0.18, 0.9); noise(t + 0.03, 0.3, "highpass", 3000, 900, 0.3); tone(t + 0.02, 0.12, "square", 900, 200, 0.12); }
      else { noise(t, 0.25, "bandpass", 900, 200, 0.8); tone(t, 0.3, "sawtooth", 260, 60, 0.5); tone(t, 0.2, "sine", 100, 40, 0.8); tone(t, 0.3, "triangle", 700, 140, 0.15); }   // plasma launcher
      break; }
    case "rboom": noise(t, 1.4, "lowpass", 3200, 70, 2.4, sfxBus, 0.4); noise(t, 0.3, "highpass", 3500, 700, 1.0); tone(t, 1.0, "sine", 80, 20, 2.4); tone(t + 0.05, 0.8, "sawtooth", 140, 30, 0.5); noise(t + 0.15, 1.0, "bandpass", 500, 120, 0.8, sfxBus, 0.8); break;
    case "sboom": noise(t, 0.5, "lowpass", 3000, 120, 1.2, sfxBus, 0.5); noise(t, 0.12, "highpass", 4000, 1500, 0.6); tone(t, 0.4, "sine", 110, 30, 1.2); break;
    case "boom": noise(t, 0.9, "lowpass", 2600, 80, 1.8, sfxBus, 0.4); noise(t, 0.25, "highpass", 3000, 800, 0.8); tone(t, 0.7, "sine", 90, 24, 1.8); tone(t + 0.04, 0.5, "triangle", 60, 22, 1.0); break;
    case "hit": tone(t, 0.05, "square", 1500, 900, 0.18); noise(t, 0.04, "bandpass", 2500, 2000, 0.2); break;
    case "head": tone(t, 0.12, "sine", 1800, 2600, 0.35); tone(t + 0.04, 0.16, "sine", 2400, 3200, 0.25); break;
    case "kill": noise(t, 0.28, "bandpass", 1400, 220, 0.6, sfxBus, 2); tone(t, 0.22, "sawtooth", 360, 70, 0.25); break;
    case "bigkill": noise(t, 0.5, "bandpass", 900, 120, 0.9, sfxBus, 1.5); tone(t, 0.45, "sawtooth", 220, 45, 0.45); break;
    case "hurt": tone(t, 0.18, "sine", 110, 45, 0.9); noise(t, 0.12, "lowpass", 800, 200, 0.6); break;
    case "reload": noise(t, 0.03, "highpass", 3000, 3000, 0.4); tone(t, 0.04, "square", 700, 500, 0.2); noise(t + 0.35, 0.05, "highpass", 2500, 2500, 0.5); tone(t + 0.35, 0.06, "square", 420, 300, 0.25); noise(t + 0.7, 0.04, "highpass", 3500, 3500, 0.5); break;
    case "empty": tone(t, 0.04, "square", 900, 700, 0.25); break;
    case "swap": noise(t, 0.07, "bandpass", 2000, 900, 0.35); tone(t, 0.05, "square", 500, 380, 0.15); break;
    case "spit": noise(t, 0.3, "bandpass", 1800, 500, 0.45, sfxBus, 3); tone(t, 0.25, "sine", 300, 700, 0.12); break;
    case "screech": tone(t, 0.4, "sawtooth", 700, 1500, 0.12); tone(t, 0.4, "square", 710, 1100, 0.07); break;
    case "charge": tone(t, 0.9, "sawtooth", 70, 110, 0.35); noise(t, 0.9, "lowpass", 500, 900, 0.5); tone(t + 0.2, 0.7, "square", 55, 90, 0.2); break;
    case "flare": noise(t, 0.4, "bandpass", 700, 300, 0.5, sfxBus, 1.5); tone(t, 0.4, "sawtooth", 180, 420, 0.25); tone(t, 0.4, "sine", 90, 45, 0.4); break;
    case "bolt": tone(t, 0.18, "sawtooth", 1400, 500, 0.14); tone(t, 0.18, "sine", 2200, 900, 0.1); break;
    case "claw": noise(t, 0.12, "highpass", 4000, 2000, 0.35); break;
    case "wave": [196, 262, 392].forEach((f, i) => { tone(t + i * 0.16, 0.5, "sawtooth", f, f * 0.99, 0.2); tone(t + i * 0.16, 0.5, "square", f / 2, f / 2, 0.14); }); noise(t, 0.6, "lowpass", 600, 100, 0.4); break;
    case "tune": [880, 1175, 1760].forEach((f, i) => tone(t + i * 0.09, 0.5, "sine", f, f, 0.3)); tone(t, 0.8, "triangle", 440, 440, 0.2); break;
    case "tuneok": [523, 659, 784, 1047].forEach((f, i) => { tone(t + i * 0.08, 0.4, "triangle", f, f, 0.3); tone(t + i * 0.08, 0.4, "sine", f * 2, f * 2, 0.12); }); break;
    case "tunebad": tone(t, 0.35, "sawtooth", 170, 110, 0.22); tone(t + 0.12, 0.35, "sawtooth", 160, 100, 0.2); break;
    case "go": tone(t, 0.12, "square", 440, 440, 0.2); tone(t + 0.14, 0.25, "square", 660, 660, 0.22); break;
    case "win": [392, 523, 659, 784, 1047].forEach((f, i) => { tone(t + i * 0.12, 0.7, "triangle", f, f, 0.3); tone(t + i * 0.12, 0.7, "sawtooth", f / 2, f / 2, 0.1); }); break;
    case "lose": [330, 262, 220, 165].forEach((f, i) => tone(t + i * 0.22, 0.6, "sawtooth", f, f * 0.97, 0.2)); break;
    case "pickup": [660, 880, 1320].forEach((f, i) => { tone(t + i * 0.07, 0.25, "sine", f, f * 1.02, 0.28); }); tone(t, 0.4, "triangle", 330, 330, 0.15); break;
    case "slide": noise(t, 0.5, "bandpass", 500, 2500, 0.5, sfxBus, 1.2); break;
    case "click": tone(t, 0.04, "square", 900, 700, 0.15); break;
  }
}

/** creature voices (owner, 2026-10-18: scary monster sounds): every alien has a spawn roar, an idle growl (quieter the farther it is), a bite sound and a death scream */
const VOICE_OF: Record<string, string> = { scarab: "skitter", behemoth: "charger", wisp: "skyeye", drone: "spitter", stalker: "mantis", warden: "charger", matriarch: "flarecaster", walker: "skyeye", leaper: "skitter", spiker: "flarecaster", veilmaw: "skyeye", bloater: "spitter", razor: "mantis", titan: "charger", capling: "flarecaster", manthood: "mantis", domestalker: "stalker" };
export function creature(kind0: string, mode: "spawn" | "growl" | "bite" | "die", dist = 0) {
  const kind = VOICE_OF[kind0] || kind0;
  if (!ctx || !soundOn()) return; const c = ctx as AudioContext, t = c.currentTime + 0.001;
  const vol = mode === "growl" ? Math.max(0.12, 1 - dist / 32) * 0.7 : mode === "spawn" ? 0.95 : 1;
  const b = c.createGain(); b.gain.value = vol; b.connect(sfxBus);
  const wob = (f: number, dur: number, type: OscillatorType, depth: number, rate: number, v: number, f1 = f) => { const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); l.frequency.value = rate; lg.gain.value = depth; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(b); o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05); };
  const long = mode === "spawn" ? 1.1 : mode === "die" ? 0.9 : mode === "bite" ? 0.25 : 0.7;
  switch (kind) {
    case "skitter": // chittering hiss and rapid clicks
      noise(t, long, "highpass", 5000, 3000, 0.35, b); for (let i = 0; i < (mode === "growl" ? 6 : 10); i++) tone(t + i * 0.05 + Math.random() * 0.02, 0.03, "square", 2200 + Math.random() * 1400, 1500, 0.12, b);
      if (mode === "die") wob(1800, 0.7, "sawtooth", 300, 40, 0.22, 250); if (mode === "spawn") wob(900, 0.9, "sawtooth", 200, 22, 0.2, 1700); break;
    case "mantis": // a rising shriek over clicking mandibles
      wob(mode === "growl" ? 380 : 700, long, "sawtooth", 160, 14, 0.3, mode === "die" ? 120 : mode === "spawn" ? 1500 : 520); noise(t, long, "bandpass", 2500, 4000, 0.18, b, 3);
      for (let i = 0; i < 5; i++) tone(t + i * 0.07, 0.03, "square", 1800, 900, 0.1, b); break;
    case "spitter": // a wet gurgle
      wob(mode === "die" ? 260 : 150, long, "sine", 60, 11, 0.35, mode === "die" ? 60 : 110); noise(t, long, "bandpass", 700, 300, 0.3, b, 2); for (let i = 0; i < 6; i++) tone(t + i * 0.09, 0.07, "sine", 300 + Math.random() * 200, 100, 0.16, b); break;
    case "flarecaster": // an eerie detuned chant
      wob(220, long * 1.2, "sawtooth", 8, 6, 0.2, mode === "die" ? 90 : 235); wob(226, long * 1.2, "sawtooth", 8, 5, 0.16, mode === "die" ? 95 : 240); wob(330, long * 1.2, "triangle", 12, 7, 0.12, 310); break;
    case "charger": // a deep bestial roar
      wob(mode === "growl" ? 70 : 90, long * 1.3, "sawtooth", 30, 18, 0.5, mode === "die" ? 35 : 60); noise(t, long, "lowpass", 900, 200, 0.5, b, 0.8); tone(t, long, "sine", 55, 35, 0.6, b); break;
    case "skyeye": // a thin otherworldly warble
      wob(900, long * 1.1, "sine", 300, 9, 0.22, mode === "die" ? 200 : 1100); wob(1350, long, "triangle", 200, 13, 0.1, 1500); break;
  }
  if (mode === "bite") noise(t, 0.18, "bandpass", 1800, 600, 0.5, b, 1.5);
}
export function events(ev: Ev[]) {
  for (const e of ev) {
    if (e.k === "shot") sfx("shot", e.w); else if (e.k === "boom") sfx(((e.n as number) || 1) >= 2 ? "rboom" : ((e.n as number) || 1) < 1 ? "sboom" : "boom"); else if (e.k === "hit") sfx("hit"); else if (e.k === "head") { sfx("head"); sfx("kill"); creature(e.w as string, "die"); }
    else if (e.k === "spawn") creature(e.w as string, "spawn"); else if (e.k === "growl") creature(e.w as string, "growl", e.n || 0); else if (e.k === "bite") creature(e.w as string, "bite"); else if (e.k === "kill") { creature(e.w as string, "die"); sfx(e.w === "mantis" || e.w === "charger" ? "bigkill" : "kill"); } else if (e.k === "hurt") sfx("hurt"); else if (e.k === "reload") sfx("reload"); else if (e.k === "empty") sfx("empty");
    else if (e.k === "station") sfx("tuneok"); else if (e.k === "strike") { sfx("rboom"); sfx("rboom"); } else if (e.k === "dig") sfx("hit");
    else if (e.k === "swap") sfx("swap"); else if (e.k === "pickup") sfx("pickup"); else if (e.k === "slide") sfx("slide"); else if (e.k === "spit") sfx((VOICE_OF[e.w as string] || e.w) === "flarecaster" ? "flare" : (VOICE_OF[e.w as string] || e.w) === "skyeye" ? "bolt" : "spit"); else if (e.k === "charge") sfx("charge"); else if (e.k === "wave") sfx("wave"); else if (e.k === "tune") sfx("tune"); else if (e.k === "win") sfx("win"); else if (e.k === "lose") sfx("lose");
  }
}

/* ── the battle tune: 142 bpm, A minor, driving; layers added with intensity (1 calm .. 3 all-out) ── */
let timer: any = 0, step16 = 0, nextT = 0, intensity = 1, ducked = false, running = false;
const BPM = 142, S16 = 60 / BPM / 4;
const ROOTS = [57, 53, 48, 55], CH = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];   // Am F C G (bass roots a, f, c, g); minor first chord, then majors
const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const LEAD = [0, 3, 7, 12, 7, 3, 10, 7, 12, 15, 12, 10, 7, 3, 5, 7];
function sched(t: number, i: number) {
  const bar = Math.floor(i / 16) % 4, p = i % 16, root = ROOTS[bar];
  const c = ctx as AudioContext, mb = musicBus;
  // drums
  if (p % 4 === 0) { tone(t, 0.16, "sine", 150, 42, 0.95, mb); noise(t, 0.03, "lowpass", 800, 400, 0.3, mb); }
  if (p === 4 || p === 12) { noise(t, 0.16, "bandpass", 1900, 900, 0.55, mb, 0.9); tone(t, 0.1, "triangle", 220, 140, 0.3, mb); }
  if (p % 2 === 0) noise(t, 0.04, "highpass", 7000, 7000, p % 4 === 2 ? 0.2 : 0.1, mb);
  if (intensity >= 2 && p % 2 === 1) noise(t, 0.03, "highpass", 8000, 8000, 0.09, mb);
  if (intensity >= 3 && (p === 15 || p === 7)) noise(t, 0.12, "bandpass", 2200, 1200, 0.3, mb);
  // bass: pumping 8ths
  if (p % 2 === 0) { const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = mf(root - 12 + (p === 6 || p === 14 ? 12 : 0)); f.type = "lowpass"; f.frequency.setValueAtTime(900 + intensity * 500, t); f.frequency.exponentialRampToValueAtTime(220, t + S16 * 1.8); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + S16 * 1.9); o.connect(f); f.connect(g); g.connect(mb); o.start(t); o.stop(t + S16 * 2); }
  // chord stab on the offbeats
  if (intensity >= 2 && (p === 2 || p === 6 || p === 10 || p === 14) ) CH[bar].forEach(n => { const o = c.createOscillator(), g = c.createGain(); o.type = "square"; o.frequency.value = mf(root + n + 12); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + S16 * 1.4); o.connect(g); g.connect(mb); o.start(t); o.stop(t + S16 * 1.5); });
  // arpeggio lead in the second half of every bar pair, always at 3
  if (intensity >= 3 || (intensity >= 2 && bar % 2 === 1)) { const n = LEAD[p] + (bar === 1 ? -4 : bar === 2 ? -9 : bar === 3 ? -2 : 0); const o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = mf(root + 24 + n % 12 + (p > 7 ? 12 : 0)); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + S16 * 1.8); o.connect(g); g.connect(mb); o.start(t); o.stop(t + S16 * 2); }
  // riser into every fourth bar
  if (bar === 3 && p === 0) noise(t, S16 * 16, "bandpass", 400, 6000, 0.12, mb, 2);
}
function pump() {
  if (!ctx || !running) return; const c = ctx; if (nextT < c.currentTime) nextT = c.currentTime + 0.05;
  while (nextT < c.currentTime + 0.5) { if (!ducked) sched(nextT, step16); else if (step16 % 16 === 0) { tone(nextT, S16 * 15, "triangle", mf(ROOTS[Math.floor(step16 / 16) % 4] - 12), mf(ROOTS[Math.floor(step16 / 16) % 4] - 12), 0.18, musicBus); } nextT += S16; step16++; }
}
export function musicStart() { if (!ctx || running) return; running = true; step16 = 0; nextT = ctx.currentTime + 0.1; timer = setInterval(pump, 120); pump(); }
export function musicStop() { running = false; clearInterval(timer); }
export function setIntensity(n: number) { intensity = Math.max(1, Math.min(3, n)); }
/** a question is open: the tune thins to a soft drone and goes dull; false brings it back */
export function setDucked(v: boolean) { ducked = v; if (!ctx) return; const t = ctx.currentTime; musicLp.frequency.cancelScheduledValues(t); musicLp.frequency.linearRampToValueAtTime(v ? 700 : 18000, t + 0.25); musicBus.gain.cancelScheduledValues(t); musicBus.gain.linearRampToValueAtTime(v ? 0.22 : 0.5, t + 0.25); }

/* ── the map-screen tune: slow, wide and hopeful, nothing like the battle tune (92 bpm, D lydian, pads + bell arpeggio + a soft heartbeat) ── */
let mTimer: any = 0, mStep = 0, mNext = 0, mRun = false, mBus: GainNode | null = null;
const MB = 92, M8 = 60 / MB / 2, MROOT = [50, 47, 55, 52], MCH = [[0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 9]];   // Dmaj7, Bm7, Gmaj7, Dadd6 voicings
function mSched(t: number, i: number) {
  const c = ctx as AudioContext, bar = Math.floor(i / 8) % 4, p = i % 8, root = MROOT[bar], bus = mBus as GainNode;
  if (p === 0) {   // a wide pad chord that breathes for the whole bar
    for (const n of MCH[bar]) for (const dt of [-6, 6]) { const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = "sawtooth"; o.detune.value = dt; o.frequency.value = mf(root + n + 12); f.type = "lowpass"; f.frequency.value = 1100;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + M8 * 8); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + M8 * 8 + 0.05); }
    tone(t, M8 * 8, "sine", mf(root - 12), mf(root - 12), 0.22, bus);
  }
  if (p === 0 || p === 4) { tone(t, 0.22, "sine", 90, 38, 0.55, bus); }   // soft heartbeat
  const arp = [0, 7, 11, 14, 16, 14, 11, 7][p] + (bar === 1 ? -2 : 0); if (p % 2 === 0 || p === 5) tone(t, 0.9, "sine", mf(root + 24 + arp), mf(root + 24 + arp), 0.07, bus);   // bell arpeggio
  if (p === 7 && bar === 3) noise(t, M8 * 2, "bandpass", 500, 5000, 0.07, bus, 1.5);   // a gentle swell into the loop
}
function mPump() { if (!ctx || !mRun) return; const c = ctx; if (mNext < c.currentTime) mNext = c.currentTime + 0.05; while (mNext < c.currentTime + 0.6) { mSched(mNext, mStep); mNext += M8; mStep++; } }
export function menuStart() { if (!ctx || mRun) return; mRun = true; mStep = 0; mNext = ctx.currentTime + 0.1; mBus = ctx.createGain(); mBus.gain.value = 0.55; mBus.connect(master); mTimer = setInterval(mPump, 150); mPump(); }
export function menuStop() { mRun = false; clearInterval(mTimer); try { if (mBus && ctx) { mBus.gain.setTargetAtTime(0, ctx.currentTime, 0.15); const b = mBus; setTimeout(() => { try { b.disconnect(); } catch (e) {} }, 800); } } catch (e) {} mBus = null; }
export function dispose() { musicStop(); menuStop(); try { master && master.disconnect(); } catch (e) {} ctx = null; }
