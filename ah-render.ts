/* Alien Hunt renderer (plan 38): three.js scene, first-person camera, the gun in hand, procedural insect aliens, tracers and goo.
   High = shadows, device pixel ratio up to 2, more particles; Lite = no shadows, pixel ratio 1, fewer lights. Everything is drawn from code, nothing is downloaded. */
import * as THREE from "three";
import { LEVELS } from "./ah-levels";
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
const CHIT = (c: number, o: any = {}) => new THREE.MeshPhysicalMaterial({ color: c, map: chitinTex, roughness: 0.32, metalness: 0.12, clearcoat: 0.85, clearcoatRoughness: 0.22, ...o });
const CARAPACE = CHIT(0x5d7040), CARAPACE2 = CHIT(0x9a6a36), SPIT = CHIT(0x6f8a3c, { roughness: 0.4 });
const GLOW = (c: number) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.3 });
type Rig = { g: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; mats: THREE.MeshStandardMaterial[]; body: THREE.Object3D };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, m: THREE.Material) { const d = b.clone().sub(a), L = d.length(); const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 7), m); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return c; }
const cone = (r: number, h: number, m: THREE.Material, p: THREE.Vector3, rot: [number, number, number] = [0, 0, 0]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), m); c.position.copy(p); c.rotation.set(rot[0], rot[1], rot[2]); return c; };
/** an insect leg: the hip is at the origin (put it at the body height), the thigh climbs up and out to a spiked knee, the shin drops to a clawed foot on the floor (H below the hip) */
function leg(len: number, th: number, m: THREE.Material, H = 0.6) {
  const g = new THREE.Group(), knee = V(0.5 * len, 0.45 * len, 0), foot = V(0.95 * len, -H, 0);
  g.add(limb(V(0, 0, 0), knee, th, th * 0.8, m)); const kn = new THREE.Mesh(new THREE.SphereGeometry(th * 1.35, 8, 6), m); kn.position.copy(knee); g.add(kn);
  g.add(cone(th * 0.9, th * 4, m, knee.clone().add(V(0, th * 2.2, 0)))); g.add(limb(knee, foot, th * 0.8, th * 0.3, m)); g.add(cone(th * 0.5, th * 3, m, foot.clone().add(V(0, -th * 1.2, 0)), [Math.PI, 0, 0]));
  // little spines down the shin
  for (let i = 1; i < 4; i++) { const p = knee.clone().lerp(foot, i / 4.2); g.add(cone(th * 0.28, th * 1.6, m, p.add(V(th * 0.9, 0, 0)), [0, 0, -1.2])); }
  return g;
}
const antenna = (m: THREE.Material, base: THREE.Vector3, sd: number, len: number) => { const g = new THREE.Group(); let p = base.clone(), dir = V(0.25 * sd, 0.6, -0.5).normalize(); for (let i = 0; i < 4; i++) { const q = p.clone().addScaledVector(dir, len / 4); g.add(limb(p, q, 0.022 - i * 0.004, 0.018 - i * 0.004, m)); p = q; dir = dir.clone().add(V(0.15 * sd, -0.25, 0.05)).normalize(); } return g; };
const haloTex = (() => canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, 1))();
const eyes = (m: THREE.Material, y: number, z: number, dx: number, r: number) => { const g = new THREE.Group(); for (const x of [-dx, dx]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: (m as THREE.MeshStandardMaterial).color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(r * 7); sp.position.set(x, y, z - r * 0.5); g.add(sp); } for (const x of [-dx, dx]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); e.position.set(x, y, z); e.scale.set(0.8, 1.1, 0.8); g.add(e); } return g; };
const mandibles = (m: THREE.Material, y: number, z: number, len: number, gap: number) => { const g = new THREE.Group(); for (const sd of [-1, 1]) { g.add(limb(V(gap * sd, y, z), V(gap * 0.3 * sd, y - len * 0.2, z - len), len * 0.12, len * 0.03, m)); g.add(cone(len * 0.07, len * 0.4, m, V(gap * 0.3 * sd, y - len * 0.22, z - len * 1.15), [-Math.PI / 2, 0, 0])); } return g; };
function buildAlien(kind: AlienKind, tint = 0): Rig {
  const g = new THREE.Group(), legs: THREE.Object3D[] = [], arms: THREE.Object3D[] = [], mats: THREE.MeshStandardMaterial[] = [];
  const mk = (base: THREE.MeshStandardMaterial) => { const m = base.clone(); mats.push(m); return m; };
  const body = new THREE.Group(); g.add(body);
  if (kind === "skitter") {   // a roach-bug: flat glossy shell, long whip antennae, six fast spiky legs
    const m = mk(CHIT(0xa5622a, { roughness: 0.25, clearcoat: 1 })), m2 = mk(CHIT(0x5a3418));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), m); shell.scale.set(1.05, 0.5, 1.5); shell.position.set(0, 0.42, 0.1); body.add(shell);
    for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI), m2); w.scale.set(0.5, 0.4, 1.4); w.rotation.z = sd * 1.2; w.position.set(0.0, 0.62, 0.1); }   // (wing cases are implied by the seam below)
    body.add(limb(V(0, 0.66, -0.55), V(0, 0.62, 0.85), 0.015, 0.015, m2));   // the seam down the back
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m2); head.scale.set(1, 0.8, 1.1); head.position.set(0, 0.4, -0.68); body.add(head);
    body.add(eyes(GLOW(0xff3a1a), 0.48, -0.78, 0.1, 0.055)); body.add(mandibles(m2, 0.32, -0.8, 0.22, 0.07));
    for (const sd of [-1, 1]) body.add(antenna(m2, V(0.06 * sd, 0.5, -0.78), sd, 1.2));
    for (let i = 0; i < 6; i++) { const l = leg(0.34, 0.032, m2, 0.42); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 0.42, -0.3 + Math.floor(i / 2) * 0.35); l.rotation.y = (Math.floor(i / 2) - 1) * 0.35 * sd; g.add(l); legs.push(l); }
  } else if (kind === "mantis") {   // the warrior bug: tall armoured thorax, wedge head with mandibles, two saw-edged forelimbs raised, four stalking legs
    const m = mk(CHIT(0x7a7448)), m2 = mk(CHIT(0xa07a42)), dk = mk(CHIT(0x3a3822));
    const abd = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), m2); abd.scale.set(0.8, 0.75, 1.5); abd.position.set(0, 1.2, 0.95); abd.rotation.x = -0.25; body.add(abd);
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.42 - i * 0.03, 0.045, 6, 14), dk); r.position.set(0, 1.2 + i * 0.03, 0.55 + i * 0.3); r.rotation.y = Math.PI / 2; r.scale.set(1, 1, 1.1); body.add(r); }
    const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 12), m); thorax.position.set(0, 1.45, -0.05); thorax.rotation.x = -0.55; body.add(thorax);
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dk); plate.scale.set(1, 0.7, 1.4); plate.position.set(0, 1.62, 0.0); plate.rotation.x = -0.3; body.add(plate);
    for (let i = 0; i < 5; i++) body.add(cone(0.05, 0.28, dk, V(0, 1.82 - i * 0.04, 0.2 - i * 0.2 + 0.1), [-0.5, 0, 0]));   // spines along the back
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), m); head.rotation.set(-Math.PI / 2 - 0.2, Math.PI / 4, 0); head.position.set(0, 1.95, -0.62); body.add(head);
    body.add(eyes(GLOW(0xff6a1a), 2.04, -0.5, 0.2, 0.09)); body.add(mandibles(dk, 1.78, -0.9, 0.5, 0.14));
    for (const sd of [-1, 1]) body.add(antenna(dk, V(0.1 * sd, 2.1, -0.55), sd, 0.9));
    for (const sd of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(0.3 * sd, 1.72, -0.35);
      arm.add(limb(V(0, 0, 0), V(0.18 * sd, 0.18, -0.55), 0.09, 0.07, m)); const el = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), m); el.position.set(0.18 * sd, 0.18, -0.55); arm.add(el);
      arm.add(limb(V(0.18 * sd, 0.18, -0.55), V(0.12 * sd, -0.5, -0.95), 0.07, 0.025, dk));
      for (let i = 0; i < 6; i++) { const t = i / 6; arm.add(cone(0.04, 0.16, dk, V((0.18 - 0.06 * t) * sd + 0.06 * sd, 0.18 - 0.68 * t, -0.55 - 0.4 * t), [0, 0, sd * 1.4])); }   // the saw edge
      body.add(arm); arms.push(arm);
    }
    for (let i = 0; i < 4; i++) { const l = leg(0.85, 0.06, i % 2 ? m : m2, 1.18); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 1.18, 0.35 + Math.floor(i / 2) * 0.55); l.rotation.y = (Math.floor(i / 2) - 0.5) * 0.5 * sd; g.add(l); legs.push(l); }
  } else if (kind === "spitter") {   // the bloated plasma bug: a translucent glowing abdomen on stilt legs, a tube mouth
    const m = mk(SPIT), m2 = mk(CHIT(0x6a5630));
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12), new THREE.MeshPhysicalMaterial({ color: 0x9fe84a, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, emissive: 0x48a020, emissiveIntensity: 0.6 })); sac.scale.set(1, 0.95, 1.2); sac.position.set(0, 1.25, 0.45); body.add(sac);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), GLOW(0xbaff3a)); core.position.set(0, 1.25, 0.5); body.add(core);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; body.add(limb(V(0, 1.25, 0.5), V(Math.cos(a) * 0.62, 1.25 + Math.sin(a) * 0.55, 0.5 + Math.sin(a * 2) * 0.3), 0.025, 0.012, GLOW(0x6aff2a))); }   // veins
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), m2); thorax.scale.set(1, 0.9, 1.1); thorax.position.set(0, 1.4, -0.45); body.add(thorax);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), m2); head.position.set(0, 1.5, -0.8); body.add(head);
    body.add(limb(V(0, 1.45, -0.95), V(0, 1.4, -1.4), 0.1, 0.06, m2)); body.add(cone(0.1, 0.18, GLOW(0xb6ff3a), V(0, 1.4, -1.46), [-Math.PI / 2, 0, 0]));
    body.add(eyes(GLOW(0xb6ff3a), 1.6, -0.95, 0.13, 0.06));
    for (let i = 0; i < 4; i++) { const l = leg(0.8, 0.055, m2, 1.1); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 1.1, -0.25 + Math.floor(i / 2) * 0.6); l.rotation.y = (Math.floor(i / 2) - 0.5) * 0.5 * sd; g.add(l); legs.push(l); }
  } else if (kind === "flarecaster") {
    const m = mk(CARAPACE2), m2 = mk(CARAPACE);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 10), m2); robe.position.y = 0.85; body.add(robe);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), m); chest.position.y = 1.55; chest.scale.set(1, 0.9, 0.9); body.add(chest);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), GLOW(0xff7a2a)); core.position.set(0, 1.55, -0.28); body.add(core);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), m); head.position.set(0, 2.05, -0.05); head.scale.set(0.9, 1.2, 1); body.add(head);
    for (const x of [-0.14, 0, 0.14]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), GLOW(0xff9a3a)); e.position.set(x, 2.1, -0.27); body.add(e); }
    for (const sd of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 6), m2); horn.position.set(0.16 * sd, 2.4, 0); horn.rotation.z = -sd * 0.4; body.add(horn);
      const arm = new THREE.Group(); arm.position.set(0.42 * sd, 1.75, -0.05); const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.85, 6), m); up.position.y = 0.4; up.rotation.z = -sd * 0.5; arm.add(up);
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), GLOW(0xffb040)); fire.position.set(-sd * 0.2, 0.85, 0); arm.add(fire); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 2; i++) { const l = leg(0.8, 0.07, m); l.position.set(i ? 0.2 : -0.2, 0.85, 0.1); l.rotation.z = 0; g.add(l); legs.push(l); }
  } else if (kind === "charger") {
    const m = mk(CHIT(0x55603e)), m2 = mk(CHIT(0xa88a52, { roughness: 0.28 }));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m2); shell.scale.set(1.15, 0.95, 1.5); shell.position.y = 0.55; body.add(shell);
    for (let i = 0; i < 4; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.7 - i * 0.12, 0.09, 0.28), m); pl.position.set(0, 1.0 - i * 0.07 + 0.05, -0.55 + i * 0.5); pl.rotation.x = 0.12; body.add(pl); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), m); head.position.set(0, 0.62, -1.25); body.add(head);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.85, 8), m2); horn.rotation.x = -Math.PI / 2 + 0.25; horn.position.set(0, 0.7, -1.8); body.add(horn);
    for (const x of [-0.2, 0.2]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), GLOW(0xff3a2a)); e.position.set(x, 0.78, -1.58); body.add(e); }
    const weak = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), GLOW(0xff8a2a)); weak.position.set(0, 0.75, 1.42); weak.rotation.y = Math.PI; body.add(weak);   // the exposed rear weak spot
    for (let i = 0; i < 6; i++) { const l = leg(0.7, 0.08, m, 0.62); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.55 * sd, 0.62, -0.8 + Math.floor(i / 2) * 0.8); l.rotation.y = (Math.floor(i / 2) - 1) * 0.3 * sd; g.add(l); legs.push(l); }
  } else if (kind === "skyeye") {
    const m = mk(SPIT);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.25 })); eye.position.y = 2.6; body.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), GLOW(0xb06aff)); iris.position.set(0, 2.6, -0.52); body.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x08040f })); pupil.position.set(0, 2.6, -0.82); body.add(pupil);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.07, 6, 18), m); lid.position.set(0, 2.6, -0.1); lid.rotation.y = Math.PI / 2; body.add(lid);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * 0.35, 2.2, Math.sin(a) * 0.35); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.015, 1.1 + (i % 3) * 0.25, 5), m); c.position.y = -0.55; t.add(c); body.add(t); arms.push(t); }
  } else if (kind === "scarab") {   // a small domed beetle: the swarm race's fodder
    const m = mk(CHIT(0x3f8a2c, { roughness: 0.2, clearcoat: 1 })), m2 = mk(CHIT(0x1c3a14));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); shell.scale.set(1, 0.85, 1.3); shell.position.set(0, 0.34, 0.05); body.add(shell);
    body.add(limb(V(0, 0.72, -0.5), V(0, 0.7, 0.62), 0.014, 0.014, m2));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m2); head.position.set(0, 0.3, -0.62); body.add(head); body.add(eyes(GLOW(0xff2a1a), 0.36, -0.72, 0.08, 0.045));
    for (let i = 0; i < 6; i++) { const l = leg(0.3, 0.028, m2, 0.34); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 0.34, -0.25 + Math.floor(i / 2) * 0.3); g.add(l); legs.push(l); }
  } else if (kind === "behemoth") {   // a walking fortress: slab shoulders, a tiny head, two pillar legs and two wrecking arms
    const m = mk(CHIT(0x6a5a78, { roughness: 0.4, metalness: 0.35 })), m2 = mk(CHIT(0x2a2034, { roughness: 0.5 }));
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.1), m); torso.position.y = 1.75; body.add(torso);
    for (const sd of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 1.3), m2); pl.position.set(1.05 * sd, 2.6, 0); pl.rotation.z = -sd * 0.25; body.add(pl); body.add(cone(0.14, 0.7, m2, V(1.1 * sd, 2.95, 0), [0, 0, -sd * 0.3])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), m2); head.position.set(0, 2.7, -0.2); body.add(head); body.add(eyes(GLOW(0xff3aa0), 2.72, -0.5, 0.14, 0.07));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), GLOW(0xff3aa0)); core.position.set(0, 1.8, -0.58); body.add(core);
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(1.0 * sd, 2.3, 0); arm.add(limb(V(0, 0, 0), V(0.1 * sd, -1.0, -0.4), 0.28, 0.22, m)); const fist = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), m2); fist.position.set(0.1 * sd, -1.15, -0.45); arm.add(fist); body.add(arm); arms.push(arm); }
    for (const sd of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0.55 * sd, 1.0, 0); lg.add(limb(V(0, 0, 0), V(0, -1.0, 0), 0.3, 0.25, m2)); const ft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.9), m); ft.position.set(0, -1.0, -0.15); lg.add(ft); g.add(lg); legs.push(lg); }
  } else if (kind === "wisp") {   // a floating spirit: a bright core in a thin shell, rings turning round it, ribbon tails
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), GLOW(0xb0f0ff)); core.position.y = 2.4; body.add(core);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0x80d0ff, transparent: true, opacity: 0.28, roughness: 0.1, clearcoat: 1 })); shell.position.y = 2.4; body.add(shell);
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 6, 24), GLOW(0x9ae0ff)); r.position.y = 2.4; r.rotation.set(i ? 1.2 : 0.3, i * 0.9, 0); body.add(r); }
    for (let i = 0; i < 5; i++) { const t = new THREE.Group(); t.position.set(Math.cos(i * 1.26) * 0.25, 2.1, Math.sin(i * 1.26) * 0.25); const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.3, 6), GLOW(0x70c8ff)); c.position.y = -0.65; c.rotation.x = Math.PI; t.add(c); body.add(t); arms.push(t); }
    body.add(eyes(GLOW(0xffffff), 2.45, -0.6, 0.16, 0.06));
  } else if (kind === "drone") {   // a machine: a hovering armoured sphere on two piston legs, a single lens, side cannons
    const m = mk(MAT(0x6a7a8c, { metalness: 0.85, roughness: 0.28 }) as any), m2 = mk(MAT(0x2a3038, { metalness: 0.8, roughness: 0.4 }) as any);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12), m); orb.position.y = 1.55; body.add(orb);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.07, 8, 24), m2); band.position.y = 1.55; band.rotation.x = Math.PI / 2; body.add(band);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), GLOW(0x35e0ff)); lens.position.set(0, 1.6, -0.5); body.add(lens);
    for (const sd of [-1, 1]) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 8), m2); cn.rotation.x = Math.PI / 2; cn.position.set(0.62 * sd, 1.45, -0.35); body.add(cn); const arm = new THREE.Group(); arm.position.set(0.5 * sd, 1.9, 0); arm.add(limb(V(0, 0, 0), V(0.1 * sd, 0.5, 0), 0.03, 0.03, m2)); body.add(arm); arms.push(arm); }
    for (const sd of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(0.28 * sd, 1.0, 0.1); lg.add(limb(V(0, 0, 0), V(0.15 * sd, -1.0, 0), 0.06, 0.04, m2)); g.add(lg); legs.push(lg); }
  } else if (kind === "stalker") {   // a lean hunter: long body, blade crest, two scythe arms, a stinger tail
    const m = mk(CHIT(0x3a5a6a, { roughness: 0.22 })), m2 = mk(CHIT(0x14222c));
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 10), m); torso.position.set(0, 1.35, 0); torso.rotation.x = 0.5; body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m2); head.scale.set(0.9, 0.8, 1.4); head.position.set(0, 1.95, -0.55); body.add(head);
    for (let i = 0; i < 4; i++) body.add(cone(0.05, 0.45, m2, V(0, 2.1 - i * 0.05, -0.3 + i * 0.16), [-0.9, 0, 0]));
    body.add(eyes(GLOW(0xffe03a), 2.0, -0.78, 0.12, 0.05));
    body.add(limb(V(0, 1.0, 0.35), V(0, 0.55, 1.2), 0.1, 0.02, m2)); body.add(cone(0.06, 0.3, GLOW(0xffe03a), V(0, 0.5, 1.3), [Math.PI * 0.6, 0, 0]));
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.22 * sd, 1.7, -0.3); arm.add(limb(V(0, 0, 0), V(0.25 * sd, 0.1, -0.7), 0.06, 0.04, m)); arm.add(limb(V(0.25 * sd, 0.1, -0.7), V(0.15 * sd, -0.7, -1.05), 0.05, 0.01, m2)); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 2; i++) { const l = leg(0.7, 0.06, m2, 1.0); const sd = i ? 1 : -1; l.scale.x = sd; l.position.set(0.18 * sd, 1.05, 0.15); g.add(l); legs.push(l); }
  } else if (kind === "warden") {   // boss: a hive knight, a crowned dome shell, four stamping legs, a molten core
    const m = mk(CHIT(0x5a6a88, { roughness: 0.3, metalness: 0.3 })), m2 = mk(CHIT(0x22283a));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); shell.scale.set(1.2, 1.1, 1.5); shell.position.y = 1.0; body.add(shell);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; body.add(cone(0.12, 0.8, m2, V(Math.cos(a) * 0.85, 2.0, Math.sin(a) * 1.1), [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), m2); head.position.set(0, 1.0, -1.7); body.add(head); body.add(eyes(GLOW(0x9fe8ff), 1.1, -2.1, 0.22, 0.1));
    body.add(cone(0.22, 1.2, m, V(0, 1.1, -2.5), [-Math.PI / 2 + 0.2, 0, 0]));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), GLOW(0x9fe8ff)); core.position.set(0, 1.8, 0.4); body.add(core);
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(1.2 * sd, 1.1, -0.8); arm.add(limb(V(0, 0, 0), V(0.5 * sd, -0.2, -0.9), 0.2, 0.15, m)); arm.add(cone(0.22, 0.9, m2, V(0.6 * sd, -0.3, -1.3), [-Math.PI / 2, 0, 0])); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 4; i++) { const l = leg(0.8, 0.12, m2, 0.95); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.9 * sd, 0.95, -0.5 + Math.floor(i / 2) * 1.2); g.add(l); legs.push(l); }
  } else if (kind === "matriarch") {   // boss: a broad robed queen ringed with glowing egg sacs and a crown of horns
    const m = mk(CARAPACE2), m2 = mk(CHIT(0x6a1a14));
    const robe = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 14), m2); robe.position.y = 1.2; body.add(robe);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), m); chest.position.y = 2.3; body.add(chest);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), GLOW(0xff6a2a)); core.position.set(0, 2.3, -0.42); body.add(core);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), m); head.position.set(0, 3.0, -0.05); head.scale.set(0.9, 1.2, 1); body.add(head); body.add(eyes(GLOW(0xffb03a), 3.05, -0.3, 0.12, 0.06));
    for (let i = 0; i < 7; i++) { const a = (i - 3) / 7 * 1.6; body.add(cone(0.07, 0.7, m2, V(Math.sin(a) * 0.4, 3.45, 0), [0, 0, -a * 0.9])); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sac = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), GLOW(i % 2 ? 0xff7a2a : 0xffb03a)); sac.position.set(Math.cos(a) * 0.95, 0.5 + (i % 3) * 0.25, Math.sin(a) * 0.95); body.add(sac); }
    for (const sd of [-1, 1]) for (const k of [0, 1]) { const arm = new THREE.Group(); arm.position.set(0.55 * sd, 2.4 - k * 0.35, 0); arm.add(limb(V(0, 0, 0), V(0.7 * sd, 0.2 + k * 0.1, -0.5), 0.07, 0.05, m)); const fire = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), GLOW(0xffb040)); fire.position.set(0.8 * sd, 0.3, -0.55); arm.add(fire); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 2; i++) { const l = leg(0.9, 0.09, m2, 1.1); l.position.set(i ? 0.3 : -0.3, 1.1, 0.1); g.add(l); legs.push(l); }
  } else if (kind === "walker") {   // final boss: a tripod war machine, a great eye in an armoured hull
    const m = mk(MAT(0x4a3a5a, { metalness: 0.8, roughness: 0.3 }) as any), m2 = mk(MAT(0x1c1226, { metalness: 0.7, roughness: 0.4 }) as any);
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), m); hull.position.y = 3.4; hull.scale.set(1.2, 0.9, 1.2); body.add(hull);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 32), GLOW(0xff4fd8)); ring.position.y = 3.4; ring.rotation.x = Math.PI / 2; body.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe8f8, emissive: 0xff4fd8, emissiveIntensity: 0.8, roughness: 0.2 })); eye.position.set(0, 3.4, -1.1); body.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshBasicMaterial({ color: 0x14041c })); pup.position.set(0, 3.4, -1.75); body.add(pup);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; body.add(cone(0.14, 0.9, m2, V(Math.cos(a) * 1.4, 4.2, Math.sin(a) * 1.4), [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5])); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const l = leg(1.2, 0.17, m2, 3.2); l.position.set(Math.cos(a) * 1.0, 3.2, Math.sin(a) * 1.0); l.rotation.y = -a + Math.PI / 2; g.add(l); legs.push(l); }
  }
  if (kind === "skitter" || kind === "charger") { const sm = mk(CHIT(0x2a1a0e)); const n = kind === "charger" ? 7 : 5; for (let i = 0; i < n; i++) body.add(cone(kind === "charger" ? 0.1 : 0.05, kind === "charger" ? 0.5 : 0.28, sm, V((i % 2 ? 0.25 : -0.25) * (kind === "charger" ? 1.6 : 0.8), kind === "charger" ? 1.15 : 0.7, (kind === "charger" ? -0.9 : -0.35) + i * (kind === "charger" ? 0.34 : 0.22)), [-0.25, 0, (i % 2 ? -0.5 : 0.5)])); }
  { const gc = tint ? tint : kind === "spitter" ? 0x6aff2a : kind === "skyeye" ? 0xa04aff : kind === "flarecaster" ? 0xff7a2a : 0xff2a1a; const gl = new THREE.Mesh(new THREE.CircleGeometry(kind === "charger" ? 1.6 : 1.1, 24), new THREE.MeshBasicMaterial({ map: haloTex, color: gc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.04; g.add(gl); }   // a faint ominous glow on the floor under every alien
  {   // neon edge lines on the armour plates: a cyber-biomech look, drawn once per alien
    const nc = tint ? tint : kind === "spitter" ? 0x7dff3a : kind === "skyeye" ? 0xc06aff : kind === "flarecaster" ? 0xff8a2a : kind === "charger" ? 0xff3a3a : kind === "mantis" ? 0x2affd0 : 0x35c8ff;
    const lm = new THREE.LineBasicMaterial({ color: nc, transparent: true, opacity: 0.85, fog: false });
    const add: [THREE.Object3D, THREE.LineSegments][] = [];
    g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry || (m.material as any).type === "MeshBasicMaterial") return; const pc = m.geometry.attributes.position; if (!pc || pc.count > 700 || pc.count < 8) return; add.push([m, new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 38), lm)]); });
    for (const [m, l] of add) m.add(l);
    for (const mm of mats) { (mm as any).emissiveIntensity = 1.5; if (tint) mm.color.lerp(new THREE.Color(tint), 0.32); }
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
  else if (id === "laser") { box(0.06, 0.08, 0.5, mid, 0, 0, -0.2); box(0.07, 0.03, 0.3, GLOW(0xff4a5a), 0, 0.055, -0.22); cyl(0.018, 0.2, dark, 0, 0, -0.55); box(0.045, 0.12, 0.07, dark, 0, -0.1, -0.02); box(0.05, 0.14, 0.06, mid, 0, -0.12, -0.28); box(0.03, 0.05, 0.14, GLOW(0xff4a5a), 0, -0.06, 0.12); }
  else if (id === "rail") { box(0.07, 0.09, 0.72, mid, 0, 0, -0.28); box(0.015, 0.05, 0.62, GLOW(0xa8c8ff), 0.045, 0.01, -0.3); box(0.015, 0.05, 0.62, GLOW(0xa8c8ff), -0.045, 0.01, -0.3); for (let i = 0; i < 4; i++) box(0.1, 0.12, 0.04, dark, 0, 0, -0.55 + i * 0.12); box(0.05, 0.12, 0.07, dark, 0, -0.1, 0.0); box(0.06, 0.1, 0.18, mid, 0, -0.02, 0.2); }
  else if (id === "arc") { cyl(0.05, 0.4, mid, 0, 0, -0.22); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 6, 14), GLOW(0x9ad8ff)); r.position.set(0, 0, -0.38 - i * 0.09); g.add(r); } box(0.05, 0.12, 0.07, dark, 0, -0.1, 0.0); box(0.05, 0.1, 0.14, mid, 0, -0.02, 0.15); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), GLOW(0xffffff)); orb.position.set(0, 0, -0.68); g.add(orb); }
  else if (id === "beam") { box(0.07, 0.1, 0.55, mid, 0, 0, -0.2); box(0.075, 0.025, 0.4, GLOW(0xffe45a), 0, 0.06, -0.22); cyl(0.04, 0.3, dark, 0, 0, -0.62); const lens = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), GLOW(0xfff2a0)); lens.position.set(0, 0, -0.78); g.add(lens); box(0.05, 0.12, 0.07, dark, 0, -0.1, 0.0); box(0.06, 0.1, 0.16, mid, 0, -0.02, 0.2); }
  else if (id === "pulsar") { box(0.09, 0.1, 0.5, mid, 0, 0, -0.18); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; cyl(0.016, 0.34, dark, Math.cos(a) * 0.035, Math.sin(a) * 0.035 + 0.01, -0.56); } for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 16), GLOW(0xff4fd8)); r.position.set(0, 0.01, -0.46 - i * 0.1); g.add(r); } box(0.075, 0.025, 0.36, GLOW(0xff4fd8), 0, 0.065, -0.14); box(0.045, 0.12, 0.07, dark, 0, -0.1, 0.0); box(0.06, 0.1, 0.16, mid, 0, -0.02, 0.2); }
  else if (id === "nova") { box(0.1, 0.13, 0.5, mid, 0, 0, -0.16); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), GLOW(0x7dffe0)); orb.position.set(0, 0.02, -0.12); g.add(orb); const cage = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20), GLOW(0xbffff0)); cage.position.set(0, 0.02, -0.12); g.add(cage); const cage2 = cage.clone(); cage2.rotation.y = Math.PI / 2; g.add(cage2); cyl(0.05, 0.4, dark, 0, 0, -0.55); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 16), GLOW(0x7dffe0)); r.position.set(0, 0, -0.45 - i * 0.12); g.add(r); } box(0.05, 0.12, 0.07, dark, 0, -0.11, 0.05); box(0.06, 0.1, 0.16, mid, 0, -0.02, 0.22); }
  else if (id === "storm") { for (const x of [-0.045, 0.045]) { box(0.05, 0.07, 0.5, mid, x, 0, -0.2); box(0.04, 0.02, 0.36, GLOW(0xff9a2e), x, 0.045, -0.22); cyl(0.014, 0.24, dark, x, 0, -0.58); const t = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), GLOW(0xffd08a)); t.position.set(x, 0, -0.71); g.add(t); } box(0.14, 0.04, 0.1, dark, 0, 0.0, -0.02); box(0.045, 0.12, 0.07, dark, 0, -0.1, 0.02); box(0.06, 0.1, 0.16, mid, 0, -0.02, 0.2); }
  else if (id === "cryo") { cyl(0.045, 0.5, mid, 0, 0, -0.22); for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 5), GLOW(0x9fe8ff)); sp.rotation.x = -Math.PI / 2; sp.position.set(Math.cos(i * 1.256) * 0.06, Math.sin(i * 1.256) * 0.06, -0.62 - (i % 2) * 0.06); g.add(sp); } const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), GLOW(0x6fd0ff)); tank.rotation.x = Math.PI / 2; tank.position.set(0, 0.09, -0.12); g.add(tank); box(0.05, 0.12, 0.07, dark, 0, -0.1, 0.02); box(0.06, 0.1, 0.16, mid, 0, -0.02, 0.2); const nz = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), GLOW(0xffffff)); nz.position.set(0, 0, -0.58); g.add(nz); }
  else if (id === "launcher") { cyl(0.07, 0.62, mid, 0, 0, -0.25); cyl(0.085, 0.16, dark, 0, 0, -0.58); box(0.05, 0.12, 0.08, dark, 0, -0.11, 0.0); box(0.05, 0.05, 0.2, tan, 0, -0.03, 0.2); cyl(0.05, 0.05, GLOW(0x41ff9a), 0, 0.06, -0.3); }
  else { box(0.07, 0.09, 0.5, mid, 0, 0, -0.18); cyl(0.022, 0.62, dark, 0, 0.03, -0.5); cyl(0.028, 0.34, tan, 0, -0.04, -0.4); box(0.06, 0.1, 0.2, tan, 0, -0.03, 0.2); box(0.05, 0.12, 0.07, dark, 0, -0.1, 0.0); }
  g.traverse(o => { (o as any).frustumCulled = false; });
  return g;
}

export type Render = { draw: (s: State, dt: number) => void; resize: () => void; dispose: () => void; setHigh: (h: boolean) => void; events: (ev: Ev[]) => void; shake: number; info: () => any; canvas: HTMLCanvasElement };

export function createRender(host: HTMLElement, startHigh: boolean, lv = 0): Render {
  let high = startHigh; const LV = lv > 0 ? LEVELS[Math.min(lv, LEVELS.length) - 1] : null, TH = LV ? LV.theme : null, TINT = LV ? LV.tint : 0;
  const renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.shadowMap.enabled = high; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement; canvas.className = "ah-cv"; host.appendChild(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(TH ? TH.fog : 0x1a1420); scene.fog = new THREE.FogExp2(TH ? TH.fog : 0x3a2a34, TH ? TH.fogD : 0.017);
  const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 220); cam.rotation.order = "YXZ"; scene.add(cam);

  /* sky: a dusk gradient dome, a huge Harvester ship hanging in it */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(8, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); if (TH) { gr.addColorStop(0, TH.sky[0]); gr.addColorStop(0.45, TH.sky[1]); gr.addColorStop(0.66, TH.sky[2]); gr.addColorStop(1, TH.sky[3]); } else { gr.addColorStop(0, "#0b0a1e"); gr.addColorStop(0.45, "#4a2744"); gr.addColorStop(0.62, "#c4684a"); gr.addColorStop(0.66, "#e8a05a"); gr.addColorStop(1, "#2a1c26"); } g.fillStyle = gr; g.fillRect(0, 0, 8, 256); }) }));
  scene.add(sky);
  const ship = new THREE.Group(); const hullM = MAT(0x15131c, { metalness: 0.7, roughness: 0.4 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(46, 52, 7, 40), hullM); ship.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 1.2, 8, 48), GLOW(TH ? TH.ring : 0xff4a3a)); ring.rotation.x = Math.PI / 2; ring.position.y = -3.8; ship.add(ring);
  const core = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10), GLOW(0xff7a3a)); core.position.y = -6; core.scale.y = 0.5; ship.add(core);
  ship.position.set(-30, 62, -110); scene.add(ship);
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(Array.from({ length: 600 }, () => 0).map((_, i) => (i % 3 === 1 ? 20 + Math.random() * 150 : (Math.random() - 0.5) * 340)), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, fog: false, sizeAttenuation: false })); scene.add(stars);

  /* light */
  scene.add(new THREE.HemisphereLight(TH ? TH.hemi[0] : 0xcfd2ff, TH ? TH.hemi[1] : 0x2a2440, 0.9));
  const sun = new THREE.DirectionalLight(TH ? TH.sun : 0xffd9b0, 1.3); sun.position.set(-30, 40, 25); sun.castShadow = high; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); scene.add(sun);
  const rimL = new THREE.DirectionalLight(0x7aa8ff, 0.9); rimL.position.set(20, 18, -30); scene.add(rimL);
  const flash = new THREE.PointLight(0xffd080, 0, 14); scene.add(flash);

  /* ground and the level kit */
  const asphalt = canvasTex(256, 256, g => { g.fillStyle = "#3b3640"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 1800, 0.2); g.strokeStyle = "rgba(230,200,90,.55)"; g.lineWidth = 3; g.setLineDash([22, 18]); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke(); }, 22);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4), new THREE.MeshStandardMaterial({ map: asphalt, color: TH ? TH.ground : 0xffffff, roughness: 0.92, metalness: 0.05 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const crateTex = canvasTex(128, 128, g => { g.fillStyle = "#5a5648"; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 500, 0.25); g.fillStyle = "#d4a93a"; for (let i = -2; i < 8; i++) { g.save(); g.translate(i * 24, 0); g.rotate(-0.6); g.fillRect(0, -10, 10, 220); g.restore(); } g.fillStyle = "rgba(20,20,24,.5)"; g.fillRect(0, 0, 128, 16); }, 1);
  const wallTex = canvasTex(256, 128, g => { g.fillStyle = "#33303a"; g.fillRect(0, 0, 256, 128); noise(g, 256, 128, 900, 0.18); g.fillStyle = "rgba(255,170,80,.7)"; for (let i = 0; i < 18; i++) g.fillRect(8 + (i % 6) * 40, 14 + Math.floor(i / 6) * 34, 16, 20); }, 1);
  const boxMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, metalness: 0.2 });
  const levelGroup = new THREE.Group(); scene.add(levelGroup);
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
    builtFor = boxes;
  }

  /* the gun in hand */
  const guns: Record<string, THREE.Group> = { pistol: buildGun("pistol"), rifle: buildGun("rifle"), shotgun: buildGun("shotgun"), launcher: buildGun("launcher"), laser: buildGun("laser"), rail: buildGun("rail"), arc: buildGun("arc"), beam: buildGun("beam"), pulsar: buildGun("pulsar"), nova: buildGun("nova"), storm: buildGun("storm"), cryo: buildGun("cryo") };
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
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), trM.clone()); const hm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), trM.clone()); (hm.material as THREE.MeshBasicMaterial).opacity = 0.28; m.add(hm); m.visible = false; scene.add(m); tracers.push({ m, life: 0 }); }
  const NP = high ? 160 : 70; type P = { m: THREE.Mesh; v: THREE.Vector3; life: number; g: number };
  const parts: P[] = []; const pgeo = new THREE.SphereGeometry(0.05, 5, 4);
  for (let i = 0; i < NP; i++) { const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: 0x88ff44, fog: false })); m.visible = false; scene.add(m); parts.push({ m, v: new THREE.Vector3(), life: 0, g: 9 }); }
  const burst = (x: number, y: number, z: number, n: number, col: number, spd: number) => { let k = 0; for (const p of parts) { if (p.life > 0) continue; if (k++ >= n) break; (p.m.material as THREE.MeshBasicMaterial).color.setHex(col); p.m.position.set(x, y, z); p.v.set((Math.random() - 0.5) * spd, Math.random() * spd * 0.8, (Math.random() - 0.5) * spd); p.life = 0.5 + Math.random() * 0.4; p.m.visible = true; p.m.scale.setScalar(0.6 + Math.random()); } };
  const arcs: { m: THREE.Mesh[]; life: number }[] = []; const arcMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 3; i++) { const segs: THREE.Mesh[] = []; for (let j = 0; j < 24; j++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), arcMat); m.visible = false; scene.add(m); segs.push(m); } arcs.push({ m: segs, life: 0 }); }
  const pkMeshes = new Map<number, THREE.Group>(); const pkGeo = new THREE.OctahedronGeometry(0.42);
  const rkPool: THREE.Mesh[] = []; const rkGeo = new THREE.SphereGeometry(0.16, 8, 6), rkMat = new THREE.MeshBasicMaterial({ color: 0x66ffb0, fog: false });
  const booms: { m: THREE.Mesh; life: number }[] = []; const bGeo = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; scene.add(m); booms.push({ m, life: 0 }); }
  const bl = new THREE.PointLight(0xffa050, 0, 22); scene.add(bl); let blT = 0;
  const acidM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), GLOW(0x9cff3a)); const acidPool: THREE.Mesh[] = [];

  const rigs = new Map<number, { rig: Rig; e: Enemy; fade: number }>();
  let crouch = 0; let gun = "rifle", kick = 0, mfT = 0, flashT = 0, bob = 0, shake = 0, curShake = 0;
  const api: Render = {
    canvas, shake: 0,
    events(ev) {
      for (const e of ev) {
        if (e.k === "shot") { kick = Math.min(1, kick + (e.w === "shotgun" ? 0.9 : e.w === "pistol" ? 0.45 : 0.25)); mfT = 0.05; flashT = 0.06; { const c = WCOL[e.w as string] || 0xffd080; flash.color.setHex(c); (mflash.material as THREE.MeshBasicMaterial).color.setHex(c); mflash.scale.setScalar(e.w === "nova" || e.w === "rail" || e.w === "shotgun" ? 2.2 : 1.2); } const t = e.w === "arc" ? null : tracers.find(q => q.life <= 0); if (t) { t.life = e.w === "rail" ? 0.25 : 0.07; t.m.visible = true; { const c = WCOL[e.w as string] || 0xffe9a0; (t.m.material as THREE.MeshBasicMaterial).color.setHex(0xffffff); ((t.m.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(c); const th = e.w === "nova" ? 3.2 : e.w === "rail" ? 2.2 : e.w === "beam" || e.w === "cryo" ? 1.4 : e.w === "storm" || e.w === "laser" ? 1.1 : 1.6; t.m.userData.th = th; } const from = new THREE.Vector3(0.2, -0.17, -0.7).applyMatrix4(cam.matrixWorld), dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), to = from.clone().addScaledVector(dir, e.w === "rail" ? 90 : 36); const mid = from.clone().add(to).multiplyScalar(0.5); t.m.position.copy(mid); t.m.scale.set(t.m.userData.th || 1, from.distanceTo(to), t.m.userData.th || 1); t.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); } }
        else if (e.k === "boom") { const b = booms.find(q => q.life <= 0); if (b) { b.life = 0.45; b.m.visible = true; b.m.position.set(e.x as number, e.y as number, e.z as number); } burst(e.x as number, (e.y as number), e.z as number, high ? 50 : 24, 0xffb04a, 9); bl.position.set(e.x as number, 2, e.z as number); blT = 0.25; curShake = Math.min(1, curShake + 0.5); }
        else if (e.k === "hit") { burst(e.x as number, e.y as number, e.z as number, 5, 0x9cff3a, 3); if (e.w) burst(e.x as number, e.y as number, e.z as number, high ? 7 : 3, WCOL[e.w as string] || 0xffffff, 6); }
        else if (e.k === "kill" || e.k === "head") burst(e.x as number, 0.9, e.z as number, high ? 26 : 12, e.k === "head" ? 0xffd34a : 0x7cd62a, 5);
        else if (e.k === "hurt") curShake = Math.min(1, curShake + 0.35);
        else if (e.k === "arc" && e.p) { const a = arcs.find(q => q.life <= 0); if (a) { a.life = 0.14; const pts: THREE.Vector3[] = []; const from = new THREE.Vector3(0.2, -0.17, -0.7).applyMatrix4(cam.matrixWorld); pts.push(from); for (let i = 3; i < e.p.length; i += 3) pts.push(new THREE.Vector3(e.p[i], e.p[i + 1], e.p[i + 2])); let k = 0; for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1], n = 6; let prev = A.clone(); for (let j = 1; j <= n && k < a.m.length; j++) { const q = A.clone().lerp(B, j / n); if (j < n) q.add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7)); const d = q.clone().sub(prev), L = d.length(); const m = a.m[k++]; m.visible = true; m.position.copy(prev).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); prev = q; } } for (; k < a.m.length; k++) a.m[k].visible = false; } kick = Math.min(1, kick + 0.15); mfT = 0.04; flashT = 0.05; }
      }
    },
    draw(s, dt) {
      if (builtFor !== s.boxes) buildLevel(s.boxes, s.hz); for (const q of hzMesh) { const on = s.hzClock % q.h.per < q.h.on; (q.m.material as THREE.MeshBasicMaterial).opacity = on ? 0.55 + 0.2 * Math.sin(performance.now() / 120) : 0.12; }
      const p = s.p; crouch += ((p.slide > 0 ? 0.7 : 0) - crouch) * Math.min(1, dt * 12); cam.position.set(p.x, EYE + p.y - crouch + Math.sin(bob) * 0.025 * (p.sprint ? 1.6 : 1), p.z); cam.rotation.set(p.pitch + curShake * (Math.random() - 0.5) * 0.04, p.yaw + curShake * (Math.random() - 0.5) * 0.04, 0);
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
        if (!r) { const rig = buildAlien(e.kind, TINT); rig.g.scale.setScalar(ALIEN_SCALE[e.kind]); (rig.g as any).userData.born = performance.now(); scene.add(rig.g); r = { rig, e, fade: 0 }; rigs.set(e.id, r); }
        r.e = e; const g = r.rig.g; g.position.set(e.x, 0, e.z); g.rotation.y = e.yaw; { const age = (performance.now() - ((g as any).userData.born || 0)) / 700; if (age < 1 && e.dead === 0) { g.position.y = -(1 - age) * 1.6 * ALIEN_SCALE[e.kind]; } }
        const tt = e.t * (behOf(e.kind) === "skitter" ? 16 : behOf(e.kind) === "mantis" ? 8 : behOf(e.kind) === "charger" ? ((e.rush || 0) > 0 ? 26 : 6) : 6);
        r.rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(tt + i * 1.9) * 0.55; });
        r.rig.arms.forEach((a, i) => { if (behOf(e.kind) === "skyeye") { a.rotation.x = Math.sin(e.t * 2.5 + i) * 0.35; a.rotation.z = Math.cos(e.t * 2 + i * 2) * 0.3; } else a.rotation.x = -0.5 + Math.sin(e.t * 3 + i * 3) * 0.2 - (e.cd < 0.4 ? 0.9 : 0); });
        r.rig.body.position.y = behOf(e.kind) === "skyeye" ? Math.sin(e.t * 1.6) * 0.35 : Math.abs(Math.sin(tt * 0.5)) * 0.05 + (e.leap > 0 ? 0.7 : 0) - ((e.tele || 0) > 0 ? 0.25 : 0);
        if (behOf(e.kind) === "charger") r.rig.body.rotation.x = (e.tele || 0) > 0 ? 0.18 : 0;
        for (const m of r.rig.mats) m.emissive.setHex(e.flash > 0 ? 0xff5030 : (e.tele || 0) > 0 ? 0x992010 : 0x181c0c);
        if (e.dead > 0) { const k = 1 - e.dead / 0.9; g.rotation.z = k * 1.5; g.position.y = -k * 0.25; g.scale.setScalar(ALIEN_SCALE[e.kind] * Math.max(0.01, 1 - Math.max(0, k - 0.6) * 2.5)); }
      }
      for (const [id, r] of rigs) if (!seen.has(id)) { scene.remove(r.rig.g); r.rig.g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); } }); rigs.delete(id); }
      while (rkPool.length < s.rk.length) { const m = new THREE.Mesh(rkGeo, rkMat); scene.add(m); rkPool.push(m); }
      rkPool.forEach((m, i) => { const a = s.rk[i]; m.visible = !!a; if (a) m.position.set(a.x, a.y, a.z); });
      for (const b of booms) if (b.life > 0) { b.life -= dt; const k = 1 - b.life / 0.45; b.m.scale.setScalar(0.5 + k * 4.2); (b.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k)); if (b.life <= 0) b.m.visible = false; }
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
