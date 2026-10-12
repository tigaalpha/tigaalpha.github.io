/* ── Adventure 3D backdrop (owner, 2026-10-12: a 3D quality level for strong devices, with a 2D fallback) ──
   "2.5D": a real Three.js world (depth, parallax, fog, light) drawn BEHIND the game's own transparent 2D canvas, which keeps drawing the monsters, the
   shots, the effects and the HUD exactly as before. The camera looks straight at the game plane (z = 0) from far away, with a field of view chosen so that
   one game unit is exactly the same number of pixels as on the 2D canvas; what stands behind that plane (the hills, towers, trees) is therefore in the right
   place for the gameplay and moves with real perspective parallax. Loaded only when the player picks 3D on a device that can take it (`can3d`).
   The caller watches the frame rate and drops back to 2D High when it is too slow (see `Adv3DWatch`). */
import * as THREE from "three";
import { spaceTier, isLowEnd } from "./space-stage";

/** Strong enough for 3D: not a low-end phone and a GPU that earned at least tier 2 */
export function can3d(): boolean { try { return !isLowEnd() && spaceTier() >= 2; } catch (e) { return false; } }

const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const col = (s: string) => { const [r, g, b] = s.split(",").map(Number); return new THREE.Color((r || 0) / 255, (g || 0) / 255, (b || 0) / 255); };
const hexCol = (s: string) => new THREE.Color(s);

export interface Adv3D { render(camX: number, tm: number, kk: number, w: number, h: number, groundY: number, shx: number, shy: number, heroX: number): void; resize(w: number, h: number, dpr: number): void; dispose(): void; }

// per style: [body geometry, accent geometry, accent height as a fraction of the body, body colour mix, accent emissive]
type Kit = { body: THREE.BufferGeometry; acc: THREE.BufferGeometry; accY: number; accScale: (w: number, h: number) => [number, number, number]; };
const kitOf = (style: string): Kit => {
  switch (style) {
    case "mesa": return { body: new THREE.CylinderGeometry(0.7, 1, 1, 5), acc: new THREE.CylinderGeometry(0.71, 0.72, 0.05, 5), accY: 0.86, accScale: (w, h) => [w, h, w] };
    case "pillar": return { body: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), acc: new THREE.TorusGeometry(0.58, 0.07, 6, 12).rotateX(Math.PI / 2), accY: 0.7, accScale: (w, h) => [w, h * 0.5, w] };
    case "ice": return { body: new THREE.ConeGeometry(1, 1, 5), acc: new THREE.OctahedronGeometry(0.45), accY: 1.06, accScale: (w, h) => [w * 0.5, w * 0.8, w * 0.5] };
    case "volcano": return { body: new THREE.ConeGeometry(1.5, 1, 7), acc: new THREE.SphereGeometry(0.4, 8, 6), accY: 0.98, accScale: (w, h) => [w, w * 0.7, w] };
    case "ruins": return { body: new THREE.BoxGeometry(1, 1, 1), acc: new THREE.BoxGeometry(1.03, 0.05, 1.03), accY: 0.62, accScale: (w, h) => [w, h, w] };
    default: return { body: new THREE.CylinderGeometry(0.12, 0.17, 1, 6), acc: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), accY: 1, accScale: (w, h) => [w * 1.9, w * 1.1, w * 1.9] };   // mushrooms
  }
};

function gradientTex(c0: string, c1: string, c2: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = 4; cv.height = 256; const x = cv.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTex(rgb: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.35, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

export function createAdv3D(host: HTMLElement, P: any, style: { mid: string; near: string }, worldLen: number): Adv3D | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" }); } catch (e) { return null; }
  const el = renderer.domElement; el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"; el.setAttribute("aria-hidden", "true"); host.appendChild(el);
  renderer.setClearColor(0x000000, 0);
  const disposables: any[] = [];
  const keep = <T,>(o: T): T => { disposables.push(o); return o; };

  const scene = new THREE.Scene();
  const cSky0 = hexCol(P.c[0]), cSky1 = hexCol(P.c[1]), cSky2 = hexCol(P.c[2]), glow = col(P.glow), acc = col(P.acc);
  scene.fog = new THREE.FogExp2(cSky1.clone().lerp(cSky0, 0.35).getHex(), 0.00075);
  const camera = new THREE.PerspectiveCamera(40, 1.7, 20, 6000);

  // ── the sky: one big gradient wall that follows the camera, two moons and a ringed neighbour
  const skyTex = keep(gradientTex(P.c[0], P.c[1], P.c[2]));
  const sky = new THREE.Mesh(keep(new THREE.PlaneGeometry(9000, 3600)), keep(new THREE.MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false })));
  sky.position.z = -3200; sky.renderOrder = -10; scene.add(sky);
  const gt = keep(glowTex(P.glow)), gt2 = keep(glowTex(P.acc));
  const moon = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: gt, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }))); moon.scale.set(520, 520, 1); moon.position.z = -3000; scene.add(moon);
  const moon2 = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: gt2, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }))); moon2.scale.set(220, 220, 1); moon2.position.z = -2800; scene.add(moon2);

  // ── light
  scene.add(new THREE.HemisphereLight(cSky2.getHex(), cSky0.getHex(), 1.15));
  const sun = new THREE.DirectionalLight(glow.clone().lerp(new THREE.Color(1, 1, 1), 0.5).getHex(), 0.7); sun.position.set(-300, 500, 600); scene.add(sun);
  const heroLight = new THREE.PointLight(glow.getHex(), 2.4, 520, 1.6); heroLight.position.set(0, 90, 70); scene.add(heroLight);

  // ── the ground: a dark slab running away from the camera with a glowing grid, so the floor has depth
  const gGeo = keep(new THREE.PlaneGeometry(worldLen + 9000, 3000)).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gGeo, keep(new THREE.MeshLambertMaterial({ color: cSky1.clone().lerp(cSky0, 0.55).getHex() })));
  ground.position.set((worldLen) / 2, -1, -1350 + 150); scene.add(ground);
  const grid = new THREE.GridHelper(worldLen + 9000, Math.round((worldLen + 9000) / 120), acc.getHex(), acc.getHex()); (grid.material as any).transparent = true; (grid.material as any).opacity = 0.18; grid.scale.z = 0.33; grid.position.set(worldLen / 2, 0.5, -1350 + 150); scene.add(grid); keep(grid.geometry); keep(grid.material);
  const edge = new THREE.Mesh(keep(new THREE.PlaneGeometry(worldLen + 9000, 5)).rotateX(-Math.PI / 2), keep(new THREE.MeshBasicMaterial({ color: glow.getHex(), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, fog: false }))); edge.position.set(worldLen / 2, 1, 2); scene.add(edge);

  // ── the middle distance: instanced towers, mesas, spires or mushrooms at several depths (the style of the planet)
  const kit = kitOf(style.mid), bodyMat = keep(new THREE.MeshLambertMaterial({ color: cSky1.clone().lerp(cSky2, 0.28).getHex() }));
  const accMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }));
  const depths = [-90, -210, -380, -620, -960, -1500], per = 70, total = depths.length * per;
  const body = new THREE.InstancedMesh(keep(kit.body), bodyMat, total), accent = new THREE.InstancedMesh(keep(kit.acc), accMat, total);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(); let n = 0;
  for (let d = 0; d < depths.length; d++) for (let i = 0; i < per; i++) {
    const seed = d * 1000 + i, z = depths[d] + (rnd(seed + 3) - 0.5) * 70, x = -1500 + ((i + rnd(seed)) / per) * (worldLen + 4200), s = 1 + d * 0.28;
    const w = (15 + rnd(seed + 9) * 24) * s, h = (46 + rnd(seed + 17) * 150) * (0.8 + d * 0.3);
    pos.set(x, h / 2, z); scl.set(w, h, w); m4.compose(pos, q, scl); body.setMatrixAt(n, m4);
    const as = kit.accScale(w, h); pos.set(x, h * kit.accY, z); scl.set(as[0], as[1], as[2]); m4.compose(pos, q, scl); accent.setMatrixAt(n, m4); accent.setColorAt(n, glow.clone().lerp(acc, rnd(seed + 41)).multiplyScalar(1.15)); n++;
  }
  body.instanceMatrix.needsUpdate = accent.instanceMatrix.needsUpdate = true; if (accent.instanceColor) accent.instanceColor.needsUpdate = true; scene.add(body); scene.add(accent);

  // ── in front of the game plane: a few low dark shapes at the bottom edge for depth
  const nearGeo = keep(new THREE.ConeGeometry(1, 1, 5)), nearMat = keep(new THREE.MeshLambertMaterial({ color: cSky0.clone().lerp(new THREE.Color(0, 0, 0), 0.5).getHex() }));
  const near = new THREE.InstancedMesh(nearGeo, nearMat, 40);
  for (let i = 0; i < 40; i++) { const x = -200 + (i / 40) * (worldLen + 600) + rnd(i + 70) * 90, s = 18 + rnd(i + 31) * 24; pos.set(x, 12, 120 + rnd(i + 5) * 60); scl.set(s, 34 + rnd(i + 13) * 40, s); m4.compose(pos, q, scl); near.setMatrixAt(i, m4); }
  near.instanceMatrix.needsUpdate = true; scene.add(near);

  // ── fireflies / spores: 260 points drifting in the air in front of and behind the plane
  const FN = 260, fpos = new Float32Array(FN * 3), fbase = new Float32Array(FN * 3);
  for (let i = 0; i < FN; i++) { fbase[i * 3] = rnd(i + 200) * (worldLen + 1800) - 600; fbase[i * 3 + 1] = 20 + rnd(i + 300) * 360; fbase[i * 3 + 2] = -500 + rnd(i + 400) * 640; }
  const fGeo = keep(new THREE.BufferGeometry()); fGeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
  const flies = new THREE.Points(fGeo, keep(new THREE.PointsMaterial({ map: gt2, size: 26, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: acc.getHex(), sizeAttenuation: true })));
  flies.frustumCulled = false; scene.add(flies);

  let W = 0, H = 0;
  const api: Adv3D = {
    resize(w, h, dpr) { W = w; H = h; renderer.setPixelRatio(Math.min(dpr, 1.6)); renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); },
    render(camX, tm, kk, w, h, groundY, shx, shy, heroX) {
      if (w !== W || h !== H) api.resize(w, h, window.devicePixelRatio || 1);
      // one game unit = kk css pixels at the game plane: pick the camera so the plane fits exactly
      const D = 1000, visH = h / kk; camera.fov = (2 * Math.atan(visH / 2 / D) * 180) / Math.PI; camera.updateProjectionMatrix();
      const cx = camX + w / (2 * kk) - shx / kk, cy = groundY - h / (2 * kk) + shy / kk;
      camera.position.set(cx, cy, D); camera.lookAt(cx, cy, 0);
      sky.position.set(cx * 0.97, cy + 700, -3200); moon.position.set(cx * 0.9 + 700, 900 + cy * 0.2, -3000); moon2.position.set(cx * 0.92 - 900, 780 + cy * 0.2, -2800);
      heroLight.position.x = heroX; heroLight.intensity = 2.2 + Math.sin(tm * 2) * 0.25;
      const a = fGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < FN; i++) { fpos[i * 3] = fbase[i * 3] + Math.sin(tm * 0.4 + i) * 26; fpos[i * 3 + 1] = fbase[i * 3 + 1] + Math.sin(tm * 0.6 + i * 1.7) * 22; fpos[i * 3 + 2] = fbase[i * 3 + 2]; }
      a.needsUpdate = true;
      renderer.render(scene, camera);
    },
    dispose() { try { for (const d of disposables) d && d.dispose && d.dispose(); body.dispose(); accent.dispose(); near.dispose(); renderer.dispose(); if (el.parentNode) el.parentNode.removeChild(el); const lc = renderer.getContext().getExtension("WEBGL_lose_context"); if (lc) lc.loseContext(); } catch (e) {} },
  };
  return api;
}
