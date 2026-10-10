/* Robot level and the five stats (owner, 2026-10-10: STR / DEX / INT / LUK / AGI).
   Kept PER ROBOT (a robot you raise is yours; switching chassis starts another),
   on the device, like the skill SP beside it. EXP comes from fighting only and
   stat points from levelling up: nothing here is for sale and nothing pays coins.
   The skill ranks (readSkillSp in pvp-arena.tsx) are a separate bar and stay as
   they were. */
const KEY = "tg_pvp_rpg";
export const RPG_STATS = ["str", "dex", "int", "luk", "agi"] as const;
export type RpgStat = typeof RPG_STATS[number];
export const RPG_MAX_LV = 50;
export const STAT_CAP = 40;          // per stat; 49 levels x 3 points = 147 to spread over 5
export const PTS_PER_LV = 3;
export const expForLevel = (l: number) => 10 * l * (l - 1);   // total EXP to BE level l

type Pts = Record<RpgStat, number>;
type Rec = { exp: number; pts: Pts };
const zero = (): Pts => ({ str: 0, dex: 0, int: 0, luk: 0, agi: 0 });

function readAll(): Record<string, Rec> {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
function writeAll(v: Record<string, Rec>) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

export function levelFromExp(exp: number) {
  const e = Math.max(0, exp | 0);
  let l = 1;
  while (l < RPG_MAX_LV && e >= expForLevel(l + 1)) l++;
  return l;
}

export function rpgOf(model: string) {
  const r = readAll()[model] || { exp: 0, pts: zero() };
  const pts: Pts = { ...zero(), ...(r.pts || {}) };
  const exp = Math.max(0, r.exp | 0);
  const lv = levelFromExp(exp);
  const spent = RPG_STATS.reduce((a, k) => a + (pts[k] | 0), 0);
  const base = expForLevel(lv), next = expForLevel(lv + 1), max = lv >= RPG_MAX_LV;
  return { lv, exp, pts, spent, free: Math.max(0, (lv - 1) * PTS_PER_LV - spent), max,
    into: exp - base, need: max ? 0 : next - base, pct: max ? 1 : (exp - base) / (next - base) };
}

/** Award fight EXP to one robot. Returns the new level so the caller can celebrate. */
export function addRpgExp(model: string, n: number) {
  if (!model || !(n > 0)) return null;
  const all = readAll();
  const cur = all[model] || { exp: 0, pts: zero() };
  const before = levelFromExp(cur.exp);
  cur.exp = Math.max(0, (cur.exp | 0) + Math.round(n));
  all[model] = cur; writeAll(all);
  const after = levelFromExp(cur.exp);
  return { model, lv: after, leveled: after > before };
}

export function spendPoint(model: string, stat: RpgStat, delta: 1 | -1) {
  const info = rpgOf(model);
  if (delta > 0 && (info.free < 1 || info.pts[stat] >= STAT_CAP)) return false;
  if (delta < 0 && info.pts[stat] < 1) return false;
  const all = readAll();
  const cur = all[model] || { exp: info.exp, pts: zero() };
  cur.pts = { ...info.pts, [stat]: info.pts[stat] + delta };
  all[model] = cur; writeAll(all);
  return true;
}

/** Take every point back: free, because points are earned by playing, never bought. */
export function resetPoints(model: string) {
  const all = readAll();
  if (all[model]) { all[model].pts = zero(); writeAll(all); }
}

/** What the points do in a fight. All zero points = exactly 1 / 0, the old fight. */
export function rpgMods(pts: Partial<Pts> | null) {
  const p = { ...zero(), ...(pts || {}) };
  return {
    dmg: 1 + 0.012 * p.str,                  // STR: up to +48% damage
    cdMul: 1 - 0.006 * p.dex,                // DEX: up to -24% attack cooldown
    charge: 1 + 0.01 * p.int,                // INT: skill gauge fills up to +40% faster …
    spell: 1 + 0.01 * p.int,                 //      … and specials hit up to +40% harder
    crit: Math.min(0.2, 0.005 * p.luk),      // LUK: up to +20% chance of the 1.5x hit
    walk: 1 + 0.008 * p.agi,                 // AGI: up to +32% walking speed …
    dodge: Math.min(0.12, 0.003 * p.agi),    //      … and up to 12% chance to avoid a hit
  };
}
