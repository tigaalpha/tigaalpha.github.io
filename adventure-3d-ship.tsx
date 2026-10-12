/* ── Adventure 3D for the ship maps (owner, 2026-10-12: "make everything 3D") ──
   Same idea as the ground maps (adventure-3d.tsx): a Three.js scene drawn BEHIND the ship engine's own transparent 2D canvas. The engine keeps every rule and
   keeps drawing shots, effects, pickups and the mode-specific props (black hole, Dyson lattice, warp gates…); this file draws what is solid: the star field,
   the planets and nebulae with real depth, the asteroids, the player's ship (or the Ark), every enemy ship and the mothership. The camera looks straight at the
   game plane (z = 0) so one logical unit is the same size as on the 2D canvas; the world is X = x, Y = -y (the 2D canvas has y pointing down). */
import * as THREE from "three";

const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const std = (c: THREE.ColorRepresentation, e: THREE.ColorRepresentation = 0, ei = 0, rough = 0.5, metal = 0.1) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, roughness: rough, metalness: metal });
const col = (s: string) => { const [r, g, b] = s.split(",").map(Number); return new THREE.Color((r || 0) / 255, (g || 0) / 255, (b || 0) / 255); };

function glowTex(rgb: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d")!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(0.35, `rgba(${rgb},.5)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
}
function bandTex(stops: string[], seed: number): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = 8; cv.height = 256; const x = cv.getContext("2d")!;
  for (let i = 0; i < 24; i++) { x.fillStyle = stops[Math.floor(rnd(seed + i) * stops.length)]; const y = (i / 24) * 256; x.fillRect(0, y, 8, 256 / 24 + 1); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export interface Ship3D { render(S: any, tm: number, logicW: number, logicH: number, shx: number, shy: number): void; resize(w: number, h: number, dpr: number): void; dispose(): void; }
export interface ShipOpts { mode: string; sky: string; glow: string; ark: any | null; }

export function createShip3D(host: HTMLElement, opts: ShipOpts): Ship3D | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" }); } catch (e) { return null; }
  const el = renderer.domElement; el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"; el.setAttribute("aria-hidden", "true"); host.appendChild(el); renderer.setClearColor(0x000000, 0);
  const keep: any[] = [], K = <T,>(o: T): T => { keep.push(o); return o; };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 2, 20, 8000), glow = col(opts.glow);
  scene.add(new THREE.HemisphereLight(0xaab8ff, 0x1a1030, 0.9)); const sun = new THREE.DirectionalLight(0xfff0dd, 1.6); sun.position.set(400, 300, 500); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ab0ff, 0.5); fill.position.set(-300, -100, 400); scene.add(fill);

  // ── a space backdrop: sky gradient wall, nebula glows, stars in depth, planets
  const sky = (() => { const cv = document.createElement("canvas"); cv.width = 4; cv.height = 128; const x = cv.getContext("2d")!; const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "#02030c"); g.addColorStop(1, "#0b0a24"); x.fillStyle = g; x.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(cv); })(); K(sky);
  const wall = new THREE.Mesh(K(new THREE.PlaneGeometry(14000, 7000)), K(new THREE.MeshBasicMaterial({ map: sky, fog: false, depthWrite: false }))); wall.position.z = -5000; wall.renderOrder = -10; scene.add(wall);
  const g1 = K(glowTex("150,90,255")), g2 = K(glowTex("255,100,170")), g3 = K(glowTex("80,220,200"));
  const nebs: THREE.Sprite[] = [[g1, 0.75, 0.3, 1500], [g2, 0.55, 0.14, 1100], [g3, 0.22, 0.62, 1300]].map(([t, , , r]: any, i) => { const s = new THREE.Sprite(K(new THREE.SpriteMaterial({ map: t, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false }))); s.scale.set(r, r, 1); s.position.z = -3600 - i * 200; scene.add(s); return s; });
  const NS = 900, spos = new Float32Array(NS * 3), sbase = new Float32Array(NS * 3), ssp = new Float32Array(NS);
  for (let i = 0; i < NS; i++) { sbase[i * 3] = rnd(i) * 3600 - 800; sbase[i * 3 + 1] = rnd(i + 900) * 1800 - 1500; sbase[i * 3 + 2] = -300 - rnd(i + 1800) * 2300; ssp[i] = 14 + (1 - (-sbase[i * 3 + 2] - 300) / 2300) * 60; }
  const stGeo = K(new THREE.BufferGeometry()); stGeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
  const stars = new THREE.Points(stGeo, K(new THREE.PointsMaterial({ color: 0xdde8ff, size: 7, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false }))); stars.frustumCulled = false; scene.add(stars);
  // planets by sky
  const planets: { m: THREE.Mesh; base: number; sp: number; y: number; z: number }[] = [];
  const addPlanet = (r: number, x: number, y: number, z: number, tex: THREE.Texture | null, color: number, ring = false, sp = 4) => {
    const m = new THREE.Mesh(K(new THREE.SphereGeometry(r, 36, 24)), K(new THREE.MeshStandardMaterial({ map: tex || undefined, color: tex ? 0xffffff : color, roughness: 0.9, metalness: 0, emissive: 0x111122, emissiveIntensity: 0.4 })));
    m.position.set(x, y, z); if (ring) { const rg = new THREE.Mesh(K(new THREE.RingGeometry(r * 1.35, r * 2.1, 64)), K(new THREE.MeshBasicMaterial({ color: 0xd9c9a6, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }))); rg.rotation.x = Math.PI / 2.3; rg.rotation.y = -0.25; m.add(rg); }
    scene.add(m); planets.push({ m, base: x, sp, y, z }); return m;
  };
  const SK = opts.sky;
  if (SK === "jupiter") addPlanet(520, 1400, -760, -1700, K(bandTex(["#d9a066", "#b9703a", "#f0d2a0", "#8a5a34", "#e8b878"], 4)), 0, false, 2);
  else if (SK === "saturn") addPlanet(330, 1250, -150, -1700, K(bandTex(["#e8d4a0", "#c9b07a", "#f4e6bf", "#a8925a"], 9)), 0, true, 2);
  else if (SK === "gas") addPlanet(560, 1500, -400, -1800, K(bandTex(["#7a56c8", "#c070a0", "#e0a060", "#5a3aa0"], 7)), 0, false, 2);
  else if (SK === "venus") addPlanet(420, 1300, -700, -1600, K(bandTex(["#e8b840", "#c8902a", "#f0d070", "#a07020"], 3)), 0, false, 2);
  else if (SK === "ark" || SK === "dyson") { /* a star + lattice are drawn by the 2D layer */ }
  else { addPlanet(210, 1250, -150, -1700, K(bandTex(["#4a6a9a", "#7a98c8", "#2a4a7a", "#a0b8dc"], 5)), 0, false, 3); addPlanet(90, 500, -620, -1300, null, 0x887766, false, 5); }

  // ── materials shared by the ships
  const steel = K(std(0xd0d8e8, 0x0a0f1a, 0.2, 0.35, 0.25)), dark = K(std(0x222a40, 0, 0, 0.55, 0.2)), glowM = K(std(glow, glow, 1.8, 0.3, 0)), flameM = K(new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], r: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) => { const o = new THREE.Mesh(g, m); o.position.set(...p); o.rotation.set(...r); o.scale.set(...s); return o; };
  const PI2 = Math.PI / 2;

  // ── the player's ship: a stainless Starship-like hull (or the Ark: a long spine with a spinning gravity ring and green farm domes)
  const player = new THREE.Group(), flames: THREE.Mesh[] = []; let ring: THREE.Mesh | null = null;
  if (opts.ark) {
    const lv = opts.ark; player.add(mk(new THREE.CylinderGeometry(9, 11, 120, 14), steel, [0, 0, 0], [0, 0, PI2])); player.add(mk(new THREE.ConeGeometry(11, 26, 14), steel, [72, 0, 0], [0, 0, -PI2]));
    ring = mk(new THREE.TorusGeometry(34 + (lv.g || 0) * 3, 4.5, 8, 36), dark, [0, 0, 0], [0, PI2, 0]); player.add(ring);
    for (let i = 0; i < 4 + (lv.f || 0) * 2; i++) player.add(mk(new THREE.SphereGeometry(7, 10, 8, 0, Math.PI * 2, 0, PI2), K(std(0x58d68a, 0x1a6a3a, 0.7, 0.4, 0)), [-44 + i * 12, 9, (i % 2 ? 1 : -1) * 4]));
    for (let i = 0; i < 6; i++) player.add(mk(new THREE.BoxGeometry(5, 2, 2), glowM, [-40 + i * 14, -6, 8]));
    for (let i = 0; i < 3; i++) { const f = mk(new THREE.ConeGeometry(6, 40, 10), flameM, [-82, (i - 1) * 8, 0], [0, 0, PI2]); player.add(f); flames.push(f); }
    player.scale.setScalar(0.9);
  } else {
    player.add(mk(new THREE.CylinderGeometry(9, 9.5, 54, 16), steel, [0, 0, 0], [0, 0, PI2])); player.add(mk(new THREE.ConeGeometry(9, 26, 16), steel, [40, 0, 0], [0, 0, -PI2]));
    player.add(mk(new THREE.BoxGeometry(48, 3, 13), dark, [-2, -8.4, 0]));                      // the heat-shield belly
    for (const z of [-1, 1]) { player.add(mk(new THREE.BoxGeometry(14, 2.4, 15), dark, [26, 1, z * 12], [z * 0.2, 0, 0])); player.add(mk(new THREE.BoxGeometry(18, 2.4, 20), steel, [-22, 0, z * 14], [z * 0.25, 0, 0])); }
    player.add(mk(new THREE.BoxGeometry(14, 2.4, 5), glowM, [18, 8.4, 0]));                      // a lit canopy strip
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; player.add(mk(new THREE.ConeGeometry(4.5, 9, 10), dark, [-31, Math.sin(a) * 4.5, Math.cos(a) * 4.5], [0, 0, PI2])); const f = mk(new THREE.ConeGeometry(3.6, 26, 10), flameM, [-45, Math.sin(a) * 4.5, Math.cos(a) * 4.5], [0, 0, PI2]); player.add(f); flames.push(f); }
  }
  scene.add(player);

  // ── enemy ships (face left), the mothership, asteroids: built on demand and pooled by object
  const enemyMat = { hull: K(std(0x2a1e3a, 0x000000, 0, 0.5, 0.2)), red: K(std(0xff4560, 0xff2a4a, 1.6, 0.3, 0)), amber: K(std(0xffb340, 0xff9a20, 1.4, 0.3, 0)), plate: K(std(0x4a3a60, 0, 0, 0.5, 0.2)), bio: K(std(0x6aa040, 0x2a5a10, 0.5, 0.6, 0)) };
  const buildEnemy = (type: string, r: number): THREE.Group => {
    const g = new THREE.Group(), s = r / 16;
    if (type === "drone") { g.add(mk(new THREE.SphereGeometry(13, 14, 10), enemyMat.hull, [0, 0, 0], [0, 0, 0], [1.2, 0.8, 1])); g.add(mk(new THREE.SphereGeometry(4, 8, 6), enemyMat.red, [-12, 0, 0])); for (const z of [-1, 1]) for (const y of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(1.1, 0.8, 16, 5), enemyMat.plate, [2, y * 9, z * 6], [z * 0.5, 0, y * 0.5])); }
    else if (type === "fighter") { g.add(mk(new THREE.ConeGeometry(8, 36, 6), enemyMat.hull, [0, 0, 0], [0, 0, PI2])); for (const z of [-1, 1]) { g.add(mk(new THREE.BoxGeometry(20, 1.8, 18), enemyMat.plate, [4, 0, z * 12], [0, z * 0.45, 0])); g.add(mk(new THREE.SphereGeometry(2.4, 8, 6), enemyMat.amber, [10, 0, z * 20])); } g.add(mk(new THREE.SphereGeometry(3.2, 8, 6), enemyMat.red, [-16, 0, 0])); }
    else if (type === "bomber") { g.add(mk(new THREE.BoxGeometry(46, 22, 24), enemyMat.hull, [0, 0, 0])); g.add(mk(new THREE.BoxGeometry(30, 4, 34), enemyMat.plate, [4, 0, 0])); for (const z of [-1, 1]) { g.add(mk(new THREE.CylinderGeometry(6, 7, 24, 10), enemyMat.plate, [8, 0, z * 17], [0, 0, PI2])); g.add(mk(new THREE.SphereGeometry(4, 8, 6), enemyMat.amber, [22, 0, z * 17])); } g.add(mk(new THREE.BoxGeometry(5, 6, 14), enemyMat.red, [-24, 0, 0])); }
    else if (type === "wasp") { g.add(mk(new THREE.ConeGeometry(5, 30, 5), enemyMat.amber, [0, 0, 0], [0, 0, PI2])); for (const z of [-1, 1]) g.add(mk(new THREE.BoxGeometry(14, 1.2, 12), enemyMat.plate, [6, 0, z * 9], [0, z * 0.6, 0])); g.add(mk(new THREE.SphereGeometry(3, 8, 6), enemyMat.red, [-12, 0, 0])); }
    else { g.add(mk(new THREE.IcosahedronGeometry(11, 0), enemyMat.bio, [0, 0, 0])); for (let i = 0; i < 8; i++) { const a = i * 0.785; g.add(mk(new THREE.ConeGeometry(2.4, 12, 5), enemyMat.red, [Math.cos(a) * 12, Math.sin(a) * 12, 0], [0, 0, a - PI2])); } }
    g.scale.setScalar(Math.max(0.7, s)); return g;
  };
  const buildBoss = (): THREE.Group => {
    const g = new THREE.Group(); g.add(mk(new THREE.SphereGeometry(70, 24, 16), enemyMat.hull, [0, 0, 0], [0, 0, 0], [1.9, 0.9, 1.1]));
    for (let i = 0; i < 3; i++) g.add(mk(new THREE.TorusGeometry(62 + i * 16, 4, 6, 28), enemyMat.plate, [-30 + i * 38, 0, 0], [0, PI2, 0], [1, 1.2, 1]));
    for (let i = 0; i < 12; i++) g.add(mk(new THREE.BoxGeometry(6, 3, 2), enemyMat.amber, [-90 + i * 16, 18 + (i % 3) * 6, 70]));
    g.add(mk(new THREE.SphereGeometry(20, 14, 10), enemyMat.red, [-60, 0, 0])); for (const z of [-1, 1]) g.add(mk(new THREE.ConeGeometry(14, 90, 8), enemyMat.plate, [30, 0, z * 70], [0, 0, PI2])); return g;
  };
  const rockMat = K(std(0x8a7a6a, 0x000000, 0, 0.9, 0)), rockBase = K(new THREE.IcosahedronGeometry(1, 1));
  const pool = new Map<any, THREE.Object3D>();
  const getObj = (o: any, build: () => THREE.Object3D) => { let a = pool.get(o); if (!a) { a = build(); pool.set(o, a); scene.add(a); } return a; };

  let W = 0, H = 0;
  const api: Ship3D = {
    resize(w, h, dpr) { W = w; H = h; renderer.setPixelRatio(Math.min(dpr, 1.6)); renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); },
    render(S, tm, lw, lh, shx, shy) {
      const cw = host.clientWidth || 800, ch = host.clientHeight || 400; if (cw !== W || ch !== H) api.resize(cw, ch, window.devicePixelRatio || 1);
      const D = 1000; camera.fov = (2 * Math.atan(lh / 2 / D) * 180) / Math.PI; camera.aspect = cw / Math.max(1, ch); camera.updateProjectionMatrix();
      const cx = lw / 2 - shx, cy = -lh / 2 + shy; camera.position.set(cx, cy, D); camera.lookAt(cx, cy, 0);
      wall.position.set(cx, cy, -5000); const vt = S.vt || 0;
      nebs.forEach((n, i) => n.position.set(cx + [300, 100, -420][i] * (1 + 0), cy + [160, 150, -120][i], -3600 - i * 200));
      const a = stGeo.getAttribute("position") as THREE.BufferAttribute, span = 3600, fast = 1 + (S.ls || 0) * 7;
      for (let i = 0; i < NS; i++) { const x0 = (((sbase[i * 3] - vt * ssp[i] * 0.6 * fast) % span) + span) % span - 800; spos[i * 3] = x0; spos[i * 3 + 1] = sbase[i * 3 + 1] + 700; spos[i * 3 + 2] = sbase[i * 3 + 2]; } a.needsUpdate = true;
      for (const p of planets) { p.m.position.x = p.base - ((vt * p.sp) % 4000); if (p.m.position.x < -1500) p.m.position.x += 5200; p.m.rotation.y += 0.0008; }
      // the player's ship
      const sh = S.ship; player.visible = !S.over && !S.hidePlayer;
      if (player.visible) {
        const prevY = (player.userData.py === undefined ? sh.y : player.userData.py); player.userData.py = sh.y; const vy = (sh.y - prevY) * 0.9;
        player.position.set(sh.x, -sh.y, 0); player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -Math.max(-0.5, Math.min(0.5, vy * 0.18)), 0.2); player.rotation.x = Math.sin(tm * 1.6) * 0.05;
        const blink = sh.inv > 0 && Math.floor(S.t * 20) % 2 === 0; steel.emissiveIntensity = blink ? 1.2 : 0.2; (steel.emissive as THREE.Color).setHex(blink ? 0xffffff : 0x0a0f1a);
        for (const f of flames) { f.scale.set(0.8 + Math.random() * 0.5 + (S.ls || 0) * 0.8, 1, 1); }
        if (ring) ring.rotation.x += 0.02;
      }
      const seen = new Set<any>();
      for (const e of S.en || []) { if (e.dead) continue; const o = getObj(e, () => buildEnemy(e.type, e.r || 16)); o.position.set(e.x, -e.y, 0); o.rotation.set(Math.sin((e.ph || 0) * 2) * 0.25, Math.PI, 0); o.rotation.x = Math.sin((e.ph || 0) * 2) * 0.3; seen.add(e); if (e.type === "kamikaze") o.rotation.z += 0.1; o.traverse((c: any) => { if (c.isMesh && c.material === enemyMat.hull) { c.material = enemyMat.hull; } }); }
      if (S.boss && !S.boss.dead) { const B = S.boss; const o = getObj(B, buildBoss); o.position.set(B.x, -B.y, 0); o.rotation.y = Math.PI; o.rotation.z = Math.sin((B.ph || 0) * 0.9) * 0.05; seen.add(B); }
      for (const k of S.rk || []) { if (k.dead) continue; const o = getObj(k, () => { const m = new THREE.Mesh(rockBase, rockMat); m.scale.set(k.r * (0.9 + rnd(k.seed * 3) * 0.3), k.r * (0.8 + rnd(k.seed * 5) * 0.3), k.r * (0.8 + rnd(k.seed * 7) * 0.3)); return m; }); o.position.set(k.x, -k.y, 0); o.rotation.set(k.rot * 0.7 + k.seed, k.rot, k.seed); seen.add(k); }
      for (const [key, o] of pool) if (!seen.has(key)) { scene.remove(o); o.traverse((c: any) => { if (c.isMesh && c.geometry !== rockBase) c.geometry.dispose(); }); pool.delete(key); }
      renderer.render(scene, camera);
    },
    dispose() { try { for (const d of keep) d && d.dispose && d.dispose(); scene.traverse((c: any) => { if (c.isMesh && c.geometry) c.geometry.dispose(); }); renderer.dispose(); if (el.parentNode) el.parentNode.removeChild(el); const lc = renderer.getContext().getExtension("WEBGL_lose_context"); if (lc) lc.loseContext(); } catch (e) {} },
  };
  return api;
}
