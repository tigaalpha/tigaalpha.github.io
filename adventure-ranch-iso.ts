/* The Space Ranch drawn as a bright isometric farm (owner, 2026-10-16, with FarmVille 3 screenshots: "I want it like this, copy it"). Nothing from that game is used or traced:
   this is our own code-drawn scene in the same family of look: a 2:1 isometric view, soft saturated grass, a stone path, white picket fences, a tilled field whose plots are
   packed with crops, a red barn and silo, small houses for each animal and a lake with a sand beach. The still scenery is painted ONCE per world into cached canvases
   (`isoBg` behind everything, `isoFg` for the front fence), and only plots, houses, animals, the windmill and the rocket are drawn per frame. */
export const VW = 800, VH = 450;                       // the viewport; the farm itself is a bigger world you pan and zoom over
export const WW = 1500, WH = 830, CS = 1.5;              // world size, and the resolution the cached scenery is painted at
const TW = 28, TH = 14, OX = 750, OY = 60;
export const P = (gx: number, gy: number): [number, number] => [OX + (gx - gy) * TW, OY + (gx + gy) * TH];
export const COLS = 6, ROWS = 4, FX = 6, FY = 3;         // the field: 6 x 4 plots of 2 x 2 tiles, the first eight are dug, the rest are grass to dig
export const PLOT_POS = (i: number) => { const c = i % COLS, r = Math.floor(i / COLS), [x, y] = P(FX + c * 2 + 1, FY + r * 2 + 1); return { x, y }; };
export const PLOT_FREE = (i: number) => (i % COLS) < 4 && Math.floor(i / COLS) < 2;
export const SLOT_POS = [P(2.6, 15.2), P(8.6, 15.2), P(2.6, 19.4), P(8.6, 19.4)].map(([x, y]) => ({ x, y }));   // cow, chicken, pig, sheep: a wide pen, each house well apart
export const PAD = { x: P(17, 17)[0], y: P(17, 17)[1] };
export const MILL = { x: P(21, 1)[0], y: P(21, 1)[1] };
const OUT = "rgba(70,40,14,.6)";

function poly(x: CanvasRenderingContext2D, pts: number[][], fill: string | CanvasGradient, stroke = OUT, lw = 1.3) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.lineJoin = "round"; x.stroke(); } }
const up = (p: number[], h: number) => [p[0], p[1] - h];
function diamond(x: CanvasRenderingContext2D, gx: number, gy: number, w: number, d: number, fill: string | CanvasGradient, stroke = "", lw = 1) { poly(x, [P(gx, gy), P(gx + w, gy), P(gx + w, gy + d), P(gx, gy + d)], fill, stroke, lw); }
function shadow(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.28) { x.fillStyle = "rgba(10,50,10," + a + ")"; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); }

/* A house with a gable roof, in world tiles: gradient walls with plank lines and ground occlusion, a roof with rows of rounded shingles, a thick eave and a lit ridge.
   `col` = [light wall, dark wall, roof, gable]; `deco` may draw a door / window on the two faces. */
function house(x: CanvasRenderingContext2D, gx: number, gy: number, w: number, d: number, h: number, rh: number, col: string[], trim = "#fff4dc", deco?: (f: { A: number[]; B: number[]; C: number[]; h: number; rh: number }) => void) {
  const A = P(gx, gy + d), B = P(gx + w, gy + d), C = P(gx + w, gy), o = 0.12;
  shadow(x, (A[0] + C[0]) / 2 + 10, (A[1] + C[1]) / 2 + 7, (w + d) * TW * 0.66, (w + d) * TH * 0.6, 0.3);
  const wallL = x.createLinearGradient(0, A[1] - h, 0, A[1]); wallL.addColorStop(0, shade(col[0], 1.08)); wallL.addColorStop(1, shade(col[0], 0.8));
  const wallR = x.createLinearGradient(0, B[1] - h, 0, B[1]); wallR.addColorStop(0, shade(col[1], 1.05)); wallR.addColorStop(1, shade(col[1], 0.72));
  poly(x, [A, B, up(B, h), up(A, h)], wallL, "rgba(50,25,10,.4)", 1);
  poly(x, [B, C, up(C, h), up(B, h)], wallR, "rgba(50,25,10,.4)", 1);
  x.strokeStyle = "rgba(60,30,10,.22)"; x.lineWidth = 1; for (let k = 1; k < Math.round(w * 4); k++) { const t = k / Math.round(w * 4), a = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(a[0], a[1] - h); x.stroke(); }
  for (let k = 1; k < Math.round(d * 4); k++) { const t = k / Math.round(d * 4), a = [B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t]; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(a[0], a[1] - h); x.stroke(); }
  const rf = P(gx + w, gy + d / 2), g0 = up(C, h), g1 = up(B, h), g2 = up(rf, h + rh);
  poly(x, [g0, g1, g2], shade(col[3], 0.95), "rgba(50,25,10,.4)", 1);
  deco && deco({ A, B, C, h, rh });
  const e0 = P(gx - o, gy + d + o), e1 = P(gx + w + o, gy + d + o), r0 = P(gx - o, gy + d / 2), r1 = P(gx + w + o, gy + d / 2);
  const rg = x.createLinearGradient(0, up(r0, h + rh)[1], 0, up(e0, h)[1]); rg.addColorStop(0, shade(col[2], 1.25)); rg.addColorStop(0.5, shade(col[2], 1)); rg.addColorStop(1, shade(col[2], 0.78));
  poly(x, [up(e0, h - 3), up(e1, h - 3), up(r1, h + rh), up(r0, h + rh)], rg, "rgba(40,20,8,.45)", 1.1);
  // rows of rounded shingles
  const rows = 6;
  for (let r = 1; r <= rows; r++) { const t = r / (rows + 1); const a = [e0[0] + (r0[0] - e0[0]) * t, e0[1] + (r0[1] - e0[1]) * t - (h - 3) - (rh + 3) * t], b = [e1[0] + (r1[0] - e1[0]) * t, e1[1] + (r1[1] - e1[1]) * t - (h - 3) - (rh + 3) * t], n = Math.round(w * 5 + 2);
    for (let k = 0; k < n; k++) { const u = (k + (r % 2) * 0.5) / n, px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u; x.strokeStyle = "rgba(30,12,4," + (0.18 + r * 0.02) + ")"; x.lineWidth = 1; x.beginPath(); x.arc(px, py - 1, 3.6, 0.1, Math.PI - 0.1); x.stroke(); } }
  x.strokeStyle = shade(col[2], 1.45); x.lineWidth = 2.4; x.lineCap = "round"; x.beginPath(); x.moveTo(up(r0, h + rh)[0], up(r0, h + rh)[1]); x.lineTo(up(r1, h + rh)[0], up(r1, h + rh)[1]); x.stroke();     // lit ridge
  x.strokeStyle = "rgba(30,12,4,.5)"; x.lineWidth = 2.2; x.beginPath(); x.moveTo(up(e0, h - 3)[0], up(e0, h - 3)[1] + 1.5); x.lineTo(up(e1, h - 3)[0], up(e1, h - 3)[1] + 1.5); x.stroke();                           // eave thickness
  x.strokeStyle = trim; x.lineWidth = 2; x.lineCap = "round"; x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(up(A, h)[0], up(A, h)[1]); x.moveTo(B[0], B[1]); x.lineTo(up(B, h)[0], up(B, h)[1]); x.moveTo(C[0], C[1]); x.lineTo(up(C, h)[0], up(C, h)[1]); x.stroke();
  return { A, B, C, h, rh };
}
function shade(hex: string, k: number) { const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))); return "rgb(" + c(n >> 16) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")"; }

function doorOnLeft(x: CanvasRenderingContext2D, f: { A: number[]; B: number[] }, u0: number, u1: number, hh: number, fill: string, trim: string) {
  const at = (u: number, hgt: number) => [f.A[0] + (f.B[0] - f.A[0]) * u, f.A[1] + (f.B[1] - f.A[1]) * u - hgt];
  poly(x, [at(u0 - 0.04, 0), at(u1 + 0.04, 0), at(u1 + 0.04, hh + 1.5), at(u0 - 0.04, hh + 1.5)], trim, "rgba(50,25,10,.4)", 1);
  poly(x, [at(u0, 0), at(u1, 0), at(u1, hh), at(u0, hh)], fill, "rgba(30,12,4,.5)", 1);
  x.strokeStyle = "rgba(255,244,220,.85)"; x.lineWidth = 1.3; x.beginPath(); const m = (u0 + u1) / 2; x.moveTo(at(m, 0)[0], at(m, 0)[1]); x.lineTo(at(m, hh)[0], at(m, hh)[1]); x.moveTo(at(u0, 0)[0], at(u0, 0)[1]); x.lineTo(at(m, hh)[0], at(m, hh)[1]); x.moveTo(at(u1, 0)[0], at(u1, 0)[1]); x.lineTo(at(m, hh)[0], at(m, hh)[1]); x.stroke();
}
function windowOnLeft(x: CanvasRenderingContext2D, f: { A: number[]; B: number[] }, u: number, hy: number, sz: number) {
  const at = (uu: number, hgt: number) => [f.A[0] + (f.B[0] - f.A[0]) * uu, f.A[1] + (f.B[1] - f.A[1]) * uu - hgt];
  poly(x, [at(u - sz, hy - sz * 14), at(u + sz, hy - sz * 14), at(u + sz, hy + sz * 14), at(u - sz, hy + sz * 14)], "#9fd8f4", "#fff4dc", 1.6);
  x.strokeStyle = "#fff4dc"; x.lineWidth = 1; x.beginPath(); x.moveTo(at(u, hy - sz * 14)[0], at(u, hy - sz * 14)[1]); x.lineTo(at(u, hy + sz * 14)[0], at(u, hy + sz * 14)[1]); x.stroke();
}
const BG: Record<string, HTMLCanvasElement> = {}, FG: Record<string, HTMLCanvasElement> = {};
function mk() { const c = document.createElement("canvas"); c.width = Math.round(WW * CS); c.height = Math.round(WH * CS); const x = c.getContext("2d")!; x.scale(CS, CS); return { c, x }; }

function tree(x: CanvasRenderingContext2D, R: () => number, tx: number, ty: number, s: number, apples = false) {
  shadow(x, tx + 12 * s, ty + 3, 34 * s, 9 * s, 0.3);
  const tg = x.createLinearGradient(tx - 5 * s, 0, tx + 5 * s, 0); tg.addColorStop(0, "#9a6a3c"); tg.addColorStop(1, "#5a3a1e"); x.fillStyle = tg; x.strokeStyle = OUT; x.lineWidth = 1.2; x.beginPath(); x.moveTo(tx - 5 * s, ty + 2); x.lineTo(tx - 3 * s, ty - 30 * s); x.lineTo(tx + 3 * s, ty - 30 * s); x.lineTo(tx + 5 * s, ty + 2); x.closePath(); x.fill(); x.stroke();
  for (let k = 0; k < 16; k++) { const a = R() * 6.28, d = R() * 24 * s, cx = tx + Math.cos(a) * d, cy = ty - 50 * s + Math.sin(a) * d * 0.8, r = (13 + R() * 9) * s, lg = x.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 1, cx, cy, r); lg.addColorStop(0, k % 3 ? "#a6ea62" : "#c6f57e"); lg.addColorStop(0.6, "#48b040"); lg.addColorStop(1, "#2a7a32"); x.fillStyle = lg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.strokeStyle = "rgba(25,90,35,.5)"; x.lineWidth = 1.2; x.stroke(); }
  if (apples) for (let k = 0; k < 8; k++) { const a = k * 0.8 + 0.4, ax = tx + Math.cos(a) * 20 * s, ay = ty - 48 * s + Math.sin(a) * 16 * s; x.fillStyle = "#e8352a"; x.beginPath(); x.arc(ax, ay, 3.4, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.75)"; x.beginPath(); x.arc(ax - 1, ay - 1, 1, 0, 7); x.fill(); }
}

function picket(x: CanvasRenderingContext2D, a: number[], b: number[], n: number) {
  const px = (t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  x.strokeStyle = "rgba(90,70,60,.55)"; x.lineWidth = 3.4; x.beginPath(); for (const hh of [5, 10]) { x.moveTo(a[0], a[1] - hh); x.lineTo(b[0], b[1] - hh); } x.stroke(); x.strokeStyle = "#fff"; x.lineWidth = 2.2; x.beginPath(); for (const hh of [5, 10]) { x.moveTo(a[0], a[1] - hh); x.lineTo(b[0], b[1] - hh); } x.stroke();
  for (let i = 0; i <= n; i++) { const p = px(i / n); x.fillStyle = "#fff"; x.strokeStyle = "rgba(90,70,60,.6)"; x.lineWidth = 1; x.beginPath(); x.moveTo(p[0] - 2.4, p[1]); x.lineTo(p[0] - 2.4, p[1] - 11); x.lineTo(p[0], p[1] - 13.5); x.lineTo(p[0] + 2.4, p[1] - 11); x.lineTo(p[0] + 2.6, p[1]); x.closePath(); x.fill(); x.stroke(); }
}

export function isoBg(kind: string): HTMLCanvasElement {
  if (BG[kind]) return BG[kind];
  const { c, x } = mk(); let sd = 11; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // grass: a bright meadow with soft light and shade
  const g = x.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, "#a4e868"); g.addColorStop(0.5, "#7cd24c"); g.addColorStop(1, "#62bd3e"); x.fillStyle = g; x.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 120; i++) { const px = R() * WW, py = R() * WH, rr = 40 + R() * 90, lg = x.createRadialGradient(px, py, 2, px, py, rr), lit = R() > 0.45; lg.addColorStop(0, lit ? "rgba(235,255,150,.28)" : "rgba(20,110,40,.2)"); lg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = lg; x.beginPath(); x.ellipse(px, py, rr * 1.6, rr * 0.8, 0, 0, 7); x.fill(); }
  const G5 = ["#3f9a36", "#58b744", "#74cc52", "#92dc62", "#b4ee7a"];
  for (let i = 0; i < 6500; i++) { const gx = R() * WW, gy = R() * WH, s = 4 + R() * 5; x.strokeStyle = G5[Math.floor(R() * 5)]; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + (R() - 0.5) * s, gy - s * 0.6, gx + (R() - 0.5) * s * 1.3, gy - s); x.stroke(); }
  // lake and sand on the right
  x.save(); x.translate(WW - 800, 90); x.scale(1, 1.55);
  const sand = x.createLinearGradient(680, 0, 800, 0); sand.addColorStop(0, "#f2e2a8"); sand.addColorStop(1, "#e0c880"); x.fillStyle = sand; x.beginPath(); x.moveTo(800, 96); x.quadraticCurveTo(704, 150, 716, 250); x.quadraticCurveTo(730, 350, 694, 450); x.lineTo(800, 450); x.closePath(); x.fill();
  const wt = x.createLinearGradient(720, 0, 800, 0); wt.addColorStop(0, "#9fe6f2"); wt.addColorStop(0.35, "#4fc0ea"); wt.addColorStop(1, "#2c8ed0"); x.fillStyle = wt; x.beginPath(); x.moveTo(800, 122); x.quadraticCurveTo(732, 170, 742, 256); x.quadraticCurveTo(756, 346, 724, 450); x.lineTo(800, 450); x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 2; for (let i = 0; i < 9; i++) { const wy = 160 + i * 34, wx = 760 + (i % 3) * 8; x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 10, wy - 4, wx + 22, wy); x.stroke(); }
  for (const [lx, ly] of [[770, 210], [784, 330], [756, 400]]) { x.fillStyle = "#4cb04a"; x.beginPath(); x.ellipse(lx, ly, 10, 5, 0, 0, 7); x.fill(); x.fillStyle = "#ff9ac8"; x.beginPath(); x.arc(lx + 2, ly - 2, 2.6, 0, 7); x.fill(); }
  for (let i = 0; i < 7; i++) { const rx = 726 + R() * 14, ry = 262 + i * 22; x.strokeStyle = "#5a8a2a"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx + 1, ry - 14 - R() * 6); x.stroke(); x.fillStyle = "#8a5a2a"; x.fillRect(rx - 1, ry - 20 - R() * 4, 3, 6); }
  x.restore();
  // stone path: in front of the barn, down the left of the field, and to the rocket pad
  const pathT: number[][] = []; for (let gx = 1; gx <= 22; gx++) pathT.push([gx, 2]); for (let gy = 3; gy <= 12; gy++) pathT.push([4, gy]); for (let gx = 5; gx <= 17; gx++) pathT.push([gx, 12]); for (let gy = 13; gy <= 15; gy++) pathT.push([17, gy]);
  for (const [gx, gy] of pathT) { diamond(x, gx + 0.04, gy + 0.04, 0.92, 0.92, "rgba(60,50,20,.2)"); const tg = x.createLinearGradient(0, P(gx, gy)[1], 0, P(gx + 1, gy + 1)[1]); tg.addColorStop(0, (gx + gy) % 2 ? "#ece0bc" : "#e2d4aa"); tg.addColorStop(1, "#c9b888"); diamond(x, gx + 0.02, gy + 0.02, 0.96, 0.96, tg, "rgba(120,100,60,.45)", 1); }
  // flowers
  const FC = ["#ff7ab8", "#ffffff", "#ffd23f", "#b48cff", "#ff8a5a"];
  for (let i = 0; i < 150; i++) { const fx = R() * (WW - 180), fy = 60 + R() * (WH - 70); for (let k = 0; k < 4; k++) { const ox = fx + (R() - 0.5) * 14, oy = fy + (R() - 0.5) * 8; x.strokeStyle = "#2f7a2c"; x.lineWidth = 1; x.beginPath(); x.moveTo(ox, oy + 5); x.lineTo(ox, oy); x.stroke(); x.fillStyle = FC[i % 5]; x.beginPath(); x.arc(ox, oy, 2.4, 0, 7); x.fill(); x.fillStyle = "#ffe36a"; x.beginPath(); x.arc(ox, oy, 0.9, 0, 7); x.fill(); } }
  // the field is plain meadow here: each dug plot is drawn per frame, and the plots still to dig show as dashed squares
  picket(x, P(FX - 0.6, FY - 0.6), P(FX + COLS * 2 + 0.6, FY - 0.6), 30); picket(x, P(FX - 0.6, FY - 0.6), P(FX - 0.6, FY + ROWS * 2 + 0.6), 20);
  // the pen: sandy floor, straw and a trough, back fences
  diamond(x, 0, 13, 13, 9, "#efd98a", "#fff", 2);
  const pg = x.createLinearGradient(0, P(0, 13)[1], 0, P(13, 22)[1]); pg.addColorStop(0, "rgba(255,240,170,.45)"); pg.addColorStop(1, "rgba(220,180,90,.35)"); diamond(x, 0, 13, 13, 9, pg);
  for (let i = 0; i < 120; i++) { const u = R() * 13, v = 13 + R() * 9, p = P(u, v); x.strokeStyle = i % 2 ? "#e8c24a" : "#c99a2e"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + (R() - 0.5) * 8, p[1] - 2 - R() * 3); x.stroke(); }
  { const t0 = P(6.2, 17.4); x.fillStyle = "rgba(0,0,0,.2)"; x.beginPath(); x.ellipse(t0[0] + 4, t0[1] + 8, 24, 7, 0, 0, 7); x.fill(); poly(x, [[t0[0] - 22, t0[1] + 2], [t0[0] + 20, t0[1] + 2], [t0[0] + 20, t0[1] - 6], [t0[0] - 22, t0[1] - 6]], "#a8754a"); poly(x, [[t0[0] - 20, t0[1] - 4], [t0[0] + 18, t0[1] - 4], [t0[0] + 18, t0[1] - 8], [t0[0] - 20, t0[1] - 8]], "#7ccdf0", ""); }
  picket(x, P(0, 13), P(13, 13), 36); picket(x, P(0, 13), P(0, 22), 24);
  // barn and silo
  { house(x, 2, 0, 3, 2, 28, 14, ["#f28c3a", "#c85a1e", "#8a4a32", "#d4682a"], "#fff4dc", (f) => { doorOnLeft(x, f, 0.32, 0.68, 19, "#8a3414", "#fff4dc"); windowOnLeft(x, f, 0.12, 14, 0.05); windowOnLeft(x, f, 0.88, 14, 0.05); const w0 = P(5, 1.0); poly(x, [[w0[0] - 5, w0[1] - 31], [w0[0] + 5, w0[1] - 36], [w0[0] + 5, w0[1] - 25], [w0[0] - 5, w0[1] - 20]], "#ffe9a8", "#fff4dc", 1.6); }); }
  { const [sx, sy] = P(0.9, 0.6); shadow(x, sx + 10, sy + 4, 26, 8, 0.3); const sg = x.createLinearGradient(sx - 17, 0, sx + 17, 0); sg.addColorStop(0, "#dfe9f2"); sg.addColorStop(0.5, "#ffffff"); sg.addColorStop(1, "#9db4c8"); x.fillStyle = sg; x.strokeStyle = "rgba(70,90,110,.7)"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(sx - 17, sy); x.lineTo(sx - 17, sy - 50); x.ellipse(sx, sy - 50, 17, 7, 0, Math.PI, 0); x.lineTo(sx + 17, sy); x.ellipse(sx, sy, 17, 7, 0, 0, Math.PI); x.closePath(); x.fill(); x.stroke(); x.fillStyle = "#c8442e"; x.beginPath(); x.ellipse(sx, sy - 52, 17, 8, 0, Math.PI, 0); x.lineTo(sx, sy - 66); x.closePath(); x.fill(); x.stroke(); x.strokeStyle = "rgba(90,110,130,.4)"; for (let k = 1; k < 5; k++) { x.beginPath(); x.ellipse(sx, sy - k * 10, 17, 6, 0, 0, Math.PI); x.stroke(); } }
  // hay bales, crates, a cart by the barn
  for (const [hx, hy] of [[5.4, 1.2], [5.9, 1.9], [5.5, 2.4]] as number[][]) { const p = P(hx, hy), hg = x.createLinearGradient(0, p[1] - 16, 0, p[1]); hg.addColorStop(0, "#f8dc6a"); hg.addColorStop(1, "#d4a838"); poly(x, [[p[0] - 12, p[1]], [p[0] + 12, p[1]], [p[0] + 12, p[1] - 14], [p[0] - 12, p[1] - 14]], hg); x.strokeStyle = "rgba(130,90,20,.5)"; x.beginPath(); x.moveTo(p[0] - 4, p[1]); x.lineTo(p[0] - 4, p[1] - 14); x.moveTo(p[0] + 5, p[1]); x.lineTo(p[0] + 5, p[1] - 14); x.stroke(); }
  // trees round the edges
  { // trees scattered over the meadow, kept off the barn, the field, the pen, the paths and the pad
    const bad = (gx: number, gy: number) => (gx > -1 && gx < 7 && gy > -1 && gy < 3.5) || (gx > 4.5 && gx < 19 && gy > 1.5 && gy < 13) || (gx > -1.5 && gx < 14 && gy > 11.5 && gy < 23) || (gx > 14 && gx < 20 && gy > 14 && gy < 20) || (gx > 18 && gx < 23 && gy > -1 && gy < 3.5);
    const ts: number[][] = []; let tries = 0;
    while (ts.length < 46 && tries++ < 900) { const px = 30 + R() * (WW - 60), py = 90 + R() * (WH - 100), gx = ((px - OX) / TW + (py - OY) / TH) / 2, gy = ((py - OY) / TH - (px - OX) / TW) / 2; if (bad(gx, gy) || px > WW - 170 && py > 220) continue; if (ts.some(t => Math.hypot(t[0] - px, (t[1] - py) * 1.6) < 80)) continue; ts.push([px, py, 0.7 + R() * 0.45, R() < 0.28 ? 1 : 0]); }
    ts.sort((a, b) => a[1] - b[1]); for (const [tx, ty, sc, ap] of ts) tree(x, R, tx, ty, sc, !!ap);
    // sunflower rows, barrels and crates by the barn, a scarecrow, a wheelbarrow, a mailbox and a pond with lilies: the farm gets lived-in
    const sf = (px: number, py: number, sc: number) => { x.strokeStyle = "#3a8a2a"; x.lineWidth = 2 * sc; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 22 * sc); x.stroke(); x.fillStyle = "#4aa832"; x.beginPath(); x.ellipse(px - 5 * sc, py - 9 * sc, 5 * sc, 2.4 * sc, -0.5, 0, 7); x.ellipse(px + 5 * sc, py - 12 * sc, 5 * sc, 2.4 * sc, 0.5, 0, 7); x.fill();
      for (let k = 0; k < 12; k++) { const an = k / 12 * 6.283; x.fillStyle = k % 2 ? "#ffd23a" : "#ffb81e"; x.beginPath(); x.ellipse(px + Math.cos(an) * 6.5 * sc, py - 24 * sc + Math.sin(an) * 6.5 * sc, 3.4 * sc, 2 * sc, an, 0, 7); x.fill(); }
      const cg = x.createRadialGradient(px - 1, py - 25 * sc, 0.5, px, py - 24 * sc, 5 * sc); cg.addColorStop(0, "#9a6a2a"); cg.addColorStop(1, "#4a2a10"); x.fillStyle = cg; x.beginPath(); x.arc(px, py - 24 * sc, 4.6 * sc, 0, 7); x.fill(); };
    for (let k = 0; k < 9; k++) { const q = P(0.4 + k * 0.55, 3.1); sf(q[0], q[1], 0.9 + (k % 3) * 0.08); }
    for (const [bx, by] of [[6.3, 0.4], [6.9, 1.0]] as number[][]) { const b = P(bx, by); shadow(x, b[0] + 4, b[1] + 3, 14, 5, 0.3); const bg2 = x.createLinearGradient(b[0] - 11, 0, b[0] + 11, 0); bg2.addColorStop(0, "#c9965a"); bg2.addColorStop(0.5, "#e8b878"); bg2.addColorStop(1, "#9a6a38"); x.fillStyle = bg2; x.strokeStyle = OUT; x.lineWidth = 1.1; x.beginPath(); x.roundRect(b[0] - 11, b[1] - 20, 22, 22, 5); x.fill(); x.stroke(); x.strokeStyle = "#5a5a64"; x.lineWidth = 2; for (const hy of [-14, -4]) { x.beginPath(); x.moveTo(b[0] - 11, b[1] + hy); x.lineTo(b[0] + 11, b[1] + hy); x.stroke(); } }
    { const c0 = P(7.8, 0.6); shadow(x, c0[0] + 4, c0[1] + 3, 16, 6, 0.3); poly(x, [[c0[0] - 14, c0[1] - 14], [c0[0] + 14, c0[1] - 14], [c0[0] + 14, c0[1] + 2], [c0[0] - 14, c0[1] + 2]], "#d8aa6a"); x.strokeStyle = "rgba(90,50,20,.5)"; x.lineWidth = 1; x.beginPath(); x.moveTo(c0[0] - 14, c0[1] - 7); x.lineTo(c0[0] + 14, c0[1] - 7); x.stroke(); for (const [ax, ay, ac] of [[-6, -17, "#e8352a"], [3, -18, "#ff9a2a"], [9, -16, "#7ad04a"]] as any[]) { x.fillStyle = ac; x.beginPath(); x.arc(c0[0] + ax, c0[1] + ay + 3, 4.4, 0, 7); x.fill(); } }
    { const sc = P(4.8, 5.2); shadow(x, sc[0] + 2, sc[1] + 2, 10, 4, 0.3); x.strokeStyle = "#7a5230"; x.lineWidth = 3; x.lineCap = "round"; x.beginPath(); x.moveTo(sc[0], sc[1]); x.lineTo(sc[0], sc[1] - 40); x.moveTo(sc[0] - 17, sc[1] - 30); x.lineTo(sc[0] + 17, sc[1] - 30); x.stroke(); poly(x, [[sc[0] - 8, sc[1] - 32], [sc[0] + 8, sc[1] - 32], [sc[0] + 6, sc[1] - 12], [sc[0] - 6, sc[1] - 12]], "#4a78c8"); x.fillStyle = "#f2d6a0"; x.strokeStyle = OUT; x.lineWidth = 1; x.beginPath(); x.arc(sc[0], sc[1] - 44, 7, 0, 7); x.fill(); x.stroke(); poly(x, [[sc[0] - 11, sc[1] - 47], [sc[0] + 11, sc[1] - 47], [sc[0] + 6, sc[1] - 58], [sc[0] - 6, sc[1] - 58]], "#c8a24a"); x.fillStyle = "#2a1a10"; x.beginPath(); x.arc(sc[0] - 2.5, sc[1] - 45, 1, 0, 7); x.arc(sc[0] + 2.5, sc[1] - 45, 1, 0, 7); x.fill(); }
    { const pc = P(21, 15.6); x.fillStyle = "rgba(10,60,30,.25)"; x.beginPath(); x.ellipse(pc[0] + 3, pc[1] + 5, 66, 26, 0, 0, 7); x.fill(); const sg2 = x.createRadialGradient(pc[0] - 10, pc[1] - 6, 4, pc[0], pc[1], 62); sg2.addColorStop(0, "#f2e2a8"); sg2.addColorStop(1, "#d8c27a"); x.fillStyle = sg2; x.beginPath(); x.ellipse(pc[0], pc[1], 62, 25, 0, 0, 7); x.fill(); const wg = x.createRadialGradient(pc[0] - 14, pc[1] - 8, 3, pc[0], pc[1], 54); wg.addColorStop(0, "#b6f0fa"); wg.addColorStop(0.5, "#56c4ec"); wg.addColorStop(1, "#2c8ed0"); x.fillStyle = wg; x.beginPath(); x.ellipse(pc[0], pc[1], 54, 20, 0, 0, 7); x.fill(); for (const [lx, ly] of [[-26, 3], [18, -5], [30, 6], [-4, 9]]) { x.fillStyle = "#4cb04a"; x.beginPath(); x.ellipse(pc[0] + lx, pc[1] + ly, 8, 3.6, 0, 0, 7); x.fill(); x.fillStyle = "#ff9ac8"; x.beginPath(); x.arc(pc[0] + lx + 1, pc[1] + ly - 1.5, 2.2, 0, 7); x.fill(); } for (let k = 0; k < 6; k++) { const rx = pc[0] - 58 + k * 22, ry = pc[1] + 14 + (k % 2) * 5; x.strokeStyle = "#5a8a2a"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx + 1, ry - 15); x.stroke(); x.fillStyle = "#8a5a2a"; x.fillRect(rx - 1, ry - 20, 3, 6); } }
    // a stone well, a signpost and flower beds beside the path
    const wl = P(5.4, 12.9); shadow(x, wl[0] + 6, wl[1] + 5, 22, 7, 0.3); x.fillStyle = "#b9b2a6"; x.strokeStyle = OUT; x.lineWidth = 1.2; x.beginPath(); x.ellipse(wl[0], wl[1] - 8, 14, 6, 0, 0, 7); x.fill(); x.stroke(); x.fillRect(wl[0] - 14, wl[1] - 8, 28, 10); x.strokeRect(wl[0] - 14, wl[1] - 8, 28, 10); x.fillStyle = "#4fb0e0"; x.beginPath(); x.ellipse(wl[0], wl[1] - 8, 11, 4, 0, 0, 7); x.fill(); x.fillStyle = "#8a4a32"; x.fillRect(wl[0] - 14, wl[1] - 30, 3, 22); x.fillRect(wl[0] + 11, wl[1] - 30, 3, 22); poly(x, [[wl[0] - 18, wl[1] - 30], [wl[0], wl[1] - 40], [wl[0] + 18, wl[1] - 30]], "#c8442e");
    for (const [gx, gy] of [[3.2, 2.9], [3.2, 4.2], [20, 12.6], [14.2, 13.2], [-0.4, 12.4]] as number[][]) { const q = P(gx, gy); for (let k = 0; k < 9; k++) { const fx = q[0] + (R() - 0.5) * 34, fy = q[1] + (R() - 0.5) * 12; x.fillStyle = ["#ff7ab8", "#ffd23f", "#ffffff", "#b48cff"][k % 4]; x.beginPath(); x.arc(fx, fy, 2.4, 0, 7); x.fill(); x.fillStyle = "#2f7a2c"; x.fillRect(fx - 0.5, fy, 1.2, 4); } }
  }
  // tint for the world
  const TINT: any = { moon: "", mars: "rgba(255,150,60,.16)", titan: "rgba(240,190,70,.18)", proxima: "rgba(255,90,80,.14)" }; if (TINT[kind]) { x.fillStyle = TINT[kind]; x.fillRect(0, 0, VW, VH); }
  BG[kind] = c; return c;
}

export function isoFg(kind: string): HTMLCanvasElement {
  if (FG[kind]) return FG[kind];
  const { c, x } = mk(); picket(x, P(0, 22), P(13, 22), 36); picket(x, P(13, 13), P(13, 22), 24);
  picket(x, P(FX + COLS * 2 + 0.6, FY - 0.6), P(FX + COLS * 2 + 0.6, FY + ROWS * 2 + 0.6), 20); picket(x, P(FX - 0.6, FY + ROWS * 2 + 0.6), P(FX + COLS * 2 + 0.6, FY + ROWS * 2 + 0.6), 30);
  for (const [gx, gy] of [[-0.8, 22.4], [13.6, 22.4], [13.6, 12.6], [5.2, 13.2]] as number[][]) { const [bx, by] = P(gx, gy); for (let k = 0; k < 4; k++) { const cx = bx + k * 9 - 14, cy = by - (k % 2) * 4, r = 10 + (k % 3) * 2, bg = x.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, r); bg.addColorStop(0, "#9ae45e"); bg.addColorStop(1, "#2f8a30"); x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.strokeStyle = "rgba(25,90,35,.5)"; x.stroke(); } }
  FG[kind] = c; return c;
}

/* ── per-frame pieces ── */
function crop(x: CanvasRenderingContext2D, id: string, st: number, px: number, py: number, T: number, ph: number, col: string) {
  const sw = Math.sin(T * 1.6 + ph) * 1.2;
  x.save(); x.translate(px, py); x.lineJoin = "round";
  const leaf = (lx: number, ly: number, rx: number, ry: number, rot: number, fill = "#3fcf4a") => { x.fillStyle = fill; x.strokeStyle = "#2a6a1a"; x.lineWidth = 1; x.beginPath(); x.ellipse(lx, ly, rx, ry, rot, 0, 7); x.fill(); x.stroke(); };
  if (st === 0) { leaf(-3, -2, 3, 1.6, -0.5); leaf(3, -2, 3, 1.6, 0.5); }
  else if (id === "carrot") { for (const a of [-0.7, -0.25, 0.25, 0.7]) leaf(a * 8 + sw, -7 - (st === 2 ? 3 : 0), 3, st === 1 ? 6 : 8, a); if (st === 2) { x.fillStyle = col; x.strokeStyle = "#a04a00"; x.beginPath(); x.moveTo(-4, -3); x.lineTo(4, -3); x.lineTo(0, 5); x.closePath(); x.fill(); x.stroke(); } }
  else if (id === "corn") { const hh = st === 1 ? 14 : 24; x.strokeStyle = "#2a8a2a"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(sw, -hh); x.stroke(); leaf(-6 + sw, -hh * 0.55, 7, 2.6, -0.6); leaf(6 + sw, -hh * 0.4, 7, 2.6, 0.6); if (st === 2) { x.fillStyle = col; x.strokeStyle = "#a07a00"; x.beginPath(); x.ellipse(4 + sw, -hh * 0.65, 3, 6, 0.3, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#3fcf4a"; x.beginPath(); x.ellipse(2 + sw, -hh * 0.55, 2, 6, 0.3, 0, 7); x.fill(); } }
  else if (id === "tomato") { leaf(-5 + sw, -6, 6, 5, 0); leaf(5 + sw, -6, 6, 5, 0); leaf(sw, -11, 5, 5, 0); if (st === 2) for (const [fx, fy] of [[-5, -4], [5, -4], [0, -9]]) { const rg = x.createRadialGradient(fx - 1, fy - 1, 0.5, fx, fy, 4); rg.addColorStop(0, "#ff9a8a"); rg.addColorStop(1, "#d02a1e"); x.fillStyle = rg; x.strokeStyle = "#7a1008"; x.beginPath(); x.arc(fx + sw, fy, 3.8, 0, 7); x.fill(); x.stroke(); } }
  else { leaf(-6, -3, 6, 3, -0.3); leaf(6, -3, 6, 3, 0.3); if (st === 2) { const rg = x.createRadialGradient(-2, -9, 1, 0, -7, 9); rg.addColorStop(0, "#ffc45a"); rg.addColorStop(1, "#e0731a"); x.fillStyle = rg; x.strokeStyle = "#8a4210"; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, -6, 8, 6.4, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.ellipse(0, -6, 3.2, 6.4, 0, 0, 7); x.stroke(); x.fillStyle = "#3f8a34"; x.fillRect(-1.5, -14, 3, 4); } }
  x.restore();
}
export function drawIsoPlot(x: CanvasRenderingContext2D, i: number, c: any, T: number, cropCol: string, digCost = 0, canDig = false) {
  const c0 = FX + (i % COLS) * 2, r0 = FY + Math.floor(i / COLS) * 2, wet = c.w > 0;
  if (c.locked) {
    const a = 0.55 + (canDig ? Math.sin(T * 4) * 0.2 : 0); x.save(); x.setLineDash([7, 5]); diamond(x, c0 + 0.06, r0 + 0.06, 1.88, 1.88, "rgba(120,80,40,.12)", "rgba(255,255,255," + a + ")", 2); x.setLineDash([]);
    const q = P(c0 + 1, r0 + 1); x.fillStyle = canDig ? "#ffb020" : "rgba(60,40,20,.7)"; x.strokeStyle = OUT; x.lineWidth = 1.4; x.beginPath(); x.roundRect(q[0] - 24, q[1] - 11, 48, 22, 11); x.fill(); x.stroke(); x.fillStyle = "#fff"; x.font = "bold 12px system-ui"; x.textAlign = "center"; x.fillText("⛏ " + digCost, q[0], q[1] + 4.5); x.restore(); return;
  }
  const sg = x.createLinearGradient(0, P(c0, r0)[1], 0, P(c0 + 2, r0 + 2)[1]); sg.addColorStop(0, wet ? "#6a4224" : "#8a5a30"); sg.addColorStop(1, wet ? "#4a2c16" : "#6a4222");
  diamond(x, c0 + 0.06, r0 + 0.06, 1.88, 1.88, sg, "rgba(255,225,170,.55)", 1.6);
  x.strokeStyle = "rgba(40,20,8,.35)"; x.lineWidth = 1.4; for (let k = 1; k < 4; k++) { const a = P(c0 + 0.15, r0 + k * 0.5), b = P(c0 + 1.85, r0 + k * 0.5); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  if (!c.crop) return;
  const st = c.p < 34 ? 0 : c.p < 100 ? 1 : 2, bob = st === 2 ? Math.abs(Math.sin(T * 5 + i)) * 1.5 : 0, ids = ["carrot", "corn", "tomato", "pumpkin"];
  void ids;
  for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) { const p = P(c0 + 0.3 + u * 0.47, r0 + 0.3 + v * 0.47); crop(x, c.crop, st, p[0], p[1] - bob, T, u * 1.3 + v * 0.7 + i, cropCol); }
  if (c.p < 100) { const q = P(c0 + 1, r0 + 2); x.fillStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.roundRect(q[0] - 22, q[1] + 2, 44, 7, 3); x.fill(); x.fillStyle = "#9bff6a"; x.beginPath(); x.roundRect(q[0] - 22, q[1] + 2, 44 * c.p / 100, 7, 3); x.fill(); }
  if (wet) { x.fillStyle = "rgba(120,190,255,.85)"; for (let k = 0; k < 4; k++) { const q = P(c0 + 0.5 + k * 0.4, r0 + 0.8); x.beginPath(); x.arc(q[0], q[1] - 10 + ((T * 30 + k * 9) % 16), 2, 0, 7); x.fill(); } }
}

export function drawIsoWindmill(x: CanvasRenderingContext2D, T: number) {
  const { x: mx, y: my } = MILL; shadow(x, mx + 12, my + 3, 30, 8, 0.3);
  const tg = x.createLinearGradient(mx - 16, 0, mx + 16, 0); tg.addColorStop(0, "#f4e8cc"); tg.addColorStop(1, "#c9b08a"); poly(x, [[mx - 16, my], [mx + 16, my], [mx + 9, my - 64], [mx - 9, my - 64]], tg);
  x.strokeStyle = "rgba(120,90,50,.4)"; for (let k = 1; k < 5; k++) { x.beginPath(); x.moveTo(mx - 15 + k * 0.6, my - k * 13); x.lineTo(mx + 15 - k * 0.6, my - k * 13); x.stroke(); }
  poly(x, [[mx - 12, my - 64], [mx, my - 80], [mx + 12, my - 64]], "#b0482e");
  x.fillStyle = "#3a261c"; x.beginPath(); x.roundRect(mx - 5, my - 14, 10, 14, [5, 5, 0, 0]); x.fill();
  x.save(); x.translate(mx, my - 62); x.rotate(T * 0.8); for (let k = 0; k < 4; k++) { x.rotate(Math.PI / 2); poly(x, [[-3, 0], [3, 0], [9, -42], [-9, -42]], k % 2 ? "#fff" : "#ffc45a"); } x.restore(); x.fillStyle = "#6a4a2a"; x.beginPath(); x.arc(mx, my - 62, 4.4, 0, 7); x.fill();
}
export function drawIsoPad(x: CanvasRenderingContext2D, launch: number, T: number) {
  const { x: px, y: py } = PAD; shadow(x, px + 4, py + 6, 52, 17, 0.3);
  const pg = x.createLinearGradient(0, py - 16, 0, py + 16); pg.addColorStop(0, "#e6edf6"); pg.addColorStop(1, "#aab6c8"); x.fillStyle = pg; x.strokeStyle = OUT; x.lineWidth = 1.4; x.beginPath(); x.ellipse(px, py, 48, 16, 0, 0, 7); x.fill(); x.stroke(); x.strokeStyle = "#ffb020"; x.lineWidth = 2; x.setLineDash([7, 5]); x.beginPath(); x.ellipse(px, py, 36, 11, 0, 0, 7); x.stroke(); x.setLineDash([]);
  const ry = py - 4 - (launch > 0 ? (1 - launch / 2) * 380 : 0); x.save(); x.translate(px, ry); x.scale(0.92, 0.92);
  x.fillStyle = "#fff"; x.strokeStyle = OUT; x.lineWidth = 1.4; x.beginPath(); x.moveTo(0, -58); x.quadraticCurveTo(22, -28, 16, 4); x.lineTo(-16, 4); x.quadraticCurveTo(-22, -28, 0, -58); x.fill(); x.stroke();
  x.fillStyle = "#ff5a4a"; x.beginPath(); x.moveTo(0, -58); x.quadraticCurveTo(10, -48, 12, -38); x.lineTo(-12, -38); x.quadraticCurveTo(-10, -48, 0, -58); x.fill(); x.stroke(); x.fillStyle = "#6cc3ff"; x.beginPath(); x.arc(0, -22, 8, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#ff5a4a"; poly(x, [[-16, 4], [-26, 8], [-16, -10]], "#ff5a4a"); poly(x, [[16, 4], [26, 8], [16, -10]], "#ff5a4a");
  if (launch > 0) { x.fillStyle = "rgba(255,170,60,.92)"; x.beginPath(); x.moveTo(-10, 4); x.lineTo(0, 4 + 30 + 10 * Math.sin(T * 30)); x.lineTo(10, 4); x.fill(); } x.restore();
}

/* An animal's house: a foundation with a price, then a house that rises over a few seconds, then (when bought) a price tag for the animal. `a.x, a.y` is the centre of its footprint. */
export function drawIsoHouse(x: CanvasRenderingContext2D, a: any, H: { b: number; own: boolean }, i: number, stock: number, T: number, houseCost: number[], buyCost: number[]) {
  const cx = a.x, cy = a.y, w = 1.4;
  const gx = 0, gy = 0; void gx; void gy;
  // a local drawing frame: world tile (0,0) sits at the footprint's back corner
  const ox = cx - (w - w) * TW, oy = cy - w * TH; x.save(); x.translate(ox - OX, oy - OY);
  if (H.b <= 0) {
    x.setLineDash([6, 5]); x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = 2; const A = P(0, 0), B = P(w, 0), C = P(w, w), D = P(0, w); x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.lineTo(C[0], C[1]); x.lineTo(D[0], D[1]); x.closePath(); x.stroke(); x.setLineDash([]); x.fillStyle = "rgba(255,255,255,.22)"; x.fill(); x.restore();
    const ok = stock >= houseCost[i], pulse = ok ? 1 + Math.sin(T * 5) * 0.06 : 1; x.save(); x.translate(cx, cy - 6); x.scale(pulse, pulse); x.fillStyle = ok ? "#ffb020" : "rgba(60,40,20,.78)"; x.strokeStyle = OUT; x.lineWidth = 1.5; x.beginPath(); x.roundRect(-36, -13, 72, 26, 13); x.fill(); x.stroke(); x.fillStyle = ok ? "#3a2410" : "#fff"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText("🔨 " + houseCost[i] + " 🌾", 0, 5); x.restore(); return;
  }
  const prog = Math.min(1, H.b); x.save(); if (prog < 1) { x.beginPath(); { const top = OY - 30, bot = OY + 2 * w * TH + 4; x.rect(-1000, top + (bot - top) * (1 - prog), 3000, 3000); } x.clip(); }
  const kind = a.id, cols: any = { cow: ["#f08a3a", "#c85a1e", "#8a4a32", "#d4682a"], chicken: ["#9ad4f6", "#6aaee0", "#d8442e", "#82c0ec"], pig: ["#c99a64", "#946a3c", "#7a5a3a", "#b08450"], sheep: ["#f0e4c8", "#c9b890", "#e0be5a", "#dccfae"] };
  house(x, 0, 0, w, w, 24, 7, cols[kind] || cols.cow, "#fff4dc", (f) => { if (kind === "chicken") { doorOnLeft(x, f, 0.4, 0.62, 9, "#3a2216", "#fff4dc"); windowOnLeft(x, f, 0.78, 12, 0.06); } else if (kind === "pig") { doorOnLeft(x, f, 0.3, 0.7, 11, "#2a1a10", "#e8c48c"); } else if (kind === "sheep") { doorOnLeft(x, f, 0.3, 0.7, 11, "#3a2a1a", "#fff4dc"); windowOnLeft(x, f, 0.12, 12, 0.05); } else { doorOnLeft(x, f, 0.32, 0.68, 12, "#7a2e12", "#fff4dc"); } });
  x.restore(); x.restore();
  if (H.b < 1) { x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(cx - 30, cy - 58, 60, 7); x.fillStyle = "#ffd23f"; x.fillRect(cx - 30, cy - 58, 60 * H.b, 7); x.font = "16px system-ui"; x.textAlign = "center"; x.fillText("🔨", cx + 40, cy - 46 + Math.sin(T * 12) * 3); return; }
  if (!H.own) { const ok = stock >= buyCost[i], pulse = 1 + Math.sin(T * 4) * 0.05; x.save(); x.translate(cx, cy - 60); x.scale(pulse, pulse); x.fillStyle = ok ? "#fff" : "rgba(255,255,255,.75)"; x.strokeStyle = ok ? "#e8a010" : OUT; x.lineWidth = 1.8; x.beginPath(); x.roundRect(-38, -13, 76, 26, 13); x.fill(); x.stroke(); x.fillStyle = "#222"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText(a.prod + " " + buyCost[i] + " 🌾", 0, 5); x.restore(); }
}

/* ── animals: 3/4 side view facing right, shaded like soft 3D, drawn at the origin = the feet-line centre ── */
function blob(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, light: string, dark: string, rot = 0, line = "rgba(60,35,20,.35)") {
  const g = x.createRadialGradient(cx - rx * 0.35, cy - ry * 0.5, 1, cx, cy, Math.max(rx, ry) * 1.15); g.addColorStop(0, light); g.addColorStop(1, dark);
  x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fill(); if (line) { x.strokeStyle = line; x.lineWidth = 1; x.stroke(); }
}
let BLINK = 0;
/* A big, glossy, friendly eye: a dark iris with a warm ring, two catch-lights, and a blink now and then. */
function eye(x: CanvasRenderingContext2D, ex: number, ey: number, r: number) {
  const R = r * 1.2;
  if (BLINK) { x.strokeStyle = "#2a1a12"; x.lineWidth = Math.max(1, r * 0.5); x.lineCap = "round"; x.beginPath(); x.moveTo(ex - R, ey); x.quadraticCurveTo(ex, ey + R * 0.7, ex + R, ey); x.stroke(); return; }
  x.fillStyle = "#fff"; x.strokeStyle = "rgba(40,24,14,.45)"; x.lineWidth = 0.8; x.beginPath(); x.ellipse(ex, ey, R * 1.1, R * 1.15, 0, 0, 7); x.fill(); x.stroke();
  const ig = x.createRadialGradient(ex + R * 0.2, ey - R * 0.1, 0.5, ex + R * 0.25, ey, R * 0.95); ig.addColorStop(0, "#7a4a2a"); ig.addColorStop(0.55, "#2e1a10"); ig.addColorStop(1, "#140a06"); x.fillStyle = ig; x.beginPath(); x.arc(ex + R * 0.22, ey + R * 0.05, R * 0.82, 0, 7); x.fill();
  x.fillStyle = "#fff"; x.beginPath(); x.arc(ex + R * 0.5, ey - R * 0.38, R * 0.3, 0, 7); x.fill(); x.beginPath(); x.arc(ex - R * 0.05, ey + R * 0.32, R * 0.14, 0, 7); x.fill();
}
/* rosy cheek and a tiny shine on a nose: the "cute" finish */
function blush(x: CanvasRenderingContext2D, cx: number, cy: number, r: number) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, "rgba(255,110,130,.55)"); g.addColorStop(1, "rgba(255,110,130,0)"); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
function leg(x: CanvasRenderingContext2D, lx: number, ly: number, w: number, h: number, col: string, hoof: string) { const g = x.createLinearGradient(lx - w, 0, lx + w, 0); g.addColorStop(0, shade(col, 1.06)); g.addColorStop(1, shade(col, 0.78)); x.fillStyle = g; x.beginPath(); x.roundRect(lx - w / 2, ly, w, h, w / 2.2); x.fill(); x.fillStyle = hoof; x.beginPath(); x.roundRect(lx - w / 2 - 0.5, ly + h - 3.4, w + 1, 3.6, 1.6); x.fill(); }

export function drawIsoAnimal(x: CanvasRenderingContext2D, id: string, T: number, i: number) {
  const br = Math.sin(T * 2 + i) * 0.7, graze = Math.max(0, Math.sin(T * 0.9 + i * 1.7)) * 4;
  BLINK = ((T * 0.8 + i * 1.7) % 4) > 3.82 ? 1 : 0;
  x.lineJoin = "round"; x.lineCap = "round";
  if (id === "cow") {
    leg(x, -19, 6, 6, 15, "#cdbfae", "#2a1a12"); leg(x, 13, 6, 6, 15, "#cdbfae", "#2a1a12");                    // far legs
    x.save(); x.beginPath(); x.ellipse(0, -3 + br, 29, 17, 0, 0, 7); x.clip();
    const bg = x.createRadialGradient(-8, -14, 2, 0, -2, 34); bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.6, "#efe6dc"); bg.addColorStop(1, "#bdb0a2"); x.fillStyle = bg; x.fillRect(-40, -30, 80, 60);
    x.fillStyle = "#2a2522"; for (const [px, py, rx, ry, r] of [[-12, -10, 11, 8, 0.3], [6, 3, 9, 7, -0.4], [-20, 4, 6, 5, 0.2], [18, -9, 6, 5, 0.5]] as number[][]) { x.beginPath(); x.ellipse(px, py + br, rx, ry, r, 0, 7); x.fill(); }
    const sh = x.createLinearGradient(0, -20, 0, 14); sh.addColorStop(0, "rgba(255,255,255,.25)"); sh.addColorStop(1, "rgba(60,40,30,.28)"); x.fillStyle = sh; x.fillRect(-40, -30, 80, 60); x.restore();
    x.strokeStyle = "rgba(60,40,30,.4)"; x.lineWidth = 1; x.beginPath(); x.ellipse(0, -3 + br, 29, 17, 0, 0, 7); x.stroke();
    blob(x, -14, 12, 5, 3.4, "#ffc4c4", "#e69a9a", 0, "");                                                                 // udder
    leg(x, -12, 8, 7, 16, "#f4ece2", "#2a1a12"); leg(x, 21, 8, 7, 16, "#f4ece2", "#2a1a12");                  // near legs
    x.strokeStyle = "#cfc4b6"; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-28, -8 + br); x.quadraticCurveTo(-36 + Math.sin(T * 3 + i) * 3, 2, -33 + Math.sin(T * 3 + i) * 4, 14); x.stroke(); blob(x, -33 + Math.sin(T * 3 + i) * 4, 15, 2.6, 4.2, "#3a2f2a", "#1a1512", 0, "");  // tail
    x.save(); x.translate(27, -9 + br + graze * 0.4); x.rotate(graze * 0.04);
    blob(x, 4, 2, 9, 12, "#f6eee4", "#c9bcae", 0.5);                                                                          // neck
    x.fillStyle = "#e8b030"; x.strokeStyle = "#8a5a10"; x.lineWidth = 1; x.beginPath(); x.arc(5, 15 + graze * 0.2, 3.6, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#fff6c8"; x.beginPath(); x.arc(4, 14, 1.1, 0, 7); x.fill();   // cow bell
    blob(x, 12, 6 + graze * 0.4, 11, 9.5, "#fbf4ea", "#d2c6b8", 0.25);                                                        // head
    blob(x, 20, 11 + graze * 0.4, 7, 5.6, "#ffcfc8", "#e9a39b", 0.2); x.fillStyle = "#b86a64"; x.beginPath(); x.ellipse(22, 10.5 + graze * 0.4, 1.1, 1.5, 0, 0, 7); x.ellipse(26, 11.5 + graze * 0.4, 1.1, 1.5, 0, 0, 7); x.fill();
    x.fillStyle = "#2a2522"; x.beginPath(); x.ellipse(8, 1.5, 4.5, 3.4, 0.3, 0, 7); x.fill();                                    // face patch
    blob(x, 2, -4, 5.5, 3, "#f0e6da", "#cbbfb0", -0.5); blob(x, 7, -7, 3.2, 2, "#f8f0e6", "#d8ccbc", 0.1);                      // ear + horn base
    x.fillStyle = "#f3e6c4"; x.beginPath(); x.moveTo(8, -7); x.quadraticCurveTo(10, -13, 14, -13); x.quadraticCurveTo(12, -10, 11, -6); x.fill();   // horn
    eye(x, 14, 3 + graze * 0.4, 1.9); blush(x, 15, 9 + graze * 0.4, 4.2); x.restore();
  } else if (id === "chicken") {
    const peck = Math.max(0, Math.sin(T * 3 + i * 2)) * 5;
    for (const [lx, c] of [[-2, "#e89a2a"], [4, "#f2b33a"]] as [number, string][]) { x.strokeStyle = c; x.lineWidth = 2; x.beginPath(); x.moveTo(lx, 6); x.lineTo(lx + 0.5, 15); x.moveTo(lx + 0.5, 15); x.lineTo(lx + 4.5, 16.5); x.moveTo(lx + 0.5, 15); x.lineTo(lx - 3, 16.5); x.moveTo(lx + 0.5, 15); x.lineTo(lx + 1.5, 17); x.stroke(); }
    for (const [a, c] of [[-0.9, "#d8cfc2"], [-0.55, "#ece4d8"], [-0.2, "#c4b8a8"]] as [number, string][]) { x.save(); x.translate(-11, -3); x.rotate(a); blob(x, -6, 0, 10, 3.6, c, shade(c, 0.78), 0, "rgba(60,40,30,.3)"); x.restore(); }  // tail feathers
    blob(x, 0, -1 + br * 0.5, 13, 11, "#ffffff", "#d9cfc2", -0.1);                                                              // body
    blob(x, -2, 1, 8, 5.6, "#f3ebe0", "#c6bba9", -0.15, "rgba(60,40,30,.3)"); x.strokeStyle = "rgba(120,100,80,.35)"; x.lineWidth = 1; x.beginPath(); x.arc(-4, 1, 4, 0.3, 2.6); x.stroke(); // wing
    x.save(); x.translate(9, -9 + peck); x.rotate(peck * 0.07);
    blob(x, 0, -1, 5.6, 6.4, "#ffffff", "#d9cfc2");                                                                             // head
    x.fillStyle = "#e23a2a"; for (const [cx, cy, r] of [[-1.5, -8, 2.4], [1, -9, 2.8], [3.4, -7.4, 2.2]] as number[][]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }   // comb
    x.fillStyle = "#f0a020"; x.beginPath(); x.moveTo(5, -1); x.lineTo(10.5, 0.6); x.lineTo(5, 2.6); x.closePath(); x.fill();
    blob(x, 4.2, 4.2, 1.8, 2.8, "#e23a2a", "#b0201a", 0, "");                                                                  // wattle
    eye(x, 2.4, -2, 1.4); blush(x, 1.6, 3, 3); x.restore();
  } else if (id === "pig") {
    leg(x, -14, 6, 6, 12, "#e89aae", "#6a3a40"); leg(x, 13, 6, 6, 12, "#e89aae", "#6a3a40");
    x.strokeStyle = "#e07a94"; x.lineWidth = 2; x.beginPath(); x.arc(-27, -2 + br, 4, 0.5, 5.6); x.stroke();                     // curly tail
    blob(x, 0, -2 + br, 27, 16, "#ffc2d0", "#e58aa2", 0);
    x.fillStyle = "rgba(255,255,255,.22)"; x.beginPath(); x.ellipse(-4, -9 + br, 16, 4.6, 0, 0, 7); x.fill();
    leg(x, -7, 8, 7, 12, "#ffc2d0", "#7a4650"); leg(x, 18, 8, 7, 12, "#ffc2d0", "#7a4650");
    x.save(); x.translate(24, -3 + br + graze * 0.3);
    blob(x, 4, 2, 11, 10.5, "#ffc9d6", "#e891a8", 0.1);                                                                         // head
    blob(x, 14, 5.4, 6, 4.8, "#ffb0c4", "#e07a96", 0); x.fillStyle = "#b8506a"; x.beginPath(); x.ellipse(13.5, 5.2, 1.1, 1.7, 0, 0, 7); x.ellipse(17, 5.6, 1.1, 1.7, 0, 0, 7); x.fill();   // snout
    x.fillStyle = "#e58aa2"; x.strokeStyle = "rgba(100,40,60,.4)"; x.beginPath(); x.moveTo(0, -6); x.quadraticCurveTo(-3, -14, 4, -12); x.quadraticCurveTo(7, -9, 6, -5); x.closePath(); x.fill(); x.stroke();  // floppy ear
    eye(x, 8, 0, 1.9); blush(x, 9, 6, 4.2); x.restore();
  } else {
    leg(x, -10, 9, 3.6, 13, "#4a3f3a", "#2a2220"); leg(x, 10, 9, 3.6, 13, "#4a3f3a", "#2a2220");
    const wool = [[-16, -6, 10], [-6, -12, 11], [6, -12, 11], [16, -6, 10], [-18, 4, 9], [-8, 5, 11], [4, 6, 11], [15, 4, 10], [-2, -3, 12], [-12, -1, 11], [9, -2, 11]] as number[][];
    for (const [wx, wy, r] of wool) { const g = x.createRadialGradient(wx - r * 0.3, wy - r * 0.4 + br, 1, wx, wy + br, r); g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#f1ede6"); g.addColorStop(1, "#cfc9bf"); x.fillStyle = g; x.beginPath(); x.arc(wx, wy + br, r, 0, 7); x.fill(); x.strokeStyle = "rgba(120,110,95,.28)"; x.lineWidth = 1; x.stroke(); }
    x.save(); x.translate(21, -2 + br + graze * 0.4);
    blob(x, 4, 0, 7, 8, "#5a4e48", "#2e2622", 0.25);
    blob(x, -2, -5, 4.4, 2.2, "#4a3f3a", "#2a2220", -0.6); eye(x, 6, -1.4, 1.7); blush(x, 7, 4, 3.4);
    x.fillStyle = "#e9a8a8"; x.beginPath(); x.ellipse(8.6, 3.4, 1.8, 1.2, 0, 0, 7); x.fill();
    blob(x, 0, -8, 6.5, 4, "#ffffff", "#d9d3c8", 0); x.restore();
  }
}

/* Life over the whole farm, drawn per frame: slow cloud shadows, birds, drifting pollen, ducks on the pond and a rippling pond. Cheap strokes and a few ellipses only. */
export function drawIsoAmbient(x: CanvasRenderingContext2D, T: number) {
  x.save();
  for (let i = 0; i < 4; i++) { const cx = ((T * 9 + i * 420) % (WW + 500)) - 250, cy = 160 + i * 190 + Math.sin(T * 0.1 + i) * 30, g = x.createRadialGradient(cx, cy, 10, cx, cy, 170); g.addColorStop(0, "rgba(30,70,40,.13)"); g.addColorStop(1, "rgba(30,70,40,0)"); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, 230, 110, 0, 0, 7); x.fill(); }
  const pc = P(21, 15.6);
  x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 1.3; for (let k = 0; k < 2; k++) { const r = ((T * 0.5 + k * 0.5) % 1); x.globalAlpha = 1 - r; x.beginPath(); x.ellipse(pc[0] - 8, pc[1] + 2, 10 + r * 26, 4 + r * 10, 0, 0, 7); x.stroke(); } x.globalAlpha = 1;
  for (let k = 0; k < 2; k++) { const dx = pc[0] + Math.sin(T * 0.4 + k * 2.4) * 30 - 6 + k * 14, dy = pc[1] + Math.cos(T * 0.5 + k) * 7 + k * 3, face = Math.cos(T * 0.4 + k * 2.4) > 0 ? 1 : -1; x.save(); x.translate(dx, dy); x.scale(face, 1); x.fillStyle = "rgba(10,50,60,.25)"; x.beginPath(); x.ellipse(1, 4, 11, 3, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.strokeStyle = "rgba(60,60,70,.45)"; x.lineWidth = 0.8; x.beginPath(); x.ellipse(0, 0, 9, 5.4, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.arc(8, -6, 4.2, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#ffa21e"; x.beginPath(); x.moveTo(11.5, -6.5); x.lineTo(16, -5.4); x.lineTo(11.5, -4); x.fill(); x.fillStyle = "#222"; x.beginPath(); x.arc(9, -7, 0.9, 0, 7); x.fill(); x.restore(); }
  x.strokeStyle = "rgba(40,40,50,.8)"; x.lineWidth = 1.6; x.lineCap = "round";
  for (let i = 0; i < 3; i++) { const bx = ((T * 38 + i * 560) % (WW + 200)) - 100, by = 80 + i * 130 + Math.sin(T * 1.2 + i) * 14, fl = Math.sin(T * 9 + i * 2) * 5; x.beginPath(); x.moveTo(bx - 8, by - fl); x.quadraticCurveTo(bx - 3, by - 5 - fl, bx, by); x.quadraticCurveTo(bx + 3, by - 5 + fl, bx + 8, by + fl); x.stroke(); }
  for (let i = 0; i < 26; i++) { const px = (i * 173 + T * (6 + (i % 5) * 2)) % WW, py = 60 + ((i * 97 + Math.sin(T * 0.6 + i) * 20 + T * 3) % (WH - 80)); x.fillStyle = "rgba(255,250,200," + (0.35 + 0.3 * Math.sin(T * 2 + i)) + ")"; x.beginPath(); x.arc(px, py, 1.5 + (i % 3) * 0.5, 0, 7); x.fill(); }
  x.restore();
}
