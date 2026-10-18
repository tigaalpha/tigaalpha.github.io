/* Alien Hunt simulation (plan 38, phases A-D + the tune-up clock of E2). Pure: no three.js, no DOM, no storage, so scripts/smoke-alien-hunt.mjs runs the real file.
   Units are metres on the x/z plane, y is up; the player's eyes are 1.65 m above the floor. */

export type Box = { x: number; z: number; w: number; d: number; h: number };
export type WeaponId = "pistol" | "rifle" | "shotgun";
export type AlienKind = "skitter" | "mantis" | "spitter";
export type Enemy = { id: number; kind: AlienKind; x: number; z: number; hp: number; max: number; yaw: number; t: number; cd: number; dead: number; flash: number; leap: number; side?: number; sideT?: number };
export type Acid = { id: number; x: number; y: number; z: number; vx: number; vz: number; vy: number; life: number };
export type Ev = { k: "shot" | "hit" | "kill" | "head" | "hurt" | "reload" | "empty" | "spit" | "wave" | "tune" | "win" | "lose" | "swap"; x?: number; y?: number; z?: number; n?: number; w?: string };

export const ARENA = 34;   // half size
export const EYE = 1.65;
export const WEAPONS: Record<WeaponId, { name: string; dmg: number; rate: number; mag: number; reserve: number; spread: number; pellets: number; auto: boolean; reload: number; range: number; kick: number }> = {
  pistol: { name: "Sidearm", dmg: 22, rate: 0.26, mag: 12, reserve: 9999, spread: 0.004, pellets: 1, auto: false, reload: 1.1, range: 80, kick: 0.012 },
  rifle: { name: "Assault rifle", dmg: 12, rate: 0.085, mag: 30, reserve: 150, spread: 0.012, pellets: 1, auto: true, reload: 1.6, range: 90, kick: 0.006 },
  shotgun: { name: "Pump shotgun", dmg: 10, rate: 0.85, mag: 6, reserve: 36, spread: 0.07, pellets: 8, auto: false, reload: 2.2, range: 26, kick: 0.05 },
};
export const ALIENS: Record<AlienKind, { name: string; hp: number; speed: number; r: number; dmg: number; reach: number; score: number; hy: number }> = {
  skitter: { name: "Skitter", hp: 26, speed: 6.2, r: 0.5, dmg: 6, reach: 1.15, score: 50, hy: 0.55 },
  mantis: { name: "Drone Mantis", hp: 95, speed: 3.4, r: 0.7, dmg: 17, reach: 1.8, score: 150, hy: 1.55 },
  spitter: { name: "Spitter", hp: 62, speed: 2.6, r: 0.65, dmg: 11, reach: 0, score: 120, hy: 1.35 },
};
export const WAVES: AlienKind[][] = [
  ["skitter", "skitter", "skitter", "skitter", "skitter", "skitter"],
  ["skitter", "skitter", "skitter", "mantis", "mantis"],
  ["mantis", "mantis", "spitter", "skitter", "skitter", "skitter", "skitter"],
  ["spitter", "spitter", "mantis", "mantis", "mantis", "skitter", "skitter", "skitter", "skitter", "skitter"],
  ["mantis", "mantis", "mantis", "spitter", "spitter", "spitter", "skitter", "skitter", "skitter", "skitter", "skitter", "skitter", "skitter", "skitter"],
];
export const LEVEL_BOXES: Box[] = [
  { x: -8, z: -6, w: 4, d: 2.2, h: 1.3 }, { x: 9, z: -9, w: 2.2, d: 5, h: 1.3 }, { x: 0, z: 8, w: 6, d: 1.6, h: 1.2 },
  { x: -15, z: 7, w: 2.4, d: 2.4, h: 2.6 }, { x: 15, z: 6, w: 2.4, d: 2.4, h: 2.6 }, { x: -3, z: -17, w: 8, d: 1.4, h: 1.2 },
  { x: 20, z: -18, w: 3, d: 3, h: 1.8 }, { x: -22, z: -14, w: 3, d: 3, h: 1.8 }, { x: 4, z: 20, w: 3, d: 2, h: 1.3 }, { x: -12, z: 22, w: 5, d: 1.6, h: 1.3 },
];

export type State = {
  t: number; active: number; rng: number; seed: number;
  p: { x: number; z: number; yaw: number; pitch: number; y: number; vy: number; hp: number; shield: number; inv: number; sprint: boolean };
  weapon: WeaponId; ammo: Record<WeaponId, { mag: number; res: number }>; cd: number; reload: number; recoil: number;
  enemies: Enemy[]; acid: Acid[]; boxes: Box[];
  wave: number; waveLeft: number; between: number; spawnQ: AlienKind[]; spawnT: number; done: boolean; won: boolean;
  kills: number; heads: number; shots: number; hitsLanded: number; score: number; streak: number; best: number;
  tuneEvery: number; tuneT: number; frozen: boolean; grace: number; tunes: number; tuneRight: number; tuneStreak: number; boost: number;
  nextId: number; ev: Ev[];
};

export function mulberry(s: number) { return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function newState(seed = 7, tuneEvery = 15): State {
  const ammo: any = {}; for (const k of Object.keys(WEAPONS) as WeaponId[]) ammo[k] = { mag: WEAPONS[k].mag, res: WEAPONS[k].reserve };
  return {
    t: 0, active: 0, rng: seed, seed,
    p: { x: 0, z: 22, yaw: Math.PI, pitch: 0, y: 0, vy: 0, hp: 100, shield: 0, inv: 0, sprint: false },
    weapon: "rifle", ammo, cd: 0, reload: 0, recoil: 0,
    enemies: [], acid: [], boxes: LEVEL_BOXES,
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

export type Input = { mx: number; mz: number; lookX: number; lookY: number; fire: boolean; jump: boolean; reload: boolean; swap: number; sprint: boolean };
export const noInput = (): Input => ({ mx: 0, mz: 0, lookX: 0, lookY: 0, fire: false, jump: false, reload: false, swap: 0, sprint: false });

const WORDER: WeaponId[] = ["pistol", "rifle", "shotgun"];
export function setWeapon(s: State, w: WeaponId) { if (s.weapon === w) return; s.weapon = w; s.reload = 0; s.cd = 0.25; s.ev.push({ k: "swap", w }); }
function startReload(s: State) { const a = s.ammo[s.weapon], W = WEAPONS[s.weapon]; if (s.reload > 0 || a.mag >= W.mag || a.res <= 0) return; s.reload = W.reload; s.ev.push({ k: "reload" }); }
export function fullReload(s: State) { for (const k of Object.keys(WEAPONS) as WeaponId[]) { s.ammo[k].mag = WEAPONS[k].mag; s.ammo[k].res = Math.max(s.ammo[k].res, WEAPONS[k].mag * 2); } s.reload = 0; }

function spawnAlien(s: State, kind: AlienKind) {
  const A = ALIENS[kind]; let x = 0, z = 0;
  for (let i = 0; i < 12; i++) {   // on the arena edge, away from the player
    const a = rnd(s) * Math.PI * 2; x = Math.cos(a) * (ARENA - 2); z = Math.sin(a) * (ARENA - 2);
    if (Math.hypot(x - s.p.x, z - s.p.z) > 18) break;
  }
  const [cx, cz] = collide(s.boxes, x, z, A.r);
  s.enemies.push({ id: s.nextId++, kind, x: cx, z: cz, hp: A.hp * (1 + s.wave * 0.06), max: A.hp * (1 + s.wave * 0.06), yaw: 0, t: rnd(s) * 6, cd: 0.8 + rnd(s), dead: 0, flash: 0, leap: 0 });
}

function hurtPlayer(s: State, n: number, x?: number, z?: number) {
  if (s.p.inv > 0 || s.done) return;
  let d = n; if (s.p.shield > 0) { const a = Math.min(s.p.shield, d); s.p.shield -= a; d -= a; }
  s.p.hp = Math.max(0, s.p.hp - d); s.p.inv = 0.35; s.streak = 0; s.ev.push({ k: "hurt", x, z, n });
  if (s.p.hp <= 0) { s.done = true; s.won = false; s.ev.push({ k: "lose" }); }
}

function fire(s: State) {
  const W = WEAPONS[s.weapon], a = s.ammo[s.weapon];
  if (a.mag <= 0) { s.ev.push({ k: "empty" }); if (a.res <= 0) { setWeapon(s, "pistol"); return; } startReload(s); s.cd = 0.25; return; }
  a.mag--; s.cd = W.rate; s.shots++; s.recoil = Math.min(1, s.recoil + W.kick * 14); s.ev.push({ k: "shot", w: s.weapon });
  const cp = Math.cos(s.p.pitch), ox = s.p.x, oy = EYE + s.p.y, oz = s.p.z;
  const moving = 1 + s.recoil * 0.9;
  let landed = false;
  for (let i = 0; i < W.pellets; i++) {
    const sp = W.spread * moving, yaw = s.p.yaw + (rnd(s) - 0.5) * 2 * sp, pit = s.p.pitch + (rnd(s) - 0.5) * 2 * sp;
    const dx = -Math.sin(yaw) * Math.cos(pit), dy = Math.sin(pit), dz = -Math.cos(yaw) * Math.cos(pit);
    let wall = W.range; for (const b of s.boxes) { const t = rayBox(ox, oy, oz, dx, dy, dz, b); if (t < wall) wall = t; }
    if (dy < 0) { const tg = -oy / dy; if (tg < wall) wall = tg; }
    let best: Enemy | null = null, bt = wall, head = false;
    for (const e of s.enemies) {
      if (e.dead !== 0) continue; const A = ALIENS[e.kind];
      const tb = raySphere(ox, oy, oz, dx, dy, dz, e.x, A.hy * 0.62, e.z, A.r * 1.05);
      const th = raySphere(ox, oy, oz, dx, dy, dz, e.x, A.hy + 0.5 * A.r * 1.1, e.z, A.r * 0.5);
      if (th < bt) { bt = th; best = e; head = true; } else if (tb < bt) { bt = tb; best = e; head = false; }
    }
    if (best) {
      const fall = Math.max(0.55, 1 - bt / (W.range * 1.4)); let dmg = W.dmg * fall * (head ? 2.2 : 1) * (1 + s.boost);
      best.hp -= dmg; best.flash = 0.12; landed = true; s.ev.push({ k: "hit", x: best.x, y: head ? ALIENS[best.kind].hy + 0.5 : ALIENS[best.kind].hy * 0.6, z: best.z, n: dmg });
      if (best.hp <= 0 && best.dead === 0) {
        best.dead = 0.9; s.kills++; s.streak++; s.best = Math.max(s.best, s.streak); if (head) s.heads++;
        s.score += Math.round(ALIENS[best.kind].score * (head ? 1.5 : 1) * (1 + Math.min(s.streak, 10) * 0.1)); s.ev.push({ k: head ? "head" : "kill", x: best.x, z: best.z, w: best.kind });
      }
    }
  }
  if (landed) s.hitsLanded++;
  if (a.mag <= 0 && a.res > 0) startReload(s);
}

/** one fixed step (call with dt <= 0.05). A frozen game (a music question is open) does nothing at all. */
export function step(s: State, dt: number, inp: Input) {
  if (s.done || s.frozen) return;
  s.t += dt;
  if (s.grace > 0) { s.grace -= dt; s.p.inv = Math.max(s.p.inv, 0.05); }
  const p = s.p;
  // look
  p.yaw -= inp.lookX; p.pitch = Math.max(-1.3, Math.min(1.3, p.pitch - inp.lookY));
  // move
  const sp = (inp.sprint ? 7.4 : 5.0) * (s.reload > 0 ? 0.9 : 1); p.sprint = inp.sprint;
  let fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let vx = (fx * -inp.mz + rx * inp.mx), vz = (fz * -inp.mz + rz * inp.mx); const L = Math.hypot(vx, vz); if (L > 1) { vx /= L; vz /= L; }
  const [nx, nz] = collide(s.boxes, p.x + vx * sp * dt, p.z + vz * sp * dt, 0.4); p.x = nx; p.z = nz;
  if (inp.jump && p.y <= 0.001) p.vy = 5.6; p.vy -= 16 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0 && p.vy < 0) p.vy = 0;
  p.inv = Math.max(0, p.inv - dt); s.recoil = Math.max(0, s.recoil - dt * 3.2); s.boost = Math.max(0, s.boost - dt * 0.05);
  // weapons
  if (inp.swap) { const i = WORDER.indexOf(s.weapon); setWeapon(s, WORDER[(i + inp.swap + 3) % 3]); }
  s.cd = Math.max(0, s.cd - dt);
  if (s.reload > 0) { s.reload -= dt; if (s.reload <= 0) { const a = s.ammo[s.weapon], W = WEAPONS[s.weapon], need = W.mag - a.mag, take = Math.min(need, a.res); a.mag += take; a.res -= take; s.reload = 0; } }
  else if (inp.reload) startReload(s);
  if (inp.fire && s.cd <= 0 && s.reload <= 0) fire(s);
  // waves
  if (s.wave === 0 || (s.waveLeft === 0 && s.spawnQ.length === 0 && s.enemies.every(e => e.dead !== 0))) {
    s.between -= dt;
    if (s.between <= 0) {
      if (s.wave >= WAVES.length) { s.done = true; s.won = true; s.ev.push({ k: "win" }); return; }
      s.spawnQ = WAVES[s.wave].slice(); s.waveLeft = s.spawnQ.length; s.wave++; s.between = 4; s.spawnT = 0; s.ev.push({ k: "wave", n: s.wave });
      for (const k of Object.keys(WEAPONS) as WeaponId[]) s.ammo[k].res = Math.min(k === "pistol" ? 9999 : WEAPONS[k].reserve, s.ammo[k].res + WEAPONS[k].mag);   // a little ammo between waves
      p.hp = Math.min(100, p.hp + 25);
    }
  }
  if (s.spawnQ.length) { s.spawnT -= dt; if (s.spawnT <= 0) { spawnAlien(s, s.spawnQ.shift() as AlienKind); s.waveLeft--; s.spawnT = 0.9; } }
  // enemies
  const alive = s.enemies.filter(e => e.dead === 0);
  for (const e of s.enemies) {
    const A = ALIENS[e.kind]; e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.dead !== 0) { if (e.dead > 0) { e.dead -= dt; if (e.dead <= 0) e.dead = -1; } continue; }
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1; e.yaw = Math.atan2(-dx, -dz);
    let dirx = dx / d, dirz = dz / d, spd = A.speed * (1 + s.wave * 0.03);
    if (e.kind === "spitter") { if (d < 11) { dirx = -dirx; dirz = -dirz; spd *= 0.7; } else if (d < 16) { spd = 0; } }
    if (e.kind === "mantis" && e.leap > 0) { e.leap -= dt; spd = A.speed * 3.2; }
    else if (e.kind === "mantis" && d < 7 && d > 3 && e.cd <= 0) { e.leap = 0.45; e.cd = 3.2; }
    for (const o of alive) { if (o === e) continue; const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz); if (od > 0 && od < 1.1) { dirx += ox / od * 0.6; dirz += oz / od * 0.6; } }
    if ((e.sideT || 0) > 0) { e.sideT = (e.sideT || 0) - dt; dirx += -dirz * (e.side || 1) * 1.6; dirz += dirx * 0 + (dx / d) * (e.side || 1) * 1.6; }
    const ix = dirx * spd * dt, iz = dirz * spd * dt;
    const [nx2, nz2] = collide(s.boxes, e.x + ix, e.z + iz, A.r);
    if (spd > 0 && Math.hypot(nx2 - e.x, nz2 - e.z) < 0.35 * Math.hypot(ix, iz) && (e.sideT || 0) <= 0) { e.side = rnd(s) < 0.5 ? -1 : 1; e.sideT = 1.4; }
    e.x = nx2; e.z = nz2;
    e.cd -= dt;
    if (A.reach > 0 && d < A.reach + 0.6 && e.cd <= 0) { hurtPlayer(s, A.dmg * (1 + s.wave * 0.04), e.x, e.z); e.cd = e.kind === "skitter" ? 0.7 : 1.1; }
    if (e.kind === "spitter" && d < 24 && e.cd <= 0) {
      e.cd = 2.3; const T = d / 14; s.acid.push({ id: s.nextId++, x: e.x, y: 1.3, z: e.z, vx: dx / T, vz: dz / T, vy: (EYE - 1.3 + 4.9 * T * T) / T, life: 4 }); s.ev.push({ k: "spit", x: e.x, z: e.z });
    }
  }
  s.enemies = s.enemies.filter(e => e.dead >= 0);
  for (const a of s.acid) {
    a.life -= dt; a.vy -= 9.8 * dt; a.x += a.vx * dt; a.z += a.vz * dt; a.y += a.vy * dt;
    if (a.y <= 0.1) a.life = 0;
    else if (Math.hypot(a.x - p.x, a.z - p.z) < 0.7 && a.y < EYE + p.y + 0.3 && a.y > p.y) { hurtPlayer(s, 11, a.x, a.z); a.life = 0; }
    for (const b of s.boxes) if (a.y < b.h && Math.abs(a.x - b.x) < b.w / 2 && Math.abs(a.z - b.z) < b.d / 2) a.life = 0;
  }
  s.acid = s.acid.filter(a => a.life > 0);
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
