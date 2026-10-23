/* The Space Ranch's crops, animals, houses, windmill and delivery rocket as real 3D (owner, 2026-10-17: "use three.js for the farm too, and make it prettier").
   Same idea as the colony: an orthographic three.js canvas over the cached 2D scenery (grass, fences, trees, barn, paths, pond), set so a tile lands where the
   2D iso projection `P(gx, gy)` puts it (2:1, 30 degrees), so every hit box, the pan and the zoom stay as they were. `createRanch3D` returns null without WebGL. */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Ranch3D = { el: HTMLCanvasElement; render: (S: any, cam: { x: number; y: number; z: number }, W: number, H: number, dpr: number, T: number, kind: string, geo: Geo) => void; dispose: () => void };
export type Geo = { OX: number; OY: number; TW: number; TH: number; VW: number; FX: number; FY: number; COLS: number; ANIMALS: any[]; wander: (i: number, T: number) => { gx: number; gy: number; face: number; hop: number }; MILL: { x: number; y: number }; PAD: { x: number; y: number } };

const SPL = 28 * Math.SQRT2;   // pixels per grid unit along a screen diagonal (TW * sqrt 2)
const CROP_COL: Record<string, number> = { carrot: 0xff8a2a, corn: 0xffd23a, tomato: 0xe8392e, pumpkin: 0xff7a14 };

export function createRanch3D(host: HTMLElement): Ranch3D | null {
  let ren: THREE.WebGLRenderer;
  try { ren = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" }); } catch (e) { return null; }
  if (!ren.getContext()) return null;
  ren.setClearColor(0x000000, 0); ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.1;
  const el = ren.domElement; el.className = "ar-cv3d"; el.setAttribute("aria-hidden", "true"); el.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:block"; host.appendChild(el);

  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 400), e30 = Math.PI / 6, dist = 60;
  cam.position.set(dist * Math.cos(e30) / Math.SQRT2, dist * Math.sin(e30), dist * Math.cos(e30) / Math.SQRT2); cam.lookAt(0, 0, 0);
  try { const pm = new THREE.PMREMGenerator(ren); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; (scene as any).environmentIntensity = 0.5; pm.dispose(); } catch (e) {}
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x7a6a50, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.4); sun.position.set(-12, 22, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 90; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.target.position.set(11, 0, 11); scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x9cc8ff, 0.5); rim.position.set(16, 9, -12); scene.add(rim);
  const world = new THREE.Group(); scene.add(world);

  const M: Record<string, THREE.Material> = {}, mk = (k: string, f: () => THREE.Material) => M[k] || (M[k] = f());
  const std = (c: number, r = 0.6, m = 0.05, ex: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ex });
  const lam = (c: number) => mk("c" + c, () => std(c, 0.65));
  const sh = <T extends THREE.Object3D>(o: T): T => { o.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  const sph = (r: number, c: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), lam(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
  const cyl = (rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lam(c)); m.position.set(x, y + h / 2, z); return m; };
  const cone = (r: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 12) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), lam(c)); m.position.set(x, y + h / 2, z); return m; };
  const box = (w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y + h / 2, z); return m; };


  /* ── the whole farm as 3D (owner, 2026-10-23: "rebuild the farm level with three.js, same content, in 3D"): meadow, lake, pond, paths, field beds, fences, pen, barn, silo, trees, props ── */
  let cloudGrp: THREE.Group | null = null;
  let built = false; const beds: THREE.Group[] = []; let groundMat: THREE.MeshStandardMaterial | null = null; const lilies: THREE.Mesh[] = []; let waterMat: THREE.MeshStandardMaterial | null = null;
  const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const grassTex = () => { const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d")!; g.fillStyle = "#6fc84a"; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 60; i++) { const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70, gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, rnd() > 0.5 ? "rgba(190,240,120,.35)" : "rgba(40,120,40,.3)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } const G = ["#3f9a36", "#58b744", "#8ad65a", "#b4ee7a"]; for (let i = 0; i < 2600; i++) { const x = rnd() * 512, y = rnd() * 512; g.strokeStyle = G[Math.floor(rnd() * 4)]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 5); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const fenceLine = (a: number[], b: number[], h = 0.5) => { const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.55)), g = new THREE.Group(), wood = 0xf6f1e6; for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n; g.add(box(0.09, h, 0.09, wood, x, 0, z)); }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]); for (const yy of [h * 0.35, h * 0.75]) { const r = box(len, 0.06, 0.05, wood, (a[0] + b[0]) / 2, yy, (a[1] + b[1]) / 2); r.rotation.y = -ang; g.add(r); } return sh(g); };
  const tree = (x: number, z: number, s: number, kind: number) => { const g = new THREE.Group(); if (kind === 0) { g.add(cyl(0.1 * s, 0.14 * s, 0.9 * s, 0x7a5230, 0, 0, 0, 8)); for (const [dx, dy, dz, r, c] of [[0, 1.2, 0, 0.7, 0x4caf3c], [0.35, 1.0, 0.1, 0.5, 0x5ec84a], [-0.3, 1.05, -0.15, 0.5, 0x3f9a36]] as number[][]) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), lam(c)); m.position.set(dx * s, dy * s, dz * s); g.add(m); } if (rnd() < 0.45) for (let k = 0; k < 5; k++) g.add(sph(0.06 * s, 0xe0302e, (rnd() - 0.5) * 1.0 * s, (0.9 + rnd() * 0.6) * s, (rnd() - 0.5) * 1.0 * s)); } else { g.add(cyl(0.08 * s, 0.1 * s, 0.5 * s, 0x6a4a2a, 0, 0, 0, 8)); for (let k = 0; k < 4; k++) g.add(cone((0.62 - k * 0.13) * s, 0.7 * s, k % 2 ? 0x2f7d3a : 0x3a9244, 0, (0.4 + k * 0.38) * s, 0, 9)); } g.position.set(x, 0, z); g.rotation.y = rnd() * 6; return sh(g); };
  function buildScenery(geo: Geo) {
    built = true; try { const cg2 = new THREE.Group(); const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false, depthWrite: false }); const dm2 = new THREE.MeshBasicMaterial({ color: 0x1a2a10, transparent: true, opacity: 0.16, depthWrite: false });
      for (let i = 0; i < 5; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.1 + k % 2 * 0.5, 10, 8), sm); b.position.set(k * 1.2, k % 2 * 0.3, 0); b.scale.y = 0.55; g.add(b); } g.position.set(0, 14 + i % 2 * 2, 4 + i * 6); g.userData.x0 = i * 14; const sh = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16), dm2); sh.rotation.x = -Math.PI / 2; sh.scale.set(1.8, 1, 0.9); sh.position.set(0, 0.05, 4 + i * 6); g.userData.sh = sh; world.add(sh); cg2.add(g); }
      world.add(cg2); cloudGrp = cg2; } catch (e) { cloudGrp = null; }
    const SP = geo.TW;
    const toG = (px: number, py: number) => { const u = (px - geo.OX) / geo.TW, v = (py - geo.OY) / geo.TH; return [(u + v) / 2, (v - u) / 2]; };
    // meadow
    groundMat = new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 0.95, metalness: 0 }); const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(13, -0.01, 13); ground.receiveShadow = true; world.add(ground);
    // a few soft light/dark meadow patches and flowers
    const FC = [0xff7ab8, 0xffffff, 0xffd23f, 0xb48cff, 0xff8a5a]; for (let i = 0; i < 160; i++) { const gx = -6 + rnd() * 44, gy = -6 + rnd() * 44, px = geo.OX + (gx - gy) * geo.TW, py = geo.OY + (gx + gy) * geo.TH; if (px < 30 || px > 1470 || py < 70 || py > 800) continue; const f = new THREE.Group(); f.add(cyl(0.012, 0.012, 0.16, 0x3a8a2a, 0, 0, 0, 4), sph(0.045, FC[i % 5], 0, 0.18, 0)); f.position.set(gx, 0, gy); world.add(f); }
    // lake (right edge) with a sand shore, and a small pond by the rocket pad
    const water = (cx: number, cz: number, rx: number, rz: number, rot: number, sandR = 1.18) => { const sand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 36), lam(0xe8d49a)); sand.scale.set(rx * sandR, 1, rz * sandR); sand.position.set(cx, 0.01, cz); sand.rotation.y = rot; sand.receiveShadow = true; const w = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 36), waterMat || (waterMat = new THREE.MeshStandardMaterial({ color: 0x3aa6e0, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.92, emissive: 0x0a3a66, emissiveIntensity: 0.25 }))); w.scale.set(rx, 1, rz); w.position.set(cx, 0.035, cz); w.rotation.y = rot; world.add(sand, w); for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 14), lam(0x4cb04a)); l.position.set(cx + (rnd() - 0.5) * rx * 1.3, 0.07, cz + (rnd() - 0.5) * rz * 1.3); world.add(l); lilies.push(l); const fl = sph(0.07, 0xff9ac8, l.position.x, 0.1, l.position.z); world.add(fl); } for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; world.add(cyl(0.012, 0.012, 0.5 + rnd() * 0.3, 0x5a8a2a, cx + Math.cos(a) * rx * 1.02, 0, cz + Math.sin(a) * rz * 1.02, 4)); } };
    water(21, -1.5, 6.2, 3.4, 0.5); water(21, 15.6, 2.4, 1.6, 0.3);
    // stone path
    const tiles: number[][] = []; for (let gx = 1; gx <= 22; gx++) tiles.push([gx, 2]); for (let gy = 3; gy <= 12; gy++) tiles.push([4, gy]); for (let gx = 5; gx <= 17; gx++) tiles.push([gx, 12]); for (let gy = 13; gy <= 16; gy++) tiles.push([17, gy]);
    const st = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.06, 0.92), std(0xc9c1b0, 0.85), tiles.length); const dm = new THREE.Object3D(), col = new THREE.Color(); tiles.forEach(([gx, gy], i) => { dm.position.set(gx + 0.5, 0.03, gy + 0.5); dm.rotation.y = (rnd() - 0.5) * 0.06; dm.updateMatrix(); st.setMatrixAt(i, dm.matrix); st.setColorAt(i, col.setHex([0xcfc7b4, 0xbdb5a4, 0xd8d0be][i % 3])); }); st.receiveShadow = true; world.add(st);
    // field beds: dug plots are soil with a plank border, the rest stay meadow until dug
    for (let i = 0; i < geo.COLS * 4; i++) { const c0 = geo.FX + (i % geo.COLS) * 2, r0 = geo.FY + Math.floor(i / geo.COLS) * 2, g = new THREE.Group(); g.add(box(1.96, 0.1, 1.96, 0xb8864a, c0 + 1, 0, r0 + 1), box(1.78, 0.14, 1.78, 0x7a4a26, c0 + 1, 0, r0 + 1)); for (let k = 0; k < 4; k++) g.add(box(1.7, 0.03, 0.04, 0x4a2a14, c0 + 1, 0.14, r0 + 0.3 + k * 0.45)); g.traverse((m: any) => { if (m.isMesh) m.receiveShadow = true; }); world.add(g); beds.push(g); }
    // fences: field, pen
    const F = geo.FX, Y = geo.FY, CW = geo.COLS * 2, RW = 4 * 2; for (const [a, b] of [[[F - 0.6, Y - 0.6], [F + CW + 0.6, Y - 0.6]], [[F - 0.6, Y - 0.6], [F - 0.6, Y + RW + 0.6]], [[F + CW + 0.6, Y - 0.6], [F + CW + 0.6, Y + RW + 0.6]], [[F - 0.6, Y + RW + 0.6], [F + CW + 0.6, Y + RW + 0.6]], [[0, 13], [13, 13]], [[0, 13], [0, 22]], [[0, 22], [13, 22]], [[13, 13], [13, 22]]] as number[][][]) world.add(fenceLine(a, b));
    // pen floor and straw, trough
    world.add(box(13, 0.04, 9, 0xefd98a, 6.5, 0, 17.5)); for (let i = 0; i < 40; i++) { const s = box(0.4, 0.02, 0.05, i % 2 ? 0xe8c24a : 0xc99a2e, 0.5 + rnd() * 12, 0.04, 13.5 + rnd() * 8); s.rotation.y = rnd() * 3; world.add(s); } world.add(sh(box(1.4, 0.3, 0.45, 0x8a5a30, 6.2, 0, 17.4)), box(1.2, 0.04, 0.3, 0x4aa8e0, 6.2, 0.3, 17.4));
    // barn (gx 2..5, gy 0..2), silo, hay, crates
    { const g = new THREE.Group(); g.add(box(3, 1.5, 2, 0xd8482a, 3.5, 0, 1)); const shp = new THREE.Shape(); shp.moveTo(-1.65, 0); shp.lineTo(1.65, 0); shp.lineTo(1.2, 0.8); shp.lineTo(-1.2, 0.8); shp.closePath(); const rg = new THREE.ExtrudeGeometry(shp, { depth: 2.3, bevelEnabled: false }); const roof = new THREE.Mesh(rg, lam(0x8a3a24)); roof.position.set(3.5, 1.5, -0.15); g.add(roof); g.add(box(1.0, 1.1, 0.06, 0x7a2a14, 3.5, 0, 2.02), box(0.9, 0.06, 0.06, 0xfff4dc, 3.5, 0.55, 2.06), box(0.5, 0.4, 0.06, 0xfff4dc, 3.5, 1.7, 2.02)); for (const sx of [3.0, 4.0]) g.add(box(0.06, 1.1, 0.07, 0xfff4dc, sx, 0, 2.05)); g.add(box(3.08, 0.08, 0.08, 0xfff4dc, 3.5, 1.46, 2.02)); world.add(sh(g)); }
    { const g = new THREE.Group(), steel = std(0xe4ebf2, 0.35, 0.5); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 20), steel); b.position.y = 1.3; const d = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 10, 0, 6.28, 0, 1.57), std(0xc9d6e2, 0.4, 0.5)); d.position.y = 2.6; g.add(b, d); g.position.set(1.0, 0, 0.8); world.add(sh(g)); }
    for (const [hx, hz] of [[5.4, 1.2], [5.9, 1.9], [5.5, 2.4]]) { const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 16), lam(0xe8c94a)); hb.rotation.z = Math.PI / 2; hb.position.set(hx, 0.34, hz); hb.rotation.y = hx; world.add(sh(hb)); }
    for (const [bx, bz] of [[6.3, 0.4], [6.9, 1.0]]) { world.add(sh(cyl(0.22, 0.22, 0.5, 0x6a8ab0, bx, 0, bz, 14))); } world.add(sh(box(0.7, 0.55, 0.7, 0xd8aa6a, 7.8, 0, 0.6)));
    // scarecrow, well, sunflowers, flower beds, sign
    { const g = new THREE.Group(); g.add(cyl(0.03, 0.03, 1.2, 0x7a5230, 0, 0, 0, 6)); const arm = box(1.0, 0.05, 0.05, 0x7a5230, 0, 0.85, 0); g.add(arm, sph(0.17, 0xe8c070, 0, 1.28, 0), cone(0.28, 0.2, 0xb0482e, 0, 1.38, 0), box(0.36, 0.45, 0.2, 0x4a7ac0, 0, 0.45, 0)); g.position.set(4.8, 0, 5.2); world.add(sh(g)); }
    { const g = new THREE.Group(); g.add(cyl(0.5, 0.5, 0.55, 0xb9b2a6, 0, 0, 0, 16), cyl(0.38, 0.38, 0.02, 0x2a8ad0, 0, 0.52, 0, 16), box(0.06, 1.0, 0.06, 0x7a5230, -0.45, 0, 0), box(0.06, 1.0, 0.06, 0x7a5230, 0.45, 0, 0), box(1.2, 0.08, 0.7, 0xb0482e, 0, 1.0, 0)); g.position.set(5.4, 0, 12.9); world.add(sh(g)); }
    for (let k = 0; k < 9; k++) { const g = new THREE.Group(); g.add(cyl(0.02, 0.025, 0.6 + (k % 3) * 0.05, 0x3a8a2a, 0, 0, 0, 5)); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), lam(0xffc81e)); f.rotation.x = Math.PI / 2.3; f.position.set(0, 0.65, 0.05); g.add(f, sph(0.07, 0x5a3010, 0, 0.65, 0.09)); g.position.set(0.4 + k * 0.55, 0, 3.1); world.add(g); }
    for (const [fx, fz] of [[3.2, 2.9], [3.2, 4.2], [20, 12.6], [14.2, 13.2], [-0.4, 12.4]]) for (let k = 0; k < 9; k++) world.add(sph(0.06, FC[k % 5], fx + (rnd() - 0.5) * 1.0, 0.1, fz + (rnd() - 0.5) * 0.6));
    // rocket pad base
    { const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.1, 28), lam(0xb8bcc4)); pad.position.set(geo.PAD ? toG(geo.PAD.x, geo.PAD.y)[0] : 17, 0.05, geo.PAD ? toG(geo.PAD.x, geo.PAD.y)[1] : 17); pad.receiveShadow = true; world.add(pad); }
    // trees: seeded, kept off the barn, field, pen, path, pad and water
    const bad = (gx: number, gy: number) => (gx > -1 && gx < 8 && gy > -1 && gy < 4) || (gx > 3.5 && gx < 19.5 && gy > 1 && gy < 13.5) || (gx > -1.5 && gx < 14 && gy > 11.5 && gy < 23) || (Math.hypot(gx - 17, gy - 17) < 4) || (Math.hypot(gx - 21, gy - 15.6) < 4) || (Math.hypot((gx - 21) / 8, (gy + 1.5) / 5) < 1) || (Math.hypot(gx - 21, gy - 1) < 3);
    let n = 0, tr = 0; while (n < 46 && tr++ < 1500) { const gx = -8 + rnd() * 48, gy = -8 + rnd() * 48, px = geo.OX + (gx - gy) * geo.TW, py = geo.OY + (gx + gy) * geo.TH; if (px < 40 || px > 1460 || py < 80 || py > 800 || bad(gx, gy)) continue; world.add(tree(gx, gy, 0.9 + rnd() * 0.7, rnd() < 0.3 ? 1 : 0)); n++; }
    void SP;
  }

  /* ── crops: one plant, three stages (the group is scaled by progress each frame) ── */
  function plant(id: string): THREE.Group {
    const g = new THREE.Group(), leaf = 0x4fae4a;
    if (id === "carrot") { g.add(cone(0.05, 0.16, 0xff8a2a, 0, 0, 0), cone(0.03, 0.12, leaf, 0.02, 0.16, 0), cone(0.03, 0.12, leaf, -0.03, 0.16, 0.02)); (g.children[0] as THREE.Mesh).rotation.x = Math.PI; g.children[0].position.y = 0.1; }
    else if (id === "corn") { g.add(cyl(0.018, 0.024, 0.46, leaf, 0, 0, 0), cone(0.09, 0.2, leaf, 0.07, 0.18, 0), cone(0.09, 0.2, leaf, -0.07, 0.24, 0), sph(0.045, 0xffd23a, 0.03, 0.3, 0.03, 0.8, 1.7, 0.8)); }
    else if (id === "tomato") { g.add(sph(0.12, leaf, 0, 0.12, 0, 1, 0.8, 1), sph(0.045, 0xe8392e, 0.08, 0.1, 0.06), sph(0.04, 0xe8392e, -0.07, 0.15, 0.04), sph(0.04, 0xe8392e, 0.01, 0.06, -0.09)); }
    else { g.add(sph(0.14, 0xff7a14, 0, 0.1, 0, 1, 0.75, 1), cyl(0.014, 0.018, 0.07, 0x4a7a2a, 0, 0.2, 0), cone(0.07, 0.06, leaf, 0.1, 0.1, 0.05)); }
    return sh(g);
  }

  /* ── animals ── */
  function animal(id: string): THREE.Group {
    const g = new THREE.Group(), legs: THREE.Mesh[] = [], L = id === "cow" ? 1.1 : id === "pig" ? 0.78 : id === "sheep" ? 0.8 : 0.42, u = L;   // u = body length in grid units
    if (id === "cow") {
      g.add(sph(0.3 * u, 0xf6f2ec, 0, 0.5 * u, 0, 1.45, 0.82, 0.8), sph(0.17 * u, 0xf6f2ec, 0.42 * u, 0.62 * u, 0), sph(0.2 * u, 0x2a2420, -0.1 * u, 0.62 * u, 0.12, 1, 0.6, 0.3), sph(0.15 * u, 0x2a2420, 0.15 * u, 0.5 * u, -0.2 * u, 1, 0.6, 0.3), sph(0.1 * u, 0xf0a0a0, 0.55 * u, 0.58 * u, 0, 0.8, 0.7, 1), cone(0.04 * u, 0.14 * u, 0xf4e8c8, 0.4 * u, 0.74 * u, 0.1 * u), cone(0.04 * u, 0.14 * u, 0xf4e8c8, 0.4 * u, 0.74 * u, -0.1 * u));
      for (const [lx, lz] of [[0.25, 0.14], [0.25, -0.14], [-0.25, 0.14], [-0.25, -0.14]]) { const l = cyl(0.045 * u, 0.04 * u, 0.3 * u, 0xece6dc, lx * u, 0, lz * u, 8); l.userData.bx = lx * u; legs.push(l); g.add(l); }
      g.add(sph(0.045 * u, 0xe0b040, 0.3 * u, 0.42 * u, 0.0)); g.add(cyl(0.012 * u, 0.012 * u, 0.2 * u, 0x2a2420, -0.42 * u, 0.3 * u, 0, 6));
    } else if (id === "pig") {
      g.add(sph(0.3 * u, 0xf4b0b8, 0, 0.36 * u, 0, 1.3, 0.85, 0.85), sph(0.17 * u, 0xf4b0b8, 0.38 * u, 0.4 * u, 0), cyl(0.07 * u, 0.07 * u, 0.06 * u, 0xe88a98, 0.54 * u, 0.34 * u, 0, 12), cone(0.05 * u, 0.1 * u, 0xe88a98, 0.34 * u, 0.55 * u, 0.1 * u), cone(0.05 * u, 0.1 * u, 0xe88a98, 0.34 * u, 0.55 * u, -0.1 * u));
      (g.children[2] as THREE.Mesh).rotation.z = Math.PI / 2;
      for (const [lx, lz] of [[0.2, 0.12], [0.2, -0.12], [-0.2, 0.12], [-0.2, -0.12]]) { const l = cyl(0.04 * u, 0.04 * u, 0.2 * u, 0xe898a2, lx * u, 0, lz * u, 8); l.userData.bx = lx * u; legs.push(l); g.add(l); }
    } else if (id === "sheep") {
      for (let i = 0; i < 9; i++) { const a = i * 1.3; g.add(sph(0.17 * u, 0xf7f2e6, Math.cos(a) * 0.2 * u, 0.42 * u + (i % 3) * 0.05 * u, Math.sin(a) * 0.14 * u)); }
      g.add(sph(0.2 * u, 0xf7f2e6, 0, 0.5 * u, 0), sph(0.12 * u, 0x3a302a, 0.36 * u, 0.5 * u, 0, 1, 1.1, 0.9));
      for (const [lx, lz] of [[0.18, 0.1], [0.18, -0.1], [-0.18, 0.1], [-0.18, -0.1]]) { const l = cyl(0.025 * u, 0.025 * u, 0.22 * u, 0x3a302a, lx * u, 0, lz * u, 6); l.userData.bx = lx * u; legs.push(l); g.add(l); }
    } else {
      g.add(sph(0.3 * u, 0xfdfbf4, 0, 0.42 * u, 0, 1.1, 1, 0.9), sph(0.17 * u, 0xfdfbf4, 0.34 * u, 0.7 * u, 0), cone(0.07 * u, 0.2 * u, 0xffb020, 0.52 * u, 0.7 * u - 0.1 * u, 0, 8), sph(0.06 * u, 0xe0302e, 0.32 * u, 0.9 * u, 0, 0.7, 1.1, 0.4), sph(0.14 * u, 0xece4d4, 0, 0.44 * u, 0.2 * u, 1.2, 0.8, 0.3), sph(0.2 * u, 0xfdfbf4, -0.34 * u, 0.62 * u, 0, 0.5, 1, 0.8));
      (g.children[2] as THREE.Mesh).rotation.z = -Math.PI / 2;
      g.add(cyl(0.012 * u, 0.012 * u, 0.2 * u, 0xe8a020, 0.04 * u, 0, 0.05 * u, 5), cyl(0.012 * u, 0.012 * u, 0.2 * u, 0xe8a020, 0.04 * u, 0, -0.05 * u, 5));
    }
    const eye = (z: number) => sph(0.022 * u, 0x120a06, id === "chicken" ? 0.44 * u : id === "sheep" ? 0.46 * u : 0.52 * u, id === "chicken" ? 0.74 * u : id === "sheep" ? 0.55 * u : id === "cow" ? 0.68 * u : 0.46 * u, z * u); g.add(eye(0.07), eye(-0.07));
    g.userData.legs = legs; g.userData.u = u;
    return sh(g);
  }

  /* ── houses: walls, a gable roof, a door; `b` raises it ── */
  const HCOL: Record<string, [number, number]> = { cow: [0xf08a3a, 0xc85a1e], chicken: [0x9ad4f6, 0x6aaee0], pig: [0xc99a64, 0x946a3c], sheep: [0xf0e4c8, 0xe0be5a] };
  function house(id: string): THREE.Group {
    const g = new THREE.Group(), [wall, roof] = HCOL[id] || HCOL.cow, w = 1.3, h = 0.78;
    g.add(box(w, h, w, wall, 0, 0, 0));
    const shape = new THREE.Shape(); shape.moveTo(-w / 2 - 0.08, 0); shape.lineTo(w / 2 + 0.08, 0); shape.lineTo(0, 0.5); shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: w + 0.16, bevelEnabled: false }); const r = new THREE.Mesh(rg, lam(roof)); r.position.set(0, h, -(w + 0.16) / 2); g.add(r);
    g.add(box(0.34, 0.5, 0.04, 0x3a2216, 0, 0, w / 2 + 0.01), box(0.26, 0.26, 0.04, 0xcfeaff, 0.4, 0.3, w / 2 + 0.01), box(0.26, 0.26, 0.04, 0xcfeaff, -0.4, 0.3, w / 2 + 0.01));
    return sh(g);
  }

  /* ── windmill and rocket ── */
  const mill = new THREE.Group(); { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 2.0, 16), lam(0xf0e2c4)); t.position.y = 1.0; mill.add(t, cone(0.46, 0.5, 0xb0482e, 0, 2.0)); const hub = new THREE.Group(); hub.position.set(0, 1.9, 0.5); for (let k = 0; k < 4; k++) { const b = box(0.16, 1.2, 0.04, k % 2 ? 0xffffff : 0xffc45a, 0, 0, 0); b.position.y = 0.65; const pv = new THREE.Group(); pv.rotation.z = k * Math.PI / 2; pv.add(b); hub.add(pv); } hub.add(sph(0.1, 0x6a4a2a)); hub.userData.hub = 1; mill.add(hub); sh(mill); }
  const rocket = new THREE.Group(); { const steel = mk("steel", () => std(0xdde3ec, 0.3, 0.8)); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 20), steel); b.position.y = 0.75; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.6, 20), steel); s.position.y = 2.3; const nose = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 20), steel); nose.position.y = 3.35; const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 20), lam(0x1c2026)); ring.position.y = 1.52; rocket.add(b, s, nose, ring); for (const sd of [-1, 1]) { rocket.add(box(0.04, 0.34, 0.22, 0x2a2f37, 1.0, 0.24 * sd, 0), box(0.04, 0.4, 0.26, 0x2a2f37, 2.0, 0.26 * sd, 0)); } sh(rocket); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.4, 14), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.9 })); fl.rotation.x = Math.PI; fl.position.y = -0.7; fl.visible = false; fl.userData.flame = 1; rocket.add(fl); }
  world.add(mill, rocket);

  // fireflies / pollen drifting over the farm (High only; built once)
  const PN = 90, pg = new THREE.BufferGeometry(), ppos = new Float32Array(PN * 3), pseed = new Float32Array(PN); for (let i = 0; i < PN; i++) { ppos[i * 3] = 2 + Math.random() * 20; ppos[i * 3 + 1] = 0.3 + Math.random() * 1.6; ppos[i * 3 + 2] = 2 + Math.random() * 20; pseed[i] = Math.random() * 6.28; }
  pg.setAttribute("position", new THREE.BufferAttribute(ppos, 3)); const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff0a0, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); world.add(pts);
  const sparkles: THREE.Mesh[] = []; for (let i = 0; i < 24; i++) { const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0xfff6a8 })); sp.visible = false; world.add(sp); sparkles.push(sp); }
  // dust puffs behind walking animals and a burst when something is planted (sprites from a small pool)
  const puffTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!; const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const fx: { sp: THREE.Sprite; life: number; max: number; vx: number; vy: number; vz: number; s0: number; o: number }[] = []; for (let i = 0; i < 40; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; world.add(sp); fx.push({ sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0.2, o: 0.4 }); }
  const puff = (x: number, y: number, z: number, col: number, o = 0.4, s0 = 0.18, up = 0.25, spread = 0.2) => { const f = fx.find(q => q.life <= 0); if (!f) return; f.life = f.max = 0.7 + Math.random() * 0.6; f.vx = (Math.random() - 0.5) * spread; f.vz = (Math.random() - 0.5) * spread; f.vy = up * (0.6 + Math.random() * 0.8); f.s0 = s0; f.o = o; f.sp.position.set(x, y, z); (f.sp.material as THREE.SpriteMaterial).color.set(col); f.sp.visible = true; };
  let lastT = 0, dustAcc = 0;
  const plants = new Map<number, { key: string; g: THREE.Group[]; root: THREE.Group }>(), houses: (THREE.Group | null)[] = [], animals: (THREE.Group | null)[] = [];
  let cw = 0, ch = 0, cd = 0;
  const render: Ranch3D["render"] = (S, c, W, H, dpr, T, kind, geo) => {
    const dt = Math.min(0.1, Math.max(0, T - lastT)); lastT = T; dustAcc += dt;
    { const az = 0.9 + T * 0.02, el = 0.9 + 0.25 * Math.sin(T * 0.03); sun.position.set(11 + Math.cos(az) * Math.cos(el) * 24, Math.sin(el) * 24, 11 + Math.sin(az) * Math.cos(el) * 24); sun.target.position.set(11, 0, 11); sun.intensity = 2.4 * (0.75 + 0.25 * Math.sin(el)); }
    fx.forEach(f => { if (f.life <= 0) return; f.life -= dt; const k = 1 - f.life / f.max; f.sp.position.x += f.vx * dt; f.sp.position.y += f.vy * dt; f.sp.position.z += f.vz * dt; const sz = f.s0 * (1 + k * 2.2); f.sp.scale.set(sz, sz, 1); (f.sp.material as THREE.SpriteMaterial).opacity = f.o * (1 - k); if (f.life <= 0) f.sp.visible = false; });
    const HQ = true;   // this layer only runs in High; Lite is the 2D drawing
    if (!built) { buildScenery(geo); if (groundMat) { const tint: any = { moon: 0xffffff, mars: 0xffc8a0, titan: 0xf0d890, proxima: 0xffa8a0 }; groundMat.color.setHex(tint[kind] || 0xffffff); } }
    S.plots.forEach((cell: any, i: number) => { if (beds[i]) beds[i].visible = !cell.locked; });
    // plan 40 F: drifting clouds with their shadows on the meadow, and a lake that shimmers (High only, this whole layer is High)
    if (cloudGrp) { cloudGrp.children.forEach((cg: any, i: number) => { const sp = 0.25 + (i % 3) * 0.12; const x0 = ((cg.userData.x0 + T * sp) % 70) - 18; cg.position.x = x0; cg.userData.sh.position.x = x0 + 4; }); }
    if (waterMat) { waterMat.roughness = 0.06 + 0.04 * Math.sin(T * 0.9); waterMat.metalness = 0.35 + 0.1 * Math.sin(T * 1.7); }
    if (waterMat) waterMat.emissiveIntensity = 0.22 + Math.sin(T * 1.4) * 0.06; lilies.forEach((l, k) => { l.position.y = 0.07 + Math.sin(T * 1.2 + k) * 0.006; });
    if (W !== cw || H !== ch || dpr !== cd) { cw = W; ch = H; cd = dpr; ren.setPixelRatio(dpr); ren.setSize(W, H, false); }
    const kk = W / geo.VW, sc2 = SPL * kk * c.z, px0 = (geo.OX - c.x) * kk * c.z, py0 = (geo.OY - c.y) * kk * c.z;
    cam.left = -px0 / sc2; cam.right = (W - px0) / sc2; cam.top = py0 / sc2; cam.bottom = -(H - py0) / sc2; cam.updateProjectionMatrix();
    sun.color.set(kind === "proxima" ? 0xff9a80 : kind === "mars" ? 0xffd3a8 : 0xfff1d8);
    const gp = (px: number, py: number) => { const u = (px - geo.OX) / geo.TW, v = (py - geo.OY) / geo.TH; return [(u + v) / 2, (v - u) / 2]; };
    // crops: 4 x 4 plants per plot
    S.plots.forEach((cell: any, i: number) => {
      const cur = plants.get(i), id = cell.crop || "", key = id;
      if (!id) { if (cur) { world.remove(cur.root); plants.delete(i); } return; }
      if (!cur || cur.key !== key) {
        if (cur) world.remove(cur.root);
        const root = new THREE.Group(), list: THREE.Group[] = [], c0 = geo.FX + (i % geo.COLS) * 2, r0 = geo.FY + Math.floor(i / geo.COLS) * 2;
        for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) { const p = plant(id); p.position.set(c0 + 0.3 + u * 0.47 + 0.1, 0, r0 + 0.3 + v * 0.47 + 0.1); p.rotation.y = (u * 7 + v * 3 + i) * 0.9; root.add(p); list.push(p); }
        world.add(root); plants.set(i, { key, g: list, root }); for (let k = 0; k < 8; k++) puff(c0 + 0.2 + Math.random() * 1.6, 0.1, r0 + 0.2 + Math.random() * 1.6, 0x8a5a30, 0.55, 0.16, 0.6, 0.5);
      }
      const pl = plants.get(i)!, grow = 0.28 + 0.72 * Math.min(1, cell.p / 100), ripe = cell.p >= 100;
      pl.g.forEach((p, k) => { p.rotation.z = Math.sin(T * 1.6 + k * 0.5 + i) * 0.05 * grow; const bob = ripe ? Math.abs(Math.sin(T * 5 + i + k * 0.4)) * 0.03 : 0; p.scale.setScalar(grow * (id === "corn" ? 1.1 : 1)); p.position.y = bob; });
    });
    // houses (a foundation is drawn in 2D until the build starts) and animals
    geo.ANIMALS.forEach((a: any, i: number) => {
      const Hs = S.houses[i], id = a.id;
      if (Hs.b > 0) { if (!houses[i]) { const h = house(id); const u = (a.x - geo.OX) / geo.TW, v = (a.y - 1.4 * geo.TH - geo.OY) / geo.TH; h.position.set((u + v) / 2 + 0.7, 0, (v - u) / 2 + 0.7); world.add(h); houses[i] = h; } houses[i]!.scale.set(1, Math.max(0.02, Math.min(1, Hs.b)), 1); }
      if (Hs.own) {
        if (!animals[i]) { const an = animal(id); world.add(an); animals[i] = an; }
        const w = geo.wander(i, T), an = animals[i]!, A = S.animals[i];
        const legs: THREE.Mesh[] = an.userData.legs || [], u = an.userData.u || 1; legs.forEach((l, k) => { l.position.x = l.userData.bx + Math.sin(T * 5 + i + (k % 2 ? Math.PI : 0)) * 0.05 * u; });
        if (dustAcc > 0.35 && id !== "chicken") puff(w.gx - 0.15 * w.face, 0.05, w.gy + 0.15 * w.face, 0xcdb78a, 0.3, 0.12, 0.2, 0.15);
        an.position.set(w.gx, w.hop * 0.4, w.gy); an.rotation.y = Math.PI / 4 + (w.face > 0 ? 0 : Math.PI); an.rotation.z = Math.sin(T * 2 + i) * 0.02;
        const br = 1 + Math.sin(T * 2 + i) * 0.015, gz = id === "chicken" ? Math.max(0, Math.sin(T * 3 + i)) * 0.35 : 0; an.scale.set(br, br, br); an.children.forEach((o: any) => { if (id === "chicken" && o.position && o.position.y > 0.2 && o.userData.head === undefined) { /* the pecking head is the whole group tilt */ } }); an.rotation.x = gz * 0.15; void A;
      }
    });
    // windmill and rocket
    const m = gp(geo.MILL.x, geo.MILL.y); mill.position.set(m[0], 0, m[1]); mill.children.forEach((o: any) => { if (o.userData.hub) o.rotation.z = T * 0.8; });
    const p = gp(geo.PAD.x, geo.PAD.y), lift = S.launch > 0 ? Math.pow(1 - S.launch / 2, 2) * 520 / (0.866 * SPL) : 0; rocket.position.set(p[0], 0.05 + lift, p[1]); rocket.children.forEach((o: any) => { if (o.userData.flame) { o.visible = S.launch > 0; o.scale.y = 1 + 0.2 * Math.sin(T * 38); } });
    if (HQ) { const a = pg.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < PN; i++) { a.setY(i, 0.5 + 0.7 * (Math.sin(T * 0.6 + pseed[i]) + 1) * 0.5 + 0.3); a.setX(i, a.getX(i) + Math.sin(T * 0.3 + pseed[i]) * 0.002); } a.needsUpdate = true; (pts.material as THREE.PointsMaterial).opacity = 0.55 + 0.35 * Math.sin(T * 2); }
    let sk = 0; S.plots.forEach((cell: any, i: number) => { if (cell.crop && cell.p >= 100 && sk < sparkles.length) { const c0 = geo.FX + (i % geo.COLS) * 2 + 1, r0 = geo.FY + Math.floor(i / geo.COLS) * 2 + 1, sp = sparkles[sk++]; sp.visible = true; sp.position.set(c0 + Math.sin(T * 2 + i) * 0.4, 0.5 + Math.abs(Math.sin(T * 3 + i)) * 0.3, r0 + Math.cos(T * 2 + i) * 0.4); sp.rotation.y = T * 3; } }); for (; sk < sparkles.length; sk++) sparkles[sk].visible = false;
    if (dustAcc > 0.35) dustAcc = 0;
    ren.render(scene, cam);
  };
  return { el, render, dispose() { try { ren.dispose(); if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {} } };
}
