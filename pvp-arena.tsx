/* ── pvp-arena.tsx ──
   The duel the twenty chassis were built for.

   Two robots fight, but the fight is not the game — a music quiz is. Every
   round asks one question about notes, intervals, scales, chords or rhythm.
   Answer right and your chassis swings; answer wrong, or run the clock out,
   and theirs does. Answer FAST and it hits harder. So the way to win a fight
   is to know more music than the other side, which is the only reason a piano
   app should ship a battle mode at all.

   Two ways to play, and they are honestly different things:
     · vs BOT — live, right now, against a chassis with its own class skills.
     · vs PLAYER — asynchronous, exactly like every other duel in this app:
       you run the arena, your score is posted as a challenge through the
       existing duel_challenge RPC, and your friend runs the same arena. Higher
       score wins. Nothing here invents a realtime backend that does not exist.

   Skill EXP (SP) is a second, separate track from account EXP. It belongs to
   the CLASS of the chassis you are running, so a player who mains a Striker
   levels Striker — switching chassis inside a class keeps the progress, and
   switching class starts a new track. Ranks gate the skills: the passive is
   yours from rank 1, the active at rank 3, the ultimate at rank 6. ── */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { CyberAvatar, CHAR_MODELS, MODEL_COMBAT, combatOf, normalizeModel, RARITY_PTS } from "./cyber-avatar";
import { MODEL_CLASS, TIER_LABEL, classOf, classKeyOf, skillsOf } from "./model-skills";
import { ItemArt } from "./item-art";
import { petBonusOf, petById, petLevel, readPet, PetArt } from "./pet-lab";
import { createArenaAudio, useArenaFx, pickStage } from "./arena-fx";
import { AnswerReveal } from "./note-reveal";

/* ══════════════════════ Skill EXP ══════════════════════ */

const SP_KEY = "tg_skillsp";
export const RANK_MAX = 10;
// rank r → r+1 costs 120·r, so the curve is gentle early and real later
export const spForRank = (r) => 60 * r * (r - 1);
export const SKILL_UNLOCK = { passive: 1, active: 3, ultimate: 6 };

export function readSkillSp() {
  try { const v = JSON.parse(localStorage.getItem(SP_KEY) || "{}"); return v && typeof v === "object" ? v : {}; }
  catch (e) { return {}; }
}
export function writeSkillSp(v) { try { localStorage.setItem(SP_KEY, JSON.stringify(v)); } catch (e) {} }

/** Rank, and how far into it, from a raw SP total. */
export function skillRank(sp) {
  const s = Math.max(0, sp | 0);
  let r = 1;
  while (r < RANK_MAX && s >= spForRank(r + 1)) r++;
  const base = spForRank(r), next = spForRank(r + 1);
  const max = r >= RANK_MAX;
  return { rank: r, into: s - base, need: max ? 0 : next - base, pct: max ? 1 : (s - base) / (next - base), max, sp: s };
}

/** Award SP to one class. Returns the new rank so a caller can celebrate. */
export function addSkillSp(clsKey, n) {
  if (!clsKey || !n) return null;
  const all = readSkillSp();
  const before = skillRank(all[clsKey] || 0).rank;
  all[clsKey] = Math.max(0, (all[clsKey] || 0) + Math.round(n));
  writeSkillSp(all);
  const after = skillRank(all[clsKey]).rank;
  return { cls: clsKey, sp: all[clsKey], rank: after, rankedUp: after > before };
}

export function skillUnlocked(tier, rank) { return rank >= (SKILL_UNLOCK[tier] || 1); }

/* ══════════════════════ question bank ══════════════════════

   Three topics, and only three: the major scale, triads, and intervals. That
   is the ground floor of written theory and it is what a beginner at a piano
   app can actually answer. Rhythm values, modes, pentatonics and seventh
   chords were in here and made the arena a wall rather than a game.

   Every answer is spelled properly. The old version read note names straight
   out of the chromatic table, so degree 4 of F major came back as "A#" and a
   minor 6th above C came back as "G#" — both wrong, and wrong in a way that
   teaches the mistake. A note's LETTER is fixed by the interval it sits at
   (a 3rd is always two letters up, whatever its quality); the accidental is
   then whatever it takes to reach the right pitch. */

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function parseName(n) {
  const L = String(n).charAt(0).toUpperCase();
  const off = String(n).slice(1).split("").reduce((a, c) => a + (c === "#" ? 1 : c === "b" ? -1 : 0), 0);
  return { L, off, pc: ((LETTER_PC[L] || 0) + off + 120) % 12 };
}
/** The note `letterSteps` letters and `semis` semitones above `rootName`. */
function spellFrom(rootName, letterSteps, semis) {
  const r = parseName(rootName);
  const L = LETTERS[(LETTERS.indexOf(r.L) + letterSteps) % 7];
  const target = (r.pc + semis) % 12;
  let d = (target - LETTER_PC[L] + 120) % 12;
  if (d > 6) d -= 12;
  return L + (d > 0 ? "#".repeat(d) : d < 0 ? "b".repeat(-d) : "");
}
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
export const spellMajor = (root) => MAJOR_STEPS.map((s, i) => spellFrom(root, i, s));

/* Intervals carry their letter distance with them — that is what makes an
   augmented 4th spell differently from a diminished 5th at the same pitch. */
const IV_NAME = [
  { s: 1,  L: 1, th: "ไมเนอร์ 2",    en: "Minor 2nd",     zh: "小二度" },
  { s: 2,  L: 1, th: "เมเจอร์ 2",    en: "Major 2nd",     zh: "大二度" },
  { s: 3,  L: 2, th: "ไมเนอร์ 3",    en: "Minor 3rd",     zh: "小三度" },
  { s: 4,  L: 2, th: "เมเจอร์ 3",    en: "Major 3rd",     zh: "大三度" },
  { s: 5,  L: 3, th: "เพอร์เฟกต์ 4", en: "Perfect 4th",   zh: "纯四度" },
  { s: 7,  L: 4, th: "เพอร์เฟกต์ 5", en: "Perfect 5th",   zh: "纯五度" },
  { s: 8,  L: 5, th: "ไมเนอร์ 6",    en: "Minor 6th",     zh: "小六度" },
  { s: 9,  L: 5, th: "เมเจอร์ 6",    en: "Major 6th",     zh: "大六度" },
  { s: 10, L: 6, th: "ไมเนอร์ 7",    en: "Minor 7th",     zh: "小七度" },
  { s: 11, L: 6, th: "เมเจอร์ 7",    en: "Major 7th",     zh: "大七度" },
  { s: 12, L: 7, th: "ออกเทฟ",       en: "Octave",        zh: "八度" },
];
const TRIADS = [
  { k: "major", iv: [[2, 4], [4, 7]], th: "เมเจอร์",  en: "Major",      zh: "大三和弦" },
  { k: "minor", iv: [[2, 3], [4, 7]], th: "ไมเนอร์",  en: "Minor",      zh: "小三和弦" },
  { k: "dim",   iv: [[2, 3], [4, 6]], th: "ดิมินิช",  en: "Diminished", zh: "减三和弦" },
  { k: "aug",   iv: [[2, 4], [4, 8]], th: "ออกเมนต์", en: "Augmented",  zh: "增三和弦" },
];
// white-key roots only: every one of them spells cleanly with a single
// accidental at most, so no question ever shows a double sharp
const ROOTS = ["C", "D", "E", "F", "G", "A", "B"];
const DEGREE_ORD = ["", "1", "2", "3", "4", "5", "6", "7"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { const c = a.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };
const tr3 = (o, lang) => (o && (o[lang] || o.en)) || "";

/** Three distractors that are plausible for THIS question — other notes from
    the same scale, or the same interval off a neighbour — rather than three
    random chromatic names. A guessable wrong answer is what makes a right one
    worth something. */
function distract(ans, poolFn) {
  const out = [];
  for (let i = 0; i < 40 && out.length < 3; i++) {
    const c = poolFn();
    if (c && c !== ans && !out.includes(c)) out.push(c);
  }
  return out;
}

export function makeQuestion(lang, forceKind) {
  const kind = forceKind || pick(["iv", "degree", "triad", "scale"]);
  const root = pick(ROOTS);

  if (kind === "iv") {
    const iv = pick(IV_NAME);
    const ans = spellFrom(root, iv.L, iv.s);
    const wrong = distract(ans, () => { const o = pick(IV_NAME); return spellFrom(root, o.L, o.s); });
    return {
      tag: "iv",
      teach: { notes: [root, ans], hi: [ans], label: tr3(iv, lang) },
      q: lang === "th" ? `ขั้นคู่ ${tr3(iv, "th")} เหนือ ${root} คือโน้ตอะไร?`
        : lang === "zh" ? `${root} 上方的${tr3(iv, "zh")}是哪个音？`
        : `Which note is a ${tr3(iv, "en")} above ${root}?`,
      opts: shuffle([ans, ...wrong]), ans,
    };
  }
  if (kind === "degree") {
    const notes = spellMajor(root);
    const d = 2 + Math.floor(Math.random() * 6);
    const ans = notes[d - 1];
    const wrong = distract(ans, () => pick(notes));
    return {
      tag: "degree",
      teach: { notes, hi: [ans], label: `${root} major` },
      q: lang === "th" ? `โน้ตตัวที่ ${DEGREE_ORD[d]} ของบันไดเสียง ${root} เมเจอร์ คือโน้ตอะไร?`
        : lang === "zh" ? `${root} 大调音阶的第 ${d} 级是什么音？`
        : `What is note ${d} of the ${root} major scale?`,
      opts: shuffle([ans, ...wrong]), ans,
    };
  }
  if (kind === "scale") {
    // one note that does NOT belong to the scale, against three that do
    const notes = spellMajor(root);
    const ivOut = pick(IV_NAME.filter(v => !MAJOR_STEPS.includes(v.s % 12) || v.s === 12));
    const ans = spellFrom(root, ivOut.L, ivOut.s % 12);
    if (notes.includes(ans)) return makeQuestion(lang);
    const wrong = distract(ans, () => pick(notes.slice(1)));
    return {
      tag: "scale",
      teach: { notes: notes.concat([ans]).sort((a, b) => LETTERS.indexOf(a[0]) - LETTERS.indexOf(b[0])), hi: [ans], bad: [ans], label: `${root} major` },
      q: lang === "th" ? `โน้ตใดไม่ได้อยู่ในบันไดเสียง ${root} เมเจอร์?`
        : lang === "zh" ? `哪个音不在 ${root} 大调音阶中？`
        : `Which note is NOT in the ${root} major scale?`,
      opts: shuffle([ans, ...wrong]), ans,
    };
  }
  const t = pick(TRIADS);
  const notes = [root, ...t.iv.map(([L, sm]) => spellFrom(root, L, sm))];
  const ans = tr3(t, lang);
  const wrong = TRIADS.filter(x => x.k !== t.k).map(x => tr3(x, lang));
  return {
    tag: "triad",
    teach: { notes, hi: notes, label: `${root} ${tr3(t, "en")}` },
    q: lang === "th" ? `โน้ต ${notes.join(" – ")} รวมกันเป็นคอร์ดชนิดใด?`
      : lang === "zh" ? `${notes.join(" – ")} 组成什么和弦？`
      : `${notes.join(" – ")} together make which chord?`,
    opts: shuffle([ans, ...wrong]), ans,
  };
}

/* ══════════════════════ class mechanics ══════════════════════

   Twenty models, sixty named skills, seven sets of mechanics. Two models of
   the same class fight the same WAY — what differs is the name on the button
   and the stat line underneath, which is exactly the promise the shop makes
   ("Striker" is a fighting style, not a paint job). Keeping mechanics at the
   class level is also the only version of this that stays balanced: sixty
   bespoke rules is sixty places for one of them to be strictly best. */
export const CLASS_FX = {
  striker:   { passive: "power",     active: "crit",    ult: "triple" },
  bulwark:   { passive: "tough",     active: "block",   ult: "fortress" },
  ghost:     { passive: "evade",     active: "cull",    ult: "phase" },
  tactician: { passive: "grace",     active: "reroll",  ult: "foresee" },
  engineer:  { passive: "repair",    active: "patch",   ult: "overhaul" },
  herald:    { passive: "resonate",  active: "anthem",  ult: "crescendo" },
  virtuoso:  { passive: "streak",    active: "sustain", ult: "finale" },
};
const FX_TEXT = {
  power:     { th: "ดาเมจ +25% ตลอดเวลา",   en: "+25% damage, always",         zh: "伤害恒定 +25%" },
  tough:     { th: "รับดาเมจน้อยลง 25%",    en: "Take 25% less damage",        zh: "受到伤害减少 25%" },
  evade:     { th: "มีโอกาส 20% หลบได้",    en: "20% chance to dodge a hit",   zh: "20% 几率闪避" },
  grace:     { th: "ตอบผิดครั้งแรกไม่โดนตี",  en: "Your first wrong answer is free", zh: "首次答错不受伤害" },
  repair:    { th: "ตอบถูกฟื้น HP 3",        en: "Heal 3 HP per correct answer", zh: "答对回复 3 点 HP" },
  resonate:  { th: "เกจสกิลเต็มเร็วขึ้น 30%", en: "Skill gauge fills 30% faster", zh: "技能槽充能快 30%" },
  streak:    { th: "โบนัสคอมโบแรงเป็น 2 เท่า", en: "Combo bonus counts double",  zh: "连击加成翻倍" },
  crit:      { th: "หมัดต่อไปแรง 2.2 เท่า",   en: "Next hit deals 2.2×",         zh: "下一击造成 2.2 倍伤害" },
  block:     { th: "กันดาเมจครั้งถัดไปทั้งหมด", en: "Block the next hit entirely", zh: "完全格挡下一次攻击" },
  cull:      { th: "ตัดตัวเลือกผิดทิ้ง 2 ข้อ", en: "Strip two wrong options",     zh: "移除两个错误选项" },
  reroll:    { th: "เปลี่ยนคำถามข้อนี้",       en: "Swap this question for another", zh: "更换本题" },
  patch:     { th: "ฟื้น HP 22",             en: "Repair 22 HP",                zh: "修复 22 点 HP" },
  anthem:    { th: "3 หมัดถัดไปแรงขึ้น 40%",  en: "Next 3 hits deal +40%",       zh: "接下来 3 击伤害 +40%" },
  sustain:   { th: "ตอบผิดครั้งหน้าคอมโบไม่ขาด", en: "Keep your combo through one miss", zh: "下次答错不断连击" },
  triple:    { th: "โจมตี 3 ครั้ง ครั้งละ 40%", en: "Three strikes at 40% each",  zh: "三连击，每击 40%" },
  fortress:  { th: "กันดาเมจ 3 รอบ",          en: "Block all damage for 3 rounds", zh: "3 回合内免疫伤害" },
  phase:     { th: "หลบทุกหมัด 2 รอบ",        en: "Dodge everything for 2 rounds", zh: "2 回合内完全闪避" },
  foresee:   { th: "ตอบข้อถัดไปถูกอัตโนมัติ",  en: "Auto-answer the next question", zh: "下一题自动答对" },
  overhaul:  { th: "ฟื้น HP 45",              en: "Repair 45 HP",                zh: "修复 45 点 HP" },
  crescendo: { th: "ดาเมจ 20% ของเลือดเต็มคู่ต่อสู้", en: "Deal 20% of their max HP", zh: "造成对手最大 HP 的 20%" },
  finale:    { th: "ดาเมจตามคอมโบที่สะสมไว้",  en: "Damage scales with your combo", zh: "伤害随连击成长" },
};

/* ── stage effects ──
   arena-fx.tsx already draws ten distinct rooms; picking one used to be pure
   decoration. Each now carries a small, honest trade-off in the fight
   itself, keyed by the same stage id pickStage() already returns. */
const STAGE_FX = {
  grid:    { gauge: 1.08 },
  magma:   { dmgDeal: 1.08, dmgTake: 1.08 },
  frost:   { dmgDeal: 0.92, dmgTake: 0.85 },
  ashfall: { comboGrowth: 1.15, comboFullReset: true },
  void:    { critChance: 0.12, hpMax: 0.90 },
  bloom:   { healPerCorrect: 0.02 },
  gilt:    { scoreMul: 1.15, dmgDeal: 0.92 },
  tide:    { dmgDeal: 0.90, botGap: 1.12 },
  requiem: { gauge: 1.15, dmgTake: 1.08 },
  dojo:    { meleeDmg: 1.15 },
};
const STAGE_FX_LABEL = {
  grid:    { th: "เกจสกิล +8%", en: "Skill gauge +8%", zh: "技能槽 +8%" },
  magma:   { th: "ดาเมจ +8% · รับดาเมจ +8%", en: "+8% dmg dealt · +8% dmg taken", zh: "伤害+8% · 承伤+8%" },
  frost:   { th: "ดาเมจ -8% · รับดาเมจ -15%", en: "-8% dmg dealt · -15% dmg taken", zh: "伤害-8% · 承伤-15%" },
  ashfall: { th: "คอมโบโต +15% แต่โดนตีคอมโบหลุดหมด", en: "+15% combo growth, hits fully reset combo", zh: "连击成长+15%，但被击中连击清零" },
  void:    { th: "คริติคอล +12% · เลือดสูงสุด -10%", en: "+12% crit chance · -10% max HP", zh: "暴击+12% · 最大HP-10%" },
  bloom:   { th: "ฟื้น HP เมื่อตอบถูก", en: "Heals HP on correct answers", zh: "答对时回复HP" },
  gilt:    { th: "คะแนน +15% · ดาเมจ -8%", en: "+15% score · -8% dmg dealt", zh: "分数+15% · 伤害-8%" },
  tide:    { th: "ทุกอย่างช้าลงใต้น้ำ", en: "Everything slows underwater", zh: "水下万物变慢" },
  requiem: { th: "เกจสกิล +15% · รับดาเมจ +8%", en: "+15% gauge · +8% dmg taken", zh: "技能槽+15% · 承伤+8%" },
  dojo:    { th: "ดาเมจระยะประชิด +15%", en: "+15% melee damage", zh: "近战伤害+15%" },
};
const stageFx = (arena) => STAGE_FX[arena && arena.id] || {};

/* ── class triangle ──
   Seven classes, one ring: each beats the class ahead of it and loses to the
   one behind. A small nudge rather than a hard counter — the quiz still
   decides the fight, this only decides how much a guess costs either way. */
const CLASS_RING = ["bulwark", "striker", "ghost", "virtuoso", "engineer", "herald", "tactician"];
function classMatchup(mine, theirs) {
  const i = CLASS_RING.indexOf(mine), j = CLASS_RING.indexOf(theirs);
  if (i < 0 || j < 0 || i === j) return 0;
  const n = CLASS_RING.length;
  if ((j - i + n) % n === 1) return 1;    // mine beats theirs
  if ((i - j + n) % n === 1) return -1;   // theirs beats mine
  return 0;
}
const MATCHUP_DMG = 0.10;

/* ── weak-spot tracking ──
   The three question kinds (interval / scale degree / triad / off-scale
   note) already carry a `tag`. Recording a miss per tag and biasing the next
   pick toward the worst one means winning a fight also means drilling
   whatever the player actually gets wrong, instead of an even random split
   that never notices a real weak spot. */
const WEAK_KEY = "tg_pvp_weak";
function readWeak() { try { const v = JSON.parse(localStorage.getItem(WEAK_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
function bumpWeak(tag, right) {
  try {
    const v = readWeak();
    const t = v[tag] || { right: 0, wrong: 0 };
    if (right) t.right++; else t.wrong++;
    v[tag] = t;
    localStorage.setItem(WEAK_KEY, JSON.stringify(v));
  } catch (e) {}
}
const Q_TAGS = ["iv", "degree", "scale", "triad"];
function weightedTag() {
  const v = readWeak();
  const weights = Q_TAGS.map(t => {
    const s = v[t];
    if (!s || s.right + s.wrong < 3) return 1;         // not enough data yet
    return 0.6 + (s.wrong / (s.right + s.wrong)) * 2.4;  // worse accuracy → more likely
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < Q_TAGS.length; i++) { r -= weights[i]; if (r <= 0) return Q_TAGS[i]; }
  return Q_TAGS[Q_TAGS.length - 1];
}

/* ══════════════════════ item effects ══════════════════════

   combatOf() already turns gear into flat stat points by rarity; this turns
   the SAME gear into a genuinely different FEEL by what it visually IS.
   Every weapon/outfit/hat/accessory already carries an `art` key naming its
   look — grouping those into a handful of honest archetypes (a blade fights
   differently from a blaster, heavy plating differently from light) is the
   only version of "distinct effects" that stays hand-verifiable: one number
   per archetype, scaled by the same RARITY_PTS combatOf() already uses,
   rather than ninety bespoke numbers nobody could balance or remember. */
const WPN_ARCHETYPE = {
  // blade — melee weight: swords, cutters, hammers, tools, claws
  sword: "blade", cutter: "blade", greatsword: "blade", hammer: "blade", multitool: "blade",
  boomerang: "blade", wrench: "blade", driver: "blade", arm: "blade", magnet: "blade",
  // blaster — directed energy, fired at range
  torch: "blaster", beam: "blaster", blaster: "blaster", barrier: "blaster", piston: "blaster", railgun: "blaster",
  // ordnance — heavy and slow, the family the rocket already belongs to
  lance: "ordnance", charge: "ordnance", grenade: "ordnance", coil: "ordnance", reactor: "ordnance", burst: "ordnance",
  // support — the music bench: nothing here throws a punch, it feeds the gauge
  fork: "support", pendulum: "support", baton: "support", disc: "support", keytar: "support", speaker: "support",
};
const WPN_ARCHETYPE_ORDER = ["blade", "blaster", "ordnance", "support"];
function wpnArchetype(art) {
  if (WPN_ARCHETYPE[art]) return WPN_ARCHETYPE[art];
  const m = /^pw-(\d)/.exec(art || "");
  return m ? WPN_ARCHETYPE_ORDER[Number(m[1]) % 4] : null;
}
const OUT_ARCHETYPE = {
  "out-tshirt": "light", "out-hoodie": "light", "out-alloy": "light", "out-carbon": "light",
  "out-kimono": "elemental", "out-cryo": "elemental", "out-magma": "elemental",
  "out-armor": "heavy", "out-tuxedo": "heavy", "out-royal": "heavy", "out-titan": "heavy",
  "out-dress": "prestige", "out-celestial": "prestige", "out-prism": "prestige",
};
const OUT_ARCHETYPE_ORDER = ["light", "elemental", "heavy", "prestige"];
function outArchetype(art) {
  if (OUT_ARCHETYPE[art]) return OUT_ARCHETYPE[art];
  const m = /^pp-(\d)/.exec(art || "");
  return m ? OUT_ARCHETYPE_ORDER[Number(m[1]) % 4] : null;
}
const HAT_ARCHETYPE = {
  visor: "sensor", scope: "sensor", antenna: "sensor", satellite: "sensor", beacon: "sensor", rivets: "sensor",
  brain: "cognition", crown: "cognition", diadem: "cognition", orb: "cognition", atom: "cognition", crest: "cognition", aegis: "cognition",
  halo: "regal", sigil: "regal", mask: "regal", wreath: "regal", holo: "regal", helm: "regal",
};
const HAT_ARCHETYPE_ORDER = ["sensor", "cognition", "regal"];
function hatArchetype(art) {
  if (HAT_ARCHETYPE[art]) return HAT_ARCHETYPE[art];
  const m = /^pm-(\d)/.exec(art || "");
  return m ? HAT_ARCHETYPE_ORDER[Number(m[1]) % 3] : null;
}
const ACC_ARCHETYPE = {
  rotor: "mobility", thruster: "mobility", drone: "mobility", gyro: "mobility", vent: "mobility",
  fusion: "power", singularity: "power", battery: "power", plug: "power",
  shield: "defense", eye: "defense", limb: "defense", pad: "defense",
  chip: "utility", trail: "utility", fork: "utility", pendulum: "utility", wreath: "utility",
};
const ACC_ARCHETYPE_ORDER = ["mobility", "power", "defense", "utility"];
function accArchetype(art) {
  if (ACC_ARCHETYPE[art]) return ACC_ARCHETYPE[art];
  const m = /^pc-(\d)/.exec(art || "");
  return m ? ACC_ARCHETYPE_ORDER[Number(m[1]) % 4] : null;
}
const ITEM_FX_LABEL = {
  blade: { th: "อาวุธประชิด: ดาเมจต่อยเตะเพิ่ม", en: "Blade: bonus punch/kick damage", zh: "近战：拳踢伤害提升" },
  blaster: { th: "อาวุธระยะไกล: ดาเมจยิงเพิ่ม", en: "Blaster: bonus fire damage", zh: "远程：射击伤害提升" },
  ordnance: { th: "อาวุธหนัก: คูลดาวน์จรวดสั้นลง", en: "Ordnance: shorter rocket cooldown", zh: "重武器：火箭冷却缩短" },
  support: { th: "เครื่องดนตรี: เกจสกิลโตไวขึ้น", en: "Support: faster skill gauge", zh: "支援：技能槽增长更快" },
  light: { th: "เกราะเบา: มีโอกาสหลบ", en: "Light plating: chance to dodge", zh: "轻甲：有几率闪避" },
  elemental: { th: "เกราะธาตุ: บทลงโทษตอบผิดลดลง", en: "Elemental plating: less wrong-answer punishment", zh: "元素装甲：答错惩罚降低" },
  heavy: { th: "เกราะหนัก: ลดดาเมจที่ได้รับ", en: "Heavy plating: reduced damage taken", zh: "重甲：减少受到的伤害" },
  prestige: { th: "เกราะเกียรติยศ: ฟื้น HP เมื่อตอบถูก", en: "Prestige plating: heals on correct answers", zh: "尊贵装甲：答对回血" },
  sensor: { th: "โมดูลเซนเซอร์: โอกาสคริติคอลเพิ่ม", en: "Sensor module: bonus crit chance", zh: "传感模块：暴击几率提升" },
  cognition: { th: "โมดูลสมองกล: เริ่มไฟต์เกจไม่ว่างเปล่า", en: "Cognition module: starts fights with gauge charged", zh: "认知模块：开局技能槽预充" },
  regal: { th: "โมดูลเกียรติยศ: คอมโบโตไวขึ้น", en: "Regal module: faster combo growth", zh: "尊贵模块：连击成长更快" },
  mobility: { th: "อุปกรณ์เสริมความคล่องตัว: คูลดาวน์กระโดดสั้นลง", en: "Mobility gear: shorter jump cooldown", zh: "机动装备：跳跃冷却缩短" },
  power: { th: "อุปกรณ์เสริมพลัง: โอเวอร์ไดรฟ์แรงขึ้น", en: "Power gear: stronger overdrive", zh: "动力装备：超载伤害提升" },
  defense: { th: "อุปกรณ์เสริมป้องกัน: โอกาสกันดาเมจเต็ม", en: "Defense gear: chance to fully block", zh: "防御装备：有几率完全格挡" },
  utility: { th: "อุปกรณ์เสริมทั่วไป: คะแนนเพิ่ม", en: "Utility gear: bonus score", zh: "通用装备：分数提升" },
};
/** Aggregates every equipped item's archetype effect, scaled by rarity — the
    same RARITY_PTS combatOf() already uses for flat stats. */
export function itemEffectsOf(gear) {
  const fx = {
    meleeDmg: 1, fireDmg: 1, rocketCdMul: 1, gaugeMul: 1,
    dodge: 0, punishReduce: 0, dmgReduce: 0, healPerCorrect: 0,
    critChance: 0, gaugeStart: 0, comboGrowth: 1,
    jumpCdMul: 1, overdriveDmg: 1, blockChance: 0, scoreMul: 1,
    archetypes: [],
  };
  for (const g of gear || []) {
    if (!g || !g.id) continue;
    const pts = RARITY_PTS[g.rarity] || 1;
    let a = null;
    if (g.id.startsWith("wpn-")) {
      a = wpnArchetype(g.art);
      if (a === "blade") fx.meleeDmg += pts * 0.02;
      else if (a === "blaster") fx.fireDmg += pts * 0.02;
      else if (a === "ordnance") fx.rocketCdMul -= Math.min(0.4, pts * 0.04);
      else if (a === "support") fx.gaugeMul += pts * 0.03;
    } else if (g.id.startsWith("out-")) {
      a = outArchetype(g.art);
      if (a === "light") fx.dodge += pts * 0.015;
      else if (a === "elemental") fx.punishReduce += pts * 0.03;
      else if (a === "heavy") fx.dmgReduce += pts * 0.01;
      else if (a === "prestige") fx.healPerCorrect += pts * 0.004;
    } else if (g.id.startsWith("hat-")) {
      a = hatArchetype(g.art);
      if (a === "sensor") fx.critChance += pts * 0.01;
      else if (a === "cognition") fx.gaugeStart += pts * 2;
      else if (a === "regal") fx.comboGrowth += pts * 0.01;
    } else if (g.id.startsWith("acc-")) {
      a = accArchetype(g.art);
      if (a === "mobility") fx.jumpCdMul -= Math.min(0.4, pts * 0.03);
      else if (a === "power") fx.overdriveDmg += pts * 0.02;
      else if (a === "defense") fx.blockChance += pts * 0.01;
      else if (a === "utility") fx.scoreMul += pts * 0.02;
    }
    if (a) fx.archetypes.push(a);
  }
  fx.rocketCdMul = Math.max(0.5, fx.rocketCdMul);
  fx.jumpCdMul = Math.max(0.5, fx.jumpCdMul);
  fx.dodge = Math.min(0.35, fx.dodge);
  fx.punishReduce = Math.min(0.6, fx.punishReduce);
  fx.dmgReduce = Math.min(0.4, fx.dmgReduce);
  fx.critChance = Math.min(0.35, fx.critChance);
  fx.blockChance = Math.min(0.3, fx.blockChance);
  return fx;
}

/* HP, damage and clock come from the chassis's own combat profile — the same
   numbers the shop shows, so the stat bars on the buy screen are not
   decorative. Every chassis totals 40, so these are trade-offs, not tiers. */
export function fighterFrom(model, gear, spRank) {
  const st = combatOf(model, gear);
  const cls = classKeyOf(model);
  return {
    model, cls, st,
    maxHp: 90 + st.arm * 4,
    dmg: 5.5 + st.pwr * 0.62,
    // SPEED used to buy seconds on the answer clock. There is no clock any
    // more, so it buys a follow-up strike instead: the fast chassis gets in
    // twice before the other one has recovered.
    follow: Math.min(0.45, st.spd / 40),
    charge: 16 + st.syn,          // skill gauge gained per correct answer
    rank: spRank,
  };
}

/* ══════════════════════ the skill track ══════════════════════ */

/** The per-class SP bars, plus the door to the arena. Lives directly under the
    account EXP bar, because it is the same idea one layer down: that one is
    what the ACCOUNT has learned, this one is what the CHASSIS has. */
/** The one loud thing on the profile: everything else on this page reports on
    what the player already did, and this is the only card asking them to go
    do something. It used to live buried at the bottom of the skill card,
    which made it read as a footnote to the stat bars rather than the door it
    actually is - moved out to its own component so a caller can put it
    wherever it deserves to be seen, and given the glow/pulse treatment that
    makes it the thing the eye lands on first. */
export const PvpBanner = memo(function PvpBanner({ lang, onOpenPvp }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  return (
    <button className="profpvp" onClick={onOpenPvp}>
      <span className="profpvp-ic">⚔</span>
      <span className="profpvp-b">
        <b>{T("สนามประลอง PvP", "PvP Arena", "PvP 竞技场")}</b>
        <i>{T("เอาหุ่นยนต์ไปสู้ — ตอบคำถามดนตรีให้ไวและแม่นกว่า",
              "Send your chassis in — answer music questions faster than they do",
              "派出你的机体 — 比对手更快答对音乐题")}</i>
      </span>
      <span className="profpvp-go">→</span>
    </button>
  );
});

export const SkillTrack = memo(function SkillTrack({ lang, charModel }) {
  const [sp, setSp] = useState(() => readSkillSp());
  useEffect(() => {
    const sync = () => setSp(readSkillSp());
    window.addEventListener("tg-skillsp", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("tg-skillsp", sync); window.removeEventListener("focus", sync); };
  }, []);
  const mine = classKeyOf(normalizeModel(charModel));
  const cls = MODEL_CLASS[mine] || MODEL_CLASS.striker;
  const r = skillRank(sp[mine] || 0);
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);

  return (
    <div className="skilltrack">
      <div className="skt-hdr">
        <span className="skt-ic" style={{ "--cc": cls.c }}><ItemArt art={cls.art} sw={[cls.c, "#20263a"]} /></span>
        <span className="skt-ttl">
          <b>{T("สกิล", "SKILL", "技能")}</b>
          <i style={{ color: cls.c }}>{tr3(cls, lang)}</i>
        </span>
        <span className="skt-rank" style={{ "--cc": cls.c }}>{T("แรงก์", "RANK", "等级")} {r.rank}{r.max ? " · MAX" : ""}</span>
      </div>
      <div className="skt-bar"><div className="skt-fill" style={{ width: `${Math.round(r.pct * 100)}%`, background: `linear-gradient(90deg, ${cls.c}, ${cls.c}cc)` }} /></div>
      <div className="skt-sub">
        {r.max ? T("แรงก์สูงสุดแล้ว", "Maximum rank reached", "已达最高等级")
          : `${r.into.toLocaleString()} / ${r.need.toLocaleString()} SP → ${T("แรงก์", "rank", "等级")} ${r.rank + 1}`}
      </div>

      {/* every class keeps its own track, so switching chassis never wipes one */}
      <div className="skt-all">
        {Object.keys(MODEL_CLASS).map(k => {
          const c = MODEL_CLASS[k], rr = skillRank(sp[k] || 0);
          return (
            <div key={k} className={`skt-chip${k === mine ? " on" : ""}`} style={{ "--cc": c.c }} title={tr3(c, lang)}>
              <span className="skt-chip-ic"><ItemArt art={c.art} sw={[c.c, "#20263a"]} /></span>
              <span className="skt-chip-nm">{tr3(c, lang)}</span>
              <span className="skt-chip-bar"><i style={{ width: `${Math.round(rr.pct * 100)}%`, background: c.c }} /></span>
              <span className="skt-chip-r">{rr.rank}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ══════════════════════ the arena ══════════════════════ */

/* ══════════════════════ attack moves ══════════════════════

   A duel where every hit is the same punch stops being a fight after two
   rounds. Seven moves, each with its own stance, its own effect and its own
   sound, and each fired FROM the right part of the body — a hand blaster
   leaves the hand, an optic beam leaves the head, a cannon leaves the weapon.
   Which one a chassis reaches for is decided by its class, so a Striker
   really does close the distance and a Herald really does stand off and
   shoot: the class you bought is visible in how the robot fights, not only
   in a stat bar. */
export const MOVES = {
  punch:   { pose: "attack", part: "body",   fx: "melee",   sfx: "hit",   lunge: 1,
             th: "หมัดตรง",        en: "Strike",        zh: "直击" },
  kick:    { pose: "kick",   part: "foot",   fx: "melee",   sfx: "kick",  lunge: 1,
             th: "เตะสูง",         en: "High Kick",     zh: "高踢" },
  blaster: { pose: "shoot",  part: "hand",   fx: "bolt",    sfx: "shot",  lunge: 0,
             th: "ยิงจากมือ",      en: "Hand Blaster",  zh: "手炮" },
  laser:   { pose: "shoot",  part: "hand",   fx: "laser",   sfx: "laser", lunge: 0,
             th: "เลเซอร์จากมือ",  en: "Palm Laser",    zh: "掌心激光" },
  optic:   { pose: "beam",   part: "head",   fx: "laser",   sfx: "laser", lunge: 0,
             th: "เลเซอร์จากหัว",  en: "Optic Beam",    zh: "眼部光束" },
  cannon:  { pose: "shoot",  part: "weapon", fx: "laser",   sfx: "laser", lunge: 0,
             th: "ปืนใหญ่จากอาวุธ", en: "Weapon Cannon", zh: "武器炮击" },
  grenade: { pose: "throw",  part: "hand",   fx: "grenade", sfx: "lob",   lunge: 0,
             th: "ขว้างระเบิด",    en: "Grenade",       zh: "投掷炸弹" },
};
// what each class reaches for; repeats are weights, not typos
const CLASS_MOVES = {
  striker:   ["punch", "punch", "kick", "kick", "blaster"],
  bulwark:   ["punch", "punch", "punch", "kick", "cannon"],
  ghost:     ["kick", "kick", "blaster", "laser", "punch"],
  tactician: ["blaster", "optic", "grenade", "blaster", "kick"],
  engineer:  ["grenade", "grenade", "blaster", "cannon", "punch"],
  herald:    ["optic", "optic", "laser", "blaster", "cannon"],
  virtuoso:  ["laser", "optic", "laser", "kick", "blaster"],
};
// the one a class pulls out for its ultimate — the loudest thing it owns
const ULT_MOVE = {
  striker: "kick", bulwark: "punch", ghost: "laser", tactician: "grenade",
  engineer: "grenade", herald: "optic", virtuoso: "laser",
};
const pickMove = (clsKey) => {
  const l = CLASS_MOVES[clsKey] || CLASS_MOVES.striker;
  return l[Math.floor(Math.random() * l.length)];
};

/* Ten steps rather than three, so "Fight Mode" is a ladder a player climbs
   rather than a single wall they either clear or don't. rookie/veteran/ace
   keep the EXACT numbers the game already shipped with (acc/dmgK/rewards) at
   their new positions (Easy/Medium/Hard) - nothing anyone was already tuned
   against moves. The other seven are interpolated/extrapolated around them:
   dmgK (the bot's real damage multiplier - acc is cosmetic, see startFight)
   and BOT_GAP below (its attack cadence) are what actually makes a tier
   harder, so both climb together rather than acc alone doing the work. */
const BOT_TIERS = [
  { key: "novice",   acc: .35, dmgK: .70, th: "โหมดง่ายมาก",     en: "Very Easy Mode",   zh: "超简单模式", coins: 25,  xp: 8,   sp: 16 },
  { key: "rookie",   acc: .45, dmgK: .85, th: "โหมดง่าย",       en: "Easy Mode",        zh: "简单模式",   coins: 40,  xp: 12,  sp: 24 },
  { key: "cadet",    acc: .54, dmgK: .93, th: "โหมดค่อนข้างง่าย", en: "Fairly Easy Mode", zh: "较简单模式", coins: 60,  xp: 18,  sp: 34 },
  { key: "veteran",  acc: .62, dmgK: 1,   th: "โหมดปานกลาง",    en: "Medium Mode",      zh: "中等模式",   coins: 90,  xp: 25,  sp: 48 },
  { key: "ranger",   acc: .70, dmgK: 1.10, th: "โหมดค่อนข้างยาก", en: "Fairly Hard Mode", zh: "较困难模式", coins: 125, xp: 34,  sp: 66 },
  { key: "ace",      acc: .78, dmgK: 1.2, th: "โหมดยาก",       en: "Hard Mode",        zh: "困难模式",   coins: 180, xp: 45,  sp: 90 },
  { key: "elite",    acc: .85, dmgK: 1.35, th: "โหมดยากมาก",    en: "Very Hard Mode",   zh: "超困难模式", coins: 235, xp: 58,  sp: 118 },
  { key: "warlord",  acc: .90, dmgK: 1.50, th: "โหมดโหด",       en: "Brutal Mode",      zh: "残暴模式",   coins: 300, xp: 72,  sp: 150 },
  { key: "overlord", acc: .94, dmgK: 1.68, th: "โหมดโหดมาก",    en: "Extreme Mode",     zh: "极限模式",   coins: 380, xp: 90,  sp: 190 },
  { key: "legend",   acc: .97, dmgK: 1.90, th: "โหมดนรก",       en: "Hell Mode",        zh: "地狱模式",   coins: 480, xp: 112, sp: 240 },
];
const ROUNDS = 12;

/* A friend has a chassis we cannot read from here, so derive a stable one from
   their name: the same opponent always shows up as the same robot, which is
   what makes a rematch feel like a rematch. */
function chassisFor(seedStr) {
  let h = 0;
  for (let i = 0; i < String(seedStr).length; i++) h = (h * 31 + String(seedStr).charCodeAt(i)) >>> 0;
  return CHAR_MODELS[h % CHAR_MODELS.length].id;
}

/* ── weekly featured bot ──
   ISO-ish week key so the same seven days always resolve to the same boss,
   client-only: no server clock to disagree with, just Monday-anchored UTC
   weeks, which is close enough for a bonus that resets on its own. */
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const WEEKLY_TIERS = ["ranger", "ace", "elite", "warlord"];
function weeklyFeatured() {
  const wk = weekKey();
  let h = 0; for (let i = 0; i < wk.length; i++) h = (h * 31 + wk.charCodeAt(i)) >>> 0;
  const tier = BOT_TIERS.find(t => t.key === WEEKLY_TIERS[h % WEEKLY_TIERS.length]) || BOT_TIERS[5];
  // a different broken rule from the tier, so a week is never the same twice
  const rule = BOSS_RULE_ORDER[Math.floor(h / 7) % BOSS_RULE_ORDER.length];
  return { wk, tier, name: "WK-" + wk.slice(2), rule };
}
const WEEKLY_BADGE_KEY = "tg_pvp_weekly_badges";
function readWeeklyBadges() { try { const v = JSON.parse(localStorage.getItem(WEEKLY_BADGE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function markWeeklyBadge(wk) {
  try { const v = readWeeklyBadges(); if (!v.includes(wk)) { v.push(wk); localStorage.setItem(WEEKLY_BADGE_KEY, JSON.stringify(v)); } } catch (e) {}
}

/* ── rival ghost ──
   No live opponent data crosses a device, so the "rival" is a standing local
   opponent: rolled once and kept forever, its record tracked like a real
   rivalry, and it climbs a tier every time it loses to you so beating it
   never stops meaning something. */
const RIVAL_KEY = "tg_pvp_rival";
const RIVAL_NAMES = ["VEX", "KAI-9", "NULLA", "ORBIT", "ZETTA", "ROOK", "IVRY", "QUARK", "NYX-7", "DRIFT"];
const RIVAL_CEILING = "elite";   // tough, but never the very top — always beatable
function readRival() {
  try {
    const v = JSON.parse(localStorage.getItem(RIVAL_KEY) || "null");
    if (v && v.name && v.model && v.tierKey) return v;
  } catch (e) {}
  const model = CHAR_MODELS[Math.floor(Math.random() * CHAR_MODELS.length)].id;
  const name = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)] + "-" + (100 + Math.floor(Math.random() * 900));
  const rival = { name, model, tierKey: "cadet", w: 0, l: 0 };
  try { localStorage.setItem(RIVAL_KEY, JSON.stringify(rival)); } catch (e) {}
  return rival;
}
function saveRival(r) { try { localStorage.setItem(RIVAL_KEY, JSON.stringify(r)); } catch (e) {} }
function rivalResult(rival, won) {
  const nr = { ...rival };
  if (won) {
    nr.w++;
    const idx = BOT_TIERS.findIndex(t => t.key === nr.tierKey);
    const ceilingIdx = BOT_TIERS.findIndex(t => t.key === RIVAL_CEILING);
    if (idx >= 0 && idx < ceilingIdx) nr.tierKey = BOT_TIERS[idx + 1].key;
  } else nr.l++;
  saveRival(nr);
  return nr;
}

/* ── daily target ──
   Yesterday's best score is today's number to beat — a soft, single-device
   leaderboard with no realtime backend behind it at all. */
const DAILY_KEY = "tg_pvp_daily";
const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
function readDailyRaw() { try { const v = JSON.parse(localStorage.getItem(DAILY_KEY) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; } }
function saveDailyRaw(v) { try { localStorage.setItem(DAILY_KEY, JSON.stringify(v)); } catch (e) {} }
/** Rolls the day over if needed, then returns {target, bestToday}. */
function dailyTarget() {
  const today = todayStr();
  let v = readDailyRaw();
  if (!v || v.date !== today) {
    const target = v ? (v.bestToday || 0) : 0;
    v = { date: today, bestToday: 0, target };
    saveDailyRaw(v);
  }
  return { target: v.target || 0, bestToday: v.bestToday || 0 };
}
/** Returns true if this score set a new best for today. */
function bumpDailyBest(score) {
  const today = todayStr();
  let v = readDailyRaw();
  if (!v || v.date !== today) { dailyTarget(); v = readDailyRaw(); }
  if (score > (v.bestToday || 0)) { v.bestToday = score; saveDailyRaw(v); return true; }
  return false;
}

/* ── PvP rank ladder ──
   Separate from the account-wide League, which counts total EXP — this
   counts real wins and losses inside the arena specifically, bronze through
   diamond, the way a fighting game's own ladder would. */
export const RANK_TIERS = [
  { key: "bronze",   th: "บรอนซ์",     en: "Bronze",   zh: "青铜", min: 0,    c: "#cd7f32" },
  { key: "silver",   th: "ซิลเวอร์",   en: "Silver",   zh: "白银", min: 150,  c: "#c0c0c8" },
  { key: "gold",     th: "โกลด์",      en: "Gold",     zh: "黄金", min: 400,  c: "#ffd23f" },
  { key: "platinum", th: "แพลทินัม",   en: "Platinum", zh: "铂金", min: 800,  c: "#7fd7ff" },
  { key: "diamond",  th: "ไดมอนด์",    en: "Diamond",  zh: "钻石", min: 1400, c: "#b98cff" },
];
const RANK_KEY = "tg_pvp_rank";
export function readRankPts() { try { return Math.max(0, parseInt(localStorage.getItem(RANK_KEY) || "0", 10) || 0); } catch (e) { return 0; } }
function saveRankPts(v) { try { localStorage.setItem(RANK_KEY, String(Math.max(0, Math.round(v)))); } catch (e) {} }
export function rankOf(pts) {
  let cur = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (pts >= t.min) cur = t;
  const idx = RANK_TIERS.indexOf(cur);
  const next = RANK_TIERS[idx + 1] || null;
  return { tier: cur, next, into: pts - cur.min, need: next ? next.min - cur.min : 0, pct: next ? (pts - cur.min) / (next.min - cur.min) : 1 };
}

/* ══════════ seasons ══════════
   The ladder was one integer in localStorage that only ever went up, which
   makes it a lifetime total rather than a ladder: there was no moment where
   anybody's rank was at stake and nothing to come back for once Diamond was
   reached. Thirty-day seasons, a soft reset to 60% (harsh enough to matter,
   never far enough to undo a year), five placement matches that count double,
   and a badge for the tier you finished at that is yours permanently. */
const SEASON_DAYS = 30, PLACEMENTS = 5, SEASON_KEEP = 0.6;
const SEASON_EPOCH = Date.UTC(2025, 0, 6);   // a Monday, so seasons start on one
const SEASON_KEY = "tg_pvp_season";
function seasonNow(d = new Date()) {
  const day = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - SEASON_EPOCH) / 86400000);
  const id = Math.max(1, Math.floor(day / SEASON_DAYS) + 1);
  const into = ((day % SEASON_DAYS) + SEASON_DAYS) % SEASON_DAYS;
  return { id, daysLeft: Math.max(1, SEASON_DAYS - into) };
}
function readSeason() {
  try {
    const v = JSON.parse(localStorage.getItem(SEASON_KEY) || "null");
    if (v && typeof v.id === "number") return { id: v.id, placed: v.placed || 0, badges: Array.isArray(v.badges) ? v.badges : [] };
  } catch (e) {}
  return null;
}
function saveSeason(v) { try { localStorage.setItem(SEASON_KEY, JSON.stringify(v)); } catch (e) {} }
/** Called once on entering the arena: rolls the season over if the calendar
    has, banking a badge for wherever the last one finished. */
function rollSeason() {
  const now = seasonNow();
  const st = readSeason();
  if (!st) { const fresh = { id: now.id, placed: 0, badges: [] }; saveSeason(fresh); return fresh; }
  if (st.id === now.id) return st;
  const finishedAt = rankOf(readRankPts()).tier;
  const badges = st.badges.concat([{ id: st.id, tierKey: finishedAt.key }]).slice(-24);
  saveRankPts(Math.round(readRankPts() * SEASON_KEEP));
  const next = { id: now.id, placed: 0, badges };
  saveSeason(next);
  return next;
}
function bumpPlacement() {
  const st = readSeason() || { id: seasonNow().id, placed: 0, badges: [] };
  if (st.placed < PLACEMENTS) { st.placed += 1; saveSeason(st); }
  return st;
}

/* ══════════ combo trials ══════════
   Everything the last round of work added — counter-hits, throws against a
   guard, dizzy, the corner, specials — is invisible unless something asks
   for it by name. This is how every fighting game teaches its own systems:
   a numbered list of things to do once, each paying a little, each naming a
   mechanic the player did not know was there. Checked against flags the
   fight already has to track anyway. */
const TRIALS = [
  { key: "counter1",  v: 4,  th: "ลง counter-hit ให้ได้หนึ่งครั้ง", en: "Land a counter-hit", zh: "打出一次反击" },
  { key: "counter3",  v: 8, th: "ลง counter-hit 3 ครั้งในแมตช์เดียว", en: "Land 3 counter-hits in one match", zh: "单场打出三次反击" },
  { key: "noguard",   v: 7, th: "ชนะหนึ่งยกโดยไม่กดการ์ดเลย", en: "Win a round without pressing guard", zh: "不按格挡赢下一回合" },
  { key: "spfinish",  v: 9, th: "จบแมตช์ด้วยท่าไม้ตาย", en: "Finish the match with a special", zh: "用必杀技终结比赛" },
  { key: "throwgrd",  v: 7, th: "ทุ่มคู่ต่อสู้ตอนมันการ์ดอยู่", en: "Throw an opponent who is guarding", zh: "投技破解对手格挡" },
  { key: "dizzy",     v: 8, th: "ทำให้คู่ต่อสู้มึนงง", en: "Leave the opponent dizzy", zh: "让对手陷入眩晕" },
  { key: "cornerko",  v: 10, th: "น็อกคู่ต่อสู้ตอนมันจนมุม", en: "KO them while they are cornered", zh: "在角落将对手击倒" },
  { key: "combo8",    v: 8, th: "ต่อคอมโบให้ถึง 8 ฮิต", en: "Reach an 8-hit combo", zh: "打出 8 连击" },
  { key: "fast3",     v: 9, th: "ตอบคำถามใต้ 1.5 วิ สามข้อ", en: "Answer 3 questions under 1.5s", zh: "三题在 1.5 秒内答出" },
  { key: "perfectrd", v: 12, th: "ชนะหนึ่งยกโดยไม่เสียเลือดเลย", en: "Win a round without taking a hit", zh: "零失血赢下一回合" },
  { key: "allright",  v: 14, th: "ตอบถูกทุกข้อในแมตช์", en: "Answer every question correctly", zh: "全场答题全对" },
  { key: "superq",    v: 8, th: "ตอบคำถามท่าไม้ตายให้ถูก", en: "Answer the super's question right", zh: "答对必杀技的提问" },
  { key: "nobreak",   v: 7, th: "จบแมตช์โดยการ์ดไม่เคยแตก", en: "Finish a match without your guard breaking", zh: "全场格挡未被破" },
  { key: "nospecial", v: 8, th: "ชนะโดยไม่ใช้ท่าไม้ตายเลย", en: "Win without using a single special", zh: "不用必杀技取胜" },
  { key: "fastwin",   v: 10, th: "ชนะแมตช์ภายใน 90 วินาที", en: "Win a match in under 90 seconds", zh: "90 秒内赢下比赛" },
];
const TRIAL_KEY = "tg_pvp_trials";
function readTrials() { try { const v = JSON.parse(localStorage.getItem(TRIAL_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function saveTrials(v) { try { localStorage.setItem(TRIAL_KEY, JSON.stringify(v)); } catch (e) {} }
/** Which trials this match's flags just satisfied, for the first time. */
function trialsCleared(res) {
  const done = readTrials();
  const f = res.flags || {};
  const test = {
    counter1:  f.counters >= 1,
    counter3:  f.counters >= 3,
    noguard:   f.wonRoundNoGuard,
    spfinish:  f.finishedWithSpecial,
    throwgrd:  f.threwGuarding,
    dizzy:     f.dizzyDealt >= 1,
    cornerko:  f.cornerKo,
    combo8:    (res.bestCombo || 0) >= 8,
    fast3:     f.fastAnswers >= 3,
    perfectrd: f.perfectRound,
    allright:  res.asked > 0 && res.correct === res.asked,
    superq:    f.superRight,
    nobreak:   res.win && !f.guardBroke,
    nospecial: res.win && !f.usedSpecial,
    fastwin:   res.win && (res.seconds || 999) < 90,
  };
  const fresh = TRIALS.filter(t => test[t.key] && !done.includes(t.key));
  if (fresh.length) saveTrials(done.concat(fresh.map(t => t.key)));
  return fresh;
}

/* ══════════ per-match objectives ══════════
   Three rolled before every fight from the same flag set, so fighting the
   same tier twice is two different assignments. Seeded on the day and the
   tier, which means a retry after a loss is the SAME three — you get to go
   back and finish what you were doing rather than being handed new homework
   for losing. */
const OBJECTIVES = [
  { key: "win60",   v: 3, th: "ชนะภายใน 60 วินาที", en: "Win in under 60s", zh: "60 秒内取胜" },
  { key: "half",    v: 3, th: "อย่าให้เลือดต่ำกว่าครึ่ง", en: "Never drop below half HP", zh: "血量不低于一半" },
  { key: "sp2",     v: 3, th: "ลงท่าไม้ตาย 2 ครั้ง", en: "Land two specials", zh: "命中两次必杀技" },
  { key: "ctr2",    v: 3, th: "ลง counter-hit 2 ครั้ง", en: "Land two counter-hits", zh: "打出两次反击" },
  { key: "q6",      v: 3, th: "ตอบถูกอย่างน้อย 6 ข้อ", en: "Get at least 6 answers right", zh: "至少答对六题" },
  { key: "thr1",    v: 3, th: "ทุ่มให้ได้หนึ่งครั้ง", en: "Land a throw", zh: "命中一次投技" },
  { key: "corner",  v: 3, th: "ต้อนมันเข้ามุมแล้วตี", en: "Hit them in the corner", zh: "在角落击中对手" },
  { key: "clean2",  v: 3, th: "ชนะ 2-0", en: "Win 2 rounds to 0", zh: "2-0 取胜" },
];
function objectivesFor(tierKey) {
  const seed = todayStr() + "|" + tierKey;
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pool = OBJECTIVES.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) { h = (h * 1103515245 + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  return out;
}
function objectiveMet(key, res) {
  const f = res.flags || {};
  switch (key) {
    case "win60":  return res.win && (res.seconds || 999) < 60;
    case "half":   return (res.myHp / res.myMax) >= 0.5 && !f.everBelowHalf;
    case "sp2":    return f.specialsLanded >= 2;
    case "ctr2":   return f.counters >= 2;
    case "q6":     return res.correct >= 6;
    case "thr1":   return f.throwsLanded >= 1;
    case "corner": return f.cornerHits >= 1;
    case "clean2": return res.win && res.rounds && res.rounds.op === 0;
    default: return false;
  }
}

/* ══════════ your own ghost ══════════
   The rival system already stores a standing opponent; the one opponent it
   could not offer was the player at their best. A win that beats the stored
   score overwrites it, and the ghost can be handed to somebody else as a
   short code — which is as close to a real duel as anything here gets
   without a server to run it on. */
const GHOST_KEY = "tg_pvp_ghost";
function readGhost() {
  try { const v = JSON.parse(localStorage.getItem(GHOST_KEY) || "null"); return v && v.model && v.tierKey ? v : null; } catch (e) { return null; }
}
function saveGhost(g) { try { localStorage.setItem(GHOST_KEY, JSON.stringify(g)); } catch (e) {} }
/** Keep the best run only — a ghost of an average fight teaches nothing. */
function bumpGhost(res, name) {
  if (!res.win) return null;
  const cur = readGhost();
  if (cur && cur.score >= res.score) return null;
  const g = { name: name || "YOU", model: res.myModel, tierKey: res.tier.key, score: res.score,
    acc: res.asked ? Math.round((res.correct / res.asked) * 100) : 0, at: todayStr() };
  saveGhost(g);
  return g;
}
function ghostCode(g) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(g)))).replace(/=+$/, ""); } catch (e) { return ""; }
}
function ghostFromCode(code) {
  try {
    const j = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
    return j && j.model && j.tierKey ? j : null;
  } catch (e) { return null; }
}

/* ── two-class synergy ──
   readSkillSp already tracks every class separately; the only thing missing
   was a reason to actually rank up a second one instead of pouring every
   fight into the class already mained. Rank 3 in any OTHER class alongside
   the one being played unlocks a small always-on cross-training bonus. */
const SYNERGY_RANK = 3, SYNERGY_DMG = 1.08, SYNERGY_GAUGE = 1.10;
const hasSynergy = (sp, mine) => Object.keys(MODEL_CLASS).some(k => k !== mine && skillRank((sp && sp[k]) || 0).rank >= SYNERGY_RANK);

/* ── loadout presets ──
   Three saved gear sets, purely local — the shop already gates what can be
   equipped, this just remembers up to three combinations of it. */
const LOADOUT_KEY = "tg_loadouts";
export function readLoadouts() {
  try { const v = JSON.parse(localStorage.getItem(LOADOUT_KEY) || "[]"); return Array.isArray(v) ? v.slice(0, 3) : []; } catch (e) { return []; }
}
function saveLoadouts(v) { try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(v.filter(Boolean).slice(0, 3))); } catch (e) {} }

/* ── Valor: the PvP-only currency ──
   Earned only from arena wins, spent only on colourways for the fighter's
   glow/accent — cosmetic, not stats, so grinding it never buys a win. */
const VALOR_KEY = "tg_pvp_valor";
export function readValor() { try { return Math.max(0, parseInt(localStorage.getItem(VALOR_KEY) || "0", 10) || 0); } catch (e) { return 0; } }
function addValor(n) { const v = Math.max(0, readValor() + Math.round(n)); try { localStorage.setItem(VALOR_KEY, String(v)); } catch (e) {} return v; }
function spendValor(n) { const v = readValor(); if (v < n) return false; try { localStorage.setItem(VALOR_KEY, String(v - n)); } catch (e) {} return true; }
export const COLORWAYS = [
  { key: "default", cost: 0,  glow: "#00b8d4", accent: "#7c4dff", th: "มาตรฐาน", en: "Standard", zh: "标准" },
  { key: "inferno", cost: 30, glow: "#ff5a1f", accent: "#ffd23f", th: "อัคคี",    en: "Inferno",  zh: "烈焰" },
  { key: "toxic",   cost: 30, glow: "#3ddc84", accent: "#c8ff3d", th: "พิษเขียว", en: "Toxic",    zh: "剧毒" },
  { key: "royal",   cost: 45, glow: "#b98cff", accent: "#ff66c4", th: "ราชวงศ์",  en: "Royal",    zh: "皇室" },
  { key: "arctic",  cost: 45, glow: "#7fe8ff", accent: "#e9f6ff", th: "อาร์กติก", en: "Arctic",   zh: "极地" },
  { key: "crimson", cost: 60, glow: "#ff2d55", accent: "#0b0d14", th: "เลือดเข้ม", en: "Crimson",  zh: "赤红" },
  /* The trials pay out roughly 129 Valor once, which would have bought the
     five above outright and left the currency with nothing to be for. These
     three are the sink that one-time payout is aimed at — priced so a full
     trial sweep is a real head start on them and not a purchase of them. */
  { key: "solaris", cost: 90,  glow: "#ffd23f", accent: "#ff8a3c", th: "สุริยะ",   en: "Solaris",  zh: "耀阳" },
  { key: "abyss",   cost: 120, glow: "#2b6cff", accent: "#00f0ff", th: "เหวลึก",  en: "Abyss",    zh: "深渊" },
  { key: "prism",   cost: 160, glow: "#ff66c4", accent: "#7fe8ff", th: "ปริซึม",  en: "Prism",    zh: "棱镜" },
];
const COLORWAY_KEY = "tg_pvp_colorway";
export function readColorwayKey() { try { return localStorage.getItem(COLORWAY_KEY) || "default"; } catch (e) { return "default"; } }
function saveColorwayKey(k) { try { localStorage.setItem(COLORWAY_KEY, k); } catch (e) {} }
const COLORWAYS_OWNED_KEY = "tg_pvp_colorways_owned";
function readOwnedColorways() { try { const v = JSON.parse(localStorage.getItem(COLORWAYS_OWNED_KEY) || "[\"default\"]"); return Array.isArray(v) ? v : ["default"]; } catch (e) { return ["default"]; } }
function ownColorway(key) { try { const v = readOwnedColorways(); if (!v.includes(key)) { v.push(key); localStorage.setItem(COLORWAYS_OWNED_KEY, JSON.stringify(v)); } } catch (e) {} }
export const colorwayOf = (key) => COLORWAYS.find(c => c.key === key) || COLORWAYS[0];

/* ── class-specific win poses/lines ──
   A rank-6+ chassis gets its "ultimate" line instead of the base one — a
   pure collectible, no combat weight at all. */
const CLASS_WIN_LINES = {
  striker:   { line: { th: "จบไวจบแรง",              en: "Fast in, fast out.",              zh: "速战速决。" },
               ult:  { th: "ไม่มีใครตามทัน",          en: "Nobody keeps up.",                zh: "无人能及。" } },
  bulwark:   { line: { th: "ยืนตรงนี้ ไม่ถอย",        en: "Stood my ground.",                zh: "寸步不让。" },
               ult:  { th: "กำแพงที่ไม่เคยแตก",       en: "The wall never breaks.",          zh: "永不崩塌的墙。" } },
  ghost:     { line: { th: "ไม่ทันเห็นด้วยซ้ำ",        en: "You never even saw me.",          zh: "你根本没看见我。" },
               ult:  { th: "เงาที่จับไม่ได้",          en: "An untouchable shadow.",          zh: "无法触及的影子。" } },
  tactician: { line: { th: "คิดไว้แล้วทุกก้าว",        en: "Planned every move.",             zh: "每一步都算好了。" },
               ult:  { th: "เกมจบตั้งแต่ยังไม่เริ่ม",   en: "The game ended before it began.", zh: "未战已定局。" } },
  engineer:  { line: { th: "ซ่อมไว ซ่อมทัน",           en: "Repaired faster than you could hit.", zh: "修复速度超过你的攻击。" },
               ult:  { th: "ไม่มีวันพัง",              en: "Built to never break.",           zh: "永不损坏。" } },
  herald:    { line: { th: "เสียงนี้คือชัยชนะ",         en: "That sound was victory.",         zh: "那声音就是胜利。" },
               ult:  { th: "บทเพลงสุดท้ายเป็นของฉัน",  en: "The final note is mine.",         zh: "终曲属于我。" } },
  virtuoso:  { line: { th: "คอมโบไม่เคยขาด",           en: "The combo never dropped.",        zh: "连击从未中断。" },
               ult:  { th: "ทุกจังหวะคือศิลปะ",         en: "Every beat, a masterpiece.",      zh: "每一拍都是杰作。" } },
};

export const PvpPage = memo(function PvpPage({
  lang, charModel = "vanguard", gear = [], onBack, onReward, playUi, friends = null, onChallenge, duels = null, onRespondDuel, onShare, onApplyLoadout,
}) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [phase, setPhase] = useState("lobby");    // lobby | fight | result
  const [tier, setTier] = useState(BOT_TIERS[3]);  // veteran/"Medium" - the bot-fight default, and also the fixed baseline a player-vs-player duel scores against
  const [oppKind, setOppKind] = useState("bot");  // bot | player
  const [oppName, setOppName] = useState("");
  const [pendingFriend, setPendingFriend] = useState(null);
  const [sp, setSp] = useState(() => readSkillSp());
  const [isWeekly, setIsWeekly] = useState(false);
  const weekly = useRef(weeklyFeatured()).current;
  const [weeklyClaimed, setWeeklyClaimed] = useState(() => readWeeklyBadges().includes(weekly.wk));
  const [gauntlet, setGauntlet] = useState(null);            // {ix, hpFrac, totals, cleared}
  const [gauntletSummary, setGauntletSummary] = useState(null);
  const [rival, setRival] = useState(() => readRival());
  const [isRival, setIsRival] = useState(false);
  const [daily] = useState(() => dailyTarget());
  /* The season rolls over the moment the arena is opened, before the rank is
     read — otherwise the first fight of a new season would score against the
     old season's points and then get reset out from under it. */
  const [season, setSeason] = useState(() => rollSeason());
  const seasonInfo = seasonNow();
  const [rankPts, setRankPts] = useState(() => readRankPts());
  const rank = rankOf(rankPts);
  const [trialsDone, setTrialsDone] = useState(() => readTrials());
  const [trialsJustCleared, setTrialsJustCleared] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [ghost, setGhost] = useState(() => readGhost());
  const [isGhost, setIsGhost] = useState(false);
  const [ghostNote, setGhostNote] = useState(null);
  const [showTrials, setShowTrials] = useState(false);
  // the lobby's own throwaway timers, cleared if the page goes away under them
  const lobbyTimers = useRef([]);
  const later0 = (fn, ms) => { const t = setTimeout(fn, ms); lobbyTimers.current.push(t); return t; };
  useEffect(() => () => { lobbyTimers.current.forEach(clearTimeout); lobbyTimers.current = []; }, []);
  const [loadouts, setLoadouts] = useState(() => readLoadouts());
  const [valor, setValor] = useState(() => readValor());
  const [colorwayKey, setColorwayKey] = useState(() => readColorwayKey());
  const [ownedCw, setOwnedCw] = useState(() => readOwnedColorways());
  const [practiceMode, setPracticeMode] = useState(false);
  const colorway = colorwayOf(colorwayKey);

  const me = normalizeModel(charModel);
  const myCls = classKeyOf(me);
  const myRank = skillRank(sp[myCls] || 0).rank;
  const mySkills = skillsOf(me);
  const clsInfo = MODEL_CLASS[myCls] || MODEL_CLASS.striker;
  // what the equipped gear actually does in a fight, not just its stat points
  const gearFx = itemEffectsOf(gear);
  const gearArchetypes = [...new Set(gearFx.archetypes)];

  const startFight = (kind, t, name, friend) => {
    setOppKind(kind); setTier(t); setOppName(name || ""); setPendingFriend(friend || null);
    // seeded on the day and the tier, so losing and retrying hands back the
    // SAME three — a retry is a second go at what you were doing, not new
    // homework for having lost
    setObjectives(objectivesFor(t.key).map(o => ({ ...o, done: false })));
    setPhase("fight"); if (playUi) playUi("click");
  };
  const startWeekly = () => {
    // the rule rides on the tier object, which the fight already receives —
    // no new prop for something only one opponent in the game ever has
    const boosted = { ...weekly.tier, coins: weekly.tier.coins * 2, xp: weekly.tier.xp * 2, sp: weekly.tier.sp * 2, bossRule: weekly.rule };
    setIsWeekly(true);
    startFight("bot", boosted, weekly.name);
  };
  const startRivalFight = () => {
    const t = BOT_TIERS.find(x => x.key === rival.tierKey) || BOT_TIERS[2];
    setIsRival(true);
    startFight("bot", t, rival.name);
  };
  const startGhostFight = () => {
    if (!ghost) return;
    const t = BOT_TIERS.find(x => x.key === ghost.tierKey) || BOT_TIERS[3];
    setIsGhost(true);
    startFight("player", t, ghost.name || "YOU");
  };
  const copyGhost = () => {
    if (!ghost) return;
    const code = ghostCode(ghost);
    const done = () => { setGhostNote(T("คัดลอกรหัสเงาแล้ว", "Ghost code copied", "已复制幽灵代码")); later0(() => setGhostNote(null), 2200); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done);
      else done();
    } catch (e) { done(); }
  };
  const pasteGhost = () => {
    const code = window.prompt(T("วางรหัสเงาของเพื่อน", "Paste a friend's ghost code", "粘贴好友的幽灵代码") || "");
    if (!code) return;
    const g = ghostFromCode(code);
    if (!g) { setGhostNote(T("รหัสไม่ถูกต้อง", "That code did not read", "代码无法识别")); later0(() => setGhostNote(null), 2200); return; }
    const t = BOT_TIERS.find(x => x.key === g.tierKey) || BOT_TIERS[3];
    setIsGhost(true);
    startFight("player", t, g.name || "GHOST");
  };
  const startPractice = () => {
    setPracticeMode(true);
    startFight("bot", BOT_TIERS[3], T("โหมดซ้อม", "Practice Bot", "陪练机器人"));
  };
  const saveLoadoutSlot = (i) => {
    const g = gear || [];
    const findId = (pfx) => { const it = g.find(x => x && x.id && String(x.id).startsWith(pfx)); return it ? it.id : null; };
    const rec = {
      name: tr3(clsInfo, lang) + " " + (i + 1), model: me,
      weapon: findId("wpn-"), outfit: findId("out-"), hat: findId("hat-"), accessory: findId("acc-"),
    };
    const next = loadouts.slice(); next[i] = rec;
    setLoadouts(next); saveLoadouts(next);
    if (playUi) playUi("click");
  };
  const applyLoadoutSlot = (i) => {
    const rec = loadouts[i];
    if (!rec || !onApplyLoadout) return;
    onApplyLoadout(rec);
    if (playUi) playUi("reward");
  };
  const clearLoadoutSlot = (i) => {
    const next = loadouts.slice(); next[i] = null;
    setLoadouts(next); saveLoadouts(next);
  };
  const pickColorway = (cw) => {
    if (ownedCw.includes(cw.key)) { setColorwayKey(cw.key); saveColorwayKey(cw.key); if (playUi) playUi("click"); return; }
    if (valor < cw.cost) { if (playUi) playUi("click"); return; }
    if (!spendValor(cw.cost)) return;
    ownColorway(cw.key);
    setOwnedCw(readOwnedColorways()); setValor(readValor());
    setColorwayKey(cw.key); saveColorwayKey(cw.key);
    if (playUi) playUi("reward");
  };
  const startGauntlet = () => {
    setGauntlet({ ix: 0, hpFrac: 1, totals: { coins: 0, xp: 0, sp: 0 }, cleared: [] });
    startFight("bot", BOT_TIERS[0], tr3(CHAR_MODELS.find(m => m.id === chassisFor("gauntlet0" + Date.now())) || {}, lang));
  };

  const [result, setResult] = useState(null);
  const finish = useCallback((res) => {
    const wasWeekly = isWeekly;
    if (wasWeekly) { setIsWeekly(false); if (res.win) { markWeeklyBadge(weekly.wk); setWeeklyClaimed(true); } }
    const wasRival = isRival;
    if (wasRival) { setIsRival(false); setRival(rivalResult(rival, res.win)); }
    const wasGhost = isGhost;
    const wasPractice = practiceMode;
    if (wasPractice) {
      // no stakes means no stakes: no coins, no XP, no SP, no rank, no daily
      // best — just the result screen and whatever the live tips taught
      setPracticeMode(false);
      res.practice = true;
      setResult(res);
      setPhase("result");
      if (playUi) playUi(res.win ? "reward" : "click");
      return;
    }

    if (gauntlet) {
      const t = res.tier;
      if (res.win) {
        const totals = { coins: gauntlet.totals.coins + t.coins, xp: gauntlet.totals.xp + t.xp, sp: gauntlet.totals.sp + t.sp };
        const cleared = [...gauntlet.cleared, t.key];
        const hpFrac = Math.max(0.001, res.myHp / res.myMax);
        if (gauntlet.ix + 1 >= BOT_TIERS.length) {
          // cleared all ten — the completion bonus is the whole reason to run it back to back
          const bonus = { coins: 1000, xp: 150, sp: 300 };
          const final = { coins: totals.coins + bonus.coins, xp: totals.xp + bonus.xp, sp: totals.sp + bonus.sp };
          const gained = addSkillSp(myCls, final.sp);
          setSp(readSkillSp()); try { window.dispatchEvent(new Event("tg-skillsp")); } catch (e) {}
          if (onReward) onReward(final.xp, final.coins, res);
          setGauntlet(null);
          setGauntletSummary({ cleared, totals: final, complete: true, spGained: gained });
          setPhase("result");
          if (playUi) playUi("reward");
          return;
        }
        const ix = gauntlet.ix + 1;
        setGauntlet({ ix, hpFrac, totals, cleared });
        setTier(BOT_TIERS[ix]);
        setOppName(tr3(CHAR_MODELS.find(m => m.id === chassisFor("gauntlet" + ix + Date.now())) || {}, lang));
        if (playUi) playUi("click");
        return;   // stay on phase "fight" — the key change below remounts ArenaFight fresh
      }
      // lost — the run ends here, paying out whatever was already banked
      const gained = gauntlet.totals.sp ? addSkillSp(myCls, gauntlet.totals.sp) : null;
      setSp(readSkillSp()); try { window.dispatchEvent(new Event("tg-skillsp")); } catch (e) {}
      if (onReward && (gauntlet.totals.coins || gauntlet.totals.xp)) onReward(gauntlet.totals.xp, gauntlet.totals.coins, res);
      setGauntlet(null);
      setGauntletSummary({ cleared: gauntlet.cleared, totals: gauntlet.totals, complete: false, spGained: gained });
      setPhase("result");
      if (playUi) playUi("click");
      return;
    }

    res.weeklyWin = wasWeekly && res.win;
    if (wasRival) res.rivalMatch = true;
    res.newDailyBest = bumpDailyBest(res.score);
    const tierIdx = res.tier ? BOT_TIERS.findIndex(x => x.key === res.tier.key) : -1;
    /* ── the season ──
       The first five matches of a season are PLACEMENTS and count double in
       both directions: the ladder finds where you actually are in a handful
       of fights rather than making you grind back to it. */
    const st = readSeason() || { id: seasonNow().id, placed: 0, badges: [] };
    const placing = st.placed < PLACEMENTS;
    if (tierIdx >= 0) {
      const delta = (res.win ? (tierIdx + 1) * 8 : -4) * (placing ? 2 : 1);
      saveRankPts(readRankPts() + delta);
      setRankPts(readRankPts());
      setSeason(bumpPlacement());
      res.placing = placing;
      res.rankDelta = delta;
    }
    let valorGain = res.win ? 3 + (tierIdx >= 0 ? tierIdx : 0) : 0;
    /* ── trials and objectives ──
       Both graded off the same flag set the fight already carried out, and
       both paid in Valor, which is the arena's own currency and the only
       thing these should ever be worth. */
    const cleared = trialsCleared(res);
    if (cleared.length) {
      valorGain += cleared.reduce((a, t) => a + t.v, 0);
      setTrialsDone(readTrials());
      setTrialsJustCleared(cleared);
    } else setTrialsJustCleared([]);
    const objDone = objectives.map(o => ({ ...o, done: objectiveMet(o.key, res) }));
    res.objectives = objDone;
    valorGain += objDone.filter(o => o.done).reduce((a, o) => a + o.v, 0);
    if (valorGain > 0) setValor(addValor(valorGain));
    res.valorGain = valorGain;
    res.trialsCleared = cleared;
    // a win better than the stored one becomes the ghost you can fight later
    const g = bumpGhost(res, T("ตัวคุณที่เก่งที่สุด", "YOUR BEST", "你的最佳"));
    if (g) { setGhost(g); res.newGhost = true; }
    if (wasGhost) setIsGhost(false);
    setResult(res);
    setPhase("result");
    const won = res.win;
    const t = res.tier;
    // a perfect 8/8 fight pays 40% more on top of the win — the counters were
    // always tracked, they just never bought anything
    const flawlessMul = (won && res.flawless) ? 1.4 : 1;
    const coins = Math.round((won ? t.coins : Math.round(t.coins * 0.25)) * flawlessMul);
    const xp = Math.round((won ? t.xp : Math.round(t.xp * 0.3)) * flawlessMul);
    const gained = addSkillSp(myCls, Math.round((won ? t.sp : Math.round(t.sp * 0.35)) * flawlessMul));
    setSp(readSkillSp());
    try { window.dispatchEvent(new Event("tg-skillsp")); } catch (e) {}
    // the arena pays SP directly above, so its EXP must not ALSO trickle into
    // the same track — otherwise one fight counts twice and the arena becomes
    // the only sane way to rank up
    if (onReward) onReward(xp, coins, res);
    res.spGained = gained;
    if (playUi) playUi(won ? "reward" : "click");
  }, [myCls, onReward, playUi, gauntlet, isWeekly, weekly, isRival, rival, practiceMode, lang, isGhost, objectives]);

  /* ── lobby ── */
  if (phase === "lobby") {
    const openDuels = (duels || []).filter(d => d.song_id === "arena");
    return (
      <div className="pvppage">
        <div className="pvphdr">
          <button className="stgback" onClick={onBack} aria-label="back">←</button>
          <span className="pvphdr-t">⚔ {T("สนามประลอง", "PvP Arena", "竞技场")}</span>
          <span className="mdv-cls" style={{ "--cc": clsInfo.c }}>
            <span className="mdv-cls-ic"><ItemArt art={clsInfo.art} sw={[clsInfo.c, "#22283a"]} /></span>{tr3(clsInfo, lang)}
          </span>
        </div>

        <div className="pvpbody">
          <div className="pvprank" style={{ "--cc": rank.tier.c }} title={rank.next ? `${rank.into}/${rank.need}` : ""}>
            <span className="pvprank-ic">🎖</span>
            <span className="pvprank-b">
              <b>{tr3(rank.tier, lang)}</b>
              <span className="pvprank-bar"><i style={{ width: `${Math.round(rank.pct * 100)}%` }} /></span>
            </span>
            {daily.target > 0 && (
              <span className="pvprank-daily">🎯 {T("เป้าวันนี้", "Today's target", "今日目标")} {daily.target.toLocaleString()}</span>
            )}
          </div>
          {/* ── the season ──
              A ladder with no end date is a lifetime total. This one says
              which season it is, how long is left of it, and — for the first
              five matches — that the placements are still running. */}
          <div className="pvpseason">
            <b>{T("ซีซัน", "Season", "赛季")} {season.id}</b>
            <i>{T(`เหลืออีก ${seasonInfo.daysLeft} วัน`, `${seasonInfo.daysLeft} days left`, `剩余 ${seasonInfo.daysLeft} 天`)}</i>
            {season.placed < PLACEMENTS ? (
              <em className="pl">{T(`จัดอันดับ ${season.placed}/${PLACEMENTS} · แต้มคูณสอง`,
                `Placements ${season.placed}/${PLACEMENTS} · double points`,
                `定级赛 ${season.placed}/${PLACEMENTS} · 双倍积分`)}</em>
            ) : (
              <em>{T("จบซีซันแล้วได้ตราถาวร · แต้มเหลือ 60%",
                "Season end banks a permanent badge · points carry at 60%",
                "赛季结束获得永久徽章 · 积分保留 60%")}</em>
            )}
            {season.badges.length > 0 && (
              <span className="pvpseason-bd">
                {season.badges.slice(-6).map(b => {
                  const t = RANK_TIERS.find(x => x.key === b.tierKey) || RANK_TIERS[0];
                  return <u key={b.id} style={{ "--cc": t.c }} title={`S${b.id} · ${tr3(t, lang)}`}>S{b.id}</u>;
                })}
              </span>
            )}
          </div>
          <div className="pvpme">
            <div className="pvpme-stage"><CyberAvatar model={me} yaw={22} pose="ready" glow={colorway.glow} accent={colorway.accent} armorA="#1b2436" armorB="#41608a" /></div>
            <div className="pvpme-b">
              <div className="pvpme-nm">{tr3(CHAR_MODELS.find(m => m.id === me) || {}, lang)}</div>
              <div className="pvpme-rank" style={{ "--cc": clsInfo.c }}>{T("แรงก์สกิล", "Skill rank", "技能等级")} {myRank}</div>
              <div className="pvpme-sk">
                {mySkills.map((s, i) => {
                  const ok = skillUnlocked(s.tier, myRank);
                  return (
                    <div key={i} className={`pvpsk${ok ? "" : " lock"}`}>
                      <span className="pvpsk-ic"><ItemArt art={s.art} sw={[ok ? clsInfo.c : "#9aa3b4", "#20263a"]} /></span>
                      <span className="pvpsk-b">
                        <b>{tr3(s.n, lang)} <i>{tr3(TIER_LABEL[s.tier], lang)}</i></b>
                        <span>{ok ? tr3(FX_TEXT[CLASS_FX[myCls][s.tier === "ultimate" ? "ult" : s.tier]], lang)
                          : T(`ปลดล็อกที่แรงก์ ${SKILL_UNLOCK[s.tier]}`, `Unlocks at rank ${SKILL_UNLOCK[s.tier]}`, `等级 ${SKILL_UNLOCK[s.tier]} 解锁`)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {gearArchetypes.length > 0 && (
                <div className="pvpme-gear">
                  {gearArchetypes.map(a => <span key={a}>⚙ {tr3(ITEM_FX_LABEL[a], lang)}</span>)}
                </div>
              )}
              {/* the command list. Nothing about a special move should be
                  folklore — it is printed on the cabinet, so it is printed
                  here, and the fight itself shows what it read. */}
              <div className="pvpmoves">
                <b>{T("ท่าไม้ตาย", "Special Moves", "必杀技")} · {SPECIAL_COST} {T("เกจ", "gauge", "能量")}</b>
                {specialsOf(myCls).map(s => (
                  <span key={s.key}>
                    <em>{s.glyph}</em> + {s.act === "punch" ? T("ต่อย", "Punch", "拳") : s.act === "kick" ? T("เตะ", "Kick", "踢") : T("ยิง", "Fire", "射")}
                    <i>{tr3(s, lang)}</i>
                  </span>
                ))}
                <span>
                  <em>{T("ประชิด", "close", "贴身")}</em> + {T("ต่อยตอนเขาการ์ด", "Punch while they guard", "对方格挡时按拳")}
                  <i>{T("ทุ่ม — การ์ดกันไม่ได้", "Throw — beats blocking", "投技 — 无视格挡")}</i>
                </span>
              </div>
            </div>
          </div>

          <div className="pvpsec-h">💾 {T("ชุดที่บันทึกไว้", "Loadout Presets", "预设装备")}</div>
          <div className="pvploadouts">
            {[0, 1, 2].map(i => {
              const rec = loadouts[i];
              return (
                <button key={i} className={`pvploadout${rec ? "" : " empty"}`} onClick={() => rec ? applyLoadoutSlot(i) : saveLoadoutSlot(i)}>
                  {rec ? (
                    <>
                      <b>{rec.name}</b>
                      <i>{T("แตะเพื่อสวมใส่", "Tap to equip", "点击装备")}</i>
                      <span className="pvploadout-x" onClick={e => { e.stopPropagation(); clearLoadoutSlot(i); }}>✕</span>
                    </>
                  ) : (
                    <><b>+</b><i>{T("บันทึกชุดปัจจุบัน", "Save current set", "保存当前套装")}</i></>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pvpsec-h">⚔ {T("วาลอร์", "Valor", "荣耀值")} · {valor.toLocaleString()}</div>
          <div className="pvpcolorways">
            {COLORWAYS.map(cw => {
              const owned = ownedCw.includes(cw.key);
              const on = colorwayKey === cw.key;
              return (
                <button key={cw.key} className={`pvpcw${on ? " on" : ""}${!owned && valor < cw.cost ? " lock" : ""}`}
                  style={{ "--g": cw.glow, "--a": cw.accent }} onClick={() => pickColorway(cw)}>
                  <span className="pvpcw-sw" />
                  <b>{tr3(cw, lang)}</b>
                  <i>{owned ? (on ? T("ใช้อยู่", "Equipped", "使用中") : T("แตะเพื่อใช้", "Tap to wear", "点击佩戴")) : `⚔ ${cw.cost}`}</i>
                </button>
              );
            })}
          </div>

          <div className="pvpsec-h">⭐ {T("ไฟต์พิเศษ", "Special Fights", "特别对战")}</div>
          <div className="pvptiers">
            <button className="pvptier t-gauntlet" onClick={startGauntlet}>
              <b>🔥 {T("เกาน์ท์เล็ต", "Gauntlet", "极限远征")}</b>
              <i>{T("ลุยรวด 10 ด่าน ไม่พัก HP", "All 10 tiers, no HP rest", "连闯十关，HP 不回复")}</i>
              <span>🏆 {T("โบนัสก้อนใหญ่เมื่อจบครบ", "Big bonus on a full clear", "全通有大奖")}</span>
            </button>
            <button className="pvptier t-weeklyboss" onClick={startWeekly}>
              <b>👑 {T("บอสประจำสัปดาห์", "Weekly Boss", "本周首领")} {weeklyClaimed ? "✓" : ""}</b>
              <i>{tr3(weekly.tier, lang)} · {T("รางวัล 2 เท่า", "2× rewards", "奖励 2 倍")}</i>
              {/* the week's broken rule, up front — a boss you only discover
                  is cheating after it kills you is not a boss, it is a bug */}
              <em className="pvpbossrule">⚠ {tr3(BOSS_RULES[weekly.rule] || {}, lang)}</em>
              <span>🪙 {weekly.tier.coins * 2} · ✦ {weekly.tier.xp * 2} · SP {weekly.tier.sp * 2}</span>
            </button>
            {/* the one opponent the rival system could never offer: you */}
            <button className={`pvptier t-ghost${ghost ? "" : " off"}`} onClick={ghost ? startGhostFight : undefined} disabled={!ghost}>
              <b>👤 {T("เงาตัวเอง", "Your Ghost", "自身幽灵")}</b>
              <i>{ghost
                ? `${tr3(BOT_TIERS.find(t => t.key === ghost.tierKey) || {}, lang)} · ${ghost.score.toLocaleString()} · ${ghost.acc}%`
                : T("ชนะสักแมตช์แล้วเงาจะถูกบันทึก", "Win a match and your best run is saved here", "赢一场后会保存你的最佳战绩")}</i>
              <span>{ghost ? T("ท้าตัวเองที่เก่งที่สุด", "Fight your best self", "挑战最强的自己") : T("ยังไม่มีเงา", "No ghost yet", "尚无幽灵")}</span>
            </button>
            <button className="pvptier t-rival" onClick={startRivalFight}>
              <b>😤 {T("คู่ปรับ", "Rival", "劲敌")} {rival.name}</b>
              <i>{tr3(BOT_TIERS.find(t => t.key === rival.tierKey) || {}, lang)}</i>
              <span>{T("สถิติ", "Record", "战绩")} {rival.w}-{rival.l}</span>
            </button>
            <button className="pvptier t-practice" onClick={startPractice}>
              <b>🎓 {T("โหมดซ้อม", "Practice", "陪练模式")}</b>
              <i>{T("ไม่มีเดิมพัน มีติ๊ปสด · ตั้งค่าหุ่นได้", "No stakes, live tips, dummy controls", "无风险、实时提示、可设定木人")}</i>
              <span>{T("ไม่เสียเหรียญ/EXP", "No coins/EXP lost", "不消耗金币/经验")}</span>
            </button>
          </div>

          {/* ── the ghost's travel form ──
              No server to duel across, so the ghost travels as a short code
              somebody can paste on the other end. */}
          <div className="pvpghostbar">
            <button type="button" onClick={copyGhost} disabled={!ghost}>📋 {T("คัดลอกรหัสเงา", "Copy ghost code", "复制幽灵代码")}</button>
            <button type="button" onClick={pasteGhost}>📥 {T("สู้กับเงาเพื่อน", "Fight a friend's ghost", "挑战好友幽灵")}</button>
            {ghostNote && <em>{ghostNote}</em>}
          </div>

          {/* ── the trials ──
              Everything the fight can do, listed by name. This is the only
              place a player finds out that throwing a guarding opponent, or
              cornering one, is a thing the game has an opinion about. */}
          <div className="pvpsec-h">
            🎯 {T("บททดสอบ", "Combo Trials", "连段试炼")}
            <span className="pvpsec-n">{trialsDone.length}/{TRIALS.length}</span>
            <button type="button" className="pvpsec-t" onClick={() => setShowTrials(v => !v)}>
              {showTrials ? T("ซ่อน", "Hide", "收起") : T("ดู", "Show", "展开")}
            </button>
          </div>
          {showTrials && (
            <div className="pvptrials">
              {TRIALS.map((t, i) => {
                const done = trialsDone.includes(t.key);
                return (
                  <div key={t.key} className={`pvptrial${done ? " on" : ""}`}>
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    <i>{tr3(t, lang)}</i>
                    <span>{done ? "✓" : `⚔ ${t.v}`}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pvpsec-h">🤖 {T("โหมดต่อสู้", "Fight Mode", "战斗模式")}</div>
          <div className="pvptiers">
            {BOT_TIERS.map(t => (
              <button key={t.key} className={`pvptier t-${t.key}`} onClick={() => startFight("bot", t, tr3(CHAR_MODELS.find(m => m.id === chassisFor(t.key + Date.now())) || {}, lang))}>
                <b>{tr3(t, lang)}</b>
                <i>{T("ความแม่น", "Accuracy", "命中率")} {Math.round(t.acc * 100)}%</i>
                <span>🪙 {t.coins} · ✦ {t.xp} · SP {t.sp}</span>
              </button>
            ))}
          </div>

          <div className="pvpsec-h">👥 {T("สู้กับผู้เล่นอื่น", "Fight another player", "对战玩家")}</div>
          <div className="pvpnote">
            {T("ประลองแบบผลัดกันลง: คุณลงสนามก่อน คะแนนจะถูกส่งไปท้าเพื่อน แล้วเพื่อนลงสนามเดียวกัน ใครคะแนนสูงกว่าชนะ",
               "Turn-based duel: you run the arena, your score is sent as a challenge, and your friend runs the same arena. Higher score wins.",
               "回合制对决：你先进入竞技场，分数作为挑战发出，好友再挑战同一场，分高者胜。")}
          </div>
          {friends === null ? (
            <div className="pvpempty">{T("กำลังโหลดรายชื่อเพื่อน…", "Loading friends…", "正在加载好友…")}</div>
          ) : friends.length === 0 ? (
            <div className="pvpempty">{T("ยังไม่มีเพื่อนในระบบ — เพิ่มเพื่อนก่อนจึงจะท้าประลองได้", "No friends yet — add one before you can challenge.", "还没有好友 — 先添加好友才能挑战。")}</div>
          ) : (
            <div className="pvpfriends">
              {friends.map(f => (
                <button key={f.user_id} className="pvpfriend" onClick={() => startFight("player", BOT_TIERS[3], f.name || f.email || "?", f)}>
                  <span className="pvpfriend-av"><CyberAvatar model={chassisFor(f.user_id || f.name || "x")} headOnly glow="#7fd7ff" accent="#b98cff" armorA="#182133" armorB="#3f5f8a" /></span>
                  <span className="pvpfriend-nm">{f.name || f.email}</span>
                  <span className="pvpfriend-go">{T("ท้า", "Challenge", "挑战")} →</span>
                </button>
              ))}
            </div>
          )}
          {openDuels.length > 0 && (
            <>
              <div className="pvpsec-h">📨 {T("คำท้าที่รออยู่", "Challenges waiting", "待处理的挑战")}</div>
              <div className="pvpfriends">
                {openDuels.map(d => (
                  <button key={d.id} className="pvpfriend" onClick={() => startFight("player", BOT_TIERS[3], d.opp_name, { duel: d })}>
                    <span className="pvpfriend-av"><CyberAvatar model={chassisFor(d.opp_name || "x")} headOnly glow="#7fd7ff" accent="#b98cff" armorA="#182133" armorB="#3f5f8a" /></span>
                    <span className="pvpfriend-nm">{d.opp_name} · {d.opp_score != null ? d.opp_score : "—"}</span>
                    <span className="pvpfriend-go">{T("รับคำท้า", "Accept", "接受")} →</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── gauntlet summary ── */
  if (phase === "result" && gauntletSummary) {
    const gs = gauntletSummary;
    return (
      <div className="pvppage">
        <div className="pvphdr">
          <button className="stgback" onClick={() => { setGauntletSummary(null); setPhase("lobby"); }} aria-label="back">←</button>
          <span className="pvphdr-t">{gs.complete ? "🏆 " + T("พิชิตครบ 10 ด่าน!", "GAUNTLET CLEARED!", "十关制霸！") : T("จบเกาน์ท์เล็ต", "Gauntlet Over", "远征结束")}</span>
        </div>
        <div className="pvpbody">
          <div className={`pvpres ${gs.complete ? "win" : ""}`}>
            <div className="pvpres-score">{gs.cleared.length}/{BOT_TIERS.length}</div>
            <div className="pvpres-sub">
              {T("ด่านที่ผ่าน", "Tiers cleared", "已通过关卡")}: {gs.cleared.length ? gs.cleared.map(k => tr3(BOT_TIERS.find(t => t.key === k) || {}, lang)).join(" → ") : "—"}
            </div>
            {gs.complete && <div className="pvpres-flawless">🏆 {T("รวมโบนัสพิชิตครบแล้ว", "Full-clear bonus included", "已包含全通奖励")}</div>}
            <div className="pvpres-rew">
              <span>🪙 {gs.totals.coins}</span>
              <span>✦ {gs.totals.xp}</span>
              <span style={{ color: clsInfo.c }}>SP +{gs.totals.sp}</span>
            </div>
            {gs.spGained && gs.spGained.rankedUp && <div className="pvpres-rank" style={{ "--cc": clsInfo.c }}>⬆ {tr3(clsInfo, lang)} {T("แรงก์", "rank", "等级")} {gs.spGained.rank}</div>}
          </div>
          <div className="pvpres-btns">
            <button className="pvpghost" onClick={() => { setGauntletSummary(null); setPhase("lobby"); }}>{T("กลับสนาม", "Back to arena", "返回竞技场")}</button>
            <button className="pvpghost" onClick={() => { setGauntletSummary(null); startGauntlet(); }}>{T("ลองอีกครั้ง", "Try again", "再试一次")}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── result ── */
  if (phase === "result" && result) {
    const g = result.spGained;
    const flawlessMul = (result.win && result.flawless) ? 1.4 : 1;
    return (
      <div className="pvppage">
        <div className="pvphdr">
          <button className="stgback" onClick={onBack} aria-label="back">←</button>
          <span className="pvphdr-t">{result.win ? "🏆 " + T("ชนะ!", "Victory!", "胜利！") : T("แพ้", "Defeat", "落败")}</span>
        </div>
        <div className="pvpbody">
          <div className={`pvpres ${result.win ? "win" : "lose"}`}>
            <div className="pvpres-stage">
              <CyberAvatar model={me} yaw={0} pose={result.win ? "win" : "down"} glow={colorway.glow} accent={colorway.accent} armorA="#1b2436" armorB="#41608a" />
            </div>
            <div className="pvpres-score">{result.score}</div>
            {result.win && CLASS_WIN_LINES[myCls] && (
              <div className="pvpres-line">"{tr3(myRank >= 6 ? CLASS_WIN_LINES[myCls].ult : CLASS_WIN_LINES[myCls].line, lang)}"</div>
            )}
            {result.rounds && (
              <div className="pvpres-rounds">
                <span className={result.rounds.me > result.rounds.op ? "on" : ""}>{result.rounds.me}</span>
                <em>{T("ยก", "ROUNDS", "回合")}</em>
                <span className={result.rounds.op > result.rounds.me ? "on" : ""}>{result.rounds.op}</span>
              </div>
            )}
            <div className="pvpres-sub">
              {T("ตอบถูก", "Correct", "答对")} {result.correct}/{result.asked} ·
              {" "}{T("คอมโบสูงสุด", "Best hits", "最高连击")} {result.bestCombo} ·
              {" "}HP {Math.max(0, Math.round(result.myHp))}
            </div>
            {result.practice && (
              <div className="pvpres-flawless">🎓 {T("โหมดซ้อม — ไม่มีรางวัล", "Practice mode — no rewards", "陪练模式 — 无奖励")}</div>
            )}
            {result.flawless && (
              <div className="pvpres-flawless">✨ {T("ไร้ที่ติ — ตอบถูกครบทุกข้อ", "FLAWLESS — every question right", "完美无瑕 — 全部答对")}</div>
            )}
            {result.weeklyWin && (
              <div className="pvpres-flawless">👑 {T("แชมป์บอสประจำสัปดาห์!", "Weekly Boss defeated!", "本周首领已击败！")}</div>
            )}
            {result.rivalMatch && (
              <div className="pvpres-flawless">😤 {result.win ? T(`ชนะ ${rival.name}!`, `Beat ${rival.name}!`, `击败了 ${rival.name}！`) : T(`แพ้ ${rival.name}`, `Lost to ${rival.name}`, `败给了 ${rival.name}`)}</div>
            )}
            {result.newDailyBest && (
              <div className="pvpres-flawless">🎯 {T("สถิติสูงสุดของวันนี้ครั้งใหม่!", "New daily best!", "今日最高分！")}</div>
            )}
            {!result.practice && (
              <div className="pvpres-rew">
                <span>🪙 {Math.round((result.win ? result.tier.coins : Math.round(result.tier.coins * .25)) * flawlessMul)}</span>
                <span>✦ {Math.round((result.win ? result.tier.xp : Math.round(result.tier.xp * .3)) * flawlessMul)}</span>
                <span style={{ color: clsInfo.c }}>SP +{Math.round((result.win ? result.tier.sp : Math.round(result.tier.sp * .35)) * flawlessMul)}</span>
              </div>
            )}
            {g && g.rankedUp && <div className="pvpres-rank" style={{ "--cc": clsInfo.c }}>⬆ {tr3(clsInfo, lang)} {T("แรงก์", "rank", "等级")} {g.rank}</div>}
            {result.newGhost && (
              <div className="pvpres-flawless">👤 {T("บันทึกเป็นเงาตัวใหม่แล้ว", "Saved as your new ghost", "已保存为新的幽灵")}</div>
            )}
            {result.placing && (
              <div className="pvpres-flawless">🎖 {T("แมตช์จัดอันดับ — แต้มคูณสอง", "Placement match — double points", "定级赛 — 双倍积分")}</div>
            )}
          </div>

          {/* ── what the three objectives asked for, and how it went ── */}
          {!result.practice && result.objectives && result.objectives.length > 0 && (
            <div className="pvpobjres">
              <b>{T("ภารกิจแมตช์นี้", "Match objectives", "本场任务")}</b>
              {result.objectives.map(o => (
                <div key={o.key} className={`pvpobj${o.done ? " on" : ""}`}>
                  <span>{o.done ? "✓" : "○"}</span>
                  <i>{tr3(o, lang)}</i>
                  <em>⚔ {o.v}</em>
                </div>
              ))}
            </div>
          )}
          {/* trials clear once, ever, so they are worth calling out loudly */}
          {!result.practice && result.trialsCleared && result.trialsCleared.length > 0 && (
            <div className="pvpobjres trial">
              <b>🎯 {T("ผ่านบททดสอบใหม่!", "New trials cleared!", "新试炼达成！")}</b>
              {result.trialsCleared.map(t => (
                <div key={t.key} className="pvpobj on">
                  <span>✓</span><i>{tr3(t, lang)}</i><em>⚔ {t.v}</em>
                </div>
              ))}
            </div>
          )}
          {!result.practice && result.valorGain > 0 && (
            <div className="pvpvalorgain">⚔ +{result.valorGain} {T("วาเลอร์", "Valor", "勇气值")}</div>
          )}

          {oppKind === "player" && pendingFriend && !pendingFriend.duel && (
            <button className="pvpbig" onClick={() => { if (onChallenge) onChallenge(pendingFriend, result.score); setPhase("lobby"); }}>
              {T("ส่งคะแนนไปท้า", "Send this score as a challenge", "发送分数发起挑战")} {oppName} →
            </button>
          )}
          {oppKind === "player" && pendingFriend && pendingFriend.duel && (
            <button className="pvpbig" onClick={() => { if (onRespondDuel) onRespondDuel(pendingFriend.duel, result.score); setPhase("lobby"); }}>
              {T("ส่งคะแนนตอบกลับ", "Submit your score", "提交你的分数")} →
            </button>
          )}
          <div className="pvpres-btns">
            <button className="pvpghost" onClick={() => setPhase("lobby")}>{T("กลับสนาม", "Back to arena", "返回竞技场")}</button>
            <button className="pvpghost" onClick={() => setPhase("fight")}>{T("สู้อีกครั้ง", "Rematch", "再战")}</button>
          </div>
          {onShare && (
            <button className="pvpghost pvpshare" onClick={() => onShare(result)}>📤 {T("แชร์ผลการต่อสู้", "Share this fight", "分享战绩")}</button>
          )}
        </div>
      </div>
    );
  }

  /* ── fight ── */
  return (
    <ArenaFight
      key={`${oppKind}-${tier.key}-${phase}-${gauntlet ? "g" + gauntlet.ix : "x"}`}
      lang={lang} me={me} gear={gear} myRank={myRank} tier={tier} sp={sp}
      initHpFrac={gauntlet ? gauntlet.hpFrac : 1} colorway={colorway} practice={practiceMode}
      objectives={objectives}
      oppKind={oppKind} oppName={oppName} onDone={finish} onBack={() => setPhase("lobby")} playUi={playUi}
    />
  );
});

/* ── the fight ──
   The question used to gate every single action: nothing happened until you
   answered, which made a duel feel like a worksheet with robots drawn on it.
   It is the other way round now. You FIGHT — tap to strike, hold to guard, in
   real time — and a question arrives every fifteen seconds as an interruption,
   at a point where you are already invested in the round. Answering right buys
   an overdrive; answering wrong takes a flat 30% off your bar. The music
   knowledge still decides duels, it just stops standing between the player and
   the game. */
/* A music question every fifteen seconds, all the way through the fight. The
   arena is a music game before it is a brawler: fifteen seconds of action, one
   question, repeat. Eight of those is about two minutes, which is roughly what
   a round used to take — the difference is that it now asks eight times rather
   than four. The question itself stays untimed; the fifteen seconds is the gap
   between questions, not a shot clock on your thinking. */
const ASK_EVERY = 15000;
const ASK_ROUNDS = 8;
const WAVES = Array.from({ length: ASK_ROUNDS }, () => ASK_EVERY);
const GUARD_MS = 900, GUARD_CD = 2400;
/* The old fixed attack cadence, kept only as the shape of each tier's
   pressure — BOT_BRAIN below is what actually drives the bot now. */

/* ══════════════════════ the fighting game underneath ══════════════════════

   What the arena was missing was not more numbers — it was the grammar every
   fighting game is built out of. A hit had no weight and no consequence; the
   bot was a metronome that dealt damage on a timer whether or not it was
   anywhere near you; and a fight was one long bar rather than rounds. All
   three are why it read as a tapping toy instead of a fight.

   So: three rounds, first to two. Every attack now has STARTUP (the wind-up
   you can see and react to), ACTIVE (the instant it can actually land, and
   only if the range is real) and RECOVERY (the window where whiffing gets
   you punished). Getting hit costs you HITSTUN — a beat where you cannot
   act — and pushes you back, so spacing means something. Hitting somebody
   during their own startup is a COUNTER-HIT and pays extra. Enough hits in a
   row and they are DIZZY and yours for two seconds.

   The bot fights by the same rules the player does. It walks itself into
   range, telegraphs, blocks when it reads an attack coming, and eats a punish
   when it whiffs. Which tier you picked decides how good it is at all four. */
const ROUNDS_TO_WIN = 2, MAX_ROUNDS = 3;
const HITSTUN_MS = 250, KNOCKBACK = 0.032;
const COUNTER_MUL = 1.6;
const STUN_HITS = 6, STUN_WINDOW = 2600, STUN_MS = 2000;
const THROW_RANGE = 0.2, THROW_CD = 2000, THROW_DMG = 3.6;
const MOTION_WINDOW = 720;        // how long a direction stays live in the buffer
const SPECIAL_COST = 18;          // gauge per special move
const ROUND_INTRO_MS = 1150, FIGHT_CALL_MS = 800, ROUND_END_MS = 1700;
// a round has a clock, the way every cabinet round does, and running it out
// hands the round to whoever is further ahead rather than stalling forever
const ROUND_TIME = 45000;

/* ══════════ round two: the rules a cabinet has and this did not ══════════

   HITSTOP. The frame a blow connects is the frame the whole world holds
   still. It is the cheapest thing in the genre and the most felt — players
   cannot name it, but they can tell instantly when it is missing. Heavier
   moves hold longer.

   THE CORNER. X_MIN/X_MAX used to be nothing but a clamp on a number. Your
   back against the wall is now the worst place to be: you cannot give ground,
   and everything hurts more. It is the one spatial idea that makes walking
   forward a threat instead of a way to get in range.

   THE GUARD METER. Guard already cost a little chip damage, but it never ran
   out, so holding it was free in every way that mattered. It is a resource
   now: block too much and it breaks, and a broken guard leaves you staggered.

   THE STAGGER. A wrong answer used to remove a flat 30% of the pool and end
   there — a tax, paid and forgotten. It now leaves you STAGGERED: no guard,
   half again the damage, three seconds. It is the same severity delivered as
   something you have to survive rather than something you simply absorb. */
const HITSTOP = { punch: 60, kick: 80, fire: 45, rocket: 110, throw: 90, ult: 130 };
/* ── the shot clock ──
   The quiz used to be untimed, which sounds kind and is not: an untimed
   question in the middle of a fight is a fight that stops. Four seconds is
   enough to know an interval and not enough to work it out on your fingers,
   which is exactly the line between recall and arithmetic. */
const QUIZ_TIME = 4000;
const ULTQ_TIME = 2200;          // the super's own question, deliberately tighter
/* Answering fast is worth more than answering slowly. Under a second and a
   half the gauge fills outright and the next special is free — the reward
   for actually KNOWING it rather than reasoning to it in time. */
const FAST_MS = 1500, QUICK_MS = 3000;
/* One octave, drawn the way a piano is. A learner picks a KEY, not a spelling
   — F# and Gb are the same key under the hand, and judging the answer by
   pitch is both the musically honest rule and the only one a keyboard can
   express. */
const KEYS = [
  { n: "C", b: false }, { n: "C#", b: true }, { n: "D", b: false }, { n: "D#", b: true },
  { n: "E", b: false }, { n: "F", b: false }, { n: "F#", b: true }, { n: "G", b: false },
  { n: "G#", b: true }, { n: "A", b: false }, { n: "A#", b: true }, { n: "B", b: false },
];
const FLAT_OF = { "C#": "D♭", "D#": "E♭", "F#": "G♭", "G#": "A♭", "A#": "B♭" };
// the three question kinds whose answer is a note you can physically play
const PLAYABLE = { iv: 1, degree: 1, scale: 1 };
const CORNER_ZONE = 0.055, CORNER_DMG = 1.15;
const GUARD_MAX = 100, GUARD_HIT_COST = 24, GUARD_REGEN = 8;   // regen per second
const STAGGER_MS = 3000, STAGGER_DMG = 1.5;
// the immediate sting of a wrong answer; the stagger that follows is the
// real price, and unlike a flat 30% it is one a good player can play through
const WRONG_CHIP = 0.08;

/* Every button now costs time as well as cooldown: a short wind-up before it
   can land, and a longer tail where you are committed and punishable. The
   rocket is the extreme of both — the biggest hit in the game, and the one
   that gets you counter-hit if you throw it out at nothing. */
const FRAMES = {
  punch:  { startup: 70,  recover: 150 },
  kick:   { startup: 130, recover: 250 },
  fire:   { startup: 60,  recover: 120 },
  rocket: { startup: 230, recover: 460 },
  throw:  { startup: 90,  recover: 300 },
  dash:   { startup: 140, recover: 320 },
  rise:   { startup: 100, recover: 380 },
  blast:  { startup: 180, recover: 300 },
};

/* ── how it plays, as opposed to how well ──
   The ten tiers are a difficulty dial: the same fighter, faster. That is why
   the fifth bot and the eighth bot felt like one opponent at two speeds.
   Style is the other axis. It does not change how GOOD the bot is at all —
   only what it wants: where it would rather stand, which of the four buttons
   it reaches for, whether it would rather block you or grab you. Ten tiers
   times five styles is fifty fights out of the same brain.

   `gap` is the distance it tries to hold. `wPunch/wKick/wFire` are how it
   picks a move once it commits. `poke` is how willing it is to throw
   something out from range, `grab` how readily it goes for a throw, and
   aggro/block/jump scale the tier's own numbers rather than replacing them. */
const BOT_STYLE = {
  rushdown:  { th: "สายบุก",      en: "Rushdown",  zh: "压制型",
    aggro: 1.28, block: 0.55, jump: 1.6, gap: 0.20, wPunch: .50, wKick: .38, heavy: .04, poke: .04, grab: .10 },
  zoner:     { th: "สายยิงไกล",   en: "Zoner",     zh: "远程型",
    aggro: 0.80, block: 1.00, jump: 0.5, gap: 0.60, wPunch: .12, wKick: .18, heavy: .13, poke: .42, grab: .02 },
  grappler:  { th: "สายจับทุ่ม",  en: "Grappler",  zh: "投技型",
    aggro: 1.10, block: 0.80, jump: 0.7, gap: 0.17, wPunch: .55, wKick: .40, heavy: .05, poke: .02, grab: .34 },
  turtle:    { th: "สายตั้งรับ",  en: "Turtle",    zh: "防守型",
    aggro: 0.62, block: 1.75, jump: 0.4, gap: 0.33, wPunch: .34, wKick: .50, heavy: .10, poke: .08, grab: .12 },
  trickster: { th: "สายหลอก",     en: "Trickster", zh: "欺诈型",
    aggro: 1.00, block: 1.20, jump: 1.9, gap: 0.40, wPunch: .34, wKick: .28, heavy: .09, poke: .22, grab: .16 },
};
const BOT_STYLE_ORDER = ["rushdown", "zoner", "grappler", "turtle", "trickster"];
/** Stable for a named opponent (a rival is always the same fighter), rolled
    fresh for an anonymous bot (so the same tier twice is two fights). */
function styleFor(seedStr) {
  let h = 0;
  for (let i = 0; i < String(seedStr).length; i++) h = (h * 31 + String(seedStr).charCodeAt(i)) >>> 0;
  return BOT_STYLE_ORDER[h % BOT_STYLE_ORDER.length];
}

/* ── the weekly boss's one broken rule ──
   A featured bot that is just a normal bot paying double was a reason to
   collect, not a reason to turn up. Each week it gets exactly ONE rule that
   nothing else in the game is allowed to have, so the week's question is
   "what is it doing this time" rather than "which tier is it". */
const BOSS_RULES = {
  armor:      { th: "เกราะ: หมัดแรกของทุกยกไม่สะเทือน", en: "ARMOR — shrugs off the first hit of every round", zh: "霸体 — 无视每回合第一击" },
  grip:       { th: "มือเหล็ก: ทุ่มแรงสองเท่า แต่แก้ทุ่มของคุณไม่ได้", en: "IRON GRIP — double throw damage, but it can never tech yours", zh: "铁腕 — 投技伤害翻倍，但无法受身" },
  feed:       { th: "ดูดพลัง: ตอบผิดเมื่อไหร่มันฟื้นเลือด", en: "FEEDER — it heals every time you answer wrong", zh: "汲取 — 你每答错一次它就回血" },
  relentless: { th: "ไม่ยั้ง: แทบไม่มีจังหวะพักฟื้นให้สวน", en: "RELENTLESS — almost no recovery to punish", zh: "无休 — 几乎没有硬直可反击" },
};
const BOSS_RULE_ORDER = ["armor", "grip", "feed", "relentless"];

/* How well the bot plays, per tier. `block` is how often it reads an incoming
   attack, `aggro` how willing it is to commit, and startup/recover are its own
   frames — a novice telegraphs for nearly half a second and stands in its
   recovery forever, a legend barely gives you a window at all. */
const BOT_BRAIN = {
  novice:   { startup: 430, recover: 640, block: .05, aggro: .34, jump: .02, throwEsc: .1 },
  rookie:   { startup: 390, recover: 580, block: .11, aggro: .42, jump: .03, throwEsc: .15 },
  cadet:    { startup: 355, recover: 530, block: .17, aggro: .48, jump: .05, throwEsc: .2 },
  veteran:  { startup: 320, recover: 480, block: .25, aggro: .55, jump: .07, throwEsc: .28 },
  ranger:   { startup: 295, recover: 435, block: .33, aggro: .62, jump: .09, throwEsc: .35 },
  ace:      { startup: 270, recover: 395, block: .41, aggro: .68, jump: .11, throwEsc: .42 },
  elite:    { startup: 248, recover: 355, block: .49, aggro: .74, jump: .13, throwEsc: .5 },
  warlord:  { startup: 228, recover: 318, block: .57, aggro: .80, jump: .15, throwEsc: .57 },
  overlord: { startup: 208, recover: 284, block: .65, aggro: .86, jump: .17, throwEsc: .64 },
  legend:   { startup: 188, recover: 252, block: .73, aggro: .92, jump: .20, throwEsc: .72 },
};

/* Three motions, three buttons. Nothing here is a secret: the lobby lists
   them and the input display shows what the game just read, the way a
   training mode does, so learning them is practice rather than folklore. */
/* ── the moves, per class ──
   All seven classes used to share these three, which meant choosing a class
   changed the colour of your robot and the numbers on your stat line and
   nothing about how you actually fought. The three MOTIONS stay the same for
   everyone on purpose — ▶▶, ◀▶ and ◀◀ is the whole grammar, and relearning
   it per class would be hostile — but what comes out of them is now the
   class's own, with a small mechanical rider that matches what the class is
   supposed to be for. A Bulwark's specials give it its guard back. A Ghost's
   put it somewhere else. A Virtuoso's get better the longer the combo runs.

   `fx` riders: push (extra knockback) · heal · guardFill · gauge (refund) ·
   teleport (cross up behind them) · multi (hit count) · comboScale. */
const MOTION_SLOTS = [
  { act: "punch", motion: [1, 1],   glyph: "▶▶" },
  { act: "kick",  motion: [-1, 1],  glyph: "◀▶" },
  { act: "fire",  motion: [-1, -1], glyph: "◀◀" },
];
const CLASS_SPECIAL_DEFS = {
  striker: [
    { key: "dash",   dmg: 3.6, move: "punch",  th: "หมัดพุ่ง",     en: "Dash Fist",      zh: "冲拳" },
    { key: "rise",   dmg: 4.0, move: "kick",   th: "เตะทะยาน",    en: "Rising Kick",    zh: "升龙踢" },
    { key: "blast",  dmg: 3.2, move: "laser",  th: "ลำแสงอัด",    en: "Charge Blast",   zh: "蓄力波" },
  ],
  bulwark: [
    { key: "dash",   dmg: 3.0, move: "punch",  fx: { guardFill: 45 },  th: "หมัดสมอ",      en: "Anchor Fist",    zh: "定锚拳" },
    { key: "rise",   dmg: 3.4, move: "kick",   fx: { stun: 2 },        th: "กระแทกโล่",    en: "Shield Bash",    zh: "盾击" },
    { key: "blast",  dmg: 2.8, move: "laser",  fx: { push: 0.14 },     th: "คลื่นผลัก",    en: "Bulwark Wave",   zh: "壁垒波" },
  ],
  ghost: [
    { key: "dash",   dmg: 3.2, move: "punch",  fx: { teleport: 1 },    th: "ก้าวเงา",      en: "Phantom Step",   zh: "幻影步" },
    { key: "rise",   dmg: 3.8, move: "kick",   th: "ฉีกเงา",       en: "Shadow Rip",     zh: "影裂" },
    { key: "blast",  dmg: 3.0, move: "laser",  fx: { pierce: 1 },      th: "หอกสุญญากาศ",  en: "Void Lance",     zh: "虚空枪" },
  ],
  virtuoso: [
    { key: "dash",   dmg: 2.6, move: "punch",  fx: { comboScale: 0.22 }, th: "หมัดไต่เสียง", en: "Crescendo Fist", zh: "渐强拳" },
    { key: "rise",   dmg: 3.6, move: "kick",   th: "เตะโน้ตประดับ", en: "Grace Note Kick", zh: "装饰音踢" },
    { key: "blast",  dmg: 3.0, move: "laser",  fx: { gauge: 14 },      th: "ลำแสงกำทอน",   en: "Resonance Beam", zh: "共鸣波" },
  ],
  engineer: [
    { key: "dash",   dmg: 3.5, move: "punch",  th: "หมัดลูกสูบ",    en: "Piston Drive",   zh: "活塞冲" },
    { key: "rise",   dmg: 3.7, move: "kick",   th: "เตะเซอร์โว",    en: "Servo Kick",     zh: "伺服踢" },
    { key: "blast",  dmg: 1.4, move: "laser",  fx: { multi: 3 },       th: "ป้อมยิงรัว",    en: "Turret Volley",  zh: "炮塔连射" },
  ],
  herald: [
    { key: "dash",   dmg: 3.4, move: "punch",  fx: { heal: 0.05 },     th: "หมัดประกาศ",   en: "Fanfare Fist",   zh: "号角拳" },
    { key: "rise",   dmg: 4.0, move: "kick",   th: "เตะทะยานฟ้า",   en: "Ascend Kick",    zh: "升天踢" },
    { key: "blast",  dmg: 3.0, move: "laser",  fx: { guardFill: 30 },  th: "ลำแสงบทเพลง",  en: "Hymn Blast",     zh: "圣歌波" },
  ],
  tactician: [
    { key: "dash",   dmg: 3.3, move: "punch",  fx: { readCounter: 1 }, th: "หมัดอ่านเกม",  en: "Read Punch",     zh: "读招拳" },
    { key: "rise",   dmg: 3.6, move: "kick",   th: "เตะเปลี่ยนมุม",  en: "Pivot Kick",     zh: "转身踢" },
    { key: "blast",  dmg: 3.1, move: "laser",  fx: { cull: 2 },        th: "ลำแสงพยากรณ์", en: "Predict Beam",   zh: "预判波" },
  ],
};
/** The three motions, filled in with one class's moves. */
function specialsOf(clsKey) {
  const defs = CLASS_SPECIAL_DEFS[clsKey] || CLASS_SPECIAL_DEFS.striker;
  return MOTION_SLOTS.map((slot, i) => ({ ...slot, ...defs[i], fx: defs[i].fx || {} }));
}

/* ── comeback, tutorial, sudden death ──
   Three small rules that used to make a losing fight feel like a foregone
   conclusion: no reason to keep tapping once you were behind, no one ever
   explained the guard button existed, and a close fight at the final bell was
   decided silently by a percentage instead of one last exchange. */
const COMEBACK_HP = 0.25, COMEBACK_DMG = 1.20, COMEBACK_GAUGE = 1.30;
const SUDDEN_DEATH_MARGIN = 0.08, SUDDEN_DEATH_DMG = 2, SUDDEN_DEATH_TIMEOUT = 10000;
const TUT_KEY = "tg_pvp_tut_seen";

/* ── the moveset ──
   Once the robots can walk, the buttons have to mean different things or the
   stick is decoration. A punch hits hardest and only lands in close; the
   blaster reaches but hits softest; the rocket reaches and hurts, and makes
   you wait for it. Jumping lifts you over anything on the ground, which is
   the only answer to a bot that is faster than you. */
const ACT = {
  punch:  { cd: 400,  dmg: 1.55, range: 0.27, move: "punch",   sfx: "hit" },
  /* a kick is slower than a punch and reaches a little further, and it hits
     harder for it — the trade every fighting game makes between the two */
  kick:   { cd: 620,  dmg: 2.35, range: 0.34, move: "kick",    sfx: "kick" },
  fire:   { cd: 330,  dmg: 0.72, range: 9,    move: "blaster", sfx: "shot" },
  rocket: { cd: 3400, dmg: 3.2,  range: 9,    move: "grenade", sfx: "lob" },
};
const JUMP_MS = 760, JUMP_CD = 1150;
const WALK = 0.42;                             // stage-widths per second
const X_MIN = 0.08, X_MAX = 0.92, GAP_MIN = 0.16;

// two full-body SVGs re-rendering on every HP tick would be the whole frame
// budget; they only actually change when a pose or an angle does
const Bot = memo(CyberAvatar);

const ArenaFight = memo(function ArenaFight({ lang, me, gear, myRank, tier, oppKind, oppName, onDone, onBack, playUi, initHpFrac = 1, sp = null, colorway = null, practice = false, objectives = [] }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const myCls = classKeyOf(me);
  const fx = CLASS_FX[myCls] || CLASS_FX.striker;
  const clsInfo = MODEL_CLASS[myCls] || MODEL_CLASS.striker;
  const myGlow = (colorway && colorway.glow) || "#00b8d4", myAccent = (colorway && colorway.accent) || "#7c4dff";
  const oppModel = useRef(chassisFor(oppKind === "player" ? oppName : tier.key + "-" + Math.floor(Math.random() * 999))).current;
  const oppCls = classKeyOf(oppModel);
  // a small, honest nudge from the class ring (+10%/-10%), not a hard counter
  const matchup = classMatchup(myCls, oppCls);
  // ranking a second class alongside this one unlocks a small cross-training bonus
  const synergy = hasSynergy(sp, myCls);
  /* Which arena this fight happens in. Seeded from the opponent so a rematch
     against the same chassis stays in the same place, and so two players
     fighting the same bot see the same room. Computed early because its
     small combat trade-off (SFX) feeds the HP pools below. */
  const ARENA = useRef(pickStage(
    String(oppKind === "player" ? oppName : oppModel).split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 7)
  )).current;
  const SFX = stageFx(ARENA);

  const A = useRef(fighterFrom(me, gear, myRank)).current;
  const B = useRef(fighterFrom(oppModel, [], 5)).current;
  // every equipped item's archetype effect, aggregated once for the fight
  const itemFx = useRef(itemEffectsOf(gear)).current;
  /* ── the pet ──
     Read once, at the start of the fight, so a fight cannot change its own
     terms halfway through. A pet under 50% happiness returns null and does
     nothing at all — the care loop is what buys the bonus. */
  const PET = useRef(petBonusOf()).current;
  const petDmg = PET && PET.k === "dmg" ? 1 + PET.v : 1;
  const petGuard = PET && PET.k === "guard" ? 1 - PET.v : 1;
  const petSp = PET && PET.k === "sp" ? 1 + PET.v : 1;
  const petPic = useRef(readPet()).current;
  const wpn = (gear || []).find(g => g && g.id && String(g.id).startsWith("wpn-"));
  const myBolt = (wpn && wpn.sw && wpn.sw[0]) || "#7fe8ff";
  /* These pools are per ROUND, not per fight, which is why they are less than
     half what they were: a round wants to be over in half a minute or so, and
     a match is up to three of them plus the quiz breaks — about the two
     minutes the fight always took, just shaped like a fighting game now.
     Both damage constants are set against this pool, not the old one. */
  const MY_MAX = A.maxHp * 5 * (SFX.hpMax || 1), OP_MAX = B.maxHp * 5 * (SFX.hpMax || 1);
  const TAP_DMG = 0.55, BOT_DMG = 1.15;

  const [phase, setPhase] = useState("action");   // action | quiz | done
  const [wave, setWave] = useState(1);
  const [left, setLeft] = useState(WAVES[0]);
  // a Gauntlet leg after the first carries whatever fraction of the pool
  // survived the last one — "no rest between rounds" is the whole mechanic
  const [myHp, setMyHp] = useState(() => MY_MAX * Math.max(0.001, Math.min(1, initHpFrac)));
  const [opHp, setOpHp] = useState(OP_MAX);
  const [q, setQ] = useState(null);
  const [culled, setCulled] = useState([]);
  const [gauge, setGauge] = useState(() => Math.min(100, itemFx.gaugeStart));
  const [ultUsed, setUltUsed] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [asked, setAsked] = useState(0);
  const [score, setScore] = useState(0);
  const [myPose, setMyPose] = useState("ready");
  const [opPose, setOpPose] = useState("ready");
  const [flash, setFlash] = useState(null);
  const [locked, setLocked] = useState(false);
  const [banner, setBanner] = useState(null);
  const [guarding, setGuarding] = useState(false);
  const [overdrive, setOverdrive] = useState(false);
  const [buffs, setBuffs] = useState({ crit: 0, anthem: 0, block: 0, fortress: 0, phase: 0, foresee: 0, sustain: 0 });
  const [graceLeft, setGraceLeft] = useState(fx.passive === "grace" ? 1 : 0);
  const [lunge, setLunge] = useState(null);
  const [shake, setShake] = useState(0);
  const [finisher, setFinisher] = useState(false);
  const [outcome, setOutcome] = useState(null);       // "win" | "lose", set the instant finish() decides
  const [showTut, setShowTut] = useState(false);
  const tutShownRef = useRef(false);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const suddenDeathRef = useRef(false);
  const comebackAnnouncedRef = useRef(false);
  /* ── the fighting game's own state ── */
  const [round, setRound] = useState(1);
  const [roundWins, setRoundWins] = useState({ me: 0, op: 0 });
  const [announce, setAnnounce] = useState(null);   // {big, sub, kind}
  const [botTell, setBotTell] = useState(false);    // the bot is winding up — block or punish it
  const [botGuard, setBotGuard] = useState(false);
  const [dizzy, setDizzy] = useState({ me: false, op: false });
  const [inputs, setInputs] = useState([]);         // training-mode style input read-out
  const [chipHp, setChipHp] = useState({ me: 1, op: 1 });   // the delayed bar that trails the real one
  const [hitStop, setHitStop] = useState(false);   // the world is held for a beat
  const [hitDir, setHitDir] = useState("r");       // which way the blow was travelling
  const [corner, setCorner] = useState({ me: false, op: false });
  const [guardMtr, setGuardMtr] = useState(GUARD_MAX);
  const [stagger, setStagger] = useState(false);
  /* ── the training dummy ──
     Practice mode had live tips but no way to make the opponent DO anything,
     which meant you could not actually practise the thing you were failing
     at. Five behaviours, switchable mid-fight: a dummy that stands there for
     combo work, one that blocks everything so you have to throw it, one that
     punishes every whiff so you learn your own recovery, and one that grabs
     the moment you are in range. */
  const [dummy, setDummy] = useState("spar");
  const dummyRef = useRef("spar");
  const [showMoves, setShowMoves] = useState(false);
  const hitstopRef = useRef(0);                    // the tick simply does not advance until this
  const guardMtrRef = useRef(GUARD_MAX);
  const staggerRef = useRef(0);
  const [roundLeft, setRoundLeft] = useState(ROUND_TIME);
  const roundClockRef = useRef(0);
  const roundWinsRef = useRef({ me: 0, op: 0 });
  const roundRef = useRef(1);
  const liveRef = useRef(false);                    // true only between FIGHT! and the K.O.
  const hitstunRef = useRef({ me: 0, op: 0 });
  const stunHitsRef = useRef({ me: [], op: [] });   // timestamps, for the dizzy window
  const dizzyUntilRef = useRef({ me: 0, op: 0 });
  const myAtkRef = useRef({ startup: 0, recover: 0, act: null });
  const botRef = useRef({ state: "approach", until: 0, startup: 0, recover: 0, act: null, blockUntil: 0 });
  const motionRef = useRef([]);                     // {dir, t} directional history
  const throwCdRef = useRef(0), botThrowCdRef = useRef(0);
  const practiceTipsRef = useRef(new Set());
  /** Fires a live tip exactly once per key, per fight — practice mode only. */
  const practiceTip = (key, text) => {
    if (!practice || practiceTipsRef.current.has(key)) return;
    practiceTipsRef.current.add(key);
    later(() => { setBanner(text); later(() => setBanner(null), 2400); }, 650);
  };
  // ── where everyone is standing, and who is off the ground ──
  const [myX, setMyX] = useState(0.24);
  const [opX, setOpX] = useState(0.76);
  const [myAir, setMyAir] = useState(0);
  const [opAir, setOpAir] = useState(0);
  const [land, setLand] = useState(() => {
    try { return window.innerWidth > window.innerHeight * 1.25; } catch (e) { return false; }
  });
  const [cool, setCool] = useState({ punch: 0, fire: 0, rocket: 0, jump: 0, guard: 0 });
  const [reveal, setReveal] = useState(null);   // the answered question, held until the learner moves on
  const [quizLeft, setQuizLeft] = useState(QUIZ_TIME);   // the shot clock
  const [ultQ, setUltQ] = useState(null);      // the super's own question, mid-cinematic
  const [ultQLeft, setUltQLeft] = useState(ULTQ_TIME);
  const quizStartRef = useRef(0);              // when this question went up, for the speed tiers
  const freeSpecialRef = useRef(false);        // earned by a sub-1.5s answer
  const [freeSpecial, setFreeSpecial] = useState(false);

  const startedRef = useRef(Date.now());
  const doneRef = useRef(false);
  const hpRef = useRef({ me: MY_MAX * Math.max(0.001, Math.min(1, initHpFrac)), op: OP_MAX });
  const guardUntil = useRef(0), guardCd = useRef(0);
  const cdRef = useRef({ punch: 0, fire: 0, rocket: 0, jump: 0 });
  const jumpGateRef = useRef(0);   // when jump() is next allowed — separate from cdRef.jump's arc-timing role
  const posRef = useRef({ me: 0.24, op: 0.76 });
  const airRef = useRef({ me: 0, op: 0 });     // 0..1, height off the floor
  const dirRef = useRef(0);                     // -1 back, 0 still, +1 forward
  const comboRef = useRef(0), scoreRef = useRef(0), buffRef = useRef(buffs), graceRef = useRef(graceLeft);
  // the result screen is written from a timeout, which reads whatever render
  // it was created in — counters it reports have to live in refs or the last
  // answer of a fight never makes it on to the scoreboard
  const askedRef = useRef(0), correctRef = useRef(0);
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  useEffect(() => { buffRef.current = buffs; }, [buffs]);
  useEffect(() => { graceRef.current = graceLeft; }, [graceLeft]);

  // the arena is the one screen in the app worth turning the phone for
  useEffect(() => {
    const on = () => { try { setLand(window.innerWidth > window.innerHeight * 1.25); } catch (e) {} };
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);

  const G = useArenaFx(ARENA);
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createArenaAudio(ARENA);
  useEffect(() => { const a = audioRef.current; a.start(); return () => a.stop(); }, []);
  useEffect(() => {
    audioRef.current.setGear(myHp / MY_MAX < 0.34 || opHp / OP_MAX < 0.34);
  }, [myHp, opHp, MY_MAX, OP_MAX]);

  // ROUND 1 — FIGHT! Nothing lands before the announcer says so, on either
  // side, which is also what gives the stage and matchup callouts below room
  // to be read before anybody throws a punch.
  useEffect(() => { bossArmorRef.current = BOSS === "armor"; announceRound(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // teach the two things that are otherwise invisible math: which stage
  // trade-off is live, and whether the class matchup favours either side
  useEffect(() => {
    const t0 = ROUND_INTRO_MS + FIGHT_CALL_MS;
    const lbl = STAGE_FX_LABEL[ARENA.id];
    if (lbl) later(() => {
      setBanner(tr3(ARENA, lang) + " — " + tr3(lbl, lang));
      later(() => setBanner(null), 2000);
    }, t0);
    if (matchup !== 0) {
      later(() => {
        setBanner(matchup === 1
          ? T("ได้เปรียบคลาส! ดาเมจ +10% / รับดาเมจ -10%", "TYPE ADVANTAGE! +10% dmg / -10% dmg taken", "克制优势！伤害+10% / 承伤-10%")
          : T("เสียเปรียบคลาส! ดาเมจ -10% / รับดาเมจ +10%", "TYPE DISADVANTAGE! -10% dmg / +10% dmg taken", "克制劣势！伤害-10% / 承伤+10%"));
        later(() => setBanner(null), 2000);
      }, t0 + (lbl ? 2300 : 0));
    }
    if (synergy) {
      later(() => {
        setBanner(T("โบนัสข้ามคลาส! ดาเมจ/เกจ +8-10%", "CROSS-CLASS SYNERGY! +8-10% dmg/gauge", "跨职业加成！伤害/能量 +8-10%"));
        later(() => setBanner(null), 2000);
      }, t0 + (lbl ? 2300 : 0) + (matchup !== 0 ? 2300 : 0));
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const say = (side, text, kind) => { setFlash({ side, text, kind }); later(() => setFlash(null), 900); };

  const strike = useCallback((side, kind, colour, moveKey) => {
    const foe = side === "me" ? "op" : "me";
    const mv = MOVES[moveKey] || MOVES.punch;
    const big = kind === "ult", crit = kind === "crit";
    const power = big ? 2.2 : crit ? 1.5 : 1;
    if (mv.lunge) setLunge(side);
    setShake(big ? 3 : crit ? 2 : 1);
    const a = audioRef.current;
    /* ── hitstop ──
       Held on the frame the blow CONNECTS, not the frame the button was
       pressed, which is why each branch below schedules it at its own impact
       delay: a lobbed rocket lands a long way after it is thrown. The tick
       reads hitstopRef and stops advancing the floor entirely, so both robots
       and the round clock hang together for the beat. */
    const weight = mv.fx === "grenade" ? "rocket"
      : mv.fx === "laser" || mv.fx === "bolt" ? "fire"
      : mv.sfx === "kick" ? "kick" : "punch";
    const stopMs = big ? HITSTOP.ult : Math.round(HITSTOP[weight] * (crit ? 1.35 : 1));
    const freeze = (delay) => later(() => {
      if (doneRef.current) return;
      hitstopRef.current = Date.now() + stopMs;
      setHitDir(side === "me" ? "r" : "l");
      setHitStop(true);
      later(() => setHitStop(false), stopMs);
    }, delay);
    if (mv.fx === "bolt") {
      G.bolt(side, colour, crit ? 7 : 5, mv.part); a.sfx("shot");
      later(() => { G.burst(foe, power, colour); a.sfx("hit"); }, 190);
      freeze(190);
    } else if (mv.fx === "laser") {
      G.laser(side, colour, big ? 7 : crit ? 5 : 4, mv.part); a.sfx("laser");
      later(() => G.burst(foe, power * 1.1, colour), 130);
      if (big) later(() => { G.boom(foe, 1.5, colour); a.sfx("boom"); }, 260);
      freeze(130);
    } else if (mv.fx === "grenade") {
      a.sfx("lob");
      G.lob(side, colour, () => {
        G.boom(foe, big ? 2.4 : 1.5, "#ff9a3c"); G.flash("#fff4d0", big ? .6 : .34, .32);
        a.sfx("boom"); setShake(big ? 3 : 2); later(() => setShake(0), 480);
        // the lob's own callback IS its impact frame, so freeze from here
        freeze(0);
      });
    } else {
      /* ── melee ──
         Three beats, because a hit that is only a burst of sparks has no
         weight: the limb SWINGS (an arc you can see), it LANDS (a spiked
         flash, a shockwave and a cone of sparks thrown the way the blow was
         going), and the screen takes it (a harder shake and a short white
         flash). A kick swings from the floor and kicks dust up with it. */
      const isKick = mv.sfx === "kick";
      G.swipe(side, isKick ? "#ffd23f" : colour, isKick ? "kick" : "punch");
      a.sfx(isKick ? "kick" : crit ? "crit" : "hit");
      later(() => {
        G.impact(side, power * (isKick ? 1.25 : 1), colour, isKick ? "kick" : "punch");
        G.flash("#ffffff", big ? .5 : crit ? .3 : .18, .16);
        setShake(big ? 3 : crit ? 3 : 2);
        a.sfx("hit");
      }, isKick ? 175 : 140);
      freeze(isKick ? 175 : 140);
      if (big) later(() => { G.boom(foe, 2, colour); a.sfx("boom"); }, 300);
    }
    if (big && mv.fx !== "grenade") G.flash("#ffffff", .55, .34);
    later(() => { setLunge(null); setShake(0); }, mv.fx === "grenade" ? 900 : 520);
  }, [G]);

  /* ── the round ──
     A knockout ends a ROUND now, not the fight. Three of them, first to two,
     with the announcer calling every one of them the way an arcade cabinet
     would. The music quiz keeps running underneath across all three, so the
     thing that decides a match is still what you know. */
  // a per-fight copy: the wave clock tunes these live, and writing through to
  // the shared table would leave every later fight carrying the last one's
  // aggression
  const BRAIN = useRef({ ...(BOT_BRAIN[tier.key] || BOT_BRAIN.veteran) }).current;
  /* Which fighter this bot is, as opposed to how good. Seeded from the
     opponent so a named rival is always the same fighter, and effectively
     rolled for an anonymous bot so the same tier twice is two fights. */
  const MY_SPECIALS = useRef(specialsOf(myCls)).current;
  const styleKey = useRef(styleFor(String(oppModel) + oppName + tier.key + (oppKind === "bot" ? Math.floor(Math.random() * 997) : ""))).current;
  const STYLE = BOT_STYLE[styleKey] || BOT_STYLE.rushdown;
  const BOSS = tier.bossRule || null;
  const bossArmorRef = useRef(false);   // the ARMOR rule's one free hit this round
  /* ── what it learned from the last round ──
     Multipliers on top of the tier and the style, recomputed at every round
     break from how the player actually won or lost the one before. */
  const ADAPT = useRef({ aggro: 1, block: 1, jump: 1, grab: 1 }).current;
  /* Everything the trials and the match objectives are graded on. Kept in one
     ref rather than a dozen pieces of state: none of it is rendered during
     the fight, and the result screen is written from a timeout that would
     otherwise read a stale render. */
  const FLAGS = useRef({
    counters: 0, dizzyDealt: 0, cornerHits: 0, cornerKo: false, specialsLanded: 0,
    throwsLanded: 0, threwGuarding: false, usedSpecial: false, guardBroke: false,
    fastAnswers: 0, superRight: false, finishedWithSpecial: false,
    wonRoundNoGuard: false, perfectRound: false, everBelowHalf: false,
  }).current;
  const roundGuardRef = useRef(0);      // guard presses inside the current round
  const lastWasSpecialRef = useRef(false);
  const usedRef = useRef({ melee: 0, ranged: 0, guard: 0, special: 0, jump: 0, thrown: 0 });

  function announceRound() {
    if (doneRef.current) return;
    setAnnounce({ big: T(`ยกที่ ${roundRef.current}`, `ROUND ${roundRef.current}`, `第 ${roundRef.current} 回合`), kind: "round" });
    audioRef.current.sfx("bell");
    later(() => {
      if (doneRef.current) return;
      setAnnounce({ big: T("สู้!", "FIGHT!", "开始!"), kind: "fight" });
      audioRef.current.sfx("ult");
      G.flash("#ffffff", .3, .25);
      liveRef.current = true;
      later(() => setAnnounce(null), FIGHT_CALL_MS);
    }, ROUND_INTRO_MS);
  }

  /* ── what it learned ──
     Round two used to be round one again, byte for byte, which made a
     best-of-three three attempts at the same fight instead of one argument
     with a reply in it. The bot now looks at how the round it just played was
     actually played and leans the other way: walked down, it starts blocking;
     kept at arm's length, it starts jumping in; held block against, it starts
     grabbing. It says which, out loud, because an opponent that adapts in
     silence is indistinguishable from one that got lucky. */
  function adaptToLastRound() {
    const U = usedRef.current;
    const shots = U.melee + U.ranged;
    ADAPT.aggro = 1; ADAPT.block = 1; ADAPT.jump = 1; ADAPT.grab = 1;
    let note = null;
    if (shots >= 4 && U.ranged > U.melee * 1.4) {
      // zoned out: it comes to you, over the top
      ADAPT.jump = 2.1; ADAPT.aggro = 1.18;
      note = T("มันอ่านเกมยิงของคุณออก — เตรียมโดนกระโดดเข้าใส่",
        "It read your zoning — expect it to jump in",
        "它看穿了你的远程 — 小心它跳进来");
    } else if (shots >= 4 && U.melee > U.ranged * 1.6) {
      // walked down: it starts holding the button you keep running into
      ADAPT.block = 1.7; ADAPT.grab = 1.3;
      note = T("มันอ่านเกมบุกของคุณออก — มันจะการ์ดถี่ขึ้น",
        "It read your rushdown — it will block far more",
        "它看穿了你的压制 — 它会更频繁格挡");
    } else if (U.guard >= 5) {
      // turtled: throws are the answer and it has found them
      ADAPT.grab = 2.0; ADAPT.aggro = 1.12;
      note = T("คุณการ์ดเยอะไป — มันจะเข้ามาทุ่ม",
        "You blocked a lot — it will come in for throws",
        "你格挡太多 — 它会进来投技");
    } else if (U.special >= 3) {
      // reading your specials: it waits for the startup and punishes
      ADAPT.block = 1.5; ADAPT.aggro = 0.9;
      note = T("มันเริ่มรอสวนท่าไม้ตายของคุณ",
        "It is waiting to punish your specials now",
        "它开始等着惩罚你的必杀技");
    }
    usedRef.current = { melee: 0, ranged: 0, guard: 0, special: 0, jump: 0, thrown: 0 };
    if (note) later(() => {
      if (doneRef.current) return;
      setBanner("⟳ " + note);
      audioRef.current.sfx("charge");
      later(() => setBanner(null), 2600);
    }, ROUND_INTRO_MS + FIGHT_CALL_MS + 300);
  }

  function nextRound() {
    if (doneRef.current) return;
    adaptToLastRound();
    roundRef.current += 1; setRound(roundRef.current);
    hpRef.current = { me: MY_MAX, op: OP_MAX };
    setMyHp(MY_MAX); setOpHp(OP_MAX);
    posRef.current = { me: 0.24, op: 0.76 }; setMyX(0.24); setOpX(0.76);
    airRef.current = { me: 0, op: 0 }; setMyAir(0); setOpAir(0);
    hitstunRef.current = { me: 0, op: 0 };
    stunHitsRef.current = { me: [], op: [] };
    dizzyUntilRef.current = { me: 0, op: 0 }; setDizzy({ me: false, op: false });
    botRef.current = { state: "approach", until: 0, startup: 0, recover: 0, act: null, blockUntil: 0 };
    throwCdRef.current = 0; botThrowCdRef.current = 0;
    myAtkRef.current = { startup: 0, recover: 0, act: null };
    comboRef.current = 0; setCombo(0);
    roundClockRef.current = 0; setRoundLeft(ROUND_TIME);
    setMyPose("ready"); setOpPose("ready");
    setBotTell(false); setBotGuard(false);
    setChipHp({ me: 1, op: 1 });
    guardMtrRef.current = GUARD_MAX; setGuardMtr(GUARD_MAX);
    bossArmorRef.current = BOSS === "armor";
    staggerRef.current = 0; setStagger(false);
    hitstopRef.current = 0; setHitStop(false);
    setCorner({ me: false, op: false });
    announceRound();
  }

  /** One side's HP hit zero — bank the round, then either call the match or
      reset the floor and go again. */
  function roundOver(winner, byTime) {
    if (doneRef.current || !liveRef.current) return;
    liveRef.current = false;
    const loser = winner === "me" ? "op" : "me";
    // untouched all round is a PERFECT, exactly as the cabinet would call it
    const perfect = (winner === "me" ? hpRef.current.me : hpRef.current.op) >= (winner === "me" ? MY_MAX : OP_MAX) * 0.999;
    const w = { me: roundWinsRef.current.me, op: roundWinsRef.current.op };
    w[winner] += 1;
    roundWinsRef.current = w; setRoundWins(w);
    setMyPose(winner === "me" ? "win" : "down");
    setOpPose(winner === "me" ? "down" : "win");
    setFinisher(true); setOutcome(winner === "me" ? "win" : "lose");
    audioRef.current.sfx(winner === "me" ? "ult" : "lose");
    G.flash(winner === "me" ? "#ffd23f" : "#8899aa", .6, .5);
    G.boom(loser, 2.6, winner === "me" ? "#ffd23f" : "#ff2d55");
    setAnnounce({
      big: byTime ? T("หมดเวลา", "TIME UP", "时间到") : perfect ? "PERFECT" : "K.O.",
      sub: winner === "me"
        ? T("คุณชนะยกนี้", "You take the round", "你赢下本回合")
        : T("เสียยกนี้", "Round lost", "本回合失利"),
      kind: byTime ? "ko" : perfect ? "perfect" : "ko",
    });
    if (perfect) scoreRef.current += 500;
    if (winner === "me") {
      if (roundGuardRef.current === 0) FLAGS.wonRoundNoGuard = true;
      if (perfect) FLAGS.perfectRound = true;
    }
    roundGuardRef.current = 0;
    if (w[winner] >= ROUNDS_TO_WIN || roundRef.current >= MAX_ROUNDS) {
      later(() => matchOver(), ROUND_END_MS);
      return;
    }
    later(() => { setAnnounce(null); setFinisher(false); setOutcome(null); nextRound(); }, ROUND_END_MS);
  }

  /** The match itself is over — decided on rounds won, HP only breaking a tie. */
  function matchOver() {
    if (doneRef.current) return;
    doneRef.current = true;
    liveRef.current = false;
    const mHp = hpRef.current.me, oHp = hpRef.current.op;
    const rw = roundWinsRef.current;
    const win = rw.me !== rw.op ? rw.me > rw.op : (mHp / MY_MAX) >= (oHp / OP_MAX);
    // a KO is an actual zero, not a bell decided on percentages — only a real
    // knockout earns the slow-motion finisher, so the cinematic stays a
    // reward for landing the killing blow rather than firing on every fight
    const ko = win ? oHp <= 0 : mHp <= 0;
    const flawless = askedRef.current >= ASK_ROUNDS && correctRef.current === askedRef.current;
    setOutcome(win ? "win" : "lose");
    setPhase("done");
    setMyPose(win ? "win" : "down"); setOpPose(win ? "down" : "win");
    audioRef.current.stop();
    setAnnounce({
      big: win ? T("คุณชนะ", "YOU WIN", "你胜利了") : T("คุณแพ้", "YOU LOSE", "你败北了"),
      sub: `${rw.me} — ${rw.op}`,
      kind: win ? "win" : "lose",
    });
    if (ko) {
      setFinisher(true);
      audioRef.current.sfx(win ? "ult" : "lose");
      G.flash(win ? "#ffd23f" : "#8899aa", .6, .5);
      G.boom(win ? "op" : "me", 2.6, win ? "#ffd23f" : "#ff2d55");
    } else {
      audioRef.current.sfx(win ? "win" : "lose");
      G.flash(win ? "#ffd23f" : "#0b1526", .4, .6);
      G.burst(win ? "op" : "me", 2, win ? "#ffd23f" : "#8899aa");
    }
    const final = scoreRef.current + Math.max(0, Math.round(mHp)) + (win ? 400 : 0) + (flawless ? 300 : 0)
      + rw.me * 250;
    later(() => onDone({
      win, score: final, correct: correctRef.current, asked: askedRef.current,
      bestCombo: Math.max(bestCombo, comboRef.current),
      myHp: mHp, myMax: MY_MAX, opHp: oHp, opMax: OP_MAX, tier, seconds: Math.round((Date.now() - startedRef.current) / 1000),
      ko, flawless, suddenDeath: suddenDeathRef.current, oppKind, oppName, oppModel, myCls, oppCls,
      rounds: { me: rw.me, op: rw.op },
      // everything the trials and the match objectives are graded on
      flags: { ...FLAGS }, myModel: me, botStyle: styleKey,
    }), ko ? 2100 : 1300);
  }
  // every old call site still says finish(); the match is what it always meant
  const finish = matchOver;

  /** Track a landed hit for the dizzy window, and hand back true if this one
      was the hit that scrambled them. */
  function noteStunHit(side, now) {
    const list = stunHitsRef.current[side].filter(t => now - t < STUN_WINDOW);
    list.push(now);
    stunHitsRef.current[side] = list;
    if (list.length >= STUN_HITS && dizzyUntilRef.current[side] < now) {
      dizzyUntilRef.current[side] = now + STUN_MS;
      stunHitsRef.current[side] = [];
      setDizzy(d => ({ ...d, [side]: true }));
      later(() => setDizzy(d => ({ ...d, [side]: false })), STUN_MS);
      return true;
    }
    return false;
  }

  /** Open the player up for three seconds: no guard, half again the damage.
      Two things arrive here — a broken guard and a wrong answer — and both
      want the same thing, which is a window the opponent has to be beaten
      out of rather than a number quietly removed from a bar. */
  function beginStagger(label) {
    if (doneRef.current) return;
    const now = Date.now();
    staggerRef.current = now + STAGGER_MS;
    setStagger(true);
    guardUntil.current = 0; setGuarding(false);
    audioRef.current.sfx("miss");
    G.flash("#ff2d55", .4, .35);
    setBanner(label);
    later(() => setBanner(null), 1300);
    later(() => {
      if (Date.now() >= staggerRef.current) setStagger(false);
    }, STAGGER_MS + 30);
  }

  /** Damage the opponent. One path for taps, skills and the overdrive combo. */
  function hitOp(dmg, kind, moveKey, opts) {
    if (doneRef.current) return;
    const o = opts || {};
    const now = Date.now();
    // caught them mid-wind-up: in a fighting game that is a counter-hit, and
    // it is the whole reason to watch what the other side is doing
    const counter = !o.noCounter && botRef.current.startup > now;
    // the corner is not a player-only rule — pinning the bot against its own
    // wall is the reward for walking it down
    const oppCornered = posRef.current.op >= X_MAX - CORNER_ZONE;
    // the weekly boss's ARMOR: the first hit of each round does not move it
    if (bossArmorRef.current) {
      bossArmorRef.current = false;
      audioRef.current.sfx("block");
      G.burst("op", 1.1, "#ffd23f");
      say("op", T("เกราะ!", "ARMOR!", "霸体!"), "block");
      return;
    }
    const d = Math.max(1, Math.round(dmg * (counter ? COUNTER_MUL : 1) * (oppCornered ? CORNER_DMG : 1)));
    const oHp = Math.max(0, hpRef.current.op - d);
    hpRef.current.op = oHp; setOpHp(oHp);
    // hitstun and pushback: the bot loses its turn and gives ground
    hitstunRef.current.op = now + HITSTUN_MS;
    posRef.current.op = Math.min(X_MAX, posRef.current.op + KNOCKBACK);
    const bot = botRef.current;
    bot.startup = 0; bot.recover = now + HITSTUN_MS; bot.state = "hurt"; bot.act = null;
    setBotTell(false); setBotGuard(false);
    const mv = moveKey || pickMove(myCls);
    setMyPose(MOVES[mv].pose); setOpPose("hit");
    strike("me", counter ? "crit" : kind, myBolt, mv);
    if (counter) { FLAGS.counters += 1; say("op", T("สวนกลับ!", "COUNTER!", "反击!"), "crit"); }
    else say("op", "-" + d, kind === "crit" ? "crit" : "dmg");
    if (oppCornered) FLAGS.cornerHits += 1;
    scoreRef.current += Math.round((10 + comboRef.current * 2) * (SFX.scoreMul || 1) * itemFx.scoreMul * (counter ? 1.5 : 1));
    setScore(scoreRef.current);
    if (oHp > 0 && noteStunHit("op", now)) {
      FLAGS.dizzyDealt += 1;
      say("op", T("มึนงง!", "DIZZY!", "眩晕!"), "crit");
      audioRef.current.sfx("crit");
    }
    if (oHp <= 0) {
      if (oppCornered) FLAGS.cornerKo = true;
      FLAGS.finishedWithSpecial = lastWasSpecialRef.current;
      later(() => roundOver("me"), 380);
      return;
    }
    if (suddenDeathRef.current) later(finish, 420);
  }

  /** Damage the player, after every guard, block and dodge has had a say. */
  function hitMe(dmg, moveKey, opts) {
    if (doneRef.current) return;
    const o = opts || {};
    const nb = { ...buffRef.current };
    const now = Date.now();
    // a throw goes straight through a guard — that is what throws are for
    if (!o.unblockable) {
      // a stagger takes the guard away entirely — that is the whole point of it
      if (now < guardUntil.current && staggerRef.current <= now) {
        audioRef.current.sfx("block"); G.burst("me", .8, "#5ce1ff");
        // chip damage, so turtling forever is not a strategy
        const chip = Math.max(1, Math.round(dmg * 0.12));
        const cHp = Math.max(1, hpRef.current.me - chip);
        hpRef.current.me = cHp; setMyHp(cHp);
        posRef.current.me = Math.max(X_MIN, posRef.current.me - KNOCKBACK * 0.6);
        /* ── the guard meter ──
           Chip damage alone never made holding block a real decision, because
           the meter that mattered — the one that runs out — did not exist.
           Every blocked hit spends a quarter of it, and emptying it snaps the
           guard open and leaves you staggered, which is the moment the other
           side has been pressuring you for. */
        const gm = Math.max(0, guardMtrRef.current - GUARD_HIT_COST);
        guardMtrRef.current = gm; setGuardMtr(gm);
        if (gm <= 0) {
          guardUntil.current = 0; setGuarding(false);
          guardMtrRef.current = GUARD_MAX * 0.4; setGuardMtr(GUARD_MAX * 0.4);
          FLAGS.guardBroke = true;
          beginStagger(T("การ์ดแตก!", "GUARD BREAK!", "破防!"));
          practiceTip("guardbreak", T("กันมากไปการ์ดแตก — สลับถอยหรือสวนกลับบ้าง",
            "Blocking everything breaks your guard — mix in walking back or hitting first",
            "一味格挡会破防 — 试着后退或抢先出手"));
        } else say("me", T("กัน!", "GUARD", "格挡"), "block");
        return;
      }
      if (airRef.current.me > 0) { audioRef.current.sfx("miss"); say("me", T("หลบ!", "AIRBORNE", "腾空"), "block"); return; }
      if (graceRef.current > 0) { graceRef.current = 0; setGraceLeft(0); audioRef.current.sfx("block"); say("me", T("ยกโทษให้", "FREE MISS", "免罚"), "block"); return; }
      if (nb.fortress > 0 || nb.block > 0 || nb.phase > 0
        || (fx.passive === "evade" && Math.random() < 0.2)
        || Math.random() < itemFx.dodge || Math.random() < itemFx.blockChance) {
        if (nb.block > 0) { nb.block = 0; buffRef.current = nb; setBuffs(nb); }
        audioRef.current.sfx("block"); G.burst("me", .7, "#5ce1ff");
        say("me", T("กันได้!", "BLOCKED", "格挡"), "block"); return;
      }
    }
    // the bot gets counter-hits too, on exactly the same terms
    const counter = !o.noCounter && myAtkRef.current.startup > now;
    // your back is on the wall, or your guard has just been broken: both are
    // positions you got yourself into, and both cost extra
    const cornered = posRef.current.me <= X_MIN + CORNER_ZONE;
    const d = Math.max(1, Math.round(dmg * (fx.passive === "tough" ? 0.75 : 1) * petGuard * (SFX.dmgTake || 1)
      * (matchup === 1 ? 1 - MATCHUP_DMG : matchup === -1 ? 1 + MATCHUP_DMG : 1)
      * (1 - itemFx.dmgReduce) * (counter ? COUNTER_MUL : 1)
      * (cornered ? CORNER_DMG : 1) * (staggerRef.current > now ? STAGGER_DMG : 1)));
    const mHp = Math.max(0, hpRef.current.me - d);
    hpRef.current.me = mHp; setMyHp(mHp);
    if (mHp / MY_MAX < 0.5) FLAGS.everBelowHalf = true;
    hitstunRef.current.me = now + HITSTUN_MS;
    posRef.current.me = Math.max(X_MIN, posRef.current.me - KNOCKBACK);
    myAtkRef.current = { startup: 0, recover: now + HITSTUN_MS, act: null };
    // the first real hit of a player's life is the honest moment to teach
    // guard — anyone who never gets hit never needed the lesson anyway
    if (!tutShownRef.current) {
      let seen = false;
      try { seen = localStorage.getItem(TUT_KEY) === "1"; } catch (e) {}
      if (!seen) {
        tutShownRef.current = true; setShowTut(true);
        try { localStorage.setItem(TUT_KEY, "1"); } catch (e) {}
        later(() => setShowTut(false), 4200);
      }
    }
    practiceTip("guard", T("เคล็ดลับ: กดค้าง 🛡 ก่อนโดนตี!", "TIP: Hold 🛡 Guard right before a hit lands!", "小提示：被击中前按住 🛡 格挡！"));
    // halved, not reset: with the bot landing every ~1.2s a full reset means
    // the combo never gets past three and the mechanic may as well not exist
    // — except the ashfall stage, which trades a faster-growing combo for
    // exactly that harsher reset
    comboRef.current = SFX.comboFullReset ? 0 : Math.floor(comboRef.current / 2); setCombo(comboRef.current);
    const mv = moveKey || pickMove(oppCls);
    setOpPose(MOVES[mv].pose); setMyPose("hit");
    strike("op", counter ? "crit" : "hit", "#ff7a3c", mv);
    say("me", counter ? T("โดนสวน!", "COUNTER!", "被反击!") : "-" + d, "dmg");
    if (mHp > 0 && noteStunHit("me", now)) {
      say("me", T("มึนงง!", "DIZZY!", "眩晕!"), "dmg");
      practiceTip("dizzy", T("โดนรัวจนมึน — กันหรือกระโดดหนีตอนโดนต่อเนื่อง",
        "Too many hits in a row leaves you dizzy — guard or jump out of a rush",
        "连续被击中会眩晕 — 用格挡或跳跃脱身"));
    }
    if (mHp <= 0) { later(() => roundOver("op"), 380); return; }
    if (suddenDeathRef.current) later(finish, 420);
  }

  /* ── the input buffer ──
     Two directions inside three quarters of a second, then a button. That is
     the whole motion-input grammar, kept short deliberately: a quarter-circle
     is unreadable on a phone, but ▶▶ and ◀▶ are not. The read-out on screen
     shows exactly what the game heard, so a missed special is a thing you can
     see and fix rather than a mystery. */
  function pushMotion(dir) {
    const now = Date.now();
    const buf = motionRef.current.filter(m => now - m.t < MOTION_WINDOW);
    if (!buf.length || buf[buf.length - 1].dir !== dir) buf.push({ dir, t: now });
    motionRef.current = buf;
    setInputs(buf.slice(-4).map(m => (m.dir > 0 ? "▶" : "◀")));
    later(() => setInputs(i => (motionRef.current.length ? i : [])), MOTION_WINDOW);
  }
  /** Does the live buffer spell a special for this button? */
  function readMotion(act, now) {
    const buf = motionRef.current.filter(m => now - m.t < MOTION_WINDOW);
    motionRef.current = buf;
    if (buf.length < 2) return null;
    const last2 = [buf[buf.length - 2].dir, buf[buf.length - 1].dir];
    return MY_SPECIALS.find(s => s.act === act && s.motion[0] === last2[0] && s.motion[1] === last2[1]) || null;
  }

  /** Fire a special: gauge-priced, bigger than any normal button, and it
      announces itself by name so the motion that produced it is learnable. */
  function doSpecial(sp, now) {
    const F = FRAMES[sp.key] || FRAMES.punch;
    motionRef.current = []; setInputs([]);
    // a special bought by answering inside a second and a half costs nothing
    if (freeSpecialRef.current) { freeSpecialRef.current = false; setFreeSpecial(false); }
    else setGauge(g => Math.max(0, g - SPECIAL_COST));
    usedRef.current.special += 1;
    FLAGS.usedSpecial = true;
    myAtkRef.current = { startup: now + F.startup, recover: now + F.startup + F.recover, act: sp.key };
    cdRef.current[sp.act] = now + (ACT[sp.act] || ACT.punch).cd;
    setMyPose(MOVES[sp.move].pose);
    setLunge("me");
    audioRef.current.sfx("charge");
    setBanner(tr3(sp, lang).toUpperCase());
    later(() => setBanner(null), 900);
    later(() => {
      if (doneRef.current || !liveRef.current) return;
      myAtkRef.current.startup = 0;
      setLunge(null);
      // the dash closes the gap itself, which is the point of a lunging move
      if (sp.key === "dash") posRef.current.me = Math.min(X_MAX, posRef.current.me + 0.12);
      const reach = sp.key === "blast" ? 9 : ACT.kick.range + 0.06;
      if (Math.abs(posRef.current.me - posRef.current.op) > reach) {
        audioRef.current.sfx("miss"); say("me", T("พลาด!", "WHIFF", "落空"), "miss");
        later(() => setMyPose("ready"), 320);
        return;
      }
      comboRef.current += 1; setCombo(comboRef.current);
      setBestCombo(b => Math.max(b, comboRef.current));
      const R = sp.fx || {};
      FLAGS.specialsLanded += 1;
      lastWasSpecialRef.current = true;
      const dmg = A.dmg * TAP_DMG * sp.dmg * (fx.passive === "power" ? 1.25 : 1) * petDmg
        * (comeback ? COMEBACK_DMG : 1) * (suddenDeath ? SUDDEN_DEATH_DMG : 1)
        * (SFX.dmgDeal || 1) * (matchup === 1 ? 1 + MATCHUP_DMG : matchup === -1 ? 1 - MATCHUP_DMG : 1)
        * (synergy ? SYNERGY_DMG : 1)
        // a Virtuoso's opener is weak and grows with the phrase it is part of
        * (1 + (R.comboScale || 0) * comboRef.current);
      /* ── the class rider ──
         The part that makes three shared motions read as seven different
         movesets: the same input, the same cost, a different consequence. */
      if (R.multi) {
        // the Engineer's turret: one input, a burst
        for (let i = 0; i < R.multi; i++) later(() => hitOp(dmg, i === R.multi - 1 ? "ult" : "crit", sp.move, { noCounter: i > 0 }), i * 170);
      } else hitOp(dmg, "ult", sp.move, R.pierce ? { unblockable: true } : undefined);
      if (R.push) posRef.current.op = Math.min(X_MAX, posRef.current.op + R.push);
      if (R.stun) noteStunHit("op", Date.now());
      if (R.guardFill) {
        const gm = Math.min(GUARD_MAX, guardMtrRef.current + R.guardFill);
        guardMtrRef.current = gm; setGuardMtr(gm);
        say("me", T("การ์ดคืน", "GUARD UP", "格挡回复"), "block");
      }
      if (R.heal) {
        const h = Math.min(MY_MAX, hpRef.current.me + Math.round(MY_MAX * R.heal));
        hpRef.current.me = h; setMyHp(h);
        G.burst("me", .8, "#3ddc84"); say("me", "+" + Math.round(MY_MAX * R.heal), "heal");
      }
      if (R.gauge) setGauge(g => Math.min(100, g + R.gauge));
      if (R.teleport) {
        // the Ghost crosses up: it ends the move on the far side of them
        const opX2 = posRef.current.op;
        posRef.current.me = Math.min(X_MAX - GAP_MIN, Math.max(X_MIN, opX2 - GAP_MIN * 0.9));
        G.burst("me", 1, "#b98cff");
      }
      if (R.cull && q) {
        // the Tactician reads ahead: two wrong answers are gone before the
        // question is even asked
        setCulled(shuffle(q.opts.filter(o => o !== q.ans)).slice(0, R.cull));
        say("me", T("อ่านเกมออก", "READ AHEAD", "预判"), "buff");
      }
      if (R.readCounter) { const nb = { ...buffRef.current, crit: 1 }; buffRef.current = nb; setBuffs(nb); }
    }, F.startup);
  }

  /** A throw goes through a guard, and only lands nose to nose. It is the
      answer to an opponent who has decided to just hold block. */
  function doThrow(now) {
    throwCdRef.current = now + THROW_CD;
    usedRef.current.thrown += 1;
    const F = FRAMES.throw;
    myAtkRef.current = { startup: now + F.startup, recover: now + F.startup + F.recover, act: "throw" };
    setMyPose("attack"); setLunge("me");
    audioRef.current.sfx("kick");
    later(() => {
      if (doneRef.current || !liveRef.current) return;
      myAtkRef.current.startup = 0; setLunge(null);
      if (Math.abs(posRef.current.me - posRef.current.op) > THROW_RANGE + 0.04) {
        say("me", T("คว้าพลาด", "THROW MISSED", "抓空"), "miss");
        later(() => setMyPose("ready"), 320);
        return;
      }
      // a good bot wriggles out of it; a novice does not
      if (Math.random() < BRAIN.throwEsc) {
        say("op", T("หลุด!", "TECH!", "受身!"), "block");
        audioRef.current.sfx("block");
        return;
      }
      FLAGS.throwsLanded += 1;
      // attack() only routes punch into a throw when the bot is holding block,
      // so a landed throw here IS a throw through a guard
      if (botRef.current.blockUntil > Date.now() - 400) FLAGS.threwGuarding = true;
      setBanner(T("ทุ่ม!", "THROW!", "投技!"));
      later(() => setBanner(null), 800);
      comboRef.current += 1; setCombo(comboRef.current);
      posRef.current.op = Math.min(X_MAX, posRef.current.op + KNOCKBACK * 3);
      hitOp(A.dmg * TAP_DMG * THROW_DMG * petDmg * (comeback ? COMEBACK_DMG : 1), "crit", "punch", { noCounter: true, unblockable: true });
    }, F.startup);
  }

  /* ── your attacks ──
     Every button is now three phases rather than one instant: a wind-up you
     are committed to, the frame it can land on (and the range is checked
     THEN, so an opponent who walks back beats it), and a recovery tail where
     you are open. That tail is what makes whiffing cost something, and it is
     the difference between a fight and a tapping contest. */
  function attack(act) {
    if (phase !== "action" || doneRef.current || !liveRef.current) return;
    const A2 = ACT[act]; if (!A2) return;
    const now = Date.now();
    // hitstun, dizzy and your own recovery all lock you out — same rules the
    // bot plays by
    if (hitstunRef.current.me > now || dizzyUntilRef.current.me > now) return;
    if (myAtkRef.current.startup > now || myAtkRef.current.recover > now) return;
    if (now < cdRef.current[act] || now < guardUntil.current) return;

    // a motion in the buffer turns the same button into something else
    const sp = readMotion(act, now);
    if (sp && (freeSpecialRef.current || gauge >= SPECIAL_COST)) { doSpecial(sp, now); return; }

    // nose to nose against a guard, punch becomes a throw
    const gapNow = Math.abs(posRef.current.me - posRef.current.op);
    if (act === "punch" && gapNow <= THROW_RANGE && now >= throwCdRef.current
      && botRef.current.blockUntil > now) { doThrow(now); return; }

    lastWasSpecialRef.current = false;
    // the histogram the bot reads at the round break
    const U = usedRef.current;
    if (act === "punch" || act === "kick") U.melee += 1; else U.ranged += 1;
    const F = FRAMES[act] || FRAMES.punch;
    const cd = A2.cd * (act === "rocket" ? itemFx.rocketCdMul : 1);
    cdRef.current[act] = now + cd;
    setCool(c => ({ ...c, [act]: now + cd }));
    myAtkRef.current = { startup: now + F.startup, recover: now + F.startup + F.recover, act };
    setMyPose(MOVES[A2.move].pose);
    later(() => resolveAttack(act, A2), F.startup);
  }

  /** The frame the attack can actually land on. */
  function resolveAttack(act, A2) {
    if (doneRef.current || !liveRef.current) return;
    myAtkRef.current.startup = 0;
    const now = Date.now();
    // a punch thrown from across the arena is a whiff, not a hit — and the
    // range is judged here, at the end of the wind-up, not when it was pressed
    if (Math.abs(posRef.current.me - posRef.current.op) > A2.range) {
      audioRef.current.sfx("miss");
      say("me", T("พลาด!", "WHIFF", "落空"), "miss");
      later(() => setMyPose("ready"), 380);
      return;
    }
    // the bot is holding guard: chip it, and let them know a throw beats this
    if (botRef.current.blockUntil > now) {
      audioRef.current.sfx("block");
      G.burst("op", .6, "#5ce1ff");
      say("op", T("มันกันไว้", "GUARDED", "被格挡"), "block");
      const chip = Math.max(1, Math.round(A.dmg * TAP_DMG * A2.dmg * 0.14));
      const cHp = Math.max(1, hpRef.current.op - chip);
      hpRef.current.op = cHp; setOpHp(cHp);
      practiceTip("throw", T("มันการ์ดอยู่ — เข้าไปประชิดแล้วกดต่อยเพื่อทุ่ม",
        "It is guarding — walk right up and press Punch to throw instead",
        "它在格挡 — 贴近后按拳击可以投技"));
      return;
    }
    const nb = { ...buffRef.current };
    comboRef.current += 1; setCombo(comboRef.current);
    setBestCombo(b => Math.max(b, comboRef.current));
    const comboK = Math.min(2.2, 1 + comboRef.current * (fx.passive === "streak" ? 0.08 : 0.04) * (SFX.comboGrowth || 1) * itemFx.comboGrowth);
    const isMelee = act === "punch" || act === "kick";
    let dmg = A.dmg * TAP_DMG * A2.dmg * comboK * (fx.passive === "power" ? 1.25 : 1) * petDmg
      * (comeback ? COMEBACK_DMG : 1) * (suddenDeath ? SUDDEN_DEATH_DMG : 1)
      * (SFX.dmgDeal || 1) * (isMelee ? (SFX.meleeDmg || 1) : 1)
      * (matchup === 1 ? 1 + MATCHUP_DMG : matchup === -1 ? 1 - MATCHUP_DMG : 1)
      * (synergy ? SYNERGY_DMG : 1)
      * (isMelee ? itemFx.meleeDmg : act === "fire" ? itemFx.fireDmg : 1);
    let kind = act === "rocket" ? "ult" : "hit";
    if (nb.crit > 0) { dmg *= 2.2; nb.crit = 0; kind = "crit"; buffRef.current = nb; setBuffs(nb); }
    if (nb.anthem > 0) { dmg *= 1.4; nb.anthem -= 1; buffRef.current = nb; setBuffs(nb); }
    if (overdrive) dmg *= 1.6 * itemFx.overdriveDmg;
    if (Math.random() < A.follow) { dmg *= 1.5; if (kind === "hit") kind = "crit"; }
    if (SFX.critChance && Math.random() < SFX.critChance) { dmg *= 1.5; if (kind === "hit") kind = "crit"; }
    if (itemFx.critChance && Math.random() < itemFx.critChance) { dmg *= 1.5; if (kind === "hit") kind = "crit"; }
    if (fx.passive === "repair") {
      const h = Math.min(MY_MAX, hpRef.current.me + 2); hpRef.current.me = h; setMyHp(h);
    }
    setGauge(g => Math.min(100, g + (A.charge * (fx.passive === "resonate" ? 1.3 : 1) * petSp * (comeback ? COMEBACK_GAUGE : 1) * (SFX.gauge || 1) * (synergy ? SYNERGY_GAUGE : 1) * itemFx.gaugeMul) / 4));
    hitOp(dmg, kind, A2.move);
  }

  function jump() {
    if (phase !== "action" || doneRef.current || !liveRef.current) return;
    const now = Date.now();
    if (hitstunRef.current.me > now || dizzyUntilRef.current.me > now) return;
    if (myAtkRef.current.recover > now) return;
    if (now < jumpGateRef.current) return;
    // cdRef.current.jump anchors the footwork effect's arc-height math below,
    // which hardcodes JUMP_CD as the offset back to jump-start — it has to
    // stay tied to that same constant. The item's cooldown discount is
    // tracked separately, in the ready-to-jump-again gate only.
    usedRef.current.jump += 1;
    cdRef.current.jump = now + JUMP_CD;
    jumpGateRef.current = now + JUMP_CD * itemFx.jumpCdMul;
    setCool(c => ({ ...c, jump: jumpGateRef.current }));
    airRef.current.me = 1;
    audioRef.current.sfx("charge");
    later(() => { airRef.current.me = 0; setMyAir(0); }, JUMP_MS);
  }

  function guard() {
    if (phase !== "action" || doneRef.current || !liveRef.current) return;
    const now = Date.now();
    if (hitstunRef.current.me > now || dizzyUntilRef.current.me > now) return;
    // staggered means exactly this: the guard button does nothing
    if (staggerRef.current > now) {
      say("me", T("การ์ดไม่ได้!", "NO GUARD!", "无法格挡!"), "dmg");
      return;
    }
    if (guardMtrRef.current < GUARD_HIT_COST) {
      say("me", T("การ์ดหมด", "GUARD EMPTY", "格挡耗尽"), "dmg");
      return;
    }
    if (now < guardCd.current) return;
    guardUntil.current = now + GUARD_MS; guardCd.current = now + GUARD_CD;
    usedRef.current.guard += 1;
    roundGuardRef.current += 1;
    setGuarding(true);
    audioRef.current.sfx("charge");
    G.burst("me", .6, "#5ce1ff");
    later(() => setGuarding(false), GUARD_MS);
  }

  /* ── footwork and the bot's brain ──
     One 60ms tick runs the whole floor: it walks you, thinks for the bot,
     moves it, and eases both jumps.

     The bot used to be a metronome — a timer that dealt damage on a schedule
     whether or not it was standing anywhere near you, which is why the arena
     never read as a fight. It plays by the player's rules now. It walks
     itself into range. It winds up, and that wind-up is visible, which is
     the window to block it or hit it first. If it whiffs it stands in its
     own recovery long enough to be punished. It reads incoming attacks and
     blocks some of them. Which tier you picked is exactly how good it is at
     each of those four things, and nothing else. */
  useEffect(() => {
    if (phase !== "action" || doneRef.current) return;
    const id = setInterval(() => {
      if (doneRef.current) return;
      const now0 = Date.now();
      // HITSTOP: the frame a blow connects, nothing moves — not the fighters,
      // not the bot's brain, not the round clock. Everything resumes together.
      if (hitstopRef.current > now0) return;
      const dt = 0.06;
      const now = now0;
      const P = posRef.current;
      // guard comes back on its own, slowly, so a broken guard is a real
      // setback rather than a permanent one
      if (guardMtrRef.current < GUARD_MAX && guardUntil.current < now) {
        const gm = Math.min(GUARD_MAX, guardMtrRef.current + GUARD_REGEN * dt);
        guardMtrRef.current = gm; setGuardMtr(gm);
      }
      if (staggerRef.current && staggerRef.current <= now) { staggerRef.current = 0; setStagger(false); }
      const stunnedMe = hitstunRef.current.me > now || dizzyUntilRef.current.me > now;
      if (dirRef.current && !stunnedMe) P.me = Math.min(X_MAX, Math.max(X_MIN, P.me + dirRef.current * WALK * dt));

      const bot = botRef.current;
      const gap = Math.abs(P.op - P.me);
      const botStunned = hitstunRef.current.op > now || dizzyUntilRef.current.op > now;
      const botBusy = bot.startup > now || bot.recover > now || bot.blockUntil > now;

      if (liveRef.current && !botStunned) {
        // ── the wind-up has finished: this is the instant it can land ──
        if (bot.startup && bot.startup <= now) {
          const act = bot.act || "punch";
          const A2 = ACT[act] || ACT.punch;
          bot.startup = 0;
          bot.recover = now + BRAIN.recover;
          bot.state = "recover";
          setBotTell(false);
          if (gap <= A2.range) {
            hitMe(B.dmg * tier.dmgK * BOT_DMG * A2.dmg * 0.62
              * (suddenDeathRef.current ? SUDDEN_DEATH_DMG : 1), A2.move);
          } else {
            // whiffed into thin air, and now it has to stand there and wear it
            audioRef.current.sfx("miss");
            setOpPose(MOVES[A2.move].pose);
            say("op", T("พลาด!", "WHIFF", "落空"), "miss");
            later(() => setOpPose("ready"), 320);
            practiceTip("punish", T("มันพลาด — ตอนนี้แหละ สวนกลับเลย!",
              "It whiffed — that gap right there is your free punish",
              "它落空了 — 这就是你的反击机会"));
          }
        } else if (!botBusy) {
          const DM = practice ? dummyRef.current : "spar";
          // ── the dummy overrides the brain entirely in the lab ──
          if (DM !== "spar") {
            if (DM === "block") {
              bot.blockUntil = now + 420; bot.state = "block"; setBotGuard(true);
              later(() => setBotGuard(false), 420);
            } else if (DM === "counter" && myAtkRef.current.recover > now && gap <= ACT.kick.range) {
              // it punishes the instant you are in recovery, every time —
              // which is the only way to learn where your own recovery ends
              bot.act = "punch"; bot.startup = now + 90; bot.state = "startup"; setBotTell(true);
            } else if (DM === "grab" && gap <= THROW_RANGE + 0.04 && now >= botThrowCdRef.current) {
              botThrowCdRef.current = now + THROW_CD;
              bot.recover = now + BRAIN.recover; bot.state = "recover";
              setLunge("op"); later(() => setLunge(null), 420);
              audioRef.current.sfx("kick");
              say("me", T("โดนทุ่ม!", "THROWN!", "被投!"), "dmg");
              hitMe(B.dmg * tier.dmgK * BOT_DMG * THROW_DMG * 0.45, "punch", { unblockable: true, noCounter: true });
            } else bot.state = DM === "grab" ? "approach" : "idle";
          }
          // ── you are holding guard, so it throws you ──
          // guard stops strikes and nothing else. That mixup is the oldest
          // decision in the genre and it has to cut both ways, or holding
          // block would simply be the correct answer to everything.
          // A guard invites a throw from anyone. A GRAPPLER does not wait to be
          // invited — walking into its range at all is the mistake.
          else if (gap <= THROW_RANGE + 0.04 && now >= botThrowCdRef.current
            && ((now < guardUntil.current && Math.random() < BRAIN.aggro * 0.4)
              || Math.random() < STYLE.grab * ADAPT.grab)) {
            botThrowCdRef.current = now + THROW_CD;
            bot.recover = now + BRAIN.recover; bot.state = "recover";
            setBotTell(false); setLunge("op");
            later(() => setLunge(null), 420);
            audioRef.current.sfx("kick");
            say("me", T("โดนทุ่ม!", "THROWN!", "被投!"), "dmg");
            hitMe(B.dmg * tier.dmgK * BOT_DMG * THROW_DMG * 0.45 * (BOSS === "grip" ? 2 : 1), "punch", { unblockable: true, noCounter: true });
            practiceTip("thrown", T("การ์ดกันหมัดได้ แต่กันทุ่มไม่ได้ — ถอยหรือกระโดดบ้าง",
              "Guard stops strikes, not throws — walk back or jump instead of holding it",
              "格挡挡得住打击，挡不住投技 — 试着后退或跳跃"));
          } else if (myAtkRef.current.startup > now && gap < 0.45 && Math.random() < BRAIN.block) {
            bot.blockUntil = now + 380; bot.state = "block"; setBotGuard(true);
            later(() => setBotGuard(false), 380);
          } else if (gap <= ACT.kick.range && Math.random() < BRAIN.aggro * 0.5) {
            // ── in range: commit to something, and telegraph it ──
            // a confident bot will throw its heaviest move out, which hurts
            // badly if it lands and is the longest punish in the game if it
            // does not — the same bet the player makes with the rocket
            const heavy = BRAIN.aggro > 0.6 && Math.random() < STYLE.heavy;
            const roll = Math.random();
            bot.act = heavy ? "rocket"
              : roll < STYLE.wPunch ? "punch"
              : roll < STYLE.wPunch + STYLE.wKick ? "kick" : "fire";
            bot.startup = now + BRAIN.startup * (heavy ? 1.9 : 1);
            bot.state = "startup";
            setBotTell(true);
            setOpPose("ready");
          } else if (gap > ACT.kick.range) {
            /* ── out of range ──
               Where a bot goes when it cannot hit you is most of its
               personality. A rusher closes every time (poke .04, gap .20). A
               zoner would rather stay out here and throw lasers (poke .42,
               gap .60) and only walks in if you run away from it. */
            const roll = Math.random();
            if (roll < BRAIN.jump && airRef.current.op === 0) {
              airRef.current.op = 1;
              later(() => { airRef.current.op = 0; setOpAir(0); }, JUMP_MS);
              bot.state = "jumpin";
            } else if (roll < BRAIN.jump + STYLE.poke) {
              bot.act = "fire"; bot.startup = now + BRAIN.startup; bot.state = "startup"; setBotTell(true);
            } else if (gap > STYLE.gap * 1.2) {
              bot.state = "approach";
            } else {
              bot.state = "spacing";
            }
          } else {
            bot.state = "spacing";
          }
        }
      }

      // ── how the bot's current state moves it ──
      let botDir = 0;
      if (liveRef.current && !botStunned && bot.startup <= now && bot.blockUntil <= now) {
        if (bot.state === "approach" || bot.state === "jumpin") botDir = -1;      // close on the player
        else if (bot.state === "recover") botDir = 0;                              // committed, cannot move
        // hold the distance the style wants: step out if crowded, step in if
        // the player has drifted further away than it likes to fight
        else if (bot.state === "spacing") botDir = gap < STYLE.gap * 0.85 ? 1 : gap > STYLE.gap * 1.15 ? -1 : 0;
      }
      const botSpeed = bot.state === "jumpin" ? 1.5 : 1;
      P.op = Math.min(X_MAX, Math.max(X_MIN, P.op + botDir * WALK * 0.68 * botSpeed * dt));
      if (P.op - P.me < GAP_MIN) P.op = Math.min(X_MAX, P.me + GAP_MIN);
      setMyX(P.me); setOpX(P.op);
      // whose back is on the wall. Announced once per trip into the corner so
      // it reads as a thing that HAPPENED rather than a permanent label.
      const cMe = P.me <= X_MIN + CORNER_ZONE, cOp = P.op >= X_MAX - CORNER_ZONE;
      setCorner(c => {
        if (c.me === cMe && c.op === cOp) return c;
        if (cMe && !c.me) {
          say("me", T("จนมุม!", "CORNERED!", "被逼入角落!"), "dmg");
          practiceTip("corner", T("หลังติดกำแพง — ถอยไม่ได้และเจ็บกว่าเดิม กระโดดข้ามไปอีกฝั่ง",
            "Back to the wall: you cannot retreat and everything hurts more — jump out over it",
            "背靠墙角：无法后退且受伤更重 — 用跳跃换边"));
        }
        if (cOp && !c.op) say("op", T("จนมุม!", "CORNERED!", "被逼入角落!"), "crit");
        return { me: cMe, op: cOp };
      });

      // a jump is a half sine, so it leaves and lands instead of teleporting
      const h = airRef.current.me ? Math.sin(Math.PI * Math.min(1, (JUMP_MS - Math.max(0, cdRef.current.jump - JUMP_CD + JUMP_MS - now)) / JUMP_MS)) : 0;
      setMyAir(airRef.current.me ? Math.max(0.05, h) : 0);
      const oh = airRef.current.op ? 0.85 : 0;
      setOpAir(oh);
      G.setPos(P.me, P.op, airRef.current.me ? Math.max(0.05, h) : 0, oh);

      // ── the round clock ──
      if (liveRef.current) {
        roundClockRef.current += 60;
        const rl = Math.max(0, ROUND_TIME - roundClockRef.current);
        setRoundLeft(rl);
        if (rl <= 0) {
          // time up hands the round to whoever is further ahead
          const mFrac = hpRef.current.me / MY_MAX, oFrac = hpRef.current.op / OP_MAX;
          roundOver(mFrac >= oFrac ? "me" : "op", true);
        }
      }

      // the delayed bar eases down toward the real one, arcade-style
      setChipHp(c => {
        const tm = hpRef.current.me / MY_MAX, to = hpRef.current.op / OP_MAX;
        const ease = (a, b) => (Math.abs(a - b) < 0.004 ? b : a + (b - a) * 0.16);
        return { me: ease(c.me, tm), op: ease(c.op, to) };
      });
    }, 60);
    return () => clearInterval(id);
  }, [phase, G, tier]);

  /* ── the wave clock, and the bot that fights through it ──
     Sudden death suspends the clock entirely: there is no question to ask
     until one side lands the deciding blow, so the normal 15s countdown just
     stands down rather than sneaking in one more quiz mid-showdown. */
  useEffect(() => {
    if (phase !== "action" || doneRef.current || suddenDeath) return;
    const total = WAVES[Math.min(wave - 1, WAVES.length - 1)];
    // the clock only runs while the round is live: no question arrives in the
    // middle of ROUND 2 being announced
    let el = 0;
    const id = setInterval(() => {
      if (doneRef.current) return;
      if (!liveRef.current) return;
      el += 100;
      setLeft(Math.max(0, total - el));
      if (el >= total) { clearInterval(id); toQuiz(); }
    }, 100);
    return () => clearInterval(id);
  }, [phase, wave, suddenDeath]);

  /* The bot's aggression, rather than a fixed damage timer, is what the tier
     and the wave now scale — the AI tick above decides when it actually
     swings. Sudden death makes it commit to everything it sees. */
  useEffect(() => {
    if (phase !== "action" || doneRef.current) return;
    const base = BOT_BRAIN[tier.key] || BOT_BRAIN.veteran;
    const rush = 1 + (wave - 1) * 0.05 + (suddenDeath ? 0.6 : 0);
    // tier is how good it is; style is who it is; ADAPT is what it just
    // learned about you. All three multiply the same six numbers.
    BRAIN.aggro = Math.min(0.98, base.aggro * rush * STYLE.aggro * ADAPT.aggro);
    BRAIN.startup = Math.round(base.startup * (SFX.botGap || 1) / (suddenDeath ? 1.35 : 1));
    BRAIN.recover = Math.round(base.recover * (SFX.botGap || 1) * (BOSS === "relentless" ? 0.55 : 1));
    BRAIN.block = Math.min(0.95, base.block * STYLE.block * ADAPT.block);
    BRAIN.jump = Math.min(0.55, base.jump * STYLE.jump * ADAPT.jump);
    // the IRON GRIP boss trades its own escape for a throw that hurts twice
    BRAIN.throwEsc = BOSS === "grip" ? 0 : base.throwEsc;
  }, [phase, wave, round, tier, suddenDeath]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* Say out loud who this is and what it is allowed to do. A style you cannot
     name is just inconsistency, and a boss rule you have to infer from being
     killed by it is not a rule, it is a bug report. */
  useEffect(() => {
    const t0 = ROUND_INTRO_MS + FIGHT_CALL_MS + 200;
    later(() => {
      setBanner(T(`คู่ต่อสู้: ${STYLE.th}`, `OPPONENT STYLE: ${STYLE.en.toUpperCase()}`, `对手风格：${STYLE.zh}`));
      later(() => setBanner(null), 1900);
    }, t0 - 200);
    if (BOSS && BOSS_RULES[BOSS]) {
      later(() => {
        setBanner("⚠ " + tr3(BOSS_RULES[BOSS], lang));
        audioRef.current.sfx("bell");
        later(() => setBanner(null), 2600);
      }, t0 + 2000);
    }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── the knowledge break ── */
  function toQuiz() {
    if (doneRef.current) return;
    setPhase("quiz");
    setQ(makeQuestion(lang, weightedTag())); setCulled([]); setLocked(false);
    quizStartRef.current = Date.now();
    setQuizLeft(QUIZ_TIME);
    setMyPose("ready"); setOpPose("ready");
    audioRef.current.sfx("bell");
    G.flash("#ffffff", .32, .3);
    setBanner(T("⚡ ช่วงคำถาม", "⚡ KNOWLEDGE BREAK", "⚡ 知识时刻"));
    later(() => setBanner(null), 1500);
  }

  /* ── the shot clock ──
     Runs only while a question is actually on screen and unanswered. Letting
     it expire is a wrong answer, and it says so, because a question you did
     not answer and a question you got wrong are the same thing to the fight
     and should look the same to the learner. */
  useEffect(() => {
    if (phase !== "quiz" || locked || reveal || doneRef.current) return;
    const id = setInterval(() => {
      const gone = Date.now() - quizStartRef.current;
      const rem = Math.max(0, QUIZ_TIME - gone);
      setQuizLeft(rem);
      if (rem <= 0) { clearInterval(id); answer(null, true); }
    }, 80);
    return () => clearInterval(id);
  }, [phase, locked, reveal]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** A piano has one key for F# and one for Gb, and they are the same key. So
      a note answer is judged on the PITCH the learner picked, never on the
      spelling — which they were never offered a way to choose. Chord-name
      questions have no key to press and stay an exact match. */
  function isRight(choice, qq) {
    if (choice == null || !qq) return false;
    if (!PLAYABLE[qq.tag]) return choice === qq.ans;
    try { return parseName(choice).pc === parseName(qq.ans).pc; } catch (e) { return choice === qq.ans; }
  }

  function answer(choice, timedOut) {
    if (locked || doneRef.current) return;
    setLocked(true);
    const took = Date.now() - quizStartRef.current;
    const usedForesee = buffRef.current.foresee > 0;
    const right = usedForesee ? true : isRight(choice, q);
    if (usedForesee) { const nb = { ...buffRef.current, foresee: 0 }; buffRef.current = nb; setBuffs(nb); }
    // an auto-answered question teaches nothing about the player's real
    // accuracy, so it must not corrupt the weak-spot signal either way
    if (!usedForesee) bumpWeak(q.tag, right);
    askedRef.current += 1; setAsked(askedRef.current);
    if (right) {
      correctRef.current += 1; setCorrect(correctRef.current);
      /* ── the speed tiers ──
         Every correct answer used to pay exactly the same whether it came
         back in one second or in twenty. Knowing a thing and working it out
         are different skills, and only one of them is the one being taught,
         so only one of them fills the gauge outright. */
      const fast = took <= FAST_MS, quick = took <= QUICK_MS;
      scoreRef.current += Math.round(250 * (fast ? 1.6 : quick ? 1.25 : 1) * (SFX.scoreMul || 1));
      setScore(scoreRef.current);
      const healFrac = (SFX.healPerCorrect || 0) + itemFx.healPerCorrect;
      if (healFrac) {
        const h = Math.min(MY_MAX, hpRef.current.me + Math.round(MY_MAX * healFrac));
        hpRef.current.me = h; setMyHp(h);
      }
      if (fast) {
        FLAGS.fastAnswers += 1;
        setGauge(100);
        freeSpecialRef.current = true; setFreeSpecial(true);
      } else setGauge(g => Math.min(100, g + (quick ? 34 : 17)));
      setBanner(fast ? T("ทันใจ! เกจเต็ม + ท่าไม้ตายฟรี", "PERFECT READ! Gauge full + free special", "神速！能量全满 + 免费必杀")
        : quick ? T("เร็ว! OVERDRIVE", "QUICK! OVERDRIVE", "迅速！超载")
        : T("OVERDRIVE!", "OVERDRIVE!", "超载!"));
      setOverdrive(true);
      audioRef.current.sfx("ult");
      G.flash(fast ? "#ffd23f" : clsInfo.c, fast ? .6 : .45, .4);
      // three staged hits, so a right answer is the loudest thing in the round
      const bonus = fast ? 1.35 : quick ? 1.15 : 1;
      [0, 260, 520].forEach((d, i) => later(() => hitOp(A.dmg * 4.5 * bonus, i === 2 ? "ult" : "crit", null, { noCounter: true }), d));
      later(() => { setOverdrive(false); setBanner(null); setReveal({ q, chosen: choice }); }, 1500);
    } else {
      setBanner(timedOut ? T("หมดเวลา! เซ", "TIME! STAGGERED", "超时！踉跄")
        : T("ตอบผิด! เสียหลัก", "WRONG! STAGGERED", "答错！踉跄"));
      audioRef.current.sfx("miss");
      later(() => punish(), 320);
      later(() => { setBanner(null); setReveal({ q, chosen: choice }); }, 2100);
    }
  }

  /** The price of a wrong answer. Deliberately NOT routed through hitMe: guard,
      evasion, the free-miss grace and every buff are bypassed, because none of
      them has anything to do with knowing the note.

      It used to be a flat 30% of the pool and nothing else — a tax, paid and
      immediately forgotten, and three of them ended a fight no matter how
      well it was being played. Now it is a small sting plus a STAGGER: three
      seconds with no guard and half again the damage taken. The severity is
      the same if the opponent capitalises, and it is survivable if you make
      space instead of standing there — which is a thing you can get better
      at, unlike a subtraction. */
  function punish() {
    if (doneRef.current) return;
    const d = Math.max(1, Math.round(MY_MAX * WRONG_CHIP * (1 - itemFx.punishReduce)));
    const mHp = Math.max(0, hpRef.current.me - d);
    hpRef.current.me = mHp; setMyHp(mHp);
    comboRef.current = 0; setCombo(0);
    if (mHp > 0) beginStagger(T("เซ! กันไม่ได้ 3 วิ", "STAGGERED! No guard, 3s", "踉跄！3 秒无法格挡"));
    // the weekly FEEDER boss is the one opponent your mistakes actually feed
    if (BOSS === "feed") {
      const oh = Math.min(OP_MAX, hpRef.current.op + Math.round(OP_MAX * 0.12));
      hpRef.current.op = oh; setOpHp(oh);
      G.burst("op", 1, "#3ddc84"); say("op", "+" + Math.round(OP_MAX * 0.12), "heal");
    }
    practiceTip("wronganswer", T("ตอบผิดแล้วจะเซ — ถอยห่างไว้ก่อนจนกว่าจะหาย",
      "A wrong answer staggers you — back off and make space until it wears off",
      "答错会踉跄 — 先拉开距离撑过去"));
    /* the opponent's biggest move, staged so it reads as an execution rather
       than another chip hit */
    const mv = ULT_MOVE[oppCls] || "cannon";
    setOpPose(MOVES[mv].pose); setMyPose("hit");
    setLunge("op"); setShake(3);
    strike("op", "ult", "#ff2d55", mv);
    later(() => { G.boom("me", 3, "#ff2d55"); G.flash("#ff2d55", .7, .5); audioRef.current.sfx("boom"); setShake(3); }, 260);
    later(() => { G.boom("me", 2.2, "#ffd23f"); audioRef.current.sfx("boom"); }, 520);
    later(() => { setLunge(null); setShake(0); }, 900);
    say("me", "-" + Math.round(WRONG_CHIP * (1 - itemFx.punishReduce) * 100) + "%", "dmg");
    if (mHp <= 0) later(() => roundOver("op"), 760);
  }

  function nextWave() {
    if (doneRef.current) return;
    if (hpRef.current.me <= 0 || hpRef.current.op <= 0) { finish(); return; }
    if (wave >= WAVES.length) {
      // still close after the full eight rounds — one last exchange at
      // double damage decides it outright, instead of a percentage doing the
      // deciding silently while the screen just says "time's up"
      const mFrac = hpRef.current.me / MY_MAX, oFrac = hpRef.current.op / OP_MAX;
      if (!suddenDeathRef.current && Math.abs(mFrac - oFrac) < SUDDEN_DEATH_MARGIN) {
        suddenDeathRef.current = true; setSuddenDeath(true);
        setBanner(T("⚡ ยกชี้ขาด! ดาเมจ 2 เท่า", "⚡ SUDDEN DEATH! 2× DAMAGE", "⚡ 生死决战！伤害 2 倍"));
        audioRef.current.sfx("bell"); G.flash("#ff2d55", .5, .4);
        later(() => setBanner(null), 2000);
        setLocked(false); setPhase("action");
        later(() => { if (!doneRef.current) finish(); }, SUDDEN_DEATH_TIMEOUT);
        return;
      }
      finish(); return;
    }
    setWave(w => w + 1);
    setLeft(WAVES[Math.min(wave, WAVES.length - 1)]);
    // a healer pet patches you up between waves
    if (PET && PET.k === "heal") {
      const h = Math.min(MY_MAX, hpRef.current.me + Math.round(MY_MAX * PET.v));
      hpRef.current.me = h; setMyHp(h);
      G.burst("me", .9, "#3ddc84"); say("me", "+" + Math.round(MY_MAX * PET.v), "heal");
    }
    setLocked(false); setPhase("action");
  }

  /* ── skills ── */
  function useActive() {
    if (gauge < 100 || myRank < SKILL_UNLOCK.active || doneRef.current) return;
    setGauge(0);
    const k = fx.active, nb = { ...buffRef.current };
    if (k === "crit") { nb.crit = 1; say("me", tr3(FX_TEXT.crit, lang), "buff"); }
    else if (k === "block") { nb.block = 1; say("me", tr3(FX_TEXT.block, lang), "buff"); }
    else if (k === "cull") {
      if (q) setCulled(shuffle(q.opts.filter(o => o !== q.ans)).slice(0, 2));
      say("me", tr3(FX_TEXT.cull, lang), "buff");
    }
    else if (k === "reroll") { if (q) { setQ(makeQuestion(lang, weightedTag())); setCulled([]); } say("me", tr3(FX_TEXT.reroll, lang), "buff"); }
    else if (k === "patch") {
      const h = Math.min(MY_MAX, hpRef.current.me + Math.round(MY_MAX * 0.14));
      hpRef.current.me = h; setMyHp(h);
      audioRef.current.sfx("heal"); G.burst("me", .9, "#3ddc84"); say("me", "+" + Math.round(MY_MAX * .14), "heal");
    }
    else if (k === "anthem") { nb.anthem = 3; say("me", tr3(FX_TEXT.anthem, lang), "buff"); }
    else if (k === "sustain") { nb.sustain = 1; say("me", tr3(FX_TEXT.sustain, lang), "buff"); }
    buffRef.current = nb; setBuffs(nb);
    if (k !== "patch") audioRef.current.sfx("charge");
    if (playUi) playUi("click");
  }

  /* ── the super, and the question inside it ──
     The ultimate is the one moment a fight already stops for, so it is the
     one place a question costs nothing in pace. Two seconds, one answer:
     right doubles it and the cinematic plays in full, wrong halves it. It is
     the only mechanic in the game where knowing the theory and winning the
     fight are literally the same button press. */
  function useUlt() {
    if (ultUsed || gauge < 100 || myRank < SKILL_UNLOCK.ultimate || doneRef.current) return;
    setUltUsed(true); setGauge(0);
    setUltQ({ q: makeQuestion(lang, weightedTag()), start: Date.now() });
    setUltQLeft(ULTQ_TIME);
    audioRef.current.sfx("charge");
    G.flash("#ffd23f", .5, .45);
    setLunge("me");
    if (playUi) playUi("click");
  }

  /** The super's question came back — now actually fire it, scaled by whether
      they knew the answer. */
  function fireUlt(mul, right) {
    setUltQ(null); setLunge(null);
    if (doneRef.current) return;
    bumpWeak(ultQRef.current ? ultQRef.current.tag : "iv", !!right);
    if (right) FLAGS.superRight = true;
    setBanner(right ? T("ท่าไม้ตายเต็มกำลัง!", "FULL POWER SUPER!", "全力必杀!")
      : T("ท่าไม้ตายไม่สมบูรณ์", "MISFIRED SUPER", "必杀失手"));
    later(() => setBanner(null), 1200);
    const k = fx.ult, nb = { ...buffRef.current };
    const mvKey = ULT_MOVE[myCls] || "punch";
    if (k === "triple") [0, 220, 440].forEach(d => later(() => hitOp(A.dmg * 3.5 * mul, "ult", mvKey), d));
    else if (k === "crescendo") hitOp(OP_MAX * 0.16 * mul, "ult", mvKey);
    else if (k === "finale") hitOp(A.dmg * (4 + comboRef.current * 0.5) * mul, "ult", mvKey);
    else {
      audioRef.current.sfx("ult"); G.flash(clsInfo.c, .4, .4); G.burst("me", 1.6, clsInfo.c);
      // the buff ultimates cannot be "doubled", so they run longer instead
      const ext = right ? 1 : 0;
      if (k === "fortress") { nb.fortress = 3 + ext; say("me", tr3(FX_TEXT.fortress, lang), "buff"); }
      else if (k === "phase") { nb.phase = 2 + ext; say("me", tr3(FX_TEXT.phase, lang), "buff"); }
      else if (k === "foresee") { nb.foresee = 1; say("me", tr3(FX_TEXT.foresee, lang), "buff"); }
      else if (k === "overhaul") {
        const frac = 0.3 * mul;
        const h = Math.min(MY_MAX, hpRef.current.me + Math.round(MY_MAX * frac));
        hpRef.current.me = h; setMyHp(h); say("me", "+" + Math.round(MY_MAX * frac), "heal");
      }
      buffRef.current = nb; setBuffs(nb);
    }
    if (playUi) playUi("reward");
  }

  /* The super's question has its own two-second clock. Letting it run out is
     the same as getting it wrong — the move still comes out, just weakly. */
  const ultQRef = useRef(null);
  useEffect(() => { ultQRef.current = ultQ && ultQ.q; }, [ultQ]);
  useEffect(() => {
    if (!ultQ || doneRef.current) return;
    const id = setInterval(() => {
      const rem = Math.max(0, ULTQ_TIME - (Date.now() - ultQ.start));
      setUltQLeft(rem);
      if (rem <= 0) { clearInterval(id); fireUlt(0.5, false); }
    }, 80);
    return () => clearInterval(id);
  }, [ultQ]);   // eslint-disable-line react-hooks/exhaustive-deps

  const mySk = skillsOf(me);
  const activeSk = mySk.find(s => s.tier === "active");
  const ultSk = mySk.find(s => s.tier === "ultimate");
  const canActive = gauge >= 100 && myRank >= SKILL_UNLOCK.active && !doneRef.current;
  const canUlt = gauge >= 100 && myRank >= SKILL_UNLOCK.ultimate && !ultUsed && !doneRef.current;
  const waveTotal = WAVES[Math.min(wave - 1, WAVES.length - 1)];
  /* Below a quarter tank, the tide should still be turnable — not a mercy
     rule, just a reason to keep fighting instead of watching the bar drain. */
  const comeback = myHp > 0 && (myHp / MY_MAX) < COMEBACK_HP;
  useEffect(() => {
    if (comeback && !comebackAnnouncedRef.current) {
      comebackAnnouncedRef.current = true;
      setBanner(T("พลิกเกม! ดาเมจ/เกจโตขึ้น", "COMEBACK! Damage & gauge boosted", "絕地反击！伤害/能量提升"));
      audioRef.current.sfx("charge");
      later(() => setBanner(null), 1800);
    } else if (!comeback) comebackAnnouncedRef.current = false;
  }, [comeback]);

  return (
    <div className={`pvppage fight${land ? " land" : ""}`}>
      <div className="pvphdr">
        <button className="stgback" onClick={onBack} aria-label="back">←</button>
        <span className="pvphdr-t">{T("ยก", "Wave", "波次")} {Math.min(wave, WAVES.length)}/{WAVES.length}</span>
        <span className="pvparena">{tr3(ARENA, lang)}</span>
        <span className="pvpscore">{score.toLocaleString()}</span>
      </div>

      {/* The stage carries the round on its own class: the light drops and the
          room tightens in round 2, and the decider burns. Nothing has to say
          "this one matters" out loud if the room already does. */}
      <div className={`pvpstage r${Math.min(3, round)}${shake ? " sh" + shake : ""}${overdrive ? " od" : ""}${comeback ? " comeback" : ""}${suddenDeath ? " sudden" : ""}${hitStop ? " hitstop hs-" + hitDir : ""}${corner.me ? " cornerme" : ""}${corner.op ? " cornerop" : ""}${stagger ? " staggered" : ""}${finisher ? " finisher " + (outcome || "") : ""}`}>
        <canvas ref={G.bgRef} className="pvpbg" />
      <canvas ref={G.canvasRef} className="pvpfx" />
        {/* the two walls, lit only for whoever has their back to one */}
        <span className="pvpwall l" /><span className="pvpwall r" />
        <div className="pvphps">
          <div className="pvphpcol">
            {/* the pale bar behind is the damage you just took, still draining
                — the oldest trick in the arcade for making a hit read big */}
            <div className="pvphp">
              <u style={{ width: `${Math.max(0, chipHp.me * 100)}%` }} />
              <i style={{ width: `${Math.max(0, (myHp / MY_MAX) * 100)}%` }} />
            </div>
            <div className="pvphp-n">
              <span className="pvppips">{[0, 1].map(i => <b key={i} className={roundWins.me > i ? "on" : ""} />)}</span>
              {tr3(CHAR_MODELS.find(m => m.id === me) || {}, lang)} · {Math.max(0, Math.round(myHp))}
            </div>
          </div>
          <div className="pvpvs">
            <b className={roundLeft < 10000 ? "low" : ""}>{Math.ceil(roundLeft / 1000)}</b>
            <i>{T("ยก", "R", "回合")}{round}</i>
          </div>
          <div className="pvphpcol">
            <div className="pvphp op">
              <u style={{ width: `${Math.max(0, chipHp.op * 100)}%` }} />
              <i style={{ width: `${Math.max(0, (opHp / OP_MAX) * 100)}%` }} />
            </div>
            <div className="pvphp-n op">
              {Math.max(0, Math.round(opHp))} · {oppKind === "player" ? oppName : tr3(CHAR_MODELS.find(m => m.id === oppModel) || {}, lang)}
              <span className="pvppips">{[0, 1].map(i => <b key={i} className={roundWins.op > i ? "on" : ""} />)}</span>
            </div>
          </div>
        </div>
        <div className={`pvpfighter me${lunge === "me" ? " lunge" : ""}${myPose === "hit" ? " knock" : ""}${guarding ? " guard" : ""}`}
          style={{ left: `calc(${(myX * 100).toFixed(1)}% - 22%)`, bottom: `calc(var(--pvpfloor, 6px) + ${(myAir * 62).toFixed(1)}px)` }}>
          <Bot model={me} yaw={lunge === "me" ? 42 : myPose === "hit" ? 14 : 26} pose={myPose}
            glow={myGlow} accent={myAccent} armorA="#1b2436" armorB="#41608a" />
          {flash && flash.side === "me" && <span className={`pvpflash ${flash.kind}`}>{flash.text}</span>}
          {dizzy.me && <span className="pvpdizzy">✦✦✦</span>}
          {stagger && !dizzy.me && <span className="pvpstagger">✖</span>}
          {/* the pet fights at your heel — it does not take hits or throw
              them, it stands there and applies the bonus you earned by
              looking after it */}
          {PET && petPic && (
            <span className="pvppet" title={petById(petPic.species).en}>
              <PetArt species={petPic.species} level={petLevel(petPic.bond).lv} mood={petPic.mood} />
            </span>
          )}
        </div>
        <div className={`pvpfighter op${lunge === "op" ? " lunge" : ""}${opPose === "hit" ? " knock" : ""}${botGuard ? " guard" : ""}${botTell ? " tell" : ""}`}
          style={{ left: `calc(${(opX * 100).toFixed(1)}% - 22%)`, right: "auto", bottom: `calc(var(--pvpfloor, 6px) + ${(opAir * 62).toFixed(1)}px)` }}>
          <Bot model={oppModel} yaw={lunge === "op" ? -42 : opPose === "hit" ? -14 : -26} pose={opPose}
            glow="#ff7a3c" accent="#ff4d6a" armorA="#2b1a1a" armorB="#8a4a3a" />
          {flash && flash.side === "op" && <span className={`pvpflash ${flash.kind}`}>{flash.text}</span>}
          {/* the wind-up has to be READABLE or blocking is a coin flip */}
          {botTell && <span className="pvptell">!</span>}
          {botGuard && <span className="pvpguardic">🛡</span>}
          {dizzy.op && <span className="pvpdizzy">✦✦✦</span>}
        </div>
        {combo > 2 && <div className="pvpcombo" key={combo}><b>{combo}</b><i>{T("ฮิต", "HITS", "连击")}</i></div>}
        {banner && <div className="pvpbanner">{banner}</div>}
        {/* the announcer: ROUND n, FIGHT!, K.O., PERFECT, and the final call */}
        {announce && (
          <div className={`pvpann ${announce.kind}`} key={announce.big}>
            <b>{announce.big}</b>
            {announce.sub && <i>{announce.sub}</i>}
          </div>
        )}
        {finisher && !announce && (
          <div className="pvpko">
            <b>{outcome === "win" ? "K.O." : T("แพ้ยับเยิน", "K.O.'D", "被击倒")}</b>
          </div>
        )}
      </div>

      {/* The assignment, readable during the round-1 announcement and gone by
          the time the fight starts — a checklist that stays up all match is
          something to stare at instead of the opponent. */}
      {!practice && objectives.length > 0 && round === 1 && announce && (
        <div className="pvpobjstrip">
          <b>{T("ภารกิจ", "OBJECTIVES", "任务")}</b>
          {objectives.map(o => <i key={o.key}>{tr3(o, lang)} <em>⚔{o.v}</em></i>)}
        </div>
      )}

      {/* ── the super's question ──
          Rendered over the held frame rather than in place of it: the point
          is that the fight is mid-swing while this is being answered. */}
      {ultQ && (
        <div className="pvpultq">
          <div className="pvpultq-card">
            <b>{T("ท่าไม้ตาย — ตอบให้ทัน!", "SUPER — answer to power it!", "必杀技 — 答对增幅!")}</b>
            <div className="pvpultq-bar"><i style={{ width: `${Math.max(0, (ultQLeft / ULTQ_TIME) * 100)}%` }} /></div>
            <p>{ultQ.q.q}</p>
            <div className="pvpultq-opts">
              {ultQ.q.opts.map(o => (
                <button key={o} type="button" onClick={() => fireUlt(isRight(o, ultQ.q) ? 2 : 0.5, isRight(o, ultQ.q))}>{o}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTut && (
        <div className="pvptut" onClick={() => setShowTut(false)}>
          <div className="pvptut-card">
            <span className="pvptut-ic">🛡</span>
            <b>{T("กดค้างปุ่มการ์ดเพื่อกันดาเมจ!", "Hold the Guard button to block damage!", "按住格挡键可减免伤害！")}</b>
            <i>{T("แตะที่ไหนก็ได้เพื่อปิด", "Tap anywhere to dismiss", "点击任意处关闭")}</i>
          </div>
        </div>
      )}

      {phase === "action" && (
        <>
          {suddenDeath ? (
            <div className="pvpsuddenbar">⚡ {T("ยกชี้ขาด — โดนก่อนแพ้", "SUDDEN DEATH — first hit wins", "生死决战 — 先中招者败")}</div>
          ) : (
            <>
              <div className="pvpwave"><i style={{ width: `${Math.max(0, (left / waveTotal) * 100)}%` }} /></div>
              <div className="pvpwave-l">{T("คำถามจะมาใน", "Question in", "问题将在")} {Math.ceil(left / 1000)}s</div>
            </>
          )}
          {/* ── the pad ──
              Left thumb walks, right thumb fights. In landscape these two
              clusters float over the arena at the bottom corners, which is
              where the thumbs already are when a phone is held sideways; in
              portrait the same buttons stack under the stage. One control set,
              two layouts — two movesets would have been two games. */}
          {/* what the game just heard, the way a training mode shows it —
              a special that did not come out is then a thing you can see */}
          {inputs.length > 0 && (
            <div className="pvpinputs">{inputs.map((g, i) => <span key={i}>{g}</span>)}</div>
          )}
          {freeSpecial && (
            <div className="pvpfreesp">{T("ท่าไม้ตายฟรีพร้อมใช้ — กดทิศแล้วต่อย", "FREE SPECIAL READY — motion + punch", "免费必杀就绪 — 方向 + 拳击")}</div>
          )}
          {/* ── the lab ──
              Only in practice, where there are no stakes to protect: tell the
              dummy what to do, and read the real frame data off the same
              table the fight itself runs on. */}
          {practice && (
            <div className="pvplab">
              <div className="pvplab-row">
                {[
                  { k: "spar",    th: "สู้ปกติ",   en: "Spar",     zh: "对练" },
                  { k: "stand",   th: "ยืนนิ่ง",   en: "Stand",    zh: "站桩" },
                  { k: "block",   th: "การ์ดตลอด", en: "Block",    zh: "常格挡" },
                  { k: "counter", th: "สวนทุกครั้ง", en: "Punish", zh: "必反击" },
                  { k: "grab",    th: "ทุ่มอย่างเดียว", en: "Grab", zh: "只投技" },
                ].map(o => (
                  <button key={o.k} type="button" className={`pvplab-b${dummy === o.k ? " on" : ""}`}
                    onClick={() => { setDummy(o.k); dummyRef.current = o.k; if (playUi) playUi("click"); }}>
                    {tr3(o, lang)}
                  </button>
                ))}
                <button type="button" className={`pvplab-b mv${showMoves ? " on" : ""}`}
                  onClick={() => setShowMoves(v => !v)}>{T("สมุดท่า", "Moves", "招式表")}</button>
              </div>
              {showMoves && (
                <div className="pvplab-moves">
                  <table>
                    <thead><tr>
                      <th>{T("ท่า", "Move", "招式")}</th>
                      <th>{T("ออกท่า", "Startup", "发生")}</th>
                      <th>{T("ฟื้นตัว", "Recover", "硬直")}</th>
                      <th>{T("ระยะ", "Range", "距离")}</th>
                    </tr></thead>
                    <tbody>
                      {[["punch", T("ต่อย", "Punch", "拳")], ["kick", T("เตะ", "Kick", "踢")],
                        ["fire", T("ยิง", "Fire", "射")], ["rocket", T("จรวด", "Rocket", "火箭")],
                        ["throw", T("ทุ่ม", "Throw", "投")]].map(([k, label]) => (
                        <tr key={k}>
                          <td>{label}</td>
                          <td>{FRAMES[k].startup}ms</td>
                          <td>{FRAMES[k].recover}ms</td>
                          <td>{ACT[k] ? (ACT[k].range > 1 ? "∞" : ACT[k].range.toFixed(2)) : THROW_RANGE.toFixed(2)}</td>
                        </tr>
                      ))}
                      {MY_SPECIALS.map(sp => (
                        <tr key={sp.key} className="sp">
                          <td>{sp.glyph} {tr3(sp, lang)}</td>
                          <td>{FRAMES[sp.key].startup}ms</td>
                          <td>{FRAMES[sp.key].recover}ms</td>
                          <td>{sp.key === "blast" ? "∞" : (ACT.kick.range + 0.06).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <i>{T("ยิ่ง “ฟื้นตัว” นาน ยิ่งโดนสวนง่ายเมื่อพลาด",
                        "The longer the recovery, the worse a whiff is punished",
                        "硬直越长，落空被反击越惨")}</i>
                </div>
              )}
            </div>
          )}
          <div className="pvppad">
            <div className="pvppad-l">
              <button className="pvpdir" aria-label={T("ถอย", "Back", "后退")}
                onPointerDown={() => { dirRef.current = -1; pushMotion(-1); }} onPointerUp={() => { dirRef.current = 0; }}
                onPointerLeave={() => { dirRef.current = 0; }} onPointerCancel={() => { dirRef.current = 0; }}>◀</button>
              {/* the guard button wears its own meter: a resource you can see
                  running out is a decision, an invisible one is a surprise */}
              <button className={`pvpdir grd${guarding ? " on" : ""}${guardMtr < GUARD_HIT_COST ? " spent" : ""}`}
                aria-label={T("การ์ด", "Guard", "防御")} onPointerDown={guard}>
                <span>🛡</span>
                <span className="pvpgmtr"><i style={{ width: `${Math.max(0, (guardMtr / GUARD_MAX) * 100)}%` }} /></span>
              </button>
              <button className="pvpdir" aria-label={T("เดินหน้า", "Forward", "前进")}
                onPointerDown={() => { dirRef.current = 1; pushMotion(1); }} onPointerUp={() => { dirRef.current = 0; }}
                onPointerLeave={() => { dirRef.current = 0; }} onPointerCancel={() => { dirRef.current = 0; }}>▶</button>
            </div>
            <div className="pvppad-r">
              <button className="pvpact fire" aria-label={T("ยิง", "Fire", "射击")} onPointerDown={() => attack("fire")}>
                <b>🔫</b><i>{T("ยิง", "FIRE", "射击")}</i>
              </button>
              <button className="pvpact jump" aria-label={T("กระโดด", "Jump", "跳跃")} onPointerDown={jump}>
                <b>⤴</b><i>{T("กระโดด", "JUMP", "跳跃")}</i>
              </button>
              <button className="pvpact punch" aria-label={T("ต่อย", "Punch", "拳击")} onPointerDown={() => attack("punch")}>
                <b>👊</b><i>{T("ต่อย", "PUNCH", "拳击")}</i>
              </button>
              <button className="pvpact kick" aria-label={T("เตะ", "Kick", "踢击")} onPointerDown={() => attack("kick")}>
                <b>🦵</b><i>{T("เตะ", "KICK", "踢击")}</i>
              </button>
              <button className="pvpact rocket" aria-label={T("จรวด", "Rocket", "火箭")} onPointerDown={() => attack("rocket")}>
                <b>🚀</b><i>{T("จรวด", "ROCKET", "火箭")}</i>
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "quiz" && q && (reveal ? (
        /* The round holds on the answer. A tick and the next question tells a
           learner they were right; the keyboard and the staff tell them what
           the answer was, which is the only version of this that teaches. */
        <AnswerReveal q={reveal.q} chosen={reveal.chosen} lang={lang}
          onNext={() => { setReveal(null); nextWave(); }}
          nextLabel={T("สู้ต่อ", "Back to the fight", "继续战斗")} />
      ) : (
        <>
          {/* the shot clock, and what beating it is worth */}
          <div className={`pvpshot${quizLeft < 1500 ? " low" : ""}`}>
            <i style={{ width: `${Math.max(0, (quizLeft / QUIZ_TIME) * 100)}%` }} />
            <b>{(quizLeft / 1000).toFixed(1)}s</b>
          </div>
          <div className="pvpshot-l">
            {T("ต่ำกว่า 1.5 วิ = เกจเต็ม + ท่าไม้ตายฟรี",
               "Under 1.5s = full gauge + a free special",
               "1.5 秒内 = 能量全满 + 免费必杀")}
          </div>
          <div className="pvpq">{q.q}</div>
          {PLAYABLE[q.tag] ? (
            /* ── answer on the keys ──
               Three of the four question kinds ask for a NOTE, and a note has
               a place under the hand. Picking it off a piano instead of a list
               of four is the difference between recognising a word and
               spelling it: it is the same knowledge going into the hands the
               learner actually plays with. Judged by pitch, so the black key
               is right whether the question spelled it F# or Gb. */
            <div className="pvpkeys" role="group" aria-label={T("เลือกโน้ต", "Pick the note", "选择音符")}>
              {KEYS.map(k => {
                const dim = culled.some(c => { try { return parseName(c).pc === parseName(k.n).pc; } catch (e) { return false; } });
                const isAns = locked && (() => { try { return parseName(q.ans).pc === parseName(k.n).pc; } catch (e) { return false; } })();
                return (
                  <button key={k.n} type="button"
                    className={`pvpkey${k.b ? " blk" : ""}${dim ? " culled" : ""}${isAns ? " right" : ""}`}
                    disabled={locked || dim} onClick={() => answer(k.n)}
                    aria-label={k.b ? `${k.n} / ${FLAT_OF[k.n]}` : k.n}>
                    <span>{k.b ? <><em>{k.n}</em><em>{FLAT_OF[k.n]}</em></> : k.n}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="pvpopts">
              {q.opts.map(o => (
                <button key={o} className={`pvpopt${culled.includes(o) ? " culled" : ""}${locked && o === q.ans ? " right" : ""}`}
                  disabled={locked || culled.includes(o)} onClick={() => answer(o)}>{o}</button>
              ))}
            </div>
          )}
        </>
      ))}

      <div className="pvpskills">
        <div className="pvpgauge"><i style={{ width: `${gauge}%`, background: clsInfo.c }} /></div>
        <div className="pvpskbtns">
          <button className={`pvpskbtn${canActive ? " on" : ""}`} disabled={!canActive} onClick={useActive} style={{ "--cc": clsInfo.c }}>
            <span className="pvpskbtn-ic"><ItemArt art={(activeSk || {}).art || "charge"} sw={[canActive ? clsInfo.c : "#96a0b2", "#20263a"]} /></span>
            <b>{activeSk ? tr3(activeSk.n, lang) : "—"}</b>
            <i>{myRank < SKILL_UNLOCK.active ? T(`แรงก์ ${SKILL_UNLOCK.active}`, `Rank ${SKILL_UNLOCK.active}`, `等级 ${SKILL_UNLOCK.active}`) : tr3(FX_TEXT[fx.active], lang)}</i>
          </button>
          <button className={`pvpskbtn ult${canUlt ? " on" : ""}`} disabled={!canUlt} onClick={useUlt} style={{ "--cc": clsInfo.c }}>
            <span className="pvpskbtn-ic"><ItemArt art={(ultSk || {}).art || "burst"} sw={[canUlt ? "#ffd23f" : "#96a0b2", "#20263a"]} /></span>
            <b>{ultSk ? tr3(ultSk.n, lang) : "—"}</b>
            <i>{ultUsed ? T("ใช้ไปแล้ว", "Spent", "已使用")
              : myRank < SKILL_UNLOCK.ultimate ? T(`แรงก์ ${SKILL_UNLOCK.ultimate}`, `Rank ${SKILL_UNLOCK.ultimate}`, `等级 ${SKILL_UNLOCK.ultimate}`)
              : tr3(FX_TEXT[fx.ult], lang)}</i>
          </button>
        </div>
      </div>
    </div>
  );
});
