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

export function drawBuilding(x: Cx, id: string, cx: number, cy: number, tw: number, era: number, T: number, pal: Pal, seed: number) {
  const u = tw / 64, gl = pal.glow; x.save(); x.lineJoin = "round"; x.lineCap = "round"; shadow(x, cx, cy, tw * 0.62);
  const lift = era === 2 && id !== "solar" ? 3 * u + 2 * u * Math.sin(T * 1.4 + seed) : 0;   // in the year 3000 the city floats a little
  if (lift) { x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(cx, cy, 1, cx, cy, tw * 0.36); g.addColorStop(0, "rgba(" + gl + ",.35)"); g.addColorStop(1, "rgba(" + gl + ",0)"); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, tw * 0.36, tw * 0.18, 0, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; }
  const by = cy - lift;
  switch (id) {
    case "hab": {   // habitat: a regolith-covered shell with a glowing door in 2100, a glazed dome with a torus ring in 2500, stacked pods on a spire in 3000
      if (era === 0) { dome(x, cx, by, 20 * u, 16 * u, "#c9cdd6", "#8b909c"); x.fillStyle = pal.reg; x.beginPath(); x.ellipse(cx, by - 2 * u, 22 * u, 11 * u, 0, 0, Math.PI); x.ellipse(cx, by - 4 * u, 21 * u, 10 * u, 0, Math.PI, 0, true); x.fill(); x.fillStyle = "rgba(" + gl + ",.95)"; x.fillRect(cx - 3 * u, by - 7 * u, 6 * u, 6 * u); x.fillStyle = pal.dust; for (let i = 0; i < 5; i++) x.fillRect(cx - 18 * u + i * 8 * u + rnd(seed + i) * 3, by - 12 * u + rnd(seed + i + 9) * 5, 2, 1.4); }
      else if (era === 1) { cyl(x, cx, by, 15 * u, 24 * u, "#9fb2c8", "#dfe9f5", "#f3f8ff"); dome(x, cx, by - 24 * u, 15 * u, 9 * u, "rgba(180,225,255,.85)", "rgba(90,150,210,.8)"); x.strokeStyle = "rgba(" + gl + ",.9)"; x.lineWidth = 2 * u; x.beginPath(); x.ellipse(cx, by - 12 * u, 24 * u, 6 * u, 0, 0, 7); x.stroke(); windows(x, cx, by - 4 * u, 22 * u, 4 * u, T, 5, gl); }
      else { x.fillStyle = "rgba(" + gl + ",.9)"; for (let i = 0; i < 4; i++) { const w = (16 - i * 3) * u; x.fillStyle = i % 2 ? "#cfe9ff" : "#e9f6ff"; x.beginPath(); x.ellipse(cx, by - (6 + i * 11) * u, w, w * 0.45, 0, 0, 7); x.fill(); x.fillStyle = "rgba(" + gl + ",.9)"; x.fillRect(cx - w, by - (6 + i * 11) * u, w * 2, 1.6 * u); } x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 1.6 * u; x.beginPath(); x.moveTo(cx, by); x.lineTo(cx, by - 56 * u); x.stroke(); x.fillStyle = "rgba(" + gl + ",1)"; x.beginPath(); x.arc(cx, by - 58 * u, 2.4 * u, 0, 7); x.fill(); }
      break; }
    case "tower": {   // vertical farm: a glass tube wrapped in green bands
      const h = (era === 0 ? 34 : era === 1 ? 50 : 66) * u; cyl(x, cx, by, 11 * u, h, "#7aa5b8", "#cfeef5", "#e9fbff");
      for (let i = 0; i < 6 + era * 2; i++) { x.fillStyle = "rgba(60,200,90,.8)"; x.fillRect(cx - 10 * u, by - h + 5 * u + i * (h - 8 * u) / (6 + era * 2), 20 * u, 3.4 * u); }
      x.fillStyle = "rgba(255,90,200,.8)"; x.fillRect(cx - 7 * u, by - h - 2, 14 * u, 2); break; }
    case "solar": {   // solar farm: rows of tilted panels (2100), a heliostat mirror field (2500), mirror sails floating over the plot (3000)
      const n = era === 0 ? 3 : 4, ph = era === 2 ? 14 * u : 0;
      for (let i = 0; i < n; i++) { const px = cx - 18 * u + i * 12 * u, py = by - 4 * u - ph - (era === 2 ? Math.sin(T + i) * 2 : 0); const g = x.createLinearGradient(px, py - 14 * u, px + 10 * u, py); g.addColorStop(0, era === 2 ? "#ffe9a0" : "#2a4f9a"); g.addColorStop(1, era === 2 ? "#ff9a5a" : "#6fa0ff"); x.fillStyle = g; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 10 * u, py - 3 * u); x.lineTo(px + 12 * u, py - 15 * u); x.lineTo(px + 2 * u, py - 12 * u); x.closePath(); x.fill(); x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = 0.8; x.stroke(); if (!ph) { x.strokeStyle = "#555a64"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px + 6 * u, py - 6 * u); x.lineTo(px + 6 * u, by + 2 * u); x.stroke(); } }
      break; }
    case "geo": {   // geothermal: a steam stack and a pipe run
      cyl(x, cx - 8 * u, by, 7 * u, 22 * u, "#7a4a30", "#c47a4a", "#f0a070"); x.fillStyle = "rgba(255,255,255,.55)"; for (let i = 0; i < 4; i++) { const f = (T * 0.5 + i * 0.25) % 1; x.globalAlpha = 0.5 * (1 - f); x.beginPath(); x.arc(cx - 8 * u + Math.sin(f * 6 + i) * 4 * u, by - 24 * u - f * 22 * u, (3 + f * 5) * u, 0, 7); x.fill(); } x.globalAlpha = 1;
      slab(x, cx + 12 * u, by, 18 * u, 10 * u, 8 * u, "#555b66", "#707884", "#8a93a0"); break; }
    case "reactor": {   // fusion reactor: a torus housing with a glowing heart and twin cooling stacks
      slab(x, cx, by, 34 * u, 18 * u, 8 * u, "#3a4250", "#566072", "#6c778a"); const g = x.createRadialGradient(cx, by - 12 * u, 1, cx, by - 12 * u, 18 * u); g.addColorStop(0, "rgba(200,255,250,1)"); g.addColorStop(1, "rgba(0,255,230,0)"); x.globalCompositeOperation = "lighter"; x.fillStyle = g; x.beginPath(); x.arc(cx, by - 12 * u, 18 * u + Math.sin(T * 4) * 1.5, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
      x.strokeStyle = "#cfe6ee"; x.lineWidth = 3 * u; x.beginPath(); x.ellipse(cx, by - 12 * u, 13 * u, 5 * u, 0, 0, 7); x.stroke(); cyl(x, cx - 15 * u, by - 6 * u, 4 * u, 18 * u, "#8a93a0", "#d6dde6", "#eef2f7"); cyl(x, cx + 15 * u, by - 6 * u, 4 * u, 14 * u, "#8a93a0", "#d6dde6", "#eef2f7"); break; }
    case "water": {   // ice extractor: a drill rig, a tank and a pipe
      x.strokeStyle = "#cfd4dc"; x.lineWidth = 1.6 * u; x.beginPath(); x.moveTo(cx - 12 * u, by); x.lineTo(cx - 6 * u, by - 34 * u); x.lineTo(cx, by); x.moveTo(cx - 9 * u, by - 16 * u); x.lineTo(cx - 3 * u, by - 16 * u); x.stroke(); x.fillStyle = "#ffb43a"; x.fillRect(cx - 8 * u, by - 38 * u, 4 * u, 5 * u);
      cyl(x, cx + 12 * u, by, 9 * u, 14 * u, "#5a86b4", "#9fd0f2", "#cfeaff"); x.strokeStyle = "#8aa0b8"; x.lineWidth = 2 * u; x.beginPath(); x.moveTo(cx - 2 * u, by - 4 * u); x.lineTo(cx + 6 * u, by - 4 * u); x.stroke(); break; }
    case "oxy": {   // oxygen plant: spheres and a tall stack
      const sp = (px: number, py: number, r: number) => { const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 1, px, py, r); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#6fb8d8"); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); };
      cyl(x, cx + 12 * u, by, 5 * u, 36 * u, "#7d8794", "#c4ccd6", "#e6ebf1"); sp(cx - 8 * u, by - 10 * u, 10 * u); sp(cx + 2 * u, by - 7 * u, 7 * u); x.fillStyle = "rgba(160,255,230,.8)"; x.fillRect(cx + 10 * u, by - 38 * u, 4 * u, 2 * u); break; }
    case "recycler": {
      const sp = (px: number, py: number, r: number, c: string) => { x.fillStyle = c; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.strokeStyle = "rgba(255,255,255,.4)"; x.stroke(); };
      x.strokeStyle = "#8fa0ae"; x.lineWidth = 2.4 * u; x.beginPath(); x.moveTo(cx - 12 * u, by - 8 * u); x.lineTo(cx + 12 * u, by - 8 * u); x.stroke(); sp(cx - 12 * u, by - 8 * u, 8 * u, "#4cc6b0"); sp(cx + 12 * u, by - 8 * u, 8 * u, "#4c9ac6"); sp(cx, by - 18 * u, 6 * u, "#d6e6ee"); break; }
    case "farm": {   // greenhouse: a glass dome with crops glowing inside
      dome(x, cx, by, 22 * u, 17 * u, "rgba(190,255,200,.55)", "rgba(80,190,110,.6)", "rgba(220,255,230,.8)"); x.fillStyle = "rgba(90,220,110,.8)"; for (let i = 0; i < 5; i++) x.fillRect(cx - 15 * u + i * 7 * u, by - 6 * u - (i % 2) * 3 * u, 4 * u, 6 * u); x.fillStyle = "rgba(255,60,200,.75)"; x.fillRect(cx - 9 * u, by - 14 * u, 18 * u, 1.6 * u); break; }
    case "park": {
      dome(x, cx, by, 21 * u, 12 * u, "rgba(200,245,215,.5)", "rgba(110,200,130,.55)", "rgba(230,255,240,.7)"); for (let i = 0; i < 4; i++) { const tx = cx - 12 * u + i * 8 * u; x.fillStyle = "#6b4a2a"; x.fillRect(tx - 0.8, by - 6 * u, 1.6, 6 * u); x.fillStyle = i % 2 ? "#3fbf66" : "#58d27a"; x.beginPath(); x.arc(tx, by - 9 * u, 4.2 * u, 0, 7); x.fill(); } break; }
    case "mine": {   // mine: an excavator arm, a conveyor and an ore pile
      x.fillStyle = pal.reg2; x.beginPath(); x.moveTo(cx - 20 * u, by); x.lineTo(cx - 8 * u, by - 12 * u); x.lineTo(cx + 2 * u, by); x.closePath(); x.fill(); x.fillStyle = "#ffb43a"; x.fillRect(cx + 4 * u, by - 10 * u, 12 * u, 8 * u); x.strokeStyle = "#ffb43a"; x.lineWidth = 2.4 * u; x.beginPath(); x.moveTo(cx + 10 * u, by - 10 * u); x.lineTo(cx + 2 * u, by - 26 * u); x.lineTo(cx - 8 * u, by - 18 * u); x.stroke(); x.strokeStyle = "#555b66"; x.lineWidth = 2 * u; x.beginPath(); x.moveTo(cx - 20 * u, by + 2 * u); x.lineTo(cx + 18 * u, by + 5 * u); x.stroke(); x.fillStyle = "rgba(255,200,120,.9)"; x.fillRect(cx - 10 * u, by - 2 * u, 3 * u, 2 * u); break; }
    case "market": {   // trade hub: a pressurised hall with a striped canopy
      slab(x, cx, by, 34 * u, 18 * u, 12 * u, "#7f6a52", "#a98c6a", "#c9ab84"); x.fillStyle = "rgba(255,120,80,.85)"; x.beginPath(); x.moveTo(cx - 18 * u, by - 12 * u); x.lineTo(cx, by - 20 * u); x.lineTo(cx + 18 * u, by - 12 * u); x.lineTo(cx, by - 4 * u); x.closePath(); x.fill(); x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.4; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(cx + i * 6 * u, by - 14 * u - Math.abs(i) * 0); x.lineTo(cx + i * 6 * u, by - 7 * u); x.stroke(); } break; }
    case "lab": {   // research lab: an observatory dome and a dish
      slab(x, cx, by, 30 * u, 16 * u, 10 * u, "#4c5470", "#6a7396", "#8590b4"); dome(x, cx - 4 * u, by - 10 * u, 11 * u, 9 * u, "#f0f3fa", "#aab4cc"); x.strokeStyle = "#d8def0"; x.lineWidth = 1.4 * u; x.beginPath(); x.moveTo(cx + 12 * u, by - 10 * u); x.lineTo(cx + 12 * u, by - 22 * u); x.stroke(); x.fillStyle = "#eef2fb"; x.beginPath(); x.ellipse(cx + 12 * u, by - 24 * u, 8 * u, 3.4 * u, -0.5, 0, 7); x.fill(); x.fillStyle = "rgba(" + gl + "," + (0.5 + 0.4 * Math.sin(T * 3)) + ")"; x.fillRect(cx - 4 * u, by - 14 * u, 2, 2); break; }
    case "med": {   // clinic: a white module with a lit cross
      slab(x, cx, by, 30 * u, 16 * u, 13 * u, "#cfd6de", "#eef2f6", "#ffffff"); x.fillStyle = "#e0433c"; x.fillRect(cx + 4 * u, by - 10 * u, 8 * u, 2.6 * u); x.fillRect(cx + 6.7 * u, by - 12.6 * u, 2.6 * u, 8 * u); windows(x, cx - 8 * u, by - 3 * u, 12 * u, 2 * u, T, 3, gl); break; }
    case "school": {   // school: a tiered module with a flag
      slab(x, cx, by, 32 * u, 18 * u, 10 * u, "#b9a35a", "#d9c070", "#f0dc90"); slab(x, cx, by - 10 * u, 20 * u, 11 * u, 8 * u, "#a89248", "#c8b060", "#e0cc80"); x.strokeStyle = "#ddd"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx, by - 18 * u); x.lineTo(cx, by - 30 * u); x.stroke(); x.fillStyle = "#ff6a3a"; x.fillRect(cx, by - 30 * u, 9 * u, 5 * u); break; }
    case "shield": {   // shield dome: a big translucent energy bubble over a projector
      cyl(x, cx, by, 6 * u, 10 * u, "#566072", "#9aa8bd", "#c7d3e6"); const g = x.createRadialGradient(cx, by - 12 * u, 2, cx, by - 12 * u, 34 * u); g.addColorStop(0, "rgba(" + gl + ",.05)"); g.addColorStop(0.85, "rgba(" + gl + ",.18)"); g.addColorStop(1, "rgba(" + gl + ",.5)"); x.fillStyle = g; x.beginPath(); x.ellipse(cx, by, 34 * u, 28 * u, 0, Math.PI, 0); x.closePath(); x.fill(); x.strokeStyle = "rgba(" + gl + ",.7)"; x.lineWidth = 1.2; x.stroke(); break; }
    case "port": {   // spaceport: a landing pad with a rocket
      x.fillStyle = "#4a515e"; x.beginPath(); x.ellipse(cx, by, 26 * u, 13 * u, 0, 0, 7); x.fill(); x.strokeStyle = "#ffd23f"; x.lineWidth = 1.6; x.setLineDash([4, 3]); x.beginPath(); x.ellipse(cx, by, 20 * u, 10 * u, 0, 0, 7); x.stroke(); x.setLineDash([]);
      const rb = by - 3 * u; x.fillStyle = "#f4f6fa"; x.beginPath(); x.moveTo(cx - 5 * u, rb); x.lineTo(cx - 5 * u, rb - 26 * u); x.lineTo(cx, rb - 36 * u); x.lineTo(cx + 5 * u, rb - 26 * u); x.lineTo(cx + 5 * u, rb); x.closePath(); x.fill(); x.fillStyle = "#d9482b"; x.fillRect(cx - 5 * u, rb - 14 * u, 10 * u, 4 * u); x.fillStyle = "#c33"; x.beginPath(); x.moveTo(cx - 5 * u, rb - 2 * u); x.lineTo(cx - 10 * u, rb + 2 * u); x.lineTo(cx - 5 * u, rb - 10 * u); x.fill(); x.beginPath(); x.moveTo(cx + 5 * u, rb - 2 * u); x.lineTo(cx + 10 * u, rb + 2 * u); x.lineTo(cx + 5 * u, rb - 10 * u); x.fill(); x.fillStyle = "rgba(255,230,160," + (0.5 + 0.4 * Math.sin(T * 8)) + ")"; x.fillRect(cx - 4 * u, by - 18 * u, 0, 0); break; }
    default: slab(x, cx, by, 30 * u, 16 * u, 14 * u, "#556", "#778", "#99a");
  }
  x.restore();
}

/** a pressurised tube between two neighbouring modules */
export function drawTube(x: Cx, x1: number, y1: number, x2: number, y2: number, u: number, era: number) {
  x.save(); x.lineCap = "round"; x.strokeStyle = "rgba(20,26,36,.9)"; x.lineWidth = 7 * u; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
  x.strokeStyle = era === 2 ? "rgba(200,240,255,.85)" : "#b5bdc9"; x.lineWidth = 5 * u; x.beginPath(); x.moveTo(x1, y1 - 0.6 * u); x.lineTo(x2, y2 - 0.6 * u); x.stroke(); x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 1.4 * u; x.beginPath(); x.moveTo(x1, y1 - 2 * u); x.lineTo(x2, y2 - 2 * u); x.stroke(); x.restore();
}

/** the sky of a colony: mountains and craters on the horizon, and from 2500 a space-elevator tether, from 3000 an O'Neill cylinder and an orbital ring */
export function drawSkyline(x: Cx, W: number, H: number, camX: number, T: number, era: number, pal: Pal) {
  x.save(); const hy = H * 0.34;
  x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.moveTo(0, hy + 20); for (let i = 0; i <= 24; i++) { const wx = i * W / 24, k = i + Math.floor(camX * 0.02); x.lineTo(wx, hy - 10 - rnd(k * 3.7) * H * 0.07 - (i % 5 === 0 ? 8 : 0)); } x.lineTo(W, hy + 30); x.lineTo(0, hy + 30); x.closePath(); x.fill();
  x.fillStyle = "rgba(0,0,0,.5)"; x.beginPath(); x.moveTo(0, hy + 30); for (let i = 0; i <= 16; i++) { const k = i + Math.floor(camX * 0.04); x.lineTo(i * W / 16, hy + 4 - rnd(k * 5.3 + 1) * H * 0.05); } x.lineTo(W, hy + 40); x.lineTo(0, hy + 40); x.closePath(); x.fill();
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
