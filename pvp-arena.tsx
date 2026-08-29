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
import { CyberAvatar, CHAR_MODELS, MODEL_COMBAT, combatOf, normalizeModel } from "./cyber-avatar";
import { MODEL_CLASS, TIER_LABEL, classOf, classKeyOf, skillsOf } from "./model-skills";
import { ItemArt } from "./item-art";
import { petBonusOf, petById, petLevel, readPet, PetArt } from "./pet-lab";
import { createArenaAudio, useArenaFx } from "./arena-fx";

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

/** The class of whatever chassis is running right now, read the same way the
    rest of the app reads the equipped model. Used by the EXP hook, which has
    no idea what a chassis is. */
export function runningClassKey() {
  let m = "vanguard";
  try { m = localStorage.getItem("tg_charModel") || "vanguard"; } catch (e) {}
  return classKeyOf(normalizeModel(m));
}

/** Practice feeds the fight: account EXP also trains the running chassis's
    class, at half rate. Called from gainExp so every feature in the app
    contributes without any of them knowing this file exists. */
export function trainFromExp(xp) {
  if (!xp || xp <= 0) return null;
  return addSkillSp(runningClassKey(), Math.max(1, Math.round(xp / 2)));
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

export function makeQuestion(lang) {
  const kind = pick(["iv", "degree", "triad", "scale"]);
  const root = pick(ROOTS);

  if (kind === "iv") {
    const iv = pick(IV_NAME);
    const ans = spellFrom(root, iv.L, iv.s);
    const wrong = distract(ans, () => { const o = pick(IV_NAME); return spellFrom(root, o.L, o.s); });
    return {
      tag: "iv",
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
export const SkillTrack = memo(function SkillTrack({ lang, charModel, onOpenPvp }) {
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

      <button className="skt-pvp" onClick={onOpenPvp}>
        <span className="skt-pvp-ic">⚔</span>
        <span className="skt-pvp-b">
          <b>{T("สนามประลอง PvP", "PvP Arena", "PvP 竞技场")}</b>
          <i>{T("เอาหุ่นยนต์ไปสู้ — ตอบคำถามดนตรีให้ไวและแม่นกว่า",
                "Send your chassis in — answer music questions faster than they do",
                "派出你的机体 — 比对手更快答对音乐题")}</i>
        </span>
        <span className="skt-pvp-go">→</span>
      </button>
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

const BOT_TIERS = [
  { key: "rookie",  acc: .45, dmgK: .85, th: "โหมดง่าย",  en: "Easy Mode",   zh: "简单模式", coins: 40,  xp: 12, sp: 24 },
  { key: "veteran", acc: .62, dmgK: 1,   th: "โหมดปานกลาง", en: "Medium Mode", zh: "中等模式", coins: 90,  xp: 25, sp: 48 },
  { key: "ace",     acc: .78, dmgK: 1.2, th: "โหมดยาก",   en: "Hard Mode",   zh: "困难模式", coins: 180, xp: 45, sp: 90 },
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

export const PvpPage = memo(function PvpPage({
  lang, charModel = "vanguard", gear = [], onBack, onReward, playUi, friends = null, onChallenge, duels = null, onRespondDuel,
}) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const [phase, setPhase] = useState("lobby");    // lobby | fight | result
  const [tier, setTier] = useState(BOT_TIERS[1]);
  const [oppKind, setOppKind] = useState("bot");  // bot | player
  const [oppName, setOppName] = useState("");
  const [pendingFriend, setPendingFriend] = useState(null);
  const [sp, setSp] = useState(() => readSkillSp());

  const me = normalizeModel(charModel);
  const myCls = classKeyOf(me);
  const myRank = skillRank(sp[myCls] || 0).rank;
  const mySkills = skillsOf(me);
  const clsInfo = MODEL_CLASS[myCls] || MODEL_CLASS.striker;

  const startFight = (kind, t, name, friend) => {
    setOppKind(kind); setTier(t); setOppName(name || ""); setPendingFriend(friend || null);
    setPhase("fight"); if (playUi) playUi("click");
  };

  const [result, setResult] = useState(null);
  const finish = useCallback((res) => {
    setResult(res);
    setPhase("result");
    const won = res.win;
    const t = res.tier;
    const coins = won ? t.coins : Math.round(t.coins * 0.25);
    const xp = won ? t.xp : Math.round(t.xp * 0.3);
    const gained = addSkillSp(myCls, won ? t.sp : Math.round(t.sp * 0.35));
    setSp(readSkillSp());
    try { window.dispatchEvent(new Event("tg-skillsp")); } catch (e) {}
    // the arena pays SP directly above, so its EXP must not ALSO trickle into
    // the same track — otherwise one fight counts twice and the arena becomes
    // the only sane way to rank up
    if (onReward) onReward(xp, coins, res);
    res.spGained = gained;
    if (playUi) playUi(won ? "reward" : "click");
  }, [myCls, onReward, playUi]);

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
          <div className="pvpme">
            <div className="pvpme-stage"><CyberAvatar model={me} yaw={22} pose="ready" glow="#00b8d4" accent="#7c4dff" armorA="#1b2436" armorB="#41608a" /></div>
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
            </div>
          </div>

          <div className="pvpsec-h">🤖 {T("สู้กับบอท", "Fight a bot", "对战电脑")}</div>
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
                <button key={f.user_id} className="pvpfriend" onClick={() => startFight("player", BOT_TIERS[1], f.name || f.email || "?", f)}>
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
                  <button key={d.id} className="pvpfriend" onClick={() => startFight("player", BOT_TIERS[1], d.opp_name, { duel: d })}>
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

  /* ── result ── */
  if (phase === "result" && result) {
    const g = result.spGained;
    return (
      <div className="pvppage">
        <div className="pvphdr">
          <button className="stgback" onClick={onBack} aria-label="back">←</button>
          <span className="pvphdr-t">{result.win ? "🏆 " + T("ชนะ!", "Victory!", "胜利！") : T("แพ้", "Defeat", "落败")}</span>
        </div>
        <div className="pvpbody">
          <div className={`pvpres ${result.win ? "win" : "lose"}`}>
            <div className="pvpres-stage">
              <CyberAvatar model={me} yaw={0} pose={result.win ? "win" : "down"} glow="#00b8d4" accent="#7c4dff" armorA="#1b2436" armorB="#41608a" />
            </div>
            <div className="pvpres-score">{result.score}</div>
            <div className="pvpres-sub">
              {T("ตอบถูก", "Correct", "答对")} {result.correct}/{result.asked} ·
              {" "}{T("คอมโบสูงสุด", "Best combo", "最高连击")} {result.bestCombo} ·
              {" "}HP {Math.max(0, Math.round(result.myHp))}
            </div>
            <div className="pvpres-rew">
              <span>🪙 {result.win ? result.tier.coins : Math.round(result.tier.coins * .25)}</span>
              <span>✦ {result.win ? result.tier.xp : Math.round(result.tier.xp * .3)}</span>
              <span style={{ color: clsInfo.c }}>SP +{result.win ? result.tier.sp : Math.round(result.tier.sp * .35)}</span>
            </div>
            {g && g.rankedUp && <div className="pvpres-rank" style={{ "--cc": clsInfo.c }}>⬆ {tr3(clsInfo, lang)} {T("แรงก์", "rank", "等级")} {g.rank}</div>}
          </div>

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
        </div>
      </div>
    );
  }

  /* ── fight ── */
  return (
    <ArenaFight
      key={`${oppKind}-${tier.key}-${phase}`}
      lang={lang} me={me} gear={gear} myRank={myRank} tier={tier}
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
/* A wrong answer is not a dodgeable attack — it is a punishment for the
   answer, so it lands for a flat 30% of your pool through guard, evasion and
   everything else. Three mistakes is most of a health bar. */
const WRONG_PUNISH = 0.30;
const GUARD_MS = 900, GUARD_CD = 2400;
const BOT_GAP = { rookie: 1700, veteran: 1250, ace: 950 };

/* ── the moveset ──
   Once the robots can walk, the buttons have to mean different things or the
   stick is decoration. A punch hits hardest and only lands in close; the
   blaster reaches but hits softest; the rocket reaches and hurts, and makes
   you wait for it. Jumping lifts you over anything on the ground, which is
   the only answer to a bot that is faster than you. */
const ACT = {
  punch:  { cd: 400,  dmg: 1.55, range: 0.27, move: "punch",   sfx: "hit" },
  fire:   { cd: 330,  dmg: 0.72, range: 9,    move: "blaster", sfx: "shot" },
  rocket: { cd: 3400, dmg: 3.2,  range: 9,    move: "grenade", sfx: "lob" },
};
const JUMP_MS = 760, JUMP_CD = 1150;
const WALK = 0.42;                             // stage-widths per second
const X_MIN = 0.08, X_MAX = 0.92, GAP_MIN = 0.16;

// two full-body SVGs re-rendering on every HP tick would be the whole frame
// budget; they only actually change when a pose or an angle does
const Bot = memo(CyberAvatar);

const ArenaFight = memo(function ArenaFight({ lang, me, gear, myRank, tier, oppKind, oppName, onDone, onBack, playUi }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const myCls = classKeyOf(me);
  const fx = CLASS_FX[myCls] || CLASS_FX.striker;
  const clsInfo = MODEL_CLASS[myCls] || MODEL_CLASS.striker;
  const oppModel = useRef(chassisFor(oppKind === "player" ? oppName : tier.key + "-" + Math.floor(Math.random() * 999))).current;
  const oppCls = classKeyOf(oppModel);

  const A = useRef(fighterFrom(me, gear, myRank)).current;
  const B = useRef(fighterFrom(oppModel, [], 5)).current;
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
  /* A real-time exchange needs pools sized to a whole fight, not to ten hits.
     Four waves is roughly two minutes of action: the bot lands ~94 hits in
     that time and the player gets ~160 taps in, so the pools and the two
     damage numbers below are set so that a fight that goes the distance ends
     near the last wave rather than in the first twenty seconds. */
  const MY_MAX = A.maxHp * 12, OP_MAX = B.maxHp * 12;
  const TAP_DMG = 0.55, BOT_DMG = 0.95;

  const [phase, setPhase] = useState("action");   // action | quiz | done
  const [wave, setWave] = useState(1);
  const [left, setLeft] = useState(WAVES[0]);
  const [myHp, setMyHp] = useState(MY_MAX);
  const [opHp, setOpHp] = useState(OP_MAX);
  const [q, setQ] = useState(null);
  const [culled, setCulled] = useState([]);
  const [gauge, setGauge] = useState(0);
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
  // ── where everyone is standing, and who is off the ground ──
  const [myX, setMyX] = useState(0.24);
  const [opX, setOpX] = useState(0.76);
  const [myAir, setMyAir] = useState(0);
  const [opAir, setOpAir] = useState(0);
  const [land, setLand] = useState(() => {
    try { return window.innerWidth > window.innerHeight * 1.25; } catch (e) { return false; }
  });
  const [cool, setCool] = useState({ punch: 0, fire: 0, rocket: 0, jump: 0, guard: 0 });

  const startedRef = useRef(Date.now());
  const doneRef = useRef(false);
  const hpRef = useRef({ me: MY_MAX, op: OP_MAX });
  const guardUntil = useRef(0), guardCd = useRef(0);
  const cdRef = useRef({ punch: 0, fire: 0, rocket: 0, jump: 0 });
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

  const G = useArenaFx();
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createArenaAudio();
  useEffect(() => { const a = audioRef.current; a.start(); return () => a.stop(); }, []);
  useEffect(() => {
    audioRef.current.setGear(myHp / MY_MAX < 0.34 || opHp / OP_MAX < 0.34);
  }, [myHp, opHp, MY_MAX, OP_MAX]);

  const say = (side, text, kind) => { setFlash({ side, text, kind }); later(() => setFlash(null), 900); };

  const strike = useCallback((side, kind, colour, moveKey) => {
    const foe = side === "me" ? "op" : "me";
    const mv = MOVES[moveKey] || MOVES.punch;
    const big = kind === "ult", crit = kind === "crit";
    const power = big ? 2.2 : crit ? 1.5 : 1;
    if (mv.lunge) setLunge(side);
    setShake(big ? 3 : crit ? 2 : 1);
    const a = audioRef.current;
    if (mv.fx === "bolt") {
      G.bolt(side, colour, crit ? 7 : 5, mv.part); a.sfx("shot");
      later(() => { G.burst(foe, power, colour); a.sfx("hit"); }, 190);
    } else if (mv.fx === "laser") {
      G.laser(side, colour, big ? 7 : crit ? 5 : 4, mv.part); a.sfx("laser");
      later(() => G.burst(foe, power * 1.1, colour), 130);
      if (big) later(() => { G.boom(foe, 1.5, colour); a.sfx("boom"); }, 260);
    } else if (mv.fx === "grenade") {
      a.sfx("lob");
      G.lob(side, colour, () => {
        G.boom(foe, big ? 2.4 : 1.5, "#ff9a3c"); G.flash("#fff4d0", big ? .6 : .34, .32);
        a.sfx("boom"); setShake(big ? 3 : 2); later(() => setShake(0), 480);
      });
    } else {
      a.sfx(mv.sfx === "kick" ? "kick" : crit ? "crit" : "hit");
      later(() => G.burst(foe, power, colour, mv.part === "foot" ? "foot" : "body"), 160);
      if (big) later(() => { G.boom(foe, 2, colour); a.sfx("boom"); }, 240);
    }
    if (big && mv.fx !== "grenade") G.flash("#ffffff", .55, .34);
    later(() => { setLunge(null); setShake(0); }, mv.fx === "grenade" ? 900 : 520);
  }, [G]);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    const mHp = hpRef.current.me, oHp = hpRef.current.op;
    const win = oHp <= 0 || (mHp > 0 && (mHp / MY_MAX) >= (oHp / OP_MAX));
    setPhase("done");
    setMyPose(win ? "win" : "down"); setOpPose(win ? "down" : "win");
    audioRef.current.stop(); audioRef.current.sfx(win ? "win" : "lose");
    G.flash(win ? "#ffd23f" : "#0b1526", .4, .6);
    G.burst(win ? "op" : "me", 2, win ? "#ffd23f" : "#8899aa");
    const final = scoreRef.current + Math.max(0, Math.round(mHp)) + (win ? 400 : 0);
    later(() => onDone({
      win, score: final, correct: correctRef.current, asked: askedRef.current,
      bestCombo: Math.max(bestCombo, comboRef.current),
      myHp: mHp, opHp: oHp, tier, seconds: Math.round((Date.now() - startedRef.current) / 1000),
    }), 950);
  }

  /** Damage the opponent. One path for taps, skills and the overdrive combo. */
  function hitOp(dmg, kind, moveKey) {
    if (doneRef.current) return;
    const d = Math.max(1, Math.round(dmg));
    const oHp = Math.max(0, hpRef.current.op - d);
    hpRef.current.op = oHp; setOpHp(oHp);
    const mv = moveKey || pickMove(myCls);
    setMyPose(MOVES[mv].pose); setOpPose("hit");
    strike("me", kind, myBolt, mv);
    say("op", "-" + d, kind === "crit" ? "crit" : "dmg");
    scoreRef.current += 10 + comboRef.current * 2; setScore(scoreRef.current);
    if (oHp <= 0) later(finish, 420);
  }

  /** Damage the player, after every guard, block and dodge has had a say. */
  function hitMe(dmg, moveKey) {
    if (doneRef.current) return;
    const nb = { ...buffRef.current };
    const now = Date.now();
    if (now < guardUntil.current) { audioRef.current.sfx("block"); G.burst("me", .8, "#5ce1ff"); say("me", T("กัน!", "GUARD", "格挡"), "block"); return; }
    if (airRef.current.me > 0) { audioRef.current.sfx("miss"); say("me", T("หลบ!", "AIRBORNE", "腾空"), "block"); return; }
    if (graceRef.current > 0) { graceRef.current = 0; setGraceLeft(0); audioRef.current.sfx("block"); say("me", T("ยกโทษให้", "FREE MISS", "免罚"), "block"); return; }
    if (nb.fortress > 0 || nb.block > 0 || nb.phase > 0 || (fx.passive === "evade" && Math.random() < 0.2)) {
      if (nb.block > 0) { nb.block = 0; buffRef.current = nb; setBuffs(nb); }
      audioRef.current.sfx("block"); G.burst("me", .7, "#5ce1ff");
      say("me", T("กันได้!", "BLOCKED", "格挡"), "block"); return;
    }
    const d = Math.max(1, Math.round(dmg * (fx.passive === "tough" ? 0.75 : 1) * petGuard));
    const mHp = Math.max(0, hpRef.current.me - d);
    hpRef.current.me = mHp; setMyHp(mHp);
    // halved, not reset: with the bot landing every ~1.2s a full reset means
    // the combo never gets past three and the mechanic may as well not exist
    comboRef.current = Math.floor(comboRef.current / 2); setCombo(comboRef.current);
    const mv = moveKey || pickMove(oppCls);
    setOpPose(MOVES[mv].pose); setMyPose("hit");
    strike("op", "hit", "#ff7a3c", mv);
    say("me", "-" + d, "dmg");
    if (mHp <= 0) later(finish, 420);
  }

  /* ── your attacks ── one path, three buttons, three shapes of risk ── */
  function attack(act) {
    if (phase !== "action" || doneRef.current) return;
    const A2 = ACT[act]; if (!A2) return;
    const now = Date.now();
    if (now < cdRef.current[act] || now < guardUntil.current) return;
    cdRef.current[act] = now + A2.cd;
    setCool(c => ({ ...c, [act]: now + A2.cd }));
    // a punch thrown from across the arena is a whiff, not a hit
    if (Math.abs(posRef.current.me - posRef.current.op) > A2.range) {
      audioRef.current.sfx("miss");
      setMyPose(MOVES[A2.move].pose);
      say("me", T("ไกลไป", "TOO FAR", "太远了"), "miss");
      later(() => setMyPose("ready"), 380);
      return;
    }
    const nb = { ...buffRef.current };
    comboRef.current += 1; setCombo(comboRef.current);
    setBestCombo(b => Math.max(b, comboRef.current));
    const comboK = Math.min(2.2, 1 + comboRef.current * (fx.passive === "streak" ? 0.08 : 0.04));
    let dmg = A.dmg * TAP_DMG * A2.dmg * comboK * (fx.passive === "power" ? 1.25 : 1) * petDmg;
    let kind = act === "rocket" ? "ult" : "hit";
    if (nb.crit > 0) { dmg *= 2.2; nb.crit = 0; kind = "crit"; buffRef.current = nb; setBuffs(nb); }
    if (nb.anthem > 0) { dmg *= 1.4; nb.anthem -= 1; buffRef.current = nb; setBuffs(nb); }
    if (overdrive) dmg *= 1.6;
    if (Math.random() < A.follow) { dmg *= 1.5; if (kind === "hit") kind = "crit"; }
    if (fx.passive === "repair") {
      const h = Math.min(MY_MAX, hpRef.current.me + 2); hpRef.current.me = h; setMyHp(h);
    }
    setGauge(g => Math.min(100, g + (A.charge * (fx.passive === "resonate" ? 1.3 : 1) * petSp) / 4));
    hitOp(dmg, kind, A2.move);
  }

  function jump() {
    if (phase !== "action" || doneRef.current) return;
    const now = Date.now();
    if (now < cdRef.current.jump) return;
    cdRef.current.jump = now + JUMP_CD;
    setCool(c => ({ ...c, jump: now + JUMP_CD }));
    airRef.current.me = 1;
    audioRef.current.sfx("charge");
    later(() => { airRef.current.me = 0; setMyAir(0); }, JUMP_MS);
  }

  function guard() {
    if (phase !== "action" || doneRef.current) return;
    const now = Date.now();
    if (now < guardCd.current) return;
    guardUntil.current = now + GUARD_MS; guardCd.current = now + GUARD_CD;
    setGuarding(true);
    audioRef.current.sfx("charge");
    G.burst("me", .6, "#5ce1ff");
    later(() => setGuarding(false), GUARD_MS);
  }

  /* ── footwork ──
     One 60ms tick moves you, moves the bot, and eases both jumps. The bot
     closes when it wants to be in punching range and backs off when it has
     just thrown something, which is what stops the two of them standing
     nose to nose for the whole fight. */
  useEffect(() => {
    if (phase !== "action" || doneRef.current) return;
    const id = setInterval(() => {
      if (doneRef.current) return;
      const dt = 0.06;
      const P = posRef.current;
      if (dirRef.current) P.me = Math.min(X_MAX, Math.max(X_MIN, P.me + dirRef.current * WALK * dt));
      // the bot drifts toward its preferred range
      const want = Math.random() < 0.5 ? 0.24 : 0.42;
      const gap = P.op - P.me;
      P.op += (gap > want ? -1 : gap < want - 0.06 ? 1 : 0) * WALK * 0.62 * dt;
      P.op = Math.min(X_MAX, Math.max(X_MIN, P.op));
      if (P.op - P.me < GAP_MIN) P.op = Math.min(X_MAX, P.me + GAP_MIN);
      setMyX(P.me); setOpX(P.op);
      // a jump is a half sine, so it leaves and lands instead of teleporting
      const now = Date.now();
      const h = airRef.current.me ? Math.sin(Math.PI * Math.min(1, (JUMP_MS - Math.max(0, cdRef.current.jump - JUMP_CD + JUMP_MS - now)) / JUMP_MS)) : 0;
      setMyAir(airRef.current.me ? Math.max(0.05, h) : 0);
      G.setPos(P.me, P.op, airRef.current.me ? Math.max(0.05, h) : 0, 0);
    }, 60);
    return () => clearInterval(id);
  }, [phase, G]);

  /* ── the wave clock, and the bot that fights through it ── */
  useEffect(() => {
    if (phase !== "action" || doneRef.current) return;
    const total = WAVES[Math.min(wave - 1, WAVES.length - 1)];
    const t0 = Date.now();
    const id = setInterval(() => {
      if (doneRef.current) return;
      const el = Date.now() - t0;
      setLeft(Math.max(0, total - el));
      if (el >= total) { clearInterval(id); toQuiz(); }
    }, 100);
    return () => clearInterval(id);
  }, [phase, wave]);

  useEffect(() => {
    if (phase !== "action" || doneRef.current) return;
    const gap = Math.round((BOT_GAP[tier.key] || 1250) * Math.max(0.6, 1 - (wave - 1) * 0.08));
    let alive = true, t = null;
    const step = () => {
      if (!alive || doneRef.current) return;
      hitMe(B.dmg * tier.dmgK * BOT_DMG);
      t = setTimeout(step, gap + Math.random() * 260 - 130);
    };
    t = setTimeout(step, gap);
    return () => { alive = false; if (t) clearTimeout(t); };
  }, [phase, wave, tier]);

  /* ── the knowledge break ── */
  function toQuiz() {
    if (doneRef.current) return;
    setPhase("quiz");
    setQ(makeQuestion(lang)); setCulled([]); setLocked(false);
    setMyPose("ready"); setOpPose("ready");
    audioRef.current.sfx("bell");
    G.flash("#ffffff", .32, .3);
    setBanner(T("⚡ ช่วงคำถาม", "⚡ KNOWLEDGE BREAK", "⚡ 知识时刻"));
    later(() => setBanner(null), 1500);
  }

  function answer(choice) {
    if (locked || doneRef.current) return;
    setLocked(true);
    const right = buffRef.current.foresee > 0 ? true : choice === q.ans;
    if (buffRef.current.foresee > 0) { const nb = { ...buffRef.current, foresee: 0 }; buffRef.current = nb; setBuffs(nb); }
    askedRef.current += 1; setAsked(askedRef.current);
    if (right) {
      correctRef.current += 1; setCorrect(correctRef.current);
      scoreRef.current += 250; setScore(scoreRef.current);
      setBanner(T("OVERDRIVE!", "OVERDRIVE!", "超载!"));
      setOverdrive(true);
      audioRef.current.sfx("ult");
      G.flash(clsInfo.c, .45, .4);
      // three staged hits, so a right answer is the loudest thing in the round
      [0, 260, 520].forEach((d, i) => later(() => hitOp(A.dmg * 9, i === 2 ? "ult" : "crit"), d));
      later(() => { setOverdrive(false); setBanner(null); nextWave(); }, 1500);
    } else {
      setBanner(T("ตอบผิด! โดนสวนหนัก", "WRONG! CRUSHING BLOW", "答错! 遭到重击"));
      audioRef.current.sfx("miss");
      later(() => punish(), 320);
      later(() => { setBanner(null); nextWave(); }, 2100);
    }
  }

  /** The price of a wrong answer. Deliberately NOT routed through hitMe: guard,
      evasion, the free-miss grace and every buff are bypassed, because none of
      them has anything to do with knowing the note. Flat 30% of the pool. */
  function punish() {
    if (doneRef.current) return;
    const d = Math.max(1, Math.round(MY_MAX * WRONG_PUNISH));
    const mHp = Math.max(0, hpRef.current.me - d);
    hpRef.current.me = mHp; setMyHp(mHp);
    comboRef.current = 0; setCombo(0);
    /* the opponent's biggest move, staged so it reads as an execution rather
       than another chip hit */
    const mv = ULT_MOVE[oppCls] || "cannon";
    setOpPose(MOVES[mv].pose); setMyPose("hit");
    setLunge("op"); setShake(3);
    strike("op", "ult", "#ff2d55", mv);
    later(() => { G.boom("me", 3, "#ff2d55"); G.flash("#ff2d55", .7, .5); audioRef.current.sfx("boom"); setShake(3); }, 260);
    later(() => { G.boom("me", 2.2, "#ffd23f"); audioRef.current.sfx("boom"); }, 520);
    later(() => { setLunge(null); setShake(0); }, 900);
    say("me", "-" + Math.round(WRONG_PUNISH * 100) + "%", "dmg");
    if (mHp <= 0) later(finish, 760);
  }

  function nextWave() {
    if (doneRef.current) return;
    if (hpRef.current.me <= 0 || hpRef.current.op <= 0) { finish(); return; }
    if (wave >= WAVES.length) { finish(); return; }
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
    else if (k === "reroll") { if (q) { setQ(makeQuestion(lang)); setCulled([]); } say("me", tr3(FX_TEXT.reroll, lang), "buff"); }
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

  function useUlt() {
    if (ultUsed || gauge < 100 || myRank < SKILL_UNLOCK.ultimate || doneRef.current) return;
    setUltUsed(true); setGauge(0);
    const k = fx.ult, nb = { ...buffRef.current };
    const mvKey = ULT_MOVE[myCls] || "punch";
    if (k === "triple") [0, 220, 440].forEach(d => later(() => hitOp(A.dmg * 7, "ult", mvKey), d));
    else if (k === "crescendo") hitOp(OP_MAX * 0.16, "ult", mvKey);
    else if (k === "finale") hitOp(A.dmg * (8 + comboRef.current), "ult", mvKey);
    else {
      audioRef.current.sfx("ult"); G.flash(clsInfo.c, .4, .4); G.burst("me", 1.6, clsInfo.c);
      if (k === "fortress") { nb.fortress = 3; say("me", tr3(FX_TEXT.fortress, lang), "buff"); }
      else if (k === "phase") { nb.phase = 2; say("me", tr3(FX_TEXT.phase, lang), "buff"); }
      else if (k === "foresee") { nb.foresee = 1; say("me", tr3(FX_TEXT.foresee, lang), "buff"); }
      else if (k === "overhaul") {
        const h = Math.min(MY_MAX, hpRef.current.me + Math.round(MY_MAX * 0.3));
        hpRef.current.me = h; setMyHp(h); say("me", "+" + Math.round(MY_MAX * .3), "heal");
      }
      buffRef.current = nb; setBuffs(nb);
    }
    if (playUi) playUi("reward");
  }

  const mySk = skillsOf(me);
  const activeSk = mySk.find(s => s.tier === "active");
  const ultSk = mySk.find(s => s.tier === "ultimate");
  const canActive = gauge >= 100 && myRank >= SKILL_UNLOCK.active && !doneRef.current;
  const canUlt = gauge >= 100 && myRank >= SKILL_UNLOCK.ultimate && !ultUsed && !doneRef.current;
  const waveTotal = WAVES[Math.min(wave - 1, WAVES.length - 1)];

  return (
    <div className={`pvppage fight${land ? " land" : ""}`}>
      <div className="pvphdr">
        <button className="stgback" onClick={onBack} aria-label="back">←</button>
        <span className="pvphdr-t">{T("ยก", "Wave", "波次")} {Math.min(wave, WAVES.length)}/{WAVES.length}</span>
        <span className="pvpscore">{score.toLocaleString()}</span>
      </div>

      <div className={`pvpstage${shake ? " sh" + shake : ""}${overdrive ? " od" : ""}`}>
        <canvas ref={G.canvasRef} className="pvpfx" />
        <div className="pvphps">
          <div className="pvphpcol">
            <div className="pvphp"><i style={{ width: `${Math.max(0, (myHp / MY_MAX) * 100)}%` }} /></div>
            <div className="pvphp-n">{tr3(CHAR_MODELS.find(m => m.id === me) || {}, lang)} · {Math.max(0, Math.round(myHp))}</div>
          </div>
          <div className="pvpvs">VS</div>
          <div className="pvphpcol">
            <div className="pvphp op"><i style={{ width: `${Math.max(0, (opHp / OP_MAX) * 100)}%` }} /></div>
            <div className="pvphp-n op">{Math.max(0, Math.round(opHp))} · {oppKind === "player" ? oppName : tr3(CHAR_MODELS.find(m => m.id === oppModel) || {}, lang)}</div>
          </div>
        </div>
        <div className={`pvpfighter me${lunge === "me" ? " lunge" : ""}${myPose === "hit" ? " knock" : ""}${guarding ? " guard" : ""}`}
          style={{ left: `calc(${(myX * 100).toFixed(1)}% - 22%)`, bottom: `${6 + myAir * 62}px` }}>
          <Bot model={me} yaw={lunge === "me" ? 42 : myPose === "hit" ? 14 : 26} pose={myPose}
            glow="#00b8d4" accent="#7c4dff" armorA="#1b2436" armorB="#41608a" />
          {flash && flash.side === "me" && <span className={`pvpflash ${flash.kind}`}>{flash.text}</span>}
          {/* the pet fights at your heel — it does not take hits or throw
              them, it stands there and applies the bonus you earned by
              looking after it */}
          {PET && petPic && (
            <span className="pvppet" title={petById(petPic.species).en}>
              <PetArt species={petPic.species} level={petLevel(petPic.bond).lv} mood={petPic.mood} />
            </span>
          )}
        </div>
        <div className={`pvpfighter op${lunge === "op" ? " lunge" : ""}${opPose === "hit" ? " knock" : ""}`}
          style={{ left: `calc(${(opX * 100).toFixed(1)}% - 22%)`, right: "auto", bottom: `${6 + opAir * 62}px` }}>
          <Bot model={oppModel} yaw={lunge === "op" ? -42 : opPose === "hit" ? -14 : -26} pose={opPose}
            glow="#ff7a3c" accent="#ff4d6a" armorA="#2b1a1a" armorB="#8a4a3a" />
          {flash && flash.side === "op" && <span className={`pvpflash ${flash.kind}`}>{flash.text}</span>}
        </div>
        {combo > 2 && <div className="pvpcombo" key={combo}><b>{combo}</b><i>{T("คอมโบ", "COMBO", "连击")}</i></div>}
        {banner && <div className="pvpbanner">{banner}</div>}
      </div>

      {phase === "action" && (
        <>
          <div className="pvpwave"><i style={{ width: `${Math.max(0, (left / waveTotal) * 100)}%` }} /></div>
          <div className="pvpwave-l">{T("คำถามจะมาใน", "Question in", "问题将在")} {Math.ceil(left / 1000)}s</div>
          {/* ── the pad ──
              Left thumb walks, right thumb fights. In landscape these two
              clusters float over the arena at the bottom corners, which is
              where the thumbs already are when a phone is held sideways; in
              portrait the same buttons stack under the stage. One control set,
              two layouts — two movesets would have been two games. */}
          <div className="pvppad">
            <div className="pvppad-l">
              <button className="pvpdir" aria-label={T("ถอย", "Back", "后退")}
                onPointerDown={() => { dirRef.current = -1; }} onPointerUp={() => { dirRef.current = 0; }}
                onPointerLeave={() => { dirRef.current = 0; }} onPointerCancel={() => { dirRef.current = 0; }}>◀</button>
              <button className={`pvpdir grd${guarding ? " on" : ""}`} aria-label={T("การ์ด", "Guard", "防御")}
                onPointerDown={guard}>🛡</button>
              <button className="pvpdir" aria-label={T("เดินหน้า", "Forward", "前进")}
                onPointerDown={() => { dirRef.current = 1; }} onPointerUp={() => { dirRef.current = 0; }}
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
              <button className="pvpact rocket" aria-label={T("จรวด", "Rocket", "火箭")} onPointerDown={() => attack("rocket")}>
                <b>🚀</b><i>{T("จรวด", "ROCKET", "火箭")}</i>
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "quiz" && q && (
        <>
          <div className="pvpuntimed">{T("ตอบถูก = โอเวอร์ไดรฟ์ · ไม่จับเวลา", "Answer right for OVERDRIVE · no time limit", "答对触发超载 · 不计时")}</div>
          <div className="pvpq">{q.q}</div>
          <div className="pvpopts">
            {q.opts.map(o => (
              <button key={o} className={`pvpopt${culled.includes(o) ? " culled" : ""}${locked && o === q.ans ? " right" : ""}`}
                disabled={locked || culled.includes(o)} onClick={() => answer(o)}>{o}</button>
            ))}
          </div>
        </>
      )}

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
