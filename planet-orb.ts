/* Planet pictures for the Adventure map menu (owner, 2026-10-16: "make them round again like real planets, in the colour of each planet or star").
   Each map's orb is a small lit sphere painted once from procedural noise (periodic value noise sampled by longitude / latitude, so no seam),
   with a terminator, limb darkening and, for Saturn, a ring. Own procedural art after photographs; Proxima b and the made-up worlds are imagined. */
const KIND: Record<string, string> = {
  marscolony: "mars", colmars: "mars", ranchmars: "mars", moonhe3: "moon", moonbase: "moon", colmoon: "moon", spaceranch: "moon", mercury: "mercury", venussky: "venus",
  jupitergas: "jupiter", gasskim: "jupiter", gaspump: "jupiter", gasbuild: "jupiter", saturnrings: "saturn", titanassault: "titan", titancolony: "titan", coltitan: "titan", ranchtitan: "titan",
  colproxima: "proxima", ranchproxima: "proxima", shipbuild: "earth", departure: "earth", asteroids: "rock", minebuild: "rock", cobalt: "rock",
  helios: "star", starharvest: "star", dyson: "star", dysonbuild: "star", dysondock: "star", solarcharge: "star", blackhole: "blackhole", kryo: "ice", pyra: "lava", jovia: "jupiter",
};
const hash = (a: number, b: number, s: number) => { const n = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
function vn(u: number, v: number, per: number, sd: number) {
  const x = u * per, y = v * per * 0.5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash(((a % per) + per) % per, b, sd);
  return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
}
const fbm = (u: number, v: number, per: number, sd: number, oct = 4) => { let a = 0, amp = 0.5, tot = 0, p = per; for (let o = 0; o < oct; o++) { a += vn(u, v, p, sd + o * 7) * amp; tot += amp; amp *= 0.5; p *= 2; } return a / tot; };
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hexRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return [120, 150, 190]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function surface(kind: string, u: number, v: number, c0: number[], c2: number[]): number[] {
  const lat = Math.abs(v - 0.5) * 2;
  switch (kind) {
    case "mars": { const big = fbm(u, v, 3, 11, 3), fine = fbm(u, v, 12, 21, 3), d = Math.max(0, Math.min(1, (big - 0.46) * 4.5)); let c = mix([196, 112, 62], [214, 150, 96], fine); c = mix(c, [78, 44, 34], d * 0.8); return mix(c, [244, 240, 236], Math.min(1, Math.max(0, lat - 0.86) * 12)); }
    case "moon": { const m = Math.max(0, Math.min(1, (fbm(u, v, 3, 61, 3) - 0.5) * 5)); return mix(mix([176, 172, 166], [210, 206, 198], fbm(u, v, 12, 71, 3)), [86, 88, 94], m * 0.8); }
    case "mercury": { const g = fbm(u, v, 9, 41, 4); return mix([92, 88, 84], [168, 162, 154], g); }
    case "venus": { const s = fbm(u + Math.sin(v * 9) * 0.06, v * 1.6, 5, 91, 4); return mix(mix([226, 190, 120], [252, 238, 190], s), [196, 150, 92], Math.pow(fbm(u, v * 2, 6, 101, 3), 2) * 0.7); }
    case "saturn": { const b = Math.sin(v * 38 + fbm(u, v, 3, 111, 2) * 2.2) * 0.5 + 0.5; return mix([200, 172, 112], [236, 214, 160], b * 0.7 + fbm(u, v * 3, 8, 121, 3) * 0.3); }
    case "jupiter": { const t = fbm(u + Math.sin(v * 20) * 0.04, v * 1.4, 6, 131, 4), b = Math.sin(v * 46 + t * 3) * 0.5 + 0.5; let c = mix([154, 98, 64], [238, 214, 178], b); const rs = Math.exp(-(Math.pow((u - 0.62) * 9, 2) + Math.pow((v - 0.62) * 22, 2))); return mix(c, [190, 70, 44], Math.min(0.9, rs)); }
    case "titan": return mix(mix([204, 146, 62], [232, 184, 96], fbm(u, v, 6, 141, 3)), [176, 112, 48], Math.max(0, Math.sin(v * 9) * 0.25));
    case "proxima": { const land = fbm(u, v, 4, 151, 4), fine = fbm(u, v, 14, 161, 3); return land < 0.48 ? mix([54, 28, 36], [84, 44, 52], fine) : mix([126, 66, 52], [168, 104, 70], fine); }
    case "earth": { const land = fbm(u, v, 4, 181, 5), cl = fbm(u + 0.3, v, 6, 191, 4); let c = land > 0.52 ? mix([70, 120, 60], [150, 130, 80], fbm(u, v, 12, 201, 3)) : mix([20, 60, 130], [40, 100, 175], fbm(u, v, 9, 211, 3)); if (lat > 0.88) c = [240, 244, 250]; return mix(c, [250, 252, 255], Math.max(0, cl - 0.55) * 2.2); }
    case "rock": { const g = fbm(u, v, 8, 221, 4); return mix([96, 86, 78], [150, 138, 126], g); }
    case "ice": { const g = fbm(u, v, 7, 231, 4); return mix([170, 205, 232], [236, 246, 255], g); }
    case "lava": { const g = fbm(u, v, 8, 241, 4), cr = Math.max(0, (0.5 - Math.abs(fbm(u, v, 14, 251, 3) - 0.5)) * 2 - 0.82) * 6; return mix(mix([38, 24, 22], [92, 52, 38], g), [255, 130, 40], Math.min(1, cr)); }
    default: { const g = fbm(u, v, 7, 261, 4), b = Math.sin(v * 18 + g * 4) * 0.5 + 0.5; return mix(mix(c0, c2, g), mix(c2, [255, 255, 255], 0.35), b * 0.3); }
  }
}
const CACHE: Record<string, string> = {};
export const orbKind = (id: string) => KIND[id] || "generic";
export const orbRings = (id: string) => orbKind(id) === "saturn";
/** A data-URL picture of the map's world. c0 / c2 are the map's own dark and light colours, used when the world is made-up. */
export function orbPic(id: string, c0hex: string, c2hex: string): string {
  const key = id + c0hex + c2hex; if (CACHE[key]) return CACHE[key];
  const kind = orbKind(id); let url = "";
  try {
    const S = 128, cv = document.createElement("canvas"); cv.width = S; cv.height = S; const c = cv.getContext("2d")!, im = c.createImageData(S, S), d = im.data, c0 = hexRgb(c0hex), c2 = hexRgb(c2hex);
    const R = kind === "saturn" ? S * 0.31 : S * 0.46, cx = S / 2, cy = S / 2;
    if (kind === "star") {
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, S / 2); g.addColorStop(0, "#fffbe8"); g.addColorStop(0.22, "#ffe08a"); g.addColorStop(0.36, "rgba(255,170,60,.85)"); g.addColorStop(0.6, "rgba(255,110,30,.22)"); g.addColorStop(1, "rgba(255,80,20,0)"); c.fillStyle = g; c.fillRect(0, 0, S, S);
    } else if (kind === "blackhole") {
      c.fillStyle = "#000"; c.beginPath(); c.arc(cx, cy, S * 0.2, 0, 7); c.fill();
      c.save(); c.translate(cx, cy); c.scale(1, 0.32); const g = c.createRadialGradient(0, 0, S * 0.2, 0, 0, S * 0.48); g.addColorStop(0, "rgba(255,240,200,.95)"); g.addColorStop(0.35, "rgba(255,150,50,.7)"); g.addColorStop(1, "rgba(120,40,160,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, S * 0.48, 0, 7); c.arc(0, 0, S * 0.2, 0, 7, true); c.fill(); c.restore();
      c.fillStyle = "#000"; c.beginPath(); c.arc(cx, cy, S * 0.2, 0, 7); c.fill();
    } else {
      const L = [-0.5, -0.5, 0.7], ln = Math.hypot(L[0], L[1], L[2]);
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const nx = (px + 0.5 - cx) / R, ny = (py + 0.5 - cy) / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2), lon = Math.atan2(nx, nz), lat = Math.asin(Math.max(-1, Math.min(1, ny))), u = (lon / (2 * Math.PI) + 0.5) * 0.5 + 0.25, v = lat / Math.PI + 0.5;
        let col = surface(kind, u, v, c0, c2); const lit = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ln), sh = 0.16 + 0.95 * Math.pow(lit, 0.8), limb = 0.55 + 0.45 * nz;
        const k = sh * limb; const i = (py * S + px) * 4, edge = Math.min(1, (1 - Math.sqrt(r2)) * R / 1.5);
        d[i] = col[0] * k; d[i + 1] = col[1] * k; d[i + 2] = col[2] * k; d[i + 3] = 255 * edge;
      }
      c.putImageData(im, 0, 0);
      const at = kind === "venus" ? "255,226,150" : kind === "earth" ? "120,180,255" : kind === "mars" ? "255,170,120" : kind === "titan" ? "255,190,90" : kind === "proxima" ? "255,90,70" : "";
      if (at) { const g = c.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.12); g.addColorStop(0, `rgba(${at},.4)`); g.addColorStop(1, `rgba(${at},0)`); c.globalCompositeOperation = "lighter"; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.12, 0, 7); c.fill(); c.globalCompositeOperation = "source-over"; }
      if (kind === "saturn") {   // the ring: far half behind the globe (already under it is impossible after the fact, so draw it first on a second canvas and stack)
        const rc = document.createElement("canvas"); rc.width = S; rc.height = S; const x = rc.getContext("2d")!;
        const ring = (front: boolean) => { x.save(); x.translate(cx, cy); x.rotate(-0.36); x.scale(1, 0.26); for (const [a, b, col] of [[1.28, 1.5, "rgba(120,100,72,.45)"], [1.52, 1.78, "rgba(196,172,128,.85)"], [1.8, 2.05, "rgba(214,194,152,.9)"], [2.1, 2.3, "rgba(170,150,116,.6)"]] as [number, number, string][]) { x.strokeStyle = col; x.lineWidth = (b - a) * R; x.beginPath(); x.arc(0, 0, (a + b) / 2 * R, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); x.stroke(); } x.restore(); };
        ring(false); x.drawImage(cv, 0, 0); ring(true); url = rc.toDataURL("image/png"); CACHE[key] = url; return url;
      }
    }
    url = cv.toDataURL("image/png");
  } catch (e) { url = ""; }
  CACHE[key] = url; return url;
}
