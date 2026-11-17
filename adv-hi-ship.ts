/* Adventure ship maps, graphics round 3 (2026-11-17), High only. adventure-ship.tsx fetches this file with a dynamic import() when Graphics is High, so Lite never downloads or parses it.
   Everything here is painted ONCE into small canvases (a nebula, a lit planet, the explosion sprites); the ship file only draws them. Nothing here touches the simulation. */

const sm = (t: number) => t * t * (3 - 2 * t);
const rgbOf = (s: string) => s.split(",").map(Number);

/** A gas nebula: domain-warped fractal noise for the body of the cloud and ridged noise for bright filaments (wisps and veins instead of round blobs), a hot core where it is dense and dark
 *  dust lanes cutting across it, all in one sprite that is drawn with normal blending over the (near black) sky. 144 x 144 px, about 21k pixels of noise, made once per nebula. */
export function nebulaStart(seed: number, cA: string, cB: string, cHot: string, n = 144) {
  const cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d")!, img = g.createImageData(n, n), d = img.data;
  const P = 32, T = new Float32Array(P * P); let sd = seed * 7919 + 13; for (let i = 0; i < T.length; i++) { sd = (sd * 9301 + 49297) % 233280; T[i] = sd / 233280; }
  const noise = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi), x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P, a = T[y0 * P + x0], b = T[y0 * P + x1], c = T[y1 * P + x0], e = T[y1 * P + x1], t0 = a + (b - a) * xf; return t0 + ((c + (e - c) * xf) - t0) * yf; };
  const fbm = (x: number, y: number) => { let v = 0, a = 0.5; for (let o = 0; o < 4; o++) { v += a * noise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; } return v / 0.9375; };
  const ridged = (x: number, y: number) => { let v = 0, a = 0.5, w = 1; for (let o = 0; o < 4; o++) { const nn = 1 - Math.abs(2 * noise(x, y) - 1), r = nn * nn * w; v += a * r; w = Math.min(1, nn * 2.2); x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; } return v / 0.9; };
  const A = rgbOf(cA), B = rgbOf(cB), H = rgbOf(cHot), sf = seed * 3.7; let j = 0;
  /** paints `rows` more rows; returns the finished canvas on the call that completes it (so the cost can be spread over a few frames), null before that */
  const step = (rows: number): HTMLCanvasElement | null => {
    const j1 = Math.min(n, j + rows);
    for (; j < j1; j++) for (let i = 0; i < n; i++) {
      const u = i / n, v = j / n, qx = fbm(u * 2.6 + sf, v * 2.6), qy = fbm(u * 2.6 + 5.2, v * 2.6 + 1.3 + sf), fil = ridged(u * 2.6 + 1.9 * qx, v * 2.6 + 1.9 * qy), cloud = fbm(u * 2 + 1.3 * qy + sf, v * 2 + 1.3 * qx);
      const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, rr = Math.sqrt(dx * dx + dy * dy), env = rr >= 1 ? 0 : Math.pow(1 - rr, 1.05);
      const dens = Math.min(1, Math.max(0, (0.55 * cloud + 0.75 * fil - 0.34) * 2.3) * env), dust = fbm(u * 4.6 + 11 + sf, v * 4.6 + 3.7), lane = Math.min(1, Math.max(0, (dust - 0.55) * 3.4) * env * 0.85);
      const m = Math.min(1, qx * 1.4), hot = Math.pow(dens, 2.4) * 0.55;
      const gr = (A[0] + (B[0] - A[0]) * m) * (1 - hot) + H[0] * hot, gg = (A[1] + (B[1] - A[1]) * m) * (1 - hot) + H[1] * hot, gb = (A[2] + (B[2] - A[2]) * m) * (1 - hot) + H[2] * hot;
      const ga = dens * 0.8, da = lane * 0.55, a = Math.min(1, ga + da * (1 - ga)), w = ga + da + 1e-6, o = (j * n + i) * 4;
      d[o] = (gr * ga + 3 * da) / w; d[o + 1] = (gg * ga + 4 * da) / w; d[o + 2] = (gb * ga + 14 * da) / w; d[o + 3] = Math.round(a * 255);
    }
    if (j < n) return null; g.putImageData(img, 0, 0); return cv;
  };
  return { step };
}
export function nebulaHi(seed: number, cA: string, cB: string, cHot: string, n = 144): HTMLCanvasElement { return nebulaStart(seed, cA, cB, cHot, n).step(n)!; }

/** The same planet sprite with a stronger day / night line (the star is at the upper left), city lights on the dark side of an earth-like world, and a thin bright scattering rim on the lit limb. */
export function planetHi(base: HTMLCanvasElement, kind: string, r: number): HTMLCanvasElement {
  const n = base.width, c = n / 2, cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d")!; g.drawImage(base, 0, 0);
  g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip();
  const lg = g.createLinearGradient(c - r * 0.85, c - r * 0.75, c + r * 0.95, c + r * 0.85); lg.addColorStop(0, "rgba(255,246,230,.14)"); lg.addColorStop(0.46, "rgba(0,0,0,0)"); lg.addColorStop(0.7, "rgba(0,2,14,.5)"); lg.addColorStop(1, "rgba(0,2,14,.88)"); g.fillStyle = lg; g.fillRect(0, 0, n, n);
  if (kind === "earth") { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 46; i++) { const a = i * 2.399, d = r * (0.3 + 0.6 * ((i * 0.618) % 1)), px = c + Math.cos(a) * d * 0.9 + r * 0.32, py = c + Math.sin(a) * d * 0.9 + r * 0.3; if (Math.hypot(px - c, py - c) > r * 0.93 || (px - c) + (py - c) < r * 0.15) continue; g.fillStyle = "rgba(255,214,140,.55)"; g.fillRect(px, py, Math.max(1, r * 0.03), Math.max(1, r * 0.03)); } }
  g.restore();
  g.save(); g.globalCompositeOperation = "lighter"; const rim = kind === "lava" ? "255,140,70" : kind === "ice" ? "200,240,255" : kind === "earth" ? "130,200,255" : kind === "violet" ? "200,160,255" : "255,215,160";
  const sg = g.createLinearGradient(c - r, c - r, c + r * 0.3, c + r * 0.3); sg.addColorStop(0, `rgba(${rim},.7)`); sg.addColorStop(1, `rgba(${rim},0)`); g.strokeStyle = sg; g.lineWidth = Math.max(1.5, r * 0.045); g.beginPath(); g.arc(c, c, r * 0.985, Math.PI * 0.92, Math.PI * 1.78); g.stroke(); g.restore();
  return cv;
}

/** The explosion sprites: a lobed fireball (white core, yellow, orange, dark red edge) and a billowy smoke puff in two tones (dull, and hot orange for the first moments when the blast is lighting it). */
export function fxSprites() {
  const mk = (n: number, fn: (g: CanvasRenderingContext2D, n: number) => void) => { const cv = document.createElement("canvas"); cv.width = cv.height = n; fn(cv.getContext("2d")!, n); return cv; };
  let sd = 4242; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  const fire = mk(128, (g, n) => { const c = n / 2; for (let i = 0; i < 9; i++) { const a = rnd() * 6.283, d = rnd() * 0.22 * n, bx = c + Math.cos(a) * d, by = c + Math.sin(a) * d, r = (0.22 + rnd() * 0.18) * n, q = g.createRadialGradient(bx, by, 0, bx, by, r); q.addColorStop(0, "rgba(255,250,225,.9)"); q.addColorStop(0.3, "rgba(255,200,90,.7)"); q.addColorStop(0.65, "rgba(255,110,40,.4)"); q.addColorStop(1, "rgba(160,30,10,0)"); g.fillStyle = q; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill(); } });
  const shape = mk(96, (g, n) => { for (let i = 0; i < 11; i++) { const a = rnd() * 6.283, d = rnd() * 0.3 * n, bx = n / 2 + Math.cos(a) * d, by = n / 2 + Math.sin(a) * d * 0.9, r = (0.2 + rnd() * 0.2) * n, q = g.createRadialGradient(bx, by, 0, bx, by, r); q.addColorStop(0, "rgba(255,255,255,.6)"); q.addColorStop(0.6, "rgba(255,255,255,.3)"); q.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = q; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill(); } });
  const tone = (c0: string, c1: string) => mk(96, (g, n) => { g.drawImage(shape, 0, 0); g.globalCompositeOperation = "source-in"; const q = g.createLinearGradient(n * 0.2, 0, n * 0.8, n); q.addColorStop(0, c0); q.addColorStop(1, c1); g.fillStyle = q; g.fillRect(0, 0, n, n); });
  return { fire, puff: tone("rgb(150,140,150)", "rgb(30,28,40)"), puffHot: tone("rgb(255,176,84)", "rgb(214,70,22)") };
}

/** The battle station's surface detail, painted once: panel plating (lighter and darker rectangles), rows of warm windows that crowd into the shadow side, and a deeper terminator toward the lower right.
 *  adventure-ship.tsx draws it inside the station's own clip circle, so it needs no mask of its own. */
export function stationDetail(R: number): HTMLCanvasElement {
  const n = Math.round(R * 2), cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d")!; let sd = 777; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  for (let i = 0; i < 110; i++) { const w = 6 + rnd() * 22, h = 4 + rnd() * 12, x = rnd() * n, y = rnd() * n; g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255," + (0.05 + rnd() * 0.1) + ")" : "rgba(0,0,10," + (0.1 + rnd() * 0.18) + ")"; g.fillRect(x, y, w, h); }
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 260; i++) { const x = rnd() * n, y = rnd() * n, dx = x - n / 2, dy = y - n / 2; if (dx * dx + dy * dy > R * R * 0.9) continue; const shade = Math.max(0, Math.min(1, ((dx + dy) / R + 0.6) / 1.6)); if (rnd() > 0.25 + shade * 0.75) continue; g.fillStyle = "rgba(255," + (190 + Math.floor(rnd() * 50)) + "," + (110 + Math.floor(rnd() * 60)) + "," + (0.35 + shade * 0.5) + ")"; g.fillRect(x, y, 1.6 + rnd() * 1.6, 1.4); }
  g.globalCompositeOperation = "source-over"; const tg = g.createLinearGradient(n * 0.25, n * 0.2, n * 0.95, n * 0.95); tg.addColorStop(0, "rgba(0,0,10,0)"); tg.addColorStop(0.55, "rgba(0,0,10,0)"); tg.addColorStop(1, "rgba(0,0,12,.55)"); g.fillStyle = tg; g.fillRect(0, 0, n, n);
  return cv;
}
