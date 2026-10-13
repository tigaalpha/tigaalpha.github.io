/* Adventure: the Colony Builder (owner, 2026-10-13: "a SimCity-style level where you build a colony on the Moon, on Saturn's moon, on Mars or on a planet
   of another star such as Proxima Centauri, with farming to feed it, and, online, many careers").
   Four sites share this one management game (`P.kind`: moon, mars, titan, proxima). A grid of 8 x 6 plots, ten kinds of building, six resources that run
   every second, colonists who need oxygen, water, food and power and who only move in when there is a free home, research that unlocks better buildings,
   a hazard that belongs to the site (night, dust storm, cold, flare), and a career the player picks (it tilts the numbers, and in an online room each pilot
   will hold one). Win = the colony reaches its population target while every need is still met. DOM only, no downloads, no coins (crystals + EXP). */
import { useEffect, useRef, useState } from "react";
import { createAdvSfx } from "./adventure-sfx";
import { createAdvMusic } from "./adventure-music";
import { GearButton, SettingsPopup } from "./adventure-settings";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
type L3 = [string, string, string];
const COLS = 8, ROWS = 6, CELLS = COLS * ROWS, DAY = 2;   // a "day" is 2 seconds of play

type Site = { icon: string; target: number; sun: number; water: number; ore: number; cold: number; hazard: string; name: L3; note: L3; hz: L3 };
export const SITES: Record<string, Site> = {
  moon:    { icon: "🌑", target: 40,  sun: 1.0, water: 0.6, ore: 1.2, cold: 1.0, hazard: "night", name: ["ดวงจันทร์ของโลก", "Earth's Moon", "地球的月球"], note: ["แสงแดดดี แต่น้ำน้อยมาก และกลางคืนยาวสองสัปดาห์", "Plenty of sun, very little water, and a night two weeks long", "阳光充足，但水极少，而且长夜持续两周"], hz: ["กลางคืนบนดวงจันทร์ — แผงโซลาร์แทบไม่ได้พลังงาน", "Lunar night — solar panels give almost nothing", "月夜——太阳能板几乎发不了电"] },
  mars:    { icon: "🔴", target: 60,  sun: 0.6, water: 1.0, ore: 1.0, cold: 1.2, hazard: "dust", name: ["ดาวอังคาร", "Mars", "火星"], note: ["แดดอ่อนกว่าโลก มีน้ำแข็งใต้ดิน และพายุฝุ่นบังแสง", "Weak sun, ice underground, and dust storms that hide it", "阳光较弱，地下有冰，沙尘暴会遮蔽阳光"], hz: ["พายุฝุ่น — แผงโซลาร์ถูกบัง", "Dust storm — the panels are buried in dust", "沙尘暴——太阳能板被尘埃覆盖"] },
  titan:   { icon: "🪐", target: 80,  sun: 0.15, water: 1.7, ore: 0.8, cold: 1.6, hazard: "cold", name: ["ไททัน ดวงจันทร์ของดาวเสาร์", "Titan, moon of Saturn", "土卫六（泰坦）"], note: ["แสงแดดเกือบไม่มี หนาวจัด แต่มีน้ำแข็งและมีเทนมหาศาล", "Almost no sun and bitter cold, but ice and methane everywhere", "几乎没有阳光且极寒，但冰和甲烷遍地"], hz: ["ความหนาวจัดเข้าครอบงำ — ใช้พลังงานทำความร้อนเพิ่ม", "A deep freeze — heating eats extra power", "严寒来袭——取暖额外耗电"] },
  proxima: { icon: "⭐", target: 110, sun: 1.4, water: 1.0, ore: 1.7, cold: 1.0, hazard: "flare", name: ["พร็อกซิมา เซนทอรี b", "Proxima Centauri b", "比邻星 b"], note: ["แร่ล้ำค่า แดดแรง แต่ดาวแม่ปล่อยแฟลร์ใส่ทุกเมื่อ", "Rich ore and strong light, but the red dwarf keeps flaring", "矿藏丰富、光照强，但这颗红矮星不断耀发"], hz: ["แฟลร์จากดาวแม่ — ไฟดับและออกซิเจนรั่ว", "A stellar flare — power drops and oxygen leaks", "恒星耀发——电力下降，氧气泄漏"] },
};

type B = { id: string; icon: string; name: L3; cost: number; needSci?: number; text: L3 };
const BUILD: B[] = [
  { id: "hab", icon: "🏠", name: ["ที่พักอาศัย", "Habitat", "居住舱"], cost: 40, text: ["รองรับ 6 คน", "Houses 6 people", "可住 6 人"] },
  { id: "solar", icon: "☀", name: ["แผงโซลาร์", "Solar farm", "太阳能场"], cost: 30, text: ["ผลิตไฟตามแสงของดาวนั้น", "Power from the local sun", "按当地光照发电"] },
  { id: "water", icon: "💧", name: ["เครื่องสกัดน้ำ", "Ice extractor", "冰水提取器"], cost: 35, text: ["สกัดน้ำจากน้ำแข็ง (บนช่องน้ำแข็งได้สองเท่า)", "Water from ice (double on an ice plot)", "从冰中取水（冰地翻倍）"] },
  { id: "oxy", icon: "🫧", name: ["เครื่องผลิตออกซิเจน", "Oxygen plant", "制氧厂"], cost: 35, text: ["แยกน้ำเป็นออกซิเจน", "Splits water into oxygen", "电解水制氧"] },
  { id: "farm", icon: "🌱", name: ["ฟาร์มในโดม", "Dome farm", "穹顶农场"], cost: 45, text: ["อาหาร + ออกซิเจนเล็กน้อย", "Food and a little oxygen", "产出食物和少量氧气"] },
  { id: "mine", icon: "⛏", name: ["เหมือง", "Mine", "矿场"], cost: 40, text: ["ได้วัสดุก่อสร้าง (ช่องแร่ได้สองเท่า)", "Building materials (double on an ore plot)", "产出建材（矿地翻倍）"] },
  { id: "lab", icon: "🔬", name: ["ห้องวิจัย", "Research lab", "研究所"], cost: 60, text: ["ได้แต้มวิจัย ไว้ปลดล็อกเทคโนโลยี", "Research points for new tech", "产出研究点数以解锁科技"] },
  { id: "med", icon: "🏥", name: ["โรงพยาบาล", "Clinic", "医院"], cost: 70, needSci: 10, text: ["คนเพิ่มเร็วขึ้น และไม่มีใครล้มป่วยตอนขาดแคลน", "Faster growth, fewer losses in a shortage", "人口增长更快，短缺时损失更少"] },
  { id: "reactor", icon: "⚛", name: ["เครื่องปฏิกรณ์ฟิวชัน", "Fusion reactor", "聚变反应堆"], cost: 90, needSci: 25, text: ["ไฟฟ้าแรงและคงที่ ไม่ขึ้นกับแสงแดด", "Strong, steady power, no sun needed", "强大稳定的电力，不依赖阳光"] },
  { id: "port", icon: "🚀", name: ["ท่าอวกาศ", "Spaceport", "太空港"], cost: 100, needSci: 15, text: ["ทุก 20 วินาทีมียานนำผู้อพยพและวัสดุมาส่ง", "Every 20 s a ship brings settlers and materials", "每 20 秒运来移民和建材"] },
];
export const CAREERS: { id: string; icon: string; name: L3; text: L3 }[] = [
  { id: "eng", icon: "🛠", name: ["วิศวกร", "Engineer", "工程师"], text: ["ก่อสร้างถูกลง 20% แผงโซลาร์แรงขึ้น 15%", "Buildings cost 20% less, solar +15%", "建造便宜 20%，太阳能 +15%"] },
  { id: "farm", icon: "🧑‍🌾", name: ["เกษตรกรอวกาศ", "Space farmer", "太空农夫"], text: ["ฟาร์มได้อาหารมากขึ้น 35%", "Farms make 35% more food", "农场产量 +35%"] },
  { id: "miner", icon: "⛑", name: ["นักขุดแร่", "Miner", "矿工"], text: ["เหมืองได้วัสดุมากขึ้น 35%", "Mines make 35% more material", "矿场产量 +35%"] },
  { id: "sci", icon: "🧑‍🔬", name: ["นักวิทยาศาสตร์", "Scientist", "科学家"], text: ["ห้องวิจัยได้แต้มมากขึ้นสองเท่า", "Labs make double research", "研究所产出翻倍"] },
  { id: "medic", icon: "🧑‍⚕️", name: ["แพทย์", "Medic", "医生"], text: ["คนเพิ่มเร็วขึ้น 30% ไม่มีใครป่วยเพราะขาดแคลนเล็กน้อย", "Colony grows 30% faster and shrugs off brief shortages", "人口增长 +30%，轻微短缺不致损失"] },
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

const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const careerNow = () => { try { return localStorage.getItem("tg_adv_career") || ""; } catch (e) { return ""; } };

export default function AdventureColony({ P, lang, onWin, onExit, onRetry }: any) {
  const site: Site = SITES[P.kind] || SITES.moon, t = (a: string, b: string, c: string) => T3(lang, a, b, c);
  const G = useRef<any>(null);
  if (!G.current) {
    const r = rng(P.kind === "mars" ? 7 : P.kind === "titan" ? 13 : P.kind === "proxima" ? 29 : 3), grid: any[] = Array.from({ length: CELLS }, () => ({ b: null as any, f: "" }));
    for (let i = 0; i < 7; i++) { const c = Math.floor(r() * CELLS); if (!grid[c].f) grid[c].f = "ice"; }
    for (let i = 0; i < 7; i++) { const c = Math.floor(r() * CELLS); if (!grid[c].f) grid[c].f = "ore"; }
    grid[COLS * 2 + 2].b = "hab"; grid[COLS * 2 + 3].b = "solar"; grid[COLS * 2 + 2].f = ""; grid[COLS * 2 + 3].f = "";
    G.current = { t: 0, grid, stock: { en: 40, wa: 70, ox: 70, fo: 70, ma: 150, sc: 0 }, rate: { en: 0, wa: 0, ox: 0, fo: 0, ma: 0, sc: 0 }, pop: 8, grow: 0, tech: [false, false, false], hz: 0, hzT: 40, portT: 12, sel: "hab" as string, ended: false, won: false, short: 0, msg: "", peak: 8, days: 0 };
  }
  const [career, setCareer] = useState<string>(() => careerNow()), [, setTick] = useState(0), [gear, setGear] = useState(false), pausedRef = useRef(false);
  const [high, setHigh] = useState(() => { try { return localStorage.getItem("tg_adv_gfx") === "high"; } catch (e) { return false; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("tg_adv_music") !== "0"; } catch (e) { return true; } });
  const sfxRef = useRef<any>(null), musRef = useRef<any>(null), careerRef = useRef(career); careerRef.current = career;
  const cost = (b: B) => Math.round(b.cost * (careerRef.current === "eng" ? 0.8 : 1));
  useEffect(() => {
    const sfx = createAdvSfx(); sfxRef.current = sfx; sfx.setOn(musicOn); const mus = createAdvMusic(P.id); musRef.current = mus; if (mus) { mus.setOn(musicOn); mus.start(); mus.setIntensity && mus.setIntensity(1); }
    const S = G.current; let last = performance.now();
    const step = (dt: number) => {
      const cr = careerRef.current;
      let sunMul = site.sun * (cr === "eng" ? 1.15 : 1) * (S.tech[2] ? 1.4 : 1), coldMul = 1, oxLeak = 0;
      if (S.hz > 0) { if (site.hazard === "night") sunMul *= 0.15; else if (site.hazard === "dust") sunMul *= 0.35; else if (site.hazard === "cold") coldMul = 1.5; else if (site.hazard === "flare") { sunMul *= 0.4; oxLeak = 0.5; } }
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
          else if (c.b === "lab") { R.sc += 0.5 * (cr === "sci" ? 2 : 1); R.en -= 0.5; }
          else if (c.b === "med") R.en -= 0.4;
          else if (c.b === "port") R.en -= 0.8;
        }
      }
      const p = S.pop, wm = S.tech[0] ? 0.7 : 1;
      R.ox -= p * 0.05; R.wa -= p * 0.04 * wm; R.fo -= p * 0.05; R.en -= p * 0.06 * coldMul; R.ox -= oxLeak;
      for (const k of Object.keys(R)) { S.rate[k] = R[k as keyof typeof R]; S.stock[k] = Math.max(0, Math.min(k === "ma" || k === "sc" ? 9999 : 400, S.stock[k] + R[k as keyof typeof R] * dt)); }
      const med = S.grid.some((c: any) => c.b === "med");
      const need = ["en", "wa", "ox", "fo"].filter(k => S.stock[k] <= 0.01);
      if (need.length) { S.short += dt; if (S.short > (cr === "medic" || med ? 6 : 3) && S.pop > 2) { S.pop = Math.max(0, S.pop - (med ? 0.15 : 0.3) * dt); } S.msg = need.map(k => RES.find(r => r.k === k)!.icon).join(" "); }
      else { S.short = Math.max(0, S.short - dt * 2); S.msg = "";
        const free = homes - S.pop, ok = ["en", "wa", "ox", "fo"].every(k => S.stock[k] > 12);
        if (free > 0.5 && ok) { S.grow += dt * (0.14 + (med ? 0.06 : 0)) * (cr === "medic" ? 1.3 : 1); if (S.grow >= 1) { const n = Math.min(Math.floor(S.grow), Math.floor(free)); S.pop += n; S.grow -= n; } }
      }
      S.peak = Math.max(S.peak, S.pop);
      S.hzT -= dt; if (S.hz > 0) S.hz = Math.max(0, S.hz - dt); else if (S.hzT <= 0) { S.hz = HZ_DUR; S.hzT = 42 + Math.random() * 14; sfx.play("hurt"); }
      if (S.grid.some((c: any) => c.b === "port")) { S.portT -= dt; if (S.portT <= 0) { S.portT = 20; const room = Math.max(0, Math.floor(homes - S.pop)); const add = Math.min(3, room); S.pop += add; S.stock.ma += 20; sfx.play("pickup"); } }
    };
    const id = setInterval(() => {
      const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (pausedRef.current || S.ended) return;
      S.t += dt; S.days = Math.floor(S.t / DAY); step(dt);
      if (S.pop >= site.target && !S.won && ["en", "wa", "ox", "fo"].every(k => S.stock[k] > 5)) { S.won = true; S.ended = true; sfx.play("win"); const stars = S.days <= 150 ? 3 : S.days <= 220 ? 2 : 1; setTimeout(() => onWin({ colony: { pop: Math.round(S.pop), target: site.target, days: S.days, stars, kind: P.kind, career: careerRef.current }, kills: 0, cry: 10 + 4 * stars, loot: {}, mode: "colony" }), 2200); }
      else if (S.pop < 1 && !S.ended) { S.ended = true; sfx.play("hurt"); }
      setTick(x => (x + 1) % 1e6);
    }, 100);
    (window as any).__advColony = { state: () => ({ t: S.t, pop: S.pop, stock: { ...S.stock }, rate: { ...S.rate }, grid: S.grid.map((c: any) => c.b), tech: S.tech.slice(), hz: S.hz, won: S.won, ended: S.ended, target: site.target, career: careerRef.current }), setCareer: (c: string) => { careerRef.current = c; setCareer(c); }, give: (k: string, n: number) => { S.stock[k] += n; }, setPop: (n: number) => { S.pop = n; }, tick: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.1); i++) { S.t += 0.1; step(0.1); } }, hazard: () => { S.hz = HZ_DUR; }, finish: () => { S.pop = site.target; for (const k of ["en", "wa", "ox", "fo"]) S.stock[k] = 200; } };
    return () => { clearInterval(id); if (mus) mus.stop(); sfx.close(); try { delete (window as any).__advColony; } catch (e) {} };
  }, []);
  const S = G.current;
  const play = (n: string) => sfxRef.current && sfxRef.current.play(n);
  const tapCell = (i: number) => {
    if (S.ended || !career) return; const c = S.grid[i];
    if (c.b) { if (c.b === "hab" && S.grid.filter((q: any) => q.b === "hab").length * 6 - 6 < S.pop) { play("hurt"); return; } const bd = BUILD.find(b => b.id === c.b)!; S.stock.ma += Math.round(cost(bd) * 0.5); c.b = null; play("boom"); setTick(x => x + 1); return; }
    const bd = BUILD.find(b => b.id === S.sel)!; if (!bd) return;
    if ((bd.needSci || 0) > S.stock.sc) { play("hurt"); return; }
    const cs = cost(bd); if (S.stock.ma < cs) { play("hurt"); return; }
    S.stock.ma -= cs; c.b = bd.id; play("pop"); setTick(x => x + 1);
  };
  const buyTech = (i: number) => { const tc = TECH[i]; if (S.tech[i] || S.stock.sc < tc.cost || S.ended) return; S.stock.sc -= tc.cost; S.tech[i] = true; play("win"); setTick(x => x + 1); };
  const pickCareer = (id: string) => { try { localStorage.setItem("tg_adv_career", id); } catch (e) {} setCareer(id); play("pickup"); };
  const openGear = () => { pausedRef.current = true; setGear(true); }, closeGear = () => { pausedRef.current = false; setGear(false); };
  const pct = Math.min(100, S.pop / site.target * 100), homes = S.grid.filter((c: any) => c.b === "hab").length * 6, fact = FACTS[Math.floor(S.t / 20) % FACTS.length];
  return (
    <div className="adv-farm adv-colony" data-colony={P.kind}>
      <div className="adv-top">
        <button className="adv-btn" onClick={() => onExit()} aria-label="map">←</button>
        <div className="adv-hud">
          <div className="adv-lv">{site.icon} {T3(lang, site.name[0], site.name[1], site.name[2])} · {t("วันที่ ", "Day ", "第 ")}{S.days}{lang === "zh" ? " 天" : ""} · 👥 {Math.floor(S.pop)}/{homes} {t("ที่พัก", "homes", "住房")}</div>
          <div className="adv-bar adv-hp"><i style={{ width: pct + "%" }} /><b>{t("ประชากร ", "Population ", "人口 ")}{Math.floor(S.pop)}/{site.target}</b></div>
        </div>
        <GearButton onClick={openGear} />
      </div>
      <div className="ac2-res">
        {RES.map(r => (<span key={r.k} className={"ac2-r" + (S.stock[r.k] <= 0.5 && r.k !== "sc" && r.k !== "ma" ? " low" : "")} data-res={r.k}>{r.icon} {Math.floor(S.stock[r.k])}<small className={S.rate[r.k] < -0.01 ? "neg" : ""}>{S.rate[r.k] >= 0 ? "+" : ""}{S.rate[r.k].toFixed(1)}</small></span>))}
        {S.hz > 0 && <span className="ac2-hz" data-hazard="1">⚠ {T3(lang, site.hz[0], site.hz[1], site.hz[2])}</span>}
        {S.msg && <span className="ac2-hz">⚠ {t("ขาดแคลน ", "Shortage ", "短缺 ")}{S.msg}</span>}
      </div>
      <div className="ac2-grid">
        {S.grid.map((c: any, i: number) => { const bd = c.b ? BUILD.find(b => b.id === c.b) : null; return (
          <button key={i} className={"ac2-cell" + (bd ? " has" : "") + (c.f ? " " + c.f : "")} data-cell={i} data-b={c.b || ""} onClick={() => tapCell(i)} aria-label={bd ? T3(lang, bd.name[0], bd.name[1], bd.name[2]) : "plot"}>
            {bd ? <span>{bd.icon}</span> : <em>{c.f === "ice" ? "❄" : c.f === "ore" ? "◆" : ""}</em>}
          </button>); })}
      </div>
      <div className="ac2-build">
        {BUILD.map(b => { const locked = (b.needSci || 0) > S.stock.sc, cs = cost(b); return (
          <button key={b.id} className={"ac2-b" + (S.sel === b.id ? " on" : "") + (locked ? " lock" : S.stock.ma < cs ? " poor" : "")} data-build={b.id} onClick={() => { S.sel = b.id; setTick(x => x + 1); }}>
            <b>{b.icon} {T3(lang, b.name[0], b.name[1], b.name[2])}</b><small>🧱 {cs}{locked ? " · 🔒 " + b.needSci + "🔬" : ""}</small></button>); })}
      </div>
      <div className="ac2-sel">{(() => { const b = BUILD.find(q => q.id === S.sel); return b ? <span>{b.icon} {T3(lang, b.text[0], b.text[1], b.text[2])}</span> : null; })()} <em>{t("แตะช่องว่างเพื่อสร้าง แตะอาคารเพื่อรื้อ (ได้วัสดุคืนครึ่งหนึ่ง)", "Tap an empty plot to build, a building to demolish (half back)", "点空地建造，点建筑拆除（返还一半）")}</em></div>
      <div className="af-tech">
        {TECH.map((tc, i) => (<button key={tc.id} className={"af-t" + (S.tech[i] ? " on" : "")} data-tech={i} disabled={S.tech[i] || S.stock.sc < tc.cost} onClick={() => buyTech(i)}>
          <b>{T3(lang, tc.name[0], tc.name[1], tc.name[2])}</b><small>{S.tech[i] ? "✓ " : "🔬 " + tc.cost + " · "}{T3(lang, tc.text[0], tc.text[1], tc.text[2])}</small></button>))}
      </div>
      <div className="af-fact">💡 {T3(lang, site.note[0], site.note[1], site.note[2])} · {T3(lang, fact[0], fact[1], fact[2])}</div>
      {!career && (<div className="adv-quiz" data-careers="1" style={{ alignItems: "center" }} onPointerDown={(e) => e.stopPropagation()}><div className="pvpstandby-card" style={{ maxWidth: 460 }}>
        <b>{t("เลือกสายอาชีพของคุณ", "Choose your career", "选择你的职业")}</b>
        <small>{t("ในห้องออนไลน์ แต่ละคนจะถืออาชีพของตัวเอง ทุกอาชีพเสริมกันและกัน", "Online, every pilot holds a career of their own and they cover each other's weak spots", "联机时每位玩家各担一职，互补长短")}</small>
        <div className="af-pick">{CAREERS.map(c => (<button key={c.id} className="adv-btn" data-career={c.id} onClick={() => pickCareer(c.id)}>{c.icon} {T3(lang, c.name[0], c.name[1], c.name[2])}<small>{T3(lang, c.text[0], c.text[1], c.text[2])}</small></button>))}</div>
      </div></div>)}
      {S.ended && !S.won && (<div className="adv-clear" role="dialog" aria-label="colony lost"><b>{t("อาณานิคมล่มสลาย", "The colony collapsed", "殖民地崩溃了")}</b><span>{t("ประชากรสูงสุด ", "Peak population ", "人口峰值 ")}{Math.floor(S.peak)}/{site.target}</span>
        <div className="adv-clear-btns"><button className="adv-btn go" onClick={() => onRetry && onRetry()}>↻ {t("ลองใหม่", "Retry", "重试")}</button><button className="adv-btn" onClick={() => onExit()}>{t("เมนูแผนที่", "Map menu", "地图菜单")}</button></div></div>)}
      {S.won && <div className="adv-clear" role="status"><b>🏙 {t("อาณานิคมเติบโตสำเร็จ!", "The colony thrives!", "殖民地繁荣兴旺！")}</b></div>}
      {gear && <SettingsPopup lang={lang} high={high} onGfx={() => { const n = !high; setHigh(n); try { localStorage.setItem("tg_adv_gfx", n ? "high" : "standard"); } catch (e) {} }} musicOn={musicOn} onMusic={() => setMusicOn(m => { const n = !m; try { localStorage.setItem("tg_adv_music", n ? "1" : "0"); } catch (e) {} if (musRef.current && musRef.current.setOn) musRef.current.setOn(n); if (sfxRef.current) sfxRef.current.setOn(n); return n; })} online={false} onResume={closeGear} onExit={() => { pausedRef.current = false; onExit(); }} />}
    </div>
  );
}
