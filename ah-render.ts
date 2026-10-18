/* Alien Hunt renderer (plan 38): three.js scene, first-person camera, the gun in hand, procedural insect aliens, tracers and goo.
   High = shadows, device pixel ratio up to 2, more particles; Lite = no shadows, pixel ratio 1, fewer lights. Everything is drawn from code, nothing is downloaded. */
import * as THREE from "three";
import { ARENA, EYE, ALIENS, type State, type Enemy, type AlienKind, type Ev } from "./ah-engine";

const MAT = (c: number, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.15, ...o });
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rep = 1) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d") as CanvasRenderingContext2D);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const noise = (g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } };

/* ── aliens ── */
const CARAPACE = MAT(0x2a3b2a, { roughness: 0.45, metalness: 0.3 }), CARAPACE2 = MAT(0x4a3a22, { roughness: 0.5, metalness: 0.25 }), SPIT = MAT(0x34402a, { roughness: 0.5 });
const GLOW = (c: number) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.3 });
type Rig = { g: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; mats: THREE.MeshStandardMaterial[]; body: THREE.Object3D };
function leg(len: number, th: number, m: THREE.Material) { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(th, th * 0.7, len, 6), m); a.position.y = -len / 2; g.add(a); const b = new THREE.Group(); b.position.y = -len; const c = new THREE.Mesh(new THREE.CylinderGeometry(th * 0.7, th * 0.3, len * 1.1, 6), m); c.position.y = -len * 0.55; c.rotation.z = 0.5; b.add(c); g.add(b); return g; }
function buildAlien(kind: AlienKind): Rig {
  const g = new THREE.Group(), legs: THREE.Object3D[] = [], arms: THREE.Object3D[] = [], mats: THREE.MeshStandardMaterial[] = [];
  const mk = (base: THREE.MeshStandardMaterial) => { const m = base.clone(); mats.push(m); return m; };
  const body = new THREE.Group(); g.add(body);
  if (kind === "skitter") {
    const m = mk(CARAPACE), thorax = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), m); thorax.scale.set(1, 0.7, 1.4); thorax.position.y = 0.55; body.add(thorax);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); head.position.set(0, 0.6, -0.55); body.add(head);
    for (const x of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), GLOW(0xff3a2a)); e.position.set(x, 0.66, -0.74); body.add(e); }
    for (let i = 0; i < 6; i++) { const l = leg(0.5, 0.045, m); const sd = i % 2 ? 1 : -1; l.position.set(0.3 * sd, 0.55, -0.3 + Math.floor(i / 2) * 0.3); l.rotation.z = sd * 0.9; g.add(l); legs.push(l); }
  } else if (kind === "mantis") {
    const m = mk(CARAPACE), m2 = mk(CARAPACE2);
    const abd = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 6, 10), m2); abd.rotation.x = Math.PI / 2 - 0.35; abd.position.set(0, 1.05, 0.55); body.add(abd);
    const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 6, 10), m); thorax.position.set(0, 1.35, -0.1); thorax.rotation.x = -0.4; body.add(thorax);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 8), m); head.rotation.x = Math.PI; head.position.set(0, 1.95, -0.35); body.add(head);
    for (const x of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), GLOW(0xffb020)); e.position.set(x, 2.0, -0.5); body.add(e); }
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.28 * sd, 1.6, -0.35);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.7, 6), m); up.position.y = -0.3; up.rotation.x = 0.5; arm.add(up);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8, 5), mk(CARAPACE2)); blade.position.set(0, -0.35, -0.55); blade.rotation.x = -1.9; arm.add(blade); body.add(arm); arms.push(arm);
    }
    for (let i = 0; i < 4; i++) { const l = leg(0.7, 0.05, m); const sd = i % 2 ? 1 : -1; l.position.set(0.25 * sd, 1.0, 0.15 + Math.floor(i / 2) * 0.55); l.rotation.z = sd * 0.35; g.add(l); legs.push(l); }
  } else {
    const m = mk(SPIT), m2 = mk(CARAPACE2);
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), m); sac.scale.set(1, 0.9, 1.15); sac.position.y = 1.15; body.add(sac);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), GLOW(0x8cff3a)); glow.position.set(0, 1.2, 0.1); body.add(glow);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), m2); head.position.set(0, 1.55, -0.62); body.add(head);
    const mouth = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 7), m2); mouth.rotation.x = -Math.PI / 2; mouth.position.set(0, 1.5, -0.95); body.add(mouth);
    for (const x of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), GLOW(0xb6ff3a)); e.position.set(x, 1.65, -0.82); body.add(e); }
    for (let i = 0; i < 4; i++) { const l = leg(0.85, 0.06, m2); const sd = i % 2 ? 1 : -1; l.position.set(0.35 * sd, 0.9, -0.2 + Math.floor(i / 2) * 0.5); l.rotation.z = sd * 0.5; g.add(l); legs.push(l); }
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  return { g, legs, arms, mats, body };
}

/* ── the gun in hand ── */
function buildGun(id: string): THREE.Group {
  const g = new THREE.Group(), dark = MAT(0x15181c, { metalness: 0.6, roughness: 0.35 }), mid = MAT(0x2c3138, { metalness: 0.5, roughness: 0.4 }), tan = MAT(0x6b5a3a, { roughness: 0.7 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const cyl = (r: number, l: number, m: THREE.Material, x: number, y: number, z: number) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 10), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); };
  if (id === "pistol") { box(0.05, 0.07, 0.3, mid, 0, 0, -0.1); box(0.045, 0.13, 0.06, dark, 0, -0.09, 0.0); box(0.012, 0.02, 0.012, GLOW(0x41e0ff), 0, 0.045, -0.2); }
  else if (id === "rifle") { box(0.06, 0.09, 0.55, mid, 0, 0, -0.2); box(0.05, 0.1, 0.18, tan, 0, -0.02, 0.18); box(0.04, 0.14, 0.07, dark, 0, -0.11, -0.05); box(0.05, 0.11, 0.09, dark, 0, -0.1, -0.22); cyl(0.014, 0.35, dark, 0, 0.0, -0.62); box(0.03, 0.04, 0.12, dark, 0, 0.07, -0.18); box(0.014, 0.014, 0.1, GLOW(0x41e0ff), 0, 0.045, -0.37); }
  else if (id === "launcher") { cyl(0.07, 0.62, mid, 0, 0, -0.25); cyl(0.085, 0.16, dark, 0, 0, -0.58); box(0.05, 0.12, 0.08, dark, 0, -0.11, 0.0); box(0.05, 0.05, 0.2, tan, 0, -0.03, 0.2); cyl(0.05, 0.05, GLOW(0x41ff9a), 0, 0.06, -0.3); }
  else { box(0.07, 0.09, 0.5, mid, 0, 0, -0.18); cyl(0.022, 0.62, dark, 0, 0.03, -0.5); cyl(0.028, 0.34, tan, 0, -0.04, -0.4); box(0.06, 0.1, 0.2, tan, 0, -0.03, 0.2); box(0.05, 0.12, 0.07, dark, 0, -0.1, 0.0); }
  g.traverse(o => { (o as any).frustumCulled = false; });
  return g;
}

export type Render = { draw: (s: State, dt: number) => void; resize: () => void; dispose: () => void; setHigh: (h: boolean) => void; events: (ev: Ev[]) => void; shake: number; info: () => any; canvas: HTMLCanvasElement };

export function createRender(host: HTMLElement, startHigh: boolean): Render {
  let high = startHigh;
  const renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.shadowMap.enabled = high; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement; canvas.className = "ah-cv"; host.appendChild(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1420); scene.fog = new THREE.FogExp2(0x3a2a34, 0.017);
  const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 220); cam.rotation.order = "YXZ"; scene.add(cam);

  /* sky: a dusk gradient dome, a huge Harvester ship hanging in it */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(8, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#0b0a1e"); gr.addColorStop(0.45, "#4a2744"); gr.addColorStop(0.62, "#c4684a"); gr.addColorStop(0.66, "#e8a05a"); gr.addColorStop(1, "#2a1c26"); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); }) }));
  scene.add(sky);
  const ship = new THREE.Group(); const hullM = MAT(0x15131c, { metalness: 0.7, roughness: 0.4 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(46, 52, 7, 40), hullM); ship.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 1.2, 8, 48), GLOW(0xff4a3a)); ring.rotation.x = Math.PI / 2; ring.position.y = -3.8; ship.add(ring);
  const core = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10), GLOW(0xff7a3a)); core.position.y = -6; core.scale.y = 0.5; ship.add(core);
  ship.position.set(-30, 62, -110); scene.add(ship);
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(Array.from({ length: 600 }, () => 0).map((_, i) => (i % 3 === 1 ? 20 + Math.random() * 150 : (Math.random() - 0.5) * 340)), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, fog: false, sizeAttenuation: false })); scene.add(stars);

  /* light */
  scene.add(new THREE.HemisphereLight(0xcfd2ff, 0x2a2440, 0.9));
  const sun = new THREE.DirectionalLight(0xffd9b0, 1.3); sun.position.set(-30, 40, 25); sun.castShadow = high; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); scene.add(sun);
  const flash = new THREE.PointLight(0xffd080, 0, 14); scene.add(flash);

  /* ground and the level kit */
  const asphalt = canvasTex(256, 256, g => { g.fillStyle = "#3b3640"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 1800, 0.2); g.strokeStyle = "rgba(230,200,90,.55)"; g.lineWidth = 3; g.setLineDash([22, 18]); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke(); }, 22);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, metalness: 0.05 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const crateTex = canvasTex(128, 128, g => { g.fillStyle = "#5a5648"; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 500, 0.25); g.fillStyle = "#d4a93a"; for (let i = -2; i < 8; i++) { g.save(); g.translate(i * 24, 0); g.rotate(-0.6); g.fillRect(0, -10, 10, 220); g.restore(); } g.fillStyle = "rgba(20,20,24,.5)"; g.fillRect(0, 0, 128, 16); }, 1);
  const wallTex = canvasTex(256, 128, g => { g.fillStyle = "#33303a"; g.fillRect(0, 0, 256, 128); noise(g, 256, 128, 900, 0.18); g.fillStyle = "rgba(255,170,80,.7)"; for (let i = 0; i < 18; i++) g.fillRect(8 + (i % 6) * 40, 14 + Math.floor(i / 6) * 34, 16, 20); }, 1);
  const boxMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, metalness: 0.2 });
  const levelGroup = new THREE.Group(); scene.add(levelGroup);
  let builtFor: any = null;
  function buildLevel(boxes: State["boxes"]) {
    while (levelGroup.children.length) levelGroup.remove(levelGroup.children[0]);
    for (const b of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), boxMat); m.position.set(b.x, b.h / 2, b.z); m.castShadow = true; m.receiveShadow = true; levelGroup.add(m); }
    const wm = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }); const H = 9, L = ARENA + 1;
    for (const [x, z, w, d] of [[0, -L, L * 2, 1], [0, L, L * 2, 1], [-L, 0, 1, L * 2], [L, 0, 1, L * 2]] as number[][]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wm); m.position.set(x, H / 2, z); m.receiveShadow = true; levelGroup.add(m); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, lp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 6), MAT(0x222226)); lp.position.set(Math.cos(a) * 27, 3, Math.sin(a) * 27); levelGroup.add(lp); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), GLOW(0xffd080)); bulb.position.set(Math.cos(a) * 27, 6.1, Math.sin(a) * 27); levelGroup.add(bulb); }
    builtFor = boxes;
  }

  /* the gun in hand */
  const guns: Record<string, THREE.Group> = { pistol: buildGun("pistol"), rifle: buildGun("rifle"), shotgun: buildGun("shotgun"), launcher: buildGun("launcher") };
  const hold = new THREE.Group(); hold.position.set(0.2, -0.2, -0.38); hold.scale.setScalar(0.72); cam.add(hold);
  const handM = MAT(0xc79a76, { roughness: 0.8 }), sleeve = MAT(0x2c3a30);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.14), handM); hand.position.set(0.0, -0.075, 0.02); hold.add(hand);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.5), sleeve); fore.position.set(0.06, -0.1, 0.32); fore.rotation.x = -0.12; hold.add(fore);
  for (const k of Object.keys(guns)) { guns[k].visible = false; hold.add(guns[k]); }
  const mflash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "#fff"); r.addColorStop(0.3, "#ffd070"); r.addColorStop(1, "rgba(255,120,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  mflash.visible = false; hold.add(mflash);

  /* effects pools */
  const tracers: { m: THREE.Mesh; life: number }[] = [];
  const trM = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), trM); m.visible = false; scene.add(m); tracers.push({ m, life: 0 }); }
  const NP = high ? 160 : 70; type P = { m: THREE.Mesh; v: THREE.Vector3; life: number; g: number };
  const parts: P[] = []; const pgeo = new THREE.SphereGeometry(0.05, 5, 4);
  for (let i = 0; i < NP; i++) { const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: 0x88ff44, fog: false })); m.visible = false; scene.add(m); parts.push({ m, v: new THREE.Vector3(), life: 0, g: 9 }); }
  const burst = (x: number, y: number, z: number, n: number, col: number, spd: number) => { let k = 0; for (const p of parts) { if (p.life > 0) continue; if (k++ >= n) break; (p.m.material as THREE.MeshBasicMaterial).color.setHex(col); p.m.position.set(x, y, z); p.v.set((Math.random() - 0.5) * spd, Math.random() * spd * 0.8, (Math.random() - 0.5) * spd); p.life = 0.5 + Math.random() * 0.4; p.m.visible = true; p.m.scale.setScalar(0.6 + Math.random()); } };
  const rkPool: THREE.Mesh[] = []; const rkGeo = new THREE.SphereGeometry(0.16, 8, 6), rkMat = new THREE.MeshBasicMaterial({ color: 0x66ffb0, fog: false });
  const booms: { m: THREE.Mesh; life: number }[] = []; const bGeo = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; scene.add(m); booms.push({ m, life: 0 }); }
  const bl = new THREE.PointLight(0xffa050, 0, 22); scene.add(bl); let blT = 0;
  const acidM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), GLOW(0x9cff3a)); const acidPool: THREE.Mesh[] = [];

  const rigs = new Map<number, { rig: Rig; e: Enemy; fade: number }>();
  let gun = "rifle", kick = 0, mfT = 0, flashT = 0, bob = 0, shake = 0, curShake = 0;
  const api: Render = {
    canvas, shake: 0,
    events(ev) {
      for (const e of ev) {
        if (e.k === "shot") { kick = Math.min(1, kick + (e.w === "shotgun" ? 0.9 : e.w === "pistol" ? 0.45 : 0.25)); mfT = 0.05; flashT = 0.06; const t = tracers.find(q => q.life <= 0); if (t) { t.life = 0.07; t.m.visible = true; const from = new THREE.Vector3(0.2, -0.17, -0.7).applyMatrix4(cam.matrixWorld), dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), to = from.clone().addScaledVector(dir, 36); const mid = from.clone().add(to).multiplyScalar(0.5); t.m.position.copy(mid); t.m.scale.set(1, from.distanceTo(to), 1); t.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); } }
        else if (e.k === "boom") { const b = booms.find(q => q.life <= 0); if (b) { b.life = 0.45; b.m.visible = true; b.m.position.set(e.x as number, e.y as number, e.z as number); } burst(e.x as number, (e.y as number), e.z as number, high ? 50 : 24, 0xffb04a, 9); bl.position.set(e.x as number, 2, e.z as number); blT = 0.25; curShake = Math.min(1, curShake + 0.5); }
        else if (e.k === "hit") burst(e.x as number, e.y as number, e.z as number, 5, 0x9cff3a, 3);
        else if (e.k === "kill" || e.k === "head") burst(e.x as number, 0.9, e.z as number, high ? 26 : 12, e.k === "head" ? 0xffd34a : 0x7cd62a, 5);
        else if (e.k === "hurt") curShake = Math.min(1, curShake + 0.35);
      }
    },
    draw(s, dt) {
      if (builtFor !== s.boxes) buildLevel(s.boxes);
      const p = s.p; cam.position.set(p.x, EYE + p.y + Math.sin(bob) * 0.025 * (p.sprint ? 1.6 : 1), p.z); cam.rotation.set(p.pitch + curShake * (Math.random() - 0.5) * 0.04, p.yaw + curShake * (Math.random() - 0.5) * 0.04, 0);
      cam.updateMatrixWorld(true);
      if (guns[s.weapon] && gun !== s.weapon) { guns[gun].visible = false; gun = s.weapon; guns[gun].visible = true; } guns[gun].visible = true;
      kick = Math.max(0, kick - dt * 7); curShake = Math.max(0, curShake - dt * 2.2);
      const moving = s.frozen ? 0 : 1; bob += dt * (p.sprint ? 12 : 8) * moving * (p.y <= 0.01 ? 1 : 0);
      const rl = s.reload > 0 ? Math.sin(Math.min(1, (1 - s.reload / 1.6)) * Math.PI) : 0;
      hold.position.set(0.2 + Math.sin(bob * 0.5) * 0.008, -0.2 + Math.abs(Math.sin(bob * 0.5)) * 0.01 - rl * 0.16 - kick * 0.01, -0.38 + kick * 0.09);
      hold.rotation.set(kick * 0.14 + rl * 0.5, 0, rl * 0.3);
      mflash.visible = mfT > 0; if (mfT > 0) { mfT -= dt; mflash.position.set(0.0, 0.0, gun === "pistol" ? -0.3 : gun === "rifle" ? -0.85 : -0.82); mflash.rotation.z = Math.random() * 6; mflash.lookAt(cam.position); }
      flash.intensity = flashT > 0 ? 3.2 : 0; if (flashT > 0) { flashT -= dt; flash.position.copy(cam.position).add(new THREE.Vector3(0, 0, -1.2).applyQuaternion(cam.quaternion)); }
      for (const t of tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; }
      for (const q of parts) if (q.life > 0) { q.life -= dt; q.v.y -= q.g * dt; q.m.position.addScaledVector(q.v, dt); if (q.m.position.y < 0.03) { q.m.position.y = 0.03; q.v.set(0, 0, 0); } if (q.life <= 0) q.m.visible = false; }
      // aliens
      const seen = new Set<number>();
      for (const e of s.enemies) {
        seen.add(e.id); let r = rigs.get(e.id);
        if (!r) { const rig = buildAlien(e.kind); const sc = e.kind === "skitter" ? 1 : 1; rig.g.scale.setScalar(sc); scene.add(rig.g); r = { rig, e, fade: 0 }; rigs.set(e.id, r); }
        r.e = e; const g = r.rig.g; g.position.set(e.x, 0, e.z); g.rotation.y = e.yaw;
        const tt = e.t * (e.kind === "skitter" ? 16 : e.kind === "mantis" ? 8 : 6);
        r.rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(tt + i * 1.9) * 0.55; });
        r.rig.arms.forEach((a, i) => { a.rotation.x = -0.5 + Math.sin(e.t * 3 + i * 3) * 0.2 - (e.cd < 0.4 ? 0.9 : 0); });
        r.rig.body.position.y = Math.abs(Math.sin(tt * 0.5)) * 0.05 + (e.leap > 0 ? 0.7 : 0);
        for (const m of r.rig.mats) m.emissive.setHex(e.flash > 0 ? 0xff5030 : 0x000000);
        if (e.dead > 0) { const k = 1 - e.dead / 0.9; g.rotation.z = k * 1.5; g.position.y = -k * 0.25; g.scale.setScalar(Math.max(0.01, 1 - Math.max(0, k - 0.6) * 2.5)); }
      }
      for (const [id, r] of rigs) if (!seen.has(id)) { scene.remove(r.rig.g); r.rig.g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); } }); rigs.delete(id); }
      while (rkPool.length < s.rk.length) { const m = new THREE.Mesh(rkGeo, rkMat); scene.add(m); rkPool.push(m); }
      rkPool.forEach((m, i) => { const a = s.rk[i]; m.visible = !!a; if (a) m.position.set(a.x, a.y, a.z); });
      for (const b of booms) if (b.life > 0) { b.life -= dt; const k = 1 - b.life / 0.45; b.m.scale.setScalar(0.5 + k * 4.2); (b.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k)); if (b.life <= 0) b.m.visible = false; }
      if (blT > 0) { blT -= dt; bl.intensity = Math.max(0, blT / 0.25) * 9; } else bl.intensity = 0;
      // acid blobs
      while (acidPool.length < s.acid.length) { const m = acidM.clone(); scene.add(m); acidPool.push(m); }
      acidPool.forEach((m, i) => { const a = s.acid[i]; m.visible = !!a; if (a) m.position.set(a.x, a.y, a.z); });
      ship.rotation.y += dt * 0.02; ring.rotation.z += dt * 0.3; (core.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(performance.now() / 500) * 0.5;
      api.shake = curShake;
      renderer.render(scene, cam);
    },
    resize() {
      const w = host.clientWidth || 800, h = host.clientHeight || 450; renderer.setPixelRatio(high ? Math.min(2, window.devicePixelRatio || 1) : 1); renderer.setSize(w, h, false); canvas.style.width = "100%"; canvas.style.height = "100%";
      cam.aspect = w / h; cam.updateProjectionMatrix();
    },
    setHigh(h) { high = h; renderer.shadowMap.enabled = h; sun.castShadow = h; api.resize(); scene.traverse(o => { const m = (o as THREE.Mesh).material as any; if (m && m.needsUpdate !== undefined) m.needsUpdate = true; }); },
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, high, rigs: rigs.size }),
    dispose() { renderer.dispose(); scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mt: any = m.material; (Array.isArray(mt) ? mt : [mt]).forEach(x => x && x.dispose && x.dispose()); } }); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); },
  };
  api.resize(); guns[gun].visible = true;
  return api;
}
