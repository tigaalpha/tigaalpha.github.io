/* The colony's dusk and night in High (plan 40 F5; owner 2026-11-17: "make the High graphics prettier and more real, keep Lite as it is").
   Before this the day cycle only changed the 3D buildings (a little warmer, a little dimmer) while the painted sky and ground stayed in full daylight, so a "night"
   looked like day with orange windows. Now one number, `darkOf(T)`, drives everything the High layer shows: the moonlit 3D lights (adventure-colony-3d.ts), pools of
   coloured light on the ground under every building, soft halos round the lit towers, and a night grade over the painted backdrop (this file's `gradeBackdrop`).
   Only the High layer imports this file (a dynamic chunk fetched when High is on); Lite never loads it and never calls it. */
import { glowTexture, disposeTree } from "./adv3d-hi-util";
export { glowTexture, disposeTree };

const sm = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0 by day .. 1 at the deepest night. Same sun as the 3D layer's (`el` = 0.82 + 0.3 sin(0.035 T)); the old code used n = clamp((0.66 - el) / 0.2, 0, 0.6), this is n / 0.6 eased. */
export function darkOf(T: number): number { const el = 0.82 + 0.3 * Math.sin(T * 0.035); return sm(0, 1, (0.66 - el) / 0.12); }

const NIGHT_TINT: Record<string, [number, number, number]> = { moon: [58, 78, 150], mars: [96, 70, 120], titan: [84, 78, 112], proxima: [104, 56, 104] };
const GLOW_HUE: Record<string, string> = { moon: "90,190,255", mars: "255,150,90", titan: "255,190,110", proxima: "255,100,120" };

/** The night grade over the painted backdrop (sky, skyline, ground), drawn once per frame after drawCity, High only.
    Multiply makes the painted ground dark and blue, a faint lift keeps it from going dead black, then a vignette, a warm/teal glow where the city is and, if the sky
    shows above the terrain, stars and a moon. By day `darkOf` is 0 and this returns before touching the canvas. */
export function gradeBackdrop(x: CanvasRenderingContext2D, W: number, H: number, T: number, kind: string, cam: { x: number; y: number; z: number }): void {
  const d = darkOf(T); if (d < 0.01) return;
  const tn = NIGHT_TINT[kind] || NIGHT_TINT.moon;
  x.save();
  x.globalCompositeOperation = "multiply"; x.fillStyle = "rgb(" + Math.round(255 - d * (255 - tn[0])) + "," + Math.round(255 - d * (255 - tn[1])) + "," + Math.round(255 - d * (255 - tn[2])) + ")"; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(14,24,64," + (0.34 * d).toFixed(3) + ")"; x.fillRect(0, 0, W, H);
  // the sky above the terrain: stars and the moon (the terrain's top edge is at cam.y on screen)
  const sky = Math.min(H, cam.y + 2);
  if (sky > 6) {
    x.save(); x.beginPath(); x.rect(0, 0, W, sky); x.clip(); x.globalCompositeOperation = "source-over";
    const sg = x.createLinearGradient(0, 0, 0, sky); sg.addColorStop(0, "rgba(4,8,26," + (0.78 * d).toFixed(3) + ")"); sg.addColorStop(1, "rgba(30,26,70," + (0.4 * d).toFixed(3) + ")"); x.fillStyle = sg; x.fillRect(0, 0, W, sky);
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 90; i++) { const a = (Math.sin(i * 91.7) * 43758.5453) % 1, b = (Math.sin(i * 12.9 + 4.1) * 24634.6345) % 1, px = Math.abs(a) * W, py = Math.abs(b) * sky, tw = 0.55 + 0.45 * Math.sin(T * (1.1 + (i % 5) * 0.37) + i * 2.1), sz = i % 11 === 0 ? 1.9 : i % 4 === 0 ? 1.3 : 0.9; x.fillStyle = "rgba(" + (i % 3 ? "210,225,255" : "255,236,200") + "," + (d * tw * (i % 11 === 0 ? 0.95 : 0.6)).toFixed(3) + ")"; x.fillRect(px, py, sz, sz); }
    const mx = W * (kind === "proxima" ? 0.18 : 0.82), my = sky * 0.34, mr = Math.max(10, Math.min(H * 0.07, sky * 0.2));
    const mg = x.createRadialGradient(mx, my, mr * 0.7, mx, my, mr * 3.2); mg.addColorStop(0, "rgba(190,210,255," + (0.28 * d).toFixed(3) + ")"); mg.addColorStop(1, "rgba(120,150,255,0)"); x.fillStyle = mg; x.beginPath(); x.arc(mx, my, mr * 3.2, 0, 7); x.fill();
    x.save(); x.globalCompositeOperation = "source-over"; x.globalAlpha = Math.min(1, d * 1.3); x.beginPath(); x.rect(0, 0, W, sky); x.arc(mx - mr * 0.42, my - mr * 0.1, mr * 0.92, 0, 7); x.clip("evenodd");   // a crescent: the moon's disc minus a second disc
    x.fillStyle = "#dfe8ff"; x.beginPath(); x.arc(mx, my, mr, 0, 7); x.fill(); x.restore();
    x.restore();
  }
  // city glow: the lights of the colony colour the dust above it
  x.globalCompositeOperation = "lighter"; x.globalAlpha = 1;
  const gh = GLOW_HUE[kind] || GLOW_HUE.moon, cg = x.createRadialGradient(W * 0.5, H * 0.62, H * 0.05, W * 0.5, H * 0.62, H * 0.95); cg.addColorStop(0, "rgba(" + gh + "," + (0.16 * d).toFixed(3) + ")"); cg.addColorStop(1, "rgba(" + gh + ",0)"); x.fillStyle = cg; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "source-over";
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, "rgba(2,4,18,0)"); vg.addColorStop(1, "rgba(2,4,18," + (0.5 * d).toFixed(3) + ")"); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.restore();
}
