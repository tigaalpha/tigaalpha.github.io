/* A SpaceX-flavoured cyberpunk backdrop for the colony level (owner, 2026-10-15: "a city of SpaceX, Elon Musk's dream of space, grand, beautiful, future, more cyberpunk").
   Far behind the plots: a Starbase launch site (a stainless Starship on its Super Heavy booster, the launch tower with its chopsticks, a second ship being stacked),
   a dense neon megacity skyline with lit windows, vertical signs and holo billboards, sky lanes of flying cars with light trails.
   In front of everything: neon ground lines, rain, low fog and a faint scan texture. Code-drawn, only gradients and strokes. */
type Cx = CanvasRenderingContext2D;
const h = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const NEON = ["#19e6ff", "#ff2bd6", "#ffd23f", "#7a5cff", "#35ff9a"];

export function starship(x: Cx, bx: number, by: number, sc: number, T: number, lit: boolean) {
  // Super Heavy booster + Starship, brushed stainless with a bright rim and a hot glow at the foot
  const bw = 15 * sc, bh1 = 64 * sc, sh = 52 * sc;
  const steel = (x0: number, w: number) => { const g = x.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, "#7d8794"); g.addColorStop(0.3, "#f4f7fb"); g.addColorStop(0.55, "#c4ccd6"); g.addColorStop(1, "#4a525e"); return g; };
  x.fillStyle = steel(bx - bw, bw * 2); x.fillRect(bx - bw, by - bh1, bw * 2, bh1);
  x.strokeStyle = "rgba(40,50,64,.45)"; x.lineWidth = 0.8; for (let k = 1; k < 8; k++) { x.beginPath(); x.moveTo(bx - bw, by - bh1 + k * bh1 / 8); x.lineTo(bx + bw, by - bh1 + k * bh1 / 8); x.stroke(); }
  x.fillStyle = steel(bx - bw * 0.95, bw * 1.9); x.fillRect(bx - bw * 0.95, by - bh1 - sh, bw * 1.9, sh);
  x.beginPath(); x.moveTo(bx - bw * 0.95, by - bh1 - sh); x.quadraticCurveTo(bx, by - bh1 - sh - 26 * sc, bx + bw * 0.95, by - bh1 - sh); x.fill();
  // flaps and the black heat-shield side
  x.fillStyle = "#1a1d24"; x.fillRect(bx + bw * 0.45, by - bh1 - sh + 4 * sc, bw * 0.5, sh - 6 * sc);
  x.fillStyle = "#c9d1db"; x.beginPath(); x.moveTo(bx - bw * 0.95, by - bh1 - sh + 14 * sc); x.lineTo(bx - bw * 1.9, by - bh1 - sh + 24 * sc); x.lineTo(bx - bw * 0.95, by - bh1 - sh + 28 * sc); x.fill();
  x.beginPath(); x.moveTo(bx - bw * 0.95, by - bh1 + 2 * sc); x.lineTo(bx - bw * 1.8, by - bh1 + 14 * sc); x.lineTo(bx - bw * 0.95, by - bh1 + 16 * sc); x.fill();
  // grid fins at the booster top
  x.fillStyle = "#59616d"; x.fillRect(bx - bw * 1.5, by - bh1 + 2 * sc, bw * 0.5, 7 * sc); x.fillRect(bx + bw, by - bh1 + 2 * sc, bw * 0.5, 7 * sc);
  if (lit) { const fl = 0.7 + 0.3 * Math.sin(T * 9); const g = x.createRadialGradient(bx, by, 1, bx, by, 60 * sc); g.addColorStop(0, "rgba(255,200,120," + 0.55 * fl + ")"); g.addColorStop(1, "rgba(255,120,60,0)"); x.fillStyle = g; x.beginPath(); x.ellipse(bx, by, 60 * sc, 22 * sc, 0, 0, 7); x.fill(); }
  // a light strip down the side
  x.strokeStyle = "rgba(120,230,255,.55)"; x.lineWidth = 1; x.beginPath(); x.moveTo(bx - bw * 0.7, by - bh1 - sh); x.lineTo(bx - bw * 0.7, by); x.stroke();
}
export function tower(x: Cx, tx: number, ty: number, sc: number, T: number) {
  // the launch tower: a steel lattice mast with the two catching arms ("chopsticks") and red beacons
  const w = 12 * sc, hgt = 150 * sc; x.strokeStyle = "rgba(190,205,225,.8)"; x.lineWidth = 1.2;
  x.strokeRect(tx - w / 2, ty - hgt, w, hgt); for (let k = 0; k < 18; k++) { x.beginPath(); x.moveTo(tx - w / 2, ty - hgt + k * hgt / 18); x.lineTo(tx + w / 2, ty - hgt + (k + 1) * hgt / 18); x.stroke(); }
  x.lineWidth = 3 * sc; x.strokeStyle = "#cfd8e4"; x.beginPath(); x.moveTo(tx - w / 2, ty - hgt * 0.62); x.lineTo(tx - 40 * sc, ty - hgt * 0.62 - 6 * sc); x.moveTo(tx - w / 2, ty - hgt * 0.56); x.lineTo(tx - 40 * sc, ty - hgt * 0.56 - 5 * sc); x.stroke();
  const bl = 0.4 + 0.6 * (Math.sin(T * 3) > 0 ? 1 : 0.2); x.fillStyle = "rgba(255,60,60," + bl + ")"; x.beginPath(); x.arc(tx, ty - hgt - 3, 2.4, 0, 7); x.fill(); x.beginPath(); x.arc(tx, ty - hgt * 0.5, 2, 0, 7); x.fill();
}
export function drawStarbase(x: Cx, W: number, H: number, camX: number, T: number, kind: string) {
  const hy = H * 0.34; x.save();
  // dusk tint behind everything: magenta glow at the horizon, deep violet above
  const sky = x.createLinearGradient(0, 0, 0, hy + 20); sky.addColorStop(0, "rgba(30,10,70,.55)"); sky.addColorStop(0.6, "rgba(120,30,140,.35)"); sky.addColorStop(1, "rgba(255,60,170,.35)"); x.fillStyle = sky; x.fillRect(0, 0, W, hy + 20);
  // layer 1: far megacity, slow parallax
  const layer = (par: number, base: number, hMax: number, n: number, dark: string, seed: number) => {
    const off = (camX * par) % (W * 1.2);
    for (let i = -2; i < n + 2; i++) { const k = i + Math.floor(-camX * par / (W * 1.2 / n)); const bw = (W * 1.2 / n) * (0.7 + h(k + seed) * 0.5), bx = i * (W * 1.2 / n) + off, bh = hMax * (0.35 + h(k * 3.1 + seed) * 0.65);
      const g = x.createLinearGradient(0, base - bh, 0, base); g.addColorStop(0, dark); g.addColorStop(1, "#05030c"); x.fillStyle = g; x.fillRect(bx, base - bh, bw, bh);
      // lit windows
      for (let wy = base - bh + 6; wy < base - 4; wy += 7) for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) { const r = h(wx * 0.37 + wy * 1.7 + k); if (r > 0.62) { x.fillStyle = r > 0.9 ? NEON[Math.floor(r * 50) % 5] : "rgba(255,214,150,.75)"; x.fillRect(wx, wy, 2.2, 2.6); } }
      // neon edge and a vertical sign on some towers
      x.fillStyle = NEON[Math.floor(h(k + 9) * 5)]; x.globalAlpha = 0.7; x.fillRect(bx, base - bh, 1.4, bh); x.globalAlpha = 1;
      if (h(k + 4) > 0.55) { const col = NEON[Math.floor(h(k + 2) * 5)]; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 8; x.fillRect(bx + bw - 6, base - bh * 0.85, 3, bh * 0.4 * (0.7 + 0.3 * Math.sin(T * 2 + k))); x.shadowBlur = 0; }
      if (h(k + 6) > 0.8) { x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(bx + bw / 2, base - bh - 18, 1, 18); }
    } };
  layer(0.02, hy + 6, H * 0.2, 14, "#2a1650", 11); layer(0.05, hy + 22, H * 0.26, 11, "#190b38", 29);
  // the Starbase: towers, a Starship + booster, a second ship in the stack, and the gantry with its catch arms
  const bx = W * 0.62 - (camX * 0.07) % 30, by = hy + 34;
  tower(x, bx - 44, by, H / 220, T); starship(x, bx, by, H / 260, T, kind !== "x"); starship(x, bx + 70, by - 4, H / 340, T, false);
  // launch-mount legs and a flame trench glow
  x.fillStyle = "#2c3340"; x.fillRect(bx - 22, by - 6, 44, 8); x.fillStyle = "rgba(255,170,80,.35)"; x.fillRect(bx - 22, by + 2, 44, 2);
  // holo billboards
  for (let i = 0; i < 3; i++) { const hx = W * (0.12 + i * 0.3) - (camX * 0.06) % 40, hyy = hy - H * (0.2 + 0.05 * i), col = NEON[(i * 2) % 5], a = 0.5 + 0.3 * Math.sin(T * 1.6 + i); x.save(); x.globalAlpha = a; x.strokeStyle = col; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 12; x.lineWidth = 1.4; x.strokeRect(hx, hyy, 52, 24); x.globalAlpha = a * 0.25; x.fillRect(hx, hyy, 52, 24); x.globalAlpha = a; for (let k = 0; k < 3; k++) x.fillRect(hx + 5, hyy + 5 + k * 6, 14 + h(i * 7 + k + Math.floor(T)) * 28, 2); x.restore(); }
  // flying cars on sky lanes
  for (let i = 0; i < 12; i++) { const ly = hy - H * (0.04 + 0.2 * h(i * 5)), sp = 24 + 40 * h(i + 3), px = ((T * sp * (i % 2 ? 1 : -1) + i * 211) % (W + 120) + W + 120) % (W + 120) - 60, col = NEON[i % 5];
    x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 8; x.fillRect(px, ly, 7, 2.4); const tr = x.createLinearGradient(px, 0, px + (i % 2 ? -34 : 34), 0); tr.addColorStop(0, col); tr.addColorStop(1, "rgba(0,0,0,0)"); x.globalAlpha = 0.5; x.fillStyle = tr; x.fillRect(Math.min(px, px + (i % 2 ? -34 : 34)), ly + 0.4, 34, 1.4); x.globalAlpha = 1; x.shadowBlur = 0; }
  x.restore();
}
export function neonGrid(x: Cx, W: number, H: number, T: number, hot: boolean) {
  // ground light that pools along the street grid: drawn over the world, additive
  x.save(); x.globalCompositeOperation = "lighter"; const g = x.createLinearGradient(0, H * 0.36, 0, H); g.addColorStop(0, "rgba(255,40,190,.07)"); g.addColorStop(1, "rgba(30,220,255,.09)"); x.fillStyle = g; x.fillRect(0, H * 0.36, W, H); x.restore();
  void T; void hot;
}
export function cyberOverlay(x: Cx, W: number, H: number, T: number, kind: string) {
  x.save();
  // low fog, coloured by the site
  const fog = x.createLinearGradient(0, H * 0.28, 0, H * 0.5); fog.addColorStop(0, "rgba(120,60,200,0)"); fog.addColorStop(0.5, kind === "mars" ? "rgba(255,110,70,.14)" : "rgba(160,70,230,.14)"); fog.addColorStop(1, "rgba(60,20,120,0)"); x.fillStyle = fog; x.fillRect(0, H * 0.28, W, H * 0.22);
  // rain on the wet city (not on the airless Moon)
  if (kind !== "moon" && kind !== "titan") { x.strokeStyle = "rgba(170,210,255,.28)"; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < 90; i++) { const rx = (i * 83.7 + T * 40) % (W + 40) - 20, ry = ((i * 47.3 + T * 520) % (H + 40)) - 20; x.moveTo(rx, ry); x.lineTo(rx - 3, ry + 13); } x.stroke(); }
  // a faint scan texture and a cyan/magenta edge glow
  x.globalAlpha = 0.05; x.fillStyle = "#000"; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1); x.globalAlpha = 1;
  x.globalCompositeOperation = "lighter"; const e1 = x.createLinearGradient(0, 0, W * 0.08, 0); e1.addColorStop(0, "rgba(25,230,255,.16)"); e1.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = e1; x.fillRect(0, 0, W * 0.08, H);
  const e2 = x.createLinearGradient(W, 0, W * 0.92, 0); e2.addColorStop(0, "rgba(255,43,214,.16)"); e2.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = e2; x.fillRect(W * 0.92, 0, W * 0.08, H);
  x.restore();
}
