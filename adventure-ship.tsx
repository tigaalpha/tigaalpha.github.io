/* Adventure: the starship dogfight (owner request, 2026-10-11: "drive a spaceship and shoot the aliens").
   A side-scrolling shooter in its own lazy chunk. The robot pilots; waves of drones, fighters and bombers, then a mothership.
   It pays EXP / crystals / loot through the callbacks the map menu gives it, never coins directly. */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const W = 960, H = 480, BOSS_AT = 55;
const mg = (x: CanvasRenderingContext2D, y0: number, y1: number, base: string) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "rgba(255,255,255,.5)"); g.addColorStop(0.2, base); g.addColorStop(1, "#06080e"); return g; };
const pl = (x: CanvasRenderingContext2D, pts: number[][]) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); };
/** the pilot's starfighter: swept wings, a glowing canopy in the robot's colour, twin engines, wing-tip lights, panel lines */
function drawPlayer(x: CanvasRenderingContext2D, glow: string, t: number) {
  x.globalCompositeOperation = "lighter"; for (const sd of [-1, 1]) { const fl = 24 + Math.random() * 12 + Math.sin(t * 30) * 3, g = x.createLinearGradient(-26, sd * 9, -26 - fl, sd * 9); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.3, "rgba(" + glow + ",.9)"); g.addColorStop(1, "rgba(" + glow + ",0)"); x.fillStyle = g; x.beginPath(); x.moveTo(-24, sd * 9 - 4); x.lineTo(-26 - fl, sd * 9); x.lineTo(-24, sd * 9 + 4); x.fill(); } x.globalCompositeOperation = "source-over";
  x.fillStyle = mg(x, -30, 30, "#8a98ae"); pl(x, [[40, 0], [10, -6], [-2, -30], [-20, -28], [-16, -8], [-26, -8], [-26, 8], [-16, 8], [-20, 28], [-2, 30], [10, 6]]); x.fill();
  x.strokeStyle = "rgba(10,16,26,.85)"; x.lineWidth = 1; x.stroke(); x.beginPath(); x.moveTo(8, -5); x.lineTo(-14, -26); x.moveTo(8, 5); x.lineTo(-14, 26); x.moveTo(-6, -2); x.lineTo(-24, -2); x.moveTo(-6, 2); x.lineTo(-24, 2); x.stroke();
  x.fillStyle = "#1c2636"; pl(x, [[40, 0], [14, -4], [14, 4]]); x.fill(); x.fillStyle = "rgba(" + glow + ",.9)"; x.beginPath(); x.ellipse(8, 0, 11, 4, 0, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.7)"; x.beginPath(); x.ellipse(11, -1, 5, 1.4, 0, 0, 7); x.fill();
  x.fillStyle = "#3a4a62"; x.fillRect(-26, -12, 8, 5); x.fillRect(-26, 7, 8, 5); x.globalCompositeOperation = "lighter"; x.fillStyle = Math.floor(t * 4) % 2 ? "rgba(255,70,90,.95)" : "rgba(255,70,90,.3)"; x.beginPath(); x.arc(-18, -28, 2, 0, 7); x.fill(); x.fillStyle = Math.floor(t * 4) % 2 ? "rgba(90,255,150,.3)" : "rgba(90,255,150,.95)"; x.beginPath(); x.arc(-18, 28, 2, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
}
/** the alien fleet: scarab drones, raiders, dreadnought carriers, wasps and bio-bombs */
function drawEnemy(x: CanvasRenderingContext2D, e: any) {
  const hit = e.hit > 0, base = hit ? "#fff" : null, eyeG = (ex: number, ey: number, r: number, c: string) => { x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(ex, ey, 0, ex, ey, r * 3); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.3, c); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r * 3, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; };
  x.save(); x.translate(e.x, e.y);
  if (e.type === "drone") {   // scarab: an armoured pod with two forward mandibles
    x.fillStyle = base || mg(x, -16, 16, "#b0408a"); x.beginPath(); x.ellipse(0, 0, 18, 13, 0, 0, 7); x.fill(); x.strokeStyle = "#ff7ac8"; x.lineWidth = 1.5; x.stroke(); x.fillStyle = base || "#4a1838"; pl(x, [[-14, -6], [-30, -16], [-20, -2]]); x.fill(); pl(x, [[-14, 6], [-30, 16], [-20, 2]]); x.fill(); x.strokeStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.moveTo(-2, -12); x.lineTo(-2, 12); x.moveTo(6, -10); x.lineTo(6, 10); x.stroke(); eyeG(-8, 0, 3, "rgba(255,230,90,.95)");
  } else if (e.type === "fighter") {   // raider: dark angular hull, orange engine, a glowing nose cannon
    x.fillStyle = base || mg(x, -22, 22, "#5a3a3a"); pl(x, [[-28, 0], [6, -22], [24, -8], [24, 8], [6, 22]]); x.fill(); x.strokeStyle = "#ff8a3a"; x.lineWidth = 1.4; x.stroke(); x.fillStyle = base || "#241014"; pl(x, [[2, -10], [20, -4], [20, 4], [2, 10]]); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,150,50,.9)"; x.fillRect(16, -2, 14, 4); eyeG(26, 0, 2.4, "rgba(255,120,40,.95)"); x.fillStyle = "rgba(255,90,30,.8)"; x.beginPath(); x.arc(22, -22 + 0, 0, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  } else if (e.type === "wasp") {   // wasp: a winged living fighter
    x.globalAlpha = 0.55; x.fillStyle = "rgba(190,230,255,.7)"; for (const sd of [-1, 1]) { x.save(); x.rotate(sd * (0.3 + Math.sin(e.ph * 40) * 0.4)); x.beginPath(); x.ellipse(2, sd * 16, 18, 6, 0, 0, 7); x.fill(); x.restore(); } x.globalAlpha = 1;
    x.fillStyle = base || mg(x, -10, 10, "#7ad04a"); x.beginPath(); x.ellipse(0, 0, 14, 8, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(-18, 0, 10, 6, 0, 0, 7); x.fill(); x.fillStyle = base || "#2a4a14"; pl(x, [[-26, 0], [-40, -2], [-40, 2]]); x.fill(); eyeG(10, -2, 2, "rgba(255,90,60,.95)"); eyeG(10, 2, 2, "rgba(255,90,60,.95)");
  } else if (e.type === "kamikaze") {   // bio-bomb: a spiked sac with a pulsing core
    const p = 0.6 + 0.4 * Math.sin(e.ph * 12); x.fillStyle = base || mg(x, -16, 16, "#c8442a"); x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill(); x.fillStyle = base || "#4a1208"; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + e.ph; pl(x, [[Math.cos(a - 0.2) * 13, Math.sin(a - 0.2) * 13], [Math.cos(a) * 24, Math.sin(a) * 24], [Math.cos(a + 0.2) * 13, Math.sin(a + 0.2) * 13]]); x.fill(); } eyeG(0, 0, 4 + p * 2, "rgba(255,200,60," + (0.5 + p * 0.5) + ")");
  } else {   // dreadnought carrier: a heavy plated hull with turret blisters and a glowing hangar
    x.fillStyle = base || mg(x, -26, 26, "#4a5a8a"); pl(x, [[-36, -8], [-24, -26], [30, -24], [38, 0], [30, 24], [-24, 26], [-36, 8]]); x.fill(); x.strokeStyle = "#8aa0ff"; x.lineWidth = 1.6; x.stroke(); x.strokeStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.moveTo(-20, -24); x.lineTo(-20, 24); x.moveTo(6, -24); x.lineTo(6, 24); x.stroke(); x.fillStyle = base || "#1a2240"; x.beginPath(); x.arc(-8, -18, 6, 0, 7); x.arc(18, 17, 6, 0, 7); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,200,90,.85)"; x.fillRect(-34, -3, 8, 6); eyeG(30, 0, 3, "rgba(255,90,90,.95)"); x.globalCompositeOperation = "source-over";
  }
  if (e.max > 6 && e.hp < e.max) { x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(-20, -e.r - 10, 40, 4); x.fillStyle = "#ff6b81"; x.fillRect(-20, -e.r - 10, 40 * Math.max(0, e.hp / e.max), 4); }
  x.restore();
}
/** the Hive Mothership: a horned crescent of armour and bone, hangar mouths, a triple reactor eye, engines on its back */
function drawBoss(x: CanvasRenderingContext2D, B: any) {
  const hit = B.hit > 0, rage = B.hp < B.max / 2, p = 0.6 + 0.4 * Math.sin(B.ph * 6);
  x.save(); x.translate(B.x, B.y);
  x.globalCompositeOperation = "lighter"; for (let k = -2; k <= 2; k++) { const g = x.createLinearGradient(80, k * 24, 170, k * 24); g.addColorStop(0, "rgba(160,110,255,.9)"); g.addColorStop(1, "rgba(160,110,255,0)"); x.fillStyle = g; x.fillRect(80, k * 24 - 5, 90 + Math.sin(B.ph * 8 + k) * 14, 10); } x.globalCompositeOperation = "source-over";
  x.fillStyle = hit ? "#fff" : mg(x, -86, 86, rage ? "#5a2a4a" : "#3c3068"); pl(x, [[-100, 0], [-70, -34], [-60, -76], [-30, -60], [10, -86], [60, -62], [96, -38], [100, 0], [96, 38], [60, 62], [10, 86], [-30, 60], [-60, 76], [-70, 34]]); x.fill();
  x.strokeStyle = rage ? "#ff5a7a" : "#a98aff"; x.lineWidth = 3; x.stroke();
  x.fillStyle = hit ? "#fff" : "#161030"; for (const sy of [-1, 1]) { pl(x, [[-60, sy * 76], [-96, sy * 104], [-40, sy * 66]]); x.fill(); pl(x, [[10, sy * 86], [-10, sy * 118], [34, sy * 78]]); x.fill(); }
  x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 2; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(-70, i * 18); x.lineTo(90, i * 14); x.stroke(); }
  x.fillStyle = "#07040f"; for (const hy of [-44, 44]) { x.beginPath(); x.ellipse(-10, hy, 26, 9, 0, 0, 7); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,170,70,.55)"; x.fillRect(-30, hy - 2, 40, 4); x.globalCompositeOperation = "source-over"; x.fillStyle = "#07040f"; }   // hangar mouths
  x.globalCompositeOperation = "lighter"; for (const [ex, ey, r] of [[-44, 0, 16], [-44, -26, 8], [-44, 26, 8]] as number[][]) { const g = x.createRadialGradient(ex, ey, 0, ex, ey, r * 3); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.3, rage ? "rgba(255,50,90," + (0.5 + p * 0.5) + ")" : "rgba(255,90,140," + (0.5 + p * 0.5) + ")"); g.addColorStop(1, "rgba(255,40,100,0)"); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r * 3, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over";
  x.restore();
}
const LOOTK = ["scrap", "ore", "gold", "core"] as const;

const toRgb = (g: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(g || ""); if (m) { const n = parseInt(m[1], 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; } return /^\d+,\s*\d+,\s*\d+$/.test(g || "") ? g : "127,232,255"; };
export default function AdventureShip({ P, lang, ups, glow: glow0, onWin, onExit }: any) {
  const glow = toRgb(glow0);
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const cv = useRef<HTMLCanvasElement>(null); const keys = useRef<any>({});
  const [ui, setUi] = useState<any>({ hp: 100, boss: 0, bossOn: false, t: 0, kills: 0, over: false, win: false, ms: 0 });
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    const c = cv.current; if (!c) return undefined; const x = c.getContext("2d"); if (!x) return undefined; let raf = 0, last = performance.now(), dead = false;
    const sfx = createAdvSfx(); const mus = createAdvMusic("nexa"); if (mus) { mus.start(); mus.setIntensity && mus.setIntensity(2); }
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const fit = () => { const r = c.getBoundingClientRect(); c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }; fit(); window.addEventListener("resize", fit);
    const HP = Math.round(100 * (1 + 0.05 * (ups.hp || 0))), DMG = 1 + 0.05 * (ups.atk || 0), SALVO = 1 + ((ups.rkt || 0) >= 2 ? 1 : 0) + ((ups.rkt || 0) >= 4 ? 1 : 0);
    const hard = P.hard || 1;
    let S: any;
    const reset = () => { S = { t: 0, ship: { x: 140, y: H / 2, hp: HP, inv: 0, fireCd: 0, mCd: 0 }, bl: [], eb: [], en: [], ms: [], pk: [], pt: [], stars: S ? S.stars : Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 })), spawn: 1, kills: 0, cry: 0, loot: { scrap: 0, ore: 0, gold: 0, core: 0 }, boss: null as any, bossSpawned: false, over: false, win: false, endT: 0, shake: 0 }; setUi({ hp: HP, boss: 0, bossOn: false, t: 0, kills: 0, over: false, win: false, ms: 0 }); };
    reset(); retry.current = () => { reset(); };
    const burst = (px: number, py: number, n: number, col: string, sp = 220) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = Math.random() * sp; S.pt.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, col }); } };
    const dropLoot = (px: number, py: number, rich: number) => { if (Math.random() < 0.7) S.pk.push({ x: px, y: py, k: "cry" }); if (Math.random() < 0.45 * rich) S.pk.push({ x: px + 8, y: py + 8, k: LOOTK[Math.min(3, Math.floor(Math.random() * Math.random() * 4 * rich))] }); };
    const addEnemy = (type: string, y: number) => { const tp: any = { drone: { hp: 3, r: 16 }, fighter: { hp: 6, r: 20 }, bomber: { hp: 16, r: 30 }, wasp: { hp: 2, r: 14 }, kamikaze: { hp: 4, r: 16 } }[type]; S.en.push({ type, x: W + 40, y, hp: tp.hp, max: tp.hp, r: tp.r, ph: Math.random() * 6, cd: 1 + Math.random() }); };
    const hurtEn = (e: any, d: number) => { e.hp -= d; e.hit = 0.08; if (e.hp <= 0 && !e.dead) { e.dead = true; S.kills++; sfx.play("boom"); burst(e.x, e.y, 14, "255,170,70"); dropLoot(e.x, e.y, e.type === "bomber" ? 2 : 1); S.shake = Math.max(S.shake, 3); } };
    const step = (dt: number) => {
      const k = keys.current, s = S.ship; S.t += dt;
      if (!S.over && !S.win) {
        const sp = 330; s.x = Math.max(40, Math.min(W * 0.62, s.x + ((k.r ? 1 : 0) - (k.l ? 1 : 0)) * sp * dt)); s.y = Math.max(90, Math.min(H - 40, s.y + ((k.d ? 1 : 0) - (k.u ? 1 : 0)) * sp * dt));
        s.fireCd -= dt; s.mCd -= dt; s.inv -= dt;
        if (k.fire && s.fireCd <= 0) { s.fireCd = 0.13; S.bl.push({ x: s.x + 34, y: s.y - 7, vx: 820, vy: 0 }, { x: s.x + 34, y: s.y + 7, vx: 820, vy: 0 }); sfx.play("bolt"); }
        if (k.miss && s.mCd <= 0) { s.mCd = 3 * (1 - 0.06 * (ups.rkt || 0)); for (let q = 0; q < SALVO; q++) S.ms.push({ x: s.x + 20, y: s.y + (q - (SALVO - 1) / 2) * 16, vx: 380, vy: (q - (SALVO - 1) / 2) * 120, life: 2.4 }); sfx.play("rocket"); }
        // waves, then the mothership
        if (!S.bossSpawned) { S.spawn -= dt; if (S.spawn <= 0) { S.spawn = Math.max(0.55, 1.5 - S.t * 0.014); const r = Math.random(), y = 50 + Math.random() * (H - 100); addEnemy(r < 0.3 ? "drone" : r < 0.5 ? "wasp" : r < 0.7 ? "fighter" : r < 0.85 ? "kamikaze" : "bomber", y); if (r < 0.3) addEnemy("wasp", H - y); } }
        if (!S.bossSpawned && S.t >= BOSS_AT) { S.bossSpawned = true; S.en.forEach((e: any) => { e.dead = true; burst(e.x, e.y, 6, "255,120,80"); }); S.boss = { x: W + 160, y: H / 2, hp: 240, max: 240, cd: 1.4, sp: 3, ph: 0 }; sfx.play("boss"); if (mus && mus.setBoss) mus.setBoss(true); }
      }
      for (const b of S.bl) { b.x += b.vx * dt; b.y += b.vy * dt; } S.bl = S.bl.filter((b: any) => b.x < W + 20);
      for (const m of S.ms) { let tg: any = null, bd = 1e9; for (const e of S.en) if (!e.dead) { const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; tg = e; } } if (S.boss && !S.boss.dead && (!tg || Math.abs(S.boss.x - m.x) < bd)) tg = S.boss;
        if (tg) { const a = Math.atan2(tg.y - m.y, tg.x - m.x), v = Math.hypot(m.vx, m.vy), na = Math.atan2(m.vy, m.vx), d2 = Math.atan2(Math.sin(a - na), Math.cos(a - na)); const a2 = na + Math.max(-4 * dt, Math.min(4 * dt, d2)); const v2 = Math.min(560, v + 400 * dt); m.vx = Math.cos(a2) * v2; m.vy = Math.sin(a2) * v2; }
        m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt; S.pt.push({ x: m.x - 8, y: m.y, vx: -80, vy: (Math.random() - 0.5) * 30, life: 0.4, max: 0.4, col: "255,200,120" });
        let boom = m.life <= 0; for (const e of S.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 8) boom = true; if (S.boss && !S.boss.dead && Math.abs(S.boss.x - m.x) < 90 && Math.abs(S.boss.y - m.y) < 80) boom = true;
        if (boom) { m.dead = true; sfx.play("boom"); S.shake = Math.max(S.shake, 6); burst(m.x, m.y, 26, "255,190,90", 320); for (const e of S.en) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < 110) hurtEn(e, 12 * DMG); if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - m.x, S.boss.y - m.y) < 150) { S.boss.hp -= 14 * DMG; } } }
      S.ms = S.ms.filter((m: any) => !m.dead);
      for (const e of S.en) { if (e.dead) continue; e.ph += dt; e.hit = Math.max(0, (e.hit || 0) - dt);
        if (e.type === "drone") { e.x -= 170 * dt; e.y += Math.sin(e.ph * 3) * 120 * dt; }
        else if (e.type === "wasp") { e.x -= 230 * dt; e.y += Math.sin(e.ph * 6) * 190 * dt; }
        else if (e.type === "kamikaze") { const a = Math.atan2(S.ship.y - e.y, S.ship.x - e.x); e.x += Math.cos(a) * 210 * dt - 40 * dt; e.y += Math.sin(a) * 210 * dt; }
        else if (e.type === "fighter") { if (e.x > W * 0.72) e.x -= 140 * dt; e.y += Math.sin(e.ph * 1.6) * 60 * dt; e.cd -= dt; if (e.cd <= 0) { e.cd = 1.7; const a = Math.atan2(S.ship.y - e.y, S.ship.x - e.x); S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300 }); } }
        else { e.x -= 70 * dt; e.cd -= dt; if (e.cd <= 0) { e.cd = 2.2; for (const dy of [-1, 0, 1]) S.eb.push({ x: e.x, y: e.y, vx: -260, vy: dy * 90 }); } }
        for (const b of S.bl) if (!b.dead && Math.abs(b.x - e.x) < e.r + 6 && Math.abs(b.y - e.y) < e.r + 4) { b.dead = true; hurtEn(e, DMG); }
        if (!e.dead && !S.over && S.ship.inv <= 0 && Math.hypot(e.x - S.ship.x, e.y - S.ship.y) < e.r + 14) { hurtShip(10 * Math.sqrt(hard)); e.hp = 0; hurtEn(e, 0); } }
      S.en = S.en.filter((e: any) => !e.dead && e.x > -60); S.bl = S.bl.filter((b: any) => !b.dead);
      const B = S.boss; if (B && !B.dead) { if (B.x > W - 170) B.x -= 120 * dt; B.ph += dt; B.y = H / 2 + Math.sin(B.ph * 0.9) * 150; B.cd -= dt; const rage = B.hp < B.max / 2;
        if (B.cd <= 0) { B.cd = rage ? 0.9 : 1.4; const n = rage ? 7 : 5, base = Math.atan2(S.ship.y - B.y, S.ship.x - B.x); for (let q = 0; q < n; q++) { const a = base + (q - (n - 1) / 2) * 0.22; S.eb.push({ x: B.x - 60, y: B.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, big: true }); } B.sp--; if (B.sp <= 0) { B.sp = 3; addEnemy("drone", B.y - 60); addEnemy("drone", B.y + 60); } }
        for (const b of S.bl) if (!b.dead && Math.abs(b.x - B.x) < 80 && Math.abs(b.y - B.y) < 70) { b.dead = true; B.hp -= DMG; B.hit = 0.06; burst(b.x, b.y, 2, "255,220,150", 120); }
        if (B.hp <= 0) { B.dead = true; S.win = true; S.endT = 0; sfx.play("win"); S.shake = 14; burst(B.x, B.y, 90, "255,200,120", 520); for (let q = 0; q < 14; q++) dropLoot(B.x + (Math.random() - 0.5) * 120, B.y + (Math.random() - 0.5) * 120, 3); } }
      const hurtShip = (d: number) => { if (S.over || S.win || S.ship.inv > 0) return; S.ship.hp -= d; S.ship.inv = 0.9; S.shake = 6; sfx.play("hurt"); burst(S.ship.x, S.ship.y, 10, "255,90,110"); if (S.ship.hp <= 0) { S.ship.hp = 0; S.over = true; burst(S.ship.x, S.ship.y, 50, "255,150,90", 400); } };
      for (const b of S.eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (!S.over && Math.hypot(b.x - S.ship.x, b.y - S.ship.y) < (b.big ? 16 : 12)) { b.dead = true; hurtShip((b.big ? 9 : 7) * Math.sqrt(hard)); } }
      S.eb = S.eb.filter((b: any) => !b.dead && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
      for (const p of S.pk) { const dx = S.ship.x - p.x, dy = S.ship.y - p.y, d = Math.hypot(dx, dy); if (d < 160 && !S.over) { p.x += dx / d * 420 * dt; p.y += dy / d * 420 * dt; } else p.x -= 60 * dt; if (d < 26) { p.dead = true; sfx.play("pickup"); if (p.k === "cry") S.cry++; else S.loot[p.k]++; } }
      S.pk = S.pk.filter((p: any) => !p.dead && p.x > -20);
      for (const p of S.pt) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } S.pt = S.pt.filter((p: any) => p.life > 0).slice(-400);
      for (const st of S.stars) { st.x -= (40 + st.z * 260) * dt; if (st.x < 0) { st.x = W; st.y = Math.random() * H; } }
      S.shake = Math.max(0, S.shake - 30 * dt);
      if (S.win) { S.endT += dt; if (S.endT > 2.6 && !dead) { dead = true; onWin({ kills: S.kills, cry: S.cry, loot: S.loot }); } }
    };
    const draw = () => {
      const k2 = c.width / W; x.setTransform(k2, 0, 0, k2, 0, 0); const sh = S.shake; x.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#02030c"); g.addColorStop(1, "#0b0a24"); x.fillStyle = g; x.fillRect(-10, -10, W + 20, H + 20);
      // a distant planet and nebula
      const ng = x.createRadialGradient(W * 0.75, H * 0.3, 10, W * 0.75, H * 0.3, 260); ng.addColorStop(0, "rgba(150,90,255,.28)"); ng.addColorStop(1, "rgba(150,90,255,0)"); x.fillStyle = ng; x.fillRect(0, 0, W, H);
      for (const st of S.stars) { x.fillStyle = "rgba(210,225,255," + (0.3 + st.z * 0.7) + ")"; x.fillRect(st.x, st.y, 1 + st.z * 1.6, 1 + st.z * 1.2); }
      for (const p of S.pk) { x.fillStyle = p.k === "cry" ? "#7fe8ff" : p.k === "scrap" ? "#b8b8c8" : p.k === "ore" ? "#ffb060" : p.k === "gold" ? "#ffd23f" : "#c78bff"; x.beginPath(); x.arc(p.x, p.y, p.k === "cry" ? 6 : 5, 0, 7); x.fill(); }
      for (const e of S.en) drawEnemy(x, e);
      const B = S.boss; if (B && !B.dead) drawBoss(x, B);
      x.globalCompositeOperation = "lighter";
      for (const b of S.bl) { x.fillStyle = "rgba(" + glow + ",.95)"; x.fillRect(b.x - 12, b.y - 2, 24, 4); }
      for (const b of S.eb) { x.fillStyle = b.big ? "rgba(255,80,120,.95)" : "rgba(255,170,60,.95)"; x.beginPath(); x.arc(b.x, b.y, b.big ? 7 : 5, 0, 7); x.fill(); }
      for (const m of S.ms) { x.fillStyle = "#fff6c8"; x.beginPath(); x.arc(m.x, m.y, 5, 0, 7); x.fill(); }
      for (const p of S.pt) { x.fillStyle = "rgba(" + p.col + "," + Math.max(0, p.life / p.max) + ")"; x.fillRect(p.x, p.y, 3, 3); }
      x.globalCompositeOperation = "source-over";
      const s = S.ship; if (!S.over) { x.save(); x.translate(s.x, s.y); if (s.inv > 0 && Math.floor(S.t * 20) % 2) x.globalAlpha = 0.4; drawPlayer(x, glow, S.t); x.restore(); }
    };
    const frame = (now: number) => { raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (document.hidden) return; step(dt); draw(); };
    raf = requestAnimationFrame(frame);
    const hudT = setInterval(() => { setUi({ hp: Math.max(0, Math.round(S.ship.hp)), boss: S.boss ? Math.max(0, S.boss.hp / S.boss.max) : 0, bossOn: !!S.boss && !S.boss.dead, t: Math.floor(S.t), kills: S.kills, over: S.over, win: S.win, ms: Math.max(0, S.ship.mCd) }); }, 150);
    const kd = (e: KeyboardEvent, v: boolean) => { const cd = e.code, k = keys.current; if (cd === "ArrowLeft" || cd === "KeyA") k.l = v; else if (cd === "ArrowRight" || cd === "KeyD") k.r = v; else if (cd === "ArrowUp" || cd === "KeyW") k.u = v; else if (cd === "ArrowDown" || cd === "KeyS") k.d = v; else if (cd === "Space" || cd === "KeyJ") k.fire = v; else if (cd === "KeyK" || cd === "KeyY") k.miss = v; };
    const dn = (e: KeyboardEvent) => kd(e, true), up = (e: KeyboardEvent) => kd(e, false); window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    (window as any).__advShip = { state: () => ({ t: S.t, hp: S.ship.hp, kills: S.kills, en: S.en.length, boss: S.boss ? { hp: S.boss.hp, dead: !!S.boss.dead } : null, over: S.over, win: S.win, cry: S.cry, bl: S.bl.length, ms: S.ms.length }), skip: () => { S.t = BOSS_AT - 0.1; }, god: () => { S.ship.hp = 1e6; }, killBoss: () => { if (S.boss) S.boss.hp = 0.5; }, dieNow: () => { S.ship.inv = 0; S.ship.hp = 0.1; S.eb.push({ x: S.ship.x, y: S.ship.y, vx: 0, vy: 0 }); }, spawn: (ty: string) => addEnemy(ty, S.ship.y) };
    return () => { cancelAnimationFrame(raf); clearInterval(hudT); window.removeEventListener("resize", fit); window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advShip; } catch (e) {} };
  }, []);
  const hold = (name: string) => ({
    onPointerDown: (e: any) => { e.preventDefault(); keys.current[name] = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} },
    onPointerUp: () => { keys.current[name] = false; }, onPointerCancel: () => { keys.current[name] = false; }, onLostPointerCapture: () => { keys.current[name] = false; },
  });
  return (
    <div className="adv-ship">
      <canvas ref={cv} />
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">☠ {ui.kills} · {ui.bossOn ? t("มาเธอร์ชิป", "MOTHERSHIP", "母舰") : t("ถึงมาเธอร์ชิปใน ", "Mothership in ", "母舰到来 ") + Math.max(0, 55 - ui.t) + "s"}</div>
          <div className="adv-bar adv-hp"><i style={{ width: Math.max(0, Math.min(100, ui.hp)) + "%" }} /><b>HP {ui.hp}</b></div>
          {ui.bossOn && <div className="adv-bar adv-sk"><i style={{ width: ui.boss * 100 + "%" }} /><b>{t("มาเธอร์ชิป", "MOTHERSHIP", "母舰")}</b></div>}
        </div>
      </div>
      {(ui.over || ui.win) && <div className="adv-clear" role="dialog" aria-label="ship result">{ui.win ? t("ชนะ! กำลังสรุปผล…", "Victory! Tallying…", "胜利！结算中…") : <><b>{t("ยานถูกทำลาย", "Ship destroyed", "战机被毁")}</b><button className="adv-btn go" onClick={() => retry.current()}>↻ {t("ลองใหม่", "Retry", "重试")}</button><button className="adv-btn" onClick={() => onExit()}>{t("กลับแผนที่", "Back to map", "返回地图")}</button></>}</div>}
      <div className="adv-pad">
        <div className="pvppad-l">
          <button className="pvpdir" aria-label="up" {...hold("u")}>▲</button>
          <button className="pvpdir" aria-label="left" {...hold("l")}>◀</button>
          <button className="pvpdir" aria-label="right" {...hold("r")}>▶</button>
          <button className="pvpdir" aria-label="down" {...hold("d")}>▼</button>
        </div>
        <div className="pvppad-r">
          <button className="pvpact fire" aria-label="shoot" {...hold("fire")}><b>🔫</b><i>{t("ยิง", "FIRE", "射击")}</i></button>
          <button className={"pvpact rocket" + (ui.ms > 0.05 ? " cool" : "")} aria-label="missile" {...hold("miss")}><b>🚀</b><i>{t("มิสไซล์", "MISSILE", "导弹")}</i></button>
        </div>
      </div>
    </div>
  );
}
