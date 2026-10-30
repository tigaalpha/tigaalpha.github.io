/* Alien Hunt simulation (plan 38, phases A-D + the tune-up clock of E2). Pure: no three.js, no DOM, no storage, so scripts/smoke-alien-hunt.mjs runs the real file.
   Units are metres on the x/z plane, y is up; the player's eyes are 1.65 m above the floor. */

import { LEVELS, BOXES_1, type Hazard, type Level, type MissionSpec } from "./ah-levels";
export type Box = { x: number; z: number; w: number; d: number; h: number };
export type WeaponId = "pistol" | "rifle" | "shotgun" | "launcher" | "laser" | "rail" | "arc" | "beam" | "pulsar" | "nova" | "storm" | "cryo" | "rpg" | "salvo";
export type AlienKind = "skitter" | "mantis" | "spitter" | "flarecaster" | "charger" | "skyeye" | "scarab" | "behemoth" | "wisp" | "drone" | "stalker" | "warden" | "matriarch" | "walker" | "glowbug" | "thornback" | "sporecaster" | "hound" | "lumawarden" | "leaper" | "spiker" | "veilmaw" | "bloater" | "razor" | "titan" | "capling" | "manthood" | "domestalker" | "xenodrone" | "huntsman" | "greyling" | "hydraling" | "warbug" | "saberlord" | "skyfolk" | "leviathan" | "tripod" | "carapace";
export type Enemy = { id: number; kind: AlienKind; x: number; z: number; hp: number; max: number; yaw: number; t: number; cd: number; dead: number; flash: number; leap: number; side?: number; sideT?: number; gt?: number; tele?: number; rush?: number; stun?: number; dx?: number; dz?: number; slow?: number; bt?: number; vt?: number; mt?: number };
export type Acid = { rt?: "plasma" | "rpg" | "salvo"; id: number; x: number; y: number; z: number; vx: number; vz: number; vy: number; life: number; g?: number; dmg?: number; big?: number; col?: number };
export type Ev = { k: "shot" | "hit" | "kill" | "head" | "hurt" | "reload" | "empty" | "spit" | "wave" | "tune" | "win" | "lose" | "swap" | "station" | "dig" | "strike"; x?: number; y?: number; z?: number; n?: number; w?: string; p?: number[] };

export const ARENA = 34;   // half size
export const EYE = 1.65;
export const WEAPONS: Record<WeaponId, { name: string; dmg: number; rate: number; mag: number; reserve: number; spread: number; pellets: number; auto: boolean; reload: number; range: number; kick: number; col: number }> = {
  pistol: { name: "Pulse sidearm", dmg: 16, rate: 0.26, mag: 12, reserve: 9999, spread: 0.004, pellets: 1, auto: false, reload: 1.1, range: 80, kick: 0.012, col: 0x58e8ff },
  rifle: { name: "Plasma rifle", dmg: 12, rate: 0.085, mag: 30, reserve: 150, spread: 0.012, pellets: 1, auto: true, reload: 1.6, range: 90, kick: 0.006, col: 0x7affb0 },
  shotgun: { name: "Ion scatter", dmg: 10, rate: 0.85, mag: 6, reserve: 36, spread: 0.07, pellets: 8, auto: false, reload: 2.2, range: 26, kick: 0.05, col: 0xc77aff },
  launcher: { name: "Plasma launcher", dmg: 0, rate: 1.1, mag: 4, reserve: 8, spread: 0, pellets: 0, auto: false, reload: 2.6, range: 60, kick: 0.07, col: 0x66ffb0 },
  laser: { name: "Laser SMG", dmg: 8, rate: 0.055, mag: 45, reserve: 180, spread: 0.01, pellets: 1, auto: true, reload: 1.5, range: 90, kick: 0.003, col: 0xff4a5a },
  rail: { name: "Rail cannon", dmg: 80, rate: 1.0, mag: 5, reserve: 25, spread: 0, pellets: 1, auto: false, reload: 2.0, range: 120, kick: 0.06, col: 0xa8c8ff },
  arc: { name: "Arc caster", dmg: 24, rate: 0.35, mag: 18, reserve: 72, spread: 0, pellets: 0, auto: true, reload: 1.8, range: 30, kick: 0.01, col: 0x9ad8ff },
  pulsar: { name: "Pulsar burst", dmg: 9, rate: 0.2, mag: 36, reserve: 144, spread: 0.022, pellets: 3, auto: true, reload: 1.7, range: 70, kick: 0.012, col: 0xff4fd8 },
  nova: { name: "Nova cannon", dmg: 58, rate: 0.55, mag: 8, reserve: 40, spread: 0.002, pellets: 1, auto: false, reload: 2.1, range: 100, kick: 0.05, col: 0x7dffe0 },
  storm: { name: "Storm twin-laser", dmg: 6, rate: 0.045, mag: 70, reserve: 280, spread: 0.028, pellets: 2, auto: true, reload: 2.0, range: 80, kick: 0.004, col: 0xff9a2e },
  cryo: { name: "Cryo beam", dmg: 7, rate: 0.06, mag: 60, reserve: 240, spread: 0.006, pellets: 1, auto: true, reload: 1.9, range: 60, kick: 0.002, col: 0x9fe8ff },
  rpg: { name: "RPG-7 Hellfire", dmg: 0, rate: 1.3, mag: 1, reserve: 9, spread: 0, pellets: 0, auto: false, reload: 2.4, range: 80, kick: 0.1, col: 0xff8a3a },
  salvo: { name: "Rocket barrage", dmg: 0, rate: 0.17, mag: 16, reserve: 80, spread: 0.02, pellets: 0, auto: true, reload: 2.7, range: 70, kick: 0.03, col: 0xffd24a },
  beam: { name: "Photon lance", dmg: 5, rate: 0.04, mag: 90, reserve: 270, spread: 0.002, pellets: 1, auto: true, reload: 2.2, range: 70, kick: 0.002, col: 0xffe45a },
};
export const ALIENS: Record<AlienKind, { name: string; hp: number; speed: number; r: number; dmg: number; reach: number; score: number; hy: number; cy?: number; nohead?: boolean; boss?: boolean }> = {
  skitter: { name: "Skitter", hp: 26, speed: 6.2, r: 0.5, dmg: 6, reach: 1.15, score: 50, hy: 0.55 },
  mantis: { name: "Drone Mantis", hp: 95, speed: 3.4, r: 0.7, dmg: 17, reach: 1.8, score: 150, hy: 1.55 },
  spitter: { name: "Spitter", hp: 62, speed: 2.6, r: 0.65, dmg: 11, reach: 0, score: 120, hy: 1.35 },
  flarecaster: { name: "Flarecaster", hp: 85, speed: 2.9, r: 0.7, dmg: 0, reach: 0, score: 180, hy: 1.6 },
  charger: { name: "Plated Charger", hp: 170, speed: 3.0, r: 0.9, dmg: 24, reach: 1.7, score: 230, hy: 1.1, nohead: true },
  skyeye: { name: "Sky Eye", hp: 58, speed: 2.4, r: 0.75, dmg: 0, reach: 0, score: 170, hy: 3.2, cy: 2.6, nohead: true },
  scarab: { name: "Scarab", hp: 18, speed: 7.5, r: 0.4, dmg: 5, reach: 1.0, score: 35, hy: 0.5 },
  behemoth: { name: "Behemoth", hp: 260, speed: 2.6, r: 1.0, dmg: 30, reach: 1.9, score: 300, hy: 1.5, nohead: true },
  wisp: { name: "Wisp", hp: 40, speed: 3.6, r: 0.6, dmg: 0, reach: 0, score: 140, hy: 3.0, cy: 2.4, nohead: true },
  drone: { name: "War Drone", hp: 70, speed: 2.8, r: 0.6, dmg: 0, reach: 0, score: 130, hy: 1.5 },
  stalker: { name: "Stalker", hp: 80, speed: 4.2, r: 0.6, dmg: 14, reach: 1.7, score: 160, hy: 1.8 },
  warden: { name: "Hive Warden", hp: 600, speed: 3.4, r: 1.0, dmg: 36, reach: 2.0, score: 1500, hy: 1.6, nohead: true, boss: true },
  matriarch: { name: "Cinder Matriarch", hp: 800, speed: 2.2, r: 0.8, dmg: 0, reach: 0, score: 2000, hy: 1.8, boss: true },
  glowbug: { name: "Glowbug", hp: 30, speed: 6.0, r: 0.5, dmg: 6, reach: 1.15, score: 50, hy: 0.55 },
  thornback: { name: "Thornback", hp: 140, speed: 3.0, r: 0.9, dmg: 20, reach: 1.7, score: 200, hy: 1.1, nohead: true },
  sporecaster: { name: "Sporecaster", hp: 80, speed: 2.7, r: 0.7, dmg: 0, reach: 0, score: 170, hy: 1.8 },
  hound: { name: "Shadow Hound", hp: 60, speed: 7.0, r: 0.55, dmg: 9, reach: 1.2, score: 90, hy: 0.8 },
  lumawarden: { name: "Luma Warden", hp: 650, speed: 3.2, r: 1.0, dmg: 34, reach: 2.0, score: 1800, hy: 1.7, nohead: true, boss: true },
  leaper: { name: "Leaper", hp: 34, speed: 7.2, r: 0.5, dmg: 7, reach: 1.1, score: 60, hy: 0.7 },
  spiker: { name: "Spine Imp", hp: 90, speed: 3.0, r: 0.65, dmg: 0, reach: 0, score: 190, hy: 1.7 },
  veilmaw: { name: "Veilmaw", hp: 70, speed: 2.8, r: 0.8, dmg: 0, reach: 0, score: 200, hy: 3.1, cy: 2.5, nohead: true },
  bloater: { name: "Bloater", hp: 150, speed: 2.2, r: 0.9, dmg: 10, reach: 0, score: 210, hy: 1.4 },
  razor: { name: "Razorrunner", hp: 75, speed: 5.0, r: 0.55, dmg: 15, reach: 1.9, score: 170, hy: 1.9 },
  titan: { name: "Hive Titan", hp: 1100, speed: 3.0, r: 1.1, dmg: 40, reach: 2.2, score: 3000, hy: 2.4, nohead: true, boss: true },
  capling: { name: "Hammerhead", hp: 80, speed: 3.0, r: 0.6, dmg: 0, reach: 0, score: 190, hy: 2.3 },
  manthood: { name: "Hood Walker", hp: 130, speed: 3.6, r: 0.65, dmg: 18, reach: 2.4, score: 240, hy: 2.5 },
  xenodrone: { name: "Night Drone", hp: 95, speed: 6.0, r: 0.6, dmg: 20, reach: 2.0, score: 260, hy: 1.9 },
  huntsman: { name: "Trophy Hunter", hp: 220, speed: 3.2, r: 0.7, dmg: 22, reach: 2.2, score: 420, hy: 2.3 },
  greyling: { name: "Grey Visitor", hp: 70, speed: 3.4, r: 0.5, dmg: 10, reach: 1.8, score: 200, hy: 1.9 },
  hydraling: { name: "Hydra Fiend", hp: 90, speed: 3.8, r: 0.6, dmg: 14, reach: 2.0, score: 240, hy: 1.5 },
  warbug: { name: "War Bug", hp: 150, speed: 4.2, r: 0.8, dmg: 22, reach: 2.2, score: 300, hy: 1.4 },
  saberlord: { name: "Saber Lord", hp: 260, speed: 3.4, r: 0.75, dmg: 26, reach: 2.4, score: 480, hy: 2.3 },
  skyfolk: { name: "Sky Warrior", hp: 110, speed: 5.2, r: 0.6, dmg: 18, reach: 2.0, score: 280, hy: 2.3 },
  leviathan: { name: "Leviathan", hp: 700, speed: 2.4, r: 1.0, dmg: 30, reach: 2.8, score: 900, hy: 2.6 },
  tripod: { name: "Tripod Invader", hp: 420, speed: 2.6, r: 1.0, dmg: 24, reach: 2.6, score: 650, hy: 3.4 },
  carapace: { name: "Scythe Beast", hp: 180, speed: 4.6, r: 0.75, dmg: 24, reach: 2.4, score: 380, hy: 1.6 },
  domestalker: { name: "Dome Stalker", hp: 110, speed: 5.4, r: 0.7, dmg: 18, reach: 1.9, score: 230, hy: 1.5 },
  walker: { name: "Harvester Walker", hp: 1400, speed: 2.0, r: 1.0, dmg: 0, reach: 0, score: 4000, hy: 4.5, cy: 3.4, nohead: true, boss: true },
};
/** the aliens are human-sized or bigger (owner, 2026-10-18: "as big as a person, scarier"): the table above is the small design, this scales every body and its hit box */
export const ALIEN_SCALE: Record<AlienKind, number> = { skitter: 1.9, mantis: 1.3, spitter: 1.3, flarecaster: 1.2, charger: 1.55, skyeye: 1.3, scarab: 1.5, behemoth: 1.7, wisp: 1.1, drone: 1.2, stalker: 1.25, warden: 2.4, matriarch: 2.2, walker: 2.0, glowbug: 1.7, thornback: 1.6, sporecaster: 1.25, hound: 1.5, lumawarden: 2.5, leaper: 1.6, spiker: 1.35, veilmaw: 1.35, bloater: 1.5, razor: 1.3, titan: 2.6, capling: 1.5, manthood: 1.45, domestalker: 1.5, xenodrone: 1.45, huntsman: 1.5, greyling: 1.5, hydraling: 1.9, warbug: 1.6, saberlord: 1.6, skyfolk: 1.5, leviathan: 2.0, tripod: 1.7, carapace: 1.6 };
/** the behaviour a species borrows: new races look different but move and fight like a known role */
export const BEH: Partial<Record<AlienKind, AlienKind>> = { scarab: "skitter", behemoth: "charger", wisp: "skyeye", drone: "spitter", stalker: "mantis", warden: "charger", matriarch: "flarecaster", walker: "skyeye", glowbug: "skitter", thornback: "charger", sporecaster: "flarecaster", hound: "skitter", lumawarden: "charger", leaper: "skitter", spiker: "flarecaster", veilmaw: "skyeye", bloater: "spitter", razor: "mantis", titan: "charger", capling: "flarecaster", manthood: "mantis", domestalker: "stalker", xenodrone: "mantis", huntsman: "flarecaster", greyling: "flarecaster", hydraling: "flarecaster", warbug: "charger", saberlord: "charger", skyfolk: "mantis", leviathan: "charger", tripod: "flarecaster", carapace: "mantis" };
export const behOf = (k: AlienKind): AlienKind => BEH[k] || k;
const MINIONS: Partial<Record<AlienKind, AlienKind[]>> = { warden: ["scarab", "stalker"], matriarch: ["skitter", "stalker"], titan: ["leaper", "razor"], walker: ["wisp", "drone"], lumawarden: ["glowbug", "hound"] };
for (const k of Object.keys(ALIENS) as AlienKind[]) { const A = ALIENS[k], f = ALIEN_SCALE[k]; A.r *= f; A.hy *= f; if (A.cy !== undefined) A.cy *= f; if (A.reach > 0) A.reach *= f; }
export const bodyY = (k: AlienKind) => { const A = ALIENS[k]; return A.cy !== undefined ? A.cy : A.hy * 0.62; };
export const CLASSIC_WAVES: AlienKind[][] = [
  ["skitter", "skitter", "skitter"],
  ["skitter", "skitter", "skitter", "mantis"],
  ["mantis", "skitter", "mantis", "skitter", "flarecaster"],
  ["charger", "skyeye", "spitter", "skitter", "skitter", "mantis"],
  ["charger", "flarecaster", "mantis", "mantis", "skyeye", "spitter", "skitter", "skitter"],
];
export const WAVES = CLASSIC_WAVES;
export const LEVEL_BOXES: Box[] = BOXES_1;

/** a weapon bought in the shop and equipped on the robot: it unlocks the matching gun from the start and hits harder by its rarity (owner, 2026-10-18) */
export type ShopW = { as: WeaponId; m: number; name: string; col: number };
/** a mission (Robot Adventure 3D, plan 39 P3): survive a clock, hold stations, dig ore or call an orbital strike; the waves keep coming while it runs */
export type MItem = { x: number; z: number; r: number; p: number; hp: number; done: boolean; cd?: number };
export type Mission = { type: MissionSpec["type"]; secs: number; hold: number; goal: number; prog: number; t: number; items: MItem[]; phase: number; digCd: number; boss?: AlienKind; ask: number; label?: [string, string, string] };
export type State = {
  ms: Mission | null; peaceful: boolean;
  auto: boolean; autoFire: boolean; autoSide: number; autoT: number; autoMv: number; autoPx: number; autoPz: number;
  t: number; active: number; rng: number; seed: number;
  p: { x: number; z: number; yaw: number; pitch: number; y: number; vy: number; hp: number; shield: number; inv: number; sprint: boolean; slide: number; slideCd: number; sdx: number; sdz: number };
  weapon: WeaponId; ammo: Record<WeaponId, { mag: number; res: number }>; cd: number; reload: number; recoil: number;
  enemies: Enemy[]; acid: Acid[]; rk: Acid[]; boxes: Box[]; pk: { id: number; x: number; z: number; w: WeaponId | "ammo" }[]; owned: Record<WeaponId, boolean>;
  wave: number; waveLeft: number; between: number; spawnQ: AlienKind[]; spawnT: number; done: boolean; won: boolean;
  kills: number; heads: number; shots: number; hitsLanded: number; score: number; streak: number; best: number;
  tuneEvery: number; tuneT: number; frozen: boolean; grace: number; tunes: number; tuneRight: number; tuneStreak: number; boost: number;
  nextId: number; ev: Ev[];
  coins: number; shopW: ShopW | null;
  lv: number; waves: AlienKind[][]; hpk: number; gunPool: WeaponId[]; hz: Hazard[]; hzClock: number; hzT: number;
};

export function mulberry(s: number) { return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function newState(seed = 7, tuneEvery = 30, level = 0, startGuns: WeaponId[] = [], shopW: ShopW | null = null, lvObj: Level | null = null): State {   // lvObj: a level that is not in the Alien Hunt campaign (Robot Adventure 3D passes its own)
  if (shopW && !startGuns.includes(shopW.as)) startGuns = [...startGuns, shopW.as];
  const L = lvObj || (level > 0 ? LEVELS[Math.min(level, LEVELS.length) - 1] : null);
  const ammo: any = {}; for (const k of Object.keys(WEAPONS) as WeaponId[]) ammo[k] = { mag: WEAPONS[k].mag, res: WEAPONS[k].reserve };
  return {
    peaceful: !!(L && L.peaceful), ms: L && L.mission ? { type: L.mission.type, secs: L.mission.secs || 0, hold: L.mission.hold || 8, goal: L.mission.type === "survive" ? (L.mission.secs || 90) : (L.mission.pts || []).length, prog: 0, t: 0, phase: 0, digCd: 0, boss: L.mission.boss, ask: -1, label: L.mission.label, items: (L.mission.pts || []).map(([x, z]) => ({ x, z, r: L.mission!.type === "mine" ? 1.6 : 3.2, p: 0, hp: L.mission!.type === "mine" ? 3 : 1, done: false, cd: 0 })) } : null,
    t: 0, active: 0, rng: seed, seed, auto: false, autoFire: true, autoSide: 1, autoT: 0, autoMv: 0, autoPx: 0, autoPz: 22,
    p: { x: 0, z: 22, yaw: Math.PI, pitch: 0, y: 0, vy: 0, hp: 100, shield: 0, inv: 0, sprint: false, slide: 0, slideCd: 0, sdx: 0, sdz: 0 },
    coins: 0, shopW, weapon: shopW ? shopW.as : "pistol", ammo, cd: 0, reload: 0, recoil: 0,
    enemies: [], acid: [], rk: [], boxes: L ? L.boxes : LEVEL_BOXES, pk: [], owned: Object.fromEntries(WORDER.map(w => [w, w === "pistol" || startGuns.includes(w)])) as Record<WeaponId, boolean>,
    wave: 0, waveLeft: 0, between: 3, spawnQ: [], spawnT: 0, done: false, won: false,
    kills: 0, heads: 0, shots: 0, hitsLanded: 0, score: 0, streak: 0, best: 0,
    tuneEvery: L && L.mission && L.mission.type !== "survive" ? 0 : tuneEvery, tuneT: 0, frozen: false, grace: 0, tunes: 0, tuneRight: 0, tuneStreak: 0, boost: 0,
    nextId: 1, ev: [],
    lv: L ? L.id : 0, waves: L ? L.waves : CLASSIC_WAVES, hpk: L ? L.hpk : 1, gunPool: L ? (L.guns.length ? L.guns : WORDER.filter(w => w !== "pistol")) : WORDER.slice(), hz: L ? L.hazards : [], hzClock: 0, hzT: 0,
  };
}
const shopMul = (s: State, w: WeaponId = s.weapon) => (s.shopW && s.shopW.as === w ? s.shopW.m : 1);
const coinOf = (s: State, k: AlienKind) => Math.round((ALIENS[k].boss ? 40 : ALIENS[k].hp >= 200 ? 6 : ALIENS[k].hp >= 50 ? 3 : 2) * (1 + 0.1 * s.lv));
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

export type Input = { dig?: boolean; mx: number; mz: number; lookX: number; lookY: number; fire: boolean; jump: boolean; reload: boolean; swap: number; sprint: boolean; slide?: boolean };
export const noInput = (): Input => ({ mx: 0, mz: 0, lookX: 0, lookY: 0, fire: false, jump: false, reload: false, swap: 0, sprint: false });

export const WORDER: WeaponId[] = ["pistol", "rifle", "laser", "shotgun", "arc", "beam", "pulsar", "storm", "cryo", "nova", "rail", "launcher", "salvo", "rpg"];
const rushingNow = (e: Enemy) => behOf(e.kind) === "charger" && (e.rush || 0) > 0;
export function setWeapon(s: State, w: WeaponId) { if (s.weapon === w || !s.owned[w]) return; s.weapon = w; s.reload = 0; s.cd = 0.25; s.ev.push({ k: "swap", w }); }
function startReload(s: State) { const a = s.ammo[s.weapon], W = WEAPONS[s.weapon]; if (s.reload > 0 || a.mag >= W.mag || a.res <= 0) return; s.reload = W.reload; s.ev.push({ k: "reload" }); }
export function fullReload(s: State) { for (const k of Object.keys(WEAPONS) as WeaponId[]) { s.ammo[k].mag = WEAPONS[k].mag; s.ammo[k].res = Math.max(s.ammo[k].res, WEAPONS[k].mag * 2); } s.reload = 0; }

function spawnAlien(s: State, kind: AlienKind, at?: [number, number]) {
  const A = ALIENS[kind]; let x = 0, z = 0;
  if (at) { x = at[0]; z = at[1]; } else for (let i = 0; i < 12; i++) {   // on the arena edge, away from the player
    const a = rnd(s) * Math.PI * 2; x = Math.cos(a) * (ARENA - 2); z = Math.sin(a) * (ARENA - 2);
    if (Math.hypot(x - s.p.x, z - s.p.z) > 18) break;
  }
  const [cx, cz] = collide(s.boxes, x, z, A.r);
  s.ev.push({ k: "spawn", w: kind, x: cx, z: cz });
  s.enemies.push({ id: s.nextId++, kind, x: cx, z: cz, hp: A.hp * (1 + s.wave * 0.06) * s.hpk * (A.boss ? 1.8 : 1), max: A.hp * (1 + s.wave * 0.06) * s.hpk * (A.boss ? 1.8 : 1), yaw: 0, t: rnd(s) * 6, cd: 0.8 + rnd(s), dead: 0, flash: 0, leap: 0 });
}

const BOOM_R = 4.6;
function explode(s: State, x: number, y: number, z: number, R = BOOM_R, D = 130, big = 1, mul = 1) {
  s.ev.push({ k: "boom", x, y, z, n: big }); s.shots += 0;
  let any = false;
  for (const e of s.enemies) {
    if (e.dead !== 0) continue; const d = Math.hypot(e.x - x, e.z - z); if (d > R + ALIENS[e.kind].r) continue;
    const dmg = D * mul * Math.max(0.25, 1 - d / (R + 1)) * (1 + s.boost); e.hp -= dmg; e.flash = 0.15; any = true; s.ev.push({ k: "hit", x: e.x, y: 1, z: e.z, n: dmg });
    if (e.hp <= 0) { e.dead = 0.9; s.kills++; s.coins += coinOf(s, e.kind); s.streak++; s.best = Math.max(s.best, s.streak); s.score += Math.round(ALIENS[e.kind].score * (1 + Math.min(s.streak, 10) * 0.1)); s.ev.push({ k: "kill", x: e.x, z: e.z, w: e.kind }); }
  }
  if (any) s.hitsLanded++;
  const dp = Math.hypot(s.p.x - x, s.p.z - z); if (dp < R * 0.7) hurtPlayer(s, (18 * (1 - dp / (R * 0.7)) + 4) * (R > BOOM_R ? 1.2 : D < 100 ? 0.5 : 1), x, z);
}
function hurtPlayer(s: State, n: number, x?: number, z?: number) {
  if (s.p.inv > 0 || s.done) return;
  let d = n * 0.8; if (s.p.shield > 0) { const a = Math.min(s.p.shield, d); s.p.shield -= a; d -= a; }
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
const unowned = (s: State) => s.gunPool.filter(w => !s.owned[w]);
/** one hit on an alien: damage, kill bookkeeping and a chance to drop something to pick up */
function hurtAlien(s: State, e: Enemy, dmg: number, head: boolean, hy?: number) {
  const A = ALIENS[e.kind]; e.hp -= dmg; e.flash = 0.12; s.ev.push({ k: "hit", x: e.x, y: hy !== undefined ? hy : bodyY(e.kind), z: e.z, n: dmg, w: s.weapon });
  if (e.hp <= 0 && e.dead === 0) {
    e.dead = 0.9; s.kills++; s.coins += coinOf(s, e.kind); s.streak++; s.best = Math.max(s.best, s.streak); if (head) s.heads++;
    s.score += Math.round(A.score * (head ? 1.5 : 1) * (1 + Math.min(s.streak, 10) * 0.1)); s.ev.push({ k: head ? "head" : "kill", x: e.x, z: e.z, w: e.kind });
    const r = rnd(s), un = unowned(s);
    if (un.length && r < 0.2) spawnPickup(s, un[0], e.x, e.z); else if (r < 0.32) spawnPickup(s, "ammo", e.x, e.z);
  }
}
/** hidden aim assist (owner, 2026-10-18: "make it a little easier, but do not tell the player"): when an alien is within about 6 degrees of the crosshair the shot bends toward its body (fully inside 2.5 degrees, fading out to 6) */
function assistAim(s: State, range: number) {
  const ox = s.p.x, oy = EYE + s.p.y, oz = s.p.z; const fx = -Math.sin(s.p.yaw) * Math.cos(s.p.pitch), fy = Math.sin(s.p.pitch), fz = -Math.cos(s.p.yaw) * Math.cos(s.p.pitch);
  let best: Enemy | null = null, bang = 0.105;
  for (const e of s.enemies) { if (e.dead !== 0) continue; const vx = e.x - ox, vy = bodyY(e.kind) - oy, vz = e.z - oz, d = Math.hypot(vx, vy, vz); if (d > range || d < 1) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (vx * fx + vy * fy + vz * fz) / d))); if (ang < bang) { bang = ang; best = e; } }
  if (!best) return; const vx = best.x - ox, vy = bodyY(best.kind) - oy, vz = best.z - oz, hd = Math.hypot(vx, vz) || 1;
  const k = bang < 0.044 ? 1 : 1 - (bang - 0.044) / 0.061;
  const ty = Math.atan2(-vx, -vz), tp = Math.atan2(vy, hd); let dy = ty - s.p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  s.p.yaw += dy * k; s.p.pitch += (tp - s.p.pitch) * k;
}
function fire(s: State) {
  const W = WEAPONS[s.weapon], a = s.ammo[s.weapon];
  if (a.mag <= 0) { s.ev.push({ k: "empty" }); if (a.res <= 0) { setWeapon(s, "pistol"); return; } startReload(s); s.cd = 0.25; return; }
  a.mag--; s.cd = W.rate; s.shots++; s.recoil = Math.min(1, s.recoil + W.kick * 14); s.ev.push({ k: "shot", w: s.weapon });
  const cp = Math.cos(s.p.pitch), ox = s.p.x, oy = EYE + s.p.y, oz = s.p.z;
  if (s.weapon === "launcher" || s.weapon === "rpg" || s.weapon === "salvo") {
    let dx = -Math.sin(s.p.yaw) * cp, dy = Math.sin(s.p.pitch), dz = -Math.cos(s.p.yaw) * cp; const rt = s.weapon === "launcher" ? "plasma" : s.weapon, V = rt === "plasma" ? 26 : rt === "rpg" ? 34 : 38;
    if (rt === "salvo") { const sp = 0.03; dx += (rnd(s) - 0.5) * sp; dy += (rnd(s) - 0.5) * sp; dz += (rnd(s) - 0.5) * sp; }
    s.rk.push({ rt, id: s.nextId++, x: ox + dx * 0.8, y: oy - 0.1 + dy * 0.8, z: oz + dz * 0.8, vx: dx * V, vy: dy * V, vz: dz * V, life: rt === "plasma" ? 3.2 : 2.6 }); return;
  }
  if (s.weapon === "arc") {   // chain lightning: the alien nearest the crosshair, then up to three more near it
    const ax = -Math.sin(s.p.yaw) * cp, ay = Math.sin(s.p.pitch), az = -Math.cos(s.p.yaw) * cp; const hit: Enemy[] = [];
    let first: Enemy | null = null, fb = 0.4;
    for (const e of s.enemies) { if (e.dead !== 0) continue; const vx = e.x - ox, vy = bodyY(e.kind) - oy, vz = e.z - oz, d = Math.hypot(vx, vy, vz); if (d > W.range || d < 0.1) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (vx * ax + vy * ay + vz * az) / d))); if (ang < fb) { fb = ang; first = e; } }
    const pts = [ox, oy - 0.15, oz];
    if (first) { hit.push(first); for (let k = 0; k < 3; k++) { const last = hit[hit.length - 1]; let nx: Enemy | null = null, nd = 7; for (const e of s.enemies) if (e.dead === 0 && !hit.includes(e)) { const d = Math.hypot(e.x - last.x, e.z - last.z); if (d < nd) { nd = d; nx = e; } } if (!nx) break; hit.push(nx); } }
    else pts.push(ox + ax * 9, oy + ay * 9 - 0.15, oz + az * 9);
    hit.forEach((e, i) => { pts.push(e.x, bodyY(e.kind), e.z); hurtAlien(s, e, W.dmg * shopMul(s) * Math.pow(0.75, i) * (1 + s.boost), false); }); if (hit.length) s.hitsLanded++;
    s.ev.push({ k: "arc", p: pts }); return;
  }
  const moving = 1 + s.recoil * 0.9;
  let landed = false;
  const y0 = s.p.yaw, p0 = s.p.pitch; assistAim(s, W.range);   // a hidden nudge toward the alien nearest the crosshair; the view itself is put back after the shot
  try {
  if (s.weapon === "rail") {   // pierces everything on the line
    const dx = -Math.sin(s.p.yaw) * cp, dy = Math.sin(s.p.pitch), dz = -Math.cos(s.p.yaw) * cp;
    let wall = W.range; for (const b of s.boxes) { const t = rayBox(ox, oy, oz, dx, dy, dz, b); if (t < wall) wall = t; } if (dy < 0) { const tg = -oy / dy; if (tg < wall) wall = tg; }
    const list: [Enemy, boolean][] = [];
    for (const e of s.enemies) { if (e.dead !== 0) continue; const A = ALIENS[e.kind]; const tb = raySphere(ox, oy, oz, dx, dy, dz, e.x, bodyY(e.kind), e.z, A.r * 1.05), th = A.nohead ? Infinity : raySphere(ox, oy, oz, dx, dy, dz, e.x, A.hy + 0.5 * A.r * 1.1, e.z, A.r * 0.5); if (Math.min(tb, th) < wall) list.push([e, th < tb]); }
    for (const [e, hd] of list) { hurtAlien(s, e, W.dmg * shopMul(s) * (hd ? 2.0 : 1) * (1 + s.boost) * (behOf(e.kind) === "charger" ? ((e.rush || 0) > 0 || (e.stun || 0) > 0 ? 1.8 : 0.7) : 1), hd, hd ? ALIENS[e.kind].hy + 0.5 : undefined); landed = true; }
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
      const fall = Math.max(0.55, 1 - bt / (W.range * 1.4)); const dmg = W.dmg * shopMul(s) * fall * (head ? 2.2 : 1) * (1 + s.boost) * (behOf(best.kind) === "charger" ? ((best.rush || 0) > 0 || (best.stun || 0) > 0 ? 1.8 : 0.55) : 1);
      landed = true; if (s.weapon === "cryo") best.slow = 1.6; hurtAlien(s, best, dmg, head, head ? ALIENS[best.kind].hy + 0.5 : undefined);
    }
  }
  if (landed) s.hitsLanded++;
  if (a.mag <= 0 && a.res > 0) startReload(s);
  } finally { s.p.yaw = y0; s.p.pitch = p0; }
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
  let mt: MItem | null = null, md = 1e9; if (s.ms && !(s.ms.phase === 1)) for (const it of s.ms.items) { if (it.done) continue; const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < md) { md = d; mt = it; } }
  if (mt && (!near || nd > 6) && !(pk && pd < 8)) { if (md > (s.ms!.type === "mine" ? 2.2 : mt.r * 0.5)) { wx = (mt.x - p.x) / md; wz = (mt.z - p.z) / md; } }
  else if (pk && pd < 28 && (!near || nd > 6)) { wx = (pk.x - p.x) / pd; wz = (pk.z - p.z) / pd; }
  else if (near) {
    const tx = (near.x - p.x) / (nd || 1), tz = (near.z - p.z) / (nd || 1), sx = -tz * s.autoSide, sz = tx * s.autoSide;
    if (nd < 7) { wx = -tx * 0.9 + sx * 0.5; wz = -tz * 0.9 + sz * 0.5; }
    else if (nd > 13) { wx = tx * 0.8 + sx * 0.5; wz = tz * 0.8 + sz * 0.5; }
    else { wx = sx + tx * (nd - 10) * 0.05; wz = sz + tz * (nd - 10) * 0.05; }
  } else if (Math.hypot(p.x, p.z) > 10) { const d = Math.hypot(p.x, p.z); wx = -p.x / d * 0.6; wz = -p.z / d * 0.6; }
  const edge = ARENA - 5; if (Math.abs(p.x) > edge) wx -= Math.sign(p.x) * 1.2; if (Math.abs(p.z) > edge) wz -= Math.sign(p.z) * 1.2;
  for (const a of s.acid) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < 6 && p.slideCd <= 0) slide = true; }
  for (const e of alive) if (behOf(e.kind) === "charger" && (e.rush || 0) > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 9 && p.slideCd <= 0) slide = true;
  const L = Math.hypot(wx, wz); if (L > 1) { wx /= L; wz /= L; }
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  return { mx: wx * rx + wz * rz, mz: wx * fx + wz * fz, slide };
}
/** a mission step that needs a music question: the fight freezes, the page asks (the same tune-up card), and tuneResult() lands in missionAnswer() */
function askItem(s: State, i: number) { const m = s.ms as Mission; m.ask = i; s.frozen = true; s.ev.push({ k: "tune", n: 1 }); }
function missionAnswer(s: State, ok: boolean | null) {
  const m = s.ms as Mission, it = m.items[m.ask]; m.ask = -1; s.frozen = false; s.grace = 1.5;
  if (!it) return;
  if (ok) { it.done = true; m.prog++; s.tuneRight++; s.tuneStreak++; s.score += 150; s.ev.push({ k: "station", n: s.ms!.items.indexOf(it) }); }
  else { s.tuneStreak = 0; it.p = 0; it.hp = m.type === "mine" ? 1 : 1; it.cd = 6; }
}
const winNow = (s: State) => { s.done = true; s.won = true; s.ev.push({ k: "win" }); };
function missionStep(s: State, dt: number, inp: Input) {
  const m = s.ms as Mission, p = s.p;
  if (m.type === "survive") { m.t += dt; m.prog = m.t; if (m.t >= m.secs) winNow(s); return; }
  if (m.ask >= 0) return;
  if (m.type === "task") {
    for (let i = 0; i < m.items.length; i++) { const it = m.items[i]; if (it.cd) it.cd = Math.max(0, it.cd - dt); if (!it.done && !it.cd && Math.hypot(it.x - p.x, it.z - p.z) < it.r) { askItem(s, i); return; } }
    if (m.prog >= m.goal) winNow(s); return;
  }
  if (m.type === "mine") {
    m.digCd -= dt; for (const it of m.items) if (it.cd) it.cd = Math.max(0, it.cd - dt); if ((inp.dig || s.auto) && m.digCd <= 0) { let b: MItem | null = null, bd = 3.4; for (const it of m.items) { if (it.done || it.cd) continue; const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd) { bd = d; b = it; } }
      if (b) { m.digCd = 0.4; b.hp--; s.ev.push({ k: "dig", x: b.x, z: b.z }); if (b.hp <= 0) { askItem(s, m.items.indexOf(b)); return; } } }
    if (m.prog >= m.goal) winNow(s); return;
  }
  if (m.phase === 1) { if (!s.enemies.some(e => e.kind === m.boss && e.dead === 0)) winNow(s); return; }
  for (let i = 0; i < m.items.length; i++) { const it = m.items[i]; if (it.done || Math.hypot(it.x - p.x, it.z - p.z) > it.r) continue; it.p = Math.min(1, it.p + dt / m.hold); if (it.p >= 1) { askItem(s, i); return; } }
  if (m.prog >= m.goal) {
    if (m.type === "capture") { winNow(s); return; }
    for (const e of s.enemies) if (e.dead === 0) { e.hp = 0; e.dead = 0.5; }   // strike: the warhead wipes the field, then the commander lands
    s.ev.push({ k: "strike", x: p.x, z: p.z }); m.phase = 1; s.spawnQ = []; s.waveLeft = 0; if (m.boss) spawnAlien(s, m.boss);
  }
}
export function step(s: State, dt: number, inp: Input) {
  if (s.done || s.frozen) return;
  s.t += dt;
  if (s.grace > 0) { s.grace -= dt; s.p.inv = Math.max(s.p.inv, 0.05); }
  const p = s.p;
  if (s.autoFire && !inp.fire && s.weapon !== "launcher" && s.weapon !== "rpg") {   // auto-shoot (owner 2026-10-18): fire when a living alien is inside the aim cone and in range
    const W = WEAPONS[s.weapon], ox = p.x, oy = EYE + p.y, oz = p.z, fx = -Math.sin(p.yaw) * Math.cos(p.pitch), fy = Math.sin(p.pitch), fz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    for (const e of s.enemies) { if (e.dead !== 0) continue; const vx = e.x - ox, vy = bodyY(e.kind) - oy, vz = e.z - oz, d = Math.hypot(vx, vy, vz); if (d > Math.min(W.range, 60) || d < 1) continue; if (Math.acos(Math.max(-1, Math.min(1, (vx * fx + vy * fy + vz * fz) / d))) < 0.08) { inp = { ...inp, fire: true }; break; } }
  }
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
  if (s.ms) missionStep(s, dt, inp);
  if (s.done) return;
  if (!(s.ms && s.ms.phase === 1) && !s.peaceful && (s.wave === 0 || (s.waveLeft === 0 && s.spawnQ.length === 0 && s.enemies.every(e => e.dead !== 0)))) {
    s.between -= dt;
    if (s.between <= 0) {
      if (s.wave >= s.waves.length && !s.ms) { s.done = true; s.won = true; s.ev.push({ k: "win" }); return; }
      s.spawnQ = s.waves[s.wave % s.waves.length].slice(); s.waveLeft = s.spawnQ.length; s.wave++; s.between = 4; s.spawnT = 0; s.ev.push({ k: "wave", n: s.wave }); { const un = unowned(s); if (un.length) spawnPickup(s, un[0]); if (s.wave % 2 === 0) spawnPickup(s, "ammo"); }
      for (const k of Object.keys(WEAPONS) as WeaponId[]) s.ammo[k].res = Math.min(k === "pistol" ? 9999 : WEAPONS[k].reserve, s.ammo[k].res + WEAPONS[k].mag);   // a little ammo between waves
      p.hp = Math.min(100, p.hp + 35);
    }
  }
  if (s.spawnQ.length) { s.spawnT -= dt; const cap = s.lv ? 3 + (s.lv >> 1) : s.wave <= 3 ? 2 : 3; if (s.spawnT <= 0 && s.enemies.filter(e => e.dead === 0).length < cap) { spawnAlien(s, s.spawnQ.shift() as AlienKind); s.waveLeft--; s.spawnT = s.lv ? 1.0 : 1.4; } }
  // enemies
  const alive = s.enemies.filter(e => e.dead === 0);
  for (const e of s.enemies) {
    const A = ALIENS[e.kind]; e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.dead !== 0) { if (e.dead > 0) { e.dead -= dt; if (e.dead <= 0) e.dead = -1; } continue; }
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1; e.yaw = Math.atan2(-dx, -dz);
    let dirx = dx / d, dirz = dz / d, spd = A.speed * 0.529 * (1 + s.wave * 0.03);
    if (behOf(e.kind) === "flarecaster") { if (d < 9) { dirx = -dirx; dirz = -dirz; spd *= 0.8; } else if (d < 15) { dirx = -dirz * (e.side || 1); dirz = dx / d * (e.side || 1); spd *= 0.6; if (!e.side) e.side = rnd(s) < 0.5 ? -1 : 1; } }
    if (behOf(e.kind) === "skyeye") { if (d < 10) { dirx = -dirx; dirz = -dirz; } else if (d < 17) { if (!e.side) e.side = rnd(s) < 0.5 ? -1 : 1; dirx = -dz / d * e.side; dirz = dx / d * e.side; spd *= 0.7; } }
    if (behOf(e.kind) === "charger") {
      if ((e.stun || 0) > 0) { e.stun = (e.stun || 0) - dt; spd = 0; }
      else if ((e.tele || 0) > 0) { e.tele = (e.tele || 0) - dt; spd = 0; if ((e.tele || 0) <= 0) { e.rush = 0.95; e.dx = dx / d; e.dz = dz / d; } }
      else if ((e.rush || 0) > 0) { e.rush = (e.rush || 0) - dt; dirx = e.dx || dirx; dirz = e.dz || dirz; spd = 15; e.yaw = Math.atan2(-dirx, -dirz); if ((e.rush || 0) <= 0) { e.stun = 1.1; e.cd = 2.2; } }
      else if (d < 15 && d > 4 && e.cd <= 0) { e.tele = 1.0; e.cd = 0; s.ev.push({ k: "charge", x: e.x, z: e.z }); }
    }
    if (behOf(e.kind) === "spitter") { if (d < 11) { dirx = -dirx; dirz = -dirz; spd *= 0.7; } else if (d < 16) { spd = 0; } }
    if (behOf(e.kind) === "mantis" && e.leap > 0) { e.leap -= dt; spd = A.speed * 3.2; }
    else if (behOf(e.kind) === "mantis" && d < 7 && d > 3 && e.cd <= 0) { e.leap = 0.45; e.cd = 3.2; }
    for (const o of alive) { if (o === e) continue; const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz); if (od > 0 && od < 1.1) { dirx += ox / od * 0.6; dirz += oz / od * 0.6; } }
    if ((e.sideT || 0) > 0) { e.sideT = (e.sideT || 0) - dt; dirx += -dirz * (e.side || 1) * 1.6; dirz += dirx * 0 + (dx / d) * (e.side || 1) * 1.6; }
    if ((e.slow || 0) > 0) { e.slow = (e.slow || 0) - dt; if (!rushingNow(e)) spd *= 0.45; }
    const melee = A.reach > 0, stopD = A.r + 2.0, rushing = behOf(e.kind) === "charger" && (e.rush || 0) > 0;
    if (melee && !rushing && d < stopD) spd = 0;
    const ix = dirx * spd * dt, iz = dirz * spd * dt;
    const [nx2, nz2] = behOf(e.kind) === "skyeye" ? [Math.max(-ARENA + 1, Math.min(ARENA - 1, e.x + ix)), Math.max(-ARENA + 1, Math.min(ARENA - 1, e.z + iz))] : collide(s.boxes, e.x + ix, e.z + iz, A.r);
    if (spd > 0 && Math.hypot(nx2 - e.x, nz2 - e.z) < 0.35 * Math.hypot(ix, iz) && (e.sideT || 0) <= 0) { e.side = rnd(s) < 0.5 ? -1 : 1; e.sideT = 1.4; }
    e.x = nx2; e.z = nz2;
    e.cd -= dt; e.gt = (e.gt === undefined ? 1.5 + rnd(s) * 4 : e.gt) - dt; if (e.gt <= 0) { e.gt = 4 + rnd(s) * 5; if (d < 30) s.ev.push({ k: "growl", w: e.kind, n: d }); }
    if (behOf(e.kind) === "charger") { if ((e.rush || 0) > 0 && d < A.r + 2.4) { s.ev.push({ k: "bite", w: e.kind }); hurtPlayer(s, A.dmg * (1 + s.wave * 0.04), e.x, e.z); e.rush = 0; e.stun = 1.1; e.cd = 2.2; } }
    else if (A.reach > 0 && d < Math.max(A.reach + 0.6, A.r + 2.4) && e.cd <= 0) { s.ev.push({ k: "bite", w: e.kind }); hurtPlayer(s, A.dmg * (1 + s.wave * 0.04), e.x, e.z); e.cd = behOf(e.kind) === "skitter" ? 0.7 : 1.1; }
    if (behOf(e.kind) === "flarecaster" && d < 26 && e.cd <= 0) {
      e.cd = 3.0; const T = d / 11; s.acid.push({ id: s.nextId++, x: e.x, y: 2.0, z: e.z, vx: dx / T, vz: dz / T, vy: (EYE - 2.0 + 4.9 * T * T) / T, life: 5, dmg: 18, big: 1.8, col: 0xff7a2a }); s.ev.push({ k: "spit", x: e.x, z: e.z, w: "flarecaster" });
    }
    if (behOf(e.kind) === "skyeye" && d < 28 && e.cd <= 0) {
      e.cd = 2.6; for (const sp of [-0.18, 0, 0.18]) { const ang = Math.atan2(dx, dz) + sp, V = 13, T = d / V; s.acid.push({ id: s.nextId++, x: e.x, y: 2.6, z: e.z, vx: Math.sin(ang) * V, vz: Math.cos(ang) * V, vy: (EYE - 2.6) / T, life: 3, g: 0, dmg: 7, big: 0.7, col: 0xb06aff }); } s.ev.push({ k: "spit", x: e.x, z: e.z, w: "skyeye" });
    }
    if (behOf(e.kind) === "spitter" && d < 24 && e.cd <= 0) {
      e.cd = 2.3; const T = d / 14; s.acid.push({ id: s.nextId++, x: e.x, y: 1.3, z: e.z, vx: dx / T, vz: dz / T, vy: (EYE - 1.3 + 4.9 * T * T) / T, life: 4 }); s.ev.push({ k: "spit", x: e.x, z: e.z });
    }
    if (A.boss && d < 45) {   // bosses: a ring of bolts that gets faster as health drops, and reinforcements of their own race
      e.bt = (e.bt || 0) + dt; e.vt = (e.vt === undefined ? 2.5 : e.vt) - dt; e.mt = (e.mt === undefined ? 6 : e.mt) - dt;
      const ph = e.hp < e.max * 0.33 ? 3 : e.hp < e.max * 0.66 ? 2 : 1;
      if (e.vt <= 0) { e.vt = ph === 3 ? 3.2 : ph === 2 ? 4.2 : 5.4; const n = 8 + ph * 2; for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2 + e.bt; s.acid.push({ id: s.nextId++, x: e.x, y: 1.4, z: e.z, vx: Math.sin(ang) * 9, vz: Math.cos(ang) * 9, vy: 0, g: 0, life: 3.2, dmg: 9, big: 0.6, col: 0xff5a8a }); } s.ev.push({ k: "spit", x: e.x, z: e.z, w: "walker" }); }
      if (e.mt <= 0) { e.mt = 15 - ph * 2.5; const mk = MINIONS[e.kind] || []; if (s.enemies.filter(q => q.dead === 0 && !ALIENS[q.kind].boss).length < 5) for (let i = 0; i < 2; i++) { const a = rnd(s) * Math.PI * 2; const [qx, qz] = collide(s.boxes, e.x + Math.cos(a) * 3, e.z + Math.sin(a) * 3, 0.6); spawnAlien(s, mk[Math.floor(rnd(s) * mk.length)], [qx, qz]); } }
    }
  }
  s.hzClock += dt; for (const h of s.hz) { if (s.hzClock % h.per < h.on && Math.hypot(p.x - h.x, p.z - h.z) < h.r && p.y < 0.6) { s.hzT -= dt; if (s.hzT <= 0) { s.hzT = 0.5; hurtPlayer(s, 5, h.x, h.z); } } }
  s.enemies = s.enemies.filter(e => e.dead >= 0);
  for (const a of s.acid) {
    a.life -= dt; a.vy -= (a.g === undefined ? 9.8 : a.g) * dt; a.x += a.vx * dt; a.z += a.vz * dt; a.y += a.vy * dt;
    if (a.y <= 0.1) a.life = 0;
    else if (Math.hypot(a.x - p.x, a.z - p.z) < 0.7 && a.y < (p.slide > 0 ? 1.0 : EYE + p.y + 0.3) && a.y > p.y) { hurtPlayer(s, a.dmg || 11, a.x, a.z); a.life = 0; }
    for (const b of s.boxes) if (a.y < b.h && Math.abs(a.x - b.x) < b.w / 2 && Math.abs(a.z - b.z) < b.d / 2) a.life = 0;
  }
  s.acid = s.acid.filter(a => a.life > 0);
  for (const r of s.rk) {
    r.life -= dt; if (r.rt === "plasma" || !r.rt) r.vy -= 2.5 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; let hit = r.life <= 0 || r.y <= 0.1;
    for (const b of s.boxes) if (r.y < b.h && Math.abs(r.x - b.x) < b.w / 2 && Math.abs(r.z - b.z) < b.d / 2) hit = true;
    if (Math.abs(r.x) > ARENA || Math.abs(r.z) > ARENA) hit = true;
    if (!hit) for (const e of s.enemies) if (e.dead === 0 && Math.hypot(e.x - r.x, e.z - r.z) < ALIENS[e.kind].r + 0.4 && Math.abs(r.y - bodyY(e.kind)) < 1.4) { hit = true; break; }
    if (hit) { r.life = 0; if (r.rt === "rpg") explode(s, r.x, Math.max(0.2, r.y), r.z, 6.8, 260, 2, shopMul(s, "rpg")); else if (r.rt === "salvo") explode(s, r.x, Math.max(0.2, r.y), r.z, 3.1, 55, 0.6, shopMul(s, "salvo")); else explode(s, r.x, Math.max(0.2, r.y), r.z, BOOM_R, 130, 1, shopMul(s, "launcher")); }
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
export function answerTune(s: State, ok: boolean | null) { if (s.ms && s.ms.ask >= 0) missionAnswer(s, ok); else tuneResult(s, ok); }

export function stats(s: State) {
  const acc = s.shots ? Math.round(s.hitsLanded / s.shots * 100) : 0;
  const stars = !s.won ? 0 : s.p.hp >= 70 ? 3 : s.p.hp >= 35 ? 2 : 1;
  return { acc, stars, kills: s.kills, heads: s.heads, score: s.score, coins: s.coins, tunes: s.tunes, right: s.tuneRight, activeSecs: Math.round(s.active) };
}
