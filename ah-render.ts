/* Alien Hunt renderer (plan 38): three.js scene, first-person camera, the gun in hand, procedural insect aliens, tracers and goo.
   High = shadows, device pixel ratio up to 2, more particles; Lite = no shadows, pixel ratio 1, fewer lights. Everything is drawn from code, nothing is downloaded. */
import * as THREE from "three";
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
  } else if (kind === "glowbug") {   // Luma: a night beetle, dark shell freckled with glowing teal spots and a lantern abdomen
    const m = mk(CHIT(0x1c3a3a, { roughness: 0.25, clearcoat: 1 })), m2 = mk(CHIT(0x0c1c20));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), m); shell.scale.set(1, 0.6, 1.3); shell.position.set(0, 0.4, 0.05); body.add(shell);
    for (let i = 0; i < 7; i++) { const a = i * 2.4, s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), GLOW(0x5affd0)); s.position.set(Math.cos(a) * 0.28, 0.62 + Math.sin(a * 1.7) * 0.03, 0.05 + Math.sin(a) * 0.5); body.add(s); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9), GLOW(0x7affc8)); lamp.position.set(0, 0.42, 0.75); body.add(lamp);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x5affc8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(1.6, 1.6, 1); sp.position.set(0, 0.45, 0.75); body.add(sp);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m2); head.position.set(0, 0.36, -0.66); body.add(head); body.add(eyes(GLOW(0xff7ae0), 0.42, -0.78, 0.1, 0.05)); body.add(mandibles(m2, 0.3, -0.8, 0.2, 0.07));
    for (let i = 0; i < 6; i++) { const l = leg(0.32, 0.03, m2, 0.38); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.3 * sd, 0.38, -0.25 + Math.floor(i / 2) * 0.33); g.add(l); legs.push(l); }
  } else if (kind === "thornback") {   // Luma: an armoured jungle brute, a ridge of glowing magenta thorns down its back
    const m = mk(CHIT(0x3a4a2a, { roughness: 0.4 })), m2 = mk(CHIT(0x1a2412));
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), m); torso.scale.set(1, 0.8, 1.55); torso.position.set(0, 0.95, 0.1); body.add(torso);
    for (let i = 0; i < 9; i++) { const z = -0.7 + i * 0.22, h = 0.5 + Math.sin(i / 8 * Math.PI) * 0.45; body.add(cone(0.1, h, GLOW(0xff4fd0), V(0, 1.55 + h * 0.2, z), [0.08, 0, 0])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), m2); head.scale.set(0.95, 0.8, 1.2); head.position.set(0, 0.85, -1.15); body.add(head);
    for (const sd of [-1, 1]) { body.add(cone(0.1, 0.6, m2, V(0.28 * sd, 1.15, -1.3), [-1.0, 0, -sd * 0.4])); }
    body.add(eyes(GLOW(0xffb04a), 0.95, -1.5, 0.17, 0.07));
    for (let i = 0; i < 4; i++) { const l = leg(0.6, 0.1, m2, 0.82); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.5 * sd, 0.82, -0.5 + Math.floor(i / 2) * 1.0); g.add(l); legs.push(l); }
  } else if (kind === "sporecaster") {   // Luma: a walking mushroom: a speckled glowing cap, a stalk body, dangling spore sacs
    const m = mk(CHIT(0xc080e0, { roughness: 0.5 })), m2 = mk(CHIT(0x6a4a7a));
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.3, 10), m2); stalk.position.y = 0.95; body.add(stalk);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); cap.position.y = 1.55; cap.scale.set(1, 0.7, 1); body.add(cap);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.25 + (i % 3) * 0.2; const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), GLOW(i % 2 ? 0xff9aff : 0x9affea)); s.position.set(Math.cos(a) * rr, 1.55 + Math.sqrt(Math.max(0, 0.6 - rr * rr)) * 0.5, Math.sin(a) * rr); body.add(s); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.05, 6, 24), GLOW(0xff7aff)); rim.position.y = 1.52; rim.rotation.x = Math.PI / 2; body.add(rim);
    body.add(eyes(GLOW(0xffffff), 1.1, -0.34, 0.14, 0.08));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, t = new THREE.Group(); t.position.set(Math.cos(a) * 0.55, 1.5, Math.sin(a) * 0.55); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.8, 5), m2); c.position.y = -0.4; t.add(c); const sac = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), GLOW(0x9affea)); sac.position.y = -0.85; t.add(sac); body.add(t); arms.push(t); }
    for (let i = 0; i < 3; i++) { const l = leg(0.55, 0.08, m2, 0.7); l.position.set(Math.cos(i * 2.1) * 0.25, 0.7, Math.sin(i * 2.1) * 0.25); l.rotation.y = i * 2.1; g.add(l); legs.push(l); }
  } else if (kind === "hound") {   // Luma: a lean shadow predator on four long legs, a long jaw and glowing stripes
    const m = mk(CHIT(0x14202a, { roughness: 0.3 })), m2 = mk(CHIT(0x070c12));
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.95, 6, 10), m); torso.rotation.x = Math.PI / 2; torso.position.set(0, 0.85, 0.05); body.add(torso);
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 5, 14), GLOW(0x5aa8ff)); st.position.set(0, 0.85, -0.3 + i * 0.28); st.rotation.y = Math.PI / 2; body.add(st); }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 8), m2); head.rotation.x = -Math.PI / 2; head.position.set(0, 0.95, -0.95); body.add(head);
    body.add(eyes(GLOW(0x5aa8ff), 1.02, -0.78, 0.13, 0.06));
    body.add(limb(V(0, 0.9, 0.5), V(0, 0.75, 1.15), 0.09, 0.02, m));
    for (let i = 0; i < 4; i++) { const l = leg(0.5, 0.06, m2, 0.82); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.22 * sd, 0.82, -0.35 + Math.floor(i / 2) * 0.85); g.add(l); legs.push(l); }
  } else if (kind === "lumawarden") {   // Luma boss: a towering thornback crowned with glowing crystals, a lit core in the chest
    const m = mk(CHIT(0x2c4a28, { roughness: 0.38 })), m2 = mk(CHIT(0x101c10));
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), m); torso.scale.set(1.05, 0.9, 1.5); torso.position.set(0, 1.25, 0.1); body.add(torso);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), GLOW(0xff4fd0)); core.position.set(0, 1.3, -1.35); body.add(core);
    for (let i = 0; i < 11; i++) { const z = -0.9 + i * 0.22, h = 0.8 + Math.sin(i / 10 * Math.PI) * 0.8; body.add(cone(0.14, h, GLOW(i % 2 ? 0xff4fd0 : 0x5affd0), V(0, 2.05 + h * 0.2, z), [0.1, 0, 0])); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), m2); head.scale.set(1, 0.85, 1.2); head.position.set(0, 1.2, -1.7); body.add(head);
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.42; body.add(cone(0.09, 0.9, GLOW(0x9affea), V(Math.sin(a) * 0.5, 1.75, -1.7), [-0.4, 0, -a * 0.8])); }
    body.add(eyes(GLOW(0xffd04a), 1.3, -2.0, 0.2, 0.09));
    for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.9 * sd, 1.5, -0.5); arm.add(limb(V(0, 0, 0), V(0.2 * sd, -0.8, -0.7), 0.2, 0.14, m)); arm.add(cone(0.16, 0.8, m2, V(0.2 * sd, -0.9, -0.95), [-1.3, 0, 0])); body.add(arm); arms.push(arm); }
    for (let i = 0; i < 4; i++) { const l = leg(0.85, 0.15, m2, 1.08); const sd = i % 2 ? 1 : -1; l.scale.x = sd; l.position.set(0.7 * sd, 1.08, -0.6 + Math.floor(i / 2) * 1.3); g.add(l); legs.push(l); }
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

export type Render = { draw: (s: State, dt: number) => void; resize: () => void; dispose: () => void; setHigh: (h: boolean) => void; events: (ev: Ev[]) => void; shake: number; info: () => any; canvas: HTMLCanvasElement };

export function createRender(host: HTMLElement, startHigh: boolean, lv = 0, lvObj: Level | null = null): Render {
  let high = startHigh; const LV = lvObj || (lv > 0 ? LEVELS[Math.min(lv, LEVELS.length) - 1] : null), KIT = LV && LV.kit ? LV.kit : "", JUNGLE = KIT === "jungle", TH = LV ? LV.theme : null, TINT = LV ? LV.tint : 0;
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
  if (KIT) ship.visible = false;   // a Robot Adventure 3D level has its own sky
  if (JUNGLE) {   // Luma: no Harvester ship; a pale ringed gas giant hangs in the sky instead
    ship.visible = false;
    const giant = new THREE.Mesh(new THREE.SphereGeometry(30, 28, 18), new THREE.MeshBasicMaterial({ fog: false, map: canvasTex(256, 128, g => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#9ad8c8"); gr.addColorStop(0.5, "#5aa89a"); gr.addColorStop(1, "#2a6a68"); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 9; i++) { g.fillStyle = "rgba(255,255,255," + (0.05 + (i % 3) * 0.04) + ")"; g.fillRect(0, 8 + i * 13, 256, 4 + (i % 4)); } }) })); giant.position.set(-60, 55, -140); scene.add(giant);
    const rg = new THREE.Mesh(new THREE.RingGeometry(40, 58, 48), new THREE.MeshBasicMaterial({ color: 0xbff0e0, side: THREE.DoubleSide, transparent: true, opacity: 0.35, fog: false })); rg.rotation.x = 1.25; rg.rotation.y = 0.3; rg.position.copy(giant.position); scene.add(rg);
  }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(Array.from({ length: 600 }, () => 0).map((_, i) => (i % 3 === 1 ? 20 + Math.random() * 150 : (Math.random() - 0.5) * 340)), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, fog: false, sizeAttenuation: false })); scene.add(stars);

  /* light */
  scene.add(new THREE.HemisphereLight(TH ? TH.hemi[0] : 0xcfd2ff, TH ? TH.hemi[1] : 0x2a2440, 0.9));
  const sun = new THREE.DirectionalLight(TH ? TH.sun : 0xffd9b0, 1.3); sun.position.set(-30, 40, 25); sun.castShadow = high; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); scene.add(sun);
  const rimL = new THREE.DirectionalLight(0x7aa8ff, 0.9); rimL.position.set(20, 18, -30); scene.add(rimL);
  const flash = new THREE.PointLight(0xffd080, 0, 14); scene.add(flash);

  /* ground and the level kit */
  const asphalt = canvasTex(256, 256, g => { g.fillStyle = "#3b3640"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 1800, 0.2); g.strokeStyle = "rgba(230,200,90,.55)"; g.lineWidth = 3; g.setLineDash([22, 18]); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke(); }, 22);
  const moss = canvasTex(256, 256, g => { g.fillStyle = "#1d3a2c"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 2600, 0.3); for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(" + (60 + (i % 5) * 30) + ",255," + (150 + (i % 3) * 40) + ",.16)"; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 0, 7); g.fill(); } }, 14);
  const KITC: Record<string, string> = { desert: "#7a5030", ice: "#6f90b0", lava: "#2c1a16", ruins: "#3c3a4c", gas: "#6a4a7a", belt: "#4a5a6a", sun: "#8a5a20" }, KITW: Record<string, number> = { jungle: 0x0c2a1c, desert: 0x4a2a14, ice: 0x2a4a68, lava: 0x1a0c08, ruins: 0x1c1830, gas: 0x2a1a4a, belt: 0x1a2a3c, sun: 0x4a2008 };
  const kitTex = canvasTex(256, 256, g => { g.fillStyle = KITC[KIT] || "#444"; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 2400, 0.32); for (let i = 0; i < 60; i++) { g.fillStyle = KIT === "lava" ? "rgba(255," + (80 + (i % 4) * 30) + ",20,.18)" : "rgba(255,255,255,.07)"; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 0, 7); g.fill(); } }, 14);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4), new THREE.MeshStandardMaterial({ map: KIT ? (JUNGLE ? moss : kitTex) : asphalt, color: TH ? TH.ground : 0xffffff, roughness: 0.92, metalness: 0.05 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const crateTex = canvasTex(128, 128, g => { g.fillStyle = "#5a5648"; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 500, 0.25); g.fillStyle = "#d4a93a"; for (let i = -2; i < 8; i++) { g.save(); g.translate(i * 24, 0); g.rotate(-0.6); g.fillRect(0, -10, 10, 220); g.restore(); } g.fillStyle = "rgba(20,20,24,.5)"; g.fillRect(0, 0, 128, 16); }, 1);
  const wallTex = canvasTex(256, 128, g => { g.fillStyle = "#33303a"; g.fillRect(0, 0, 256, 128); noise(g, 256, 128, 900, 0.18); g.fillStyle = "rgba(255,170,80,.7)"; for (let i = 0; i < 18; i++) g.fillRect(8 + (i % 6) * 40, 14 + Math.floor(i / 6) * 34, 16, 20); }, 1);
  const rockTex = canvasTex(128, 128, g => { g.fillStyle = "#3a4a40"; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 900, 0.3); g.fillStyle = "rgba(90,255,190,.25)"; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 0, 7); g.fill(); } }, 1);
  const boxMat = new THREE.MeshStandardMaterial({ map: KIT ? (JUNGLE ? rockTex : kitTex) : crateTex, roughness: 0.8, metalness: 0.2 });
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
    if (KIT && !JUNGLE) {   // the other Robot Adventure 3D kits: walls in the planet's colour and a ring of tall landmarks beyond the arena
      const wl = new THREE.MeshStandardMaterial({ color: KITW[KIT], roughness: 0.9 });
      for (const m of levelGroup.children.slice(boxes.length, boxes.length + 4)) (m as THREE.Mesh).material = wl;
      const glowC = KIT === "ice" ? 0x7ad8ff : KIT === "lava" ? 0xff6a1a : KIT === "desert" ? 0xff9a4a : KIT === "gas" ? 0xffbe6e : KIT === "belt" ? 0x6ab0ff : KIT === "sun" ? 0xffc060 : 0x9a7aff, body = MAT(KIT === "ice" ? 0x6a9ac0 : KIT === "lava" ? 0x1c0e0a : KIT === "desert" ? 0x7a4a28 : KIT === "gas" ? 0x5a3a7a : KIT === "belt" ? 0x4a5a6a : KIT === "sun" ? 0x8a4a14 : 0x3a3a52, { roughness: 0.55 });
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + Math.sin(i * 7.3) * 0.05, rr = 24 + (i % 4) * 3 + Math.abs(Math.sin(i * 3.1)) * 3, h = 3 + Math.abs(Math.sin(i * 5.7)) * 6, g = new THREE.Group();
        const m = new THREE.Mesh(KIT === "desert" || KIT === "belt" ? new THREE.BoxGeometry(2.4 + (i % 3), h, 2.4 + (i % 2)) : KIT === "ruins" ? new THREE.BoxGeometry(1.8, h * 1.3, 1.8) : new THREE.ConeGeometry(0.9 + (i % 3) * 0.4, h * 1.4, KIT === "ice" ? 5 : 6), body); m.position.y = h * 0.55; m.rotation.y = i; g.add(m);
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
    flashI = f.li; mflash.scale.setScalar(f.fl); kick = Math.min(1, kick + f.kick); curShake = Math.min(1, curShake + f.shk);
  };
  const api: Render = {
    canvas, shake: 0,
    events(ev) {
      for (const e of ev) {
        if (e.k === "strike") { curShake = Math.max(curShake, 3); flashT = 0.5; flash.color.setHex(0xfff0c0); flash.intensity = 40; flash.position.copy(cam.position); }
        else if (e.k === "dig") burst(e.x as number, 0.8, e.z as number, high ? 14 : 6, 0x9adfff, 4);
        else if (e.k === "shot") { mfT = 0.05; flashT = 0.06; gunFx(e.w as string); { const c = WCOL[e.w as string] || 0xffd080; flash.color.setHex(c); (mflash.material as THREE.MeshBasicMaterial).color.setHex(c); } const t = e.w === "arc" || e.w === "rpg" || e.w === "salvo" || e.w === "launcher" ? null : tracers.find(q => q.life <= 0); if (t) { t.life = e.w === "rail" ? 0.25 : 0.07; t.m.visible = true; { const c = WCOL[e.w as string] || 0xffe9a0; (t.m.material as THREE.MeshBasicMaterial).color.setHex(0xffffff); ((t.m.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(c); const th = e.w === "nova" ? 3.2 : e.w === "rail" ? 2.2 : e.w === "beam" || e.w === "cryo" ? 1.4 : e.w === "storm" || e.w === "laser" ? 1.1 : 1.6; t.m.userData.th = th; } const from = new THREE.Vector3(0.2, -0.17, -0.7).applyMatrix4(cam.matrixWorld), dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), to = from.clone().addScaledVector(dir, e.w === "rail" ? 90 : 36); const mid = from.clone().add(to).multiplyScalar(0.5); t.m.position.copy(mid); t.m.scale.set(t.m.userData.th || 1, from.distanceTo(to), t.m.userData.th || 1); t.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); } }
        else if (e.k === "boom") { const b = booms.find(q => q.life <= 0); if (b) { b.life = 0.45; (b as any).size = ((e.n as number) || 1) * 1.0; b.m.visible = true; b.m.position.set(e.x as number, e.y as number, e.z as number); } burst(e.x as number, (e.y as number), e.z as number, Math.round((high ? 50 : 24) * Math.min(2.4, ((e.n as number) || 1))), 0xffb04a, 9 * Math.min(1.6, ((e.n as number) || 1))); if (((e.n as number) || 1) >= 2) burst(e.x as number, (e.y as number) + 0.6, e.z as number, high ? 40 : 18, 0x444444, 6); bl.position.set(e.x as number, 2, e.z as number); blT = 0.25 * Math.min(2, ((e.n as number) || 1)); curShake = Math.min(1, curShake + 0.5 * Math.min(1.8, ((e.n as number) || 1))); }
        else if (e.k === "hit") { burst(e.x as number, e.y as number, e.z as number, 5, 0x9cff3a, 3); if (e.w) burst(e.x as number, e.y as number, e.z as number, high ? 7 : 3, WCOL[e.w as string] || 0xffffff, 6); }
        else if (e.k === "kill" || e.k === "head") burst(e.x as number, 0.9, e.z as number, high ? 26 : 12, e.k === "head" ? 0xffd34a : 0x7cd62a, 5);
        else if (e.k === "hurt") curShake = Math.min(1, curShake + 0.35);
        else if (e.k === "arc" && e.p) { const a = arcs.find(q => q.life <= 0); if (a) { a.life = 0.14; const pts: THREE.Vector3[] = []; const from = new THREE.Vector3(0.2, -0.17, -0.7).applyMatrix4(cam.matrixWorld); pts.push(from); for (let i = 3; i < e.p.length; i += 3) pts.push(new THREE.Vector3(e.p[i], e.p[i + 1], e.p[i + 2])); let k = 0; for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1], n = 6; let prev = A.clone(); for (let j = 1; j <= n && k < a.m.length; j++) { const q = A.clone().lerp(B, j / n); if (j < n) q.add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7)); const d = q.clone().sub(prev), L = d.length(); const m = a.m[k++]; m.visible = true; m.position.copy(prev).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); prev = q; } } for (; k < a.m.length; k++) a.m[k].visible = false; } kick = Math.min(1, kick + 0.15); mfT = 0.04; flashT = 0.05; }
      }
    },
    draw(s, dt) {
      if (s.ms && msBuilt !== s.ms) {   // mission markers: station rings with a beam, ore nodes, uplink terminals
        msBuilt = s.ms; for (const g of msMarks) scene.remove(g); msMarks.length = 0;
        for (const it of s.ms.items) { const g = new THREE.Group(), mine = s.ms.type === "mine", col = mine ? 0x6ab0ff : s.ms.type === "strike" ? 0xff5a3a : 0x5affc8;
          if (mine) { for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + (i % 2) * 0.3, 0), GLOW(col)); c.position.set(Math.cos(i * 1.6) * 0.6, 0.6 + (i % 2) * 0.3, Math.sin(i * 1.6) * 0.6); c.rotation.set(i, i * 2, 0); g.add(c); } const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), MAT(0x2a3a4c)); rk.position.y = 0.5; g.add(rk); }
          else { const ring = new THREE.Mesh(new THREE.TorusGeometry(it.r, 0.1, 8, 40), GLOW(col)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring); const disc = new THREE.Mesh(new THREE.CircleGeometry(it.r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 14, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })); beam.position.y = 7; beam.name = "beam"; g.add(beam);
            const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 8), MAT(0x2a3038, { metalness: 0.8 })); pil.position.y = 0.7; g.add(pil); }
          g.position.set(it.x, 0, it.z); (g as any).userData = { it, col }; scene.add(g); msMarks.push(g); }
      }
      for (const g of msMarks) { const u = (g as any).userData, it = u.it; g.visible = !(s.ms && s.ms.type === "mine" && it.done) && !(s.ms && s.ms.phase === 1 && !it.done); const beam = g.getObjectByName("beam") as THREE.Mesh | undefined; if (beam) { const m = beam.material as THREE.MeshBasicMaterial; m.color.setHex(it.done ? 0x5aff7a : u.col); m.opacity = 0.18 + 0.4 * Math.max(it.p, it.done ? 1 : 0) + 0.05 * Math.sin(performance.now() / 160); } g.rotation.y += dt * 0.4; }
      if (builtFor !== s.boxes) buildLevel(s.boxes, s.hz); for (const q of hzMesh) { const on = s.hzClock % q.h.per < q.h.on; (q.m.material as THREE.MeshBasicMaterial).opacity = on ? 0.55 + 0.2 * Math.sin(performance.now() / 120) : 0.12; }
      const p = s.p; crouch += ((p.slide > 0 ? 0.7 : 0) - crouch) * Math.min(1, dt * 12); cam.position.set(p.x, EYE + p.y - crouch + Math.sin(bob) * 0.025 * (p.sprint ? 1.6 : 1), p.z); cam.rotation.set(p.pitch + curShake * (Math.random() - 0.5) * 0.04, p.yaw + curShake * (Math.random() - 0.5) * 0.04, 0);
      cam.updateMatrixWorld(true);
      if (guns[s.weapon] && gun !== s.weapon) { guns[gun].visible = false; gun = s.weapon; guns[gun].visible = true; } guns[gun].visible = true;
      kick = Math.max(0, kick - dt * 7); curShake = Math.max(0, curShake - dt * 2.2);
      const moving = s.frozen ? 0 : 1; bob += dt * (p.sprint ? 12 : 8) * moving * (p.y <= 0.01 ? 1 : 0);
      const rl = s.reload > 0 ? Math.sin(Math.min(1, (1 - s.reload / 1.6)) * Math.PI) : 0;
      hold.position.set(0.2 + Math.sin(bob * 0.5) * 0.008, -0.2 + Math.abs(Math.sin(bob * 0.5)) * 0.01 - rl * 0.16 - kick * 0.01, -0.38 + kick * 0.09);
      hold.rotation.set(kick * 0.14 + rl * 0.5, 0, rl * 0.3);
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
        r.rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(tt + i * 1.9) * 0.55; });
        r.rig.arms.forEach((a, i) => { if (behOf(e.kind) === "skyeye") { a.rotation.x = Math.sin(e.t * 2.5 + i) * 0.35; a.rotation.z = Math.cos(e.t * 2 + i * 2) * 0.3; } else a.rotation.x = -0.5 + Math.sin(e.t * 3 + i * 3) * 0.2 - (e.cd < 0.4 ? 0.9 : 0); });
        r.rig.body.position.y = behOf(e.kind) === "skyeye" ? Math.sin(e.t * 1.6) * 0.35 : Math.abs(Math.sin(tt * 0.5)) * 0.05 + (e.leap > 0 ? 0.7 : 0) - ((e.tele || 0) > 0 ? 0.25 : 0);
        if (behOf(e.kind) === "charger") r.rig.body.rotation.x = (e.tele || 0) > 0 ? 0.18 : 0;
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
