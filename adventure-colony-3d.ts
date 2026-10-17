/* The colony's buildings as real 3D (owner, 2026-10-17: "use three.js so the graphics are prettier").
   An orthographic three.js layer lies over the 2D backdrop (sky, skyline, terrain) and draws ONLY the buildings, with lights, soft shadows,
   glass and lit windows. The camera is set so a plot lands exactly where the 2D projection `ptW` puts it (2:1 isometric, 30 degree
   elevation), which keeps the transparent plot buttons, the pan, the zoom and the two-finger turn of the 2D view working unchanged.
   Returns null when WebGL is missing, and the caller keeps drawing the 2D buildings. */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Col3D = { render: (S: any, cam: { x: number; y: number; z: number }, W: number, H: number, dpr: number, rot: number, era: number, T: number, kind: string) => void; dispose: () => void };

const COLS = 22, ROWS = 18, TW0 = 72, SPLOT = TW0 / Math.SQRT2;   // pixels per world unit (one plot = 1 unit)
const WX0 = (COLS + ROWS) * TW0 / 4, WY0 = TW0 * 1.5 + (COLS + ROWS) * TW0 / 8;   // the screen point of the grid centre, in unscaled world pixels (matches ptW)

const WINMATS: THREE.MeshStandardMaterial[] = [];
const winTex = (w: number, h: number, lit: number, seed: number) => {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d")!;
  x.fillStyle = "#dfe6ee"; x.fillRect(0, 0, 64, 128);
  let s = seed * 7919 + 13; const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const cols = Math.max(2, Math.round(w * 4)), rows = Math.max(2, Math.round(h * 5)), cw = 64 / cols, rh = 128 / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { x.fillStyle = r() < lit ? "#ffd88a" : "#27384f"; x.fillRect(i * cw + cw * 0.18, j * rh + rh * 0.2, cw * 0.64, rh * 0.6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
};

export function createColony3D(host: HTMLElement): Col3D | null {
  let ren: THREE.WebGLRenderer;
  try { ren = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" }); } catch (e) { return null; }
  if (!ren.getContext()) return null;
  ren.setClearColor(0x000000, 0); ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05;
  const el = ren.domElement; el.className = "ac2-cv3d"; el.setAttribute("aria-hidden", "true"); el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block"; host.appendChild(el);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 400);
  const el30 = Math.PI / 6, dist = 60; cam.position.set(dist * Math.cos(el30) / Math.SQRT2, dist * Math.sin(el30), dist * Math.cos(el30) / Math.SQRT2); cam.lookAt(0, 0, 0);
  try { const pm = new THREE.PMREMGenerator(ren); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; (scene as any).environmentIntensity = 0.55; pm.dispose(); } catch (e) {}   // soft reflections on glass and steel
  const rim = new THREE.DirectionalLight(0x9cc8ff, 0.7); rim.position.set(16, 9, -12); scene.add(rim);   // a cool rim light from the far side
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6a5a48, 0.85); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.3); sun.position.set(-14, 20, 8); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun); scene.add(sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.38 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const world = new THREE.Group(); scene.add(world);

  const mats: Record<string, THREE.Material> = {}; const mk = (key: string, f: () => THREE.Material) => mats[key] || (mats[key] = f());
  const std = (color: number, rough = 0.55, metal = 0.1, extra: any = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const white = () => mk("white", () => std(0xf2f4f7, 0.5, 0.15)), steel = () => mk("steel", () => std(0xb9c2cf, 0.35, 0.7)), dark = () => mk("dark", () => std(0x33414f, 0.6, 0.2));
  const rust = () => mk("rust", () => std(0xc2653a, 0.65, 0.1)), glass = () => mk("glass", () => new THREE.MeshPhysicalMaterial({ color: 0xaee4ff, roughness: 0.08, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.45, clearcoat: 1, side: THREE.DoubleSide }));
  const solar = () => mk("solar", () => std(0x1b3f86, 0.25, 0.6, { emissive: 0x0a1c44, emissiveIntensity: 0.35 })), green = () => mk("green", () => std(0x4fae5a, 0.8, 0)), glow = (c: number) => mk("glow" + c, () => new THREE.MeshBasicMaterial({ color: c }));
  const shadowed = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (w: number, h: number, d: number, mat: THREE.Material, y = 0, x = 0, z = 0) => { const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y + h / 2, z); return m; };
  const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, y = 0, x = 0, z = 0, seg = 20) => { const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)); m.position.set(x, y + h / 2, z); return m; };
  const dome = (r: number, mat: THREE.Material, y = 0, x = 0, z = 0) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.castShadow = false; m.position.set(x, y, z); return m; };
  const tower = (w: number, h: number, d: number, seed: number, era: number, y = 0, x = 0, z = 0) => {   // a block with lit windows on every side
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: winTex(w, h, era === 0 ? 0.35 : 0.55, seed), roughness: 0.4, metalness: 0.25, emissive: 0xffc870, emissiveMap: winTex(w, h, era === 0 ? 0.35 : 0.55, seed), emissiveIntensity: 0.12 });
    WINMATS.push(m); if (WINMATS.length > 400) WINMATS.splice(0, 100);
    const mesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); mesh.position.set(x, y + h / 2, z); return mesh;
  };

  function build(id: string, era: number, seed: number): THREE.Group {
    const g = new THREE.Group(), e = era;
    switch (id) {
      case "hab":
        if (e === 0) { g.add(box(0.62, 0.55, 0.5, white(), 0, -0.1, 0.05), box(0.46, 0.38, 0.4, white(), 0, 0.24, -0.12), dome(0.16, glass(), 0.55, -0.1, 0.05)); g.add(box(0.5, 0.05, 0.05, rust(), 0.3, -0.1, 0.31)); }
        else if (e === 1) { g.add(tower(0.62, 1.3, 0.5, seed, e), dome(0.26, glass(), 1.3), box(0.7, 0.06, 0.58, rust(), 0.65)); }
        else { const t = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 2.1, 24), new THREE.MeshPhysicalMaterial({ color: 0x9fd0f0, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.8, clearcoat: 1 }))); t.position.y = 1.05; g.add(t); for (let i = 1; i < 8; i++) { const r = cyl(0.34 - i * 0.017, 0.34 - i * 0.017, 0.02, white(), i * 0.26); g.add(r); } g.add(dome(0.2, glass(), 2.1)); }
        break;
      case "tower": g.add(tower(0.5, e === 0 ? 1.5 : e === 1 ? 2.1 : 2.8, 0.5, seed, e), box(0.56, 0.05, 0.56, rust(), 0.4), cyl(0.012, 0.012, 0.45, steel(), e === 0 ? 1.5 : e === 1 ? 2.1 : 2.8, 0.1, 0.1)); break;
      case "solar": { const n = e === 0 ? 3 : 4; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const p = box(0.36, 0.03, 0.32, solar(), 0.12, -0.38 + i * 0.4, -0.22 + j * 0.46); p.rotation.x = -0.45; g.add(p, cyl(0.012, 0.012, 0.14, steel(), 0, -0.38 + i * 0.4, -0.22 + j * 0.46 + 0.04)); } if (e >= 1) { g.add(cyl(0.02, 0.03, 1.1, white(), 0, 0.42, 0.3)); for (let k = 0; k < 3; k++) { const bl = box(0.03, 0.5, 0.01, white(), 1.1, 0.42, 0.3); bl.userData.blade = k; bl.rotation.z = k * 2.09; g.add(bl); } } break; }
      case "water": g.add(cyl(0.3, 0.3, 0.55, steel(), 0), dome(0.3, steel(), 0.55), cyl(0.05, 0.05, 0.4, dark(), 0, 0.42, 0.1), box(0.2, 0.2, 0.2, white(), 0, -0.3, 0.3)); break;
      case "oxy": g.add(dome(0.4, glass(), 0), cyl(0.12, 0.12, 0.5, white(), 0, 0, 0), cyl(0.05, 0.05, 0.7, steel(), 0, 0.3, 0.25), box(0.3, 0.2, 0.25, white(), 0, -0.3, 0.3)); break;
      case "farm": g.add(dome(0.46, glass(), 0), cyl(0.38, 0.38, 0.05, green(), 0)); for (let i = 0; i < 6; i++) g.add(cyl(0.025, 0.04, 0.2 + (i % 3) * 0.06, green(), 0.05, Math.cos(i) * 0.22, Math.sin(i) * 0.22)); break;
      case "mine": g.add(box(0.5, 0.3, 0.4, dark(), 0, -0.1, 0.1), box(0.06, 1.0, 0.06, rust(), 0, 0.15, -0.15), box(0.06, 1.0, 0.06, rust(), 0, 0.35, -0.15), box(0.34, 0.05, 0.05, rust(), 1.0, 0.25, -0.15), cyl(0.2, 0.2, 0.18, steel(), 0, -0.3, 0.3), box(0.08, 0.5, 0.08, white(), 0.3, 0.1, 0.35)); break;
      case "lab": g.add(tower(0.6, 0.5, 0.5, seed, e), dome(0.22, glass(), 0.5, -0.1, 0), cyl(0.012, 0.012, 0.5, steel(), 0.5, 0.2, 0), (() => { const d = dome(0.14, steel(), 0.95, 0.2, 0); d.rotation.x = -0.9; return d; })()); break;
      case "med": g.add(tower(0.6, 0.5, 0.5, seed, e), box(0.18, 0.04, 0.04, mk("red", () => std(0xe0433c)), 0.52, 0, 0.0), box(0.04, 0.18, 0.04, mk("red", () => std(0xe0433c)), 0.45, 0, 0)); break;
      case "reactor": g.add(cyl(0.26, 0.34, 0.9, steel(), 0), cyl(0.16, 0.16, 1.1, white(), 0, 0.25, 0.2), cyl(0.12, 0.12, 0.04, glow(0x00ffe0), 1.1, 0.25, 0.2), (() => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 28), glow(0x00ffe0)); r.rotation.x = Math.PI / 2; r.position.y = 0.55; return r; })()); break;
      case "port": g.add(cyl(0.46, 0.46, 0.05, dark(), 0), cyl(0.08, 0.1, 0.9, steel(), 0.05, 0, 0), (() => { const n = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 16), steel()); n.position.y = 1.05; n.castShadow = true; return n; })(), box(0.05, 1.1, 0.05, dark(), 0, 0.38, -0.3), box(0.2, 0.04, 0.04, rust(), 0.9, 0.3, -0.3)); break;
      case "park": g.add(cyl(0.44, 0.44, 0.04, mk("lawn", () => std(0x74c46e, 0.9)), 0)); for (let i = 0; i < 6; i++) { const a = i * 1.05, r = 0.2 + (i % 2) * 0.1; g.add(cyl(0.015, 0.02, 0.14, mk("trunk", () => std(0x6a4a2a)), 0.04, Math.cos(a) * r, Math.sin(a) * r)); const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 10), green()); c.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r); c.castShadow = true; g.add(c); } break;
      case "school": g.add(tower(0.6, 0.38, 0.46, seed, e), box(0.4, 0.2, 0.34, white(), 0.38, 0, 0), (() => { const r = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.16, 4), mk("roof", () => std(0xd9a23a))); r.position.y = 0.66; r.rotation.y = Math.PI / 4; r.castShadow = true; return r; })()); break;
      case "recycler": g.add(cyl(0.2, 0.2, 0.45, steel(), 0, -0.15, 0), cyl(0.2, 0.2, 0.45, steel(), 0, 0.2, 0.1), box(0.5, 0.08, 0.12, dark(), 0.45, 0.02, 0), cyl(0.04, 0.04, 0.5, dark(), 0.45, -0.3, -0.3)); break;
      case "market": g.add(tower(0.62, 0.42, 0.5, seed, e), box(0.7, 0.04, 0.58, mk("stripe", () => std(0xe0703a)), 0.42), box(0.24, 0.12, 0.04, mk("signm", () => std(0xffd24a, 0.4, 0, { emissive: 0xffa800, emissiveIntensity: 0.6 })), 0.5, 0, 0.27)); break;
      case "geo": g.add(cyl(0.22, 0.3, 0.5, rust(), 0), cyl(0.06, 0.06, 0.8, steel(), 0.3, 0.15, 0), cyl(0.04, 0.04, 0.6, steel(), 0.2, -0.25, 0.2)); break;
      case "shield": { const d = dome(0.62, new THREE.MeshPhysicalMaterial({ color: 0x9ccfff, transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide }), 0); g.add(d, cyl(0.1, 0.14, 0.5, steel(), 0), (() => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.02, 8, 36), glow(0x7fb8ff)); r.rotation.x = Math.PI / 2; r.position.y = 0.02; return r; })()); break; }
      default: g.add(box(0.5, 0.4, 0.5, white()));
    }
    return g;
  }

  const RING: Record<string, number> = { hab: 0x00e6ff, solar: 0x5a8cff, water: 0x46beff, oxy: 0x78ffbe, farm: 0x82ff6e, mine: 0xffaa3c, lab: 0xbe6eff, med: 0xffffff, reactor: 0x00ffe6, port: 0xff5ac8, park: 0x5aff78, school: 0xffe16e, recycler: 0x6efff0, market: 0xff966e, geo: 0xff783c, tower: 0xaaff8c, shield: 0x78aaff };
  const blobTex = () => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!; const g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, "rgba(0,0,0,.85)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); };
  const puffTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!; const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const withBase = (id: string, era: number, seed: number) => {
    const g = build(id, era, seed), w = new THREE.Group();
    const pad = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.05, 28), mk("pad", () => std(0xd8d2c8, 0.8, 0.05)))); pad.position.y = 0.0; w.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.018, 8, 40), glow(RING[id] || 0xffffff)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; w.add(ring);
    const ao = new THREE.Mesh(new THREE.CircleGeometry(0.78, 24), mk("aoMat", () => new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.55 }))); ao.rotation.x = -Math.PI / 2; ao.position.y = 0.012; w.add(ao);
    g.position.y = 0.05; w.add(g);
    if (id === "tower" || (id === "hab" && era >= 1) || id === "lab") { const top = id === "tower" ? (era === 0 ? 1.55 : era === 1 ? 2.15 : 2.85) : id === "hab" ? (era === 1 ? 1.6 : 2.3) : 0.95; const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); b.position.set(0.1, top + 0.4, 0.1); b.userData.beacon = seed; w.add(b); }
    if (era >= 2 && (id === "hab" || id === "tower" || id === "lab")) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xbfe9ff, emissive: 0x5ab4ff, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.5 })); c.position.y = 3.3; c.userData.float = seed; w.add(c); }
    if (id === "reactor") w.traverse((o: any) => { if (o.material && o.material.isMeshBasicMaterial) o.userData.pulse = 1; });
    return w;
  };
  // loose rocks, ice crystals and glowing ore on the empty plots (instanced; rebuilt when the grid changes)
  const RN = 420, rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.09, 0), std(0x8c8478, 0.95, 0), RN), ices = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.28, 5), new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, roughness: 0.08, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1 }), 300), ores = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0xff9a3a, emissive: 0xff6a10, emissiveIntensity: 1.1, roughness: 0.5 }), 300);
  rocks.castShadow = rocks.receiveShadow = true; ices.castShadow = true; world.add(rocks, ices, ores); let landSig = "";
  const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const steam: THREE.Sprite[] = []; for (let i = 0; i < 48; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; world.add(sp); steam.push(sp); }
  let emitters: { x: number; z: number; y: number; hot: boolean }[] = [];
  const drones: THREE.Mesh[] = []; for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x66d0ff, emissiveIntensity: 0.9 })); d.castShadow = true; d.visible = false; world.add(d); drones.push(d); }
  const placed = new Map<number, { key: string; g: THREE.Group }>();
  let curW = 0, curH = 0, curDpr = 0;
  const render: Col3D["render"] = (S, c, W, H, dpr, rot, era, T, kind) => {
    if (W !== curW || H !== curH || dpr !== curDpr) { curW = W; curH = H; curDpr = dpr; ren.setPixelRatio(dpr); ren.setSize(W, H, false); }
    const sc2 = SPLOT * c.z, px0 = c.x + c.z * WX0, py0 = c.y + c.z * WY0;
    cam.left = -px0 / sc2; cam.right = (W - px0) / sc2; cam.top = py0 / sc2; cam.bottom = -(H - py0) / sc2; cam.updateProjectionMatrix();
    world.rotation.y = -rot;
    // time of day: the sun slowly circles and dips; towers light up as it sets
    { const az = 0.6 + T * 0.025, el = 0.82 + 0.3 * Math.sin(T * 0.035), n = Math.max(0, Math.min(0.6, (0.66 - el) / 0.2)); sun.position.set(Math.cos(az) * Math.cos(el) * 26, Math.sin(el) * 26, Math.sin(az) * Math.cos(el) * 26); sun.intensity = 2.4 * (1 - 0.65 * n); hemi.intensity = 0.85 * (1 - 0.3 * n); rim.intensity = 0.7 + 0.5 * n; const ei = 0.12 + 1.0 * n; for (const m of WINMATS) m.emissiveIntensity = ei; (scene as any).environmentIntensity = 0.55 * (1 - 0.4 * n); }
    sun.color.set(kind === "proxima" ? 0xff9a80 : kind === "mars" ? 0xffd3a8 : 0xfff0d6);
    for (let i = 0; i < S.grid.length; i++) {
      const b = S.grid[i].b, cur = placed.get(i), key = b ? b + ":" + era : "";
      if (!b) { if (cur) { world.remove(cur.g); placed.delete(i); } continue; }
      if (cur && cur.key === key) continue;
      if (cur) world.remove(cur.g);
      const g = withBase(b, era, i); const cc = i % COLS, rr = Math.floor(i / COLS); g.position.set(cc + 0.5 - COLS / 2, 0, rr + 0.5 - ROWS / 2); world.add(g); placed.set(i, { key, g });
    }
    { let sig = ""; for (let i = 0; i < S.grid.length; i++) sig += S.grid[i].b ? "b" : S.grid[i].f ? S.grid[i].f[0] : "."; if (sig !== landSig) { landSig = sig; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3(); let nr = 0, ni = 0, no = 0;
      for (let i = 0; i < S.grid.length; i++) { const cell = S.grid[i]; if (cell.b) continue; const cc = i % COLS, rr = Math.floor(i / COLS), bx = cc + 0.5 - COLS / 2, bz = rr + 0.5 - ROWS / 2;
        if (cell.f === "ice") { for (let k = 0; k < 3 && ni < 300; k++) { q.setFromEuler(new THREE.Euler((hash(i + k) - 0.5) * 0.5, hash(i * 3 + k) * 6, (hash(i * 5 + k) - 0.5) * 0.5)); sc3.setScalar(0.7 + hash(i * 7 + k) * 0.9); m4.compose(new THREE.Vector3(bx + (hash(i * 11 + k) - 0.5) * 0.6, 0.12, bz + (hash(i * 13 + k) - 0.5) * 0.6), q, sc3); ices.setMatrixAt(ni++, m4); } }
        else if (cell.f === "ore") { for (let k = 0; k < 4 && no < 300; k++) { q.setFromEuler(new THREE.Euler(hash(i + k) * 3, hash(i * 3 + k) * 6, 0)); sc3.setScalar(0.6 + hash(i * 7 + k) * 0.8); m4.compose(new THREE.Vector3(bx + (hash(i * 11 + k) - 0.5) * 0.6, 0.05, bz + (hash(i * 13 + k) - 0.5) * 0.6), q, sc3); ores.setMatrixAt(no++, m4); } }
        else if (hash(i) < 0.5 && nr < RN) { const n = 1 + Math.floor(hash(i * 9) * 2); for (let k = 0; k < n && nr < RN; k++) { q.setFromEuler(new THREE.Euler(hash(i + k) * 3, hash(i * 3 + k) * 6, hash(i * 2 + k) * 3)); sc3.set(0.6 + hash(i * 7 + k) * 1.1, 0.5 + hash(i * 5 + k) * 0.7, 0.6 + hash(i * 17 + k)); m4.compose(new THREE.Vector3(bx + (hash(i * 11 + k) - 0.5) * 0.8, 0.04, bz + (hash(i * 13 + k) - 0.5) * 0.8), q, sc3); rocks.setMatrixAt(nr++, m4); } } }
      rocks.count = nr; ices.count = ni; ores.count = no; rocks.instanceMatrix.needsUpdate = ices.instanceMatrix.needsUpdate = ores.instanceMatrix.needsUpdate = true;
      emitters = []; placed.forEach((p, i) => { const id = String(S.grid[i].b); if (id === "reactor" || id === "geo" || id === "recycler" || id === "mine" || id === "water") emitters.push({ x: p.g.position.x, z: p.g.position.z, y: id === "reactor" ? 1.4 : id === "geo" ? 0.9 : 0.8, hot: id === "reactor" || id === "geo" }); } ); }
      steam.forEach((sp, k) => { const e = emitters.length ? emitters[k % emitters.length] : null; if (!e || era < 0) { sp.visible = false; return; } const ph = ((T * 0.35 + k * 0.173) % 1); sp.visible = true; sp.position.set(e.x + 0.12 + Math.sin(T + k) * 0.08 * ph, e.y + ph * 1.1, e.z + 0.08 + ph * 0.25); const sz = 0.16 + ph * 0.5; sp.scale.set(sz, sz, 1); (sp.material as THREE.SpriteMaterial).opacity = (1 - ph) * (e.hot ? 0.5 : 0.28); (sp.material as THREE.SpriteMaterial).color.set(e.hot ? 0xfff2e0 : 0xe8f4ff); }); }
    placed.forEach(p => p.g.traverse((o: any) => { const u = o.userData; if (!u) return; if (u.blade !== undefined) o.rotation.z = T * 1.4 + u.blade * 2.09; if (u.beacon !== undefined) o.visible = Math.sin(T * 3 + u.beacon) > 0.2; if (u.float !== undefined) { o.position.y = 3.3 + Math.sin(T * 1.2 + u.float) * 0.12; o.rotation.y = T; } }));
    const built: number[] = []; placed.forEach((_, i) => built.push(i));
    drones.forEach((d, k) => { if (built.length < 3 || era < 1) { d.visible = false; return; } const a = built[(k * 7) % built.length], b = built[(k * 7 + 3) % built.length], f = (Math.sin(T * 0.25 + k * 1.7) + 1) / 2, pa = placed.get(a)!.g.position, pb = placed.get(b)!.g.position; d.visible = true; d.position.set(pa.x + (pb.x - pa.x) * f, 1.6 + 0.2 * Math.sin(T * 2 + k), pa.z + (pb.z - pa.z) * f); d.rotation.y = T * 2; });
    ren.render(scene, cam);
  };
  return { render, dispose() { try { placed.forEach(p => world.remove(p.g)); ren.dispose(); if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {} } };
}
