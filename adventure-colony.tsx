/* Adventure: the Colony Builder (owner, 2026-10-13: "a SimCity-style level where you build a colony on the Moon, on Saturn's moon, on Mars or on a planet
   of another star such as Proxima Centauri, with farming to feed it, and, online, many careers").
   Four sites share this one management game (`P.kind`: moon, mars, titan, proxima). A grid of 8 x 6 plots, ten kinds of building, six resources that run
   every second, colonists who need oxygen, water, food and power and who only move in when there is a free home, research that unlocks better buildings,
   a hazard that belongs to the site (night, dust storm, cold, flare), and a career the player picks (it tilts the numbers, and in an online room each pilot
   will hold one). Win = the colony reaches its population target while every need is still met. DOM only, no downloads, no coins (crystals + EXP). */
import { finishLook } from "./cg-finish";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";
import { drawBuilding, drawTube, drawSkyline, groundFill, PALS } from "./adventure-colony-art";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
type L3 = [string, string, string];
<<<<<<< HEAD
// owner, 2026-10-15: "SimCity BuildIt has 5 speed levels" — same slow(0)/normal(1)/fast(2) as before (index 1 stays the
// default), with faster(3) and max(4) added on top so a returning player can blow through a day they have already won.
const SPEEDS = [0.5, 1, 2, 3, 5];   // slow, normal, fast, faster, max (index into this)
const SPEED_ICON = ["🐢", "▶", "⏩", "⏭", "⚡"];
const COLS = 10, ROWS = 8, CELLS = COLS * ROWS, DAY = 2;   // a "day" is 2 seconds of play
=======
const SPEEDS = [0.5, 1, 2];   // slow, normal, fast (index into this)
const COLS = 22, ROWS = 18, CELLS = COLS * ROWS, DAY = 2;   // a "day" is 2 seconds of play
>>>>>>> origin/claude/upbeat-fermi-dey70w

type Site = { icon: string; target: number; sun: number; water: number; ore: number; cold: number; hazard: string; name: L3; note: L3; hz: L3 };
export const SITES: Record<string, Site> = {
  moon:    { icon: "🌑", target: 40,  sun: 1.0, water: 0.6, ore: 1.2, cold: 1.0, hazard: "night", name: ["ดวงจันทร์ของโลก", "Earth's Moon", "地球的月球"], note: ["แสงแดดดี แต่น้ำน้อยมาก และกลางคืนยาวสองสัปดาห์", "Plenty of sun, very little water, and a night two weeks long", "阳光充足，但水极少，而且长夜持续两周"], hz: ["กลางคืนบนดวงจันทร์ — แผงโซลาร์แทบไม่ได้พลังงาน", "Lunar night — solar panels give almost nothing", "月夜——太阳能板几乎发不了电"] },
  mars:    { icon: "🔴", target: 60,  sun: 0.6, water: 1.0, ore: 1.0, cold: 1.2, hazard: "dust", name: ["ดาวอังคาร", "Mars", "火星"], note: ["แดดอ่อนกว่าโลก มีน้ำแข็งใต้ดิน และพายุฝุ่นบังแสง", "Weak sun, ice underground, and dust storms that hide it", "阳光较弱，地下有冰，沙尘暴会遮蔽阳光"], hz: ["พายุฝุ่น — แผงโซลาร์ถูกบัง", "Dust storm — the panels are buried in dust", "沙尘暴——太阳能板被尘埃覆盖"] },
  titan:   { icon: "🪐", target: 80,  sun: 0.15, water: 1.7, ore: 0.8, cold: 1.6, hazard: "cold", name: ["ไททัน ดวงจันทร์ของดาวเสาร์", "Titan, moon of Saturn", "土卫六（泰坦）"], note: ["แสงแดดเกือบไม่มี หนาวจัด แต่มีน้ำแข็งและมีเทนมหาศาล", "Almost no sun and bitter cold, but ice and methane everywhere", "几乎没有阳光且极寒，但冰和甲烷遍地"], hz: ["ความหนาวจัดเข้าครอบงำ — ใช้พลังงานทำความร้อนเพิ่ม", "A deep freeze — heating eats extra power", "严寒来袭——取暖额外耗电"] },
  proxima: { icon: "⭐", target: 110, sun: 1.4, water: 1.0, ore: 1.7, cold: 1.0, hazard: "flare", name: ["พร็อกซิมา เซนทอรี b", "Proxima Centauri b", "比邻星 b"], note: ["แร่ล้ำค่า แดดแรง แต่ดาวแม่ปล่อยแฟลร์ใส่ทุกเมื่อ", "Rich ore and strong light, but the red dwarf keeps flaring", "矿藏丰富、光照强，但这颗红矮星不断耀发"], hz: ["แฟลร์จากดาวแม่ — ไฟดับและออกซิเจนรั่ว", "A stellar flare — power drops and oxygen leaks", "恒星耀发——电力下降，氧气泄漏"] },
};

type B = { id: string; icon: string; name: L3; cost: number; needSci?: number; text: L3; cat: string };
// owner, 2026-10-15: "make the UI more like SimCity BuildIt but easier to understand" — SimCity BuildIt's bottom build
// tray is grouped by category (Residential / Industry / ...), not one long flat row; CATS below mirrors that, each
// category its own short, scannable strip instead of all 17 buildings in one overwhelming line.
const CATS: { id: string; icon: string; label: L3 }[] = [
  { id: "home", icon: "🏠", label: ["ที่อยู่อาศัย", "Homes", "住房"] },
  { id: "power", icon: "⚡", label: ["พลังงาน", "Power", "能源"] },
  { id: "life", icon: "💧", label: ["น้ำและอากาศ", "Water & air", "水与空气"] },
  { id: "food", icon: "🌽", label: ["อาหาร", "Food", "食物"] },
  { id: "make", icon: "🧱", label: ["วัสดุและการค้า", "Materials & trade", "建材与贸易"] },
  { id: "special", icon: "🔬", label: ["วิจัยและป้องกัน", "Research & defense", "研究与防御"] },
];
const BUILD: B[] = [
  { id: "hab", icon: "🏠", name: ["ที่พักอาศัย", "Habitat", "居住舱"], cost: 40, text: ["รองรับ 6 คน", "Houses 6 people", "可住 6 人"], cat: "home" },
  { id: "park", icon: "🌳", name: ["สวนสาธารณะ", "Park", "公园"], cost: 50, text: ["คนอยู่สบาย ครอบครัวเพิ่มเร็วขึ้น", "Happier colonists, faster growth", "居民更舒心，人口增长更快"], cat: "home" },
  { id: "med", icon: "🏥", name: ["โรงพยาบาล", "Clinic", "医院"], cost: 70, needSci: 10, text: ["คนเพิ่มเร็วขึ้น และไม่มีใครล้มป่วยตอนขาดแคลน", "Faster growth, fewer losses in a shortage", "人口增长更快，短缺时损失更少"], cat: "home" },
  { id: "solar", icon: "☀", name: ["แผงโซลาร์", "Solar farm", "太阳能场"], cost: 30, text: ["ผลิตไฟตามแสงของดาวนั้น", "Power from the local sun", "按当地光照发电"], cat: "power" },
  { id: "geo", icon: "🌋", name: ["โรงไฟฟ้าความร้อนใต้ดิน", "Geothermal plant", "地热电站"], cost: 65, needSci: 8, text: ["ไฟคงที่จากความร้อนใต้ผิวดาว", "Steady power from the crust", "来自地壳的稳定电力"], cat: "power" },
  { id: "reactor", icon: "⚛", name: ["เครื่องปฏิกรณ์ฟิวชัน", "Fusion reactor", "聚变反应堆"], cost: 90, needSci: 25, text: ["ไฟฟ้าแรงและคงที่ ไม่ขึ้นกับแสงแดด", "Strong, steady power, no sun needed", "强大稳定的电力，不依赖阳光"], cat: "power" },
  { id: "water", icon: "💧", name: ["เครื่องสกัดน้ำ", "Ice extractor", "冰水提取器"], cost: 35, text: ["สกัดน้ำจากน้ำแข็ง (บนช่องน้ำแข็งได้สองเท่า)", "Water from ice (double on an ice plot)", "从冰中取水（冰地翻倍）"], cat: "life" },
  { id: "oxy", icon: "🫧", name: ["เครื่องผลิตออกซิเจน", "Oxygen plant", "制氧厂"], cost: 35, text: ["แยกน้ำเป็นออกซิเจน", "Splits water into oxygen", "电解水制氧"], cat: "life" },
  { id: "recycler", icon: "♻", name: ["โรงรีไซเคิล", "Recycler", "回收厂"], cost: 55, needSci: 5, text: ["เอาน้ำและออกซิเจนกลับมาใช้ใหม่", "Gives water and oxygen back", "回收水和氧气"], cat: "life" },
  { id: "farm", icon: "🌱", name: ["ฟาร์มในโดม", "Dome farm", "穹顶农场"], cost: 45, text: ["อาหาร + ออกซิเจนเล็กน้อย", "Food and a little oxygen", "产出食物和少量氧气"], cat: "food" },
  { id: "tower", icon: "🏙", name: ["ฟาร์มแนวตั้ง", "Vertical farm", "垂直农场"], cost: 80, needSci: 12, text: ["อาหารมาก ใช้น้ำและไฟสูง", "Lots of food, thirsty and power-hungry", "产粮多，耗水耗电"], cat: "food" },
  { id: "mine", icon: "⛏", name: ["เหมือง", "Mine", "矿场"], cost: 40, text: ["ได้วัสดุก่อสร้าง (ช่องแร่ได้สองเท่า)", "Building materials (double on an ore plot)", "产出建材（矿地翻倍）"], cat: "make" },
  { id: "market", icon: "🏪", name: ["ตลาดแลกเปลี่ยน", "Trade market", "贸易市场"], cost: 75, needSci: 10, text: ["แลกวัสดุก่อสร้างกับยานเสบียง", "Trades for building materials", "与补给船交易建材"], cat: "make" },
  { id: "lab", icon: "🔬", name: ["ห้องวิจัย", "Research lab", "研究所"], cost: 60, text: ["ได้แต้มวิจัย ไว้ปลดล็อกเทคโนโลยี", "Research points for new tech", "产出研究点数以解锁科技"], cat: "special" },
  { id: "school", icon: "🎓", name: ["โรงเรียน", "School", "学校"], cost: 60, needSci: 5, text: ["ได้แต้มวิจัยเพิ่ม ใช้ไฟน้อย", "Extra research for little power", "少量耗电，增加研究点数"], cat: "special" },
  { id: "shield", icon: "🛡", name: ["โดมป้องกัน", "Shield dome", "防护穹顶"], cost: 85, needSci: 20, text: ["ลดผลกระทบของภัยพิบัติทั้งเมือง", "Softens every hazard for the whole city", "减轻全城灾害影响"], cat: "special" },
  { id: "port", icon: "🚀", name: ["ท่าอวกาศ", "Spaceport", "太空港"], cost: 100, needSci: 15, text: ["ทุก 20 วินาทีมียานนำผู้อพยพและวัสดุมาส่ง", "Every 20 s a ship brings settlers and materials", "每 20 秒运来移民和建材"], cat: "special" },
];
export const CAREERS: { id: string; icon: string; name: L3; text: L3 }[] = [
  { id: "inno", icon: "💡", name: ["นวัตกร", "Innovator", "创新者"], text: ["ห้องวิจัยได้แต้มสองเท่า เทคโนโลยีถูกลง 25%", "Labs make double research and tech costs 25% less", "研究所产出翻倍，科技便宜 25%"] },
  { id: "eng", icon: "🛠", name: ["วิศวกรสร้างอาณานิคม", "Colony engineer", "殖民地工程师"], text: ["ก่อสร้างถูกลง 20% แผงโซลาร์แรงขึ้น 15%", "Buildings cost 20% less, solar +15%", "建造便宜 20%，太阳能 +15%"] },
  { id: "farm", icon: "🧑‍🌾", name: ["เกษตรกรอวกาศ (ปลูกและเลี้ยงสัตว์)", "Space farmer (crops and livestock)", "太空农夫（种植与养殖）"], text: ["ฟาร์มได้อาหารมากขึ้น 35% และคนเพิ่มเร็วขึ้น", "Farms make 35% more food and the colony grows faster", "农场产量 +35%，人口增长更快"] },
  { id: "miner", icon: "⛏", name: ["นักขุดเมืองแร่", "Miner of the ore cities", "矿城矿工"], text: ["เหมืองได้วัสดุมากขึ้น 35%", "Mines make 35% more material", "矿场产量 +35%"] },
  { id: "ship", icon: "🚀", name: ["ผู้สร้างยานอวกาศ", "Starship builder", "星舰建造师"], text: ["ท่าอวกาศมียานมาเร็วขึ้นและนำผู้อพยพมากขึ้น งานก่อสร้างเร็วขึ้น 40%", "Spaceports ship sooner with more settlers; construction 40% faster", "太空港来船更快、移民更多；建造快 40%"] },
];
const RES = [
  { k: "en", icon: "⚡", name: ["พลังงาน", "Power", "电力"] },
  { k: "wa", icon: "💧", name: ["น้ำ", "Water", "水"] },
  { k: "ox", icon: "🫧", name: ["ออกซิเจน", "Oxygen", "氧气"] },
  { k: "fo", icon: "🌽", name: ["อาหาร", "Food", "食物"] },
  { k: "ma", icon: "🧱", name: ["วัสดุ", "Materials", "建材"] },
  { k: "sc", icon: "🔬", name: ["วิจัย", "Research", "研究"] },
] as const;
const TECH: { id: string; cost: number; name: L3; text: L3 }[] = [
  { id: "recycle", cost: 30, name: ["รีไซเคิลน้ำ", "Water recycling", "水循环"], text: ["ใช้น้ำน้อยลง 30%", "30% less water used", "耗水减少 30%"] },
  { id: "hydro", cost: 45, name: ["ไฮโดรโปนิกส์รุ่นสอง", "Hydroponics II", "水培二代"], text: ["ฟาร์มได้อาหาร +30%", "Farms +30% food", "农场 +30%"] },
  { id: "panel", cost: 60, name: ["เซลล์แสงอาทิตย์ประสิทธิภาพสูง", "High-efficiency cells", "高效太阳能电池"], text: ["แผงโซลาร์ +40%", "Solar +40%", "太阳能 +40%"] },
];
const FACTS: L3[] = [
  ["ดวงจันทร์ไม่มีบรรยากาศ ที่พักต้องมีผนังหนาป้องกันรังสีและอุกกาบาตเล็ก", "The Moon has no air, so habitats need thick walls against radiation and micrometeorites.", "月球没有大气，居住舱需要厚墙抵御辐射和微陨石。"],
  ["น้ำแข็งที่ขั้วดวงจันทร์และใต้ดินดาวอังคารแยกเป็นน้ำดื่มและออกซิเจนได้", "Ice at the lunar poles and under Mars can be turned into drinking water and oxygen.", "月球两极和火星地下的冰可以变成饮用水和氧气。"],
  ["ไททันมีทะเลสาบมีเทนเหลว และมีบรรยากาศหนากว่าโลก แต่หนาวราว −180 องศา", "Titan has lakes of liquid methane and an air thicker than Earth's, at about −180 °C.", "土卫六有液态甲烷湖，大气比地球还厚，但气温约 −180 °C。"],
  ["พร็อกซิมา b อยู่ห่างโลก 4.2 ปีแสง ดาวแม่เป็นดาวแคระแดงที่ปล่อยแฟลร์รุนแรง", "Proxima b is 4.2 light-years away, orbiting a red dwarf that flares violently.", "比邻星 b 距地球 4.2 光年，绕着一颗常发生强烈耀发的红矮星运行。"],
  ["เมืองที่ดีไม่ได้มีแค่ที่พัก ต้องสมดุลทั้งไฟ น้ำ อากาศ และอาหารไปพร้อมกัน", "A good city is not just homes: power, water, air and food have to grow together.", "好城市不只是住房：电、水、空气和食物必须一起增长。"],
];
const HZ_DUR = 14;

/* ── a SimCity-style interface (owner, 2026-10-15: "make the colony level more complete like SimCity, with a UI more like SimCity") ──
   A title bar with the date, funds and a mayor's approval; a toolbox on the left in groups (like SimCity's Residential / Power / Water / ... buttons) with a query
   tool and a bulldozer; the city in the middle; on the right a minimap, the three demand bars (homes, work, services: the RCI bars), the resources and an advisor;
   a newspaper ticker along the bottom that reports what happens in the colony; and a budget window with a population graph. None of it changes the rules. */
const GROUPS: { id: string; icon: string; name: L3; ids: string[] }[] = [
  { id: "res", icon: "🏠", name: ["ที่พัก", "Residential", "居住"], ids: ["hab", "tower"] },
  { id: "pow", icon: "⚡", name: ["พลังงาน", "Power", "能源"], ids: ["solar", "geo", "reactor"] },
  { id: "wat", icon: "💧", name: ["น้ำและอากาศ", "Water & air", "水与空气"], ids: ["water", "oxy", "recycler"] },
  { id: "food", icon: "🌱", name: ["อาหาร", "Food", "食物"], ids: ["farm"] },
  { id: "ind", icon: "⛏", name: ["อุตสาหกรรม", "Industry", "工业"], ids: ["mine", "market"] },
  { id: "svc", icon: "🏥", name: ["บริการ", "Services", "服务"], ids: ["med", "school", "park", "lab", "shield"] },
  { id: "tra", icon: "🚀", name: ["ขนส่ง", "Transport", "交通"], ids: ["port"] },
];
const MINI: Record<string, string> = { hab: "#4dd0ff", tower: "#4dd0ff", solar: "#ffd34d", geo: "#ffb04d", reactor: "#ffe94d", water: "#4da3ff", oxy: "#9dd8ff", recycler: "#7ee0d0", farm: "#6fe36f", mine: "#d98a4d", market: "#d9a04d", med: "#ffffff", school: "#ffe9a0", park: "#52d66b", lab: "#b66bff", shield: "#7b9bff", port: "#ff6bcb" };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** the three demand bars (homes / work / services), 0..1 each, from what the colony is short of; and the mayor's approval, 5..99 */
function demandOf(S: any, homes: number) {
  const n = (id: string) => S.grid.filter((c: any) => c.b === id).length, low = ["en", "wa", "ox", "fo"].filter(k => S.stock[k] < 20).length;
  const H = clamp01(S.pop > 0 ? (S.pop + 4 - homes) / 12 + 0.25 : 0.6) * (low ? 0.4 : 1), W = clamp01(low / 3 + (S.rate.en < 0 ? 0.35 : 0) + (S.stock.ma < 60 ? 0.2 : 0));
  const svc = n("med") + n("school") + n("park") + n("shield"), Sv = clamp01((S.pop / 10 - svc) / 4 + 0.1);
  let ap = 62 - 14 * ["en", "wa", "ox", "fo"].filter(k => S.stock[k] <= 0.5).length - (S.hz > 0 ? 8 : 0) + Math.min(18, svc * 4) + (S.hist.length > 3 && S.pop > S.hist[Math.max(0, S.hist.length - 4)].pop ? 8 : 0) - (low ? 6 : 0);
  return { H, W, Sv, ap: Math.max(5, Math.min(99, Math.round(ap))) };
}
const NEWS: Record<string, L3> = {
  start: ["ข่าวด่วน: ผู้บุกเบิกกลุ่มแรกลงจอด ผังเมืองยังว่างเปล่า", "Breaking: the first settlers land and the plan of the city is still blank", "快讯：第一批移民登陆，城市蓝图仍是一片空白"],
  short: ["ประกาศ: ทรัพยากรขาดแคลน ประชาชนเริ่มไม่พอใจ", "Alert: a shortage hits the colony and people grow uneasy", "警报：资源短缺，居民开始不安"],
  ok: ["ข่าวดี: วิกฤตผ่านไปแล้ว เมืองกลับมาเป็นปกติ", "Good news: the crisis is over and the city is back to normal", "好消息：危机过去，城市恢复正常"],
  hz: ["ภัยพิบัติ! ผู้คนหลบเข้าที่กำบัง ทีมซ่อมเตรียมพร้อม", "Disaster! People take cover while repair crews stand by", "灾害来袭！居民进入避难所，维修队待命"],
  hzend: ["เหตุการณ์ผ่านไป ความเสียหายไม่รุนแรงเพราะการเตรียมตัวที่ดี", "It passes; good preparation kept the damage low", "灾害过去，充分准备让损失降到最低"],
  era1: ["เมืองก้าวสู่ยุค 2500: ตึกเรียวสูง วงแหวนโฮโลแกรม และเส้นทางลอยฟ้า", "The city enters 2500: tapered towers, holo rings and sky-lanes", "城市进入2500年：锥形高塔、全息环与空中航道"],
  era2: ["ยุค 3000 มาถึง: เมืองลอยฟ้าเปล่งแสง ผลึกคริสตัลสูงเสียดฟ้า", "3000 arrives: floating spires of crystal glow above the streets", "3000年降临：漂浮的水晶尖塔照亮街道"],
  tech: ["ห้องวิจัยประกาศผลสำเร็จ: เทคโนโลยีใหม่พร้อมใช้งานทั่วเมือง", "The labs announce a breakthrough: a new technology is online across the city", "研究所宣布突破：新技术已在全城启用"],
  boom: ["ประชากรเพิ่มขึ้นอย่างรวดเร็ว ความต้องการที่พักพุ่งสูง", "The population is booming and demand for homes soars", "人口激增，住房需求飙升"],
  port: ["ยานผู้อพยพจากโลกลงจอดที่ท่าอวกาศ", "A ship of settlers from Earth docks at the spaceport", "载着地球移民的飞船在太空港降落"],
  half: ["เมืองเติบโตถึงครึ่งทางของเป้าหมาย นายกฯ ได้รับเสียงชื่นชม", "Halfway to the goal: the mayor is praised in the streets", "城市成长过半，市长广受赞誉"],
};



/* ── the city, drawn as an isometric cyberpunk skyline (owner, 2026-10-13: "more like SimCity but cyberpunk and space-age, from the year 2100 to 2500 to 3000, the technology must be advanced") ──
   Three eras of the same colony: 2100 (boxy neon towers and antennas), 2500 (tapered towers, holo rings and sky-lanes), 3000 (floating crystal spires, light beams and hover discs).
   The era follows the colony: its people, its research and what it has built. Everything is drawn from code on one canvas, so a plot is a diamond and a building is a stack of faces. */
const ERAS = [{ y: 2100, n: ["นีโอฮาบิแทต", "Neo-Habitat", "新栖息地"] }, { y: 2500, n: ["เมกะโพลิสลอยฟ้า", "Sky Megapolis", "空中巨都"] }, { y: 3000, n: ["นครคริสตัลแห่งดวงดาว", "Star Crystal Metropolis", "星际水晶都市"] }] as { y: number; n: L3 }[];
const eraOf = (S: any) => { const labs = S.grid.filter((c: any) => c.b === "lab").length, techs = S.tech.filter(Boolean).length, m = S.pop + 12 * techs + 4 * labs; return m >= 55 ? 2 : m >= 22 ? 1 : 0; };
const BCOL: Record<string, string> = { hab: "0,230,255", solar: "90,140,255", water: "70,190,255", oxy: "120,255,190", farm: "130,255,110", mine: "255,170,60", lab: "190,110,255", med: "255,255,255", reactor: "0,255,230", port: "255,90,200", park: "90,255,120", school: "255,225,110", recycler: "110,255,240", market: "255,150,110", geo: "255,120,60", tower: "170,255,140", shield: "120,170,255" };
const BH: Record<string, number> = { hab: 1.5, solar: 0.25, water: 0.7, oxy: 0.9, farm: 0.6, mine: 1.0, lab: 1.6, med: 1.1, reactor: 1.4, port: 0.4, park: 0.35, school: 1.1, recycler: 0.8, market: 0.9, geo: 0.7, tower: 1.9, shield: 1.2 };
const SKY: Record<string, string[]> = { moon: ["#02030a", "#101626", "#2a3250"], mars: ["#1a0a06", "#4a1c10", "#a0522d"], titan: ["#1a1004", "#4a3210", "#a0762a"], proxima: ["#14020a", "#4a0c20", "#a01a3a"] };
const TW0 = 72;   // the width of one plot in world pixels
const WORLD = { x0: ROWS * TW0 / 2, y0: TW0 * 1.5, w: (COLS + ROWS) * TW0 / 2, h: (COLS + ROWS) * TW0 / 4 + TW0 * 2.1 };
const ptW = (c: number, r: number) => [WORLD.x0 + (c - r) * TW0 / 2, WORLD.y0 + (c + r) * TW0 / 4];
function drawCity(x: CanvasRenderingContext2D, W: number, H: number, S: any, kind: string, cam: { x: number; y: number; z: number }, T: number, era: number) {
  const sk = SKY[kind] || SKY.moon, pal = PALS[kind] || PALS.moon;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sk[0]); g.addColorStop(0.55, sk[1]); g.addColorStop(1, sk[2]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const a = (i * 97) % 100 / 100, b = (i * 53) % 40 / 100; x.fillStyle = "rgba(255,255,255," + (0.25 + 0.35 * Math.abs(Math.sin(T * 0.7 + i))) + ")"; x.fillRect(a * W, b * H, 1.4, 1.4); }
  const sunx = W * (kind === "proxima" ? 0.82 : 0.14), suny = H * 0.2, sr = kind === "proxima" ? H * 0.2 : kind === "titan" ? H * 0.13 : H * 0.07;   // the local star, or the planet in the sky
  const sg = x.createRadialGradient(sunx, suny, 2, sunx, suny, sr * 2.4); sg.addColorStop(0, kind === "proxima" ? "rgba(255,90,90,.95)" : kind === "titan" ? "rgba(255,200,120,.55)" : "rgba(255,240,200,.9)"); sg.addColorStop(1, "rgba(255,120,60,0)"); x.fillStyle = sg; x.beginPath(); x.arc(sunx, suny, sr * 2.4, 0, 7); x.fill();
  if (kind === "titan") { x.strokeStyle = "rgba(255,220,160,.5)"; x.lineWidth = 3; x.beginPath(); x.ellipse(sunx, suny, sr * 1.9, sr * 0.45, -0.3, 0, 7); x.stroke(); }
  drawSkyline(x, W, H, cam.x, T, era, pal);
  // the ground below the horizon, then the world through the camera
  const gg = x.createLinearGradient(0, H * 0.3, 0, H); gg.addColorStop(0, pal.reg2); gg.addColorStop(1, "#14110f"); x.fillStyle = gg; x.fillRect(0, H * 0.34, W, H);
  x.save(); x.translate(cam.x, cam.y); x.scale(cam.z, cam.z);
  const vis = (px: number, py: number, pad: number) => { const sx = px * cam.z + cam.x, sy = py * cam.z + cam.y; return sx > -pad * cam.z && sx < W + pad * cam.z && sy > -pad * 2 * cam.z && sy < H + pad * cam.z; };
  const diamond = (c: number, r: number, fill: string, stroke: string) => { const a = ptW(c, r), b = ptW(c + 1, r), d = ptW(c + 1, r + 1), e = ptW(c, r + 1); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(d[0], d[1]); x.lineTo(e[0], e[1]); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = stroke; x.lineWidth = 1; x.stroke(); };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c, cell = S.grid[i], m = ptW(c + 0.5, r + 0.5); if (!vis(m[0], m[1], TW0)) continue;
    diamond(c, r, groundFill(pal, cell.f, i), "rgba(255,255,255,.07)");
    if (cell.f === "ice") { x.fillStyle = "rgba(255,255,255," + (0.35 + 0.3 * Math.sin(T * 2 + i)) + ")"; x.fillRect(m[0] - 8, m[1] - 2, 3, 1.6); x.fillRect(m[0] + 6, m[1] + 3, 2.4, 1.4); }
    else if (cell.f === "ore") { x.fillStyle = "rgba(255,190,90,.9)"; for (let k = 0; k < 4; k++) x.fillRect(m[0] - 10 + k * 6, m[1] - 3 + (k % 2) * 5, 3, 2.2); }
    else if (!cell.b && i % 9 === 0) { x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.ellipse(m[0] + 6, m[1] + 2, 9, 4, 0, 0, 7); x.fill(); x.strokeStyle = "rgba(255,255,255,.12)"; x.stroke(); } }
  // pressurised tubes joining neighbouring modules
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const i = r * COLS + c; if (!S.grid[i].b) continue; const m = ptW(c + 0.5, r + 0.5); if (!vis(m[0], m[1], TW0)) continue;
    if (c + 1 < COLS && S.grid[i + 1].b) { const n = ptW(c + 1.5, r + 0.5); drawTube(x, m[0], m[1], n[0], n[1], TW0 / 64, era); }
    if (r + 1 < ROWS && S.grid[i + COLS].b) { const n = ptW(c + 0.5, r + 1.5); drawTube(x, m[0], m[1], n[0], n[1], TW0 / 64, era); } }
  // buildings, back to front
  for (let sum = 0; sum < COLS + ROWS; sum++) for (let r = 0; r < ROWS; r++) { const c = sum - r; if (c < 0 || c >= COLS) continue; const cell = S.grid[r * COLS + c]; if (!cell.b) continue; const m = ptW(c + 0.5, r + 0.5); if (!vis(m[0], m[1], TW0 * 2)) continue;
    drawBuilding(x, cell.b, m[0], m[1], TW0, era, T, pal, r * COLS + c); }
  // rovers and drones moving between the modules
  const lanes = era === 0 ? 4 : era === 1 ? 8 : 14;
  for (let i = 0; i < lanes; i++) { const r = (i * 5) % ROWS, u = ((T * (0.12 + 0.03 * (i % 3)) + i * 0.37) % 1) * COLS, p = ptW(u, r + 0.5); if (!vis(p[0], p[1], 20)) continue; x.fillStyle = i % 2 ? "rgba(255,200,120,.95)" : "rgba(120,230,255,.95)"; x.fillRect(p[0] - 2, p[1] - 2 - (era === 2 ? 14 : 0), era === 2 ? 6 : 4, 2.4); }
  x.restore();
  // the site's hazard drifts over the city
  if (S.hz > 0) { const k = Math.min(1, S.hz / 3), kind2 = kind;
    if (kind2 === "moon") { x.fillStyle = "rgba(0,0,20," + 0.45 * k + ")"; x.fillRect(0, 0, W, H); }
    else if (kind2 === "mars") { for (let i = 0; i < 70; i++) { x.fillStyle = "rgba(255,150,90," + 0.35 * k + ")"; x.fillRect(((i * 53 + T * 400) % (W + 40)) - 20, (i * 31) % H, 22, 1.6); } }
    else if (kind2 === "titan") { for (let i = 0; i < 40; i++) { x.fillStyle = "rgba(200,230,255," + 0.5 * k + ")"; x.fillRect((i * 71) % W, ((i * 29 + T * 90) % H), 2, 2); } }
    else { if (Math.sin(T * 14) > 0.4) { x.fillStyle = "rgba(255,70,70," + 0.22 * k + ")"; x.fillRect(0, 0, W, H); } } }
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,10,.5)"); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  finishLook(x, W, H, T, kind === "proxima" ? "255,140,110" : kind === "mars" ? "255,190,130" : "255,226,180", 0.9);
}

const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const careerNow = () => { try { return localStorage.getItem("tg_adv_career") || ""; } catch (e) { return ""; } };

export default function AdventureColony({ P, lang, onWin, onExit, onRetry, net }: any) {
  const site: Site = SITES[P.kind] || SITES.moon, t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const G = useRef<any>(null);
  if (!G.current) {
    const r = rng(P.kind === "mars" ? 7 : P.kind === "titan" ? 13 : P.kind === "proxima" ? 29 : 3), grid: any[] = Array.from({ length: CELLS }, () => ({ b: null as any, f: "" }));
    for (let i = 0; i < 34; i++) { const c = Math.floor(r() * CELLS); if (!grid[c].f) grid[c].f = "ice"; }
    for (let i = 0; i < 34; i++) { const c = Math.floor(r() * CELLS); if (!grid[c].f) grid[c].f = "ore"; }
    const h0 = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2) - 1; grid[h0].b = "hab"; grid[h0 + 1].b = "solar"; grid[h0].f = ""; grid[h0 + 1].f = "";
    G.current = { t: 0, grid, stock: { en: 40, wa: 70, ox: 70, fo: 70, ma: 150, sc: 0 }, rate: { en: 0, wa: 0, ox: 0, fo: 0, ma: 0, sc: 0 }, pop: 8, grow: 0, tech: [false, false, false], hz: 0, hzT: 40, portT: 12, sel: "hab" as string, tool: "build" as string, info: -1, hist: [] as any[], news: [] as any[], flags: {} as any, ended: false, won: false, short: 0, msg: "", peak: 8, days: 0 };
  }
  const speedRef = useRef(1), [speed, setSpeedS] = useState(1), [career, setCareer] = useState<string>(() => careerNow()), [, setTick] = useState(0), [gear, setGear] = useState(false), pausedRef = useRef(false), [budget, setBudget] = useState(false), [advisor, setAdvisor] = useState(false);
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null), careerRef = useRef(career); careerRef.current = career;
  const cvRef = useRef<HTMLCanvasElement>(null), cityRef = useRef<HTMLDivElement>(null), worldRef = useRef<HTMLDivElement>(null), camRef = useRef({ x: 0, y: 0, z: 1, W: 600, H: 300 }), tapBlock = useRef(0), tapRef = useRef<any>(null), focusRef = useRef<any>(null), zoomRef = useRef<any>(null);
  /* the camera (owner, 2026-10-15: the city is about five times bigger, SimCity BuildIt style): drag to pan, pinch or wheel to zoom, the world is drawn through it and the plots' buttons ride in a div that follows the same transform */
  useEffect(() => {
    const el = cityRef.current, cv = cvRef.current; if (!el || !cv) return; let raf = 0, alive = true, lastDraw = 0, init = false;
    const cam = camRef.current, minZ = () => Math.max(cam.W / WORLD.w, cam.H / WORLD.h) * 0.9, clampCam = () => { cam.z = Math.max(minZ(), Math.min(2.4, cam.z)); const ww = WORLD.w * cam.z, wh = WORLD.h * cam.z; cam.x = ww <= cam.W ? (cam.W - ww) / 2 : Math.max(cam.W - ww, Math.min(0, cam.x)); cam.y = wh <= cam.H ? (cam.H - wh) / 2 : Math.max(cam.H - wh, Math.min(0, cam.y)); };
    const apply = () => { clampCam(); if (worldRef.current) worldRef.current.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.z})`; };
    const focus = (i: number, z?: number) => { if (z) cam.z = z; const m = ptW(i % COLS + 0.5, Math.floor(i / COLS) + 0.5); cam.x = cam.W / 2 - m[0] * cam.z; cam.y = cam.H * 0.55 - m[1] * cam.z; apply(); };
    const zoomAt = (px: number, py: number, k: number) => { const nz = Math.max(minZ(), Math.min(2.4, cam.z * k)); cam.x = px - (px - cam.x) * nz / cam.z; cam.y = py - (py - cam.y) * nz / cam.z; cam.z = nz; apply(); };
    focusRef.current = focus; zoomRef.current = (k: number) => zoomAt(cam.W / 2, cam.H / 2, k);
    const fit = () => { const W = Math.max(280, el.clientWidth), H = Math.max(200, el.clientHeight), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px"; cam.W = W; cam.H = H;
      if (!init) { init = true; cam.z = Math.max(minZ(), W / (TW0 * 8.5)); focus(Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2)); } else apply(); };
    fit(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null; if (ro) ro.observe(el);
    const ptrs = new Map<number, { x: number; y: number }>(); let lastD = 0, moved = 0; const dist = () => { const v = [...ptrs.values()]; return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); };
    const rel = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => { ptrs.set(e.pointerId, rel(e)); moved = 0; if (ptrs.size === 2) lastD = dist(); };
    const move = (e: PointerEvent) => { const prev = ptrs.get(e.pointerId); if (!prev) return; const cur = rel(e); ptrs.set(e.pointerId, cur);
      if (ptrs.size === 1) { const dx = cur.x - prev.x, dy = cur.y - prev.y; moved += Math.abs(dx) + Math.abs(dy); if (moved > 10) { cam.x += dx; cam.y += dy; apply(); tapBlock.current = performance.now(); } }
      else if (ptrs.size === 2) { const d = dist(), v = [...ptrs.values()]; if (lastD) zoomAt((v[0].x + v[1].x) / 2, (v[0].y + v[1].y) / 2, d / lastD); lastD = d; tapBlock.current = performance.now(); } };
    const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (moved > 10) tapBlock.current = performance.now(); lastD = 0; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const p = { x: e.clientX - el.getBoundingClientRect().left, y: e.clientY - el.getBoundingClientRect().top }; zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 0.89); };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("wheel", wheel, { passive: false });
    const loop = (now: number) => { if (!alive) return; raf = requestAnimationFrame(loop); if (now - lastDraw < 50) return; lastDraw = now; const x = cv.getContext("2d"); if (!x) return; const dpr = cv.width / cam.W; x.setTransform(dpr, 0, 0, dpr, 0, 0); try { drawCity(x, cam.W, cam.H, G.current, P.kind || "moon", cam, now / 1000, eraOf(G.current)); } catch (e) {} };
    raf = requestAnimationFrame(loop); return () => { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("wheel", wheel); };
  }, []);
  const cost = (b: B) => Math.round(b.cost * (careerRef.current === "eng" ? 0.8 : 1));
  useEffect(() => {
    const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    const S = G.current; let last = performance.now();
    if (net) {   // online (plan 33): every pilot builds on the SAME grid; a build or demolition is sent to the room and applied for free on the other screens (the builder paid)
      net.on({ onEv: (p: any, k: string, n: number) => {
        if (k === "colx") { const c = S.grid[n]; if (c) c.b = null; }
        else if (k.startsWith("colb:")) { const c = S.grid[n]; if (c) { c.b = k.slice(5); c.f = c.f; } }
        else if (k.startsWith("colc:") && p) { p.say = k.slice(5); }
        else if (k === "colh") { S.hz = HZ_DUR; sfx.play("hurt"); }              // the host decides when a hazard strikes, so the whole team shares it
        else if (k.startsWith("cols:")) { const v = k.slice(5).split(",").map(Number); ["en", "wa", "ox", "fo"].forEach((r, i) => { if (isFinite(v[i])) S.stock[r] = v[i]; }); }   // the host's power, water, oxygen and food are the team's
        else if (k === "colp") { S.pop = n; S.peak = Math.max(S.peak, n); }      // and the host's population is the team's, so everyone reaches the target together
        setTick(x => x + 1); } });
    }
    const step = (dt: number) => {
      const cr = careerRef.current;
      let sunMul = site.sun * (cr === "eng" ? 1.15 : 1) * (S.tech[2] ? 1.4 : 1), coldMul = 1, oxLeak = 0;
      const shields = S.grid.filter((c: any) => c.b === "shield").length, hzK = 1 / (1 + 0.6 * shields), parks = Math.min(4, S.grid.filter((c: any) => c.b === "park").length);   // shield domes soften every hazard; parks speed up growth
      if (S.hz > 0) { if (site.hazard === "night") sunMul *= 1 - 0.85 * hzK; else if (site.hazard === "dust") sunMul *= 1 - 0.65 * hzK; else if (site.hazard === "cold") coldMul = 1 + 0.5 * hzK; else if (site.hazard === "flare") { sunMul *= 1 - 0.6 * hzK; oxLeak = 0.5 * hzK; } }
      const R = { en: 0, wa: 0, ox: 0, fo: 0, ma: 0, sc: 0 }; let homes = 0;
      const powered = S.stock.en > 0.5;                                  // a building with no power is idle
      for (const c of S.grid) { if (!c.b) continue;
        if (c.b === "hab") homes += 6;
        else if (c.b === "solar") R.en += 1.6 * sunMul;
        else if (c.b === "reactor") R.en += 5.2;
        else if (powered) {
          if (c.b === "water") { R.wa += 1.2 * site.water * (c.f === "ice" ? 2 : 1); R.en -= 0.4; }
          else if (c.b === "oxy") { R.ox += 1.5; R.wa -= 0.3 * (S.tech[0] ? 0.7 : 1); R.en -= 0.5; }
          else if (c.b === "farm") { R.fo += 1.3 * (cr === "farm" ? 1.35 : 1) * (S.tech[1] ? 1.3 : 1); R.ox += 0.3; R.wa -= 0.3 * (S.tech[0] ? 0.7 : 1); R.en -= 0.3; }
          else if (c.b === "mine") { R.ma += 1.0 * site.ore * (c.f === "ore" ? 2 : 1) * (cr === "miner" ? 1.35 : 1); R.en -= 0.4; }
          else if (c.b === "lab") { R.sc += 0.5 * (cr === "inno" ? 2 : 1); R.en -= 0.5; }
          else if (c.b === "med") R.en -= 0.4;
          else if (c.b === "school") { R.sc += 0.35; R.en -= 0.3; }
          else if (c.b === "recycler") { R.wa += 0.6; R.ox += 0.4; R.en -= 0.4; }
          else if (c.b === "market") { R.ma += 0.8; R.en -= 0.4; }
          else if (c.b === "geo") R.en += 3.0;
          else if (c.b === "tower") { R.fo += 2.6 * (cr === "farm" ? 1.35 : 1) * (S.tech[1] ? 1.3 : 1); R.wa -= 0.4; R.en -= 0.7; }
          else if (c.b === "port") R.en -= 0.8;
        }
      }
      const p = S.pop, wm = S.tech[0] ? 0.7 : 1;
      R.ox -= p * 0.05; R.wa -= p * 0.04 * wm; R.fo -= p * 0.05; R.en -= p * 0.06 * coldMul; R.ox -= oxLeak;
      for (const k of Object.keys(R)) { S.rate[k] = R[k as keyof typeof R]; S.stock[k] = Math.max(0, Math.min(k === "ma" || k === "sc" ? 9999 : 400, S.stock[k] + R[k as keyof typeof R] * dt)); }
      const med = S.grid.some((c: any) => c.b === "med");
      const need = ["en", "wa", "ox", "fo"].filter(k => S.stock[k] <= 0.01);
      if (need.length) { S.short += dt; if (S.short > (med ? 6 : 3) && S.pop > 2) { S.pop = Math.max(0, S.pop - (med ? 0.15 : 0.3) * dt); } S.msg = need.map(k => RES.find(r => r.k === k)!.icon).join(" "); }
      else { S.short = Math.max(0, S.short - dt * 2); S.msg = "";
        const free = homes - S.pop, ok = ["en", "wa", "ox", "fo"].every(k => S.stock[k] > 12);
        if (free > 0.5 && ok) { S.grow += dt * (0.14 + (med ? 0.06 : 0) + 0.025 * parks) * (cr === "farm" ? 1.2 : 1); if (S.grow >= 1) { const n = Math.min(Math.floor(S.grow), Math.floor(free)); S.pop += n; S.grow -= n; } }
      }
      S.peak = Math.max(S.peak, S.pop);
      S.hzT -= dt; if (S.hz > 0) S.hz = Math.max(0, S.hz - dt); else if (S.hzT <= 0 && !(net && !net.host)) { S.hz = HZ_DUR; S.hzT = 42 + Math.random() * 14; sfx.play("hurt"); if (net) net.sendEv("colh", 0); }
      if (S.grid.some((c: any) => c.b === "port")) { S.portT -= dt; if (S.portT <= 0) { S.portT = careerRef.current === "ship" ? 14 : 20; const room = Math.max(0, Math.floor(homes - S.pop)); const add = Math.min(careerRef.current === "ship" ? 4 : 3, room); S.pop += add; S.stock.ma += 20; sfx.play("pickup"); } }
    };
    const id = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000) * SPEEDS[speedRef.current]; last = now; if (pausedRef.current || S.ended) return;
      S.t += dt; S.days = Math.floor(S.t / DAY); step(dt);
      if (net && net.host) { S.syncT = (S.syncT || 0) - dt; if (S.syncT <= 0) { S.syncT = 3; net.sendEv("colp", Math.round(S.pop * 100) / 100); net.sendEv("cols:" + ["en", "wa", "ox", "fo"].map(r => Math.round(S.stock[r] * 10) / 10).join(","), 0); } }
      if (S.pop >= site.target && !S.won && ["en", "wa", "ox", "fo"].every(k => S.stock[k] > 5)) { S.won = true; S.ended = true; sfx.play("win"); const stars = S.days <= 150 ? 3 : S.days <= 220 ? 2 : 1; setTimeout(() => onWin({ colony: { pop: Math.round(S.pop), target: site.target, days: S.days, stars, kind: P.kind, career: careerRef.current }, kills: 0, cry: 10 + 4 * stars, loot: {}, mode: "colony" }), 2200); }
      else if (S.pop < 1 && !S.ended) { S.ended = true; sfx.play("hurt"); }
      { // the newspaper: what happened in the colony, in plain words (each headline once per event)
        const F = S.flags, pn = (k: string) => { S.news.unshift({ k, d: S.days }); if (S.news.length > 14) S.news.pop(); };
        if (!F.start) { F.start = 1; F.lastPop = S.pop; pn("start"); }
        const sh = ["en", "wa", "ox", "fo"].some(k => S.stock[k] <= 0.5); if (sh && !F.short) { F.short = 1; pn("short"); } else if (!sh && F.short) { F.short = 0; pn("ok"); }
        if (S.hz > 0 && !F.hz) { F.hz = 1; pn("hz"); } else if (S.hz <= 0 && F.hz) { F.hz = 0; pn("hzend"); }
        const er = eraOf(S); if (er > (F.era || 0)) { F.era = er; pn(er === 1 ? "era1" : "era2"); }
        const tc = S.tech.filter(Boolean).length; if (tc > (F.tech || 0)) { F.tech = tc; pn("tech"); }
        if (S.pop >= site.target / 2 && !F.half) { F.half = 1; pn("half"); }
        if (S.pop - (F.lastPop || 0) >= 6) { F.lastPop = S.pop; pn("boom"); }
        S.histT = (S.histT || 0) - 1; if (S.histT <= 0) { S.histT = 30; S.hist.push({ d: S.days, pop: Math.round(S.pop), en: Math.round(S.stock.en), wa: Math.round(S.stock.wa), ox: Math.round(S.stock.ox), fo: Math.round(S.stock.fo) }); if (S.hist.length > 80) S.hist.shift(); }
      }
      setTick(x => (x + 1) % 1e6);
    }, 100);
    (window as any).__advColony = { focus: (i: number, z?: number) => { if (focusRef.current) focusRef.current(i, z); }, cam: () => ({ ...camRef.current }), state: () => ({ t: S.t, pop: S.pop, stock: { ...S.stock }, rate: { ...S.rate }, grid: S.grid.map((c: any) => c.b), tech: S.tech.slice(), hz: S.hz, won: S.won, ended: S.ended, target: site.target, career: careerRef.current }), setCareer: (c: string) => { careerRef.current = c; setCareer(c); }, give: (k: string, n: number) => { S.stock[k] += n; }, setPop: (n: number) => { S.pop = n; }, tick: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.1); i++) { S.t += 0.1; step(0.1); } }, hazard: () => { S.hz = HZ_DUR; if (net && net.host) net.sendEv("colh", 0); }, finish: () => { S.pop = site.target; for (const k of ["en", "wa", "ox", "fo"]) S.stock[k] = 200; } };
    return () => { clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advColony; } catch (e) {} };
  }, []);
  const S = G.current;
  const play = (n: string) => sfxRef.current && sfxRef.current.play(n);
  const tapCell = (i: number) => {
    if (S.ended || !career || performance.now() - tapBlock.current < 250) return; const c = S.grid[i];
    if (S.tool === "query") { S.info = S.info === i ? -1 : i; play("pickup"); setTick(x => x + 1); return; }
    if (S.tool === "bulldoze" && !c.b) return;
    if (c.b) { if (c.b === "hab" && S.grid.filter((q: any) => q.b === "hab").length * 6 - 6 < S.pop) { play("hurt"); return; } const bd = BUILD.find(b => b.id === c.b)!; S.stock.ma += Math.round(cost(bd) * 0.5); c.b = null; if (net) net.sendEv("colx", i); play("boom"); setTick(x => x + 1); return; }
    const bd = BUILD.find(b => b.id === S.sel)!; if (!bd) return;
    if ((bd.needSci || 0) > S.stock.sc) { play("hurt"); return; }
    const cs = cost(bd); if (S.stock.ma < cs) { play("hurt"); return; }
    S.stock.ma -= cs; c.b = bd.id; if (net) net.sendEv("colb:" + bd.id, i); play("pop"); setTick(x => x + 1);
  };
  tapRef.current = tapCell;
  const tcost = (i: number) => Math.round(TECH[i].cost * (career === "inno" ? 0.75 : 1));
  const buyTech = (i: number) => { const tc = TECH[i]; if (S.tech[i] || S.stock.sc < tcost(i) || S.ended) return; S.stock.sc -= tcost(i); S.tech[i] = true; play("win"); setTick(x => x + 1); };
  const taken = (id: string) => !!net && [...net.peers.values()].some((q: any) => q.say === id);   // online: one pilot per career, so the team covers every weak spot
  const pickCareer = (id: string) => { if (taken(id)) { play("hurt"); return; } try { localStorage.setItem("tg_adv_career", id); } catch (e) {} setCareer(id); if (net) net.sendEv("colc:" + id, 0); play("pickup"); };
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const pct = Math.min(100, S.pop / site.target * 100), homes = S.grid.filter((c: any) => c.b === "hab").length * 6, dm = demandOf(S, homes), fact = FACTS[Math.floor(S.t / 20) % FACTS.length];
  const gridSig = S.grid.map((c: any) => c.b || "").join(",") + "|" + S.tool;
  const cellsEl = useMemo(() => S.grid.map((c: any, i: number) => { const m = ptW(i % COLS + 0.5, Math.floor(i / COLS) + 0.5), bd = c.b ? BUILD.find(b => b.id === c.b) : null; return (
    <button key={i} className={"ac2-cell" + (bd ? " has" : "") + (c.f ? " " + c.f : "")} data-cell={i} data-b={c.b || ""} onClick={() => tapRef.current && tapRef.current(i)} aria-label={bd ? T3(lang, bd.name[0], bd.name[1], bd.name[2]) : "plot"}
      style={{ left: m[0] - TW0 / 2, top: m[1] - TW0 / 4, width: TW0, height: TW0 / 2 }} />); }), [gridSig, lang]);
  return (
    <div className="adv-farm adv-colony cb" data-colony={P.kind}>
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">{site.icon} {T3(lang, site.name[0], site.name[1], site.name[2])} · {t("วันที่ ", "Day ", "第 ")}{S.days}{lang === "zh" ? " 天" : ""} · 👥 {Math.floor(S.pop)}/{homes} {t("ที่พัก", "homes", "住房")}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{t("ประชากร ", "Population ", "人口 ")}{Math.floor(S.pop)}/{site.target}</b></div>
        </div>
        <GearButton onClick={openGear} />
      </div>
      {net && <div className="ac2-team" data-team="1">🤝 {t("ทีม: ", "Team: ", "团队：")}{[...net.peers.values()].map((q: any) => <span key={q.id}>{q.name} {(CAREERS.find(c => c.id === q.say) || { icon: "…" }).icon}</span>)}</div>}
<<<<<<< HEAD
      <div className="ac2-speed" data-speedbar="1">{[t("ช้า", "Slow", "慢"), t("กลาง", "Normal", "中"), t("เร็ว", "Fast", "快"), t("เร็วขึ้น", "Faster", "更快"), t("สูงสุด", "Max", "最快")].map((lb, i) => (<button key={i} data-speed={i} className={"ac2-sp" + (speed === i ? " on" : "")} onClick={() => { speedRef.current = i; setSpeedS(i); }}>{SPEED_ICON[i]} {lb}</button>))}</div>
      <div className="ac2-res">
        {RES.map(r => (<span key={r.k} className={"ac2-r" + (S.stock[r.k] <= 0.5 && r.k !== "sc" && r.k !== "ma" ? " low" : "")} data-res={r.k}>{r.icon} {Math.floor(S.stock[r.k])}<small className={S.rate[r.k] < -0.01 ? "neg" : ""}>{S.rate[r.k] >= 0 ? "+" : ""}{Math.round(S.rate[r.k])}</small></span>))}
        {S.hz > 0 && <span className="ac2-hz" data-hazard="1">⚠ {T3(lang, site.hz[0], site.hz[1], site.hz[2])}</span>}
        {S.msg && <span className="ac2-hz">⚠ {t("ขาดแคลน ", "Shortage ", "短缺 ")}{S.msg}</span>}
      </div>
      <div className="ac2-city" ref={cityRef}>
=======
      <div className="cb-map" ref={cityRef} data-city="1">
>>>>>>> origin/claude/upbeat-fermi-dey70w
        <canvas ref={cvRef} className="ac2-cv" aria-hidden="true" />
        <div className="cb-world" ref={worldRef} style={{ width: WORLD.w, height: WORLD.h }}>{cellsEl}</div>
        {(() => { const e = ERAS[eraOf(S)]; return <div className="ac2-era" data-era={e.y}><b>{t("ปี ", "YEAR ", "公元 ")}{e.y}</b><small>{T3(lang, e.n[0], e.n[1], e.n[2])}</small></div>; })()}
      </div>
<<<<<<< HEAD
      <div className="ac2-cats">
        {CATS.map(cat => (
          <div key={cat.id} className="ac2-catrow">
            <div className="ac2-cath">{cat.icon} {T3(lang, cat.label[0], cat.label[1], cat.label[2])}</div>
            <div className="ac2-build">
              {BUILD.filter(b => b.cat === cat.id).map(b => { const locked = (b.needSci || 0) > S.stock.sc, cs = cost(b); return (
                <button key={b.id} className={"ac2-b" + (S.sel === b.id ? " on" : "") + (locked ? " lock" : S.stock.ma < cs ? " poor" : "")} data-build={b.id} onClick={() => { S.sel = b.id; setTick(x => x + 1); }}>
                  <b>{b.icon} {T3(lang, b.name[0], b.name[1], b.name[2])}</b><small>🧱 {cs}{locked ? " · 🔒 " + b.needSci + "🔬" : ""}</small></button>); })}
            </div>
          </div>
        ))}
=======
      <div className="cb-speed" data-speedbar="1">{[t("ช้า", "Slow", "慢"), t("กลาง", "Normal", "中"), t("เร็ว", "Fast", "快")].map((lb, i) => (<button key={i} data-speed={i} aria-label={lb} className={"ac2-sp" + (speed === i ? " on" : "")} onClick={() => { speedRef.current = i; setSpeedS(i); }}>{["🐢", "▶", "⏩"][i]}</button>))}</div>
      <div className="cb-res" data-resbar="1">
        {RES.map(r => (<span key={r.k} className={"ac2-r cb-pill" + (S.stock[r.k] <= 0.5 && r.k !== "sc" && r.k !== "ma" ? " low" : "")} data-res={r.k} {...(r.k === "ma" ? { "data-fund": "1" } : {})}><i>{r.icon}</i><b>{Math.floor(S.stock[r.k])}</b><small className={S.rate[r.k] < -0.01 ? "neg" : "pos"}>{S.rate[r.k] < -0.01 ? "▼" : S.rate[r.k] > 0.01 ? "▲" : "·"}</small></span>))}
>>>>>>> origin/claude/upbeat-fermi-dey70w
      </div>
      {(S.hz > 0 || S.msg) && <div className="cb-alert" data-hazard={S.hz > 0 ? "1" : undefined}>{S.hz > 0 ? "⚠ " + T3(lang, site.hz[0], site.hz[1], site.hz[2]) : ""}{S.msg ? " ⚠ " + t("ขาดแคลน ", "Shortage ", "短缺 ") + S.msg : ""}</div>}
      {S.news[0] && <div className="cb-news" data-news="1" key={S.news.length}><b>📰</b><span className="sc-tick">{(lang === "th" ? "วันที่ " : lang === "zh" ? "第" : "Day ") + S.news[0].d + (lang === "zh" ? "天" : "") + ": " + T3(lang, NEWS[S.news[0].k][0], NEWS[S.news[0].k][1], NEWS[S.news[0].k][2])}</span></div>}
      <div className="cb-fab" data-fab="1">
        <button className={"cb-round" + (S.tool === "query" ? " on" : "")} data-tool="query" aria-label="query" onClick={() => { S.tool = S.tool === "query" ? "build" : "query"; S.info = -1; setTick(x => x + 1); }}>🔍</button>
        <button className={"cb-round" + (S.tool === "bulldoze" ? " on" : "")} data-tool="bulldoze" aria-label="bulldoze" onClick={() => { S.tool = S.tool === "bulldoze" ? "build" : "bulldoze"; setTick(x => x + 1); }}>🚧</button>
        <button className="cb-round" data-budget-open="1" aria-label="budget" onClick={() => { pausedRef.current = true; setBudget(true); }}>📊</button>
        <button className="cb-round" data-advisor-open="1" aria-label="advisor" onClick={() => { pausedRef.current = true; setAdvisor(true); }}>🧑‍🚀<em>{dm.ap}</em></button>
        <button className="cb-round sm" data-zoom="in" aria-label="zoom in" onClick={() => zoomRef.current && zoomRef.current(1.3)}>＋</button>
        <button className="cb-round sm" data-zoom="out" aria-label="zoom out" onClick={() => zoomRef.current && zoomRef.current(0.77)}>－</button>
        <button className="cb-round sm" data-zoom="home" aria-label="centre" onClick={() => focusRef.current && focusRef.current(Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2))}>🎯</button>
      </div>
      {S.info >= 0 && S.grid[S.info] && (() => { const c = S.grid[S.info], bd = c.b ? BUILD.find(q => q.id === c.b) : null, on = S.stock.en > 0.5; return (
        <div className="sc-info cb-info" data-info="1"><b>{bd ? bd.icon + " " + T3(lang, bd.name[0], bd.name[1], bd.name[2]) : t("ที่ดินว่าง", "Empty plot", "空地")}</b>
          {bd ? <span>{T3(lang, bd.text[0], bd.text[1], bd.text[2])}</span> : null}
          {bd && !["solar", "reactor", "geo", "hab"].includes(bd.id) ? <span className={on ? "ok" : "bad"}>{on ? "● " + t("ทำงานอยู่", "Running", "运行中") : "○ " + t("ไฟไม่พอ หยุดทำงาน", "No power: idle", "断电：停工")}</span> : null}
          {c.f ? <span>{c.f === "ice" ? "❄ " + t("ช่องน้ำแข็ง: สกัดน้ำได้สองเท่า", "Ice plot: double water", "冰地：产水翻倍") : "◆ " + t("ช่องแร่: เหมืองได้สองเท่า", "Ore plot: double mining", "矿地：采矿翻倍")}</span> : null}
          <small>{t("แตะอีกครั้งเพื่อปิด", "Tap again to close", "再点一次关闭")}</small></div>); })()}
      <div className="cb-tray" data-toolbox="1">
        <div className="cb-cats">{[...GROUPS, { id: "tech", icon: "🔬", name: ["วิจัย", "Research", "研究"] }].map((g: any) => (<button key={g.id} className="cb-cat" data-cat={g.id} aria-label={T3(lang, g.name[0], g.name[1], g.name[2])} onClick={() => { const el = document.querySelector(`[data-grp='${g.id}']`) as HTMLElement | null; if (el && el.scrollIntoView) el.scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" }); }}>{g.icon}</button>))}</div>
        <div className="cb-cards">
          {GROUPS.map(g => (<div key={g.id} className="cb-sec sc-g" data-grp={g.id}><div className="sc-gh">{T3(lang, g.name[0], g.name[1], g.name[2])}</div><div className="cb-row">
            {g.ids.map(id => { const b = BUILD.find(q => q.id === id)!, locked = (b.needSci || 0) > S.stock.sc, cs = cost(b); return (
              <button key={b.id} className={"cb-card ac2-b" + (S.sel === b.id && S.tool === "build" ? " on" : "") + (locked ? " lock" : S.stock.ma < cs ? " poor" : "")} data-build={b.id} onClick={() => { S.sel = b.id; S.tool = "build"; S.info = -1; setTick(x => x + 1); }}>
                <i>{b.icon}</i><b>{T3(lang, b.name[0], b.name[1], b.name[2])}</b><small>{locked ? "🔒 " + b.needSci + "🔬" : "🧱 " + cs}</small></button>); })}</div></div>))}
          <div className="cb-sec sc-g" data-grp="tech"><div className="sc-gh">🔬 {t("วิจัย", "Research", "研究")}</div><div className="cb-row">
            {TECH.map((tc, i) => (<button key={tc.id} className={"cb-card af-t" + (S.tech[i] ? " on" : "")} data-tech={i} disabled={S.tech[i] || S.stock.sc < tcost(i)} onClick={() => buyTech(i)}><i>{["♻", "🌱", "☀"][i]}</i><b>{T3(lang, tc.name[0], tc.name[1], tc.name[2])}</b><small>{S.tech[i] ? "✓" : "🔬 " + tcost(i)}</small></button>))}</div></div>
        </div>
      </div>
      {advisor && (<div className="sc-win cb-win" role="dialog" data-advisorwin="1"><div className="sc-wt"><span>🧑‍🚀 {t("ที่ปรึกษา", "Advisor", "顾问")}</span><button data-advisor-close="1" onClick={() => { pausedRef.current = false; setAdvisor(false); }}>✕</button></div>
        <div className="sc-wb">
          <div className="cb-adv-head"><span className="sc-date" data-date="1">{["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Math.floor(S.days / 4) % 12]} {ERAS[eraOf(S)].y + Math.floor(S.days / 48)}</span><span className="sc-apr" data-approval={dm.ap}>{"★".repeat(Math.round(dm.ap / 20))}{"☆".repeat(5 - Math.round(dm.ap / 20))} {dm.ap}%</span></div>
          <div className="sc-ph">{t("แผนที่ย่อ", "Minimap", "小地图")}</div>
          <div className="sc-mini" data-mini="1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>{S.grid.map((c: any, i: number) => <i key={i} style={{ background: c.b ? MINI[c.b] || "#fff" : c.f === "ice" ? "#335a7a" : c.f === "ore" ? "#6a4a2a" : "#1d2a33" }} />)}</div>
          <div className="sc-ph">{t("ความต้องการ", "Demand", "需求")}</div>
          <div className="sc-rci" data-rci="1">{([["H", dm.H, "#3ccf5b", t("ที่พัก", "Homes", "住房")], ["W", dm.W, "#4a8cff", t("ผลิต", "Work", "生产")], ["S", dm.Sv, "#ffd23f", t("บริการ", "Services", "服务")]] as any[]).map(([k, v, col, nm]) => (<span key={k} data-rci-bar={k} title={nm}><u><i style={{ height: Math.round(v * 100) + "%", background: col }} /></u><b>{k}</b><small>{nm}</small></span>))}</div>
          <div className="af-fact">💡 {T3(lang, site.note[0], site.note[1], site.note[2])} · {T3(lang, fact[0], fact[1], fact[2])}</div>
        </div></div>)}
      {budget && (<div className="sc-win" role="dialog" data-budget="1"><div className="sc-wt"><span>📊 {t("งบประมาณและสถิติ", "Budget & statistics", "预算与统计")}</span><button data-budget-close="1" onClick={() => { pausedRef.current = false; setBudget(false); }}>✕</button></div>
        <div className="sc-wb"><table><thead><tr><th>{t("ทรัพยากร", "Resource", "资源")}</th><th>{t("คงเหลือ", "Stock", "库存")}</th><th>{t("ต่อวัน", "Per day", "每天")}</th></tr></thead><tbody>
          {RES.map(r => (<tr key={r.k}><td>{r.icon} {T3(lang, r.name[0], r.name[1], r.name[2])}</td><td>{Math.floor(S.stock[r.k])}</td><td className={S.rate[r.k] < -0.01 ? "neg" : "pos"}>{S.rate[r.k] >= 0 ? "+" : ""}{(S.rate[r.k] * DAY).toFixed(1)}</td></tr>))}</tbody></table>
          <div className="sc-ph">{t("ประชากร", "Population", "人口")}</div>
          <svg viewBox="0 0 200 60" className="sc-graph" data-graph="1" preserveAspectRatio="none"><polyline fill="none" stroke="#1a73e8" strokeWidth="2" points={S.hist.map((h: any, i: number) => (S.hist.length > 1 ? i / (S.hist.length - 1) * 200 : 0) + "," + (58 - Math.min(56, h.pop / Math.max(1, site.target) * 56))).join(" ")} /><line x1="0" x2="200" y1="2" y2="2" stroke="#d33" strokeDasharray="4 3" /></svg>
          <div className="sc-ph">{t("อาคาร", "Buildings", "建筑")}</div>
          <div className="sc-counts">{BUILD.map(b => { const n = S.grid.filter((c: any) => c.b === b.id).length; return n ? <span key={b.id}>{b.icon} {n}</span> : null; })}</div></div></div>)}
      {!career && (<div className="adv-quiz" data-careers="1" style={{ alignItems: "center" }} onPointerDown={(e) => e.stopPropagation()}><div className="pvpstandby-card" style={{ maxWidth: 460 }}>
        <b>{t("เลือกสายอาชีพของคุณ", "Choose your career", "选择你的职业")}</b>
        <small>{t("ในห้องออนไลน์ แต่ละคนจะถืออาชีพของตัวเอง ทุกอาชีพเสริมกันและกัน", "Online, every pilot holds a career of their own and they cover each other's weak spots", "联机时每位玩家各担一职，互补长短")}</small>
        <div className="af-pick">{CAREERS.map(c => (<button key={c.id} className="adv-btn" data-career={c.id} disabled={taken(c.id)} onClick={() => pickCareer(c.id)}>{c.icon} {T3(lang, c.name[0], c.name[1], c.name[2])}<small>{T3(lang, c.text[0], c.text[1], c.text[2])}</small></button>))}</div>
      </div></div>)}
      {S.ended && !S.won && (<div className="adv-clear" role="dialog" aria-label="colony lost"><b>{t("อาณานิคมล่มสลาย", "The colony collapsed", "殖民地崩溃了")}</b><span>{t("ประชากรสูงสุด ", "Peak population ", "人口峰值 ")}{Math.floor(S.peak)}/{site.target}</span>
        <div className="adv-clear-btns"><button className="adv-btn go" onClick={() => onRetry && onRetry()}>↻ {t("ลองใหม่", "Retry", "重试")}</button><button className="adv-btn" onClick={() => onExit()}>{t("เมนูแผนที่", "Map menu", "地图菜单")}</button></div></div>)}
      {S.won && <div className="adv-clear" role="status"><b>🏙 {t("อาณานิคมเติบโตสำเร็จ!", "The colony thrives!", "殖民地繁荣兴旺！")}</b></div>}
      {gear && <SettingsPopup lang={lang} high={high} onGfx={() => { const n = !high; setHigh(n); try { localStorage.setItem("tg_adv_gfx", n ? "high" : "standard"); } catch (e) {} }} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div>
  );
}
