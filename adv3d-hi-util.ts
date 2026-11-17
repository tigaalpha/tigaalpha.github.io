/* Shared helpers of the High-only graphics layers of the Adventure's 3D places (space ranch, colony, cockpit, story map; plan 40).
   Only High-only chunks import this file, so Lite never loads it. Procedural noise (periodic, from a lookup table, cheap enough to paint a texture a few rows per frame),
   a row-by-row texture painter, a soft glow texture, and a disposer that frees every geometry, material and texture of a scene graph. */
import * as THREE from "three";

const LAT = (() => { const a = new Float32Array(65536); let s = 2463534242; for (let i = 0; i < 65536; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; a[i] = s / 4294967296; } return a; })();
const lat = (ix: number, iy: number, sd: number) => LAT[(ix * 257 + iy * 1031 + sd * 4099) & 0xffff];
/** value noise, periodic in x (`per` cells round the sky or the planet), smooth; v in 0..1 maps to per / 2 cells */
export function vn(u: number, v: number, per: number, sd: number): number {
  const x = u * per, y = v * per * 0.5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), x0 = ((ix % per) + per) % per, x1 = (x0 + 1) % per;
  return (lat(x0, iy, sd) * (1 - sx) + lat(x1, iy, sd) * sx) * (1 - sy) + (lat(x0, iy + 1, sd) * (1 - sx) + lat(x1, iy + 1, sd) * sx) * sy;
}
export function fbm(u: number, v: number, per: number, sd: number, oct = 4): number { let a = 0, amp = 0.5, tot = 0, p = per; for (let o = 0; o < oct; o++) { a += vn(u, v, p, sd + o * 7) * amp; tot += amp; amp *= 0.5; p *= 2; } return a / tot; }
export const sm = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const hex3 = (h: number) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

/** the renderer class is read once so this chunk depends on the same three modules as the code that imports it (Rollup would otherwise split three into two chunks and add weight to Lite's first load) */
export const hasRenderer = typeof THREE.WebGLRenderer === "function";

/** a texture painted a few rows at a time: step() returns true when finished */
export class Painter {
  y = 0; done = false; tex: THREE.DataTexture; onDone: (() => void) | null = null; private data: Uint8Array;
  constructor(public w: number, public h: number, private px: (u: number, v: number, o: number[]) => void, srgb = true) {
    this.data = new Uint8Array(w * h * 4); this.tex = new THREE.DataTexture(this.data, w, h, THREE.RGBAFormat); this.tex.wrapS = THREE.RepeatWrapping; this.tex.wrapT = THREE.ClampToEdgeWrapping; this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearMipmapLinearFilter; this.tex.generateMipmaps = true; if (srgb) this.tex.colorSpace = THREE.SRGBColorSpace;
  }
  step(budgetMs: number): boolean {
    if (this.done) return true; const t0 = performance.now(), o = [0, 0, 0, 255];
    while (this.y < this.h && performance.now() - t0 < budgetMs) { for (let r = 0; r < 4 && this.y < this.h; r++, this.y++) { for (let x = 0; x < this.w; x++) { this.px((x + 0.5) / this.w, (this.y + 0.5) / this.h, o); const i = (this.y * this.w + x) * 4; this.data[i] = o[0]; this.data[i + 1] = o[1]; this.data[i + 2] = o[2]; this.data[i + 3] = o[3] === undefined ? 255 : o[3]; } } }
    if (this.y >= this.h) { this.done = true; this.tex.needsUpdate = true; if (this.onDone) { try { this.onDone(); } catch (e) { /* */ } } } return this.done;
  }
}


/** a soft white blob (alpha falls off like a Gaussian): the light pool, the halo and the glow sprites share it */
export function glowTexture(size = 64, tail = 2.4): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d")!, h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
  for (let i = 0; i <= 8; i++) { const r = i / 8; g.addColorStop(r, "rgba(255,255,255," + Math.exp(-r * r * tail * 1.6).toFixed(3) + ")"); }
  g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}


/** free everything a layer created: geometries, materials and every texture a material points at (the renderer's own dispose() does not do this) */
export function disposeTree(root: THREE.Object3D): void {
  const seen = new Set<any>();
  root.traverse((o: any) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { if (seen.has(m)) continue; seen.add(m); for (const k in m) { const v = m[k]; if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } } m.dispose(); }
  });
}
