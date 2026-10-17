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
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 90; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.target.position.set(11, 0, 11); scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x9cc8ff, 0.5); rim.position.set(16, 9, -12); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.32 })); ground.rotation.x = -Math.PI / 2; ground.position.set(12, 0, 12); ground.receiveShadow = true; scene.add(ground);
  const world = new THREE.Group(); scene.add(world);

  const M: Record<string, THREE.Material> = {}, mk = (k: string, f: () => THREE.Material) => M[k] || (M[k] = f());
  const std = (c: number, r = 0.6, m = 0.05, ex: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ex });
  const lam = (c: number) => mk("c" + c, () => std(c, 0.65));
  const sh = <T extends THREE.Object3D>(o: T): T => { o.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  const sph = (r: number, c: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), lam(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
  const cyl = (rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lam(c)); m.position.set(x, y + h / 2, z); return m; };
  const cone = (r: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 12) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), lam(c)); m.position.set(x, y + h / 2, z); return m; };
  const box = (w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y + h / 2, z); return m; };

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
  const plants = new Map<number, { key: string; g: THREE.Group[]; root: THREE.Group }>(), houses: (THREE.Group | null)[] = [], animals: (THREE.Group | null)[] = [];
  let cw = 0, ch = 0, cd = 0;
  const render: Ranch3D["render"] = (S, c, W, H, dpr, T, kind, geo) => {
    const HQ = true;   // this layer only runs in High; Lite is the 2D drawing
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
        world.add(root); plants.set(i, { key, g: list, root });
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
        an.position.set(w.gx, w.hop * 0.4, w.gy); an.rotation.y = Math.PI / 4 + (w.face > 0 ? 0 : Math.PI); an.rotation.z = Math.sin(T * 2 + i) * 0.02;
        const br = 1 + Math.sin(T * 2 + i) * 0.015, gz = id === "chicken" ? Math.max(0, Math.sin(T * 3 + i)) * 0.35 : 0; an.scale.set(br, br, br); an.children.forEach((o: any) => { if (id === "chicken" && o.position && o.position.y > 0.2 && o.userData.head === undefined) { /* the pecking head is the whole group tilt */ } }); an.rotation.x = gz * 0.15; void A;
      }
    });
    // windmill and rocket
    const m = gp(geo.MILL.x, geo.MILL.y); mill.position.set(m[0], 0, m[1]); mill.children.forEach((o: any) => { if (o.userData.hub) o.rotation.z = T * 0.8; });
    const p = gp(geo.PAD.x, geo.PAD.y), lift = S.launch > 0 ? Math.pow(1 - S.launch / 2, 2) * 520 / (0.866 * SPL) : 0; rocket.position.set(p[0], 0.05 + lift, p[1]); rocket.children.forEach((o: any) => { if (o.userData.flame) { o.visible = S.launch > 0; o.scale.y = 1 + 0.2 * Math.sin(T * 38); } });
    if (HQ) { const a = pg.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < PN; i++) { a.setY(i, 0.5 + 0.7 * (Math.sin(T * 0.6 + pseed[i]) + 1) * 0.5 + 0.3); a.setX(i, a.getX(i) + Math.sin(T * 0.3 + pseed[i]) * 0.002); } a.needsUpdate = true; (pts.material as THREE.PointsMaterial).opacity = 0.55 + 0.35 * Math.sin(T * 2); }
    let sk = 0; S.plots.forEach((cell: any, i: number) => { if (cell.crop && cell.p >= 100 && sk < sparkles.length) { const c0 = geo.FX + (i % geo.COLS) * 2 + 1, r0 = geo.FY + Math.floor(i / geo.COLS) * 2 + 1, sp = sparkles[sk++]; sp.visible = true; sp.position.set(c0 + Math.sin(T * 2 + i) * 0.4, 0.5 + Math.abs(Math.sin(T * 3 + i)) * 0.3, r0 + Math.cos(T * 2 + i) * 0.4); sp.rotation.y = T * 3; } }); for (; sk < sparkles.length; sk++) sparkles[sk].visible = false;
    ren.render(scene, cam);
  };
  return { el, render, dispose() { try { ren.dispose(); if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {} } };
}
