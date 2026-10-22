/* Alien Hunt campaign (owner, 2026-10-18: "10 more levels, an adventure of shooting down the aliens one level at a time, a different alien race on every level").
   Pure data: no three.js, no DOM, no storage. Each level is an arena with its own layout, look, alien race (a roster of species and a tint), gun pool and hazards.
   The engine reads waves / boxes / hazards / guns; the renderer reads the theme and the race tint. */
import type { Box, AlienKind, WeaponId } from "./ah-engine";

export type Theme = { sky: [string, string, string, string]; fog: number; fogD: number; ground: number; wall: number; hemi: [number, number]; sun: number; ring: number };
export type Hazard = { x: number; z: number; r: number; per: number; on: number; col: number };
export type MissionSpec = { type: "survive" | "capture" | "mine" | "strike" | "task"; label?: [string, string, string]; secs?: number; hold?: number; pts?: [number, number][]; boss?: AlienKind };
export type Level = {
  mission?: MissionSpec; auto?: { glow: number; props: "spire" | "mesa" | "tower" | "pod" };
  id: number; name: [string, string, string]; race: [string, string, string]; blurb: [string, string, string];
  tint: number; waves: AlienKind[][]; boxes: Box[]; theme: Theme; guns: WeaponId[]; hazards: Hazard[]; hpk: number; boss?: AlienKind; peaceful?: boolean; kit?: "jungle" | "desert" | "ice" | "lava" | "ruins" | "gas" | "belt" | "sun" | "auto"; bossName?: [string, string, string];
};

/** "skitter*3,scarab*4" -> the species of one wave */
const W = (spec: string): AlienKind[] => spec.split(",").flatMap(p => { const [k, n] = p.split("*"); return Array.from({ length: n ? parseInt(n, 10) : 1 }, () => k as AlienKind); });
const B = (x: number, z: number, w: number, d: number, h: number): Box => ({ x, z, w, d, h });

export const BOXES_1: Box[] = [B(-8, -6, 4, 2.2, 1.3), B(9, -9, 2.2, 5, 1.3), B(0, 8, 6, 1.6, 1.2), B(-15, 7, 2.4, 2.4, 2.6), B(15, 6, 2.4, 2.4, 2.6), B(-3, -17, 8, 1.4, 1.2), B(20, -18, 3, 3, 1.8), B(-22, -14, 3, 3, 1.8), B(4, 20, 3, 2, 1.3), B(-12, 22, 5, 1.6, 1.3)];

export const LEVELS: Level[] = [
  { id: 1, name: ["ท่าจอดยาน Alpha", "Docking Bay Alpha", "阿尔法停靠港"], race: ["ฝูงแมลงสวอร์ม", "The Swarm", "虫群"], blurb: ["ฝูงแมลงบุกท่าจอดยาน", "A bug swarm has breached the docking bay.", "虫群攻破了停靠港。"],
    tint: 0x66dd44, hpk: 1, guns: ["rifle", "laser", "shotgun"], hazards: [],
    waves: [W("skitter*3"), W("skitter*3,scarab*5"), W("skitter*4,scarab*8")],
    boxes: BOXES_1, theme: { sky: ["#07101f", "#12304f", "#2c6b8a", "#0d1620"], fog: 0x14304a, fogD: 0.014, ground: 0x8a9bb5, wall: 0x9fb6d6, hemi: [0xbfe2ff, 0x1a2a44], sun: 0xcfe8ff, ring: 0x35e0ff } },
  { id: 2, name: ["ห้องเตาปฏิกรณ์", "Reactor Core", "反应堆核心"], race: ["เผ่าจักรกล", "The Machine Cult", "机械教团"], blurb: ["หุ่นรบแปลกถิ่นยึดเตาปฏิกรณ์ ระวังไอน้ำร้อน", "Alien war machines hold the reactor. Mind the steam.", "外星战争机器占领了反应堆，小心蒸汽。"],
    tint: 0x35d6e8, hpk: 1.08, guns: ["arc"], hazards: [[-12, 0], [12, -8], [0, -14]].map(([x, z]) => ({ x, z, r: 3.2, per: 6, on: 2.4, col: 0xdde8ff })),
    waves: [W("drone*3,scarab*4"), W("drone*3,wisp*2,scarab*4"), W("drone*4,wisp*3,skitter*3"), W("drone*4,wisp*4,stalker*2")],
    boxes: [B(0, 0, 6, 6, 3), B(-12, -12, 2.6, 2.6, 2.6), B(12, -12, 2.6, 2.6, 2.6), B(-12, 12, 2.6, 2.6, 2.6), B(12, 12, 2.6, 2.6, 2.6), B(-22, 0, 1.4, 8, 2), B(22, 0, 1.4, 8, 2)],
    theme: { sky: ["#1a0904", "#4a1a0a", "#b8501c", "#1c0d08"], fog: 0x4a200c, fogD: 0.018, ground: 0xb08a70, wall: 0xc8906a, hemi: [0xffc8a0, 0x3a1c10], sun: 0xffb070, ring: 0xff8a3a } },
  { id: 3, name: ["สวนไฮโดรโพนิกส์", "Hydroponic Gardens", "水培花园"], race: ["เผ่าสปอร์", "The Spore-kin", "孢子族"], blurb: ["เชื้อราต่างดาวกลืนสวน เอเลี่ยนซ่อนในพุ่ม", "An alien fungus has swallowed the gardens.", "外星真菌吞没了花园。"],
    tint: 0xb8e83a, hpk: 1.16, guns: ["pulsar"], hazards: [],
    waves: [W("spitter*3,skitter*3"), W("spitter*3,stalker*2,skitter*4"), W("spitter*4,stalker*3,scarab*8"), W("spitter*5,stalker*4,skitter*4")],
    boxes: [B(-6, -4, 2, 2, 1.8), B(7, -2, 2, 2, 1.8), B(-14, 6, 2.4, 2.4, 2.2), B(13, 8, 2.4, 2.4, 2.2), B(0, -12, 3, 2, 1.6), B(-20, -10, 2, 2, 1.8), B(19, -12, 2, 2, 1.8), B(-8, 14, 2, 2, 1.6), B(9, 15, 2, 2, 1.6), B(-24, 4, 2, 2, 2), B(24, 2, 2, 2, 2), B(0, 2, 2.4, 2.4, 2.4)],
    theme: { sky: ["#03120a", "#0a3a22", "#2c7a46", "#08150d"], fog: 0x0e3a20, fogD: 0.02, ground: 0x7ab07c, wall: 0x8fcc8a, hemi: [0xc8ffc0, 0x143a20], sun: 0xd8ffc8, ring: 0x7dff9a } },
  { id: 4, name: ["แล็บแช่แข็ง", "Cryo Labs", "低温实验室"], race: ["เผ่าน้ำแข็ง", "The Frost Kin", "霜裔"], blurb: ["ผู้พิทักษ์น้ำแข็ง Hive Warden ปกป้องรังแช่แข็ง", "The Hive Warden guards a frozen nest.", "蜂巢守卫看守着冰封的巢穴。"],
    tint: 0x9fe8ff, hpk: 1.24, guns: ["cryo", "nova"], hazards: [], boss: "warden",
    waves: [W("stalker*3,wisp*2"), W("stalker*4,wisp*3,charger*1"), W("stalker*4,wisp*3,charger*2,scarab*6"), W("warden,stalker*3,wisp*2")],
    boxes: [B(-10, -4, 18, 1.4, 2.4), B(12, 6, 18, 1.4, 2.4), B(-22, 12, 2.6, 2.6, 2.8), B(22, -10, 2.6, 2.6, 2.8), B(0, -16, 3, 3, 2), B(-4, 14, 3, 3, 2)],
    theme: { sky: ["#061826", "#124a66", "#7ac8e8", "#0c2030"], fog: 0x1c5a78, fogD: 0.016, ground: 0xc8e8f8, wall: 0xcfeaff, hemi: [0xe0f4ff, 0x20506a], sun: 0xe8f8ff, ring: 0x9fe8ff } },
  { id: 5, name: ["คลังสินค้า", "Cargo Maze", "货仓迷宫"], race: ["โจรสลัดสแคเวนเจอร์", "The Scavengers", "拾荒者"], blurb: ["พวกขโมยเก็บซากรื้อคลังสินค้า", "Scavengers are stripping the cargo hold.", "拾荒者正在洗劫货仓。"],
    tint: 0xffc23a, hpk: 1.32, guns: ["storm"], hazards: [],
    waves: [W("charger*2,drone*3,skitter*3"), W("charger*2,drone*4,skitter*4,stalker*2"), W("charger*3,drone*4,stalker*3,scarab*8"), W("charger*3,drone*5,stalker*4,wisp*2")],
    boxes: [B(-10, -10, 5, 2.4, 2.2), B(10, -10, 5, 2.4, 2.2), B(-10, 0, 5, 2.4, 2.2), B(10, 0, 5, 2.4, 2.2), B(0, -5, 2.4, 6, 2.2), B(-22, -6, 5, 2.4, 2.2), B(22, -6, 5, 2.4, 2.2), B(-10, 12, 5, 2.4, 2.2), B(10, 12, 5, 2.4, 2.2), B(0, 7, 2.4, 4, 2.2)],
    theme: { sky: ["#0c0c10", "#26262e", "#5a5a66", "#101014"], fog: 0x26262e, fogD: 0.02, ground: 0xa0a0aa, wall: 0xb0aab8, hemi: [0xe0e0f0, 0x303038], sun: 0xffe8b0, ring: 0xffd34a } },
  { id: 6, name: ["ดาดฟ้าบัญชาการ", "Command Deck", "指挥甲板"], race: ["ภาคีเซนทิเนล", "The Sentinel Order", "哨兵修会"], blurb: ["ผู้พิทักษ์ลอยตัวยึดห้องควบคุม", "Hovering sentinels hold the control deck.", "悬浮哨兵占据了控制甲板。"],
    tint: 0x7a96ff, hpk: 1.4, guns: ["beam"], hazards: [],
    waves: [W("wisp*4,drone*3"), W("wisp*5,flarecaster*2,drone*3"), W("wisp*5,skyeye*2,flarecaster*3,drone*3"), W("skyeye*3,flarecaster*4,wisp*5,drone*4")],
    boxes: [B(0, 0, 5, 5, 1.6), ...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return B(Math.cos(a) * 13, Math.sin(a) * 13, 2.6, 1.4, 1.6 + (i % 2)); }), B(-24, 14, 3, 3, 2.4), B(24, 14, 3, 3, 2.4)],
    theme: { sky: ["#040a1e", "#0e2250", "#3a5cc0", "#080e22"], fog: 0x10265a, fogD: 0.014, ground: 0x8ea0d0, wall: 0x9db0e8, hemi: [0xc0d0ff, 0x1a2450], sun: 0xc8d8ff, ring: 0x6a8aff } },
  { id: 7, name: ["อุโมงค์รัง", "Hive Tunnels", "巢穴隧道"], race: ["ฝูงฮาร์ด", "The Brood", "孽育族"], blurb: ["มืดสนิท ฝูงลูกอ่อนทะลักจากผนัง", "Pitch dark. The brood pours from the walls.", "一片漆黑，幼虫从墙里涌出。"],
    tint: 0xc06aff, hpk: 1.48, guns: ["rail", "salvo"], hazards: [],
    waves: [W("scarab*10,stalker*3"), W("scarab*10,stalker*4,behemoth"), W("scarab*12,stalker*5,behemoth*2,skitter*4"), W("scarab*14,stalker*6,behemoth*3,spitter*3")],
    boxes: [B(-8, -8, 4, 3, 2.6), B(8, -10, 3, 4, 2.6), B(-16, 2, 3, 3, 2.4), B(15, 0, 4, 3, 2.4), B(0, -2, 3, 3, 2.8), B(-6, 10, 5, 2, 2.2), B(10, 12, 3, 3, 2.4), B(-22, -12, 4, 4, 2.6), B(22, -14, 4, 4, 2.6), B(-24, 14, 3, 3, 2.4), B(24, 12, 3, 3, 2.4), B(0, -18, 6, 2, 2.4)],
    theme: { sky: ["#05020a", "#14082a", "#30124a", "#05020a"], fog: 0x120622, fogD: 0.034, ground: 0x9a80b0, wall: 0xb08ac8, hemi: [0xb890e8, 0x1a0c2a], sun: 0xc8a0ff, ring: 0xc06aff } },
  { id: 8, name: ["ซากยานผู้เก็บเกี่ยว", "Harvester Wreck", "收割者残骸"], race: ["ตระกูลซินเดอร์", "The Cinder Clan", "灰烬氏族"], blurb: ["ราชินี Cinder Matriarch เรียกลูกน้องจากซากยาน", "The Cinder Matriarch calls her clan from the wreck.", "灰烬女王从残骸中召唤族人。"],
    tint: 0xff5a3a, hpk: 1.56, guns: ["nova"], hazards: [], boss: "matriarch",
    waves: [W("flarecaster*3,behemoth*1,stalker*3"), W("flarecaster*4,behemoth*2,charger*2,stalker*3"), W("flarecaster*4,behemoth*3,charger*3,wisp*3"), W("matriarch,flarecaster*3,stalker*4")],
    boxes: [B(0, -4, 12, 3, 3), B(-10, 4, 3, 10, 2.4), B(10, 6, 3, 8, 2.4), B(-20, -12, 5, 5, 3), B(20, -10, 4, 6, 2.6), B(-4, 14, 5, 2, 2), B(0, -16, 4, 3, 2.4)],
    theme: { sky: ["#1a0604", "#4a140c", "#d04a22", "#1a0806"], fog: 0x4a1a10, fogD: 0.02, ground: 0xb08470, wall: 0xc88a70, hemi: [0xffb090, 0x401c10], sun: 0xff9a60, ring: 0xff4a3a } },
  { id: 9, name: ["พื้นผิวดวงจันทร์ลาวา", "Lava Moon", "熔岩月面"], race: ["นักบุกลาวา", "The Magma Raiders", "熔岩掠夺者"], blurb: ["โจมตีบนพื้นผิวลาวา พื้นร้อนทำร้ายคุณ", "A raid across a lava moon. The ground burns.", "穿越熔岩月面的突袭，地面灼烧。"],
    tint: 0xffa030, hpk: 1.64, guns: ["launcher", "rpg"], hazards: [[-10, -2], [10, 4], [0, -14], [-8, 12], [14, -12]].map(([x, z]) => ({ x, z, r: 4, per: 8, on: 5.5, col: 0xff6a1a })),
    waves: [W("stalker*4,flarecaster*2,wisp*2"), W("stalker*5,flarecaster*3,charger*2,wisp*3"), W("stalker*5,flarecaster*4,charger*3,behemoth*1,wisp*3"), W("stalker*6,flarecaster*4,charger*3,behemoth*2,wisp*4")],
    boxes: [B(-20, -6, 4, 4, 2.4), B(18, 10, 5, 4, 2.6), B(0, 2, 3, 3, 2.2), B(-4, -22, 5, 3, 2.4), B(24, -14, 3, 3, 2.2), B(-24, 14, 4, 3, 2.4)],
    theme: { sky: ["#1c0602", "#5a1a08", "#e0701c", "#200a04"], fog: 0x5a2008, fogD: 0.016, ground: 0xc09070, wall: 0xd09a70, hemi: [0xffc080, 0x4a2008], sun: 0xffc070, ring: 0xffa030 } },
  { id: 10, name: ["ยานแม่ผู้เก็บเกี่ยว", "Harvester Mothership", "收割者母舰"], race: ["ผู้เก็บเกี่ยว", "The Harvesters", "收割者"], blurb: ["แกนกลางยานแม่ ทุกเผ่ารวมกำลัง Harvester Walker ยืนรอ", "The mothership core. Every race fights for it, and the Walker waits.", "母舰核心，各族齐聚，收割者行走者在等待。"],
    tint: 0xff4fd8, hpk: 1.75, guns: [], hazards: [], boss: "walker",
    waves: [W("skitter*4,drone*4,stalker*4,wisp*3"), W("charger*3,flarecaster*3,drone*4,wisp*4,behemoth*1"), W("behemoth*2,stalker*5,flarecaster*4,skyeye*3,spitter*3"), W("behemoth*3,charger*3,flarecaster*4,skyeye*3,wisp*4"), W("walker,stalker*4,flarecaster*3,wisp*4")],
    boxes: [B(-14, -14, 4, 4, 3.4), B(14, -14, 4, 4, 3.4), B(-14, 8, 4, 4, 3.4), B(14, 8, 4, 4, 3.4), B(0, -4, 8, 1.6, 1.4), B(-26, -2, 2.6, 10, 2.4), B(26, -2, 2.6, 10, 2.4), B(0, 16, 6, 1.6, 1.4)],
    theme: { sky: ["#0a0414", "#2a0a40", "#8a1a78", "#0a0414"], fog: 0x2a0a40, fogD: 0.015, ground: 0xa088b0, wall: 0xc088d0, hemi: [0xe0a0ff, 0x2a0a3a], sun: 0xffa0f0, ring: 0xff4fd8 } },
];

/** guns kept from the levels already cleared: everything the earlier levels offered */
export const gunsAfter = (cleared: number): WeaponId[] => { const out: WeaponId[] = []; for (let i = 0; i < Math.min(cleared, LEVELS.length); i++) for (const g of LEVELS[i].guns) if (!out.includes(g)) out.push(g); return out; };
