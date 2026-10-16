/* The colony's buildings, drawn as a space settlement rather than as neon boxes (owner, 2026-10-15: "make the buildings look like a colony in space, like a city on Mars,
   like the Earth of the year 2500 or 3000"). What the drawings borrow from real studies of off-world cities:
   - 2100, the first settlers (Mars / Moon studies): pressurised habitats half buried under regolith for radiation shielding, glass greenhouse domes, tilted solar arrays on
     stands, drill rigs on ice, 3D-printed shells, landing pads, and pressurised tubes joining the modules;
   - 2500: big glazed domes holding gardens, ring habitats (the Stanford torus), towers wrapped in greenhouse bands, mirror fields, a space-elevator tether in the sky;
   - 3000: floating spires and stacked pods, mirror sails in orbit, an O'Neill cylinder (the big spinning tube, 1976) and an orbital ring across the sky, light beams.
   Everything is drawn from code on one canvas; (cx, cy) is the centre of the plot's diamond, tw its width in pixels. */
export type Pal = { reg: string; reg2: string; dust: string; glow: string };
export const PALS: Record<string, Pal> = {
  moon: { reg: "#8d8f98", reg2: "#6f717b", dust: "#b9bbc4", glow: "120,200,255" },
  mars: { reg: "#a8552f", reg2: "#82401f", dust: "#d98a5a", glow: "255,170,110" },
  titan: { reg: "#9a7a3a", reg2: "#74582a", dust: "#d6b673", glow: "255,210,130" },
  proxima: { reg: "#7a2a3e", reg2: "#561b2b", dust: "#c0657c", glow: "255,120,150" },
};
type Cx = CanvasRenderingContext2D;
const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** a hemisphere dome: glass or hull, lit from the upper left */
function dome(x: Cx, cx: number, by: number, rx: number, h: number, a: string, b: string, line = "rgba(255,255,255,.35)") {
  const g = x.createLinearGradient(cx - rx, by - h, cx + rx, by); g.addColorStop(0, a); g.addColorStop(1, b);
  x.beginPath(); x.ellipse(cx, by, rx, h, 0, Math.PI, 0); x.ellipse(cx, by, rx, rx * 0.5, 0, 0, Math.PI); x.closePath(); x.fillStyle = g; x.fill();
  x.strokeStyle = line; x.lineWidth = 1; x.beginPath(); x.ellipse(cx, by, rx, h, 0, Math.PI, 0); x.stroke();
}
/** an upright cylinder with a lit top */
function cyl(x: Cx, cx: number, by: number, r: number, h: number, a: string, b: string, top: string) {
  const g = x.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a);
  x.fillStyle = g; x.beginPath(); x.moveTo(cx - r, by); x.lineTo(cx - r, by - h); x.ellipse(cx, by - h, r, r * 0.45, 0, Math.PI, 0, true); x.lineTo(cx + r, by); x.ellipse(cx, by, r, r * 0.45, 0, 0, Math.PI); x.closePath(); x.fill();
  x.fillStyle = top; x.beginPath(); x.ellipse(cx, by - h, r, r * 0.45, 0, 0, 7); x.fill();
}
function slab(x: Cx, cx: number, by: number, w: number, d: number, h: number, left: string, right: string, top: string) {
  const a = [cx - w / 2, by], b = [cx, by + d / 2], c = [cx + w / 2, by], dd = [cx, by - d / 2];
  const poly = (p: number[][], f: string) => { x.beginPath(); x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) x.lineTo(p[i][0], p[i][1]); x.closePath(); x.fillStyle = f; x.fill(); };
  poly([a, b, [b[0], b[1] - h], [a[0], a[1] - h]], left); poly([b, c, [c[0], c[1] - h], [b[0], b[1] - h]], right); poly([[a[0], a[1] - h], [b[0], b[1] - h], [c[0], c[1] - h], [dd[0], dd[1] - h]], top);
}
const shadow = (x: Cx, cx: number, cy: number, w: number) => { x.fillStyle = "rgba(0,0,0,.28)"; x.beginPath(); x.ellipse(cx + w * 0.08, cy + w * 0.04, w * 0.5, w * 0.22, 0, 0, 7); x.fill(); };
const windows = (x: Cx, cx: number, by: number, w: number, h: number, T: number, n: number, glow: string) => { for (let i = 0; i < n; i++) { const wx = cx - w / 2 + (i + 0.5) * w / n, on = Math.sin(T * 1.3 + i * 2.1) > -0.7; x.fillStyle = on ? "rgba(" + glow + ",.9)" : "rgba(40,60,80,.8)"; x.fillRect(wx - 1.2, by - h, 2.4, 2.6); } };


/* Low-poly daylight look (owner, 2026-10-16, reference images: Surviving Mars, a low-poly Mars colony builder, SimCity): flat-shaded white modules with a rust stripe,
   faceted geodesic glass domes, hexagonal solar fields, wind turbines, steam puffs, and in the later eras curved glass towers standing among trees. Own drawing, nothing copied. */
const RUST = "#b8552d", RUST2 = "#8e3f20";
function poly(x: Cx, p: number[][], f: string) { x.beginPath(); x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) x.lineTo(p[i][0], p[i][1]); x.closePath(); x.fillStyle = f; x.fill(); }
/** an isometric box, flat shaded, with an optional rust band at a fraction of its height */
function lbox(x: Cx, cx: number, by: number, w: number, d: number, h: number, base = "#f1f3f5", band = RUST, bandAt = 0.55) {
  const a = [cx - w / 2, by], b = [cx, by + d / 2], c = [cx + w / 2, by], t = (p: number[], k: number) => [p[0], p[1] - k];
  poly(x, [a, b, t(b, h), t(a, h)], "#c9cfd6"); poly(x, [b, c, t(c, h), t(b, h)], "#e3e7eb"); poly(x, [t(a, h), t(b, h), t(c, h), [cx, by - d / 2 - h]], base);
  if (band) { const y0 = h * bandAt, y1 = y0 + h * 0.16; poly(x, [t(a, y0), t(b, y0), t(b, y1), t(a, y1)], band); poly(x, [t(b, y0), t(c, y0), t(c, y1), t(b, y1)], RUST2); }
  x.strokeStyle = "rgba(60,70,84,.35)"; x.lineWidth = 0.8; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.moveTo(b[0], b[1]); x.lineTo(b[0], b[1] - h); x.stroke();
}
function door(x: Cx, cx: number, by: number, u: number, glow: string) { x.fillStyle = "rgba(" + glow + ",.9)"; poly(x, [[cx + 1 * u, by + 5 * u], [cx + 5 * u, by + 3 * u], [cx + 5 * u, by - 3 * u], [cx + 1 * u, by - 1 * u]], "rgba(" + glow + ",.85)"); }
/** a geodesic dome: glass tint, facet lines and a bright rim */
function geo(x: Cx, cx: number, by: number, rx: number, h: number, tint: string, inside?: string, T = 0) {
  if (inside) { x.fillStyle = inside; x.beginPath(); x.ellipse(cx, by, rx * 0.92, rx * 0.45, 0, 0, Math.PI * 2); x.fill(); }
  const g = x.createLinearGradient(cx - rx, by - h, cx + rx, by); g.addColorStop(0, "rgba(255,255,255,.75)"); g.addColorStop(0.5, tint); g.addColorStop(1, "rgba(60,90,120,.55)");
  x.beginPath(); x.ellipse(cx, by, rx, h, 0, Math.PI, 0); x.ellipse(cx, by, rx, rx * 0.45, 0, 0, Math.PI); x.closePath(); x.fillStyle = g; x.fill();
  x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 0.9;
  for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(cx + i * rx / 3.4, by + (rx * 0.45) * Math.sqrt(Math.max(0, 1 - (i / 3.4) ** 2))); x.quadraticCurveTo(cx + i * rx / 6, by - h * 1.05, cx, by - h); x.stroke(); }
  for (let k = 1; k <= 3; k++) { const f = k / 4; x.beginPath(); x.ellipse(cx, by - h * f * 0.85, rx * Math.sqrt(1 - f * f), rx * 0.2 * (1 - f * 0.3), 0, 0, Math.PI); x.stroke(); }
  x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, by, rx, h, 0, Math.PI, 0); x.stroke();
  x.fillStyle = "rgba(255,255,255," + (0.25 + 0.15 * Math.sin(T * 2)) + ")"; x.beginPath(); x.ellipse(cx - rx * 0.35, by - h * 0.6, rx * 0.16, h * 0.18, -0.6, 0, 7); x.fill();
}
function hexField(x: Cx, cx: number, by: number, u: number, nx: number, ny: number, gold = false) {
  const r = 3.6 * u;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = cx + (i - (nx - 1) / 2) * r * 1.75 + (j % 2) * r * 0.87 - (ny - 1) * r * 0.43, py = by + (j - (ny - 1) / 2) * r * 0.8 - 2 * u;
    x.beginPath(); for (let k = 0; k < 6; k++) { const an = Math.PI / 3 * k; const hx = px + Math.cos(an) * r, hy = py + Math.sin(an) * r * 0.5; k ? x.lineTo(hx, hy) : x.moveTo(hx, hy); } x.closePath();
    x.fillStyle = gold ? ((i + j) % 2 ? "#ffd27a" : "#ffb55a") : ((i + j) % 2 ? "#3c63b8" : "#4f7bd8"); x.fill(); x.strokeStyle = "rgba(230,240,255,.8)"; x.lineWidth = 0.8; x.stroke();
  }
}
function turbine(x: Cx, cx: number, by: number, h: number, T: number, seed: number) {
  x.strokeStyle = "#eef1f4"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, by); x.lineTo(cx, by - h); x.stroke();
  const an = T * 2.2 + seed; x.strokeStyle = "#ffffff"; x.lineWidth = 1.8; for (let k = 0; k < 3; k++) { const a = an + k * 2.094; x.beginPath(); x.moveTo(cx, by - h); x.lineTo(cx + Math.cos(a) * h * 0.55, by - h + Math.sin(a) * h * 0.55); x.stroke(); }
  x.fillStyle = RUST; x.beginPath(); x.arc(cx, by - h, 2, 0, 7); x.fill();
}
function steam(x: Cx, cx: number, by: number, T: number, u: number, n = 3) { for (let i = 0; i < n; i++) { const f = (T * 0.45 + i / n) % 1; x.fillStyle = "rgba(255,255,255," + 0.55 * (1 - f) + ")"; x.beginPath(); x.arc(cx + Math.sin(f * 5 + i) * 3 * u, by - f * 22 * u, (2.4 + f * 5) * u, 0, 7); x.fill(); } }
function ltree(x: Cx, cx: number, by: number, s: number, i = 0) { x.fillStyle = "#6a4a2a"; x.fillRect(cx - 0.7 * s, by - 5 * s, 1.4 * s, 5 * s); x.fillStyle = i % 2 ? "#3f9a58" : "#56b86a"; x.beginPath(); x.arc(cx, by - 8 * s, 4.2 * s, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.25)"; x.beginPath(); x.arc(cx - 1.2 * s, by - 9.4 * s, 1.6 * s, 0, 7); x.fill(); }
/** SimCity-like curved glass tower: tapered, glass gradient, white floor bands, a podium with trees */
function glassTower(x: Cx, cx: number, by: number, u: number, h: number, T: number, tint: string, seed: number) {
  x.fillStyle = "#e9edf0"; x.beginPath(); x.ellipse(cx, by, 17 * u, 8.5 * u, 0, 0, 7); x.fill(); for (let i = 0; i < 4; i++) ltree(x, cx - 12 * u + i * 8 * u, by + 3 * u, u * 0.9, i + seed);
  const w = 9 * u, g = x.createLinearGradient(cx - w, 0, cx + w, 0); g.addColorStop(0, "#9fc6e6"); g.addColorStop(0.45, tint); g.addColorStop(1, "#4d7fb0");
  x.fillStyle = g; x.beginPath(); x.moveTo(cx - w, by - 2 * u); x.bezierCurveTo(cx - w * 1.05, by - h * 0.5, cx - w * 0.7, by - h * 0.9, cx - w * 0.2, by - h); x.quadraticCurveTo(cx + w * 0.4, by - h - 2 * u, cx + w, by - h * 0.82); x.bezierCurveTo(cx + w * 1.02, by - h * 0.5, cx + w, by - h * 0.2, cx + w, by - 2 * u); x.quadraticCurveTo(cx, by + 3 * u, cx - w, by - 2 * u); x.fill();
  x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.1; for (let i = 1; i < 7; i++) { const yy = by - h * i / 7; x.beginPath(); x.moveTo(cx - w * 1.0, yy + 2 * u); x.quadraticCurveTo(cx, yy + 5 * u, cx + w * 1.0, yy + 2 * u); x.stroke(); }
  x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(cx - w * 0.7, by - 4 * u); x.lineTo(cx - w * 0.3, by - h * 0.92); x.lineTo(cx - w * 0.1, by - h * 0.92); x.lineTo(cx - w * 0.4, by - 4 * u); x.fill();
  x.fillStyle = "rgba(255,230,160," + (0.55 + 0.35 * Math.sin(T * 1.5 + seed)) + ")"; for (let i = 0; i < 5; i++) x.fillRect(cx - w * 0.6 + ((seed + i * 3) % 5) * w * 0.28, by - h * (0.2 + i * 0.15), 1.6 * u, 1.6 * u);
  x.fillStyle = RUST; x.fillRect(cx - 0.8 * u, by - h - 7 * u, 1.6 * u, 7 * u);
}

export function drawBuilding(x: Cx, id: string, cx: number, cy: number, tw: number, era: number, T: number, pal: Pal, seed: number) {
  const u = tw / 64 * 2.05, gl = pal.glow;
  const mine = (rest: () => void) => { x.save(); x.lineJoin = "round"; x.lineCap = "round"; shadow(x, cx, cy, tw * 0.62); rest(); x.restore(); };
  const glass = "rgba(170,225,255,.62)";
  switch (id) {
    case "hab": mine(() => {
      if (era === 0) { lbox(x, cx - 6 * u, cy + 2 * u, 22 * u, 12 * u, 26 * u); lbox(x, cx + 9 * u, cy - 1 * u, 18 * u, 10 * u, 16 * u); door(x, cx - 6 * u, cy + 5 * u, u, gl); geo(x, cx + 9 * u, cy - 10 * u, 6 * u, 4 * u, glass, undefined, T); }
      else if (era === 1) { lbox(x, cx, cy + 3 * u, 28 * u, 15 * u, 42 * u); geo(x, cx, cy - 39 * u, 14 * u, 11 * u, glass, "#9fd49a", T); door(x, cx, cy + 6 * u, u, gl); }
      else glassTower(x, cx, cy + 2 * u, u, 84 * u, T, "#7fb4e0", seed);
    }); break;
    case "tower": mine(() => { if (era === 2) glassTower(x, cx, cy + 2 * u, u, 104 * u, T, "#7fd0a8", seed); else { const h = (era === 0 ? 44 : 64) * u; lbox(x, cx, cy + 2 * u, 20 * u, 11 * u, h, "#eef3f2", "#4fae6a", 0.3); lbox(x, cx, cy + 2 * u - h, 14 * u, 8 * u, 6 * u, "#bfe8cf", "#4fae6a", 0.5); } }); break;
    case "solar": mine(() => {
      hexField(x, cx, cy, u, era === 0 ? 4 : 5, era === 0 ? 3 : 4, era === 2);
      x.strokeStyle = "#7d8693"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(cx - 20 * u, cy + 8 * u); x.lineTo(cx - 8 * u, cy + 12 * u); x.moveTo(cx + 22 * u, cy + 6 * u); x.lineTo(cx + 10 * u, cy + 10 * u); x.stroke();
      if (era >= 1) turbine(x, cx + 18 * u, cy + 2 * u, 30 * u, T, seed);
    }); break;
    case "farm": mine(() => { geo(x, cx, cy + 2 * u, 36 * u, 30 * u, glass, "#6fc06a", T); x.fillStyle = "#3f9a58"; for (let i = 0; i < 6; i++) x.fillRect(cx - 14 * u + i * 5.4 * u, cy - 4 * u - (i % 2) * 3 * u, 3 * u, 5 * u); }); break;
    case "park": mine(() => { x.fillStyle = "#7fcf7a"; x.beginPath(); x.ellipse(cx, cy, 22 * u, 11 * u, 0, 0, 7); x.fill(); for (let i = 0; i < 5; i++) ltree(x, cx - 14 * u + i * 7 * u, cy + ((i % 2) ? 3 : -2) * u, u * 1.3, i); }); break;
    case "lab": mine(() => { lbox(x, cx, cy + 3 * u, 28 * u, 15 * u, 12 * u); geo(x, cx - 3 * u, cy - 14 * u, 16 * u, 13 * u, "rgba(255,255,255,.55)", undefined, T); x.fillStyle = "#eef2fb"; x.beginPath(); x.ellipse(cx + 12 * u, cy - 14 * u, 7 * u, 3 * u, -0.5, 0, 7); x.fill(); x.strokeStyle = "#cfd6e2"; x.beginPath(); x.moveTo(cx + 12 * u, cy - 8 * u); x.lineTo(cx + 12 * u, cy - 13 * u); x.stroke(); }); break;
    case "med": mine(() => { lbox(x, cx, cy + 3 * u, 26 * u, 14 * u, 13 * u, "#ffffff", "#e0433c", 0.45); x.fillStyle = "#e0433c"; x.fillRect(cx + 3 * u, cy - 6 * u, 7 * u, 2.4 * u); x.fillRect(cx + 5.3 * u, cy - 8.5 * u, 2.4 * u, 7 * u); }); break;
    case "school": mine(() => { lbox(x, cx, cy + 3 * u, 28 * u, 15 * u, 10 * u, "#f4efe2", "#d9a23a"); lbox(x, cx, cy + 3 * u - 10 * u, 16 * u, 9 * u, 8 * u, "#f4efe2", "#d9a23a"); x.strokeStyle = "#ddd"; x.beginPath(); x.moveTo(cx, cy - 15 * u); x.lineTo(cx, cy - 27 * u); x.stroke(); x.fillStyle = RUST; x.fillRect(cx, cy - 27 * u, 8 * u, 4.5 * u); }); break;
    case "market": mine(() => { lbox(x, cx, cy + 3 * u, 30 * u, 16 * u, 10 * u, "#f4ede2", "#e0813a"); for (let i = -2; i <= 2; i++) { x.fillStyle = i % 2 ? "#ffffff" : RUST; x.fillRect(cx + i * 5.4 * u - 2.4 * u, cy - 11 * u + Math.abs(i) * 0.8 * u, 4.8 * u, 4 * u); } }); break;
    case "mine": mine(() => { lbox(x, cx - 8 * u, cy + 4 * u, 18 * u, 10 * u, 9 * u, "#e9ecef", "#e0a43a"); x.strokeStyle = "#e0a43a"; x.lineWidth = 2.2 * u; x.beginPath(); x.moveTo(cx + 6 * u, cy - 2 * u); x.lineTo(cx + 12 * u, cy - 20 * u); x.lineTo(cx + 2 * u, cy - 14 * u); x.stroke(); x.fillStyle = pal.reg2; x.beginPath(); x.moveTo(cx + 6 * u, cy + 6 * u); x.lineTo(cx + 15 * u, cy - 4 * u); x.lineTo(cx + 24 * u, cy + 6 * u); x.fill(); }); break;
    case "geo": mine(() => { lbox(x, cx + 10 * u, cy + 4 * u, 16 * u, 9 * u, 8 * u); cyl(x, cx - 8 * u, cy + 2 * u, 7 * u, 22 * u, "#d5dae0", "#f4f6f8", "#ffffff"); x.fillStyle = RUST; x.fillRect(cx - 15 * u, cy - 14 * u, 14 * u, 3.4 * u); steam(x, cx - 8 * u, cy - 22 * u, T, u); }); break;
    case "oxy": mine(() => { cyl(x, cx + 12 * u, cy + 3 * u, 5 * u, 34 * u, "#d5dae0", "#f4f6f8", "#fff"); const sp = (px: number, py: number, r: number) => { const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 1, px, py, r); g.addColorStop(0, "#fff"); g.addColorStop(1, "#8fc4e6"); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }; sp(cx - 8 * u, cy - 8 * u, 10 * u); sp(cx + 2 * u, cy - 6 * u, 7 * u); steam(x, cx + 12 * u, cy - 34 * u, T, u, 2); }); break;
    case "recycler": mine(() => { lbox(x, cx, cy + 3 * u, 26 * u, 14 * u, 9 * u, "#eef2f0", "#4fae9a"); geo(x, cx - 8 * u, cy - 6 * u, 7 * u, 6 * u, "rgba(120,220,200,.6)", undefined, T); geo(x, cx + 9 * u, cy - 6 * u, 6 * u, 5 * u, "rgba(120,190,230,.6)", undefined, T); }); break;
    case "shield": mine(() => { cyl(x, cx, cy + 3 * u, 6 * u, 10 * u, "#d5dae0", "#f4f6f8", "#fff"); geo(x, cx, cy, 44 * u, 36 * u, "rgba(" + gl + ",.18)", undefined, T); }); break;
    case "reactor": mine(() => { lbox(x, cx, cy + 3 * u, 32 * u, 17 * u, 10 * u, "#e9ecef", "#4aa6c8"); const g = x.createRadialGradient(cx, cy - 14 * u, 1, cx, cy - 14 * u, 14 * u); g.addColorStop(0, "rgba(180,250,255,1)"); g.addColorStop(1, "rgba(0,220,255,0)"); x.globalCompositeOperation = "lighter"; x.fillStyle = g; x.beginPath(); x.arc(cx, cy - 14 * u, 14 * u + Math.sin(T * 4), 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; cyl(x, cx - 14 * u, cy - 2 * u, 4 * u, 16 * u, "#d5dae0", "#f4f6f8", "#fff"); steam(x, cx - 14 * u, cy - 18 * u, T, u, 2); }); break;
    case "water": mine(() => { cyl(x, cx + 10 * u, cy + 3 * u, 9 * u, 16 * u, "#7fb4dc", "#cfeaff", "#e6f4ff"); lbox(x, cx - 10 * u, cy + 5 * u, 14 * u, 8 * u, 8 * u, "#eef2f4", "#4a90c8"); x.strokeStyle = "#cfd4dc"; x.lineWidth = 1.5 * u; x.beginPath(); x.moveTo(cx - 14 * u, cy); x.lineTo(cx - 10 * u, cy - 26 * u); x.lineTo(cx - 6 * u, cy); x.stroke(); }); break;
    case "port": mine(() => { x.fillStyle = "#cfd4da"; x.beginPath(); x.ellipse(cx, cy, 26 * u, 13 * u, 0, 0, 7); x.fill(); x.strokeStyle = RUST; x.lineWidth = 1.6; x.setLineDash([4, 3]); x.beginPath(); x.ellipse(cx, cy, 20 * u, 10 * u, 0, 0, 7); x.stroke(); x.setLineDash([]); const rb = cy - 3 * u; x.fillStyle = "#f4f6fa"; x.beginPath(); x.moveTo(cx - 5 * u, rb); x.lineTo(cx - 5 * u, rb - 26 * u); x.lineTo(cx, rb - 36 * u); x.lineTo(cx + 5 * u, rb - 26 * u); x.lineTo(cx + 5 * u, rb); x.fill(); x.fillStyle = RUST; x.fillRect(cx - 5 * u, rb - 14 * u, 10 * u, 4 * u); }); break;
    default: mine(() => lbox(x, cx, cy + 3 * u, 26 * u, 14 * u, 12 * u));
  }
}

/** a paved road between two neighbouring modules, with a pipe and cable beside it */
export function drawTube(x: Cx, x1: number, y1: number, x2: number, y2: number, u: number, era: number) {
  x.save(); x.lineCap = "round";
  x.strokeStyle = "rgba(70,60,56,.85)"; x.lineWidth = 9 * u; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
  x.strokeStyle = era === 0 ? "#8a8178" : "#74767c"; x.lineWidth = 7 * u; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
  x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 0.9; x.setLineDash([3, 4]); x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); x.setLineDash([]);
  x.strokeStyle = "#e8ecef"; x.lineWidth = 1.6 * u; x.beginPath(); x.moveTo(x1, y1 - 5 * u); x.lineTo(x2, y2 - 5 * u); x.stroke();
  x.restore();
}


/** the sky of a colony: mountains and craters on the horizon, and from 2500 a space-elevator tether, from 3000 an O'Neill cylinder and an orbital ring */
export function drawSkyline(x: Cx, W: number, H: number, camX: number, T: number, era: number, pal: Pal) {
  x.save(); const hy = H * 0.34;
  const peaks = (n: number, par: number, hmax: number, c1: string, c2: string, base: number) => { let px = -40; for (let i = 0; i < n + 2; i++) { const k = i + Math.floor(camX * par), w = W / n * (0.9 + rnd(k * 2.3) * 0.8), hh = hmax * (0.35 + rnd(k * 3.7 + base) * 0.65), tx = px + w * 0.5 + (rnd(k * 5.1) - 0.5) * w * 0.3;
    x.fillStyle = c1; x.beginPath(); x.moveTo(px, hy + 40); x.lineTo(tx, hy + 40 - hh); x.lineTo(tx + w * 0.08, hy + 40); x.closePath(); x.fill();
    x.fillStyle = c2; x.beginPath(); x.moveTo(tx, hy + 40 - hh); x.lineTo(px + w * 1.1, hy + 40); x.lineTo(tx + w * 0.08, hy + 40); x.closePath(); x.fill(); px += w * 0.78; } };
  peaks(7, 0.02, H * 0.2, "#c9744a", "#8f4528", 1); peaks(9, 0.04, H * 0.13, "#d98a5a", "#a95a34", 7);
  if (era >= 1) { const ex = W * 0.8 - (camX * 0.03) % 40; x.strokeStyle = "rgba(220,235,255,.55)"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(ex, hy); x.lineTo(ex, 0); x.stroke(); x.fillStyle = "rgba(230,240,255,.9)"; for (const yy of [H * 0.06, H * 0.14]) { x.fillRect(ex - 5, yy, 10, 4); } }
  if (era >= 2) {
    const cx = W * 0.3, cy = H * 0.12, L = W * 0.34, r = H * 0.035; const g = x.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, "rgba(220,235,255,.85)"); g.addColorStop(0.5, "rgba(120,150,190,.85)"); g.addColorStop(1, "rgba(60,80,120,.85)"); x.fillStyle = g; x.beginPath(); x.moveTo(cx - L / 2, cy - r); x.lineTo(cx + L / 2, cy - r); x.quadraticCurveTo(cx + L / 2 + r, cy, cx + L / 2, cy + r); x.lineTo(cx - L / 2, cy + r); x.quadraticCurveTo(cx - L / 2 - r, cy, cx - L / 2, cy - r); x.fill();
    x.fillStyle = "rgba(" + pal.glow + ",.9)"; for (let i = 0; i < 28; i++) x.fillRect(cx - L / 2 + 6 + i * (L - 12) / 28, cy - 1 + ((i % 3) - 1) * r * 0.5, 3, 2);
    x.strokeStyle = "rgba(170,210,255,.3)"; x.lineWidth = 2; x.beginPath(); x.ellipse(W * 0.5, H * 1.1, W * 0.9, H * 0.95, 0, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  }
  x.restore();
}

/** the ground of one plot: regolith with its own tint and a small crater now and then; ice shines, ore is flecked */
export function groundFill(pal: Pal, f: string, i: number) { return f === "ice" ? "rgba(150,205,240,.72)" : f === "ore" ? "rgba(168,116,64,.78)" : (i % 7 === 0 ? pal.reg2 : i % 3 === 0 ? pal.reg : pal.reg) + "e6"; }

/** Surviving-Mars style: one huge faceted glass dome standing over the heart of the colony */
export function bigDome(x: Cx, cx: number, cy: number, rx: number, h: number, T: number) {
  x.save(); const g = x.createLinearGradient(cx - rx, cy - h, cx + rx, cy); g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(0.5, "rgba(170,225,255,.10)"); g.addColorStop(1, "rgba(80,140,200,.16)");
  x.beginPath(); x.ellipse(cx, cy, rx, h, 0, Math.PI, 0); x.ellipse(cx, cy, rx, rx * 0.5, 0, 0, Math.PI); x.closePath(); x.fillStyle = g; x.fill();
  x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 1.2;
  for (let i = -5; i <= 5; i++) { x.beginPath(); x.moveTo(cx + i * rx / 5.2, cy + rx * 0.5 * Math.sqrt(Math.max(0, 1 - (i / 5.2) ** 2))); x.quadraticCurveTo(cx + i * rx / 9, cy - h * 1.1, cx, cy - h); x.stroke(); }
  for (let k = 1; k <= 4; k++) { const f = k / 5; x.beginPath(); x.ellipse(cx, cy - h * f * 0.8, rx * Math.sqrt(1 - f * f), rx * 0.22 * (1 - f * 0.4), 0, 0, Math.PI); x.stroke(); }
  x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy, rx, h, 0, Math.PI, 0); x.stroke();
  x.fillStyle = "rgba(255,255,255," + (0.12 + 0.06 * Math.sin(T)) + ")"; x.beginPath(); x.ellipse(cx - rx * 0.4, cy - h * 0.6, rx * 0.2, h * 0.25, -0.6, 0, 7); x.fill();
  x.restore();
}
