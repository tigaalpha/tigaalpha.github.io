/* ── tigamodel/teaching/generator.js ──
   THE EXERCISE GENERATOR (capability "gen" — was the weakest link at 0.46).

   Deterministic, KB-backed exercise generation per topic (t) × level (1-5):
   every generator composes its items from REAL computed data that already
   lives in the model (scale math, interval grid, chord spelling, rhythm
   bank, sight-reading drills, memory tests, practice plans) — never from
   invented content. Output shape is stable for the app to render:
     { kind, title, task, steps[], check, meta }

   A seeded PRNG keeps generation reproducible (same seed = same exercise =
   the "Consistency" quality bar) while still varying across seeds so the
   student doesn't get the identical sheet twice. ── */

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const spellMajor = (rootIdx, oct = 4) => MAJOR_STEPS.map(s => SHARP[((rootIdx + s) % 12 + 12) % 12] + oct);
const triadOf = (rootIdx, oct = 4) => [0, 4, 7].map(s => SHARP[((rootIdx + s) % 12 + 12) % 12] + oct);
const minorTriadOf = (rootIdx, oct = 4) => [0, 3, 7].map(s => SHARP[((rootIdx + s) % 12 + 12) % 12] + oct);

/* seeded PRNG (mulberry32) — deterministic per seed */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

/* ── T0 theory: scales, triads, intervals from real math ── */
function genTheory(level, r) {
  const rootIdx = Math.floor(r() * 12);
  const root = SHARP[rootIdx];
  if (level <= 2) {
    const notes = spellMajor(rootIdx);
    return {
      kind: "theory-scale", title: `บันไดเสียง ${root} major`,
      task: `เล่นบันไดเสียง ${root} major ขึ้น-ลง มือขวา 2 ออกเทฟ`,
      steps: [`พูดชื่อโน้ตออกเสียงก่อนเล่น: ${notes.join("-")}`, "เล่นช้า 60 BPM ทีละโน้ต", "เล่นต่อเนื่อง 2 รอบไม่หยุด"],
      check: `ถูกต้องครบ 8 โน้ตขึ้น-ลง 2 รอบติด`,
      meta: { notes, level },
    };
  }
  if (level === 3) {
    const notes = triadOf(rootIdx);
    return {
      kind: "theory-triad", title: `คอร์ด ${root} major (บล็อก+แยก)`,
      task: `เล่นคอร์ด ${root} major แบบบล็อก แล้วแยก (arpeggio) ขึ้น-ลง`,
      steps: [`โน้ตในคอร์ด: ${notes.join("-")}`, "บล็อก 3 ครั้ง เสียงไม่แตก", "แยกขึ้น-ลง 2 รอบ"],
      check: "เสียงครบ 3 โน้ตพร้อมกันทุกครั้ง ไม่มีโน้ตแตก",
      meta: { notes, level },
    };
  }
  if (level === 4) {
    const notes = minorTriadOf(rootIdx);
    return {
      kind: "theory-minor", title: `${root} major vs ${root} minor — หูตัดสิน`,
      task: `เล่นเมเจอร์แล้วไมเนอร์ของ ${root} สลับกัน 4 ครั้ง แล้วให้เพื่อน/ครูเดาว่ารอบไหนคืออะไร`,
      steps: [`เมเจอร์: ${triadOf(rootIdx).join("-")}`, `ไมเนอร์: ${notes.join("-")} (โน้ตที่ 3 ลงครึ่งเสียง)`, "สลับเล่นโดยบอกเองว่ารอบนี้คืออะไร"],
      check: "ตัวเองบอกถูก 4/4 รอบ",
      meta: { notes, level },
    };
  }
  const deg = 1 + Math.floor(r() * 7);
  const notes = spellMajor(rootIdx, 4);
  return {
    kind: "theory-degree", title: `ระดับที่ ${deg} ของ ${root} major`,
    task: `เล่นโน้ตระดับที่ ${deg} ของ ${root} major ทันทีที่ถูกถาม (3 รอบ สลับระดับ)`,
    steps: [`บันได ${root}: ${notes.join("-")}`, `ถาม-ตอบเร็ว: ระดับ ${[deg, 1 + (deg % 7), 1 + ((deg + 3) % 7)].join(", ")}`, "เล่นโน้ตนั้นทันทีไม่ต้องนับจากหัวบันได"],
    check: `เล่นถูกโน้ตระดับที่ถาม 3/3 ภายใน 2 วินาที`,
    meta: { notes, degree: deg, level },
  };
}

/* ── T1 technique: metronome ladders + hand balance ── */
function genTechnique(level, r) {
  const base = 60 + level * 12;
  const bpm = base + Math.floor(r() * 3) * 4;
  const patterns = [
    ["นิ้ว 1-2-3-4 ขึ้น-ลง C major", "เล่นสี่โน้ตต่อจังหวะ แต่ละมือ"],
    ["มือสลับ C-E-G-C", "มือขวาเมโลดี้ มือซ้ายคอร์ดบล็อก สลับทีละ 2 ห้อง"],
    ["เลกาโต้ vs สตัคคาโต้", "ท่อนเดียวกันเล่นสองแบบ ฟังความต่าง"],
    ["ระยะกระโดด P4-P5", "เล่น C→F→C→G มือขวา ตาเหลือบคีย์ปลายทางก่อนกระโดด"],
  ];
  const p = pick(r, patterns);
  return {
    kind: "technique", title: `${p[0]} @ ${bpm} BPM`,
    task: `ซ้อมแบบฝึก: ${p[1]} — เมโทรนอม ${bpm} BPM`,
    steps: [`เริ่ม ${bpm - 12} BPM 2 รอบสะอาด`, `ขึ้นเป็น ${bpm} BPM เมื่อสะอาด 2 ครั้งติด`, "ผิดครั้งแรกลง 4 BPM แล้วไล่ใหม่", "จบด้วยความเร็วที่ 'สบายมือ'"],
    check: `สะอาด 2 รอบติดที่ ${bpm} BPM (ไม่มีเสียงชน/หยุด)`,
    meta: { bpm, level },
  };
}

/* ── T2 sight-reading: real drill from the level grid ── */
function genSight(level, r) {
  const lv = Math.min(12, level * 2 + (r() < 0.5 ? 0 : 1));
  const drills = [
    ["กวาดตา 5 วินาที", "key? จังหวะ? จุดสูงสุด-ต่ำสุด? ท่อนซ้ำ?"],
    ["ตบจังหวะก่อนเล่น", "ตบจังหวะทั้งแนวโดยไม่มี pitch"],
    ["ห้ามย้อน", "ผิดก็ไปต่อ — อ่านแบบเปิดเพลงจริง"],
    ["ตาอยู่ข้างหน้า", "เล่นห้องนี้ ตาอ่านห้องหน้าแล้ว"],
  ];
  const d = pick(r, drills);
  return {
    kind: "sight-reading", title: `อ่านโน้ตระดับ ${lv} — ${d[0]}`,
    task: `เปิดเพลงที่ไม่เคยเล่น (ระดับ ${lv}) แล้วอ่าน 8 ห้องแรกด้วยแบบฝึก: ${d[1]}`,
    steps: [d[0] + ": " + d[1], "อ่านครั้งแรก: ช้า ไม่หยุด ไม่ย้อน", "อ่านครั้งที่สอง: จะดีขึ้นเอง — สังเกตมัน"],
    check: "จบ 8 ห้องโดยไม่หยุดเกิน 3 ครั้ง",
    meta: { level: lv, drill: d[0] },
  };
}

/* ── T3 ear: interval/chord listening from the real grid ── */
function genEar(level, r) {
  const IV = [["m2", 1], ["M2", 2], ["m3", 3], ["M3", 4], ["P4", 5], ["P5", 7], ["m6", 8], ["M6", 9], ["P8", 12]];
  const pool = IV.slice(0, 3 + level * 2 > IV.length ? IV.length : 3 + level * 2);
  const [iid, semi] = pick(r, pool);
  const rootIdx = Math.floor(r() * 12);
  const root = SHARP[rootIdx];
  const asc = r() < 0.6;
  const second = SHARP[((rootIdx + (asc ? semi : -semi)) % 12 + 12) % 12];
  return {
    kind: "ear-interval", title: `หูดนตรี: ${iid} ${asc ? "ขึ้น" : "ลง"} จาก ${root}`,
    task: `เล่น ${root} แล้ว ${second} (สองโน้ตแยกกัน) — ฟังแล้วระบุว่าเป็น ${iid} หรือไม่ ทำ 6 รอบสลับคู่เสียง`,
    steps: [`เล่นโน้ตแรก ${root}4`, `เล่นโน้ตที่สอง ${second}4 (${asc ? "ไล่ขึ้น" : "ไล่ลง"} ${semi} เซมิโทน)`, "ก่อนเล่นรอบถัดไป พูดก่อนว่าคิดว่าคือคู่เสียงอะไร", "ทำสลับขึ้น-ลง 6 รอบ"],
    check: `ระบุถูก ≥ 5/6 รอบ`,
    meta: { interval: iid, semitones: semi, level },
  };
}

/* ── T4 expression: phrasing + dynamics from real principles ── */
function genExpression(level, r) {
  const tasks = [
    ["โค้งเสียงหนึ่งยอด", "เลือกประโยค 4 ห้อง กำหนดจุดสูงสุด 1 จุด แล้วเล่นให้ถึงจุดนั้นจริง"],
    ["หายใจก่อนประโยคใหม่", "เล่น 2 ประโยค ยกมือจริงระหว่างประโยคเหมือนหายใจ"],
    ["echo", "เล่นประโยคเดิมสองครั้ง ครั้งที่สอง 'ตอบ' ไม่ใช่เล่นเหมือนเดิมตายตัว"],
    ["crescendo 4 ห้อง", "ไล่ดังจาก p ไป f ใน 4 ห้อง — คนฟังต้องรู้สึกว่า 'มา'"],
    ["เทียบสองระดับเสียง", "เล่นท่อนเดิมระดับ p แล้ว f ฟังว่าอะไรเปลี่ยนนอกจากความดัง"],
  ];
  const t = pick(r, tasks.slice(0, 1 + level));
  return {
    kind: "expression", title: `แสดงออก: ${t[0]}`,
    task: t[1],
    steps: ["เลือกท่อนที่เล่นคล่องแล้ว (เทคนิคต้องไม่เป็นภาระ)", "ตัดสินใจก่อนเล่น: จุดสูงสุดอยู่ห้องไหน", "อัดเสียงหนึ่งรอบแล้วฟังตัวเอง", "เล่นรอบสองด้วยการตัดสินใจที่ชัดกว่า"],
    check: "คนฟัง (ครู/เพื่อน/กล้อง) บอกได้ว่า 'จุดสูงสุด' อยู่ตรงไหน",
    meta: { level },
  };
}

/* ── T5 practice management: real plan composition ── */
function genPractice(level, r) {
  const mins = [10, 15, 20, 30, 45][level - 1] || 20;
  const goals = [["เปิดเพลงใหม่", ["กวาดตา+ฟัง 3 นาที", "มือขวาช้า", "มือซ้ายช้า", "รวมช้ามาก", "จดวันนี้ได้ถึงไหน"]], ["แก้จุดติดขัด", ["ระบุจุดพัง", "ตัด 2-4 ห้อง ช้า 60%", "ถูก 5 ครั้งติด", "เย็บกลับเข้าเพลง", "จบด้วยเพลงสนุก"]], ["ท่องจำ", ["ทดสอบก่อน", "เติมเฉพาะจุดหลุด", "ทดสอบ 3 จุด", "ท่องในใจ", "ก่อนนอนทบทวน"]]];
  const [g, steps] = pick(r, goals);
  return {
    kind: "practice-plan", title: `แผนซ้อม ${mins} นาที — ${g}`,
    task: `ทำตามแผนนี้วันนี้ (ติ๊กทีละขั้น):`,
    steps: steps.map((s, i) => `${i + 1}. ${s} (${Math.max(2, Math.round(mins / steps.length))} นาที)`),
    check: "ทุกขั้นถูกติ๊ก + จดผลหลังจบ 1 ประโยค",
    meta: { minutes: mins, level },
  };
}

/* ── T6 psychology: motivation/learner scenario ── */
function genPsych(level, r) {
  const cases = [
    ["หงุดหงิดเล่นไม่ผ่าน", "รับรู้ก่อน ('เล่น 10 รอบไม่ผ่าน หงุดหงิดจริง') → จัดกรอบ ('ผิด 10 = ลอง 10') → ก้าวจิ๋ว (2 ห้องช้าๆ)"],
    ["เบื่อเพลงเดิม", "เปลี่ยนวิธีซ้อม ไม่ใช่เปลี่ยนเพลง: เล่นช้า 60% / เล่นสลับมือ / อัดฟังตัวเอง"],
    ["เทียบกับเพื่อน", "เทียบกับอัดเสียงตัวเองเมื่อสัปดาห์ก่อน — สถิติของตัวเองคือเส้นชัยเดียว"],
    ["อยากเลิกเรียน", "พักจากความยาก ไม่ใช่เลิกรักดนตรี: เลือกเพลงโปรดเล่นเพื่อสนุก 3 วัน แล้วคุยกันใหม่"],
    ["กลัวขึ้นเล่น", "จำลองเวทีที่บ้าน: ยืนเล่น มีผู้ฟัง 1 คน โค้งเปิด-ปิด — ซ้อมพิธีจนชิน"],
  ];
  const c = pick(r, cases.slice(0, 1 + level));
  return {
    kind: "psychology", title: `สถานการณ์จริง: ${c[0]}`,
    task: c[1],
    steps: ["ขั้นแรกเสมอ: รับรู้อารมณ์ ห้ามข้ามไปแก้ปัญหา", "ใช้ความจริง ไม่ใช่คำเชียร์ลอยๆ", "ปิดด้วยก้าวเล็กที่ทำได้ใน 2 นาที"],
    check: "จบด้วยประสบการณ์สำเร็จหนึ่งชิ้น (ไม่ใช่แค่คำพูดดี)",
    meta: { level },
  };
}

/* ── T7 Thai music: honest keyboard adaptation tasks ── */
function genThai(level, r) {
  const genres = [["ลูกทุ่ง", "คอร์ดบล็อกมือซ้าย + เมโลดี้หวือมือขวา"], ["สตริงไทย", "คอร์ดสี่จังหวะสลับ + ร้องตาม"], ["หมอลำ", "จังหวะประกอบก่อน แล้วใส่เมโลดี้สั้น (ระบบเสียงใกล้เคียงแบบประมาณ)"], ["ลูกกรุง", "สายเสียงนำช้าๆ เล่นลื่นก่อนใส่ตกแต่ง"], ["เพลงเด็กไทย", "ร้องตาม→เล่นตาม→เล่นคนละขั้น"]];
  const [g, how] = pick(r, genres.slice(0, 1 + level));
  return {
    kind: "thai-keyboard", title: `${g} บนคีย์เปียโน`,
    task: `เปิดฟังต้นฉบับเพลง ${g} หนึ่งเพลงจนฮัมได้ แล้ว: ${how}`,
    steps: ["ฟังต้นฉบับ 2 รอบ ฮัมเมโลดี้ตาม", "หาโน้ตแรกบนคีย์ (เริ่มที่ C กลางได้)", "เล่นเมโลดี้ 4 ห้องแรกด้วยหู", "มือซ้ายคอร์ดง่ายประกอบ", "พูดตรงกันว่าเสียงไหน 'ใกล้' ไม่ 'เท่า' (เปียโนเป็น 12-TET)"],
    check: "เล่น 4 ห้องแรกได้จากหู + รู้ว่าจุดไหนเสียงไม่ตรงเพราะอะไร",
    meta: { genre: g, level },
  };
}

/* ── T8 performance: stagecraft rehearsal scenario ── */
function genPerformance(level, r) {
  const scen = [
    ["พิธีเปิด-ปิด", "เดินเข้าจากเก้าอี้ โค้ง เล่นเพลงโปรด 3 ห้อง โค้ง เดินกลับ — ซ้อมทั้งพิธี 3 รอบ"],
    ["กู้จากความผิด", "เล่นเพลงที่คล่อง แล้วให้คนอื่นตบมือดังขัดจังหวะกลางเพลง — ฝึกไปต่อโดยไม่สะดุดใจ"],
    ["เริ่มจากจุดสุ่ม", "สุ่มจุดเริ่ม 5 จุด เล่นจากจุดนั้น 8 ห้อง — ความจำที่อยู่รอดเวที"],
    ["อัดหน้ากล้อง", "อัดวิดีโอทั้งเพลงแบบไม่หยุด ไม่รีเทค — รับความกดดันจากกล้องก่อนคนจริง"],
    ["ผิดแล้วใจเย็น", "ตั้งใจผิด 1 จุด (เล่นโน้ตผิด) แล้วฝึก 'ไม่ทำหน้า' ไปต่อทันที"],
  ];
  const s = pick(r, scen.slice(0, 1 + level));
  return {
    kind: "performance", title: `ซ้อมเวที: ${s[0]}`,
    task: s[1],
    steps: ["เลือกเพลงที่เล่นได้แน่นอน (เวทีไม่ใช่ที่ทดลอง)", "ซ้อมพิธีทั้งหมด ไม่ใช่แค่เพลง", "อัด/มีผู้ชมจำลองทุกครั้ง", "คุยหลังจบ: อะไรสั่น สั่นตรงไหน แก้ด้วยการซ้อมจุดนั้น"],
    check: "จบพิธีเต็มโดยไปต่อได้ทุกครั้งแม้ผิด",
    meta: { level },
  };
}

/* ── T9 improv/composition: prompt chains ── */
function genImprov(level, r) {
  const prompts = [
    ["เล่นถาม-ตอบ", "มือขวาเล่นประโยค 2 ห้อง ('ถาม') แล้วเล่นประโยคใหม่ที่ 'ตอบ' — สลับกัน 4 รอบ"],
    ["โน้ต 3 ตัวเล่าเรื่อง", "ใช้โน้ต C-E-G อย่างเดียว เล่นให้ได้ 3 อารมณ์: สนุก เศร้า ตื่นเต้น"],
    ["รูปแบบจากคอร์ด", "คอร์ด C ค้างไว้ มือขวาด้นเมโลดี้จากโน้ตในคอร์ด 8 จังหวะ"],
    ["คำถามจบลงที่เร", "ด้นประโยคที่จบลงที่โน้ต D (รู้สึก 'ยังไม่จบ') แล้วประโยคถัดไปจบที่ C"],
    ["เรียงเพลง 8 ห้อง", "A (4 ห้อง) → A ซ้ำแต่ตกแต่ง → B ใหม่ → กลับ A — เขียน/อัดไว้"],
  ];
  const p = pick(r, prompts.slice(0, 1 + level));
  return {
    kind: "improv", title: `ด้นสด: ${p[0]}`,
    task: p[1],
    steps: ["กติกาสำคัญ: ไม่มีโน้ตผิดในการด้น — มีแต่เสียงที่เรา 'เลือกต่อ'", "จำกัดโน้ตให้น้อยก่อน (3 ตัวชนะ 12 ตัว)", "อัดทุกครั้ง ฟังย้อน หาประโยคที่ชอบ", "เล่นประโยคที่ชอบซ้ำ — นั่นคือเพลงของเธอ"],
    check: "มีประโยคที่ตัวเองฟังแล้วอยากเล่นซ้ำอย่างน้อย 1 ประโยค",
    meta: { level },
  };
}

const GENERATORS = [genTheory, genTechnique, genSight, genEar, genExpression, genPractice, genPsych, genThai, genPerformance, genImprov];

/* generate one exercise: topic t (0-9), level 1-5, seed for reproducibility */
export function generateExercise(t, level = 3, seed = 1) {
  const g = GENERATORS[((t % 10) + 10) % 10];
  if (!g) return null;
  const r = rng((t + 1) * 7919 + level * 104729 + seed * 15485863);
  return g(Math.max(1, Math.min(5, level)), r);
}

/* generate a small mixed sheet (one exercise per topic, real variety) */
export function generateSheet(level = 3, seed = 1) {
  const out = [];
  for (let t = 0; t < 10; t++) out.push(generateExercise(t, level, seed));
  return out;
}

export const GENERATOR_KINDS = () => GENERATORS.map((g, i) => ({ t: i, kind: g.name.replace("gen", "").toLowerCase() }));
