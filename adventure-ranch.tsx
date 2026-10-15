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
/* Houses (owner, 2026-10-15: "each animal has its own house, you build it yourself and choose what to raise"): the four pen slots start as empty foundations.
   Tap a slot to pay for the house (it goes up over a few seconds), then tap it again to buy the animal. Animals only work once the house is built and the animal bought. */
const HOUSE_COST = [12, 6, 10, 8], BUY_COST = [10, 3, 6, 4], HOUSE_NAME: L3[] = [["โรงวัว", "Cow barn", "牛棚"], ["เล้าไก่", "Chicken coop", "鸡舍"], ["เล้าหมู", "Pigsty", "猪圈"], ["คอกแกะ", "Sheep shed", "羊圈"]];
const PLOTS = Array.from({ length: 8 }, (_, i) => ({ x: 238 + (i % 4) * 82, y: 258 + Math.floor(i / 4) * 78 }));

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

/* The still scenery (sky, hills, forest, trees, meadow texture, pond, path, barn, fence) is painted ONCE at twice the size into a cached canvas, so it can carry
   far more detail than a per-frame draw could: seeded grass blades in five greens, light and shadow patches, clumped leaf canopies with a lit side,
   a wooden barn with planks and a shingled roof, a stone path and soft contact shadows. */
const BG: Record<string, HTMLCanvasElement> = {};
function farmBg(kind: string): HTMLCanvasElement {
  if (BG[kind]) return BG[kind];
  const c = document.createElement("canvas"); c.width = VW * 2; c.height = VH * 2; const x = c.getContext("2d")!; x.scale(2, 2);
  let sd = 7; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const SKYC: any = { moon: ["#4aa8f0", "#cfeaff"], mars: ["#e9a35a", "#ffe3b0"], titan: ["#c9954a", "#f2d9a6"], proxima: ["#f0786a", "#ffd2bf"] }, sc = SKYC[kind] || SKYC.moon;
  const sg = x.createLinearGradient(0, 0, 0, 240); sg.addColorStop(0, sc[0]); sg.addColorStop(1, sc[1]); x.fillStyle = sg; x.fillRect(0, 0, VW, 250);
  // sun glow and the world's planet
  const bigRed = kind === "proxima", sr = bigRed ? 52 : kind === "titan" ? 16 : 28;
  const sun = x.createRadialGradient(700, 66, 2, 700, 66, sr * 3); sun.addColorStop(0, bigRed ? "#ff6a4a" : "#fffbe0"); sun.addColorStop(0.25, bigRed ? "rgba(255,90,60,.55)" : "rgba(255,240,170,.7)"); sun.addColorStop(1, "rgba(255,240,170,0)"); x.fillStyle = sun; x.beginPath(); x.arc(700, 66, sr * 3, 0, 7); x.fill();
  if (kind === "titan") { const pg = x.createRadialGradient(140, 62, 2, 150, 70, 30); pg.addColorStop(0, "#f6dc9a"); pg.addColorStop(1, "#a8772e"); x.fillStyle = pg; x.beginPath(); x.arc(150, 70, 28, 0, 7); x.fill(); x.strokeStyle = "rgba(255,235,190,.85)"; x.lineWidth = 4; x.beginPath(); x.ellipse(150, 70, 54, 12, -0.3, 0, 7); x.stroke(); }
  else { const eg = x.createRadialGradient(114, 48, 1, 120, 54, 19); eg.addColorStop(0, "#9fd0ff"); eg.addColorStop(0.6, "#2f66d8"); eg.addColorStop(1, "#16286a"); x.fillStyle = eg; x.beginPath(); x.arc(120, 54, 18, 0, 7); x.fill(); x.fillStyle = "rgba(90,200,120,.8)"; x.beginPath(); x.ellipse(114, 52, 7, 5, 0.4, 0, 7); x.fill(); }
  // far hills in layers of haze
  const hill = (y0: number, amp: number, col: string, ph: number) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 250); for (let i = 0; i <= 40; i++) x.lineTo(i * 20, y0 - amp * (0.5 + 0.5 * Math.sin(i * 0.31 + ph)) - amp * 0.4 * Math.sin(i * 0.8 + ph * 2)); x.lineTo(VW, 250); x.fill(); };
  hill(206, 34, "#9ec7c0", 0.4); hill(214, 26, "#7fb48a", 2.1); hill(224, 20, "#5fa05a", 4);
  // distant tree line
  for (let i = 0; i < 70; i++) { const tx = R() * VW, ty = 214 + R() * 14, r = 7 + R() * 9; const g = x.createRadialGradient(tx - r * 0.3, ty - r * 0.5, 1, tx, ty, r); g.addColorStop(0, "#6fbf55"); g.addColorStop(1, "#2f7a3a"); x.fillStyle = g; x.beginPath(); x.arc(tx, ty - r * 0.6, r, 0, 7); x.fill(); }
  // meadow base and mown bands
  const mg = x.createLinearGradient(0, 226, 0, VH); mg.addColorStop(0, "#86cf5e"); mg.addColorStop(0.45, "#63b247"); mg.addColorStop(1, "#3d8a34"); x.fillStyle = mg; x.fillRect(0, 226, VW, VH - 226);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? "rgba(255,255,190,.06)" : "rgba(0,50,0,.07)"; x.beginPath(); x.moveTo(0, 226 + i * 14); x.lineTo(VW, 226 + i * 14 - 6); x.lineTo(VW, 226 + i * 14 + 8); x.lineTo(0, 226 + i * 14 + 14); x.fill(); }
  // light and shade patches
  for (let i = 0; i < 26; i++) { const px = R() * VW, py = 240 + R() * 200, rr = 30 + R() * 70, lg = x.createRadialGradient(px, py, 2, px, py, rr); const lit = R() > 0.5; lg.addColorStop(0, lit ? "rgba(235,255,150,.22)" : "rgba(10,60,20,.2)"); lg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = lg; x.beginPath(); x.ellipse(px, py, rr * 1.6, rr * 0.55, 0, 0, 7); x.fill(); }
  // grass blades in five greens, bigger and denser toward the viewer
  const G5 = ["#2f7a2c", "#3f9a36", "#58b744", "#7fd05a", "#a6e46c"];
  for (let i = 0; i < 2600; i++) { const gx = R() * VW, gy = 232 + R() * (VH - 232), s = 3 + (gy - 232) / 30 * (0.6 + R()), col = G5[Math.floor(R() * 5)]; x.strokeStyle = col; x.lineWidth = 0.8 + s * 0.12; x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + (R() - 0.5) * s, gy - s * 0.6, gx + (R() - 0.5) * s * 1.4, gy - s); x.stroke(); }
  // wildflower clusters
  const FC = ["#ff7ab8", "#ffffff", "#ffd23f", "#b48cff", "#ff8a5a"];
  for (let i = 0; i < 40; i++) { const fx = R() * VW, fy = 250 + R() * 190, col = FC[i % 5]; for (let k = 0; k < 4; k++) { const ox = fx + (R() - 0.5) * 14, oy = fy + (R() - 0.5) * 8; x.strokeStyle = "#2f7a2c"; x.lineWidth = 1; x.beginPath(); x.moveTo(ox, oy + 5); x.lineTo(ox, oy); x.stroke(); x.fillStyle = col; x.beginPath(); x.arc(ox, oy, 2.2, 0, 7); x.fill(); x.fillStyle = "#ffe36a"; x.beginPath(); x.arc(ox, oy, 0.9, 0, 7); x.fill(); } }
  // a pond with a bank, a sky reflection and reeds
  x.fillStyle = "rgba(30,70,30,.35)"; x.beginPath(); x.ellipse(400, 414, 78, 25, 0, 0, 7); x.fill();
  const pg = x.createLinearGradient(330, 395, 470, 430); pg.addColorStop(0, "#bfeaff"); pg.addColorStop(0.5, "#5db0e6"); pg.addColorStop(1, "#2a77b8"); x.fillStyle = pg; x.beginPath(); x.ellipse(400, 411, 70, 20, 0, 0, 7); x.fill();
  x.fillStyle = "rgba(255,255,255,.4)"; x.beginPath(); x.ellipse(384, 404, 28, 5, 0, 0, 7); x.fill();
  for (let i = 0; i < 9; i++) { const rx = 338 + i * 8 + R() * 4; x.strokeStyle = "#3f8a34"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(rx, 420); x.lineTo(rx + 1, 404 - R() * 6); x.stroke(); x.fillStyle = "#8a5a2a"; x.fillRect(rx - 0.5, 400 - R() * 4, 2.4, 5); }
  // a dirt path of stepping stones from the barn to the pens
  for (let i = 0; i < 16; i++) { const t = i / 15, px = 120 + t * 430, py = 440 - Math.sin(t * 2.2) * 100 - t * 20; x.fillStyle = "rgba(0,40,0,.25)"; x.beginPath(); x.ellipse(px + 2, py + 3, 16, 7, 0, 0, 7); x.fill(); const sgd = x.createLinearGradient(px, py - 6, px, py + 6); sgd.addColorStop(0, "#e2d3b0"); sgd.addColorStop(1, "#a89670"); x.fillStyle = sgd; x.beginPath(); x.ellipse(px, py, 15, 6, 0, 0, 7); x.fill(); }
  // trees: clumped leaf canopies, a lit side, a trunk and a soft shadow on the grass
  const tree = (tx: number, ty: number, sc2: number) => { x.fillStyle = "rgba(0,40,0,.3)"; x.beginPath(); x.ellipse(tx + 14 * sc2, ty + 3, 38 * sc2, 9 * sc2, 0, 0, 7); x.fill();
    const tg = x.createLinearGradient(tx - 5 * sc2, 0, tx + 5 * sc2, 0); tg.addColorStop(0, "#8a6338"); tg.addColorStop(1, "#4d341c"); x.fillStyle = tg; x.beginPath(); x.moveTo(tx - 5 * sc2, ty + 2); x.lineTo(tx - 3 * sc2, ty - 34 * sc2); x.lineTo(tx + 3 * sc2, ty - 34 * sc2); x.lineTo(tx + 6 * sc2, ty + 2); x.fill();
    for (let k = 0; k < 14; k++) { const a = R() * 6.28, d = R() * 26 * sc2, cx2 = tx + Math.cos(a) * d, cy2 = ty - 52 * sc2 + Math.sin(a) * d * 0.8, r = (14 + R() * 10) * sc2; const lg = x.createRadialGradient(cx2 - r * 0.35, cy2 - r * 0.4, 1, cx2, cy2, r); lg.addColorStop(0, k % 3 ? "#9be05f" : "#b9ee74"); lg.addColorStop(0.55, "#3f9a3a"); lg.addColorStop(1, "#1f5f2a"); x.fillStyle = lg; x.beginPath(); x.arc(cx2, cy2, r, 0, 7); x.fill(); } };
  tree(206, 232, 1); tree(528, 226, 0.85); tree(768, 236, 1.05); tree(24, 246, 0.9); tree(330, 222, 0.6);
  // bushes
  for (const [bx, by] of [[190, 262], [510, 250], [18, 300]]) for (let k = 0; k < 5; k++) { const cx3 = bx + k * 8 - 16, cy3 = by - (k % 2) * 5, r = 10 + (k % 3) * 2; const bg = x.createRadialGradient(cx3 - 3, cy3 - 4, 1, cx3, cy3, r); bg.addColorStop(0, "#8ad45a"); bg.addColorStop(1, "#2f7a2c"); x.fillStyle = bg; x.beginPath(); x.arc(cx3, cy3, r, 0, 7); x.fill(); }
  // a tilled farm field under the plots: dark fertile soil, furrows and a plank border (FarmVille look)
  x.fillStyle = "rgba(0,40,0,.3)"; x.beginPath(); x.roundRect(196, 244, 332, 134, 16); x.fill();
  const fg = x.createLinearGradient(0, 236, 0, 372); fg.addColorStop(0, "#9a6a3e"); fg.addColorStop(1, "#6a4426"); x.fillStyle = fg; x.beginPath(); x.roundRect(192, 236, 332, 134, 16); x.fill();
  x.strokeStyle = "rgba(50,28,12,.35)"; x.lineWidth = 2; for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(204, 248 + k * 14); x.lineTo(512, 248 + k * 14); x.stroke(); x.strokeStyle = "rgba(255,210,150,.12)"; x.beginPath(); x.moveTo(204, 250 + k * 14); x.lineTo(512, 250 + k * 14); x.stroke(); x.strokeStyle = "rgba(50,28,12,.35)"; }
  x.strokeStyle = "#e0b070"; x.lineWidth = 5; x.beginPath(); x.roundRect(192, 236, 332, 134, 16); x.stroke(); x.strokeStyle = "#7a4c22"; x.lineWidth = 1.5; x.stroke();
  // the barn: planks, a gambrel roof of shingles, a hay loft and a big door with a cross
  x.fillStyle = "rgba(0,40,0,.34)"; x.beginPath(); x.ellipse(120, 216, 100, 13, 0, 0, 7); x.fill();
  const bgd = x.createLinearGradient(26, 0, 158, 0); bgd.addColorStop(0, "#e04a36"); bgd.addColorStop(0.7, "#b8321f"); bgd.addColorStop(1, "#8c2417"); x.fillStyle = bgd; x.fillRect(26, 112, 132, 100);
  x.strokeStyle = "rgba(70,15,8,.4)"; x.lineWidth = 0.8; for (let k = 1; k < 14; k++) { x.beginPath(); x.moveTo(26 + k * 9.5, 112); x.lineTo(26 + k * 9.5, 212); x.stroke(); }
  x.fillStyle = "#f4ead0"; x.fillRect(24, 110, 4, 102); x.fillRect(156, 110, 4, 102);
  const rg = x.createLinearGradient(0, 56, 0, 116); rg.addColorStop(0, "#6a4a3a"); rg.addColorStop(1, "#3e2a22"); x.fillStyle = rg; x.beginPath(); x.moveTo(12, 118); x.lineTo(32, 82); x.lineTo(60, 60); x.lineTo(124, 60); x.lineTo(152, 82); x.lineTo(172, 118); x.closePath(); x.fill();
  x.strokeStyle = "rgba(20,10,6,.35)"; x.lineWidth = 0.8; for (let r2 = 0; r2 < 7; r2++) { x.beginPath(); x.moveTo(14 + r2 * 3, 118 - r2 * 9); x.lineTo(170 - r2 * 3, 118 - r2 * 9); x.stroke(); }
  x.fillStyle = "#3a261c"; x.fillRect(80, 74, 24, 24); x.fillStyle = "#e8c15a"; x.fillRect(82, 84, 20, 12);
  x.fillStyle = "#f4ead0"; x.fillRect(62, 148, 60, 64); x.fillStyle = "#c13a28"; x.fillRect(65, 151, 54, 58); x.strokeStyle = "#f4ead0"; x.lineWidth = 3; x.strokeRect(65, 151, 54, 58); x.beginPath(); x.moveTo(65, 151); x.lineTo(119, 209); x.moveTo(119, 151); x.lineTo(65, 209); x.stroke();
  // hay bales and a silo beside the barn
  for (const [hx, hy] of [[168, 206], [186, 208]]) { const hg = x.createLinearGradient(hx, hy - 14, hx, hy + 6); hg.addColorStop(0, "#f2d268"); hg.addColorStop(1, "#c8a03a"); x.fillStyle = hg; x.beginPath(); x.roundRect(hx - 9, hy - 12, 20, 16, 4); x.fill(); x.strokeStyle = "rgba(120,80,10,.5)"; x.lineWidth = 0.8; x.beginPath(); x.moveTo(hx - 3, hy - 12); x.lineTo(hx - 3, hy + 4); x.moveTo(hx + 4, hy - 12); x.lineTo(hx + 4, hy + 4); x.stroke(); }
  const sg2 = x.createLinearGradient(196, 0, 236, 0); sg2.addColorStop(0, "#e6ebf0"); sg2.addColorStop(0.5, "#fff"); sg2.addColorStop(1, "#aab4c0"); x.fillStyle = sg2; x.fillRect(198, 120, 36, 90); x.fillStyle = "#8d97a6"; x.beginPath(); x.ellipse(216, 120, 18, 8, 0, Math.PI, 0); x.fill(); x.strokeStyle = "rgba(90,100,115,.4)"; x.lineWidth = 1; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(198, 132 + k * 14); x.lineTo(234, 132 + k * 14); x.stroke(); }
  // the pen: grass inside a split-rail fence with posts and a soft shadow
  x.fillStyle = "rgba(0,40,0,.28)"; x.beginPath(); x.roundRect(560, 222, 238, 218, 14); x.fill();
  const pgr = x.createLinearGradient(0, 214, 0, 432); pgr.addColorStop(0, "#9ee070"); pgr.addColorStop(1, "#6fbf55"); x.fillStyle = pgr; x.beginPath(); x.roundRect(556, 214, 238, 218, 14); x.fill();
  for (let i = 0; i < 260; i++) { const gx = 560 + R() * 230, gy = 218 + R() * 210; x.strokeStyle = G5[Math.floor(R() * 5)]; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (R() - 0.5) * 3, gy - 4 - R() * 4); x.stroke(); }
  for (let i = 0; i < 5; i++) { const sx = 580 + R() * 190, sy = 240 + R() * 170; x.fillStyle = "rgba(226,190,100,.5)"; x.beginPath(); x.ellipse(sx, sy, 26 + R() * 14, 9, 0, 0, 7); x.fill(); for (let k = 0; k < 16; k++) { x.strokeStyle = k % 2 ? "#e8c85a" : "#c9a23a"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(sx - 20 + R() * 40, sy - 4 + R() * 8); x.lineTo(sx - 20 + R() * 40, sy - 6 + R() * 10); x.stroke(); } }
  const rail = (x0: number, y0: number, w: number) => { for (const dy of [0, 9]) { const wg = x.createLinearGradient(0, y0 + dy, 0, y0 + dy + 5); wg.addColorStop(0, "#d9a566"); wg.addColorStop(1, "#8a5a2a"); x.fillStyle = wg; x.fillRect(x0, y0 + dy, w, 5); } };
  rail(556, 210, 238); rail(556, 424, 238);
  for (let fx = 558; fx < 796; fx += 24) { for (const fy of [204, 418]) { const pgd = x.createLinearGradient(fx, 0, fx + 8, 0); pgd.addColorStop(0, "#c98f50"); pgd.addColorStop(1, "#6e4622"); x.fillStyle = pgd; x.fillRect(fx, fy, 8, 26); x.fillStyle = "#e8c48c"; x.fillRect(fx, fy, 8, 3); } }
  // a water trough in the pen
  x.fillStyle = "rgba(0,40,0,.3)"; x.beginPath(); x.ellipse(676, 318, 40, 8, 0, 0, 7); x.fill(); const tgd = x.createLinearGradient(0, 296, 0, 318); tgd.addColorStop(0, "#a8754a"); tgd.addColorStop(1, "#6e4622"); x.fillStyle = tgd; x.beginPath(); x.roundRect(644, 298, 64, 20, 5); x.fill(); x.fillStyle = "#6ab8ee"; x.beginPath(); x.roundRect(648, 300, 56, 8, 3); x.fill();
  // warm key light from the sun's side over everything still
  const kl = x.createLinearGradient(0, 0, VW, VH); kl.addColorStop(0, "rgba(255,230,160,.1)"); kl.addColorStop(1, "rgba(255,200,120,.02)"); x.fillStyle = kl; x.fillRect(0, 0, VW, VH);
  BG[kind] = c; return c;
}

function drawHouse(x: CanvasRenderingContext2D, a: any, H: { b: number; own: boolean }, i: number, stock: number, T: number) {
  const cx = a.x, cy = a.y - 6, w = 92, h = 58, L = cx - w / 2, Tp = cy - h / 2; const O = "#4a2c14";
  x.fillStyle = "rgba(0,40,0,.3)"; x.beginPath(); x.ellipse(cx, cy + h / 2 + 2, w * 0.6, 8, 0, 0, 7); x.fill();
  if (H.b <= 0) { // an empty foundation with the price
    x.setLineDash([6, 5]); x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 2; x.beginPath(); x.roundRect(L, Tp + 14, w, h - 8, 8); x.stroke(); x.setLineDash([]);
    x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.roundRect(L, Tp + 14, w, h - 8, 8); x.fill();
    const ok = stock >= HOUSE_COST[i], pulse = ok ? 1 + Math.sin(T * 5) * 0.06 : 1; x.save(); x.translate(cx, cy + 12); x.scale(pulse, pulse); x.fillStyle = ok ? "#ffb020" : "rgba(60,40,20,.75)"; x.strokeStyle = O; x.lineWidth = 1.5; x.beginPath(); x.roundRect(-38, -13, 76, 26, 13); x.fill(); x.stroke(); x.fillStyle = ok ? "#3a2410" : "#fff"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText("🔨 " + HOUSE_COST[i] + " 🌾", 0, 5); x.restore(); return; }
  x.save(); const prog = Math.min(1, H.b); if (prog < 1) { x.beginPath(); x.rect(L - 6, Tp + h * (1 - prog) - 8, w + 12, h * prog + 16); x.clip(); }
  const kind = a.id, wall = kind === "cow" ? ["#e04a36", "#a82c1c"] : kind === "chicken" ? ["#f0d29a", "#c89a5a"] : kind === "pig" ? ["#b98a5a", "#7e5530"] : ["#e8dcc4", "#b9a888"], roof = kind === "cow" ? ["#6a4a3a", "#3e2a22"] : kind === "chicken" ? ["#d8442e", "#962818"] : kind === "pig" ? ["#7a5a3a", "#4a3220"] : ["#d8b860", "#a8863a"];
  const wg = x.createLinearGradient(L, 0, L + w, 0); wg.addColorStop(0, wall[0]); wg.addColorStop(1, wall[1]); x.fillStyle = wg; x.strokeStyle = O; x.lineWidth = 2; x.beginPath(); x.roundRect(L + 4, Tp + 20, w - 8, h - 14, 4); x.fill(); x.stroke();
  x.strokeStyle = "rgba(60,30,10,.3)"; x.lineWidth = 1; for (let k = 1; k < 9; k++) { x.beginPath(); x.moveTo(L + 4 + k * (w - 8) / 9, Tp + 20); x.lineTo(L + 4 + k * (w - 8) / 9, Tp + h + 6); x.stroke(); }
  const rg = x.createLinearGradient(0, Tp, 0, Tp + 24); rg.addColorStop(0, roof[0]); rg.addColorStop(1, roof[1]); x.fillStyle = rg; x.strokeStyle = O; x.lineWidth = 2; x.beginPath(); if (kind === "cow") { x.moveTo(L - 4, Tp + 24); x.lineTo(L + 14, Tp + 4); x.lineTo(cx, Tp - 4); x.lineTo(L + w - 14, Tp + 4); x.lineTo(L + w + 4, Tp + 24); } else { x.moveTo(L - 6, Tp + 24); x.lineTo(cx, Tp - 6); x.lineTo(L + w + 6, Tp + 24); } x.closePath(); x.fill(); x.stroke();
  x.fillStyle = "#3a2216"; x.beginPath(); x.roundRect(cx - 12, Tp + h - 14, 24, 22, [8, 8, 0, 0]); x.fill(); x.stroke();
  if (kind === "cow") { x.strokeStyle = "#f4ead0"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 12, Tp + h - 14); x.lineTo(cx + 12, Tp + h + 8); x.moveTo(cx + 12, Tp + h - 14); x.lineTo(cx - 12, Tp + h + 8); x.stroke(); }
  x.restore();
  if (H.b < 1) { x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(cx - 30, cy - h / 2 - 16, 60, 7); x.fillStyle = "#ffd23f"; x.fillRect(cx - 30, cy - h / 2 - 16, 60 * H.b, 7); x.font = "16px system-ui"; x.textAlign = "center"; x.fillText("🔨", cx + 40, cy - h / 2 - 8 + Math.sin(T * 12) * 3); return; }
  if (!H.own) { const ok = stock >= BUY_COST[i], pulse = 1 + Math.sin(T * 4) * 0.05; x.save(); x.translate(cx, cy - h / 2 - 16); x.scale(pulse, pulse); x.fillStyle = ok ? "#fff" : "rgba(255,255,255,.7)"; x.strokeStyle = ok ? "#e8a010" : O; x.lineWidth = 1.8; x.beginPath(); x.roundRect(-38, -13, 76, 26, 13); x.fill(); x.stroke(); x.fillStyle = "#222"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText(a.prod + " " + BUY_COST[i] + " 🌾", 0, 5); x.restore(); }
}

function drawRanch(x: CanvasRenderingContext2D, S: any, T: number, kind: string) {
  const O = "rgba(45,28,12,.5)";
  x.drawImage(farmBg(kind), 0, 0, VW, VH);
  for (let i = 0; i < 3; i++) { const cx = ((T * 12 + i * 280) % 1000) - 100, cy = 40 + i * 34; x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.arc(cx, cy, 20, 0, 7); x.arc(cx + 22, cy + 4, 16, 0, 7); x.arc(cx - 20, cy + 6, 14, 0, 7); x.fill(); }
  x.fillStyle = "#fff"; x.font = "900 15px system-ui"; x.textAlign = "center"; x.fillText("🌾 " + Math.floor(S.stock), 91, 100);
  // the windmill
  x.fillStyle = "#f4ead0"; x.strokeStyle = O; x.beginPath(); x.moveTo(668, 210); x.lineTo(684, 120); x.lineTo(716, 120); x.lineTo(732, 210); x.closePath(); x.fill(); x.stroke();
  x.save(); x.translate(700, 118); x.rotate(T * 0.8); x.fillStyle = "#fff"; for (let k = 0; k < 4; k++) { x.rotate(Math.PI / 2); x.beginPath(); x.rect(-4, -62, 8, 62); x.fill(); x.stroke(); } x.restore(); x.fillStyle = O; x.beginPath(); x.arc(700, 118, 6, 0, 7); x.fill();
  // the delivery rocket on its pad
  x.fillStyle = "#b8c4d8"; x.strokeStyle = O; x.beginPath(); x.ellipse(110, 330, 60, 16, 0, 0, 7); x.fill(); x.stroke();
  const ry = 330 - 40 - (S.launch > 0 ? (1 - S.launch / 2) * 360 : 0); x.save(); x.translate(110, ry); x.fillStyle = "#fff"; x.beginPath(); x.moveTo(0, -48); x.quadraticCurveTo(22, -20, 16, 34); x.lineTo(-16, 34); x.quadraticCurveTo(-22, -20, 0, -48); x.fill(); x.stroke(); x.fillStyle = "#ff5a4a"; x.beginPath(); x.moveTo(0, -48); x.quadraticCurveTo(10, -38, 12, -28); x.lineTo(-12, -28); x.quadraticCurveTo(-10, -38, 0, -48); x.fill(); x.fillStyle = "#6cc3ff"; x.beginPath(); x.arc(0, -6, 8, 0, 7); x.fill(); x.stroke();
  if (S.launch > 0) { x.fillStyle = "rgba(255,170,60,.9)"; x.beginPath(); x.moveTo(-10, 34); x.lineTo(0, 34 + 30 + 10 * Math.sin(T * 30)); x.lineTo(10, 34); x.fill(); } x.restore();
  // plots
  for (let i = 0; i < PLOTS.length; i++) { const p = PLOTS[i], c = S.plots[i]; x.fillStyle = "rgba(0,30,0,.3)"; x.beginPath(); x.roundRect(p.x - 32, p.y - 16, 68, 48, 10); x.fill(); const sg2 = x.createLinearGradient(0, p.y - 22, 0, p.y + 26); sg2.addColorStop(0, c.w > 0 ? "#5a3a22" : "#7a4e2c"); sg2.addColorStop(1, c.w > 0 ? "#3e2816" : "#563619"); x.fillStyle = sg2; x.strokeStyle = O; x.lineWidth = 1.2; x.beginPath(); x.roundRect(p.x - 34, p.y - 22, 68, 48, 9); x.fill(); x.stroke();
    x.strokeStyle = "rgba(60,30,10,.45)"; x.lineWidth = 1.1; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(p.x - 28, p.y + k * 12); x.lineTo(p.x + 28, p.y + k * 12); x.stroke(); }
    if (c.crop) { const cr = CROPS.find(q => q.id === c.crop)!, st = c.p < 34 ? 0 : c.p < 100 ? 1 : 2, bob = st === 2 ? Math.abs(Math.sin(T * 5 + i)) * 4 : 0; x.save(); x.translate(p.x, p.y + 6 - bob);
      x.fillStyle = "#3bd04a"; x.strokeStyle = "#2a5a1a"; x.lineWidth = 1.8;
      if (st === 0) { x.beginPath(); x.ellipse(0, 6, 8, 5, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(0, 6); x.lineTo(-5, -4); x.lineTo(0, 0); x.lineTo(5, -4); x.closePath(); x.fill(); x.stroke(); }
      else { for (const dx of [-14, 0, 14]) { x.beginPath(); x.ellipse(dx, -2, 7, 14, dx / 40, 0, 7); x.fill(); x.stroke(); }
        if (st === 2) { x.fillStyle = cr.col; for (const dx of [-14, 0, 14]) { x.beginPath(); if (cr.id === "carrot") { x.moveTo(dx - 6, 8); x.lineTo(dx + 6, 8); x.lineTo(dx, 22); x.closePath(); } else if (cr.id === "corn") x.ellipse(dx, 4, 5, 11, 0, 0, 7); else x.arc(dx, 8, cr.id === "pumpkin" ? 10 : 7, 0, 7); x.fill(); x.stroke(); x.fillStyle = "rgba(255,255,255,.45)"; x.beginPath(); x.ellipse(dx - 3, cr.id === "carrot" ? 11 : 4, 2.2, 3.5, 0, 0, 7); x.fill(); x.fillStyle = cr.col; } x.fillStyle = "rgba(255,255,255,.9)"; x.fillRect(-2, -26 - bob, 4, 4); x.fillRect(10, -20 - bob, 3, 3); } }
      x.restore(); if (st < 2) { x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(p.x - 24, p.y + 26, 48, 5); x.fillStyle = "#7dff7a"; x.fillRect(p.x - 24, p.y + 26, 48 * c.p / 100, 5); } }
    if (c.w > 0) { x.fillStyle = "rgba(90,170,255,.8)"; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(p.x - 20 + k * 20, p.y - 14 + ((T * 30 + k * 9) % 14), 2, 0, 7); x.fill(); } } }
  // the pens (fence and floor are in the cached scenery)
  for (let i = 0; i < ANIMALS.length; i++) drawHouse(x, ANIMALS[i], S.houses[i], i, S.stock, T);
  for (let i = 0; i < ANIMALS.length; i++) { if (!S.houses[i].own) continue; const a = ANIMALS[i], A = S.animals[i], wx = a.x + Math.sin(T * 0.7 + i * 2) * 14, wy = a.y + 14 + Math.cos(T * 0.5 + i) * 6 + (A.prog >= 100 ? -Math.abs(Math.sin(T * 6)) * 4 : 0);
    x.fillStyle = "rgba(0,40,0,.3)"; x.beginPath(); x.ellipse(wx, wy + 22, 38, 9, 0, 0, 7); x.fill(); x.save(); x.translate(wx, wy); x.strokeStyle = "#4a2c14"; x.lineWidth = 2; const face = Math.cos(T * 0.7 + i * 2) >= 0 ? 1 : -1; x.scale(face * 1.2, 1.2);
    const body = (fill: string, rx: number, ry: number) => { const bg3 = x.createRadialGradient(-rx * 0.3, -ry * 0.5, 2, 0, 0, rx * 1.1); bg3.addColorStop(0, "#fff"); bg3.addColorStop(0.35, fill); bg3.addColorStop(1, "#b9aaa0"); x.fillStyle = fill === "#fff" || fill === "#fffaf0" ? bg3 : fill; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill(); x.stroke(); };
    const eye = (ex: number, ey: number) => { x.fillStyle = "#fff"; x.beginPath(); x.arc(ex, ey, 4, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#222"; x.beginPath(); x.arc(ex + 1, ey, 2, 0, 7); x.fill(); };
    if (a.id === "cow") { body("#fff", 30, 20); x.fillStyle = "#222"; x.beginPath(); x.ellipse(-10, -6, 9, 6, 0, 0, 7); x.ellipse(8, 7, 8, 5, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(28, -6, 14, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#ffb0c0"; x.beginPath(); x.ellipse(36, 0, 8, 6, 0, 0, 7); x.fill(); x.stroke(); eye(26, -10); x.fillStyle = "#fff"; x.fillRect(-16, 14, 6, 14); x.fillRect(10, 14, 6, 14); }
    else if (a.id === "chicken") { body("#fff", 15, 13); x.fillStyle = "#fff"; x.beginPath(); x.arc(15, -9, 8, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#e23a2a"; x.beginPath(); x.arc(15, -18, 4, 0, 7); x.fill(); x.fillStyle = "#ffb020"; x.beginPath(); x.moveTo(22, -9); x.lineTo(30, -7); x.lineTo(22, -5); x.fill(); eye(17, -11); x.fillStyle = "#ffb020"; x.fillRect(-4, 12, 3, 8); x.fillRect(4, 12, 3, 8); }
    else if (a.id === "pig") { body("#ffa8c0", 26, 18); x.fillStyle = "#ffa8c0"; x.beginPath(); x.arc(24, -4, 12, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#ff7a9a"; x.beginPath(); x.ellipse(33, 0, 6, 5, 0, 0, 7); x.fill(); x.stroke(); eye(22, -9); x.beginPath(); x.moveTo(20, -14); x.lineTo(16, -22); x.lineTo(26, -16); x.fillStyle = "#ff8aa8"; x.fill(); x.stroke(); x.fillStyle = "#ffa8c0"; x.fillRect(-14, 14, 6, 12); x.fillRect(8, 14, 6, 12); }
    else { body("#fffaf0", 25, 20); for (const [bx, by] of [[-14, -8], [-4, -14], [8, -10], [-10, 6], [6, 8]]) { x.fillStyle = "#fffaf0"; x.beginPath(); x.arc(bx, by, 11, 0, 7); x.fill(); x.stroke(); } x.fillStyle = "#4a3a3a"; x.beginPath(); x.arc(26, -4, 10, 0, 7); x.fill(); x.stroke(); eye(24, -8); x.fillStyle = "#4a3a3a"; x.fillRect(-12, 16, 5, 12); x.fillRect(8, 16, 5, 12); }
    x.restore();
    const hungry = A.fed <= 0;
    if (hungry) { x.fillStyle = "rgba(255,255,255,.95)"; x.strokeStyle = O; x.lineWidth = 1.1; x.beginPath(); x.roundRect(wx - 18, wy - 56, 36, 24, 8); x.fill(); x.stroke(); x.fillStyle = "#222"; x.font = "16px system-ui"; x.textAlign = "center"; x.fillText("🍎", wx, wy - 38); }
    else if (A.prog >= 100) { x.fillStyle = "rgba(255,255,255,.95)"; x.strokeStyle = "#ffb020"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(wx - 18, wy - 58 - Math.abs(Math.sin(T * 5)) * 4, 36, 26, 8); x.fill(); x.stroke(); x.font = "18px system-ui"; x.textAlign = "center"; x.fillText(a.prod, wx, wy - 38 - Math.abs(Math.sin(T * 5)) * 4); }
    else { x.fillStyle = "rgba(0,0,0,.3)"; x.fillRect(wx - 20, wy - 42, 40, 5); x.fillStyle = "#ffd23f"; x.fillRect(wx - 20, wy - 42, 40 * A.prog / 100, 5); } }
  // butterflies
  for (let i = 0; i < 3; i++) { const bx = 300 + i * 90 + Math.sin(T * 1.3 + i) * 50, by = 200 + Math.cos(T * 1.7 + i * 2) * 20; x.fillStyle = ["#ff7ab8", "#7ad0ff", "#ffe06a"][i]; x.beginPath(); x.ellipse(bx - 4, by, 5, 3 + Math.abs(Math.sin(T * 14 + i)) * 3, 0, 0, 7); x.ellipse(bx + 4, by, 5, 3 + Math.abs(Math.sin(T * 14 + i)) * 3, 0, 0, 7); x.fill(); }
  // ripe bubbles and floating numbers (FarmVille style)
  x.textAlign = "center"; x.font = "20px sans-serif";
  const bub = (bx: number, by: number, ic: string) => { const o = Math.sin(T * 5) * 3; x.fillStyle = "#fff"; x.beginPath(); x.arc(bx, by + o, 17, 0, 7); x.fill(); x.strokeStyle = "#e8a010"; x.lineWidth = 1.5; x.stroke(); x.fillStyle = "#000"; x.fillText(ic, bx, by + 7 + o); };
  S.plots.forEach((c: any, i: number) => { if (c.crop && c.p >= 100) bub(PLOTS[i].x, PLOTS[i].y - 34, ITEM_ICON[c.crop] || "✔"); });
  S.animals.forEach((A: any, i: number) => { if (A.prog >= 100) bub(ANIMALS[i].x, ANIMALS[i].y - 66, ANIMALS[i].prod); });
  x.font = "bold 22px sans-serif"; for (const f of S.floats) { x.globalAlpha = Math.max(0, 1 - f.age / 1.4); x.fillStyle = "#fff"; x.strokeStyle = "#3a2410"; x.lineWidth = 4; x.strokeText(f.txt, f.x, f.y - f.age * 40); x.fillText(f.txt, f.x, f.y - f.age * 40); } x.globalAlpha = 1;
  finishLook(x, VW, VH, T, "255,226,170", 0.3);
}

export default function AdventureRanch({ P, lang, onWin, onExit, onRetry }: any) {
  const t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const farmerBonus = (() => { try { return localStorage.getItem("tg_adv_career") === "farm" ? 1.25 : 1; } catch (e) { return 1; } })();
  const G = useRef<any>(null);
  if (!G.current) G.current = { quota: QUOTA[P.kind] || 260, tm: TIMEMUL[P.kind] || 1, t: 0, stock: 16, delivered: 0, houses: ANIMALS.map(() => ({ b: 0, own: false })), seed: "carrot", plots: PLOTS.map(() => ({ crop: null as any, p: 0, w: 0 })), animals: ANIMALS.map(() => ({ fed: 0, prog: 0 })), launch: 0, ended: false, won: false, fact: 0, xp: 0, lvl: 1, lvlUp: 0, orders: [] as Order[], inv: {} as Record<string, number>, floats: [] as any[], target: "human" as string, happy: { human: 0, alien: 0 } as any, sent: { human: 0, alien: 0 } as any };
  if (!G.current.orders.length) for (let i = 0; i < 3; i++) G.current.orders.push(mkOrder(G.current));
  const S = G.current;
  const [, setTick] = useState(0), [gear, setGear] = useState(false), pausedRef = useRef(false);
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null), cvRef = useRef<HTMLCanvasElement>(null), boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth * 1.05);
  useEffect(() => { const f = () => setPortrait(window.innerHeight > window.innerWidth * 1.05); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => {
    try { enterFs(); } catch (e) {} const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    const cv = cvRef.current, el = boxRef.current; let raf = 0, alive = true, lastDraw = 0, last = performance.now();
    const fit = () => { if (!el || !cv) return; const wr = el.parentElement, aw = wr ? wr.clientWidth : window.innerWidth, ah = wr ? wr.clientHeight : window.innerHeight, W = Math.max(280, Math.min(aw, Math.round(ah * VW / VH))), H = Math.round(W * VH / VW), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; el.style.width = W + "px"; setBox({ w: W, h: H }); };
    fit(); const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(fit) : null; if (ro && el) ro.observe(el);
    const draw = (now: number) => { if (!alive) return; raf = requestAnimationFrame(draw); if (now - lastDraw < 40 || !cv) return; lastDraw = now; const x = cv.getContext("2d"); if (!x) return; const k = cv.width / VW; x.setTransform(k, 0, 0, k, 0, 0); try { drawRanch(x, S, now / 1000, P.kind || "moon"); } catch (e) {} };
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
    (window as any).__advRanch = { state: () => ({ t: S.t, stock: S.stock, delivered: S.delivered, plots: S.plots.map((c: any) => ({ crop: c.crop, p: c.p })), animals: S.animals.map((a: any) => ({ fed: a.fed, prog: a.prog })), houses: S.houses.map((h: any) => ({ b: h.b, own: h.own })), won: S.won, target: S.quota }), tick: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.1); i++) step(0.1); }, give: (n: number) => { S.stock += n; } };
    return () => { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advRanch; } catch (e) {} };
  }, []);
  const play = (n: string) => sfxRef.current && sfxRef.current.play(n);
  const addXp = (n: number) => { S.xp += n; while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; S.lvlUp = 2.2; S.stock += 5; play("win"); } };
  const float = (txt: string, x: number, y: number) => { S.floats.push({ txt, x, y, age: 0 }); };
  const bump = (item: string, n: number) => { S.inv[item] = (S.inv[item] || 0) + n; for (const o of S.orders) if ((o.kind === "grow" || o.kind === "make") && o.item === item && o.got < o.need) o.got = Math.min(o.need, o.got + 1); };
  const tapPlot = (i: number) => { const c = S.plots[i]; if (S.ended) return;
    if (!c.crop) { c.crop = S.seed; c.p = 0; play("pop"); }
    else if (c.p >= 100) { const cr = CROPS.find(q => q.id === c.crop)!; const y = Math.round(cr.yield * farmerBonus); S.stock += y; bump(c.crop, 1); addXp(2); float("+" + y + " " + cr.icon, PLOTS[i].x, PLOTS[i].y - 30); c.crop = null; c.p = 0; c.w = 0; play("pickup"); }
    else if (c.w <= 0) { c.w = 5; play("hit"); }
    setTick(v => v + 1); };
  const tapAnimal = (i: number) => { const A = S.animals[i], a = ANIMALS[i], H = S.houses[i]; if (S.ended) return;
    if (H.b <= 0) { if (S.stock >= HOUSE_COST[i]) { S.stock -= HOUSE_COST[i]; H.b = 0.01; play("pop"); float("🔨 -" + HOUSE_COST[i], a.x, a.y - 40); } else play("hurt"); setTick(v => v + 1); return; }
    if (H.b < 1) { setTick(v => v + 1); return; }
    if (!H.own) { if (S.stock >= BUY_COST[i]) { S.stock -= BUY_COST[i]; H.own = true; play("pickup"); float(a.prod + " +1", a.x, a.y - 40); addXp(3); } else play("hurt"); setTick(v => v + 1); return; }
    if (A.prog >= 100) { const y = Math.round(a.yield * farmerBonus); S.stock += y; bump(a.id, 1); addXp(3); float("+" + y + " " + a.prod, a.x, a.y - 60); A.prog = 0; A.fed = 0; play("pickup"); }
    else if (A.fed <= 0) { if (S.stock >= a.feed) { S.stock -= a.feed; A.fed = 1; play("pop"); } else play("hurt"); }
    setTick(v => v + 1); };
  const deliver = () => { if (S.ended || S.stock < 1 || S.launch > 0) return; const tg = S.target as string; const liked = Object.keys(S.inv).reduce((n, k) => n + (LIKES[tg].includes(k) ? S.inv[k] : 0), 0); const bonus = Math.min(S.stock, liked * 4) * 0.25; const n = S.stock; S.delivered += n + bonus; S.sent[tg] += n; S.happy[tg] += n; for (const o of S.orders) if (o.kind === "send" && o.from === tg && o.got < o.need) o.got = Math.min(o.need, o.got + n); float("🚀 " + Math.round(n + bonus), 110, 250); S.stock = 0; S.inv = {}; S.launch = 2; play("rocket"); addXp(Math.ceil(n / 4)); setTick(v => v + 1); };
  const [ordersOpen, setOrdersOpen] = useState(false);
  const claim = (id: number) => { const o = S.orders.find((q: Order) => q.id === id); if (!o || o.got < o.need) return; S.stock += o.reward; addXp(o.xp); S.orders = S.orders.filter((q: Order) => q.id !== id); S.orders.push(mkOrder(S)); play("pickup"); setTick(v => v + 1); };
  const ready = S.orders.filter((o: Order) => o.got >= o.need).length;
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const k = box.w / VW, pct = Math.min(100, S.delivered / S.quota * 100), fact = FACTS[S.fact];
  return (
    <div className={"adv-farm adv-ranch arf" + (portrait ? " rot" : "")} data-ranch="1">
      <div className="arf-in">
      <div className="ar-stage" ref={boxRef}>
        <canvas ref={cvRef} className="ar-cv" aria-hidden="true" />
        {PLOTS.map((p, i) => (<button key={i} className="ar-hit" data-plot={i} aria-label={"plot " + i} onClick={() => tapPlot(i)} style={{ left: (p.x - 34) * k, top: (p.y - 22) * k, width: 68 * k, height: 48 * k }} />))}
        {ANIMALS.map((a, i) => (<button key={a.id} className="ar-hit ar-an" data-animal={a.id} aria-label={a.id} onClick={() => tapAnimal(i)} style={{ left: (a.x - 40) * k, top: (a.y - 52) * k, width: 80 * k, height: 80 * k }} />))}
        <button className="ar-hit ar-ship" data-deliver="1" aria-label="deliver" onClick={deliver} style={{ left: 50 * k, top: 250 * k, width: 120 * k, height: 110 * k }} />
        <div className="arf-top">
          <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
          <div className="arf-hud">
            <div className="adv-lv">🌾 {T3(lang, P.th, P.en, P.zh).split(" · ")[0]} · ⏱ {Math.floor(S.t)}s · {t("ในโรงนา ", "In the barn ", "仓库 ")}{Math.floor(S.stock)} · {t("ส่งแล้ว ", "delivered ", "已运出 ")}{Math.round(S.delivered)}/{S.quota}</div>
            <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{t("อาณานิคมได้อาหาร ", "Colony fed ", "殖民地粮食 ")}{Math.round(pct)}%</b></div>
          </div>
          <GearButton onClick={openGear} />
        </div>
        <div className="ar-fv" data-fv="1"><span className="ar-star">★ {S.lvl}</span><span className="ar-xp"><i style={{ width: Math.min(100, S.xp / xpNeed(S.lvl) * 100) + "%" }} /></span><button className="ar-ord" data-orders="1" onClick={() => setOrdersOpen(o => !o)}>📋 {t("ออเดอร์", "Orders", "订单")}{ready > 0 && <b>{ready}</b>}</button></div>
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
