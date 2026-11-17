/* The Robot Adventure 3D cockpit in High (owner 2026-11-17: "prettier and more real in the high-spec mode, keep the low-spec mode as it is").
   Lite keeps its 1,400 square white points on black, the flat blue sphere and the faceted grey rocks. In High this module adds, all procedural (nothing downloaded):
   - a star field of round soft stars (a few thousand, most of them dim, a handful bright with a little cross), colour-temperature tinted, twinkling slowly;
   - a nebula sky dome painted once from layered noise in the episode's own colours, with a dust lane across it (so there is something to fly through, not black);
   - a painted planet (earth, gas giant, rock, ice, lava ... from the episode's world) with a sun-side atmosphere (scatter shell and outer glow);
   - rocks with real relief: noisy displaced spheres, a procedural surface texture and a bump map.
   Everything is built in try/catch pieces: a piece that throws or a missing capability leaves the previous High look. A slow-frame watchdog switches the pieces off, the costliest first,
   before hi-fx's own ladder (AO, SMAA, bloom) starts. The textures are painted a few rows per frame, so nothing blocks the first seconds of a flight. dispose() frees every geometry, material and texture.
   This file is a dynamic chunk fetched only when Graphics is High; Lite never loads it. */
import * as THREE from "three";
import { orbKind } from "./planet-orb";
import { fbm, sm, mix, hex3, Painter, hasRenderer } from "./adv3d-hi-util";

/** the world's colours: 'kind' comes from planet-orb (earth, jupiter, mars ...), tint is the episode's own palette */
function planetPx(kind: string, tint: number[]) {
  const c0 = hex3(tint[0]), c1 = hex3(tint[1]), c2 = hex3(tint[2]);
  return (u: number, v: number, o: number[]) => {
    const lt = Math.abs(v - 0.5) * 2; let c: number[];
    switch (kind) {
      case "earth": { const land = fbm(u, v, 4, 181, 5), cl = fbm(u + 0.3, v, 6, 191, 4); c = land > 0.52 ? mix([62, 112, 56], [150, 128, 78], fbm(u, v, 12, 201, 3)) : mix([14, 50, 120], [36, 96, 172], fbm(u, v, 9, 211, 3)); if (land > 0.5 && land < 0.54) c = mix(c, [196, 178, 120], 0.6); if (lt > 0.88) c = [236, 242, 250]; c = mix(c, [250, 252, 255], sm(0.52, 0.78, cl) * 0.92); break; }
      case "jupiter": case "saturn": case "gas": { const t = fbm(u + Math.sin(v * 20) * 0.04, v * 1.4, 6, 131, 4), b = Math.sin(v * 46 + t * 3) * 0.5 + 0.5; c = mix([150, 96, 64], [238, 214, 178], b); const rs = Math.exp(-(Math.pow((u - 0.62) * 9, 2) + Math.pow((v - 0.62) * 22, 2))); c = mix(c, [190, 70, 44], Math.min(0.9, rs)); break; }
      case "venus": { const s = fbm(u + Math.sin(v * 9) * 0.06, v * 1.6, 5, 91, 4); c = mix(mix([226, 190, 120], [252, 238, 190], s), [196, 150, 92], Math.pow(fbm(u, v * 2, 6, 101, 3), 2) * 0.7); break; }
      case "titan": c = mix(mix([204, 146, 62], [232, 184, 96], fbm(u, v, 6, 141, 3)), [176, 112, 48], Math.max(0, Math.sin(v * 9) * 0.25)); break;
      case "ice": c = mix([170, 205, 232], [240, 248, 255], fbm(u, v, 7, 231, 4)); c = mix(c, [120, 160, 205], sm(0.62, 0.8, fbm(u, v, 12, 232, 3)) * 0.5); break;
      case "lava": { const g = fbm(u, v, 8, 241, 4), cr = Math.max(0, (0.5 - Math.abs(fbm(u, v, 14, 251, 3) - 0.5)) * 2 - 0.82) * 6; c = mix(mix([34, 22, 20], [92, 52, 38], g), [255, 130, 40], Math.min(1, cr)); break; }
      case "mars": case "proxima": { const big = fbm(u, v, 3, 11, 3), fine = fbm(u, v, 12, 21, 3), d = Math.max(0, Math.min(1, (big - 0.46) * 4.5)); c = mix([196, 112, 62], [214, 150, 96], fine); c = mix(c, [78, 44, 34], d * 0.8); c = mix(c, [244, 240, 236], Math.min(1, Math.max(0, lt - 0.88) * 12)); break; }
      case "moon": case "mercury": case "rock": { const m = sm(0.5, 0.62, fbm(u, v, 3, 61, 3)), g = fbm(u, v, 12, 71, 4); c = mix(mix([150, 144, 136], [206, 200, 190], g), [84, 84, 90], m * 0.75); const crater = Math.pow(Math.abs(fbm(u, v, 26, 77, 2) - 0.5) * 2, 6); c = mix(c, [236, 232, 224], crater * 0.5); break; }
      default: { const g = fbm(u, v, 7, 261, 4), b = Math.sin(v * 18 + g * 4) * 0.5 + 0.5; c = mix(mix(c0, c1, g), mix(c1, c2, 0.5), b * 0.5 + 0.1); c = mix(c, [255, 255, 255], 0.12 * g); }
    }
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 255;
  };
}

/** a rock's surface: grey-brown mottling with craters (also used as its bump map) */
const rockPx = (u: number, v: number, o: number[]) => {
  const g = fbm(u, v, 6, 301, 5), c = Math.pow(Math.abs(fbm(u, v, 9, 311, 3) - 0.5) * 2, 3), r = sm(0.4, 0.75, fbm(u, v, 18, 321, 3)), k = 0.42 + 0.5 * g - 0.22 * c + 0.12 * r;
  o[0] = Math.max(0, Math.min(255, 134 * k * 1.3)); o[1] = Math.max(0, Math.min(255, 120 * k * 1.3)); o[2] = Math.max(0, Math.min(255, 106 * k * 1.3)); o[3] = 255;
};

/** the sky: layered clouds in the episode's colours along a tilted band, with dark dust lanes; nothing brighter than a dim glow so the flight stays readable */
function nebulaPx(tint: number[]) {
  const c1 = hex3(tint[1]), c2 = hex3(tint[2]), c0 = hex3(tint[0]), warm = [255, 160, 110];
  return (u: number, v: number, o: number[]) => {
    const n1 = fbm(u, v, 3, 401, 4), n2 = fbm(u + 0.37, v, 5, 411, 3), n3 = fbm(u + 0.71, v, 8, 421, 3);
    const band = Math.exp(-Math.pow((v - 0.5 - 0.16 * Math.sin(u * 6.2832 + 0.7)) / 0.2, 2));
    const d1 = sm(0.42, 0.82, n1) * (0.18 + 0.82 * band), d2 = sm(0.5, 0.88, n2) * (0.22 + 0.78 * band), dust = sm(0.52, 0.78, n3) * (0.35 + 0.65 * band), core = Math.pow(band, 3) * sm(0.45, 0.8, n1) * 0.5;
    let r = 3 + c0[0] * 0.05, g = 5 + c0[1] * 0.05, b = 10 + c0[2] * 0.06;
    r += c1[0] * d1 * 0.62 + (c2[0] * 0.7 + warm[0] * 0.3) * d2 * 0.42 + core * 170; g += c1[1] * d1 * 0.62 + (c2[1] * 0.7 + warm[1] * 0.3) * d2 * 0.42 + core * 135; b += c1[2] * d1 * 0.62 + (c2[2] * 0.7 + warm[2] * 0.3) * d2 * 0.42 + core * 108;
    const k = 1 - 0.78 * dust; o[0] = Math.min(255, r * k); o[1] = Math.min(255, g * k); o[2] = Math.min(255, b * k); o[3] = 255;
  };
}

const STAR_VS = `attribute float aSize; attribute vec3 aCol; attribute float aTw; uniform float uT; uniform float uPR; varying vec3 vCol; varying float vSz;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float tw = 0.84 + 0.16 * sin(uT * (0.7 + aTw * 1.9) + aTw * 40.0); gl_PointSize = max(1.2, aSize * uPR * (0.92 + 0.16 * tw)); vCol = aCol * tw; vSz = aSize; }`;
const STAR_FS = `varying vec3 vCol; varying float vSz;
void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); float core = exp(-r2 * 6.5); float halo = exp(-r2 * 2.0) * 0.22; float sp = vSz > 3.2 ? (exp(-abs(p.x) * 14.0) + exp(-abs(p.y) * 14.0)) * 0.5 * exp(-r2 * 1.1) : 0.0; float a = core + halo + sp * 0.55; gl_FragColor = vec4(vCol, a); }`;
const ATMO_VS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const ATMO_FS = `uniform vec3 uCol; uniform vec3 uSun; uniform float uK; uniform float uBack; varying vec3 vN; varying vec3 vV;
void main(){ float nv = abs(dot(normalize(vN), normalize(vV))); float lit = smoothstep(-0.3, 0.7, dot(normalize(vN), normalize(uSun)));
  float rim = uBack > 0.5 ? pow(smoothstep(0.0, 0.5, nv), 1.8) * 0.4 : pow(1.0 - nv, 5.0) * smoothstep(0.0, 0.22, nv);
  vec3 col = mix(uCol * 0.5, mix(uCol, vec3(1.0, 0.82, 0.62), 0.3), lit);
  float a = rim * (0.12 + 1.1 * lit) * uK; gl_FragColor = vec4(col, a); }`;
const RING_FS = `uniform vec3 uCol; uniform float uIn; varying vec2 vUv;
void main(){ float r = length(vUv - 0.5) * 2.0; float t = (r - uIn) / (1.0 - uIn); if (t < 0.0 || t > 1.0) discard;
  float b = 0.0; for (int i = 0; i < 6; i++) { float k = float(i); b += (sin(t * (14.0 + k * 21.0) + k * 1.7) * 0.5 + 0.5) / 6.0; }
  float gap = smoothstep(0.54, 0.575, t) * (1.0 - smoothstep(0.63, 0.66, t)); float dens = (0.3 + 0.7 * b) * (1.0 - gap * 0.9) * smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.9, 1.0, t));
  vec3 col = uCol * (0.5 + 0.8 * b); gl_FragColor = vec4(col, dens * 0.78); }`;

const BH_FS = `uniform float uT; uniform float uIn; varying vec2 vUv;
void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0; float t = (r - uIn) / (1.0 - uIn); if (t < 0.0 || t > 1.0) discard; float a = atan(c.y, c.x);
  float sw = sin(a * 3.0 + t * 14.0 - uT * 1.4) * 0.5 + 0.5, sw2 = sin(a * 7.0 - t * 31.0 - uT * 2.2) * 0.5 + 0.5, heat = pow(1.0 - t, 1.7);
  vec3 col = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.55, 0.15), smoothstep(0.0, 0.45, t)); col = mix(col, vec3(0.62, 0.16, 0.2), smoothstep(0.4, 1.0, t));
  float dop = 0.7 + 0.5 * cos(a - 0.6); float dens = (0.45 + 0.55 * (sw * 0.6 + sw2 * 0.4)) * smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.65, 1.0, t));
  gl_FragColor = vec4(col * (0.45 + heat * 1.5) * dop, dens * 0.92); }`;

export type CockpitHi = { update(dt: number, t: number, cam: THREE.Camera, speed: number): void; perf(rawMs: number): void; rockGeo(i: number): THREE.BufferGeometry | null; rockMat(): THREE.Material | null; onRocks(f: () => void): void; boom(x: number, y: number, z: number, r: number): boolean; dispose(): void };

export function createCockpitHi(scene: THREE.Scene, renderer: THREE.WebGLRenderer, o: { id: string; tint: number[]; planet: THREE.Mesh; ring: THREE.Mesh; bhDisc: THREE.Mesh | null; oldStars: THREE.Points; oldNebula: THREE.Object3D[]; oldAtmo: THREE.Object3D | null; sunDir: THREE.Vector3 }): CockpitHi | null {
  if (!hasRenderer || !(renderer instanceof THREE.WebGLRenderer)) return null;
  const added: THREE.Object3D[] = [], owned: Array<{ dispose(): void }> = [], pieces: Array<{ name: string; cost: number; on: boolean; off: () => void }> = []; const painters: Painter[] = [];
  const pr = Math.min(renderer.getPixelRatio(), 2);
  let stars: THREE.Points | null = null, starMat: THREE.ShaderMaterial | null = null, atmo: THREE.ShaderMaterial[] = [], rocks: { geos: THREE.BufferGeometry[]; mat: THREE.MeshStandardMaterial } | null = null, rockReady = false;
  const rockCbs: Array<() => void> = [], sunV = new THREE.Vector3(), kind = (() => { try { return orbKind(o.id); } catch (e) { return "generic"; } })();
  const piece = (name: string, cost: number, off: () => void) => { pieces.push({ name, cost, on: true, off }); }, piecesOn = (name: string) => { const q = pieces.find(z => z.name === name); return !q || q.on; };
  /* 1. stars */
  try {
    const N = 2600, pos = new Float32Array(N * 3), siz = new Float32Array(N), col = new Float32Array(N * 3), tw = new Float32Array(N); let s = 9173;
    const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, TEMP = [[0.72, 0.82, 1.0], [0.88, 0.93, 1.0], [1.0, 1.0, 1.0], [1.0, 0.94, 0.8], [1.0, 0.82, 0.62], [1.0, 0.68, 0.5]];
    for (let i = 0; i < N; i++) { const a = R() * 6.2832, b = Math.acos(2 * R() - 1), r = 3000 + R() * 300; pos[i * 3] = Math.sin(b) * Math.cos(a) * r; pos[i * 3 + 1] = Math.cos(b) * r; pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
      const m = Math.pow(R(), 5.5); siz[i] = 1.0 + 4.6 * m; const k = 0.34 + 0.9 * Math.sqrt(m), t = TEMP[Math.min(5, Math.floor(R() * R() * 6.4))]; col[i * 3] = t[0] * k; col[i * 3 + 1] = t[1] * k; col[i * 3 + 2] = t[2] * k; tw[i] = R(); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSize", new THREE.BufferAttribute(siz, 1)); g.setAttribute("aCol", new THREE.BufferAttribute(col, 3)); g.setAttribute("aTw", new THREE.BufferAttribute(tw, 1));
    starMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uPR: { value: pr } }, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending });
    stars = new THREE.Points(g, starMat); stars.frustumCulled = false; stars.renderOrder = -5; scene.add(stars); added.push(stars); owned.push(g, starMat); o.oldStars.visible = false;
    piece("stars", 1, () => { if (stars) stars.visible = false; o.oldStars.visible = true; });
  } catch (e) { stars = null; o.oldStars.visible = true; }
  /* 2. the nebula sky, as the scene's background (a cube map painted a few rows per frame). It is not an object, so hi-fx's ambient-occlusion pass never sees it. */
  let cubeTex: THREE.CubeTexture | null = null, cubeDone = false; const oldBg = scene.background, oldBgI = (scene as any).backgroundIntensity;
  try {
    const N = 112, faces = Array.from({ length: 6 }, () => { const c = document.createElement("canvas"); c.width = c.height = N; return c; }), imgs = faces.map(c => c.getContext("2d")!.createImageData(N, N)), px = nebulaPx(o.tint), out = [0, 0, 0, 255]; let f = 0, y = 0;
    cubeTex = new THREE.CubeTexture(faces as any); cubeTex.colorSpace = THREE.SRGBColorSpace; owned.push(cubeTex);
    const dirOf = (face: number, a: number, b: number): number[] => (face === 0 ? [1, -b, -a] : face === 1 ? [-1, -b, a] : face === 2 ? [a, 1, b] : face === 3 ? [a, -1, -b] : face === 4 ? [a, -b, 1] : [-a, -b, -1]);
    const nebStep = (ms: number): boolean => {
      if (cubeDone) return true; const t0 = performance.now();
      while (f < 6 && performance.now() - t0 < ms) { for (let r = 0; r < 4 && y < N; r++, y++) { for (let x = 0; x < N; x++) { const d = dirOf(f, (x + 0.5) / N * 2 - 1, (y + 0.5) / N * 2 - 1), l = Math.hypot(d[0], d[1], d[2]) || 1; px(Math.atan2(d[2], d[0]) / 6.2832 + 0.5, Math.acos(Math.max(-1, Math.min(1, d[1] / l))) / 3.1416, out); const i = (y * N + x) * 4; imgs[f].data[i] = out[0]; imgs[f].data[i + 1] = out[1]; imgs[f].data[i + 2] = out[2]; imgs[f].data[i + 3] = 255; } }
        if (y >= N) { faces[f].getContext("2d")!.putImageData(imgs[f], 0, 0); f++; y = 0; } }
      if (f >= 6) { cubeDone = true; cubeTex!.needsUpdate = true; if (piecesOn("nebula")) { scene.background = cubeTex; (scene as any).backgroundIntensity = 0; for (const n of o.oldNebula) n.visible = false; } } return cubeDone; };
    painters.push({ done: false, step: (ms: number) => nebStep(ms) } as any); const pr0 = painters[painters.length - 1] as any; Object.defineProperty(pr0, "done", { get: () => cubeDone });
    piece("nebula", 2, () => { scene.background = oldBg; (scene as any).backgroundIntensity = oldBgI === undefined ? 1 : oldBgI; for (const n of o.oldNebula) n.visible = true; });
  } catch (e) { cubeTex = null; }
  /* 3. planet: painted surface and a sun-side atmosphere. fog: false because the scene's exponential fog swallows anything 2,000 units away (the old planet was a black disc) */
  try {
    const p = new Painter(256, 128, planetPx(kind, o.tint)); painters.push(p);
    const m2 = new THREE.MeshStandardMaterial({ map: p.tex, roughness: kind === "earth" ? 0.55 : 0.92, metalness: 0, emissive: new THREE.Color(o.tint[0]), emissiveIntensity: 0.1, fog: false }); const m1 = o.planet.material; owned.push(m2, p.tex); p.onDone = () => { if (piecesOn("planet")) o.planet.material = m2; };
    const R0 = (o.planet.geometry as THREE.SphereGeometry).parameters.radius, col = new THREE.Color(o.tint[2]).lerp(new THREE.Color(0x9ad0ff), 0.4);
    const mkA = (rad: number, back: number, side: THREE.Side, k: number) => { const g = new THREE.SphereGeometry(rad, 40, 24), m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: col }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uK: { value: k }, uBack: { value: back } }, vertexShader: ATMO_VS, fragmentShader: ATMO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side }); const mesh = new THREE.Mesh(g, m); mesh.position.copy(o.planet.position); mesh.renderOrder = 1; scene.add(mesh); added.push(mesh); owned.push(g, m); atmo.push(m); return mesh; };
    const a1 = mkA(R0 * 1.03, 0, THREE.FrontSide, 1.0), a2 = mkA(R0 * 1.2, 1, THREE.BackSide, 1.0); if (o.oldAtmo) o.oldAtmo.visible = false;
    piece("planet", 2, () => { o.planet.material = m1; a1.visible = a2.visible = false; if (o.oldAtmo) o.oldAtmo.visible = true; });
  } catch (e) { /* the previous planet stays */ }
  /* 3b. the ring: bands, a dark division and soft edges instead of one flat tinted band */
  try {
    const rm = o.ring, rg = rm.geometry as THREE.RingGeometry, inner = rg.parameters.innerRadius, outer = rg.parameters.outerRadius, m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(o.tint[2]).lerp(new THREE.Color(0xe8d8c0), 0.35) }, uIn: { value: inner / outer } }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false }), old = rm.material;
    rm.material = m; owned.push(m); piece("ring", 1, () => { rm.material = old; });
  } catch (e) { /* the previous ring stays */ }
  /* 3b2. the black hole's accretion disc: hot white-yellow inside, orange then red outside, swirling bands, brighter on the side that turns towards us */
  try {
    if (o.bhDisc) { const dm = o.bhDisc, dg = dm.geometry as THREE.RingGeometry, m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uIn: { value: dg.parameters.innerRadius / dg.parameters.outerRadius } }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: BH_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false }), old = dm.material; dm.material = m; owned.push(m); bhU = m.uniforms.uT; piece("bhdisc", 1, () => { dm.material = old; bhU = null; }); }
  } catch (e) { /* the flat disc stays */ }
  /* 3c. explosions: a soft fireball, a shock ring and a few sparks instead of the flat orange sphere */
  /* hi-fx's ambient-occlusion pass draws the whole scene again with a normal material; a camera-facing quad (a Sprite) shows up there as a flat square and darkens a box round itself.
     So the sprites are switched off for that pass only: Scene.onBeforeRender runs at the start of every render, and the AO pass is the one that has an overrideMaterial. */
  const hideAO: THREE.Object3D[] = [], prevBefore = scene.onBeforeRender;
  scene.onBeforeRender = function (this: any, r: any, sc: any, c: any, t: any) { try { prevBefore.call(this, r, sc, c, t); } catch (e) { /* */ } const ao = sc.overrideMaterial != null; for (const q of hideAO) { if (ao) { if (q.visible) { q.userData.hideAO = true; q.visible = false; } } else if (q.userData.hideAO) { q.visible = true; q.userData.hideAO = false; } } } as any;
  let bhU: { value: number } | null = null; let boomFn: ((x: number, y: number, z: number, r: number) => boolean) | null = null, boomUp: ((dt: number, cam: THREE.Camera) => void) | null = null;
  try {
    const mk = (draw: (g: CanvasRenderingContext2D) => void) => { const c = document.createElement("canvas"); c.width = c.height = 128; draw(c.getContext("2d")!); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; owned.push(t); return t; };
    const fbT = mk(g => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 62); gr.addColorStop(0, "rgba(255,250,232,1)"); gr.addColorStop(0.16, "rgba(255,218,130,.96)"); gr.addColorStop(0.42, "rgba(255,142,52,.55)"); gr.addColorStop(0.74, "rgba(232,86,32,.16)"); gr.addColorStop(1, "rgba(200,60,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 12; i++) { const a = i * 0.9, d = 18 + (i % 4) * 8, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 10 + (i % 3) * 4, q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, "rgba(255,196,110,.34)"); q.addColorStop(1, "rgba(255,130,40,0)"); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); } });
    const rgT = mk(g => { const gr = g.createRadialGradient(64, 64, 34, 64, 64, 62); gr.addColorStop(0, "rgba(255,230,190,0)"); gr.addColorStop(0.55, "rgba(255,225,185,.65)"); gr.addColorStop(1, "rgba(255,200,150,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const POOL = 8, pool = Array.from({ length: POOL }, () => { const a = new THREE.Sprite(new THREE.SpriteMaterial({ map: fbT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })), b = new THREE.Sprite(new THREE.SpriteMaterial({ map: rgT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); a.visible = b.visible = false; a.renderOrder = b.renderOrder = 6; scene.add(a, b); added.push(a, b); hideAO.push(a, b); owned.push(a.material, b.material); return { a, b, t: 9, r: 1 }; });
    const SN = 72, spg = new THREE.BufferGeometry(), spPos = new Float32Array(SN * 3), spCol = new Float32Array(SN * 3), spVel = new Float32Array(SN * 3), spLife = new Float32Array(SN); spg.setAttribute("position", new THREE.BufferAttribute(spPos, 3)); spg.setAttribute("color", new THREE.BufferAttribute(spCol, 3));
    const spM = new THREE.PointsMaterial({ size: 1.5, map: fbT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }), sparks = new THREE.Points(spg, spM); sparks.frustumCulled = false; sparks.renderOrder = 6; scene.add(sparks); added.push(sparks); owned.push(spg, spM); let sn = 0;
    boomFn = (x, y, z, r) => { const e = pool.find(q => q.t >= 0.55) || pool[0]; e.t = 0; e.r = Math.max(2, r); e.a.position.set(x, y, z); e.b.position.set(x, y, z); e.a.visible = e.b.visible = true;
      for (let k = 0; k < 9; k++) { const i = sn++ % SN, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), sp = (22 + Math.random() * 60) * (0.5 + e.r * 0.12); spPos[i * 3] = x; spPos[i * 3 + 1] = y; spPos[i * 3 + 2] = z; spVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp; spVel[i * 3 + 1] = Math.cos(ph) * sp; spVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp; spLife[i] = 0.55 + Math.random() * 0.45; }
      return true; };
    boomUp = (dt, cam) => { for (const e of pool) { if (e.t >= 0.55) { if (e.a.visible) e.a.visible = e.b.visible = false; continue; } e.t += dt; const k = Math.min(1, e.t / 0.55), ez = 1 - Math.pow(1 - k, 3), lim = Math.max(1, e.a.position.distanceTo(cam.position)) * 0.5;   // never wider than half the distance, so a blast beside the ship does not fill the screen
        e.a.scale.setScalar(Math.min(lim, e.r * (1.5 + 3.2 * ez))); (e.a.material as THREE.SpriteMaterial).opacity = 0.88 * Math.pow(1 - k, 1.5); e.b.scale.setScalar(Math.min(lim * 1.5, e.r * (1.8 + 5.5 * ez))); (e.b.material as THREE.SpriteMaterial).opacity = 0.34 * (1 - k); }
      for (let i = 0; i < SN; i++) { if (spLife[i] <= 0) { spCol[i * 3] = spCol[i * 3 + 1] = spCol[i * 3 + 2] = 0; continue; } spLife[i] -= dt; spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt; const f = Math.max(0, spLife[i] / 0.9); spCol[i * 3] = 1.0 * f; spCol[i * 3 + 1] = 0.72 * f; spCol[i * 3 + 2] = 0.4 * f * f; }
      (spg.attributes.position as THREE.BufferAttribute).needsUpdate = true; (spg.attributes.color as THREE.BufferAttribute).needsUpdate = true; };
    piece("booms", 1, () => { boomFn = null; boomUp = null; for (const e of pool) e.a.visible = e.b.visible = false; sparks.visible = false; });
  } catch (e) { boomFn = null; boomUp = null; }
  /* 4. rocks with relief */
  try {
    const p = new Painter(160, 160, rockPx, true); painters.push(p);
    const mat = new THREE.MeshStandardMaterial({ map: p.tex, bumpMap: p.tex, bumpScale: 3.2, roughness: 1, metalness: 0, color: 0xffffff }); owned.push(mat, p.tex);
    const geos: THREE.BufferGeometry[] = [];
    for (let v = 0; v < 3; v++) {
      const g = new THREE.SphereGeometry(1, 44, 30), pa = g.attributes.position as THREE.BufferAttribute, sx = 1 + v * 0.12, sy = 0.82 + v * 0.1, sz = 1 - v * 0.06;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), u = Math.atan2(z, x) / 6.2832 + 0.5, w = Math.acos(Math.max(-1, Math.min(1, y))) / 3.1416, d = 0.78 + 0.34 * fbm(u, w, 5, 500 + v * 9, 4) + 0.1 * fbm(u, w, 18, 520 + v, 2); pa.setXYZ(i, x * d * sx, y * d * sy, z * d * sz); }
      g.computeVertexNormals();
      const na = g.attributes.normal as THREE.BufferAttribute, acc = new Map<string, number[]>(), key = (i: number) => Math.round(pa.getX(i) * 1e4) + "," + Math.round(pa.getY(i) * 1e4) + "," + Math.round(pa.getZ(i) * 1e4);   // the UV seam has two vertices at one place: share their normal
      for (let i = 0; i < pa.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += na.getX(i); a[1] += na.getY(i); a[2] += na.getZ(i); acc.set(k, a); }
      for (let i = 0; i < pa.count; i++) { const a = acc.get(key(i))!, l = Math.hypot(a[0], a[1], a[2]) || 1; na.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
      geos.push(g); owned.push(g);
    }
    rocks = { geos, mat }; p.onDone = () => { rockReady = true; for (const f of rockCbs) { try { f(); } catch (e) { /* */ } } };
    piece("rocks", 1, () => { rockReady = false; for (const f of rockCbs) { try { f(); } catch (e) { /* */ } } });
  } catch (e) { rocks = null; }
  if (!pieces.length) return null;
  /* the ladder: when frames stay slow drop one piece, the costliest first (the same idea as hi-fx's AO, SMAA, bloom steps, but ours go before them) */
  let fr = 0, slow = 0;
  const ladder = () => { const live = pieces.filter(q => q.on).sort((a, b) => b.cost - a.cost); const q = live[0]; if (q) { q.on = false; try { q.off(); } catch (e) { /* */ } try { console.warn("HIFX cockpit-hi dropped " + q.name); } catch (e) { /* */ } } };
  return {
    boom: (x, y, z, r) => (boomFn ? boomFn(x, y, z, r) : false),
    rockGeo: (i) => (rocks && rockReady ? rocks.geos[((i % 3) + 3) % 3] : null), rockMat: () => (rocks && rockReady ? rocks.mat : null), onRocks: (f) => { rockCbs.push(f); },
    update(dt, t, cam, speed) {
      for (const p of painters) { if (!p.done) { p.step(3.2); break; } }   // one texture at a time, ~2 ms a frame
      if (starMat) starMat.uniforms.uT.value = t % 600; if (boomUp) boomUp(dt, cam); if (bhU) bhU.value = t % 600;
      if (stars) stars.position.copy(cam.position); if (cubeDone && piecesOn("nebula") && (scene as any).backgroundIntensity < 1) (scene as any).backgroundIntensity = Math.min(1, ((scene as any).backgroundIntensity || 0) + dt * 3);
      if (atmo.length) { sunV.copy(o.sunDir).transformDirection(cam.matrixWorldInverse); for (const m of atmo) m.uniforms.uSun.value.copy(sunV); }
      void speed;
    },
    perf(rawMs) { fr++; if (rawMs > 26) slow++; if (fr >= 90) { if (slow > 45) ladder(); fr = 0; slow = 0; } },
    dispose() {
      for (const q of pieces) { if (q.on) { q.on = false; try { q.off(); } catch (e) { /* the previous High look comes back */ } } }
      try { scene.onBeforeRender = prevBefore; for (const q of hideAO) q.visible = false; } catch (e) { /* */ }
      try { for (const m of added) scene.remove(m); added.length = 0; } catch (e) { /* */ }
      for (const x of owned) { try { x.dispose(); } catch (e) { /* */ } }
    },
  };
}
