/* Alien Hunt simulation (plan 38, phases A-D + the tune-up clock of E2). Pure: no three.js, no DOM, no storage, so scripts/smoke-alien-hunt.mjs runs the real file.
   Units are metres on the x/z plane, y is up; the player's eyes are 1.65 m above the floor. */

export type Box = { x: number; z: number; w: number; d: number; h: number };
export type WeaponId = "pistol" | "rifle" | "shotgun" | "launcher" | "laser" | "rail" | "arc" | "beam";
export type AlienKind = "skitter" | "mantis" | "spitter" | "flarecaster" | "charger" | "skyeye";
export type Enemy = { id: number; kind: AlienKind; x: number; z: number; hp: number; max: number; yaw: number; t: number; cd: number; dead: number; flash: number; leap: number; side?: number; sideT?: number; gt?: number; tele?: number; rush?: number; stun?: number; dx?: number; dz?: number };
export type Acid = { id: number; x: number; y: number; z: number; vx: number; vz: number; vy: number; life: number; g?: number; dmg?: number; big?: number; col?: number };
export type Ev = { k: "shot" | "hit" | "kill" | "head" | "hurt" | "reload" | "empty" | "spit" | "wave" | "tune" | "win" | "lose" | "swap"; x?: number; y?: number; z?: number; n?: number; w?: string; p?: number[] };

export const ARENA = 34;   // half size
export const EYE = 1.65;
export const WEAPONS: Record<WeaponId, { name: string; dmg: number; rate: number; mag: number; reserve: number; spread: number; pellets: number; auto: boolean; reload: number; range: number; kick: number; col: number }> = {
  pistol: { name: "Pulse sidearm", dmg: 22, rate: 0.26, mag: 12, reserve: 9999, spread: 0.004, pellets: 1, auto: false, reload: 1.1, range: 80, kick: 0.012, col: 0x58e8ff },
  rifle: { name: "Plasma rifle", dmg: 12, rate: 0.085, mag: 30, reserve: 150, spread: 0.012, pellets: 1, auto: true, reload: 1.6, range: 90, kick: 0.006, col: 0x7affb0 },
  shotgun: { name: "Ion scatter", dmg: 10, rate: 0.85, mag: 6, reserve: 36, spread: 0.07, pellets: 8, auto: false, reload: 2.2, range: 26, kick: 0.05, col: 0xc77aff },
  launcher: { name: "Plasma launcher", dmg: 0, rate: 1.1, mag: 4, reserve: 8, spread: 0, pellets: 0, auto: false, reload: 2.6, range: 60, kick: 0.07, col: 0x66ffb0 },
  laser: { name: "Laser SMG", dmg: 8, rate: 0.055, mag: 45, reserve: 180, spread: 0.01, pellets: 1, auto: true, reload: 1.5, range: 90, kick: 0.003, col: 0xff4a5a },
  rail: { name: "Rail cannon", dmg: 80, rate: 1.0, mag: 5, reserve: 25, spread: 0, pellets: 1, auto: false, reload: 2.0, range: 120, kick: 0.06, col: 0xa8c8ff },
  arc: { name: "Arc caster", dmg: 24, rate: 0.35, mag: 18, reserve: 72, spread: 0, pellets: 0, auto: true, reload: 1.8, range: 30, kick: 0.01, col: 0x9ad8ff },
  beam: { name: "Photon lance", dmg: 5, rate: 0.04, mag: 90, reserve: 270, spread: 0.002, pellets: 1, auto: true, reload: 2.2, range: 70, kick: 0.002, col: 0xffe45a },
};
export const ALIENS: Record<AlienKind, { name: string; hp: number; speed: number; r: number; dmg: number; reach: number; score: number; hy: number; cy?: number; nohead?: boolean }> = {
  skitter: { name: "Skitter", hp: 26, speed: 6.2, r: 0.5, dmg: 6, reach: 1.15, score: 50, hy: 0.55 },
  mantis: { name: "Drone Mantis", hp: 95, speed: 3.4, r: 0.7, dmg: 17, reach: 1.8, score: 150, hy: 1.55 },
  spitter: { name: "Spitter", hp: 62, speed: 2.6, r: 0.65, dmg: 11, reach: 0, score: 120, hy: 1.35 },
  flarecaster: { name: "Flarecaster", hp: 85, speed: 2.9, r: 0.7, dmg: 0, reach: 0, score: 180, hy: 1.6 },
  charger: { name: "Plated Charger", hp: 170, speed: 3.0, r: 0.9, dmg: 24, reach: 1.7, score: 230, hy: 1.1, nohead: true },
  skyeye: { name: "Sky Eye", hp: 58, speed: 2.4, r: 0.75, dmg: 0, reach: 0, score: 170, hy: 3.2, cy: 2.6, nohead: true },
};
/** the aliens are human-sized or bigger (owner, 2026-10-18: "as big as a person, scarier"): the table above is the small design, this scales every body and its hit box */
export const ALIEN_SCALE: Record<AlienKind, number> = { skitter: 1.9, mantis: 1.3, spitter: 1.3, flarecaster: 1.2, charger: 1.55, skyeye: 1.3 };
for (const k of Object.keys(ALIENS) as AlienKind[]) { const A = ALIENS[k], f = ALIEN_SCALE[k]; A.r *= f; A.hy *= f; if (A.cy !== undefined) A.cy *= f; if (A.reach > 0) A.reach *= f; }
export const bodyY = (k: AlienKind) => { const A = ALIENS[k]; return A.cy !== undefined ? A.cy : A.hy * 0.62; };
export const WAVES: AlienKind[][] = [
  ["skitter", "skitter", "skitter"],
  ["skitter", "skitter", "skitter", "mantis"],
  ["mantis", "skitter", "mantis", "skitter", "flarecaster"],
  ["charger", "skyeye", "spitter", "skitter", "skitter", "mantis"],
  ["charger", "flarecaster", "mantis", "mantis", "skyeye", "spitter", "skitter", "skitter"],
];
export const LEVEL_BOXES: Box[] = [
  { x: -8, z: -6, w: 4, d: 2.2, h: 1.3 }, { x: 9, z: -9, w: 2.2, d: 5, h: 1.3 }, { x: 0, z: 8, w: 6, d: 1.6, h: 1.2 },
  { x: -15, z: 7, w: 2.4, d: 2.4, h: 2.6 }, { x: 15, z: 6, w: 2.4, d: 2.4, h: 2.6 }, { x: -3, z: -17, w: 8, d: 1.4, h: 1.2 },
  { x: 20, z: -18, w: 3, d: 3, h: 1.8 }, { x: -22, z: -14, w: 3, d: 3, h: 1.8 }, { x: 4, z: 20, w: 3, d: 2, h: 1.3 }, { x: -12, z: 22, w: 5, d: 1.6, h: 1.3 },
];

export type State = {
  auto: boolean; autoSide: number; autoT: number; autoMv: number; autoPx: number; autoPz: number;
  t: number; active: number; rng: number; seed: number;
  p: { x: number; z: number; yaw: number; pitch: number; y: number; vy: number; hp: number; shield: number; inv: number; sprint: boolean; slide: number; slideCd: number; sdx: number; sdz: number };
  weapon: WeaponId; ammo: Record<WeaponId, { mag: number; res: number }>; cd: number; reload: number; recoil: number;
  enemies: Enemy[]; acid: Acid[]; rk: Acid[]; boxes: Box[]; pk: { id: number; x: number; z: number; w: WeaponId | "ammo" }[]; owned: Record<WeaponId, boolean>;
  wave: number; waveLeft: number; between: number; spawnQ: AlienKind[]; spawnT: number; done: boolean; won: boolean;
  kills: number; heads: number; shots: number; hitsLanded: number; score: number; streak: number; best: number;
  tuneEvery: number; tuneT: number; frozen: boolean; grace: number; tunes: number; tuneRight: number; tuneStreak: number; boost: number;
  nextId: number; ev: Ev[];
};

export function mulberry(s: number) { return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function newState(seed = 7, tuneEvery = 30): State {
  const ammo: any = {}; for (const k of Object.keys(WEAPONS) as WeaponId[]) ammo[k] = { mag: WEAPONS[k].mag, res: WEAPONS[k].reserve };
  return {
    t: 0, active: 0, rng: seed, seed, auto: false, autoSide: 1, autoT: 0, autoMv: 0, autoPx: 0, autoPz: 22,
    p: { x: 0, z: 22, yaw: Math.PI, pitch: 0, y: 0, vy: 0, hp: 100, shield: 0, inv: 0, sprint: false, slide: 0, slideCd: 0, sdx: 0, sdz: 0 },
    weapon: "rifle", ammo, cd: 0, reload: 0, recoil: 0,
    enemies: [], acid: [], rk: [], boxes: LEVEL_BOXES, pk: [], owned: { pistol: true, rifle: true, shotgun: false, launcher: false, laser: false, rail: false, arc: false, beam: false },
    wave: 0, waveLeft: 0, between: 3, spawnQ: [], spawnT: 0, done: false, won: false,
    kills: 0, heads: 0, shots: 0, hitsLanded: 0, score: 0, streak: 0, best: 0,
    tuneEvery, tuneT: 0, frozen: false, grace: 0, tunes: 0, tuneRight: 0, tuneStreak: 0, boost: 0,
    nextId: 1, ev: [],
  };
}
const rnd = (s: State) => { const r = mulberry(s.rng); const v = r(); s.rng = (s.rng * 1664525 + 1013904223) | 0; return v; };

/** circle vs boxes + arena wall, pushes (x, z) out */
export function collide(boxes: Box[], x: number, z: number, r: number): [number, number] {
  const L = ARENA - r; x = Math.max(-L, Math.min(L, x)); z = Math.max(-L, Math.min(L, z));
  for (const b of boxes) {
    const hx = b.w / 2, hz = b.d / 2; const cx = Math.max(b.x - hx, Math.min(x, b.x + hx)), cz = Math.max(b.z - hz, Math.min(z, b.z + hz));
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; x += dx * k; z += dz * k; }
      else { const ox = hx + r - Math.abs(x - b.x), oz = hz + r - Math.abs(z - b.z); if (ox < oz) x += (x >= b.x ? 1 : -1) * ox; else z += (z >= b.z ? 1 : -1) * oz; }
    }
  }
  return [x, z];
}

/** ray vs a vertical box (slab method), returns distance or Infinity */
function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Box): number {
  let t0 = 0, t1 = Infinity;
  const slab = (o: number, d: number, lo: number, hi: number) => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const x = a; a = c; c = x; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; return t0 <= t1;
  };
  if (!slab(ox, dx, b.x - b.w / 2, b.x + b.w / 2) || !slab(oy, dy, 0, b.h) || !slab(oz, dz, b.z - b.d / 2, b.z + b.d / 2)) return Infinity;
  return t0;
}
function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number): number {
  const mx = ox - cx, my = oy - cy, mz = oz - cz, b = mx * dx + my * dy + mz * dz, c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return Infinity; const disc = b * b - c; if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc); return t < 0 ? 0 : t;
}

export type Input = { mx: number; mz: number; lookX: number; lookY: number; fire: boolean; jump: boolean; reload: boolean; swap: number; sprint: boolean; slide?: boolean };
export const noInput = (): Input => ({ mx: 0, mz: 0, lookX: 0, lookY: 0, fire: false, jump: false, reload: false, swap: 0, sprint: false });

export const WORDER: WeaponId[] = ["pistol", "rifle", "laser", "shotgun", "arc", "beam", "rail", "launcher"];
export function setWeapon(s: State, w: WeaponId) { if (s.weapon === w || !s.owned[w]) return; s.weapon = w; s.reload = 0; s.cd = 0.25; s.ev.push({ k: "swap", w }); }
function startReload(s: State) { const a = s.ammo[s.weapon], W = WEAPONS[s.weapon]; if (s.reload > 0 || a.mag >= W.mag || a.res <= 0) return; s.reload = W.reload; s.ev.push({ k: "reload" }); }
export function fullReload(s: State) { for (const k of Object.keys(WEAPONS) as WeaponId[]) { s.ammo[k].mag = WEAPONS[k].mag; s.ammo[k].res = Math.max(s.ammo[k].res, WEAPONS[k].mag * 2); } s.reload = 0; }

function spawnAlien(s: State, kind: AlienKind) {
  const A = ALIENS[kind]; let x = 0, z = 0;
  for (let i = 0; i < 12; i++) {   // on the arena edge, away from the player
    const a = rnd(s) * Math.PI * 2; x = Math.cos(a) * (ARENA - 2); z = Math.sin(a) * (ARENA - 2);
    if (Math.hypot(x - s.p.x, z - s.p.z) > 18) break;
  }
  const [cx, cz] = collide(s.boxes, x, z, A.r);
  s.ev.push({ k: "spawn", w: kind, x: cx, z: cz });
  s.enemies.push({ id: s.nextId++, kind, x: cx, z: cz, hp: A.hp * (1 + s.wave * 0.06), max: A.hp * (1 + s.wave * 0.06), yaw: 0, t: rnd(s) * 6, cd: 0.8 + rnd(s), dead: 0, flash: 0, leap: 0 });
}

const BOOM_R = 4.6;
function explode(s: State, x: number, y: number, z: number) {
  s.ev.push({ k: "boom", x, y, z }); s.shots += 0;
  let any = false;
  for (const e of s.enemies) {
    if (e.dead !== 0) continue; const d = Math.hypot(e.x - x, e.z - z); if (d > BOOM_R + ALIENS[e.kind].r) continue;
    const dmg = 130 * Math.max(0.25, 1 - d / (BOOM_R + 1)) * (1 + s.boost); e.hp -= dmg; e.flash = 0.15; any = true; s.ev.push({ k: "hit", x: e.x, y: 1, z: e.z, n: dmg });
    if (e.hp <= 0) { e.dead = 0.9; s.kills++; s.streak++; s.best = Math.max(s.best, s.streak); s.score += Math.round(ALIENS[e.kind].score * (1 + Math.min(s.streak, 10) * 0.1)); s.ev.push({ k: "kill", x: e.x, z: e.z, w: e.kind }); }
  }
  if (any) s.hitsLanded++;
  const dp = Math.hypot(s.p.x - x, s.p.z - z); if (dp < BOOM_R * 0.7) hurtPlayer(s, 18 * (1 - dp / (BOOM_R * 0.7)) + 4, x, z);
}
function hurtPlayer(s: State, n: number, x?: number, z?: number) {
  if (s.p.inv > 0 || s.done) return;
  let d = n; if (s.p.shield > 0) { const a = Math.min(s.p.shield, d); s.p.shield -= a; d -= a; }
  s.p.hp = Math.max(0, s.p.hp - d); s.p.inv = 0.35; s.streak = 0; s.ev.push({ k: "hurt", x, z, n });
  if (s.p.hp <= 0) { s.done = true; s.won = false; s.ev.push({ k: "lose" }); }
}

export function spawnPickup(s: State, w: WeaponId | "ammo", nearX?: number, nearZ?: number) {
  for (let i = 0; i < 20; i++) {
    const x = nearX !== undefined ? (nearX as number) + (rnd(s) - 0.5) * 2 : (rnd(s) - 0.5) * 50, z = nearZ !== undefined ? (nearZ as number) + (rnd(s) - 0.5) * 2 : (rnd(s) - 0.5) * 50;
    const [cx, cz] = collide(s.boxes, x, z, 0.6); if (Math.hypot(cx - x, cz - z) > 0.01 && nearX === undefined) continue;
    if (nearX === undefined && Math.hypot(cx - s.p.x, cz - s.p.z) < 6) continue;
    s.pk.push({ id: s.nextId++, x: cx, z: cz, w }); return;
  }
}
const unowned = (s: State) => WORDER.filter(w => !s.owned[w]);
/** one hit on an alien: damage, kill bookkeeping and a chance to drop something to pick up */
function hurtAlien(s: State, e: Enemy, dmg: number, head: boolean, hy?: number) {
  const A = ALIENS[e.kind]; e.hp -= dmg; e.flash = 0.12; s.ev.push({ k: "hit", x: e.x, y: hy !== undefined ? hy : bodyY(e.kind), z: e.z, n: dmg });
  if (e.hp <= 0 && e.dead === 0) {
    e.dead = 0.9; s.kills++; s.streak++; s.best = Math.max(s.best, s.streak); if (head) s.heads++;
    s.score += Math.round(A.score * (head ? 1.5 : 1) * (1 + Math.min(s.streak, 10) * 0.1)); s.ev.push({ k: head ? "head" : "kill", x: e.x, z: e.z, w: e.kind });
    const r = rnd(s), un = unowned(s);
    if (un.length && r < 0.2) spawnPickup(s, un[Math.floor(rnd(s) * un.length)], e.x, e.z); else if (r < 0.32) spawnPickup(s, "ammo", e.x, e.z);
  }
}
function fire(s: State) {
  const W = WEAPONS[s.weapon], a = s.ammo[s.weapon];
  if (a.mag <= 0) { s.ev.push({ k: "empty" }); if (a.res <= 0) { setWeapon(s, "pistol"); return; } startReload(s); s.cd = 0.25; return; }
  a.mag--; s.cd = W.rate; s.shots++; s.recoil = Math.min(1, s.recoil + W.kick * 14); s.ev.push({ k: "shot", w: s.weapon });
  const cp = Math.cos(s.p.pitch), ox = s.p.x, oy = EYE + s.p.y, oz = s.p.z;
  if (s.weapon === "launcher") {
    const dx = -Math.sin(s.p.yaw) * cp, dy = Math.sin(s.p.pitch), dz = -Math.cos(s.p.yaw) * cp, V = 26;
    s.rk.push({ id: s.nextId++, x: ox + dx * 0.8, y: oy - 0.1 + dy * 0.8, z: oz + dz * 0.8, vx: dx * V, vy: dy * V, vz: dz * V, life: 3.2 }); return;
  }
  if (s.weapon === "arc") {   // chain lightning: the alien nearest the crosshair, then up to three more near it
    const ax = -Math.sin(s.p.yaw) * cp, ay = Math.sin(s.p.pitch), az = -Math.cos(s.p.yaw) * cp; const hit: Enemy[] = [];
    let first: Enemy | null = null, fb = 0.4;
    for (const e of s.enemies) { if (e.dead !== 0) continue; const vx = e.x - ox, vy = bodyY(e.kind) - oy, vz = e.z - oz, d = Math.hypot(vx, vy, vz); if (d > W.range || d < 0.1) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (vx * ax + vy * ay + vz * az) / d))); if (ang < fb) { fb = ang; first = e; } }
    const pts = [ox, oy - 0.15, oz];
    if (first) { hit.push(first); for (let k = 0; k < 3; k++) { const last = hit[hit.length - 1]; let nx: Enemy | null = null, nd = 7; for (const e of s.enemies) if (e.dead === 0 && !hit.includes(e)) { const d = Math.hypot(e.x - last.x, e.z - last.z); if (d < nd) { nd = d; nx = e; } } if (!nx) break; hit.push(nx); } }
    else pts.push(ox + ax * 9, oy + ay * 9 - 0.15, oz + az * 9);
    hit.forEach((e, i) => { pts.push(e.x, bodyY(e.kind), e.z); hurtAlien(s, e, W.dmg * Math.pow(0.75, i) * (1 + s.boost), false); }); if (hit.length) s.hitsLanded++;
    s.ev.push({ k: "arc", p: pts }); return;
  }
  const moving = 1 + s.recoil * 0.9;
  let landed = false;
  if (s.weapon === "rail") {   // pierces everything on the line
    const dx = -Math.sin(s.p.yaw) * cp, dy = Math.sin(s.p.pitch), dz = -Math.cos(s.p.yaw) * cp;
    let wall = W.range; for (const b of s.boxes) { const t = rayBox(ox, oy, oz, dx, dy, dz, b); if (t < wall) wall = t; } if (dy < 0) { const tg = -oy / dy; if (tg < wall) wall = tg; }
    const list: [Enemy, boolean][] = [];
    for (const e of s.enemies) { if (e.dead !== 0) continue; const A = ALIENS[e.kind]; const tb = raySphere(ox, oy, oz, dx, dy, dz, e.x, bodyY(e.kind), e.z, A.r * 1.05), th = A.nohead ? Infinity : raySphere(ox, oy, oz, dx, dy, dz, e.x, A.hy + 0.5 * A.r * 1.1, e.z, A.r * 0.5); if (Math.min(tb, th) < wall) list.push([e, th < tb]); }
    for (const [e, hd] of list) { hurtAlien(s, e, W.dmg * (hd ? 2.0 : 1) * (1 + s.boost) * (e.kind === "charger" ? ((e.rush || 0) > 0 || (e.stun || 0) > 0 ? 1.8 : 0.7) : 1), hd, hd ? ALIENS[e.kind].hy + 0.5 : undefined); landed = true; }
    if (landed) s.hitsLanded++; if (a.mag <= 0 && a.res > 0) startReload(s); return;
  }
  for (let i = 0; i < W.pellets; i++) {
    const sp = W.spread * moving, yaw = s.p.yaw + (rnd(s) - 0.5) * 2 * sp, pit = s.p.pitch + (rnd(s) - 0.5) * 2 * sp;
    const dx = -Math.sin(yaw) * Math.cos(pit), dy = Math.sin(pit), dz = -Math.cos(yaw) * Math.cos(pit);
    let wall = W.range; for (const b of s.boxes) { const t = rayBox(ox, oy, oz, dx, dy, dz, b); if (t < wall) wall = t; }
    if (dy < 0) { const tg = -oy / dy; if (tg < wall) wall = tg; }
    let best: Enemy | null = null, bt = wall, head = false;
    for (const e of s.enemies) {
      if (e.dead !== 0) continue; const A = ALIENS[e.kind];
      const tb = raySphere(ox, oy, oz, dx, dy, dz, e.x, bodyY(e.kind), e.z, A.r * 1.05);
      const th = A.nohead ? Infinity : raySphere(ox, oy, oz, dx, dy, dz, e.x, A.hy + 0.5 * A.r * 1.1, e.z, A.r * 0.5);
      if (th < bt) { bt = th; best = e; head = true; } else if (tb < bt) { bt = tb; best = e; head = false; }
    }
    if (best) {
      const fall = Math.max(0.55, 1 - bt / (W.range * 1.4)); const dmg = W.dmg * fall * (head ? 2.2 : 1) * (1 + s.boost) * (best.kind === "charger" ? ((best.rush || 0) > 0 || (best.stun || 0) > 0 ? 1.8 : 0.55) : 1);
      landed = true; hurtAlien(s, best, dmg, head, head ? ALIENS[best.kind].hy + 0.5 : undefined);
    }
  }
  if (landed) s.hitsLanded++;
  if (a.mag <= 0 && a.res > 0) startReload(s);
}

/** one fixed step (call with dt <= 0.05). A frozen game (a music question is open) does nothing at all. */
/** Auto-walk (owner, 2026-10-18: "one tap and it controls all the movement, I only shoot"): keeps 8-12 m from the nearest alien, circles it, backs off when it comes close,
    picks up crates when nothing is near, stays off the walls, and slides away from incoming fire or a charging beetle. Returns local stick values (mz > 0 forward, mx > 0 right). */
function autoMove(s: State, dt: number): { mx: number; mz: number; slide: boolean } {
  const p = s.p; s.autoT += dt;
  // stuck detection: flip the circling direction when we are not getting anywhere
  s.autoMv += Math.hypot(p.x - s.autoPx, p.z - s.autoPz); s.autoPx = p.x; s.autoPz = p.z;
  let wx = 0, wz = 0, slide = false;
  const alive = s.enemies.filter(e => e.dead === 0);
  let near: Enemy | null = null, nd = 1e9; for (const e of alive) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < nd) { nd = d; near = e; } }
  let pk: { x: number; z: number } | null = null, pd = 1e9; for (const k of s.pk) { const d = Math.hypot(k.x - p.x, k.z - p.z); if (d < pd) { pd = d; pk = k; } }
  if (s.autoT > 0.6) { if (s.autoMv < 0.25) s.autoSide = -s.autoSide; s.autoMv = 0; s.autoT = (s.autoT > 3 ? 0 : s.autoT - 0.6) ; if (rnd(s) < 0.12) s.autoSide = -s.autoSide; }
  if (pk && pd < 28 && (!near || nd > 6)) { wx = (pk.x - p.x) / pd; wz = (pk.z - p.z) / pd; }
  else if (near) {
    const tx = (near.x - p.x) / (nd || 1), tz = (near.z - p.z) / (nd || 1), sx = -tz * s.autoSide, sz = tx * s.autoSide;
    if (nd < 7) { wx = -tx * 0.9 + sx * 0.5; wz = -tz * 0.9 + sz * 0.5; }
    else if (nd > 13) { wx = tx * 0.8 + sx * 0.5; wz = tz * 0.8 + sz * 0.5; }
    else { wx = sx + tx * (nd - 10) * 0.05; wz = sz + tz * (nd - 10) * 0.05; }
  } else if (Math.hypot(p.x, p.z) > 10) { const d = Math.hypot(p.x, p.z); wx = -p.x / d * 0.6; wz = -p.z / d * 0.6; }
  const edge = ARENA - 5; if (Math.abs(p.x) > edge) wx -= Math.sign(p.x) * 1.2; if (Math.abs(p.z) > edge) wz -= Math.sign(p.z) * 1.2;
  for (const a of s.acid) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < 6 && p.slideCd <= 0) slide = true; }
  for (const e of alive) if (e.kind === "charger" && (e.rush || 0) > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 9 && p.slideCd <= 0) slide = true;
  const L = Math.hypot(wx, wz); if (L > 1) { wx /= L; wz /= L; }
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  return { mx: wx * rx + wz * rz, mz: wx * fx + wz * fz, slide };
}
export function step(s: State, dt: number, inp: Input) {
  if (s.done || s.frozen) return;
  s.t += dt;
  if (s.grace > 0) { s.grace -= dt; s.p.inv = Math.max(s.p.inv, 0.05); }
  const p = s.p;
  if (s.auto && Math.abs(inp.mx) + Math.abs(inp.mz) < 0.1) { const a = autoMove(s, dt); inp = { ...inp, mx: a.mx, mz: a.mz, slide: !!inp.slide || a.slide }; }
  // look
  p.yaw -= inp.lookX; p.pitch = Math.max(-1.3, Math.min(1.3, p.pitch - inp.lookY));
  // move
  const sp = (inp.sprint ? 7.4 : 5.0) * (s.reload > 0 ? 0.9 : 1); p.sprint = inp.sprint;
  let fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let vx = (fx * inp.mz + rx * inp.mx), vz = (fz * inp.mz + rz * inp.mx); const L = Math.hypot(vx, vz); if (L > 1) { vx /= L; vz /= L; }
  p.slideCd = Math.max(0, p.slideCd - dt);
  if (inp.slide && p.slideCd <= 0 && p.slide <= 0 && p.y <= 0.01) { p.slide = 0.55; p.slideCd = 1.3; const ml = Math.hypot(vx, vz); p.sdx = ml > 0.1 ? vx / ml : fx; p.sdz = ml > 0.1 ? vz / ml : fz; s.ev.push({ k: "slide" }); }
  if (p.slide > 0) { const k = 11 * (0.4 + 0.6 * (p.slide / 0.55)); vx = p.sdx * k / sp; vz = p.sdz * k / sp; p.slide = Math.max(0, p.slide - dt); }
  const [nx, nz] = collide(s.boxes, p.x + vx * sp * dt, p.z + vz * sp * dt, 0.4); p.x = nx; p.z = nz;
  for (const k of s.pk) if (Math.hypot(k.x - p.x, k.z - p.z) < 1.4) {
    k.id = -1;
    if (k.w === "ammo") { for (const w of Object.keys(WEAPONS) as WeaponId[]) if (s.owned[w] && w !== "pistol") s.ammo[w].res = Math.min(WEAPONS[w].reserve, s.ammo[w].res + Math.ceil(WEAPONS[w].mag * 0.6)); s.ev.push({ k: "pickup", w: "ammo" }); }
    else { const w = k.w as WeaponId; s.owned[w] = true; s.ammo[w].mag = WEAPONS[w].mag; s.ammo[w].res = Math.max(s.ammo[w].res, WEAPONS[w].reserve); s.ev.push({ k: "pickup", w }); setWeapon(s, w); }
  }
  s.pk = s.pk.filter(k => k.id !== -1);
  if (inp.jump && p.y <= 0.001) p.vy = 5.6; p.vy -= 16 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0 && p.vy < 0) p.vy = 0;
  p.inv = Math.max(0, p.inv - dt); s.recoil = Math.max(0, s.recoil - dt * 3.2); s.boost = Math.max(0, s.boost - dt * 0.05);
  // weapons
  if (inp.swap) { const own = WORDER.filter(w => s.owned[w]), i = own.indexOf(s.weapon); setWeapon(s, own[(i + inp.swap + own.length) % own.length]); }
  s.cd = Math.max(0, s.cd - dt);
  if (s.reload > 0) { s.reload -= dt; if (s.reload <= 0) { const a = s.ammo[s.weapon], W = WEAPONS[s.weapon], need = W.mag - a.mag, take = Math.min(need, a.res); a.mag += take; a.res -= take; s.reload = 0; } }
  else if (inp.reload) startReload(s);
  if (inp.fire && s.cd <= 0 && s.reload <= 0) fire(s);
  // waves
  if (s.wave === 0 || (s.waveLeft === 0 && s.spawnQ.length === 0 && s.enemies.every(e => e.dead !== 0))) {
    s.between -= dt;
    if (s.between <= 0) {
      if (s.wave >= WAVES.length) { s.done = true; s.won = true; s.ev.push({ k: "win" }); return; }
      s.spawnQ = WAVES[s.wave].slice(); s.waveLeft = s.spawnQ.length; s.wave++; s.between = 4; s.spawnT = 0; s.ev.push({ k: "wave", n: s.wave }); { const un = unowned(s); if (un.length) spawnPickup(s, un[Math.floor(rnd(s) * un.length)]); if (s.wave % 2 === 0) spawnPickup(s, "ammo"); }
      for (const k of Object.keys(WEAPONS) as WeaponId[]) s.ammo[k].res = Math.min(k === "pistol" ? 9999 : WEAPONS[k].reserve, s.ammo[k].res + WEAPONS[k].mag);   // a little ammo between waves
      p.hp = Math.min(100, p.hp + 25);
    }
  }
  if (s.spawnQ.length) { s.spawnT -= dt; const cap = s.wave <= 3 ? 2 : 3; if (s.spawnT <= 0 && s.enemies.filter(e => e.dead === 0).length < cap) { spawnAlien(s, s.spawnQ.shift() as AlienKind); s.waveLeft--; s.spawnT = 1.4; } }
  // enemies
  const alive = s.enemies.filter(e => e.dead === 0);
  for (const e of s.enemies) {
    const A = ALIENS[e.kind]; e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.dead !== 0) { if (e.dead > 0) { e.dead -= dt; if (e.dead <= 0) e.dead = -1; } continue; }
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1; e.yaw = Math.atan2(-dx, -dz);
    let dirx = dx / d, dirz = dz / d, spd = A.speed * (1 + s.wave * 0.03);
    if (e.kind === "flarecaster") { if (d < 9) { dirx = -dirx; dirz = -dirz; spd *= 0.8; } else if (d < 15) { dirx = -dirz * (e.side || 1); dirz = dx / d * (e.side || 1); spd *= 0.6; if (!e.side) e.side = rnd(s) < 0.5 ? -1 : 1; } }
    if (e.kind === "skyeye") { if (d < 10) { dirx = -dirx; dirz = -dirz; } else if (d < 17) { if (!e.side) e.side = rnd(s) < 0.5 ? -1 : 1; dirx = -dz / d * e.side; dirz = dx / d * e.side; spd *= 0.7; } }
    if (e.kind === "charger") {
      if ((e.stun || 0) > 0) { e.stun = (e.stun || 0) - dt; spd = 0; }
      else if ((e.tele || 0) > 0) { e.tele = (e.tele || 0) - dt; spd = 0; if ((e.tele || 0) <= 0) { e.rush = 0.95; e.dx = dx / d; e.dz = dz / d; } }
      else if ((e.rush || 0) > 0) { e.rush = (e.rush || 0) - dt; dirx = e.dx || dirx; dirz = e.dz || dirz; spd = 15; e.yaw = Math.atan2(-dirx, -dirz); if ((e.rush || 0) <= 0) { e.stun = 1.1; e.cd = 2.2; } }
      else if (d < 15 && d > 4 && e.cd <= 0) { e.tele = 1.0; e.cd = 0; s.ev.push({ k: "charge", x: e.x, z: e.z }); }
    }
    if (e.kind === "spitter") { if (d < 11) { dirx = -dirx; dirz = -dirz; spd *= 0.7; } else if (d < 16) { spd = 0; } }
    if (e.kind === "mantis" && e.leap > 0) { e.leap -= dt; spd = A.speed * 3.2; }
    else if (e.kind === "mantis" && d < 7 && d > 3 && e.cd <= 0) { e.leap = 0.45; e.cd = 3.2; }
    for (const o of alive) { if (o === e) continue; const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz); if (od > 0 && od < 1.1) { dirx += ox / od * 0.6; dirz += oz / od * 0.6; } }
    if ((e.sideT || 0) > 0) { e.sideT = (e.sideT || 0) - dt; dirx += -dirz * (e.side || 1) * 1.6; dirz += dirx * 0 + (dx / d) * (e.side || 1) * 1.6; }
    const ix = dirx * spd * dt, iz = dirz * spd * dt;
    const [nx2, nz2] = e.kind === "skyeye" ? [Math.max(-ARENA + 1, Math.min(ARENA - 1, e.x + ix)), Math.max(-ARENA + 1, Math.min(ARENA - 1, e.z + iz))] : collide(s.boxes, e.x + ix, e.z + iz, A.r);
    if (spd > 0 && Math.hypot(nx2 - e.x, nz2 - e.z) < 0.35 * Math.hypot(ix, iz) && (e.sideT || 0) <= 0) { e.side = rnd(s) < 0.5 ? -1 : 1; e.sideT = 1.4; }
    e.x = nx2; e.z = nz2;
    e.cd -= dt; e.gt = (e.gt === undefined ? 1.5 + rnd(s) * 4 : e.gt) - dt; if (e.gt <= 0) { e.gt = 4 + rnd(s) * 5; if (d < 30) s.ev.push({ k: "growl", w: e.kind, n: d }); }
    if (e.kind === "charger") { if ((e.rush || 0) > 0 && d < A.reach + 0.4) { s.ev.push({ k: "bite", w: e.kind }); hurtPlayer(s, A.dmg * (1 + s.wave * 0.04), e.x, e.z); e.rush = 0; e.stun = 1.1; e.cd = 2.2; } }
    else if (A.reach > 0 && d < A.reach + 0.6 && e.cd <= 0) { s.ev.push({ k: "bite", w: e.kind }); hurtPlayer(s, A.dmg * (1 + s.wave * 0.04), e.x, e.z); e.cd = e.kind === "skitter" ? 0.7 : 1.1; }
    if (e.kind === "flarecaster" && d < 26 && e.cd <= 0) {
      e.cd = 3.0; const T = d / 11; s.acid.push({ id: s.nextId++, x: e.x, y: 2.0, z: e.z, vx: dx / T, vz: dz / T, vy: (EYE - 2.0 + 4.9 * T * T) / T, life: 5, dmg: 18, big: 1.8, col: 0xff7a2a }); s.ev.push({ k: "spit", x: e.x, z: e.z, w: "flarecaster" });
    }
    if (e.kind === "skyeye" && d < 28 && e.cd <= 0) {
      e.cd = 2.6; for (const sp of [-0.18, 0, 0.18]) { const ang = Math.atan2(dx, dz) + sp, V = 13, T = d / V; s.acid.push({ id: s.nextId++, x: e.x, y: 2.6, z: e.z, vx: Math.sin(ang) * V, vz: Math.cos(ang) * V, vy: (EYE - 2.6) / T, life: 3, g: 0, dmg: 7, big: 0.7, col: 0xb06aff }); } s.ev.push({ k: "spit", x: e.x, z: e.z, w: "skyeye" });
    }
    if (e.kind === "spitter" && d < 24 && e.cd <= 0) {
      e.cd = 2.3; const T = d / 14; s.acid.push({ id: s.nextId++, x: e.x, y: 1.3, z: e.z, vx: dx / T, vz: dz / T, vy: (EYE - 1.3 + 4.9 * T * T) / T, life: 4 }); s.ev.push({ k: "spit", x: e.x, z: e.z });
    }
  }
  s.enemies = s.enemies.filter(e => e.dead >= 0);
  for (const a of s.acid) {
    a.life -= dt; a.vy -= (a.g === undefined ? 9.8 : a.g) * dt; a.x += a.vx * dt; a.z += a.vz * dt; a.y += a.vy * dt;
    if (a.y <= 0.1) a.life = 0;
    else if (Math.hypot(a.x - p.x, a.z - p.z) < 0.7 && a.y < (p.slide > 0 ? 1.0 : EYE + p.y + 0.3) && a.y > p.y) { hurtPlayer(s, a.dmg || 11, a.x, a.z); a.life = 0; }
    for (const b of s.boxes) if (a.y < b.h && Math.abs(a.x - b.x) < b.w / 2 && Math.abs(a.z - b.z) < b.d / 2) a.life = 0;
  }
  s.acid = s.acid.filter(a => a.life > 0);
  for (const r of s.rk) {
    r.life -= dt; r.vy -= 2.5 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; let hit = r.life <= 0 || r.y <= 0.1;
    for (const b of s.boxes) if (r.y < b.h && Math.abs(r.x - b.x) < b.w / 2 && Math.abs(r.z - b.z) < b.d / 2) hit = true;
    if (Math.abs(r.x) > ARENA || Math.abs(r.z) > ARENA) hit = true;
    if (!hit) for (const e of s.enemies) if (e.dead === 0 && Math.hypot(e.x - r.x, e.z - r.z) < ALIENS[e.kind].r + 0.4 && Math.abs(r.y - bodyY(e.kind)) < 1.4) { hit = true; break; }
    if (hit) { r.life = 0; explode(s, r.x, Math.max(0.2, r.y), r.z); }
  }
  s.rk = s.rk.filter(r => r.life > 0);
  // the 15 s tune-up clock: counts active combat only
  if (s.wave > 0 && s.tuneEvery > 0 && !s.done && s.enemies.some(e => e.dead === 0)) {
    s.active += dt; s.tuneT += dt;
    if (s.tuneT >= s.tuneEvery) { s.tuneT = 0; s.frozen = true; s.tunes++; s.ev.push({ k: "tune" }); }
  }
}

/** the answer to a tune-up question: a right one is rewarded, a wrong one costs only the reward; play resumes after a short grace so nobody is hit the instant it unfreezes */
export function tuneResult(s: State, ok: boolean | null) {
  if (ok) { s.tuneRight++; s.tuneStreak++; fullReload(s); s.p.shield = Math.min(50, s.p.shield + 25); if (s.tuneStreak >= 3) s.boost = 0.5; s.score += 100 * Math.min(3, s.tuneStreak); }
  else s.tuneStreak = 0;
  s.frozen = false; s.grace = 1.5; s.tuneT = 0;
}

export function stats(s: State) {
  const acc = s.shots ? Math.round(s.hitsLanded / s.shots * 100) : 0;
  const stars = !s.won ? 0 : s.p.hp >= 70 ? 3 : s.p.hp >= 35 ? 2 : 1;
  return { acc, stars, kills: s.kills, heads: s.heads, score: s.score, tunes: s.tunes, right: s.tuneRight, activeSecs: Math.round(s.active) };
}
