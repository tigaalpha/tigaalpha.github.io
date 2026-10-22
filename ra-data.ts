/* Robot Adventure 3D (plan 39): the 3D levels and their story lines. Pure data (no three.js, no DOM). A level is an ah-levels `Level` that the Alien Hunt engine and renderer
   play with `kit: "jungle"`; the story text is the Adventure text of the same planet (BRIEF in adventure.tsx), the radio lines are short and in th / en / zh. Only Luma is built so far. */
import type { Level } from "./ah-levels";
import type { Box, AlienKind } from "./ah-engine";

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

export const RA_LEVELS: Record<string, RaLevel> = {
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
export const RA_PLAYABLE: string[] = Object.keys(RA_LEVELS);
