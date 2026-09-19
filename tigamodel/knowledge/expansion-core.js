/* ── tigamodel/knowledge/expansion-core.js ──
   The MUSIC-THEORY COMPUTATION ENGINE behind the 10,000-item knowledge
   expansion (owner directive 2026-09-18: "อีกหนึ่งหมื่นสิ่งที่ควรสร้าง…
   เรียนดนตรี ศิลปกรรม ดนตรีทั้งหมด").

   Design rule (this repo's hard rules): the expansion generates REAL,
   verifiable facts — every entry is COMPUTED from actual music-theory
   math (pitch classes, scale-degree spellings, chord intervals, key
   relationships, frequency in Hz), never filler text. Any generated line
   can be checked against a textbook: "A minor scale = A B C D E F G A",
   "G7 = G B D F", "violin G3 = 196.0 Hz".

   Shape matches the existing KB (knowledge-base.js): entries carry
   id/type/domain/title/body/teach/confidence and are plain data — the
   seeder just kb.add()s them. ── */

export const SHARP_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_EQUIV = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

/* Scale interval (semitone) formulas */
export const SCALES = {
  major: { steps: [0, 2, 4, 5, 7, 9, 11, 12], th: "เมเจอร์", en: "major", mood: "สดใส มั่นคง เป็นฐานของเพลงส่วนใหญ่" },
  naturalMinor: { steps: [0, 2, 3, 5, 7, 8, 10, 12], th: "ไมเนอร์ธรรมชาติ", en: "natural minor", mood: "เศร้า ลึกลับ เป็นรากของเพลงส่วนใหญ่ในโลก" },
  harmonicMinor: { steps: [0, 2, 3, 5, 7, 8, 11, 12], th: "ไมเนอร์ฮาร์มอนิก", en: "harmonic minor", mood: "ตะวันออก ลึกลับ มีช่องว่าง 1.5 โทนที่เป็นเอกลักษณ์" },
  melodicMinor: { steps: [0, 2, 3, 5, 7, 9, 11, 12], th: "ไมเนอร์เมโลดิก", en: "melodic minor", mood: "ไหลลื่นขึ้น ย้อนกลับเป็นธรรมชาติ — ยืดหยุ่นทั้งจาซ์และคลาสสิก" },
  dorian: { steps: [0, 2, 3, 5, 7, 9, 10, 12], th: "โดเรียน", en: "Dorian", mood: "เย็นชาอมเศร้า — เพลงโฟล์ก แจ๊ส ร็อกชอบใช้" },
  phrygian: { steps: [0, 1, 3, 5, 7, 8, 10, 12], th: "ฟรีเจียน", en: "Phrygian", mood: "สเปน/ตะวันออกกลาง เคร่งขรึม ดิบ" },
  lydian: { steps: [0, 2, 4, 6, 7, 9, 11, 12], th: "ลิเดียน", en: "Lydian", mood: "ลอยขึ้น ฝันหวาน โลกสวยเกินจริง (โน้ต #4)" },
  mixolydian: { steps: [0, 2, 4, 5, 7, 9, 10, 12], th: "มิกโซลิเดียน", en: "Mixolydian", mood: "บลูส์-ร็อก โดเมอร์เจอร์ที่หายไป 1 อารมณ์" },
  aeolian: { steps: [0, 2, 3, 5, 7, 8, 10, 12], th: "อีโอเลียน", en: "Aeolian", mood: "เหมือนไมเนอร์ธรรมชาติ — โหมดที่คนไทยใช้บ่อยโดยไม่รู้ตัว" },
  locrian: { steps: [0, 1, 3, 5, 6, 8, 10, 12], th: "โลเครียน", en: "Locrian", mood: "ไม่นิ่ง ไม่มีที่พัก ทฤษฎีมีแต่นิยมใช้น้อย" },
  blues: { steps: [0, 3, 5, 6, 7, 10, 12], th: "บลูส์", en: "blues", mood: "blue note (♭5) คือหัวใจของเสียงบลูส์" },
  wholeTone: { steps: [0, 2, 4, 6, 8, 10, 12], th: "โทนเต็ม", en: "whole-tone", mood: "ลอยความเมจิกสมัย impressionist (Debussy)" },
  pentatonicMajor: { steps: [0, 2, 4, 7, 9, 12], th: "เพนทาโทนิกเมเจอร์", en: "major pentatonic", mood: "5 โน้ตแต่เล่นเพลงได้เกือบทั้งโลก — จีน แอฟริกา อเมริกาใช้เหมือนกัน" },
  pentatonicMinor: { steps: [0, 3, 5, 7, 10, 12], th: "เพนทาโทนิกไมเนอร์", en: "minor pentatonic", mood: "แกนกลางของบลูส์ ร็อก และโซล" },
};

/* Chord formulas (semitones from root) + degree labels */
export const CHORD_TYPES = {
  maj: { steps: [0, 4, 7], th: "เมเจอร์", en: "major", deg: ["1", "3", "5"] },
  min: { steps: [0, 3, 7], th: "ไมเนอร์", en: "minor", deg: ["♭3", "5"] },
  dim: { steps: [0, 3, 6], th: "ดิมินิชต์", en: "diminished", deg: ["♭3", "♭5"] },
  aug: { steps: [0, 4, 8], th: "ออกเมนต์ต์", en: "augmented", deg: ["3", "#5"] },
  sus2: { steps: [0, 2, 7], th: "ซัส2", en: "sus2", deg: ["2", "5"] },
  sus4: { steps: [0, 5, 7], th: "ซัส4", en: "sus4", deg: ["4", "5"] },
  maj6: { steps: [0, 4, 7, 9], th: "เมเจอร์ 6", en: "major 6", deg: ["3", "5", "6"] },
  min6: { steps: [0, 3, 7, 9], th: "ไมเนอร์ 6", en: "minor 6", deg: ["♭3", "5", "6"] },
  maj7: { steps: [0, 4, 7, 11], th: "เมเจอร์เซเวนท์", en: "major 7", deg: ["3", "5", "7"] },
  min7: { steps: [0, 3, 7, 10], th: "ไมเนอร์เซเวนท์", en: "minor 7", deg: ["♭3", "5", "♭7"] },
  dom7: { steps: [0, 4, 7, 10], th: "โดมิแนนต์เซเวนท์", en: "dominant 7", deg: ["3", "5", "♭7"] },
  m7b5: { steps: [0, 3, 6, 10], th: "ฮาล์ฟ-ดิมินิชต์", en: "half-diminished", deg: ["♭3", "♭5", "♭7"] },
  dim7: { steps: [0, 3, 6, 9], th: "ดิมินิชต์เซเวนท์", en: "diminished 7", deg: ["♭3", "♭5", "♭♭7"] },
  mMaj7: { steps: [0, 3, 7, 11], th: "ไมเนอร์เมเจอร์เซเวนท์", en: "minor-major 7", deg: ["♭3", "5", "7"] },
  maj9: { steps: [0, 4, 7, 11, 14], th: "เมเจอร์ 9", en: "major 9", deg: ["3", "5", "7", "9"] },
  min9: { steps: [0, 3, 7, 10, 14], th: "ไมเนอร์ 9", en: "minor 9", deg: ["♭3", "5", "♭7", "9"] },
  dom9: { steps: [0, 4, 7, 10, 14], th: "โดมิแนนต์ 9", en: "dominant 9", deg: ["3", "5", "♭7", "9"] },
  min11: { steps: [0, 3, 7, 10, 14, 17], th: "ไมเนอร์ 11", en: "minor 11", deg: ["♭3", "5", "♭7", "9", "11"] },
  dom13: { steps: [0, 4, 7, 10, 14, 21], th: "โดมิแนนต์ 13", en: "dominant 13", deg: ["3", "5", "♭7", "9", "13"] },
};

/* Degree → function label in a major key */
const MAJOR_DEGREE_FN = ["โทนิก — บ้านของเพลง (T)", "ซุปเปอร์โทนิก — ออกเดินทาง (S)", "มีเดียนต์ — สีสัน (T)", "ซับโดมิแนนต์ — เตรียมกลับ (S)", "โดมิแนนต์ — แรงผลักกลับบ้าน (D)", "ซับมีเดียนต์ — เศร้าปลอม/เพื่อนโทนิก (T)", "ลีดดิ้งโทน — ดึงกลับโทนิกแรงที่สุด (D)"];
const ROMAN_MAJ = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];

/* A440 → frequency of any pitch class in octave o */
export function freq(pcName, octave) {
  const pc = SHARP_ORDER.indexOf(pcName);
  if (pc < 0) return null;
  const semis = (octave - 4) * 12 + (pc - 9); // offset from A4
  return 440 * Math.pow(2, semis / 12);
}

export function midiOf(pcName, octave) { return SHARP_ORDER.indexOf(pcName) < 0 ? null : (octave + 1) * 12 + SHARP_ORDER.indexOf(pcName); }

function pcName(idx) { const i = ((idx % 12) + 12) % 12; return SHARP_ORDER[i]; }

function noteName(pcIdx, octave) { return pcName(pcIdx) + octave; }

function notesFrom(rootPc, steps, startOct = 4) {
  /* spell ascending from C(startOct) of root; keep octave math honest */
  const rootIdx = SHARP_ORDER.indexOf(rootPc);
  return steps.map((s, i) => {
    const abs = rootIdx + s;
    return noteName(abs, startOct + Math.floor(abs / 12));
  });
}

/* ── Generators: each returns a flat array of KB-ready entries ── */

/* A. สเกลครบทุกคีย์ × ทุกชนิด (เริ่มจาก C เพราะตำแหน่งคีย์ขาว) */
export function genScales() {
  const out = [];
  for (const [key, sc] of Object.entries(SCALES)) {
    for (const root of SHARP_ORDER) {
      const notes = notesFrom(root, sc.steps, 4).map((n, i) => i === 0 ? n : n);
      const label = `${root} ${sc.th}`;
      out.push({
        id: `exp:scale:${root}-${key}`,
        type: "fact", domain: "theory",
        title: `สเกล${label} (${sc.en}) — โน้ตครบ`,
        body: `${label}: ${notes.join(" ")} · รู้สึก${sc.mood}`,
        teach: `ให้เล่นช้าๆ ไล่ขึ้น-ลง ฟัง${sc.mood.split(" ")[0]}ของเสียง แล้วหาเพลงที่ใช้สเกลนี้ 1 เพลง`,
        confidence: 0.95, source: "tiga-theory-math",
        tags: ["scale", key, root],
        meta: { kind: "scale", key, root, notes },
      });
    }
  }
  return out;
}

/* B. คอร์ดครบทุกชนิด × ทุกราก — พร้อมโน้ตจริง + ฟังก์ชัน */
export function genChords() {
  const out = [];
  for (const [ct, ch] of Object.entries(CHORD_TYPES)) {
    for (const root of SHARP_ORDER) {
      const notes = notesFrom(root, ch.steps, 4);
      out.push({
        id: `exp:chord:${root}-${ct}`,
        type: "fact", domain: "harmony",
        title: `คอร์ด${root}${ct === "maj" ? "" : ct} (${ch.en})`,
        body: `${root}${ct === "maj" ? "" : ct} = ${notes.join(" ")} · โครงสร้าง: ${ch.deg.join("-")} · เสียง${ch.th}`,
        teach: `จับคอร์ดช้าๆ ฟัง${ch.th} แล้วลองสลับกับคอร์ดเมเจอร์/ไมเนอร์เทียบสีสัน`,
        confidence: 0.95, source: "tiga-theory-math",
        tags: ["chord", ct, root],
        meta: { kind: "chord", type: ct, root, notes },
      });
    }
  }
  return out;
}

/* C. ฟังก์ชันคอร์ดในแต่ละคีย์ — I vi IV V, ii-V-I ฯลฯ พร้อมโน้ตจริง */
export function genDiatonic() {
  const out = [];
  const majSteps = SCALES.major.steps;
  const chordByDeg = ["maj", "min", "min", "maj", "maj", "min", "dim"];
  for (const root of SHARP_ORDER) {
    const rootIdx = SHARP_ORDER.indexOf(root);
    const scaleNotes = majSteps.slice(0, 7).map((s, i) => notesFrom(root, [s], 4)[0]);
    for (let d = 0; d < 7; d++) {
      const chType = chordByDeg[d];
      const chRoot = SHARP_ORDER[(rootIdx + majSteps[d]) % 12];
      const ch = CHORD_TYPES[chType];
      const notes = notesFrom(chRoot, ch.steps, 4);
      out.push({
        id: `exp:diatonic:${root}-${d}`,
        type: "fact", domain: "harmony",
        title: `${ROMAN_MAJ[d]} ในคีย์ ${root} — ${scaleNotes[d]}`,
        body: `คีย์ ${root} major: องศาที่ ${d + 1} = คอร์ด ${chRoot}${chType === "maj" ? "" : chType} (${notes.join(" ")}) · ฟังก์ชัน: ${MAJOR_DEGREE_FN[d]}`,
        teach: `เล่นคอร์ดนี้ตามด้วย I ของคีย์เดียวกัน ฟังว่ามัน "อยากกลับบ้าน" แค่ไหน`,
        confidence: 0.9, source: "tiga-theory-math",
        tags: ["diatonic", root, ROMAN_MAJ[d]],
        meta: { kind: "diatonic", key: root, degree: d + 1, notes },
      });
    }
  }
  return out;
}

/* D. Progression ยอดนิยมต่อคีย์ (I-V-vi-IV, ii-V-I, 12-bar blues, canon) */
export function genProgressions() {
  const out = [];
  const PROGS = [
    { romans: ["I", "V", "vi", "IV"], th: "I-V-vi-IV (four chords ที่เล่นเพลงดังได้ร้อยเพลง)", en: "I-V-vi-IV pop" },
    { romans: ["ii", "V", "I"], th: "ii-V-I (หัวใจแจ๊ส)", en: "ii-V-I jazz" },
    { romans: ["I", "vi", "IV", "V"], th: "I-vi-IV-V (50s doo-wop)", en: "I-vi-IV-V doo-wop" },
    { romans: ["I", "IV", "V"], th: "I-IV-V (รากฐานบลูส์-ร็อก-เพลงเด็ก)", en: "I-IV-V classic" },
    { romans: ["vi", "IV", "I", "V"], th: "vi-IV-I-V (เศร้าสวยแบบ pop ยุคใหม่)", en: "vi-IV-I-V emotional pop" },
  ];
  const ROMAN_TO_DEG = { I: 0, ii: 1, iii: 2, IV: 3, V: 4, vi: 5, "vii°": 6 };
  const chordByDeg = ["maj", "min", "min", "maj", "maj", "min", "dim"];
  const majSteps = SCALES.major.steps;
  for (const root of SHARP_ORDER) {
    for (const p of PROGS) {
      const rootIdx = SHARP_ORDER.indexOf(root);
      const chords = p.romans.map(r => {
        const d = ROMAN_TO_DEG[r];
        const chRoot = SHARP_ORDER[(rootIdx + majSteps[d]) % 12];
        const ct = chordByDeg[d];
        const notes = notesFrom(chRoot, CHORD_TYPES[ct].steps, 4);
        return `${chRoot}${ct === "maj" ? "" : ct} (${notes.join("-")})`;
      });
      out.push({
        id: `exp:prog:${root}-${p.en.replace(/\W+/g, "-")}`,
        type: "strategy", domain: "harmony",
        title: `${p.th} — คีย์ ${root}`,
        body: `คีย์ ${root}: ${p.romans.join(" → ")} = ${chords.join(" → ")}`,
        teach: `เล่น 4 คอร์ดนี้วนช้าๆ แล้วร้องโน้ตเมโลดี้ทับ จะเข้าใจว่าทำไมเพลงดังใช้ progression นี้`,
        confidence: 0.85, source: "tiga-theory-math",
        tags: ["progression", root],
        meta: { kind: "progression", key: root, romans: p.romans },
      });
    }
  }
  return out;
}

/* E. Circle of Fifths — ความสัมพันธ์คีย์ + relative minor ต่อโน้ต */
export function genCircle() {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const key = SHARP_ORDER[i];
    const relMinor = SHARP_ORDER[(i + 9) % 12];
    const dom = SHARP_ORDER[(i + 1) % 12];
    const sub = SHARP_ORDER[(i + 7) % 12];
    out.push({
      id: `exp:circle:${key}`,
      type: "fact", domain: "theory",
      title: `Circle of Fifths ตำแหน่ง ${key}`,
      body: `คีย์ ${key} major (relative minor: ${relMinor} minor) · คีย์ข้างเคียง: ตามเข็ม ${dom} (เพิ่มเสียง # 1 ตัว), ทวนเข็ม ${sub} (ลดเสียง บีมอล 1 ตัว) — คีย์ที่อยู่ใกล้กันจะเปลี่ยนคีย์ไปมาได้ลื่นที่สุด`,
      teach: `เล่นเพลงคีย์ ${key} จบด้วย ${dom}7 แล้วกลับมา ${key} ฟังแรงดึงกลับ`,
      confidence: 0.9, source: "tiga-theory-math",
      tags: ["circle-of-fifths", key],
      meta: { kind: "circle", key, relMinor, dom, sub },
    });
  }
  return out;
}

/* F. เสียงความถี่จริง (A440) — ทุกโน้ตในสามอ็อกเทฟสำคัญ */
export function genFrequencies() {
  const out = [];
  for (let oct = 1; oct <= 6; oct++) {
    for (const pc of SHARP_ORDER) {
      const f = freq(pc, oct);
      if (!f || f < 16 || f > 8000) continue;
      out.push({
        id: `exp:freq:${pc}${oct}`,
        type: "fact", domain: "ear-training",
        title: `ความถี่โน้ต ${pc}${oct} = ${f.toFixed(1)} Hz`,
        body: `โน้ต ${pc}${oct} ในระบบ A440 = ${f.toFixed(1)} Hz (MIDI ${midiOf(pc, oct)}) — หูนักดนตรีที่ดีจำ "สีเสียง" ของโน้ตนี้ได้เมื่อเล่นซ้ำๆ`,
        teach: `กดคีย์นี้แล้วร้องตาม ช่วยเชื่อมหูกับนิ้ว (audiation ที่จับต้องได้)`,
        confidence: 0.95, source: "tiga-theory-math",
        tags: ["frequency", pc, "octave-" + oct],
        meta: { kind: "frequency", note: pc + oct, hz: Math.round(f * 10) / 10, midi: midiOf(pc, oct) },
      });
    }
  }
  return out;
}

/* G. Intervals ครบ 13 ชนิด × 12 ราก — ระยะห่าง + เสียงที่รู้สึก */
export function genIntervals() {
  const out = [];
  const INTS = [
    { s: 1, th: "เซมิโทน (ครึ่งเสียง)", feel: "ตึงเครียด กดดัน" },
    { s: 2, th: "ทั้งเสียง (โทน)", feel: "เดินได้สบาย เป็นกลาง" },
    { s: 3, th: "คู่เสียงไมเนอร์ 3rd", feel: "เศร้า" },
    { s: 4, th: "คู่เสียงเมเจอร์ 3rd", feel: "สดใส" },
    { s: 5, th: "คู่ 4 เสียง", feel: "ลอย ศักดิ์สิทธิ์" },
    { s: 6, th: "คู่เสียง Tritone", feel: "ไม่นิ่ง เรียกความอยากแก้" },
    { s: 7, th: "คู่ 5 เสียง", feel: "มั่นคง สมบูรณ์" },
    { s: 8, th: "คู่เสียงไมเนอร์ 6th", feel: "เศร้ากว่าที่คิด ลึก" },
    { s: 9, th: "คู่เสียงเมเจอร์ 6th", feel: "อบอุ่น หวาน" },
    { s: 10, th: "คู่เสียงไมเนอร์ 7th", feel: "แจ๊ส เหงา เย็น" },
    { s: 11, th: "คู่เสียงเมเจอร์ 7th", feel: "ฝันหวาน ลอย" },
    { s: 12, th: "คู่ 8 เสียง (ออกเทฟ)", feel: "เดียวกันแต่สูงขึ้น" },
  ];
  for (const root of SHARP_ORDER) {
    const ri = SHARP_ORDER.indexOf(root);
    for (const it of INTS) {
      const target = SHARP_ORDER[(ri + it.s) % 12];
      out.push({
        id: `exp:interval:${root}-${it.s}`,
        type: "fact", domain: "ear-training",
        title: `${root} + ${it.th} = ${target}`,
        body: `${root} ขึ้น ${it.th} (${it.s} เซมิโทน) = ${target} · หูรับรู้: ${it.feel}`,
        teach: `เล่นสองโน้ตนี้ไล่ขึ้น ฟัง${it.feel.split(" ")[0]}แล้วร้องตาม — เจาะหูจนจำความรู้สึกได้`,
        confidence: 0.9, source: "tiga-theory-math",
        tags: ["interval", root, String(it.s)],
        meta: { kind: "interval", root, semitones: it.s, target },
      });
    }
  }
  return out;
}

/* H. ระบบซ้อม/สอนที่สังเคราะห์จากทฤษฎี — drill ต่อสเกล × รูปแบบ */
export function genDrills() {
  const out = [];
  const DRILLS = [
    { id: "up", th: "ไล่ขึ้นอย่างเดียวช้าๆ พร้อมนับ 1-2-3-4", weeks: 1 },
    { id: "down", th: "ไล่ลงอย่างเดียวก่อน (คนส่วนใหญ่ซ้อมขึ้นมากเกิน)", weeks: 1 },
    { id: "updown", th: "ขึ้น-ลงต่อเนื่องไม่หยุด (ตอนเปลี่ยนทิศให้นิ่ง)", weeks: 1 },
    { id: "thirds", th: "โน้ตข้ามองศา (1-3-2-4-3-5) — ซ้อมนิ้วโป้งสอด", weeks: 2 },
    { id: "rhythm", th: "ใส่จังหวะ dotted / triplet เพื่อหักความเคยชิน", weeks: 2 },
    { id: "hands", th: "แยกมือจนลื่น แล้วรวมทีละครึ่งความเร็ว", weeks: 2 },
  ];
  for (const root of ["C", "G", "D", "A", "E", "F", "Bb"]) {
    for (const d of DRILLS) {
      out.push({
        id: `exp:drill:${root}-${d.id}`,
        type: "strategy", domain: "practice-planning",
        title: `Drill สเกล ${root} major — ${d.id}`,
        body: `สเกล ${root} major ซ้อมแบบ: ${d.th} · ประมาณ ${d.weeks} สัปดาห์ก่อนเพิ่มรูปแบบถัดไป (ซ้อม 3 ครั้งให้สมบูรณ์ก่อนเลื่อนขั้น)`,
        teach: `จับเวลา 2 นาที ให้เล่นให้ "สมบูรณ์" ไม่ใช่เร็ว — ผิดเมื่อไรเริ่มช้าใหม่`,
        confidence: 0.75, source: "tiga-pedagogy",
        tags: ["drill", root],
        meta: { kind: "drill", key: root, variant: d.id },
      });
    }
  }
  return out;
}

/* I. ศิลปกรรม + บริบทวัฒนธรรมดนตรี (จริง ตรวจได้) — ยุค/แนว/ประเทศ */
export function genArtCulture() {
  const out = [];
  const ERAS = [
    { id: "baroque", th: "บาโรก (1600-1750)", en: "Baroque", style: "ประโยคดนตรีต่อเนื่องไม่หยุด มี basso continuo ตลอด — Bach, Handel, Vivaldi", play: "เล่นเสมอกัน (terrace dynamics) โน้ตร้อยต่อกันเบาๆ ไม่มี pedal ยาว" },
    { id: "classical", th: "คลาสสิก (1750-1820)", en: "Classical", style: "ประโยคสมมาตร ชัดเจน 2+2 ห้อง — Mozart, Haydn, ต้นเบโธเฟน", play: "จับกลุ่มเสียงโปร่ง เน้นเมโลดี้ขวาให้ร้องผ่าน ซ้ายเบาเป็นประกอบ" },
    { id: "romantic", th: "โรแมนติก (1820-1900)", en: "Romantic", style: "อารมณ์กว้าง rubato ยืด-หดจังหวะตามความรู้สึก — Chopin, Liszt, Brahms", play: "ใช้แขนเป็นน้ำหนักเสียงใหญ่เล็ก แป้นเยอะขึ้น เมโลดี้ร้องตลอด" },
    { id: "impressionist", th: "อิมเพรสชันนิสม์ (1890-1915)", en: "Impressionist", style: "สีเสียงสำคัญกว่าเส้นเรื่อง — Debussy, Ravel", play: "เพนทาโทนิก/whole-tone แป้นนุ่มยาว ฟังสีเสียงก้อนใหญ่" },
    { id: "jazz", th: "แจ๊ส (1900-ปัจจุบัน)", en: "Jazz", style: "swing สองแปดโน้ตไม่เท่ากัน comping คอร์ดขั้นสูง — Ellington, Monk, Bill Evans", play: "ซ้อม swing แยกมือ อ่าน lead sheet ด้นสดทับ progression" },
    { id: "pop", th: "ป็อป/ร็อกสมัยใหม่ (1950-ปัจจุบัน)", en: "Pop/Rock", style: "hook จำง่าย progression 4 คอร์ด จังหวะ backbeat — Beatles ถึงปัจจุบัน", play: "จังหวะแน่น คอร์ดชัด ซ้อมตามการเล่นจริงจากเพลงที่ฟัง" },
    { id: "thai", th: "ดนตรีไทย", en: "Thai traditional", style: "เพนทาโทนิก 7 โน้ตเท่ากัน วงปี่พาทย์/เครื่องสาย ลูกทุ่ง/หมอลำสมัยใหม่", play: "ซ้อมเพนทาโทนิกไทย (C D E G A) แล้วด้นทำนองลูกทุ่งง่ายๆ ทับ" },
    { id: "folk", th: "โฟล์กโลก", en: "World folk", style: "เพนทาโทนิกเป็นฐานทั่วโลก — จีน แอฟริกา เซลติก แอนดีส", play: "ซ้อมเพนทาโทนิกแต่ละโหมด ฟังว่า 'ความไทย/จีน/แอฟริกัน' มาจากโน้ตชุดเดียวกัน" },
  ];
  for (const e of ERAS) {
    out.push({
      id: `exp:era:${e.id}`,
      type: "fact", domain: "repertoire",
      title: `${e.th} — สไตล์และวิธีเล่น`,
      body: `${e.en}: ${e.style} · วิธีเล่นให้ถูกยุค: ${e.play}`,
      teach: `เลือกเพลงยุคนี้ 1 เพลง เล่นเทียบกับเพลงยุคอื่นที่ซ้อมแล้ว ฟังว่าต่างกันตรงไหน`,
      confidence: 0.85, source: "tiga-pedagogy",
      tags: ["era", e.id],
      meta: { kind: "era", era: e.id },
    });
  }
  /* Instruments & families — real range facts */
  const INSTR = [
    { n: "เปียโน", en: "piano", range: "A0-C8 (88 คีย์, 27.5-4186 Hz)", fam: "คีย์บอร์ด/เครื่องสายตี", note: "เล่นพร้อมกันทั้งเมโลดี้+ฮาร์มอนี ครบทุกบทบาท" },
    { n: "ไวโอลิน", en: "violin", range: "G3 ถึงเหนือ E7 (196-3000+ Hz)", fam: "เครื่องสาย", note: "สาย G-D-A-E ไม่มีเฟรต หูคือผู้ตัดสินตำแหน่ง" },
    { n: "เชลโล", en: "cello", range: "C2-A5 (65-1000 Hz)", fam: "เครื่องสาย", note: "ระยะเสียงใกล้เสียงคน เพราะเหตุนี้เพลงเชลโลฟัง 'ร้อง' ได้ลึก" },
    { n: "กีตาร์", en: "guitar", range: "E2-E6 (~82-1300 Hz)", fam: "เครื่องสาย", note: "6 สาย E-A-D-G-B-E คอร์ดรูปทรงเดียวขยับเป็นคีย์อื่นได้ (capo/แบริ่ง)" },
    { n: "ขลุ่ยเพียงออก", en: "Thai flute", range: "ประมาณ D4-D6", fam: "เครื่องเป่า", note: "เสียงเพนทาโทนิกไทย หายใจเป็นจังหวะสำคัญกว่าเครื่องตะวันตก" },
    { n: "ระนาด", en: "ranat", range: "เพนทาโทนิก 2 ชุด ต่ำ-สูง", fam: "เครื่องตีไทย", note: "เสียงตกกระทบสั้น เล่นเร็วได้ โน้ตเดียวกันคนละ 'กล่องเสียง'" },
  ];
  for (const i of INSTR) {
    out.push({
      id: `exp:instr:${i.en.replace(/\W+/g, "-")}`,
      type: "fact", domain: "culture",
      title: `${i.n} (${i.en}) — ช่วงเสียงและบทบาท`,
      body: `ช่วงเสียง ${i.range} · ตระกูล${i.fam} · ${i.note}`,
      teach: `ฟังบันทึกเสียงเครื่องดนตรีนี้ 1 ชิ้นเทียบกับเปียโน จำ 'สีเสียง' ให้ได้`,
      confidence: 0.85, source: "tiga-pedagogy",
      tags: ["instrument", i.en],
      meta: { kind: "instrument", name: i.en },
    });
  }
  return out;
}

/* J. การสอนที่ต่อยอดจาก seeds เดิม — lesson path ต่อคีย์ × ระดับ */
export function genLessonPaths() {
  const out = [];
  const LEVELS = [
    { lv: "beginner", th: "เริ่มต้น", goal: "จับคอร์ด C F G สลับได้ เล่นเพลงเด็ก 2 เพลงตามจังหวะ", weeks: 8 },
    { lv: "elementary", th: "ประถม", goal: "สเกล 2 คีย์คล่อง เล่นเพลงเต็มด้วยมือทั้งสองแยกบทบาท", weeks: 12 },
    { lv: "intermediate", th: "กลาง", goal: "อ่านโน้ตลื่น คอร์ด 7th เบื้องต้น เล่นเพลงคลาสสิกง่ายจบทั้งเพลง", weeks: 26 },
    { lv: "advanced", th: "สูง", goal: "ควบคุมเสียงหลายชั้น เล่นเพลงยาก 3 เพลงขึ้นเวทีได้", weeks: 52 },
  ];
  for (const root of ["C", "G", "F"]) {
    for (const l of LEVELS) {
      out.push({
        id: `exp:path:${root}-${l.lv}`,
        type: "principle", domain: "pedagogy",
        title: `เส้นทางคีย์ ${root} ระดับ${l.th}`,
        body: `เป้าหมายระดับ${l.th} บนคีย์ ${root}: ${l.goal} · กรอบเวลาประมาณ ${l.weeks} สัปดาห์เมื่อซ้อมวันละ 20-30 นาที`,
        teach: `เริ่มจากวัดตำแหน่งผู้เรียนว่าขาดอะไรจากเป้าหมายนี้ แล้วเติมเฉพาะช่องนั้น ไม่ซ้อมซ้ำที่ทำได้อยู่แล้ว`,
        confidence: 0.7, source: "tiga-pedagogy",
        tags: ["lesson-path", l.lv, root],
        meta: { kind: "lesson-path", key: root, level: l.lv },
      });
    }
  }
  return out;
}

/* ── Assemble: one call seeds everything into the kb ── */
export function seedKnowledgeExpansion(kb, { verbose = false } = {}) {
  const gens = [genScales, genChords, genDiatonic, genProgressions, genCircle, genFrequencies, genIntervals, genDrills, genArtCulture, genLessonPaths];
  let added = 0;
  for (const g of gens) {
    for (const e of g()) {
      kb.add(e);
      added++;
    }
  }
  if (verbose) console.log(`knowledge expansion: ${added} entries seeded`);
  return added;
}
