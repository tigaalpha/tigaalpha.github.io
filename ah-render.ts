/* Alien Hunt renderer (plan 38): three.js scene, first-person camera, the gun in hand, procedural insect aliens, tracers and goo.
   High = shadows, device pixel ratio up to 2, more particles; Lite = no shadows, pixel ratio 1, fewer lights. Everything is drawn from code, nothing is downloaded. */
import * as THREE from "three";
import { createHiFx, HiFx, hiTier } from "./hi-fx";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LEVELS, type Level } from "./ah-levels";
import { ARENA, EYE, ALIENS, ALIEN_SCALE, WEAPONS, behOf, type State, type Enemy, type AlienKind, type Ev } from "./ah-engine";
const WCOL: Record<string, number> = Object.fromEntries(Object.entries(WEAPONS).map(([k, v]) => [k, v.col]));

const MAT = (c: number, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.15, ...o });
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rep = 1) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d") as CanvasRenderingContext2D);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const noise = (g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } };

/* ── aliens ── */
/* chitin: glossy, segmented, speckled shell. One shared canvas texture, tinted per material. */
const chitinTex = (() => canvasTex(256, 256, g => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#c9c7b4"); gr.addColorStop(1, "#e6e4d0"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(10,12,6,.55)"; g.lineWidth = 3; for (let y = 20; y < 256; y += 42) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y - 8, 170, y + 8, 256, y); g.stroke(); }
  g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.12)"; for (let i = 0; i < 40; i++) { g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40); g.stroke(); }
  noise(g, 256, 256, 1400, 0.3);
}, 1))();
const CHIT = (c: number, o: any = {}) => new THREE.MeshPhysicalMaterial({ color: c, map: chitinTex, roughness: 0.38, metalness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
const CARAPACE = CHIT(0x5d7040), CARAPACE2 = CHIT(0x9a6a36), SPIT = CHIT(0x6f8a3c, { roughness: 0.4 });
const GLOW = (c: number) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.3 });
type Rig = { g: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; mats: THREE.MeshStandardMaterial[]; body: THREE.Object3D };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, m: THREE.Material) { const d = b.clone().sub(a), L = d.length(); const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 14), m); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return c; }
const cone = (r: number, h: number, m: THREE.Material, p: THREE.Vector3, rot: [number, number, number] = [0, 0, 0]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), m); c.position.copy(p); c.rotation.set(rot[0], rot[1], rot[2]); return c; };
/** an insect leg: the hip is at the origin (put it at the body height), the thigh climbs up and out to a spiked knee, the shin drops to a clawed foot on the floor (H below the hip) */
function leg(len: number, th: number, m: THREE.Material, H = 0.6) {
  const g = new THREE.Group(), knee = V(0.5 * len, 0.45 * len, 0), foot = V(0.95 * len, -H, 0);
  g.add(limb(V(0, 0, 0), knee, th, th * 0.8, m)); const kn = new THREE.Mesh(new THREE.SphereGeometry(th * 1.35, 8, 6), m); kn.position.copy(knee); g.add(kn);
  g.add(cone(th * 0.9, th * 4, m, knee.clone().add(V(0, th * 2.2, 0)))); g.add(limb(knee, foot, th * 0.8, th * 0.3, m)); g.add(cone(th * 0.5, th * 3, m, foot.clone().add(V(0, -th * 1.2, 0)), [Math.PI, 0, 0]));
  // little spines down the shin
  for (let i = 1; i < 4; i++) { const p = knee.clone().lerp(foot, i / 4.2); g.add(cone(th * 0.28, th * 1.6, m, p.add(V(th * 0.9, 0, 0)), [0, 0, -1.2])); }
  return g;
}
/** a smooth, tapered tube through a few points (r0 at the start, r1 at the end; prof(k) bends the thickness along the way): the organic limb / neck / tail the reference creatures need */
function tube(pts: THREE.Vector3[], r0: number, r1: number, m: THREE.Material, prof?: (k: number) => number, seg = 28, rad = 12) {
  const c = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(c, seg, 1, rad, false), pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= seg; i++) { const k = i / seg, r = (r0 + (r1 - r0) * k) * (prof ? prof(k) : 1), ctr = c.getPoint(k); for (let j = 0; j <= rad; j++) { const n = i * (rad + 1) + j; pos.setXYZ(n, ctr.x + (pos.getX(n) - ctr.x) * r, ctr.y + (pos.getY(n) - ctr.y) * r, ctr.z + (pos.getZ(n) - ctr.z) * r); } }
  geo.computeVertexNormals(); return new THREE.Mesh(geo, m);
}
const antenna = (m: THREE.Material, base: THREE.Vector3, sd: number, len: number) => { const g = new THREE.Group(); let p = base.clone(), dir = V(0.25 * sd, 0.6, -0.5).normalize(); for (let i = 0; i < 4; i++) { const q = p.clone().addScaledVector(dir, len / 4); g.add(limb(p, q, 0.022 - i * 0.004, 0.018 - i * 0.004, m)); p = q; dir = dir.clone().add(V(0.15 * sd, -0.25, 0.05)).normalize(); } return g; };
const haloTex = (() => canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, 1))();
const eyes = (m: THREE.Material, y: number, z: number, dx: number, r: number) => { const g = new THREE.Group(); for (const x of [-dx, dx]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: (m as THREE.MeshStandardMaterial).color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(r * 7); sp.position.set(x, y, z - r * 0.5); g.add(sp); } for (const x of [-dx, dx]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); e.position.set(x, y, z); e.scale.set(0.8, 1.1, 0.8); g.add(e); } return g; };
const mandibles = (m: THREE.Material, y: number, z: number, len: number, gap: number) => { const g = new THREE.Group(); for (const sd of [-1, 1]) { g.add(limb(V(gap * sd, y, z), V(gap * 0.3 * sd, y - len * 0.2, z - len), len * 0.12, len * 0.03, m)); g.add(cone(len * 0.07, len * 0.4, m, V(gap * 0.3 * sd, y - len * 0.22, z - len * 1.15), [-Math.PI / 2, 0, 0])); } return g; };
/* colours from the three reference pictures: a wet blue-black xenomorph-style hide (main + steel-teal sheen), the bone / tan manta-hood alien, and the purple-blue / orange hammerhead */
const XENO = [0x0e151b, 0x1a2530, 0x2a3a48], TANC = [0x8a7560, 0xb08e66, 0xcfc4ae], HAMC = [0x4e4a72, 0x6a2a3e, 0xe0761c];
const REFPAL: Record<string, number[]> = { xeno: XENO };
for (const k of ["skitter", "mantis", "charger", "scarab", "stalker", "glowbug", "thornback", "hound", "domestalker", "razor", "leaper", "spiker", "warden", "titan", "lumawarden", "behemoth", "walker"]) REFPAL[k] = XENO;
for (const k of ["manthood", "flarecaster", "matriarch", "skyeye", "veilmaw", "sporecaster", "bloater", "spitter"]) REFPAL[k] = TANC;
for (const k of ["capling", "drone", "wisp"]) REFPAL[k] = HAMC;
REFPAL.huntsman = [0x6a6a48, 0x3a4046, 0xb09a62];
const HUNT_NET = canvasTex(128, 128, g => {   // the hunter's mesh bodysuit: a diamond net over mottled hide, with a dark knot at every crossing
  g.fillStyle = "#c6c1a8"; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "50,46,24" : "255,250,215"},${0.05 + Math.random() * 0.12})`; g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 12, 3 + Math.random() * 8, Math.random() * 3, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(24,22,10,.62)"; g.lineWidth = 2; for (let i = -128; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke(); }
  g.fillStyle = "rgba(14,12,4,.5)"; for (let x = 0; x < 128; x += 16) for (let y = 0; y < 128; y += 16) { g.fillRect(x + 6, y + 6, 4, 4); }
  noise(g, 128, 128, 500, 0.2);
}, 3);
const HUNT_PLATE = canvasTex(128, 128, g => {   // brushed, scuffed armour plate
  g.fillStyle = "#b4b4b0"; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.12})`; g.fillRect(Math.random() * 128, Math.random() * 128, 10 + Math.random() * 50, 1); }
  g.strokeStyle = "rgba(20,20,20,.35)"; g.lineWidth = 1.5; g.strokeRect(6, 6, 116, 116); g.beginPath(); g.moveTo(6, 64); g.lineTo(122, 64); g.stroke();
  g.fillStyle = "rgba(20,20,20,.4)"; for (const [x, y] of [[14, 14], [114, 14], [14, 114], [114, 114]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
  noise(g, 128, 128, 300, 0.18);
}, 2);
REFPAL.greyling = [0x9aa4a0, 0x6e7874, 0x05060a]; REFPAL.hydraling = [0x5a2a6a, 0xb0a060, 0x2a1a3a]; REFPAL.warbug = [0x4a5a2a, 0x20280e, 0xc0b070]; REFPAL.saberlord = [0x3a4a8a, 0x6a5a50, 0x66ccff]; REFPAL.skyfolk = [0x2a64b0, 0x0c1c4a, 0x66ffee]; REFPAL.leviathan = [0x1a1620, 0x3a3040, 0xff3a2a]; REFPAL.tripod = [0x4a4e58, 0x24262c, 0xff5a2a]; REFPAL.carapace = [0x6a2a4a, 0xd8ccb0, 0x2a1224];
/* skins painted for the three reference families (owner 2026-10-29: "make it more like the reference"): wet black scales with teal speculars, fine radial bone ribs and veins, mottled purple-orange flesh. Mid-grey so the palette colour still tints them. */
const skinTex = (kind: "xeno" | "tan" | "ham") => canvasTex(512, 512, g => {
  const R = (n: number) => Math.random() * n;
  if (kind === "xeno") {
    g.fillStyle = "#b9bec4"; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < 512; x += 16) { g.fillStyle = `rgba(${60 + R(60)},${70 + R(70)},${80 + R(80)},.55)`; g.beginPath(); g.ellipse(x + 8, y + 8, 7.5, 7.5, 0, 0, 7); g.fill(); g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1; g.stroke(); }
    g.strokeStyle = "rgba(190,235,255,.35)"; g.lineWidth = 1.2; for (let i = 0; i < 70; i++) { const x = R(512), y = R(512); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + R(50) - 25, y + R(50) - 25, x + R(80) - 40, y + R(80) - 40); g.stroke(); }
  } else if (kind === "tan") {
    g.fillStyle = "#d8d0c0"; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(70,50,30,.35)"; g.lineWidth = 1.5; for (let x = 0; x < 512; x += 7) { g.beginPath(); g.moveTo(x + R(2), 0); g.bezierCurveTo(x + R(14) - 7, 170, x + R(14) - 7, 340, x + R(4), 512); g.stroke(); }
    g.strokeStyle = "rgba(120,60,50,.28)"; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = R(512), y = R(512); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 40, y + 30, x - 30, y + 70, x + 20, y + 120); g.stroke(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R(1) < 0.5 ? "255,255,255" : "40,30,20"},${R(0.14)})`; g.fillRect(R(512), R(512), 1 + R(3), 1 + R(3)); }
  } else {
    g.fillStyle = "#c9c0cc"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 160; i++) { const x = R(512), y = R(512), r = 14 + R(46), gr = g.createRadialGradient(x, y, 0, x, y, r); const c = [[255, 140, 60], [120, 70, 150], [170, 50, 80], [60, 60, 120]][Math.floor(R(4))]; gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.55)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = "rgba(40,10,30,.3)"; g.lineWidth = 1.2; for (let i = 0; i < 60; i++) { const x = R(512), y = R(512); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 20, x + 10, y + 40, x + 60, y + 50); g.stroke(); }
  }
  noise(g, 512, 512, 1600, 0.22);
}, 2);
const SKINS: Record<string, THREE.Texture> = {};
const skinFor = (p: number[]) => { const k = p === XENO ? "xeno" : p === TANC ? "tan" : "ham"; return SKINS[k] || (SKINS[k] = skinTex(k)); };
/* the three reference creatures are templates for the rest of the roster (owner 2026-10-29: "make the other aliens closer to the pictures too"): a species listed here is built
   with that template, stretched by VARIANT, and keeps its own name, palette, behaviour and menace pass */
const FAMILY: Record<string, string> = { stalker: "domestalker", razor: "domestalker", hound: "domestalker", thornback: "domestalker", behemoth: "domestalker", warden: "domestalker", titan: "domestalker", lumawarden: "domestalker",
  flarecaster: "manthood", matriarch: "manthood", skyeye: "manthood", sporecaster: "manthood", veilmaw: "manthood", spiker: "capling", bloater: "capling" };
const VARIANT: Record<string, [number, number, number]> = { stalker: [0.95, 1, 1.1], razor: [0.78, 1.05, 1.0], hound: [1.0, 0.82, 1.25], thornback: [1.2, 1.0, 1.0], behemoth: [1.55, 1.2, 1.3], warden: [1.4, 1.35, 1.35], titan: [1.6, 1.55, 1.55], lumawarden: [1.35, 1.45, 1.35],
  flarecaster: [1, 1, 1], matriarch: [1.45, 1.3, 1.4], skyeye: [0.95, 0.9, 0.95], sporecaster: [0.9, 0.85, 0.9], veilmaw: [1.05, 1, 1.05], spiker: [0.9, 0.95, 0.9], bloater: [1.5, 1.05, 1.35] };
/** the Hood Walker's membrane: dark at the root, warm tan to a pale rim, ribs and cross-veins painted radially (u = across the fan, v = root to rim) */
let _hoodTex: THREE.Texture | null = null;
const hoodTex = () => _hoodTex || (_hoodTex = canvasTex(512, 512, g => {
  const W = 512, H = 512, N = 13, yv = (v: number) => (1 - v) * H, R = Math.random;
  const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, "#2a1a12"); gr.addColorStop(0.3, "#7a4c30"); gr.addColorStop(0.7, "#c48a52"); gr.addColorStop(1, "#f0d8a0"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = R() * W, y = R() * H, r = 12 + R() * 40, rg = g.createRadialGradient(x, y, 0, x, y, r), c = R() < 0.5 ? "90,50,30" : "230,200,150"; rg.addColorStop(0, `rgba(${c},.28)`); rg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let k = 0; k <= N; k++) { const u0 = k / (N + 1) * W, u1 = (k + 1) / (N + 1) * W; for (let c = 0; c < 4; c++) { const v = 0.25 + c * 0.2 + (k % 2) * 0.07; g.strokeStyle = "rgba(110,24,24,.65)"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(u0, yv(v)); g.quadraticCurveTo((u0 + u1) / 2, yv(v + 0.045), u1, yv(v - 0.02)); g.stroke(); } }
  for (let k = 1; k <= N; k++) { const x = k / (N + 1) * W; g.strokeStyle = "rgba(40,26,16,.85)"; g.lineWidth = 7; g.beginPath(); g.moveTo(x, H); g.lineTo(x, 0); g.stroke(); g.strokeStyle = "rgba(255,238,200,.55)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, H); g.lineTo(x - 3, 0); g.stroke(); }
  const rim = g.createLinearGradient(0, 0, 0, 40); rim.addColorStop(0, "rgba(60,30,40,.6)"); rim.addColorStop(1, "rgba(60,30,40,0)"); g.fillStyle = rim; g.fillRect(0, 0, W, 40);
  noise(g, W, H, 1600, 0.2);
}, 1));
/** the Tripod's hull plating: brushed gunmetal panels with seams, rivets, scorch and rust streaks (painted once, shared) */
let _tripodTex: THREE.Texture | null = null;
const tripodPlate = () => _tripodTex || (_tripodTex = canvasTex(256, 256, g => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#d4d8e0"); gr.addColorStop(1, "#aab0bc"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.06})`; g.fillRect(0, y, 256, 1); }
  g.strokeStyle = "rgba(10,12,18,.8)"; g.lineWidth = 3; for (const x of [0, 128]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } for (const y of [0, 85, 170]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = "rgba(20,22,30,.9)"; for (let x = 8; x < 256; x += 32) for (const y of [8, 93, 178]) { g.beginPath(); g.arc(x, y, 2.2, 0, 6.3); g.fill(); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x - 1, y - 2, 1.5, 1.5); g.fillStyle = "rgba(20,22,30,.9)"; }
  for (let i = 0; i < 14; i++) { const x = Math.random() * 256, y = Math.random() * 150, l = 30 + Math.random() * 90, rg = g.createLinearGradient(0, y, 0, y + l); rg.addColorStop(0, "rgba(120,60,20,.35)"); rg.addColorStop(1, "rgba(120,60,20,0)"); g.fillStyle = rg; g.fillRect(x, y, 2 + Math.random() * 4, l); }
  for (let i = 0; i < 7; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 14 + Math.random() * 26, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, "rgba(10,8,8,.45)"); rg.addColorStop(1, "rgba(10,8,8,0)"); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  noise(g, 256, 256, 1600, 0.25);
}, 1));
/** the Leviathan's armour: dark gunmetal with brushed grain, panel seams, rivets, rust bleed and scratches (grey, so the material colour tints it) */
let _levTex: THREE.Texture | null = null;
const levPlate = () => _levTex || (_levTex = canvasTex(256, 256, g => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#d6d6de"); gr.addColorStop(1, "#aeaeba"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.07})`; g.fillRect(0, y, 256, 1); }
  g.strokeStyle = "rgba(8,8,14,.8)"; g.lineWidth = 2.5; for (const x of [0, 96, 190]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } for (const y of [0, 70, 150, 215]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = "rgba(14,14,20,.9)"; for (let x = 8; x < 256; x += 24) for (const y of [8, 78, 158, 223]) { g.beginPath(); g.arc(x, y, 2, 0, 6.3); g.fill(); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x - 1, y - 2, 1.4, 1.4); g.fillStyle = "rgba(14,14,20,.9)"; }
  for (let i = 0; i < 16; i++) { const x = Math.random() * 256, y = Math.random() * 170, l = 26 + Math.random() * 80, rg = g.createLinearGradient(0, y, 0, y + l); rg.addColorStop(0, "rgba(130,64,24,.4)"); rg.addColorStop(1, "rgba(130,64,24,0)"); g.fillStyle = rg; g.fillRect(x, y, 2 + Math.random() * 4, l); }
  g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1; for (let i = 0; i < 26; i++) { const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 14); g.stroke(); }
  noise(g, 256, 256, 1400, 0.25);
}, 1));
/** the Sky Warrior's skin: deep azure with wavy dark stripes, paler mottling and glowing cyan freckle clusters (rot = 1 turns it a quarter so the head's stripes run up and down) */
const _skyTex: (THREE.Texture | null)[] = [null, null];
const skyFolkTex = (rot: number) => _skyTex[rot] || (_skyTex[rot] = (() => { const t = canvasTex(512, 256, g => {
  const W = 512, H = 256, R = Math.random;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#3d8ee8"); gr.addColorStop(0.5, "#2a6cc8"); gr.addColorStop(1, "#1e56a8"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const x = R() * W, y = R() * H, r = 10 + R() * 34, rg = g.createRadialGradient(x, y, 0, x, y, r), c = R() < 0.5 ? "14,46,130" : "130,205,255"; rg.addColorStop(0, `rgba(${c},.24)`); rg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.lineCap = "round";
  for (let s = 0; s < 12; s++) { const y0 = (s + R() * 0.6) / 12 * H, th = 5 + R() * 8; let x = -R() * 60; while (x < W) { const len = 50 + R() * 120, a = (R() - 0.5) * 16; g.strokeStyle = `rgba(4,14,70,${0.75 + R() * 0.25})`; g.lineWidth = th * (0.6 + R() * 0.8); g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + len * 0.3, y0 + a, x + len * 0.7, y0 - a, x + len, y0 + (R() - 0.5) * 6); g.stroke(); if (R() < 0.6) { g.lineWidth = th * 0.35; g.strokeStyle = "rgba(5,18,80,.55)"; g.beginPath(); g.moveTo(x + len * 0.1, y0 + th * 1.5); g.bezierCurveTo(x + len * 0.4, y0 + th * 1.5 + a * 0.6, x + len * 0.6, y0 + th * 1.5 - a * 0.6, x + len * 0.9, y0 + th * 1.5); g.stroke(); } x += len + 8 + R() * 60; } }
  for (let c = 0; c < 26; c++) { const cx = R() * W, cy = R() * H; for (let k = 0; k < 7; k++) { const x = cx + (R() - 0.5) * 36, y = cy + (R() - 0.5) * 22, r = 0.9 + R() * 1.8; g.fillStyle = "rgba(120,255,240,.3)"; g.beginPath(); g.arc(x, y, r * 2.8, 0, 6.3); g.fill(); g.fillStyle = "rgba(190,255,250,.96)"; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); } }
  noise(g, W, H, 2400, 0.1);
}, 1); if (rot) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; } return t; })());
function buildAlien(kind0: AlienKind, tint = 0): Rig {
  const kind = ((FAMILY[kind0] as AlienKind) || kind0) as AlienKind;
  const g = new THREE.Group(), legs: THREE.Object3D[] = [], arms: THREE.Object3D[] = [], mats: THREE.MeshStandardMaterial[] = [];
  const mk = (base: THREE.MeshStandardMaterial) => { const m = base.clone(); mats.push(m); return m; };
  const body = new THREE.Group(); g.add(body);
  if (kind === "skitter") {   // a roach-bug: flat glossy shell, long whip antennae, six fast spiky legs
    const m = mk(CHIT(0xa5622a, { roughness: 0.25, clearcoat: 1 })), m2 = mk(CHIT(0x5a3418));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), m); shell.scale.set(1.05, 0.5, 1.5); shell.position.set(0, 0.42, 0.1); body.add(shell);
    for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI), m2); w.scale.set(0.5, 0.4, 1.4); w.rotation.z = sd * 1.2; w.position.set(0.0, 0.62, 0.1); }
    for (const sd of [-1, 1]) { const wc = tube([V(0.05 * sd, 0.7, -0.35), V(0.3 * sd, 0.66, 0.2), V(0.26 * sd, 0.48, 0.95)], 0.2, 0.05, m, k => Math.sin(Math.PI * Math.min(1, k * 1.15) * 0.9 + 0.3), 20, 10); wc.scale.y = 0.55; body.add(wc); }   // two glossy wing cases that meet in the seam
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.045, 0.02, 6, 20, Math.PI), m2); b.rotation.set(Math.PI / 2, 0, Math.PI); b.scale.set(1.05, 1, 0.5); b.position.set(0, 0.55, 0.1 + i * 0.2); body.add(b); }   // segment bands over the abdomen
    const pron = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12), m2); pron.scale.set(1.05, 0.42, 0.55); pron.position.set(0, 0.55, -0.5); body.add(pron);   // the shield behind the head
    body.add(limb(V(0, 0.66, -0.55), V(0, 0.62, 0.85), 0.015, 0.015, m2));   // the seam down the back
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), m2); head.scale.set(1, 0.8, 1.1); head.position.set(0, 0.4, -0.68); body.add(head);
    body.add(eyes(GLOW(0xff3a1a), 0.48, -0.78, 0.1, 0.055)); body.add(mandibles(m2, 0.32, -0.8, 0.22, 0.07));
    for (const sd of [-1, 1]) body.add(antenna(m2, V(0.06 * sd, 0.5, -0.78), sd, 1.2));
    for (let i = 0; i < 6; i++) { const l = leg(0.34, 0.032, m2, 0.42); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 0.42, -0.3 + Math.floor(i / 2) * 0.35); l.rotation.y = (Math.floor(i / 2) - 1) * 0.35 * sd; g.add(l); legs.push(l); }
  } else if (kind === "mantis") {   // the warrior bug: tall armoured thorax, wedge head with mandibles, two saw-edged forelimbs raised, four stalking legs
    const m = mk(CHIT(0x7a7448)), m2 = mk(CHIT(0xa07a42)), dk = mk(CHIT(0x3a3822));
    const abd = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), m2); abd.scale.set(0.8, 0.75, 1.5); abd.position.set(0, 1.2, 0.95); abd.rotation.x = -0.25; body.add(abd);
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.42 - i * 0.03, 0.045, 6, 14), dk); r.position.set(0, 1.2 + i * 0.03, 0.55 + i * 0.3); r.rotation.y = Math.PI / 2; r.scale.set(1, 1, 1.1); body.add(r); }
    const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 10, 22), m); thorax.position.set(0, 1.45, -0.05); thorax.rotation.x = -0.55; body.add(thorax);
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dk); plate.scale.set(1, 0.7, 1.4); plate.position.set(0, 1.62, 0.0); plate.rotation.x = -0.3; body.add(plate);
    for (let i = 0; i < 5; i++) body.add(cone(0.05, 0.28, dk, V(0, 1.82 - i * 0.04, 0.2 - i * 0.2 + 0.1), [-0.5, 0, 0]));   // spines along the back
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), m); head.rotation.set(-Math.PI / 2 - 0.2, Math.PI / 4, 0); head.position.set(0, 1.95, -0.62); body.add(head);
    body.add(eyes(GLOW(0xff6a1a), 2.04, -0.5, 0.2, 0.09)); body.add(mandibles(dk, 1.78, -0.9, 0.5, 0.14));
    for (const sd of [-1, 1]) body.add(antenna(dk, V(0.1 * sd, 2.1, -0.55), sd, 0.9));
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.3 * sd, 1.72, -0.35);
      arm.add(limb(V(0, 0, 0), V(0.18 * sd, 0.18, -0.55), 0.09, 0.07, m)); const el = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), m); el.position.set(0.18 * sd, 0.18, -0.55); arm.add(el);
      arm.add(limb(V(0.18 * sd, 0.18, -0.55), V(0.12 * sd, -0.5, -0.95), 0.07, 0.025, dk));
      for (let i = 0; i < 6; i++) { const t = i / 6; arm.add(cone(0.04, 0.16, dk, V((0.18 - 0.06 * t) * sd + 0.06 * sd, 0.18 - 0.68 * t, -0.55 - 0.4 * t), [0, 0, sd * 1.4])); }   // the saw edge
      body.add(arm); arms.push(arm);
    }
    for (let i = 0; i < 4; i++) { const l = leg(0.85, 0.06, i % 2 ? m : m2, 1.18); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 1.18, 0.35 + Math.floor(i / 2) * 0.55); l.rotation.y = (Math.floor(i / 2) - 0.5) * 0.5 * sd; g.add(l); legs.push(l); }
  } else if (kind === "spitter") {   // the bloated plasma bug: a translucent glowing abdomen on stilt legs, a tube mouth
    const m = mk(SPIT), m2 = mk(CHIT(0x6a5630));
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x9fe84a, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, emissive: 0x48a020, emissiveIntensity: 0.6 })); sac.scale.set(1, 0.95, 1.2); sac.position.set(0, 1.25, 0.45); body.add(sac);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), GLOW(0xbaff3a)); core.position.set(0, 1.25, 0.5); body.add(core);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; body.add(limb(V(0, 1.25, 0.5), V(Math.cos(a) * 0.62, 1.25 + Math.sin(a) * 0.55, 0.5 + Math.sin(a * 2) * 0.3), 0.025, 0.012, GLOW(0x6aff2a))); }   // veins
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 16), m2); thorax.scale.set(1, 0.9, 1.1); thorax.position.set(0, 1.4, -0.45); body.add(thorax);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), m2); head.position.set(0, 1.5, -0.8); body.add(head);
    body.add(limb(V(0, 1.45, -0.95), V(0, 1.4, -1.4), 0.1, 0.06, m2)); body.add(cone(0.1, 0.18, GLOW(0xb6ff3a), V(0, 1.4, -1.46), [-Math.PI / 2, 0, 0]));
    body.add(eyes(GLOW(0xb6ff3a), 1.6, -0.95, 0.13, 0.06));
    for (let i = 0; i < 4; i++) { const l = leg(0.8, 0.055, m2, 1.1); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 1.1, -0.25 + Math.floor(i / 2) * 0.6); l.rotation.y = (Math.floor(i / 2) - 0.5) * 0.5 * sd; g.add(l); legs.push(l); }
  } else if (kind === "flarecaster") {
    const m = mk(CARAPACE2), m2 = mk(CARAPACE);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 10), m2); robe.position.y = 0.85; body.add(robe);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), m); chest.position.y = 1.55; chest.scale.set(1, 0.9, 0.9); body.add(chest);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), GLOW(0xff7a2a)); core.position.set(0, 1.55, -0.28); body.add(core);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), m); head.position.set(0, 2.05, -0.05); head.scale.set(0.9, 1.2, 1); body.add(head);
    for (const x of [-0.14, 0, 0.14]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), GLOW(0xff9a3a)); e.position.set(x, 2.1, -0.27); body.add(e); }
    for (const sd of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 6), m2); horn.position.set(0.16 * sd, 2.4, 0); horn.rotation.z = -sd * 0.4; body.add(horn);
      const arm = new THREE.Group(); arm.position.set(0.42 * sd, 1.75, -0.05); const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.85, 6), m); up.position.y = 0.4; up.rotation.z = -sd * 0.5; arm.add(up);
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), GLOW(0xffb040)); fire.position.set(-sd * 0.2, 0.85, 0); arm.add(fire); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 2; i++) { const l = leg(0.8, 0.07, m); l.position.set(i ? 0.2 : -0.2, 0.85, 0.1); l.rotation.z = 0; g.add(l); legs.push(l); }
  } else if (kind === "charger") {
    const m = mk(CHIT(0x55603e)), m2 = mk(CHIT(0xa88a52, { roughness: 0.28 }));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m2); shell.scale.set(1.15, 0.95, 1.5); shell.position.y = 0.55; body.add(shell);
    for (let i = 0; i < 4; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.7 - i * 0.12, 0.09, 0.28), m); pl.position.set(0, 1.0 - i * 0.07 + 0.05, -0.55 + i * 0.5); pl.rotation.x = 0.12; body.add(pl); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), m); head.position.set(0, 0.62, -1.25); body.add(head);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.85, 8), m2); horn.rotation.x = -Math.PI / 2 + 0.25; horn.position.set(0, 0.7, -1.8); body.add(horn);
    for (const x of [-0.2, 0.2]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), GLOW(0xff3a2a)); e.position.set(x, 0.78, -1.58); body.add(e); }
    const weak = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), GLOW(0xff8a2a)); weak.position.set(0, 0.75, 1.42); weak.rotation.y = Math.PI; body.add(weak);   // the exposed rear weak spot
    for (let i = 0; i < 6; i++) { const l = leg(0.7, 0.08, m, 0.62); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.55 * sd, 0.62, -0.8 + Math.floor(i / 2) * 0.8); l.rotation.y = (Math.floor(i / 2) - 1) * 0.3 * sd; g.add(l); legs.push(l); }
  } else if (kind === "skyeye") {
    const m = mk(SPIT);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.25 })); eye.position.y = 2.6; body.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), GLOW(0xb06aff)); iris.position.set(0, 2.6, -0.52); body.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0x08040f })); pupil.position.set(0, 2.6, -0.82); body.add(pupil);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.07, 6, 18), m); lid.position.set(0, 2.6, -0.1); lid.rotation.y = Math.PI / 2; body.add(lid);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * 0.35, 2.2, Math.sin(a) * 0.35); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.015, 1.1 + (i % 3) * 0.25, 5), m); c.position.y = -0.55; t.add(c); body.add(t); arms.push(t); }
  } else if (kind === "scarab") {   // a small domed beetle: the swarm race's fodder
    const m = mk(CHIT(0x3f8a2c, { roughness: 0.2, clearcoat: 1 })), m2 = mk(CHIT(0x1c3a14));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); shell.scale.set(1, 0.85, 1.3); shell.position.set(0, 0.34, 0.05); body.add(shell);
    body.add(limb(V(0, 0.72, -0.5), V(0, 0.7, 0.62), 0.014, 0.014, m2));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), m2); head.position.set(0, 0.3, -0.62); body.add(head); body.add(eyes(GLOW(0xff2a1a), 0.36, -0.72, 0.08, 0.045));
    for (let i = 0; i < 6; i++) { const l = leg(0.3, 0.028, m2, 0.34); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 0.34, -0.25 + Math.floor(i / 2) * 0.3); g.add(l); legs.push(l); }
  } else if (kind === "behemoth") {   // a walking fortress: slab shoulders, a tiny head, two pillar legs and two wrecking arms
    const m = mk(CHIT(0x6a5a78, { roughness: 0.4, metalness: 0.35 })), m2 = mk(CHIT(0x2a2034, { roughness: 0.5 }));
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.1), m); torso.position.y = 1.75; body.add(torso);
    for (const sd of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 1.3), m2); pl.position.set(1.05 * sd, 2.6, 0); pl.rotation.z = -sd * 0.25; body.add(pl); body.add(cone(0.14, 0.7, m2, V(1.1 * sd, 2.95, 0), [0, 0, -sd * 0.3])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), m2); head.position.set(0, 2.7, -0.2); body.add(head); body.add(eyes(GLOW(0xff3aa0), 2.72, -0.5, 0.14, 0.07));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), GLOW(0xff3aa0)); core.position.set(0, 1.8, -0.58); body.add(core);
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(1.0 * sd, 2.3, 0); arm.add(limb(V(0, 0, 0), V(0.1 * sd, -1.0, -0.4), 0.28, 0.22, m)); const fist = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), m2); fist.position.set(0.1 * sd, -1.15, -0.45); arm.add(fist); body.add(arm); arms.push(arm); }
    for (const sd of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0.55 * sd, 1.0, 0); lg.add(limb(V(0, 0, 0), V(0, -1.0, 0), 0.3, 0.25, m2)); const ft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.9), m); ft.position.set(0, -1.0, -0.15); lg.add(ft); g.add(lg); legs.push(lg); }
  } else if (kind === "wisp") {   // a floating spirit: a bright core in a thin shell, rings turning round it, ribbon tails
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), GLOW(0xb0f0ff)); core.position.y = 2.4; body.add(core);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x80d0ff, transparent: true, opacity: 0.28, roughness: 0.1, clearcoat: 1 })); shell.position.y = 2.4; body.add(shell);
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 6, 24), GLOW(0x9ae0ff)); r.position.y = 2.4; r.rotation.set(i ? 1.2 : 0.3, i * 0.9, 0); body.add(r); }
    for (let i = 0; i < 5; i++) { const t = new THREE.Group(); t.position.set(Math.cos(i * 1.26) * 0.25, 2.1, Math.sin(i * 1.26) * 0.25); const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.3, 6), GLOW(0x70c8ff)); c.position.y = -0.65; c.rotation.x = Math.PI; t.add(c); body.add(t); arms.push(t); }
    body.add(eyes(GLOW(0xffffff), 2.45, -0.6, 0.16, 0.06));
  } else if (kind === "drone") {   // a machine: a hovering armoured sphere on two piston legs, a single lens, side cannons
    const m = mk(MAT(0x6a7a8c, { metalness: 0.85, roughness: 0.28 }) as any), m2 = mk(MAT(0x2a3038, { metalness: 0.8, roughness: 0.4 }) as any);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), m); orb.position.y = 1.55; body.add(orb);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.07, 8, 24), m2); band.position.y = 1.55; band.rotation.x = Math.PI / 2; body.add(band);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), GLOW(0x35e0ff)); lens.position.set(0, 1.6, -0.5); body.add(lens);
    for (const sd of [-1, 1]) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 8), m2); cn.rotation.x = Math.PI / 2; cn.position.set(0.62 * sd, 1.45, -0.35); body.add(cn); const arm = new THREE.Group(); arm.position.set(0.5 * sd, 1.9, 0); arm.add(limb(V(0, 0, 0), V(0.1 * sd, 0.5, 0), 0.03, 0.03, m2)); body.add(arm); arms.push(arm); }
    for (const sd of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0.28 * sd, 1.0, 0.1); lg.add(limb(V(0, 0, 0), V(0.15 * sd, -1.0, 0), 0.06, 0.04, m2)); g.add(lg); legs.push(lg); }
  } else if (kind === "stalker") {   // a lean hunter: long body, blade crest, two scythe arms, a stinger tail
    const m = mk(CHIT(0x3a5a6a, { roughness: 0.22 })), m2 = mk(CHIT(0x14222c));
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 10, 22), m); torso.position.set(0, 1.35, 0); torso.rotation.x = 0.5; body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), m2); head.scale.set(0.9, 0.8, 1.4); head.position.set(0, 1.95, -0.55); body.add(head);
    for (let i = 0; i < 4; i++) body.add(cone(0.05, 0.45, m2, V(0, 2.1 - i * 0.05, -0.3 + i * 0.16), [-0.9, 0, 0]));
    body.add(eyes(GLOW(0xffe03a), 2.0, -0.78, 0.12, 0.05));
    body.add(limb(V(0, 1.0, 0.35), V(0, 0.55, 1.2), 0.1, 0.02, m2)); body.add(cone(0.06, 0.3, GLOW(0xffe03a), V(0, 0.5, 1.3), [Math.PI * 0.6, 0, 0]));
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.22 * sd, 1.7, -0.3); arm.add(limb(V(0, 0, 0), V(0.25 * sd, 0.1, -0.7), 0.06, 0.04, m)); arm.add(limb(V(0.25 * sd, 0.1, -0.7), V(0.15 * sd, -0.7, -1.05), 0.05, 0.01, m2)); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 2; i++) { const l = leg(0.7, 0.06, m2, 1.0); const sd = i ? 1 : -1; l.scale.x = sd; l.position.set(0.18 * sd, 1.05, 0.15); g.add(l); legs.push(l); }
  } else if (kind === "warden") {   // boss: a hive knight, a crowned dome shell, four stamping legs, a molten core
    const m = mk(CHIT(0x5a6a88, { roughness: 0.3, metalness: 0.3 })), m2 = mk(CHIT(0x22283a));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); shell.scale.set(1.2, 1.1, 1.5); shell.position.y = 1.0; body.add(shell);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; body.add(cone(0.12, 0.8, m2, V(Math.cos(a) * 0.85, 2.0, Math.sin(a) * 1.1), [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), m2); head.position.set(0, 1.0, -1.7); body.add(head); body.add(eyes(GLOW(0x9fe8ff), 1.1, -2.1, 0.22, 0.1));
    body.add(cone(0.22, 1.2, m, V(0, 1.1, -2.5), [-Math.PI / 2 + 0.2, 0, 0]));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), GLOW(0x9fe8ff)); core.position.set(0, 1.8, 0.4); body.add(core);
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(1.2 * sd, 1.1, -0.8); arm.add(limb(V(0, 0, 0), V(0.5 * sd, -0.2, -0.9), 0.2, 0.15, m)); arm.add(cone(0.22, 0.9, m2, V(0.6 * sd, -0.3, -1.3), [-Math.PI / 2, 0, 0])); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 4; i++) { const l = leg(0.8, 0.12, m2, 0.95); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.9 * sd, 0.95, -0.5 + Math.floor(i / 2) * 1.2); g.add(l); legs.push(l); }
  } else if (kind === "matriarch") {   // boss: a broad robed queen ringed with glowing egg sacs and a crown of horns
    const m = mk(CARAPACE2), m2 = mk(CHIT(0x6a1a14));
    const robe = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 14), m2); robe.position.y = 1.2; body.add(robe);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), m); chest.position.y = 2.3; body.add(chest);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), GLOW(0xff6a2a)); core.position.set(0, 2.3, -0.42); body.add(core);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), m); head.position.set(0, 3.0, -0.05); head.scale.set(0.9, 1.2, 1); body.add(head); body.add(eyes(GLOW(0xffb03a), 3.05, -0.3, 0.12, 0.06));
    for (let i = 0; i < 7; i++) { const a = (i - 3) / 7 * 1.6; body.add(cone(0.07, 0.7, m2, V(Math.sin(a) * 0.4, 3.45, 0), [0, 0, -a * 0.9])); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sac = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), GLOW(i % 2 ? 0xff7a2a : 0xffb03a)); sac.position.set(Math.cos(a) * 0.95, 0.5 + (i % 3) * 0.25, Math.sin(a) * 0.95); body.add(sac); }
    for (const sd of [-1, 1]) for (const k of [0, 1]) { const arm = new THREE.Group(); arm.position.set(0.55 * sd, 2.4 - k * 0.35, 0); arm.add(limb(V(0, 0, 0), V(0.7 * sd, 0.2 + k * 0.1, -0.5), 0.07, 0.05, m)); const fire = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), GLOW(0xffb040)); fire.position.set(0.8 * sd, 0.3, -0.55); arm.add(fire); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 2; i++) { const l = leg(0.9, 0.09, m2, 1.1); l.position.set(i ? 0.3 : -0.3, 1.1, 0.1); g.add(l); legs.push(l); }
  } else if (kind === "walker") {   // final boss: a tripod war machine, a great eye in an armoured hull
    const m = mk(MAT(0x4a3a5a, { metalness: 0.8, roughness: 0.3 }) as any), m2 = mk(MAT(0x1c1226, { metalness: 0.7, roughness: 0.4 }) as any);
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), m); hull.position.y = 3.4; hull.scale.set(1.2, 0.9, 1.2); body.add(hull);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 32), GLOW(0xff4fd8)); ring.position.y = 3.4; ring.rotation.x = Math.PI / 2; body.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffe8f8, emissive: 0xff4fd8, emissiveIntensity: 0.8, roughness: 0.2 })); eye.position.set(0, 3.4, -1.1); body.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshBasicMaterial({ color: 0x14041c })); pup.position.set(0, 3.4, -1.75); body.add(pup);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; body.add(cone(0.14, 0.9, m2, V(Math.cos(a) * 1.4, 4.2, Math.sin(a) * 1.4), [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5])); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const l = leg(1.2, 0.17, m2, 3.2); l.position.set(Math.cos(a) * 1.0, 3.2, Math.sin(a) * 1.0); l.rotation.y = -a + Math.PI / 2; g.add(l); legs.push(l); }
  } else if (kind === "glowbug") {   // Luma: a night beetle, dark shell freckled with glowing teal spots and a lantern abdomen
    const m = mk(CHIT(0x1c3a3a, { roughness: 0.25, clearcoat: 1 })), m2 = mk(CHIT(0x0c1c20));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), m); shell.scale.set(1, 0.6, 1.3); shell.position.set(0, 0.4, 0.05); body.add(shell);
    for (let i = 0; i < 7; i++) { const a = i * 2.4, s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), GLOW(0x5affd0)); s.position.set(Math.cos(a) * 0.28, 0.62 + Math.sin(a * 1.7) * 0.03, 0.05 + Math.sin(a) * 0.5); body.add(s); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), GLOW(0x7affc8)); lamp.position.set(0, 0.42, 0.75); body.add(lamp);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x5affc8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(1.6, 1.6, 1); sp.position.set(0, 0.45, 0.75); body.add(sp);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), m2); head.position.set(0, 0.36, -0.66); body.add(head); body.add(eyes(GLOW(0xff7ae0), 0.42, -0.78, 0.1, 0.05)); body.add(mandibles(m2, 0.3, -0.8, 0.2, 0.07));
    for (let i = 0; i < 6; i++) { const l = leg(0.32, 0.03, m2, 0.38); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 0.38, -0.25 + Math.floor(i / 2) * 0.33); g.add(l); legs.push(l); }
  } else if (kind === "thornback") {   // Luma: an armoured jungle brute, a ridge of glowing magenta thorns down its back
    const m = mk(CHIT(0x3a4a2a, { roughness: 0.4 })), m2 = mk(CHIT(0x1a2412));
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), m); torso.scale.set(1, 0.8, 1.55); torso.position.set(0, 0.95, 0.1); body.add(torso);
    for (let i = 0; i < 9; i++) { const z = -0.7 + i * 0.22, h = 0.5 + Math.sin(i / 8 * Math.PI) * 0.45; body.add(cone(0.1, h, GLOW(0xff4fd0), V(0, 1.55 + h * 0.2, z), [0.08, 0, 0])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), m2); head.scale.set(0.95, 0.8, 1.2); head.position.set(0, 0.85, -1.15); body.add(head);
    for (const sd of [-1, 1]) { body.add(cone(0.1, 0.6, m2, V(0.28 * sd, 1.15, -1.3), [-1.0, 0, -sd * 0.4])); }
    body.add(eyes(GLOW(0xffb04a), 0.95, -1.5, 0.17, 0.07));
    for (let i = 0; i < 4; i++) { const l = leg(0.6, 0.1, m2, 0.82); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.5 * sd, 0.82, -0.5 + Math.floor(i / 2) * 1.0); g.add(l); legs.push(l); }
  } else if (kind === "sporecaster") {   // Luma: a walking mushroom: a speckled glowing cap, a stalk body, dangling spore sacs
    const m = mk(CHIT(0xc080e0, { roughness: 0.5 })), m2 = mk(CHIT(0x6a4a7a));
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.3, 10), m2); stalk.position.y = 0.95; body.add(stalk);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); cap.position.y = 1.55; cap.scale.set(1, 0.7, 1); body.add(cap);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.25 + (i % 3) * 0.2; const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), GLOW(i % 2 ? 0xff9aff : 0x9affea)); s.position.set(Math.cos(a) * rr, 1.55 + Math.sqrt(Math.max(0, 0.6 - rr * rr)) * 0.5, Math.sin(a) * rr); body.add(s); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.05, 6, 24), GLOW(0xff7aff)); rim.position.y = 1.52; rim.rotation.x = Math.PI / 2; body.add(rim);
    body.add(eyes(GLOW(0xffffff), 1.1, -0.34, 0.14, 0.08));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * 0.55, 1.5, Math.sin(a) * 0.55); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.8, 5), m2); c.position.y = -0.4; t.add(c); const sac = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), GLOW(0x9affea)); sac.position.y = -0.85; t.add(sac); body.add(t); arms.push(t); }
    for (let i = 0; i < 3; i++) { const l = leg(0.55, 0.08, m2, 0.7); l.position.set(Math.cos(i * 2.1) * 0.25, 0.7, Math.sin(i * 2.1) * 0.25); l.rotation.y = i * 2.1; g.add(l); legs.push(l); }
  } else if (kind === "hound") {   // Luma: a lean shadow predator on four long legs, a long jaw and glowing stripes
    const m = mk(CHIT(0x14202a, { roughness: 0.3 })), m2 = mk(CHIT(0x070c12));
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.95, 10, 22), m); torso.rotation.x = Math.PI / 2; torso.position.set(0, 0.85, 0.05); body.add(torso);
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 5, 14), GLOW(0x5aa8ff)); st.position.set(0, 0.85, -0.3 + i * 0.28); st.rotation.y = Math.PI / 2; body.add(st); }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 8), m2); head.rotation.x = -Math.PI / 2; head.position.set(0, 0.95, -0.95); body.add(head);
    body.add(eyes(GLOW(0x5aa8ff), 1.02, -0.78, 0.13, 0.06));
    body.add(limb(V(0, 0.9, 0.5), V(0, 0.75, 1.15), 0.09, 0.02, m));
    for (let i = 0; i < 4; i++) { const l = leg(0.5, 0.06, m2, 0.82); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.22 * sd, 0.82, -0.35 + Math.floor(i / 2) * 0.85); g.add(l); legs.push(l); }
  } else if (kind === "lumawarden") {   // Luma boss: a towering thornback crowned with glowing crystals, a lit core in the chest
    const m = mk(CHIT(0x2c4a28, { roughness: 0.38 })), m2 = mk(CHIT(0x101c10));
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 16), m); torso.scale.set(1.05, 0.9, 1.5); torso.position.set(0, 1.25, 0.1); body.add(torso);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), GLOW(0xff4fd0)); core.position.set(0, 1.3, -1.35); body.add(core);
    for (let i = 0; i < 11; i++) { const z = -0.9 + i * 0.22, h = 0.8 + Math.sin(i / 10 * Math.PI) * 0.8; body.add(cone(0.14, h, GLOW(i % 2 ? 0xff4fd0 : 0x5affd0), V(0, 2.05 + h * 0.2, z), [0.1, 0, 0])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), m2); head.scale.set(1, 0.85, 1.2); head.position.set(0, 1.2, -1.7); body.add(head);
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.42; body.add(cone(0.09, 0.9, GLOW(0x9affea), V(Math.sin(a) * 0.5, 1.75, -1.7), [-0.4, 0, -a * 0.8])); }
    body.add(eyes(GLOW(0xffd04a), 1.3, -2.0, 0.2, 0.09));
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.9 * sd, 1.5, -0.5); arm.add(limb(V(0, 0, 0), V(0.2 * sd, -0.8, -0.7), 0.2, 0.14, m)); arm.add(cone(0.16, 0.8, m2, V(0.2 * sd, -0.9, -0.95), [-1.3, 0, 0])); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 4; i++) { const l = leg(0.85, 0.15, m2, 1.08); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.7 * sd, 1.08, -0.6 + Math.floor(i / 2) * 1.3); g.add(l); legs.push(l); }
  } else if (kind === "leaper") {   // a spider-crab: a small armoured body on long arched legs, a ring of glowing eyes
    const m = mk(CHIT(0x6a2a6a, { roughness: 0.3, clearcoat: 1 })), m2 = mk(CHIT(0x24102a));
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), m); sh.scale.set(1.1, 0.7, 1.2); sh.position.set(0, 0.6, 0); body.add(sh);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; body.add(eyes(GLOW(0xffe04a), 0.68, -0.28, 0.06 + (i % 2) * 0.05, 0.028)); void a; }
    for (let i = 0; i < 8; i++) { const l = leg(0.42, 0.03, m2, 0.6); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.22 * sd, 0.6, -0.3 + Math.floor(i / 2) * 0.2); g.add(l); legs.push(l); }
    body.add(cone(0.06, 0.5, m2, V(0, 0.75, 0.4), [1.4, 0, 0]));
  } else if (kind === "spiker") {   // a hunched imp: spined back, long arms ending in glowing claws, a horned skull
    const m = mk(CHIT(0x7a3a24, { roughness: 0.5 })), m2 = mk(CHIT(0x2a1410));
    const tor = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), m); tor.scale.set(1, 1.15, 0.85); tor.position.set(0, 1.35, 0.05); tor.rotation.x = 0.35; body.add(tor);
    for (let i = 0; i < 7; i++) body.add(cone(0.08, 0.5 + (i % 3) * 0.12, m2, V(0, 1.2 + i * 0.12, 0.45 - i * 0.05), [-0.7, 0, 0]));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), m); head.position.set(0, 2.05, -0.3); body.add(head);
    for (const sd of [-1, 1]) { body.add(cone(0.07, 0.55, m2, V(0.22 * sd, 2.35, -0.3), [0, 0, -sd * 0.5])); }
    body.add(eyes(GLOW(0xff7a2a), 2.08, -0.55, 0.12, 0.06));
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.55 * sd, 1.7, -0.1); arm.add(limb(V(0, 0, 0), V(0.2 * sd, -0.8, -0.5), 0.12, 0.09, m)); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), GLOW(0xff7a2a)); orb.position.set(0.2 * sd, -0.9, -0.65); arm.add(orb); body.add(arm); arms.push(arm); }
    for (const sd of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0.3 * sd, 0.9, 0.1); lg.add(limb(V(0, 0, 0), V(0.05 * sd, -0.45, -0.25), 0.15, 0.1, m2)); lg.add(limb(V(0.05 * sd, -0.45, -0.25), V(0, -0.9, 0.05), 0.1, 0.07, m2)); g.add(lg); legs.push(lg); }
  } else if (kind === "veilmaw") {   // a floating jellyfish: a glowing translucent bell, a toothed maw, long trailing tentacles
    const bell = mk(CHIT(0x4a2a8a, { roughness: 0.15, clearcoat: 1 })); (bell as any).transparent = true; (bell as any).opacity = 0.78;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), bell); b.position.set(0, 2.5, 0); b.scale.set(1, 0.85, 1); body.add(b);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), GLOW(0xc06aff)); core.position.set(0, 2.45, 0); body.add(core);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * 0.7, 2.2, Math.sin(a) * 0.7); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.01, 1.8 + (i % 3) * 0.5, 5), GLOW(i % 2 ? 0x9a5aff : 0x5affd0)); c.position.y = -0.9; t.add(c); body.add(t); arms.push(t); }
    body.add(eyes(GLOW(0xffd0ff), 2.3, -0.8, 0.28, 0.07));
  } else if (kind === "bloater") {   // a bloated slug-brute: a swollen sac glowing with pustules, tiny arms, a drooling maw
    const m = mk(CHIT(0x6a8a3a, { roughness: 0.35, clearcoat: 0.6 })), m2 = mk(CHIT(0x2a3a14));
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), m); sac.scale.set(1.1, 0.95, 1.35); sac.position.set(0, 0.95, 0.15); body.add(sac);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, y = 0.9 + Math.sin(i * 1.7) * 0.45; const pu = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (i % 3) * 0.04, 10, 8), GLOW(0xd8ff3a)); pu.position.set(Math.cos(a) * 0.8, y, 0.15 + Math.sin(a) * 1.1); body.add(pu); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), m2); head.position.set(0, 0.8, -1.2); body.add(head); body.add(eyes(GLOW(0xd8ff3a), 0.95, -1.5, 0.16, 0.07));
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.7 * sd, 0.7, -0.7); arm.add(limb(V(0, 0, 0), V(0.3 * sd, -0.2, -0.5), 0.14, 0.1, m2)); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 4; i++) { const l = leg(0.5, 0.09, m2, 0.5); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.55 * sd, 0.5, -0.2 + Math.floor(i / 2) * 0.9); g.add(l); legs.push(l); }
  } else if (kind === "razor") {   // a gaunt sprinter on backward-jointed legs with two blade arms and a bladed tail
    const m = mk(CHIT(0x2a4a5a, { roughness: 0.25, metalness: 0.4 })), m2 = mk(CHIT(0x0c1a22, { metalness: 0.5 }));
    const tor = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 10, 22), m); tor.position.set(0, 1.55, 0); tor.rotation.x = 0.5; body.add(tor);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), m2); head.position.set(0, 2.15, -0.5); head.rotation.x = -1.2; body.add(head); body.add(eyes(GLOW(0x2affd0), 2.2, -0.72, 0.1, 0.05));
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.3 * sd, 1.85, -0.2); arm.add(limb(V(0, 0, 0), V(0.15 * sd, -0.5, -0.5), 0.07, 0.05, m)); arm.add(cone(0.07, 1.3, GLOW(0x7affea), V(0.1 * sd, -0.4, -1.1), [Math.PI / 2 + 0.2, 0, 0])); body.add(arm); arms.push(arm); }
    body.add(limb(V(0, 1.2, 0.3), V(0, 0.6, 1.4), 0.1, 0.02, m2)); body.add(cone(0.1, 0.7, GLOW(0x7affea), V(0, 0.5, 1.7), [1.9, 0, 0]));
    for (const sd of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0.25 * sd, 1.1, 0); lg.add(limb(V(0, 0, 0), V(0.05 * sd, -0.5, 0.35), 0.1, 0.07, m2)); lg.add(limb(V(0.05 * sd, -0.5, 0.35), V(0.02 * sd, -1.05, -0.1), 0.07, 0.04, m2)); g.add(lg); legs.push(lg); }
  } else if (kind === "titan") {   // boss: a horned hive colossus with a glowing ribcage, shoulder cannons and a molten crown
    const m = mk(CHIT(0x3a2a44, { roughness: 0.35, metalness: 0.3 })), m2 = mk(CHIT(0x120a1a));
    const tor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.9, 1.1), m); tor.position.set(0, 2.2, 0); body.add(tor);
    for (let i = 0; i < 4; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.1), GLOW(0xff3a8a)); rib.position.set(0, 1.75 + i * 0.3, -0.58); body.add(rib); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), m2); head.position.set(0, 3.45, -0.15); body.add(head); body.add(eyes(GLOW(0xff3a8a), 3.5, -0.58, 0.2, 0.1));
    for (const sd of [-1, 1]) { body.add(cone(0.14, 1.3, m2, V(0.4 * sd, 4.0, -0.1), [0, 0, -sd * 0.45])); const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.9, 10), m2); can.position.set(1.25 * sd, 3.1, -0.3); can.rotation.x = Math.PI / 2; body.add(can); { const mz = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), GLOW(0xff3a8a)); mz.position.set(1.25 * sd, 3.1, -0.78); body.add(mz); } }
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(1.05 * sd, 2.9, 0); arm.add(limb(V(0, 0, 0), V(0.3 * sd, -1.3, -0.5), 0.3, 0.24, m)); const fist = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), m2); fist.position.set(0.3 * sd, -1.45, -0.6); arm.add(fist); body.add(arm); arms.push(arm); }
    for (const sd of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0.55 * sd, 1.3, 0); lg.add(limb(V(0, 0, 0), V(0, -1.3, 0), 0.34, 0.28, m2)); g.add(lg); legs.push(lg); }
  } else if (kind === "capling") {   // reference 3: a hammerhead alien: a broad flat cap over a narrow face with big white slit eyes, a muscular mottled torso, thick orange forearms and long thin shins ending in hanging claws
    // mats are recoloured by creation order (0 blue-violet, 1 maroon, 2 orange, 3 maroon, 4 blue-violet): cap, torso, orange limbs, muscle bands, face
    const cap = mk(CHIT(0x3e4468, { roughness: 0.4, clearcoat: 0.8 })), mt = mk(CHIT(0x6a2a3e, { roughness: 0.55 })), or = mk(CHIT(0xe0761c, { roughness: 0.45 })), mb = mk(CHIT(0x7a3048, { roughness: 0.5 })), sk = mk(CHIT(0x4a4a6a, { roughness: 0.5 }));
    const dk = CHIT(0x120c18, { roughness: 0.3, metalness: 0.4 });   // lacquered black claws and spurs (not recoloured)
    const HIP = 1.2, sd2 = [-1, 1];
    // the hammerhead: a swept, drooping, bevelled slab that sits right on the skull and overhangs the face
    const csh = new THREE.Shape(); csh.moveTo(0, 0.26); csh.bezierCurveTo(0.35, 0.3, 0.8, 0.2, 0.93, 0.06); csh.bezierCurveTo(0.99, -0.02, 0.97, -0.12, 0.88, -0.15); csh.bezierCurveTo(0.6, -0.1, 0.4, -0.3, 0, -0.3);
    csh.bezierCurveTo(-0.4, -0.3, -0.6, -0.1, -0.88, -0.15); csh.bezierCurveTo(-0.97, -0.12, -0.99, -0.02, -0.93, 0.06); csh.bezierCurveTo(-0.8, 0.2, -0.35, 0.3, 0, 0.26);
    const cg = new THREE.ExtrudeGeometry(csh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 14 }); cg.rotateX(-Math.PI / 2); cg.scale(0.86, 1, 0.92);
    { const p = cg.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.05 + (p.getY(i) - 0.05) * (1 - 0.42 * Math.min(1, Math.abs(x) / 0.8)) - 0.15 * x * x - 0.04 * Math.max(0, -z)); } cg.computeVertexNormals(); }
    const cp = new THREE.Mesh(cg, cap); cp.position.set(0, 2.33, -0.1); cp.rotation.x = -0.08; body.add(cp);
    const capY = (x: number, z: number) => 2.33 + 0.17 - 0.15 * x * x + z * 0.08;   // top surface height at a point of the cap
    body.add(tube([V(0, capY(0, 0.16) + 0.0, 0.18), V(0, capY(0, -0.05) + 0.02, -0.04), V(0, capY(0, -0.28), -0.28)], 0.045, 0.02, cap, undefined, 12, 7));   // a central crest
    for (const s of sd2) for (const a of [0.15, 0.3, 0.45]) body.add(tube([V(s * a, capY(a, 0.1) + 0.01, 0.12 - a * 0.1), V(s * (a + 0.12), capY(a + 0.12, 0.0) + 0.012, -0.06 - a * 0.05), V(s * (a + 0.24), capY(a + 0.24, -0.1) + 0.01, -0.2 - a * 0.08)], 0.016, 0.008, cap, undefined, 8, 5));   // ridges fanning out along the wings
    for (const s of sd2) for (let i = 0; i < 6; i++) { const x = s * (0.2 + i * 0.1), pit = new THREE.Mesh(new THREE.SphereGeometry(0.02 - i * 0.001, 8, 6), GLOW(0xff9a3a)); pit.position.set(x, capY(x, -0.22 + Math.abs(x) * 0.12) + 0.004, -0.22 + Math.abs(x) * 0.12 - 0.14); body.add(pit); }   // sensor pits along the leading edge
    // narrow face under the cap: a skull, a long wedge snout, a small jaw
    const sl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 22, 16), sk); sl.scale.set(1.1, 0.95, 1.35); sl.position.set(0, 2.2, -0.08); body.add(sl);
    body.add(tube([V(0, 2.22, -0.18), V(0, 2.14, -0.36), V(0, 2.02, -0.55)], 0.15, 0.05, sk, undefined, 14, 10));   // snout
    body.add(tube([V(0, 2.0, -0.2), V(0, 1.86, -0.36), V(0, 1.78, -0.56)], 0.085, 0.03, mb, undefined, 10, 8));   // a dropped lower jaw: the glowing throat shows between it and the snout
    for (const y of [1.56, 1.7, 1.84]) { const bl = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), GLOW(0xff9a3a)); bl.position.set(0, y, -0.2); body.add(bl); }   // a line of bio-lights down the breastbone
    body.add(tube([V(0, 2.1, -0.52), V(0, 2.02, -0.55), V(0, 1.94, -0.54)], 0.03, 0.02, dk, undefined, 6, 6));   // nostril bridge
    for (const s of sd2) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), GLOW(0xf6fbff)); e.scale.set(1.7, 0.55, 0.55); e.position.set(0.2 * s, 2.2, -0.29); e.rotation.z = s * 0.42; e.rotation.y = s * 0.25; body.add(e);   // the big white slit eye, slanted
      const br = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), sk); br.scale.set(1.9, 0.38, 0.8); br.position.set(0.17 * s, 2.285, -0.27); br.rotation.z = s * 0.34; body.add(br);   // brow ridge
      const ck = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mb); ck.scale.set(1, 0.7, 1.2); ck.position.set(0.15 * s, 2.06, -0.22); body.add(ck);
    }
    // neck, trapezius, shoulders
    body.add(tube([V(0, 1.92, 0.02), V(0, 2.04, -0.01), V(0, 2.14, -0.06)], 0.1, 0.085, sk, undefined, 8, 8));
    for (const s of sd2) { body.add(tube([V(0.05 * s, 2.02, 0.0), V(0.2 * s, 1.97, 0.0), V(0.36 * s, 1.9, 0.0)], 0.07, 0.11, mt, undefined, 8, 8)); const dl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mt); dl.scale.set(1, 0.85, 0.95); dl.position.set(0.42 * s, 1.88, 0); body.add(dl); }
    // a V-shaped torso: broad chest, narrow waist, ribs and abdominal plates
    const to = tube([V(0, 1.2, 0.03), V(0, 1.55, 0.0), V(0, 1.93, -0.02)], 0.2, 0.36, mt, (k) => 1 + 0.05 * Math.sin(k * 6) - 0.1 * (1 - k) * (1 - k), 18, 14); to.scale.z = 0.76; body.add(to);
    for (const s of sd2) { const pc = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mb); pc.scale.set(1.1, 0.85, 0.7); pc.position.set(0.17 * s, 1.78, -0.15); body.add(pc); for (let i = 0; i < 3; i++) { const ab = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mb); ab.scale.set(1.1, 0.7, 0.55); ab.position.set(0.07 * s, 1.34 + i * 0.13, -0.15 - 0.005 * i); body.add(ab); } }
    for (let i = 0; i < 4; i++) { const rb = new THREE.Mesh(new THREE.TorusGeometry(0.27 - i * 0.012, 0.014, 6, 20, Math.PI * 0.9), dk); rb.position.set(0, 1.6 + i * 0.08, 0.0); rb.rotation.set(-Math.PI / 2, 0, Math.PI * 1.05); rb.scale.set(1, 0.76, 1); body.add(rb); }
    for (let i = 0; i < 6; i++) body.add(cone(0.026, 0.16 - i * 0.012, dk, V(0, 1.86 - i * 0.12, 0.24), [0.9, 0, 0]));   // back spines
    const pel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mt); pel.scale.set(1.15, 0.65, 0.8); pel.position.set(0, HIP, 0.01); body.add(pel);
    body.add(tube([V(0, 1.14, 0.14), V(0, 0.95, 0.5), V(0.05, 0.9, 0.9)], 0.07, 0.01, mt, undefined, 12, 6));   // a short tail
    // arms: thick orange forearms ending in hanging claws
    for (const s of sd2) {
      const arm = new THREE.Group(); arm.position.set(0.42 * s, 1.88, 0);
      arm.add(tube([V(0, 0, 0), V(0.07 * s, -0.22, -0.02), V(0.12 * s, -0.46, -0.07)], 0.12, 0.095, or, (k) => 1 + 0.25 * Math.sin(k * 3.1), 12, 12));
      const el = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mb); el.position.set(0.12 * s, -0.46, -0.07); arm.add(el);
      arm.add(cone(0.035, 0.16, dk, V(0.15 * s, -0.46, 0.06), [Math.PI / 2, 0, 0]));   // elbow spur
      arm.add(tube([V(0.12 * s, -0.46, -0.07), V(0.1 * s, -0.7, -0.12), V(0.08 * s, -0.9, -0.16)], 0.11, 0.055, or, (k) => 1 + 0.35 * Math.sin(k * 3.1), 12, 12));   // thick forearm
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), mb); hd.scale.set(1, 1.1, 0.8); hd.position.set(0.08 * s, -0.92, -0.16); arm.add(hd);
      for (const k of [-1.5, -0.5, 0.5, 1.5]) arm.add(tube([V((0.08 + k * 0.035) * s, -0.95, -0.16), V((0.08 + k * 0.05) * s, -1.12, -0.17), V((0.08 + k * 0.05) * s, -1.3, -0.25)], 0.024, 0.004, dk, undefined, 8, 5));   // four long hanging claws
      body.add(arm); arms.push(arm);
    }
    // legs: a heavy orange thigh, a big knee, a long thin shin, a clawed foot that stands on the floor
    for (const s of sd2) {
      const lg = new THREE.Group(); lg.position.set(0.2 * s, HIP, 0);
      lg.add(tube([V(0, 0, 0), V(0.05 * s, -0.28, -0.1), V(0.1 * s, -0.52, -0.22)], 0.135, 0.095, or, (k) => 1 + 0.3 * Math.sin(k * 3.1), 12, 12));
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mb); kn.position.set(0.1 * s, -0.53, -0.22); lg.add(kn);
      lg.add(cone(0.04, 0.18, dk, V(0.1 * s, -0.53, -0.36), [-Math.PI / 2, 0, 0]));   // knee spike
      lg.add(tube([V(0.1 * s, -0.53, -0.22), V(0.09 * s, -0.8, -0.04), V(0.07 * s, -1.0, 0.12)], 0.085, 0.032, mt, undefined, 12, 8));   // long thin shin
      for (const k of [-1, 0, 1]) lg.add(tube([V((0.07 + k * 0.035) * s, -1.0, 0.12), V((0.07 + k * 0.05) * s, -1.12, 0.0), V((0.07 + k * 0.07) * s, -1.2, -0.2)], 0.034, 0.006, dk, undefined, 8, 5));   // three long toe claws
      lg.add(cone(0.03, 0.14, dk, V(0.07 * s, -1.1, 0.2), [-2.3, 0, 0]));   // heel spur
      g.add(lg); legs.push(lg);
    }
  } else if (kind === "manthood") {   // reference 2: a tall gaunt alien: a ribbed manta-ray hood fanned behind a pale skull face, bulbous shoulder knobs, a wasp waist, long thin limbs, broad feet and a cloud of whip tendrils (own design in that mood). FRONT IS -z; feet on y = 0
    const skinT = skinFor(TANC), hT = hoodTex();
    const skin = mk(CHIT(0x7d6c58, { map: skinT, bumpMap: skinT, bumpScale: 1.1, roughness: 0.5, metalness: 0.08, clearcoat: 0.35, clearcoatRoughness: 0.35 }));
    const hoodM = mk(new THREE.MeshPhysicalMaterial({ map: hT, bumpMap: hT, bumpScale: 1.6, color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide, clearcoat: 0.25 })); hoodM.userData.keep = true;   // keeps its painted ribs when a family species recolours the rest
    const bone = mk(CHIT(0xe9e0cb, { map: skinT, bumpMap: skinT, bumpScale: 0.6, roughness: 0.34, clearcoat: 0.5 }));
    const dk = mk(CHIT(0x241a12, { roughness: 0.3, metalness: 0.3 }));
    const amber = GLOW(0xffa040), violet = GLOW(0xc070ff);
    // the hood: a fan of membrane around a point behind the neck, three lobes (a crest and two swept wing tips), cupped forward, a rim and bone ribs ending in glowing beads
    const TH = 1.9, HP: number[][] = [[-1.9, 0.5], [-1.35, 1.05], [-0.7, 0.72], [0, 1.25], [0.7, 0.72], [1.35, 1.05], [1.9, 0.5]];
    const hprof = (th: number) => { for (let i = 0; i < HP.length - 1; i++) if (th <= HP[i + 1][0]) { const t = (th - HP[i][0]) / (HP[i + 1][0] - HP[i][0]), s = 0.5 - 0.5 * Math.cos(t * Math.PI); return HP[i][1] + (HP[i + 1][1] - HP[i][1]) * s; } return HP[HP.length - 1][1]; };
    const HPt = (u: number, v: number) => { const th = (u - 0.5) * 2 * TH, R = hprof(th) * v, x = R * Math.sin(th); return V(x, R * Math.cos(th), -0.16 * x * x - 0.05 * R + 0.02 * Math.sin(u * 46) * v * v); };
    const NU = 52, NV = 14, hp: number[] = [], hu: number[] = [], hi: number[] = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const p = HPt(i / NU, j / NV); hp.push(p.x, p.y, p.z); hu.push(i / NU, j / NV); }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; hi.push(a, c, b, b, c, d); }
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3)); hg.setAttribute("uv", new THREE.Float32BufferAttribute(hu, 2)); hg.setIndex(hi); hg.computeVertexNormals();
    const hoodG = new THREE.Group(); hoodG.position.set(0, 2.3, 0.17); hoodG.rotation.x = 0.3; hoodG.scale.setScalar(1.15); body.add(hoodG);
    hoodG.add(new THREE.Mesh(hg, hoodM));
    for (let k = 1; k <= 13; k++) {
      const u = k / 14; hoodG.add(tube([0.12, 0.4, 0.7, 1.0].map(v => HPt(u, v)), 0.018, 0.007, bone, undefined, 12, 5));
      const tip = HPt(u, 1), dr = tip.clone().sub(HPt(u, 0.92)).normalize(), c = cone(0.016, 0.12, bone, tip.clone().addScaledVector(dr, 0.05)); c.quaternion.setFromUnitVectors(V(0, 1, 0), dr); hoodG.add(c);
      if (k % 2) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), violet); b.position.copy(tip).addScaledVector(dr, 0.12); hoodG.add(b); }
    }
    { const rp: THREE.Vector3[] = []; for (let i = 0; i <= 40; i++) rp.push(HPt(i / 40, 1.0)); hoodG.add(tube(rp, 0.014, 0.014, bone, undefined, 80, 5)); }
    // neck with rings
    body.add(tube([V(0, 2.08, 0.02), V(0, 2.26, -0.04), V(0, 2.4, -0.08)], 0.085, 0.07, skin, undefined, 14, 10));
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.011, 6, 14), dk); r.rotation.x = Math.PI / 2; r.position.set(0, 2.14 + i * 0.07, -0.01 - i * 0.015); body.add(r); }
    const hd = new THREE.Group(); hd.scale.setScalar(1.3); hd.position.set(0, 2.4 * -0.3, -0.1 * -0.3); body.add(hd);   // the head is drawn at 1.3x about the top of the neck so it reads against the big hood
    // the skull face: a long cranium, brow ridge, sunken sockets with a pinpoint of light, nose slits, cheekbones, a narrow jaw with two rows of teeth
    const cr = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), bone); cr.scale.set(0.86, 1.22, 1.08); cr.position.set(0, 2.62, -0.07); hd.add(cr);
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), bone); brow.scale.set(1.9, 0.38, 0.8); brow.position.set(0, 2.665, -0.235); hd.add(brow);
    for (const sd of [-1, 1]) {
      const so = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), dk); so.scale.set(1, 1.3, 0.6); so.position.set(0.085 * sd, 2.6, -0.245); hd.add(so);
      const ck = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bone); ck.scale.set(1, 0.7, 0.8); ck.position.set(0.115 * sd, 2.5, -0.2); hd.add(ck);
      const ns = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), dk); ns.scale.set(0.6, 2, 0.6); ns.position.set(0.016 * sd, 2.5, -0.263); hd.add(ns);
      hd.add(tube([V(0.045 * sd, 2.31, -0.25), V(0.06 * sd, 2.12, -0.3), V(0.05 * sd, 1.96, -0.27)], 0.02, 0.006, dk));   // mouth tendrils
    }
    hd.add(eyes(amber, 2.6, -0.262, 0.085, 0.024));
    const jaw = tube([V(0, 2.52, -0.2), V(0, 2.4, -0.215), V(0, 2.3, -0.21)], 0.115, 0.055, bone, undefined, 14, 12); jaw.scale.x = 0.85; hd.add(jaw);
    const mo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), dk); mo.scale.set(1.3, 0.25, 0.5); mo.position.set(0, 2.425, -0.255); hd.add(mo);
    for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.02; hd.add(cone(0.008, 0.045, bone, V(x, 2.447, -0.262 + Math.abs(x) * 0.5), [Math.PI, 0, 0])); }
    for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.021; hd.add(cone(0.007, 0.04, bone, V(x, 2.405, -0.258 + Math.abs(x) * 0.5))); }
    // ribcage, wasp waist, pelvis
    const rc = tube([V(0, 2.12, 0.0), V(0, 1.85, 0.02), V(0, 1.56, 0.0)], 0.27, 0.11, skin, k => 1 + 0.12 * Math.sin(k * Math.PI), 18, 14); rc.scale.z = 0.62; body.add(rc);
    for (let i = 0; i < 5; i++) { const y = 2.02 - i * 0.1, k = (2.12 - y) / 0.56, r = (0.27 - 0.16 * k) * (1 + 0.12 * Math.sin(k * Math.PI)) * 1.04; const rb = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 18, Math.PI), bone); rb.rotation.x = -Math.PI / 2; rb.scale.y = 0.62; rb.position.set(0, y, 0.02); body.add(rb); }
    for (let i = 0; i < 7; i++) body.add(cone(0.016, 0.07, bone, V(0, 2.06 - i * 0.075, 0.17 - i * 0.004), [1.2, 0, 0]));   // spine bumps
    body.add(tube([V(0, 1.58, 0), V(0, 1.45, 0.02), V(0, 1.32, 0)], 0.088, 0.088, skin, undefined, 10, 10));
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.01, 6, 14), dk); r.rotation.x = Math.PI / 2; r.position.set(0, 1.5 - i * 0.07, 0.01); body.add(r); }
    const pel = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), skin); pel.scale.set(0.95, 0.6, 0.8); pel.position.set(0, 1.2, 0.02); body.add(pel);
    for (const sd of [-1, 1]) {
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), bone); kn.position.set(0.44 * sd, 2.04, 0); body.add(kn);   // the knobs on the shoulders
      body.add(tube([V(0.06 * sd, 2.1, -0.05), V(0.26 * sd, 2.11, -0.04), V(0.42 * sd, 2.05, -0.02)], 0.028, 0.03, bone, undefined, 10, 6));   // collar bone
      body.add(cone(0.04, 0.2, dk, V(0.5 * sd, 2.2, 0), [0, 0, -0.7 * sd]));
      body.add(cone(0.03, 0.16, bone, V(0.17 * sd, 1.29, -0.1), [-1.2, 0, -0.6 * sd]));   // hip bones
      const arm = new THREE.Group(); arm.position.set(0.44 * sd, 2.02, 0);
      arm.add(tube([V(0, 0, 0), V(0.1 * sd, -0.35, 0.0), V(0.14 * sd, -0.68, -0.04)], 0.075, 0.052, skin, k => 1 + 0.15 * Math.sin(k * 3), 14, 10));
      const el = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bone); el.position.set(0.14 * sd, -0.68, -0.04); arm.add(el); arm.add(cone(0.02, 0.1, dk, V(0.2 * sd, -0.68, 0.05), [0, 0, -1.2 * sd]));
      arm.add(tube([V(0.14 * sd, -0.68, -0.04), V(0.18 * sd, -1.0, -0.14), V(0.2 * sd, -1.3, -0.16)], 0.05, 0.035, skin, undefined, 14, 8));
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin); palm.scale.set(1, 1.2, 0.6); palm.position.set(0.2 * sd, -1.36, -0.17); arm.add(palm);
      for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 0.035 * sd, tx = 0.2 * sd + dx * 1.3; arm.add(tube([V(0.2 * sd + dx, -1.38, -0.17), V(0.21 * sd + dx, -1.62, -0.22), V(tx, -1.84, -0.2)], 0.017, 0.006, skin, undefined, 10, 5)); arm.add(cone(0.01, 0.08, dk, V(tx, -1.88, -0.2), [Math.PI, 0, 0])); }
      body.add(arm); arms.push(arm);
    }
    // the cloud of whip tendrils from behind the skull: they arc out, then fall
    for (let i = 0; i < 8; i++) {
      const sd = i % 2 ? 1 : -1, j = i >> 1, w = new THREE.Group(); w.position.set((0.1 + 0.04 * j) * sd, 2.34 - j * 0.07, 0.14 + j * 0.02);
      const pts = [V(0, 0, 0)]; let dir = V((0.5 + 0.2 * j) * sd, 0.42 - j * 0.06, -0.05 + j * 0.05), p = V(0, 0, 0);
      for (let s = 0; s < 10; s++) { dir.y -= 0.22; dir.x *= 0.9; p = p.clone().addScaledVector(dir, 0.22); pts.push(p); }
      w.add(tube(pts, 0.045, 0.007, skin, undefined, 24, 6)); const tb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), violet); tb.position.copy(p); w.add(tb);
      body.add(w); arms.push(w);
    }
    // long thin legs with knee spikes and broad three-toed feet; the hip is at 1.17 so the sole rests on the floor
    for (const sd of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(0.19 * sd, 1.17, 0);
      lg.add(tube([V(0, 0, 0), V(0.05 * sd, -0.3, -0.09), V(0.09 * sd, -0.58, -0.12)], 0.115, 0.07, skin, k => 1 + 0.12 * Math.sin(k * 3.1), 16, 12));
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), bone); kn.position.set(0.09 * sd, -0.6, -0.12); lg.add(kn);
      lg.add(cone(0.025, 0.12, dk, V(0.09 * sd, -0.6, -0.22), [-Math.PI / 2, 0, 0]));
      lg.add(tube([V(0.09 * sd, -0.6, -0.12), V(0.07 * sd, -0.85, -0.02), V(0.05 * sd, -1.06, 0.07)], 0.065, 0.04, skin, undefined, 14, 10));
      const ft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8), skin); ft.scale.set(1.0, 0.4, 2.2); ft.position.set(0.04 * sd, -1.12, -0.08); lg.add(ft);
      for (const k of [-1, 0, 1]) { const x = 0.04 * sd + k * 0.05; lg.add(tube([V(x, -1.12, -0.22), V(x * 1.1, -1.125, -0.33), V(x * 1.2, -1.13, -0.43)], 0.022, 0.012, bone, undefined, 8, 5)); lg.add(cone(0.012, 0.07, dk, V(x * 1.2, -1.13, -0.47), [-Math.PI / 2, 0, 0])); }
      lg.add(cone(0.02, 0.1, dk, V(0.04 * sd, -1.1, 0.18), [Math.PI / 2 + 0.3, 0, 0]));   // heel spur
      g.add(lg); legs.push(lg);
    }
    (g as any).userData.tick = (t: number) => { amber.emissiveIntensity = 2.2 + 0.8 * Math.sin(t * 3); violet.emissiveIntensity = 2.2 + 0.9 * Math.sin(t * 2 + 1); hoodG.rotation.x = 0.3 + 0.025 * Math.sin(t * 1.3); };
  } else if (kind === "domestalker") {   // reference 1: a crouched black predator: a long smooth swept-back dome head with no eyes, a wet jaw with an inner jaw, ribbed hunched body, pipes rising from the back, digitigrade legs, long-fingered arms and a long bladed tail (own design in that mood). FRONT IS -z; feet on y = 0
    const skin = skinFor(XENO);
    const M = (c: number, o: any = {}) => mk(CHIT(c, { map: skin, bumpMap: skin, bumpScale: 1.1, roughness: 0.26, metalness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: 0x0a1620, emissiveIntensity: 0.5, ...o }));
    const dome = M(0x0b1218, { roughness: 0.12, metalness: 0.6, bumpScale: 0.45, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0x14405a, emissiveIntensity: 0.9 }), hide = M(0x111a22, { emissive: 0x0e2230, emissiveIntensity: 0.8 }), plate = M(0x1d2a36), trim = M(0x3a5064, { roughness: 0.3 }), pipe = M(0x141c24, { metalness: 0.75, roughness: 0.28 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd2dade, roughness: 0.3, metalness: 0.7, emissive: 0x3a4650, emissiveIntensity: 0.6 }), steel = new THREE.MeshStandardMaterial({ color: 0x9fb0bc, roughness: 0.18, metalness: 0.9, emissive: 0x16222c, emissiveIntensity: 0.5 });
    const glowM = GLOW(0xff3a2a), glowC = GLOW(0x7ae8ff);
    const ring = (c: THREE.Vector3, d: THREE.Vector3, R: number, t: number, m: THREE.Material, sx = 1, arc = Math.PI * 2) => { const o = new THREE.Mesh(new THREE.TorusGeometry(R, t, 5, arc < 6 ? 12 : 22, arc), m); o.position.copy(c); o.quaternion.setFromUnitVectors(V(0, 0, 1), d.clone().normalize()); o.scale.set(sx, 1, 1); return o; };
    const sp = (r: number, h: number, m: THREE.Material, p: THREE.Vector3, d: THREE.Vector3) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), m); c.position.copy(p).addScaledVector(d.clone().normalize(), h * 0.5); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); return c; };
    const ball = (r: number, m: THREE.Material, p: THREE.Vector3, sx = 1, sy = 1, sz = 1) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); s.position.copy(p); s.scale.set(sx, sy, sz); return s; };
    // the dome: a long smooth skull, narrow snout, widest over the middle, swept back and up over the shoulders and ending in a point
    const skP = [V(0, 1.2, -1.22), V(0, 1.35, -0.9), V(0, 1.58, -0.4), V(0, 1.78, 0.15), V(0, 1.82, 0.72), V(0, 1.7, 1.28)], skC = new THREE.CatmullRomCurve3(skP);
    const skProf = (k: number) => k < 0.42 ? 0.5 + 0.5 * Math.sin(k / 0.42 * Math.PI / 2) : 0.06 + 0.94 * Math.pow(Math.max(0, 1 - (k - 0.42) / 0.58), 0.85);
    const skull = tube(skP, 0.31, 0.31, dome, skProf, 44, 16); skull.scale.x = 0.7; body.add(skull);
    body.add(ball(0.155, dome, skP[0].clone().add(V(0, -0.01, 0.02)), 0.7, 0.95, 1.1));
    for (let k = 0.5; k < 0.93; k += 0.07) body.add(ring(skC.getPoint(k), skC.getTangent(k), 0.31 * skProf(k) * 1.03, 0.0065, trim, 0.7, Math.PI));   // fine ridges over the back of the dome
    { const cp: THREE.Vector3[] = []; for (let k = 0.08; k <= 0.8; k += 0.09) cp.push(skC.getPoint(k).add(V(0, 0.31 * skProf(k) * 0.97 + 0.004, 0))); body.add(tube(cp, 0.011, 0.011, glowC, undefined, 24, 5)); }   // a thin cold-blue line of light along the crown
    // neck and the jaws: upper teeth under the snout, a lower jaw with its own row, an inner jaw that slides out, drool
    body.add(tube([V(0, 1.1, 0.1), V(0, 1.22, -0.25), V(0, 1.34, -0.55)], 0.27, 0.2, hide, undefined, 12, 12));
    const jawC = new THREE.CatmullRomCurve3([V(0, 1.3, -0.3), V(0, 1.1, -0.78), V(0, 1.05, -1.1)]), jaw = tube(jawC.getPoints(3), 0.1, 0.045, plate, undefined, 14, 10); jaw.scale.x = 0.9; body.add(jaw);
    for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { body.add(sp(0.014, 0.08 + 0.03 * (i % 2), bone, V(0.075 * sd, 1.1 - i * 0.003, -1.12 + i * 0.1), V(0.1 * sd, -1, 0))); const p = jawC.getPoint(0.35 + i * 0.1); body.add(sp(0.012, 0.06 + 0.02 * (i % 2), bone, V(0.05 * sd, p.y + 0.04, p.z), V(-0.1 * sd, 1, 0))); }
    const inner = new THREE.Group(); inner.position.set(0, 1.08, -0.76); body.add(inner);
    inner.add(tube([V(0, 0, 0.12), V(0, -0.005, -0.18), V(0, -0.02, -0.4)], 0.05, 0.034, plate, undefined, 10, 8));
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; inner.add(sp(0.008, 0.06, bone, V(Math.cos(a) * 0.025, -0.02 + Math.sin(a) * 0.025, -0.4), V(0, 0, -1))); }
    inner.add(ball(0.017, glowM, V(0, -0.02, -0.43)));
    for (const x of [-0.04, 0, 0.04]) { const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.12 + Math.abs(x) * 2, 4), DRIP); dm.position.set(x, 0.96, -1.08 + Math.abs(x) * 2); body.add(dm); }
    // the hunched, ribbed torso
    const tP = [V(0, 1.12, -0.25), V(0, 1.16, 0.35), V(0, 1.0, 0.95)], tC = new THREE.CatmullRomCurve3(tP), tProf = (k: number) => 1.02 - 0.2 * Math.sin(k * Math.PI) + 0.12 * k;
    const torso = tube(tP, 0.3, 0.3, hide, tProf, 26, 14); torso.scale.x = 0.88; body.add(torso);
    for (let k = 0.08; k < 0.96; k += 0.085) { body.add(ring(tC.getPoint(k), tC.getTangent(k), 0.3 * tProf(k) * 1.03, 0.011, trim, 0.88)); }
    for (let k = 0.1; k < 0.97; k += 0.12) { const c = tC.getPoint(k), r = 0.3 * tProf(k); body.add(sp(0.02, 0.1, plate, c.clone().add(V(0, r * 0.98, 0)), V(0, 1, 0.45))); }   // a ridge of back spines
    body.add(ball(0.26, plate, V(0, 1.0, 0.92), 0.95, 0.9, 1.1));   // pelvis
    for (const sd of [-1, 1]) { body.add(ball(0.13, plate, V(0.3 * sd, 1.28, -0.15), 1, 0.85, 1.1)); body.add(sp(0.028, 0.2, trim, V(0.32 * sd, 1.32, -0.05), V(0.5 * sd, 0.55, 1))); }   // shoulder caps with blade-like spikes
    // two long ribbed pipes on the back sweeping past the skull, two short ones, each ending in an open mouth with a red glow
    for (const sd of [-1, 1]) {
      const pp = [V(0.28 * sd, 1.42, 0.25), V(0.37 * sd, 1.7, 0.7), V(0.33 * sd, 1.8, 1.2), V(0.26 * sd, 1.68, 1.75)], pc = new THREE.CatmullRomCurve3(pp);
      body.add(tube(pp, 0.06, 0.05, pipe, undefined, 22, 8));
      for (let k = 0.12; k < 0.97; k += 0.17) body.add(ring(pc.getPoint(k), pc.getTangent(k), 0.062, 0.011, trim));
      body.add(ring(pc.getPoint(1), pc.getTangent(1), 0.052, 0.014, trim)); const mo = ball(0.034, glowM, pc.getPoint(1)); body.add(mo);
      const ps = [V(0.2 * sd, 1.3, 0.55), V(0.28 * sd, 1.5, 0.95), V(0.22 * sd, 1.5, 1.35)]; body.add(tube(ps, 0.045, 0.037, pipe, undefined, 14, 7)); body.add(ball(0.03, glowM, ps[2]));
    }
    // the tail: a long segmented whip that sways, ending in a steel blade (pivot at the pelvis)
    const tail = new THREE.Group(); tail.position.set(0, 1.0, 0.95); body.add(tail);
    { const tl = [V(0, 0, 0), V(0, -0.12, 0.65), V(0, -0.1, 1.25), V(0, 0.2, 1.75), V(0, 0.6, 1.98)], tcv = new THREE.CatmullRomCurve3(tl);
      tail.add(tube(tl, 0.125, 0.014, hide, undefined, 30, 8));
      for (let k = 0.04; k < 0.97; k += 0.07) { const r = 0.125 + (0.014 - 0.125) * k; tail.add(ring(tcv.getPoint(k), tcv.getTangent(k), r * 1.06, 0.01, trim)); }
      for (let k = 0.08; k < 0.82; k += 0.1) { const c = tcv.getPoint(k), r = 0.125 + (0.014 - 0.125) * k; tail.add(sp(0.022 * (1 - k * 0.6), 0.12, plate, c.clone().add(V(0, r, 0)), V(0, 1, 0.4))); }
      const bl = sp(0.06, 0.62, steel, tcv.getPoint(0.97), tcv.getTangent(1).add(V(0, 0.15, 0))); bl.scale.x = 0.3; tail.add(bl); tail.add(ball(0.02, glowM, tcv.getPoint(0.97))); }
    // arms: long, bent, with four long fingers; the stage rocks them about the shoulder, so they are built to reach the floor after that turn
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.32 * sd, 1.25, -0.15);
      arm.add(tube([V(0, 0, 0), V(0.06 * sd, -0.22, -0.08), V(0.12 * sd, -0.4, -0.2)], 0.125, 0.085, hide, (k) => 1 + 0.25 * Math.sin(k * 3), 12, 10));
      arm.add(ball(0.065, plate, V(0.12 * sd, -0.4, -0.2))); arm.add(sp(0.02, 0.12, trim, V(0.12 * sd, -0.4, -0.2), V(0.5 * sd, 0.2, 1)));
      arm.add(tube([V(0.12 * sd, -0.4, -0.2), V(0.12 * sd, -0.52, -0.42), V(0.1 * sd, -0.62, -0.66)], 0.085, 0.055, plate, undefined, 12, 8));
      arm.add(ball(0.05, hide, V(0.1 * sd, -0.62, -0.66), 1, 0.8, 1.2));
      for (const k of [-1.5, -0.5, 0.5, 1.5]) arm.add(tube([V(0.1 * sd + k * 0.03, -0.62, -0.66), V(0.1 * sd + k * 0.045, -0.76, -0.78), V(0.1 * sd + k * 0.06, -0.9, -0.86)], 0.02, 0.005, trim, undefined, 8, 5));
      body.add(arm); arms.push(arm);
    }
    // digitigrade hind legs: thigh forward and down to the knee, shin back to the ankle, a long foot forward to three toes on the floor
    for (const sd of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(0.32 * sd, 1.02, 0.92);
      lg.add(tube([V(0, 0, 0), V(0.05 * sd, -0.2, -0.2), V(0.1 * sd, -0.4, -0.45)], 0.18, 0.1, hide, (k) => 1 + 0.35 * Math.sin(k * 3), 14, 12));
      lg.add(ball(0.1, plate, V(0.1 * sd, -0.4, -0.45))); lg.add(sp(0.03, 0.14, trim, V(0.12 * sd, -0.4, -0.5), V(0.7 * sd, 0.2, -0.5)));
      lg.add(tube([V(0.1 * sd, -0.4, -0.45), V(0.08 * sd, -0.55, -0.1), V(0.05 * sd, -0.72, 0.2)], 0.1, 0.055, plate, undefined, 12, 8));
      lg.add(sp(0.02, 0.12, trim, V(0.05 * sd, -0.72, 0.22), V(0, 0.2, 1)));
      lg.add(tube([V(0.05 * sd, -0.72, 0.2), V(0.03 * sd, -0.88, -0.1), V(0.02 * sd, -0.97, -0.4)], 0.055, 0.04, hide, undefined, 12, 8));
      for (const k of [-1, 0, 1]) lg.add(sp(0.016, 0.16, bone, V(0.02 * sd + k * 0.045, -0.98, -0.42), V(k * 0.12, -0.35, -1)));
      g.add(lg); legs.push(lg);
    }
    (g as any).userData.tick = (t: number) => { tail.rotation.y = Math.sin(t * 1.6) * 0.22; tail.rotation.x = Math.sin(t * 1.1) * 0.05; inner.position.z = -0.76 - 0.07 * (0.5 + 0.5 * Math.sin(t * 3.1)); (glowM as any).emissiveIntensity = 1.1 + 0.5 * Math.sin(t * 2.3); };
  } else if (kind === "xenodrone") {   // Night Drone: an upright black biomech hunter (own design in the mood of the classic film creature). FRONT IS -z like every other species: long ridged skull swept back, outer + inner jaw, ribbed chest, dorsal pipes, digitigrade legs, segmented bladed tail
    const skin = skinFor(XENO);
    const M = (c: number, o: any = {}) => mk(CHIT(c, { map: skin, bumpMap: skin, bumpScale: 1.5, roughness: 0.26, metalness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: 0x0a1620, emissiveIntensity: 0.5, envMapIntensity: 1, ...o }));
    const bl = M(0x0c1117), bl2 = M(0x182530), bl3 = M(0x2c3f50, { roughness: 0.34 }), pipe = M(0x131b23, { metalness: 0.7, roughness: 0.3 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd2dade, roughness: 0.3, metalness: 0.75, emissive: 0x3a4650, emissiveIntensity: 0.6 });
    const ring = (c: THREE.Vector3, d: THREE.Vector3, R: number, t: number, m: THREE.Material, sx = 1, arc = Math.PI * 2) => { const o = new THREE.Mesh(new THREE.TorusGeometry(R, t, 5, arc < 6 ? 12 : 22, arc), m); o.position.copy(c); o.quaternion.setFromUnitVectors(V(0, 0, 1), d.clone().normalize()); o.scale.set(sx, 1, 1); return o; };
    const sp = (r: number, h: number, m: THREE.Material, p: THREE.Vector3, d: THREE.Vector3) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), m); c.position.copy(p).addScaledVector(d.clone().normalize(), h * 0.5); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); return c; };
    const ball = (r: number, m: THREE.Material, p: THREE.Vector3, sx = 1, sy = 1, sz = 1) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), m); s.position.copy(p); s.scale.set(sx, sy, sz); return s; };
    // the long ridged skull: no eyes, swept back over the shoulders, widest behind the middle
    const skP = [V(0, 1.5, -0.66), V(0, 1.66, -0.58), V(0, 1.88, -0.3), V(0, 2.02, 0.15), V(0, 2.02, 0.62), V(0, 1.9, 0.98)], skC = new THREE.CatmullRomCurve3(skP);
    const skProf = (k: number) => k < 0.5 ? 0.5 + 0.5 * Math.sin(k / 0.5 * Math.PI / 2) : 1 - 0.82 * Math.pow((k - 0.5) / 0.5, 1.4);
    const skull = tube(skP, 0.21, 0.21, bl, skProf, 40, 14); skull.scale.x = 0.76; body.add(skull);
    body.add(ball(0.105, bl, skP[0], 0.76, 1, 1)); body.add(ball(0.04, bl, skP[5], 0.76, 1, 1));
    for (let k = 0.34; k < 0.92; k += 0.065) { const c = skC.getPoint(k), d = skC.getTangent(k); body.add(ring(c, d, 0.21 * skProf(k) * 1.04, 0.0075, bl3, 0.76, Math.PI)); }   // ridges over the back of the dome
    body.add(tube([V(0, 1.4, -0.26), V(0, 1.52, -0.42), V(0, 1.6, -0.5)], 0.11, 0.1, bl2, undefined, 8, 8));   // neck joining the skull
    for (const sd of [-1, 1]) body.add(tube([V(0.09 * sd, 1.36, -0.18), V(0.1 * sd, 1.5, -0.4), V(0.07 * sd, 1.6, -0.52)], 0.02, 0.016, pipe, undefined, 8, 6));   // cables at the neck
    // outer jaw: teeth under the face, a lower jaw with its own row, an inner jaw that pulses out between them
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) body.add(sp(0.015, 0.075 + 0.03 * (i % 2), bone, V(0.052 * sd, 1.42, -0.66 + i * 0.075), V(0.12 * sd, -1, -0.1)));
    const jawC = new THREE.CatmullRomCurve3([V(0, 1.44, -0.2), V(0, 1.33, -0.42), V(0, 1.29, -0.64)]);
    const jaw = tube(jawC.getPoints(2), 0.085, 0.05, bl2, undefined, 14, 10); jaw.scale.x = 0.9; body.add(jaw);
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const p = jawC.getPoint(0.35 + i * 0.19); body.add(sp(0.012, 0.06 + 0.02 * (i % 2), bone, V(0.034 * sd, p.y + 0.045, p.z), V(-0.1 * sd, 1, -0.1))); }
    const inner = new THREE.Group(); inner.position.set(0, 1.385, -0.3); inner.scale.z = 0.8; body.add(inner);
    inner.add(tube([V(0, 0.01, 0), V(0, 0, -0.28), V(0, -0.01, -0.52)], 0.05, 0.034, M(0x1a232b, { roughness: 0.2 }), undefined, 12, 8));
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; inner.add(sp(0.008, 0.05, bone, V(Math.cos(a) * 0.026, -0.01 + Math.sin(a) * 0.026, -0.53), V(0, 0, -1))); }
    inner.add(ball(0.016, GLOW(0xff4a3a), V(0, -0.01, -0.54)));
    for (const x of [-0.03, 0, 0.03]) { const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.1 + Math.abs(x) * -1, 4), DRIP); dm.position.set(x, 1.24, -0.62 + Math.abs(x) * 2); body.add(dm); }
    // the ribbed, narrow chest: a leaning spine of rings, shoulders, a ridge of back spines
    const tP = [V(0, 0.98, 0.18), V(0, 1.2, 0.0), V(0, 1.42, -0.25)], tC = new THREE.CatmullRomCurve3(tP), tProf = (k: number) => 0.85 + 0.3 * Math.sin(k * Math.PI * 0.9);
    const torso = tube(tP, 0.225, 0.225, bl2, tProf, 24, 12); torso.scale.x = 0.95; body.add(torso);
    for (let k = 0.2; k < 0.98; k += 0.13) body.add(ring(tC.getPoint(k), tC.getTangent(k), 0.225 * tProf(k) * 1.04, 0.011, bl3, 0.95));
    { const ribM = new THREE.MeshStandardMaterial({ color: 0x56636e, roughness: 0.32, metalness: 0.65, emissive: 0x16222c, emissiveIntensity: 0.6 });   // exposed ribs across the front of the chest + a sternum ridge, as in the film creature
      for (let k = 0.08; k < 0.97; k += 0.1) { const c = tC.getPoint(k), d = tC.getTangent(k).normalize(), fw = V(0, 0, -1).addScaledVector(d, d.z), rr = 0.225 * tProf(k) * 1.05; fw.normalize(); const pts: THREE.Vector3[] = [];
        for (let a = -0.15; a <= Math.PI + 0.15; a += 0.3) pts.push(c.clone().addScaledVector(V(1, 0, 0), Math.cos(a) * rr * 0.95).addScaledVector(fw, Math.sin(a) * rr * 0.98));
        body.add(tube(pts, 0.013, 0.013, ribM, undefined, 12, 5)); }
      body.add(tube([V(0, 1.0, -0.05), V(0, 1.2, -0.25), V(0, 1.4, -0.5)], 0.017, 0.017, ribM, undefined, 10, 5)); }
    for (let k = 0.12; k < 0.95; k += 0.2) { const c = tC.getPoint(k), n = V(0, 0.83, 0.55); body.add(sp(0.017, 0.09, bl3, c.clone().addScaledVector(n, 0.2), n)); }
    for (const sd of [-1, 1]) { body.add(ball(0.125, bl2, V(0.28 * sd, 1.4, -0.2), 1, 0.85, 1.05)); body.add(sp(0.03, 0.2, bl3, V(0.3 * sd, 1.46, -0.12), V(0.5 * sd, 0.6, 1))); body.add(sp(0.022, 0.14, bl3, V(0.32 * sd, 1.38, -0.06), V(0.8 * sd, 0.1, 1))); }   // shoulder caps with blade-like scapula spikes
    body.add(ball(0.215, bl2, V(0, 0.98, 0.17), 1.1, 0.85, 1.05));   // pelvis
    for (let k = 0; k < 7; k++) { const y = 1.45 - k * 0.07, z = -0.3 + k * 0.07; body.add(ball(0.024, bl3, V(0, y + 0.2, z + 0.18 + 0.16 * Math.max(0, k - 4) / 3), 1, 0.8, 1)); }   // vertebra knobs between the dorsal pipes
    const caps: THREE.Mesh[] = [];
    // dorsal pipes: two long ones sweeping back past the skull, two short ones lower, each ribbed and capped
    for (const sd of [-1, 1]) {
      const pp = [V(0.1 * sd, 1.5, -0.04), V(0.17 * sd, 1.76, 0.34), V(0.23 * sd, 1.8, 0.86)], pc = new THREE.CatmullRomCurve3(pp);
      body.add(tube(pp, 0.045, 0.036, pipe, undefined, 18, 8)); body.add(ring(pp[2], V(0, -0.05, 1), 0.038, 0.012, bl3)); { const cap = ball(0.034, GLOW(0x3a8ab0), V(pp[2].x, pp[2].y, pp[2].z + 0.03)); caps.push(cap); body.add(cap); }
      for (let k = 0.2; k < 0.95; k += 0.2) body.add(ring(pc.getPoint(k), pc.getTangent(k), 0.049, 0.007, bl3));
      const p2 = [V(0.09 * sd, 1.34, 0.1), V(0.15 * sd, 1.5, 0.4), V(0.17 * sd, 1.46, 0.72)]; body.add(tube(p2, 0.038, 0.03, pipe, undefined, 14, 8)); body.add(ball(0.03, pipe, p2[2]));
    }
    // the segmented whip tail with its blade, pivoting at the hips so it can sway
    const tail = new THREE.Group(), piv = V(0, 0.98, 0.3); tail.position.copy(piv); body.add(tail);
    const tlP = [V(0, 1.0, 0.3), V(0, 0.88, 0.85), V(0, 0.8, 1.45), V(0, 0.95, 2.0), V(0, 1.35, 2.42), V(0, 1.72, 2.62)].map(p => p.sub(piv)), tlC = new THREE.CatmullRomCurve3(tlP), tlProf = (k: number) => 1 - 0.12 * k;
    tail.add(tube(tlP, 0.12, 0.012, bl, tlProf, 40, 8));
    for (let k = 0.08; k < 0.92; k += 0.085) { const c = tlC.getPoint(k), d = tlC.getTangent(k), r = (0.12 + (0.012 - 0.12) * k) * tlProf(k); tail.add(ring(c, d, r * 1.06, 0.009, bl3)); tail.add(sp(r * 0.28, r * 0.9, bl3, c.clone().add(V(0, r * 0.9, 0)), V(0, 1, 0.5))); }
    { const e = tlC.getPoint(1), d = tlC.getTangent(1), bld = sp(0.05, 0.5, M(0x3a4e60, { metalness: 0.85, roughness: 0.18 }), e, d); bld.scale.set(1, 1, 0.3); tail.add(bld); }
    // long arms with four long fingers (built in the pose they should show, tilted back by the 0.5 rad the animation adds)
    const c5 = Math.cos(0.5), s5 = Math.sin(0.5), R = (x: number, y: number, z: number) => V(x, y * c5 - z * s5, y * s5 + z * c5);
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.28 * sd, 1.4, -0.22);
      const el = R(0.13 * sd, -0.4, -0.1), wr = R(0.07 * sd, -0.55, -0.6);
      arm.add(tube([R(0, 0, 0), R(0.09 * sd, -0.2, -0.04), el], 0.09, 0.062, bl2, k => 1 + 0.3 * Math.sin(k * 3), 12, 8));
      arm.add(ball(0.05, bl2, el)); arm.add(sp(0.025, 0.12, bl3, el, R(0.5 * sd, 0.1, 1)));
      arm.add(tube([el, R(0.1 * sd, -0.5, -0.35), wr], 0.058, 0.034, bl, undefined, 12, 8));
      arm.add(ball(0.03, bl3, wr));
      for (let f = 0; f < 4; f++) { const dx = (f - 1.5) * 0.034 * sd, tip = R(0.07 * sd + dx * 1.4, -0.72, -1.05 - (f === 0 || f === 3 ? 0 : 0.1)); arm.add(tube([wr, R(0.07 * sd + dx, -0.6, -0.78), tip], 0.016, 0.004, bl3, undefined, 8, 5)); arm.add(sp(0.006, 0.05, bone, tip, V(0, -0.4, -1))); }
      body.add(arm); arms.push(arm);
    }
    // digitigrade legs: thigh forward, shin back to a high hock, a long foot with three toes
    for (const sd of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(0.2 * sd, 0.98, 0.15);
      const kn = V(0.05 * sd, -0.36, -0.3), an = V(0.06 * sd, -0.72, 0.02), ft = V(0.06 * sd, -0.97, -0.34);
      lg.add(tube([V(0, 0, 0), V(0.03 * sd, -0.18, -0.16), kn], 0.135, 0.078, bl2, k => 1 + 0.45 * Math.sin(k * 3), 14, 10));
      lg.add(ball(0.09, bl3, kn)); lg.add(sp(0.025, 0.1, bl3, kn, V(0.4 * sd, 0.4, -1)));
      lg.add(tube([kn, V(0.06 * sd, -0.55, -0.13), an], 0.07, 0.04, bl, undefined, 12, 8));
      lg.add(ball(0.04, bl3, an)); lg.add(sp(0.02, 0.1, bl3, an, V(0, 0.2, 1)));
      lg.add(tube([an, V(0.06 * sd, -0.86, -0.12), ft], 0.042, 0.026, bl2, undefined, 10, 6));
      for (const k of [-1, 0, 1]) { const tip = V(ft.x + k * 0.07, -0.975, -0.58); lg.add(tube([ft, V(ft.x + k * 0.035, -0.975, -0.44), tip], 0.016, 0.006, bl3, undefined, 6, 5)); lg.add(sp(0.007, 0.05, bone, tip, V(k * 0.2, -0.1, -1))); }
      g.add(lg); legs.push(lg);
    }
    (g as any).userData.tick = (t: number) => { tail.rotation.y = Math.sin(t * 1.5) * 0.14; tail.rotation.x = Math.sin(t * 1.1 + 1) * 0.04; inner.scale.z = 0.78 + 0.22 * Math.max(0, Math.sin(t * 2.3)); const pu = 1 + 0.35 * Math.max(0, Math.sin(t * 3.1)); for (const c of caps) c.scale.setScalar(pu); };
  } else if (kind === "huntsman") {   // a masked trophy hunter (own design in the mood of the classic film hunter): a tall, hunched, mesh-suited humanoid in dark layered plate, a steel-and-bronze mask with a tall crest, glowing eye slits and four hooked mandibles, thick ringed dreadlocks that fan out and fall over the chest, a shoulder cannon with a three-dot laser sight, a wrist computer, twin wrist blades, a spear across the back, a skull trophy at the hip; knees bent forward, long boots
    const NETM = { map: HUNT_NET, bumpMap: HUNT_NET, bumpScale: 1.4, roughness: 0.62, metalness: 0.02, clearcoat: 0.12 }, PLT = { map: HUNT_PLATE, bumpMap: HUNT_PLATE, bumpScale: 0.5 };
    const sk = mk(CHIT(0x86834f, NETM)), sk2 = mk(CHIT(0x44432c, NETM)), dr = mk(CHIT(0x2a271b, { map: HUNT_NET, bumpMap: HUNT_NET, bumpScale: 2, roughness: 0.75, metalness: 0, clearcoat: 0 }));
    const ar = mk(CHIT(0x5e6772, { ...PLT, roughness: 0.3, metalness: 0.85, clearcoat: 0.7 })), mb = mk(CHIT(0x8c7438, { ...PLT, roughness: 0.34, metalness: 0.9, clearcoat: 0.55 })), br = mk(CHIT(0xe0bc58, { ...PLT, roughness: 0.24, metalness: 0.95, clearcoat: 0.6 }));
    const bn2 = mk(CHIT(0xc4b690, { map: null, roughness: 0.4, metalness: 0.05 })), bl = mk(CHIT(0xe4eaf0, { map: null, roughness: 0.1, metalness: 1, clearcoat: 1 })), dk2 = mk(CHIT(0x14171b, { map: null, roughness: 0.35, metalness: 0.7 }));
    (ar as any).side = THREE.DoubleSide;
    const gAmb = GLOW(0xffd83a), gRed = GLOW(0xff2a1a), gGrn = GLOW(0x3affc0);
    const ball = (r: number, m: THREE.Material, sx = 1, sy = 1, sz = 1, seg = 14) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), m); o.scale.set(sx, sy, sz); return o; };
    const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
    const fit = <T extends THREE.Object3D>(o: T, a: THREE.Vector3, b: THREE.Vector3, axis = V(0, 0, 1)): T => { o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(axis, b.clone().sub(a).normalize()); return o; };
    const band = (parent: THREE.Object3D, pts: THREE.Vector3[], k: number, r: number, t: number, m: THREE.Material) => { const c = new THREE.CatmullRomCurve3(pts), o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 18), m); o.position.copy(c.getPoint(k)); o.quaternion.setFromUnitVectors(V(0, 0, 1), c.getTangent(k)); parent.add(o); return o; };
    /* the upper body leans forward a little about the waist: the hunter's hunch */
    const up = new THREE.Group(); { const la = 0.13; up.rotation.x = la; up.position.set(0, 1.15 * (1 - Math.cos(la)), -1.15 * Math.sin(la)); body.add(up); }
    const arc = (r: number, h: number, a: number, m: THREE.Material, y: number, sx: number, sz: number, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 20, 1, true, -a, a * 2), m); o.scale.set(sx, 1, sz); o.position.set(0, y, z); up.add(o); return o; };
    /* torso: mesh-suited pelvis, waist and a broad chest, plated in front */
    body.add(tube([V(0, 0.92, 0), V(0, 1.1, 0), V(0, 1.26, 0)], 0.2, 0.2, sk2, undefined, 8, 14));
    { const abd = tube([V(0, 1.2, 0), V(0, 1.45, 0.01), V(0, 1.7, 0)], 0.2, 0.27, sk, k => 1 + 0.06 * Math.sin(k * 3.1), 12, 14); abd.scale.set(1.05, 1, 0.78); up.add(abd); }
    { const ch = tube([V(0, 1.65, 0), V(0, 1.85, 0.02), V(0, 2.03, 0)], 0.27, 0.3, sk, k => 1 + 0.12 * Math.sin(k * 3.14), 12, 18); ch.scale.set(1.36, 1, 0.85); up.add(ch); }
    arc(0.36, 0.38, 1.05, ar, 1.86, 1.36, 0.85); arc(0.37, 0.05, 1.08, mb, 2.05, 1.36, 0.85); arc(0.37, 0.04, 1.08, mb, 1.68, 1.36, 0.85);
    for (let i = 0; i < 3; i++) arc(0.285 - i * 0.012, 0.085, 0.8, ar, 1.58 - i * 0.1, 1.05, 0.78);
    up.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.028), dk2), 0, 1.76, 0.31, -0.12));   // the dark seam down the plate
    up.add(put(ball(0.022, gGrn, 1, 1, 1, 8), 0, 1.99, 0.335)); up.add(put(ball(0.016, gRed, 1, 1, 1, 8), 0, 1.5, 0.285));
    up.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 22), mb), 0, 2.04, 0.01, Math.PI / 2));   // the gorget
    up.add(tube([V(0, 1.98, 0), V(0, 2.1, 0.04), V(0, 2.22, 0.07)], 0.1, 0.085, sk2, undefined, 6, 10));
    { const pk = new THREE.Group(); pk.position.set(0, 1.75, -0.31); pk.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.16), ar)); for (let i = 0; i < 3; i++) pk.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.026, 0.02), gGrn), 0, 0.13 - i * 0.1, -0.09)); for (const sd of [-1, 1]) pk.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.54, 8), mb), 0.14 * sd, 0.02, -0.02)); up.add(pk); }   // power pack with glowing vents
    /* the spear carried across the back */
    up.add(tube([V(-0.24, 1.15, -0.43), V(0, 1.95, -0.47), V(0.24, 2.7, -0.5)], 0.018, 0.016, mb, undefined, 8, 6)); up.add(cone(0.045, 0.3, bl, V(0.255, 2.84, -0.505), [0.05, 0, -0.3]));
    /* belt, loincloth and a skull trophy */
    body.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.04, 8, 24), br), 0, 1.12, 0, Math.PI / 2));
    body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.045), mb), 0, 1.1, 0.225)); body.add(put(ball(0.02, gRed, 1, 1, 1, 8), 0, 1.1, 0.25));
    body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.34, 0.03), dk2), 0, 0.94, 0.215, 0.1)); body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.035), br), 0, 0.775, 0.235, 0.1));
    body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.03), dk2), 0, 0.92, -0.215, -0.1));
    body.add(tube([V(-0.24, 1.1, 0.12), V(-0.28, 1.0, 0.15), V(-0.29, 0.95, 0.16)], 0.01, 0.01, dk2, undefined, 6, 5));
    { const sull = new THREE.Group(); sull.position.set(-0.29, 0.9, 0.16); sull.add(ball(0.055, bn2, 1, 1.08, 1.1, 12)); sull.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.05), bn2), 0, -0.06, 0.02)); for (const sd of [-1, 1]) sull.add(put(ball(0.014, dk2, 1, 1, 0.6, 6), 0.02 * sd, 0.01, 0.05)); body.add(sull); }
    /* shoulders: layered pauldrons, and the cannon with its laser sight on the left */
    for (const sd of [-1, 1]) { up.add(put(ball(0.19, ar, 1.2, 0.7, 1.1, 18), 0.5 * sd, 1.99, 0, 0, 0, -0.22 * sd)); up.add(put(ball(0.14, mb, 1.15, 0.5, 1.05, 14), 0.5 * sd, 2.05, 0, 0, 0, -0.22 * sd)); up.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 24), mb), 0.52 * sd, 1.92, 0, Math.PI / 2, 0, -0.22 * sd)); }
    const can = new THREE.Group(); can.position.set(-0.54, 2.3, 0.02); up.add(can);
    up.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.12, 10), br), -0.54, 2.19, 0.02));
    can.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.4), ar), 0, 0, 0.0)); can.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.24), br), 0, 0.085, -0.02)); can.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.02, 0.1), gGrn), 0, 0.01, 0.12));
    can.add(tube([V(0, 0, 0.16), V(0, 0, 0.36), V(0, 0, 0.58)], 0.05, 0.04, mb, undefined, 8, 10)); can.add(band(can, [V(0, 0, 0.16), V(0, 0, 0.36), V(0, 0, 0.58)], 0.7, 0.055, 0.012, br)); can.add(put(ball(0.036, gGrn, 1, 1, 1, 10), 0, 0, 0.6));
    can.add(tube([V(0, 0.03, 0.58), V(0, 0.03, 1.3), V(0, 0.03, 2.1)], 0.006, 0.006, gRed, undefined, 3, 5)); for (const [dx, dy] of [[0, 0.05], [-0.04, 0], [0.04, 0]]) can.add(put(ball(0.022, gRed, 1, 1, 1, 8), dx, dy + 0.0, 2.1));   // the laser sight: three red dots
    /* arms: bare mesh sleeve, bracers; the right wrist carries two blades, the left a glowing computer */
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.15), gGrn);
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.5 * sd, 1.98, 0); arm.add(tube([V(0, 0, 0), V(0.06 * sd, -0.3, 0), V(0.1 * sd, -0.58, 0.03)], 0.105, 0.075, sk, k => 1 + 0.18 * Math.sin(k * 3.1), 12, 12));
      arm.add(put(ball(0.085, ar, 1, 1, 1, 10), 0.1 * sd, -0.6, 0.0));
      const fa = [V(0.1 * sd, -0.6, 0.03), V(0.11 * sd, -0.82, 0.2), V(0.1 * sd, -0.98, 0.42)];
      arm.add(tube(fa, 0.07, 0.055, sk2, undefined, 10, 10)); arm.add(tube([V(0.1 * sd, -0.66, 0.08), V(0.11 * sd, -0.82, 0.2), V(0.1 * sd, -0.95, 0.38)], 0.1, 0.088, ar, k => 1 + 0.14 * Math.sin(k * 3.1), 10, 12));
      band(arm, fa, 0.25, 0.1, 0.014, mb); band(arm, fa, 0.78, 0.09, 0.014, mb);
      const hand = new THREE.Group(); hand.position.set(0.1 * sd, -1.0, 0.44); hand.add(ball(0.055, sk2, 1.1, 0.8, 1.2, 10));
      for (let f = 0; f < 4; f++) hand.add(tube([V((f - 1.5) * 0.026, -0.01, 0.04), V((f - 1.5) * 0.03, -0.04, 0.1 + (f === 1 || f === 2 ? 0.015 : 0)), V((f - 1.5) * 0.032, -0.1, 0.14)], 0.014, 0.008, dk2, undefined, 5, 5));
      hand.add(tube([V(0.04 * sd, 0, 0.0), V(0.075 * sd, -0.03, 0.05), V(0.08 * sd, -0.07, 0.09)], 0.016, 0.009, dk2, undefined, 5, 5)); arm.add(hand);
      if (sd > 0) {
        arm.add(fit(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.34), mb), V(0.1, -0.74, 0.2), V(0.1, -0.9, 0.44)));
        for (const o of [-0.04, 0.04]) { const bd = V(0.03 * (o > 0 ? 1 : -1), -0.35, 0.93).normalize(), bs = V(0.1 + o, -0.83, 0.38), blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 1.3, 8), bl); blade.scale.set(1, 1, 0.2); blade.position.copy(bs).addScaledVector(bd, 0.65); blade.quaternion.setFromUnitVectors(V(0, 1, 0), bd); arm.add(blade); }
      } else { const pn = panel; fit(pn, V(-0.1, -0.78, 0.22), V(-0.1, -0.92, 0.42)); pn.translateY(0.075); arm.add(pn); arm.add(put(ball(0.012, gAmb, 1, 1, 1, 6), -0.13, -0.84, 0.3)); arm.add(put(ball(0.012, gRed, 1, 1, 1, 6), -0.07, -0.86, 0.33)); }
      up.add(arm); arms.push(arm);
    }
    /* head: a tall helmet, a steel-and-bronze face mask with a heavy brow and a nose ridge, angry amber eye slits, cheek plates, a ridged crest and ear pods, four hooked mandibles around the mouth, breather hoses */
    const head = new THREE.Group(); head.position.set(0, 2.38, 0.07); head.scale.setScalar(1.16); up.add(head);
    head.add(put(ball(0.2, ar, 0.9, 1.4, 1.2, 20), 0, 0.06, -0.05)); head.add(put(ball(0.15, mb, 0.82, 1.25, 0.6, 18), 0, -0.02, 0.135));
    head.add(tube([V(0, 0.2, 0.05), V(0, 0.1, 0.2), V(0, -0.02, 0.245), V(0, -0.11, 0.2)], 0.034, 0.022, br, undefined, 12, 8));
    head.add(tube([V(-0.19, 0.12, 0.05), V(-0.09, 0.115, 0.2), V(0, 0.09, 0.235), V(0.09, 0.115, 0.2), V(0.19, 0.12, 0.05)], 0.036, 0.036, ar, undefined, 14, 8));
    { const cr = tube([V(0, 0.22, 0.04), V(0, 0.38, -0.06), V(0, 0.4, -0.22), V(0, 0.22, -0.36)], 0.055, 0.016, br, undefined, 12, 8); cr.scale.x = 0.55; head.add(cr); for (let i = 0; i < 4; i++) head.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.02), mb), 0, 0.42 - Math.abs(i - 1.2) * 0.04, -0.04 - i * 0.1, 0.0, 0, 0)); }
    head.add(eyes(gAmb, 0.05, 0.2, 0.075, 0.018));
    const mand: { g: THREE.Group; sd: number; ph: number }[] = [];
    for (const sd of [-1, 1]) {
      head.add(put(ball(0.042, gAmb, 1.55, 0.5, 0.5, 10), 0.075 * sd, 0.05, 0.2, 0, 0, 0.35 * sd)); head.add(put(ball(0.1, ar, 0.6, 1.0, 0.7, 12), 0.165 * sd, -0.07, 0.08, 0, 0, 0.15 * sd));
      head.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), mb), 0.205 * sd, 0.03, -0.03, 0, 0, Math.PI / 2)); head.add(put(ball(0.016, gRed, 1, 1, 1, 6), 0.232 * sd, 0.03, -0.03));
      for (let r = 0; r < 2; r++) { const m = new THREE.Group(); m.position.set((0.04 + r * 0.03) * sd, -0.14 - r * 0.04, 0.2); m.add(tube([V(0, 0, 0), V(0.05 * sd, -0.05, 0.08), V((0.11 + r * 0.02) * sd, -0.14 - r * 0.02, 0.07), V((0.15 + r * 0.03) * sd, -0.22 - r * 0.03, 0.0)], 0.032, 0.005, bn2, undefined, 10, 6)); head.add(m); mand.push({ g: m, sd, ph: r * 1.7 + (sd > 0 ? 0.9 : 0) }); }
      head.add(tube([V(0.09 * sd, -0.15, 0.17), V(0.15 * sd, -0.26, 0.1), V(0.21 * sd, -0.4, 0.0), V(0.25 * sd, -0.55, -0.06)], 0.02, 0.02, dk2, undefined, 10, 6));
    }
    head.add(put(ball(0.06, dk2, 1.3, 0.7, 0.6, 8), 0, -0.145, 0.2)); head.add(put(ball(0.02, gRed, 1.3, 0.7, 0.6, 6), 0, -0.145, 0.228));
    /* thick ringed dreadlocks: a back curtain that fans out past the body (it sways), and four that fall over the chest */
    const dreads = new THREE.Group(); up.add(dreads);
    for (let i = 0; i < 8; i++) {
      const sd = i % 2 ? 1 : -1, c = i >> 1, r = c % 3, dp = [V(sd * (0.05 + 0.03 * c), 2.42 - 0.02 * r, -0.12), V(sd * (0.12 + 0.05 * c), 2.28, -0.3), V(sd * (0.2 + 0.07 * c), 1.95 - 0.1 * r, -0.4 - 0.02 * r), V(sd * (0.25 + 0.08 * c), 1.55 - 0.12 * r, -0.4), V(sd * (0.27 + 0.09 * c), 1.15 - 0.14 * r, -0.34)];
      dreads.add(tube(dp, 0.05, 0.022, dr, k => 1 + 0.1 * Math.sin(k * 55), 16, 6)); if (c % 2 === 0) { band(dreads, dp, 0.5, 0.055, 0.012, mb); band(dreads, dp, 0.82, 0.045, 0.011, mb); }
    }
    for (let i = 0; i < 4; i++) {
      const sd = i % 2 ? 1 : -1, c = i >> 1, dp = [V(sd * 0.13, 2.38, 0.02), V(sd * (0.22 + 0.02 * c), 2.22, 0.17), V(sd * (0.27 + 0.02 * c), 1.98, 0.33), V(sd * (0.29 + 0.03 * c), 1.7, 0.35), V(sd * (0.29 + 0.03 * c), 1.42 - 0.06 * c, 0.31)];
      up.add(tube(dp, 0.042, 0.02, dr, k => 1 + 0.1 * Math.sin(k * 50), 14, 6)); band(up, dp, 0.45, 0.048, 0.012, mb); if (c === 0) band(up, dp, 0.8, 0.04, 0.011, mb);
    }
    /* legs: thigh in mesh running forward to a plated knee, a shin that slants back to the ankle, a heavy boot with a heel spur; the hip is the pivot the game swings */
    for (const sd of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(0.19 * sd, 1.06, 0); lg.add(tube([V(0, 0.04, 0), V(0.025 * sd, -0.26, 0.08), V(0.05 * sd, -0.5, 0.17)], 0.16, 0.115, sk, k => 1 + 0.12 * Math.sin(k * 3), 12, 14));
      lg.add(put(ball(0.12, ar, 1, 1.05, 1.0, 12), 0.05 * sd, -0.54, 0.21)); lg.add(cone(0.032, 0.12, mb, V(0.05 * sd, -0.54, 0.35), [Math.PI / 2, 0, 0])); band(lg, [V(0.045 * sd, -0.46, 0.15), V(0.05 * sd, -0.56, 0.18), V(0.05 * sd, -0.66, 0.15)], 0.5, 0.118, 0.014, mb);
      lg.add(tube([V(0.05 * sd, -0.58, 0.17), V(0.045 * sd, -0.77, 0.08), V(0.035 * sd, -0.94, -0.02)], 0.1, 0.07, sk2, undefined, 8, 10));
      lg.add(tube([V(0.05 * sd, -0.64, 0.18), V(0.045 * sd, -0.8, 0.1), V(0.038 * sd, -0.95, 0.0)], 0.135, 0.098, ar, k => 1 + 0.1 * Math.sin(k * 3.1), 10, 14));
      band(lg, [V(0.045 * sd, -0.78, 0.1), V(0.04 * sd, -0.9, 0.04), V(0.036 * sd, -0.98, 0.0)], 0.35, 0.102, 0.013, mb);
      lg.add(put(ball(0.11, ar, 0.95, 0.55, 1.9, 14), 0.03 * sd, -0.99, 0.1)); lg.add(put(ball(0.07, mb, 1, 0.5, 0.9, 10), 0.03 * sd, -0.97, 0.3)); lg.add(cone(0.03, 0.14, br, V(0.03 * sd, -1.0, -0.15), [-Math.PI / 2, 0, 0]));
      g.add(lg); legs.push(lg);
    }
    (g as any).userData.tick = (t: number) => { head.rotation.y = Math.sin(t * 0.8) * 0.14; head.rotation.x = Math.sin(t * 1.3) * 0.03; can.rotation.y = Math.sin(t * 1.1 + 1) * 0.1; for (const m of mand) m.g.rotation.y = m.sd * (0.05 + Math.sin(t * 2.6 + m.ph) * 0.1); (gGrn as any).emissiveIntensity = 1.8 + 0.9 * Math.sin(t * 3); (gAmb as any).emissiveIntensity = 2.2 + 0.5 * Math.sin(t * 1.7); { const a = Math.sin(t * 1.4) * 0.05, Y = 2.4, Z = -0.12; dreads.rotation.x = a; dreads.position.set(0, Y - (Y * Math.cos(a) - Z * Math.sin(a)), Z - (Y * Math.sin(a) + Z * Math.cos(a))); } };
  } else if (kind === "greyling") {   // the classic big-headed grey visitor: thin limbs, huge smooth head, black almond eyes
    /* reference checklist: a big smooth inverted-egg skull on a spindly neck, two huge glossy black almond eyes that slant up and wrap round the sides, only nostril dots and a thin slit of a mouth,
       narrow sloping shoulders, a slim ribcage with a small belly, long thin arms ending in four long bulb-tipped fingers, thin legs with a soft knee, smooth mottled grey skin with a faint sheen */
    const skinTex = ((buildAlien as any)._greyTex ||= canvasTex(128, 128, gx => {
      gx.fillStyle = "#e4e9e6"; gx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 46; i++) { const x = Math.random() * 128, y = Math.random() * 128, r = 10 + Math.random() * 26, gr = gx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < 0.5 ? "rgba(80,100,96,.11)" : "rgba(255,255,255,.13)"); gr.addColorStop(1, "rgba(0,0,0,0)"); gx.fillStyle = gr; gx.fillRect(x - r, y - r, r * 2, r * 2); }
      noise(gx, 128, 128, 700, 0.05);
    }, 1));
    const skin = (c: number) => mk(CHIT(c, { map: skinTex, roughness: 0.48, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.7, sheenColor: new THREE.Color(0xa8e0d0), sheenRoughness: 0.45 }));
    const sk = skin(0x929d99), sk2 = skin(0x778380), dkm = mk(CHIT(0x1c2222, { map: null, roughness: 0.55, clearcoat: 0 }));
    const veinM = new THREE.MeshStandardMaterial({ color: 0x3a5a54, roughness: 0.5, transparent: true, opacity: 0.75 }), boneM = mk(CHIT(0xb4bdb6, { map: skinTex, roughness: 0.42, clearcoat: 0.2 })), clawM = mk(CHIT(0x161a1a, { map: null, roughness: 0.3, clearcoat: 0.6 }));
    const HY = 2.1, HH = 0.5, HW = 0.375, HD = 0.34;   // head centre, half height / width / depth (a larger, more top-heavy skull)
    const hunch = new THREE.Group(); body.add(hunch); { const a = 0.2, P = 0.94; hunch.rotation.x = a; hunch.position.set(0, P - P * Math.cos(a), -P * Math.sin(a)); }   // the whole upper body leans forward over the hips: a stalking stoop
    const sst = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const headPt = (ux: number, uy: number, uz: number) => { const f = 0.62 + 0.38 * sst(-1, 0.15, uy), zs = 1.1 - 0.2 * sst(-0.7, 0.7, uz) - 0.1 * (1 - sst(-0.6, 0.4, uy)) * sst(0, 0.8, uz); return V(ux * HW * f, HY + uy * HH, uz * HD * f * zs); };   // a unit direction -> the skull surface: a wide cranium, a flatter face, a small chin
    const dirOf = (az: number, el: number) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const onHead = (az: number, el: number, lift = 0) => { const d = dirOf(az, el); return headPt(d.x, d.y, d.z).addScaledVector(d, lift); };
    const hg = new THREE.Group(); hunch.add(hg);   // everything on the skull, so it can sway on the neck
    { const hgeo = new THREE.SphereGeometry(1, 40, 28), hp = hgeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < hp.count; i++) { const p = headPt(hp.getX(i), hp.getY(i), hp.getZ(i)); hp.setXYZ(i, p.x, p.y, p.z); }
      hgeo.computeVertexNormals();
      const nn = hgeo.attributes.normal as THREE.BufferAttribute, grp = new Map<string, number[]>();   // the sphere's seam and poles repeat points: average their normals so no crease shows
      for (let i = 0; i < hp.count; i++) { const key = hp.getX(i).toFixed(4) + "," + hp.getY(i).toFixed(4) + "," + hp.getZ(i).toFixed(4); const a = grp.get(key); if (a) a.push(i); else grp.set(key, [i]); }
      grp.forEach(ids => { if (ids.length < 2) return; const s = V(0, 0, 0); ids.forEach(i => s.add(V(nn.getX(i), nn.getY(i), nn.getZ(i)))); s.normalize(); ids.forEach(i => nn.setXYZ(i, s.x, s.y, s.z)); });
      hg.add(new THREE.Mesh(hgeo, sk)); }
    // the eyes: a patch of the skull's own surface in an almond outline, outer corner raised, bulging a little so it gleams
    const eyeGeo = (sd: number, s: number, lift: number, bulge: number) => {
      const NX = 18, NY = 8, pos: number[] = [], idx: number[] = [];
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const a = i / NX * 2 - 1, t = j / NY * 2 - 1, h = Math.pow(Math.max(0, 1 - a * a), 0.7), u = (a + 1) / 2;
        const az = 0.62 + (0.17 + u * 0.91 - 0.62) * s, el = -0.1 + t * h * 0.2 * s + (u - 0.5) * 0.34 * s;
        const p = onHead(az, el, lift + bulge * h * (1 - t * t)); pos.push(p.x * sd, p.y, p.z);
      }
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; if (sd > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
    };
    const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x040506, roughness: 0.1, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0x04161c, emissiveIntensity: 0.7 });   // not in mats: the hit flash must not wash the eyes out
    const eyeGlow = new THREE.MeshBasicMaterial({ color: 0x38ffb4, transparent: true, opacity: 0.2, depthWrite: false, fog: false }), rimM = mk(CHIT(0x5c6763, { map: skinTex, roughness: 0.6, clearcoat: 0.1 })), glintM = new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.85 });
    for (const sd of [-1, 1]) {
      hg.add(new THREE.Mesh(eyeGeo(sd, 1.34, 0.001, 0.002), eyeGlow)); hg.add(new THREE.Mesh(eyeGeo(sd, 1.2, 0.002, 0.004), rimM)); hg.add(new THREE.Mesh(eyeGeo(sd, 1.1, 0.006, 0.016), eyeM));
      const gl = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), glintM); const gp = onHead(0.5, 0.0, 0.026); gl.position.set(gp.x * sd, gp.y, gp.z); gl.scale.set(0.034, 0.009, 0.012); gl.rotation.z = -0.3 * sd; hg.add(gl);   // a wet glint on the upper-front of each eye
      const gl2 = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), glintM); const gq = onHead(0.9, -0.14, 0.02); gl2.position.set(gq.x * sd, gq.y, gq.z); gl2.scale.setScalar(0.009); hg.add(gl2);
      const nos = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), dkm); const np = onHead(0.1, -0.56, 0.0); nos.position.set(np.x * sd, np.y, np.z); nos.scale.set(0.008, 0.013, 0.006); nos.rotation.z = 0.35 * sd; hg.add(nos);   // nostril slits
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), dkm); const ep = onHead(1.52, -0.12, 0.0); ear.position.set(ep.x * sd, ep.y, ep.z); ear.scale.set(0.006, 0.02, 0.014); hg.add(ear);   // the tiny ear opening
    }
    hg.add(tube([onHead(-0.85, -0.94), onHead(-0.4, -0.97), onHead(0, -0.98), onHead(0.4, -0.97), onHead(0.85, -0.94)], 0.0075, 0.0075, dkm, undefined, 16, 6));   // a thin slit of a mouth
    { const gap = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dkm); const gp0 = onHead(0, -0.97, 0.002); gap.position.copy(gp0); gap.scale.set(0.085, 0.012, 0.012); hg.add(gap);   // the mouth is parted: a dark gap with tiny needle teeth along it
      for (let k = 0; k < 9; k++) { const u = (k - 4) / 4.6, tp = onHead(u * 0.8, -0.965 - 0.01 * Math.abs(u), 0.004), up = k % 2 === 0; const th = cone(0.0042, 0.026, boneM, tp, [up ? Math.PI : 0, 0, 0]); th.position.y += up ? 0.006 : -0.006; hg.add(th); }
      const dr = tube([onHead(0.55, -0.96, 0.004), onHead(0.57, -1.02, 0.004), onHead(0.57, -1.12, 0.004)], 0.0045, 0.002, DRIP, undefined, 8, 5); hg.add(dr);   // a thread of slime from the corner of the mouth
      const dd = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), DRIP); const dp = onHead(0.57, -1.13, 0.004); dd.position.copy(dp); dd.scale.set(1, 1.5, 1); hg.add(dd);
      // veins under the skin of the skull, and a heavy brow
      const vein = (pts: [number, number][]) => hg.add(tube(pts.map(p => onHead(p[0], p[1], 0.003)), 0.0042, 0.0016, veinM, undefined, 18, 5));
      for (const sd of [-1, 1]) { const f = sd;
        vein([[0.2 * f, 0.5], [0.5 * f, 0.62], [0.9 * f, 0.7], [1.4 * f, 0.55], [1.9 * f, 0.4]]); vein([[0.12 * f, 0.7], [0.4 * f, 0.9], [0.9 * f, 0.95], [1.5 * f, 0.8]]);
        vein([[0.35 * f, 0.3], [0.8 * f, 0.38], [1.3 * f, 0.3], [1.8 * f, 0.1]]); vein([[0.9 * f, 0.62], [1.05 * f, 0.45], [1.2 * f, 0.3]]); vein([[1.6 * f, 0.5], [1.75 * f, 0.2], [1.7 * f, -0.2]]);
        const brow = tube([onHead(0.12 * f, 0.2, 0.004), onHead(0.55 * f, 0.26, 0.008), onHead(1.0 * f, 0.18, 0.006), onHead(1.2 * f, 0.02, 0.002)], 0.013, 0.007, sk2, undefined, 14, 6); hg.add(brow);   // a heavy, angry brow ridge over each eye
      }
      const brm = tube([onHead(-0.1, 0.2, 0.004), onHead(0, 0.12, 0.006), onHead(0.1, 0.2, 0.004)], 0.009, 0.009, sk2, undefined, 6, 6); hg.add(brm); }
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x6affc8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); aura.scale.setScalar(1.15); aura.position.set(0, HY, -0.15); hg.add(aura);   // a faint telepathic glow behind the skull
    // neck, collar line, torso, belly and hips
    hunch.add(tube([V(0, 1.7, 0.0), V(0, 1.55, 0.02), V(0, 1.38, 0.0)], 0.045, 0.062, sk2, k => 1 - 0.12 * Math.sin(k * Math.PI), 14, 10));
    hunch.add(tube([V(-0.17, 1.36, 0.0), V(0, 1.41, -0.01), V(0.17, 1.36, 0.0)], 0.03, 0.03, sk2, undefined, 14, 8));
    { const tr = tube([V(0, 1.38, 0.0), V(0, 1.2, 0.012), V(0, 0.97, 0.02)], 0.118, 0.088, sk, k => 1 + 0.22 * Math.sin(k * Math.PI * 0.9), 20, 14); tr.scale.z = 0.72; hunch.add(tr); }
    { const bl = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), sk); bl.position.set(0, 1.04, 0.04); bl.scale.set(0.088, 0.11, 0.07); hunch.add(bl); const pv = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), sk2); pv.position.set(0, 0.95, 0.0); pv.scale.set(0.115, 0.075, 0.085); hunch.add(pv); }
    const sph = (r: number, m: THREE.Material, x: number, y: number, z: number) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); s.position.set(x, y, z); return s; };
    // an emaciated chest: the ribs show through the skin, a sternum, a knobbed spine and winged shoulder blades
    for (let i = 0; i < 6; i++) { const y = 1.3 - i * 0.05, w = 0.108 - i * 0.005 + (i === 5 ? -0.01 : 0); for (const sd of [-1, 1]) hunch.add(tube([V(0.012 * sd, y + 0.01, 0.07), V(w * 0.7 * sd, y - 0.004, 0.062), V((w + 0.012) * sd, y - 0.03, 0.01), V((w + 0.004) * sd, y - 0.045, -0.05)], 0.0085, 0.0058, boneM, undefined, 12, 5)); }
    hunch.add(tube([V(0, 1.33, 0.078), V(0, 1.2, 0.083), V(0, 1.06, 0.07)], 0.011, 0.007, boneM, undefined, 8, 5));
    for (let i = 0; i < 9; i++) { const kn = sph(0.0105, boneM, 0, 1.34 - i * 0.04, -0.07 - 0.004 * Math.sin(i * 0.7)); kn.scale.set(1, 0.8, 0.8); hunch.add(kn); }
    for (const sd of [-1, 1]) { const bl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), sk2); bl.position.set(0.075 * sd, 1.27, -0.075); bl.scale.set(0.05, 0.075, 0.012); bl.rotation.z = 0.25 * sd; hunch.add(bl); }
    for (const sd of [-1, 1]) {
      // arm: long and thin, elbow behind, wrist forward, a small hand with four long bulb-tipped fingers and a short thumb
      const arm = new THREE.Group(); arm.position.set(0.155 * sd, 1.37, 0); hunch.add(arm); arms.push(arm);
      arm.add(sph(0.04, sk2, 0, 0, 0)); arm.add(tube([V(0, 0, 0), V(0.04 * sd, -0.36, -0.03), V(0.06 * sd, -0.74, 0.09)], 0.034, 0.021, sk2, k => 1 + 0.16 * Math.sin(k * Math.PI), 18, 10)); arm.add(sph(0.026, sk2, 0.04 * sd, -0.36, -0.03));
      const palm = sph(1, sk, 0.06 * sd, -0.8, 0.1); palm.scale.set(0.03, 0.05, 0.015); arm.add(palm);
      [0.2, 0.25, 0.25, 0.18].forEach((len, k) => { const dx = (k - 1.5) * 0.013 * sd; arm.add(tube([V(0.06 * sd + dx, -0.83, 0.1), V(0.06 * sd + dx * 1.25, -0.83 - len * 0.55, 0.115), V(0.06 * sd + dx * 1.45, -0.83 - len, 0.15)], 0.0085, 0.0045, sk2, undefined, 8, 6)); arm.add(sph(0.0072, sk, 0.06 * sd + dx * 1.45, -0.83 - len, 0.15)); arm.add(cone(0.0058, 0.05, clawM, V(0.06 * sd + dx * 1.5, -0.83 - len - 0.022, 0.158), [Math.PI + 0.35, 0, 0])); });
      arm.add(tube([V(0.045 * sd, -0.8, 0.1), V(0.015 * sd, -0.87, 0.12), V(0.0 * sd, -0.93, 0.15)], 0.009, 0.005, sk2, undefined, 8, 6)); arm.add(cone(0.005, 0.04, clawM, V(-0.002 * sd, -0.95, 0.16), [Math.PI + 0.4, 0, 0]));
      // leg: thin, with a soft knee and a small flat foot with four toes
      const lg = new THREE.Group(); lg.position.set(0.085 * sd, 0.94, 0); g.add(lg); legs.push(lg);
      lg.add(tube([V(0, 0, 0), V(0.01 * sd, -0.24, 0.015), V(0.015 * sd, -0.47, 0.04), V(0.015 * sd, -0.7, 0.0), V(0.015 * sd, -0.88, -0.01)], 0.056, 0.026, sk2, k => 1 + 0.1 * Math.sin(k * 6.3), 20, 10));
      lg.add(sph(0.03, sk2, 0.015 * sd, -0.47, 0.04));
      const ft = sph(1, sk, 0.015 * sd, -0.905, 0.05); ft.scale.set(0.045, 0.028, 0.11); lg.add(ft);
      for (let k = 0; k < 4; k++) { const toe = sph(1, sk, 0.015 * sd + (k - 1.5) * 0.024, -0.914, 0.16 - Math.abs(k - 1.5) * 0.008); toe.scale.set(0.012, 0.012, 0.024); lg.add(toe); lg.add(cone(0.0055, 0.034, clawM, V(0.015 * sd + (k - 1.5) * 0.024, -0.914, 0.19 - Math.abs(k - 1.5) * 0.008), [Math.PI / 2, 0, 0])); }
    }
    { const Pv = 1.62, tmp = V(0, 0, 0); (g as any).userData.tick = (t: number) => { hg.rotation.set(-0.16 + Math.sin(t * 1.1) * 0.03, Math.sin(t * 0.7) * 0.14, Math.sin(t * 0.9 + 1) * 0.04); tmp.set(0, Pv, 0).applyEuler(hg.rotation); hg.position.set(0, Pv, 0).sub(tmp); (aura.material as THREE.SpriteMaterial).opacity = 0.15 + 0.08 * Math.sin(t * 2.2); }; }
  } else if (kind === "hydraling") {   // a swarm serpent-beast: segmented body, raised scythe arms, a hooded spitting head
    // Hydra Fiend: a coiled, segmented serpent that rears up like a cobra; a flared ribbed hood, raised scythe-talon arms, a spitting head with needle flaps, and two smaller snapping heads (the hydra)
    const m = mk(CHIT(0x6a3282, { roughness: 0.28, clearcoat: 1 })), m2 = mk(CHIT(0xc8b878, { roughness: 0.3 })), m3 = mk(CHIT(0x1c1026, { roughness: 0.3, metalness: 0.4 })), bl = mk(CHIT(0xe4dcc0, { roughness: 0.22, clearcoat: 1, metalness: 0.15 }));
    for (const mm of [m, m3]) { (mm as any).emissive = new THREE.Color(0x2a0a3a); (mm as any).emissiveIntensity = 0.35; }
    const acid = GLOW(0x9aff3a), ember = GLOW(0xff5a1a), pupil = new THREE.MeshBasicMaterial({ color: 0x050205 });
    const sp = new THREE.CatmullRomCurve3([V(0, 0.1, 2.0), V(0.55, 0.1, 1.5), V(0.1, 0.16, 1.0), V(-0.05, 0.45, 0.45), V(0, 0.95, 0.1), V(0, 1.45, -0.05), V(0, 1.75, -0.3)]);
    const rad = (k: number) => (0.34 - 0.2 * k) * (1 + 0.12 * Math.sin(k * 30));
    body.add(tube(sp.points, 0.34, 0.14, m, k => 1 + 0.12 * Math.sin(k * 30), 64, 14));
    for (let k = 0.1; k < 0.97; k += 0.045) { const p = sp.getPoint(k), t = sp.getPoint(Math.min(1, k + 0.01)).sub(sp.getPoint(Math.max(0, k - 0.01))).normalize(); const ring = new THREE.Mesh(new THREE.TorusGeometry(rad(k) * 1.04, 0.02 + 0.012 * (1 - k), 6, 20), m2); ring.position.copy(p); ring.quaternion.setFromUnitVectors(V(0, 0, 1), t); body.add(ring); }   // the pale rib plates round every segment
    for (const k of [0.38, 0.5, 0.62, 0.74, 0.86]) for (const sx of [-1, 0, 1]) { const p = sp.getPoint(k), d = V(sx * 0.45, 0.45, 1).normalize(), q = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.36 - 0.05 * Math.abs(sx), 8), m3); q.position.copy(p).addScaledVector(d, rad(k) * 0.9 + 0.12); q.quaternion.setFromUnitVectors(V(0, 1, 0), d); body.add(q); const tp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), ember); tp.position.copy(p).addScaledVector(d, rad(k) * 0.9 + 0.3); body.add(tp); }   // the back's needle quills with hot tips
    { const tip = sp.getPoint(0), td = V(-0.3, 0.2, 1).normalize(); body.add(cone(0.09, 0.55, m3, tip.clone().addScaledVector(td, 0.25), [0, 0, 0])); const b = body.children[body.children.length - 1]; b.quaternion.setFromUnitVectors(V(0, 1, 0), td); for (const sd of [-1, 1]) { const bb = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 8), bl); const dd = V(sd * 0.7, 0.3, 0.7).normalize(); bb.position.copy(tip).addScaledVector(dd, 0.15); bb.quaternion.setFromUnitVectors(V(0, 1, 0), dd); body.add(bb); } }   // a barbed tail tip
    // the cobra hood: a ribbed membrane fanned behind the head
    { const hT = hoodTex(); const hoodM = mk(new THREE.MeshPhysicalMaterial({ map: hT, bumpMap: hT, bumpScale: 1.4, color: 0xd09aff, roughness: 0.45, side: THREE.DoubleSide, clearcoat: 0.4, emissive: 0x3a0a5a, emissiveIntensity: 0.5 })); hoodM.userData.keep = true;
      const NU = 40, NV = 10, hp: number[] = [], hu: number[] = [], hi: number[] = [], HPt = (u: number, v: number) => { const th = (u - 0.5) * 2 * 1.55, R = (0.62 + 0.1 * Math.cos(th * 6) + 0.18 * Math.cos(th * 1.6)) * v, x = R * Math.sin(th); return V(x, R * Math.cos(th), -0.26 * x * x - 0.06 * R); };
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const p = HPt(i / NU, j / NV); hp.push(p.x, p.y, p.z); hu.push(i / NU, j / NV); }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; hi.push(a, c, b, b, c, d); }
      const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3)); hg.setAttribute("uv", new THREE.Float32BufferAttribute(hu, 2)); hg.setIndex(hi); hg.computeVertexNormals();
      const hoodG = new THREE.Group(); hoodG.position.set(0, 1.55, -0.08); hoodG.rotation.x = 0.28; body.add(hoodG); hoodG.add(new THREE.Mesh(hg, hoodM));
      for (let k = 1; k <= 11; k++) { const u = k / 12, tip = HPt(u, 1); hoodG.add(tube([0.1, 0.4, 0.7, 1].map(v => HPt(u, v)), 0.02, 0.008, bl, undefined, 10, 5)); const dr = tip.clone().sub(HPt(u, 0.9)).normalize(), c = cone(0.018, 0.14, bl, tip.clone().addScaledVector(dr, 0.05)); c.quaternion.setFromUnitVectors(V(0, 1, 0), dr); hoodG.add(c); if (k % 2) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), ember); b.position.copy(tip).addScaledVector(dr, 0.14); hoodG.add(b); } }
      { const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), acid); e1.scale.set(1, 1, 0.4); e1.position.set(0, 0.62, -0.2); hoodG.add(e1); for (const sd of [-1, 1]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), pupil); o.scale.set(1, 1, 0.4); o.position.set(0.3 * sd, 0.45, -0.17); hoodG.add(o); const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 6, 14), ember); r2.position.copy(o.position); hoodG.add(r2); } }   // false eyespots on the hood: a stare from behind the head
    }
    // a head: skull, snout, jaw hanging open on a glowing acid throat, teeth, slit-pupil eyes; the main head also carries the needle flaps
    const mkHead = (s: number, main: boolean) => { const h = new THREE.Group(); h.scale.setScalar(s);
      const sk = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), m3); sk.scale.set(1, 0.85, 1.55); sk.position.set(0, 0, -0.08); h.add(sk);
      const sn = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), m); sn.scale.set(1, 0.7, 1.6); sn.position.set(0, -0.03, -0.36); h.add(sn);
      for (const sd of [-1, 1]) { h.add(cone(0.035, 0.28, m3, V(0.1 * sd, 0.14, 0.04), [-Math.PI / 2 - 0.3, 0, -sd * 0.25])); const ey = eyes(GLOW(0xff3a1a), 0.06, -0.17, 0.165, 0.062); if (sd < 0) { h.add(ey); const sl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), pupil); sl.scale.set(0.5, 3.2, 0.5); sl.position.set(0.165, 0.06, -0.222); const sl2 = sl.clone(); sl2.position.x = -0.165; h.add(sl, sl2); const bw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.08), m2); for (const q of [-1, 1]) { const b2 = bw.clone(); b2.position.set(0.15 * q, 0.125, -0.17); b2.rotation.set(0, 0, -q * 0.5); h.add(b2); } } }
      const gw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), acid); gw.scale.set(1, 0.5, 1.9); gw.position.set(0, -0.07, -0.26); h.add(gw);
      for (let i = 0; i < 7; i++) { const z = -0.14 - i * 0.045, c = cone(0.016, 0.1 + (i === 2 ? 0.05 : 0), bl, V((i % 2 ? 1 : -1) * 0.075, -0.1, z), [Math.PI, 0, 0]); h.add(c); }
      const jaw = new THREE.Group(); jaw.position.set(0, -0.08, -0.02); jaw.rotation.x = main ? -0.7 : -0.5; h.add(jaw);
      const jb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), m); jb.scale.set(1, 0.4, 2.1); jb.position.set(0, -0.02, -0.26); jaw.add(jb);
      for (let i = 0; i < 6; i++) jaw.add(cone(0.014, 0.1, bl, V((i % 2 ? 1 : -1) * 0.06, 0.04, -0.2 - i * 0.045), [0, 0, 0]));
      const tn = tube([V(0, -0.01, -0.2), V(0, 0, -0.38), V(0, -0.02, -0.55)], 0.025, 0.004, GLOW(0xff3a5a)); jaw.add(tn);
      const dr = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), DRIP); dr.scale.y = 2.2; dr.position.set(0.04, -0.12, -0.36); jaw.add(dr);
      if (main) for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const d = V(sd * (0.75 - k * 0.12), 0.1 + k * 0.18, 0.7).normalize(), c = new THREE.Mesh(new THREE.ConeGeometry(0.022 - k * 0.002, 0.46 - k * 0.04, 6), m3); c.position.set(0.17 * sd, 0.02 + k * 0.025, -0.02).addScaledVector(d, 0.2); c.quaternion.setFromUnitVectors(V(0, 1, 0), d); h.add(c); const tp = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), ember); tp.position.set(0.17 * sd, 0.02 + k * 0.025, -0.02).addScaledVector(d, 0.44); h.add(tp); }   // the flaps that fold back to fire needles
      return h; };
    { const hd = mkHead(1.05, true); hd.position.set(0, 1.84, -0.4); hd.rotation.x = -0.12; body.add(hd); const th = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), acid); th.scale.set(1, 0.9, 1.15); th.position.set(0, 1.4, -0.16); th.scale.multiplyScalar(0.6); body.add(th); }   // the glowing acid pouch swelling the throat
    for (const sd of [-1, 1]) {   // the two smaller heads on thin necks
      const nk = [V(0.12 * sd, 1.2, 0), V(0.5 * sd, 1.42, 0.2), V(0.78 * sd, 1.3, -0.15), V(0.66 * sd, 1.02, -0.55)];
      body.add(tube(nk, 0.1, 0.055, m, k => 1 + 0.2 * Math.sin(k * 20), 24, 10));
      for (let k = 1; k <= 3; k++) { const p = new THREE.CatmullRomCurve3(nk).getPoint(k / 4); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.075 - k * 0.008, 0.012, 5, 12), m2); rg.position.copy(p); body.add(rg); }
      const h2 = mkHead(0.62, false); h2.position.copy(nk[3]); h2.rotation.set(-0.2, sd * -0.3, 0); body.add(h2);
    }
    // the raised scythe-talon arms: an armoured upper arm, an elbow spike and three curved blades with serrated inner edges
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.3 * sd, 1.32, -0.12); arm.scale.setScalar(0.76);
      arm.add(tube([V(0, 0, 0), V(0.34 * sd, 0.3, 0.02), V(0.72 * sd, 0.62, -0.12)], 0.12, 0.085, m, k => 1 + 0.15 * Math.sin(k * 12)));
      const el = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m2); el.position.set(0.72 * sd, 0.62, -0.12); arm.add(el); arm.add(cone(0.05, 0.32, bl, V(0.8 * sd, 0.75, 0.1), [0.6, 0, -sd * 0.9]));
      const blades: [number[][], number][] = [[[[0.72, 0.62, -0.12], [0.98, 0.98, -0.4], [0.7, 1.22, -0.95], [0.3, 1.0, -1.35]], 0.075], [[[0.72, 0.62, -0.12], [0.98, 0.7, -0.5], [0.82, 0.7, -1.0], [0.56, 0.5, -1.3]], 0.05], [[[0.72, 0.62, -0.12], [0.92, 0.45, -0.3], [0.9, 0.3, -0.7], [0.74, 0.14, -0.98]], 0.04]];
      for (const [bp, br] of blades) { const pts = bp.map(q => V(q[0] * sd, q[1], q[2])); arm.add(tube(pts, br, 0.004, bl, k => 1 + 0.9 * Math.sin(k * Math.PI * 0.8), 20, 8)); for (let j = 1; j < 6; j++) { const k = 0.15 + j * 0.14, c = new THREE.CatmullRomCurve3(pts), p = c.getPoint(k), t = c.getPoint(Math.min(1, k + 0.02)).sub(p).normalize(), cn = cone(0.016, 0.1, bl, p.clone().addScaledVector(V(-sd * 0.4, -0.5, 0.2).normalize(), 0.06)); cn.quaternion.setFromUnitVectors(V(0, 1, 0), V(-sd * 0.4, -0.55, 0.1).normalize().add(t.multiplyScalar(0.8)).normalize()); arm.add(cn); } const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), ember); e.position.copy(pts[3]); arm.add(e); }
      body.add(arm); arms.push(arm);
    }
    for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, l = leg(0.35, 0.045, m3, 0.45); l.scale.x = sd; l.position.set(0.2 * sd, 0.45, 0.62 - Math.floor(i / 2) * 0.45); g.add(l); legs.push(l); }
  } else if (kind === "warbug") {   // a hulking armoured warrior bug: wide shell, four stalking legs, two huge hook-claws
    // v2 (owner 2026-11-01: closer to the reference, prettier, scarier): a low armoured warrior bug in the manner of the film's. A banded dorsal carapace over a wide thorax, a ribbed abdomen, a hunched head with a sunken brow, burning eyes with slit pupils and four hooked mandibles around a glowing maw, two huge raised hook-claws with a saw edge and a thumb, four thick spiked legs with a high knee. All materials are `keep` (they carry their own rust-brown / bone / wet-flesh colours instead of the shared palette recolour).
    const km = (c: number, o: any = {}) => { const x = mk(CHIT(c, o)); x.userData.keep = true; if (tint) x.color.lerp(new THREE.Color(tint), 0.08); return x; };
    const hull = km(0x5c331f, { roughness: 0.42, metalness: 0.04, clearcoat: 0.55, clearcoatRoughness: 0.25 }), plate = km(0x22140e, { roughness: 0.32, metalness: 0.15 }), bone = km(0x9a8256, { roughness: 0.34 }), flesh = km(0x93301c, { roughness: 0.2 });
    flesh.emissive = new THREE.Color(0x4a0e06); flesh.emissiveIntensity = 0.6; hull.emissive = new THREE.Color(0x2a1208); hull.emissiveIntensity = 0.8;
    const seam = GLOW(0xff4a10); seam.emissiveIntensity = 1.3; const maw = GLOW(0x6a0c04); maw.emissiveIntensity = 0.7;
    const ell = (m: THREE.Material, r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m); e.scale.set(sx, sy, sz); e.position.set(x, y, z); e.rotation.set(rx, ry, rz); body.add(e); return e; };
    const serr = (grp: THREE.Object3D, pts: THREE.Vector3[], n: number, k0: number, k1: number, r: number, len: number, dir: THREE.Vector3, m: THREE.Material) => { const c = new THREE.CatmullRomCurve3(pts); for (let j = 0; j < n; j++) { const k = k0 + (k1 - k0) * (n === 1 ? 0 : j / (n - 1)), p = c.getPoint(k), cn = cone(r * (1 - 0.4 * k), len * (1 - 0.3 * k), m, p.clone().addScaledVector(dir, len * 0.4)); cn.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); grp.add(cn); } };
    // thorax and the banded dorsal carapace
    ell(hull, 0.62, 1.12, 0.66, 1.25, 0, 1.12, -0.12);
    for (let i = 0; i < 5; i++) {
      const z = -0.55 + i * 0.27, yy = 1.14 + 0.07 * Math.sin((i + 0.5) / 5 * Math.PI), r = 0.6 - Math.abs(i - 2) * 0.025;
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? plate : hull); d.scale.set(1.16, 0.62, 0.52); d.position.set(0, yy, z); d.rotation.x = 0.08; body.add(d);
      const rb = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.014, 6, 26, Math.PI), seam); rb.scale.set(1.16, 0.62, 1); rb.position.set(0, yy, z + r * 0.5 - 0.02); body.add(rb);
    }
    for (const sd of [-1, 1]) { ell(plate, 0.2, 1.15, 0.7, 1.2, 0.56 * sd, 1.36, -0.55); body.add(cone(0.07, 0.55, plate, V(0.58 * sd, 1.72, -0.46), [0.55, 0, -0.45 * sd])); body.add(cone(0.045, 0.34, plate, V(0.5 * sd, 1.62, -0.2), [0.7, 0, -0.35 * sd])); }
    body.add(cone(0.05, 0.3, bone, V(0.12, 1.74, 0.2), [0.9, 0, 0.2])); body.add(cone(0.035, 0.18, bone, V(-0.14, 1.7, 0.45), [1.1, 0, -0.3]));   // dorsal horns; the second one is broken short
    // ribbed abdomen
    body.add(tube([V(0, 1.1, 0.35), V(0, 1.02, 0.95), V(0, 0.88, 1.55)], 0.5, 0.2, flesh, k => 1 + 0.12 * Math.sin(k * 3), 16, 10));
    for (let i = 0; i < 6; i++) { const R = 0.5 - i * 0.055, ab = new THREE.Mesh(new THREE.TorusGeometry(R, 0.055 - i * 0.004, 8, 22, Math.PI * 1.25), i % 2 ? plate : hull); ab.rotation.z = -Math.PI * 0.125; ab.scale.set(1, 0.9, 1); ab.position.set(0, 1.0 - i * 0.03 - 0.0, 0.55 + i * 0.2); body.add(ab); }
    body.add(cone(0.13, 0.36, plate, V(0, 0.83, 1.72), [Math.PI / 2 + 0.2, 0, 0]));
    for (const sd of [-1, 1]) { body.add(tube([V(0.44 * sd, 1.02, 0.45), V(0.42 * sd, 0.98, 0.9), V(0.3 * sd, 0.88, 1.4)], 0.014, 0.008, seam, undefined, 12, 5)); body.add(tube([V(0.42 * sd, 0.98, 0.9), V(0.46 * sd, 0.86, 1.1), V(0.4 * sd, 0.76, 1.3)], 0.01, 0.006, seam, undefined, 8, 5)); body.add(tube([V(0.66 * sd, 1.1, -0.45), V(0.68 * sd, 1.08, -0.05), V(0.6 * sd, 1.05, 0.35)], 0.014, 0.01, seam, undefined, 12, 5)); }   // glowing cracks along the flanks
    // neck, collar frill and the hunched head
    body.add(tube([V(0, 1.22, -0.5), V(0, 1.27, -0.82), V(0, 1.17, -1.05)], 0.31, 0.25, flesh, undefined, 12, 10));
    ell(plate, 0.5, 1.3, 0.75, 0.2, 0, 1.3, -0.86, -0.55);
    for (let i = -3; i <= 3; i++) body.add(cone(0.032, 0.3 - Math.abs(i) * 0.03, bone, V(i * 0.16, 1.5 - Math.abs(i) * 0.05, -0.97), [-0.55, 0, -i * 0.2]));
    ell(hull, 0.36, 0.98, 0.72, 1.25, 0, 1.14, -1.22, 0.18);
    ell(plate, 0.36, 1.1, 0.24, 0.7, 0, 1.35, -1.34, 0.35);   // the sunken brow
    body.add(cone(0.05, 0.3, bone, V(0.0, 1.5, -1.2), [-0.85, 0, 0]));
    body.add(eyes(GLOW(0xff7a1a), 1.25, -1.56, 0.23, 0.065)); body.add(eyes(GLOW(0xff5a10), 1.38, -1.4, 0.13, 0.03));
    { const slit = new THREE.MeshBasicMaterial({ color: 0x050000 }); for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), slit); s.scale.set(0.28, 1.5, 0.4); s.position.set(0.23 * sx, 1.25, -1.62); body.add(s); } }
    // the maw and the four mandibles
    ell(maw, 0.2, 0.85, 0.38, 0.35, 0, 1.0, -1.56);
    for (let j = 0; j < 9; j++) { const a = j / 9 * Math.PI * 2; body.add(cone(0.017, 0.15, bone, V(Math.cos(a) * 0.16, 0.99 + Math.sin(a) * 0.09, -1.74), [-Math.PI / 2 - Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3])); }
    for (const sd of [-1, 1]) {
      const mp = [V(0.17 * sd, 1.04, -1.5), V(0.42 * sd, 0.9, -1.78), V(0.36 * sd, 0.66, -2.02), V(0.12 * sd, 0.56, -2.1)];
      body.add(tube(mp, 0.065, 0.006, bone, k => 1 + 0.25 * Math.sin(k * 3), 16, 8)); serr(body, mp, 5, 0.3, 0.95, 0.02, 0.1, V(-sd * 0.8, 0.3, -0.3), bone);
      body.add(tube([V(0.08 * sd, 0.9, -1.55), V(0.16 * sd, 0.7, -1.78), V(0.03 * sd, 0.62, -1.92)], 0.05, 0.008, bone, undefined, 12, 8));
    }
    for (const dx of [-0.09, 0.02, 0.11]) { body.add(tube([V(dx, 0.9, -1.74), V(dx, 0.7, -1.76), V(dx, 0.5 - Math.abs(dx), -1.74)], 0.013, 0.006, DRIP, undefined, 8, 5)); const dp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), DRIP); dp.scale.y = 1.5; dp.position.set(dx, 0.46 - Math.abs(dx), -1.74); body.add(dp); }
    // two huge raised hook-claws: shoulder pauldron, up to a spiked elbow, a long forearm, a sawn blade and a thumb
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.5 * sd, 1.3, -0.55);
      const el = V(0.36 * sd, 0.62, -0.3), wr = V(0.3 * sd, 0.46, -1.2);
      arm.add(tube([V(0, 0, 0), V(0.2 * sd, 0.4, -0.04), el], 0.16, 0.1, hull, k => 1 + 0.18 * Math.sin(k * 3.1), 14, 9));
      const jt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 9), plate); jt.position.copy(el); arm.add(jt); arm.add(cone(0.06, 0.34, plate, el.clone().add(V(0.04 * sd, 0.14, 0.12)), [0.7, 0, -0.3 * sd]));
      arm.add(tube([el, V(0.37 * sd, 0.62, -0.75), wr], 0.105, 0.075, hull, undefined, 14, 9));
      const fp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), plate); fp.scale.set(0.9, 0.55, 3.2); fp.position.set(0.37 * sd, 0.7, -0.78); fp.rotation.x = 0.1; arm.add(fp);
      const wt = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 6, 14), plate); wt.position.copy(wr); wt.rotation.x = Math.PI / 2 - 0.4; arm.add(wt);
      const k = sd < 0 ? 0.82 : 1;   // the left blade is chipped short
      const bl = new THREE.Group(); bl.position.copy(wr); bl.scale.x = 0.55; arm.add(bl);   // the blade is a flat razor: thin seen from the front, wide from the side
      const bp = [V(0, 0, 0), V(-0.05 * sd, -0.1, -0.5 * k), V(-0.16 * sd, -0.33, -0.8 * k), V(-0.24 * sd, -0.6, -0.7 * k)];
      bl.add(tube(bp, 0.1, 0.006, bone, t => 1 + 0.5 * Math.sin(t * 3.1), 18, 8)); serr(bl, bp, sd < 0 ? 5 : 6, 0.2, 0.92, 0.03, 0.12, V(-sd * 0.3, -0.8, -0.3), bone);
      arm.add(tube([V(0.3 * sd, 0.42, -1.14), V(0.38 * sd, 0.2, -1.4), V(0.3 * sd, -0.06, -1.42)], 0.05, 0.006, bone, undefined, 12, 7));
      if (sd > 0) arm.add(tube([V(0.38 * sd, 0.66, -0.7), V(0.4 * sd, 0.58, -0.9)], 0.014, 0.014, seam, undefined, 6, 5));   // a glowing gash across the forearm
      body.add(arm); arms.push(arm);
    }
    // four thick spiked legs with a high knee
    for (let i = 0; i < 4; i++) {
      const sd = i % 2 ? 1 : -1, fr = i < 2, lg = new THREE.Group(), kn = V(0.6, 0.74, 0), ft = V(1.02, -0.98, 0);
      lg.add(tube([V(0, 0, 0), V(0.3, 0.5, 0), kn], 0.18, 0.12, hull, k => 1 + 0.15 * Math.sin(k * 3), 12, 10));
      const th = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), plate); th.scale.set(1.5, 0.7, 1.0); th.position.set(0.33, 0.55, 0); th.rotation.z = 0.8; lg.add(th);
      const kj = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 9), plate); kj.position.copy(kn); lg.add(kj); lg.add(cone(0.075, 0.42, plate, kn.clone().add(V(0, 0.26, 0))));
      lg.add(tube([kn, V(0.86, 0.12, 0), ft], 0.12, 0.022, hull, k => 1 + 0.3 * Math.sin(k * 3), 14, 9));
      serr(lg, [kn, V(0.86, 0.12, 0), ft], 3, 0.25, 0.75, 0.03, 0.16, V(1, 0.35, 0), bone);
      lg.add(cone(0.035, 0.24, bone, ft.clone().add(V(0, -0.08, 0)), [Math.PI, 0, 0]));
      lg.scale.x = sd; lg.position.set(0.4 * sd, 1.0, fr ? -0.5 : 0.62); lg.rotation.y = (fr ? 0.5 : -0.38) * sd; g.add(lg); legs.push(lg);
    }
  } else if (kind === "saberlord") {   // a towering warlord in battered blue-steel plate (own design in the mood of the clan-lord hunter of the films): hunched forward, a horned skull helm (one horn snapped), four hooked mandibles round a fanged mouth, spiked pauldrons, a ragged cape, a rune shield on the left forearm and a great crescent plasma sabre in the right fist, a glowing sigil on the chest, boots with toe claws; knees bent forward
    const PL = { map: HUNT_PLATE, bumpMap: HUNT_PLATE, bumpScale: 0.7 };
    const ar = mk(CHIT(0x4a7cf0, { ...PL, roughness: 0.34, metalness: 0.55, clearcoat: 0.5 })), ar2 = mk(CHIT(0x2a3f94, { ...PL, roughness: 0.38, metalness: 0.5, clearcoat: 0.5 })), gd = mk(CHIT(0xd8b04c, { ...PL, roughness: 0.3, metalness: 0.75, clearcoat: 0.7 }));
    const hide = mk(CHIT(0x40343a, { map: HUNT_NET, bumpMap: HUNT_NET, bumpScale: 0.8, roughness: 0.55, metalness: 0.05, clearcoat: 0.35 })), bn = mk(CHIT(0xcdbd90, { map: null, roughness: 0.36, metalness: 0.05 })), dk = mk(CHIT(0x0a0c14, { map: null, roughness: 0.3, metalness: 0.75 })), cl = mk(CHIT(0x1c1236, { map: null, roughness: 0.88, metalness: 0, clearcoat: 0 }));
    (cl as any).side = THREE.DoubleSide;
    const cy = GLOW(0x66ccff), amb = GLOW(0xffc23a), red = GLOW(0xff3a2a);
    const ball = (r: number, m: THREE.Material, sx = 1, sy = 1, sz = 1, seg = 14) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), m); o.scale.set(sx, sy, sz); return o; };
    const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
    const fit = <T extends THREE.Object3D>(o: T, a: THREE.Vector3, b: THREE.Vector3, axis = V(0, 0, 1)): T => { o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(axis, b.clone().sub(a).normalize()); return o; };
    const T = (pts: THREE.Vector3[], r0: number, r1: number, m: THREE.Material, prof?: (k: number) => number, seg = 10, rad = 8) => tube(pts, r0, r1, m, prof, seg, rad);
    const HIP = 1.28;
    /* the upper body leans forward about the waist: the lord's hunch */
    const up = new THREE.Group(); { const la = 0.2; up.rotation.x = la; up.position.set(0, HIP * (1 - Math.cos(la)), -HIP * Math.sin(la)); body.add(up); }
    const arc = (r: number, h: number, a: number, m: THREE.Material, y: number, sx: number, sz: number, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 22, 1, true, -a, a * 2), m); o.scale.set(sx, 1, sz); o.position.set(0, y, z); (m as any).side = THREE.DoubleSide; up.add(o); return o; };
    /* pelvis, belt, hanging tassets, a ragged tabard and two trophy skulls */
    body.add(put(ball(0.3, ar2, 1.15, 0.62, 0.9, 16), 0, HIP, 0));
    body.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.055, 8, 26), gd), 0, HIP + 0.1, 0, Math.PI / 2));
    body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.05), gd), 0, HIP + 0.08, 0.31)); body.add(put(ball(0.03, cy, 1, 1, 0.8, 8), 0, HIP + 0.08, 0.345));
    for (const sd of [-1, 1]) { body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.035), ar2), 0.2 * sd, HIP - 0.1, 0.27, 0.22, 0, 0.12 * sd)); body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), gd), 0.2 * sd, HIP - 0.26, 0.3, 0.22, 0, 0.12 * sd)); body.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.03), cl), 0.18 * sd, HIP - 0.14, -0.27, -0.2, 0, 0.05 * sd)); }
    { const tab = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.025), cl); tab.position.set(0, HIP - 0.3, 0.31); tab.rotation.x = 0.14; body.add(tab); for (let i = 0; i < 4; i++) body.add(cone(0.035, 0.12, cl, V(-0.1 + i * 0.067, HIP - 0.64, 0.34), [Math.PI, 0, 0])); }
    for (const [sx, sy, sz, sr] of [[-0.34, 1.12, 0.2, 0.06], [-0.4, 0.98, 0.14, 0.05]]) { const sk = new THREE.Group(); sk.position.set(sx, sy, sz); sk.add(ball(sr, bn, 1, 1.08, 1.1, 12)); for (const e of [-1, 1]) sk.add(put(ball(sr * 0.3, dk, 1, 1, 0.6, 6), sr * 0.38 * e, sr * 0.15, sr * 0.85)); sk.add(put(new THREE.Mesh(new THREE.BoxGeometry(sr * 0.9, sr * 0.4, sr * 0.8), bn), 0, -sr * 0.9, sr * 0.2)); body.add(sk); }
    body.add(T([V(-0.3, HIP + 0.04, 0.2), V(-0.34, HIP - 0.06, 0.22), V(-0.35, 1.14, 0.2)], 0.01, 0.01, dk, undefined, 6, 5));
    /* waist and chest: a segmented abdomen, a deep barrel chest under a plate breastpiece with a raised ridge, a glowing sigil, a battle scar */
    { const ab = T([V(0, 1.3, 0), V(0, 1.52, 0.01), V(0, 1.78, 0)], 0.21, 0.27, hide, k => 1 + 0.06 * Math.sin(k * 3.1), 10, 14); ab.scale.set(1.05, 1, 0.8); up.add(ab); }
    { const ch = T([V(0, 1.74, 0), V(0, 1.98, 0.02), V(0, 2.22, 0)], 0.3, 0.34, hide, k => 1 + 0.1 * Math.sin(k * 3.14), 10, 18); ch.scale.set(1.36, 1, 0.9); up.add(ch); }
    for (let i = 0; i < 3; i++) arc(0.255 - i * 0.008, 0.075, 0.82, ar2, 1.46 - i * 0.1, 1.08, 0.8);
    arc(0.36, 0.52, 1.12, ar, 1.98, 1.36, 0.9); arc(0.37, 0.05, 1.16, gd, 2.26, 1.36, 0.9); arc(0.37, 0.05, 1.16, gd, 1.72, 1.36, 0.9);
    up.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.07), gd), 0, 1.99, 0.345, -0.04));
    up.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 20), cy), 0, 2.05, 0.355)); up.add(put(ball(0.04, cy, 1, 1, 0.7, 10), 0, 2.05, 0.37));
    for (const sd of [-1, 1]) up.add(fit(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.16), cy), V(0.1 * sd, 2.1, 0.35), V(0.2 * sd, 2.2, 0.34)));
    up.add(T([V(0.12, 2.18, 0.34), V(0.0, 2.0, 0.36), V(-0.14, 1.82, 0.35)], 0.014, 0.012, dk, undefined, 8, 5));   // a deep scar across the plate
    for (const sd of [-1, 1]) { up.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.014, 0.02), gd), 0.19 * sd, 1.86, 0.325, 0, 0, 0.18 * sd)); up.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.4, 0.02), dk), 0.27 * sd, 1.98, 0.3, 0, 0, 0.12 * sd)); }
    up.add(T([V(0.1, 2.1, 0.355), V(-0.02, 1.98, 0.37), V(-0.12, 1.86, 0.36)], 0.006, 0.006, cy, undefined, 8, 4));
    /* the neck, a gold gorget and a fan of back-swept collar blades */
    up.add(T([V(0, 2.2, 0), V(0, 2.34, 0.05), V(0, 2.46, 0.1)], 0.14, 0.11, hide, undefined, 6, 10));
    up.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 8, 22), gd), 0, 2.27, 0.02, Math.PI / 2 - 0.15));
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.42; up.add(cone(0.045, 0.5 - Math.abs(i - 2) * 0.07, ar2, V(Math.sin(a) * 0.22, 2.4 + Math.cos(a) * 0.06, -0.14 - Math.cos(a) * 0.04), [-0.75, 0, -a * 0.8])); }
    /* the pack on the back: twin emitters with glowing vents, and the ragged cape */
    { const pk = new THREE.Group(); pk.position.set(0, 1.95, -0.4); pk.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.15), ar2)); for (let i = 0; i < 3; i++) pk.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.022, 0.02), cy), 0, 0.12 - i * 0.09, -0.085)); for (const sd of [-1, 1]) { pk.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 10), dk), 0.17 * sd, 0.34, -0.02)); pk.add(put(ball(0.04, cy, 1, 0.6, 1, 8), 0.17 * sd, 0.55, -0.02)); } up.add(pk); }
    const capeG = new THREE.Group(); capeG.position.set(0, 2.3, -0.3); up.add(capeG);
    { const NU = 9, NV = 8, pos: number[] = [], idx: number[] = []; for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const u = i / NU - 0.5, v = j / NV, w = 0.46 + 0.22 * v, rag = j === NV ? (i % 2 ? -0.3 : 0.02) : j === NV - 1 ? (i % 3 === 0 ? -0.06 : 0) : 0; pos.push(u * 2 * w * 0.92, -v * 1.6 + rag, -0.04 - v * 0.3 - 0.1 * Math.cos(u * 3) + 0.05 * Math.sin(i * 1.3 + j * 0.9)); }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); capeG.add(new THREE.Mesh(geo, cl)); }
    /* shoulders: stacked pauldrons with spikes (the left one is chipped and cracked, one spike snapped) */
    for (const sd of [-1, 1]) {
      up.add(put(ball(0.22, ar, 1.3, 0.78, 1.18, 18), 0.58 * sd, 2.14, 0, 0, 0, -0.3 * sd)); up.add(put(ball(0.17, ar2, 1.2, 0.5, 1.1, 14), 0.6 * sd, 2.25, 0, 0, 0, -0.3 * sd));
      up.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.022, 6, 26), gd), 0.62 * sd, 2.02, 0, Math.PI / 2, 0, -0.3 * sd));
      for (let k = 0; k < 3; k++) { const brk = sd < 0 && k === 1; up.add(cone(0.05 - k * 0.006, brk ? 0.12 : 0.34 - k * 0.04, bn, V((0.66 + k * 0.1) * sd, 2.34 - k * 0.04, -0.06 + k * 0.1), [0, 0, -(0.9 + k * 0.25) * sd])); }
    }
    up.add(T([V(-0.54, 2.3, 0.1), V(-0.6, 2.2, 0.16), V(-0.68, 2.12, 0.14)], 0.008, 0.008, cy, undefined, 8, 4));
    /* arms: bare hide under bicep plate, an elbow spike, a gold-ringed bracer; the right fist holds the sabre, the left carries the rune shield */
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.6 * sd, 2.06, 0);
      arm.add(T([V(0, 0, 0), V(0.06 * sd, -0.3, 0.04), V(0.1 * sd, -0.56, 0.1)], 0.13, 0.095, hide, k => 1 + 0.15 * Math.sin(k * 3.1), 10, 10));
      arm.add(T([V(0.01 * sd, -0.04, 0.02), V(0.06 * sd, -0.22, 0.05), V(0.09 * sd, -0.4, 0.09)], 0.15, 0.115, ar, k => 1 + 0.1 * Math.sin(k * 3.1), 8, 12));
      arm.add(put(ball(0.1, ar2, 1, 1, 1, 12), 0.1 * sd, -0.58, 0.1)); arm.add(cone(0.05, 0.22, bn, V(0.2 * sd, -0.62, -0.02), [-0.5, 0, -1.2 * sd]));
      const wr = sd > 0 ? V(0.07, -0.64, 0.78) : V(-0.04, -0.5, 0.66), el = V(0.1 * sd, -0.58, 0.1);
      arm.add(T([el, el.clone().lerp(wr, 0.5).add(V(0, -0.03, 0)), wr], 0.085, 0.07, hide, undefined, 8, 10)); arm.add(T([el.clone().lerp(wr, 0.18), el.clone().lerp(wr, 0.6), el.clone().lerp(wr, 0.92)], 0.115, 0.09, ar2, k => 1 + 0.1 * Math.sin(k * 3.1), 8, 12));
      for (const k of [0.3, 0.55, 0.8]) { const p = el.clone().lerp(wr, k); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.1 - k * 0.012, 0.014, 6, 16), gd); rg.position.copy(p); rg.quaternion.setFromUnitVectors(V(0, 0, 1), wr.clone().sub(el).normalize()); arm.add(rg); }
      if (sd > 0) {
        /* the right fist, a hilt, a guard with up-swept horns and a gem, the emitter, then the blade: a thick glowing crescent with a white core */
        arm.add(put(ball(0.082, dk, 1.1, 1, 1.1, 12), 0.07, -0.66, 0.84)); for (let f = 0; f < 4; f++) { arm.add(put(ball(0.026, dk, 1, 1, 1, 6), 0.07 + (f - 1.5) * 0.034, -0.64, 0.92)); arm.add(cone(0.014, 0.07, bn, V(0.07 + (f - 1.5) * 0.034, -0.64, 0.96), [Math.PI / 2, 0, 0])); }
        arm.add(T([V(0.07, -0.9, 0.86), V(0.07, -0.55, 0.88), V(0.07, -0.34, 0.89)], 0.032, 0.032, dk, undefined, 6, 8));
        arm.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.07), gd), 0.07, -0.36, 0.89)); for (const e of [-1, 1]) arm.add(cone(0.02, 0.16, gd, V(0.07 + 0.19 * e, -0.31, 0.89), [0, 0, -0.55 * e])); arm.add(put(ball(0.03, cy, 1, 1, 0.8, 8), 0.07, -0.36, 0.935));
        arm.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), dk), 0.07, -0.3, 0.89)); arm.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.01, 6, 14), cy), 0.07, -0.25, 0.89, Math.PI / 2));
        const BP = [V(0, 0, 0), V(0.05, 0.45, 0), V(0.1, 0.92, 0), V(0.03, 1.24, 0), V(-0.1, 1.42, 0)], blade = new THREE.Group(); blade.position.set(0.07, -0.24, 0.89); blade.rotation.x = 0.2; arm.add(blade);
        const bw = (k: number) => 0.55 + 0.85 * Math.sin(Math.PI * Math.pow(Math.min(1, k * 1.04), 0.65));
        const ob = new THREE.MeshBasicMaterial({ color: 0x4fb8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), cb = new THREE.MeshBasicMaterial({ color: 0xeafcff, fog: false });
        const outer = T(BP, 0.14, 0.014, ob, bw, 18, 8); outer.scale.z = 0.4; blade.add(outer); const core = T(BP, 0.05, 0.006, cb, bw, 18, 6); core.scale.z = 0.55; blade.add(core);
        const bc = new THREE.CatmullRomCurve3(BP), bh: THREE.Sprite[] = []; for (const k of [0.2, 0.5, 0.78, 1]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x66ccff, transparent: true, opacity: k === 1 ? 0.9 : 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(k === 1 ? 0.5 : 0.8); sp.position.copy(bc.getPoint(k)); blade.add(sp); bh.push(sp); }
        const sparks: THREE.Mesh[] = []; for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), cb); s.position.copy(bc.getPoint(0.7 + i * 0.1)); blade.add(s); sparks.push(s); }
        (g as any).userData.bl = { ob, bh, sparks, bc };
      } else {
        /* the rune shield on the left forearm: an oval plate with a gold rim, six spikes, a glowing ring and glyph, and the clawed hand below it */
        const sh = new THREE.Group(); sh.position.set(-0.2, -0.5, 0.42); sh.rotation.y = -0.55; arm.add(sh);
        { const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 24), ar2); disc.rotation.x = Math.PI / 2; disc.scale.set(1, 1, 1.28); sh.add(disc); const dome = ball(0.2, ar, 1, 1.28, 0.38, 16); dome.position.z = 0.04; sh.add(dome); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.026, 8, 30), gd); rim.scale.set(1, 1.28, 1); sh.add(rim);
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; sh.add(cone(0.032, 0.17, bn, V(Math.cos(a) * 0.29, Math.sin(a) * 0.37, 0.02), [0, 0, a - Math.PI / 2])); }
          const rr = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 24), cy); rr.scale.set(1, 1.28, 1); rr.position.z = 0.075; sh.add(rr); sh.add(put(ball(0.045, cy, 1, 1, 0.6, 10), 0, 0, 0.1));
          for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; sh.add(fit(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.1), cy), V(Math.cos(a) * 0.06, Math.sin(a) * 0.08, 0.085), V(Math.cos(a) * 0.12, Math.sin(a) * 0.15, 0.075))); }
          sh.add(T([V(-0.2, 0.18, 0.05), V(-0.08, 0.06, 0.07), V(-0.12, -0.12, 0.06)], 0.008, 0.008, dk, undefined, 8, 4)); }   // a crack in the plate
        arm.add(put(ball(0.075, dk, 1.1, 1, 1.15, 10), wr.x, wr.y - 0.02, wr.z + 0.04)); for (let f = 0; f < 4; f++) arm.add(T([V(wr.x + (f - 1.5) * 0.04, wr.y - 0.0, wr.z + 0.08), V(wr.x + (f - 1.5) * 0.045, wr.y + 0.06, wr.z + 0.17), V(wr.x + (f - 1.5) * 0.04, wr.y + 0.17, wr.z + 0.17)], 0.02, 0.006, bn, undefined, 6, 5));
      }
      up.add(arm); arms.push(arm);
    }
    /* legs: hide thigh under a cuisse, a knee spike forward, a plated greave, a gold ankle ring and a clawed boot; the sole is on the floor */
    for (const sd of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(0.27 * sd, HIP, 0);
      lg.add(T([V(0, 0, 0), V(0.03 * sd, -0.34, 0.12), V(0.04 * sd, -0.62, 0.28)], 0.19, 0.12, hide, k => 1 + 0.06 * Math.sin(k * 3.1), 8, 12));
      lg.add(put(ball(0.17, ar, 0.85, 1.7, 0.7, 14), 0.03 * sd, -0.3, 0.2, -0.4)); lg.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 18), gd), 0.03 * sd, -0.12, 0.08, Math.PI / 2 - 0.35));
      lg.add(put(ball(0.12, ar, 1, 1, 0.9, 14), 0.04 * sd, -0.64, 0.3)); lg.add(cone(0.06, 0.26, bn, V(0.04 * sd, -0.66, 0.46), [Math.PI / 2, 0, 0]));
      lg.add(T([V(0.04 * sd, -0.64, 0.28), V(0.05 * sd, -0.9, 0.1), V(0.05 * sd, -1.1, 0.0)], 0.125, 0.085, ar2, k => 1 + 0.05 * Math.sin(k * 3.1), 8, 12));
      lg.add(T([V(0.04 * sd, -0.7, 0.33), V(0.05 * sd, -0.92, 0.15), V(0.05 * sd, -1.08, 0.07)], 0.1, 0.075, ar, undefined, 8, 10));
      lg.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 6, 16), gd), 0.05 * sd, -1.1, 0.0, Math.PI / 2));
      lg.add(T([V(0.04 * sd, -0.76, 0.34), V(0.05 * sd, -0.92, 0.2), V(0.05 * sd, -1.04, 0.12)], 0.008, 0.008, cy, undefined, 8, 4)); lg.add(T([V(0.1 * sd, -0.18, 0.3), V(0.08 * sd, -0.34, 0.36), V(0.1 * sd, -0.5, 0.36)], 0.007, 0.007, cy, undefined, 8, 4));
      lg.add(put(ball(0.125, ar2, 1, 0.8, 1.75, 14), 0.05 * sd, -1.17, 0.15)); lg.add(put(ball(0.115, dk, 1.1, 0.24, 2.3, 12), 0.05 * sd, -1.255, 0.19));
      for (let i = 0; i < 3; i++) lg.add(cone(0.032, 0.17, bn, V((0.05 + (i - 1) * 0.052) * sd, -1.225, 0.45), [Math.PI / 2 + 0.25, 0, 0]));
      lg.add(cone(0.03, 0.14, bn, V(0.05 * sd, -1.17, -0.11), [-Math.PI / 2 + 0.2, 0, 0]));
      g.add(lg); legs.push(lg);
    }
    /* the head: a long horned skull helm, a gold brow and nose ridge, amber eyes with slit pupils and a wet glint, cheek guards, a crest of blades, a dark fanged mouth between four hooked mandibles */
    const head = new THREE.Group(); head.position.set(0, 2.72, 0.18); head.scale.setScalar(1.55); up.add(head);
    head.add(put(ball(0.19, ar, 0.92, 1.28, 1.3, 20), 0, 0.08, -0.04)); head.add(put(ball(0.15, ar2, 0.86, 1.2, 0.62, 18), 0, -0.02, 0.14));
    head.add(T([V(-0.2, 0.13, 0.04), V(-0.1, 0.145, 0.2), V(0, 0.115, 0.245), V(0.1, 0.145, 0.2), V(0.2, 0.13, 0.04)], 0.042, 0.042, gd, undefined, 14, 8));
    head.add(T([V(0, 0.22, 0.05), V(0, 0.11, 0.22), V(0, -0.02, 0.265), V(0, -0.08, 0.21)], 0.034, 0.022, gd, undefined, 10, 8));
    head.add(put(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), cy), 0, 0.2, 0.2));
    head.add(eyes(amb, 0.075, 0.21, 0.085, 0.034));
    for (const sd of [-1, 1]) { head.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.05, 0.012), dk), 0.085 * sd, 0.075, 0.235)); head.add(put(ball(0.008, GLOW(0xffffff), 1, 1, 1, 5), 0.075 * sd, 0.092, 0.24)); head.add(put(ball(0.1, ar, 0.5, 1, 0.8, 12), 0.18 * sd, -0.06, 0.1, 0, 0, 0.15 * sd)); head.add(T([V(0.07 * sd, 0.2, 0.2), V(0.1 * sd, 0.12, 0.24), V(0.11 * sd, 0.0, 0.25)], 0.008, 0.008, cy, undefined, 8, 4)); }
    for (let i = 0; i < 5; i++) head.add(cone(0.026, 0.24 - i * 0.025, i % 2 ? dk : ar2, V(0, 0.28 + (i === 0 ? 0 : 0.03), -0.06 - i * 0.075), [-(0.7 + i * 0.12), 0, 0]));
    head.add(T([V(0.1, 0.2, 0.0), V(0.26, 0.34, -0.14), V(0.38, 0.62, -0.28), V(0.33, 0.96, -0.3)], 0.065, 0.007, bn, k => 1 + 0.1 * Math.sin(k * 20), 14, 8));   // the whole horn
    head.add(T([V(-0.1, 0.2, 0.0), V(-0.25, 0.31, -0.12), V(-0.32, 0.43, -0.18)], 0.065, 0.034, bn, k => 1 + 0.1 * Math.sin(k * 20), 8, 8)); head.add(cone(0.03, 0.09, bn, V(-0.34, 0.5, -0.2), [0.3, 0.4, 0.5])); head.add(put(ball(0.03, cy, 1, 0.5, 1, 6), -0.33, 0.46, -0.19));   // the snapped horn, a glow in the break
    head.add(put(ball(0.1, dk, 0.95, 0.66, 0.6, 14), 0, -0.14, 0.18)); head.add(put(ball(0.05, GLOW(0xff4a2a), 1.4, 0.5, 0.6, 8), 0, -0.145, 0.205));
    for (let i = 0; i < 6; i++) head.add(cone(0.014 + (i === 1 || i === 4 ? 0.006 : 0), 0.07 + (i === 1 || i === 4 ? 0.04 : 0), bn, V(-0.075 + i * 0.03, -0.1, 0.235), [Math.PI, 0, 0]));
    for (const sd of [-1, 1]) head.add(cone(0.016, 0.1, bn, V(0.06 * sd, -0.2, 0.225), [0, 0, 0.1 * sd]));
    head.add(T([V(-0.05, -0.24, 0.2), V(-0.04, -0.34, 0.21), V(-0.04, -0.44, 0.21)], 0.005, 0.004, DRIP, undefined, 4, 4)); const dr = ball(0.014, DRIP, 1, 1.9, 1, 6); dr.position.set(-0.04, -0.47, 0.21); head.add(dr);
    const mand: { g: THREE.Group; sd: number; ph: number }[] = [];
    for (const sd of [-1, 1]) for (let r = 0; r < 2; r++) {
      const root = V((0.09 - r * 0.04) * sd, -0.12 - r * 0.03, 0.2), rel = (x: number, y: number, z: number) => V(x * sd - root.x, y - root.y, z - root.z) as THREE.Vector3;
      const m = new THREE.Group(); m.position.copy(root);
      const pts = r === 0 ? [rel(0.09, -0.12, 0.2), rel(0.2, -0.17, 0.22), rel(0.27, -0.28, 0.2), rel(0.21, -0.4, 0.24)] : [rel(0.05, -0.15, 0.22), rel(0.09, -0.23, 0.27), rel(0.07, -0.33, 0.29)];
      m.add(T(pts, r === 0 ? 0.05 : 0.036, 0.006, bn, k => 1 + 0.12 * Math.sin(k * 16), 12, 8)); m.add(put(ball(r === 0 ? 0.05 : 0.038, gd, 1, 1, 1, 8), 0, 0, 0)); head.add(m); mand.push({ g: m, sd, ph: r * 1.7 + (sd > 0 ? 0.9 : 0) });
    }
    (g as any).userData.tick = (t: number) => {
      for (const o of mand) { o.g.rotation.z = o.sd * (0.06 * Math.sin(t * 2.6 + o.ph)); o.g.rotation.x = 0.05 * Math.sin(t * 3.1 + o.ph); }
      capeG.rotation.x = 0.05 + 0.04 * Math.sin(t * 1.6); capeG.rotation.z = 0.025 * Math.sin(t * 1.1);
      const k = (t * 0.6) % 1; dr.position.y = -0.47 - k * 0.3; dr.scale.set(1 - k * 0.4, 1.9 * (1 - k * 0.3), 1 - k * 0.4);
      const bl = (g as any).userData.bl; if (bl) { bl.ob.opacity = 0.46 + 0.1 * Math.sin(t * 9); bl.bh.forEach((s: THREE.Sprite, i: number) => { s.material.opacity = (i === 3 ? 0.8 : 0.45) + 0.12 * Math.sin(t * 8 + i * 1.7); }); bl.sparks.forEach((s: THREE.Mesh, i: number) => { const p = bl.bc.getPoint(0.72 + 0.28 * ((t * 0.9 + i * 0.27) % 1)); s.position.set(p.x + 0.06 * Math.sin(t * 13 + i), p.y, p.z + 0.06 * Math.cos(t * 11 + i * 2)); s.rotation.y = t * 6; }); }
    };
  } else if (kind === "skyfolk") {   // a tall blue forest warrior (own design in the mood of a great blue hunter-people): striped azure skin, a hunched predatory stance, big golden slit-pupil eyes under a heavy brow, tall pointed ears (one broken), a fanged snarl, a long braid ending in glowing neural tendrils, a tail, long clawed hands, a recurve bow with a glowing string, a quiver, a bone necklace and a bone knife
    const K = 0.95, B = new THREE.Group(); B.scale.setScalar(K); body.add(B);   // the whole figure is built at its own size, then fitted to the hit box
    const S1 = skyFolkTex(0), S2 = skyFolkTex(1);
    const so = { roughness: 0.46, metalness: 0.02, clearcoat: 0.5, clearcoatRoughness: 0.3 };
    const skin = mk(CHIT(0xffffff, { map: S1, ...so })), skinH = mk(CHIT(0xffffff, { map: S2, ...so }));
    for (const sm of [skin, skinH]) { sm.emissive.setHex(0x1c4fa8); sm.emissiveIntensity = 0.38; }   // keeps the blue readable against the dusk in the Lite look
    const navy = mk(CHIT(0x0a1a56, { roughness: 0.5 })), bone = mk(CHIT(0xe8dfc4, { roughness: 0.5, clearcoat: 0.15 })), hide = mk(CHIT(0x3a2214, { roughness: 0.9, clearcoat: 0, metalness: 0 })), gold = mk(CHIT(0xc9a23c, { metalness: 0.85, roughness: 0.3 })), wood = mk(CHIT(0x4a2e1a, { roughness: 0.6, clearcoat: 0.3 }));
    const cyan = GLOW(0x66ffee), eyeG = GLOW(0xffc22a); eyeG.emissiveIntensity = 3.0;
    const pupilM = new THREE.MeshBasicMaterial({ color: 0x07040a }), hiM = new THREE.MeshBasicMaterial({ color: 0xffffff }), mouthM = new THREE.MeshBasicMaterial({ color: 0x14050a });
    const halo = (c: number, s: number, o: number, p: THREE.Vector3, parent: THREE.Object3D) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(s); sp.position.copy(p); parent.add(sp); return sp; };
    const sph = (r: number, m: THREE.Material, p: THREE.Vector3, s: [number, number, number] = [1, 1, 1], parent: THREE.Object3D = B, seg = 14) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), m); o.position.copy(p); o.scale.set(s[0], s[1], s[2]); parent.add(o); return o; };
    // torso: hunched, wide at the chest, narrow at the waist; pecs, wide shoulder line, thick neck
    const torso = tube([V(0, 1.36, -0.03), V(0, 1.62, 0.02), V(0, 1.9, 0.11), V(0, 2.13, 0.22)], 0.17, 0.2, skin, k => 1 - 0.18 * Math.exp(-(((k - 0.2) / 0.15) ** 2)) + 0.32 * Math.exp(-(((k - 0.75) / 0.22) ** 2)), 22, 16); torso.scale.set(1.28, 1, 0.92); B.add(torso);
    for (const sd of [-1, 1]) { sph(0.105, skin, V(0.115 * sd, 1.96, 0.2), [1.15, 0.85, 0.75]); sph(0.11, skin, V(0.345 * sd, 2.08, 0.1), [1, 1.1, 1]); }
    B.add(tube([V(-0.33, 2.1, 0.1), V(-0.15, 2.19, 0.17), V(0, 2.2, 0.2), V(0.15, 2.19, 0.17), V(0.33, 2.1, 0.1)], 0.075, 0.075, skin, undefined, 16, 10));
    B.add(tube([V(0, 2.14, 0.21), V(0, 2.3, 0.31), V(0, 2.4, 0.42)], 0.1, 0.075, skin, undefined, 10, 10));
    // belt, loincloth, bone knife
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.032, 8, 24), gold); belt.rotation.x = Math.PI / 2; belt.scale.set(1.12, 0.9, 1); belt.position.set(0, 1.38, -0.02); B.add(belt);
    sph(0.05, cyan, V(0, 1.38, 0.16), [1, 1, 0.5]);
    for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.065, len = 0.3 + (i % 3) * 0.06; for (const fz of [1, -1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.055, len, 0.012), hide); st.position.set(x * (fz > 0 ? 1 : 0.8), 1.35 - len / 2, fz > 0 ? 0.17 : -0.2); st.rotation.x = fz * 0.12; B.add(st); sph(0.013, cyan, V(x * (fz > 0 ? 1 : 0.8), 1.35 - len, fz > 0 ? 0.185 : -0.215), [1, 1, 1], B, 6); } }
    B.add(tube([V(-0.24, 1.42, 0.02), V(-0.28, 1.28, 0.03), V(-0.27, 1.12, 0.07)], 0.028, 0.014, bone, undefined, 8, 6)); B.add(tube([V(-0.24, 1.46, 0.02), V(-0.245, 1.38, 0.02)], 0.026, 0.026, hide, undefined, 4, 6));
    // head (group: pitched down at the player, turns in the tick)
    const hd = new THREE.Group(); hd.position.set(0, 2.55, 0.46); hd.rotation.x = 0.16; hd.scale.setScalar(1.3); B.add(hd);
    sph(0.2, skinH, V(0, 0, 0), [0.9, 1.12, 1.05], hd, 20);
    sph(0.06, skinH, V(0, -0.17, 0.12), [0.95, 0.9, 1], hd); for (const sd of [-1, 1]) sph(0.05, skinH, V(0.115 * sd, -0.03, 0.14), [1, 0.8, 0.9], hd, 10);
    hd.add(tube([V(-0.195, 0.07, 0.1), V(-0.1, 0.1, 0.185), V(0, 0.088, 0.205), V(0.1, 0.1, 0.185), V(0.195, 0.07, 0.1)], 0.032, 0.032, navy, undefined, 14, 8));   // the heavy brow
    sph(0.05, skinH, V(0, -0.035, 0.205), [1.1, 0.7, 0.8], hd, 10); hd.add(tube([V(0, 0.07, 0.19), V(0, 0.0, 0.215), V(0, -0.03, 0.225)], 0.02, 0.035, skinH, undefined, 6, 8)); for (const sd of [-1, 1]) sph(0.014, mouthM, V(0.026 * sd, -0.055, 0.238), [1, 0.8, 0.8], hd, 6);
    for (const sd of [-1, 1]) {   // big golden slit-pupil eyes set under the brow, with a wet highlight
      const rm = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 6, 14), navy); rm.position.set(0.09 * sd, 0.015, 0.172); rm.rotation.y = sd * 0.25; hd.add(rm);
      sph(0.056, eyeG, V(0.09 * sd, 0.015, 0.165), [1, 0.82, 0.6], hd, 12); sph(0.05, pupilM, V(0.09 * sd, 0.015, 0.198), [0.2, 0.95, 0.18], hd, 8); sph(0.011, hiM, V(0.075 * sd, 0.04, 0.2), [1, 1, 1], hd, 6);
      halo(0xffc22a, 0.2, 0.5, V(0.09 * sd, 0.015, 0.21), hd);
    }
    { const mp = [V(-0.08, -0.075, 0.165), V(-0.035, -0.105, 0.195), V(0, -0.108, 0.2), V(0.035, -0.105, 0.195), V(0.08, -0.075, 0.165)]; hd.add(tube(mp, 0.011, 0.011, mouthM, undefined, 12, 6)); sph(0.07, mouthM, V(0, -0.115, 0.17), [1, 0.28, 0.35], hd, 8);   // the snarl: a dark open mouth with fangs top and bottom
      for (const x of [-0.065, -0.04, -0.018, 0.018, 0.04, 0.065]) { const f = cone(0.0075, 0.03 + (Math.abs(x) < 0.03 ? 0.02 : 0), bone, V(x, -0.1 - (Math.abs(x) < 0.03 ? 0.018 : 0.006), 0.19 - Math.abs(x) * 0.5), [Math.PI + 0.1, 0, 0]); hd.add(f); }
      for (const x of [-0.03, 0.03]) hd.add(cone(0.007, 0.03, bone, V(x, -0.124, 0.2), [-0.1, 0, 0])); }
    for (const sd of [-1, 1]) { const br = sd > 0, tp = br ? [V(0.17, 0.05, -0.02), V(0.27, 0.12, -0.07), V(0.36, 0.2, -0.12)] : [V(-0.17, 0.05, -0.02), V(-0.3, 0.15, -0.09), V(-0.44, 0.32, -0.18)]; const ear = tube(tp, 0.055, br ? 0.022 : 0.004, skinH, undefined, 10, 8); ear.scale.z = 0.38; hd.add(ear); }   // tall pointed ears; the right one broken short
    hd.add(tube([V(0, 0.2, 0.08), V(0, 0.2, -0.05), V(0, 0.15, -0.2)], 0.028, 0.02, navy, undefined, 10, 6)); for (let i = 0; i < 5; i++) hd.add(cone(0.017 - i * 0.0015, 0.1 - i * 0.008, navy, V(0, 0.215 - i * 0.012, 0.08 - i * 0.065), [-0.5 - i * 0.12, 0, 0]));   // a hair crest
    { const hb = new THREE.Mesh(new THREE.TorusGeometry(0.158, 0.012, 6, 28), gold); hb.rotation.x = Math.PI / 2; hb.scale.set(0.95, 1.1, 1); hb.position.set(0, 0.125, 0.0); hd.add(hb); for (let i = 0; i < 7; i++) { const a = (i - 3) / 3 * 1.2; sph(0.014, cyan, V(Math.sin(a) * 0.149, 0.117, Math.cos(a) * 0.17), [1, 1, 1], hd, 6); } }
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) sph(0.008, cyan, V(sd * (0.13 + i * 0.012), -0.012 - i * 0.035, 0.13 - i * 0.005), [1, 1, 1], hd, 5);   // a trail of freckle-lights down each cheek
    // braid with glowing neural tendrils
    const braid = new THREE.Group(); braid.position.set(0, 2.53, 0.24); B.add(braid);
    braid.add(tube([V(0, 0, 0), V(0, -0.2, -0.14), V(0, -0.55, -0.4), V(0, -0.92, -0.44), V(0, -1.12, -0.38)], 0.05, 0.026, navy, k => 1 + 0.26 * Math.sin(k * 80), 64, 8));
    for (const y of [-0.25, -0.62, -0.95]) { const bd = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.009, 5, 10), gold); bd.position.set(0, y, y < -0.5 ? -0.43 : -0.22); bd.rotation.x = 1.3; braid.add(bd); }
    const tendr: THREE.Mesh[] = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, tp = [V(0, -1.1, -0.38), V(Math.cos(a) * 0.05, -1.2 - 0.04 * (i % 2), -0.38 + Math.sin(a) * 0.05), V(Math.cos(a) * 0.1, -1.33 - 0.06 * (i % 3), -0.38 + Math.sin(a) * 0.1)]; braid.add(tube(tp, 0.011, 0.004, cyan, undefined, 8, 4)); const bl = sph(0.017, cyan, tp[2], [1, 1, 1], braid, 6); tendr.push(bl); }
    halo(0x66ffee, 0.7, 0.75, V(0, -1.22, -0.38), braid);
    // tail
    const tail = new THREE.Group(); tail.position.set(0, 1.3, -0.1); B.add(tail);
    tail.add(tube([V(0, 0, 0), V(0, -0.08, -0.3), V(0, -0.1, -0.72), V(0, -0.02, -1.1), V(0, 0.08, -1.45), V(0, 0.24, -1.7)], 0.075, 0.016, skin, undefined, 26, 10)); sph(0.02, cyan, V(0, 0.25, -1.71), [1, 1, 1], tail, 6);
    // arms: heavy upper arm, long forearm, clawed hand; the bow in the left hand
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.34 * sd, 2.1, 0.1);
      arm.add(tube([V(0, 0, 0), V(0.05 * sd, -0.27, -0.02), V(0.08 * sd, -0.52, 0.0), V(0.09 * sd, -0.78, 0.1), V(0.1 * sd, -1.0, 0.2)], 0.092, 0.05, skin, k => 1 + 0.3 * Math.exp(-(((k - 0.22) / 0.14) ** 2)) + 0.18 * Math.exp(-(((k - 0.62) / 0.1) ** 2)), 18, 12));
      sph(0.058, skin, V(0.1 * sd, -1.07, 0.22), [0.9, 1.3, 0.75], arm, 10);
      for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 0.03, x = 0.1 * sd + dx; arm.add(tube([V(x, -1.1, 0.2), V(x, -1.2, 0.24), V(x * 1.04, -1.27, 0.32)], 0.017, 0.009, skin, undefined, 5, 5)); arm.add(cone(0.011, 0.07, bone, V(x * 1.04, -1.3, 0.35), [1.88, 0, 0])); }
      arm.add(tube([V(0.1 * sd - 0.04 * sd, -1.06, 0.24), V(0.1 * sd - 0.08 * sd, -1.13, 0.3), V(0.1 * sd - 0.1 * sd, -1.17, 0.37)], 0.016, 0.009, skin, undefined, 5, 5));
      if (sd < 0) {   // the recurve bow, held upright: wood limbs with glowing inlay and a glowing string
        const bx = -0.1, bw = [V(0, -0.32, 0.1), V(-0.06, -0.72, 0.21), V(bx, -1.1, 0.3), V(-0.06, -1.48, 0.21), V(0, -1.88, 0.1)]; arm.add(tube(bw, 0.02, 0.02, wood, k => 1 + 0.7 * Math.exp(-(((k - 0.5) / 0.1) ** 2)), 24, 6));
        arm.add(tube([V(0, -0.32, 0.1), V(0, -1.1, 0.1), V(0, -1.88, 0.1)], 0.008, 0.008, cyan, undefined, 4, 4)); halo(0x66ffee, 0.5, 0.35, V(0, -1.1, 0.1), arm);
        for (const y of [-0.55, -0.82, -1.38, -1.65]) { const inl = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), cyan); inl.scale.set(1, 3, 1); inl.position.set(-0.1 + Math.abs(y + 1.1) * 0.14, y, 0.3 - Math.abs(y + 1.1) * 0.26); arm.add(inl); }
        for (const y of [-0.31, -1.89]) arm.add(cone(0.014, 0.1, bone, V(0, y + (y > -1 ? 0.04 : -0.04), 0.1), [y > -1 ? 0.2 : Math.PI - 0.2, 0, 0]));
        arm.add(tube([V(bx, -1.2, 0.3), V(bx, -1.32, 0.3), V(bx, -1.38, 0.3)], 0.01, 0.01, hide, undefined, 4, 5));
      }
      { const ab = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.017, 6, 16), gold); ab.rotation.x = Math.PI / 2; ab.position.set(0.062 * sd, -0.36, 0.0); arm.add(ab); halo(0x66ffee, 0.12, 0.6, V(0.062 * sd, -0.36, 0.1), arm); }   // a gold armband on the bicep with a glowing stud
      { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.2, 10), hide); br.position.set(0.09 * sd, -0.9, 0.12); br.rotation.x = 0.28; arm.add(br); for (const yy of [-0.82, -0.96]) { const lc = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.007, 4, 14), cyan); lc.rotation.x = Math.PI / 2 + 0.28; lc.position.set(0.09 * sd, yy, 0.12 + (yy + 0.9) * 0.28); arm.add(lc); } }   // a hide wrist bracer with glowing lacing
      B.add(arm); arms.push(arm);
      const lg = new THREE.Group(); lg.position.set(0.17 * sd * K, 1.36 * K, 0); lg.scale.setScalar(K);
      lg.add(tube([V(0, 0, 0), V(0, -0.32, 0.08), V(0, -0.64, 0.14), V(0, -0.92, 0.05), V(0, -1.2, -0.06)], 0.15, 0.05, skin, k => 1 + 0.3 * Math.exp(-(((k - 0.7) / 0.12) ** 2)) - 0.12 * Math.exp(-(((k - 0.5) / 0.07) ** 2)), 22, 12));
      lg.add(tube([V(0, -1.2, -0.07), V(0, -1.3, 0.0), V(0, -1.315, 0.14), V(0, -1.32, 0.3)], 0.05, 0.03, skin, undefined, 10, 8));
      for (let k = -1; k <= 1; k++) { lg.add(tube([V(0.03 * k, -1.3, 0.2), V(0.045 * k, -1.32, 0.3)], 0.02, 0.012, skin, undefined, 4, 5)); lg.add(cone(0.011, 0.07, bone, V(0.05 * k, -1.325, 0.36), [Math.PI / 2 + 0.2, 0, 0])); }
      sph(0.055, navy, V(0, -0.64, 0.19), [1, 0.9, 0.7], lg, 8);
      g.add(lg); legs.push(lg);
    }
    // quiver, arrows, necklace, shoulder bone spikes
    { const qv = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.62, 10), hide); qv.position.set(0.1, 1.98, -0.27); qv.rotation.set(0.15, 0, -0.38); B.add(qv); for (let i = 0; i < 4; i++) { const a = new THREE.Group(); a.position.set(0.1 + (i - 1.5) * 0.018 + 0.12, 2.3 + (i % 2) * 0.03, -0.27 + (i % 2 ? 0.01 : -0.01)); a.rotation.set(0.15, 0, -0.38); a.add(cone(0.01, 0.2, bone, V(0, 0.1, 0), [0, 0, 0]), cone(0.026, 0.09, cyan, V(0, 0.2, 0), [0, 0, 0])); B.add(a); }
      B.add(tube([V(-0.22, 2.12, 0.14), V(-0.02, 1.9, 0.24), V(0.22, 1.56, 0.2)], 0.016, 0.016, hide, undefined, 14, 5));
      const nk = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 24), hide); nk.rotation.x = Math.PI / 2 - 0.45; nk.scale.set(1, 0.95, 1); nk.position.set(0, 2.15, 0.2); B.add(nk); for (let i = 0; i < 9; i++) { const a = (i - 4) / 4 * 1.05, x = Math.sin(a) * 0.2, z = 0.2 + Math.cos(a) * 0.17 * 0.95; B.add(cone(0.014, 0.075 + (4 - Math.abs(i - 4)) * 0.012, bone, V(x, 2.1 - (1 - Math.cos(a)) * 0.0 - 0.005 - (4 - Math.abs(i - 4)) * 0.0, z * 1.0 + 0.0), [Math.PI - 0.5 + 0, 0, -Math.sin(a) * 0.5])); }
      for (let i = 0; i < 3; i++) B.add(cone(0.026 - i * 0.004, 0.2 - i * 0.04, bone, V(0.4 + i * 0.02, 2.2 + i * 0.01, 0.06 - i * 0.07), [0, 0, -0.7 - i * 0.25])); }
    halo(0x66ffee, 0.25, 0.35, V(0, 1.38, 0.17), B);
    (g as any).userData.tick = (t: number) => { braid.rotation.x = 0.06 * Math.sin(t * 1.3); braid.rotation.z = 0.05 * Math.sin(t * 0.9 + 1); tail.rotation.y = 0.2 * Math.sin(t * 1.5); tail.rotation.x = 0.05 * Math.sin(t * 1.1); hd.rotation.y = 0.12 * Math.sin(t * 0.8); hd.rotation.x = 0.16 + 0.03 * Math.sin(t * 1.2); cyan.emissiveIntensity = 2.0 + 0.7 * Math.sin(t * 2.6); eyeG.emissiveIntensity = 2.8 + 0.5 * Math.sin(t * 2.0); };
  } else if (kind === "leviathan") {   // a Sentinel-style machine squid (own design): a pitched armoured pod with a cluster of fifteen red eyes, brow blades, hooked mandibles, sensor dishes, and twelve ribbed clawed tentacles (four raised like arms, eight reaching the floor)
    const pl = levPlate(), PH = 1.95;
    const mkm = (c: number, o: any = {}) => mk(CHIT(c, { map: pl, bumpMap: pl, bumpScale: 1.1, roughness: 0.34, metalness: 0.82, clearcoat: 0.4, clearcoatRoughness: 0.3, ...o }));
    const hullM = mkm(0x24202a), plateM = mkm(0x7a5c4c, { roughness: 0.42 }), darkM = mkm(0x16141c, { roughness: 0.28 }), tentM = mkm(0x302c38, { roughness: 0.3 }), jointM = mkm(0x8a6c5a, { metalness: 0.92, roughness: 0.26 }), bladeM = mkm(0xc4cad4, { metalness: 1, roughness: 0.18, clearcoat: 0.8 }), dishM = mkm(0x5a4e58, { side: THREE.DoubleSide });
    const red = GLOW(0xff1408), redD = GLOW(0xc01408), hot = GLOW(0xffd0a8), spark = GLOW(0xffa030), blk = new THREE.MeshBasicMaterial({ color: 0x050204 }); redD.emissiveIntensity = 1.3; hot.emissiveIntensity = 2.8; spark.emissiveIntensity = 2.6;
    const merge = (parts: THREE.Mesh[], m: THREE.Material) => { const gs = parts.map(p => { p.updateMatrix(); const gg = p.geometry.clone(); gg.applyMatrix4(p.matrix); p.geometry.dispose(); return gg; }); const mg = mergeGeometries(gs, false) as THREE.BufferGeometry; gs.forEach(gg => gg.dispose()); return new THREE.Mesh(mg, m); };
    const halo = (c: number, s: number, o: number, p: THREE.Vector3, par: THREE.Object3D) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(s); sp.position.copy(p); par.add(sp); return sp; };
    const hook = (base: THREE.Vector3, dir: THREE.Vector3, curl: THREE.Vector3, len: number, th: number) => { const d = dir.clone().normalize(), c = curl.clone().normalize(); return tube([base.clone(), base.clone().addScaledVector(d, len * 0.42).addScaledVector(c, len * 0.04), base.clone().addScaledVector(d, len * 0.76).addScaledVector(c, len * 0.2), base.clone().addScaledVector(d, len * 0.95).addScaledVector(c, len * 0.5)], th, th * 0.12, bladeM, undefined, 10, 5); };
    const claw = (tp: THREE.Vector3, d0: THREE.Vector3, n: number, spread: number, len: number, th: number) => { const d = d0.clone().normalize(), u = V(0, 1, 0).cross(d); if (u.lengthSq() < 1e-4) u.set(1, 0, 0); u.normalize(); const w = d.clone().cross(u).normalize(), ps: THREE.Mesh[] = [];
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2 + 0.4, out = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a)); ps.push(hook(tp.clone().addScaledVector(out, th * 0.6), d.clone().addScaledVector(out, spread), out.clone().multiplyScalar(-1), len, th)); }
      ps.push(hook(tp.clone(), d, V(0, 0.3, 0), len * 0.8, th * 1.1)); return merge(ps, bladeM); };
    // ── the pod: an armoured lathe hull, wider than tall, pitched nose-down so it stares at the player
    const pod = new THREE.Group(); pod.position.set(0, PH, 0); pod.rotation.x = -0.26; pod.scale.setScalar(1.25); pod.updateMatrix(); body.add(pod);
    const prof = new THREE.SplineCurve([[0, -1.04], [0.16, -1.02], [0.34, -0.94], [0.5, -0.76], [0.6, -0.46], [0.64, -0.1], [0.62, 0.3], [0.55, 0.65], [0.47, 0.92], [0.43, 1.03]].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(52).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
    const Ry = (y: number) => { for (let i = 1; i < prof.length; i++) if (prof[i].y >= y) { const a = prof[i - 1], b = prof[i]; return a.x + (b.x - a.x) * (y - a.y) / Math.max(1e-6, b.y - a.y); } return prof[prof.length - 1].x; };
    const yAtR = (r: number) => { for (let i = 1; i < prof.length; i++) if (prof[i].x >= r && prof[i].y < 0) return prof[i].y; return -0.5; };
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 44), hullM); hull.rotation.x = Math.PI / 2; hull.scale.set(1.15, 1, 0.8); pod.add(hull);
    { const bands: THREE.Mesh[] = []; for (const z of [-0.6, -0.28, 0.04, 0.34, 0.62, 0.86]) { const t = new THREE.Mesh(new THREE.TorusGeometry(Ry(z) + 0.012, z > 0.3 ? 0.05 : 0.036, 8, 40), plateM); t.position.z = z; t.scale.set(1.15, 0.8, 1); bands.push(t); } pod.add(merge(bands, plateM)); }
    // fifteen red eyes in the nose: one great eye, a ring of six, a ring of eight — each a glowing sphere with a dark slit and a wet highlight, in bronze bezels
    { const E: number[][] = [[0, 0, -1.06, 0.09]]; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, r = 0.2; E.push([Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.8, yAtR(r) - 0.035, 0.054]); } for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = 0.37; E.push([Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.8, yAtR(r) - 0.03, 0.045]); }
      const eg = new THREE.SphereGeometry(1, 14, 10), eM = new THREE.InstancedMesh(eg, red, E.length), pM = new THREE.InstancedMesh(eg, blk, E.length), hM = new THREE.InstancedMesh(eg, hot, E.length), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion();
      E.forEach(([x, y, z, r], i) => { m4.compose(V(x, y, z), q0, V(r, r, r * 0.85)); eM.setMatrixAt(i, m4); m4.compose(V(x, y, z - r * 0.7), q0, V(r * 0.2, r * 0.68, r * 0.18)); pM.setMatrixAt(i, m4); m4.compose(V(x - r * 0.36, y + r * 0.4, z - r * 0.66), q0, V(r * 0.12, r * 0.12, r * 0.12)); hM.setMatrixAt(i, m4); });
      pod.add(eM, pM, hM);
      for (const [r, tb] of [[0.5, 0.034], [0.125, 0.022]]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(r, tb, 8, 36), plateM); rg.scale.set(1.15, 0.8, 1); rg.position.z = r < 0.2 ? -1.04 : yAtR(r) - 0.01; pod.add(rg); }
      halo(0xff2a1a, 2.6, 0.3, V(0, 0, -0.1), pod); halo(0xff5a30, 0.5, 0.3, V(0, 0, -1.12), pod); }
    // brow blades over the eyes (the left one broken), a pair of cheek blades, glowing seam lines along the flanks
    { const br: THREE.Mesh[] = []; for (const sd of [-1, 1]) { br.push(tube([V(0.62 * sd, 0.3, -0.3), V(0.5 * sd, 0.5, -0.66), sd < 0 ? V(0.3 * sd, 0.5, -0.9) : V(0.28 * sd, 0.5, -0.9), sd < 0 ? V(0.26 * sd, 0.4, -0.98) : V(0.08 * sd, 0.34, -1.08)], 0.075, sd < 0 ? 0.03 : 0.012, plateM, undefined, 14, 6)); br.push(hook(V(0.7 * sd, -0.1, -0.5), V(0.5 * sd, -0.35, -1), V(-0.5 * sd, 0.1, 0.2), 0.5, 0.05)); } pod.add(merge(br, plateM));
      const sm: THREE.Mesh[] = []; for (const sd of [-1, 1]) for (const y of [-0.05, 0.22]) sm.push(tube([V(0.67 * sd, y, -0.45), V(0.73 * sd, y, 0.05), V(0.68 * sd, y, 0.6)], 0.012, 0.012, redD, undefined, 12, 4)); pod.add(merge(sm, redD)); }
    // the lower mouth: five hooked mandible blades round a glowing red throat and a downward beak, closing and opening
    const mand = new THREE.Group(); mand.position.set(0, -0.38, -0.66); pod.add(mand);
    { const ps: THREE.Mesh[] = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a); ps.push(hook(V(c * 0.14, 0, s * 0.14), V(c * 0.45, -1, s * 0.45 - 0.2), V(-c, 0.25, -s), 0.66, 0.05)); } ps.push(hook(V(0, 0, 0.02), V(0, -1, -0.3), V(0, 0, 1), 0.52, 0.075)); mand.add(merge(ps, bladeM)); const th = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), redD); th.position.y = 0.04; mand.add(th); }
    // sensor dishes: the right one whole, sweeping; the left one torn off, its cables sparking
    const dishes: THREE.Group[] = [];
    { const d = new THREE.Group(); d.position.set(0.88, 0.14, -0.14); const dir = V(0.5, 0.1, 0.85).normalize(); const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 8, 0, Math.PI * 2, 0, 1.05), dishM); bowl.quaternion.setFromUnitVectors(V(0, 1, 0), dir); d.add(bowl);
      d.add(limb(V(-0.22, -0.04, 0.02), V(0, 0, 0), 0.04, 0.035, jointM)); d.add(limb(V(0, 0, 0), dir.clone().multiplyScalar(-0.3), 0.015, 0.012, bladeM)); const dt = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), red); dt.position.copy(dir.clone().multiplyScalar(-0.3)); d.add(dt); pod.add(d); dishes.push(d); }
    { const st: THREE.Mesh[] = [limb(V(-0.7, 0.1, -0.14), V(-0.96, 0.2, -0.2), 0.045, 0.035, jointM) as THREE.Mesh]; for (let i = 0; i < 4; i++) st.push(cone(0.03, 0.2, jointM, V(-0.98 + i * 0.01, 0.2 + (i - 1.5) * 0.04, -0.2 + (i - 1.5) * 0.03), [0.5 * i - 0.7, 0, 0.9 + i * 0.3])); pod.add(merge(st, jointM));
      const cb: THREE.Mesh[] = []; for (let i = 0; i < 3; i++) cb.push(tube([V(-0.95, 0.2, -0.2), V(-1.1 - i * 0.04, 0.0 - i * 0.06, -0.22), V(-1.12 - i * 0.05, -0.36 - i * 0.12, -0.18 + i * 0.06), V(-1.08 - i * 0.08, -0.62 - i * 0.14, -0.1 + i * 0.12)], 0.012, 0.01, darkM, undefined, 12, 4)); pod.add(merge(cb, darkM));
      for (const [x, y, z] of [[-1.1, -0.64, -0.1], [-1.15, -0.8, 0.14]]) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), spark); sp.position.set(x, y, z); pod.add(sp); } halo(0xffa030, 0.35, 0.6, V(-1.1, -0.64, -0.1), pod); }
    // dorsal crest of blades, a sensor mast with a blinking beacon, whip antennae
    { const N = 9, cg = new THREE.InstancedMesh(new THREE.ConeGeometry(0.055, 1, 7), plateM, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.55); for (let i = 0; i < N; i++) { const z = -0.5 + 1.35 * i / (N - 1), top = Ry(z) * 0.8 - 0.01, len = 0.46 - 0.22 * Math.abs(i / (N - 1) - 0.35); m4.compose(V(0, top + len * 0.45, z + len * 0.12), q, V(1 + 0.3 * (1 - i / N), len, 1)); cg.setMatrixAt(i, m4); } pod.add(cg);
      const mt = [V(0, 0.46, 0.1), V(0, 0.9, 0.06), V(0.02, 1.3, 0.0)], mast = tube(mt, 0.026, 0.012, jointM, undefined, 10, 6); pod.add(mast);
      for (const dy of [0.7, 1.0]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 14), bladeM); rg.rotation.x = Math.PI / 2; rg.position.set(0, dy, 0.07); pod.add(rg); }
      const wh: THREE.Mesh[] = []; for (const sd of [-1, 1]) wh.push(tube([V(0.2 * sd, 0.45, 0.6), V(0.5 * sd, 1.1, 0.9), V(0.8 * sd, 1.6, 0.9), V(1.1 * sd, 1.9, 0.5)], 0.016, 0.004, darkM, undefined, 16, 4)); pod.add(merge(wh, darkM)); }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), red); beacon.position.set(0.02, 1.32, 0); pod.add(beacon);
    // the rear manifold collar the tentacles grow from, with hydraulic struts
    { const cl = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.13, 10, 36), plateM); cl.scale.set(1.15, 0.8, 1); cl.position.z = 0.96; pod.add(cl); const tc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.16, 20), darkM); tc.rotation.x = Math.PI / 2; tc.scale.set(1.1, 1, 0.8); tc.position.z = 1.1; pod.add(tc); halo(0xff3a20, 0.7, 0.35, V(0, 0, 1.14), pod); }
    // ── twelve ribbed tentacles: per side, four to the floor and two raised like arms, each in two jointed halves ending in hooked claws
    const ten: { hip: THREE.Group; fore: THREE.Group; arm: boolean; au: THREE.Vector3; al: THREE.Vector3 }[] = [];
    const ribs = (n: number) => (k: number) => 0.8 + 0.3 * Math.pow(Math.abs(Math.sin(k * Math.PI * n)), 0.6);
    const rel = (pts: THREE.Vector3[], o: THREE.Vector3) => pts.map(p => p.clone().sub(o));
    for (const sd of [-1, 1]) for (let k = 0; k < 6; k++) {
      const a = [-1.15, -0.7, -0.25, 0.2, 0.65, 1.1][k], arm = k >= 4, v = k - 4;
      const R = V(sd * Math.cos(a) * 0.52, Math.sin(a) * 0.36, 0.95).applyMatrix4(pod.matrix);
      let P1: THREE.Vector3, P2: THREE.Vector3, P3: THREE.Vector3, P4: THREE.Vector3;
      if (arm) { P1 = R.clone().add(V(sd * (0.7 + 0.1 * v), 0.4, 0.1)); P2 = V(sd * (1.6 + 0.12 * v), PH + 0.6 - 0.45 * v, -0.2); P3 = V(sd * 1.5, PH + 0.1 - 0.4 * v, -1.0); P4 = V(sd * (0.8 + 0.2 * v), PH - 0.2 - 0.45 * v, -1.65); }
      else { const th = [170, 135, 95, 55][k] * Math.PI / 180, Rt = [1.15, 1.35, 1.5, 1.45][k], T = V(sd * Math.sin(th) * Rt, -0.02, -Math.cos(th) * Rt); P1 = R.clone().add(V(sd * 0.42, 0.3, 0.22)); P2 = V(R.x + (T.x - R.x) * 0.55 + sd * 0.32, 1.25 - 0.1 * k, R.z + (T.z - R.z) * 0.55); P3 = V(R.x + (T.x - R.x) * 0.88, 0.5, R.z + (T.z - R.z) * 0.88); P4 = T; }
      const hip = new THREE.Group(); hip.position.copy(R); body.add(hip);
      const w0 = arm ? 0.15 : 0.16, w1 = arm ? 0.085 : 0.09;
      const up = merge([tube(rel([R, P1, P2], R), w0, w1, tentM, ribs(5), 30, 8), (() => { const s = new THREE.Mesh(new THREE.SphereGeometry(w0 * 1.05, 10, 8), tentM); return s; })(), (() => { const s = new THREE.Mesh(new THREE.SphereGeometry(w1 * 1.25, 10, 8), tentM); s.position.copy(P2.clone().sub(R)); return s; })()], tentM); hip.add(up);
      const fore = new THREE.Group(); fore.position.copy(P2.clone().sub(R)); hip.add(fore);
      fore.add(tube(rel([P2, P3, P4], P2), w1, 0.02, tentM, ribs(5), 30, 8));
      const dl = P4.clone().sub(P3); fore.add(claw(P4.clone().sub(P2), dl, arm ? 4 : 3, arm ? 0.42 : 0.3, arm ? 0.5 : 0.36, arm ? 0.04 : 0.032));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), red); lamp.position.set(0, 0.09, 0); fore.add(lamp);
      const hd = (a2: THREE.Vector3, b2: THREE.Vector3) => { const d = b2.clone().sub(a2); d.y = 0; d.normalize(); return V(-d.z, 0, d.x); };
      ten.push({ hip, fore, arm, au: hd(R, P2), al: hd(P2, P4) }); (arm ? arms : legs).push(hip);
    }
    halo(0xff2a1a, 2.4, 0.22, V(0, 0.9, 0.2), body);
    const qa = new THREE.Quaternion(), mM = mand;
    (g as any).userData.tick = (t: number) => {
      body.rotation.x *= 0.45; body.rotation.z *= 0.5; body.position.z *= 0.6;
      ten.forEach((o, i) => {
        if (o.arm) { const dl = o.hip.rotation.x + 0.5; o.hip.rotation.set(dl * 0.5 + 0.05 * Math.sin(t * 1.1 + i), 0.1 * Math.sin(t * 0.9 + i * 2), 0); o.fore.rotation.set(0.12 * Math.sin(t * 1.9 + i), 0, 0.06 * Math.sin(t * 1.4 + i)); }
        else { const s = Math.abs(o.hip.rotation.x); o.hip.rotation.set(0, 0, 0); const lf = 0.04 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 1.3)) + 0.3 * s; o.hip.quaternion.setFromAxisAngle(o.au, lf * 0.4); o.fore.quaternion.setFromAxisAngle(o.al, lf); }
      });
      const p = Math.sin(t * 3.1); redD.emissiveIntensity = 1.3 + 0.5 * Math.sin(t * 2.2 + 1); red.emissiveIntensity = 1.1 + 0.4 * p; mM.scale.set(1 + 0.2 * Math.sin(t * 2.3), 1 + 0.06 * Math.sin(t * 2.3), 1 + 0.2 * Math.sin(t * 2.3));
      dishes.forEach((d, i) => { d.rotation.y = 0.32 * Math.sin(t * 0.9 + i); d.rotation.x = 0.1 * Math.sin(t * 1.3); }); beacon.visible = Math.sin(t * 4.2) > -0.3; spark.emissiveIntensity = Math.sin(t * 17) > 0.2 ? 3 : 0.4; void qa;
    };
  } else if (kind === "tripod") {   // an invader war-machine: a hooded armoured cockpit with one great lens-eye, a heat-ray boom, grasping tentacles, a harvest cage, and three jointed telescoping legs ending in talons
    const pl = tripodPlate(), mkm = (c: number, o: any = {}) => mk(CHIT(c, { map: pl, bumpMap: pl, bumpScale: 1.4, roughness: 0.4, metalness: 0.78, clearcoat: 0.35, clearcoatRoughness: 0.35, ...o }));
    const m = mkm(0x7c8698), m2 = mkm(0x2e323c, { roughness: 0.5 }), br = mkm(0x9a6a3a, { roughness: 0.34, metalness: 0.9, clearcoat: 0.7 }), bnT = mkm(0xd0c6aa, { roughness: 0.35, metalness: 0.1 });
    const ray = GLOW(0xff5a2a), ray2 = GLOW(0xff7a3a), tg = GLOW(0x5affc0), HY = 3.55; ray2.emissiveIntensity = 1.1;
    const ringAt = (p: THREE.Vector3, dir: THREE.Vector3, R: number, r: number, mat: THREE.Material) => { const t = new THREE.Mesh(new THREE.TorusGeometry(R, r, 8, 20), mat); t.position.copy(p); t.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().normalize()); return t; };
    const halo = (c: number, s: number, o: number, p: THREE.Vector3) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(s); sp.position.copy(p); body.add(sp); return sp; };
    // the hooded cockpit: a broad dome over a dark armoured belly, a bronze rim, a teal under-glow
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 22), m); dome.scale.set(1.05, 0.72, 1.15); dome.position.set(0, HY, 0.05); body.add(dome);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 14), m2); belly.scale.set(1.0, 0.5, 1.08); belly.position.set(0, HY - 0.38, 0.05); body.add(belly);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.87, 0.07, 10, 40), br); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.1, 1); rim.position.set(0, HY - 0.15, 0.05); body.add(rim);
    const under = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.028, 8, 40), ray); under.rotation.x = Math.PI / 2; under.scale.set(1, 1.12, 1); under.position.set(0, HY - 0.3, 0.05); body.add(under);
    // rivets and a crown of backswept barbs along the rim (instanced: one draw call each)
    { const N = 24, rv = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 6, 5), br, N), mt4 = new THREE.Matrix4(); for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; mt4.makeTranslation(Math.cos(a) * 0.87, HY - 0.07, 0.05 + Math.sin(a) * 0.96); rv.setMatrixAt(i, mt4); } body.add(rv);
      const B = 11, bb = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.36, 7), m2, B), q = new THREE.Quaternion(), sc = V(1, 1, 1); for (let i = 0; i < B; i++) { const a = i / B * Math.PI * 2 + 0.2, dir = V(Math.cos(a) * 0.7, 0.62, Math.sin(a) * 0.7 + 0.32).normalize(); q.setFromUnitVectors(V(0, 1, 0), dir); const p = V(Math.cos(a) * 0.9, HY - 0.1, 0.05 + Math.sin(a) * 0.99).addScaledVector(dir, 0.12); mt4.compose(p, q, sc); bb.setMatrixAt(i, mt4); } body.add(bb); }
    // armoured ribs over the dome (the front is left clear for the face)
    for (let i = 0; i < 9; i++) { const ph = i / 9 * Math.PI * 2 + 0.17; if (Math.abs(Math.sin(ph + Math.PI / 2)) < 0.0 || (Math.sin(ph) < -0.72 && Math.abs(Math.cos(ph)) < 0.55)) continue; const pts: THREE.Vector3[] = []; for (let k = 0; k < 6; k++) { const t = 0.1 + k * 0.22; pts.push(V(0.92 * Math.sin(t) * Math.cos(ph) * 1.03, HY + 0.62 * Math.cos(t) * 1.03, 0.05 + 1.0 * Math.sin(t) * Math.sin(ph) * 1.03)); } body.add(tube(pts, 0.032, 0.022, m2, undefined, 14, 6)); }
    { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.1, 18), br); cap.position.set(0, HY + 0.62, 0.05); body.add(cap); }
    body.add(tube([V(0, HY + 0.66, 0.05), V(0, HY + 0.95, 0.02), V(0.04, HY + 1.12, -0.02)], 0.026, 0.012, m2, undefined, 10, 6)); { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), ray); tip.position.set(0.04, HY + 1.14, -0.02); body.add(tip); for (let k = 0; k < 2; k++) { const dsk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 - k * 0.03, 0.1 - k * 0.03, 0.025, 12), br); dsk.position.set(0, HY + 0.82 + k * 0.17, 0.03); body.add(dsk); } }
    // the hood: a dark armoured cowl that overhangs the lens-eye like a brow, a back-swept blade crest, glowing crack seams and scorch scars
    { const hood = new THREE.Mesh(new THREE.SphereGeometry(0.82, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.42), m2); hood.scale.set(1.1, 0.72, 1.4); hood.position.set(0, HY + 0.2, 0); hood.rotation.x = -0.1; body.add(hood);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.045, 8, 40), br); lip.scale.set(1.1, 1.4, 1); lip.rotation.x = Math.PI / 2 - 0.1; lip.position.set(0, HY + 0.34, -0.14); lip.scale.set(1.1, 1.38, 1); body.add(lip);
      for (const sd of [-1, 1]) { body.add(tube([V(0.1 * sd, HY + 0.76, -0.2), V(0.34 * sd, HY + 0.7, -0.62), V(0.5 * sd, HY + 0.56, -0.98), V(0.46 * sd, HY + 0.42, -1.2)], 0.022, 0.012, ray, undefined, 14, 5)); body.add(tube([V(0.35 * sd, HY + 0.72, 0.3), V(0.6 * sd, HY + 0.5, 0.2), V(0.78 * sd, HY + 0.34, 0.1)], 0.016, 0.01, ray, undefined, 10, 5)); }
      body.add(cone(0.16, 1.15, m2, V(0, HY + 0.8, 0.85), [1.25, 0, 0])); body.add(cone(0.07, 0.8, m2, V(0.28, HY + 0.62, 0.8), [1.1, 0, -0.35])); body.add(cone(0.07, 0.8, m2, V(-0.28, HY + 0.62, 0.8), [1.1, 0, 0.35]));
      // fangs hung under the cowl either side of the heat-ray root, with ichor that drips
      for (const sd of [-1, 1]) { const fg = cone(0.07, 0.62, bnT, V(0.26 * sd, HY - 0.36, -0.9), [Math.PI + 0.42, 0, 0.12 * sd]); body.add(fg); body.add(cone(0.045, 0.36, bnT, V(0.46 * sd, HY - 0.28, -0.78), [Math.PI + 0.3, 0, 0.35 * sd])); }
      const dr = [V(0.27, HY - 0.7, -1.0), V(-0.27, HY - 0.68, -1.0)].map(p => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), DRIP); d.scale.y = 1.9; d.position.copy(p); body.add(d); return d; }); (g as any).userData.dr = dr; }
    // the face: a great lens-eye in a bronze bezel with a black slit pupil and a wet highlight, two armoured brows, spider-eyes either side
    const ez = -0.9, ey = HY + 0.02;
    { const bz = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.065, 10, 28), br); bz.scale.set(0.88, 1.18, 1); bz.position.set(0, ey, ez + 0.03); body.add(bz); const sk = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 10), m2); sk.scale.set(0.85, 1.1, 0.45); sk.position.set(0, ey, ez + 0.1); body.add(sk); }
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), ray); lens.scale.set(0.85, 1.1, 0.6); lens.position.set(0, ey, ez); body.add(lens);
    { const ir = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 6, 22), GLOW(0xffc060)); ir.scale.set(0.8, 1.1, 1); ir.position.set(0, ey, ez - 0.14); body.add(ir); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: 0x080204 })); pu.scale.set(0.27, 1.35, 0.35); pu.position.set(0, ey, ez - 0.16); body.add(pu); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(-0.1, ey + 0.12, ez - 0.15); body.add(hl); const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl2.position.set(0.08, ey - 0.1, ez - 0.15); body.add(hl2); }
    const eyeHalo = halo(0xff6a2a, 1.0, 0.55, V(0, ey, ez - 0.3));
    for (const sd of [-1, 1]) { const bw = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.22), m2); bw.position.set(0.26 * sd, HY + 0.34, -1.04); bw.rotation.set(0.3, -0.45 * sd, 0.6 * sd); body.add(bw); }
    body.add(eyes(ray, HY - 0.02, -0.8, 0.54, 0.045)); body.add(eyes(ray, HY - 0.22, -0.8, 0.38, 0.034));
    // the heat-ray boom: a ribbed arm slung under the chin to a bronze projector dish with a white-hot core
    { const bm = tube([V(0, HY - 0.45, -0.5), V(0, HY - 0.95, -1.0), V(0, HY - 1.3, -1.55), V(0, HY - 1.42, -2.0)], 0.14, 0.09, m2, k => 1 + 0.06 * Math.sin(k * 30), 22, 10); body.add(bm);
      for (let k = 0; k < 5; k++) { const t = 0.2 + k * 0.17, p = V(0, HY - 0.85 - t * 0.85, -0.85 - t * 1.25); body.add(ringAt(p, V(0, -0.5, -1), 0.13 - k * 0.006, 0.03, br)); }
      const dm = mk(CHIT(0xb8844a, { map: pl, metalness: 0.9, roughness: 0.28, side: THREE.DoubleSide })); const dish = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.4, 22, 1, true), dm); dish.rotation.x = Math.PI / 2 - 0.35; dish.position.set(0, HY - 1.46, -2.2); body.add(dish);
      body.add(ringAt(V(0, HY - 1.56, -2.4), V(0, -0.35, -1), 0.27, 0.026, ray2));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), ray2); core.position.set(0, HY - 1.5, -2.28); core.scale.setScalar(0.7); body.add(core); halo(0xff7a30, 0.5, 0.3, V(0, HY - 1.55, -2.4)); }
    // two grasping tentacles under the chin: ribbed cables that end in hooked claws (the engine swings these as arms)
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.5 * sd, HY - 0.5, -0.35); const inn = new THREE.Group(); inn.rotation.x = 0.5; arm.add(inn);
      const P = [V(0, 0, 0), V(0.16 * sd, -0.5, -0.12), V(0.34 * sd, -1.05, 0.0), V(0.3 * sd, -1.65, -0.32), V(0.5 * sd, -2.1, -0.72)]; inn.add(tube(P, 0.08, 0.028, m2, k => 1 + 0.2 * Math.sin(k * 36), 26, 8));
      const e = P[4]; for (let k = -1; k <= 1; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.26, 6), br); c.position.set(e.x + k * 0.07 * sd + 0.04 * sd, e.y - 0.1, e.z - 0.04 + Math.abs(k) * 0.04); c.rotation.set(-0.5, 0, (k * 0.5 - 0.3) * sd); inn.add(c); }
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), ray); bl.position.copy(P[0]); inn.add(bl); body.add(arm); arms.push(arm); }
    // two long thin whip-tentacles from the back of the belly (they lash with the others) and a fringe of cables hanging round the belly
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.3 * sd, HY - 0.6, 0.35); const inn = new THREE.Group(); inn.rotation.x = 0.7; arm.add(inn);
      const P = [V(0, 0, 0), V(0.25 * sd, -0.7, 0.2), V(0.5 * sd, -1.5, -0.1), V(0.45 * sd, -2.3, -0.7), V(0.7 * sd, -2.9, -1.3), V(0.9 * sd, -3.3, -1.7)]; inn.add(tube(P, 0.06, 0.008, m2, k => 1 + 0.25 * Math.sin(k * 40), 32, 6));
      const e = P[5]; inn.add(cone(0.026, 0.3, br, V(e.x, e.y - 0.12, e.z - 0.05), [-0.5, 0, 0.3 * sd])); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 9; i++) { const b = (i / 9) * Math.PI * 2 + 0.3, cx = Math.cos(b) * 0.62, cz = 0.05 + Math.sin(b) * 0.68; body.add(tube([V(cx, HY - 0.5, cz), V(cx * 1.08, HY - 0.85, cz * 1.08), V(cx * 1.02 + 0.03, HY - 1.1 - (i % 3) * 0.15, cz * 1.02)], 0.022, 0.012, m2, undefined, 10, 4)); }
    // the harvest cage slung under the belly, with something green still glowing inside
    { const cy = HY - 0.78, ctr = V(0, 0, 0.12); for (let i = 0; i < 8; i++) { const b = i / 8 * Math.PI * 2; body.add(tube([V(Math.cos(b) * 0.3, cy, ctr.z + Math.sin(b) * 0.3), V(Math.cos(b) * 0.4, cy - 0.35, ctr.z + Math.sin(b) * 0.4), V(Math.cos(b) * 0.28, cy - 0.65, ctr.z + Math.sin(b) * 0.28), V(Math.cos(b) * 0.04, cy - 0.86, ctr.z + Math.sin(b) * 0.04)], 0.016, 0.012, m2, undefined, 10, 4)); }
      for (const [dy, R] of [[0.35, 0.4], [0.62, 0.29]]) { const r2 = new THREE.Mesh(new THREE.TorusGeometry(R, 0.014, 5, 22), m2); r2.rotation.x = Math.PI / 2; r2.position.set(0, cy - dy, ctr.z); body.add(r2); }
      const cg = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), GLOW(0x7aff5a)); cg.position.set(0, cy - 0.4, ctr.z); body.add(cg); halo(0x7aff5a, 0.6, 0.3, V(0, cy - 0.4, ctr.z)); (g as any).userData.cg = cg; }
    // three jointed legs: a hip ball with a glowing collar, a thick thigh, a spiked knee, three telescoping shin sections, an ankle and a taloned foot
    const DIRS = [-Math.PI / 6, -5 * Math.PI / 6, Math.PI / 2];
    for (let i = 0; i < 3; i++) {
      const a = DIRS[i], dx = Math.cos(a), dz = Math.sin(a), hipY = HY - 0.5, hr = 0.62, hp = V(dx * hr, hipY, dz * hr), D = V(dx, 0, dz);
      const hb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), m2); hb.position.copy(hp); body.add(hb); body.add(ringAt(hp.clone().addScaledVector(D, 0.16), D, 0.2, 0.042, br)); body.add(ringAt(hp.clone().addScaledVector(D, 0.27), D, 0.17, 0.026, ray));
      const lg = new THREE.Group(); lg.position.copy(hp);
      const Pq = (r: number, y: number) => V(dx * r, y, dz * r), K = Pq(1.3, -0.9), A = Pq(1.95, -2.92);
      lg.add(tube([Pq(0, 0), Pq(0.5, 0.06), Pq(1.0, -0.36), K], 0.16, 0.115, m, k => 1 + 0.07 * Math.sin(k * 20), 18, 10));
      { const pa = Pq(0.25, 0.3), pb = Pq(1.05, -0.6); lg.add(limb(pa, pb, 0.032, 0.032, br)); lg.add(limb(pa, Pq(0.22, 0.04), 0.02, 0.02, m2)); lg.add(limb(pb, Pq(1.05, -0.38), 0.02, 0.02, m2)); lg.add(tube([Pq(0.1, -0.16), Pq(0.7, -0.5), Pq(1.2, -0.85)], 0.02, 0.02, m2, undefined, 8, 4)); }
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), m2); kn.position.copy(K); lg.add(kn); lg.add(ringAt(K.clone().addScaledVector(D, -0.05), V(dx, -0.4, dz), 0.2, 0.045, br));
      { const th = [Pq(0.25, 0.1), Pq(0.55, 0.08), Pq(0.85, -0.18), Pq(1.1, -0.45)]; for (let k = 0; k < th.length; k++) { const dd = V(dx * -0.3, 1, dz * -0.3).normalize(); const sp2 = new THREE.Mesh(new THREE.ConeGeometry(0.05 - k * 0.006, 0.34 - k * 0.04, 6), m2); sp2.position.copy(th[k]).addScaledVector(dd, 0.2); sp2.quaternion.setFromUnitVectors(V(0, 1, 0), dd); lg.add(sp2); }
        lg.add(tube([Pq(0.05, -0.1), Pq(0.6, -0.14), Pq(1.0, -0.5), Pq(1.25, -0.82)], 0.012, 0.012, ray, undefined, 12, 4)); }
      { const sd = V(dx * 0.4, 0.9, dz * 0.4).normalize(), sp = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.46, 7), br); sp.position.copy(K).addScaledVector(sd, 0.3); sp.quaternion.setFromUnitVectors(V(0, 1, 0), sd); lg.add(sp); }
      const sdir = A.clone().sub(K).normalize(), S1 = K.clone().lerp(A, 0.38), S2 = K.clone().lerp(A, 0.72);
      lg.add(limb(K, S1, 0.1, 0.092, m)); lg.add(limb(S1, S2, 0.082, 0.074, m)); lg.add(limb(S2, A, 0.064, 0.05, m));
      { const N = 8, rr = new THREE.InstancedMesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), m2, N), qq = new THREE.Quaternion(), mt4 = new THREE.Matrix4(), q0 = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), sdir); const spots: [number, number][] = [[0.0, 1.18], [0.38, 1.0], [0.72, 0.8], [0.12, 1.05], [0.26, 1.05], [0.5, 0.88], [0.62, 0.86], [0.88, 0.66]]; for (let k = 0; k < N; k++) { const p = K.clone().lerp(A, 0.04 + spots[k][0] * 0.96 * (spots[k][0] > 0.85 ? 1 : 1)), s = spots[k][1]; qq.copy(q0); mt4.compose(p, qq, V(s, s, s)); rr.setMatrixAt(k, mt4); } lg.add(rr); }
      lg.add(tube([K.clone().addScaledVector(sdir, 0.1).add(V(dx * 0.1, 0, dz * 0.1)), S1.clone().add(V(dx * 0.17, 0.0, dz * 0.17)), S2.clone().add(V(dx * 0.14, 0, dz * 0.14))], 0.016, 0.014, m2, undefined, 8, 4));
      const ak = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), m2); ak.position.copy(A); lg.add(ak);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8), m2); pad.scale.set(1, 0.3, 1.15); pad.position.copy(A).add(V(0, -0.08, 0)); pad.rotation.y = -a + Math.PI / 2; lg.add(pad);
      for (const off of [-0.75, 0, 0.75, Math.PI]) { const ta = a + off, td = V(Math.cos(ta) * 0.9, off === Math.PI ? -0.2 : -0.38, Math.sin(ta) * 0.9).normalize(), len = off === Math.PI ? 0.34 : 0.68, tl = new THREE.Mesh(new THREE.ConeGeometry(0.062, len, 7), br); tl.position.copy(A).add(V(0, -0.06, 0)).addScaledVector(td, len * 0.5 + 0.12); tl.quaternion.setFromUnitVectors(V(0, 1, 0), td); lg.add(tl); }
      body.add(lg); legs.push(lg);
    }
    (g as any).userData.tick = (t: number) => { const dr = (g as any).userData.dr as THREE.Mesh[] | undefined; if (dr) dr.forEach((d, i) => { const k = (t * 0.6 + i * 0.5) % 1; d.position.y = HY - 0.7 - k * 0.8; d.scale.set(1 - k * 0.4, 1.9 * (1 - k * 0.3), 1 - k * 0.4); }); ray.emissiveIntensity = 2.4 + 0.7 * Math.sin(t * 3.1); ray2.emissiveIntensity = 1.1 + 0.35 * Math.sin(t * 3.1); eyeHalo.material.opacity = 0.6 + 0.2 * Math.sin(t * 3.1 + 1); eyeHalo.scale.setScalar(1.0 + 0.1 * Math.sin(t * 3.1)); tg.emissiveIntensity = 2 + 0.7 * Math.sin(t * 1.7); const cg = (g as any).userData.cg; if (cg) cg.scale.setScalar(1 + 0.15 * Math.sin(t * 4.3)); };
  } else if (kind === "carapace") {   // Scythe Beast v2 (owner 2026-11-01): a hive-war beast in the manner of the Zerg ultralisk / Alien queen (own design). Overlapping bone-plated dorsal carapace over a dark glossy hide and a wet crimson belly, a swept bone crest and horns, an open toothed maw with a lashing tongue and hooked mandibles, two huge raised scythe arms with a serrated edge, four thick spurred legs and a ringed barbed tail. Scarred: one horn and one spine are broken, a flank is torn open to glowing ribs. Faces -z.
    const B = new THREE.Group(); B.position.y = -0.3; body.add(B);   // (everything of the beast sits in B: the engine bobs `body`, B only lowers the stance)
    const km = (c: number, o: any = {}) => { const x = mk(CHIT(c, o)); x.userData.keep = true; return x; };
    const shell = km(0x5c2a7c, { roughness: 0.26, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), dark = km(0x1c0c26, { roughness: 0.25, metalness: 0.4 }), bone = km(0xc9b98f, { roughness: 0.46, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.3 }), bone2 = km(0x9a8868, { roughness: 0.5, metalness: 0.02, clearcoat: 0.3 }), flesh = km(0x9a1c42, { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05 }), tong = km(0xd0306a, { roughness: 0.08, clearcoat: 1 });
    shell.emissive = new THREE.Color(0x3a1860); shell.emissiveIntensity = 1.0; bone.emissive = new THREE.Color(0x3a3020); bone.emissiveIntensity = 0.7; bone2.emissive = new THREE.Color(0x2a2418); bone2.emissiveIntensity = 0.7; flesh.emissive = new THREE.Color(0x5a0a26); flesh.emissiveIntensity = 0.8; tong.emissive = new THREE.Color(0x6a0a30); tong.emissiveIntensity = 0.8; dark.emissive = new THREE.Color(0x120820); dark.emissiveIntensity = 0.6;
    const seam = GLOW(0xff2a6a); seam.emissiveIntensity = 1.5; const maw = GLOW(0x8a0a1c); maw.emissiveIntensity = 0.9; const eyeM = GLOW(0xff3a6a); eyeM.emissiveIntensity = 2.6;
    const ell = (m: THREE.Material, r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m); e.scale.set(sx, sy, sz); e.position.set(x, y, z); e.rotation.set(rx, ry, rz); B.add(e); return e; };
    // torso: a dark glossy hide, a wet crimson belly slung under it, then the overlapping bone dorsal plates
    ell(shell, 0.62, 1.0, 0.8, 1.15, 0, 1.3, -0.1, 0.1);
    B.add(tube([V(0, 1.1, -0.6), V(0, 1.0, 0.0), V(0, 1.0, 0.7)], 0.38, 0.3, flesh, k => 1 + 0.1 * Math.sin(k * 3), 16, 12));
    for (let i = 0; i < 7; i++) {
      const z = -0.62 + i * 0.2, r = (i === 0 ? 0.64 : 0.6) - i * 0.035, y0 = 1.42 - i * 0.03 + 0.05 * Math.sin((i + 0.5) / 7 * Math.PI), sy = i === 0 ? 0.88 : 0.82;
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? bone2 : bone); d.scale.set(1.25, sy, 0.5); d.position.set(0, y0, z); d.rotation.x = 0.08; B.add(d);
      const rb = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 0.014, 6, 28, Math.PI), seam); rb.scale.set(1.25, sy, 1); rb.position.set(0, y0 + 0.005, z - r * 0.5 + 0.015); rb.rotation.x = 0.08; B.add(rb);
      const top = y0 + r * sy;
      if (i !== 3 && i < 6) B.add(cone(0.055 - i * 0.004, 0.36 - i * 0.03, bone, V(0, top + 0.12, z - 0.02), [-0.3, 0, 0])); else if (i === 3) B.add(cone(0.05, 0.12, bone, V(0, top + 0.02, z - 0.02), [-0.2, 0.3, 0]));   // the fourth spine is snapped off
    }
    // haunches and the flank armour
    for (const sd of [-1, 1]) {
      ell(shell, 0.26, 0.8, 1.0, 1.2, 0.55 * sd, 1.08, 0.55); ell(bone2, 0.22, 0.45, 0.8, 1.5, 0.66 * sd, 1.32, 0.5, 0, 0, -0.4 * sd);
      for (let i = 0; i < 5; i++) B.add(tube([V(0.3 * sd, 1.62, -0.45 + i * 0.2), V(0.6 * sd, 1.34, -0.45 + i * 0.2), V(0.58 * sd, 0.86, -0.45 + i * 0.2)], 0.035, 0.025, dark, undefined, 12, 7));
      B.add(tube([V(0.36 * sd, 0.92, -0.7), V(0.5 * sd, 0.9, -0.1), V(0.42 * sd, 0.86, 0.7)], 0.02, 0.012, seam, undefined, 14, 5));
    }
    // the torn right flank: ribs round a glowing wound
    ell(flesh, 0.3, 0.3, 0.7, 1.2, 0.48, 1.12, -0.05); ell(maw, 0.22, 0.26, 0.6, 1.0, 0.53, 1.12, -0.05);
    for (let i = 0; i < 5; i++) B.add(tube([V(0.3, 1.42, -0.45 + i * 0.2), V(0.6, 1.3, -0.45 + i * 0.2), V(0.6, 0.92, -0.45 + i * 0.2)], 0.028, 0.02, bone, undefined, 12, 6));
    // a neck, the forward-thrust skull, a swept crest and horns (the left horn is broken)
    B.add(tube([V(0, 1.3, -0.6), V(0, 1.4, -0.95), V(0, 1.4, -1.2)], 0.34, 0.26, flesh, undefined, 14, 10));
    ell(shell, 0.3, 0.95, 0.8, 1.5, 0, 1.52, -1.3, 0.14);
    ell(bone2, 0.2, 0.8, 0.35, 1.2, 0, 1.68, -1.4, 0.2);
    { const cr = tube([V(0, 1.72, -1.35), V(0, 2.0, -0.95), V(0, 2.28, -0.4), V(0, 2.3, 0.2)], 0.17, 0.02, bone, k => 1 - 0.3 * k, 20, 8); cr.scale.x = 0.5; B.add(cr); }
    for (let i = 0; i < 5; i++) B.add(cone(0.028, 0.16, bone, V(0, 2.04 + i * 0.05, -0.95 + i * 0.22), [-0.5, 0, 0]));
    for (const sd of [-1, 1]) {
      B.add(tube([V(0.2 * sd, 1.68, -1.25), V(0.5 * sd, 1.95, -1.0), V(0.72 * sd, 2.25, -0.65), V(0.7 * sd, 2.5, -0.35)].slice(0, sd < 0 ? 3 : 4), 0.07, 0.008, bone, undefined, 14, 7));
      B.add(tube([V(0.3 * sd, 1.66, -1.3), V(0.22 * sd, 1.68, -1.6), V(0.06 * sd, 1.61, -1.74)], 0.05, 0.026, bone, undefined, 10, 7));   // the brow ridge
    }
    // eyes with slit pupils, and a second, smaller pair above
    B.add(eyes(eyeM, 1.54, -1.66, 0.16, 0.06)); B.add(eyes(eyeM, 1.64, -1.5, 0.2, 0.03));
    { const slit = new THREE.MeshBasicMaterial({ color: 0x050008 }); for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), slit); s.scale.set(0.22, 1.7, 0.4); s.position.set(0.16 * sx, 1.54, -1.72); B.add(s); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(0.14 * sx, 1.58, -1.72); B.add(hl); } }
    // the open maw: a red throat, upper teeth in a U, a hinged lower jaw with its own teeth, hooked mandibles, drool and the tongue
    ell(maw, 0.22, 0.8, 0.5, 1.2, 0, 1.26, -1.45);
    for (let j = 0; j < 9; j++) { const a = j / 8 * Math.PI, ln = 0.1 + 0.04 * Math.sin(a); B.add(cone(0.02, ln, bone, V(Math.cos(a) * 0.19, 1.26 - ln * 0.4, -1.52 - Math.sin(a) * 0.2), [Math.PI, 0, 0])); }
    for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) B.add(cone(0.018, 0.09, bone, V(0.19 * sd, 1.26, -1.5 + j * 0.13), [Math.PI, 0, 0]));
    const jaw = new THREE.Group(); jaw.position.set(0, 1.2, -1.1); jaw.rotation.x = -0.22; B.add(jaw);
    for (const sd of [-1, 1]) { jaw.add(tube([V(0.2 * sd, 0, 0), V(0.17 * sd, -0.05, -0.3), V(0.1 * sd, -0.04, -0.6)], 0.06, 0.035, bone, undefined, 12, 7)); for (let j = 0; j < 3; j++) jaw.add(cone(0.016, 0.09, bone, V(0.17 * sd, 0.03, -0.2 - j * 0.14), [0, 0, 0])); }
    jaw.add(tube([V(-0.1, -0.04, -0.6), V(0, -0.09, -0.68), V(0.1, -0.04, -0.6)], 0.045, 0.045, bone, undefined, 10, 7));
    for (let j = 0; j < 5; j++) jaw.add(cone(0.016, 0.09, bone, V(-0.07 + j * 0.035, 0.0, -0.66 + Math.abs(j - 2) * 0.02), [0, 0, 0]));
    for (const dx of [-0.06, 0.03, 0.09]) jaw.add(tube([V(dx, 0.05, -0.64), V(dx, -0.08, -0.66), V(dx, -0.17 - Math.abs(dx) * 0.4, -0.64)], 0.012, 0.005, DRIP, undefined, 8, 5));
    for (const sd of [-1, 1]) { B.add(tube([V(0.3 * sd, 1.42, -1.45), V(0.4 * sd, 1.3, -1.72), V(0.3 * sd, 1.15, -1.9), V(0.14 * sd, 1.1, -1.94)], 0.055, 0.008, bone, k => 1 + 0.2 * Math.sin(k * 3), 16, 7)); }
    const tongue = new THREE.Group(); tongue.position.set(0, 1.16, -1.5); B.add(tongue);
    tongue.add(tube([V(0, 0, 0), V(0, -0.04, -0.35), V(0.02, -0.12, -0.62)], 0.045, 0.012, tong, undefined, 16, 8)); tongue.add(cone(0.03, 0.12, bone, V(0.02, -0.13, -0.7), [-Math.PI / 2, 0, 0])); for (const sd of [-1, 1]) tongue.add(cone(0.015, 0.08, bone, V(0.02 + 0.04 * sd, -0.12, -0.6), [-Math.PI / 2, 0, sd * 0.6]));
    // shoulder pauldrons
    for (const sd of [-1, 1]) { ell(bone, 0.3, 0.9, 0.6, 1.15, 0.78 * sd, 1.66, -0.45, 0, 0, -0.35 * sd); ell(dark, 0.3, 0.95, 0.12, 1.2, 0.78 * sd, 1.58, -0.45, 0, 0, -0.35 * sd); for (let k = 0; k < 3; k++) B.add(cone(0.045, 0.3 - k * 0.04, bone, V((0.7 + k * 0.1) * sd, 1.9 - k * 0.04, -0.5 + k * 0.2), [0.2, 0, -0.6 * sd])); }
    // the scythe arms: a shoulder, a raised elbow with a spike, a bracered forearm, a long serrated bone blade and a thumb hook (built raised: the animation tilts them forward and down)
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.66 * sd, 1.5, -0.5);
      const E = V(0.5 * sd, 0.55, -0.3), W = V(0.5 * sd, 0.7, -0.9);
      arm.add(tube([V(0, 0, 0), V(0.3 * sd, 0.3, -0.12), E], 0.2, 0.13, shell, k => 1 + 0.15 * Math.sin(k * 3), 14, 10));
      const jt = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 9), dark); jt.position.copy(E); arm.add(jt); arm.add(cone(0.06, 0.4, bone, E.clone().add(V(0.08 * sd, 0.2, 0.12)), [0.5, 0, -0.5 * sd]));
      arm.add(tube([E, V(0.52 * sd, 0.7, -0.6), W], 0.13, 0.095, shell, undefined, 14, 9));
      { const dir = W.clone().sub(E).normalize(); for (let k = 0; k < 2; k++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(0.115 - k * 0.012, 0.024, 7, 16), bone); rg.position.copy(E.clone().lerp(W, 0.35 + k * 0.3)); rg.quaternion.setFromUnitVectors(V(0, 0, 1), dir); arm.add(rg); } }
      const bp = [W, V(0.43 * sd, 0.85, -1.3), V(0.3 * sd, 0.8, -1.7), V(0.2 * sd, 0.5, -2.0)];
      arm.add(tube(bp, 0.1, 0.004, bone, k => 1.15 - 0.15 * k, 22, 9));
      { const cv = new THREE.CatmullRomCurve3(bp); for (let j = 0; j < 7; j++) { const k = 0.25 + j * 0.1, p = cv.getPoint(k), tg = cv.getTangent(k), cn = cone(0.03 * (1 - k * 0.6), 0.12 * (1 - k * 0.4), dark, p.clone().add(V(-0.07 * sd, -0.04, 0))); cn.quaternion.setFromUnitVectors(V(0, 1, 0), V(-sd * 0.7, -0.5, tg.z * -0.3).normalize()); arm.add(cn); } }
      arm.add(tube([W.clone().add(V(0.05 * sd, -0.1, -0.05)), V(0.62 * sd, 0.5, -1.3), V(0.62 * sd, 0.25, -1.65)], 0.06, 0.004, bone, undefined, 12, 7));
      B.add(arm); arms.push(arm);
    }
    // four thick spurred legs (built here, not with leg(): a jointed thigh, an armoured knee spike, a shin with spines and a clawed foot); the hind pair are the bigger haunches
    for (let i = 0; i < 4; i++) {
      const sd = i % 2 ? 1 : -1, hind = i >= 2, th = hind ? 0.15 : 0.125, H = 0.88, l = new THREE.Group();
      const K = V(0.34, 0.3, 0), F = V(0.62, -H + 0.04, 0);
      l.add(tube([V(0, 0, 0), V(0.2, 0.22, 0), K], th * 1.5, th * 1.1, dark, undefined, 12, 9));
      l.add(cone(th * 0.8, th * 5, bone, K.clone().add(V(0.04, 0.12, 0)), [0, 0, -0.6]));
      l.add(tube([K, V(0.52, -0.3, 0), F], th * 1.1, th * 0.45, dark, undefined, 12, 8));
      for (let k = 1; k < 4; k++) l.add(cone(th * 0.3, th * 1.8, bone, K.clone().lerp(F, k / 4.2).add(V(th * 0.9, 0, 0)), [0, 0, -1.3]));
      for (const a of [-0.55, 0, 0.55]) l.add(cone(th * 0.4, th * 3, bone, F.clone().add(V(0.03 + Math.cos(a) * 0.04, 0.02, -Math.sin(a) * 0.1 - 0.06)), [-1.35 + a * 0.2, 0, a * 0.3]));
      l.scale.x = sd; l.position.set(0.45 * sd, H, hind ? 0.65 : -0.35); g.add(l); legs.push(l);
    }
    // the tail: a ringed, barbed whip curling up into a bone spear
    const tail = new THREE.Group(); tail.position.set(0, 1.05, 0.78); B.add(tail);
    { const tp = [V(0, 0, 0), V(0, -0.1, 0.55), V(0, 0.12, 1.0), V(0, 0.55, 1.2), V(0, 0.95, 1.1)], cv = new THREE.CatmullRomCurve3(tp), rr = (k: number) => 0.2 - 0.17 * k;
      tail.add(tube(tp, 0.2, 0.03, shell, undefined, 30, 10));
      for (let i = 1; i < 11; i++) { const k = i / 11, p = cv.getPoint(k), tg = cv.getTangent(k), rg = new THREE.Mesh(new THREE.TorusGeometry(rr(k) + 0.012, 0.024 * (1 - k * 0.5), 7, 16), i % 2 ? bone : dark); rg.position.copy(p); rg.quaternion.setFromUnitVectors(V(0, 0, 1), tg); tail.add(rg); tail.add(cone(0.028 * (1 - k * 0.5), 0.2 * (1 - k * 0.5), bone, p.clone().add(V(0, rr(k), 0)))); }
      const te = cv.getPoint(1), tt = cv.getTangent(1), bl = cone(0.065, 0.6, bone, te.clone().addScaledVector(tt, 0.27)); bl.quaternion.setFromUnitVectors(V(0, 1, 0), tt); tail.add(bl);
      for (const sd of [-1, 1]) { const bb = cone(0.035, 0.28, bone, te.clone().add(V(0.08 * sd, 0.0, 0.04))); bb.quaternion.setFromUnitVectors(V(0, 1, 0), V(0.5 * sd, 0.7, 0.4).normalize()); tail.add(bb); } }
    (g as any).userData.tick = (t: number) => { jaw.rotation.x = -0.22 - 0.08 * Math.sin(t * 2.2); tongue.rotation.y = Math.sin(t * 4.1) * 0.28; tongue.rotation.x = -0.05 + Math.sin(t * 3.3) * 0.14; tongue.scale.z = 0.92 + 0.12 * Math.sin(t * 2.7); tail.rotation.y = Math.sin(t * 1.7) * 0.2; tail.rotation.x = Math.sin(t * 1.2) * 0.05; seam.emissiveIntensity = 1.5 + 0.6 * Math.sin(t * 3.0); eyeM.emissiveIntensity = 2.6 + 0.8 * Math.sin(t * 3.7); maw.emissiveIntensity = 0.9 + 0.4 * Math.sin(t * 2.2); };
  }
  {   // second pass on the ten species added from the owner's list: fingers, claws, plates, belts, lights, cables: the small parts that make them read as finished creatures
    const dk = mk(CHIT(0x14181e, { roughness: 0.3, metalness: 0.6 })), mt = mk(CHIT(0x9aa0aa, { roughness: 0.25, metalness: 0.8, clearcoat: 0.8 })), bn = mk(CHIT(0xd8ccb0, { roughness: 0.35 }));
    const fing = (a: THREE.Object3D, m: THREE.Material, n: number, len: number, th: number, y: number, z: number, sd: number) => { for (let k = 0; k < n; k++) { const dx = (k - (n - 1) / 2) * th * 2.4; a.add(tube([V(dx * sd, y, z), V(dx * sd * 1.2, y - len * 0.5, z + len * 0.35), V(dx * sd * 1.3, y - len * 0.75, z + len * 0.8)], th, th * 0.3, m)); } };
    const studs = (cnt: number, r: number, y0: number, dy: number, zc: number, m: THREE.Material) => { for (let i = 0; i < cnt; i++) { const a = i / cnt * Math.PI * 2, s = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), m); s.position.set(Math.cos(a) * r, y0 + Math.sin(i * 1.7) * dy, zc + Math.sin(a) * r); body.add(s); } };
    const dots = (pts: THREE.Vector3[], c: number, r = 0.014) => { const gm = GLOW(c); for (const p of pts) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), gm); s.position.copy(p); body.add(s); } };
    // (the war bug builds all of its small parts inside its own branch above)
    // (the saber lord builds all of its small parts inside its own branch above)
    // (the sky warrior builds all of its small parts inside its own branch above)
    // (the leviathan builds all of its small parts inside its own branch above)
    // (the hunter's small parts are built inside its own branch above)
  }
  if (FAMILY[kind0] && VARIANT[kind0]) { const [vx, vy, vz] = VARIANT[kind0]; g.children.forEach(c => c.scale.set(c.scale.x * vx, c.scale.y * vy, c.scale.z * vz)); }
  if (kind === "skitter" || kind === "charger") { const sm = mk(CHIT(0x2a1a0e)); const n = kind === "charger" ? 7 : 5; for (let i = 0; i < n; i++) body.add(cone(kind === "charger" ? 0.1 : 0.05, kind === "charger" ? 0.5 : 0.28, sm, V((i % 2 ? 0.25 : -0.25) * (kind === "charger" ? 1.6 : 0.8), kind === "charger" ? 1.15 : 0.7, (kind === "charger" ? -0.9 : -0.35) + i * (kind === "charger" ? 0.34 : 0.22)), [-0.25, 0, (i % 2 ? -0.5 : 0.5)])); }
  { const gc = tint ? tint : kind === "spitter" ? 0x6aff2a : kind === "skyeye" ? 0xa04aff : kind === "flarecaster" ? 0xff7a2a : 0xff2a1a; const gl = new THREE.Mesh(new THREE.CircleGeometry(kind === "charger" ? 1.6 : 1.1, 24), new THREE.MeshBasicMaterial({ map: haloTex, color: gc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.04; g.add(gl); }   // a faint ominous glow on the floor under every alien
  {   // neon edge lines on the armour plates: a cyber-biomech look, drawn once per alien
    const nc = tint ? tint : kind === "spitter" ? 0x7dff3a : kind === "skyeye" ? 0xc06aff : kind === "flarecaster" ? 0xff8a2a : kind === "charger" ? 0xff3a3a : kind === "mantis" ? 0x2affd0 : 0x35c8ff;
    const P = REFPAL[kind0] || REFPAL.xeno;   // colours taken from the owner's three reference pictures (2026-10-29)
    if (!NOEMB.has(kind0) && kind0 !== "carapace" && kind0 !== "hydraling") mats.forEach((mm, i) => { if (mm.userData && mm.userData.keep) return; const c0 = mm.color, lum = Math.min(1, (c0.r + c0.g + c0.b) / 2); (mm as any).emissiveIntensity = 0.45; mm.color.setHex(i % 3 === 2 ? P[2] : i % 2 ? P[1] : P[0]); mm.color.multiplyScalar(0.8 + 0.5 * lum); { const sm = mm as any, sk = skinFor(P); if (sm.isMeshPhysicalMaterial || sm.isMeshStandardMaterial) { sm.map = sk; sm.bumpMap = sk; sm.bumpScale = P === XENO ? 1.6 : 1.0; sm.needsUpdate = true; if (P === XENO) { sm.roughness = 0.3; sm.clearcoat = 0.6; sm.clearcoatRoughness = 0.2; sm.envMapIntensity = 0.6; } } } if (tint) mm.color.lerp(new THREE.Color(tint), 0.1); });
  }
  try { embellish(kind0, g, tint); } catch (err) { /* the base model still stands */ }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  return { g, legs, arms, mats, body };
}

/* ── menace pass (owner 2026-10-29: "make the aliens prettier: the bugs scarier, the grand ones grand, the fierce tribes fierce") ──
   Run after every alien is built. It reads the finished model (a bounding box and rays onto its own surface), so the same code dresses all 30+ species:
   BUGS get a ridge of glowing-tipped spines, a maw of fangs with drool, a cluster of extra eyes and side blades; GRAND species get a halo, a crown,
   orbiting shards and a ring on the floor; FIERCE tribes get a glowing throat with rows of teeth, menacing eye halos and swaying whip tendrils. */
const BONE = new THREE.MeshStandardMaterial({ color: 0xe8e2cc, roughness: 0.45, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 }); BONE.color.setHex(0xcfc6a4);
const DRIP = new THREE.MeshStandardMaterial({ color: 0x9aff5a, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.7, emissive: 0x2a7a10, emissiveIntensity: 0.8 });
const GRANDC = new Set<string>(["warden", "matriarch", "walker", "titan", "lumawarden", "flarecaster", "skyeye", "wisp", "veilmaw", "behemoth", "drone"]);
const TRIBEC = new Set<string>(["capling", "manthood", "domestalker", "xenodrone", "huntsman", "spiker", "bloater", "hound", "sporecaster"]);
const ACCENT: Record<string, number> = { warden: 0xff7a2a, matriarch: 0xff3a8a, walker: 0xff2a2a, titan: 0xff5a1a, lumawarden: 0x7affd0, flarecaster: 0xff8a2a, skyeye: 0xc06aff, wisp: 0x6affff, veilmaw: 0x6a9aff, behemoth: 0xffaa3a, drone: 0x3ad6ff, capling: 0xff8a3a, manthood: 0xb06aff, domestalker: 0xff3a3a, xenodrone: 0xff3a3a, huntsman: 0x3affc0, greyling: 0x8affc0, hydraling: 0xff4a2a, warbug: 0xff5a1a, saberlord: 0x66ccff, skyfolk: 0x66ffee, leviathan: 0xff3a2a, tripod: 0xff5a2a, carapace: 0xff2a6a, spiker: 0xff5a2a, bloater: 0x9aff3a, hound: 0x3affe0, sporecaster: 0xff6aff };
const NOEMB = new Set<string>(["hydraling", "manthood", "domestalker", "xenodrone", "greyling", "skyfolk", "saberlord", "huntsman", "tripod", "carapace", "leviathan"]);   // humanoid and machine designs keep their own look: no fangs, maw or spikes added
function embellish(kind: AlienKind, g: THREE.Group, tint: number) {
  if (NOEMB.has(kind)) return;
  const cat = GRANDC.has(kind) ? "grand" : TRIBEC.has(kind) ? "tribe" : "bug", acc = tint || ACCENT[kind] || 0xff2a1a;
  g.updateMatrixWorld(true);
  const meshes: THREE.Object3D[] = []; g.traverse(o => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type !== "CircleGeometry") meshes.push(o); });   // (the floor glow disc is not a surface: rays that missed the body used to land on it and stand spikes on the ground)
  const bb = new THREE.Box3().setFromObject(g), h = Math.max(0.6, bb.max.y), wd = Math.max(0.5, bb.max.x - bb.min.x), dp = Math.max(0.5, bb.max.z - bb.min.z);
  const u = Math.min(wd * 0.5, h * 0.42), rc = new THREE.Raycaster(), hit = (o: THREE.Vector3, d: THREE.Vector3) => { rc.set(o, d.clone().normalize()); const r = rc.intersectObjects(meshes, false)[0]; return r ? r.point.clone() : null; };
  const gm = GLOW(acc), add = (o: THREE.Object3D) => { g.add(o); return o; };
  const spike = (p: THREE.Vector3, len: number, r: number, dir: THREE.Vector3, m: THREE.Material, tip = true) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, len, 12), m); c.position.copy(p).addScaledVector(dir, len * 0.4); c.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); add(c); if (tip) { const t = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 6, 5), gm); t.position.copy(p).addScaledVector(dir, len * 0.95); add(t); } };
  let face: THREE.Vector3 | null = null;   // the front-most point of the model near head height: where the maw goes
  for (let k = 0; k <= 8; k++) { const y = h * (0.85 - k * 0.07), p = hit(V(0, y, bb.min.z - 1), V(0, 0, 1)); if (p && (!face || p.z < face.z - 0.01)) face = p; }
  const teeth = (n: number, spread: number, len: number, y: number, up: boolean) => { if (!face) return; for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : i / (n - 1) - 0.5; const c = new THREE.Mesh(new THREE.ConeGeometry(len * 0.2, len, 5), BONE); c.position.set(face.x + k * spread, face.y + (up ? -len * 0.5 : len * 0.5 - spread * 0.2) + y, face.z + 0.03 + Math.abs(k) * 0.02); c.rotation.x = up ? Math.PI : 0; add(c); } };
  const ridge = (n: number, len: number, m: THREE.Material) => { for (let i = 0; i < n; i++) { const z = bb.min.z + dp * (0.18 + 0.7 * i / Math.max(1, n - 1)), p = hit(V(0, h + 2, z), V(0, -1, 0)); if (p) spike(p, len * (1 - 0.25 * Math.abs(i / Math.max(1, n - 1) - 0.4)), wd * 0.028, V(0, 1, -0.25), m); } };
  const tickers: ((t: number) => void)[] = [];
  if (cat === "bug") {
    ridge(9, wd * 0.2, CHIT(0x1a0e08));
    if (face) {
      teeth(5, u * 0.34, u * 0.1, -u * 0.02, true); teeth(4, u * 0.28, u * 0.07, -u * 0.07, false);
      for (const sd of [-1, 1]) { const b = new THREE.Mesh(new THREE.ConeGeometry(u * 0.05, u * 0.34, 6), CHIT(0x1a0e08)); b.position.set(face.x + sd * u * 0.2, face.y - u * 0.1, face.z - u * 0.05); b.rotation.set(-Math.PI / 2 - 0.2, 0, sd * 0.5); add(b); }   // side blades
      for (const [dx, dy] of [[-0.05, 0.1], [0.05, 0.1], [-0.1, 0.16], [0.1, 0.16]] as number[][]) { const e = new THREE.Mesh(new THREE.SphereGeometry(u * 0.035, 8, 6), gm); e.position.set(face.x + dx * u * 2, face.y + dy * u * 2, face.z + 0.02); add(e); }   // extra eyes
      for (const dx of [-0.05, 0.03]) { const d = new THREE.Mesh(new THREE.SphereGeometry(u * 0.03, 8, 6), DRIP); d.scale.y = 1.8; d.position.set(face.x + dx * u * 2, face.y - u * 0.3, face.z + 0.04); add(d); tickers.push(t => { d.position.y = face!.y - u * (0.28 + 0.12 * ((t * 0.7 + dx * 9) % 1)); }); }
    }
    const bl = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: acc, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); bl.scale.setScalar(wd * 1.8); bl.position.set(0, h * 0.18, 0); add(bl);   // a sick glow under the belly
  } else if (cat === "grand") {
    const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: acc, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); hs.scale.setScalar(h * 2.4); hs.position.set(0, h * 0.62, dp * 0.18); add(hs);
    const top = hit(V(0, h + 2, bb.min.z + dp * 0.35), V(0, -1, 0)) || V(0, h, 0), cr = wd * 0.13;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, tall = i % 2 ? 0.7 : 1; spike(V(top.x + Math.cos(a) * cr, top.y - 0.02, top.z + Math.sin(a) * cr), wd * 0.2 * tall, wd * 0.022, V(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35), CHIT(0x2a1a14)); }   // a crown
    const orb = new THREE.Group(); orb.position.y = h * 0.58; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, c = new THREE.Mesh(new THREE.OctahedronGeometry(wd * 0.055, 0), gm); c.scale.y = 1.9; c.position.set(Math.cos(a) * wd * 0.72, Math.sin(i * 2.1) * h * 0.1, Math.sin(a) * wd * 0.72); orb.add(c); } add(orb); tickers.push(t => { orb.rotation.y = t * 0.9; orb.position.y = h * 0.58 + Math.sin(t * 1.4) * h * 0.03; });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(wd * 0.62, wd * 0.012, 6, 40), gm); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; add(ring); tickers.push(t => { ring.scale.setScalar(1 + 0.04 * Math.sin(t * 3)); });
    ridge(7, wd * 0.16, CHIT(0x201410));
  } else {
    if (face) {
      const throat = new THREE.Mesh(new THREE.SphereGeometry(u * 0.1, 10, 8), GLOW(0xff2a10)); throat.scale.set(1.2, 0.8, 0.6); throat.position.set(face.x, face.y - u * 0.06, face.z + u * 0.03); add(throat);
      teeth(7, u * 0.4, u * 0.11, -u * 0.01, true); teeth(6, u * 0.34, u * 0.08, -u * 0.07, false);
      for (const sd of [-1, 1]) { const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: acc, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); hs.scale.setScalar(u * 0.45); hs.position.set(face.x + sd * u * 0.14, face.y + u * 0.16, face.z - 0.02); add(hs); }
    }
    ridge(8, wd * 0.2, CHIT(0x14100c));
    const whips: THREE.Group[] = []; if (kind !== "capling") for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) { const w = new THREE.Group(); w.position.set(sd * wd * 0.3, h * (0.62 - k * 0.14), dp * 0.05); let p = V(0, 0, 0); for (let j = 0; j < 6; j++) { const q = p.clone().add(V(sd * 0.1, -0.12 - j * 0.015, 0.1)); w.add(limb(p, q, wd * 0.016 * (1 - j / 7), wd * 0.014 * (1 - j / 7), CHIT(0x1a1410))); p = q; } { const wt = new THREE.Mesh(new THREE.ConeGeometry(wd * 0.012, wd * 0.08, 8), gm); wt.position.copy(p).add(V(0, -wd * 0.03, 0.01)); wt.rotation.x = Math.PI; w.add(wt); } g.add(w); whips.push(w); } tickers.push(t => whips.forEach((w, i) => { w.rotation.z = Math.sin(t * 2.2 + i) * 0.35; w.rotation.x = Math.cos(t * 1.7 + i * 2) * 0.25; }));
  }
  for (const m of meshes) { const mm = m as THREE.Mesh; const mt = mm.material as any; if (mt && mt.isMeshPhysicalMaterial) { mt.clearcoat = 1; mt.envMapIntensity = 1.4; } }
  (g as any).userData.tick = (t: number) => { for (const f of tickers) f(t); };
}

/* ── the gun in hand (all fourteen redesigned, owner 2026-10-18) ── */
const GUN_MUZZLE: Record<string, number> = { pistol: -0.34, rifle: -0.9, laser: -0.7, shotgun: -0.82, arc: -0.8, beam: -0.95, pulsar: -0.75, storm: -0.8, cryo: -0.72, nova: -0.8, rail: -1.05, launcher: -0.72, rpg: -1.0, salvo: -0.66 };
function buildGun(id: string): THREE.Group {
  const g = new THREE.Group();
  const steel = MAT(0x2b3038, { metalness: 0.85, roughness: 0.28 }), dark = MAT(0x101318, { metalness: 0.7, roughness: 0.4 }), carbon = MAT(0x1a1c20, { metalness: 0.3, roughness: 0.55 }), white = MAT(0xd9dde6, { metalness: 0.5, roughness: 0.3 }), grip = MAT(0x1b1f25, { roughness: 0.85 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
  const cyl = (rt: number, rb: number, l: number, m: THREE.Material, x: number, y: number, z: number, seg = 14) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, l, seg), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); return c; };
  const tor = (r: number, t: number, m: THREE.Material, x: number, y: number, z: number, ry = 0) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 22), m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  const sph = (r: number, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; };
  const cone = (r: number, l: number, m: THREE.Material, x: number, y: number, z: number, fwd = true) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, l, 12), m); c.rotation.x = fwd ? -Math.PI / 2 : Math.PI / 2; c.position.set(x, y, z); g.add(c); return c; };
  const handle = (z = 0.04, h = 0.15) => { box(0.045, h, 0.07, grip, 0, -0.1 - h * 0.1, z, 0.28); box(0.05, 0.012, 0.075, steel, 0, -0.03, z - 0.01); tor(0.04, 0.008, steel, 0, -0.07, z - 0.1, Math.PI / 2); };
  const stock = (len = 0.22, m: THREE.Material = carbon) => { box(0.055, 0.1, len, m, 0, -0.025, 0.2 + len * 0.3); box(0.06, 0.12, 0.03, steel, 0, -0.03, 0.2 + len * 0.3 + len / 2); };
  const vents = (n: number, z0: number, step: number, y = 0.0, x = 0.034, c = dark) => { for (let i = 0; i < n; i++) { box(0.008, 0.045, 0.022, c, x, y, z0 - i * step); box(0.008, 0.045, 0.022, c, -x, y, z0 - i * step); } };
  if (id === "pistol") {   // Pulse sidearm: a white-and-steel slide with a glowing cyan core and a translucent energy cell in the grip
    box(0.052, 0.062, 0.3, white, 0, 0.01, -0.12); box(0.056, 0.02, 0.3, steel, 0, 0.048, -0.12); box(0.01, 0.025, 0.2, GLOW(0x41e0ff), 0.028, 0.012, -0.14); box(0.01, 0.025, 0.2, GLOW(0x41e0ff), -0.028, 0.012, -0.14);
    cyl(0.017, 0.017, 0.08, dark, 0, 0.012, -0.3); tor(0.022, 0.006, GLOW(0x41e0ff), 0, 0.012, -0.265, 0); box(0.012, 0.018, 0.012, GLOW(0xff4a4a), 0, 0.066, -0.25); box(0.01, 0.015, 0.012, steel, 0, 0.066, 0.02);
    handle(0.07, 0.15); box(0.012, 0.09, 0.045, GLOW(0x41e0ff), 0.027, -0.1, 0.075, 0.28);
  } else if (id === "rifle") {   // Plasma rifle: bullpup frame, vented handguard, red-dot sight, curved cell magazine
    box(0.065, 0.1, 0.52, steel, 0, 0, -0.18); box(0.058, 0.07, 0.34, white, 0, -0.01, -0.5); vents(4, -0.4, 0.07, 0.0, 0.032); cyl(0.016, 0.016, 0.3, dark, 0, 0.0, -0.84); cyl(0.026, 0.02, 0.07, steel, 0, 0.0, -0.99);
    box(0.016, 0.016, 0.34, GLOW(0x7affb0), 0, 0.058, -0.42); stock(0.2, carbon); handle(0.0, 0.14); box(0.05, 0.14, 0.07, dark, 0, -0.14, -0.22, 0.2); box(0.012, 0.1, 0.05, GLOW(0x7affb0), 0.028, -0.14, -0.22, 0.2);
    box(0.05, 0.04, 0.12, dark, 0, 0.085, -0.12); const gl = box(0.04, 0.03, 0.01, GLOW(0x66ccff), 0, 0.1, -0.2); gl.rotation.x = 0.1; box(0.012, 0.03, 0.012, GLOW(0xff3a3a), 0, 0.1, -0.205);
  } else if (id === "laser") {   // Laser SMG: compact, a red focusing coil wrapped round the barrel, twin lenses
    box(0.06, 0.08, 0.4, steel, 0, 0, -0.14); box(0.07, 0.03, 0.3, GLOW(0xff4a5a), 0, 0.055, -0.2); cyl(0.024, 0.024, 0.3, dark, 0, 0, -0.5); for (let i = 0; i < 5; i++) tor(0.036, 0.007, GLOW(0xff4a5a), 0, 0, -0.4 - i * 0.055); sph(0.022, GLOW(0xffb0b0), 0, 0, -0.66);
    box(0.02, 0.05, 0.1, GLOW(0xff4a5a), 0.04, 0.0, -0.1); box(0.02, 0.05, 0.1, GLOW(0xff4a5a), -0.04, 0.0, -0.1); handle(0.0, 0.14); box(0.04, 0.15, 0.07, dark, 0, -0.12, -0.3, 0.12); box(0.05, 0.08, 0.1, carbon, 0, 0.0, 0.15);
  } else if (id === "shotgun") {   // Ion scatter: wide double-tube, pump grip, violet ion rings
    cyl(0.032, 0.032, 0.62, steel, 0, 0.03, -0.35); cyl(0.028, 0.028, 0.5, dark, 0, -0.035, -0.3); for (let i = 0; i < 4; i++) tor(0.042, 0.009, GLOW(0xc77aff), 0, 0.03, -0.18 - i * 0.12);
    box(0.075, 0.1, 0.3, steel, 0, 0, -0.0); box(0.1, 0.07, 0.17, carbon, 0, -0.058, -0.42); cyl(0.04, 0.036, 0.05, white, 0, 0.03, -0.68); cyl(0.034, 0.03, 0.04, GLOW(0xe0b0ff), 0, 0.03, -0.72); stock(0.24, carbon); handle(0.1, 0.14);
  } else if (id === "arc") {   // Arc caster: a tesla spire, three shrinking coils and a crackling orb held between two prongs
    cyl(0.04, 0.05, 0.42, steel, 0, 0, -0.2); for (let i = 0; i < 4; i++) tor(0.07 - i * 0.012, 0.012, GLOW(0x9ad8ff), 0, 0, -0.34 - i * 0.1); box(0.012, 0.012, 0.3, GLOW(0xffffff), 0.045, 0.045, -0.6); box(0.012, 0.012, 0.3, GLOW(0xffffff), -0.045, 0.045, -0.6);
    box(0.012, 0.012, 0.3, GLOW(0xffffff), 0.045, -0.045, -0.6); box(0.012, 0.012, 0.3, GLOW(0xffffff), -0.045, -0.045, -0.6); sph(0.045, GLOW(0xffffff), 0, 0, -0.75); tor(0.065, 0.006, GLOW(0xbfe8ff), 0, 0, -0.75, Math.PI / 2); handle(0.0, 0.14); box(0.06, 0.1, 0.16, carbon, 0, -0.02, 0.15);
  } else if (id === "beam") {   // Photon lance: a long barrel of stacked lenses, amber core, long scope
    box(0.07, 0.1, 0.5, steel, 0, 0, -0.16); cyl(0.04, 0.04, 0.5, white, 0, 0, -0.6); for (let i = 0; i < 4; i++) tor(0.048, 0.01, GLOW(0xffe45a), 0, 0, -0.5 - i * 0.1); sph(0.04, GLOW(0xfff2a0), 0, 0, -0.9); box(0.075, 0.024, 0.4, GLOW(0xffe45a), 0, 0.062, -0.2);
    cyl(0.025, 0.025, 0.26, dark, 0, 0.1, -0.18); cyl(0.03, 0.03, 0.02, GLOW(0xffe45a), 0, 0.1, -0.31); handle(0.05, 0.14); stock(0.2);
  } else if (id === "pulsar") {   // Pulsar burst: three barrels in a ring, magenta rings, a fat energy block on top
    box(0.1, 0.1, 0.46, steel, 0, 0, -0.14); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2; cyl(0.018, 0.018, 0.4, dark, Math.cos(a) * 0.04, Math.sin(a) * 0.04, -0.58); }
    for (let i = 0; i < 3; i++) tor(0.062, 0.01, GLOW(0xff4fd8), 0, 0, -0.46 - i * 0.1); box(0.085, 0.05, 0.3, GLOW(0xff4fd8), 0, 0.075, -0.14); box(0.1, 0.03, 0.12, white, 0, 0.11, -0.05); vents(3, -0.2, 0.06, 0.0, 0.052); handle(0.03, 0.14); stock(0.18);
  } else if (id === "storm") {   // Storm twin-laser: two long rails side by side, orange heat coils
    for (const x of [-0.05, 0.05]) { box(0.05, 0.07, 0.52, steel, x, 0, -0.2); box(0.04, 0.02, 0.4, GLOW(0xff9a2e), x, 0.048, -0.24); cyl(0.014, 0.014, 0.28, dark, x, 0, -0.62); for (let i = 0; i < 3; i++) tor(0.026, 0.006, GLOW(0xff9a2e), x, 0, -0.5 - i * 0.07); sph(0.02, GLOW(0xffd08a), x, 0, -0.77); }
    box(0.15, 0.05, 0.12, dark, 0, 0.0, -0.02); box(0.04, 0.08, 0.3, white, 0, 0.05, -0.2); handle(0.04, 0.14); stock(0.18);
  } else if (id === "cryo") {   // Cryo beam: a frost tank, a snow-white nozzle ringed with ice spikes
    cyl(0.045, 0.05, 0.46, white, 0, 0, -0.2); const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 12), GLOW(0x6fd0ff)); tank.rotation.x = Math.PI / 2; tank.position.set(0, 0.1, -0.1); g.add(tank); tor(0.06, 0.01, steel, 0, 0.1, -0.02, 0); tor(0.06, 0.01, steel, 0, 0.1, -0.2, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cone(0.016, 0.12, GLOW(0x9fe8ff), Math.cos(a) * 0.058, Math.sin(a) * 0.058, -0.52 - (i % 2) * 0.05); } cyl(0.062, 0.04, 0.08, steel, 0, 0, -0.46); sph(0.03, GLOW(0xffffff), 0, 0, -0.6); handle(0.04, 0.14); box(0.06, 0.1, 0.16, carbon, 0, -0.02, 0.17);
  } else if (id === "nova") {   // Nova cannon: a caged plasma core behind a flared muzzle, a heavy frame
    box(0.11, 0.13, 0.46, steel, 0, 0, -0.14); sph(0.075, GLOW(0x7dffe0), 0, 0.02, -0.1); for (let k = 0; k < 3; k++) { const c = tor(0.105, 0.011, GLOW(0xbffff0), 0, 0.02, -0.1); c.rotation.set(k * 1.05, k * 0.6, 0); }
    cyl(0.05, 0.05, 0.36, dark, 0, 0, -0.5); cyl(0.09, 0.05, 0.14, white, 0, 0, -0.72); for (let i = 0; i < 3; i++) tor(0.07, 0.014, GLOW(0x7dffe0), 0, 0, -0.42 - i * 0.12); sph(0.045, GLOW(0xffffff), 0, 0, -0.76); handle(0.06, 0.15); stock(0.2);
  } else if (id === "rail") {   // Rail cannon: two long magnetic rails with glowing chevrons and a heavy coil stack
    box(0.075, 0.09, 0.8, steel, 0, 0, -0.32); box(0.016, 0.07, 0.78, GLOW(0xa8c8ff), 0.052, 0.01, -0.36); box(0.016, 0.07, 0.78, GLOW(0xa8c8ff), -0.052, 0.01, -0.36); for (let i = 0; i < 6; i++) box(0.12, 0.13, 0.03, dark, 0, 0, -0.62 + i * 0.1);
    for (let i = 0; i < 5; i++) box(0.05, 0.012, 0.03, GLOW(0xcfe2ff), 0, 0.052, -0.78 + i * 0.12); cyl(0.022, 0.022, 0.12, white, 0, 0, -1.0); sph(0.025, GLOW(0xffffff), 0, 0, -1.06); handle(0.02, 0.15); stock(0.2); box(0.02, 0.12, 0.04, steel, 0, 0.085, -0.15);
  } else if (id === "launcher") {   // Plasma launcher: a fat tube with a glowing green bore and a drum chamber
    cyl(0.075, 0.075, 0.6, steel, 0, 0, -0.28); cyl(0.095, 0.085, 0.18, white, 0, 0, -0.64); cyl(0.07, 0.07, 0.02, GLOW(0x41ff9a), 0, 0, -0.74); tor(0.092, 0.01, GLOW(0x41ff9a), 0, 0, -0.55); tor(0.092, 0.01, GLOW(0x41ff9a), 0, 0, -0.12);
    cyl(0.1, 0.1, 0.16, dark, 0, 0, 0.0); box(0.04, 0.05, 0.16, carbon, 0, 0.1, -0.3); handle(0.05, 0.14); box(0.05, 0.05, 0.22, carbon, 0, -0.04, 0.22);
  } else if (id === "rpg") {   // RPG-7 Hellfire: a long tube with a flared rear venturi, the warhead nosed out of the front, optic on top
    cyl(0.062, 0.062, 0.78, MAT(0x4a5a3a, { metalness: 0.4, roughness: 0.6 }), 0, 0, -0.24); cyl(0.06, 0.1, 0.18, dark, 0, 0, 0.24); cyl(0.095, 0.1, 0.02, steel, 0, 0, 0.34); cyl(0.07, 0.07, 0.1, steel, 0, 0, -0.58);
    cyl(0.074, 0.074, 0.14, steel, 0, 0, -0.5); cyl(0.088, 0.062, 0.2, MAT(0x6b6a3a, { metalness: 0.5, roughness: 0.5 }), 0, 0, -0.74); cone(0.088, 0.22, GLOW(0xff6a2a), 0, 0, -0.95); tor(0.09, 0.012, GLOW(0xff8a3a), 0, 0, -0.64);
    handle(0.02, 0.15); box(0.04, 0.09, 0.07, grip, 0, -0.1, -0.34, -0.1); box(0.05, 0.08, 0.09, dark, 0, 0.085, -0.2); cyl(0.022, 0.022, 0.2, dark, 0, 0.12, -0.2); sph(0.02, GLOW(0x66ccff), 0, 0.12, -0.31);
  } else {   // salvo — Rocket barrage: a six-tube pod with yellow tipped rockets, a top sight and a long grip
    box(0.2, 0.17, 0.4, steel, 0, 0, -0.2); for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const x = (c - 1) * 0.062, y = (r - 0.5) * 0.07; cyl(0.026, 0.026, 0.48, dark, x, y, -0.36); cyl(0.02, 0.02, 0.06, GLOW(0xffd24a), x, y, -0.58); cone(0.02, 0.05, GLOW(0xff6a2a), x, y, -0.62); }
    box(0.22, 0.02, 0.4, white, 0, 0.095, -0.2); box(0.02, 0.1, 0.34, GLOW(0xffd24a), 0.105, 0.0, -0.2); box(0.02, 0.1, 0.34, GLOW(0xffd24a), -0.105, 0.0, -0.2); handle(0.0, 0.16); box(0.04, 0.1, 0.06, grip, 0, -0.14, -0.3, -0.1); box(0.05, 0.06, 0.1, dark, 0, 0.12, -0.15); sph(0.018, GLOW(0xff3a3a), 0, 0.15, -0.15);
  }
  g.traverse(o => { (o as any).frustumCulled = false; });
  return g;
}

export type Render = { draw: (s: State, dt: number) => void; resize: () => void; dispose: () => void; setHigh: (h: boolean) => void; events: (ev: Ev[]) => void; shake: number; info: () => any; mates: (list: { id: string; x: number; z: number; yaw: number; glow: string }[]) => void; canvas: HTMLCanvasElement };

export function createRender(host: HTMLElement, startHigh: boolean, lv = 0, lvObj: Level | null = null): Render {
  let high = startHigh; const LV = lvObj || (lv > 0 ? LEVELS[Math.min(lv, LEVELS.length) - 1] : null), KIT = LV && LV.kit ? LV.kit : "", JUNGLE = KIT === "jungle", TH = LV ? LV.theme : null, TINT = LV ? LV.tint : 0;
  const renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.shadowMap.enabled = high; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  let hifx: HiFx | null = null; const canvas = renderer.domElement; canvas.className = "ah-cv"; host.appendChild(canvas); // envOn is called below once the scene exists
  const scene = new THREE.Scene(); scene.background = new THREE.Color(TH ? TH.fog : 0x1a1420); scene.fog = new THREE.FogExp2(TH ? TH.fog : 0x3a2a34, TH ? TH.fogD : 0.017);
  let envTex: THREE.Texture | null = null;
  const envOn = (on: boolean) => { try { if (on) { if (!envTex) { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } scene.environment = envTex; (scene as any).environmentIntensity = 0.55; } else scene.environment = null; } catch (_) { scene.environment = null; } };
  let mateList: { id: string; x: number; z: number; yaw: number; glow: string }[] = []; const mateMeshes = new Map<string, THREE.Group>();
  const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 220); cam.rotation.order = "YXZ"; scene.add(cam);
  if (high) hifx = createHiFx(renderer, scene, () => cam, { bloom: 0.6, radius: 0.55, threshold: 0.8, kit: KIT }); envOn(high);

  /* sky: a dusk gradient dome, a huge Harvester ship hanging in it */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(8, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); if (TH) { gr.addColorStop(0, TH.sky[0]); gr.addColorStop(0.45, TH.sky[1]); gr.addColorStop(0.66, TH.sky[2]); gr.addColorStop(1, TH.sky[3]); } else { gr.addColorStop(0, "#0b0a1e"); gr.addColorStop(0.45, "#4a2744"); gr.addColorStop(0.62, "#c4684a"); gr.addColorStop(0.66, "#e8a05a"); gr.addColorStop(1, "#2a1c26"); } g.fillStyle = gr; g.fillRect(0, 0, 8, 256); }) }));
  scene.add(sky);
  const ship = new THREE.Group(); const hullM = MAT(0x15131c, { metalness: 0.7, roughness: 0.4 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(46, 52, 7, 40), hullM); ship.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 1.2, 8, 48), GLOW(TH ? TH.ring : 0xff4a3a)); ring.rotation.x = Math.PI / 2; ring.position.y = -3.8; ship.add(ring);
  const core = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10), GLOW(0xff7a3a)); core.position.y = -6; core.scale.y = 0.5; ship.add(core);
  ship.position.set(-30, 62, -110); scene.add(ship);
  if (KIT) ship.visible = false;   // a Robot Adventure 3D level has its own sky
  if (JUNGLE) {   // Luma: no Harvester ship; a pale ringed gas giant hangs in the sky instead
    ship.visible = false;
    const giant = new THREE.Mesh(new THREE.SphereGeometry(30, 28, 18), new THREE.MeshBasicMaterial({ fog: false, map: canvasTex(256, 128, g => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#9ad8c8"); gr.addColorStop(0.5, "#5aa89a"); gr.addColorStop(1, "#2a6a68"); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 9; i++) { g.fillStyle = "rgba(255,255,255," + (0.05 + (i % 3) * 0.04) + ")"; g.fillRect(0, 8 + i * 13, 256, 4 + (i % 4)); } }) })); giant.position.set(-60, 55, -140); scene.add(giant);
    const rg = new THREE.Mesh(new THREE.RingGeometry(40, 58, 48), new THREE.MeshBasicMaterial({ color: 0xbff0e0, side: THREE.DoubleSide, transparent: true, opacity: 0.35, fog: false })); rg.rotation.x = 1.25; rg.rotation.y = 0.3; rg.position.copy(giant.position); scene.add(rg);
  }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(Array.from({ length: 600 }, () => 0).map((_, i) => (i % 3 === 1 ? 20 + Math.random() * 150 : (Math.random() - 0.5) * 340)), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, fog: false, sizeAttenuation: false })); scene.add(stars);

  /* light */
  scene.add(new THREE.HemisphereLight(TH ? TH.hemi[0] : 0xcfd2ff, TH ? TH.hemi[1] : 0x2a2440, 0.9));
  const sun = new THREE.DirectionalLight(TH ? TH.sun : 0xffd9b0, 1.3); sun.position.set(-30, 40, 25); sun.castShadow = high; sun.shadow.mapSize.set(hiTier() >= 3 ? 2048 : 1024, hiTier() >= 3 ? 2048 : 1024); sun.shadow.radius = 2.5; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); scene.add(sun);
  const rimL = new THREE.DirectionalLight(0x7aa8ff, 0.9); rimL.position.set(20, 18, -30); scene.add(rimL); { const back = new THREE.DirectionalLight(0x5fd0ff, high ? 1.5 : 0.8); back.position.set(0, 14, -40); scene.add(back); const back2 = new THREE.DirectionalLight(0xff9a5a, high ? 0.6 : 0.3); back2.position.set(-25, 8, 30); scene.add(back2); }   // blue-white back light and a warm kicker: the poster look, a silhouette with a shining edge
  const flash = new THREE.PointLight(0xffd080, 0, 14); scene.add(flash);

  /* ground and the level kit */
  const asphalt = canvasTex(256, 256, g => { g.fillStyle = "#3b3640"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 1800, 0.2); g.strokeStyle = "rgba(230,200,90,.55)"; g.lineWidth = 3; g.setLineDash([22, 18]); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke(); }, 22);
  const moss = canvasTex(256, 256, g => { g.fillStyle = "#1d3a2c"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 2600, 0.3); for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(" + (60 + (i % 5) * 30) + ",255," + (150 + (i % 3) * 40) + ",.16)"; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 0, 7); g.fill(); } }, 14);
  const hx = (n: number) => "#" + n.toString(16).padStart(6, "0"), AUTO = LV && LV.auto ? LV.auto : null;
  const KITC: Record<string, string> = { auto: hx(TH ? TH.ground : 0x666666), desert: "#7a5030", ice: "#6f90b0", lava: "#2c1a16", ruins: "#3c3a4c", gas: "#6a4a7a", belt: "#4a5a6a", sun: "#8a5a20" }, KITW: Record<string, number> = { auto: TH ? TH.wall : 0x333344, jungle: 0x0c2a1c, desert: 0x4a2a14, ice: 0x2a4a68, lava: 0x1a0c08, ruins: 0x1c1830, gas: 0x2a1a4a, belt: 0x1a2a3c, sun: 0x4a2008 };
  const kitTex = canvasTex(256, 256, g => { g.fillStyle = KITC[KIT] || "#444"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 2400, 0.32); for (let i = 0; i < 60; i++) { g.fillStyle = KIT === "lava" ? "rgba(255," + (80 + (i % 4) * 30) + ",20,.18)" : "rgba(255,255,255,.07)"; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 0, 7); g.fill(); } }, 14);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4), new THREE.MeshStandardMaterial({ map: KIT ? (JUNGLE ? moss : kitTex) : asphalt, color: TH ? TH.ground : 0xffffff, roughness: 0.92, metalness: 0.05 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const crateTex = canvasTex(128, 128, g => { g.fillStyle = "#5a5648"; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 500, 0.25); g.fillStyle = "#d4a93a"; for (let i = -2; i < 8; i++) { g.save(); g.translate(i * 24, 0); g.rotate(-0.6); g.fillRect(0, -10, 10, 220); g.restore(); } g.fillStyle = "rgba(20,20,24,.5)"; g.fillRect(0, 0, 128, 16); }, 1);
  const wallTex = canvasTex(256, 128, g => { g.fillStyle = "#33303a"; g.fillRect(0, 0, 256, 128); noise(g, 256, 128, 900, 0.18); g.fillStyle = "rgba(255,170,80,.7)"; for (let i = 0; i < 18; i++) g.fillRect(8 + (i % 6) * 40, 14 + Math.floor(i / 6) * 34, 16, 20); }, 1);
  const rockTex = canvasTex(128, 128, g => { g.fillStyle = "#3a4a40"; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 900, 0.3); g.fillStyle = "rgba(90,255,190,.25)"; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 0, 7); g.fill(); } }, 1);
  const boxMat = new THREE.MeshStandardMaterial({ map: KIT ? (JUNGLE ? rockTex : kitTex) : crateTex, roughness: 0.8, metalness: 0.2 });
  const levelGroup = new THREE.Group(); scene.add(levelGroup);
  /* High only (plan 40 B): the same procedural textures double as bump maps, and a thin ground-fog sheet adds depth; Lite keeps flat materials */
  const gMat = ground.material as THREE.MeshStandardMaterial, gTex = gMat.map as THREE.Texture, bTex = boxMat.map as THREE.Texture;
  const fogSheet = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4), new THREE.MeshBasicMaterial({ color: TH ? TH.fog : 0x6a5a6a, transparent: true, opacity: 0.16, depthWrite: false })); fogSheet.rotation.x = -Math.PI / 2; fogSheet.position.y = 0.55; fogSheet.visible = false; scene.add(fogSheet);
  const surfOn = (on: boolean) => { try { gMat.bumpMap = on ? gTex : null; gMat.bumpScale = 2.2; boxMat.bumpMap = on ? bTex : null; boxMat.bumpScale = 1.6; gMat.roughness = on ? 0.82 : 0.92; fogSheet.visible = on && hiTier() >= 2; gMat.needsUpdate = true; boxMat.needsUpdate = true; } catch (_) { /* keep flat */ } };
  surfOn(high);
  let builtFor: any = null;
  const hzMesh: { m: THREE.Mesh; h: { per: number; on: number } }[] = [];
  function buildLevel(boxes: State["boxes"], hz: State["hz"] = []) {
    hzMesh.length = 0;
    while (levelGroup.children.length) levelGroup.remove(levelGroup.children[0]);
    for (const b of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), boxMat); m.position.set(b.x, b.h / 2, b.z); m.castShadow = true; m.receiveShadow = true; levelGroup.add(m); }
    const wm = new THREE.MeshStandardMaterial({ map: wallTex, color: TH ? TH.wall : 0xffffff, roughness: 0.85 }); const H = 9, L = ARENA + 1;
    for (const [x, z, w, d] of [[0, -L, L * 2, 1], [0, L, L * 2, 1], [-L, 0, 1, L * 2], [L, 0, 1, L * 2]] as number[][]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wm); m.position.set(x, H / 2, z); m.receiveShadow = true; levelGroup.add(m); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, lp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 6), MAT(0x222226)); lp.position.set(Math.cos(a) * 27, 3, Math.sin(a) * 27); levelGroup.add(lp); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), GLOW(0xffd080)); bulb.position.set(Math.cos(a) * 27, 6.1, Math.sin(a) * 27); levelGroup.add(bulb); }
    for (const h of hz) { const m = new THREE.Mesh(new THREE.CircleGeometry(h.r, 28), new THREE.MeshBasicMaterial({ color: h.col, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(h.x, 0.04, h.z); levelGroup.add(m); hzMesh.push({ m, h }); }
    if (KIT && !JUNGLE) {   // the other Robot Adventure 3D kits: walls in the planet's colour and a ring of tall landmarks beyond the arena
      const wl = new THREE.MeshStandardMaterial({ color: KITW[KIT], roughness: 0.9 });
      for (const m of levelGroup.children.slice(boxes.length, boxes.length + 4)) (m as THREE.Mesh).material = wl;
      const glowC = KIT === "auto" ? (AUTO ? AUTO.glow : 0x9aa0ff) : KIT === "ice" ? 0x7ad8ff : KIT === "lava" ? 0xff6a1a : KIT === "desert" ? 0xff9a4a : KIT === "gas" ? 0xffbe6e : KIT === "belt" ? 0x6ab0ff : KIT === "sun" ? 0xffc060 : 0x9a7aff, body = MAT(KIT === "auto" ? (TH ? TH.wall : 0x445566) : KIT === "ice" ? 0x6a9ac0 : KIT === "lava" ? 0x1c0e0a : KIT === "desert" ? 0x7a4a28 : KIT === "gas" ? 0x5a3a7a : KIT === "belt" ? 0x4a5a6a : KIT === "sun" ? 0x8a4a14 : 0x3a3a52, { roughness: 0.55 });
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + Math.sin(i * 7.3) * 0.05, rr = 24 + (i % 4) * 3 + Math.abs(Math.sin(i * 3.1)) * 3, h = 3 + Math.abs(Math.sin(i * 5.7)) * 6, g = new THREE.Group();
        const m = new THREE.Mesh(KIT === "desert" || KIT === "belt" || (KIT === "auto" && AUTO && AUTO.props === "mesa") ? new THREE.BoxGeometry(2.4 + (i % 3), h, 2.4 + (i % 2)) : KIT === "auto" && AUTO && AUTO.props === "tower" ? new THREE.BoxGeometry(1.8, h * 1.3, 1.8) : KIT === "auto" && AUTO && AUTO.props === "pod" ? new THREE.SphereGeometry(1.2 + (i % 3) * 0.4, 10, 8) : KIT === "desert" || KIT === "belt" ? new THREE.BoxGeometry(2.4 + (i % 3), h, 2.4 + (i % 2)) : KIT === "ruins" ? new THREE.BoxGeometry(1.8, h * 1.3, 1.8) : new THREE.ConeGeometry(0.9 + (i % 3) * 0.4, h * 1.4, KIT === "ice" ? 5 : 6), body); m.position.y = h * 0.55; m.rotation.y = i; g.add(m);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), GLOW(glowC)); tip.position.y = KIT === "desert" ? h * 1.1 : h * 1.25; g.add(tip);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: glowC, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(4, 4, 1); sp.position.copy(tip.position); g.add(sp);
        g.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); levelGroup.add(g); }
    }
    if (JUNGLE) {   // the jungle kit: leaf walls, a ring of glowing mushrooms and ferns beyond the arena
      const leaf = new THREE.MeshStandardMaterial({ color: 0x0c2a1c, roughness: 0.9 });
      for (const m of levelGroup.children.slice(boxes.length, boxes.length + 4)) (m as THREE.Mesh).material = leaf;
      for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2 + Math.sin(i * 7.3) * 0.05, rr = 24 + (i % 4) * 3 + Math.abs(Math.sin(i * 3.1)) * 3, h = 2.4 + Math.abs(Math.sin(i * 5.7)) * 3.6;
        const g = new THREE.Group(), st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 7), MAT(0x2a4a3a)); st.position.y = h / 2; g.add(st);
        const col = i % 3 === 0 ? 0xff7ae0 : i % 3 === 1 ? 0x5affd0 : 0xb89aff, cp = new THREE.Mesh(new THREE.SphereGeometry(0.9 + (i % 3) * 0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), GLOW(col)); cp.position.y = h; cp.scale.y = 0.55; g.add(cp);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: col, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(5, 5, 1); sp.position.y = h; g.add(sp);
        g.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); levelGroup.add(g); }
    }
    builtFor = boxes;
  }

  /* the gun in hand */
  const guns: Record<string, THREE.Group> = { pistol: buildGun("pistol"), rifle: buildGun("rifle"), shotgun: buildGun("shotgun"), launcher: buildGun("launcher"), laser: buildGun("laser"), rail: buildGun("rail"), arc: buildGun("arc"), beam: buildGun("beam"), pulsar: buildGun("pulsar"), nova: buildGun("nova"), storm: buildGun("storm"), cryo: buildGun("cryo"), rpg: buildGun("rpg"), salvo: buildGun("salvo") };
  const hold = new THREE.Group(); hold.position.set(0.2, -0.2, -0.38); hold.scale.setScalar(0.72); cam.add(hold);
  const handM = MAT(0xc79a76, { roughness: 0.8 }), sleeve = MAT(0x2c3a30);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.14), handM); hand.position.set(0.0, -0.075, 0.02); hold.add(hand);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.5), sleeve); fore.position.set(0.06, -0.1, 0.32); fore.rotation.x = -0.12; hold.add(fore);
  for (const k of Object.keys(guns)) { guns[k].visible = false; hold.add(guns[k]); }
  const mflash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "#fff"); r.addColorStop(0.3, "#ffd070"); r.addColorStop(1, "rgba(255,120,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  mflash.visible = false; hold.add(mflash);
  /* gun glamour: a crossed flash plane, a forward streak and a shock ring at the muzzle, bright flares where a shot lands */
  const glowTex = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "#fff"); r.addColorStop(0.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const streakTex = canvasTex(128, 32, g => { const r = g.createLinearGradient(0, 0, 128, 0); r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.55, "rgba(255,255,255,.7)"); r.addColorStop(1, "#fff"); g.fillStyle = r; g.beginPath(); g.moveTo(0, 16); g.lineTo(128, 2); g.lineTo(128, 30); g.closePath(); g.fill(); });
  const mkBasic = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const mflash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), mkBasic(glowTex)); mflash2.visible = false; hold.add(mflash2);
  const mstreak = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), mkBasic(streakTex)); mstreak.visible = false; hold.add(mstreak);
  const mring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })); mring.visible = false; hold.add(mring);
  let ringT = 0, ringC = 0xffffff;
  const flares: { m: THREE.Mesh; life: number }[] = [];
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mkBasic(glowTex)); m.visible = false; scene.add(m); flares.push({ m, life: 0 }); }
  /* High only (plan 40 B): pooled point lights for blasts and kills, capped ground decals, light shafts under the lamps */
  const hiGrp = new THREE.Group(); hiGrp.visible = false; scene.add(hiGrp);
  const pLights: { l: THREE.PointLight; life: number; peak: number }[] = [];
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffa050, 0, 16, 2); l.visible = false; hiGrp.add(l); pLights.push({ l, life: 0, peak: 0 }); }
  const pulse = (x: number, y: number, z: number, col: number, peak: number) => { if (!high) return; const q = pLights.find(o => o.life <= 0) || pLights[0]; q.life = 0.35; q.peak = peak; q.l.color.setHex(col); q.l.position.set(x, Math.max(0.6, y), z); q.l.visible = true; };
  const NDEC = 40, decals: { m: THREE.Mesh; age: number }[] = []; let decI = 0;
  for (let i = 0; i < NDEC; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false; hiGrp.add(m); decals.push({ m, age: 99 }); }
  const decal = (x: number, z: number, col: number, size: number, op: number) => { if (!high) return; const d = decals[decI++ % NDEC]; d.age = 0; d.m.position.x = x; d.m.position.z = z; d.m.rotation.z = Math.random() * 6; d.m.scale.setScalar(size); (d.m.material as THREE.MeshBasicMaterial).color.setHex(col); d.m.userData.op = op; d.m.visible = true; };
  const shaftMat = new THREE.MeshBasicMaterial({ color: TH ? TH.sun : 0xffd9b0, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 4; i++) { const a2 = i / 4 * Math.PI * 2 + 0.4, c = new THREE.Mesh(new THREE.ConeGeometry(3.2, 12, 14, 1, true), shaftMat); c.position.set(Math.cos(a2) * 18, 6, Math.sin(a2) * 18); hiGrp.add(c); }
  /* High only (owner 2026-10-23: "most beautiful possible"): drifting dust and embers in the level's light, lit by the sun colour */
  const NMOTE = 420, moteGeo = new THREE.BufferGeometry(), motePos = new Float32Array(NMOTE * 3), moteSeed = new Float32Array(NMOTE);
  for (let i = 0; i < NMOTE; i++) { motePos[i * 3] = (Math.random() - 0.5) * ARENA * 2; motePos[i * 3 + 1] = Math.random() * 9; motePos[i * 3 + 2] = (Math.random() - 0.5) * ARENA * 2; moteSeed[i] = Math.random() * 6.28; }
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ color: TH ? TH.ring : 0xffc080, size: 0.14, map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; hiGrp.add(motes);
  const moteStep = (t: number, dt: number) => { for (let i = 0; i < NMOTE; i++) { const j = i * 3; motePos[j + 1] += dt * (0.25 + (moteSeed[i] % 1) * 0.35); motePos[j] += Math.sin(t * 0.4 + moteSeed[i]) * dt * 0.3; if (motePos[j + 1] > 9) motePos[j + 1] = 0; } (moteGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true; };
  hiGrp.visible = high;
  const flare = (x: number, y: number, z: number, col: number, size: number) => { const f = flares.find(q => q.life <= 0); if (!f) return; f.life = 0.16; f.m.position.set(x, y, z); f.m.userData.sz = size; (f.m.material as THREE.MeshBasicMaterial).color.setHex(col); f.m.visible = true; };

  /* effects pools */
  const tracers: { m: THREE.Mesh; life: number }[] = [];
  const trM = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), trM.clone()); const hm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), trM.clone()); (hm.material as THREE.MeshBasicMaterial).opacity = 0.28; m.add(hm); m.visible = false; scene.add(m); tracers.push({ m, life: 0 }); }
  const NP = high ? 160 : 70; type P = { m: THREE.Mesh; v: THREE.Vector3; life: number; g: number };
  const parts: P[] = []; const pgeo = new THREE.SphereGeometry(0.05, 5, 4);
  for (let i = 0; i < NP; i++) { const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: 0x88ff44, fog: false })); m.visible = false; scene.add(m); parts.push({ m, v: new THREE.Vector3(), life: 0, g: 9 }); }
  const burst = (x: number, y: number, z: number, n: number, col: number, spd: number) => { let k = 0; for (const p of parts) { if (p.life > 0) continue; if (k++ >= n) break; (p.m.material as THREE.MeshBasicMaterial).color.setHex(col); p.m.position.set(x, y, z); p.v.set((Math.random() - 0.5) * spd, Math.random() * spd * 0.8, (Math.random() - 0.5) * spd); p.life = 0.5 + Math.random() * 0.4; p.m.visible = true; p.m.scale.setScalar(0.6 + Math.random()); } };
  const arcs: { m: THREE.Mesh[]; life: number }[] = []; const arcMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 3; i++) { const segs: THREE.Mesh[] = []; for (let j = 0; j < 24; j++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), arcMat); m.visible = false; scene.add(m); segs.push(m); } arcs.push({ m: segs, life: 0 }); }
  const pkMeshes = new Map<number, THREE.Group>(); const pkGeo = new THREE.OctahedronGeometry(0.42);
  const rkPool: THREE.Object3D[] = []; const rkGeo = new THREE.SphereGeometry(0.16, 8, 6), rkMat = new THREE.MeshBasicMaterial({ color: 0x66ffb0, fog: false });
  let rkFrame = 0;
  const mkRocket = (rt: string): THREE.Object3D => {   // along +z (lookAt turns it to its velocity); the flame trails behind
    const g = new THREE.Group(); g.userData.rt = rt;
    if (rt === "plasma") { const b = new THREE.Mesh(rkGeo, rkMat); g.add(b); return g; }
    const L = rt === "rpg" ? 0.95 : 0.58, R = rt === "rpg" ? 0.085 : 0.05, body = MAT(rt === "rpg" ? 0x6b6a3a : 0xd9dde6, { metalness: 0.5, roughness: 0.4 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 10), body); tube.rotation.x = Math.PI / 2; g.add(tube);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(R, L * 0.32, 10), GLOW(rt === "rpg" ? 0xff6a2a : 0xffd24a)); nose.rotation.x = Math.PI / 2; nose.position.z = L / 2 + L * 0.16; g.add(nose);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.012, R * 2.2, L * 0.28), MAT(0x222228)); f.position.z = -L / 2 + L * 0.12; f.rotation.z = i * Math.PI / 2; g.add(f); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(R * 1.1, L * 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); flame.rotation.x = -Math.PI / 2; flame.position.z = -L / 2 - L * 0.42; g.add(flame); g.userData.flame = flame;
    const core = new THREE.Mesh(new THREE.ConeGeometry(R * 0.6, L * 0.55, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); core.rotation.x = -Math.PI / 2; core.position.z = -L / 2 - L * 0.25; g.add(core);
    return g;
  };
  const booms: { m: THREE.Mesh; life: number }[] = []; const bGeo = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; scene.add(m); booms.push({ m, life: 0 }); }
  const bl = new THREE.PointLight(0xffa050, 0, 22); scene.add(bl); let blT = 0;
  const acidM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), GLOW(0x9cff3a)); const acidPool: THREE.Mesh[] = [];

  const rigs = new Map<number, { rig: Rig; e: Enemy; fade: number }>();
  const msMarks: THREE.Group[] = []; let msBuilt: unknown = null;
  let crouch = 0; let gun = "pistol", flashI = 3.2, kick = 0, mfT = 0, flashT = 0, bob = 0, shake = 0, curShake = 0;
  /* per-gun firing effects: spark count and speed, flash size and light, camera kick and shake, ejected brass, rocket backblast */
  const FX: Record<string, { n: number; spd: number; fl: number; li: number; kick: number; shk: number; brass?: number; blast?: number }> = {
    pistol: { n: 6, spd: 5, fl: 1.4, li: 3, kick: 0.45, shk: 0.02, brass: 1 }, rifle: { n: 5, spd: 5, fl: 1.2, li: 3, kick: 0.25, shk: 0.02, brass: 1 }, laser: { n: 4, spd: 7, fl: 1.1, li: 3.4, kick: 0.1, shk: 0 },
    shotgun: { n: 26, spd: 9, fl: 3, li: 7, kick: 0.9, shk: 0.18, brass: 2 }, arc: { n: 14, spd: 8, fl: 1.8, li: 5, kick: 0.2, shk: 0.04 }, beam: { n: 4, spd: 6, fl: 1.3, li: 3.6, kick: 0.08, shk: 0 },
    pulsar: { n: 10, spd: 7, fl: 1.7, li: 4, kick: 0.3, shk: 0.04 }, storm: { n: 5, spd: 6, fl: 1.2, li: 3.2, kick: 0.1, shk: 0 }, cryo: { n: 8, spd: 4, fl: 1.2, li: 3, kick: 0.08, shk: 0 },
    nova: { n: 22, spd: 10, fl: 3.4, li: 8, kick: 0.85, shk: 0.2 }, rail: { n: 30, spd: 12, fl: 3.2, li: 9, kick: 1, shk: 0.3 }, launcher: { n: 14, spd: 6, fl: 2.4, li: 5, kick: 0.7, shk: 0.12, blast: 6 },
    rpg: { n: 30, spd: 9, fl: 3.8, li: 10, kick: 1, shk: 0.34, blast: 22 }, salvo: { n: 12, spd: 7, fl: 2.2, li: 6, kick: 0.4, shk: 0.07, blast: 8 },
  };
  const gunFx = (w: string) => {
    const f = FX[w]; if (!f) return; hold.updateWorldMatrix(true, true); const c = WCOL[w] || 0xffd080;
    const mz = hold.localToWorld(new THREE.Vector3(0, 0, GUN_MUZZLE[w] || -0.7)); burst(mz.x, mz.y, mz.z, high ? f.n : Math.ceil(f.n / 2), c, f.spd); burst(mz.x, mz.y, mz.z, Math.ceil(f.n / 3), 0xffffff, f.spd * 0.6);
    if (f.brass) { const ej = hold.localToWorld(new THREE.Vector3(0.05, 0.03, -0.1)); burst(ej.x, ej.y, ej.z, f.brass, 0xe8c060, 2.4); }
    if (f.blast) { const bk = hold.localToWorld(new THREE.Vector3(0, 0, 0.36)); burst(bk.x, bk.y, bk.z, f.blast, 0xd6d2c8, 4.5); burst(bk.x, bk.y, bk.z, Math.ceil(f.blast / 2), 0xff9a4a, 6); }
    ringT = 0.14; ringC = c; mflash2.scale.setScalar(f.fl * 0.8);
    flashI = f.li; mflash.scale.setScalar(f.fl); kick = Math.min(1, kick + f.kick); curShake = Math.min(1, curShake + f.shk);
  };
  const api: Render = {
    canvas, shake: 0,
    events(ev) {
      for (const e of ev) {
        if (e.k === "strike") { curShake = Math.max(curShake, 3); flashT = 0.5; flash.color.setHex(0xfff0c0); flash.intensity = 40; flash.position.copy(cam.position); }
        else if (e.k === "dig") burst(e.x as number, 0.8, e.z as number, high ? 14 : 6, 0x9adfff, 4);
        else if (e.k === "shot") { mfT = 0.05; flashT = 0.06; gunFx(e.w as string); { const c = WCOL[e.w as string] || 0xffd080; flash.color.setHex(c); (mflash.material as THREE.MeshBasicMaterial).color.setHex(c); } const t = e.w === "arc" || e.w === "rpg" || e.w === "salvo" || e.w === "launcher" ? null : tracers.find(q => q.life <= 0); if (t) { t.life = e.w === "rail" ? 0.32 : 0.11; t.m.visible = true; { const c = WCOL[e.w as string] || 0xffe9a0; (t.m.material as THREE.MeshBasicMaterial).color.setHex(0xffffff); ((t.m.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(c); const th = e.w === "nova" ? 3.2 : e.w === "rail" ? 2.2 : e.w === "beam" || e.w === "cryo" ? 1.4 : e.w === "storm" || e.w === "laser" ? 1.1 : 1.6; t.m.userData.th = th; } const from = new THREE.Vector3(0.2, -0.17, -0.7).applyMatrix4(cam.matrixWorld), dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), to = from.clone().addScaledVector(dir, e.w === "rail" ? 90 : 36); const mid = from.clone().add(to).multiplyScalar(0.5); t.m.position.copy(mid); t.m.scale.set(t.m.userData.th || 1, from.distanceTo(to), t.m.userData.th || 1); t.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); } }
        else if (e.k === "boom") { pulse(e.x as number, e.y as number, e.z as number, 0xffa050, 14 * Math.min(2, ((e.n as number) || 1))); decal(e.x as number, e.z as number, 0x050505, 3.2 * Math.min(2, ((e.n as number) || 1)), 0.7); const b = booms.find(q => q.life <= 0); if (b) { b.life = 0.45; (b as any).size = ((e.n as number) || 1) * 1.0; b.m.visible = true; b.m.position.set(e.x as number, e.y as number, e.z as number); } burst(e.x as number, (e.y as number), e.z as number, Math.round((high ? 50 : 24) * Math.min(2.4, ((e.n as number) || 1))), 0xffb04a, 9 * Math.min(1.6, ((e.n as number) || 1))); if (((e.n as number) || 1) >= 2) burst(e.x as number, (e.y as number) + 0.6, e.z as number, high ? 40 : 18, 0x444444, 6); bl.position.set(e.x as number, 2, e.z as number); blT = 0.25 * Math.min(2, ((e.n as number) || 1)); curShake = Math.min(1, curShake + 0.5 * Math.min(1.8, ((e.n as number) || 1))); }
        else if (e.k === "hit") { if (e.w) flare(e.x as number, e.y as number, e.z as number, WCOL[e.w as string] || 0xffffff, 0.9); burst(e.x as number, e.y as number, e.z as number, 5, 0x9cff3a, 3); if (e.w) burst(e.x as number, e.y as number, e.z as number, high ? 7 : 3, WCOL[e.w as string] || 0xffffff, 6); }
        else if (e.k === "kill" || e.k === "head") { pulse(e.x as number, 1, e.z as number, e.k === "head" ? 0xffd34a : 0x9cff3a, 6); decal(e.x as number, e.z as number, 0x2a4a10, 1.8, 0.55); burst(e.x as number, 0.9, e.z as number, high ? 26 : 12, e.k === "head" ? 0xffd34a : 0x7cd62a, 5); }
        else if (e.k === "hurt") curShake = Math.min(1, curShake + 0.35);
        else if (e.k === "arc" && e.p) { const a = arcs.find(q => q.life <= 0); if (a) { a.life = 0.14; const pts: THREE.Vector3[] = []; const from = new THREE.Vector3(0.2, -0.17, -0.7).applyMatrix4(cam.matrixWorld); pts.push(from); for (let i = 3; i < e.p.length; i += 3) pts.push(new THREE.Vector3(e.p[i], e.p[i + 1], e.p[i + 2])); let k = 0; for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1], n = 6; let prev = A.clone(); for (let j = 1; j <= n && k < a.m.length; j++) { const q = A.clone().lerp(B, j / n); if (j < n) q.add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7)); const d = q.clone().sub(prev), L = d.length(); const m = a.m[k++]; m.visible = true; m.position.copy(prev).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); prev = q; } } for (; k < a.m.length; k++) a.m[k].visible = false; } kick = Math.min(1, kick + 0.15); mfT = 0.04; flashT = 0.05; }
      }
    },
    draw(s, dt) {
      if (s.ms && msBuilt !== s.ms) {   // mission markers: station rings with a beam, ore nodes, uplink terminals
        msBuilt = s.ms; for (const g of msMarks) scene.remove(g); msMarks.length = 0;
        for (const it of s.ms.items) { const g = new THREE.Group(), mine = s.ms.type === "mine", col = mine ? 0x6ab0ff : s.ms.type === "strike" ? 0xff5a3a : s.ms.type === "task" ? 0xffd060 : 0x5affc8;
          if (mine) { for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + (i % 2) * 0.3, 0), GLOW(col)); c.position.set(Math.cos(i * 1.6) * 0.6, 0.6 + (i % 2) * 0.3, Math.sin(i * 1.6) * 0.6); c.rotation.set(i, i * 2, 0); g.add(c); } const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), MAT(0x2a3a4c)); rk.position.y = 0.5; g.add(rk); }
          else { const ring = new THREE.Mesh(new THREE.TorusGeometry(it.r, 0.1, 8, 40), GLOW(col)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring); const disc = new THREE.Mesh(new THREE.CircleGeometry(it.r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 14, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })); beam.position.y = 7; beam.name = "beam"; g.add(beam);
            const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 8), MAT(0x2a3038, { metalness: 0.8 })); pil.position.y = 0.7; g.add(pil);
            if (s.ms.type === "task") { const st = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 1.8), MAT(0x9aaac0, { metalness: 0.6, roughness: 0.35 })); st.position.y = 1.6; st.name = "built"; st.visible = false; g.add(st); const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), GLOW(0xffd060)); top.position.y = 3.5; top.name = "built"; top.visible = false; g.add(top); } }
          g.position.set(it.x, 0, it.z); (g as any).userData = { it, col }; scene.add(g); msMarks.push(g); }
      }
      for (const g of msMarks) { const u = (g as any).userData, it = u.it; g.visible = !(s.ms && s.ms.type === "mine" && it.done) && !(s.ms && s.ms.phase === 1 && !it.done); g.children.forEach(c => { if (c.name === "built") c.visible = !!it.done; }); const beam = g.getObjectByName("beam") as THREE.Mesh | undefined; if (beam) { const m = beam.material as THREE.MeshBasicMaterial; m.color.setHex(it.done ? 0x5aff7a : u.col); m.opacity = 0.18 + 0.4 * Math.max(it.p, it.done ? 1 : 0) + 0.05 * Math.sin(performance.now() / 160); } g.rotation.y += dt * 0.4; }
      if (builtFor !== s.boxes) buildLevel(s.boxes, s.hz); for (const q of hzMesh) { const on = s.hzClock % q.h.per < q.h.on; (q.m.material as THREE.MeshBasicMaterial).opacity = on ? 0.55 + 0.2 * Math.sin(performance.now() / 120) : 0.12; }
      const p = s.p; crouch += ((p.slide > 0 ? 0.7 : 0) - crouch) * Math.min(1, dt * 12); cam.position.set(p.x, EYE + p.y - crouch + Math.sin(bob) * 0.025 * (p.sprint ? 1.6 : 1), p.z); cam.rotation.set(p.pitch + curShake * (Math.random() - 0.5) * 0.04, p.yaw + curShake * (Math.random() - 0.5) * 0.04, 0);
      cam.updateMatrixWorld(true);
      if (guns[s.weapon] && gun !== s.weapon) { guns[gun].visible = false; gun = s.weapon; guns[gun].visible = true; } guns[gun].visible = true;
      kick = Math.max(0, kick - dt * 7); curShake = Math.max(0, curShake - dt * 2.2);
      const moving = s.frozen ? 0 : 1; bob += dt * (p.sprint ? 12 : 8) * moving * (p.y <= 0.01 ? 1 : 0);
      const rl = s.reload > 0 ? Math.sin(Math.min(1, (1 - s.reload / 1.6)) * Math.PI) : 0;
      hold.position.set(0.2 + Math.sin(bob * 0.5) * 0.008, -0.2 + Math.abs(Math.sin(bob * 0.5)) * 0.01 - rl * 0.16 - kick * 0.01, -0.38 + kick * 0.09);
      hold.rotation.set(kick * 0.14 + rl * 0.5, 0, rl * 0.3);
      { const on = mfT > 0, mzp = (GUN_MUZZLE[gun] || -0.8) - 0.04, wc = WCOL[gun] || 0xffd080;
        mflash2.visible = on; mstreak.visible = on; if (on) { mflash2.position.set(0, 0, mzp); mflash2.rotation.set(0, 0, Math.random() * 6); mflash2.lookAt(cam.position); (mflash2.material as THREE.MeshBasicMaterial).color.setHex(wc); mstreak.position.set(0, 0, mzp - 0.42 * (0.6 + FX[gun]?.fl * 0.1 || 0.7)); mstreak.rotation.set(0, Math.PI / 2, 0); (mstreak.material as THREE.MeshBasicMaterial).color.setHex(wc); mstreak.scale.set(0.6 + (FX[gun]?.fl || 1) * 0.35, 1, 1); }
        if (ringT > 0) { ringT -= dt; mring.visible = high && ringT > 0; const k = 1 - Math.max(0, ringT) / 0.14; mring.position.set(0, 0, mzp - 0.05); mring.scale.setScalar(0.5 + k * 4.5); (mring.material as THREE.MeshBasicMaterial).color.setHex(ringC); (mring.material as THREE.MeshBasicMaterial).opacity = 1 - k; } else mring.visible = false;
        for (const f of flares) if (f.life > 0) { f.life -= dt; const k = Math.max(0, f.life) / 0.16, sz = (f.m.userData.sz || 0.6) * (1.3 - k * 0.5); f.m.scale.setScalar(sz); (f.m.material as THREE.MeshBasicMaterial).opacity = k; f.m.lookAt(cam.position); if (f.life <= 0) f.m.visible = false; } }
      if (high) { try { moteStep(performance.now() / 1000, dt); } catch (e) {} for (const q of pLights) if (q.life > 0) { q.life -= dt; q.l.intensity = q.peak * Math.max(0, q.life) / 0.35; if (q.life <= 0) q.l.visible = false; }
        for (const d of decals) if (d.age < 60) { d.age += dt; const o = (d.m.userData.op || 0.5) * Math.max(0, 1 - d.age / 45); (d.m.material as THREE.MeshBasicMaterial).opacity = o; if (d.age >= 45) d.m.visible = false; } }
      mflash.visible = mfT > 0; if (mfT > 0) { mfT -= dt; mflash.position.set(0.0, 0.0, (GUN_MUZZLE[gun] || -0.8) - 0.04); mflash.rotation.z = Math.random() * 6; mflash.lookAt(cam.position); }
      flash.intensity = flashT > 0 ? flashI : 0; if (flashT > 0) { flashT -= dt; flash.position.copy(cam.position).add(new THREE.Vector3(0, 0, -1.2).applyQuaternion(cam.quaternion)); }
      for (const t of tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; }
      for (const q of parts) if (q.life > 0) { q.life -= dt; q.v.y -= q.g * dt; q.m.position.addScaledVector(q.v, dt); if (q.m.position.y < 0.03) { q.m.position.y = 0.03; q.v.set(0, 0, 0); } if (q.life <= 0) q.m.visible = false; }
      // aliens
      const seen = new Set<number>();
      for (const e of s.enemies) {
        seen.add(e.id); let r = rigs.get(e.id);
        if (!r) { const rig = buildAlien(e.kind, TINT); rig.g.scale.setScalar(ALIEN_SCALE[e.kind]); (rig.g as any).userData.born = performance.now(); scene.add(rig.g); r = { rig, e, fade: 0 }; rigs.set(e.id, r); }
        r.e = e; const g = r.rig.g; g.position.set(e.x, 0, e.z); g.rotation.y = e.yaw; { const age = (performance.now() - ((g as any).userData.born || 0)) / 700; if (age < 1 && e.dead === 0) { g.position.y = -(1 - age) * 1.6 * ALIEN_SCALE[e.kind]; } }
        const tt = e.t * (behOf(e.kind) === "skitter" ? 16 : behOf(e.kind) === "mantis" ? 8 : behOf(e.kind) === "charger" ? ((e.rush || 0) > 0 ? 26 : 6) : 6);
        r.rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(tt + i * 1.9) * 0.55; }); { const tk = (g as any).userData.tick; if (tk) tk(e.t); }
        r.rig.arms.forEach((a, i) => { if (behOf(e.kind) === "skyeye") { a.rotation.x = Math.sin(e.t * 2.5 + i) * 0.35; a.rotation.z = Math.cos(e.t * 2 + i * 2) * 0.3; } else a.rotation.x = -0.5 + Math.sin(e.t * 3 + i * 3) * 0.2 - (e.cd < 0.4 ? 0.9 : 0); });
        r.rig.body.position.y = behOf(e.kind) === "skyeye" ? Math.sin(e.t * 1.6) * 0.35 : Math.abs(Math.sin(tt * 0.5)) * 0.05 + (e.leap > 0 ? 0.7 : 0) - ((e.tele || 0) > 0 ? 0.25 : 0);
        if (behOf(e.kind) === "charger") r.rig.body.rotation.x = (e.tele || 0) > 0 ? 0.18 : 0;
        {   // life in the body (owner 2026-10-29: "make the aliens move"): breathing, a sway with each step, a lunge as the attack winds up, a flinch when hit, a shudder when dying
          const b = r.rig.body, st = Math.sin(tt * 0.5), big = GRANDC.has(e.kind), wind = Math.max(0, 1 - Math.max(0, e.cd) / 0.45) * (e.cd < 0.45 ? 1 : 0);
          b.scale.y = 1 + 0.028 * Math.sin(e.t * (big ? 1.3 : 2.2)); b.scale.x = 1 - 0.012 * Math.sin(e.t * (big ? 1.3 : 2.2));
          b.rotation.z = Math.sin(tt * 0.5 + 1) * (big ? 0.025 : 0.07);
          if (behOf(e.kind) !== "charger") b.rotation.x = st * 0.06 + wind * 0.32 + (e.flash > 0 ? -0.22 : 0);
          b.position.z = -wind * 0.35 + (e.flash > 0 ? 0.12 : 0);
          b.rotation.y = Math.sin(e.t * 0.9 + e.id) * (big ? 0.06 : 0.12);
          if (e.dead > 0) { const k = 1 - e.dead / 0.9; b.rotation.x = k * 0.9; b.rotation.z = Math.sin(k * 40) * 0.12 * (1 - k); }
          for (const m of r.rig.mats) (m as any).emissiveIntensity = 0.45 + (e.tele || 0 > 0 ? 0.9 : 0) + wind * 0.8;
        }
        for (const m of r.rig.mats) m.emissive.setHex(e.flash > 0 ? 0xff5030 : (e.tele || 0) > 0 ? 0x992010 : 0x181c0c);
        if (e.dead > 0) { const k = 1 - e.dead / 0.9; g.rotation.z = k * 1.5; g.position.y = -k * 0.25; g.scale.setScalar(ALIEN_SCALE[e.kind] * Math.max(0.01, 1 - Math.max(0, k - 0.6) * 2.5)); }
      }
      for (const [id, r] of rigs) if (!seen.has(id)) { scene.remove(r.rig.g); r.rig.g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); } }); rigs.delete(id); }
      rkFrame++;
      for (let i = 0; i < Math.max(rkPool.length, s.rk.length); i++) {
        const a = s.rk[i]; let m = rkPool[i];
        if (!a) { if (m) m.visible = false; continue; }
        const rt = a.rt || "plasma"; if (!m || m.userData.rt !== rt) { if (m) scene.remove(m); m = mkRocket(rt); scene.add(m); rkPool[i] = m; }
        m.visible = true; m.position.set(a.x, a.y, a.z);
        if (rt !== "plasma") { m.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz); const fl = m.userData.flame as THREE.Mesh; if (fl) fl.scale.set(1, 0.8 + Math.random() * 0.7, 1); if (rt === "rpg" || rkFrame % 2 === 0) burst(a.x - a.vx * 0.025, a.y - a.vy * 0.025, a.z - a.vz * 0.025, 1, rt === "rpg" ? 0xc8c4bc : 0xffb060, 1.2); }
      }
      for (const b of booms) if (b.life > 0) { b.life -= dt; const k = 1 - b.life / 0.45; b.m.scale.setScalar((0.5 + k * 4.2) * ((b as any).size || 1)); (b.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k)); if (b.life <= 0) b.m.visible = false; }
      if (blT > 0) { blT -= dt; bl.intensity = Math.max(0, blT / 0.25) * 9; } else bl.intensity = 0;
      for (const a of arcs) if (a.life > 0) { a.life -= dt; if (a.life <= 0) a.m.forEach(m => { m.visible = false; }); }
      const live = new Set<number>(); const now = performance.now() / 1000;
      for (const k of s.pk) { live.add(k.id); let g = pkMeshes.get(k.id); if (!g) { g = new THREE.Group(); const col = k.w === "ammo" ? 0xffd34a : WCOL[k.w as string] || 0x58e8ff; const core = new THREE.Mesh(pkGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.4, roughness: 0.3 })); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.55; const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); beam.position.y = 2.6; g.add(core, ring, beam); scene.add(g); pkMeshes.set(k.id, g); }
        g.position.set(k.x, 1.0 + Math.sin(now * 2.5 + k.id) * 0.12, k.z); g.children[0].rotation.y = now * 1.6; g.children[0].rotation.x = now * 0.7; }
      for (const [id, g] of pkMeshes) if (!live.has(id)) { scene.remove(g); pkMeshes.delete(id); }
      // acid blobs
      while (acidPool.length < s.acid.length) { const m = acidM.clone(); m.material = (acidM.material as THREE.MeshStandardMaterial).clone(); scene.add(m); acidPool.push(m); }
      acidPool.forEach((m, i) => { const a = s.acid[i]; m.visible = !!a; if (a) { m.position.set(a.x, a.y, a.z); const k = a.big || 1; m.scale.setScalar(k); const mm = m.material as THREE.MeshStandardMaterial; const c = a.col || 0x9cff3a; if (mm.color.getHex() !== c) { mm.color.setHex(c); mm.emissive.setHex(c); } } });
      ship.rotation.y += dt * 0.02; ring.rotation.z += dt * 0.3; (core.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(performance.now() / 500) * 0.5;
      // co-op teammates (plan 39 P5): a glowing pilot per room member, eased towards the last reported position
      for (const m of mateList) { let g = mateMeshes.get(m.id); if (!g) { g = new THREE.Group(); const col = parseInt(String(m.glow || "#7fe8ff").replace("#", ""), 16) || 0x7fe8ff; const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), MAT(0x2a3340, { metalness: 0.6, roughness: 0.35 })); body.position.y = 0.95; const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), GLOW(col)); visor.position.set(0, 1.55, -0.22); visor.scale.set(1, 0.55, 0.6); const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 24), GLOW(col)); halo.rotation.x = Math.PI / 2; halo.position.y = 0.05; const pin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), GLOW(col)); pin.rotation.x = Math.PI; pin.position.y = 2.7; g.add(body, visor, halo, pin); g.position.set(m.x, 0, m.z); scene.add(g); mateMeshes.set(m.id, g); }
        g.position.x += (m.x - g.position.x) * Math.min(1, dt * 8); g.position.z += (m.z - g.position.z) * Math.min(1, dt * 8); g.rotation.y = m.yaw; g.children[3].position.y = 2.7 + Math.sin(now * 3) * 0.12; }
      for (const [id, g] of mateMeshes) if (!mateList.some(m => m.id === id)) { scene.remove(g); mateMeshes.delete(id); }
      api.shake = curShake;
      if (high && hifx && hifx.ok()) hifx.render(dt); else renderer.render(scene, cam);
    },
    resize() {
      const w = host.clientWidth || 800, h = host.clientHeight || 450; renderer.setPixelRatio(high ? Math.min(2, window.devicePixelRatio || 1) : 1); renderer.setSize(w, h, false); if (hifx) hifx.setSize(w, h, high ? Math.min(2, window.devicePixelRatio || 1) : 1); canvas.style.width = "100%"; canvas.style.height = "100%";
      cam.aspect = w / h; cam.updateProjectionMatrix();
    },
    setHigh(h) { high = h; if (h && !hifx) hifx = createHiFx(renderer, scene, () => cam, { bloom: 0.6, radius: 0.55, threshold: 0.8, kit: KIT }); renderer.shadowMap.enabled = h; sun.castShadow = h; envOn(h); surfOn(h); hiGrp.visible = h; api.resize(); scene.traverse(o => { const m = (o as THREE.Mesh).material as any; if (m && m.needsUpdate !== undefined) m.needsUpdate = true; }); },
    mates(list) { mateList = list; },
    info: () => ({ mates: mateMeshes.size, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, high, rigs: rigs.size }),
    dispose() { renderer.dispose(); scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mt: any = m.material; (Array.isArray(mt) ? mt : [mt]).forEach(x => x && x.dispose && x.dispose()); } }); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); },
  };
  api.resize(); guns[gun].visible = true;
  return api;
}
