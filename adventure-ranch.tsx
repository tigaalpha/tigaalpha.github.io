/* Adventure: the Space Ranch (owner, 2026-10-13: "make the farming and animal level look like a farm game such as FarmVille, cartoon CG with cows and chickens, as its own separate level").
   A cheerful cartoon farm under a glass dome on a colony world: eight plots to plant, water and harvest, four pens of animals (cow, chicken, pig, sheep) that have to be fed
   and then give milk, eggs, bacon and wool, a barn that counts the food, and a delivery rocket that carries it to the hungry colony. Everything is drawn from code on one canvas
   (soft hills, grass tufts, a red barn, a spinning windmill, fences, round-eyed animals that wander, crops that grow through three stages and bounce when ripe).
   Win = the colony has received its food quota. No coins, crystals + EXP only. */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
type L3 = [string, string, string];
const VW = 800, VH = 450;
const QUOTA: Record<string, number> = { moon: 260, mars: 300, titan: 340, proxima: 400 }, TIMEMUL: Record<string, number> = { moon: 1, mars: 1.1, titan: 1.25, proxima: 0.9 };   // a harsher world: a bigger quota and slower crops
const CROPS: { id: string; icon: string; name: L3; time: number; yield: number; col: string }[] = [
  { id: "carrot", icon: "🥕", name: ["แครอท", "Carrot", "胡萝卜"], time: 9, yield: 4, col: "#ff8a1f" },
  { id: "corn", icon: "🌽", name: ["ข้าวโพด", "Corn", "玉米"], time: 16, yield: 8, col: "#ffd23f" },
  { id: "tomato", icon: "🍅", name: ["มะเขือเทศ", "Tomato", "番茄"], time: 22, yield: 12, col: "#ff4a3a" },
  { id: "pumpkin", icon: "🎃", name: ["ฟักทอง", "Pumpkin", "南瓜"], time: 32, yield: 20, col: "#ff9a2a" },
];
const ANIMALS: { id: string; icon: string; prod: string; name: L3; pname: L3; feed: number; every: number; yield: number; x: number; y: number }[] = [
  { id: "cow", icon: "🐄", prod: "🥛", name: ["วัว", "Cow", "奶牛"], pname: ["นม", "milk", "牛奶"], feed: 2, every: 14, yield: 6, x: 618, y: 262 },
  { id: "chicken", icon: "🐔", prod: "🥚", name: ["ไก่", "Chicken", "母鸡"], pname: ["ไข่", "eggs", "鸡蛋"], feed: 1, every: 8, yield: 3, x: 722, y: 262 },
  { id: "pig", icon: "🐖", prod: "🥓", name: ["หมู", "Pig", "猪"], pname: ["เบคอน", "bacon", "培根"], feed: 2, every: 12, yield: 5, x: 618, y: 372 },
  { id: "sheep", icon: "🐑", prod: "🧶", name: ["แกะ", "Sheep", "绵羊"], pname: ["ขนแกะ", "wool", "羊毛"], feed: 1, every: 10, yield: 4, x: 722, y: 372 },
];
const PLOTS = Array.from({ length: 8 }, (_, i) => ({ x: 238 + (i % 4) * 82, y: 258 + Math.floor(i / 4) * 78 }));
const FACTS: L3[] = [
  ["ฟาร์มในโดมกระจกบนดาวอื่นต้องควบคุมอากาศ น้ำ และแสงให้พืชโดยเฉพาะ", "A farm under a glass dome on another world has to control air, water and light for its plants.", "在别的星球上，玻璃穹顶农场要为植物控制空气、水和光照。"],
  ["สัตว์ที่กินอิ่มจะให้ผลผลิตสม่ำเสมอ ฟาร์มที่ดีต้องเลี้ยงทั้งพืชและสัตว์ให้สมดุลกัน", "A well-fed animal gives steadily; a good farm balances its crops and its animals.", "吃饱的动物产出稳定；好农场要让种植与养殖保持平衡。"],
  ["อาณานิคมที่อยู่ไกลโลกต้องผลิตอาหารเองเกือบทั้งหมด เพราะยานส่งเสบียงมาได้นาน ๆ ครั้ง", "A colony far from Earth must grow almost all of its food itself; supply ships come rarely.", "远离地球的殖民地几乎要自己生产全部食物，补给船很少来。"],
];

function drawRanch(x: CanvasRenderingContext2D, S: any, T: number, kind: string) {
  const O = "#4a2c14";
  // sky inside the dome, with the world's planet or sun
  const SKYC: any = { moon: ["#6cc3ff", "#d8f2ff"], mars: ["#f7b56a", "#ffe0a8"], titan: ["#d9a45a", "#f3d8a0"], proxima: ["#ff8a7a", "#ffd0c0"] }, sc = SKYC[kind] || SKYC.moon;
  const g = x.createLinearGradient(0, 0, 0, 230); g.addColorStop(0, sc[0]); g.addColorStop(1, sc[1]); x.fillStyle = g; x.fillRect(0, 0, VW, 240);
  const bigRed = kind === "proxima", sunR = bigRed ? 52 : kind === "titan" ? 16 : 30; x.fillStyle = bigRed ? "#ff4a3a" : "#ffe36a"; x.beginPath(); x.arc(700, 66, sunR, 0, 7); x.fill(); x.fillStyle = bigRed ? "rgba(255,90,60,.35)" : "rgba(255,240,150,.4)"; x.beginPath(); x.arc(700, 66, sunR + 16, 0, 7); x.fill();
  if (kind === "titan") { x.fillStyle = "#e8c070"; x.beginPath(); x.arc(150, 70, 28, 0, 7); x.fill(); x.strokeStyle = "rgba(255,235,190,.9)"; x.lineWidth = 5; x.beginPath(); x.ellipse(150, 70, 52, 12, -0.3, 0, 7); x.stroke(); }   // Saturn over Titan
  else { x.fillStyle = "#3a6fe0"; x.beginPath(); x.arc(120, 54, 18, 0, 7); x.fill(); x.fillStyle = "#4fd08a"; x.beginPath(); x.arc(114, 50, 8, 0, 7); x.fill(); }   // a small Earth in the sky
  for (let i = 0; i < 3; i++) { const cx = ((T * 12 + i * 280) % 1000) - 100, cy = 40 + i * 34; x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.arc(cx, cy, 20, 0, 7); x.arc(cx + 22, cy + 4, 16, 0, 7); x.arc(cx - 20, cy + 6, 14, 0, 7); x.fill(); }
  // hills and the meadow
  x.fillStyle = "#8be07a"; x.beginPath(); x.moveTo(0, 210); x.quadraticCurveTo(160, 150, 330, 205); x.quadraticCurveTo(520, 160, 800, 200); x.lineTo(800, 250); x.lineTo(0, 250); x.fill();
  x.fillStyle = "#6fd05c"; x.fillRect(0, 232, VW, VH - 232);
  for (let i = 0; i < 90; i++) { const gx = (i * 137) % VW, gy = 240 + (i * 59) % (VH - 250); x.strokeStyle = "rgba(40,120,40,.35)"; x.lineWidth = 2; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx - 2, gy - 6); x.moveTo(gx + 3, gy); x.lineTo(gx + 4, gy - 7); x.stroke(); }
  for (let i = 0; i < 14; i++) { const fx = (i * 211) % VW, fy = 250 + (i * 83) % 190; x.fillStyle = ["#ff7ab8", "#fff", "#ffd23f"][i % 3]; x.beginPath(); x.arc(fx, fy, 3, 0, 7); x.fill(); }
  // the barn
  x.fillStyle = "#d9412f"; x.strokeStyle = O; x.lineWidth = 3; x.beginPath(); x.rect(26, 110, 130, 100); x.fill(); x.stroke();
  x.fillStyle = "#a82f20"; x.beginPath(); x.moveTo(14, 114); x.lineTo(91, 62); x.lineTo(168, 114); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = "#fff4dc"; x.beginPath(); x.rect(62, 146, 58, 64); x.fill(); x.stroke(); x.beginPath(); x.moveTo(62, 146); x.lineTo(120, 210); x.moveTo(120, 146); x.lineTo(62, 210); x.stroke();
  x.fillStyle = "#fff"; x.font = "900 15px system-ui"; x.textAlign = "center"; x.fillText("🌾 " + Math.floor(S.stock), 91, 100);
  // the windmill
  x.fillStyle = "#f4ead0"; x.strokeStyle = O; x.beginPath(); x.moveTo(668, 210); x.lineTo(684, 120); x.lineTo(716, 120); x.lineTo(732, 210); x.closePath(); x.fill(); x.stroke();
  x.save(); x.translate(700, 118); x.rotate(T * 0.8); x.fillStyle = "#fff"; for (let k = 0; k < 4; k++) { x.rotate(Math.PI / 2); x.beginPath(); x.rect(-4, -62, 8, 62); x.fill(); x.stroke(); } x.restore(); x.fillStyle = O; x.beginPath(); x.arc(700, 118, 6, 0, 7); x.fill();
  // the delivery rocket on its pad
  x.fillStyle = "#b8c4d8"; x.strokeStyle = O; x.beginPath(); x.ellipse(110, 330, 60, 16, 0, 0, 7); x.fill(); x.stroke();
  const ry = 330 - 40 - (S.launch > 0 ? (1 - S.launch / 2) * 360 : 0); x.save(); x.translate(110, ry); x.fillStyle = "#fff"; x.beginPath(); x.moveTo(0, -48); x.quadraticCurveTo(22, -20, 16, 34); x.lineTo(-16, 34); x.quadraticCurveTo(-22, -20, 0, -48); x.fill(); x.stroke(); x.fillStyle = "#ff5a4a"; x.beginPath(); x.moveTo(0, -48); x.quadraticCurveTo(10, -38, 12, -28); x.lineTo(-12, -28); x.quadraticCurveTo(-10, -38, 0, -48); x.fill(); x.fillStyle = "#6cc3ff"; x.beginPath(); x.arc(0, -6, 8, 0, 7); x.fill(); x.stroke();
  if (S.launch > 0) { x.fillStyle = "rgba(255,170,60,.9)"; x.beginPath(); x.moveTo(-10, 34); x.lineTo(0, 34 + 30 + 10 * Math.sin(T * 30)); x.lineTo(10, 34); x.fill(); } x.restore();
  // plots
  for (let i = 0; i < PLOTS.length; i++) { const p = PLOTS[i], c = S.plots[i]; x.fillStyle = c.w > 0 ? "#6b4226" : "#8b5a36"; x.strokeStyle = O; x.lineWidth = 3; x.beginPath(); x.roundRect(p.x - 34, p.y - 22, 68, 48, 8); x.fill(); x.stroke();
    x.strokeStyle = "rgba(60,30,10,.45)"; x.lineWidth = 2; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(p.x - 28, p.y + k * 12); x.lineTo(p.x + 28, p.y + k * 12); x.stroke(); }
    if (c.crop) { const cr = CROPS.find(q => q.id === c.crop)!, st = c.p < 34 ? 0 : c.p < 100 ? 1 : 2, bob = st === 2 ? Math.abs(Math.sin(T * 5 + i)) * 4 : 0; x.save(); x.translate(p.x, p.y + 6 - bob);
      x.fillStyle = "#3bbf4a"; x.strokeStyle = O; x.lineWidth = 2;
      if (st === 0) { x.beginPath(); x.ellipse(0, 6, 8, 5, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(0, 6); x.lineTo(-5, -4); x.lineTo(0, 0); x.lineTo(5, -4); x.closePath(); x.fill(); x.stroke(); }
      else { for (const dx of [-14, 0, 14]) { x.beginPath(); x.ellipse(dx, -2, 7, 14, dx / 40, 0, 7); x.fill(); x.stroke(); }
        if (st === 2) { x.fillStyle = cr.col; for (const dx of [-14, 0, 14]) { x.beginPath(); if (cr.id === "carrot") { x.moveTo(dx - 6, 8); x.lineTo(dx + 6, 8); x.lineTo(dx, 22); x.closePath(); } else if (cr.id === "corn") x.ellipse(dx, 4, 5, 11, 0, 0, 7); else x.arc(dx, 8, cr.id === "pumpkin" ? 10 : 7, 0, 7); x.fill(); x.stroke(); } x.fillStyle = "rgba(255,255,255,.9)"; x.fillRect(-2, -26 - bob, 4, 4); x.fillRect(10, -20 - bob, 3, 3); } }
      x.restore(); if (st < 2) { x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(p.x - 24, p.y + 26, 48, 5); x.fillStyle = "#7dff7a"; x.fillRect(p.x - 24, p.y + 26, 48 * c.p / 100, 5); } }
    if (c.w > 0) { x.fillStyle = "rgba(90,170,255,.8)"; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(p.x - 20 + k * 20, p.y - 14 + ((T * 30 + k * 9) % 14), 2, 0, 7); x.fill(); } } }
  // the pens: wooden fence, grass and four animals
  x.strokeStyle = O; x.lineWidth = 3; x.fillStyle = "#9be08a"; x.beginPath(); x.roundRect(556, 214, 238, 218, 14); x.fill(); x.stroke();
  x.fillStyle = "#c98a4a"; for (let fx = 560; fx < 794; fx += 26) { x.fillRect(fx, 208, 8, 18); x.fillRect(fx, 424, 8, 18); } x.fillRect(556, 214, 238, 5); x.fillRect(556, 428, 238, 5);
  for (let i = 0; i < ANIMALS.length; i++) { const a = ANIMALS[i], A = S.animals[i], wx = a.x + Math.sin(T * 0.7 + i * 2) * 26, wy = a.y + Math.cos(T * 0.5 + i) * 10 + (A.prog >= 100 ? -Math.abs(Math.sin(T * 6)) * 4 : 0);
    x.save(); x.translate(wx, wy); x.strokeStyle = O; x.lineWidth = 2.5; const face = Math.cos(T * 0.7 + i * 2) >= 0 ? 1 : -1; x.scale(face, 1);
    const body = (fill: string, rx: number, ry: number) => { x.fillStyle = fill; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill(); x.stroke(); };
    const eye = (ex: number, ey: number) => { x.fillStyle = "#fff"; x.beginPath(); x.arc(ex, ey, 4, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#222"; x.beginPath(); x.arc(ex + 1, ey, 2, 0, 7); x.fill(); };
    if (a.id === "cow") { body("#fff", 30, 20); x.fillStyle = "#222"; x.beginPath(); x.ellipse(-10, -6, 9, 6, 0, 0, 7); x.ellipse(8, 7, 8, 5, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(28, -6, 14, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#ffb0c0"; x.beginPath(); x.ellipse(36, 0, 8, 6, 0, 0, 7); x.fill(); x.stroke(); eye(26, -10); x.fillStyle = "#fff"; x.fillRect(-16, 14, 6, 14); x.fillRect(10, 14, 6, 14); }
    else if (a.id === "chicken") { body("#fff", 15, 13); x.fillStyle = "#fff"; x.beginPath(); x.arc(15, -9, 8, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#e23a2a"; x.beginPath(); x.arc(15, -18, 4, 0, 7); x.fill(); x.fillStyle = "#ffb020"; x.beginPath(); x.moveTo(22, -9); x.lineTo(30, -7); x.lineTo(22, -5); x.fill(); eye(17, -11); x.fillStyle = "#ffb020"; x.fillRect(-4, 12, 3, 8); x.fillRect(4, 12, 3, 8); }
    else if (a.id === "pig") { body("#ffa8c0", 26, 18); x.fillStyle = "#ffa8c0"; x.beginPath(); x.arc(24, -4, 12, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#ff7a9a"; x.beginPath(); x.ellipse(33, 0, 6, 5, 0, 0, 7); x.fill(); x.stroke(); eye(22, -9); x.beginPath(); x.moveTo(20, -14); x.lineTo(16, -22); x.lineTo(26, -16); x.fillStyle = "#ff8aa8"; x.fill(); x.stroke(); x.fillStyle = "#ffa8c0"; x.fillRect(-14, 14, 6, 12); x.fillRect(8, 14, 6, 12); }
    else { body("#fffaf0", 25, 20); for (const [bx, by] of [[-14, -8], [-4, -14], [8, -10], [-10, 6], [6, 8]]) { x.fillStyle = "#fffaf0"; x.beginPath(); x.arc(bx, by, 11, 0, 7); x.fill(); x.stroke(); } x.fillStyle = "#4a3a3a"; x.beginPath(); x.arc(26, -4, 10, 0, 7); x.fill(); x.stroke(); eye(24, -8); x.fillStyle = "#4a3a3a"; x.fillRect(-12, 16, 5, 12); x.fillRect(8, 16, 5, 12); }
    x.restore();
    const hungry = A.fed <= 0;
    if (hungry) { x.fillStyle = "rgba(255,255,255,.95)"; x.strokeStyle = O; x.lineWidth = 2; x.beginPath(); x.roundRect(wx - 18, wy - 56, 36, 24, 8); x.fill(); x.stroke(); x.fillStyle = "#222"; x.font = "16px system-ui"; x.textAlign = "center"; x.fillText("🍎", wx, wy - 38); }
    else if (A.prog >= 100) { x.fillStyle = "rgba(255,255,255,.95)"; x.strokeStyle = "#ffb020"; x.lineWidth = 3; x.beginPath(); x.roundRect(wx - 18, wy - 58 - Math.abs(Math.sin(T * 5)) * 4, 36, 26, 8); x.fill(); x.stroke(); x.font = "18px system-ui"; x.textAlign = "center"; x.fillText(a.prod, wx, wy - 38 - Math.abs(Math.sin(T * 5)) * 4); }
    else { x.fillStyle = "rgba(0,0,0,.3)"; x.fillRect(wx - 20, wy - 42, 40, 5); x.fillStyle = "#ffd23f"; x.fillRect(wx - 20, wy - 42, 40 * A.prog / 100, 5); } }
  // butterflies
  for (let i = 0; i < 3; i++) { const bx = 300 + i * 90 + Math.sin(T * 1.3 + i) * 50, by = 200 + Math.cos(T * 1.7 + i * 2) * 20; x.fillStyle = ["#ff7ab8", "#7ad0ff", "#ffe06a"][i]; x.beginPath(); x.ellipse(bx - 4, by, 5, 3 + Math.abs(Math.sin(T * 14 + i)) * 3, 0, 0, 7); x.ellipse(bx + 4, by, 5, 3 + Math.abs(Math.sin(T * 14 + i)) * 3, 0, 0, 7); x.fill(); }
  // glass dome shine
  x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 5; x.beginPath(); x.moveTo(0, VH - 4); x.quadraticCurveTo(VW / 2, -120, VW, VH - 4); x.stroke(); x.strokeStyle = "rgba(255,255,255,.16)"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 150); x.lineTo(VW, 150); x.moveTo(VW / 2, 0); x.lineTo(VW / 2, 232); x.stroke();
}

export default function AdventureRanch({ P, lang, onWin, onExit, onRetry }: any) {
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const farmerBonus = (() => { try { return localStorage.getItem("tg_adv_career") === "farm" ? 1.25 : 1; } catch (e) { return 1; } })();
  const G = useRef<any>(null);
  if (!G.current) G.current = { quota: QUOTA[P.kind] || 260, tm: TIMEMUL[P.kind] || 1, t: 0, stock: 6, delivered: 0, seed: "carrot", plots: PLOTS.map(() => ({ crop: null as any, p: 0, w: 0 })), animals: ANIMALS.map(() => ({ fed: 0, prog: 0 })), launch: 0, ended: false, won: false, fact: 0 };
  const S = G.current;
  const [, setTick] = useState(0), [gear, setGear] = useState(false), pausedRef = useRef(false);
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null), cvRef = useRef<HTMLCanvasElement>(null), boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  useEffect(() => {
    const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    const cv = cvRef.current, el = boxRef.current; let raf = 0, alive = true, lastDraw = 0, last = performance.now();
    const fit = () => { if (!el || !cv) return; const W = Math.max(280, Math.min(el.parentElement ? el.parentElement.clientWidth - 24 : el.clientWidth, Math.round((window.innerHeight - 215) * VW / VH))), H = Math.round(W * VH / VW), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; el.style.width = W + "px"; setBox({ w: W, h: H }); };
    fit(); const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(fit) : null; if (ro && el) ro.observe(el);
    const draw = (now: number) => { if (!alive) return; raf = requestAnimationFrame(draw); if (now - lastDraw < 40 || !cv) return; lastDraw = now; const x = cv.getContext("2d"); if (!x) return; const k = cv.width / VW; x.setTransform(k, 0, 0, k, 0, 0); try { drawRanch(x, S, now / 1000, P.kind || "moon"); } catch (e) {} };
    raf = requestAnimationFrame(draw);
    const step = (dt: number) => {
      S.t += dt;
      for (const c of S.plots) if (c.crop && c.p < 100) { const cr = CROPS.find(q => q.id === c.crop)!; c.p = Math.min(100, c.p + 100 / (cr.time * S.tm) * (c.w > 0 ? 2 : 1) * dt); } for (const c of S.plots) if (c.w > 0) c.w = Math.max(0, c.w - dt);
      for (let i = 0; i < ANIMALS.length; i++) { const A = S.animals[i]; if (A.fed > 0 && A.prog < 100) { A.prog = Math.min(100, A.prog + 100 / ANIMALS[i].every * dt); } }
      if (S.launch > 0) S.launch = Math.max(0, S.launch - dt);
      S.fact = Math.floor(S.t / 25) % FACTS.length;
      if (S.delivered >= S.quota && !S.won) { S.won = true; S.ended = true; sfx.play("win"); const stars = S.t <= 200 ? 3 : S.t <= 300 ? 2 : 1; setTimeout(() => onWin({ ranch: { delivered: Math.round(S.delivered), target: S.quota, secs: Math.round(S.t), stars }, kills: 0, cry: 8 + 4 * stars, loot: {}, mode: "ranch" }), 2000); }
    };
    const id = setInterval(() => { const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (pausedRef.current || S.ended) return; step(dt); setTick(v => (v + 1) % 1e6); }, 100);
    (window as any).__advRanch = { state: () => ({ t: S.t, stock: S.stock, delivered: S.delivered, plots: S.plots.map((c: any) => ({ crop: c.crop, p: c.p })), animals: S.animals.map((a: any) => ({ fed: a.fed, prog: a.prog })), won: S.won, target: S.quota }), tick: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.1); i++) step(0.1); }, give: (n: number) => { S.stock += n; } };
    return () => { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advRanch; } catch (e) {} };
  }, []);
  const play = (n: string) => sfxRef.current && sfxRef.current.play(n);
  const tapPlot = (i: number) => { const c = S.plots[i]; if (S.ended) return;
    if (!c.crop) { c.crop = S.seed; c.p = 0; play("pop"); }
    else if (c.p >= 100) { const cr = CROPS.find(q => q.id === c.crop)!; S.stock += Math.round(cr.yield * farmerBonus); c.crop = null; c.p = 0; c.w = 0; play("pickup"); }
    else if (c.w <= 0) { c.w = 5; play("hit"); }
    setTick(v => v + 1); };
  const tapAnimal = (i: number) => { const A = S.animals[i], a = ANIMALS[i]; if (S.ended) return;
    if (A.prog >= 100) { S.stock += Math.round(a.yield * farmerBonus); A.prog = 0; A.fed = 0; play("pickup"); }
    else if (A.fed <= 0) { if (S.stock >= a.feed) { S.stock -= a.feed; A.fed = 1; play("pop"); } else play("hurt"); }
    setTick(v => v + 1); };
  const deliver = () => { if (S.ended || S.stock < 1 || S.launch > 0) return; S.delivered += S.stock; S.stock = 0; S.launch = 2; play("rocket"); setTick(v => v + 1); };
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const k = box.w / VW, pct = Math.min(100, S.delivered / S.quota * 100), fact = FACTS[S.fact];
  return (
    <div className="adv-farm adv-ranch" data-ranch="1">
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">🌾 {T3(lang, P.th, P.en, P.zh).split(" · ")[0]} · ⏱ {Math.floor(S.t)}s · {t("ในโรงนา ", "In the barn ", "仓库 ")}{Math.floor(S.stock)} · {t("ส่งแล้ว ", "delivered ", "已运出 ")}{Math.round(S.delivered)}/{S.quota}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{t("อาณานิคมได้อาหาร ", "Colony fed ", "殖民地粮食 ")}{Math.round(pct)}%</b></div>
        </div>
        <GearButton onClick={openGear} />
      </div>
      <div className="ar-stage" ref={boxRef}>
        <canvas ref={cvRef} className="ar-cv" aria-hidden="true" />
        {PLOTS.map((p, i) => (<button key={i} className="ar-hit" data-plot={i} aria-label={"plot " + i} onClick={() => tapPlot(i)} style={{ left: (p.x - 34) * k, top: (p.y - 22) * k, width: 68 * k, height: 48 * k }} />))}
        {ANIMALS.map((a, i) => (<button key={a.id} className="ar-hit ar-an" data-animal={a.id} aria-label={a.id} onClick={() => tapAnimal(i)} style={{ left: (a.x - 40) * k, top: (a.y - 52) * k, width: 80 * k, height: 80 * k }} />))}
        <button className="ar-hit ar-ship" data-deliver="1" aria-label="deliver" onClick={deliver} style={{ left: 50 * k, top: 250 * k, width: 120 * k, height: 110 * k }} />
      </div>
      <div className="ar-bar">
        <div className="ar-seeds">{CROPS.map(c => (<button key={c.id} data-seed={c.id} className={"ar-seed" + (S.seed === c.id ? " on" : "")} onClick={() => { S.seed = c.id; setTick(v => v + 1); }}>{c.icon}<small>{T3(lang, c.name[0], c.name[1], c.name[2])} · {Math.round(c.time * S.tm)}s · +{Math.round(c.yield * farmerBonus)}</small></button>))}</div>
        <button className="adv-btn go ar-send" data-send="1" disabled={S.stock < 1 || S.launch > 0} onClick={deliver}>🚀 {t("ส่งอาหารให้อาณานิคม", "Send the food to the colony", "把粮食运给殖民地")} ({Math.floor(S.stock)})</button>
      </div>
      <div className="af-fact">💡 {t("แตะช่องว่างเพื่อปลูก แตะต้นไม้เพื่อรดน้ำ แตะผลสุกเพื่อเก็บ แตะสัตว์ที่หิวเพื่อให้อาหาร แล้วเก็บผลผลิตเมื่อมีฟองลอยขึ้น", "Tap an empty plot to plant, a growing crop to water it, a ripe one to harvest. Feed a hungry animal, then collect what it makes when the bubble pops up.", "点空地播种，点生长中的作物浇水，点成熟作物收获；喂饥饿的动物，气泡出现后收集产品。")} · {T3(lang, fact[0], fact[1], fact[2])}</div>
      {S.won && <div className="adv-clear" role="status"><b>🌾 {t("อาณานิคมอิ่มท้องแล้ว!", "The colony is fed!", "殖民地吃饱了！")}</b></div>}
      {gear && <SettingsPopup lang={lang} high={high} onGfx={() => { const n = !high; setHigh(n); try { localStorage.setItem("tg_adv_gfx", n ? "high" : "standard"); } catch (e) {} }} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div>
  );
}
