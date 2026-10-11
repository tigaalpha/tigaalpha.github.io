/* Per-robot and per-pet sound and special effects (owner, 2026-10-11): "every robot has its own sound effects for its weapon
   and skill; every pet has its own sound and special effect for its weapon, and its attack effect differs too; the robots'
   graphics must look different but grand".
   Nothing here is stored: a robot's voice and its flourish are a pure function of its id, its class and the move it throws, so the
   same robot always sounds and looks the same and no two chassis share all of it. Used by the PvP arena (arena-fx `sfx`, `strike`)
   and by Adventure (`adventure-sfx.ts`). Pure data + small builders, no React. */
export type Voice = { p: number; sig: string; pet?: string; mv?: string; h: number };

const hashOf = (s: string) => String(s || "x").split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 17) >>> 0;
/** what each class adds on top of the shared weapon sound: its own timbre, so a striker thuds and an engineer pings */
const CLASS_SIG: Record<string, string> = { striker: "thud", bulwark: "clang", ghost: "air", tactician: "scan", engineer: "ping", herald: "chime", virtuoso: "arp" };
export const PET_SIG: Record<string, string> = { volt: "zap", ember: "crackle", frost: "icy", flora: "pluck", steel: "clang", aether: "shimmer" };

/** the voice of a robot (model + class key) or a pet (type + species + the move it throws) */
export function voiceOf(model: string, cls: string, pet?: { type: string; species?: string; mv?: string } | null): Voice {
  if (pet) { const h = hashOf(pet.species || pet.type); return { p: 0.85 + (h % 7) * 0.07, sig: PET_SIG[pet.type] || "pluck", pet: pet.type, mv: pet.mv, h }; }
  const h = hashOf(model);
  return { p: 0.78 + (h % 11) * 0.055, sig: CLASS_SIG[cls] || "ping", h };
}

/** layered signature sound, scheduled at time t on `out`. `nz` gives a noise buffer. `kind` is the weapon sound it rides on. */
export function playSig(ac: BaseAudioContext, out: AudioNode, nz: AudioBuffer, t: number, v: Voice, kind: string, vol = 1) {
  const p = v.p;
  const tone = (type: OscillatorType, f0: number, f1: number, peak: number, dur: number, at = 0) => {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = t + at; o.type = type; o.frequency.setValueAtTime(f0 * p, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * p), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const hiss = (hz: number, peak: number, dur: number, type: BiquadFilterType = "highpass", at = 0, hz1?: number) => {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t0 = t + at; s.buffer = nz; f.type = type; f.frequency.setValueAtTime(hz, t0);
    if (hz1) f.frequency.exponentialRampToValueAtTime(Math.max(20, hz1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t0); s.stop(t0 + dur + 0.05);
  };
  switch (v.sig) {
    case "thud": tone("sine", 120, 40, 0.3, 0.2); hiss(500, 0.12, 0.1, "bandpass"); break;
    case "clang": tone("square", 760, 700, 0.1, 0.22); tone("sine", 1520, 1480, 0.07, 0.3); break;
    case "air": hiss(5200, 0.12, 0.28, "highpass", 0, 1800); tone("triangle", 900, 260, 0.06, 0.2); break;
    case "scan": tone("sine", 1500, 1500, 0.07, 0.06); tone("sine", 2000, 2000, 0.07, 0.06, 0.07); break;
    case "ping": tone("square", 2400, 1700, 0.07, 0.12); tone("sine", 3200, 3200, 0.04, 0.2, 0.02); break;
    case "chime": tone("sine", 1318, 1318, 0.09, 0.4); tone("sine", 1976, 1976, 0.05, 0.5, 0.05); break;
    case "arp": [0, 4, 7].forEach((st, i) => tone("triangle", 660 * Math.pow(2, st / 12), 660 * Math.pow(2, st / 12), 0.07, 0.16, i * 0.045)); break;
    case "zap": tone("sawtooth", 600, 2600, 0.08, 0.1); tone("square", 2200, 700, 0.06, 0.08, 0.05); hiss(3000, 0.1, 0.12, "bandpass", 0.02, 6000); break;
    case "crackle": for (let i = 0; i < 4; i++) hiss(1800 + i * 500, 0.1, 0.05, "bandpass", i * 0.035); hiss(500, 0.14, 0.35, "lowpass", 0, 200); break;
    case "icy": tone("sine", 2637, 2637, 0.08, 0.45); tone("sine", 3520, 3520, 0.05, 0.5, 0.04); tone("sine", 3951, 3951, 0.04, 0.5, 0.09); break;
    case "pluck": tone("triangle", 392, 330, 0.12, 0.16); tone("sine", 784, 660, 0.07, 0.2, 0.03); break;
    case "shimmer": [0, 3, 7, 12].forEach((st, i) => tone("sine", 880 * Math.pow(2, st / 12), 880 * Math.pow(2, st / 12), 0.06, 0.4, i * 0.06)); break;
    default: tone("sine", 800, 400, 0.05, 0.1);
  }
  // what the pet's WEAPON adds: a bite snaps, a claw rasps, a spit bubbles, a roar growls
  if (v.pet) {
    if (v.mv === "bite") hiss(2500, 0.14, 0.06, "bandpass");
    else if (v.mv === "claw") { hiss(4200, 0.12, 0.14, "highpass"); hiss(3000, 0.1, 0.14, "highpass", 0.06); }
    else if (v.mv === "spit") tone("sine", 300, 900, 0.1, 0.12);
    else if (v.mv === "roar") { tone("sawtooth", 110, 70, 0.14, 0.5); hiss(300, 0.12, 0.5, "lowpass"); }
  }
  if (kind === "boom" || kind === "ult") tone("sine", 80, 30, 0.25, 0.5);
}

/* ── special effects ──
   `G` is the arena's effects API (burst, boom, flash, shield, impact, bolt, laser); `later(fn, ms)` is its timer.
   A robot's flourish is picked from its id, so two chassis of one class still differ; a pet's is picked by its ELEMENT and bent by the move it threw. */
export type FxCtx = { foe: string; colour: string; glow: string; power: number; big: boolean; recipe: number; pet?: string; mv?: string };
export const ROBOT_RECIPES = 8;
export function robotFx(G: any, later: (f: () => void, ms: number) => void, c: FxCtx) {
  const { foe, colour: cc, glow: gl, power: pw, big } = c, k = big ? 1.5 : 1;
  switch (c.recipe % ROBOT_RECIPES) {
    case 0: G.boom(foe, 0.8 * pw * k, cc); later(() => G.boom(foe, 1.1 * pw * k, gl), 120); break;                                   // twin boom
    case 1: for (let i = 0; i < 3; i++) later(() => G.burst(foe, (0.7 + i * 0.25) * pw * k, i % 2 ? gl : cc), i * 70); break;       // chain
    case 2: G.shield(foe, gl); G.flash(cc, 0.22 * k, 0.2); later(() => G.burst(foe, pw * k, cc), 80); break;                        // ring + flash
    case 3: for (let i = 0; i < 4; i++) later(() => G.boom(foe, (0.35 + i * 0.12) * pw * k, i % 2 ? cc : gl), i * 80); break;       // cascade
    case 4: G.burst(foe, 0.9 * pw * k, gl); later(() => G.burst(foe, 0.9 * pw * k, cc), 60); later(() => G.shield(foe, cc), 120); break; // fan
    case 5: G.flash(gl, 0.25 * k, 0.16); later(() => G.flash(cc, 0.25 * k, 0.16), 110); G.burst(foe, 1.1 * pw * k, gl); break;     // double pulse
    case 6: G.impact(foe, 1.1 * pw * k, gl, "kick"); G.shield(foe, cc); later(() => G.burst(foe, pw * k, cc), 90); break;          // shock
    default: G.boom(foe, 1.2 * pw * k, gl); G.flash("#ffffff", 0.3 * k, 0.2); later(() => { G.shield(foe, cc); G.burst(foe, pw * k, cc); }, 100); // nova
  }
  if (big) later(() => { G.boom(foe, 1.8, gl); G.shield(foe, cc); }, 220);
}
export function petFx(G: any, later: (f: () => void, ms: number) => void, c: FxCtx) {
  const { foe, colour: cc, power: pw, big } = c, k = big ? 1.5 : 1, mv = c.mv || "bite";
  const T = c.pet || "steel";
  // the element decides the look...
  if (T === "volt") { for (let i = 0; i < 3; i++) later(() => G.burst(foe, (0.6 + i * 0.2) * pw * k, i % 2 ? "#ffffff" : "#ffd23f"), i * 55); G.flash("#fff6b0", 0.2 * k, 0.12); }
  else if (T === "ember") { G.boom(foe, 0.9 * pw * k, "#ff7a3c"); later(() => G.burst(foe, 0.8 * pw * k, "#ffd23f"), 90); later(() => G.burst(foe, 0.6 * pw * k, "#ff4d2a"), 170); }
  else if (T === "frost") { G.shield(foe, "#9fefff"); G.burst(foe, 0.9 * pw * k, "#5ce1ff"); later(() => G.burst(foe, 0.6 * pw * k, "#ffffff"), 100); }
  else if (T === "flora") { for (let i = 0; i < 3; i++) later(() => G.burst(foe, 0.55 * pw * k, i % 2 ? "#9dffb0" : "#3ddc84"), i * 90); later(() => G.shield(foe, "#3ddc84"), 120); }
  else if (T === "aether") { G.boom(foe, 0.7 * pw * k, "#a86bff"); G.flash("#d9c2ff", 0.22 * k, 0.2); later(() => { G.shield(foe, "#d9c2ff"); G.burst(foe, 0.8 * pw * k, "#a86bff"); }, 110); }
  else { G.impact(foe, 1.0 * pw * k, "#c9d6ea", "punch"); later(() => G.impact(foe, 0.8 * pw * k, "#8fa6c8", "kick"), 90); G.flash("#ffffff", 0.18 * k, 0.1); }
  // ...and the weapon bends it
  if (mv === "claw") later(() => G.burst(foe, 0.5 * pw, cc), 60);
  else if (mv === "spit") later(() => G.boom(foe, 0.45 * pw, cc), 140);
  else if (mv === "roar") { G.flash(cc, 0.28 * k, 0.24); later(() => G.boom(foe, 1.0 * pw * k, cc), 100); }
  if (big) later(() => G.boom(foe, 1.7, cc), 200);
}
