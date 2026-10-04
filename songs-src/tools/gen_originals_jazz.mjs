/* gen_originals_jazz.mjs — 500 JAZZ & BLUES pieces for the Original Content shelf.

     node songs-src/tools/gen_originals_jazz.mjs            # 500 pieces
     node songs-src/tools/gen_originals_jazz.mjs --count=500 --out=songs-src/originals
     node songs-src/tools/gen_originals_jazz.mjs --style=blues --count=200   # one style only

   WHY THIS IS A SECOND FILE AND NOT A FLAG ON gen_originals.mjs
   The general generator writes tonal pieces: a diatonic walk, a chord tone on every strong
   beat, a half close on the dominant. That is the right rule for the other hundred thousand
   pieces and it is wrong for this music. A blues head lives on the b5 and the #4 — notes that
   are NOT in the mode — and a bebop line approaches its target chromatically from both sides.
   A shuffle eighth is not an even eighth. A walking bass climbs by fourths. None of that can be
   expressed by adding a row to a table in the general generator without making the rules
   conditional in every place they are read, and the general generator's output is frozen at
   100,000 pieces that a reviewer can regenerate byte-for-byte. This file is therefore a
   separate composer: same file format, same ids, same measured level, same verifier
   (scripts/verify-originals.mjs), same determinism rule — piece n is a pure function of n.

   NOTHING IS COPIED
   No motif, phrase or bar of any existing piece is an input. Every note comes from the mode
   of the key, the triad of the current chord, the blue notes of the style, and ordinary
   jazz voice-leading rules. The notes of the six jazz pieces already in the bundle, and the
   signatures of all 100,000 existing originals, are loaded and rejected at the draw, so a
   new piece can never be the same tune as one already in the library.

   WHAT "JAZZ & BLUES" MEANS HERE, HONESTLY
   Three idioms, all single-line and playable on one piano with two hands:

     blues  a 12-bar (or 8-bar) blues: I I IV I V IV I I IV IV V IV. The head states the
            theme and a walking line answers it — four quarters a bar, mostly stepwise, with
            a chromatic approach into the next chord. Shuffle eighths (written long-short,
            0.75 + 0.25) carry the swing on a quarter-note pulse.
     swing  a ii–V–I or a turnaround in mixolydian / dorian / major, with bebop enclosures
            (approach the target from a step above AND a step below) and the same shuffle.
     bossa  a two-beat bar, mostly sixteenths, a softer tempo — the one idiom here that is
            not a swing at all.

   BLUE NOTES ARE THE POINT, NOT A CHEAT
   The b5 and the #4 are outside the declared mode, and scripts/verify-originals.mjs requires
   85% of a piece's notes to be inside it. So a piece spends at most BLUE_BUDGET of its notes
   outside the mode, and the composer counts them as it writes: over budget, the draw is
   thrown away. A blues head that spends a third of its notes on blue notes is what blues IS;
   a piece that spends one in twelve is a shuffle tune with a blues accent. Both are honest,
   and the budget is written down here rather than left to chance. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { levelOf } from "../../scripts/build-songs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* ── notes: sharps only, exactly as the app's own key table ────────────────────── */
const SHARP_PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (n) => { const m = /^([A-G]#?)([0-9])$/.exec(n); return m ? 12 * (+m[2] + 1) + PCN[m[1][0]] + (m[1].length === 2 ? 1 : 0) : null; };
const nameOf = (m) => SHARP_PC[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

/* the seven modes scripts/verify-originals.mjs knows — a piece must declare one of these */
const MODES = {
  "major":          [0, 2, 4, 5, 7, 9, 11],
  "natural minor":  [0, 2, 3, 5, 7, 8, 10],
  "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
  "dorian":         [0, 2, 3, 5, 7, 9, 10],
  "mixolydian":     [0, 2, 4, 5, 7, 9, 10],
  "lydian":         [0, 2, 4, 6, 7, 9, 11],
  "phrygian":       [0, 1, 3, 5, 7, 8, 10],
};

/* The blue notes of each mode, in semitones from the tonic. b5 and #4 are the two the
   tradition actually uses; the flat 7 on a major is a passing note toward the mixolydian
   the blues is built on, so it is allowed but sparingly (see BLUE_WEIGHT). */
const BLUE_NOTES = {
  "major":          [{ pc: 6, w: 0.5 }, { pc: 10, w: 0.3 }],
  "mixolydian":     [{ pc: 6, w: 1.0 }, { pc: 1, w: 0.35 }],
  "dorian":         [{ pc: 6, w: 0.8 }, { pc: 1, w: 0.35 }],
  "natural minor":  [{ pc: 6, w: 0.9 }, { pc: 8, w: 0.4 }],
  "harmonic minor": [{ pc: 6, w: 0.6 }, { pc: 8, w: 0.3 }],
  "lydian":         [{ pc: 1, w: 0.6 }, { pc: 10, w: 0.3 }],
  "phrygian":       [{ pc: 6, w: 0.6 }, { pc: 8, w: 0.3 }],
};

/* how much of a piece may sit outside its mode. verify-originals.mjs fails under 85%;
   12% leaves a margin so a piece never sits one note under the line. */
const BLUE_BUDGET = 0.12;

/* ── rhythm banks ────────────────────────────────────────────────────────────────
   Every pattern is a list of note lengths in BEATS. The composer only ever uses a pattern
   whose lengths add up to exactly the bar it is filling, so the bar arithmetic cannot come
   out wrong; a bar with no pattern of its own (a one-beat pickup in 2/4, say) is filled
   with the longest values that still divide it, which is what a player writes there. */
const RHYTHM = {
  /* shuffle eighths are written long-short: 0.75 then 0.25 of a beat, never 0.5 + 0.5 */
  blues: {
    "4/4": [[1, 1, 1, 1], [1, 1, 0.75, 0.25], [0.75, 0.25, 1, 1], [1, 1, 2], [0.75, 0.25, 0.75, 0.25, 1, 1],
            [2, 1, 1], [1, 1, 1, 0.5, 0.5], [0.5, 0.5, 1, 1, 1], [1, 2, 1], [3, 1],
            [0.75, 0.25, 2, 1], [1, 0.75, 0.25, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 1]],
    "3/4": [[1, 1, 1], [2, 1], [1, 2], [0.75, 0.25, 2], [1, 0.75, 0.25], [0.5, 0.5, 2], [0.75, 0.25, 0.75, 0.25, 1]],
  },
  swing: {
    "4/4": [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [1, 1, 1, 0.5, 0.5], [0.75, 0.25, 0.75, 0.25, 2],
            [1, 0.75, 0.25, 2], [0.75, 0.25, 2, 1], [2, 0.75, 0.25, 1], [0.5, 0.5, 0.5, 0.5, 1, 1],
            [1, 0.5, 0.5, 1, 1], [0.25, 0.25, 0.5, 0.5, 1, 1], [3, 1], [1, 3], [0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 1]],
    "3/4": [[1, 1, 1], [2, 1], [1, 2], [0.75, 0.25, 2], [1, 0.75, 0.25], [2, 0.5, 0.5], [0.5, 0.5, 1], [1, 0.5, 0.5]],
  },
  bossa: {
    "2/4": [[0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25], [1, 0.25, 0.25, 0.25, 0.25], [0.5, 0.5, 0.5, 0.5],
            [0.75, 0.25, 0.5, 0.5], [0.25, 0.25, 0.5, 1], [1, 1], [0.25, 0.25, 0.5, 0.25, 0.5, 0.25],
            [0.5, 0.25, 0.25, 0.5, 0.5], [0.75, 0.25, 0.25, 0.25, 0.5], [0.25, 0.25, 1, 0.5], [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5]],
    "4/4": [[1, 1, 1, 1], [1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [0.75, 0.25, 0.5, 0.5, 1, 1],
            [1, 1, 0.5, 0.5, 1], [0.25, 0.25, 0.5, 0.5, 1, 1], [2, 1, 1]],
  },
};

/* ── the forms ─────────────────────────────────────────────────────────────────────
   Scale degrees, 0 = tonic. These are the shapes this music actually uses; a piece picks
   one and walks it for its whole length, which is what makes a 12-bar a 12-bar. */
const FORMS = {
  /* the blues: I I IV I V IV I I IV IV V IV */
  blues12: [0, 0, 3, 0, 5, 3, 0, 0, 3, 3, 5, 3],
  /* a slow eight-bar: I I IV I V IV I V */
  blues8: [0, 0, 3, 0, 5, 3, 0, 5],
  /* the minor blues: i i iv i v iv i i iv iv v i */
  minor12: [0, 0, 3, 0, 4, 3, 0, 0, 3, 3, 4, 0],
  /* a shuffle in mixolydian: I bVII IV */
  shuffle: [0, 6, 0, 3, 0, 6, 5, 3],
  /* ii–V–I and its turnarounds */
  twoFiveOne: [0, 3, 4, 0],
  twoFiveOneTurn: [4, 3, 0, 4, 0, 0],
  minorTwoFive: [0, 5, 0, 4],
  /* bossa nova */
  bossa1: [0, 3, 4, 0],
  bossa2: [0, 5, 1, 0],
  bossaTurn: [0, 0, 4, 3, 0],
};

/* the style table: what each idiom draws from */
const STYLE = {
  blues: {
    weights: 40,
    meters: ["4/4", "4/4", "4/4", "3/4"],
    bars: [12, 12, 12, 8],
    tempo: [58, 132],
    /* mixolydian is the dominant blues; natural minor the minor blues; major the
       bright shuffle; dorian the blues that leans forward */
    keys: ["C", "G", "D", "A", "E", "Bb", "F", "A#", "D#", "Eb", "Ab", "F#", "B"],
    modes: ["mixolydian", "mixolydian", "natural minor", "natural minor", "major", "dorian"],
    forms: { mixolydian: ["blues12", "blues8", "shuffle"], "natural minor": ["minor12", "blues8"], major: ["blues12", "shuffle"], dorian: ["minor12", "shuffle"] },
    walking: 0.45,     // how often a bar is a walking bass bar instead of the head
    blueOdds: 0.42,    // chance a given note position is spent on a blue note
    swingOdds: 0.55,   // chance a bar uses shuffle eighths rather than quarters
    enclosure: 0.0,    // bebop enclosures are a bebop device, not a blues one
  },
  swing: {
    weights: 40,
    meters: ["4/4", "4/4", "4/4", "3/4"],
    bars: [8, 8, 12, 16],
    tempo: [96, 140],
    keys: ["C", "G", "D", "F", "Bb", "Eb", "A", "D#", "A#", "E", "Ab", "B"],
    modes: ["mixolydian", "mixolydian", "dorian", "dorian", "major", "natural minor"],
    forms: { mixolydian: ["twoFiveOne", "twoFiveOneTurn", "shuffle"], dorian: ["twoFiveOne", "twoFiveOneTurn"], major: ["twoFiveOne", "twoFiveOneTurn"], "natural minor": ["minorTwoFive", "twoFiveOneTurn"] },
    walking: 0.25,
    blueOdds: 0.16,
    swingOdds: 0.75,
    enclosure: 0.28,   // approach the target from a step above and a step below
  },
  bossa: {
    weights: 20,
    meters: ["2/4", "2/4", "4/4"],
    bars: [8, 8, 16, 12],
    tempo: [88, 132],
    keys: ["C", "G", "D", "A", "E", "F", "Bb", "Eb", "Ab", "D#", "A#"],
    modes: ["natural minor", "dorian", "dorian", "major"],
    forms: { "natural minor": ["bossa1", "bossa2", "bossaTurn"], dorian: ["bossa1", "bossaTurn"], major: ["bossa1", "bossaTurn"] },
    walking: 0.0,
    blueOdds: 0.05,
    swingOdds: 0.0,    // a bossa is not a swing
    enclosure: 0.10,
  },
};

/* ── seeded PRNG ────────────────────────────────────────────────────────────────
   mulberry32, the same generator gen_originals.mjs uses, so the two files behave the same
   way: the same index walks the same path on any machine and any Node version. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash32 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const rint = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/* the fingerprint scripts/verify-originals.mjs uses — the first twelve notes and the
   interval between each and the next, skipped when the head has under three pitch classes */
const signatureOf = (notes) => {
  if (new Set(notes.map(n => midiOf(n) % 12)).size < 3) return null;
  const head = notes.slice(0, 12);
  return head.join(" ") + "|" + head.slice(1).map((n, i) => midiOf(n) - midiOf(head[i])).join(",");
};

/* ── titles ───────────────────────────────────────────────────────────────────────
   Every idea is ONE row carrying its Thai, English and Chinese form together, so a title
   is the same picture in three languages rather than three translations of a template.
   The words are night-and-blueprint vocabulary — the hour, the street, the instrument, the
   room — which is where this music lives, and they are a different bank from the general
   generator's, so a blues title cannot collide with one of the hundred thousand. */
const MOOD_RAW = [ // [th, en, zh] — a colour or a temperature
  ["เงียวสงบ", "Hushed", "静谧"], ["คึกคัก", "Lively", "热闹"], ["อบอุ่น", "Warm", "温暖"],
  ["เย็นชา", "Cool", "清凉"], ["คลุมเครือ", "Smoky", "朦胧"], ["ดิบๆ", "Raw", "生涩"],
  ["หวานเฝ้า", "Sweet", "甜美"], ["เปรียว", "Tangy", "微酸"], ["มืดหม่น", "Dim", "昏暗"],
  ["แจ่วใส", "Clear", "清朗"], ["เหงา", "Lonely", "孤独"], ["หนักแน่น", "Heavy", "厚重"],
  ["คล่องไหล", "Easy", "流畅"], ["ช้าเชื่อง", "Slow", "迟缓"], ["ดิบกล้า", "Bold", "豪放"],
  ["เงามัน", "Shiny", "闪亮"], ["ลึกลับ", "Deep", "幽深"], ["เบาบาง", "Tender", "温柔"],
  ["ดุดัน", "Rough", "粗粝"], ["นิ่ง", "Still", "静立"], ["กระซับ", "Tight", "紧凑"],
  ["ร้อนรุน", "Hot", "火热"], ["เย็นตัว", "Cool Off", "转凉"], ["ขอบฟ้า", "Horizon", "地平"],
  ["ดึงดูด", "Haunting", "萦绕"], ["เปล่งประกาย", "Luminous", "明亮"], ["พลิกลูกหนอน", "Restless", "躁动"],
  ["เงาสัมผัส", "Tender Shade", "柔影"], ["ปลายฤดู", "Late Season", "季末"],
];
const THING_RAW = [ // the things a blues night is made of
  ["แซกโซโฟน", "Saxophone", "萨克斯"], ["ทรัมปีต", "Trumpet", "小号"], ["เปียโน", "Piano", "钢琴"],
  ["คอนทราบัส", "Bass", "贝斯"], ["กลอง", "Drums", "鼓"], ["ท่อนชูต", "Shuffle", "摇摆"],
  ["ท่อนร้อง", "Chorus", "副歌"], ["กรุ๊ป", "Groove", "律动"], ["คอร์ด", "Chord", "和弦"],
  ["โน้ตบลูส", "Blue Note", "蓝调音"], ["สะพาน", "Bridge", "桥段"], ["ห้องซ้อม", "Rehearsal Room", "排练室"],
  ["เวที", "Stage", "舞台"], ["ห้องแสงน้ำเงิน", "Blue Room", "蓝调房间"], ["หน้าต่าง", "Window", "窗户"],
  ["เงาสะท้อน", "Reflection", "倒影"], ["ไฟ", "Fire", "火光"], ["ฝน", "Rain", "雨"],
  ["เมฆ", "Cloud", "云"], ["เมือง", "City", "城市"], ["ถนน", "Street", "街道"], ["สะพานลำเลียง", "Overpass", "高架桥"],
  ["ตลาด", "Market", "市场"], ["สถานี", "Station", "车站"], ["ท่าเรือ", "Harbour", "港口"],
  ["ถ้ำ", "Cellar", "地窖"], ["ลานเต้น", "Dance Floor", "舞池"], ["หลังฉาก", "Backstage", "后台"],
  ["ดนตรี", "Music", "音乐"], ["เงียบ", "Silence", "寂静"], ["คืน", "Night", "夜"],
  ["สายฝน", "Rainfall", "雨季"], ["เงา", "Shadow", "影子"], ["หัวใจ", "Heart", "心"],
  ["คืนเก่า", "Old Night", "旧夜"], ["รถไฟ", "Train", "火车"], ["เรือ", "Boat", "小船"],
];
const PLACE_RAW = [ // [en, th, zh] — an English place phrase carries its own preposition
  ["at the Corner", "ที่มุมถนน", "街角"], ["at Midnight", "ตอนเที่ยงคืน", "午夜"],
  ["Down the Alley", "ตามตรอก", "巷子深处"], ["at the Corner Bar", "ที่บาร์มุมถนน", "街角酒吧"],
  ["by the River", "ริมแม่น้ำ", "河边"], ["on the Rooftop", "บนดาดฟ้า", "屋顶"],
  ["in the Blue Hour", "ยามฟ้าสีคราม", "蓝调时刻"], ["after the Last Set", "หลังเซ็ตสุดท้าย", "末场之后"],
  ["on the Late Train", "บนรถไฟสายดึก", "末班列车上"], ["under Bridge Lights", "ใต้ไฟสะพาน", "桥灯之下"],
  ["at the Harbour", "ที่ท่าเรือ", "港口"], ["in an Empty Room", "ในห้องว่าง", "空荡的房间里"],
  ["on a Rainy Street", "บนถนนฝนตก", "雨中的街"], ["in the Late Market", "ที่ตลาดดึก", "深夜市场"],
  ["by the Old Piano", "ข้างเปียโนเก่า", "旧钢琴旁"], ["at the Corner Table", "ที่โต๊ะมุม", "角落的桌"],
  ["where the Band Waits", "ที่ที่วงดนตรีรอ", "乐队等候处"], ["Past the Last Train", "หลังรถไฟสุดท้าย", "末班车之后"],
  ["in the Blue Smoke", "ในควันสีคราม", "蓝烟之中"], ["on a Sleepless Night", "ในคืนไร้นอน", "无眠的夜里"],
  ["at the Water's Edge", "ที่ริมน้ำ", "水边"], ["in the Rehearsal Room", "ในห้องซ้อม", "排练室里"],
  ["on a Slow Morning", "ในเช้าที่ช้า", "迟缓的早晨"], ["at the City Limit", "ที่ขอบเมือง", "城市尽头"],
  ["under a Street Lamp", "ใต้โคมไฟ", "路灯之下"], ["in the Second Set", "ในเซ็ตที่สอง", "第二场之中"],
];

/* Each idea is one row carrying its three languages together; a title reads a row by name,
   not by position, so the languages cannot drift apart. PLACE rows are written
   [en, th, zh] because an English place phrase carries its own preposition. */
const rowOf = (r) => r.map(([th, en, zh]) => ({ th, en, zh }));
const MOOD = rowOf(MOOD_RAW), THING = rowOf(THING_RAW);
const PLACE = PLACE_RAW.map(([en, th, zh]) => ({ th, en, zh }));

/* Titles are ENUMERATED, not sampled, each form with its own counter, so no two are the
   same string by construction (the same rule the general generator follows). */
const formCount = [0, 0, 0];
function titleFor(n) {
  const M = MOOD.length, N = THING.length, P = PLACE.length;
  const form = n % 3;
  const p = formCount[form]++;
  if (form === 0) {                    // colour + thing
    const m = MOOD[p % M], t = THING[Math.floor(p / M) % N];
    return { th: `${t.th}${m.th}`, en: `${m.en} ${t.en}`, zh: `${m.zh}${t.zh}` };
  }
  if (form === 1) {                    // colour + thing + place
    const m = MOOD[p % M], t = THING[Math.floor(p / M) % N], pl = PLACE[Math.floor(p / (M * N)) % P];
    return { th: `${t.th}${m.th}${pl.th}`, en: `${m.en} ${t.en} ${pl.en}`, zh: `${pl.zh}${m.zh}${t.zh}` };
  }
  const t = THING[p % N], pl = PLACE[Math.floor(p / N) % P];   // thing + place
  return { th: `${t.th}${pl.th}`, en: `${t.en} ${pl.en}`, zh: `${pl.zh}${t.zh}` };
}

/* ── the pitch window ──────────────────────────────────────────────────────────────
   The app draws C4..B5 and nothing else, so every piece lives inside it. */
const LO = 60, HI = 83;

function scaleMidis(tonicPc, mode) {
  const steps = MODES[mode];
  const out = [];
  for (let oct = 3; oct <= 6; oct++) for (const s of steps) out.push(tonicPc + s + oct * 12);
  return [...new Set(out)].sort((a, b) => a - b);
}

/* Compose one piece. Returns null when the draw produced something the rules will not
   accept; the caller counts the reason and draws again. */
function compose(idx, rnd) {
  /* the style is fixed by the piece's index, not drawn, so the shelf's mix of blues /
     swing / bossa is the same on every machine */
  const names = Object.keys(STYLE);
  const total = names.reduce((a, k) => a + STYLE[k].weights, 0);
  let acc = 0, styleName = names[names.length - 1];
  for (const k of names) { acc += STYLE[k].weights; if ((idx % total) < acc) { styleName = k; break; } }
  const S = STYLE[styleName];

  const keyName = pick(rnd, S.keys);
  const mode = pick(rnd, S.modes);
  const meter = pick(rnd, S.meters);
  const bpb = parseInt(meter, 10);
  const tonicPc = ((PCN[keyName[0]] + (keyName.length > 1 ? (keyName[1] === "#" ? 1 : -1) : 0)) % 12 + 12) % 12;
  const scale = scaleMidis(tonicPc, mode);
  const modeSet = new Set(MODES[mode].map(s => (tonicPc + s) % 12));
  const blues = BLUE_NOTES[mode];

  const totalBars = pick(rnd, S.bars);
  const bpm = rint(rnd, S.tempo[0], S.tempo[1]);
  const pickup = rnd() < 0.35 ? (rint(rnd, 1, bpb - 1)) : 0;

  const formName = pick(rnd, S.forms[mode] || S.forms[Object.keys(S.forms)[0]]);
  const form = FORMS[formName];
  const chordAt = (bar) => form[(bar - (pickup ? 1 : 0)) % form.length];

  /* the triad on a degree, as pitch classes — what a melody should favour on a strong beat.
     A jazz triad is a seventh chord here: the seventh is what makes a line sound played
     rather than spelled, and it is a mode note in every mode these pieces use. */
  const chordTones = (deg) => {
    const steps = MODES[mode];
    const at = (k) => steps[((deg + k) % steps.length + steps.length) % steps.length];
    return new Set([0, 2, 4, 6].map(k => ((tonicPc + at(deg + k)) % 12 + 12) % 12));
  };

  const inKb = scale.filter(m => m >= LO && m <= HI);
  if (inKb.length < 4) return null;
  /* the register: a comfortable centre, and the window the line may use, always with the
     tonic inside it — a piece whose home note is outside the window ends on the wrong note */
  const centre = 67 + rint(rnd, -3, 3);
  const span = rint(rnd, 10, 15);
  let lo = Math.max(LO, centre - Math.floor(span / 2));
  let hi = Math.min(HI, centre + Math.ceil(span / 2));
  const tonicPitch = tonicPc + 60;
  if (tonicPitch < lo) lo = tonicPitch;
  if (tonicPitch > hi) hi = tonicPitch;
  if (inKb.filter(m => m >= lo && m <= hi).length < 4) { lo = inKb[0]; hi = inKb[inKb.length - 1]; }
  const inRange = (m) => m >= lo && m <= hi;

  /* the nearest pitch of a given pitch class inside the window — how a blue note or a
     chromatic approach keeps the same register the line is already in */
  const pitchOfPc = (pc, from) => {
    const oct = Math.round((from - pc) / 12);
    let best = null;
    for (let o = oct - 1; o <= oct + 1; o++) {
      const cand = pc + o * 12;
      if (!inRange(cand)) continue;
      if (best == null || Math.abs(cand - from) < Math.abs(best - from)) best = cand;
    }
    if (best == null) { const c = inKb.find(m => ((m % 12) + 12) % 12 === pc && m >= lo && m <= hi); if (c == null) return null; best = c; }
    return best;
  };
  /* a step along the mode from where we are, staying in the window */
  const stepNear = (from, dir) => {
    let i = scale.findIndex(s => s === from);
    if (i < 0) {
      const alt = scale.filter(m => inRange(m)).sort((a, b) => Math.abs(a - from) - Math.abs(b - from))[0];
      return alt == null ? nearest(from) : alt;
    }
    let j = i + dir;
    while (j >= 0 && j < scale.length && !inRange(scale[j])) j += dir;
    return (j >= 0 && j < scale.length) ? scale[j] : nearest(from);
  };
  const nearest = (m) => {
    let best = inKb[0];
    for (const c of inKb) if (Math.abs(c - m) < Math.abs(best - m)) best = c;
    return best;
  };
  /* a semitone step either way, used by the bebop enclosure and the walking approach */
  const semiNear = (from, dir) => {
    const cand = from + dir;
    return inRange(cand) ? cand : nearest(from);
  };

  /* the note budget: a piece may not spend more than BLUE_BUDGET of its notes outside the
     mode, or scripts/verify-originals.mjs refuses it (and rightly so) */
  let blueUsed = 0, notes = 0;
  const maySpendBlue = () => (blueUsed + 1) <= Math.ceil(BLUE_BUDGET * 170);

  const bank = RHYTHM[styleName][meter] || RHYTHM[styleName]["4/4"];
  const bars = [];
  let cur = nearest(tonicPitch);
  let run = 0;   // how long the line has sat on one pitch

  for (let b = 0; b < totalBars; b++) {
    const beats = (b === 0 && pickup) ? pickup : bpb;
    const tones = chordTones(chordAt(b));
    const isLast = b === totalBars - 1;

    /* the pattern for this bar: only one whose lengths add up to it exactly. The style's
       swingOdds decides whether the bar leans on shuffle eighths (a pattern holding a 0.75)
       or on plain values — that is the whole difference between a slow blues and a shuffle,
       and it is a choice about the bar, not about each note */
    const sum = (p) => p.reduce((a, x) => a + x, 0);
    const fitting = bank.filter(p => sum(p) === beats);
    const shuffly = fitting.filter(p => p.some(x => x === 0.75));
    let pats = (S.swingOdds > 0 && rnd() < S.swingOdds && shuffly.length) ? shuffly : fitting;
    if (!pats.length) {
      const flat = []; let left = beats;
      for (const unit of [2, 1, 0.5]) { while (left >= unit) { flat.push(unit); left = +(left - unit).toFixed(4); if (left < unit) break; } }
      if (left > 0) flat.push(left);
      pats = [flat.length ? flat : [beats]];
    }
    const pattern = pick(rnd, pats);

    /* a walking bar: four quarters climbing by step into the next chord, which is what a
       bass player does under a blues head and is the one thing a single-line player can
       actually learn from */
    const walking = S.walking > 0 && b > 0 && !isLast && rnd() < S.walking && pattern.every(x => x === 1) && bpb === 4;
    if (walking) {
      const toks = [];
      /* a seventh chord: root, third, fifth, seventh — the degrees are what a walking line
         actually uses, and the seventh is what stops the line sounding like an exercise */
      const degrees = [0, 2, 4, 6];
      let p = cur;
      for (let i = 0; i < 4; i++) {
        const want = i === 0 ? degrees[0] : pick(rnd, degrees);
        const c = pitchOfPc(((tonicPc + MODES[mode][(((chordAt(b) + want) % 7 + 7) % 7)]) % 12), p);
        /* the fourth quarter leans a chromatic step above where the next bar lands — the
           approach note is what makes the line walk rather than hop */
        const cand = i === 3 ? semiNear(c, rnd() < 0.5 ? -1 : 1) : c;
        const n = (cand == null || !modeSet.has(((cand % 12) + 12) % 12)) ? c : cand;
        const final = (n == null) ? nearest(p + 2) : n;
        if (!inRange(final)) continue;
        toks.push(nameOf(final) + ":1"); p = final; notes++; blueUsed += modeSet.has(((final % 12) + 12) % 12) ? 0 : 1;
      }
      if (toks.length === 4) { cur = midiOf(toks[3].split(":")[0]); run = 1; bars.push(toks.join(" ")); continue; }
      /* fall through to the head if the walk could not be written this bar */
    }

    let pos = 0; const toks = [];
    /* how many times in a row the line has repeated the pitch it is on, and the nearest
       chord tone of the bar (kept outside the branch that computes it, because the repeat
       guard below needs it too) */
    const candsAll = [...tones].map(pc => pitchOfPc(pc, cur)).filter(x => x != null && inRange(x));
    let near2 = candsAll.length ? candsAll.reduce((a, b2) => (Math.abs(b2 - cur) < Math.abs(a - cur) ? b2 : a)) : null;
    for (let i = 0; i < pattern.length; i++) {
      const d = pattern[i];
      const onBeat = Math.abs(pos % 1) < 1e-9;
      const strong = onBeat && (pos === 0 || (bpb === 4 && pos === 2) || pos === bpb - 1);
      const last = i === pattern.length - 1;

      /* the last bar closes on the tonic: leading tone up, then home, sharing the slot */
      if (isLast && last) {
        const head = d >= 2 ? Math.floor(d / 2 * 4) / 4 : 0;
        if (head > 0) {
          const lt = nearest(tonicPc + 60 + MODES[mode][6]);
          toks.push(nameOf(lt) + ":" + head); cur = lt; notes++; pos += head;
        }
        const tonic = nearest(tonicPc + 60);
        toks.push(nameOf(tonic) + ":" + +(d - head).toFixed(4)); cur = tonic; notes++;
        pos += d - head;
        continue;
      }
      /* a breath, never on the downbeat and never in the closing bar */
      if (d >= 1 && onBeat && pos > 0 && !isLast && rnd() < 0.06) { toks.push("R:" + d); pos += d; continue; }

      let next = null;
      const roll = rnd();

      /* 1. a blue note — the b5 or the #4, taken where a blues line takes it: on a weak
            beat, moving, and never more often than the budget allows */
      if (S.blueOdds > 0 && roll < S.blueOdds && maySpendBlue() && !strong) {
        /* weighted choice among the mode's blue notes */
        const totalW = blues.reduce((a, b) => a + b.w, 0);
        let t2 = rnd() * totalW, pickPc = blues[blues.length - 1].pc;
        for (const bn of blues) { if (t2 < bn.w) { pickPc = bn.pc; break; } t2 -= bn.w; }
        const cand = pitchOfPc((tonicPc + pickPc) % 12, cur);
        if (cand != null && inRange(cand)) {
          /* a blue note is taken BY STEP and it has to be outside the mode to be one at all */
          next = Math.abs(cand - cur) <= 3 ? cand : semiNear(cand, cur > cand ? -1 : 1);
          if (next != null && modeSet.has(((next % 12) + 12) % 12)) next = null;
        }
      }
      /* 2. a bebop approach — the last note before the next bar's chord tone sits a
            semitone below it, so the bar line lands with the line's weight on it */
      else if (S.enclosure > 0 && roll < S.blueOdds + S.enclosure && last && !isLast) {
        const nextTones = chordTones(chordAt(b + 1));
        const tgt = [...nextTones].map(pc => pitchOfPc(pc, cur)).filter(x => x != null && inRange(x))
          .sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur))[0];
        if (tgt != null) {
          const below = tgt - 1, above = tgt + 1;
          const side = Math.abs(below - cur) <= Math.abs(above - cur) ? below : above;
          if (inRange(side)) next = side;
        }
      }
      /* 3. a chord tone where the harmony is, a step where it is not: the first beat of a
            bar states the chord's root, the other strong beats take the nearest chord tone
            most of the time, and everything else walks the mode. This is the rule that
            makes a line sit ON the changes — get it wrong and the piece is scales with a
            tempo, which is exactly what the hundred thousand pieces are already. */
      else {
        const cands = [...tones].map(pc => pitchOfPc(pc, cur)).filter(x => x != null && inRange(x));
        const near = cands.length ? cands.reduce((a, b2) => (Math.abs(b2 - cur) < Math.abs(a - cur) ? b2 : a)) : null;
        if (strong && onBeat && pos === 0) {
          const root = pitchOfPc((tonicPc + MODES[mode][(((chordAt(b) % 7) + 7) % 7)]) % 12, cur);
          next = (root != null && inRange(root) && rnd() < 0.8) ? root : (near || stepNear(cur, rnd() < 0.5 ? -1 : 1));
        } else if (strong) {
          next = (near != null && rnd() < 0.75) ? near : stepNear(cur, rnd() < 0.5 ? -1 : 1);
        } else if (near != null && rnd() < (onBeat ? 0.5 : 0.2)) {
          next = near;
        } else {
          next = stepNear(cur, rnd() < 0.5 ? -1 : 1);
        }
      }
      if (next == null || !inRange(next)) next = stepNear(cur, rnd() < 0.5 ? -1 : 1);
      /* never the tritone as a melodic leap, and never a leap the window does not hold */
      if (Math.abs(next - cur) === 6 || Math.abs(next - cur) > 7) next = stepNear(cur, rnd() < 0.5 ? -1 : 1);
      /* three of the same note in a row stops sounding like a line — the third one steps */
      if (next === cur && run >= 2 && !strong) next = stepNear(cur, rnd() < 0.5 ? -1 : 1);
      if (next === cur && run >= 2 && strong) next = near2 || stepNear(cur, rnd() < 0.5 ? -1 : 1);
      if (next === cur && rnd() < 0.5) next = stepNear(cur, rnd() < 0.5 ? -1 : 1);
      run = next === cur ? run + 1 : 1;
      cur = next;
      notes++;
      blueUsed += modeSet.has(((cur % 12) + 12) % 12) ? 0 : 1;
      toks.push(nameOf(cur) + ":" + d);
      pos += d;
    }
    bars.push(toks.join(" "));
  }

  /* ── the gates, the same ones scripts/verify-originals.mjs re-derives ─────────────── */
  let totalBeats = 0, flat = [];
  for (const bar of bars) for (const t of bar.split(/\s+/).filter(Boolean)) {
    const d = +t.split(":")[1]; totalBeats += d;
    if (t.split(":")[0] !== "R") flat.push(t.split(":")[0]);
  }
  const secs = Math.round(totalBeats * 60 / bpm);
  if (notes < 20 || notes > 170) return null;
  if (secs < 14 || secs > 118) return null;
  if ((totalBeats % bpb) !== pickup) return null;
  if (flat.some(n => { const m = midiOf(n); return m < LO || m > HI; })) return null;
  const inMode = flat.filter(n => modeSet.has(((midiOf(n) % 12) + 12) % 12)).length / flat.length;
  if (inMode < 0.88) return null;                       // the verifier's own line is 85%
  const lastPc = ((midiOf(flat[flat.length - 1]) % 12) + 12) % 12;
  if (lastPc !== tonicPc && lastPc !== (tonicPc + 7) % 12) return null;

  return {
    id: `og_${String(ID_START + idx).padStart(6, "0")}`,
    era: "original", style: styleName, form: formName, key: keyName, mode, meter, bpm, pickup,
    bars, notes, level: levelOf({ bars, bpm }), sig: signatureOf(flat),
  };
}

/* the ids continue after the hundred thousand already on the shelf — six digits, which is
   what scripts/verify-originals.mjs checks, so og_100501 is the first jazz piece */
const ID_START = 100501;

/* ── what is already in the library ────────────────────────────────────────────────
   The titles and the tune fingerprints of every existing original, and of every song in
   the bundle, are loaded before the first draw: a jazz piece that reused a title or came
   out as the same tune as something already in the library would be a duplicate, and the
   only honest place to stop that is at the draw rather than after the file is written. */
async function existingLibrary() {
  const titles = { en: new Set(), th: new Set(), zh: new Set() };
  const sigs = new Set();
  const dir = path.join(ROOT, "songs-src", "originals");
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith("orig-") && f.endsWith(".json")).sort()) {
    for (const p of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
      for (const k of ["en", "th", "zh"]) titles[k].add(String(p[k] || "").toLowerCase());
      const flat = p.bars.join(" ").split(/\s+/).filter(Boolean).map(t => t.split(":")[0]).filter(n => n !== "R");
      const s = signatureOf(flat); if (s) sigs.add(s);
    }
  }
  /* and the songs that live in the bundle, through the same esbuild route
     verify-originals.mjs uses to reach songs-data.ts */
  const { build } = await import("esbuild");
  const { pathToFileURL } = await import("node:url");
  const r = await build({
    stdin: { contents: `import { SONGS } from "./songs-data"; export const S = SONGS.map(s => ({ seq: s.seq || [], en: s.en || "", th: s.th || "", zh: s.zh || "" }));`, resolveDir: ROOT, loader: "ts" },
    bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
  });
  const tmp = path.join(ROOT, "node_modules/.cache", "originals-jazz-app-songs.mjs");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, r.outputFiles[0].text);
  const { S } = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
  for (const s of S) {
    for (const k of ["en", "th", "zh"]) titles[k].add(String(s[k]).toLowerCase());
    const flat = (s.seq || []).filter(x => x[0] !== "R").map(x => x[0]);
    const sig = signatureOf(flat); if (sig) sigs.add(sig);
  }
  return { titles, sigs };
}

/* ── run ────────────────────────────────────────────────────────────────────────── */
async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? "1" : m[2]] : [a, "1"];
  }));
  const COUNT = parseInt(args.count || "500", 10);
  const OUT = path.resolve(ROOT, args.out || "songs-src/originals");
  const ONLY = args.style && STYLE[args.style] ? args.style : null;

  const lib = await existingLibrary();
  const seenTitle = { en: new Set(), th: new Set(), zh: new Set() };
  const seenSig = new Set();
  let rejected = { title: 0, tune: 0, rules: 0 };

  const pieces = [];
  let idx = 0, guard = 0;
  while (pieces.length < COUNT && guard < COUNT * 200) {
    /* both numbers are in the seed on purpose: a rejected draw must try a DIFFERENT piece,
       not replay the same one forever, and the attempt count is what makes it differ */
    const rnd = mulberry32(hash32("tiga-jazz-v1:" + idx + ":" + guard));
    const p = compose(idx, rnd);
    guard++; idx++;
    if (!p) { rejected.rules++; continue; }
    if (ONLY && p.style !== ONLY) continue;
    const t = titleFor(pieces.length);
    const key = (x) => String(x).toLowerCase();
    if (lib.titles.en.has(key(t.en)) || lib.titles.th.has(key(t.th)) || lib.titles.zh.has(key(t.zh))
      || seenTitle.en.has(key(t.en)) || seenTitle.th.has(key(t.th)) || seenTitle.zh.has(key(t.zh))) {
      rejected.title++; continue;
    }
    if (p.sig) {
      if (lib.sigs.has(p.sig) || seenSig.has(p.sig)) { rejected.tune++; continue; }
      seenSig.add(p.sig);
    }
    for (const k of ["en", "th", "zh"]) seenTitle[k].add(key(t[k]));
    const { sig, ...rest } = p;
    /* the id counts the piece, not the attempt, so the shelf reads og_100501 … og_101000
       with no gaps however many draws were thrown away on the way */
    rest.id = `og_${String(ID_START + pieces.length).padStart(6, "0")}`;
    pieces.push({ ...rest, en: t.en, th: t.th, zh: t.zh });
  }

  fs.mkdirSync(OUT, { recursive: true });
  const name = `jazz-${String(Math.floor(Math.max(0, pieces.length - 1) / 500)).padStart(3, "0")}.json`;
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(pieces));

  const byStyle = pieces.reduce((a, p) => (a[p.style] = (a[p.style] || 0) + 1, a), {});
  const byLevel = pieces.reduce((a, p) => (a[p.level] = (a[p.level] || 0) + 1, a), {});
  const bpm = pieces.reduce((a, p) => a + p.bpm, 0) / Math.max(1, pieces.length);
  console.log(`gen_originals_jazz: ${pieces.length} pieces -> ${path.relative(ROOT, OUT)}/${name}`);
  console.log(`  styles: ${Object.entries(byStyle).map(([k, v]) => `${k}=${v}`).join(" ")} · levels ${Object.entries(byLevel).map(([k, v]) => `${k}=${v}`).join(" ")} · avg ${Math.round(bpm)} bpm`);
  console.log(`  ids ${pieces[0] ? pieces[0].id : "—"} … ${pieces.length ? pieces[pieces.length - 1].id : "—"} · ${guard} attempts, rejected title=${rejected.title} tune=${rejected.tune} rules=${rejected.rules}`);
  console.log(`  examples: ${JSON.stringify(pieces.slice(0, 3).map(p => ({ id: p.id, style: p.style, form: p.form, en: p.en, th: p.th, zh: p.zh, key: p.key, mode: p.mode, meter: p.meter, bpm: p.bpm, bars: p.bars.length })))}`);
}
main();