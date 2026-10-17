/* GAME POWER (owner, 2026-10-17: "a power bar for playing Adventure and PvP; the way to get the power is to LEARN in the app, new content or a review
   of old content; this is how I get children to learn and practise so they can play the fun game").
   Pure bookkeeping on one localStorage key, no network, no server: the power is EARNED only by real learning events that every mode already
   reports to the one activity journal (`logActivity`, shared-infra.ts calls `powerFromActivity` right after it writes the entry), and SPENT by
   starting an Adventure map or a PvP fight. It is NOT money and cannot be bought: nothing here touches coins, gems or the shop, and no payment path
   may ever add to it (owner rule: in-game currency is never sold). Local, so a determined player can edit it on their own device; that is a pacing
   rule, not a security one (same as the map locks). */
export const GAME_POWER_ENABLED = true;
export const POWER_MAX = 100;
export const POWER_START = 60;                 // what a device starts with, so nobody is locked out before they have had a chance to learn
export const POWER_DAILY_EARN_CAP = 150;       // soft ceiling on what one day of learning can add (the bar itself caps at POWER_MAX)
/* Owner 2026-10-17: power is PLAY TIME. COST is only the least you need to be allowed in; nothing is taken at the start. While a fight or an Adventure map is
   running, 1 power is taken every DRAIN_SECS (100 power = about 20 minutes); at 0 the game stops and the learn pop-up opens. */
export const COST = { fight: 5, adventure: 5 } as const;
export const DRAIN_SECS = 12;
/* may this player start? (no spending) */
export function enterGame(min: number, adminTier = 0): boolean { return powerFree(adminTier) || readPower() >= min; }
/* one tick of play time; false = nothing left, stop the game */
export function drainPower(adminTier = 0): boolean {
  if (powerFree(adminTier)) return true;
  const s = load(); if (s.v < 1) return false;
  s.v -= 1; save(s, -1, "play"); return true;
}
const KEY = "tg_game_power", SEEN = "tg_gp_seen";

type PowerState = { v: number; d: string; today: number };
const dayKey = () => { const z = new Date(); return z.getFullYear() + "-" + String(z.getMonth() + 1).padStart(2, "0") + "-" + String(z.getDate()).padStart(2, "0"); };
function load(): PowerState {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (j && typeof j.v === "number") return { v: Math.max(0, Math.min(POWER_MAX, j.v)), d: j.d || dayKey(), today: j.d === dayKey() ? (j.today || 0) : 0 };
  } catch (e) {}
  return { v: POWER_START, d: dayKey(), today: 0 };
}
function save(s: PowerState, delta: number, why: string) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent("tg:power", { detail: { v: s.v, delta, why } })); } catch (e) {}
}
/* Coins for a round scale with how well it went (owner 2026-10-17): any round pays, a very good one pays double, a near-perfect one triple. */
export const accMult = (acc: number): number => (acc >= 90 ? 3 : acc >= 70 ? 2 : 1);
export const readPower = (): number => load().v;

/* test doors and the owner's own account: no spending, no gate */
export function powerFree(adminTier = 0): boolean {
  if (!GAME_POWER_ENABLED) return true;
  if (adminTier >= 3) return true;
  try { return localStorage.getItem("tg_gp_free") === "1" || localStorage.getItem("tg_adv_unlockall") === "1"; } catch (e) { return false; }
}
export const canSpend = (n: number, adminTier = 0): boolean => powerFree(adminTier) || readPower() >= n;
export function spendPower(n: number, why: string, adminTier = 0): boolean {
  if (powerFree(adminTier)) return true;
  const s = load(); if (s.v < n) return false;
  s.v -= n; save(s, -n, why); return true;
}
export function earnPower(n: number, why: string): number {
  if (!GAME_POWER_ENABLED || !(n > 0)) return 0;
  const s = load();
  const room = Math.max(0, POWER_DAILY_EARN_CAP - s.today), add = Math.max(0, Math.min(Math.round(n), POWER_MAX - s.v, room));
  if (!add) return 0;
  s.v += add; s.today += add; save(s, add, why); return add;
}

/* How much one reported activity is worth. `new` content (a lesson or chapter id this device has not studied before) pays more than a review of
   something already seen, but both pay: the owner wants new learning AND revision to keep the bar full.
   Only real work counts: a round needs at least five graded tries or a minute of time, and the secondary rows a mode writes for the same session
   (a skill-tagged `rhythm` / `dynamics` / `technique` row, sec 0) pay nothing, so one session is never paid twice. */
export function powerFromEntry(e: { k?: string; id?: string; ok?: number; miss?: number; sec?: number; skill?: string }, seen: Set<string>): { n: number; why: string } {
  if (!e || !e.k) return { n: 0, why: "" };
  const tries = (e.ok || 0) + (e.miss || 0), sec = e.sec || 0;
  const worked = tries >= 1 || sec >= 10;   // owner 2026-10-17: just showing up pays, right or wrong
  if (e.skill && sec === 0) return { n: 0, why: "" };
  const id = String(e.k) + ":" + String(e.id || "");
  const isNew = !seen.has(id);
  switch (e.k) {
    case "lesson": return { n: isNew ? 20 : 12, why: isNew ? "new-lesson" : "review-lesson" };
    case "read-chapter": return { n: isNew ? 12 : 7, why: isNew ? "new-chapter" : "review-chapter" };
    case "drill": return worked ? { n: 10, why: "practice" } : { n: 0, why: "" };
    case "ear": return worked ? { n: 8, why: "ear" } : { n: 0, why: "" };
    case "read": return worked ? { n: 8, why: "reading" } : { n: 0, why: "" };
    case "game": return tries >= 1 ? { n: 8, why: "song" } : { n: 0, why: "" };
    case "voice": return sec >= 20 ? { n: 8, why: "voice-tutor" } : { n: 0, why: "" };
    default: return { n: 0, why: "" };
  }
}
export function powerFromActivity(e: any): number {
  if (!GAME_POWER_ENABLED || !e) return 0;
  let seen: Set<string>;
  try { seen = new Set(JSON.parse(localStorage.getItem(SEEN) || "[]")); } catch (err) { seen = new Set(); }
  const r = powerFromEntry(e, seen);
  const id = String(e.k) + ":" + String(e.id || "");
  if ((e.k === "lesson" || e.k === "read-chapter") && !seen.has(id)) { seen.add(id); try { localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-800))); } catch (err) {} }
  return r.n ? earnPower(r.n, r.why) : 0;
}
