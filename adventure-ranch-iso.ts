/* The Space Ranch drawn as a bright isometric farm (owner, 2026-10-16, with FarmVille 3 screenshots: "I want it like this, copy it"). Nothing from that game is used or traced:
   this is our own code-drawn scene in the same family of look: a 2:1 isometric view, soft saturated grass, a stone path, white picket fences, a tilled field whose plots are
   packed with crops, a red barn and silo, small houses for each animal and a lake with a sand beach. The still scenery is painted ONCE per world into cached canvases
   (`isoBg` behind everything, `isoFg` for the front fence), and only plots, houses, animals, the windmill and the rocket are drawn per frame. */
export const VW = 800, VH = 450;
const TW = 28, TH = 14, OX = 400, OY = 50;
export const P = (gx: number, gy: number): [number, number] => [OX + (gx - gy) * TW, OY + (gx + gy) * TH];
export const PLOT_POS = (i: number) => { const c = i % 4, r = Math.floor(i / 4), [x, y] = P(4 + c * 2 + 1, 4 + r * 2 + 1); return { x, y }; };
export const SLOT_POS = [P(1.5, 10.2), P(4.5, 10.2), P(1.5, 12.2), P(4.5, 12.2)].map(([x, y]) => ({ x, y }));   // cow, chicken, pig, sheep
export const PAD = { x: P(9, 10)[0], y: P(9, 10)[1] };
export const MILL = { x: P(11, 1)[0], y: P(11, 1)[1] };
const OUT = "rgba(70,40,14,.6)";

function poly(x: CanvasRenderingContext2D, pts: number[][], fill: string | CanvasGradient, stroke = OUT, lw = 1.3) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.lineJoin = "round"; x.stroke(); } }
const up = (p: number[], h: number) => [p[0], p[1] - h];
function diamond(x: CanvasRenderingContext2D, gx: number, gy: number, w: number, d: number, fill: string | CanvasGradient, stroke = "", lw = 1) { poly(x, [P(gx, gy), P(gx + w, gy), P(gx + w, gy + d), P(gx, gy + d)], fill, stroke, lw); }
function shadow(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.28) { x.fillStyle = "rgba(10,50,10," + a + ")"; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); }

/* A box with a gable roof, in world tiles. Walls and roof colours are given as [light face, dark face, roof, gable]. */
function house(x: CanvasRenderingContext2D, gx: number, gy: number, w: number, d: number, h: number, rh: number, col: string[], trim = "#fff4dc") {
  const A = P(gx, gy + d), B = P(gx + w, gy + d), C = P(gx + w, gy), o = 0.18;
  shadow(x, (A[0] + C[0]) / 2 + 8, (A[1] + C[1]) / 2 + 6, (w + d) * TW * 0.62, (w + d) * TH * 0.55, 0.3);
  poly(x, [A, B, up(B, h), up(A, h)], col[0]);                                                  // front-left wall
  poly(x, [B, C, up(C, h), up(B, h)], col[1]);                                                  // front-right wall
  const rf = P(gx + w, gy + d / 2), g0 = up(C, h), g1 = up(B, h), g2 = up(rf, h + rh);          // right gable
  poly(x, [g0, g1, g2], col[3]);
  const e0 = P(gx - o, gy + d + o), e1 = P(gx + w + o, gy + d + o), r0 = P(gx - o, gy + d / 2), r1 = P(gx + w + o, gy + d / 2);
  const rg = x.createLinearGradient(0, up(r0, h + rh)[1], 0, up(e0, h)[1]); rg.addColorStop(0, shade(col[2], 1.18)); rg.addColorStop(1, shade(col[2], 0.82));
  poly(x, [up(e0, h - 2), up(e1, h - 2), up(r1, h + rh), up(r0, h + rh)], rg);                  // roof slope facing us
  x.strokeStyle = "rgba(40,20,8,.35)"; x.lineWidth = 1; for (let k = 1; k < 4; k++) { const t = k / 4, a = [e0[0] + (r0[0] - e0[0]) * t, e0[1] + (r0[1] - e0[1]) * t - (h - 2) - (rh + 2) * t], b = [e1[0] + (r1[0] - e1[0]) * t, e1[1] + (r1[1] - e1[1]) * t - (h - 2) - (rh + 2) * t]; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  x.strokeStyle = trim; x.lineWidth = 2; x.beginPath(); x.moveTo(up(A, 0)[0], up(A, 0)[1]); x.lineTo(up(A, h)[0], up(A, h)[1]); x.moveTo(B[0], B[1]); x.lineTo(up(B, h)[0], up(B, h)[1]); x.moveTo(C[0], C[1]); x.lineTo(up(C, h)[0], up(C, h)[1]); x.stroke();
  return { A, B, C, h, rh };
}
function shade(hex: string, k: number) { const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))); return "rgb(" + c(n >> 16) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")"; }

const BG: Record<string, HTMLCanvasElement> = {}, FG: Record<string, HTMLCanvasElement> = {};
function mk() { const c = document.createElement("canvas"); c.width = VW * 2; c.height = VH * 2; const x = c.getContext("2d")!; x.scale(2, 2); return { c, x }; }

function tree(x: CanvasRenderingContext2D, R: () => number, tx: number, ty: number, s: number, apples = false) {
  shadow(x, tx + 12 * s, ty + 3, 34 * s, 9 * s, 0.3);
  const tg = x.createLinearGradient(tx - 5 * s, 0, tx + 5 * s, 0); tg.addColorStop(0, "#9a6a3c"); tg.addColorStop(1, "#5a3a1e"); x.fillStyle = tg; x.strokeStyle = OUT; x.lineWidth = 1.2; x.beginPath(); x.moveTo(tx - 5 * s, ty + 2); x.lineTo(tx - 3 * s, ty - 30 * s); x.lineTo(tx + 3 * s, ty - 30 * s); x.lineTo(tx + 5 * s, ty + 2); x.closePath(); x.fill(); x.stroke();
  for (let k = 0; k < 16; k++) { const a = R() * 6.28, d = R() * 24 * s, cx = tx + Math.cos(a) * d, cy = ty - 50 * s + Math.sin(a) * d * 0.8, r = (13 + R() * 9) * s, lg = x.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 1, cx, cy, r); lg.addColorStop(0, k % 3 ? "#a6ea62" : "#c6f57e"); lg.addColorStop(0.6, "#48b040"); lg.addColorStop(1, "#2a7a32"); x.fillStyle = lg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.strokeStyle = "rgba(25,90,35,.5)"; x.lineWidth = 1.2; x.stroke(); }
  if (apples) for (let k = 0; k < 8; k++) { const a = k * 0.8 + 0.4, ax = tx + Math.cos(a) * 20 * s, ay = ty - 48 * s + Math.sin(a) * 16 * s; x.fillStyle = "#e8352a"; x.beginPath(); x.arc(ax, ay, 3.4, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.75)"; x.beginPath(); x.arc(ax - 1, ay - 1, 1, 0, 7); x.fill(); }
}

function picket(x: CanvasRenderingContext2D, a: number[], b: number[], n: number) {
  const px = (t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  x.strokeStyle = "rgba(90,70,60,.55)"; x.lineWidth = 3.4; x.beginPath(); for (const hh of [6, 13]) { x.moveTo(a[0], a[1] - hh); x.lineTo(b[0], b[1] - hh); } x.stroke(); x.strokeStyle = "#fff"; x.lineWidth = 2.2; x.beginPath(); for (const hh of [6, 13]) { x.moveTo(a[0], a[1] - hh); x.lineTo(b[0], b[1] - hh); } x.stroke();
  for (let i = 0; i <= n; i++) { const p = px(i / n); x.fillStyle = "#fff"; x.strokeStyle = "rgba(90,70,60,.6)"; x.lineWidth = 1; x.beginPath(); x.moveTo(p[0] - 2.6, p[1]); x.lineTo(p[0] - 2.6, p[1] - 14); x.lineTo(p[0], p[1] - 17); x.lineTo(p[0] + 2.6, p[1] - 14); x.lineTo(p[0] + 2.6, p[1]); x.closePath(); x.fill(); x.stroke(); }
}

export function isoBg(kind: string): HTMLCanvasElement {
  if (BG[kind]) return BG[kind];
  const { c, x } = mk(); let sd = 11; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // grass: a bright meadow with soft light and shade
  const g = x.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, "#a4e868"); g.addColorStop(0.5, "#7cd24c"); g.addColorStop(1, "#62bd3e"); x.fillStyle = g; x.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 34; i++) { const px = R() * VW, py = R() * VH, rr = 40 + R() * 90, lg = x.createRadialGradient(px, py, 2, px, py, rr), lit = R() > 0.45; lg.addColorStop(0, lit ? "rgba(235,255,150,.28)" : "rgba(20,110,40,.2)"); lg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = lg; x.beginPath(); x.ellipse(px, py, rr * 1.6, rr * 0.8, 0, 0, 7); x.fill(); }
  const G5 = ["#3f9a36", "#58b744", "#74cc52", "#92dc62", "#b4ee7a"];
  for (let i = 0; i < 1800; i++) { const gx = R() * VW, gy = R() * VH, s = 4 + R() * 5; x.strokeStyle = G5[Math.floor(R() * 5)]; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + (R() - 0.5) * s, gy - s * 0.6, gx + (R() - 0.5) * s * 1.3, gy - s); x.stroke(); }
  // lake and sand on the right
  const sand = x.createLinearGradient(680, 0, 800, 0); sand.addColorStop(0, "#f2e2a8"); sand.addColorStop(1, "#e0c880"); x.fillStyle = sand; x.beginPath(); x.moveTo(800, 96); x.quadraticCurveTo(704, 150, 716, 250); x.quadraticCurveTo(730, 350, 694, 450); x.lineTo(800, 450); x.closePath(); x.fill();
  const wt = x.createLinearGradient(720, 0, 800, 0); wt.addColorStop(0, "#9fe6f2"); wt.addColorStop(0.35, "#4fc0ea"); wt.addColorStop(1, "#2c8ed0"); x.fillStyle = wt; x.beginPath(); x.moveTo(800, 122); x.quadraticCurveTo(732, 170, 742, 256); x.quadraticCurveTo(756, 346, 724, 450); x.lineTo(800, 450); x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 2; for (let i = 0; i < 9; i++) { const wy = 160 + i * 34, wx = 760 + (i % 3) * 8; x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 10, wy - 4, wx + 22, wy); x.stroke(); }
  for (const [lx, ly] of [[770, 210], [784, 330], [756, 400]]) { x.fillStyle = "#4cb04a"; x.beginPath(); x.ellipse(lx, ly, 10, 5, 0, 0, 7); x.fill(); x.fillStyle = "#ff9ac8"; x.beginPath(); x.arc(lx + 2, ly - 2, 2.6, 0, 7); x.fill(); }
  for (let i = 0; i < 7; i++) { const rx = 726 + R() * 14, ry = 262 + i * 22; x.strokeStyle = "#5a8a2a"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx + 1, ry - 14 - R() * 6); x.stroke(); x.fillStyle = "#8a5a2a"; x.fillRect(rx - 1, ry - 20 - R() * 4, 3, 6); }
  // stone path: in front of the barn, down the left of the field, and to the rocket pad
  const pathT: number[][] = []; for (let gx = 1; gx <= 12; gx++) pathT.push([gx, 3]); for (let gy = 3; gy <= 12; gy++) pathT.push([3, gy]); for (let gx = 4; gx <= 9; gx++) pathT.push([gx, 9]);
  for (const [gx, gy] of pathT) { diamond(x, gx + 0.04, gy + 0.04, 0.92, 0.92, "rgba(60,50,20,.2)"); const tg = x.createLinearGradient(0, P(gx, gy)[1], 0, P(gx + 1, gy + 1)[1]); tg.addColorStop(0, (gx + gy) % 2 ? "#ece0bc" : "#e2d4aa"); tg.addColorStop(1, "#c9b888"); diamond(x, gx + 0.02, gy + 0.02, 0.96, 0.96, tg, "rgba(120,100,60,.45)", 1); }
  // flowers
  const FC = ["#ff7ab8", "#ffffff", "#ffd23f", "#b48cff", "#ff8a5a"];
  for (let i = 0; i < 46; i++) { const fx = R() * 660, fy = 60 + R() * 380; for (let k = 0; k < 4; k++) { const ox = fx + (R() - 0.5) * 14, oy = fy + (R() - 0.5) * 8; x.strokeStyle = "#2f7a2c"; x.lineWidth = 1; x.beginPath(); x.moveTo(ox, oy + 5); x.lineTo(ox, oy); x.stroke(); x.fillStyle = FC[i % 5]; x.beginPath(); x.arc(ox, oy, 2.4, 0, 7); x.fill(); x.fillStyle = "#ffe36a"; x.beginPath(); x.arc(ox, oy, 0.9, 0, 7); x.fill(); } }
  // the tilled field: raised border, soil
  const f0 = P(4, 4), f1 = P(12, 4), f2 = P(12, 8), f3 = P(4, 8);
  poly(x, [up(f0, -3), up(f1, -3), up(f2, -3), up(f3, -3)], "rgba(30,70,10,.35)", "");
  poly(x, [f0, f1, f2, f3], "#9a6a3c", "#e8d29a", 3);
  // the pen: sandy floor, straw and a trough, back fences
  diamond(x, 0, 9, 6, 4, "#efd98a", "#fff", 2);
  const pg = x.createLinearGradient(0, P(0, 9)[1], 0, P(6, 13)[1]); pg.addColorStop(0, "rgba(255,240,170,.45)"); pg.addColorStop(1, "rgba(220,180,90,.35)"); diamond(x, 0, 9, 6, 4, pg);
  for (let i = 0; i < 40; i++) { const u = R() * 6, v = 9 + R() * 4, p = P(u, v); x.strokeStyle = i % 2 ? "#e8c24a" : "#c99a2e"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + (R() - 0.5) * 8, p[1] - 2 - R() * 3); x.stroke(); }
  { const t0 = P(2.4, 11.0); x.fillStyle = "rgba(0,0,0,.2)"; x.beginPath(); x.ellipse(t0[0] + 4, t0[1] + 8, 24, 7, 0, 0, 7); x.fill(); poly(x, [[t0[0] - 22, t0[1] + 2], [t0[0] + 20, t0[1] + 2], [t0[0] + 20, t0[1] - 6], [t0[0] - 22, t0[1] - 6]], "#a8754a"); poly(x, [[t0[0] - 20, t0[1] - 4], [t0[0] + 18, t0[1] - 4], [t0[0] + 18, t0[1] - 8], [t0[0] - 20, t0[1] - 8]], "#7ccdf0", ""); }
  picket(x, P(0, 9), P(6, 9), 18); picket(x, P(0, 9), P(0, 13), 12);
  // barn and silo
  { const b = house(x, 2, 0, 3, 2, 24, 20, ["#f08a3a", "#c85a1e", "#8a4a32", "#d4682a"]);
    const dl = (u: number, h: number) => { const p = P(2 + u, 2); return [p[0], p[1] - h]; };
    poly(x, [dl(1, 0), dl(2, 0), dl(2, 17), dl(1, 17)], "#7a2e12", "#fff4dc", 2); x.strokeStyle = "#fff4dc"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(dl(1, 0)[0], dl(1, 0)[1]); x.lineTo(dl(2, 17)[0], dl(2, 17)[1]); x.moveTo(dl(2, 0)[0], dl(2, 0)[1]); x.lineTo(dl(1, 17)[0], dl(1, 17)[1]); x.stroke();
    const w0 = P(5, 1.2); poly(x, [[w0[0] - 5, w0[1] - 26], [w0[0] + 5, w0[1] - 31], [w0[0] + 5, w0[1] - 20], [w0[0] - 5, w0[1] - 15]], "#ffe9a8", "#fff4dc", 1.6); void b; }
  { const [sx, sy] = P(0.9, 0.6); shadow(x, sx + 10, sy + 4, 26, 8, 0.3); const sg = x.createLinearGradient(sx - 17, 0, sx + 17, 0); sg.addColorStop(0, "#dfe9f2"); sg.addColorStop(0.5, "#ffffff"); sg.addColorStop(1, "#9db4c8"); x.fillStyle = sg; x.strokeStyle = "rgba(70,90,110,.7)"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(sx - 17, sy); x.lineTo(sx - 17, sy - 50); x.ellipse(sx, sy - 50, 17, 7, 0, Math.PI, 0); x.lineTo(sx + 17, sy); x.ellipse(sx, sy, 17, 7, 0, 0, Math.PI); x.closePath(); x.fill(); x.stroke(); x.fillStyle = "#c8442e"; x.beginPath(); x.ellipse(sx, sy - 52, 17, 8, 0, Math.PI, 0); x.lineTo(sx, sy - 66); x.closePath(); x.fill(); x.stroke(); x.strokeStyle = "rgba(90,110,130,.4)"; for (let k = 1; k < 5; k++) { x.beginPath(); x.ellipse(sx, sy - k * 10, 17, 6, 0, 0, Math.PI); x.stroke(); } }
  // hay bales, crates, a cart by the barn
  for (const [hx, hy] of [[5.4, 1.2], [5.9, 1.9], [5.5, 2.4]] as number[][]) { const p = P(hx, hy), hg = x.createLinearGradient(0, p[1] - 16, 0, p[1]); hg.addColorStop(0, "#f8dc6a"); hg.addColorStop(1, "#d4a838"); poly(x, [[p[0] - 12, p[1]], [p[0] + 12, p[1]], [p[0] + 12, p[1] - 14], [p[0] - 12, p[1] - 14]], hg); x.strokeStyle = "rgba(130,90,20,.5)"; x.beginPath(); x.moveTo(p[0] - 4, p[1]); x.lineTo(p[0] - 4, p[1] - 14); x.moveTo(p[0] + 5, p[1]); x.lineTo(p[0] + 5, p[1] - 14); x.stroke(); }
  // trees round the edges
  for (const [tx, ty, s, ap] of [[34, 168, 1, true], [96, 108, 0.8, false], [20, 262, 0.9, false], [610, 70, 0.9, false], [690, 96, 1, true], [600, 330, 0.8, false], [470, 420, 0.7, false], [34, 372, 0.9, false]] as number[][]) tree(x, R, tx, ty, s, !!ap);
  // tint for the world
  const TINT: any = { moon: "", mars: "rgba(255,150,60,.16)", titan: "rgba(240,190,70,.18)", proxima: "rgba(255,90,80,.14)" }; if (TINT[kind]) { x.fillStyle = TINT[kind]; x.fillRect(0, 0, VW, VH); }
  BG[kind] = c; return c;
}

export function isoFg(kind: string): HTMLCanvasElement {
  if (FG[kind]) return FG[kind];
  const { c, x } = mk(); picket(x, P(0, 13), P(6, 13), 18); picket(x, P(6, 9), P(6, 13), 12);
  for (const [bx, by] of [[120, 300], [300, 318], [600, 392]]) for (let k = 0; k < 4; k++) { const cx = bx + k * 9 - 14, cy = by - (k % 2) * 4, r = 10 + (k % 3) * 2, bg = x.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, r); bg.addColorStop(0, "#9ae45e"); bg.addColorStop(1, "#2f8a30"); x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.strokeStyle = "rgba(25,90,35,.5)"; x.stroke(); }
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
export function drawIsoPlot(x: CanvasRenderingContext2D, i: number, c: any, T: number, cropCol: string) {
  const c0 = 4 + (i % 4) * 2, r0 = 4 + Math.floor(i / 4) * 2, wet = c.w > 0;
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
  const cx = a.x, cy = a.y, w = 1.7;
  const gx = 0, gy = 0; void gx; void gy;
  // a local drawing frame: world tile (0,0) sits at the footprint's back corner
  const ox = cx - (w - w) * TW, oy = cy - w * TH; x.save(); x.translate(ox - OX, oy - OY);
  if (H.b <= 0) {
    x.setLineDash([6, 5]); x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = 2; const A = P(0, 0), B = P(w, 0), C = P(w, w), D = P(0, w); x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.lineTo(C[0], C[1]); x.lineTo(D[0], D[1]); x.closePath(); x.stroke(); x.setLineDash([]); x.fillStyle = "rgba(255,255,255,.22)"; x.fill(); x.restore();
    const ok = stock >= houseCost[i], pulse = ok ? 1 + Math.sin(T * 5) * 0.06 : 1; x.save(); x.translate(cx, cy - 6); x.scale(pulse, pulse); x.fillStyle = ok ? "#ffb020" : "rgba(60,40,20,.78)"; x.strokeStyle = OUT; x.lineWidth = 1.5; x.beginPath(); x.roundRect(-36, -13, 72, 26, 13); x.fill(); x.stroke(); x.fillStyle = ok ? "#3a2410" : "#fff"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText("🔨 " + houseCost[i] + " 🌾", 0, 5); x.restore(); return;
  }
  const prog = Math.min(1, H.b); x.save(); if (prog < 1) { x.beginPath(); { const top = OY - 30, bot = OY + 2 * w * TH + 4; x.rect(-1000, top + (bot - top) * (1 - prog), 3000, 3000); } x.clip(); }
  const kind = a.id, cols: any = { cow: ["#f08a3a", "#c85a1e", "#8a4a32", "#d4682a"], chicken: ["#9ad4f6", "#6aaee0", "#d8442e", "#82c0ec"], pig: ["#c99a64", "#946a3c", "#7a5a3a", "#b08450"], sheep: ["#f0e4c8", "#c9b890", "#e0be5a", "#dccfae"] };
  house(x, 0, 0, w, w, 16, 14, cols[kind] || cols.cow);
  x.restore(); x.restore();
  if (H.b < 1) { x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(cx - 30, cy - 58, 60, 7); x.fillStyle = "#ffd23f"; x.fillRect(cx - 30, cy - 58, 60 * H.b, 7); x.font = "16px system-ui"; x.textAlign = "center"; x.fillText("🔨", cx + 40, cy - 46 + Math.sin(T * 12) * 3); return; }
  if (!H.own) { const ok = stock >= buyCost[i], pulse = 1 + Math.sin(T * 4) * 0.05; x.save(); x.translate(cx, cy - 60); x.scale(pulse, pulse); x.fillStyle = ok ? "#fff" : "rgba(255,255,255,.75)"; x.strokeStyle = ok ? "#e8a010" : OUT; x.lineWidth = 1.8; x.beginPath(); x.roundRect(-38, -13, 76, 26, 13); x.fill(); x.stroke(); x.fillStyle = "#222"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText(a.prod + " " + buyCost[i] + " 🌾", 0, 5); x.restore(); }
}
