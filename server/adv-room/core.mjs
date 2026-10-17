// Authoritative room core for Adventure Online (plan 35, level C). Pure logic, no network: the transport (server.mjs) feeds it inputs and
// broadcasts what it returns. The SERVER owns monster health, damage and kills; a phone only says "I used <weapon> on monster <i>" and
// where it stands. The server works the damage out from its own table, checks reach, cooldown and speed, and decides what died.
// HONEST LIMIT: this is the rules of ONE simplified ground-run (fixed spawns, melee/bolt/rocket, no skills, no boss AI). The real client
// game (adventure.tsx Run) is far richer and still runs its own copy; keeping the two in step is the cost of this design.
export const WEAPONS = {            // reach in px, cooldown in s, damage per use at weapon level 1 (the server's numbers, never the client's)
  punch:  { reach: 150, cd: 0.28, dmg: 10 },
  kick:   { reach: 190, cd: 0.45, dmg: 14 },
  fire:   { reach: 720, cd: 0.22, dmg: 8 },
  bolt:   { reach: 560, cd: 0.24, dmg: 9 },
  rocket: { reach: 900, cd: 1.1,  dmg: 40 },
};
export const MAX_SPEED = 900;       // px per second a pilot may move (sprint + dash with margin)
export const MAX_PILOTS = 4;

const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function createRoom({ code, map, seed = 1, world = 4000, count = 16, hard = 1, now = 0 }) {
  const rnd = mulberry(seed), mons = [];
  for (let i = 0; i < count; i++) mons.push({ i, x: 500 + (world - 800) * (i + rnd() * 0.6) / count, hp: Math.round((30 + rnd() * 40) * hard), max: 0, dead: false });
  for (const m of mons) m.max = m.hp;
  return { code, map, world, hard, t0: now, now, pilots: new Map(), mons, done: false, events: [] };
}

export function join(room, id, name) {
  if (room.pilots.size >= MAX_PILOTS && !room.pilots.has(id)) return false;
  if (!room.pilots.has(id)) room.pilots.set(id, { id, name: String(name || "Pilot").slice(0, 14), x: 160, y: 0, t: room.now, last: {}, kills: 0, dmg: 0, strikes: 0, flags: 0 });
  return true;
}

// the pilot says where it stands; the server refuses a jump faster than MAX_SPEED and keeps the old place instead
export function move(room, id, x, y, now) {
  const p = room.pilots.get(id); if (!p || !(isFinite(x) && isFinite(y))) return false;
  const dt = Math.max(0.05, now - p.t), lim = MAX_SPEED * dt + 40;
  if (Math.abs(x - p.x) > lim) { p.flags++; return false; }
  p.x = Math.max(0, Math.min(room.world, x)); p.y = Math.max(0, Math.min(400, y)); p.t = now; room.now = Math.max(room.now, now); return true;
}

// a strike. Returns { ok, reason?, dmg?, killed? }. Damage comes from the server's table (+12 % per weapon level up to 5), never from the client.
export function hit(room, id, i, w, now, level = 1) {
  const p = room.pilots.get(id), W = WEAPONS[w], m = room.mons[i];
  if (!p || !W || !m || room.done) return { ok: false, reason: "bad" };
  if (m.dead) return { ok: false, reason: "dead" };
  if ((p.last[w] ?? -9) + W.cd * 0.85 > now) { p.flags++; return { ok: false, reason: "cooldown" }; }   // 15 % slack for network jitter
  if (Math.abs(m.x - p.x) > W.reach + 60) { p.flags++; return { ok: false, reason: "reach" }; }
  p.last[w] = now; room.now = Math.max(room.now, now);
  const dmg = Math.round(W.dmg * (1 + 0.12 * (Math.min(5, Math.max(1, level)) - 1)));
  m.hp -= dmg; p.dmg += dmg; p.strikes++;
  if (m.hp <= 0) { m.dead = true; m.hp = 0; p.kills++; room.events.push({ k: "kill", i, by: id, t: now }); if (room.mons.every(q => q.dead)) room.done = true; return { ok: true, dmg, killed: true }; }
  return { ok: true, dmg, killed: false };
}

// what the server will vouch for when the map ends: the numbers the raid counter and any future paid reward may rely on
export function result(room) {
  const secs = Math.max(0, room.now - room.t0), out = [];
  for (const p of room.pilots.values()) out.push({ id: p.id, name: p.name, kills: p.kills, dmg: p.dmg, secs: Math.round(secs), flags: p.flags, clean: p.flags <= 3 });
  return { code: room.code, map: room.map, done: room.done, totalKills: room.mons.filter(m => m.dead).length, pilots: out };
}
