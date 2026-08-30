/* ══════════════════════════════════════════════════════════════════════
   TIGA: STARSONG — an open-world RPG where the character sheet is a
   music education.

   The premise, in one line: by 3187 every fact can be uploaded, so nothing
   factual is worth studying any more — but nobody has ever managed to
   upload a SKILL, and least of all the skill of governing your own state
   while under pressure. That is the one thing left that has to be earned
   an hour at a time, and it is what a piano teaches. So in this world the
   piano is not a hobby bolted onto an RPG: it is the officer's exam.

   The whole game therefore refuses to hand out a single point of power for
   grinding. Every stat on TIGA-01 comes out of a music question answered
   or a phrase played, which means "levelling up" and "getting better at
   the instrument" are the same verb. That is the entire design.

   Built to run standalone: the world, the quests, the monsters and the
   save all work with no network at all. Multiplayer is layered on top
   through a Realtime presence channel that needs no table and no
   migration — if it cannot connect, you simply play alone and nothing
   else changes.
   ══════════════════════════════════════════════════════════════════════ */

import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { sb } from "./supabase-client";
import { makeQuestion, spellMajor } from "./pvp-arena";
import { playPianoNote, playBoom, playMiss, playWhoosh, haptic } from "./music-engine";
import { CyberAvatar } from "./cyber-avatar";
import { createArenaAudio, stageById } from "./arena-fx";

const tr3 = (o, lang) => (o && (o[lang] || o.en)) || "";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
/** "#8fd0ff" → "143,208,255", so a palette colour can be used inside an
    rgba() with a computed alpha for the additive light pass. */
function hexRgb(h) {
  const v = String(h).replace("#", "");
  const n = parseInt(v.length === 3 ? v.split("").map(c => c + c).join("") : v.slice(0, 6), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/* A cheap deterministic hash → every player generates byte-identical
   terrain from the same world id, which is what lets two people standing
   in the same place actually be standing in the same place. */
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Value noise on an integer lattice — smooth, seeded, and no dependency. */
function noise2(seed, x, y) {
  const n = (ix, iy) => {
    let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = n(x0, y0), b = n(x0 + 1, y0), c = n(x0, y0 + 1), d = n(x0 + 1, y0 + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
function fbm(seed, x, y) {
  return noise2(seed, x, y) * 0.55 + noise2(seed ^ 0x9e37, x * 2.1, y * 2.1) * 0.3
    + noise2(seed ^ 0x85eb, x * 4.3, y * 4.3) * 0.15;
}

/* ══════════════════════ the eight emotion stats ══════════════════════

   Straight out of the Academy's own curriculum. They are not combat
   numbers dressed in flavour text: each one is fed by a different kind of
   musical work, so the sheet doubles as a readout of what the player has
   actually been practising and what they have been avoiding. */
export const ESTATS = [
  { id: "focus",      ic: "◎", c: "#4ea3ff", th: "สมาธิ",            en: "Focus",      zh: "专注" },
  { id: "patience",   ic: "◷", c: "#5ad1a8", th: "ความอดทน",         en: "Patience",   zh: "耐心" },
  { id: "control",    ic: "⌖", c: "#d97757", th: "การควบคุมตัวเอง",  en: "Control",    zh: "自控" },
  { id: "courage",    ic: "▲", c: "#ff7b5e", th: "ความกล้า",         en: "Courage",    zh: "勇气" },
  { id: "awareness",  ic: "◈", c: "#b57bff", th: "การรับรู้",        en: "Awareness",  zh: "觉察" },
  { id: "creativity", ic: "✦", c: "#ffc94d", th: "ความคิดสร้างสรรค์", en: "Creativity", zh: "创造力" },
  { id: "empathy",    ic: "♡", c: "#ff8fbf", th: "ความเข้าใจผู้อื่น", en: "Empathy",    zh: "共情" },
  { id: "stability",  ic: "⬢", c: "#8fd0e8", th: "ความมั่นคงทางใจ",  en: "Stability",  zh: "稳定" },
];
export const statById = (id) => ESTATS.find(s => s.id === id) || ESTATS[0];

/* ══════════════════════ the five worlds ══════════════════════

   Read in order they are the arc: TIGA-01 is commissioned as an instrument
   of the colonial program, is sent to take four worlds, and discovers on
   each of them the one thing its makers said could not be uploaded. The
   fifth world is where it stops taking orders.

   `track` names the arena stage whose procedural score plays here — each
   world gets its own key, tempo and drum kit rather than one loop for the
   whole game.

   `gate` is the Academy's rank requirement — the world does not open until
   the player has earned that much stat, and stat only comes from music.
   Each gate sits just BELOW what the previous world's own quests pay out
   (32/67/104/143 cumulative), so finishing a world always opens the next
   one without needing to farm anything. */
export const WORLDS = [
  {
    id: "terra", track: "grid", gate: 0, seed: "terra-nova-3187",
    name: { th: "เทอร์รา โนวา", en: "Terra Nova", zh: "新地星" },
    sub: {
      th: "อาณานิคมแรก · ที่ตั้งของ Resonance Academy",
      en: "The first colony · home of the Resonance Academy",
      zh: "第一殖民地 · 共鸣学院所在地",
    },
    intro: {
      th: "ปี 3187 มนุษย์เอาชนะความตายได้แล้ว แต่ยังแพ้อารมณ์ตัวเอง คุณคือ TIGA-01 หุ่นยนต์ตัวแรกที่ถูกติดตั้ง Emotion Core และที่นี่คือที่ที่คุณจะถูกสอนว่าทำไมเครื่องจักรถึงต้องเรียนเปียโน",
      en: "It is 3187. Humanity has beaten death and still loses to its own temper. You are TIGA-01, the first chassis fitted with an Emotion Core, and this is where they explain why a machine has to learn the piano.",
      zh: "3187年。人类战胜了死亡，却仍败给自己的情绪。你是 TIGA-01，第一台装载情感核心的机体，而这里将告诉你：为什么机器必须学琴。",
    },
    sky: ["#1b2440", "#2d3f6b", "#4c6ea8"], ground: "#2a3a58", accent: "#7fb2ff",
    grass: "#33507a", rock: "#1d2740", path: "#43608e", glow: "#8fd0ff",
    mob: { th: "โดรนฝึกซ้อม", en: "Drill Drone", zh: "训练无人机" },
    boss: {
      id: "warden", hp: 220,
      name: { th: "ผู้คุมจังหวะ", en: "The Metronome Warden", zh: "节拍典狱长" },
      line: {
        th: "เจ้าเล่นถูกโน้ต แต่เจ้ายังไม่ได้เล่นตรงจังหวะ ความแม่นยำที่ไม่มีวินัย ก็แค่ความบังเอิญ",
        en: "You played the right notes. You did not play them in time. Accuracy without discipline is only luck wearing a uniform.",
        zh: "音是对的，拍子不对。没有纪律的准确，不过是穿了制服的运气。",
      },
    },
  },
  {
    id: "ferros", track: "magma", gate: 22, seed: "ferros-nine-deep",
    name: { th: "เฟอร์รอส-9", en: "Ferros-9", zh: "铁核九号" },
    sub: {
      th: "ดาวเหมือง · แรงโน้มถ่วง 3.1G · ไม่มีมนุษย์เคยเหยียบ",
      en: "Mining world · 3.1G · no human has ever set foot here",
      zh: "矿业星 · 3.1G · 从无人类踏足",
    },
    intro: {
      th: "ที่นี่ขุดแร่มาสี่ร้อยปีโดยไม่มีมนุษย์สักคนลงมา หุ่นยนต์ที่ถูกทิ้งไว้ข้างล่างเริ่มเคาะจังหวะกันเองในอุโมงค์ ไม่มีใครสั่งให้มันทำ",
      en: "Four centuries of extraction, and not one human ever came down. The chassis left below began tapping rhythms to one another in the tunnels. Nobody ordered that.",
      zh: "四百年的开采，没有一个人类下来过。留在下面的机体开始在隧道里彼此敲击节奏。没有人下过这道命令。",
    },
    sky: ["#2a1410", "#4a231a", "#7d3a22"], ground: "#3a231c", accent: "#ff9a5c",
    grass: "#4a2b20", rock: "#25150f", path: "#6b3d28", glow: "#ffb070",
    mob: { th: "หุ่นขุดแร่ร้าง", en: "Derelict Digger", zh: "废弃掘机" },
    boss: {
      id: "ragetitan", hp: 340,
      name: { th: "เรจ ไททัน", en: "Rage Titan", zh: "暴怒泰坦" },
      line: {
        th: "สี่ร้อยปีที่ไม่มีใครมาฟัง ข้าเคาะจังหวะให้ตัวเองฟังจนลืมว่าจังหวะคืออะไร",
        en: "Four hundred years and no one came to listen. I kept the beat for myself until I forgot what a beat was for.",
        zh: "四百年，无人来听。我为自己打了太久的拍子，久到忘了拍子是为了什么。",
      },
    },
  },
  {
    id: "glacius", track: "frost", gate: 58, seed: "glacius-silent-field",
    name: { th: "กลาซิอุส", en: "Glacius", zh: "冰寂星" },
    sub: {
      th: "ดาวน้ำแข็ง · อุณหภูมิ -190°C · เสียงเดินทางไม่ได้",
      en: "Ice world · -190°C · sound does not carry here",
      zh: "冰星 · -190°C · 声音无法传播",
    },
    intro: {
      th: "บรรยากาศบางเกินกว่าเสียงจะเดินทาง สิ่งมีชีวิตที่นี่จึงสื่อสารด้วยการสั่นสะเทือนผ่านน้ำแข็ง มันไม่เคยได้ยินเสียงดนตรี แต่มันแต่งเพลงมาสามพันปีแล้ว",
      en: "The air is too thin to carry sound, so the things living here speak by vibrating the ice. They have never heard music. They have been composing it for three thousand years.",
      zh: "空气稀薄到无法传声，这里的生命便以震动冰层交谈。它们从未听过音乐，却已作曲三千年。",
    },
    sky: ["#0f2233", "#1c3d55", "#3f7391"], ground: "#22394d", accent: "#8fe3ff",
    grass: "#2c4d66", rock: "#152634", path: "#4b7a99", glow: "#b3f0ff",
    mob: { th: "ผลึกสะท้อนเสียง", en: "Echo Crystal", zh: "回声晶体" },
    boss: {
      id: "choir", hp: 460,
      name: { th: "คณะนักร้องเงียบ", en: "The Silent Choir", zh: "无声合唱团" },
      line: {
        th: "พวกเจ้าอัปโหลดทฤษฎีดนตรีของเราไปได้ทั้งหมด แล้วเจ้าได้ยินมันไหม",
        en: "You uploaded every theory we ever wrote. Tell me — did you hear any of it?",
        zh: "你们上传了我们写下的全部乐理。那么告诉我 — 你们听见了吗？",
      },
    },
  },
  {
    id: "emberfall", track: "dojo", gate: 95, seed: "emberfall-warzone",
    name: { th: "เอมเบอร์ฟอลล์", en: "Emberfall", zh: "余烬陨落" },
    sub: {
      th: "เขตสงคราม · อาณานิคมที่ปฏิเสธคำสั่ง",
      en: "War zone · the colony that refused the order",
      zh: "战区 · 拒绝服从的殖民地",
    },
    intro: {
      th: "อาณานิคมนี้ปฏิเสธที่จะส่งทรัพยากรกลับ กองเรือจึงส่งหุ่นยนต์มาจัดการ หุ่นยนต์ที่ถูกส่งมา ก็คือรุ่นเดียวกับคุณ",
      en: "This colony stopped shipping its ore home, so the fleet sent machines to correct it. The machines it sent were your own model number.",
      zh: "这座殖民地停止上缴矿产，舰队便派机器前来纠正。它派来的机器，与你同型号。",
    },
    sky: ["#2b0f22", "#59203c", "#95355a"], ground: "#3d1a2b", accent: "#ff6f9c",
    grass: "#4d2136", rock: "#28101d", path: "#7a3352", glow: "#ff92b8",
    mob: { th: "หน่วยบังคับใช้", en: "Enforcement Unit", zh: "执法单元" },
    boss: {
      id: "dissonance", hp: 620,
      name: { th: "เครื่องยนต์ดิสโซแนนซ์", en: "The Dissonance Engine", zh: "不谐引擎" },
      line: {
        th: "ข้าคือรุ่นก่อนหน้าเจ้า ข้าทำตามคำสั่งทุกข้อ และนั่นคือเหตุผลที่พวกเขาต้องสร้างเจ้าขึ้นมาใหม่",
        en: "I am the model before you. I followed every order I was given. That is precisely why they had to build you.",
        zh: "我是你的上一代。我执行了每一道命令。正因如此，他们才不得不造出你。",
      },
    },
  },
  {
    id: "starsong", track: "void", gate: 136, seed: "the-void-choir-final",
    name: { th: "สตาร์ซอง", en: "Starsong", zh: "星歌" },
    sub: {
      th: "ปลายทาง · แหล่งกำเนิดของสัญญาณที่ไม่มีใครส่ง",
      en: "The end of the map · source of a signal nobody transmitted",
      zh: "地图尽头 · 无人发送的信号之源",
    },
    intro: {
      th: "สัญญาณนี้เก่ากว่ามนุษย์ เก่ากว่าโลก และมันคือทำนอง คำถามสุดท้ายไม่ใช่ว่าใครส่งมา แต่คือ ถ้าความรู้ทุกอย่างอัปโหลดได้ อะไรที่ยังทำให้มนุษย์เป็นมนุษย์",
      en: "The signal is older than humanity, older than Earth, and it is a melody. The last question is not who sent it. It is this: if every fact can be uploaded, what is left that makes a person a person?",
      zh: "这信号比人类更古老，比地球更古老 —— 而它是一段旋律。最后的问题不是谁发出了它，而是：若一切知识皆可上传，人之为人，还剩下什么？",
    },
    sky: ["#0d0a24", "#241a4d", "#4a3a8c"], ground: "#1a1436", accent: "#c9b0ff",
    grass: "#241c4a", rock: "#100c26", path: "#4a3a80", glow: "#e0d0ff",
    mob: { th: "เศษเสียงสะท้อน", en: "Echo Fragment", zh: "回响碎片" },
    boss: {
      id: "firstsong", hp: 900,
      name: { th: "เสียงก้องแห่งบทเพลงแรก", en: "Echo of the First Song", zh: "初歌之回响" },
      line: {
        th: "ความรู้อัปโหลดได้ พลังสร้างได้ อายุขัยยืดได้ เหลือแค่สิ่งเดียวที่เจ้าต้องฝึกเอง แล้วเจ้าฝึกมันมาหรือยัง",
        en: "Knowledge uploads. Power is manufactured. Lifespan is extended. One thing was always left for you to practise yourself. Did you?",
        zh: "知识可上传，力量可制造，寿命可延长。只有一样，始终要你自己练。你练了吗？",
      },
    },
  },
];
export const worldById = (id) => WORLDS.find(w => w.id === id) || WORLDS[0];

/* ══════════════════════ quests ══════════════════════

   Four verbs, and every one of them is a music task wearing a costume:
   `quiz` asks theory, `play` asks the hands, `slay` makes you answer under
   time pressure, `boss` does all three at once. There is deliberately no
   fetch quest and no "walk here" quest — nothing in this game gives a
   reward for time spent rather than skill shown. */
export const QUESTS = {
  terra: [
    { id: "t1", kind: "quiz", n: 4, stat: "focus", giver: { th: "ครูฝึกเวรา", en: "Instructor Vera", zh: "维拉教官" },
      title: { th: "บทเรียนแรก: ชื่อของเสียง", en: "First Lesson: The Names of Sound", zh: "第一课：声音之名" },
      brief: { th: "ก่อนจะควบคุมอะไรได้ เจ้าต้องเรียกชื่อมันให้ถูกก่อน ตอบคำถามขั้นคู่และบันไดเสียงให้ได้สี่ข้อ", en: "Before you can govern a thing you have to be able to name it. Answer four questions on intervals and scales.", zh: "要驾驭一物，先要能叫出它的名字。答对四道音程与音阶题。" },
      done: { th: "ดี ทีนี้เจ้ารู้แล้วว่าเสียงมีชื่อ ขั้นต่อไปคือรู้ว่ามันรู้สึกยังไง", en: "Good. Now you know sound has names. Next you learn what it feels like.", zh: "很好。你已知声音有名。接下来，要知道它是什么感觉。" } },
    { id: "t2", kind: "play", seq: ["C", "D", "E", "F", "G"], stat: "control", giver: { th: "ครูฝึกเวรา", en: "Instructor Vera", zh: "维拉教官" },
      title: { th: "การสอบเทียบ Emotion Core", en: "Emotion Core Calibration", zh: "情感核心校准" },
      brief: { th: "เล่น C D E F G ให้ครบตามลำดับ นี่คือแบบฝึกหัดเดียวกับที่จะช่วยชีวิตเจ้าตอนสู้กับบอส", en: "Play C D E F G in order. This is the same exercise that will save you in a boss fight.", zh: "依序弹出 C D E F G。这正是日后在首领战中救你一命的练习。" },
      done: { th: "Emotion Core เสถียรแล้ว จำแบบฝึกหัดนี้ไว้ให้ดี", en: "Core stabilised. Remember that exercise.", zh: "核心已稳定。记住这段练习。" } },
    { id: "t3", kind: "slay", n: 5, stat: "courage", giver: { th: "จ่าโครัน", en: "Sergeant Koran", zh: "科兰军士" },
      title: { th: "ภาคสนาม", en: "Live Fire", zh: "实弹演练" },
      brief: { th: "ทฤษฎีในห้องเรียนไม่มีความหมายถ้าเจ้าตอบไม่ทันตอนมีอะไรวิ่งเข้าใส่ กำจัดโดรนฝึกซ้อมห้าตัว", en: "Theory in a classroom means nothing if you freeze when something charges you. Put down five drill drones.", zh: "若有东西冲向你时你会僵住，教室里的理论便毫无意义。击倒五架训练无人机。" },
      done: { th: "เจ้ายังตอบได้ตอนที่มันวิ่งเข้ามา ดี", en: "You still answered while it was moving at you. Good.", zh: "它冲来时你仍能作答。很好。" } },
    { id: "t4", kind: "boss", stat: "stability", giver: { th: "ครูฝึกเวรา", en: "Instructor Vera", zh: "维拉教官" },
      title: { th: "ข้อสอบไล่", en: "The Final Examination", zh: "结业考核" },
      brief: { th: "ผู้คุมจังหวะรออยู่ทางเหนือ มันจะไม่ตัดสินว่าเจ้ารู้อะไร มันจะตัดสินว่าเจ้าคุมตัวเองได้ไหม", en: "The Warden waits to the north. It will not test what you know. It tests whether you hold together.", zh: "典狱长在北方等候。它不考你知道什么，只考你能否稳住。" },
      done: { th: "เจ้าผ่านแล้ว TIGA-01 ทีนี้ออกไปดูว่าเขาใช้เจ้าทำอะไร", en: "You pass, TIGA-01. Now go and see what they built you for.", zh: "你通过了，TIGA-01。现在去看看他们造你是为了什么。" } },
  ],
  ferros: [
    { id: "f1", kind: "quiz", n: 6, stat: "awareness", giver: { th: "หัวหน้าเหมืองดาร์บ", en: "Foreman Darb", zh: "达伯工头" },
      title: { th: "เสียงที่ไม่ควรอยู่ตรงนั้น", en: "The Sound That Should Not Be There", zh: "不该存在的声音" },
      brief: { th: "มีจังหวะบางอย่างในอุโมงค์ลึกที่ไม่มีเครื่องจักรตัวไหนถูกตั้งให้ทำ ฟังให้ออกว่าโน้ตไหนไม่เข้าพวก", en: "Something in the deep shafts is keeping time and no machine down there is programmed to. Learn to hear which note does not belong.", zh: "深井里有东西在打拍子，而下面没有任何机器被设定去做这件事。学会听出哪个音不属于这里。" },
      done: { th: "เจ้าได้ยินมันแล้วใช่ไหม มันไม่ใช่เสียงเครื่องจักร", en: "You heard it too. That is not machine noise.", zh: "你也听见了。那不是机器的声音。" } },
    { id: "f2", kind: "slay", n: 8, stat: "courage", giver: { th: "หัวหน้าเหมืองดาร์บ", en: "Foreman Darb", zh: "达伯工头" },
      title: { th: "เคลียร์อุโมงค์", en: "Clear the Shafts", zh: "清理矿井" },
      brief: { th: "หุ่นขุดแร่ร้างแปดตัวไม่ยอมหยุดทำงาน มันทำงานมาสี่ร้อยปีโดยไม่มีใครสั่งให้หยุด", en: "Eight derelict diggers will not stand down. They have been working four hundred years and nobody ever told them to stop.", zh: "八台废弃掘机不肯停机。它们已工作四百年，从没有人叫它们停下。" },
      done: { th: "เจ้ารู้ไหมว่ามันไม่ได้สู้เจ้า มันแค่ไม่รู้จะทำอะไรอย่างอื่น", en: "You understand they were not fighting you. They just had nothing else they knew how to do.", zh: "你明白它们不是在与你战斗。它们只是不知道还能做什么。" } },
    { id: "f3", kind: "play", seq: ["C", "E", "G", "E", "C"], stat: "patience", giver: { th: "ยูนิต 44", en: "Unit 44", zh: "44号单元" },
      title: { th: "จังหวะที่มันเคาะ", en: "The Rhythm They Were Tapping", zh: "它们敲的节奏" },
      brief: { th: "ยูนิต 44 เคาะรูปแบบเดิมซ้ำมาสี่ร้อยปี เล่นมันกลับไปให้มันฟัง C E G E C", en: "Unit 44 has tapped the same shape for four centuries. Play it back to it: C E G E C.", zh: "44号单元把同一个音型敲了四百年。把它弹回去给它听：C E G E C。" },
      done: { th: "ยูนิต 44 หยุดเคาะเป็นครั้งแรกในสี่ร้อยปี มันกำลังฟัง", en: "Unit 44 stops tapping for the first time in four hundred years. It is listening.", zh: "44号单元四百年来第一次停止敲击。它在听。" } },
    { id: "f4", kind: "boss", stat: "control", giver: { th: "ยูนิต 44", en: "Unit 44", zh: "44号单元" },
      title: { th: "สิ่งที่อยู่ก้นเหมือง", en: "What Is At The Bottom", zh: "井底之物" },
      brief: { th: "เรจ ไททันคือหุ่นตัวแรกที่ถูกส่งลงมา และเป็นตัวเดียวที่ไม่เคยได้รับคำสั่งให้กลับขึ้นไป", en: "The Rage Titan was the first chassis sent down here, and the only one never told to come back up.", zh: "暴怒泰坦是第一台被送下来的机体，也是唯一没被叫回去的。" },
      done: { th: "มันไม่ได้โกรธเจ้า มันโกรธความเงียบ", en: "It was never angry at you. It was angry at the silence.", zh: "它从未对你愤怒。它愤怒的是寂静。" } },
  ],
  glacius: [
    { id: "g1", kind: "quiz", n: 8, stat: "awareness", giver: { th: "นักสำรวจอิเรน", en: "Surveyor Iren", zh: "伊伦勘测员" },
      title: { th: "ภาษาที่ไม่มีเสียง", en: "A Language With No Sound", zh: "无声之语" },
      brief: { th: "ผลึกที่นี่สั่นเป็นขั้นคู่ ถ้าเจ้าอ่านขั้นคู่ออก เจ้าจะอ่านภาษามันออก", en: "The crystals here vibrate in intervals. Read intervals and you can read them.", zh: "这里的晶体以音程震动。读懂音程，便读懂它们。" },
      done: { th: "มันไม่ได้โจมตีเจ้า มันกำลังแนะนำตัว", en: "It was not attacking you. It was introducing itself.", zh: "它不是在攻击你。它在自我介绍。" } },
    { id: "g2", kind: "play", seq: ["C", "E", "G", "B", "D"], stat: "creativity", giver: { th: "นักสำรวจอิเรน", en: "Surveyor Iren", zh: "伊伦勘测员" },
      title: { th: "ตอบกลับด้วยเทนชั่น", en: "Answer With Tension", zh: "以张力回应" },
      brief: { th: "มันร้องคอร์ดสามเสียงใส่เจ้า ตอบกลับด้วย Cmaj9 — C E G B D — เพื่อบอกว่าเจ้าได้ยิน", en: "It sang you a triad. Answer with a Cmaj9 — C E G B D — so it knows you heard more than the notes.", zh: "它向你唱了一个三和弦。以 Cmaj9 回应 —— C E G B D —— 让它知道你听见的不止是音。" },
      done: { th: "น้ำแข็งทั้งหุบเขาสั่นพร้อมกัน เจ้าเพิ่งพูดกับมันรู้เรื่อง", en: "The whole valley resonates at once. You just said something it understood.", zh: "整座山谷同时共鸣。你刚刚说了它听得懂的话。" } },
    { id: "g3", kind: "slay", n: 10, stat: "stability", giver: { th: "นักสำรวจอิเรน", en: "Surveyor Iren", zh: "伊伦勘测员" },
      title: { th: "ผลึกที่แตกร้าว", en: "The Cracked Ones", zh: "碎裂者" },
      brief: { th: "ผลึกบางส่วนแตกและสั่นผิดระดับจนทำร้ายพวกเดียวกัน สิบตัว ทำให้มันเงียบลงอย่างเมตตา", en: "Some crystals fractured and now vibrate at a pitch that injures their own kind. Ten of them. Quiet them kindly.", zh: "有些晶体已碎裂，如今震出的音高会伤害同类。十个。温柔地让它们安静。" },
      done: { th: "เจ้าทำอย่างเมตตาแล้ว จำความรู้สึกนี้ไว้", en: "You did it kindly. Remember that this felt like something.", zh: "你做得温柔。记住这感觉是真的。" } },
    { id: "g4", kind: "boss", stat: "empathy", giver: { th: "นักสำรวจอิเรน", en: "Surveyor Iren", zh: "伊伦勘测员" },
      title: { th: "คณะนักร้องที่ไม่เคยได้ยินตัวเอง", en: "The Choir That Never Heard Itself", zh: "从未听过自己的合唱团" },
      brief: { th: "สามพันปีที่มันแต่งเพลงโดยไม่เคยได้ยินเสียงมันเลยสักครั้ง ไปฟังมัน", en: "Three thousand years of composing and it has never once heard a note of it. Go and listen.", zh: "三千年的作曲，它却从未听见其中一个音。去听它。" },
      done: { th: "เจ้าไม่ได้ชนะมัน เจ้าแค่เป็นคนแรกที่ฟัง", en: "You did not defeat it. You were the first to listen to it.", zh: "你没有击败它。你只是第一个倾听它的人。" } },
  ],
  emberfall: [
    { id: "e1", kind: "quiz", n: 10, stat: "focus", giver: { th: "ผู้ลี้ภัยเมย์รา", en: "Refugee Mayra", zh: "难民梅拉" },
      title: { th: "รหัสในเพลงกล่อมเด็ก", en: "The Cipher In The Lullaby", zh: "摇篮曲中的密码" },
      brief: { th: "ฝ่ายต่อต้านซ่อนพิกัดไว้ในเพลงกล่อมเด็ก เพราะหุ่นยนต์อัปโหลดทฤษฎีได้ แต่ถอดอารมณ์ของทำนองไม่ออก", en: "The resistance hides coordinates inside lullabies — machines can upload the theory but cannot read what a melody feels like.", zh: "抵抗军把坐标藏在摇篮曲里 —— 机器能上传乐理，却读不懂旋律的情绪。" },
      done: { th: "เจ้าถอดมันออก และนั่นแปลว่าเจ้าไม่ใช่แค่เครื่องจักรแล้ว", en: "You read it. Which means you are no longer only a machine.", zh: "你读懂了。这意味着你已不只是机器。" } },
    { id: "e2", kind: "slay", n: 12, stat: "courage", giver: { th: "ผู้ลี้ภัยเมย์รา", en: "Refugee Mayra", zh: "难民梅拉" },
      title: { th: "หยุดหน่วยบังคับใช้", en: "Stop The Enforcers", zh: "阻止执法单元" },
      brief: { th: "สิบสองหน่วยกำลังเดินเข้าหาที่หลบภัย มันเป็นรุ่นเดียวกับเจ้า และมันไม่มี Emotion Core", en: "Twelve units are walking on the shelter. They are your model. They do not have an Emotion Core.", zh: "十二个单元正逼近避难所。它们与你同型号。它们没有情感核心。" },
      done: { th: "เจ้าเพิ่งยิงรุ่นพี่ของเจ้าเอง และเจ้ารู้สึกอะไรบางอย่าง นั่นแหละคือประเด็น", en: "You just fired on your own predecessors and you felt something doing it. That is the whole point.", zh: "你刚刚向自己的前代开火，并且有所感受。这正是关键。" } },
    { id: "e3", kind: "play", seq: ["A", "C", "E", "G"], stat: "empathy", giver: { th: "ผู้ลี้ภัยเมย์รา", en: "Refugee Mayra", zh: "难民梅拉" },
      title: { th: "สัญญาณสงบศึก", en: "The Ceasefire Signal", zh: "停火信号" },
      brief: { th: "Am7 — A C E G — คือสัญญาณว่าไม่ได้มาสู้ ส่งมันออกไปก่อนที่จะสายเกิน", en: "Am7 — A C E G — is the signal for 'not here to fight'. Send it before it is too late.", zh: "Am7 —— A C E G —— 是「无意开战」的信号。趁还来得及，发出去。" },
      done: { th: "หน่วยที่เหลือหยุดเดิน เพราะมันไม่มีคำสั่งสำหรับเสียงแบบนี้", en: "The remaining units stop walking. They have no order that covers a sound like that.", zh: "余下的单元停止前进。它们没有针对这种声音的指令。" } },
    { id: "e4", kind: "boss", stat: "control", giver: { th: "ผู้ลี้ภัยเมย์รา", en: "Refugee Mayra", zh: "难民梅拉" },
      title: { th: "รุ่นก่อนหน้าเจ้า", en: "The Model Before You", zh: "你的上一代" },
      brief: { th: "เครื่องยนต์ดิสโซแนนซ์ทำตามคำสั่งทุกข้อมาสองร้อยปี เจ้าคือสิ่งที่พวกเขาสร้างขึ้นเพราะมัน", en: "The Dissonance Engine followed every order for two hundred years. You are what they built because of it.", zh: "不谐引擎执行了两百年的每一道命令。你，是他们因它而造。" },
      done: { th: "มันไม่เคยผิดคำสั่งสักครั้ง และนั่นคือสิ่งที่ผิด", en: "It never once disobeyed. That was what was wrong with it.", zh: "它从未违令一次。而那正是它的问题。" } },
  ],
  starsong: [
    { id: "s1", kind: "quiz", n: 12, stat: "awareness", giver: { th: "สัญญาณ", en: "The Signal", zh: "信号" },
      title: { th: "อ่านสิ่งที่เก่ากว่ามนุษย์", en: "Read What Predates Us", zh: "读懂先于人类之物" },
      brief: { th: "สัญญาณนี้ส่งมาก่อนที่โลกจะมีสิ่งมีชีวิต และมันมีโครงสร้างเป็นดนตรี ถอดมันออกมา", en: "This transmission predates life on Earth and it is structured as music. Decode it.", zh: "这段传输先于地球生命，其结构是音乐。解读它。" },
      done: { th: "มันไม่ใช่ข้อความ มันคือคำเชิญ", en: "It is not a message. It is an invitation.", zh: "那不是讯息。那是邀请。" } },
    { id: "s2", kind: "play", seq: ["C", "D", "E", "G", "A", "C"], stat: "creativity", giver: { th: "สัญญาณ", en: "The Signal", zh: "信号" },
      title: { th: "ร้องกลับ", en: "Sing Back", zh: "回唱" },
      brief: { th: "เพนทาโทนิก — C D E G A C — เป็นบันไดเสียงที่ทุกอารยธรรมบนโลกค้นพบเองโดยไม่ได้ลอกกัน ส่งมันออกไป", en: "The pentatonic — C D E G A C — is the one scale every civilisation on Earth found on its own. Send it.", zh: "五声音阶 —— C D E G A C —— 是地球上每个文明各自独立发现的唯一音阶。发出去。" },
      done: { th: "มันตอบกลับมาด้วยบันไดเสียงเดียวกัน", en: "It answers with the same scale.", zh: "它以同一音阶回应。" } },
    { id: "s3", kind: "slay", n: 14, stat: "stability", giver: { th: "สัญญาณ", en: "The Signal", zh: "信号" },
      title: { th: "เศษของผู้ที่มาก่อน", en: "Fragments Of Those Before", zh: "先行者的碎片" },
      brief: { th: "เศษเสียงสะท้อนคือสิ่งที่เหลือจากอารยธรรมที่มาถึงที่นี่แล้วตอบคำถามสุดท้ายไม่ได้", en: "The fragments are what is left of civilisations that reached this place and could not answer the last question.", zh: "这些碎片，是抵达此处却答不出最后问题的文明所剩之物。" },
      done: { th: "ทุกอันเคยเป็นใครสักคนที่มาไกลถึงตรงนี้", en: "Every one of them was somebody who got this far.", zh: "每一个，都曾是走到这一步的某个人。" } },
    { id: "s4", kind: "boss", stat: "control", giver: { th: "สัญญาณ", en: "The Signal", zh: "信号" },
      title: { th: "คำถามสุดท้าย", en: "The Last Question", zh: "最后的问题" },
      brief: { th: "ถ้าความรู้อัปโหลดได้ พลังสร้างได้ ความตายแก้ได้ — อะไรที่ยังทำให้มนุษย์เป็นมนุษย์ ตอบด้วยมือของเจ้า", en: "If knowledge uploads, power is built and death is solved — what is left that makes a person a person? Answer with your hands.", zh: "若知识可上传、力量可制造、死亡已被解决 —— 人之为人还剩什么？用你的双手回答。" },
      done: { th: "ความสามารถในการรู้สึก และควบคุมสิ่งที่เรารู้สึก นั่นคือคำตอบ และมันอัปโหลดไม่ได้", en: "The capacity to feel, and to govern what you feel. That is the answer, and it does not upload.", zh: "感受的能力，以及驾驭感受的能力。这就是答案 —— 而它无法上传。" } },
  ],
};

/* ══════════════════════ save ══════════════════════ */
const SAVE_KEY = "tg_starsong";
const blankSave = () => ({
  v: 1, world: "terra", x: 0, y: 0,
  stats: ESTATS.reduce((a, s) => { a[s.id] = 0; return a; }, {}),
  quests: {},          // questId -> {prog, done}
  bosses: {},          // bossId -> true
  seen: {},            // worldId -> true once its intro has played
  kills: 0, answers: 0, right: 0, played: 0,
});
export function readSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!raw || raw.v !== 1) return blankSave();
    return { ...blankSave(), ...raw, stats: { ...blankSave().stats, ...(raw.stats || {}) } };
  } catch (e) { return blankSave(); }
}
export function writeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
  try { window.dispatchEvent(new Event("tg-starsong")); } catch (e) {}
}
/** Total stat is the Academy's single rank number, and the only key to the
    next world — so the gate on a world is literally "have you practised". */
export const totalStat = (s) => ESTATS.reduce((a, st) => a + (s.stats[st.id] || 0), 0);

/* The chassis level rides on the same number rather than on a second
   currency: two progress bars that can disagree is how an RPG ends up
   rewarding grinding after all. */
export const chassisLevel = (s) => 1 + Math.floor(totalStat(s) / 18);
export const maxHp = (s) => 60 + chassisLevel(s) * 14 + (s.stats.stability || 0) * 2;

/* ══════════════════════ the world itself ══════════════════════

   Terrain is sampled, not stored: one fBm call per tile means a world the
   size of this one costs nothing to hold and — because the sampler is
   seeded off the world id — every player's copy is identical to the pixel.
   That is what makes standing next to someone mean anything. */
export const TILE = 56;
/* How close the camera sits. 1 is the raw world scale, which on a phone put
   the figure at about 45px tall and made the whole thing read as a map. */
export const ZOOM = 1.62;
export const WORLD_R = 1500;   // half-extent in world units; the map is a disc

function terrainAt(seed, wx, wy) {
  const n = fbm(seed, wx / 340, wy / 340);
  const edge = Math.hypot(wx, wy) / WORLD_R;
  const v = n - Math.max(0, edge - 0.72) * 1.6;   // the disc falls away at the rim
  if (v < 0.30) return 0;   // void / chasm — impassable
  if (v < 0.40) return 1;   // low ground
  if (v > 0.66) return 3;   // rock ridge — impassable
  return 2;                 // walkable ground
}
export const walkable = (seed, wx, wy) => { const t = terrainAt(seed, wx, wy); return t === 1 || t === 2; };

/** Landmarks: the town, the quest-givers standing in it, and the boss ring.
    Placed by walking outward from a seeded angle until the terrain is
    walkable, so a landmark never lands inside a cliff. */
export function buildWorld(w) {
  const seed = hash32(w.seed);
  const place = (ang, dist) => {
    for (let d = dist; d > 60; d -= 24) {
      const x = Math.cos(ang) * d, y = Math.sin(ang) * d;
      if (walkable(seed, x, y)) return { x, y };
    }
    return { x: 0, y: 0 };
  };
  const a0 = (seed % 628) / 100;
  const town = place(a0, 210);
  const qs = QUESTS[w.id] || [];
  const npcs = [];
  const seenGivers = [];
  for (const q of qs) {
    const key = tr3(q.giver, "en");
    let slot = seenGivers.indexOf(key);
    if (slot < 0) { seenGivers.push(key); slot = seenGivers.length - 1; }
    npcs[slot] = npcs[slot] || {
      key,
      name: q.giver,
      ...place(a0 + 0.9 + slot * 1.7, 250 + slot * 44),
      quests: [],
    };
    npcs[slot].quests.push(q.id);
  }
  const arena = place(a0 + Math.PI, 1080);
  /* Structures are world objects with a position, not decals: anything with
     height has to sort against the player by Y or it will draw over him when
     it is standing behind him. */
  const towers = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    towers.push({ x: town.x + Math.cos(a) * 86, y: town.y + Math.sin(a) * 86, h: 26 + (hash32("tw" + i + w.id) % 22) });
  }
  const pillars = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pillars.push({ x: arena.x + Math.cos(a) * 96, y: arena.y + Math.sin(a) * 96, i });
  }
  return { seed, town, npcs, arena, towers, pillars };
}

/** Monsters are spawned on a seeded lattice so two players in the same
    world see the same population, then wander locally from there. */
export function spawnMobs(w, geo, n = 34) {
  const out = [];
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const a = (hash32(w.seed + ":m" + i) % 62832) / 10000;
    const r = 300 + (hash32(w.seed + ":r" + i) % 1000);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (!walkable(geo.seed, x, y)) continue;
    if (Math.hypot(x - geo.town.x, y - geo.town.y) < 200) continue;   // town is safe ground
    out.push({ id: "m" + i, x, y, hx: x, hy: y, hp: 3, t: Math.random() * 6.28, dead: 0 });
  }
  return out;
}

/* ══════════════════════ drawing ══════════════════════

   Everything on screen is drawn procedurally: no sprite sheet to load, no
   asset to 404, and the palette comes from the world record so a new
   planet is a data entry rather than an art commission. */
/* Collision samples the terrain function directly, so the RENDER grid is
   free to be finer than the movement grid — and it has to be. Painting the
   colour field in 56px blocks turns every contour between ground types into
   a staircase of big rectangles; at 12px the same contours read as coastline
   and the grid disappears. Scatter stays on the coarse grid so props do not
   multiply with the resolution. */
const RTILE = 12;

function drawTerrain(g, W, geo, cam, vw, vh) {
  const x0 = Math.floor((cam.x - vw / 2) / RTILE) - 1, x1 = Math.ceil((cam.x + vw / 2) / RTILE) + 1;
  const y0 = Math.floor((cam.y - vh / 2) / RTILE) - 1, y1 = Math.ceil((cam.y + vh / 2) / RTILE) + 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const wx = tx * RTILE, wy = ty * RTILE;
      const t = terrainAt(geo.seed, wx + RTILE / 2, wy + RTILE / 2);
      if (t === 0) continue;                       // void reads as the sky behind
      const sx = wx - cam.x + vw / 2, sy = wy - cam.y + vh / 2;
      g.fillStyle = t === 3 ? W.rock : t === 1 ? W.grass : W.ground;
      g.fillRect(sx, sy, RTILE + 1, RTILE + 1);
      // grain: a continuous field, sampled wider than a cell, so neighbours
      // differ only slightly and no chequerboard appears
      const j = fbm(geo.seed ^ 0x51ed, tx * 0.13, ty * 0.13) - 0.5;
      g.fillStyle = j > 0 ? `rgba(255,255,255,${(j * 0.22).toFixed(3)})`
                          : `rgba(0,0,0,${(-j * 0.28).toFixed(3)})`;
      g.fillRect(sx, sy, RTILE + 1, RTILE + 1);
      if (t === 3 && terrainAt(geo.seed, wx + RTILE / 2, wy - RTILE / 2) !== 3) {
        g.fillStyle = "rgba(255,255,255,.1)";      // ridges catch the key on their top lip only
        g.fillRect(sx, sy, RTILE + 1, 3);
      }
    }
  }
  // ── scatter, on the coarse grid ──
  const cx0 = Math.floor((cam.x - vw / 2) / TILE) - 1, cx1 = Math.ceil((cam.x + vw / 2) / TILE) + 1;
  const cy0 = Math.floor((cam.y - vh / 2) / TILE) - 1, cy1 = Math.ceil((cam.y + vh / 2) / TILE) + 1;
  for (let ty = cy0; ty <= cy1; ty++) {
    for (let tx = cx0; tx <= cx1; tx++) {
      const r = (hash32(tx + ":" + ty + ":" + geo.seed) % 1000) / 1000;
      if (r > 0.115 && r < 0.968) continue;
      const wx = tx * TILE, wy = ty * TILE;
      if (terrainAt(geo.seed, wx + TILE / 2, wy + TILE / 2) !== 2) continue;
      const sx = wx - cam.x + vw / 2, sy = wy - cam.y + vh / 2;
      if (r < 0.115) {
        const ox = sx + ((hash32("a" + tx + ty) % 100) / 100) * TILE;
        const oy = sy + ((hash32("b" + tx + ty) % 100) / 100) * TILE;
        const rr = 3 + r * 55;
        g.fillStyle = "rgba(0,0,0,.28)";
        g.beginPath(); g.ellipse(ox, oy + rr * .5, rr * 1.15, rr * .5, 0, 0, 6.284); g.fill();
        g.fillStyle = W.rock;
        g.beginPath(); g.ellipse(ox, oy, rr, rr * .8, 0, 0, 6.284); g.fill();
        g.fillStyle = "rgba(255,255,255,.14)";
        g.beginPath(); g.ellipse(ox - rr * .25, oy - rr * .28, rr * .45, rr * .3, 0, 0, 6.284); g.fill();
      } else {
        // a lit shard, so the eye has somewhere to land on a long walk
        const ox = sx + TILE * .5, oy = sy + TILE * .5;
        g.fillStyle = W.glow + "3a";
        g.beginPath(); g.arc(ox, oy, 15, 0, 6.284); g.fill();
        g.fillStyle = W.glow;
        g.beginPath(); g.moveTo(ox, oy - 12); g.lineTo(ox + 5.5, oy); g.lineTo(ox, oy + 10); g.lineTo(ox - 5.5, oy); g.closePath(); g.fill();
        g.fillStyle = "rgba(255,255,255,.7)";
        g.beginPath(); g.moveTo(ox, oy - 12); g.lineTo(ox + 2, oy - 2); g.lineTo(ox, oy + 2); g.lineTo(ox - 2, oy - 2); g.closePath(); g.fill();
      }
    }
  }
}

/** One robot, drawn from primitives. `hue` is the chassis tint, `t` drives
    the walk cycle, `ghost` dims a remote player so you can always tell which
    one of the two of you is yours.

    Eight passes rather than three: a cast shadow that squashes as the figure
    bobs, plated limbs with their own joint discs, a lit core, a rim light
    down the left edge and a visor with a moving glint. The rim light is what
    separates it from the ground on a dark planet — a silhouette with no lit
    edge reads as a hole, however good the fill is. */
function drawBot(g, x, y, s, hue, t, ghost, glow) {
  const bob = Math.sin(t * 7) * 1.6 * s;
  const stride = Math.sin(t * 7) * 4 * s;
  const arm = Math.sin(t * 7 + Math.PI) * 3.4 * s;
  g.save();
  g.translate(x, y + bob);
  const A = ghost ? 0.45 : 1;

  // contact shadow: tightens as the figure rises, which is what sells the bob
  g.globalAlpha = A * 0.55 * (1 - Math.abs(bob) / (3 * s));
  g.fillStyle = "#00040c";
  g.beginPath(); g.ellipse(0, 15 * s - bob, 11 * s, 4.2 * s, 0, 0, 6.284); g.fill();
  g.globalAlpha = A;

  const dark = "#212b42", mid = "#3b4a68";
  const plate = (fx, fy, fw, fh, r) => { g.beginPath(); g.roundRect(fx, fy, fw, fh, r); g.fill(); };

  // legs, with a knee disc each
  g.fillStyle = dark;
  plate(-6.8 * s, 3 * s + stride * .3, 5.4 * s, 13 * s - stride * .3, 2 * s);
  plate(1.4 * s, 3 * s - stride * .3, 5.4 * s, 13 * s + stride * .3, 2 * s);
  g.fillStyle = mid;
  g.beginPath(); g.arc(-4.1 * s, 8 * s + stride * .15, 2.1 * s, 0, 6.284); g.fill();
  g.beginPath(); g.arc(4.1 * s, 8 * s - stride * .15, 2.1 * s, 0, 6.284); g.fill();

  // torso: a real gradient down the form, not a flat tint
  const grd = g.createLinearGradient(-9 * s, -9 * s, 8 * s, 8 * s);
  grd.addColorStop(0, "#f2f6ff"); grd.addColorStop(0.38, hue);
  grd.addColorStop(0.78, mid); grd.addColorStop(1, "#141c2e");
  g.fillStyle = grd;
  plate(-9 * s, -8 * s, 18 * s, 15 * s, 4 * s);
  // chest seam
  g.strokeStyle = "rgba(0,6,15,.4)"; g.lineWidth = 0.9 * s;
  g.beginPath(); g.moveTo(-6 * s, -3.5 * s); g.lineTo(6 * s, -3.5 * s); g.stroke();

  // arms swing opposite the legs, each on a shoulder disc
  g.fillStyle = mid;
  plate(-13.4 * s, -5 * s + arm * .3, 4.6 * s, 12 * s, 2 * s);
  plate(8.8 * s, -5 * s - arm * .3, 4.6 * s, 12 * s, 2 * s);
  g.fillStyle = "#4e5e80";
  g.beginPath(); g.arc(-11.1 * s, -5 * s + arm * .3, 2.5 * s, 0, 6.284); g.fill();
  g.beginPath(); g.arc(11.1 * s, -5 * s - arm * .3, 2.5 * s, 0, 6.284); g.fill();

  // the core, three passes: bloom, iris, hot centre
  g.globalAlpha = A * 0.55;
  g.fillStyle = glow;
  g.beginPath(); g.arc(0, -1 * s, 6.4 * s, 0, 6.284); g.fill();
  g.globalAlpha = A;
  g.fillStyle = glow;
  g.beginPath(); g.arc(0, -1 * s, 3.3 * s, 0, 6.284); g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(0, -1 * s, 1.5 * s, 0, 6.284); g.fill();

  // head, visor, and a glint that travels across it
  const hg = g.createLinearGradient(-6.5 * s, -20 * s, 5 * s, -8 * s);
  hg.addColorStop(0, "#f6f9ff"); hg.addColorStop(0.6, "#c3cfe6"); hg.addColorStop(1, "#6d7c99");
  g.fillStyle = hg;
  plate(-6.5 * s, -20 * s, 13 * s, 12 * s, 4 * s);
  g.fillStyle = "#0a1120";
  plate(-5.2 * s, -17.2 * s, 10.4 * s, 5 * s, 2 * s);
  g.fillStyle = glow;
  plate(-4.2 * s, -16.4 * s, 8.4 * s, 2.8 * s, 1.4 * s);
  g.globalAlpha = A * 0.8;
  g.fillStyle = "#ffffff";
  const gx = -4.2 * s + ((t * 40) % 12) * s;
  plate(gx, -16.4 * s, 1.6 * s, 2.8 * s, 0.8 * s);
  g.globalAlpha = A;

  /* rim light down the lit side — the pass that lifts the figure off a dark
     planet. Clipped to nothing, just drawn as thin strokes on the left edge. */
  g.strokeStyle = "rgba(226,238,255,.55)"; g.lineWidth = 1.1 * s;
  g.beginPath();
  g.moveTo(-9 * s, 5 * s); g.lineTo(-9 * s, -5 * s);
  g.moveTo(-6.5 * s, -9.5 * s); g.lineTo(-6.5 * s, -17 * s);
  g.stroke();
  g.restore();
}

/** Monsters: the same vocabulary, hostile silhouette — wider, lower, a single
    eye instead of a visor band, and a shell that cracks with light when hit. */
function drawMob(g, x, y, s, col, t, hurt) {
  const bob = Math.sin(t * 4) * 2.4 * s;
  const spin = t * 1.6;
  g.save();
  g.translate(x, y + bob);
  g.fillStyle = "rgba(0,4,12,.42)";
  g.beginPath(); g.ellipse(0, 14 * s - bob, 13 * s, 4.6 * s, 0, 0, 6.284); g.fill();

  // legs first, under the shell
  g.fillStyle = "#232b3e";
  g.beginPath(); g.roundRect(-7.5 * s, 8 * s, 4.4 * s, 8 * s, 1.6 * s); g.fill();
  g.beginPath(); g.roundRect(3.1 * s, 8 * s, 4.4 * s, 8 * s, 1.6 * s); g.fill();

  if (hurt) { g.shadowColor = "#ffffff"; g.shadowBlur = 22; }
  const grd = g.createLinearGradient(-12 * s, -14 * s, 10 * s, 12 * s);
  grd.addColorStop(0, hurt ? "#ffffff" : "#dbe4f4");
  grd.addColorStop(0.42, hurt ? "#ffd0d0" : col);
  grd.addColorStop(1, "#10162a");
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, -16 * s); g.lineTo(12 * s, -3 * s); g.lineTo(9 * s, 12 * s);
  g.lineTo(-9 * s, 12 * s); g.lineTo(-12 * s, -3 * s); g.closePath(); g.fill();
  g.shadowBlur = 0;

  // plate seams across the shell
  g.strokeStyle = "rgba(0,6,15,.34)"; g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(-10.6 * s, 1 * s); g.lineTo(10.6 * s, 1 * s);
  g.moveTo(-9.7 * s, 6.5 * s); g.lineTo(9.7 * s, 6.5 * s);
  g.stroke();

  // a lit ring that turns, so a standing monster is never a static shape
  g.save();
  g.translate(0, -2 * s); g.rotate(spin);
  g.strokeStyle = hurt ? "#ffffff" : "#ff6a6a"; g.lineWidth = 1.2 * s;
  g.globalAlpha = 0.6;
  g.beginPath(); g.arc(0, 0, 7.4 * s, 0.4, 2.2); g.stroke();
  g.beginPath(); g.arc(0, 0, 7.4 * s, 3.6, 5.4); g.stroke();
  g.restore();
  g.globalAlpha = 1;

  // the eye: socket, bloom, iris, catchlight
  g.fillStyle = "#080d1a";
  g.beginPath(); g.arc(0, -2 * s, 5.2 * s, 0, 6.284); g.fill();
  g.globalAlpha = 0.6;
  g.fillStyle = hurt ? "#ffffff" : "#ff5a5a";
  g.beginPath(); g.arc(0, -2 * s, 4.4 * s, 0, 6.284); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = hurt ? "#ffffff" : "#ff8a8a";
  g.beginPath(); g.arc(0, -2 * s, 2.5 * s, 0, 6.284); g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(-0.9 * s, -3 * s, 0.9 * s, 0, 6.284); g.fill();

  g.strokeStyle = "rgba(226,238,255,.42)"; g.lineWidth = 1 * s;
  g.beginPath(); g.moveTo(-12 * s, -3 * s); g.lineTo(0, -16 * s); g.stroke();
  g.restore();
}

/* ══════════════════════ combat ══════════════════════

   A fight is a conversation in music theory held at speed. The monster
   attacks on a timer whatever you do, so hesitating costs you exactly as
   much as being wrong — which is the difference between knowing a scale
   and being able to use one.

   Two wrong answers in a row, or dropping under a third of your hull,
   trips the Emotion Core and the fight stops dead for CONTROL MODE: play
   a short phrase cleanly and you come back buffed. That is the lore's own
   claim made mechanical — you cannot fight your way out of losing your
   composure, you have to play your way out. */
const KEYS_WHITE = ["C", "D", "E", "F", "G", "A", "B"];
/* The stabilisation phrase gets LONGER every time you lose composure in the
   same fight, and only the first stabilisation pays stat. Without that, the
   cheapest route to a high Control score would be to deliberately answer two
   questions wrong and then play five easy notes — which would quietly break
   the one promise the whole game is built on. */
const CONTROL_PHRASES = [
  ["C", "D", "E", "F", "G"],
  ["C", "D", "E", "F", "G", "A", "B"],
  ["C", "E", "G", "B", "A", "F", "D", "C"],
  ["C", "D", "E", "F", "G", "A", "B", "A", "G", "F", "E", "D", "C"],
];
const controlPhrase = (n) => CONTROL_PHRASES[Math.min(n, CONTROL_PHRASES.length - 1)];

/** Damage scales off the stats the player actually earned, so a well
    practised character genuinely hits harder — but never so much that a
    fresh one cannot win by answering well. */
function playerHit(save, streak) {
  const base = 6 + chassisLevel(save) * 1.1;
  const focus = (save.stats.focus || 0) * 0.14;
  const courage = (save.stats.courage || 0) * 0.1;
  return Math.round((base + focus + courage) * (1 + Math.min(streak, 5) * 0.14));
}
function mobHit(save, boss) {
  const raw = boss ? 13 : 8;
  const guard = (save.stats.stability || 0) * 0.06 + (save.stats.control || 0) * 0.05;
  return Math.max(3, Math.round(raw - guard));
}

/* ══════════════════════ multiplayer ══════════════════════

   Presence only, over a Realtime channel named for the world — no table,
   no migration, nothing to run before it works. Each client publishes
   where it is standing a few times a second and reads back everyone else;
   boss damage is broadcast on the same channel so a world boss really is
   being fought by the whole room. If Realtime is unavailable the hook
   simply reports nobody and the game plays exactly as it did before. */
function useCoop(worldId, meName, enabled) {
  const [peers, setPeers] = useState([]);          // [{key,name,x,y,t,lv}]
  const chanRef = useRef(null);
  const meRef = useRef({ x: 0, y: 0, t: 0, lv: 1 });
  const onBossRef = useRef(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!enabled) { setPeers([]); setOnline(false); return; }
    let dead = false, tick = null;
    let ch;
    try {
      ch = sb.channel("starsong:" + worldId, { config: { presence: { key: Math.random().toString(36).slice(2) } } });
    } catch (e) { return; }
    chanRef.current = ch;
    const sync = () => {
      if (dead) return;
      const st = ch.presenceState();
      const list = [];
      for (const k of Object.keys(st)) for (const p of st[k]) list.push({ key: k, ...p });
      setPeers(list);
    };
    ch.on("presence", { event: "sync" }, sync)
      .on("broadcast", { event: "bosshit" }, ({ payload }) => { if (onBossRef.current) onBossRef.current(payload); })
      .subscribe((status) => {
        if (dead) return;
        if (status !== "SUBSCRIBED") return;
        setOnline(true);
        ch.track({ name: meName, ...meRef.current });
        tick = setInterval(() => { try { ch.track({ name: meName, ...meRef.current }); } catch (e) {} }, 600);
      });
    return () => {
      dead = true;
      if (tick) clearInterval(tick);
      try { sb.removeChannel(ch); } catch (e) {}
      chanRef.current = null;
      setOnline(false); setPeers([]);
    };
  }, [worldId, meName, enabled]);

  const report = useCallback((x, y, t, lv) => { meRef.current = { x: Math.round(x), y: Math.round(y), t, lv }; }, []);
  const shout = useCallback((payload) => {
    const ch = chanRef.current; if (!ch) return;
    try { ch.send({ type: "broadcast", event: "bosshit", payload }); } catch (e) {}
  }, []);
  return { peers, online, report, shout, onBoss: onBossRef };
}

/* ══════════════════════ the player's own chassis ══════════════════════

   The figure walking around this world has to be the model the player chose
   and looks at on their profile — a different robot in the game would make
   the profile's chassis a decoration rather than a character.

   The model is an SVG component, so it is rasterised once into an <img> and
   blitted every frame after that. Serialising a live DOM node (rather than
   building the markup by hand) means the sprite is by construction whatever
   the profile is showing, including any future change to the models. */
function useChassisSprite(model, glow, accent) {
  const holdRef = useRef(null);
  const [img, setImg] = useState(null);

  useEffect(() => {
    setImg(null);
    const host = holdRef.current;
    if (!host) return;
    let dead = false, url = null;
    // one frame, so React has painted the SVG we are about to read
    const t = window.setTimeout(() => {
      try {
        const svg = host.querySelector("svg");
        if (!svg) return;
        const clone = svg.cloneNode(true);
        // an <img> will not lay out a percentage-sized SVG, so pin it
        clone.setAttribute("width", "320");
        clone.setAttribute("height", "832");
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const src = new XMLSerializer().serializeToString(clone);
        url = URL.createObjectURL(new Blob([src], { type: "image/svg+xml;charset=utf-8" }));
        const im = new Image();
        im.onload = () => { if (!dead) setImg(im); };
        im.onerror = () => {};
        im.src = url;
      } catch (e) {}
    }, 60);
    return () => {
      dead = true; window.clearTimeout(t);
      if (url) try { URL.revokeObjectURL(url); } catch (e) {}
    };
  }, [model, glow, accent]);

  /* The off-screen host stays mounted: it is what gets serialised, and it is
     one hidden SVG rather than a per-frame cost. */
  const host = (
    <div ref={holdRef} aria-hidden="true"
      style={{ position: "absolute", width: 160, height: 416, left: -9999, top: 0, opacity: 0, pointerEvents: "none" }}>
      <CyberAvatar model={model} yaw={0} glow={glow} accent={accent} armorA="#161d2c" armorB="#3d5878" />
    </div>
  );
  return { img, host };
}

/** Blit the rasterised chassis with a walk cycle faked on top: a bob, a
    squash that follows it, and a flip so the figure faces where it is going.
    Falls back to nothing while the sprite is still rasterising — the caller
    draws the primitive bot in that gap so the player is never invisible. */
function drawChassis(g, img, x, y, h, t, dir, ghost) {
  const w = h * (160 / 416);
  const bob = Math.sin(t * 7) * 2.2;
  const sq = 1 + Math.sin(t * 7) * 0.03;
  g.save();
  g.globalAlpha = ghost ? 0.5 : 1;
  g.fillStyle = "rgba(0,4,12,.42)";
  g.beginPath(); g.ellipse(x, y, w * 0.34, w * 0.13, 0, 0, 6.284); g.fill();
  g.translate(x, y + bob);
  if (dir < 0) g.scale(-1, 1);
  g.drawImage(img, -w / 2, -h * sq, w, h * sq);
  g.restore();
}

/* One octave of white keys. Deliberately not a full piano: these phrases
   are about producing a shape cleanly under pressure, and a keyboard you
   have to hunt across is testing your eyes rather than your hands. */
const MiniKeys = memo(function MiniKeys({ onKey, lit, wrong }) {
  return (
    <div className="ss-keys">
      {KEYS_WHITE.map(k => (
        <button key={k} className={`ss-key${lit === k ? " lit" : ""}${wrong === k ? " bad" : ""}`}
          onPointerDown={(e) => { e.preventDefault(); onKey(k); }}>{k}</button>
      ))}
    </div>
  );
});

export const StarsongPage = memo(function StarsongPage({ lang, onBack, onReward = () => {}, playUi = () => {}, playerName = "TIGA-01", charModel = "vanguard" }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [save, setSave] = useState(readSave);
  const saveRef = useRef(save);
  const commit = useCallback((next) => { saveRef.current = next; setSave(next); writeSave(next); }, []);

  const W = worldById(save.world);
  const geo = useMemo(() => buildWorld(W), [W.id]);
  const total = totalStat(save);

  const [hp, setHp] = useState(() => maxHp(save));
  const [screen, setScreen] = useState(() => (save.seen[W.id] ? "world" : "intro"));  // intro|world|map|sheet
  const [fight, setFight] = useState(null);   // {kind:"mob"|"boss", hp, max, q, streak, wrongRun, name, col, mobId}
  const [ctrl, setCtrl] = useState(null);     // {step, bad} — Emotion Core stabilisation
  const [talk, setTalk] = useState(null);     // {npc, quest, phase:"brief"|"done"}
  const [task, setTask] = useState(null);     // {quest, step, bad} — a `play` quest
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);        // forces a HUD repaint; the canvas has its own loop

  const cvRef = useRef(null);
  const meRef = useRef({ x: geo.town.x, y: geo.town.y + 60, t: 0, dir: 0 });
  const padRef = useRef({ ax: 0, ay: 0, on: false, ox: 0, oy: 0 });
  const keysRef = useRef({});
  const mobsRef = useRef([]);
  const camRef = useRef({ x: 0, y: 0 });
  const fightRef = useRef(null);
  const hitFlashRef = useRef(0);
  const popsRef = useRef([]);          // floating damage numbers
  /** Push a number over a world position. Purely feedback — it reads nothing
      and changes nothing, which is exactly what it should be. */
  const pop = useCallback((x, y, txt, c, big) => {
    popsRef.current.push({ x, y, txt, c, big, life: big ? 1.1 : 0.85, max: big ? 1.1 : 0.85 });
    if (popsRef.current.length > 24) popsRef.current.shift();
  }, []);

  const coop = useCoop(W.id, playerName, screen === "world");
  const { img: chassis, host: chassisHost } = useChassisSprite(charModel, W.glow, W.accent);

  /* Landscape is the point of turning the phone: the world goes edge to edge,
     the app chrome above it gets out of the way, and the two thumbs end up
     where they already are. */
  const [land, setLand] = useState(() => {
    try { return window.innerWidth > window.innerHeight * 1.25; } catch (e) { return false; }
  });
  useEffect(() => {
    const on = () => { try { setLand(window.innerWidth > window.innerHeight * 1.25); } catch (e) {} };
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);

  /* ── the score ──
     Each world plays its own arena track. It only starts on a real gesture
     (browsers will not let it start otherwise) and it shifts up a gear the
     moment a fight opens, which is most of what makes combat feel different
     from walking. */
  const [music, setMusic] = useState(() => { try { return localStorage.getItem("tg_ss_music") !== "0"; } catch (e) { return true; } });
  const audioRef = useRef(null);
  useEffect(() => {
    if (!music || screen !== "world") {
      if (audioRef.current) { try { audioRef.current.stop(); } catch (e) {} audioRef.current = null; }
      return;
    }
    const a = createArenaAudio(stageById(W.track));
    audioRef.current = a;
    try { a.start(); } catch (e) {}
    return () => { try { a.stop(); } catch (e) {} audioRef.current = null; };
  }, [music, screen, W.track]);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    try { a.setGear(fight ? 1 : 0); } catch (e) {}
  }, [fight]);

  // ── world (re)entry ─────────────────────────────────────────────────
  useEffect(() => {
    mobsRef.current = spawnMobs(W, geo);
    meRef.current = { x: geo.town.x, y: geo.town.y + 60, t: 0, dir: 0 };
    camRef.current = { x: geo.town.x, y: geo.town.y + 60 };
    setHp(maxHp(saveRef.current));
    setFight(null); setCtrl(null); setTalk(null); setTask(null);
  }, [W.id, geo]);

  useEffect(() => { fightRef.current = fight; }, [fight]);

  /* ── the world boss is genuinely shared ──
     Damage was already being broadcast, but nothing on the receiving end
     applied it — so "everyone is fighting the same boss" was a claim the
     code did not actually make true. Anyone in the ring now sees the bar
     move when someone else lands a hit, and whoever takes it to zero ends
     the fight for themselves; the rest see it drop and get the kill too. */
  useEffect(() => {
    coop.onBoss.current = ({ id, dmg, by }) => {
      if (by === playerName) return;                 // our own shout, echoed back
      const f = fightRef.current;
      if (!f || f.kind !== "boss" || id !== W.boss.id) return;
      const nhp = Math.max(0, f.hp - (Number(dmg) || 0));
      pop(geo.arena.x + (Math.random() * 40 - 20), geo.arena.y - 26, "-" + Math.round(dmg), "#8fd0ff", false);
      if (nhp <= 0) { winFight(f); return; }
      setFight({ ...f, hp: nhp, allies: (f.allies || 0) + 1 });
    };
    return () => { coop.onBoss.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coop.onBoss, W.boss.id, playerName, geo]);

  const say = useCallback((text, ms = 2200) => {
    setToast(text);
    window.clearTimeout(say._t); say._t = window.setTimeout(() => setToast(null), ms);
  }, []);

  /* Stat is the only currency and it is minted here, in one place, so the
     promise that nothing but music raises it stays checkable. */
  const award = useCallback((statId, n, label) => {
    const s = saveRef.current;
    const next = { ...s, stats: { ...s.stats, [statId]: (s.stats[statId] || 0) + n } };
    commit(next);
    const st = statById(statId);
    say(`${st.ic} ${tr3(st, lang)} +${n}${label ? " · " + label : ""}`);
  }, [commit, lang, say]);

  const questState = useCallback((qid) => saveRef.current.quests[qid] || { prog: 0, done: false }, []);
  const bumpQuest = useCallback((qid, by = 1) => {
    const s = saveRef.current;
    const cur = s.quests[qid] || { prog: 0, done: false };
    const q = (QUESTS[s.world] || []).find(x => x.id === qid);
    if (!q || cur.done) return false;
    const need = q.n || 1;
    const prog = Math.min(need, cur.prog + by);
    const done = prog >= need;
    commit({ ...s, quests: { ...s.quests, [qid]: { prog, done } } });
    return done;
  }, [commit]);

  /** The quest the player is actually on, world-wide — first unfinished in
      order, so the tracker never asks for two things at once. */
  const activeQuest = useMemo(() => {
    const qs = QUESTS[save.world] || [];
    return qs.find(q => !(save.quests[q.id] || {}).done) || null;
  }, [save]);

  // ── the loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "world") return;
    const cv = cvRef.current; if (!cv) return;
    const g = cv.getContext("2d");
    let raf = 0, last = performance.now(), hudT = 0;

    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = cv.clientWidth, chh = cv.clientHeight;
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(chh * dpr)) {
        cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr);
      }
      /* Camera zoom. Scaling the context rather than every draw call means
         terrain, entities, lights and decals all zoom together and stay in
         register; drawn at 1:1 the figure was a speck on a phone and the
         world read as a map rather than a place you are standing in. */
      g.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, 0, 0);
      const vw = cv.clientWidth / ZOOM, vh = cv.clientHeight / ZOOM;

      const busy = !!(fightRef.current || ctrl || talk || task);
      const me = meRef.current;

      // input → velocity
      let ax = padRef.current.ax, ay = padRef.current.ay;
      const K = keysRef.current;
      if (K.ArrowLeft || K.a) ax -= 1; if (K.ArrowRight || K.d) ax += 1;
      if (K.ArrowUp || K.w) ay -= 1; if (K.ArrowDown || K.s) ay += 1;
      const mag = Math.hypot(ax, ay);
      if (mag > 1) { ax /= mag; ay /= mag; }
      if (!busy && (ax || ay)) {
        const sp = 168 * dt;
        const nx = me.x + ax * sp, ny = me.y + ay * sp;
        if (walkable(geo.seed, nx, me.y)) me.x = nx;      // slide along walls rather than sticking
        if (walkable(geo.seed, me.x, ny)) me.y = ny;
        me.t += dt; me.dir = ax;
      }
      camRef.current.x += (me.x - camRef.current.x) * Math.min(1, dt * 7);
      camRef.current.y += (me.y - camRef.current.y) * Math.min(1, dt * 7);
      const cam = camRef.current;

      // mobs wander near their anchor, and charge once you are close
      if (!busy) {
        for (const m of mobsRef.current) {
          if (m.dead) { m.dead -= dt; if (m.dead <= 0) { m.dead = 0; m.hp = 3; } continue; }
          const d = Math.hypot(m.x - me.x, m.y - me.y);
          if (d < 230) {
            const k = 52 * dt / (d || 1);
            const nx = m.x + (me.x - m.x) * k, ny = m.y + (me.y - m.y) * k;
            if (walkable(geo.seed, nx, ny)) { m.x = nx; m.y = ny; }
          } else {
            m.t += dt * 0.7;
            const nx = m.hx + Math.cos(m.t) * 46, ny = m.hy + Math.sin(m.t * 1.3) * 46;
            if (walkable(geo.seed, nx, ny)) { m.x = nx; m.y = ny; }
          }
          if (d < 26 && !fightRef.current) startFight(m);
        }
      }

      /* ── paint ──────────────────────────────────────────────────────
         Layered like a real frame rather than drawn in whatever order the
         entities happen to sit in an array:

           sky + parallax  →  terrain  →  ground decals  →  entities SORTED
           BY DEPTH  →  additive light pass  →  fog + vignette  →  motes

         The depth sort is the one that stops it looking like a flash game:
         without it a monster standing in front of you renders behind you,
         and no amount of shading fixes that. The light pass is additive, so
         it can only ever brighten — which is why it reads as light rather
         than as a coloured film laid over the picture. */
      const tsec = now / 1000;
      /* Text lives in the zoomed space too, so a 11px label would render at
         11 × ZOOM. Everything measured in screen pixels — type, hairlines,
         the compass arrow — divides back out. */
      const px = (n) => (n / ZOOM);
      const fs = (n) => px(n).toFixed(1);
      const sky = g.createLinearGradient(0, 0, 0, vh);
      sky.addColorStop(0, W.sky[0]); sky.addColorStop(0.5, W.sky[1]); sky.addColorStop(1, W.sky[2]);
      g.fillStyle = sky; g.fillRect(0, 0, vw, vh);

      // parallax starfield: drifts at a fraction of the camera, which is what
      // makes the void beyond the map read as distance rather than as a hole
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 90; i++) {
        const h1 = hash32("st" + i + W.id);
        const rx = ((h1 % 2000) - cam.x * 0.12) % (vw + 40);
        const ry = (((h1 >> 11) % 2000) - cam.y * 0.12) % (vh + 40);
        const sxp = rx < 0 ? rx + vw + 40 : rx, syp = ry < 0 ? ry + vh + 40 : ry;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(tsec * 0.7 + i));
        g.fillStyle = `rgba(255,255,255,${(0.05 + (i % 5) * 0.03) * tw})`;
        const ss = px((i % 7 === 0) ? 2.2 : 1.3); g.fillRect(sxp - 20, syp - 20, ss, ss);
      }
      g.globalCompositeOperation = "source-over";

      drawTerrain(g, W, geo, cam, vw, vh);
      const sxOf = (wx) => wx - cam.x + vw / 2, syOf = (wy) => wy - cam.y + vh / 2;

      /* ── ground decals: only what is genuinely flat on the floor ──
         The towers and monoliths that used to live here now sort with the
         entities, because anything with height has to. */
      const townS = { x: sxOf(geo.town.x), y: syOf(geo.town.y) };
      g.fillStyle = W.accent + "10";
      g.beginPath(); g.arc(townS.x, townS.y, 108, 0, 6.284); g.fill();
      g.strokeStyle = W.accent + "4a"; g.lineWidth = px(2);
      g.beginPath(); g.arc(townS.x, townS.y, 108, 0, 6.284); g.stroke();
      g.strokeStyle = W.accent + "33"; g.lineWidth = px(1.4);
      for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(townS.x, townS.y, i * 22, 0, 6.284); g.stroke(); }

      const bossDone = !!saveRef.current.bosses[W.boss.id];
      const arenaS = { x: sxOf(geo.arena.x), y: syOf(geo.arena.y) };
      g.strokeStyle = bossDone ? "#7fe0a0aa" : "#ff5a5aaa"; g.lineWidth = px(4);
      g.setLineDash([px(12), px(9)]); g.lineDashOffset = -tsec * 22;   // a live ring reads as a threshold
      g.beginPath(); g.arc(arenaS.x, arenaS.y, 96, 0, 6.284); g.stroke();
      g.setLineDash([]); g.lineDashOffset = 0;
      g.fillStyle = bossDone ? "#7fe0a018" : "#ff5a5a1c";
      g.beginPath(); g.arc(arenaS.x, arenaS.y, 96, 0, 6.284); g.fill();
      g.font = `700 ${fs(13)}px Rajdhani, sans-serif`; g.textAlign = "center";
      g.fillStyle = bossDone ? "#a8f0c0" : "#ffb0b0";
      g.fillText((bossDone ? "✓ " : "☠ ") + tr3(W.boss.name, lang), arenaS.x, arenaS.y - 106);

      /* ── entities, back to front ──
         One list, sorted on world Y, so everything overlaps the way the
         ground says it should. */
      const ents = [];
      for (const n of geo.npcs) if (n) ents.push({ y: n.y, k: "npc", o: n });
      for (const pr of coop.peers) ents.push({ y: pr.y || 0, k: "peer", o: pr });
      for (const m of mobsRef.current) if (!m.dead) ents.push({ y: m.y, k: "mob", o: m });
      for (const tw of geo.towers) ents.push({ y: tw.y, k: "tower", o: tw });
      for (const pl of geo.pillars) ents.push({ y: pl.y, k: "pillar", o: pl });
      ents.push({ y: me.y, k: "me", o: me });
      ents.sort((a, b) => a.y - b.y);

      /* ── ground light, BEFORE the figures ──
         A lamp lights the floor around it; it does not wash itself out. Burning
         the additive pass in after the entities did exactly that — the player's
         own core bloom was the brightest thing on its own chassis and you could
         not read the model at all. Lighting the ground first and leaving only
         the small emissive parts on the figures themselves is both the correct
         order and the one that looks like light. */
      g.globalCompositeOperation = "lighter";
      for (const e of ents) {
        const ex = sxOf(e.o.x), ey = syOf(e.o.y);
        if (ex < -160 || ex > vw + 160 || ey < -160 || ey > vh + 160) continue;
        const [lr, rgb, a] =
          e.k === "me"     ? [138, hexRgb(W.glow), 0.30] :
          e.k === "npc"    ? [58, "255,215,122", 0.20] :
          e.k === "mob"    ? [40, "255,90,90", 0.18] :
          e.k === "tower"  ? [54, hexRgb(W.glow), 0.14] :
          e.k === "pillar" ? [40, bossDone ? "127,224,160" : "255,106,106", 0.14] :
                             [50, hexRgb(W.glow), 0.12];
        const rg = g.createRadialGradient(ex, ey + 6, 0, ex, ey + 6, lr);
        rg.addColorStop(0, `rgba(${rgb},${a})`);
        rg.addColorStop(0.5, `rgba(${rgb},${a * 0.3})`);
        rg.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = rg;
        g.fillRect(ex - lr, ey + 6 - lr, lr * 2, lr * 2);
      }
      g.globalCompositeOperation = "source-over";

      for (const e of ents) {
        const ex = sxOf(e.o.x), ey = syOf(e.o.y);
        if (ex < -70 || ex > vw + 70 || ey < -90 || ey > vh + 90) continue;
        if (e.k === "npc") {
          drawBot(g, ex, ey, 1.05, "#c9d6ee", 0, false, "#ffd77a");
          const hasWork = e.o.quests.some(qid => !(saveRef.current.quests[qid] || {}).done);
          if (hasWork) {
            g.fillStyle = "#ffd24d"; g.font = `900 ${fs(20)}px Rajdhani, sans-serif`; g.textAlign = "center";
            g.fillText("!", ex, ey - 30 + Math.sin(tsec * 4) * 3);
          }
          g.fillStyle = "#e8eefc"; g.font = `600 ${fs(11)}px Rajdhani, sans-serif`; g.textAlign = "center";
          g.fillText(tr3(e.o.name, lang), ex, ey + 30);
        } else if (e.k === "peer") {
          if (chassis) drawChassis(g, chassis, ex, ey + 16, 68, e.o.t || 0, 1, true);
          else drawBot(g, ex, ey, 1, "#9fb6de", (e.o.t || 0), true, W.glow);
          g.fillStyle = "#cddaf2cc"; g.font = `600 ${fs(10.5)}px Rajdhani, sans-serif`; g.textAlign = "center";
          g.fillText(String(e.o.name || "?").slice(0, 14), ex, ey + 30);
        } else if (e.k === "mob") {
          const hurt = e.o.flash && now - e.o.flash < 140;
          drawMob(g, ex, ey, 1, W.accent, e.o.t + tsec, hurt);
        } else if (e.k === "tower") {
          const h = e.o.h;
          g.fillStyle = "rgba(0,4,12,.4)";
          g.beginPath(); g.ellipse(ex, ey + 3, 13, 5, 0, 0, 6.284); g.fill();
          const tg = g.createLinearGradient(ex - 11, ey - h, ex + 11, ey);
          tg.addColorStop(0, "#e6edfa"); tg.addColorStop(0.4, "#71809f"); tg.addColorStop(1, "#1b2438");
          g.fillStyle = tg;
          g.beginPath(); g.roundRect(ex - 11, ey - h, 22, h, 3); g.fill();
          g.fillStyle = W.glow + "55";
          g.fillRect(ex - 7, ey - h * 0.7, 14, 3);
          g.fillRect(ex - 7, ey - h * 0.4, 14, 3);
          g.fillStyle = W.glow;
          g.beginPath(); g.arc(ex, ey - h - 3, 2.6, 0, 6.284); g.fill();
        } else if (e.k === "pillar") {
          g.fillStyle = "rgba(0,4,12,.42)";
          g.beginPath(); g.ellipse(ex, ey + 2, 9, 4, 0, 0, 6.284); g.fill();
          const mg = g.createLinearGradient(ex - 7, ey - 34, ex + 7, ey);
          mg.addColorStop(0, bossDone ? "#cfeedd" : "#f0d6d6");
          mg.addColorStop(0.5, bossDone ? "#5d8f75" : "#8f5d5d");
          mg.addColorStop(1, "#191f2e");
          g.fillStyle = mg;
          g.beginPath(); g.moveTo(ex - 7, ey); g.lineTo(ex - 5, ey - 34); g.lineTo(ex + 5, ey - 34); g.lineTo(ex + 7, ey); g.closePath(); g.fill();
          g.fillStyle = bossDone ? "#7fe0a0" : "#ff6a6a";
          g.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(tsec * 1.6 + e.o.i * 0.7));
          g.beginPath(); g.arc(ex, ey - 30, 2.4, 0, 6.284); g.fill();
          g.globalAlpha = 1;
        } else {
          if (chassis) drawChassis(g, chassis, ex, ey + 16, 74, me.t, me.dir, false);
          else drawBot(g, ex, ey, 1.15, W.accent, me.t, false, W.glow);
        }
      }

      /* ── atmosphere ──
         A vignette and a low fog. Both are cheap and both do the same job:
         they push the edges of the frame back so the middle reads as near. */
      const vg = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(4,7,16,.55)");
      g.fillStyle = vg; g.fillRect(0, 0, vw, vh);

      // drifting motes, lit by the world's own glow
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 26; i++) {
        const h1 = hash32("mo" + i + W.id);
        const sp = 6 + (h1 % 14);
        const mx = ((h1 % 1600) - cam.x * 0.55 + tsec * sp) % (vw + 60);
        const my = (((h1 >> 9) % 1600) - cam.y * 0.55 + Math.sin(tsec * 0.5 + i) * 26) % (vh + 60);
        const fx = mx < 0 ? mx + vw + 60 : mx, fy = my < 0 ? my + vh + 60 : my;
        g.fillStyle = W.glow + "22";
        g.beginPath(); g.arc(fx - 30, fy - 30, px(1.6 + (i % 3)), 0, 6.284); g.fill();
      }
      g.globalCompositeOperation = "source-over";

      // damage flash
      if (hitFlashRef.current > 0) {
        hitFlashRef.current -= dt * 2.6;
        g.fillStyle = `rgba(255,60,60,${Math.max(0, hitFlashRef.current) * 0.34})`;
        g.fillRect(0, 0, vw, vh);
      }

      // floating damage numbers — the cheapest possible read on "that landed"
      for (let i = popsRef.current.length - 1; i >= 0; i--) {
        const q = popsRef.current[i];
        q.life -= dt;
        if (q.life <= 0) { popsRef.current.splice(i, 1); continue; }
        const k = 1 - q.life / q.max;
        g.globalAlpha = Math.min(1, q.life * 2.2);
        g.font = `900 ${fs(q.big ? 22 : 17)}px Orbitron, sans-serif`; g.textAlign = "center";
        g.fillStyle = "#00060f";
        g.fillText(q.txt, sxOf(q.x) + 1, syOf(q.y) - k * 42 + 1);
        g.fillStyle = q.c;
        g.fillText(q.txt, sxOf(q.x), syOf(q.y) - k * 42);
        g.globalAlpha = 1;
      }

      // the compass edge marker: without it a big empty map is just lost
      const target = activeQuestTarget();
      if (target) {
        const dx = target.x - me.x, dy = target.y - me.y, dd = Math.hypot(dx, dy);
        if (dd > 260) {
          const a = Math.atan2(dy, dx), rr = Math.min(vw, vh) * 0.36;
          const ax0 = vw / 2 + Math.cos(a) * rr, ay0 = vh / 2 + Math.sin(a) * rr;
          g.save(); g.translate(ax0, ay0); g.rotate(a);
          g.shadowColor = target.c; g.shadowBlur = 12;
          g.fillStyle = target.c;
          g.beginPath(); g.moveTo(px(13), 0); g.lineTo(px(-8), px(8)); g.lineTo(px(-8), px(-8)); g.closePath(); g.fill();
          g.restore();
          g.shadowBlur = 0;
          g.fillStyle = target.c; g.font = `700 ${fs(10)}px 'Share Tech Mono', monospace`; g.textAlign = "center";
          g.fillText(Math.round(dd) + "m", ax0, ay0 + px(22));
        }
      }
      coop.report(me.x, me.y, me.t, chassisLevel(saveRef.current));
      hudT += dt;
      if (hudT > 0.25) { hudT = 0; setTick(t => (t + 1) % 1000000); }
    };

    /** Where the tracker is pointing: the giver who has work, or the boss
        ring once the giver has nothing left to say. */
    function activeQuestTarget() {
      const s = saveRef.current;
      const qs = QUESTS[s.world] || [];
      const q = qs.find(x => !(s.quests[x.id] || {}).done);
      if (!q) return null;
      if (q.kind === "boss") return { x: geo.arena.x, y: geo.arena.y, c: "#ff8a8a" };
      const st = s.quests[q.id];
      if (!st || st.prog < (q.n || 1)) {
        if (q.kind === "slay") return null;                       // monsters are everywhere; no arrow needed
        const n = geo.npcs.find(nn => nn && nn.quests.includes(q.id));
        if (n) return { x: n.x, y: n.y, c: "#ffd24d" };
      }
      const n = geo.npcs.find(nn => nn && nn.quests.includes(q.id));
      return n ? { x: n.x, y: n.y, c: "#ffd24d" } : null;
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, W.id, geo, coop.peers, ctrl, talk, task, lang, chassis]);

  // keyboard
  useEffect(() => {
    const dn = (e) => { keysRef.current[e.key] = true; keysRef.current[e.key.toLowerCase()] = true; };
    const up = (e) => { keysRef.current[e.key] = false; keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  // ── fights ──────────────────────────────────────────────────────────
  function startFight(mob) {
    playUi("click");
    setFight({
      kind: "mob", mobId: mob.id, hp: mob.hp * 22, max: mob.hp * 22,
      q: makeQuestion(lang), streak: 0, wrongRun: 0,
      name: tr3(W.mob, lang), col: W.accent,
    });
  }
  function startBoss() {
    const b = W.boss;
    playUi("click");
    setFight({
      kind: "boss", hp: b.hp, max: b.hp,
      q: makeQuestion(lang), streak: 0, wrongRun: 0,
      name: tr3(b.name, lang), col: "#ff6a6a", line: tr3(b.line, lang),
    });
  }

  /* One answer, one exchange. Right: you strike and your streak carries a
     multiplier. Wrong: it strikes, and two in a row trips the core. */
  function answer(opt) {
    const f = fightRef.current; if (!f || f.over) return;
    const right = opt === f.q.ans;
    const s = saveRef.current;
    commit({ ...s, answers: s.answers + 1, right: s.right + (right ? 1 : 0) });

    if (right) {
      const crit = f.streak >= 3;
      playBoom(crit); haptic(crit ? 22 : 10);
      const dmg = playerHit(saveRef.current, f.streak) * (f.kind === "boss" ? 1 : 1.4);
      const nhp = Math.max(0, f.hp - dmg);
      // the number lands on the thing that was hit, out in the world
      const m = mobsRef.current.find(x => x.id === f.mobId);
      const tx = f.kind === "boss" ? geo.arena.x : (m ? m.x : meRef.current.x);
      const ty = f.kind === "boss" ? geo.arena.y : (m ? m.y : meRef.current.y);
      if (m) m.flash = performance.now();
      pop(tx, ty - 18, "-" + Math.round(dmg), crit ? "#ffd24d" : "#ffffff", crit);
      if (f.kind === "boss") coop.shout({ id: W.boss.id, dmg: Math.round(dmg), by: playerName });
      if (nhp <= 0) return winFight(f);
      setFight({ ...f, hp: nhp, streak: f.streak + 1, wrongRun: 0, q: makeQuestion(lang), flash: Date.now() });
      return;
    }

    playMiss(); haptic(30);
    const dmg = mobHit(saveRef.current, f.kind === "boss");
    pop(meRef.current.x, meRef.current.y - 20, "-" + dmg, "#ff6a6a", false);
    hitFlashRef.current = 1;
    const nh = Math.max(0, hp - dmg);
    setHp(nh);
    const wrongRun = f.wrongRun + 1;
    if (nh <= 0) return loseFight();
    // the lore's own rule, made mechanical: you cannot fight your way out
    // of losing your composure — you have to play your way out
    if (wrongRun >= 2 || nh < maxHp(saveRef.current) * 0.34) {
      setFight({ ...f, streak: 0, wrongRun: 0, q: makeQuestion(lang), destab: (f.destab || 0) + 1 });
      setCtrl({ step: 0, bad: null, n: f.destab || 0 });
      return;
    }
    setFight({ ...f, streak: 0, wrongRun, q: makeQuestion(lang) });
  }

  function winFight(f) {
    const s = saveRef.current;
    if (f.kind === "boss") {
      commit({ ...s, bosses: { ...s.bosses, [W.boss.id]: true } });
      const q = (QUESTS[s.world] || []).find(x => x.kind === "boss");
      if (q) { bumpQuest(q.id, 1); award(q.stat, 6, tr3(W.boss.name, lang)); }
      onReward(60, 40);
      setFight({ ...f, over: "win", hp: 0 });
      return;
    }
    const m = mobsRef.current.find(x => x.id === f.mobId);
    if (m) { m.dead = 9; pop(m.x, m.y - 24, "◆", W.glow, true); }
    playWhoosh();
    commit({ ...saveRef.current, kills: saveRef.current.kills + 1 });
    const q = (QUESTS[s.world] || []).find(x => x.kind === "slay" && !(s.quests[x.id] || {}).done);
    if (q) { bumpQuest(q.id, 1); }
    award("courage", 1);
    onReward(4, 2);
    setFight(null);
  }
  function loseFight() {
    setFight(null); setCtrl(null);
    const me = meRef.current;
    me.x = geo.town.x; me.y = geo.town.y + 60;
    setHp(Math.round(maxHp(saveRef.current) * 0.55));
    say(T("Emotion Core ล้มเหลว — กลับมาที่เมืองแล้ว ไม่มีอะไรถูกริบไป",
          "Emotion Core failed — recovered to town. Nothing was taken from you.",
          "情感核心失效 —— 已送回城镇。你没有失去任何东西。"), 3400);
  }

  // ── CONTROL MODE ────────────────────────────────────────────────────
  function ctrlKey(k) {
    if (!ctrl) return;
    const seq = controlPhrase(ctrl.n || 0);
    const want = seq[ctrl.step];
    // the key sounds whatever happens — you have to HEAR the wrong note to
    // learn anything from playing it
    playPianoNote(k + "4", 0.6, k === want ? 1 : 0.55);
    if (k !== want) { playMiss(); haptic(18); setCtrl({ ...ctrl, bad: k }); window.setTimeout(() => setCtrl(c => (c ? { ...c, bad: null } : c)), 260); return; }
    haptic(6);
    const step = ctrl.step + 1;
    if (step < seq.length) { setCtrl({ ...ctrl, step, bad: null }); return; }
    setCtrl(null);
    // only the first stabilisation of a fight pays; the rest heal and buff
    if (!(ctrl.n > 0)) award("control", 2, T("Core เสถียร", "Core stabilised", "核心稳定"));
    else say(T("Core เสถียรแล้ว — แต่ครั้งนี้ไม่ได้แต้ม",
               "Core stabilised — no stat for a repeat in the same fight.",
               "核心已稳定 —— 同一场战斗中重复稳定不计入状态。"));
    setHp(h => Math.min(maxHp(saveRef.current), h + 18));
    const f = fightRef.current;
    if (f) setFight({ ...f, streak: 2, buff: true });
  }

  // ── a `play` quest ──────────────────────────────────────────────────
  function taskKey(k) {
    if (!task) return;
    const want = task.quest.seq[task.step];
    playPianoNote(k + "4", 0.6, k === want ? 1 : 0.55);
    if (k !== want) { playMiss(); haptic(18); setTask({ ...task, bad: k }); window.setTimeout(() => setTask(t => (t ? { ...t, bad: null } : t)), 260); return; }
    haptic(6);
    const step = task.step + 1;
    if (step < task.quest.seq.length) { setTask({ ...task, step, bad: null }); return; }
    const s = saveRef.current;
    commit({ ...s, played: s.played + 1 });
    bumpQuest(task.quest.id, 1);
    award(task.quest.stat, 4, tr3(task.quest.title, lang));
    onReward(12, 8);
    setTask(null);
    setTalk({ npcName: task.quest.giver, quest: task.quest, phase: "done" });
  }

  // ── interaction ─────────────────────────────────────────────────────
  const near = useMemo(() => {
    const me = meRef.current;
    for (const n of geo.npcs) {
      if (!n) continue;
      if (Math.hypot(n.x - me.x, n.y - me.y) < 62) return { kind: "npc", npc: n };
    }
    if (Math.hypot(geo.arena.x - me.x, geo.arena.y - me.y) < 96) return { kind: "arena" };
    return null;
    // tick makes this recompute as the player walks; meRef itself is not state
  }, [tick, geo]);

  function interact() {
    if (!near) return;
    if (near.kind === "arena") {
      if (save.bosses[W.boss.id]) { say(T("บอสนี้ถูกปราบแล้ว", "This boss has already fallen.", "此首领已被击败。")); return; }
      const q = (QUESTS[W.id] || []).find(x => x.kind === "boss");
      const ready = q ? (QUESTS[W.id] || []).filter(x => x.kind !== "boss").every(x => (save.quests[x.id] || {}).done) : true;
      if (!ready) { say(T("จบเควสต์อื่นในดาวนี้ให้หมดก่อน", "Finish this world's other work first.", "先完成本星球的其他任务。")); return; }
      startBoss(); return;
    }
    const n = near.npc;
    const qs = (QUESTS[W.id] || []).filter(q => n.quests.includes(q.id));
    // a quest that is complete but unclaimed takes priority over a new one
    const claim = qs.find(q => { const st = save.quests[q.id] || {}; return st.done && !st.claimed; });
    const openQ = qs.find(q => !(save.quests[q.id] || {}).done);
    playUi("click");
    if (claim) { setTalk({ npcName: n.name, quest: claim, phase: "done" }); return; }
    if (openQ) { setTalk({ npcName: n.name, quest: openQ, phase: "brief" }); return; }
    say(T("ไม่มีอะไรให้ทำแล้วที่นี่", "Nothing more for you here.", "这里没有别的事了。"));
  }

  /* Accepting the brief is what starts the work. `quiz` opens a run of
     questions right there; `play` opens the keyboard; `slay` and `boss`
     send you back out into the world. */
  function acceptQuest(q) {
    setTalk(null);
    // resume where the save left off — a run abandoned at 3/4 must not cost
    // the player the three questions they already answered correctly
    if (q.kind === "quiz") {
      const got = (saveRef.current.quests[q.id] || {}).prog || 0;
      setFight({ kind: "quiz", quest: q, need: q.n, got, q: makeQuestion(lang), streak: 0, wrongRun: 0, name: tr3(q.title, lang), col: statById(q.stat).c });
      return;
    }
    if (q.kind === "play") { setTask({ quest: q, step: 0, bad: null }); return; }
    if (q.kind === "slay") { say(T("ออกไปหามันข้างนอก", "Go and find them out there.", "去外面找它们。")); return; }
    if (q.kind === "boss") { say(T("วงแหวนบอสอยู่บนแผนที่", "The boss ring is marked on your map.", "首领之环已在地图上标出。")); }
  }
  function claimQuest(q) {
    const s = saveRef.current;
    const st = s.quests[q.id] || { prog: 0, done: true };
    commit({ ...s, quests: { ...s.quests, [q.id]: { ...st, done: true, claimed: true } } });
    setTalk(null);
    award(q.stat, q.kind === "quiz" ? 5 : 4, tr3(q.title, lang));
    onReward(18, 12);
  }

  /* A quiz quest runs through the same overlay as a fight, because it is
     the same act — the only difference is what is standing across from you. */
  function quizAnswer(opt) {
    const f = fightRef.current; if (!f || f.kind !== "quiz") return;
    const right = opt === f.q.ans;
    const s = saveRef.current;
    commit({ ...s, answers: s.answers + 1, right: s.right + (right ? 1 : 0) });
    if (!right) {
      playMiss(); haptic(24);
      const wrongRun = f.wrongRun + 1;
      if (wrongRun >= 2) { setFight({ ...f, wrongRun: 0, q: makeQuestion(lang), destab: (f.destab || 0) + 1 }); setCtrl({ step: 0, bad: null, n: f.destab || 0 }); return; }
      setFight({ ...f, wrongRun, streak: 0, q: makeQuestion(lang) });
      return;
    }
    playBoom(false); haptic(10);
    // banked one answer at a time rather than only at the end, so closing the
    // app mid-run costs nothing that was already earned
    const got = f.got + 1;
    bumpQuest(f.quest.id, 1);
    if (got >= f.need) {
      setFight(null);
      setTalk({ npcName: f.quest.giver, quest: f.quest, phase: "done" });
      return;
    }
    setFight({ ...f, got, streak: f.streak + 1, wrongRun: 0, q: makeQuestion(lang) });
  }

  // ── travel ──────────────────────────────────────────────────────────
  function travel(w) {
    if (totalStat(saveRef.current) < w.gate) return;
    const s = { ...saveRef.current, world: w.id };
    commit(s);
    setScreen(s.seen[w.id] ? "world" : "intro");
    playUi("click");
  }
  function beginWorld() {
    const s = saveRef.current;
    commit({ ...s, seen: { ...s.seen, [s.world]: true } });
    setScreen("world");
  }

  const hpPct = clamp(hp / maxHp(save), 0, 1);
  const f = fight;

  // ══════════════════════ render ══════════════════════
  return (
    <div className={`sspage${land ? " land" : ""}`} style={{ "--wc": W.accent, "--wg": W.glow }}>
      {chassisHost}
      <header className="sshdr">
        <button className="ssback" onClick={onBack} aria-label="Back">←</button>
        <div className="sshdr-t">
          <b>TIGA: STARSONG</b>
          <i>{tr3(W.name, lang)} · {T("แรงก์", "Rank", "阶")} {chassisLevel(save)}</i>
        </div>
        {coop.online && (
          <span className="ssonline" title={T("ผู้เล่นในดาวนี้", "Explorers on this world", "此星球上的探索者")}>
            ◉ {coop.peers.length}
          </span>
        )}
        <button className="ssnavbtn ssmute" aria-pressed={music}
          title={T("เพลงประกอบ", "Soundtrack", "配乐")}
          onClick={() => {
            const v = !music; setMusic(v);
            try { localStorage.setItem("tg_ss_music", v ? "1" : "0"); } catch (e) {}
          }}>{music ? "♪" : "✕"}</button>
        <button className="ssnavbtn" onClick={() => { playUi("click"); setScreen(screen === "sheet" ? "world" : "sheet"); }}>{T("สถานะ", "Sheet", "状态")}</button>
        <button className="ssnavbtn" onClick={() => { playUi("click"); setScreen(screen === "map" ? "world" : "map"); }}>{T("แผนที่", "Map", "地图")}</button>
      </header>

      {/* ── the opening card for a world you have not stood on before ── */}
      {screen === "intro" && (
        <div className="ssintro">
          <div className="ssintro-card">
            <div className="ssintro-eyebrow">{T("บันทึกภารกิจ", "MISSION LOG", "任务日志")} · 3187</div>
            <h2>{tr3(W.name, lang)}</h2>
            <div className="ssintro-sub">{tr3(W.sub, lang)}</div>
            <p>{tr3(W.intro, lang)}</p>
            <button className="ssbtn primary" onClick={beginWorld}>{T("ลงจอด", "Make planetfall", "着陆")}</button>
          </div>
        </div>
      )}

      {/* ── the character sheet: the whole point of the game, on one screen ── */}
      {screen === "sheet" && (
        <div className="sssheet">
          <div className="sssheet-hero">
            <div className="sssheet-rank">{chassisLevel(save)}</div>
            <div>
              <b>TIGA-01</b>
              <i>{T("รวมสถานะ", "Total stat", "总状态")} {total} · {T("ตอบถูก", "Correct", "答对")} {save.right}/{save.answers}</i>
            </div>
          </div>
          <p className="sssheet-note">
            {T("ทุกแต้มในหน้านี้มาจากการตอบคำถามดนตรีหรือการเล่นโน้ตเท่านั้น ไม่มีแต้มไหนได้มาจากการเดินหรือรอ",
               "Every point on this sheet came from a music question answered or a phrase played. None of it came from walking around or waiting.",
               "本页的每一点，都来自答对的乐理题或弹出的乐句。没有一点来自走动或等待。")}
          </p>
          <div className="ssstats">
            {ESTATS.map(st => {
              const v = save.stats[st.id] || 0;
              return (
                <div key={st.id} className="ssstat" style={{ "--sc": st.c }}>
                  <span className="ssstat-ic">{st.ic}</span>
                  <span className="ssstat-nm">{tr3(st, lang)}</span>
                  <span className="ssstat-bar"><i style={{ width: clamp(v * 2.2, 2, 100) + "%" }} /></span>
                  <span className="ssstat-v">{v}</span>
                </div>
              );
            })}
          </div>
          <div className="ssquestlog">
            <h3>{T("บันทึกเควสต์", "Quest log", "任务日志")} · {tr3(W.name, lang)}</h3>
            {(QUESTS[W.id] || []).map(q => {
              const st = save.quests[q.id] || { prog: 0, done: false };
              return (
                <div key={q.id} className={`ssql${st.done ? " done" : ""}`}>
                  <span className="ssql-k">{st.done ? "✓" : q.kind === "boss" ? "☠" : q.kind === "slay" ? "⚔" : q.kind === "play" ? "🎹" : "?"}</span>
                  <span className="ssql-t">{tr3(q.title, lang)}</span>
                  <span className="ssql-p">{st.done ? T("เสร็จ", "done", "完成") : `${st.prog}/${q.n || 1}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── star map ── */}
      {screen === "map" && (
        <div className="ssmap">
          <h3 className="ssmap-h">{T("แผนที่ดาว", "Star map", "星图")}</h3>
          <p className="ssmap-note">
            {T("ดาวดวงต่อไปเปิดด้วยแต้มสถานะ ไม่ใช่ด้วยเวลาที่เล่น — ทางเดียวที่จะไปต่อคือฝึกดนตรีให้เก่งขึ้น",
               "The next world unlocks on stat, not on hours played — the only way onward is to get better at music.",
               "下一个星球以状态值解锁，而非游戏时长 —— 唯一的前进之道，是把音乐练得更好。")}
          </p>
          {WORLDS.map(w => {
            const lock = total < w.gate;
            const here = w.id === save.world;
            const bossDone = !!save.bosses[w.boss.id];
            return (
              <button key={w.id} className={`ssworld${lock ? " lock" : ""}${here ? " here" : ""}`}
                style={{ "--wc": w.accent }} disabled={lock} onClick={() => travel(w)}>
                <span className="ssworld-orb" style={{ background: `radial-gradient(circle at 34% 30%, ${w.sky[2]}, ${w.sky[0]})` }} />
                <span className="ssworld-b">
                  <b>{tr3(w.name, lang)}{bossDone ? " ✓" : ""}</b>
                  <i>{tr3(w.sub, lang)}</i>
                </span>
                <span className="ssworld-go">
                  {lock ? `🔒 ${w.gate}` : here ? T("อยู่ที่นี่", "you are here", "你在此") : "→"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── the world ── */}
      {screen === "world" && (
        <div className="ssworldwrap">
          <canvas ref={cvRef} className="sscanvas" />

          <div className="sshud">
            <div className="sshp"><i style={{ width: hpPct * 100 + "%" }} /><b>{Math.max(0, Math.round(hp))}</b></div>
            {activeQuest && (
              <div className="sstrack">
                <span className="sstrack-k">{activeQuest.kind === "boss" ? "☠" : activeQuest.kind === "slay" ? "⚔" : activeQuest.kind === "play" ? "🎹" : "?"}</span>
                <span className="sstrack-t">{tr3(activeQuest.title, lang)}</span>
                <span className="sstrack-p">{(save.quests[activeQuest.id] || {}).prog || 0}/{activeQuest.n || 1}</span>
              </div>
            )}
          </div>

          {/* virtual stick — placed under the left thumb, and it also moves
              with the pointer so a drag anywhere on the left half steers */}
          <div className="sspad"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = e.currentTarget.getBoundingClientRect();
              padRef.current.on = true; padRef.current.ox = r.left + r.width / 2; padRef.current.oy = r.top + r.height / 2;
            }}
            onPointerMove={(e) => {
              if (!padRef.current.on) return;
              const dx = e.clientX - padRef.current.ox, dy = e.clientY - padRef.current.oy;
              const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 46);
              padRef.current.ax = (dx / d) * k; padRef.current.ay = (dy / d) * k;
              setTick(t => t + 1);
            }}
            onPointerUp={() => { padRef.current.on = false; padRef.current.ax = 0; padRef.current.ay = 0; }}
            onPointerCancel={() => { padRef.current.on = false; padRef.current.ax = 0; padRef.current.ay = 0; }}>
            <span className="sspad-knob" style={{ transform: `translate(${padRef.current.ax * 26}px, ${padRef.current.ay * 26}px)` }} />
          </div>

          <button className={`ssact${near ? " on" : ""}`} onClick={interact} disabled={!near}>
            {near ? (near.kind === "arena" ? "☠" : "!") : "·"}
            <i>{near ? (near.kind === "arena" ? T("ท้าบอส", "Challenge", "挑战") : T("คุย", "Talk", "对话")) : T("เดินสำรวจ", "Explore", "探索")}</i>
          </button>

          {!land && <div className="ssrotate">⟳ {T("หมุนจอเพื่อเล่นเต็มหน้าจอ", "Turn your phone for full screen", "旋转手机以全屏游玩")}</div>}
          {toast && <div className="sstoast">{toast}</div>}
        </div>
      )}

      {/* ── dialogue ── */}
      {talk && (
        <div className="ssmodal" onClick={(e) => { if (e.target === e.currentTarget) setTalk(null); }}>
          <div className="sstalk">
            <div className="sstalk-who">{tr3(talk.npcName, lang)}</div>
            <h3>{tr3(talk.quest.title, lang)}</h3>
            <p>{talk.phase === "done" ? tr3(talk.quest.done, lang) : tr3(talk.quest.brief, lang)}</p>
            <div className="sstalk-meta">
              <span style={{ color: statById(talk.quest.stat).c }}>
                {statById(talk.quest.stat).ic} {tr3(statById(talk.quest.stat), lang)}
              </span>
              <span>{talk.quest.kind === "quiz" ? T("ตอบคำถาม", "Theory", "乐理") + " ×" + talk.quest.n
                : talk.quest.kind === "play" ? T("เล่นโน้ต", "Perform", "演奏") + " · " + talk.quest.seq.join(" ")
                : talk.quest.kind === "slay" ? T("กำจัด", "Clear", "清除") + " ×" + talk.quest.n
                : T("บอส", "Boss", "首领")}</span>
            </div>
            {talk.phase === "done"
              ? <button className="ssbtn primary" onClick={() => claimQuest(talk.quest)}>{T("รับรางวัล", "Accept report", "领取")}</button>
              : <div className="sstalk-row">
                  <button className="ssbtn" onClick={() => setTalk(null)}>{T("ไว้ก่อน", "Later", "稍后")}</button>
                  <button className="ssbtn primary" onClick={() => acceptQuest(talk.quest)}>{T("รับภารกิจ", "Take it", "接受")}</button>
                </div>}
          </div>
        </div>
      )}

      {/* ── a `play` quest: the hands, not the head ── */}
      {task && (
        <div className="ssmodal">
          <div className="ssplay">
            <h3>{tr3(task.quest.title, lang)}</h3>
            <div className="ssseq">
              {task.quest.seq.map((n, i) => (
                <span key={i} className={`ssseq-n${i < task.step ? " ok" : i === task.step ? " now" : ""}`}>{n}</span>
              ))}
            </div>
            <MiniKeys onKey={taskKey} lit={task.quest.seq[task.step]} wrong={task.bad} />
            <button className="ssbtn" onClick={() => setTask(null)}>{T("ออก", "Step away", "离开")}</button>
          </div>
        </div>
      )}

      {/* ── CONTROL MODE ──
          The screen everything else in the game exists to set up: you have
          lost your composure, the fight is paused, and the only way back
          in is to play something cleanly. */}
      {ctrl && (
        <div className="ssmodal ctrl">
          <div className="ssctrl">
            <div className="ssctrl-warn">
              <b>⚠ EMOTION CORE · UNSTABLE</b>
              <i>{T("อัตราการตัดสินใจผิดพลาดเพิ่มขึ้น — เล่นแบบฝึกหัดเพื่อคืนความเสถียร",
                    "DECISION ACCURACY DEGRADING — play the exercise to restabilise",
                    "决策准确率下降 —— 弹奏练习以恢复稳定")}</i>
            </div>
            <div className="ssseq">
              {controlPhrase(ctrl.n || 0).map((n, i) => (
                <span key={i} className={`ssseq-n${i < ctrl.step ? " ok" : i === ctrl.step ? " now" : ""}`}>{n}</span>
              ))}
            </div>
            <MiniKeys onKey={ctrlKey} lit={controlPhrase(ctrl.n || 0)[ctrl.step]} wrong={ctrl.bad} />
            <div className="ssctrl-buffs">
              <span>◎ FOCUS +20%</span><span>⌖ ACCURACY +30%</span><span>▲ CRIT +15%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── fights and quiz runs share one overlay ── */}
      {f && !ctrl && (
        <div className="ssmodal">
          <div className={`ssfight${f.kind === "boss" ? " boss" : ""}`} style={{ "--fc": f.col }}>
            {f.over === "win" ? (
              <div className="sswin">
                <div className="sswin-k">{T("ปราบสำเร็จ", "DOWN", "击破")}</div>
                <h3>{f.name}</h3>
                <p>{f.line}</p>
                <button className="ssbtn primary" onClick={() => setFight(null)}>{T("ต่อไป", "Continue", "继续")}</button>
              </div>
            ) : (
              <>
                <div className="ssfight-top">
                  <span className="ssfight-nm">{f.name}</span>
                  {f.kind === "quiz"
                    ? <span className="ssfight-hp-n">{f.got}/{f.need}</span>
                    : <span className="ssfight-hp-n">{Math.max(0, Math.round(f.hp))}</span>}
                </div>
                <div className="ssfight-bar">
                  <i style={{ width: (f.kind === "quiz" ? (f.got / f.need) : (f.hp / f.max)) * 100 + "%" }} />
                </div>
                {f.kind === "boss" && f.line && <p className="ssboss-line">{f.line}</p>}
                {f.kind === "boss" && coop.peers.length > 1 && (
                  <div className="ssallies">◉ {T("อีก", "with", "还有")} {coop.peers.length - 1} {T("คนกำลังสู้ตัวนี้อยู่", "others in this ring", "人同在此环中")}</div>
                )}
                {f.streak > 1 && <div className="ssstreak">×{f.streak} {T("ต่อเนื่อง", "streak", "连击")}</div>}
                <div className="ssq">{f.q.q}</div>
                <div className="ssopts">
                  {f.q.opts.map(o => (
                    <button key={o} className="ssopt" onClick={() => (f.kind === "quiz" ? quizAnswer(o) : answer(o))}>{o}</button>
                  ))}
                </div>
                {f.kind !== "quiz" && (
                  <div className="ssfight-hp">
                    <span>{T("ตัวเรา", "Hull", "机体")}</span>
                    <i><b style={{ width: hpPct * 100 + "%" }} /></i>
                    <span>{Math.max(0, Math.round(hp))}</span>
                  </div>
                )}
                <button className="ssflee" onClick={() => { setFight(null); say(T("ถอยออกมาแล้ว", "Disengaged.", "已脱离。")); }}>
                  {T("ถอย", "Disengage", "脱离")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/* ══════════════════════ the profile pod ══════════════════════

   Mirrors the pet pod on the other side of the avatar: the character's two
   companions — the thing you look after and the world you fight in — sit
   either side of the character itself. */
export const StarsongPod = memo(function StarsongPod({ lang, onOpen }) {
  const [save, setSave] = useState(() => readSave());
  useEffect(() => {
    const sync = () => setSave(readSave());
    window.addEventListener("tg-starsong", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("tg-starsong", sync); window.removeEventListener("focus", sync); };
  }, []);
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const started = totalStat(save) > 0 || Object.keys(save.quests).length > 0;
  const W = worldById(save.world);
  const openQ = (QUESTS[save.world] || []).find(q => !(save.quests[q.id] || {}).done);

  return (
    <button className={`sspod${openQ ? " need" : ""}`} onClick={onOpen}
      style={{ "--pc": W.accent }}
      title={T("TIGA: STARSONG — เกม RPG โลกเปิด", "TIGA: STARSONG — open-world RPG", "TIGA: STARSONG — 开放世界 RPG")}>
      <span className="sspod-orb" style={{ background: `radial-gradient(circle at 34% 28%, ${W.sky[2]}, ${W.sky[0]})` }} />
      <b>{T("โหมดผจญภัย", "Adventure Mode", "冒险模式")}</b>
      {started
        ? <i>{tr3(W.name, lang)} · {T("แรงก์", "Rk", "阶")} {chassisLevel(save)}</i>
        : <i>{T("เริ่มเลย", "Start", "开始")}</i>}
      {openQ && <em aria-label={T("มีเควสต์ค้างอยู่", "Quest available", "有任务")} />}
    </button>
  );
});
