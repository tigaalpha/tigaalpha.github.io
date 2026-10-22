/* adventure-monsters.ts — the ground monsters of Adventure, drawn in code (owner, 2026-10-11: "make the monsters beautiful and varied").
   `paintMonster` draws every type with a ground shadow, a gradient body, a cold rim light and glowing eyes; `paintBoss` draws the end-of-map
   guardian as an armoured horror (horns, a lit core, eyes) in the planet's colours. Nothing here changes how a monster moves or hurts: the AI,
   the stats and the hit boxes stay in adventure.tsx (`MON`); this file only paints. The 11 first types were redrawn, 8 new ones were added. */
type Cx = CanvasRenderingContext2D;
const lg = (x: Cx, x0: number, y0: number, x1: number, y1: number, a: string, b: string, c = "#05070c") => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, c); return g; };
const eye = (x: Cx, ex: number, ey: number, r: number, rgb: string) => { x.save(); x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(ex, ey, 0, ex, ey, r * 3.2); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.3, `rgba(${rgb},.9)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r * 3.2, 0, 7); x.fill(); x.restore(); };
const shadow = (x: Cx, w: number, y: number) => { const g = x.createRadialGradient(0, y, 2, 0, y, w); g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.beginPath(); x.ellipse(0, y, w, 6, 0, 0, 7); x.fill(); };
const poly = (x: Cx, p: number[][]) => { x.beginPath(); x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) x.lineTo(p[i][0], p[i][1]); x.closePath(); };
const rim = (x: Cx, rgb: string) => { x.strokeStyle = `rgba(${rgb},.55)`; x.lineWidth = 1.6; x.stroke(); };

/** returns true when it painted the monster (all types are covered) */
export function paintMonster(x: Cx, m: any, t: number, G: number, hit: boolean, glow: string, tint: string | null): boolean {
  const ph = m.ph || 0, W = "#ffffff", hov = (h: number, a = 6, s = 2.4) => G - h - m.y + Math.sin(t * s + ph) * a;
  const body = (c: string) => (hit ? W : tint || c);
  switch (m.type) {
    case "glowbug": { const y = G - m.y; shadow(x, 28, y);
      x.strokeStyle = "#063d33"; x.lineWidth = 3; for (let i = 0; i < 6; i++) { const lx = -16 + (i % 3) * 14, sd = i < 3 ? -1 : 1, w = Math.sin(t * 12 + i + ph) * 4; x.beginPath(); x.moveTo(lx, y - 8); x.lineTo(lx + sd * 8, y - 2 + w); x.lineTo(lx + sd * 12, y + w * 0.3); x.stroke(); }
      x.fillStyle = hit ? W : lg(x, 0, y - 28, 0, y, "#2fe0b0", tint || "#0e6a56"); x.beginPath(); x.ellipse(0, y - 14, 24, 16, 0, 0, 7); x.fill(); rim(x, glow);
      x.fillStyle = hit ? W : lg(x, 0, y - 36, 0, y - 18, "#7affd8", "#1fae8d"); x.beginPath(); x.ellipse(-4, y - 22, 13, 7, -0.2, 0, 7); x.fill();
      x.fillStyle = `rgba(${glow},.9)`; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-14 + i * 8, y - 10, 2, 0, 7); x.fill(); } eye(x, 14, y - 18, 3, glow); eye(x, 19, y - 14, 2.2, glow); break; }
    case "thornback": { const y = G - m.y; shadow(x, 46, y);
      x.fillStyle = "#1c0a18"; for (let i = 0; i < 4; i++) x.fillRect(-28 + i * 17, y - 10, 9, 12 + Math.sin(t * 6 + i * 1.7 + ph) * 2);
      x.fillStyle = hit ? W : lg(x, 0, y - 44, 0, y - 4, "#8a2a68", tint || "#3a1030"); x.beginPath(); x.moveTo(-40, y - 8); x.quadraticCurveTo(-30, y - 42, 0, y - 40); x.quadraticCurveTo(36, y - 38, 42, y - 14); x.lineTo(32, y - 4); x.lineTo(-36, y - 4); x.closePath(); x.fill(); rim(x, glow);
      x.fillStyle = hit ? W : "#c04a96"; for (let i = 0; i < 6; i++) { poly(x, [[-30 + i * 12, y - 32 + Math.abs(i - 2.5) * 3], [-24 + i * 12, y - 58 + Math.abs(i - 2.5) * 6], [-18 + i * 12, y - 32 + Math.abs(i - 2.5) * 3]]); x.fill(); }
      x.fillStyle = "#1c0a18"; poly(x, [[30, y - 28], [48, y - 22], [44, y - 10], [30, y - 12]]); x.fill(); eye(x, 36, y - 20, 3.4, glow); break; }
    case "rustcrawler": { const y = G - m.y; shadow(x, 34, y);
      x.strokeStyle = "#2a1408"; x.lineWidth = 3; for (let i = 0; i < 6; i++) { const lx = -22 + (i % 3) * 16, sd = i < 3 ? -1 : 1, ph2 = Math.sin(t * 16 + i * 1.6 + ph) * 5; x.beginPath(); x.moveTo(lx, y - 12); x.lineTo(lx + sd * 6, y - 4 + ph2 * 0.4); x.lineTo(lx + sd * 10, y + ph2 * 0.3); x.stroke(); }
      x.fillStyle = hit ? W : lg(x, 0, y - 34, 0, y - 4, "#c07a3a", tint || "#5a2c12"); x.beginPath(); x.moveTo(-30, y - 8); x.quadraticCurveTo(-22, y - 36, 4, y - 32); x.quadraticCurveTo(32, y - 28, 32, y - 8); x.closePath(); x.fill(); rim(x, "255,150,60");
      x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 1.4; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-14 + i * 14, y - 32 + i * 2); x.lineTo(-10 + i * 14, y - 8); x.stroke(); }
      x.fillStyle = hit ? W : "#3a1c0c"; poly(x, [[26, y - 18], [44, y - 24], [40, y - 10]]); x.fill(); eye(x, 24, y - 20, 3, "255,170,60"); break; }
    case "magnet": { const y = G - m.y; shadow(x, 30, y);
      x.fillStyle = hit ? W : lg(x, -14, 0, 14, 0, "#6a7482", "#2b3038"); x.fillRect(-13, y - 56, 26, 56); x.fillStyle = hit ? W : "#4a525e"; x.fillRect(-22, y - 10, 44, 10);
      x.strokeStyle = "#8a96a6"; x.lineWidth = 1.4; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-13, y - 16 - i * 14); x.lineTo(13, y - 16 - i * 14); x.stroke(); }
      x.strokeStyle = "#ff9a3c"; x.lineWidth = 4; x.beginPath(); x.arc(0, y - 68, 17, Math.PI * 0.15, Math.PI * 0.85, true); x.stroke(); x.beginPath(); x.arc(0, y - 68, 17, Math.PI * 1.15, Math.PI * 1.85, true); x.stroke();
      const pu = 0.5 + 0.5 * Math.sin(t * 5 + ph); eye(x, 0, y - 68, 5 + pu * 2, "255,170,70"); x.globalCompositeOperation = "lighter"; x.strokeStyle = `rgba(255,170,70,${0.15 + pu * 0.25})`; x.lineWidth = 1.5; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(0, y - 68, 26 + i * 9 + pu * 3, -0.5 + i, 0.5 + i); x.stroke(); } x.globalCompositeOperation = "source-over"; break; }
    case "shardling": { const y = G - m.y - 2 + Math.abs(Math.sin(t * 6 + ph)) * -3; shadow(x, 30, G - m.y);
      for (let i = 0; i < 5; i++) { const bx = -20 + i * 10, h = 24 + (i % 2) * 16; x.fillStyle = hit ? W : lg(x, bx - 7, y - h, bx + 7, y, "#d8f6ff", "#7fd0ff", "#2a6a96"); poly(x, [[bx - 7, y], [bx, y - h], [bx + 7, y]]); x.fill(); rim(x, "190,240,255"); }
      x.fillStyle = hit ? W : lg(x, 0, y - 22, 0, y, "#4aa0d4", tint || "#1d5a86"); poly(x, [[-24, y], [-10, y - 20], [10, y - 18], [26, y]]); x.fill(); rim(x, glow); eye(x, 12, y - 10, 3, "230,255,255"); break; }
    case "frostcaster": { const y = hov(56, 6, 2.2);
      x.fillStyle = hit ? W : lg(x, 0, y - 28, 0, y + 28, "#e8faff", "#7fcdf5", "#1d5a86"); poly(x, [[0, y - 30], [18, y], [0, y + 30], [-18, y]]); x.fill(); rim(x, "190,240,255");
      x.fillStyle = hit ? W : "#3b8fc4"; poly(x, [[0, y - 16], [9, y], [0, y + 16], [-9, y]]); x.fill();
      x.strokeStyle = "rgba(190,240,255,.8)"; x.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 1.4 + i * 2.1 + ph; x.beginPath(); x.arc(0, y, 30, a, a + 0.7); x.stroke(); }
      x.fillStyle = hit ? W : "#bfeaff"; for (const sd of [-1, 1]) poly(x, [[sd * 16, y - 6], [sd * 34, y - 18 + Math.sin(t * 3) * 3], [sd * 22, y + 2]]), x.fill(); eye(x, 8, y - 2, 3.6, "230,255,150"); break; }
    case "magmaling": { const y = G - m.y, wob = Math.sin(t * 9 + ph) * 2; shadow(x, 30, y);
      x.fillStyle = hit ? W : lg(x, 0, y - 32, 0, y, "#ff7a2a", tint || "#7a1a0a", "#2a0804"); x.beginPath(); x.moveTo(-26, y); x.quadraticCurveTo(-30 + wob, y - 34, 0, y - 32); x.quadraticCurveTo(30 - wob, y - 34, 26, y); x.closePath(); x.fill(); rim(x, "255,160,60");
      x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,210,70,.85)"; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-14 + i * 9, y - 12 - (i % 2) * 8, 3 + Math.sin(t * 6 + i) * 1, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over";
      x.strokeStyle = "#ffd23f"; x.lineWidth = 2; x.beginPath(); x.moveTo(-10, y - 26); x.lineTo(-4, y - 16); x.lineTo(-12, y - 8); x.stroke(); eye(x, 14, y - 18, 3, "255,245,190"); break; }
    case "flarecaster": { const y = hov(56, 6, 2.4);
      x.fillStyle = hit ? W : lg(x, 0, y - 26, 0, y + 26, "#ff9a4a", "#7a2410", "#1a0603"); x.beginPath(); x.ellipse(0, y, 17, 26, 0, 0, 7); x.fill(); rim(x, "255,150,60");
      x.fillStyle = hit ? W : "#2a0a06"; poly(x, [[-12, y - 22], [0, y - 44], [12, y - 22]]); x.fill();
      x.globalCompositeOperation = "lighter"; for (let i = 0; i < 6; i++) { const a = t * 3 + i * 1.05 + ph; x.fillStyle = `rgba(255,${110 + i * 22},40,.85)`; x.beginPath(); x.arc(Math.cos(a) * 24, y + Math.sin(a) * 12, 4.5, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over"; eye(x, 8, y - 4, 3.8, "255,230,140"); break; }
    case "scrapgolem": { const y = G - m.y; shadow(x, 48, y);
      x.fillStyle = hit ? W : "#2c2638"; x.fillRect(-26, y - 26, 18, 26); x.fillRect(8, y - 26, 18, 26);
      x.fillStyle = hit ? W : lg(x, -36, y - 76, 36, y - 20, "#7a6f9c", "#3a3350", "#17131f"); poly(x, [[-36, y - 70], [36, y - 70], [30, y - 22], [-30, y - 22]]); x.fill(); rim(x, glow);
      x.fillStyle = hit ? W : "#4a4160"; for (const sd of [-1, 1]) { x.fillRect(sd * 46 - 9, y - 66, 18, 46); x.beginPath(); x.arc(sd * 46, y - 18, 13, 0, 7); x.fill(); }
      x.fillStyle = hit ? W : "#6b5f8c"; poly(x, [[-18, y - 92], [18, y - 92], [20, y - 70], [-20, y - 70]]); x.fill();
      x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-26, y - 50); x.lineTo(26, y - 40); x.moveTo(-20, y - 34); x.lineTo(16, y - 30); x.stroke(); eye(x, 8, y - 82, 3.4, "200,150,255"); eye(x, -6, y - 82, 3, "200,150,255"); break; }
    case "drone": { const y = hov(60, 5, 3);
      x.fillStyle = hit ? W : lg(x, 0, y - 12, 0, y + 12, "#6a5f8c", "#38304e", "#120f1c"); x.beginPath(); x.ellipse(0, y, 24, 12, 0, 0, 7); x.fill(); rim(x, "160,130,255");
      x.strokeStyle = "#8a7fb0"; x.lineWidth = 3; x.beginPath(); x.moveTo(-30, y - 11); x.lineTo(30, y - 11); x.stroke(); x.save(); x.translate(0, y - 14); x.scale(Math.cos(t * 30), 1); x.fillStyle = "rgba(190,200,255,.5)"; x.fillRect(-30, -1.5, 60, 3); x.restore();
      x.fillStyle = hit ? W : "#241e36"; poly(x, [[8, y + 4], [26, y + 12], [14, y + 14]]); x.fill(); eye(x, 12, y + 1, 3.6, "255,90,120"); break; }
    case "sporecaster": { const y = hov(56, 6, 2.4);
      x.strokeStyle = hit ? W : "#6a46cc"; x.lineWidth = 2.5; for (let i = 0; i < 6; i++) { const lx = -16 + i * 6.4; x.beginPath(); x.moveTo(lx, y + 10); x.quadraticCurveTo(lx + Math.sin(t * 3 + i + ph) * 8, y + 28, lx + Math.sin(t * 3 + i + 2 + ph) * 10, y + 42); x.stroke(); }
      x.fillStyle = hit ? W : lg(x, 0, y - 26, 0, y + 12, "#a888ff", tint || "#2a1a66", "#0e0a24"); x.beginPath(); x.ellipse(0, y, 28, 22, 0, Math.PI, 0); x.lineTo(28, y + 10); x.lineTo(-28, y + 10); x.closePath(); x.fill(); rim(x, "190,150,255");
      x.fillStyle = hit ? W : "rgba(190,150,255,.5)"; x.beginPath(); x.ellipse(0, y - 6, 18, 12, 0, Math.PI, 0); x.fill(); x.fillStyle = `rgb(${glow})`; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-12 + i * 8, y - 8 + (i % 2) * 3, 3, 0, 7); x.fill(); } eye(x, 15, y + 2, 4, "233,255,154"); break; }
    case "hound": { const y = G - m.y; shadow(x, 34, y); const run = Math.sin(t * 14 + ph);
      x.strokeStyle = "#120a1c"; x.lineWidth = 5; x.lineCap = "round"; for (const [lx, o] of [[-18, 0], [-8, 2], [14, 1], [24, 3]] as number[][]) { x.beginPath(); x.moveTo(lx, y - 16); x.lineTo(lx + run * 6 * (o % 2 ? 1 : -1), y - 6); x.lineTo(lx + run * 9 * (o % 2 ? 1 : -1), y); x.stroke(); } x.lineCap = "butt";
      x.fillStyle = hit ? W : lg(x, 0, y - 36, 0, y - 6, "#5a3a7a", tint || "#241238", "#0a0610"); x.beginPath(); x.ellipse(0, y - 20, 28, 13, -0.08, 0, 7); x.fill(); rim(x, glow);
      x.fillStyle = hit ? W : "#a04aff"; for (let i = 0; i < 5; i++) { poly(x, [[-20 + i * 9, y - 30], [-16 + i * 9, y - 40 - (i % 2) * 4], [-12 + i * 9, y - 30]]); x.fill(); }
      x.fillStyle = hit ? W : "#241238"; poly(x, [[22, y - 30], [46, y - 24], [48, y - 16], [40, y - 12], [22, y - 14]]); x.fill(); x.fillStyle = "#f4efe6"; poly(x, [[40, y - 14], [43, y - 8], [46, y - 14]]); x.fill(); eye(x, 36, y - 24, 3, glow); break; }
    case "mantis": { const y = G - m.y; shadow(x, 30, y); const sw = Math.sin(t * 3 + ph) * 0.25;
      x.strokeStyle = "#1c3a14"; x.lineWidth = 4; x.beginPath(); x.moveTo(-6, y - 30); x.lineTo(-14, y - 14); x.lineTo(-10, y); x.moveTo(6, y - 30); x.lineTo(12, y - 12); x.lineTo(16, y); x.stroke();
      x.fillStyle = hit ? W : lg(x, 0, y - 70, 0, y - 24, "#7ae04a", tint || "#2a6a1c", "#0c2008"); poly(x, [[-9, y - 30], [9, y - 30], [6, y - 62], [-6, y - 62]]); x.fill(); rim(x, "170,255,120");
      for (const sd of [-1, 1]) { x.save(); x.translate(sd * 8, y - 56); x.rotate(sd * (0.7 + sw)); x.fillStyle = hit ? W : "#3a8a22"; poly(x, [[-3, 0], [3, 0], [3, 22], [-3, 22]]); x.fill(); x.fillStyle = hit ? W : "#e8f4d8"; poly(x, [[-3, 22], [3, 22], [0, 46]]); x.fill(); x.restore(); }
      x.fillStyle = hit ? W : "#2a6a1c"; poly(x, [[-9, y - 62], [9, y - 62], [12, y - 74], [0, y - 80], [-12, y - 74]]); x.fill(); eye(x, -4, y - 71, 2.4, "255,230,90"); eye(x, 5, y - 71, 2.4, "255,230,90"); break; }
    case "brute": { const y = G - m.y; shadow(x, 54, y);
      x.fillStyle = hit ? W : "#241a2c"; x.fillRect(-26, y - 28, 20, 28); x.fillRect(6, y - 28, 20, 28);
      x.fillStyle = hit ? W : lg(x, -40, y - 86, 40, y - 26, "#7a5a6a", tint || "#3a2a3a", "#120c14"); poly(x, [[-40, y - 76], [40, y - 76], [32, y - 24], [-32, y - 24]]); x.fill(); rim(x, glow);
      for (const sd of [-1, 1]) { x.save(); x.translate(sd * 46, y - 74); x.rotate(sd * (0.12 + Math.sin(t * 2.4 + ph + sd) * 0.1)); x.fillStyle = hit ? W : "#3a2a3a"; x.fillRect(-9, 0, 18, 44); x.fillStyle = hit ? W : "#5a4050"; x.beginPath(); x.arc(0, 50, 17, 0, 7); x.fill(); x.fillStyle = "#e8dcc8"; for (let k = -1; k <= 1; k++) { poly(x, [[k * 8 - 3, 62], [k * 8, 72], [k * 8 + 3, 62]]); x.fill(); } x.restore(); }
      x.fillStyle = hit ? W : "#2a1c2c"; x.beginPath(); x.ellipse(0, y - 92, 16, 14, 0, 0, 7); x.fill(); x.fillStyle = "#e8dcc8"; poly(x, [[-12, y - 100], [-26, y - 124], [-6, y - 104]]); x.fill(); poly(x, [[12, y - 100], [26, y - 124], [6, y - 104]]); x.fill();
      x.globalCompositeOperation = "lighter"; x.strokeStyle = `rgba(${glow},.85)`; x.lineWidth = 2; x.beginPath(); x.moveTo(-14, y - 66); x.lineTo(-4, y - 54); x.lineTo(-12, y - 40); x.moveTo(10, y - 70); x.lineTo(4, y - 56); x.lineTo(14, y - 44); x.stroke(); x.globalCompositeOperation = "source-over"; eye(x, -5, y - 93, 2.8, glow); eye(x, 6, y - 93, 2.8, glow); break; }
    case "burrower": { const y = G - m.y; const up = 40 + Math.abs(Math.sin(t * 2.2 + ph)) * 26; shadow(x, 34, y);
      x.fillStyle = "#1a1210"; for (let i = 0; i < 6; i++) { poly(x, [[-30 + i * 11, y], [-26 + i * 11, y - 8 - (i % 2) * 5], [-22 + i * 11, y]]); x.fill(); }
      for (let i = 0; i < 5; i++) { const sy = y - 6 - i * (up / 5), r = 16 - i * 1.6; x.fillStyle = hit ? W : lg(x, -r, sy - r, r, sy, "#c09a7a", tint || "#6a4a3a", "#1a1210"); x.beginPath(); x.ellipse(Math.sin(t * 2 + i * 0.6 + ph) * 3, sy, r, 9, 0, 0, 7); x.fill(); rim(x, "255,190,120"); }
      const hy = y - up - 6; x.fillStyle = "#1a0606"; x.beginPath(); x.ellipse(0, hy, 14, 9, 0, 0, 7); x.fill(); x.fillStyle = "#efe8da"; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; poly(x, [[Math.cos(a) * 14, hy + Math.sin(a) * 9], [Math.cos(a) * 7, hy + Math.sin(a) * 4.5], [Math.cos(a + 0.28) * 14, hy + Math.sin(a + 0.28) * 9]]); x.fill(); } eye(x, 0, hy, 2.4, "255,90,60"); break; }
    case "swarmer": { const y = G - m.y; shadow(x, 26, y);
      for (let i = 0; i < 5; i++) { const bx = -20 + i * 10, by = y - 8 - Math.abs(Math.sin(t * 9 + i * 1.4 + ph)) * 8 - (i % 2) * 6;
        x.strokeStyle = "#241408"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(bx - 4, by + 2); x.lineTo(bx - 7, by + 8); x.moveTo(bx + 4, by + 2); x.lineTo(bx + 7, by + 8); x.stroke();
        x.fillStyle = hit ? W : lg(x, 0, by - 7, 0, by + 5, "#ffb04a", tint || "#8a4a14"); x.beginPath(); x.ellipse(bx, by, 7, 5, 0, 0, 7); x.fill(); eye(x, bx + 3, by - 1, 1.3, "255,240,150"); x.fillStyle = "rgba(255,255,255,.4)"; x.beginPath(); x.ellipse(bx - 2, by - 6, 6, 2, 0.3, 0, 7); x.fill(); }
      break; }
    case "wraith": { const y = hov(62, 8, 2); x.globalAlpha = hit ? 1 : 0.92;
      x.fillStyle = hit ? W : lg(x, 0, y - 30, 0, y + 40, "#cfeaff", tint || "#5a7ac8", "rgba(40,50,120,0)"); x.beginPath(); x.moveTo(-20, y); x.quadraticCurveTo(-22, y - 34, 0, y - 36); x.quadraticCurveTo(22, y - 34, 20, y); for (let i = 0; i < 5; i++) x.lineTo(20 - i * 10, y + 24 + Math.sin(t * 4 + i * 1.4 + ph) * 8 + (i % 2) * 8); x.closePath(); x.fill(); rim(x, "190,220,255");
      x.fillStyle = "#06081a"; x.beginPath(); x.ellipse(-6, y - 12, 4, 7, 0.1, 0, 7); x.ellipse(8, y - 12, 4, 7, -0.1, 0, 7); x.fill(); eye(x, -6, y - 12, 2, "180,220,255"); eye(x, 8, y - 12, 2, "180,220,255");
      x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(160,200,255,.5)"; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(Math.sin(t * 2 + i * 1.7 + ph) * 24, y + 20 + ((t * 30 + i * 20) % 40), 2, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; break; }
    case "spitter": { const y = G - m.y; shadow(x, 34, y); const pf = 1 + Math.sin(t * 3 + ph) * 0.05;
      x.fillStyle = hit ? W : lg(x, 0, y - 36, 0, y, "#9ae04a", tint || "#3a6a1c", "#0e2008"); x.beginPath(); x.ellipse(0, y - 18, 28 * pf, 18 * pf, 0, 0, 7); x.fill(); rim(x, "190,255,120");
      x.fillStyle = hit ? W : "#4a8a22"; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(-16 + i * 7, y - 28 + (i % 2) * 5, 3.2, 0, 7); x.fill(); }
      x.fillStyle = hit ? W : "#2a4a14"; x.beginPath(); x.ellipse(24, y - 20, 14, 10, 0.1, 0, 7); x.fill(); x.fillStyle = "#1a0406"; x.beginPath(); x.ellipse(32, y - 18, 7, 4, 0, 0, 7); x.fill();
      x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(170,255,90,.8)"; x.beginPath(); x.arc(38, y - 18, 3 + Math.sin(t * 8) * 1.2, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; eye(x, 20, y - 30, 3, "255,240,90"); break; }
    case "eyeball": { const y = hov(60, 7, 2.2);
      for (let i = 0; i < 6; i++) { x.strokeStyle = hit ? W : "#3a1038"; x.lineWidth = 3; x.beginPath(); x.moveTo((i - 2.5) * 6, y + 14); for (let j = 1; j <= 4; j++) x.lineTo((i - 2.5) * 6 + Math.sin(t * 3 + i + j) * 4 * j * 0.6, y + 14 + j * 9); x.stroke(); }
      x.fillStyle = hit ? W : lg(x, 0, y - 24, 0, y + 22, "#d8a0e0", tint || "#5a1a58", "#14061a"); x.beginPath(); x.ellipse(0, y, 25, 23, 0, 0, 7); x.fill(); rim(x, "255,150,230");
      x.fillStyle = "#f4ecf0"; x.beginPath(); x.ellipse(2, y, 16, 14, 0, 0, 7); x.fill(); const lx = 2 + Math.cos(t * 0.8 + ph) * 3; x.fillStyle = hit ? "#ddd" : "#d4306a"; x.beginPath(); x.arc(lx + 5, y, 8, 0, 7); x.fill(); x.fillStyle = "#08020a"; x.beginPath(); x.ellipse(lx + 5, y, 2.4, 7, 0, 0, 7); x.fill(); eye(x, lx + 5, y, 2, "255,80,150"); break; }
    case "capling": { const y = G - m.y; shadow(x, 30, y); const sw = Math.sin(t * 3 + ph);
      x.strokeStyle = hit ? W : "#e08a2a"; x.lineWidth = 2.6; x.lineCap = "round";
      for (const [hx, d] of [[-6, -1], [6, 1]] as number[][]) { x.beginPath(); x.moveTo(hx, y - 26); x.lineTo(hx + d * 10, y - 12 + sw * 2); x.lineTo(hx + d * 6, y); x.stroke(); }
      for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 6, y - 40); x.lineTo(d * 18, y - 28 + sw * 3 * d); x.lineTo(d * 16, y - 14 + sw * 3 * d); x.stroke(); x.beginPath(); x.moveTo(d * 16, y - 14 + sw * 3 * d); x.lineTo(d * 20, y - 6 + sw * 3 * d); x.lineTo(d * 13, y - 7 + sw * 3 * d); x.stroke(); }
      x.fillStyle = hit ? W : lg(x, 0, y - 46, 0, y - 22, "#d8d4cc", tint || "#8a8680", "#2a2824"); poly(x, [[-5, y - 44], [5, y - 44], [7, y - 22], [-7, y - 22]]); x.fill(); rim(x, "255,230,200");
      x.fillStyle = hit ? W : lg(x, 0, y - 60, 0, y - 44, "#e4e0d8", tint || "#9a968e", "#3a3630"); x.beginPath(); x.ellipse(0, y - 52, 30, 7, 0, 0, 7); x.fill(); rim(x, "255,230,200");
      eye(x, -22, y - 52, 3.4, "255,255,255"); eye(x, 22, y - 52, 3.4, "255,255,255"); break; }
    case "manthood": { const y = G - m.y; shadow(x, 30, y); const sw = Math.sin(t * 2.4 + ph);
      x.strokeStyle = hit ? W : "#5a5148"; x.lineWidth = 3.5; x.lineCap = "round";
      x.beginPath(); x.moveTo(-4, y - 36); x.lineTo(-8, y - 16); x.lineTo(-6, y); x.moveTo(4, y - 36); x.lineTo(8, y - 16); x.lineTo(10, y); x.stroke();
      x.strokeStyle = hit ? W : "#8a7a64"; x.lineWidth = 2; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 8, y - 56); x.quadraticCurveTo(d * 24, y - 40 + sw * 6, d * 30 + sw * 8, y - 14); x.stroke(); }
      x.fillStyle = hit ? W : lg(x, 0, y - 60, 0, y - 34, "#9a9080", tint || "#5a5248", "#1a1612"); poly(x, [[-5, y - 58], [5, y - 58], [3, y - 36], [-3, y - 36]]); x.fill(); rim(x, "220,200,170");
      x.fillStyle = hit ? W : lg(x, 0, y - 96, 0, y - 56, "#7a6f60", tint || "#4a4238", "#14100c"); poly(x, [[0, y - 98], [26, y - 78], [20, y - 60], [0, y - 66], [-20, y - 60], [-26, y - 78]]); x.fill(); rim(x, "220,200,170");
      x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 1; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 4, y - 94); x.lineTo(i * 9, y - 64); x.stroke(); }
      x.fillStyle = hit ? W : "#d8d0c0"; x.beginPath(); x.ellipse(0, y - 70, 8, 10, 0, 0, 7); x.fill(); eye(x, -3, y - 71, 2.2, "255,80,80"); eye(x, 3, y - 71, 2.2, "255,80,80"); break; }
    case "domestalker": { const y = G - m.y; shadow(x, 38, y); const run = Math.sin(t * 9 + ph);
      x.strokeStyle = hit ? W : "#16181c"; x.lineWidth = 4; x.lineCap = "round";
      for (const [lx, o] of [[-18, 0], [-6, 1], [12, 0], [24, 1]] as number[][]) { x.beginPath(); x.moveTo(lx, y - 20); x.lineTo(lx + 8 + run * 5 * (o ? -1 : 1), y - 28); x.lineTo(lx + 4 + run * 6 * (o ? -1 : 1), y); x.stroke(); }
      x.beginPath(); x.moveTo(-26, y - 24); x.quadraticCurveTo(-52, y - 38 + run * 4, -60, y - 10); x.stroke();
      x.fillStyle = hit ? W : "#16181c"; poly(x, [[-60, y - 10], [-66, y - 4], [-56, y - 14]]); x.fill();
      x.fillStyle = hit ? W : lg(x, 0, y - 40, 0, y - 12, "#3a4048", tint || "#1c2026", "#06080a"); x.beginPath(); x.ellipse(-4, y - 24, 30, 11, -0.08, 0, 7); x.fill(); rim(x, "120,200,220");
      x.fillStyle = hit ? W : "#22262c"; poly(x, [[14, y - 34], [58, y - 38], [66, y - 26], [48, y - 18], [22, y - 18]]); x.fill(); rim(x, "120,200,220");
      x.fillStyle = "#e8ecee"; for (let i = 0; i < 4; i++) { poly(x, [[46 + i * 4, y - 20], [48 + i * 4, y - 14], [50 + i * 4, y - 20]]); x.fill(); }
      eye(x, 44, y - 29, 2.6, "120,255,230"); break; }
    default: return false;
  }
  return true;
}

/** the end-of-map guardian: an armoured horror. `P` gives the planet's colours; `b.tele` flashes red before an attack, `b.hurt` flashes white */
export function paintBoss(x: Cx, b: any, t: number, P: any, G: number): void {
  const bob = Math.sin(t * 2) * 3, y = G - 8 + bob, hit = b.hurt > 0, warn = b.tele > 0, lift = b.state === "slam" && b.tele > 0 ? -22 * Math.min(1, (0.6 - b.tele) * 3) : 0, glow = P.glow, acc = P.acc;
  x.save(); x.translate(b.x, 0); x.scale(b.face < 0 ? -1 : 1, 1); shadow(x, 100, G);
  x.fillStyle = hit ? "#fff" : "#080b12"; for (let i = 0; i < 4; i++) { const lx = -56 + i * 36; poly(x, [[lx, y - 22], [lx + 20, y - 22], [lx + 22, y + 2], [lx - 4, y + 2]]); x.fill(); }   // legs
  const base = hit ? "#fff" : warn ? "#7a2030" : "#202838"; x.fillStyle = hit ? "#fff" : lg(x, -80, y - 130 + lift, 80, y - 10 + lift, warn ? "#b04050" : "#3c4a64", base, "#070a10");
  x.beginPath(); x.moveTo(-80, y - 14 + lift); x.quadraticCurveTo(-76, y - 122 + lift, 0, y - 116 + lift); x.quadraticCurveTo(80, y - 112 + lift, 88, y - 22 + lift); x.lineTo(62, y - 8 + lift); x.lineTo(-62, y - 8 + lift); x.closePath(); x.fill(); rim(x, glow);
  x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = 2; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 24, y - 108 + lift); x.lineTo(i * 20, y - 14 + lift); x.stroke(); }
  x.fillStyle = hit ? "#fff" : `rgba(${glow},.7)`; for (let i = 0; i < 7; i++) { const hh = 34 + (i % 3) * 12; poly(x, [[-60 + i * 20, y - 100 + lift + Math.abs(i - 3) * 5], [-52 + i * 20, y - 100 - hh + lift + Math.abs(i - 3) * 7], [-44 + i * 20, y - 100 + lift + Math.abs(i - 3) * 5]]); x.fill(); }   // dorsal spines
  x.fillStyle = hit ? "#fff" : "#10141e"; poly(x, [[34, y - 100 + lift], [60, y - 140 + lift], [52, y - 98 + lift]]); x.fill(); poly(x, [[10, y - 108 + lift], [20, y - 152 + lift], [30, y - 106 + lift]]); x.fill();   // horns
  const pu = 0.6 + 0.4 * Math.sin(t * 5); x.globalCompositeOperation = "lighter"; const cg = x.createRadialGradient(-6, y - 64 + lift, 0, -6, y - 64 + lift, 36); cg.addColorStop(0, "rgba(255,255,255,.9)"); cg.addColorStop(0.3, warn ? `rgba(255,70,90,${pu})` : `rgba(${acc},${pu})`); cg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = cg; x.beginPath(); x.arc(-6, y - 64 + lift, 36, 0, 7); x.fill();
  x.fillStyle = warn ? "rgba(255,70,90,.95)" : `rgba(${acc},.95)`; x.beginPath(); x.arc(46, y - 76 + lift, 9, 0, 7); x.arc(30, y - 82 + lift, 6, 0, 7); x.fill(); x.fillStyle = `rgba(${glow},.55)`; x.fillRect(-34, y - 30 + lift, 62, 5); x.globalCompositeOperation = "source-over";
  x.restore();
}

/** A Kindred elder (Act 2): a friendly alien who stands where a knowledge beacon would. Tall and slender, teal and gold, with a halo ring and a trailing cloak; dimmed once its question has been asked. */
export function paintKindred(x: CanvasRenderingContext2D, px: number, ground: number, t: number, used: boolean) {
  x.save(); x.translate(px, ground);
  const a = used ? 0.45 : 1, bob = Math.sin(t * 1.6) * 3;
  x.globalAlpha = a;
  // ground glow
  x.globalCompositeOperation = "lighter"; const gl = x.createRadialGradient(0, -6, 2, 0, -6, 70); gl.addColorStop(0, "rgba(141,255,220,.5)"); gl.addColorStop(1, "rgba(141,255,220,0)"); x.fillStyle = gl; x.beginPath(); x.ellipse(0, -4, 70, 16, 0, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  // cloak: two long tapering panels that sway
  const sw = Math.sin(t * 1.3) * 6;
  const cg = x.createLinearGradient(0, -110, 0, 0); cg.addColorStop(0, "#d8fff1"); cg.addColorStop(0.45, "#46c7b0"); cg.addColorStop(1, "#164f56"); x.fillStyle = cg;
  x.beginPath(); x.moveTo(-14, -96 + bob); x.quadraticCurveTo(-30 + sw, -50, -26 + sw * 1.4, 0); x.lineTo(26 + sw * 1.4, 0); x.quadraticCurveTo(30 + sw, -50, 14, -96 + bob); x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,226,150,.9)"; x.lineWidth = 2; x.beginPath(); x.moveTo(-10, -92 + bob); x.quadraticCurveTo(-18 + sw * 0.6, -50, -14 + sw, -4); x.moveTo(10, -92 + bob); x.quadraticCurveTo(18 + sw * 0.6, -50, 14 + sw, -4); x.stroke();
  // head: tall oval with two soft eyes
  const hg = x.createRadialGradient(-4, -118 + bob, 2, 0, -112 + bob, 24); hg.addColorStop(0, "#f2fffb"); hg.addColorStop(1, "#6fd8c4"); x.fillStyle = hg; x.beginPath(); x.ellipse(0, -112 + bob, 14, 21, 0, 0, 7); x.fill();
  x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,230,160,.95)"; x.beginPath(); x.ellipse(-5, -112 + bob, 2.6, 4, 0, 0, 7); x.ellipse(5, -112 + bob, 2.6, 4, 0, 0, 7); x.fill();
  // halo ring
  x.strokeStyle = "rgba(255,226,150," + (0.6 + 0.3 * Math.sin(t * 3)) + ")"; x.lineWidth = 2.4; x.beginPath(); x.ellipse(0, -140 + bob, 17, 5, 0, 0, 7); x.stroke();
  // little drifting glyphs, the way the Kindred "speak"
  if (!used) for (let i = 0; i < 4; i++) { const p = ((t * 0.35 + i / 4) % 1); x.fillStyle = "rgba(190,255,235," + (0.8 * (1 - p)) + ")"; x.fillRect(-26 + i * 17, -150 - p * 26 + bob, 4, 4); }
  x.restore();
}
