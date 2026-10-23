/* Robot Adventure 3D cockpit flight (plan 39 P4): the Adventure's ship maps as first-person space flight. Pure simulation (no three.js, no DOM, no storage).
   Kinds (the Adventure `mission` ids): launch / warp / skim (fly through gates), harvest (hold rings), belt (shoot rocks, collect ore), solar (collect panels), dogfight (kill fighters and the mothership),
   blackhole (survive the pull) and evade (no guns, dodge the scan beams). Every gate or ring that counts, and every ♪ relay, asks a music question: the flight freezes, the page asks, shipAnswer() lands. */
export type ShipKind = "launch" | "belt" | "harvest" | "solar" | "skim" | "warp" | "dogfight" | "blackhole" | "evade";
export type V3 = { x: number; y: number; z: number };
export type Gate = V3 & { r: number; nx: number; ny: number; nz: number; done: boolean; ask: boolean; side: number; cd: number };
export type Rock = V3 & { r: number; hp: number; vx: number; vy: number; vz: number; dead: boolean };
export type Foe = V3 & { id: number; hp: number; max: number; boss: boolean; cd: number; vx: number; vy: number; vz: number; dead: number; flash: number };
export type Bolt = V3 & { vx: number; vy: number; vz: number; life: number; dmg: number };
export type Pick = V3 & { kind: "ore" | "solar"; got: boolean };
export type Ring = V3 & { r: number; p: number; done: boolean; cd: number };
export type Relay = V3 & { r: number; got: boolean };
export type Ev = { k: "shot" | "hit" | "boom" | "hurt" | "pick" | "gate" | "ask" | "win" | "lose" | "beam" | "relay" | "warn"; x?: number; y?: number; z?: number; n?: number };
export type SInput = { sx: number; sy: number; fire: boolean; boost: boolean; light?: boolean; power?: "cell" | "h2" | "nuke" | null };
export type Ship = {
  kind: ShipKind; hard: number; t: number; rng: number; nextId: number;
  p: V3 & { yaw: number; pitch: number; roll: number; speed: number; hp: number; max: number; shield: number; inv: number; boost: number };
  gates: Gate[]; rocks: Rock[]; foes: Foe[]; bolts: Bolt[]; ebolts: Bolt[]; picks: Pick[]; rings: Ring[]; relays: Relay[];
  bh: V3 | null; beams: { axis: number; off: number; t: number; w: number }[];
  goal: number; prog: number; hold: number; answers: number; needAnswers: number; secs: number; relayT: number; foeT: number; beamT: number;
  ask: { kind: "gate" | "relay"; i: number } | null; frozen: boolean; done: boolean; won: boolean; auto: boolean; autoFire: boolean;
  kills: number; ore: number; tunes: number; tuneRight: number; score: number; cdFire: number; ev: Ev[]; items: { x: number; y: number; z: number; kind: "cell" | "h2" | "nuke"; got: boolean }[]; pw: { cell: number; h2: number; nuke: number }; form: { kind: string; t: number } | null; itemT: number; bossDead: boolean; shots: number; hits: number;
};
export const SHIP_SPEED = 30;
const rnd = (s: Ship) => { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) | 0; return ((s.rng >>> 0) % 100000) / 100000; };
const dirOf = (yaw: number, pitch: number): V3 => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
export const shipDir = dirOf;
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const norm = (a: V3): V3 => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;

export function newShip(kind: ShipKind, hard = 2, seed = 11): Ship {
  const s: Ship = {
    kind, hard, t: 0, rng: seed, nextId: 1, p: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: SHIP_SPEED, hp: 100, max: 100, shield: 0, inv: 0, boost: 0 },
    gates: [], rocks: [], foes: [], bolts: [], ebolts: [], picks: [], rings: [], relays: [], bh: null, beams: [], items: [], pw: { cell: 0, h2: 0, nuke: 0 }, form: null, itemT: 3,
    goal: 0, prog: 0, hold: 8, answers: 0, needAnswers: 0, secs: 0, relayT: 30, foeT: 4, beamT: 3, ask: null, frozen: false, done: false, won: false, auto: true, autoFire: true,
    kills: 0, ore: 0, tunes: 0, tuneRight: 0, score: 0, cdFire: 0, ev: [], bossDead: false, shots: 0, hits: 0,
  };
  const gates = (n: number, step: number, climb: number, wave: number, asks: number) => {
    const dir = norm({ x: 0, y: climb, z: -1 });
    for (let i = 1; i <= n; i++) { const w = Math.sin(i * 1.3) * wave, c: V3 = { x: Math.sin(i * 0.9) * wave, y: dir.y * step * i + w * 0.4, z: dir.z * step * i };
      s.gates.push({ ...c, r: 15, nx: dir.x, ny: dir.y, nz: dir.z, done: false, ask: asks > 0 && i % asks === 0 || i === n, side: 0, cd: 0 }); }
    s.goal = n;
  };
  const rocks = (n: number, spread: number, rmin: number, rmax: number, hp: number) => { for (let i = 0; i < n; i++) { const a = rnd(s) * 6.283, d = 60 + rnd(s) * spread; s.rocks.push({ x: Math.cos(a) * d * 0.7, y: (rnd(s) - 0.5) * spread * 0.4, z: -40 - Math.sin(a * 0.5 + 1) * d - rnd(s) * spread * 0.5, r: rmin + rnd(s) * (rmax - rmin), hp, vx: (rnd(s) - 0.5) * 2, vy: (rnd(s) - 0.5) * 2, vz: (rnd(s) - 0.5) * 2, dead: false }); } };
  if (kind === "launch") { gates(6, 130, 0.45, 20, 2); rocks(14, 260, 3, 9, 3); s.needAnswers = 0; }
  else if (kind === "warp") { gates(3, 260, 0, 40, 1); rocks(6, 300, 4, 10, 4); }
  else if (kind === "skim") { gates(6, 120, 0, 36, 2); rocks(8, 220, 3, 7, 3); }
  else if (kind === "harvest") { for (let i = 0; i < 3; i++) s.rings.push({ x: (i - 1) * 90, y: Math.sin(i * 2) * 30, z: -200 - i * 190, r: 22, p: 0, done: false, cd: 0 }); s.goal = 3; s.hold = 7; s.needAnswers = 1; rocks(8, 240, 3, 8, 3); }
  else if (kind === "belt") { rocks(16, 320, 5, 14, 4); s.goal = 8; s.needAnswers = 2; }
  else if (kind === "solar") { for (let i = 0; i < 8; i++) s.picks.push({ x: (rnd(s) - 0.5) * 300, y: (rnd(s) - 0.5) * 120, z: -80 - i * 90 - rnd(s) * 40, kind: "solar", got: false }); s.goal = 8; s.needAnswers = 2; rocks(8, 260, 3, 8, 3); }
  else if (kind === "dogfight") { s.goal = 8; s.needAnswers = 1; for (let i = 0; i < 4; i++) spawnFoe(s); }
  else if (kind === "blackhole") { s.bh = { x: 0, y: 0, z: -520 }; s.secs = 40; s.needAnswers = 2; rocks(8, 260, 3, 8, 3); }
  else if (kind === "evade") { s.secs = 50; s.needAnswers = 2; }
  return s;
}
function spawnFoe(s: Ship, boss = false) {
  const a = (rnd(s) - 0.5) * 2.4, d = boss ? 260 : 150 + rnd(s) * 60, p = s.p, hp = (boss ? 50 : 3) * (1 + (s.hard - 1) * 0.15);
  const fd = dirOf(p.yaw + a, (rnd(s) - 0.5) * 0.5);
  s.foes.push({ id: s.nextId++, x: p.x + fd.x * d, y: p.y + fd.y * d, z: p.z + fd.z * d, hp, max: hp, boss, cd: 1.5 + rnd(s), vx: 0, vy: 0, vz: 0, dead: 0, flash: 0 });
}
function hurt(s: Ship, n: number) {
  if (s.p.inv > 0 || s.done) return; const sh = Math.min(s.p.shield, n); s.p.shield -= sh; n -= sh; s.p.hp -= n * 0.85; s.p.inv = 0.4; s.ev.push({ k: "hurt" });
  if (s.p.hp <= 0) { s.done = true; s.won = false; s.ev.push({ k: "lose" }); }
}
function win(s: Ship) { s.done = true; s.won = true; s.ev.push({ k: "win" }); }
function askNow(s: Ship, kind: "gate" | "relay", i: number) { s.ask = { kind, i }; s.frozen = true; s.tunes++; s.ev.push({ k: "ask" }); }
/** the page tells the flight how the question went */
export function shipAnswer(s: Ship, ok: boolean | null) {
  const a = s.ask; s.ask = null; s.frozen = false; s.p.inv = Math.max(s.p.inv, 1.5); if (!a) return;
  if (a.kind === "relay") { if (ok) { s.answers++; s.tuneRight++; s.p.hp = Math.min(s.p.max, s.p.hp + 25); s.p.shield = Math.min(50, s.p.shield + 25); s.score += 120; } return; }
  if (a.kind === "gate") {
    const g = s.gates[a.i]; if (!g) return;
    if (ok) { g.done = true; s.prog++; s.tuneRight++; s.answers++; s.score += 150; s.ev.push({ k: "gate", n: a.i }); }
    else { const d = dirOf(s.p.yaw, s.p.pitch); g.x = s.p.x + d.x * 170; g.y = s.p.y + d.y * 170; g.z = s.p.z + d.z * 170; g.nx = d.x; g.ny = d.y; g.nz = d.z; g.side = 0; g.cd = 2; }   // a wrong answer: the gate comes round again ahead of you
  }
}
function fireBolt(s: Ship, aimAssist: boolean) {
  const p = s.p; let d = dirOf(p.yaw, p.pitch);
  if (aimAssist) { let best: V3 | null = null, bs = 0.96; const tgt: V3[] = [...s.foes.filter(f => !f.dead), ...s.rocks.filter(r => !r.dead)]; for (const t of tgt) { const v = norm(sub(t, p)), c = dot(v, d); if (c > bs && len(sub(t, p)) < 220) { bs = c; best = v; } } if (best) d = norm({ x: d.x * 0.35 + best.x * 0.65, y: d.y * 0.35 + best.y * 0.65, z: d.z * 0.35 + best.z * 0.65 }); }
  const right = { x: Math.cos(p.yaw), y: 0, z: -Math.sin(p.yaw) };
  for (const sd of [-1, 1]) s.bolts.push({ x: p.x + right.x * 1.6 * sd + d.x * 2, y: p.y - 0.5 + d.y * 2, z: p.z + right.z * 1.6 * sd + d.z * 2, vx: d.x * 260 + 0 * sd, vy: d.y * 260, vz: d.z * 260, life: 1.4, dmg: 1 });
  s.shots++; s.ev.push({ k: "shot" });
}
/** where the auto-pilot flies: the next thing the mission wants */
function target(s: Ship): V3 | null {
  const p = s.p; const near = (a: V3[]) => a.length ? a.reduce((m, q) => len(sub(q, p)) < len(sub(m, p)) ? q : m) : null;
  const askNeed = s.answers < s.needAnswers ? near(s.relays.filter(r => !r.got)) : null;
  if (s.gates.length) return near(s.gates.filter(g => !g.done && g.cd <= 0));
  if (s.rings.length) return (s.answers < s.needAnswers ? near(s.relays.filter(r => !r.got)) : null) || near(s.rings.filter(r => !r.done));
  if (s.kind === "solar") return askNeed || near(s.picks.filter(q => !q.got));
  if (s.kind === "belt") return near(s.picks.filter(q => !q.got)) || askNeed || near(s.rocks.filter(r => !r.dead));
  if (s.kind === "dogfight") return askNeed || near(s.foes.filter(f => !f.dead));
  return askNeed;
}
export function stepShip(s: Ship, dt: number, inp: SInput) {
  if (s.done || s.frozen) return; s.t += dt; const p = s.p; if (p.inv > 0) p.inv -= dt;
  // steering: the stick, or the auto-pilot when the stick is idle
  let sx = inp.sx, sy = inp.sy;
  if (s.auto && Math.abs(sx) + Math.abs(sy) < 0.1) { const t = target(s); if (t) { const v = norm(sub(t, p)), yawT = Math.atan2(-v.x, -v.z), pitchT = Math.asin(Math.max(-1, Math.min(1, v.y))); let dy = yawT - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; sx = Math.max(-1, Math.min(1, dy * 1.6)); sy = Math.max(-1, Math.min(1, (pitchT - p.pitch) * 1.6)); } }
  p.yaw += sx * 2.3 * dt; p.pitch = Math.max(-1.2, Math.min(1.2, p.pitch + sy * 1.7 * dt)); p.roll += ((-sx * 0.5) - p.roll) * Math.min(1, dt * 4);
  let slow = 1; for (const r of s.rings) if (!r.done && r.cd <= 0 && len(sub(r, p)) < r.r * 1.6) slow = 0.2;
  if (s.kind === "dogfight") for (const f of s.foes) if (!f.dead && len(sub(f, p)) < 55) slow = 0.35;
  p.boost = inp.boost ? Math.min(1, p.boost + dt * 3) : Math.max(0, p.boost - dt * 3); p.speed = SHIP_SPEED * (1 + p.boost * 0.7) * slow * (inp.light ? 3.2 : 1) * (s.form && s.form.kind === "h2" ? 1.5 : 1);
  const d = dirOf(p.yaw, p.pitch); let vx = d.x * p.speed, vy = d.y * p.speed, vz = d.z * p.speed;
  if (s.bh) { const to = sub(s.bh, p), dist = len(to), pull = Math.min(14, 3 + s.t * 0.25) * Math.min(2, 120 / Math.max(40, dist)); vx += to.x / dist * pull; vy += to.y / dist * pull; vz += to.z / dist * pull; if (dist < 40) { hurt(s, 20); p.x -= to.x / dist * 60; p.y -= to.y / dist * 60; p.z -= to.z / dist * 60; } }
  p.x += vx * dt; p.y += vy * dt; p.z += vz * dt;
  // energy items drift in ahead of the ship; each one stores a charge the power buttons spend
  s.itemT -= dt; if (s.itemT <= 0) { s.itemT = 3 + rnd(s) * 3; const dd = dirOf(p.yaw, p.pitch), K = ["cell", "h2", "nuke"] as const; s.items.push({ x: p.x + dd.x * 150 + (rnd(s) - 0.5) * 50, y: p.y + dd.y * 150 + (rnd(s) - 0.5) * 30, z: p.z + dd.z * 150, kind: K[Math.floor(rnd(s) * 3) % 3], got: false }); if (s.items.length > 14) s.items.shift(); }
  for (const q of s.items) if (!q.got && len(sub(q, p)) < 11) { q.got = true; s.pw[q.kind] = Math.min(3, s.pw[q.kind] + 1); p.hp = Math.min(p.max, p.hp + 6); s.ev.push({ k: "pick" }); }
  if (inp.power && s.pw[inp.power] > 0 && !s.form) { const k = inp.power; s.pw[k]--; s.form = { kind: k, t: k === "nuke" ? 0.6 : 8 }; if (k === "nuke") { for (const f of s.foes) if (!f.dead && len(sub(f, p)) < 160) { f.hp -= 6; if (f.hp <= 0) { f.dead = 1; s.kills++; } } for (const r of s.rocks) if (!r.dead && len(sub(r, p)) < 160) { r.dead = true; s.ev.push({ k: "boom", x: r.x, y: r.y, z: r.z, n: r.r }); } s.ebolts.length = 0; s.ev.push({ k: "boom", x: p.x, y: p.y, z: p.z, n: 30 }); } }
  inp.power = null;
  if (s.form) { s.form.t -= dt; if (s.form.kind === "cell") { p.hp = Math.min(p.max, p.hp + 4 * dt); p.shield = Math.max(p.shield, 1); } if (s.form.t <= 0) s.form = null; }
  // guns
  s.cdFire -= dt; const armed = s.kind !== "evade";
  let want = inp.fire;
  if (armed && s.autoFire && !want) { const dd = dirOf(p.yaw, p.pitch); for (const t of [...s.foes.filter(f => !f.dead), ...s.rocks.filter(r => !r.dead)]) { const v = sub(t, p), l = len(v); if (l < 180 && l > 4 && dot(v, dd) / l > 0.95) { want = true; break; } } }
  if (armed && want && s.cdFire <= 0) { s.cdFire = 0.14; fireBolt(s, true); }
  for (const b of s.bolts) {
    let bt: Foe | null = null, bd = 140; for (const f of s.foes) { if (f.dead) continue; const dd = len(sub(f, b)); if (dd < bd) { const v = norm(sub(f, b)), sp = Math.hypot(b.vx, b.vy, b.vz); if ((v.x * b.vx + v.y * b.vy + v.z * b.vz) / sp > 0.8) { bd = dd; bt = f; } } }
    if (bt) { const v = norm(sub(bt, b)), sp = Math.hypot(b.vx, b.vy, b.vz), k = Math.min(1, dt * 7); b.vx += (v.x * sp - b.vx) * k; b.vy += (v.y * sp - b.vy) * k; b.vz += (v.z * sp - b.vz) * k; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt; }
  for (const b of s.ebolts) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt; if (len(sub(b, p)) < 3.2) { b.life = 0; hurt(s, b.dmg); } }
  // rocks
  for (const r of s.rocks) { if (r.dead) continue; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
    for (const b of s.bolts) if (b.life > 0 && len(sub(b, r)) < r.r + 1) { b.life = 0; r.hp -= b.dmg; s.hits++; s.ev.push({ k: "hit", x: b.x, y: b.y, z: b.z }); if (r.hp <= 0) { r.dead = true; s.ev.push({ k: "boom", x: r.x, y: r.y, z: r.z, n: r.r }); s.score += 20; if (s.kind === "belt") s.picks.push({ x: r.x, y: r.y, z: r.z, kind: "ore", got: false }); break; } }
    if (!r.dead && len(sub(r, p)) < r.r + 2.4) { hurt(s, 10); const a = norm(sub(p, r)); p.x += a.x * 6; p.y += a.y * 6; p.z += a.z * 6; } }
  if (s.kind === "belt" && s.rocks.filter(r => !r.dead).length < 5) rocks2(s);
  // pickups
  for (const q of s.picks) if (!q.got && len(sub(q, p)) < 9) { q.got = true; if (q.kind === "ore") s.ore++; s.prog++; s.score += 40; s.ev.push({ k: "pick" }); }
  // gates
  for (let i = 0; i < s.gates.length; i++) { const g = s.gates[i]; if (g.done) continue; if (g.cd > 0) { g.cd -= dt; continue; } const rel = sub(p, g), side = rel.x * g.nx + rel.y * g.ny + rel.z * g.nz;
    if (g.side !== 0 && g.side < 0 && side >= 0) { const off = Math.hypot(rel.x - side * g.nx, rel.y - side * g.ny, rel.z - side * g.nz); if (off < g.r) { if (g.ask) askNow(s, "gate", i); else { g.done = true; s.prog++; s.ev.push({ k: "gate", n: i }); } return; } }
    g.side = side < 0 ? -1 : 1; }
  // hold rings
  for (const r of s.rings) { if (r.done) continue; if (r.cd > 0) { r.cd -= dt; continue; } if (len(sub(r, p)) < r.r) { r.p += dt / s.hold; if (r.p >= 1) { r.p = 1; r.done = true; s.prog++; askNow(s, "gate", -1); s.ask = null; s.frozen = false; askRing(s, r); return; } } else r.p = Math.max(0, r.p - dt * 0.4); }
  // relays: a ♪ ring every few seconds when the mission wants more answers (or as a repair on a long flight)
  s.relayT -= dt; if (s.relayT <= 0 && (s.needAnswers > s.answers || s.kind === "dogfight" || s.gates.length === 0) && s.relays.filter(r => !r.got).length < 1) { s.relayT = 30; const dd = dirOf(p.yaw + (rnd(s) - 0.5) * 0.8, (rnd(s) - 0.5) * 0.3); s.relays.push({ x: p.x + dd.x * 90, y: p.y + dd.y * 90, z: p.z + dd.z * 90, r: 16, got: false }); }
  for (const r of s.relays) if (!r.got && len(sub(r, p)) < r.r) { r.got = true; s.ev.push({ k: "relay" }); askNow(s, "relay", 0); return; }
  s.relays = s.relays.filter(r => !r.got && len(sub(r, p)) < 600);
  // foes
  if (s.kind === "dogfight" || s.kind === "harvest") { s.foeT -= dt; const alive = s.foes.filter(f => !f.dead && !f.boss).length; if (s.kind === "dogfight" && s.kills + alive < s.goal && alive < 4 && s.foeT <= 0) { spawnFoe(s); s.foeT = 3; } if (s.kind === "harvest" && alive < 2 + (s.hard > 3 ? 1 : 0) && s.foeT <= 0) { spawnFoe(s); s.foeT = 6; } if (s.kind === "dogfight" && s.kills >= s.goal && !s.foes.some(f => f.boss)) { spawnFoe(s, true); s.ev.push({ k: "warn" }); } }
  for (const f of s.foes) { if (f.dead) { f.dead -= dt; continue; } f.flash = Math.max(0, f.flash - dt);
    const to = sub(p, f), dist = len(to), v = norm(to), sp = f.boss ? 14 : 34 + s.hard * 3;
    if (dist > 70 || f.boss) { f.vx += (v.x * sp - f.vx) * dt * 1.4; f.vy += (v.y * sp - f.vy) * dt * 1.4; f.vz += (v.z * sp - f.vz) * dt * 1.4; } else { f.vx += (-v.z * sp * 0.8 - f.vx) * dt; f.vz += (v.x * sp * 0.8 - f.vz) * dt; f.vy += (Math.sin(f.id + s.t) * 8 - f.vy) * dt; }
    if (f.boss && dist < 90) { f.vx *= 0.9; f.vy *= 0.9; f.vz *= 0.9; }
    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.cd -= dt;
    if (f.cd <= 0 && dist < 240) { f.cd = f.boss ? 1.4 : 1.8 + rnd(s); const n = f.boss ? 5 : 1; for (let i = 0; i < n; i++) { const sp2 = 0.07 * (i - (n - 1) / 2) + (rnd(s) - 0.5) * 0.06; s.ebolts.push({ x: f.x, y: f.y, z: f.z, vx: v.x * 110 + sp2 * 110 * v.z, vy: v.y * 110 + (rnd(s) - 0.5) * 6, vz: v.z * 110 - sp2 * 110 * v.x, life: 3, dmg: f.boss ? 9 : 7 }); } }
    for (const b of s.bolts) if (b.life > 0 && len(sub(b, f)) < (f.boss ? 16 : 3.6)) { b.life = 0; f.hp -= b.dmg; f.flash = 0.1; s.hits++; s.ev.push({ k: "hit", x: b.x, y: b.y, z: b.z }); if (f.hp <= 0) { f.dead = 0.8; s.ev.push({ k: "boom", x: f.x, y: f.y, z: f.z, n: f.boss ? 20 : 4 }); s.score += f.boss ? 1500 : 100; if (f.boss) s.bossDead = true; else s.kills++; break; } }
    if (!f.dead && dist < (f.boss ? 16 : 5)) { hurt(s, f.boss ? 20 : 12); const a = norm(sub(p, f)); p.x += a.x * 8; p.y += a.y * 8; p.z += a.z * 8; } }
  s.bolts = s.bolts.filter(b => b.life > 0); s.ebolts = s.ebolts.filter(b => b.life > 0); s.foes = s.foes.filter(f => !f.dead || f.dead > 0);
  // evade: sweeping scan beams (a warning, then the beam)
  if (s.kind === "evade") { s.beamT -= dt; if (s.beamT <= 0) { s.beamT = 3.2 - Math.min(1.2, s.hard * 0.2); s.beams.push({ axis: rnd(s) < 0.5 ? 0 : 1, off: (rnd(s) - 0.5) * 70, t: 0, w: 7 }); s.ev.push({ k: "warn" }); }
    for (const b of s.beams) { b.t += dt; if (b.t > 1.4 && b.t < 2.0) { const c = b.axis === 0 ? p.y - (p.y + b.off) : 0; const dist = b.axis === 0 ? Math.abs(b.off) : Math.abs(b.off); void c; const local = b.axis === 0 ? Math.abs(((p.y % 200) + 200) % 200 - 100 - b.off) : Math.abs(((p.x % 200) + 200) % 200 - 100 - b.off); void dist; if (local < b.w) hurt(s, 14); } } s.beams = s.beams.filter(b => b.t < 2.2); }
  // mission end
  const answersOk = s.answers >= s.needAnswers;
  if (s.kind === "blackhole" || s.kind === "evade") { if (s.t >= s.secs && answersOk) win(s); }
  else if (s.kind === "belt" || s.kind === "solar") { if (s.prog >= s.goal && answersOk) win(s); }
  else if (s.kind === "dogfight") { if (s.bossDead && answersOk) win(s); }
  else if (s.gates.length || s.rings.length) { if (s.prog >= s.goal) win(s); }
}
function askRing(s: Ship, r: Ring) { const i = s.rings.indexOf(r); s.ask = { kind: "gate", i: -(i + 2) }; s.frozen = true; s.tunes++; s.ev.push({ k: "ask" }); }
export function shipAnswerRing(s: Ship, ok: boolean | null) {   // rings use a negative index so shipAnswer() above stays for gates and relays
  const a = s.ask; if (!a || a.i > -2) return shipAnswer(s, ok); const r = s.rings[-a.i - 2]; s.ask = null; s.frozen = false; s.p.inv = Math.max(s.p.inv, 1.5);
  if (ok) { s.answers++; s.tuneRight++; s.score += 150; } else { r.done = false; r.p = 0; r.cd = 5; s.prog--; }
}
export const shipAnswerAny = (s: Ship, ok: boolean | null) => (s.ask && s.ask.i <= -2 ? shipAnswerRing(s, ok) : shipAnswer(s, ok));
export const shipStats = (s: Ship) => ({ kills: s.kills, ore: s.ore, right: s.tuneRight, tunes: s.tunes, acc: s.shots ? Math.round(s.hits / s.shots * 100) : 0, score: s.score, stars: !s.won ? 0 : s.p.hp >= 70 ? 3 : s.p.hp >= 35 ? 2 : 1, hp: Math.round(s.p.hp) });

function rocks2(s: Ship) { const d = dirOf(s.p.yaw + (rnd(s) - 0.5), (rnd(s) - 0.5) * 0.3); for (let i = 0; i < 4; i++) s.rocks.push({ x: s.p.x + d.x * (90 + i * 25) + (rnd(s) - 0.5) * 40, y: s.p.y + d.y * 90 + (rnd(s) - 0.5) * 30, z: s.p.z + d.z * (90 + i * 25), r: 5 + rnd(s) * 6, hp: 3, vx: 0, vy: 0, vz: 0, dead: false }); }
