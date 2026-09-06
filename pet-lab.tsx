/* ── pet-lab.tsx ──
   A digital pet you keep alive between practice sessions, and that fights
   beside your chassis in the arena.

   The creatures are ORIGINAL. The brief named Digimon and Pokémon as the
   feeling to aim for, and that is what they are aimed at — pocket monsters
   with a cyborg build — but they are not those characters and none of them is
   a redraw of one: those are somebody else's, and shipping copies of them in
   a paid app is not a thing to do to a customer. What is borrowed is the
   GENRE: a small creature with a strong silhouette, a type, a favourite food,
   and a body that changes as it grows.

   Twelve species from a parts system rather than twelve hand-drawn creatures.
   A build, a head, an ear, a tail, an eye and a palette combine into something
   reads as its own animal, every one of them lit by the same rig as the
   robots and the gear, so a pet standing next to a chassis looks like it came
   out of the same workshop. Hand-drawing twelve would have been twelve
   chances to drift.

   Care is time-based and computed from a timestamp, so it runs while the app
   is closed: hunger, cleanliness, coat and mood all fall, mess accumulates on
   the floor when cleanliness does, and every one of them is something you fix
   by doing the thing it is named after. ── */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { ItemArt } from "./item-art";

/* ══════════════════════ species ══════════════════════ */

/* ── the type wheel ──
   Six elements had been declared since the pets shipped, each with a name in
   three languages and a colour, and not one of them ever decided anything: the
   type was a label on a card. It is a ring now — each element beats exactly one
   and loses to exactly one, so every pet is strong somewhere and soft somewhere
   and which one you bring is a choice rather than a skin.

     ember burns flora · flora cracks steel · steel earths volt
     volt scrambles aether · aether slips past frost · frost quenches ember */
export const TYPE_BEATS = {
  ember: "flora", flora: "steel", steel: "volt",
  volt: "aether", aether: "frost", frost: "ember",
};
/** 1 = a beats b · -1 = b beats a · 0 = neither. */
export function typeMatchup(a, b) {
  if (!a || !b || a === b) return 0;
  if (TYPE_BEATS[a] === b) return 1;
  if (TYPE_BEATS[b] === a) return -1;
  return 0;
}
/** What a type's command does when you send the pet in. */
export const TYPE_CMD = {
  volt:   { k: "stagger", th: "ช็อต",     en: "Jolt",    zh: "电击" },
  ember:  { k: "burn",    th: "เผา",      en: "Scorch",  zh: "灼烧" },
  frost:  { k: "slow",    th: "แช่แข็ง",  en: "Chill",   zh: "冰缓" },
  flora:  { k: "heal",    th: "ฟื้นฟู",   en: "Bloom",   zh: "回复" },
  steel:  { k: "guard",   th: "ตั้งเกราะ", en: "Bulwark", zh: "护盾" },
  aether: { k: "gauge",   th: "อัดพลัง",  en: "Surge",   zh: "充能" },
};

export const PET_TYPES = {
  volt:  { th: "สายไฟฟ้า", en: "Volt",  zh: "电元", c: "#ffd23f" },
  ember: { th: "สายเพลิง", en: "Ember", zh: "焰元", c: "#ff7a3c" },
  frost: { th: "สายน้ำแข็ง", en: "Frost", zh: "霜元", c: "#5ce1ff" },
  flora: { th: "สายพฤกษา", en: "Flora", zh: "草元", c: "#3ddc84" },
  steel: { th: "สายเหล็ก", en: "Steel", zh: "钢元", c: "#8fa6c8" },
  aether:{ th: "สายอีเธอร์", en: "Aether", zh: "以太", c: "#a86bff" },
};

/* build · head · ear · tail · eye · palette — six slots, twelve animals.
   `build` is the silhouette you recognise across a room; the rest is detail. */
export const PET_SPECIES = [
  { id: "sparkit", pw: 1.0, ph: 1.0, phr: 1.0,  code: "PT-01", type: "volt", look: "cute",  build: "biped", head: "round",  ear: "bolt",  tail: "spark", eye: "big", mark: "star",
    sw: ["#ffe14d", "#4c4000"], food: "pf-cell",
    th: "สปาร์คกิต", en: "Sparkit", zh: "电火兽", bonus: "dmg",
    dth: "ลูกไฟฟ้าจอมซน ชอบชาร์จตัวเองจนขนลุก", den: "A restless little charge that fluffs up when it powers on.", dzh: "顽皮的小电球，充能时全身炸毛。" },
  { id: "cindra", pw: 1.08, ph: 0.94, phr: 0.96,   code: "PT-02", type: "ember", look: "cool", build: "quad", head: "sharp",    ear: "horn",  tail: "flame", eye: "sharp", mark: "flame",
    sw: ["#ff8a4c", "#4c1a00"], food: "pf-coal",
    th: "ซินดร้า", en: "Cindra", zh: "炽焰兽", bonus: "dmg",
    dth: "แมวเครื่องยนต์ หายใจเป็นไอร้อน", den: "An engine-cat that breathes warm exhaust when happy.", dzh: "引擎猫，开心时呼出热气。" },
  { id: "nimbo", pw: 0.9, ph: 1.06, phr: 1.1,    code: "PT-03", type: "frost", look: "cute", build: "float", head: "round",   ear: "fin",   tail: "wisp",  eye: "sleepy", mark: "patch",
    sw: ["#8fe8ff", "#003d4c"], food: "pf-ice",
    th: "นิมโบ", en: "Nimbo", zh: "霜云兽", bonus: "guard",
    dth: "ก้อนเมฆเย็นที่ลอยตามเจ้าของไปทุกที่", den: "A cold little cloud that drifts wherever you go.", dzh: "冷冷的小云，总跟着主人飘。" },
  { id: "verdle", pw: 0.94, ph: 1.02, phr: 1.04,   code: "PT-04", type: "flora", look: "cute", build: "biped", head: "blob",  ear: "leaf",  tail: "vine",  eye: "big", mark: "spots",
    sw: ["#6fe39b", "#0b4120"], food: "pf-seed",
    th: "เวิร์ดเดิ้ล", en: "Verdle", zh: "苗芽兽", bonus: "heal",
    dth: "ต้นกล้าไซเบอร์ที่งอกใบใหม่ทุกครั้งที่ถูกชม", den: "A cyber-sprout that grows a new leaf every time it is praised.", dzh: "赛博幼苗，被夸奖就长新叶。" },
  { id: "bolton", pw: 1.14, ph: 0.9, phr: 0.9,   code: "PT-05", type: "steel", look: "cool", build: "biped", head: "boxy",   ear: "bolt",  tail: "gear",  eye: "visor", mark: "band",
    sw: ["#b8c2d4", "#253146"], food: "pf-bolt",
    th: "โบลตัน", en: "Bolton", zh: "螺钉兽", bonus: "guard",
    dth: "หุ่นเหลี่ยมใจดี ชอบให้ขัดเงาให้เงาวับ", den: "A blocky, good-natured thing that lives to be polished.", dzh: "方方正正的好脾气，最爱被擦亮。" },
  { id: "lumen", pw: 0.88, ph: 1.08, phr: 1.08,    code: "PT-06", type: "aether", look: "cute",build: "float", head: "blob",   ear: "halo",  tail: "wisp",  eye: "starry", mark: "star",
    sw: ["#c7a6ff", "#1c004c"], food: "pf-prism",
    th: "ลูเมน", en: "Lumen", zh: "流光兽", bonus: "sp",
    dth: "แสงที่จับตัวเป็นก้อน เรืองขึ้นเมื่ออารมณ์ดี", den: "Light that decided to become a body. It glows when it is content.", dzh: "凝成实体的光，心情好时会发亮。" },
  { id: "zapaw", pw: 1.02, ph: 0.98, phr: 1.02,    code: "PT-07", type: "volt", look: "cool",  build: "quad", head: "sharp",    ear: "fin",   tail: "spark", eye: "sharp", mark: "stripe",
    sw: ["#ffc23d", "#4c3400"], food: "pf-cell",
    th: "แซปพอว์", en: "Zapaw", zh: "雷爪兽", bonus: "dmg",
    dth: "อุ้งเท้าปล่อยประกาย วิ่งเร็วจนเห็นเป็นเส้น", den: "Sparks off its paws and runs fast enough to blur.", dzh: "爪下带电，跑起来只剩残影。" },
  { id: "pyrix", pw: 1.1, ph: 0.92, phr: 0.94,    code: "PT-08", type: "ember", look: "cool", build: "biped", head: "boxy",   ear: "horn",  tail: "flame", eye: "visor", mark: "flame",
    sw: ["#ff5330", "#4c0d00"], food: "pf-coal",
    th: "ไพริกซ์", en: "Pyrix", zh: "熔炉兽", bonus: "dmg",
    dth: "เตาหลอมเดินได้ อุ่นมือได้ในหน้าหนาว", den: "A walking furnace. Excellent to hold in winter.", dzh: "会走路的熔炉，冬天抱着正好。" },
  { id: "glacio", pw: 0.92, ph: 1.05, phr: 1.06,   code: "PT-09", type: "frost", look: "cute", build: "quad", head: "round",    ear: "horn",  tail: "gear",  eye: "sleepy", mark: "scale",
    sw: ["#7ff0dc", "#07453a"], food: "pf-ice",
    th: "เกลเซีย", en: "Glacio", zh: "冰晶兽", bonus: "guard",
    dth: "ขนเป็นเกล็ดน้ำแข็ง เดินแล้วมีเสียงกรุ๊งกริ๊ง", den: "A coat of ice scales that chimes softly as it walks.", dzh: "冰鳞外衣，走动时叮当作响。" },
  { id: "mossel", pw: 1.12, ph: 0.93, phr: 0.92,   code: "PT-10", type: "flora", look: "cute", build: "float", head: "blob",   ear: "leaf",  tail: "vine",  eye: "sleepy", mark: "band",
    sw: ["#a8cf62", "#2c3c10"], food: "pf-seed",
    th: "มอสเซล", en: "Mossel", zh: "苔壳兽", bonus: "heal",
    dth: "ก้อนมอสอบอุ่น ชอบนอนกลางแดดอ่อน", den: "A warm lump of moss that sleeps in soft light.", dzh: "温暖的苔藓球，爱在柔光下打盹。" },
  { id: "cogsy", pw: 1.06, ph: 0.96, phr: 0.98,    code: "PT-11", type: "steel", look: "cute", build: "quad", head: "boxy",  ear: "bolt",  tail: "gear",  eye: "starry", mark: "band",
    sw: ["#e0d6c2", "#4a3c21"], food: "pf-bolt",
    th: "ค็อกซี่", en: "Cogsy", zh: "齿轮兽", bonus: "sp",
    dth: "เฟืองน้อยขยัน หมุนตัวเองเวลาตื่นเต้น", den: "A busy little cog that spins itself when excited.", dzh: "勤劳的小齿轮，兴奋时自转。" },
  { id: "astrel", pw: 0.86, ph: 1.1, phr: 1.12,   code: "PT-12", type: "aether", look: "cool",build: "biped", head: "sharp",   ear: "halo",  tail: "wisp",  eye: "starry", mark: "star",
    sw: ["#9fb4ff", "#00114c"], food: "pf-prism",
    th: "แอสเทรล", en: "Astrel", zh: "星舆兽", bonus: "sp",
    dth: "พกดาวไว้ในตัว บอกทางกลับบ้านได้เสมอ", den: "Carries a star inside. Always knows the way home.", dzh: "体内藏着星星，永远知道回家的路。" },
  /* ══ the second intake ══════════════════════════════════════════════════
     Twenty more, split down the middle. The `look` tag is not decoration —
     the hatchery filters on it, because a wall of thirty-two eggs is a wall,
     and somebody who came here for a soft round thing should not have to
     scroll past ten sets of horns to find one.

     CUTE is built the same way every time: a narrow crown over a wide jaw,
     a head oversized against the body (phr well over 1), something long and
     soft on top, and nothing anywhere that comes to a point. */
  { id: "bunbun", pw: 0.88, ph: 1.06, phr: 1.18, code: "PT-13", type: "volt", look: "cute", build: "biped", head: "moon", ear: "bunny", tail: "puff", eye: "dot", mark: "bib",
    sw: ["#fff0a8", "#4c3f00"], food: "pf-cell",
    th: "บันบัน", en: "Bunbun", zh: "蹦蹦兽", bonus: "heal",
    dth: "กระต่ายไฟฟ้าตัวนุ่ม กระโดดทีไรมีประกายตามหลัง", den: "A soft electric rabbit. Every hop leaves a little trail of sparks behind it.", dzh: "软绵绵的电兔，每跳一下都拖着小火花。" },
  { id: "puffle", pw: 0.9, ph: 1.08, phr: 1.16, code: "PT-14", type: "frost", look: "cute", build: "float", head: "blob", ear: "flop", tail: "bubble", eye: "wink", mark: "bib",
    sw: ["#b8d8ff", "#00224c"], food: "pf-ice",
    th: "พัฟเฟิล", en: "Puffle", zh: "泡泡兽", bonus: "guard",
    dth: "ลอยได้เพราะเบามาก ปล่อยฟองเย็นๆ ตอนหัวเราะ", den: "Floats because there is almost nothing to it. Blows cold bubbles when it laughs.", dzh: "轻得能飘起来，笑的时候会吐冷泡泡。" },
  { id: "beepo", pw: 0.86, ph: 1.04, phr: 1.2, code: "PT-15", type: "steel", look: "cute", build: "biped", head: "bean", ear: "antenna", tail: "coil", eye: "dot", mark: "stripe",
    sw: ["#eef2f8", "#152338"], food: "pf-bolt",
    th: "บีโป", en: "Beepo", zh: "哔波兽", bonus: "sp",
    dth: "หุ่นจิ๋วพูดได้คำเดียว ส่ายเสาอากาศเวลาดีใจ", den: "A tiny bot with one word in its vocabulary. Waggles its antennae when pleased.", dzh: "只会说一个字的小机器人，开心时天线乱晃。" },
  { id: "tofu", pw: 0.94, ph: 1.02, phr: 1.12, code: "PT-16", type: "flora", look: "cute", build: "quad", head: "moon", ear: "flop", tail: "puff", eye: "sleepy", mark: "patch",
    sw: ["#e2f0a8", "#37420a"], food: "pf-seed",
    th: "เต้าหู้", en: "Tofu", zh: "豆腐兽", bonus: "heal",
    dth: "ก้อนนุ่มสี่ขา เดินช้ามากแต่ไม่เคยหยุด", den: "A soft four-legged block. Very slow, and it never once stops.", dzh: "软软的四脚方块，走得极慢却从不停下。" },
  { id: "pompom", pw: 0.9, ph: 1.05, phr: 1.15, code: "PT-17", type: "ember", look: "cute", build: "biped", head: "blob", ear: "bunny", tail: "plume", eye: "big", mark: "heart",
    sw: ["#ff9aa8", "#4c000b"], food: "pf-coal",
    th: "ปอมปอม", en: "Pompom", zh: "绒绒兽", bonus: "dmg",
    dth: "ขนฟูอุ่นๆ กอดแล้วเหมือนกอดผ้าห่มอุ่น", den: "Warm and fluffy. Holding it is like holding a blanket fresh off the line.", dzh: "毛茸茸暖呼呼，抱着像抱刚晒好的被子。" },
  { id: "cloudi", pw: 0.85, ph: 1.1, phr: 1.19, code: "PT-18", type: "aether", look: "cute", build: "float", head: "moon", ear: "halo", tail: "bubble", eye: "starry", mark: "bib",
    sw: ["#f0c0ff", "#3a004c"], food: "pf-prism",
    th: "คลาวดี้", en: "Cloudi", zh: "云朵兽", bonus: "sp",
    dth: "เมฆน้อยติดวงแหวน ลอยต่ำลงมาเวลาง่วง", den: "A small cloud with a ring around it. Drifts lower and lower as it gets sleepy.", dzh: "带着光环的小云，越困飘得越低。" },
  { id: "mochee", pw: 0.89, ph: 1.03, phr: 1.17, code: "PT-19", type: "flora", look: "cute", build: "biped", head: "bean", ear: "leaf", tail: "coil", eye: "wink", mark: "heart",
    sw: ["#8ff0d0", "#084430"], food: "pf-seed",
    th: "โมชี่", en: "Mochee", zh: "麻糬兽", bonus: "heal",
    dth: "ตัวเหนียวนุ่ม ยืดได้นิดหน่อยตอนตื่นเต้น", den: "Soft and slightly stretchy. Gets a little longer when it is excited.", dzh: "软糯有弹性，兴奋时会稍微拉长。" },
  { id: "wobble", pw: 0.96, ph: 1.0, phr: 1.13, code: "PT-20", type: "volt", look: "cute", build: "quad", head: "round", ear: "antenna", tail: "puff", eye: "dot", mark: "spots",
    sw: ["#d9f25c", "#3c4705"], food: "pf-cell",
    th: "ว็อบเบิ้ล", en: "Wobble", zh: "摇摇兽", bonus: "guard",
    dth: "ล้มแล้วเด้งกลับทุกครั้ง ไม่เคยล้มค้าง", den: "Tips over constantly and rights itself every single time.", dzh: "老是摔倒，但每次都会自己弹回来。" },
  { id: "snowpea", pw: 0.87, ph: 1.07, phr: 1.16, code: "PT-21", type: "frost", look: "cute", build: "biped", head: "moon", ear: "bunny", tail: "bubble", eye: "big", mark: "spots",
    sw: ["#ddfbf0", "#07452e"], food: "pf-ice",
    th: "สโนว์พี", en: "Snowpea", zh: "雪豆兽", bonus: "guard",
    dth: "ตัวเล็กแต่ทนหนาวที่สุด ชอบนอนในตู้เย็น", den: "The smallest thing here and the hardest to freeze. Sleeps in the fridge given the chance.", dzh: "个头最小却最耐寒，有机会就睡冰箱里。" },
  { id: "sunnie", pw: 0.92, ph: 1.04, phr: 1.14, code: "PT-22", type: "ember", look: "cute", build: "float", head: "blob", ear: "flop", tail: "plume", eye: "wink", mark: "patch",
    sw: ["#ffc47a", "#4c2b00"], food: "pf-coal",
    th: "ซันนี่", en: "Sunnie", zh: "暖阳兽", bonus: "heal",
    dth: "อุ่นตลอดเวลา ลอยตามหน้าต่างที่มีแดด", den: "Warm all the way through. Drifts towards whichever window has the sun in it.", dzh: "浑身暖洋洋，总飘向有阳光的窗边。" },

  /* COOL is the same rules run backwards: a body wider than the head, a
     crown or a wing on top instead of something soft, and at least one hard
     point in the silhouette. Every one of them has an edge somewhere. */
  { id: "noctis", pw: 1.16, ph: 0.9, phr: 0.88, code: "PT-23", type: "aether", look: "cool", build: "quad", head: "fang", ear: "crown", tail: "blade", eye: "slit", mark: "star",
    sw: ["#7c6bff", "#09004c"], food: "pf-prism",
    th: "น็อคทิส", en: "Noctis", zh: "夜刃兽", bonus: "dmg",
    dth: "ล่าเงียบในความมืด ได้ยินแค่ตอนมันอยากให้ได้ยิน", den: "Hunts in the dark without a sound, and is heard only when it wants to be.", dzh: "黑暗中无声狩猎，只在它愿意时才被听见。" },
  { id: "raijin", pw: 1.12, ph: 0.94, phr: 0.92, code: "PT-24", type: "volt", look: "cool", build: "biped", head: "crest", ear: "wing", tail: "spark", eye: "scan", mark: "stripe",
    sw: ["#f5a623", "#492f03"], food: "pf-cell",
    th: "ไรจิน", en: "Raijin", zh: "雷神兽", bonus: "dmg",
    dth: "เดินมาพร้อมเสียงฟ้าร้อง ขนลุกทั้งห้องก่อนมันจะถึง", den: "Arrives with the thunder. The room's hair stands up before it does.", dzh: "伴着雷声而来，它到之前满屋汗毛先立。" },
  { id: "obsidian", pw: 1.2, ph: 0.88, phr: 0.86, code: "PT-25", type: "steel", look: "cool", build: "quad", head: "boxy", ear: "crown", tail: "gear", eye: "visor", mark: "band",
    sw: ["#6b7386", "#2c323f"], food: "pf-bolt",
    th: "ออบซิเดียน", en: "Obsidian", zh: "黑曜兽", bonus: "guard",
    dth: "หนักที่สุดในรุ่น ยืนขวางแล้วไม่มีอะไรผ่าน", den: "The heaviest thing in the line. Puts itself in the way and nothing gets past.", dzh: "同批最重的一只，往那一站什么都过不去。" },
  { id: "vulkar", pw: 1.15, ph: 0.92, phr: 0.9, code: "PT-26", type: "ember", look: "cool", build: "quad", head: "fang", ear: "horn", tail: "blade", eye: "slit", mark: "flame",
    sw: ["#e8324a", "#45070f"], food: "pf-coal",
    th: "วัลคาร์", en: "Vulkar", zh: "熔岩兽", bonus: "dmg",
    dth: "เกล็ดร้อนจนพื้นไหม้เป็นรอยเท้า", den: "Scales hot enough that the floor keeps its footprints.", dzh: "鳞片烫得地板留下它的脚印。" },
  { id: "zephyr", pw: 1.06, ph: 0.96, phr: 0.94, code: "PT-27", type: "frost", look: "cool", build: "float", head: "crest", ear: "wing", tail: "plume", eye: "sharp", mark: "band",
    sw: ["#7fc8f5", "#052e47"], food: "pf-ice",
    th: "เซเฟอร์", en: "Zephyr", zh: "疾风兽", bonus: "sp",
    dth: "ไม่เคยแตะพื้น ลมหนาวพัดไปทางไหนมันไปทางนั้น", den: "Never touches the ground. Goes wherever the cold wind is already going.", dzh: "从不落地，冷风往哪吹它就往哪去。" },
  { id: "thornix", pw: 1.1, ph: 0.95, phr: 0.91, code: "PT-28", type: "flora", look: "cool", build: "biped", head: "sharp", ear: "crown", tail: "blade", eye: "scan", mark: "scale",
    sw: ["#4ec24a", "#133b12"], food: "pf-seed",
    th: "ธอร์นิกซ์", en: "Thornix", zh: "荆棘兽", bonus: "dmg",
    dth: "หนามยาวขึ้นทุกครั้งที่ชนะ", den: "Grows another thorn every time it wins.", dzh: "每赢一次就多长一根刺。" },
  { id: "voidra", pw: 1.04, ph: 0.98, phr: 0.94, code: "PT-29", type: "aether", look: "cool", build: "float", head: "crest", ear: "halo", tail: "wisp", eye: "slit", mark: "spots",
    sw: ["#d05cff", "#36004c"], food: "pf-prism",
    th: "วอยดร้า", en: "Voidra", zh: "虚空兽", bonus: "sp",
    dth: "แสงรอบตัวมันโค้งงอ มองตรงๆ ไม่ค่อยติด", den: "Light bends around it, so looking straight at it never quite works.", dzh: "周围的光会拐弯，直视它总是看不真切。" },
  { id: "ferrox", pw: 1.18, ph: 0.9, phr: 0.87, code: "PT-30", type: "steel", look: "cool", build: "biped", head: "boxy", ear: "wing", tail: "blade", eye: "visor", mark: "stripe",
    sw: ["#c8a898", "#492f22"], food: "pf-bolt",
    th: "เฟอร์ร็อกซ์", en: "Ferrox", zh: "铁爪兽", bonus: "guard",
    dth: "กรงเล็บเหล็กกล้า ขูดกำแพงเป็นรอยลึก", den: "Steel claws. Leaves grooves in a wall it only meant to lean on.", dzh: "钢铁利爪，靠一下墙都留下深痕。" },
  { id: "kaisen", pw: 1.13, ph: 0.93, phr: 0.9, code: "PT-31", type: "volt", look: "cool", build: "quad", head: "fang", ear: "fin", tail: "spark", eye: "slit", mark: "scale",
    sw: ["#5ce1ff", "#003e4c"], food: "pf-cell",
    th: "ไคเซ็น", en: "Kaisen", zh: "海闪兽", bonus: "dmg",
    dth: "ว่ายในอากาศได้เหมือนอยู่ในน้ำ ทิ้งประกายไว้ข้างหลัง", den: "Swims through air the way it would through water, trailing sparks.", dzh: "在空中像在水里游动，身后拖着电光。" },
  { id: "umbrix", pw: 1.08, ph: 0.94, phr: 0.92, code: "PT-32", type: "frost", look: "cool", build: "biped", head: "crest", ear: "crown", tail: "gear", eye: "scan", mark: "scale",
    sw: ["#7f9fe0", "#0e1e3f"], food: "pf-ice",
    th: "อัมบริกซ์", en: "Umbrix", zh: "霜影兽", bonus: "guard",
    dth: "หนาวเงียบ ยืนนิ่งจนกระจกรอบตัวเป็นฝ้า", den: "Quietly, steadily cold. Stands still long enough to frost the glass around it.", dzh: "安静地冷着，站久了周围玻璃都结霜。" },
];
export const petById = (id) => PET_SPECIES.find(p => p.id === id) || PET_SPECIES[0];

/* Each species eats one thing in particular. Feeding the favourite is worth
   double bond — which is the whole reason to learn what your pet likes. */
export const PET_FOODS = [
  { id: "pf-chow",  art: "battery", cost: 30,  sw: ["#b8c2d4", "#2a3346"], th: "อาหารรวมมิตร", en: "Standard Chow", zh: "通用饲料", any: true },
  { id: "pf-cell",  art: "battery", cost: 90,  sw: ["#ffe14d", "#4a3200"], th: "เซลล์ประจุหวาน", en: "Sweet Charge Cell", zh: "甜味电芯" },
  { id: "pf-coal",  art: "torch",   cost: 90,  sw: ["#ff8a4c", "#3a0d00"], th: "ถ่านเรืองไฟ", en: "Glow Coal", zh: "辉光炭" },
  { id: "pf-ice",   art: "orb",     cost: 90,  sw: ["#8fe8ff", "#0d3a5c"], th: "ลูกอมน้ำแข็ง", en: "Frost Drop", zh: "冰霜糖" },
  { id: "pf-seed",  art: "atom",    cost: 90,  sw: ["#6fe39b", "#0d3a24"], th: "เมล็ดพลังชีวะ", en: "Bio Seed", zh: "生机种子" },
  { id: "pf-bolt",  art: "rivets",  cost: 90,  sw: ["#cdd6e6", "#3a4459"], th: "น็อตเคลือบน้ำผึ้ง", en: "Honeyed Bolts", zh: "蜜渍螺钉" },
  { id: "pf-prism", art: "orb",     cost: 90,  sw: ["#c7a6ff", "#2a1050"], th: "เศษปริซึม", en: "Prism Shard", zh: "棱镜碎片" },
  { id: "pf-feast", art: "fusion",  cost: 300, sw: ["#ffd23f", "#ff9a3c"], th: "มื้อใหญ่ประจำสัปดาห์", en: "Grand Feast", zh: "盛宴", any: true, big: true },
];
export const foodById = (id) => PET_FOODS.find(f => f.id === id);

/* What a pet is worth in the arena. Small on purpose: a pet should be a
   reason to come back daily, not a second shop that decides fights. */
export const PET_BONUS = {
  dmg:   { k: "dmg",   v: 0.10, th: "ดาเมจ +10%", en: "+10% damage", zh: "伤害 +10%" },
  guard: { k: "guard", v: 0.12, th: "รับดาเมจ -12%", en: "-12% damage taken", zh: "受伤 -12%" },
  heal:  { k: "heal",  v: 0.04, th: "ฟื้นเลือดต้นยกทุกยก", en: "Heal at the start of each wave", zh: "每波开始回血" },
  sp:    { k: "sp",    v: 0.15, th: "เกจสกิลเต็มเร็ว +15%", en: "+15% skill gauge", zh: "技能槽 +15%" },
};

/* ══════════════════════ save + decay ══════════════════════ */

const KEY = "tg_pet";
const HOUR = 3600e3;
/* Per-hour fall. Slow enough that a day away is a pet that needs looking
   after rather than a pet that has been ruined. */
const DECAY = { hunger: 4.2, clean: 3.4, coat: 2.6, mood: 3.8 };
export const PET_MAX = 100;

export function readPet() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!v || !v.species) return null;
  return decay(v);
}
export function writePet(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

/** Bring a saved pet up to now. Everything falls; mess appears as cleanliness
    drops, which is what makes cleaning a chore you actually have to do. */
export function decay(v) {
  const now = Date.now();
  const h = Math.max(0, (now - (v.seen || now)) / HOUR);
  if (h < 0.01) return v;
  const out = { ...v, seen: now };
  for (const k of ["hunger", "clean", "coat", "mood"]) {
    out[k] = Math.max(0, Math.min(PET_MAX, (v[k] == null ? PET_MAX : v[k]) - DECAY[k] * h));
  }
  // one mess per four hours of neglect, capped so it never looks hopeless
  const want = Math.min(6, Math.floor(h / 4) + (out.clean < 40 ? 1 : 0));
  const have = (v.mess || []).length;
  const mess = (v.mess || []).slice();
  for (let i = have; i < want; i++) {
    mess.push({ id: now + "-" + i, x: 12 + Math.random() * 74, y: 62 + Math.random() * 26 });
  }
  out.mess = mess;
  return out;
}

/* ── the stable ─────────────────────────────────────────────────────────────
   A pet used to be a single record in a single slot: hatched once, kept for
   ever, and that was the whole system. A second pet has to go somewhere, so
   the ones you are not carrying live here. The ACTIVE pet stays exactly where
   it always was, under `tg_pet`, which means every existing reader — the
   arena bonus, the profile pod, the care page — finds its pet without knowing
   the stable exists at all. */
const BOX = "tg_petbox";
export function readBox() {
  try {
    const v = JSON.parse(localStorage.getItem(BOX) || "[]");
    return Array.isArray(v) ? v.filter(x => x && x.species) : [];
  } catch (e) { return []; }
}
function writeBox(v) { try { localStorage.setItem(BOX, JSON.stringify(v)); } catch (e) {} }
function announce() { try { window.dispatchEvent(new Event("tg-pet")); } catch (e) {} }

/** Everything owned, the one being carried first. */
export function allPets() {
  const a = readPet();
  return (a ? [a] : []).concat(readBox().map(decay));
}
export function ownsSpecies(id) {
  const a = readPet();
  if (a && a.species === id) return true;
  return readBox().some(p => p.species === id);
}
export function carriedSpecies() { const a = readPet(); return a ? a.species : null; }

/** Take on a species. It goes straight to your side if you have no pet at
    all, and into the stable if you do — buying a companion should never
    silently put down the one you already have. */
export function adoptPet(speciesId) {
  if (ownsSpecies(speciesId)) return false;
  const p = newPet(speciesId);
  if (!readPet()) writePet(p); else writeBox([...readBox(), p]);
  announce();
  return true;
}

/** Carry a different one. The pet you put down keeps everything — its name,
    its bond, how hungry it is, the mess it made — because a pet swapped out
    is not a pet thrown away, and it will still be hungry when you come back
    to it. Its decay clock keeps running: a stabled pet is a neglected one. */
export function carryPet(speciesId) {
  const cur = readPet();
  if (cur && cur.species === speciesId) return false;
  const box = readBox();
  const i = box.findIndex(p => p && p.species === speciesId);
  if (i < 0) return false;
  const next = box[i];
  writeBox(cur ? box.slice(0, i).concat(box.slice(i + 1), [cur]) : box.slice(0, i).concat(box.slice(i + 1)));
  writePet(decay(next));
  announce();
  return true;
}

/* Every pet costs the same. Their arena bonuses are deliberately small and
   deliberately comparable, so a price ladder would be pricing a preference —
   and which animal you want to look after is not a thing to charge more for.
   The first one is still free out of the hatchery. */
export const PET_COST = 1500;

export function newPet(speciesId) {
  return {
    species: speciesId, name: "", born: Date.now(), seen: Date.now(),
    hunger: 80, clean: 90, coat: 85, mood: 80, bond: 0, mess: [], fed: {},
  };
}

/* Bond is the pet's own experience track: care raises it, and it is the only
   thing that grows the creature. */
export const petLevel = (bond) => {
  const lv = Math.max(1, Math.floor(Math.sqrt(Math.max(0, bond) / 26)) + 1);
  const at = (n) => 26 * (n - 1) * (n - 1);
  return { lv, into: bond - at(lv), need: at(lv + 1) - at(lv), pct: (bond - at(lv)) / (at(lv + 1) - at(lv)) };
};
/* The three named stages are just milestones on the same continuous curve —
   the body changes every level, this is only what to call it. */
/* Five named stages now, not three. The body still changes every level; these
   are the five moments worth announcing. */
export const PET_STAGES = 5;
export const petStage = (bond) => {
  const lv = petLevel(bond).lv;
  return lv >= 18 ? 5 : lv >= 13 ? 4 : lv >= 8 ? 3 : lv >= 4 ? 2 : 1;
};
export const STAGE_NAME = [
  null,
  { th: "ฟักใหม่", en: "Hatchling", zh: "初生" },
  { th: "เติบโต", en: "Youngling", zh: "成长" },
  { th: "ชำนาญ", en: "Adept", zh: "熟练" },
  { th: "แชมเปียน", en: "Champion", zh: "冠军" },
  { th: "ผู้ตื่นรู้", en: "Ascendant", zh: "觉醒" },
];
/** The level a stage begins at — used to show how far the next form is. */
export const STAGE_AT = [0, 1, 4, 8, 13, 18];
export const petHappy = (p) => Math.round(((p.hunger + p.clean + p.coat + p.mood) / 4));

/* ══════════════════════ the creature ══════════════════════ */

/* Ground line and the three body plans. A pet is not a floating head: it has
   a build, and the build is most of what you recognise it by across a room.
   Bipeds stand, quads crouch on four, floaters never touch the floor. */
const GROUND = 127;
/* The body used to be about a third of the head, which is why these read as
   a head with legs attached rather than as a small animal: the torso was too
   small to carry a marking, a limb or a tail root, so all three ended up
   looking stuck on. The head comes down a little and the body comes up a
   lot — still a big-headed creature, but one with something under it. */
const LAY = {
  biped: [
    { hy: 57, hr: 23.5, by: 92, bw: 35, bh: 31, arm: 15 },
    { hy: 51, hr: 22.5, by: 88, bw: 40, bh: 37, arm: 19 },
    { hy: 44, hr: 21.5, by: 83, bw: 46, bh: 43, arm: 23 },
  ],
  quad: [
    { hy: 64, hr: 22.5, by: 97, bw: 50, bh: 31, arm: 0 },
    { hy: 58, hr: 22.5, by: 94, bw: 56, bh: 35, arm: 0 },
    { hy: 54, hr: 21.5, by: 91, bw: 62, bh: 39, arm: 0 },
  ],
  float: [
    { hy: 55, hr: 24.5, by: 88, bw: 31, bh: 29, arm: 11 },
    { hy: 49, hr: 23.5, by: 84, bw: 35, bh: 33, arm: 14 },
    { hy: 43, hr: 22.5, by: 80, bw: 39, bh: 37, arm: 17 },
  ],
};

/* ── growing up ──
   The three layouts above are keyframes, not steps. A pet at level 7 is drawn
   between the second and third of them, so the body changes a little at EVERY
   level rather than jumping three times in a creature's whole life. On top of
   that continuous change, one visible part is bolted on per level — that is
   what makes a level-up something you can see rather than a number going up. */
export const PET_ARTLV = 20;                 // the level the body finishes growing at
const lerp = (a, b, t) => a + (b - a) * t;
const hx = (c) => { const h = String(c).replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Blend two hex colours. A grown pet runs hotter in its own element. */
const mixc = (a, b, t) => { const x = hx(a), y = hx(b); return "#" + [0, 1, 2].map(i => Math.round(lerp(x[i], y[i], t)).toString(16).padStart(2, "0")).join(""); };
/** Read the three keyframes at a growth position 0..1. */
const mix3 = (k, g) => {
  const t = g <= .5 ? g * 2 : (g - .5) * 2;
  const lo = g <= .5 ? k[0] : k[1], hi = g <= .5 ? k[1] : k[2];
  const out = {};
  for (const n of Object.keys(lo)) out[n] = lerp(lo[n], hi[n], t);
  return out;
};
/** One new part per level. Index is the level it appears at. */
/* Twelve levels of growth ended with a ring on the floor, and everything
   between level 2 and level 12 was an ACCESSORY — a stud, a bracer, a plate.
   None of it changed the animal's outline, so a grown pet was a hatchling at
   115% with jewellery on. The back half of the ladder is deliberately made of
   parts that stick OUT: horns, a ruff, a second tail, a crown, shards in the
   air around it. Those are the ones you can see from across a room, and
   "evolution" that you cannot see from across a room does not feel like one. */
export const GROW = [
  null, null, "core", "studs", "plate", "bracers", "crest", "anklets", "vents", "wings", "pauldrons", "tailglow", "aura",
  "horns", "mane", "twintail", "claws", "crown", "shards", "halo", "sigil",
];
export const GROW_TEXT = {
  core:      { th: "แกนพลังติดไฟ", en: "Power core lights up", zh: "核心点亮" },
  studs:     { th: "หมุดไหล่", en: "Shoulder studs", zh: "肩钉" },
  plate:     { th: "เกราะอก", en: "Chest plate", zh: "胸甲" },
  bracers:   { th: "ปลอกแขน", en: "Bracers", zh: "护腕" },
  crest:     { th: "หงอนบนหัว", en: "Head crest", zh: "头冠" },
  anklets:   { th: "ห่วงข้อเท้า", en: "Ankle rings", zh: "踝环" },
  vents:     { th: "ช่องระบายหลัง", en: "Back vents", zh: "背部散热口" },
  wings:     { th: "ปีก", en: "Wings", zh: "翅膀" },
  pauldrons: { th: "เกราะไหล่", en: "Pauldrons", zh: "肩铠" },
  tailglow:  { th: "หางเรืองแสง", en: "Glowing tail", zh: "尾巴发光" },
  aura:      { th: "วงออร่า", en: "Aura ring", zh: "光环" },
  horns:     { th: "เขา", en: "Horns", zh: "犄角" },
  mane:      { th: "ขนคอฟู", en: "Neck ruff", zh: "颈毛" },
  twintail:  { th: "หางคู่", en: "Twin tail", zh: "双尾" },
  claws:     { th: "กรงเล็บ", en: "Claws", zh: "利爪" },
  crown:     { th: "มงกุฎ", en: "Crown", zh: "王冠" },
  shards:    { th: "เกล็ดพลังลอยรอบตัว", en: "Orbiting shards", zh: "环绕碎片" },
  halo:      { th: "วงแสงเหนือหัว", en: "Halo", zh: "头顶光环" },
  sigil:     { th: "อักขระพลังด้านหลัง", en: "Power sigil", zh: "背后符文" },
};
/** What the next level adds, for the bond card to promise. */
export const nextGrowth = (lv) => {
  for (let n = Math.max(2, lv + 1); n < GROW.length; n++) if (GROW[n]) return { lv: n, key: GROW[n], ...GROW_TEXT[GROW[n]] };
  return null;
};

/* Two path helpers do nearly all the geometry — an ellipse and a rounded box.
   Everything (torso, limbs, plates, hatches) is one of those two, which is
   what keeps twelve creatures from drifting into twelve different styles. */
/** Stable per-path id so each part can clip its own bevel. */
const hashd = (d) => { let h = 5381; for (let i = 0; i < d.length; i++) h = ((h << 5) + h + d.charCodeAt(i)) | 0; return h; };
const ell = (x, y, rx, ry) =>
  `M${x - rx} ${y} C${x - rx} ${y - ry * 1.334} ${x + rx} ${y - ry * 1.334} ${x + rx} ${y} C${x + rx} ${y + ry * 1.334} ${x - rx} ${y + ry * 1.334} ${x - rx} ${y} Z`;
const rr = (x, y, w, h, r) => {
  const q = Math.min(r, w / 2, h / 2), l = x - w / 2, t = y - h / 2, R = x + w / 2, b = y + h / 2;
  return `M${l + q} ${t} H${R - q} A${q} ${q} 0 0 1 ${R} ${t + q} V${b - q} A${q} ${q} 0 0 1 ${R - q} ${b} H${l + q} A${q} ${q} 0 0 1 ${l} ${b - q} V${t + q} A${q} ${q} 0 0 1 ${l + q} ${t} Z`;
};

/* Four skulls. Same eye rig fits all of them, so a species reads by profile
   rather than by having its own bespoke face. */
const HEADS = {
  round: (x, y, r) => `M${x} ${y - r} C${x + r * .94} ${y - r} ${x + r} ${y - r * .28} ${x + r} ${y + r * .16} C${x + r} ${y + r * .8} ${x + r * .62} ${y + r} ${x} ${y + r} C${x - r * .62} ${y + r} ${x - r} ${y + r * .8} ${x - r} ${y + r * .16} C${x - r} ${y - r * .28} ${x - r * .94} ${y - r} ${x} ${y - r} Z`,
  blob:  (x, y, r) => `M${x} ${y - r * .88} C${x + r * .78} ${y - r * .92} ${x + r * 1.04} ${y - r * .16} ${x + r * .97} ${y + r * .38} C${x + r * .9} ${y + r * .9} ${x + r * .5} ${y + r * 1.02} ${x} ${y + r * 1.02} C${x - r * .5} ${y + r * 1.02} ${x - r * .9} ${y + r * .9} ${x - r * .97} ${y + r * .38} C${x - r * 1.04} ${y - r * .16} ${x - r * .78} ${y - r * .92} ${x} ${y - r * .88} Z`,
  sharp: (x, y, r) => `M${x} ${y - r} C${x + r * .46} ${y - r} ${x + r * .8} ${y - r * .78} ${x + r * .95} ${y - r * .36} L${x + r * 1.02} ${y + r * .1} C${x + r * .84} ${y + r * .74} ${x + r * .42} ${y + r * 1.02} ${x} ${y + r * 1.02} C${x - r * .42} ${y + r * 1.02} ${x - r * .84} ${y + r * .74} ${x - r * 1.02} ${y + r * .1} L${x - r * .95} ${y - r * .36} C${x - r * .8} ${y - r * .78} ${x - r * .46} ${y - r} ${x} ${y - r} Z`,
  boxy:  (x, y, r) => rr(x, y, r * 2, r * 1.94, r * .34),
  /* narrow crown, wide low cheeks — the whole trick of drawing something as
     young is putting the width UNDER the eyeline rather than over it */
  moon:  (x, y, r) => `M${x} ${y - r} C${x + r * .62} ${y - r} ${x + r * .86} ${y - r * .54} ${x + r * .94} ${y - r * .02} C${x + r * 1.04} ${y + r * .62} ${x + r * .66} ${y + r * 1.04} ${x} ${y + r * 1.04} C${x - r * .66} ${y + r * 1.04} ${x - r * 1.04} ${y + r * .62} ${x - r * .94} ${y - r * .02} C${x - r * .86} ${y - r * .54} ${x - r * .62} ${y - r} ${x} ${y - r} Z`,
  /* a faceted helm with a peak: flat planes and hard corners read as armour,
     which is the opposite instinct to the round ones above */
  crest: (x, y, r) => `M${x} ${y - r * 1.14} L${x + r * .74} ${y - r * .6} L${x + r} ${y + r * .12} L${x + r * .64} ${y + r * .84} L${x} ${y + r * 1.02} L${x - r * .64} ${y + r * .84} L${x - r} ${y + r * .12} L${x - r * .74} ${y - r * .6} Z`,
  /* off-centre on purpose. A head that leans is a head with an opinion. */
  bean:  (x, y, r) => `M${x - r * .1} ${y - r * .98} C${x + r * .74} ${y - r} ${x + r * 1.02} ${y - r * .34} ${x + r * .92} ${y + r * .3} C${x + r * .82} ${y + r * .92} ${x + r * .34} ${y + r * 1.06} ${x - r * .16} ${y + r} C${x - r * .72} ${y + r * .94} ${x - r} ${y + r * .5} ${x - r * .94} ${y - r * .1} C${x - r * .88} ${y - r * .68} ${x - r * .6} ${y - r * .96} ${x - r * .1} ${y - r * .98} Z`,
  /* a muzzle that comes to a point, so the silhouette has teeth in it before
     any teeth are drawn */
  fang:  (x, y, r) => `M${x} ${y - r * .96} C${x + r * .56} ${y - r * .96} ${x + r * .9} ${y - r * .6} ${x + r * .94} ${y - r * .06} C${x + r * .98} ${y + r * .5} ${x + r * .62} ${y + r * .8} ${x + r * .3} ${y + r * .94} L${x} ${y + r * 1.16} L${x - r * .3} ${y + r * .94} C${x - r * .62} ${y + r * .8} ${x - r * .98} ${y + r * .5} ${x - r * .94} ${y - r * .06} C${x - r * .9} ${y - r * .6} ${x - r * .56} ${y - r * .96} ${x} ${y - r * .96} Z`,
};

/** One creature, built from its parts and how grown-up it is.
    Draw order is back-to-front: tail, back limbs, wings, torso, front limbs,
    neck, head, ears, face. Everything shares one light rig so a pet standing
    next to a chassis in the arena looks like it came out of the same shop.

    `level` drives everything. The body is interpolated between the three
    keyframe layouts, so it changes a little every level, and `GROW` bolts on
    one new part per level so there is always something new to look at. */
export const PetArt = memo(function PetArt({ species, level, stage, mood = 80, size, className = "" }) {
  const sp = petById(species);
  // `stage` is still accepted so older call sites keep working
  const lv = Math.max(1, Math.round(level || (stage ? [1, 4, 8, 13, 18][Math.min(4, stage - 1)] : 1)));
  const g = Math.min(1, (lv - 1) / (PET_ARTLV - 1));
  const uid = "pt" + sp.id + Math.min(lv, PET_ARTLV);
  const has = (n) => lv >= n;
  const A = sp.sw[0], B = sp.sw[1];
  const T = PET_TYPES[sp.type] || PET_TYPES.steel;
  const sad = mood < 35;
  const L = mix3(LAY[sp.build] || LAY.biped, g);
  /* Per-species proportions. Every biped pet was laid out on one body, so a
     shelf of them read as the same creature in different ear hats. A width, a
     height and a head size per species turn twelve palette swaps into twelve
     silhouettes without redrawing a single path. */
  const cx = 60, hy = L.hy;
  const hr = L.hr * (sp.phr || 1);
  const bw = L.bw * (sp.pw || 1), bh = L.bh * (sp.ph || 1);
  const by = L.by + (L.bh - bh) / 2;   // keep the belly on the ground as it shrinks
  const bTop = by - bh / 2, bBot = by + bh / 2;
  /* On top of the layout change, the whole creature scales up from the ground,
     so a grown pet plainly fills more of its frame than a hatchling. */
  const SC = 0.9 + g * 0.24;
  /* and it warms toward its own element, with a rim light that only really
     shows up once it is most of the way grown. The pull used to be a third of
     the way, which is most of the reason thirty-two species read as six
     colours: six ember pets all dragged onto the same orange. The element is
     already carried by the rim, the aura and the eye, so the body only needs
     a hint of it — the animal's own coat does the rest. */
  const A2 = mixc(A, T.c, g * 0.15);
  const rim = 0.1 + g * 0.5;

  const F = `url(#${uid}-body)`;
  /* Ears, tails and limbs were painted in ONE FLAT COLOUR while the head and
     torso got a four-stop gradient, so at any size above a thumbnail the
     creature came apart: a shaded body wearing paper ears. This is the same
     hue with the same light on it, minus the head's white hot-spot — which
     belongs on the crown of a sphere and nowhere else. */
  const S = `url(#${uid}-soft)`;
  const D = `url(#${uid}-limb)`;
  const M = `url(#${uid}-mech)`;                // the machine half
  const Bm = mixc(B, "#101826", .45);           // steel takes a cooler contour
  /* fill → form shadow → key highlight → outline, same five-pass rig as the
     robots and the gear */
  const P = (d, f, o = {}) => {
    const cid = `${uid}-c${Math.abs(hashd(d))}`;
    return (
      <g>
        <path d={d} fill={f} />
        <path d={d} fill={`url(#${uid}-occ)`} opacity={o.occ == null ? 1 : o.occ} />
        {/* a warm key and a cool bounce, rather than one white wash */}
        <path d={d} fill={`url(#${uid}-warm)`} />
        <path d={d} fill={`url(#${uid}-cool)`} />
        <path d={d} fill={`url(#${uid}-spec)`} opacity={o.spec == null ? 1 : o.spec} />
        <path d={d} fill={`url(#${uid}-rim)`} />
        {/* the bevel: a lit lip along the top edge, a shadow along the bottom.
            Clipped to the part so it stays a thickness and not an outline. */}
        <g clipPath={`url(#${cid})`}>
          <path d={d} fill="none" stroke="#ffffff" strokeWidth={(o.lw || 1.7) * 1.4} strokeLinejoin="round" opacity=".4" transform="translate(0 -1)" />
          <path d={d} fill="none" stroke="#00060f" strokeWidth={(o.lw || 1.7) * 1.4} strokeLinejoin="round" opacity=".26" transform="translate(0 1.2)" />
        </g>
        <path d={d} fill="none" stroke={B} strokeWidth={o.lw || 1.7} strokeLinejoin="round" opacity={o.lineOp == null ? .9 : o.lineOp} />
        <clipPath id={cid}><path d={d} /></clipPath>
      </g>
    );
  };
  const seam = (d, o = .45) => <path d={d} fill="none" stroke={B} strokeWidth="1.2" strokeLinecap="round" opacity={o} />;
  /* A bracer is a band clamped AROUND a limb, so it has to be built where that
     limb's own geometry and rotation live. Drawn from outside the limb group
     it drifts off the arm — which is exactly what it was doing. */
  const bracer = (bx, byy, w = 15, h = 9) => (
    <g>
      <path d={rr(bx, byy, w, h, 3)} fill={M} stroke={Bm} strokeWidth="1.3" />
      <path d={rr(bx, byy, w * .74, h * .3, 1.3)} fill={T.c} opacity=".95" />
      <path d={rr(bx, byy - h * .22, w * .78, h * .16, 1)} fill="#fff" opacity=".3" />
    </g>
  );

  /* ── ears ── drawn behind the head so they read as attached to it */
  const EARS = {
    bolt: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .5} ${hy - hr * .78} L${cx + k * hr * .3} ${hy - hr * 1.86} L${cx + k * hr * 1.32} ${hy - hr * 1.42} L${cx + k * hr * .82} ${hy - hr * 1.38} L${cx + k * hr * 1.2} ${hy - hr * .74} Z`}
          fill={S} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />
        {/* inner ear — an ear with one flat colour is a paper cut-out */}
        <path d={`M${cx + k * hr * .56} ${hy - hr * .86} L${cx + k * hr * .44} ${hy - hr * 1.58} L${cx + k * hr * 1.0} ${hy - hr * 1.34} Z`} fill={T.c} opacity=".38" />
      </g>))}</>,
    horn: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .58} ${hy - hr * .7} C${cx + k * hr * .68} ${hy - hr * 1.42} ${cx + k * hr * 1.3} ${hy - hr * 1.74} ${cx + k * hr * 1.62} ${hy - hr * 1.64} C${cx + k * hr * 1.32} ${hy - hr * 1.3} ${cx + k * hr * 1.24} ${hy - hr * .82} ${cx + k * hr * 1.06} ${hy - hr * .5} Z`}
          fill={S} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />
        <ellipse cx={cx + k * hr} cy={hy - hr * 1.05} rx={hr * .15} ry={hr * .28} fill={T.c} opacity=".3" transform={`rotate(${k * 22} ${cx + k * hr} ${hy - hr * 1.05})`} />
      </g>))}</>,
    fin:  <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .62} ${hy - hr * .5} C${cx + k * hr * 1.3} ${hy - hr * 1.16} ${cx + k * hr * 1.96} ${hy - hr * 1.02} ${cx + k * hr * 2.04} ${hy - hr * .44} C${cx + k * hr * 1.6} ${hy - hr * .18} ${cx + k * hr * 1.06} ${hy + hr * .06} ${cx + k * hr * .78} ${hy + hr * .18} Z`}
          fill={S} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />
        <path d={`M${cx + k * hr * .96} ${hy - hr * .48} L${cx + k * hr * 1.72} ${hy - hr * .56}`} stroke={B} strokeWidth="1.1" opacity=".45" />
      </g>))}</>,
    leaf: <>{[-1, 1].map(k => (
      <path key={k} d={`M${cx + k * hr * .24} ${hy - hr * .82} C${cx + k * hr * .3} ${hy - hr * 1.8} ${cx + k * hr * 1.06} ${hy - hr * 2.0} ${cx + k * hr * 1.5} ${hy - hr * 1.78} C${cx + k * hr * 1.16} ${hy - hr * 1.42} ${cx + k * hr * .8} ${hy - hr * 1.06} ${cx + k * hr * .52} ${hy - hr * .78} Z`}
        fill={S} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />))}
      {seam(`M${cx} ${hy - hr * .9} V${hy - hr * 1.7}`, .4)}</>,
    halo: <>
      <ellipse cx={cx} cy={hy - hr * 1.42} rx={hr * .96} ry={hr * .28} fill="none" stroke={A} strokeWidth="4.2" opacity=".92" />
      <ellipse cx={cx} cy={hy - hr * 1.42} rx={hr * .96} ry={hr * .28} fill="none" stroke="#fff" strokeWidth="1.3" opacity=".7" />
      {seam(`M${cx} ${hy - hr * .96} V${hy - hr * 1.3}`, .5)}</>,
    /* long, soft, upright — the single loudest "this one is cute" signal
       available, which is why it gets the tallest silhouette in the set */
    bunny: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .42} ${hy - hr * .72} C${cx + k * hr * .18} ${hy - hr * 1.7} ${cx + k * hr * .62} ${hy - hr * 2.5} ${cx + k * hr * 1.02} ${hy - hr * 2.42} C${cx + k * hr * 1.24} ${hy - hr * 1.72} ${cx + k * hr * 1.06} ${hy - hr} ${cx + k * hr * .86} ${hy - hr * .62} Z`}
          fill={S} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />
        <path d={`M${cx + k * hr * .58} ${hy - hr * .84} C${cx + k * hr * .44} ${hy - hr * 1.6} ${cx + k * hr * .74} ${hy - hr * 2.14} ${cx + k * hr * .96} ${hy - hr * 2.08} C${cx + k * hr * 1.06} ${hy - hr * 1.6} ${cx + k * hr * .92} ${hy - hr * 1.06} ${cx + k * hr * .8} ${hy - hr * .8} Z`}
          fill={T.c} opacity=".34" />
      </g>))}</>,
    /* swept blades, drawn with feather seams so they read as a wing rather
       than as two triangles stuck on a skull */
    wing: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .6} ${hy - hr * .56} C${cx + k * hr * 1.5} ${hy - hr * 1.3} ${cx + k * hr * 2.26} ${hy - hr * 1.16} ${cx + k * hr * 2.46} ${hy - hr * .5} C${cx + k * hr * 1.88} ${hy - hr * .42} ${cx + k * hr * 1.2} ${hy - hr * .16} ${cx + k * hr * .82} ${hy + hr * .12} Z`}
          fill={S} stroke={B} strokeWidth="1.4" strokeLinejoin="round" />
        {[0, 1, 2].map(i => (
          <path key={i} d={`M${cx + k * hr * (1.02 + i * .42)} ${hy - hr * (.74 - i * .06)} L${cx + k * hr * (1.26 + i * .42)} ${hy - hr * (.32 - i * .02)}`}
            stroke={B} strokeWidth="1" opacity=".42" />))}
      </g>))}</>,
    /* two springs with a lit bobble on the end. Nothing says "small friendly
       machine" faster than a bobble that wobbles. */
    antenna: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .3} ${hy - hr * .86} C${cx + k * hr * .36} ${hy - hr * 1.5} ${cx + k * hr * .84} ${hy - hr * 1.72} ${cx + k * hr * .9} ${hy - hr * 2.16}`}
          fill="none" stroke={A} strokeWidth="3.2" strokeLinecap="round" />
        <circle cx={cx + k * hr * .9} cy={hy - hr * 2.36} r={hr * .24} fill={T.c} stroke={B} strokeWidth="1.2" />
        <circle cx={cx + k * hr * .82} cy={hy - hr * 2.44} r={hr * .08} fill="#fff" opacity=".8" />
      </g>))}</>,
    /* a spiked band across the crown, tallest in the middle */
    crown: <>
      <path d={`M${cx - hr * .98} ${hy - hr * .78} L${cx - hr * .72} ${hy - hr * 1.66} L${cx - hr * .38} ${hy - hr} L${cx} ${hy - hr * 1.98} L${cx + hr * .38} ${hy - hr} L${cx + hr * .72} ${hy - hr * 1.66} L${cx + hr * .98} ${hy - hr * .78} Z`}
        fill={S} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={cx} cy={hy - hr * 1.7} r={hr * .16} fill={T.c} /></>,
    /* hound ears, hanging DOWN past the jaw — the only pair here that adds
       width at the bottom of the head instead of height at the top */
    flop: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .72} ${hy - hr * .66} C${cx + k * hr * 1.5} ${hy - hr * .5} ${cx + k * hr * 1.66} ${hy + hr * .36} ${cx + k * hr * 1.3} ${hy + hr * 1.04} C${cx + k * hr} ${hy + hr * 1.5} ${cx + k * hr * .52} ${hy + hr * 1.2} ${cx + k * hr * .6} ${hy + hr * .5} Z`}
          fill={S} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />
        <path d={`M${cx + k * hr * .88} ${hy - hr * .38} C${cx + k * hr * 1.34} ${hy - hr * .18} ${cx + k * hr * 1.4} ${hy + hr * .44} ${cx + k * hr * 1.14} ${hy + hr * .86}`}
          fill="none" stroke={T.c} strokeWidth="1.6" opacity=".32" />
      </g>))}</>,
  };

  /* ── tails ── anchored to the back of the torso */
  /* tails hang off the back of the torso, clamped so a wide quad's tail
     still fits inside the box */
  const tx = cx + Math.min(bw * .38, 19), ty = by - bh * .02;
  const TAILS = {
    spark: <path d={`M${tx} ${ty + 4} L${tx + 15} ${ty - 10} L${tx + 7} ${ty + 1} L${tx + 20} ${ty - 2} L${tx + 3} ${ty + 17} L${tx + 8} ${ty + 3} Z`} fill={S} stroke={B} strokeWidth="1.4" strokeLinejoin="round" />,
    flame: <path d={`M${tx - 2} ${ty + 8} C${tx + 12} ${ty + 4} ${tx + 18} ${ty - 8} ${tx + 15} ${ty - 20} C${tx + 24} ${ty - 8} ${tx + 25} ${ty + 10} ${tx + 12} ${ty + 18} C${tx + 5} ${ty + 21} ${tx - 2} ${ty + 16} ${tx - 2} ${ty + 8} Z`} fill={S} stroke={B} strokeWidth="1.4" strokeLinejoin="round" />,
    wisp:  <>
      <path d={`M${tx - 2} ${ty + 8} C${tx + 13} ${ty + 3} ${tx + 19} ${ty - 9} ${tx + 14} ${ty - 20}`} fill="none" stroke={A} strokeWidth="5.4" strokeLinecap="round" opacity=".92" />
      <circle cx={tx + 14} cy={ty - 23} r="3.6" fill={T.c} opacity=".9" /></>,
    vine:  <>
      <path d={`M${tx - 2} ${ty + 9} C${tx + 13} ${ty + 5} ${tx + 19} ${ty - 6} ${tx + 15} ${ty - 16}`} fill="none" stroke={A} strokeWidth="4.6" strokeLinecap="round" />
      <path d={ell(tx + 16, ty - 21, 7.5, 5)} fill={S} stroke={B} strokeWidth="1.3" transform={`rotate(-28 ${tx + 16} ${ty - 21})`} /></>,
    gear:  <>
      <path d={`M${tx - 2} ${ty + 8} H${tx + 10}`} stroke={A} strokeWidth="4.6" strokeLinecap="round" />
      {[0, 45, 90, 135].map(a => <rect key={a} x={tx + 15.5} y={ty - 2.5} width="15" height="5" rx="1.6" fill={S} stroke={B} strokeWidth="1" transform={`rotate(${a} ${tx + 18} ${ty + 8}) translate(0 ${8})`} />)}
      <circle cx={tx + 18} cy={ty + 8} r="8" fill={S} stroke={B} strokeWidth="1.5" />
      <circle cx={tx + 18} cy={ty + 8} r="3.2" fill={B} /></>,
    /* a fluff ball on a stub. Round, soft, and the only tail here with no
       point on it anywhere. */
    puff: <>
      <path d={`M${tx - 2} ${ty + 8} C${tx + 8} ${ty + 6} ${tx + 12} ${ty + 2} ${tx + 13} ${ty - 2}`} fill="none" stroke={A} strokeWidth="5" strokeLinecap="round" />
      <path d={ell(tx + 18, ty - 6, 11, 10)} fill={S} stroke={B} strokeWidth="1.5" />
      <path d={ell(tx + 14, ty - 10, 4, 3.4)} fill="#fff" opacity=".3" /></>,
    /* a scythe. Straight edges and one hard point, because a curve reads as
       friendly however sharp you make the tip. */
    blade: <>
      <path d={`M${tx - 2} ${ty + 9} L${tx + 26} ${ty - 22} L${tx + 22} ${ty - 4} L${tx + 30} ${ty - 8} L${tx + 8} ${ty + 16} Z`}
        fill={S} stroke={B} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={`M${tx + 4} ${ty + 8} L${tx + 22} ${ty - 14}`} stroke="#fff" strokeWidth="1.4" opacity=".38" /></>,
    /* a spring, with a lit tip that trails behind whatever it is attached to */
    coil: <>
      <path d={`M${tx - 2} ${ty + 8} C${tx + 10} ${ty + 8} ${tx + 10} ${ty - 2} ${tx + 2} ${ty - 2} C${tx - 6} ${ty - 2} ${tx - 4} ${ty - 14} ${tx + 8} ${ty - 13} C${tx + 20} ${ty - 12} ${tx + 20} ${ty - 24} ${tx + 10} ${ty - 24}`}
        fill="none" stroke={A} strokeWidth="4" strokeLinecap="round" />
      <circle cx={tx + 9} cy={ty - 26} r="3.4" fill={T.c} stroke={B} strokeWidth="1.1" /></>,
    /* three feathers off one shaft, each turned a little further and a little
       fainter, so the fan has depth rather than being a flat sticker */
    plume: <>
      <path d={`M${tx - 2} ${ty + 8} C${tx + 10} ${ty + 6} ${tx + 16} ${ty - 2} ${tx + 17} ${ty - 12}`} fill="none" stroke={A} strokeWidth="4" strokeLinecap="round" />
      {[-26, -4, 16].map((a, i) => (
        <path key={i} d={`M${tx + 16} ${ty - 10} C${tx + 24} ${ty - 20} ${tx + 32} ${ty - 22} ${tx + 34} ${ty - 16} C${tx + 30} ${ty - 8} ${tx + 22} ${ty - 4} ${tx + 16} ${ty - 6} Z`}
          fill={S} stroke={B} strokeWidth="1.2" strokeLinejoin="round"
          transform={`rotate(${a} ${tx + 16} ${ty - 10})`} opacity={.94 - i * .12} />))}</>,
    /* a trail of bubbles, getting smaller and fainter as they rise */
    bubble: <>
      <path d={`M${tx - 2} ${ty + 8} C${tx + 8} ${ty + 7} ${tx + 12} ${ty + 3} ${tx + 13} ${ty - 1}`} fill="none" stroke={A} strokeWidth="4" strokeLinecap="round" />
      {[[16, -6, 7], [25, -16, 5], [31, -26, 3.2]].map(([dx2, dy2, r2], i) => (
        <g key={i}>
          <circle cx={tx + dx2} cy={ty + dy2} r={r2} fill={S} stroke={B} strokeWidth="1.2" opacity={.9 - i * .16} />
          <circle cx={tx + dx2 - r2 * .34} cy={ty + dy2 - r2 * .38} r={r2 * .3} fill="#fff" opacity=".55" />
        </g>))}</>,
  };

  /* ── eyes ── one rig, five expressions; every one narrows when sad */
  const ey = hy + hr * .1, ex = hr * .46, er = hr * .34;
  const EYES = {
    big: <>{[-1, 1].map(k => {
      const ry = sad ? er * .58 : er * 1.1;
      return (
      <g key={k}>
        {/* the socket the eye sits IN — a flat disc on the face is the single
            biggest reason a cartoon face reads as a sticker */}
        <path d={ell(cx + k * ex, ey + er * .1, er * 1.2, ry * 1.12)} fill="#00060f" opacity=".22" />
        <path d={ell(cx + k * ex, ey, er, ry)} fill="#0d1424" />
        <path d={ell(cx + k * ex, ey, er * .82, ry * .82)} fill={`url(#${uid}-iris)`} />
        {/* a ring of the element around the iris, so the eye has an edge */}
        <path d={ell(cx + k * ex, ey, er * .84, ry * .84)} fill="none" stroke={T.c} strokeWidth={er * .12} opacity=".55" />
        {/* the glass over it: one big soft dome plus a hard little catchlight */}
        <path d={`M${cx + k * ex - er * .86} ${ey - ry * .25} C${cx + k * ex - er * .6} ${ey - ry * .95} ${cx + k * ex + er * .5} ${ey - ry * 1.02} ${cx + k * ex + er * .8} ${ey - ry * .4} C${cx + k * ex + er * .3} ${ey - ry * .72} ${cx + k * ex - er * .4} ${ey - ry * .66} ${cx + k * ex - er * .86} ${ey - ry * .25} Z`}
          fill="#ffffff" opacity=".55" />
        <circle cx={cx + k * ex - er * .3} cy={ey - ry * .34} r={er * .34} fill="#fff" />
        <circle cx={cx + k * ex + er * .3} cy={ey + ry * .4} r={er * .17} fill="#fff" opacity=".85" />
      </g>);
    })}</>,
    sharp: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * (ex + er * .95)} ${ey - er * (sad ? .1 : .55)} L${cx + k * (ex - er * .8)} ${ey - er * .1} L${cx + k * (ex + er * .85)} ${ey + er * .72} Z`} fill="#0d1424" />
        <circle cx={cx + k * ex} cy={ey + er * .06} r={er * .34} fill={T.c} />
      </g>))}</>,
    sleepy: <>{[-1, 1].map(k => (
      <path key={k} d={`M${cx + k * (ex + er * .95)} ${ey - er * .1} C${cx + k * ex} ${ey + er * .86} ${cx + k * (ex - er * .95)} ${ey + er * .6} ${cx + k * (ex - er * .95)} ${ey - er * .12}`}
        fill="none" stroke="#0d1424" strokeWidth="3" strokeLinecap="round" />))}</>,
    visor: <>
      <path d={rr(cx, ey, hr * 1.62, er * 1.5, er * .5)} fill="#0d1424" />
      <path d={rr(cx, ey - er * .12, hr * 1.42, er * .72, er * .3)} fill={T.c} opacity={sad ? .45 : .9} />
      <path d={`M${cx - hr * .74} ${ey - er * .5} L${cx - hr * .3} ${ey - er * .5} L${cx - hr * .52} ${ey + er * .5} L${cx - hr * .92} ${ey + er * .5} Z`} fill="#fff" opacity=".3" />
      <circle cx={cx - hr * .5} cy={ey + er * .36} r={er * .2} fill="#fff" opacity=".85" /></>,
    starry: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={ell(cx + k * ex, ey + er * .1, er * 1.2, (sad ? er * .6 : er * 1.08) * 1.12)} fill="#00060f" opacity=".22" />
        <path d={ell(cx + k * ex, ey, er, sad ? er * .6 : er * 1.08)} fill="#0d1424" />
        <path d={`M${cx + k * ex} ${ey - er * .86} L${cx + k * ex + er * .24} ${ey - er * .22} L${cx + k * ex + er * .74} ${ey} L${cx + k * ex + er * .24} ${ey + er * .22} L${cx + k * ex} ${ey + er * .86} L${cx + k * ex - er * .24} ${ey + er * .22} L${cx + k * ex - er * .74} ${ey} L${cx + k * ex - er * .24} ${ey - er * .22} Z`} fill={T.c} />
        <path d={`M${cx + k * ex - er * .84} ${ey - er * .3} C${cx + k * ex - er * .6} ${ey - er * .95} ${cx + k * ex + er * .5} ${ey - er} ${cx + k * ex + er * .78} ${ey - er * .42} C${cx + k * ex + er * .3} ${ey - er * .72} ${cx + k * ex - er * .4} ${ey - er * .66} ${cx + k * ex - er * .84} ${ey - er * .3} Z`}
          fill="#ffffff" opacity=".5" />
        <circle cx={cx + k * ex - er * .34} cy={ey - er * .34} r={er * .26} fill="#fff" />
      </g>))}</>,
    /* one eye shut. The blush is not decoration — without it a closed eye
       reads as hurt rather than as pleased with itself. */
    wink: <>
      <g>
        <path d={ell(cx - ex, ey + er * .1, er * 1.2, (sad ? er * .58 : er * 1.1) * 1.12)} fill="#00060f" opacity=".22" />
        <path d={ell(cx - ex, ey, er, sad ? er * .58 : er * 1.1)} fill="#0d1424" />
        <path d={ell(cx - ex, ey, er * .82, (sad ? er * .58 : er * 1.1) * .82)} fill={`url(#${uid}-iris)`} />
        <circle cx={cx - ex - er * .3} cy={ey - er * .38} r={er * .34} fill="#fff" />
        <path d={`M${cx + ex - er * .9} ${ey + er * .14} C${cx + ex - er * .3} ${ey - er * .72} ${cx + ex + er * .3} ${ey - er * .72} ${cx + ex + er * .9} ${ey + er * .14}`}
          fill="none" stroke="#0d1424" strokeWidth="3.1" strokeLinecap="round" />
      </g>
      {[-1, 1].map(k => (
        <ellipse key={k} cx={cx + k * (ex + er * 1.22)} cy={ey + er * .95} rx={er * .58} ry={er * .3}
          fill="#ff8aa4" opacity={sad ? .18 : .4} />))}</>,
    /* a vertical slit on a lit iris. Nothing else in the set is unfriendly on
       its own; this one is. */
    slit: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={ell(cx + k * ex, ey, er * 1.02, sad ? er * .6 : er * 1.02)} fill="#0d1424" />
        <path d={ell(cx + k * ex, ey, er * .86, sad ? er * .5 : er * .88)} fill={T.c} opacity=".92" />
        <path d={ell(cx + k * ex, ey, er * .2, sad ? er * .42 : er * .8)} fill="#08101e" />
        <circle cx={cx + k * ex - er * .34} cy={ey - er * .4} r={er * .18} fill="#fff" opacity=".8" />
      </g>))}</>,
    /* two dots and two blushes. The least drawing in the set, and the most
       obviously a baby animal. */
    dot: <>
      {[-1, 1].map(k => (
        <g key={k}>
          <circle cx={cx + k * ex} cy={ey} r={sad ? er * .3 : er * .46} fill="#0d1424" />
          <circle cx={cx + k * ex - er * .16} cy={ey - er * .18} r={er * .16} fill="#fff" opacity=".9" />
        </g>))}
      {[-1, 1].map(k => (
        <ellipse key={"b" + k} cx={cx + k * (ex + er * 1.2)} cy={ey + er * .78} rx={er * .6} ry={er * .32}
          fill="#ff8aa4" opacity={sad ? .16 : .42} />))}</>,
    /* one wide scanner instead of a pair of eyes: a machine that LOOKS at you
       rather than a face that looks back */
    scan: <>
      <path d={rr(cx, ey, hr * 1.16, er * 1.62, er * .8)} fill="#0d1424" />
      <path d={ell(cx, ey, hr * .46, er * (sad ? .42 : .74))} fill={T.c} opacity=".95" />
      <path d={ell(cx, ey, hr * .2, er * (sad ? .26 : .46))} fill="#fff" opacity=".9" />
      <path d={`M${cx - hr * .96} ${ey - er * .5} L${cx - hr * .5} ${ey - er * .5} L${cx - hr * .72} ${ey + er * .46} L${cx - hr * 1.12} ${ey + er * .46} Z`}
        fill="#fff" opacity=".22" /></>,
  };

  /* ── build-specific limbs ── */
  const legTop = bBot - 3, legH = Math.max(6, GROUND - 4 - legTop);
  const limbs = { back: null, front: null };
  /* Limbs used to be drawn in the MECH material — cold grey steel — with only
     the paw in the creature's colour. Two-thirds of the standing figure was
     therefore a grey doll with a coloured head balanced on it, which is the
     single reason these read as assembled rather than alive. The limb is the
     animal now; the machine shows at the joint, where a joint actually is. */
  if (sp.build === "biped") {
    const lw = Math.max(8, bw * .28);
    limbs.back = <>{[-1, 1].map(k => (
      <g key={k} transform={`rotate(${k * 12} ${cx + k * (bw / 2 - 1)} ${bTop + bh * .34})`}>
        {P(rr(cx + k * (bw / 2 + 2), bTop + bh * .34 + L.arm / 2, 9.5, L.arm, 4.6), S, { spec: .85, lw: 1.3 })}
        {/* the shoulder joint: one small machined ring where the limb meets */}
        {P(ell(cx + k * (bw / 2 + 2), bTop + bh * .34 + 2, 4.4, 3.4), M, { spec: 1, occ: .8, lw: 1 })}
        {P(ell(cx + k * (bw / 2 + 2), bTop + bh * .34 + L.arm, 6, 5.4), F, { spec: .8, lw: 1.4 })}
        {/* three little nubs: a paw rather than a pill */}
        {[-1, 0, 1].map(j => (
          <ellipse key={j} cx={cx + k * (bw / 2 + 2) + j * 3.2} cy={bTop + bh * .34 + L.arm + 3.4} rx="1.3" ry="2" fill={B} opacity=".26" />))}
        {has(5) && bracer(cx + k * (bw / 2 + 2), bTop + bh * .34 + L.arm - 8, 13, 8)}
      </g>))}</>;
    limbs.front = <>{[-1, 1].map(k => (
      <g key={k}>
        {P(rr(cx + k * bw * .26, legTop + legH / 2, lw, legH, lw * .42), S, { spec: .85, lw: 1.3 })}
        {P(ell(cx + k * bw * .26, legTop + 1.6, lw * .42, 3), M, { spec: 1, occ: .8, lw: 1 })}
        {P(ell(cx + k * bw * .28, GROUND - 3.5, lw * .72, 4.6), F, { spec: .7, lw: 1.4 })}
        {/* three toes — the difference between a foot and a pill */}
        {[-1, 0, 1].map(j => (
          <ellipse key={j} cx={cx + k * bw * .28 + j * lw * .26} cy={GROUND - 4.6} rx={lw * .13} ry={2} fill={B} opacity=".28" />))}
        {seam(`M${cx + k * bw * .26 - lw * .3} ${legTop + legH * .5} h${lw * .6}`, .35)}
      </g>))}</>;
  } else if (sp.build === "quad") {
    limbs.back = <>
      {/* haunches, so a crouched quad has shoulders. They belong BEHIND the
          torso: drawn in front they stop being haunches and become two eggs
          parked on the creature's chest. */}
      {[-1, 1].map(k => P(ell(cx + k * bw * .38, by + bh * .04, bw * .16, bh * .4), F, { spec: .45, occ: .85, lw: 1.3 }))}
      {[-1, 1].map(k => (
      <g key={k} opacity=".82">
        {P(rr(cx + k * bw * .42, bBot - 1, 9, GROUND - 5 - bBot + 2, 4.4), S, { spec: .6, lw: 1.2 })}
        {P(ell(cx + k * bw * .42, GROUND - 3.5, 6.6, 4.4), D, { spec: .5, lw: 1.3 })}
      </g>))}</>;
    limbs.front = <>{[-1, 1].map(k => (
      <g key={k}>
        {P(rr(cx + k * bw * .2, bBot - 1, 10.5, GROUND - 4 - bBot + 2, 5), S, { spec: .85, lw: 1.3 })}
        {P(ell(cx + k * bw * .2, bBot + 1.5, 4.6, 3.2), M, { spec: 1, occ: .8, lw: 1 })}
        {P(ell(cx + k * bw * .21, GROUND - 3, 8, 5), F, { spec: .8, lw: 1.4 })}
        {[-1, 0, 1].map(j => (
          <ellipse key={j} cx={cx + k * bw * .21 + j * 2.8} cy={GROUND - 4} rx="1.4" ry="2.1" fill={B} opacity=".28" />))}
        {[0, 1].map(j => seam(`M${cx + k * bw * .21 - 3.6 + j * 3.6} ${GROUND - 5.6} v3`, .5))}
        {has(5) && bracer(cx + k * bw * .2, GROUND - 25, 13, 7.4)}
      </g>))}</>;
  } else {
    limbs.front = <>{[-1, 1].map(k => (
      <g key={k}>
        {P(ell(cx + k * (bw / 2 + 5), by - bh * .1, 6.2, L.arm * .42), S, { spec: .75, lw: 1.4 })}
        {[-1, 0, 1].map(j => (
          <ellipse key={j} cx={cx + k * (bw / 2 + 5) + j * 3.2} cy={by - bh * .1 + L.arm * .42 - 1.4} rx="1.3" ry="2" fill={B} opacity=".26" />))}
        {has(5) && bracer(cx + k * (bw / 2 + 5), by - bh * .1 + L.arm * .12, 12.4, 7.4)}
      </g>))}
      {/* a short skirt and two thrusters instead of legs, riding a hover ring */}
      {P(`M${cx - bw * .38} ${bBot - 4} C${cx - bw * .3} ${bBot + 9} ${cx + bw * .3} ${bBot + 9} ${cx + bw * .38} ${bBot - 4} Z`, M, { spec: 1, lw: 1.4 })}
      {[-1, 1].map(k => <circle key={k} cx={cx + k * bw * .22} cy={bBot + 8} r="4.2" fill={T.c} opacity=".8" />)}
      {[-1, 1].map(k => <ellipse key={k} cx={cx + k * bw * .22} cy={bBot + 15} rx="4.6" ry="7" fill={`url(#${uid}-glow)`} opacity=".55" />)}
      <ellipse cx={cx} cy={GROUND - 9} rx={bw * .5} ry="4" fill="none" stroke={T.c} strokeWidth="2.4" opacity=".55" />
      <ellipse cx={cx} cy={GROUND - 5} rx={bw * .34} ry="3" fill="none" stroke={T.c} strokeWidth="1.6" opacity=".3" /></>;
  }

  /* ── torso ── loaf for a quad, barrel for the others */
  const torso = sp.build === "quad" ? ell(cx, by, bw / 2, bh / 2) : rr(cx, by, bw, bh, bw * .36);
  const coreY = sp.build === "quad" ? by - bh * .1 : by - bh * .06;

  return (
    <svg className={`pa pa-${sp.build} ${className}`} viewBox="-12 -18 144 156" width={size || "100%"} height={size || "100%"} aria-hidden="true">
      <defs>
        {/* The old first stop was pure white at 90% covering the top quarter
            of every shape, which blew the head out to a glass bauble and took
            the colour with it. It is the creature's own colour lifted toward
            white now, and it stops sooner. */}
        {/* Six stops, and the third is a LIFT rather than another step down:
            that band is the room reflected in a rounded body, and it is what
            makes a creature read as something with volume you could pick up
            instead of a shape with a gradient poured into it. The last stop
            keeps the animal's own hue, so nothing dies into navy. */}
        <linearGradient id={`${uid}-body`} x1="0.18" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={mixc(A, "#ffffff", .72)} />
          <stop offset="15%" stopColor={mixc(A, "#ffffff", .18)} />
          <stop offset="33%" stopColor={mixc(A, "#ffffff", .46)} />
          <stop offset="58%" stopColor={A2} />
          <stop offset="82%" stopColor={mixc(A2, B, .62)} />
          <stop offset="100%" stopColor={mixc(B, A, .18)} />
        </linearGradient>
        {/* the same material without the crown highlight, for anything that is
            not a sphere: ears, tails, limbs */}
        {/* the pale front, fading out at its edge so it is a MARKING and not
            a sticker with an outline */}
        {/* The underside of an animal is a LIGHTER VERSION OF ITS OWN COAT, not
            a cream patch: at four-fifths of the way to white every species got
            the same pale belly, which bleached the middle of the figure and
            took the colour with it. */}
        <radialGradient id={`${uid}-belly`} cx="0.5" cy="0.36" r="0.72">
          <stop offset="0%" stopColor={mixc(A, "#fffaf2", .52)} />
          <stop offset="58%" stopColor={mixc(A, "#fffaf2", .3)} stopOpacity=".9" />
          <stop offset="100%" stopColor={mixc(A, "#fffaf2", .26)} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-soft`} x1="0.2" y1="0" x2="0.78" y2="1">
          <stop offset="0%" stopColor={mixc(A, "#ffffff", .3)} />
          <stop offset="34%" stopColor={mixc(A, "#ffffff", .44)} />
          <stop offset="60%" stopColor={A2} />
          <stop offset="100%" stopColor={mixc(B, A, .18)} />
        </linearGradient>
        <linearGradient id={`${uid}-limb`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={mixc(A2, "#ffffff", .22)} />
          <stop offset="46%" stopColor={A2} />
          <stop offset="100%" stopColor={mixc(B, A, .14)} />
        </linearGradient>
        {/* ── the second material ──
            Half creature, half machine only reads if the machine half is made
            of something else. Every part of these was one hue at one value,
            which is why they came out looking like painted plastic toys rather
            than cyborgs; the bolted-on parts now wear steel instead, tinted a
            little toward the species so it belongs to this animal and not to a
            parts bin. */}
        <linearGradient id={`${uid}-mech`} x1="0.2" y1="0" x2="0.78" y2="1">
          <stop offset="0%" stopColor={mixc("#eef4ff", A, .14)} />
          <stop offset="26%" stopColor={mixc("#b9c8dd", A, .18)} />
          <stop offset="62%" stopColor={mixc("#6d7f99", A, .22)} />
          <stop offset="100%" stopColor={mixc("#2c3849", A, .18)} />
        </linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0%" stopColor={T.c} stopOpacity={rim} />
          <stop offset="52%" stopColor={T.c} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-iris`}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor={T.c} />
          <stop offset="100%" stopColor={B} />
        </radialGradient>
        <linearGradient id={`${uid}-warm`} x1="0.12" y1="0" x2="0.78" y2="0.9">
          <stop offset="0%" stopColor="#fff1d8" stopOpacity=".36" />
          <stop offset="34%" stopColor="#ffe3b8" stopOpacity=".08" />
          <stop offset="100%" stopColor="#ffe3b8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-cool`} x1="0.88" y1="1" x2="0.32" y2="0.16">
          <stop offset="0%" stopColor="#9fc8ff" stopOpacity=".3" />
          <stop offset="42%" stopColor="#9fc8ff" stopOpacity=".05" />
          <stop offset="100%" stopColor="#9fc8ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="40%" stopColor={T.c} stopOpacity=".85" />
          <stop offset="100%" stopColor={T.c} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-occ`} x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0%" stopColor="#000814" stopOpacity="0" />
          <stop offset="52%" stopColor="#000814" stopOpacity=".06" />
          <stop offset="100%" stopColor="#000814" stopOpacity=".36" />
        </linearGradient>
        <linearGradient id={`${uid}-spec`} x1="0.08" y1="0" x2="0.7" y2="0.92">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".62" />
          <stop offset="28%" stopColor="#ffffff" stopOpacity=".17" />
          <stop offset="58%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* the light the creature itself gives off — faint as a hatchling, a real
          aura once it is grown. Behind everything, so it reads as glow. */}
      <ellipse cx={cx} cy={by - bh * .1} rx={bw * 1.28} ry={(hr + bh) * .98}
        fill={`url(#${uid}-glow)`} opacity={0.08 + g * 0.15} />
      {/* ── standing on something ──
          One flat oval at 18% is a smudge under a sticker. A shadow has a
          dark CONTACT where the feet actually meet the floor and a soft
          spread around it, and the difference between those two is most of
          what makes a drawing sit down rather than hover. */}
      <ellipse cx={cx} cy={GROUND + 1} rx={bw * .84} ry="6.4" fill="#0b1526"
        opacity={sp.build === "float" ? .09 : .13} />
      <ellipse cx={cx} cy={GROUND + 1} rx={bw * .5} ry="3.8" fill="#0b1526"
        opacity={sp.build === "float" ? .07 : .2} />
      {/* a warm pool of its own colour on the floor underneath it */}
      <ellipse cx={cx} cy={GROUND - 1} rx={bw * .62} ry="4" fill={T.c} opacity={.1 + g * .16} />

      {/* L20 — a rune sigil burning behind it. Drawn first, so the creature
          stands IN FRONT of its own power rather than wearing it as a badge. */}
      {has(20) && <g opacity=".5">
        <circle cx={cx} cy={hy + 6} r={hr * 2.5} fill="none" stroke={T.c} strokeWidth="2.2" />
        <circle cx={cx} cy={hy + 6} r={hr * 2.0} fill="none" stroke={T.c} strokeWidth="1.1" opacity=".7" />
        {[0, 1, 2, 3, 4, 5].map(i => {
          const a = i * Math.PI / 3 - Math.PI / 2;
          return <path key={i} strokeLinecap="round" stroke={T.c} strokeWidth="1.8" opacity=".8"
            d={`M${cx + Math.cos(a) * hr * 2.0} ${hy + 6 + Math.sin(a) * hr * 2.0} L${cx + Math.cos(a) * hr * 2.5} ${hy + 6 + Math.sin(a) * hr * 2.5}`} />;
        })}
      </g>}

      {/* L12 — an aura ring on the floor, the last thing it earns */}
      {has(12) && <>
        <ellipse cx={cx} cy={GROUND - 2} rx={bw * .95} ry="9" fill="none" stroke={T.c} strokeWidth="2" opacity=".45" />
        <ellipse cx={cx} cy={GROUND - 2} rx={bw * .7} ry="6.4" fill="none" stroke="#fff" strokeWidth="1" opacity=".3" />
      </>}

      <g transform={"translate(60 " + GROUND + ") scale(" + SC.toFixed(3) + ") translate(-60 -" + GROUND + ")"}>
      <g className={sad ? "pa-sag" : "pa-bob"}>
        {/* L15 — a second tail, set behind and above the first so the pair
            reads as two rather than as one thick one */}
        {has(15) && (
          <g transform={`rotate(-16 ${tx} ${ty}) translate(0 ${-bh * .18})`} opacity=".9">
            {TAILS[sp.tail]}
          </g>)}
        {TAILS[sp.tail]}
        {/* L11 — the tail lights up */}
        {has(11) && <circle cx={tx + 16} cy={ty - 4} r={7} fill={`url(#${uid}-glow)`} opacity=".85" />}
        {limbs.back}
        {/* L8 — vents down the back, seen just past the shoulder line */}
        {has(8) && [-1, 1].map(k => (
          <g key={k}>
            <path d={rr(cx + k * bw * .5, bTop + bh * .34, 8, bh * .62, 3)} fill={B} opacity=".85" />
            {[0, 1, 2].map(j => (
              <rect key={j} x={cx + k * bw * .5 - 3} y={bTop + 5 + j * (bh * .2)} width="6" height="3.4" rx="1.6" fill={T.c} opacity=".92" />
            ))}
          </g>))}
        {/* L9 — wings, and L10 grows them */}
        {has(9) && [-1, 1].map(k => {
          const sp1 = has(10) ? 1.1 : .9, sp2 = has(10) ? 1.42 : 1.18, lift = has(10) ? 32 : 24;
          const wd = `M${cx + k * bw * .32} ${bTop + 4} C${cx + k * bw * sp1} ${bTop - lift} ${cx + k * bw * sp2} ${bTop - 2} ${cx + k * bw * .56} ${bTop + 20} Z`;
          const wc = `${uid}-w${k > 0 ? "r" : "l"}`;
          return (
            <g key={k}>
              <clipPath id={wc}><path d={wd} /></clipPath>
              <path d={wd} fill={T.c} opacity=".82" />
              <path d={wd} fill={`url(#${uid}-occ)`} opacity=".8" />
              <path d={wd} fill="none" stroke={B} strokeWidth="1.3" strokeLinejoin="round" />
              {/* a wing is a membrane stretched on ribs. Without them it is a
                  coloured blob, and the blob is what made these read as cut
                  paper. Clipped to the wing so a rib can never leave it. */}
              <g clipPath={`url(#${wc})`}>
                <ellipse cx={cx + k * bw * .78} cy={bTop - 4} rx={bw * .5} ry={lift * .5} fill="#ffffff" opacity=".16" />
                {[.42, .68, .94].map(t => (
                  <path key={t} fill="none" stroke={B} strokeWidth=".9" opacity=".24" strokeLinecap="round"
                    d={`M${cx + k * bw * .34} ${bTop + 6} Q${cx + k * bw * sp1 * t} ${bTop - lift * t * .7} ${cx + k * bw * sp2 * t} ${bTop + 16 - lift * t * .34}`} />))}
                <path d={wd} fill="none" stroke="#ffffff" strokeWidth="2.4" opacity=".34" strokeLinejoin="round" />
              </g>
            </g>);
        })}
        {P(torso, F, { spec: .62, bev: .2 })}
        {/* ── the belly ──
            A pale front is how almost every animal is marked, and it is the
            cheapest thing that turns a coloured lozenge into a body. It goes
            UNDER the hatch, so the machine still reads as set into it. */}
        {/* ── the coat marking ──
            The pale front was ONE oval on all thirty-two species, so below the
            ears they were the same animal in different paint. A marking is the
            cheapest thing that makes a coat belong to a species: a bib, a pair
            of stripes, a scale row, a flame licking up the belly. Every one is
            drawn in the same belly gradient, so it still reads as fur catching
            the light rather than as a decal stuck on. */}
        {(() => {
          const q = sp.build === "quad";
          const my = by + (q ? bh * .12 : bh * .1);
          const MARK = {
            patch:  [q ? ell(cx, my, bw * .34, bh * .3) : ell(cx, my, bw * .32, bh * .34)],
            bib:    [`M${cx - bw * .3} ${bTop + bh * .16} C${cx - bw * .32} ${by + bh * .18} ${cx - bw * .2} ${by + bh * .4} ${cx} ${by + bh * .46} C${cx + bw * .2} ${by + bh * .4} ${cx + bw * .32} ${by + bh * .18} ${cx + bw * .3} ${bTop + bh * .16} Z`],
            stripe: [rr(cx - bw * .15, my, bw * .13, bh * .52, bw * .065),
                     rr(cx + bw * .15, my, bw * .13, bh * .52, bw * .065)],
            band:   [rr(cx, my - bh * .04, bw * .62, bh * .22, bh * .11),
                     rr(cx, my + bh * .24, bw * .44, bh * .14, bh * .07)],
            spots:  [ell(cx - bw * .19, my - bh * .1, bw * .11, bh * .11),
                     ell(cx + bw * .17, my + bh * .06, bw * .1, bh * .1),
                     ell(cx - bw * .03, my + bh * .24, bw * .09, bh * .09)],
            scale:  [0, 1, 2].map(i => `M${cx - bw * .28} ${my - bh * .16 + i * bh * .17} Q${cx} ${my - bh * .02 + i * bh * .17} ${cx + bw * .28} ${my - bh * .16 + i * bh * .17} L${cx + bw * .28} ${my - bh * .08 + i * bh * .17} Q${cx} ${my + bh * .06 + i * bh * .17} ${cx - bw * .28} ${my - bh * .08 + i * bh * .17} Z`),
            heart:  [`M${cx} ${my + bh * .38} C${cx - bw * .34} ${my + bh * .1} ${cx - bw * .34} ${my - bh * .24} ${cx - bw * .15} ${my - bh * .24} C${cx - bw * .05} ${my - bh * .24} ${cx} ${my - bh * .14} ${cx} ${my - bh * .08} C${cx} ${my - bh * .14} ${cx + bw * .05} ${my - bh * .24} ${cx + bw * .15} ${my - bh * .24} C${cx + bw * .34} ${my - bh * .24} ${cx + bw * .34} ${my + bh * .1} ${cx} ${my + bh * .38} Z`],
            flame:  [`M${cx} ${my - bh * .3} C${cx + bw * .22} ${my - bh * .06} ${cx + bw * .26} ${my + bh * .22} ${cx} ${my + bh * .4} C${cx - bw * .26} ${my + bh * .22} ${cx - bw * .22} ${my - bh * .06} ${cx} ${my - bh * .3} Z`,
                     `M${cx} ${my - bh * .04} C${cx + bw * .1} ${my + bh * .1} ${cx + bw * .1} ${my + bh * .24} ${cx} ${my + bh * .32} C${cx - bw * .1} ${my + bh * .24} ${cx - bw * .1} ${my + bh * .1} ${cx} ${my - bh * .04} Z`],
            star:   [`M${cx} ${my - bh * .3} L${cx + bw * .1} ${my - bh * .04} L${cx + bw * .32} ${my} L${cx + bw * .15} ${my + bh * .16} L${cx + bw * .2} ${my + bh * .4} L${cx} ${my + bh * .27} L${cx - bw * .2} ${my + bh * .4} L${cx - bw * .15} ${my + bh * .16} L${cx - bw * .32} ${my} L${cx - bw * .1} ${my - bh * .04} Z`],
          };
          /* the chest hatch sits over the middle of the torso, so a marking
             that only had a soft fill lost its shape behind it. The contour is
             what survives: it reads round the hatch and tells you whether you
             are looking at a bib, a flame or a scale row. */
          return (MARK[sp.mark] || MARK.patch).map((d, i) => (
            <g key={i}>
              <path d={d} fill={`url(#${uid}-belly)`} opacity={i ? .7 : .95} />
              <path d={d} fill="none" stroke={mixc(A, "#ffffff", .62)} strokeWidth=".9"
                strokeLinejoin="round" opacity={i ? .34 : .5} />
            </g>));
        })()}
        {/* the chest hatch is there from the start; what changes is what is in
            it. Cut down from half the torso, because at that size it WAS the
            torso and the creature's colour never got a look in. */}
        {P(rr(cx, coreY, bw * .36, bh * .34, 3.4), M, { spec: 1, occ: .7, lw: 1.1, lineOp: .5 })}
        {seam(`M${cx - bw * .2} ${coreY - bh * .16} h${bw * .4}`, .4)}
        {/* L4 — a proper chest plate over the hatch */}
        {has(4) && P(`M${cx - bw * .36} ${coreY - bh * .3} H${cx + bw * .36} L${cx + bw * .28} ${coreY + bh * .16} L${cx} ${coreY + bh * .34} L${cx - bw * .28} ${coreY + bh * .16} Z`,
          F, { spec: .9, occ: .45, lw: 1.5 })}
        {/* L2 — the core lights */}
        {/* the core throws light onto the shell around it, rather than sitting
            on the belly like a sticker */}
        {has(2) && <circle cx={cx} cy={coreY} r={bw * .85} fill={`url(#${uid}-glow)`} opacity=".42" />}
        {has(2) && <circle cx={cx} cy={coreY} r={bw * (has(4) ? .3 : .26)} fill={`url(#${uid}-glow)`} />}
        {/* the core, switched ON. A flat disc ringed in the outline colour is
            the difference between a machine that is running and a badge sewn
            onto its chest, so it gets the light's own three passes: a bloom, a
            bright iris, a white hot centre — and a catchlight on the lens. */}
        {(() => {
          const cr = Math.max(3, bw * .11);
          if (!has(2)) return <circle cx={cx} cy={coreY} r={cr} fill={B} stroke={B} strokeWidth="1.2" opacity=".7" />;
          return (
            <g>
              <circle cx={cx} cy={coreY} r={cr * 1.9} fill={T.c} opacity=".22" />
              <circle cx={cx} cy={coreY} r={cr * 1.34} fill="none" stroke={T.c} strokeWidth={cr * .3} opacity=".7" />
              <circle cx={cx} cy={coreY} r={cr} fill={T.c} />
              <circle cx={cx} cy={coreY} r={cr} fill="none" stroke={B} strokeWidth="1" opacity=".45" />
              <circle cx={cx} cy={coreY} r={cr * .52} fill="#ffffff" opacity=".95" />
              <circle cx={cx - cr * .3} cy={coreY - cr * .34} r={cr * .22} fill="#ffffff" />
            </g>);
        })()}
        {/* L3 — shoulder studs; L10 — full pauldrons over them */}
        {has(3) && [-1, 1].map(k => (
          <path key={k} d={`M${cx + k * bw * .3} ${bTop + 2} L${cx + k * bw * .62} ${bTop - 8} L${cx + k * bw * .58} ${bTop + 6} Z`}
            fill={A2} stroke={B} strokeWidth="1.3" strokeLinejoin="round" />))}
        {has(10) && sp.build !== "quad" && [-1, 1].map(k => P(
          `M${cx + k * bw * .16} ${bTop - 2} C${cx + k * bw * .62} ${bTop - 7} ${cx + k * bw * .76} ${bTop + 4} ${cx + k * bw * .66} ${bTop + 13} L${cx + k * bw * .2} ${bTop + 9} Z`, F, { spec: .85, lw: 1.4 }))}
        {limbs.front}
        {/* L5 — bracers: built inside each limb group, above */}
        {/* L7 — ankle rings */}
        {has(7) && (sp.build === "float"
          ? <ellipse cx={cx} cy={bBot + 13} rx={bw * .44} ry="4" fill="none" stroke={T.c} strokeWidth="2.4" opacity=".8" />
          : [-1, 1].map(k => (
            <g key={k}>
              <path d={rr(cx + k * bw * (sp.build === "quad" ? .21 : .26), GROUND - 12, 15, 6.4, 2.6)} fill={M} stroke={Bm} strokeWidth="1.2" />
              <path d={rr(cx + k * bw * (sp.build === "quad" ? .21 : .26), GROUND - 12, 11, 2, 1)} fill={T.c} />
            </g>)))}
        {sp.build !== "float" && P(rr(cx, bTop - 3, bw * .4, 7, 3), M, { spec: 1, lw: 1.3 })}
        {/* the head drops a shadow on the chest under it. Flat vector figures
            read as decals precisely because this is missing. */}
        <ellipse cx={cx} cy={bTop + 3} rx={hr * .7} ry="5" fill="#00060f" opacity=".2" />
        {/* L14 — a ruff around the neck. Fills the gap between a big head and
            a small body, which is the join these builds have always been
            weakest at. */}
        {has(14) && (() => {
          /* Anchored to the NECK, not to the head: at hy + hr*.82 it sat 82%
             of the way down the skull and covered the mouth. It also wants to
             read as fluff rather than as a dark spiked collar, so it is built
             from overlapping rounded lobes in a lightened body colour. */
          const ny = Math.max(hy + hr * 1.02, bTop - 1);
          /* Mixed toward the BODY colour, not toward white: B is the dark
             swatch, so a lightened B on a pale blue pet still read as a black
             scarf rather than as the animal's own fur. */
          const lobe = mixc(mixc(B, A2, .62), "#ffffff", .16);
          return (
            <g>
              {[-1.15, -.78, -.4, 0, .4, .78, 1.15].map((t, i) => (
                <ellipse key={i} cx={cx + t * hr * .74} cy={ny + Math.abs(t) * hr * .12}
                  rx={hr * .3} ry={hr * .24} fill={lobe} opacity=".95"
                  transform={`rotate(${t * 26} ${cx + t * hr * .74} ${ny})`} />
              ))}
              <ellipse cx={cx} cy={ny - hr * .06} rx={hr * .86} ry={hr * .2} fill={lobe} />
              <ellipse cx={cx} cy={ny - hr * .1} rx={hr * .66} ry={hr * .12} fill={T.c} opacity=".42" />
            </g>);
        })()}
        {/* L13 — horns. The first part that changes the OUTLINE of the head,
            which is why it opens the back half of the ladder rather than
            closing it. Drawn behind the head so they root into the skull. */}
        {has(13) && [-1, 1].map(k => (
          <g key={"hn" + k}>
            <path fill={B} stroke={B} strokeWidth="1" strokeLinejoin="round"
              d={`M${cx + k * hr * .52} ${hy - hr * .58} C${cx + k * hr * .96} ${hy - hr * 1.02} ${cx + k * hr * 1.02} ${hy - hr * 1.62} ${cx + k * hr * .74} ${hy - hr * 2.0} C${cx + k * hr * .96} ${hy - hr * 1.4} ${cx + k * hr * .74} ${hy - hr * .92} ${cx + k * hr * .3} ${hy - hr * .74} Z`} />
            <path fill={T.c} opacity=".55"
              d={`M${cx + k * hr * .56} ${hy - hr * .66} C${cx + k * hr * .9} ${hy - hr * 1.06} ${cx + k * hr * .94} ${hy - hr * 1.54} ${cx + k * hr * .74} ${hy - hr * 1.86} C${cx + k * hr * .82} ${hy - hr * 1.36} ${cx + k * hr * .68} ${hy - hr * .98} ${cx + k * hr * .42} ${hy - hr * .82} Z`} />
          </g>))}
        {EARS[sp.ear]}
        {/* The head took the full five-pass treatment every armour plate gets:
            a broad specular sweep and a white bevel lip right round the crown.
            On a flat plate that is a machined edge; on a big sphere it is the
            highlight you see on a GLASS BAUBLE, which is what these looked
            like. Half the sweep and a quarter of the lip, and it goes back to
            being a face. */}
        {P((HEADS[sp.head] || HEADS.round)(cx, hy, hr), F, { spec: .5, bev: .12 })}
        {/* ── the face has to have MASS in it ──
            A big smooth sphere with two dots on it reads as a balloon however
            well it is lit, because a gradient describes a surface and not a
            skull. Two shapes fix it and neither is expensive: the shadow the
            brow casts down over the eye line, and the muzzle — the lump that
            carries the mouth, caught a little warmer because it is the part
            of the face nearest the light. */}
        <ellipse cx={cx} cy={hy - hr * .34} rx={hr * .9} ry={hr * .46} fill="#00060f" opacity=".07" />
        <ellipse cx={cx} cy={hy + hr * .4} rx={hr * .6} ry={hr * .38}
          fill={`url(#${uid}-belly)`} opacity=".52" />
        {/* where the skull turns under toward the jaw */}
        <path d={`M${cx - hr * .78} ${hy + hr * .5} Q${cx} ${hy + hr * 1.02} ${cx + hr * .78} ${hy + hr * .5}`}
          fill="none" stroke="#00060f" strokeWidth={hr * .1} opacity=".07" strokeLinecap="round" />
        {[0, 1, 2].map(j => seam(`M${cx + hr * .62} ${hy + hr * .42 + j * 4} h${hr * .3}`, .4))}
        {/* the panel line down the temple, faint — at .32 it read as a crack */}
        {seam(`M${cx - hr * .34} ${hy - hr * .96} C${cx - hr * .5} ${hy - hr * .5} ${cx - hr * .5} ${hy - hr * .2} ${cx - hr * .42} ${hy + hr * .1}`, .16)}
        {/* L6 — a crest between the ears */}
        {has(6) && [-1, 0, 1].map(k => (
          <path key={k} d={`M${cx + k * hr * .34 - hr * .13} ${hy - hr * .84} L${cx + k * hr * .34} ${hy - hr * (k === 0 ? 1.62 : 1.32)} L${cx + k * hr * .34 + hr * .13} ${hy - hr * .84} Z`}
            fill={T.c} stroke={B} strokeWidth="1.2" strokeLinejoin="round" />))}
        {/* L17 — a crown, and L19 the halo over it */}
        {has(17) && (
          <g>
            <path fill={T.c} stroke={B} strokeWidth="1.2" strokeLinejoin="round" opacity=".95"
              d={`M${cx - hr * .62} ${hy - hr * .86} L${cx - hr * .62} ${hy - hr * 1.34} L${cx - hr * .3} ${hy - hr * 1.06} L${cx} ${hy - hr * 1.5} L${cx + hr * .3} ${hy - hr * 1.06} L${cx + hr * .62} ${hy - hr * 1.34} L${cx + hr * .62} ${hy - hr * .86} Z`} />
            {[-.44, 0, .44].map(t => <circle key={t} cx={cx + t * hr} cy={hy - hr * .98} r="2.2" fill="#fff" opacity=".9" />)}
          </g>)}
        {has(19) && <>
          <ellipse cx={cx} cy={hy - hr * 1.86} rx={hr * .84} ry={hr * .22} fill="none" stroke={T.c} strokeWidth="3.2" opacity=".8" />
          <ellipse cx={cx} cy={hy - hr * 1.86} rx={hr * .84} ry={hr * .22} fill="none" stroke="#fff" strokeWidth="1.2" opacity=".65" />
        </>}
        {EYES[sp.eye]}
        {/* blush — the single cheapest thing that reads as cute, and the one
            piece of the face that is not machinery */}
        {!sad && [-1, 1].map(k => (
          <ellipse key={k} cx={cx + k * hr * .72} cy={hy + hr * .46} rx={hr * .22} ry={hr * .13}
            fill="#ff8fa8" opacity=".38" />))}
        {/* a glossy sweep across the top of the skull: a toy has a shine on it */}
        <path d={`M${cx - hr * .66} ${hy - hr * .52} C${cx - hr * .3} ${hy - hr * .92} ${cx + hr * .18} ${hy - hr * .92} ${cx + hr * .46} ${hy - hr * .6} C${cx + hr * .12} ${hy - hr * .74} ${cx - hr * .3} ${hy - hr * .72} ${cx - hr * .66} ${hy - hr * .52} Z`}
          fill="#ffffff" opacity=".5" />
        {/* L16 — claws. The floor contact is the one place a cute build can
            take something sharp without stopping being cute. */}
        {has(16) && sp.build !== "float" && (() => {
          /* Anchored to the TOE line, not to an absolute floor: the first
             version ran to GROUND + 2, so on a floating build — which has no
             feet at all — three spikes appeared standing on the aura ring by
             themselves. Grounded builds only, and the tips stop at the floor. */
          const fx = sp.build === "quad" ? .42 : .26;
          return [-1, 1].map(k => (
            <g key={"cl" + k}>
              {[-1, 0, 1].map(j => (
                <path key={j} fill={B} opacity=".85"
                  d={`M${cx + k * bw * fx + j * 4.4 - 1.3} ${GROUND - 7} L${cx + k * bw * fx + j * 4.4 + 1.3} ${GROUND - 7} L${cx + k * bw * fx + j * 4.4} ${GROUND - 1.5} Z`} />
              ))}
            </g>));
        })()}
        {/* L18 — shards in orbit. Six of them, on two radii, so the ring has
            depth instead of reading as a drawn circle of dots. */}
        {has(18) && [0, 1, 2, 3, 4, 5].map(i => {
          const a = i * Math.PI / 3 + .4, rr2 = i % 2 ? hr * 2.1 : hr * 1.7;
          const sx = cx + Math.cos(a) * rr2, sy = hy + hr * .5 + Math.sin(a) * rr2 * .52;
          return (
            <g key={"sh" + i}>
              <circle cx={sx} cy={sy} r="6" fill={`url(#${uid}-glow)`} opacity=".7" />
              <path d={`M${sx} ${sy - 4.4} L${sx + 3} ${sy} L${sx} ${sy + 4.4} L${sx - 3} ${sy} Z`} fill={T.c} stroke="#fff" strokeWidth=".8" opacity=".95" />
            </g>);
        })}
        {!sad && <path d={`M${cx - hr * .22} ${hy + hr * .62} C${cx - hr * .06} ${hy + hr * .82} ${cx + hr * .06} ${hy + hr * .82} ${cx + hr * .22} ${hy + hr * .62}`} fill="none" stroke={B} strokeWidth="1.9" strokeLinecap="round" opacity=".62" />}
        {sad && <path d={`M${cx - hr * .22} ${hy + hr * .8} C${cx - hr * .06} ${hy + hr * .6} ${cx + hr * .06} ${hy + hr * .6} ${cx + hr * .22} ${hy + hr * .8}`} fill="none" stroke={B} strokeWidth="1.9" strokeLinecap="round" opacity=".62" />}
      </g>
      </g>
    </svg>
  );
});

/* ══════════════════════ the pantry ══════════════════════ */

/* Food is a CONSUMABLE, so it deliberately does not live in the shop's `owned`
   list — that list is a flat set of ids and has no notion of a count, and
   bolting quantities onto it would have broken every category that uses it.
   The pantry is its own little counter map instead. */
const BAG = "tg_petbag";
export function readPetBag() {
  try { const v = JSON.parse(localStorage.getItem(BAG) || "null"); if (v && typeof v === "object") return v; } catch (e) {}
  return { "pf-chow": 3 };   // enough to get a new pet through its first day
}
export function writePetBag(v) { try { localStorage.setItem(BAG, JSON.stringify(v)); } catch (e) {} }

/** What the pet is worth in the arena right now. A neglected pet gives
    nothing — that is the whole point of the care loop, and it is why the
    bonus is read fresh at the start of every fight rather than cached. */
/* ── branching evolution ──
   Growth was one line: every pet of a species ended up identical at level 20.
   Three times on the way up — entering stage 2, 3 and 4 — the pet asks which
   way it is going, and the two answers are genuinely different animals by the
   end. Eight endings per species instead of one, and the choice is permanent,
   which is what makes it a choice rather than a menu.

   The path is stored per species, so a stable of pets each keep their own. */
const PATH_KEY = "tg_petpath";
export const PET_PATHS = [
  { at: 2, a: { id: "swift",   th: "สายว่องไว", en: "Swift",   zh: "迅捷", dmg: 0.9,  gauge: 1.25, guard: 1.0 },
           b: { id: "sturdy",  th: "สายทนทาน", en: "Sturdy",  zh: "坚韧", dmg: 1.0,  gauge: 0.9,  guard: 1.3 } },
  { at: 3, a: { id: "wild",    th: "สายดุร้าย", en: "Wild",    zh: "狂野", dmg: 1.3,  gauge: 1.0,  guard: 0.9 },
           b: { id: "keen",    th: "สายเฉียบ",  en: "Keen",    zh: "锐敏", dmg: 1.0,  gauge: 1.3,  guard: 1.0 } },
  { at: 4, a: { id: "radiant", th: "สายรุ่งโรจน์", en: "Radiant", zh: "辉耀", dmg: 1.15, gauge: 1.15, guard: 1.0 },
           b: { id: "umbral",  th: "สายเงามืด",  en: "Umbral",  zh: "暗影", dmg: 1.25, gauge: 1.0,  guard: 1.1 } },
];
export function readPaths() {
  try { const v = JSON.parse(localStorage.getItem(PATH_KEY) || "null"); if (v && typeof v === "object") return v; } catch (e) {}
  return {};
}
export function pathsOf(speciesId) { const v = readPaths()[speciesId]; return Array.isArray(v) ? v : []; }
export function choosePath(speciesId, idx, which) {
  const all = readPaths();
  const cur = Array.isArray(all[speciesId]) ? all[speciesId].slice() : [];
  cur[idx] = which;
  all[speciesId] = cur;
  try { localStorage.setItem(PATH_KEY, JSON.stringify(all)); } catch (e) {}
  try { window.dispatchEvent(new Event("tg-pet")); } catch (e) {}
}
/** The branch this pet is standing at right now, or null if none is due. */
export function pendingPath(p) {
  if (!p) return null;
  const st = petStage(p.bond), taken = pathsOf(p.species);
  for (let i = 0; i < PET_PATHS.length; i++) {
    if (st >= PET_PATHS[i].at && !taken[i]) return { idx: i, ...PET_PATHS[i] };
  }
  return null;
}
/** Multipliers earned from the branches already taken. */
export function pathMul(speciesId) {
  const taken = pathsOf(speciesId);
  const m = { dmg: 1, gauge: 1, guard: 1 };
  taken.forEach((w, i) => {
    const P = PET_PATHS[i]; if (!P || !w) return;
    const arm = w === "b" ? P.b : P.a;
    m.dmg *= arm.dmg; m.gauge *= arm.gauge; m.guard *= arm.guard;
  });
  return m;
}
/** The names of the branches taken, for the id card. */
export function pathNames(speciesId) {
  return pathsOf(speciesId).map((w, i) => (PET_PATHS[i] ? (w === "b" ? PET_PATHS[i].b : PET_PATHS[i].a) : null)).filter(Boolean);
}

/* ── the room ──
   A pet with nowhere to live is a sprite on a background. Eight pieces, bought
   with coins and drawn rather than photographed, so they take the same light as
   everything else in the app. Owning is the whole mechanic — no placement grid,
   because a grid turns a two-second decoration into a chore. */
const ROOM_KEY = "tg_petroom";
export const FURNITURE = [
  { id: "rug",    cost: 120, th: "\u0e1e\u0e23\u0e21",        en: "Rug",         zh: "\u5730\u6bef" },
  { id: "lamp",   cost: 180, th: "\u0e42\u0e04\u0e21\u0e44\u0e1f",      en: "Lamp",        zh: "\u843d\u5730\u706f" },
  { id: "plant",  cost: 220, th: "\u0e15\u0e49\u0e19\u0e44\u0e21\u0e49",     en: "Plant",       zh: "\u76c6\u683d" },
  { id: "shelf",  cost: 260, th: "\u0e0a\u0e31\u0e49\u0e19\u0e27\u0e32\u0e07\u0e02\u0e2d\u0e07", en: "Shelf",       zh: "\u7f6e\u7269\u67b6" },
  { id: "poster", cost: 300, th: "\u0e42\u0e1b\u0e2a\u0e40\u0e15\u0e2d\u0e23\u0e4c",   en: "Poster",      zh: "\u6d77\u62a5" },
  { id: "bed",    cost: 420, th: "\u0e40\u0e15\u0e35\u0e22\u0e07\u0e19\u0e2d\u0e19",   en: "Bed",         zh: "\u5c0f\u5e8a" },
  { id: "piano",  cost: 700, th: "\u0e40\u0e1b\u0e35\u0e22\u0e42\u0e19\u0e08\u0e34\u0e4b\u0e27", en: "Toy piano",   zh: "\u73a9\u5177\u94a2\u7434" },
  { id: "window", cost: 900, th: "\u0e2b\u0e19\u0e49\u0e32\u0e15\u0e48\u0e32\u0e07\u0e40\u0e21\u0e37\u0e2d\u0e07", en: "City window", zh: "\u57ce\u5e02\u7a97\u666f" },
];
export function readRoom() {
  try { const v = JSON.parse(localStorage.getItem(ROOM_KEY) || "null"); if (Array.isArray(v)) return v; } catch (e) {}
  return [];
}
export function ownsFurniture(id) { return readRoom().indexOf(id) >= 0; }
export function buyFurniture(id) {
  const v = readRoom();
  if (v.indexOf(id) >= 0) return false;
  v.push(id);
  try { localStorage.setItem(ROOM_KEY, JSON.stringify(v)); } catch (e) {}
  try { window.dispatchEvent(new Event("tg-pet")); } catch (e) {}
  return true;
}

/** The room, drawn behind the pet. Everything owned, all at once. */
export function PetRoom({ owned }) {
  const has = (id) => owned.indexOf(id) >= 0;
  return (
    <svg className="pet-room" viewBox="0 0 240 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="pr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#233a63" /><stop offset="100%" stopColor="#0e1728" />
        </linearGradient>
      </defs>
      {has("window") && <g>
        <rect x="150" y="14" width="66" height="46" rx="4" fill="#12203a" stroke="#3b5478" strokeWidth="2" />
        <rect x="154" y="18" width="58" height="38" fill="url(#pr-sky)" />
        {[158, 170, 182, 196].map((x, i) => <rect key={x} x={x} y={30 + (i % 2) * 6} width="9" height={26 - (i % 2) * 6} fill="#0d1728" />)}
        {[160, 173, 185, 199].map((x, i) => <rect key={"w" + x} x={x} y={34 + (i % 2) * 6} width="3" height="3" fill="#ffd23f" opacity=".8" />)}
        <path d="M150 37 H216 M183 14 V60" stroke="#3b5478" strokeWidth="2" />
      </g>}
      {has("poster") && <g>
        <rect x="26" y="16" width="42" height="30" rx="3" fill="#241a33" stroke="#6b5a8a" strokeWidth="2" />
        <path d="M34 38 L44 24 L52 34 L60 27" fill="none" stroke="#ff6bd6" strokeWidth="2.4" strokeLinecap="round" />
      </g>}
      {has("shelf") && <g>
        <rect x="20" y="56" width="56" height="5" rx="2" fill="#6b4f34" />
        <rect x="26" y="44" width="8" height="12" fill="#7fe8ff" opacity=".85" />
        <rect x="38" y="47" width="7" height="9" fill="#ffd23f" opacity=".85" />
        <rect x="49" y="42" width="9" height="14" fill="#ff7a9c" opacity=".85" />
      </g>}
      {has("lamp") && <g>
        <ellipse cx="208" cy="76" rx="30" ry="22" fill="#ffd23f" opacity=".13" />
        <rect x="206" y="66" width="4" height="44" fill="#5a6478" />
        <path d="M196 66 L220 66 L214 50 L202 50 Z" fill="#ffd8a0" />
        <ellipse cx="208" cy="112" rx="14" ry="4" fill="#5a6478" />
      </g>}
      {has("plant") && <g>
        <path d="M24 110 L36 110 L34 92 L26 92 Z" fill="#8a5a3c" />
        <path d="M30 92 C18 84 20 68 30 62 C40 68 42 84 30 92 Z" fill="#3ddc84" />
        <path d="M30 88 C20 82 22 72 30 68 C38 72 39 82 30 88 Z" fill="#2fb56c" />
      </g>}
      {has("piano") && <g>
        <rect x="86" y="88" width="56" height="16" rx="3" fill="#1b2233" stroke="#46536e" strokeWidth="1.6" />
        <rect x="90" y="96" width="48" height="8" fill="#f2f6fc" />
        {[96, 104, 112, 120, 128].map(x => <rect key={x} x={x} y="96" width="2.4" height="5" fill="#1b2233" />)}
      </g>}
      {has("bed") && <g>
        <rect x="150" y="90" width="64" height="18" rx="7" fill="#3a4a6a" />
        <rect x="150" y="86" width="24" height="14" rx="6" fill="#e8eefc" opacity=".9" />
      </g>}
      {has("rug") && <ellipse cx="120" cy="116" rx="76" ry="12" fill="#7a4a6a" opacity=".55" />}
    </svg>
  );
}

/* ── expeditions ──
   The one thing a pet in a practice app can do that the app cannot: keep
   working while the app is shut. You send it out, close the tab, and it is
   still gone when you come back — the clock is wall-clock, stored, and read on
   return, so nothing has to be running for time to pass. Longer trips pay
   better and are the only source of the rarer foods.

   One trip at a time, per pet, which is what stops it being an idle-game
   button you tap forty times. */
const EXP_KEY = "tg_petexped";
export const EXPEDITIONS = [
  { id: "park",  mins: 30,  bond: 14, coins: 40,  th: "เดินเล่นในสวน",  en: "Park stroll",   zh: "公园散步" },
  { id: "ruins", mins: 180, bond: 46, coins: 140, th: "สำรวจซากเมือง",  en: "Ruin sweep",    zh: "废墟探索" },
  { id: "deep",  mins: 480, bond: 120, coins: 380, th: "ลงลึกใต้เมือง", en: "Deep descent",  zh: "深层下潜" },
];
export function readExped() {
  try { const v = JSON.parse(localStorage.getItem(EXP_KEY) || "null"); if (v && v.id) return v; } catch (e) {}
  return null;
}
function writeExped(v) {
  try { if (v) localStorage.setItem(EXP_KEY, JSON.stringify(v)); else localStorage.removeItem(EXP_KEY); } catch (e) {}
  try { window.dispatchEvent(new Event("tg-pet")); } catch (e) {}
}
export function sendExped(id) {
  const E = EXPEDITIONS.find(x => x.id === id);
  if (!E || readExped()) return false;
  writeExped({ id, until: Date.now() + E.mins * 60000 });
  return true;
}
/** null while away, or the payout once the clock has run out. */
export function expedDone() {
  const cur = readExped();
  if (!cur) return null;
  if (Date.now() < cur.until) return null;
  return EXPEDITIONS.find(x => x.id === cur.id) || null;
}
export function claimExped() {
  const E = expedDone();
  if (!E) return null;
  writeExped(null);
  const p = readPet();
  if (p) { writePet({ ...p, bond: (p.bond || 0) + E.bond, mood: Math.min(100, (p.mood || 0) + 6) }); }
  return E;
}
/** Milliseconds left, or 0. */
export function expedLeft() {
  const cur = readExped();
  return cur ? Math.max(0, cur.until - Date.now()) : 0;
}

/* ── practice trains it ──
   The pet lived in its own room: bond came only from feeding, washing and
   brushing it, and an hour of real piano did nothing for it at all. That is
   backwards for a companion in a music app — the thing you want rewarded is
   the practising. Every session that pays EXP now pays the pet too, on a
   sliding scale so a long session is worth more than a tap, and capped per day
   so it supplements care rather than replacing it.

   It also remembers WHEN you last practised, which is what C5 reads. */
const TRAIN_KEY = "tg_pettrain";
export const TRAIN_DAILY_CAP = 60;
function readTrain() {
  try { const v = JSON.parse(localStorage.getItem(TRAIN_KEY) || "null"); if (v && typeof v === "object") return v; } catch (e) {}
  return { d: "", got: 0, last: 0 };
}
function writeTrain(v) { try { localStorage.setItem(TRAIN_KEY, JSON.stringify(v)); } catch (e) {} }
const dayKey = () => new Date().toISOString().slice(0, 10);

/** Pay the pet for a practice session. Returns the bond actually granted. */
export function trainPet(exp) {
  const p = readPet();
  if (!p || !exp) return 0;
  const t = readTrain();
  if (t.d !== dayKey()) { t.d = dayKey(); t.got = 0; }
  const want = Math.max(1, Math.min(14, Math.round(exp / 6)));
  const give = Math.max(0, Math.min(want, TRAIN_DAILY_CAP - t.got));
  t.got += give; t.last = Date.now();
  writeTrain(t);
  if (give > 0) {
    // practising also cheers it up — it was waiting for you
    const v = { ...p, bond: (p.bond || 0) + give, mood: Math.min(100, (p.mood || 0) + 4) };
    writePet(v);
    try { window.dispatchEvent(new Event("tg-pet")); } catch (e) {}
  }
  return give;
}
/** Days since you last practised, for the pet to have an opinion about. */
export function daysSincePractice() {
  const t = readTrain();
  if (!t.last) return null;
  return Math.floor((Date.now() - t.last) / 86400000);
}
/** What the pet has to say about your practising, if anything. */
export function practiceMood(lang) {
  const d = daysSincePractice();
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  if (d === null) return null;
  if (d === 0) return { good: true, text: T("วันนี้คุณซ้อมแล้ว — มันดูมีความสุขมาก", "You practised today — it is delighted", "你今天练琴了 — 它很开心") };
  if (d === 1) return { good: true, text: T("มันรอคุณซ้อมอยู่วันนี้", "It is waiting for you to practise today", "它在等你今天练琴") };
  if (d < 4) return { good: false, text: T(`ไม่ได้ซ้อมมา ${d} วันแล้ว มันเริ่มเหงา`, `${d} days without practice — it is getting lonely`, `${d} 天没练琴了 — 它有点寂寞`) };
  return { good: false, text: T(`ไม่ได้ซ้อมมา ${d} วัน มันคิดถึงคุณมาก`, `${d} days without practice — it misses you`, `${d} 天没练琴 — 它很想你`) };
}

export function petBonusOf() {
  const p = readPet();
  if (!p) return null;
  const happy = petHappy(p);
  if (happy < 50) return null;
  const sp = petById(p.species);
  const b = PET_BONUS[sp.bonus];
  if (!b) return null;
  /* a stage-three pet is worth more than a hatchling, and a merely-okay pet
     is worth less than a thriving one */
  const scale = [1, 1, 1.15, 1.4, 1.7, 2.05][petStage(p.bond)] * (happy >= 80 ? 1 : 0.7);
  // the branches it took multiply the axis they were about
  const pm = pathMul(p.species);
  const axis = b.k === "guard" ? pm.guard : b.k === "sp" ? pm.gauge : pm.dmg;
  return { k: b.k, v: b.v * scale * axis, species: sp, happy, stage: petStage(p.bond), paths: pathNames(p.species) };
}

/* ══════════════════════ the care screen ══════════════════════ */

/* Every care action raises one stat. Bond is paid on the ACTUAL rise, not on
   the tap — feeding a full pet is worth nothing — which is what stops the
   whole thing from being a button you mash a hundred times on day one. */
/* Every care action costs coins, and coins only come from practising. That is
   the point of the whole mode: the pet is a reason to go and learn something,
   not a free toy. A full round of care runs 60 coins against a 25-coin daily
   payout, so it stays a net sink — you have to keep earning to keep it well.
   Feeding is not priced here because the food itself was already paid for. */
const CARE = {
  feed:  { stat: "hunger", rise: 34, ic: "🍖", c: "#ff9a4c", cost: 0 },
  bath:  { stat: "clean",  rise: 42, ic: "🫧", c: "#5ce1ff", cost: 20 },
  brush: { stat: "coat",   rise: 40, ic: "🪮", c: "#c7a6ff", cost: 15 },
  play:  { stat: "mood",   rise: 38, ic: "🎾", c: "#3ddc84", cost: 25 },
};
const CARE_TEXT = {
  feed:  { th: "ให้อาหาร", en: "Feed", zh: "喂食" },
  bath:  { th: "อาบน้ำ", en: "Bath", zh: "洗澡" },
  brush: { th: "แปรงขน", en: "Brush", zh: "刷毛" },
  play:  { th: "เล่นด้วย", en: "Play", zh: "玩耍" },
  clean: { th: "เก็บกวาด", en: "Clean up", zh: "打扫" },
};
const STAT_TEXT = {
  hunger: { th: "ความอิ่ม", en: "Fullness", zh: "饱食" },
  clean:  { th: "ความสะอาด", en: "Clean", zh: "清洁" },
  coat:   { th: "ขน", en: "Coat", zh: "毛发" },
  mood:   { th: "อารมณ์", en: "Mood", zh: "心情" },
};

const tr3 = (o, lang) => (o ? (lang === "th" ? o.th : lang === "zh" ? o.zh : o.en) : "");

/** A small burst of emoji at the pet, so a tap always produces something. */
function useCareFx() {
  const [fx, setFx] = useState([]);
  const seq = useRef(0);
  const pop = useCallback((ic, n = 6) => {
    const born = [];
    for (let i = 0; i < n; i++) {
      born.push({ id: ++seq.current, ic, x: 18 + Math.random() * 64, d: Math.random() * 260, r: (Math.random() - .5) * 46 });
    }
    setFx(f => [...f, ...born]);
    setTimeout(() => setFx(f => f.filter(o => !born.some(b => b.id === o.id))), 1500);
  }, []);
  return { fx, pop };
}

/** The pet on the profile page — a small pod beside the avatar rather than a
    row of its own. It sits where the eye already is (the character block) and
    carries only what would make somebody tap it: the animal, its level, and a
    dot when something needs doing. Everything else lives on the page. */
export const PetPod = memo(function PetPod({ lang, onOpen }) {
  const [pet, setPet] = useState(() => readPet());
  useEffect(() => {
    const sync = () => setPet(readPet());
    window.addEventListener("tg-pet", sync);
    window.addEventListener("focus", sync);
    const t = setInterval(sync, 60000);
    return () => { window.removeEventListener("tg-pet", sync); window.removeEventListener("focus", sync); clearInterval(t); };
  }, []);
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);

  if (!pet) {
    return (
      <button className="petpod empty" onClick={onOpen} title={T("ห้องเลี้ยงสัตว์ไซบอร์ก", "Cyber Pet Lab", "赛博宠物室")}>
        <span className="pp-art egg">🥚</span>
        <b>{T("ฟักสัตว์เลี้ยง", "Hatch a pet", "孵化宠物")}</b>
      </button>
    );
  }

  const sp = petById(pet.species);
  const need = (pet.mess || []).length > 0 || ["hunger", "clean", "coat", "mood"].some(k => pet[k] < 45);
  return (
    <button className={`petpod${need ? " need" : ""}`} onClick={onOpen}
      style={{ "--pc": sp.sw[0], "--tc": (PET_TYPES[sp.type] || PET_TYPES.steel).c }}
      title={T("ห้องเลี้ยงสัตว์ไซบอร์ก", "Cyber Pet Lab", "赛博宠物室")}>
      <span className="pp-art"><PetArt species={sp.id} level={petLevel(pet.bond).lv} mood={pet.mood} /></span>
      <b>{pet.name || tr3(sp, lang)}</b>
      <i>Lv.{petLevel(pet.bond).lv}</i>
      {need && <em aria-label={T("ต้องการการดูแล", "Needs care", "需要照顾")} />}
    </button>
  );
});
/** The full care screen: hatch, then look after the thing forever. */
export const PetPage = memo(function PetPage({ lang, coins = 0, onSpend, onReward, onBack, playUi = () => {} }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [pet, setPet] = useState(() => readPet());
  const [bag, setBag] = useState(() => readPetBag());
  const [tray, setTray] = useState(false);
  const [pick, setPick] = useState(null);
  /* Thirty-two eggs on one page is a wall. Somebody who came here for a soft
     round thing should not have to scroll past ten sets of horns to find it,
     so the shelf splits the way people actually ask for these. */
  const [look, setLook] = useState("all");
  const [naming, setNaming] = useState("");
  const [note, setNote] = useState(null);
  const [evo, setEvo] = useState(null);        // the evolution cutscene, when one is playing
  const [expTick, setExpTick] = useState(0);   // re-render the expedition clock
  useEffect(() => { const id = setInterval(() => setExpTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  const { fx, pop } = useCareFx();

  const save = useCallback((v) => {
    setPet(v); writePet(v);
    try { window.dispatchEvent(new Event("tg-pet")); } catch (e) {}
  }, []);
  const stash = useCallback((v) => { setBag(v); writePetBag(v); }, []);
  const say = useCallback((t) => { setNote(t); setTimeout(() => setNote(n => (n === t ? null : n)), 2200); }, []);

  /* decay keeps running while the screen is open, so a long session still
     shows the pet getting hungry */
  useEffect(() => {
    const t = setInterval(() => setPet(p => (p ? decay(p) : p)), 60000);
    return () => clearInterval(t);
  }, []);

  /* the daily "everything is fine" payout — the reason to come back tomorrow
     rather than to grind today */
  const payDaily = useCallback((v) => {
    /* local date, not toISOString — a UTC boundary would roll the day over
       at 7am in Bangkok, which is exactly when somebody is feeding it */
    const d = new Date();
    const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (v.paid === today) return v;
    if (petHappy(v) < 80 || (v.mess || []).length) return v;
    if (onReward) onReward(40, 25);
    say(T("ดูแลครบวันนี้! +40 EXP +25 เหรียญ", "Fully cared for today! +40 EXP +25 coins", "今日照顾完成！+40 EXP +25 金币"));
    playUi("reward");
    return { ...v, paid: today };
  }, [onReward, say, playUi, lang]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** One care action. Bond is paid on the real rise, so a full pet pays zero. */
  const care = useCallback((kind, food) => {
    if (!pet) return;
    const C = CARE[kind];
    const cur = pet[C.stat];
    let rise = C.rise, bondMul = 1;
    if (kind === "feed") {
      if (!food) { setTray(true); return; }
      const have = bag[food.id] || 0;
      if (have <= 0) { say(T("ไม่มีอาหารชนิดนี้แล้ว", "You are out of that food", "这种食物已用完")); playUi("wrong"); return; }
      const sp = petById(pet.species);
      const fav = food.id === sp.food;
      rise = food.big ? 100 : fav ? 46 : 30;
      bondMul = food.big ? 2.4 : fav ? 2 : 1;
      stash({ ...bag, [food.id]: have - 1 });
      setTray(false);
    }
    const next = Math.min(PET_MAX, cur + rise);
    const gained = next - cur;
    if (gained <= 1 && kind !== "play") {
      say(T("ตอนนี้ยังไม่ต้องการเลย", "It does not need that right now", "现在还不需要"));
      playUi("click"); return;
    }
    /* charged only after the action is known to do something, so a wasted tap
       never costs anything */
    if (C.cost > 0) {
      if (coins < C.cost || (onSpend && onSpend(C.cost) === false)) {
        say(T("เหรียญไม่พอ — ไปฝึกซ้อมเก็บเหรียญก่อน",
              "Not enough coins — go and practise to earn some",
              "金币不足 —— 先去练琴赚金币"));
        playUi("wrong"); return;
      }
    }
    let v = { ...pet, seen: Date.now(), [C.stat]: next };
    /* playing burns a little energy, and a good meal is a little messy —
       every action having a cost is what keeps the loop from being a
       checklist you clear once */
    if (kind === "play") { v.hunger = Math.max(0, v.hunger - 6); v.mood = Math.min(PET_MAX, v.mood + 4); }
    if (kind === "feed" && Math.random() < .35) {
      v.mess = [...(v.mess || []), { id: Date.now() + "-f", x: 14 + Math.random() * 70, y: 64 + Math.random() * 22 }].slice(0, 6);
    }
    if (kind === "bath") v.coat = Math.min(PET_MAX, v.coat + 8);
    v.bond = Math.round((v.bond || 0) + Math.max(1, gained * 0.35) * bondMul);
    const before = petLevel(pet.bond).lv, after = petLevel(v.bond).lv;
    v = payDaily(v);
    save(v);
    pop(C.ic, kind === "play" ? 8 : 6);
    playUi(kind === "play" ? "reward" : "click");
    if (after > before) {
      say(T(`เลเวลอัป! Lv.${after}`, `Level up! Lv.${after}`, `升级了！Lv.${after}`));
      playUi("reward");
      if (petStage(v.bond) > petStage(pet.bond)) {
        /* A new form used to be a line of text in a feed you were not reading.
           It is the biggest thing that happens to a pet, so it gets the screen:
           the old shape holds, flares white, and the new one is standing there
           when the light drops. */
        setEvo({ from: petStage(pet.bond), to: petStage(v.bond), species: v.species, lv: after });
        playUi("reward");
      }
    }
  }, [pet, bag, coins, onSpend, save, stash, say, pop, playUi, payDaily, lang]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** Picking up one mess. Cleaning is a tap on the thing itself, not a
      button — it is the one chore that should feel like a chore. */
  const sweep = useCallback((id) => {
    if (!pet) return;
    const mess = (pet.mess || []).filter(m => m.id !== id);
    let v = { ...pet, mess, seen: Date.now(), clean: Math.min(PET_MAX, pet.clean + 6), bond: (pet.bond || 0) + 2 };
    v = payDaily(v);
    save(v);
    pop("✨", 4); playUi("click");
  }, [pet, save, pop, playUi, payDaily]);

  const buy = useCallback((food) => {
    if (coins < food.cost) { say(T("เหรียญไม่พอ", "Not enough coins", "金币不足")); playUi("wrong"); return; }
    if (onSpend && onSpend(food.cost) === false) return;
    stash({ ...bag, [food.id]: (bag[food.id] || 0) + 1 });
    playUi("reward");
    say(T(`ซื้อ ${tr3(food, lang)} แล้ว`, `Bought ${tr3(food, lang)}`, `已购买 ${tr3(food, lang)}`));
  }, [coins, bag, onSpend, stash, playUi, say, lang]);

  /* ── hatch flow ── */
  if (!pet) {
    const sel = pick ? petById(pick) : null;
    return (
      <div className="petpage hatch">
        <div className="pet-top">
          <button className="pet-back" onClick={onBack}>←</button>
          <b>{T("ฟักสัตว์เลี้ยงไซบอร์ก", "Hatch a Cyber Pet", "孵化赛博宠物")}</b>
          <span />
        </div>
        <p className="pet-intro">
          {T("เลือกหนึ่งตัว มันจะอยู่กับคุณตลอด — ต้องให้อาหาร อาบน้ำ แปรงขน เล่นด้วย และเก็บกวาดให้ ยิ่งดูแลดี ยิ่งช่วยหุ่นยนต์ของคุณในสนามประลองได้มาก",
             "Pick one and it stays with you. It needs feeding, bathing, brushing, playing with and cleaning up after — and the better you look after it, the more it does for your chassis in the arena.",
             "选一只，它会一直陪着你。要喂食、洗澡、刷毛、陪玩、打扫 —— 照顾得越好，在竞技场帮你的机体就越多。")}
        </p>
        <div className="pet-looks" role="group">
          {[["all", T("ทั้งหมด", "All", "全部"), PET_SPECIES.length],
            ["cute", T("น่ารัก", "Cute", "可爱"), PET_SPECIES.filter(x => x.look === "cute").length],
            ["cool", T("เท่", "Cool", "帅气"), PET_SPECIES.filter(x => x.look === "cool").length]].map(([k, lbl, n]) => (
            <button key={k} type="button" className={`pet-look${look === k ? " on" : ""}`}
              onClick={() => { setLook(k); playUi("click"); }}>{lbl} <em>{n}</em></button>
          ))}
        </div>
        <div className="pet-grid">
          {PET_SPECIES.filter(sp => look === "all" || sp.look === look).map(sp => {
            const ty = PET_TYPES[sp.type];
            return (
              <button key={sp.id} className={`pet-card${pick === sp.id ? " on" : ""}`} style={{ "--pc": sp.sw[0], "--tc": ty.c }}
                onClick={() => { setPick(sp.id); playUi("click"); }}>
                <span className="pc-art"><PetArt species={sp.id} level={1} /></span>
                <b>{tr3(sp, lang)}</b>
                <i className="pc-type">{tr3(ty, lang)}</i>
                <i className="pc-code">{sp.code}</i>
              </button>
            );
          })}
        </div>
        {sel && (
          <div className="pet-confirm">
            <div className="pcf-row">
              <span className="pcf-art"><PetArt species={sel.id} level={1} /></span>
              <div className="pcf-b">
                <b>{tr3(sel, lang)}</b>
                <p>{lang === "th" ? sel.dth : lang === "zh" ? sel.dzh : sel.den}</p>
                <div className="pcf-tags">
                  <span style={{ "--tc": PET_TYPES[sel.type].c }}>{tr3(PET_TYPES[sel.type], lang)}</span>
                  <span>{T("ของโปรด", "Favourite", "最爱")}: {tr3(foodById(sel.food), lang)}</span>
                  <span>{tr3(PET_BONUS[sel.bonus], lang)}</span>
                </div>
              </div>
            </div>
            <input className="pcf-name" maxLength={14} value={naming} onChange={e => setNaming(e.target.value)}
              placeholder={T("ตั้งชื่อให้มัน (ไม่ตั้งก็ได้)", "Give it a name (optional)", "给它起个名字（可选）")} />
            <button className="pcf-go" onClick={() => {
              const v = { ...newPet(sel.id), name: naming.trim() };
              save(v); playUi("reward");
              say(T(`ยินดีต้อนรับ ${v.name || tr3(sel, lang)}!`, `Welcome, ${v.name || tr3(sel, lang)}!`, `欢迎，${v.name || tr3(sel, lang)}！`));
            }}>{T("ฟักเลย", "Hatch it", "开始孵化")}</button>
          </div>
        )}
        {note && <div className="pet-note">{note}</div>}
      </div>
    );
  }

  /* ── care flow ── */
  const sp = petById(pet.species);
  const ty = PET_TYPES[sp.type];
  const stage = petStage(pet.bond);
  const branch = pendingPath(pet);
  const lv = petLevel(pet.bond);
  const happy = petHappy(pet);
  const bonus = PET_BONUS[sp.bonus];
  const mess = pet.mess || [];
  const owned = PET_FOODS.filter(f => (bag[f.id] || 0) > 0);
  // everything owned, the carried one first — the rail below only shows when
  // there is more than one, so a single-pet player never sees a chooser
  const stable = allPets();

  return (
    <div className="petpage" style={{ "--pc": sp.sw[0], "--pd": sp.sw[1], "--tc": ty.c }}>
      {/* Every card below sets its own vertical-spacing margin (11px, 13px…),
          which on a wide/iPad viewport fought the page's own centering — two
          rules of equal specificity, and the later, per-card one won. One
          real centered column here sidesteps that instead of hunting down
          every card's margin. */}
      <div className="pet-inner">
      <div className="pet-top">
        <button className="pet-back" onClick={onBack}>←</button>
        <b>{pet.name || tr3(sp, lang)}</b>
        <span className="pet-coins">🪙 {coins.toLocaleString()}</span>
      </div>

      {/* ── the stable ──
          Buying a second pet in the shop and then finding no trace of it here
          would be a bug wearing a feature's clothes. Everything owned is on
          this rail; tapping one brings it out. The one you put down keeps
          its name, its bond and its hunger — it is waiting, not gone. */}
      {stable.length > 1 && (
        <div className="pet-stable" role="group" aria-label={T("สัตว์เลี้ยงของคุณ", "Your pets", "你的宠物")}>
          {stable.map(o => {
            const osp = petById(o.species);
            const here = o.species === pet.species;
            return (
              <button key={o.species} type="button" className={`pet-stall${here ? " on" : ""}`}
                style={{ "--sc": osp.sw[0] }}
                onClick={() => { if (!here && carryPet(o.species)) { setPet(readPet()); playUi("reward"); } }}>
                <span className="ps-art"><PetArt species={o.species} level={petLevel(o.bond).lv} mood={here ? happy : petHappy(o)} /></span>
                <b>{o.name || tr3(osp, lang)}</b>
                <i>{here ? T("อยู่ข้างคุณ", "With you", "在你身边") : "Lv " + petLevel(o.bond).lv}</i>
              </button>
            );
          })}
        </div>
      )}

      {/* ── the room ── bought pieces, drawn behind the creature */}
      {(() => {
        const owned = readRoom();
        return (
          <div className="pet-shopfur">
            <b>{T("แต่งห้องให้มัน", "Furnish its room", "布置它的房间")}</b>
            <div className="pet-fur-row">
              {FURNITURE.map(F => {
                const has = owned.indexOf(F.id) >= 0;
                return (
                  <button key={F.id} className={`pet-fur${has ? " own" : ""}`} disabled={has || coins < F.cost}
                    onClick={() => { if (onSpend && onSpend(F.cost)) { buyFurniture(F.id); playUi("reward"); setExpTick(t => t + 1); } }}>
                    <b>{tr3(F, lang)}</b><i>{has ? T("มีแล้ว", "Owned", "已有") : `🪙${F.cost}`}</i>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── expeditions ──
          Sent out, then genuinely gone: the clock is wall-clock and stored, so
          it keeps running with the app shut. */}
      {(() => {
        const left = expedLeft(), done = expedDone(), out = !!readExped();
        void expTick;   // the interval above is what makes this line move
        if (done) return (
          <div className="pet-exped done">
            <b>{T("มันกลับมาแล้ว!", "It is back!", "它回来了！")}</b>
            <button onClick={() => { const E = claimExped(); if (E) { onReward && onReward(0, E.coins); say(T(`ได้ ${E.coins} เหรียญ`, `+${E.coins} coins`, `+${E.coins} 金币`)); playUi("reward"); setPet(readPet()); } }}>
              {T("รับรางวัล", "Collect", "领取")}
            </button>
          </div>
        );
        if (out) {
          const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
          return <div className="pet-exped"><b>{T("ออกลุยอยู่", "Out on an expedition", "外出探险中")}</b><i>{m}m {sec}s</i></div>;
        }
        return (
          <div className="pet-exped pick">
            <b>{T("ส่งไปผจญภัย", "Send it out", "派它出去")}</b>
            <div className="pet-exped-row">
              {EXPEDITIONS.map(E => (
                <button key={E.id} onClick={() => { if (sendExped(E.id)) { playUi("click"); say(T("ออกเดินทางแล้ว", "Off it goes", "出发了")); setExpTick(t => t + 1); } }}>
                  <b>{tr3(E, lang)}</b><i>{E.mins >= 60 ? `${E.mins / 60}h` : `${E.mins}m`} · +{E.bond} · 🪙{E.coins}</i>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── C5: it has an opinion about your practising ──
          The care stats say whether you looked after it. This says whether you
          practised, which in a piano app is the thing that actually matters —
          and it is the pet, not a chart, that tells you. */}
      {(() => {
        const pm = practiceMood(lang);
        return pm ? <div className={`pet-practice${pm.good ? " good" : ""}`}>{pm.text}</div> : null;
      })()}

      {/* ── the fork ──
          A pet at a branch point stops and asks. Both answers are shown with
          what they actually do, and the choice is permanent — which is what
          makes two pets of the same species end up different animals. */}
      {branch && (
        <div className="pet-fork">
          <b>{T("มันพร้อมจะเลือกทางแล้ว", "It is ready to choose a path", "它准备好选择道路了")}</b>
          <div className="pet-fork-row">
            {["a", "b"].map(w => {
              const arm = w === "b" ? branch.b : branch.a;
              return (
                <button key={w} className="pet-fork-opt" onClick={() => { choosePath(pet.species, branch.idx, w); playUi("reward"); setPet(readPet()); }}>
                  <b>{tr3(arm, lang)}</b>
                  <i>{arm.dmg !== 1 ? `⚔ ×${arm.dmg} ` : ""}{arm.gauge !== 1 ? `✦ ×${arm.gauge} ` : ""}{arm.guard !== 1 ? `🛡 ×${arm.guard}` : ""}</i>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── the evolution ── the one moment that deserves the whole screen */}
      {evo && (
        <div className="pet-evo" onClick={() => setEvo(null)}>
          <div className="pet-evo-in">
            <div className="pet-evo-art"><PetArt species={evo.species} level={evo.lv} mood={95} /></div>
            <b>{tr3(STAGE_NAME[evo.to] || STAGE_NAME[1], lang)}</b>
            <i>{T(`ขั้น ${evo.from} → ${evo.to}`, `Stage ${evo.from} → ${evo.to}`, `阶段 ${evo.from} → ${evo.to}`)}</i>
            <button onClick={() => setEvo(null)}>{T("เยี่ยม!", "Nice!", "太好了！")}</button>
          </div>
        </div>
      )}

      <div className="pet-idcard">
        <span className="pi-code">{sp.code}</span>
        <span className="pi-type" style={{ "--tc": ty.c }}>{tr3(ty, lang)}</span>
        {/* the stage now has a NAME. "Stage 4" tells you a number; "Champion"
            tells you what your pet became, which is the half a player repeats
            to somebody else. */}
        <span className="pi-stage">{stage}. {tr3(STAGE_NAME[stage] || STAGE_NAME[1], lang)}</span>
        <span className={`pi-happy${happy < 50 ? " low" : ""}`}>{happy < 35 ? "😿" : happy < 60 ? "😐" : happy < 85 ? "🙂" : "😻"} {happy}%</span>
      </div>

      {/* ── the room ── the pet, its mess, and whatever just happened to it ── */}
      <div className="pet-room">
        <div className="pr-floor" />
        {/* what you bought for it, behind the creature and in front of the floor */}
        <PetRoom owned={readRoom()} />
        {/* a tap on the creature is free affection — a stroke, a heart, no
            stat and no coins. Playing is the priced button below; an accidental
            tap in here must never cost anybody 25 coins. */}
        <div className={`pr-pet${happy < 40 ? " sad" : ""}`} onClick={() => { pop("💛", 3); playUi("click"); }}>
          <PetArt species={sp.id} level={lv.lv} mood={pet.mood} />
        </div>
        {mess.map(m => (
          <button key={m.id} className="pr-mess" style={{ left: `${m.x}%`, top: `${m.y}%` }}
            onClick={() => sweep(m.id)} title={T("แตะเพื่อเก็บ", "Tap to clean up", "点击清理")}>💩</button>
        ))}
        {fx.map(f => (
          <span key={f.id} className="pr-fx" style={{ left: `${f.x}%`, animationDelay: `${f.d}ms`, "--rot": `${f.r}deg` }}>{f.ic}</span>
        ))}
        {mess.length > 0 && <div className="pr-hint">{T("แตะกองที่พื้นเพื่อเก็บ", "Tap the mess to clean it up", "点击地上的脏东西清理")}</div>}
      </div>

      {/* ── bond ── */}
      <div className="pet-bond">
        <div className="pb-row"><b>{T("ความผูกพัน", "Bond", "羁绊")} · Lv.{lv.lv}</b><span>{lv.into} / {lv.need}</span></div>
        <div className="pb-bar"><i style={{ width: `${Math.round(lv.pct * 100)}%` }} /></div>
        {/* the next level is a thing you can picture, not a number */}
        <div className="pb-sub">
          {(() => {
            const nx = nextGrowth(lv.lv);
            return nx
              ? T(`Lv.${nx.lv} → ${nx.th}`, `Lv.${nx.lv} → ${nx.en}`, `Lv.${nx.lv} → ${nx.zh}`)
              : T("โตเต็มที่แล้ว — ร่างสมบูรณ์", "Fully grown — final form", "已完全长大 —— 最终形态");
          })()}
        </div>
      </div>

      {/* ── stats ── */}
      <div className="pet-stats">
        {["hunger", "clean", "coat", "mood"].map(k => {
          const c = k === "hunger" ? "#ff9a4c" : k === "clean" ? "#5ce1ff" : k === "coat" ? "#c7a6ff" : "#3ddc84";
          return (
            <div key={k} className={`ps-row${pet[k] < 35 ? " low" : ""}`}>
              <span className="ps-nm">{tr3(STAT_TEXT[k], lang)}</span>
              <span className="ps-bar"><i style={{ width: `${Math.round(pet[k])}%`, background: c }} /></span>
              <span className="ps-n">{Math.round(pet[k])}</span>
            </div>
          );
        })}
      </div>

      {/* ── actions ── */}
      <div className="pet-acts">
        {["feed", "bath", "brush", "play"].map(k => {
          const cost = CARE[k].cost;
          return (
            <button key={k} className={`pet-act${cost > 0 && coins < cost ? " poor" : ""}`} style={{ "--ac": CARE[k].c }} onClick={() => care(k)}>
              <span>{CARE[k].ic}</span><b>{tr3(CARE_TEXT[k], lang)}</b>
              <u>{cost > 0 ? `🪙 ${cost}` : T("ใช้อาหาร", "uses food", "消耗食物")}</u>
            </button>
          );
        })}
      </div>
      <p className="pet-why">
        {T("ทุกอย่างในห้องนี้ใช้เหรียญ — เหรียญได้มาจากการฝึกซ้อมและเรียนในแอปเท่านั้น",
           "Everything in here costs coins, and coins only come from practising and learning in the app.",
           "这里的一切都要花金币，而金币只能靠在应用里练习和学习赚取。")}
      </p>

      {/* ── the pantry ── */}
      {tray && (
        <div className="pet-tray">
          <div className="pt-hdr">
            <b>{T("เลือกอาหาร", "Choose a food", "选择食物")}</b>
            <button onClick={() => setTray(false)}>✕</button>
          </div>
          {owned.length === 0 && <p className="pt-empty">{T("ยังไม่มีอาหารเลย — ซื้อจากร้านด้านล่าง", "Nothing in the pantry — buy some below", "食物已空 —— 请在下方购买")}</p>}
          <div className="pt-list">
            {owned.map(f => (
              <button key={f.id} className={`pt-food${f.id === sp.food ? " fav" : ""}`} onClick={() => care("feed", f)}>
                <span className="pt-ic"><ItemArt art={f.art} sw={f.sw} /></span>
                <b>{tr3(f, lang)}</b>
                <i>×{bag[f.id]}</i>
                {f.id === sp.food && <em>{T("ของโปรด ×2", "Favourite ×2", "最爱 ×2")}</em>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pet-shop">
        <div className="pt-hdr"><b>{T("ร้านอาหารสัตว์เลี้ยง", "Pet Pantry", "宠物食品店")}</b></div>
        <div className="pt-list">
          {PET_FOODS.map(f => (
            <button key={f.id} className={`pt-food buy${f.id === sp.food ? " fav" : ""}${coins < f.cost ? " poor" : ""}`} onClick={() => buy(f)}>
              <span className="pt-ic"><ItemArt art={f.art} sw={f.sw} /></span>
              <b>{tr3(f, lang)}</b>
              <i>🪙 {f.cost}</i>
              {(bag[f.id] || 0) > 0 && <u>×{bag[f.id]}</u>}
              {f.id === sp.food && <em>{T("ของโปรด ×2", "Favourite ×2", "最爱 ×2")}</em>}
            </button>
          ))}
        </div>
      </div>

      {/* ── what it does in a fight ── */}
      <div className={`pet-arena${happy < 50 ? " off" : ""}`}>
        <b>⚔ {T("ในสนามประลอง", "In the arena", "在竞技场")}</b>
        <span>{happy < 50
          ? T("ตอนนี้มันเหนื่อยเกินกว่าจะช่วยสู้ — ดูแลให้ถึง 50% ก่อน",
              "Too worn out to help right now — get it back above 50%",
              "现在太累了帮不上忙 —— 先照顾到 50% 以上")
          : `${tr3(bonus, lang)}${stage > 1 ? T(` · ขั้น ${stage} เพิ่มอีก`, ` · stage ${stage} boosts it further`, ` · 阶段 ${stage} 进一步提升`) : ""}`}</span>
      </div>

      {note && <div className="pet-note">{note}</div>}
      </div>
    </div>
  );
});
