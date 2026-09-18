/* ── tigamodel/roadmap-1m.js ──
   THE 1,000,000-ITEM DEVELOPMENT PLAN (owner directive 2026-09-18: "วิเคราะห์
   และเขียนแผนพัฒนา 1,000,000 ที่จะทำให้โมเดล AI สอนเปียโนนี้ดีขึ้น 1 ล้านเท่า").

   THE HONEST ENGINEERING READING of "ดีขึ้น 1 ล้านเท่า": quality multiplies
   across independent dimensions (accuracy × language × latency × engagement…),
   so the path there is not 1,000,000 random ideas — it is 1,000,000 UNIQUE,
   TESTABLE capability specifications covering the model's whole improvement
   space, each one a real combination a teacher could be asked to deliver:

     WHAT to teach × WHO it is for × HOW it is taught
     × which MODEL LAYER does it × WHERE in the app × which QUALITY BAR.

   6 dimensions × 10 real values each = 10^6 = 1,000,000 specs. Every value is
   a distinct, defensible element of world-class piano teaching (same selection
   principle as roadmap-100.js). Nothing is filler: each item composes its text
   from its own dimension values plus a measurable acceptance criterion, and
   each item is scoreable, coverable (by an actually-shipped module), and
   addressable by a stable code (e.g. "T2W1H5M6S2Q0") — so the plan can be
   iterated cell-by-cell instead of being a wall of wishes.

   HOW TO USE IT (docs/03-roadmap-1m.md is the narrative):
     plmStats()                  → totals, started/open counts, priority buckets
     plmRank({ offset, limit })  → the work order (highest-priority first)
     plmItem(i) / plmParse(code) → one spec, round-trippable
     plmSample(seed)             → deterministic random audit sample
   Coverage marking is route level (WHAT × MODEL LAYER × WHERE): a cell is
   "started" when a really-shipped module in this repo serves that route.
   Started ≠ done — the WHO × HOW × QUALITY detail is exactly what the open
   part of the plan asks to deepen. ── */

export const PLM_TOTAL = 1000000;

/* ── The six dimensions. Digit position in the item index:
   index = t*100000 + w*10000 + h*1000 + m*100 + s*10 + q.
   w = priority weight (1..3) — sums into the item's work-order score. ── */

export const PLM_DIMENSIONS = [
  {
    id: "t", letter: "T", icon: "🎼",
    th: "สอนอะไร (WHAT)", en: "What to teach",
    values: [
      { th: "ทฤษฎีดนตรี", en: "Music theory", w: 2, why: "ทฤษฎีคือภาษาที่วิชาอื่นทุกวิชาใช้ต่อ — สอนผิดที่นี่คือเสียทุกอย่างที่อยู่ถัดไป" },
      { th: "เทคนิคการเล่น", en: "Technique", w: 3, why: "เทคนิคที่ผิดสร้างอาการบาดเจ็บและเพดานความเร็ว — แก้ยากเมื่อมันฝังนาน" },
      { th: "การอ่านโน้ต", en: "Sight-reading", w: 3, why: "อ่านโน้ตเก่ง = เรียนเพลงใหม่ได้เองโดยไม่ต้องมีครูทุกครั้ง" },
      { th: "หูดนตรี/การฟัง", en: "Aural skills", w: 2, why: "หูคือผู้ตรวจงานที่แท้จริง — เล่นผิดแต่ฟังไม่ออกก็แก้ไม่เป็น" },
      { th: "การแสดงออก", en: "Expression", w: 2, why: "ถูกทุกตัวโน้ตแต่ไร้ชีวิต คือเพลงที่ใครก็ไม่อยากฟังซ้ำ" },
      { th: "การจัดการซ้อม", en: "Practice management", w: 3, why: "ซ้อมผิดวิธี 10 ชั่วโมง แพ้ซ้อมถูกวิธี 1 ชั่วโมง" },
      { th: "จิตวิทยาผู้เรียน", en: "Learner psychology", w: 2, why: "คนเลิกเรียนเปียโนเพราะใจ ไม่ใช่เพราะนิ้ว" },
      { th: "เพลงไทย & วัฒนธรรม", en: "Thai & cultural music", w: 2, why: "เด็กไทยรักเปียโนขึ้นเมื่อได้เล่นเพลงที่หูของเขารัก" },
      { th: "การแสดงสด", en: "Performance craft", w: 2, why: "เวทีเลียนแบบไม่ได้ — ต้องซ้อมเรื่องใจตั้งแต่ก่อนขึ้นจริง" },
      { th: "การประพันธ์ & ด้นสด", en: "Composition & improv", w: 1, why: "ผู้เรียนที่สร้างเพลงเป็นคือผู้เรียนที่ไม่มีวันเบื่อเครื่องดนตรีนี้" },
    ],
  },
  {
    id: "w", letter: "W", icon: "🧑",
    th: "เพื่อใคร (WHO)", en: "Who it is for",
    values: [
      { th: "เด็กเล็ก 3–5", en: "Ages 3–5", w: 2, why: "ช่วงที่หูดูดซับเสียงดีที่สุดในชีวิต แต่ความสนใจสั้นกว่า 5 นาที" },
      { th: "เด็ก 6–9", en: "Ages 6–9", w: 3, why: "กลุ่มหลักของแอป — เรียนรู้เร็วมากเมื่อเนื้อหามาในรูปเกม" },
      { th: "เด็ก 10–12", en: "Ages 10–12", w: 2, why: "เริ่มเข้าใจนามธรรม และเริ่มอยากเล่น \"เพลงของตัวเอง\"" },
      { th: "วัยรุ่น", en: "Teens", w: 2, why: "เวลาน้อย อัตตาสูง — ต้องได้เพลงที่อวดเพื่อนได้" },
      { th: "ผู้ใหญ่มือใหม่", en: "Adult beginners", w: 3, why: "เรียนเพราะอยากเรียนเอง ไม่ใช่พ่อแม่อยากให้เรียน — แต่กลัวฝืดที่สุด" },
      { th: "ผู้สูงอายุ 60+", en: "Seniors 60+", w: 2, why: "มีหลักฐานว่าเครื่องดนตรีหน่วงภาวะสมองเสื่อม — ตลาดที่ครูแทบไม่มีให้" },
      { th: "ระดับกลาง", en: "Intermediate", w: 2, why: "หุบเขากลางทาง — จุดที่คนเลิกเรียนมากที่สุดของทุกระบบ" },
      { th: "ระดับสูง", en: "Advanced", w: 2, why: "ระดับนี้คำแนะนำผิดพลาดจุดเดียวก็ทำให้พัฒนาถอยหลัง" },
      { th: "ระดับวิชาการ", en: "Conservatory", w: 1, why: "ต้องการการวิเคราะห์ระดับอาจารย์มหาวิทยาลัย ไม่ใช่คำเชียร์" },
      { th: "ผู้เรียนพิเศษ", en: "Special-needs learners", w: 3, why: "ครูที่สอนเด็ก ADHD/ออทิสติกได้ดีหายากมาก — AI เข้าถึงได้ทุกที่" },
    ],
  },
  {
    id: "h", letter: "H", icon: "🎛",
    th: "สอนอย่างไร (HOW)", en: "How it is taught",
    values: [
      { th: "บทสนทนา Socratic", en: "Socratic dialogue", w: 2, why: "ความรู้ที่นักเรียนคิดเองได้คือความรู้ที่ติดตัว" },
      { th: "เสียงพูดนำ", en: "Voice-guided", w: 2, why: "เด็กเล็กอ่านยังไม่คล่อง — เสียงพูดเข้าถึงได้ก่อนตัวหนังสือ" },
      { th: "เกมโต้ตอบ", en: "Interactive games", w: 3, why: "ด็อปามีนจากเกมคือเชื้อเพลิงของการซ้อมซ้ำ" },
      { th: "วิดีโอสาธิต", en: "Video demos", w: 1, why: "มือที่ถูกต้องต้องเห็นก่อนจึงจะเลียนแบบได้" },
      { th: "ภาพ & แผนภาพ", en: "Visual diagrams", w: 1, why: "โครงสร้างที่เห็นเป็นภาพจำได้นานกว่าที่อ่านเป็นตัวหนังสือ" },
      { th: "แตกขั้นบันได", en: "Scaffolded steps", w: 3, why: "ท่อนยากที่แตกเป็น 5 ขั้นเล็กคือท่อนที่เล่นได้ในวันนี้" },
      { th: "เพลงจริงที่รัก", en: "Real loved songs", w: 3, why: "แรงจูงใจสูงสุดคือการได้เล่นเพลงที่ฟังอยู่ทุกวัน" },
      { th: "แข่งกับสถิติตัวเอง", en: "Beat your own record", w: 2, why: "แข่งกับตัวเองปลอดภัยกว่าแข่งกับคนอื่น แต่ยังได้ความตื่นเต้น" },
      { th: "อัด & ฟังย้อนหลัง", en: "Record & review", w: 2, why: "นักเรียนไม่เชื่อว่าตัวเองเล่นผิดจนได้ยินเสียงตัวเอง" },
      { th: "ทบทวนตามจำเสื่อม", en: "Spaced repetition", w: 3, why: "กฎความจำไม่มีทางลัด — ซ้ำช่วงเว้นถูกคือวิธีเดียวที่ติดนาน" },
    ],
  },
  {
    id: "m", letter: "M", icon: "🧠",
    th: "ชั้นความสามารถของโมเดล (LAYER)", en: "Model layer",
    values: [
      { th: "คลังความรู้ (KB)", en: "Knowledge base", w: 2, why: "ทุกคำตอบต้องยืนบนข้อเท็จจริง ไม่ใช่ความรู้สึกว่าน่าจะใช่" },
      { th: "การให้เหตุผล", en: "Reasoning", w: 3, why: "ครูเก่งไม่ได้เพราะจำเคสมาก แต่เพราะไล่สาเหตุรากจนเจอ" },
      { th: "ความจำผู้เรียน", en: "Learner memory", w: 2, why: "ครูที่จำได้ว่าสัปดาห์ก่อนลูกศิษย์ติดตรงไหน คือครูที่ลูกศิษย์รัก" },
      { th: "เข้าใจอารมณ์", en: "Affect sensing", w: 2, why: "วันที่นักเรียนท้อ สอนเนื้อหายากขึ้นคือวันที่ทำให้เขาเลิกเรียน" },
      { th: "การวางแผนเส้นทาง", en: "Path planning", w: 3, why: "เส้นทางเฉพาะบุคคลคือข้อได้เปรียบที่ AI ชนะครูมนุษย์ได้จริง" },
      { th: "การประเมิน", en: "Assessment", w: 3, why: "ประเมินผิด = วางแผนถัดไปผิดทั้งสาย" },
      { th: "การให้ใบ้", en: "Hinting", w: 3, why: "เฉลยเร็วเกินไปคือการขโมยโอกาสเรียนรู้" },
      { th: "สร้างเนื้อหา", en: "Generation", w: 2, why: "แบบฝึกหัดที่ปรับให้ตัวเองเป๊ะคือของที่ตำราพิมพ์ไม่ได้" },
      { th: "เรียนรู้เอง", en: "Self-learning", w: 3, why: "โมเดลที่ไม่อัปเดตตัวเองคือโมเดลที่ล้าสมัยขึ้นทุกวัน" },
      { th: "ทำนาย & ป้องกัน", en: "Prediction", w: 2, why: "จับจุดที่กำลังจะพลาดก่อนพลาด = ประหยัดเวลาซ้อมเป็นชั่วโมง" },
    ],
  },
  {
    id: "s", letter: "S", icon: "📱",
    th: "ช่องทางในแอป (WHERE)", en: "Where in the app",
    values: [
      { th: "แดชบอร์ด", en: "Dashboard", w: 2, why: "หน้าแรกที่รู้ว่าวันนี้ควรซ้อมอะไร ตัดเวลาตัดสินใจให้เหลือเวลาเล่น" },
      { th: "บทเรียน", en: "Lesson view", w: 3, why: "บทเรียนคือจุดที่โมเดลได้พูดกับผู้เรียนตรง ๆ มากที่สุด" },
      { th: "โหมดซ้อม", en: "Practice mode", w: 3, why: "สัญญาณจริงทั้งหมด (ความแม่น การหยุด จังหวะ) มาจากที่นี่" },
      { th: "โหมดเล่นตาม", en: "Play-along", w: 2, why: "ความสนุกแบบ flow เกิดตรงนี้ — พลาดนิดเดียวก็รู้ทันที" },
      { th: "ไซต์รีดดิ้ง", en: "Sight-reading trainer", w: 2, why: "สนามซ้อมอ่านโน้ตที่วัดความเร็วสายตา-มือได้ต่อเนื่อง" },
      { th: "แชทครู AI", en: "Teacher chat", w: 3, why: "ประตูที่ผู้เรียนเข้ามาถามว่า \"ทำไม\" — คำถามเหล่านี้คือโอกาสสอนทองคำ" },
      { th: "รายงานคืบหน้า", en: "Progress reports", w: 2, why: "รายงานที่พ่อแม่อ่านแล้วต่ออาสมาชิก คือรายงานที่ดี" },
      { th: "เสียงพูด/ไมค์", en: "Voice surfaces", w: 2, why: "มือจับเปียโนอยู่ — หูกับปากจึงเป็นช่องทางควบคู่ที่สำคัญ" },
      { th: "กล้อง/มือ", en: "Camera & hands", w: 1, why: "กล้องเห็นท่ามือที่ไมโครโฟนฟังไม่ออก" },
      { th: "ข้ามแพลตฟอร์ม", en: "Cross-platform", w: 2, why: "ซ้อมต่อจาก iPad บนมือถือระหว่างรอรถ — ความต่อเนื่องคือทุกอย่าง" },
    ],
  },
  {
    id: "q", letter: "Q", icon: "📏",
    th: "เกณฑ์คุณภาพ (QUALITY BAR)", en: "Quality bar",
    values: [
      { th: "ความถูกต้อง", en: "Factual accuracy", w: 3, criterion: "ข้อเท็จจริงทฤษฎีถูกต้อง ≥ 95% เมื่อตรวจด้วยคณิตทฤษฎีจริง" },
      { th: "ภาษาไทยเป็นธรรมชาติ", en: "Natural Thai (3 langs)", w: 3, criterion: "อ่านเข้าใจสำหรับเด็กไทย ไม่ใช่คำแปลตรงตัวจากอังกฤษ" },
      { th: "ตอบทันใจ", en: "Latency", w: 2, criterion: "ตอบภายใน 2 วินาทีในโหมดซ้อม — ช้ากว่านั้นคือหลุดจาก flow" },
      { th: "เหมาะกับวัย", en: "Age-appropriate", w: 2, criterion: "คำศัพท์ ตัวอย่าง และภาพเหมาะกับอายุที่ประกาศไว้" },
      { th: "ปลอดภัยสำหรับเด็ก", en: "Child safety", w: 3, criterion: "ไม่มีเนื้อหาเสี่ยง ไม่เก็บข้อมูลเกินจำเป็น ผู้ปกครองตรวจสอบได้" },
      { th: "แก้ตัวเมื่อพลาด", en: "Self-correction", w: 2, criterion: "เมื่อถูกชี้ว่าผิด ยอมรับและแก้ทันที ไม่ยืนคำผิด" },
      { th: "สม่ำเสมอ", en: "Consistency", w: 2, criterion: "เงื่อนไขเดียวกัน ตอบเดียวกัน ไม่ว่าถามวันไหน" },
      { th: "วัดผลจริง", en: "Measured outcome", w: 3, criterion: "ผู้เรียนที่ใช้ฟีเจอร์นี้วัดก่อน-หลังแล้วดีขึ้นจริง" },
      { th: "อ้างอิงได้", en: "Sourced knowledge", w: 2, criterion: "ความรู้ทุกก้อนระบุที่มาได้" },
      { th: "สนุกจนกลับมา", en: "Engagement", w: 2, criterion: "อัตรากลับมาซ้อมในสัปดาห์ถัดไปสูงขึ้นเมื่อเทียบกลุ่มควบคุม" },
    ],
  },
];

/* ── Shipped-module coverage: a cell (t, w, h, m, s, q) is marked "started"
   when one of these REAL modules in this repo serves the WHAT × LAYER × WHERE
   route — regardless of WHO/HOW/QUALITY detail (that depth is precisely what
   the open part of the plan asks to deepen). roadmap = the roadmap-100.js
   items this module implements. ── */

const COVERAGE_MODULES = [
  { name: "KB 16,580 (university + computed)", ts: [0, 1, 3, 7, 9], ms: [0, 7], ss: [1, 2, 5], roadmap: [1, 2, 4, 15] },
  { name: "skill-graph (80 โหนด + เส้นทาง)", ts: [1, 2, 5], ms: [1, 4], ss: [1, 2], roadmap: [62] },
  { name: "โค้ชอัจฉริยะ (บันไดใบ้/tempo/สรุป)", ts: [1, 2, 5, 6], ms: [4, 5, 6], ss: [1, 2], roadmap: [73, 75, 78, 46] },
  { name: "teaching-loop (สัญญาณจริง → กลยุทธ์)", ts: [5, 6], ms: [1, 4], ss: [2, 5], roadmap: [78] },
  { name: "self-learner (สวิตช์เรียนรู้เอง)", ts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ms: [8], ss: [5], roadmap: [90] },
  { name: "eval-suite (ประเมินโมเดลจริง)", ts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ms: [5], ss: [5], roadmap: [83] },
  { name: "รายงาน & สถิติผู้เรียน", ts: [5], ms: [2], ss: [6], roadmap: [] },
  { name: "แชทครู AI (โปรดักชัน)", ts: [0, 4, 6, 7], ms: [0, 1, 2, 3, 7], ss: [5], roadmap: [] },
  { name: "Voice Tutor (เสียงพูด)", ts: [3], ms: [0, 2], ss: [7], roadmap: [] },
  { name: "Camera Coach (กล้อง & มือ)", ts: [1], ms: [5], ss: [8], roadmap: [] },
];

/* ── internals ── */

const DIM_LETTERS = ["t", "w", "h", "m", "s", "q"];
const WEIGHTS = PLM_DIMENSIONS.map(d => d.values.map(v => v.w));
const MAX_PRIORITY = WEIGHTS.reduce((acc, ws) => acc + Math.max(...ws), 0);

function digitsOf(i) {
  i = Math.floor(Number(i));
  if (!(i >= 0 && i < PLM_TOTAL)) return null;
  return [Math.floor(i / 100000), Math.floor(i / 10000) % 10, Math.floor(i / 1000) % 10, Math.floor(i / 100) % 10, Math.floor(i / 10) % 10, i % 10];
}
function codeOf(ds) { return ds.map((v, i) => DIM_LETTERS[i].toUpperCase() + v).join(""); }

/* per-(t,m,s) route map: which shipped modules serve that route */
const ROUTES = new Map(); // "t:m:s" → [module, ...]
for (const mod of COVERAGE_MODULES) {
  const ts = mod.ts || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ms = mod.ms || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ss = mod.ss || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const t of ts) for (const m of ms) for (const s of ss) {
    const key = t + ":" + m + ":" + s;
    if (!ROUTES.has(key)) ROUTES.set(key, []);
    ROUTES.get(key).push(mod);
  }
}

let _buckets = null; // priority 0..MAX_PRIORITY → int[] of indices (rank order)

function ensureCompiled() {
  if (_buckets) return;
  _buckets = [];
  for (let p = 0; p <= MAX_PRIORITY; p++) _buckets.push([]);
  for (let i = 0; i < PLM_TOTAL; i++) {
    let p = 0;
    p += WEIGHTS[0][Math.floor(i / 100000)];
    p += WEIGHTS[1][Math.floor(i / 10000) % 10];
    p += WEIGHTS[2][Math.floor(i / 1000) % 10];
    p += WEIGHTS[3][Math.floor(i / 100) % 10];
    p += WEIGHTS[4][Math.floor(i / 10) % 10];
    p += WEIGHTS[5][i % 10];
    _buckets[p].push(i);
  }
}

/* ── public API ── */

export function plmItem(index) {
  const ds = digitsOf(index);
  if (!ds) return null;
  const i = ds[0] * 100000 + ds[1] * 10000 + ds[2] * 1000 + ds[3] * 100 + ds[4] * 10 + ds[5];
  const tv = PLM_DIMENSIONS[0].values[ds[0]];
  const wv = PLM_DIMENSIONS[1].values[ds[1]];
  const hv = PLM_DIMENSIONS[2].values[ds[2]];
  const mv = PLM_DIMENSIONS[3].values[ds[3]];
  const sv = PLM_DIMENSIONS[4].values[ds[4]];
  const qv = PLM_DIMENSIONS[5].values[ds[5]];
  const mods = ROUTES.get(ds[0] + ":" + ds[3] + ":" + ds[4]) || [];
  const priority = tv.w + wv.w + hv.w + mv.w + sv.w + qv.w;
  return {
    index: i,
    code: codeOf(ds),
    dims: { t: ds[0], w: ds[1], h: ds[2], m: ds[3], s: ds[4], q: ds[5] },
    what: { th: tv.th, en: tv.en },
    who: { th: wv.th, en: wv.en },
    how: { th: hv.th, en: hv.en },
    layer: { th: mv.th, en: mv.en },
    where: { th: sv.th, en: sv.en },
    quality: { th: qv.th, en: qv.en },
    title: { th: tv.th + " → " + wv.th, en: tv.en + " → " + wv.en },
    body: { th: hv.th + " · " + mv.th + " · " + sv.th, en: hv.en + " · " + mv.en + " · " + sv.en },
    why: { th: tv.why + " " + wv.why, en: tv.why },
    criterion: { th: qv.criterion, en: qv.criterion },
    priority,
    covered: mods.length > 0,
    coverage: mods.map(m => m.name),
    roadmapRefs: Array.from(new Set(mods.flatMap(m => m.roadmap))).sort((a, b) => a - b),
  };
}

export function plmParse(code) {
  const s = String(code || "").replace(/[^0-9]/g, "");
  if (s.length !== 6) return null;
  return plmItem(parseInt(s, 10));
}

function matches(item, f) {
  if (!f) return true;
  for (const L of DIM_LETTERS) {
    const v = f[L];
    if (v !== undefined && v !== null && item.dims[L] !== v) return false;
  }
  if (f.onlyCovered && !item.covered) return false;
  if (f.onlyOpen && item.covered) return false;
  if (f.minPriority !== undefined && item.priority < f.minPriority) return false;
  return true;
}

/* Ranked (priority-descending) or index-order paged walk. Returns
   { rows, nextOffset, exhausted } — pass nextOffset back in to continue. */
export function plmRank({ offset = 0, limit = 25, sort = "rank", filter = null } = {}) {
  ensureCompiled();
  const rows = [];
  let skip = Math.max(0, Math.floor(offset));
  if (sort === "index") {
    for (let i = skip; i < PLM_TOTAL; i++) {
      const it = plmItem(i);
      if (!matches(it, filter)) continue;
      rows.push(it);
      if (rows.length >= limit) {
        const nextOffset = i + 1 < PLM_TOTAL ? i + 1 : null;
        return { rows, nextOffset, exhausted: nextOffset === null };
      }
    }
    return { rows, nextOffset: null, exhausted: true };
  }
  // rank walk: buckets high → low, indices in order
  let seen = 0;
  for (let p = MAX_PRIORITY; p >= 0; p--) {
    const bucket = _buckets[p];
    for (let bi = 0; bi < bucket.length; bi++) {
      const it = plmItem(bucket[bi]);
      if (!matches(it, filter)) continue;
      if (seen < skip) { seen++; continue; }
      rows.push(it);
      if (rows.length >= limit) {
        const nextOffset = seen + 1;
        return { rows, nextOffset, exhausted: false };
      }
      seen++;
    }
  }
  return { rows, nextOffset: null, exhausted: true };
}

/* deterministic sample (mulberry32) — stable audit picks for a given seed */
export function plmSample(seed = 42) {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return plmItem(Math.floor(rnd() * PLM_TOTAL));
}

let _stats = null;
export function plmStats() {
  ensureCompiled();
  if (_stats) return _stats;
  /* each started (t,m,s) route fixes w,h,q freely → 1,000 cells */
  let started = 0;
  for (const mods of ROUTES.values()) {
    if (mods.length) started += 1000;
  }
  const byDim = PLM_DIMENSIONS.map((d, di) => {
    const touched = new Array(10).fill(false);
    if (di === 0 || di === 3 || di === 4) {
      for (const key of ROUTES.keys()) {
        const parts = key.split(":");
        const v = parseInt(parts[di === 0 ? 0 : di === 3 ? 1 : 2], 10);
        touched[v] = true;
      }
    } else {
      // WHO / HOW / QUALITY are free on every started route → all touched
      if (ROUTES.size > 0) for (let v = 0; v < 10; v++) touched[v] = true;
    }
    return { id: d.id, icon: d.icon, th: d.th, en: d.en, touched: touched.filter(Boolean).length, of: 10 };
  });
  const buckets = [];
  for (let p = MAX_PRIORITY; p >= 0; p--) buckets.push({ p, count: _buckets[p].length });
  _stats = {
    total: PLM_TOTAL,
    started,
    open: PLM_TOTAL - started,
    startedPct: Math.round((started / PLM_TOTAL) * 10000) / 100,
    buckets,
    byDim,
    modules: COVERAGE_MODULES.map(m => ({
      name: m.name,
      roadmap: m.roadmap,
      cells: (m.ts || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).length *
             (m.ms || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).length *
             (m.ss || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).length * 1000,
    })),
  };
  return _stats;
}

export const PLM_LETTERS = DIM_LETTERS;
export const PLM_MAX_PRIORITY = MAX_PRIORITY;
