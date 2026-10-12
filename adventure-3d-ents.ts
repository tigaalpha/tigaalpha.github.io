/* ── Adventure 3D characters (owner, 2026-10-12: "do the real 3D engine, from the first map to the last") ──
   The 3D layer's actors, all built from primitives in code (nothing downloaded): an articulated robot hero with a real walk, run, jump, punch and kick (joint
   angles, not stills), twenty monster types in six body plans, the end-of-map guardian and the pet. They live on the game plane (z = 0) of the scene in
   adventure-3d.tsx; the game still owns every rule (positions, hits, hp), this file only draws what it is told each frame. */
import * as THREE from "three";

const hex = (s: string) => new THREE.Color(s);
const rgbc = (s: string) => { const [r, g, b] = s.split(",").map(Number); return new THREE.Color((r || 0) / 255, (g || 0) / 255, (b || 0) / 255); };
const std = (c: THREE.ColorRepresentation, e: THREE.ColorRepresentation = 0x000000, ei = 0, rough = 0.55, metal = 0.06) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, roughness: rough, metalness: metal });
const D2R = Math.PI / 180, clamp01 = (v: number) => Math.max(0, Math.min(1, v)), lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── a limb: a pivot at the joint, a cylinder hanging from it, and `end` where the next joint sits ── */
function limb(len: number, r0: number, r1: number, mat: THREE.Material, store: THREE.Mesh[]): { pivot: THREE.Group; end: THREE.Group } {
  const pivot = new THREE.Group(), geo = new THREE.CylinderGeometry(r0, r1, len, 8), m = new THREE.Mesh(geo, mat); m.position.y = -len / 2; pivot.add(m); store.push(m);
  const end = new THREE.Group(); end.position.y = -len; pivot.add(end);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(r0 * 1.15, 8, 6), mat); pivot.add(joint); store.push(joint);
  return { pivot, end };
}

/* ═════════════ the hero ═════════════ */
export interface HeroState { x: number; y: number; face: number; name: string; dist: number; swing: number; dead: boolean; inv: number; gun: string; moving: boolean; tm: number; }
export interface Hero { group: THREE.Group; update(s: HeroState): void; dispose(): void; }

export function buildHero(armorA: string, armorB: string, glowHex: string, accentHex: string): Hero {
  const meshes: THREE.Mesh[] = [], geos: THREE.BufferGeometry[] = [];
  const A = std(armorA, 0x000000, 0, 0.5, 0.08), B = std(armorB, 0x000000, 0, 0.55, 0.08), G = std(glowHex, glowHex, 1.4, 0.3, 0), K = std(accentHex, accentHex, 0.5, 0.4, 0.4);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const box = (w: number, h: number, d: number, m: THREE.Material) => { const g = new THREE.BoxGeometry(w, h, d); geos.push(g); const o = new THREE.Mesh(g, m); meshes.push(o); return o; };
  const sph = (r: number, m: THREE.Material, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 12, 9); geos.push(g); const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); meshes.push(o); return o; };
  const HIP = 47;
  const hips = new THREE.Group(); hips.position.y = HIP; body.add(hips);
  const pelvis = box(22, 9, 14, B); pelvis.position.y = 0; hips.add(pelvis);
  const torso = new THREE.Group(); hips.add(torso);                  // pitches forward/back
  const chest = box(27, 27, 15, A); chest.position.y = 17; torso.add(chest);
  const plate = box(21, 15, 3, K); plate.position.set(0, 20, 8.4); torso.add(plate);
  const core = sph(4.2, G); core.position.set(0, 20, 9.6); torso.add(core);
  const back = box(18, 20, 6, B); back.position.set(0, 18, -10); torso.add(back);
  const neck = new THREE.Group(); neck.position.y = 31; torso.add(neck);
  const head = sph(10, A, 1, 1.05, 1.05); head.position.y = 8; neck.add(head);
  const visor = box(15, 5, 8, G); visor.position.set(0, 9, 7); neck.add(visor);
  const ant = box(1.6, 9, 1.6, K); ant.position.set(5, 19, -2); neck.add(ant);
  // arms
  const armParts = (side: number) => {
    const sh = new THREE.Group(); sh.position.set(side * 16, 28, 0); torso.add(sh);
    const pad = sph(6, B, 1, 0.8, 1); sh.add(pad); meshes.push(pad);
    const up = limb(15, 3.8, 3.2, A, meshes); sh.add(up.pivot);
    const lo = limb(15, 3.3, 2.7, B, meshes); up.end.add(lo.pivot);
    const hand = sph(3.6, K); lo.end.add(hand);
    return { sh, up, lo, hand };
  };
  const armL = armParts(-1), armR = armParts(1);
  // legs
  const legParts = (side: number) => {
    const hp = new THREE.Group(); hp.position.set(side * 7, -2, 0); hips.add(hp);
    const th = limb(22, 5, 4, A, meshes); hp.add(th.pivot);
    const sn = limb(22, 4, 3, B, meshes); th.end.add(sn.pivot);
    const foot = box(7, 4, 13, K); foot.position.set(0, -1, 3); sn.end.add(foot);
    return { th, sn };
  };
  const legL = legParts(-1), legR = legParts(1);
  const wpn = new THREE.Group(); armR.lo.end.add(wpn); wpn.position.set(0, -1, 0);
  let wpnId = "", wpnMeshes: THREE.Object3D[] = [];
  const setWeapon = (id: string) => {
    if (id === wpnId) return; wpnId = id; for (const o of wpnMeshes) wpn.remove(o); wpnMeshes = [];
    const add = (o: THREE.Object3D) => { wpn.add(o); wpnMeshes.push(o); return o; };
    const steel = std(0xc8d2e4, 0x000000, 0.15, 0.4, 0.15), dark = std(0x27304a, 0, 0, 0.5, 0.6), glowM = std(glowHex, glowHex, 1.6, 0.3, 0);
    const gunBody = (len: number, th: number, color: THREE.Material) => { const b = box(th, th * 1.1, len, color); b.position.z = len / 2 + 2; add(b); return b; };
    if (id === "sword") { const hilt = box(2.4, 2.4, 8, dark); hilt.position.z = 2; add(hilt); const guard = box(10, 1.6, 2, steel); guard.position.z = 6; add(guard); const blade = box(2.6, 2.6, 36, glowM); blade.position.z = 25; add(blade); }
    else if (id === "railgun") { const b = gunBody(34, 4, steel); const r1 = box(1.4, 1.4, 34, glowM); r1.position.set(2.5, 0, 19); add(r1); const r2 = box(1.4, 1.4, 34, glowM); r2.position.set(-2.5, 0, 19); add(r2); void b; }
    else if (id === "minigun") { gunBody(20, 7, dark); for (let i = 0; i < 3; i++) { const b = box(1.8, 1.8, 20, steel); b.position.set(Math.cos(i * 2.1) * 2.4, Math.sin(i * 2.1) * 2.4, 28); add(b); } }
    else if (id === "shotgun") { gunBody(28, 3.6, dark); const b2 = box(3, 3, 26, steel); b2.position.set(0, 3.6, 17); add(b2); }
    else if (id === "bigbeam") { const c = box(9, 9, 22, dark); c.position.z = 12; add(c); const tip = sph(6, glowM); tip.position.z = 26; add(tip); }
    else if (id === "laserrifle") { gunBody(30, 3.4, steel); const m2 = box(2, 2, 6, glowM); m2.position.set(0, 3, 14); add(m2); }
    else { gunBody(22, 4, steel); const m2 = box(2.4, 2.4, 6, glowM); m2.position.set(0, 0, 25); add(m2); }
    wpn.rotation.x = 0;
  };
  setWeapon("pulse");
  const sw = (j: THREE.Group, f: number) => { j.rotation.x = -f * D2R; };       // + = forward (the hero's front is local +z)
  const flashMats = [A, B];
  let lastName = "";
  const update = (s: HeroState) => {
    setWeapon(s.gun);
    root.position.set(s.x, s.y, 0); root.rotation.y = s.face * (Math.PI / 2 - 0.4); root.visible = true;
    const n = s.name, ph = (s.dist / 104) * Math.PI * 2, run = /^run/.test(n), walk = /^walk/.test(n) || run;
    const t01 = clamp01(1 - s.swing / 0.2), ease = Math.sin(t01 * Math.PI * 0.5);
    let lean = 3, headP = 0, hipY = HIP;
    let aLF = 14, aLE = 34, aRF = 10, aRE = 36, lLF = 0, lLK = 0, lRF = 0, lRK = 0, aLS = 0, aRS = 0;
    const br = Math.sin(s.tm * 2.2) * 1.5;
    if (n === "ready" || n === "idle") { aLF = 16 + br; aRF = 12 - br; lean = 3 + br * 0.4; }
    if (walk) { const A0 = run ? 1.7 : 1, sp = Math.sin(ph), cs = Math.cos(ph); lLF = 26 * A0 * sp; lRF = -26 * A0 * sp; lLK = 34 * A0 * Math.max(0, -cs); lRK = 34 * A0 * Math.max(0, cs); aLF = -22 * A0 * sp + 8; aRF = 22 * A0 * sp + 8; aLE = 28 + 22 * A0; aRE = 28 + 22 * A0; lean = run ? 14 : 5; hipY = HIP - Math.abs(sp) * (run ? 3 : 1.6); }
    if (n === "jump") { lLF = 30; lLK = 70; lRF = -10; lRK = 40; aLF = 60; aRF = 50; aLE = 20; aRE = 20; lean = 6; }
    if (n === "jab" || n === "hook" || n === "attack") { aRF = lerp(-20, 92, ease); aRE = lerp(80, 6, ease); aLF = 55; aLE = 100; lean = lerp(-4, 18, ease); lLF = 8; lRF = -14; if (n === "hook") { aRS = 40 * ease; } }
    if (n === "upper") { aRF = lerp(-30, 150, ease); aRE = lerp(110, 10, ease); aLF = 45; aLE = 100; lean = lerp(-6, 8, ease); hipY = HIP - 4 * (1 - ease); lLK = 24 * (1 - ease); lRK = 24 * (1 - ease); }
    if (n === "front" || n === "kick") { lRF = lerp(-20, 85, ease); lRK = lerp(80, 8, ease); lLK = 14; aLF = -20; aRF = 36; aLE = 40; aRE = 60; lean = lerp(2, -10, ease); }
    if (n === "round") { lRF = lerp(-10, 100, ease); lRK = lerp(70, 6, ease); lean = lerp(4, -20, ease); aLF = -30; aRF = 40; aLE = 20; aRE = 20; root.rotation.y += s.face * (ease - 0.4) * 0.9; }
    if (n === "sweep") { lRF = lerp(10, 70, ease); lRK = 10; lLK = 40; lLF = -20; lean = lerp(0, 22, ease); hipY = HIP - 8 * ease; aLF = 30; aRF = 40; }
    if (n === "shoot" || n === "beam") { aRF = 86; aRE = 6; aLF = 70; aLE = 24; lean = 6; lRF = 6; lLF = -6; }
    if (n === "throw") { aRF = lerp(150, 20, ease); aRE = lerp(10, 60, ease); aLF = 30; lean = lerp(-8, 12, ease); }
    if (s.gun === "sword" && s.swing > 0) { aRF = lerp(120, 10, ease); aRE = 20; aRS = lerp(-20, 30, ease); lean = lerp(-6, 16, ease); }
    else if (s.swing > 0 && s.gun !== "sword" && n !== "jab" && n !== "hook" && n !== "upper" && n !== "front" && n !== "round" && n !== "sweep" && n !== "kick") { aRF = 86; aRE = 8; aLF = 66; aLE = 28; lean = 6; wpn.position.z = -2 * (1 - t01); }
    if (n === "down") { root.rotation.x = 0; }
    hips.position.y = hipY; torso.rotation.x = lean * D2R; neck.rotation.x = (headP - lean * 0.5) * D2R;
    sw(armL.sh, aLF); armL.up.end.rotation.x = -aLE * D2R; sw(armR.sh, aRF); armR.up.end.rotation.x = -aRE * D2R; armR.sh.rotation.y = -aRS * D2R * s.face * 0.0 + aRS * D2R * 0.5;
    sw(legL.th.pivot, lLF); legL.sn.pivot.rotation.x = lLK * D2R; sw(legR.th.pivot, lRF); legR.sn.pivot.rotation.x = lRK * D2R;
    wpn.position.z = wpn.position.z * 0.8;
    if (s.dead) { root.rotation.z = -Math.PI / 2 * 0.95; root.position.y = s.y + 8; } else root.rotation.z = 0;
    const blink = s.inv > 0 && Math.floor(s.tm * 20) % 2 === 0;
    for (const m of flashMats) { (m as THREE.MeshStandardMaterial).emissive.setHex(blink ? 0xffffff : 0); (m as THREE.MeshStandardMaterial).emissiveIntensity = blink ? 0.6 : 0; }
    lastName = n; void lastName;
  };
  return { group: root, update, dispose() { for (const g of geos) g.dispose(); for (const m of [A, B, G, K]) m.dispose(); for (const o of meshes) if (o.geometry) o.geometry.dispose(); } };
}

/* ═════════════ monsters ═════════════ */
// type -> [body plan, body colour, accent colour, glow colour]; the colours follow the 2D paintings of each type
const MC: Record<string, [string, string, string, string]> = {
  glowbug: ["crawler", "#0e5a4a", "#1fae8d", "#5affc8"], thornback: ["brute", "#3a1030", "#7a1f5a", "#ff465a"], rustcrawler: ["crawler", "#6a3a1a", "#a8591f", "#ffb04a"], magnet: ["pylon", "#2b3038", "#4a525e", "#ff9a3c"],
  shardling: ["crawler", "#1d5a86", "#7fd0ff", "#eaffff"], frostcaster: ["floater", "#3b8fc4", "#a8e4ff", "#e9ff9a"], magmaling: ["crawler", "#7a1a0a", "#ff7a2a", "#ffd23f"], flarecaster: ["floater", "#4a1208", "#ff7a2a", "#ffe08a"],
  scrapgolem: ["brute", "#2c2638", "#4a4160", "#be96ff"], drone: ["floater", "#38304e", "#6b5f8c", "#ff5a78"], hound: ["hound", "#241c36", "#4a3a6c", "#ff5a78"], mantis: ["mantis", "#1d4a30", "#3fbf7a", "#d9ff7a"],
  brute: ["brute", "#3a2a26", "#8a5a3a", "#ffb04a"], burrower: ["pylon", "#4a3a2a", "#8a6a44", "#ffd070"], swarmer: ["crawler", "#5a2a0a", "#ff9a3a", "#fff08a"], wraith: ["floater", "#241a44", "#6a46cc", "#a0eaff"],
  spitter: ["spitter", "#2f4a1a", "#7aa83a", "#d6ff5a"], eyeball: ["floater", "#46245a", "#a05acc", "#ffe08a"], sporecaster: ["floater", "#2a1a66", "#6a46cc", "#be82ff"],
};
export interface MonState { type: string; x: number; y: number; face: number; hurt: number; tele: number; ph: number; w: number; h: number; speed: number; }
export interface Actor { group: THREE.Group; update(m: any, tm: number): void; dispose(): void; }

export function buildMonster(type: string, w: number, h: number, tint: { glow: string; body: string } | null): Actor {
  const [plan, bodyC0, accC, glowC] = MC[type] || ["floater", "#2a1a66", "#6a46cc", "#be82ff"];
  const bodyC = tint ? tint.body : bodyC0, glowCol = tint ? "rgb(" + tint.glow + ")" : glowC;
  const geos: THREE.BufferGeometry[] = [], mats: THREE.MeshStandardMaterial[] = [];
  const body = (() => { const m = std(bodyC, 0x000000, 0, 0.55, 0.3); mats.push(m); return m; })(), acc = (() => { const m = std(accC, 0x000000, 0, 0.45, 0.3); mats.push(m); return m; })(), gl = std(glowCol, glowCol, 1.7, 0.3, 0);
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) => { geos.push(geo); const o = new THREE.Mesh(geo, m); o.position.set(...p); o.scale.set(...s); return o; };
  const sphere = (r: number) => new THREE.SphereGeometry(r, 12, 9);
  const legs: { p: THREE.Group; a: number }[] = [];
  const addLeg = (x: number, z: number, len: number, a: number, parent: THREE.Object3D, y0: number) => { const p = new THREE.Group(); p.position.set(x, y0, z); const cyl = mesh(new THREE.CylinderGeometry(len * 0.09, len * 0.06, len, 6), acc, [0, -len / 2, 0]); p.add(cyl); parent.add(p); legs.push({ p, a }); };
  let spin: THREE.Object3D | null = null, hover = 0, eyeY = 0;
  if (plan === "crawler") {
    const rr = w * 0.42; inner.add(mesh(sphere(1), body, [0, h * 0.5, 0], [rr, h * 0.42, rr * 0.85]));
    inner.add(mesh(sphere(1), acc, [-rr * 0.15, h * 0.72, 0], [rr * 0.6, h * 0.18, rr * 0.5]));
    for (const e of [-1, 1]) inner.add(mesh(sphere(h * 0.09), gl, [rr * 0.85, h * 0.58, e * rr * 0.28]));
    for (let i = 0; i < 6; i++) addLeg((i % 3 - 1) * rr * 0.55, (i < 3 ? 1 : -1) * rr * 0.62, h * 0.5, i % 2 ? 1 : -1, inner, h * 0.3);
    for (let i = 0; i < 4; i++) inner.add(mesh(sphere(h * 0.05), gl, [-rr * 0.6 + i * rr * 0.4, h * 0.82, 0]));
  } else if (plan === "brute") {
    const bw = w * 0.62; inner.add(mesh(new THREE.BoxGeometry(1, 1, 1), body, [0, h * 0.5, 0], [bw, h * 0.52, bw * 0.7]));
    inner.add(mesh(sphere(1), acc, [bw * 0.18, h * 0.86, 0], [bw * 0.3, h * 0.16, bw * 0.28]));
    for (const e of [-1, 1]) { inner.add(mesh(new THREE.CylinderGeometry(w * 0.09, w * 0.07, h * 0.5, 7), acc, [bw * 0.62, h * 0.5, e * bw * 0.34])); inner.add(mesh(sphere(w * 0.1), body, [bw * 0.62, h * 0.22, e * bw * 0.34])); }
    for (const e of [-1, 1]) inner.add(mesh(new THREE.CylinderGeometry(w * 0.12, w * 0.1, h * 0.28, 7), acc, [0, h * 0.14, e * bw * 0.22]));
    for (let i = 0; i < 5; i++) inner.add(mesh(new THREE.ConeGeometry(w * 0.06, h * 0.26, 5), acc, [-bw * 0.4 + i * bw * 0.2, h * 0.8 + Math.abs(i - 2) * -h * 0.03, -bw * 0.2], [1, 1, 1]));
    for (const e of [-1, 1]) inner.add(mesh(sphere(h * 0.05), gl, [bw * 0.6, h * 0.88, e * bw * 0.1]));
    inner.add(mesh(new THREE.BoxGeometry(1, 1, 1), gl, [bw * 0.52, h * 0.55, 0], [bw * 0.04, h * 0.12, bw * 0.4]));
  } else if (plan === "hound") {
    const L = w * 0.8; inner.add(mesh(sphere(1), body, [0, h * 0.6, 0], [L * 0.5, h * 0.3, L * 0.18]));
    inner.add(mesh(new THREE.ConeGeometry(L * 0.12, L * 0.34, 5).rotateZ(-Math.PI / 2), acc, [L * 0.58, h * 0.66, 0]));
    for (const e of [-1, 1]) inner.add(mesh(sphere(h * 0.045), gl, [L * 0.5, h * 0.74, e * L * 0.06]));
    inner.add(mesh(new THREE.ConeGeometry(L * 0.05, L * 0.4, 5).rotateZ(Math.PI / 2.4), acc, [-L * 0.55, h * 0.78, 0]));
    for (let i = 0; i < 4; i++) addLeg((i % 2 ? 1 : -1) * L * 0.3, (i < 2 ? 1 : -1) * L * 0.1, h * 0.6, i % 3 === 0 ? 1 : -1, inner, h * 0.55);
  } else if (plan === "mantis") {
    inner.add(mesh(sphere(1), body, [0, h * 0.5, 0], [w * 0.2, h * 0.34, w * 0.18])); inner.add(mesh(sphere(1), acc, [w * 0.04, h * 0.9, 0], [w * 0.17, h * 0.1, w * 0.15]));
    for (const e of [-1, 1]) { inner.add(mesh(new THREE.ConeGeometry(w * 0.05, h * 0.5, 4), gl, [w * 0.34, h * 0.62, e * w * 0.2], [1, 1, 1])); inner.add(mesh(sphere(h * 0.04), gl, [w * 0.18, h * 0.92, e * w * 0.07])); }
    for (let i = 0; i < 4; i++) addLeg((i % 2 ? 1 : -1) * w * 0.1, (i < 2 ? 1 : -1) * w * 0.12, h * 0.46, i % 2 ? 1 : -1, inner, h * 0.26);
  } else if (plan === "pylon") {
    inner.add(mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.55, h * 0.12, 8), acc, [0, h * 0.06, 0])); inner.add(mesh(new THREE.CylinderGeometry(w * 0.2, w * 0.28, h * 0.62, 8), body, [0, h * 0.4, 0]));
    const ring = mesh(new THREE.TorusGeometry(w * 0.4, w * 0.05, 6, 16), gl, [0, h * 0.78, 0]); inner.add(ring); spin = ring; inner.add(mesh(sphere(w * 0.14), gl, [0, h * 0.78, 0]));
  } else if (plan === "spitter") {
    inner.add(mesh(sphere(1), body, [0, h * 0.42, 0], [w * 0.5, h * 0.4, w * 0.4])); inner.add(mesh(sphere(1), acc, [w * 0.3, h * 0.55, 0], [w * 0.26, h * 0.22, w * 0.28]));
    for (const e of [-1, 1]) { inner.add(mesh(sphere(h * 0.1), gl, [w * 0.4, h * 0.78, e * w * 0.14])); addLeg(-w * 0.2, e * w * 0.3, h * 0.35, e, inner, h * 0.2); }
    for (let i = 0; i < 4; i++) inner.add(mesh(sphere(h * 0.06), gl, [-w * 0.2 + i * w * 0.12, h * 0.8, 0]));
  } else {   // floater
    hover = h * 0.5; const r = Math.min(w, h) * 0.34; eyeY = hover;
    inner.add(mesh(new THREE.IcosahedronGeometry(r, 0), body, [0, hover, 0])); inner.add(mesh(new THREE.IcosahedronGeometry(r * 0.62, 0), acc, [0, hover, 0]));
    inner.add(mesh(sphere(r * 0.34), gl, [r * 0.62, hover, 0]));
    const ring = mesh(new THREE.TorusGeometry(r * 1.5, r * 0.08, 5, 18).rotateX(Math.PI / 2.4), gl, [0, hover, 0]); inner.add(ring); spin = ring;
    for (let i = 0; i < 3; i++) inner.add(mesh(sphere(r * 0.16), gl, [Math.cos(i * 2.1) * r * 1.5, hover + Math.sin(i * 2.1) * r * 0.5, Math.sin(i * 2.1) * r * 1.5]));
  }
  const update = (m: any, tm: number) => {
    g.position.set(m.x, m.y, 0); g.rotation.y = (m.face >= 0 ? 1 : -1) * (Math.PI / 2 - 0.35);
    const ph = m.ph || 0; inner.position.y = (hover ? Math.sin(tm * 2.4 + ph) * 6 : Math.abs(Math.sin(tm * 5 + ph)) * 1.4);
    for (const l of legs) l.p.rotation.x = Math.sin(tm * 11 + ph + l.a * 1.9) * 0.6 * l.a;
    if (spin) spin.rotation.z += 0.04, spin.rotation.y += 0.02;
    const hit = m.hurt > 0, warn = m.tele > 0, pulse = warn ? 1 + Math.sin(tm * 40) * 0.07 : 1;
    inner.scale.set(pulse, pulse, pulse);
    for (const mt of mats) { mt.emissive.setHex(hit ? 0xffffff : warn ? 0xff2030 : 0x000000); mt.emissiveIntensity = hit ? 0.9 : warn ? 0.55 : 0; }
    void eyeY;
  };
  return { group: g, update, dispose() { for (const o of geos) o.dispose(); for (const m of [...mats, gl]) m.dispose(); } };
}

/** The end-of-map guardian: a big armoured brute with horns and a lit core, in the planet's colours. */
export function buildBoss(P: any): Actor {
  const a = buildMonster("brute", 150, 130, { glow: P.glow, body: "#1c2436" }); const glow = rgbc(P.glow);
  const g = a.group, horns: THREE.Mesh[] = [], gm = std(glow, glow, 1.8, 0.3, 0), dm = std(0x10131c, 0, 0, 0.5, 0.6);
  for (const e of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(8, 54, 6), dm); h.position.set(40, 120, e * 26); h.rotation.z = -0.5; g.add(h); horns.push(h); }
  const core = new THREE.Mesh(new THREE.SphereGeometry(13, 14, 10), gm); core.position.set(52, 70, 0); g.add(core);
  for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(6, 34, 5), dm); sp.position.set(-30 + i * 10, 125 + Math.abs(i - 2.5) * -5, -26); g.add(sp); horns.push(sp); }
  g.scale.set(1.5, 1.5, 1.5);
  return { group: g, update(b, tm) { a.update({ x: b.x, y: b.y || 0, face: b.face, hurt: b.hurt, tele: b.tele, ph: 0 }, tm); core.scale.setScalar(1 + Math.sin(tm * 3) * 0.12 + (b.tele > 0 ? 0.25 : 0)); }, dispose() { a.dispose(); gm.dispose(); dm.dispose(); for (const h of horns) h.geometry.dispose(); core.geometry.dispose(); } };
}

/** The pet: a round body, two ears and a glowing eye, bobbing behind the hero. */
export function buildPet(colHex: string): Actor {
  const body = std(colHex, colHex, 0.25, 0.5, 0.2), eye = std(0xffffff, 0xffffff, 1.4, 0.3, 0), geos: THREE.BufferGeometry[] = [], g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], s: [number, number, number] = [1, 1, 1]) => { geos.push(geo); const o = new THREE.Mesh(geo, m); o.position.set(...p); o.scale.set(...s); g.add(o); return o; };
  add(new THREE.SphereGeometry(13, 12, 9), body, [0, 14, 0], [1.1, 0.9, 1]); for (const e of [-1, 1]) add(new THREE.ConeGeometry(4, 12, 5), body, [3, 30, e * 6]); add(new THREE.SphereGeometry(2.6, 8, 6), eye, [11, 17, 4]); add(new THREE.SphereGeometry(2.6, 8, 6), eye, [11, 17, -4]);
  return { group: g, update(p, tm) { g.position.set(p.x, p.y + Math.abs(Math.sin(tm * 6)) * 4, 6); g.rotation.y = (p.face >= 0 ? 1 : -1) * (Math.PI / 2 - 0.4); }, dispose() { for (const o of geos) o.dispose(); body.dispose(); eye.dispose(); } };
}
