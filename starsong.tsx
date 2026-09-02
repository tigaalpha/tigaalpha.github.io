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
import { createPortal } from "react-dom";
import { sb } from "./supabase-client";
import { makeQuestion, spellMajor } from "./pvp-arena";
import { playPianoNote, playBoom, playMiss, playWhoosh, haptic } from "./music-engine";
import { CyberAvatar } from "./cyber-avatar";
import { createArenaAudio, stageById, useArenaFx } from "./arena-fx";
import { AnswerReveal } from "./note-reveal";

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
/* NOTE: this returns an UNSIGNED 32-bit value, so shift it with `>>>`.
   A signed `>>` turns anything at or above 2^31 negative, and a negative
   radius makes canvas throw rather than draw. */
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
    sky: ["#04050e", "#150f36", "#46226f"], ground: "#121d3a", accent: "#3fd8ff",
    grass: "#0e3846", rock: "#080e1e", path: "#22366f", glow: "#7fe8ff",
    sun: "#a98cff", amb: "#1c3170", neon: "#ff2bd6", win: "#ffd28a",
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
    sky: ["#0b0206", "#3b0a11", "#a02c0e"], ground: "#2b1210", accent: "#ff7a2f",
    grass: "#48210a", rock: "#150708", path: "#5e2709", glow: "#ffb14d",
    sun: "#ff8a3c", amb: "#4d1410", neon: "#ff2f5e", win: "#ffcf6a",
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
    sky: ["#01070f", "#062f49", "#0f7391"], ground: "#082641", accent: "#4df0ff",
    grass: "#06424e", rock: "#031120", path: "#0c4068", glow: "#9df8ff",
    sun: "#bfe8ff", amb: "#0b3654", neon: "#2f7bff", win: "#d8f4ff",
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
    sky: ["#0c0211", "#4d0632", "#ab114c"], ground: "#2c0824", accent: "#ff3f8f",
    grass: "#4a1038", rock: "#170415", path: "#5e0f36", glow: "#ff7fbf",
    sun: "#ff7ab0", amb: "#460a2e", neon: "#ffd23f", win: "#ff9a5c",
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
    sky: ["#020112", "#1d0a4d", "#5020a4"], ground: "#160c3a", accent: "#b07dff",
    grass: "#1f1052", rock: "#0b0524", path: "#2e1774", glow: "#e0c4ff",
    sun: "#d3a8ff", amb: "#261263", neon: "#3ff0d0", win: "#fff0b8",
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

/* ══════════════════════ the projection ══════════════════════

   The world is stored flat — x and y on a plane, which is what collision and
   the terrain sampler want — and drawn isometric, which is what makes it look
   like a place rather than a floor plan. One function stands between the two,
   and it takes a HEIGHT: everything from a cliff face to a robot's head is
   just the same ground position lifted off the plane by some amount.

   The dimetric ratio (0.9 across, 0.5 down) is the usual one for a reason —
   it keeps a square cell reading as a square seen from above rather than as a
   stretched lozenge, and it makes the vertical scale legible next to it. */
export const IX = 0.9, IY = 0.5, IH = 0.66;
export const iso = (wx, wy, h = 0) => ({ x: (wx - wy) * IX, y: (wx + wy) * IY - h * IH });
/** Screen back to ground, for working out which cells the camera can see. */
export const unIso = (sx, sy) => ({ x: (sx / IX + sy / IY) / 2, y: (sy / IY - sx / IX) / 2 });

/* Terrain tiers become real elevations, so a ridge is a cliff you can see the
   side of rather than a differently coloured patch of floor. */
export const TIER_H = [0, 0, 13, 26, 48];
export const WORLD_R = 1500;   // half-extent in world units; the map is a disc

/* Five tiers, not three. With only "low / ground / rock" almost every cell
   landed in the middle band and the world came out a flat plateau — which
   wastes the whole point of drawing it as blocks. Splitting the walkable
   middle into three elevations puts a visible terrace under your feet
   wherever you stand, and the extrusion has something to show. */
function terrainAt(seed, wx, wy) {
  const n = fbm(seed, wx / 340, wy / 340);
  const edge = Math.hypot(wx, wy) / WORLD_R;
  const v = n - Math.max(0, edge - 0.72) * 1.6;   // the disc falls away at the rim
  if (v < 0.28) return 0;   // chasm — the sky shows through
  if (v < 0.42) return 1;   // low flats
  if (v < 0.545) return 2;  // ground
  if (v < 0.655) return 3;  // rise
  return 4;                 // rock shelf — impassable
}
export const walkable = (seed, wx, wy) => { const t = terrainAt(seed, wx, wy); return t >= 1 && t <= 3; };

/* The nearest place you are allowed to stand.

   Standing INSIDE a block is unrecoverable on its own: a step is 2.8px and a
   cell is 26, so every move is tested against the same solid cell and
   rejected, for ever. The spawn point is a fixed offset from the town and on
   Terra Nova — the world every single player starts in — that offset landed
   in a wall, which is exactly the "I cannot move at all" report. */
export function nearestWalkable(seed, wx, wy) {
  if (walkable(seed, wx, wy)) return { x: wx, y: wy };
  for (let r = 13; r <= 520; r += 13) {
    for (let i = 0; i < 24; i++) {
      const a2 = (i / 24) * Math.PI * 2;
      const x = wx + Math.cos(a2) * r, y = wy + Math.sin(a2) * r;
      if (walkable(seed, x, y)) return { x, y };
    }
  }
  return { x: wx, y: wy };
}

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
    const pool = foesOf(w.id);
    const sp = pool.length ? pool[hash32(w.seed + ":sp" + i) % pool.length].id : null;
    out.push({ id: "m" + i, x, y, hx: x, hy: y, hp: 3, t: Math.random() * 6.28, dead: 0, sp });
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
/* Cells are bigger than the old flat grid because each one is now a solid
   with three visible faces rather than a filled rectangle, and a cliff reads
   better in chunks than in crumbs. */
const CELL = 26;

/* ══════════════════════ terrain ══════════════════════

   Every cell is a block: a top face at its own elevation, and — where the
   neighbour in front of it sits lower — a left and right wall dropping to
   meet it. Painted back to front (by wx+wy, which IS depth in this
   projection) so the walls in front occlude the tops behind them.

   The two side faces take fixed multipliers off the top colour rather than a
   computed normal: with a single fixed sun this is exactly equivalent, costs
   nothing, and keeps every block on the same lighting model. */
/* ── light with a colour ──
   shade() only ever multiplied brightness, which is why a whole planet came
   out as one flat wash: a cliff, a path and a field all landed on the same
   hue at different exposures. Real light changes HUE. A face turned to the
   key takes the key's colour; a face turned away is lit only by the sky and
   goes cool. That one distinction is most of the difference between a world
   that is lit and a world that is merely tinted, and it is the whole reason
   a sunlit game reads warm-against-cool rather than light-against-dark. */
function mixHex(a, b, t) {
  const P = (h) => { const v = String(h).replace("#", ""); const n = parseInt(v.length === 3 ? v.split("").map(c => c + c).join("") : v.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const A = P(a), B = P(b), u = Math.max(0, Math.min(1, t));
  return [Math.round(A[0] + (B[0] - A[0]) * u), Math.round(A[1] + (B[1] - A[1]) * u), Math.round(A[2] + (B[2] - A[2]) * u)];
}
/** base colour + how square-on the face is to the key → the colour it is.

    Light is ADDED, not blended toward. Blending a dark navy rock 20% toward a
    cream sun gives grey — which is exactly what a cliff face looked like, and
    why a world full of saturated materials still came out monochrome. Adding
    the key on top of the material instead keeps the material's own hue and
    only lifts it, which is both what light does and the reason a sunlit game
    reads as colourful rather than as washed. */
function litFace(base, k, sun, amb, jitter) {
  const B = mixHex(base, base, 0);                 // → [r,g,b]
  const S = mixHex(sun, sun, 0), A = mixHex(amb, amb, 0);
  const e = Math.max(0.34, k * 0.86) * (1 + (jitter || 0));
  const key = k >= 1 ? Math.min(0.34, (k - 1) * 3.2) : 0;   // facing the sun
  const sky = k < 1 ? Math.min(0.30, (1 - k) * 0.62) : 0;   // facing the sky
  const out = [0, 1, 2].map(i => Math.min(255, Math.round(B[i] * e + S[i] * key * 0.62 + A[i] * sky * 0.42)));
  return `rgb(${out[0]},${out[1]},${out[2]})`;
}

function shade(hex, k) {
  const v = String(hex).replace("#", "");
  const n = parseInt(v.length === 3 ? v.split("").map(c => c + c).join("") : v.slice(0, 6), 16);
  const r = Math.round(((n >> 16) & 255) * k), gg = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${Math.min(255, r)},${Math.min(255, gg)},${Math.min(255, b)})`;
}


/* ══════════════════════════ the camera ══════════════════════════

   A real perspective camera orbiting behind the player, in place of the
   affine isometric transform this world used to be drawn with. The world data
   is untouched — (x, y) on the ground, h up, the same height field, the same
   walkability — only the view changes, so quests, collision and every entity
   position carry over exactly.

   Conventions, once, so nothing downstream has to guess:
     yaw 0 looks along +y.  forward = (sin yaw, cos yaw).  right = (cos yaw,
     -sin yaw).  The eye sits DIST behind the target and HIGH above the
     ground, and the pitch is DERIVED from those two rather than set — which
     is what keeps the player pinned to the middle of frame at any distance
     instead of drifting up the screen. */
export const CAM = { dist: 300, high: 168, look: 34, fov: 58, near: 26, far: 1500 };

export function makeCam(cam, vw, vh) {
  const fx = Math.sin(cam.yaw), fy = Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw), ry = -Math.sin(cam.yaw);
  const ex = cam.x - fx * CAM.dist, ey = cam.y - fy * CAM.dist, ez = CAM.high;
  const p = Math.atan2(CAM.high - CAM.look, CAM.dist);   // derived, not chosen
  const cp = Math.cos(p), sp = Math.sin(p);
  const focal = (vh / 2) / Math.tan((CAM.fov * Math.PI / 180) / 2);
  const hw = vw / 2, hh = vh / 2;
  /* → {x, y, d, s}. d is depth along the view axis, s is pixels per world
     unit at that depth: a 90-unit robot is 90*s pixels tall, which is the
     whole of how a billboard knows its size. */
  const project = (wx, wy, h) => {
    const dx = wx - ex, dy = wy - ey, dz = (h || 0) - ez;
    const fwd = dx * fx + dy * fy;
    const d = fwd * cp - dz * sp;
    if (d < CAM.near) return { x: 0, y: 0, d: -1, s: 0 };
    const s = focal / d;
    return {
      x: hw + (dx * rx + dy * ry) * s,
      y: hh - (fwd * sp + dz * cp) * s,
      d, s,
    };
  };
  /* where the ground plane vanishes: a point at infinite distance. The
     backdrop has to be pinned to THIS, not to a fraction of the viewport, or
     the hills float above the horizon or sink under it as the camera tilts. */
  const horizon = hh - focal * (sp / cp);
  return { project, fx, fy, rx, ry, ex, ey, ez, focal, hw, hh, horizon };
}

/* ── the ground, as boxes ──
   Every cell in range becomes a box and every box contributes its visible
   faces to ONE draw list shared with the entities. A rotating camera kills
   the isometric trick where depth was just x+y, so the list is sorted by real
   camera depth — far first — which is also the only way a monster standing
   in front of a wall can end up drawn in front of it. */
export function pushTerrain(list, P, W, geo, cam) {
  const seed = geo.seed;
  const SUN = W.sun || "#ffd9a8", AMB = W.amb || "#4a7ad0";
  /* Near-black surfaces need every bright pixel to be an actual light source.
     NEON edges the architecture, WIN lights the windows — between them they
     carry the whole read of the city, because the shell colours no longer can. */
  const NEON = hexRgb(W.neon || W.glow), WIN = hexRgb(W.win || "#ffd28a");
  const R = 15;                                    // cells of ground, then fog
  const gx0 = Math.floor(cam.x / CELL) - R, gx1 = Math.floor(cam.x / CELL) + R;
  const gy0 = Math.floor(cam.y / CELL) - R, gy1 = Math.floor(cam.y / CELL) + R;
  const tierAt = (gx, gy) => terrainAt(seed, gx * CELL + CELL / 2, gy * CELL + CELL / 2);
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      const t = tierAt(gx, gy);
      if (t === 0) continue;                       // a hole: the sky shows through
      const h = TIER_H[t];
      const wx = gx * CELL, wy = gy * CELL;
      // one probe first: a cell whose centre is behind the eye or well off to
      // the side cannot contribute anything, and probing is far cheaper than
      // projecting eight corners to find that out
      const mid = P.project(wx + CELL / 2, wy + CELL / 2, h);
      if (mid.d < 0 || mid.x < -CELL * 6 || mid.x > P.hw * 2 + CELL * 6 || mid.y > P.hh * 2 + CELL * 8) continue;
      // depth is taken at the FOOT of the box, not its cap: sorting a tall
      // block by its top face makes it think it is further away than it is,
      // and it ends up painted behind things it is standing in front of
      const foot = P.project(wx + CELL / 2, wy + CELL / 2, 0);
      const a = P.project(wx, wy, h), b = P.project(wx + CELL, wy, h);
      const c = P.project(wx + CELL, wy + CELL, h), e = P.project(wx, wy + CELL, h);
      if (a.d < 0 || b.d < 0 || c.d < 0 || e.d < 0) continue;
      const base = t === 4 ? W.rock : t === 3 ? W.path : t === 1 ? W.grass : W.ground;
      const j = fbm(seed ^ 0x51ed, gx * 0.2, gy * 0.2) - 0.5;
      // the four neighbours decide which walls exist at all
      const hS = TIER_H[tierAt(gx, gy + 1)] || 0, hE = TIER_H[tierAt(gx + 1, gy)] || 0;
      const hN = TIER_H[tierAt(gx, gy - 1)] || 0, hWn = TIER_H[tierAt(gx - 1, gy)] || 0;
      // distance fog, toward the sky the world sits under
      const fog = Math.min(0.8, Math.max(0, (foot.d - 340) / 380));
      list.push({
        d: foot.d > 0 ? foot.d : mid.d,
        f: () => {
          const g = list.g;
          const quad = (p0, p1, p2, p3, k) => {
            g.fillStyle = litFace(base, k, SUN, AMB, j * 0.26);
            g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.fill();
          };
          // walls, then the cap on top of them
          if (h > hS) { const e2 = P.project(wx, wy + CELL, hS), c2 = P.project(wx + CELL, wy + CELL, hS); if (e2.d > 0 && c2.d > 0) quad(e, c, c2, e2, 0.5); }
          if (h > hE) { const b2 = P.project(wx + CELL, wy, hE), c2 = P.project(wx + CELL, wy + CELL, hE); if (b2.d > 0 && c2.d > 0) quad(b, c, c2, b2, 0.72); }
          if (h > hN) { const a2 = P.project(wx, wy, hN), b2 = P.project(wx + CELL, wy, hN); if (a2.d > 0 && b2.d > 0) quad(a, b, b2, a2, 0.86); }
          if (h > hWn) { const a2 = P.project(wx, wy, hWn), e2 = P.project(wx, wy + CELL, hWn); if (a2.d > 0 && e2.d > 0) quad(a, e, e2, a2, 0.62); }
          quad(a, b, c, e, 1.08);

          /* ── the emissive pass ──
             A road that is only a darker colour disappears at night. Lit from
             its own surface, it is the brightest line in the frame and the
             player can navigate by it. */
          if (t === 3) {
            g.globalCompositeOperation = "lighter";
            g.fillStyle = `rgba(${NEON},${(0.16 * (1 - fog)).toFixed(3)})`;
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath(); g.fill();
            g.globalCompositeOperation = "source-over";
          }
          /* Trim along the two edges that face the camera, and only where the
             block actually steps down — an outline on flat ground turns the
             terrain back into the grid of rectangles it is trying not to be. */
          const lit = (h > hS ? 1 : 0) + (h > hE ? 1 : 0);
          if (lit) {
            const al = (0.85 - fog * 0.55).toFixed(3);
            g.lineCap = "round"; g.lineJoin = "round";
            g.strokeStyle = `rgba(${NEON},${(al * 0.34).toFixed(3)})`;
            g.lineWidth = 5;
            g.beginPath();
            if (h > hS) { g.moveTo(e.x, e.y); g.lineTo(c.x, c.y); }
            if (h > hE) { g.moveTo(c.x, c.y); g.lineTo(b.x, b.y); }
            g.stroke();
            g.strokeStyle = `rgba(${NEON},${al})`;
            g.lineWidth = 1.7;
            g.stroke();
          }
          /* Windows. Two rows of two on each visible wall of a tall block,
             most of them dark, decided by a hash of the cell so the same
             tower is lit the same way every frame and from every angle. */
          if (t === 4 && Math.abs(c.x - e.x) > 13 && fog < 0.62) {
            const face = (p0, p1, p2, p3, key) => {
              const mix = (A, B, u) => ({ x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u });
              const at = (u, v) => mix(mix(p0, p1, u), mix(p3, p2, u), v);
              for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
                const hh = hash32(seed + key + gx * 131 + gy * 7 + r * 3 + q);
                if (hh % 100 > 42) continue;                 // most windows are dark
                const u0 = 0.13 + q * 0.27, v0 = 0.14 + r * 0.26;
                const w0 = at(u0, v0), w1 = at(u0 + 0.17, v0), w2 = at(u0 + 0.17, v0 + 0.13), w3 = at(u0, v0 + 0.13);
                g.fillStyle = `rgba(${(hh >>> 9) % 4 ? WIN : NEON},${(0.5 - fog * 0.42).toFixed(3)})`;
                g.beginPath(); g.moveTo(w0.x, w0.y); g.lineTo(w1.x, w1.y); g.lineTo(w2.x, w2.y); g.lineTo(w3.x, w3.y); g.closePath(); g.fill();
              }
            };
            if (h > hS) { const e2 = P.project(wx, wy + CELL, hS), c2 = P.project(wx + CELL, wy + CELL, hS); if (e2.d > 0 && c2.d > 0) face(e, c, c2, e2, ":s"); }
            if (h > hE) { const b2 = P.project(wx + CELL, wy, hE), c2 = P.project(wx + CELL, wy + CELL, hE); if (b2.d > 0 && c2.d > 0) face(b, c, c2, b2, ":e"); }
          }
          /* the cast shadow, on the RECEIVER. The key is behind-right, so
             anything taller behind this cell drops onto it — and painting it
             from the caster would only get covered by the ground it was
             meant to land on. */
          const dh = Math.max(hN, TIER_H[tierAt(gx + 1, gy - 1)] || 0) - h;
          if (dh > 0) {
            g.fillStyle = `rgba(0,5,16,${Math.min(0.42, dh / 48 * 0.42).toFixed(3)})`;
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath(); g.fill();
          }
          if (h > hS || h > hE) {
            g.strokeStyle = "rgba(255,255,255,.1)"; g.lineWidth = 1;
            g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(c.x, c.y); g.lineTo(b.x, b.y); g.stroke();
          }
          if (fog > 0.01) {
            g.fillStyle = `rgba(${hexRgb(W.sky[1])},${fog.toFixed(3)})`;
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath(); g.fill();
          }
        },
      });
    }
  }
}

/** A flat ring on the ground, projected — decals cannot be ellipses any more. */
export function ringPath(g, P, wx, wy, r, h) {
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const q = P.project(wx + Math.cos(a) * r, wy + Math.sin(a) * r, h || 0);
    if (q.d < 0) { g.closePath(); return false; }
    if (i === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
  }
  g.closePath();
  return true;
}

function drawTerrain(g, W, geo, cam, vw, vh) {
  const seed = geo.seed;
  // the visible ground quad, from the four screen corners projected back
  const corners = [unIso(-vw / 2, -vh / 2), unIso(vw / 2, -vh / 2), unIso(-vw / 2, vh / 2), unIso(vw / 2, vh / 2)];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
  }
  // a generous skirt: tall blocks poke into frame from below the visible band
  const pad = 4;
  const cx0 = Math.floor((cam.x + minX) / CELL) - pad, cx1 = Math.ceil((cam.x + maxX) / CELL) + pad;
  const cy0 = Math.floor((cam.y + minY) / CELL) - pad, cy1 = Math.ceil((cam.y + maxY) / CELL) + pad;

  const tierAt = (gx, gy) => terrainAt(seed, gx * CELL + CELL / 2, gy * CELL + CELL / 2);
  const scr = (wx, wy, h) => {
    const q = iso(wx - cam.x, wy - cam.y, h);
    return { x: q.x + vw / 2, y: q.y + vh / 2 };
  };

  /* Back to front. In this projection depth is simply wx+wy, so walking the
     grid diagonally IS painter's order — no sort, no z-buffer. */
  for (let d = cx0 + cy0; d <= cx1 + cy1; d++) {
    for (let gx = cx0; gx <= cx1; gx++) {
      const gy = d - gx;
      if (gy < cy0 || gy > cy1) continue;
      const t = tierAt(gx, gy);
      if (t === 0) continue;                       // a hole: the sky shows through
      const h = TIER_H[t];
      const wx = gx * CELL, wy = gy * CELL;
      const a = scr(wx, wy, h), b = scr(wx + CELL, wy, h);
      const c = scr(wx + CELL, wy + CELL, h), e = scr(wx, wy + CELL, h);
      if (c.x < -CELL * 3 || a.x > vw + CELL * 3 || c.y < -CELL * 4 || a.y > vh + CELL * 6) continue;

      const base = t === 4 ? W.rock : t === 3 ? W.path : t === 1 ? W.grass : W.ground;
      // grain, sampled wider than a cell so neighbours differ only slightly
      const j = fbm(seed ^ 0x51ed, gx * 0.2, gy * 0.2) - 0.5;
      const lift = 1 + j * 0.3;

      // ── walls, drawn first so the top face sits on them ──
      const hS = TIER_H[tierAt(gx, gy + 1)] || 0;      // the cell in front-left
      const hE = TIER_H[tierAt(gx + 1, gy)] || 0;      // the cell in front-right
      if (h > hS) {
        const e2 = scr(wx, wy + CELL, hS), c2 = scr(wx + CELL, wy + CELL, hS);
        g.fillStyle = shade(base, 0.52 * lift);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(c.x, c.y); g.lineTo(c2.x, c2.y); g.lineTo(e2.x, e2.y); g.closePath(); g.fill();
      }
      if (h > hE) {
        const b2 = scr(wx + CELL, wy, hE), c2 = scr(wx + CELL, wy + CELL, hE);
        g.fillStyle = shade(base, 0.72 * lift);
        g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(c2.x, c2.y); g.lineTo(b2.x, b2.y); g.closePath(); g.fill();
      }

      // ── top face ──
      g.fillStyle = shade(base, 1.06 * lift);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath(); g.fill();

      /* ── cast shadow ──
         The key comes from behind-right, so anything taller behind this cell
         drops its shadow onto it. Painted while drawing the RECEIVER rather
         than the caster, because back-to-front order means a shadow drawn
         from the caster would be painted straight over by the ground it was
         supposed to land on. One lookup, no second pass, and it is the single
         thing that makes a field of blocks read as lit from somewhere. */
      const hB = Math.max(TIER_H[tierAt(gx, gy - 1)] || 0, TIER_H[tierAt(gx + 1, gy - 1)] || 0);
      const dh = hB - h;
      if (dh > 0) {
        g.fillStyle = `rgba(0,5,16,${Math.min(0.44, dh / 48 * 0.44).toFixed(3)})`;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath(); g.fill();
      }
      // a hairline along the lit edge stops a field of blocks reading as mush
      if (h > hS || h > hE) {
        g.strokeStyle = "rgba(255,255,255,.09)"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(c.x, c.y); g.lineTo(b.x, b.y); g.stroke();
      }

      /* ── scatter, standing ON the block ──
         Boulders and shards are placed on the cell's own top face and lifted
         to its elevation, so nothing floats over a cliff or sinks into one. */
      const r = (hash32(gx + ":" + gy + ":" + seed) % 1000) / 1000;
      if ((t === 2 || t === 3) && (r < 0.07 || r > 0.982)) {
        const ox = wx + ((hash32("a" + gx + gy) % 100) / 100) * CELL;
        const oy = wy + ((hash32("b" + gx + gy) % 100) / 100) * CELL;
        const p0 = scr(ox, oy, h);
        if (r < 0.07) {
          const rr = 5 + r * 90;
          const top = scr(ox, oy, h + rr * 0.7);
          g.fillStyle = "rgba(0,4,12,.34)";
          g.beginPath(); g.ellipse(p0.x, p0.y, rr * 1.05, rr * 0.5, 0, 0, 6.284); g.fill();
          g.fillStyle = shade(base, 0.78);
          g.beginPath(); g.ellipse(p0.x, p0.y - rr * 0.32, rr * 0.92, rr * 0.72, 0, 0, 6.284); g.fill();
          g.fillStyle = shade(base, 1.5);
          g.beginPath(); g.ellipse(top.x, top.y + rr * 0.28, rr * 0.66, rr * 0.34, 0, 0, 6.284); g.fill();
        } else {
          const top = scr(ox, oy, h + 26);
          g.fillStyle = "rgba(0,4,12,.3)";
          g.beginPath(); g.ellipse(p0.x, p0.y, 10, 5, 0, 0, 6.284); g.fill();
          g.fillStyle = W.glow + "3a";
          g.beginPath(); g.arc(top.x, top.y + 6, 15, 0, 6.284); g.fill();
          g.fillStyle = W.glow;
          g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(top.x + 6, top.y + 13); g.lineTo(p0.x, p0.y); g.lineTo(top.x - 6, top.y + 13); g.closePath(); g.fill();
          g.fillStyle = "rgba(255,255,255,.65)";
          g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(top.x + 2.4, top.y + 11); g.lineTo(top.x, top.y + 15); g.closePath(); g.fill();
        }
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

/** Monsters. At map scale a creature is about 30px tall, so nothing survives
    except the SILHOUETTE — the outline, the number of spikes on top, and how
    many eyes are burning. Those three are exactly what the species table
    carries, so the thing you meet on the road already looks like the thing
    you are about to fight. */
const MOB_SIL = {
  blob:     [[0, -16], [11, -6], [12, 4], [7, 12], [-7, 12], [-12, 4], [-11, -6]],
  chunk:    [[-9, -15], [9, -15], [12, -2], [11, 12], [-11, 12], [-12, -2]],
  drop:     [[0, -18], [9, -4], [11, 6], [5, 13], [-5, 13], [-11, 6], [-9, -4]],
  beast:    [[0, -15], [7, -9], [15, 0], [16, 9], [8, 13], [-8, 13], [-16, 9], [-15, 0], [-7, -9]],
  hulk:     [[0, -16], [9, -11], [16, -3], [14, 6], [7, 9], [6, 13], [-6, 13], [-7, 9], [-14, 6], [-16, -3], [-9, -11]],
  serpent:  [[0, -19], [6, -11], [5, -2], [3, 6], [14, 13], [-14, 13], [-3, 6], [-5, -2], [-6, -11]],
  carapace: [[0, -12], [12, -7], [17, 2], [12, 10], [-12, 10], [-17, 2], [-12, -7]],
};
/* how many spikes a crest puts on the skyline, and how far they lean out */
const MOB_CREST = {
  ant: [2, 9, 0.9], stack: [3, 6, 0.35], spire: [3, 8, 0.5], horn: [2, 9, 1.15],
  antler: [2, 12, 1.0], bull: [2, 8, 1.5], trihorn: [3, 10, 0.75], crown: [3, 9, 0.55],
  plate: [0, 0, 0], halo: [-1, 0, 0], mane: [7, 8, 1.3], frill: [5, 11, 1.25],
};
function drawMob(g, x, y, s, col, t, hurt, sp) {
  const R = sp ? foeById(sp) : null;
  const sil = MOB_SIL[(R && R.body) || "blob"] || MOB_SIL.blob;
  const bob = Math.sin(t * 4) * 2.4 * s;
  const spin = t * 1.6;
  g.save();
  g.translate(x, y + bob);
  g.fillStyle = "rgba(0,4,12,.42)";
  g.beginPath(); g.ellipse(0, 14 * s - bob, 14 * s, 4.8 * s, 0, 0, 6.284); g.fill();

  // ── tail, behind everything ──
  const tail = R && R.tail;
  if (tail && tail !== "none") {
    g.strokeStyle = hurt ? "#ffffff" : col;
    g.lineCap = "round";
    if (tail === "sting") {
      g.lineWidth = 3 * s;
      g.beginPath(); g.moveTo(9 * s, 10 * s); g.quadraticCurveTo(22 * s, -2 * s, 12 * s, -20 * s); g.stroke();
      g.fillStyle = "#ff7a6a";
      g.beginPath(); g.moveTo(12 * s, -20 * s); g.lineTo(5 * s, -25 * s); g.lineTo(14 * s, -14 * s); g.fill();
    } else if (tail === "plume") {
      g.lineWidth = 2.4 * s;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = 0.9 - i * 0.22;
        g.beginPath(); g.moveTo(9 * s, 9 * s);
        g.quadraticCurveTo((22 + i * 2) * s, (-2 - i * 3) * s, (14 - i * 4) * s, (-16 - i * 3) * s);
        g.stroke();
      }
      g.globalAlpha = 1;
    } else if (tail === "fluke") {
      g.lineWidth = 3.4 * s;
      g.beginPath(); g.moveTo(8 * s, 10 * s); g.quadraticCurveTo(19 * s, 6 * s, 20 * s, -4 * s); g.stroke();
      g.fillStyle = hurt ? "#ffffff" : col;
      g.beginPath();
      g.moveTo(20 * s, -4 * s); g.lineTo(13 * s, -13 * s); g.lineTo(17 * s, -2 * s);
      g.lineTo(11 * s, 6 * s); g.closePath(); g.fill();
    } else if (tail === "coil") {
      g.lineWidth = 4 * s;
      g.beginPath(); g.moveTo(7 * s, 11 * s);
      g.bezierCurveTo(22 * s, 10 * s, 23 * s, -2 * s, 14 * s, -3 * s);
      g.stroke();
    } else {                                                        // whip
      g.lineWidth = 2.6 * s;
      g.beginPath(); g.moveTo(8 * s, 10 * s); g.quadraticCurveTo(21 * s, 4 * s, 17 * s, -9 * s); g.stroke();
    }
  }

  // ── legs, under the shell ──
  const legs = (R && R.legs) || "stub";
  g.fillStyle = "#232b3e";
  g.strokeStyle = "#232b3e"; g.lineCap = "round";
  if (legs === "many") {
    g.lineWidth = 1.7 * s;
    for (let k = -1; k <= 1; k += 2) for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(k * (4 + i * 3) * s, 4 * s);
      g.lineTo(k * (13 + i * 4) * s, (-1 + i * 3) * s);
      g.lineTo(k * (11 + i * 5) * s, 15 * s);
      g.stroke();
    }
  } else if (legs === "tentacle") {
    g.lineWidth = 2.6 * s;
    for (let j = -2; j <= 2; j++) {
      g.beginPath(); g.moveTo(j * 4 * s, 6 * s);
      g.quadraticCurveTo(j * 8 * s, 12 * s, j * 9 * s, 16 * s); g.stroke();
    }
  } else if (legs === "coil") {
    g.beginPath(); g.ellipse(0, 12 * s, 15 * s, 5 * s, 0, 0, 6.284); g.fill();
  } else if (legs === "float") {
    g.strokeStyle = hurt ? "#ffffff" : col; g.globalAlpha = 0.5;
    for (let i = 0; i < 2; i++) {
      g.lineWidth = 1.6 * s;
      g.beginPath(); g.ellipse(0, (12 + i * 3) * s, (10 - i * 3) * s, (3 - i * 0.8) * s, 0, 0, 6.284); g.stroke();
    }
    g.globalAlpha = 1;
  } else if (legs === "hoof" || legs === "talon") {
    g.lineWidth = 2.6 * s;
    const set = legs === "hoof" ? [-8, -3.5, 3.5, 8] : [-6, 6];
    for (const lx of set) {
      g.beginPath(); g.moveTo(lx * s, 7 * s); g.lineTo(lx * 1.2 * s, 16 * s); g.stroke();
    }
    g.fillStyle = "#cdd9ee";
    for (const lx of set) {
      g.beginPath(); g.roundRect(lx * 1.2 * s - 2.4 * s, 14 * s, 4.8 * s, 3 * s, 1 * s); g.fill();
    }
  } else {                                                          // stub / roll
    g.beginPath(); g.roundRect(-7.5 * s, 8 * s, 4.4 * s, 8 * s, 1.6 * s); g.fill();
    g.beginPath(); g.roundRect(3.1 * s, 8 * s, 4.4 * s, 8 * s, 1.6 * s); g.fill();
  }

  // ── the shell ──
  if (hurt) { g.shadowColor = "#ffffff"; g.shadowBlur = 22; }
  const grd = g.createLinearGradient(-12 * s, -14 * s, 10 * s, 12 * s);
  grd.addColorStop(0, hurt ? "#ffffff" : "#dbe4f4");
  grd.addColorStop(0.42, hurt ? "#ffd0d0" : col);
  grd.addColorStop(1, "#10162a");
  g.fillStyle = grd;
  g.beginPath();
  sil.forEach((P, i) => (i ? g.lineTo(P[0] * s, P[1] * s) : g.moveTo(P[0] * s, P[1] * s)));
  g.closePath(); g.fill();
  g.shadowBlur = 0;

  // plate seams across the shell
  g.strokeStyle = "rgba(0,6,15,.34)"; g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(-10.6 * s, 1 * s); g.lineTo(10.6 * s, 1 * s);
  g.moveTo(-9.7 * s, 6.5 * s); g.lineTo(9.7 * s, 6.5 * s);
  g.stroke();

  // ── crest: the part of a silhouette you can still read at map scale ──
  const cr = MOB_CREST[(R && R.crest) || "ant"];
  if (cr && cr[0] === -1) {                                         // halo
    g.strokeStyle = hurt ? "#ffffff" : col; g.lineWidth = 1.6 * s;
    g.beginPath(); g.ellipse(0, -21 * s, 9 * s, 2.6 * s, 0, 0, 6.284); g.stroke();
  } else if (cr && cr[0] > 0) {
    const [n, len, lean] = cr;
    const top = sil[0][1];
    g.fillStyle = hurt ? "#ffffff" : "#e2eafc";
    g.strokeStyle = hurt ? "#ffffff" : "#e2eafc"; g.lineWidth = 1.6 * s;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;                // -1..1
      const bx = u * 7 * s, by = (top + 2) * s;
      const tx = (u * 7 + u * len * lean) * s, ty = (top + 2 - len) * s;
      if ((R && R.crest) === "ant") {
        g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
        g.fillStyle = hurt ? "#ffffff" : col;
        g.beginPath(); g.arc(tx, ty, 2.2 * s, 0, 6.284); g.fill();
        g.fillStyle = "#e2eafc";
      } else {
        g.beginPath();
        g.moveTo(bx - 3 * s, by); g.lineTo(tx, ty); g.lineTo(bx + 3 * s, by);
        g.closePath(); g.fill();
      }
    }
  }

  // a lit ring that turns, so a standing monster is never a static shape
  g.save();
  g.translate(0, -2 * s); g.rotate(spin);
  g.strokeStyle = hurt ? "#ffffff" : "#ff6a6a"; g.lineWidth = 1.2 * s;
  g.globalAlpha = 0.6;
  g.beginPath(); g.arc(0, 0, 7.4 * s, 0.4, 2.2); g.stroke();
  g.beginPath(); g.arc(0, 0, 7.4 * s, 3.6, 5.4); g.stroke();
  g.restore();
  g.globalAlpha = 1;

  // ── the eyes: socket, bloom, iris, catchlight ──
  const n = (R && R.eyes) || 1;
  const er = n === 1 ? 5.2 : n === 2 ? 3.6 : n === 3 ? 2.8 : 2.2;
  const seats = [];
  if (n >= 5) {
    const a = n - Math.floor(n / 2), b = Math.floor(n / 2);
    for (let i = 0; i < a; i++) seats.push([(i - (a - 1) / 2) * 5, -5]);
    for (let i = 0; i < b; i++) seats.push([(i - (b - 1) / 2) * 5, 1]);
  } else {
    for (let i = 0; i < n; i++) seats.push([(i - (n - 1) / 2) * (n === 2 ? 5.4 : 6), -2]);
  }
  for (const [ex, ey] of seats) {
    g.fillStyle = "#080d1a";
    g.beginPath(); g.arc(ex * s, ey * s, (er + 0.9) * s, 0, 6.284); g.fill();
    g.globalAlpha = 0.6;
    g.fillStyle = hurt ? "#ffffff" : "#ff5a5a";
    g.beginPath(); g.arc(ex * s, ey * s, er * s, 0, 6.284); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = hurt ? "#ffffff" : "#ff8a8a";
    g.beginPath(); g.arc(ex * s, ey * s, er * 0.56 * s, 0, 6.284); g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc((ex - er * 0.28) * s, (ey - er * 0.32) * s, Math.max(0.6, er * 0.22) * s, 0, 6.284); g.fill();
  }

  g.strokeStyle = "rgba(226,238,255,.42)"; g.lineWidth = 1 * s;
  g.beginPath(); g.moveTo(sil[sil.length - 1][0] * s, sil[sil.length - 1][1] * s);
  g.lineTo(sil[0][0] * s, sil[0][1] * s); g.stroke();
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
/* How long the player gets to just fight before the next question lands.
   Twenty seconds is enough for a real exchange and short enough that the
   music never becomes optional. */
const QUESTION_EVERY = 20;
/* How long the foe telegraphs before it swings. Long enough to read on a
   phone, short enough that holding guard down is not a strategy. */
const TELL = 0.55;
/* [left%, top%, px, colour] — hand-placed so they read as a skyline rather
   than as confetti, and warm against the world's cool accent. */
const BOKEH = [
  [6, 22, 26, "#ffb26b"], [17, 38, 16, "#8fd0ff"], [28, 15, 34, "#ffd28a"],
  [39, 44, 14, "#9fe0ff"], [52, 24, 30, "#ffb26b"], [63, 40, 18, "#c9a7ff"],
  [72, 17, 24, "#ffd28a"], [83, 36, 32, "#8fd0ff"], [92, 21, 18, "#ffb26b"],
  [12, 52, 20, "#ffd28a"], [46, 56, 22, "#8fd0ff"], [78, 54, 16, "#ffb26b"],
];
const MOVE_KIND = {
  punch: { cd: 0.5,  reach: 0.40, mult: 0.24, fx: "punch" },
  kick:  { cd: 1.05, reach: 0.47, mult: 0.42, fx: "kick" },
};

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
        im.onload = () => {
          if (dead) return;
          /* Trim to the ink. Every model carries a different amount of empty
             space under its feet, and blitting the raw box bottom-aligned
             left the figure hovering over its own shadow — which, while
             walking, reads as a smear the robot drags along behind it. */
          try {
            const c = document.createElement("canvas");
            c.width = im.naturalWidth || 320; c.height = im.naturalHeight || 832;
            const cg = c.getContext("2d", { willReadFrequently: true });
            cg.drawImage(im, 0, 0, c.width, c.height);
            const d = cg.getImageData(0, 0, c.width, c.height).data;
            let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
            for (let y = 0; y < c.height; y++) {
              for (let x = 0; x < c.width; x++) {
                if (d[(y * c.width + x) * 4 + 3] > 8) {
                  if (x < x0) x0 = x;
                  if (x > x1) x1 = x;
                  if (y < y0) y0 = y;
                  if (y > y1) y1 = y;
                }
              }
            }
            if (x1 > x0 && y1 > y0) {
              const cut = document.createElement("canvas");
              cut.width = x1 - x0 + 1; cut.height = y1 - y0 + 1;
              cut.getContext("2d").drawImage(c, x0, y0, cut.width, cut.height, 0, 0, cut.width, cut.height);
              setImg(cut);
              return;
            }
          } catch (e) {}
          setImg(im);
        };
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
  // the sprite is trimmed to its ink, so its own aspect is the truth and its
  // bottom edge is the soles of the feet
  const w = h * ((img.width || 160) / (img.height || 416));
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

/* ══════════════════════ the title sequence ══════════════════════

   A card with a paragraph on it is a loading screen. The premise — humanity
   beat death, poured itself into machines and went out to take the sky, and
   the only thing it could not upload was the ability to govern what it felt —
   deserves an establishing shot.

   So: black, then stars, then a world rising out of frame with its atmosphere
   lit along the terminator, then the ship that is carrying you down to it,
   then the title, then the log entry typing itself out underneath. Ten
   seconds, letterboxed, skippable on any tap. Everything is drawn — no asset
   to load, and the palette comes from the world record, so every planet gets
   its own arrival rather than one generic one. */
const CinematicIntro = memo(function CinematicIntro({ W, lang, onDone }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const cvRef = useRef(null);
  const [t, setT] = useState(0);
  const doneRef = useRef(false);
  const DUR = 11.5;

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const g = cv.getContext("2d");
    let raf = 0, t0 = performance.now();
    const seed = hash32(W.seed);

    const step = (now) => {
      raf = requestAnimationFrame(step);
      const tt = (now - t0) / 1000;
      setT(tt);
      if (tt > DUR && !doneRef.current) { doneRef.current = true; onDone(); return; }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vw = cv.clientWidth, vh = cv.clientHeight;
      if (cv.width !== Math.round(vw * dpr)) { cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── deep space ──
      const sky = g.createLinearGradient(0, 0, 0, vh);
      sky.addColorStop(0, "#01020a");
      sky.addColorStop(0.55, W.sky[0]);
      sky.addColorStop(1, "#01020a");
      g.fillStyle = sky; g.fillRect(0, 0, vw, vh);

      // nebula, drifting — two soft washes, additive so they only ever lift
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) {
        const nx = vw * (0.3 + i * 0.45) + Math.sin(tt * 0.11 + i) * 40;
        const ny = vh * (0.28 + i * 0.2) + Math.cos(tt * 0.09 + i) * 26;
        const rr = Math.max(vw, vh) * (0.45 + i * 0.2);
        const ng = g.createRadialGradient(nx, ny, 0, nx, ny, rr);
        ng.addColorStop(0, `rgba(${hexRgb(i ? W.accent : W.glow)},${0.09 * Math.min(1, tt / 1.4)})`);
        ng.addColorStop(1, `rgba(${hexRgb(i ? W.accent : W.glow)},0)`);
        g.fillStyle = ng; g.fillRect(nx - rr, ny - rr, rr * 2, rr * 2);
      }
      // stars fade up over the first beat and drift for the rest
      const starA = Math.min(1, tt / 1.6);
      for (let i = 0; i < 170; i++) {
        const h = hash32("ci" + i + W.id);
        const sx = (h % 1000) / 1000 * vw;
        const sy = ((h >>> 10) % 1000) / 1000 * vh - tt * (4 + (i % 5) * 3);
        const yy = ((sy % (vh + 40)) + vh + 40) % (vh + 40) - 20;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(tt * 1.6 + i));
        const r = (i % 23 === 0) ? 1.9 : (i % 7 === 0) ? 1.2 : 0.8;
        g.fillStyle = `rgba(255,255,255,${(0.16 + (i % 5) * 0.11) * tw * starA})`;
        g.beginPath(); g.arc(sx, yy, r, 0, 6.284); g.fill();
      }
      g.globalCompositeOperation = "source-over";

      /* ── the world, rising ──
         It comes up from below the frame on an ease-out, so the shot opens on
         empty sky and fills. The atmosphere is a rim on the lit side and a
         wide falloff outside the disc; the terminator is a second sphere in
         shadow drawn over the first. */
      const rise = clamp((tt - 0.7) / 3.4, 0, 1);
      const ease = 1 - Math.pow(1 - rise, 3);
      /* Big, and close. The shot is about the size of the thing you are
         falling toward; a small disc peeking over the bottom edge reads as a
         decoration rather than as a world. */
      const pr = Math.min(vw, vh) * 1.02;
      const pcx = vw * 0.5, pcy = vh + pr * (1.05 - 0.97 * ease);
      if (rise > 0) {
        // outer atmosphere
        g.globalCompositeOperation = "lighter";
        const ag = g.createRadialGradient(pcx, pcy, pr * 0.9, pcx, pcy, pr * 1.35);
        ag.addColorStop(0, `rgba(${hexRgb(W.glow)},.32)`);
        ag.addColorStop(1, `rgba(${hexRgb(W.glow)},0)`);
        g.fillStyle = ag; g.beginPath(); g.arc(pcx, pcy, pr * 1.35, 0, 6.284); g.fill();
        g.globalCompositeOperation = "source-over";
        // the disc
        const pg = g.createRadialGradient(pcx - pr * 0.4, pcy - pr * 0.45, pr * 0.1, pcx, pcy, pr);
        pg.addColorStop(0, W.sky[2]);
        pg.addColorStop(0.5, W.sky[1]);
        pg.addColorStop(1, W.sky[0]);
        g.fillStyle = pg; g.beginPath(); g.arc(pcx, pcy, pr, 0, 6.284); g.fill();
        // surface: seeded bands, clipped to the disc
        g.save();
        g.beginPath(); g.arc(pcx, pcy, pr, 0, 6.284); g.clip();
        for (let i = 0; i < 22; i++) {
          const h = hash32("sf" + i + W.id);
          const bx = pcx - pr + ((h % 1000) / 1000) * pr * 2;
          const by = pcy - pr + (((h >>> 9) % 1000) / 1000) * pr * 2;
          const brx = pr * (0.08 + ((h >>> 3) % 100) / 420);
          g.fillStyle = (i % 3 === 0) ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.13)";
          g.beginPath(); g.ellipse(bx, by, brx * 1.7, brx * 0.55, 0.4, 0, 6.284); g.fill();
        }
        // night side
        const ng2 = g.createLinearGradient(pcx - pr * .1, pcy - pr, pcx + pr, pcy + pr * .6);
        ng2.addColorStop(0, "rgba(0,2,10,0)");
        ng2.addColorStop(0.42, "rgba(0,2,10,.28)");
        ng2.addColorStop(1, "rgba(0,2,10,.92)");
        g.fillStyle = ng2; g.fillRect(pcx - pr, pcy - pr, pr * 2, pr * 2);
        g.restore();
        // the lit rim along the terminator
        g.strokeStyle = `rgba(${hexRgb(W.glow)},.85)`;
        g.lineWidth = 2.4;
        g.beginPath(); g.arc(pcx, pcy, pr, Math.PI * 1.08, Math.PI * 1.86); g.stroke();
      }

      /* ── the ship ──
         Small on purpose. The shot is about how big the thing it is falling
         toward is, and a hero ship filling the frame would say the opposite. */
      const fly = clamp((tt - 2.1) / 4.2, 0, 1);
      if (fly > 0 && fly < 1) {
        const fx = vw * (-0.12 + fly * 1.24);
        const fy = vh * (0.42 + fly * fly * 0.14);
        g.globalCompositeOperation = "lighter";
        for (let i = 0; i < 26; i++) {
          const k = i / 26;
          g.fillStyle = `rgba(${hexRgb(W.glow)},${(1 - k) * 0.4})`;
          g.beginPath(); g.arc(fx - k * 130, fy - k * 20, (1 - k) * 3.6 + 0.4, 0, 6.284); g.fill();
        }
        g.globalCompositeOperation = "source-over";
        g.save(); g.translate(fx, fy); g.rotate(0.16);
        g.fillStyle = "#e8eefc";
        g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, 5); g.lineTo(-4, 0); g.lineTo(-7, -5); g.closePath(); g.fill();
        g.fillStyle = W.glow;
        g.beginPath(); g.arc(-5, 0, 2.2, 0, 6.284); g.fill();
        g.restore();
      }

      // ── letterbox ──
      const bar = Math.min(1, tt / 0.7) * vh * 0.085;
      g.fillStyle = "#000";
      g.fillRect(0, 0, vw, bar);
      g.fillRect(0, vh - bar, vw, bar);

      // ── the fade the scene ends on ──
      if (tt > DUR - 1) {
        g.fillStyle = `rgba(0,0,0,${clamp(tt - (DUR - 1), 0, 1)})`;
        g.fillRect(0, 0, vw, vh);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W.id]);

  const skip = () => { if (!doneRef.current) { doneRef.current = true; onDone(); } };

  // text beats ride on top as real DOM, so they stay crisp and translatable
  const showTitle = t > 3.2, showWorld = t > 5.0, showLog = t > 6.4;
  const logText = tr3(W.intro, lang);
  const typed = showLog ? logText.slice(0, Math.floor((t - 6.4) * 46)) : "";

  return createPortal((
    <div className="sscine" onClick={skip}>
      <canvas ref={cvRef} className="sscine-cv" />
      <div className="sscine-txt">
        {showTitle && <div className="sscine-title">TIGA<span>:</span> STARSONG</div>}
        {showTitle && <div className="sscine-tag">{T(
          "ในวันที่ความรู้ดาวน์โหลดได้ทุกอย่าง สิ่งเดียวที่ยังต้องฝึกเองคือการควบคุมใจตัวเอง",
          "When machines learned everything, humans had only one thing left to master.",
          "当机器学会了一切，人类只剩下一样东西要去掌握。")}</div>}
        {showWorld && (
          <div className="sscine-world">
            <b>{tr3(W.name, lang)}</b>
            <i>{tr3(W.sub, lang)}</i>
          </div>
        )}
      </div>
      {showLog && <div className="sscine-log"><span>{typed}</span></div>}
      <button className="sscine-skip" onClick={skip}>{T("ข้าม", "Skip", "跳过")} ›</button>
    </div>
  ), document.body);
});

/* ══════════════════════ the enemy ══════════════════════

   One rig rather than five bespoke drawings: a shadow, legs, a carapace, arm
   pieces, a head with one big eye, and a crest — each of which has a handful
   of shapes, picked per world. That gets five distinct silhouettes out of one
   set of parts, and a boss is the same rig with more of them and a size.

   Everything is parametric on the world palette, so a new planet's fauna is
   a data entry rather than an art commission. */
/* ── the creatures ──────────────────────────────────────────────────────
   Cyber fantasy, drawn round. The silhouette stays a mascot — soft body,
   huge glassy eyes, cheeks, a mouth — because that is what makes a foe worth
   beating twice. Everything ON that silhouette is where the genre lives: a
   translucent shell with an energy core burning through it, circuitry etched
   in light, a rim light peeling the figure off the background, a
   holographic sheen crawling across the surface, and shards and runes in
   orbit around the whole thing.

   Nothing here reads `t`. Every moving part is a CSS keyframe, so the
   creature animates in the compositor and React re-renders it only when it
   actually changes — which is what buys the detail. */
/* ── the bestiary ──────────────────────────────────────────────────────
   Twenty-two creatures rather than one per planet. Every one is assembled
   from the same parts kit — body, legs, arms, crest, tail, face — so adding
   a species costs a row, not a drawing, and the world's own accent still
   colours it so a Ferros beast still reads as Ferros.

   The kit is deliberately mythological: horns, frills, antlers, manes, coils
   and pincers, on kaiju silhouettes. `w` is which worlds it roams. */
const FOES = [
  // ── Terra Nova · drilled, disciplined, machine-shaped ──
  { id: "drill",  w: ["terra"], body: "blob",  legs: "stub",  arms: "mitt",  crest: "ant",   tail: "none",  eyes: 2, face: "smile", cheek: 1, rune: "◈",
    n: { th: "โดรนฝึกซ้อม", en: "Drill Drone", zh: "训练无人机" } },
  { id: "kirin",  w: ["terra"], body: "beast", legs: "hoof",  arms: "none",  crest: "antler", tail: "plume", eyes: 2, face: "smile", cheek: 1, rune: "✦",
    n: { th: "กิเลนสายฟ้า", en: "Voltkirin", zh: "雷麒麟" } },
  { id: "gryph",  w: ["terra"], body: "beast", legs: "talon", arms: "wing",  crest: "mane",  tail: "plume", eyes: 2, face: "beak",  cheek: 0, rune: "⟁",
    n: { th: "กริฟฟินเหล็ก", en: "Ferrogryph", zh: "铁鹰狮" } },
  { id: "golem",  w: ["terra"], body: "hulk",  legs: "stub",  arms: "paw",   crest: "plate", tail: "none",  eyes: 1, face: "grin",  cheek: 0, rune: "⬢",
    n: { th: "โกเลมคอนกรีต", en: "Concrete Golem", zh: "混凝土魔像" } },

  // ── Ferros-9 · heavy, industrial, three gravities ──
  { id: "hauler", w: ["ferros"], body: "chunk", legs: "roll",  arms: "paw",   crest: "stack", tail: "none",  eyes: 2, face: "grin",  cheek: 1, rune: "⬢",
    n: { th: "ตัวลากแร่", en: "Ore Hauler", zh: "运矿兽" } },
  { id: "scarab", w: ["ferros"], body: "carapace", legs: "many", arms: "pincer", crest: "horn", tail: "sting", eyes: 4, face: "fang", cheek: 0, rune: "⟁",
    n: { th: "ด้วงหลอมเหล็ก", en: "Smelt Scarab", zh: "熔铁甲虫" } },
  { id: "wyrm",   w: ["ferros"], body: "serpent", legs: "coil", arms: "none",  crest: "frill", tail: "coil",  eyes: 2, face: "fang",  cheek: 0, rune: "✧",
    n: { th: "มังกรไร้ขา", en: "Magma Wyrm", zh: "熔岩蠕龙" } },
  { id: "minot",  w: ["ferros"], body: "hulk",  legs: "hoof",  arms: "paw",   crest: "bull",  tail: "whip",  eyes: 2, face: "fang",  cheek: 0, rune: "⬡",
    n: { th: "มิโนทอร์เตาหลอม", en: "Forge Minotaur", zh: "熔炉牛魔" } },
  { id: "phoenx", w: ["ferros"], body: "beast", legs: "talon", arms: "wing",  crest: "crown", tail: "plume", eyes: 2, face: "beak",  cheek: 0, rune: "✦",
    n: { th: "หงส์ไฟ", en: "Cinder Phoenix", zh: "余烬凤凰" } },

  // ── Glacius · crystalline, floating, quiet ──
  { id: "shard",  w: ["glacius"], body: "drop",  legs: "float", arms: "fin",   crest: "spire", tail: "none",  eyes: 3, face: "oh",    cheek: 1, rune: "❋",
    n: { th: "ผลึกลอยฟ้า", en: "Drift Shard", zh: "浮空晶" } },
  { id: "leviat", w: ["glacius"], body: "serpent", legs: "float", arms: "fin", crest: "frill", tail: "fluke", eyes: 2, face: "oh",   cheek: 0, rune: "≋",
    n: { th: "เลวีอาธานน้ำแข็ง", en: "Glacial Leviathan", zh: "冰海巨兽" } },
  { id: "yeti",   w: ["glacius"], body: "hulk",  legs: "stub",  arms: "paw",   crest: "mane",  tail: "none",  eyes: 2, face: "grin",  cheek: 1, rune: "❋",
    n: { th: "เยติหิมะขาว", en: "Rime Yeti", zh: "霜雪雪人" } },
  { id: "kraken", w: ["glacius"], body: "blob",  legs: "tentacle", arms: "tentacle", crest: "none", tail: "none", eyes: 5, face: "oh", cheek: 0, rune: "≋",
    n: { th: "คราเคนใต้น้ำแข็ง", en: "Underice Kraken", zh: "冰下海妖" } },

  // ── Emberfall · volcanic, predatory ──
  { id: "enforc", w: ["emberfall"], body: "chunk", legs: "stub", arms: "paw",  crest: "horn",  tail: "none",  eyes: 2, face: "fang",  cheek: 1, rune: "⟁",
    n: { th: "หน่วยบังคับใช้", en: "Enforcement Unit", zh: "执法单元" } },
  { id: "chimer", w: ["emberfall"], body: "beast", legs: "hoof", arms: "none", crest: "trihorn", tail: "sting", eyes: 3, face: "fang", cheek: 0, rune: "⬡",
    n: { th: "ไคเมร่าเถ้าถ่าน", en: "Ash Chimera", zh: "灰烬奇美拉" } },
  { id: "cerber", w: ["emberfall"], body: "beast", legs: "talon", arms: "none", crest: "mane", tail: "whip",  eyes: 6, face: "fang",  cheek: 0, rune: "⬢",
    n: { th: "เซอร์เบอรัสสามเศียร", en: "Cerberus Trine", zh: "三首刻耳柏洛斯" } },
  { id: "basil",  w: ["emberfall"], body: "serpent", legs: "coil", arms: "none", crest: "crown", tail: "coil", eyes: 2, face: "fang", cheek: 0, rune: "✧",
    n: { th: "บาซิลิสก์", en: "Cinder Basilisk", zh: "余烬蛇怪" } },
  { id: "titan",  w: ["emberfall", "starsong"], body: "hulk", legs: "hoof", arms: "paw", crest: "plate", tail: "none", eyes: 1, face: "grin", cheek: 0, rune: "⬢",
    n: { th: "ไททันเปลือกโลก", en: "Crust Titan", zh: "地壳泰坦" } },

  // ── Starsong · celestial, wrong, beautiful ──
  { id: "seraph", w: ["starsong"], body: "drop",  legs: "float", arms: "wing",  crest: "halo",  tail: "none",  eyes: 4, face: "smile", cheek: 0, rune: "✦",
    n: { th: "เซราฟิมไร้เสียง", en: "Silent Seraph", zh: "静默炽天使" } },
  { id: "hydra",  w: ["starsong"], body: "serpent", legs: "coil", arms: "none", crest: "trihorn", tail: "coil", eyes: 6, face: "fang", cheek: 0, rune: "✧",
    n: { th: "ไฮดราดวงดาว", en: "Star Hydra", zh: "星辰九头蛇" } },
  { id: "sphinx", w: ["starsong"], body: "beast", legs: "talon", arms: "wing", crest: "crown", tail: "plume", eyes: 2, face: "smile", cheek: 0, rune: "◈",
    n: { th: "สฟิงซ์แห่งบทเพลง", en: "Sphinx of Song", zh: "歌之斯芬克斯" } },
  { id: "voidmw", w: ["starsong"], body: "carapace", legs: "many", arms: "pincer", crest: "frill", tail: "sting", eyes: 5, face: "oh", cheek: 0, rune: "≋",
    n: { th: "หนอนสุญญากาศ", en: "Void Maw", zh: "虚空噬口" } },
];
export const foesOf = (worldId) => FOES.filter(f => f.w.includes(worldId));
export const foeById = (id) => FOES.find(f => f.id === id) || FOES[0];
export const foeName = (id, lang) => {
  const n = foeById(id).n;
  return lang === "th" ? n.th : lang === "zh" ? n.zh : n.en;
};
/* Each world's boss wears the biggest body in its own pool. The boss keeps
   its own name and health from the world record; only the shape comes from
   here, so nothing about the fight changes. */
const BOSS_SP = { terra: "golem", ferros: "phoenx", glacius: "leviat", emberfall: "titan", starsong: "voidmw" };

const FOE_RIG = {
  terra:     { body: "blob",  legs: "stub",  arms: "mitt", crest: "ant",   eyes: 2, face: "smile", cheek: 1, rune: "◈" },
  ferros:    { body: "chunk", legs: "roll",  arms: "paw",  crest: "stack", eyes: 2, face: "grin",  cheek: 1, rune: "⬢" },
  glacius:   { body: "drop",  legs: "float", arms: "fin",  crest: "spire", eyes: 3, face: "oh",    cheek: 1, rune: "❋" },
  emberfall: { body: "chunk", legs: "stub",  arms: "paw",  crest: "horn",  eyes: 2, face: "fang",  cheek: 1, rune: "⟁" },
  starsong:  { body: "drop",  legs: "float", arms: "wing", crest: "halo",  eyes: 4, face: "smile", cheek: 0, rune: "✦" },
};

const FOE_BODY = {
  blob:  "M100 24 C147 24 173 61 173 107 C173 149 142 173 100 173 C58 173 27 149 27 107 C27 61 53 24 100 24 Z",
  chunk: "M100 26 C145 26 171 53 171 97 L171 131 C171 159 145 175 100 175 C55 175 29 159 29 131 L29 97 C29 53 55 26 100 26 Z",
  drop:  "M100 22 C118 22 133 40 148 62 C164 85 172 100 172 121 C172 155 140 176 100 176 C60 176 28 155 28 121 C28 100 36 85 52 62 C67 40 82 22 100 22 Z",
  // a big cat's chest: low, wide, weight forward
  beast: "M100 26 C124 26 139 44 141 66 C163 80 180 106 180 138 C180 166 146 180 100 180 C54 180 20 166 20 138 C20 106 37 80 59 66 C61 44 76 26 100 26 Z",
  // shoulders first, and everything else hanging off them
  hulk:  "M100 20 C126 20 143 33 149 54 C172 62 181 80 179 102 C177 124 162 137 145 142 C143 165 126 180 100 180 C74 180 57 165 55 142 C38 137 23 124 21 102 C19 80 28 62 51 54 C57 33 74 20 100 20 Z",
  // a body that is mostly neck, sitting on its own coil
  serpent: "M100 8 C125 8 138 29 136 56 C134 84 116 98 112 124 C108 152 134 168 162 178 L38 178 C66 168 92 152 88 124 C84 98 66 84 64 56 C62 29 75 8 100 8 Z",
  // a segmented shell, wider than it is tall
  carapace: "M100 42 C144 42 184 66 184 106 C184 144 146 168 100 168 C54 168 16 144 16 106 C16 66 56 42 100 42 Z",
};

/* the etched circuitry, per body — traced so it follows the shell rather
   than sitting on top of it like a decal */
const FOE_TRACE = {
  blob:  "M32 100 H58 L70 86 M130 86 L142 100 H168 M44 138 H72 M128 138 H156 M100 24 V40",
  chunk: "M28 96 H56 L68 82 M132 82 L144 96 H172 M40 142 H72 M128 142 H160 M100 26 V40",
  drop:  "M30 112 H56 L68 98 M132 98 L144 112 H170 M46 146 H76 M124 146 H154 M100 30 V46",
  beast: "M24 132 H52 L64 118 M136 118 L148 132 H176 M40 164 H74 M126 164 H160 M100 26 V44 M62 72 H138",
  hulk:  "M24 96 H54 L66 82 M134 82 L146 96 H176 M58 150 H86 M114 150 H142 M100 20 V36 M54 58 H146",
  serpent: "M66 68 H88 M112 68 H134 M70 102 H92 M108 102 H130 M100 8 V28 M46 168 H154 M60 148 H140",
  carapace: "M20 92 H180 M24 118 H176 M38 144 H162 M100 42 V60 M60 60 H140",
};

export const MonsterArt = memo(function MonsterArt({ world, foe, boss, hurt }) {
  const W = worldById(world);
  /* The species carries the body plan; the WORLD still carries the palette, so
     a Ferros beast reads as Ferros whatever shape it happens to be. */
  const R = foe ? foeById(foe) : (FOE_RIG[world] || FOE_RIG.terra);
  const uid = "fo" + (foe || world) + (boss ? "b" : "");
  const C = W.accent, G = W.glow, D = "#0a1020";
  const eye = hurt ? "#ffffff" : boss ? "#ff3d3d" : "#ff7a6a";
  const K = boss ? 1.14 : 1;
  const body = FOE_BODY[R.body] || FOE_BODY.blob;
  const trace = FOE_TRACE[R.body] || FOE_TRACE.blob;
  const orbit = boss ? 6 : 3;

  return (
    <svg viewBox="0 -12 200 222" width="100%" height="100%" aria-hidden="true"
      className={`foart${boss ? " boss" : ""}${hurt ? " hurt" : ""}`}
      style={{ "--fg": G, "--fc": C, "--fe": eye }}>
      <defs>
        {/* the shell: lit from above and in front, with the world's accent
            carrying the middle and almost no black — a body that goes to
            black at the edge reads as plastic, not as something lit */}
        <radialGradient id={uid + "-sh"} cx="0.36" cy="0.2" r="0.95">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="18%" stopColor="#eaf3ff" />
          <stop offset="46%" stopColor={C} />
          <stop offset="82%" stopColor="#2b3550" />
          <stop offset="100%" stopColor="#151d30" />
        </radialGradient>
        {/* the core burning through the shell from inside */}
        <radialGradient id={uid + "-core"} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="26%" stopColor={G} stopOpacity=".8" />
          <stop offset="62%" stopColor={C} stopOpacity=".35" />
          <stop offset="100%" stopColor={C} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={uid + "-lm"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe6fa" />
          <stop offset="100%" stopColor="#39456180" />
        </linearGradient>
        <radialGradient id={uid + "-ey"} cx="0.44" cy="0.36" r="0.76">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="22%" stopColor={eye} />
          <stop offset="78%" stopColor="#8d1a22" />
          <stop offset="100%" stopColor="#3a0810" />
        </radialGradient>
        {/* A rim light is a light SOURCE, not an outline. It falls off across
            the body, and the cool bounce comes back off the floor on the
            opposite corner — the two strokes that stop a filled shape
            reading as a sticker. */}
        <linearGradient id={uid + "-rim"} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="16%" stopColor={G} stopOpacity=".9" />
          <stop offset="46%" stopColor={G} stopOpacity=".22" />
          <stop offset="100%" stopColor={G} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={uid + "-bnc"} x1="1" y1="1" x2="0.25" y2="0.15">
          <stop offset="0%" stopColor="#9fd8ff" stopOpacity=".7" />
          <stop offset="34%" stopColor="#9fd8ff" stopOpacity=".1" />
          <stop offset="100%" stopColor="#9fd8ff" stopOpacity="0" />
        </linearGradient>
        {/* the sheen that crawls across the shell */}
        <linearGradient id={uid + "-shn"} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="40%" stopColor="#bfe6ff" stopOpacity=".2" />
          <stop offset="52%" stopColor="#ffffff" stopOpacity=".34" />
          <stop offset="64%" stopColor="#ffc7f2" stopOpacity=".18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* hull panelling, so the shell has a surface rather than a fill */}
        <pattern id={uid + "-hex"} width="17" height="29.5" patternUnits="userSpaceOnUse" patternTransform="scale(.86)">
          <path d="M8.5 0 L17 5 V15 L8.5 20 L0 15 V5 Z" fill="none" stroke="#ffffff" strokeOpacity=".1" strokeWidth=".9" />
          <path d="M8.5 29.5 L17 24.5 M8.5 29.5 L0 24.5" fill="none" stroke="#ffffff" strokeOpacity=".07" strokeWidth=".9" />
        </pattern>
        <filter id={uid + "-bloom"} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={uid + "-soft"} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <clipPath id={uid + "-clip"}><path d={body} /></clipPath>
      </defs>

      {/* ── the pad it stands on ── */}
      <ellipse cx="100" cy="196" rx={boss ? 68 : 48} ry={boss ? 15 : 11} fill="#00040c" opacity=".5" />
      <g className="fo-pad">
        <ellipse cx="100" cy="194" rx={boss ? 74 : 54} ry={boss ? 17 : 12} fill="none" stroke={G} strokeWidth="1.6" opacity=".5" />
        {[0, 1, 2].map(i => (
          <ellipse key={i} className="fo-ring" style={{ animationDelay: `${i * 1.1}s` }}
            cx="100" cy="194" rx={boss ? 74 : 54} ry={boss ? 17 : 12}
            fill="none" stroke={boss ? eye : G} strokeWidth="2" />
        ))}
        {/* six anchor ticks — the pad reads as machined rather than drawn */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const a = (i / 6) * Math.PI * 2, rx = boss ? 74 : 54, ry = boss ? 17 : 12;
          return <circle key={i} cx={100 + Math.cos(a) * rx} cy={194 + Math.sin(a) * ry} r="1.9" fill={G} opacity=".75" />;
        })}
      </g>

      {/* ── orbiting shards and runes ── */}
      <g className="fo-orbit">
        {Array.from({ length: orbit }).map((_, i) => {
          const a = (i / orbit) * Math.PI * 2;
          const x = 100 + Math.cos(a) * 72, y = 106 + Math.sin(a) * 25;
          return (
            <g key={i} className="fo-shard" style={{ animationDelay: `${i * 0.45}s` }}>
              <path d={`M${x} ${y - 12} L${x + 8} ${y} L${x} ${y + 12} L${x - 8} ${y} Z`}
                fill={G} opacity=".95" filter={`url(#${uid}-bloom)`} />
              <path d={`M${x} ${y - 12} L${x + 8} ${y} L${x} ${y + 12} L${x - 8} ${y} Z`}
                fill="none" stroke="#ffffff" strokeWidth="1.1" opacity=".8" />
            </g>
          );
        })}
      </g>
      <g className="fo-orbit rev">
        {[0, 1].map(i => {
          const a = i * Math.PI + 0.6;
          return (
            <text key={i} className="fo-rune" style={{ animationDelay: `${i * 0.9}s` }}
              x={100 + Math.cos(a) * 84} y={94 + Math.sin(a) * 18}
              fontSize="21" textAnchor="middle" fill={G} opacity=".95">{R.rune}</text>
          );
        })}
      </g>

      <g className="fo-bob" transform={`translate(100 0) scale(${K}) translate(-100 0)`}>
        {/* ── the parts that live BEHIND the body ──
            A tail drawn over the shell reads as a strap; a frill drawn over
            the head hides the face. Both go down first, then get covered. */}
        {R.tail === "plume" && (
          <g className="fo-tail">
            {/* the fan sweeps into the empty upper-right, which is the only
                corner every body plan leaves free — a tail routed anywhere
                else disappears behind the shell */}
            {[0, 1, 2, 3].map(i => {
              const d = `M148 158 C${180 + i * 4} ${150 - i * 6} ${196 - i * 3} ${104 - i * 12} ${174 - i * 17} ${44 - i * 10}`;
              return (
                <g key={i}>
                  <path d={d} fill="none" strokeLinecap="round" stroke={C}
                    strokeWidth={15 - i * 2.6} opacity=".85" />
                  <path d={d} fill="none" strokeLinecap="round" stroke={G}
                    strokeWidth={9 - i * 1.8} opacity={.95 - i * .12} filter={`url(#${uid}-bloom)`} />
                  <path d={d} fill="none" strokeLinecap="round" stroke="#ffffff"
                    strokeWidth={3 - i * 0.5} opacity={.8 - i * .16} />
                </g>
              );
            })}
            <circle cx="174" cy="44" r="5.5" fill="#ffffff" opacity=".9" filter={`url(#${uid}-bloom)`} />
          </g>
        )}
        {R.tail === "whip" && (
          <g className="fo-tail">
            <path d="M146 162 C188 158 198 108 172 62" fill="none" stroke={D} strokeWidth="15" strokeLinecap="round" />
            <path d="M146 162 C188 158 198 108 172 62" fill="none" stroke={`url(#${uid}-lm)`} strokeWidth="9.5" strokeLinecap="round" />
            <path d="M146 162 C188 158 198 108 172 62" fill="none" stroke={G} strokeWidth="2" strokeDasharray="3 12" opacity=".8" />
            <path d="M172 62 L186 32 L156 46 Z" fill={G} stroke={D} strokeWidth="1.8" strokeLinejoin="round"
              filter={`url(#${uid}-bloom)`} />
          </g>
        )}
        {R.tail === "sting" && (
          <g className="fo-tail">
            <path d="M154 162 C196 144 196 46 142 14" fill="none" stroke={D} strokeWidth="17" strokeLinecap="round" />
            <path d="M154 162 C196 144 196 46 142 14" fill="none" stroke={C} strokeWidth="12" strokeLinecap="round" />
            {/* the segment joints, got for free by dashing the same curve */}
            <path d="M154 162 C196 144 196 46 142 14" fill="none" stroke={D} strokeWidth="12"
              strokeDasharray="2 13" opacity=".6" />
            <path d="M154 162 C196 144 196 46 142 14" fill="none" stroke={G} strokeWidth="2.4"
              strokeDasharray="5 26" opacity=".9" />
            <path d="M144 18 L116 -6 L140 38 Z" fill={eye} stroke={D} strokeWidth="1.8" strokeLinejoin="round"
              filter={`url(#${uid}-bloom)`} />
            <circle className="fo-core" cx="130" cy="6" r="4.5" fill="#fff" opacity=".85" />
          </g>
        )}
        {R.tail === "coil" && (
          <g>
            {/* a loop thrown clear of the base coil, or the two read as one
                undifferentiated lump of rope */}
            <path d="M136 166 C190 164 198 112 166 96 C140 83 128 112 146 122" fill="none"
              stroke={D} strokeWidth="22" strokeLinecap="round" />
            <path d="M136 166 C190 164 198 112 166 96 C140 83 128 112 146 122" fill="none"
              stroke={`url(#${uid}-lm)`} strokeWidth="16" strokeLinecap="round" />
            <path d="M136 166 C190 164 198 112 166 96 C140 83 128 112 146 122" fill="none"
              stroke={G} strokeWidth="2.6" strokeDasharray="3 11" opacity=".8" />
          </g>
        )}
        {R.tail === "fluke" && (
          <g className="fo-tail">
            <path d="M142 164 C170 162 182 140 184 112" fill="none" stroke={D} strokeWidth="18" strokeLinecap="round" />
            <path d="M142 164 C170 162 182 140 184 112" fill="none" stroke={`url(#${uid}-lm)`} strokeWidth="12" strokeLinecap="round" />
            {/* two lobes off one stalk — the shape that says whale and not fin */}
            <path d="M184 112 C186 78 172 50 154 40 C160 62 160 84 172 100 C154 104 138 122 132 150 C154 146 176 136 184 112 Z"
              fill={C} stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M178 100 C176 76 168 58 158 48 M176 116 C162 124 148 136 140 148"
              fill="none" stroke={G} strokeWidth="2" opacity=".8" />
          </g>
        )}

        {/* a frill and a mane both sit AROUND the head, so they are drawn
            here and let the face cover their middle */}
        {R.crest === "frill" && (
          <g className="fo-frill">
            {/* scalloped, and pinned wide enough to clear the widest head on
                any body plan — a frill tucked inside the silhouette is just
                a fill nobody ever sees */}
            <path d="M100 110 C47 106 28 64 35 22 C50 46 65 40 68 18 C79 42 89 38 92 14 C100 40 108 38 112 16 C120 42 132 42 136 18 C147 42 159 48 168 24 C173 66 155 106 100 110 Z"
              fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M100 106 L36 26 M100 106 L68 22 M100 106 L93 18 M100 106 L112 20 M100 106 L136 22 M100 106 L166 30"
              fill="none" stroke={G} strokeWidth="2.2" opacity=".8" />
            <path d="M100 110 C50 106 32 66 38 28" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity=".5" />
          </g>
        )}
        {R.crest === "mane" && (
          <g>
            {Array.from({ length: 13 }).map((_, i) => {
              const a = -Math.PI * 0.99 + (i / 12) * Math.PI * 0.98;
              const t = i % 2 ? 96 : 82;
              const tx = 100 + Math.cos(a) * t, ty = 96 + Math.sin(a) * (t * 0.92);
              const px = 100 + Math.cos(a + 0.19) * 50, py = 96 + Math.sin(a + 0.19) * 46;
              const qx = 100 + Math.cos(a - 0.19) * 50, qy = 96 + Math.sin(a - 0.19) * 46;
              return (
                <path key={i} d={`M${px} ${py} L${tx} ${ty} L${qx} ${qy} Z`}
                  fill={i % 2 ? C : "#33405f"} stroke={D} strokeWidth="1.8" strokeLinejoin="round" />
              );
            })}
            <path d="M50 96 A50 46 0 0 1 150 96 Z" fill={C} opacity=".65" />
          </g>
        )}

        {/* ── legs ── */}
        {R.legs === "stub" && [-1, 1].map(k => (
          <g key={k}>
            <rect x={100 + k * 30 - 14} y="140" width="28" height="44" rx="14" fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2" />
            <ellipse cx={100 + k * 30} cy="182" rx="20" ry="11" fill="#e6edfa" stroke={D} strokeWidth="2" />
            <ellipse cx={100 + k * 30 - 4} cy="179" rx="9" ry="4" fill="#fff" opacity=".6" />
            <path d={`M${100 + k * 30 - 11} 186 H${100 + k * 30 + 11}`} stroke={G} strokeWidth="2" strokeLinecap="round" opacity=".7" />
          </g>
        ))}
        {R.legs === "roll" && (
          <g>
            <rect x="40" y="146" width="120" height="42" rx="21" fill="#25304a" stroke={D} strokeWidth="2.2" />
            <rect x="48" y="152" width="104" height="7" rx="3.5" fill={G} opacity=".45" />
            {[66, 134].map(cx => (
              <g key={cx}>
                <circle cx={cx} cy="167" r="16" fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2" />
                <circle className="fo-hub" cx={cx} cy="167" r="7" fill={G} filter={`url(#${uid}-bloom)`} />
              </g>
            ))}
          </g>
        )}
        {R.legs === "float" && (
          <g>
            {[0, 1, 2].map(i => (
              <ellipse key={i} className="fo-hover" style={{ animationDelay: `${i * 0.4}s` }}
                cx="100" cy={168 + i * 11} rx={44 - i * 13} ry={8 - i * 1.8}
                fill="none" stroke={G} strokeWidth="3" strokeLinecap="round" />
            ))}
            <ellipse cx="100" cy="176" rx="34" ry="9" fill={G} opacity=".22" filter={`url(#${uid}-soft)`} />
          </g>
        )}

        {R.legs === "hoof" && (
          <g>
            {/* the hind pair, set back and dropped in value — two legs on a
                flat plane is a cardboard cut-out, four with depth is a beast */}
            {[-1, 1].map(k => (
              <g key={"h" + k} opacity=".5">
                <path d={`M${100 + k * 50} 138 L${100 + k * 58} 162 L${100 + k * 52} 182`}
                  fill="none" stroke="#16203a" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
                <path d={`M${100 + k * 52 - 8} 178 H${100 + k * 52 + 8} L${100 + k * 52 + 6} 188 H${100 + k * 52 - 6} Z`}
                  fill="#0d1526" />
              </g>
            ))}
            {[-1, 1].map(k => (
              <g key={k}>
                <path d={`M${100 + k * 24} 138 L${100 + k * 34} 160 L${100 + k * 27} 180`}
                  fill="none" stroke={D} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
                <path d={`M${100 + k * 24} 138 L${100 + k * 34} 160 L${100 + k * 27} 180`}
                  fill="none" stroke={`url(#${uid}-lm)`} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={100 + k * 34} cy="160" r="4.2" fill={G} opacity=".85" />
                {/* the hoof: the one hard, flat thing that meets the ground */}
                <path d={`M${100 + k * 27 - 15} 172 H${100 + k * 27 + 15} L${100 + k * 27 + 12} 191 H${100 + k * 27 - 12} Z`}
                  fill="#eef3ff" stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
                <path d={`M${100 + k * 27} 174 V191`} stroke={D} strokeWidth="2" opacity=".6" />
                <path d={`M${100 + k * 27 - 13} 178 H${100 + k * 27 + 13}`} stroke={G} strokeWidth="2.4" opacity=".75" />
              </g>
            ))}
          </g>
        )}
        {R.legs === "talon" && [-1, 1].map(k => (
          <g key={k}>
            <path d={`M${100 + k * 26} 136 L${100 + k * 37} 158 L${100 + k * 29} 174`}
              fill="none" stroke={D} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d={`M${100 + k * 26} 136 L${100 + k * 37} 158 L${100 + k * 29} 174`}
              fill="none" stroke={`url(#${uid}-lm)`} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={100 + k * 37} cy="158" r="4" fill={G} opacity=".8" />
            {/* three toes that spread and then hook under — a bird's foot is
                a grip, not a peg */}
            {[-1, 0, 1].map(j => (
              <g key={j}>
                <path d={`M${100 + k * 29} 174 Q${100 + k * 29 + j * 13} 184 ${100 + k * 29 + j * 19} 188`}
                  fill="none" stroke="#cbd8ee" strokeWidth="6.5" strokeLinecap="round" />
                <path d={`M${100 + k * 29 + j * 19} 188 q${j * 5} 3 ${j * 6} 5`}
                  fill="none" stroke={G} strokeWidth="3.4" strokeLinecap="round" />
              </g>
            ))}
          </g>
        ))}
        {R.legs === "many" && [-1, 1].map(k => (
          <g key={k}>
            {[0, 1, 2].map(i => {
              const ox = 100 + k * (26 + i * 13), oy = 132 + i * 8;
              const kx = 100 + k * (56 + i * 12), ky = 116 + i * 14;
              const fx = 100 + k * (48 + i * 16), fy = 188 - i * 6;
              return (
                <g key={i}>
                  <path d={`M${ox} ${oy} L${kx} ${ky} L${fx} ${fy}`} fill="none"
                    stroke={D} strokeWidth="9.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={`M${ox} ${oy} L${kx} ${ky} L${fx} ${fy}`} fill="none"
                    stroke={`url(#${uid}-lm)`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={kx} cy={ky} r="3.6" fill={G} opacity=".85" />
                </g>
              );
            })}
          </g>
        ))}
        {R.legs === "coil" && (
          <g>
            <ellipse cx="100" cy="178" rx="68" ry="19" fill="#131c30" stroke={D} strokeWidth="2.4" />
            <ellipse cx="100" cy="172" rx="68" ry="19" fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2.4" />
            <ellipse cx="100" cy="163" rx="49" ry="14" fill="#2b3550" stroke={D} strokeWidth="2" />
            <ellipse cx="100" cy="156" rx="32" ry="10" fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2" />
            <path d="M36 172 Q100 192 164 172" fill="none" stroke={G} strokeWidth="2.6" strokeDasharray="4 10" opacity=".8" />
            <path d="M54 163 Q100 178 146 163" fill="none" stroke={G} strokeWidth="2.2" strokeDasharray="4 9" opacity=".6" />
          </g>
        )}
        {R.legs === "tentacle" && (
          <g>
            {[-2, -1, 0, 1, 2].map(j => {
              const bx = 100 + j * 22, px = 100 + j * 38 + (j < 0 ? -4 : j > 0 ? 4 : 0);
              const w = j === 0 ? 17 : 15;
              // the outer arms bow away from the body before they drop, so the
              // whole length is outside the shell rather than hidden under it
              const cx1 = bx + (px - bx) * 1.35, cx2 = px + (px - bx) * 0.18;
              return (
                <g key={j}>
                  {/* a real taper: one filled path from a fat root to a point,
                      because two stacked strokes only ever look like a tube */}
                  <path d={`M${bx - w} 112 C${cx1 - w} 144 ${cx2 - 13} 168 ${px - 3} 192 C${px + 3} 176 ${cx2 + 11} 152 ${bx + w} 112 Z`}
                    fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2.4" strokeLinejoin="round" />
                  {[0, 1, 2, 3].map(i => (
                    <circle key={i} cx={bx + (px - bx) * (0.42 + i * 0.18)} cy={140 + i * 13}
                      r={4.6 - i * 0.8} fill={G} opacity=".8" />
                  ))}
                </g>
              );
            })}
            {/* the mantle they all hang from, so the arms read as attached */}
            <ellipse cx="100" cy="126" rx="72" ry="22" fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2.4" />
            <path d="M32 124 Q100 148 168 124" fill="none" stroke={G} strokeWidth="2.4" strokeDasharray="4 10" opacity=".7" />
          </g>
        )}

        {/* ── the shell ── */}
        <g filter={hurt ? undefined : `url(#${uid}-soft)`} opacity=".55">
          <path d={body} fill={C} />
        </g>
        <path d={body} fill={`url(#${uid}-sh)`} stroke={D} strokeWidth="2.4" strokeLinejoin="round" />
        <g clipPath={`url(#${uid}-clip)`}>
          {/* core → panels → traces → sheen → rim. Order is the whole trick:
              the core sits UNDER the panelling so it reads as light coming
              through the hull, and the rim goes last so nothing dulls it. */}
          <rect x="0" y="0" width="200" height="210" fill={`url(#${uid}-hex)`} />
          <ellipse cx="100" cy="136" rx="44" ry="36" fill="#ffffff" opacity=".1" />
          <ellipse className="fo-core" cx="100" cy="122" rx="58" ry="50" fill={`url(#${uid}-core)`} />
          <path className="fo-trace" d={trace} fill="none" stroke={G} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}-bloom)`} />
          <path d={trace} fill="none" stroke="#ffffff" strokeWidth=".8" strokeLinecap="round" opacity=".55" />
          <path d="M50 70 C60 44 84 32 110 34" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" fill="none" opacity=".3" />
          <rect className="fo-sheen" x="-60" y="-10" width="30" height="230" fill={`url(#${uid}-shn)`} transform="skewX(-16)" />
          {/* rim light: the same silhouette, stroked fat and clipped, so only
              the inner half of the stroke survives — one line and the figure
              stops being a sticker */}
          <path d="M150 56 C168 82 170 120 158 148" stroke={D} strokeWidth="16" strokeLinecap="round" fill="none" opacity=".2" />
          <path d={body} fill="none" stroke={`url(#${uid}-bnc)`} strokeWidth="8" />
          <path d={body} fill="none" stroke={`url(#${uid}-rim)`} strokeWidth="8" />
          <path d={body} fill="none" stroke={`url(#${uid}-rim)`} strokeWidth="2.6" />
        </g>

        {/* ── arms ── */}
        {(R.arms === "mitt" || R.arms === "paw") && [-1, 1].map(k => (
          <g key={k} className={k > 0 ? "fo-armR" : "fo-armL"}>
            <path d={`M${100 + k * 62} 96 Q${100 + k * 74} 110 ${100 + k * 78} 130`}
              stroke={`url(#${uid}-lm)`} strokeWidth="15" strokeLinecap="round" fill="none" />
            <circle cx={100 + k * 80} cy="138" r={R.arms === "paw" ? 18 : 15} fill="#e6edfa" stroke={D} strokeWidth="2" />
            <circle cx={100 + k * 80} cy="138" r={R.arms === "paw" ? 18 : 15} fill="none" stroke={G} strokeWidth="2" opacity=".65" />
            {R.arms === "paw" && [-1, 0, 1].map(j => (
              <circle key={j} cx={100 + k * 80 + j * 8} cy={130 + Math.abs(j) * 3} r="4" fill={C} opacity=".6" />
            ))}
            <circle cx={100 + k * 80 - 5} cy="133" r="5" fill="#fff" opacity=".65" />
          </g>
        ))}
        {R.arms === "fin" && [-1, 1].map(k => (
          <g key={k} className={k > 0 ? "fo-armR" : "fo-armL"}>
            <path d={`M${100 + k * 62} 92 C${100 + k * 98} 88 ${100 + k * 112} 118 ${100 + k * 88} 148 C${100 + k * 80} 128 ${100 + k * 74} 110 ${100 + k * 62} 106 Z`}
              fill={G} opacity=".42" stroke={G} strokeWidth="2.4" strokeLinejoin="round" />
            <path d={`M${100 + k * 68} 100 C${100 + k * 92} 102 ${100 + k * 100} 120 ${100 + k * 88} 138`}
              fill="none" stroke="#ffffff" strokeWidth="1.4" opacity=".55" />
          </g>
        ))}
        {R.arms === "wing" && [-1, 1].map(k => (
          <g key={k} className={k > 0 ? "fo-wingR" : "fo-wingL"}>
            <path d={`M${100 + k * 46} 66 C${100 + k * 110} 34 ${100 + k * 146} 76 ${100 + k * 108} 124 C${100 + k * 88} 106 ${100 + k * 62} 90 ${100 + k * 46} 86 Z`}
              fill={G} opacity=".26" stroke={G} strokeWidth="2.6" strokeLinejoin="round" filter={`url(#${uid}-bloom)`} />
            {[0.4, 0.72].map(r => (
              <path key={r} fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity=".5"
                d={`M${100 + k * 52} 74 Q${100 + k * (64 + 62 * r)} ${56 - 8 * r} ${100 + k * (72 + 40 * r)} ${80 + 30 * r}`} />
            ))}
          </g>
        ))}

        {R.arms === "pincer" && [-1, 1].map(k => (
          <g key={k} className={k > 0 ? "fo-armR" : "fo-armL"}>
            <path d={`M${100 + k * 50} 94 L${100 + k * 70} 112`} stroke={D} strokeWidth="19" strokeLinecap="round" />
            <path d={`M${100 + k * 50} 94 L${100 + k * 70} 112`} stroke={`url(#${uid}-lm)`} strokeWidth="13" strokeLinecap="round" />
            {/* two halves with daylight between them: a claw has to look
                like it could close, or it is just a lump on a stick */}
            <path d={`M${100 + k * 66} 104 C${100 + k * 88} 98 ${100 + k * 94} 112 ${100 + k * 84} 120 L${100 + k * 76} 116 C${100 + k * 82} 110 ${100 + k * 76} 106 ${100 + k * 68} 110 Z`}
              fill={C} stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
            <path d={`M${100 + k * 66} 120 C${100 + k * 86} 124 ${100 + k * 92} 138 ${100 + k * 80} 144 L${100 + k * 74} 136 C${100 + k * 80} 132 ${100 + k * 74} 126 ${100 + k * 66} 126 Z`}
              fill={C} stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
            <path d={`M${100 + k * 72} 108 L${100 + k * 88} 112`} stroke={G} strokeWidth="2" strokeLinecap="round" opacity=".85" />
            <path d={`M${100 + k * 72} 124 L${100 + k * 86} 132`} stroke={G} strokeWidth="2" strokeLinecap="round" opacity=".85" />
          </g>
        ))}
        {R.arms === "tentacle" && [-1, 1].map(k => (
          <g key={k} className={k > 0 ? "fo-armR" : "fo-armL"}>
            <path d={`M${100 + k * 52} 84 C${100 + k * 90} 80 ${100 + k * 100} 112 ${100 + k * 74} 136 C${100 + k * 84} 112 ${100 + k * 78} 98 ${100 + k * 52} 98 Z`}
              fill={`url(#${uid}-lm)`} stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
            {[0, 1, 2, 3].map(i => (
              <circle key={i} cx={100 + k * (60 + i * 8)} cy={91 + i * 6} r={4 - i * 0.5} fill={G} opacity=".75" />
            ))}
            <path d={`M${100 + k * 58} 86 C${100 + k * 84} 84 ${100 + k * 92} 108 ${100 + k * 74} 128`}
              fill="none" stroke="#ffffff" strokeWidth="1.4" opacity=".45" />
          </g>
        ))}

        {/* ── crest ── */}
        {R.crest === "ant" && [-1, 1].map(k => (
          <g key={k} className={k > 0 ? "fo-antR" : "fo-antL"}>
            <path d={`M${100 + k * 18} 34 Q${100 + k * 30} 8 ${100 + k * 36} -2`} stroke="#cbd8ee" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <circle cx={100 + k * 36} cy="-2" r="7.5" fill={G} filter={`url(#${uid}-bloom)`} />
            <circle cx={100 + k * 36} cy="-2" r="7.5" fill="none" stroke={D} strokeWidth="1.4" />
            <circle cx={100 + k * 34} cy="-5" r="2.6" fill="#fff" opacity=".85" />
          </g>
        ))}
        {R.crest === "stack" && [0, 1, 2].map(i => {
          const x = 78 + i * 16, y = 14 + (i % 2) * 7;
          return (
            <g key={i}>
              <rect x={x} y={y} width="15" height="34" rx="7.5" fill="#4a5875" stroke={D} strokeWidth="1.8" />
              <rect x={x + 3} y={y + 6} width="9" height="3" rx="1.5" fill={G} opacity=".8" />
              <ellipse cx={x + 7.5} cy={y + 2} rx="8" ry="4" fill="#75859f" stroke={D} strokeWidth="1.4" />
              <circle className="fo-puff" style={{ animationDelay: `${i * 0.5}s` }} cx={x + 7.5} cy={y - 6} r="6" fill={G} />
            </g>
          );
        })}
        {R.crest === "spire" && [-1, 0, 1].map(k => (
          <g key={k}>
            <path d={`M${100 + k * 27 - 10} 44 Q${100 + k * 27} ${k === 0 ? -6 : 10} ${100 + k * 27 + 10} 44 Z`}
              fill={G} opacity=".95" stroke={D} strokeWidth="1.8" strokeLinejoin="round" />
            <path d={`M${100 + k * 27 - 3} 42 Q${100 + k * 27} ${k === 0 ? 2 : 16} ${100 + k * 27 + 2} 42 Z`} fill="#ffffff" opacity=".6" />
          </g>
        ))}
        {R.crest === "horn" && [-1, 1].map(k => (
          <g key={k}>
            <path d={`M${100 + k * 34} 48 C${100 + k * 40} 16 ${100 + k * 66} 6 ${100 + k * 76} 18 C${100 + k * 60} 24 ${100 + k * 50} 38 ${100 + k * 46} 56 Z`}
              fill={C} stroke={D} strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${100 + k * 40} 42 C${100 + k * 46} 22 ${100 + k * 62} 16 ${100 + k * 70} 20`}
              fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" opacity=".85" />
          </g>
        ))}
        {R.crest === "halo" && (
          <g className="fo-halo">
            <ellipse cx="100" cy="16" rx="46" ry="13" fill="none" stroke={G} strokeWidth="4.5" filter={`url(#${uid}-bloom)`} />
            <ellipse cx="100" cy="16" rx="46" ry="13" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".55" />
          </g>
        )}

        {R.crest === "antler" && [-1, 1].map(k => (
          <g key={k} className={k > 0 ? "fo-antR" : "fo-antL"}>
            <path d={`M${100 + k * 20} 42 C${100 + k * 30} 18 ${100 + k * 44} 4 ${100 + k * 50} -8`}
              fill="none" stroke="#e2eafc" strokeWidth="6.5" strokeLinecap="round" />
            <path d={`M${100 + k * 27} 22 L${100 + k * 47} 15`} fill="none" stroke="#e2eafc" strokeWidth="4.8" strokeLinecap="round" />
            <path d={`M${100 + k * 34} 9 L${100 + k * 28} -7`} fill="none" stroke="#e2eafc" strokeWidth="4.2" strokeLinecap="round" />
            <path d={`M${100 + k * 20} 42 C${100 + k * 30} 18 ${100 + k * 44} 4 ${100 + k * 50} -8`}
              fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" opacity=".9" filter={`url(#${uid}-bloom)`} />
            <circle cx={100 + k * 50} cy="-8" r="4.2" fill={G} filter={`url(#${uid}-bloom)`} />
            <circle cx={100 + k * 47} cy="15" r="3.2" fill={G} opacity=".8" />
          </g>
        ))}
        {R.crest === "plate" && (
          <g>
            <path d="M50 44 L72 16 H128 L150 44 Z" fill={C} stroke={D} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M60 40 L78 22 H122 L140 40" fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" opacity=".85" />
            <path d="M72 16 V44 M128 16 V44" stroke={D} strokeWidth="1.8" opacity=".45" />
            <rect className="fo-core" x="91" y="20" width="18" height="8" rx="4" fill={G} filter={`url(#${uid}-bloom)`} />
            <path d="M50 44 L72 16" stroke="#ffffff" strokeWidth="1.6" opacity=".5" />
          </g>
        )}
        {R.crest === "bull" && [-1, 1].map(k => (
          <g key={k}>
            <path d={`M${100 + k * 24} 46 C${100 + k * 54} 44 ${100 + k * 78} 30 ${100 + k * 84} 6 C${100 + k * 70} 14 ${100 + k * 56} 24 ${100 + k * 32} 28 Z`}
              fill="#eef3ff" stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
            <path d={`M${100 + k * 32} 36 C${100 + k * 56} 32 ${100 + k * 72} 22 ${100 + k * 80} 10`}
              fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" opacity=".8" />
            <circle cx={100 + k * 84} cy="6" r="3.4" fill={eye} opacity=".9" />
          </g>
        ))}
        {R.crest === "crown" && (
          <g>
            <path d="M62 46 L68 14 L84 30 L100 0 L116 30 L132 14 L138 46 Z"
              fill={C} stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M65 38 H135" stroke={G} strokeWidth="3.2" strokeLinecap="round" opacity=".9" />
            {[[68, 16], [100, 2], [132, 16]].map(([x, y], i) => (
              <circle key={i} className="fo-core" style={{ animationDelay: `${i * 0.3}s` }}
                cx={x} cy={y} r="4.6" fill={G} filter={`url(#${uid}-bloom)`} />
            ))}
          </g>
        )}
        {R.crest === "trihorn" && [-1, 0, 1].map(k => (
          <g key={k}>
            <path d={`M${100 + k * 30 - 10} 46 L${100 + k * 30 + k * 9} ${k === 0 ? -8 : 6} L${100 + k * 30 + 10} 46 Z`}
              fill="#eef3ff" stroke={D} strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${100 + k * 30 - 3} 44 L${100 + k * 30 + k * 6} ${k === 0 ? 0 : 12}`}
              fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" opacity=".85" />
          </g>
        ))}

        {/* ── face ── */}
        {(() => {
          /* Five or six eyes in one straight band read as a row of buttons.
             Stacked into two rows they read as a face that has too many eyes,
             which is the entire point of giving a creature six. */
          const n = R.eyes;
          const rows = n >= 5 ? [n - Math.floor(n / 2), Math.floor(n / 2)] : [n];
          const step = n >= 5 ? 28 : n === 4 ? 26 : n === 3 ? 32 : 36;
          const r = n === 1 ? 28 : n === 2 ? 21 : n === 3 ? 16 : n === 4 ? 11.5 : 12.5;
          const seats = [];
          rows.forEach((cnt, ri) => {
            for (let j = 0; j < cnt; j++) {
              seats.push({
                cx: 100 + (j - (cnt - 1) / 2) * step,
                cy: n >= 5 ? 78 + ri * 25 : n === 4 ? 88 + Math.abs(j - (cnt - 1) / 2) * 6 : 92,
              });
            }
          });
          return seats.map((S, i) => {
          const cx = S.cx, cy = S.cy;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r + 10} fill={eye} opacity=".2" filter={`url(#${uid}-soft)`} />
              <circle cx={cx} cy={cy} r={r + 4} fill="#080d18" />
              <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={G} strokeWidth="1.6" opacity=".55" />
              <clipPath id={`${uid}-ec${i}`}><circle cx={cx} cy={cy} r={r} /></clipPath>
              <g className="fo-lid" style={{ animationDelay: `${i * 0.06}s`, transformOrigin: `${cx}px ${cy}px` }}>
                <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-ey)`} />
                {/* the scan bar that says this eye is a sensor. It has to be
                    clipped by a real clipPath — a CSS basic shape resolves
                    against the rect's own box and the bar escaped across the
                    whole face as a stray white line. */}
                <g clipPath={`url(#${uid}-ec${i})`}>
                  <rect className="fo-scan" x={cx - r} y={cy - r * 1.1} width={r * 2} height={r * 0.3}
                    fill="#ffffff" opacity=".4" />
                </g>
                <circle cx={cx - r * .34} cy={cy - r * .36} r={r * .3} fill="#fff" opacity=".95" />
                <circle cx={cx + r * .3} cy={cy + r * .34} r={r * .14} fill="#fff" opacity=".6" />
              </g>
            </g>
          );
          });
        })()}
        {R.cheek === 1 && [-1, 1].map(k => (
          <ellipse key={k} cx={100 + k * 50} cy="116" rx="13" ry="8" fill={eye} opacity=".34" />
        ))}
        {R.face === "smile" && <path d="M86 126 Q100 141 114 126" fill="none" stroke={D} strokeWidth="4.5" strokeLinecap="round" />}
        {R.face === "grin" && (
          <g>
            <path d="M80 124 Q100 146 120 124 Z" fill={D} />
            <path d="M88 130 L94 138 L100 130 L106 138 L112 130" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
          </g>
        )}
        {R.face === "oh" && (
          <g>
            <ellipse cx="100" cy="130" rx="10" ry="13" fill={D} />
            <ellipse className="fo-core" cx="100" cy="136" rx="6" ry="6" fill={eye} opacity=".6" />
          </g>
        )}
        {R.face === "fang" && (
          <g>
            <path d="M84 124 Q100 142 116 124" fill="none" stroke={D} strokeWidth="4.5" strokeLinecap="round" />
            <path d="M89 127 L92 136 L95 128 Z" fill="#fff" />
            <path d="M105 128 L108 136 L111 127 Z" fill="#fff" />
          </g>
        )}

        {R.face === "beak" && (
          <g>
            <path d="M78 110 H122 L109 138 Q100 148 91 138 Z"
              fill="#f4d888" stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
            {/* the hook. One curve is the whole difference between a raptor
                and a traffic cone. */}
            <path d="M91 138 Q95 154 100 151 Q105 154 109 138 Z"
              fill="#e2c274" stroke={D} strokeWidth="2" strokeLinejoin="round" />
            <path d="M100 110 V150" stroke={D} strokeWidth="1.5" opacity=".4" />
            <path d="M80 116 H120" stroke={D} strokeWidth="1.8" opacity=".55" />
            <path d="M83 112 L100 112" stroke="#fff8dd" strokeWidth="3" strokeLinecap="round" opacity=".8" />
            <circle cx="88" cy="121" r="2.6" fill={D} opacity=".6" />
            <circle cx="112" cy="121" r="2.6" fill={D} opacity=".6" />
          </g>
        )}

        {boss && (
          <g>
            {/* Regalia sits ON the body, never out at the silhouette's edge:
                a pauldron floated off to the side reads as a bug on every
                shape it was not measured against. */}
            {[-1, 1].map(k => (
              <g key={k}>
                <path d={`M${100 + k * 38} 56 C${100 + k * 68} 48 ${100 + k * 80} 72 ${100 + k * 68} 90 L${100 + k * 40} 82 Z`}
                  fill={C} stroke={D} strokeWidth="2.2" strokeLinejoin="round" />
                <path d={`M${100 + k * 44} 60 C${100 + k * 66} 54 ${100 + k * 76} 72 ${100 + k * 66} 86`}
                  fill="none" stroke={G} strokeWidth="2.2" opacity=".9" />
                <path d={`M${100 + k * 46} 66 C${100 + k * 62} 62 ${100 + k * 70} 72 ${100 + k * 64} 80`}
                  fill="none" stroke="#fff" strokeWidth="1.6" opacity=".45" />
              </g>
            ))}
            <path d="M70 44 H130" stroke={C} strokeWidth="8" strokeLinecap="round" />
            <path d="M70 44 H130" stroke={G} strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
            {[-1, 0, 1].map(k => (
              <g key={k}>
                <path d={`M${100 + k * 20 - 8} 44 Q${100 + k * 20} ${k === 0 ? 12 : 22} ${100 + k * 20 + 8} 44 Z`}
                  fill={eye} stroke={D} strokeWidth="1.5" strokeLinejoin="round" />
                <circle className="fo-core" cx={100 + k * 20} cy={k === 0 ? 18 : 26} r="4.5"
                  fill="#ffe08a" stroke={D} strokeWidth="1.2" />
              </g>
            ))}
          </g>
        )}
      </g>
    </svg>
  );
});

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

/* ══════════════════════ the battle screen ══════════════════════

   A card with four buttons on it is a quiz. Stepping onto a lit stage where
   your own chassis stands opposite something that is going to hit you is a
   fight — and the difference is entirely in whether you can see it happen.

   It borrows the PvP arena's FX engine wholesale, so a laser here is the same
   laser that fires there: `setPos` places the two fighters in 0..1 across the
   canvas and every effect is addressed to "me" or "op". The music question is
   still the whole mechanic; what changed is that answering it now visibly
   throws something.

   The attack a right answer throws is picked by how long your streak is, so a
   run of correct answers escalates from a jab to an orbital strike rather
   than repeating one animation. */
const MOVES = [
  { id: "jab",    fx: "swipe",  sfx: "hit",   dmg: 1.0 },
  { id: "beam",   fx: "bolt",   sfx: "laser", dmg: 1.08 },
  { id: "burst",  fx: "laser",  sfx: "laser", dmg: 1.16 },
  { id: "rocket", fx: "lob",    sfx: "boom",  dmg: 1.3 },
  { id: "nova",   fx: "boom",   sfx: "boom",  dmg: 1.5 },
];
const moveFor = (streak) => MOVES[Math.min(streak, MOVES.length - 1)];

const BattleScreen = memo(function BattleScreen({
  lang, W, foe, hp, maxHpV, chassisEl, onAnswer, onFlee, shake, hurtFoe, hurtMe, playing, reveal, onNextQ, bt, onAct, bnr, cine,
}) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const ST = stageById(W.track);
  const G = useArenaFx(ST);
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0, t0 = performance.now();
    const step = (n) => { raf = requestAnimationFrame(step); setT((n - t0) / 1000); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => { G.setPos(0.24, 0.76, 0, 0); }, [G]);
  /* Keys for anyone on a laptop: the same five actions the thumbs get. */
  useEffect(() => {
    if (!onAct) return;
    const K = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", j: "punch", z: "punch", k: "kick", x: "kick", " ": "guard", Enter: "ult", e: "ult" };
    const dn = (e) => { const m = K[e.key] || K[e.key.toLowerCase()]; if (m) { e.preventDefault(); onAct(m); } };
    window.addEventListener("keydown", dn);
    return () => window.removeEventListener("keydown", dn);
  }, [onAct]);
  // hand the effect bus up so the parent can fire attacks from its own logic
  useEffect(() => { if (playing) playing.current = G; }, [G, playing]);

  const foePct = clamp(foe.hp / foe.max, 0, 1);
  const mePct = clamp(hp / maxHpV, 0, 1);
  const acting = !!onAct && !reveal && (foe.phase === "act" || !foe.q);

  /* Portalled to <body>. A fixed element still answers to the nearest
     ancestor that owns a stacking context, and inside the app shell the
     header was painting over the top of the fight and eating both HP bars —
     the two numbers the whole fight is about. Out here it cannot. */
  return createPortal((
    <div className={`ssbattle${foe.boss ? " boss" : ""}${shake ? " shake" : ""}${hurtFoe ? " punchy" : ""}${cine ? " cine" : ""}`} data-stage={ST.id} style={{ "--wc": W.accent, "--wg": W.glow }}>
      <canvas ref={G.bgRef} className="ssbbg" />
      <canvas ref={G.canvasRef} className="ssbfx" />
      {/* atmosphere: a light shaft, drifting embers and a haze horizon. All
          CSS, so none of it costs a frame of the fight. */}
      <div className="ssb-atmo" aria-hidden="true">
        <span className="ssb-shaft" /><span className="ssb-shaft b" />
        {/* city bokeh: out-of-focus lights behind the fight, which is most of
            what a night skyline actually looks like through a lens */}
        {BOKEH.map((k, i) => (
          <b key={i} className="ssb-bokeh" style={{
            left: `${k[0]}%`, top: `${k[1]}%`, width: `${k[2]}px`, height: `${k[2]}px`,
            background: k[3], animationDelay: `${i * 0.9}s`,
          }} />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <i key={i} className="ssb-ember" style={{ left: `${5 + i * 12}%`, animationDelay: `${i * 1.6}s`, animationDuration: `${9 + (i % 4) * 2.5}s` }} />)}
        <span className="ssb-haze" />
        {/* rain, and the frame it is falling through: two out-of-focus
            foreground masses that give the shot a near plane */}
        <span className="ssb-rain" />
        <span className="ssb-fg l" /><span className="ssb-fg r" />
      </div>
      {/* the grade: a filmic curve, grain, a vignette and a whisper of
          chromatic fringe. Last layer over the picture, under the HUD. */}
      <div className="ssb-grade" aria-hidden="true"><span className="ssb-grain" /><span className="ssb-ca" /></div>

      <div className="ssb-bars">
        <div className="ssb-bar me">
          <span className="ssb-nm">TIGA-01</span>
          <i><b style={{ width: mePct * 100 + "%" }} /></i>
          <span className="ssb-hp">{Math.max(0, Math.round(hp))}</span>
        </div>
        <div className="ssb-bar foe">
          <span className="ssb-nm">{foe.name}</span>
          <i><b style={{ width: foePct * 100 + "%" }} /></i>
          <span className="ssb-hp">{Math.max(0, Math.round(foe.hp))}</span>
        </div>
      </div>

      {/* The slot carries the spacing, the side carries the idle bob and the
          recoil — one transform each, so neither cancels the other out. */}
      <div className="ssb-stage">
        <div className="ssb-slot me" style={{ transform: `translateX(${(((bt && bt.me) || 0.24) - 0.24) * 100}vw)` }}>
          <div className={`ssb-side me${hurtMe ? " hit" : ""}${(bt && bt.guard) > 0 ? " guarding" : ""}`}>{chassisEl}</div>
          {/* the wet floor. One mirrored, blurred, faded copy per fighter is
              the single cheapest thing that makes a stage look expensive. */}
          <div className="ssb-refl" aria-hidden="true"><div className="ssb-refl-in">{chassisEl}</div></div>
        </div>
        <div className={`ssb-slot foe${foe.boss ? " big" : ""}`} style={{ transform: `translateX(${(((bt && bt.foe) || 0.76) - 0.76) * 100}vw)` }}>
          <div className={`ssb-side foe${hurtFoe ? " hit" : ""}${foe.boss ? " big" : ""}${(bt && bt.tell) > 0 ? " tell" : ""}`}>
            <MonsterArt world={W.id} foe={foe.sp} boss={foe.boss} hurt={hurtFoe} />
          </div>
          <div className="ssb-refl" aria-hidden="true">
            <div className="ssb-refl-in"><MonsterArt world={W.id} foe={foe.sp} boss={foe.boss} /></div>
          </div>
          {(bt && bt.tell) > 0 && <span className="ssb-tell">!</span>}
        </div>
      </div>

      {/* the two numbers a fighting game lives on */}
      {(bt && bt.combo) > 1 && <div className="ssb-combo" key={bt.combo}><b>{bt.combo}</b><i>{T("คอมโบ", "COMBO", "连击")}</i></div>}
      {bnr && <div className={`ssb-bnr ${bnr.kind}`} key={bnr.id}>{bnr.text}</div>}

      {foe.boss && foe.line && <p className="ssb-line">{foe.line}</p>}

      <div className="ssb-ask">
        {acting ? (
          /* ── the action phase ──
             Twenty seconds of an actual fight. Spacing is the play: the foe
             walks you down, a punch only lands inside its reach, and guard
             costs you the ground you would otherwise be taking. */
          <>
            <div className="ssb-meters">
              <div className="ssb-timer">
                <i style={{ width: `${(1 - (bt.qIn || 0) / QUESTION_EVERY) * 100}%` }} />
                <b>{T("คำถามในอีก", "Question in", "问题将在")} {Math.ceil(bt.qIn || 0)}s</b>
              </div>
              <div className={`ssb-od${(bt.od || 0) >= 100 ? " full" : ""}`}>
                <i style={{ width: `${bt.od || 0}%` }} />
                <b>{(bt.od || 0) >= 100 ? T("พร้อม!", "READY!", "就绪!") : "OVERDRIVE"}</b>
              </div>
            </div>
            <div className="ssb-pad">
              <div className="ssb-pad-l">
                <button className="ssb-dir" aria-label={T("ถอย", "Back", "后退")} onPointerDown={() => onAct("left")}>◀</button>
                <button className={`ssb-dir gd${(bt.cd || {}).guard > 0 ? " cool" : ""}`} aria-label={T("ตั้งการ์ด", "Guard", "格挡")} onPointerDown={() => onAct("guard")}>🛡</button>
                <button className="ssb-dir" aria-label={T("เข้าหา", "Forward", "前进")} onPointerDown={() => onAct("right")}>▶</button>
              </div>
              <div className="ssb-pad-r">
                {(bt.od || 0) >= 100 && (
                  <button className="ssb-act ult" onPointerDown={() => onAct("ult")}>
                    <b>✦</b><i>{T("ปลดปล่อย", "OVERDRIVE", "超载")}</i>
                  </button>
                )}
                <button className={`ssb-act punch${(bt.cd || {}).punch > 0 ? " cool" : ""}`} onPointerDown={() => onAct("punch")}>
                  <b>👊</b><i>{T("ต่อย", "PUNCH", "拳击")}</i>
                </button>
                <button className={`ssb-act kick${(bt.cd || {}).kick > 0 ? " cool" : ""}`} onPointerDown={() => onAct("kick")}>
                  <b>🦵</b><i>{T("เตะ", "KICK", "踢击")}</i>
                </button>
              </div>
            </div>
            <button className="ssb-flee" onClick={onFlee}>{T("ถอย", "Disengage", "脱离")}</button>
          </>
        ) : reveal ? (
          /* The fight pauses on the answer. Rushing straight to the next
             question is what makes a quiz feel like a slot machine — this is
             the two seconds where the learning actually happens. */
          <AnswerReveal q={reveal.q} chosen={reveal.chosen} lang={lang} onNext={onNextQ} />
        ) : (
          <>
            {foe.streak > 1 && <div className="ssb-streak">×{foe.streak} · {tr3({ th: "ต่อเนื่อง", en: "streak", zh: "连击" }, lang)}</div>}
            <div className="ssb-q">{foe.q.q}</div>
            <div className="ssb-opts">
              {foe.q.opts.map(o => <button key={o} className="ssb-opt" onClick={() => onAnswer(o)}>{o}</button>)}
            </div>
            <button className="ssb-flee" onClick={onFlee}>{T("ถอย", "Disengage", "脱离")}</button>
          </>
        )}
      </div>
    </div>
  ), document.body);
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
  const meRef = useRef({ ...nearestWalkable(geo.seed, geo.town.x, geo.town.y + 60), t: 0, dir: 0 });
  const padRef = useRef({ ax: 0, ay: 0, on: false, ox: 0, oy: 0 });
  const keysRef = useRef({});
  const mobsRef = useRef([]);
  const camRef = useRef({ x: 0, y: 0, yaw: 0 });
  const fightRef = useRef(null);
  const hitFlashRef = useRef(0);
  const popsRef = useRef([]);          // floating damage numbers
  const fxRef = useRef(null);          // the battle screen's effect bus, handed up
  const [shake, setShake] = useState(0);
  const [hurtFoe, setHurtFoe] = useState(false);
  const [hurtMe, setHurtMe] = useState(false);
  const [reveal, setReveal] = useState(null);   // {q, chosen} — the answered question, held on screen
  const revealRef = useRef(null);
  const [bnr, setBnr] = useState(null);       // {text, kind} — PARRY / COMBO / OVERDRIVE
  const [cine, setCine] = useState(false);    // letterbox bars, for the signature move
  const bnrT = useRef(0);
  const banner = useCallback((text, kind) => {
    setBnr({ text, kind, id: Date.now() });
    window.clearTimeout(bnrT.current);
    bnrT.current = window.setTimeout(() => setBnr(null), 1100);
  }, []);
  useEffect(() => { revealRef.current = reveal; }, [reveal]);
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
    const sp = nearestWalkable(geo.seed, geo.town.x, geo.town.y + 60);
    meRef.current = { x: sp.x, y: sp.y, t: 0, dir: 0 };
    camRef.current = { x: sp.x, y: sp.y, yaw: 0 };
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

      /* Rescue. Whatever put the player inside a block — a spawn, a world
         change, a later change to the terrain — walk them back out of it
         regardless of what the stick says, because from in there no input
         can ever succeed. */
      if (!busy && !walkable(geo.seed, me.x, me.y)) {
        const out = nearestWalkable(geo.seed, me.x, me.y);
        const dx = out.x - me.x, dy = out.y - me.y, d = Math.hypot(dx, dy) || 1;
        const step = Math.min(d, 260 * dt);
        me.x += (dx / d) * step; me.y += (dy / d) * step;
      }

      // input → velocity
      let ax = padRef.current.ax, ay = padRef.current.ay;
      const K = keysRef.current;
      if (K.ArrowLeft || K.a) ax -= 1; if (K.ArrowRight || K.d) ax += 1;
      if (K.ArrowUp || K.w) ay -= 1; if (K.ArrowDown || K.s) ay += 1;
      const mag = Math.hypot(ax, ay);
      if (mag > 1) { ax /= mag; ay /= mag; }
      const camS = camRef.current;
      if (!busy && (ax || ay)) {
        /* The stick is read RELATIVE TO THE CAMERA: push up and you walk away
           from it, whichever way it happens to be facing. That is the whole
           contract of a third-person camera, and it is why the stick no longer
           goes through the old fixed isometric axes. */
        const fX = Math.sin(camS.yaw), fY = Math.cos(camS.yaw);
        const rX = Math.cos(camS.yaw), rY = -Math.sin(camS.yaw);
        const wxv = rX * ax + fX * (-ay), wyv = rY * ax + fY * (-ay);
        const m2 = Math.hypot(wxv, wyv) || 1;
        const sp = 190 * dt * Math.min(1, mag || 1);
        const nx = me.x + (wxv / m2) * sp, ny = me.y + (wyv / m2) * sp;
        if (walkable(geo.seed, nx, me.y)) me.x = nx;      // slide along walls rather than sticking
        if (walkable(geo.seed, me.x, ny)) me.y = ny;
        me.t += dt;
        me.face = Math.atan2(wxv, wyv);
        /* and the camera swings in behind you, the shortest way round. Turning
           the long way is the thing that makes a chase camera feel broken. */
        let dyaw = me.face - camS.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        camS.yaw += dyaw * Math.min(1, dt * 2.6);
        // which way the sprite faces is now left/right OF THE CAMERA
        me.dir = Math.abs(dyaw) > Math.PI / 2 ? -me.dir || 1 : (rX * wxv + rY * wyv) > 0 ? 1 : -1;
      }
      camS.x += (me.x - camS.x) * Math.min(1, dt * 7);
      camS.y += (me.y - camS.y) * Math.min(1, dt * 7);
      const cam = camS;

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
        const ry = (((h1 >>> 11) % 2000) - cam.y * 0.12) % (vh + 40);
        const sxp = rx < 0 ? rx + vw + 40 : rx, syp = ry < 0 ? ry + vh + 40 : ry;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(tsec * 0.7 + i));
        g.fillStyle = `rgba(255,255,255,${(0.05 + (i % 5) * 0.03) * tw})`;
        const ss = px((i % 7 === 0) ? 2.2 : 1.3); g.fillRect(sxp - 20, syp - 20, ss, ss);
      }
      g.globalCompositeOperation = "source-over";

      /* ── far parallax ──
         A ridge line that moves at a fraction of the camera. It is the
         cheapest possible statement that the world continues past the edge of
         what you can walk on, and without it the map reads as a tabletop. */
      const HZ = makeCam(cam, vw, vh).horizon;
      /* ── the city glow ──
         A night sky with nothing burning under the horizon reads as a power
         cut. This is the light of everything you cannot walk to yet, and it
         is the only reason the dark ridges below have an edge at all. */
      {
        const NE = hexRgb(W.neon || W.glow), AC = hexRgb(W.accent);
        g.globalCompositeOperation = "lighter";
        const gl = g.createLinearGradient(0, HZ - 130, 0, HZ + 34);
        gl.addColorStop(0, `rgba(${NE},0)`);
        gl.addColorStop(0.62, `rgba(${NE},0.16)`);
        gl.addColorStop(0.88, `rgba(${AC},0.34)`);
        gl.addColorStop(1, `rgba(${AC},0)`);
        g.fillStyle = gl; g.fillRect(0, HZ - 130, vw, 164);
        // three hot pools where the biggest districts sit, drifting with the eye
        for (let i = 0; i < 3; i++) {
          const bx = ((hash32("glow" + i + W.id) % 1600) - cam.x * 0.05) % (vw + 260);
          const px2 = bx < 0 ? bx + vw + 260 : bx;
          const rg = g.createRadialGradient(px2 - 130, HZ + 4, 0, px2 - 130, HZ + 4, 150);
          rg.addColorStop(0, `rgba(${i % 2 ? NE : AC},0.30)`);
          rg.addColorStop(1, `rgba(${i % 2 ? NE : AC},0)`);
          g.fillStyle = rg; g.fillRect(px2 - 280, HZ - 146, 300, 190);
        }
        g.globalCompositeOperation = "source-over";
      }
      for (let L = 0; L < 2; L++) {
        const par = 0.06 + L * 0.09, amp = 46 - L * 14, base = HZ + L * 16;
        /* Distant land is mostly ATMOSPHERE. Painting the far ridges in the
           ground's own colour put a band of vivid green across the sky; mixed
           most of the way toward the sky they read as hills seen through
           forty miles of air, which is what they are. */
        const far = mixHex(L === 0 ? W.rock : W.grass, W.sky[1], L === 0 ? 0.72 : 0.58);
        g.fillStyle = `rgb(${far[0]},${far[1]},${far[2]})`;
        g.globalAlpha = L === 0 ? 0.85 : 0.9;
        g.beginPath(); g.moveTo(-20, vh);
        for (let x = -20; x <= vw + 20; x += 14) {
          const n = fbm(geo.seed ^ (L ? 0x2f1d : 0x77c3), (x + cam.x * par) / 190, L * 8);
          g.lineTo(x, base + (n - 0.5) * amp * 2);
        }
        g.lineTo(vw + 20, vh); g.closePath(); g.fill();
        g.globalAlpha = 1;
      }

      /* ── the 3D pass ──
         One draw list, terrain and entities together, sorted by real camera
         depth and painted far to near. The world is the same height field it
         always was; only the camera in front of it changed. */
      const CM = makeCam(cam, vw, vh);
      const DL = []; DL.g = g;
      pushTerrain(DL, CM, W, geo, cam);
      DL.sort((u, v) => v.d - u.d);          // far first
      for (const it of DL) it.f();
      /* Ground positions still lift to whatever elevation the cell under them
         sits at — so a robot standing on a ridge stands ON it, not inside. */
      const groundH = (wx, wy) => TIER_H[terrainAt(geo.seed, wx, wy)] || 0;
      const proj = (wx, wy, h) => CM.project(wx, wy, h == null ? groundH(wx, wy) : h);
      /* Everything on screen keeps the size it had, and now shrinks with
         distance: rel() is 1.0 at the player's own depth, so every existing
         pixel measurement carries over untouched and simply gains perspective. */
      const meQ = CM.project(me.x, me.y, groundH(me.x, me.y));
      const SREF = meQ.d > 0 ? meQ.s : 1;
      const rel = (q) => (q && q.s ? q.s / SREF : 1);
      const sxOf = (wx, wy) => proj(wx, wy).x, syOf = (wx, wy) => proj(wx, wy).y;

      /* ── ground decals: only what is genuinely flat on the floor ──
         The towers and monoliths that used to live here now sort with the
         entities, because anything with height has to. */
      /* Decals are PROJECTED rings now. In perspective a circle on the floor
         is no longer an ellipse of fixed proportion — it opens out as it comes
         toward the camera — so each one is walked as 24 points. */
      const ringAt = (wx, wy, r) => ringPath(g, CM, wx, wy, r, groundH(wx, wy) + 0.6);
      g.fillStyle = W.accent + "10";
      if (ringAt(geo.town.x, geo.town.y, 108)) g.fill();
      g.strokeStyle = W.accent + "4a"; g.lineWidth = 2;
      if (ringAt(geo.town.x, geo.town.y, 108)) g.stroke();
      g.strokeStyle = W.accent + "33"; g.lineWidth = 1.4;
      for (let i = 1; i <= 3; i++) if (ringAt(geo.town.x, geo.town.y, i * 22)) g.stroke();

      const bossDone = !!saveRef.current.bosses[W.boss.id];
      const arenaS = proj(geo.arena.x, geo.arena.y);
      g.strokeStyle = bossDone ? "#7fe0a0aa" : "#ff5a5aaa"; g.lineWidth = 4;
      g.setLineDash([12, 9]); g.lineDashOffset = -tsec * 22;   // a live ring reads as a threshold
      if (ringAt(geo.arena.x, geo.arena.y, 96)) g.stroke();
      g.setLineDash([]); g.lineDashOffset = 0;
      g.fillStyle = bossDone ? "#7fe0a018" : "#ff5a5a1c";
      if (ringAt(geo.arena.x, geo.arena.y, 96)) g.fill();
      if (arenaS.d > 0) {
        g.font = `700 ${Math.max(9, 13 * arenaS.s * 40).toFixed(1)}px Rajdhani, sans-serif`; g.textAlign = "center";
        g.fillStyle = bossDone ? "#a8f0c0" : "#ffb0b0";
        g.fillText((bossDone ? "✓ " : "☠ ") + tr3(W.boss.name, lang), arenaS.x, arenaS.y - 96 * arenaS.s * 1.1);
      }

      /* ── entities, back to front ──
         One list, sorted on world Y, so everything overlaps the way the
         ground says it should. */
      const ents = [];
      const push = (o, k) => { const q = proj(o.x || 0, o.y || 0); if (q.d > 0) ents.push({ d: q.d, k, o, q }); };
      for (const n of geo.npcs) if (n) push(n, "npc");
      for (const pr of coop.peers) push(pr, "peer");
      for (const m of mobsRef.current) if (!m.dead) push(m, "mob");
      for (const tw of geo.towers) push(tw, "tower");
      for (const pl of geo.pillars) push(pl, "pillar");
      push(me, "me");
      // far to near, on real camera depth — a rotating camera has no shortcut
      ents.sort((a, b) => b.d - a.d);

      /* ── ground light, BEFORE the figures ──
         A lamp lights the floor around it; it does not wash itself out. Burning
         the additive pass in after the entities did exactly that — the player's
         own core bloom was the brightest thing on its own chassis and you could
         not read the model at all. Lighting the ground first and leaving only
         the small emissive parts on the figures themselves is both the correct
         order and the one that looks like light. */
      g.globalCompositeOperation = "lighter";
      for (const e of ents) {
        const pp = e.q; const ex = pp.x, ey = pp.y, k = rel(pp);
        if (ex < -160 || ex > vw + 160 || ey < -160 || ey > vh + 160) continue;
        const [lr0, rgb, a] =
          e.k === "me"     ? [104, hexRgb(W.glow), 0.20] :
          e.k === "npc"    ? [58, "255,215,122", 0.20] :
          e.k === "mob"    ? [40, "255,90,90", 0.18] :
          e.k === "tower"  ? [54, hexRgb(W.glow), 0.14] :
          e.k === "pillar" ? [40, bossDone ? "127,224,160" : "255,106,106", 0.14] :
                             [50, hexRgb(W.glow), 0.12];
        const lr = Math.max(6, lr0 * k);
        const rg = g.createRadialGradient(ex, ey + 6, 0, ex, ey + 6, lr);
        rg.addColorStop(0, `rgba(${rgb},${a})`);
        rg.addColorStop(0.5, `rgba(${rgb},${a * 0.3})`);
        rg.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = rg;
        g.fillRect(ex - lr, ey + 6 - lr, lr * 2, lr * 2);
      }
      g.globalCompositeOperation = "source-over";

      for (const e of ents) {
        const pp = e.q; const ex = pp.x, ey = pp.y, k = rel(pp);
        if (ex < -170 || ex > vw + 170 || ey < -200 || ey > vh + 200) continue;
        if (e.k === "npc") {
          drawBot(g, ex, ey, 1.05 * k, "#c9d6ee", 0, false, "#ffd77a");
          const hasWork = e.o.quests.some(qid => !(saveRef.current.quests[qid] || {}).done);
          if (hasWork) {
            g.fillStyle = "#ffd24d"; g.font = `900 ${(20 * k).toFixed(1)}px Rajdhani, sans-serif`; g.textAlign = "center";
            g.fillText("!", ex, ey - 30 * k + Math.sin(tsec * 4) * 3);
          }
          g.fillStyle = "#e8eefc"; g.font = `600 ${Math.max(8, 11 * k).toFixed(1)}px Rajdhani, sans-serif`; g.textAlign = "center";
          g.fillText(tr3(e.o.name, lang), ex, ey + 30 * k);
        } else if (e.k === "peer") {
          if (chassis) drawChassis(g, chassis, ex, ey, 62 * k, e.o.t || 0, 1, true);
          else drawBot(g, ex, ey, 1 * k, "#9fb6de", (e.o.t || 0), true, W.glow);
          g.fillStyle = "#cddaf2cc"; g.font = `600 ${Math.max(8, 10.5 * k).toFixed(1)}px Rajdhani, sans-serif`; g.textAlign = "center";
          g.fillText(String(e.o.name || "?").slice(0, 14), ex, ey + 30 * k);
        } else if (e.k === "mob") {
          const hurt = e.o.flash && now - e.o.flash < 140;
          drawMob(g, ex, ey, 1 * k, W.accent, e.o.t + tsec, hurt, e.o.sp);
        } else if (e.k === "tower" || e.k === "pillar") {
          /* A real solid: a footprint on the ground, two lit side faces and a
             cap. Drawn from the world footprint rather than as a rectangle on
             screen, so the building sits in the same space the terrain does
             and turns with it. */
          const tower = e.k === "tower";
          const R = tower ? 13 : 8, H = tower ? e.o.h + 22 : 40;
          const gh = groundH(e.o.x, e.o.y);
          const P = (dx, dy, hh) => proj(e.o.x + dx, e.o.y + dy, gh + hh);
          const b0 = P(-R, -R, 0), b1 = P(R, -R, 0), b2 = P(R, R, 0), b3 = P(-R, R, 0);
          const t0 = P(-R, -R, H), t1 = P(R, -R, H), t2 = P(R, R, H), t3 = P(-R, R, H);
          /* A tower painted in a mid grey is a daytime block of flats. At
             night the slab itself is nearly black and every readable thing on
             it — windows, trim, the beacon — is emitting. */
          const body = tower ? (W.rock || "#080e1e") : (bossDone ? "#0d2b1e" : "#2c0b12");
          const NE = hexRgb(W.neon || W.glow), WI = hexRgb(W.win || "#ffd28a");
          // cast shadow on the ground
          g.fillStyle = "rgba(0,4,12,.4)";
          g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(b1.x, b1.y); g.lineTo(b2.x, b2.y); g.lineTo(b3.x, b3.y); g.closePath(); g.fill();
          const face = (p, q, r2, u, k) => {
            g.fillStyle = shade(body, k);
            g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.lineTo(r2.x, r2.y); g.lineTo(u.x, u.y); g.closePath(); g.fill();
          };
          face(b3, b2, t2, t3, 1.0);        // front-left wall, away from the sun
          face(b2, b1, t1, t2, 1.5);        // front-right wall, catching it
          face(t0, t1, t2, t3, 2.2);        // cap
          /* windows: a grid on both visible faces, most of them dark, decided
             by a hash of the building so the same tower is lit the same way
             every frame and from every angle */
          {
            const rows = tower ? 7 : 3, cols = 3;
            const grid = (p0, p1, p2, p3, key) => {
              const at = (u, v) => {
                const bx = p0.x + (p1.x - p0.x) * u, by = p0.y + (p1.y - p0.y) * u;
                const tx = p3.x + (p2.x - p3.x) * u, ty = p3.y + (p2.y - p3.y) * u;
                return { x: bx + (tx - bx) * v, y: by + (ty - by) * v };
              };
              for (let r2 = 0; r2 < rows; r2++) for (let q = 0; q < cols; q++) {
                const hh = hash32("tw" + key + e.o.x + ":" + e.o.y + ":" + r2 + ":" + q);
                if (hh % 100 > 44) continue;
                const u0 = 0.13 + q * 0.27, v0 = 0.08 + r2 * (0.84 / rows);
                const uw = 0.17, vh2 = (0.84 / rows) * 0.44;
                const rgb = (hh >>> 9) % 4 ? WI : NE;
                const box = (pad, al) => {
                  const w0 = at(u0 - pad, v0 - pad * 0.7), w1 = at(u0 + uw + pad, v0 - pad * 0.7);
                  const w2 = at(u0 + uw + pad, v0 + vh2 + pad * 0.7), w3 = at(u0 - pad, v0 + vh2 + pad * 0.7);
                  g.fillStyle = `rgba(${rgb},${al})`;
                  g.beginPath(); g.moveTo(w0.x, w0.y); g.lineTo(w1.x, w1.y); g.lineTo(w2.x, w2.y); g.lineTo(w3.x, w3.y); g.closePath(); g.fill();
                };
                // a cheap bloom: one oversized card at low alpha, then the pane
                box(0.05, 0.1);
                box(0, (0.34 + (hh % 7) * 0.045).toFixed(2));
              }
            };
            grid(b3, b2, t2, t3, ":l");
            grid(b2, b1, t1, t2, ":r");
          }
          // the corner the two faces meet on, lit — it is what gives the slab
          // an edge against a sky that is nearly the same value
          g.strokeStyle = `rgba(${NE},.8)`; g.lineWidth = 1.6; g.lineCap = "round";
          g.beginPath();
          g.moveTo(b2.x, b2.y); g.lineTo(t2.x, t2.y);
          g.moveTo(t3.x, t3.y); g.lineTo(t2.x, t2.y); g.lineTo(t1.x, t1.y);
          g.stroke();
          // lit bands and the beacon on top
          for (const f of tower ? [0.42, 0.66] : [0.55]) {
            const q0 = P(R, -R, H * f), q1 = P(R, R, H * f);
            g.strokeStyle = tower ? W.glow : (bossDone ? "#7fe0a0" : "#ff6a6a");
            g.lineWidth = 3; g.globalAlpha = .7;
            g.beginPath(); g.moveTo(q0.x, q0.y); g.lineTo(q1.x, q1.y); g.stroke();
            g.globalAlpha = 1;
          }
          const cap = P(0, 0, H + 6);
          g.fillStyle = tower ? W.glow : (bossDone ? "#7fe0a0" : "#ff6a6a");
          g.globalAlpha = tower ? 1 : 0.45 + 0.4 * Math.abs(Math.sin(tsec * 1.6 + e.o.i * 0.7));
          g.beginPath(); g.arc(cap.x, cap.y, 3.2, 0, 6.284); g.fill();
          g.globalAlpha = 1;
        } else {
          if (chassis) drawChassis(g, chassis, ex, ey, 68 * k, me.t, me.dir, false);
          else drawBot(g, ex, ey, 1.15 * k, W.accent, me.t, false, W.glow);
        }
      }

      /* ── atmosphere ──
         A vignette and a low fog. Both are cheap and both do the same job:
         they push the edges of the frame back so the middle reads as near. */
      const vg = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(4,7,16,.34)");
      g.fillStyle = vg; g.fillRect(0, 0, vw, vh);

      /* ── weather ──
         Each planet gets the thing falling through its own air: ash over the
         mine, snow over the ice field, embers over the war zone. It is the
         layer that makes a place feel like it has weather rather than a
         palette. */
      const WX = { terra: null, ferros: "ember", glacius: "snow", emberfall: "ember", starsong: "spark" }[W.id];
      if (WX) {
        g.globalCompositeOperation = WX === "snow" ? "source-over" : "lighter";
        for (let i = 0; i < 46; i++) {
          const h = hash32("wx" + i + W.id);
          const spd = WX === "snow" ? 26 + (h % 22) : -50 - (h % 60);
          const wx0 = (h % 1400) - cam.x * 0.3 + Math.sin(tsec * 0.8 + i) * 22;
          const wy0 = ((h >>> 7) % 1400) - cam.y * 0.3 + tsec * spd;
          const fx = ((wx0 % (vw + 50)) + vw + 50) % (vw + 50) - 25;
          const fy = ((wy0 % (vh + 50)) + vh + 50) % (vh + 50) - 25;
          const r = px(WX === "snow" ? 1.4 + (i % 3) * 0.8 : 1 + (i % 4) * 0.7);
          g.fillStyle = WX === "snow" ? `rgba(226,240,255,${0.28 + (i % 4) * 0.1})`
            : WX === "ember" ? `rgba(255,${150 - (i % 5) * 20},70,${0.32 + (i % 4) * 0.12})`
            : `rgba(${hexRgb(W.glow)},${0.3 + (i % 4) * 0.12})`;
          g.beginPath(); g.arc(fx, fy, r, 0, 6.284); g.fill();
        }
        g.globalCompositeOperation = "source-over";
      }

      /* ── god rays ──
         Two wide shafts leaning in from the top, additive and very faint.
         They cost one gradient each and they are most of the difference
         between "a lit scene" and "a place with an atmosphere in it". */
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) {
        const rx0 = vw * (0.24 + i * 0.46) + Math.sin(tsec * 0.13 + i) * 30;
        const rg2 = g.createLinearGradient(rx0, 0, rx0 + vw * 0.24, vh * 0.9);
        rg2.addColorStop(0, `rgba(${hexRgb(W.glow)},.09)`);
        rg2.addColorStop(1, `rgba(${hexRgb(W.glow)},0)`);
        g.fillStyle = rg2;
        g.beginPath();
        g.moveTo(rx0 - vw * 0.1, 0); g.lineTo(rx0 + vw * 0.16, 0);
        g.lineTo(rx0 + vw * 0.44, vh); g.lineTo(rx0 + vw * 0.06, vh);
        g.closePath(); g.fill();
      }
      g.globalCompositeOperation = "source-over";

      // drifting motes, lit by the world's own glow
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 26; i++) {
        const h1 = hash32("mo" + i + W.id);
        const sp = 6 + (h1 % 14);
        const mx = ((h1 % 1600) - cam.x * 0.55 + tsec * sp) % (vw + 60);
        const my = (((h1 >>> 9) % 1600) - cam.y * 0.55 + Math.sin(tsec * 0.5 + i) * 26) % (vh + 60);
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
        g.fillText(q.txt, proj(q.x, q.y).x + 1, proj(q.x, q.y).y - k * 42 + 1);
        g.fillStyle = q.c;
        g.fillText(q.txt, proj(q.x, q.y).x, proj(q.x, q.y).y - k * 42);
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

  /* ── the arena sim ───────────────────────────────────────────────────
     Spacing is the whole game between questions: the foe closes in, you back
     off, and a punch only lands if you are actually inside its reach. The
     numbers live in a ref and are mirrored into state at ~20fps, because a
     spacing duel does not need 60 renders a second and the canvas has its
     own loop anyway. */
  const btRef = useRef({ me: 0.24, foe: 0.76, guard: 0, qIn: QUESTION_EVERY, foeCd: 2.2, cd: { punch: 0, kick: 0, guard: 0 }, tell: 0, tellAt: 0, guardAt: 0, combo: 0, comboAt: 0, od: 0 });
  const [bt, setBt] = useState(() => ({ ...btRef.current }));
  const resetArena = useCallback(() => {
    btRef.current = { me: 0.24, foe: 0.76, guard: 0, qIn: QUESTION_EVERY, foeCd: 2.4, cd: { punch: 0, kick: 0, guard: 0 }, tell: 0, tellAt: 0, guardAt: 0, combo: 0, comboAt: 0, od: 0 };
    setBt({ ...btRef.current });
    setBnr(null);
  }, []);

  useEffect(() => {
    const f = fight;
    if (!f || f.over || f.kind === "quiz" || ctrl) return;
    let raf = 0, last = performance.now();
    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const b = btRef.current, cur = fightRef.current;
      if (!cur || cur.over) return;
      for (const k of ["punch", "kick", "guard"]) b.cd[k] = Math.max(0, b.cd[k] - dt);
      b.guard = Math.max(0, b.guard - dt);
      b.hitLag = Math.max(0, b.hitLag - dt);

      if (cur.phase === "act" && !revealRef.current) {
        // the clock that brings the next question
        b.qIn = Math.max(0, b.qIn - dt);
        // the foe walks you down, then swings when it is in reach
        const gap = b.foe - b.me;
        /* The gaps are tuned to how wide the figures actually draw: at rest
           their centres sit 0.5 of the stage apart, so "in your face" is
           0.34, not 0.16 — which had the foe standing inside the player. */
        if (gap > 0.36) b.foe = Math.max(b.me + 0.34, b.foe - dt * 0.15);
        else if (gap < 0.32) b.foe = Math.min(0.79, b.foe + dt * 0.1);
        /* The wind-up is the whole reason guard is a skill. The foe tells
           for a beat before it swings; guard pressed INSIDE that beat is a
           parry, guard held from before it is only a block. */
        b.foeCd -= dt;
        if (b.tell > 0) {
          b.tell -= dt;
          if (b.tell <= 0) { b.tell = 0; foeSwing(); }
        } else if (b.foeCd <= 0 && gap < 0.44) {
          b.foeCd = cur.boss ? 1.9 : 2.5;
          b.tell = TELL; b.tellAt = now;
          playWhoosh();
        }
        // the combo lapses if you stop hitting
        if (b.combo > 0 && now - b.comboAt > 1600) b.combo = 0;
        if (b.qIn <= 0) {
          b.qIn = QUESTION_EVERY;
          setFight({ ...cur, phase: "quiz", q: makeQuestion(lang) });
        }
      }
      const G = fxRef.current;
      if (G) G.setPos(b.me, b.foe, 0, 0);
      if (now - (b.sync || 0) > 50) { b.sync = now; setBt({ ...b, cd: { ...b.cd } }); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fight && fight.kind, fight && fight.phase, fight && fight.over, ctrl, lang]);

  /** The foe's own swing. A parry beats it outright, guard eats most of it,
      and distance eats all of it. */
  function foeSwing() {
    const b = btRef.current, f = fightRef.current;
    if (!f || f.over) return;
    const G = fxRef.current;
    if (G) { G.swipe("op", "#ff6a6a", "punch"); window.setTimeout(() => G.impact("me", 1.1, "#ff6a6a", "punch"), 140); }
    // guard raised INSIDE the wind-up: read the tell, take the round
    if (b.guard > 0 && b.guardAt >= b.tellAt) {
      b.od = Math.min(100, b.od + 26);
      b.foeCd = 1.5; b.foe = Math.min(0.79, b.foe + 0.08);
      haptic(26); playBoom(true);
      if (G) { G.flash("#8fd0ff", .6, .34); G.burst("me", 2.4, "#8fd0ff"); }
      banner(T("สวนกลับ!", "PARRY!", "招架!"), "parry");
      pop(meRef.current.x, meRef.current.y - 24, T("สวนกลับ!", "PARRY!", "招架!"), "#8fd0ff", true);
      setBt({ ...b });
      // the free counter a parry earns
      window.setTimeout(() => landHit("kick", 0.5, true), 120);
      return;
    }
    playMiss();
    if (b.guard > 0) { haptic(8); pop(meRef.current.x, meRef.current.y - 20, T("กัน", "BLOCK", "格挡"), "#7fd0ff", false); return; }
    const dmg = Math.max(2, Math.round(mobHit(saveRef.current, f.boss) * 0.42));
    haptic(16);
    setHurtMe(true); window.setTimeout(() => setHurtMe(false), 200);
    setShake(x => x + 1); window.setTimeout(() => setShake(0), 240);
    pop(meRef.current.x, meRef.current.y - 20, "-" + dmg, "#ff6a6a", false);
    setHp(h => {
      const nh = Math.max(0, h - dmg);
      if (nh <= 0) window.setTimeout(loseFight, 380);
      return nh;
    });
  }

  /** A player action. Chip damage on a cooldown, and only inside reach —
      the questions are still where the big hits come from. */
  function act(kind) {
    const b = btRef.current, f = fightRef.current;
    if (!f || f.over || f.phase !== "act" || revealRef.current) return;
    if (kind === "left")  { b.me = Math.max(0.18, b.me - 0.06); setBt({ ...b }); return; }
    if (kind === "right") { b.me = Math.min(b.foe - 0.28, b.me + 0.06); setBt({ ...b }); return; }
    if (kind === "guard") {
      if (b.cd.guard > 0) return;
      b.cd.guard = 1.6; b.guard = 0.85; b.guardAt = performance.now();
      haptic(6); playWhoosh(); setBt({ ...b }); return;
    }
    if (kind === "ult") {
      if (b.od < 100) return;
      b.od = 0; b.cd.punch = 0.9; b.cd.kick = 0.9; setBt({ ...b });
      const G0 = fxRef.current;
      if (G0) { G0.flash("#ffffff", .9, .55); G0.beam("op", W.glow); }
      banner(T("โอเวอร์ไดรฟ์!", "OVERDRIVE!", "超载!"), "ult");
      setCine(true); window.setTimeout(() => setCine(false), 1400);
      [0, 190, 380].forEach((d, i) => window.setTimeout(() => landHit(i === 2 ? "ult" : "kick", i === 2 ? 1.5 : 0.6, true), d));
      return;
    }
    const M = MOVE_KIND[kind];
    if (!M || b.cd[kind] > 0) return;
    b.cd[kind] = M.cd; setBt({ ...b });
    const G = fxRef.current;
    if (G) G.swipe("me", W.glow, M.fx);
    if (Math.abs(b.foe - b.me) > M.reach) { playMiss(); haptic(4); b.combo = 0; return; }
    landHit(kind, M.mult, false);
  }

  /** One landed blow. Combo escalates the damage and feeds the overdrive
      meter, which is what turns a string of hits into a run worth chasing. */
  function landHit(kind, mult, free) {
    const b = btRef.current, f = fightRef.current;
    if (!f || f.over) return;
    const now = performance.now();
    b.combo = (now - b.comboAt < 1600 ? b.combo : 0) + 1;
    b.comboAt = now;
    b.od = Math.min(100, b.od + (kind === "kick" ? 9 : kind === "ult" ? 0 : 6));
    const chain = 1 + Math.min(b.combo, 8) * 0.09;
    const dmg = Math.max(1, Math.round(playerHit(saveRef.current, 0) * mult * chain));
    const G = fxRef.current;
    if (G) G.impact("op", kind === "ult" ? 2.6 : kind === "kick" ? 1.5 : 1.1, W.accent, kind === "ult" ? "nova" : kind);
    playBoom(b.combo >= 5 || !!free); haptic(kind === "kick" ? 14 : 8);
    setHurtFoe(true); window.setTimeout(() => setHurtFoe(false), 150);
    const m = mobsRef.current.find(x => x.id === f.mobId);
    const tx = f.kind === "boss" ? geo.arena.x : (m ? m.x : meRef.current.x);
    const ty = f.kind === "boss" ? geo.arena.y : (m ? m.y : meRef.current.y);
    pop(tx, ty - 18, "-" + dmg, b.combo >= 5 ? "#ffd24d" : "#ffffff", b.combo >= 5);
    if (b.combo === 5) banner(T("คอมโบ 5!", "5 HIT COMBO!", "5连击!"), "combo");
    if (b.combo === 10) banner(T("คอมโบ 10!!", "10 HIT COMBO!!", "10连击!!"), "combo");
    setBt({ ...b });
    const nhp = Math.max(0, f.hp - dmg);
    if (nhp <= 0) { winFight(f); return; }
    setFight({ ...f, hp: nhp });
  }

  // ── fights ──────────────────────────────────────────────────────────
  /* A fight is a FIGHT first. It opens in the action phase — thumbs on the
     pad, punching and kicking and backing off — and a question lands every
     QUESTION_EVERY seconds. Gating every single blow behind a music question
     turned a boss into a worksheet with a health bar; this is the balance
     the game was missing between playing and learning. */
  function startFight(mob) {
    playUi("click");
    setFight({
      kind: "mob", boss: false, mobId: mob.id, hp: mob.hp * 62, max: mob.hp * 62,
      phase: "act", q: null, streak: 0, wrongRun: 0, sp: mob.sp,
      name: mob.sp ? foeName(mob.sp, lang) : tr3(W.mob, lang), col: W.accent,
    });
    resetArena();
  }
  function startBoss() {
    const b = W.boss;
    playUi("click");
    setFight({
      kind: "boss", boss: true, hp: b.hp, max: b.hp,
      phase: "act", q: null, streak: 0, wrongRun: 0, sp: BOSS_SP[W.id],
      name: tr3(b.name, lang), col: "#ff6a6a", line: tr3(b.line, lang),
    });
    resetArena();
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
      /* Throw the thing. The move escalates with the streak, so a run of
         right answers visibly builds from a jab to a nova instead of
         replaying one animation. */
      const mv = moveFor(f.streak);
      const G = fxRef.current;
      if (G) {
        if (mv.fx === "swipe") { G.swipe("me", W.glow, "punch"); window.setTimeout(() => G.impact("op", 1.2, W.glow, "punch"), 150); }
        else if (mv.fx === "bolt") { G.muzzle("me", "hand", W.glow); G.bolt("me", W.glow, 6); window.setTimeout(() => G.burst("op", 1.2, W.glow), 130); }
        else if (mv.fx === "laser") { G.muzzle("me", "hand", "#ff4d6a"); G.laser("me", "#ff4d6a", 6); window.setTimeout(() => G.boom("op", 1.3, "#ff9a3c"), 150); }
        else if (mv.fx === "lob") { G.lob("me", "#ff9a3c", () => G.boom("op", 1.6, "#ff9a3c")); }
        else { G.flash("#ffffff", .55, .3); G.boom("op", 2.2, W.glow); G.burst("op", 2, "#ffd23f"); }
      }
      playBoom(crit); haptic(crit ? 22 : 10);
      setHurtFoe(true); window.setTimeout(() => setHurtFoe(false), 190);
      /* Chip damage is what the pad is for; the ANSWER is the heavy hit, and
         it is floored at a share of the foe's whole bar so it stays the
         heaviest thing in the fight however long the fight runs. */
      const dmg = Math.max(playerHit(saveRef.current, f.streak) * (f.kind === "boss" ? 1 : 1.4), f.max * 0.17);
      const nhp = Math.max(0, f.hp - dmg);
      // the number lands on the thing that was hit, out in the world
      const m = mobsRef.current.find(x => x.id === f.mobId);
      const tx = f.kind === "boss" ? geo.arena.x : (m ? m.x : meRef.current.x);
      const ty = f.kind === "boss" ? geo.arena.y : (m ? m.y : meRef.current.y);
      if (m) m.flash = performance.now();
      pop(tx, ty - 18, "-" + Math.round(dmg), crit ? "#ffd24d" : "#ffffff", crit);
      if (f.kind === "boss") coop.shout({ id: W.boss.id, dmg: Math.round(dmg), by: playerName });
      btRef.current.od = Math.min(100, btRef.current.od + 30);
      if (nhp <= 0) return winFight(f);
      setReveal({ q: f.q, chosen: opt });
      setFight({ ...f, hp: nhp, streak: f.streak + 1, wrongRun: 0, flash: Date.now() });
      return;
    }

    playMiss(); haptic(30);
    const G2 = fxRef.current;
    if (G2) {
      G2.swipe("op", "#ff6a6a", "punch");
      window.setTimeout(() => { G2.impact("me", 1.3, "#ff6a6a", "punch"); G2.flash("#ff2a2a", .34, .22); }, 150);
    }
    setHurtMe(true); window.setTimeout(() => setHurtMe(false), 220);
    setShake(x => x + 1); window.setTimeout(() => setShake(0), 300);
    const dmg = mobHit(saveRef.current, f.kind === "boss");
    pop(meRef.current.x, meRef.current.y - 20, "-" + dmg, "#ff6a6a", false);
    hitFlashRef.current = 1;
    const nh = Math.max(0, hp - dmg);
    setHp(nh);
    const wrongRun = f.wrongRun + 1;
    if (nh <= 0) return loseFight();
    // the lore's own rule, made mechanical: you cannot fight your way out
    // of losing your composure — you have to play your way out
    setReveal({ q: f.q, chosen: opt });
    if (wrongRun >= 2 || nh < maxHp(saveRef.current) * 0.34) {
      setFight({ ...f, streak: 0, wrongRun: 0, destab: (f.destab || 0) + 1 });
      setCtrl({ step: 0, bad: null, n: f.destab || 0 });
      return;
    }
    setFight({ ...f, streak: 0, wrongRun });
  }

  /* Dismissing the reveal is what deals the next question. Answering and
     advancing used to be one action, which meant the answer was on screen
     for exactly as long as it took to read the next one. */
  function nextQ() {
    setReveal(null);
    const f = fightRef.current;
    if (f && !f.over) {
      if (f.kind === "quiz") { setFight({ ...f, q: makeQuestion(lang) }); return; }
      // back to the fight, with the next question a full window away
      btRef.current.qIn = QUESTION_EVERY;
      btRef.current.foeCd = 1.2;
      setFight({ ...f, phase: "act", q: null });
    }
  }

  function winFight(f) {
    const s = saveRef.current;
    if (f.kind === "boss") {
      commit({ ...s, bosses: { ...s.bosses, [W.boss.id]: true } });
      const q = (QUESTS[s.world] || []).find(x => x.kind === "boss");
      if (q) { bumpQuest(q.id, 1); award(q.stat, 6, tr3(W.boss.name, lang)); }
      onReward(60, 40);
      setReveal(null);
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
    setReveal(null); setFight(null);
  }
  function loseFight() {
    setFight(null); setCtrl(null); setReveal(null);
    const me = meRef.current;
    const sp = nearestWalkable(geo.seed, geo.town.x, geo.town.y + 60);
    me.x = sp.x; me.y = sp.y;
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
      setReveal({ q: f.q, chosen: opt });
      if (wrongRun >= 2) { setFight({ ...f, wrongRun: 0, destab: (f.destab || 0) + 1 }); setCtrl({ step: 0, bad: null, n: f.destab || 0 }); return; }
      setFight({ ...f, wrongRun, streak: 0 });
      return;
    }
    playBoom(false); haptic(10);
    // banked one answer at a time rather than only at the end, so closing the
    // app mid-run costs nothing that was already earned
    const got = f.got + 1;
    bumpQuest(f.quest.id, 1);
    if (got >= f.need) {
      setFight(null); setReveal(null);
      setTalk({ npcName: f.quest.giver, quest: f.quest, phase: "done" });
      return;
    }
    setReveal({ q: f.q, chosen: opt });
    setFight({ ...f, got, streak: f.streak + 1, wrongRun: 0 });
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

      {/* ── the opening card for a world you have not stood on before ──
          An establishing shot rather than a paragraph on a card: the premise
          is a colonial empire that beat death and still lost to its own
          temper, and that deserves a title sequence. */}
      {screen === "intro" && <CinematicIntro W={W} lang={lang} onDone={beginWorld} />}

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
          {/* the same grade the arena wears: a filmic curve, a vignette and
              moving grain, so the world is photographed rather than drawn */}
          <div className="ssgrade" aria-hidden="true"><span className="ssb-grain" /></div>

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

      {/* ── a real fight leaves the map ──
          Mob and boss fights take over the screen so you can watch them
          happen; a quiz run stays a card, because a quiz is not a fight and
          dressing it as one would be a lie about what you are doing. */}
      {f && !ctrl && f.kind !== "quiz" && !f.over && (
        <BattleScreen
          lang={lang} W={W} hp={hp} maxHpV={maxHp(save)}
          foe={f} shake={shake} hurtFoe={hurtFoe} hurtMe={hurtMe} playing={fxRef}
          reveal={reveal} onNextQ={nextQ} bt={bt} onAct={act} bnr={bnr} cine={cine}
          chassisEl={<CyberAvatar model={charModel} yaw={52} pose="ready" glow={W.glow} accent={W.accent} armorA="#161d2c" armorB="#3d5878" />}
          onAnswer={answer}
          onFlee={() => { setFight(null); setReveal(null); say(T("ถอยออกมาแล้ว", "Disengaged.", "已脱离。")); }} />
      )}

      {/* quiz runs, and the win card either kind ends on */}
      {f && !ctrl && (f.kind === "quiz" || f.over) && (
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
                  <span className="ssfight-hp-n">{f.got}/{f.need}</span>
                </div>
                <div className="ssfight-bar"><i style={{ width: (f.got / f.need) * 100 + "%" }} /></div>
                {reveal ? <AnswerReveal q={reveal.q} chosen={reveal.chosen} lang={lang} onNext={nextQ} /> : <>
                  {f.streak > 1 && <div className="ssstreak">×{f.streak} {T("ต่อเนื่อง", "streak", "连击")}</div>}
                  <div className="ssq">{f.q.q}</div>
                  <div className="ssopts">
                    {f.q.opts.map(o => <button key={o} className="ssopt" onClick={() => quizAnswer(o)}>{o}</button>)}
                  </div>
                </>}
                <button className="ssflee" onClick={() => { setFight(null); setReveal(null); say(T("หยุดไว้ก่อน", "Paused — progress is saved.", "已暂停 — 进度已保存。")); }}>
                  {T("พอก่อน", "Stop for now", "先停下")}
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
      {/* A flat dark disc read as "a circle"; a ringed world with a ship
          arcing away from it reads as somewhere to go. */}
      <span className="sspod-art" aria-hidden="true">
        <svg viewBox="0 0 60 46" width="100%" height="100%">
          <defs>
            <radialGradient id="ssp-w" cx="0.34" cy="0.28" r="0.85">
              <stop offset="0%" stopColor={W.sky[2]} />
              <stop offset="62%" stopColor={W.sky[1]} />
              <stop offset="100%" stopColor={W.sky[0]} />
            </radialGradient>
          </defs>
          <circle cx="14" cy="7" r="1.5" fill={W.glow} opacity=".8" />
          <circle cx="50" cy="34" r="1.1" fill={W.glow} opacity=".6" />
          <circle cx="46" cy="9" r="1" fill="#fff" opacity=".5" />
          <circle cx="27" cy="26" r="13" fill="url(#ssp-w)" />
          <circle cx="22" cy="21" r="4.6" fill="#fff" opacity=".16" />
          <ellipse cx="27" cy="26" rx="21" ry="6.4" fill="none" stroke={W.accent} strokeWidth="2" opacity=".85" transform="rotate(-20 27 26)" />
          <ellipse cx="27" cy="26" rx="21" ry="6.4" fill="none" stroke="#fff" strokeWidth=".7" opacity=".35" transform="rotate(-20 27 26)" />
          {/* the ship, and the trail that says it is leaving */}
          <path d="M52 6 L56 12 L49.5 12.6 Z" fill={W.glow} />
          <path d="M40 20 C45 15 49 10 51.5 7" fill="none" stroke={W.glow} strokeWidth="1.5" strokeLinecap="round" opacity=".55" strokeDasharray="3 3" />
        </svg>
      </span>
      <b>{T("โหมดผจญภัย", "Adventure Mode", "冒险模式")}</b>
      {started
        ? <i>{tr3(W.name, lang)} · {T("แรงก์", "Rk", "阶")} {chassisLevel(save)}</i>
        : <i>{T("เริ่มเลย", "Start", "开始")}</i>}
      {openQ && <em aria-label={T("มีเควสต์ค้างอยู่", "Quest available", "有任务")} />}
    </button>
  );
});
