/* Robot Adventure 3D (plan 39, P4): every Adventure episode as a first-person level, made from its Adventure row (ra-planets.ts) so the whole story is playable in order.
   On foot (the Alien Hunt engine): fights, survival, mining, capturing, strikes and "task" sites (build / farm / colony / ranch / yard), each step of which is done by answering a music question.
   In a cockpit (ra-ship.ts): launch, belt, harvest, solar, skim, warp, dogfight, black hole and evade. The hand-made levels in ra-data.ts win over what is made here. */
import type { Level, MissionSpec } from "./ah-levels";
import type { Box, AlienKind } from "./ah-engine";
import { RA_PLANETS, RA_BRIEF } from "./ra-planets";
import { RA_LEVELS, type RaLevel, type Tri } from "./ra-data";

export type ShipKind = "launch" | "belt" | "harvest" | "solar" | "skim" | "warp" | "dogfight" | "blackhole" | "evade";
export type ShipDef = { id: string; kind: ShipKind; P: any; brief: Tri; radio: Tri[]; win: Tri };
export type RaDef = { kind: "foot"; data: RaLevel } | { kind: "ship"; data: ShipDef };

const SHIP_KINDS: string[] = ["launch", "belt", "harvest", "solar", "skim", "warp", "dogfight", "blackhole", "evade"];
const hex = (c: string) => parseInt(c.replace("#", ""), 16);
const mixc = (a: number, b: number, t: number) => { const f = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
const B = (x: number, z: number, w: number, d: number, h: number): Box => ({ x, z, w, d, h });
const MON: Record<string, AlienKind> = { glowbug: "glowbug", thornback: "thornback", sporecaster: "sporecaster", hound: "hound", swarmer: "skitter", spitter: "spitter", rustcrawler: "scarab", magnet: "drone", shardling: "skitter", frostcaster: "flarecaster", wraith: "wisp", eyeball: "skyeye", magmaling: "stalker", brute: "behemoth", scrapgolem: "behemoth", mantis: "mantis", burrower: "charger", flarecaster: "flarecaster", drone: "drone" };
const TASK_N: Record<string, number> = { build: 3, colony: 4, ranch: 4, farm: 4, yard: 5, dyson: 4 };
const TASK_LABEL: Record<string, Tri> = {
  build: ["สร้างชิ้นส่วน", "Build a part", "建造部件"], colony: ["สร้างอาคาร", "Build a block", "建造街区"], ranch: ["ดูแลฟาร์ม", "Tend the ranch", "照料牧场"], farm: ["ดูแลแปลง", "Tend a bed", "照料种植床"],
  yard: ["ติดตั้งโมดูล", "Fit a module", "安装模块"], dyson: ["ขันแผงโซลาร์", "Bolt a panel", "安装太阳能板"],
};
const RADIO: Record<string, Tri[]> = {
  foot: [["สัญญาณชีวภาพพุ่งสูง เตรียมตัว", "Bio-signals rising. Brace yourself.", "生物信号上升，做好准备。"], ["ฝูงที่สองกำลังมา", "A second swarm is coming.", "第二波怪群正在逼近。"], ["สัญญาณหนักมาก ระวังตัว", "A heavy signal. Stay sharp.", "出现重型信号，保持警惕。"]],
  work: [["งานดำเนินไปด้วยดี ทำต่อ", "The work is going well. Carry on.", "进展顺利，继续。"], ["เหลืออีกไม่กี่จุด", "Only a few left.", "只剩几处了。"], ["ใกล้เสร็จแล้ว", "Nearly done.", "快完成了。"]],
  ship: [["ระบบนำทางปกติ", "Navigation nominal.", "导航正常。"], ["สัญญาณรบกวนเพิ่มขึ้น", "Interference rising.", "干扰增强。"], ["ใกล้ถึงเป้าหมายแล้ว", "Approaching the objective.", "接近目标。"]],
};
const nm = (P: any): Tri => [P.th, P.en, P.zh];
const brief = (P: any): Tri => { const b = RA_BRIEF[P.id]; return b && b.length >= 3 ? [b[0], b[1], b[2]] : [P.th, P.en, P.zh]; };
const winLine = (P: any): Tri => [`${P.th.split(" · ")[0]} สำเร็จ — เรื่องราวเดินต่อ`, `${P.en.split(" · ")[0]} complete — the story goes on.`, `${P.zh.split(" · ")[0]} 完成 —— 故事继续。`];
const EXTRA_KINDS: AlienKind[] = ["capling", "manthood", "domestalker", "leaper", "razor", "veilmaw", "bloater", "spiker"];
const poolOf = (P: any): AlienKind[] => { const out: AlienKind[] = []; for (const m of P.mons || []) { const k = MON[m]; if (k && !out.includes(k)) out.push(k); } if (!out.length) out.push("skitter", "scarab", "stalker"); let h = 0; for (const c of String(P.id || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; for (const k of [EXTRA_KINDS[h % 8], EXTRA_KINDS[(h + 3) % 8]]) if (!out.includes(k)) out.push(k); return out; };
const waveOf = (pool: AlienKind[], n: number, w: number): AlienKind[] => Array.from({ length: n }, (_, i) => pool[(i + w * 2) % pool.length]);
const sitesOf = (n: number, seed: number): [number, number][] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + 0.6 + seed * 0.7; return [Math.round(Math.cos(a) * 15), Math.round(Math.sin(a) * 12 - 2)] as [number, number]; });

/** the mission a foot episode has, from its Adventure row */
function missionOf(P: any): { spec?: MissionSpec; peaceful: boolean } {
  const m = P.mission as string | undefined, seed = (P.id.length * 7) % 5;
  if (!m) return P.survival ? { spec: { type: "survive", secs: 90 }, peaceful: false } : { peaceful: false };
  if (m === "mine") return { spec: { type: "mine", pts: sitesOf(6, seed) }, peaceful: false };
  if (m === "capture") return { spec: { type: "capture", hold: 10, pts: sitesOf(3, seed) }, peaceful: false };
  if (m === "strike") return { spec: { type: "strike", hold: 6, pts: sitesOf(3, seed), boss: "warden" }, peaceful: false };
  const key = m === "dyson" ? "dyson" : m;   // build / colony / ranch / farm / yard / dyson
  return { spec: { type: "task", label: TASK_LABEL[key] || TASK_LABEL.build, pts: sitesOf(TASK_N[key] || 3, seed) }, peaceful: key !== "dyson" };
}

function footLevel(P: any, idx: number): RaLevel {
  const c = (P.c as string[]).map(hex), hard = P.hard || 1.5, hpk = 1 + (hard - 1) * 0.28, { spec, peaceful } = missionOf(P);
  const pts = spec && spec.pts ? spec.pts : [];
  const pool = poolOf(P), bossName = P.boss && P.boss[0] !== "-" ? P.boss : null, boss: AlienKind | undefined = bossName && !spec ? (hard <= 2.2 ? "warden" : hard <= 3.2 ? "matriarch" : "walker") : undefined;
  const waves: AlienKind[][] = [waveOf(pool, 3, 0), waveOf(pool, 4, 1), waveOf(pool, 5, 2), boss ? [boss, ...waveOf(pool, 3, 3)] : waveOf(pool, 5, 3)];
  const free = (b: Box) => Math.hypot(b.x, b.z - 22) > 7 && pts.every(([x, z]) => Math.hypot(b.x - x, b.z - z) > 5);
  const boxes = [B(-12, 4, 3, 3, 2.2), B(11, 6, 3, 3, 2.2), B(0, -6, 5, 2, 1.6), B(-18, -12, 3, 4, 2.4), B(18, -10, 4, 3, 2.4), B(-6, 14, 4, 2, 1.5), B(7, -16, 3, 3, 2)].filter(free);
  const hazards = P.hazard ? [[-10, -2], [10, 4], [0, -14]].map(([x, z]) => ({ x, z, r: 3.6, per: 7, on: P.hazard === "lava" ? 5 : 2.4, col: P.hazard === "lava" ? 0xff6a1a : 0xffe060 })) : [];
  const level: Level = {
    id: 100 + idx, name: nm(P), race: nm(P), blurb: nm(P), tint: hex((P.tint && P.tint.glow ? "#" + P.tint.glow.split(",").map((n: string) => (+n).toString(16).padStart(2, "0")).join("") : "#9aa0ff")), hpk, kit: "auto", guns: ["rifle", "shotgun", "laser", "arc", "pulsar", "storm", "nova", "rail"].slice(0, 3 + Math.min(3, Math.floor(hard))) as any, hazards, boss, bossName: boss ? bossName : undefined,
    waves, boxes, mission: spec, peaceful,
    auto: { glow: hex("#" + P.glow.split(",").map((n: string) => (+n).toString(16).padStart(2, "0")).join("")), props: spec && spec.type === "task" ? "tower" : /belt|mine|moon|mars/.test(P.id) ? "mesa" : /ranch|farm/.test(P.id) ? "pod" : "spire" },
    theme: { sky: [P.c[0], P.c[1], P.c[2], P.c[0]], fog: mixc(c[0], c[1], 0.5), fogD: 0.015, ground: mixc(c[2], 0xffffff, 0.35), wall: mixc(c[1], 0x000000, 0.2), hemi: [mixc(c[2], 0xffffff, 0.5), c[0]], sun: mixc(c[2], 0xffffff, 0.6), ring: c[2] },
  };
  const kind = spec ? (spec.type === "task" ? "work" : "foot") : "foot";
  return { id: P.id, level, brief: brief(P), radio: RADIO[kind].map((line, i) => ({ wave: i + 2, line })), win: winLine(P) };
}

const DEFS = new Map<string, RaDef>();
RA_PLANETS.forEach((P, idx) => {
  const hand = RA_LEVELS[P.id];
  if (hand) { DEFS.set(P.id, { kind: "foot", data: hand }); return; }
  if (SHIP_KINDS.includes(P.mission)) { DEFS.set(P.id, { kind: "ship", data: { id: P.id, kind: P.mission, P, brief: brief(P), radio: RADIO.ship, win: winLine(P) } }); return; }
  DEFS.set(P.id, { kind: "foot", data: footLevel(P, idx) });
});
export const defOf = (id: string): RaDef | null => DEFS.get(id) || null;
export const RA_ALL: string[] = RA_PLANETS.map(p => p.id);
