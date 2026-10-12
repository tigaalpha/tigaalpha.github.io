/* ── adventure.tsx · ADVENTURE MODE (owner, 2026-10-12) ──
   A robot (and its pet) runs through a planet, fights the alien monsters it meets, and levels up.
   Side-scrolling, real-time, drawn entirely in code: no image or model file is downloaded, so the
   page opens as soon as its chunk (this file) has arrived and every picture is baked in a few
   milliseconds. Two graphics modes share one engine:
     · standard — device pixel ratio 1, 30 frames a second, three parallax layers, a handful of particles;
     · high     — up to 2x pixels, 60 frames, extra fog and light layers, glow sprites, more particles,
                  camera ease and screen shake.
   The robot's level, the five stats (STR/DEX/INT/LUK/AGI) and the skill rank are the SAME ones PvP uses
   (pvp-rpg.ts and the skill SP in pvp-arena.tsx): EXP won here is EXP won there. What drops here is EXP
   and skill points only: nothing in this mode sells, pays coins or touches the shop. Phase 1: one playable
   planet (the other four are on the map, locked), three monsters, no boss yet. ── */
import { useEffect, useRef, useState, useMemo, memo, lazy, Suspense } from "react";
import { CyberAvatar, MODEL_SKIN } from "./cyber-avatar";
import { FigurePic, prepareFigures, pauseFigures, figureOf, FIGURES_OK } from "./figure-cache";
import { createAdvSfx } from "./adventure-sfx";
import { GearButton, SettingsPopup, AdvGuard } from "./adventure-settings";
import { useFpv, FpvButton, FpvVisor, FpvHurt, FpvCrosshair, FpvHands } from "./fpv";
import { ARK_LINES, ARK_MAX, ARK_TRIP_DAYS, arkCost, readArk, buyArk, arkStats } from "./adventure-ark";
import { paintMonster, paintBoss, paintKindred } from "./adventure-monsters";
import { warTeamOf, openAdvRoom, MAX_PILOTS, submitAdvTime, listAdvTop, listPublicRooms, publicRoomOpen, publicRoomPing, publicRoomClose, type Net, type PublicRoom } from "./adv-online";
import { treeOf, lvOf, buySkillLv, toggleEquip, readEquip, equippedOf, passiveSum, powerAt, cdAt, skillLook, skillSound, skillDesc, skillCost, isPassive, SKILL_MAX_LV, type Skill } from "./skill-tree";
import { voiceOf } from "./fx-voice";
import { PetArt, petLevel, petById, PET_TYPES } from "./pet-lab";
import { addRpgExp, rpgOf, rpgMods, RPG_MAX_LV } from "./pvp-rpg";
import { addSkillSp, readSkillSp, skillRank, enterFs, exitFsAndUnlock } from "./pvp-arena";
import { classKeyOf, MODEL_CLASS } from "./model-skills";
import { isLowEnd, spaceTier } from "./space-stage";
import { Piano } from "./music-engine";
import { logUsage, dayKey } from "./shared-infra";
import { createAdvMusic, renderPreview } from "./adventure-music";
import { recordMemory } from "./ai-chat-context";
import { nextQuestion, nextSpell, judgeKeys, recordAnswer, readLadder, learnedTopics } from "./quiz-quest";

const VH = 360, GROUND = 300, WORLD = 5200, TILE = 960;
const readDone = (): string[] => { try { const v = JSON.parse(localStorage.getItem("tg_adv_done") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const readBest = (): any => { try { return JSON.parse(localStorage.getItem("tg_adv_best") || "{}") || {}; } catch (e) { return {}; } };
const writeBest = (id: string, secs: number) => { try { const b = readBest(); if (!(b[id] <= secs)) { b[id] = secs; localStorage.setItem("tg_adv_best", JSON.stringify(b)); } } catch (e) {} };
let RUN_T0 = 0, RUN_NAME = "Pilot";   // when this map actually began (after its film), for the best-times board
const markDone = (id: string) => { try { if (RUN_T0 > 0) { const secs = Math.round((Date.now() - RUN_T0) / 1000); readBest(); writeBest(id, secs); submitAdvTime(id, secs, RUN_NAME); } } catch (e) {} try { const d = readDone(); if (!d.includes(id)) { const Q: any = PLANETS.find((z: any) => z.id === id); if (Q && ENERGY_MISSIONS.includes(Q.mission)) writeEnergy(readEnergy() + 20); d.push(id); localStorage.setItem("tg_adv_done", JSON.stringify(d)); } } catch (e) {} };
const spendCrystals = (n: number) => { try { localStorage.setItem("tg_adv_crystals", String(Math.max(0, readCrystals() - n))); } catch (e) {} };
const readCrystals = (): number => { try { return Math.max(0, parseInt(localStorage.getItem("tg_adv_crystals") || "0", 10) || 0); } catch (e) { return 0; } };
const addCrystals = (n: number) => { try { localStorage.setItem("tg_adv_crystals", String(readCrystals() + n)); } catch (e) {} };
/** Energy carried between maps (0-100, local, never sold): energy maps fill it, 50 is spent at the start of the next map for +25 % crystals there. */
const ENERGY_MISSIONS = ["harvest", "skim", "solar", "capture", "survival", "dyson"];
const readEnergy = (): number => { try { return Math.min(100, Math.max(0, parseInt(localStorage.getItem("tg_adv_energy") || "0", 10) || 0)); } catch (e) { return 0; } };
const writeEnergy = (n: number) => { try { localStorage.setItem("tg_adv_energy", String(Math.min(100, Math.max(0, Math.round(n))))); } catch (e) {} };
let ENERGY_BOOST = 1;   // set when a map starts with 50+ energy
/* ── phase 3.2: crystal upgrades, daily quests, difficulty ──
   Crystals come from playing only and are never for sale. Each of the three lines has 5 levels at +5 % each, so the ceiling is a fixed +25 %. */
export const UP_LINES = ["atk", "hp", "skl", "rkt", "shp"] as const;   // shp: starship engine, +6 % speed and +20 px pickup pull per level (ship maps only)   // rkt: rocket salvo (1 > 2 at Lv2 > 3 at Lv4) and 6 % faster reload per level
export const UP_MAX = 5;
export const upCost = (lv: number) => 12 * Math.pow(2, lv);   // 12, 24, 48, 96, 192
export const readUps = (): any => { try { const v = JSON.parse(localStorage.getItem("tg_adv_up") || "{}") || {}; const o: any = {}; for (const k of UP_LINES) o[k] = Math.max(0, Math.min(UP_MAX, v[k] | 0)); return o; } catch (e) { return { atk: 0, hp: 0, skl: 0, rkt: 0, shp: 0 }; } };
export function buyUp(line: string): boolean {
  const u = readUps(); if (!(UP_LINES as readonly string[]).includes(line) || u[line] >= UP_MAX) return false;
  const c = upCost(u[line]); if (readCrystals() < c) return false;
  try { localStorage.setItem("tg_adv_crystals", String(readCrystals() - c)); u[line]++; localStorage.setItem("tg_adv_up", JSON.stringify(u)); return true; } catch (e) { return false; }
}
/* ── loadout (owner, 2026-10-11: rockets and laser guns in several kinds, chosen before the run) ──
   Each kind unlocks by clearing a planet, so the choice grows with the player. Saved in tg_adv_load. */
export const GUNS = [
  { id: "pulse",   req: null,    th: "ปืนพัลส์",     en: "Pulse gun",   zh: "脉冲枪" },
  { id: "scatter", req: "luma",  th: "ปืนกระจาย",    en: "Scatter gun", zh: "散射枪" },
  { id: "lance",   req: "ferro", th: "เลเซอร์ทะลวง", en: "Lance laser", zh: "穿透激光" },
  { id: "arc",     req: "kryo",  th: "ปืนอาร์คสายฟ้า", en: "Arc gun",     zh: "电弧枪" },
  // found as drops from monsters and bosses (owner, 2026-10-12): they appear here once picked up
  { id: "minigun",   req: null, drop: true, th: "ปืนกล",              en: "Minigun",         zh: "机枪" },
  { id: "shotgun",   req: null, drop: true, th: "ปืนลูกซอง",          en: "Shotgun",         zh: "霰弹枪" },
  { id: "laserrifle", req: null, drop: true, th: "ปืนเลเซอร์",        en: "Laser rifle",     zh: "激光步枪" },
  { id: "railgun",   req: null, drop: true, th: "ปืนเรลกัน",          en: "Railgun",         zh: "电磁轨道炮" },
  { id: "bigbeam",   req: null, drop: true, th: "เลเซอร์ลำแสงใหญ่",   en: "Big beam laser",  zh: "巨型光束激光" },
  { id: "sword",     req: null, drop: true, th: "ดาบเลเซอร์",         en: "Laser sword",     zh: "激光剑" },
];
export const ROCKETS = [
  { id: "homing",  req: null,    th: "จรวดนำวิถี",   en: "Homing rocket",  zh: "追踪火箭" },
  { id: "mini",    req: null,    th: "จรวดลูกเล็ก",   en: "Mini rocket",    zh: "小型火箭" },
  { id: "big",     req: "kryo",  th: "จรวดลูกใหญ่",   en: "Big rocket",     zh: "大型火箭" },
  { id: "nuke",    req: "nexa",  th: "จรวดนิวเคลียร์", en: "Nuclear rocket", zh: "核火箭" },
  { id: "cluster", req: "jovia", th: "จรวดคลัสเตอร์", en: "Cluster rocket", zh: "集束火箭" },
  { id: "napalm",  req: "pyra",  th: "จรวดนาปาล์ม",  en: "Napalm rocket",  zh: "凝固汽油火箭" },
  { id: "rpg",     req: null, drop: true, th: "RPG",            en: "RPG",            zh: "火箭筒" },
  { id: "frag",    req: null, drop: true, th: "ระเบิดมือ",      en: "Frag grenade",   zh: "破片手雷" },
];
export const readFound = (): string[] => { try { const v = JSON.parse(localStorage.getItem("tg_adv_found") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
export const addFound = (id: string) => { try { const v = readFound(); if (!v.includes(id)) { v.push(id); localStorage.setItem("tg_adv_found", JSON.stringify(v)); } } catch (e) {} };
/** Weapon drops: the better the map (its `hard`), the better the pool; a boss always drops one. A weapon you already own only drops again from a boss. */
const WPN_POOL = [["minigun", "shotgun", "sword"], ["laserrifle", "rpg", "frag", "minigun", "shotgun"], ["railgun", "bigbeam", "laserrifle", "rpg", "sword"]];
export function rollWeapon(hard: number, found: string[], boss: boolean, r: () => number = Math.random): string | null {
  if (r() > (boss ? 1 : 0.045)) return null;
  const pool = WPN_POOL[hard < 1.8 ? 0 : hard < 2.6 ? 1 : 2], fresh = pool.filter(id => !found.includes(id)), src = fresh.length ? fresh : boss ? pool : [];
  return src.length ? src[Math.floor(r() * src.length)] : null;
}
const WPN_SVG: Record<string, string> = {
  pulse: '<svg viewBox="0 0 100 40"><rect x="10" y="14" width="56" height="12" rx="4" fill="#9db0c8"/><rect x="62" y="17" width="30" height="6" rx="3" fill="#5ad1ff"/><rect x="20" y="24" width="12" height="14" rx="3" fill="#4a5870"/></svg>',
  scatter: '<svg viewBox="0 0 100 40"><rect x="8" y="13" width="62" height="14" rx="4" fill="#b0a08a"/><rect x="66" y="14" width="28" height="4" rx="2" fill="#ffd23f"/><rect x="66" y="22" width="28" height="4" rx="2" fill="#ffd23f"/><rect x="18" y="26" width="12" height="12" rx="3" fill="#5a4a3a"/></svg>',
  lance: '<svg viewBox="0 0 100 40"><rect x="6" y="16" width="70" height="8" rx="3" fill="#a9bdd8"/><path d="M76 14 L98 20 L76 26 Z" fill="#7fe8ff"/><rect x="18" y="24" width="10" height="12" rx="3" fill="#44546c"/></svg>',
  arc: '<svg viewBox="0 0 100 40"><rect x="10" y="14" width="50" height="12" rx="4" fill="#8aa0c8"/><path d="M60 20 l8 -8 l4 10 l8 -10 l10 8" stroke="#9fd6ff" stroke-width="3" fill="none"/><rect x="20" y="24" width="12" height="14" rx="3" fill="#3f4e6a"/></svg>',
  minigun: '<svg viewBox="0 0 100 40"><rect x="6" y="12" width="40" height="18" rx="5" fill="#7d8aa0"/><rect x="44" y="10" width="46" height="5" rx="2" fill="#c9d3e3"/><rect x="44" y="17" width="46" height="5" rx="2" fill="#c9d3e3"/><rect x="44" y="24" width="46" height="5" rx="2" fill="#c9d3e3"/><rect x="14" y="28" width="12" height="10" rx="3" fill="#3d4658"/></svg>',
  shotgun: '<svg viewBox="0 0 100 40"><rect x="4" y="15" width="30" height="12" rx="5" fill="#6b4a32"/><rect x="30" y="14" width="64" height="5" rx="2" fill="#cfd6e2"/><rect x="30" y="21" width="64" height="5" rx="2" fill="#cfd6e2"/><rect x="48" y="26" width="18" height="6" rx="2" fill="#8a6a4a"/></svg>',
  laserrifle: '<svg viewBox="0 0 100 40"><rect x="6" y="14" width="64" height="11" rx="4" fill="#cfd6e2"/><rect x="66" y="16" width="30" height="7" rx="3" fill="#ff4566"/><rect x="28" y="8" width="22" height="6" rx="2" fill="#5a6a86"/><rect x="16" y="24" width="11" height="13" rx="3" fill="#44506a"/></svg>',
  railgun: '<svg viewBox="0 0 100 40"><rect x="4" y="12" width="88" height="5" rx="2" fill="#e4ecf8"/><rect x="4" y="22" width="88" height="5" rx="2" fill="#e4ecf8"/><rect x="26" y="9" width="6" height="21" fill="#7fb8ff"/><rect x="52" y="9" width="6" height="21" fill="#7fb8ff"/><rect x="72" y="9" width="6" height="21" fill="#7fb8ff"/></svg>',
  bigbeam: '<svg viewBox="0 0 100 40"><rect x="6" y="8" width="60" height="24" rx="8" fill="#8a64d8"/><rect x="62" y="12" width="32" height="16" rx="6" fill="#ff7be0"/><circle cx="92" cy="20" r="6" fill="#fff"/></svg>',
  sword: '<svg viewBox="0 0 100 40"><rect x="4" y="16" width="20" height="8" rx="3" fill="#59647a"/><rect x="22" y="10" width="6" height="20" rx="2" fill="#aab6cc"/><rect x="28" y="17" width="68" height="6" rx="3" fill="#8affc8"/><rect x="28" y="19" width="68" height="2" rx="1" fill="#fff"/></svg>',
};
export const readLoad = (): any => { try { const v = JSON.parse(localStorage.getItem("tg_adv_load") || "{}") || {}; const dn = readDone(); const fnd = readFound(); const ok = (list: any[], id: string) => { const f = list.find(x => x.id === id); return f && (!f.req || dn.includes(f.req)) && (!f.drop || fnd.includes(f.id)) ? id : list[0].id; }; return { gun: ok(GUNS, v.gun), rocket: ok(ROCKETS, v.rocket) }; } catch (e) { return { gun: "pulse", rocket: "homing" }; } };
export const saveLoad = (kind: "gun" | "rocket", id: string) => { try { const v = readLoad(); v[kind] = id; localStorage.setItem("tg_adv_load", JSON.stringify(v)); } catch (e) {} };
export const DIFFS = [{ id: "normal", hp: 1, rw: 1 }, { id: "hard", hp: 1.5, rw: 1.4 }, { id: "nightmare", hp: 2.2, rw: 2 }];
export const readDiff = () => { try { const v = localStorage.getItem("tg_adv_diff"); return DIFFS.find(d => d.id === v) || DIFFS[0]; } catch (e) { return DIFFS[0]; } };
export const QUESTS = [{ id: "cry", need: 15, exp: 60 }, { id: "right", need: 5, exp: 60 }, { id: "boss", need: 1, exp: 120 }];
export function readQuests(): any { try { const v = JSON.parse(localStorage.getItem("tg_adv_q") || "{}") || {}; if (v.d === dayKey()) return v; } catch (e) {} return { d: dayKey(), p: { cry: 0, right: 0, boss: 0 }, done: {} }; }
/** add progress; returns the quests this just completed (each pays its EXP once a day) */
export function bumpQuest(id: string, n = 1): any[] {
  const q = readQuests(); const def = QUESTS.find(x => x.id === id); if (!def) return [];
  q.p[id] = (q.p[id] || 0) + n; const out: any[] = [];
  if (!q.done[id] && q.p[id] >= def.need) { q.done[id] = 1; out.push(def); }
  try { localStorage.setItem("tg_adv_q", JSON.stringify(q)); } catch (e) {}
  return out;
}
/* ── loot (owner, 2026-10-11: varied drops, ore that turns into money at the end, money you can spend in the shop) ──
   Monsters drop scrap, ore, gold nuggets and rare plasma cores. What is collected is sold when the map ends (clear = full price, leaving
   early = 40 %) and paid as the app's ordinary Coins through the SAME onReward the arena uses, so the server's own limits still apply.
   A daily ceiling keeps farming from running away. Coins from playing are allowed by the owner's rule; nothing here can be bought with money. */
export const LOOT: Record<string, { v: number; c: string; th: string; en: string; zh: string }> = {
  scrap: { v: 1, c: "#9aa6b4", th: "เศษเหล็ก", en: "Scrap", zh: "废铁" },
  ore:   { v: 3, c: "#6fc4ff", th: "แร่", en: "Ore", zh: "矿石" },
  gold:  { v: 8, c: "#ffd23f", th: "ทองก้อน", en: "Gold nugget", zh: "金块" },
  core:  { v: 25, c: "#c78bff", th: "แกนพลาสมา", en: "Plasma core", zh: "等离子核心" },
};
export const ADV_COIN_DAY_CAP = 800;
const hslRgb = (h: number) => { const a = 0.9 * Math.min(0.66, 1 - 0.66), f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (0.66 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return f(0) + "," + f(8) + "," + f(4); };
let XPM = 1;   // the EXP multiplier from the equipped passives, set by the run that is playing
const addRpgExpX = (me: any, n: number) => addRpgExp(me, Math.round(n * XPM));
export function rollLoot(exp: number, rnd2: () => number = Math.random): string | null {
  const r = rnd2(); if (r > 0.85) return null; const q = rnd2();
  if (exp < 20) return q < 0.6 ? "scrap" : q < 0.9 ? "ore" : "gold";
  if (exp < 30) return q < 0.3 ? "scrap" : q < 0.75 ? "ore" : q < 0.95 ? "gold" : "core";
  return q < 0.35 ? "ore" : q < 0.8 ? "gold" : "core";
}
export const readDayCoins = (): number => { try { const v = JSON.parse(localStorage.getItem("tg_adv_coin_day") || "{}") || {}; return v.d === dayKey() ? Math.max(0, v.n | 0) : 0; } catch (e) { return 0; } };
export const addDayCoins = (n: number) => { try { localStorage.setItem("tg_adv_coin_day", JSON.stringify({ d: dayKey(), n: readDayCoins() + n })); } catch (e) {} };
const FINALE: any = { id: "finale", finale: true, th: "บทส่งท้ายภาค 3", en: "Act 2 epilogue", zh: "第三区尾声", c: ["#04060e", "#0a1830", "#2a5aa8"], glow: "120,255,220", acc: "255,200,90", boss: ["-", "-", "-"] };
const PROLOGUE: any = { id: "prologue", prologue: true, th: "โครงการหุ่นยนต์ผู้บุกเบิก", en: "Pioneer Robot Program", zh: "先遣机器人计划", c: ["#04060e", "#0a1830", "#2a5aa8"], glow: "110,190,255", acc: "255,200,90", boss: ["-", "-", "-"] };
let TINT: any = null;
const AdventureShip = lazy(() => import("./adventure-ship"));
const AdventureYard = lazy(() => import("./adventure-yard"));   // the Ark shipyard: place the eight modules
const AdventureFarm = lazy(() => import("./adventure-farm"));   // the Ark farm decks: plants and gene-edited livestock   // the starship dogfight: its own chunk
const AdventureCine = lazy(() => import("./adventure-cine"));   // the film before each map: its own chunk, loaded when a map is picked

/* Lightning (owner, 2026-10-12: "make the BOLT look like real lightning, grander"). A bolt is a jagged path (midpoint displacement, redrawn every frame so it
   flickers), with side branches, a wide blue glow, a cyan body and a white core, and a bright flare where it lands. Screen space is the caller's. */
function jag(x0: number, y0: number, x1: number, y1: number, depth: number, off: number, out: number[][]) {
  if (depth === 0) { out.push([x1, y1]); return; }
  const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * off, my = (y0 + y1) / 2 + (Math.random() - 0.5) * off;
  jag(x0, y0, mx, my, depth - 1, off / 2, out); jag(mx, my, x1, y1, depth - 1, off / 2, out);
}
function drawLightning(ctx: CanvasRenderingContext2D, a: any, high: boolean) {
  const al = Math.min(1, a.life * 8), paths: number[][][] = [];
  for (let i = 1; i < a.pts.length; i++) {
    const p = a.pts[i - 1], q = a.pts[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]), out: number[][] = [[p[0], p[1]]];
    jag(p[0], p[1], q[0], q[1], 5, Math.max(12, len * 0.24), out); paths.push(out);
    for (let b = 0; b < (high ? 3 : 1); b++) { const st = out[Math.floor(out.length * (0.2 + Math.random() * 0.6))], ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + (Math.random() - 0.5) * 1.8, bl = len * (0.15 + Math.random() * 0.22), br: number[][] = [[st[0], st[1]]]; jag(st[0], st[1], st[0] + Math.cos(ang) * bl, st[1] + Math.sin(ang) * bl, 3, bl * 0.4, br); paths.push(br); }
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const pass = (w: number, col: string, k: number) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = al * k; for (const pa of paths) { ctx.beginPath(); pa.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.stroke(); } };
  pass(high ? 34 : 20, "rgb(90,60,255)", 0.16); pass(high ? 20 : 12, "rgb(60,130,255)", 0.3); pass(7.5, "rgb(150,215,255)", 0.7); pass(3, "#ffffff", 1);
  ctx.globalAlpha = al; for (const pt of a.pts) { ctx.fillStyle = "rgba(150,200,255,.45)"; ctx.beginPath(); ctx.arc(pt[0], pt[1], 16 + Math.random() * 6, 0, 6.3); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pt[0], pt[1], 5, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
let KEEP_FS = false;   // going straight to the next map keeps the full screen: the old run's cleanup must not leave it   // the planet's monster palette (null = Luma's own)
const TALL = new Set(["sporecaster", "frostcaster", "flarecaster", "drone", "wraith", "eyeball"]);   // hovering shooters: their bar and warning sit higher
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* the five planets (only the first is playable in this phase) */
export const PLANETS = [
  { id: "luma",   th: "ลูมา · ดาวป่าเรืองแสง",   en: "Luma · the glowing jungle", zh: "卢玛 · 荧光丛林",   c: ["#04131c", "#0a3a3a", "#1c8a6a"], glow: "90,255,200", acc: "255,120,220", ok: true, hard: 1, mons: ["glowbug", "glowbug", "thornback", "sporecaster", "glowbug", "thornback", "sporecaster", "glowbug", "thornback", "sporecaster", "hound", "swarmer", "spitter"], tint: null, boss: ["ผู้พิทักษ์ลูมา", "Luma Warden", "卢玛守卫"] },
  { id: "ferro",  th: "เฟอร์โร · ทะเลทรายเหล็ก",  en: "Ferro · the iron desert",   zh: "费罗 · 钢铁沙漠",   c: ["#1a0d05", "#4a2410", "#b8672c"], glow: "255,170,90", acc: "255,90,60",  ok: true, req: "luma", hard: 1.7, mons: ["rustcrawler", "rustcrawler", "magnet", "thornback", "rustcrawler", "magnet", "glowbug", "magnet", "mantis", "hound"], tint: { glow: "255,150,70", body: "#4a2410" }, boss: ["ผู้พิทักษ์เหล็ก", "Iron Warden", "钢铁守卫"] },
  { id: "jovia",  th: "โจเวีย · ดาวแก๊สยักษ์ (เก็บพลังงาน)", en: "Jovia · the gas giant (energy harvest)", zh: "朱维亚 · 气态巨行星（采集能量）", c: ["#0d0a2a", "#3a2a7a", "#c98a4a"], glow: "255,190,110", acc: "255,120,90", ok: true, req: "ferro", hard: 1.9, survival: true, mons: ["rustcrawler", "shardling", "glowbug", "magnet", "shardling", "wraith", "eyeball"], tint: { glow: "255,190,110", body: "#3a2a1a" }, boss: ["-", "-", "-"] },
  { id: "kryo",   th: "ไครโอ · ดาวน้ำแข็งคริสตัล", en: "Kryo · the crystal ice",    zh: "克里奥 · 水晶冰原", c: ["#061427", "#123a63", "#6fc4ff"], glow: "150,225,255", acc: "120,160,255", ok: true, req: "ferro", hard: 2.4, mons: ["shardling", "shardling", "frostcaster", "thornback", "frostcaster", "shardling", "thornback", "burrower", "wraith"], tint: { glow: "150,225,255", body: "#12304a" }, boss: ["ผู้พิทักษ์น้ำแข็ง", "Frost Warden", "冰霜守卫"] },
  { id: "pyra",   th: "ไพรา · เตาปฏิกรณ์ลาวา",    en: "Pyra · the lava reactor",   zh: "派拉 · 熔岩反应堆", c: ["#1c0606", "#5a1408", "#ff6a2a"], glow: "255,120,50", acc: "255,200,60",  ok: true, req: "kryo", hard: 3.0, hazard: "lava", mons: ["magmaling", "magmaling", "flarecaster", "thornback", "flarecaster", "magmaling", "thornback", "brute", "hound"], tint: { glow: "255,120,50", body: "#3a0c06" }, boss: ["ผู้พิทักษ์แกนลาวา", "Core Warden", "熔核守卫"] },
  { id: "nexa",   th: "เน็กซา · เมืองซากอวกาศ",   en: "Nexa · the wreck city",     zh: "内克萨 · 残骸之城", c: ["#0a0518", "#2a1250", "#9a5cff"], glow: "190,150,255", acc: "63,240,208",  ok: true, req: "pyra", hard: 3.8, hazard: "shock", enrage: true, mons: ["drone", "scrapgolem", "drone", "rustcrawler", "drone", "scrapgolem", "mantis", "eyeball"], tint: { glow: "190,150,255", body: "#1e1236" }, boss: ["จอมคุมแห่งเน็กซา", "Nexa Overseer", "内克萨监管者"] },
  { id: "cobalt", th: "โคบอลต์ · แถบเหมืองดาวเคราะห์น้อย (ขุดแร่ส่งกลับโลก)", en: "Cobalt Belt · mine ore, ship it to Earth", zh: "钴带 · 采矿并运回地球", c: ["#0a1220", "#1c3a5a", "#4a90c8"], glow: "110,190,255", acc: "255,200,90", ok: true, req: "ferro", hard: 2.0, mission: "mine", mons: ["rustcrawler", "shardling", "magnet", "rustcrawler", "swarmer", "burrower"], tint: { glow: "110,190,255", body: "#16283c" }, boss: ["-", "-", "-"] },
  { id: "helios", th: "เฮลิออส · ยึดดาวฤกษ์ต่างระบบ", en: "Helios · capture a foreign sun", zh: "赫利俄斯 · 占领异星恒星", c: ["#2a0a00", "#8a3a00", "#ffb030"], glow: "255,200,90", acc: "255,120,60", ok: true, req: "kryo", hard: 2.8, mission: "capture", mons: ["magmaling", "flarecaster", "drone", "magmaling", "wraith", "eyeball"], tint: { glow: "255,190,80", body: "#4a1a06" }, boss: ["-", "-", "-"] },
  { id: "dyson", th: "ไดสันฟอร์จ · สร้างไดสันสเฟียร์รอบดาวฤกษ์ต่างจักรวาล", en: "Dyson Forge · build a Dyson sphere round a foreign star", zh: "戴森锻炉 · 为异宇宙恒星建造戴森球", c: ["#1a0600", "#6a2a00", "#ffd060"], glow: "255,210,110", acc: "120,220,255", ok: true, req: "helios", hard: 3.2, mission: "dyson", mons: ["magmaling", "flarecaster", "drone", "magmaling", "scrapgolem", "brute", "wraith"], tint: { glow: "255,200,90", body: "#4a1a06" }, boss: ["-", "-", "-"] },
  { id: "ashfall", th: "แอชฟอลล์ · ทิ้งนิวเคลียร์ก่อนแล้วค่อยบุก", en: "Ashfall · orbital strike, then assault", zh: "灰烬星 · 先轨道核打击再突袭", c: ["#12120e", "#3a3a2a", "#8a8a5a"], glow: "220,210,140", acc: "255,90,60", ok: true, req: "pyra", hard: 3.4, mission: "strike", mons: ["scrapgolem", "drone", "scrapgolem", "rustcrawler", "drone", "magmaling", "mantis", "brute"], tint: { glow: "220,200,120", body: "#26261c" }, boss: ["ผู้บัญชาการแอชฟอลล์", "Ashfall Commander", "灰烬指挥官"] },
  { id: "voidgate", th: "วอยด์เกต · ขับยานรบสู้ฝูงเอเลี่ยน", en: "Void Gate · starship dogfight", zh: "虚空之门 · 驾驶战机空战", c: ["#02030c", "#1a1240", "#6a4cff"], glow: "130,170,255", acc: "255,120,90", ok: true, req: "kryo", hard: 2.6, mission: "dogfight", mons: ["drone"], tint: null, boss: ["เรือแม่ของเอเลี่ยน", "the alien Mothership", "外星母舰"] },
  { id: "departure", th: "ออกเดินทาง · ทะยานจากโลกสู่วงโคจร", en: "Departure · launch from Earth to orbit", zh: "启程 · 从地球冲向轨道", c: ["#0a1a3a", "#2a5a9a", "#ffb070"], glow: "255,200,140", acc: "120,200,255", ok: true, hard: 1, mission: "launch", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "asteroids", th: "ทุ่งดาวเคราะห์น้อย · ขับยานขุดแร่", en: "Asteroid Field · fly and mine the rocks", zh: "小行星带 · 驾驶飞船采矿", c: ["#0a1220", "#2a3a52", "#8a7a6a"], glow: "255,210,150", acc: "120,220,255", ok: true, hard: 1.8, mission: "belt", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "gasskim", th: "ดาวแก๊สยักษ์ · ขับยานดูดพลังงาน", en: "Gas Giant Skim · skim the clouds for energy", zh: "气态巨星 · 掠云汲取能量", c: ["#1a0a2a", "#5a2a6a", "#ffa060"], glow: "255,190,110", acc: "190,140,255", ok: true, hard: 2.2, mission: "skim", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "starharvest", th: "ดาวฤกษ์ต่างจักรวาล · ยึดสถานีเก็บพลังงานด้วยยาน", en: "Foreign Star · seize the collector stations by ship", zh: "异宇宙恒星 · 驾驶飞船占领采集站", c: ["#2a0a00", "#8a3a00", "#ffd060"], glow: "255,220,130", acc: "120,220,255", ok: true, hard: 3.0, mission: "harvest", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "solarcharge", th: "แผงโซลาร์ · เก็บพลังงานกลางอวกาศ", en: "Solar Array · charge up in deep space", zh: "太阳能阵列 · 深空充能", c: ["#0a1030", "#1a3a7a", "#ffd060"], glow: "255,220,120", acc: "120,200,255", ok: true, hard: 2.0, mission: "solar", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "dysondock", th: "ท่าจอดไดสันสเฟียร์ · ส่งพลังงานเข้าโครงข่าย", en: "Dyson Dock · feed the sphere around the star", zh: "戴森对接站 · 向恒星外的戴森球送能", c: ["#1a0a00", "#6a3a00", "#ffd060"], glow: "255,215,120", acc: "120,220,255", ok: true, hard: 3.0, mission: "harvest", sky: "dyson", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "gaspump", th: "หัวสูบก๊าซ · สูบพลังงานจากดาวแก๊สยักษ์", en: "Gas Pump · draw fuel from a gas giant", zh: "气体抽取站 · 从气态巨星抽取燃料", c: ["#1a0a2a", "#5a2a6a", "#ffa060"], glow: "255,190,110", acc: "190,140,255", ok: true, hard: 2.6, mission: "harvest", sky: "gas", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "warpjump", th: "ประตูวาร์ป · บินเร็วเหนือแสงข้ามกาแล็กซี", en: "Warp Gates · faster than light to another galaxy", zh: "曲速之门 · 超光速前往另一个星系", c: ["#04061a", "#14245a", "#7ab4ff"], glow: "140,200,255", acc: "255,140,255", ok: true, hard: 3.2, mission: "warp", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "blackhole", th: "ขอบหลุมดำ · ฝ่าแรงดึงสู่อีกจักรวาล", en: "Black Hole · cross the horizon to another universe", zh: "黑洞边缘 · 穿越视界前往另一个宇宙", c: ["#020208", "#1a0a2a", "#ff9a40"], glow: "255,170,90", acc: "180,140,255", ok: true, hard: 3.6, mission: "blackhole", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "moonhe3", th: "ดวงจันทร์ · ขุดฮีเลียม-3", en: "Moon · mine Helium-3", zh: "月球 · 开采氦-3", c: ["#0a0a12", "#2a2a3a", "#8a8a9a"], glow: "200,210,230", acc: "255,240,160", ok: true, hard: 1.6, mission: "mine", mons: ["rustcrawler", "magnet", "drone", "shardling", "burrower", "rustcrawler"], tint: { glow: "200,210,235", body: "#2a2a38" }, boss: ["-", "-", "-"] },
  { id: "moonbase", th: "ฐานบนดวงจันทร์ · สร้างอาณานิคมแห่งแรก", en: "Lunar Base · the first colony", zh: "月球基地 · 第一座殖民地", c: ["#0a0a14", "#2a2a40", "#9a9ab0"], glow: "190,200,255", acc: "255,230,150", ok: true, hard: 2.0, mission: "dyson", mons: ["rustcrawler", "drone", "magnet", "shardling", "wraith"], tint: { glow: "190,200,255", body: "#26263a" }, boss: ["-", "-", "-"] },
  { id: "marscolony", th: "ดาวอังคาร · ตั้งอาณานิคมใต้พายุฝุ่น", en: "Mars · found a colony in the dust storm", zh: "火星 · 在沙尘暴中建立殖民地", c: ["#2a0a05", "#6a2a14", "#d96a3a"], glow: "255,140,90", acc: "255,220,120", ok: true, hard: 2.4, survival: true, mons: ["rustcrawler", "hound", "mantis", "spitter", "brute", "swarmer"], tint: { glow: "255,130,80", body: "#4a1a0a" }, boss: ["-", "-", "-"] },
  { id: "mercury", th: "ดาวพุธ · เก็บเกี่ยวพลังงานแสงอาทิตย์", en: "Mercury · harvest the sun's power", zh: "水星 · 采集太阳能", c: ["#1a0a05", "#5a3a20", "#d8a050"], glow: "255,200,120", acc: "255,120,60", ok: true, hard: 2.6, mission: "capture", mons: ["magmaling", "flarecaster", "drone", "magmaling", "wraith", "eyeball"], tint: { glow: "255,190,100", body: "#3a2410" }, boss: ["-", "-", "-"] },
  { id: "venussky", th: "ดาวศุกร์ · อาณานิคมลอยฟ้า", en: "Venus · the cloud colony", zh: "金星 · 云端殖民地", c: ["#2a1a05", "#8a5a10", "#f0c040"], glow: "255,210,110", acc: "255,160,60", ok: true, hard: 2.8, mission: "harvest", sky: "venus", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "jupitergas", th: "ดาวพฤหัส · เก็บเกี่ยวแก๊สไฮโดรเจน", en: "Jupiter · harvest the hydrogen", zh: "木星 · 采集氢气", c: ["#1a0a14", "#6a2a2a", "#e08a50"], glow: "255,160,100", acc: "255,220,150", ok: true, hard: 3.0, mission: "skim", sky: "jupiter", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "saturnrings", th: "ดาวเสาร์ · ทำเหมืองน้ำแข็งในวงแหวน", en: "Saturn · mine the ring ice", zh: "土星 · 开采光环冰块", c: ["#0a1020", "#2a3a5a", "#c8d8e8"], glow: "190,225,255", acc: "255,230,170", ok: true, hard: 3.0, mission: "belt", sky: "saturn", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "titanassault", th: "ไททัน · บุกดวงจันทร์ของดาวเสาร์", en: "Titan · storm Saturn's moon", zh: "土卫六 · 攻占土星的卫星", c: ["#1a1004", "#5a3a08", "#e8a030"], glow: "255,170,60", acc: "180,220,255", ok: true, hard: 3.4, mons: ["shardling", "frostcaster", "burrower", "wraith", "swarmer", "shardling", "frostcaster"], tint: { glow: "255,170,60", body: "#3a2406" }, boss: ["ผู้พิทักษ์ไททัน", "Titan Guardian", "土卫六守卫"] },
  { id: "titancolony", th: "ไททัน · สร้างอาณานิคมแห่งที่สอง", en: "Titan · the second colony", zh: "土卫六 · 第二座殖民地", c: ["#1a1004", "#5a3a08", "#e8a030"], glow: "255,180,80", acc: "180,220,255", ok: true, hard: 3.0, mission: "dyson", mons: ["shardling", "frostcaster", "burrower", "wraith"], tint: { glow: "255,180,80", body: "#3a2406" }, boss: ["-", "-", "-"] },
  { id: "arkbuild", th: "อู่ต่อยาน · สร้างเรือโนอาแห่งอวกาศ", en: "Shipyard · build the Ark", zh: "船坞 · 建造太空方舟", c: ["#04101a", "#10345a", "#60b8ff"], glow: "120,200,255", acc: "140,255,170", ok: true, hard: 3.4, mission: "yard", mons: ["drone", "scrapgolem", "wraith", "mantis", "eyeball"], tint: { glow: "120,200,255", body: "#0c2438" }, boss: ["-", "-", "-"] },
  { id: "arkfarm", th: "ฟาร์มไฮโดรโปนิกส์บนยาน · ปลูกอาหารให้ผู้อพยพ", en: "Ark Hydroponic Farm · grow food for the settlers", zh: "方舟水培农场 · 为移民种植粮食", c: ["#04141a", "#0a3a2a", "#60ffb0"], glow: "120,255,170", acc: "255,230,120", ok: true, hard: 3.4, mission: "farm", kind: "plants", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "arkherd", th: "ฟาร์มสัตว์บนยาน · เลี้ยงสัตว์ตัดแต่งพันธุกรรม", en: "Ark Livestock Farm · gene-edited animals", zh: "方舟畜牧场 · 基因编辑的动物", c: ["#04141a", "#0a3a2a", "#60ffb0"], glow: "120,255,170", acc: "255,230,120", ok: true, hard: 3.4, mission: "farm", kind: "herd", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "arkexodus", th: "การอพยพ · พา Ark ข้ามดวงดาว", en: "Exodus · carry the Ark across the stars", zh: "大迁徙 · 驾驶方舟跨越星际", c: ["#04061a", "#14245a", "#7ab4ff"], glow: "140,200,255", acc: "140,255,170", ok: true, hard: 3.6, mission: "warp", sky: "ark", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
  { id: "kindred", th: "ฐานไคนด์เรด · แลกแร่กับความรู้ของเพื่อนต่างดาว", en: "Kindred Haven · trade ore for an ally's knowledge", zh: "友族港湾 · 以矿石换取盟友的知识", c: ["#041a1a", "#0a4a44", "#46c7b0"], glow: "120,255,220", acc: "255,226,150", ok: true, hard: 2.6, mission: "mine", mons: ["glowbug", "hound", "swarmer", "eyeball", "glowbug", "burrower"], tint: { glow: "120,255,220", body: "#0c3a36" }, boss: ["-", "-", "-"] },
  { id: "darkforge", th: "โรงหลอมสสารมืด · พลังงานที่มองไม่เห็น", en: "Dark Forge · power from the unseen", zh: "暗物质锻炉 · 来自不可见之物的能量", c: ["#06010f", "#1a0a3a", "#8a5cff"], glow: "170,120,255", acc: "255,120,200", ok: true, hard: 3.6, mission: "dyson", mons: ["wraith", "eyeball", "drone", "scrapgolem", "wraith", "mantis"], tint: { glow: "170,120,255", body: "#1a0c2e" }, boss: ["-", "-", "-"] },
  { id: "shadow", th: "ใต้สายตาฮาร์เวสเตอร์ · ผ่านไปโดยไม่ถูกเห็น", en: "Under the Harvesters' Eye · pass unseen", zh: "收割者的注视 · 悄然通过", c: ["#0a0306", "#2a0a1a", "#ff4d6d"], glow: "255,90,120", acc: "150,220,255", ok: true, hard: 2.4, mission: "evade", mons: ["drone"], tint: null, boss: ["-", "-", "-"] },
];

/* the story (owner, 2026-10-11): year 2100, these robots are built BY humans to do the colony work in their place, before any person
   moves in: clear the aliens, mine the ore, take the stars, and send it all home. One short briefing per map, shown when it opens. */
export const BRIEF: Record<string, string[]> = {
  luma: ["ภารกิจหุ่นยนต์บุกเบิก: เคลียร์ป่าเรืองแสงก่อนที่มนุษย์จะย้ายเข้ามา", "Pioneer unit: clear the glowing jungle before any human settles.", "先遣机器人：在人类入住前清理荧光丛林。"],
  ferro: ["ทะเลทรายเหล็กเต็มไปด้วยสนิมและหอแม่เหล็ก — เปิดทางให้รถขุดแร่", "The iron desert: rust and magnet pylons stand between the miners and the ore.", "钢铁沙漠：锈虫与磁力塔挡住了采矿队。"],
  jovia: ["ดาวแก๊สยักษ์: ตั้งเครื่องเก็บพลังงานและยืนหยัดจนพลังงานเต็ม", "The gas giant: set up the harvester and hold out until the energy is full.", "气态巨星：架好采集器，坚守到能量充满。"],
  kryo: ["ดาวน้ำแข็ง: ผู้พิทักษ์ผลึกขวางทางสู่แหล่งน้ำสำหรับอาณานิคม", "The ice world: a crystal warden guards the colony's water.", "冰封星球：水晶守卫看守着殖民地的水源。"],
  pyra: ["เตาปฏิกรณ์ลาวา: ข้ามบ่อลาวาไปปิดแกนที่กำลังเดือด", "The lava reactor: cross the lava pools and shut down the boiling core.", "熔岩反应堆：越过熔岩池，关闭沸腾的核心。"],
  nexa: ["เมืองซากอวกาศ: เจ้าหน้าที่ควบคุมสุดท้ายยังรออยู่ — ระวังแผ่นไฟฟ้า", "The wreck city: the last overseer waits. Mind the shock plates.", "残骸之城：最后的监管者在等候，小心电击板。"],
  cobalt: ["แถบเหมือง: ขุดแร่ 10 ก้อนขึ้นไปแล้วส่งแคปซูลกลับโลก", "The belt: mine at least 10 ore and launch the capsule home to Earth.", "矿带：至少采集 10 块矿石，发射货舱运回地球。"],
  dyson: ["ไดสันฟอร์จ: ขุดแร่ มาประกอบแผงไดสันสเฟียร์ 4 แผง (กด ⛏ ใกล้โครง) แล้วส่งพลังงานกลับโลกที่เสาส่งขวาสุด", "Dyson Forge: mine ore, bolt 4 Dyson panels onto the frames (press ⛏ beside a frame), then beam the energy home from the far-right relay", "戴森锻炉：采矿，在框架旁按 ⛏ 装上 4 块戴森板，再从最右中继塔把能量传回地球"],
  departure: ["ออกเดินทาง: หลบเศษขยะอวกาศและก้อนหินจนถึงวงโคจร (ยิงให้แตกได้)", "Departure: dodge debris and rocks to reach orbit (you can shoot them)", "启程：躲避太空碎片与岩石直至入轨（可以击碎它们）"],
  asteroids: ["ทุ่งดาวเคราะห์น้อย: ยิงหินให้แตกแล้วดูดแร่ให้ครบ 16 ก้อน ระวังโจรอวกาศ", "Asteroid Field: shoot the rocks, collect 16 ore, watch for pirates", "小行星带：击碎岩石收集 16 块矿石，小心太空海盗"],
  solarcharge: ["แผงโซลาร์: เก็บแผงที่ลอยมาให้ครบ 8 แผง อย่าให้แบตเตอรีหมด", "Solar Array: collect 8 drifting panels and keep the battery above zero", "太阳能阵列：收集 8 块漂浮的太阳能板，别让电池耗尽"],
  dysondock: ["ท่าจอดไดสัน: ลอยเข้าวงแหวนท่าจอด 3 จุด ส่งพลังงานเข้าไดสันสเฟียร์ ระวังแฟลร์", "Dyson Dock: hold in 3 docking rings to feed the sphere; watch the flares", "戴森对接：在 3 个对接环内停留向戴森球送能，当心耀斑"],
  gaspump: ["หัวสูบก๊าซ: เข้าวงแหวนหัวสูบ 3 จุดจนถังเต็ม หลบพายุ", "Gas Pump: hold in 3 pump rings until the tank is full; dodge the storm", "气体抽取：在 3 个抽取环内停留直到罐满，躲开风暴"],
  warpjump: ["ประตูวาร์ป: บินผ่านประตู 3 บานแล้วพุ่งเข้าพอร์ทัลไปอีกกาแล็กซี", "Warp Gates: fly through 3 gates, then dive into the portal to another galaxy", "曲速之门：穿过 3 道门，然后冲入传送门前往另一个星系"],
  blackhole: ["หลุมดำ: ต้านแรงดึงจนประตูสว่าง แล้วพุ่งเข้าตรงกลางสู่อีกจักรวาล", "Black Hole: resist the pull until the door lights up, then dive into the centre", "黑洞：抵抗引力，等门亮起后冲向中心进入另一个宇宙"],
  moonhe3: ["ดวงจันทร์: ขุดหินฝุ่นจันทร์ให้ได้ฮีเลียม-3 แล้วส่งแคปซูลกลับโลก", "The Moon: break the regolith for Helium-3 and launch the capsule to Earth", "月球：敲开月壤获取氦-3，并把货舱发射回地球"],
  moonbase: ["ฐานจันทร์: ขุดวัสดุ ประกอบโมดูลที่อยู่อาศัยให้ครบ แล้วส่งสัญญาณถึงโลก", "Lunar Base: dig materials, bolt on every habitat module, then signal Earth", "月球基地：挖掘材料，装好所有居住舱，然后向地球发信号"],
  marscolony: ["ดาวอังคาร: ปกป้องโดมอาณานิคมจนกว่าระบบสร้างบรรยากาศจะทำงานครบ 90 วินาที", "Mars: protect the colony dome for 90 seconds while the air plant spins up", "火星：保卫殖民穹顶 90 秒，直到空气工厂启动"],
  mercury: ["ดาวพุธ: ยึดสถานีเก็บพลังงานทั้งสามจุดที่ร้อนระอุ ขณะคลื่นสัตว์ประหลาดโจมตี", "Mercury: seize the three scorched collector stations while waves attack", "水星：夺取三个灼热的采集站，同时抵御怪物浪潮"],
  venussky: ["ดาวศุกร์: บินแวะแท่นลอยฟ้าทั้งสามจุดเพื่อเติมของให้เมืองในเมฆ ระวังลมกรด", "Venus: dock at the three floating platforms to supply the cloud city; mind the gusts", "金星：停靠三座浮空平台，为云中城市补给，当心狂风"],
  jupitergas: ["ดาวพฤหัส: บินในชั้นแก๊สเรืองแสงจนถังเต็ม หลบสายฟ้าและจุดแดงยักษ์", "Jupiter: stay in the glowing gas layer until the tank is full; dodge lightning near the Great Red Spot", "木星：留在发光的气体层直到罐满，躲开闪电和大红斑"],
  saturnrings: ["ดาวเสาร์: บินทำเหมืองก้อนน้ำแข็งในวงแหวน เก็บให้ครบ 16 ชิ้น", "Saturn: fly through the rings and mine ice chunks, 16 pieces in all", "土星：飞入光环开采冰块，共收集 16 块"],
  titanassault: ["ไททัน: ฝ่าทะเลมีเทนเยือกแข็ง กำจัดผู้พิทักษ์แล้วเปิดทางให้อาณานิคม", "Titan: push through the frozen methane shore, defeat the guardian and open the way for the colony", "土卫六：冲过冰冻甲烷海岸，击败守卫，为殖民地开路"],
  titancolony: ["ไททันโคโลนี: ขุดน้ำแข็งและไฮโดรคาร์บอน ประกอบโมดูลอาณานิคมให้ครบ", "Titan Colony: dig ice and hydrocarbons and assemble every colony module", "土卫六殖民地：挖冰和碳氢化合物，组装全部殖民舱"],
  arkbuild: ["อู่ต่อยาน: ขุดวัสดุ ประกอบโมดูลของ Ark ครบสี่ส่วน — ตัวยาน วงแหวนแรงโน้มถ่วง ชั้นเกษตร และที่อยู่อาศัย", "Shipyard: dig materials and assemble the four Ark sections — hull, gravity ring, farm deck and habitat", "船坞：挖掘材料，组装方舟四大部分——船体、重力环、农业层和居住区"],
  arkfarm: ["ฟาร์มบน Ark: เพาะปลูกด้วยเทคโนโลยีขั้นสูง รดน้ำ ให้แสง LED และสารอาหาร รักษาโรคพืช จนผลผลิตพอเลี้ยงประชากร", "Ark Farm: grow crops with advanced tech: water, LED light and nutrients, treat blight, until the harvest can feed the population", "方舟农场：用先进技术种植——供水、LED 光照与营养液，治理病害，直到产量足以养活全体人口"],
  arkherd: ["ฟาร์มสัตว์บน Ark: เลี้ยงแมลง ปลา ไก่ หมู วัว ที่ตัดแต่งพันธุกรรม ให้อาหาร น้ำ ฉีดวัคซีน จนมีโปรตีนพอเลี้ยงประชากร", "Ark Herd: raise gene-edited insects, fish, chickens, pigs and cows; feed, water and vaccinate them until there is protein for everyone", "方舟畜牧：饲养基因编辑的昆虫、鱼、鸡、猪和牛，喂食、供水、接种疫苗，直到有足够蛋白质养活所有人"],
  arkexodus: ["การอพยพ: บังคับ Ark ผ่านประตูวาร์ป 3 บาน แล้วเข้าพอร์ทัลสู่ระบบดาวดวงใหม่", "Exodus: steer the Ark through 3 warp gates, then into the portal to a new star system", "大迁徙：驾驶方舟穿过 3 道曲速门，然后进入通往新恒星系的传送门"],
  gasskim: ["ดาวแก๊สยักษ์: บินในชั้นพลังงานเรืองแสงให้ถังเต็ม หลบสายฟ้าฟาด", "Gas Giant: stay inside the glowing energy layer to fill the tank; dodge the lightning", "气态巨星：留在发光的能量层内装满能量罐，躲开闪电"],
  starharvest: ["ดาวฤกษ์ต่างจักรวาล: บินเข้าวงแหวนสถานีและอยู่ให้ครบ 7 วินาที ×3 สถานี หลบเปลวสุริยะและฝูงเอเลี่ยน", "Foreign star: hold the ship inside each station ring for 7 s, three stations, through flares and raiders", "异宇宙恒星：在每个采集站圆环内停留 7 秒，共 3 站，穿越耀斑与袭击者"],
  helios: ["ดาวฤกษ์ต่างระบบ: ยึดสถานีเก็บพลังงานทั้งสามจุดทีละจุด", "A foreign sun: take its three collector stations, one at a time.", "异星恒星：逐一占领三座能量采集站。"],
  ashfall: ["แอชฟอลล์: ทิ้งระเบิดนิวเคลียร์จากวงโคจรก่อน แล้วค่อยลงไปกวาดล้างที่เหลือ", "Ashfall: nuke the bases from orbit first, then drop in and clear what is left.", "灰烬星：先从轨道投下核弹，再降落扫荡残敌。"],
  kindred: ["ฐานไคนด์เรด: ขุดแร่ 10 ก้อนขึ้นไป แล้วส่งแคปซูลแลกความรู้จากเพื่อนต่างดาว", "Kindred Haven: mine at least 10 ore and launch the trade capsule for our allies' knowledge.", "友族港湾：采集至少 10 块矿石，发射货舱向盟友换取知识。"],
  darkforge: ["โรงหลอมสสารมืด: ขุดแร่ ประกอบภาชนะ 4 ชิ้น (กด ⛏ ใกล้โครง) แล้วส่งพลังงานกลับโลก", "Dark Forge: dig ore, bolt 4 vessels onto the frames (⛏ beside a frame) and beam the power home.", "暗物质锻炉：挖矿，把 4 个容器装到框架上（在框架旁按 ⛏），再把能量送回地球。"],
  shadow: ["ใต้สายตาฮาร์เวสเตอร์: ห้ามยิง หลบลำแสงสแกนให้ครบ 50 วินาที", "Under the Harvesters' eye: no shooting. Dodge the scan beams for 50 seconds.", "收割者的注视：禁止开火，躲开扫描光束 50 秒。"],
};
const ORE_STAGES = [{ n: 0, th: "ฐานชั่วคราว", en: "Outpost", zh: "前哨" }, { n: 40, th: "ค่ายอาณานิคม", en: "Camp", zh: "营地" }, { n: 120, th: "เมืองเล็ก", en: "Town", zh: "小镇" }, { n: 300, th: "มหานครอาณานิคม", en: "Colony city", zh: "殖民都市" }];
export const readDyson = (): number => { try { return Math.max(0, parseInt(localStorage.getItem("tg_earth_dyson") || "0", 10) || 0); } catch (e) { return 0; } };
export const addDyson = (n: number) => { try { localStorage.setItem("tg_earth_dyson", String(readDyson() + n)); } catch (e) {} };
export const readOre = (): number => { try { return Math.max(0, parseInt(localStorage.getItem("tg_earth_ore") || "0", 10) || 0); } catch (e) { return 0; } };
export const addOre = (n: number) => { try { localStorage.setItem("tg_earth_ore", String(readOre() + n)); } catch (e) {} };
const oreStage = (n: number) => { let st = ORE_STAGES[0]; for (const x of ORE_STAGES) if (n >= x.n) st = x; return st; };

/* ── monsters ── */
const MON = {
  glowbug:     { hp: 34, dmg: 9,  speed: 70,  exp: 12, w: 46, h: 34, cd: 1100, name: ["กลอว์บัก", "Glowbug", "荧虫"] },
  thornback:   { hp: 96, dmg: 15, speed: 38,  exp: 30, w: 78, h: 44, cd: 1500, name: ["ธอร์นแบ็ก", "Thornback", "刺背兽"] },
  rustcrawler: { hp: 40, dmg: 11, speed: 96, exp: 16, w: 50, h: 28, cd: 900,  name: ["สนิมคลาน", "Rustcrawler", "锈爬虫"] },
  magnet:      { hp: 80, dmg: 14, speed: 0,  exp: 28, w: 40, h: 80, cd: 1900, name: ["เสาแม่เหล็ก", "Magnet Pylon", "磁力塔"], ranged: true },
  shardling:   { hp: 46, dmg: 10, speed: 62, exp: 18, w: 44, h: 40, cd: 1000, name: ["เศษคริสตัล", "Shardling", "晶碎兽"] },
  frostcaster: { hp: 56, dmg: 12, speed: 26, exp: 28, w: 46, h: 62, cd: 2000, name: ["ผู้เรียกน้ำแข็ง", "Frostcaster", "霜术士"], ranged: true },
  magmaling:   { hp: 52, dmg: 13, speed: 85, exp: 22, w: 48, h: 34, cd: 900,  name: ["แมกมาลิง", "Magmaling", "熔岩虫"] },
  flarecaster: { hp: 62, dmg: 14, speed: 24, exp: 32, w: 46, h: 62, cd: 1900, name: ["ผู้เรียกเปลวเพลิง", "Flarecaster", "烈焰术士"], ranged: true },
  scrapgolem:  { hp: 150, dmg: 20, speed: 30, exp: 46, w: 80, h: 70, cd: 1600, name: ["โกเลมเศษเหล็ก", "Scrap Golem", "废铁魔像"] },
  drone:       { hp: 48, dmg: 12, speed: 40, exp: 28, w: 44, h: 40, cd: 1700, name: ["โดรนซาก", "Wreck Drone", "残骸无人机"], ranged: true },
  hound:       { hp: 44, dmg: 12, speed: 125, exp: 20, w: 56, h: 36, cd: 800,  name: ["หมาป่าเงา", "Shadow Hound", "暗影猎犬"] },
  mantis:      { hp: 90, dmg: 17, speed: 70,  exp: 34, w: 40, h: 82, cd: 1200, name: ["แมนทิสใบมีด", "Blade Mantis", "刀锋螳螂"] },
  brute:       { hp: 190, dmg: 22, speed: 34, exp: 52, w: 92, h: 100, cd: 1700, name: ["บรูทยักษ์", "Warbrute", "战斗蛮兽"] },
  burrower:    { hp: 70, dmg: 14, speed: 0,  exp: 26, w: 44, h: 80, cd: 1300, name: ["หนอนขุดดิน", "Burrower", "掘地虫"] },
  swarmer:     { hp: 22, dmg: 6,  speed: 110, exp: 8,  w: 56, h: 26, cd: 650,  name: ["ฝูงแมลงร้อน", "Swarmer", "虫群"] },
  wraith:      { hp: 50, dmg: 12, speed: 28, exp: 30, w: 44, h: 70, cd: 2100, name: ["วิญญาณล่องลอย", "Wraith", "幽灵"], ranged: true },
  spitter:     { hp: 60, dmg: 13, speed: 24, exp: 26, w: 60, h: 40, cd: 1900, name: ["คางคกพ่นกรด", "Acid Spitter", "酸液蟾"], ranged: true },
  eyeball:     { hp: 58, dmg: 13, speed: 22, exp: 32, w: 52, h: 70, cd: 2000, name: ["ดวงตาเฝ้ามอง", "Watcher", "窥视之眼"], ranged: true },
  sporecaster: { hp: 52, dmg: 11, speed: 30,  exp: 26, w: 52, h: 60, cd: 2200, name: ["สปอร์คาสเตอร์", "Sporecaster", "孢子术士"], ranged: true },
};

/* ── painting helpers ── */
function layer(w, h, fn) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); const x = c.getContext("2d"); fn(x, c.width, c.height); return c; }
function glowSprite(rgb, r) { return layer(r * 2, r * 2, (x, w, h) => { const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, `rgba(${rgb},0.9)`); g.addColorStop(0.35, `rgba(${rgb},0.3)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }

/** All of the planet's backdrop, baked once for this canvas size. Layers are tiles that repeat sideways. */
const ART = typeof __ART__ !== "undefined" ? __ART__ : "dev";
const advBotKey = (me: any, cw: any, po: string) => `${ART}|advme|${me}|${po}|${cw && cw.glow}|${cw && cw.accent}`;
const advPetKey = (pet: any) => `${ART}|advpet|${pet ? pet.species : ""}|${pet ? petLevel(pet.bond).lv : 0}|${pet ? (pet.mood < 35 ? 1 : 0) : 0}`;
/** Queue the robot's three poses and the pet as stored pictures (the same cache PvP uses on phones). Called when the Adventure menu opens, so they are ready before a map starts. */
/** The hero's frames (owner, 2026-10-12: "walking looks funny, punches and kicks are not realistic"): a walk and a run cycle of eight stills each, driven by the
    distance walked so the feet never slide, a jump tuck, and a real move per strike (jab / hook / uppercut, front / roundhouse kick, sweep, shoot, beam, throw). */
const WALK_N = 8, STRIDE_PX = 13;
export const heroPoseOf = (name: string): any => {
  const m = /^(walk|run)(\d)$/.exec(name);
  if (m) { const run = m[1] === "run", ph = (Number(m[2]) / WALK_N) * Math.PI * 2, s = Math.sin(ph), L = run ? 46 : 27;
    return { lean: run ? -13 : -3, armL: -(run ? 52 : 20) * s, armR: (run ? 52 : 20) * s, legL: L * s, legR: -L * s, head: run ? -4 : 0, lift: -(run ? 3.5 : 2) * (1 + Math.cos(2 * ph)) / 1.1 };
  }
  if (name === "jump") return { lean: -7, armL: 34, armR: 30, legL: -24, legR: 15, head: -3, lift: -5 };
  return name;
};
const HERO_FRAMES = ["ready", "attack", "kick", "jump", "jab", "hook", "upper", "front", "round", "sweep", "shoot", "beam", "throw", "down", ...Array.from({ length: WALK_N }, (_, i) => "walk" + i), ...Array.from({ length: WALK_N }, (_, i) => "run" + i)];
function warmAdvFigures(me: any, cw: any, pet: any) {
  if (!FIGURES_OK) return; pauseFigures(false);
  const jobs: any[] = HERO_FRAMES.map(po => ({ key: advBotKey(me, cw, po), kind: "bot", el: () => <CyberAvatar model={me} yaw={26} pose={heroPoseOf(po)} glow={cw && cw.glow} accent={cw && cw.accent} held={null} hat={null} acc={null} /> }));
  if (pet) jobs.push({ key: advPetKey(pet), kind: "pet", el: () => <PetArt species={pet.species} level={petLevel(pet.bond).lv} mood={pet.mood} /> });
  prepareFigures(jobs, true);
}
const NEAR_STYLE: any = { moonhe3: "pipes", moonbase: "wire", marscolony: "pipes", mercury: "ember", titanassault: "frost", titancolony: "frost", arkbuild: "wire", ferro: "pipes", cobalt: "pipes", jovia: "wisp", kryo: "frost", pyra: "ember", helios: "ember", nexa: "wire", dyson: "wire", ashfall: "wire" };
const MID_STYLE: any = { moonhe3: "mesa", moonbase: "ruins", marscolony: "mesa", mercury: "volcano", titanassault: "ice", titancolony: "ice", arkbuild: "ruins", ferro: "mesa", cobalt: "mesa", jovia: "pillar", kryo: "ice", pyra: "volcano", helios: "volcano", nexa: "ruins", dyson: "ruins", ashfall: "ruins" };
function bakePlanet(P, cw, ch, k, high) {
  const rgb = P.glow, acc = P.acc;
  const sky = layer(cw, ch, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P.c[0]); g.addColorStop(0.55, P.c[1]); g.addColorStop(1, P.c[2]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < (high ? 90 : 45); i++) { x.fillStyle = `rgba(255,255,255,${0.15 + rnd(i + 5) * 0.55})`; const s = (0.6 + rnd(i + 9) * 1.2) * k; x.fillRect(rnd(i) * w, rnd(i + 40) * h * 0.62, s, s); }
    // two moons and a ringed neighbour: the sky says "another planet" before anything else does
    const m1 = x.createRadialGradient(w * 0.72, h * 0.2, 0, w * 0.72, h * 0.2, h * 0.16); m1.addColorStop(0, "rgba(255,255,255,.95)"); m1.addColorStop(0.5, `rgba(${rgb},.55)`); m1.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = m1; x.beginPath(); x.arc(w * 0.72, h * 0.2, h * 0.16, 0, 7); x.fill();
    x.fillStyle = `rgba(${acc},.5)`; x.beginPath(); x.arc(w * 0.2, h * 0.14, h * 0.05, 0, 7); x.fill();
    x.strokeStyle = `rgba(${acc},.4)`; x.lineWidth = 2 * k; x.beginPath(); x.ellipse(w * 0.2, h * 0.14, h * 0.09, h * 0.022, -0.35, 0, 7); x.stroke();
    if (high) { for (let b = 0; b < 3; b++) { const gg = x.createLinearGradient(0, 0, w, 0); gg.addColorStop(0, `rgba(${rgb},0)`); gg.addColorStop(0.5, `rgba(${rgb},.07)`); gg.addColorStop(1, `rgba(${acc},0)`); x.fillStyle = gg; x.beginPath(); x.moveTo(0, h * (0.1 + b * 0.12)); x.quadraticCurveTo(w * 0.5, h * (0.02 + b * 0.1), w, h * (0.22 + b * 0.1)); x.lineTo(w, h * (0.3 + b * 0.1)); x.quadraticCurveTo(w * 0.5, h * (0.12 + b * 0.1), 0, h * (0.2 + b * 0.1)); x.fill(); } }
  });
  const tileW = TILE * k;
  const mk = (f, hh, alpha, shade) => layer(tileW, ch, (x, w, h) => {
    const base = GROUND * k;
    x.fillStyle = `rgba(${shade},${alpha})`;
    x.beginPath(); x.moveTo(0, h);
    for (let i = 0; i <= 24; i++) { const px = (i / 24) * w, py = base - hh * k * (0.3 + 0.7 * Math.abs(Math.sin(i * 0.9 + f) * Math.cos(i * 0.37 + f * 2))); x.lineTo(px, py); }
    x.lineTo(w, h); x.closePath(); x.fill();
  });
  const far = mk(1, 120, 0.85, "4,30,40");
  const mid = layer(tileW, ch, (x, w, h) => {
    const base = GROUND * k;
    x.fillStyle = "rgba(2,22,28,.92)"; x.fillRect(0, base - 6 * k, w, h);
    const sty = MID_STYLE[P.id] || "mush";
    if (sty !== "mush") {                              // per-planet skyline (owner 2026-10-11: terrain shapes per planet)
      const N = sty === "ruins" ? 12 : 10;
      for (let i = 0; i < N; i++) {
        const cx = (i + 0.5 + (rnd(i + 3) - 0.5) * 0.4) / N * w, th = (60 + rnd(i) * 110) * k, tw = (18 + rnd(i + 1) * 26) * k, col = i % 3 ? rgb : acc;
        x.fillStyle = "rgba(3,26,32,.96)";
        if (sty === "mesa") { x.fillRect(cx - tw, base - th, tw * 2, th); x.fillRect(cx - tw * 1.3, base - th, tw * 2.6, 8 * k); x.fillStyle = `rgba(${col},.5)`; for (let r = 1; r < 4; r++) x.fillRect(cx - tw, base - th + r * th * 0.22, tw * 2, 2 * k); }
        else if (sty === "pillar") { x.beginPath(); x.ellipse(cx, base - th * 0.5, tw * 0.9, th * 0.5, 0, 0, 7); x.fill(); for (let r = 0; r < 4; r++) { x.fillStyle = `rgba(${col},${0.25 - r * 0.04})`; x.fillRect(cx - tw * 1.4, base - th + r * th * 0.24, tw * 2.8, 5 * k); } }
        else if (sty === "ice") { x.beginPath(); x.moveTo(cx - tw, base); x.lineTo(cx - tw * 0.2, base - th); x.lineTo(cx + tw * 0.5, base - th * 0.6); x.lineTo(cx + tw, base); x.closePath(); x.fill(); x.strokeStyle = `rgba(${col},.8)`; x.lineWidth = 2 * k; x.beginPath(); x.moveTo(cx - tw * 0.2, base - th); x.lineTo(cx - tw * 0.05, base - th * 0.2); x.stroke(); }
        else if (sty === "volcano") { x.beginPath(); x.moveTo(cx - tw * 2, base); x.lineTo(cx - tw * 0.5, base - th); x.lineTo(cx + tw * 0.5, base - th); x.lineTo(cx + tw * 2, base); x.closePath(); x.fill(); const lg = x.createRadialGradient(cx, base - th, 0, cx, base - th, tw * 2.2); lg.addColorStop(0, `rgba(${acc},.9)`); lg.addColorStop(1, `rgba(${acc},0)`); x.fillStyle = lg; x.beginPath(); x.arc(cx, base - th, tw * 2.2, 0, 7); x.fill(); x.strokeStyle = `rgba(${acc},.7)`; x.lineWidth = 2 * k; x.beginPath(); x.moveTo(cx, base - th); x.lineTo(cx + tw * 0.4, base - th * 0.2); x.stroke(); }
        else { const bw = tw * 1.4; x.fillRect(cx - bw, base - th, bw * 2, th); x.fillStyle = "rgba(2,16,20,.98)"; x.beginPath(); x.moveTo(cx - bw, base - th); x.lineTo(cx - bw * 0.2, base - th - 16 * k); x.lineTo(cx + bw * 0.4, base - th + 6 * k); x.lineTo(cx + bw, base - th - 8 * k); x.lineTo(cx + bw, base - th); x.closePath(); x.fill(); x.fillStyle = `rgba(${col},.8)`; for (let wy = 0; wy < th - 12 * k; wy += 18 * k) for (let wx = -1; wx <= 1; wx += 2) if (rnd(i * 31 + wy + wx) > 0.55) x.fillRect(cx + wx * bw * 0.45 - 2 * k, base - th + 10 * k + wy, 4 * k, 6 * k); }
      }
    } else
    for (let i = 0; i < 14; i++) {                    // giant glowing mushrooms / spore trees
      const cx = (i + 0.5 + (rnd(i + 3) - 0.5) * 0.5) / 14 * w, th = (70 + rnd(i) * 80) * k, tw = (6 + rnd(i + 1) * 6) * k;
      x.fillStyle = "rgba(3,40,44,.95)"; x.beginPath(); x.moveTo(cx - tw, base); x.quadraticCurveTo(cx + (rnd(i + 2) - 0.5) * 20 * k, base - th * 0.5, cx, base - th); x.quadraticCurveTo(cx + tw * 0.3, base - th * 0.5, cx + tw, base); x.fill();
      const cr = (22 + rnd(i + 7) * 26) * k, col = i % 3 ? rgb : acc;
      const cg = x.createRadialGradient(cx, base - th, 0, cx, base - th, cr * 1.7); cg.addColorStop(0, `rgba(${col},.5)`); cg.addColorStop(1, `rgba(${col},0)`); x.fillStyle = cg; x.beginPath(); x.arc(cx, base - th, cr * 1.7, 0, 7); x.fill();
      x.fillStyle = `rgba(${col},.85)`; x.beginPath(); x.ellipse(cx, base - th, cr, cr * 0.55, 0, Math.PI, 0); x.fill();
      x.fillStyle = "rgba(255,255,255,.7)"; for (let s = 0; s < 4; s++) x.fillRect(cx + (s - 1.5) * cr * 0.4, base - th - cr * 0.2, 2 * k, 2 * k);
    }
  });
  const near = layer(tileW, ch, (x, w, h) => {
    const base = GROUND * k;
    const ns = NEAR_STYLE[P.id] || "fern";
    if (ns !== "fern") {                              // per-planet foreground (owner 2026-10-11): the same dark, lit-edge idea in other shapes
      for (let i = 0; i < 12; i++) {
        const cx = (i + 0.3 + rnd(i + 21) * 0.5) / 12 * w, fh = (22 + rnd(i + 30) * 40) * k;
        x.fillStyle = "rgba(2,16,20,.96)"; x.strokeStyle = `rgba(${rgb},.6)`; x.lineWidth = 2 * k;
        if (ns === "pipes") { x.fillRect(cx - 5 * k, base - fh, 10 * k, fh + 20 * k); x.fillRect(cx - 5 * k, base - fh, 30 * k, 8 * k); x.strokeRect(cx - 5 * k, base - fh, 10 * k, fh); x.beginPath(); x.arc(cx + 25 * k, base - fh + 4 * k, 5 * k, 0, 7); x.stroke(); }
        else if (ns === "wisp") { x.beginPath(); x.moveTo(cx, base + 20 * k); x.bezierCurveTo(cx - 20 * k, base - fh * 0.4, cx + 24 * k, base - fh * 0.7, cx, base - fh * 1.3); x.stroke(); x.beginPath(); x.arc(cx, base - fh * 1.3, 3 * k, 0, 7); x.fillStyle = `rgba(${rgb},.8)`; x.fill(); }
        else if (ns === "frost") { x.beginPath(); x.moveTo(cx - 9 * k, base + 20 * k); x.lineTo(cx - 2 * k, base - fh); x.lineTo(cx + 3 * k, base - fh * 0.5); x.lineTo(cx + 12 * k, base + 20 * k); x.closePath(); x.fill(); x.stroke(); x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(cx - 3 * k, base - fh, 2 * k, 2 * k); }
        else if (ns === "ember") { x.beginPath(); x.moveTo(cx - 14 * k, base + 20 * k); x.lineTo(cx - 6 * k, base - fh * 0.7); x.lineTo(cx + 4 * k, base - fh * 0.4); x.lineTo(cx + 16 * k, base + 20 * k); x.closePath(); x.fill(); x.stroke(); x.fillStyle = `rgba(${acc},.9)`; x.fillRect(cx - 2 * k, base - fh * 0.5, 3 * k, 3 * k); }
        else { x.fillRect(cx - 12 * k, base - fh * 0.6, 24 * k, fh * 0.6 + 20 * k); x.beginPath(); x.moveTo(cx + 12 * k, base - fh * 0.5); x.quadraticCurveTo(cx + 30 * k, base - fh * 1.1, cx + 40 * k, base - fh * 0.3); x.stroke(); x.fillStyle = `rgba(${acc},.8)`; x.fillRect(cx - 4 * k, base - fh * 0.5, 3 * k, 3 * k); }
      }
    } else
    for (let i = 0; i < 10; i++) {                   // foreground ferns, dark, with a lit edge
      const cx = (i + 0.3 + rnd(i + 21) * 0.5) / 10 * w, fh = (36 + rnd(i + 30) * 44) * k;
      x.strokeStyle = `rgba(${rgb},.55)`; x.lineWidth = 2 * k; x.fillStyle = "rgba(2,16,20,.96)";
      for (let b = -2; b <= 2; b++) { x.beginPath(); x.moveTo(cx, base + 24 * k); x.quadraticCurveTo(cx + b * 14 * k, base - fh * 0.7, cx + b * 26 * k, base - fh * (1 - Math.abs(b) * 0.18)); x.quadraticCurveTo(cx + b * 12 * k, base - fh * 0.5, cx, base + 24 * k); x.fill(); x.stroke(); }
    }
  });
  const ground = layer(tileW, ch, (x, w, h) => {
    const base = GROUND * k, g = x.createLinearGradient(0, base, 0, h); g.addColorStop(0, "#0b3a38"); g.addColorStop(0.08, "#06242a"); g.addColorStop(1, "#02090f"); x.fillStyle = g; x.fillRect(0, base, w, h - base);
    x.fillStyle = `rgba(${rgb},.9)`; x.fillRect(0, base, w, 2 * k);
    x.fillStyle = `rgba(${rgb},.18)`; x.fillRect(0, base + 2 * k, w, 6 * k);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${i % 4 ? rgb : acc},${0.25 + rnd(i) * 0.4})`; x.fillRect(rnd(i + 60) * w, base + (6 + rnd(i + 80) * 50) * k, (1 + rnd(i) * 2) * k, (1 + rnd(i) * 2) * k); }
  });
  let fog = null;
  if (high) fog = layer(tileW, ch, (x, w, h) => { const base = GROUND * k; for (let i = 0; i < 6; i++) { const cx = (i + 0.5) / 6 * w, g = x.createRadialGradient(cx, base - 8 * k, 0, cx, base - 8 * k, 160 * k); g.addColorStop(0, `rgba(${rgb},.16)`); g.addColorStop(1, `rgba(${rgb},0)`); x.save(); x.translate(0, base); x.scale(1, 0.18); x.translate(0, -base); x.fillStyle = g; x.beginPath(); x.arc(cx, base - 8 * k, 160 * k, 0, 7); x.fill(); x.restore(); } });
  const glows = { green: glowSprite(rgb, 40 * k), pink: glowSprite(acc, 40 * k), white: glowSprite("255,255,255", 30 * k), red: glowSprite("255,70,90", 40 * k) };
  return { sky, far, mid, near, ground, fog, glows };
}

/* ── the three monsters, drawn from a few shapes each (cheap: no gradients built per frame) ── */
function drawMonster(x, m, t, k, G) {
  const d = MON[m.type], bob = Math.sin(t * 5 + m.ph) * 2;
  x.save(); x.translate(m.x, 0);
  const flip = m.face < 0 ? -1 : 1; x.scale(flip, 1);
  const hit = m.hurt > 0;
  if (paintMonster(x, m, t, GROUND, hit, TINT ? TINT.glow : "190,130,255", TINT ? TINT.body : null)) { x.restore(); return; }
  const body = hit ? "#ffffff" : TINT ? TINT.body : m.type === "glowbug" ? "#0e5a4a" : m.type === "thornback" ? "#3a1030" : "#2a1a66";
  const glow = TINT ? TINT.glow : m.type === "glowbug" ? "90,255,200" : m.type === "thornback" ? "255,70,90" : "190,130,255";
  if (m.type === "magmaling") {
    const y = GROUND - m.y, wob = Math.sin(t * 9 + m.ph) * 2; x.fillStyle = hit ? "#fff" : "#7a1a0a"; x.beginPath(); x.ellipse(0, y - 14, 24 + wob, 15, 0, Math.PI, 0); x.lineTo(24, y); x.lineTo(-24, y); x.closePath(); x.fill();
    x.fillStyle = hit ? "#fff" : "#ff7a2a"; x.beginPath(); x.ellipse(-4, y - 18, 12, 6, 0, 0, 7); x.fill(); x.fillStyle = "#ffd23f"; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(-12 + i * 10, y - 8 + Math.sin(t * 7 + i) * 2, 2.6, 0, 7); x.fill(); }
    x.fillStyle = "#fff6c0"; x.beginPath(); x.arc(14, y - 18, 3.2, 0, 7); x.fill();
  } else if (m.type === "flarecaster") {
    const y = GROUND - 56 - m.y + Math.sin(t * 2.4 + m.ph) * 6; x.fillStyle = hit ? "#fff" : "#4a1208"; x.beginPath(); x.ellipse(0, y, 16, 24, 0, 0, 7); x.fill();
    x.globalCompositeOperation = "lighter"; for (let i = 0; i < 5; i++) { const a = t * 3 + i * 1.26 + m.ph; x.fillStyle = `rgba(255,${120 + i * 25},40,.8)`; x.beginPath(); x.arc(Math.cos(a) * 20, y + Math.sin(a) * 14, 4, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over";
    x.fillStyle = "#ffe08a"; x.beginPath(); x.arc(8, y - 4, 4, 0, 7); x.fill();
  } else if (m.type === "scrapgolem") {
    const y = GROUND - m.y; x.fillStyle = hit ? "#fff" : "#2c2638"; x.fillRect(-34, y - 70, 68, 52); x.fillStyle = hit ? "#fff" : "#4a4160"; x.fillRect(-44, y - 64, 16, 40); x.fillRect(28, y - 60, 16, 44); x.fillStyle = "#1a1626"; x.fillRect(-26, y - 20, 18, 20); x.fillRect(8, y - 20, 18, 20);
    x.fillStyle = hit ? "#fff" : "#6b5f8c"; x.fillRect(-20, y - 86, 40, 20); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(190,150,255,.95)"; x.fillRect(2, y - 80, 12, 5); x.fillStyle = "rgba(190,150,255,.5)"; x.fillRect(-22, y - 50, 44, 4); x.globalCompositeOperation = "source-over";
  } else if (m.type === "drone") {
    const y = GROUND - 60 - m.y + Math.sin(t * 3 + m.ph) * 5; x.fillStyle = hit ? "#fff" : "#38304e"; x.beginPath(); x.ellipse(0, y, 22, 11, 0, 0, 7); x.fill();
    x.strokeStyle = "#6b5f8c"; x.lineWidth = 3; x.beginPath(); x.moveTo(-26, y - 10); x.lineTo(26, y - 10); x.stroke(); x.save(); x.translate(0, y - 14); x.scale(Math.cos(t * 30), 1); x.fillStyle = "rgba(190,150,255,.4)"; x.fillRect(-18, -2, 36, 3); x.restore();
    x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,90,120,.9)"; x.beginPath(); x.arc(12, y + 2, 3.5, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  } else if (m.type === "rustcrawler") {
    const y = GROUND - m.y; x.strokeStyle = "#2a1408"; x.lineWidth = 3; for (let i = 0; i < 4; i++) { const lx = -18 + i * 12, ph = Math.sin(t * 16 + i * 1.6 + m.ph) * 5; x.beginPath(); x.moveTo(lx, y - 8); x.lineTo(lx - 5, y + ph * 0.3); x.stroke(); }
    x.fillStyle = hit ? "#fff" : "#6a3a1a"; x.beginPath(); x.moveTo(-26, y - 6); x.quadraticCurveTo(-18, y - 30, 4, y - 26); x.quadraticCurveTo(28, y - 22, 28, y - 6); x.closePath(); x.fill();
    x.fillStyle = hit ? "#fff" : "#a8591f"; x.fillRect(-16, y - 24, 14, 5); x.fillRect(2, y - 22, 12, 4);
    x.fillStyle = "#ffb04a"; x.beginPath(); x.arc(20, y - 16, 3.4, 0, 7); x.fill(); x.fillStyle = "rgba(255,150,60,.35)"; x.beginPath(); x.arc(20, y - 16, 8, 0, 7); x.fill();
  } else if (m.type === "magnet") {
    const y = GROUND - m.y; x.fillStyle = hit ? "#fff" : "#2b3038"; x.fillRect(-12, y - 52, 24, 52); x.fillStyle = hit ? "#fff" : "#4a525e"; x.fillRect(-20, y - 8, 40, 8);
    x.strokeStyle = "#ff9a3c"; x.lineWidth = 3; x.beginPath(); x.arc(0, y - 62, 16, Math.PI * 0.15, Math.PI * 0.85, true); x.stroke(); x.beginPath(); x.arc(0, y - 62, 16, Math.PI * 1.15, Math.PI * 1.85, true); x.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + m.ph); x.fillStyle = `rgba(255,${120 + pulse * 100 | 0},60,.9)`; x.beginPath(); x.arc(0, y - 62, 6 + pulse * 2, 0, 7); x.fill();
  } else if (m.type === "shardling") {
    const y = GROUND - m.y - 2 + Math.abs(Math.sin(t * 6 + m.ph)) * -3;
    x.fillStyle = hit ? "#fff" : "#7fd0ff"; for (let i = 0; i < 4; i++) { const bx = -18 + i * 12, h = 22 + (i % 2) * 14; x.beginPath(); x.moveTo(bx - 7, y); x.lineTo(bx, y - h); x.lineTo(bx + 7, y); x.closePath(); x.fill(); }
    x.fillStyle = hit ? "#fff" : "#1d5a86"; x.beginPath(); x.moveTo(-22, y); x.lineTo(-8, y - 18); x.lineTo(10, y - 16); x.lineTo(24, y); x.closePath(); x.fill();
    x.fillStyle = "#eaffff"; x.beginPath(); x.arc(12, y - 9, 3, 0, 7); x.fill();
  } else if (m.type === "frostcaster") {
    const y = GROUND - 56 - m.y + Math.sin(t * 2.2 + m.ph) * 6;
    x.fillStyle = hit ? "#fff" : "#a8e4ff"; x.beginPath(); x.moveTo(0, y - 26); x.lineTo(16, y); x.lineTo(0, y + 26); x.lineTo(-16, y); x.closePath(); x.fill();
    x.fillStyle = hit ? "#fff" : "#3b8fc4"; x.beginPath(); x.moveTo(0, y - 14); x.lineTo(8, y); x.lineTo(0, y + 14); x.lineTo(-8, y); x.closePath(); x.fill();
    x.strokeStyle = "rgba(190,240,255,.8)"; x.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 1.4 + i * 2.1 + m.ph; x.beginPath(); x.arc(0, y, 26, a, a + 0.7); x.stroke(); }
    x.fillStyle = "#e9ff9a"; x.beginPath(); x.arc(14 , y + 2, 3.5, 0, 7); x.fill();
  } else if (m.type === "glowbug") {
    const y = GROUND - m.y - 6 + bob * 0.5;
    x.strokeStyle = "#063d33"; x.lineWidth = 3; for (let i = 0; i < 3; i++) { const lx = -14 + i * 12, ph = Math.sin(t * 12 + i + m.ph) * 4; x.beginPath(); x.moveTo(lx, y); x.lineTo(lx - 6, y + 12 + ph); x.lineTo(lx - 2, y + 14 + ph); x.stroke(); }
    x.fillStyle = body; x.beginPath(); x.ellipse(0, y - 4, 22, 16, 0, 0, 7); x.fill();
    x.fillStyle = hit ? "#fff" : "#1fae8d"; x.beginPath(); x.ellipse(-4, y - 9, 11, 6, -0.2, 0, 7); x.fill();
    x.fillStyle = `rgb(${glow})`; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(10 + i * 4, y - 8 - (i % 2) * 3, 2.6, 0, 7); x.fill(); }
    x.fillStyle = `rgba(${glow},.9)`; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-14 + i * 7, y - 2, 1.8, 0, 7); x.fill(); }
  } else if (m.type === "thornback") {
    const y = GROUND - m.y + bob * 0.3;
    x.fillStyle = "#1c0a18"; for (let i = 0; i < 4; i++) x.fillRect(-28 + i * 17, y - 8, 9, 10 + Math.sin(t * 6 + i * 1.7 + m.ph) * 2);
    x.fillStyle = body; x.beginPath(); x.moveTo(-38, y - 6); x.quadraticCurveTo(-30, y - 38, 0, y - 36); x.quadraticCurveTo(34, y - 34, 40, y - 12); x.lineTo(30, y - 4); x.lineTo(-34, y - 4); x.closePath(); x.fill();
    x.fillStyle = hit ? "#fff" : "#7a1f5a"; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(-26 + i * 13, y - 28 + Math.abs(i - 2) * 3); x.lineTo(-20 + i * 13, y - 50 + Math.abs(i - 2) * 6); x.lineTo(-14 + i * 13, y - 30 + Math.abs(i - 2) * 3); x.closePath(); x.fill(); }
    x.fillStyle = `rgb(${glow})`; x.beginPath(); x.arc(30, y - 20, 4, 0, 7); x.fill(); x.fillStyle = "rgba(255,70,90,.35)"; x.beginPath(); x.arc(30, y - 20, 9, 0, 7); x.fill();
    x.fillStyle = `rgba(${glow},.8)`; x.fillRect(-6, y - 22, 14, 3);
  } else {
    const y = GROUND - 56 - m.y + Math.sin(t * 2.4 + m.ph) * 6;
    x.strokeStyle = hit ? "#fff" : "#6a46cc"; x.lineWidth = 2.5; for (let i = 0; i < 5; i++) { const lx = -14 + i * 7; x.beginPath(); x.moveTo(lx, y + 10); x.quadraticCurveTo(lx + Math.sin(t * 3 + i + m.ph) * 8, y + 28, lx + Math.sin(t * 2.2 + i) * 10, y + 44); x.stroke(); }
    x.fillStyle = body; x.beginPath(); x.ellipse(0, y, 26, 20, 0, Math.PI, 0); x.lineTo(26, y + 10); x.lineTo(-26, y + 10); x.closePath(); x.fill();
    x.fillStyle = hit ? "#fff" : "rgba(160,110,255,.55)"; x.beginPath(); x.ellipse(0, y - 4, 18, 12, 0, Math.PI, 0); x.fill();
    x.fillStyle = `rgb(${glow})`; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(-10 + i * 10, y - 6 + (i % 2) * 3, 3.2, 0, 7); x.fill(); }
    x.fillStyle = "#e9ff9a"; x.beginPath(); x.arc(14, y + 2, 4.5, 0, 7); x.fill();
  }
  x.restore();
}

/* the end-of-map guardian: a big armoured shape in the planet's colours; it flashes before each attack */
function drawBoss(x, b, t, P) { paintBoss(x, b, t, P, GROUND); }

const CSS = `
.adv-sectors{display:flex;gap:8px;margin:4px 0 10px}.adv-sec{flex:1;border:1.5px solid rgba(140,255,220,.35);background:rgba(255,255,255,.06);color:#fff;padding:9px 12px;border-radius:999px!important;font-weight:800;font-size:13px;cursor:pointer}.adv-sec.on{background:linear-gradient(135deg,#2fd6b0,#4a7bff);border-color:transparent}.adv-sec em{font-style:normal;opacity:.85;margin-left:6px;font-size:11px}
.adv{position:fixed;inset:0;z-index:2400;background:#02070c;color:#e8fffa;font-family:var(--f-app,system-ui);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.adv-lobby{margin:8px 0;border:1px solid #3ddc97;border-radius:12px;padding:10px;background:rgba(20,98,79,.25);display:grid;gap:8px}.adv-lobby label{font-size:12px;display:flex;gap:8px;align-items:center}.adv-lobby input{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.25);border-radius:8px;color:#fff;padding:6px 8px}
.al-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.al-code{width:92px;text-transform:uppercase;letter-spacing:2px;text-align:center}.al-err{color:#ff9a9a}.al-room{display:flex;gap:10px;align-items:center}.al-room b{font-size:24px;letter-spacing:5px;color:#ffd23f}.al-peers{display:flex;gap:6px;flex-wrap:wrap}.al-peer{border:1.5px solid;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}
.adv-emotes{position:absolute;right:10px;top:76px;display:flex;gap:6px;z-index:5}.adv-emotes button{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.4);font-size:18px}.adv-team{position:absolute;left:10px;top:92px;z-index:5;display:grid;gap:3px;font-size:11px;font-weight:800;pointer-events:none}.adv-team span{padding:2px 8px;border-radius:999px;background:rgba(0,0,0,.45);border-left:3px solid}
.adv-book{margin:8px 0;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px 10px;background:rgba(255,255,255,.05)}.adv-book summary{cursor:pointer;font-weight:800;font-size:13px}
.ab-tabs{display:flex;gap:6px;margin:8px 0}.ab-tabs button{flex:1;padding:7px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.25);color:inherit;font-weight:700;font-size:12px}.ab-tabs button.on{background:linear-gradient(120deg,#5a7bff,#9a5cff)}
.ab-list{display:grid;gap:6px;max-height:260px;overflow:auto}.ab-row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:7px 9px;border-radius:9px;background:rgba(0,0,0,.28);font-size:12px}.ab-row.lock{opacity:.5}.ab-row.eq{outline:1.5px solid #ffd23f}
.ab-row small{grid-column:1/2;opacity:.85;font-size:11px}.ab-row em{font-style:normal;font-size:10px;opacity:.8;grid-column:1/2}.ab-btns{grid-column:2/3;grid-row:1/4;display:flex;flex-direction:column;gap:4px;justify-content:center}.ab-btns button{padding:5px 8px;border-radius:8px;border:0;font-weight:800;font-size:11px;background:#2b3a5a;color:#fff}.ab-btns button.on{background:#d9a21b}.ab-btns button:disabled{opacity:.45}
.adv-ship{position:absolute;inset:0;z-index:5;background:#02030c}.adv-ship canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.adv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.adv-world{position:absolute;inset:0;will-change:transform}
.adv-px{position:absolute;left:0;top:0;will-change:transform;pointer-events:none}
.adv-px svg{width:100%;height:100%;display:block;overflow:visible}.adv-wpn{position:absolute;left:52%;top:36%;width:62%;height:22%;pointer-events:none;transform-origin:16% 55%}.adv-wpn svg{width:100%;height:100%}
.adv-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;padding:8px 10px;padding-top:calc(8px + env(safe-area-inset-top,0px));background:linear-gradient(180deg,rgba(0,8,14,.7),rgba(0,8,14,0));z-index:4}
.adv-btn{min-width:44px;min-height:44px;border-radius:22px;border:1.5px solid rgba(140,255,220,.5);background:rgba(4,24,30,.62);color:#e8fffa;font-size:13px;font-weight:800;padding:0 14px;cursor:pointer;backdrop-filter:blur(4px)}
.adv-hud{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.adv-bar{position:relative;height:13px;border-radius:7px;background:rgba(255,255,255,.12);overflow:hidden}.adv-bar i{position:absolute;inset:0 auto 0 0;border-radius:7px}
.adv-bar b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:.4px;text-shadow:0 1px 2px #000}
.adv-hp i{background:linear-gradient(90deg,#ff4d6d,#ff9a6d)}.adv-xp i{background:linear-gradient(90deg,#3ddc97,#9dffd6)}.adv-sk i{background:linear-gradient(90deg,#7b61ff,#c3b0ff)}
.adv-lv{font-size:12px;font-weight:900;letter-spacing:.6px;color:#9dffd6}
.adv-pad{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;padding:10px 14px calc(14px + env(safe-area-inset-bottom,0px));z-index:4;pointer-events:none}
.adv-pad>div{pointer-events:auto}
.adv-pad .pvppad-l{display:flex;gap:8px}.adv-pad .pvppad-r{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.adv .pvpact.ult i{max-width:54px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}
.adv .pvpdir{width:58px;height:58px;background:rgba(255,255,255,.82);backdrop-filter:blur(3px);color:#12202a}
.adv .pvpact{width:68px;height:56px;background:rgba(255,255,255,.82);backdrop-filter:blur(3px);color:#12202a}
.adv-pad .pvppad-r .pvpact.rocket{grid-column:auto;width:68px;color:#7a2a10;background:linear-gradient(135deg,#ffe3d0,#ffb98f)}@media (max-width:600px){.adv-pad .pvppad-r .pvpact.rocket{width:58px}}.adv .pvpact.dig{background:linear-gradient(135deg,#8a6a3a,#c9a227);color:#fff}.adv .pvpact.punch{background:linear-gradient(135deg,#e2865fee,#d05f43ee);color:#fff}.adv .pvpact.kick{background:linear-gradient(135deg,#c9a227ee,#a8791bee);color:#fff}.adv .pvpact.spell{background:linear-gradient(0deg,#9b7bff var(--sp,0%),rgba(255,255,255,.82) var(--sp,0%));color:#2a1a66}.adv .pvpact.spell.ready{background:linear-gradient(135deg,#b49bff,#7b61ff);color:#fff;animation:pvpOdPulse 1s ease-in-out infinite}
.adv .pvpact.ult{background:linear-gradient(135deg,#fff0c2,#ffd23f);color:#7a4a06}
/* ship maps: a touch stick on the left half of the screen and one big round joystick (owner, 2026-10-12) */
.adv-stickzone{position:absolute;left:0;top:64px;bottom:0;width:52%;z-index:3;touch-action:none}
.adv-stickring{position:absolute;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;border:2px dashed rgba(255,255,255,.35);background:rgba(255,255,255,.06);opacity:0;pointer-events:none;transition:opacity .15s}
.adv-ship .adv-pad{pointer-events:none}.adv-ship .adv-pad .pvppad-l{pointer-events:none}
.adv-joy{position:relative;width:128px;height:128px;border-radius:50%;pointer-events:auto;touch-action:none;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.22),rgba(255,255,255,.08) 60%,rgba(255,255,255,.04));border:2px solid rgba(255,255,255,.35);box-shadow:0 6px 22px rgba(0,0,0,.45),inset 0 0 18px rgba(255,255,255,.08)}
.adv-joy>b{position:absolute;color:rgba(255,255,255,.7);font-size:15px;line-height:1;pointer-events:none}.adv-joy .u{top:7px;left:50%;transform:translateX(-50%)}.adv-joy .d{bottom:7px;left:50%;transform:translateX(-50%)}.adv-joy .l{left:9px;top:50%;transform:translateY(-50%)}.adv-joy .r{right:9px;top:50%;transform:translateY(-50%)}
.adv-knob{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffd9c2 55%,#e89a74);box-shadow:0 4px 14px rgba(0,0,0,.5);pointer-events:none;transition:transform .05s linear}
/* the gear pop-up (owner, 2026-10-12) */
.adv-gear{margin-left:auto}.adv-pause{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,6,12,.78);backdrop-filter:blur(4px);padding:14px}
.adv-pause-card{width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px;padding:20px;border-radius:34px;text-align:center;background:linear-gradient(180deg,#0b2a35,#061821);border:1.5px solid rgba(140,255,220,.5);box-shadow:0 18px 50px rgba(0,0,0,.6);color:#e6fff6}
.adv-pause-card b{font-size:22px;letter-spacing:1px}.adv-pause-card p{margin:0;font-size:13px;line-height:1.45;color:#b6d8d0}.adv-pause-ic{font-size:30px}
.adv-pause-row{display:flex;gap:6px;align-items:center;justify-content:space-between}.adv-pause-row span{font-size:13px;font-weight:800;margin-right:4px}
.adv-pause-row button{flex:1;min-height:44px;border-radius:999px;border:1.5px solid rgba(140,255,220,.4);background:transparent;color:#cfeee6;font-weight:800;font-size:13px;cursor:pointer}.adv-pause-row button.on{background:rgba(61,220,151,.3);border-color:#3ddc97;color:#fff}
.adv-ship .pvpact.light{background:linear-gradient(135deg,#d9e8ff,#9fb8ff);color:#1a2a6a;position:relative;overflow:hidden}.adv-ship .pvpact.light.cool{opacity:.7}.adv-ship .pvpact.light.on{background:linear-gradient(135deg,#fff,#ffb8ff);box-shadow:0 0 22px rgba(190,170,255,.9)}.adv-ship .pvpact.light::after{content:"";position:absolute;left:0;bottom:0;height:5px;width:var(--lc,100%);background:#3a6bff;opacity:.85}
.ac-lang{position:absolute;left:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:3;display:flex;gap:8px}.ac-lang button{min-height:40px;padding:0 12px;border-radius:20px;border:1.5px solid rgba(255,255,255,.4);background:rgba(0,0,0,.55);color:#fff;font-weight:800;font-size:13px;cursor:pointer}.ac-lang button b{color:#ffe08a;margin-left:4px}
.adv-rankbar{margin:2px 0 8px}.adv-rank{margin:0 0 10px;padding:10px 12px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(140,255,220,.25);font-size:12.5px}.adv-rank select{width:100%;padding:7px 10px;border-radius:999px;background:#0b2230;color:#fff;border:1px solid rgba(140,255,220,.35)}.adv-rank ol{margin:6px 0 0;padding:0;list-style:none}.adv-rank li{display:flex;gap:8px;padding:3px 0}.adv-rank li span{margin-left:auto;font-variant-numeric:tabular-nums}
.ay-dir{display:flex;justify-content:space-between;font-size:11px;font-weight:800;letter-spacing:2px;opacity:.7}.ay-spine{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}.ay-slot,.ay-mod{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:76px;padding:6px 2px;border-radius:18px;border:1.5px dashed rgba(160,255,220,.35);background:rgba(6,30,34,.7);color:#e6fff6;font-size:11px;cursor:pointer}.ay-slot.full{border-style:solid;border-color:rgba(140,255,200,.7);background:rgba(16,70,64,.75)}.ay-slot.drop{border-color:#ffd23f;box-shadow:0 0 12px rgba(255,210,63,.35)}.ay-slot em,.ay-mod em{font-style:normal;font-size:10px;opacity:.8}.ay-tray{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:80px;align-items:center}.ay-mod{min-width:86px;border-style:solid;border-color:rgba(255,210,63,.5)}.ay-mod.on{background:rgba(255,210,63,.25);box-shadow:0 0 14px rgba(255,210,63,.4)}.ay-bal{display:flex;align-items:center;gap:8px;font-size:12px}.ay-bal .af-bar{flex:1}.ay-rules{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:4px 12px;font-size:12px}.ay-rules li{opacity:.65}.ay-rules li.ok{opacity:1;color:#9fffd0}
.adv-farm{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;gap:8px;padding:76px 12px 12px;background:radial-gradient(ellipse at 50% 0%,#0c3a30 0%,#04141a 70%);color:#e6fff6;overflow:auto}
.af-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex:1;min-height:150px}.af-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px;border-radius:26px;border:2px solid rgba(140,255,220,.3);background:rgba(10,50,44,.6);color:#e6fff6;cursor:pointer;font-weight:700}
.af-cell .af-ic{font-size:30px;line-height:1}.af-cell small{font-size:11px;opacity:.85;text-align:center}.af-cell em{font-style:normal;font-size:11px;font-weight:800;color:#9fffd0}.af-cell.ready{border-color:#ffe07a;box-shadow:0 0 18px rgba(255,224,122,.5)}.af-cell.ready em{color:#ffe07a}.af-cell.sick{border-color:#ff6b81;animation:afp .5s infinite alternate}.af-cell.sick em{color:#ff9aa8}@keyframes afp{to{box-shadow:0 0 22px rgba(255,107,129,.8)}}
.af-bar{width:100%;height:7px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}.af-bar i{display:block;height:100%;background:linear-gradient(90deg,#3ddc97,#9fffd0)}
.af-res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.af-r{display:flex;flex-direction:column;gap:5px;padding:8px 10px;border-radius:20px;border:1.5px solid rgba(140,255,220,.35);background:rgba(10,50,44,.55);color:#e6fff6;font-weight:800;font-size:12px;cursor:pointer;text-align:left;min-height:48px}.af-r.low{border-color:#ff6b81}.af-r.low .af-bar i{background:#ff6b81}.af-r.cd{opacity:.65}
.af-tech{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.af-t{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:20px;border:1.5px solid rgba(255,224,122,.4);background:rgba(60,48,10,.5);color:#fff3c8;font-size:12px;text-align:left;cursor:pointer;min-height:48px}.af-t small{font-size:10.5px;opacity:.85}.af-t.on{border-color:#3ddc97;background:rgba(10,70,50,.6)}.af-t:disabled:not(.on){opacity:.5}
.af-fact{font-size:12px;line-height:1.4;color:#b6d8d0;padding:6px 10px;border-radius:16px;background:rgba(0,0,0,.25)}.af-pick{display:flex;flex-direction:column;gap:6px}.af-pick .adv-btn{display:flex;justify-content:space-between;gap:8px;text-align:left}.af-pick small{opacity:.8}
@media (max-width:600px){.adv .pvpdir{width:50px;height:50px}.adv .pvpact{width:58px;height:50px}.adv-pad .pvppad-r,.adv-pad .pvppad-l{gap:6px}}
.adv-key{width:68px;height:68px;border-radius:22px;border:2px solid rgba(140,255,220,.55);background:rgba(4,30,36,.6);color:#fff;font-size:26px;font-weight:900;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;cursor:pointer;backdrop-filter:blur(4px)}
.adv-key small{font-size:9.5px;font-weight:800;letter-spacing:.5px;margin-top:-2px}
.adv-key.on,.adv-key:active{background:rgba(61,220,151,.45)}
.adv-key.atk{width:84px;height:84px;border-radius:42px;background:linear-gradient(160deg,#ff8a5d,#d9482b);border-color:transparent}
.adv-key.skl{background:linear-gradient(160deg,#7b61ff,#4a35c9);border-color:transparent}.adv-key.cd{opacity:.45}
.adv-clear{position:absolute;left:50%;top:24%;transform:translateX(-50%);z-index:7;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 18px;border-radius:18px;background:rgba(4,20,26,.88);border:1.5px solid rgba(255,214,90,.6);box-shadow:0 0 30px rgba(255,214,90,.25);min-width:240px;animation:advc .4s ease-out}
.adv-clear .ac-coins{color:#ffe08a;font-weight:800}.adv-clear b{font-size:20px;color:#ffe08a;letter-spacing:1px}.adv-clear small{opacity:.85}.adv-clear .go{background:linear-gradient(135deg,#7b61ff,#4a35c9);border-color:transparent;padding:0 18px;font-size:14px}.adv-clear .adv-btn{min-height:44px;border-radius:14px}
@keyframes advc{from{transform:translateX(-50%) scale(.85);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}
.adv-cine.rot{position:fixed;inset:auto;top:0;left:100vw;width:100vh;height:100vw;transform-origin:top left;transform:rotate(90deg);z-index:60}.adv-cine{position:absolute;inset:0;z-index:8;background:#000;overflow:hidden;touch-action:manipulation}.adv-cine canvas{position:absolute;inset:0;width:100%;height:100%}
.ac-skip{position:absolute;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:3;min-height:40px;padding:0 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.4);background:rgba(0,0,0,.45);color:#fff;font-weight:800;font-size:13px}
.ac-snd{position:absolute;left:50%;top:15.5%;transform:translateX(-50%);z-index:9;padding:10px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(10,20,36,.78);color:#fff;font-weight:800;font-size:14px;animation:acPulse 1.4s ease-in-out infinite}@keyframes acPulse{50%{box-shadow:0 0 0 8px rgba(255,255,255,.12)}}
.ac-cap{position:absolute;left:8%;right:8%;top:50%;transform:translateY(-50%);text-align:center;font-size:clamp(18px,3.6vw,32px);font-weight:800;letter-spacing:.4px;line-height:1.4;color:#fff;padding:14px 22px;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.55) 18%,rgba(0,0,0,.55) 82%,rgba(0,0,0,0));text-shadow:0 2px 12px #000,0 0 24px rgba(120,190,255,.6);animation:acc 6.5s ease both;pointer-events:none}
/* the story shots keep the picture visible: the caption sits low, smaller, on a darker band */
.ac-cap.low{top:auto;bottom:15%;transform:none;font-size:clamp(13px,2.45vw,22px);padding:10px 22px;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.7) 12%,rgba(0,0,0,.7) 88%,rgba(0,0,0,0))}
@keyframes acc{0%{opacity:0;margin-top:10px}10%{opacity:1;margin-top:0}90%{opacity:1}100%{opacity:0}}
.ac-tag{position:absolute;left:8%;top:17%;font-size:11px;letter-spacing:3px;font-weight:800;color:#ffb36b;padding:5px 12px;border:1px solid rgba(255,179,107,.5);border-radius:999px;background:rgba(0,0,0,.45);animation:acc 4.4s ease both;pointer-events:none}.ac-tag[data-theme=ai]{color:#7fe8ff;border-color:rgba(127,232,255,.5)}.ac-tag[data-theme=friend]{color:#8dffdc;border-color:rgba(141,255,220,.5)}.ac-tag[data-theme=dark]{color:#cdb0ff;border-color:rgba(205,176,255,.5)}.ac-tag[data-theme=reactor]{color:#ffd27a;border-color:rgba(255,210,122,.5)}
.ac-title{position:absolute;left:8%;top:17%;display:flex;flex-direction:column;gap:2px;animation:acc 4.4s ease both;pointer-events:none}.ac-title small{letter-spacing:4px;font-size:11px;color:#9fd8ff}.ac-title b{font-size:clamp(28px,6vw,54px);letter-spacing:2px;text-shadow:0 0 24px rgba(140,200,255,.8)}
.ac-obj{position:absolute;inset:11% 0 11% 0;display:flex;align-items:center;justify-content:center;gap:4%;padding:0 6%;animation:acc2 .8s ease both}@keyframes acc2{from{opacity:0}to{opacity:1}}
.ac-hero{height:94%;aspect-ratio:1/2.2;filter:drop-shadow(0 0 22px rgba(120,220,255,.5))}.ac-hero svg{width:100%;height:100%;display:block;overflow:visible}
.ac-goal{display:flex;flex-direction:column;gap:6px;max-width:460px}.ac-goal small{letter-spacing:4px;color:#ffd23f;font-size:11px}.ac-goal b{font-size:clamp(22px,4.5vw,36px)}
.ac-goal ul{margin:6px 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}.ac-goal li{padding:8px 12px;border-left:3px solid #7fe8ff;background:rgba(10,30,46,.6);font-size:clamp(12px,2.2vw,16px);animation:acc2 .6s ease both}
.ac-goal .go{background:linear-gradient(135deg,#ff8a5d,#d9482b);border-color:transparent;padding:0 22px;font-size:15px;align-self:flex-start;min-height:46px}
.adv-strike{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 0%,#241a10,#050403);padding:calc(10px + env(safe-area-inset-top,0px)) 14px calc(12px + env(safe-area-inset-bottom,0px));gap:10px;touch-action:manipulation}
.as-top{display:flex;align-items:center;gap:10px}.as-top div{flex:1;display:flex;flex-direction:column}.as-top small{font-size:11px;opacity:.8}.as-n{font-weight:900;font-size:18px}
.as-map{position:relative;flex:1;min-height:120px;border-radius:14px;border:1px solid rgba(255,170,80,.35);background:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 2px,transparent 2px 60px),linear-gradient(180deg,#0e0b07,#2a2012);overflow:hidden}
.as-base{position:absolute;bottom:14%;transform:translateX(-50%);font-size:34px;filter:drop-shadow(0 0 6px rgba(255,120,60,.6))}.as-base.dead{filter:grayscale(1) brightness(.6)}
.as-ret{position:absolute;top:0;bottom:0;width:3px;margin-left:-1px;background:linear-gradient(180deg,#ff4d6d,rgba(255,77,109,.2));box-shadow:0 0 12px #ff4d6d}.as-ret::after{content:"";position:absolute;left:-14px;top:46%;width:30px;height:30px;border:2px solid #ff4d6d;border-radius:50%}
.as-fall{position:absolute;top:-10%;transform:translateX(-50%);font-size:30px;animation:asf .8s ease-in forwards}@keyframes asf{to{top:62%}}
.as-boom{position:absolute;bottom:6%;width:220px;height:220px;margin-left:-110px;border-radius:50%;background:radial-gradient(circle,#fff,#ffd23f 25%,#ff6a1a 55%,transparent 72%);animation:asb .9s ease-out forwards}@keyframes asb{from{transform:scale(.2);opacity:1}to{transform:scale(1.5);opacity:0}}
.as-bot{display:flex;gap:10px;align-items:center;justify-content:center}.as-bot .go{background:linear-gradient(135deg,#ff8a5d,#d9482b);padding:0 22px;border-color:transparent;font-size:15px}.as-bot .go:disabled{opacity:.5}
.adv-shop{display:flex;flex-direction:column;gap:6px;margin:10px 0;padding:10px;border-radius:14px;background:rgba(10,40,48,.55);border:1px solid rgba(140,255,220,.25)}
.adv-shop b{font-size:13px}.adv-up,.adv-q{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;border:1px solid rgba(140,255,220,.3);background:rgba(4,30,36,.6);color:#fff;font-size:13px;min-height:44px}
.adv-nocine{display:flex;gap:8px;align-items:center;font-size:13px;margin:8px 0}.adv-nocine input{width:20px;height:20px}
.adv-load{display:flex;flex-direction:column;gap:4px}.adv-load small{opacity:.8}.adv-load>div{display:flex;flex-wrap:wrap;gap:6px}.adv-load button{padding:8px 10px;border-radius:10px;border:1px solid rgba(140,255,220,.3);background:rgba(4,30,36,.6);color:#fff;font-size:12px;min-height:40px}.adv-load button.on{background:rgba(61,220,151,.4);border-color:#3ddc97}.adv-load button:disabled{opacity:.45}
.adv-up:disabled{opacity:.5}.adv-up em,.adv-q em{font-style:normal;font-weight:800;color:#7fe8ff}.adv-q.ok{opacity:.7}.adv-q.ok em{color:#7dffa8}
.adv-key.dash{width:58px;height:58px;border-radius:20px;background:rgba(10,60,80,.65)}
@media (max-width:600px){.adv-key{width:58px;height:58px;font-size:22px}.adv-key.atk{width:72px;height:72px}.adv-key.dash{width:50px;height:50px}.adv-pad>div{gap:7px}}
.adv-banner{position:absolute;left:50%;top:26%;transform:translateX(-50%);z-index:5;pointer-events:none;text-align:center;animation:advb 1.8s ease-out forwards}
.adv-banner b{display:block;font-size:30px;font-weight:900;letter-spacing:2px;color:#ffe08a;text-shadow:0 0 18px #ffb43a,0 2px 0 #000}.adv-banner span{font-size:13px;color:#e8fffa;text-shadow:0 1px 2px #000}
@keyframes advb{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}12%{opacity:1;transform:translate(-50%,0) scale(1.1)}20%{transform:translate(-50%,0) scale(1)}80%{opacity:1}100%{opacity:0}}
.adv-menu{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 0%,#0b2a35,#02070c);padding:calc(14px + env(safe-area-inset-top,0px)) 14px 14px;overflow-y:auto}
.adv-menu h2{margin:6px 0 2px;font-size:22px;letter-spacing:1px}.adv-menu p{margin:0 0 12px;color:#9fd8cc;font-size:13px}
.adv-planets{display:flex;flex-direction:column;gap:10px}
.adv-planet{position:relative;display:flex;align-items:center;gap:12px;min-height:76px;border-radius:18px;border:1.5px solid rgba(140,255,220,.35);padding:10px 14px;color:#fff;text-align:left;cursor:pointer;overflow:hidden}
.adv-planet.lock{opacity:.5;cursor:default}
.adv-orb{flex:0 0 52px;height:52px;border-radius:50%;box-shadow:inset -8px -8px 14px rgba(0,0,0,.5),0 0 22px var(--g)}
.adv-planet b{font-size:15px;display:block}.adv-planet small{color:#cfeee6;font-size:12px}
.adv-planet em{margin-left:auto;font-style:normal;font-size:11px;font-weight:800;padding:4px 9px;border-radius:12px;background:rgba(255,255,255,.14)}
.adv-gfx{display:flex;gap:6px;margin:10px 0 4px}.adv-gfx button{flex:1;min-height:44px;border-radius:14px;border:1.5px solid rgba(140,255,220,.4);background:transparent;color:#cfeee6;font-weight:800;font-size:13px;cursor:pointer}
.adv-gfx button.on{background:rgba(61,220,151,.3);border-color:#3ddc97;color:#fff}

.adv-quiz{position:absolute;inset:0;z-index:7;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,6,12,.72);backdrop-filter:blur(3px);padding:0}
.adv-qcard{width:100%;max-width:640px;max-height:96%;overflow-y:auto;background:linear-gradient(180deg,#0b2a35,#061821);border:1.5px solid rgba(140,255,220,.5);border-radius:22px 22px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:10px}
.adv-qhead{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:800;letter-spacing:.6px;color:#9dffd6}.adv-qhead i{font-style:normal;margin-left:auto;color:#ffe08a}
.adv-qq{font-size:16.5px;line-height:1.35;font-weight:700;color:#fff}
.adv-qopts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.adv-qopt{min-height:48px;border-radius:14px;border:1.5px solid rgba(140,255,220,.45);background:rgba(4,30,36,.7);color:#fff;font-weight:800;font-size:14.5px;cursor:pointer;padding:6px 10px}
.adv-qopt.ok{background:rgba(61,220,151,.4);border-color:#3ddc97}.adv-qopt.no{background:rgba(255,77,109,.35);border-color:#ff6b81}
.adv-qpiano{border-radius:12px;overflow:hidden}
.adv-qgo{min-height:48px;border-radius:24px;border:0;background:linear-gradient(180deg,#3ddc97,#1f9a66);color:#04201a;font-weight:900;font-size:15px;cursor:pointer}.adv-qgo:disabled{opacity:.4}
.adv-qres{border-radius:14px;padding:10px 12px;font-size:13.5px;line-height:1.4}.adv-qres.good{background:rgba(61,220,151,.22);color:#c9ffe9}.adv-qres.bad{background:rgba(255,160,90,.18);color:#ffe3c9}
.adv-qres b{display:block;margin-bottom:3px}
@media (prefers-reduced-motion:reduce){.adv-banner{animation:none;opacity:1}}
/* round pad buttons (owner, 2026-10-11) */
.adv .pvpdir,.adv .pvpact,.adv-pad .pvppad-r .pvpact.rocket{border-radius:50%!important;aspect-ratio:1/1}.adv .pvpdir{width:54px;height:54px}.adv .pvpact,.adv-pad .pvppad-r .pvpact.rocket{width:58px;height:58px}@media (max-width:600px){.adv .pvpdir{width:48px;height:48px}.adv .pvpact,.adv-pad .pvppad-r .pvpact.rocket{width:52px;height:52px}}
.adv .pvpact.ult i{max-width:48px}
.pvpgo,.pvpbig,.pvpghost,.pvpfriend,.pvptab,.pvpres-practice,.pvprpg-reset,.pvpsec-t,.adv-qopt,.adv-qgo,.adv-btn.go{border-radius:999px!important}
.pvptier,.pvpadv,.adv-planet,.adv-up{border-radius:34px!important}
.stgback,.adv-btn:not(.go){border-radius:50%!important}

/* pad layout (owner, 2026-10-11, drawn on screenshots; third drawing): ROCKET alone at the top right above PUNCH; then JUMP, PUNCH (DIG beside them on resource maps); then FIRE, KICK; the three skills (3, 2, 1) and the spell on the bottom row, all packed to the right */
.adv-pad .pvppad-r{grid-template-columns:repeat(5,auto);grid-template-rows:repeat(4,auto);justify-items:end}
.adv-pad .pvppad-r .pvpact.rocket{grid-row:1;grid-column:5!important}
.adv-pad .pvppad-r .pvpact.zap{grid-area:3/3}.adv .pvpact.zap{background:linear-gradient(135deg,#7fd4ff,#3a7bff);color:#fff}
.adv-pad .pvppad-r .pvpact.dig{grid-area:2/3}.adv-pad .pvppad-r .pvpact.jump{grid-area:2/4}.adv-pad .pvppad-r .pvpact.punch{grid-area:2/5}
.adv-pad .pvppad-r .pvpact.fire{grid-area:3/4}.adv-pad .pvppad-r .pvpact.kick{grid-area:3/5}
.adv-pad .pvppad-r .pvpact[data-slot="2"]{grid-area:4/2}.adv-pad .pvppad-r .pvpact[data-slot="1"]{grid-area:4/3}.adv-pad .pvppad-r .pvpact[data-slot="0"]{grid-area:4/4}.adv-pad .pvppad-r .pvpact.spell{grid-area:4/5}
`;

type Gfx = "standard" | "high";
function defaultGfx(): Gfx { try { const v = localStorage.getItem("tg_adv_gfx"); if (v === "standard" || v === "high") return v; } catch (e) {} return (isLowEnd() || spaceTier() <= 1) ? "standard" : "high"; }

const T3 = (lang, th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);

/** The page: a planet menu, then the run itself. */
export const AdventurePage = memo(function AdventurePage({ onReward = null, lang, me, colorway, held = null, hat = null, acc = null, petNow = null, onBack, playUi = null, online = false, adminTier = 0 }: any) {
  const [planet, setPlanet] = useState(null);
  // Adventure Online: a room of up to 4 pilots over a Realtime channel (adv-online.ts); the host picks the map for everybody
  const [net, setNet] = useState<Net | null>(null), netRef = useRef<Net | null>(null), [peersL, setPeersL] = useState<any[]>([]), [warOpt, setWarOpt] = useState(false), [nerr, setNerr] = useState(""), [joinCode, setJoinCode] = useState(""), [busy, setBusy] = useState(false);
  const [pname, setPname] = useState(() => { try { const g = JSON.parse(localStorage.getItem("tg_guest_profile") || "{}"); return (g && g.name) || "Pilot"; } catch (e) { return "Pilot"; } });
  useEffect(() => () => { if (netRef.current) netRef.current.leave(); }, []);
  // Public rooms (plan 33 O4): an optional advert for a room, and a list of other people's rooms to join. All calls fail soft.
  const [pubOpt, setPubOpt] = useState(false), [pubOn, setPubOn] = useState(false), [pubRooms, setPubRooms] = useState<PublicRoom[]>([]), pubCodeRef = useRef<string | null>(null);
  const refreshPub = () => { listPublicRooms().then(setPubRooms); };
  useEffect(() => { if (online && !net) refreshPub(); }, [online, !!net]);
  useEffect(() => { if (!pubOn || !net || !net.host) return; const id = setInterval(() => { publicRoomPing(net.code, 1 + peersL.length, "", warOpt); }, 30000); return () => clearInterval(id); }, [pubOn, net, peersL.length, warOpt]);
  useEffect(() => { publicRoomPing && pubOn && net && net.host && publicRoomPing(net.code, 1 + peersL.length, "", warOpt); }, [peersL.length, warOpt]);
  const closePub = () => { if (pubCodeRef.current) { publicRoomClose(pubCodeRef.current); pubCodeRef.current = null; } setPubOn(false); };
  useEffect(() => () => { if (pubCodeRef.current) publicRoomClose(pubCodeRef.current); }, []);
  const [gfx, setGfx] = useState<Gfx>(defaultGfx);
  useEffect(() => { try { localStorage.setItem("tg_adv_gfx", gfx); } catch (e) {} }, [gfx]);
  const [tick, setTick] = useState(0); void tick;
  useEffect(() => { warmAdvFigures(me, colorway, petNow); }, []);
  const ACT2 = ["kindred", "darkforge", "shadow"], SOLAR = ["moonhe3", "moonbase", "marscolony", "mercury", "venussky", "jupitergas", "saturnrings", "titanassault", "titancolony", "arkbuild", "arkfarm", "arkherd", "arkexodus"];
  const isSpace = (P: any) => ["dogfight", "launch", "belt", "skim", "harvest", "solar", "warp", "blackhole"].includes(P.mission);
  const [farmKey, setFarmKey] = useState(0);
  const [sector, setSector] = useState<"ground" | "space" | "act2" | "solar">(() => { try { const v = localStorage.getItem("tg_adv_sector"); return v === "space" ? "space" : v === "act2" ? "act2" : v === "solar" ? "solar" : "ground"; } catch (e) { return "ground"; } });
  const sectorOf = (P: any): "ground" | "space" | "act2" | "solar" => (SOLAR.includes(P.id) ? "solar" : ACT2.includes(P.id) ? "act2" : isSpace(P) ? "space" : "ground");
  const pickSector = (v: "ground" | "space" | "act2" | "solar") => { setSector(v); try { localStorage.setItem("tg_adv_sector", v); } catch (e) {} };
  const nocine = (() => { try { return localStorage.getItem("tg_adv_nocine") === "1"; } catch (e) { return false; } })();
  const done = readDone(); const crystals = readCrystals(); const ups = readUps(); const diff = readDiff(); const qs = readQuests(); const load = readLoad(); const ore = readOre(); const ostage = oreStage(ore);
  const [strike, setStrike] = useState<any>(null);
  const [shipDone, setShipDone] = useState<any>(null);
  // a music relay in the ship maps asks ONE question (the same cards as the ground beacons); the ship waits, a right answer repairs and shields it
  const shipCtl = useRef<any>({ paused: false, ask: null, answer: null }); const [shipQuiz, setShipQuiz] = useState<any>(null);
  shipCtl.current.ask = () => { const nq: any = nextSpell(lang, {}); setShipQuiz({ qs: [nq], i: 0, sel: [], res: null, right: 0, learned: nq.learned, spell: true }); };
  const shipAnswer = (ok: boolean) => { const cur = shipQuiz; if (!cur || cur.res) return; const q = cur.qs[cur.i].q; const l = recordAnswer(ok, q.topic); try { recordMemory(q.label, ok ? 100 : 55); } catch (e) {} if (ok) { try { addRpgExpX(me, 10 + 6 * q.tier + (l.streak >= 2 ? 6 : 0)); addSkillSp(classKeyOf(me), 2 + q.tier); bumpQuest("right", 1); } catch (e) {} } setShipQuiz({ ...cur, res: ok ? "good" : "bad", right: cur.right + (ok ? 1 : 0) }); };
  const shipFinish = () => { const cur = shipQuiz; setShipQuiz(null); if (shipCtl.current.answer) shipCtl.current.answer(!!cur && cur.right > 0); logUsage("adv", "shipq:" + (cur && cur.right > 0 ? "ok" : "miss")); };
  const [fin, setFin] = useState(false);   // the Act 2 epilogue: once, the first time the menu opens after Kindred Haven, the Dark Forge and the Harvesters' Eye are all cleared
  useEffect(() => { try { if (!planet && localStorage.getItem("tg_adv_finale") !== "1" && localStorage.getItem("tg_adv_nocine") !== "1" && ["kindred", "darkforge", "shadow"].every(id => readDone().includes(id))) setFin(true); } catch (e) {} }, [planet]);
  const [pro, setPro] = useState(() => { try { return localStorage.getItem("tg_adv_prologue") === null && localStorage.getItem("tg_adv_nocine") !== "1"; } catch (e) { return false; } });   // the opening film, once, before the first map menu
  const [rankOpen, setRankOpen] = useState(false);
  const [galaxyOpen, setGalaxyOpen] = useState(false);
  const [cined, setCined] = useState<string | null>(null);   // the id of the map whose film has been shown (or skipped) this time
  useEffect(() => { RUN_NAME = pname; RUN_T0 = planet && (nocine || cined === planet.id) ? Date.now() : 0; if (RUN_T0 > 0) { if (readEnergy() >= 50) { writeEnergy(readEnergy() - 50); ENERGY_BOOST = 1.25; } else ENERGY_BOOST = 1; } else ENERGY_BOOST = 1; }, [planet && planet.id, cined]);   // the clock for the best-times board starts when the map does, not when its film does
  const filming = (pro && !planet) || (fin && !planet) || (!!planet && cined !== planet.id && !nocine);
  useEffect(() => { if (filming) enterFs(); }, [filming]);   // every film is shown full screen in landscape (owner, 2026-10-11)
  const startPlanet = (P: any) => { playUi && playUi("click"); enterFs(); setStrike(null); setShipDone(null); setCined(null); setPlanet(P); };
  const canStart = (P: any) => (net ? net.host : open(P));   // in a room only the host chooses the map (guests join whatever map the host opens)
  const connect = async (code: string | null) => {
    setNerr(""); setBusy(true);
    try {
      const n = await openAdvRoom(code, { name: (pname || "Pilot").slice(0, 14), model: me, glow: colorway && colorway.glow ? colorway.glow : "#7fe8ff" });
      n.on({ onPeers: (l) => setPeersL(l), onStart: (id) => { const Q = PLANETS.find(z => z.id === id); if (Q) startPlanet(Q); } }); netRef.current = n; setNet(n);
      if (!code && pubOpt) { const okp = await publicRoomOpen(n.code, (pname || "Pilot").slice(0, 14), "", false); if (okp) { pubCodeRef.current = n.code; setPubOn(true); } }
    } catch (e) { setNerr(T3(lang, "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง", "Could not connect — try again", "连接失败，请重试")); }
    setBusy(false);
  };
  const leaveRoom = () => { closePub(); if (netRef.current) netRef.current.leave(); netRef.current = null; setNet(null); setPeersL([]); };
  const nextOf = (cur: any) => { const dn = readDone(); const idx = PLANETS.findIndex(q => q.id === cur.id); const rest = [...PLANETS.slice(idx + 1), ...PLANETS.slice(0, idx)].filter(Q => Q.ok && open(Q)); return rest.find(Q => !dn.includes(Q.id)) || rest[0] || null; };   // the next map you have not cleared yet, wrapping round   // the orbital-strike result (which bases are gone) before an Ashfall run
  // Maps are played one step at a time inside each sector: step n opens when step n-1 is cleared (owner, 2026-10-12).
  // A top-tier admin (tier 3) is never locked, so the game can be inspected; `tg_adv_unlockall` is the same switch for the test bots.
  const unlockAll = adminTier >= 3 || (() => { try { return localStorage.getItem("tg_adv_unlockall") === "1"; } catch (e) { return false; } })();
  const stepOf = (P) => PLANETS.filter(Q => sectorOf(Q) === sectorOf(P)).indexOf(P);
  const prevOf = (P) => { const L = PLANETS.filter(Q => sectorOf(Q) === sectorOf(P)); const i = L.indexOf(P); return i > 0 ? L[i - 1] : null; };
  const open = (P) => !!P.ok && (unlockAll || !prevOf(P) || readDone().includes(prevOf(P).id));
  const t = (th, en, zh) => T3(lang, th, en, zh);
  return (
    <div className="adv" role="region" aria-label="Adventure Mode">
      <style>{CSS}</style>
      {fin && !planet && !pro ? <Suspense fallback={<div className="adv-cine" />}><AdventureCine P={FINALE} lang={lang} me={me} colorway={colorway} onDone={() => { try { localStorage.setItem("tg_adv_finale", "1"); } catch (e) {} setFin(false); exitFsAndUnlock(); }} /></Suspense> : pro && !planet ? <Suspense fallback={<div className="adv-cine" />}><AdventureCine P={PROLOGUE} lang={lang} me={me} colorway={colorway} onDone={() => { try { localStorage.setItem("tg_adv_prologue", "1"); } catch (e) {} setPro(false); exitFsAndUnlock(); }} /></Suspense> : !planet ? (
        <div className="adv-menu">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="adv-btn" onClick={() => { playUi && playUi("click"); onBack(); }} aria-label="back">←</button>
            <h2 style={{ flex: 1 }}>🪐 Adventure Mode</h2>
          </div>
          <p style={{ fontSize: 12, opacity: .85 }}>{t("ส่งกลับโลกแล้ว " + ore + " ก้อนแร่ · อาณานิคม: " + ostage.th, "Shipped to Earth: " + ore + " ore · colony: " + ostage.en, "已运回地球 " + ore + " 矿 · 殖民地：" + ostage.zh)}</p>
          {readDyson() > 0 && <p style={{ fontSize: 12, opacity: .85 }}>{t("ไดสันสเฟียร์: ส่งพลังงานกลับโลกแล้ว " + readDyson() + " แผง ☀", "Dyson sphere: " + readDyson() + " panels beaming energy to Earth ☀", "戴森球：" + readDyson() + " 块板正向地球输送能量 ☀")}</p>}
          <p style={{ fontSize: 12, opacity: .85 }}>{t("ปี 2100 มนุษย์ออกหาทรัพยากรและพลังงานจากดาวต่างๆ และต้องสู้กับต่างดาว  ◆ คริสตัลพลังงานที่เก็บได้: " + crystals, "Year 2100: humanity heads out for resources and star energy, and fights the aliens. ◆ Energy crystals collected: " + crystals, "2100年，人类外出寻找资源与恒星能源，并与外星生物作战。  ◆ 已收集能量晶体：" + crystals)}</p>
          <p>{t("หุ่นยนต์และสัตว์เลี้ยงออกผจญภัยในดาวต่างดาว สู้มอนสเตอร์ เก็บ EXP เพิ่มเลเวลและสกิล (EXP เดียวกับ PvP)", "Take your robot and pet across alien planets, fight monsters and earn EXP for levels and skills (the same EXP as PvP).", "带着机器人和宠物探索外星球，打怪获得经验，升级并提升技能（与 PvP 共用经验）。")}</p>
          <div className="adv-sectors" role="tablist">
            {(["ground", "space", "act2", "solar"] as const).map(v => { const L = PLANETS.filter(P => sectorOf(P) === v); return (
              <button key={v} role="tab" aria-selected={sector === v} data-sector={v} className={"adv-sec" + (sector === v ? " on" : "")} onClick={() => pickSector(v)}>
                {v === "ground" ? t("ภาค 1 · บนพื้นผิวดาว", "Sector 1 · Surface", "第一区 · 星球表面") : v === "space" ? t("ภาค 2 · อวกาศ", "Sector 2 · Deep space", "第二区 · 深空") : v === "act2" ? t("ภาค 3 · ฮาร์เวสเตอร์", "Act 2 · The Harvesters", "第三区 · 收割者") : t("ภาค 4 · ระบบสุริยะ", "Sector 4 · Solar System", "第四区 · 太阳系")} <em>{L.filter(P => done.includes(P.id)).length}/{L.length}</em>
              </button>); })}
          </div>
          <div className="adv-rankbar"><span data-energy style={{ marginRight: 8, fontSize: 12 }}>⚡ {t("พลังงาน", "Energy", "能量")} {readEnergy()}/100{readEnergy() >= 50 ? " · +25%" : ""}</span><button className="adv-btn" data-galaxy-btn aria-expanded={galaxyOpen} style={{ marginRight: 8 }} onClick={() => setGalaxyOpen(o => !o)}>🌌 {t("แผนที่กาแล็กซี", "Galaxy map", "星系图")}</button><button className="adv-btn" data-rank-btn aria-expanded={rankOpen} onClick={() => setRankOpen(o => !o)}>🏆 {t("เวลาที่ดีที่สุด", "Best times", "最佳用时")}</button></div>
          {galaxyOpen && (<div className="adv-rank" data-galaxy>
            <svg viewBox="0 0 400 110" width="100%" role="img" aria-label="Galaxy map">
              {(["ground", "space", "act2", "solar"] as const).map((v, i) => { const L = PLANETS.filter(P => sectorOf(P) === v), n = L.filter(P => done.includes(P.id)).length, x = 50 + i * 100, R = 22, C = 2 * Math.PI * R, nx = L.find(P => !done.includes(P.id));
                return (<g key={v} data-gnode={v} style={{ cursor: "pointer" }} onClick={() => { pickSector(v); setGalaxyOpen(false); }}>
                  {i > 0 && <line x1={x - 100 + R + 4} y1="45" x2={x - R - 4} y2="45" stroke="rgba(140,255,220,.35)" strokeDasharray="3 4" />}
                  <circle cx={x} cy="45" r={R} fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.18)" strokeWidth="4" />
                  <circle cx={x} cy="45" r={R} fill="none" stroke={v === sector ? "#8cffdc" : "#7aa8ff"} strokeWidth="4" strokeDasharray={`${C * n / L.length} ${C}`} transform={`rotate(-90 ${x} 45)`} />
                  <text x={x} y="49" textAnchor="middle" fontSize="12" fill="currentColor">{n}/{L.length}</text>
                  <text x={x} y="85" textAnchor="middle" fontSize="10" fill="currentColor">{v === "ground" ? t("พื้นผิว", "Surface", "表面") : v === "space" ? t("อวกาศ", "Deep space", "深空") : v === "act2" ? t("ฮาร์เวสเตอร์", "Harvesters", "收割者") : t("สุริยะ", "Solar", "太阳系")}</text>
                  <text x={x} y="100" textAnchor="middle" fontSize="8.5" opacity=".7" fill="currentColor">{nx ? "→ " + String((t(nx.th, nx.en, nx.zh) || "")).split(/ · /)[0].slice(0, 16) : "✓"}</text>
                </g>); })}
            </svg>
          </div>)}
          {rankOpen && <RankPanel lang={lang} maps={PLANETS.filter(P => sectorOf(P) === sector)} />}
          <div className="adv-planets">
            {PLANETS.map((P, pi) => sectorOf(P) !== sector ? null : (
              <button key={P.id} className={"adv-planet" + (open(P) ? "" : " lock")} style={{ background: `linear-gradient(120deg,${P.c[0]},${P.c[1]})`, "--g": `rgba(${P.glow},.7)` } as any} disabled={!canStart(P)}
                onClick={() => { if (canStart(P)) { if (net) net.sendStart(P.id, warOpt); startPlanet(P); } }}>
                <span className="adv-orb" style={{ background: `radial-gradient(circle at 32% 28%,#fff6,${P.c[2]} 45%,${P.c[0]})` }} />
                <span><b>{T3(lang, P.th, P.en, P.zh)}</b><small>{open(P) ? t((P.survival ? "เก็บพลังงาน · " : P.mission === "mine" ? "ขุดแร่ · " : P.mission === "capture" ? "ยึดดาวฤกษ์ · " : P.mission === "strike" ? "ทิ้งนิวเคลียร์ · " : "แผนที่ ") + (stepOf(P) + 1) + (done.includes(P.id) ? " · ผ่านแล้ว ✓" : " · เล่นได้"), (P.survival ? "Harvest · " : "Map ") + (stepOf(P) + 1) + (done.includes(P.id) ? " · cleared ✓" : " · playable"), (P.survival ? "采集 · " : "地图 ") + (stepOf(P) + 1) + (done.includes(P.id) ? " · 已通关 ✓" : " · 可玩")) : P.ok ? (() => { const pv = prevOf(P), n = stepOf(P); return t("ต้องผ่านด่านที่ " + n + " ก่อน", "Clear step " + n + " first" + (pv ? " (" + pv.en.split(" · ")[0] + ")" : ""), "先通关第 " + n + "关"); })() : t("เร็ว ๆ นี้", "Coming soon", "敬请期待")}</small></span>
                <em>{open(P) ? "▶" : "🔒"}</em>
              </button>
            ))}
          </div>
          {online && (
            <div className="adv-lobby" aria-label="Adventure Online">
              <b>🌐 {t("Adventure ออนไลน์ — เล่นกับเพื่อน (สูงสุด " + MAX_PILOTS + " คน)", "Adventure Online — team up (up to " + MAX_PILOTS + " pilots)", "在线冒险 — 组队（最多 " + MAX_PILOTS + " 人）")}</b>
              {!net ? (<>
                <label>{t("ชื่อของคุณ", "Your name", "你的名字")} <input value={pname} maxLength={14} onChange={(e) => setPname(e.target.value)} /></label>
                <div className="al-row"><button className="adv-btn go" disabled={busy} onClick={() => connect(null)} data-create="1">＋ {t("สร้างห้อง", "Create a room", "创建房间")}</button>
                  <input className="al-code" placeholder="ABC123" value={joinCode} maxLength={6} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
                  <button className="adv-btn" disabled={busy || joinCode.length !== 6} onClick={() => connect(joinCode)} data-join="1">{t("เข้าห้อง", "Join", "加入")}</button></div>
                <label className="al-war"><input type="checkbox" data-pub="1" checked={pubOpt} onChange={e => setPubOpt(e.target.checked)} /> {t("เปิดเป็นห้องสาธารณะ (คนอื่นเห็นในรายการและเข้าได้เลย)", "List my room publicly (others can find and join it)", "公开房间（其他人可在列表中看到并加入）")}</label>
                {nerr && <small className="al-err">{nerr}</small>}
                <div className="al-pub" data-publist="1"><b>{t("ห้องสาธารณะ", "Public rooms", "公开房间")}</b> <button className="adv-btn" onClick={refreshPub} data-pubrefresh="1">↻</button>
                  {pubRooms.length === 0 ? <small>{t("ยังไม่มีห้องเปิดอยู่ — สร้างห้องของคุณเองได้เลย", "No open rooms right now — create your own.", "暂无开放房间——自己创建一个吧。")}</small> : pubRooms.map(r => (
                    <div className="al-row" key={r.code} data-pubrow={r.code}><span>{r.host_name} · {r.pilots}/{MAX_PILOTS}{r.war ? " · ⚔" : ""}</span><button className="adv-btn go" disabled={busy} onClick={() => connect(r.code)}>{t("เข้าห้อง", "Join", "加入")}</button></div>))}
                </div>
                <small>{t("ไม่ต้องตั้งค่าอะไร — แชร์รหัส 6 ตัวให้เพื่อนก็เข้าห้องได้", "Nothing to set up — share the 6-letter code with friends.", "无需设置——把 6 位代码分享给好友即可。")}</small>
              </>) : (<>
                <div className="al-room"><span>{t("รหัสห้อง", "ROOM", "房间")}</span><b data-room="1">{net.code}</b><button className="adv-btn" onClick={leaveRoom}>{t("ออกจากห้อง", "Leave", "离开")}</button></div>
                <div className="al-peers">{[{ id: "me", name: pname + " (" + t("คุณ", "you", "你") + ")", glow: colorway && colorway.glow }, ...peersL].map((q: any) => <span key={q.id} className="al-peer" style={{ borderColor: q.glow || "#7fe8ff" }}>{q.name}</span>)}</div>
                {net.host && <label className="al-war"><input type="checkbox" data-war="1" checked={warOpt} onChange={e => setWarOpt(e.target.checked)} /> {t("โหมดทีมสู้ทีม (แดง/ฟ้า ยิงต่อสู้กันเอง ไม่มีรางวัล)", "Team war (red vs blue pilots can hit each other, no rewards)", "团队对战（红蓝互相攻击，无奖励）")}</label>}
                <small>{net.host ? t("คุณเป็นเจ้าของห้อง — เลือกแผนที่ด้านล่างเพื่อเริ่มพร้อมกันทุกคน (ทุกคนดูหนังก่อนเริ่มด่านของตัวเอง)", "You host — pick a map below to start it for everyone (each pilot sees the film first).", "你是房主——在下方选择地图即可让所有人同时开始（每人先看自己的过场动画）。") : t("รอเจ้าของห้องเลือกแผนที่…", "Waiting for the host to pick a map…", "等待房主选择地图…")}</small>
              </>)}
            </div>)}
          <SkillBook me={me} petNow={petNow} lang={lang} crystals={crystals} playUi={playUi} onChange={() => setTick(x => x + 1)} />
          {sector === "solar" && (() => { const ar = readArk(), st = arkStats(ar); const nm: any = { g: ["วงแหวนแรงโน้มถ่วง", "Gravity ring", "重力环"], f: ["ชั้นปลูกพืช", "Farm decks", "农业层"], l: ["ชั้นเลี้ยงสัตว์", "Livestock decks", "牲畜层"], h: ["ที่อยู่อาศัย", "Habitat", "居住区"], s: ["เกราะและโล่", "Hull & shields", "船体与护盾"] };
            return (<div className="adv-shop" aria-label="Ark Bay" data-ark="1">
              <b>{t("อู่ Ark — ติดตั้งเรือโนอาแห่งอวกาศด้วยคริสตัล ◆ " + crystals, "Ark Bay — outfit the Ark with crystals ◆ " + crystals, "方舟坞 — 用晶体 ◆ " + crystals + " 装备方舟")}</b>
              {ARK_LINES.map(l => (<button key={l} className="adv-up" data-ark-line={l} disabled={ar[l] >= ARK_MAX || crystals < arkCost(ar[l])} onClick={() => { const r = buyArk(l, readCrystals()); if (r.ok) { spendCrystals(r.cost); playUi && playUi("click"); setTick(x => x + 1); } }}>
                <span>{T3(lang, nm[l][0], nm[l][1], nm[l][2])} · Lv {ar[l]}/{ARK_MAX}</span><em>{ar[l] >= ARK_MAX ? "MAX" : "◆ " + arkCost(ar[l])}</em></button>))}
              <small data-ark-stats="1">{t("แรงโน้มถ่วง ", "Gravity ", "重力 ")}{st.gravity} g · {t("ผู้โดยสารที่ถึงอย่างแข็งแรง ", "healthy passengers ", "健康乘客 ")}{st.people.toLocaleString()} · {t("อาหาร ", "food ", "食物 ")}{st.foodDays}/{ARK_TRIP_DAYS} {t("วัน", "days", "天")} {st.foodOk ? "✓" : "⚠"}</small>
            </div>); })()}
          <div className="adv-shop" aria-label="Workshop">
            <b>{t("โรงงาน — อัปเกรดด้วยคริสตัล ◆ " + crystals, "Workshop — upgrade with crystals ◆ " + crystals, "工坊 — 用晶体 ◆ " + crystals + " 升级")}</b>
            {UP_LINES.map(l => (
              <button key={l} className="adv-up" data-up={l} disabled={ups[l] >= UP_MAX || crystals < upCost(ups[l])} onClick={() => { if (buyUp(l)) { playUi && playUi("click"); setTick(x => x + 1); } }}>
                <span>{l === "atk" ? t("พลังโจมตี", "Attack", "攻击") : l === "hp" ? t("เลือด", "Health", "生命") : l === "rkt" ? t("จรวดยิงชุด/รีโหลดไว", "Rocket salvo & reload", "火箭齐射/装填") : l === "shp" ? t("เครื่องยนต์ยาน", "Starship engine", "飞船引擎") : t("สกิลเร็วขึ้น", "Skill speed", "技能速度")} · Lv {ups[l]}/{UP_MAX} (+{ups[l] * (l === "shp" ? 6 : 5)}%)</span>
                <em>{ups[l] >= UP_MAX ? "MAX" : "◆ " + upCost(ups[l])}</em>
              </button>
            ))}
          </div>
          <div className="adv-shop" aria-label="Loadout">
            <b>{t("อาวุธที่พกไป", "Loadout", "装备")}</b>
            {(["gun", "rocket"] as const).map(kind => (
              <div key={kind} className="adv-load">
                <small>{kind === "gun" ? t("ปืน / เลเซอร์", "Gun / laser", "枪 / 激光") : t("จรวด", "Rocket", "火箭")}</small>
                <div>{(kind === "gun" ? GUNS : ROCKETS).filter((w: any) => !w.drop || readFound().includes(w.id)).map(w => { const lock = w.req && !done.includes(w.req); const sel = load[kind] === w.id; return (
                  <button key={w.id} data-w={w.id} className={sel ? "on" : ""} disabled={!!lock} aria-pressed={sel} onClick={() => { saveLoad(kind, w.id); setTick(x => x + 1); }}>
                    {T3(lang, w.th, w.en, w.zh)}{lock ? " 🔒" : ""}</button>); })}</div>
              </div>
            ))}
          </div>
          <div className="adv-shop" aria-label="Daily quests">
            <b>{t("เควสต์วันนี้ (ได้ EXP)", "Today's quests (EXP)", "今日任务（经验）")}</b>
            {QUESTS.map(d => (
              <div key={d.id} className={"adv-q" + (qs.done[d.id] ? " ok" : "")} data-q={d.id}>
                <span>{d.id === "cry" ? t("เก็บคริสตัล ◆", "Collect crystals ◆", "收集晶体 ◆") : d.id === "right" ? t("ตอบคำถามถูก", "Answer questions right", "答对问题") : t("เอาชนะบอส", "Defeat a boss", "击败首领")} {Math.min(qs.p[d.id] || 0, d.need)}/{d.need}</span>
                <em>{qs.done[d.id] ? "✓" : "+" + d.exp + " EXP"}</em>
              </div>
            ))}
          </div>
          <div className="adv-gfx" role="radiogroup" aria-label="Difficulty">
            {DIFFS.map(d => (
              <button key={d.id} role="radio" aria-checked={diff.id === d.id} className={diff.id === d.id ? "on" : ""} onClick={() => { try { localStorage.setItem("tg_adv_diff", d.id); } catch (e) {} setTick(x => x + 1); }}>
                {d.id === "normal" ? t("ปกติ", "Normal", "普通") : d.id === "hard" ? t("ยาก ×1.4 รางวัล", "Hard ×1.4 rewards", "困难 ×1.4 奖励") : t("ฝันร้าย ×2 รางวัล", "Nightmare ×2 rewards", "噩梦 ×2 奖励")}
              </button>
            ))}
          </div>
          <div className="adv-gfx" role="radiogroup" aria-label="Graphics">
            {(["standard", "high"] as Gfx[]).map(g => (
              <button key={g} role="radio" aria-checked={gfx === g} className={gfx === g ? "on" : ""} onClick={() => setGfx(g)}>
                {g === "standard" ? t("กราฟิกมาตรฐาน (เครื่องทั่วไป)", "Standard graphics", "标准画质") : t("กราฟิกสูง (เครื่องแรง)", "High graphics", "高画质")}
              </button>
            ))}
          </div>
          <label className="adv-nocine"><input type="checkbox" checked={nocine} onChange={(e) => { try { localStorage.setItem("tg_adv_nocine", e.target.checked ? "1" : "0"); } catch (er) {} setTick(x => x + 1); }} /> {t("ข้ามหนังก่อนเริ่มด่าน", "Skip the film before each map", "跳过每张地图前的过场动画")}</label>
          <p style={{ fontSize: 11.5 }}>{t("ระบบเลือกให้ตามเครื่องของคุณ เปลี่ยนเองได้", "Chosen for your device; change it any time.", "已按设备自动选择，可随时更改。")}</p>
        </div>
      ) : (
        <AdvGuard mapId={planet.id} lang={lang} onBack={() => { setPlanet(null); setCined(null); setShipDone(null); }}>{
        cined !== planet.id && !nocine ? <Suspense fallback={<div className="adv-cine" />}><AdventureCine P={planet} lang={lang} me={me} colorway={colorway} onDone={() => setCined(planet.id)} /></Suspense> :
        ["dogfight", "launch", "belt", "skim", "harvest", "evade", "solar", "warp", "blackhole", "farm", "yard"].includes(planet.mission) && shipDone ? (
          <div className="adv-clear" role="dialog" aria-label="ship clear"><b>{t("ชนะแล้ว!", "VICTORY!", "胜利！")}</b>
            <span>☠ {shipDone.kills} · ◆ {shipDone.cry}{shipDone.mined ? " · ⛏ " + shipDone.mined : ""}{shipDone.mode === "skim" ? " · ⛽ 100%" : ""}{shipDone.mode === "harvest" ? " · ☀ 3/3" : ""}{shipDone.mode === "solar" ? " · 🔋 8/8" : ""}{shipDone.mode === "warp" ? " · 🌌 " + t("ข้ามกาแล็กซีแล้ว", "crossed over", "已跨越") : ""}{shipDone.farm ? " · 🌾 " + shipDone.farm.made + "/" + shipDone.farm.target + " · " + "★".repeat(shipDone.farm.stars) : ""}{shipDone.ark ? " · 👥 " + Math.round(shipDone.ark.people * (0.6 + 0.4 * shipDone.ark.hpFrac)).toLocaleString() + " " + t("คนถึงดาวดวงใหม่", "people reached the new star", "人抵达新恒星") + (shipDone.ark.foodOk ? " · 🌱 " + t("อาหารพอ", "food lasts", "食物充足") : " · ⚠ " + t("อาหารไม่พอ", "food runs short", "食物不足")) : ""}{shipDone.mode === "blackhole" ? " · ⚫ " + t("ข้ามจักรวาลแล้ว", "another universe", "已进入新宇宙") : ""}</span>
            {shipDone.coins > 0 && <small className="ac-coins">🪙 +{shipDone.coins} {t("ขายของที่เก็บได้แล้ว — ไปใช้ในร้านค้าได้", "loot sold — spend it in the shop", "战利品已出售——可在商店消费")}</small>}
            <div className="adv-clear-btns">
              {shipDone.next && <button className="adv-btn go" onClick={() => { KEEP_FS = true; enterFs(); setStrike(null); setCined(null); setShipDone(null); setPlanet(shipDone.next); }}>▶ {T3(lang, shipDone.next.th, shipDone.next.en, shipDone.next.zh).split(" · ")[0]}</button>}
              <button className="adv-btn" onClick={() => { setShipDone(null); setPlanet(null); }}>{t("เมนูแผนที่", "Map menu", "地图菜单")}</button></div>
          </div>
        ) : planet.mission === "yard" ? <Suspense fallback={<div className="adv-cine" />}><AdventureYard key={planet.id + farmKey} P={planet} lang={lang} onExit={() => { setPlanet(null); }}
          onWin={(res) => { const sale = settleShip(res, planet, onReward); try { addRpgExpX(me, Math.round(240 * (planet.hard || 1) * readDiff().rw)); } catch (e) {} const nx = nextOf(planet); setShipDone({ ...res, ...sale, next: nx }); }} /></Suspense>
        : planet.mission === "farm" ? <Suspense fallback={<div className="adv-cine" />}><AdventureFarm key={planet.id + farmKey} P={planet} lang={lang} onRetry={() => setFarmKey(k => k + 1)} onExit={() => { setPlanet(null); }}
          onWin={(res) => { const sale = settleShip(res, planet, onReward); try { addRpgExpX(me, Math.round(240 * (planet.hard || 1) * readDiff().rw)); } catch (e) {} const nx = nextOf(planet); setShipDone({ ...res, ...sale, next: nx }); }} /></Suspense> :
        ["dogfight", "launch", "belt", "skim", "harvest", "evade", "solar", "warp", "blackhole"].includes(planet.mission) ? <Suspense fallback={<div className="adv-cine" />}><AdventureShip key={planet.id} ctl={shipCtl} P={planet} lang={lang} ups={readUps()} glow={colorway && colorway.glow ? colorway.glow : "127,232,255"} onExit={() => { settleShip(null, planet, onReward); setPlanet(null); }}
          onWin={(res) => { const sale = settleShip(res, planet, onReward); try { const rpg = addRpgExpX(me, Math.round(260 * (planet.hard || 1) * readDiff().rw)); void rpg; } catch (e) {} const nx = nextOf(planet); setShipDone({ ...res, ...sale, next: nx }); }} /></Suspense> :
        planet.mission === "strike" && !strike ? <StrikePhase P={planet} lang={lang} playUi={playUi} onDone={(mask) => setStrike({ mask })} onBack={() => setPlanet(null)} /> :
        <Run key={planet.id} net={net} onReward={onReward} strikeMask={strike ? strike.mask : null} P={planet} gfx={gfx} lang={lang} me={me} colorway={colorway} held={held} hat={hat} acc={acc} petNow={petNow}
          getNext={() => (net ? null : nextOf(planet))} onNext={(Q) => { KEEP_FS = true; enterFs(); setStrike(null); setCined(null); setPlanet(Q); }} onExit={() => setPlanet(null)} playUi={playUi} onGfx={() => setGfx(g => (g === "high" ? "standard" : "high"))} />
        }</AdvGuard>
      )}
      {shipQuiz && <QuizGate key={gateKeyOf(shipQuiz)} quiz={shipQuiz} lang={lang} onKey={(pc, name) => {
        const cur = shipQuiz; if (cur.res) return; const q = cur.qs[cur.i].q;
        if (q.kind === "key") shipAnswer(judgeKeys(q, [pc]));
        else { const has = cur.sel.some((x) => x.pc === pc); setShipQuiz({ ...cur, sel: has ? cur.sel.filter((x) => x.pc !== pc) : [...cur.sel, { pc, name }] }); }
      }} onConfirm={() => { const cur = shipQuiz; const q = cur.qs[cur.i].q; shipAnswer(judgeKeys(q, cur.sel.map((x) => x.pc))); }}
        onChoice={(ok) => shipAnswer(ok)} onNext={shipFinish} onSkip={shipFinish} />}
    </div>
  );
});

/** Best times (plan 33 O5): your own best per map from this device, and the top ten from the board when the SQL is applied (fail-soft: an empty list otherwise) */
function RankPanel({ lang, maps }: any) {
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const [id, setId] = useState(maps[0] ? maps[0].id : ""), [rows, setRows] = useState<{ pilot: string; secs: number }[] | null>(null);
  useEffect(() => { let live = true; setRows(null); listAdvTop(id, 10).then(r => { if (live) setRows(r); }); return () => { live = false; }; }, [id]);
  const mine = readBest()[id], fmt = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  return (
    <div className="adv-rank" data-rank="1">
      <select value={id} onChange={(e) => setId(e.target.value)} aria-label="map">{maps.map((P: any) => <option key={P.id} value={id === P.id ? id : P.id}>{T3(lang, P.th, P.en, P.zh).split(" · ")[0]}</option>)}</select>
      <p>{mine ? t("เวลาดีที่สุดของคุณ ", "Your best ", "你的最佳 ") + fmt(mine) : t("ยังไม่เคยผ่านด่านนี้", "Not cleared yet", "尚未通关")}</p>
      {rows === null ? <small>…</small> : rows.length ? <ol>{rows.map((r, i) => <li key={i}><b>{i + 1}</b> {r.pilot} <span>{fmt(r.secs)}</span></li>)}</ol> : <small>{t("ยังไม่มีอันดับออนไลน์", "No online board yet", "暂无在线排行")}</small>}
    </div>
  );
}

/** The skill book (owner, 2026-10-11): ten skills for the robot's class and ten for the pet's element. Robot skill n opens at class rank n, pet skill n at pet level n;
    levels 1..5 cost crystals; up to three robot actives and two pet actives are equipped. */
function SkillBook({ me, petNow, lang, crystals, onChange, playUi }: any) {
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const cls = classKeyOf(me), rank = skillRank(readSkillSp()[cls] || 0).rank;
  const ptype: string = petNow ? ((petById(petNow.species) as any).type || "steel") : "", plv = petNow ? petLevel(petNow.bond).lv : 0;
  const [tab, setTab] = useState<"robot" | "pet">("robot");
  const kind = tab === "pet" && petNow ? "pet" : "robot", owner = kind === "pet" ? ptype : cls, have = kind === "pet" ? plv : rank, eq = readEquip()[kind];
  const eqNow = equippedOf(kind, owner, have).map(q => q.id);
  return (
    <details className="adv-book">
      <summary>{t("ตำราสกิล — สายอาชีพของหุ่นและสัตว์เลี้ยง", "Skill book — your robot's and pet's careers", "技能书 — 机器人与宠物的职业技能")}</summary>
      <div className="ab-tabs" role="tablist">
        <button className={kind === "robot" ? "on" : ""} onClick={() => setTab("robot")}>🤖 {T3(lang, (MODEL_CLASS as any)[cls].th, (MODEL_CLASS as any)[cls].en, (MODEL_CLASS as any)[cls].zh)} · R{rank}</button>
        <button className={kind === "pet" ? "on" : ""} disabled={!petNow} onClick={() => setTab("pet")}>🐾 {petNow ? ptype + " · Lv " + plv : t("ยังไม่มีสัตว์เลี้ยง", "no pet", "没有宠物")}</button>
      </div>
      <div className="ab-list">
        {treeOf(kind, owner).map((sk: Skill) => {
          const open = sk.idx <= have, lv = lvOf(sk.id), act = !isPassive(sk.a), on = eqNow.includes(sk.id), cost = skillCost(lv);
          return (
            <div key={sk.id} className={"ab-row" + (open ? "" : " lock") + (on ? " eq" : "")} data-skill={sk.id}>
              <b>{open ? "" : "🔒 "}{sk.idx}. {T3(lang, sk.n.th, sk.n.en, sk.n.zh)}</b>
              <em>{act ? t("ใช้งาน", "ACTIVE", "主动") : t("ติดตัว", "PASSIVE", "被动")} · Lv {lv}/{SKILL_MAX_LV}</em>
              <small>{open ? skillDesc(sk, lv, lang) : t((kind === "pet" ? "ปลดล็อกที่เลเวลสัตว์เลี้ยง " : "ปลดล็อกที่แรงก์ ") + sk.idx, (kind === "pet" ? "Unlocks at pet level " : "Unlocks at rank ") + sk.idx, (kind === "pet" ? "宠物等级 " : "阶级 ") + sk.idx + " 解锁")}</small>
              {open && <span className="ab-btns">
                <button data-up={sk.id} disabled={lv >= SKILL_MAX_LV || crystals < cost} onClick={() => { const r = buySkillLv(sk.id, crystals); if (r.ok) { spendCrystals(r.cost); playUi && playUi("click"); onChange(); } }}>{lv >= SKILL_MAX_LV ? "MAX" : "◆ " + cost}</button>
                {act && <button data-eq={sk.id} className={on ? "on" : ""} onClick={() => { toggleEquip(kind, sk.id); playUi && playUi("click"); onChange(); }}>{on ? t("ใส่อยู่", "EQUIPPED", "已装备") : t("ใส่", "EQUIP", "装备")}</button>}
              </span>}
            </div>);
        })}
      </div>
      <p style={{ fontSize: 11, opacity: .8 }}>{kind === "robot" ? t("ใส่ได้ 3 สกิลใช้งาน (ปุ่ม ✦1 ✦2 ✦3 / คีย์ K H G) สกิลติดตัวทำงานเสมอ", "Equip up to 3 actives (buttons ✦1 ✦2 ✦3 / keys K H G); passives are always on.", "最多装备 3 个主动技能（按钮 ✦1 ✦2 ✦3 / 键 K H G）；被动技能始终生效。") : t("สัตว์เลี้ยงใส่ได้ 2 สกิล ใช้เองอัตโนมัติเมื่อมีศัตรู", "A pet equips 2 actives and casts them by itself when foes are near.", "宠物最多装备 2 个主动技能，遇敌时自动施放。")}</p>
      <span style={{ display: "none" }}>{eq.length}</span>
    </details>
  );
}

/** Sell what the starship collected (clear = full price, leaving early = 40 %), with the same daily cap as a ground run. Returns what was paid. */
function settleShip(res: any, P: any, onReward: any) {
  const win = !!res, rate = win ? 1 : 0; void P;
  if (!win) return { coins: 0, capped: false };
  const RW = readDiff().rw; let value = 0; for (const k of Object.keys(res.loot || {})) value += (res.loot[k] || 0) * ((LOOT as any)[k] ? (LOOT as any)[k].v : 0);
  const want = Math.round(value * RW * rate), room = Math.max(0, ADV_COIN_DAY_CAP - readDayCoins()), coins = Math.min(want, room);
  if (res.mined) addOre(res.mined);
  if (res.cry) addCrystals(Math.round(res.cry * ENERGY_BOOST * (readDiff().id === "normal" ? 1 : readDiff().id === "hard" ? 2 : 3)));
  markDone(P.id);
  if (coins > 0) { addDayCoins(coins); if (onReward) { try { onReward(0, coins, { adventure: true }); } catch (e) {} } }
  try { ((window as any).__advRewardLog = (window as any).__advRewardLog || []).push({ coins, want, planet: P.id }); } catch (e) {}
  return { coins, capped: want > coins };
}

/** Ashfall's opening: an orbital strike. Six enemy bases lie under the orbit line; a reticle sweeps across and a tap drops one of three
    nuclear warheads where it is. A base inside the blast is gone, and the ground assault that follows has no defenders from it. */
function StrikePhase({ P, lang, playUi, onDone, onBack }: any) {
  const t = (th, en, zh) => T3(lang, th, en, zh);
  const [left, setLeft] = useState(3); const [bases, setBases] = useState<boolean[]>([true, true, true, true, true, true]); const [phase, setPhase] = useState("aim");
  const [boom, setBoom] = useState<any>(null); const [fall, setFall] = useState<number | null>(null);
  const retRef = useRef<HTMLDivElement>(null), xRef = useRef(0.1), lock = useRef<number | null>(null), basesRef = useRef(bases), leftRef = useRef(3);
  basesRef.current = bases; leftRef.current = left;
  const BX = (i: number) => 0.1 + i * 0.16;   // the six bases, as a fraction of the width
  useEffect(() => { let raf = 0; const t0 = performance.now(); const f = (now: number) => { raf = requestAnimationFrame(f); const x = lock.current !== null ? lock.current : 0.5 + 0.46 * Math.sin((now - t0) / 1000 * 1.5); xRef.current = x; if (retRef.current) retRef.current.style.left = x * 100 + "%"; }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, []);
  const drop = () => {
    if (phase !== "aim" || leftRef.current <= 0) return; const x = xRef.current; setPhase("drop"); setFall(x); setLeft(leftRef.current - 1); playUi && playUi("click");
    setTimeout(() => { const nb = basesRef.current.map((alive, i) => alive && Math.abs(BX(i) - x) > 0.085); setBases(nb); setBoom(x); setFall(null); playUi && playUi("reward");
      setTimeout(() => { setBoom(null); setPhase(leftRef.current <= 0 ? "done" : "aim"); }, 900); }, 800);
  };
  useEffect(() => { (window as any).__advStrike = { setX: (x: number) => { lock.current = x; xRef.current = x; }, drop, state: () => ({ left: leftRef.current, alive: basesRef.current.filter(Boolean).length, phase }), free: () => { lock.current = null; } }; return () => { try { delete (window as any).__advStrike; } catch (e) {} }; });
  const destroyed = bases.filter(b => !b).length;
  return (
    <div className="adv-strike" onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; drop(); }}>
      <div className="as-top"><button className="adv-btn" onClick={() => { playUi && playUi("click"); onBack(); }} aria-label="back">←</button>
        <div><b>☢ {t("ทิ้งนิวเคลียร์จากวงโคจร", "ORBITAL STRIKE", "轨道核打击")}</b><small>{t("แตะเพื่อปล่อยหัวรบ — ฐานที่อยู่ในรัศมีระเบิดจะหายไป และไม่ต้องสู้ในฐานนั้น", "Tap to release a warhead. A base inside the blast is gone and its defenders with it.", "点击投放弹头，爆炸范围内的基地及其守军将被消灭。")}</small></div>
        <span className="as-n">☢ × {left}</span></div>
      <div className="as-map">
        {bases.map((alive, i) => (<div key={i} className={"as-base" + (alive ? "" : " dead")} style={{ left: BX(i) * 100 + "%" }}><span>{alive ? "🏭" : "💥"}</span></div>))}
        <div ref={retRef} className="as-ret" />
        {fall !== null && <div className="as-fall" style={{ left: fall * 100 + "%" }}>☢️</div>}
        {boom !== null && <div className="as-boom" style={{ left: boom * 100 + "%" }} />}
      </div>
      <div className="as-bot">
        {phase === "done" || left === 0 ? (<><b>{t("ทำลายฐานได้ " + destroyed + "/6", "Bases destroyed: " + destroyed + "/6", "摧毁基地 " + destroyed + "/6")}</b><button className="adv-btn go" onClick={() => onDone(bases.map(b => !b))}>{t("ลงพื้นที่บุก ▶", "Drop in ▶", "降落突袭 ▶")}</button></>)
          : (<><button className="adv-btn go" disabled={phase !== "aim"} onClick={drop}>☢ {t("ปล่อยหัวรบ", "DROP WARHEAD", "投放弹头")}</button><button className="adv-btn" onClick={() => onDone(bases.map(b => !b))}>{t("ข้าม", "Skip", "跳过")}</button></>)}
      </div>
    </div>
  );
}

/** One run on one planet. The game state lives in refs and a canvas: React only draws the HUD (a few times a second). */
const Run = memo(function Run({ net = null, onReward = null, getNext = null, onNext = null, strikeMask = null, P, gfx, lang, me, colorway, held, hat, acc, petNow, onExit, playUi, onGfx }: any) {
  const high = gfx === "high"; const highRef = useRef(high); highRef.current = high;
  useEffect(() => { try { window.dispatchEvent(new Event("resize")); } catch (e) {} }, [gfx]);
  useEffect(() => () => { if (KEEP_FS) KEEP_FS = false; else exitFsAndUnlock(); }, []);   // back to the map or out of Adventure: normal screen, portrait again
  const cvRef = useRef<HTMLCanvasElement>(null);
  const pxRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLDivElement>(null);
  const heroSvgRef = useRef<SVGSVGElement>(null), heroImgRef = useRef<SVGImageElement>(null), wpnRef = useRef<HTMLDivElement>(null);
  const keys = useRef({ l: false, r: false, jump: false, atk: false, skl: false, dash: false, fire: false, kick: false, spell: false, rocket: false, zap: false });
  const [pose, setPoseState] = useState("ready");
  const poseAct = useRef({ name: "ready", n: 0 });   // what the hero is doing NOW (read by the draw loop, no React render)
  const setPose = (p: string) => { if (p !== "ready") poseAct.current.n++; poseAct.current.name = p; setPoseState(p); };
  const botKey = (po: string) => advBotKey(me, colorway, po);
  const petKeyOf = () => advPetKey(petNow);
  useEffect(() => { warmAdvFigures(me, colorway, petNow); }, []);
  const [fpv, flipFpv] = useFpv(); const fpvRef = useRef(fpv); fpvRef.current = fpv;   // first-person view (owner, 2026-10-12)
  const worldRef = useRef<HTMLDivElement>(null), fpvHandsRef = useRef<HTMLDivElement>(null), fpvRigRef = useRef<HTMLDivElement>(null), fpvWpnRef = useRef<HTMLDivElement>(null), fpvFlashRef = useRef<HTMLDivElement>(null), fpvXhRef = useRef<HTMLDivElement>(null), fpvHurtRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<any>({ hp: 1, hpMax: 1, lv: 1, xp: 0, xpNeed: 1, sk: 0, skNeed: 1, kills: 0, skCd: 0 });
  const [banner, setBanner] = useState<any>(null);
  const [down, setDown] = useState(false);
  const [clear, setClear] = useState<any>(null);   // the "map clear" card: go straight to the next map
  const [auto, setAuto] = useState(6);
  useEffect(() => { if (!clear || !clear.next) return undefined; if (auto <= 0) { if (onNext) onNext(clear.next); return undefined; } const id = setTimeout(() => setAuto(a => a - 1), 1000); return () => clearTimeout(id); }, [clear, auto]);
  const [quiz, setQuiz] = useState<any>(null);
  const quizOn = useRef(false);
  (window as any).__advQuiz = quiz;   // the smoke test reads the open question from here
  const beaconRef = useRef<any>(null);
  const castRef = useRef<any>(null), spellFire = useRef<any>(null), tapFire = useRef<any>(null);
  const musicRef = useRef<any>(null), sfxRef = useRef<any>(null);
  const musicOnRef = useRef(true);
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  musicOnRef.current = musicOn;
  useEffect(() => { if (sfxRef.current) sfxRef.current.setOn(musicOn); if (musicRef.current) musicRef.current.setOn(musicOn); try { localStorage.setItem("tg_adv_music", musicOn ? "1" : "0"); } catch (e) {} }, [musicOn]);
  useEffect(() => { if (musicRef.current) musicRef.current.duck(!!quiz); }, [quiz]);
  const cls = useMemo(() => classKeyOf(me), [me]);
  const chatRef = useRef<any>(null);
  const DIGBTN = P.mission === "mine" || P.mission === "dyson";   // the dig button shows on the resource maps
  const t = (th, en, zh) => T3(lang, th, en, zh);
  // a beacon asks three questions, gently harder: from what THIS learner has finished in the Pathway
  // owner, 2026-10-11: ONE question at a time, never more — a string of questions kills the fun. The three beacons climb a step each.
  beaconRef.current = (idx = 0, tap = false) => {
    const qs: any[] = []; const base = readLadder().lvl;
    qs.push(nextQuestion(lang, { level: Math.min(5, base + (idx === 2 ? 1 : 0)) }));
    setQuiz({ qs, i: 0, sel: [], res: null, right: 0, learned: qs[0].learned, tap });
  };
  // phase 3.4: the chord spell. The gauge fills as you hit things; when it is full, the spell button opens ONE question to answer on the piano.
  castRef.current = () => { const nq: any = nextSpell(lang, {}); setQuiz({ qs: [nq], i: 0, sel: [], res: null, right: 0, learned: nq.learned, spell: true }); };
  const finishQuiz = (q: any) => {
    setQuiz(null); quizOn.current = false;
    if (q && q.spell) { if (spellFire.current) spellFire.current(q.right > 0); if (q.right > 0) { const l = bumpQuest("right", 1); for (const d of l) addRpgExpX(me, d.exp); } logUsage("adv", "spell:" + P.id + ":" + (q.right > 0 ? "ok" : "miss")); return; }
    if (q && q.tap && tapFire.current) tapFire.current(q.right > 0);
    if (q && q.right > 0) { const l = bumpQuest("right", q.right); for (const d of l) { addRpgExpX(me, d.exp); } if (l.length) setBanner({ k: Date.now(), a: "QUEST ✓", b: "+" + l[0].exp + " EXP" }); }
    if (q) logUsage("adv", "quiz:" + P.id + ":" + q.right + "of" + (q.qs ? q.qs.length : 3));
    if (q && q.right > 0) setBanner({ k: Date.now(), a: t("ตอบถูก!", "CORRECT!", "答对了！"), b: t("ได้ EXP และแต้มสกิล", "EXP and skill points earned", "获得经验与技能点") });
  };
  const answerQuiz = (ok: boolean) => {
    const cur = quiz; if (!cur || cur.res) return; const q = cur.qs[cur.i].q;
    const l = recordAnswer(ok, q.topic);
    try { recordMemory(q.label, ok ? 100 : 55); } catch (e) {}
    if (ok) {
      const exp = 10 + 6 * q.tier + (l.streak >= 2 ? 6 : 0);
      try { const r = addRpgExpX(me, exp); addSkillSp(cls, 2 + q.tier); if (r && r.leveled) setBanner({ k: Date.now(), a: "LEVEL UP!", b: "Lv " + r.lv }); } catch (e) {}
    }
    setQuiz({ ...cur, res: ok ? "good" : "bad", right: cur.right + (ok ? 1 : 0) });
  };
  const nextQuiz = () => { const cur = quiz; if (!cur) return; if (cur.i >= cur.qs.length - 1) finishQuiz(cur); else setQuiz({ ...cur, i: cur.i + 1, sel: [], res: null }); };

  useEffect(() => {
    const HI = () => highRef.current;   // graphics can change from the gear pop-up while the run goes on, so nothing here captures `high` once
    const cv = cvRef.current; if (!cv) return undefined;
    const ctx = cv.getContext("2d", { alpha: false }); if (!ctx) return undefined;
    const dprCap = () => (HI() ? 2 : 1);
    let cw = 0, ch = 0, k = 1, dpr = 1, bake: any = null, camX = 0, vw = 0;
    const resize = () => {
      dpr = Math.min(dprCap(), window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect(); const w = Math.max(320, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cw = cv.width; ch = cv.height; k = ch / VH; vw = cw / k;
      bake = bakePlanet(P, cw, ch, k, HI());
    };
    // phase 3.0: where do players leave, how does it run on a real phone? one cheap row per event, no migration (usage_events kind "adv")
    // who is fighting decides how it sounds and how its attacks look (fx-voice.ts): per robot id + class, per pet element
    const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOnRef.current);
    const hashOf = (x: string) => String(x || "x").split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 17) >>> 0;
    const rid = hashOf(me), rGlow: string = ((MODEL_SKIN as any)[me] && (MODEL_SKIN as any)[me].glow) || "#7fe8ff";
    const BOLT_STYLE = (rid >>> 3) % 4, NOVA_STYLE = (rid >>> 5) % 5;
    const rv = voiceOf(me, cls);
    const petType: string = petNow ? ((petById(petNow.species) as any).type || "steel") : "steel", petCol: string = (PET_TYPES as any)[petType] ? (PET_TYPES as any)[petType].c : "#8fa6c8";
    const pv = petNow ? voiceOf("", "", { type: petType, species: petNow.species, mv: "spit" }) : null;
    const mus = createAdvMusic(P.id); musicRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); }
    { const bf = BRIEF[P.id]; if (bf) setTimeout(() => setBanner({ k: Date.now(), a: T3(lang, P.th, P.en, P.zh).split(" · ")[0], b: T3(lang, bf[0], bf[1], bf[2]) }), 500); }
    const t0 = performance.now(); let frames = 0, ended = false; logUsage("adv", "start:" + P.id + ":" + (HI() ? "hd" : "sd"));
    resize();
    const onResize = () => resize(); window.addEventListener("resize", onResize);

    /* ── the robot, from the same numbers PvP uses ── */
    const stat = () => { const info = rpgOf(me); return { info, mods: rpgMods(info.pts) }; };
    let { info, mods } = stat();
    const skillOf = () => skillRank(readSkillSp()[cls] || 0);
    const UPS = readUps(), DF = readDiff(), LOAD = readLoad();
    // skill careers: the passives of every unlocked robot skill (class rank) and pet skill (pet level), added up once per run
    const SR0 = skillRank(readSkillSp()[cls] || 0).rank, petType0: string = petNow ? ((petById(petNow.species) as any).type || "steel") : "steel", petLv0 = petNow ? petLevel(petNow.bond).lv : 0;
    const robotSk = treeOf("robot", cls).filter(q => q.idx <= SR0).map(q => ({ s: q, lv: lvOf(q.id) })), petSk = petNow ? treeOf("pet", petType0).filter(q => q.idx <= petLv0).map(q => ({ s: q, lv: lvOf(q.id) })) : [];
    const PASS = passiveSum([...robotSk, ...petSk]); XPM = 1 + PASS.xp;
    let netT = 0; const buff = { haste: 0 }; let shieldT = 0; const turrets: any[] = [], later: any[] = [];
    const slots = equippedOf("robot", cls, SR0).map(q => ({ s: q, lv: lvOf(q.id) })), slotCd = [0, 0, 0];
    const petSlots = petNow ? equippedOf("pet", petType0, petLv0).map(q => ({ s: q, lv: lvOf(q.id) })) : [], petCdA = [3, 5];
    const hpMaxOf = (lv) => Math.round((120 + lv * 11) * (1 + 0.05 * UPS.hp) * (1 + PASS.hp));
    TINT = P.tint || null;
    const HM = (P.hard || 1) * DF.hp, RW = DF.rw, CV = DF.id === "normal" ? 1 : DF.id === "hard" ? 2 : 3;   // reward multiplier, crystals per pickup
    const questDone = (list: any[]) => { for (const d of list) { addRpgExpX(me, d.exp); pop(pl.x, GROUND - pl.y - 130, "QUEST +" + d.exp + " EXP", "#ffd23f"); } };
    const gainCry = (n0: number) => { const n = Math.max(1, Math.round(n0 * (1 + PASS.loot) * ENERGY_BOOST)); crystals += n; addCrystals(n); questDone(bumpQuest("cry", n)); };
    const pl: any = { x: 160, y: 0, vy: 0, face: 1, hp: hpMaxOf(info.lv), atkCd: 0, sklCd: 0, hurtT: 0, inv: 0, dead: 0, ground: true, swing: 0, fireCd: 0, rockCd: 0, kickCd: 0, dashCd: 0, dashT: 0, combo: 0, comboT: 0, maxCombo: 0 };
    const teleGaps: number[] = [];
    const mk = (type, hx, i) => ({ type, hx, x: hx, y: 0, vy: 0, vx: 0, hp: Math.round(MON[type].hp * HM), max: Math.round(MON[type].hp * HM), face: -1, cd: 800, hurt: 0, ph: rnd(i) * 6, dead: 0, resp: 0, tele: 0, act: "", teleAt: 0, i });
    /* in a room the random waves (Jovia) gather round the TEAM, not round each pilot, so the ids they already share (1000 + wave * 10 + n) name monsters that stand in about the same place on every screen */
    const teamX = () => { if (!net || !net.peers) return pl.x; let sx = pl.x, n = 1; net.peers.forEach((q: any) => { if (typeof q.x === "number" && q.hp !== 0) { sx += q.x; n++; } }); return sx / n; };
    const mons: any[] = [];
    const pattern = P.mons || ["glowbug"], pool = pattern;
    const HZ: number[][] = P.hazard ? [[1000, 1230], [2000, 2260], [3150, 3450]] : [];   // lava pools / shock plates (Pyra, Nexa): jump them or take the burn
    let hzAcc = 0, hzHits = 0;
    const hzOn = () => (P.hazard === "shock" ? (time % 3) > 1.8 : true);
    let mi = 0;   // music intensity timer
    const loot: Record<string, number> = { scrap: 0, ore: 0, gold: 0, core: 0 }; let settled = false;
    const lootValue = () => Object.keys(loot).reduce((a, k) => a + loot[k] * LOOT[k].v, 0);
    const settle = (rate: number) => {   // sell what was collected: clear = full price, leaving early = 40 %
      if (settled) return { coins: 0, capped: false }; settled = true;
      const want = Math.round(lootValue() * RW * rate), room = Math.max(0, ADV_COIN_DAY_CAP - readDayCoins()), coins = Math.min(want, room);
      if (coins > 0) { addDayCoins(coins); if (onReward) { try { onReward(0, coins, { adventure: true }); } catch (e) {} } }
      try { ((window as any).__advRewardLog = (window as any).__advRewardLog || []).push({ coins, want, planet: P.id }); } catch (e) {}
      return { coins, capped: want > coins };
    };
    let warped = false;
    const showClear = (delay = 2000) => setTimeout(() => { if (ended || warped) return; const sale = settle(1); if (sfxRef.current) sfxRef.current.play("win"); for (let a = 0; a < (HI() ? 60 : 24); a++) addPart(pl.x + (Math.random() - 0.5) * 300, GROUND - 160 - Math.random() * 100, (Math.random() - 0.5) * 300, -Math.random() * 200, 1.3, ["255,210,80", "120,255,200", "255,120,200", "130,190,255"][a % 4], 3.5); const nx = getNext ? getNext() : null; setAuto(9); setClear({ next: nx, kills, cry: crystals, coins: sale.coins, capped: sale.capped }); }, delay);
    const surv = { t: 0, wave: 0, next: 2, done: false }, SURV_T = 90;   // gas-giant stage: hold out 90 s while the energy fills
    const MINE = P.mission === "mine", CAPM = P.mission === "capture", DYS = P.mission === "dyson", DIG = MINE || DYS, NOBOSS = !!P.survival || MINE || CAPM || DYS;
    // Ashfall: after the orbital strike, a base that was nuked has no defenders left (three monsters per base)
    for (let i = 0; i < (P.survival ? 0 : CAPM ? 6 : 17); i++) { if (strikeMask && strikeMask[Math.floor(i / 3) % 6]) continue; mons.push(mk(pattern[i % pattern.length], 520 + i * 270 + rnd(i) * 80, i)); }
    // mining: ore nodes to break open, a pad that launches the cargo to Earth. capture: three collector stations to hold.
    const nodes: any[] = MINE ? [650, 1400, 2100, 2800, 3500, 4200].map(x => ({ x, hp: 5, max: 5, done: false })) : DYS ? [500, 1250, 1850, 2500, 3100, 3700, 4300, 4800].map(x => ({ x, hp: 6, max: 6, done: false })) : [];
    const PARTS: [string, string, string] = ({ lunarbase: ["โมดูลที่พัก", "habitat modules", "居住舱 "], titancolony: ["โมดูลอาณานิคม", "colony modules", "殖民舱 "], arkbuild: ["ส่วนของยาน", "Ark sections", "方舟舱段 "] } as any)[P.id] || ["แผงไดสัน", "Dyson panels", "戴森板 "]; const dframes: any[] = DYS ? [1000, 2200, 3400, 4500].map(x => ({ x, built: false })) : []; const PANEL_ORE = 5; let flareT = 0, flareWarn = false;
    let cargo = 0; const CARGO_CAP = DYS ? 20 : 18, ORE_NEED = 10, PAD_X = WORLD - 220; let launched = 0, padHint = 0;
    const stations: any[] = CAPM ? [900, 2000, 3300].map(x => ({ x, p: 0, done: false })) : []; const CAP_T = 10; let capWave = 3;
    const digNodes = (power: number, reach = 120) => { for (const n of nodes) { if (n.done) continue; const dx = (n.x - pl.x) * pl.face; if (dx > -20 && dx < reach && pl.y < 60) { n.hp -= power; n.hit = 0.15; for (let a = 0; a < 6; a++) addPart(n.x, GROUND - 20, (Math.random() - 0.5) * 200, -Math.random() * 180, 0.5, "180,220,255", 2.5); sfx.play("hit");
        if (n.hp <= 0) { n.done = true; const g = Math.min(CARGO_CAP - cargo, 4); cargo += g; if (net && g) net.sendEv("ore", g); pop(n.x, GROUND - 70, g ? "+" + g + " ORE" : "CARGO FULL", g ? "#9fe8ff" : "#ffb070"); sfx.play("pickup"); } } } };
    const bolts: any[] = [], rockets: any[] = [], smoke: any[] = [], blasts: any[] = [], fires: any[] = [], arcs: any[] = [], parts: any[] = [], pops: any[] = [], shots: any[] = [], slashes: any[] = [], beams: any[] = [], drops: any[] = [], waves: any[] = [], pet: any[] = [];
    let crystals = readCrystals();
    const boss: any = { x: WORLD - 420, hp: Math.round(700 * HM), max: Math.round(700 * HM), face: -1, cd: 1.6, n: 0, state: "idle", tele: 0, dur: 0, hurt: 0, vx: 0, dead: NOBOSS ? 1 : 0, active: false };
    const ARENA = WORLD - 900;
    const TAPMAP = !!P.survival || CAPM;   // energy-harvest maps: the beacons are energy taps, a right answer feeds the harvest (owner, 2026-10-12)
    const beacons: any[] = (P.survival ? [1000, 2300, 3600] : [1300, 2650, 3950]).map(x => ({ x, used: false, tap: TAPMAP }));   // knowledge beacons: review questions from what the learner has studied
    const maxParts = HI() ? 140 : 26;
    const addPart = (x, y, vx, vy, life, col, sz) => { if (parts.length < maxParts) parts.push({ x, y, vx, vy, life, max: life, col, sz }); };
    const fireflies = Array.from({ length: HI() ? 46 : 12 }, (_, i) => ({ x: rnd(i + 200) * WORLD, y: 120 + rnd(i + 230) * 170, ph: rnd(i + 260) * 6 }));
    // team goal (online, owner 2026-10-11): every numbered kill counts for the whole room; reaching 10 per pilot pays each pilot crystals once
    // revive (online): a downed pilot waits 8 s; a teammate who stays within 90 px for 1.5 s stands them back up on the spot with half health
    const WAR = !!(net && net.war); const myTeam = net ? warTeamOf(net, net.id) : 0; const warScore = [0, 0]; let lastHitBy = "", warOver = false;
    // team war (plan 33 O3): each blow aimed at an enemy-team ghost is reported as ev `war:<victim id>`; the victim takes the damage itself
    const warHit = (range: number, mult: number) => { if (!WAR || !net) return; for (const q of net.peers.values()) { if (q.x === undefined || (q.hp !== undefined && q.hp <= 0) || warTeamOf(net, q.id) === myTeam) continue; const dx = (q.x - pl.x) * pl.face; if (dx > -20 && dx < range && Math.abs((q.y || 0) - pl.y) < 90) { const d = dmgOf(mult); net.sendEv("war:" + q.id, Math.min(60, d.v)); pop(q.x, GROUND - (q.y || 0) - 100, "-" + Math.min(60, d.v), "#ffd23f"); } } };
    const warBump = (team: number) => { warScore[team]++; if (warScore[team] >= 10 && !warOver) { warOver = true; setBanner({ k: Date.now(), a: team === myTeam ? T3(lang, "ทีมคุณชนะ!", "Your team wins!", "你的队伍获胜！") : T3(lang, "ทีมตรงข้ามชนะ", "The other team wins", "对方队伍获胜"), b: warScore[myTeam] + " – " + warScore[1 - myTeam] }); } };
    let revived = false; const reviveAcc: any = {};
    let teamDone = false; const teamGoal = () => 10 * ((net ? net.peers.size : 0) + 1);
    const teamCheck = () => { if (!net || WAR || teamDone || kills < teamGoal()) return; teamDone = true; const n = Math.min(12, 4 * (net.peers.size + 1)); gainCry(n); sfx.play("win"); setBanner({ k: Date.now(), a: T3(lang, "เป้าหมายทีมสำเร็จ!", "Team goal reached!", "团队目标达成！"), b: "◆ +" + n }); logUsage("adv", "team-goal:" + P.id + ":" + (net.peers.size + 1)); };
    let drawMs = 0, drawN = 0; let kills = 0, time = 0, last = performance.now(), acc = 0, raf = 0, shake = 0, hitStop = 0, hudT = 0, finished = false;
    let heroLastX = 0, heroDist = 0, fpvLastHp = 1e9;
    const step = HI() ? 1 / 60 : 1 / 30;

    const pop = (x, y, txt, col) => pops.push({ x, y, txt, col, life: 0.9 });
    const dmgOf = (mult = 1) => { const base = (9 + info.lv * 1.5) * mods.dmg * mult * (1 + 0.05 * UPS.atk) * (1 + PASS.atk); const crit = Math.random() < 0.08 + mods.crit + PASS.crit; return { v: Math.round(base * (0.9 + Math.random() * 0.2) * (crit ? 1.6 : 1)), crit }; };
    let spellG = 0;
    const hurtMon = (m, v, crit, kx, remote = false) => {
      spellG = Math.min(100, spellG + 5); if (net && !remote && m.i !== undefined) net.sendHit(m.i, v);
      sfx.play("hit"); if (PASS.steal > 0) pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + v * PASS.steal); m.hp -= v; m.hurt = 0.12; m.vx = kx; if (HI()) hitStop = 0.035; shake = Math.max(shake, crit ? 5 : 2);
      pop(m.x, GROUND - m.y - 60, String(v), crit ? "#ffd23f" : "#ffffff");
      for (let i = 0; i < (HI() ? 7 : 3); i++) addPart(m.x, GROUND - m.y - 20, (Math.random() - 0.5) * 220, -Math.random() * 160, 0.45, crit ? "255,210,60" : "255,255,255", 2.5);
      if (m.hp <= 0) {
        m.dead = 1; m.resp = 14; kills++; sfx.play("pop"); teamCheck();
        const d = MON[m.type];
        const gain = Math.round(d.exp * (P.hard || 1) * RW * (remote ? 0.5 : 1)); const rpg = addRpgExpX(me, gain); addSkillSp(cls, Math.max(1, Math.round(gain / 3)));
        pop(m.x, GROUND - 90, "+" + gain + " EXP", "#9dffd6");
        if (remote) { for (let i = 0; i < (HI() ? 14 : 5); i++) addPart(m.x, GROUND - m.y - 24, (Math.random() - 0.5) * 340, -Math.random() * 280, 0.8, i % 2 ? P.glow : P.acc, 3); info = rpgOf(me); return; }   // a teammate's kill: half the EXP, the loot is theirs
        if (Math.random() < 0.22) drops.push({ x: m.x, y: 20, vy: 160, t: "hp" });
        { const lt = rollLoot(d.exp); if (lt) drops.push({ x: m.x + (Math.random() - 0.5) * 44, y: 24, vy: 170 + Math.random() * 70, t: lt }); if (Math.random() < 0.25) { const l2 = rollLoot(d.exp); if (l2) drops.push({ x: m.x + (Math.random() - 0.5) * 60, y: 28, vy: 190, t: l2 }); } }
        if (Math.random() < 0.5) drops.push({ x: m.x + (Math.random() - 0.5) * 30, y: 20, vy: 200, t: "cry" });
        { const wid = rollWeapon(P.hard || 1, readFound(), false); if (wid) drops.push({ x: m.x, y: 34, vy: 240, t: "w:" + wid }); }   // a weapon, rarely
        for (let i = 0; i < (HI() ? 22 : 8); i++) addPart(m.x, GROUND - m.y - 24, (Math.random() - 0.5) * 340, -Math.random() * 280, 0.8, i % 2 ? P.glow : P.acc, 3);
        if (rpg && rpg.leveled) { const r2 = rpgOf(me); info = r2; mods = rpgMods(r2.pts); pl.hp = hpMaxOf(r2.lv); setBanner({ k: Date.now(), a: "LEVEL UP!", b: "Lv " + r2.lv + (r2.free > 0 ? " · " + t("มีแต้มสถานะ " + r2.free, r2.free + " stat points", r2.free + " 点属性") : "") }); playUi && playUi("reward"); }
        else info = rpgOf(me);
      }
    };
    // the pet fights too: every few seconds a bolt at the nearest enemy in range (a quarter of the robot's blow)
    let petCd = 2.5;
    const petBolt = () => {
      if (!petNow || pl.dead > 0) return;
      let best: any = null, bd = 340;
      for (const m of mons) { if (m.dead) continue; const d0 = Math.abs(m.x - pl.x); if (d0 < bd) { bd = d0; best = m; } }
      if (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < bd) { best = null; bd = 0; }
      sfx.play("pet", pv);
      const px0 = pl.x - pl.face * 56; const v = Math.max(1, Math.round(dmgOf().v * 0.28));
      if (best) { pet.push({ x: px0, y: 30, tx: best.x, ty: best.y + 20, life: 0.25, v, m: best, ty2: petType }); }
      else if (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < 340) pet.push({ x: px0, y: 30, tx: boss.x, ty: 60, life: 0.25, v, b: true, ty2: petType });
    };
    const hurtBoss = (v, crit, kx, remote = false) => {
      if (!boss.active || boss.dead) return; if (net && !remote) net.sendHit(-1, v);
      spellG = Math.min(100, spellG + 5);
      if (PASS.steal > 0) pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + v * PASS.steal); boss.hp -= v; boss.hurt = 0.1; boss.vx = kx * 0.3; if (HI()) hitStop = 0.03; shake = Math.max(shake, crit ? 5 : 2);
      pop(boss.x, GROUND - 140, String(v), crit ? "#ffd23f" : "#ffffff");
      for (let i = 0; i < (HI() ? 6 : 2); i++) addPart(boss.x, GROUND - 70, (Math.random() - 0.5) * 220, -Math.random() * 160, 0.45, "255,255,255", 2.5);
      if (boss.hp <= 0) {
        boss.dead = 1; boss.hp = 0; if (mus) mus.setBoss(false); shots.length = 0; waves.length = 0; kills++;
        const gain = Math.round(220 * (P.hard || 1) * RW); const rpg = addRpgExpX(me, gain); addSkillSp(cls, Math.round(gain / 3));
        for (let i = 0; i < 12; i++) drops.push({ x: boss.x + (i - 6) * 16, y: 40 + i * 6, vy: 220, t: "cry" });
        drops.push({ x: boss.x, y: 60, vy: 220, t: "hp" });
        { const wid = rollWeapon(P.hard || 1, readFound(), true); if (wid) drops.push({ x: boss.x - 50, y: 80, vy: 260, t: "w:" + wid }); }   // a boss always leaves a weapon
        for (const [lt, n] of [["gold", 4], ["core", 2], ["ore", 6]] as any[]) for (let i = 0; i < n; i++) drops.push({ x: boss.x + (Math.random() - 0.5) * 140, y: 50 + Math.random() * 40, vy: 220 + Math.random() * 80, t: lt });
        for (let i = 0; i < (HI() ? 50 : 16); i++) addPart(boss.x, GROUND - 70, (Math.random() - 0.5) * 520, -Math.random() * 380, 1, i % 2 ? P.glow : P.acc, 4);
        markDone(P.id); shake = 10; sfx.play("win"); showClear(2600); questDone(bumpQuest("boss", 1)); logUsage("adv", "boss-win:" + P.id + ":" + Math.round((performance.now() - t0) / 1000) + "s");
        info = rpgOf(me); if (rpg && rpg.leveled) { mods = rpgMods(info.pts); pl.hp = hpMaxOf(info.lv); }
        const nx = PLANETS[PLANETS.findIndex(q => q.id === P.id) + 1];
        setBanner({ k: Date.now(), a: t("เอาชนะบอสแล้ว! +" + gain + " EXP", "BOSS DOWN! +" + gain + " EXP", "击败首领！+" + gain + " 经验"), b: nx && nx.ok ? t("ปลดล็อก " + nx.en.split(" · ")[0] + " แล้ว", nx.en.split(" · ")[0] + " unlocked", "已解锁 " + nx.en.split(" · ")[0]) : t("ประตูวาร์ปเปิดแล้ว", "The warp gate is open", "传送门已开启") });
        playUi && playUi("reward");
      }
    };
    const attack = () => {
      if (pl.dead || pl.atkCd > 0) return;
      warHit(120, 1); pl.combo = pl.comboT > 0 ? pl.combo + 1 : 1; const finisher = pl.combo >= 3; pl.maxCombo = Math.max(pl.maxCombo, pl.combo); pl.comboT = 0.75; if (finisher) pl.combo = 0;
      sfx.play("punch", rv); if (MINE) digNodes(1);
      pl.atkCd = (finisher ? 0.6 : 0.34) * mods.cdMul; pl.swing = 0.18; setPose("attack"); setTimeout(() => setPose("ready"), 170);
      slashes.push({ col: rGlow, x: pl.x + pl.face * 34, y: pl.y + 44, face: pl.face, life: finisher ? 0.26 : 0.18, max: finisher ? 0.26 : 0.18 });
      if (finisher) { shake = Math.max(shake, 5); pop(pl.x, GROUND - pl.y - 120, "×3!", "#ffd23f"); }
      for (const m of mons) {
        if (m.dead) continue; const dx = (m.x - pl.x) * pl.face;
        if (dx > -10 && dx < 92 + MON[m.type].w / 2 && Math.abs(m.y - pl.y) < 70) { const d = dmgOf(finisher ? 1.7 : 1); hurtMon(m, d.v, d.crit || finisher, pl.face * (finisher ? 330 : 160)); }
      }
      { const dx = (boss.x - pl.x) * pl.face; if (boss.active && !boss.dead && dx > -10 && dx < 150 && pl.y < 90) { const d = dmgOf(finisher ? 1.7 : 1); hurtBoss(d.v, d.crit || finisher, pl.face * (finisher ? 330 : 160)); } }
    };
    if (net) {   // teammates: their hits land on the same numbered monsters here; their ore and panels show as a feed
      net.on({ onHit: (i: number, v: number) => { if (i < 0) hurtBoss(v, false, 0, true); else { const mm = mons.find(z => z.i === i); if (mm && !mm.dead) hurtMon(mm, v, false, 0, true); } },
        onEv: (q: any, k: string, n: number) => { if (k === "war:" + net.id) { if (q) lastHitBy = q.id; hurtPlayer(n, q && q.x !== undefined ? q.x : pl.x); return; } if (String(k).startsWith("wdown:")) { warBump(n); return; } if (k === "revive:" + net.id) { if (pl.dead > 0) { pl.dead = 0.01; revived = true; pop(pl.x, GROUND - 130, q ? q.name + " ✚" : "✚", "#8dffb0"); } return; } if (String(k).startsWith("revive:")) return; if (q) pop(q.x !== undefined ? q.x : pl.x, GROUND - 130, q.name + (k === "ore" ? " ⛏+" + n : k === "panel" ? " ⚙ panel" : " " + k), "#9fe8ff"); } });
      chatRef.current = (tx: string) => { net.sendChat(tx); pop(pl.x, GROUND - pl.y - 140, tx, "#ffffff"); };
    }
    const skill = () => {
      const sr = skillOf();
      if (pl.dead || pl.sklCd > 0) return;
      sfx.play("skill", rv);
      pl.sklCd = 4.5 * (1 - 0.05 * UPS.skl) / (1 + 0.04 * (sr.rank - 1)); pl.swing = 0.3; setPose("kick"); setTimeout(() => setPose("ready"), 260);
      shake = Math.max(shake, HI() ? 7 : 3);
      for (let a = 0; a < (HI() ? 28 : 10); a++) { const ang = (a / (HI() ? 28 : 10)) * Math.PI * 2; addPart(pl.x, GROUND - pl.y - 40, Math.cos(ang) * 320, Math.sin(ang) * 220, 0.5, "123,97,255", 3.5); }
      slashes.push({ x: pl.x, y: pl.y + 40, face: 0, life: 0.3, nova: true, st: NOVA_STYLE, col: rGlow });
      for (const m of mons) {
        if (m.dead) continue;
        if (Math.abs(m.x - pl.x) < (cls === "herald" ? 250 : 190) && Math.abs(m.y - pl.y) < 110) { const base = (9 + info.lv * 1.5) * mods.dmg * 3.2 * (1 + 0.08 * (sr.rank - 1)) * mods.spell; hurtMon(m, Math.round(base), true, Math.sign(m.x - pl.x) * 260); }
      }
      { const rr = cls === "herald" ? 250 : 190; if (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < rr + 40 && pl.y < 120) hurtBoss(Math.round((9 + info.lv * 1.5) * mods.dmg * 3.2 * (1 + 0.08 * (sr.rank - 1)) * mods.spell), true, Math.sign(boss.x - pl.x) * 260); }
      // what the skill does besides damage depends on the robot's class
      if (cls === "engineer") { pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * 0.12); pop(pl.x, GROUND - pl.y - 110, "+HP", "#8dffb0"); }
      else if (cls === "ghost") pl.inv = Math.max(pl.inv, 1.2);
    };
    // ── skill careers (owner, 2026-10-11): any skill of any class or pet goes through castSkill; the archetype decides what it does,
    //    the id decides how it looks and sounds ──
    const castSlot = (i: number) => { const q = slots[i]; if (!q || pl.dead || slotCd[i] > 0) return; slotCd[i] = cdAt(q.s, q.lv) * (1 - 0.05 * UPS.skl); castSkill(q.s, q.lv, false); };
    const castSkill = (s: Skill, lv: number, fromPet = false) => {
      const look = skillLook(s), snd = skillSound(s), p = powerAt(s, lv), n = Math.round(s.r), face = pl.face, rgb = hslRgb(look.hue), hue = `hsl(${look.hue},90%,66%)`;
      const ox = fromPet ? pl.x - face * 56 : pl.x, oy = fromPet ? 30 : pl.y + 40, base = (9 + info.lv * 1.5) * mods.dmg * (1 + 0.05 * UPS.atk) * (1 + PASS.atk) * mods.spell * (fromPet ? 0.8 : 1);
      sfx.play("cast", fromPet ? pv : rv, { a: s.a, pitch: snd.pitch, wave: snd.wave, bright: snd.bright });
      if (!fromPet) { pl.swing = 0.25; setPose("kick"); setTimeout(() => setPose("ready"), 220); }
      shake = Math.max(shake, HI() ? 5 : 2); pop(ox, GROUND - oy - 110, T3(lang, s.n.th, s.n.en, s.n.zh), hue);
      const cnt = look.n * (HI() ? 2 : 1);   // the look: one of five particle patterns, in the skill's own colour
      for (let a = 0; a < cnt; a++) { const ang = a / cnt * 6.283 * (look.spin || 1);
        if (look.style === 0) addPart(ox, GROUND - oy, Math.cos(ang) * 300, Math.sin(ang) * 220, 0.55, rgb, 3.5);
        else if (look.style === 1) addPart(ox + (Math.random() - 0.5) * 40, GROUND - oy, (Math.random() - 0.5) * 60, -180 - Math.random() * 220, 0.7, rgb, 3);
        else if (look.style === 2) addPart(ox, GROUND - oy, Math.cos(ang * 2) * 200 * (a / cnt + 0.3), Math.sin(ang * 2) * 160 * (a / cnt + 0.3), 0.8, rgb, 3);
        else if (look.style === 3) addPart(ox + (a - cnt / 2) * 16, GROUND - oy - 120 - Math.random() * 40, (Math.random() - 0.5) * 40, 160 + Math.random() * 120, 0.7, rgb, 3);
        else addPart(ox, GROUND - oy + (Math.random() - 0.5) * 50, face * (200 + Math.random() * 300), (Math.random() - 0.5) * 40, 0.5, rgb, 3); }
      slashes.push({ x: ox, y: oy, face, life: 0.35, max: 0.35, nova: true, st: look.style, col: hue });
      const foes = (rng: number) => mons.filter(m => !m.dead && Math.abs(m.x - ox) < rng && Math.abs(m.y - pl.y) < 140);
      const hitBoss = (mult: number, rng: number) => { if (boss.active && !boss.dead && Math.abs(boss.x - ox) < rng + 40) hurtBoss(Math.round(base * mult), true, Math.sign(boss.x - ox) * 200); };
      switch (s.a) {
        case "volley": for (let k = 0; k < n; k++) bolts.push({ x: ox + face * 30, y: oy + 6, vx: face * (520 + k * 20), vy: (k - (n - 1) / 2) * 70, life: 0.7, v: Math.round(base * p), crit: false }); break;
        case "nova": for (const m of foes(s.r)) hurtMon(m, Math.round(base * p), true, Math.sign(m.x - ox) * 260); hitBoss(p, s.r); break;
        case "dash": { const x0 = pl.x; pl.x = Math.max(boss.active && !boss.dead ? ARENA : 40, Math.min(WORLD - 60, pl.x + face * s.r)); pl.inv = Math.max(pl.inv, 0.45); const lo = Math.min(x0, pl.x) - 30, hi = Math.max(x0, pl.x) + 30; for (const m of mons) if (!m.dead && m.x > lo && m.x < hi && Math.abs(m.y - pl.y) < 90) hurtMon(m, Math.round(base * p), true, face * 240); if (boss.active && !boss.dead && boss.x > lo && boss.x < hi) hurtBoss(Math.round(base * p), true, face * 160); for (let a = 0; a < 14; a++) addPart(x0 + (pl.x - x0) * a / 14, GROUND - pl.y - 40, 0, -20, 0.4, rgb, 3); break; }
        case "shield": shieldT = Math.max(shieldT, p); pl.inv = Math.max(pl.inv, p); break;
        case "heal": pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * p); pop(pl.x, GROUND - pl.y - 130, "+HP", "#8dffb0"); break;
        case "haste": buff.haste = Math.max(buff.haste, p); break;
        case "slow": case "stun": for (const m of foes(s.r)) { m.slowT = p; m.slowF = s.a === "stun" ? 0 : 0.4; } break;
        case "chain": { let from = ox, used = new Set<any>(), k = 0; const pts: number[][] = [[ox, GROUND - oy]]; while (k < n) { let best: any = null, bd = 420; for (const m of mons) { if (m.dead || used.has(m)) continue; const dd = Math.abs(m.x - from); if (dd < bd) { bd = dd; best = m; } } if (!best) break; used.add(best); hurtMon(best, Math.round(base * p), true, 0); pts.push([best.x, GROUND - best.y - 30]); from = best.x; k++; } if (!k && boss.active && !boss.dead && Math.abs(boss.x - ox) < 460) { hurtBoss(Math.round(base * p), true, 0); pts.push([boss.x, GROUND - 70]); } arcs.push({ pts, life: 0.22 }); break; }
        case "drain": { let c = 0; for (const m of foes(s.r)) { hurtMon(m, Math.round(base * p), false, 0); c++; } hitBoss(p, s.r); pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * Math.min(0.2, 0.05 * (c + 1))); break; }
        case "meteor": { const tg = mons.filter(m => !m.dead && Math.abs(m.x - ox) < 520).sort((a, b) => Math.abs(a.x - ox) - Math.abs(b.x - ox)).slice(0, n).map(m => m.x); if (boss.active && !boss.dead && Math.abs(boss.x - ox) < 520) tg.push(boss.x); while (tg.length < n) tg.push(ox + face * (160 + tg.length * 90)); tg.slice(0, n).forEach((x, i) => { for (let a = 0; a < 8; a++) addPart(x, GROUND - 300 + a * 36, 0, 260, 0.45, rgb, 3); later.push({ t: 0.45 + i * 0.12, fn: () => explode(x, 10, 95, p * (fromPet ? 0.8 : 1), rgb) }); }); break; }
        case "turret": turrets.push({ x: pl.x + face * 46, face, t: p, cd: 0.2, mult: s.r * (1 + 0.15 * (lv - 1)) * (fromPet ? 0.8 : 1) }); break;
        case "execute": { let best: any = null; for (const m of foes(s.r)) if (!best || m.hp / m.max < best.hp / best.max) best = m; if (best) { const low = best.hp / best.max < 0.4; hurtMon(best, Math.round(base * p * (low ? 2 : 1)), true, face * 120); slashes.push({ x: best.x, y: best.y + 40, face, life: 0.25, max: 0.25, col: hue }); } else if (boss.active && !boss.dead && Math.abs(boss.x - ox) < s.r) hurtBoss(Math.round(base * p * (boss.hp / boss.max < 0.4 ? 2 : 1)), true, 0); break; }
        default: break;
      }
    };
    // shoot: a bolt flies ahead and hits the first enemy; kick: a short wide sweep that knocks back hard
    let firedN = 0, rocketN = 0;
    const nearestFoe = (x: number, face: number, range: number) => { let best: any = null, bd = range; for (const m of mons) { if (m.dead) continue; const dx = (m.x - x) * face; if (dx > -20 && Math.abs(m.x - x) < bd) { bd = Math.abs(m.x - x); best = m; } } return best; };
    /* a weapon picked up from the ground: equipped now and kept (it shows in the Loadout from then on) */
    const equipWeapon = (id: string) => {
      const isR = ROCKETS.some((x: any) => x.id === id), def: any = (isR ? ROCKETS : GUNS).find((x: any) => x.id === id); if (!def) return;
      if (isR) LOAD.rocket = id; else LOAD.gun = id; addFound(id); saveLoad(isR ? "rocket" : "gun", id); sfx.play("win"); shake = Math.max(shake, 4);
      pop(pl.x, GROUND - pl.y - 120, t("อาวุธใหม่: ", "NEW WEAPON: ", "新武器：") + T3(lang, def.th, def.en, def.zh), "#ffe27a"); for (let a = 0; a < (HI() ? 26 : 10); a++) addPart(pl.x, GROUND - pl.y - 40, (Math.random() - 0.5) * 420, -Math.random() * 360, 0.9, a % 2 ? "255,226,120" : "255,255,255", 3);
    };
    /* instant beams (laser rifle, railgun, big beam): damage along the line now, the beam itself is drawn for a moment */
    const hitscan = (ox: number, oy: number, range: number, mult: number, pierce: boolean, w: number, col: string) => {
      let endX = ox + pl.face * range; const hits: any[] = [];
      for (const m of mons) { if (m.dead) continue; const dx = (m.x - ox) * pl.face; if (dx > -20 && dx < range && Math.abs(m.y + 20 - oy) < 52) hits.push([dx, m]); }
      hits.sort((a, b) => a[0] - b[0]); const list = pierce ? hits : hits.slice(0, 1);
      for (const [, m] of list) { const d = dmgOf(mult); hurtMon(m, d.v, d.crit, pl.face * 120); blasts.push({ x: m.x, y: m.y + 26, r: 30 + w, life: 0.16, max: 0.16, flash: true }); }
      if (!pierce && list.length) endX = list[0][1].x;
      const bdx = (boss.x - ox) * pl.face; if (boss.active && !boss.dead && bdx > -20 && bdx < range && oy < 150 && (pierce || !list.length)) { const d = dmgOf(mult); hurtBoss(d.v, d.crit, 0); blasts.push({ x: boss.x, y: 70, r: 40 + w, life: 0.18, max: 0.18, flash: true }); if (!pierce) endX = boss.x - pl.face * 40; }
      beams.push({ x1: ox, y1: GROUND - oy, x2: endX, y2: GROUND - oy, life: pierce ? 0.24 : 0.1, max: pierce ? 0.24 : 0.1, w, col });
      blasts.push({ x: ox + pl.face * 16, y: oy, r: 20 + w, life: 0.1, max: 0.1, flash: true }); warHit(Math.abs(endX - ox) + 20, mult);
    };
    const fireBolt = () => {
      if (pl.dead || pl.fireCd > 0) return;
      sfx.play("fire", rv); firedN++; warHit(520, 0.8);
      pl.swing = 0.12; setPose("attack"); setTimeout(() => setPose("ready"), 140);
      const ox = pl.x + pl.face * 30, oy = pl.y + 46, g = LOAD.gun;
      if (g === "minigun") {
        pl.fireCd = 0.07 * mods.cdMul; const d = dmgOf(0.28); bolts.push({ x: ox, y: oy + (Math.random() - 0.5) * 8, vx: pl.face * 680, vy: (Math.random() - 0.5) * 70, life: 0.55, v: d.v, crit: d.crit });
        blasts.push({ x: ox + pl.face * 14, y: oy, r: 18, life: 0.07, max: 0.07, flash: true }); addPart(ox, GROUND - oy + 6, -pl.face * (30 + Math.random() * 50), -60 - Math.random() * 60, 0.5, "255,220,120", 2); shake = Math.max(shake, 1.2);
      } else if (g === "shotgun") {
        pl.fireCd = 0.62 * mods.cdMul; for (let k2 = 0; k2 < 7; k2++) { const d = dmgOf(0.4); bolts.push({ x: ox, y: oy, vx: pl.face * (470 + Math.random() * 90), vy: (k2 - 3) * 36 + (Math.random() - 0.5) * 22, life: 0.3, v: d.v, crit: d.crit }); }
        blasts.push({ x: ox + pl.face * 22, y: oy, r: 46, life: 0.12, max: 0.12, flash: true }); shake = Math.max(shake, 4); for (let a = 0; a < 6; a++) addPart(ox + pl.face * 20, GROUND - oy, pl.face * (120 + Math.random() * 200), (Math.random() - 0.5) * 160, 0.3, "255,200,90", 2.5);
      } else if (g === "laserrifle") {
        pl.fireCd = 0.2 * mods.cdMul; hitscan(ox, oy, 760, 0.9, false, 5, "255,70,100");
      } else if (g === "railgun") {
        pl.fireCd = 1.0 * mods.cdMul; hitscan(ox, oy, 1000, 2.4, true, 9, "140,200,255"); shake = Math.max(shake, 5);
      } else if (g === "bigbeam") {
        pl.fireCd = 1.6 * mods.cdMul; hitscan(ox, oy, 900, 3.0, true, 30, "255,120,225"); shake = Math.max(shake, 8);
      } else if (g === "sword") {
        pl.fireCd = 0.36 * mods.cdMul; pl.swing = 0.3; sfx.play("kick", rv);
        slashes.push({ x: pl.x + pl.face * 70, y: pl.y + 50, face: pl.face, life: 0.22, max: 0.22, col: "#8affc8" });
        for (const m of mons) { if (m.dead) continue; const dx = (m.x - pl.x) * pl.face; if (dx > -14 && dx < 190 + MON[m.type].w / 2 && Math.abs(m.y - pl.y) < 90) { const d = dmgOf(1.7); hurtMon(m, d.v, d.crit, pl.face * 220); } }
        { const dx = (boss.x - pl.x) * pl.face; if (boss.active && !boss.dead && dx > -14 && dx < 230 && pl.y < 100) { const d = dmgOf(1.7); hurtBoss(d.v, d.crit, pl.face * 160); } }
      } else if (g === "scatter") {
        pl.fireCd = 0.34 * mods.cdMul;
        for (let k2 = -1; k2 <= 1; k2++) { const d = dmgOf(0.42); bolts.push({ x: ox, y: oy, vx: pl.face * 470, vy: k2 * 70, life: 0.45, v: d.v, crit: d.crit }); }
      } else if (g === "lance") {
        pl.fireCd = 0.42 * mods.cdMul; const d = dmgOf(0.7); bolts.push({ x: ox, y: oy, vx: pl.face * 950, life: 0.5, v: d.v, crit: d.crit, pierce: true, hit: new Set() });
      } else if (g === "arc") {
        pl.fireCd = 0.5 * mods.cdMul; let from: any = { x: ox }, n = 0; const used = new Set();
        const pts: number[][] = [[ox, GROUND - oy]];
        while (n < 3) { let best: any = null, bd = 380; for (const m of mons) { if (m.dead || used.has(m)) continue; const dd = Math.abs(m.x - from.x); if (dd < bd && (n > 0 || (m.x - ox) * pl.face > -20)) { bd = dd; best = m; } } if (!best) break; used.add(best); const d = dmgOf(0.7); hurtMon(best, d.v, d.crit, pl.face * 60); pts.push([best.x, GROUND - best.y - 30]); from = best; n++; }
        if (!n && boss.active && !boss.dead && Math.abs(boss.x - ox) < 420) { const d = dmgOf(0.7); hurtBoss(d.v, d.crit, 0); pts.push([boss.x, GROUND - 70]); }
        if (pts.length < 2) pts.push([ox + pl.face * 260, GROUND - oy]);
        arcs.push({ pts, life: 0.16 });
      } else {
        pl.fireCd = 0.22 * mods.cdMul;   // held = rapid fire (owner, 2026-10-11)
        const d = dmgOf(0.8); bolts.push({ x: ox, y: oy, vx: pl.face * 520, life: 0.9, v: d.v, crit: d.crit });
      }
    };
    /* rockets (owner, 2026-10-11): homing steers to the nearest enemy; cluster bursts into bomblets; napalm leaves a burning patch */
    const explode = (x: number, y: number, r: number, mult: number, col: string) => {
      sfx.play("boom"); shake = Math.max(shake, HI() ? 6 : 3);
      for (const m of mons) { if (m.dead) continue; if (Math.abs(m.x - x) < r + MON[m.type].w / 2 && Math.abs(m.y - y) < r + 20) { const d = dmgOf(mult); hurtMon(m, d.v, true, Math.sign(m.x - x) * 220); } }
      if (boss.active && !boss.dead && Math.abs(boss.x - x) < r + 60) { const d = dmgOf(mult); hurtBoss(d.v, true, 0); }
      for (let a = 0; a < (HI() ? 22 : 8); a++) addPart(x, GROUND - y, (Math.random() - 0.5) * 360, -Math.random() * 300, 0.6, a % 2 ? col : "255,230,160", 3.5);
      slashes.push({ x, y, face: 0, life: 0.3, max: 0.3, nova: true, st: 0, col: "#ffb060" });
      blasts.push({ x, y, r: r * 1.5, life: 0.45, max: 0.45 });
      blasts.push({ x, y, r: r * 0.9, life: 0.2, max: 0.2, flash: true });   // white-hot core
      if (r >= 90) { blasts.push({ x, y, r: r * 2.2, life: 0.6, max: 0.6 }); for (let q = 0; q < (HI() ? 16 : 7); q++) addPart(x, GROUND - y, (Math.random() - 0.5) * 640, -Math.random() * 540, 1, q % 3 ? "255,150,60" : "255,240,180", 3.2); shake = Math.max(shake, Math.min(14, 3 + r / 30)); }
      for (let q = 0; q < (HI() ? 9 : 4); q++) smoke.push({ x: x + (Math.random() - 0.5) * r, y: y + Math.random() * r * 0.6, vx: (Math.random() - 0.5) * 60, vy: 30 + Math.random() * 50, life: 0.9 + Math.random() * 0.5, max: 1.3, r: 10 + Math.random() * 14 });
    };
    const fireRocket = () => {
      if (pl.dead || pl.rockCd > 0) return;
      const k3 = LOAD.rocket, salvo = k3 === "nuke" || k3 === "big" || k3 === "rpg" ? 1 : 2 + (UPS.rkt >= 2 ? 1 : 0) + (UPS.rkt >= 4 ? 1 : 0);   // owner 2026-10-11: several missiles every press, rapid, short reload
      pl.rockCd = ({ mini: 0.16, big: 1.1, nuke: 3, homing: 0.26, cluster: 0.4, napalm: 0.45, rpg: 0.7, frag: 0.5 } as any)[k3] || 0.3; pl.rockCd *= mods.cdMul * (1 - 0.06 * UPS.rkt); rocketN += salvo; sfx.play("rocket", rv); pl.swing = 0.2; setPose("kick"); setTimeout(() => setPose("ready"), 200);
      const ox = pl.x + pl.face * 28, oy = pl.y + 52;
      shake = Math.max(shake, HI() ? 5 : 3); blasts.push({ x: ox, y: oy, r: 58, life: 0.2, max: 0.2, flash: true }); for (let a = 0; a < (HI() ? 12 : 5); a++) addPart(ox, GROUND - oy, pl.face * (150 + Math.random() * 320), (Math.random() - 0.5) * 140, 0.35, "255,210,120", 2.5);   // muzzle flash and a spray of sparks
      for (let a = 0; a < (HI() ? 14 : 6); a++) { smoke.push({ x: ox - pl.face * 10, y: oy + (Math.random() - 0.5) * 12, vx: -pl.face * (60 + Math.random() * 120), vy: (Math.random() - 0.3) * 40, life: 0.6 + Math.random() * 0.3, max: 0.9, r: 4 + Math.random() * 5 }); }   // backblast
      const SC: any = { mini: 0.62, big: 1.5, nuke: 2.3 };
      for (let q = 0; q < salvo; q++) {   // a salvo fans out a little so the missiles do not sit on each other
        const fan = (q - (salvo - 1) / 2), sc = SC[k3] || 1;
        if (k3 === "homing" || k3 === "mini") rockets.push({ k: k3, sc, x: ox, y: oy + fan * 10, vx: pl.face * (k3 === "mini" ? 420 : 300), vy: 40 + fan * 90, life: 2.6 });
        else if (k3 === "big" || k3 === "nuke") rockets.push({ k: k3, sc, x: ox, y: oy, vx: pl.face * (k3 === "nuke" ? 230 : 300), vy: k3 === "nuke" ? 60 : 90, life: 3.2, g: k3 === "nuke" ? 60 : 120 });
        else if (k3 === "rpg") rockets.push({ k: "rpg", sc: 1.05, x: ox, y: oy, vx: pl.face * 640, vy: 0, life: 1.6, g: 0 });
        else if (k3 === "frag") rockets.push({ k: "frag", sc: 0.5, x: ox, y: oy, vx: pl.face * 330, vy: 280, life: 1.4, g: 760 });
        else rockets.push({ k: k3, sc, x: ox, y: oy + fan * 10, vx: pl.face * 380, vy: 210 + fan * 80, life: 2.4, g: 520 });
      }
      if (k3 === "nuke") { shake = Math.max(shake, HI() ? 9 : 5); }
    };
    // lightning button (owner, 2026-10-11): a bolt of lightning that jumps between up to 4 foes, rapid when held
    let zapN = 0;
    const zapBolt = () => {
      if (pl.dead || (pl.zapCd || 0) > 0) return;
      pl.zapCd = 0.24 * mods.cdMul; zapN++; warHit(460, 0.75); sfx.play("zap", rv); shake = Math.max(shake, 3); pl.swing = 0.12; setPose("attack"); setTimeout(() => setPose("ready"), 140);
      const ox = pl.x + pl.face * 30, oy = pl.y + 46; let from: any = { x: ox }, n = 0; const used = new Set<any>(); const pts: number[][] = [[ox, GROUND - oy]];
      while (n < 4) { let best: any = null, bd = 460; for (const m of mons) { if (m.dead || used.has(m)) continue; const dd = Math.abs(m.x - from.x); if (dd < bd && (n > 0 || (m.x - ox) * pl.face > -20)) { bd = dd; best = m; } } if (!best) break; used.add(best); const d = dmgOf(0.75); hurtMon(best, d.v, d.crit, pl.face * 50); pts.push([best.x, GROUND - best.y - 30]); blasts.push({ x: best.x, y: best.y + 30, r: 40, life: 0.16, max: 0.16, flash: true }); for (let a = 0; a < (HI() ? 10 : 4); a++) addPart(best.x, GROUND - best.y - 30, (Math.random() - 0.5) * 300, -Math.random() * 220, 0.35, "190,225,255", 2.5); from = best; n++; }
      if (!n && boss.active && !boss.dead && Math.abs(boss.x - ox) < 460) { const d = dmgOf(0.75); hurtBoss(d.v, d.crit, 0); pts.push([boss.x, GROUND - 70]); }
      if (pts.length < 2) pts.push([ox + pl.face * 300, GROUND - oy - (Math.random() - 0.5) * 40]);
      arcs.push({ pts, life: 0.24 }); blasts.push({ x: ox, y: oy, r: 30, life: 0.14, max: 0.14, flash: true });
      for (let i = 1; i < pts.length; i++) { arcs.push({ pts: [[pts[i][0] + (Math.random() - 0.5) * 50, pts[i][1] - 700], [pts[i][0], pts[i][1]]], life: 0.32 }); blasts.push({ x: pts[i][0], y: GROUND - pts[i][1], r: 120, life: 0.24, max: 0.24, flash: true }); for (let a = 0; a < (HI() ? 10 : 4); a++) addPart(pts[i][0], pts[i][1], (Math.random() - 0.5) * 360, -Math.random() * 320, 0.5, "170,215,255", 2.5); shake = Math.max(shake, 6); }   // a strike from the sky on every foe it reaches
      for (let a = 0; a < (HI() ? 8 : 3); a++) addPart(ox, GROUND - oy, pl.face * (80 + Math.random() * 160), (Math.random() - 0.5) * 120, 0.25, "170,220,255", 2.5);
    };
    const kickMove = () => {
      if (pl.dead || pl.kickCd > 0) return;
      sfx.play("kick", rv); if (MINE) digNodes(2); warHit(130, 1.2);
      pl.kickCd = 0.8 * mods.cdMul; pl.swing = 0.2; setPose("kick"); setTimeout(() => setPose("ready"), 200);
      slashes.push({ x: pl.x + pl.face * 40, y: pl.y + 30, face: pl.face, life: 0.2, max: 0.2 });
      for (const m of mons) { if (m.dead) continue; const dx = (m.x - pl.x) * pl.face; if (dx > -10 && dx < 118 + MON[m.type].w / 2 && Math.abs(m.y - pl.y) < 70) { const d = dmgOf(1.2); hurtMon(m, d.v, d.crit, pl.face * 300); } }
      { const dx = (boss.x - pl.x) * pl.face; if (boss.active && !boss.dead && dx > -10 && dx < 170 && pl.y < 90) { const d = dmgOf(1.2); hurtBoss(d.v, d.crit, pl.face * 240); } }
    };
    // the dig button (owner, 2026-10-11): swing the pickaxe at ore rocks; beside a Dyson frame it bolts a panel on instead
    const digMove = () => {
      if (pl.dead || (pl.digCd || 0) > 0 || !DIG) return; pl.digCd = 0.38;
      if (DYS) { const f = dframes.find(q => !q.built && Math.abs(q.x - pl.x) < 120);
        if (f) { if (cargo >= PANEL_ORE) { cargo -= PANEL_ORE; f.built = true; if (net) net.sendEv("panel", 1); const bn = dframes.filter(q => q.built).length; sfx.play("win"); shake = Math.max(shake, 5); for (let a = 0; a < (HI() ? 40 : 14); a++) addPart(f.x, GROUND - 120, (Math.random() - 0.5) * 360, -Math.random() * 260, 0.8, a % 2 ? "255,210,110" : "120,220,255", 3.5); pop(f.x, GROUND - 140, t(PARTS[0] + " " + bn + "/4", PARTS[1].toUpperCase() + " " + bn + "/4", PARTS[2] + bn + "/4"), "#ffd23f"); logUsage("adv", "dyson-panel:" + P.id + ":" + bn); if (bn >= 4) setBanner({ k: Date.now(), a: t("ไดสันสเฟียร์เสร็จแล้ว!", "DYSON SPHERE COMPLETE!", "戴森球完成！"), b: t("ไปที่เสาส่งขวาสุดเพื่อส่งพลังงานกลับโลก", "Go to the far-right relay to beam the energy home", "前往最右中继塔把能量传回地球") }); return; }
          pop(f.x, GROUND - 130, t("ต้องมีแร่ " + PANEL_ORE + " ก้อน (มี " + cargo + ")", "Need " + PANEL_ORE + " ore (have " + cargo + ")", "需要 " + PANEL_ORE + " 矿（现有 " + cargo + "）"), "#ffd0a0"); } }
      sfx.play("kick", rv); pl.swing = 0.22; setPose("attack"); setTimeout(() => setPose("ready"), 200); for (let a = 0; a < 5; a++) addPart(pl.x + pl.face * 70, GROUND - 24, pl.face * (60 + Math.random() * 140), -80 - Math.random() * 120, 0.4, "255,230,170", 2.5); digNodes(3, 160);
    };
    tapFire.current = (ok: boolean) => {
      if (!ok) { pop(pl.x, GROUND - 120, t("ยังไม่ได้พลังงาน — ลองจุดถัดไป", "No energy this time — try the next tap", "这次没有能量——试试下一个"), "#ffb070"); return; }
      sfx.play("win"); shake = Math.max(shake, 4);
      if (P.survival) { surv.t = Math.min(SURV_T - 1, surv.t + SURV_T * 0.2); pop(pl.x, GROUND - 120, t("⚡ พลังงาน +20%", "⚡ ENERGY +20%", "⚡ 能量 +20%"), "#ffe08a"); }
      else if (CAPM) { const cur = stations.find(q => !q.done); if (cur) { cur.p = Math.min(CAP_T - 0.5, cur.p + 4); } pop(pl.x, GROUND - 120, t("⚡ ชาร์จสถานี +4 วินาที", "⚡ STATION +4 s", "⚡ 站点 +4 秒"), "#ffe08a"); }
    };
    spellFire.current = (ok: boolean) => {
      if (!ok) { spellG = 50; pop(pl.x, GROUND - pl.y - 130, "♪ " + t("ลองใหม่", "again", "再来"), "#ffd0a0"); return; }
      const sr = skillOf(); shake = Math.max(shake, HI() ? 10 : 5); playUi && playUi("reward"); sfx.play("spell", rv);
      const base = (9 + info.lv * 1.5) * mods.dmg * 4.5 * (1 + 0.05 * UPS.atk) * (1 + 0.08 * (sr.rank - 1)) * mods.spell;
      for (let a = 0; a < (HI() ? 40 : 14); a++) { const ang = (a / (HI() ? 40 : 14)) * Math.PI * 2; addPart(pl.x, GROUND - pl.y - 40, Math.cos(ang) * 420, Math.sin(ang) * 300, 0.7, a % 2 ? "255,230,140" : P.acc, 3.5); }
      slashes.push({ x: pl.x, y: pl.y + 40, face: 0, life: 0.45, max: 0.45, nova: true, st: NOVA_STYLE, col: rGlow, big: true });
      for (const m of mons) if (!m.dead && Math.abs(m.x - pl.x) < 360) hurtMon(m, Math.round(base), true, Math.sign(m.x - pl.x) * 320);
      if (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < 400) hurtBoss(Math.round(base), true, Math.sign(boss.x - pl.x) * 200);
      pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * 0.25); pl.inv = Math.max(pl.inv, 0.8);
      pop(pl.x, GROUND - pl.y - 130, t("เวทย์คอร์ด!", "CHORD SPELL!", "和弦术！"), "#ffe08a");
      spellG = 0;
    };
    const hurtPlayer = (v, from) => {
      if (pl.inv > 0 || pl.dead) return;
      v = Math.max(1, Math.round(v * (1 - PASS.guard)));
      sfx.play("hurt");
      pl.hp -= v; pl.inv = 0.7; pl.vy = 0; pl.x += Math.sign(pl.x - from) * 26; shake = Math.max(shake, 4);
      pop(pl.x, GROUND - pl.y - 100, "-" + v, "#ff6b81");
      for (let i = 0; i < (HI() ? 8 : 3); i++) addPart(pl.x, GROUND - pl.y - 50, (Math.random() - 0.5) * 200, -Math.random() * 150, 0.4, "255,90,110", 2.5);
      if (pl.hp <= 0) { pl.hp = 0; pl.dead = net ? 8 : 2.2; setDown(true); if (WAR && net) { const at = lastHitBy ? warTeamOf(net, lastHitBy) : 1 - myTeam; net.sendEv("wdown:" + lastHitBy, at); warBump(at); } logUsage("adv", "die:" + P.id + ":x" + Math.round(pl.x / 100) * 100 + (boss.active && !boss.dead ? ":boss" : "")); }
    };

    const sim = (dt) => {
      if (quizOn.current || pausedRef.current) return;
      time += dt;
      if (net && pl.dead <= 0) for (const q of net.peers.values()) { if (q.hp === undefined || q.hp > 0 || q.x === undefined || (WAR && net && warTeamOf(net, q.id) !== myTeam)) { reviveAcc[q.id] = 0; continue; } if (Math.abs(q.x - pl.x) < 90) { reviveAcc[q.id] = (reviveAcc[q.id] || 0) + dt; if (reviveAcc[q.id] >= 1.5) { reviveAcc[q.id] = 0; net.sendEv("revive:" + q.id, 1); q.hp = 1; pop(q.x, GROUND - 130, "✚ " + q.name, "#8dffb0"); sfx.play("win"); } } else reviveAcc[q.id] = 0; }
      if (net) { netT += dt; if (netT > 0.12) { netT = 0; net.sendPos(Math.round(pl.x), Math.round(pl.y), pl.face, Math.round(pl.hp)); } }
      const kk = keys.current;
      if (pl.dead > 0) { pl.dead -= dt; if (pl.dead <= 0) { if (P.survival && !surv.done) { surv.t = 0; surv.wave = 0; surv.next = 2; mons.length = 0; shots.length = 0; } pl.dead = 0; if (revived) { revived = false; pl.hp = hpMaxOf(info.lv) / 2; pl.inv = 2; } else { pl.hp = hpMaxOf(info.lv); pl.x = 160; pl.y = 0; pl.inv = 1.5; camX = 0; } setDown(false); } }
      else {
        let dx = 0; if (kk.l) dx -= 1; if (kk.r) dx += 1;
        pl.holdT = dx ? (pl.holdT || 0) + dt : 0;   // held for 0.35 s = a sprint (owner, 2026-10-11)
        const sprint = pl.holdT > 0.35; const sp = 150 * mods.walk * (1 + PASS.speed) * (buff.haste > 0 ? 1.45 : 1) * (sprint ? 1.7 : 1);
        if (sprint && pl.ground && Math.random() < 0.5) addPart(pl.x - dx * 14, GROUND - 4, -dx * 40, -20 - Math.random() * 30, 0.3, "200,230,255", 2);
        pl.x = Math.max(boss.active && !boss.dead ? ARENA : 40, Math.min(WORLD - 60, pl.x + dx * sp * dt)); if (dx) pl.face = dx;
        if (!boss.active && !boss.dead && pl.x > ARENA + 60) { boss.active = true; if (mus) mus.setBoss(true); logUsage("adv", "boss-wake:" + P.id); setBanner({ k: Date.now(), a: T3(lang, P.boss[0], P.boss[1], P.boss[2]), b: t("บอสท้ายด่าน — ประตูด้านหลังปิดแล้ว", "End-of-map boss — the way back is shut", "本图首领——退路已封闭") }); }
        if (kk.jump && pl.ground) { pl.vy = 360; pl.ground = false; sfx.play("jump"); }
        if (kk.atk) attack(); if (kk.dig) digMove(); if (kk.skl) castSlot(0); if (kk.fire) fireBolt(); if (kk.kick) kickMove(); if (kk.rocket) fireRocket(); if (kk.zap) zapBolt();
        if (kk.spell && spellG >= 100 && !quizOn.current) { kk.l = kk.r = kk.atk = kk.skl = kk.jump = kk.fire = kk.kick = kk.spell = false; quizOn.current = true; if (castRef.current) castRef.current(); }
        if (kk.dash && pl.dashCd <= 0) { sfx.play("dash"); pl.dashCd = 1.2; pl.dashT = 0.18; pl.inv = Math.max(pl.inv, 0.3); for (let i = 0; i < (HI() ? 8 : 3); i++) addPart(pl.x, GROUND - pl.y - 30, -pl.face * (80 + Math.random() * 120), (Math.random() - 0.5) * 60, 0.3, "160,255,230", 2.5); }
        if (pl.dashT > 0) { pl.dashT -= dt; pl.x = Math.max(boss.active && !boss.dead ? ARENA : 40, Math.min(WORLD - 60, pl.x + pl.face * 560 * dt)); }
        { const hm = buff.haste > 0 ? 1.4 : 1; pl.dashCd -= dt * hm; pl.fireCd -= dt * hm; pl.rockCd -= dt * hm; pl.zapCd = (pl.zapCd || 0) - dt * hm; pl.kickCd -= dt * hm; } pl.comboT -= dt; if (pl.comboT <= 0) pl.combo = 0;
        pl.vy -= 900 * dt; pl.y += pl.vy * dt; if (pl.y <= 0) { pl.y = 0; pl.vy = 0; pl.ground = true; }
        pl.atkCd -= dt; pl.sklCd -= dt; pl.inv -= dt; pl.swing -= dt; pl.digCd = (pl.digCd || 0) - dt;
        for (let i = 0; i < 3; i++) slotCd[i] -= dt * (1 + PASS.cdr) * (buff.haste > 0 ? 1.4 : 1);
        buff.haste -= dt; shieldT -= dt; if (shieldT > 0) pl.inv = Math.max(pl.inv, 0.1); if (PASS.regen > 0 && pl.hp > 0) pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * PASS.regen * dt);
        if (kk.s2) castSlot(1); if (kk.s3) castSlot(2);
      }
      if (P.survival && !surv.done && pl.dead <= 0) {
        surv.t += dt; surv.next -= dt;
        if (surv.next <= 0) { surv.next = 6; surv.wave++; const n = Math.min(7, 2 + surv.wave); for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; const x = Math.max(60, Math.min(WORLD - 60, teamX() + side * (420 + rnd(surv.wave * 9 + i) * 160))); mons.push(mk(pool[(surv.wave + i) % pool.length], x, 1000 + surv.wave * 10 + i)); } }
        if (surv.t >= SURV_T) {
          surv.done = true; finished = true; mons.length = 0; shots.length = 0; markDone(P.id); shake = 6; showClear(2200);
          const gain = Math.round(150 * (P.hard || 1) * RW); const rpg = addRpgExpX(me, gain); addSkillSp(cls, Math.round(gain / 3)); gainCry(15 * CV);
          info = rpgOf(me); if (rpg && rpg.leveled) { mods = rpgMods(info.pts); pl.hp = hpMaxOf(info.lv); }
          logUsage("adv", "harvest-win:" + P.id); playUi && playUi("reward");
          setBanner({ k: Date.now(), a: t("เก็บพลังงานครบ! +" + gain + " EXP", "ENERGY HARVESTED! +" + gain + " EXP", "能量采集完成！+" + gain + " 经验"), b: t("◆ คริสตัล +" + 15 * CV, "◆ crystals +" + 15 * CV, "◆ 晶体 +" + 15 * CV) });
        }
      }
      if (P.survival || CAPM) for (let i = mons.length - 1; i >= 0; i--) if (mons[i].dead) mons.splice(i, 1);
      if (DYS && !finished) {
        for (const n of nodes) if (n.hit) n.hit = Math.max(0, n.hit - dt);
        flareT += dt; if (flareT > 12 && !flareWarn) { flareWarn = true; setBanner({ k: Date.now(), a: t("เปลวสุริยะ!", "SOLAR FLARE!", "太阳耀斑！"), b: t("กระโดดหลบ!", "Jump to dodge!", "跳起来躲开！") }); sfx.play("boom"); }
        if (flareT > 14) { flareT = 0; flareWarn = false; shake = Math.max(shake, 8); for (let a = 0; a < (HI() ? 30 : 10); a++) addPart(camX + Math.random() * vw, GROUND - Math.random() * 300, -200, 40, 0.6, "255,200,90", 3); if (pl.y < 40 && pl.dead <= 0 && pl.inv <= 0) hurtPlayer(Math.round(8 * HM), pl.x + 1); }
        if (pl.dead <= 0 && Math.abs(pl.x - PAD_X) < 110 && pl.y < 30) {
          if (dframes.every(q => q.built)) {
            finished = true; launched = 0.001; addDyson(4); markDone(P.id); showClear(3000); const gain = Math.round(240 * (P.hard || 1) * RW); const rpg = addRpgExpX(me, gain); addSkillSp(cls, Math.round(gain / 3)); gainCry(20 * CV); info = rpgOf(me); if (rpg && rpg.leveled) { mods = rpgMods(info.pts); pl.hp = hpMaxOf(info.lv); }
            logUsage("adv", "dyson-done:" + P.id); playUi && playUi("reward"); sfx.play("rocket");
            setBanner({ k: Date.now(), a: t("ส่งพลังงานดาวฤกษ์กลับโลกแล้ว!", "STAR ENERGY BEAMED TO EARTH!", "恒星能量已传回地球！"), b: t("+" + gain + " EXP · ไดสันสเฟียร์ทำงาน", "+" + gain + " EXP · the Dyson sphere is online", "+" + gain + " 经验 · 戴森球已上线") });
          } else { padHint -= dt; if (padHint <= 0) { padHint = 2.5; pop(PAD_X, GROUND - 110, t("ต้องประกอบ" + PARTS[0] + "ให้ครบ " + dframes.filter(q => q.built).length + "/4 ก่อน", "Finish all 4 " + PARTS[1] + " first (" + dframes.filter(q => q.built).length + "/4)", "需先完成 4 个" + PARTS[2].trim() + "（" + dframes.filter(q => q.built).length + "/4）"), "#ffd0a0"); } }
        }
      }
      if (MINE && !finished) {
        for (const n of nodes) if (n.hit) n.hit = Math.max(0, n.hit - dt);
        if (pl.dead <= 0 && Math.abs(pl.x - PAD_X) < 110 && pl.y < 30) {
          if (cargo >= ORE_NEED) {
            finished = true; launched = 0.001; addOre(cargo); markDone(P.id); showClear(2800); const gain = Math.round(120 * (P.hard || 1) * RW); const rpg = addRpgExpX(me, gain); addSkillSp(cls, Math.round(gain / 3)); gainCry(10 * CV); info = rpgOf(me); if (rpg && rpg.leveled) { mods = rpgMods(info.pts); pl.hp = hpMaxOf(info.lv); }
            logUsage("adv", "ship-ore:" + P.id + ":" + cargo); playUi && playUi("reward"); sfx.play("rocket");
            setBanner({ k: Date.now(), a: t("ส่งแร่กลับโลกแล้ว! " + cargo + " ก้อน", "ORE SHIPPED TO EARTH! " + cargo, "矿石已运回地球！" + cargo), b: t("+" + gain + " EXP · อาณานิคมโตขึ้น", "+" + gain + " EXP · the colony grows", "+" + gain + " 经验 · 殖民地壮大") });
          } else { padHint -= dt; if (padHint <= 0) { padHint = 2; pop(PAD_X, GROUND - 100, t("ต้องมีแร่ " + ORE_NEED + " ก้อน (มี " + cargo + ")", "Need " + ORE_NEED + " ore (have " + cargo + ")", "需要 " + ORE_NEED + " 矿（现有 " + cargo + "）"), "#ffd0a0"); } }
        }
      }
      if (launched > 0) launched += dt;
      if (CAPM && !finished && pl.dead <= 0) {
        const cur = stations.find(q => !q.done);
        if (cur) {
          if (Math.abs(pl.x - cur.x) < 170 && pl.y < 90) {
            cur.p += dt; capWave -= dt;
            if (capWave <= 0) { capWave = 4.5; const idx = stations.indexOf(cur), n = Math.min(6, 2 + idx + (cur.p > 6 ? 1 : 0)); for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; const x = Math.max(60, Math.min(WORLD - 60, cur.x + side * (330 + rnd(cur.p * 7 + i) * 170))); mons.push(mk(pool[(idx + i) % pool.length], x, 2000 + idx * 20 + i)); } }
            if (cur.p >= CAP_T) { cur.done = true; cur.p = CAP_T; sfx.play("win"); const left = stations.filter(q => !q.done).length; setBanner({ k: Date.now(), a: t("ยึดสถานีได้แล้ว!", "STATION CAPTURED!", "采集站已占领！"), b: left ? t("เหลืออีก " + left + " จุด", left + " to go", "还剩 " + left + " 座") : t("ดวงอาทิตย์เป็นของเรา", "The sun is ours", "恒星已被占领") }); }
          } else cur.p = Math.max(0, cur.p - dt * 0.4);
        } else {
          finished = true; markDone(P.id); showClear(2000); mons.length = 0; shots.length = 0; const gain = Math.round(160 * (P.hard || 1) * RW); const rpg = addRpgExpX(me, gain); addSkillSp(cls, Math.round(gain / 3)); gainCry(18 * CV); info = rpgOf(me); if (rpg && rpg.leveled) { mods = rpgMods(info.pts); pl.hp = hpMaxOf(info.lv); }
          logUsage("adv", "capture-win:" + P.id); playUi && playUi("reward");
          setBanner({ k: Date.now(), a: t("ยึดดาวฤกษ์สำเร็จ! +" + gain + " EXP", "SUN CAPTURED! +" + gain + " EXP", "占领恒星！+" + gain + " 经验"), b: t("◆ คริสตัล +" + 18 * CV, "◆ crystals +" + 18 * CV, "◆ 晶体 +" + 18 * CV) });
        }
      }
      if (HZ.length && pl.dead <= 0 && pl.y < 14 && hzOn() && HZ.some(h => pl.x > h[0] && pl.x < h[1])) { hzAcc += dt; if (hzAcc >= 0.6) { hzAcc = 0; hzHits++; hurtPlayer(Math.round(4.5 * HM), pl.x + (pl.face > 0 ? -1 : 1)); } } else hzAcc = Math.min(hzAcc, 0.3);
      for (const m of mons) {
        if (m.dead) { m.resp -= dt; if (m.resp <= 0 && Math.abs(pl.x - m.hx) > 640) { m.dead = 0; m.hp = m.max; m.x = m.hx; m.y = 0; m.vx = 0; } continue; }
        const d = MON[m.type]; m.hurt -= dt; const sl = m.slowT > 0 ? (m.slowT -= dt, m.slowF) : 1; m.cd -= dt * 1000 * sl;
        const dxp = pl.x - m.x, dist = Math.abs(dxp);
        m.face = dxp > 0 ? 1 : -1;
        const aggro = dist < 520 && pl.dead <= 0;
        let mv = 0;
        if (aggro && m.tele <= 0) {
          if (d.ranged) { if (dist > 300) mv = Math.sign(dxp); else if (dist < 190) mv = -Math.sign(dxp); }
          else if (dist > 40) mv = Math.sign(dxp);
        }
        m.x += (mv * d.speed * sl + m.vx) * dt; m.vx *= 0.86;
        if (m.type === "glowbug" && aggro && m.y <= 0 && dist < 260 && Math.random() < 0.02) m.vy = 240;
        m.vy -= 700 * dt; m.y += m.vy * dt; if (m.y < 0) { m.y = 0; m.vy = 0; }
        // every attack is announced first: a red "!" for 0.3 s, then the blow (an attack that lands with no warning is not fair)
        if (m.tele > 0) {
          m.tele -= dt * sl;
          if (m.tele <= 0) {
            m.cd = d.cd; teleGaps.push(time - m.teleAt);
            if (m.act === "shot") shots.push({ x: m.x + m.face * 18, y: 56, vx: m.face * 190, life: 2.4, d: Math.round(d.dmg * HM) });
            else if (pl.dead <= 0 && Math.abs(pl.x - m.x) < d.w / 2 + 34 && Math.abs(pl.y - m.y) < 56) hurtPlayer(Math.round(d.dmg * HM) + Math.round(info.lv * 0.4), m.x);
          }
        } else if (d.ranged) {
          if (aggro && dist < 420 && m.cd <= 0) { m.tele = 0.3; m.act = "shot"; m.teleAt = time; }
        } else if (aggro && dist < d.w / 2 + 26 && Math.abs(pl.y - m.y) < 50 && m.cd <= 0) { m.tele = 0.3; m.act = "melee"; m.teleAt = time; }
      }
      if (boss.active && !boss.dead) {
        boss.hurt -= dt; boss.face = pl.x > boss.x ? 1 : -1;
        const rage = !!P.enrage && boss.hp < boss.max * 0.5;   // Nexa's overseer enrages at half health: faster cycle, wider volleys
        if (rage && !boss.raged) { boss.raged = true; shake = 9; setBanner({ k: Date.now(), a: t("โกรธจัด!", "ENRAGED!", "狂暴！"), b: t("โจมตีถี่ขึ้น กระสุนมากขึ้น", "Faster attacks, wider volleys", "攻击更快，弹幕更宽") }); }
        if (boss.state === "idle") {
          boss.cd -= dt; boss.x += (Math.sign(pl.x - boss.x) * 36 + boss.vx) * dt; boss.vx *= 0.86;
          boss.x = Math.max(ARENA + 60, Math.min(WORLD - 120, boss.x));
          if (rage) boss.cd -= dt * 0.8;
          if (boss.cd <= 0) { const o = boss.n++ % 3; boss.state = o === 0 ? "slam" : o === 1 ? "volley" : "charge"; boss.tele = o === 2 ? 0.7 : 0.6; boss.dur = 0; }
          if (Math.abs(pl.x - boss.x) < 70 && Math.abs(pl.y) < 40 && pl.inv <= 0) hurtPlayer(Math.round(14 * HM), boss.x);
        } else if (boss.tele > 0) {
          boss.tele -= dt;
          if (boss.tele <= 0) {
            if (boss.state === "slam") { shake = 8; sfx.play("slam"); waves.push({ x: boss.x, dir: -1, life: 2.2 }, { x: boss.x, dir: 1, life: 2.2 }); boss.state = "idle"; boss.cd = 2; }
            else if (boss.state === "volley") { for (let i = rage ? -2 : -1; i <= (rage ? 2 : 1); i++) shots.push({ x: boss.x + boss.face * 40, y: 70 + i * 26, vx: boss.face * (200 + i * 30), life: 2.6, d: Math.round(12 * HM) }); boss.state = "idle"; boss.cd = 1.8; }
            else { boss.dur = 0.8; boss.vx = boss.face * 340; }
          }
        } else if (boss.state === "charge") {
          boss.dur -= dt; boss.x += boss.vx * dt; boss.x = Math.max(ARENA + 60, Math.min(WORLD - 120, boss.x));
          if (Math.abs(pl.x - boss.x) < 80 && pl.y < 50) hurtPlayer(Math.round(20 * HM), boss.x);
          if (boss.dur <= 0) { boss.vx = 0; boss.state = "idle"; boss.cd = 2; }
        }
      }
      petCd -= dt; if (petCd <= 0) { petCd = 2.2; petBolt(); }
      for (let i = 0; i < petSlots.length; i++) { petCdA[i] -= dt; if (petCdA[i] > 0 || pl.dead > 0) continue; const q = petSlots[i]; const near = mons.some(m => !m.dead && Math.abs(m.x - pl.x) < 360) || (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < 360); const need = q.s.a === "heal" || q.s.a === "shield" ? pl.hp < hpMaxOf(info.lv) * 0.7 && near : near; if (need) { petCdA[i] = cdAt(q.s, q.lv) * (1 - PASS.cdr) + 1; castSkill(q.s, q.lv, true); } }
      for (const tr of turrets) { tr.t -= dt; tr.cd -= dt; if (tr.cd <= 0) { const f = nearestFoe(tr.x, tr.face, 460); if (f) { tr.cd = 0.5; const d = dmgOf(tr.mult); bolts.push({ x: tr.x, y: 40, vx: Math.sign(f.x - tr.x) * 620, vy: (f.y + 20 - 40) * 1.4, life: 0.8, v: d.v, crit: d.crit }); sfx.play("fire", rv); } } }
      for (let i = turrets.length - 1; i >= 0; i--) if (turrets[i].t <= 0) turrets.splice(i, 1);
      for (const L of later) { L.t -= dt; if (L.t <= 0 && !L.done) { L.done = true; L.fn(); } } for (let i = later.length - 1; i >= 0; i--) if (later[i].done) later.splice(i, 1);
      for (const b of pet) { b.life -= dt; if (b.life <= 0 && !b.done) { b.done = true; if (b.b) hurtBoss(b.v, false, 0); else if (!b.m.dead) hurtMon(b.m, b.v, false, 0); } }
      for (let i = pet.length - 1; i >= 0; i--) if (pet[i].done) pet.splice(i, 1);
      for (const b of bolts) {
        b.x += b.vx * dt; if (b.vy) b.y += b.vy * dt; b.life -= dt;
        for (const m of mons) { if (m.dead || b.life <= 0) continue; if (b.hit && b.hit.has(m)) continue; if (Math.abs(m.x - b.x) < MON[m.type].w / 2 + 8 && Math.abs(m.y + 20 - b.y) < 50) { hurtMon(m, b.v, b.crit, Math.sign(b.vx) * 90); if (b.pierce) b.hit.add(m); else b.life = 0; } }
        if (b.life > 0 && boss.active && !boss.dead && Math.abs(boss.x - b.x) < 62 && b.y < 140 && !(b.hit && b.hit.has(boss))) { hurtBoss(b.v, b.crit, 0); if (b.pierce) b.hit.add(boss); else b.life = 0; }
      }
      for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].life <= 0) bolts.splice(i, 1);
      for (const r of rockets) {
        if (r.k === "homing" || r.k === "mini") { let tx: number | null = null, ty = 40; let bd = 520; for (const m of mons) { if (m.dead) continue; const dd = Math.abs(m.x - r.x); if (dd < bd) { bd = dd; tx = m.x; ty = m.y + 24; } } if (boss.active && !boss.dead && Math.abs(boss.x - r.x) < bd) { tx = boss.x; ty = 70; }
          if (tx !== null) { const ax = tx - r.x, ay = ty - r.y, L = Math.hypot(ax, ay) || 1; r.vx += (ax / L * 520 - r.vx) * Math.min(1, 3.2 * dt); r.vy += (ay / L * 520 - r.vy) * Math.min(1, 3.2 * dt); } }
        else r.vy -= r.g * dt;
        r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt; r.sm = (r.sm || 0) - dt;
        if (r.sm <= 0 && r.k !== "bomblet") { r.sm = HI() ? 0.018 : 0.04; const bk = Math.atan2(-r.vy, r.vx) + Math.PI; smoke.push({ x: r.x + Math.cos(bk) * 14, y: r.y - Math.sin(bk) * 14, vx: Math.cos(bk) * 20, vy: 10 + Math.random() * 15, life: 0.75, max: 0.75, r: 3 + Math.random() * 2 }); } let boom = r.life <= 0 || r.y <= 0;
        if (!boom) for (const m of mons) if (!m.dead && Math.abs(m.x - r.x) < MON[m.type].w / 2 + 10 && Math.abs(m.y + 24 - r.y) < 50) { boom = true; break; }
        if (!boom && boss.active && !boss.dead && Math.abs(boss.x - r.x) < 70 && r.y < 150) boom = true;
        if (boom) { r.dead = true; const yy = Math.max(0, r.y);
          if (r.k === "homing") explode(r.x, yy, 95, 3.2, "255,170,60");
          else if (r.k === "mini") explode(r.x, yy, 48, 1.3, "255,200,100");
          else if (r.k === "rpg") { explode(r.x, yy, 125, 4.6, "255,150,60"); shake = Math.max(shake, HI() ? 9 : 5); }
          else if (r.k === "frag") explode(r.x, yy, 115, 3.4, "200,255,120");
          else if (r.k === "big") { explode(r.x, yy, 170, 7, "255,140,50"); shake = Math.max(shake, HI() ? 12 : 6); }
          else if (r.k === "nuke") { explode(r.x, yy, 460, 16, "255,255,230"); shake = HI() ? 22 : 12; blasts.push({ x: r.x, y: yy, r: 900, life: 0.7, max: 0.7, flash: true }); for (let q = 0; q < 3; q++) blasts.push({ x: r.x + (q - 1) * 90, y: yy + q * 30, r: 380, life: 0.9 + q * 0.2, max: 1.3 }); for (let q = 0; q < (HI() ? 26 : 10); q++) smoke.push({ x: r.x + (Math.random() - 0.5) * 220, y: yy + Math.random() * 260, vx: (Math.random() - 0.5) * 90, vy: 40 + Math.random() * 110, life: 1.8 + Math.random() * 1.2, max: 3, r: 24 + Math.random() * 30 }); pop(r.x, GROUND - yy - 160, t("นิวเคลียร์!", "NUKE!", "核爆！"), "#fff2c0"); }
          else if (r.k === "cluster") { explode(r.x, yy, 60, 1.4, "255,200,90"); for (let q = 0; q < 5; q++) rockets.push({ k: "bomblet", x: r.x + (q - 2) * 8, y: yy + 10, vx: (q - 2) * 90, vy: 150 + (q % 2) * 70, life: 0.7 + q * 0.06, g: 600 }); }
          else if (r.k === "napalm") { explode(r.x, yy, 60, 1.2, "255,120,40"); fires.push({ x: r.x, life: 3.5, tick: 0 }); }
          else if (r.k === "bomblet") explode(r.x, yy, 55, 1.0, "255,210,120"); }
      }
      for (let i = rockets.length - 1; i >= 0; i--) if (rockets[i].dead) rockets.splice(i, 1);
      for (const q of smoke) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += 14 * dt; } for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].life <= 0) smoke.splice(i, 1); if (smoke.length > (HI() ? 220 : 70)) smoke.splice(0, smoke.length - (HI() ? 220 : 70));
      for (const q of blasts) q.life -= dt; for (let i = blasts.length - 1; i >= 0; i--) if (blasts[i].life <= 0) blasts.splice(i, 1);
      for (const f of fires) { f.life -= dt; f.tick -= dt; if (f.tick <= 0) { f.tick = 0.4; for (const m of mons) if (!m.dead && Math.abs(m.x - f.x) < 110 && m.y < 40) hurtMon(m, Math.max(1, dmgOf(0.5).v), false, 0); if (boss.active && !boss.dead && Math.abs(boss.x - f.x) < 130) hurtBoss(Math.max(1, dmgOf(0.5).v), false, 0); } }
      for (let i = fires.length - 1; i >= 0; i--) if (fires[i].life <= 0) fires.splice(i, 1);
      for (const a of arcs) a.life -= dt; for (let i = arcs.length - 1; i >= 0; i--) if (arcs[i].life <= 0) arcs.splice(i, 1);
      for (const b of beams) b.life -= dt; for (let i = beams.length - 1; i >= 0; i--) if (beams[i].life <= 0) beams.splice(i, 1);
      for (const w of waves) { w.x += w.dir * 260 * dt; w.life -= dt; if (Math.abs(w.x - pl.x) < 22 && pl.y < 34) { hurtPlayer(Math.round(16 * HM), w.x); w.life = 0; } }
      for (let i = waves.length - 1; i >= 0; i--) if (waves[i].life <= 0) waves.splice(i, 1);
      for (const d of drops) { d.vy -= 700 * dt; d.y += d.vy * dt; if (d.y < 0) { d.y = 0; d.vy = 0; } if (pl.dead <= 0 && Math.abs(d.x - pl.x) < 34 && Math.abs(d.y - pl.y) < 60) { d.got = true;
        if (d.t.charCodeAt(1) === 58) equipWeapon(d.t.slice(2)); else if (d.t === "hp") { sfx.play("pickup"); pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * 0.18); pop(pl.x, GROUND - pl.y - 100, "+HP", "#8dffb0"); } else if (LOOT[d.t]) { sfx.play("pickup"); loot[d.t]++; pop(pl.x, GROUND - pl.y - 100, "+" + LOOT[d.t].v + " 🪙", LOOT[d.t].c); } else { sfx.play("pickup"); gainCry(CV); pop(pl.x, GROUND - pl.y - 100, "◆" + (CV > 1 ? "×" + CV : ""), "#7fe8ff"); } } }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].got) drops.splice(i, 1);
      for (const s of shots) { s.x += s.vx * dt; s.life -= dt; if (Math.abs(s.x - pl.x) < 18 && Math.abs(s.y - pl.y - 40) < 40 && s.life > 0) { hurtPlayer(s.d, s.x); s.life = 0; } }
      for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
      for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      for (const p of pops) { p.life -= dt; p.y -= 38 * dt; }
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
      for (const s of slashes) s.life -= dt; for (let i = slashes.length - 1; i >= 0; i--) if (slashes[i].life <= 0) slashes.splice(i, 1);
      if (P.id === "kindred" || P.id === "darkforge") for (const b of beacons) if (!b.used && !b.greet && Math.abs(pl.x - b.x) < 300) { b.greet = true; pop(b.x, GROUND - 170, P.id === "darkforge" ? T3(lang, "เราช่วยดูแลสสารมืดให้ — ตอบก่อนนะ", "We will help you steady the dark matter. Answer first.", "我们帮你稳住暗物质——先回答吧。") : T3(lang, "สวัสดี เพื่อนมนุษย์ — มาแลกความรู้กัน", "Greetings, friend. Let us trade knowledge.", "你好，朋友——来交换知识吧。"), "#8dffdc"); }
      for (const b of beacons) if (!b.used && pl.dead <= 0 && Math.abs(pl.x - b.x) < 64) { b.used = true; keys.current.l = keys.current.r = keys.current.atk = keys.current.skl = keys.current.jump = false; quizOn.current = true; if (beaconRef.current) beaconRef.current(beacons.indexOf(b), !!b.tap); }
      // the music follows the fight: calm 1, fighting 2, peak 3 (boss, a big combo, the spell ready, or low health with enemies near)
      mi -= dt; if (mi <= 0 && mus) { mi = 0.25; let near = false; for (const m of mons) if (!m.dead && Math.abs(m.x - pl.x) < 480) { near = true; break; } const peak = (boss.active && !boss.dead) || pl.combo >= 2 || spellG >= 100 || (near && pl.hp / hpMaxOf(info.lv) < 0.3); mus.setIntensity(peak ? 3 : near ? 2 : 1); }
      // camera: the robot a little ahead of centre, eased
      const target = Math.max(0, Math.min(WORLD - vw, pl.x - vw * 0.42 + pl.face * 30));
      camX += (target - camX) * (HI() ? 0.12 : 0.2);
      shake *= 0.86;
      if (!warped && (NOBOSS ? finished : boss.dead) && pl.dead <= 0 && pl.x > WORLD - 140) {   // walk into the warp gate (any map, once its goal is done): straight on to the next map, its film first
        warped = true; finished = true; shake = 8; sfx.play("rocket"); const sale = settle(1);
        for (let a = 0; a < (HI() ? 50 : 20); a++) addPart(pl.x, GROUND - 60, (Math.random() - 0.5) * 120, -Math.random() * 380, 1, a % 2 ? P.acc : "255,255,255", 3);
        setBanner({ k: Date.now(), a: t("วาร์ป!", "WARP!", "传送！"), b: sale.coins > 0 ? t("ขายของ +" + sale.coins + " 🪙", "Loot sold +" + sale.coins + " 🪙", "出售战利品 +" + sale.coins + " 🪙") : t("เดินทางต่อ…", "On to the next map…", "前往下一张地图…") });
        setTimeout(() => { if (ended) return; const nx = getNext ? getNext() : null; if (nx && onNext) onNext(nx); else showClear(0); }, 1100);
      }
    };

    const draw = (tm) => {
      const sx = (HI() && shake > 0.3) ? (Math.random() - 0.5) * shake * k : 0, sy = (HI() && shake > 0.3) ? (Math.random() - 0.5) * shake * k : 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bake.sky, sx, sy);
      const tile = (img, f, a = 1) => { const w = img.width, off = -((camX * f * k) % w + w) % w; if (a !== 1) ctx.globalAlpha = a; for (let x0 = off + sx; x0 < cw; x0 += w) ctx.drawImage(img, x0, sy); if (a !== 1) ctx.globalAlpha = 1; };
      tile(bake.far, 0.15); tile(bake.mid, 0.4);
      if (bake.fog) tile(bake.fog, 0.55);
      tile(bake.ground, 1);
      // world layer
      ctx.setTransform(k, 0, 0, k, -camX * k + sx, sy);
      // fireflies
      ctx.globalCompositeOperation = "lighter";
      for (const f of fireflies) { const fx = f.x + Math.sin(tm * 0.6 + f.ph) * 14, fy = f.y + Math.sin(tm * 0.9 + f.ph * 2) * 10; if (fx < camX - 20 || fx > camX + vw + 20) continue; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tm * 2 + f.ph); ctx.fillStyle = `rgb(${P.glow})`; ctx.fillRect(fx, fy, 2, 2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      for (const h of HZ) { if (h[1] < camX - 40 || h[0] > camX + vw + 40) continue; const on = hzOn(), warn = P.hazard === "shock" && !on && (time % 3) > 1.4;
        if (P.hazard === "lava") { const g = ctx.createLinearGradient(0, GROUND - 4, 0, GROUND + 22); g.addColorStop(0, "#ffd23f"); g.addColorStop(0.4, "#ff6a1a"); g.addColorStop(1, "#7a1a0a"); ctx.fillStyle = g; ctx.fillRect(h[0], GROUND - 2, h[1] - h[0], 24); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,140,40,.35)"; for (let q = h[0]; q < h[1]; q += 26) ctx.fillRect(q + Math.sin(tm * 3 + q) * 4, GROUND - 6 - Math.abs(Math.sin(tm * 2 + q * 0.1)) * 6, 14, 4); ctx.globalCompositeOperation = "source-over"; }
        else { ctx.fillStyle = on ? "#7fe8ff" : warn ? (Math.floor(tm * 12) % 2 ? "#ffd23f" : "#38304e") : "#38304e"; ctx.fillRect(h[0], GROUND - 2, h[1] - h[0], 6); if (on) { ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(160,240,255,.9)"; ctx.lineWidth = 2; for (let q = h[0] + 8; q < h[1]; q += 30) { ctx.beginPath(); ctx.moveTo(q, GROUND); ctx.lineTo(q + 8, GROUND - 14 - Math.random() * 10); ctx.lineTo(q + 16, GROUND); ctx.stroke(); } ctx.globalCompositeOperation = "source-over"; } } }
      for (const n of nodes) { if (n.done || n.x < camX - 60 || n.x > camX + vw + 60) continue; const sh = n.hit ? Math.sin(tm * 80) * 2 : 0, f = n.hp / n.max; ctx.fillStyle = n.hit ? "#fff" : "#2a4a6a"; ctx.beginPath(); ctx.moveTo(n.x - 26 + sh, GROUND); ctx.lineTo(n.x - 14 + sh, GROUND - 40 * (0.6 + 0.4 * f)); ctx.lineTo(n.x + 2 + sh, GROUND - 56 * (0.6 + 0.4 * f)); ctx.lineTo(n.x + 18 + sh, GROUND - 36); ctx.lineTo(n.x + 28 + sh, GROUND); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(120,210,255,.8)"; ctx.fillRect(n.x - 6 + sh, GROUND - 30, 5, 18); ctx.fillRect(n.x + 8 + sh, GROUND - 22, 4, 12); ctx.globalCompositeOperation = "source-over"; }
      for (const n of nodes) { if (n.done || n.x < camX - 60 || n.x > camX + vw + 60) continue; const bob = Math.sin(tm * 3 + n.x) * 4; ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(140,230,255,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, GROUND - 92 + bob, 15, 0, 6.3); ctx.stroke(); ctx.globalCompositeOperation = "source-over"; ctx.font = "16px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#e6faff"; ctx.fillText("⛏", n.x, GROUND - 86 + bob); ctx.textAlign = "left"; }   // mining points: a ringed pick marks every rock still to break
      for (const f of dframes) { if (f.x < camX - 140 || f.x > camX + vw + 140) continue; ctx.save(); ctx.strokeStyle = f.built ? "#ffd060" : "#7a8aa8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(f.x - 46, GROUND); ctx.lineTo(f.x - 30, GROUND - 150); ctx.lineTo(f.x + 30, GROUND - 150); ctx.lineTo(f.x + 46, GROUND); ctx.stroke();
        if (f.built) { ctx.globalCompositeOperation = "lighter"; const gg = ctx.createRadialGradient(f.x, GROUND - 100, 4, f.x, GROUND - 100, 90); gg.addColorStop(0, "rgba(255,225,130,.8)"); gg.addColorStop(1, "rgba(255,160,40,0)"); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(f.x, GROUND - 100, 90, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(255,200,80,.85)"; ctx.fillRect(f.x - 34, GROUND - 146, 68, 12); ctx.fillStyle = "rgba(90,200,255,.7)"; ctx.fillRect(f.x - 34, GROUND - 126, 68, 12); }
        else { ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "700 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("⛏ " + PANEL_ORE + " ORE", f.x, GROUND - 160); } ctx.restore(); }
      if (MINE || DYS) { const gx = PAD_X; if (gx > camX - 80 && gx < camX + vw + 80) { ctx.fillStyle = "#3a4a5a"; ctx.fillRect(gx - 50, GROUND - 6, 100, 8); ctx.fillStyle = (DYS ? dframes.every(q => q.built) : cargo >= ORE_NEED) ? "#7dffa8" : "#ffb070"; ctx.fillRect(gx - 50, GROUND - 8, 100, 3);
        const ry = launched > 0 ? launched * launched * 220 : 0; ctx.save(); ctx.translate(gx, GROUND - 30 - ry); ctx.fillStyle = "#e8edf3"; ctx.fillRect(-9, -26, 18, 44); ctx.fillStyle = "#ff4d6d"; ctx.beginPath(); ctx.moveTo(-9, -26); ctx.lineTo(0, -44); ctx.lineTo(9, -26); ctx.closePath(); ctx.fill(); if (launched > 0) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,170,60,.8)"; ctx.fillRect(-6, 18, 12, 30 + Math.random() * 20); ctx.globalCompositeOperation = "source-over"; } ctx.restore(); } }
      for (const q of stations) { if (q.x < camX - 100 || q.x > camX + vw + 100) continue; const f = q.p / CAP_T; ctx.fillStyle = q.done ? "#ffd23f" : "#3a3a4a"; ctx.fillRect(q.x - 8, GROUND - 90, 16, 90); ctx.fillStyle = q.done ? "#fff6c0" : "#5a5a6a"; ctx.beginPath(); ctx.arc(q.x, GROUND - 98, 16, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(255,210,80,.95)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(q.x, GROUND - 98, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,210,80," + (q.done ? 0.25 : 0.08 + f * 0.2) + ")"; ctx.beginPath(); ctx.arc(q.x, GROUND - 40, 170, Math.PI, 0); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
      // monsters
      for (const m of mons) { if (m.dead || m.x < camX - 80 || m.x > camX + vw + 80) continue; drawMonster(ctx, m, tm, k, GROUND);
        if (m.tele > 0) { ctx.fillStyle = "#ff4d6d"; ctx.font = "900 22px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", m.x, GROUND - m.y - (TALL.has(m.type) ? 128 : 74)); }
        if (m.hp < m.max) { const w = 40, y0 = GROUND - m.y - (TALL.has(m.type) ? 118 : 62); ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(m.x - w / 2, y0, w, 5); ctx.fillStyle = "#ff5b7a"; ctx.fillRect(m.x - w / 2, y0, w * Math.max(0, m.hp / m.max), 5); } }
      if (boss.active && !boss.dead && boss.x > camX - 160 && boss.x < camX + vw + 160) drawBoss(ctx, boss, tm, P);
      for (const f of fires) { ctx.globalCompositeOperation = "lighter"; for (let q = -100; q <= 100; q += 14) { const hh = 10 + Math.abs(Math.sin(tm * 9 + q)) * 18 * Math.min(1, f.life); ctx.fillStyle = "rgba(255,120,30,.55)"; ctx.fillRect(f.x + q - 5, GROUND - hh, 10, hh); ctx.fillStyle = "rgba(255,220,100,.5)"; ctx.fillRect(f.x + q - 2, GROUND - hh * 0.5, 4, hh * 0.5); } ctx.globalCompositeOperation = "source-over"; }
      // smoke first (behind the missiles), then the missiles, then the fireballs
      for (const q of smoke) { const a = Math.max(0, q.life / q.max); ctx.fillStyle = `rgba(${150 + 60 * (1 - a) | 0},${140 + 50 * (1 - a) | 0},${130 + 40 * (1 - a) | 0},${0.5 * a})`; ctx.beginPath(); ctx.arc(q.x, GROUND - q.y, q.r, 0, 7); ctx.fill(); }
      for (const r of rockets) {
        const ry = GROUND - r.y, ang = Math.atan2(-r.vy, r.vx), big = r.k !== "bomblet", SCL = r.sc || 1, L = (big ? 36 : 20) * SCL, W2 = (big ? 4.2 : 2.6) * SCL;
        ctx.save(); ctx.translate(r.x, ry); ctx.rotate(ang);
        ctx.globalCompositeOperation = "lighter"; const fl = (big ? 24 : 12) + Math.random() * (big ? 14 : 6);                                   // the exhaust: a hot teardrop
        const eg = ctx.createLinearGradient(-L / 2, 0, -L / 2 - fl, 0); eg.addColorStop(0, "rgba(255,255,230,.95)"); eg.addColorStop(0.35, "rgba(255,180,60,.8)"); eg.addColorStop(1, "rgba(255,70,20,0)");
        ctx.fillStyle = eg; ctx.beginPath(); ctx.moveTo(-L / 2, -W2 * 0.8); ctx.quadraticCurveTo(-L / 2 - fl * 0.6, 0, -L / 2 - fl, 0); ctx.quadraticCurveTo(-L / 2 - fl * 0.6, 0, -L / 2, W2 * 0.8); ctx.fill();
        const gl = ctx.createRadialGradient(-L / 2, 0, 0, -L / 2, 0, big ? 22 : 11); gl.addColorStop(0, "rgba(255,200,100,.55)"); gl.addColorStop(1, "rgba(255,120,40,0)"); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(-L / 2, 0, big ? 22 : 11, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = r.k === "napalm" ? "#7a2a10" : "#4a5668"; ctx.beginPath(); ctx.moveTo(-L * 0.3, -W2 * 1.1); ctx.lineTo(-L / 2 - 2, -W2 * 2.6); ctx.lineTo(-L / 2 + 6, -W2 * 0.6); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-L * 0.3, W2 * 1.1); ctx.lineTo(-L / 2 - 2, W2 * 2.6); ctx.lineTo(-L / 2 + 6, W2 * 0.6); ctx.closePath(); ctx.fill();   // fins
        const bg = ctx.createLinearGradient(0, -W2, 0, W2); bg.addColorStop(0, "#f4f7fb"); bg.addColorStop(0.5, "#aab6c6"); bg.addColorStop(1, "#5d6b7e"); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-L / 2, -W2); ctx.lineTo(L * 0.22, -W2); ctx.lineTo(L * 0.22, W2); ctx.lineTo(-L / 2, W2); ctx.closePath(); ctx.fill();   // the body
        ctx.fillStyle = r.k === "cluster" ? "#ffd23f" : r.k === "napalm" ? "#ff7a2a" : r.k === "mini" ? "#5ad1ff" : r.k === "rpg" ? "#ff8a2a" : r.k === "frag" ? "#9aff5a" : r.k === "big" ? "#8a5cff" : r.k === "nuke" ? "#b6ff3b" : "#e4455b"; ctx.fillRect(-L * 0.12, -W2, L * 0.1, W2 * 2);                  // a coloured band by type
        ctx.beginPath(); ctx.moveTo(L * 0.22, -W2); ctx.quadraticCurveTo(L * 0.42, -W2 * 0.5, L / 2 + 3, 0); ctx.quadraticCurveTo(L * 0.42, W2 * 0.5, L * 0.22, W2); ctx.closePath(); ctx.fillStyle = "#d9d2c4"; ctx.fill();   // the nose cone
        ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.moveTo(L * 0.38, -W2 * 0.35); ctx.lineTo(L / 2 + 3, 0); ctx.lineTo(L * 0.38, W2 * 0.35); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      for (const b of blasts) { const k4 = Math.max(0, b.life / b.max), q = 1 - k4; ctx.globalCompositeOperation = "lighter"; const R = b.r * (b.flash ? 1 : 0.35 + q * 0.75);
        const g2 = ctx.createRadialGradient(b.x, GROUND - b.y, 0, b.x, GROUND - b.y, R); g2.addColorStop(0, `rgba(255,255,235,${0.95 * k4})`); g2.addColorStop(0.3, `rgba(255,200,80,${0.8 * k4})`); g2.addColorStop(0.7, `rgba(255,90,30,${0.4 * k4})`); g2.addColorStop(1, "rgba(255,60,20,0)"); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(b.x, GROUND - b.y, R, 0, 7); ctx.fill();
        if (!b.flash) { ctx.strokeStyle = `rgba(255,220,160,${0.7 * k4})`; ctx.lineWidth = 3 * k4 + 1; ctx.beginPath(); ctx.arc(b.x, GROUND - b.y, R * 1.15, 0, 7); ctx.stroke(); } ctx.globalCompositeOperation = "source-over"; }
      for (const b of beams) { const k4 = Math.max(0, b.life / b.max); ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; for (const [wm, al, c] of [[3.2, 0.18, `rgba(${b.col},1)`], [1.6, 0.5, `rgba(${b.col},1)`], [0.55, 1, "#fff"]] as any[]) { ctx.strokeStyle = c; ctx.globalAlpha = k4 * al; ctx.lineWidth = b.w * wm * (0.6 + 0.4 * k4); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); } ctx.restore(); }
      for (const a of arcs) drawLightning(ctx, a, HI());
      for (const b of bolts) {
        if (b.pierce) { ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = rGlow; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(b.x - Math.sign(b.vx) * 90, GROUND - b.y); ctx.lineTo(b.x, GROUND - b.y); ctx.stroke(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x - Math.sign(b.vx) * 50, GROUND - b.y); ctx.lineTo(b.x, GROUND - b.y); ctx.stroke(); ctx.globalCompositeOperation = "source-over"; continue; }
        ctx.globalCompositeOperation = "lighter"; const by = GROUND - b.y, dir = Math.sign(b.vx); ctx.fillStyle = rGlow; ctx.strokeStyle = rGlow;
        if (BOLT_STYLE === 0) { ctx.beginPath(); ctx.arc(b.x, by, 6, 0, 7); ctx.fill(); ctx.globalAlpha = 0.35; ctx.fillRect(b.x - dir * 30, by - 2, 30, 4); }
        else if (BOLT_STYLE === 1) { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x - dir * 38, by); ctx.lineTo(b.x, by); ctx.stroke(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#fff"; ctx.fillRect(b.x - dir * 10, by - 1.5, 10, 3); }
        else if (BOLT_STYLE === 2) { ctx.beginPath(); ctx.moveTo(b.x + dir * 9, by); ctx.lineTo(b.x, by - 6); ctx.lineTo(b.x - dir * 9, by); ctx.lineTo(b.x, by + 6); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 0.3; ctx.fillRect(b.x - dir * 28, by - 1.5, 20, 3); }
        else { for (let i = 0; i < 3; i++) { ctx.globalAlpha = 1 - i * 0.28; ctx.beginPath(); ctx.arc(b.x - dir * i * 11, by, 5 - i, 0, 7); ctx.fill(); } }
        ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, by, 2, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over";
      }
      for (const b of pet) {
        const q = 1 - b.life / 0.25, px = b.x + (b.tx - b.x) * q, py = GROUND - (b.y + (b.ty - b.y) * q), ang = Math.atan2(GROUND - b.ty - py, b.tx - px); const T = b.ty2 || "steel", col = (PET_TYPES as any)[T] ? (PET_TYPES as any)[T].c : "#8fa6c8";
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = col; ctx.strokeStyle = col;
        if (T === "volt") { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, GROUND - b.y); for (let i = 1; i <= 6; i++) { const f = i / 6 * q; ctx.lineTo(b.x + (b.tx - b.x) * f, GROUND - (b.y + (b.ty - b.y) * f) + (i % 2 ? -7 : 7)); } ctx.stroke(); }
        else if (T === "ember") { ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill(); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(px - 10 * Math.cos(ang), py + 10 * Math.sin(ang), 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(px - 18 * Math.cos(ang), py + 18 * Math.sin(ang), 3, 0, 7); ctx.fill(); }
        else if (T === "frost") { ctx.beginPath(); ctx.moveTo(px + 9, py); ctx.lineTo(px, py - 5); ctx.lineTo(px - 9, py); ctx.lineTo(px, py + 5); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillRect(px - 2, py - 1, 4, 2); }
        else if (T === "flora") { ctx.beginPath(); ctx.ellipse(px, py, 9, 4, ang, 0, 7); ctx.fill(); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(px - 8, py, 6, 3, ang, 0, 7); ctx.fill(); }
        else if (T === "aether") { ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(px, py, 9 + q * 4, 0, 7); ctx.stroke(); }
        else { ctx.fillStyle = "#c9d6ea"; ctx.fillRect(px - 7, py - 3, 14, 6); ctx.fillStyle = col; ctx.fillRect(px - 7, py - 1, 14, 2); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
      for (const w of waves) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(${P.acc},.8)`; ctx.beginPath(); ctx.moveTo(w.x - 14, GROUND); ctx.lineTo(w.x, GROUND - 30); ctx.lineTo(w.x + 14, GROUND); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
      for (const d of drops) { const yy = GROUND - d.y - 8 + Math.sin(tm * 5 + d.x) * 2;
        if (d.t.charCodeAt(1) === 58) { const gw = ctx.createRadialGradient(d.x, yy, 2, d.x, yy, 34 + Math.sin(tm * 6) * 4); gw.addColorStop(0, "rgba(255,225,110,.8)"); gw.addColorStop(1, "rgba(255,200,60,0)"); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gw; ctx.beginPath(); ctx.arc(d.x, yy, 38, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#1b2436"; ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 2; ctx.fillRect(d.x - 13, yy - 11, 26, 22); ctx.strokeRect(d.x - 13, yy - 11, 26, 22); ctx.fillStyle = "#ffd23f"; ctx.font = "bold 15px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("★", d.x, yy + 5); continue; }
        if (LOOT[d.t]) { const c = LOOT[d.t].c; ctx.fillStyle = c; ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1;
          if (d.t === "scrap") { ctx.save(); ctx.translate(d.x, yy); ctx.rotate(tm * 2 + d.x); ctx.fillRect(-5, -4, 10, 8); ctx.strokeRect(-5, -4, 10, 8); ctx.restore(); }
          else if (d.t === "ore") { ctx.beginPath(); ctx.moveTo(d.x - 6, yy + 6); ctx.lineTo(d.x - 2, yy - 7); ctx.lineTo(d.x + 2, yy + 2); ctx.lineTo(d.x + 7, yy - 4); ctx.lineTo(d.x + 7, yy + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
          else if (d.t === "gold") { ctx.beginPath(); ctx.ellipse(d.x, yy, 8, 6, 0.4, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(d.x - 3, yy - 3, 3, 2); }
          else { ctx.globalCompositeOperation = "lighter"; ctx.beginPath(); ctx.arc(d.x, yy, 7 + Math.sin(tm * 6) * 1.5, 0, 7); ctx.fill(); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(d.x, yy, 14, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
          continue; } ctx.fillStyle = d.t === "hp" ? "#7dffa8" : "#7fe8ff"; ctx.beginPath(); if (d.t === "hp") ctx.arc(d.x, yy, 6, 0, 7); else { ctx.moveTo(d.x, yy - 8); ctx.lineTo(d.x + 6, yy); ctx.lineTo(d.x, yy + 8); ctx.lineTo(d.x - 6, yy); ctx.closePath(); } ctx.fill(); if (HI()) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(d.x, yy, 12, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; } }
      // spores + slashes
      for (const s of shots) { ctx.fillStyle = "#e9ff9a"; ctx.beginPath(); ctx.arc(s.x, GROUND - s.y, 5, 0, 7); ctx.fill(); if (HI()) { ctx.globalCompositeOperation = "lighter"; ctx.drawImage(bake.glows.green, s.x - 20, GROUND - s.y - 20, 40, 40); ctx.globalCompositeOperation = "source-over"; } }
      if (net) for (const q of net.peers.values()) {
        if (q.tx === undefined || Date.now() - (q.t || 0) > 4000) continue; q.x = (q.x === undefined ? q.tx : q.x) + (q.tx - (q.x === undefined ? q.tx : q.x)) * 0.25; q.y = (q.y === undefined ? (q.ty || 0) : q.y) + ((q.ty || 0) - (q.y === undefined ? (q.ty || 0) : q.y)) * 0.25;
        if (q.x < camX - 80 || q.x > camX + vw + 80) continue; const gy = GROUND - (q.y || 0), fc = q.face || 1; ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = q.glow || "#7fe8ff"; ctx.shadowColor = q.glow || "#7fe8ff"; ctx.shadowBlur = 12;
        ctx.fillRect(q.x - 14, gy - 62, 28, 40); ctx.beginPath(); ctx.arc(q.x, gy - 72, 12, 0, 7); ctx.fill(); ctx.fillRect(q.x - 12, gy - 22, 9, 22); ctx.fillRect(q.x + 3, gy - 22, 9, 22); ctx.fillStyle = "#0a1620"; ctx.shadowBlur = 0; ctx.fillRect(q.x + fc * 3 - 4, gy - 76, 8, 4);
        ctx.fillStyle = "#fff"; ctx.font = "800 12px system-ui"; ctx.textAlign = "center"; ctx.fillText((WAR && net ? (warTeamOf(net, q.id) === 0 ? "🔴 " : "🔵 ") : "") + q.name, q.x, gy - 96); ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(q.x - 22, gy - 92, 44, 4); ctx.fillStyle = "#ff6b81"; ctx.fillRect(q.x - 22, gy - 92, 44 * Math.max(0, Math.min(1, (q.hp || 0) / Math.max(1, hpMaxOf(info.lv)))), 4);
        if (q.say && Date.now() - (q.sayT || 0) < 3000) { ctx.font = "800 22px system-ui"; ctx.fillText(q.say, q.x, gy - 112); } ctx.restore(); }
      for (const tr of turrets) { ctx.save(); ctx.fillStyle = "#4a5668"; ctx.fillRect(tr.x - 11, GROUND - 16, 22, 16); ctx.fillStyle = "#cdd6e6"; ctx.fillRect(tr.x, GROUND - 14, 20 * tr.face, 5); ctx.fillStyle = "#7fe8ff"; ctx.beginPath(); ctx.arc(tr.x, GROUND - 18, 4, 0, 7); ctx.fill(); ctx.restore(); }
      if (shieldT > 0) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(140,220,255," + (0.5 + 0.3 * Math.sin(time * 14)) + ")"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pl.x, GROUND - pl.y - 50, 62, 0, 7); ctx.stroke(); ctx.restore(); }
      for (const s of slashes) {
        const q = Math.max(0, Math.min(1, 1 - s.life / (s.max || (s.nova ? 0.3 : 0.18)))); ctx.save(); ctx.globalCompositeOperation = "lighter";
        const col = s.col || "#ffe6a0"; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.globalAlpha = Math.max(0, 1 - q);
        if (s.nova) {
          const R = 30 + q * (s.big ? 260 : 170); ctx.lineWidth = 5 * (1 - q) + 1;
          if (s.st === 1) { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + q; ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * R * 0.4, GROUND - s.y + Math.sin(a) * R * 0.4); ctx.lineTo(s.x + Math.cos(a) * R, GROUND - s.y + Math.sin(a) * R); ctx.stroke(); } }
          else if (s.st === 2) { ctx.beginPath(); ctx.arc(s.x, GROUND - s.y, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(s.x, GROUND - s.y, R * 0.6, 0, 7); ctx.stroke(); }
          else if (s.st === 3) { for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 9; i++) { const a = arm * 2.094 + i * 0.35 + q * 5, r = R * (i / 9); ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * r, GROUND - s.y + Math.sin(a) * r, 3, 0, 7); ctx.fill(); } }
          else if (s.st === 4) { ctx.lineWidth = 8 * (1 - q) + 1; ctx.beginPath(); ctx.moveTo(s.x - R, GROUND - s.y); ctx.lineTo(s.x + R, GROUND - s.y); ctx.moveTo(s.x, GROUND - s.y - R); ctx.lineTo(s.x, GROUND - s.y + R * 0.4); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(s.x, GROUND - s.y, R, 0, 7); ctx.stroke(); }
        }
        else { ctx.lineWidth = 6 * (1 - q) + 1; ctx.beginPath(); ctx.arc(s.x - s.face * 30, GROUND - s.y, 56 + q * 18, s.face > 0 ? -0.9 : Math.PI - 0.9 + 1.8 - 1.8, s.face > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // particles (glow in HI() mode)
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = `rgb(${p.col})`; ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2 + 0, p.sz, p.sz); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      // damage numbers
      ctx.textAlign = "center"; ctx.font = "800 15px system-ui,sans-serif";
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = "#000"; ctx.fillText(p.txt, p.x + 1, p.y + 1); ctx.fillStyle = p.col; ctx.fillText(p.txt, p.x, p.y); }
      ctx.globalAlpha = 1;
      // the shadow under the robot
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(pl.x, GROUND + 3, 26 - Math.min(10, pl.y * 0.05), 5, 0, 0, 7); ctx.fill();
      for (const b of beacons) { if (b.x < camX - 40 || b.x > camX + vw + 40) continue; if (P.id === "kindred" || P.id === "darkforge") { paintKindred(ctx, b.x, GROUND, tm, b.used); continue; } const a = b.used ? 0.25 : 0.55 + 0.25 * Math.sin(tm * 3);
        ctx.globalCompositeOperation = "lighter"; const bg = ctx.createLinearGradient(0, GROUND - 150, 0, GROUND); bg.addColorStop(0, `rgba(255,224,138,0)`); bg.addColorStop(1, `rgba(255,224,138,${a * 0.5})`); ctx.fillStyle = bg; ctx.fillRect(b.x - 14, GROUND - 150, 28, 150); ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = b.used ? "#3a4a52" : b.tap ? "#8de8ff" : "#ffe08a"; ctx.beginPath(); ctx.moveTo(b.x - 9, GROUND); ctx.lineTo(b.x - 4, GROUND - 46); ctx.lineTo(b.x + 4, GROUND - 46); ctx.lineTo(b.x + 9, GROUND); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, GROUND - 58 + Math.sin(tm * 2.4) * 3, 10, 0, 7); ctx.fillStyle = b.used ? "#52646c" : "#fff6c8"; ctx.fill();
        if (!b.used) { ctx.fillStyle = "#04201a"; ctx.font = "900 13px system-ui"; ctx.textAlign = "center"; ctx.fillText("?", b.x, GROUND - 53 + Math.sin(tm * 2.4) * 3); } }
      // the warp gate at the end of the map (it glows and says WARP once the goal is done)
      { const gx = WORLD - 90; if ((NOBOSS ? finished : boss.dead) && gx > camX - 120 && gx < camX + vw + 120) { ctx.save(); ctx.fillStyle = "#fff"; ctx.font = "900 15px system-ui"; ctx.textAlign = "center"; ctx.fillText("WARP ▶", gx, GROUND - 140 + Math.sin(tm * 5) * 4); ctx.restore(); } if (gx > camX - 60 && gx < camX + vw + 60) { ctx.strokeStyle = `rgba(${P.acc},.9)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(gx, GROUND - 60, 26, 62, 0, 0, 7); ctx.stroke(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(${P.acc},${0.18 + 0.1 * Math.sin(tm * 3)})`; ctx.beginPath(); ctx.ellipse(gx, GROUND - 60, 24, 60, 0, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over"; } }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      tile(bake.near, 1.25);
      if (P.survival && !surv.done) { const bw = Math.min(cw * 0.6, 420 * k), bx = (cw - bw) / 2, by = 56 * k; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, 9 * k); ctx.fillStyle = "#ffbe6e"; ctx.fillRect(bx, by, bw * Math.min(1, surv.t / SURV_T), 9 * k); ctx.fillStyle = "#fff"; ctx.font = `800 ${11 * k}px system-ui,sans-serif`; ctx.textAlign = "center"; ctx.fillText(T3(lang, "พลังงาน ", "ENERGY ", "能量 ") + Math.round(Math.min(1, surv.t / SURV_T) * 100) + "% · " + T3(lang, "คลื่น ", "wave ", "波 ") + surv.wave, cw / 2, by - 4 * k); }
      if ((MINE || CAPM || DYS) && !finished) { const bw = Math.min(cw * 0.6, 420 * k), bx = (cw - bw) / 2, by = 56 * k; const cur = stations.find(q => !q.done), fr = MINE || DYS ? cargo / CARGO_CAP : (cur ? cur.p / CAP_T : 1); ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, 9 * k); ctx.fillStyle = MINE || DYS ? "#7fd8ff" : "#ffd23f"; ctx.fillRect(bx, by, bw * Math.min(1, fr), 9 * k); ctx.fillStyle = "#fff"; ctx.font = `800 ${11 * k}px system-ui,sans-serif`; ctx.textAlign = "center";
        ctx.fillText(DYS ? T3(lang, "แร่ ", "ORE ", "矿 ") + cargo + "/" + CARGO_CAP + " · " + T3(lang, PARTS[0] + " ", PARTS[1].toUpperCase() + " ", PARTS[2]) + dframes.filter(q => q.built).length + "/4" : MINE ? T3(lang, "แร่ ", "ORE ", "矿 ") + cargo + "/" + CARGO_CAP + " · " + T3(lang, "ส่งที่แท่นขวาสุด ≥ ", "deliver at the far-right pad ≥ ", "送到最右平台 ≥ ") + ORE_NEED : T3(lang, "สถานี ", "STATION ", "采集站 ") + (stations.filter(q => q.done).length + (cur ? 1 : 0)) + "/3 · " + Math.round(Math.min(1, fr) * 100) + "%", cw / 2, by - 4 * k); }
      if (boss.active && !boss.dead) { const bw = Math.min(cw * 0.6, 420 * k), bx = (cw - bw) / 2, by = 56 * k; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, 9 * k); ctx.fillStyle = "#ff5b7a"; ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.max), 9 * k); ctx.fillStyle = "#fff"; ctx.font = `800 ${11 * k}px system-ui,sans-serif`; ctx.textAlign = "center"; ctx.fillText(T3(lang, P.boss[0], P.boss[1], P.boss[2]), cw / 2, by - 4 * k); }
      // light + vignette (HI()): one baked-free pass, a couple of fills
      if (HI()) { const g = ctx.createRadialGradient(cw / 2, ch * 0.55, ch * 0.3, cw / 2, ch * 0.55, ch * 1.1); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,6,10,.55)"); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); }
      // the robot and its pet are DOM figures placed over the canvas
      const px = pxRef.current; if (px) {
        const cssK = k / dpr, bw = 80 * cssK, bh = 128 * cssK;
        px.style.width = bw + "px"; px.style.height = bh + "px";
        const flick = pl.inv > 0 && Math.floor(tm * 20) % 2 === 0 ? 0.35 : 1;
        px.style.opacity = pl.dead > 0 ? "0.25" : String(flick);
        // which frame: a strike in progress, else air, else the walk or run cycle (stepped by distance covered), else standing
        const moving = pl.ground && (keys.current.l || keys.current.r) && Math.abs(pl.x - heroLastX) > 0.05;
        if (pl.ground) heroDist += Math.abs(pl.x - heroLastX); heroLastX = pl.x;
        const act = poseAct.current; let want = "ready";
        if (pl.dead > 0) want = "down";
        else if (act.name === "attack") want = ["jab", "hook", "upper"][act.n % 3];
        else if (act.name === "kick") want = ["front", "round", "sweep"][act.n % 3];
        else if (act.name !== "ready") want = act.name;
        else if (!pl.ground) want = "jump";
        else if (moving) want = (pl.holdT > 0.35 ? "run" : "walk") + (Math.floor(heroDist / STRIDE_PX) % WALK_N);
        const fig = FIGURES_OK ? figureOf(advBotKey(me, colorway, want)) : null, hs = heroSvgRef.current, hi = heroImgRef.current, base = px.firstElementChild as HTMLElement | null;
        if (fig && hs && hi && base) {
          if (hi.getAttribute("href") !== fig.url) { const [rx, ry, rw, rh] = fig.reg; hi.setAttribute("href", fig.url); hi.setAttribute("x", String(rx)); hi.setAttribute("y", String(ry)); hi.setAttribute("width", String(rw)); hi.setAttribute("height", String(rh)); }
          if (hs.style.display !== "block") { hs.style.display = "block"; base.style.display = "none"; }
        } else if (hs && base && hs.style.display !== "none") { hs.style.display = "none"; base.style.display = ""; }
        const stepBob = moving ? Math.abs(Math.sin((heroDist / STRIDE_PX) * Math.PI / 4 * 2)) * 2.2 * cssK : 0;
        const we = wpnRef.current; if (we) {   // the weapon in the hero's hands
          const wid = LOAD.gun; if (we.dataset.w !== wid) { we.dataset.w = wid; we.innerHTML = WPN_SVG[wid] || WPN_SVG.pulse; }
          const sw = pl.swing > 0 ? 1 - Math.min(1, pl.swing / 0.3) : 0;
          we.style.transform = wid === "sword" ? `rotate(${pl.swing > 0 ? -70 + sw * 150 : -52}deg)` : `rotate(${pl.swing > 0 ? -6 : 12}deg) translateX(${pl.swing > 0 ? -3 : 0}px)`;
        }
        { // first-person view: hide the hero, zoom the world in on the hero's eyes, show the hands, the reticle and a red flash when hit
          const fp = fpvRef.current, wd = worldRef.current; px.style.visibility = fp ? "hidden" : "";
          if (wd) {
            if (fp) { const Z = 1.38, ox = (pl.x - camX) * cssK, oy = (GROUND - pl.y * 0.6 - 46) * cssK, bobY = moving ? Math.abs(Math.sin((heroDist / STRIDE_PX) * Math.PI / 4 * 2)) * 4 * cssK : Math.sin(tm * 1.6) * 0.8 * cssK;
              wd.style.transformOrigin = ox + "px " + oy + "px"; wd.style.transform = `translateY(${bobY}px) scale(${Z})`;
              const xh = fpvXhRef.current; if (xh) xh.style.transform = `translate(${ox + pl.face * 120 * cssK * Z}px,${oy}px)`;
              const hd = fpvHandsRef.current; if (hd) {
                const wid = LOAD.gun, wp = fpvWpnRef.current, rig = fpvRigRef.current, fl = fpvFlashRef.current; if (wp && wp.dataset.w !== wid) { wp.dataset.w = wid; wp.innerHTML = WPN_SVG[wid] || WPN_SVG.pulse; }
                hd.classList.toggle("lf", pl.face < 0);
                const rc = pl.swing > 0 ? Math.min(1, pl.swing / 0.2) : 0, wb = moving ? Math.sin((heroDist / STRIDE_PX) * Math.PI / 4 * 2) : Math.sin(tm * 1.6) * 0.5;
                if (rig) rig.style.transform = wid === "sword" ? `translate(${wb * 5}px,${Math.abs(wb) * 7}px) rotate(${pl.swing > 0 ? -55 + (1 - Math.min(1, pl.swing / 0.3)) * 120 : -6}deg)` : `translate(${wb * 5 - rc * 12}px,${Math.abs(wb) * 7 + rc * 16}px) rotate(${-rc * 6}deg)`;
                if (fl) fl.classList.toggle("on", rc > 0.55 && wid !== "sword");
              }
              const he = fpvHurtRef.current; if (he && pl.hp < fpvLastHp - 0.5) { he.classList.add("on"); setTimeout(() => { try { he.classList.remove("on"); } catch (e) {} }, 170); }
              fpvLastHp = pl.hp;
            } else if (wd.style.transform) { wd.style.transform = ""; fpvLastHp = pl.hp; }
          }
        }
        px.style.transform = `translate(${(pl.x - camX) * cssK - bw / 2}px,${(GROUND - pl.y) * cssK - bh + 6 * cssK - stepBob}px) scaleX(${pl.face >= 0 ? 1 : -1})`;
      }
      const pe = petRef.current; if (pe) {
        const cssK = k / dpr, pw = 52 * cssK, bobY = Math.abs(Math.sin(tm * 6)) * 4 * cssK * (keys.current.l || keys.current.r ? 1 : 0.2);
        const ptx = pl.x - pl.face * 56; pe.style.width = pw + "px"; pe.style.height = pw + "px";
        pe.style.transform = `translate(${(ptx - camX) * cssK - pw / 2}px,${(GROUND) * cssK - pw + 4 * cssK - bobY}px) scaleX(${pl.face > 0 ? 1 : -1})`;
      }
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop); frames++;
      let dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (hitStop > 0) { hitStop -= dt; dt = 0; }
      acc += dt; let n = 0;
      while (acc >= step && n < 4) { sim(step); acc -= step; n++; }
      if (n > 0 || dt === 0) { const t0 = performance.now(); draw(time); drawMs += performance.now() - t0; drawN++; }
      hudT += dt;
      if (hudT > 0.15) {
        hudT = 0; const sr = skillOf();
        setHud({ hp: Math.max(0, pl.hp), hpMax: hpMaxOf(info.lv), lv: info.lv, xp: info.max ? 1 : info.into, xpNeed: info.max ? 1 : info.need, sk: sr.max ? 1 : sr.into, skNeed: sr.max ? 1 : sr.need, rank: sr.rank, kills, team: net ? (WAR ? (myTeam === 0 ? "🔴 " : "🔵 ") + warScore[myTeam] + "–" + warScore[1 - myTeam] : (teamDone ? "✓" : kills + "/" + teamGoal())) : null, cry: crystals, skCd: Math.max(0, pl.sklCd), sl: slots.map((q, i) => ({ n: T3(lang, q.s.n.th, q.s.n.en, q.s.n.zh), cd: Math.max(0, slotCd[i]) })), lootCoins: Math.round(lootValue() * RW), team: net ? [...net.peers.values()].map(q => ({ n: q.name, hp: q.hp || 0, c: q.glow })) : null, dashCd: Math.max(0, pl.dashCd), rockCd: Math.max(0, pl.rockCd), spell: Math.round(spellG) });
      }
    };
    raf = requestAnimationFrame(loop);

    // keyboard (desktop)
    const kd = (e, v) => {
      const kk = keys.current; const c = e.code;
      if (c === "ArrowLeft" || c === "KeyA") kk.l = v; else if (c === "ArrowRight" || c === "KeyD") kk.r = v;
      else if (c === "ArrowUp" || c === "KeyW" || c === "Space") kk.jump = v; else if (c === "KeyJ" || c === "KeyZ") kk.atk = v; else if (c === "KeyK" || c === "KeyX") kk.skl = v; else if (c === "KeyV") kk.dig = v; else if (c === "KeyH") kk.s2 = v; else if (c === "KeyG") kk.s3 = v; else if (c === "KeyY") kk.rocket = v; else if (c === "KeyB") kk.zap = v; else if (c === "KeyO") kk.spell = v; else if (c === "KeyI") kk.fire = v; else if (c === "KeyU") kk.kick = v; else if (c === "KeyL" || c === "ShiftLeft" || c === "ShiftRight") kk.dash = v; else return;
      e.preventDefault();
    };
    const dn = (e) => kd(e, true), up = (e) => kd(e, false);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    (window as any).__advTest = { netPeers: () => (net ? [...net.peers.values()].map(q => ({ id: q.id, x: q.x })) : null), padX: () => PAD_X, digNow: () => digMove(), framesBuilt: () => dframes.map(f => f.built), frameXs: () => dframes.map(f => f.x), nodeXs: () => nodes.filter(n => !n.done).map(n => n.x), cargoN: () => cargo, slotsN: () => slots.length, slotNames: () => slots.map(q => q.s.id), pass: () => PASS, castId: (id: string) => { const q = [...["striker", "bulwark", "ghost", "tactician", "engineer", "herald", "virtuoso"].flatMap(c => treeOf("robot", c)), ...["volt", "ember", "frost", "flora", "steel", "aether"].flatMap(c => treeOf("pet", c))].find(z => z.id === id); if (q) castSkill(q, lvOf(q.id), q.kind === "pet"); return !!q; }, castSlotNow: (i: number) => castSlot(i), slotCds: () => slotCd.slice(), hasteT: () => buff.haste, shieldLeft: () => shieldT, turretsN: () => turrets.length, setHp: (v: number) => { pl.hp = v; }, hpNow: () => pl.hp, monsSlowed: () => mons.filter(m => m.slowT > 0).length, beacons: () => beacons.map(b => b.x), state: () => ({ kills, x: pl.x, hp: pl.hp, lv: info.lv, mons: mons.filter(m => !m.dead).length }), tp: (x) => { pl.x = x; pl.face = 1; }, dropHere: (tt) => drops.push({ x: pl.x, y: 10, vy: 0, t: tt }), loot: () => ({ ...loot, value: lootValue() }), settleNow: (r) => settle(r), smokeN: () => smoke.length, blastsN: () => blasts.length,  clearShown: () => !!document.querySelector(".adv-clear"), cargo: () => cargo, setCargo: (n) => { cargo = n; }, nodesLeft: () => nodes.filter(n => !n.done).length, stations: () => stations.map(q => ({ p: q.p, done: q.done })), capSkip: (sec) => { const c = stations.find(q => !q.done); if (c) c.p += sec; }, launched: () => launched > 0, load: () => LOAD, equipNow: (id: string) => equipWeapon(id), fireNow: () => fireBolt(), fireCdClear: () => { pl.fireCd = 0; }, beamsN: () => beams.length, rocketNow: () => fireRocket(), zapNow: () => zapBolt(), greeted: () => beacons.filter((b: any) => b.greet).length, beaconsN: () => beacons.length, killMe: () => { pl.inv = 0; hurtPlayer(99999, pl.x - 1); }, warInfo: () => ({ war: WAR, team: myTeam }), face: (f: number) => { pl.face = f; }, drawAvg: () => (drawN ? drawMs / drawN : 0), teamInfo: () => ({ goal: teamGoal(), done: teamDone }), reviveState: () => ({ dead: pl.dead, revived, hp: pl.hp }), peerDown: (id: string) => { const q = net && net.peers.get(id); if (q) { q.hp = 0; q.x = pl.x + 20; } }, forceKills: (n: number) => { kills = n; teamCheck(); }, zapsN: () => zapN, rocketsN: () => rocketN, rocketsLive: () => rockets.length, firesLive: () => fires.length, arcsLive: () => arcs.length, boltsPierce: () => bolts.filter(b => b.pierce).length, hazards: () => ({ zones: HZ, hits: hzHits, on: hzOn() }), setBossHp: (f) => { boss.hp = Math.round(boss.max * f); boss.active = true; }, boss2: () => ({ raged: !!boss.raged }), looks: () => ({ boltStyle: BOLT_STYLE, novaStyle: NOVA_STYLE, glow: rGlow, petType, voice: { p: +rv.p.toFixed(2), sig: rv.sig } }), speed: () => ({ holdT: pl.holdT || 0 }), shotsFired: () => firedN,  music: () => (mus ? mus.info() : null), renderMusic: (id, boss, inten = 1, bars = 4, startBar = 0) => renderPreview(id, bars, !!boss, inten, startBar), spellG: () => spellG, setSpell: (n) => { spellG = n; }, fireNow: () => fireBolt(), kickNow: () => kickMove(), bolts: () => bolts.length, monHp: () => mons.filter(m => !m.dead).reduce((a, m) => a + m.hp, 0), monX: () => { const m = mons.find(q => !q.dead); return m ? m.x : -1; }, types: () => [...new Set(mons.map(m => m.type))], surv: () => ({ t: surv.t, wave: surv.wave, done: surv.done, mons: mons.length }), skip: (s) => { surv.t += s; }, pl: () => ({ inv: pl.inv, x: pl.x, dashCd: pl.dashCd, maxCombo: pl.maxCombo }), gaps: () => teleGaps.slice(), strikeNow: () => attack(), boss: () => ({ active: boss.active, dead: boss.dead, hp: boss.hp, x: boss.x }), hitBoss: (v) => { boss.active = true; hurtBoss(v, false, 0); }, crystals: () => crystals, gainCry: (n) => gainCry(n), hpMax: () => hpMaxOf(info.lv), diffHp: () => HM,  drops: () => drops.length, fps: () => 0 };
    return () => { settle(0.4); if (mus) mus.stop(); musicRef.current = null; sfx.close(); sfxRef.current = null; if (!ended) { ended = true; const secs = (performance.now() - t0) / 1000; if (secs > 3) { logUsage("adv", "end:" + P.id + ":" + Math.round(secs) + "s:k" + kills + ":x" + Math.round(pl.x / 100) * 100, secs * 1000); if (secs > 8) logUsage("adv", "perf:" + P.id + ":" + (HI() ? "hd" : "sd") + ":" + Math.round(frames / secs) + "fps"); } } cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); try { delete (window as any).__advTest; } catch (e) {} };
  }, [P, me, cls]);

  const [gear, setGear] = useState(false), pausedRef = useRef(false);   // the gear pop-up pauses this run
  const openGear = () => { const k: any = keys.current; k.l = k.r = k.atk = k.skl = k.jump = k.fire = k.kick = k.rocket = k.zap = k.dig = false; pausedRef.current = true; setGear(true); playUi && playUi("click"); };
  const closeGear = () => { pausedRef.current = false; setGear(false); };
  useEffect(() => { const kd = (e: KeyboardEvent) => { if (e.code === "Escape" || e.code === "KeyP") { if (pausedRef.current) { pausedRef.current = false; setGear(false); } else if (!quizOn.current) openGear(); } }; window.addEventListener("keydown", kd); return () => window.removeEventListener("keydown", kd); }, []);
  const hold = (name) => ({
    onPointerDown: (e) => { e.preventDefault(); (keys.current as any)[name] = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} },
    onPointerUp: () => { (keys.current as any)[name] = false; }, onPointerCancel: () => { (keys.current as any)[name] = false; }, onLostPointerCapture: () => { (keys.current as any)[name] = false; },
  });
  const pct = (a, b) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100)) + "%";
  return (
    <>
      <div ref={worldRef} className="adv-world">
      <canvas ref={cvRef} />
      <div ref={petRef} className="adv-px" aria-hidden="true">{petNow ? (() => { const live = <PetArt species={petNow.species} level={petLevel(petNow.bond).lv} mood={petNow.mood} />; return FIGURES_OK ? <FigurePic fkey={petKeyOf()} kind="pet" el={live} cls="fig-pet" vb="-12 -18 144 156" /> : live; })() : null}</div>
      <div ref={pxRef} className="adv-px" aria-hidden="true">
        {(() => {   // profiled 2026-10-11: the live SVG robot cost half the frame on a slow CPU; a stored picture per pose costs almost nothing (same cache PvP uses on phones)
          const live = <CyberAvatar model={me} yaw={26} pose={pose} glow={colorway && colorway.glow} accent={colorway && colorway.accent} held={null} hat={null} acc={null} />;
          return FIGURES_OK ? <FigurePic fkey={botKey(pose)} kind="bot" el={live} cls="ca" vb="-20 -16 160 416" /> : live;
        })()}
        <svg ref={heroSvgRef} className="ca" viewBox="-20 -16 160 416" overflow="visible" aria-hidden="true" style={{ display: "none" }}><image ref={heroImgRef} preserveAspectRatio="none" /></svg>
        <div ref={wpnRef} className="adv-wpn" aria-hidden="true" />
      </div>
      </div>
      {fpv && <><FpvVisor /><FpvHurt hurtRef={fpvHurtRef} /><FpvCrosshair xhRef={fpvXhRef} /><FpvHands handsRef={fpvHandsRef} rigRef={fpvRigRef} wpnRef={fpvWpnRef} flashRef={fpvFlashRef} /></>}
      <div className="adv-top">
        <button className="adv-btn" onClick={() => { playUi && playUi("click"); onExit(); }} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">Lv {hud.lv} · {P.en.split(" · ")[0]} · ☠ {hud.kills}{hud.team ? " · 🤝 " + hud.team : ""} · ◆ {hud.cry || 0} · 🪙 {hud.lootCoins || 0}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct(hud.hp, hud.hpMax) }} /><b>HP {Math.round(hud.hp)} / {hud.hpMax}</b></div>
          <div className="adv-bar adv-xp"><i style={{ width: pct(hud.xp, hud.xpNeed) }} /><b>EXP</b></div>
          <div className="adv-bar adv-sk"><i style={{ width: pct(hud.sk, hud.skNeed) }} /><b>{t("สกิล", "SKILL", "技能")} R{hud.rank || 1}</b></div>
        </div>
        <div className="fpv-tr"><FpvButton lang={lang} on={fpv} onClick={flipFpv} /><GearButton onClick={openGear} /></div>
      </div>
      {gear && <SettingsPopup lang={lang} high={high} onGfx={onGfx} musicOn={musicOn} onMusic={() => setMusicOn(m => !m)} online={!!net} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
      {net && <div className="adv-emotes">{["👍", "⚔️", "🆘", "❤️"].map(em => <button key={em} aria-label={"emote " + em} onClick={() => chatRef.current && chatRef.current(em)}>{em}</button>)}</div>}
      {net && hud.team && hud.team.length > 0 && <div className="adv-team">{hud.team.map((q: any, i: number) => <span key={i} style={{ borderColor: q.c || "#7fe8ff" }}>{q.n} · {q.hp}♥</span>)}</div>}
      {banner && <div key={banner.k} className="adv-banner"><b>{banner.a}</b><span>{banner.b}</span></div>}
      {clear && <div className="adv-clear" role="dialog" aria-label="map clear">
        <b>✓ {t("ผ่านแมปแล้ว!", "MAP CLEAR!", "地图通关！")}</b>
        <small>☠ {clear.kills} · ◆ {clear.cry}</small>
        {clear.coins > 0 && <small className="ac-coins">🪙 +{clear.coins} {t("ขายของที่เก็บได้แล้ว — ไปใช้ในร้านค้าได้", "loot sold — spend it in the shop", "战利品已出售——可在商店消费")}</small>}
        {clear.capped && <small>{t("ถึงเพดานเหรียญประจำวันแล้ว", "Daily coin ceiling reached", "已达今日金币上限")}</small>}
        {clear.next ? <button className="adv-btn go" autoFocus onClick={() => { if (onNext) onNext(clear.next); }}>▶ {t("แมปต่อไป: ", "Next map: ", "下一张：")}{T3(lang, clear.next.th, clear.next.en, clear.next.zh).split(" · ")[0]} ({Math.max(0, auto)})</button> : <small>{t("ครบทุกแมปที่เปิดอยู่แล้ว", "That was the last open map", "已是当前最后一张开放地图")}</small>}
        <button className="adv-btn" onClick={() => { setClear((c: any) => (c ? { ...c, next: null } : c)); setAuto(99); }}>{clear.next ? t("อยู่ต่อ", "Stay here", "留在此处") : t("ปิด", "Close", "关闭")}</button>
        <button className="adv-btn" onClick={() => { playUi && playUi("click"); onExit(); }}>{t("เมนูแผนที่", "Map menu", "地图菜单")}</button>
      </div>}
      {down && <div className="adv-banner" style={{ animation: "none" }}><b style={{ color: "#ff8fa3" }}>{t("ล้ม!", "DOWN!", "倒下了！")}</b><span>{t("กำลังกลับจุดเริ่ม…", "Back to the start…", "回到起点…")}</span></div>}
      {quiz && <QuizGate key={gateKeyOf(quiz)} quiz={quiz} lang={lang} onKey={(pc, name) => {
        const cur = quiz; if (cur.res) return; const q = cur.qs[cur.i].q;
        if (q.kind === "key") answerQuiz(judgeKeys(q, [pc]));
        else { const has = cur.sel.some((x) => x.pc === pc); setQuiz({ ...cur, sel: has ? cur.sel.filter((x) => x.pc !== pc) : [...cur.sel, { pc, name }] }); }
      }} onConfirm={() => { const cur = quiz; const q = cur.qs[cur.i].q; answerQuiz(judgeKeys(q, cur.sel.map((x) => x.pc))); }}
        onChoice={(ok) => answerQuiz(ok)} onNext={nextQuiz} onSkip={() => finishQuiz(quiz)} />}
      {/* the same buttons as PvP: ◀ ▶ on the left (+ dash); shoot, jump, punch, kick and the class skill on the right */}
      <div className="adv-pad">
        <div className="pvppad-l">
          <button className="pvpdir" aria-label="left" {...hold("l")}>◀</button>
          <button className="pvpdir" aria-label="right" {...hold("r")}>▶</button>
        </div>
        <div className="pvppad-r">
          <button className="pvpact fire" aria-label="shoot" {...hold("fire")}><b>🔫</b><i>{t("ยิง", "FIRE", "射击")}</i></button>
          <button className="pvpact jump" aria-label="jump" {...hold("jump")}><b>⤴</b><i>{t("กระโดด", "JUMP", "跳跃")}</i></button>
          <button className="pvpact punch" aria-label="attack" {...hold("atk")}><b>👊</b><i>{t("ต่อย", "PUNCH", "拳击")}</i></button>
          {DIGBTN && <button className={"pvpact dig"} aria-label="dig" data-dig="1" {...hold("dig")}><b>⛏</b><i>{t("ขุด", "DIG", "挖掘")}</i></button>}
          <button className={"pvpact rocket" + (hud.rockCd > 0 ? " cool" : "")} aria-label="rocket" {...hold("rocket")}><b>🚀</b><i>{t("จรวด", "ROCKET", "火箭")}</i></button>
          <button className="pvpact zap" aria-label="lightning" {...hold("zap")}><b>⚡</b><i>{t("สายฟ้า", "BOLT", "闪电")}</i></button>
          <button className="pvpact kick" aria-label="kick" {...hold("kick")}><b>🦵</b><i>{t("เตะ", "KICK", "踢击")}</i></button>
          {[0, 1, 2].map(i => (hud.sl && hud.sl[i]) ? <button key={i} className={"pvpact ult" + (hud.sl[i].cd > 0 ? " cool" : "")} aria-label={"skill" + (i + 1)} data-slot={i} {...hold(i === 0 ? "skl" : i === 1 ? "s2" : "s3")}><b>✦{i + 1}</b><i>{hud.sl[i].n}</i></button> : null)}
          <button className={"pvpact spell" + ((hud.spell || 0) >= 100 ? " ready" : " cool")} aria-label="spell" style={{ "--sp": (hud.spell || 0) + "%" } as any} {...hold("spell")}><b>🎹</b><i>{(hud.spell || 0) >= 100 ? t("เวทย์คอร์ด", "SPELL", "和弦术") : (hud.spell || 0) + "%"}</i></button>
        </div>
      </div>
    </>
  );
});

/** The question card: choice buttons or a piano to tap; a wrong answer shows the right notes lit on the keys and why. */

/* HANDS OFF (owner, 2026-10-12, as in the PvP knowledge break): before any question a card covers the screen, so a thumb still on the pad hits the card and not an
   answer; its button stays dead for a moment, then the learner says they are ready. */
const GATE_ARM = 900; const gateIds = new WeakMap<object, number>(); let gateN = 0;
const gateKeyOf = (q: any) => { const o = (q && q.qs && q.qs[0]) || q; if (!o) return 0; if (!gateIds.has(o)) gateIds.set(o, ++gateN); return gateIds.get(o); };
function QuizGate(props: any) {
  const [ready, setReady] = useState(false), [armed, setArmed] = useState(false); const lang = props.lang;
  useEffect(() => { const id = setTimeout(() => setArmed(true), GATE_ARM); return () => clearTimeout(id); }, []);
  const t = (th: string, en: string, zh: string) => T3(lang, th, en, zh);
  let skip = false; try { skip = localStorage.getItem("tg_adv_nogate") === "1"; } catch (e) {}   // the older bots answer straight away; only the gate test leaves this off
  if (skip || ready || props.quiz.res || (props.quiz.i || 0) > 0) return <QuizCard {...props} />;
  return (
    <div className="adv-quiz" data-handsoff="1" style={{ alignItems: "center" }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="pvpstandby-card">
        <span className="pvpstandby-ic" aria-hidden="true">✋</span>
        <em>{t("ช่วงคำถาม", "KNOWLEDGE BREAK", "知识时刻")}</em>
        <b>{t("ยกมือออกจากปุ่มก่อน", "HANDS OFF", "先放开手")}</b>
        <p>{t("ปล่อยปุ่มควบคุมทุกปุ่ม หายใจสักครั้ง แล้วค่อยกดพร้อม จะได้ไม่กดคำตอบมั่ว", "Let go of every control, take a breath, then start when you are ready, so no answer is pressed by accident.", "松开所有按键，喘口气，准备好再开始，以免误触答案。")}</p>
        <button type="button" className={"pvpstandby-go" + (armed ? " on" : "")} data-ready="1" disabled={!armed} onClick={() => setReady(true)} style={{ ["--arm" as any]: GATE_ARM + "ms" }}>
          <span>{armed ? t("พร้อมแล้ว", "I'M READY", "我准备好了") : t("เตรียมตัว…", "GET READY…", "准备中…")}</span>
        </button>
      </div>
    </div>
  );
}
function QuizCard({ quiz, lang, onKey, onConfirm, onChoice, onNext, onSkip }: any) {
  const item = quiz.qs[quiz.i], q = item.q;
  const t = (th, en, zh) => T3(lang, th, en, zh);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [quiz.i]);
  const lit = quiz.res ? (quiz.res === "bad" || q.kind !== "choice" ? q.teach.lit : []) : quiz.sel.map((x) => x.name + "");
  const learnedNames = (quiz.learned || []).map((x) => ({ scale: t("สเกล", "Scales", "音阶"), triad: t("คอร์ด", "Chords", "和弦"), interval: t("ช่วงเสียง", "Intervals", "音程"), seventh: t("คอร์ด 7", "7th chords", "七和弦") }[x] || x)).join(" · ");
  return (
    <div className="adv-quiz" role="dialog" aria-modal="true">
      <div className="adv-qcard">
        <div className="adv-qhead">
          <span>📡 {t("ทบทวนความรู้", "KNOWLEDGE BEACON", "知识信标")} {quiz.i + 1}/{quiz.qs.length}</span>
          <i>Lv {q.tier}</i>
        </div>
        {quiz.i === 0 && <div style={{ fontSize: 11.5, color: "#9fd8cc" }}>{learnedNames ? t("คำถามมาจากสิ่งที่คุณเรียนแล้ว: ", "Asked from what you have studied: ", "题目来自你学过的内容：") + learnedNames : t("ยังไม่ได้เรียนหัวข้อไหน — ลองเรียนใน Pathway แล้วกลับมา คำถามจะยากขึ้น", "Nothing studied yet — learn in Pathway and the questions will grow with you.", "还没学过内容——去 Pathway 学习后题目会更丰富。")}</div>}
        <div className="adv-qq">{q.q}</div>
        {q.kind === "choice" && (
          <div className="adv-qopts">{q.opts.map((o, i) => (
            <button key={i} className={"adv-qopt" + (quiz.res ? (o.ok ? " ok" : picked === i ? " no" : "") : "")} disabled={!!quiz.res} onClick={() => { setPicked(i); onChoice(o.ok); }}>{o.label}</button>
          ))}</div>
        )}
        {(q.kind !== "choice" || (quiz.res === "bad")) && (
          <div className="adv-qpiano"><Piano litSet={lit} small onNote={(n) => { const m = /^([A-G]#?)/.exec(String(n)); if (!m) return; const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; const pc = names.indexOf(m[1]); if (pc >= 0 && !quiz.res && q.kind !== "choice") onKey(pc, m[1] + "4"); }} /></div>
        )}
        {q.kind === "keys" && !quiz.res && <button className="adv-qgo" disabled={quiz.sel.length === 0} onClick={onConfirm}>{t("ยืนยัน", "Confirm", "确认")} ({quiz.sel.length})</button>}
        {quiz.res && (
          <div className={"adv-qres " + quiz.res}>
            <b>{quiz.res === "good" ? t("ถูกต้อง! ✓", "Correct! ✓", "答对了！✓") : t("ยังไม่ใช่ — ดูคีย์ที่เรืองแสงบนเปียโน", "Not quite — see the lit keys on the piano", "不对——看琴键上亮起的音")}</b>
            {q.teach.why}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {quiz.res && <button className="adv-qgo" style={{ flex: 1 }} onClick={onNext}>{quiz.i >= quiz.qs.length - 1 ? t("จบการทบทวน", "Finish", "完成") : t("ข้อต่อไป", "Next", "下一题")}</button>}
          {!quiz.res && <button className="adv-qopt" style={{ flex: "0 0 auto" }} onClick={onSkip}>{t("ข้าม", "Skip", "跳过")}</button>}
        </div>
      </div>
    </div>
  );
}
