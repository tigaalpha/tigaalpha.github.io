/* Robot Adventure 3D (plan 39): the 3D levels and their story lines. Pure data (no three.js, no DOM). A level is an ah-levels `Level` that the Alien Hunt engine and renderer
   play with `kit: "jungle"`; the story text is the Adventure text of the same planet (BRIEF in adventure.tsx), the radio lines are short and in th / en / zh. Only Luma is built so far. */
import type { Level } from "./ah-levels";
import type { Box, AlienKind } from "./ah-engine";
import { RA_PLANETS } from "./ra-planets";

const W = (spec: string): AlienKind[] => spec.split(",").flatMap(p => { const [k, n] = p.split("*"); return Array.from({ length: n ? parseInt(n, 10) : 1 }, () => k as AlienKind); });
const B = (x: number, z: number, w: number, d: number, h: number): Box => ({ x, z, w, d, h });

export type Tri = [string, string, string];
export type RaRadio = { wave: number; line: Tri };
export type RaLevel = { id: string; level: Level; brief: Tri; radio: RaRadio[]; win: Tri };

/** Luma, the glowing jungle: boulders and fallen trunks to fight round, four waves, the Luma Warden at the end */
const LUMA: Level = {
  id: 1, name: ["ลูมา · ดาวป่าเรืองแสง", "Luma · the glowing jungle", "卢玛 · 荧光丛林"], race: ["สัตว์ป่าเรืองแสงแห่งลูมา", "The creatures of Luma", "卢玛的荧光生物"],
  blurb: ["เคลียร์ป่าเรืองแสงก่อนที่มนุษย์จะย้ายเข้ามา", "Clear the glowing jungle before any human settles.", "在人类入住前清理荧光丛林。"],
  tint: 0x5affc8, hpk: 1, kit: "jungle", guns: ["rifle", "shotgun", "laser"], hazards: [], boss: "lumawarden",
  waves: [W("glowbug*3"), W("glowbug*4,hound*2"), W("thornback*2,sporecaster*2,glowbug*3"), W("lumawarden,glowbug*3,hound*2")],
  boxes: [B(-9, -5, 4.4, 2.4, 1.5), B(10, -8, 2.6, 5, 1.6), B(-1, 9, 6, 1.8, 1.3), B(-16, 8, 3, 3, 2.8), B(16, 7, 3, 3, 2.8), B(-4, -18, 8, 1.6, 1.3), B(21, -17, 3.4, 3.4, 2.2), B(-22, -15, 3.4, 3.4, 2.2), B(5, 19, 3, 2, 1.4), B(-14, 21, 5, 1.8, 1.4), B(0, -8, 2, 2, 2.4)],
  theme: { sky: ["#03131a", "#06382f", "#1f9a78", "#0a1a18"], fog: 0x07241f, fogD: 0.017, ground: 0x8ac8a8, wall: 0x2a6a4e, hemi: [0xa8ffe4, 0x0a2a22], sun: 0xc8fff0, ring: 0x5affc8 },
};

const bossOf = (id: string): [string, string, string] => (RA_PLANETS.find(p => p.id === id) || { boss: ["", "", ""] }).boss;
const mk = (id: number, p: string, name: Tri, tint: number, hpk: number, kit: Level["kit"], guns: Level["guns"], waves: AlienKind[][], boss: AlienKind | undefined, boxes: Box[], theme: Level["theme"], hazards: Level["hazards"] = []): Level =>
  ({ id, name, race: name, blurb: name, tint, hpk, kit, guns, hazards, boss, bossName: boss ? bossOf(p) : undefined, waves, boxes, theme });
const ring = (n: number, r: number, c: number, s: number): Box[] => Array.from({ length: n }, (_, i) => B(Math.round(Math.cos(i / n * 6.283 + c) * r), Math.round(Math.sin(i / n * 6.283 + c) * r * 0.8), s + (i % 3), s + ((i + 1) % 3), 1.4 + (i % 3) * 0.7)).filter(b => Math.hypot(b.x, b.z - 22) > 6);
const FERRO = mk(2, "ferro", ["เฟอร์โร · ทะเลทรายเหล็ก", "Ferro · the iron desert", "费罗 · 钢铁沙漠"], 0xff9a4a, 1.15, "desert", ["shotgun", "arc", "pulsar"], [W("scarab*4"), W("scarab*4,stalker*2"), W("charger*2,stalker*3,drone*2"), W("warden,scarab*3,stalker*2")], "warden",
  [...ring(9, 17, 0.2, 2.6), B(0, 0, 5, 2, 2.4), B(-8, -10, 3, 3, 2.2), B(10, -4, 3, 3, 2.2)], { sky: ["#1a0d05", "#4a2410", "#b8672c", "#1c0f08"], fog: 0x3a1c0c, fogD: 0.015, ground: 0xc09a70, wall: 0x6a3a1c, hemi: [0xffc890, 0x3a1c0c], sun: 0xffc080, ring: 0xff9a4a });
const KRYO = mk(3, "kryo", ["ไครโอ · ดาวน้ำแข็งคริสตัล", "Kryo · the crystal ice", "克里奥 · 水晶冰原"], 0x7ad8ff, 1.3, "ice", ["cryo", "beam", "rail"], [W("skitter*3,wisp*2"), W("stalker*3,wisp*3"), W("behemoth,stalker*3,wisp*3"), W("warden,wisp*3,stalker*3")], "warden",
  [...ring(8, 16, 0.5, 2.2), B(0, -2, 3, 3, 3), B(-9, 8, 2.4, 2.4, 2.6), B(9, 10, 2.4, 2.4, 2.6)], { sky: ["#061427", "#123a63", "#6fc4ff", "#0a1a2a"], fog: 0x0e2c48, fogD: 0.016, ground: 0xb8d8f0, wall: 0x3a6a98, hemi: [0xcfeaff, 0x12304a], sun: 0xe0f4ff, ring: 0x7ad8ff });
const PYRA = mk(4, "pyra", ["ไพรา · เตาปฏิกรณ์ลาวา", "Pyra · the lava reactor", "派拉 · 熔岩反应堆"], 0xff6a2a, 1.45, "lava", ["storm", "nova", "launcher"], [W("stalker*3,flarecaster*2"), W("stalker*4,flarecaster*2,charger*2"), W("charger*3,flarecaster*3,behemoth,stalker*3"), W("matriarch,charger*2,stalker*4,flarecaster*2")], "matriarch",
  [B(-18, -6, 4, 4, 2.4), B(18, 8, 5, 4, 2.6), B(0, 2, 3, 3, 2.2), B(-4, -20, 5, 3, 2.4), B(22, -14, 3, 3, 2.2), B(-22, 14, 4, 3, 2.4)], { sky: ["#1c0606", "#5a1408", "#ff6a2a", "#200804"], fog: 0x4a1608, fogD: 0.017, ground: 0xb08060, wall: 0x2c1208, hemi: [0xffb070, 0x4a1608], sun: 0xffb060, ring: 0xff6a2a },
  [[-10, -2], [10, 4], [0, -14], [-8, 12], [14, -12]].map(([x, z]) => ({ x, z, r: 4, per: 8, on: 5, col: 0xff6a1a })));
const NEXA = mk(5, "nexa", ["เน็กซา · เมืองซากอวกาศ", "Nexa · the wreck city", "内克萨 · 残骸之城"], 0x9a7aff, 1.6, "ruins", ["rpg", "salvo", "rail"], [W("drone*3,wisp*3"), W("drone*4,wisp*3,stalker*2"), W("behemoth*2,drone*3,skyeye*3"), W("walker,drone*3,wisp*3,stalker*2")], "walker",
  [B(-14, -14, 4, 4, 3.4), B(14, -14, 4, 4, 3.4), B(-14, 8, 4, 4, 3.4), B(14, 8, 4, 4, 3.4), B(0, -4, 8, 1.6, 1.4), B(-26, -2, 2.6, 10, 2.4), B(26, -2, 2.6, 10, 2.4), B(0, 16, 6, 1.6, 1.4)], { sky: ["#0a0518", "#2a1250", "#9a5cff", "#0a0518"], fog: 0x1a0c34, fogD: 0.016, ground: 0x9888b0, wall: 0x2a2048, hemi: [0xd0b0ff, 0x1e1236], sun: 0xe0c8ff, ring: 0x9a7aff },
  [[-9, 0], [9, -9], [0, 11]].map(([x, z]) => ({ x, z, r: 3.4, per: 6, on: 2.4, col: 0xffe060 })));
const JOVIA: Level = { ...mk(6, "jovia", ["โจเวีย · ดาวแก๊สยักษ์", "Jovia · the gas giant", "朱维亚 · 气态巨行星"], 0xffbe6e, 1.7, "gas", ["pulsar", "nova", "storm"], [W("wisp*3,skitter*3"), W("wisp*3,stalker*3,skyeye*2"), W("wisp*4,drone*3,skyeye*2")], undefined,
  [...ring(8, 15, 0.3, 2.4), B(0, 0, 3, 3, 2.6)], { sky: ["#0d0a2a", "#3a2a7a", "#c98a4a", "#12081c"], fog: 0x1c1236, fogD: 0.016, ground: 0xb89a88, wall: 0x3a2a5a, hemi: [0xffd8a8, 0x2a1a4a], sun: 0xffd0a0, ring: 0xffbe6e }), mission: { type: "survive", secs: 90 } };
const COBALT: Level = { ...mk(7, "cobalt", ["โคบอลต์ · แถบเหมืองดาวเคราะห์น้อย", "Cobalt Belt · the asteroid mines", "钴带 · 小行星矿区"], 0x6ab0ff, 1.5, "belt", ["laser", "shotgun", "arc"], [W("skitter*3,scarab*3"), W("stalker*3,scarab*4"), W("charger*2,stalker*3,scarab*2")], undefined,
  [B(-4, -4, 3, 3, 2), B(5, 4, 3, 3, 2), B(-14, 14, 3, 3, 2.2), B(15, -14, 3, 3, 2.2), B(0, 12, 4, 2, 1.6)], { sky: ["#0a1220", "#1c3a5a", "#4a90c8", "#08101c"], fog: 0x0e2238, fogD: 0.014, ground: 0x9aa8b8, wall: 0x2a3a4c, hemi: [0xbfe0ff, 0x16283c], sun: 0xe8f4ff, ring: 0x6ab0ff }),
  mission: { type: "mine", pts: [[-10, -8], [12, -6], [-16, 6], [8, 12], [0, -18], [18, 14]] } };
const HELIOS: Level = { ...mk(8, "helios", ["เฮลิออส · ยึดดาวฤกษ์ต่างระบบ", "Helios · capture a foreign sun", "赫利俄斯 · 占领异星恒星"], 0xffc060, 1.8, "sun", ["nova", "storm", "launcher"], [W("stalker*3,flarecaster*2"), W("flarecaster*3,wisp*3,charger*2"), W("behemoth,flarecaster*3,wisp*3")], undefined,
  [...ring(7, 18, 1.1, 2.2), B(0, 2, 3, 3, 2.4)], { sky: ["#2a0a00", "#8a3a00", "#ffb030", "#200a02"], fog: 0x3a1804, fogD: 0.015, ground: 0xd0a070, wall: 0x5a2a0a, hemi: [0xffe0a0, 0x4a2008], sun: 0xffe0a0, ring: 0xffc060 }),
  mission: { type: "capture", hold: 10, pts: [[-14, -10], [14, -12], [0, 12]] } };
const ASHFALL: Level = { ...mk(9, "ashfall", ["แอชฟอลล์ · ระเบิดจากวงโคจร", "Ashfall · orbital strike", "灰烬星 · 轨道打击"], 0xdcd28c, 1.9, "ruins", ["rpg", "salvo", "rail"], [W("drone*3,scarab*3"), W("drone*4,stalker*3"), W("behemoth,drone*3,stalker*2")], "warden",
  [B(-12, 0, 3, 8, 2.4), B(12, 0, 3, 8, 2.4), B(0, -10, 8, 2, 2), B(-20, 12, 4, 4, 2.6), B(20, 12, 4, 4, 2.6)], { sky: ["#12120e", "#3a3a2a", "#8a8a5a", "#0e0e0a"], fog: 0x24241a, fogD: 0.016, ground: 0xa0a090, wall: 0x2a2a20, hemi: [0xe8e4b0, 0x26261c], sun: 0xf0ecc0, ring: 0xdcd28c }),
  mission: { type: "strike", hold: 6, pts: [[-16, -8], [16, -8], [0, -20]], boss: "warden" } };
const story = (en: Tri, w2: Tri, w3: Tri, w4: Tri, win: Tri): Pick<RaLevel, "radio" | "win"> => ({ radio: [{ wave: 2, line: w2 }, { wave: 3, line: w3 }, { wave: 4, line: w4 }], win });
export const RA_LEVELS: Record<string, RaLevel> = {
  jovia: { id: "jovia", level: JOVIA, brief: ["ดาวแก๊สยักษ์: ยืนหยัดให้ครบ 90 วินาทีจนเครื่องเก็บพลังงานเต็ม", "The gas giant: hold out for 90 seconds while the harvester fills.", "气态巨星：坚守 90 秒，直到采集器充满能量。"],
    ...story(["", "", ""], ["พายุพลังงานดึงฝูงเข้ามา ยืนหยัดต่อ", "The energy storm draws a swarm. Keep holding.", "能量风暴引来了怪群，继续坚守。"], ["ครึ่งทางแล้ว เครื่องเก็บพลังงานกำลังเต็ม", "Halfway. The harvester is filling.", "已过半，采集器正在充能。"], ["อีกนิดเดียว ห้ามถอย", "Almost there. Do not fall back.", "快好了，别后退。"], ["เครื่องเก็บพลังงานเต็มแล้ว ส่งกลับโลกได้", "The harvester is full. Energy is on its way home.", "采集器已充满，能量正送回地球。"]) },
  cobalt: { id: "cobalt", level: COBALT, brief: ["ขุดแร่ให้ครบ 6 จุด (กดปุ่ม ⛏ ใกล้ก้อนแร่) ระวังฝูงที่ตามมา", "Dig all six ore nodes (press ⛏ beside a node) while the swarm closes in.", "挖完六处矿脉（在矿点旁按 ⛏），同时抵御蜂拥而来的怪物。"],
    ...story(["", "", ""], ["เสียงสว่านดึงฝูงเข้ามา", "The drilling noise draws a swarm.", "钻探声引来了怪群。"], ["แร่ยังเหลืออีกหลายจุด ขุดต่อ", "Ore nodes remain. Keep digging.", "还有矿点没挖完，继续。"], ["ฝูงหนักมาแล้ว ขุดให้เสร็จ", "A heavy swarm is here. Finish the digging.", "重型怪群到了，把矿挖完。"], ["ขุดแร่ครบแล้ว ส่งกลับโลก", "All ore is mined. Shipping it to Earth.", "矿石已全部采完，正运回地球。"]) },
  helios: { id: "helios", level: HELIOS, brief: ["ดาวฤกษ์ต่างระบบ: ยึดสถานีเก็บพลังงานทั้งสามจุดทีละจุด (ยืนในวงให้ครบ 10 วินาที)", "A foreign sun: take its three collector stations one by one (stand in the ring for 10 seconds).", "异星恒星：逐一占领三座能量采集站（在圈内站满 10 秒）。"],
    ...story(["", "", ""], ["ฝูงมาตามพลังงาน ยึดสถานีต่อไป", "The swarm follows the energy. Take the next station.", "怪群追着能量而来，占领下一座。"], ["สถานีสุดท้ายอยู่ไม่ไกล", "The last station is close.", "最后一座就在附近。"], ["ความร้อนสูงขึ้น ใกล้ครบแล้ว", "The heat is rising. Nearly there.", "温度在升高，快完成了。"], ["สถานีทั้งสามเป็นของเราแล้ว", "All three stations are ours.", "三座采集站都已占领。"]) },
  ashfall: { id: "ashfall", level: ASHFALL, brief: ["เปิดเครื่องส่งสัญญาณ 3 จุดเพื่อเรียกระเบิดจากวงโคจร แล้วลงไปปราบผู้บัญชาการ", "Bring three uplink terminals online to call the orbital strike, then take down the commander.", "启动三座上行终端呼叫轨道打击，然后击败指挥官。"],
    ...story(["", "", ""], ["ป้อมยามกำลังตอบโต้ ปกป้องเครื่องส่งสัญญาณ", "The garrison is fighting back. Protect the terminals.", "守军正在反击，保护好终端。"], ["เหลืออีกเครื่องเดียว", "One terminal left.", "只剩一座终端了。"], ["ระเบิดจากวงโคจรกำลังตก ก้มหลบ!", "The orbital strike is coming down. Brace!", "轨道打击来了，隐蔽！"], ["ผู้บัญชาการแอชฟอลล์ล้มแล้ว ฐานเงียบสนิท", "The Ashfall Commander is down. The base is silent.", "灰烬指挥官已倒下，基地归于寂静。"]) },
  ferro: { id: "ferro", level: FERRO, brief: ["ทะเลทรายเหล็กเต็มไปด้วยสนิมและหอแม่เหล็ก — เปิดทางให้รถขุดแร่", "The iron desert: rust and magnet pylons stand between the miners and the ore.", "钢铁沙漠：锈虫与磁力塔挡住了采矿队。"],
    ...story(["", "", ""], ["ฝูงสนิมโผล่จากทราย ระวังรอบตัว", "Rust swarms break out of the sand. Watch all around.", "锈虫从沙中涌出，小心四周。"], ["เครื่องจักรหนักกำลังมา", "Heavy machines inbound.", "重型机械正在逼近。"], ["ผู้พิทักษ์เหล็กตื่นแล้ว", "The Iron Warden is awake.", "钢铁守卫醒了。"], ["ทะเลทรายเหล็กปลอดภัย รถขุดแร่เข้าได้แล้ว", "The desert is clear. The miners can move in.", "沙漠已清理，采矿队可以进驻。"]) },
  kryo: { id: "kryo", level: KRYO, brief: ["ดาวน้ำแข็ง: ผู้พิทักษ์ผลึกขวางทางสู่แหล่งน้ำสำหรับอาณานิคม", "The ice world: a crystal warden guards the colony's water.", "冰封星球：水晶守卫看守着殖民地的水源。"],
    ...story(["", "", ""], ["วิญญาณน้ำแข็งลอยมาตามลมหนาว", "Ice spirits drift in on the cold wind.", "冰灵随寒风飘来。"], ["ยักษ์น้ำแข็งเดินมาแล้ว ใช้ปืนเยือกแข็งชะลอมัน", "An ice giant approaches. Slow it with the cryo gun.", "冰巨人逼近，用冷冻枪减速它。"], ["ผู้พิทักษ์ผลึกขวางทางอยู่", "The Frost Warden bars the way.", "冰霜守卫拦住了去路。"], ["แหล่งน้ำปลอดภัย อาณานิคมมีน้ำใช้แล้ว", "The water is safe. The colony will have its supply.", "水源安全，殖民地有水用了。"]) },
  pyra: { id: "pyra", level: PYRA, brief: ["เตาปฏิกรณ์ลาวา: ข้ามบ่อลาวาไปปิดแกนที่กำลังเดือด", "The lava reactor: cross the lava pools and shut down the boiling core.", "熔岩反应堆：越过熔岩池，关闭沸腾的核心。"],
    ...story(["", "", ""], ["บ่อลาวาเปิดเป็นจังหวะ อย่ายืนบนวงแดง", "The lava pools pulse. Never stand on the red rings.", "熔岩池会周期性喷发，别站在红圈上。"], ["ผู้ปล่อยเปลวไฟอยู่บนสันเขา", "Flame casters on the ridge.", "山脊上有烈焰施法者。"], ["แกนเตาปฏิกรณ์ส่งสัญญาณ ผู้พิทักษ์แกนลาวามาแล้ว", "The core signals: the Core Warden is here.", "核心发出信号：熔核守卫来了。"], ["แกนปลอดภัย เตาปฏิกรณ์เย็นลงแล้ว", "The core is shut down. The reactor is cooling.", "核心已关闭，反应堆正在冷却。"]) },
  nexa: { id: "nexa", level: NEXA, brief: ["เมืองซากอวกาศ: เจ้าหน้าที่ควบคุมสุดท้ายยังรออยู่ — ระวังแผ่นไฟฟ้า", "The wreck city: the last overseer waits. Mind the shock plates.", "残骸之城：最后的监管者在等候，小心电击板。"],
    ...story(["", "", ""], ["โดรนรบลอยมาจากซาก ระวังแผ่นไฟฟ้าใต้เท้า", "War drones rise from the wrecks. Mind the shock plates underfoot.", "战斗无人机从残骸中升起，小心脚下的电击板。"], ["เครื่องจักรขนาดใหญ่ตื่นแล้ว", "The big machines are awake.", "大型机器已苏醒。"], ["จอมคุมแห่งเน็กซาออกมาแล้ว", "The Nexa Overseer has come out.", "内克萨监管者现身了。"], ["เมืองซากอวกาศเงียบแล้ว เส้นทางเปิดแล้ว", "The wreck city is quiet. The road is open.", "残骸之城归于平静，道路开启。"]) },
  luma: {
    id: "luma", level: LUMA,
    brief: ["ภารกิจหุ่นยนต์บุกเบิก: เคลียร์ป่าเรืองแสงก่อนที่มนุษย์จะย้ายเข้ามา", "Pioneer unit: clear the glowing jungle before any human settles.", "先遣机器人：在人类入住前清理荧光丛林。"],
    radio: [
      { wave: 2, line: ["สัญญาณชีวภาพพุ่งสูง ฝูงเงาออกล่าแล้ว", "Bio-signals spiking: shadow hounds are hunting.", "生物信号激增：暗影猎犬出动了。"] },
      { wave: 3, line: ["เห็ดเดินได้ข้างหน้า ระวังลูกสปอร์", "Walking mushrooms ahead. Watch the spore balls.", "前方有会走的蘑菇，小心孢子球。"] },
      { wave: 4, line: ["สัญญาณมหึมา… ผู้พิทักษ์ลูมาตื่นแล้ว", "Massive signal… the Luma Warden has woken.", "巨大信号……卢玛守卫醒了。"] },
    ],
    win: ["ป่าลูมาปลอดภัยแล้ว ยานบุกเบิกรายงาน: เส้นทางสู่ดาวดวงต่อไปเปิดแล้ว", "Luma is clear. Pioneer reporting: the road to the next world is open.", "卢玛已清理。先遣机器人报告：通往下一个世界的道路已开启。"],
  },
};
/** the maps that exist in 3D so far */
export const RA_PLAYABLE: string[] = RA_PLANETS.map(p => p.id).filter(id => RA_LEVELS[id]);
