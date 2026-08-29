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
  { id: "sparkit",  code: "PT-01", type: "volt",  build: "biped", head: "round",  ear: "bolt",  tail: "spark", eye: "big",
    sw: ["#ffe14d", "#7a5a00"], food: "pf-cell",
    th: "สปาร์คกิต", en: "Sparkit", zh: "电火兽", bonus: "dmg",
    dth: "ลูกไฟฟ้าจอมซน ชอบชาร์จตัวเองจนขนลุก", den: "A restless little charge that fluffs up when it powers on.", dzh: "顽皮的小电球，充能时全身炸毛。" },
  { id: "cindra",   code: "PT-02", type: "ember", build: "quad", head: "sharp",    ear: "horn",  tail: "flame", eye: "sharp",
    sw: ["#ff8a4c", "#5c1a00"], food: "pf-coal",
    th: "ซินดร้า", en: "Cindra", zh: "炽焰兽", bonus: "dmg",
    dth: "แมวเครื่องยนต์ หายใจเป็นไอร้อน", den: "An engine-cat that breathes warm exhaust when happy.", dzh: "引擎猫，开心时呼出热气。" },
  { id: "nimbo",    code: "PT-03", type: "frost", build: "float", head: "round",   ear: "fin",   tail: "wisp",  eye: "sleepy",
    sw: ["#8fe8ff", "#0d4a66"], food: "pf-ice",
    th: "นิมโบ", en: "Nimbo", zh: "霜云兽", bonus: "guard",
    dth: "ก้อนเมฆเย็นที่ลอยตามเจ้าของไปทุกที่", den: "A cold little cloud that drifts wherever you go.", dzh: "冷冷的小云，总跟着主人飘。" },
  { id: "verdle",   code: "PT-04", type: "flora", build: "biped", head: "blob",  ear: "leaf",  tail: "vine",  eye: "big",
    sw: ["#6fe39b", "#0d3a24"], food: "pf-seed",
    th: "เวิร์ดเดิ้ล", en: "Verdle", zh: "苗芽兽", bonus: "heal",
    dth: "ต้นกล้าไซเบอร์ที่งอกใบใหม่ทุกครั้งที่ถูกชม", den: "A cyber-sprout that grows a new leaf every time it is praised.", dzh: "赛博幼苗，被夸奖就长新叶。" },
  { id: "bolton",   code: "PT-05", type: "steel", build: "biped", head: "boxy",   ear: "bolt",  tail: "gear",  eye: "visor",
    sw: ["#b8c2d4", "#2a3346"], food: "pf-bolt",
    th: "โบลตัน", en: "Bolton", zh: "螺钉兽", bonus: "guard",
    dth: "หุ่นเหลี่ยมใจดี ชอบให้ขัดเงาให้เงาวับ", den: "A blocky, good-natured thing that lives to be polished.", dzh: "方方正正的好脾气，最爱被擦亮。" },
  { id: "lumen",    code: "PT-06", type: "aether",build: "float", head: "blob",   ear: "halo",  tail: "wisp",  eye: "starry",
    sw: ["#c7a6ff", "#2a1050"], food: "pf-prism",
    th: "ลูเมน", en: "Lumen", zh: "流光兽", bonus: "sp",
    dth: "แสงที่จับตัวเป็นก้อน เรืองขึ้นเมื่ออารมณ์ดี", den: "Light that decided to become a body. It glows when it is content.", dzh: "凝成实体的光，心情好时会发亮。" },
  { id: "zapaw",    code: "PT-07", type: "volt",  build: "quad", head: "sharp",    ear: "fin",   tail: "spark", eye: "sharp",
    sw: ["#ffd84d", "#4a3200"], food: "pf-cell",
    th: "แซปพอว์", en: "Zapaw", zh: "雷爪兽", bonus: "dmg",
    dth: "อุ้งเท้าปล่อยประกาย วิ่งเร็วจนเห็นเป็นเส้น", den: "Sparks off its paws and runs fast enough to blur.", dzh: "爪下带电，跑起来只剩残影。" },
  { id: "pyrix",    code: "PT-08", type: "ember", build: "biped", head: "boxy",   ear: "horn",  tail: "flame", eye: "visor",
    sw: ["#ff6a3c", "#3a0d00"], food: "pf-coal",
    th: "ไพริกซ์", en: "Pyrix", zh: "熔炉兽", bonus: "dmg",
    dth: "เตาหลอมเดินได้ อุ่นมือได้ในหน้าหนาว", den: "A walking furnace. Excellent to hold in winter.", dzh: "会走路的熔炉，冬天抱着正好。" },
  { id: "glacio",   code: "PT-09", type: "frost", build: "quad", head: "round",    ear: "horn",  tail: "gear",  eye: "sleepy",
    sw: ["#a6e8ff", "#123f5c"], food: "pf-ice",
    th: "เกลเซีย", en: "Glacio", zh: "冰晶兽", bonus: "guard",
    dth: "ขนเป็นเกล็ดน้ำแข็ง เดินแล้วมีเสียงกรุ๊งกริ๊ง", den: "A coat of ice scales that chimes softly as it walks.", dzh: "冰鳞外衣，走动时叮当作响。" },
  { id: "mossel",   code: "PT-10", type: "flora", build: "float", head: "blob",   ear: "leaf",  tail: "vine",  eye: "sleepy",
    sw: ["#8fe0a8", "#14432c"], food: "pf-seed",
    th: "มอสเซล", en: "Mossel", zh: "苔壳兽", bonus: "heal",
    dth: "ก้อนมอสอบอุ่น ชอบนอนกลางแดดอ่อน", den: "A warm lump of moss that sleeps in soft light.", dzh: "温暖的苔藓球，爱在柔光下打盹。" },
  { id: "cogsy",    code: "PT-11", type: "steel", build: "quad", head: "boxy",  ear: "bolt",  tail: "gear",  eye: "starry",
    sw: ["#cdd6e6", "#3a4459"], food: "pf-bolt",
    th: "ค็อกซี่", en: "Cogsy", zh: "齿轮兽", bonus: "sp",
    dth: "เฟืองน้อยขยัน หมุนตัวเองเวลาตื่นเต้น", den: "A busy little cog that spins itself when excited.", dzh: "勤劳的小齿轮，兴奋时自转。" },
  { id: "astrel",   code: "PT-12", type: "aether",build: "biped", head: "sharp",   ear: "halo",  tail: "wisp",  eye: "starry",
    sw: ["#b9a6ff", "#1a1040"], food: "pf-prism",
    th: "แอสเทรล", en: "Astrel", zh: "星舆兽", bonus: "sp",
    dth: "พกดาวไว้ในตัว บอกทางกลับบ้านได้เสมอ", den: "Carries a star inside. Always knows the way home.", dzh: "体内藏着星星，永远知道回家的路。" },
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
  heal:  { k: "heal",  v: 0.08, th: "ฟื้นเลือดต้นยกทุกยก", en: "Heal at the start of each wave", zh: "每波开始回血" },
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
export const petStage = (bond) => (petLevel(bond).lv >= 9 ? 3 : petLevel(bond).lv >= 4 ? 2 : 1);
export const petHappy = (p) => Math.round(((p.hunger + p.clean + p.coat + p.mood) / 4));

/* ══════════════════════ the creature ══════════════════════ */

/* Ground line and the three body plans. A pet is not a floating head: it has
   a build, and the build is most of what you recognise it by across a room.
   Bipeds stand, quads crouch on four, floaters never touch the floor. */
const GROUND = 127;
const LAY = {
  biped: [
    { hy: 56, hr: 25, by: 92, bw: 30, bh: 26, arm: 15 },
    { hy: 50, hr: 24, by: 88, bw: 35, bh: 32, arm: 19 },
    { hy: 43, hr: 23, by: 83, bw: 40, bh: 38, arm: 23 },
  ],
  quad: [
    { hy: 64, hr: 24, by: 98, bw: 44, bh: 26, arm: 0 },
    { hy: 58, hr: 24, by: 95, bw: 50, bh: 30, arm: 0 },
    { hy: 54, hr: 23, by: 92, bw: 56, bh: 34, arm: 0 },
  ],
  float: [
    { hy: 54, hr: 26, by: 88, bw: 26, bh: 24, arm: 11 },
    { hy: 48, hr: 25, by: 84, bw: 30, bh: 28, arm: 14 },
    { hy: 42, hr: 24, by: 80, bw: 34, bh: 32, arm: 17 },
  ],
};

/* Two path helpers do nearly all the geometry — an ellipse and a rounded box.
   Everything (torso, limbs, plates, hatches) is one of those two, which is
   what keeps twelve creatures from drifting into twelve different styles. */
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
};

/** One creature, built from its parts and its stage.
    Draw order is back-to-front: tail, back limbs, wings, torso, front limbs,
    neck, head, ears, face. Everything shares one light rig so a pet standing
    next to a chassis in the arena looks like it came out of the same shop. */
export const PetArt = memo(function PetArt({ species, stage = 1, mood = 80, size, className = "" }) {
  const sp = petById(species);
  const st = Math.max(1, Math.min(3, Math.round(stage) || 1));
  const uid = "pt" + sp.id + st;
  const A = sp.sw[0], B = sp.sw[1];
  const T = PET_TYPES[sp.type] || PET_TYPES.steel;
  const sad = mood < 35;
  const L = (LAY[sp.build] || LAY.biped)[st - 1];
  const cx = 60, hy = L.hy, hr = L.hr, by = L.by, bw = L.bw, bh = L.bh;
  const bTop = by - bh / 2, bBot = by + bh / 2;

  const F = `url(#${uid}-body)`;
  const D = `url(#${uid}-limb)`;
  /* fill → form shadow → key highlight → outline, same five-pass rig as the
     robots and the gear */
  const P = (d, f, o = {}) => (
    <g>
      <path d={d} fill={f} />
      <path d={d} fill={`url(#${uid}-occ)`} opacity={o.occ == null ? 1 : o.occ} />
      <path d={d} fill={`url(#${uid}-spec)`} opacity={o.spec == null ? 1 : o.spec} />
      <path d={d} fill="none" stroke={B} strokeWidth={o.lw || 1.7} strokeLinejoin="round" opacity={o.lineOp == null ? .9 : o.lineOp} />
    </g>
  );
  const seam = (d, o = .45) => <path d={d} fill="none" stroke={B} strokeWidth="1.2" strokeLinecap="round" opacity={o} />;

  /* ── ears ── drawn behind the head so they read as attached to it */
  const EARS = {
    bolt: <>{[-1, 1].map(k => (
      <path key={k} d={`M${cx + k * hr * .5} ${hy - hr * .78} L${cx + k * hr * .3} ${hy - hr * 1.86} L${cx + k * hr * 1.32} ${hy - hr * 1.42} L${cx + k * hr * .82} ${hy - hr * 1.38} L${cx + k * hr * 1.2} ${hy - hr * .74} Z`}
        fill={A} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />))}</>,
    horn: <>{[-1, 1].map(k => (
      <path key={k} d={`M${cx + k * hr * .58} ${hy - hr * .7} C${cx + k * hr * .68} ${hy - hr * 1.42} ${cx + k * hr * 1.3} ${hy - hr * 1.74} ${cx + k * hr * 1.62} ${hy - hr * 1.64} C${cx + k * hr * 1.32} ${hy - hr * 1.3} ${cx + k * hr * 1.24} ${hy - hr * .82} ${cx + k * hr * 1.06} ${hy - hr * .5} Z`}
        fill={A} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />))}</>,
    fin:  <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={`M${cx + k * hr * .62} ${hy - hr * .5} C${cx + k * hr * 1.3} ${hy - hr * 1.16} ${cx + k * hr * 1.96} ${hy - hr * 1.02} ${cx + k * hr * 2.04} ${hy - hr * .44} C${cx + k * hr * 1.6} ${hy - hr * .18} ${cx + k * hr * 1.06} ${hy + hr * .06} ${cx + k * hr * .78} ${hy + hr * .18} Z`}
          fill={A} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />
        <path d={`M${cx + k * hr * .96} ${hy - hr * .48} L${cx + k * hr * 1.72} ${hy - hr * .56}`} stroke={B} strokeWidth="1.1" opacity=".45" />
      </g>))}</>,
    leaf: <>{[-1, 1].map(k => (
      <path key={k} d={`M${cx + k * hr * .24} ${hy - hr * .82} C${cx + k * hr * .3} ${hy - hr * 1.8} ${cx + k * hr * 1.06} ${hy - hr * 2.0} ${cx + k * hr * 1.5} ${hy - hr * 1.78} C${cx + k * hr * 1.16} ${hy - hr * 1.42} ${cx + k * hr * .8} ${hy - hr * 1.06} ${cx + k * hr * .52} ${hy - hr * .78} Z`}
        fill={A} stroke={B} strokeWidth="1.5" strokeLinejoin="round" />))}
      {seam(`M${cx} ${hy - hr * .9} V${hy - hr * 1.7}`, .4)}</>,
    halo: <>
      <ellipse cx={cx} cy={hy - hr * 1.42} rx={hr * .96} ry={hr * .28} fill="none" stroke={A} strokeWidth="4.2" opacity=".92" />
      <ellipse cx={cx} cy={hy - hr * 1.42} rx={hr * .96} ry={hr * .28} fill="none" stroke="#fff" strokeWidth="1.3" opacity=".7" />
      {seam(`M${cx} ${hy - hr * .96} V${hy - hr * 1.3}`, .5)}</>,
  };

  /* ── tails ── anchored to the back of the torso */
  /* tails hang off the back of the torso, clamped so a wide quad's tail
     still fits inside the box */
  const tx = cx + Math.min(bw * .48, 21), ty = by - bh * .1;
  const TAILS = {
    spark: <path d={`M${tx} ${ty + 4} L${tx + 15} ${ty - 10} L${tx + 7} ${ty + 1} L${tx + 20} ${ty - 2} L${tx + 3} ${ty + 17} L${tx + 8} ${ty + 3} Z`} fill={A} stroke={B} strokeWidth="1.4" strokeLinejoin="round" />,
    flame: <path d={`M${tx - 2} ${ty + 8} C${tx + 12} ${ty + 4} ${tx + 18} ${ty - 8} ${tx + 15} ${ty - 20} C${tx + 24} ${ty - 8} ${tx + 25} ${ty + 10} ${tx + 12} ${ty + 18} C${tx + 5} ${ty + 21} ${tx - 2} ${ty + 16} ${tx - 2} ${ty + 8} Z`} fill={A} stroke={B} strokeWidth="1.4" strokeLinejoin="round" />,
    wisp:  <>
      <path d={`M${tx - 2} ${ty + 8} C${tx + 13} ${ty + 3} ${tx + 19} ${ty - 9} ${tx + 14} ${ty - 20}`} fill="none" stroke={A} strokeWidth="5.4" strokeLinecap="round" opacity=".92" />
      <circle cx={tx + 14} cy={ty - 23} r="3.6" fill={T.c} opacity=".9" /></>,
    vine:  <>
      <path d={`M${tx - 2} ${ty + 9} C${tx + 13} ${ty + 5} ${tx + 19} ${ty - 6} ${tx + 15} ${ty - 16}`} fill="none" stroke={A} strokeWidth="4.6" strokeLinecap="round" />
      <path d={ell(tx + 16, ty - 21, 7.5, 5)} fill={A} stroke={B} strokeWidth="1.3" transform={`rotate(-28 ${tx + 16} ${ty - 21})`} /></>,
    gear:  <>
      <path d={`M${tx - 2} ${ty + 8} H${tx + 10}`} stroke={A} strokeWidth="4.6" strokeLinecap="round" />
      {[0, 45, 90, 135].map(a => <rect key={a} x={tx + 15.5} y={ty - 2.5} width="15" height="5" rx="1.6" fill={A} stroke={B} strokeWidth="1" transform={`rotate(${a} ${tx + 18} ${ty + 8}) translate(0 ${8})`} />)}
      <circle cx={tx + 18} cy={ty + 8} r="8" fill={A} stroke={B} strokeWidth="1.5" />
      <circle cx={tx + 18} cy={ty + 8} r="3.2" fill={B} /></>,
  };

  /* ── eyes ── one rig, five expressions; every one narrows when sad */
  const ey = hy + hr * .1, ex = hr * .46, er = hr * .34;
  const EYES = {
    big: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={ell(cx + k * ex, ey, er, sad ? er * .58 : er * 1.1)} fill="#0d1424" />
        <path d={ell(cx + k * ex, ey, er * .82, (sad ? er * .58 : er * 1.1) * .82)} fill={`url(#${uid}-iris)`} />
        <circle cx={cx + k * ex - er * .3} cy={ey - er * .34} r={er * .32} fill="#fff" />
        <circle cx={cx + k * ex + er * .28} cy={ey + er * .38} r={er * .16} fill="#fff" opacity=".8" />
      </g>))}</>,
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
      <circle cx={cx - hr * .5} cy={ey + er * .36} r={er * .2} fill="#fff" opacity=".85" /></>,
    starry: <>{[-1, 1].map(k => (
      <g key={k}>
        <path d={ell(cx + k * ex, ey, er, sad ? er * .6 : er * 1.08)} fill="#0d1424" />
        <path d={`M${cx + k * ex} ${ey - er * .86} L${cx + k * ex + er * .24} ${ey - er * .22} L${cx + k * ex + er * .74} ${ey} L${cx + k * ex + er * .24} ${ey + er * .22} L${cx + k * ex} ${ey + er * .86} L${cx + k * ex - er * .24} ${ey + er * .22} L${cx + k * ex - er * .74} ${ey} L${cx + k * ex - er * .24} ${ey - er * .22} Z`} fill={T.c} />
        <circle cx={cx + k * ex - er * .34} cy={ey - er * .34} r={er * .22} fill="#fff" />
      </g>))}</>,
  };

  /* ── build-specific limbs ── */
  const legTop = bBot - 3, legH = Math.max(6, GROUND - 4 - legTop);
  const limbs = { back: null, front: null };
  if (sp.build === "biped") {
    const lw = Math.max(8, bw * .28);
    limbs.back = <>{[-1, 1].map(k => (
      <g key={k} transform={`rotate(${k * 12} ${cx + k * (bw / 2 - 1)} ${bTop + bh * .34})`}>
        {P(rr(cx + k * (bw / 2 + 2), bTop + bh * .34 + L.arm / 2, 9.5, L.arm, 4.6), D, { spec: .55 })}
        {P(ell(cx + k * (bw / 2 + 2), bTop + bh * .34 + L.arm, 6, 5.4), F, { spec: .8, lw: 1.4 })}
      </g>))}</>;
    limbs.front = <>{[-1, 1].map(k => (
      <g key={k}>
        {P(rr(cx + k * bw * .26, legTop + legH / 2, lw, legH, lw * .42), D, { spec: .5 })}
        {P(ell(cx + k * bw * .28, GROUND - 3.5, lw * .72, 4.6), F, { spec: .7, lw: 1.4 })}
        {seam(`M${cx + k * bw * .26 - lw * .3} ${legTop + legH * .5} h${lw * .6}`, .35)}
      </g>))}</>;
  } else if (sp.build === "quad") {
    limbs.back = <>{[-1, 1].map(k => (
      <g key={k} opacity=".82">
        {P(rr(cx + k * bw * .42, bBot - 1, 9, GROUND - 5 - bBot + 2, 4.4), D, { spec: .3 })}
        {P(ell(cx + k * bw * .42, GROUND - 3.5, 6.6, 4.4), D, { spec: .5, lw: 1.3 })}
      </g>))}</>;
    limbs.front = <>{[-1, 1].map(k => (
      <g key={k}>
        {P(rr(cx + k * bw * .2, bBot - 1, 10.5, GROUND - 4 - bBot + 2, 5), D, { spec: .55 })}
        {P(ell(cx + k * bw * .21, GROUND - 3, 8, 5), F, { spec: .8, lw: 1.4 })}
        {[0, 1].map(j => seam(`M${cx + k * bw * .21 - 3.6 + j * 3.6} ${GROUND - 5.6} v3`, .5))}
      </g>))}
      {/* haunches, so a crouched quad has shoulders */}
      {[-1, 1].map(k => P(ell(cx + k * bw * .36, by + bh * .04, bw * .13, bh * .38), F, { spec: .45, occ: .85, lw: 1.3 }))}</>;
  } else {
    limbs.front = <>{[-1, 1].map(k => (
      <g key={k}>
        {P(ell(cx + k * (bw / 2 + 5), by - bh * .1, 6.2, L.arm * .42), F, { spec: .75, lw: 1.4 })}
      </g>))}
      {/* a short skirt and two thrusters instead of legs, riding a hover ring */}
      {P(`M${cx - bw * .38} ${bBot - 4} C${cx - bw * .3} ${bBot + 9} ${cx + bw * .3} ${bBot + 9} ${cx + bw * .38} ${bBot - 4} Z`, D, { spec: .45, lw: 1.4 })}
      {[-1, 1].map(k => <circle key={k} cx={cx + k * bw * .22} cy={bBot + 8} r="4.2" fill={T.c} opacity=".8" />)}
      {[-1, 1].map(k => <ellipse key={k} cx={cx + k * bw * .22} cy={bBot + 15} rx="4.6" ry="7" fill={`url(#${uid}-glow)`} opacity=".55" />)}
      <ellipse cx={cx} cy={GROUND - 9} rx={bw * .5} ry="4" fill="none" stroke={T.c} strokeWidth="2.4" opacity=".55" />
      <ellipse cx={cx} cy={GROUND - 5} rx={bw * .34} ry="3" fill="none" stroke={T.c} strokeWidth="1.6" opacity=".3" /></>;
  }

  /* ── torso ── loaf for a quad, barrel for the others */
  const torso = sp.build === "quad" ? ell(cx, by, bw / 2, bh / 2) : rr(cx, by, bw, bh, bw * .36);
  const coreY = sp.build === "quad" ? by - bh * .1 : by - bh * .06;

  return (
    <svg className={`pa pa-${sp.build} ${className}`} viewBox="0 -14 120 150" width={size || "100%"} height={size || "100%"} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-body`} x1="0.18" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset="24%" stopColor={A} />
          <stop offset="100%" stopColor={B} />
        </linearGradient>
        <linearGradient id={`${uid}-limb`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={A} />
          <stop offset="100%" stopColor={B} />
        </linearGradient>
        <radialGradient id={`${uid}-iris`}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor={T.c} />
          <stop offset="100%" stopColor={B} />
        </radialGradient>
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

      <ellipse cx={cx} cy={GROUND + 1} rx={bw * .78} ry="5.4" fill="#0b1526" opacity={sp.build === "float" ? .12 : .18} />

      <g className={sad ? "pa-sag" : "pa-bob"}>
        {TAILS[sp.tail]}
        {limbs.back}
        {/* stage three grows something on its back */}
        {st >= 3 && [-1, 1].map(k => (
          <path key={k} d={`M${cx + k * bw * .32} ${bTop + 4} C${cx + k * (bw * .96)} ${bTop - 26} ${cx + k * (bw * 1.24)} ${bTop - 2} ${cx + k * bw * .56} ${bTop + 20} Z`}
            fill={T.c} opacity=".82" stroke={B} strokeWidth="1.3" strokeLinejoin="round" />))}
        {P(torso, F)}
        {/* chest hatch + core: dark at stage one, lit from stage two on */}
        {P(rr(cx, coreY, bw * .5, bh * .46, 4), D, { spec: .5, occ: .7, lw: 1.2, lineOp: .5 })}
        {seam(`M${cx - bw * .2} ${coreY - bh * .16} h${bw * .4}`, .4)}
        {st >= 2 && <circle cx={cx} cy={coreY} r={bw * .26} fill={`url(#${uid}-glow)`} />}
        <circle cx={cx} cy={coreY} r={Math.max(3, bw * .11)} fill={st >= 2 ? T.c : B} stroke={B} strokeWidth="1.2" opacity={st >= 2 ? 1 : .7} />
        {/* stage three armours the shoulders */}
        {st >= 3 && sp.build !== "quad" && [-1, 1].map(k => P(
          `M${cx + k * bw * .16} ${bTop - 1} C${cx + k * bw * .58} ${bTop - 5} ${cx + k * bw * .7} ${bTop + 4} ${cx + k * bw * .62} ${bTop + 11} L${cx + k * bw * .2} ${bTop + 8} Z`, F, { spec: .8, lw: 1.4 }))}
        {limbs.front}
        {/* neck ring — the join that says built, not grown */}
        {sp.build !== "float" && P(rr(cx, bTop - 3, bw * .4, 7, 3), D, { spec: .6, lw: 1.3 })}
        {EARS[sp.ear]}
        {P((HEADS[sp.head] || HEADS.round)(cx, hy, hr), F)}
        {/* cheek vents + a crown seam */}
        {[0, 1, 2].map(j => seam(`M${cx + hr * .62} ${hy + hr * .42 + j * 4} h${hr * .3}`, .4))}
        {seam(`M${cx - hr * .34} ${hy - hr * .96} C${cx - hr * .5} ${hy - hr * .5} ${cx - hr * .5} ${hy - hr * .2} ${cx - hr * .42} ${hy + hr * .1}`, .32)}
        {EYES[sp.eye]}
        {!sad && <path d={`M${cx - hr * .22} ${hy + hr * .62} C${cx - hr * .06} ${hy + hr * .82} ${cx + hr * .06} ${hy + hr * .82} ${cx + hr * .22} ${hy + hr * .62}`} fill="none" stroke={B} strokeWidth="1.9" strokeLinecap="round" opacity=".62" />}
        {sad && <path d={`M${cx - hr * .22} ${hy + hr * .8} C${cx - hr * .06} ${hy + hr * .6} ${cx + hr * .06} ${hy + hr * .6} ${cx + hr * .22} ${hy + hr * .8}`} fill="none" stroke={B} strokeWidth="1.9" strokeLinecap="round" opacity=".62" />}
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
  const scale = (petStage(p.bond) === 3 ? 1.4 : petStage(p.bond) === 2 ? 1.15 : 1) * (happy >= 80 ? 1 : 0.7);
  return { k: b.k, v: b.v * scale, species: sp, happy, stage: petStage(p.bond) };
}

/* ══════════════════════ the care screen ══════════════════════ */

/* Every care action raises one stat. Bond is paid on the ACTUAL rise, not on
   the tap — feeding a full pet is worth nothing — which is what stops the
   whole thing from being a button you mash a hundred times on day one. */
const CARE = {
  feed:  { stat: "hunger", rise: 34, ic: "🍖", c: "#ff9a4c" },
  bath:  { stat: "clean",  rise: 42, ic: "🫧", c: "#5ce1ff" },
  brush: { stat: "coat",   rise: 40, ic: "🪮", c: "#c7a6ff" },
  play:  { stat: "mood",   rise: 38, ic: "🎾", c: "#3ddc84" },
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

/** The pet dock on the profile page — a live portrait, not a button. It shows
    the animal, what it needs, and what it is currently worth in a fight. */
export const PetDock = memo(function PetDock({ lang, onOpen }) {
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
      <button className="petdock empty" onClick={onOpen}>
        <span className="pd-egg">🥚</span>
        <span className="pd-b">
          <b>{T("ห้องเลี้ยงสัตว์ไซบอร์ก", "Cyber Pet Lab", "赛博宠物室")}</b>
          <i>{T("ฟักตัวแรกของคุณ — เลี้ยงให้โต แล้วพามันไปช่วยหุ่นยนต์สู้",
                "Hatch your first one — raise it, then bring it to fight beside your chassis",
                "孵化第一只 — 养大后带它与机体并肩作战")}</i>
        </span>
        <span className="pd-go">→</span>
      </button>
    );
  }

  const sp = petById(pet.species);
  const stage = petStage(pet.bond);
  const happy = petHappy(pet);
  const lv = petLevel(pet.bond);
  const need = ["hunger", "clean", "coat", "mood"].filter(k => pet[k] < 45);
  const messy = (pet.mess || []).length;
  const T2 = PET_TYPES[sp.type];

  return (
    <button className={`petdock${happy < 50 ? " low" : ""}`} onClick={onOpen} style={{ "--pc": sp.sw[0], "--tc": T2.c }}>
      <span className="pd-art"><PetArt species={sp.id} stage={stage} mood={pet.mood} /></span>
      <span className="pd-b">
        <b>{pet.name || tr3(sp, lang)} <i className="pd-lv">Lv.{lv.lv}</i></b>
        <span className="pd-pips">
          {["hunger", "clean", "coat", "mood"].map(k => (
            <span key={k} className="pd-pip"><i style={{ width: `${Math.round(pet[k])}%`, background: k === "hunger" ? "#ff9a4c" : k === "clean" ? "#5ce1ff" : k === "coat" ? "#c7a6ff" : "#3ddc84" }} /></span>
          ))}
        </span>
        <i className="pd-say">
          {messy ? T(`มีของต้องเก็บ ${messy} กอง`, `${messy} mess to clean up`, `有 ${messy} 处要打扫`)
            : need.length ? T(`ต้องการ: ${need.map(k => STAT_TEXT[k].th).join(" · ")}`,
                              `Needs: ${need.map(k => STAT_TEXT[k].en).join(" · ")}`,
                              `需要：${need.map(k => STAT_TEXT[k].zh).join(" · ")}`)
              : T(`สบายดี · ${tr3(PET_BONUS[sp.bonus], lang)} ในสนามประลอง`,
                  `Doing well · ${tr3(PET_BONUS[sp.bonus], lang)} in the arena`,
                  `状态良好 · 竞技场${tr3(PET_BONUS[sp.bonus], lang)}`)}
        </i>
      </span>
      <span className="pd-go">→</span>
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
  const [naming, setNaming] = useState("");
  const [note, setNote] = useState(null);
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
        say(T("มันเติบโตขึ้นอีกขั้น!", "It grew into its next form!", "它进化到下一形态了！"));
      }
    }
  }, [pet, bag, save, stash, say, pop, playUi, payDaily, lang]);   // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="pet-grid">
          {PET_SPECIES.map(sp => {
            const ty = PET_TYPES[sp.type];
            return (
              <button key={sp.id} className={`pet-card${pick === sp.id ? " on" : ""}`} style={{ "--pc": sp.sw[0], "--tc": ty.c }}
                onClick={() => { setPick(sp.id); playUi("click"); }}>
                <span className="pc-art"><PetArt species={sp.id} stage={1} /></span>
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
              <span className="pcf-art"><PetArt species={sel.id} stage={1} /></span>
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
  const lv = petLevel(pet.bond);
  const happy = petHappy(pet);
  const bonus = PET_BONUS[sp.bonus];
  const mess = pet.mess || [];
  const owned = PET_FOODS.filter(f => (bag[f.id] || 0) > 0);

  return (
    <div className="petpage" style={{ "--pc": sp.sw[0], "--pd": sp.sw[1], "--tc": ty.c }}>
      <div className="pet-top">
        <button className="pet-back" onClick={onBack}>←</button>
        <b>{pet.name || tr3(sp, lang)}</b>
        <span className="pet-coins">🪙 {coins.toLocaleString()}</span>
      </div>

      <div className="pet-idcard">
        <span className="pi-code">{sp.code}</span>
        <span className="pi-type" style={{ "--tc": ty.c }}>{tr3(ty, lang)}</span>
        <span className="pi-stage">{T("ขั้น", "Stage", "阶段")} {stage}</span>
        <span className={`pi-happy${happy < 50 ? " low" : ""}`}>{happy < 35 ? "😿" : happy < 60 ? "😐" : happy < 85 ? "🙂" : "😻"} {happy}%</span>
      </div>

      {/* ── the room ── the pet, its mess, and whatever just happened to it ── */}
      <div className="pet-room">
        <div className="pr-floor" />
        <div className={`pr-pet${happy < 40 ? " sad" : ""}`} onClick={() => { care("play"); }}>
          <PetArt species={sp.id} stage={stage} mood={pet.mood} />
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
        <div className="pb-sub">
          {stage < 3
            ? T(`เลเวล ${stage === 1 ? 4 : 9} จะเปลี่ยนร่าง`, `Changes form at level ${stage === 1 ? 4 : 9}`, `等级 ${stage === 1 ? 4 : 9} 时进化`)
            : T("ร่างสุดท้ายแล้ว", "Final form", "最终形态")}
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
        {["feed", "bath", "brush", "play"].map(k => (
          <button key={k} className="pet-act" style={{ "--ac": CARE[k].c }} onClick={() => care(k)}>
            <span>{CARE[k].ic}</span><b>{tr3(CARE_TEXT[k], lang)}</b>
          </button>
        ))}
      </div>

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
  );
});
