/* Adventure Mode cinematics (owner, 2026-10-11: "a film before every map, beautiful CG, telling the story and what the mission is,
   with music and sound effects, to make people want to play"). Drawn live on a canvas from code, so nothing is downloaded: Earth in
   2100, the factory that builds the pioneer robots, the fleet leaving, the approach to the planet, the surface (its own look per world),
   the guardian when there is one, and an objective card with the player's own robot. Subtitles in th/en/zh (there is no voice-over),
   an original score and sound effects from adventure-music.ts. Tap = next shot, Skip = straight into the map. */
import { useEffect, useRef, useState, memo } from "react";
import { CyberAvatar } from "./cyber-avatar";
import { createCineAudio, renderCinePreview, type CineShot } from "./adventure-music";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const COMMON = {
  earth: ["ปี 2100 มนุษยชาติรุ่งเรืองสุดขีด แต่โลกเริ่มเล็กเกินไปสำหรับความฝัน", "Year 2100. Humanity is thriving, but Earth has become too small for its dreams.", "公元2100年，人类空前繁荣，但地球已容不下我们的梦想。"],
  factory: ["เราจึงสร้างหุ่นยนต์ผู้บุกเบิก ให้ทำงานแทนมนุษย์ ก่อนที่ใครจะเหยียบดาวดวงนั้น", "So we built pioneer robots to do the work in our place, before any human sets foot there.", "于是我们制造先遣机器人，在人类踏足之前替我们完成一切。"],
  launch: ["ฝูงยานพุ่งออกจากระบบสุริยะ ขนทรัพยากรกลับโลก และปักธงอาณานิคมแห่งใหม่", "The fleet leaves the Solar System to bring resources home and plant the flags of new colonies.", "舰队驶离太阳系，把资源运回地球，为新殖民地插上旗帜。"],
};
type L3 = string[];
const INTRO: Record<string, L3> = {
  luma: ["ลูมา — ดาวป่าเรืองแสง เต็มไปด้วยสิ่งมีชีวิตที่ไม่เคยมีใครพบ", "Luma: a glowing jungle world, full of life no one has met.", "卢玛——荧光丛林星球，遍布无人见过的生命。"],
  ferro: ["เฟอร์โร — ทะเลทรายเหล็ก แร่มหาศาลที่ถูกสนิมและหอแม่เหล็กยึดไว้", "Ferro: an iron desert, its ore held hostage by rust and magnet pylons.", "费罗——钢铁沙漠，矿藏被锈虫与磁力塔占据。"],
  jovia: ["โจเวีย — ดาวแก๊สยักษ์ พลังงานมหาศาลหมุนวนอยู่ใต้เมฆ", "Jovia: a gas giant, with a world's worth of energy swirling under the clouds.", "朱维亚——气态巨行星，云层下涌动着庞大的能量。"],
  kryo: ["ไครโอ — โลกน้ำแข็ง ที่ซ่อนแหล่งน้ำของอาณานิคมไว้ใต้ผลึก", "Kryo: an ice world that hides the colony's water beneath crystal.", "克里奥——冰封星球，殖民地的水源藏在水晶之下。"],
  pyra: ["ไพรา — เตาปฏิกรณ์ธรรมชาติ ลาวาเดือดและแกนที่ใกล้ระเบิด", "Pyra: a natural reactor, boiling lava and a core close to the edge.", "派拉——天然反应堆，沸腾的熔岩与濒临失控的核心。"],
  nexa: ["เน็กซา — ซากเมืองอวกาศของอารยธรรมที่เงียบหายไป", "Nexa: the wrecked city of a civilization that went silent.", "内克萨——一个沉寂文明的残骸之城。"],
  cobalt: ["แถบโคบอลต์ — ดาวเคราะห์น้อยนับพัน เต็มไปด้วยแร่หายาก", "The Cobalt Belt: thousands of asteroids heavy with rare ore.", "钴带——数千颗小行星，蕴藏稀有矿石。"],
  helios: ["เฮลิออส — ดาวฤกษ์ต่างระบบ พลังงานเหลือเฟือ ถ้ายึดมันได้", "Helios: a foreign sun, with limitless energy for whoever takes it.", "赫利俄斯——异星恒星，谁占领它谁就拥有无尽能量。"],
  ashfall: ["แอชฟอลล์ — ดาวที่เอเลี่ยนสร้างฐานทัพไว้เต็มพื้นผิว", "Ashfall: a world the aliens have covered in military bases.", "灰烬星——遍布外星军事基地的星球。"],
};
const STORY: Record<string, L3> = {
  luma: ["ก่อนมนุษย์จะย้ายเข้า ต้องเคลียร์สัตว์ประหลาดเรืองแสงออกจากป่านี้ให้หมด", "Before people can settle, the glowing creatures of this jungle must be cleared.", "在人类入住之前，必须清除这片丛林里的发光怪物。"],
  ferro: ["รถขุดแร่ติดอยู่ที่ขอบทะเลทราย ต้องเปิดทางให้พวกเขา", "The mining rigs are stuck at the desert's edge. Someone has to open the road.", "采矿车队被困在沙漠边缘，必须有人打通道路。"],
  jovia: ["เครื่องเก็บพลังงานต้องลอยเหนือเมฆ และมีสิ่งมีชีวิตพุ่งเข้าใส่มันเป็นคลื่น", "The harvester must hover over the clouds, and the creatures come at it in waves.", "采集器要悬浮在云海之上，而怪物会成波涌来。"],
  kryo: ["ผลึกน้ำแข็งมีชีวิต และผู้พิทักษ์ของมันไม่ยอมให้ใครแตะน้ำ", "The crystals are alive, and their warden will not let anyone near the water.", "水晶是活的，它们的守卫不许任何人接近水源。"],
  pyra: ["บ่อลาวาขวางทาง และแกนปฏิกรณ์ต้องถูกปิดก่อนมันจะระเบิดทั้งดาว", "Lava pools bar the way, and the core must be shut down before it takes the planet with it.", "熔岩池挡住去路，必须在核心炸毁星球之前将其关闭。"],
  nexa: ["แผ่นพื้นไฟฟ้ายังทำงาน และผู้ควบคุมคนสุดท้ายยังตื่นอยู่", "The floor plates still carry current, and the last overseer is still awake.", "地板电击板仍在通电，最后的监管者还醒着。"],
  cobalt: ["ต้องขุดแร่ให้พอ แล้วส่งแคปซูลกลับโลก เพื่อให้อาณานิคมเติบโต", "Dig enough ore and launch the capsule home, so the colony can grow.", "采足矿石，把货舱发射回地球，殖民地才能壮大。"],
  helios: ["สถานีเก็บพลังงานสามจุดเรียงรายอยู่ใต้ดวงอาทิตย์ ศัตรูจะไม่ปล่อยให้ใครยึดไป", "Three collector stations stand under this sun, and the enemy will not give them up.", "三座能量采集站矗立在恒星之下，敌人不会拱手相让。"],
  ashfall: ["เราจะทิ้งระเบิดนิวเคลียร์จากวงโคจรก่อน แล้วค่อยลงไปกวาดล้างส่วนที่เหลือ", "First we drop nuclear warheads from orbit. Then we land and clear what is left.", "先从轨道投下核弹，再降落扫荡残余的敌人。"],
};
const GOAL: Record<string, L3[]> = {
  luma: [["เคลียร์สัตว์ประหลาดระหว่างทาง", "Clear the creatures on the way", "清除沿途怪物"], ["ตอบคำถามที่ beacon เพื่อรับ EXP", "Answer the beacons for EXP", "回答信标问题获得经验"], ["ล้มผู้พิทักษ์ลูมาที่ท้ายแมป", "Defeat the Luma Warden at the end", "击败终点的卢玛守卫"]],
  ferro: [["ฝ่าสนิมและหอแม่เหล็ก", "Fight through rust and pylons", "突破锈虫与磁力塔"], ["เก็บคริสตัลเพื่ออัปเกรด", "Collect crystals to upgrade", "收集晶体用于升级"], ["ล้มผู้พิทักษ์เหล็ก", "Defeat the Iron Warden", "击败钢铁守卫"]],
  jovia: [["ปกป้องเครื่องเก็บพลังงานให้ครบ 90 วินาที", "Hold out for 90 seconds", "坚守 90 秒"], ["สู้กับคลื่นศัตรูที่ถาโถม", "Beat back each wave", "击退每一波敌人"], ["ถ้าล้ม เวลานับใหม่", "If you fall, the clock restarts", "倒下则重新计时"]],
  kryo: [["ผ่านมอนสเตอร์น้ำแข็ง", "Pass the ice creatures", "穿过冰霜怪物"], ["ระวังเกล็ดผลึก", "Watch the crystal shards", "小心晶体碎片"], ["ล้มผู้พิทักษ์น้ำแข็ง", "Defeat the Frost Warden", "击败冰霜守卫"]],
  pyra: [["กระโดดข้ามบ่อลาวา", "Jump the lava pools", "跳过熔岩池"], ["สู้ผ่านมอนสเตอร์เพลิง", "Fight the fire creatures", "击败烈焰怪物"], ["ปิดแกนด้วยการล้มผู้พิทักษ์", "Shut the core down: defeat its warden", "击败守卫，关闭核心"]],
  nexa: [["กระโดดข้ามแผ่นไฟฟ้าตอนที่ติด", "Jump the shock plates while live", "电击板通电时跳过"], ["จัดการโดรนและโกเลมเศษเหล็ก", "Take down drones and golems", "解决无人机与废铁魔像"], ["ล้มผู้ควบคุม — มันจะโกรธเมื่อเลือดเหลือครึ่ง", "Defeat the overseer: it enrages at half health", "击败监管者——半血时它会狂暴"]],
  cobalt: [["ทุบก้อนแร่ด้วยหมัดหรือเตะ", "Break ore with punches or kicks", "用拳脚击碎矿石"], ["เก็บให้ได้ 10 ก้อนขึ้นไป", "Gather at least 10 ore", "至少采集 10 块矿"], ["ส่งที่แท่นขวาสุดเพื่อยิงกลับโลก", "Launch it from the far-right pad", "在最右平台发射回地球"]],
  helios: [["ยืนยึดสถานีทีละจุด จุดละ 10 วินาที", "Hold each station for 10 seconds", "逐一坚守采集站 10 秒"], ["ป้องกันคลื่นศัตรูขณะยึด", "Beat back the waves meanwhile", "占领期间击退敌军"], ["ยึดครบ 3 จุดเพื่อเป็นเจ้าของดวงอาทิตย์", "Take all three to own the sun", "占领全部三座，拥有恒星"]],
  ashfall: [["ปล่อยหัวรบ 3 ลูกให้โดนฐานมากที่สุด", "Drop 3 warheads on as many bases as you can", "用 3 枚弹头摧毁尽可能多的基地"], ["ฐานที่โดนจะไม่มีทหารตอนบุก", "Destroyed bases have no defenders", "被摧毁的基地没有守军"], ["ลงพื้นที่แล้วล้มผู้บัญชาการ", "Land and defeat the commander", "降落并击败指挥官"]],
};
const TYPE: Record<string, string> = { luma: "jungle", ferro: "desert", jovia: "gas", kryo: "ice", pyra: "lava", nexa: "wreck", cobalt: "belt", helios: "sun", ashfall: "strike" };

export function cinePlan(P: any): CineShot[] {
  const plan: CineShot[] = [{ kind: "earth", dur: 4.2 }, { kind: "factory", dur: 4.2 }, { kind: "launch", dur: 3.6 }, { kind: "approach", dur: 4.4 }, { kind: P.mission === "strike" ? "strike" : "surface", dur: 5.2 }];
  if (P.boss && P.boss[0] !== "-") plan.push({ kind: "boss", dur: 3.8 });
  plan.push({ kind: "objective", dur: 6 });
  return plan;
}
const captionFor = (P: any, kind: string, lang: string) => {
  const g = (a: L3) => T3(lang, a[0], a[1], a[2]);
  if (kind === "earth" || kind === "factory" || kind === "launch") return g((COMMON as any)[kind]);
  if (kind === "approach") return g(INTRO[P.id] || INTRO.luma);
  if (kind === "surface" || kind === "strike") return g(STORY[P.id] || STORY.luma);
  if (kind === "boss") return T3(lang, "ที่ปลายทาง มี " + P.boss[0] + " รออยู่", "At the end of the road, " + P.boss[1] + " is waiting.", "路的尽头，" + P.boss[2] + "正在等候。");
  return "";
};

/* ── drawing ── */
type Cx = CanvasRenderingContext2D;
const STARS = Array.from({ length: 240 }, (_, i) => ({ x: rnd(i), y: rnd(i + 400), z: 0.2 + rnd(i + 800) * 0.8, ph: rnd(i + 1200) * 6.3 }));
const rgba = (rgb: string, a: number) => `rgba(${rgb},${a})`;
const hexRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return "120,160,200"; const n = parseInt(m[1], 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
function space(x: Cx, W: number, H: number, t: number, speed: number, tint: string) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#02030a"); g.addColorStop(1, "#06081a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) { const cx = (0.2 + i * 0.35 + Math.sin(t * 0.05 + i) * 0.05) * W, cy = (0.3 + 0.25 * ((i * 7) % 3) / 2) * H, r = H * (0.5 + i * 0.1); const n = x.createRadialGradient(cx, cy, 0, cx, cy, r); n.addColorStop(0, rgba(tint, 0.13)); n.addColorStop(1, rgba(tint, 0)); x.fillStyle = n; x.fillRect(0, 0, W, H); }
  for (const s of STARS) { const sx = ((s.x * W - t * speed * s.z * 40) % W + W) % W, tw = 0.5 + 0.5 * Math.sin(t * 2 + s.ph); x.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * s.z * tw})`; x.fillRect(sx, s.y * H, 1 + s.z * 1.4, 1 + s.z * 1.4); }
  x.globalCompositeOperation = "source-over";
}
function sphere(x: Cx, cx: number, cy: number, r: number, base: string, glow: string, lightDeg = -35, bands = 0, lights = false, t = 0) {
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip();
  const lx = cx + Math.cos(lightDeg * Math.PI / 180) * r * 0.5, ly = cy + Math.sin(lightDeg * Math.PI / 180) * r * 0.5;
  const g = x.createRadialGradient(lx, ly, r * 0.1, cx, cy, r * 1.15); g.addColorStop(0, rgba(base, 1)); g.addColorStop(0.55, rgba(base, 0.55)); g.addColorStop(1, "rgba(0,0,6,.97)"); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  for (let b = 0; b < bands; b++) { const yy = cy - r + (b + 0.5) / bands * r * 2 + Math.sin(t * 0.6 + b) * r * 0.02; x.fillStyle = rgba(glow, 0.08 + 0.1 * rnd(b + 9)); x.fillRect(cx - r, yy - r * 0.05, r * 2, r * (0.04 + 0.06 * rnd(b + 3))); }
  if (lights) { x.globalCompositeOperation = "lighter"; for (let i = 0; i < 90; i++) { const a = rnd(i) * 6.28, d = Math.sqrt(rnd(i + 99)) * r * 0.95, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d; const dark = (px - lx) * (px - lx) + (py - ly) * (py - ly) > r * r * 0.75; if (dark) { x.fillStyle = `rgba(255,220,140,${0.5 + 0.5 * Math.sin(t * 3 + i)})`; x.fillRect(px, py, 1.6, 1.6); } } x.globalCompositeOperation = "source-over"; }
  x.restore();
  x.globalCompositeOperation = "lighter"; const a = x.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.16); a.addColorStop(0, rgba(glow, 0.5)); a.addColorStop(1, rgba(glow, 0)); x.fillStyle = a; x.beginPath(); x.arc(cx, cy, r * 1.16, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
}
function robot(x: Cx, px: number, py: number, s: number, body: string, eye: string, lit = 1, arm = 0) {
  x.save(); x.translate(px, py); x.scale(s, s);
  x.fillStyle = body; x.fillRect(-9, -52, 18, 22); x.fillRect(-14, -30, 28, 30); x.fillRect(-12, 0, 9, 30); x.fillRect(3, 0, 9, 30); x.save(); x.translate(-14, -28); x.rotate(-0.2 - arm * 0.6); x.fillRect(-7, 0, 7, 24); x.restore(); x.save(); x.translate(14, -28); x.rotate(0.2 + arm * 0.5); x.fillRect(0, 0, 7, 24); x.restore();
  x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(-9, -52, 5, 22); x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(eye, 0.15 + 0.85 * lit); x.fillRect(-6, -45, 12, 4); x.fillStyle = rgba(eye, 0.35 * lit); x.beginPath(); x.arc(0, -43, 14, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; x.restore();
}
function ship(x: Cx, px: number, py: number, s: number, ang: number, glow: string) {
  x.save(); x.translate(px, py); x.rotate(ang); x.scale(s, s); x.fillStyle = "#cfd8e4"; x.beginPath(); x.moveTo(30, 0); x.lineTo(-14, -9); x.lineTo(-8, 0); x.lineTo(-14, 9); x.closePath(); x.fill(); x.fillStyle = "#6b7a90"; x.fillRect(-6, -3, 14, 6);
  x.globalCompositeOperation = "lighter"; const g = x.createLinearGradient(-14, 0, -90, 0); g.addColorStop(0, rgba(glow, 0.9)); g.addColorStop(1, rgba(glow, 0)); x.fillStyle = g; x.fillRect(-90, -4, 76, 8); x.globalCompositeOperation = "source-over"; x.restore();
}
function sceneEarth(x: Cx, W: number, H: number, u: number, t: number) {
  space(x, W, H, t, 2, "90,140,255"); const cx = W * (0.66 - u * 0.04), cy = H * 0.7, r = H * 0.62; sphere(x, cx, cy, r, "40,110,200", "110,190,255", -40, 0, true, t);
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); x.fillStyle = "rgba(60,150,80,.7)"; for (let i = 0; i < 7; i++) { x.beginPath(); x.ellipse(cx + (rnd(i) - 0.5) * r * 1.2 + t * 6 % 30, cy + (rnd(i + 5) - 0.5) * r * 1.1, r * (0.1 + rnd(i + 2) * 0.16), r * (0.06 + rnd(i + 8) * 0.1), rnd(i) * 3, 0, 7); x.fill(); } x.restore();
  x.strokeStyle = "rgba(160,220,255,.5)"; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy, r * 1.3, r * 0.28, -0.35, 0, 7); x.stroke(); for (let i = 0; i < 3; i++) { const a = t * 0.5 + i * 2.1; const sx = cx + Math.cos(a) * r * 1.3, sy = cy + Math.sin(a) * r * 0.28; const rx = sx * Math.cos(-0.35) - (sy - cy) * Math.sin(-0.35) * 0; x.fillStyle = "#e8f4ff"; x.fillRect(sx - 3, cy + (sy - cy) - 2 + (sx - cx) * -0.35 * 0.2, 6, 4); void rx; }
}
function sceneFactory(x: Cx, W: number, H: number, u: number, t: number, eye: string) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#05080f"); g.addColorStop(1, "#101a28"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "#0a1220"; for (let i = 0; i < 9; i++) x.fillRect(W * (i / 8) - 8, 0, 16, H * 0.8);
  x.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) { const sx = W * (0.15 + i * 0.23), c = x.createLinearGradient(sx, 0, sx, H); c.addColorStop(0, "rgba(120,200,255,.28)"); c.addColorStop(1, "rgba(120,200,255,0)"); x.fillStyle = c; x.beginPath(); x.moveTo(sx - 6, 0); x.lineTo(sx + 6, 0); x.lineTo(sx + 90, H * 0.9); x.lineTo(sx - 90, H * 0.9); x.closePath(); x.fill(); } x.globalCompositeOperation = "source-over";
  x.fillStyle = "#162338"; x.fillRect(0, H * 0.82, W, H * 0.18); x.fillStyle = "#223a58"; for (let i = 0; i < 30; i++) x.fillRect(((i * 60 - t * 40) % (W + 60) + W + 60) % (W + 60) - 30, H * 0.82, 30, 4);
  const n = 8; for (let i = 0; i < n; i++) { const lit = Math.max(0, Math.min(1, (u * (n + 2) - i))); const px = W * (0.1 + i * 0.11) + (0.5 - u) * 40; robot(x, px, H * 0.8, H / 330, "#2b3a52", eye, lit, Math.sin(t * 3 + i) * 0.3 * (1 - lit)); if (lit > 0 && lit < 1) { x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,220,140,.9)"; for (let k = 0; k < 4; k++) x.fillRect(px + (rnd(i * 7 + k + Math.floor(t * 20)) - 0.5) * 30, H * 0.8 - H * 0.12 + (rnd(k + i + Math.floor(t * 20)) - 0.5) * 30, 2, 2); x.globalCompositeOperation = "source-over"; } }
}
function sceneLaunch(x: Cx, W: number, H: number, u: number, t: number, glow: string) {
  space(x, W, H, t, 14, "120,120,255");
  x.globalCompositeOperation = "lighter"; x.lineWidth = 1.4; for (let i = 0; i < 60; i++) { const y = rnd(i) * H, sp = 400 + rnd(i + 3) * 900, xx = ((rnd(i + 8) * W * 2 - t * sp) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2; x.strokeStyle = `rgba(160,200,255,${0.1 + rnd(i + 7) * 0.4})`; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx + 40 + rnd(i) * 80, y); x.stroke(); } x.globalCompositeOperation = "source-over";
  for (let i = 0; i < 5; i++) { const px = W * (0.15 + i * 0.17 + u * 0.55), py = H * (0.3 + 0.12 * i + Math.sin(t + i) * 0.02); ship(x, px, py, H / 260 * (0.7 + i * 0.12), -0.12, glow); }
  const fl = x.createRadialGradient(W * 0.9, H * 0.12, 0, W * 0.9, H * 0.12, H * 0.5); fl.addColorStop(0, "rgba(255,240,200,.45)"); fl.addColorStop(1, "rgba(255,240,200,0)"); x.globalCompositeOperation = "lighter"; x.fillStyle = fl; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over";
}
function sceneApproach(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  const c = hexRgb(P.c[2]); space(x, W, H, t, 3, P.glow); const r = H * (0.06 + 0.4 * (1 - Math.pow(1 - u, 2))), cx = W * 0.62, cy = H * 0.5;
  sphere(x, cx, cy, r, c, P.glow, -40, P.id === "jovia" ? 14 : P.id === "helios" ? 0 : 0, false, t);
  if (P.id === "helios") { x.globalCompositeOperation = "lighter"; const s = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2); s.addColorStop(0, "rgba(255,240,180,.9)"); s.addColorStop(0.3, "rgba(255,170,60,.4)"); s.addColorStop(1, "rgba(255,120,30,0)"); x.fillStyle = s; x.beginPath(); x.arc(cx, cy, r * 2.2, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; }
  x.setLineDash([6, 8]); x.strokeStyle = rgba(P.acc, 0.7); x.lineWidth = 1.5; x.beginPath(); x.ellipse(cx, cy, r * 1.7, r * 0.5, -0.3, 0, 7); x.stroke(); x.setLineDash([]);
  const a = t * 1.1; ship(x, cx + Math.cos(a) * r * 1.7 * Math.cos(-0.3) - Math.sin(a) * r * 0.5 * Math.sin(-0.3), cy + Math.cos(a) * r * 1.7 * Math.sin(-0.3) + Math.sin(a) * r * 0.5 * Math.cos(-0.3), H / 400, a + 1.6, P.glow);
  x.strokeStyle = rgba(P.acc, 0.8); x.lineWidth = 2; const sw = (t * 0.6 % 1) * r * 2; x.beginPath(); x.moveTo(cx - r, cy - r + sw); x.lineTo(cx + r, cy - r + sw); x.globalAlpha = 0.5; x.stroke(); x.globalAlpha = 1;
}
function sceneSurface(x: Cx, W: number, H: number, u: number, t: number, P: any, type: string, eye: string) {
  const hz = H * 0.62; const g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, P.c[0]); g.addColorStop(0.7, P.c[1]); g.addColorStop(1, P.c[2]); x.fillStyle = g; x.fillRect(0, 0, W, hz);
  for (const s of STARS) if (s.y < 0.5) { x.fillStyle = `rgba(255,255,255,${0.2 * s.z})`; x.fillRect(s.x * W, s.y * H, 1.2, 1.2); }
  const pan = (u - 0.5) * 60;
  if (type === "sun") { const cx = W * 0.6 - pan * 0.4, cy = hz * 0.75; x.globalCompositeOperation = "lighter"; const s = x.createRadialGradient(cx, cy, 0, cx, cy, H * 0.8); s.addColorStop(0, "rgba(255,250,210,1)"); s.addColorStop(0.18, "rgba(255,200,90,.85)"); s.addColorStop(0.5, "rgba(255,120,40,.3)"); s.addColorStop(1, "rgba(255,80,20,0)"); x.fillStyle = s; x.fillRect(0, 0, W, hz + 30); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + t * 0.2, l = H * (0.45 + 0.2 * Math.sin(t * 2 + i)); x.strokeStyle = "rgba(255,220,140,.35)"; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + Math.cos(a) * H * 0.2, cy + Math.sin(a) * H * 0.2); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke(); } x.globalCompositeOperation = "source-over"; }
  if (type === "gas") { sphere(x, W * 0.7 - pan, hz * 0.55, H * 0.55, hexRgb(P.c[2]), P.glow, -30, 16, false, t); }
  x.fillStyle = "rgba(0,0,0,.55)";
  if (type === "jungle") for (let i = 0; i < 9; i++) { const px = ((i / 9 * W * 1.2 + pan * (0.5 + i * 0.05)) % (W * 1.2)), hh = H * (0.12 + rnd(i) * 0.16); x.fillStyle = "#04120f"; x.fillRect(px - 4, hz - hh, 8, hh); x.fillStyle = rgba(P.glow, 0.45 + 0.2 * Math.sin(t * 2 + i)); x.beginPath(); x.ellipse(px, hz - hh, hh * 0.55, hh * 0.22, 0, Math.PI, 0); x.fill(); }
  if (type === "desert") { x.fillStyle = "#1a0d05"; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-50 + i * W / 3 + pan, hz); x.quadraticCurveTo(W / 6 + i * W / 3 + pan, hz - H * 0.18, W / 3 + i * W / 3 + 50 + pan, hz); x.fill(); } for (let i = 0; i < 5; i++) { x.fillStyle = "#2b1608"; x.fillRect(W * (0.1 + i * 0.2) + pan, hz - H * (0.12 + rnd(i) * 0.1), 10, H * 0.25); } }
  if (type === "ice") for (let i = 0; i < 12; i++) { const px = W * (i / 11) + pan * (0.4 + rnd(i)), hh = H * (0.1 + rnd(i + 4) * 0.28); x.fillStyle = rgba(P.glow, 0.5); x.beginPath(); x.moveTo(px - hh * 0.15, hz); x.lineTo(px, hz - hh); x.lineTo(px + hh * 0.15, hz); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(px, hz - hh); x.lineTo(px + hh * 0.15, hz); x.lineTo(px + hh * 0.04, hz); x.fill(); }
  if (type === "lava") { x.fillStyle = "#1a0605"; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(W * (i / 4) - 80 + pan, hz); x.lineTo(W * (i / 4) + pan, hz - H * (0.12 + rnd(i) * 0.2)); x.lineTo(W * (i / 4) + 80 + pan, hz); x.fill(); } x.globalCompositeOperation = "lighter"; x.strokeStyle = "rgba(255,120,40,.9)"; x.lineWidth = 4; x.beginPath(); x.moveTo(0, hz + 10); for (let i = 0; i <= 20; i++) x.lineTo(W * i / 20, hz + 10 + Math.sin(i + t * 2) * 5); x.stroke(); x.globalCompositeOperation = "source-over"; }
  if (type === "wreck") for (let i = 0; i < 14; i++) { const px = W * (i / 13) + pan * 0.5, hh = H * (0.1 + rnd(i) * 0.3); x.fillStyle = "#0b0716"; x.fillRect(px - 16, hz - hh, 32, hh); x.fillRect(px - 5, hz - hh - 12, 10, 12 + rnd(i + 3) * 18); x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(P.glow, 0.5 * (0.5 + 0.5 * Math.sin(t * 5 + i * 3))); x.fillRect(px - 8, hz - hh + 10, 4, 3); x.globalCompositeOperation = "source-over"; }
  if (type === "belt") { for (let i = 0; i < 16; i++) { const px = ((rnd(i) * W * 1.3 - t * (8 + rnd(i + 3) * 20) + pan) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, py = H * (0.1 + rnd(i + 6) * 0.55), rr = H * (0.02 + rnd(i + 9) * 0.07); x.fillStyle = "#1c2a3c"; x.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + t * 0.3, d = rr * (0.8 + rnd(k + i) * 0.4); k ? x.lineTo(px + Math.cos(a) * d, py + Math.sin(a) * d) : x.moveTo(px + Math.cos(a) * d, py + Math.sin(a) * d); } x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(P.glow, 0.5 + 0.5 * Math.sin(t * 4 + i)); x.fillRect(px + rr * 0.2, py - rr * 0.1, 3, 3); x.globalCompositeOperation = "source-over"; } }
  if (type === "strike") { for (let i = 0; i < 6; i++) { const px = W * (0.1 + i * 0.16); x.fillStyle = "#0b0b08"; x.fillRect(px - 20, hz - 22, 40, 22); x.fillRect(px - 5, hz - 44, 10, 22); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,90,60,.9)"; x.fillRect(px - 2, hz - 40, 4, 4); x.globalCompositeOperation = "source-over"; }
    for (let i = 0; i < 3; i++) { const k = Math.max(0, Math.min(1, (u - 0.1 * i) * 1.3)), px = W * (0.22 + i * 0.28), py = -20 + k * (hz + 10); x.globalCompositeOperation = "lighter"; const tr = x.createLinearGradient(px, py - 140, px, py); tr.addColorStop(0, "rgba(255,160,60,0)"); tr.addColorStop(1, "rgba(255,200,100,.9)"); x.fillStyle = tr; x.fillRect(px - 3, py - 140, 6, 140); x.globalCompositeOperation = "source-over"; x.fillStyle = "#e8edf3"; x.fillRect(px - 5, py - 4, 10, 16);
      if (k >= 1) { const bt = (u - 0.1 * i - 0.77) * 2; if (bt > 0 && bt < 1) { x.globalCompositeOperation = "lighter"; const b = x.createRadialGradient(px, hz, 0, px, hz, H * 0.5 * bt); b.addColorStop(0, "rgba(255,255,255,.95)"); b.addColorStop(0.3, "rgba(255,190,70,.7)"); b.addColorStop(1, "rgba(255,70,20,0)"); x.fillStyle = b; x.fillRect(0, 0, W, hz + 40); x.globalCompositeOperation = "source-over"; } } } }
  x.fillStyle = "#04060a"; x.fillRect(0, hz, W, H - hz); const gg = x.createLinearGradient(0, hz, 0, hz + 18); gg.addColorStop(0, rgba(P.glow, 0.35)); gg.addColorStop(1, rgba(P.glow, 0)); x.fillStyle = gg; x.fillRect(0, hz, W, 18);
  for (let i = 0; i < 5; i++) { const ex = W * (0.45 + i * 0.1) + Math.sin(t * 0.7 + i) * 8, on = Math.sin(t * 1.3 + i * 2) > -0.4; if (on) { x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(P.acc, 0.9); x.fillRect(ex, hz - 6 - rnd(i) * 20, 3, 3); x.fillRect(ex + 7, hz - 6 - rnd(i) * 20, 3, 3); x.globalCompositeOperation = "source-over"; } }
  robot(x, W * 0.14 - pan, hz + H * 0.07, H / 300, "#0a1320", eye, 1, 0.2); x.globalCompositeOperation = "lighter"; for (let i = 0; i < 24; i++) { const a = ((rnd(i) * W - t * (20 + rnd(i + 3) * 40)) % W + W) % W; x.fillStyle = rgba(P.glow, 0.25); x.fillRect(a, hz * (0.3 + rnd(i + 5) * 0.9), 2, 2); } x.globalCompositeOperation = "source-over";
}
function sceneBoss(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  const g = x.createRadialGradient(W / 2, H * 0.5, H * 0.1, W / 2, H * 0.5, H); g.addColorStop(0, "#3a0a10"); g.addColorStop(1, "#050205"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.52, s = H * (0.34 + u * 0.06); x.fillStyle = "#08040a"; x.beginPath(); x.moveTo(cx - s * 1.3, cy + s * 0.9); x.quadraticCurveTo(cx - s * 1.2, cy - s * 0.9, cx, cy - s * 0.95); x.quadraticCurveTo(cx + s * 1.2, cy - s * 0.9, cx + s * 1.3, cy + s * 0.9); x.closePath(); x.fill();
  x.fillStyle = "#12060c"; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(cx - s * 1.0 + i * s * 0.33, cy - s * 0.7); x.lineTo(cx - s * 0.9 + i * s * 0.33, cy - s * (1.25 + 0.2 * Math.abs(3 - i) * -1 + 0.25)); x.lineTo(cx - s * 0.75 + i * s * 0.33, cy - s * 0.7); x.fill(); }
  const p = 0.6 + 0.4 * Math.sin(t * 6); x.globalCompositeOperation = "lighter"; const e = x.createRadialGradient(cx, cy - s * 0.1, 0, cx, cy - s * 0.1, s * 0.5); e.addColorStop(0, "rgba(255,255,255,.95)"); e.addColorStop(0.2, rgba("255,60,80", 0.9 * p)); e.addColorStop(1, "rgba(255,40,60,0)"); x.fillStyle = e; x.beginPath(); x.arc(cx, cy - s * 0.1, s * 0.5, 0, 7); x.fill();
  x.fillStyle = rgba(P.glow, 0.5); x.fillRect(cx - s * 0.7, cy + s * 0.25, s * 1.4, s * 0.05); x.globalCompositeOperation = "source-over";
  if (Math.sin(t * 7) > 0) { x.fillStyle = "rgba(255,40,60,.12)"; x.fillRect(0, 0, W, H); } x.fillStyle = "rgba(255,70,90,.95)"; x.font = `900 ${Math.round(H * 0.07)}px system-ui,sans-serif`; x.textAlign = "center"; if (Math.sin(t * 7) > -0.3) x.fillText("⚠ WARNING ⚠", W / 2, H * 0.14);
}
function sceneObjective(x: Cx, W: number, H: number, t: number, P: any) {
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#04060e"); g.addColorStop(1, P.c[0]); x.fillStyle = g; x.fillRect(0, 0, W, H); space(x, W, H, t, 1, P.glow);
  x.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) { const r = H * (0.25 + ((t * 0.25 + i * 0.25) % 1) * 0.6); x.strokeStyle = rgba(P.glow, 0.35 * (1 - ((t * 0.25 + i * 0.25) % 1))); x.lineWidth = 2; x.beginPath(); x.arc(W * 0.27, H * 0.55, r, 0, 7); x.stroke(); } x.globalCompositeOperation = "source-over";
}

export const AdventureCine = memo(function AdventureCine({ P, lang, me, colorway, onDone }: any) {
  const plan = useRef(cinePlan(P)).current; const starts = useRef((() => { let a = 0; return plan.map(s => { const v = a; a += s.dur; return v; }); })()).current;
  const cvRef = useRef<HTMLCanvasElement>(null); const [idx, setIdx] = useState(0); const idxRef = useRef(0); const t0 = useRef(performance.now()); const skipTo = useRef(0);
  const type = TYPE[P.id] || "jungle"; const eye = hexRgb(colorway && colorway.glow ? colorway.glow : "#7fe8ff"); const objIdx = plan.length - 1;
  const t = (th: string, en: string, zh: string) => T3(lang, th, en, zh);
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return undefined; const x = cv.getContext("2d"); if (!x) return undefined; let raf = 0;
    const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(1.5, window.devicePixelRatio || 1); cv.width = Math.max(320, Math.round(r.width * d)); cv.height = Math.max(180, Math.round(r.height * d)); }; fit(); window.addEventListener("resize", fit);
    const audio = createCineAudio(P.id, plan);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); const el = (now - t0.current) / 1000 + skipTo.current; let i = 0; for (let k = 0; k < plan.length; k++) if (el >= starts[k]) i = k;
      if (i !== idxRef.current) { idxRef.current = i; setIdx(i); }
      const W = cv.width, H = cv.height, s = plan[i], local = el - starts[i], u = Math.min(1, local / Math.max(0.1, s.dur));
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
      x.save(); const zoom = 1 + 0.07 * u; x.translate(W / 2, H / 2); x.scale(zoom, zoom); x.translate(-W / 2, -H / 2);
      switch (s.kind) {
        case "earth": sceneEarth(x, W, H, u, local); break; case "factory": sceneFactory(x, W, H, u, local, eye); break; case "launch": sceneLaunch(x, W, H, u, local, P.glow); break;
        case "approach": sceneApproach(x, W, H, u, local, P); break; case "boss": sceneBoss(x, W, H, u, local, P); break; case "objective": sceneObjective(x, W, H, local, P); break;
        default: sceneSurface(x, W, H, u, local, P, type, eye);
      }
      x.restore();
      const v = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
      x.fillStyle = "rgba(255,255,255,.035)"; for (let k = 0; k < 90; k++) x.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);   // film grain
      const bar = H * 0.11; x.fillStyle = "#000"; x.fillRect(0, 0, W, bar); x.fillRect(0, H - bar, W, bar);
      const fade = Math.max(0, 1 - local / 0.4, Math.min(1, (local - (s.dur - 0.3)) / 0.3) * (s.kind === "objective" ? 0 : 1)); if (fade > 0) { x.fillStyle = `rgba(0,0,0,${fade})`; x.fillRect(0, 0, W, H); }
    };
    raf = requestAnimationFrame(frame);
    (window as any).__advCine = { shot: () => idxRef.current, kinds: () => plan.map(s => s.kind), render: (id: string, mission: string, boss: boolean) => renderCinePreview(id, cinePlan({ id, mission, boss: boss ? ["x", "x", "x"] : ["-", "-", "-"] })), jump: (i: number) => { skipTo.current = starts[i] - (performance.now() - t0.current) / 1000 + 0.05; }, total: starts[objIdx] };
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); if (audio) audio.stop(); try { delete (window as any).__advCine; } catch (e) {} };
  }, []);
  const kind = plan[idx].kind, cap = captionFor(P, kind, lang), goals = GOAL[P.id] || GOAL.luma;
  const next = () => { if (idxRef.current < objIdx) skipTo.current = starts[idxRef.current + 1] - (performance.now() - t0.current) / 1000 + 0.05; };
  return (
    <div className="adv-cine" onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; next(); }}>
      <canvas ref={cvRef} />
      <button className="ac-skip" onClick={() => onDone()} aria-label="skip">{t("ข้าม ⏭", "Skip ⏭", "跳过 ⏭")}</button>
      {kind === "approach" && <div key="ttl" className="ac-title"><small>{t("ปลายทาง", "DESTINATION", "目的地")}</small><b>{T3(lang, P.th, P.en, P.zh).split(" · ")[0]}</b></div>}
      {cap && kind !== "objective" && <div key={"c" + idx} className="ac-cap">{cap}</div>}
      {kind === "objective" && (
        <div className="ac-obj">
          <div className="ac-hero"><CyberAvatar model={me} yaw={22} pose="ready" glow={colorway && colorway.glow} accent={colorway && colorway.accent} held={null} hat={null} acc={null} /></div>
          <div className="ac-goal"><small>{t("ภารกิจ", "MISSION", "任务")}</small><b>{T3(lang, P.th, P.en, P.zh).split(" · ")[0]}</b>
            <ul>{goals.map((g, i) => <li key={i} style={{ animationDelay: 0.25 * i + "s" }}>{T3(lang, g[0], g[1], g[2])}</li>)}</ul>
            <button className="adv-btn go" autoFocus onClick={() => onDone()}>▶ {t("เริ่มภารกิจ", "START MISSION", "开始任务")}</button></div>
        </div>)}
    </div>
  );
});
export { renderCinePreview };
export default AdventureCine;
