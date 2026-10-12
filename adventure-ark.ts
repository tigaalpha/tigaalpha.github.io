/* The Ark's outfitting (owner, 2026-10-12: a generation ship with its own gravity, farms and animal decks, carrying people to a new star). Pure data and rules, no React:
   five lines bought with crystals (never with money), kept in `tg_ark`. The Ark Bay panel on the Solar System tab edits them, the Exodus run reads them: shields add
   hull points, the gravity ring decides how many of the passengers arrive healthy, the farm and livestock decks decide whether the food lasts the voyage, and what is built
   shows on the Ark itself. */
export const ARK_LINES = ["g", "f", "l", "h", "s"] as const;
export const ARK_MAX = 5, ARK_TRIP_DAYS = 600;
export const arkCost = (lv: number) => 30 * (lv + 1);   // 30, 60, 90, 120, 150 crystals
export type ArkLv = Record<(typeof ARK_LINES)[number], number>;
export const readArk = (): ArkLv => { const o: any = { g: 0, f: 0, l: 0, h: 0, s: 0 }; try { const v = JSON.parse(localStorage.getItem("tg_ark") || "{}") || {}; for (const k of ARK_LINES) o[k] = Math.max(0, Math.min(ARK_MAX, v[k] | 0)); } catch (e) {} return o; };
export function buyArk(line: string, have: number): { ok: boolean; cost: number } {
  const a = readArk(); if (!(ARK_LINES as readonly string[]).includes(line) || (a as any)[line] >= ARK_MAX) return { ok: false, cost: 0 };
  const c = arkCost((a as any)[line]); if (have < c) return { ok: false, cost: c };
  try { (a as any)[line]++; localStorage.setItem("tg_ark", JSON.stringify(a)); return { ok: true, cost: c }; } catch (e) { return { ok: false, cost: 0 }; }
}
export function arkStats(a: ArkLv) {
  const gravity = Math.round((0.4 + 0.12 * a.g) * 100) / 100;                  // in g: 0.4 with no ring, 1.0 at level 5
  const health = Math.min(1, gravity / 0.8);                                     // people need about 0.8 g to stay well on a long trip
  const people = Math.round((8000 + 24000 * a.h) * health);                      // passengers who arrive healthy
  const foodDays = 200 + 90 * a.f + 60 * a.l;                                    // the farm decks and the livestock decks feed the voyage
  const hull = 1 + 0.12 * a.s;                                                   // x hull points in the Exodus run
  return { gravity, health, people, foodDays, hull, foodOk: foodDays >= ARK_TRIP_DAYS };
}
