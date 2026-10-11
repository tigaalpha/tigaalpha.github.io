/* ── quiz-quest.ts ── review questions for Adventure Mode (owner, 2026-10-12) ──
   Questions come ONLY from what this learner has already studied (the Pathway topics they finished,
   `tg_path_done`), so two learners get different questions. They climb from easy to hard: the level
   rises after three right answers in a row and falls after two wrong ones. A wrong answer teaches: the
   correct notes are lit on a piano with a short reason. Topics the learner misses are asked again
   more often (`tg_adv_weak`). Pure functions over localStorage and a seeded-by-time random: nothing
   here calls a model or the network. */

const LET = ["C", "D", "E", "F", "G", "A", "B"] as const;
const NPC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export type Lang = "th" | "en" | "zh";
const T3 = (lang: Lang, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);

/** A note spelled from a root and a number of semitones, with the right letter for its degree. */
function spell(rootLetter: number, rootAcc: number, degree: number, semis: number) {
  const letter = LET[(rootLetter + degree) % 7];
  const rootPc = (NPC[LET[rootLetter]] + rootAcc + 12) % 12;
  const pc = (rootPc + semis) % 12;
  let diff = ((pc - NPC[letter] + 18) % 12) - 6;
  return { name: letter + (diff > 0 ? "#".repeat(diff) : diff < 0 ? "b".repeat(-diff) : ""), pc };
}
const MAJOR = [0, 2, 4, 5, 7, 9, 11], NAT_MINOR = [0, 2, 3, 5, 7, 8, 10], HARM_MINOR = [0, 2, 3, 5, 7, 8, 11];
const KEYS = [   // [letter index, accidental, display]
  [0, 0, "C"], [4, 0, "G"], [3, 0, "F"], [1, 0, "D"], [5, 0, "A"], [2, 0, "E"], [6, -1, "Bb"], [2, -1, "Eb"], [6, 0, "B"], [5, -1, "Ab"], [1, -1, "Db"], [3, 1, "F#"],
] as const;
const EASY_KEYS = KEYS.slice(0, 3), MID_KEYS = KEYS.slice(0, 6), ALL_KEYS = KEYS;
function scaleOf(key: readonly [number, number, string], pattern: number[]) { return pattern.map((s, d) => spell(key[0], key[1], d, s)); }
const pcName = (pc: number) => NAMES_SHARP[((pc % 12) + 12) % 12];
/** the on-piano name (C4..B5 range the app's small piano draws) of a pitch class, always in the lower octave */
const onPiano = (pc: number) => NAMES_SHARP[((pc % 12) + 12) % 12] + "4";

export type Question = {
  id: string; topic: string; tier: number; kind: "key" | "keys" | "choice";
  q: string; ans?: number[];                          // pitch classes for key / keys
  opts?: { label: string; ok: boolean }[];            // for choice
  teach: { lit: string[]; why: string };              // piano keys to light, and the reason
  label: string;                                      // a short name for the learner's memory
};

const pick = <T,>(a: readonly T[], r: () => number): T => a[Math.floor(r() * a.length)];
const shuffle = <T,>(a: T[], r: () => number) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const ord = (lang: Lang, n: number) => T3(lang, "ที่ " + n, ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"][n] || n + "th", "第" + n);

/* ── what this learner has studied ── */
export function learnedTopics(done: Iterable<string>): string[] {
  const d = new Set(done); const out: string[] = [];
  if (d.has("scale") || d.has("major") || d.has("natural_minor") || d.has("harmonic_minor") || d.has("melodic_minor") || d.has("minor")) out.push("scale");
  if (d.has("triad") || d.has("blockchord") || d.has("padchord") || d.has("progression")) out.push("triad");
  if (d.has("interval")) out.push("interval");
  if (d.has("seventh") || d.has("halfdim") || d.has("dim") || d.has("aug") || d.has("tension")) out.push("seventh");
  return out;
}
export function readDone(): string[] { try { return JSON.parse(localStorage.getItem("tg_path_done") || "[]") || []; } catch (e) { return []; } }

/* ── the ladder and the memory of mistakes ── */
const QK = "tg_adv_quiz", WK = "tg_adv_weak";
export function readLadder(): { lvl: number; streak: number; miss: number } { try { const v = JSON.parse(localStorage.getItem(QK) || "null"); if (v && v.lvl >= 1) return { lvl: Math.min(5, v.lvl), streak: v.streak | 0, miss: v.miss | 0 }; } catch (e) {} return { lvl: 1, streak: 0, miss: 0 }; }
export function recordAnswer(ok: boolean, topic: string) {
  const l = readLadder();
  if (ok) { l.streak++; l.miss = 0; if (l.streak >= 3 && l.lvl < 5) { l.lvl++; l.streak = 0; } }
  else { l.miss++; l.streak = 0; if (l.miss >= 2 && l.lvl > 1) { l.lvl--; l.miss = 0; } }
  try { localStorage.setItem(QK, JSON.stringify(l)); } catch (e) {}
  try {
    const w: Record<string, number> = JSON.parse(localStorage.getItem(WK) || "{}") || {};
    w[topic] = Math.max(0, (w[topic] || 0) + (ok ? -1 : 2)); localStorage.setItem(WK, JSON.stringify(w));
  } catch (e) {}
  return l;
}
const weakOf = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(WK) || "{}") || {}; } catch (e) { return {}; } };

/* ── question families, each with a minimum level it makes sense at ── */
function qDegree(lang: Lang, r: () => number, lvl: number): Question {
  const key = pick(lvl <= 1 ? EASY_KEYS : lvl <= 2 ? MID_KEYS : ALL_KEYS, r), sc = scaleOf(key, MAJOR);
  const d = 2 + Math.floor(r() * 6), note = sc[d - 1];
  return { id: "deg", topic: "scale", tier: lvl, kind: "key", ans: [note.pc], label: `${key[2]} major · ${ord("en", d)} note`,
    q: T3(lang, `โน้ตตัวที่ ${d} ของสเกล ${key[2]} เมเจอร์ คือตัวไหน? กดคีย์บนเปียโน`, `What is the ${ord("en", d)} note of the ${key[2]} major scale? Tap it on the piano.`, `${key[2]} 大调音阶的第 ${d} 个音是哪个？点琴键回答。`),
    teach: { lit: sc.map(n => onPiano(n.pc)), why: T3(lang, `${key[2]} เมเจอร์ = ${sc.map(n => n.name).join(" ")} — ตัวที่ ${d} คือ ${note.name}`, `${key[2]} major = ${sc.map(n => n.name).join(" ")} — the ${ord("en", d)} note is ${note.name}.`, `${key[2]} 大调 = ${sc.map(n => n.name).join(" ")}，第 ${d} 个音是 ${note.name}。`) } };
}
function qNotIn(lang: Lang, r: () => number, lvl: number): Question {
  const key = pick(lvl <= 3 ? MID_KEYS : ALL_KEYS, r), sc = scaleOf(key, MAJOR), inPcs = new Set(sc.map(n => n.pc));
  const outside = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(p => !inPcs.has(p));
  return { id: "notin", topic: "scale", tier: lvl, kind: "key", ans: outside, label: `${key[2]} major · notes outside`,
    q: T3(lang, `โน้ตไหน "ไม่อยู่" ในสเกล ${key[2]} เมเจอร์? (กดคีย์ไหนก็ได้ที่อยู่นอกสเกล)`, `Which note is NOT in the ${key[2]} major scale? (any key outside the scale counts)`, `哪个音不在 ${key[2]} 大调音阶中？（任何不在音阶内的键都算对）`),
    teach: { lit: sc.map(n => onPiano(n.pc)), why: T3(lang, `สเกล ${key[2]} เมเจอร์มี ${sc.map(n => n.name).join(" ")} คีย์อื่นนอกจากนี้ไม่อยู่ในสเกล`, `The ${key[2]} major scale has ${sc.map(n => n.name).join(" ")}; every other key is outside it.`, `${key[2]} 大调包含 ${sc.map(n => n.name).join(" ")}，其余的键都不在音阶内。`) } };
}
function qAccidentals(lang: Lang, r: () => number, lvl: number): Question {
  const pool = ALL_KEYS.filter(k => k[2] !== "C").slice(0, lvl <= 3 ? 8 : 11), key = pick(pool, r), sc = scaleOf(key, MAJOR);
  const acc = sc.filter(n => n.name.length > 1), isSharp = acc[0] && acc[0].name.includes("#");
  const n = acc.length, opts = shuffle([n, n + 1, Math.max(0, n - 1), n + 2].filter((v, i, a) => a.indexOf(v) === i), r).slice(0, 4);
  return { id: "acc", topic: "scale", tier: lvl, kind: "choice", label: `${key[2]} major · accidentals`,
    q: T3(lang, `สเกล ${key[2]} เมเจอร์ มีเครื่องหมาย ${isSharp ? "♯" : "♭"} กี่ตัว?`, `How many ${isSharp ? "sharps" : "flats"} does ${key[2]} major have?`, `${key[2]} 大调有几个${isSharp ? "升号" : "降号"}？`),
    opts: opts.map(v => ({ label: String(v), ok: v === n })),
    teach: { lit: sc.map(x => onPiano(x.pc)), why: T3(lang, `${key[2]} เมเจอร์ = ${sc.map(x => x.name).join(" ")} มี ${n} ตัว: ${acc.map(x => x.name).join(", ")}`, `${key[2]} major = ${sc.map(x => x.name).join(" ")}: ${n} accidental(s) — ${acc.map(x => x.name).join(", ")}.`, `${key[2]} 大调 = ${sc.map(x => x.name).join(" ")}，共 ${n} 个：${acc.map(x => x.name).join("、")}。`) } };
}
function qMinorDiff(lang: Lang, r: () => number, lvl: number): Question {
  const key = pick(MID_KEYS, r), nat = scaleOf(key, NAT_MINOR), har = scaleOf(key, HARM_MINOR);
  return { id: "harm", topic: "scale", tier: lvl, kind: "key", ans: [har[6].pc], label: `${key[2]} harmonic minor · raised 7th`,
    q: T3(lang, `ใน ${key[2]} ไมเนอร์ฮาร์โมนิก โน้ตตัวที่ 7 ต่างจากไมเนอร์ธรรมชาติอย่างไร? กดโน้ตตัวที่ 7 ของฮาร์โมนิก`, `In ${key[2]} harmonic minor the 7th note is raised. Tap the 7th note of ${key[2]} harmonic minor.`, `${key[2]} 和声小调的第 7 音比自然小调升高了半音。点出和声小调的第 7 音。`),
    teach: { lit: har.map(n => onPiano(n.pc)), why: T3(lang, `ธรรมชาติ ${nat[6].name} → ฮาร์โมนิก ${har[6].name} (ยกขึ้นครึ่งเสียง)`, `Natural ${nat[6].name} → harmonic ${har[6].name} (raised a half step).`, `自然小调 ${nat[6].name} → 和声小调 ${har[6].name}（升高半音）。`) } };
}
function qFinger(lang: Lang, r: () => number, lvl: number): Question {
  const notes = ["C", "D", "E", "F", "G", "A", "B", "C"], fing = [1, 2, 3, 1, 2, 3, 4, 5];
  const i = 1 + Math.floor(r() * 7), f = fing[i];
  const opts = [1, 2, 3, 4, 5];
  return { id: "fing", topic: "scale", tier: lvl, kind: "choice", label: `C major · finger for ${notes[i]}`,
    q: T3(lang, `สเกล C เมเจอร์ มือขวาขึ้น โน้ต ${notes[i]} ใช้นิ้วไหน? (1 = โป้ง … 5 = ก้อย)`, `C major scale, right hand going up: which finger plays ${notes[i]}? (1 = thumb … 5 = little)`, `C 大调右手上行，${notes[i]} 用哪根手指？（1=拇指…5=小指）`),
    opts: opts.map(v => ({ label: String(v), ok: v === f })),
    teach: { lit: notes.slice(0, 8).map((n, k) => n + (k === 7 ? "5" : "4")).filter(x => x.endsWith("4")), why: T3(lang, `นิ้ว: C-1 D-2 E-3 (โป้งลอด) F-1 G-2 A-3 B-4 C-5 → ${notes[i]} ใช้นิ้ว ${f}`, `Fingering: C-1 D-2 E-3 (thumb under) F-1 G-2 A-3 B-4 C-5 → ${notes[i]} takes finger ${f}.`, `指法：C-1 D-2 E-3（拇指穿越）F-1 G-2 A-3 B-4 C-5 → ${notes[i]} 用 ${f} 指。`) } };
}
function qTriad(lang: Lang, r: () => number, lvl: number): Question {
  const key = pick(lvl <= 2 ? EASY_KEYS : lvl <= 3 ? MID_KEYS : ALL_KEYS, r), minor = lvl >= 2 && r() < 0.5;
  const root = spell(key[0], key[1], 0, 0), third = spell(key[0], key[1], 2, minor ? 3 : 4), fifth = spell(key[0], key[1], 4, 7);
  return { id: "triad", topic: "triad", tier: lvl, kind: "keys", ans: [root.pc, third.pc, fifth.pc], label: `${key[2]} ${minor ? "minor" : "major"} triad`,
    q: T3(lang, `คอร์ด ${key[2]}${minor ? " ไมเนอร์" : " เมเจอร์"} ประกอบด้วยโน้ตอะไรบ้าง? กดครบ 3 ตัวแล้วกดยืนยัน`, `Which three notes make a ${key[2]} ${minor ? "minor" : "major"} chord? Tap all three, then confirm.`, `${key[2]}${minor ? "小" : "大"}三和弦由哪三个音组成？点出三个音后确认。`),
    teach: { lit: [onPiano(root.pc), onPiano(third.pc), onPiano(fifth.pc)], why: T3(lang, `${root.name} + ${third.name} (${minor ? "เล็ก" : "ใหญ่"} 3) + ${fifth.name} (เพอร์เฟกต์ 5)`, `${root.name} + ${third.name} (${minor ? "minor" : "major"} 3rd) + ${fifth.name} (perfect 5th).`, `${root.name} + ${third.name}（${minor ? "小" : "大"}三度）+ ${fifth.name}（纯五度）。`) } };
}
function qTriadQuality(lang: Lang, r: () => number, lvl: number): Question {
  const key = pick(MID_KEYS, r), minor = r() < 0.5;
  const root = spell(key[0], key[1], 0, 0), third = spell(key[0], key[1], 2, minor ? 3 : 4), fifth = spell(key[0], key[1], 4, 7);
  return { id: "tq", topic: "triad", tier: lvl, kind: "choice", label: `${root.name}-${third.name}-${fifth.name} quality`,
    q: T3(lang, `${root.name} – ${third.name} – ${fifth.name} เป็นคอร์ดชนิดใด?`, `${root.name} – ${third.name} – ${fifth.name} is which kind of chord?`, `${root.name} – ${third.name} – ${fifth.name} 是什么和弦？`),
    opts: shuffle([{ label: T3(lang, "เมเจอร์", "Major", "大三和弦"), ok: !minor }, { label: T3(lang, "ไมเนอร์", "Minor", "小三和弦"), ok: minor }, { label: T3(lang, "ดิมินิช", "Diminished", "减三和弦"), ok: false }], r),
    teach: { lit: [onPiano(root.pc), onPiano(third.pc), onPiano(fifth.pc)], why: T3(lang, `ช่วงระหว่างตัวที่ 1 กับ 2 คือ ${minor ? "3 เสียงครึ่ง = ไมเนอร์" : "4 ครึ่งเสียง = เมเจอร์"}`, `The first gap is ${minor ? "3 semitones = minor" : "4 semitones = major"}.`, `第一个音程是 ${minor ? "3 个半音 = 小三和弦" : "4 个半音 = 大三和弦"}。`) } };
}
const IV = [[1, "minor 2nd", "ไมเนอร์ 2", "小二度"], [2, "major 2nd", "เมเจอร์ 2", "大二度"], [3, "minor 3rd", "ไมเนอร์ 3", "小三度"], [4, "major 3rd", "เมเจอร์ 3", "大三度"], [5, "perfect 4th", "เพอร์เฟกต์ 4", "纯四度"], [7, "perfect 5th", "เพอร์เฟกต์ 5", "纯五度"], [9, "major 6th", "เมเจอร์ 6", "大六度"], [11, "major 7th", "เมเจอร์ 7", "大七度"], [12, "octave", "ออกเทฟ", "八度"]] as const;
function qInterval(lang: Lang, r: () => number, lvl: number): Question {
  const pool = lvl <= 2 ? IV.filter(v => [2, 4, 5, 7, 12].includes(v[0])) : IV, iv = pick(pool, r), root = pick(lvl <= 2 ? EASY_KEYS : MID_KEYS, r);
  const a = spell(root[0], root[1], 0, 0), top = (a.pc + iv[0]) % 12;
  const name = (v: readonly [number, string, string, string]) => T3(lang, v[2], v[1], v[3]);
  const wrong = shuffle(pool.filter(v => v[0] !== iv[0]) as any[], r).slice(0, 3);
  return { id: "iv", topic: "interval", tier: lvl, kind: "choice", label: `interval ${a.name} → ${pcName(top)}`,
    q: T3(lang, `จาก ${a.name} ขึ้นไปถึง ${pcName(top)} เป็นช่วงเสียงอะไร?`, `From ${a.name} up to ${pcName(top)}: which interval is it?`, `从 ${a.name} 向上到 ${pcName(top)} 是什么音程？`),
    opts: shuffle([{ label: name(iv), ok: true }, ...wrong.map(v => ({ label: name(v), ok: false }))], r),
    teach: { lit: [onPiano(a.pc), onPiano(top)], why: T3(lang, `${a.name} → ${pcName(top)} ห่างกัน ${iv[0]} ครึ่งเสียง = ${iv[2]}`, `${a.name} → ${pcName(top)} is ${iv[0]} semitones = a ${iv[1]}.`, `${a.name} → ${pcName(top)} 相隔 ${iv[0]} 个半音 = ${iv[3]}。`) } };
}
function qIntervalPlay(lang: Lang, r: () => number, lvl: number): Question {
  const iv = pick(IV.filter(v => [3, 4, 5, 7].includes(v[0])), r), root = pick(MID_KEYS, r), a = spell(root[0], root[1], 0, 0), top = (a.pc + iv[0]) % 12;
  return { id: "ivp", topic: "interval", tier: lvl, kind: "key", ans: [top], label: `play ${iv[1]} above ${a.name}`,
    q: T3(lang, `กดโน้ตที่สูงกว่า ${a.name} เป็น ${iv[2]}`, `Tap the note a ${iv[1]} above ${a.name}.`, `点出比 ${a.name} 高 ${iv[3]} 的音。`),
    teach: { lit: [onPiano(a.pc), onPiano(top)], why: T3(lang, `${a.name} + ${iv[0]} ครึ่งเสียง = ${pcName(top)}`, `${a.name} + ${iv[0]} semitones = ${pcName(top)}.`, `${a.name} + ${iv[0]} 个半音 = ${pcName(top)}。`) } };
}
function qSeventh(lang: Lang, r: () => number, lvl: number): Question {
  const key = pick(EASY_KEYS.concat(KEYS.slice(3, 6)), r), maj7 = r() < 0.5;
  const root = spell(key[0], key[1], 0, 0), third = spell(key[0], key[1], 2, 4), fifth = spell(key[0], key[1], 4, 7), sev = spell(key[0], key[1], 6, maj7 ? 11 : 10);
  return { id: "sev", topic: "seventh", tier: lvl, kind: "keys", ans: [root.pc, third.pc, fifth.pc, sev.pc], label: `${key[2]}${maj7 ? "maj7" : "7"} notes`,
    q: T3(lang, `คอร์ด ${key[2]}${maj7 ? "maj7" : "7"} ประกอบด้วยโน้ตอะไรบ้าง? กดครบ 4 ตัวแล้วกดยืนยัน`, `Which four notes make ${key[2]}${maj7 ? "maj7" : "7"}? Tap all four, then confirm.`, `${key[2]}${maj7 ? "maj7" : "7"} 由哪四个音组成？点出四个音后确认。`),
    teach: { lit: [onPiano(root.pc), onPiano(third.pc), onPiano(fifth.pc), onPiano(sev.pc)], why: T3(lang, `${root.name} ${third.name} ${fifth.name} + ตัวที่ 7 ${sev.name} (${maj7 ? "เมเจอร์ 7" : "ไมเนอร์ 7 = ครึ่งเสียงต่ำกว่า"})`, `${root.name} ${third.name} ${fifth.name} + the 7th ${sev.name} (${maj7 ? "major 7th" : "minor 7th, a whole step below the octave"}).`, `${root.name} ${third.name} ${fifth.name} + 七音 ${sev.name}（${maj7 ? "大七度" : "小七度"}）。`) } };
}
function qBasic(lang: Lang, r: () => number): Question {
  const n = pick(["C", "D", "E", "F", "G", "A", "B"] as const, r), pc = NPC[n];
  return { id: "basic", topic: "basics", tier: 1, kind: "key", ans: [pc], label: `find ${n}`,
    q: T3(lang, `กดคีย์ ${n} บนเปียโน (คีย์ขาว)`, `Tap the key ${n} on the piano.`, `在钢琴上点出 ${n} 键。`),
    teach: { lit: [n + "4"], why: T3(lang, `โน้ต ${n} คือคีย์ขาวที่ถูกต้องตามตำแหน่งนี้ — C อยู่ซ้ายของกลุ่มดำสองลูก`, `${n} is this white key; C sits just left of the group of two black keys.`, `${n} 就是这个白键；C 在两个黑键组的左边。`) } };
}

type Fam = { f: (lang: Lang, r: () => number, lvl: number) => Question; topic: string; min: number; max: number };
const FAMS: Fam[] = [
  { f: qDegree, topic: "scale", min: 1, max: 5 }, { f: qNotIn, topic: "scale", min: 3, max: 5 }, { f: qAccidentals, topic: "scale", min: 3, max: 5 },
  { f: qFinger, topic: "scale", min: 2, max: 4 }, { f: qMinorDiff, topic: "scale", min: 4, max: 5 },
  { f: qTriad, topic: "triad", min: 1, max: 5 }, { f: qTriadQuality, topic: "triad", min: 2, max: 5 },
  { f: qInterval, topic: "interval", min: 1, max: 5 }, { f: qIntervalPlay, topic: "interval", min: 3, max: 5 },
  { f: qSeventh, topic: "seventh", min: 3, max: 5 },
];

/** The next question for this learner: only from topics they have studied, at their ladder level, leaning on what they missed. */
export function nextQuestion(lang: Lang, opts: { done?: string[]; level?: number; rand?: () => number } = {}): { q: Question; learned: string[]; level: number } {
  const r = opts.rand || Math.random, learned = learnedTopics(opts.done || readDone()), lvl = opts.level || readLadder().lvl;
  if (!learned.length) return { q: qBasic(lang, r), learned, level: 1 };
  const weak = weakOf();
  let pool = FAMS.filter(f => learned.includes(f.topic) && lvl >= f.min && lvl <= f.max);
  if (!pool.length) pool = FAMS.filter(f => learned.includes(f.topic) && f.min <= lvl);
  if (!pool.length) pool = FAMS.filter(f => learned.includes(f.topic));
  const hurt = pool.filter(f => (weak[f.topic] || 0) > 0);
  const fam = hurt.length && r() < 0.4 ? pick(hurt, r) : pick(pool, r);
  return { q: fam.f(lang, r, lvl), learned, level: lvl };
}

/** Is a set of tapped pitch classes right for this question? (a "key" question accepts any one of its answers) */
export function judgeKeys(q: Question, tapped: number[]): boolean {
  const ans = q.ans || []; const t = Array.from(new Set(tapped.map(p => ((p % 12) + 12) % 12)));
  if (q.kind === "key") return t.length === 1 && ans.includes(t[0]);
  return t.length === ans.length && ans.every(a => t.includes(a));
}


/** Adventure phase 3.4, the chord spell: a question that must be answered by playing keys, drawn from what the learner has studied.
    A chord they know (triad) if they have, else two notes (interval), else a scale degree, else a basic note. Never a choice question. */
export function nextSpell(lang: Lang, opts: { done?: string[]; level?: number; rand?: () => number } = {}): { q: Question; learned: string[]; level: number } {
  const r = opts.rand || Math.random, learned = learnedTopics(opts.done || readDone()), lvl = opts.level || readLadder().lvl;
  if (learned.includes("triad")) return { q: qTriad(lang, r, Math.min(lvl, 5)), learned, level: lvl };
  if (learned.includes("interval")) return { q: qIntervalPlay(lang, r, Math.min(lvl, 5)), learned, level: lvl };
  if (learned.includes("scale")) return { q: qDegree(lang, r, Math.min(lvl, 5)), learned, level: lvl };
  return { q: qBasic(lang, r), learned, level: 1 };
}
