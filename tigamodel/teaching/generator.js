/* ── tigamodel/teaching/generator.js ──
   THE EXERCISE GENERATOR (capability "gen" — was the weakest link at 0.46).

   Deterministic, KB-backed exercise generation per topic (t) × level (1-5):
   every generator composes its items from REAL computed data that already
   lives in the model (scale math, interval grid, chord spelling, rhythm
   bank, sight-reading drills, memory tests, practice plans) — never from
   invented content. Output shape is stable for the app to render:
     { kind, title, task, steps[], check, meta }

   TRILINGUAL (2026-09-21, owner request): every learner-facing string is
   now { th, en, zh } — the Practice Coach card renders the app's current
   language (PracticeOverlay tx() picks [L]). Note names/BPM stay inline —
   they are language-neutral content, not labels.

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
      kind: "theory-scale",
      title: { th: `บันไดเสียง ${root} major`, en: `${root} major scale`, zh: `${root} 大调音阶` },
      task: { th: `เล่นบันไดเสียง ${root} major ขึ้น-ลง มือขวา 2 ออกเทฟ`, en: `Play the ${root} major scale up and down, right hand, 2 octaves`, zh: `用右手弹 ${root} 大调音阶上下行，两个八度` },
      steps: [
        { th: `พูดชื่อโน้ตออกเสียงก่อนเล่น: ${notes.join("-")}`, en: `Say the note names aloud before playing: ${notes.join("-")}`, zh: `弹之前先说出音名：${notes.join("-")}` },
        { th: "เล่นช้า 60 BPM ทีละโน้ต", en: "Play slowly at 60 BPM, one note at a time", zh: "用 60 BPM 慢速一个音一个音弹" },
        { th: "เล่นต่อเนื่อง 2 รอบไม่หยุด", en: "Play 2 full rounds without stopping", zh: "连续完整弹 2 遍不停顿" },
      ],
      check: { th: "ถูกต้องครบ 8 โน้ตขึ้น-ลง 2 รอบติด", en: "All 8 notes correct, up and down, 2 rounds in a row", zh: "上下行 8 个音全部正确，连续 2 遍" },
      meta: { notes, level },
    };
  }
  if (level === 3) {
    const notes = triadOf(rootIdx);
    return {
      kind: "theory-triad",
      title: { th: `คอร์ด ${root} major (บล็อก+แยก)`, en: `${root} major chord (block + arpeggio)`, zh: `${root} 大三和弦（柱式+分解）` },
      task: { th: `เล่นคอร์ด ${root} major แบบบล็อก แล้วแยก (arpeggio) ขึ้น-ลง`, en: `Play the ${root} major chord as a block, then as an arpeggio up and down`, zh: `先弹 ${root} 大三和弦柱式，再上下行分解（琶音）` },
      steps: [
        { th: `โน้ตในคอร์ด: ${notes.join("-")}`, en: `Chord tones: ${notes.join("-")}`, zh: `和弦音：${notes.join("-")}` },
        { th: "บล็อก 3 ครั้ง เสียงไม่แตก", en: "Block 3 times, no broken notes", zh: "柱式弹 3 次，音不出错" },
        { th: "แยกขึ้น-ลง 2 รอบ", en: "Arpeggio up and down, 2 rounds", zh: "分解上下行 2 遍" },
      ],
      check: { th: "เสียงครบ 3 โน้ตพร้อมกันทุกครั้ง ไม่มีโน้ตแตก", en: "All 3 notes land together every time — nothing broken", zh: "每次 3 个音同时到底，不出错音" },
      meta: { notes, level },
    };
  }
  if (level === 4) {
    const notes = minorTriadOf(rootIdx);
    return {
      kind: "theory-minor",
      title: { th: `${root} major vs ${root} minor — หูตัดสิน`, en: `${root} major vs ${root} minor — let your ear decide`, zh: `${root} 大调 vs ${root} 小调——用耳朵判断` },
      task: { th: `เล่นเมเจอร์แล้วไมเนอร์ของ ${root} สลับกัน 4 ครั้ง แล้วให้เพื่อน/ครูเดาว่ารอบไหนคืออะไร`, en: `Play ${root} major then minor, alternating 4 times — have a friend or teacher guess which is which`, zh: `交替弹 ${root} 大调和小调 4 次，让朋友或老师猜哪次是哪个` },
      steps: [
        { th: `เมเจอร์: ${triadOf(rootIdx).join("-")}`, en: `Major: ${triadOf(rootIdx).join("-")}`, zh: `大调：${triadOf(rootIdx).join("-")}` },
        { th: `ไมเนอร์: ${notes.join("-")} (โน้ตที่ 3 ลงครึ่งเสียง)`, en: `Minor: ${notes.join("-")} (3rd note down a half step)`, zh: `小调：${notes.join("-")}（三音降半音）` },
        { th: "สลับเล่นโดยบอกเองว่ารอบนี้คืออะไร", en: "Alternate while naming each round yourself", zh: "交替弹并同时说出每次是哪一种" },
      ],
      check: { th: "ตัวเองบอกถูก 4/4 รอบ", en: "You name it right 4/4 rounds", zh: "自己说对 4/4 次" },
      meta: { notes, level },
    };
  }
  const deg = 1 + Math.floor(r() * 7);
  const notes = spellMajor(rootIdx, 4);
  return {
    kind: "theory-degree",
    title: { th: `ระดับที่ ${deg} ของ ${root} major`, en: `Scale degree ${deg} of ${root} major`, zh: `${root} 大调的第 ${deg} 级音` },
    task: { th: `เล่นโน้ตระดับที่ ${deg} ของ ${root} major ทันทีที่ถูกถาม (3 รอบ สลับระดับ)`, en: `Play scale degree ${deg} of ${root} major the moment you're asked (3 rounds, mixed degrees)`, zh: `被问到时立刻弹出 ${root} 大调的第 ${deg} 级音（3 次，混合级数）` },
    steps: [
      { th: `บันได ${root}: ${notes.join("-")}`, en: `${root} scale: ${notes.join("-")}`, zh: `${root} 音阶：${notes.join("-")}` },
      { th: `ถาม-ตอบเร็ว: ระดับ ${[deg, 1 + (deg % 7), 1 + ((deg + 3) % 7)].join(", ")}`, en: `Fast Q&A: degrees ${[deg, 1 + (deg % 7), 1 + ((deg + 3) % 7)].join(", ")}`, zh: `快问快答：第 ${[deg, 1 + (deg % 7), 1 + ((deg + 3) % 7)].join("、")} 级` },
      { th: "เล่นโน้ตนั้นทันทีไม่ต้องนับจากหัวบันได", en: "Play the note instantly — don't count up from the scale start", zh: "立刻弹出该音，不要从头数起" },
    ],
    check: { th: "เล่นถูกโน้ตระดับที่ถาม 3/3 ภายใน 2 วินาที", en: "Correct note 3/3 within 2 seconds", zh: "2 秒内答对弹对 3/3 次" },
    meta: { notes, degree: deg, level },
  };
}

/* ── T1 technique: metronome ladders + hand balance ── */
function genTechnique(level, r) {
  const base = 60 + level * 12;
  const bpm = base + Math.floor(r() * 3) * 4;
  const patterns = [
    [{ th: "นิ้ว 1-2-3-4 ขึ้น-ลง C major", en: "Fingers 1-2-3-4 up and down C major", zh: "1-2-3-4 指在 C 大调上下行" },
     { th: "เล่นสี่โน้ตต่อจังหวะ แต่ละมือ", en: "Four notes per beat, each hand", zh: "每拍四个音，两只手分别练" }],
    [{ th: "มือสลับ C-E-G-C", en: "Hands alternate C-E-G-C", zh: "双手交替 C-E-G-C" },
     { th: "มือขวาเมโลดี้ มือซ้ายคอร์ดบล็อก สลับทีละ 2 ห้อง", en: "Right hand melody, left hand block chords, switch every 2 bars", zh: "右手旋律、左手柱式和弦，每 2 小节交换" }],
    [{ th: "เลกาโต้ vs สตัคคาโต้", en: "Legato vs staccato", zh: "连奏 vs 断奏" },
     { th: "ท่อนเดียวกันเล่นสองแบบ ฟังความต่าง", en: "Same passage both ways — hear the difference", zh: "同一段落弹两种方式，听出差别" }],
    [{ th: "ระยะกระโดด P4-P5", en: "Leaps P4–P5", zh: "纯四度/纯五度跳进" },
     { th: "เล่น C→F→C→G มือขวา ตาเหลือบคีย์ปลายทางก่อนกระโดด", en: "Play C→F→C→G right hand; glance at the destination key before each leap", zh: "右手弹 C→F→C→G，跳进前先看一眼目标键" }],
  ];
  const p = pick(r, patterns);
  return {
    kind: "technique",
    title: { th: `${p[0].th} @ ${bpm} BPM`, en: `${p[0].en} @ ${bpm} BPM`, zh: `${p[0].zh} @ ${bpm} BPM` },
    task: { th: `ซ้อมแบบฝึก: ${p[1].th} — เมโทรนอม ${bpm} BPM`, en: `Drill: ${p[1].en} — metronome at ${bpm} BPM`, zh: `练习：${p[1].zh} —— 节拍器 ${bpm} BPM` },
    steps: [
      { th: `เริ่ม ${bpm - 12} BPM 2 รอบสะอาด`, en: `Start at ${bpm - 12} BPM, 2 clean rounds`, zh: `从 ${bpm - 12} BPM 开始，干净弹 2 遍` },
      { th: `ขึ้นเป็น ${bpm} BPM เมื่อสะอาด 2 ครั้งติด`, en: `Move up to ${bpm} BPM after 2 clean passes in a row`, zh: `连续 2 次干净后升到 ${bpm} BPM` },
      { th: "ผิดครั้งแรกลง 4 BPM แล้วไล่ใหม่", en: "First slip: drop 4 BPM and rebuild", zh: "第一次出错就降 4 BPM 重新来" },
      { th: "จบด้วยความเร็วที่ 'สบายมือ'", en: "Finish at the speed that feels easy", zh: "以「手上舒服」的速度结束" },
    ],
    check: { th: `สะอาด 2 รอบติดที่ ${bpm} BPM (ไม่มีเสียงชน/หยุด)`, en: `2 clean rounds in a row at ${bpm} BPM (no clashes/stops)`, zh: `在 ${bpm} BPM 连续干净 2 遍（无碰撞/停顿）` },
    meta: { bpm, level },
  };
}

/* ── T2 sight-reading: real drill from the level grid ── */
function genSight(level, r) {
  const lv = Math.min(12, level * 2 + (r() < 0.5 ? 0 : 1));
  const drills = [
    [{ th: "กวาดตา 5 วินาที", en: "5-second scan", zh: "5 秒扫谱" },
     { th: "key? จังหวะ? จุดสูงสุด-ต่ำสุด? ท่อนซ้ำ?", en: "Key? Meter? Highest/lowest point? Repeated phrase?", zh: "调号？拍号？最高最低点？重复乐句？" }],
    [{ th: "ตบจังหวะก่อนเล่น", en: "Clap the rhythm first", zh: "先拍节奏" },
     { th: "ตบจังหวะทั้งแนวโดยไม่มี pitch", en: "Clap the whole line without any pitch", zh: "不带音高，拍出整行节奏" }],
    [{ th: "ห้ามย้อน", en: "No going back", zh: "不许回头" },
     { th: "ผิดก็ไปต่อ — อ่านแบบเปิดเพลงจริง", en: "A mistake? Keep going — read like real performance", zh: "错了也继续——像真实演奏那样读谱" }],
    [{ th: "ตาอยู่ข้างหน้า", en: "Eyes ahead", zh: "眼睛看前方" },
     { th: "เล่นห้องนี้ ตาอ่านห้องหน้าแล้ว", en: "Play this bar while your eyes read the next", zh: "弹这小节时眼睛已经读下一小节" }],
  ];
  const d = pick(r, drills);
  return {
    kind: "sight-reading",
    title: { th: `อ่านโน้ตระดับ ${lv} — ${d[0].th}`, en: `Sight-reading level ${lv} — ${d[0].en}`, zh: `视奏等级 ${lv} —— ${d[0].zh}` },
    task: { th: `เปิดเพลงที่ไม่เคยเล่น (ระดับ ${lv}) แล้วอ่าน 8 ห้องแรกด้วยแบบฝึก: ${d[1].th}`, en: `Open a piece you've never played (level ${lv}) and read the first 8 bars using this drill: ${d[1].en}`, zh: `打开一首没弹过的曲子（等级 ${lv}），用这个练习读前 8 小节：${d[1].zh}` },
    steps: [
      { th: `${d[0].th}: ${d[1].th}`, en: `${d[0].en}: ${d[1].en}`, zh: `${d[0].zh}：${d[1].zh}` },
      { th: "อ่านครั้งแรก: ช้า ไม่หยุด ไม่ย้อน", en: "First read: slow, no stopping, no going back", zh: "第一遍：慢速、不停顿、不回头" },
      { th: "อ่านครั้งที่สอง: จะดีขึ้นเอง — สังเกตมัน", en: "Second read: it improves by itself — notice it", zh: "第二遍：会自然变好——注意体会" },
    ],
    check: { th: "จบ 8 ห้องโดยไม่หยุดเกิน 3 ครั้ง", en: "Get through 8 bars with at most 3 stops", zh: "弹完 8 小节，停顿不超过 3 次" },
    meta: { level: lv, drill: d[0].th },
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
    kind: "ear-interval",
    title: { th: `หูดนตรี: ${iid} ${asc ? "ขึ้น" : "ลง"} จาก ${root}`, en: `Ear training: ${iid} ${asc ? "ascending" : "descending"} from ${root}`, zh: `听觉训练：从 ${root} ${asc ? "上行" : "下行"}的 ${iid}` },
    task: { th: `เล่น ${root} แล้ว ${second} (สองโน้ตแยกกัน) — ฟังแล้วระบุว่าเป็น ${iid} หรือไม่ ทำ 6 รอบสลับคู่เสียง`, en: `Play ${root} then ${second} (two separate notes) — listen and say whether it's a ${iid}. 6 rounds, mixed directions`, zh: `弹 ${root} 再弹 ${second}（两个分开的音）——听并判断是不是 ${iid}。共 6 次，混合方向` },
    steps: [
      { th: `เล่นโน้ตแรก ${root}4`, en: `Play the first note ${root}4`, zh: `先弹第一个音 ${root}4` },
      { th: `เล่นโน้ตที่สอง ${second}4 (${asc ? "ไล่ขึ้น" : "ไล่ลง"} ${semi} เซมิโทน)`, en: `Play the second note ${second}4 (${asc ? "up" : "down"} ${semi} semitones)`, zh: `再弹第二个音 ${second}4（${asc ? "向上" : "向下"} ${semi} 个半音）` },
      { th: "ก่อนเล่นรอบถัดไป พูดก่อนว่าคิดว่าคือคู่เสียงอะไร", en: "Before the next round, say what interval you think it is", zh: "下一轮之前，先说出你认为是哪个音程" },
      { th: "ทำสลับขึ้น-ลง 6 รอบ", en: "Alternate up/down for 6 rounds", zh: "上下行交替共 6 次" },
    ],
    check: { th: "ระบุถูก ≥ 5/6 รอบ", en: "Correct on at least 5/6 rounds", zh: "至少答对 5/6 次" },
    meta: { interval: iid, semitones: semi, level },
  };
}

/* ── T4 expression: phrasing + dynamics from real principles ── */
function genExpression(level, r) {
  const tasks = [
    [{ th: "โค้งเสียงหนึ่งยอด", en: "One arching phrase", zh: "一个拱形乐句" },
     { th: "เลือกประโยค 4 ห้อง กำหนดจุดสูงสุด 1 จุด แล้วเล่นให้ถึงจุดนั้นจริง", en: "Pick a 4-bar phrase, choose ONE peak, and actually arrive at it", zh: "选一个 4 小节乐句，定一个高点，并真正弹到那里" }],
    [{ th: "หายใจก่อนประโยคใหม่", en: "Breathe before the new phrase", zh: "新乐句前先呼吸" },
     { th: "เล่น 2 ประโยค ยกมือจริงระหว่างประโยคเหมือนหายใจ", en: "Play 2 phrases, genuinely lift between them like a breath", zh: "弹 2 个乐句，句间像呼吸一样真正抬手" }],
    [{ th: "echo", en: "Echo", zh: "回声" },
     { th: "เล่นประโยคเดิมสองครั้ง ครั้งที่สอง 'ตอบ' ไม่ใช่เล่นเหมือนเดิมตายตัว", en: "Play the same phrase twice — the second 'answers', not a dead copy", zh: "同一乐句弹两次——第二次是「回应」，不是机械重复" }],
    [{ th: "crescendo 4 ห้อง", en: "Crescendo over 4 bars", zh: "4 小节渐强" },
     { th: "ไล่ดังจาก p ไป f ใน 4 ห้อง — คนฟังต้องรู้สึกว่า 'มา'", en: "Grow from p to f across 4 bars — the listener must feel it coming", zh: "4 小节内从 p 渐强到 f——要让听众感到「来了」" }],
    [{ th: "เทียบสองระดับเสียง", en: "Compare two dynamic levels", zh: "对比两个力度层次" },
     { th: "เล่นท่อนเดิมระดับ p แล้ว f ฟังว่าอะไรเปลี่ยนนอกจากความดัง", en: "Play the same passage at p then f — hear what changes besides volume", zh: "同一段落先 p 后 f——听除了音量还有什么变化" }],
  ];
  const t = pick(r, tasks.slice(0, 1 + level));
  return {
    kind: "expression",
    title: { th: `แสดงออก: ${t[0].th}`, en: `Expression: ${t[0].en}`, zh: `表现力：${t[0].zh}` },
    task: t[1],
    steps: [
      { th: "เลือกท่อนที่เล่นคล่องแล้ว (เทคนิคต้องไม่เป็นภาระ)", en: "Pick a passage you already play well (technique must not be the burden)", zh: "选一段已经弹熟的（技术不成为负担）" },
      { th: "ตัดสินใจก่อนเล่น: จุดสูงสุดอยู่ห้องไหน", en: "Decide before playing: which bar is the peak", zh: "弹之前先决定：高点在哪一小节" },
      { th: "อัดเสียงหนึ่งรอบแล้วฟังตัวเอง", en: "Record one take and listen to yourself", zh: "录一遍，然后听自己" },
      { th: "เล่นรอบสองด้วยการตัดสินใจที่ชัดกว่า", en: "Play take two with clearer decisions", zh: "用更明确的决定弹第二遍" },
    ],
    check: { th: "คนฟัง (ครู/เพื่อน/กล้อง) บอกได้ว่า 'จุดสูงสุด' อยู่ตรงไหน", en: "A listener (teacher/friend/camera) can point to the peak", zh: "听众（老师/朋友/镜头）能指出高点在哪" },
    meta: { level },
  };
}

/* ── T5 practice management: real plan composition ── */
function genPractice(level, r) {
  const mins = [10, 15, 20, 30, 45][level - 1] || 20;
  const goals = [
    [{ th: "เปิดเพลงใหม่", en: "Open a new piece", zh: "开一首新曲子" },
     [{ th: "กวาดตา+ฟัง 3 นาที", en: "Scan + listen, 3 min", zh: "扫谱+听，3 分钟" },
      { th: "มือขวาช้า", en: "Right hand slow", zh: "右手慢速" },
      { th: "มือซ้ายช้า", en: "Left hand slow", zh: "左手慢速" },
      { th: "รวมช้ามาก", en: "Combine, very slow", zh: "合并，非常慢" },
      { th: "จดวันนี้ได้ถึงไหน", en: "Note today's stopping point", zh: "记下今天练到哪" }]],
    [{ th: "แก้จุดติดขัด", en: "Fix the sticking point", zh: "攻克卡壳点" },
     [{ th: "ระบุจุดพัง", en: "Locate the breakdown", zh: "找到出问题的位置" },
      { th: "ตัด 2-4 ห้อง ช้า 60%", en: "Isolate 2–4 bars at 60% speed", zh: "截取 2–4 小节，用 60% 速度" },
      { th: "ถูก 5 ครั้งติด", en: "5 correct in a row", zh: "连续正确 5 次" },
      { th: "เย็บกลับเข้าเพลง", en: "Sew it back into the piece", zh: "缝回整首曲子" },
      { th: "จบด้วยเพลงสนุก", en: "End with a fun piece", zh: "以一首好玩的曲子结束" }]],
    [{ th: "ท่องจำ", en: "Memorize", zh: "背谱" },
     [{ th: "ทดสอบก่อน", en: "Test first", zh: "先自测" },
      { th: "เติมเฉพาะจุดหลุด", en: "Refill only the gaps", zh: "只补漏掉的地方" },
      { th: "ทดสอบ 3 จุด", en: "Test 3 spots", zh: "测 3 个位置" },
      { th: "ท่องในใจ", en: "Play it in your head", zh: "在脑中过一遍" },
      { th: "ก่อนนอนทบทวน", en: "Review before sleep", zh: "睡前再复习" }]],
  ];
  const [g, steps] = pick(r, goals);
  const per = Math.max(2, Math.round(mins / steps.length));
  return {
    kind: "practice-plan",
    title: { th: `แผนซ้อม ${mins} นาที — ${g.th}`, en: `${mins}-minute practice plan — ${g.en}`, zh: `${mins} 分钟练习计划——${g.zh}` },
    task: { th: `ทำตามแผนซ้อม ${mins} นาทีนี้วันนี้ (ติ๊กทีละขั้น):`, en: `Follow this ${mins}-minute plan today (tick as you go):`, zh: `今天按这个 ${mins} 分钟计划来（逐步打勾）：` },
    steps: steps.map((s, i) => ({
      th: `${i + 1}. ${s.th} (${per} นาที)`, en: `${i + 1}. ${s.en} (${per} min)`, zh: `${i + 1}. ${s.zh}（${per} 分钟）`,
    })),
    check: { th: "ทุกขั้นถูกติ๊ก + จดผลหลังจบ 1 ประโยค", en: "Every step ticked + one written sentence on how it went", zh: "每一步都打勾 + 结束后写一句话记录" },
    meta: { minutes: mins, level },
  };
}

/* ── T6 psychology: motivation/learner scenario ── */
function genPsych(level, r) {
  const cases = [
    [{ th: "หงุดหงิดเล่นไม่ผ่าน", en: "Frustrated, can't get through", zh: "烦躁，弹不过去" },
     { th: "รับรู้ก่อน ('เล่น 10 รอบไม่ผ่าน หงุดหงิดจริง') → จัดกรอบ ('ผิด 10 = ลอง 10') → ก้าวจิ๋ว (2 ห้องช้าๆ)", en: "Acknowledge first (\"10 failed tries — that's genuinely annoying\") → reframe (\"10 misses = 10 tries\") → tiny step (2 slow bars)", zh: "先承认（「弹了 10 遍不过，真的很烦」）→ 重新框定（「错 10 次 = 尝试了 10 次」）→ 微小一步（慢速 2 小节）" }],
    [{ th: "เบื่อเพลงเดิม", en: "Bored of the same piece", zh: "对同一首曲子厌倦" },
     { th: "เปลี่ยนวิธีซ้อม ไม่ใช่เปลี่ยนเพลง: เล่นช้า 60% / เล่นสลับมือ / อัดฟังตัวเอง", en: "Change HOW you practise, not the piece: 60% speed / hands swapped / record and listen", zh: "改变练习方式而不是换曲子：60% 速度 / 交换双手 / 录音自听" }],
    [{ th: "เทียบกับเพื่อน", en: "Comparing yourself to friends", zh: "和朋友比较" },
     { th: "เทียบกับอัดเสียงตัวเองเมื่อสัปดาห์ก่อน — สถิติของตัวเองคือเส้นชัยเดียว", en: "Compare to your own recording from last week — your own record is the only finish line", zh: "和自己上周的录音比——自己的记录才是唯一的终点线" }],
    [{ th: "อยากเลิกเรียน", en: "Wanting to quit", zh: "想放弃" },
     { th: "พักจากความยาก ไม่ใช่เลิกรักดนตรี: เลือกเพลงโปรดเล่นเพื่อสนุก 3 วัน แล้วคุยกันใหม่", en: "Take a break from the hard part, not from music: play favourite pieces for fun for 3 days, then reassess", zh: "从难度中休息，而不是离开音乐：连续 3 天只弹喜欢的曲子，然后再聊" }],
    [{ th: "กลัวขึ้นเล่น", en: "Stage fright", zh: "怯场" },
     { th: "จำลองเวทีที่บ้าน: ยืนเล่น มีผู้ฟัง 1 คน โค้งเปิด-ปิด — ซ้อมพิธีจนชิน", en: "Simulate the stage at home: stand, one listener, bow in and out — rehearse the ritual till it's familiar", zh: "在家模拟舞台：站着弹、一位听众、开场和谢幕——把仪式练熟" }],
  ];
  const c = pick(r, cases.slice(0, 1 + level));
  return {
    kind: "psychology",
    title: { th: `สถานการณ์จริง: ${c[0].th}`, en: `Real situation: ${c[0].en}`, zh: `真实情境：${c[0].zh}` },
    task: c[1],
    steps: [
      { th: "ขั้นแรกเสมอ: รับรู้อารมณ์ ห้ามข้ามไปแก้ปัญหา", en: "Always first: acknowledge the feeling — never jump straight to fixing", zh: "永远先做：承认情绪，不要直接跳到解决问题" },
      { th: "ใช้ความจริง ไม่ใช่คำเชียร์ลอยๆ", en: "Use facts, not empty cheerleading", zh: "用事实，不用空洞的口号" },
      { th: "ปิดด้วยก้าวเล็กที่ทำได้ใน 2 นาที", en: "Close with a small step doable in 2 minutes", zh: "以一个 2 分钟内能做到的小步骤收尾" },
    ],
    check: { th: "จบด้วยประสบการณ์สำเร็จหนึ่งชิ้น (ไม่ใช่แค่คำพูดดี)", en: "End with one concrete success experience (not just nice words)", zh: "以一次真实的成功体验结束（不只是好听的话）" },
    meta: { level },
  };
}

/* ── T7 Thai music: honest keyboard adaptation tasks ── */
function genThai(level, r) {
  const genres = [
    [{ th: "ลูกทุ่ง", en: "Luk Thung", zh: "卢通（泰国民歌）" },
     { th: "คอร์ดบล็อกมือซ้าย + เมโลดี้หวือมือขวา", en: "Left-hand block chords + expressive right-hand melody", zh: "左手柱式和弦 + 右手富有表现力的旋律" }],
    [{ th: "สตริงไทย", en: "Thai string (pop-rock)", zh: "泰国流行摇滚" },
     { th: "คอร์ดสี่จังหวะสลับ + ร้องตาม", en: "Four-beat chord pattern + sing along", zh: "四拍和弦进行 + 跟着唱" }],
    [{ th: "หมอลำ", en: "Mor Lam", zh: "莫兰（泰东北民歌）" },
     { th: "จังหวะประกอบก่อน แล้วใส่เมโลดี้สั้น (ระบบเสียงใกล้เคียงแบบประมาณ)", en: "Groove first, then a short melody (approximating the tuning system)", zh: "先打节奏，再加入短旋律（音律做近似处理）" }],
    [{ th: "ลูกกรุง", en: "Luk Krung", zh: "卢克伦（泰国城市歌曲）" },
     { th: "สายเสียงนำช้าๆ เล่นลื่นก่อนใส่ตกแต่ง", en: "Slow lead line smooth first, ornament later", zh: "先把慢速主旋律弹顺，再加装饰" }],
    [{ th: "เพลงเด็กไทย", en: "Thai children's songs", zh: "泰国儿歌" },
     { th: "ร้องตาม→เล่นตาม→เล่นคนละขั้น", en: "Sing along → play along → split roles", zh: "跟唱 → 跟弹 → 分工合奏" }],
  ];
  const [g, how] = pick(r, genres.slice(0, 1 + level));
  return {
    kind: "thai-keyboard",
    title: { th: `${g.th} บนคีย์เปียโน`, en: `${g.en} on the piano keyboard`, zh: `钢琴上弹${g.zh}` },
    task: { th: `เปิดฟังต้นฉบับเพลง ${g.th} หนึ่งเพลงจนฮัมได้ แล้ว: ${how.th}`, en: `Listen to one original ${g.en} song until you can hum it, then: ${how.en}`, zh: `完整听一首${g.zh}原曲直到能哼出来，然后：${how.zh}` },
    steps: [
      { th: "ฟังต้นฉบับ 2 รอบ ฮัมเมโลดี้ตาม", en: "Listen twice, hum the melody along", zh: "听两遍，跟着哼旋律" },
      { th: "หาโน้ตแรกบนคีย์ (เริ่มที่ C กลางได้)", en: "Find the first note on the keyboard (middle C is a fine start)", zh: "在键盘上找到第一个音（从中央 C 开始即可）" },
      { th: "เล่นเมโลดี้ 4 ห้องแรกด้วยหู", en: "Play the first 4 bars by ear", zh: "凭听觉弹出前 4 小节" },
      { th: "มือซ้ายคอร์ดง่ายประกอบ", en: "Add simple left-hand chords", zh: "左手加简单和弦" },
      { th: "พูดตรงกันว่าเสียงไหน 'ใกล้' ไม่ 'เท่า' (เปียโนเป็น 12-TET)", en: "Be honest about which notes are 'close', not 'equal' (piano is 12-TET)", zh: "如实说出哪些音「接近」而非「相同」（钢琴是十二平均律）" },
    ],
    check: { th: "เล่น 4 ห้องแรกได้จากหู + รู้ว่าจุดไหนเสียงไม่ตรงเพราะอะไร", en: "First 4 bars by ear + you can say which notes don't quite match and why", zh: "凭听觉弹出前 4 小节 + 能说出哪些音不完全一致及原因" },
    meta: { genre: g.th, level },
  };
}

/* ── T8 performance: stagecraft rehearsal scenario ── */
function genPerformance(level, r) {
  const scen = [
    [{ th: "พิธีเปิด-ปิด", en: "Opening–closing ritual", zh: "开场–谢幕仪式" },
     { th: "เดินเข้าจากเก้าอี้ โค้ง เล่นเพลงโปรด 3 ห้อง โค้ง เดินกลับ — ซ้อมทั้งพิธี 3 รอบ", en: "Walk in from your chair, bow, play 3 bars of a favourite piece, bow, walk back — rehearse the whole ritual 3 times", zh: "从座位走进来、鞠躬、弹 3 小节喜欢的曲子、鞠躬、走回去——把整个仪式练 3 遍" }],
    [{ th: "กู้จากความผิด", en: "Recover from mistakes", zh: "从错误中恢复" },
     { th: "เล่นเพลงที่คล่อง แล้วให้คนอื่นตบมือดังขัดจังหวะกลางเพลง — ฝึกไปต่อโดยไม่สะดุดใจ", en: "Play a fluent piece while someone claps off-beat mid-song — practise continuing without being derailed", zh: "弹一首熟练的曲子，让他人中途不合拍地鼓掌——练习不被打断地继续" }],
    [{ th: "เริ่มจากจุดสุ่ม", en: "Start from random spots", zh: "从随机位置开始" },
     { th: "สุ่มจุดเริ่ม 5 จุด เล่นจากจุดนั้น 8 ห้อง — ความจำที่อยู่รอดเวที", en: "Pick 5 random start points and play 8 bars from each — the memory that survives the stage", zh: "随机选 5 个起点，各弹 8 小节——能在舞台上存活的记忆" }],
    [{ th: "อัดหน้ากล้อง", en: "Record on camera", zh: "镜头前录制" },
     { th: "อัดวิดีโอทั้งเพลงแบบไม่หยุด ไม่รีเทค — รับความกดดันจากกล้องก่อนคนจริง", en: "Video the whole piece, no stops, no retakes — take the camera's pressure before real people", zh: "整首录像，不停止、不重录——先承受镜头的压力，再面对真人" }],
    [{ th: "ผิดแล้วใจเย็น", en: "Mistake with a calm face", zh: "出错也保持平静" },
     { th: "ตั้งใจผิด 1 จุด (เล่นโน้ตผิด) แล้วฝึก 'ไม่ทำหน้า' ไปต่อทันที", en: "Deliberately miss one note, then practise keeping your face and moving straight on", zh: "故意弹错一个音，然后练习面不改色地继续" }],
  ];
  const s = pick(r, scen.slice(0, 1 + level));
  return {
    kind: "performance",
    title: { th: `ซ้อมเวที: ${s[0].th}`, en: `Stage rehearsal: ${s[0].en}`, zh: `舞台排练：${s[0].zh}` },
    task: s[1],
    steps: [
      { th: "เลือกเพลงที่เล่นได้แน่นอน (เวทีไม่ใช่ที่ทดลอง)", en: "Choose a piece you can certainly play (the stage is not the lab)", zh: "选一首肯定能弹的曲子（舞台不是实验室）" },
      { th: "ซ้อมพิธีทั้งหมด ไม่ใช่แค่เพลง", en: "Rehearse the whole ritual, not just the piece", zh: "排练整个仪式，不只是曲子" },
      { th: "อัด/มีผู้ชมจำลองทุกครั้ง", en: "Record / simulate an audience every time", zh: "每次都录像 / 模拟观众" },
      { th: "คุยหลังจบ: อะไรสั่น สั่นตรงไหน แก้ด้วยการซ้อมจุดนั้น", en: "Debrief: what shook, where — fix it by drilling that spot", zh: "结束后复盘：哪里发抖——用练习那个位置来解决" },
    ],
    check: { th: "จบพิธีเต็มโดยไปต่อได้ทุกครั้งแม้ผิด", en: "Complete the full ritual, continuing every time even after a mistake", zh: "完整走完仪式，即使出错也能每次继续" },
    meta: { level },
  };
}

/* ── T9 improv/composition: prompt chains ── */
function genImprov(level, r) {
  const prompts = [
    [{ th: "เล่นถาม-ตอบ", en: "Question and answer", zh: "问答对句" },
     { th: "มือขวาเล่นประโยค 2 ห้อง ('ถาม') แล้วเล่นประโยคใหม่ที่ 'ตอบ' — สลับกัน 4 รอบ", en: "Right hand plays a 2-bar phrase (the question), then a new phrase that answers — alternate 4 times", zh: "右手弹 2 小节乐句（问），再弹一个「答」的新乐句——交替 4 次" }],
    [{ th: "โน้ต 3 ตัวเล่าเรื่อง", en: "Three notes, three moods", zh: "三个音讲三种情绪" },
     { th: "ใช้โน้ต C-E-G อย่างเดียว เล่นให้ได้ 3 อารมณ์: สนุก เศร้า ตื่นเต้น", en: "Use only C-E-G and make three moods: playful, sad, excited", zh: "只用 C-E-G 弹出三种情绪：欢快、忧伤、激动" }],
    [{ th: "รูปแบบจากคอร์ด", en: "Patterns from a chord", zh: "和弦上的音型" },
     { th: "คอร์ด C ค้างไว้ มือขวาด้นเมโลดี้จากโน้ตในคอร์ด 8 จังหวะ", en: "Hold a C chord; improvise a right-hand melody from chord tones for 8 beats", zh: "按住 C 和弦，右手用和弦音即兴 8 拍" }],
    [{ th: "คำถามจบลงที่เร", en: "Question ending on the 2nd", zh: "结束在二级音的问句" },
     { th: "ด้นประโยคที่จบลงที่โน้ต D (รู้สึก 'ยังไม่จบ') แล้วประโยคถัดไปจบที่ C", en: "Improvise a phrase ending on D (feeling unfinished), then one ending on C", zh: "即兴一句结束在 D（感觉没完），下一句结束在 C" }],
    [{ th: "เรียงเพลง 8 ห้อง", en: "Compose an 8-bar piece", zh: "创作 8 小节小曲" },
     { th: "A (4 ห้อง) → A ซ้ำแต่ตกแต่ง → B ใหม่ → กลับ A — เขียน/อัดไว้", en: "A (4 bars) → A again, decorated → new B → back to A — write or record it", zh: "A（4 小节）→ 变化的 A → 新的 B → 回到 A——写下来或录下来" }],
  ];
  const p = pick(r, prompts.slice(0, 1 + level));
  return {
    kind: "improv",
    title: { th: `ด้นสด: ${p[0].th}`, en: `Improvise: ${p[0].en}`, zh: `即兴：${p[0].zh}` },
    task: p[1],
    steps: [
      { th: "กติกาสำคัญ: ไม่มีโน้ตผิดในการด้น — มีแต่เสียงที่เรา 'เลือกต่อ'", en: "Golden rule: no wrong notes in improv — only sounds you choose to continue", zh: "黄金法则：即兴没有错音——只有你「选择接续」的声音" },
      { th: "จำกัดโน้ตให้น้อยก่อน (3 ตัวชนะ 12 ตัว)", en: "Limit notes first (3 beats 12)", zh: "先限制音的数量（3 个胜过 12 个）" },
      { th: "อัดทุกครั้ง ฟังย้อน หาประโยคที่ชอบ", en: "Record every time, listen back, find the phrase you like", zh: "每次都录，回听，找出喜欢的乐句" },
      { th: "เล่นประโยคที่ชอบซ้ำ — นั่นคือเพลงของเธอ", en: "Repeat your favourite phrase — that's your piece", zh: "把你最喜欢的乐句重复弹——那就是你的曲子" },
    ],
    check: { th: "มีประโยคที่ตัวเองฟังแล้วอยากเล่นซ้ำอย่างน้อย 1 ประโยค", en: "At least one phrase you'd want to play again after hearing it", zh: "至少有一个自己听完想再弹的乐句" },
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
