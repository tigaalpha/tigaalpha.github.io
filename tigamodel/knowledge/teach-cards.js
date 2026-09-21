/* ── tigamodel/knowledge/teach-cards.js ──
   Auto Teaching 2.0 (plan: tigamodel/docs/02-auto-teaching-plan.md, owner-approved
   2026-09-20, TTS excluded): the "รู้ไว้ใช่ว่า" micro-lesson layer of the
   auto-teach popup. Pure data + pure helpers — no React, no network, no SQL.

   Rules encoded here (from the plan):
   * knowledge must EXPLAIN THE STUDENT'S CURRENT WEAKNESS, never float freely
     (TIGA philosophy: no praise/teaching without evidence);
   * one card per popup, not repeated for 7 days, rotated per calendar day
     so everyone in a day sees a coherent "ความรู้วันนี้";
   * every card cites a REAL source id from ./university-sources.js
     (smoke test fails on a fake citation — spec §12);
   * concept/why/quiz exist in all three languages (th/en/zh);
   * `tier` gates by learner level, mirroring use-autoteach.learnerTone:
     0 = beginner-safe, 1 = intermediate+, 2 = advanced.
   Storage helpers use localStorage in the browser and fall back to an
   in-memory map in Node so scripts/smoke.mjs can exercise the logic. ── */

import { SOURCES } from "./university-sources.js";

/* storage that works in both the browser bundle and the node smoke test.
   The in-memory fallback must be a MODULE-LEVEL singleton — a per-call Map
   would make setItem immediately invisible to the next getItem (caught by
   scripts/smoke.mjs, which is exactly what it is for). */
const _memStore = new Map();
function store() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch (e) { /* node */ }
  return {
    getItem: (k) => (_memStore.has(k) ? _memStore.get(k) : null),
    setItem: (k, v) => { _memStore.set(k, String(v)); },
    removeItem: (k) => { _memStore.delete(k); },
  };
}

function dayKeyLocal(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* ── the cards ──
   diagram: { type, ...payload } — a STATIC teaching diagram (explains the
   concept, like a textbook figure; NOT the student's own numbers — those are
   data charts chosen in App.tsx via TeachVisual's data-chart types). null =
   this card is better served by the learner's own data chart, or none.
   quiz.choices exactly 3, quiz.correct = index of the right one. ── */
export const TEACH_CARDS = [
  {
    id: "tc-rhythm-strong",
    tags: ["จังหวะ", "rhythm", "beat", "timing"],
    tier: 0,
    source: "rhythm-wiki",
    diagram: { type: "rhythm-grid", beats: [1, 0.4, 0.6, 0.4] },
    concept: { th: "จังหวะแรกของห้องคือจังหวะ “หนัก”", en: "The first beat of the bar is the strong one", zh: "每小节的第一拍是重拍" },
    why: { th: "โน้ตทุกตัวดังเท่ากันทำให้จังหวะพัง — นับ 1-2-3-4 แล้วกดหนักที่ 1 มือจะจำจังหวะเอง", en: "If every note is equally loud the pulse breaks — count 1-2-3-4 and lean on beat 1; your hand starts keeping time by itself.", zh: "每个音一样响会让节奏散掉——数1-2-3-4，第1拍加重，手会自己稳住节奏。" },
    quiz: {
      q: { th: "ในหนึ่งห้อง 4 จังหวะ จังหวะไหน “หนัก” ที่สุด?", en: "In a 4-beat bar, which beat is strongest?", zh: "4拍小节里哪一拍最强?" },
      choices: [
        { th: "จังหวะที่ 1", en: "Beat 1", zh: "第1拍" },
        { th: "จังหวะที่ 3", en: "Beat 3", zh: "第3拍" },
        { th: "ทุกจังหวะหนักเท่ากัน", en: "They are all equal", zh: "每拍一样强" },
      ],
      correct: 0,
    },
  },
  {
    id: "tc-slow-first",
    tags: ["ช้า", "tempo", "เร็ว", "สะดุด", "ติด", "practice", "ฝึก"],
    tier: 0,
    source: "practice-wiki",
    diagram: null,
    concept: { th: "ซ้อมช้าก่อน = เร็วได้จริงภายหลัง", en: "Practice slow now to play fast later", zh: "先慢练，之后才能真正快起来" },
    why: { th: "สมองจด “ลำดับนิ้ว” ได้เมื่อไม่เร่ง — ซ้อมช้าจนลื่นแล้วค่อยเร่ง จะสะดุดน้อยลงวัดได้จากความแม่นยำ", en: "The brain only memorises the finger sequence when you stop rushing — slow until it's smooth, then speed up; the accuracy number proves it.", zh: "不赶的时候大脑才能记住指法顺序——先练顺再加速，准确率会证明这一点。" },
    quiz: {
      q: { th: "เจอท่อนที่ติด ๆ ขั้นแรกคืออะไร?", en: "First move on a passage that keeps breaking down?", zh: "段落总卡壳的第一步是什么?" },
      choices: [
        { th: "เร่งซ้อมซ้ำเร็ว ๆ จนผ่าน", en: "Repeat it fast until it sticks", zh: "快速反复硬冲" },
        { th: "ลดเทมโป ช้าลงแล้วค่อยเร่ง", en: "Slow the tempo down, speed up later", zh: "放慢速度，之后再加速" },
        { th: "ข้ามไปท่อนอื่นก่อน", en: "Skip to another section", zh: "先跳到别的段落" },
      ],
      correct: 1,
    },
  },
  {
    id: "tc-finger-numbers",
    tags: ["นิ้ว", "fingering", "finger", "มือ", "position"],
    tier: 0,
    source: "piano-pedagogy-wiki",
    diagram: { type: "kb-scale", notes: ["C", "D", "E", "F", "G"] },
    concept: { th: "นิ้วมีเลขประจำ: 1 = โป้ง … 5 = ก้อย", en: "Fingers are numbered: 1 = thumb … 5 = pinky", zh: "手指有编号：1=拇指 … 5=小指" },
    why: { th: "เลขนิ้วคือ GPS ของมือ — วางนิ้วตามเลขตั้งแต่ต้นท่อน แล้วท่อนที่เคยพลาดจะง่ายขึ้นเพราะมือไม่พันกัน", en: "Fingering is the hand's GPS — set the fingers by number at the start of the passage and the part you keep missing gets easier because the hand stops tangling.", zh: "指法就是手的GPS——开头就按编号放好手指，常错的段落会因为手不乱而变容易。" },
    quiz: {
      q: { th: "นิ้วโป้งมือขวาเรียกเลขอะไร?", en: "What is the number of the right-hand thumb?", zh: "右手的拇指是第几指?" },
      choices: [
        { th: "เลข 1", en: "1", zh: "第1指" },
        { th: "เลข 3", en: "3", zh: "第3指" },
        { th: "เลข 5", en: "5", zh: "第5指" },
      ],
      correct: 0,
    },
  },
  {
    id: "tc-landmarks",
    tags: ["อ่านโน้ต", "โน้ต", "sight", "reading", "note"],
    tier: 0,
    source: "sight-reading-wiki",
    diagram: { type: "kb-scale", notes: ["C", "F", "G"] },
    concept: { th: "โน้ตค้ำหมู่: จำ C · F · G แล้วอ่านตัวอื่นเทียบจากเพื่อนบ้าน", en: "Landmark notes: memorise C · F · G and read the rest relative to them", zh: "地标音：记住C·F·G，其他音相对着读" },
    why: { th: "อ่านโน้ตทีละตัวคือช้าที่สุด — จำจุดค้ำไม่กี่จุดแล้วมอง “ขึ้น/ลง/ข้าง” จากจุดค้ำ จะอ่านหน้าโน้ตเร็วขึ้นจริง", en: "Reading note-by-note is the slowest way — anchor a few landmarks and judge up/down/step from them; sight-reading genuinely speeds up.", zh: "一个音一个音读是最慢的——记住几个地标，看相对位置，识谱真的会变快。" },
    quiz: {
      q: { th: "ประโยชน์ของ “โน้ตค้ำหมู่” คืออะไร?", en: "What are landmark notes for?", zh: "地标音的作用是什么?" },
      choices: [
        { th: "ใช้เทียบตำแหน่งโน้ตอื่นได้เร็วขึ้น", en: "Read other notes faster relative to them", zh: "更快地读出其他音" },
        { th: "ทำให้เสียงดังขึ้น", en: "They make the sound louder", zh: "让声音更响" },
        { th: "ไม่ต้องอ่านโน้ตอื่นอีกเลย", en: "You never read other notes", zh: "从此不用读其他音" },
      ],
      correct: 0,
    },
  },
  {
    id: "tc-half-steps",
    tags: ["ครึ่งเสียง", "เสียง", "semitone", "half", "คีย์ดำ", "black"],
    tier: 0,
    source: "interval-wiki",
    diagram: { type: "half-steps", notes: ["E", "F"] },
    concept: { th: "ครึ่งเสียงคือระยะสั้นสุด — คู่ E–F และ B–C “ไม่มีคีย์ดำคั่น”", en: "A semitone is the smallest step — E–F and B–C have no black key between them", zh: "半音是最小距离——E–F和B–C之间没有黑键" },
    why: { th: "หลายท่อนพลาดเพราะกด “ข้างกัน” ผิด — จำสองคู่ไร้ดำคั่นนี้แล้วหาโน้ตและแก้ที่พลาดเร็วขึ้น", en: "Many misses are just pressing the wrong neighbour — remember these two no-black-key pairs and you find and fix wrong notes faster.", zh: "很多错音只是按错隔壁键——记住这两对没有黑键的组合，找音和改错都会更快。" },
    quiz: {
      q: { th: "คู่ไหน “ไม่มีคีย์ดำคั่นกลาง”?", en: "Which pair has no black key between them?", zh: "哪一对之间没有黑键?" },
      choices: [
        { th: "C–D", en: "C–D", zh: "C–D" },
        { th: "E–F", en: "E–F", zh: "E–F" },
        { th: "F–G", en: "F–G", zh: "F–G" },
      ],
      correct: 1,
    },
  },
  {
    id: "tc-dynamics",
    tags: ["ดัง", "เบา", "dynamic", "dynamics", "เสียง"],
    tier: 1,
    source: "dynamics-wiki",
    diagram: { type: "dynamics", mark: 3 },
    concept: { th: "p → f คือช่วงเสียง — ดนตรีสนุกขึ้นเมื่อมีเบา-ดังสลับ", en: "p → f is a range — music gets lively when soft and loud alternate", zh: "p→f是力度范围——强弱交替音乐才生动" },
    why: { th: "เล่นดังเท่ากันทั้งท่อนคือเหตุผลที่ฟังแล้ว “แบน” — เลือกจุดเน้นสัก 2-3 จุดต่อท่อน ผู้ฟังจะตามเราได้", en: "One flat volume is why a piece sounds lifeless — pick 2-3 emphasis points per section and listeners follow you.", zh: "全曲一样响听起来会平——每段选2-3个强调点，听众就会跟着你走。" },
    quiz: {
      q: { th: "mf กับ p อันไหนดังกว่า?", en: "Which is louder, mf or p?", zh: "mf和p哪个更响?" },
      choices: [
        { th: "p", en: "p", zh: "p" },
        { th: "mf", en: "mf", zh: "mf" },
        { th: "เท่ากัน", en: "The same", zh: "一样" },
      ],
      correct: 1,
    },
  },
  {
    id: "tc-hands-apart",
    tags: ["สองมือ", "มือ", "hands", "รวม"],
    tier: 1,
    source: "piano-pedagogy-wiki",
    diagram: null,
    concept: { th: "ซ้อมมือแยกให้ลื่น ก่อนรวมสองมือ", en: "Smooth hands-separately first, then combine", zh: "先分手练顺，再双手合" },
    why: { th: "สองมือสะดุดเพราะ “คิวงาน” ของแต่ละมือยังไม่ชัด — ซ้อมแยกจนไม่ต้องคิด แล้วรวมแบบช้า ๆ จะติดเร็วกว่า", en: "Hands-together stumbles because each hand's job isn't automatic yet — drill each until effortless, then combine slowly; it locks in faster.", zh: "合手卡是因为每只手的任务还不熟练——分开练到不用想，再慢慢合，很快就能锁住。" },
    quiz: {
      q: { th: "ก่อนเล่นสองมือรวม ควรทำอะไร?", en: "What should you do before hands together?", zh: "双手合之前应该做什么?" },
      choices: [
        { th: "ซ้อมสองมือพร้อมกันซ้ำ ๆ เลย", en: "Repeat hands together right away", zh: "直接反复双手合练" },
        { th: "ซ้อมแยกมือจนลื่นก่อน", en: "Drill each hand until smooth first", zh: "先分手练到流畅" },
        { th: "ดูคลิปสาธิตแทนการซ้อม", en: "Watch a demo instead of practicing", zh: "看示范代替练习" },
      ],
      correct: 1,
    },
  },
  {
    id: "tc-pedal-ear",
    tags: ["เท้า", "pedal", "ครึม", "ขุ่น"],
    tier: 1,
    source: "sustain-pedal-wiki",
    diagram: null,
    concept: { th: "เท้าเปียโนคือ “หู” — เปลี่ยนเท้าตอนคอร์ดเปลี่ยน ไม่ใช่ตอนจังหวะมา", en: "The pedal is an ear — change it when the chord changes, not when the beat arrives", zh: "踏板是耳朵——和弦换了才换，不是每拍都换" },
    why: { th: "เสียงขุ่นมาจากการเหยียบค้างข้ามคอร์ด — ฟังจนเสียงเริ่ม “ขุ่น” แล้วยกเท้าพร้อมคอร์ดใหม่ เสียงจะใสทันที", en: "The muddy sound is the pedal held across chords — listen for the blur and lift with the new chord; it clears instantly.", zh: "浑浊的声音是踏板跨和弦踩住造成的——听到变糊就跟着新和弦抬换，声音立刻干净。" },
    quiz: {
      q: { th: "ควรยก-เปลี่ยนเปียโนเท้าเมื่อไร?", en: "When should you change the sustain pedal?", zh: "什么时候应该换踏板?" },
      choices: [
        { th: "ทุกจังหวะที่ 1 เสมอ", en: "Always on every beat 1", zh: "每拍第1下都换" },
        { th: "ตอนคอร์ดเปลี่ยน", en: "When the chord changes", zh: "和弦变化时" },
        { th: "จบเพลงค่อยยก", en: "Only at the end", zh: "曲终才抬" },
      ],
      correct: 1,
    },
  },
  {
    id: "tc-chunking",
    tags: ["จำ", "memory", "ลืม", "ยาว", "ท่อน"],
    tier: 1,
    source: "chunking-wiki",
    diagram: null,
    concept: { th: "จำเป็น “ก้อน” — ซ้อมท่อนเล็ก 4-8 ตัวโน้ต แล้วค่อยต่อกัน", en: "Memorise in chunks — drill 4-8 note pieces, then chain them", zh: "分块记忆——先练4-8个音的小段，再连起来" },
    why: { th: "สมองจำทั้งเพลงพร้อมกันไม่ได้ แต่จำ “ก้อนเล็ก” ได้เก่ง — ซ้อมก้อนจนลื่น แล้วเชื่อมก้อนทีละคู่", en: "The brain can't hold a whole piece at once, but it's great at small chunks — drill each chunk smooth, then link them pair by pair.", zh: "大脑一次记不住整首曲子，但很擅长记小块——把每块练顺，再两两相连。" },
    quiz: {
      q: { th: "วิธีจำท่อนยาวที่ได้ผลที่สุดคือ?", en: "The most effective way to memorise a long passage?", zh: "记长段落最有效的方法是?" },
      choices: [
        { th: "เล่นทั้งท่อนซ้ำรวดเดียวยาว ๆ", en: "One long run-through after another", zh: "一遍遍整段拉长练" },
        { th: "แบ่งก้อนเล็ก ซ้อมจนลื่น แล้วต่อกัน", en: "Chunk it, drill smooth, then chain", zh: "分块练顺再连接" },
        { th: "เปิดโน้ตเล่นตามไปเรื่อย ๆ", en: "Keep reading along from the score", zh: "一直看着谱子跟弹" },
      ],
      correct: 1,
    },
  },
  {
    id: "tc-spaced-review",
    tags: ["ทบทวน", "review", "ลืม", "remember"],
    tier: 1,
    source: "spaced-repetition-wiki",
    diagram: null,
    concept: { th: "ทบทวน “ก่อนจะลืม” ได้ผลกว่าซ้อมรวดเดียวยาว", en: "Reviewing just before you forget beats one long session", zh: "快忘时复习胜过一次练很久" },
    why: { th: "งานวิจัยการเรียนรู้ยืนยันตรงกัน: สั้น ๆ หลายครั้งห่างกันเป็นวัน จำได้นานกว่า — แอปจัด “ครบกำหนดทบทวน” ให้แล้ว แค่กลับมาทำตาม", en: "Learning research agrees: short sessions spaced over days stick longer — the app already schedules due reviews, just come back and do them.", zh: "学习研究一致表明：短时多次、间隔几天记得更牢——应用已经排好复习计划，照着回来练就行。" },
    quiz: {
      q: { th: "การทบทวนแบบไหนจำได้นานกว่า?", en: "Which review schedule sticks longer?", zh: "哪种复习记得更久?" },
      choices: [
        { th: "สั้น ๆ หลายครั้ง เว้นเป็นวัน", en: "Short sessions spaced across days", zh: "短时多次、间隔几天" },
        { th: "ยาว ๆ ครั้งเดียวจบ", en: "One long marathon", zh: "一次长时间练完" },
        { th: "ทบทวนเฉพาะก่อนสอบ", en: "Only right before an exam", zh: "只在考试前复习" },
      ],
      correct: 0,
    },
  },
  {
    id: "tc-metre-34",
    tags: ["3/4", "วอลตซ์", "waltz", "metre", "จังหวะ"],
    tier: 1,
    source: "metre-wiki",
    diagram: { type: "rhythm-grid", beats: [1, 0.5, 0.5] },
    concept: { th: "3/4 คือ “ปัง-ฉะ-ฉะ” — หนักที่ 1 เบาที่ 2-3", en: "3/4 is OOM-pah-pah — strong on 1, light on 2-3", zh: "3/4是“蹦-嚓-嚓”——1强，2-3弱" },
    why: { th: "ท่อน 3/4 พลาดมักเพราะมือยังนับอยู่ใน 4 — จำรูปท่าหนัก-เบา-เบา แล้วมือจะวนถูกห้องเอง", en: "3/4 misses usually come from still counting in 4 — lock in the strong-weak-weak shape and the hand circles the bar correctly by itself.", zh: "3/4弹错多半是还在按4拍数——记住强弱弱的形状，手会自己走对每小节。" },
    quiz: {
      q: { th: "จังหวะหนักของห้อง 3/4 อยู่ที่ไหน?", en: "Where is the strong beat in 3/4?", zh: "3/4的重拍在哪里?" },
      choices: [
        { th: "จังหวะที่ 1", en: "Beat 1", zh: "第1拍" },
        { th: "จังหวะที่ 2", en: "Beat 2", zh: "第2拍" },
        { th: "จังหวะที่ 3", en: "Beat 3", zh: "第3拍" },
      ],
      correct: 0,
    },
  },
  {
    id: "tc-stage-calm",
    tags: ["เวที", "เสียงใจ", "ประสาท", "เครียด", "stage", "กลัว"],
    tier: 2,
    source: "stage-fright-wiki",
    diagram: null,
    concept: { th: "ใจเต้นก่อนเล่นเป็นเรื่องปกติ — หายใจนับ 4 ช่วยมือคลายจริง", en: "Stage nerves are normal — 4-count breathing genuinely relaxes the hands", zh: "上台紧张很正常——数4拍呼吸真能让手放松" },
    why: { th: "ความกังวลทำแขน-มือตึงแล้วพลาดขึ้น — หายใจเข้า 4 นับ ออก 4 นับ สองรอบ ก่อนเริ่ม ลดความตึงได้จริง ไม่ใช่คำแนะนำลอย ๆ", en: "Anxiety tightens arms and hands, causing the misses — two rounds of 4-count in/out before starting measurably relaxes them; this isn't generic advice.", zh: "紧张会让手臂和手发紧导致错音——开始前做两轮4拍吸呼，可测地放松，不是空话。" },
    quiz: {
      q: { th: "ก่อนขึ้นเล่น วิธีไหนช่วยคลายมือตึง?", en: "What helps relax tense hands before playing?", zh: "上台前什么方法能放松手?" },
      choices: [
        { th: "กำมือแน่น ๆ ไว้", en: "Squeeze fists tightly", zh: "用力握拳" },
        { th: "หายใจช้า ๆ นับ 4 เข้า-ออก", en: "Slow 4-count breathing in and out", zh: "数4拍缓慢呼吸" },
        { th: "รีบเริ่มเล่นเร็ว ๆ จะได้ไม่คิดมาก", en: "Rush into playing to avoid thinking", zh: "赶紧开始弹免得多想" },
      ],
      correct: 1,
    },
  },
];

/* ── knowledge stats (streak / lifetime counters) — localStorage-backed ── */
const KSTATS_KEY = "tg_kstats";

export function readKnowledgeStats() {
  try {
    const s = JSON.parse(store().getItem(KSTATS_KEY) || "null");
    return s && typeof s === "object" ? { streak: 0, bestStreak: 0, lastDay: null, correct: 0, answered: 0, seen: {}, ...s } : { streak: 0, bestStreak: 0, lastDay: null, correct: 0, answered: 0, seen: {} };
  } catch (e) { return { streak: 0, bestStreak: 0, lastDay: null, correct: 0, answered: 0, seen: {} }; }
}
export function writeKnowledgeStats(s) { try { store().setItem(KSTATS_KEY, JSON.stringify(s || {})); } catch (e) {} }

/* one answer per popup; the streak counts DAYS the learner answered, not quizzes */
export function bumpKnowledgeStats(correct) {
  const s = readKnowledgeStats();
  const today = dayKeyLocal();
  if (s.lastDay !== today) {
    const y = new Date(Date.now() - 86400000);
    s.streak = s.lastDay === dayKeyLocal(y) ? (s.streak || 0) + 1 : 1;
    s.lastDay = today;
    s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
  }
  s.answered = (s.answered || 0) + 1;
  if (correct) s.correct = (s.correct || 0) + 1;
  writeKnowledgeStats(s);
  return s;
}

export function markCardSeen(id) {
  if (!id) return;
  const s = readKnowledgeStats();
  s.seen = s.seen || {};
  s.seen[id] = dayKeyLocal();
  writeKnowledgeStats(s);
}

/* ── the picker ──
   level mirrors learnerTone tiers (beginner ≤2, advanced ≥8);
   struggle match is a keyword hit against the learner's current weakness;
   cards seen in the last 7 days are skipped unless the pool empties;
   rotation is by calendar day so the whole day shares one "ความรู้วันนี้". ── */
const DAY = 86400000;
function daysAgo(dk, now) {
  try { return Math.floor((now - new Date(dk + "T00:00:00").getTime()) / DAY); } catch (e) { return 9999; }
}
export function pickTeachCard({ level = 0, struggleLabel = null, now = Date.now(), seenOverride = null } = {}) {
  const tier = level <= 2 ? 0 : level >= 8 ? 2 : 1;
  const byTier = TEACH_CARDS.filter((c) => (c.tier || 0) <= tier);
  const label = (struggleLabel || "").toLowerCase();
  const matched = label ? byTier.filter((c) => (c.tags || []).some((t) => label.includes(String(t).toLowerCase()))) : [];
  let pool = matched.length ? matched : byTier;
  if (!pool.length) return null;
  const s = readKnowledgeStats();
  const seen = seenOverride || s.seen || {};
  const fresh = pool.filter((c) => { const d = daysAgo(seen[c.id], now); return !(d >= 0 && d < 7); });
  if (fresh.length) pool = fresh;
  const idx = Math.floor(now / DAY) % pool.length;
  return pool[idx] || pool[0];
}

/* learner's own missed pitch classes (recorded by shared-infra.recordNoteMisses
   during real practice) — feeds the mini-keyboard data chart */
export function readNoteMissMap() {
  try { const m = JSON.parse(store().getItem("tg_note_miss") || "{}"); return m && typeof m === "object" ? m : {}; } catch (e) { return {}; }
}

/* citation helper — institution name + url straight from the source registry */
export function cardSourceInfo(card) {
  const src = card && SOURCES[card.source];
  return src ? { institution: src.institution, url: src.url } : { institution: null, url: null };
}
