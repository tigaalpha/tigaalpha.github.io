/* ── cyber-avatar.tsx ──
   The character, drawn from specific references rather than invented, and
   drawn as a TURNTABLE rather than a portrait: every model is built on one
   parametric rig so the whole figure can be spun a full 360° and still hold
   together from any angle.

   ── THE RIG ──
   The head is treated as an ellipsoid standing on a vertical axis. Two kinds
   of geometry hang off it and they behave differently as it turns, which is
   the whole trick:

     · SHELL — the silhouette itself (skull, helm, hair mass). A rotated
       ellipse still projects to an ellipse, so the shell is simply the
       front-view artwork scaled horizontally by
           k = √( cos²φ + (D·sin φ)² ),  D = depth ÷ width ≈ 1.1
       which widens at profile because a head is deeper than it is wide. Its
       centre also drifts by −E·sin φ, because the neck axis runs behind the
       face: turning right swings the face right and the cranium left.

     · FEATURES — eyes, optics, mouth, LED, vents. Each one sits on the
       surface at its own azimuth θ, recovered from where it is drawn in the
       front view: θ = asin((x − 60) ÷ R). Turning by φ moves it to
           x = cx − E·sin φ + R·sin(θ + φ)
       and squashes it by cos(θ + φ), which also says when it has gone round
       the far side and must stop being drawn. Ears live at ±90°, so they
       swing into view exactly when they should; back-of-skull plating lives
       at 180° and takes over as the figure turns away.

   A nose/brow/chin wedge fades in on the leading edge with |sin φ|, since a
   profile is mostly read from that outline.

   ── THE FIVE BUILDS ──
   Two looks were asked for by name, so the details that make each recognisable
   were looked up rather than guessed.

   T-800 endoskeleton (The Terminator): a skull in polished, worn chrome; deep
   recessed sockets holding red optics with a real iris and lens; and above all
   the exposed dental grille — individually set teeth, an infiltration unit's
   deliberately imperfect human mouth. Sharp zygomatic arches, hollow temples,
   a visible jaw hinge, hydraulic rods in the neck. → VANGUARD.

   CyberLife android (Detroit: Become Human): essentially a human face, marked
   only by the LED ring high on the android's right temple, set level with the
   skin. Blue when calm, yellow while processing hard — in-story legally
   required, as the thing that distinguishes an android from a person. → SPECTER,
   passing as human; and NOVA, the same chassis with its skin panels
   deactivated, which ends up reading as the friendly one because white plating
   with lit seams is soft where chrome and bared teeth are not.

   Two more fill out the roster: SENTINEL, a heavy assault helm — full
   faceplate, one visor band, jaw vents, crest fin; and PHANTOM, mimetic
   polyalloy, a mirror-smooth face with no features at all beyond the contours
   the alloy holds and a fissure that keeps closing itself.

   Everything else still follows what is EQUIPPED: `armorA`/`armorB` come from
   the worn outfit's swatch so a change of gear re-plates the body, and `glow`
   is the chamber's key light. The endoskeleton's optics deliberately ignore
   both and stay red — a T-800 with cyan eyes is not a T-800. ── */

import { useId, useRef } from "react";
import { classOf, classKeyOf } from "./model-skills";

/* The five base chassis. No gender axis — these are models, the way a car or a
   rifle is a model, and further customisation rides on top of whichever is
   picked. Order runs heavy → light so the row reads as a spectrum. */
export const CHAR_MODELS = [
  /* combat frames */
  { id: "vanguard", code: "V-01",  th: "แวนการ์ด", en: "VANGUARD", zh: "先锋",
    cls: { th: "โครงกระดูกรบ",     en: "Combat endoskeleton", zh: "战斗骨架" } },
  { id: "sentinel", code: "S-02",  th: "เซนทิเนล", en: "SENTINEL", zh: "哨兵",
    cls: { th: "หน่วยจู่โจมหนัก",   en: "Heavy assault unit",  zh: "重装突击" } },
  { id: "reaper",   code: "R-03",  th: "รีปเปอร์", en: "REAPER",   zh: "死神",
    cls: { th: "เครื่องจักรสงคราม", en: "War machine",         zh: "战争机器" } },
  { id: "ronin",    code: "RN-04", th: "โรนิน",    en: "RONIN",    zh: "浪人",
    cls: { th: "ซามูไรไซเบอร์",     en: "Cyber samurai",       zh: "赛博武士" } },
  { id: "phantom",  code: "PH-05", th: "แฟนธ่อม",  en: "PHANTOM",  zh: "液金",
    cls: { th: "โลหะเหลวเปลี่ยนรูป", en: "Mimetic polyalloy",  zh: "液态合金" } },
  /* service droids */
  { id: "envoy",    code: "PX-06", th: "เอนวอย",   en: "ENVOY",    zh: "使节",
    cls: { th: "หุ่นล่ามทองคำ",     en: "Protocol unit",       zh: "礼仪机器人" } },
  { id: "talon",    code: "IG-07", th: "ทาลอน",    en: "TALON",    zh: "利爪",
    cls: { th: "นักล่าอุตสาหกรรม",  en: "Industrial hunter",   zh: "工业猎手" } },
  { id: "sentry",   code: "B1-08", th: "เซนทรี",   en: "SENTRY",   zh: "步兵",
    cls: { th: "ทหารราบผลิตจำนวนมาก", en: "Line infantry droid", zh: "量产步兵" } },
  { id: "pip",      code: "AS-09", th: "พิพ",      en: "PIP",      zh: "皮普",
    cls: { th: "หุ่นช่างประจำยาน",   en: "Astromech unit",      zh: "机修机器人" } },
  { id: "pebble",   code: "BB-10", th: "เพบเบิล",  en: "PEBBLE",   zh: "圆豆",
    cls: { th: "หุ่นทรงกลมกลิ้งได้", en: "Rolling unit",        zh: "滚球单元" } },
  /* androids that pass for people */
  { id: "specter",  code: "SP-11", th: "สเปกเตอร์", en: "SPECTER", zh: "幻影",
    cls: { th: "แอนดรอยด์แฝงตัว",   en: "Infiltration android", zh: "潜行仿生人" } },
  { id: "scout",    code: "RK-12", th: "สเกาต์",   en: "SCOUT",    zh: "侦查",
    cls: { th: "แอนดรอยด์เจรจา",    en: "Negotiator android",  zh: "谈判仿生人" } },
  { id: "meridian", code: "PL-13", th: "เมริเดียน", en: "MERIDIAN", zh: "子午",
    cls: { th: "แอนดรอยด์ผู้ดูแล",   en: "Caretaker android",   zh: "看护仿生人" } },
  { id: "atlas",    code: "TR-14", th: "แอตลาส",   en: "ATLAS",    zh: "阿特拉斯",
    cls: { th: "แอนดรอยด์แรงงานหนัก", en: "Heavy labour android", zh: "重劳仿生人" } },
  { id: "keeper",   code: "AX-15", th: "คีปเปอร์", en: "KEEPER",   zh: "守护",
    cls: { th: "แอนดรอยด์ประจำบ้าน", en: "Domestic android",    zh: "家用仿生人" } },
  /* the bright end */
  { id: "halcyon",  code: "RT-16", th: "ฮัลไซออน", en: "HALCYON",  zh: "宁静",
    cls: { th: "แอนดรอยด์รุ่นแรก",   en: "First-generation android", zh: "初代仿生人" } },
  { id: "aurora",   code: "AU-17", th: "ออโรร่า",   en: "AURORA",  zh: "极光",
    cls: { th: "แอนดรอยด์ไอดอล",    en: "Idol android",        zh: "偶像仿生人" } },
  { id: "nova",     code: "N-18",  th: "โนวา",      en: "NOVA",    zh: "新星",
    cls: { th: "หุ่นผู้ช่วยตัวจิ๋ว",  en: "Little helper unit",  zh: "迷你助手" } },
  { id: "pixel",    code: "PX-19", th: "พิกเซล",    en: "PIXEL",   zh: "像素",
    cls: { th: "หุ่นหน้าจอจิ๋ว",     en: "Screen-face buddy",   zh: "屏幕脸小伙伴" } },
  { id: "mochi",    code: "MO-20", th: "โมจิ",      en: "MOCHI",   zh: "麻糬",
    cls: { th: "หุ่นนุ่มนิ่มสุดน่ารัก", en: "Squishy pocket bot", zh: "软萌口袋机器人" } },
  /* ── the soft intake ── ten built to be held rather than feared */
  { id: "pudding",  code: "PD-21", th: "พุดดิ้ง",    en: "PUDDING",  zh: "布丁",
    cls: { th: "หุ่นเนื้อนุ่มสั่นได้",  en: "Wobble-shell unit",   zh: "布丁外壳单元" } },
  { id: "acorn",    code: "AC-22", th: "เอคอร์น",   en: "ACORN",    zh: "橡实",
    cls: { th: "หุ่นเปลือกเมล็ด",     en: "Seed-shell servitor", zh: "种壳侍从" } },
  { id: "cocoa",    code: "CC-23", th: "โกโก้",      en: "COCOA",    zh: "可可",
    cls: { th: "หุ่นเพื่อนตัวอุ่น",    en: "Warm-shell companion", zh: "暖壳伙伴" } },
  { id: "blossom",  code: "BL-24", th: "บลอสซั่ม",   en: "BLOSSOM",  zh: "花萼",
    cls: { th: "หุ่นมงกุฎกลีบดอก",    en: "Petal-crowned herald", zh: "花冠传令者" } },
  { id: "pengu",    code: "PG-25", th: "เพนกุ",      en: "PENGU",    zh: "企鹅",
    cls: { th: "หุ่นดูแลเขตหนาว",     en: "Cold-weather steward", zh: "极寒管家" } },
  { id: "bubbly",   code: "BB-26", th: "บับบลี้",    en: "BUBBLY",   zh: "泡泡",
    cls: { th: "หุ่นโดมดำน้ำ",        en: "Sealed-dome diver",   zh: "密封潜水单元" } },
  { id: "poppy",    code: "PP-27", th: "ป๊อปปี้",    en: "POPPY",    zh: "波比",
    cls: { th: "หุ่นผู้ช่วยเสาเดี่ยว",  en: "Single-antenna helper", zh: "单天线助手" } },
  { id: "honey",    code: "HN-28", th: "ฮันนี่",     en: "HONEY",    zh: "蜜蜂",
    cls: { th: "หุ่นผู้ดูแลรัง",       en: "Hive keeper",         zh: "蜂巢守护者" } },
  { id: "snowbun",  code: "SB-29", th: "สโนว์บัน",   en: "SNOWBUN",  zh: "雪团",
    cls: { th: "หุ่นส่งของเงียบเชียบ", en: "Quiet courier",       zh: "静音信使" } },
  { id: "plushy",   code: "PL-30", th: "พลัชชี่",    en: "PLUSHY",   zh: "布偶",
    cls: { th: "หุ่นตุ๊กตาเย็บมือ",    en: "Stitched companion",  zh: "缝合布偶" } },
  /* ── the hard intake ── ten built to be read across a room */
  { id: "wraith",   code: "WR-31", th: "เรธ",        en: "WRAITH",   zh: "幽骸",
    cls: { th: "หุ่นโครงกลวงลอบเร้น",  en: "Hollow-frame infiltrator", zh: "空壳潜入者" } },
  { id: "magnus",   code: "MG-32", th: "แม็กนัส",    en: "MAGNUS",   zh: "巨铁",
    cls: { th: "โครงล้อมปราการ",      en: "Siege frame",         zh: "攻城机架" } },
  { id: "saber",    code: "SA-33", th: "เซเบอร์",    en: "SABER",    zh: "剑锋",
    cls: { th: "โครงประลองดาบ",       en: "Duelling frame",      zh: "决斗机架" } },
  { id: "oracle",   code: "OR-34", th: "ออราเคิล",   en: "ORACLE",   zh: "谕者",
    cls: { th: "หุ่นกลุ่มเซนเซอร์",    en: "Sensor cluster",      zh: "感测阵列" } },
  { id: "korax",    code: "KX-35", th: "โคแรกซ์",    en: "KORAX",    zh: "渡鸦",
    cls: { th: "โครงอีกา",            en: "Corvid frame",        zh: "鸦形机架" } },
  { id: "tempest",  code: "TP-36", th: "เทมเพสต์",   en: "TEMPEST",  zh: "风暴",
    cls: { th: "หุ่นสกัดกั้นความเร็วสูง", en: "High-speed interceptor", zh: "高速拦截机" } },
  { id: "bastion",  code: "BS-37", th: "แบสเตียน",   en: "BASTION",  zh: "壁垒",
    cls: { th: "หุ่นหัวป้อมปราการ",    en: "Bunker head",         zh: "堡垒头部单元" } },
  { id: "nyx",      code: "NX-38", th: "นิกซ์",      en: "NYX",      zh: "夜阑",
    cls: { th: "โครงราตรี",           en: "Night frame",         zh: "夜行机架" } },
  { id: "forge",    code: "FG-39", th: "ฟอร์จ",      en: "FORGE",    zh: "熔工",
    cls: { th: "โครงเตาหลอม",         en: "Foundry frame",       zh: "熔铸机架" } },
  { id: "zenith",   code: "ZN-40", th: "เซนิธ",      en: "ZENITH",   zh: "天顶",
    cls: { th: "โครงพิธีการ",         en: "Ceremonial frame",    zh: "礼典机架" } },
];



/* The picker used to be a boy/girl/cute switch, so saved choices are carried
   across to the model that actually looks like what they had rather than
   silently resetting anyone to the default. */
/* How each model is proportioned. Exported because the stage has to hang
   equipped gear on the right body — a chibi's head is nearly twice the size and
   its hands sit higher, so headgear and held items cannot use one fixed offset. */
/* ── combat profile ──
   For the duel mode: two players answer music questions and the answers drive a
   fight between their chassis. Every model carries the SAME total — 40 points
   across four stats — because these are bought with coins and a shop that sells
   a strictly better body sells a win, not a character. What differs is the
   shape: REAPER hits hardest and folds fastest, ATLAS is the opposite, PHANTOM
   is nearly all speed. The special is the flavour the shape cannot carry.

   POWER  scales damage dealt on a correct answer
   ARMOUR reduces damage taken on a wrong one
   SPEED  decides who answers into the clock first, and dodge chance
   SYNC   how much a streak of correct answers compounds */
export const MODEL_COMBAT = {
  vanguard: { pwr: 13, arm: 10, spd: 9,  syn: 8,  sp: { th: "ยิงชุดต่อเนื่อง", en: "Suppressing Fire", zh: "压制射击" } },
  sentinel: { pwr: 10, arm: 15, spd: 7,  syn: 8,  sp: { th: "ตั้งโล่กำบัง",    en: "Bulwark Stance",   zh: "壁垒姿态" } },
  reaper:   { pwr: 17, arm: 8,  spd: 10, syn: 5,  sp: { th: "ตัดวงจร",        en: "Execute Protocol", zh: "处决协议" } },
  ronin:    { pwr: 15, arm: 8,  spd: 13, syn: 4,  sp: { th: "วิถีดาบเดียว",    en: "Single Stroke",    zh: "一刀流" } },
  phantom:  { pwr: 10, arm: 6,  spd: 16, syn: 8,  sp: { th: "เปลี่ยนรูปหลบ",   en: "Mimic Dodge",      zh: "拟态闪避" } },
  envoy:    { pwr: 7,  arm: 11, spd: 8,  syn: 14, sp: { th: "แปลภาษาทุกชนิด",  en: "Six Million Forms", zh: "百万语系" } },
  talon:    { pwr: 16, arm: 9,  spd: 12, syn: 3,  sp: { th: "ล็อกเป้าหมาย",    en: "Target Lock",      zh: "目标锁定" } },
  sentry:   { pwr: 11, arm: 11, spd: 11, syn: 7,  sp: { th: "ยิงพร้อมกันเป็นแถว", en: "Volley Order",  zh: "齐射指令" } },
  pip:      { pwr: 6,  arm: 12, spd: 10, syn: 12, sp: { th: "ซ่อมกลางสนาม",    en: "Field Repair",     zh: "战地维修" } },
  pebble:   { pwr: 8,  arm: 8,  spd: 15, syn: 9,  sp: { th: "กลิ้งหลบ",        en: "Roll Away",        zh: "滚动闪避" } },
  specter:  { pwr: 12, arm: 9,  spd: 12, syn: 7,  sp: { th: "แฝงตัวเข้าใกล้",   en: "Infiltrate",       zh: "潜入" } },
  scout:    { pwr: 10, arm: 9,  spd: 11, syn: 10, sp: { th: "อ่านเกมล่วงหน้า",  en: "Preconstruct",     zh: "预演推算" } },
  meridian: { pwr: 11, arm: 11, spd: 9,  syn: 9,  sp: { th: "ปลุกให้ตื่นรู้",   en: "Awaken",           zh: "觉醒" } },
  atlas:    { pwr: 12, arm: 17, spd: 5,  syn: 6,  sp: { th: "ยืนรับแทน",       en: "Take The Hit",     zh: "代为承受" } },
  keeper:   { pwr: 8,  arm: 13, spd: 9,  syn: 10, sp: { th: "ปกป้องคนข้างหลัง", en: "Shelter",          zh: "庇护" } },
  halcyon:  { pwr: 9,  arm: 9,  spd: 10, syn: 12, sp: { th: "เสียงประสานสงบ",   en: "Calm Chorus",      zh: "宁静和声" } },
  aurora:   { pwr: 9,  arm: 8,  spd: 11, syn: 12, sp: { th: "ท่อนฮุกตรึงใจ",    en: "Encore Hook",      zh: "安可副歌" } },
  nova:     { pwr: 7,  arm: 11, spd: 10, syn: 12, sp: { th: "ส่งพลังหนุน",      en: "Assist Boost",     zh: "支援增幅" } },
  pixel:    { pwr: 8,  arm: 10, spd: 12, syn: 10, sp: { th: "เปลี่ยนหน้าจอลวง",  en: "Screen Feint",     zh: "屏幕虚招" } },
  mochi:    { pwr: 6,  arm: 14, spd: 9,  syn: 11, sp: { th: "ดูดซับแรงกระแทก",  en: "Squish Absorb",    zh: "软化吸收" } },
  /* Both new intakes are held to the same forty points as everything above.
     A shop that sells a strictly better body sells a win, not a character —
     so what changes is the SHAPE of the forty, never the size of it. */
  pudding:  { pwr: 8,  arm: 12, spd: 8,  syn: 12, sp: { th: "คลื่นสั่นสะเทือน",  en: "Wobble Pulse",     zh: "颤动脉冲" } },
  acorn:    { pwr: 9,  arm: 12, spd: 8,  syn: 11, sp: { th: "เปลือกแข็ง",      en: "Shell Up",         zh: "硬壳护体" } },
  cocoa:    { pwr: 9,  arm: 15, spd: 7,  syn: 9,  sp: { th: "กอดหมี",          en: "Bear Hug",         zh: "熊抱" } },
  blossom:  { pwr: 8,  arm: 10, spd: 9,  syn: 13, sp: { th: "กลีบบานสะพรั่ง",   en: "Full Bloom",       zh: "盛放" } },
  pengu:    { pwr: 8,  arm: 14, spd: 9,  syn: 9,  sp: { th: "ไถลบนน้ำแข็ง",     en: "Belly Slide",      zh: "滑行冲刺" } },
  bubbly:   { pwr: 8,  arm: 11, spd: 10, syn: 11, sp: { th: "โดมกันแรง",       en: "Dome Seal",        zh: "穹顶封锁" } },
  poppy:    { pwr: 8,  arm: 10, spd: 12, syn: 10, sp: { th: "สัญญาณกระตุก",    en: "Signal Jolt",      zh: "信号震颤" } },
  honey:    { pwr: 10, arm: 9,  spd: 10, syn: 11, sp: { th: "ฝูงผึ้งรุม",       en: "Swarm Call",       zh: "蜂群召集" } },
  snowbun:  { pwr: 9,  arm: 7,  spd: 16, syn: 8,  sp: { th: "กระโดดหิมะ",      en: "Powder Hop",       zh: "踏雪跃" } },
  plushy:   { pwr: 7,  arm: 16, spd: 6,  syn: 11, sp: { th: "ตะเข็บซ่อมตัวเอง", en: "Reseam",           zh: "自缝合" } },
  wraith:   { pwr: 12, arm: 6,  spd: 17, syn: 5,  sp: { th: "ผ่านทะลุ",        en: "Pass Through",     zh: "穿身而过" } },
  magnus:   { pwr: 12, arm: 17, spd: 5,  syn: 6,  sp: { th: "ทุบลงพื้น",       en: "Ground Slam",      zh: "碎地重击" } },
  saber:    { pwr: 16, arm: 8,  spd: 13, syn: 3,  sp: { th: "ชักดาบครั้งเดียว",  en: "One Draw",         zh: "居合一闪" } },
  oracle:   { pwr: 8,  arm: 10, spd: 9,  syn: 13, sp: { th: "อ่านอนาคต",       en: "Read Ahead",       zh: "预读" } },
  korax:    { pwr: 13, arm: 7,  spd: 15, syn: 5,  sp: { th: "โฉบลงจากมืด",     en: "Dark Stoop",       zh: "暗袭俯冲" } },
  tempest:  { pwr: 14, arm: 7,  spd: 15, syn: 4,  sp: { th: "พุ่งทะลวง",       en: "Overrun",          zh: "突进" } },
  bastion:  { pwr: 10, arm: 18, spd: 5,  syn: 7,  sp: { th: "ปิดช่องยิง",       en: "Close The Slit",   zh: "闭合射孔" } },
  nyx:      { pwr: 12, arm: 8,  spd: 14, syn: 6,  sp: { th: "จันทร์เสี้ยว",     en: "Crescent Cut",     zh: "弦月斩" } },
  forge:    { pwr: 13, arm: 13, spd: 6,  syn: 8,  sp: { th: "เปิดเตา",         en: "Open The Furnace", zh: "开炉" } },
  zenith:   { pwr: 9,  arm: 11, spd: 7,  syn: 13, sp: { th: "วงแหวนศักดิ์สิทธิ์", en: "Halo Chord",      zh: "圣环和弦" } },
};
export const COMBAT_TOTAL = 40;
/* Gear adds on top of the chassis, which is what makes the weapon rack matter:
   a rarer piece is worth more, and each slot feeds the stat it belongs to. */
/* Mythic is worth double a legendary and is the only tier coins cannot buy —
   gems come from Prestige tier-ups alone, so a full mythic loadout (+40, which
   doubles a fresh chassis) is an endgame reward rather than a purchase that
   settles a fight before it starts. */
/** djb2 over a path string — stable across renders, unlike a counter. */
const hashPath = (d) => { let h = 5381; for (let i = 0; i < d.length; i++) h = ((h << 5) + h + d.charCodeAt(i)) | 0; return h; };

export const RARITY_PTS = { common: 1, rare: 2, epic: 3, legendary: 5, mythic: 10 };

/* ══════════════════════ item levels ══════════════════════
   Buying a piece used to be the end of its story: a legendary blade was worth
   five points on the day you bought it and five points forever. Every owned
   item can now be levelled to +5, which is the other half of what makes a
   shop worth visiting — a reason to keep earning after the thing you wanted
   is already yours, and a way for a player who cannot yet afford a legendary
   to make their rare one genuinely competitive.

   A level is worth one rarity point, so a fully-upgraded rare (2+5=7) beats a
   fresh legendary (5) but not a levelled one (10). The ladder stays honest:
   rarity sets the ceiling's height, levels are how you climb to it. */
const ITEMLV_KEY = "tg_item_lv";
export const ITEM_MAX_LV = 5;
export function readItemLv() {
  try { const v = JSON.parse(localStorage.getItem(ITEMLV_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
export function writeItemLv(v) { try { localStorage.setItem(ITEMLV_KEY, JSON.stringify(v)); } catch (e) {} }
export function itemLv(id) {
  if (!id) return 0;
  const v = readItemLv()[id];
  return Math.max(0, Math.min(ITEM_MAX_LV, parseInt(v, 10) || 0));
}
export function setItemLv(id, lv) {
  const all = readItemLv();
  all[id] = Math.max(0, Math.min(ITEM_MAX_LV, lv));
  writeItemLv(all);
  return all[id];
}
/* Costs climb ~55% per level and start from the rarity, so topping out a
   legendary is a real project while a common is a few practice sessions. */
const UPG_BASE = { common: 60, rare: 110, epic: 200, legendary: 340, mythic: 520 };
export function upgradeCost(item, lv) {
  if (!item) return 0;
  const base = UPG_BASE[item.rarity] || 60;
  return Math.round(base * Math.pow(1.55, Math.max(0, lv)));
}
/** What a piece is actually worth right now: its rarity plus what it was fed. */
export function effRarityPts(g) {
  if (!g) return 0;
  return (RARITY_PTS[g.rarity] || 1) + itemLv(g.id);
}

export function combatOf(model, gear = []) {
  const base = MODEL_COMBAT[normalizeModel(model)] || MODEL_COMBAT.vanguard;
  const out = { pwr: base.pwr, arm: base.arm, spd: base.spd, syn: base.syn, sp: base.sp };
  for (const g of gear) {
    if (!g) continue;
    // levels count here too, so the stat bars on the buy screen move the
    // moment an upgrade is paid for rather than only on a new purchase
    const n = effRarityPts(g);
    if (g.id && g.id.startsWith("wpn-")) out.pwr += n;
    else if (g.id && g.id.startsWith("out-")) out.arm += n;
    else if (g.id && g.id.startsWith("hat-")) out.syn += n;
    else out.spd += n;
  }
  out.total = out.pwr + out.arm + out.spd + out.syn;
  return out;
}
/** The best rarity worn, which is what the arena's aura tier is drawn from. */
export const RARITY_ORDER = ["common", "rare", "epic", "legendary", "mythic"];
export function bestRarity(gear = []) {
  let best = null, bi = -1;
  for (const g of gear) {
    if (!g || !g.rarity) continue;
    const i = RARITY_ORDER.indexOf(g.rarity);
    if (i > bi) { bi = i; best = g.rarity; }
  }
  return best;
}

/* ── poses ──
   Built for the duel mode these chassis are heading into: two figures facing
   each other across a music quiz, and the outcome played back as a fight. A
   pose is not new artwork — it is a set of rotations applied to limb groups
   that are already separate plates, about the joints they actually bend on.
   Degrees are signed as the viewer sees them, and `lean` tips the torso and
   head together about the hips so the whole upper body commits to the move
   instead of the arms waving on a static mannequin. */
export /* ── class kit ──
   Twenty chassis that all wear the same armour end up looking like one robot in
   twenty hats. Every model belongs to a duel class (see model-skills.ts), and
   the class is what it wears on its shoulders: a crest with its own silhouette
   and its own hue, plus the shoulder lights and the ring around the power core.
   It costs three paths and it is the difference between "which grey one is
   that" and reading a striker across the room. Drawn for the LEFT shoulder and
   mirrored for the right, so one path serves both. */
const CLASS_KIT = {
  // swept blade growing out of the crown, tapering to a point
  striker:   { sh: "M30 91 C22 88 15 90 10 97 L0 72 C10 76 22 82 30 91 Z" },
  // a second heavy lame hung under the first
  bulwark:   { sh: "M2 141 C11 146 22 145 30 137 L33 146 C24 154 12 155 1 149 Z" },
  // low-profile vane hugging the dome
  ghost:     { sh: "M35 99 C25 102 15 110 9 121 L5 116 C12 104 23 96 34 94 Z" },
  // tapered sensor mast with a lit tip
  tactician: { sh: "M19 101 L9 101 L11.5 79 C11.5 75 17 75 17 79 Z", tip: [14.2, 75] },
  // bolted tool block
  engineer:  { sh: "M5 108 L24 101 L27 112 L8 119 Z" },
  // resonator bar across the crown
  herald:    { sh: "M5 99 C13 90 26 88 36 94 L34 101 C26 96 15 97 8 105 Z" },
  // twin tuning prongs on a base block
  virtuoso:  { sh: "M10 102 L26 102 L25 91 L11 91 Z M13.6 92 L16.6 92 L15.6 71 L14.2 71 Z M19.4 92 L22.4 92 L22.4 74 L20.8 74 Z", tip: [14.9, 71] },
};
const hx6 = h => { const t = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(t.slice(i, i + 2), 16)); };
const mixc = (a, b, t) => "#" + hx6(a).map((v, i) => Math.round(v + (hx6(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");

const POSES = {
  /* Positive swings a limb FORWARD and INWARD, on both sides — the right side
     applies the negative so one number means one thing however it is mirrored.
     The angles are small on purpose: a hand hangs 132 units below its shoulder,
     so twenty degrees moves it forty-five, and a stance that looks modest in
     the table is already a big movement on screen. */
  idle:   { lean: 0,   armL: 0,   armR: 0,   legL: 0,   legR: 0,  head: 0,  lift: 0 },
  ready:  { lean: -4,  armL: 15,  armR: 9,   legL: -5,  legR: -5, head: -3, lift: 0 },
  attack: { lean: -10, armL: 34,  armR: -12, legL: -8,  legR: -3, head: -6, lift: -3 },
  hit:    { lean: 11,  armL: -13, armR: -15, legL: 4,   legR: -8, head: 10, lift: 3 },
  win:    { lean: -5,  armL: 26,  armR: 22,  legL: -4,  legR: -4, head: -13, lift: -9 },
  /* ── fighting stances ──
     A NEGATIVE angle throws the limb toward the opponent, because the rig
     rotates about the joint and the hand hangs below it. These stop where they
     do because the frame stops there: at -34 the fist is already at x≈90 on a
     body whose centre is 60, and the leg at -30 puts the boot at x≈118 against
     a 140 edge. Anything further and the limb leaves the picture. */
  shoot:  { lean: -5,  armL: -34, armR: 10,  legL: -4,  legR: -2, head: -3, lift: 0 },
  kick:   { lean: 12,  armL: -16, armR: -20, legL: -30, legR: 5,  head: -5, lift: -5 },
  throw:  { lean: -9,  armL: 30,  armR: -8,  legL: -6,  legR: -2, head: -5, lift: -3 },
  beam:   { lean: -3,  armL: -28, armR: -26, legL: -3,  legR: -3, head: 3,  lift: 0 },
  down:   { lean: 16,  armL: -12, armR: -14, legL: -10, legR: 6,  head: 20, lift: 10 },
};

/* hs = head scale · bw = body width · bh = overall height.
   Every hero model was drawn on ONE torso, so a line of them read as the same
   robot in different hats — which is exactly what they looked like. bw scales
   the body about the neck joint (the head stays put) and bh scales the whole
   figure about its feet (it stays on the ground), so a heavy labour unit is
   now genuinely broad and short next to a slim negotiator without a single
   path being redrawn. */
export const MODEL_RIG = {
  vanguard: { hs: 1.15, bw: 1.02, bh: 1.01 },
  sentinel: { hs: 1.15, bw: 1.11, bh: 1.02 },
  reaper:   { hs: 1.15, bw: 1.07, bh: 1.05 },
  ronin:    { hs: 1.15, bw: 1.04, bh: 1.0 },
  phantom:  { hs: 1.15, bw: 0.88, bh: 1.04 },
  specter:  { hs: 1.15, bw: 0.93, bh: 1.0 },
  aurora:   { hs: 1.15, bw: 0.88, bh: 0.99 },
  scout:    { hs: 1.15, bw: 0.90, bh: 1.03 },
  meridian: { hs: 1.15, bw: 0.92, bh: 1.0 },
  atlas:    { hs: 1.12, bw: 1.20, bh: 0.96 },
  halcyon:  { hs: 1.15, bw: 0.95, bh: 0.98 },
  keeper:   { hs: 1.15, bw: 0.99, bh: 0.97 },
  envoy:    { hs: 1.15, bw: 0.96, bh: 1.02 },
  talon:    { hs: 1.12, bw: 1.15, bh: 0.99 },
  sentry:   { hs: 1.1,  bw: 1.09, bh: 0.97 },
  pip: { hs: 1.85, chibi: true }, pebble: { hs: 1.9, chibi: true },
  nova: { hs: 2.05, chibi: true }, pixel: { hs: 2.0, chibi: true }, mochi: { hs: 1.95, chibi: true },
  /* the soft intake: heads oversized against the body, which is the whole
     reason they read as young rather than as small adults */
  pudding: { hs: 2.0, chibi: true }, acorn: { hs: 1.95, chibi: true }, cocoa: { hs: 1.9, chibi: true },
  blossom: { hs: 1.95, chibi: true }, pengu: { hs: 1.9, chibi: true }, bubbly: { hs: 2.0, chibi: true },
  poppy: { hs: 2.05, chibi: true }, honey: { hs: 1.95, chibi: true }, snowbun: { hs: 2.0, chibi: true },
  plushy: { hs: 1.98, chibi: true },
  /* the hard intake: full frames, and the width goes into the shoulders */
  wraith:  { hs: 1.14, bw: 0.90, bh: 1.03 },
  magnus:  { hs: 1.10, bw: 1.22, bh: 0.95 },
  saber:   { hs: 1.15, bw: 1.00, bh: 1.02 },
  oracle:  { hs: 1.16, bw: 0.94, bh: 1.00 },
  korax:   { hs: 1.14, bw: 0.92, bh: 1.02 },
  tempest: { hs: 1.15, bw: 0.96, bh: 1.01 },
  bastion: { hs: 1.08, bw: 1.24, bh: 0.94 },
  nyx:     { hs: 1.15, bw: 0.90, bh: 1.02 },
  forge:   { hs: 1.12, bw: 1.16, bh: 0.98 },
  zenith:  { hs: 1.16, bw: 0.98, bh: 1.00 },
};

const LEGACY = { boy: "vanguard", girl: "specter", cute: "nova" };
export function normalizeModel(v) {
  if (LEGACY[v]) return LEGACY[v];
  return CHAR_MODELS.some(m => m.id === v) ? v : "vanguard";
}

/* ── RobotGlyph ──
   A combat android's head at UI scale: a chamfered helm narrowing to a jaw, one
   lit visor slot with a pair of optics behind it, a crest antenna and two side
   ports. Monoline in currentColor, so it takes the colour of the row it sits in
   and holds up in both themes. At 21px it has to read as a robot in one glance,
   which is why it is a helm with a visor and not a portrait with a face. */
export function RobotGlyph({ size = 22, className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* crest antenna */}
      <path d="M12 1.3v2.4" />
      <circle cx="12" cy="1.1" r=".95" fill="currentColor" stroke="none" />
      {/* helm: chamfered at the crown, drawn in to a jaw */}
      <path d="M9.2 3.7h5.6l3 2.9v5.2l-2.4 3.1h-6.8l-2.4-3.1V6.6Z" />
      {/* side ports */}
      <path d="M6.4 8.4H4.3M17.6 8.4h2.1" />
      {/* visor slot with two optics burning behind it */}
      <path d="M8.7 7.7h6.6v2.6H8.7Z" />
      <circle cx="10.4" cy="9" r=".85" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="9" r=".85" fill="currentColor" stroke="none" />
      {/* jaw vent */}
      <path d="M10 12.7h4" />
      {/* neck struts and shoulder line, so it reads as a unit and not a mask */}
      <path d="M10.2 15.1v2.1M13.8 15.1v2.1" />
      <path d="M4.6 22.3c1.2-2.2 3.9-3.4 7.4-3.4s6.2 1.2 7.4 3.4" />
    </svg>
  );
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/* wrap any angle into −180…180 so callers can spin the yaw counter forever */
export const wrapYaw = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

export function CyberAvatar({ model = "vanguard", yaw = 0, pose = "idle", headOnly = false, armorA = "#1a2233", armorB = "#38506e", glow = "#00f0ff", accent = "#aa00ff" }) {
  const id = "ca" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const v = normalizeModel(model);
  const term = v === "vanguard";     // endoskeleton build
  const bare = v === "nova";         // skin deactivated, chassis showing
  const helm = v === "sentinel";     // sealed faceplate
  const morph = v === "phantom";     // liquid metal

  /* ── the rig ── */
  const Y = wrapYaw(yaw);
  const c = Math.cos(Y * RAD), s = Math.sin(Y * RAD);
  const HR = 23;                 // head radius features are mounted on
  const E = 4.2;                 // face plane's offset ahead of the neck axis
  const k = 1;                   // the drawn profile carries the turn, not a stretch
  const cxs = 60 - E * s;                          // silhouette centre
  /* Three views of the same head, weighted by where it is pointing and painted
     back to front. The drawn profile always sits underneath, so at a three-
     quarter angle the front face is intact and only the nose and jaw of the
     profile show past its leading edge — which is exactly what a 3/4 head is. */
  const front = clamp((c - 0.02) / 0.24, 0, 1);    // face plane toward us
  const rear = clamp((-c - 0.02) / 0.24, 0, 1);    // back of the head toward us
  const side = Math.abs(s);

  /* place artwork drawn at front-view centre x0 onto the surface at azimuth th */
  const place = (th, x0, node, key, R = HR) => {
    const a = (th + Y) * RAD;
    const z = Math.cos(a);
    if (z <= 0.015) return null;
    const px = 60 - E * s + R * Math.sin(a);
    const fs = Math.max(0.03, z);
    return (
      <g key={key} opacity={clamp((z - 0.015) / 0.24, 0, 1)}
        transform={`translate(${px.toFixed(2)} 0) scale(${fs.toFixed(3)} 1) translate(${(-x0).toFixed(2)} 0)`}>{node}</g>
    );
  };
  const azOf = (x0) => Math.asin(clamp((x0 - 60) / HR, -1, 1)) * DEG;
  // a feature on the face: azimuth is recovered from where it is drawn
  const face = (x0, node, key) => place(azOf(x0), x0, node, key);
  // a feature on the back of the skull, drawn as it should look from behind
  const back = (x0, node, key) => place(180 + azOf(x0), x0, node, key);
  // the shell: silhouette geometry, which stays an ellipse however it turns
  const shell = (node, key) => (
    <g key={key} transform={`translate(${cxs.toFixed(2)} 0) scale(${k.toFixed(3)} 1) translate(-60 0)`}>{node}</g>
  );

  /* ── the T-800 dental grille ──
     The most recognisable thing about the skull, so it is built tooth by tooth
     rather than faked with a hatched rectangle: an upper and a lower row, each
     tooth its own shape, widths slightly uneven because the original prop's
     teeth were individually mounted to look imperfectly human. Every tooth is
     projected on its own, so the grille curves round the jaw as the head turns
     instead of shearing flat. */
  const teeth = () => {
    const upper = [45.5, 50, 54.5, 59, 63.5, 68, 72.5];
    const lower = [46.5, 51, 55.5, 60, 64.5, 69];
    return (
      <g className="ca-teeth">
        {face(60, <path d="M42 53 Q60 49 78 53 L76 65 Q60 70 44 65 Z" fill="#0a0d14" />, "tg")}
        {upper.map((x, i) => face(x, (
          <rect x={x - 2} y="53.4" width={i % 3 === 1 ? 4.2 : 3.6} height="5.4" rx="1.1"
            fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".28" opacity=".97" />
        ), "u" + i))}
        {lower.map((x, i) => face(x, (
          <rect x={x - 2} y="60.2" width={i % 2 ? 4 : 3.4} height="4.6" rx="1"
            fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".28" opacity=".93" />
        ), "l" + i))}
        {face(60, <path d="M43 59.4 Q60 62 77 59.4" fill="none" stroke="#05070c" strokeWidth="1.1" />, "tl")}
      </g>
    );
  };

  /* ── the CyberLife LED ring ──
     High on the android's right temple — which, facing us, is the viewer's
     LEFT — set in a shallow indent level with the skin, cycling blue → yellow
     the way it does while an android is working something out. */
  const ledRing = (cx, cy) => (
    <g className="ca-led">
      <circle cx={cx} cy={cy} r="5.4" fill="#0d1520" opacity=".8" />
      <circle cx={cx} cy={cy} r="4.3" fill="none" stroke="#8fa6c8" strokeWidth=".5" opacity=".6" />
      <circle cx={cx} cy={cy} r="4.3" fill="none" strokeWidth="1.9" strokeLinecap="round"
        stroke="currentColor" strokeDasharray="20 8" transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r="1.5" fill="currentColor" opacity=".9" />
    </g>
  );

  // a human eye for the android builds: lid, iris, pupil, catchlight
  const humanEye = (cx, cy, rx, ry) => (
    <g className="ca-eye">
      <path d={`M${cx - rx} ${cy} Q${cx} ${cy - ry * 1.55} ${cx + rx} ${cy} Q${cx} ${cy + ry * 1.25} ${cx - rx} ${cy} Z`} fill="#f2f7ff" />
      <circle cx={cx} cy={cy} r={ry * 0.86} fill={`url(#${id}-iris)`} />
      <circle cx={cx} cy={cy} r={ry * 0.38} fill="#050a14" />
      <circle cx={cx + rx * 0.2} cy={cy - ry * 0.34} r={ry * 0.24} fill="#fff" />
    </g>
  );

  // the T-800 optic: recessed socket, iris ring, glass lens, hard red core
  const optic = (cx, cy) => (
    <g>
      <path d={`M${cx - 9} ${cy - 3} Q${cx} ${cy - 9} ${cx + 9} ${cy - 3} Q${cx + 8} ${cy + 8} ${cx} ${cy + 9} Q${cx - 8} ${cy + 8} ${cx - 9} ${cy - 3} Z`} fill="#05070c" />
      <circle cx={cx} cy={cy} r="5.4" fill="#1a0206" />
      <circle cx={cx} cy={cy} r="4.6" fill={`url(#${id}-red)`} className="ca-optic" />
      <circle cx={cx} cy={cy} r="4.6" fill="none" stroke="#ff4d5e" strokeWidth=".6" opacity=".8" />
      <circle cx={cx} cy={cy} r="1.7" fill="#fff1f2" opacity=".95" />
      <circle cx={cx - 1.6} cy={cy - 1.8} r=".9" fill="#fff" opacity=".8" />
    </g>
  );

  /* Three side silhouettes, all facing right and mirrored when the model turns
     the other way. They are drawn, not derived — a brow, a nose, the step down
     to the lip and the line of the jaw are what a head is read by in profile,
     and none of that survives being computed from a front view. */
  const SIDE_ORGANIC = "M60 5 C74 5 84 15 84 28 L82 32 L79.5 36 Q85.5 39.5 85.8 42.4 Q85.4 44.4 79 45 L81.5 49 L78 52 L81 56 L77.5 60 Q80.6 62.6 79.6 65.4 C75 72 65 74 56 71 C44 68 36.5 58 36 44 C35.5 28 42 5 60 5 Z";
  const SIDE_SKULL = "M60 3 C74 3 84 12 84 26 L81 30 L77.5 34 Q84.6 37.6 85 41 Q84.4 43.2 77 44 L80 48 L73.5 51 L78 56 L72 61 L76 67 C71 72 61 73 54 69 C43 64 37 55 37 42 C36.5 26 43 3 60 3 Z";
  const SIDE_HELM = "M60 3 L74 6 L84 16 L85 29 L82.5 34 L85.8 41 L83.6 47 L79 51 L80.5 59 L74 67 L63 72 L53 70 L43 63 L36.5 51 L35 35 L38 19 L46 8 Z";
  // the audio/servo port that only exists in profile
  const sideEar = (fill, ln) => (
    <g>
      <path d="M52 36 Q60 33 61 42 Q62 51 53 51 Q49 44 52 36 Z" fill={fill} stroke={ln} strokeWidth=".7" strokeLinejoin="round" />
      <path d="M54 40 Q58 42 55 47" fill="none" stroke={ln} strokeWidth=".8" opacity=".85" />
    </g>
  );

  const HEAD = {
    /* ── VANGUARD · T-800 endoskeleton ── */
    vanguard: {
      skull: "M60 3 C74 3 84 13 84 27 C84 36 81 42 78 47 C75 56 68 66 60 72 C52 66 45 56 42 47 C39 42 36 36 36 27 C36 13 46 3 60 3 Z",
      fill: "chrome", line: "#e6eeff",
      side: SIDE_SKULL,
      sideArt: <>
        {/* sunken socket with the optic burning inside it, seen edge-on */}
        <path d="M70 28 Q80 26 82 33 Q80 39 71 38 Q67 33 70 28 Z" fill="#05070c" />
        <ellipse cx="76" cy="33" rx="3" ry="4.4" fill={`url(#${id}-red)`} className="ca-optic" />
        <ellipse cx="75.4" cy="31.6" rx="1" ry="1.5" fill="#fff1f2" opacity=".9" />
        {/* zygomatic arch running back to the jaw hinge */}
        <path d="M58 38 Q66 42 71 47" fill="none" stroke="#dbe6fb" strokeWidth="2" strokeLinecap="round" opacity=".9" />
        <circle cx="55" cy="43" r="3.4" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".6" />
        <circle cx="55" cy="43" r="1.2" fill="#05070c" opacity=".7" />
        {/* the dental grille in profile */}
        <path d="M60 49 L79 51 L78.5 57 L60 57 Z" fill="#0a0d14" />
        {[62.5, 66, 69.5, 73, 76.5].map((x, i) => (
          <g key={i}>
            <rect x={x} y="49.6" width="3" height="4.2" rx=".9" fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".25" />
            <rect x={x + .4} y="54.4" width="2.6" height="3.4" rx=".8" fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".25" opacity=".92" />
          </g>
        ))}
        <path d="M48 14 Q60 8 74 12" fill="none" stroke="#c9d8f2" strokeWidth=".8" opacity=".5" />
        <path d="M41 30 Q44 44 50 56" fill="none" stroke="#8fa6c8" strokeWidth=".8" opacity=".45" />
      </>,
      prof: { brow: 22, nose: 34, lip: 54, chin: 68 },
      shellArt: <>
        <path d="M60 4 L60 24" stroke="#c9d8f2" strokeWidth=".7" opacity=".55" />
        <path d="M40 20 Q60 14 80 20" fill="none" stroke="#c9d8f2" strokeWidth=".7" opacity=".45" />
      </>,
      art: <>
        {face(41.5, <path d="M38 26 Q42 24 45 27 L44 36 Q39 34 38 30 Z" fill="#151b26" opacity=".75" />, "t1")}
        {face(78.5, <path d="M82 26 Q78 24 75 27 L76 36 Q81 34 82 30 Z" fill="#151b26" opacity=".75" />, "t2")}
        {face(49, optic(49, 33), "o1")}
        {face(71, optic(71, 33), "o2")}
        {face(60, <path d="M60 39 L64.5 48 L60 50 L55.5 48 Z" fill="#05070c" />, "nas")}
        {/* zygomatic arches — the struts that give the skull its width */}
        {face(42, <path d="M38 38 Q44 44 47 50" fill="none" stroke="#dbe6fb" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />, "z1")}
        {face(78, <path d="M82 38 Q76 44 73 50" fill="none" stroke="#dbe6fb" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />, "z2")}
        {teeth()}
        {face(38.5, <circle cx="38.5" cy="50" r="2.6" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".5" />, "h1")}
        {face(81.5, <circle cx="81.5" cy="50" r="2.6" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".5" />, "h2")}
      </>,
      rear: <>
        <path d="M44 16 Q60 10 76 16 L74 46 Q60 54 46 46 Z" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 12 L60 52" stroke="#05070c" strokeWidth="1.4" opacity=".7" />
        <path d="M48 24 L72 24 M48 34 L72 34" stroke="#05070c" strokeWidth=".9" opacity=".5" />
        <circle cx="52" cy="44" r="2.2" fill="#ff2d46" className="ca-optic" />
        <circle cx="68" cy="44" r="2.2" fill="#ff2d46" className="ca-optic" />
      </>,
      neck: <>
        <path d="M51 70 L51 92 M60 72 L60 94 M69 70 L69 92" stroke={`url(#${id}-chrome)`} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M51 70 L51 92 M60 72 L60 94 M69 70 L69 92" stroke="#e6eeff" strokeWidth=".9" strokeLinecap="round" opacity=".55" />
        <circle cx="52" cy="80" r="2" fill="#8fa6c8" /><circle cx="68" cy="80" r="2" fill="#8fa6c8" />
        <circle cx="60" cy="85" r="2.3" fill="#ff2d46" opacity=".85" className="ca-optic" />
      </>,
    },

    /* ── SENTINEL · heavy assault helm ── */
    sentinel: {
      skull: "M60 4 C75 4 85 14 85 29 C85 39 83 46 80 52 L74 66 Q60 74 46 66 L40 52 C37 46 35 39 35 29 C35 14 45 4 60 4 Z",
      fill: "plate", line: "#9fb6de", body: "graphite", bodyLine: "#7c8794",
      side: SIDE_HELM,
      sideArt: <>
        <path d="M60 3 L66 8 L64 30 L59 32 L57 10 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        {/* the visor band, wrapping round the side of the helm */}
        <path d="M66 28 L84 30 L83 41 L67 41 Z" fill="#05070c" />
        <path d="M67.5 29.6 L82.6 31.4 L81.8 39.4 L68.4 39.4 Z" fill={`url(#${id}-visor)`} className="ca-visor" />
        <path d="M68.5 31.4 L81.6 33" fill="none" stroke="#fff" strokeWidth=".8" opacity=".55" />
        <path d="M62 46 L76 48 L75 54 L62 53 Z" fill="#0d1422" stroke="#7b90b6" strokeWidth=".6" />
        <path d="M64 49 L74 50 M64 51.4 L74 52.2" stroke={glow} strokeWidth=".6" opacity=".6" />
        {sideEar(`url(#${id}-trim)`, glow)}
        <path d="M40 22 Q38 42 44 58" fill="none" stroke={glow} strokeWidth=".8" opacity=".5" />
        <circle cx="46" cy="24" r="1.9" fill={accent} className="ca-optic" />
      </>,
      prof: { brow: 24, nose: 36, lip: 56, chin: 66 },
      shellArt: <>
        {/* crest fin down the crown */}
        <path d="M60 2 L64 10 L62 30 L60 34 L58 30 L56 10 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M37 24 Q60 17 83 24" fill="none" stroke={glow} strokeWidth=".9" opacity=".55" />
        <path d="M40 52 Q60 60 80 52" fill="none" stroke="#7b90b6" strokeWidth="1" opacity=".7" />
      </>,
      art: <>
        {/* the visor band — one continuous slit, the whole face of the helm */}
        {face(60, <>
          <path d="M38 30 Q60 24 82 30 L80 41 Q60 47 40 41 Z" fill="#05070c" />
          <path d="M40 31.5 Q60 26 80 31.5 L78.6 39.6 Q60 45 41.4 39.6 Z" fill={`url(#${id}-visor)`} className="ca-visor" />
          <path d="M41 33 Q60 28.5 79 33" fill="none" stroke="#fff" strokeWidth=".9" opacity=".55" />
          <path d="M52 29 L52 44 M68 29 L68 44" stroke="#05070c" strokeWidth="1" opacity=".55" />
        </>, "vis")}
        {/* jaw vents */}
        {face(52, <path d="M48 54 L56 56 L56 62 L49 60 Z" fill="#0d1422" stroke="#7b90b6" strokeWidth=".6" />, "jv1")}
        {face(68, <path d="M72 54 L64 56 L64 62 L71 60 Z" fill="#0d1422" stroke="#7b90b6" strokeWidth=".6" />, "jv2")}
        {face(60, <>
          <path d="M60 47 L60 66" stroke="#7b90b6" strokeWidth=".9" opacity=".7" />
          <path d="M53 64 Q60 68 67 64" fill="none" stroke={glow} strokeWidth="1.4" strokeLinecap="round" opacity=".85" />
        </>, "chin")}
        {face(38, <path d="M35 34 L42 38 L41 50 L36 44 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".6" />, "cp1")}
        {face(82, <path d="M85 34 L78 38 L79 50 L84 44 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".6" />, "cp2")}
        {face(44, <circle cx="44" cy="24" r="1.9" fill={accent} className="ca-optic" />, "ld")}
      </>,
      rear: <>
        <path d="M42 14 Q60 8 78 14 L76 50 Q60 58 44 50 Z" fill={`url(#${id}-plate)`} stroke="#7b90b6" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 10 L60 54" stroke={glow} strokeWidth="1.1" opacity=".6" />
        <path d="M47 22 L73 22 M47 32 L73 32 M47 42 L73 42" stroke="#0b1120" strokeWidth="1.2" opacity=".6" />
        <circle cx="60" cy="27" r="4.4" fill="none" stroke={glow} strokeWidth="1.2" opacity=".8" />
        <circle cx="60" cy="27" r="1.8" fill={glow} className="ca-optic" />
      </>,
      neck: null,
    },

    /* ── SPECTER · CyberLife android, skin active ── */
    specter: {
      skull: "M60 8 C72 8 80 17 81 30 C82 42 78 52 72 60 C68 66 64 70 60 70 C56 70 52 66 48 60 C42 52 38 42 39 30 C40 17 48 8 60 8 Z",
      fill: "skin", line: "#c8ab9e", body: "carbon", bodyLine: "#59636f", neckFill: "skin",
      side: SIDE_ORGANIC,
      sideArt: <>
        {/* the hair mass and one long strand, seen from the side */}
        <path d="M60 3 C76 3 85 14 84 27 C80 18 70 15 60 16 C48 17 40 22 37 32 C35 16 44 3 60 3 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" />
        <path d="M37 28 Q31 48 33 70 Q34 82 29 94 L40 94 Q45 78 44 60 Q43 42 46 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".95" />
        <path d="M68 30 Q74 27 79 31" fill="none" stroke="#8b9bb8" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
        <g className="ca-eye">
          <path d="M71 36 Q76 32.5 80.5 36 Q76 39.5 71 36 Z" fill="#f2f7ff" />
          <circle cx="76.4" cy="36" r="2.5" fill={`url(#${id}-iris)`} />
          <circle cx="76.4" cy="36" r="1.1" fill="#050a14" />
        </g>
        <path d="M73.5 50.5 Q77 49.5 79.5 51" fill="none" stroke="#c98f96" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
        {sideEar(`url(#${id}-skin)`, "#b99283")}
        <path d="M46 42 Q47 58 56 68" fill="none" stroke={glow} strokeWidth=".6" opacity=".4" />
        {ledRing(45, 25)}
      </>,
      prof: { brow: 27, nose: 38, lip: 56, chin: 68 },
      shellArt: <>
        <path d="M60 5 C75 5 84 15 84 29 C79 21 71 18 60 18 C49 18 41 21 36 29 C36 15 45 5 60 5 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" opacity=".95" />
        <path d="M38 26 Q30 44 32 68 Q33 80 28 92 L36 92 Q42 76 41 60 Q40 42 44 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M82 26 Q90 44 88 68 Q87 80 92 92 L84 92 Q78 76 79 60 Q80 42 76 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
      </>,
      art: <>
        {face(49.5, <path d="M43 30 Q50 27 56 29" fill="none" stroke="#8b9bb8" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />, "b1")}
        {face(70.5, <path d="M64 29 Q70 27 77 30" fill="none" stroke="#8b9bb8" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />, "b2")}
        {face(50, humanEye(50, 36, 7.4, 4.3), "e1")}
        {face(70, humanEye(70, 36, 7.4, 4.3), "e2")}
        {face(60, <path d="M60 38 L60 47 M57 48.6 Q60 50.2 63 48.6" fill="none" stroke="#7f8fac" strokeWidth="1" strokeLinecap="round" opacity=".85" />, "n")}
        {face(60, <path d="M53 56 Q56.5 53.6 60 55 Q63.5 53.6 67 56 Q63.5 60 60 60 Q56.5 60 53 56 Z" fill="#c98f96" opacity=".55" />, "m")}
        {/* the seam where the skin panel meets the jaw */}
        {face(45, <path d="M41 40 Q40 56 52 66" fill="none" stroke={glow} strokeWidth=".6" opacity=".45" />, "s1")}
        {face(75, <path d="M79 40 Q80 56 68 66" fill="none" stroke={glow} strokeWidth=".6" opacity=".45" />, "s2")}
        {face(41.5, ledRing(41.5, 29), "led")}
      </>,
      rear: <>
        <path d="M38 14 Q60 4 82 14 Q88 40 84 70 Q80 86 76 94 L44 94 Q40 86 36 70 Q32 40 38 14 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".97" />
        <path d="M52 20 Q60 44 56 92 M68 20 Q60 44 64 92" fill="none" stroke="#5b6489" strokeWidth=".8" opacity=".55" />
      </>,
      neck: null,
    },

    /* ── NOVA · android with its skin panels deactivated ── */
    nova: {
      skull: "M60 10 C76 10 86 21 86 36 C86 51 78 63 68 68 C64 70 56 70 52 68 C42 63 34 51 34 36 C34 21 44 10 60 10 Z",
      fill: "white", line: "#dbe6f7", body: "mint", bodyLine: "#4b8571",
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M50 15 Q62 10 74 15 L72 21 Q61 17 51 21 Z" fill="#dce8f7" stroke={glow} strokeWidth=".8" opacity=".95" />
        <path d="M38 30 Q60 24 82 30 M42 52 Q60 58 78 54" fill="none" stroke={glow} strokeWidth=".8" opacity=".6" />
        <g className="ca-eye">
          <path d="M70 38 Q76 34 81 38 Q76 42.5 70 38 Z" fill="#f2f7ff" />
          <circle cx="76" cy="38" r="3.1" fill={`url(#${id}-iris)`} />
          <circle cx="76" cy="38" r="1.3" fill="#050a14" />
        </g>
        <path d="M72 54 Q77 57 80 54" fill="none" stroke={glow} strokeWidth="1.7" strokeLinecap="round" />
        {sideEar(`url(#${id}-white)`, glow)}
        <path d="M40 36 L46 40 L45 50 L39 44 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />
        {ledRing(43, 30)}
      </>,
      prof: { brow: 30, nose: 42, lip: 60, chin: 68 },
      shellArt: <>
        <path d="M60 11 L60 26 M36 34 Q60 28 84 34" fill="none" stroke={glow} strokeWidth=".8" opacity=".7" />
        <path d="M46 20 Q60 16 74 20 L72 26 Q60 22 48 26 Z" fill="#dce8f7" stroke={glow} strokeWidth=".8" opacity=".95" />
      </>,
      art: <>
        {face(39, <path d="M36 40 L42 44 L40 54 L35 46 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />, "p1")}
        {face(81, <path d="M84 40 L78 44 L80 54 L85 46 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />, "p2")}
        {face(49, humanEye(49, 40, 9, 6.2), "e1")}
        {face(71, humanEye(71, 40, 9, 6.2), "e2")}
        {face(60, <path d="M60 44 L60 52 M57 53.4 Q60 55 63 53.4" fill="none" stroke="#7f8fac" strokeWidth="1" strokeLinecap="round" opacity=".8" />, "n")}
        {face(60, <>
          <path d="M42 54 Q60 60 78 54" fill="none" stroke={glow} strokeWidth=".8" opacity=".7" />
          <path d="M52 60 Q60 65 68 60" fill="none" stroke={glow} strokeWidth="1.9" strokeLinecap="round" />
          <path d="M55 62.4 Q60 65 65 62.4" fill="none" stroke={glow} strokeWidth=".9" strokeLinecap="round" opacity=".5" />
        </>, "m")}
        {face(37, ledRing(37, 34), "led")}
      </>,
      rear: <>
        <path d="M40 16 Q60 8 80 16 Q84 42 78 62 Q60 72 42 62 Q36 42 40 16 Z" fill={`url(#${id}-white)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 12 L60 68" stroke={glow} strokeWidth="1" opacity=".65" />
        <path d="M44 28 Q60 22 76 28 M44 44 Q60 38 76 44" fill="none" stroke={glow} strokeWidth=".8" opacity=".5" />
        <circle cx="60" cy="36" r="5" fill="#dce8f7" stroke={glow} strokeWidth=".9" />
        <circle cx="60" cy="36" r="2" fill={glow} className="ca-optic" />
      </>,
      neck: null,
    },

    /* ── PHANTOM · mimetic polyalloy ── */
    phantom: {
      skull: "M60 6 C74 6 83 16 83 30 C83 44 76 58 68 66 Q60 72 52 66 C44 58 37 44 37 30 C37 16 46 6 60 6 Z",
      fill: "chrome", line: "#f0f6ff", body: "pearl", bodyLine: "#7c8da8",
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M44 12 Q60 6 78 14" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".34" />
        <path d="M40 30 Q42 50 52 64" fill="none" stroke="#fff" strokeWidth="1" opacity=".26" />
        <path d="M70 33 Q76 30 81 34 Q76 37.5 70 33 Z" fill="#8fa3c4" opacity=".45" />
        <path d="M71.5 33.4 Q76 31.4 79.5 34 Q76 36 71.5 33.4 Z" fill="#05070c" opacity=".55" />
        <path d="M62 42 Q68 46 66 52" fill="none" stroke="#fff" strokeWidth="1.1" opacity=".24" />
        {sideEar(`url(#${id}-chrome)`, "#c9d8f2")}
        <g className="ca-morph">
          <path d="M48 16 L52 28 L48 38 L53 49" fill="none" stroke="#05070c" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
          <path d="M48 16 L52 28 L48 38 L53 49" fill="none" stroke="#eaf3ff" strokeWidth=".55" strokeLinecap="round" />
        </g>
        <ellipse cx="58" cy="20" rx="16" ry="5" fill="#fff" opacity=".22" transform="rotate(-14 58 20)" />
      </>,
      prof: { brow: 24, nose: 36, lip: 54, chin: 66 },
      shellArt: <>
        {/* the alloy holds a face only as contours — light bending on liquid metal */}
        <path d="M60 8 Q66 26 60 66" fill="none" stroke="#ffffff" strokeWidth=".8" opacity=".38" />
        <path d="M41 22 Q60 12 79 22" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity=".3" />
      </>,
      art: <>
        {face(49, <>
          <path d="M42 32 Q49 27 56 32 Q49 38 42 32 Z" fill="#8fa3c4" opacity=".5" />
          <path d="M43.5 32 Q49 29 54.5 32 Q49 35 43.5 32 Z" fill="#05070c" opacity=".65" />
          <circle cx="50.5" cy="31" r="1.1" fill="#fff" opacity=".85" />
        </>, "e1")}
        {face(71, <>
          <path d="M64 32 Q71 27 78 32 Q71 38 64 32 Z" fill="#8fa3c4" opacity=".5" />
          <path d="M65.5 32 Q71 29 76.5 32 Q71 35 65.5 32 Z" fill="#05070c" opacity=".65" />
          <circle cx="72.5" cy="31" r="1.1" fill="#fff" opacity=".85" />
        </>, "e2")}
        {face(60, <>
          <path d="M60 34 Q62.6 42 60 48 Q57.4 46 57.6 43" fill="none" stroke="#ffffff" strokeWidth=".9" opacity=".45" />
          <path d="M52 55 Q60 52 68 55 Q60 59 52 55 Z" fill="#7d90b0" opacity=".45" />
          <path d="M52 55 Q60 57 68 55" fill="none" stroke="#05070c" strokeWidth=".8" opacity=".5" />
        </>, "m")}
        {/* the fissure the alloy keeps closing — kept off the face's centre line
            so it reads as damage healing, not as a feature */}
        {face(43, <g className="ca-morph">
          <path d="M40 20 L44 30 L41 39 L45 49" fill="none" stroke="#05070c" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
          <path d="M40 20 L44 30 L41 39 L45 49" fill="none" stroke="#eaf3ff" strokeWidth=".55" strokeLinecap="round" />
        </g>, "fis")}
        {face(60, <ellipse cx="60" cy="24" rx="14" ry="4" fill="#fff" opacity=".3" />, "spec")}
        {/* cheekbones and brow ridge, held in the alloy as reflections only */}
        {face(45, <path d="M41 40 Q46 46 50 50" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".26" />, "ck1")}
        {face(75, <path d="M79 40 Q74 46 70 50" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".26" />, "ck2")}
        {face(49, <path d="M42 27 Q49 24 56 27" fill="none" stroke="#05070c" strokeWidth="1" opacity=".3" />, "br1")}
        {face(71, <path d="M64 27 Q71 24 78 27" fill="none" stroke="#05070c" strokeWidth="1" opacity=".3" />, "br2")}
      </>,
      rear: <>
        <path d="M40 14 Q60 6 80 14 Q84 40 74 62 Q60 70 46 62 Q36 40 40 14 Z" fill={`url(#${id}-chrome)`} stroke="#dbe6f7" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M46 22 Q60 16 74 22" fill="none" stroke="#fff" strokeWidth="1" opacity=".35" />
        <path d="M60 12 Q56 40 60 66" fill="none" stroke="#fff" strokeWidth=".7" opacity=".28" />
      </>,
      neck: null,
    },

    /* ── REAPER · war machine ── */
    reaper: {
      skull: "M60 2 L76 6 L86 18 L84 33 L79 46 L70 62 L60 73 L50 62 L41 46 L36 33 L34 18 L44 6 Z",
      fill: "plate", line: "#7a89a8", body: "obsidian", bodyLine: "#6d6580", hv: "13 -3 94 84",
      prof: { brow: 24, nose: 36, lip: 54, chin: 70 },
      shellArt: <>
        {/* horns swept back off the temples — the whole silhouette of the thing */}
        <path d="M42 15 L16 1 L23 21 L40 28 Z" fill={`url(#${id}-trim)`} stroke="#ff2d46" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M78 15 L104 1 L97 21 L80 28 Z" fill={`url(#${id}-trim)`} stroke="#ff2d46" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 3 L60 24" stroke="#ff2d46" strokeWidth="1.1" opacity=".55" />
      </>,
      art: <>
        {face(60, <>
          <path d="M37 27 L83 27 L78 45 L42 45 Z" fill="#05070c" />
          <ellipse cx="60" cy="36" rx="14" ry="7" fill={`url(#${id}-red)`} className="ca-optic" />
          <ellipse cx="60" cy="36" rx="4.6" ry="3.1" fill="#fff1f2" opacity=".95" />
          <path d="M39 29.5 L81 29.5" stroke="#ff4d5e" strokeWidth=".9" opacity=".7" />
        </>, "opt")}
        {face(60, <>
          <path d="M44 49 L76 49 L71 67 L49 67 Z" fill="#0a0d14" />
          <path d="M46 53 L74 53 M47 57.5 L73 57.5 M48.5 62 L71.5 62" stroke="#ff2d46" strokeWidth="1.1" opacity=".5" />
        </>, "jaw")}
        {face(40, <circle cx="40" cy="34" r="2.1" fill="#ff2d46" className="ca-optic" />, "r1")}
        {face(80, <circle cx="80" cy="34" r="2.1" fill="#ff2d46" className="ca-optic" />, "r2")}
      </>,
      side: SIDE_HELM,
      sideArt: <>
        <path d="M56 14 L28 2 L34 22 L54 28 Z" fill={`url(#${id}-trim)`} stroke="#ff2d46" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M66 28 L84 30 L82 42 L67 42 Z" fill="#05070c" />
        <ellipse cx="77" cy="35.5" rx="6" ry="5" fill={`url(#${id}-red)`} className="ca-optic" />
        <ellipse cx="76" cy="34" rx="2" ry="1.8" fill="#fff1f2" opacity=".9" />
        <path d="M60 48 L78 50 L74 64 L60 64 Z" fill="#0a0d14" />
        <path d="M62 53 L76 54 M63 58 L75 59" stroke="#ff2d46" strokeWidth="1" opacity=".5" />
        <path d="M42 24 Q39 42 45 58" fill="none" stroke="#7a89a8" strokeWidth=".9" opacity=".5" />
      </>,
      rear: <>
        <path d="M42 14 Q60 8 78 14 L76 52 Q60 60 44 52 Z" fill={`url(#${id}-plate)`} stroke="#5d6a86" strokeWidth=".8" strokeLinejoin="round" />
        {/* exhaust stacks */}
        <path d="M46 10 L52 10 L52 30 L46 30 Z M68 10 L74 10 L74 30 L68 30 Z" fill="#0a0d14" stroke="#7a89a8" strokeWidth=".7" />
        <circle cx="49" cy="12" r="2.2" fill="#ff2d46" className="ca-optic" />
        <circle cx="71" cy="12" r="2.2" fill="#ff2d46" className="ca-optic" />
        <path d="M46 38 L74 38 M46 46 L74 46" stroke="#05070c" strokeWidth="1.4" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── RONIN · cyber samurai ── */
    ronin: {
      skull: "M60 8 C76 8 85 18 85 32 C85 43 81 53 74 62 Q60 73 46 62 C39 53 35 43 35 32 C35 18 44 8 60 8 Z",
      fill: "lacquer", line: "#d98a8a", body: "lacquer", bodyLine: "#c07070", hv: "21 -5 78 84",
      prof: { brow: 26, nose: 37, lip: 55, chin: 70 },
      shellArt: <>
        {/* kabuto brim, and the maedate crest standing off the forehead */}
        <path d="M24 32 Q60 10 96 32 L93 41 Q60 21 27 41 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M45 17 Q60 -3 75 17 Q60 5 45 17 Z" fill="#ffd23f" stroke="#8a6a00" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M60 6 L60 16" stroke="#ffd23f" strokeWidth="1.4" />
      </>,
      art: <>
        {face(48, <>
          <path d="M39 32 L57 29 L56 39 L40 40 Z" fill="#05070c" />
          <path d="M41 33.6 L55.4 31.2 L54.6 37.4 L41.8 38.2 Z" fill="#ff3b4d" className="ca-optic" />
        </>, "e1")}
        {face(72, <>
          <path d="M81 32 L63 29 L64 39 L80 40 Z" fill="#05070c" />
          <path d="M79 33.6 L64.6 31.2 L65.4 37.4 L78.2 38.2 Z" fill="#ff3b4d" className="ca-optic" />
        </>, "e2")}
        {/* menpo: the war mask over the lower face, with its fanged grille */}
        {face(60, <>
          <path d="M41 45 Q60 41 79 45 L74 66 Q60 75 46 66 Z" fill="#1d060b" stroke="#c0392b" strokeWidth=".9" strokeLinejoin="round" />
          <path d="M45 51 Q60 48 75 51" fill="none" stroke="#e8a5a5" strokeWidth=".8" opacity=".7" />
          {[48, 53, 58, 63, 68].map((x, i) => (
            <path key={i} d={`M${x} 55 L${x + 3.4} 55 L${x + 1.7} 63 Z`} fill="#e8e2d2" stroke="#8a6a00" strokeWidth=".25" />
          ))}
          <path d="M46 66 Q60 72 74 66" fill="none" stroke="#c0392b" strokeWidth="1.2" />
        </>, "mask")}
        {face(37, <path d="M35 40 L42 44 L41 54 L34 47 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".6" />, "c1")}
        {face(83, <path d="M85 40 L78 44 L79 54 L86 47 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".6" />, "c2")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M34 34 Q58 12 88 30 L86 39 Q58 23 36 43 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M56 18 Q66 0 78 16 Q66 8 56 18 Z" fill="#ffd23f" stroke="#8a6a00" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M67 32 L81 30 L80 39 L68 40 Z" fill="#05070c" />
        <path d="M69 33.6 L79.4 32 L78.6 37.6 L69.8 38.4 Z" fill="#ff3b4d" className="ca-optic" />
        <path d="M58 45 Q72 42 82 47 L78 64 Q66 71 58 66 Z" fill="#1d060b" stroke="#c0392b" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M63 55 L66 55 L64.5 62 Z M70 55.5 L73 55.5 L71.5 62.5 Z" fill="#e8e2d2" />
        <path d="M40 44 Q42 58 50 66" fill="none" stroke="#c07070" strokeWidth=".8" opacity=".55" />
      </>,
      rear: <>
        <path d="M40 16 Q60 8 80 16 Q84 42 78 62 Q60 72 42 62 Q36 42 40 16 Z" fill={`url(#${id}-lacquer)`} stroke="#c07070" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 12 L60 66" stroke="#e8a5a5" strokeWidth="1" opacity=".5" />
        <path d="M44 28 Q60 22 76 28 M44 44 Q60 38 76 44" fill="none" stroke="#c0392b" strokeWidth=".9" opacity=".6" />
        {/* the knot of the mask's cord */}
        <path d="M52 50 L68 50 L64 62 L56 62 Z" fill="#c0392b" opacity=".8" />
      </>,
      neck: null,
    },

    /* ── AURORA · idol android ── */
    aurora: {
      skull: "M60 8 C73 8 81 18 82 31 C83 43 78 53 72 61 C68 67 64 71 60 71 C56 71 52 67 48 61 C42 53 37 43 38 31 C39 18 47 8 60 8 Z",
      fill: "aurora", line: "#efe6ff", body: "aurora", bodyLine: "#a293c4", hv: "23 0 74 78",
      prof: { brow: 27, nose: 39, lip: 57, chin: 69 },
      shellArt: <>
        {/* light-fibre hair, and a tiara fin that reads at any size */}
        <path d="M60 4 C77 4 86 15 85 30 C79 20 71 17 60 17 C49 17 40 20 35 30 C34 15 43 4 60 4 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" opacity=".97" />
        <path d="M36 28 Q26 50 30 74 Q32 88 26 100 L36 100 Q44 82 42 62 Q41 44 45 32 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M84 28 Q94 50 90 74 Q88 88 94 100 L84 100 Q76 82 78 62 Q79 44 75 32 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M48 12 L54 4 L60 11 L66 4 L72 12 Q60 7 48 12 Z" fill="#ffffff" stroke={accent} strokeWidth=".7" strokeLinejoin="round" />
      </>,
      art: <>
        {face(60, <path d="M56 20 L60 14 L64 20 L60 24 Z" fill={accent} className="ca-optic" />, "gem")}
        {face(49, <path d="M42 29 Q49 25.6 56 28" fill="none" stroke="#b6a6d8" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />, "b1")}
        {face(71, <path d="M64 28 Q71 25.6 78 29" fill="none" stroke="#b6a6d8" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />, "b2")}
        {face(49, <g className="ca-eye">
          <path d="M40 37 Q49 30 58 37 Q49 44 40 37 Z" fill="#fbf8ff" />
          <circle cx="49" cy="37" r="5.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="49" cy="37" r="2.1" fill="#0a0f22" />
          <circle cx="51" cy="34.8" r="1.7" fill="#fff" />
          <circle cx="46.6" cy="39" r=".9" fill="#fff" opacity=".8" />
        </g>, "e1")}
        {face(71, <g className="ca-eye">
          <path d="M62 37 Q71 30 80 37 Q71 44 62 37 Z" fill="#fbf8ff" />
          <circle cx="71" cy="37" r="5.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="71" cy="37" r="2.1" fill="#0a0f22" />
          <circle cx="73" cy="34.8" r="1.7" fill="#fff" />
          <circle cx="68.6" cy="39" r=".9" fill="#fff" opacity=".8" />
        </g>, "e2")}
        {face(60, <path d="M60 40 L60 48 M57.4 49.4 Q60 51 62.6 49.4" fill="none" stroke="#9c8cc0" strokeWidth=".9" strokeLinecap="round" opacity=".8" />, "n")}
        {face(60, <path d="M54 56 Q57 53.6 60 55 Q63 53.6 66 56 Q63 60 60 60 Q57 60 54 56 Z" fill="#e39ab4" opacity=".7" />, "m")}
        {face(42, <ellipse cx="42" cy="48" rx="5" ry="2.8" fill="#ffb3cd" opacity=".45" />, "bl1")}
        {face(78, <ellipse cx="78" cy="48" rx="5" ry="2.8" fill="#ffb3cd" opacity=".45" />, "bl2")}
        {face(39, ledRing(39, 30), "led")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M60 4 C77 4 86 16 85 29 C81 19 71 16 60 17 C48 18 40 23 37 33 C35 17 44 4 60 4 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M36 30 Q28 52 31 76 Q32 90 26 102 L38 102 Q46 84 44 62 Q43 44 46 34 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".95" />
        <g className="ca-eye">
          <path d="M69 37 Q75 32 81 37 Q75 42 69 37 Z" fill="#fbf8ff" />
          <circle cx="75.6" cy="37" r="3.2" fill={`url(#${id}-bigiris)`} />
          <circle cx="75.6" cy="37" r="1.3" fill="#0a0f22" />
          <circle cx="76.8" cy="35.6" r="1" fill="#fff" />
        </g>
        <path d="M74 51.5 Q78 50.4 80.5 52" fill="none" stroke="#e39ab4" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
        <ellipse cx="66" cy="47" rx="4" ry="2.4" fill="#ffb3cd" opacity=".4" />
        {sideEar(`url(#${id}-aurora)`, "#cbb8f0")}
        {ledRing(45, 27)}
      </>,
      rear: <>
        <path d="M37 14 Q60 4 83 14 Q89 42 85 72 Q81 90 77 102 L43 102 Q39 90 35 72 Q31 42 37 14 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M52 20 Q60 46 56 100 M68 20 Q60 46 64 100" fill="none" stroke="#b7a7dc" strokeWidth=".8" opacity=".6" />
        <path d="M48 12 L54 4 L60 11 L66 4 L72 12 Q60 7 48 12 Z" fill="#ffffff" stroke={accent} strokeWidth=".7" strokeLinejoin="round" />
      </>,
      neck: null,
    },

    /* ── PIXEL · screen-face buddy ── */
    pixel: {
      skull: "M60 5 C82 5 91 16 91 34 C91 55 82 68 60 68 C38 68 29 55 29 34 C29 16 38 5 60 5 Z",
      fill: "white", line: "#cfe4ff", body: "sky", bodyLine: "#5a80a6", hv: "20 -15 80 88",
      prof: { brow: 26, nose: 38, lip: 54, chin: 66 },
      shellArt: <>
        <path d="M60 5 L60 -6" stroke={glow} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="-9" r="4.4" fill={glow} className="ca-optic" />
        <path d="M29 34 Q60 28 91 34" fill="none" stroke={glow} strokeWidth=".9" opacity=".4" />
      </>,
      art: <>
        {face(60, <>
          <rect x="35" y="20" width="50" height="36" rx="10" fill="#0a1020" stroke={glow} strokeWidth="1.2" />
          <rect x="37" y="22" width="46" height="32" rx="8" fill="none" stroke="#1d3358" strokeWidth=".8" />
          <g className="ca-eye">
            <rect x="45" y="29" width="8" height="11" rx="2.6" fill={glow} />
            <rect x="67" y="29" width="8" height="11" rx="2.6" fill={glow} />
            <rect x="46.6" y="30.6" width="2.6" height="3.4" rx="1" fill="#fff" opacity=".9" />
            <rect x="68.6" y="30.6" width="2.6" height="3.4" rx="1" fill="#fff" opacity=".9" />
          </g>
          <path d="M50 45 Q60 52 70 45" fill="none" stroke={glow} strokeWidth="2.4" strokeLinecap="round" />
        </>, "screen")}
        {face(33, <rect x="28" y="45" width="10" height="6" rx="3" fill="#ff8fb0" opacity=".85" />, "bl1")}
        {face(87, <rect x="82" y="45" width="10" height="6" rx="3" fill="#ff8fb0" opacity=".85" />, "bl2")}
        {face(30, <rect x="24" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />, "ear1")}
        {face(90, <rect x="89" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />, "ear2")}
      </>,
      side: "M60 6 C80 6 88 17 88 34 C88 42 88 47 86 52 L84 58 C80 65 70 70 60 70 C42 70 32 56 32 36 C32 18 42 6 60 6 Z",
      sideArt: <>
        <path d="M60 6 L60 -6" stroke={glow} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="-9" r="4.4" fill={glow} className="ca-optic" />
        <path d="M62 20 L84 22 L82 54 L62 56 Z" fill="#0a1020" stroke={glow} strokeWidth="1.1" strokeLinejoin="round" />
        <rect x="70" y="30" width="7.5" height="11" rx="2.6" fill={glow} className="ca-eye" />
        <path d="M68 46 Q75 51 80 46" fill="none" stroke={glow} strokeWidth="2" strokeLinecap="round" />
        <rect x="30" y="30" width="8" height="15" rx="4" fill="#dce8f7" stroke={glow} strokeWidth=".8" />
        <rect x="54" y="45" width="9" height="6" rx="3" fill="#ff8fb0" opacity=".8" />
      </>,
      rear: <>
        <path d="M34 14 Q60 6 86 14 Q90 42 84 60 Q60 70 36 60 Q30 42 34 14 Z" fill={`url(#${id}-white)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" />
        <circle cx="60" cy="36" r="9" fill="#dce8f7" stroke={glow} strokeWidth="1" />
        <circle cx="60" cy="36" r="3.4" fill={glow} className="ca-optic" />
        <path d="M42 20 L78 20 M42 54 L78 54" stroke={glow} strokeWidth=".9" opacity=".5" />
        <rect x="24" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />
        <rect x="89" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />
      </>,
      neck: null,
    },

    /* ── MOCHI · squishy pocket bot ── */
    mochi: {
      skull: "M60 5 C85 5 93 22 93 41 C93 60 80 71 60 71 C40 71 27 60 27 41 C27 22 35 5 60 5 Z",
      fill: "mochi", line: "#ffd7e3", body: "mochi", bodyLine: "#dd91ac", hv: "20 -7 80 84",
      prof: { brow: 28, nose: 41, lip: 56, chin: 68 },
      shellArt: <>
        <ellipse cx="30" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <ellipse cx="90" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <path d="M53 6 Q60 -4 67 6 Q60 1 53 6 Z" fill="#ff8fb0" stroke="#e06d92" strokeWidth=".7" strokeLinejoin="round" />
      </>,
      art: <>
        {face(60, <path d="M60 13 C63 8 69 10 69 15 C69 19 63 22 60 25 C57 22 51 19 51 15 C51 10 57 8 60 13 Z" fill="#ff7aa5" stroke="#e06d92" strokeWidth=".6" className="ca-optic" />, "heart")}
        {face(47, <g className="ca-eye">
          <ellipse cx="47" cy="42" rx="9.5" ry="11" fill="#20182a" />
          <ellipse cx="47" cy="42" rx="8" ry="9.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="50" cy="38" r="3.4" fill="#fff" />
          <circle cx="44" cy="46" r="1.8" fill="#fff" opacity=".9" />
          <circle cx="49.4" cy="46.6" r="1.1" fill="#fff" opacity=".7" />
        </g>, "e1")}
        {face(73, <g className="ca-eye">
          <ellipse cx="73" cy="42" rx="9.5" ry="11" fill="#20182a" />
          <ellipse cx="73" cy="42" rx="8" ry="9.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="76" cy="38" r="3.4" fill="#fff" />
          <circle cx="70" cy="46" r="1.8" fill="#fff" opacity=".9" />
          <circle cx="75.4" cy="46.6" r="1.1" fill="#fff" opacity=".7" />
        </g>, "e2")}
        {face(34, <ellipse cx="34" cy="52" rx="6.5" ry="4.4" fill="#ff9ec0" opacity=".85" />, "bl1")}
        {face(86, <ellipse cx="86" cy="52" rx="6.5" ry="4.4" fill="#ff9ec0" opacity=".85" />, "bl2")}
        {face(60, <path d="M55 58 Q60 63 65 58" fill="none" stroke="#c76b8c" strokeWidth="2.2" strokeLinecap="round" />, "m")}
      </>,
      side: "M60 5 C84 5 92 22 92 41 C92 55 84 66 72 70 Q60 73 50 69 C36 63 28 52 28 40 C28 21 38 5 60 5 Z",
      sideArt: <>
        <ellipse cx="46" cy="36" rx="8" ry="10" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <path d="M53 6 Q60 -4 67 6 Q60 1 53 6 Z" fill="#ff8fb0" stroke="#e06d92" strokeWidth=".7" strokeLinejoin="round" />
        <g className="ca-eye">
          <ellipse cx="76" cy="42" rx="8" ry="10.4" fill="#20182a" />
          <ellipse cx="76" cy="42" rx="6.6" ry="8.8" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="38.4" r="3" fill="#fff" />
          <circle cx="73.6" cy="46" r="1.5" fill="#fff" opacity=".85" />
        </g>
        <ellipse cx="62" cy="53" rx="6" ry="4" fill="#ff9ec0" opacity=".8" />
        <path d="M76 58 Q81 62 84 57" fill="none" stroke="#c76b8c" strokeWidth="2" strokeLinecap="round" />
      </>,
      rear: <>
        <path d="M30 16 Q60 4 90 16 Q95 44 88 62 Q60 74 32 62 Q25 44 30 16 Z" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" strokeLinejoin="round" />
        <ellipse cx="30" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <ellipse cx="90" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <path d="M53 6 Q60 -4 67 6 Q60 1 53 6 Z" fill="#ff8fb0" stroke="#e06d92" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M48 30 Q60 24 72 30 M46 46 Q60 40 74 46" fill="none" stroke="#e8a8c0" strokeWidth="1" opacity=".7" />
        <circle cx="60" cy="38" r="4" fill="#ff9ec0" opacity=".7" />
      </>,
      neck: null,
    },

    /* ── SCOUT · RK negotiator ──
       A CyberLife build meant to stand in a room full of people and be taken
       for one of them: an ordinary face, short swept hair, freckles, and the
       one thing that gives it away sitting on the temple. */
    scout: {
      skull: "M60 8 C72 8 80 17 81 30 C82 42 78 52 72 60 C68 66 64 70 60 70 C56 70 52 66 48 60 C42 52 38 42 39 30 C40 17 48 8 60 8 Z",
      fill: "skin", line: "#c8ab9e", body: "ivory", bodyLine: "#7d879a", neckFill: "skin",
      prof: { brow: 27, nose: 38, lip: 56, chin: 68 },
      shellArt: <>
        <path d="M60 5 C75 5 84 15 84 30 C80 22 74 19 66 18 C56 17 46 20 39 27 C37 15 45 5 60 5 Z" fill={`url(#${id}-hairB)`} stroke="#2a1a10" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M39 27 C44 20 52 17 60 18 C52 21 45 26 41 34 Z" fill={`url(#${id}-hairB)`} stroke="#2a1a10" strokeWidth=".6" strokeLinejoin="round" />
      </>,
      art: <>
        {face(49, <path d="M42 30 Q49 26.6 56 29" fill="none" stroke="#3d2718" strokeWidth="1.6" strokeLinecap="round" />, "b1")}
        {face(71, <path d="M64 29 Q71 26.6 78 30" fill="none" stroke="#3d2718" strokeWidth="1.6" strokeLinecap="round" />, "b2")}
        {face(50, <g className="ca-eye">
          <path d="M43 36 Q50 31 57 36 Q50 41 43 36 Z" fill="#f6f1ea" />
          <circle cx="50" cy="36" r="3.9" fill={`url(#${id}-brown)`} />
          <circle cx="50" cy="36" r="1.6" fill="#140b06" />
          <circle cx="51.4" cy="34.6" r="1.2" fill="#fff" />
        </g>, "e1")}
        {face(70, <g className="ca-eye">
          <path d="M63 36 Q70 31 77 36 Q70 41 63 36 Z" fill="#f6f1ea" />
          <circle cx="70" cy="36" r="3.9" fill={`url(#${id}-brown)`} />
          <circle cx="70" cy="36" r="1.6" fill="#140b06" />
          <circle cx="71.4" cy="34.6" r="1.2" fill="#fff" />
        </g>, "e2")}
        {face(60, <path d="M60 38 L60 47 M57 48.6 Q60 50.2 63 48.6" fill="none" stroke="#a97f60" strokeWidth="1" strokeLinecap="round" />, "n")}
        {face(60, <path d="M53.5 56 Q57 53.8 60 55 Q63 53.8 66.5 56 Q63 59.6 60 59.6 Q57 59.6 53.5 56 Z" fill="#bd7f78" opacity=".72" />, "m")}
        {/* freckles */}
        {face(46, <g fill="#a4703f" opacity=".55"><circle cx="45" cy="43" r=".9" /><circle cx="49" cy="45.4" r=".8" /><circle cx="43" cy="46.6" r=".7" /></g>, "f1")}
        {face(74, <g fill="#a4703f" opacity=".55"><circle cx="75" cy="43" r=".9" /><circle cx="71" cy="45.4" r=".8" /><circle cx="77" cy="46.6" r=".7" /></g>, "f2")}
        {face(41.5, ledRing(41.5, 29), "led")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M60 5 C76 5 85 16 84 29 C80 20 71 17 60 18 C49 19 41 24 38 33 C36 16 45 5 60 5 Z" fill={`url(#${id}-hairB)`} stroke="#2a1a10" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M69 30 Q75 27 80 31" fill="none" stroke="#3d2718" strokeWidth="1.5" strokeLinecap="round" />
        <g className="ca-eye">
          <path d="M71 36 Q76 32.6 80.5 36 Q76 39.4 71 36 Z" fill="#f6f1ea" />
          <circle cx="76.4" cy="36" r="2.4" fill={`url(#${id}-brown)`} />
          <circle cx="76.4" cy="36" r="1" fill="#140b06" />
        </g>
        <path d="M73.5 50.5 Q77 49.4 79.5 51" fill="none" stroke="#bd7f78" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
        {sideEar(`url(#${id}-skin)`, "#b08a6c")}
        {ledRing(45, 26)}
      </>,
      rear: <>
        <path d="M38 12 Q60 4 82 12 Q86 34 82 52 Q60 62 38 52 Q34 34 38 12 Z" fill={`url(#${id}-hairB)`} stroke="#2a1a10" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M48 18 Q60 30 52 52 M72 18 Q60 30 68 52" fill="none" stroke="#543724" strokeWidth=".9" opacity=".55" />
      </>,
      neck: null,
    },

    /* ── MERIDIAN · PL caretaker ──
       Two different eyes, which in the source material is the mark of a unit
       repaired with whatever parts were to hand. Close-cropped, deep skin. */
    meridian: {
      skull: "M60 8 C73 8 81 18 82 31 C83 43 78 53 72 61 C68 67 64 71 60 71 C56 71 52 67 48 61 C42 53 37 43 38 31 C39 18 47 8 60 8 Z",
      fill: "skin2", line: "#8a5f42", body: "slateb", bodyLine: "#6c82a0", neckFill: "skin2",
      prof: { brow: 27, nose: 39, lip: 57, chin: 69 },
      shellArt: <>
        <path d="M60 5 C76 5 85 16 84 30 C79 23 71 20 60 20 C49 20 41 23 36 30 C35 16 44 5 60 5 Z" fill="#2a1d15" stroke="#1a1109" strokeWidth=".7" strokeLinejoin="round" opacity=".95" />
        <path d="M40 27 Q60 20 80 27" fill="none" stroke="#3f2c1e" strokeWidth="1.4" opacity=".7" />
      </>,
      art: <>
        {face(49, <path d="M42 30 Q49 26.4 56 29" fill="none" stroke="#2f1f14" strokeWidth="1.8" strokeLinecap="round" />, "b1")}
        {face(71, <path d="M64 29 Q71 26.4 78 30" fill="none" stroke="#2f1f14" strokeWidth="1.8" strokeLinecap="round" />, "b2")}
        {face(50, <g className="ca-eye">
          <path d="M43 36.5 Q50 31.4 57 36.5 Q50 41.6 43 36.5 Z" fill="#f3ece2" />
          <circle cx="50" cy="36.5" r="4" fill={`url(#${id}-iris)`} />
          <circle cx="50" cy="36.5" r="1.7" fill="#0a0f1c" />
          <circle cx="51.5" cy="35" r="1.3" fill="#fff" />
        </g>, "e1")}
        {face(70, <g className="ca-eye">
          <path d="M63 36.5 Q70 31.4 77 36.5 Q70 41.6 63 36.5 Z" fill="#f3ece2" />
          <circle cx="70" cy="36.5" r="4" fill={`url(#${id}-iris2)`} />
          <circle cx="70" cy="36.5" r="1.7" fill="#0a1a0e" />
          <circle cx="71.5" cy="35" r="1.3" fill="#fff" />
        </g>, "e2")}
        {face(60, <path d="M60 39 L60 48 M57 49.4 Q60 51 63 49.4" fill="none" stroke="#7a5138" strokeWidth="1" strokeLinecap="round" />, "n")}
        {face(60, <path d="M53 57 Q56.6 54.6 60 56 Q63.4 54.6 67 57 Q63.4 60.8 60 60.8 Q56.6 60.8 53 57 Z" fill="#8f5a52" opacity=".8" />, "m")}
        {face(44, <path d="M40 42 Q42 52 50 62" fill="none" stroke="#6b452e" strokeWidth=".7" opacity=".4" />, "s1")}
        {face(76, <path d="M80 42 Q78 52 70 62" fill="none" stroke="#6b452e" strokeWidth=".7" opacity=".4" />, "s2")}
        {face(41.5, ledRing(41.5, 29), "led")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M60 5 C77 5 86 16 85 30 C80 22 70 19 60 19 C48 19 40 23 36 32 C35 16 44 5 60 5 Z" fill="#2a1d15" stroke="#1a1109" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M69 30 Q75 26.6 80 31" fill="none" stroke="#2f1f14" strokeWidth="1.7" strokeLinecap="round" />
        <g className="ca-eye">
          <path d="M71 36.5 Q76 33 80.5 36.5 Q76 40 71 36.5 Z" fill="#f3ece2" />
          <circle cx="76.4" cy="36.5" r="2.5" fill={`url(#${id}-iris2)`} />
          <circle cx="76.4" cy="36.5" r="1" fill="#0a1a0e" />
        </g>
        <path d="M74 51.5 Q77.5 50.2 80 52" fill="none" stroke="#8f5a52" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
        {sideEar(`url(#${id}-skin2)`, "#7e553a")}
        {ledRing(45, 26)}
      </>,
      rear: <>
        <path d="M37 12 Q60 3 83 12 Q87 34 83 54 Q60 64 37 54 Q33 34 37 12 Z" fill="#2a1d15" stroke="#1a1109" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M46 20 Q60 32 50 54 M74 20 Q60 32 70 54" fill="none" stroke="#3f2c1e" strokeWidth=".9" opacity=".55" />
      </>,
      neck: null,
    },

    /* ── ATLAS · TR heavy labour ──
       Built for lifting, so the head is broader and the jaw squarer, and there
       is nothing on it to catch: a bare scalp with its seam showing. */
    atlas: {
      skull: "M60 7 C75 7 84 18 85 32 C86 45 81 55 74 63 C69 69 65 72 60 72 C55 72 51 69 46 63 C39 55 34 45 35 32 C36 18 45 7 60 7 Z",
      fill: "skin3", line: "#7a4a30", body: "bronze", bodyLine: "#9c6c36", neckFill: "skin3",
      prof: { brow: 26, nose: 39, lip: 57, chin: 71 },
      shellArt: <>
        <path d="M42 22 Q60 12 78 22" fill="none" stroke="#4a2b1c" strokeWidth="1.2" opacity=".55" />
        <path d="M60 7 L60 20" stroke="#4a2b1c" strokeWidth=".9" opacity=".4" />
      </>,
      art: <>
        {face(48, <path d="M40 30 Q48 25.6 57 29" fill="none" stroke="#24140c" strokeWidth="2.2" strokeLinecap="round" />, "b1")}
        {face(72, <path d="M63 29 Q72 25.6 80 30" fill="none" stroke="#24140c" strokeWidth="2.2" strokeLinecap="round" />, "b2")}
        {face(49, <g className="ca-eye">
          <path d="M42 37 Q49 32.2 56 37 Q49 41.6 42 37 Z" fill="#efe6da" />
          <circle cx="49" cy="37" r="3.8" fill={`url(#${id}-brown)`} />
          <circle cx="49" cy="37" r="1.6" fill="#0d0704" />
          <circle cx="50.4" cy="35.6" r="1.2" fill="#fff" />
        </g>, "e1")}
        {face(71, <g className="ca-eye">
          <path d="M64 37 Q71 32.2 78 37 Q71 41.6 64 37 Z" fill="#efe6da" />
          <circle cx="71" cy="37" r="3.8" fill={`url(#${id}-brown)`} />
          <circle cx="71" cy="37" r="1.6" fill="#0d0704" />
          <circle cx="72.4" cy="35.6" r="1.2" fill="#fff" />
        </g>, "e2")}
        {face(60, <path d="M60 39 L60 49 M56.4 50.6 Q60 52.4 63.6 50.6" fill="none" stroke="#68402a" strokeWidth="1.2" strokeLinecap="round" />, "n")}
        {face(60, <path d="M52 58 Q56.4 55.6 60 57 Q63.6 55.6 68 58 Q63.6 62 60 62 Q56.4 62 52 58 Z" fill="#7d4a41" opacity=".8" />, "m")}
        {face(60, <path d="M50 66 Q60 70 70 66" fill="none" stroke="#4a2b1c" strokeWidth=".8" opacity=".4" />, "j")}
        {face(40, ledRing(40, 28), "led")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M44 22 Q62 13 82 24" fill="none" stroke="#4a2b1c" strokeWidth="1.2" opacity=".5" />
        <path d="M69 30 Q75 26 81 31" fill="none" stroke="#24140c" strokeWidth="2" strokeLinecap="round" />
        <g className="ca-eye">
          <path d="M70 37 Q76 33.4 81 37 Q76 40.6 70 37 Z" fill="#efe6da" />
          <circle cx="76" cy="37" r="2.5" fill={`url(#${id}-brown)`} />
          <circle cx="76" cy="37" r="1" fill="#0d0704" />
        </g>
        <path d="M73 52 Q77 50.6 80 52.4" fill="none" stroke="#7d4a41" strokeWidth="1.8" strokeLinecap="round" opacity=".85" />
        {sideEar(`url(#${id}-skin3)`, "#6e4229")}
        {ledRing(44, 26)}
      </>,
      rear: <>
        <path d="M60 10 L60 62" stroke="#4a2b1c" strokeWidth="1" opacity=".4" />
        <path d="M42 24 Q60 16 78 24 M42 44 Q60 38 78 44" fill="none" stroke="#4a2b1c" strokeWidth="1" opacity=".4" />
        {ledRing(80, 28)}
      </>,
      neck: null,
    },

    /* ── HALCYON · RT first generation ──
       The demonstration model — the one that was meant to be looked at. Long
       blonde hair, an open face, and the LED left deliberately visible. */
    halcyon: {
      skull: "M60 8 C72 8 80 17 81 30 C82 42 78 52 72 60 C68 66 64 70 60 70 C56 70 52 66 48 60 C42 52 38 42 39 30 C40 17 48 8 60 8 Z",
      fill: "skin", line: "#c8ab9e", body: "plum", bodyLine: "#8d63a8", neckFill: "skin",
      prof: { brow: 27, nose: 38, lip: 56, chin: 68 },
      shellArt: <>
        <path d="M60 4 C76 4 85 15 84 30 C79 21 71 18 60 18 C49 18 41 21 36 30 C35 15 44 4 60 4 Z" fill={`url(#${id}-hair2)`} stroke="#9c7530" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M37 26 Q28 48 31 72 Q32 86 26 98 L37 98 Q45 80 43 60 Q42 42 45 31 Z" fill={`url(#${id}-hair2)`} stroke="#9c7530" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M83 26 Q92 48 89 72 Q88 86 94 98 L83 98 Q75 80 77 60 Q78 42 75 31 Z" fill={`url(#${id}-hair2)`} stroke="#9c7530" strokeWidth=".7" strokeLinejoin="round" />
      </>,
      art: <>
        {face(49, <path d="M42 29.5 Q49 26 56 28.6" fill="none" stroke="#a98134" strokeWidth="1.5" strokeLinecap="round" />, "b1")}
        {face(71, <path d="M64 28.6 Q71 26 78 29.5" fill="none" stroke="#a98134" strokeWidth="1.5" strokeLinecap="round" />, "b2")}
        {face(50, <g className="ca-eye">
          <path d="M42.6 36 Q50 30.6 57.4 36 Q50 41.4 42.6 36 Z" fill="#f8f4ee" />
          <circle cx="50" cy="36" r="4.2" fill={`url(#${id}-iris)`} />
          <circle cx="50" cy="36" r="1.7" fill="#08101f" />
          <circle cx="51.5" cy="34.5" r="1.4" fill="#fff" />
        </g>, "e1")}
        {face(70, <g className="ca-eye">
          <path d="M62.6 36 Q70 30.6 77.4 36 Q70 41.4 62.6 36 Z" fill="#f8f4ee" />
          <circle cx="70" cy="36" r="4.2" fill={`url(#${id}-iris)`} />
          <circle cx="70" cy="36" r="1.7" fill="#08101f" />
          <circle cx="71.5" cy="34.5" r="1.4" fill="#fff" />
        </g>, "e2")}
        {face(60, <path d="M60 38 L60 47 M57 48.6 Q60 50.2 63 48.6" fill="none" stroke="#b08f78" strokeWidth="1" strokeLinecap="round" />, "n")}
        {face(60, <path d="M53.4 56 Q57 53.4 60 55 Q63 53.4 66.6 56 Q63 60 60 60 Q57 60 53.4 56 Z" fill="#d1868c" opacity=".8" />, "m")}
        {face(42, <ellipse cx="42" cy="47" rx="4.6" ry="2.6" fill="#e8a0a8" opacity=".35" />, "bl1")}
        {face(78, <ellipse cx="78" cy="47" rx="4.6" ry="2.6" fill="#e8a0a8" opacity=".35" />, "bl2")}
        {face(41.5, ledRing(41.5, 28), "led")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M60 4 C77 4 86 16 85 29 C81 20 71 17 60 18 C48 19 40 23 37 32 C35 16 44 4 60 4 Z" fill={`url(#${id}-hair2)`} stroke="#9c7530" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M36 30 Q27 52 30 76 Q31 90 25 102 L38 102 Q46 84 44 62 Q43 44 47 33 Z" fill={`url(#${id}-hair2)`} stroke="#9c7530" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M69 29.5 Q75 26.4 80 30.5" fill="none" stroke="#a98134" strokeWidth="1.4" strokeLinecap="round" />
        <g className="ca-eye">
          <path d="M70.6 36 Q76 32.2 81 36 Q76 39.8 70.6 36 Z" fill="#f8f4ee" />
          <circle cx="76.2" cy="36" r="2.6" fill={`url(#${id}-iris)`} />
          <circle cx="76.2" cy="36" r="1.05" fill="#08101f" />
        </g>
        <path d="M74 50.5 Q77.4 49.2 80 51" fill="none" stroke="#d1868c" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
        <ellipse cx="66" cy="47" rx="4" ry="2.3" fill="#e8a0a8" opacity=".3" />
        {ledRing(45, 26)}
      </>,
      rear: <>
        <path d="M36 12 Q60 2 84 12 Q90 40 86 72 Q82 90 78 102 L42 102 Q38 90 34 72 Q30 40 36 12 Z" fill={`url(#${id}-hair2)`} stroke="#9c7530" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M50 20 Q60 48 55 100 M70 20 Q60 48 65 100" fill="none" stroke="#b8913f" strokeWidth=".9" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── KEEPER · AX domestic ──
       The one that raises somebody's child. A bob, a soft jaw, and the same
       ring on the temple that means it is not one. */
    keeper: {
      skull: "M60 8 C71 8 79 17 80 30 C81 42 77 52 71 60 C67 66 64 70 60 70 C56 70 53 66 49 60 C43 52 39 42 40 30 C41 17 49 8 60 8 Z",
      fill: "skin", line: "#c8ab9e", body: "sage", bodyLine: "#5b7260", neckFill: "skin",
      prof: { brow: 27, nose: 38, lip: 56, chin: 68 },
      shellArt: <>
        <path d="M60 4 C76 4 84 15 83 30 C79 22 70 18 60 18 C50 18 41 22 37 30 C36 15 44 4 60 4 Z" fill={`url(#${id}-hair)`} stroke="#1f2436" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M37 27 Q31 42 33 58 Q34 66 30 72 L42 72 Q46 62 45 50 Q44 38 46 30 Z" fill={`url(#${id}-hair)`} stroke="#1f2436" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M83 27 Q89 42 87 58 Q86 66 90 72 L78 72 Q74 62 75 50 Q76 38 74 30 Z" fill={`url(#${id}-hair)`} stroke="#1f2436" strokeWidth=".7" strokeLinejoin="round" />
      </>,
      art: <>
        {face(49, <path d="M42.6 29.6 Q49 26.4 55.6 29" fill="none" stroke="#4a4457" strokeWidth="1.4" strokeLinecap="round" />, "b1")}
        {face(71, <path d="M64.4 29 Q71 26.4 77.4 29.6" fill="none" stroke="#4a4457" strokeWidth="1.4" strokeLinecap="round" />, "b2")}
        {face(50, <g className="ca-eye">
          <path d="M43.4 36 Q50 31 56.6 36 Q50 41 43.4 36 Z" fill="#f7f2ec" />
          <circle cx="50" cy="36" r="3.9" fill={`url(#${id}-iris)`} />
          <circle cx="50" cy="36" r="1.6" fill="#08101f" />
          <circle cx="51.4" cy="34.6" r="1.25" fill="#fff" />
        </g>, "e1")}
        {face(70, <g className="ca-eye">
          <path d="M63.4 36 Q70 31 76.6 36 Q70 41 63.4 36 Z" fill="#f7f2ec" />
          <circle cx="70" cy="36" r="3.9" fill={`url(#${id}-iris)`} />
          <circle cx="70" cy="36" r="1.6" fill="#08101f" />
          <circle cx="71.4" cy="34.6" r="1.25" fill="#fff" />
        </g>, "e2")}
        {face(60, <path d="M60 38 L60 47 M57.2 48.4 Q60 50 62.8 48.4" fill="none" stroke="#b08f78" strokeWidth="1" strokeLinecap="round" />, "n")}
        {face(60, <path d="M54 56 Q57.2 53.8 60 55 Q62.8 53.8 66 56 Q62.8 59.4 60 59.4 Q57.2 59.4 54 56 Z" fill="#c9848a" opacity=".78" />, "m")}
        {face(41.5, ledRing(41.5, 29), "led")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M60 4 C77 4 85 16 84 29 C80 21 70 18 60 18 C49 19 41 23 38 32 C36 16 44 4 60 4 Z" fill={`url(#${id}-hair)`} stroke="#1f2436" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M37 29 Q31 44 33 60 Q34 68 30 74 L43 74 Q47 64 46 51 Q45 39 47 32 Z" fill={`url(#${id}-hair)`} stroke="#1f2436" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M69.4 29.6 Q75 26.6 80 30.4" fill="none" stroke="#4a4457" strokeWidth="1.3" strokeLinecap="round" />
        <g className="ca-eye">
          <path d="M71 36 Q76 32.6 80.6 36 Q76 39.4 71 36 Z" fill="#f7f2ec" />
          <circle cx="76.2" cy="36" r="2.4" fill={`url(#${id}-iris)`} />
          <circle cx="76.2" cy="36" r="1" fill="#08101f" />
        </g>
        <path d="M74 50.5 Q77.2 49.3 79.6 51" fill="none" stroke="#c9848a" strokeWidth="1.5" strokeLinecap="round" opacity=".85" />
        {ledRing(45, 27)}
      </>,
      rear: <>
        <path d="M37 12 Q60 3 83 12 Q87 36 84 58 Q82 68 79 74 L41 74 Q38 68 36 58 Q33 36 37 12 Z" fill={`url(#${id}-hair)`} stroke="#1f2436" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M50 20 Q60 42 54 72 M70 20 Q60 42 66 72" fill="none" stroke="#5b6489" strokeWidth=".9" opacity=".55" />
      </>,
      neck: null,
    },

    /* ── ENVOY · protocol unit ──
       Gold plate polished past the point of dignity, two wide photoreceptors
       that never quite stop staring, and a vocoder grille where a mouth would
       be. The face does not move; the eyes do all of it. */
    envoy: {
      skull: "M60 6 C74 6 83 16 83 30 C83 40 80 48 76 55 C72 63 66 70 60 70 C54 70 48 63 44 55 C40 48 37 40 37 30 C37 16 46 6 60 6 Z",
      fill: "gold", line: "#f6dc94", body: "gold", bodyLine: "#e0b855", hv: "26 -1 68 78",
      prof: { brow: 23, nose: 35, lip: 54, chin: 68 },
      shellArt: <>
        <path d="M60 6 C74 6 83 16 83 30 L76 30 C76 20 70 15 60 15 C50 15 44 20 44 30 L37 30 C37 16 46 6 60 6 Z" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M60 6 L60 15" stroke="#8a6215" strokeWidth=".9" opacity=".6" />
      </>,
      art: <>
        {face(60, <path d="M39 27 Q60 22 81 27 L79 44 Q60 50 41 44 Z" fill="#2a1c05" opacity=".55" />, "mask")}
        {face(48, <g>
          <circle cx="48" cy="35" r="9.4" fill="#160f04" />
          <circle cx="48" cy="35" r="7.6" fill={`url(#${id}-amber)`} className="ca-optic" />
          <circle cx="48" cy="35" r="3.2" fill="#3a2405" />
          <circle cx="45.6" cy="32.4" r="2.2" fill="#fff8dd" opacity=".9" />
        </g>, "e1")}
        {face(72, <g>
          <circle cx="72" cy="35" r="9.4" fill="#160f04" />
          <circle cx="72" cy="35" r="7.6" fill={`url(#${id}-amber)`} className="ca-optic" />
          <circle cx="72" cy="35" r="3.2" fill="#3a2405" />
          <circle cx="69.6" cy="32.4" r="2.2" fill="#fff8dd" opacity=".9" />
        </g>, "e2")}
        {face(60, <path d="M56 44 L64 44 L62 52 L58 52 Z" fill="#2a1c05" opacity=".7" />, "nose")}
        {face(60, <g>
          <path d="M50 55 L70 55 L68 64 L52 64 Z" fill="#1c1204" />
          {[54, 57.5, 61, 64.5].map((x, i) => <rect key={i} x={x} y="56.4" width="2.2" height="6" rx=".8" fill={`url(#${id}-gold)`} opacity=".9" />)}
        </g>, "grille")}
        {face(35, <ellipse cx="35" cy="36" rx="4.4" ry="7" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".7" />, "d1")}
        {face(85, <ellipse cx="85" cy="36" rx="4.4" ry="7" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".7" />, "d2")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M60 6 C77 6 85 17 84 30 L77 30 C77 20 70 16 60 16 C50 16 42 21 40 31 L36 30 C37 16 46 6 60 6 Z" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".7" strokeLinejoin="round" />
        <circle cx="74" cy="35" r="7.4" fill="#160f04" />
        <circle cx="74" cy="35" r="5.8" fill={`url(#${id}-amber)`} className="ca-optic" />
        <circle cx="72.4" cy="33" r="1.8" fill="#fff8dd" opacity=".9" />
        <path d="M64 55 L80 55 L78 63 L65 63 Z" fill="#1c1204" />
        <ellipse cx="52" cy="37" rx="5" ry="8" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".7" />
        <path d="M42 24 Q40 42 46 58" fill="none" stroke="#8a6215" strokeWidth=".9" opacity=".55" />
      </>,
      rear: <>
        <path d="M41 14 Q60 6 79 14 Q83 38 78 58 Q60 68 42 58 Q37 38 41 14 Z" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 10 L60 62 M44 28 Q60 22 76 28 M44 44 Q60 38 76 44" fill="none" stroke="#8a6215" strokeWidth="1" opacity=".55" />
        <ellipse cx="35" cy="36" rx="4.4" ry="7" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".7" />
        <ellipse cx="85" cy="36" rx="4.4" ry="7" fill={`url(#${id}-gold)`} stroke="#8a6215" strokeWidth=".7" />
      </>,
      neck: null,
    },

    /* ── TALON · industrial hunter ──
       No face at all: a machined cylinder with a sensor band round it and a
       pair of antennae. Nothing about it was designed to be read by a person,
       which is the whole effect. */
    talon: {
      skull: "M44 12 L76 12 C79 12 80 14 80 17 L80 62 C80 66 78 68 74 68 L46 68 C42 68 40 66 40 62 L40 17 C40 14 41 12 44 12 Z",
      fill: "plate", line: "#9fb0cc", body: "steelblu", bodyLine: "#5285b0", hv: "30 -2 60 78",
      prof: { brow: 20, nose: 34, lip: 52, chin: 66 },
      shellArt: <>
        <path d="M48 12 L48 5 M60 12 L60 3 M72 12 L72 5" stroke="#7f8ea8" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="60" cy="2.4" r="2.4" fill="#ff3b30" className="ca-optic" />
        <path d="M40 18 L80 18" stroke="#0b1120" strokeWidth="1.4" opacity=".6" />
      </>,
      art: <>
        {face(60, <>
          <path d="M39 28 L81 28 L81 42 L39 42 Z" fill="#080d18" />
          <path d="M40.5 30 L79.5 30 L79.5 40 L40.5 40 Z" fill={`url(#${id}-plate)`} opacity=".7" />
          {[48, 60, 72].map((x, i) => <g key={i}><circle cx={x} cy="35" r="4" fill="#2a0508" /><circle cx={x} cy="35" r="2.8" fill={`url(#${id}-red)`} className="ca-optic" /></g>)}
        </>, "band")}
        {face(60, <>
          <path d="M44 48 L76 48 L76 60 L44 60 Z" fill="#0d1422" stroke="#6d7d97" strokeWidth=".7" />
          {[50, 55, 60, 65, 70].map((x, i) => <rect key={i} x={x} y="50" width="2" height="8" rx=".7" fill="#7f8ea8" opacity=".8" />)}
        </>, "vent")}
        {face(44, <circle cx="44" cy="23" r="1.9" fill="#9fb0cc" />, "r1")}
        {face(76, <circle cx="76" cy="23" r="1.9" fill="#9fb0cc" />, "r2")}
        {face(60, <path d="M40 64 L80 64" stroke="#0b1120" strokeWidth="1.6" opacity=".6" />, "l")}
      </>,
      side: "M44 12 L76 12 C79 12 80 14 80 17 L80 62 C80 66 78 68 74 68 L46 68 C42 68 40 66 40 62 L40 17 C40 14 41 12 44 12 Z",
      sideArt: <>
        <path d="M48 12 L48 5 M60 12 L60 3 M72 12 L72 5" stroke="#7f8ea8" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="60" cy="2.4" r="2.4" fill="#ff3b30" className="ca-optic" />
        <path d="M39 28 L81 28 L81 42 L39 42 Z" fill="#080d18" />
        <circle cx="70" cy="35" r="4" fill="#2a0508" />
        <circle cx="70" cy="35" r="2.8" fill={`url(#${id}-red)`} className="ca-optic" />
        <circle cx="50" cy="35" r="3" fill="#2a0508" />
        <path d="M44 48 L76 48 L76 60 L44 60 Z" fill="#0d1422" stroke="#6d7d97" strokeWidth=".7" />
        <path d="M40 18 L80 18 M40 64 L80 64" stroke="#0b1120" strokeWidth="1.5" opacity=".6" />
      </>,
      rear: <>
        <path d="M40 14 L80 14 L80 66 L40 66 Z" fill={`url(#${id}-plate)`} stroke="#6d7d97" strokeWidth=".8" />
        <path d="M46 22 L74 22 M46 34 L74 34 M46 46 L74 46 M46 58 L74 58" stroke="#0b1120" strokeWidth="1.6" opacity=".55" />
        <path d="M48 14 L48 5 M60 14 L60 3 M72 14 L72 5" stroke="#7f8ea8" strokeWidth="2.2" strokeLinecap="round" />
      </>,
      neck: null,
    },

    /* ── SENTRY · line infantry ──
       Mass-produced and cheap about it: pressed tan plate, a long vocoder
       snout, and two eye slits set too high in the skull. */
    sentry: {
      skull: "M60 6 C70 6 76 13 77 24 C78 33 76 40 73 46 L70 62 C68 70 64 74 60 74 C56 74 52 70 50 62 L47 46 C44 40 42 33 43 24 C44 13 50 6 60 6 Z",
      fill: "tan", line: "#8f7748", body: "tan", bodyLine: "#a98f5e", hv: "34 0 52 80",
      prof: { brow: 20, nose: 34, lip: 56, chin: 72 },
      shellArt: <>
        <path d="M60 6 C70 6 76 13 77 24 L43 24 C44 13 50 6 60 6 Z" fill={`url(#${id}-tan)`} stroke="#7a6238" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M60 6 L60 22" stroke="#7a6238" strokeWidth=".9" opacity=".55" />
      </>,
      art: <>
        {face(52, <path d="M47 26 L57 25 L57 32 L48 32 Z" fill="#150f06" />, "e1")}
        {face(68, <path d="M73 26 L63 25 L63 32 L72 32 Z" fill="#150f06" />, "e2")}
        {face(52, <circle cx="52" cy="28.6" r="1.5" fill="#ff8a2a" className="ca-optic" />, "p1")}
        {face(68, <circle cx="68" cy="28.6" r="1.5" fill="#ff8a2a" className="ca-optic" />, "p2")}
        {face(60, <>
          <path d="M52 36 L68 36 L66 62 C65 68 62 70 60 70 C58 70 55 68 54 62 Z" fill={`url(#${id}-tan)`} stroke="#7a6238" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M55 42 L65 42 M55.6 48 L64.4 48 M56.4 54 L63.6 54" stroke="#3f331c" strokeWidth="1.4" opacity=".65" />
          <ellipse cx="60" cy="65" rx="3.2" ry="2.2" fill="#150f06" opacity=".8" />
        </>, "snout")}
        {face(44, <path d="M42 30 L47 32 L46 44 L41 40 Z" fill={`url(#${id}-tan)`} stroke="#7a6238" strokeWidth=".7" />, "c1")}
        {face(76, <path d="M78 30 L73 32 L74 44 L79 40 Z" fill={`url(#${id}-tan)`} stroke="#7a6238" strokeWidth=".7" />, "c2")}
      </>,
      side: "M58 6 C68 6 75 13 76 24 C77 33 75 40 72 46 L82 60 C84 66 80 72 74 70 L62 66 C56 64 52 58 51 50 L47 44 C44 38 42 32 43 24 C44 13 48 6 58 6 Z",
      sideArt: <>
        <path d="M58 6 C68 6 75 13 76 24 L44 24 C45 13 48 6 58 6 Z" fill={`url(#${id}-tan)`} stroke="#7a6238" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M64 26 L74 25 L74 32 L64 32 Z" fill="#150f06" />
        <circle cx="69" cy="28.6" r="1.6" fill="#ff8a2a" className="ca-optic" />
        <path d="M56 40 L68 44 L80 60 C82 65 78 69 73 67 L60 62 C55 60 53 52 54 46 Z" fill={`url(#${id}-tan)`} stroke="#7a6238" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 48 L72 56 M58 54 L69 62" stroke="#3f331c" strokeWidth="1.4" opacity=".6" />
        <path d="M46 30 Q44 42 50 52" fill="none" stroke="#7a6238" strokeWidth=".9" opacity=".5" />
      </>,
      rear: <>
        <path d="M44 14 Q60 6 76 14 Q80 36 76 54 Q60 64 44 54 Q40 36 44 14 Z" fill={`url(#${id}-tan)`} stroke="#7a6238" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 10 L60 58 M48 26 Q60 20 72 26 M48 42 Q60 36 72 42" fill="none" stroke="#7a6238" strokeWidth="1" opacity=".55" />
        <rect x="52" y="16" width="16" height="12" rx="3" fill="#3f331c" opacity=".5" />
      </>,
      neck: null,
    },

    /* ── PIP · astromech ──
       A dome, a radar eye, and a holoprojector. It talks in beeps and every
       panel on it opens onto a tool nobody expected it to have. */
    pip: {
      skull: "M60 8 C80 8 90 24 90 44 L90 62 C90 68 86 70 78 70 L42 70 C34 70 30 68 30 62 L30 44 C30 24 40 8 60 8 Z",
      fill: "white", line: "#c8d8ec", body: "cream", bodyLine: "#9b7f52", hv: "24 1 72 76",
      prof: { brow: 26, nose: 38, lip: 54, chin: 66 },
      shellArt: <>
        <path d="M60 8 C80 8 90 24 90 44 L82 44 C82 28 74 18 60 18 C46 18 38 28 38 44 L30 44 C30 24 40 8 60 8 Z" fill="#dfe9f7" stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 5 L60 11" stroke="#8fa6c8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="4" r="2.4" fill={glow} className="ca-optic" />
      </>,
      art: <>
        {face(48, <>
          <circle cx="48" cy="38" r="12" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1" />
          <circle cx="48" cy="38" r="8.4" fill="#0a1424" />
          <circle cx="48" cy="38" r="6" fill={`url(#${id}-visor)`} className="ca-optic" />
          <circle cx="45.6" cy="35.4" r="2.2" fill="#fff" opacity=".9" />
        </>, "eye")}
        {face(74, <>
          <circle cx="74" cy="32" r="5" fill="#dfe9f7" stroke={glow} strokeWidth=".9" />
          <circle cx="74" cy="32" r="2.2" fill={glow} className="ca-optic" />
        </>, "holo")}
        {face(72, <path d="M66 44 L82 44 L82 56 L66 56 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".8" />, "p1")}
        {face(48, <path d="M38 52 L58 52 L58 62 L38 62 Z" fill="#dfe9f7" stroke={glow} strokeWidth=".8" />, "p2")}
        {face(60, <path d="M32 46 Q60 42 88 46" fill="none" stroke={glow} strokeWidth="1" opacity=".6" />, "s")}
      </>,
      side: "M60 8 C80 8 90 24 90 44 L90 62 C90 68 86 70 78 70 L42 70 C34 70 30 68 30 62 L30 44 C30 24 40 8 60 8 Z",
      sideArt: <>
        <path d="M60 8 C80 8 90 24 90 44 L82 44 C82 28 74 18 60 18 C46 18 38 28 38 44 L30 44 C30 24 40 8 60 8 Z" fill="#dfe9f7" stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 5 L60 11" stroke="#8fa6c8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="76" cy="38" r="9.6" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1" />
        <circle cx="76" cy="38" r="6.4" fill="#0a1424" />
        <circle cx="76" cy="38" r="4.4" fill={`url(#${id}-visor)`} className="ca-optic" />
        <path d="M36 46 L60 46 L60 60 L36 60 Z" fill="#dfe9f7" stroke={glow} strokeWidth=".8" />
        <path d="M32 46 Q60 42 88 46" fill="none" stroke={glow} strokeWidth="1" opacity=".55" />
      </>,
      rear: <>
        <path d="M60 8 C80 8 90 24 90 44 L90 62 C90 68 86 70 78 70 L42 70 C34 70 30 68 30 62 L30 44 C30 24 40 8 60 8 Z" fill={`url(#${id}-white)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M32 46 Q60 42 88 46" fill="none" stroke={glow} strokeWidth="1" opacity=".6" />
        <path d="M44 20 L44 68 M60 14 L60 68 M76 20 L76 68" stroke={glow} strokeWidth=".9" opacity=".45" />
        <circle cx="60" cy="34" r="7" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".9" />
        <circle cx="60" cy="34" r="2.8" fill={glow} className="ca-optic" />
      </>,
      neck: null,
    },

    /* ── PEBBLE · rolling unit ──
       Nothing but a dome riding a ball, and somehow the most expressive thing
       in the roster: one big lens, one small one, and the aerial it cocks when
       it is listening. */
    pebble: {
      skull: "M60 12 C82 12 92 28 92 48 C92 62 80 70 60 70 C40 70 28 62 28 48 C28 28 38 12 60 12 Z",
      fill: "white", line: "#d0e0f2", bodyLine: "#8fa4bd", hv: "22 0 76 76",
      prof: { brow: 28, nose: 42, lip: 56, chin: 66 },
      shellArt: <>
        <path d="M60 12 C82 12 92 28 92 48 L84 48 C84 32 74 22 60 22 C46 22 36 32 36 48 L28 48 C28 28 38 12 60 12 Z" fill="#e9f1fb" stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M46 12 L44 5 M74 12 L78 5" stroke="#8fa6c8" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="43.6" cy="3.6" r="1.9" fill={glow} className="ca-optic" />
        <circle cx="78.4" cy="3.6" r="1.9" fill={glow} className="ca-optic" />
      </>,
      art: <>
        {face(52, <>
          <circle cx="52" cy="42" r="14" fill="#0d1a2c" />
          <circle cx="52" cy="42" r="11.4" fill={`url(#${id}-visor)`} className="ca-optic" />
          <circle cx="52" cy="42" r="5" fill="#08111f" />
          <circle cx="48" cy="37.6" r="3.4" fill="#fff" opacity=".92" />
          <circle cx="55.6" cy="47" r="1.6" fill="#fff" opacity=".65" />
        </>, "eye")}
        {face(76, <>
          <circle cx="76" cy="38" r="5.6" fill="#0d1a2c" />
          <circle cx="76" cy="38" r="3.8" fill={`url(#${id}-trim)`} />
          <circle cx="74.8" cy="36.6" r="1.4" fill="#fff" opacity=".8" />
        </>, "lens")}
        {face(60, <path d="M30 28 Q60 20 90 28" fill="none" stroke={`url(#${id}-trim)`} strokeWidth="4" opacity=".85" />, "band")}
        {face(38, <path d="M32 52 C36 60 44 64 52 64" fill="none" stroke={`url(#${id}-trim)`} strokeWidth="3.4" strokeLinecap="round" opacity=".8" />, "arc1")}
        {face(84, <path d="M88 52 C84 60 76 64 68 64" fill="none" stroke={`url(#${id}-trim)`} strokeWidth="3.4" strokeLinecap="round" opacity=".8" />, "arc2")}
      </>,
      side: "M60 12 C82 12 92 28 92 48 C92 62 80 70 60 70 C40 70 28 62 28 48 C28 28 38 12 60 12 Z",
      sideArt: <>
        <path d="M60 12 C82 12 92 28 92 48 L84 48 C84 32 74 22 60 22 C46 22 36 32 36 48 L28 48 C28 28 38 12 60 12 Z" fill="#e9f1fb" stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M56 12 L52 5" stroke="#8fa6c8" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="51.4" cy="3.6" r="1.9" fill={glow} className="ca-optic" />
        <circle cx="76" cy="42" r="11.4" fill="#0d1a2c" />
        <circle cx="76" cy="42" r="9" fill={`url(#${id}-visor)`} className="ca-optic" />
        <circle cx="72.6" cy="38.4" r="2.8" fill="#fff" opacity=".9" />
        <path d="M30 28 Q60 20 90 28" fill="none" stroke={`url(#${id}-trim)`} strokeWidth="4" opacity=".8" />
        <path d="M34 52 C38 60 46 64 54 64" fill="none" stroke={`url(#${id}-trim)`} strokeWidth="3.4" strokeLinecap="round" opacity=".75" />
      </>,
      rear: <>
        <path d="M60 12 C82 12 92 28 92 48 C92 62 80 70 60 70 C40 70 28 62 28 48 C28 28 38 12 60 12 Z" fill={`url(#${id}-white)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M30 28 Q60 20 90 28" fill="none" stroke={`url(#${id}-trim)`} strokeWidth="4" opacity=".8" />
        <circle cx="60" cy="46" r="10" fill="none" stroke={`url(#${id}-trim)`} strokeWidth="3" opacity=".8" />
        <circle cx="60" cy="46" r="3.4" fill={glow} className="ca-optic" />
        <path d="M46 12 L44 5 M74 12 L78 5" stroke="#8fa6c8" strokeWidth="1.8" strokeLinecap="round" />
      </>,
      neck: null,
    },
    /* ══ the soft intake ══════════════════════════════════════════════════
       Ten built to be held rather than feared. One recipe, run ten ways: a
       wide skull that is roundest at the CHEEK rather than the crown, eyes
       big enough to be most of the face, a blush, and one silhouette feature
       on top that says what it is from across a room. Nothing here comes to
       a point anywhere. */

    /* ── PUDDING · dessert-grade chassis ── a dome that has clearly settled */
    pudding: {
      skull: "M60 7 C86 7 96 24 96 44 C96 62 82 72 60 72 C38 72 24 62 24 44 C24 24 34 7 60 7 Z",
      fill: "cream", line: "#e8c99a", body: "cream", bodyLine: "#c8a570", hv: "18 -6 84 86",
      prof: { brow: 30, nose: 43, lip: 57, chin: 69 },
      shellArt: <>
        {/* the wobble line where the set surface meets the soft one */}
        <path d="M27 30 Q60 22 93 30" fill="none" stroke="#e0b87e" strokeWidth="1.4" opacity=".7" />
        <path d="M52 8 Q60 -2 68 8 Q60 3 52 8 Z" fill="#ffb9c8" stroke="#e08fa4" strokeWidth=".7" strokeLinejoin="round" />
      </>,
      art: <>
        {face(60, <path d="M50 20 Q60 12 70 20 Q60 17 50 20 Z" fill="#ffb9c8" stroke="#e08fa4" strokeWidth=".6" className="ca-optic" />, "cap")}
        {face(46, <g className="ca-eye">
          <ellipse cx="46" cy="44" rx="10" ry="11.6" fill="#241a12" />
          <ellipse cx="46" cy="44" rx="8.4" ry="9.9" fill={`url(#${id}-bigiris)`} />
          <circle cx="49" cy="40" r="3.6" fill="#fff" /><circle cx="43" cy="48" r="1.9" fill="#fff" opacity=".9" />
        </g>, "e1")}
        {face(74, <g className="ca-eye">
          <ellipse cx="74" cy="44" rx="10" ry="11.6" fill="#241a12" />
          <ellipse cx="74" cy="44" rx="8.4" ry="9.9" fill={`url(#${id}-bigiris)`} />
          <circle cx="77" cy="40" r="3.6" fill="#fff" /><circle cx="71" cy="48" r="1.9" fill="#fff" opacity=".9" />
        </g>, "e2")}
        {face(32, <ellipse cx="32" cy="54" rx="6.8" ry="4.4" fill="#ffa8bd" opacity=".8" />, "b1")}
        {face(88, <ellipse cx="88" cy="54" rx="6.8" ry="4.4" fill="#ffa8bd" opacity=".8" />, "b2")}
        {face(60, <path d="M55 60 Q60 65 65 60" fill="none" stroke="#b98055" strokeWidth="2.2" strokeLinecap="round" />, "m")}
      </>,
      side: "M60 7 C86 7 95 24 95 44 C95 60 85 70 72 72 Q60 74 50 70 C34 65 25 57 25 44 C25 24 35 7 60 7 Z",
      sideArt: <>
        <path d="M28 30 Q58 23 92 30" fill="none" stroke="#e0b87e" strokeWidth="1.3" opacity=".65" />
        <g className="ca-eye">
          <ellipse cx="76" cy="44" rx="8.6" ry="11" fill="#241a12" />
          <ellipse cx="76" cy="44" rx="7" ry="9.2" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.6" cy="40.4" r="3.1" fill="#fff" />
        </g>
        <ellipse cx="60" cy="55" rx="6.2" ry="4" fill="#ffa8bd" opacity=".75" />
        <path d="M77 60 Q82 64 85 59" fill="none" stroke="#b98055" strokeWidth="2" strokeLinecap="round" />
      </>,
      rear: <>
        <path d="M27 18 Q60 6 93 18 Q98 46 90 64 Q60 76 30 64 Q22 46 27 18 Z" fill={`url(#${id}-cream)`} stroke="#e0b87e" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M28 32 Q60 25 92 32" fill="none" stroke="#e0b87e" strokeWidth="1.3" opacity=".6" />
        <path d="M52 10 Q60 0 68 10 Q60 5 52 10 Z" fill="#ffb9c8" stroke="#e08fa4" strokeWidth=".7" strokeLinejoin="round" />
      </>,
      neck: null,
    },

    /* ── ACORN · seed-shell service unit ── a cap you could lift off */
    acorn: {
      skull: "M60 8 C84 8 94 26 94 45 C94 63 80 72 60 72 C40 72 26 63 26 45 C26 26 36 8 60 8 Z",
      fill: "sage", line: "#a8c9a0", body: "sage", bodyLine: "#6d9a70", hv: "20 -8 80 88",
      prof: { brow: 30, nose: 44, lip: 57, chin: 69 },
      shellArt: <>
        {/* the nut cap: a scalloped dome with a stalk out of the top of it */}
        <path d="M26 33 C26 16 40 4 60 4 C80 4 94 16 94 33 Q60 25 26 33 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M31 27 Q39 22 47 25 M53 22 Q60 19 67 22 M73 25 Q81 22 89 27" fill="none" stroke="#7c5a2e" strokeWidth="1.1" opacity=".65" />
        <path d="M58 5 L58 -6 Q60 -9 62 -6 L62 5 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".8" strokeLinejoin="round" />
      </>,
      art: <>
        {face(45, <g className="ca-eye">
          <ellipse cx="45" cy="47" rx="9.4" ry="10.8" fill="#16241a" />
          <ellipse cx="45" cy="47" rx="7.8" ry="9.1" fill={`url(#${id}-bigiris)`} />
          <circle cx="48" cy="43" r="3.3" fill="#fff" /><circle cx="42" cy="51" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e1")}
        {face(75, <g className="ca-eye">
          <ellipse cx="75" cy="47" rx="9.4" ry="10.8" fill="#16241a" />
          <ellipse cx="75" cy="47" rx="7.8" ry="9.1" fill={`url(#${id}-bigiris)`} />
          <circle cx="78" cy="43" r="3.3" fill="#fff" /><circle cx="72" cy="51" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e2")}
        {face(32, <ellipse cx="32" cy="56" rx="6.2" ry="4" fill="#ffb090" opacity=".7" />, "b1")}
        {face(88, <ellipse cx="88" cy="56" rx="6.2" ry="4" fill="#ffb090" opacity=".7" />, "b2")}
        {face(60, <path d="M56 61 Q60 65 64 61" fill="none" stroke="#5e7f58" strokeWidth="2" strokeLinecap="round" />, "m")}
      </>,
      side: "M60 8 C84 8 93 26 93 45 C93 61 84 70 71 72 Q60 74 50 70 C35 65 27 57 27 45 C27 26 37 8 60 8 Z",
      sideArt: <>
        <path d="M27 33 C27 16 41 4 60 4 C80 4 93 16 93 33 Q60 25 27 33 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M58 5 L58 -6 Q60 -9 62 -6 L62 5 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".8" />
        <g className="ca-eye">
          <ellipse cx="76" cy="47" rx="8" ry="10.2" fill="#16241a" />
          <ellipse cx="76" cy="47" rx="6.6" ry="8.6" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="43.6" r="2.9" fill="#fff" />
        </g>
        <ellipse cx="61" cy="57" rx="5.6" ry="3.6" fill="#ffb090" opacity=".65" />
      </>,
      rear: <>
        <path d="M28 20 Q60 8 92 20 Q97 48 89 65 Q60 76 31 65 Q23 48 28 20 Z" fill={`url(#${id}-sage)`} stroke="#7fa87c" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M27 33 C27 16 41 4 60 4 C80 4 93 16 93 33 Q60 25 27 33 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M58 5 L58 -6 Q60 -9 62 -6 L62 5 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".8" />
        <path d="M44 44 Q60 38 76 44" fill="none" stroke="#7fa87c" strokeWidth="1.1" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── COCOA · warm-shell companion ── two round ears and nothing sharp */
    cocoa: {
      skull: "M60 9 C85 9 95 26 95 45 C95 63 81 72 60 72 C39 72 25 63 25 45 C25 26 35 9 60 9 Z",
      fill: "brown", line: "#c9a07a", body: "bronze", bodyLine: "#8a6636", hv: "10 -4 100 84",
      prof: { brow: 31, nose: 44, lip: 58, chin: 69 },
      shellArt: <>
        <circle cx="24" cy="22" r="13" fill={`url(#${id}-brown)`} stroke="#a97f56" strokeWidth="1" />
        <circle cx="96" cy="22" r="13" fill={`url(#${id}-brown)`} stroke="#a97f56" strokeWidth="1" />
        <circle cx="24" cy="22" r="7" fill="#f0b9a0" opacity=".5" />
        <circle cx="96" cy="22" r="7" fill="#f0b9a0" opacity=".5" />
      </>,
      art: <>
        {face(45, <g className="ca-eye">
          <ellipse cx="45" cy="45" rx="9.6" ry="11" fill="#1d120c" />
          <ellipse cx="45" cy="45" rx="8" ry="9.3" fill={`url(#${id}-bigiris)`} />
          <circle cx="48" cy="41" r="3.4" fill="#fff" /><circle cx="42" cy="49" r="1.8" fill="#fff" opacity=".9" />
        </g>, "e1")}
        {face(75, <g className="ca-eye">
          <ellipse cx="75" cy="45" rx="9.6" ry="11" fill="#1d120c" />
          <ellipse cx="75" cy="45" rx="8" ry="9.3" fill={`url(#${id}-bigiris)`} />
          <circle cx="78" cy="41" r="3.4" fill="#fff" /><circle cx="72" cy="49" r="1.8" fill="#fff" opacity=".9" />
        </g>, "e2")}
        {face(60, <ellipse cx="60" cy="56" rx="7.5" ry="5.6" fill="#f6d3bb" />, "sn")}
        {face(60, <ellipse cx="60" cy="53" rx="3.2" ry="2.4" fill="#4a2c1c" />, "no")}
        {face(60, <path d="M54 59 Q60 64 66 59" fill="none" stroke="#7d4b30" strokeWidth="1.9" strokeLinecap="round" />, "m")}
        {face(33, <ellipse cx="33" cy="55" rx="6" ry="3.9" fill="#f09a86" opacity=".65" />, "b1")}
        {face(87, <ellipse cx="87" cy="55" rx="6" ry="3.9" fill="#f09a86" opacity=".65" />, "b2")}
      </>,
      side: "M60 9 C85 9 94 26 94 45 C94 61 84 70 71 72 Q60 74 50 70 C34 65 26 57 26 45 C26 26 36 9 60 9 Z",
      sideArt: <>
        <circle cx="44" cy="22" r="12" fill={`url(#${id}-brown)`} stroke="#a97f56" strokeWidth="1" />
        <circle cx="44" cy="22" r="6.4" fill="#f0b9a0" opacity=".45" />
        <g className="ca-eye">
          <ellipse cx="76" cy="45" rx="8.2" ry="10.4" fill="#1d120c" />
          <ellipse cx="76" cy="45" rx="6.8" ry="8.8" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.6" cy="41.4" r="3" fill="#fff" />
        </g>
        <ellipse cx="86" cy="55" rx="6.4" ry="4.8" fill="#f6d3bb" />
        <ellipse cx="88" cy="53" rx="2.6" ry="2" fill="#4a2c1c" />
      </>,
      rear: <>
        <path d="M27 20 Q60 8 93 20 Q98 48 90 65 Q60 76 30 65 Q22 48 27 20 Z" fill={`url(#${id}-brown)`} stroke="#a97f56" strokeWidth=".9" strokeLinejoin="round" />
        <circle cx="24" cy="22" r="13" fill={`url(#${id}-brown)`} stroke="#a97f56" strokeWidth="1" />
        <circle cx="96" cy="22" r="13" fill={`url(#${id}-brown)`} stroke="#a97f56" strokeWidth="1" />
        <path d="M46 42 Q60 36 74 42" fill="none" stroke="#a97f56" strokeWidth="1.1" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── BLOSSOM · petal-crowned herald ── the crown IS the silhouette */
    blossom: {
      skull: "M60 10 C83 10 93 27 93 46 C93 63 80 72 60 72 C40 72 27 63 27 46 C27 27 37 10 60 10 Z",
      fill: "plum", line: "#d6a8e0", body: "plum", bodyLine: "#9a63ad", hv: "8 -12 104 96",
      prof: { brow: 31, nose: 45, lip: 58, chin: 69 },
      shellArt: <>
        {[0, 72, 144, 216, 288].map(a => (
          <ellipse key={a} cx="60" cy="-6" rx="9" ry="15" fill="#ff9ec9" stroke="#dc6fa2" strokeWidth=".8"
            transform={`rotate(${a} 60 12)`} opacity=".95" />))}
        <circle cx="60" cy="12" r="6" fill="#ffe38a" stroke="#d8a83e" strokeWidth=".8" className="ca-optic" />
      </>,
      art: <>
        {face(46, <g className="ca-eye">
          <ellipse cx="46" cy="46" rx="9.2" ry="10.6" fill="#241832" />
          <ellipse cx="46" cy="46" rx="7.6" ry="9" fill={`url(#${id}-bigiris)`} />
          <circle cx="49" cy="42" r="3.2" fill="#fff" /><circle cx="43" cy="50" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e1")}
        {face(74, <g className="ca-eye">
          <ellipse cx="74" cy="46" rx="9.2" ry="10.6" fill="#241832" />
          <ellipse cx="74" cy="46" rx="7.6" ry="9" fill={`url(#${id}-bigiris)`} />
          <circle cx="77" cy="42" r="3.2" fill="#fff" /><circle cx="71" cy="50" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e2")}
        {face(33, <ellipse cx="33" cy="55" rx="6" ry="3.9" fill="#ff9ec9" opacity=".7" />, "b1")}
        {face(87, <ellipse cx="87" cy="55" rx="6" ry="3.9" fill="#ff9ec9" opacity=".7" />, "b2")}
        {face(60, <path d="M55 60 Q60 65 65 60" fill="none" stroke="#a15f8a" strokeWidth="2" strokeLinecap="round" />, "m")}
      </>,
      side: "M60 10 C83 10 92 27 92 46 C92 61 83 70 70 72 Q60 74 50 70 C35 65 28 57 28 46 C28 27 38 10 60 10 Z",
      sideArt: <>
        {[0, 72, 216, 288].map(a => (
          <ellipse key={a} cx="60" cy="-6" rx="8" ry="14" fill="#ff9ec9" stroke="#dc6fa2" strokeWidth=".8"
            transform={`rotate(${a} 60 12)`} opacity=".9" />))}
        <circle cx="60" cy="12" r="5.4" fill="#ffe38a" stroke="#d8a83e" strokeWidth=".8" />
        <g className="ca-eye">
          <ellipse cx="76" cy="46" rx="7.8" ry="10" fill="#241832" />
          <ellipse cx="76" cy="46" rx="6.4" ry="8.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="42.4" r="2.9" fill="#fff" />
        </g>
        <ellipse cx="62" cy="56" rx="5.4" ry="3.6" fill="#ff9ec9" opacity=".65" />
      </>,
      rear: <>
        <path d="M29 22 Q60 10 91 22 Q96 48 88 65 Q60 76 32 65 Q24 48 29 22 Z" fill={`url(#${id}-plum)`} stroke="#b57cc6" strokeWidth=".9" strokeLinejoin="round" />
        {[0, 72, 144, 216, 288].map(a => (
          <ellipse key={a} cx="60" cy="-6" rx="9" ry="15" fill="#ff9ec9" stroke="#dc6fa2" strokeWidth=".8"
            transform={`rotate(${a} 60 12)`} opacity=".9" />))}
        <path d="M46 44 Q60 38 74 44" fill="none" stroke="#b57cc6" strokeWidth="1.1" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── PENGU · cold-weather steward ── a beak, and a bib that is a shirt */
    pengu: {
      skull: "M60 8 C82 8 92 25 92 45 C92 64 79 72 60 72 C41 72 28 64 28 45 C28 25 38 8 60 8 Z",
      fill: "obsidian", line: "#8ba3bd", body: "obsidian", bodyLine: "#46566d", hv: "20 -6 80 86",
      prof: { brow: 30, nose: 46, lip: 58, chin: 69 },
      shellArt: <>
        <path d="M52 6 Q60 -3 68 6" fill="none" stroke="#8ba3bd" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="-4" r="3" fill="#ffd23f" className="ca-optic" />
      </>,
      art: <>
        {/* the white face-front: the single mark that makes it a penguin */}
        {face(60, <path d="M60 20 C76 20 84 34 84 48 C84 62 74 70 60 70 C46 70 36 62 36 48 C36 34 44 20 60 20 Z" fill={`url(#${id}-white)`} stroke="#c8d6e6" strokeWidth=".8" />, "bib")}
        {face(48, <g className="ca-eye">
          <ellipse cx="48" cy="42" rx="7.8" ry="9.4" fill="#101822" />
          <ellipse cx="48" cy="42" rx="6.4" ry="7.9" fill={`url(#${id}-bigiris)`} />
          <circle cx="50.4" cy="38.6" r="2.9" fill="#fff" />
        </g>, "e1")}
        {face(72, <g className="ca-eye">
          <ellipse cx="72" cy="42" rx="7.8" ry="9.4" fill="#101822" />
          <ellipse cx="72" cy="42" rx="6.4" ry="7.9" fill={`url(#${id}-bigiris)`} />
          <circle cx="74.4" cy="38.6" r="2.9" fill="#fff" />
        </g>, "e2")}
        {face(60, <path d="M52 54 L68 54 L60 66 Z" fill={`url(#${id}-amber)`} stroke="#c98a2a" strokeWidth=".8" strokeLinejoin="round" />, "beak")}
        {face(37, <ellipse cx="37" cy="53" rx="5.4" ry="3.4" fill="#ff9fb4" opacity=".55" />, "b1")}
        {face(83, <ellipse cx="83" cy="53" rx="5.4" ry="3.4" fill="#ff9fb4" opacity=".55" />, "b2")}
      </>,
      side: "M60 8 C82 8 91 25 91 45 C91 62 82 70 70 72 Q60 74 50 70 C36 65 29 57 29 45 C29 25 39 8 60 8 Z",
      sideArt: <>
        <path d="M52 6 Q60 -3 68 6" fill="none" stroke="#8ba3bd" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M70 22 C82 24 88 36 88 48 C88 62 78 70 66 71 Q58 66 58 48 C58 34 60 24 70 22 Z" fill={`url(#${id}-white)`} stroke="#c8d6e6" strokeWidth=".8" />
        <g className="ca-eye">
          <ellipse cx="74" cy="42" rx="7" ry="9" fill="#101822" />
          <ellipse cx="74" cy="42" rx="5.8" ry="7.6" fill={`url(#${id}-bigiris)`} />
          <circle cx="76.2" cy="38.8" r="2.6" fill="#fff" />
        </g>
        <path d="M80 52 L94 57 L79 64 Z" fill={`url(#${id}-amber)`} stroke="#c98a2a" strokeWidth=".8" strokeLinejoin="round" />
      </>,
      rear: <>
        <path d="M30 20 Q60 8 90 20 Q95 48 87 65 Q60 76 33 65 Q25 48 30 20 Z" fill={`url(#${id}-obsidian)`} stroke="#6b7f96" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M52 8 Q60 -1 68 8" fill="none" stroke="#8ba3bd" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M46 42 Q60 36 74 42" fill="none" stroke="#6b7f96" strokeWidth="1.1" opacity=".55" />
      </>,
      neck: null,
    },

    /* ── BUBBLY · sealed-dome diver ── a face behind glass, and it likes it */
    bubbly: {
      skull: "M60 8 C84 8 94 25 94 45 C94 64 80 72 60 72 C40 72 26 64 26 45 C26 25 36 8 60 8 Z",
      fill: "sky", line: "#9ed4ec", body: "sky", bodyLine: "#4a90b5", hv: "18 -8 84 88",
      prof: { brow: 30, nose: 44, lip: 57, chin: 69 },
      shellArt: <>
        {/* the air line, coiling off the crown */}
        <path d="M76 12 C90 6 96 -4 90 -12" fill="none" stroke="#7fbcd8" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="90" cy="-14" r="3.2" fill="#c8f0ff" stroke="#7fbcd8" strokeWidth=".8" />
        <circle cx="36" cy="20" r="4" fill="#ffffff" opacity=".5" />
        <circle cx="30" cy="30" r="2.4" fill="#ffffff" opacity=".35" />
      </>,
      art: <>
        {/* the dome glass sits over the whole face rather than around the eyes */}
        {face(60, <ellipse cx="60" cy="44" rx="27" ry="25" fill="#bfe9fb" opacity=".34" stroke="#a7dcf2" strokeWidth="1" />, "dome")}
        {face(47, <g className="ca-eye">
          <ellipse cx="47" cy="44" rx="9" ry="10.4" fill="#12222c" />
          <ellipse cx="47" cy="44" rx="7.4" ry="8.8" fill={`url(#${id}-bigiris)`} />
          <circle cx="50" cy="40" r="3.2" fill="#fff" /><circle cx="44" cy="48" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e1")}
        {face(73, <g className="ca-eye">
          <ellipse cx="73" cy="44" rx="9" ry="10.4" fill="#12222c" />
          <ellipse cx="73" cy="44" rx="7.4" ry="8.8" fill={`url(#${id}-bigiris)`} />
          <circle cx="76" cy="40" r="3.2" fill="#fff" /><circle cx="70" cy="48" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e2")}
        {face(60, <path d="M55 58 Q60 63 65 58" fill="none" stroke="#3f7f9c" strokeWidth="2" strokeLinecap="round" />, "m")}
        {face(45, <path d="M40 26 Q48 20 58 22" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".55" />, "gl")}
      </>,
      side: "M60 8 C84 8 93 25 93 45 C93 62 84 70 71 72 Q60 74 50 70 C35 65 27 57 27 45 C27 25 37 8 60 8 Z",
      sideArt: <>
        <path d="M74 12 C88 6 94 -4 88 -12" fill="none" stroke="#7fbcd8" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="66" cy="44" rx="25" ry="24" fill="#bfe9fb" opacity=".3" stroke="#a7dcf2" strokeWidth="1" />
        <g className="ca-eye">
          <ellipse cx="76" cy="44" rx="7.8" ry="9.8" fill="#12222c" />
          <ellipse cx="76" cy="44" rx="6.4" ry="8.2" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="40.6" r="2.9" fill="#fff" />
        </g>
        <path d="M46 26 Q54 20 62 22" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity=".5" />
      </>,
      rear: <>
        <path d="M28 20 Q60 8 92 20 Q97 48 89 65 Q60 76 31 65 Q23 48 28 20 Z" fill={`url(#${id}-sky)`} stroke="#7fbcd8" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M76 14 C90 8 96 -2 90 -10" fill="none" stroke="#7fbcd8" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="60" cy="42" r="9" fill="none" stroke="#7fbcd8" strokeWidth="1.4" opacity=".65" />
        <circle cx="60" cy="42" r="3.4" fill="#c8f0ff" opacity=".8" />
      </>,
      neck: null,
    },

    /* ── POPPY · single-antenna helper ── one bobble, and it never stops moving */
    poppy: {
      skull: "M60 9 C82 9 92 26 92 45 C92 63 79 72 60 72 C41 72 28 63 28 45 C28 26 38 9 60 9 Z",
      fill: "mint", line: "#a4e3c8", body: "mint", bodyLine: "#4fa383", hv: "20 -18 80 98",
      prof: { brow: 31, nose: 44, lip: 58, chin: 69 },
      shellArt: <>
        <path d="M60 8 C58 -2 66 -6 64 -16" fill="none" stroke="#7fd0ae" strokeWidth="2.8" strokeLinecap="round" />
        <circle cx="64" cy="-20" r="5.4" fill="#ffd23f" stroke="#d8a83e" strokeWidth=".9" className="ca-optic" />
        <circle cx="62" cy="-22" r="1.8" fill="#fff" opacity=".8" />
      </>,
      art: <>
        {face(46, <g className="ca-eye">
          <ellipse cx="46" cy="45" rx="9.4" ry="10.8" fill="#12251d" />
          <ellipse cx="46" cy="45" rx="7.8" ry="9.1" fill={`url(#${id}-bigiris)`} />
          <circle cx="49" cy="41" r="3.3" fill="#fff" /><circle cx="43" cy="49" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e1")}
        {face(74, <g className="ca-eye">
          <ellipse cx="74" cy="45" rx="9.4" ry="10.8" fill="#12251d" />
          <ellipse cx="74" cy="45" rx="7.8" ry="9.1" fill={`url(#${id}-bigiris)`} />
          <circle cx="77" cy="41" r="3.3" fill="#fff" /><circle cx="71" cy="49" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e2")}
        {face(60, <path d="M53 59 Q60 66 67 59" fill="none" stroke="#3f8b6c" strokeWidth="2.2" strokeLinecap="round" />, "m")}
        {face(33, <ellipse cx="33" cy="54" rx="6" ry="3.8" fill="#ffb3a0" opacity=".6" />, "b1")}
        {face(87, <ellipse cx="87" cy="54" rx="6" ry="3.8" fill="#ffb3a0" opacity=".6" />, "b2")}
      </>,
      side: "M60 9 C82 9 91 26 91 45 C91 61 82 70 70 72 Q60 74 50 70 C36 65 29 57 29 45 C29 26 39 9 60 9 Z",
      sideArt: <>
        <path d="M62 8 C60 -2 68 -6 66 -16" fill="none" stroke="#7fd0ae" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="66" cy="-20" r="5" fill="#ffd23f" stroke="#d8a83e" strokeWidth=".9" />
        <g className="ca-eye">
          <ellipse cx="76" cy="45" rx="8" ry="10.2" fill="#12251d" />
          <ellipse cx="76" cy="45" rx="6.6" ry="8.6" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="41.6" r="2.9" fill="#fff" />
        </g>
        <ellipse cx="62" cy="55" rx="5.4" ry="3.5" fill="#ffb3a0" opacity=".55" />
      </>,
      rear: <>
        <path d="M30 20 Q60 8 90 20 Q95 48 87 65 Q60 76 33 65 Q25 48 30 20 Z" fill={`url(#${id}-mint)`} stroke="#7fd0ae" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M60 10 C58 0 66 -4 64 -14" fill="none" stroke="#7fd0ae" strokeWidth="2.8" strokeLinecap="round" />
        <circle cx="64" cy="-18" r="5.4" fill="#ffd23f" stroke="#d8a83e" strokeWidth=".9" />
        <path d="M46 44 Q60 38 74 44" fill="none" stroke="#7fd0ae" strokeWidth="1.1" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── HONEY · hive-keeper ── stripes, and a pair of feelers that lead */
    honey: {
      skull: "M60 9 C83 9 93 26 93 45 C93 63 80 72 60 72 C40 72 27 63 27 45 C27 26 37 9 60 9 Z",
      fill: "amber", line: "#e8bf6a", body: "amber", bodyLine: "#b8862c", hv: "16 -16 88 96",
      prof: { brow: 31, nose: 44, lip: 58, chin: 69 },
      shellArt: <>
        {[-1, 1].map(k => (
          <g key={k}>
            <path d={`M${60 + k * 10} 10 C${60 + k * 18} -2 ${60 + k * 26} -6 ${60 + k * 30} -14`} fill="none" stroke="#8a6320" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx={60 + k * 31} cy={-17} r="3.6" fill="#3a2a08" />
          </g>))}
      </>,
      art: <>
        {/* the stripes are the costume: three bands across the whole face */}
        {face(60, <>
          <path d="M30 30 Q60 24 90 30 L90 37 Q60 31 30 37 Z" fill="#3a2a08" opacity=".72" />
          <path d="M28 52 Q60 46 92 52 L92 59 Q60 53 28 59 Z" fill="#3a2a08" opacity=".72" />
        </>, "stripe")}
        {face(46, <g className="ca-eye">
          <ellipse cx="46" cy="44" rx="9.2" ry="10.6" fill="#2a1c04" />
          <ellipse cx="46" cy="44" rx="7.6" ry="9" fill={`url(#${id}-bigiris)`} />
          <circle cx="49" cy="40" r="3.2" fill="#fff" /><circle cx="43" cy="48" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e1")}
        {face(74, <g className="ca-eye">
          <ellipse cx="74" cy="44" rx="9.2" ry="10.6" fill="#2a1c04" />
          <ellipse cx="74" cy="44" rx="7.6" ry="9" fill={`url(#${id}-bigiris)`} />
          <circle cx="77" cy="40" r="3.2" fill="#fff" /><circle cx="71" cy="48" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e2")}
        {face(60, <path d="M55 63 Q60 68 65 63" fill="none" stroke="#8a6320" strokeWidth="2" strokeLinecap="round" />, "m")}
      </>,
      side: "M60 9 C83 9 92 26 92 45 C92 61 83 70 71 72 Q60 74 50 70 C35 65 28 57 28 45 C28 26 38 9 60 9 Z",
      sideArt: <>
        <path d="M68 10 C76 -2 84 -6 88 -14" fill="none" stroke="#8a6320" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="89" cy="-17" r="3.6" fill="#3a2a08" />
        <path d="M30 30 Q60 24 90 30 L90 37 Q60 31 30 37 Z" fill="#3a2a08" opacity=".68" />
        <path d="M28 52 Q60 46 92 52 L92 59 Q60 53 28 59 Z" fill="#3a2a08" opacity=".68" />
        <g className="ca-eye">
          <ellipse cx="76" cy="44" rx="7.8" ry="10" fill="#2a1c04" />
          <ellipse cx="76" cy="44" rx="6.4" ry="8.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="40.6" r="2.9" fill="#fff" />
        </g>
      </>,
      rear: <>
        <path d="M29 20 Q60 8 91 20 Q96 48 88 65 Q60 76 32 65 Q24 48 29 20 Z" fill={`url(#${id}-amber)`} stroke="#c9982e" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M30 32 Q60 26 90 32 L90 39 Q60 33 30 39 Z" fill="#3a2a08" opacity=".7" />
        <path d="M29 52 Q60 46 91 52 L91 59 Q60 53 29 59 Z" fill="#3a2a08" opacity=".7" />
        {[-1, 1].map(k => (
          <path key={k} d={`M${60 + k * 10} 12 C${60 + k * 18} 0 ${60 + k * 26} -4 ${60 + k * 30} -12`} fill="none" stroke="#8a6320" strokeWidth="2.4" strokeLinecap="round" />))}
      </>,
      neck: null,
    },

    /* ── SNOWBUN · quiet courier ── the ears are half the height of the model */
    snowbun: {
      skull: "M60 12 C81 12 90 28 90 46 C90 64 78 72 60 72 C42 72 30 64 30 46 C30 28 39 12 60 12 Z",
      fill: "white", line: "#cfe0ef", body: "pearl", bodyLine: "#9fb2c8", hv: "18 -34 84 114",
      prof: { brow: 32, nose: 45, lip: 58, chin: 69 },
      shellArt: <>
        {[-1, 1].map(k => (
          <g key={k}>
            <path d={`M${60 + k * 12} 16 C${60 + k * 6} -6 ${60 + k * 14} -30 ${60 + k * 26} -30 C${60 + k * 34} -12 ${60 + k * 30} 4 ${60 + k * 24} 16 Z`}
              fill={`url(#${id}-white)`} stroke="#cfe0ef" strokeWidth="1" strokeLinejoin="round" />
            <path d={`M${60 + k * 15} 12 C${60 + k * 11} -4 ${60 + k * 17} -22 ${60 + k * 24} -23 C${60 + k * 28} -10 ${60 + k * 26} 2 ${60 + k * 22} 12 Z`}
              fill="#ffc4d4" opacity=".55" />
          </g>))}
      </>,
      art: <>
        {face(47, <g className="ca-eye">
          <ellipse cx="47" cy="45" rx="8.6" ry="10.2" fill="#1d2430" />
          <ellipse cx="47" cy="45" rx="7.1" ry="8.6" fill={`url(#${id}-bigiris)`} />
          <circle cx="49.8" cy="41.4" r="3.1" fill="#fff" /><circle cx="44.4" cy="49" r="1.6" fill="#fff" opacity=".85" />
        </g>, "e1")}
        {face(73, <g className="ca-eye">
          <ellipse cx="73" cy="45" rx="8.6" ry="10.2" fill="#1d2430" />
          <ellipse cx="73" cy="45" rx="7.1" ry="8.6" fill={`url(#${id}-bigiris)`} />
          <circle cx="75.8" cy="41.4" r="3.1" fill="#fff" /><circle cx="70.4" cy="49" r="1.6" fill="#fff" opacity=".85" />
        </g>, "e2")}
        {face(60, <path d="M56 56 L64 56 L60 61 Z" fill="#ffa8bd" stroke="#e08fa4" strokeWidth=".6" strokeLinejoin="round" />, "no")}
        {face(60, <path d="M54 64 Q60 68 66 64" fill="none" stroke="#8fa2b8" strokeWidth="1.8" strokeLinecap="round" />, "m")}
        {face(35, <ellipse cx="35" cy="55" rx="5.6" ry="3.6" fill="#ffb0c4" opacity=".55" />, "b1")}
        {face(85, <ellipse cx="85" cy="55" rx="5.6" ry="3.6" fill="#ffb0c4" opacity=".55" />, "b2")}
      </>,
      side: "M60 12 C81 12 89 28 89 46 C89 62 81 70 70 72 Q60 74 51 70 C38 66 31 57 31 46 C31 28 40 12 60 12 Z",
      sideArt: <>
        <path d="M72 16 C66 -6 74 -30 86 -30 C94 -12 90 4 84 16 Z" fill={`url(#${id}-white)`} stroke="#cfe0ef" strokeWidth="1" strokeLinejoin="round" />
        <path d="M75 12 C71 -4 77 -22 84 -23 C88 -10 86 2 82 12 Z" fill="#ffc4d4" opacity=".5" />
        <g className="ca-eye">
          <ellipse cx="76" cy="45" rx="7.4" ry="9.6" fill="#1d2430" />
          <ellipse cx="76" cy="45" rx="6.1" ry="8.1" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="41.6" r="2.8" fill="#fff" />
        </g>
        <path d="M84 55 L90 56 L86 60 Z" fill="#ffa8bd" stroke="#e08fa4" strokeWidth=".6" strokeLinejoin="round" />
      </>,
      rear: <>
        <path d="M32 22 Q60 11 88 22 Q93 48 86 65 Q60 76 34 65 Q27 48 32 22 Z" fill={`url(#${id}-white)`} stroke="#cfe0ef" strokeWidth=".9" strokeLinejoin="round" />
        {[-1, 1].map(k => (
          <path key={k} d={`M${60 + k * 12} 18 C${60 + k * 6} -4 ${60 + k * 14} -28 ${60 + k * 26} -28 C${60 + k * 34} -10 ${60 + k * 30} 6 ${60 + k * 24} 18 Z`}
            fill={`url(#${id}-white)`} stroke="#cfe0ef" strokeWidth="1" strokeLinejoin="round" />))}
        <circle cx="60" cy="46" r="7" fill="#e8f2fb" stroke="#cfe0ef" strokeWidth=".9" />
      </>,
      neck: null,
    },

    /* ── PLUSHY · stitched companion ── seams, a button eye, and a patch */
    plushy: {
      skull: "M60 8 C85 8 96 25 96 45 C96 64 82 72 60 72 C38 72 24 64 24 45 C24 25 35 8 60 8 Z",
      fill: "ivory", line: "#d8c8b0", body: "ivory", bodyLine: "#b09c80", hv: "14 -8 92 88",
      prof: { brow: 30, nose: 44, lip: 58, chin: 69 },
      shellArt: <>
        {/* the seam that runs over the crown, with real stitches on it */}
        <path d="M60 6 L60 72" stroke="#b09c80" strokeWidth="1" opacity=".55" strokeDasharray="3 3" />
        <path d="M24 45 L96 45" stroke="#b09c80" strokeWidth="1" opacity=".35" strokeDasharray="3 3" />
        <path d="M40 12 Q48 4 56 10" fill="none" stroke="#b09c80" strokeWidth="1.1" opacity=".5" strokeDasharray="2.5 3" />
      </>,
      art: <>
        {/* one button and one embroidered X — a plush that has been repaired */}
        {face(46, <g className="ca-eye">
          <circle cx="46" cy="44" r="10" fill="#3a2c1e" />
          <circle cx="46" cy="44" r="8.2" fill={`url(#${id}-bigiris)`} />
          <circle cx="49" cy="40.4" r="3.4" fill="#fff" />
          <circle cx="43.4" cy="48" r="1.7" fill="#fff" opacity=".85" />
        </g>, "e1")}
        {face(74, <g className="ca-eye">
          <circle cx="74" cy="44" r="9.6" fill="#efe2cd" stroke="#b09c80" strokeWidth="1.1" />
          <path d="M69.4 39.4 L78.6 48.6 M78.6 39.4 L69.4 48.6" stroke="#8b7658" strokeWidth="2.2" strokeLinecap="round" />
        </g>, "e2")}
        {face(60, <path d="M53 58 Q60 64 67 58" fill="none" stroke="#8b7658" strokeWidth="2.2" strokeLinecap="round" />, "m")}
        {face(32, <ellipse cx="32" cy="54" rx="6.4" ry="4.2" fill="#f0a894" opacity=".6" />, "b1")}
        {face(88, <ellipse cx="88" cy="54" rx="6.4" ry="4.2" fill="#f0a894" opacity=".6" />, "b2")}
        {face(84, <g>
          <path d="M76 24 L94 22 L96 34 L78 36 Z" fill="#d8c0a0" stroke="#b09c80" strokeWidth=".9" strokeLinejoin="round" opacity=".9" />
          <path d="M76 27 L96 25 M77 32 L96 30" stroke="#8b7658" strokeWidth=".8" opacity=".5" strokeDasharray="2 2.5" />
        </g>, "patch")}
      </>,
      side: "M60 8 C85 8 95 25 95 45 C95 62 85 70 72 72 Q60 74 50 70 C34 65 25 57 25 45 C25 25 36 8 60 8 Z",
      sideArt: <>
        <path d="M60 6 Q66 38 62 72" fill="none" stroke="#b09c80" strokeWidth="1" opacity=".5" strokeDasharray="3 3" />
        <g className="ca-eye">
          <circle cx="76" cy="44" r="9.2" fill="#3a2c1e" />
          <circle cx="76" cy="44" r="7.6" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.6" cy="40.6" r="3.1" fill="#fff" />
        </g>
        <path d="M78 58 Q84 63 88 57" fill="none" stroke="#8b7658" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="62" cy="55" rx="5.8" ry="3.8" fill="#f0a894" opacity=".55" />
      </>,
      rear: <>
        <path d="M26 20 Q60 8 94 20 Q99 48 91 65 Q60 76 29 65 Q21 48 26 20 Z" fill={`url(#${id}-ivory)`} stroke="#c8b498" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M60 10 L60 72" stroke="#b09c80" strokeWidth="1" opacity=".5" strokeDasharray="3 3" />
        <path d="M32 40 Q60 34 88 40" fill="none" stroke="#b09c80" strokeWidth="1" opacity=".45" strokeDasharray="3 3" />
        <path d="M44 22 L62 20 L64 32 L46 34 Z" fill="#d8c0a0" stroke="#b09c80" strokeWidth=".9" strokeLinejoin="round" opacity=".85" />
      </>,
      neck: null,
    },

    /* ══ the hard intake ══════════════════════════════════════════════════
       Ten built to be read across a room and not argued with. The recipe is
       the soft one run backwards: a narrow skull that is widest at the BROW,
       optics reduced to a slit or a band, hard vents, and one crest or blade
       in the silhouette. Nothing here has a cheek. */

    /* ── WRAITH · hollow-frame infiltrator ── a helmet with nobody in it */
    wraith: {
      skull: "M60 6 L84 18 L86 44 L74 66 L60 72 L46 66 L34 44 L36 18 Z",
      fill: "obsidian", line: "#7f8ba0", body: "obsidian", bodyLine: "#3d4a5e", hv: "28 -2 64 80",
      prof: { brow: 22, nose: 38, lip: 54, chin: 68 },
      shellArt: <>
        <path d="M60 6 L60 -8 M52 9 L48 -2 M68 9 L72 -2" stroke="#5f6c82" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M36 18 L84 18" stroke="#0a0f1a" strokeWidth="1.6" opacity=".7" />
      </>,
      art: <>
        {face(60, <>
          {/* the hollow: a socket with nothing behind it but one cold line */}
          <path d="M38 26 L82 26 L78 44 L42 44 Z" fill="#04070e" />
          <path d="M42 33 L78 33" stroke={`url(#${id}-iris)`} strokeWidth="3.4" className="ca-optic" />
          <path d="M42 33 L78 33" stroke="#ffffff" strokeWidth="1" opacity=".7" />
        </>, "hollow")}
        {face(60, <path d="M46 52 L74 52 L70 62 L50 62 Z" fill="#0b1220" stroke="#5f6c82" strokeWidth=".7" />, "jaw")}
        {face(60, <>{[52, 60, 68].map(x => <rect key={x} x={x - 1} y="53" width="2" height="8" rx=".6" fill="#5f6c82" opacity=".7" />)}</>, "bars")}
      </>,
      side: "M60 6 L84 18 L86 44 L74 66 L60 72 L46 66 L34 44 L36 18 Z",
      sideArt: <>
        <path d="M60 6 L60 -8 M68 9 L72 -2" stroke="#5f6c82" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M38 26 L82 26 L78 44 L42 44 Z" fill="#04070e" />
        <path d="M56 33 L78 33" stroke={`url(#${id}-iris)`} strokeWidth="3.4" className="ca-optic" />
        <path d="M46 52 L74 52 L70 62 L50 62 Z" fill="#0b1220" stroke="#5f6c82" strokeWidth=".7" />
        <path d="M36 18 L86 18" stroke="#0a0f1a" strokeWidth="1.5" opacity=".65" />
      </>,
      rear: <>
        <path d="M36 14 L84 14 L86 46 L74 68 L46 68 L34 46 Z" fill={`url(#${id}-obsidian)`} stroke="#5f6c82" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M44 24 L76 24 M44 36 L76 36 M46 48 L74 48" stroke="#0a0f1a" strokeWidth="1.6" opacity=".6" />
        <path d="M60 14 L60 -6" stroke="#5f6c82" strokeWidth="1.8" strokeLinecap="round" />
      </>,
      neck: null,
    },

    /* ── MAGNUS · siege frame ── a brow you could park a truck on */
    magnus: {
      skull: "M40 10 L80 10 C86 10 88 14 88 20 L88 30 L84 34 L84 58 C84 66 78 70 70 70 L50 70 C42 70 36 66 36 58 L36 34 L32 30 L32 20 C32 14 34 10 40 10 Z",
      fill: "graphite", line: "#8b98ad", body: "graphite", bodyLine: "#4a5668", hv: "26 0 68 78",
      prof: { brow: 24, nose: 40, lip: 55, chin: 68 },
      shellArt: <>
        <path d="M32 20 L88 20" stroke="#0b1120" strokeWidth="2" opacity=".65" />
        <path d="M36 6 L52 6 L52 10 L36 10 Z M68 6 L84 6 L84 10 L68 10 Z" fill="#6d7b90" stroke="#4a5668" strokeWidth=".7" />
        {[44, 60, 76].map(x => <circle key={x} cx={x} cy="15" r="2.2" fill="#4a5668" />)}
      </>,
      art: <>
        {face(60, <path d="M30 28 L90 28 L88 38 L32 38 Z" fill="#05090f" />, "shade")}
        {face(48, <g className="ca-eye"><rect x="40" y="30" width="16" height="6" rx="2" fill="#1a0508" /><rect x="41.5" y="31.4" width="13" height="3.2" rx="1.4" fill={`url(#${id}-red)`} className="ca-optic" /></g>, "e1")}
        {face(72, <g className="ca-eye"><rect x="64" y="30" width="16" height="6" rx="2" fill="#1a0508" /><rect x="65.5" y="31.4" width="13" height="3.2" rx="1.4" fill={`url(#${id}-red)`} className="ca-optic" /></g>, "e2")}
        {face(60, <>
          <path d="M42 46 L78 46 L76 64 L44 64 Z" fill="#0d1422" stroke="#6d7b90" strokeWidth=".8" />
          {[48, 54, 60, 66, 72].map(x => <rect key={x} x={x - 1.4} y="48" width="2.8" height="14" rx="1" fill="#6d7b90" opacity=".75" />)}
        </>, "grille")}
      </>,
      side: "M40 10 L80 10 C86 10 88 14 88 20 L88 30 L84 34 L84 58 C84 66 78 70 70 70 L50 70 C42 70 36 66 36 58 L36 34 L32 30 L32 20 C32 14 34 10 40 10 Z",
      sideArt: <>
        <path d="M32 20 L88 20" stroke="#0b1120" strokeWidth="2" opacity=".6" />
        <path d="M68 6 L84 6 L84 10 L68 10 Z" fill="#6d7b90" stroke="#4a5668" strokeWidth=".7" />
        <path d="M30 28 L90 28 L88 38 L32 38 Z" fill="#05090f" />
        <rect x="66" y="30" width="16" height="6" rx="2" fill="#1a0508" />
        <rect x="67.5" y="31.4" width="13" height="3.2" rx="1.4" fill={`url(#${id}-red)`} className="ca-optic" />
        <path d="M50 46 L82 46 L80 64 L52 64 Z" fill="#0d1422" stroke="#6d7b90" strokeWidth=".8" />
      </>,
      rear: <>
        <path d="M34 12 L86 12 L86 58 C86 66 80 70 70 70 L50 70 C40 70 34 66 34 58 Z" fill={`url(#${id}-graphite)`} stroke="#6d7b90" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M40 22 L80 22 M40 34 L80 34 M40 46 L80 46 M42 58 L78 58" stroke="#0b1120" strokeWidth="1.8" opacity=".55" />
        {[44, 60, 76].map(x => <circle key={x} cx={x} cy="17" r="2.2" fill="#4a5668" />)}
      </>,
      neck: null,
    },

    /* ── SABER · duelling frame ── a blade crest straight down the centreline */
    saber: {
      skull: "M60 4 L78 20 L80 46 L70 66 L60 72 L50 66 L40 46 L42 20 Z",
      fill: "slateb", line: "#9fb6d0", body: "slateb", bodyLine: "#4b6c8e", hv: "26 -16 68 94",
      prof: { brow: 22, nose: 38, lip: 54, chin: 68 },
      shellArt: <>
        {/* the crest: a fin that rises above the crown and tapers back */}
        <path d="M60 4 L64 -22 L60 -30 L56 -22 Z" fill={`url(#${id}-chrome)`} stroke="#8fa8c4" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M60 -26 L60 2" stroke="#5ce1ff" strokeWidth="1.4" opacity=".8" className="ca-optic" />
        <path d="M46 14 L38 4 M74 14 L82 4" stroke="#8fa8c4" strokeWidth="2" strokeLinecap="round" />
      </>,
      art: <>
        {face(60, <path d="M42 26 L78 26 L74 40 L46 40 Z" fill="#05090f" />, "sh")}
        {face(50, <g className="ca-eye">
          <path d="M44 30 L58 28 L57 36 L44 35 Z" fill="#04121a" />
          <path d="M45.4 31.4 L56.4 29.8 L55.6 34.4 L45.4 33.6 Z" fill={`url(#${id}-iris)`} className="ca-optic" />
        </g>, "e1")}
        {face(70, <g className="ca-eye">
          <path d="M76 30 L62 28 L63 36 L76 35 Z" fill="#04121a" />
          <path d="M74.6 31.4 L63.6 29.8 L64.4 34.4 L74.6 33.6 Z" fill={`url(#${id}-iris)`} className="ca-optic" />
        </g>, "e2")}
        {face(60, <path d="M50 48 L70 48 L66 62 L54 62 Z" fill="#0d1422" stroke="#7f97b4" strokeWidth=".7" />, "jaw")}
        {face(60, <path d="M53 52 L67 52 M54 57 L66 57" stroke="#7f97b4" strokeWidth="1.3" opacity=".7" />, "v")}
      </>,
      side: "M60 4 L78 20 L80 46 L70 66 L60 72 L50 66 L40 46 L42 20 Z",
      sideArt: <>
        <path d="M60 4 L64 -22 L60 -30 L56 -22 Z" fill={`url(#${id}-chrome)`} stroke="#8fa8c4" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M74 14 L82 4" stroke="#8fa8c4" strokeWidth="2" strokeLinecap="round" />
        <path d="M42 26 L78 26 L74 40 L46 40 Z" fill="#05090f" />
        <path d="M76 30 L62 28 L63 36 L76 35 Z" fill="#04121a" />
        <path d="M74.6 31.4 L63.6 29.8 L64.4 34.4 L74.6 33.6 Z" fill={`url(#${id}-iris)`} className="ca-optic" />
        <path d="M54 48 L74 48 L70 62 L58 62 Z" fill="#0d1422" stroke="#7f97b4" strokeWidth=".7" />
      </>,
      rear: <>
        <path d="M42 16 L78 16 L80 46 L70 68 L50 68 L40 46 Z" fill={`url(#${id}-slateb)`} stroke="#7f97b4" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M60 16 L64 -20 L60 -28 L56 -20 Z" fill={`url(#${id}-chrome)`} stroke="#8fa8c4" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M48 28 L72 28 M46 40 L74 40 M50 52 L70 52" stroke="#0b1120" strokeWidth="1.6" opacity=".55" />
      </>,
      neck: null,
    },

    /* ── ORACLE · sensor cluster ── seven optics, and none of them blink */
    oracle: {
      skull: "M60 6 C80 6 90 22 90 44 C90 62 78 70 60 70 C42 70 30 62 30 44 C30 22 40 6 60 6 Z",
      fill: "pearl", line: "#c4d2e2", body: "pearl", bodyLine: "#8fa2b8", hv: "24 -4 72 80",
      prof: { brow: 26, nose: 40, lip: 55, chin: 68 },
      shellArt: <>
        <path d="M30 34 C30 18 43 6 60 6 C77 6 90 18 90 34 Q60 26 30 34 Z" fill={`url(#${id}-chrome)`} stroke="#a8bccf" strokeWidth=".9" strokeLinejoin="round" opacity=".9" />
        <circle cx="60" cy="2" r="3" fill="#7fe8ff" className="ca-optic" />
        <path d="M60 5 L60 -6" stroke="#a8bccf" strokeWidth="1.6" strokeLinecap="round" />
      </>,
      art: <>
        {/* a ring of small lenses around one big one — a face made of looking */}
        {face(60, <circle cx="60" cy="44" r="11" fill="#071018" stroke="#8fa2b8" strokeWidth=".9" />, "main")}
        {face(60, <circle cx="60" cy="44" r="7.4" fill={`url(#${id}-iris)`} className="ca-optic" />, "iris")}
        {face(60, <circle cx="57" cy="41" r="2.6" fill="#fff" opacity=".8" />, "gl")}
        {[[42, 38], [46, 52], [60, 60], [74, 52], [78, 38]].map(([x, y], i) => (
          face(x, <g key={i}>
            <circle cx={x} cy={y} r="4.2" fill="#071018" stroke="#8fa2b8" strokeWidth=".7" />
            <circle cx={x} cy={y} r="2.6" fill={`url(#${id}-iris)`} opacity=".9" className="ca-optic" />
          </g>, "o" + i)))}
      </>,
      side: "M60 6 C80 6 89 22 89 44 C89 60 80 68 70 70 Q60 72 51 69 C38 65 31 56 31 44 C31 22 40 6 60 6 Z",
      sideArt: <>
        <path d="M31 34 C31 18 44 6 60 6 C77 6 89 18 89 34 Q60 26 31 34 Z" fill={`url(#${id}-chrome)`} stroke="#a8bccf" strokeWidth=".9" strokeLinejoin="round" opacity=".9" />
        <circle cx="60" cy="2" r="3" fill="#7fe8ff" className="ca-optic" />
        <circle cx="74" cy="44" r="10" fill="#071018" stroke="#8fa2b8" strokeWidth=".9" />
        <circle cx="74" cy="44" r="6.8" fill={`url(#${id}-iris)`} className="ca-optic" />
        <circle cx="71.4" cy="41.2" r="2.4" fill="#fff" opacity=".75" />
        {[[58, 54], [56, 38]].map(([x, y], i) => (
          <g key={i}><circle cx={x} cy={y} r="3.8" fill="#071018" stroke="#8fa2b8" strokeWidth=".7" />
            <circle cx={x} cy={y} r="2.3" fill={`url(#${id}-iris)`} opacity=".85" /></g>))}
      </>,
      rear: <>
        <path d="M32 18 Q60 6 88 18 Q93 46 85 64 Q60 74 35 64 Q27 46 32 18 Z" fill={`url(#${id}-pearl)`} stroke="#a8bccf" strokeWidth=".9" strokeLinejoin="round" />
        <circle cx="60" cy="42" r="10" fill="none" stroke="#a8bccf" strokeWidth="1.4" opacity=".7" />
        <circle cx="60" cy="42" r="4" fill="#7fe8ff" opacity=".55" />
        <path d="M60 8 L60 -4" stroke="#a8bccf" strokeWidth="1.6" strokeLinecap="round" />
      </>,
      neck: null,
    },

    /* ── KORAX · corvid frame ── a beak, and the eyes set behind it */
    korax: {
      skull: "M60 6 C78 6 88 20 88 40 C88 54 80 64 70 68 L60 74 L50 68 C40 64 32 54 32 40 C32 20 42 6 60 6 Z",
      fill: "carbon", line: "#7a8798", body: "carbon", bodyLine: "#3b4552", hv: "26 -14 68 94",
      prof: { brow: 24, nose: 40, lip: 56, chin: 70 },
      shellArt: <>
        {/* three swept quills off the back of the skull */}
        {[0, 1, 2].map(i => (
          <path key={i} d={`M${44 + i * 8} 10 C${36 + i * 8} -6 ${30 + i * 8} -14 ${22 + i * 8} -18 C${32 + i * 8} -10 ${36 + i * 8} -2 ${40 + i * 8} 12 Z`}
            fill={`url(#${id}-carbon)`} stroke="#5a6675" strokeWidth=".8" strokeLinejoin="round" opacity={.95 - i * .1} />))}
      </>,
      art: <>
        {face(60, <path d="M40 30 L80 30 L76 42 L44 42 Z" fill="#04070e" />, "band")}
        {face(48, <g className="ca-eye"><ellipse cx="48" cy="36" rx="6" ry="4.2" fill="#180405" /><ellipse cx="48" cy="36" rx="4.2" ry="2.8" fill={`url(#${id}-red)`} className="ca-optic" /></g>, "e1")}
        {face(72, <g className="ca-eye"><ellipse cx="72" cy="36" rx="6" ry="4.2" fill="#180405" /><ellipse cx="72" cy="36" rx="4.2" ry="2.8" fill={`url(#${id}-red)`} className="ca-optic" /></g>, "e2")}
        {face(60, <path d="M52 44 L68 44 L64 60 L60 74 L56 60 Z" fill={`url(#${id}-graphite)`} stroke="#5a6675" strokeWidth=".9" strokeLinejoin="round" />, "beak")}
        {face(60, <path d="M56 50 L64 50" stroke="#2a323d" strokeWidth="1.2" opacity=".8" />, "bl")}
      </>,
      side: "M60 6 C78 6 87 20 87 40 C87 54 80 64 70 68 L60 74 L50 68 C40 64 33 54 33 40 C33 20 42 6 60 6 Z",
      sideArt: <>
        {[0, 1].map(i => (
          <path key={i} d={`M${48 + i * 8} 10 C${40 + i * 8} -6 ${34 + i * 8} -14 ${26 + i * 8} -18 C${36 + i * 8} -10 ${40 + i * 8} -2 ${44 + i * 8} 12 Z`}
            fill={`url(#${id}-carbon)`} stroke="#5a6675" strokeWidth=".8" strokeLinejoin="round" />))}
        <path d="M40 30 L82 30 L78 42 L44 42 Z" fill="#04070e" />
        <ellipse cx="72" cy="36" rx="5.6" ry="4" fill="#180405" />
        <ellipse cx="72" cy="36" rx="3.9" ry="2.6" fill={`url(#${id}-red)`} className="ca-optic" />
        <path d="M76 44 L94 52 L74 62 L70 46 Z" fill={`url(#${id}-graphite)`} stroke="#5a6675" strokeWidth=".9" strokeLinejoin="round" />
      </>,
      rear: <>
        <path d="M34 16 Q60 6 86 16 Q91 44 82 62 Q60 72 38 62 Q29 44 34 16 Z" fill={`url(#${id}-carbon)`} stroke="#5a6675" strokeWidth=".9" strokeLinejoin="round" />
        {[0, 1, 2].map(i => (
          <path key={i} d={`M${44 + i * 8} 12 C${36 + i * 8} -4 ${30 + i * 8} -12 ${22 + i * 8} -16 C${32 + i * 8} -8 ${36 + i * 8} 0 ${40 + i * 8} 14 Z`}
            fill={`url(#${id}-carbon)`} stroke="#5a6675" strokeWidth=".8" strokeLinejoin="round" opacity={.9 - i * .1} />))}
        <path d="M44 36 L76 36 M46 48 L74 48" stroke="#232a33" strokeWidth="1.6" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── TEMPEST · high-speed interceptor ── everything on it is swept back */
    tempest: {
      skull: "M60 6 L80 18 L82 40 L72 62 L60 72 L48 62 L38 40 L40 18 Z",
      fill: "steelblu", line: "#8fc0e0", body: "steelblu", bodyLine: "#3f7ba8", hv: "20 -8 80 88",
      prof: { brow: 22, nose: 38, lip: 54, chin: 68 },
      shellArt: <>
        {/* intake vanes, raked hard so the head reads as moving even at rest */}
        {[0, 1, 2].map(i => (
          <g key={i}>
            <path d={`M${40 - i * 3} ${20 + i * 9} L${20 - i * 4} ${8 + i * 9}`} stroke="#6fa8cc" strokeWidth={2.6 - i * .4} strokeLinecap="round" />
            <path d={`M${80 + i * 3} ${20 + i * 9} L${100 + i * 4} ${8 + i * 9}`} stroke="#6fa8cc" strokeWidth={2.6 - i * .4} strokeLinecap="round" />
          </g>))}
        <path d="M60 6 L60 -8" stroke="#6fa8cc" strokeWidth="2" strokeLinecap="round" />
      </>,
      art: <>
        {face(60, <path d="M40 24 L80 24 L76 40 L44 40 Z" fill="#04121a" />, "vis")}
        {face(60, <path d="M43 27 L77 27 L74 37 L46 37 Z" fill={`url(#${id}-iris)`} opacity=".95" className="ca-optic" />, "lit")}
        {face(48, <path d="M44 28 L56 27 L54 33 L44 33 Z" fill="#ffffff" opacity=".38" />, "gl")}
        {face(60, <>
          <path d="M48 46 L72 46 L68 62 L52 62 Z" fill="#0b1a26" stroke="#6fa8cc" strokeWidth=".8" />
          {[54, 60, 66].map(x => <path key={x} d={`M${x} 48 L${x - 2} 60`} stroke="#6fa8cc" strokeWidth="1.4" opacity=".75" />)}
        </>, "jaw")}
      </>,
      side: "M60 6 L80 18 L82 40 L72 62 L60 72 L48 62 L38 40 L40 18 Z",
      sideArt: <>
        {[0, 1, 2].map(i => (
          <path key={i} d={`M${80 + i * 3} ${20 + i * 9} L${100 + i * 4} ${8 + i * 9}`} stroke="#6fa8cc" strokeWidth={2.6 - i * .4} strokeLinecap="round" />))}
        <path d="M40 24 L82 24 L78 40 L44 40 Z" fill="#04121a" />
        <path d="M46 27 L79 27 L76 37 L49 37 Z" fill={`url(#${id}-iris)`} opacity=".95" className="ca-optic" />
        <path d="M52 46 L76 46 L72 62 L56 62 Z" fill="#0b1a26" stroke="#6fa8cc" strokeWidth=".8" />
      </>,
      rear: <>
        <path d="M40 14 L80 14 L82 40 L72 64 L48 64 L38 40 Z" fill={`url(#${id}-steelblu)`} stroke="#6fa8cc" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M46 26 L74 26 M44 38 L76 38 M48 50 L72 50" stroke="#0b1a26" strokeWidth="1.7" opacity=".55" />
        <circle cx="60" cy="38" r="5" fill={`url(#${id}-iris)`} opacity=".5" />
      </>,
      neck: null,
    },

    /* ── BASTION · bunker head ── rivets, a slit, and no other openings */
    bastion: {
      skull: "M38 12 L82 12 C86 12 88 15 88 19 L88 60 C88 66 84 70 78 70 L42 70 C36 70 32 66 32 60 L32 19 C32 15 34 12 38 12 Z",
      fill: "bronze", line: "#c8a05c", body: "bronze", bodyLine: "#8a6636", hv: "26 2 68 76",
      prof: { brow: 22, nose: 38, lip: 54, chin: 68 },
      shellArt: <>
        <path d="M32 22 L88 22" stroke="#5c3f16" strokeWidth="2" opacity=".7" />
        <path d="M42 12 L42 4 L54 4 L54 12 Z M66 12 L66 4 L78 4 L78 12 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".8" strokeLinejoin="round" />
        {[38, 50, 70, 82].map(x => <circle key={x} cx={x} cy="17" r="2" fill="#8a6636" />)}
      </>,
      art: <>
        {face(60, <>
          {/* one long slit, and the armour lip that overhangs it */}
          <path d="M34 30 L86 30 L86 42 L34 42 Z" fill="#0a0704" />
          <path d="M37 33 L83 33 L83 39 L37 39 Z" fill={`url(#${id}-amber)`} className="ca-optic" />
          <path d="M34 28 L86 28 L84 31 L36 31 Z" fill="#a07c3a" />
        </>, "slit")}
        {face(60, <>
          <path d="M40 50 L80 50 L80 64 L40 64 Z" fill="#160f06" stroke="#a07c3a" strokeWidth=".8" />
          {[46, 53, 60, 67, 74].map(x => <rect key={x} x={x - 1.5} y="52" width="3" height="10" rx="1" fill="#a07c3a" opacity=".7" />)}
        </>, "grille")}
        {[36, 84].map((x, i) => face(x, <circle key={i} cx={x} cy="56" r="2.4" fill="#8a6636" />, "rv" + i))}
      </>,
      side: "M38 12 L82 12 C86 12 88 15 88 19 L88 60 C88 66 84 70 78 70 L42 70 C36 70 32 66 32 60 L32 19 C32 15 34 12 38 12 Z",
      sideArt: <>
        <path d="M32 22 L88 22" stroke="#5c3f16" strokeWidth="2" opacity=".65" />
        <path d="M66 12 L66 4 L78 4 L78 12 Z" fill={`url(#${id}-bronze)`} stroke="#8a6636" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M34 30 L86 30 L86 42 L34 42 Z" fill="#0a0704" />
        <path d="M56 33 L83 33 L83 39 L56 39 Z" fill={`url(#${id}-amber)`} className="ca-optic" />
        <path d="M46 50 L84 50 L84 64 L46 64 Z" fill="#160f06" stroke="#a07c3a" strokeWidth=".8" />
        {[38, 50, 70, 82].map(x => <circle key={x} cx={x} cy="17" r="2" fill="#8a6636" />)}
      </>,
      rear: <>
        <path d="M32 14 L88 14 L88 60 C88 66 84 70 78 70 L42 70 C36 70 32 66 32 60 Z" fill={`url(#${id}-bronze)`} stroke="#a07c3a" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M38 26 L82 26 M38 40 L82 40 M38 54 L82 54" stroke="#5c3f16" strokeWidth="1.8" opacity=".6" />
        {[38, 50, 70, 82].map(x => <circle key={x} cx={x} cy="19" r="2" fill="#8a6636" />)}
        {[38, 50, 70, 82].map(x => <circle key={"b" + x} cx={x} cy="64" r="2" fill="#8a6636" />)}
      </>,
      neck: null,
    },

    /* ── NYX · night frame ── one crescent, and it is the only light on it */
    nyx: {
      skull: "M60 5 C79 5 89 20 89 42 C89 60 77 70 60 72 C43 70 31 60 31 42 C31 20 41 5 60 5 Z",
      fill: "plum", line: "#b98cff", body: "obsidian", bodyLine: "#4a3a6a", hv: "24 -14 72 94",
      prof: { brow: 24, nose: 40, lip: 55, chin: 69 },
      shellArt: <>
        {/* two horns curving back, and a crescent hung between them */}
        {[-1, 1].map(k => (
          <path key={k} d={`M${60 + k * 20} 12 C${60 + k * 30} -4 ${60 + k * 30} -16 ${60 + k * 22} -22 C${60 + k * 28} -10 ${60 + k * 26} -2 ${60 + k * 24} 14 Z`}
            fill={`url(#${id}-plum)`} stroke="#8f5fc4" strokeWidth=".9" strokeLinejoin="round" />))}
        <path d="M50 -6 A12 12 0 1 0 70 -6 A9 12 0 1 1 50 -6 Z" fill="#e8d3ff" stroke="#b98cff" strokeWidth=".8" className="ca-optic" />
      </>,
      art: <>
        {face(60, <path d="M34 28 L86 28 L82 44 L38 44 Z" fill="#08040f" />, "band")}
        {face(60, <path d="M42 38 A20 20 0 0 1 78 38 A26 26 0 0 0 42 38 Z" fill={`url(#${id}-iris)`} className="ca-optic" />, "cres")}
        {face(60, <path d="M46 36 A16 16 0 0 1 74 36" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity=".7" />, "hi")}
        {face(60, <>
          <path d="M46 50 L74 50 L70 64 L50 64 Z" fill="#0d0818" stroke="#8f5fc4" strokeWidth=".7" />
          {[53, 60, 67].map(x => <path key={x} d={`M${x} 52 L${x} 62`} stroke="#8f5fc4" strokeWidth="1.3" opacity=".7" />)}
        </>, "jaw")}
      </>,
      side: "M60 5 C79 5 88 20 88 42 C88 58 79 68 70 71 Q60 74 51 70 C40 66 32 56 32 42 C32 20 42 5 60 5 Z",
      sideArt: <>
        <path d="M80 12 C90 -4 90 -16 82 -22 C88 -10 86 -2 84 14 Z" fill={`url(#${id}-plum)`} stroke="#8f5fc4" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M52 -6 A12 12 0 1 0 72 -6 A9 12 0 1 1 52 -6 Z" fill="#e8d3ff" stroke="#b98cff" strokeWidth=".8" />
        <path d="M36 28 L86 28 L82 44 L40 44 Z" fill="#08040f" />
        <path d="M56 38 A18 18 0 0 1 82 34 A24 24 0 0 0 56 38 Z" fill={`url(#${id}-iris)`} className="ca-optic" />
        <path d="M52 50 L78 50 L74 64 L54 64 Z" fill="#0d0818" stroke="#8f5fc4" strokeWidth=".7" />
      </>,
      rear: <>
        <path d="M33 18 Q60 6 87 18 Q92 46 84 64 Q60 74 36 64 Q28 46 33 18 Z" fill={`url(#${id}-plum)`} stroke="#8f5fc4" strokeWidth=".9" strokeLinejoin="round" />
        {[-1, 1].map(k => (
          <path key={k} d={`M${60 + k * 20} 14 C${60 + k * 30} -2 ${60 + k * 30} -14 ${60 + k * 22} -20 C${60 + k * 28} -8 ${60 + k * 26} 0 ${60 + k * 24} 16 Z`}
            fill={`url(#${id}-plum)`} stroke="#8f5fc4" strokeWidth=".9" strokeLinejoin="round" />))}
        <circle cx="60" cy="42" r="8" fill="none" stroke="#8f5fc4" strokeWidth="1.4" opacity=".7" />
        <circle cx="60" cy="42" r="3" fill="#e8d3ff" opacity=".7" />
      </>,
      neck: null,
    },

    /* ── FORGE · foundry frame ── a furnace behind the face, and it shows */
    forge: {
      skull: "M40 10 L80 10 L86 22 L84 54 L72 68 L48 68 L36 54 L34 22 Z",
      fill: "graphite", line: "#a08050", body: "bronze", bodyLine: "#8a6636", hv: "26 -6 68 84",
      prof: { brow: 23, nose: 39, lip: 55, chin: 68 },
      shellArt: <>
        {/* two exhaust stacks, glowing at the lip */}
        {[-1, 1].map(k => (
          <g key={k}>
            <path d={`M${60 + k * 16} 10 L${60 + k * 14} -10 L${60 + k * 24} -10 L${60 + k * 24} 12 Z`}
              fill={`url(#${id}-graphite)`} stroke="#6a5a48" strokeWidth=".9" strokeLinejoin="round" />
            <path d={`M${60 + k * 14} -10 L${60 + k * 24} -10`} stroke="#ff8a3c" strokeWidth="2.6" strokeLinecap="round" className="ca-optic" />
          </g>))}
      </>,
      art: <>
        {face(60, <path d="M36 26 L84 26 L82 40 L38 40 Z" fill="#0d0703" />, "b")}
        {face(48, <g className="ca-eye"><rect x="41" y="29" width="14" height="8" rx="2.4" fill="#2a0d02" /><rect x="42.6" y="30.6" width="10.8" height="4.8" rx="1.8" fill={`url(#${id}-amber)`} className="ca-optic" /></g>, "e1")}
        {face(72, <g className="ca-eye"><rect x="65" y="29" width="14" height="8" rx="2.4" fill="#2a0d02" /><rect x="66.6" y="30.6" width="10.8" height="4.8" rx="1.8" fill={`url(#${id}-amber)`} className="ca-optic" /></g>, "e2")}
        {face(60, <>
          {/* the grate: hot metal seen through slots */}
          <path d="M42 46 L78 46 L74 64 L46 64 Z" fill="#1a0c04" stroke="#a08050" strokeWidth=".8" />
          {[50, 56, 62, 68].map(x => <path key={x} d={`M${x} 48 L${x - 2} 62`} stroke="#ff8a3c" strokeWidth="2.2" opacity=".8" className="ca-optic" />)}
        </>, "grate")}
      </>,
      side: "M40 10 L80 10 L86 22 L84 54 L72 68 L48 68 L36 54 L34 22 Z",
      sideArt: <>
        <path d="M76 10 L74 -10 L84 -10 L84 12 Z" fill={`url(#${id}-graphite)`} stroke="#6a5a48" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M74 -10 L84 -10" stroke="#ff8a3c" strokeWidth="2.6" strokeLinecap="round" className="ca-optic" />
        <path d="M36 26 L86 26 L84 40 L38 40 Z" fill="#0d0703" />
        <rect x="67" y="29" width="14" height="8" rx="2.4" fill="#2a0d02" />
        <rect x="68.6" y="30.6" width="10.8" height="4.8" rx="1.8" fill={`url(#${id}-amber)`} className="ca-optic" />
        <path d="M48 46 L82 46 L78 64 L52 64 Z" fill="#1a0c04" stroke="#a08050" strokeWidth=".8" />
      </>,
      rear: <>
        <path d="M36 16 L84 16 L86 52 L72 68 L48 68 L34 52 Z" fill={`url(#${id}-graphite)`} stroke="#6a5a48" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M42 28 L78 28 M42 42 L78 42 M46 56 L74 56" stroke="#1a1208" strokeWidth="1.8" opacity=".6" />
        {[-1, 1].map(k => (
          <path key={k} d={`M${60 + k * 16} 16 L${60 + k * 14} -8 L${60 + k * 24} -8 L${60 + k * 24} 18 Z`}
            fill={`url(#${id}-graphite)`} stroke="#6a5a48" strokeWidth=".9" strokeLinejoin="round" />))}
      </>,
      neck: null,
    },

    /* ── ZENITH · ceremonial frame ── gold, and a ring of light over it */
    zenith: {
      skull: "M60 8 C79 8 88 22 88 42 C88 60 77 70 60 71 C43 70 32 60 32 42 C32 22 41 8 60 8 Z",
      fill: "gold", line: "#f0d68a", body: "gold", bodyLine: "#c19a3a", hv: "22 -20 76 98",
      prof: { brow: 25, nose: 40, lip: 55, chin: 68 },
      shellArt: <>
        {/* a halo held clear of the crown by two thin struts */}
        <ellipse cx="60" cy="-14" rx="24" ry="7" fill="none" stroke="#ffe9a8" strokeWidth="3.2" opacity=".95" className="ca-optic" />
        <ellipse cx="60" cy="-14" rx="24" ry="7" fill="none" stroke="#ffffff" strokeWidth="1" opacity=".7" />
        <path d="M46 8 L50 -10 M74 8 L70 -10" stroke="#e0c070" strokeWidth="1.6" strokeLinecap="round" />
        {[0, 1, 2, 3, 4].map(i => (
          <path key={i} d={`M${44 + i * 8} 10 L${44 + i * 8} 2`} stroke="#e0c070" strokeWidth="1.8" strokeLinecap="round" />))}
      </>,
      art: <>
        {face(60, <path d="M34 26 L86 26 L82 42 L38 42 Z" fill="#1a1204" />, "band")}
        {face(49, <g className="ca-eye">
          <path d="M42 34 L56 30 L56 38 L42 38 Z" fill="#241a05" />
          <path d="M43.4 34.6 L54.6 31.4 L54.6 36.6 L43.4 36.6 Z" fill={`url(#${id}-amber)`} className="ca-optic" />
        </g>, "e1")}
        {face(71, <g className="ca-eye">
          <path d="M78 34 L64 30 L64 38 L78 38 Z" fill="#241a05" />
          <path d="M76.6 34.6 L65.4 31.4 L65.4 36.6 L76.6 36.6 Z" fill={`url(#${id}-amber)`} className="ca-optic" />
        </g>, "e2")}
        {face(60, <path d="M60 44 L66 52 L60 62 L54 52 Z" fill={`url(#${id}-chrome)`} stroke="#c19a3a" strokeWidth=".8" strokeLinejoin="round" />, "gem")}
        {face(60, <path d="M46 66 L74 66" stroke="#c19a3a" strokeWidth="1.6" opacity=".7" />, "l")}
      </>,
      side: "M60 8 C79 8 87 22 87 42 C87 58 78 68 70 70 Q60 73 51 69 C41 65 33 56 33 42 C33 22 41 8 60 8 Z",
      sideArt: <>
        <ellipse cx="60" cy="-14" rx="22" ry="6.4" fill="none" stroke="#ffe9a8" strokeWidth="3" opacity=".92" />
        <path d="M74 8 L70 -10" stroke="#e0c070" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M36 26 L86 26 L82 42 L40 42 Z" fill="#1a1204" />
        <path d="M80 34 L64 30 L64 38 L80 38 Z" fill="#241a05" />
        <path d="M78.6 34.6 L65.4 31.4 L65.4 36.6 L78.6 36.6 Z" fill={`url(#${id}-amber)`} className="ca-optic" />
        <path d="M66 44 L72 52 L66 62 L60 52 Z" fill={`url(#${id}-chrome)`} stroke="#c19a3a" strokeWidth=".8" strokeLinejoin="round" />
      </>,
      rear: <>
        <path d="M34 20 Q60 8 86 20 Q91 46 83 64 Q60 74 37 64 Q29 46 34 20 Z" fill={`url(#${id}-gold)`} stroke="#d8b45c" strokeWidth=".9" strokeLinejoin="round" />
        <ellipse cx="60" cy="-12" rx="24" ry="7" fill="none" stroke="#ffe9a8" strokeWidth="3.2" opacity=".9" />
        <path d="M46 40 Q60 34 74 40" fill="none" stroke="#c19a3a" strokeWidth="1.3" opacity=".65" />
        <path d="M60 46 L66 54 L60 64 L54 54 Z" fill={`url(#${id}-chrome)`} stroke="#c19a3a" strokeWidth=".8" strokeLinejoin="round" />
      </>,
      neck: null,
    },

  }[v];

  /* Limb pivots live where the joint is: shoulders on the pauldron line, hips
     on the pelvis, and the upper body about the waist. A chibi's are its own —
     its arms hang off a barrel, not off a shoulder line. */
  /* A pose is either one of the named stances above or, for anything that needs
     to animate rather than strike an attitude, a bare table of joint angles.
     The walk cycle in the Adventure world drives this rig frame by frame - the
     rotations are already about the real joints, so there is nothing to add
     but the numbers. */
  const PZ = (pose && typeof pose === "object") ? { ...POSES.idle, ...pose } : (POSES[pose] || POSES.idle);
  const rot = (d, cx, cy) => `rotate(${d.toFixed(2)} ${cx} ${cy})`;
  const rig = MODEL_RIG[v] || MODEL_RIG.vanguard;
  const CC = classOf(v).c;                    // the duel class this chassis fights as
  const KIT = CLASS_KIT[classKeyOf(v)] || CLASS_KIT.striker;
  const hs = rig.hs;                          // head size against the body
  const chibi = !!rig.chibi;
  const bw = rig.bw || 1, bh = rig.bh || 1;
  const shellFill = `url(#${id}-${HEAD.fill})`;
  // the chassis takes the model's own material; the outfit's swatch re-plates the trim
  const bodyKey = HEAD.body || (HEAD.fill.startsWith("skin") ? "plate" : HEAD.fill);
  const bPlate = `url(#${id}-${bodyKey})`;
  const bTrim = `url(#${id}-trim)`;
  const bLine = HEAD.bodyLine || HEAD.line;
  /* Every armour plate goes through here: fill, form shadow, key highlight,
     grazing rim, outline. Five passes over one path is what separates a plate
     from a coloured shape, and it is the whole reason the figure reads as
     metal rather than as a sticker. */
  /* A stable id per path so each plate can clip its own bevel. Hashed rather
     than counted: a counter would give different ids on a re-render and break
     the clip references. */
  /* ── the element cache ──
     A pose is a handful of joint angles, but changing one of them used to
     rebuild the entire robot. `plate` draws its path THIRTEEN times — fill,
     five light passes, depth, a clipped bevel, graze, contour, glint — and a
     chassis carries around fifty-five plates, so React had seven hundred
     freshly built elements to diff for what amounts to eight `transform`
     attributes. Measured, that was the hitch you felt every time a punch
     landed: seventy-odd dropped frames and a second of long tasks in an
     eight-second round.

     Every drawing helper below returns the SAME element object for the same
     arguments now. React compares props by identity, sees the subtree is
     untouched and skips it whole, so a pose change reaches the DOM as a few
     transform writes instead of a full rebuild. The cache is dropped the
     moment anything that changes the ARTWORK changes; the pose is not one of
     those things, and neither is the yaw, which no cached helper reads. */
  const artKey = [v, id, armorA, armorB, glow, accent, headOnly ? 1 : 0].join("|");
  const cacheRef = useRef({ k: null, m: null });
  if (cacheRef.current.k !== artKey) cacheRef.current = { k: artKey, m: new Map() };
  const keep = (tag, fn) => (...a) => {
    const m = cacheRef.current.m, k = tag + JSON.stringify(a);
    if (!m.has(k)) m.set(k, fn(...a));
    return m.get(k);
  };

  const plate = keep("pl", (d, o = {}) => (
    <g>
      <path d={d} fill={o.fill || bPlate} stroke="none" />
      <path d={d} fill={`url(#${id}-occ)`} stroke="none" opacity={o.occ == null ? 1 : o.occ} />
      {/* warm key, cool bounce — light with a colour, not a white wash */}
      <path d={d} fill={`url(#${id}-warm)`} stroke="none" opacity={o.warm == null ? 1 : o.warm} />
      <path d={d} fill={`url(#${id}-cool)`} stroke="none" opacity={o.cool == null ? 1 : o.cool} />
      <path d={d} fill={`url(#${id}-spec)`} stroke="none" opacity={o.spec == null ? 1 : o.spec} />
      {/* the narrow hot-spot: the pass that makes it metal rather than matte */}
      <path d={d} fill={`url(#${id}-hot)`} stroke="none" opacity={o.hot == null ? .9 : o.hot} />
      {/* fresnel across the whole plate, then the grazing edge on top of it */}
      <path d={d} fill={`url(#${id}-fres)`} stroke="none" opacity={o.fres == null ? .55 : o.fres} />
      {o.deep ? <path d={d} fill={`url(#${id}-depth)`} stroke="none" opacity={o.deep} /> : null}
      {/* ── the bevel ──
          A machined plate has a lip: the top edge catches the key and the
          bottom edge falls into shadow. Two offset copies of the same outline,
          clipped to the plate, cost nothing and are the single biggest step
          from "shape with a gradient" to "part with a thickness". */}
      <g clipPath={`url(#${id}-c${Math.abs(hashPath(d))})`}>
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={(o.lw || 1) * 1.5} strokeLinejoin="round" opacity={o.bev == null ? .34 : o.bev} transform="translate(0 -0.9)" />
        <path d={d} fill="none" stroke="#00060f" strokeWidth={(o.lw || 1) * 1.5} strokeLinejoin="round" opacity={o.bev == null ? .3 : o.bev * .9} transform="translate(0 1.1)" />
      </g>
      <path d={d} fill="none" stroke={`url(#${id}-graze)`} strokeWidth={(o.lw || 1) * 1.15} strokeLinejoin="round" opacity={o.graze == null ? .4 : o.graze} />
      {/* ── the contour ──
          A plate's edge is first a CONTACT — the dark hairline where it meets
          whatever is behind it — and only then a lit edge. Painting one fat
          near-white outline around every plate is what turns a machine into a
          sticker, so the dark contour carries the separation and the light
          line is thinned to a glint on top of it. */}
      <path d={d} fill="none" stroke="#00060f" strokeWidth={(o.lw || 1) * 1.15} strokeLinejoin="round" opacity={o.lineOp == null ? .42 : o.lineOp * .47} />
      <path d={d} fill="none" stroke={o.line || bLine} strokeWidth={(o.lw || 1) * .55} strokeLinejoin="round" opacity={o.lineOp == null ? .5 : o.lineOp * .56} />
      <clipPath id={`${id}-c${Math.abs(hashPath(d))}`}><path d={d} /></clipPath>
    </g>
  ));
  /* A LIT seam: a channel with energy running through it. Three passes — a
     wide dim bloom, the line itself, a white core — so it reads as light
     inside the armour rather than a coloured pen stroke on top of it. This is
     what separates a machine that is switched on from one that is painted. */
  const vein = keep("vn", (d, w = 1.4, col = glow) => (
    <g>
      <path d={d} fill="none" stroke={col} strokeWidth={w * 4.5} strokeLinecap="round" opacity=".14" />
      <path d={d} fill="none" stroke={col} strokeWidth={w * 1.8} strokeLinecap="round" opacity=".5" />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={w * .6} strokeLinecap="round" opacity=".8" />
    </g>
  ));
  // an engraved seam: a cut, and the lit edge below where it catches the key
  const groove = keep("gr", (d, w = 1, op = .55) => (
    <g opacity={op}>
      <path d={d} fill="none" stroke="#00060f" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
      <path d={d} fill="none" stroke="#eaf3ff" strokeWidth={w * .5} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 .85)" opacity=".55" />
    </g>
  ));
  /* A visible pivot — the disc a limb actually turns on, with a bolt through
     it. The AO blob says "there is a gap here"; this says "there is a JOINT
     here", which is what makes a machine look assembled rather than moulded. */
  const pivot = keep("pv", (px, py, r) => (
    <g>
      <circle cx={px} cy={py} r={r} fill={bPlate} stroke={bLine} strokeWidth="1" opacity=".95" />
      <circle cx={px} cy={py} r={r} fill={`url(#${id}-occ)`} />
      <circle cx={px} cy={py} r={r * .62} fill="none" stroke={bLine} strokeWidth=".9" opacity=".55" />
      <circle cx={px} cy={py} r={r * .26} fill={bLine} opacity=".5" />
      <circle cx={px - r * .3} cy={py - r * .34} r={r * .18} fill="#fff" opacity=".5" />
    </g>
  ));
  // the dark that gathers where two parts meet
  const joint = keep("jt", (cx, cy, r) => <ellipse cx={cx} cy={cy} rx={r} ry={r * .78} fill={`url(#${id}-ao)`} />);
  /* The shadow the part in front drops onto the one behind it. It is painted
     as a re-fill of the RECEIVING path, not as a free-floating ellipse: a
     shadow that can wander off its own surface onto the background is worse
     than no shadow at all, and in bounding-box space one gradient serves every
     plate whatever its shape. */
  const castOn = keep("co", (d, op = 1) => <path d={d} fill={`url(#${id}-cast)`} opacity={op} />);

  /* ── the profile ──
     A parametric squash alone cannot turn a head: past about 45° there is
     nothing left of the face and the silhouette reads as a blank egg. So each
     build also carries a DRAWN side view, and it cross-fades in with |sin φ|
     over the front one — the union of the two at 45° is a real three-quarter
     head, and at 90° the profile has taken over completely. It is mirrored
     wholesale when the model turns the other way, and its own detailing fades
     out as the head passes 90° and starts showing its back. */
  const dir = s >= 0 ? 1 : -1;
  const ws = clamp((side - 0.08) / 0.45, 0, 1);
  // the side view's own detailing yields to whichever face is actually toward us
  const profArt = ws * (1 - front * 0.85) * clamp((c + 0.3) / 0.35, 0, 1);
  const profile = ws > 0.02 && (
    <g opacity={ws.toFixed(3)} transform={`translate(${(cxs - 60).toFixed(2)} 0)${dir < 0 ? " translate(120 0) scale(-1 1)" : ""}`}>
      <path d={HEAD.side} fill={shellFill} stroke="none" />
      <path d={HEAD.side} fill={`url(#${id}-occ)`} opacity=".46" />
      <path d={HEAD.side} fill={`url(#${id}-sheen)`} opacity={HEAD.fill === "chrome" ? ".95" : ".68"} />
      <path d={HEAD.side} fill={`url(#${id}-bnc)`} />
      <path d={HEAD.side} fill="none" stroke={`url(#${id}-graze)`} strokeWidth="1.7" strokeLinejoin="round" opacity=".45" />
      <path d={HEAD.side} fill="none" stroke={HEAD.line} strokeWidth="1" strokeLinejoin="round" />
      <path d={HEAD.side} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.4" strokeLinejoin="round" />
      <g opacity={profArt.toFixed(3)}>{HEAD.sideArt}</g>
    </g>
  );

  return (
    <svg className={`ca ca-${v} ca-pose-${pose}`} viewBox={headOnly ? (HEAD.hv || "31 1 58 74") : "-20 -16 160 416"} width="100%" height="100%" aria-hidden="true">
      <defs>
        {/* Polished, worn chrome. A hard specular band with dark falloff either
            side is what separates chrome from flat grey — the T-800's finish is
            plated metal, not paint. */}
        <linearGradient id={`${id}-chrome`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#e9f1ff" />
          <stop offset="18%" stopColor="#9fb2d2" />
          <stop offset="34%" stopColor="#f4f8ff" />
          <stop offset="52%" stopColor="#6d7f9e" />
          <stop offset="74%" stopColor="#33405a" />
          <stop offset="100%" stopColor="#141b28" />
        </linearGradient>
        <linearGradient id={`${id}-skin`} x1="0.35" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stopColor="#f3e2d8" />
          <stop offset="42%" stopColor="#dcc3b6" />
          <stop offset="78%" stopColor="#a98d84" />
          <stop offset="100%" stopColor="#6d5a58" />
        </linearGradient>
        {/* Skin comes in more than one colour. Three ramps, each with its own
            warmth in the light and its own depth in the shadow — a deep tone
            lit with a pale tone's falloff just reads as a pale face turned
            down, which is the usual way this gets done badly. */}
        <linearGradient id={`${id}-skin2`} x1="0.35" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stopColor="#e8c19b" />
          <stop offset="42%" stopColor="#c99a6e" />
          <stop offset="78%" stopColor="#96694a" />
          <stop offset="100%" stopColor="#5c3d2c" />
        </linearGradient>
        <linearGradient id={`${id}-skin3`} x1="0.35" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stopColor="#b07a55" />
          <stop offset="40%" stopColor="#8a5636" />
          <stop offset="76%" stopColor="#5e3623" />
          <stop offset="100%" stopColor="#331c13" />
        </linearGradient>
        <linearGradient id={`${id}-hair2`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#f4dda2" />
          <stop offset="52%" stopColor="#d8b56a" />
          <stop offset="100%" stopColor="#8f6c33" />
        </linearGradient>
        <linearGradient id={`${id}-hairB`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#6b4a33" />
          <stop offset="55%" stopColor="#412b1d" />
          <stop offset="100%" stopColor="#20140d" />
        </linearGradient>
        <radialGradient id={`${id}-amber`}>
          <stop offset="0%" stopColor="#fff6cf" />
          <stop offset="34%" stopColor="#ffcf4a" />
          <stop offset="100%" stopColor="#9a6a00" />
        </radialGradient>
        <radialGradient id={`${id}-brown`}>
          <stop offset="0%" stopColor="#d8ae7c" />
          <stop offset="52%" stopColor="#8a5a2e" />
          <stop offset="100%" stopColor="#361f0f" />
        </radialGradient>
        <radialGradient id={`${id}-iris2`}>
          <stop offset="0%" stopColor="#d9f7c4" />
          <stop offset="55%" stopColor="#5aa86a" />
          <stop offset="100%" stopColor="#1d4327" />
        </radialGradient>
        {/* protocol-droid gold: warm, over-polished, and worn at the edges */}
        <linearGradient id={`${id}-gold`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="20%" stopColor="#e8bf58" />
          <stop offset="36%" stopColor="#fff6d8" />
          <stop offset="56%" stopColor="#c99425" />
          <stop offset="80%" stopColor="#8a6215" />
          <stop offset="100%" stopColor="#4a340a" />
        </linearGradient>
        {/* battlefield tan, sand-scoured */}
        <linearGradient id={`${id}-tan`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#eadcbb" />
          <stop offset="42%" stopColor="#c9b183" />
          <stop offset="78%" stopColor="#94794f" />
          <stop offset="100%" stopColor="#4f3f27" />
        </linearGradient>
        <linearGradient id={`${id}-white`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e2ebf6" />
          <stop offset="80%" stopColor="#a9b8cc" />
          <stop offset="100%" stopColor="#6f7f96" />
        </linearGradient>
        <radialGradient id={`${id}-red`}>
          <stop offset="0%" stopColor="#ffd9dc" />
          <stop offset="32%" stopColor="#ff2d46" />
          <stop offset="100%" stopColor="#8c0010" />
        </radialGradient>
        <radialGradient id={`${id}-iris`}>
          <stop offset="0%" stopColor="#bfe9ff" />
          <stop offset="55%" stopColor="#3aa8dd" />
          <stop offset="100%" stopColor="#12405e" />
        </radialGradient>
        {/* lacquer: the black-and-crimson of a samurai's armour */}
        <linearGradient id={`${id}-lacquer`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#8c2b34" />
          <stop offset="30%" stopColor="#4a1119" />
          <stop offset="70%" stopColor="#22070c" />
          <stop offset="100%" stopColor="#0c0306" />
        </linearGradient>
        {/* soft-serve: the whole point of MOCHI is that it is not metal */}
        <linearGradient id={`${id}-mochi`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#fffaf6" />
          <stop offset="42%" stopColor="#ffe6ee" />
          <stop offset="78%" stopColor="#ffc9dd" />
          <stop offset="100%" stopColor="#e59ab8" />
        </linearGradient>
        <linearGradient id={`${id}-aurora`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#e4e8ff" />
          <stop offset="58%" stopColor="#d6f5ee" />
          <stop offset="82%" stopColor="#cbb8f0" />
          <stop offset="100%" stopColor="#8b7bbf" />
        </linearGradient>
        <radialGradient id={`${id}-bigiris`}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="26%" stopColor="#8fe6ff" />
          <stop offset="62%" stopColor="#2f8ede" />
          <stop offset="100%" stopColor="#102a58" />
        </radialGradient>
        {/* ── the lighting rig ──
            Flat vector armour reads as paper because every plate is one colour.
            These three are painted over EVERY plate in object-bounding-box
            space, so each piece gets its own falloff from its own shape: a key
            light off the upper left, the form shadow turning away from it into
            the lower right, and a grazing edge where the light wraps round the
            far side. Done with gradients rather than SVG filters on purpose —
            filters on a figure this size cost real frames on a phone, and this
            costs nothing. */}
        <linearGradient id={`${id}-occ`} x1="0.12" y1="0.02" x2="0.88" y2="1">
          <stop offset="0%" stopColor="#000814" stopOpacity="0" />
          <stop offset="40%" stopColor="#000814" stopOpacity=".05" />
          <stop offset="72%" stopColor="#000814" stopOpacity=".26" />
          <stop offset="100%" stopColor="#000814" stopOpacity=".52" />
        </linearGradient>
        <linearGradient id={`${id}-spec`} x1="0.08" y1="0" x2="0.72" y2="0.92">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".62" />
          <stop offset="22%" stopColor="#ffffff" stopOpacity=".2" />
          <stop offset="52%" stopColor="#ffffff" stopOpacity="0" />
          {/* the figure stands on a white studio floor, so the far edge of every
              plate picks the room back up — without it the occlusion pass runs
              a plate to near-black and the silhouette dies into its own shadow */}
          <stop offset="84%" stopColor="#e8f1ff" stopOpacity="0" />
          <stop offset="100%" stopColor="#e8f1ff" stopOpacity=".34" />
        </linearGradient>
        {/* A broad sweep says "lit". A NARROW hot-spot says "metal": real
            specular on a hard surface is a small, very bright kernel that
            falls off fast, and its absence is why flat vector armour reads as
            matte plastic no matter how many soft gradients are stacked on it.
            In bounding-box space, so every plate gets one sized to itself. */}
        {/* A single white key light is why flat-shaded armour looks like a
            render test. Real light has a COLOUR and a bounce: a warm key from
            the upper left, a cool fill coming back off the floor into the
            lower right. Splitting the two is the cheapest thing that makes a
            surface look photographed rather than filled. */}
        {/* Emissive bloom. A lit core painted as a flat glyph is a sticker on
            armour; a real light source spills onto the plates around it. This
            is the halo that spill is made of. */}
        <radialGradient id={`${id}-bloom`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={glow} stopOpacity=".55" />
          <stop offset="34%" stopColor={glow} stopOpacity=".22" />
          <stop offset="70%" stopColor={glow} stopOpacity=".06" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-bloomR`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ff2d46" stopOpacity=".55" />
          <stop offset="34%" stopColor="#ff2d46" stopOpacity=".22" />
          <stop offset="70%" stopColor="#ff2d46" stopOpacity=".06" />
          <stop offset="100%" stopColor="#ff2d46" stopOpacity="0" />
        </radialGradient>
        {/* Depth. A limb is not on the same plane as the chest, and painting
            them at identical brightness is most of why a flat figure reads as
            a paper doll. This is the wash that pushes a limb back. */}
        <linearGradient id={`${id}-depth`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#0a1830" stopOpacity=".22" />
          <stop offset="100%" stopColor="#0a1830" stopOpacity=".1" />
        </linearGradient>
        <linearGradient id={`${id}-warm`} x1="0.1" y1="0" x2="0.75" y2="0.85">
          <stop offset="0%" stopColor="#fff0d6" stopOpacity=".34" />
          <stop offset="34%" stopColor="#ffe2b4" stopOpacity=".08" />
          <stop offset="100%" stopColor="#ffe2b4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-cool`} x1="0.85" y1="1" x2="0.3" y2="0.15">
          <stop offset="0%" stopColor="#9dc4ff" stopOpacity=".3" />
          <stop offset="40%" stopColor="#9dc4ff" stopOpacity=".06" />
          <stop offset="100%" stopColor="#9dc4ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-hot`} cx="0.29" cy="0.17" r="0.34">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".78" />
          <stop offset="26%" stopColor="#ffffff" stopOpacity=".26" />
          <stop offset="62%" stopColor="#ffffff" stopOpacity=".04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Fresnel: a surface turned away from the camera reflects more, so
            every silhouette edge picks up the cool of the room. This is what
            keeps a dark chassis from dying into a dark background. */}
        <linearGradient id={`${id}-fres`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#bcd8ff" stopOpacity=".5" />
          <stop offset="30%" stopColor="#bcd8ff" stopOpacity=".06" />
          <stop offset="76%" stopColor="#bcd8ff" stopOpacity=".05" />
          <stop offset="100%" stopColor="#e6f1ff" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${id}-graze`} x1="1" y1="1" x2="0.2" y2="0">
          <stop offset="0%" stopColor="#dbeaff" stopOpacity=".85" />
          <stop offset="34%" stopColor="#dbeaff" stopOpacity=".12" />
          <stop offset="100%" stopColor="#dbeaff" stopOpacity="0" />
        </linearGradient>
        {/* the patch of floor the figure is standing on. Without it a full-body
            render floats on the card, which is the single loudest tell that a
            game character is a sticker rather than a model. */}
        <radialGradient id={`${id}-gnd`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#0b1526" stopOpacity=".34" />
          <stop offset="42%" stopColor="#0b1526" stopOpacity=".2" />
          <stop offset="100%" stopColor="#0b1526" stopOpacity="0" />
        </radialGradient>
        {/* the shadow a body casts into its own joints */}
        <radialGradient id={`${id}-ao`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="55%" stopColor="#000814" stopOpacity=".45" />
          <stop offset="100%" stopColor="#000814" stopOpacity="0" />
        </radialGradient>
        {/* A skull is one big curved surface, so it wants a placed highlight
            rather than the plate rig's straight sweep. Both of these are in
            bounding-box space, which means any skull shape — tall visor, round
            chibi dome, long android jaw — gets a sheen sized to itself with no
            per-model tuning, and the dashed stroke this replaces (which landed
            wherever a path happened to start) is gone. */}
        <radialGradient id={`${id}-sheen`} cx="0.32" cy="0.19" r="0.52">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".5" />
          <stop offset="46%" stopColor="#ffffff" stopOpacity=".13" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-bnc`} cx="0.76" cy="0.85" r="0.44">
          <stop offset="0%" stopColor="#cfe2ff" stopOpacity=".28" />
          <stop offset="100%" stopColor="#cfe2ff" stopOpacity="0" />
        </radialGradient>
        {/* the shadow a part in front drops on the part behind it — chin on
            chest, chest on pauldron, pelvis on thigh. Flat vector figures read
            as decals precisely because these are missing. */}
        <linearGradient id={`${id}-cast`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00060f" stopOpacity=".55" />
          <stop offset="16%" stopColor="#00060f" stopOpacity=".22" />
          <stop offset="40%" stopColor="#00060f" stopOpacity=".05" />
          <stop offset="100%" stopColor="#00060f" stopOpacity="0" />
        </linearGradient>
        {/* ── chassis materials ──
            Twenty skins that all shared one body gradient meant seven androids
            reading as the same robot in different wigs. Every model now owns a
            material, so the chassis carries as much of its identity as the
            head does. Same four-stop structure as -plate: lit edge, body,
            turn, core shadow. */}
        <linearGradient id={`${id}-graphite`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#a8b2bf" />
          <stop offset="26%" stopColor="#5d6875" />
          <stop offset="62%" stopColor="#2f3742" />
          <stop offset="100%" stopColor="#14181f" />
        </linearGradient>
        <linearGradient id={`${id}-obsidian`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#7d7590" />
          <stop offset="26%" stopColor="#443c56" />
          <stop offset="62%" stopColor="#241f33" />
          <stop offset="100%" stopColor="#0d0a16" />
        </linearGradient>
        <linearGradient id={`${id}-pearl`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="26%" stopColor="#dfe7f5" />
          <stop offset="62%" stopColor="#a9b8d0" />
          <stop offset="100%" stopColor="#6b7a93" />
        </linearGradient>
        <linearGradient id={`${id}-steelblu`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#93b6d8" />
          <stop offset="26%" stopColor="#4c7ba8" />
          <stop offset="62%" stopColor="#24486e" />
          <stop offset="100%" stopColor="#0e2138" />
        </linearGradient>
        <linearGradient id={`${id}-cream`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#fff6e6" />
          <stop offset="26%" stopColor="#f0dcbd" />
          <stop offset="62%" stopColor="#cbb08a" />
          <stop offset="100%" stopColor="#93785a" />
        </linearGradient>
        <linearGradient id={`${id}-carbon`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#6c7683" />
          <stop offset="26%" stopColor="#3a424e" />
          <stop offset="62%" stopColor="#1d2129" />
          <stop offset="100%" stopColor="#0a0d12" />
        </linearGradient>
        <linearGradient id={`${id}-ivory`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="26%" stopColor="#f0f2f6" />
          <stop offset="62%" stopColor="#ccd2dd" />
          <stop offset="100%" stopColor="#8e97a6" />
        </linearGradient>
        <linearGradient id={`${id}-slateb`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#b9c8dd" />
          <stop offset="26%" stopColor="#7089a8" />
          <stop offset="62%" stopColor="#3c5170" />
          <stop offset="100%" stopColor="#17253a" />
        </linearGradient>
        <linearGradient id={`${id}-bronze`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#e2b47a" />
          <stop offset="26%" stopColor="#a8763c" />
          <stop offset="62%" stopColor="#6b4520" />
          <stop offset="100%" stopColor="#33200e" />
        </linearGradient>
        <linearGradient id={`${id}-sage`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#dfe8dd" />
          <stop offset="26%" stopColor="#a9bda6" />
          <stop offset="62%" stopColor="#6e8570" />
          <stop offset="100%" stopColor="#3a4b3d" />
        </linearGradient>
        <linearGradient id={`${id}-plum`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#c9a6e0" />
          <stop offset="26%" stopColor="#8a5ba8" />
          <stop offset="62%" stopColor="#4e2c68" />
          <stop offset="100%" stopColor="#22102f" />
        </linearGradient>
        <linearGradient id={`${id}-mint`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#e8fbf4" />
          <stop offset="26%" stopColor="#b9e6d6" />
          <stop offset="62%" stopColor="#82bfab" />
          <stop offset="100%" stopColor="#4a7b6b" />
        </linearGradient>
        <linearGradient id={`${id}-sky`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#e9f4ff" />
          <stop offset="26%" stopColor="#bcd9f2" />
          <stop offset="62%" stopColor="#83aacd" />
          <stop offset="100%" stopColor="#4a6a8c" />
        </linearGradient>
        <linearGradient id={`${id}-plate`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#8b9ec2" />
          <stop offset="26%" stopColor="#4a5a78" />
          <stop offset="62%" stopColor="#232d42" />
          <stop offset="100%" stopColor="#0d1220" />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#4a5372" />
          <stop offset="55%" stopColor="#2b3149" />
          <stop offset="100%" stopColor="#161a2a" />
        </linearGradient>
        <linearGradient id={`${id}-cls`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={mixc(CC, "#ffffff", .5)} />
          <stop offset="52%" stopColor={CC} />
          <stop offset="100%" stopColor={mixc(CC, "#000814", .55)} />
        </linearGradient>
        <linearGradient id={`${id}-trim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={armorB} />
          <stop offset="100%" stopColor={armorA} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={term ? "#ff2d46" : glow} stopOpacity=".9" />
          <stop offset="55%" stopColor={glow} stopOpacity=".15" />
          <stop offset="100%" stopColor={accent} stopOpacity=".75" />
        </linearGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="40%" stopColor={glow} />
          <stop offset="100%" stopColor={accent} stopOpacity=".85" />
        </linearGradient>
      </defs>

      <g transform={headOnly || bh === 1 ? undefined : `translate(60 396) scale(${bh}) translate(-60 -396)`}>
        {!headOnly && <ellipse cx="60" cy="396" rx={(chibi ? 46 : 42) * bw} ry="8.5" fill={`url(#${id}-gnd)`} />}
        <g transform={headOnly || bw === 1 ? undefined : `translate(60 88) scale(${bw} 1) translate(-60 -88)`}>
        {/* ── body ──
            The same three-view treatment as the head, for the same reason: a
            front-facing torso squashed sideways reads as a plank, so the figure
            carries a drawn side view that takes over as it turns. Arms hang in
            the silhouette rather than orbiting as separate parts, which is what
            keeps the shoulders attached at every angle. */}
        {!headOnly && chibi && <>
          {/* ── chibi build ──
              Two and a bit heads tall, all curves, stubby mitts and little
              boots. The cute models are not the tall chassis with a friendlier
              face painted on: making them cute meant changing the skeleton,
              because proportion reads first and it reads before any detailing
              does. The chassis stays the model's own material so a pink bot
              does not end up with gunmetal hands; the worn outfit shows through
              in the collar, belt and cuffs instead. */}
          {ws > 0.02 && (
            <g opacity={ws.toFixed(3)} transform={`translate(${(cxs - 60).toFixed(2)} 0)${dir < 0 ? " translate(120 0) scale(-1 1)" : ""}`}>
              <g opacity=".55">
                {plate("M38 154 C31 158 30 190 34 206 C37 216 50 218 53 208 C56 196 55 168 52 156 Z")}
                {plate("M50 214 C41 214 36 222 36 230 C36 239 43 245 51 245 C58 245 62 238 62 230 C62 221 57 214 50 214 Z")}
                {plate("M40 288 C36 292 35 330 37 350 C38 360 52 361 54 351 C57 332 56 294 53 288 Z")}
                {plate("M56 374 C44 374 36 380 36 384 C36 389 44 392 56 392 C70 392 78 388 78 383 C78 378 68 374 56 374 Z")}
              </g>
              {plate("M60 116 C84 116 95 141 95 182 L93 246 C91 277 79 293 60 293 C41 293 30 277 28 246 L26 182 C26 141 36 116 60 116 Z", { lw: 1.3 })}
              {plate("M46 152 C39 156 38 190 42 208 C45 218 60 220 63 209 C66 196 64 166 61 154 Z")}
              {plate("M58 216 C48 216 43 224 43 232 C43 242 51 248 59 248 C67 248 71 240 71 232 C71 222 66 216 58 216 Z")}
              {plate("M48 288 C44 292 43 332 45 352 C46 362 61 363 63 353 C66 334 65 294 62 288 Z")}
              {plate("M64 374 C51 374 42 380 42 385 C42 390 51 393 64 393 C79 393 88 389 88 384 C88 378 78 374 64 374 Z")}
              <path d="M40 130 Q60 121 82 132" fill="none" stroke={bTrim} strokeWidth="5.5" strokeLinecap="round" />
              {groove("M42 262 Q60 272 80 262", 1.4, .45)}
              <g opacity={profArt.toFixed(3)}>
                <ellipse cx="74" cy="206" rx="14" ry="27" fill="#ffffff" opacity=".2" />
                <circle cx="82" cy="198" r="5.4" fill="none" stroke={glow} strokeWidth="1.2" opacity=".85" />
                <circle cx="82" cy="198" r="2.1" fill={glow} className="ca-optic" />
              </g>
            </g>
          )}
          {(front > 0.01 || rear > 0.01) && (
            <g opacity={Math.max(front, rear).toFixed(3)} transform={`translate(0 ${PZ.lift})`}>
              {/* stubby arms, elbow-less, with mitten hands */}
              <g transform={rot(PZ.armL * .8, 22, 154)}>
                {plate("M18 150 C6 154 -1 174 0 198 C1 214 8 222 17 220 C24 218 26 198 25 178 C24 164 22 154 18 150 Z")}
                {/* a chibi keeps its mitt, but three soft nubs peek out from
                    under it — enough to read as a hand without giving a cute
                    build the machined fingers the tall chassis wears */}
                {[0, 1, 2].map(f => (
                  <g key={f}>{plate(`M${-1 + f * 8} 240 L${-1 + f * 8} 250 C${-1 + f * 8} 255 ${5 + f * 8} 255 ${5 + f * 8} 250 L${5 + f * 8} 240 Z`, { lw: .7, deep: .8 })}</g>))}
                {plate("M9 214 C1 214 -4 222 -4 231 C-4 241 3 248 11 248 C20 248 25 240 25 230 C25 220 18 214 9 214 Z")}
                {castOn("M18 150 C6 154 -1 174 0 198 C1 214 8 222 17 220 C24 218 26 198 25 178 C24 164 22 154 18 150 Z", .55)}
              </g>
              <g transform={rot(-PZ.armR * .8, 98, 154)}>
                {plate("M102 150 C114 154 121 174 120 198 C119 214 112 222 103 220 C96 218 94 198 95 178 C96 164 98 154 102 150 Z")}
                {[0, 1, 2].map(f => (
                  <g key={f}>{plate(`M${121 - f * 8} 240 L${121 - f * 8} 250 C${121 - f * 8} 255 ${115 - f * 8} 255 ${115 - f * 8} 250 L${115 - f * 8} 240 Z`, { lw: .7, deep: .8 })}</g>))}
                {plate("M111 214 C119 214 124 222 124 231 C124 241 117 248 109 248 C100 248 95 240 95 230 C95 220 102 214 111 214 Z")}
                {castOn("M102 150 C114 154 121 174 120 198 C119 214 112 222 103 220 C96 218 94 198 95 178 C96 164 98 154 102 150 Z", .55)}
              </g>
              <g transform={rot(PZ.lean, 60, 280)}>
              {/* barrel body */}
              {plate("M60 116 C89 116 103 141 103 182 L101 246 C99 278 82 294 60 294 C38 294 21 278 19 246 L17 182 C17 141 31 116 60 116 Z", { lw: 1.4 })}
              {/* a chibi head is nearly half the figure, so the shadow it drops
                  is the single biggest depth cue on the whole build */}
              {castOn("M60 116 C89 116 103 141 103 182 L101 246 C99 278 82 294 60 294 C38 294 21 278 19 246 L17 182 C17 141 31 116 60 116 Z", .95)}
              </g>
              {/* little boots, each on its own hip */}
              <g transform={rot(PZ.legL * .7, 45, 290)}>
                {plate("M34 288 C29 294 28 336 30 358 C31 372 55 373 57 360 C60 338 59 294 55 288 Z")}
                {castOn("M34 288 C29 294 28 336 30 358 C31 372 55 373 57 360 C60 338 59 294 55 288 Z", .55)}
                {plate("M42 368 C28 368 19 377 19 384 C19 391 29 394 43 394 C57 394 66 391 66 384 C66 377 56 368 42 368 Z")}
                {/* the toe cap, cut in rather than bolted on: a filled band
                    across a soft boot reads as a stripe, a seam reads as a toe */}
                {groove("M21 383 C27 390 58 390 64 383", 1.2, .42)}
              </g>
              <g transform={rot(-PZ.legR * .7, 75, 290)}>
                {plate("M65 288 C61 294 60 336 63 358 C64 372 88 373 90 360 C92 338 91 294 86 288 Z")}
                {castOn("M65 288 C61 294 60 336 63 358 C64 372 88 373 90 360 C92 338 91 294 86 288 Z", .55)}
                {plate("M78 368 C64 368 55 377 55 384 C55 391 64 394 78 394 C92 394 101 391 101 384 C101 377 92 368 78 368 Z")}
                {groove("M57 383 C63 390 94 390 100 383", 1.2, .42)}
              </g>
              <g transform={rot(PZ.lean, 60, 280)}>
              <path d="M18 206 h13 M89 206 h13" stroke={bTrim} strokeWidth="5.5" strokeLinecap="round" />
              <path d="M34 348 h23 M65 348 h23" stroke={bTrim} strokeWidth="5.5" strokeLinecap="round" />
              {/* collar: where the worn outfit shows on a chibi */}
              <path d="M37 132 Q60 122 83 132" fill="none" stroke={bTrim} strokeWidth="5" strokeLinecap="round" opacity=".85" />
              <g opacity={front.toFixed(3)}>
                <ellipse cx="60" cy="208" rx="33" ry="38" fill="#ffffff" opacity=".14" />
                <ellipse cx="60" cy="208" rx="33" ry="38" fill={`url(#${id}-spec)`} />
                <ellipse cx="60" cy="208" rx="33" ry="38" fill="none" stroke={glow} strokeWidth="1.1" opacity=".8" />
                {/* a chibi has no shoulder to hang a crest on, so the class rides
                    on its chest instead */}
                {plate("M60 140 L71 149 L60 165 L49 149 Z", { fill: `url(#${id}-cls)`, line: mixc(CC, "#000814", .5), lw: 1 })}
                <ellipse cx="60" cy="208" rx="38" ry="43" fill="none" stroke={CC} strokeWidth="1.4" opacity=".6" />
                <g className="ca-core">
                  <circle cx="60" cy="208" r="15" fill="none" stroke={glow} strokeWidth="1.5" opacity=".95" />
                  <circle cx="60" cy="208" r="11.5" fill={glow} opacity=".14" />
                  <path d="M60 195 L73 208 L60 221 L47 208 Z" fill={`url(#${id}-visor)`} />
                  <circle cx="60" cy="208" r="5.4" fill="#fff" opacity=".95" />
                  <circle cx="56.8" cy="204.4" r="2.1" fill="#fff" opacity=".8" />
                </g>
                {groove("M34 264 Q60 276 86 264", 1.4, .4)}
                <ellipse cx="42" cy="379" rx="11" ry="5" fill="#ffffff" opacity=".35" />
                <ellipse cx="78" cy="379" rx="11" ry="5" fill="#ffffff" opacity=".35" />
              </g>
              <g opacity={rear.toFixed(3)}>
                {groove("M60 130 L60 282", 2.4, .5)}
                {plate("M42 158 L78 158 C81 158 82 160 82 163 L82 200 C82 203 81 205 78 205 L42 205 C39 205 38 203 38 200 L38 163 C38 160 39 158 42 158 Z", { fill: bTrim, line: glow, lw: 1.1 })}
                {groove("M48 170 L72 170 M48 181 L72 181 M48 192 L72 192", 1.5, .5)}
                <circle cx="60" cy="232" r="6.4" fill="none" stroke={glow} strokeWidth="1.3" opacity=".75" />
                <circle cx="60" cy="232" r="2.6" fill={glow} className="ca-optic" />
                {groove("M34 264 Q60 274 86 264", 1.4, .4)}
              </g>
              </g>
            </g>
          )}
        </>}

        {!headOnly && !chibi && <>
          {/* ── hero build ──
              The same three-view treatment as the head, for the same reason: a
              front-facing torso squashed sideways reads as a plank, so the
              figure carries a drawn side view that takes over as it turns. Arms
              hang in the silhouette rather than orbiting as separate parts,
              which is what keeps the shoulders attached at every angle — and
              every plate is articulated at the joint it actually bends on:
              pauldron, bicep, elbow actuator, forearm, hand; hip, thigh, knee,
              shin, ankle, boot. */}
          {ws > 0.02 && (
            <g opacity={ws.toFixed(3)} transform={`translate(${(cxs - 60).toFixed(2)} 0)${dir < 0 ? " translate(120 0) scale(-1 1)" : ""}`}>
              {/* far arm and far leg, behind the body */}
              <g opacity=".55">
                {plate("M50 104 C44 114 43 132 45 150 L61 152 C63 134 63 116 62 106 Z")}
                {plate("M46 156 L61 158 L59 214 L48 212 Z")}
                {plate("M47 212 L59 214 L59 234 C54 241 48 240 46 233 Z")}
                {plate("M45 240 L64 240 L62 302 L47 302 Z")}
                {plate("M48 304 L62 304 L60 364 L50 364 Z")}
                {plate("M46 360 L60 360 L74 378 L74 391 L43 391 L43 375 Z")}
              </g>
              {/* torso, seen edge-on: chest forward, shoulder blade back */}
              {plate("M60 84 C71 84 79 92 82 102 L86 126 L84 156 L78 194 L42 194 L38 156 L38 126 L42 102 C46 92 52 84 60 84 Z", { lw: 1.2 })}
              {plate("M43 190 L79 190 L83 220 L77 248 L45 248 L39 220 Z", { fill: bTrim, lw: 1 })}
              {/* near arm, in front of the chest */}
              {plate("M52 100 C46 110 45 130 47 150 L65 153 C67 134 67 114 66 102 Z")}
              {joint(56, 155, 11)}
              {plate("M48 158 L64 161 L62 216 L51 214 Z")}
              {plate("M50 214 L62 217 L62 238 C57 245 51 244 49 237 Z", { fill: bTrim })}
              {/* near leg */}
              {plate("M49 240 L71 240 L69 302 L51 302 Z")}
              {joint(60, 303, 13)}
              {plate("M52 304 L68 304 L66 364 L54 364 Z")}
              {plate("M50 360 L66 360 L81 378 L81 391 L48 391 L48 375 Z", { fill: bTrim })}
              <g opacity={profArt.toFixed(3)}>
                {plate("M46 96 L36 104 L36 128 L48 122 Z", { fill: bTrim, line: glow, lw: 1 })}
                {groove("M44 132 Q60 140 80 134 M46 160 Q60 166 78 160", 1, .5)}
                <circle cx="80" cy="128" r="5" fill="none" stroke={term ? "#ff2d46" : glow} strokeWidth="1.2" opacity=".85" />
                <circle cx="80" cy="128" r="2" fill={term ? "#ff2d46" : glow} className="ca-optic" />
              </g>
            </g>
          )}
          {(front > 0.01 || rear > 0.01) && (
            <g opacity={Math.max(front, rear).toFixed(3)} transform={`translate(0 ${PZ.lift})`}>
              {/* arms swing from the shoulder; the whole limb is one group so
                  bicep, elbow, forearm and hand travel together */}
              <g transform={rot(PZ.armL, 24, 108)}>
                {plate("M20 104 C11 114 7 134 9 156 L29 159 C32 138 33 116 33 106 Z", { deep: .9 })}
                {/* the pauldron sits over this bicep, so the bicep wears its shadow */}
                {castOn("M20 104 C11 114 7 134 9 156 L29 159 C32 138 33 116 33 106 Z", .85)}
                {joint(19, 158, 13)}
                {pivot(19, 158, 6.2)}
                {plate("M10 160 L30 163 L28 218 L14 216 Z", { deep: .9 })}
                {castOn("M10 160 L30 163 L28 218 L14 216 Z", .45)}
                {groove("M13 176 L27 178 M13 192 L27 194", .9, .3)}
                {plate("M11 214 L30 217 L29 227 L11 224 Z", { fill: bTrim, deep: .9 })}
                {/* a hand, not a mitt: palm, three fingers, a thumb */}
                {plate("M12 226 L29 229 L28 239 L13 237 Z", { deep: .9 })}
                {[0, 1, 2].map(f => (
                  <g key={f}>{plate(`M${13.5 + f * 5} ${237 + f * .4} L${17.6 + f * 5} ${237.6 + f * .4} L${17.2 + f * 5} ${248 - f * 1.2} C${15.6 + f * 5} ${251 - f * 1.2} ${13.6 + f * 5} ${250.6 - f * 1.2} ${13.2 + f * 5} ${247.6 - f * 1.2} Z`, { lw: .8, deep: .9 })}</g>))}
                {plate("M11 230 L14.2 230.4 L13.2 241 C11.8 243.6 9.2 243.2 8.8 240.6 Z", { lw: .8, deep: .9 })}
              </g>
              <g transform={rot(-PZ.armR, 96, 108)}>
                {plate("M100 104 C109 114 113 134 111 156 L91 159 C88 138 87 116 87 106 Z", { deep: .9 })}
                {castOn("M100 104 C109 114 113 134 111 156 L91 159 C88 138 87 116 87 106 Z", .85)}
                {joint(101, 158, 13)}
                {pivot(101, 158, 6.2)}
                {plate("M110 160 L90 163 L92 218 L106 216 Z", { deep: .9 })}
                {castOn("M110 160 L90 163 L92 218 L106 216 Z", .45)}
                {groove("M107 176 L93 178 M107 192 L93 194", .9, .3)}
                {plate("M109 214 L90 217 L91 227 L109 224 Z", { fill: bTrim, deep: .9 })}
                {plate("M108 226 L91 229 L92 239 L107 237 Z", { deep: .9 })}
                {[0, 1, 2].map(f => (
                  <g key={f}>{plate(`M${106.5 - f * 5} ${237 + f * .4} L${102.4 - f * 5} ${237.6 + f * .4} L${102.8 - f * 5} ${248 - f * 1.2} C${104.4 - f * 5} ${251 - f * 1.2} ${106.4 - f * 5} ${250.6 - f * 1.2} ${106.8 - f * 5} ${247.6 - f * 1.2} Z`, { lw: .8, deep: .9 })}</g>))}
                {plate("M109 230 L105.8 230.4 L106.8 241 C108.2 243.6 110.8 243.2 111.2 240.6 Z", { lw: .8, deep: .9 })}
              </g>
              {/* pauldrons ride the shoulder line, so they take the same lean */}
              <g transform={rot(PZ.lean, 60, 200)}>
              {/* spaulders: a domed cap that wraps the shoulder ball, with a trim
                  lame under its lip. The flat outward crescent this replaces read
                  as a paper wing pinned on beside the arm rather than armour
                  sitting over it. */}
              {plate("M38 90 C24 87 12 94 6 106 C2 115 1 126 3 135 C11 139 21 138 28 132 C32 125 35 114 38 103 Z", { lw: 1.2 })}
              {plate("M4 133 C12 138 22 137 29 130 L31 139 C23 147 12 148 3 143 Z", { fill: bTrim, line: glow, lw: 1 })}
              {groove("M11 101 C19 95 29 93 36 96", 1.2, .5)}
              {plate("M82 90 C96 87 108 94 114 106 C118 115 119 126 117 135 C109 139 99 138 92 132 C88 125 85 114 82 103 Z", { lw: 1.2 })}
              {plate("M116 133 C108 138 98 137 91 130 L89 139 C97 147 108 148 117 143 Z", { fill: bTrim, line: glow, lw: 1 })}
              {groove("M109 101 C101 95 91 93 84 96", 1.2, .5)}
              {/* rim rivets: the cheapest detail that tells a plate from a blob */}
              <g opacity=".45" fill="#0a1220">
                <circle cx="8.5" cy="112" r="1.25" /><circle cx="6.5" cy="125" r="1.25" /><circle cx="17" cy="100" r="1.25" />
                <circle cx="111.5" cy="112" r="1.25" /><circle cx="113.5" cy="125" r="1.25" /><circle cx="103" cy="100" r="1.25" />
              </g>
              {(() => {
                const crest = (
                  <>
                    {plate(KIT.sh, { fill: `url(#${id}-cls)`, line: mixc(CC, "#000814", .5), lw: 1 })}
                    {KIT.tip && <circle cx={KIT.tip[0]} cy={KIT.tip[1]} r="2.4" fill={mixc(CC, "#ffffff", .55)} className="ca-optic" />}
                  </>
                );
                return <>{crest}<g transform="translate(120 0) scale(-1 1)">{crest}</g></>;
              })()}
              <circle cx="14" cy="118" r="2.9" fill={CC} className="ca-optic" />
              <circle cx="106" cy="118" r="2.9" fill={CC} className="ca-optic" />
              {/* chest shell, then the pectoral plates that sit on it */}
              {plate("M60 84 C73 84 84 91 92 101 L98 126 L95 155 L60 163 L25 155 L22 126 L28 101 C36 91 47 84 60 84 Z", { lw: 1.3 })}
              {plate("M56 96 C45 96 35 104 31 117 L33 142 C42 151 50 154 56 155 Z")}
              {plate("M64 96 C75 96 85 104 89 117 L87 142 C78 151 70 154 64 155 Z")}
              {/* collar ring — without it the neck just rests on the chest */}
              {plate("M44 86 C44 79 76 79 76 86 C76 95 69 100 60 100 C51 100 44 95 44 86 Z", { fill: bTrim, line: glow, lw: 1 })}
              {/* the chin's shadow, landing on the chest shell that catches it —
                  the contact that sells the head as sitting ON the body */}
              {castOn("M60 84 C73 84 84 91 92 101 L98 126 L95 155 L60 163 L25 155 L22 126 L28 101 C36 91 47 84 60 84 Z", .8)}
              {/* abdominal bands */}
              {plate("M27 156 C42 162 78 162 93 156 L90 171 C76 176 44 176 30 171 Z", { fill: bTrim })}
              {plate("M30 173 C43 178 77 178 90 173 L87 188 C75 192 45 192 33 188 Z", { fill: bTrim })}
              </g>
              {/* pelvis and hip plates — planted, so the lean reads as a lean */}
              {plate("M32 187 L88 187 L92 217 L86 248 L34 248 L28 217 Z", { lw: 1.1 })}
              {plate("M31 195 C38 193 45 194 49 197 L47 231 C41 231 36 229 34 226 Z", { fill: bTrim })}
              {plate("M89 195 C82 193 75 194 71 197 L73 231 C79 231 84 229 86 226 Z", { fill: bTrim })}
              {castOn("M32 187 L88 187 L92 217 L86 248 L34 248 L28 217 Z", .7)}
              {/* the pelvic latch: the one place on a machine where the top
                  half is bolted to the bottom half, and the last flat span on
                  the chassis that had nothing on it at all. A buckle belongs
                  on the front, so it is scoped there — and the back gets the
                  lumbar column it was owed instead. */}
              <g opacity={front.toFixed(3)}>
                {plate("M52 206 L68 206 L70 222 L60 230 L50 222 Z", { fill: bTrim, lw: .9, deep: .8 })}
                {groove("M54 212 L66 212 M55 218 L65 218", .9, .34)}
              </g>
              <g opacity={rear.toFixed(3)}>
                {plate("M54 196 L66 196 L67 236 L53 236 Z", { fill: bTrim, lw: .9, deep: .8 })}
                {groove("M56 204 L64 204 M56 213 L64 213 M56 222 L64 222 M56 231 L64 231", .9, .34)}
              </g>
              {/* hips: the last joint on the body still drawn as a plain seam.
                  Drawn under the legs so the thigh rides on the disc. */}
              {joint(46, 240, 11)}
              {joint(74, 240, 11)}
              {pivot(46, 240, 5.4)}
              {pivot(74, 240, 5.4)}
              {/* each leg swings from its own hip */}
              <g transform={rot(PZ.legL, 46, 238)}>
                {plate("M34 240 L58 240 L56 302 L37 302 Z")}
                {castOn("M34 240 L58 240 L56 302 L37 302 Z", .9)}
                {/* the quad panel: a thigh is a slab until something is bolted
                    onto it, and one inset plate does more than any number of
                    engraved lines */}
                {plate("M39 248 L53 248 L52 284 L40 284 Z", { fill: bTrim, lw: .8, deep: .8 })}
                {groove("M42 258 L50 258 M42 268 L50 268", .8, .28)}
                {joint(46, 303, 14)}
                {plate("M37 298 C41 294 51 294 55 298 C57 306 57 312 55 316 C51 320 41 320 37 316 C35 312 35 306 37 298 Z", { fill: bTrim, line: glow, lw: .9 })}
                {groove("M39 301 C43 298 49 298 53 301", .9, .5)}
                {pivot(46, 308, 4.4)}
                {plate("M36 314 L57 314 L55 366 L38 366 Z")}
                {/* the calf piston: the rod a leg actually straightens on */}
                {plate("M52.4 318 L56 318 L54.6 358 L51.4 358 Z", { fill: bTrim, lw: .7, deep: .9 })}
                {groove("M40 330 L49 330 M40 344 L49 344", .9, .3)}
                {plate("M38 352 L55 352 L54 362 L37 362 Z", { fill: bTrim, lw: .8, deep: .8 })}
                {pivot(46, 357, 4)}
                {plate("M36 360 L55 360 L60 379 L60 392 L29 392 L29 377 Z", { fill: bTrim })}
                {/* the toe cap, and the split that says the sole is a sole */}
                {plate("M29 377 L60 379 L60 386 L29 384 Z", { lw: .8, deep: .8 })}
                {plate("M29 384 L60 384 L60 392 L29 392 Z")}
                {groove("M39 385 L39 392 M50 385 L50 392", .8, .34)}
              </g>
              <g transform={rot(-PZ.legR, 74, 238)}>
                {plate("M62 240 L86 240 L83 302 L64 302 Z")}
                {castOn("M62 240 L86 240 L83 302 L64 302 Z", .9)}
                {plate("M67 248 L81 248 L80 284 L68 284 Z", { fill: bTrim, lw: .8, deep: .8 })}
                {groove("M70 258 L78 258 M70 268 L78 268", .8, .28)}
                {joint(74, 303, 14)}
                {plate("M65 298 C69 294 79 294 83 298 C85 306 85 312 83 316 C79 320 69 320 65 316 C63 312 63 306 65 298 Z", { fill: bTrim, line: glow, lw: .9 })}
                {groove("M67 301 C71 298 77 298 81 301", .9, .5)}
                {pivot(74, 308, 4.4)}
                {plate("M63 314 L84 314 L82 366 L65 366 Z")}
                {plate("M67.6 318 L64 318 L65.4 358 L68.6 358 Z", { fill: bTrim, lw: .7, deep: .9 })}
                {groove("M71 330 L80 330 M71 344 L80 344", .9, .3)}
                {plate("M82 352 L65 352 L66 362 L83 362 Z", { fill: bTrim, lw: .8, deep: .8 })}
                {pivot(74, 357, 4)}
                {plate("M84 360 L65 360 L60 379 L60 392 L91 392 L91 377 Z", { fill: bTrim })}
                {plate("M91 377 L60 379 L60 386 L91 384 Z", { lw: .8, deep: .8 })}
                {plate("M60 384 L91 384 L91 392 L60 392 Z")}
                {groove("M70 385 L70 392 M81 385 L81 392", .8, .34)}
              </g>
              <g transform={rot(PZ.lean, 60, 200)}>
              {/* chest plating and the power core — gone once the back is toward us */}
              <g opacity={front.toFixed(3)}>
                {groove("M60 88 L60 160", 1.2, .5)}
                {groove("M36 110 L53 118 M84 110 L67 118", 1, .45)}
                {groove("M38 100 L50 98 M38 105 L50 103 M38 110 L50 108", .9, .4)}
                {groove("M82 100 L70 98 M82 105 L70 103 M82 110 L70 108", .9, .4)}
                {groove("M29 164 L91 164 M32 181 L88 181", 1.1, .45)}
                {/* power routed from the core out to the shoulders and down
                    the flanks — the chassis reads as wired, not moulded */}
                {vein("M60 113 L60 96 M60 149 L60 172", 1.3)}
                {vein("M46 122 L33 112 M74 122 L87 112", 1.1)}
                {vein("M38 170 L38 186 M82 170 L82 186", 1)}
                <g className="ca-core">
                  {/* the light this core throws onto the plates around it */}
                  <circle cx="60" cy="131" r="46" fill={`url(#${id}-${term ? "bloomR" : "bloom"})`} />
                  <circle cx="60" cy="131" r="18" fill="none" stroke={CC} strokeWidth="1.6" opacity=".7" />
                  {/* bezel notches at the cardinals — a machined mount rather than
                      a ring drawn round a shape */}
                  <g stroke={CC} strokeWidth="2.2" strokeLinecap="round" opacity=".75">
                    <path d="M60 110 L60 115.5" /><path d="M60 146.5 L60 152" />
                    <path d="M39 131 L44.5 131" /><path d="M75.5 131 L81 131" />
                  </g>
                  <circle cx="60" cy="131" r="14.5" fill="#00060f" opacity=".55" />
                  <circle cx="60" cy="131" r="13" fill="none" stroke={term ? "#ff2d46" : glow} strokeWidth="1.4" opacity=".9" />
                  <circle cx="60" cy="131" r="10" fill={term ? "#ff2d46" : glow} opacity=".16" />
                  <path d="M60 119 L72 131 L60 143 L48 131 Z" fill={term ? `url(#${id}-red)` : `url(#${id}-visor)`} />
                  <circle cx="60" cy="131" r="4.8" fill="#fff" opacity=".95" />
                  <circle cx="57.2" cy="127.6" r="1.9" fill="#fff" opacity=".8" />
                </g>
                {groove("M40 254 L54 254 M66 254 L80 254", 1, .45)}
                {groove("M34 372 L54 372 M66 372 L86 372", 1, .4)}
              </g>
              {/* spine, dorsal vents and heels — what you see from behind */}
              <g opacity={rear.toFixed(3)}>
                {groove("M60 88 L60 188", 2.4, .6)}
                {plate("M45 92 L75 92 L79 118 L41 118 Z", { fill: bTrim, line: glow, lw: 1 })}
                {groove("M40 128 L80 128 M36 146 L84 146", 1.6, .5)}
                <circle cx="60" cy="105" r="3.4" fill={glow} className="ca-optic" />
                {groove("M42 262 Q46 290 44 302 M78 262 Q74 290 76 302", 1.4, .45)}
                {groove("M30 385 L58 385 M62 385 L90 385", 1.6, .45)}
              </g>
              </g>
            </g>
          )}
        </>}

        </g>{/* end body width */}

        <g transform={headOnly ? undefined : `translate(0 ${PZ.lift}) ${rot(PZ.lean, 60, chibi ? 280 : 200)} translate(60 -12) scale(${hs}) translate(-60 -3) ${rot(PZ.head, 60, 88)}`}>
        {/* ── neck ── */}
        {HEAD.neck || (chibi ? null : (
          <g transform={`translate(60 0) scale(${(0.72 + 0.28 * Math.abs(c)).toFixed(3)} 1) translate(-60 0)`}>
            <path d="M52 62 L68 62 L71 90 L49 90 Z" fill={`url(#${id}-${HEAD.neckFill || bodyKey})`} stroke="#7f8fac" strokeWidth=".7" />
            <path d="M48 84 L72 84" stroke={glow} strokeWidth="1.3" opacity=".7" />
          </g>
        ))}

        {/* ── head ── */}
        {profile}
        {rear > 0.01 && shell(<g opacity={rear.toFixed(3)}>
          <path d={HEAD.skull} fill={shellFill} stroke="none" />
          <path d={HEAD.skull} fill={`url(#${id}-occ)`} opacity=".5" />
          <path d={HEAD.skull} fill={`url(#${id}-sheen)`} opacity={HEAD.fill === "chrome" ? ".95" : ".62"} />
          <path d={HEAD.skull} fill={`url(#${id}-bnc)`} />
          <path d={HEAD.skull} fill="none" stroke={`url(#${id}-graze)`} strokeWidth="1.8" strokeLinejoin="round" opacity=".5" />
          <path d={HEAD.skull} fill="none" stroke={HEAD.line} strokeWidth="1" strokeLinejoin="round" />
          <path d={HEAD.skull} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.5" strokeLinejoin="round" />
          {HEAD.rear}
        </g>, "rear")}
        {front > 0.01 && shell(<g opacity={front.toFixed(3)}>
          {/* the head runs the same five passes as every armour plate — it was
              the one part of the figure still painted as a flat silhouette */}
          <path d={HEAD.skull} fill={shellFill} stroke="none" />
          <path d={HEAD.skull} fill={`url(#${id}-occ)`} opacity=".46" />
          <path d={HEAD.skull} fill={`url(#${id}-sheen)`} opacity={HEAD.fill === "chrome" ? ".95" : ".66"} />
          <path d={HEAD.skull} fill={`url(#${id}-bnc)`} />
          <path d={HEAD.skull} fill="none" stroke={`url(#${id}-graze)`} strokeWidth="1.8" strokeLinejoin="round" opacity=".5" />
          <path d={HEAD.skull} fill="none" stroke={HEAD.line} strokeWidth="1" strokeLinejoin="round" />
          <path d={HEAD.skull} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.5" strokeLinejoin="round" />
          {HEAD.shellArt}
        </g>, "shell")}
        {front > 0.01 && <g opacity={front.toFixed(3)}>{HEAD.art}</g>}
        </g>
      </g>
    </svg>
  );
}
