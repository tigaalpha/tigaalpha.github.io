/* Adventure: the Space Ranch (owner, 2026-10-13: "make the farming and animal level look like a farm game such as FarmVille, cartoon CG with cows and chickens, as its own separate level").
   A cheerful cartoon farm under a glass dome on a colony world: eight plots to plant, water and harvest, four pens of animals (cow, chicken, pig, sheep) that have to be fed
   and then give milk, eggs, bacon and wool, a barn that counts the food, and a delivery rocket that carries it to the hungry colony. Everything is drawn from code on one canvas
   (soft hills, grass tufts, a red barn, a spinning windmill, fences, round-eyed animals that wander, crops that grow through three stages and bounce when ripe).
   Win = the colony has received its food quota. No coins, crystals + EXP only. */
import { finishLook } from "./cg-finish";
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { enterFs } from "./pvp-arena";
import { GearButton, SettingsPopup } from "./adventure-settings";
import { isoBg, isoFg, drawIsoPlot, drawIsoHouse, drawIsoWindmill, drawIsoPad, drawIsoAnimal, drawIsoAmbient, PLOT_POS, PLOT_FREE, SLOT_POS, PAD, WW, WH } from "./adventure-ranch-iso";

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
  { id: "cow", icon: "🐄", prod: "🥛", name: ["วัว", "Cow", "奶牛"], pname: ["นม", "milk", "牛奶"], feed: 2, every: 14, yield: 6, x: 614, y: 272 },
  { id: "chicken", icon: "🐔", prod: "🥚", name: ["ไก่", "Chicken", "母鸡"], pname: ["ไข่", "eggs", "鸡蛋"], feed: 1, every: 8, yield: 3, x: 724, y: 272 },
  { id: "pig", icon: "🐖", prod: "🥓", name: ["หมู", "Pig", "猪"], pname: ["เบคอน", "bacon", "培根"], feed: 2, every: 12, yield: 5, x: 614, y: 362 },
  { id: "sheep", icon: "🐑", prod: "🧶", name: ["แกะ", "Sheep", "绵羊"], pname: ["ขนแกะ", "wool", "羊毛"], feed: 1, every: 10, yield: 4, x: 724, y: 362 },
];
/* Houses (owner, 2026-10-15: "each animal has its own house, you build it yourself and choose what to raise"): the four pen slots start as empty foundations.
   Tap a slot to pay for the house (it goes up over a few seconds), then tap it again to buy the animal. Animals only work once the house is built and the animal bought. */
const HOUSE_COST = [12, 6, 10, 8], BUY_COST = [10, 3, 6, 4], HOUSE_NAME: L3[] = [["โรงวัว", "Cow barn", "牛棚"], ["เล้าไก่", "Chicken coop", "鸡舍"], ["เล้าหมู", "Pigsty", "猪圈"], ["คอกแกะ", "Sheep shed", "羊圈"]];
const PLOTS = Array.from({ length: 24 }, (_, i) => PLOT_POS(i));
const digCostOf = (dug: number) => 6 + 3 * dug;   // a new plot to dig costs a little more each time
ANIMALS.forEach((a, i) => { a.x = SLOT_POS[i].x; a.y = SLOT_POS[i].y; });

/* ── FarmVille-style progression and service (owner, 2026-10-15: grow vegetables and raise animals to feed the alien colony and the human colony, with a UI like FarmVille) ──
   A level and an XP bar, a board of colony ORDERS with rewards, a market of seed cards, floating "+N" numbers, bubbles over what is ripe, and TWO colonies to serve:
   the human colony likes carrots, corn, milk and bacon; the Kindred (alien) colony likes tomatoes, pumpkins, eggs and wool. Food they like counts a quarter more toward the quota. */
const LIKES: Record<string, string[]> = { human: ["carrot", "corn", "cow", "pig"], alien: ["tomato", "pumpkin", "chicken", "sheep"] };
const ITEM_ICON: Record<string, string> = { carrot: "🥕", corn: "🌽", tomato: "🍅", pumpkin: "🎃", cow: "🥛", chicken: "🥚", pig: "🥓", sheep: "🧶" };
const COLONY_TXT: Record<string, { icon: string; name: L3 }> = { human: { icon: "👩‍🚀", name: ["อาณานิคมมนุษย์", "Human colony", "人类殖民地"] }, alien: { icon: "👽", name: ["อาณานิคมไคนด์เรด", "Kindred colony", "凯因德殖民地"] } };
const xpNeed = (lvl: number) => 12 + 8 * lvl;
type Order = { id: number; kind: "grow" | "make" | "send"; item: string; need: number; got: number; reward: number; xp: number; from: "human" | "alien" };
let ORDER_ID = 1;
const mkOrder = (S: any): Order => { const r = Math.random(), from: "human" | "alien" = Math.random() < 0.5 ? "human" : "alien", L = LIKES[from];
  if (r < 0.45) { const it = L.filter(i => CROPS.some(c => c.id === i))[Math.floor(Math.random() * 2)] || "carrot"; return { id: ORDER_ID++, kind: "grow", item: it, need: 3 + Math.floor(Math.random() * 3), got: 0, reward: 6, xp: 8, from }; }
  if (r < 0.8) { const it = L.filter(i => ANIMALS.some(a => a.id === i))[Math.floor(Math.random() * 2)] || "cow"; return { id: ORDER_ID++, kind: "make", item: it, need: 2 + Math.floor(Math.random() * 2), got: 0, reward: 8, xp: 10, from }; }
  return { id: ORDER_ID++, kind: "send", item: "food", need: 30 + 10 * Math.floor(Math.random() * 3), got: 0, reward: 12, xp: 12, from }; };
const FACTS: L3[] = [
  ["ฟาร์มในโดมกระจกบนดาวอื่นต้องควบคุมอากาศ น้ำ และแสงให้พืชโดยเฉพาะ", "A farm under a glass dome on another world has to control air, water and light for its plants.", "在别的星球上，玻璃穹顶农场要为植物控制空气、水和光照。"],
  ["สัตว์ที่กินอิ่มจะให้ผลผลิตสม่ำเสมอ ฟาร์มที่ดีต้องเลี้ยงทั้งพืชและสัตว์ให้สมดุลกัน", "A well-fed animal gives steadily; a good farm balances its crops and its animals.", "吃饱的动物产出稳定；好农场要让种植与养殖保持平衡。"],
  ["อาณานิคมที่อยู่ไกลโลกต้องผลิตอาหารเองเกือบทั้งหมด เพราะยานส่งเสบียงมาได้นาน ๆ ครั้ง", "A colony far from Earth must grow almost all of its food itself; supply ships come rarely.", "远离地球的殖民地几乎要自己生产全部食物，补给船很少来。"],
];

function drawRanch(x: CanvasRenderingContext2D, S: any, T: number, kind: string) {
  const O = "rgba(45,28,12,.5)";
  x.drawImage(isoBg(kind), 0, 0, WW, WH);
  drawIsoWindmill(x, T); drawIsoPad(x, S.launch, T);
  for (let i = 0; i < PLOTS.length; i++) { const c = S.plots[i], cr = c.crop ? CROPS.find(q => q.id === c.crop) : null; drawIsoPlot(x, i, c, T, cr ? cr.col : "#fff", digCostOf(S.dug), S.stock >= digCostOf(S.dug)); }
  // the pens (fence and floor are in the cached scenery)
  for (let i = 0; i < ANIMALS.length; i++) drawIsoHouse(x, ANIMALS[i], S.houses[i], i, S.stock, T, HOUSE_COST, BUY_COST);
  for (let i = 0; i < ANIMALS.length; i++) { if (!S.houses[i].own) continue; const a = ANIMALS[i], A = S.animals[i], wx = a.x + 6 + Math.sin(T * 0.35 + i * 2) * 30, wy = a.y + 30 + Math.cos(T * 0.25 + i) * 12 + (A.prog >= 100 ? -Math.abs(Math.sin(T * 6)) * 4 : 0);
    x.fillStyle = "rgba(10,50,10,.3)"; x.beginPath(); x.ellipse(wx + 2, wy + 20 * ({ cow: 1.2, pig: 0.82, sheep: 0.95, chicken: 0.6 } as any)[a.id], 34 * ({ cow: 1.2, pig: 0.82, sheep: 0.95, chicken: 0.6 } as any)[a.id], 8, 0, 0, 7); x.fill(); x.save(); x.translate(wx, wy); const face = Math.cos(T * 0.35 + i * 2) >= 0 ? 1 : -1; const sz = ({ cow: 1.2, pig: 0.82, sheep: 0.95, chicken: 0.6 } as any)[a.id] || 1; x.scale(face * sz, sz); drawIsoAnimal(x, a.id, T, i); x.restore();
    const hungry = A.fed <= 0;
    if (hungry) { x.fillStyle = "rgba(255,255,255,.95)"; x.strokeStyle = O; x.lineWidth = 1.1; x.beginPath(); x.roundRect(wx + 18, wy - 46, 36, 24, 8); x.fill(); x.stroke(); x.fillStyle = "#222"; x.font = "16px system-ui"; x.textAlign = "center"; x.fillText("🍎", wx + 36, wy - 28); }
    else if (A.prog >= 100) { x.fillStyle = "rgba(255,255,255,.95)"; x.strokeStyle = "#ffb020"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(wx + 18, wy - 48 - Math.abs(Math.sin(T * 5)) * 4, 36, 26, 8); x.fill(); x.stroke(); x.font = "18px system-ui"; x.textAlign = "center"; x.fillText(a.prod, wx + 36, wy - 28 - Math.abs(Math.sin(T * 5)) * 4); }
    else { x.fillStyle = "rgba(0,0,0,.3)"; x.fillRect(wx - 20, wy - 34, 40, 5); x.fillStyle = "#ffd23f"; x.fillRect(wx - 20, wy - 34, 40 * A.prog / 100, 5); } }
  x.drawImage(isoFg(kind), 0, 0, WW, WH);
  drawIsoAmbient(x, T);
  // butterflies
  for (let i = 0; i < 3; i++) { const bx = 640 + i * 190 + Math.sin(T * 0.9 + i) * 90, by = 330 + i * 40 + Math.cos(T * 1.1 + i * 2) * 30; x.fillStyle = ["#ff7ab8", "#7ad0ff", "#ffe06a"][i]; x.beginPath(); x.ellipse(bx - 4, by, 5, 3 + Math.abs(Math.sin(T * 14 + i)) * 3, 0, 0, 7); x.ellipse(bx + 4, by, 5, 3 + Math.abs(Math.sin(T * 14 + i)) * 3, 0, 0, 7); x.fill(); }
  // ripe bubbles and floating numbers (FarmVille style)
  x.textAlign = "center"; x.font = "20px sans-serif";
  const bub = (bx: number, by: number, ic: string) => { const o = Math.sin(T * 5) * 3; x.fillStyle = "#fff"; x.beginPath(); x.arc(bx, by + o, 17, 0, 7); x.fill(); x.strokeStyle = "#e8a010"; x.lineWidth = 1.5; x.stroke(); x.fillStyle = "#000"; x.fillText(ic, bx, by + 7 + o); };
  S.plots.forEach((c: any, i: number) => { if (c.crop && c.p >= 100) bub(PLOTS[i].x, PLOTS[i].y - 50, ITEM_ICON[c.crop] || "✔"); });
  
  x.font = "bold 22px sans-serif"; for (const f of S.floats) { x.globalAlpha = Math.max(0, 1 - f.age / 1.4); x.fillStyle = "#fff"; x.strokeStyle = "#3a2410"; x.lineWidth = 4; x.strokeText(f.txt, f.x, f.y - f.age * 40); x.fillText(f.txt, f.x, f.y - f.age * 40); } x.globalAlpha = 1;
}

export default function AdventureRanch({ P, lang, onWin, onExit, onRetry }: any) {
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const farmerBonus = (() => { try { return localStorage.getItem("tg_adv_career") === "farm" ? 1.25 : 1; } catch (e) { return 1; } })();
  const G = useRef<any>(null);
  if (!G.current) G.current = { quota: QUOTA[P.kind] || 260, tm: TIMEMUL[P.kind] || 1, t: 0, stock: 16, delivered: 0, houses: ANIMALS.map(() => ({ b: 0, own: false })), seed: "carrot", dug: 0, plots: PLOTS.map((_, i) => ({ crop: null as any, p: 0, w: 0, locked: !PLOT_FREE(i) })), animals: ANIMALS.map(() => ({ fed: 0, prog: 0 })), launch: 0, ended: false, won: false, fact: 0, xp: 0, lvl: 1, lvlUp: 0, orders: [] as Order[], inv: {} as Record<string, number>, floats: [] as any[], target: "human" as string, happy: { human: 0, alien: 0 } as any, sent: { human: 0, alien: 0 } as any };
  if (!G.current.orders.length) for (let i = 0; i < 3; i++) G.current.orders.push(mkOrder(G.current));
  const S = G.current;
  const [, setTick] = useState(0), [gear, setGear] = useState(false), pausedRef = useRef(false);
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const camRef = useRef({ x: 120, y: 110, z: 0.75 }), tapBlock = useRef(0), ptrs = useRef(new Map<number, { x: number; y: number }>()), pinch = useRef(0), dragged = useRef(false);
  const clampCam = () => { const c = camRef.current, zmin = Math.max(VW / WW, VH / WH); c.z = Math.max(zmin, Math.min(1.9, c.z)); c.x = Math.max(0, Math.min(WW - VW / c.z, c.x)); c.y = Math.max(0, Math.min(WH - VH / c.z, c.y)); };
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null), cvRef = useRef<HTMLCanvasElement>(null), boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth * 1.05);
  useEffect(() => { const f = () => setPortrait(window.innerHeight > window.innerWidth * 1.05); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => {
    try { enterFs(); } catch (e) {} const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    const cv = cvRef.current, el = boxRef.current; let raf = 0, alive = true, lastDraw = 0, last = performance.now();
    const fit = () => { if (!el || !cv) return; const wr = el.parentElement, aw = wr ? wr.clientWidth : window.innerWidth, ah = wr ? wr.clientHeight : window.innerHeight, W = Math.max(280, Math.min(aw, Math.round(ah * VW / VH))), H = Math.round(W * VH / VW), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; el.style.width = W + "px"; setBox({ w: W, h: H }); };
    fit(); const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(fit) : null; if (ro && el) ro.observe(el);
    const draw = (now: number) => { if (!alive) return; raf = requestAnimationFrame(draw); if (now - lastDraw < 40 || !cv) return; lastDraw = now; const x = cv.getContext("2d"); if (!x) return; const k = cv.width / VW, cm = camRef.current; x.setTransform(k * cm.z, 0, 0, k * cm.z, -cm.x * k * cm.z, -cm.y * k * cm.z); try { drawRanch(x, S, now / 1000, P.kind || "moon"); x.setTransform(k, 0, 0, k, 0, 0); finishLook(x, VW, VH, now / 1000, "255,226,170", 0.3); } catch (e) {} };
    raf = requestAnimationFrame(draw);
    const step = (dt: number) => {
      S.t += dt;
      for (const c of S.plots) if (c.crop && c.p < 100) { const cr = CROPS.find(q => q.id === c.crop)!; c.p = Math.min(100, c.p + 100 / (cr.time * S.tm) * (c.w > 0 ? 2 : 1) * dt); } for (const c of S.plots) if (c.w > 0) c.w = Math.max(0, c.w - dt);
      for (let i = 0; i < ANIMALS.length; i++) { const H = S.houses[i]; if (H.b > 0 && H.b < 1) H.b = Math.min(1, H.b + dt / 5); const A = S.animals[i]; if (H.own && A.fed > 0 && A.prog < 100) { A.prog = Math.min(100, A.prog + 100 / ANIMALS[i].every * dt); } }
      if (S.launch > 0) S.launch = Math.max(0, S.launch - dt); if (S.lvlUp > 0) S.lvlUp = Math.max(0, S.lvlUp - dt);
      for (const f of S.floats) f.age += dt; S.floats = S.floats.filter((f: any) => f.age < 1.4);
      S.fact = Math.floor(S.t / 25) % FACTS.length;
      if (S.delivered >= S.quota && !S.won) { S.won = true; S.ended = true; sfx.play("win"); const stars = S.t <= 200 ? 3 : S.t <= 300 ? 2 : 1; setTimeout(() => onWin({ ranch: { delivered: Math.round(S.delivered), target: S.quota, secs: Math.round(S.t), stars }, kills: 0, cry: 8 + 4 * stars, loot: {}, mode: "ranch" }), 2000); }
    };
    const id = setInterval(() => { const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (pausedRef.current || S.ended) return; step(dt); setTick(v => (v + 1) % 1e6); }, 100);
    (window as any).__advRanch = { state: () => ({ t: S.t, stock: S.stock, delivered: S.delivered, plots: S.plots.map((c: any) => ({ crop: c.crop, p: c.p, locked: !!c.locked })), dug: S.dug, cam: { ...camRef.current }, animals: S.animals.map((a: any) => ({ fed: a.fed, prog: a.prog })), houses: S.houses.map((h: any) => ({ b: h.b, own: h.own })), won: S.won, target: S.quota }), tick: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.1); i++) step(0.1); }, give: (n: number) => { S.stock += n; }, setCam: (x: number, y: number, z: number) => { camRef.current = { x, y, z }; clampCam(); } };
    return () => { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advRanch; } catch (e) {} };
  }, []);
  const play = (n: string) => sfxRef.current && sfxRef.current.play(n);
  const addXp = (n: number) => { S.xp += n; while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; S.lvlUp = 2.2; S.stock += 5; play("win"); } };
  const float = (txt: string, x: number, y: number) => { S.floats.push({ txt, x, y, age: 0 }); };
  const bump = (item: string, n: number) => { S.inv[item] = (S.inv[item] || 0) + n; for (const o of S.orders) if ((o.kind === "grow" || o.kind === "make") && o.item === item && o.got < o.need) o.got = Math.min(o.need, o.got + 1); };
  const tapPlot = (i: number) => { const c = S.plots[i]; if (S.ended || tapBlock.current > performance.now()) return;
    if (c.locked) { const cost = digCostOf(S.dug); if (S.stock >= cost) { S.stock -= cost; c.locked = false; S.dug++; play("pickup"); float("⛏ -" + cost, PLOTS[i].x, PLOTS[i].y - 30); addXp(2); } else play("hurt"); setTick(v => v + 1); return; }
    if (!c.crop) { c.crop = S.seed; c.p = 0; play("pop"); }
    else if (c.p >= 100) { const cr = CROPS.find(q => q.id === c.crop)!; const y = Math.round(cr.yield * farmerBonus); S.stock += y; bump(c.crop, 1); addXp(2); float("+" + y + " " + cr.icon, PLOTS[i].x, PLOTS[i].y - 30); c.crop = null; c.p = 0; c.w = 0; play("pickup"); }
    else if (c.w <= 0) { c.w = 5; play("hit"); }
    setTick(v => v + 1); };
  const tapAnimal = (i: number) => { const A = S.animals[i], a = ANIMALS[i], H = S.houses[i]; if (S.ended || tapBlock.current > performance.now()) return;
    if (H.b <= 0) { if (S.stock >= HOUSE_COST[i]) { S.stock -= HOUSE_COST[i]; H.b = 0.01; play("pop"); float("🔨 -" + HOUSE_COST[i], a.x, a.y - 40); } else play("hurt"); setTick(v => v + 1); return; }
    if (H.b < 1) { setTick(v => v + 1); return; }
    if (!H.own) { if (S.stock >= BUY_COST[i]) { S.stock -= BUY_COST[i]; H.own = true; play("pickup"); float(a.prod + " +1", a.x, a.y - 50); addXp(3); } else play("hurt"); setTick(v => v + 1); return; }
    if (A.prog >= 100) { const y = Math.round(a.yield * farmerBonus); S.stock += y; bump(a.id, 1); addXp(3); float("+" + y + " " + a.prod, a.x, a.y - 60); A.prog = 0; A.fed = 0; play("pickup"); }
    else if (A.fed <= 0) { if (S.stock >= a.feed) { S.stock -= a.feed; A.fed = 1; play("pop"); } else play("hurt"); }
    setTick(v => v + 1); };
  const deliver = () => { if (tapBlock.current > performance.now() || S.ended || S.stock < 1 || S.launch > 0) return; const tg = S.target as string; const liked = Object.keys(S.inv).reduce((n, k) => n + (LIKES[tg].includes(k) ? S.inv[k] : 0), 0); const bonus = Math.min(S.stock, liked * 4) * 0.25; const n = S.stock; S.delivered += n + bonus; S.sent[tg] += n; S.happy[tg] += n; for (const o of S.orders) if (o.kind === "send" && o.from === tg && o.got < o.need) o.got = Math.min(o.need, o.got + n); float("🚀 " + Math.round(n + bonus), PAD.x, PAD.y - 80); S.stock = 0; S.inv = {}; S.launch = 2; play("rocket"); addXp(Math.ceil(n / 4)); setTick(v => v + 1); };
  const [ordersOpen, setOrdersOpen] = useState(false);
  const claim = (id: number) => { const o = S.orders.find((q: Order) => q.id === id); if (!o || o.got < o.need) return; S.stock += o.reward; addXp(o.xp); S.orders = S.orders.filter((q: Order) => q.id !== id); S.orders.push(mkOrder(S)); play("pickup"); setTick(v => v + 1); };
  const ready = S.orders.filter((o: Order) => o.got >= o.need).length;
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const k = box.w / VW, pct = Math.min(100, S.delivered / S.quota * 100), fact = FACTS[S.fact];
  return (
    <div className={"adv-farm adv-ranch arf" + (portrait ? " rot" : "")} data-ranch="1">
      <div className="arf-in">
      <div className="ar-stage" ref={boxRef} style={{ touchAction: "none" }}
        onWheel={(e) => { camRef.current.z *= e.deltaY < 0 ? 1.1 : 1 / 1.1; clampCam(); setTick(v => v + 1); }}
        onPointerDown={(e) => { ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragged.current = false; if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); } }}
        onPointerMove={(e) => { const m = ptrs.current.get(e.pointerId); if (!m) return; const rx = e.clientX - m.x, ry = e.clientY - m.y, dx = portrait ? ry : rx, dy = portrait ? -rx : ry, cm = camRef.current, kk = box.w / VW;
          if (ptrs.current.size === 2) { m.x = e.clientX; m.y = e.clientY; const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch.current > 0) { cm.z *= d / pinch.current; clampCam(); } pinch.current = d; dragged.current = true; tapBlock.current = performance.now() + 250; setTick(v => v + 1); return; }
          if (!dragged.current && Math.hypot(rx, ry) < 7) return; dragged.current = true; tapBlock.current = performance.now() + 250; m.x = e.clientX; m.y = e.clientY; cm.x -= dx / (kk * cm.z); cm.y -= dy / (kk * cm.z); clampCam(); setTick(v => v + 1); }}
        onPointerUp={(e) => { ptrs.current.delete(e.pointerId); pinch.current = 0; }} onPointerCancel={(e) => { ptrs.current.delete(e.pointerId); pinch.current = 0; }}>
        <canvas ref={cvRef} className="ar-cv" aria-hidden="true" />
        <div className="ar-world" style={{ position: "absolute", left: 0, top: 0, width: WW, height: WH, transformOrigin: "0 0", transform: `translate(${-camRef.current.x * k * camRef.current.z}px,${-camRef.current.y * k * camRef.current.z}px) scale(${k * camRef.current.z})` }}>
          {PLOTS.map((p, i) => (<button key={i} className="ar-hit" data-plot={i} aria-label={"plot " + i} onClick={() => tapPlot(i)} style={{ left: p.x - 32, top: p.y - 30, width: 64, height: 52 }} />))}
          {ANIMALS.map((a, i) => (<button key={a.id} className="ar-hit ar-an" data-animal={a.id} aria-label={a.id} onClick={() => tapAnimal(i)} style={{ left: a.x - 50, top: a.y - 56, width: 100, height: 108 }} />))}
          <button className="ar-hit ar-ship" data-deliver="1" aria-label="deliver" onClick={deliver} style={{ left: PAD.x - 50, top: PAD.y - 120, width: 100, height: 140 }} />
        </div>
        <div className="ar-zoom"><button data-zoom="in" aria-label="zoom in" onClick={() => { camRef.current.z *= 1.25; clampCam(); setTick(v => v + 1); }}>+</button><button data-zoom="out" aria-label="zoom out" onClick={() => { camRef.current.z /= 1.25; clampCam(); setTick(v => v + 1); }}>−</button></div>
        <div className="arf-top">
          <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
          <div className="arf-hud">
            <div className="adv-lv">🌾 {T3(lang, P.th, P.en, P.zh).split(" · ")[0]} · ⏱ {Math.floor(S.t)}s · {t("ในโรงนา ", "In the barn ", "仓库 ")}{Math.floor(S.stock)} · {t("ส่งแล้ว ", "delivered ", "已运出 ")}{Math.round(S.delivered)}/{S.quota}</div>
            <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{t("อาณานิคมได้อาหาร ", "Colony fed ", "殖民地粮食 ")}{Math.round(pct)}%</b></div>
          </div>
          <GearButton onClick={openGear} />
        </div>
        <div className="ar-cnt"><span><i>⏱</i>{Math.floor(S.t)}s</span><span><i>🌾</i>{Math.floor(S.stock)}</span><span><i>🚀</i>{Math.round(S.delivered)}/{S.quota}</span></div>
        <div className="ar-fv" data-fv="1"><span className="ar-star">★{S.lvl}</span><span className="ar-xp"><i style={{ width: Math.min(100, S.xp / xpNeed(S.lvl) * 100) + "%" }} /></span><button className="ar-ord" data-orders="1" onClick={() => setOrdersOpen(o => !o)}>📋 {t("ออเดอร์", "Orders", "订单")}{ready > 0 && <b>{ready}</b>}</button></div>
        {S.lvlUp > 0 && <div className="ar-lvup" role="status">★ {t("เลเวลอัป! ", "Level up! ", "升级！")}{S.lvl} · +5</div>}
        {ordersOpen && <div className="ar-orders" data-orderwin="1">{S.orders.map((o: Order) => (<div key={o.id} className="ar-o"><span>{COLONY_TXT[o.from].icon} {o.kind === "send" ? t("ส่งอาหาร", "Send food", "运送粮食") : (ITEM_ICON[o.item] || "") + " " + o.item}</span><span>{o.got}/{o.need}</span><button data-claim={o.id} disabled={o.got < o.need} onClick={() => claim(o.id)}>+{o.reward} · ★{o.xp}</button></div>))}</div>}
        <div className="ar-cols">{(["human", "alien"] as const).map(c => (<button key={c} data-colony={c} className={"ar-col" + (S.target === c ? " on" : "")} onClick={() => { S.target = c; setTick(v => v + 1); }}>{COLONY_TXT[c].icon} {T3(lang, COLONY_TXT[c].name[0], COLONY_TXT[c].name[1], COLONY_TXT[c].name[2])} <small>{Math.round(S.sent[c])}</small></button>))}</div>
        <div className="ar-bar">
          <div className="ar-seeds">{CROPS.map(c => (<button key={c.id} data-seed={c.id} className={"ar-seed" + (S.seed === c.id ? " on" : "")} onClick={() => { S.seed = c.id; setTick(v => v + 1); }}>{c.icon}<small>{T3(lang, c.name[0], c.name[1], c.name[2])} · {Math.round(c.time * S.tm)}s · +{Math.round(c.yield * farmerBonus)}</small></button>))}</div>
          <button className="adv-btn go ar-send" data-send="1" disabled={S.stock < 1 || S.launch > 0} onClick={deliver}>🚀 {t("ส่งอาหารให้อาณานิคม", "Send the food to the colony", "把粮食运给殖民地")} ({Math.floor(S.stock)})</button>
        </div>
        <div className="af-fact">💡 {T3(lang, fact[0], fact[1], fact[2])}</div>
      </div>
      </div>
      {S.won && <div className="adv-clear" role="status"><b>🌾 {t("อาณานิคมอิ่มท้องแล้ว!", "The colony is fed!", "殖民地吃饱了！")}</b></div>}
      {gear && <SettingsPopup lang={lang} high={high} onGfx={() => { const n = !high; setHigh(n); try { localStorage.setItem("tg_adv_gfx", n ? "high" : "standard"); } catch (e) {} }} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div>
  );
}
