/* Adventure Mode sound effects (owner, 2026-10-11). The base sounds are small synth one-shots; the robot's or the pet's own voice
   (fx-voice.ts: class + id for a robot, element + move for a pet) rides on top of the ones that are attacks, so every chassis and every
   animal sounds its own. Own AudioContext, created on first use inside a tap; a minimum gap per sound keeps a held rapid-fire from
   turning into a buzz; nothing here uses the microphone. */
import { playSig, type Voice } from "./fx-voice";
import { getSfxMuted } from "./music-engine";

export type AdvSfx = { play: (kind: string, v?: Voice | null, spec?: any) => void; setOn: (on: boolean) => void; close: () => void };
const GAP: Record<string, number> = { punch: 90, kick: 120, fire: 70, hit: 55, pop: 80, pickup: 60, hurt: 120, jump: 100, dash: 150, skill: 200, spell: 300, slam: 200, pet: 90, win: 500, rocket: 400, boom: 120, cast: 80 };
export function createAdvSfx(): AdvSfx {
  let ac: AudioContext | null = null, bus: GainNode | null = null, nz: AudioBuffer | null = null, on = true; const last: Record<string, number> = {};
  const ensure = () => {
    if (ac) return true;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return false;
      ac = new AC(); bus = ac!.createGain(); bus.gain.value = 0.5; const comp = ac!.createDynamicsCompressor(); bus.connect(comp); comp.connect(ac!.destination);
      nz = ac!.createBuffer(1, ac!.sampleRate, ac!.sampleRate); const d = nz.getChannelData(0); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      return true;
    } catch (e) { ac = null; return false; }
  };
  return {
    setOn(o) { on = o; },
    close() { try { ac && ac.close(); } catch (e) {} ac = null; },
    play(kind, v, spec) {
      if (!on) return; try { if (getSfxMuted()) return; } catch (e) {}
      const now = performance.now(); if (now - (last[kind] || 0) < (GAP[kind] || 60)) return; last[kind] = now;
      if (!ensure() || !ac || !bus || !nz) return; if (ac.state === "suspended") ac.resume().catch(() => {});
      const A = ac, out = bus, N = nz, t = A.currentTime;
      const tone = (type: OscillatorType, f0: number, f1: number, peak: number, dur: number, at = 0) => {
        const o = A.createOscillator(), g = A.createGain(), t0 = t + at; o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
      };
      const hiss = (hz: number, peak: number, dur: number, type: BiquadFilterType = "highpass", hz1?: number, at = 0) => {
        const s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(), t0 = t + at; s.buffer = N; f.type = type; f.frequency.setValueAtTime(hz, t0); if (hz1) f.frequency.exponentialRampToValueAtTime(Math.max(20, hz1), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t0); s.stop(t0 + dur + 0.05);
      };
      let sigKind = "";
      switch (kind) {
        case "punch": hiss(900, 0.3, 0.14, "bandpass"); tone("sine", 180, 55, 0.34, 0.16); sigKind = "hit"; break;
        case "kick": tone("sine", 220, 48, 0.42, 0.22); hiss(600, 0.28, 0.14, "bandpass"); sigKind = "kick"; break;
        case "fire": tone("square", 1500, 320, 0.16, 0.13); hiss(2600, 0.1, 0.08, "bandpass"); sigKind = "shot"; break;
        case "skill": tone("sawtooth", 90, 1400, 0.18, 0.4); hiss(400, 0.4, 0.5, "lowpass", 200, 0.3); tone("sine", 120, 35, 0.4, 0.5, 0.3); sigKind = "ult"; break;
        case "spell": [0, 4, 7, 12].forEach((st, i) => tone("triangle", 523 * Math.pow(2, st / 12), 523 * Math.pow(2, st / 12), 0.16, 0.5, i * 0.07)); hiss(300, 0.5, 0.7, "lowpass", 120, 0.3); tone("sine", 100, 28, 0.5, 0.7, 0.3); sigKind = "ult"; break;
        case "dash": hiss(1200, 0.18, 0.18, "bandpass", 5000); break;
        case "jump": tone("sine", 300, 640, 0.14, 0.12); break;
        case "hit": hiss(1400, 0.16, 0.07, "bandpass"); tone("sine", 140, 70, 0.2, 0.09); break;
        case "pop": tone("sine", 520, 110, 0.24, 0.2); hiss(2200, 0.14, 0.12, "bandpass"); break;
        case "pickup": tone("sine", 880, 880, 0.14, 0.1); tone("sine", 1320, 1320, 0.14, 0.16, 0.07); break;
        case "hurt": tone("sine", 220, 80, 0.3, 0.2); tone("square", 340, 120, 0.1, 0.14); break;
        case "slam": tone("sine", 90, 28, 0.5, 0.5); hiss(300, 0.4, 0.5, "lowpass", 120); break;
        case "pet": tone("triangle", 900, 500, 0.1, 0.1); sigKind = "shot"; break;
        case "rocket": hiss(2600, 0.25, 0.5, "bandpass", 500); tone("sawtooth", 240, 90, 0.1, 0.45); tone("sine", 190, 48, 0.3, 0.16); sigKind = "lob"; break;
        case "boom": hiss(240, 0.5, 0.6, "lowpass"); tone("sine", 150, 28, 0.5, 0.6); break;
        case "cast": {   // one skill: the archetype sets the shape of the sound, the id-derived pitch / wave / brightness make it its own
          const pc = (spec && spec.pitch) || 1, wv: OscillatorType = (spec && spec.wave) || "triangle", br = (spec && spec.bright) || 0, b = 1 + br * 0.25;
          switch (spec && spec.a) {
            case "volley": for (let k = 0; k < 3; k++) tone(wv, 1300 * pc, 500 * pc, 0.12, 0.08, k * 0.07); break;
            case "nova": tone("sine", 200 * pc, 40, 0.42, 0.5); hiss(1800 * b, 0.22, 0.45, "bandpass", 300); break;
            case "dash": hiss(900 * pc, 0.22, 0.25, "bandpass", 4800 * b); tone(wv, 240 * pc, 900 * pc, 0.1, 0.2); break;
            case "shield": tone("sine", 660 * pc, 660 * pc, 0.14, 0.5); tone("sine", 990 * pc, 990 * pc, 0.1, 0.55, 0.04); break;
            case "heal": [0, 4, 7].forEach((st, i) => tone("sine", 523 * pc * Math.pow(2, st / 12), 523 * pc * Math.pow(2, st / 12), 0.14, 0.35, i * 0.08)); break;
            case "haste": tone("sawtooth", 200 * pc, 1100 * pc, 0.12, 0.35); tone("sine", 400 * pc, 1600 * pc, 0.08, 0.3, 0.05); break;
            case "slow": tone("sine", 700 * pc, 120, 0.18, 0.55); hiss(3000, 0.08, 0.5, "lowpass", 400); break;
            case "stun": tone("square", 900 * pc, 200, 0.16, 0.18); hiss(4000 * b, 0.2, 0.12, "bandpass"); tone("sine", 110, 40, 0.3, 0.25, 0.05); break;
            case "chain": for (let k = 0; k < 4; k++) hiss((2200 + k * 500) * b, 0.2, 0.06, "bandpass", undefined, k * 0.06); tone("sawtooth", 160 * pc, 80, 0.1, 0.3); break;
            case "drain": tone(wv, 300 * pc, 120, 0.16, 0.5); tone(wv, 305 * pc, 125, 0.12, 0.5); break;
            case "meteor": tone("sine", 1400 * pc, 260, 0.14, 0.45); tone("sine", 90, 28, 0.5, 0.5, 0.45); hiss(260, 0.4, 0.5, "lowpass", 100); break;
            case "turret": tone("square", 1100 * pc, 1100 * pc, 0.1, 0.05); tone("square", 1400 * pc, 1400 * pc, 0.1, 0.05, 0.1); break;
            case "execute": tone("square", 1200 * pc, 90, 0.2, 0.16); hiss(2600 * b, 0.3, 0.1, "highpass"); tone("sine", 100, 38, 0.4, 0.3, 0.04); break;
            default: tone(wv, 520 * pc, 780 * pc, 0.1, 0.25); break;
          }
          break;
        }
        case "win": [0, 4, 7, 12].forEach((st, i) => tone("triangle", 440 * Math.pow(2, st / 12), 440 * Math.pow(2, st / 12), 0.2, 0.5, i * 0.11)); break;
      }
      if (v && sigKind) playSig(A, out, N, t, v, sigKind, 0.9);
    },
  };
}
