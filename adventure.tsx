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
import { useEffect, useRef, useState, useMemo, memo } from "react";
import { CyberAvatar } from "./cyber-avatar";
import { PetArt, petLevel } from "./pet-lab";
import { addRpgExp, rpgOf, rpgMods, RPG_MAX_LV } from "./pvp-rpg";
import { addSkillSp, readSkillSp, skillRank, enterFs, exitFsAndUnlock } from "./pvp-arena";
import { classKeyOf } from "./model-skills";
import { isLowEnd, spaceTier } from "./space-stage";
import { Piano } from "./music-engine";
import { logUsage, dayKey } from "./shared-infra";
import { createAdvMusic, renderPreview } from "./adventure-music";
import { recordMemory } from "./ai-chat-context";
import { nextQuestion, nextSpell, judgeKeys, recordAnswer, readLadder, learnedTopics } from "./quiz-quest";

const VH = 360, GROUND = 300, WORLD = 5200, TILE = 960;
const readDone = (): string[] => { try { const v = JSON.parse(localStorage.getItem("tg_adv_done") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const markDone = (id: string) => { try { const d = readDone(); if (!d.includes(id)) { d.push(id); localStorage.setItem("tg_adv_done", JSON.stringify(d)); } } catch (e) {} };
const readCrystals = (): number => { try { return Math.max(0, parseInt(localStorage.getItem("tg_adv_crystals") || "0", 10) || 0); } catch (e) { return 0; } };
const addCrystals = (n: number) => { try { localStorage.setItem("tg_adv_crystals", String(readCrystals() + n)); } catch (e) {} };
/* ── phase 3.2: crystal upgrades, daily quests, difficulty ──
   Crystals come from playing only and are never for sale. Each of the three lines has 5 levels at +5 % each, so the ceiling is a fixed +25 %. */
export const UP_LINES = ["atk", "hp", "skl"] as const;
export const UP_MAX = 5;
export const upCost = (lv: number) => 12 * Math.pow(2, lv);   // 12, 24, 48, 96, 192
export const readUps = (): any => { try { const v = JSON.parse(localStorage.getItem("tg_adv_up") || "{}") || {}; const o: any = {}; for (const k of UP_LINES) o[k] = Math.max(0, Math.min(UP_MAX, v[k] | 0)); return o; } catch (e) { return { atk: 0, hp: 0, skl: 0 }; } };
export function buyUp(line: string): boolean {
  const u = readUps(); if (!(UP_LINES as readonly string[]).includes(line) || u[line] >= UP_MAX) return false;
  const c = upCost(u[line]); if (readCrystals() < c) return false;
  try { localStorage.setItem("tg_adv_crystals", String(readCrystals() - c)); u[line]++; localStorage.setItem("tg_adv_up", JSON.stringify(u)); return true; } catch (e) { return false; }
}
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
let TINT: any = null;   // the planet's monster palette (null = Luma's own)
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* the five planets (only the first is playable in this phase) */
export const PLANETS = [
  { id: "luma",   th: "ลูมา · ดาวป่าเรืองแสง",   en: "Luma · the glowing jungle", zh: "卢玛 · 荧光丛林",   c: ["#04131c", "#0a3a3a", "#1c8a6a"], glow: "90,255,200", acc: "255,120,220", ok: true, hard: 1, mons: ["glowbug", "glowbug", "thornback", "sporecaster", "glowbug", "thornback", "sporecaster", "glowbug", "thornback", "sporecaster"], tint: null, boss: ["ผู้พิทักษ์ลูมา", "Luma Warden", "卢玛守卫"] },
  { id: "ferro",  th: "เฟอร์โร · ทะเลทรายเหล็ก",  en: "Ferro · the iron desert",   zh: "费罗 · 钢铁沙漠",   c: ["#1a0d05", "#4a2410", "#b8672c"], glow: "255,170,90", acc: "255,90,60",  ok: true, req: "luma", hard: 1.7, mons: ["rustcrawler", "rustcrawler", "magnet", "thornback", "rustcrawler", "magnet", "glowbug", "magnet"], tint: { glow: "255,150,70", body: "#4a2410" }, boss: ["ผู้พิทักษ์เหล็ก", "Iron Warden", "钢铁守卫"] },
  { id: "jovia",  th: "โจเวีย · ดาวแก๊สยักษ์ (เก็บพลังงาน)", en: "Jovia · the gas giant (energy harvest)", zh: "朱维亚 · 气态巨行星（采集能量）", c: ["#0d0a2a", "#3a2a7a", "#c98a4a"], glow: "255,190,110", acc: "255,120,90", ok: true, req: "ferro", hard: 1.9, survival: true, mons: ["rustcrawler", "shardling", "glowbug", "magnet", "shardling"], tint: { glow: "255,190,110", body: "#3a2a1a" }, boss: ["-", "-", "-"] },
  { id: "kryo",   th: "ไครโอ · ดาวน้ำแข็งคริสตัล", en: "Kryo · the crystal ice",    zh: "克里奥 · 水晶冰原", c: ["#061427", "#123a63", "#6fc4ff"], glow: "150,225,255", acc: "120,160,255", ok: true, req: "ferro", hard: 2.4, mons: ["shardling", "shardling", "frostcaster", "thornback", "frostcaster", "shardling", "thornback"], tint: { glow: "150,225,255", body: "#12304a" }, boss: ["ผู้พิทักษ์น้ำแข็ง", "Frost Warden", "冰霜守卫"] },
  { id: "pyra",   th: "ไพรา · เตาปฏิกรณ์ลาวา",    en: "Pyra · the lava reactor",   zh: "派拉 · 熔岩反应堆", c: ["#1c0606", "#5a1408", "#ff6a2a"], glow: "255,120,50", acc: "255,200,60",  ok: false },
  { id: "nexa",   th: "เน็กซา · เมืองซากอวกาศ",   en: "Nexa · the wreck city",     zh: "内克萨 · 残骸之城", c: ["#0a0518", "#2a1250", "#9a5cff"], glow: "190,150,255", acc: "63,240,208",  ok: false },
];

/* ── monsters ── */
const MON = {
  glowbug:     { hp: 34, dmg: 9,  speed: 70,  exp: 12, w: 46, h: 34, cd: 1100, name: ["กลอว์บัก", "Glowbug", "荧虫"] },
  thornback:   { hp: 96, dmg: 15, speed: 38,  exp: 30, w: 78, h: 44, cd: 1500, name: ["ธอร์นแบ็ก", "Thornback", "刺背兽"] },
  rustcrawler: { hp: 40, dmg: 11, speed: 96, exp: 16, w: 50, h: 28, cd: 900,  name: ["สนิมคลาน", "Rustcrawler", "锈爬虫"] },
  magnet:      { hp: 80, dmg: 14, speed: 0,  exp: 28, w: 40, h: 80, cd: 1900, name: ["เสาแม่เหล็ก", "Magnet Pylon", "磁力塔"], ranged: true },
  shardling:   { hp: 46, dmg: 10, speed: 62, exp: 18, w: 44, h: 40, cd: 1000, name: ["เศษคริสตัล", "Shardling", "晶碎兽"] },
  frostcaster: { hp: 56, dmg: 12, speed: 26, exp: 28, w: 46, h: 62, cd: 2000, name: ["ผู้เรียกน้ำแข็ง", "Frostcaster", "霜术士"], ranged: true },
  sporecaster: { hp: 52, dmg: 11, speed: 30,  exp: 26, w: 52, h: 60, cd: 2200, name: ["สปอร์คาสเตอร์", "Sporecaster", "孢子术士"], ranged: true },
};

/* ── painting helpers ── */
function layer(w, h, fn) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); const x = c.getContext("2d"); fn(x, c.width, c.height); return c; }
function glowSprite(rgb, r) { return layer(r * 2, r * 2, (x, w, h) => { const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, `rgba(${rgb},0.9)`); g.addColorStop(0.35, `rgba(${rgb},0.3)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }

/** All of the planet's backdrop, baked once for this canvas size. Layers are tiles that repeat sideways. */
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
  const body = hit ? "#ffffff" : TINT ? TINT.body : m.type === "glowbug" ? "#0e5a4a" : m.type === "thornback" ? "#3a1030" : "#2a1a66";
  const glow = TINT ? TINT.glow : m.type === "glowbug" ? "90,255,200" : m.type === "thornback" ? "255,70,90" : "190,130,255";
  if (m.type === "rustcrawler") {
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
function drawBoss(x, b, t, P) {
  const bob = Math.sin(t * 2) * 3, y = GROUND - 8 + bob, hit = b.hurt > 0, warn = b.tele > 0;
  x.save(); x.translate(b.x, 0); x.scale(b.face < 0 ? -1 : 1, 1);
  const lift = b.state === "slam" && b.tele > 0 ? -22 * Math.min(1, (0.6 - b.tele) * 3) : 0;
  x.fillStyle = "#06090d"; for (let i = 0; i < 4; i++) { const lx = -52 + i * 34; x.fillRect(lx, y - 20, 16, 22); }
  x.fillStyle = hit ? "#fff" : warn ? "#7a2030" : "#1c2230";
  x.beginPath(); x.moveTo(-76, y - 14 + lift); x.quadraticCurveTo(-70, y - 118 + lift, 0, y - 112 + lift); x.quadraticCurveTo(76, y - 108 + lift, 84, y - 22 + lift); x.lineTo(60, y - 8 + lift); x.lineTo(-60, y - 8 + lift); x.closePath(); x.fill();
  x.fillStyle = hit ? "#fff" : `rgba(${P.glow},.55)`; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-54 + i * 20, y - 96 + lift + Math.abs(i - 2.5) * 5); x.lineTo(-46 + i * 20, y - 138 + lift + Math.abs(i - 2.5) * 9); x.lineTo(-38 + i * 20, y - 98 + lift + Math.abs(i - 2.5) * 5); x.closePath(); x.fill(); }
  x.globalCompositeOperation = "lighter"; x.fillStyle = warn ? "rgba(255,70,90,.9)" : `rgba(${P.acc},.9)`;
  x.beginPath(); x.arc(46, y - 70 + lift, 9, 0, 7); x.fill(); x.fillStyle = `rgba(${P.glow},.5)`; x.fillRect(-30, y - 62 + lift, 54, 5);
  x.globalCompositeOperation = "source-over"; x.restore();
}

const CSS = `
.adv{position:fixed;inset:0;z-index:2400;background:#02070c;color:#e8fffa;font-family:var(--f-app,system-ui);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.adv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.adv-px{position:absolute;left:0;top:0;will-change:transform;pointer-events:none}
.adv-px svg{width:100%;height:100%;display:block;overflow:visible}
.adv-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;padding:8px 10px;padding-top:calc(8px + env(safe-area-inset-top,0px));background:linear-gradient(180deg,rgba(0,8,14,.7),rgba(0,8,14,0));z-index:4}
.adv-btn{min-width:44px;min-height:44px;border-radius:22px;border:1.5px solid rgba(140,255,220,.5);background:rgba(4,24,30,.62);color:#e8fffa;font-size:13px;font-weight:800;padding:0 14px;cursor:pointer;backdrop-filter:blur(4px)}
.adv-hud{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.adv-bar{position:relative;height:13px;border-radius:7px;background:rgba(255,255,255,.12);overflow:hidden}.adv-bar i{position:absolute;inset:0 auto 0 0;border-radius:7px}
.adv-bar b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:.4px;text-shadow:0 1px 2px #000}
.adv-hp i{background:linear-gradient(90deg,#ff4d6d,#ff9a6d)}.adv-xp i{background:linear-gradient(90deg,#3ddc97,#9dffd6)}.adv-sk i{background:linear-gradient(90deg,#7b61ff,#c3b0ff)}
.adv-lv{font-size:12px;font-weight:900;letter-spacing:.6px;color:#9dffd6}
.adv-pad{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;padding:10px 14px calc(14px + env(safe-area-inset-bottom,0px));z-index:4;pointer-events:none}
.adv-pad>div{pointer-events:auto}
.adv-pad .pvppad-l{display:flex;gap:8px}.adv-pad .pvppad-r{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.adv .pvpdir{width:58px;height:58px;background:rgba(255,255,255,.82);backdrop-filter:blur(3px);color:#12202a}
.adv .pvpact{width:68px;height:56px;background:rgba(255,255,255,.82);backdrop-filter:blur(3px);color:#12202a}
.adv .pvpact.punch{background:linear-gradient(135deg,#e2865fee,#d05f43ee);color:#fff}.adv .pvpact.kick{background:linear-gradient(135deg,#c9a227ee,#a8791bee);color:#fff}.adv .pvpact.spell{background:linear-gradient(0deg,#9b7bff var(--sp,0%),rgba(255,255,255,.82) var(--sp,0%));color:#2a1a66}.adv .pvpact.spell.ready{background:linear-gradient(135deg,#b49bff,#7b61ff);color:#fff;animation:pvpOdPulse 1s ease-in-out infinite}
.adv .pvpact.ult{background:linear-gradient(135deg,#fff0c2,#ffd23f);color:#7a4a06}
@media (max-width:600px){.adv .pvpdir{width:50px;height:50px}.adv .pvpact{width:58px;height:50px}.adv-pad .pvppad-r,.adv-pad .pvppad-l{gap:6px}}
.adv-key{width:68px;height:68px;border-radius:22px;border:2px solid rgba(140,255,220,.55);background:rgba(4,30,36,.6);color:#fff;font-size:26px;font-weight:900;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;cursor:pointer;backdrop-filter:blur(4px)}
.adv-key small{font-size:9.5px;font-weight:800;letter-spacing:.5px;margin-top:-2px}
.adv-key.on,.adv-key:active{background:rgba(61,220,151,.45)}
.adv-key.atk{width:84px;height:84px;border-radius:42px;background:linear-gradient(160deg,#ff8a5d,#d9482b);border-color:transparent}
.adv-key.skl{background:linear-gradient(160deg,#7b61ff,#4a35c9);border-color:transparent}.adv-key.cd{opacity:.45}
.adv-shop{display:flex;flex-direction:column;gap:6px;margin:10px 0;padding:10px;border-radius:14px;background:rgba(10,40,48,.55);border:1px solid rgba(140,255,220,.25)}
.adv-shop b{font-size:13px}.adv-up,.adv-q{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;border:1px solid rgba(140,255,220,.3);background:rgba(4,30,36,.6);color:#fff;font-size:13px;min-height:44px}
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
`;

type Gfx = "standard" | "high";
function defaultGfx(): Gfx { try { const v = localStorage.getItem("tg_adv_gfx"); if (v === "standard" || v === "high") return v; } catch (e) {} return (isLowEnd() || spaceTier() <= 1) ? "standard" : "high"; }

const T3 = (lang, th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);

/** The page: a planet menu, then the run itself. */
export const AdventurePage = memo(function AdventurePage({ lang, me, colorway, held = null, hat = null, acc = null, petNow = null, onBack, playUi = null }: any) {
  const [planet, setPlanet] = useState(null);
  const [gfx, setGfx] = useState<Gfx>(defaultGfx);
  useEffect(() => { try { localStorage.setItem("tg_adv_gfx", gfx); } catch (e) {} }, [gfx]);
  const [tick, setTick] = useState(0); void tick;
  const done = readDone(); const crystals = readCrystals(); const ups = readUps(); const diff = readDiff(); const qs = readQuests();
  const open = (P) => P.ok && (!P.req || done.includes(P.req));
  const t = (th, en, zh) => T3(lang, th, en, zh);
  return (
    <div className="adv" role="region" aria-label="Adventure Mode">
      <style>{CSS}</style>
      {!planet ? (
        <div className="adv-menu">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="adv-btn" onClick={() => { playUi && playUi("click"); onBack(); }} aria-label="back">←</button>
            <h2 style={{ flex: 1 }}>🪐 Adventure Mode</h2>
          </div>
          <p style={{ fontSize: 12, opacity: .85 }}>{t("ปี 2100 มนุษย์ออกหาทรัพยากรและพลังงานจากดาวต่างๆ และต้องสู้กับต่างดาว  ◆ คริสตัลพลังงานที่เก็บได้: " + crystals, "Year 2100: humanity heads out for resources and star energy, and fights the aliens. ◆ Energy crystals collected: " + crystals, "2100年，人类外出寻找资源与恒星能源，并与外星生物作战。  ◆ 已收集能量晶体：" + crystals)}</p>
          <p>{t("หุ่นยนต์และสัตว์เลี้ยงออกผจญภัยในดาวต่างดาว สู้มอนสเตอร์ เก็บ EXP เพิ่มเลเวลและสกิล (EXP เดียวกับ PvP)", "Take your robot and pet across alien planets, fight monsters and earn EXP for levels and skills (the same EXP as PvP).", "带着机器人和宠物探索外星球，打怪获得经验，升级并提升技能（与 PvP 共用经验）。")}</p>
          <div className="adv-planets">
            {PLANETS.map((P, pi) => (
              <button key={P.id} className={"adv-planet" + (open(P) ? "" : " lock")} style={{ background: `linear-gradient(120deg,${P.c[0]},${P.c[1]})`, "--g": `rgba(${P.glow},.7)` } as any} disabled={!open(P)}
                onClick={() => { if (open(P)) { playUi && playUi("click"); enterFs(); setPlanet(P); } }}>
                <span className="adv-orb" style={{ background: `radial-gradient(circle at 32% 28%,#fff6,${P.c[2]} 45%,${P.c[0]})` }} />
                <span><b>{T3(lang, P.th, P.en, P.zh)}</b><small>{open(P) ? t((P.survival ? "เก็บพลังงาน · " : "แผนที่ ") + (pi + 1) + (done.includes(P.id) ? " · ผ่านแล้ว ✓" : " · เล่นได้"), (P.survival ? "Harvest · " : "Map ") + (pi + 1) + (done.includes(P.id) ? " · cleared ✓" : " · playable"), (P.survival ? "采集 · " : "地图 ") + (pi + 1) + (done.includes(P.id) ? " · 已通关 ✓" : " · 可玩")) : P.ok ? t("ต้องผ่านบอสลูมาก่อน", "Beat the Luma boss first", "先击败卢玛首领") : t("เร็ว ๆ นี้", "Coming soon", "敬请期待")}</small></span>
                <em>{open(P) ? "▶" : "🔒"}</em>
              </button>
            ))}
          </div>
          <div className="adv-shop" aria-label="Workshop">
            <b>{t("โรงงาน — อัปเกรดด้วยคริสตัล ◆ " + crystals, "Workshop — upgrade with crystals ◆ " + crystals, "工坊 — 用晶体 ◆ " + crystals + " 升级")}</b>
            {UP_LINES.map(l => (
              <button key={l} className="adv-up" data-up={l} disabled={ups[l] >= UP_MAX || crystals < upCost(ups[l])} onClick={() => { if (buyUp(l)) { playUi && playUi("click"); setTick(x => x + 1); } }}>
                <span>{l === "atk" ? t("พลังโจมตี", "Attack", "攻击") : l === "hp" ? t("เลือด", "Health", "生命") : t("สกิลเร็วขึ้น", "Skill speed", "技能速度")} · Lv {ups[l]}/{UP_MAX} (+{ups[l] * 5}%)</span>
                <em>{ups[l] >= UP_MAX ? "MAX" : "◆ " + upCost(ups[l])}</em>
              </button>
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
          <p style={{ fontSize: 11.5 }}>{t("ระบบเลือกให้ตามเครื่องของคุณ เปลี่ยนเองได้", "Chosen for your device; change it any time.", "已按设备自动选择，可随时更改。")}</p>
        </div>
      ) : (
        <Run key={planet.id + gfx} P={planet} gfx={gfx} lang={lang} me={me} colorway={colorway} held={held} hat={hat} acc={acc} petNow={petNow}
          onExit={() => setPlanet(null)} playUi={playUi} onGfx={() => setGfx(g => (g === "high" ? "standard" : "high"))} />
      )}
    </div>
  );
});

/** One run on one planet. The game state lives in refs and a canvas: React only draws the HUD (a few times a second). */
const Run = memo(function Run({ P, gfx, lang, me, colorway, held, hat, acc, petNow, onExit, playUi, onGfx }: any) {
  const high = gfx === "high";
  useEffect(() => exitFsAndUnlock, []);   // back to the map or out of Adventure: normal screen, portrait again
  const cvRef = useRef<HTMLCanvasElement>(null);
  const pxRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLDivElement>(null);
  const keys = useRef({ l: false, r: false, jump: false, atk: false, skl: false, dash: false, fire: false, kick: false, spell: false });
  const [pose, setPose] = useState("ready");
  const [hud, setHud] = useState<any>({ hp: 1, hpMax: 1, lv: 1, xp: 0, xpNeed: 1, sk: 0, skNeed: 1, kills: 0, skCd: 0 });
  const [banner, setBanner] = useState<any>(null);
  const [down, setDown] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const quizOn = useRef(false);
  (window as any).__advQuiz = quiz;   // the smoke test reads the open question from here
  const beaconRef = useRef<any>(null);
  const castRef = useRef<any>(null), spellFire = useRef<any>(null);
  const musicRef = useRef<any>(null);
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  useEffect(() => { if (musicRef.current) musicRef.current.setOn(musicOn); try { localStorage.setItem("tg_adv_music", musicOn ? "1" : "0"); } catch (e) {} }, [musicOn]);
  useEffect(() => { if (musicRef.current) musicRef.current.duck(!!quiz); }, [quiz]);
  const cls = useMemo(() => classKeyOf(me), [me]);
  const t = (th, en, zh) => T3(lang, th, en, zh);
  // a beacon asks three questions, gently harder: from what THIS learner has finished in the Pathway
  // owner, 2026-10-11: ONE question at a time, never more — a string of questions kills the fun. The three beacons climb a step each.
  beaconRef.current = (idx = 0) => {
    const qs: any[] = []; const base = readLadder().lvl;
    qs.push(nextQuestion(lang, { level: Math.min(5, base + (idx === 2 ? 1 : 0)) }));
    setQuiz({ qs, i: 0, sel: [], res: null, right: 0, learned: qs[0].learned });
  };
  // phase 3.4: the chord spell. The gauge fills as you hit things; when it is full, the spell button opens ONE question to answer on the piano.
  castRef.current = () => { const nq: any = nextSpell(lang, {}); setQuiz({ qs: [nq], i: 0, sel: [], res: null, right: 0, learned: nq.learned, spell: true }); };
  const finishQuiz = (q: any) => {
    setQuiz(null); quizOn.current = false;
    if (q && q.spell) { if (spellFire.current) spellFire.current(q.right > 0); if (q.right > 0) { const l = bumpQuest("right", 1); for (const d of l) addRpgExp(me, d.exp); } logUsage("adv", "spell:" + P.id + ":" + (q.right > 0 ? "ok" : "miss")); return; }
    if (q && q.right > 0) { const l = bumpQuest("right", q.right); for (const d of l) { addRpgExp(me, d.exp); } if (l.length) setBanner({ k: Date.now(), a: "QUEST ✓", b: "+" + l[0].exp + " EXP" }); }
    if (q) logUsage("adv", "quiz:" + P.id + ":" + q.right + "of" + (q.qs ? q.qs.length : 3));
    if (q && q.right > 0) setBanner({ k: Date.now(), a: t("ตอบถูก!", "CORRECT!", "答对了！"), b: t("ได้ EXP และแต้มสกิล", "EXP and skill points earned", "获得经验与技能点") });
  };
  const answerQuiz = (ok: boolean) => {
    const cur = quiz; if (!cur || cur.res) return; const q = cur.qs[cur.i].q;
    const l = recordAnswer(ok, q.topic);
    try { recordMemory(q.label, ok ? 100 : 55); } catch (e) {}
    if (ok) {
      const exp = 10 + 6 * q.tier + (l.streak >= 2 ? 6 : 0);
      try { const r = addRpgExp(me, exp); addSkillSp(cls, 2 + q.tier); if (r && r.leveled) setBanner({ k: Date.now(), a: "LEVEL UP!", b: "Lv " + r.lv }); } catch (e) {}
    }
    setQuiz({ ...cur, res: ok ? "good" : "bad", right: cur.right + (ok ? 1 : 0) });
  };
  const nextQuiz = () => { const cur = quiz; if (!cur) return; if (cur.i >= cur.qs.length - 1) finishQuiz(cur); else setQuiz({ ...cur, i: cur.i + 1, sel: [], res: null }); };

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return undefined;
    const ctx = cv.getContext("2d", { alpha: false }); if (!ctx) return undefined;
    const dprCap = high ? 2 : 1;
    let cw = 0, ch = 0, k = 1, dpr = 1, bake: any = null, camX = 0, vw = 0;
    const resize = () => {
      dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect(); const w = Math.max(320, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cw = cv.width; ch = cv.height; k = ch / VH; vw = cw / k;
      bake = bakePlanet(P, cw, ch, k, high);
    };
    // phase 3.0: where do players leave, how does it run on a real phone? one cheap row per event, no migration (usage_events kind "adv")
    const mus = createAdvMusic(P.id); musicRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); }
    const t0 = performance.now(); let frames = 0, ended = false; logUsage("adv", "start:" + P.id + ":" + (high ? "hd" : "sd"));
    resize();
    const onResize = () => resize(); window.addEventListener("resize", onResize);

    /* ── the robot, from the same numbers PvP uses ── */
    const stat = () => { const info = rpgOf(me); return { info, mods: rpgMods(info.pts) }; };
    let { info, mods } = stat();
    const skillOf = () => skillRank(readSkillSp()[cls] || 0);
    const UPS = readUps(), DF = readDiff();
    const hpMaxOf = (lv) => Math.round((120 + lv * 11) * (1 + 0.05 * UPS.hp));
    TINT = P.tint || null;
    const HM = (P.hard || 1) * DF.hp, RW = DF.rw, CV = DF.id === "normal" ? 1 : DF.id === "hard" ? 2 : 3;   // reward multiplier, crystals per pickup
    const questDone = (list: any[]) => { for (const d of list) { addRpgExp(me, d.exp); pop(pl.x, GROUND - pl.y - 130, "QUEST +" + d.exp + " EXP", "#ffd23f"); } };
    const gainCry = (n: number) => { crystals += n; addCrystals(n); questDone(bumpQuest("cry", n)); };
    const pl: any = { x: 160, y: 0, vy: 0, face: 1, hp: hpMaxOf(info.lv), atkCd: 0, sklCd: 0, hurtT: 0, inv: 0, dead: 0, ground: true, swing: 0, fireCd: 0, kickCd: 0, dashCd: 0, dashT: 0, combo: 0, comboT: 0, maxCombo: 0 };
    const teleGaps: number[] = [];
    const mk = (type, hx, i) => ({ type, hx, x: hx, y: 0, vy: 0, vx: 0, hp: Math.round(MON[type].hp * HM), max: Math.round(MON[type].hp * HM), face: -1, cd: 800, hurt: 0, ph: rnd(i) * 6, dead: 0, resp: 0, tele: 0, act: "", teleAt: 0, i });
    const mons: any[] = [];
    const pattern = P.mons || ["glowbug"], pool = pattern;
    const surv = { t: 0, wave: 0, next: 2, done: false }, SURV_T = 90;   // gas-giant stage: hold out 90 s while the energy fills
    for (let i = 0; i < (P.survival ? 0 : 17); i++) mons.push(mk(pattern[i % pattern.length], 520 + i * 270 + rnd(i) * 80, i));
    const bolts: any[] = [], parts: any[] = [], pops: any[] = [], shots: any[] = [], slashes: any[] = [], drops: any[] = [], waves: any[] = [], pet: any[] = [];
    let crystals = readCrystals();
    const boss: any = { x: WORLD - 420, hp: Math.round(700 * HM), max: Math.round(700 * HM), face: -1, cd: 1.6, n: 0, state: "idle", tele: 0, dur: 0, hurt: 0, vx: 0, dead: P.survival ? 1 : 0, active: false };
    const ARENA = WORLD - 900;
    const beacons: any[] = (P.survival ? [] : [1300, 2650, 3950]).map(x => ({ x, used: false }));   // knowledge beacons: review questions from what the learner has studied
    const maxParts = high ? 140 : 26;
    const addPart = (x, y, vx, vy, life, col, sz) => { if (parts.length < maxParts) parts.push({ x, y, vx, vy, life, max: life, col, sz }); };
    const fireflies = Array.from({ length: high ? 46 : 12 }, (_, i) => ({ x: rnd(i + 200) * WORLD, y: 120 + rnd(i + 230) * 170, ph: rnd(i + 260) * 6 }));
    let kills = 0, time = 0, last = performance.now(), acc = 0, raf = 0, shake = 0, hitStop = 0, hudT = 0, finished = false;
    const step = high ? 1 / 60 : 1 / 30;

    const pop = (x, y, txt, col) => pops.push({ x, y, txt, col, life: 0.9 });
    const dmgOf = (mult = 1) => { const base = (9 + info.lv * 1.5) * mods.dmg * mult * (1 + 0.05 * UPS.atk); const crit = Math.random() < 0.08 + mods.crit; return { v: Math.round(base * (0.9 + Math.random() * 0.2) * (crit ? 1.6 : 1)), crit }; };
    let spellG = 0;
    const hurtMon = (m, v, crit, kx) => {
      spellG = Math.min(100, spellG + 5);
      m.hp -= v; m.hurt = 0.12; m.vx = kx; if (high) hitStop = 0.035; shake = Math.max(shake, crit ? 5 : 2);
      pop(m.x, GROUND - m.y - 60, String(v), crit ? "#ffd23f" : "#ffffff");
      for (let i = 0; i < (high ? 7 : 3); i++) addPart(m.x, GROUND - m.y - 20, (Math.random() - 0.5) * 220, -Math.random() * 160, 0.45, crit ? "255,210,60" : "255,255,255", 2.5);
      if (m.hp <= 0) {
        m.dead = 1; m.resp = 14; kills++;
        const d = MON[m.type];
        const gain = Math.round(d.exp * (P.hard || 1) * RW); const rpg = addRpgExp(me, gain); addSkillSp(cls, Math.max(1, Math.round(gain / 3)));
        pop(m.x, GROUND - 90, "+" + gain + " EXP", "#9dffd6");
        if (Math.random() < 0.22) drops.push({ x: m.x, y: 20, vy: 160, t: "hp" });
        if (Math.random() < 0.5) drops.push({ x: m.x + (Math.random() - 0.5) * 30, y: 20, vy: 200, t: "cry" });
        for (let i = 0; i < (high ? 22 : 8); i++) addPart(m.x, GROUND - m.y - 24, (Math.random() - 0.5) * 340, -Math.random() * 280, 0.8, i % 2 ? P.glow : P.acc, 3);
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
      const px0 = pl.x - pl.face * 56; const v = Math.max(1, Math.round(dmgOf().v * 0.28));
      if (best) { pet.push({ x: px0, y: 30, tx: best.x, ty: best.y + 20, life: 0.25, v, m: best }); }
      else if (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < 340) pet.push({ x: px0, y: 30, tx: boss.x, ty: 60, life: 0.25, v, b: true });
    };
    const hurtBoss = (v, crit, kx) => {
      if (!boss.active || boss.dead) return;
      spellG = Math.min(100, spellG + 5);
      boss.hp -= v; boss.hurt = 0.1; boss.vx = kx * 0.3; if (high) hitStop = 0.03; shake = Math.max(shake, crit ? 5 : 2);
      pop(boss.x, GROUND - 140, String(v), crit ? "#ffd23f" : "#ffffff");
      for (let i = 0; i < (high ? 6 : 2); i++) addPart(boss.x, GROUND - 70, (Math.random() - 0.5) * 220, -Math.random() * 160, 0.45, "255,255,255", 2.5);
      if (boss.hp <= 0) {
        boss.dead = 1; boss.hp = 0; if (mus) mus.setBoss(false); shots.length = 0; waves.length = 0; kills++;
        const gain = Math.round(220 * (P.hard || 1) * RW); const rpg = addRpgExp(me, gain); addSkillSp(cls, Math.round(gain / 3));
        for (let i = 0; i < 12; i++) drops.push({ x: boss.x + (i - 6) * 16, y: 40 + i * 6, vy: 220, t: "cry" });
        drops.push({ x: boss.x, y: 60, vy: 220, t: "hp" });
        for (let i = 0; i < (high ? 50 : 16); i++) addPart(boss.x, GROUND - 70, (Math.random() - 0.5) * 520, -Math.random() * 380, 1, i % 2 ? P.glow : P.acc, 4);
        markDone(P.id); shake = 10; questDone(bumpQuest("boss", 1)); logUsage("adv", "boss-win:" + P.id + ":" + Math.round((performance.now() - t0) / 1000) + "s");
        info = rpgOf(me); if (rpg && rpg.leveled) { mods = rpgMods(info.pts); pl.hp = hpMaxOf(info.lv); }
        const nx = PLANETS[PLANETS.findIndex(q => q.id === P.id) + 1];
        setBanner({ k: Date.now(), a: t("เอาชนะบอสแล้ว! +" + gain + " EXP", "BOSS DOWN! +" + gain + " EXP", "击败首领！+" + gain + " 经验"), b: nx && nx.ok ? t("ปลดล็อก " + nx.en.split(" · ")[0] + " แล้ว", nx.en.split(" · ")[0] + " unlocked", "已解锁 " + nx.en.split(" · ")[0]) : t("ประตูวาร์ปเปิดแล้ว", "The warp gate is open", "传送门已开启") });
        playUi && playUi("reward");
      }
    };
    const attack = () => {
      if (pl.dead || pl.atkCd > 0) return;
      pl.combo = pl.comboT > 0 ? pl.combo + 1 : 1; const finisher = pl.combo >= 3; pl.maxCombo = Math.max(pl.maxCombo, pl.combo); pl.comboT = 0.75; if (finisher) pl.combo = 0;
      pl.atkCd = (finisher ? 0.6 : 0.34) * mods.cdMul; pl.swing = 0.18; setPose("attack"); setTimeout(() => setPose("ready"), 170);
      slashes.push({ x: pl.x + pl.face * 34, y: pl.y + 44, face: pl.face, life: finisher ? 0.26 : 0.18, max: finisher ? 0.26 : 0.18 });
      if (finisher) { shake = Math.max(shake, 5); pop(pl.x, GROUND - pl.y - 120, "×3!", "#ffd23f"); }
      for (const m of mons) {
        if (m.dead) continue; const dx = (m.x - pl.x) * pl.face;
        if (dx > -10 && dx < 92 + MON[m.type].w / 2 && Math.abs(m.y - pl.y) < 70) { const d = dmgOf(finisher ? 1.7 : 1); hurtMon(m, d.v, d.crit || finisher, pl.face * (finisher ? 330 : 160)); }
      }
      { const dx = (boss.x - pl.x) * pl.face; if (boss.active && !boss.dead && dx > -10 && dx < 150 && pl.y < 90) { const d = dmgOf(finisher ? 1.7 : 1); hurtBoss(d.v, d.crit || finisher, pl.face * (finisher ? 330 : 160)); } }
    };
    const skill = () => {
      const sr = skillOf();
      if (pl.dead || pl.sklCd > 0) return;
      pl.sklCd = 4.5 * (1 - 0.05 * UPS.skl) / (1 + 0.04 * (sr.rank - 1)); pl.swing = 0.3; setPose("kick"); setTimeout(() => setPose("ready"), 260);
      shake = Math.max(shake, high ? 7 : 3);
      for (let a = 0; a < (high ? 28 : 10); a++) { const ang = (a / (high ? 28 : 10)) * Math.PI * 2; addPart(pl.x, GROUND - pl.y - 40, Math.cos(ang) * 320, Math.sin(ang) * 220, 0.5, "123,97,255", 3.5); }
      slashes.push({ x: pl.x, y: pl.y + 40, face: 0, life: 0.3, nova: true });
      for (const m of mons) {
        if (m.dead) continue;
        if (Math.abs(m.x - pl.x) < (cls === "herald" ? 250 : 190) && Math.abs(m.y - pl.y) < 110) { const base = (9 + info.lv * 1.5) * mods.dmg * 3.2 * (1 + 0.08 * (sr.rank - 1)) * mods.spell; hurtMon(m, Math.round(base), true, Math.sign(m.x - pl.x) * 260); }
      }
      { const rr = cls === "herald" ? 250 : 190; if (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < rr + 40 && pl.y < 120) hurtBoss(Math.round((9 + info.lv * 1.5) * mods.dmg * 3.2 * (1 + 0.08 * (sr.rank - 1)) * mods.spell), true, Math.sign(boss.x - pl.x) * 260); }
      // what the skill does besides damage depends on the robot's class
      if (cls === "engineer") { pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * 0.12); pop(pl.x, GROUND - pl.y - 110, "+HP", "#8dffb0"); }
      else if (cls === "ghost") pl.inv = Math.max(pl.inv, 1.2);
    };
    // shoot: a bolt flies ahead and hits the first enemy; kick: a short wide sweep that knocks back hard
    const fireBolt = () => {
      if (pl.dead || pl.fireCd > 0) return;
      pl.fireCd = 0.55 * mods.cdMul; pl.swing = 0.12; setPose("attack"); setTimeout(() => setPose("ready"), 140);
      const d = dmgOf(0.8); bolts.push({ x: pl.x + pl.face * 30, y: pl.y + 46, vx: pl.face * 520, life: 0.9, v: d.v, crit: d.crit });
    };
    const kickMove = () => {
      if (pl.dead || pl.kickCd > 0) return;
      pl.kickCd = 0.8 * mods.cdMul; pl.swing = 0.2; setPose("kick"); setTimeout(() => setPose("ready"), 200);
      slashes.push({ x: pl.x + pl.face * 40, y: pl.y + 30, face: pl.face, life: 0.2, max: 0.2 });
      for (const m of mons) { if (m.dead) continue; const dx = (m.x - pl.x) * pl.face; if (dx > -10 && dx < 118 + MON[m.type].w / 2 && Math.abs(m.y - pl.y) < 70) { const d = dmgOf(1.2); hurtMon(m, d.v, d.crit, pl.face * 300); } }
      { const dx = (boss.x - pl.x) * pl.face; if (boss.active && !boss.dead && dx > -10 && dx < 170 && pl.y < 90) { const d = dmgOf(1.2); hurtBoss(d.v, d.crit, pl.face * 240); } }
    };
    spellFire.current = (ok: boolean) => {
      if (!ok) { spellG = 50; pop(pl.x, GROUND - pl.y - 130, "♪ " + t("ลองใหม่", "again", "再来"), "#ffd0a0"); return; }
      const sr = skillOf(); shake = Math.max(shake, high ? 10 : 5); playUi && playUi("reward");
      const base = (9 + info.lv * 1.5) * mods.dmg * 4.5 * (1 + 0.05 * UPS.atk) * (1 + 0.08 * (sr.rank - 1)) * mods.spell;
      for (let a = 0; a < (high ? 40 : 14); a++) { const ang = (a / (high ? 40 : 14)) * Math.PI * 2; addPart(pl.x, GROUND - pl.y - 40, Math.cos(ang) * 420, Math.sin(ang) * 300, 0.7, a % 2 ? "255,230,140" : P.acc, 3.5); }
      slashes.push({ x: pl.x, y: pl.y + 40, face: 0, life: 0.45, max: 0.45, nova: true });
      for (const m of mons) if (!m.dead && Math.abs(m.x - pl.x) < 360) hurtMon(m, Math.round(base), true, Math.sign(m.x - pl.x) * 320);
      if (boss.active && !boss.dead && Math.abs(boss.x - pl.x) < 400) hurtBoss(Math.round(base), true, Math.sign(boss.x - pl.x) * 200);
      pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * 0.25); pl.inv = Math.max(pl.inv, 0.8);
      pop(pl.x, GROUND - pl.y - 130, t("เวทย์คอร์ด!", "CHORD SPELL!", "和弦术！"), "#ffe08a");
      spellG = 0;
    };
    const hurtPlayer = (v, from) => {
      if (pl.inv > 0 || pl.dead) return;
      pl.hp -= v; pl.inv = 0.7; pl.vy = 0; pl.x += Math.sign(pl.x - from) * 26; shake = Math.max(shake, 4);
      pop(pl.x, GROUND - pl.y - 100, "-" + v, "#ff6b81");
      for (let i = 0; i < (high ? 8 : 3); i++) addPart(pl.x, GROUND - pl.y - 50, (Math.random() - 0.5) * 200, -Math.random() * 150, 0.4, "255,90,110", 2.5);
      if (pl.hp <= 0) { pl.hp = 0; pl.dead = 2.2; setDown(true); logUsage("adv", "die:" + P.id + ":x" + Math.round(pl.x / 100) * 100 + (boss.active && !boss.dead ? ":boss" : "")); }
    };

    const sim = (dt) => {
      if (quizOn.current) return;
      time += dt;
      const kk = keys.current;
      if (pl.dead > 0) { pl.dead -= dt; if (pl.dead <= 0) { if (P.survival && !surv.done) { surv.t = 0; surv.wave = 0; surv.next = 2; mons.length = 0; shots.length = 0; } pl.dead = 0; pl.hp = hpMaxOf(info.lv); pl.x = 160; pl.y = 0; pl.inv = 1.5; camX = 0; setDown(false); } }
      else {
        const sp = 150 * mods.walk; let dx = 0; if (kk.l) dx -= 1; if (kk.r) dx += 1;
        pl.x = Math.max(boss.active && !boss.dead ? ARENA : 40, Math.min(WORLD - 60, pl.x + dx * sp * dt)); if (dx) pl.face = dx;
        if (!boss.active && !boss.dead && pl.x > ARENA + 60) { boss.active = true; if (mus) mus.setBoss(true); logUsage("adv", "boss-wake:" + P.id); setBanner({ k: Date.now(), a: T3(lang, P.boss[0], P.boss[1], P.boss[2]), b: t("บอสท้ายด่าน — ประตูด้านหลังปิดแล้ว", "End-of-map boss — the way back is shut", "本图首领——退路已封闭") }); }
        if (kk.jump && pl.ground) { pl.vy = 360; pl.ground = false; }
        if (kk.atk) attack(); if (kk.skl) skill(); if (kk.fire) fireBolt(); if (kk.kick) kickMove();
        if (kk.spell && spellG >= 100 && !quizOn.current) { kk.l = kk.r = kk.atk = kk.skl = kk.jump = kk.fire = kk.kick = kk.spell = false; quizOn.current = true; if (castRef.current) castRef.current(); }
        if (kk.dash && pl.dashCd <= 0) { pl.dashCd = 1.2; pl.dashT = 0.18; pl.inv = Math.max(pl.inv, 0.3); for (let i = 0; i < (high ? 8 : 3); i++) addPart(pl.x, GROUND - pl.y - 30, -pl.face * (80 + Math.random() * 120), (Math.random() - 0.5) * 60, 0.3, "160,255,230", 2.5); }
        if (pl.dashT > 0) { pl.dashT -= dt; pl.x = Math.max(boss.active && !boss.dead ? ARENA : 40, Math.min(WORLD - 60, pl.x + pl.face * 560 * dt)); }
        pl.dashCd -= dt; pl.fireCd -= dt; pl.kickCd -= dt; pl.comboT -= dt; if (pl.comboT <= 0) pl.combo = 0;
        pl.vy -= 900 * dt; pl.y += pl.vy * dt; if (pl.y <= 0) { pl.y = 0; pl.vy = 0; pl.ground = true; }
        pl.atkCd -= dt; pl.sklCd -= dt; pl.inv -= dt; pl.swing -= dt;
      }
      if (P.survival && !surv.done && pl.dead <= 0) {
        surv.t += dt; surv.next -= dt;
        if (surv.next <= 0) { surv.next = 6; surv.wave++; const n = Math.min(7, 2 + surv.wave); for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; const x = Math.max(60, Math.min(WORLD - 60, pl.x + side * (420 + rnd(surv.wave * 9 + i) * 160))); mons.push(mk(pool[(surv.wave + i) % pool.length], x, 1000 + surv.wave * 10 + i)); } }
        if (surv.t >= SURV_T) {
          surv.done = true; finished = true; mons.length = 0; shots.length = 0; markDone(P.id); shake = 6;
          const gain = Math.round(150 * (P.hard || 1) * RW); const rpg = addRpgExp(me, gain); addSkillSp(cls, Math.round(gain / 3)); gainCry(15 * CV);
          info = rpgOf(me); if (rpg && rpg.leveled) { mods = rpgMods(info.pts); pl.hp = hpMaxOf(info.lv); }
          logUsage("adv", "harvest-win:" + P.id); playUi && playUi("reward");
          setBanner({ k: Date.now(), a: t("เก็บพลังงานครบ! +" + gain + " EXP", "ENERGY HARVESTED! +" + gain + " EXP", "能量采集完成！+" + gain + " 经验"), b: t("◆ คริสตัล +" + 15 * CV, "◆ crystals +" + 15 * CV, "◆ 晶体 +" + 15 * CV) });
        }
      }
      if (P.survival) for (let i = mons.length - 1; i >= 0; i--) if (mons[i].dead) mons.splice(i, 1);
      for (const m of mons) {
        if (m.dead) { m.resp -= dt; if (m.resp <= 0 && Math.abs(pl.x - m.hx) > 640) { m.dead = 0; m.hp = m.max; m.x = m.hx; m.y = 0; m.vx = 0; } continue; }
        const d = MON[m.type]; m.hurt -= dt; m.cd -= dt * 1000;
        const dxp = pl.x - m.x, dist = Math.abs(dxp);
        m.face = dxp > 0 ? 1 : -1;
        const aggro = dist < 520 && pl.dead <= 0;
        let mv = 0;
        if (aggro && m.tele <= 0) {
          if (d.ranged) { if (dist > 300) mv = Math.sign(dxp); else if (dist < 190) mv = -Math.sign(dxp); }
          else if (dist > 40) mv = Math.sign(dxp);
        }
        m.x += (mv * d.speed + m.vx) * dt; m.vx *= 0.86;
        if (m.type === "glowbug" && aggro && m.y <= 0 && dist < 260 && Math.random() < 0.02) m.vy = 240;
        m.vy -= 700 * dt; m.y += m.vy * dt; if (m.y < 0) { m.y = 0; m.vy = 0; }
        // every attack is announced first: a red "!" for 0.3 s, then the blow (an attack that lands with no warning is not fair)
        if (m.tele > 0) {
          m.tele -= dt;
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
        if (boss.state === "idle") {
          boss.cd -= dt; boss.x += (Math.sign(pl.x - boss.x) * 36 + boss.vx) * dt; boss.vx *= 0.86;
          boss.x = Math.max(ARENA + 60, Math.min(WORLD - 120, boss.x));
          if (boss.cd <= 0) { const o = boss.n++ % 3; boss.state = o === 0 ? "slam" : o === 1 ? "volley" : "charge"; boss.tele = o === 2 ? 0.7 : 0.6; boss.dur = 0; }
          if (Math.abs(pl.x - boss.x) < 70 && Math.abs(pl.y) < 40 && pl.inv <= 0) hurtPlayer(Math.round(14 * HM), boss.x);
        } else if (boss.tele > 0) {
          boss.tele -= dt;
          if (boss.tele <= 0) {
            if (boss.state === "slam") { shake = 8; waves.push({ x: boss.x, dir: -1, life: 2.2 }, { x: boss.x, dir: 1, life: 2.2 }); boss.state = "idle"; boss.cd = 2; }
            else if (boss.state === "volley") { for (let i = -1; i <= 1; i++) shots.push({ x: boss.x + boss.face * 40, y: 70 + i * 26, vx: boss.face * (200 + i * 30), life: 2.6, d: Math.round(12 * HM) }); boss.state = "idle"; boss.cd = 1.8; }
            else { boss.dur = 0.8; boss.vx = boss.face * 340; }
          }
        } else if (boss.state === "charge") {
          boss.dur -= dt; boss.x += boss.vx * dt; boss.x = Math.max(ARENA + 60, Math.min(WORLD - 120, boss.x));
          if (Math.abs(pl.x - boss.x) < 80 && pl.y < 50) hurtPlayer(Math.round(20 * HM), boss.x);
          if (boss.dur <= 0) { boss.vx = 0; boss.state = "idle"; boss.cd = 2; }
        }
      }
      petCd -= dt; if (petCd <= 0) { petCd = 2.2; petBolt(); }
      for (const b of pet) { b.life -= dt; if (b.life <= 0 && !b.done) { b.done = true; if (b.b) hurtBoss(b.v, false, 0); else if (!b.m.dead) hurtMon(b.m, b.v, false, 0); } }
      for (let i = pet.length - 1; i >= 0; i--) if (pet[i].done) pet.splice(i, 1);
      for (const b of bolts) {
        b.x += b.vx * dt; b.life -= dt;
        for (const m of mons) { if (m.dead || b.life <= 0) continue; if (Math.abs(m.x - b.x) < MON[m.type].w / 2 + 8 && Math.abs(m.y + 20 - b.y) < 50) { hurtMon(m, b.v, b.crit, Math.sign(b.vx) * 90); b.life = 0; } }
        if (b.life > 0 && boss.active && !boss.dead && Math.abs(boss.x - b.x) < 62 && b.y < 140) { hurtBoss(b.v, b.crit, 0); b.life = 0; }
      }
      for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].life <= 0) bolts.splice(i, 1);
      for (const w of waves) { w.x += w.dir * 260 * dt; w.life -= dt; if (Math.abs(w.x - pl.x) < 22 && pl.y < 34) { hurtPlayer(Math.round(16 * HM), w.x); w.life = 0; } }
      for (let i = waves.length - 1; i >= 0; i--) if (waves[i].life <= 0) waves.splice(i, 1);
      for (const d of drops) { d.vy -= 700 * dt; d.y += d.vy * dt; if (d.y < 0) { d.y = 0; d.vy = 0; } if (pl.dead <= 0 && Math.abs(d.x - pl.x) < 34 && Math.abs(d.y - pl.y) < 60) { d.got = true;
        if (d.t === "hp") { pl.hp = Math.min(hpMaxOf(info.lv), pl.hp + hpMaxOf(info.lv) * 0.18); pop(pl.x, GROUND - pl.y - 100, "+HP", "#8dffb0"); } else { gainCry(CV); pop(pl.x, GROUND - pl.y - 100, "◆" + (CV > 1 ? "×" + CV : ""), "#7fe8ff"); } } }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].got) drops.splice(i, 1);
      for (const s of shots) { s.x += s.vx * dt; s.life -= dt; if (Math.abs(s.x - pl.x) < 18 && Math.abs(s.y - pl.y - 40) < 40 && s.life > 0) { hurtPlayer(s.d, s.x); s.life = 0; } }
      for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
      for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      for (const p of pops) { p.life -= dt; p.y -= 38 * dt; }
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
      for (const s of slashes) s.life -= dt; for (let i = slashes.length - 1; i >= 0; i--) if (slashes[i].life <= 0) slashes.splice(i, 1);
      for (const b of beacons) if (!b.used && pl.dead <= 0 && Math.abs(pl.x - b.x) < 64) { b.used = true; keys.current.l = keys.current.r = keys.current.atk = keys.current.skl = keys.current.jump = false; quizOn.current = true; if (beaconRef.current) beaconRef.current(beacons.indexOf(b)); }
      // camera: the robot a little ahead of centre, eased
      const target = Math.max(0, Math.min(WORLD - vw, pl.x - vw * 0.42 + pl.face * 30));
      camX += (target - camX) * (high ? 0.12 : 0.2);
      shake *= 0.86;
      if (!finished && !P.survival && boss.dead && pl.x > WORLD - 140) { finished = true; const nx = PLANETS[PLANETS.findIndex(q => q.id === P.id) + 1]; setBanner({ k: Date.now(), a: t("ผ่านแผนที่!", "MAP CLEAR!", "通关！"), b: nx && nx.ok ? t("เลือกดาวถัดไปจากแผนที่", "Pick the next planet from the map", "请从地图选择下一颗星球") : t("ดาวถัดไปมาในระยะต่อไป", "More planets are coming", "更多星球即将开放") }); }
    };

    const draw = (tm) => {
      const sx = (high && shake > 0.3) ? (Math.random() - 0.5) * shake * k : 0, sy = (high && shake > 0.3) ? (Math.random() - 0.5) * shake * k : 0;
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
      // monsters
      for (const m of mons) { if (m.dead || m.x < camX - 80 || m.x > camX + vw + 80) continue; drawMonster(ctx, m, tm, k, GROUND);
        if (m.tele > 0) { ctx.fillStyle = "#ff4d6d"; ctx.font = "900 22px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", m.x, GROUND - m.y - ((m.type === "sporecaster" || m.type === "frostcaster") ? 128 : 74)); }
        if (m.hp < m.max) { const w = 40, y0 = GROUND - m.y - ((m.type === "sporecaster" || m.type === "frostcaster") ? 118 : 62); ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(m.x - w / 2, y0, w, 5); ctx.fillStyle = "#ff5b7a"; ctx.fillRect(m.x - w / 2, y0, w * Math.max(0, m.hp / m.max), 5); } }
      if (boss.active && !boss.dead && boss.x > camX - 160 && boss.x < camX + vw + 160) drawBoss(ctx, boss, tm, P);
      for (const b of bolts) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,240,170,.95)"; ctx.beginPath(); ctx.arc(b.x, GROUND - b.y, 5, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,200,90,.35)"; ctx.fillRect(b.x - Math.sign(b.vx) * 26, GROUND - b.y - 2, 26, 4); ctx.globalCompositeOperation = "source-over"; }
      for (const b of pet) { const q = 1 - b.life / 0.25; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(${P.acc},.9)`; ctx.beginPath(); ctx.arc(b.x + (b.tx - b.x) * q, GROUND - (b.y + (b.ty - b.y) * q), 5, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
      for (const w of waves) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(${P.acc},.8)`; ctx.beginPath(); ctx.moveTo(w.x - 14, GROUND); ctx.lineTo(w.x, GROUND - 30); ctx.lineTo(w.x + 14, GROUND); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
      for (const d of drops) { const yy = GROUND - d.y - 8 + Math.sin(tm * 5 + d.x) * 2; ctx.fillStyle = d.t === "hp" ? "#7dffa8" : "#7fe8ff"; ctx.beginPath(); if (d.t === "hp") ctx.arc(d.x, yy, 6, 0, 7); else { ctx.moveTo(d.x, yy - 8); ctx.lineTo(d.x + 6, yy); ctx.lineTo(d.x, yy + 8); ctx.lineTo(d.x - 6, yy); ctx.closePath(); } ctx.fill(); if (high) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(d.x, yy, 12, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; } }
      // spores + slashes
      for (const s of shots) { ctx.fillStyle = "#e9ff9a"; ctx.beginPath(); ctx.arc(s.x, GROUND - s.y, 5, 0, 7); ctx.fill(); if (high) { ctx.globalCompositeOperation = "lighter"; ctx.drawImage(bake.glows.green, s.x - 20, GROUND - s.y - 20, 40, 40); ctx.globalCompositeOperation = "source-over"; } }
      for (const s of slashes) {
        const q = Math.max(0, Math.min(1, 1 - s.life / (s.max || (s.nova ? 0.3 : 0.18)))); ctx.save(); ctx.globalCompositeOperation = "lighter";
        if (s.nova) { ctx.strokeStyle = `rgba(160,130,255,${1 - q})`; ctx.lineWidth = 5 * (1 - q) + 1; ctx.beginPath(); ctx.arc(s.x, GROUND - s.y, 30 + q * 170, 0, 7); ctx.stroke(); }
        else { ctx.strokeStyle = `rgba(255,230,160,${1 - q})`; ctx.lineWidth = 6 * (1 - q) + 1; ctx.beginPath(); ctx.arc(s.x - s.face * 30, GROUND - s.y, 56 + q * 18, s.face > 0 ? -0.9 : Math.PI - 0.9 + 1.8 - 1.8, s.face > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke(); }
        ctx.restore();
      }
      // particles (glow in high mode)
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = `rgb(${p.col})`; ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2 + 0, p.sz, p.sz); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      // damage numbers
      ctx.textAlign = "center"; ctx.font = "800 15px system-ui,sans-serif";
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = "#000"; ctx.fillText(p.txt, p.x + 1, p.y + 1); ctx.fillStyle = p.col; ctx.fillText(p.txt, p.x, p.y); }
      ctx.globalAlpha = 1;
      // the shadow under the robot
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(pl.x, GROUND + 3, 26 - Math.min(10, pl.y * 0.05), 5, 0, 0, 7); ctx.fill();
      for (const b of beacons) { if (b.x < camX - 40 || b.x > camX + vw + 40) continue; const a = b.used ? 0.25 : 0.55 + 0.25 * Math.sin(tm * 3);
        ctx.globalCompositeOperation = "lighter"; const bg = ctx.createLinearGradient(0, GROUND - 150, 0, GROUND); bg.addColorStop(0, `rgba(255,224,138,0)`); bg.addColorStop(1, `rgba(255,224,138,${a * 0.5})`); ctx.fillStyle = bg; ctx.fillRect(b.x - 14, GROUND - 150, 28, 150); ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = b.used ? "#3a4a52" : "#ffe08a"; ctx.beginPath(); ctx.moveTo(b.x - 9, GROUND); ctx.lineTo(b.x - 4, GROUND - 46); ctx.lineTo(b.x + 4, GROUND - 46); ctx.lineTo(b.x + 9, GROUND); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, GROUND - 58 + Math.sin(tm * 2.4) * 3, 10, 0, 7); ctx.fillStyle = b.used ? "#52646c" : "#fff6c8"; ctx.fill();
        if (!b.used) { ctx.fillStyle = "#04201a"; ctx.font = "900 13px system-ui"; ctx.textAlign = "center"; ctx.fillText("?", b.x, GROUND - 53 + Math.sin(tm * 2.4) * 3); } }
      // the warp gate at the end of the map
      { const gx = WORLD - 90; if (gx > camX - 60 && gx < camX + vw + 60) { ctx.strokeStyle = `rgba(${P.acc},.9)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(gx, GROUND - 60, 26, 62, 0, 0, 7); ctx.stroke(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(${P.acc},${0.18 + 0.1 * Math.sin(tm * 3)})`; ctx.beginPath(); ctx.ellipse(gx, GROUND - 60, 24, 60, 0, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over"; } }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      tile(bake.near, 1.25);
      if (P.survival && !surv.done) { const bw = Math.min(cw * 0.6, 420 * k), bx = (cw - bw) / 2, by = 56 * k; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, 9 * k); ctx.fillStyle = "#ffbe6e"; ctx.fillRect(bx, by, bw * Math.min(1, surv.t / SURV_T), 9 * k); ctx.fillStyle = "#fff"; ctx.font = `800 ${11 * k}px system-ui,sans-serif`; ctx.textAlign = "center"; ctx.fillText(T3(lang, "พลังงาน ", "ENERGY ", "能量 ") + Math.round(Math.min(1, surv.t / SURV_T) * 100) + "% · " + T3(lang, "คลื่น ", "wave ", "波 ") + surv.wave, cw / 2, by - 4 * k); }
      if (boss.active && !boss.dead) { const bw = Math.min(cw * 0.6, 420 * k), bx = (cw - bw) / 2, by = 56 * k; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, 9 * k); ctx.fillStyle = "#ff5b7a"; ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.max), 9 * k); ctx.fillStyle = "#fff"; ctx.font = `800 ${11 * k}px system-ui,sans-serif`; ctx.textAlign = "center"; ctx.fillText(T3(lang, P.boss[0], P.boss[1], P.boss[2]), cw / 2, by - 4 * k); }
      // light + vignette (high): one baked-free pass, a couple of fills
      if (high) { const g = ctx.createRadialGradient(cw / 2, ch * 0.55, ch * 0.3, cw / 2, ch * 0.55, ch * 1.1); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,6,10,.55)"); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); }
      // the robot and its pet are DOM figures placed over the canvas
      const px = pxRef.current; if (px) {
        const cssK = k / dpr, bw = 80 * cssK, bh = 128 * cssK;
        px.style.width = bw + "px"; px.style.height = bh + "px";
        const flick = pl.inv > 0 && Math.floor(tm * 20) % 2 === 0 ? 0.35 : 1;
        px.style.opacity = pl.dead > 0 ? "0.25" : String(flick);
        px.style.transform = `translate(${(pl.x - camX) * cssK - bw / 2}px,${(GROUND - pl.y) * cssK - bh + 6 * cssK}px)`;
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
      if (n > 0 || dt === 0) draw(time);
      hudT += dt;
      if (hudT > 0.15) {
        hudT = 0; const sr = skillOf();
        setHud({ hp: Math.max(0, pl.hp), hpMax: hpMaxOf(info.lv), lv: info.lv, xp: info.max ? 1 : info.into, xpNeed: info.max ? 1 : info.need, sk: sr.max ? 1 : sr.into, skNeed: sr.max ? 1 : sr.need, rank: sr.rank, kills, cry: crystals, skCd: Math.max(0, pl.sklCd), dashCd: Math.max(0, pl.dashCd), spell: Math.round(spellG) });
      }
    };
    raf = requestAnimationFrame(loop);

    // keyboard (desktop)
    const kd = (e, v) => {
      const kk = keys.current; const c = e.code;
      if (c === "ArrowLeft" || c === "KeyA") kk.l = v; else if (c === "ArrowRight" || c === "KeyD") kk.r = v;
      else if (c === "ArrowUp" || c === "KeyW" || c === "Space") kk.jump = v; else if (c === "KeyJ" || c === "KeyZ") kk.atk = v; else if (c === "KeyK" || c === "KeyX") kk.skl = v; else if (c === "KeyO") kk.spell = v; else if (c === "KeyI") kk.fire = v; else if (c === "KeyU") kk.kick = v; else if (c === "KeyL" || c === "ShiftLeft" || c === "ShiftRight") kk.dash = v; else return;
      e.preventDefault();
    };
    const dn = (e) => kd(e, true), up = (e) => kd(e, false);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    (window as any).__advTest = { beacons: () => beacons.map(b => b.x), state: () => ({ kills, x: pl.x, hp: pl.hp, lv: info.lv, mons: mons.filter(m => !m.dead).length }), tp: (x) => { pl.x = x; pl.face = 1; },  music: () => (mus ? mus.info() : null), renderMusic: (id, boss) => renderPreview(id, 4, !!boss), spellG: () => spellG, setSpell: (n) => { spellG = n; }, fireNow: () => fireBolt(), kickNow: () => kickMove(), bolts: () => bolts.length, monHp: () => mons.filter(m => !m.dead).reduce((a, m) => a + m.hp, 0), monX: () => { const m = mons.find(q => !q.dead); return m ? m.x : -1; }, types: () => [...new Set(mons.map(m => m.type))], surv: () => ({ t: surv.t, wave: surv.wave, done: surv.done, mons: mons.length }), skip: (s) => { surv.t += s; }, pl: () => ({ inv: pl.inv, x: pl.x, dashCd: pl.dashCd, maxCombo: pl.maxCombo }), gaps: () => teleGaps.slice(), strikeNow: () => attack(), boss: () => ({ active: boss.active, dead: boss.dead, hp: boss.hp, x: boss.x }), hitBoss: (v) => { boss.active = true; hurtBoss(v, false, 0); }, crystals: () => crystals, gainCry: (n) => gainCry(n), hpMax: () => hpMaxOf(info.lv), diffHp: () => HM,  drops: () => drops.length, fps: () => 0 };
    return () => { if (mus) mus.stop(); musicRef.current = null; if (!ended) { ended = true; const secs = (performance.now() - t0) / 1000; if (secs > 3) { logUsage("adv", "end:" + P.id + ":" + Math.round(secs) + "s:k" + kills + ":x" + Math.round(pl.x / 100) * 100, secs * 1000); if (secs > 8) logUsage("adv", "perf:" + P.id + ":" + (high ? "hd" : "sd") + ":" + Math.round(frames / secs) + "fps"); } } cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); try { delete (window as any).__advTest; } catch (e) {} };
  }, [P, high, me, cls]);

  const hold = (name) => ({
    onPointerDown: (e) => { e.preventDefault(); (keys.current as any)[name] = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} },
    onPointerUp: () => { (keys.current as any)[name] = false; }, onPointerCancel: () => { (keys.current as any)[name] = false; }, onLostPointerCapture: () => { (keys.current as any)[name] = false; },
  });
  const pct = (a, b) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100)) + "%";
  return (
    <>
      <canvas ref={cvRef} />
      <div ref={petRef} className="adv-px" aria-hidden="true">{petNow ? <PetArt species={petNow.species} level={petLevel(petNow.bond).lv} mood={petNow.mood} /> : null}</div>
      <div ref={pxRef} className="adv-px" aria-hidden="true">
        <CyberAvatar model={me} yaw={26} pose={pose} glow={colorway && colorway.glow} accent={colorway && colorway.accent} held={null} hat={null} acc={null} />
      </div>
      <div className="adv-top">
        <button className="adv-btn" onClick={() => { playUi && playUi("click"); onExit(); }} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">Lv {hud.lv} · {P.en.split(" · ")[0]} · ☠ {hud.kills} · ◆ {hud.cry || 0}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct(hud.hp, hud.hpMax) }} /><b>HP {Math.round(hud.hp)} / {hud.hpMax}</b></div>
          <div className="adv-bar adv-xp"><i style={{ width: pct(hud.xp, hud.xpNeed) }} /><b>EXP</b></div>
          <div className="adv-bar adv-sk"><i style={{ width: pct(hud.sk, hud.skNeed) }} /><b>{t("สกิล", "SKILL", "技能")} R{hud.rank || 1}</b></div>
        </div>
        <button className="adv-btn" onClick={() => setMusicOn(m => !m)} aria-label="music" aria-pressed={musicOn}>{musicOn ? "♪" : "♪̸"}</button>
        <button className="adv-btn" onClick={onGfx} aria-label="graphics">{high ? "HD" : "SD"}</button>
      </div>
      {banner && <div key={banner.k} className="adv-banner"><b>{banner.a}</b><span>{banner.b}</span></div>}
      {down && <div className="adv-banner" style={{ animation: "none" }}><b style={{ color: "#ff8fa3" }}>{t("ล้ม!", "DOWN!", "倒下了！")}</b><span>{t("กำลังกลับจุดเริ่ม…", "Back to the start…", "回到起点…")}</span></div>}
      {quiz && <QuizCard quiz={quiz} lang={lang} onKey={(pc, name) => {
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
          <button className={"pvpdir" + (hud.dashCd > 0 ? " cool" : "")} aria-label="dash" {...hold("dash")}>»</button>
        </div>
        <div className="pvppad-r">
          <button className="pvpact fire" aria-label="shoot" {...hold("fire")}><b>🔫</b><i>{t("ยิง", "FIRE", "射击")}</i></button>
          <button className="pvpact jump" aria-label="jump" {...hold("jump")}><b>⤴</b><i>{t("กระโดด", "JUMP", "跳跃")}</i></button>
          <button className="pvpact punch" aria-label="attack" {...hold("atk")}><b>👊</b><i>{t("ต่อย", "PUNCH", "拳击")}</i></button>
          <button className="pvpact kick" aria-label="kick" {...hold("kick")}><b>🦵</b><i>{t("เตะ", "KICK", "踢击")}</i></button>
          <button className={"pvpact ult" + (hud.skCd > 0 ? " cool" : "")} aria-label="skill" {...hold("skl")}><b>✦</b><i>{t("สกิล", "SKILL", "技能")}</i></button>
          <button className={"pvpact spell" + ((hud.spell || 0) >= 100 ? " ready" : " cool")} aria-label="spell" style={{ "--sp": (hud.spell || 0) + "%" } as any} {...hold("spell")}><b>🎹</b><i>{(hud.spell || 0) >= 100 ? t("เวทย์คอร์ด", "SPELL", "和弦术") : (hud.spell || 0) + "%"}</i></button>
        </div>
      </div>
    </>
  );
});

/** The question card: choice buttons or a piano to tap; a wrong answer shows the right notes lit on the keys and why. */
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
