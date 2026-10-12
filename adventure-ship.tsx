/* Adventure: the starship dogfight (owner request, 2026-10-11: "drive a spaceship and shoot the aliens").
   A side-scrolling shooter in its own lazy chunk. The robot pilots; waves of drones, fighters and bombers, then a mothership.
   It pays EXP / crystals / loot through the callbacks the map menu gives it, never coins directly. */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";
import { useFpv, FpvButton, FpvCockpit, FpvHurt } from "./fpv";
import { readArk, arkStats } from "./adventure-ark";
import { isLowEnd, spaceTier } from "./space-stage";
const can3dNow = () => { try { return !isLowEnd() && spaceTier() >= 2; } catch (e) { return false; } };   // the same test as `can3d` in adventure-3d.tsx

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const W = 960, H = 480, BOSS_AT = 55, LAUNCH_T = 38, ORE_GOAL = 16;
const mg = (x: CanvasRenderingContext2D, y0: number, y1: number, base: string) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "rgba(255,255,255,.5)"); g.addColorStop(0.2, base); g.addColorStop(1, "#06080e"); return g; };
const pl = (x: CanvasRenderingContext2D, pts: number[][]) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); };
/** the pilot's starfighter: swept wings, a glowing canopy in the robot's colour, twin engines, wing-tip lights, panel lines */

/* Space backdrop (owner, 2026-10-12: "meteors, planets as a beautiful background, alien ships and asteroids to dodge"). Planets are painted ONCE into small canvases and
   then only drawn with drawImage, so the backdrop costs almost nothing per frame. The far layers are harmless scenery; the rocks and ships you must dodge are in the step. */
function planetSprite(kind: string, r: number, seed: number): HTMLCanvasElement {
  const pad = Math.ceil(r * 0.9), n = Math.ceil(r * 2 + pad * 2), cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d")!; const c = n / 2;
  let sd = seed * 9301 + 49297; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  const ring = (front: boolean) => { g.save(); g.translate(c, c); g.rotate(-0.38); g.strokeStyle = "rgba(235,215,180,.55)"; for (let i = 0; i < 4; i++) { g.lineWidth = 3 + i * 2; g.globalAlpha = 0.55 - i * 0.1; g.beginPath(); g.ellipse(0, 0, r * (1.45 + i * 0.12), r * (0.4 + i * 0.03), 0, front ? 0 : Math.PI, front ? Math.PI : 6.283); g.stroke(); } g.restore(); };
  if (kind === "gas") ring(false);
  g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip();
  const pal: Record<string, string[]> = { gas: ["#e8b878", "#b8743c", "#f3d9a8", "#8a4e2a", "#d99a5a"], ice: ["#dff4ff", "#9fd2f2", "#c8e8fb", "#7fb6e0", "#eef9ff"], lava: ["#2a0e0a", "#4a1608", "#1c0806", "#5a1c0a", "#240a08"], earth: ["#1b4f9c", "#2a6bc4", "#17407e", "#2f78d0", "#1f5aae"], moon: ["#9a9aa6", "#7c7c88", "#b0b0bc", "#6a6a76", "#a4a4b0"], violet: ["#b89aff", "#8a5ad8", "#d6c0ff", "#6a3ab8", "#a07cf0"] };
  const cols = pal[kind] || pal.moon;
  if (kind === "gas" || kind === "violet") { for (let i = 0; i < 14; i++) { const y0 = c - r + (i / 14) * r * 2; g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; g.fillRect(c - r, y0 + Math.sin(i * 1.7 + seed) * 3, r * 2, r * 0.17); } g.globalAlpha = 0.5; g.fillStyle = "#ffdcb0"; g.beginPath(); g.ellipse(c + r * 0.25, c + r * 0.2, r * 0.22, r * 0.1, 0, 0, 7); g.fill(); }
  else { g.fillStyle = cols[0]; g.fillRect(0, 0, n, n); for (let i = 0; i < 26; i++) { g.fillStyle = cols[1 + (i % 4)]; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(c + (rnd() - 0.5) * r * 1.8, c + (rnd() - 0.5) * r * 1.8, r * (0.1 + rnd() * 0.3), r * (0.06 + rnd() * 0.16), rnd() * 3, 0, 7); g.fill(); } }
  g.globalAlpha = 1;
  if (kind === "earth") { g.fillStyle = "#3f8f4a"; for (let i = 0; i < 9; i++) { g.globalAlpha = 0.9; g.beginPath(); g.ellipse(c + (rnd() - 0.5) * r * 1.5, c + (rnd() - 0.5) * r * 1.4, r * (0.12 + rnd() * 0.25), r * (0.08 + rnd() * 0.16), rnd() * 3, 0, 7); g.fill(); } g.fillStyle = "#fff"; for (let i = 0; i < 18; i++) { g.globalAlpha = 0.35 + rnd() * 0.25; g.beginPath(); g.ellipse(c + (rnd() - 0.5) * r * 1.9, c + (rnd() - 0.5) * r * 1.7, r * (0.15 + rnd() * 0.3), r * 0.05, rnd() * 0.6, 0, 7); g.fill(); } }
  if (kind === "lava") { g.strokeStyle = "#ff7a2a"; g.shadowColor = "#ff5a10"; g.shadowBlur = 10; for (let i = 0; i < 10; i++) { g.globalAlpha = 0.9; g.lineWidth = 1.5 + rnd() * 2; g.beginPath(); let px = c + (rnd() - 0.5) * r * 1.6, py = c + (rnd() - 0.5) * r * 1.6; g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (rnd() - 0.5) * r * 0.5; py += (rnd() - 0.5) * r * 0.5; g.lineTo(px, py); } g.stroke(); } g.shadowBlur = 0; }
  if (kind === "moon") { for (let i = 0; i < 10; i++) { const cx = c + (rnd() - 0.5) * r * 1.5, cy = c + (rnd() - 0.5) * r * 1.5, cr = r * (0.06 + rnd() * 0.12); g.globalAlpha = 0.55; g.fillStyle = "#4a4a56"; g.beginPath(); g.arc(cx, cy, cr, 0, 7); g.fill(); g.globalAlpha = 0.35; g.fillStyle = "#d4d4e0"; g.beginPath(); g.arc(cx - cr * 0.2, cy - cr * 0.2, cr * 0.8, 0, 7); g.fill(); } }
  g.globalAlpha = 1; const sh = g.createRadialGradient(c - r * 0.45, c - r * 0.4, r * 0.1, c + r * 0.1, c + r * 0.1, r * 1.25); sh.addColorStop(0, "rgba(255,255,255,.18)"); sh.addColorStop(0.5, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,12,.82)"); g.fillStyle = sh; g.fillRect(0, 0, n, n); g.restore();
  const rim = kind === "lava" ? "255,110,40" : kind === "ice" ? "190,235,255" : kind === "earth" ? "120,190,255" : kind === "violet" ? "190,150,255" : "255,200,140";
  const at = g.createRadialGradient(c, c, r * 0.92, c, c, r * 1.16); at.addColorStop(0, "rgba(" + rim + ",.35)"); at.addColorStop(1, "rgba(" + rim + ",0)"); g.fillStyle = at; g.beginPath(); g.arc(c, c, r * 1.16, 0, 7); g.fill();
  if (kind === "gas") ring(true);
  return cv;
}
const BACKDROPS: Record<string, { k: string; r: number; x: number; y: number; sp: number }[]> = {
  dogfight: [{ k: "gas", r: 92, x: 0.78, y: 0.3, sp: 5 }, { k: "moon", r: 26, x: 0.38, y: 0.74, sp: 9 }],
  harvest: [{ k: "lava", r: 40, x: 0.3, y: 0.28, sp: 6 }, { k: "moon", r: 22, x: 0.62, y: 0.8, sp: 10 }],
  belt: [{ k: "ice", r: 54, x: 0.8, y: 0.72, sp: 5 }, { k: "moon", r: 30, x: 0.22, y: 0.26, sp: 8 }],
  skim: [{ k: "violet", r: 36, x: 0.2, y: 0.22, sp: 4 }, { k: "moon", r: 18, x: 0.55, y: 0.18, sp: 7 }],
  evade: [{ k: "ice", r: 46, x: 0.2, y: 0.7, sp: 3 }, { k: "moon", r: 20, x: 0.5, y: 0.25, sp: 6 }],
  solar: [{ k: "earth", r: 44, x: 0.22, y: 0.3, sp: 4 }, { k: "moon", r: 16, x: 0.62, y: 0.8, sp: 8 }],
  launch: [],
};
/** the player's ship (owner, 2026-10-12: "like the SpaceX Starship, grander"): a stainless-steel cylinder with an ogive nose, a dark heat-shield side, two forward and
 *  two aft flaps, a cluster of Raptor bells and a long exhaust with shock diamonds. Side view, nose to the right. */

/* High-end graphics for the ship maps (owner, 2026-10-12: "make the ship maps prettier on a strong device"). Only when Graphics is High and the device keeps up
   (a frame-time watchdog switches the extras off for good if it does not): layered nebula clouds, glowing stars, a heat trail behind the ship, lit and cratered rocks,
   soft glows on shots, drifting foreground dust, a bloom pass and a colour vignette. Every sprite is painted once. */
function nebSprite(seed: number, rgb: string): HTMLCanvasElement {
  const n = 512, cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d")!; let sd = seed * 7919 + 13; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  for (let i = 0; i < 26; i++) { const cx = n * (0.28 + rnd() * 0.44), cy = n * (0.28 + rnd() * 0.44), r = Math.min(60 + rnd() * 110, cx, n - cx, cy, n - cy), q = g.createRadialGradient(cx, cy, 0, cx, cy, r); q.addColorStop(0, "rgba(" + rgb + "," + (0.07 + rnd() * 0.1) + ")"); q.addColorStop(1, "rgba(" + rgb + ",0)"); g.fillStyle = q; g.fillRect(0, 0, n, n); }
  return cv;
}
function glowSprite(rgb: string): HTMLCanvasElement {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d")!; const q = g.createRadialGradient(32, 32, 0, 32, 32, 32); q.addColorStop(0, "rgba(255,255,255,.95)"); q.addColorStop(0.25, "rgba(" + rgb + ",.6)"); q.addColorStop(1, "rgba(" + rgb + ",0)"); g.fillStyle = q; g.fillRect(0, 0, 64, 64); return cv;
}
/** The Ark (owner, 2026-10-12): a generation ship the size of a town, with a spinning gravity ring, farm domes and animal decks, like a floating Noah's boat. Side view, nose right. */
function drawArk(x: CanvasRenderingContext2D, glow: string, t: number, ar: any) {
  const nd = 2 + Math.min(4, ar.f), rs = 0.8 + 0.1 * ar.g, nw = 8 + ar.h * 3;
  x.globalCompositeOperation = "lighter"; for (const oy of [-12, 0, 12]) { const fl = 70 + Math.random() * 26, g = x.createLinearGradient(-78, oy, -78 - fl, oy); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(0.3, "rgba(" + glow + ",.85)"); g.addColorStop(1, "rgba(40,80,255,0)"); x.fillStyle = g; x.beginPath(); x.moveTo(-78, oy - 6); x.lineTo(-78 - fl, oy); x.lineTo(-78, oy + 6); x.closePath(); x.fill(); } x.globalCompositeOperation = "source-over";
  const hg = x.createLinearGradient(0, -18, 0, 18); hg.addColorStop(0, "#e8edf5"); hg.addColorStop(0.5, "#9aa5b6"); hg.addColorStop(1, "#4a5364");
  x.fillStyle = hg; x.beginPath(); x.moveTo(-78, -16); x.lineTo(40, -16); x.quadraticCurveTo(78, -14, 92, 0); x.quadraticCurveTo(78, 14, 40, 16); x.lineTo(-78, 16); x.closePath(); x.fill(); x.strokeStyle = "rgba(10,16,26,.85)"; x.lineWidth = 1; x.stroke();
  x.strokeStyle = "rgba(20,26,38,.5)"; for (let rx = -64; rx < 40; rx += 16) { x.beginPath(); x.moveTo(rx, -16); x.lineTo(rx, 16); x.stroke(); }
  // farm domes on top: green glass with a glow, and a row of lit windows underneath
  for (let i = 0; i < nd; i++) { const dx = -62 + i * (112 / Math.max(1, nd - 1)); x.fillStyle = "rgba(70,200,120,.55)"; x.beginPath(); x.ellipse(dx, -16, 12, 11, 0, Math.PI, 0); x.fill(); x.strokeStyle = "rgba(190,255,210,.8)"; x.lineWidth = 1; x.stroke(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(120,255,160,.25)"; x.beginPath(); x.ellipse(dx, -18, 14, 12, 0, Math.PI, 0); x.fill(); x.globalCompositeOperation = "source-over"; }
  x.fillStyle = "rgba(255,230,150,.9)"; for (let i = 0; i < nw; i++) x.fillRect(-72 + i * (140 / nw), 6, 4, 2); if (ar.l > 0) { x.fillStyle = "rgba(255,170,90,.85)"; for (let i = 0; i < ar.l + 1; i++) x.fillRect(-72 + i * 9, 10, 5, 3); }
  // the gravity ring: a big turning wheel around the middle of the hull, seen edge-on with moving spokes
  x.save(); x.translate(8, 0); x.strokeStyle = "#c7d0de"; x.lineWidth = 5; x.beginPath(); x.ellipse(0, 0, 14 * rs, 44 * rs, 0, 0, 7); x.stroke(); x.strokeStyle = "#5a6478"; x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, 14 * rs, 44 * rs, 0, 0, 7); x.stroke();
  x.fillStyle = "rgba(255,240,180,.9)"; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + t * 1.4; x.fillRect(Math.cos(a) * 14 * rs - 1.5, Math.sin(a) * 44 * rs - 1.5, 3, 3); } x.restore();
  x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(" + glow + ",.85)"; x.beginPath(); x.ellipse(70, -1, 6, 2.2, 0, 0, 7); x.fill(); const on = Math.floor(t * 3) % 2; x.fillStyle = on ? "rgba(255,70,90,.95)" : "rgba(255,70,90,.25)"; x.beginPath(); x.arc(-30, -29, 2, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  x.fillStyle = "#2a303c"; for (const oy of [-12, 0, 12]) { x.beginPath(); x.moveTo(-76, oy - 5); x.lineTo(-84, oy - 6); x.lineTo(-84, oy + 6); x.lineTo(-76, oy + 5); x.closePath(); x.fill(); }
}
function drawPlayer(x: CanvasRenderingContext2D, glow: string, t: number) {
  const L = -46, N = 30, R = 12;   // tail x, where the nose starts, body half-height
  // exhaust: long, flickering, with bright mach diamonds
  x.globalCompositeOperation = "lighter";
  for (const oy of [-6, 0, 6]) { const fl = 46 + Math.random() * 22 + Math.sin(t * 40 + oy) * 4, g = x.createLinearGradient(L, oy, L - fl, oy); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.25, "rgba(" + glow + ",.9)"); g.addColorStop(0.7, "rgba(80,120,255,.35)"); g.addColorStop(1, "rgba(40,60,255,0)"); x.fillStyle = g; x.beginPath(); x.moveTo(L, oy - 4); x.lineTo(L - fl, oy); x.lineTo(L, oy + 4); x.closePath(); x.fill(); x.fillStyle = "rgba(255,255,255,.7)"; for (let d = 1; d <= 3; d++) { x.beginPath(); x.ellipse(L - d * 12, oy, 3, 1.6, 0, 0, 7); x.fill(); } }
  x.globalCompositeOperation = "source-over";
  // aft flaps (large) and forward flaps (small), behind the hull
  const flap = (pts: number[][], c0: string, c1: string) => { const g = x.createLinearGradient(0, pts[0][1], 0, pts[2][1]); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; pl(x, pts); x.fill(); x.strokeStyle = "rgba(20,26,38,.8)"; x.lineWidth = 1; x.stroke(); };
  flap([[-24, -R + 2], [-44, -R + 2], [-50, -33], [-30, -29]], "#c9d2de", "#6a7486"); flap([[-24, R - 2], [-44, R - 2], [-50, 33], [-30, 29]], "#4a5262", "#242a36");
  flap([[18, -R + 2], [28, -R + 2], [24, -23], [14, -21]], "#d7dee8", "#7a8496"); flap([[18, R - 2], [28, R - 2], [24, 23], [14, 21]], "#4a5262", "#242a36");
  // hull: brushed stainless, bright on top, shadowed beneath
  const hg = x.createLinearGradient(0, -R, 0, R); hg.addColorStop(0, "#f4f7fb"); hg.addColorStop(0.25, "#cfd6e0"); hg.addColorStop(0.6, "#8f99a9"); hg.addColorStop(1, "#505968");
  x.fillStyle = hg; x.beginPath(); x.moveTo(L, -R); x.lineTo(N, -R); x.quadraticCurveTo(N + 24, -R + 1, N + 40, 0); x.quadraticCurveTo(N + 24, R - 1, N, R); x.lineTo(L, R); x.closePath(); x.fill();
  x.strokeStyle = "rgba(14,20,30,.85)"; x.lineWidth = 1; x.stroke();
  // heat shield: the dark tiled belly
  x.save(); x.beginPath(); x.moveTo(L, R); x.lineTo(N, R); x.quadraticCurveTo(N + 24, R - 1, N + 40, 0); x.quadraticCurveTo(N + 22, 4, N, 4.5); x.lineTo(L, 4.5); x.closePath(); x.clip();
  x.fillStyle = "#1a1f2a"; x.fillRect(L, 3, N + 44 - L, 12); x.strokeStyle = "rgba(255,255,255,.14)"; x.lineWidth = 0.7; for (let tx = L; tx < N + 40; tx += 5) { x.beginPath(); x.moveTo(tx, 3); x.lineTo(tx, 14); x.stroke(); } x.restore();
  // panel rings and a long specular streak
  x.strokeStyle = "rgba(20,26,38,.5)"; x.lineWidth = 0.8; for (const rx of [-30, -14, 2, 18]) { x.beginPath(); x.moveTo(rx, -R); x.lineTo(rx, R); x.stroke(); }
  x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(L + 4, -R + 2, N + 18 - L, 1.6);
  // a small cyan glow on the nose and the flap hinge lights
  x.fillStyle = "rgba(" + glow + ",.85)"; x.beginPath(); x.ellipse(N + 30, -1, 5, 2, 0, 0, 7); x.fill();
  const on = Math.floor(t * 3) % 2; x.fillStyle = on ? "rgba(255,70,90,.95)" : "rgba(255,70,90,.25)"; x.beginPath(); x.arc(-48, -31, 1.8, 0, 7); x.fill(); x.fillStyle = on ? "rgba(70,255,140,.25)" : "rgba(70,255,140,.95)"; x.beginPath(); x.arc(-48, 31, 1.8, 0, 7); x.fill();
  x.globalCompositeOperation = "source-over";
  // Raptor bells at the tail
  x.fillStyle = "#2a303c"; for (const oy of [-6, 0, 6]) { pl(x, [[L + 3, oy - 3.5], [L - 4, oy - 4.5], [L - 4, oy + 4.5], [L + 3, oy + 3.5]]); x.fill(); }
}
/** a finishing pass for every alien ship (owner, 2026-10-12: "draw the enemy ships and the mothership as well as the player's"): an exhaust plume behind it, a travelling
    specular glint along the hull, a lit rim on the upper edge and blinking running lights, all additive and cheap (a few strokes and two gradients, no per-frame allocation of sprites) */
function enemyFX(x: CanvasRenderingContext2D, e: any) {
  if (e.hit > 0) return; const r = e.r || 16, ph = e.ph || 0, col = e.type === "drone" ? "255,120,200" : e.type === "fighter" ? "255,150,60" : e.type === "wasp" ? "140,240,90" : e.type === "kamikaze" ? "255,110,60" : "130,160,255";
  x.globalCompositeOperation = "lighter";
  const fl = r * (1.3 + 0.3 * Math.sin(ph * 30)), g = x.createLinearGradient(r * 0.8, 0, r * 0.8 + fl, 0); g.addColorStop(0, "rgba(" + col + ",.75)"); g.addColorStop(1, "rgba(" + col + ",0)"); x.fillStyle = g; x.beginPath(); x.moveTo(r * 0.7, -r * 0.28); x.lineTo(r * 0.8 + fl, 0); x.lineTo(r * 0.7, r * 0.28); x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,.34)"; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, 0, r * 0.95, r * 0.7, 0, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  const gx = -r + ((ph * 0.5) % 1) * r * 2; const gl = x.createLinearGradient(gx - 6, 0, gx + 6, 0); gl.addColorStop(0, "rgba(255,255,255,0)"); gl.addColorStop(0.5, "rgba(255,255,255,.4)"); gl.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gl; x.fillRect(gx - 6, -r * 0.6, 12, r * 1.2);
  const on = Math.floor(ph * 4) % 2; x.fillStyle = on ? "rgba(255,70,90,.95)" : "rgba(255,70,90,.2)"; x.beginPath(); x.arc(-r * 0.2, -r * 0.62, 1.8, 0, 7); x.fill(); x.fillStyle = on ? "rgba(90,255,150,.2)" : "rgba(90,255,150,.95)"; x.beginPath(); x.arc(-r * 0.2, r * 0.62, 1.8, 0, 7); x.fill();
  x.globalCompositeOperation = "source-over";
}
/** the same for the Hive Mothership: a big engine plume, lit window rows, running lights circling the armour, a slow scan glint, glowing cracks in the rage phase and a faint shield shimmer */
function bossFX(x: CanvasRenderingContext2D, B: any) {
  if (B.hit > 0) return; const ph = B.ph || 0, rage = B.hp < B.max / 2;
  x.save(); x.translate(B.x, B.y); x.globalCompositeOperation = "lighter";
  for (const k of [-1, 0, 1]) { const fl = 70 + Math.sin(ph * 14 + k) * 14, g = x.createLinearGradient(96, k * 22, 96 + fl, k * 22); g.addColorStop(0, rage ? "rgba(255,90,110,.8)" : "rgba(180,130,255,.8)"); g.addColorStop(1, "rgba(120,80,255,0)"); x.fillStyle = g; x.beginPath(); x.moveTo(92, k * 22 - 9); x.lineTo(96 + fl, k * 22); x.lineTo(92, k * 22 + 9); x.closePath(); x.fill(); }
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + ph * 0.6, px = Math.cos(a) * 92, py = Math.sin(a) * 70; x.fillStyle = (i + Math.floor(ph * 3)) % 3 === 0 ? "rgba(255,220,120,.95)" : "rgba(160,120,255,.55)"; x.fillRect(px - 1.5, py - 1.5, 3, 3); }
  x.fillStyle = "rgba(255,200,120,.55)"; for (let r2 = 0; r2 < 3; r2++) for (let c = 0; c < 9; c++) if ((c * 7 + r2 * 3 + Math.floor(ph * 2)) % 5 !== 0) x.fillRect(-60 + c * 10, -16 + r2 * 16, 4, 2.2);
  const sx = -90 + ((ph * 0.35) % 1) * 190, sg = x.createLinearGradient(sx - 14, 0, sx + 14, 0); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.28)"); sg.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = sg; x.fillRect(sx - 14, -70, 28, 140);
  if (rage) { x.strokeStyle = "rgba(255,70,100,.8)"; x.lineWidth = 1.6; for (let i = 0; i < 5; i++) { const y0 = -50 + i * 25; x.beginPath(); x.moveTo(-60 + i * 12, y0); x.lineTo(-30 + i * 12 + Math.sin(ph * 5 + i) * 6, y0 + 14); x.lineTo(-48 + i * 12, y0 + 30); x.stroke(); } }
  x.strokeStyle = "rgba(190,160,255," + (0.12 + 0.08 * Math.sin(ph * 4)) + ")"; x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, 118, 98, 0, 0, 7); x.stroke();
  x.globalCompositeOperation = "source-over"; x.restore();
}
/** a Harvester seen from very far away (owner's story: they are avoided, never fought): a ring of dark spokes around a dim star, a slow red scan sweep and a few lights.
    Harmless scenery for the deep-space maps; Act 2's "Under the Harvesters' Eye" has its own, close one. */
function drawHarvesterFar(x: CanvasRenderingContext2D, W: number, H: number, t: number, vt: number) {
  const cx = W * 0.78 - ((vt * 1.5) % (W * 0.2)), cy = H * 0.3, R = Math.min(W, H) * 0.2;
  x.save(); x.globalAlpha = 0.5; x.translate(cx, cy);
  x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(0, 0, 0, 0, 0, R * 0.7); g.addColorStop(0, "rgba(255,200,140,.55)"); g.addColorStop(1, "rgba(255,120,60,0)"); x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 0.7, 0, 7); x.fill();
  x.globalCompositeOperation = "source-over"; x.strokeStyle = "#05030a"; x.lineWidth = R * 0.07; x.beginPath(); x.ellipse(0, 0, R, R * 0.34, -0.35, 0, 7); x.stroke(); x.beginPath(); x.ellipse(0, 0, R * 0.62, R * 0.2, -0.35, 0, 7); x.stroke();
  x.lineWidth = R * 0.03; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + t * 0.03; x.beginPath(); x.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.07); x.lineTo(Math.cos(a) * R, Math.sin(a) * R * 0.34); x.stroke(); }
  x.globalCompositeOperation = "lighter"; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 - 0.35 * 0; x.fillStyle = "rgba(255,70,90," + (0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + i))) + ")"; x.fillRect(Math.cos(a) * R - 1.5, Math.sin(a) * R * 0.34 - 1.5, 3, 3); }
  const sw = (t * 0.25) % 1, sg = x.createLinearGradient(0, 0, W, 0); sg.addColorStop(0, "rgba(255,60,90,.16)"); sg.addColorStop(1, "rgba(255,60,90,0)"); x.fillStyle = sg; x.rotate(-0.35 + sw * 0.7); x.fillRect(0, -2, W, 4);
  x.restore();
}
/** the alien fleet: scarab drones, raiders, dreadnought carriers, wasps and bio-bombs */
function drawEnemy(x: CanvasRenderingContext2D, e: any) {
  const hit = e.hit > 0, base = hit ? "#fff" : null, eyeG = (ex: number, ey: number, r: number, c: string) => { x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(ex, ey, 0, ex, ey, r * 3); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.3, c); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r * 3, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; };
  x.save(); x.translate(e.x, e.y);
  if (e.type === "drone") {   // scarab: an armoured pod with two forward mandibles
    x.fillStyle = base || mg(x, -16, 16, "#b0408a"); x.beginPath(); x.ellipse(0, 0, 18, 13, 0, 0, 7); x.fill(); x.strokeStyle = "#ff7ac8"; x.lineWidth = 1.5; x.stroke(); x.fillStyle = base || "#4a1838"; pl(x, [[-14, -6], [-30, -16], [-20, -2]]); x.fill(); pl(x, [[-14, 6], [-30, 16], [-20, 2]]); x.fill(); x.strokeStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.moveTo(-2, -12); x.lineTo(-2, 12); x.moveTo(6, -10); x.lineTo(6, 10); x.stroke(); eyeG(-8, 0, 3, "rgba(255,230,90,.95)");
  } else if (e.type === "fighter") {   // raider: dark angular hull, orange engine, a glowing nose cannon
    x.fillStyle = base || mg(x, -22, 22, "#5a3a3a"); pl(x, [[-28, 0], [6, -22], [24, -8], [24, 8], [6, 22]]); x.fill(); x.strokeStyle = "#ff8a3a"; x.lineWidth = 1.4; x.stroke(); x.fillStyle = base || "#241014"; pl(x, [[2, -10], [20, -4], [20, 4], [2, 10]]); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,150,50,.9)"; x.fillRect(16, -2, 14, 4); eyeG(26, 0, 2.4, "rgba(255,120,40,.95)"); x.fillStyle = "rgba(255,90,30,.8)"; x.beginPath(); x.arc(22, -22 + 0, 0, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  } else if (e.type === "wasp") {   // wasp: a winged living fighter
    x.globalAlpha = 0.55; x.fillStyle = "rgba(190,230,255,.7)"; for (const sd of [-1, 1]) { x.save(); x.rotate(sd * (0.3 + Math.sin(e.ph * 40) * 0.4)); x.beginPath(); x.ellipse(2, sd * 16, 18, 6, 0, 0, 7); x.fill(); x.restore(); } x.globalAlpha = 1;
    x.fillStyle = base || mg(x, -10, 10, "#7ad04a"); x.beginPath(); x.ellipse(0, 0, 14, 8, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(-18, 0, 10, 6, 0, 0, 7); x.fill(); x.fillStyle = base || "#2a4a14"; pl(x, [[-26, 0], [-40, -2], [-40, 2]]); x.fill(); eyeG(10, -2, 2, "rgba(255,90,60,.95)"); eyeG(10, 2, 2, "rgba(255,90,60,.95)");
  } else if (e.type === "kamikaze") {   // bio-bomb: a spiked sac with a pulsing core
    const p = 0.6 + 0.4 * Math.sin(e.ph * 12); x.fillStyle = base || mg(x, -16, 16, "#c8442a"); x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill(); x.fillStyle = base || "#4a1208"; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + e.ph; pl(x, [[Math.cos(a - 0.2) * 13, Math.sin(a - 0.2) * 13], [Math.cos(a) * 24, Math.sin(a) * 24], [Math.cos(a + 0.2) * 13, Math.sin(a + 0.2) * 13]]); x.fill(); } eyeG(0, 0, 4 + p * 2, "rgba(255,200,60," + (0.5 + p * 0.5) + ")");
  } else {   // dreadnought carrier: a heavy plated hull with turret blisters and a glowing hangar
    x.fillStyle = base || mg(x, -26, 26, "#4a5a8a"); pl(x, [[-36, -8], [-24, -26], [30, -24], [38, 0], [30, 24], [-24, 26], [-36, 8]]); x.fill(); x.strokeStyle = "#8aa0ff"; x.lineWidth = 1.6; x.stroke(); x.strokeStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.moveTo(-20, -24); x.lineTo(-20, 24); x.moveTo(6, -24); x.lineTo(6, 24); x.stroke(); x.fillStyle = base || "#1a2240"; x.beginPath(); x.arc(-8, -18, 6, 0, 7); x.arc(18, 17, 6, 0, 7); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,200,90,.85)"; x.fillRect(-34, -3, 8, 6); eyeG(30, 0, 3, "rgba(255,90,90,.95)"); x.globalCompositeOperation = "source-over";
  }
  enemyFX(x, e);
  if (e.max > 6 && e.hp < e.max) { x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(-20, -e.r - 10, 40, 4); x.fillStyle = "#ff6b81"; x.fillRect(-20, -e.r - 10, 40 * Math.max(0, e.hp / e.max), 4); }
  x.restore();
}
/** the Hive Mothership: a horned crescent of armour and bone, hangar mouths, a triple reactor eye, engines on its back */
function drawBoss(x: CanvasRenderingContext2D, B: any) {
  const hit = B.hit > 0, rage = B.hp < B.max / 2, p = 0.6 + 0.4 * Math.sin(B.ph * 6);
  x.save(); x.translate(B.x, B.y);
  x.globalCompositeOperation = "lighter"; for (let k = -2; k <= 2; k++) { const g = x.createLinearGradient(80, k * 24, 170, k * 24); g.addColorStop(0, "rgba(160,110,255,.9)"); g.addColorStop(1, "rgba(160,110,255,0)"); x.fillStyle = g; x.fillRect(80, k * 24 - 5, 90 + Math.sin(B.ph * 8 + k) * 14, 10); } x.globalCompositeOperation = "source-over";
  x.fillStyle = hit ? "#fff" : mg(x, -86, 86, rage ? "#5a2a4a" : "#3c3068"); pl(x, [[-100, 0], [-70, -34], [-60, -76], [-30, -60], [10, -86], [60, -62], [96, -38], [100, 0], [96, 38], [60, 62], [10, 86], [-30, 60], [-60, 76], [-70, 34]]); x.fill();
  x.strokeStyle = rage ? "#ff5a7a" : "#a98aff"; x.lineWidth = 3; x.stroke();
  x.fillStyle = hit ? "#fff" : "#161030"; for (const sy of [-1, 1]) { pl(x, [[-60, sy * 76], [-96, sy * 104], [-40, sy * 66]]); x.fill(); pl(x, [[10, sy * 86], [-10, sy * 118], [34, sy * 78]]); x.fill(); }
  x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 2; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(-70, i * 18); x.lineTo(90, i * 14); x.stroke(); }
  x.fillStyle = "#07040f"; for (const hy of [-44, 44]) { x.beginPath(); x.ellipse(-10, hy, 26, 9, 0, 0, 7); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,170,70,.55)"; x.fillRect(-30, hy - 2, 40, 4); x.globalCompositeOperation = "source-over"; x.fillStyle = "#07040f"; }   // hangar mouths
  x.globalCompositeOperation = "lighter"; for (const [ex, ey, r] of [[-44, 0, 16], [-44, -26, 8], [-44, 26, 8]] as number[][]) { const g = x.createRadialGradient(ex, ey, 0, ex, ey, r * 3); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.3, rage ? "rgba(255,50,90," + (0.5 + p * 0.5) + ")" : "rgba(255,90,140," + (0.5 + p * 0.5) + ")"); g.addColorStop(1, "rgba(255,40,100,0)"); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r * 3, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over";
  x.restore();
}
const LOOTK = ["scrap", "ore", "gold", "core"] as const;

const toRgb = (g: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(g || ""); if (m) { const n = parseInt(m[1], 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; } return /^\d+,\s*\d+,\s*\d+$/.test(g || "") ? g : "127,232,255"; };
export default function AdventureShip({ P, lang, ups, glow: glow0, onWin, onExit, ctl }: any) {
  try { if (localStorage.getItem("tg_adv_crash") === "1") throw new Error("test crash"); } catch (e) { if (e && (e as any).message === "test crash") throw e; }   // a test-only switch for the map guard

  const [fpv, flipFpv] = useFpv(), fpvRef = useRef(fpv), hurtRef = useRef<HTMLDivElement>(null); fpvRef.current = fpv;   // first-person view: cockpit, no ship body, a reticle
  const [gear, setGear] = useState(false), pausedRef = useRef(false), fitRef = useRef<any>(null), musRef = useRef<any>(null);
  const [gfx, setGfx] = useState<string>(() => { try { const v = localStorage.getItem("tg_adv_gfx"); if (v === "3d" && can3dNow()) return "3d"; return v === "high" || v === "3d" ? "high" : "standard"; } catch (e) { return "standard"; } });
  const is3d = gfx === "3d", high = gfx !== "standard", highRef = useRef(high); highRef.current = high; const is3dRef = useRef(is3d); is3dRef.current = is3d;
  const a3Ref = useRef<any>(null), host3Ref = useRef<HTMLDivElement>(null);
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const flipGfx = () => { setGfxLevel(highRef.current ? "standard" : "high"); };
  const setGfxLevel = (v: string) => { highRef.current = v !== "standard"; is3dRef.current = v === "3d"; setGfx(v); try { localStorage.setItem("tg_adv_gfx", v); } catch (e) {} if (fitRef.current) fitRef.current(); };
  const flipMusic = () => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); return n; });
  const glow = toRgb(glow0);
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const LS_ON = 2.6, LS_CD = 7, EVADE_T = 50, HOLE_T = 34, SKY: string = P.sky || "";
  const MODE: string = P.mission === "launch" ? "launch" : P.mission === "belt" ? "belt" : P.mission === "skim" ? "skim" : P.mission === "harvest" ? "harvest" : P.mission === "evade" ? "evade" : P.mission === "solar" ? "solar" : P.mission === "warp" ? "warp" : P.mission === "blackhole" ? "blackhole" : "dogfight";   // dogfight = Void Gate, launch = leave Earth through the debris, belt = mine the asteroid field
  const cv = useRef<HTMLCanvasElement>(null); const keys = useRef<any>({});
  const [ui, setUi] = useState<any>({ hp: 100, boss: 0, bossOn: false, t: 0, kills: 0, over: false, win: false, ms: 0 });
  const retry = useRef<() => void>(() => {});
  const [a3Msg, setA3Msg] = useState<string | null>(null);
  useEffect(() => {   // 3D quality: a Three.js space behind the 2D canvas (lazy chunk); any failure puts the map back on 2D High
    if (!is3d) { if (a3Ref.current) { a3Ref.current.dispose(); a3Ref.current = null; } return undefined; }
    let dead = false;
    import("./adventure-3d-ship").then(m => {
      if (dead) return; const host = host3Ref.current; const sc = host ? m.createShip3D(host, { mode: String(P.mission || ""), sky: SKY, glow: toRgb(glow0), ark: SKY === "ark" ? readArk() : null }) : null;
      if (!sc) { setA3Msg("3D is not available on this device: back to 2D High"); setGfxLevel("high"); return; } a3Ref.current = sc;
    }).catch(() => { if (!dead) { setA3Msg("3D failed to load: back to 2D High"); setGfxLevel("high"); } });
    return () => { dead = true; if (a3Ref.current) { a3Ref.current.dispose(); a3Ref.current = null; } };
  }, [is3d]);
  useEffect(() => {
    const c = cv.current; if (!c) return undefined; const x = c.getContext("2d"); if (!x) return undefined; let raf = 0, last = performance.now(), dead = false;
    const sfx = createAdvSfx(); const mus = createAdvMusic("nexa"); musRef.current = mus; if (mus && mus.setOn) mus.setOn(musicOn); if (mus) { mus.start(); mus.setIntensity && mus.setIntensity(2); }
    const fit = () => { const dpr = highRef.current ? Math.min(2, window.devicePixelRatio || 1) : 1, r = c.getBoundingClientRect(); c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }; fitRef.current = fit; fit(); window.addEventListener("resize", fit);
    const ARKLV = SKY === "ark" ? readArk() : { g: 0, f: 0, l: 0, h: 0, s: 0 }, ARKST = arkStats(ARKLV);   // the Ark you outfitted in the Ark Bay
    const HP = Math.round(100 * (1 + 0.05 * (ups.hp || 0)) * (SKY === "ark" ? ARKST.hull : 1)), DMG = 1 + 0.05 * (ups.atk || 0), SALVO = 1 + ((ups.rkt || 0) >= 2 ? 1 : 0) + ((ups.rkt || 0) >= 4 ? 1 : 0);
    const hard = P.hard || 1;
    let S: any;
    let a3Last = 0, a3Sum = 0, a3N = 0, a3Bad = 0;
    let hiOk = true, ema = 0.016, slowN = 0, nebs: HTMLCanvasElement[] | null = null, dot: HTMLCanvasElement | null = null, bloomA: HTMLCanvasElement | null = null, bloomB: HTMLCanvasElement | null = null; const trail: any[] = [];
    const HI = () => highRef.current && hiOk;
    const bd = (SKY || MODE === "warp" || MODE === "blackhole" ? [] : (BACKDROPS[MODE] || [])).map((d, i) => ({ ...d, spr: planetSprite(d.k, d.r, i + 3 + MODE.length) }));
    const far = Array.from({ length: 16 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 3 + Math.random() * 9, sp: 22 + Math.random() * 40, rot: Math.random() * 6, seed: i * 1.7 })), streaks: any[] = []; let streakT = 2;
    const bigGas = SKY === "gas" ? planetSprite("gas", 250, 9) : SKY === "jupiter" ? planetSprite("gas", 300, 5) : SKY === "saturn" ? planetSprite("gas", 170, 4) : null;
    const reset = () => { S = { t: 0, ship: { x: 140, y: H / 2, hp: HP, inv: 0, fireCd: 0, mCd: 0 }, bl: [], eb: [], en: [], ms: [], pk: [], pt: [], stars: S ? S.stars : Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 })), spawn: 1, kills: 0, cry: 0, loot: { scrap: 0, ore: 0, gold: 0, core: 0 }, boss: null as any, rk: [] as any[], mined: 0, fuel: 0, st: 0, sp: 0, stn: null as any, flares: [] as any[], flareT: 4, relay: null as any, relayT: 10, bolts: [] as any[], boltT: 3, ans: 0, bossSpawned: false, over: false, win: false, endT: 0, shake: 0 }; setUi({ hp: HP, boss: 0, bossOn: false, t: 0, kills: 0, over: false, win: false, ms: 0 }); };
    reset(); retry.current = () => { reset(); };
    if (ctl && ctl.current) ctl.current.answer = (ok: boolean) => { ctl.current.paused = false; last = performance.now(); S.ans++; if (ok) { S.ship.hp = Math.min(HP, S.ship.hp + 30); S.ship.inv = Math.max(S.ship.inv, 3); S.cry += 3; sfx.play("win"); burst(S.ship.x, S.ship.y, 24, "120,220,255", 260); } };
    const burst = (px: number, py: number, n: number, col: string, sp = 220) => { if (HI()) n = Math.round(n * 1.8); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = Math.random() * sp; S.pt.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, col }); } };
    const dropLoot = (px: number, py: number, rich: number) => { if (Math.random() < 0.7) S.pk.push({ x: px, y: py, k: "cry" }); if (Math.random() < 0.45 * rich) S.pk.push({ x: px + 8, y: py + 8, k: LOOTK[Math.min(3, Math.floor(Math.random() * Math.random() * 4 * rich))] }); };
    const addRock = (xx: number, yy: number, size: number) => { const r = [14, 24, 38][size]; S.rk.push({ x: xx, y: yy, size, r, hp: [2, 5, 10][size], vx: 60 + Math.random() * 120 + (MODE === "launch" ? S.t * 3 : 0), vy: (Math.random() - 0.5) * 40, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, seed: Math.random() * 100 }); };
    const hurtRock = (k: any, d: number) => { k.hp -= d; k.hit = 0.08; if (k.hp <= 0 && !k.dead) { k.dead = true; sfx.play("boom"); burst(k.x, k.y, 8 + k.size * 6, "200,180,150", 200); S.shake = Math.max(S.shake, k.size); if (k.size > 0) { addRock(k.x - 8, k.y - 10, k.size - 1); addRock(k.x + 8, k.y + 10, k.size - 1); S.rk[S.rk.length - 1].vx = k.vx * 1.1; } else if (MODE === "belt") { for (let q = 0; q < 1 + Math.floor(Math.random() * 3); q++) S.pk.push({ x: k.x + q * 6, y: k.y + q * 5, k: "mined" }); if (Math.random() < 0.3) S.pk.push({ x: k.x, y: k.y, k: "cry" }); if (Math.random() < 0.25) S.pk.push({ x: k.x, y: k.y + 8, k: LOOTK[Math.floor(Math.random() * 2)] }); } else if (Math.random() < 0.25) S.pk.push({ x: k.x, y: k.y, k: "cry" }); } };
    const addEnemy = (type: string, y: number) => { const tp: any = { drone: { hp: 3, r: 16 }, fighter: { hp: 6, r: 20 }, bomber: { hp: 16, r: 30 }, wasp: { hp: 2, r: 14 }, kamikaze: { hp: 4, r: 16 } }[type]; S.en.push({ type, x: W + 40, y, hp: tp.hp, max: tp.hp, r: tp.r, ph: Math.random() * 6, cd: 1 + Math.random() }); };
    const hurtEn = (e: any, d: number) => { e.hp -= d; e.hit = 0.08; if (e.hp <= 0 && !e.dead) { e.dead = true; S.kills++; sfx.play("boom"); burst(e.x, e.y, 14, "255,170,70"); dropLoot(e.x, e.y, e.type === "bomber" ? 2 : 1); S.shake = Math.max(S.shake, 3); } };
    const step = (dt: number) => {
      const k = keys.current, s = S.ship; S.t += dt;
      // light speed (owner, 2026-10-12): a button in the right pad. For LS_ON seconds the world rushes past and the ship is faster, then it recharges.
      S.ls = S.ls || 0; S.lsT = S.lsT || 0; S.lsCd = S.lsCd || 0; S.vt = S.vt || 0;
      if (k.lsReq) { k.lsReq = false; if (S.lsT <= 0 && S.lsCd <= 0 && !S.over && !S.win) { S.lsT = LS_ON; sfx.play("rocket"); S.shake = Math.max(S.shake, 5); } }
      if (S.lsT > 0) { S.lsT -= dt; if (S.lsT <= 0) S.lsCd = LS_CD; } else if (S.lsCd > 0) S.lsCd -= dt;
      S.ls += ((S.lsT > 0 ? 1 : 0) - S.ls) * Math.min(1, dt * 5); S.vt += dt * (1 + S.ls * 7);
      if (!S.over && !S.win) {
        const sp = 330 * (1 + 0.06 * (ups.shp || 0)) * (1 + 0.35 * (S.ls || 0)) * (MODE === "solar" && (S.energy === undefined ? 55 : S.energy) <= 0 ? 0.5 : 1); s.x = Math.max(40, Math.min(MODE === "harvest" || MODE === "blackhole" || MODE === "warp" ? W - 90 : W * 0.62, s.x + Math.max(-1, Math.min(1, (k.r ? 1 : 0) - (k.l ? 1 : 0) + (k.ax || 0))) * sp * dt)); s.y = Math.max(90, Math.min(H - 40, s.y + Math.max(-1, Math.min(1, (k.d ? 1 : 0) - (k.u ? 1 : 0) + (k.ay || 0))) * sp * dt));
        s.fireCd -= dt; s.mCd -= dt; s.inv -= dt;
        if (k.fire && s.fireCd <= 0 && MODE !== "evade") { s.fireCd = 0.13; S.bl.push({ x: s.x + 34, y: s.y - 7, vx: 820, vy: 0 }, { x: s.x + 34, y: s.y + 7, vx: 820, vy: 0 }); sfx.play("bolt"); }
        if (k.miss && s.mCd <= 0) { s.mCd = 3 * (1 - 0.06 * (ups.rkt || 0)); for (let q = 0; q < SALVO; q++) S.ms.push({ x: s.x + 20, y: s.y + (q - (SALVO - 1) / 2) * 16, vx: 380, vy: (q - (SALVO - 1) / 2) * 120, life: 2.4 }); sfx.play("rocket"); }
        // waves, then the mothership
        if (MODE === "dogfight" || MODE === "harvest" || MODE === "skim" || MODE === "solar" || MODE === "blackhole") { S.rockT = (S.rockT == null ? 2.5 : S.rockT) - dt; if (S.rockT <= 0) { S.rockT = 2.6 + Math.random() * 3; addRock(W + 40, 60 + Math.random() * (H - 120), Math.random() < 0.35 ? 1 : 0); } }   // drifting asteroids to dodge or shoot (owner, 2026-10-12)
        if (MODE === "launch" || MODE === "belt") { S.spawn -= dt; if (S.spawn <= 0) { S.spawn = MODE === "launch" ? Math.max(0.35, 0.9 - S.t * 0.012) : 0.85; const y = 50 + Math.random() * (H - 100); addRock(W + 40, y, Math.random() < 0.35 ? 2 : Math.random() < 0.6 ? 1 : 0); if (MODE === "belt" && S.t > 14 && Math.random() < 0.18) addEnemy(Math.random() < 0.6 ? "fighter" : "wasp", H - y); } }
        else if ((MODE === "dogfight" || MODE === "harvest" || MODE === "solar") && !S.bossSpawned) { S.spawn -= dt; if (S.spawn <= 0) { S.spawn = MODE === "harvest" ? Math.max(0.7, 1.7 - S.t * 0.012) : Math.max(0.55, 1.5 - S.t * 0.014); const r = Math.random(), y = 50 + Math.random() * (H - 100); addEnemy(r < 0.3 ? "drone" : r < 0.5 ? "wasp" : r < 0.7 ? "fighter" : r < 0.85 ? "kamikaze" : "bomber", y); if (r < 0.3) addEnemy("wasp", H - y); } }
        if (MODE === "dogfight" && !S.bossSpawned && S.t >= BOSS_AT) { S.bossSpawned = true; S.en.forEach((e: any) => { e.dead = true; burst(e.x, e.y, 6, "255,120,80"); }); S.boss = { x: W + 160, y: H / 2, hp: 240, max: 240, cd: 1.4, sp: 3, ph: 0 }; sfx.play("boss"); if (mus && mus.setBoss) mus.setBoss(true); }
      }
      for (const b of S.bl) { b.x += b.vx * dt; b.y += b.vy * dt; } S.bl = S.bl.filter((b: any) => b.x < W + 20);
      for (const m of S.ms) { let tg: any = null, bd = 1e9; for (const e of S.en) if (!e.dead) { const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; tg = e; } } if (S.boss && !S.boss.dead && (!tg || Math.abs(S.boss.x - m.x) < bd)) tg = S.boss;
        if (tg) { const a = Math.atan2(tg.y - m.y, tg.x - m.x), v = Math.hypot(m.vx, m.vy), na = Math.atan2(m.vy, m.vx), d2 = Math.atan2(Math.sin(a - na), Math.cos(a - na)); const a2 = na + Math.max(-4 * dt, Math.min(4 * dt, d2)); const v2 = Math.min(560, v + 400 * dt); m.vx = Math.cos(a2) * v2; m.vy = Math.sin(a2) * v2; }
        m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt; S.pt.push({ x: m.x - 8, y: m.y, vx: -80, vy: (Math.random() - 0.5) * 30, life: 0.4, max: 0.4, col: "255,200,120" });
        let boom = m.life <= 0; for (const e of S.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 8) boom = true; if (S.boss && !S.boss.dead && Math.abs(S.boss.x - m.x) < 90 && Math.abs(S.boss.y - m.y) < 80) boom = true;
        if (boom) { m.dead = true; sfx.play("boom"); S.shake = Math.max(S.shake, 6); burst(m.x, m.y, 26, "255,190,90", 320); for (const e of S.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 110) hurtEn(e, 12 * DMG); for (const k of S.rk) if (!k.dead && Math.hypot(k.x - m.x, k.y - m.y) < 120) hurtRock(k, 8 * DMG); if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - m.x, S.boss.y - m.y) < 150) { S.boss.hp -= 14 * DMG; } } }
      S.ms = S.ms.filter((m: any) => !m.dead);
      for (const e of S.en) { if (e.dead) continue; e.ph += dt; e.hit = Math.max(0, (e.hit || 0) - dt);
        if (e.type === "drone") { e.x -= 170 * dt; e.y += Math.sin(e.ph * 3) * 120 * dt; }
        else if (e.type === "wasp") { e.x -= 230 * dt; e.y += Math.sin(e.ph * 6) * 190 * dt; }
        else if (e.type === "kamikaze") { const a = Math.atan2(S.ship.y - e.y, S.ship.x - e.x); e.x += Math.cos(a) * 210 * dt - 40 * dt; e.y += Math.sin(a) * 210 * dt; }
        else if (e.type === "fighter") { if (e.x > W * 0.72) e.x -= 140 * dt; e.y += Math.sin(e.ph * 1.6) * 60 * dt; e.cd -= dt; if (e.cd <= 0) { e.cd = 1.7; const a = Math.atan2(S.ship.y - e.y, S.ship.x - e.x); S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300 }); } }
        else { e.x -= 70 * dt; e.cd -= dt; if (e.cd <= 0) { e.cd = 2.2; for (const dy of [-1, 0, 1]) S.eb.push({ x: e.x, y: e.y, vx: -260, vy: dy * 90 }); } }
        for (const b of S.bl) if (!b.dead && Math.abs(b.x - e.x) < e.r + 6 && Math.abs(b.y - e.y) < e.r + 4) { b.dead = true; hurtEn(e, DMG); }
        if (!e.dead && !S.over && S.ship.inv <= 0 && Math.hypot(e.x - S.ship.x, e.y - S.ship.y) < e.r + 14) { hurtShip(10 * Math.sqrt(hard)); e.hp = 0; hurtEn(e, 0); } }
      S.en = S.en.filter((e: any) => !e.dead && e.x > -60); S.bl = S.bl.filter((b: any) => !b.dead);
      const B = S.boss; if (B && !B.dead) { if (B.x > W - 170) B.x -= 120 * dt; B.ph += dt; B.y = H / 2 + Math.sin(B.ph * 0.9) * 150; B.cd -= dt; const rage = B.hp < B.max / 2;
        if (B.cd <= 0) { B.cd = rage ? 0.9 : 1.4; const n = rage ? 7 : 5, base = Math.atan2(S.ship.y - B.y, S.ship.x - B.x); for (let q = 0; q < n; q++) { const a = base + (q - (n - 1) / 2) * 0.22; S.eb.push({ x: B.x - 60, y: B.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, big: true }); } B.sp--; if (B.sp <= 0) { B.sp = 3; addEnemy("drone", B.y - 60); addEnemy("drone", B.y + 60); } }
        for (const b of S.bl) if (!b.dead && Math.abs(b.x - B.x) < 80 && Math.abs(b.y - B.y) < 70) { b.dead = true; B.hp -= DMG; B.hit = 0.06; burst(b.x, b.y, 2, "255,220,150", 120); }
        if (B.hp <= 0) { B.dead = true; S.win = true; S.endT = 0; sfx.play("win"); S.shake = 14; burst(B.x, B.y, 90, "255,200,120", 520); for (let q = 0; q < 14; q++) dropLoot(B.x + (Math.random() - 0.5) * 120, B.y + (Math.random() - 0.5) * 120, 3); } }
      function hurtShip(d: number) { if (S.over || S.win || S.ship.inv > 0) return; S.ship.hp -= d; S.ship.inv = 0.9; S.shake = 6; sfx.play("hurt"); burst(S.ship.x, S.ship.y, 10, "255,90,110"); if (S.ship.hp <= 0) { S.ship.hp = 0; S.over = true; burst(S.ship.x, S.ship.y, 50, "255,150,90", 400); } }
      for (const b of S.eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (!S.over && Math.hypot(b.x - S.ship.x, b.y - S.ship.y) < (b.big ? 16 : 12)) { b.dead = true; hurtShip((b.big ? 9 : 7) * Math.sqrt(hard)); } }
      S.eb = S.eb.filter((b: any) => !b.dead && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
      // the music relay: fly into it to answer ONE question (the page pauses the ship); a right answer repairs and shields the ship
      S.relayT -= dt; if (S.relayT <= 0 && !S.relay && !S.win && !S.over && !(MODE === "dogfight" && S.bossSpawned)) { S.relay = { x: W + 30, y: 90 + Math.random() * (H - 180), ph: 0 }; S.relayT = 26; }
      if (S.relay) { const R = S.relay; R.x -= 80 * dt; R.ph += dt; if (R.x < -40) S.relay = null; else if (!S.over && Math.hypot(R.x - S.ship.x, R.y - S.ship.y) < 36) { S.relay = null; if (ctl && ctl.current && ctl.current.ask) { ctl.current.paused = true; ctl.current.ask(); } } }
      if (MODE === "harvest" && !S.win && !S.over) {   // a foreign star: hold the ship inside each collector ring for 7 s while raiders and solar flares attack
        if (!S.stn) S.stn = { x: W - 170, y: 120 + Math.random() * (H - 240), p: 0 };
        const q = S.stn, inside = Math.hypot(S.ship.x - q.x, S.ship.y - q.y) < 78; q.p = Math.max(0, Math.min(7, q.p + (inside ? dt : -0.4 * dt)));
        if (inside && Math.random() < 0.5) S.pt.push({ x: S.ship.x, y: S.ship.y, vx: (q.x - S.ship.x) * 2, vy: (q.y - S.ship.y) * 2, life: 0.4, max: 0.4, col: "255,220,120" });
        if (q.p >= 7) { S.st++; sfx.play("win"); S.shake = 6; burst(q.x, q.y, 40, "255,220,120", 340); if (S.st >= 3) { S.win = true; S.endT = 0; } else S.stn = { x: W - 170 - (S.st % 2) * 120, y: 110 + Math.random() * (H - 220), p: 0 }; }
        S.flareT -= dt; if (S.flareT <= 0) { S.flareT = 5; S.flares.push({ y: 60 + Math.random() * (H - 120), t: 1.1, hit: false }); }
        for (const f of S.flares) { f.t -= dt; if (f.t <= 0 && !f.hit) { f.hit = true; S.shake = Math.max(S.shake, 5); sfx.play("boom"); if (Math.abs(S.ship.y - f.y) < 34) hurtShip(12 * Math.sqrt(hard)); } } S.flares = S.flares.filter((f: any) => f.t > -0.3);
      }
      if (MODE === "evade" && !S.win && !S.over) {   // Act 2 (owner, 2026-10-12): a Harvester scan sweeps the sector; stay out of its beams for EVADE_T seconds, no shooting
        S.scanT = (S.scanT === undefined ? 2 : S.scanT) - dt; S.scans = S.scans || [];
        if (S.scanT <= 0) { S.scanT = Math.max(0.9, 2.3 - S.t * 0.022); const horiz = Math.random() < 0.5; S.scans.push({ h: horiz, p: horiz ? 70 + Math.random() * (H - 140) : 160 + Math.random() * (W * 0.62), t: 1.25, hit: false }); if (S.t > 20 && Math.random() < 0.5) { const h2 = !horiz; S.scans.push({ h: h2, p: h2 ? 70 + Math.random() * (H - 140) : 160 + Math.random() * (W * 0.62), t: 1.25, hit: false }); } }
        for (const f of S.scans) { f.t -= dt; if (f.t <= 0 && !f.hit) { f.hit = true; S.shake = Math.max(S.shake, 4); sfx.play("boom"); if ((f.h ? Math.abs(S.ship.y - f.p) : Math.abs(S.ship.x - f.p)) < 38) hurtShip(15 * Math.sqrt(hard)); } } S.scans = S.scans.filter((f: any) => f.t > -0.3);
        if (S.t >= EVADE_T) { S.win = true; S.endT = 0; sfx.play("win"); S.shake = 8; }
      }
      if (MODE === "skim" && !S.win && !S.over) {   // the gas giant: stay inside the glowing energy layer to fill the tank; dodge the lightning
        const by = H / 2 + Math.sin(S.t * 0.55) * 120; S.band = by; if (Math.abs(S.ship.y - by) < 70) { S.fuel = Math.min(100, S.fuel + 11 * dt); if (Math.random() < 0.5) S.pt.push({ x: S.ship.x - 20, y: S.ship.y, vx: -120, vy: (Math.random() - 0.5) * 60, life: 0.4, max: 0.4, col: "255,200,120" }); }
        if (S.fuel >= 100) { S.win = true; S.endT = 0; sfx.play("win"); S.shake = 8; }
        S.boltT -= dt; if (S.boltT <= 0) { S.boltT = Math.max(1.4, 3.2 - S.t * 0.03); S.bolts.push({ x: Math.max(120, Math.min(W - 60, S.ship.x + (Math.random() - 0.3) * 320)), t: 1.1, hit: false }); }
        for (const b of S.bolts) { b.t -= dt; if (b.t <= 0 && !b.hit) { b.hit = true; S.shake = Math.max(S.shake, 5); sfx.play("boom"); if (Math.abs(S.ship.x - b.x) < 36) hurtShip(14 * Math.sqrt(hard)); } } S.bolts = S.bolts.filter((b: any) => b.t > -0.25);
        S.skimP = (S.skimP || 0) - dt; if (S.skimP <= 0) { S.skimP = 2.2; S.pk.push({ x: W + 20, y: by + (Math.random() - 0.5) * 100, k: "cry" }); }
      }
      if (MODE === "solar" && !S.win && !S.over) {   // deep space: the battery drains; collect the drifting solar panels to charge it (owner, 2026-10-12)
        if (S.energy === undefined) { S.energy = 55; S.panels = 0; S.solT = 1.2; S.dryT = 0; }
        S.energy = Math.max(0, S.energy - 1.7 * dt);
        S.solT -= dt; if (S.solT <= 0) { S.solT = 2.3; S.pk.push({ x: W + 20, y: 110 + Math.random() * (H - 200), k: "solar" }); }
        if (S.energy <= 0) { S.dryT += dt; if (S.dryT >= 1) { S.dryT = 0; hurtShip(5 * Math.sqrt(hard)); } }
        if (S.panels >= 8) { S.win = true; S.endT = 0; sfx.play("win"); S.shake = 8; }
      }
      if (MODE === "warp" && !S.win && !S.over) {   // faster than light: fly through three warp gates, then dive into the portal to another galaxy
        S.gp = S.gp || 0; S.gates = S.gates || []; S.gateT = S.gateT === undefined ? 3 : S.gateT - dt; S.boost = Math.max(0, (S.boost || 0) - dt);
        if (S.gp < 3 && S.gates.length === 0 && S.gateT <= 0) S.gates.push({ x: W + 80, y: 130 + Math.random() * (H - 260), r: 78, ph: 0, done: false });
        for (const g of S.gates) { g.x -= 230 * dt; g.ph += dt; if (!g.done && Math.abs(g.x - S.ship.x) < 18 && Math.abs(g.y - S.ship.y) < g.r - 8) { g.done = true; S.gp++; S.boost = 1.2; S.shake = 7; sfx.play("win"); burst(g.x, g.y, 30, "150,210,255", 360); S.gateT = 2.2; } }
        for (const g of S.gates) if (g.x < -120) { if (!g.done) S.gateT = 1.4; g.dead = true; } S.gates = S.gates.filter((g: any) => !g.dead);
        if (S.gp >= 3 && !S.portal) { S.portal = { x: W - 170, y: H / 2, r: 0 }; sfx.play("boss"); }
        if (S.portal) { const Pq = S.portal; Pq.r = Math.min(90, Pq.r + 60 * dt); if (Pq.r >= 80 && Math.hypot(Pq.x - S.ship.x, Pq.y - S.ship.y) < Pq.r * 0.55) { S.win = true; S.endT = 0; sfx.play("win"); S.shake = 12; } }
        S.warpR = (S.warpR === undefined ? 1 : S.warpR) - dt; if (S.warpR <= 0) { S.warpR = 0.6 + Math.random() * 0.5; addRock(W + 40, 70 + Math.random() * (H - 130), Math.random() < 0.3 ? 1 : 0); S.rk[S.rk.length - 1].vx = 380 + Math.random() * 120; }
      }
      if (MODE === "blackhole" && !S.win && !S.over) {   // a black hole drags the ship in; survive until the door lights up, then dive into the centre
        const hx = W * 0.78, hy = H / 2, s2 = S.ship, dx = hx - s2.x, dy = hy - s2.y, d = Math.max(30, Math.hypot(dx, dy));
        S.hole = { x: hx, y: hy }; const pull = (70 + S.t * 3.2) * Math.min(2.2, 300 / d); s2.x = Math.max(40, Math.min(W - 60, s2.x + dx / d * pull * dt)); s2.y = Math.max(90, Math.min(H - 40, s2.y + dy / d * pull * dt));
        if (!S.opened && S.t >= HOLE_T) { S.opened = true; sfx.play("boss"); S.shake = 8; }
        if (d < 48) { if (S.opened) { S.win = true; S.endT = 0; sfx.play("win"); S.shake = 14; } else { hurtShip(18 * Math.sqrt(hard)); s2.x = hx - 220; s2.y = hy + (Math.random() - 0.5) * 160; S.shake = 9; sfx.play("boom"); } }
        S.cryT = (S.cryT === undefined ? 2 : S.cryT) - dt; if (S.cryT <= 0) { S.cryT = 2.4; S.pk.push({ x: W - 90, y: 100 + Math.random() * (H - 190), k: "cry" }); }
      }
      for (const k of S.rk) { if (MODE === "blackhole") k.y += (H / 2 - k.y) * 0.5 * dt; k.x -= k.vx * dt * (1 + (S.ls || 0) * 0.8); k.y += k.vy * dt; k.rot += k.vr * dt; k.hit = Math.max(0, (k.hit || 0) - dt);
        for (const b of S.bl) if (!b.dead && Math.hypot(b.x - k.x, b.y - k.y) < k.r + 4) { b.dead = true; hurtRock(k, DMG); }
        for (const m of S.ms) if (!m.dead && Math.hypot(m.x - k.x, m.y - k.y) < k.r + 8) { m.life = 0; }
        if (!k.dead && !S.over && S.ship.inv <= 0 && Math.hypot(k.x - S.ship.x, k.y - S.ship.y) < k.r + 12) { hurtShip((6 + k.size * 4) * Math.sqrt(hard)); hurtRock(k, 99); } }
      S.bl = S.bl.filter((b: any) => !b.dead); S.rk = S.rk.filter((k: any) => !k.dead && k.x > -80);
      if (!S.win && !S.over) { if (MODE === "launch" && S.t >= LAUNCH_T) { S.win = true; S.endT = 0; sfx.play("win"); } if (MODE === "belt" && S.mined >= ORE_GOAL) { S.win = true; S.endT = 0; sfx.play("win"); S.shake = 8; } }
      for (const p of S.pk) { const dx = S.ship.x - p.x, dy = S.ship.y - p.y, d = Math.hypot(dx, dy); if (d < 160 + 20 * (ups.shp || 0) && !S.over) { p.x += dx / d * 420 * dt; p.y += dy / d * 420 * dt; } else p.x -= 60 * dt; if (d < 26) { p.dead = true; sfx.play("pickup"); if (p.k === "cry") S.cry++; else if (p.k === "solar") { S.energy = Math.min(100, (S.energy || 0) + 16); S.panels = (S.panels || 0) + 1; burst(p.x, p.y, 10, "120,200,255", 200); } else if (p.k === "mined") S.mined++; else S.loot[p.k]++; } }
      S.pk = S.pk.filter((p: any) => !p.dead && p.x > -20);
      for (const p of S.pt) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } S.pt = S.pt.filter((p: any) => p.life > 0).slice(-400);
      const a3 = is3dRef.current ? a3Ref.current : null;   // 3D quality: the solid things (space, planets, rocks, ships) come from the Three.js scene behind this canvas
      if (!a3) for (const st of S.stars) { st.x -= (40 + st.z * 260) * dt * (MODE === "warp" ? 5 : 1) * (1 + (S.ls || 0) * 6); if (st.x < 0) { st.x = W; st.y = Math.random() * H; } }
      S.shake = Math.max(0, S.shake - 30 * dt);
      if (S.win) { S.endT += dt; if (S.endT > 2.6 && !dead) { dead = true; onWin({ ark: SKY === "ark" ? { ...ARKST, hpFrac: Math.max(0.2, S.ship.hp / HP) } : null, kills: S.kills, cry: S.cry, loot: S.loot, mined: S.mined, mode: MODE, fuel: S.fuel }); } }
    };
    const draw = () => {
      const a3 = is3dRef.current ? a3Ref.current : null;
      const k2 = c.width / W; x.setTransform(k2, 0, 0, k2, 0, 0); const sh = S.shake; x.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      if (a3) {
        S.hidePlayer = !!fpvRef.current;
        try { const sh3 = S.shake || 0; a3.render(S, S.t, W, c.height / k2, (Math.random() - 0.5) * sh3, (Math.random() - 0.5) * sh3); } catch (e) { a3Bad = 999; }
        const nowT = performance.now(); if (a3Last) { a3Sum += nowT - a3Last; a3N++; } a3Last = nowT;
        if (a3N >= 150 || a3Bad >= 999) { const avg = a3Sum / Math.max(1, a3N); if (a3Bad >= 999 || avg > 40) { try { a3.dispose(); } catch (e) {} a3Ref.current = null; a3Last = 0; a3Sum = a3N = a3Bad = 0; setA3Msg("3D is too slow: back to 2D High"); setGfxLevel("high"); } else { a3Sum = a3N = 0; } }
        x.clearRect(-10, -10, W + 20, H + 20);
      } else { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#02030c"); g.addColorStop(1, "#0b0a24"); x.fillStyle = g; x.fillRect(-10, -10, W + 20, H + 20); }
      if (MODE === "launch") { const al = Math.max(0, 1 - S.t / LAUNCH_T), sk = x.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, "rgba(40,90,170," + al * 0.9 + ")"); sk.addColorStop(1, "rgba(255,170,110," + al + ")"); x.fillStyle = sk; x.fillRect(-10, -10, W + 20, H + 20); }
      // a distant planet and nebula
      if (!a3) { const ng = x.createRadialGradient(W * 0.75, H * 0.3, 10, W * 0.75, H * 0.3, 260); ng.addColorStop(0, "rgba(150,90,255,.28)"); ng.addColorStop(1, "rgba(150,90,255,0)"); x.fillStyle = ng; x.fillRect(0, 0, W, H); }
      // more nebula, far planets, a drifting far asteroid layer and the odd meteor streak (all harmless scenery)
      if (!a3 && MODE !== "launch") { const nb: [number, number, string, number][] = [[0.22, 0.62, "60,120,255", 220], [0.55, 0.12, "255,90,170", 180]]; for (const [nx, ny, nc, nr] of nb) { const q = x.createRadialGradient(W * nx, H * ny, 8, W * nx, H * ny, nr); q.addColorStop(0, "rgba(" + nc + ",.14)"); q.addColorStop(1, "rgba(" + nc + ",0)"); x.fillStyle = q; x.fillRect(0, 0, W, H); } }
      if (!a3 && HI() && MODE !== "launch") { if (!nebs) { nebs = [nebSprite(1, "90,120,255"), nebSprite(2, "255,110,190"), nebSprite(3, "80,220,200")]; dot = glowSprite("190,215,255"); } x.globalCompositeOperation = "lighter"; nebs.forEach((nb, i) => { const w = nb.width * (1.5 + i * 0.3), px = (((W * (0.2 + 0.3 * i) - (S.vt || 0) * (4 + i * 3)) % (W + w)) + (W + w)) % (W + w) - w * 0.5; x.globalAlpha = 0.5; x.drawImage(nb, px - w / 2, H * (0.1 + 0.28 * i) - w / 2, w, w); }); x.globalAlpha = 1; if (dot) for (const st of S.stars) if (st.z > 0.78) { const tw = 0.6 + 0.4 * Math.sin(S.t * 3 + st.y); x.globalAlpha = tw * 0.8; x.drawImage(dot, st.x - 7, st.y - 7, 14, 14); } x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; }
      if (MODE === "warp" || MODE === "blackhole" || MODE === "solar" || (MODE === "harvest" && SKY === "dyson")) drawHarvesterFar(x, W, H, S.t || 0, S.vt || 0);
      if (!a3) for (const d of bd) { const sw = d.spr.width, px = (((d.x * W - (S.vt || 0) * d.sp) % (W + sw)) + (W + sw)) % (W + sw) - sw / 2; x.drawImage(d.spr, px - sw / 2, d.y * H - sw / 2); }
      if (!a3 && MODE !== "launch" && MODE !== "warp") for (const f of far) { f.x -= f.sp / 60 * (1 + (S.ls || 0) * 7); if (f.x < -20) { f.x = W + 20; f.y = Math.random() * H; } f.rot += 0.004; x.save(); x.translate(f.x, f.y); x.rotate(f.rot); x.fillStyle = "rgba(70,62,86,.7)"; x.beginPath(); for (let i = 0; i < 7; i++) { const a2 = i / 7 * 6.283, rr = f.r * (0.8 + 0.25 * Math.sin(f.seed + i * 2.1)); x.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr); } x.closePath(); x.fill(); x.restore(); }
      streakT -= 1 / 60; if (streakT <= 0 && MODE !== "launch" && MODE !== "warp") { streakT = 2 + Math.random() * 4; streaks.push({ x: W * (0.4 + Math.random() * 0.6), y: Math.random() * H * 0.5, life: 0.7 }); }
      for (const m of streaks) { m.life -= 1 / 60; m.x -= 14; m.y += 6; const al = Math.max(0, m.life / 0.7); const sg2 = x.createLinearGradient(m.x, m.y, m.x + 120, m.y - 52); sg2.addColorStop(0, "rgba(255,255,255," + al + ")"); sg2.addColorStop(1, "rgba(255,255,255,0)"); x.strokeStyle = sg2; x.lineWidth = 2; x.beginPath(); x.moveTo(m.x, m.y); x.lineTo(m.x + 120, m.y - 52); x.stroke(); } for (let i = streaks.length - 1; i >= 0; i--) if (streaks[i].life <= 0) streaks.splice(i, 1);
      for (const st of S.stars) { x.fillStyle = "rgba(210,225,255," + (0.3 + st.z * 0.7) + ")"; x.fillRect(st.x, st.y, MODE === "warp" ? 14 + st.z * 46 : 1 + st.z * 1.6, 1 + st.z * 1.2); }
      if (MODE === "warp") {   // the tunnel: streaks fan out from a vanishing point, gates and the final portal ride in it
        const vx = W * 0.72, vy = H / 2; x.globalCompositeOperation = "lighter"; for (let i = 0; i < 70; i++) { const ang = i * 2.399, rr = ((S.t * (0.7 + (S.boost || 0)) + i * 0.137) % 1), r0 = rr * rr * W * 0.9, r1 = r0 + 20 + rr * 90; x.strokeStyle = "rgba(" + (i % 3 ? "150,200,255" : "255,160,255") + "," + (0.1 + rr * 0.5) + ")"; x.lineWidth = 0.6 + rr * 2; x.beginPath(); x.moveTo(vx + Math.cos(ang) * r0, vy + Math.sin(ang) * r0 * 0.7); x.lineTo(vx + Math.cos(ang) * r1, vy + Math.sin(ang) * r1 * 0.7); x.stroke(); }
        const tg = x.createRadialGradient(vx, vy, 4, vx, vy, 260); tg.addColorStop(0, "rgba(220,235,255,.55)"); tg.addColorStop(1, "rgba(80,100,255,0)"); x.fillStyle = tg; x.fillRect(0, 0, W, H);
        for (const g of S.gates || []) { x.save(); x.translate(g.x, g.y); const al = g.done ? 0.35 : 1; x.globalAlpha = al; x.strokeStyle = "rgba(130,200,255,.95)"; x.lineWidth = 7; x.beginPath(); x.ellipse(0, 0, 22, g.r, 0, 0, 7); x.stroke(); x.strokeStyle = "rgba(255,150,255,.85)"; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 0, 30, g.r + 8, 0, 0, 7); x.stroke(); x.strokeStyle = "#fff"; x.lineWidth = 2; x.setLineDash([8, 10]); x.lineDashOffset = -S.t * 80; x.beginPath(); x.ellipse(0, 0, 22, g.r, 0, 0, 7); x.stroke(); x.restore(); }
        if (S.portal) { const Pq = S.portal; x.save(); x.translate(Pq.x, Pq.y); for (let k = 0; k < 5; k++) { x.strokeStyle = "rgba(" + (k % 2 ? "255,160,255" : "150,210,255") + "," + (0.8 - k * 0.12) + ")"; x.lineWidth = 5 - k * 0.7; x.beginPath(); x.ellipse(0, 0, Pq.r * (1 - k * 0.14), Pq.r * (1 - k * 0.14), S.t * (1 + k * 0.4), 0, 4.6); x.stroke(); } const pg = x.createRadialGradient(0, 0, 2, 0, 0, Pq.r); pg.addColorStop(0, "rgba(255,255,255,.95)"); pg.addColorStop(1, "rgba(120,120,255,0)"); x.fillStyle = pg; x.beginPath(); x.arc(0, 0, Pq.r, 0, 7); x.fill(); x.restore(); }
        x.globalCompositeOperation = "source-over"; }
      if (MODE === "blackhole" && S.hole) {   // a black hole: an accretion disk, a bright photon ring, and a door that lights up once it opens
        const hx = S.hole.x, hy = S.hole.y; x.save(); x.translate(hx, hy); x.globalCompositeOperation = "lighter";
        const hg = x.createRadialGradient(0, 0, 40, 0, 0, 230); hg.addColorStop(0, "rgba(255,150,60,.35)"); hg.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = hg; x.fillRect(-240, -240, 480, 480);
        x.rotate(-0.22); for (let k = 0; k < 7; k++) { x.strokeStyle = "rgba(" + (k < 3 ? "255,200,120" : "255,120,50") + "," + (0.75 - k * 0.09) + ")"; x.lineWidth = 6 - k * 0.6; x.beginPath(); x.ellipse(0, 0, 80 + k * 17, 17 + k * 4.5, 0, S.t * (1.4 - k * 0.12), S.t * (1.4 - k * 0.12) + 5.2); x.stroke(); }
        x.rotate(0.22); x.globalCompositeOperation = "source-over"; x.fillStyle = "#000"; x.beginPath(); x.arc(0, 0, 44, 0, 7); x.fill();
        x.globalCompositeOperation = "lighter"; x.strokeStyle = S.opened ? "rgba(150,230,255," + (0.7 + 0.3 * Math.sin(S.t * 8)) + ")" : "rgba(255,230,200,.8)"; x.lineWidth = S.opened ? 5 : 2.4; x.beginPath(); x.arc(0, 0, 46, 0, 7); x.stroke();
        if (S.opened) { x.strokeStyle = "rgba(200,170,255,.8)"; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 62 + Math.sin(S.t * 6) * 4, 0, 7); x.stroke(); }
        x.restore(); }
      if (MODE === "solar") { const sg2 = x.createRadialGradient(W * 0.96, H * 0.18, 10, W * 0.96, H * 0.18, 300); sg2.addColorStop(0, "rgba(255,230,150,.5)"); sg2.addColorStop(1, "rgba(255,160,60,0)"); x.fillStyle = sg2; x.fillRect(0, 0, W, H); const en = S.energy === undefined ? 55 : S.energy; if (en < 20) { x.fillStyle = "rgba(255,40,60," + (0.08 + 0.08 * Math.sin(S.t * 8)) + ")"; x.fillRect(0, 0, W, H); } }
      if (MODE === "harvest" && SKY === "dyson") {   // a Dyson sphere under construction around the star: lattice arcs studded with panels
        const cx = W * 0.95, cy = H * 0.5; x.save(); x.translate(cx, cy); x.globalCompositeOperation = "lighter"; for (let k = 0; k < 3; k++) { const R = H * (0.5 + k * 0.17); x.strokeStyle = "rgba(255,210,110," + (0.5 - k * 0.1) + ")"; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R, Math.PI * 0.55, Math.PI * 1.45); x.stroke(); for (let q = 0; q < 26; q++) { const a2 = Math.PI * 0.55 + q / 26 * Math.PI * 0.9 + Math.sin(S.t * 0.3 + k) * 0.02; if ((q + k) % 4 === 0) continue; x.fillStyle = q % 3 ? "rgba(40,90,200,.7)" : "rgba(255,215,120,.7)"; x.save(); x.rotate(a2); x.fillRect(R - 6, -8, 12, 16); x.restore(); } } x.restore(); }
      if (bigGas && (SKY === "gas" || SKY === "jupiter" || SKY === "saturn")) { const px = SKY === "gas" ? W * 0.97 : SKY === "jupiter" ? W * 0.84 : W * 0.8, py = SKY === "gas" ? H * 0.5 : SKY === "jupiter" ? H * 1.02 : H * 0.26; x.drawImage(bigGas, px - bigGas.width / 2, py - bigGas.height / 2); }
      if (SKY === "venus") { const vg = x.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, "rgba(120,80,10,.55)"); vg.addColorStop(1, "rgba(230,170,50,.5)"); x.fillStyle = vg; x.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) { const yy = ((i * 96 + S.t * (8 + i * 3)) % (H + 90)) - 45, cg = x.createLinearGradient(0, yy, 0, yy + 80); cg.addColorStop(0, "rgba(255,225,140,0)"); cg.addColorStop(0.5, "rgba(255,225,140,.22)"); cg.addColorStop(1, "rgba(255,225,140,0)"); x.fillStyle = cg; x.fillRect(0, yy, W, 80); }
        for (const px of [W * 0.88, W * 0.7]) { const py = H * (px > W * 0.8 ? 0.72 : 0.3); x.fillStyle = "#2a3a4a"; x.fillRect(px - 44, py, 88, 7); x.fillStyle = "rgba(255,240,180,.9)"; for (let w = 0; w < 6; w++) x.fillRect(px - 38 + w * 14, py - 9, 6, 7); x.fillStyle = "rgba(160,220,255,.6)"; x.beginPath(); x.ellipse(px, py - 8, 30, 14, 0, Math.PI, 0); x.fill(); } }
      if ((S.ls || 0) > 0.02 && MODE !== "warp") { const L = S.ls, vx = W * 0.8, vy = S.ship.y; x.globalCompositeOperation = "lighter"; for (let i = 0; i < 46; i++) { const yy = ((i * 97.3) % H), ln = 80 + ((i * 53) % 220) * L, xx = ((i * 211 - S.t * (900 + (i % 7) * 260)) % (W + 300) + (W + 300)) % (W + 300) - 150; x.strokeStyle = "rgba(" + (i % 4 ? "170,215,255" : "255,200,255") + "," + (0.12 + 0.5 * L * ((i % 5) / 5 + 0.2)) + ")"; x.lineWidth = 0.8 + (i % 3) * 0.7; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + ln, yy + (vy - yy) * 0.04); x.stroke(); } const lg = x.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, "rgba(120,170,255," + 0.22 * L + ")"); lg.addColorStop(0.5, "rgba(120,170,255,0)"); lg.addColorStop(1, "rgba(255,160,255," + 0.15 * L + ")"); x.fillStyle = lg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over"; }
      for (const p of S.pk) { if (p.k === "solar") { x.save(); x.translate(p.x, p.y); x.rotate(Math.sin(S.t * 2 + p.y) * 0.25); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,215,110,.18)"; x.beginPath(); x.arc(0, 0, 24, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; x.fillStyle = "#1c3f8c"; x.fillRect(-15, -9, 30, 18); x.strokeStyle = "rgba(160,210,255,.85)"; x.lineWidth = 1; for (let gx = -15; gx <= 15; gx += 10) { x.beginPath(); x.moveTo(gx, -9); x.lineTo(gx, 9); x.stroke(); } x.beginPath(); x.moveTo(-15, 0); x.lineTo(15, 0); x.stroke(); x.strokeStyle = "#e8c860"; x.lineWidth = 2; x.strokeRect(-15, -9, 30, 18); x.restore(); continue; } x.fillStyle = p.k === "cry" ? "#7fe8ff" : p.k === "mined" ? "#ffd8a0" : p.k === "scrap" ? "#b8b8c8" : p.k === "ore" ? "#ffb060" : p.k === "gold" ? "#ffd23f" : "#c78bff"; x.beginPath(); x.arc(p.x, p.y, p.k === "cry" ? 6 : 5, 0, 7); x.fill(); }
      if (MODE === "harvest") { const sg = x.createRadialGradient(W * 0.92, H * 0.5, 20, W * 0.92, H * 0.5, H * 0.9); sg.addColorStop(0, "rgba(255,230,150,.55)"); sg.addColorStop(0.4, "rgba(255,140,50,.22)"); sg.addColorStop(1, "rgba(255,80,20,0)"); x.fillStyle = sg; x.fillRect(0, 0, W, H);
        if (S.stn) { const q = S.stn; x.save(); x.translate(q.x, q.y); x.globalCompositeOperation = "lighter"; x.strokeStyle = "rgba(255,220,130," + (0.5 + 0.3 * Math.sin(S.t * 6)) + ")"; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 78, 0, 7); x.stroke(); x.strokeStyle = "rgba(120,230,255,.95)"; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 66, -1.57, -1.57 + 6.283 * q.p / 7); x.stroke(); x.globalCompositeOperation = "source-over"; x.fillStyle = "#cfd8e6"; x.fillRect(-6, -26, 12, 52); x.fillStyle = "#ffd060"; x.fillRect(-26, -4, 52, 8); x.restore(); }
        for (const f of S.flares) { if (f.t > 0) { x.fillStyle = "rgba(255,70,90," + (0.15 + 0.2 * Math.sin(S.t * 24)) + ")"; x.fillRect(0, f.y - 34, W, 68); } else { x.globalCompositeOperation = "lighter"; const fg = x.createLinearGradient(0, f.y - 30, 0, f.y + 30); fg.addColorStop(0, "rgba(255,200,90,0)"); fg.addColorStop(0.5, "rgba(255,240,190,.95)"); fg.addColorStop(1, "rgba(255,200,90,0)"); x.fillStyle = fg; x.fillRect(0, f.y - 30, W, 60); x.globalCompositeOperation = "source-over"; } } }
      if (MODE === "evade") {   // a dark red void with a Harvester ring far behind, and the scan beams: a warning band first, then the bright sweep
        const rg = x.createRadialGradient(W * 0.86, H * 0.45, 10, W * 0.86, H * 0.45, H * 0.9); rg.addColorStop(0, "rgba(255,90,110,.35)"); rg.addColorStop(1, "rgba(120,20,60,0)"); x.fillStyle = rg; x.fillRect(0, 0, W, H);
        x.save(); x.translate(W * 0.86, H * 0.45); x.rotate(-0.45); for (let k = 0; k < 3; k++) { x.strokeStyle = "rgba(255,120,150," + (0.5 - k * 0.12) + ")"; x.lineWidth = 3 - k * 0.6; x.beginPath(); x.ellipse(0, 0, H * (0.32 + k * 0.08), H * (0.32 + k * 0.08) * 0.27, 0, 0, 7); x.stroke(); } x.restore();
        for (const f of S.scans || []) { const bw = 76; if (f.t > 0) { x.fillStyle = "rgba(255,70,90," + (0.1 + 0.18 * Math.sin(S.t * 22)) + ")"; if (f.h) x.fillRect(0, f.p - bw / 2, W, bw); else x.fillRect(f.p - bw / 2, 0, bw, H); } else { x.globalCompositeOperation = "lighter"; const a = Math.max(0, 1 + f.t / 0.3); x.fillStyle = "rgba(255,200,220," + 0.75 * a + ")"; if (f.h) x.fillRect(0, f.p - bw / 2, W, bw); else x.fillRect(f.p - bw / 2, 0, bw, H); x.globalCompositeOperation = "source-over"; } }
      }
      if (MODE === "skim") { for (let i = 0; i < 7; i++) { const yy = ((i * 82 + S.t * (10 + i * 4)) % (H + 80)) - 40; const g2 = x.createLinearGradient(0, yy, 0, yy + 70); g2.addColorStop(0, "rgba(" + (i % 2 ? "120,70,190" : "210,120,70") + ",0)"); g2.addColorStop(0.5, "rgba(" + (i % 2 ? "120,70,190" : "210,120,70") + ",.35)"); g2.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g2; x.fillRect(0, yy, W, 70); }
        const by = S.band || H / 2; x.globalCompositeOperation = "lighter"; const bg = x.createLinearGradient(0, by - 80, 0, by + 80); bg.addColorStop(0, "rgba(255,200,100,0)"); bg.addColorStop(0.5, "rgba(255,210,120,.35)"); bg.addColorStop(1, "rgba(255,200,100,0)"); x.fillStyle = bg; x.fillRect(0, by - 80, W, 160); x.strokeStyle = "rgba(255,230,150,.6)"; x.setLineDash([14, 10]); x.lineWidth = 2; x.beginPath(); x.moveTo(0, by - 70); x.lineTo(W, by - 70); x.moveTo(0, by + 70); x.lineTo(W, by + 70); x.stroke(); x.setLineDash([]); x.globalCompositeOperation = "source-over";
        for (const b of S.bolts) { if (b.t > 0) { x.fillStyle = "rgba(255,70,90," + (0.15 + 0.2 * Math.sin(S.t * 24)) + ")"; x.fillRect(b.x - 36, 0, 72, H); } else { x.globalCompositeOperation = "lighter"; x.strokeStyle = "rgba(190,220,255,.95)"; x.lineWidth = 5; x.beginPath(); x.moveTo(b.x, 0); for (let yy = 30; yy < H; yy += 40) x.lineTo(b.x + (Math.random() - 0.5) * 36, yy); x.stroke(); x.globalCompositeOperation = "source-over"; } } }
      if (S.relay) { const R = S.relay; x.save(); x.translate(R.x, R.y); x.globalCompositeOperation = "lighter"; const rg = x.createRadialGradient(0, 0, 4, 0, 0, 40); rg.addColorStop(0, "rgba(160,230,255,.9)"); rg.addColorStop(1, "rgba(120,160,255,0)"); x.fillStyle = rg; x.beginPath(); x.arc(0, 0, 40 + Math.sin(R.ph * 6) * 4, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; x.strokeStyle = "#cfe8ff"; x.lineWidth = 2.5; x.beginPath(); x.arc(0, 0, 22, 0, 7); x.stroke(); x.fillStyle = "#fff"; x.font = "900 24px system-ui"; x.textAlign = "center"; x.fillText("♪", 0, 8); x.restore(); }
      if (!a3) for (const k of S.rk) { x.save(); x.translate(k.x, k.y); x.rotate(k.rot); const n = 9; x.fillStyle = k.hit > 0 ? "#fff" : mg(x, -k.r, k.r, SKY === "saturn" ? "#b8cfe4" : "#8a7a6a"); x.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * 6.283, rr = k.r * (0.78 + 0.28 * Math.sin(k.seed + i * 2.3)); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); x.strokeStyle = "rgba(255,210,150,.5)"; x.lineWidth = 1.5; x.stroke(); x.fillStyle = "rgba(0,0,0,.28)"; x.beginPath(); x.arc(k.r * 0.2, -k.r * 0.2, k.r * 0.22, 0, 7); x.arc(-k.r * 0.35, k.r * 0.25, k.r * 0.15, 0, 7); x.fill(); if (MODE === "belt") { x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(120,220,255,.7)"; x.fillRect(-k.r * 0.1, -k.r * 0.5, 3, 3); x.fillRect(k.r * 0.3, k.r * 0.1, 3, 3); } x.restore(); }
      if (!a3 && HI()) for (const k of S.rk) { x.save(); x.translate(k.x, k.y); x.rotate(k.rot); for (let c2 = 0; c2 < 3; c2++) { const a2 = k.seed * 3 + c2 * 2.1, rr = k.r * 0.45, cx = Math.cos(a2) * rr, cy = Math.sin(a2) * rr, cr = k.r * (0.12 + 0.06 * c2); x.fillStyle = "rgba(20,14,10,.4)"; x.beginPath(); x.arc(cx, cy, cr, 0, 7); x.fill(); x.strokeStyle = "rgba(255,225,190,.35)"; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, cr, 3.6, 5.6); x.stroke(); } x.strokeStyle = "rgba(255,235,200,.5)"; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, k.r * 0.9, 3.9, 5.5); x.stroke(); x.restore(); }
      if (!a3) for (const e of S.en) drawEnemy(x, e);
      const B = S.boss; if (B && !B.dead && !a3) { drawBoss(x, B); bossFX(x, B); }
      x.globalCompositeOperation = "lighter";
      for (const b of S.bl) { x.fillStyle = "rgba(" + glow + ",.95)"; x.fillRect(b.x - 12, b.y - 2, 24, 4); if (HI() && dot) x.drawImage(dot, b.x - 16, b.y - 16, 32, 32); }
      for (const b of S.eb) { x.fillStyle = b.big ? "rgba(255,80,120,.95)" : "rgba(255,170,60,.95)"; x.beginPath(); x.arc(b.x, b.y, b.big ? 7 : 5, 0, 7); x.fill(); }
      for (const m of S.ms) { x.fillStyle = "#fff6c8"; x.beginPath(); x.arc(m.x, m.y, 5, 0, 7); x.fill(); }
      for (const p of S.pt) { x.fillStyle = "rgba(" + p.col + "," + Math.max(0, p.life / p.max) + ")"; x.fillRect(p.x, p.y, 3, 3); }
      x.globalCompositeOperation = "source-over";
      if (HI()) {   // heat trail behind the ship, and foreground dust drifting past
        const sp0 = S.ship; trail.push({ x: sp0.x - (SKY === "ark" ? 70 : 26), y: sp0.y }); if (trail.length > 30) trail.shift(); x.globalCompositeOperation = "lighter";
        for (let i = 1; i < trail.length; i++) { trail[i - 1].x -= 5 * (1 + (S.ls || 0) * 4); const al = i / trail.length; x.strokeStyle = "rgba(" + glow + "," + al * 0.35 + ")"; x.lineWidth = 2 + al * 8; x.lineCap = "round"; x.beginPath(); x.moveTo(trail[i - 1].x, trail[i - 1].y); x.lineTo(trail[i].x, trail[i].y); x.stroke(); }
        for (let i = 0; i < 14; i++) { const fx = (((i * 163 - (S.vt || 0) * (90 + i * 11)) % (W + 80)) + (W + 80)) % (W + 80) - 40, fy = (i * 97) % H, fr = 3 + (i % 4) * 3; x.fillStyle = "rgba(200,220,255," + (0.05 + (i % 3) * 0.03) + ")"; x.beginPath(); x.arc(fx, fy, fr, 0, 7); x.fill(); }
        x.globalCompositeOperation = "source-over"; } else if (trail.length) trail.length = 0;
      if (SKY === "ark" && !S.over) {   // live Ark readout: trip progress against the food in the holds, the ring's gravity and the hull
        const prog = Math.min(1, ((S.gp || 0) + (S.win ? 1 : 0)) / 3), eaten = Math.round(600 * prog), left = Math.max(0, ARKST.foodDays - eaten), tx = 14, ty = H - 74;
        x.save(); x.globalAlpha = 0.9; x.fillStyle = "rgba(6,14,28,.6)"; x.fillRect(tx, ty, 190, 62);
        const bar = (yy: number, f: number, col: string, tx2: string) => { x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(tx + 8, yy, 120, 8); x.fillStyle = col; x.fillRect(tx + 8, yy, 120 * Math.max(0, Math.min(1, f)), 8); x.fillStyle = "#dff"; x.font = "10px sans-serif"; x.fillText(tx2, tx + 134, yy + 8); };
        bar(ty + 8, prog, "#7ab8ff", "day " + eaten + "/600"); bar(ty + 26, left / 600, left > 0 ? "#6ee59a" : "#ff6a5a", left > 0 ? "food " + left : "no food"); bar(ty + 44, ARKST.gravity / 1.0, ARKST.health >= 1 ? "#8cffdc" : "#ffc060", ARKST.gravity + " g");
        x.restore();
      }
      const s = S.ship;
      if (!S.over && fpvRef.current) {   // first person: the ship is the viewer, so draw a reticle (and the thruster glow) where it is instead of its hull
        x.save(); x.translate(s.x + 60, s.y); x.globalCompositeOperation = "lighter"; x.strokeStyle = "rgba(150,255,230,.9)"; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 15, 0, 7); x.moveTo(0, -26); x.lineTo(0, -12); x.moveTo(0, 12); x.lineTo(0, 26); x.moveTo(-26, 0); x.lineTo(-12, 0); x.moveTo(12, 0); x.lineTo(26, 0); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(0, 0, 2, 0, 7); x.fill(); x.restore();
        const he = hurtRef.current; if (he && s.inv > 0.55 && !he.classList.contains("on")) { he.classList.add("on"); setTimeout(() => { try { he.classList.remove("on"); } catch (e) {} }, 170); }
      } else if (!S.over && !a3) { x.save(); x.translate(s.x, s.y); if (s.inv > 0 && Math.floor(S.t * 20) % 2) x.globalAlpha = 0.4; if (SKY === "ark") { x.scale(0.82, 0.82); drawArk(x, glow, S.t, ARKLV); } else drawPlayer(x, glow, S.t); x.restore(); }
      if (HI()) {   // bloom: the frame, shrunk and stretched back over itself, plus a soft colour vignette
        const bw = Math.max(48, c.width >> 3), bh = Math.max(27, c.height >> 3); if (!bloomA) { bloomA = document.createElement("canvas"); bloomB = document.createElement("canvas"); }
        if (bloomA && bloomB) { bloomA.width = bw; bloomA.height = bh; bloomB.width = bw >> 1; bloomB.height = bh >> 1; const a1 = bloomA.getContext("2d")!, b1 = bloomB.getContext("2d")!; a1.drawImage(c, 0, 0, bw, bh); b1.drawImage(bloomA, 0, 0, bw >> 1, bh >> 1);
          x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.3; x.drawImage(bloomB, 0, 0, c.width, c.height); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
          const vg = x.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.45, c.width / 2, c.height / 2, c.height * 1.05); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(8,6,28,.5)"); x.fillStyle = vg; x.fillRect(0, 0, c.width, c.height); }
      }
    };
    const frame = (now: number) => { raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (highRef.current && hiOk) { ema = ema * 0.95 + dt * 0.05; if (ema > 0.03) slowN++; else slowN = Math.max(0, slowN - 1); if (slowN > 60) hiOk = false; } if (document.hidden || pausedRef.current || (ctl && ctl.current && ctl.current.paused)) { last = now; if (pausedRef.current || (ctl && ctl.current && ctl.current.paused)) draw(); return; } step(dt); draw(); };
    raf = requestAnimationFrame(frame);
    const hudT = setInterval(() => { setUi({ lsc: (S.lsT || 0) > 0 ? 1 : 1 - Math.max(0, S.lsCd || 0) / LS_CD, lsOn: (S.lsT || 0) > 0, en: Math.round(S.energy === undefined ? 55 : S.energy), pn: S.panels || 0, gp: S.gp || 0, op: !!S.opened, hl: Math.max(0, Math.ceil(HOLE_T - S.t)), portal: !!S.portal, st: S.st, sp: S.stn ? S.stn.p : 0, fuel: S.fuel, mined: S.mined, hp: Math.max(0, Math.round(S.ship.hp)), boss: S.boss ? Math.max(0, S.boss.hp / S.boss.max) : 0, bossOn: !!S.boss && !S.boss.dead, t: Math.floor(S.t), kills: S.kills, over: S.over, win: S.win, ms: Math.max(0, S.ship.mCd) }); }, 150);
    const kd = (e: KeyboardEvent, v: boolean) => { const cd = e.code, k = keys.current; if (cd === "ArrowLeft" || cd === "KeyA") k.l = v; else if (cd === "ArrowRight" || cd === "KeyD") k.r = v; else if (cd === "ArrowUp" || cd === "KeyW") k.u = v; else if (cd === "ArrowDown" || cd === "KeyS") k.d = v; else if (cd === "Space" || cd === "KeyJ") k.fire = v; else if (cd === "KeyK" || cd === "KeyY") k.miss = v; };
    const dn = (e: KeyboardEvent) => kd(e, true), up = (e: KeyboardEvent) => kd(e, false); window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    (window as any).__advShip = { mode: MODE, lsNow: () => ({ ls: S.ls || 0, on: (S.lsT || 0) > 0, cd: S.lsCd || 0, vt: S.vt || 0 }), setShip: (px: number, py: number) => { S.ship.x = px; S.ship.y = py; }, energyNow: () => S.energy, panelsNow: () => S.panels || 0, giveSolar: () => { S.pk.push({ x: S.ship.x, y: S.ship.y, k: "solar" }); }, gatesPassed: () => S.gp || 0, gatesNow: () => (S.gates || []).length, warpSkip: () => { S.gp = 3; S.portal = { x: W - 170, y: H / 2, r: 90 }; }, portalXY: () => S.portal ? { x: S.portal.x, y: S.portal.y } : null, holeOpen: () => { S.t = Math.max(S.t, HOLE_T); }, holeXY: () => S.hole, opened: () => !!S.opened, drain: () => { S.energy = 0; }, shipPos: () => ({ x: S.ship.x, y: S.ship.y }), skipEvade: () => { S.t = EVADE_T; }, bulletsN: () => S.bl.length, scansN: () => (S.scans || []).length, setFire: (v: boolean) => { keys.current.fire = v; }, speedNow: () => 330 * (1 + 0.06 * (ups.shp || 0)), stationsDone: () => S.st, holdStation: () => { if (S.stn) { S.ship.x = S.stn.x; S.ship.y = S.stn.y; } }, fastStation: () => { if (S.stn) S.stn.p = 6.9; }, inBand: () => { S.ship.y = S.band || H / 2; }, answer: (ok: boolean) => { if (ctl && ctl.current && ctl.current.answer) ctl.current.answer(ok); }, relayNow: () => { S.relay = { x: S.ship.x + 10, y: S.ship.y, ph: 0 }; }, answers: () => S.ans, fuel: () => S.fuel, fillFuel: () => { S.fuel = 99.5; }, hpNow: () => S.ship.hp, setHpS: (v: number) => { S.ship.hp = v; }, rocks: () => S.rk.length, giveOre: (n: number) => { S.mined += n; }, skipLaunch: () => { S.t = LAUNCH_T - 0.1; }, spawnRock: (sz: number) => addRock(S.ship.x + 200, S.ship.y, sz), state: () => ({ mined: S.mined, rk: S.rk.length, t: S.t, hp: S.ship.hp, kills: S.kills, en: S.en.length, boss: S.boss ? { hp: S.boss.hp, dead: !!S.boss.dead } : null, over: S.over, win: S.win, cry: S.cry, bl: S.bl.length, ms: S.ms.length }), skip: () => { S.t = BOSS_AT - 0.1; }, god: () => { S.ship.hp = 1e6; }, killBoss: () => { if (S.boss) S.boss.hp = 0.5; }, dieNow: () => { S.ship.inv = 0; S.ship.hp = 0.1; S.eb.push({ x: S.ship.x, y: S.ship.y, vx: 0, vy: 0 }); }, spawn: (ty: string) => addEnemy(ty, S.ship.y) };
    return () => { cancelAnimationFrame(raf); clearInterval(hudT); window.removeEventListener("resize", fit); window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advShip; } catch (e) {} };
  }, []);
  const hold = (name: string) => ({
    onPointerDown: (e: any) => { e.preventDefault(); keys.current[name] = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} },
    onPointerUp: () => { keys.current[name] = false; }, onPointerCancel: () => { keys.current[name] = false; }, onLostPointerCapture: () => { keys.current[name] = false; },
  });
  // The left half of the screen is a touch stick (owner, 2026-10-12): drag anywhere on it and the ship follows the thumb's direction; the big round joystick at the
  // bottom-left is the same control with a fixed centre. keys.ax / keys.ay are the analog values (-1..1) the step reads beside the arrow keys.
  const stickRef = useRef<any>({ id: -1, ox: 0, oy: 0 }), knobRef = useRef<HTMLDivElement>(null), ringRef = useRef<HTMLDivElement>(null);
  const STICK_R = 56;
  const setStick = (dx: number, dy: number) => {
    const d = Math.hypot(dx, dy), m = d > STICK_R ? STICK_R / d : 1, vx = dx * m, vy = dy * m;
    const dz = (v: number) => { const a = Math.abs(v) / STICK_R; return a < 0.18 ? 0 : Math.sign(v) * Math.min(1, (a - 0.18) / 0.82 + 0.1); };
    keys.current.ax = dz(vx); keys.current.ay = dz(vy);
    if (knobRef.current) knobRef.current.style.transform = "translate(" + vx + "px," + vy + "px)";
  };
  const stickEnd = () => { stickRef.current.id = -1; keys.current.ax = 0; keys.current.ay = 0; if (knobRef.current) knobRef.current.style.transform = "translate(0,0)"; if (ringRef.current) ringRef.current.style.opacity = "0"; };
  const stick = {
    onPointerDown: (e: any) => {
      if (stickRef.current.id !== -1 || e.target.closest(".adv-top,.adv-clear,.pvppad-r")) return; e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {}
      const joy = e.target.closest(".adv-joy"); let ox = e.clientX, oy = e.clientY;
      if (joy) { const r = joy.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
      else if (ringRef.current) { const zr = e.currentTarget.getBoundingClientRect(); ringRef.current.style.left = ox - zr.left + "px"; ringRef.current.style.top = oy - zr.top + "px"; ringRef.current.style.opacity = "1"; }
      stickRef.current = { id: e.pointerId, ox, oy }; setStick(e.clientX - ox, e.clientY - oy);
    },
    onPointerMove: (e: any) => { if (e.pointerId === stickRef.current.id) setStick(e.clientX - stickRef.current.ox, e.clientY - stickRef.current.oy); },
    onPointerUp: (e: any) => { if (e.pointerId === stickRef.current.id) stickEnd(); }, onPointerCancel: (e: any) => { if (e.pointerId === stickRef.current.id) stickEnd(); }, onLostPointerCapture: (e: any) => { if (e.pointerId === stickRef.current.id) stickEnd(); },
  };
  return (
    <div className="adv-ship">
      <div ref={host3Ref} className="adv-3d" />
      <canvas ref={cv} />
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">{MODE === "solar" ? "🔋 " + t("แบตเตอรี ", "BATTERY ", "电量 ") + (ui.en || 0) + "% · ☀ " + (ui.pn || 0) + "/8" : MODE === "warp" ? "🌌 " + (ui.portal ? t("พุ่งเข้าพอร์ทัล!", "DIVE INTO THE PORTAL!", "冲入传送门！") : t("ประตูวาร์ป ", "GATES ", "曲速门 ") + (ui.gp || 0) + "/3") : MODE === "blackhole" ? "⚫ " + (ui.op ? t("ประตูเปิดแล้ว — พุ่งเข้าตรงกลาง!", "THE DOOR IS OPEN — DIVE IN!", "门已开启——冲进去！") : t("ประตูเปิดใน ", "Door opens in ", "门将在 ") + (ui.hl || 0) + "s") : MODE === "harvest" ? (SKY === "gas" ? "⛽ " + t("หัวสูบ ", "PUMP ", "抽取口 ") : SKY === "dyson" ? "🛰 " + t("ท่าจอด ", "DOCK ", "对接口 ") : SKY === "venus" ? "☁ " + t("แท่นลอยฟ้า ", "PLATFORM ", "浮空平台 ") : "☀ " + t("สถานี ", "STATION ", "采集站 ")) + Math.min(3, ui.st + 1) + "/3 · " + Math.round((ui.sp || 0) / 7 * 100) + "%" : MODE === "evade" ? "👁 " + t("รอดจากสายตาฮาร์เวสเตอร์อีก ", "Unseen for ", "躲过收割者的视线 ") + Math.max(0, EVADE_T - ui.t) + "s" : MODE === "skim" ? "⛽ " + t("ถังพลังงาน ", "TANK ", "能量罐 ") + Math.round(ui.fuel || 0) + "%" : MODE === "launch" ? "🚀 " + t("ถึงวงโคจรใน ", "Orbit in ", "入轨倒计时 ") + Math.max(0, LAUNCH_T - ui.t) + "s" : MODE === "belt" ? "⛏ " + t("แร่ ", "ORE ", "矿 ") + (ui.mined || 0) + "/" + ORE_GOAL + " · ☠ " + ui.kills : <>☠ {ui.kills} · {ui.bossOn ? t("มาเธอร์ชิป", "MOTHERSHIP", "母舰") : t("ถึงมาเธอร์ชิปใน ", "Mothership in ", "母舰到来 ") + Math.max(0, 55 - ui.t) + "s"}</>}</div>
          <div className="adv-bar adv-hp"><i style={{ width: Math.max(0, Math.min(100, ui.hp)) + "%" }} /><b>HP {ui.hp}</b></div>
          {MODE === "dogfight" && ui.bossOn && <div className="adv-bar adv-sk"><i style={{ width: ui.boss * 100 + "%" }} /><b>{t("มาเธอร์ชิป", "MOTHERSHIP", "母舰")}</b></div>}
        </div>
        <div className="fpv-tr"><FpvButton lang={lang} on={fpv} onClick={flipFpv} /><GearButton onClick={() => { const k = keys.current; k.l = k.r = k.u = k.d = k.fire = k.miss = false; k.ax = 0; k.ay = 0; pausedRef.current = true; setGear(true); }} /></div>
      </div>
      {fpv && <><FpvCockpit /><FpvHurt hurtRef={hurtRef} /></>}
      {gear && <SettingsPopup lang={lang} level={gfx} onLevel={setGfxLevel} can3d={can3dNow()} high={high} onGfx={flipGfx} musicOn={musicOn} onMusic={flipMusic} online={false} onResume={() => { pausedRef.current = false; setGear(false); }} onExit={() => { pausedRef.current = false; onExit(); }} />}
      {(ui.over || ui.win) && <div className="adv-clear" role="dialog" aria-label="ship result">{ui.win ? t("ชนะ! กำลังสรุปผล…", "Victory! Tallying…", "胜利！结算中…") : <><b>{t("ยานถูกทำลาย", "Ship destroyed", "战机被毁")}</b><button className="adv-btn go" onClick={() => retry.current()}>↻ {t("ลองใหม่", "Retry", "重试")}</button><button className="adv-btn" onClick={() => onExit()}>{t("กลับแผนที่", "Back to map", "返回地图")}</button></>}</div>}
      <div className="adv-stickzone" data-stickzone="1" {...stick}><div className="adv-stickring" ref={ringRef} /></div>
      <div className="adv-pad">
        <div className="pvppad-l"><div className="adv-joy" role="application" aria-label="joystick" {...stick}><b className="u">▲</b><b className="d">▼</b><b className="l">◀</b><b className="r">▶</b><div className="adv-knob" ref={knobRef} /></div></div>
        <div className="pvppad-r">
          <button className="pvpact fire" aria-label="shoot" {...hold("fire")}><b>🔫</b><i>{t("ยิง", "FIRE", "射击")}</i></button>
          <button className={"pvpact light" + (ui.lsOn ? " on" : ui.lsc < 1 ? " cool" : "")} aria-label="light speed" data-light="1" style={{ ["--lc" as any]: Math.round((ui.lsc == null ? 1 : ui.lsc) * 100) + "%" }} onPointerDown={(e: any) => { e.preventDefault(); keys.current.lsReq = true; }}><b>⚡</b><i>{t("ความเร็วแสง", "LIGHT", "光速")}</i></button>
          <button className={"pvpact rocket" + (ui.ms > 0.05 ? " cool" : "")} aria-label="missile" {...hold("miss")}><b>🚀</b><i>{t("มิสไซล์", "MISSILE", "导弹")}</i></button>
        </div>
      </div>
    </div>
  );
}
