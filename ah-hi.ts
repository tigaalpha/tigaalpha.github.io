/* High-only extra layers for Alien Hunt and the Robot Adventure 3D planets (owner, 2026-11-17: "make the High mode prettier and more realistic, keep Lite as it is").
   ah-render.ts fetches this file with a dynamic import() ONLY while Graphics is High, so Lite never downloads, parses or runs any of it.
   Everything is drawn from code (canvas, procedural meshes), nothing is downloaded. Every layer is built inside try/catch: a layer that throws switches itself off, logs one
   "HIFX" warning and the earlier High look stays. The layers sit on a three-step ladder (costliest first) that steps down by itself when frames stay slow, before the older
   watchdogs (hi-fx.ts: AO, SMAA, bloom; alien-hunt.tsx: High -> Lite) get their turn. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { hiTier } from "./hi-fx";
import { ALIENS, ALIEN_SCALE } from "./ah-engine";

export type HiCtx = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; sky: THREE.Mesh; stars: THREE.Points; sun: THREE.DirectionalLight;
  ground: THREE.Mesh; boxMat: THREE.MeshStandardMaterial; levelGroup: THREE.Group; hiGrp: THREE.Group; hold: THREE.Group; guns: Record<string, THREE.Group>;
  mflash: THREE.Mesh; mflash2: THREE.Mesh; mstreak: THREE.Mesh; hand: THREE.Mesh; fore: THREE.Mesh;
  fogSheet: THREE.Object3D; shaftCones: THREE.Object3D[]; giant: THREE.Mesh | null; giantRing: THREE.Mesh | null;
  TH: any; KIT: string; arena: number; levelId: number; muzzle: (w: string) => THREE.Vector3; envBase: () => THREE.Texture | null; noAO: (...o: THREE.Object3D[]) => void;
};
type Shared = { env: THREE.Texture | null; sunDir: THREE.Vector3 };
export type HiLayers = { on: (b: boolean) => void; update: (dt: number, s: any) => void; event: (e: any) => void; softBurst: (x: number, y: number, z: number, n: number, col: number, spd: number) => boolean; dispose: () => void; level: () => number; names: () => string[] };
type Layer = { name: string; rank: number; on: (b: boolean) => void; update?: (dt: number, s: any, t: number) => void; event?: (e: any) => void; dispose: () => void };

const warn = (what: string, e: any) => { try { console.warn("HIFX ah-hi " + what + ": " + (e && e.message ? e.message : e)); } catch (_) { /* */ } };
const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rgbN = (n: number): number[] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const rgbS = (s: string): number[] => { const m = /^#?([0-9a-f]{6})$/i.exec(s || ""); return m ? rgbN(parseInt(m[1], 16)) : [40, 40, 60]; };
const mix = (a: number[], b: number[], t: number): number[] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: number[], k: number): number[] => [Math.min(255, a[0] * k), Math.min(255, a[1] * k), Math.min(255, a[2] * k)];
const css = (c: number[], a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mk2d = (w: number, h: number, readBack = false): [HTMLCanvasElement, CanvasRenderingContext2D] => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d", readBack ? { willReadFrequently: true } : undefined) as CanvasRenderingContext2D]; };

/* ── periodic value noise + fbm (the sky wraps seamlessly round the dome) ── */
function mkNoise(seed: number) {
  const r = mulberry(seed), P = new Float32Array(256 * 256); for (let i = 0; i < P.length; i++) P[i] = r();
  return (x: number, y: number, per: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy);
    const i0 = ((x0 % per) + per) % per, i1 = (i0 + 1) % per, j0 = ((y0 & 255) + 256) & 255, j1 = (j0 + 1) & 255;
    const a = P[j0 * 256 + i0], b = P[j0 * 256 + i1], c = P[j1 * 256 + i0], d = P[j1 * 256 + i1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

/* ── the sky of each world: gradient with a real horizon haze, soft lit clouds, a sun glow and disc where the key light comes from ── */
type SkyStyle = { cov: number; tone: "light" | "dark"; sunR: number; sunI: number; haze: number; cloudA: number; stars: boolean };
const STYLE: Record<string, SkyStyle> = {
  "": { cov: 0.5, tone: "light", sunR: 1.9, sunI: 1, haze: 0.8, cloudA: 0.42, stars: true },
  jungle: { cov: 0.56, tone: "light", sunR: 2.4, sunI: 1, haze: 0.9, cloudA: 0.5, stars: true }, desert: { cov: 0.36, tone: "light", sunR: 3.4, sunI: 1.15, haze: 1, cloudA: 0.5, stars: false },
  ice: { cov: 0.42, tone: "light", sunR: 2.6, sunI: 1.1, haze: 0.9, cloudA: 0.5, stars: true }, lava: { cov: 0.66, tone: "dark", sunR: 4.6, sunI: 0.9, haze: 1, cloudA: 0.7, stars: false },
  ruins: { cov: 0.6, tone: "dark", sunR: 2.2, sunI: 0.9, haze: 0.85, cloudA: 0.6, stars: true }, gas: { cov: 0.5, tone: "light", sunR: 3, sunI: 1, haze: 0.85, cloudA: 0.5, stars: true },
  belt: { cov: 0.22, tone: "light", sunR: 1.8, sunI: 1, haze: 0.6, cloudA: 0.35, stars: true }, sun: { cov: 0.36, tone: "light", sunR: 7, sunI: 1.3, haze: 1, cloudA: 0.45, stars: false },
};
/** direction -> equirect canvas coordinates of the sky dome (SphereGeometry: x = -cos(phi) sin(theta), z = sin(phi) sin(theta), y = cos(theta); the canvas top is theta = 0) */
const dirToUV = (d: THREE.Vector3): [number, number] => { const th = Math.acos(Math.max(-1, Math.min(1, d.y))), ph = Math.atan2(d.z, -d.x); return [((ph / (Math.PI * 2)) % 1 + 1) % 1, th / Math.PI]; };

function paintSky(TH: any, KIT: string, sunDir: THREE.Vector3, seed: number): THREE.CanvasTexture {
  const W = 1024, H = 512, st = STYLE[KIT] || STYLE[""], [cv, g] = mk2d(W, H, true);
  const Z = rgbS(TH.sky[0]), U = rgbS(TH.sky[1]), G2 = rgbS(TH.sky[2]), L = rgbS(TH.sky[3]), FOG = rgbN(TH.fog), SUN = rgbN(TH.sun), RING = rgbN(TH.ring), GR = rgbN(TH.ground);
  // the horizon haze: the level's own glow colour, pulled a little towards its fog so the far walls and landmarks melt into it
  const HZ = mul(mix(G2, FOG, 0.3), 0.6 + 0.26 * st.haze), BELOW = mix(mul(GR, 0.28), mix(L, FOG, 0.5), 0.5);
  const skyCol = (e: number): number[] => {
    if (e >= 0) { const t = e / 90, up = mix(U, Z, sstep(0.18, 1, t)); return mix(HZ, up, sstep(0, 0.3 + 0.12 * (1 - st.haze), t)); }
    return mix(mul(HZ, 0.8), BELOW, sstep(0, 0.16, -e / 90));
  };
  const gr = g.createLinearGradient(0, 0, 0, H); for (let i = 0; i <= 48; i++) { const f = i / 48, e = 90 - f * 180; gr.addColorStop(f, css(skyCol(e))); } g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [sU, sV] = dirToUV(sunDir), sx = sU * W, sy = sV * H;
  // clouds: fbm layers at half resolution, shaded by looking the noise up a step towards the sun (a cheap bump light), then scaled up with smoothing
  {
    const cw = 512, ch = 100, [cc, cg] = mk2d(cw, ch, true), img = cg.createImageData(cw, ch), N = mkNoise(seed * 7919 + 13), E0 = 72, E1 = 2;
    const dark = st.tone === "dark", shadowC = dark ? mul(U, 0.3) : mix(U, [255, 255, 255], 0.14), litC = dark ? mix(RING, U, 0.35) : mix(SUN, [255, 255, 255], 0.3);
    const sunAzTurn = sU, sunElDeg = 90 - sV * 180;   // where the sun is, to light the cloud edges that face it
    for (let j = 0; j < ch; j++) {
      const e = E0 - (E0 - E1) * j / (ch - 1), fade = sstep(1.5, 9, e) * (1 - sstep(48, 74, e)), fy = e / 6.5, dEl = (sunElDeg - e) / 6.5;
      for (let i = 0; i < cw; i++) {
        const u = i / cw, fx = u * 16, dAz = (((sunAzTurn - u + 1.5) % 1) - 0.5) * 16, dl = Math.hypot(dAz, dEl) || 1;
        let m = 0, a = 0.5, f = 1; const per = 16; for (let o = 0; o < 5; o++) { m += a * N(fx * f, fy * f + o * 7.3, per * f); a *= 0.5; f *= 2; }
        m /= 0.96875;
        let q = 0, aa = 0.5, ff = 1; const px = fx + dAz / dl * 0.22, py = fy + dEl / dl * 0.22; for (let o = 0; o < 3; o++) { q += aa * N(px * ff, py * ff + o * 7.3, per * ff); aa *= 0.5; ff *= 2; } q /= 0.875;
        const cov = sstep(1 - st.cov - 0.12, 1 - st.cov + 0.2, m) * fade, lit = Math.max(0, Math.min(1, 0.55 + (m - q) * 4.2)), col = mix(shadowC, litC, lit), k = (j * cw + i) * 4;
        img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = Math.min(255, cov * st.cloudA * 255);
      }
    }
    cg.putImageData(img, 0, 0);
    const y0 = (90 - E0) / 180 * H, y1 = (90 - E1) / 180 * H; g.imageSmoothingEnabled = true; g.drawImage(cc, 0, y0, W, y1 - y0);
  }
  // the light: a wide warm bloom round the sun, a hot core and a disc; a low glow along the horizon under it
  g.globalCompositeOperation = "lighter";
  const glow = (rad: number, col: number[], a: number, cx = sx, cy = sy, sq = 1) => {
    const rpx = rad / 360 * W, ec = (90 - cy / H * 180) * Math.PI / 180, sc = 1 / Math.max(0.3, Math.cos(Math.max(-1.2, Math.min(1.2, ec))));
    for (const ox of [0, -W, W]) { if (cx + ox + rpx * sc < 0 || cx + ox - rpx * sc > W) continue; g.save(); g.translate(cx + ox, cy); g.scale(sc, sq); const rg = g.createRadialGradient(0, 0, 0, 0, 0, rpx); rg.addColorStop(0, css(col, a)); rg.addColorStop(0.35, css(col, a * 0.4)); rg.addColorStop(1, css(col, 0)); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rpx, 0, 7); g.fill(); g.restore(); }
  };
  const warm = mix(SUN, [255, 235, 200], 0.35);
  glow(46 * (0.6 + 0.4 * st.sunI), mul(SUN, 0.5), 0.2 * st.sunI);
  glow(18, mul(warm, 0.8), 0.38 * st.sunI); glow(7, warm, 0.6); glow(st.sunR * 2.2, [255, 250, 235], 0.9); glow(st.sunR, [255, 255, 250], 1);
  glow(70, mul(mix(G2, SUN, 0.5), 0.6), 0.3 * st.haze * st.sunI, sx, H * 0.5 - 4, 0.09);   // a low glow along the horizon under the sun
  g.globalCompositeOperation = "source-over";
  // a whisper of dither so the smooth gradients do not band in the 8-bit canvas
  { const dd = g.getImageData(0, 0, W, H), r = mulberry(seed + 99), d = dd.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 2.6; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(dd, 0, 0); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 2; t.needsUpdate = true;
  return t;
}

/* ── layer 1 (rank 3, nearly free): the painted sky, the sun moved down to where it can be seen, and an image-based light made from that very sky ── */
function skyLayer(X: HiCtx, SH: Shared): Layer {
  const { scene, sky, renderer, sun, TH, KIT } = X;
  const mat = sky.material as THREE.MeshBasicMaterial, oldMap = mat.map, oldPos = sun.position.clone(), oldStars = X.stars.visible, oldI = sun.intensity;
  // the key light keeps its heading but sits lower (about 31 degrees): longer shadows, a visible sun, a rim that reads
  const dir0 = oldPos.clone().normalize(), hz = Math.hypot(dir0.x, dir0.z), el = 31 * Math.PI / 180, hdir = new THREE.Vector2(dir0.x / hz, dir0.z / hz);
  const sunDir = new THREE.Vector3(hdir.x * Math.cos(el), Math.sin(el), hdir.y * Math.cos(el)), newPos = sunDir.clone().multiplyScalar(oldPos.length());
  const skyTex = paintSky(TH, KIT, sunDir, 1 + (X.levelId | 0) * 3 + KIT.length); SH.sunDir.copy(sunDir);
  // the image-based light: the same dome, a hot sun (HDR, so glossy things catch a real glint) and the ground's own bounce below
  let env: THREE.Texture | null = null, envRT: THREE.WebGLRenderTarget | null = null;
  try {
    // the light probe is drawn into half-float cube faces: only where the device can render to them (the same need as the composer's HDR target)
    if (!(renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"))) throw new Error("no float render target");
    const es = new THREE.Scene(), dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })); es.add(dome);
    const sc = new THREE.Color(TH.sun).multiplyScalar(10), sm = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8), new THREE.MeshBasicMaterial({ color: sc, toneMapped: false })); sm.position.copy(sunDir).multiplyScalar(52); es.add(sm);
    const pm = new THREE.PMREMGenerator(renderer); envRT = pm.fromScene(es, 0.02, 0.1, 200); env = envRT.texture; pm.dispose(); dome.geometry.dispose(); (dome.material as THREE.Material).dispose(); sm.geometry.dispose(); (sm.material as THREE.Material).dispose();
  } catch (e) { warn("sky env", e); env = null; envRT = null; }
  SH.env = env;
  const u1 = rgbS(TH.sky[1]), starsOk = (STYLE[KIT] || STYLE[""]).stars && (0.2126 * u1[0] + 0.7152 * u1[1] + 0.0722 * u1[2]) / 255 < 0.3;
  let prevEnv: THREE.Texture | null = null, prevInt = 0.55;
  return {
    name: "sky", rank: 3,
    on(b) {
      for (const c of X.shaftCones) c.visible = !b;   // the four hard-edged cones give way to the soft shafts (tier 3) or to none
      mat.map = b ? skyTex : oldMap; mat.needsUpdate = true; sun.position.copy(b ? newPos : oldPos); sun.intensity = b ? oldI * 1.35 : oldI; X.stars.visible = b ? starsOk : oldStars;
      if (b && env) { prevEnv = scene.environment; prevInt = (scene as any).environmentIntensity ?? 0.55; scene.environment = env; (scene as any).environmentIntensity = 0.75; }
      else if (!b && scene.environment === env) { scene.environment = prevEnv; (scene as any).environmentIntensity = prevInt; }
    },
    dispose() { skyTex.dispose(); if (envRT) envRT.dispose(); },
  };
}


/* ── layer 2 (rank 3 for the ground, rank 2 for the puddles): a ground that has a surface: wet and dry patches that catch the sky, a glossy ice floor, a glowing lava crust ── */
const KGROUND: Record<string, { base: number; puddle: number; frost?: boolean; crack?: boolean; tint: number }> = {
  "": { base: 0.8, puddle: 1, tint: 0x04060a }, jungle: { base: 0.7, puddle: 0.55, tint: 0x03100c }, desert: { base: 0.93, puddle: 0, tint: 0x100a04 }, ice: { base: 0.26, puddle: 0.4, frost: true, tint: 0x06101c },
  lava: { base: 0.62, puddle: 0, crack: true, tint: 0x100604 }, ruins: { base: 0.76, puddle: 0.75, tint: 0x05050a }, gas: { base: 0.8, puddle: 0.3, tint: 0x080610 }, belt: { base: 0.8, puddle: 0.25, tint: 0x04080e }, sun: { base: 0.86, puddle: 0, tint: 0x100804 },
};
function groundLayer(X: HiCtx, SH: Shared): Layer[] {
  const gm = X.ground.material as THREE.MeshStandardMaterial, P = KGROUND[X.KIT] || KGROUND[""], rnd = mulberry(7 + (X.levelId | 0) * 31 + X.KIT.length * 5), TH = X.TH;
  const wrap = (x: number, y: number, r: number, f: (ox: number, oy: number) => void) => { for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { if (x + ox + r < 0 || x + ox - r > 512 || y + oy + r < 0 || y + oy - r > 512) continue; f(x + ox, y + oy); } };
  // the roughness map: dark = glossy. A base value, soft wet patches (or, on ice, dull frost patches) and a fine grain; tiles seamlessly, repeated twice over the arena
  const [rc, rg] = mk2d(512, 512), bv = Math.round(P.base * 255); rg.fillStyle = `rgb(${bv},${bv},${bv})`; rg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 34; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 22 + rnd() * 60, v = P.frost ? Math.round(150 + rnd() * 90) : Math.round(bv * (0.4 + rnd() * 0.45)), a = P.frost ? 0.7 : 0.75;
    wrap(x, y, r, (px, py) => { const gr = rg.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, `rgba(${v},${v},${v},${a})`); gr.addColorStop(0.6, `rgba(${v},${v},${v},${a * 0.45})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); rg.fillStyle = gr; rg.fillRect(px - r, py - r, r * 2, r * 2); });
  }
  for (let i = 0; i < 5200; i++) { const v = rnd() < 0.5 ? 0 : 255; rg.fillStyle = `rgba(${v},${v},${v},${0.05 + rnd() * 0.08})`; rg.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2); }
  const rough = new THREE.CanvasTexture(rc); rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(2, 2); rough.anisotropy = 4;
  // lava: a network of glowing cracks (emissive), tiling seamlessly
  let crack: THREE.CanvasTexture | null = null;
  if (P.crack) {
    const [cc, cg] = mk2d(512, 512); cg.fillStyle = "#000"; cg.fillRect(0, 0, 512, 512); cg.lineCap = "round"; cg.lineJoin = "round"; cg.globalCompositeOperation = "lighter";
    for (let i = 0; i < 30; i++) {
      let x = rnd() * 512, y = rnd() * 512, a = rnd() * 6.28; const pts: number[][] = [[x, y]], n = 7 + Math.floor(rnd() * 8);
      for (let k = 0; k < n; k++) { a += (rnd() - 0.5) * 1.5; x += Math.cos(a) * (18 + rnd() * 34); y += Math.sin(a) * (18 + rnd() * 34); pts.push([x, y]); }
      for (const [w, col] of [[9, "rgba(255,70,10,.16)"], [4.2, "rgba(255,120,30,.55)"], [1.6, "rgba(255,225,140,.95)"]] as [number, string][]) { cg.lineWidth = w; cg.strokeStyle = col; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { cg.beginPath(); pts.forEach((p, k) => (k ? cg.lineTo(p[0] + ox, p[1] + oy) : cg.moveTo(p[0] + ox, p[1] + oy))); cg.stroke(); } }
    }
    crack = new THREE.CanvasTexture(cc); crack.wrapS = crack.wrapT = THREE.RepeatWrapping; crack.repeat.set(2, 2); crack.colorSpace = THREE.SRGBColorSpace;
  }
  let saved: any = null;
  const ground: Layer = {
    name: "ground", rank: 3,
    on(b) {
      if (b) {
        saved = { rm: gm.roughnessMap, r: gm.roughness, em: gm.emissiveMap, ei: gm.emissiveIntensity, e: gm.emissive.clone(), env: gm.envMap, ev: gm.envMapIntensity };
        gm.roughnessMap = rough; gm.roughness = 1; if (SH.env) { gm.envMap = SH.env; gm.envMapIntensity = P.frost ? 1.4 : 0.9; }
        if (crack) { gm.emissiveMap = crack; gm.emissive.set(0xffffff); gm.emissiveIntensity = 1.3; }
      } else if (saved) { gm.roughnessMap = saved.rm; gm.roughness = saved.r; gm.emissiveMap = saved.em; gm.emissiveIntensity = saved.ei; gm.emissive.copy(saved.e); gm.envMap = saved.env; gm.envMapIntensity = saved.ev; saved = null; }
      gm.needsUpdate = true;
    },
    update: crack ? (_dt, _s, t) => { gm.emissiveIntensity = 1.25 + 0.3 * Math.sin(t * 1.3); } : undefined,
    dispose() { rough.dispose(); if (crack) crack.dispose(); },
  };
  const out: Layer[] = [ground];
  // puddles (and ice sheen): soft black pools with their own low roughness, merged into one mesh, one draw
  const NP = Math.round(14 * P.puddle);
  if (NP > 0) {
    const [pc, pg] = mk2d(128, 128); for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, d = i ? 14 + rnd() * 16 : 0, r = i ? 20 + rnd() * 18 : 40, cx = 64 + Math.cos(a) * d, cy = 64 + Math.sin(a) * d, gr = pg.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.55, "rgba(255,255,255,.85)"); gr.addColorStop(1, "rgba(255,255,255,0)"); pg.fillStyle = gr; pg.fillRect(0, 0, 128, 128); }
    const pt = new THREE.CanvasTexture(pc), list: THREE.BufferGeometry[] = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), L = X.arena - 5;
    for (let i = 0; i < NP; i++) {
      const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); const sz = (P.frost ? 5 : 2.2) + rnd() * (P.frost ? 6 : 4.2); e.set(0, rnd() * 6.28, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3((rnd() * 2 - 1) * L, 0.022 + i * 0.0004, (rnd() * 2 - 1) * L), q, new THREE.Vector3(sz * (0.8 + rnd() * 0.6), 1, sz * (0.7 + rnd() * 0.5))); g.applyMatrix4(m4); list.push(g);
    }
    const geo = mergeGeometries(list, false), mat = new THREE.MeshStandardMaterial({ color: P.tint, roughness: 0.04, metalness: 0, map: pt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, envMapIntensity: 1.5, opacity: P.frost ? 0.55 : 0.85 });
    for (const g of list) g.dispose();
    const mesh = new THREE.Mesh(geo as THREE.BufferGeometry, mat); mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 1; X.scene.add(mesh); X.noAO(mesh);
    out.push({ name: "puddles", rank: 2, on(b) { mesh.visible = b; if (b && SH.env) { mat.envMap = SH.env; mat.needsUpdate = true; } }, dispose() { X.scene.remove(mesh); geo.dispose(); mat.dispose(); pt.dispose(); } });
  }
  void TH;
  return out;
}

/* ── layer 3 (rank 1, the costliest: big soft additive shapes): light shafts that fall along the sun's heading, a cone under every lamp, mist that stands at the foot of the walls ── */
const BEAM_V = "varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; vH = uv.y; gl_Position = projectionMatrix * mv; }";
const BEAM_F = "uniform vec3 uCol; uniform float uA; uniform vec4 uH; varying vec3 vN; varying vec3 vV; varying float vH; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.7); float h = smoothstep(uH.x, uH.y, vH) * (1.0 - smoothstep(uH.z, uH.w, vH)); float nr = smoothstep(0.6, 7.0, length(vV)); gl_FragColor = vec4(uCol, f * h * nr * uA); }";
const beamMat = (col: number, a: number, h: [number, number, number, number]) => new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(col) }, uA: { value: a }, uH: { value: new THREE.Vector4(h[0], h[1], h[2], h[3]) } }, vertexShader: BEAM_V, fragmentShader: BEAM_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
function airLayer(X: HiCtx, SH: Shared): Layer {
  const TH = X.TH, root = new THREE.Group(), rnd = mulberry(31 + (X.levelId | 0) * 17 + X.KIT.length), own: { dispose: () => void }[] = [], beams: { m: THREE.ShaderMaterial; a: number; ph: number }[] = [];
  const sunC = TH.sun as number, L = X.arena;
  // shafts: long soft cylinders from the ground up towards the sun, a few metres across, wider at the sky end
  for (let i = 0; i < 6; i++) {
    const len = 40, g = new THREE.CylinderGeometry(3.4 + rnd() * 1.6, 1.5 + rnd() * 0.8, len, 20, 1, true), m = beamMat(sunC, 0.085, [0.0, 0.2, 0.5, 1.0]), mesh = new THREE.Mesh(g, m);
    const d = SH.sunDir, up = new THREE.Vector3(0, 1, 0); mesh.quaternion.setFromUnitVectors(up, d); mesh.position.set((rnd() * 2 - 1) * L * 0.8, 0, (rnd() * 2 - 1) * L * 0.8).addScaledVector(d, len / 2 - 2);
    mesh.frustumCulled = false; root.add(mesh); own.push(g, m); beams.push({ m, a: 0.085, ph: rnd() * 6.28 });
  }
  // a soft cone under each of the eight lamps (see buildLevel: radius 27, bulb at 6.1 m)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, g = new THREE.ConeGeometry(4.2, 6.1, 18, 1, true), m = beamMat(0xffd490, 0.2, [0.0, 0.8, 1.1, 1.2]), mesh = new THREE.Mesh(g, m);
    mesh.position.set(Math.cos(a) * 27, 3.05, Math.sin(a) * 27); mesh.frustumCulled = false; root.add(mesh); own.push(g, m);
  }
  // mist at the foot of the four walls: a vertical gradient, bright at the ground and gone by 6 m
  const [mc, mg] = mk2d(8, 128), gr = mg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.45, "rgba(255,255,255,.28)"); gr.addColorStop(1, "rgba(255,255,255,.85)"); mg.fillStyle = gr; mg.fillRect(0, 0, 8, 128);
  const mt = new THREE.CanvasTexture(mc), fogC = new THREE.Color(TH.fog).lerp(new THREE.Color(TH.sky[2]), 0.45), wl = L + 1 - 0.5;
  mt.wrapS = THREE.RepeatWrapping; own.push(mt);
  for (const [x, z, ry] of [[0, -wl, 0], [0, wl, Math.PI], [-wl, 0, Math.PI / 2], [wl, 0, -Math.PI / 2]] as number[][]) {
    const g = new THREE.PlaneGeometry(wl * 2, 6.5), m = new THREE.MeshBasicMaterial({ map: mt, color: fogC, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide, fog: false }), mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, 3.25, z); mesh.rotation.y = ry; root.add(mesh); own.push(g, m);
  }
  root.visible = false; X.scene.add(root); X.noAO(root, X.fogSheet, ...X.shaftCones); let fogWas = false;
  return {
    name: "air", rank: 1,
    on(b) { root.visible = b; if (b) { fogWas = X.fogSheet.visible; X.fogSheet.visible = false; } else X.fogSheet.visible = fogWas; },
    update(_dt, _s, t) { for (const q of beams) q.m.uniforms.uA.value = q.a * (0.82 + 0.18 * Math.sin(t * 0.35 + q.ph)); },
    dispose() { X.scene.remove(root); for (const o of own) o.dispose(); },
  };
}


/* ── layer 4 (rank 2): soft particles. One instanced quad system with a soft round sprite instead of up to 160 little polyhedra: sparks that stretch along their flight, goo that falls and fades,
   smoke that swells. Two draw calls (additive, alpha) in all. ah-render.ts hands every burst() to softBurst() first; when this layer is off the old particles run as before. ── */
const PV = "attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aCol; attribute vec4 aPar; varying vec2 vUv; varying vec4 vCol; void main(){ vUv = uv; vCol = aCol; vec4 mv = modelViewMatrix * vec4(aPos, 1.0); vec2 p = (uv - 0.5) * 2.0; vec3 vv = (modelViewMatrix * vec4(aVel, 0.0)).xyz; float sp = length(vv.xy); vec2 q = p;"
  + " if (aPar.z > 0.0 && sp > 0.01) { vec2 d = vv.xy / sp; vec2 n = vec2(-d.y, d.x); q = d * p.x * (1.0 + aPar.z * min(sp, 14.0) * 0.16) + n * p.y * 0.55; } else { float c = cos(aPar.y), s = sin(aPar.y); q = vec2(c * p.x - s * p.y, s * p.x + c * p.y); }"
  + " mv.xy += q * aPar.x; gl_Position = projectionMatrix * mv; }";
const PF = "uniform sampler2D uTex; varying vec2 vUv; varying vec4 vCol; void main(){ float a = texture2D(uTex, vUv).a * vCol.a; if (a < 0.003) discard; gl_FragColor = vec4(vCol.rgb, a); }";
function softTex(): THREE.CanvasTexture {
  const [c, g] = mk2d(64, 64), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,.62)"); r.addColorStop(0.62, "rgba(255,255,255,.2)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
type PSys = { mesh: THREE.Mesh; emit: (x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, grow: number, cr: number, cg: number, cb: number, a: number, life: number, grav: number, drag: number, stretch: number) => void; step: (dt: number) => void; clear: () => void; dispose: () => void };
function mkPSys(N: number, additive: boolean, tex: THREE.Texture, ground: number): PSys {
  const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.setAttribute("position", base.attributes.position); geo.setAttribute("uv", base.attributes.uv);
  const aPos = new Float32Array(N * 3), aVel = new Float32Array(N * 3), aCol = new Float32Array(N * 4), aPar = new Float32Array(N * 4), life = new Float32Array(N), life0 = new Float32Array(N), grav = new Float32Array(N), drag = new Float32Array(N), grow = new Float32Array(N), s0 = new Float32Array(N), a0 = new Float32Array(N), spin = new Float32Array(N);
  const attrs = [["aPos", aPos, 3], ["aVel", aVel, 3], ["aCol", aCol, 4], ["aPar", aPar, 4]] as [string, Float32Array, number][];
  for (const [n, arr, k] of attrs) geo.setAttribute(n, new THREE.InstancedBufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage));
  geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: tex } }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = additive ? 6 : 5; mesh.visible = false;
  let cur = 0, live = 0;
  return {
    mesh,
    emit(x, y, z, vx, vy, vz, size, gr, cr, cg, cb, a, lf, gv, dg, stretch) {
      let i = cur; for (let k = 0; k < N; k++) { const j = (cur + k) % N; if (life[j] <= 0) { i = j; break; } } cur = (i + 1) % N;
      aPos[i * 3] = x; aPos[i * 3 + 1] = y; aPos[i * 3 + 2] = z; aVel[i * 3] = vx; aVel[i * 3 + 1] = vy; aVel[i * 3 + 2] = vz; aCol[i * 4] = Math.pow(cr / 255, 2.2); aCol[i * 4 + 1] = Math.pow(cg / 255, 2.2); aCol[i * 4 + 2] = Math.pow(cb / 255, 2.2); aCol[i * 4 + 3] = a;
      s0[i] = size; a0[i] = a; grow[i] = gr; life[i] = life0[i] = lf; grav[i] = gv; drag[i] = dg; spin[i] = Math.random() * 6.28; aPar[i * 4] = size; aPar[i * 4 + 1] = spin[i]; aPar[i * 4 + 2] = stretch; aPar[i * 4 + 3] = 0; live++; mesh.visible = true;
    },
    step(dt) {
      if (!live) return; let any = 0;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue; life[i] -= dt;
        if (life[i] <= 0) { aPar[i * 4] = 0; aCol[i * 4 + 3] = 0; live--; continue; }
        const k = 1 - life[i] / life0[i], j = i * 3, dg = Math.max(0, 1 - drag[i] * dt);
        aVel[j + 1] -= grav[i] * dt; aVel[j] *= dg; aVel[j + 1] *= dg; aVel[j + 2] *= dg; aPos[j] += aVel[j] * dt; aPos[j + 1] += aVel[j + 1] * dt; aPos[j + 2] += aVel[j + 2] * dt;
        const sz = s0[i] * (1 + grow[i] * k); if (aPos[j + 1] < ground + sz * 0.5 && grav[i] > 0) { aPos[j + 1] = ground + sz * 0.5; aVel[j] *= 0.5; aVel[j + 1] = 0; aVel[j + 2] *= 0.5; }
        aPar[i * 4] = sz; aPar[i * 4 + 1] = spin[i] + k * 0.8; aCol[i * 4 + 3] = a0[i] * (k < 0.12 ? k / 0.12 : 1) * (1 - sstep(0.35, 1, k)); any++;
      }
      for (const [n] of attrs) (geo.attributes[n] as THREE.BufferAttribute).needsUpdate = true;
      if (!any) { live = 0; mesh.visible = false; }
    },
    clear() { life.fill(0); aPar.fill(0); aCol.fill(0); live = 0; mesh.visible = false; for (const [n] of attrs) (geo.attributes[n] as THREE.BufferAttribute).needsUpdate = true; },
    dispose() { geo.dispose(); mat.dispose(); base.dispose(); },
  };
}
function particleLayer(X: HiCtx): { layer: Layer; burst: (x: number, y: number, z: number, n: number, col: number, spd: number) => boolean; active: () => boolean } {
  const tex = softTex(), add = mkPSys(224, true, tex, 0.02), alp = mkPSys(128, false, tex, 0.02), rnd = Math.random; X.noAO(add.mesh, alp.mesh);
  let on = false; const fwd = new THREE.Vector3();
  const burst = (x: number, y: number, z: number, n: number, col: number, spd: number): boolean => {
    if (!on) return false;
    const cr = (col >> 16) & 255, cg = (col >> 8) & 255, cb = col & 255, mx = Math.max(cr, cg, cb), mn = Math.min(cr, cg, cb), gray = mx - mn < 30 && mx < 225, goo = cg > cr * 1.05 && cg > cb * 1.2 && spd <= 7;
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, u = rnd();
      if (goo) { const h = spd * (0.35 + rnd() * 0.8), cj = 0.55 + rnd() * 0.4; alp.emit(x, y, z, Math.cos(a) * h, spd * (0.2 + u * 0.65), Math.sin(a) * h, 0.03 + rnd() * 0.05, 0, cr * cj, cg * cj, cb * cj, 0.95, 0.4 + rnd() * 0.4, 14, 0.4, 0.8); }   // droplets: short soft streaks along their flight
      else if (gray) { alp.emit(x + (rnd() - 0.5) * 0.3, y, z + (rnd() - 0.5) * 0.3, Math.cos(a) * spd * 0.3, 0.3 + rnd() * 0.9, Math.sin(a) * spd * 0.3, 0.1 + rnd() * 0.2, 2.2, cr * 0.9 + 18, cg * 0.9 + 18, cb * 0.9 + 20, 0.3, 0.55 + rnd() * 0.5, -0.4, 1.4, 0); }
      else { const sp = spd * (0.55 + rnd() * 0.7), el = (rnd() - 0.3) * 1.2; add.emit(x, y, z, Math.cos(a) * sp * Math.cos(el), sp * Math.sin(el) + spd * 0.25, Math.sin(a) * sp * Math.cos(el), 0.012 + rnd() * 0.02, -0.3, Math.min(255, cr * 1.5 + 40), Math.min(255, cg * 1.5 + 40), Math.min(255, cb * 1.5 + 40), 1, 0.16 + rnd() * 0.3, 9, 0.7, 2.6); }
    }
    if (goo && n >= 8) alp.emit(x, y, z, 0, 0.5, 0, 0.3, 1.5, cr * 0.8, cg * 0.9, cb * 0.7, 0.2, 0.55, 0, 2, 0);   // an ichor mist hanging in the air
    return true;
  };
  return {
    burst, active: () => on,
    layer: {
      name: "particles", rank: 2,
      on(b) { on = b; if (b) { X.scene.add(add.mesh); X.scene.add(alp.mesh); } else { add.clear(); alp.clear(); X.scene.remove(add.mesh); X.scene.remove(alp.mesh); } },
      update(dt) { add.step(dt); alp.step(dt); },
      event(e) {
        if (e.k === "shot") {   // smoke wisps leaving the muzzle, drifting up and forward
          const m = X.muzzle(e.w as string); X.cam.getWorldDirection(fwd);
          alp.emit(m.x + fwd.x * 0.05, m.y + 0.02, m.z + fwd.z * 0.05, fwd.x * 0.7 + (rnd() - 0.5) * 0.25, 0.35 + rnd() * 0.3, fwd.z * 0.7 + (rnd() - 0.5) * 0.25, 0.035 + rnd() * 0.03, 3.2, 205, 200, 195, 0.15, 0.6 + rnd() * 0.3, -0.15, 1.6, 0);
        } else if (e.k === "kill" || e.k === "head") {   // a pop of light where it died, and a swelling cloud of ichor
          const x = e.x as number, z = e.z as number, hd = e.k === "head";
          add.emit(x, 0.9, z, 0, 0, 0, 0.34, 1.3, hd ? 255 : 170, hd ? 215 : 255, 90, 0.32, 0.14, 0, 0, 0); alp.emit(x, 0.7, z, 0, 0.35, 0, 0.45, 1.8, 70, 120, 30, 0.35, 0.8, 0, 1.2, 0);
        }
      },
      dispose() { add.dispose(); alp.dispose(); tex.dispose(); },
    },
  };
}

/* ── layer 5 (rank 3): the muzzle flash as a starburst instead of a plain disc ── */
function flashLayer(X: HiCtx): Layer {
  const mk = (seed: number, spikes: number) => {
    const [c, g] = mk2d(128, 128), r = mulberry(seed); g.translate(64, 64);
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, 62); halo.addColorStop(0, "rgba(255,255,255,1)"); halo.addColorStop(0.16, "rgba(255,240,215,.95)"); halo.addColorStop(0.4, "rgba(255,190,110,.4)"); halo.addColorStop(1, "rgba(255,150,60,0)"); g.fillStyle = halo; g.fillRect(-64, -64, 128, 128);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < spikes; i++) {
      const a = i / spikes * Math.PI * 2 + (r() - 0.5) * 0.5, L = 38 + r() * 26, w = 3 + r() * 4, sg = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); sg.addColorStop(0, "rgba(255,255,255,.95)"); sg.addColorStop(0.6, "rgba(255,210,140,.45)"); sg.addColorStop(1, "rgba(255,170,80,0)");
      g.fillStyle = sg; g.beginPath(); g.moveTo(Math.cos(a + 1.57) * w, Math.sin(a + 1.57) * w); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a - 1.57) * w, Math.sin(a - 1.57) * w); g.closePath(); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const t1 = mk(5, 7), t2 = mk(9, 5), m1 = X.mflash.material as THREE.MeshBasicMaterial, m2 = X.mflash2.material as THREE.MeshBasicMaterial; let o1: THREE.Texture | null = null, o2: THREE.Texture | null = null;
  return { name: "flash", rank: 3, on(b) { if (b) { o1 = m1.map; o2 = m2.map; m1.map = t1; m2.map = t2; } else { m1.map = o1; m2.map = o2; } m1.needsUpdate = true; m2.needsUpdate = true; }, dispose() { t1.dispose(); t2.dispose(); } };
}

/* ── layer 6 (rank 3): hard-surface edges that catch light. Every box of the gun in hand becomes a rounded box (the metal now has highlights along its edges and the new sky to reflect),
   and the hand and forearm become a dark glove and a bracer instead of two plain blocks ── */
function gunLayer(X: HiCtx): Layer {
  const swaps: { m: THREE.Mesh; o: THREE.BufferGeometry; n: THREE.BufferGeometry }[] = [], extra = new THREE.Group(), own: { dispose: () => void }[] = [];
  for (const k of Object.keys(X.guns)) X.guns[k].traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh || m.geometry.type !== "BoxGeometry") return; const p = (m.geometry as THREE.BoxGeometry).parameters, r = Math.min(p.width, p.height, p.depth);
    swaps.push({ m, o: m.geometry, n: new RoundedBoxGeometry(p.width, p.height, p.depth, 2, Math.max(0.0022, Math.min(r * 0.3, 0.011))) });
  });
  const hp = (X.hand.geometry as THREE.BoxGeometry).parameters, fp = (X.fore.geometry as THREE.BoxGeometry).parameters;
  const hn = new RoundedBoxGeometry(hp.width, hp.height, hp.depth, 3, 0.02), fn = new RoundedBoxGeometry(fp.width, fp.height, fp.depth, 3, 0.022), ho = X.hand.geometry, fo = X.fore.geometry;
  const hm = X.hand.material as THREE.MeshStandardMaterial, fm = X.fore.material as THREE.MeshStandardMaterial;
  const glove = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.5, metalness: 0.3 }), steel = new THREE.MeshStandardMaterial({ color: 0x3a424c, roughness: 0.32, metalness: 0.85 }), strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x41e0ff).multiplyScalar(1.6), fog: false });
  const kn = new THREE.SphereGeometry(0.0155, 10, 8), plate = new RoundedBoxGeometry(0.07, 0.022, 0.24, 2, 0.008), sg = new THREE.BoxGeometry(0.008, 0.004, 0.2), cuff = new THREE.CylinderGeometry(0.056, 0.056, 0.03, 14);
  own.push(hn, fn, glove, steel, strip, kn, plate, sg, cuff, ...swaps.map(s => s.n));
  for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(kn, glove); k.position.set(-0.026 + i * 0.0175, -0.028, -0.058); k.scale.set(1, 0.9, 1.15); extra.add(k); }
  const pl = new THREE.Mesh(plate, steel); pl.position.set(0.06, -0.049, 0.32); pl.rotation.x = -0.12; extra.add(pl); const st = new THREE.Mesh(sg, strip); st.position.set(0.06, -0.036, 0.33); st.rotation.x = -0.12; extra.add(st);
  const cf = new THREE.Mesh(cuff, steel); cf.rotation.x = Math.PI / 2 - 0.12; cf.position.set(0.045, -0.1, 0.1); extra.add(cf);
  extra.visible = false; X.hold.add(extra);
  let c0 = 0, r0 = 0, m0 = 0;
  return {
    name: "gun", rank: 3,
    on(b) {
      for (const s of swaps) s.m.geometry = b ? s.n : s.o;
      X.hand.geometry = b ? hn : ho; X.fore.geometry = b ? fn : fo; extra.visible = b;
      if (b) { c0 = hm.color.getHex(); r0 = hm.roughness; m0 = hm.metalness; hm.color.setHex(0x1b2026); hm.roughness = 0.5; hm.metalness = 0.3; } else { hm.color.setHex(c0 || 0xc79a76); hm.roughness = r0 || 0.8; hm.metalness = m0; }
      void fm;
    },
    dispose() { X.hold.remove(extra); for (const o of own) o.dispose(); for (const s of swaps) s.m.geometry = s.o; },
  };
}

/* ── layer 7 (rank 1): a soft contact shadow under every alien, on top of the sun's own shadow ── */
function blobLayer(X: HiCtx): Layer {
  const [c, g] = mk2d(64, 64), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(0,0,0,.62)"); r.addColorStop(0.5, "rgba(0,0,0,.34)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pool: THREE.Mesh[] = []; for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 2; pool.push(m); X.hiGrp.add(m); X.noAO(m); }
  return {
    name: "blobs", rank: 1,
    on(b) { if (!b) for (const m of pool) m.visible = false; },
    update(_dt, s) {
      let k = 0;
      for (const e of s.enemies as { kind: string; x: number; z: number; dead: number }[]) { if (k >= pool.length) break; if (e.dead < 0) continue; const A = (ALIENS as any)[e.kind]; if (!A) continue; const m = pool[k++], f = e.dead > 0 ? Math.max(0, e.dead / 0.9) : 1, rr = A.r * ((ALIEN_SCALE as any)[e.kind] || 1) * 3.0 * f; m.visible = f > 0.02; m.position.set(e.x, 0.03, e.z); m.scale.set(rr, 1, rr); }
      for (; k < pool.length; k++) pool[k].visible = false;
    },
    dispose() { for (const m of pool) X.hiGrp.remove(m); geo.dispose(); mat.dispose(); tex.dispose(); },
  };
}

/* ── layer 8 (rank 3): the lit windows of the arena walls glow (an emissive mask painted like the wall's own windows, so they bloom) ── */
function windowLayer(X: HiCtx): Layer | null {
  if (X.KIT) return null;   // the Robot Adventure planets have plain coloured walls
  const TH = X.TH, [c, g] = mk2d(256, 128); g.fillStyle = "#000"; g.fillRect(0, 0, 256, 128);
  const wc = mix([255, 150, 60], rgbN(TH.sun), 0.3); g.fillStyle = css(wc); for (let i = 0; i < 18; i++) g.fillRect(8 + (i % 6) * 40, 14 + Math.floor(i / 6) * 34, 16, 20);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  let mats: THREE.MeshStandardMaterial[] = [], on = false;
  const grab = () => { if (mats.length) return; X.levelGroup.children.forEach(o => { const m = o as THREE.Mesh, mt = m.material as THREE.MeshStandardMaterial; const im = mt && mt.map && (mt.map.image as any); if (m.isMesh && im && im.width === 256 && im.height === 128 && !mats.includes(mt)) mats.push(mt); }); };
  const set = (b: boolean) => { for (const m of mats) { m.emissiveMap = b ? tex : null; m.emissive.set(b ? 0xffffff : 0x000000); m.emissiveIntensity = 1; m.needsUpdate = true; } };
  return {
    name: "windows", rank: 3,
    on(b) { on = b; grab(); set(b); },
    update(_dt, _s, t) { if (!mats.length) { grab(); if (mats.length && on) set(true); } else for (const m of mats) m.emissiveIntensity = 0.85 + 0.1 * Math.sin(t * 0.9); },
    dispose() { set(false); tex.dispose(); },
  };
}

/* ── layer 9 (rank 3): Luma's gas giant. The flat blue-green ball and its milky disc of a ring become a banded planet with a darkened limb, a glowing atmosphere and a ring with real gaps ── */
const GN = "float hh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); } float nz(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y), mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z); }";
function giantLayer(X: HiCtx): Layer | null {
  const G = X.giant, R = X.giantRing; if (!G || !R) return null;
  const vs = "varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }";
  const body = new THREE.ShaderMaterial({ uniforms: { uA: { value: new THREE.Color(0x2e7a74) }, uB: { value: new THREE.Color(0xb6efe0) }, uAtm: { value: new THREE.Color(0x7fffe0) } }, vertexShader: vs, fog: false,
    fragmentShader: GN + "uniform vec3 uA; uniform vec3 uB; uniform vec3 uAtm; varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vec3 p = normalize(vP); float w = nz(p * vec3(3.0, 5.0, 3.0)) * 0.9 + nz(p * vec3(8.0, 14.0, 8.0)) * 0.4; float b = sin(p.y * 15.0 + w * 2.8) * 0.5 + 0.5; float fine = nz(p * vec3(14.0, 44.0, 14.0)); vec3 col = mix(uA, uB, b * 0.72 + fine * 0.28); float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0); col *= 0.3 + 0.8 * pow(mu, 0.6); col += uAtm * pow(1.0 - mu, 2.6) * 0.55; gl_FragColor = vec4(col, 1.0); }" });
  const ringM = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(0xbff0e0) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: "varying vec2 vXY; void main(){ vXY = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: GN + "uniform vec3 uCol; varying vec2 vXY; void main(){ float t = clamp((length(vXY) - 40.0) / 18.0, 0.0, 1.0); float bands = 0.5 + 0.5 * sin(t * 60.0 + 4.0 * nz(vec3(t * 11.0, 1.0, 2.0))); float gap = 1.0 - smoothstep(0.0, 0.04, abs(t - 0.63)); float gap2 = 1.0 - smoothstep(0.0, 0.015, abs(t - 0.31)); float edge = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.88, 1.0, t)); float a = (0.16 + 0.5 * bands) * edge * (1.0 - 0.9 * gap) * (1.0 - 0.7 * gap2); gl_FragColor = vec4(mix(uCol * 0.55, uCol * 1.12, bands), a * 0.85); }" });
  const atmM = new THREE.ShaderMaterial({ uniforms: { uAtm: { value: new THREE.Color(0x6affd8) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uAtm; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.2); gl_FragColor = vec4(uAtm * f, f * 0.9); }" });
  const atm = new THREE.Mesh(new THREE.SphereGeometry(33.5, 40, 24), atmM); atm.position.copy(G.position); atm.visible = false; atm.renderOrder = 1; X.scene.add(atm); X.noAO(atm);
  const ringGeo = new THREE.RingGeometry(40, 58, 160, 1), oldBody = G.material, oldRing = R.material, oldRingGeo = R.geometry;
  X.noAO(G, R);
  return {
    name: "giant", rank: 3,
    on(b) { G.material = b ? body : oldBody; R.material = b ? ringM : oldRing; R.geometry = b ? ringGeo : oldRingGeo; atm.visible = b; },
    dispose() { X.scene.remove(atm); atm.geometry.dispose(); atmM.dispose(); body.dispose(); ringM.dispose(); ringGeo.dispose(); G.material = oldBody; R.material = oldRing; R.geometry = oldRingGeo; },
  };
}

/* ── the ladder and the public face ── */
/** the classic arena has no theme object: these are the colours its own gradient, fog and ship use */
const DEF_TH = { sky: ["#0b0a1e", "#4a2744", "#d8844f", "#2a1c26"], fog: 0x3a2a34, ground: 0x3b3640, sun: 0xffd9b0, ring: 0xff4a3a };
export function createHiLayers(X0: HiCtx): HiLayers {
  const X: HiCtx = Object.assign({}, X0, { TH: X0.TH || DEF_TH });
  const tier = Math.max(1, Math.min(3, hiTier())), layers: Layer[] = [];
  const off: string[] = (typeof window !== "undefined" && (window as any).__ahHiOff) || [];   // a test door for the harness: layers named here are not built
  const add = (name: string, build: () => Layer | null) => { if (off.includes(name)) return; try { const l = build(); if (l) { const f = l.on; let st = false; l.on = b => { if (b === st) return; st = b; f(b); }; layers.push(l); } } catch (e) { warn(name, e); } };
  const SH: Shared = { env: null, sunDir: new THREE.Vector3(0, 0.5, 0.8).normalize() };
  add("sky", () => skyLayer(X, SH));
  try { for (const l of groundLayer(X, SH)) add(l.name, () => l); } catch (e) { warn("ground", e); }
  add("air", () => airLayer(X, SH));
  add("blobs", () => blobLayer(X));
  let pBurst: ((x: number, y: number, z: number, n: number, col: number, spd: number) => boolean) | null = null, pAct: (() => boolean) | null = null;
  add("particles", () => { const p = particleLayer(X); pBurst = p.burst; pAct = p.active; return p.layer; });
  add("flash", () => flashLayer(X));
  add("gun", () => gunLayer(X));
  add("windows", () => windowLayer(X));
  add("giant", () => giantLayer(X));
  let lvl = tier, isOn = false, fr = 0, slow = 0, t = 0;
  const apply = () => { for (const l of layers) { try { l.on(isOn && l.rank > 3 - lvl); } catch (e) { warn(l.name + " toggle", e); try { l.on(false); } catch (_) { /* */ } } } };
  const api: HiLayers = {
    on(b) { isOn = b; apply(); },
    update(dt, s) {
      if (!isOn) return; t += dt;
      // the ladder: every 30 frames, if half of them took over 30 ms, the costliest layer still on is switched off for good; it never climbs back by itself
      fr++; if (dt > 0.03) slow++; if (fr >= 30) { if (slow >= 15 && lvl > 0) { lvl--; apply(); } fr = 0; slow = 0; }
      for (const l of layers) if (l.update && l.rank > 3 - lvl) { try { l.update(dt, s, t); } catch (e) { warn(l.name + " update", e); l.update = undefined; try { l.on(false); } catch (_) { /* */ } } }
    },
    event(e) { if (!isOn) return; for (const l of layers) if (l.event && l.rank > 3 - lvl) { try { l.event(e); } catch (x) { warn(l.name + " event", x); l.event = undefined; } } },
    softBurst(x, y, z, n, col, spd) { return !!(pBurst && pAct && pAct() && pBurst(x, y, z, n, col, spd)); },
    dispose() { for (const l of layers) { try { l.on(false); l.dispose(); } catch (_) { /* */ } } layers.length = 0; try { if ((window as any).__ahHi === api) delete (window as any).__ahHi; } catch (_) { /* */ } },
    level: () => lvl, names: () => layers.map(l => l.name),
  };
  try { if (localStorage.getItem("tg_test_hook") === "1") (window as any).__ahHi = api; } catch (_) { /* */ }   // the harness's door to ask which layers are alive
  return api;
}
