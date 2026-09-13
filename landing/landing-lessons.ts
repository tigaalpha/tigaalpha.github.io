/* ── landing/landing-lessons.ts ──
   The four lessons behind the four example questions on marketing landing
   page 1.

   These answers are canned, not generated, and that is a deliberate product
   decision rather than a shortcut. Three reasons:

   1. The app's chat calls requireLogin("ai") for a guest, so wiring this page
      to the live model would put the sign-up wall in front of the very first
      tap — the exact failure this page exists to remove.
   2. An ad click on a congested mobile connection cannot afford a round trip
      to a model before anything happens. These land instantly, every time,
      including when the Edge Function is down.
   3. A stranger judging the product needs to see our BEST answer, not a
      sampled one. These four are written and checked; a generated answer is
      neither.

   The live model is what they sign up FOR — so the typed question at the end
   of the page is the thing that asks for an account, and these are free.

   Every `demo` plays on the real keyboard above the chat, so the claim
   "it explains AND shows you" is literally true on the page. Notes are the
   app's own names (C4 = middle C); `f` is the finger number drawn under a
   key while it sounds. ── */

export const LESSONS = [
  {
    id: "cmajor",
    chip: "🎼 สอน C major scale",
    ask: "สอน C major scale หน่อย",
    demoLabel: "C MAJOR SCALE",
    answer:
`**C major scale** คือบันไดเสียงพื้นฐานที่สุด และเป็นอันเดียวที่ **ใช้คีย์ขาวล้วน** ไม่มีคีย์ดำสักอัน

โน้ต 8 ตัว: **C D E F G A B C**
(โด เร มี ฟา ซอล ลา ที โด)

เคล็ดลับที่จะทำให้คุณจำได้ตลอดชีวิต — ระยะห่างของมันคือ
**เต็ม–เต็ม–ครึ่ง–เต็ม–เต็ม–เต็ม–ครึ่ง**

"ครึ่งเสียง" สองจุดนั้นอยู่ตรง **E→F** กับ **B→C** พอดี ซึ่งเป็นสองคู่เดียวบนคีย์บอร์ดที่ไม่มีคีย์ดำคั่นกลาง เลยไม่ต้องท่องเลย แค่มองก็เห็น

นิ้วมือขวา: **1-2-3** แล้ว **สอดนิ้วโป้งลอดใต้ฝ่ามือ** ไปเล่น F ต่อด้วย **1-2-3-4-5**

ดูคีย์บอร์ดข้างบนสิครับ ผมกำลังเล่นให้ดูทีละนิ้ว 👆`,
    demo: [
      { n: ["C4"], d: 400, f: { C4: 1 } },
      { n: ["D4"], d: 400, f: { D4: 2 } },
      { n: ["E4"], d: 400, f: { E4: 3 } },
      { n: ["F4"], d: 400, f: { F4: 1 } },
      { n: ["G4"], d: 400, f: { G4: 2 } },
      { n: ["A4"], d: 400, f: { A4: 3 } },
      { n: ["B4"], d: 400, f: { B4: 4 } },
      { n: ["C5"], d: 850, f: { C5: 5 } },
    ],
  },
  {
    id: "basics",
    chip: "🎹 สอน Piano ขั้นพื้นฐาน",
    ask: "สอน Piano ขั้นพื้นฐานให้หน่อย",
    demoLabel: "5-FINGER POSITION",
    answer:
`เริ่มจากสิ่งเดียวที่ต้องจำให้ได้ก่อนเลยครับ: **หา C ให้เจอ**

มองหากลุ่ม **คีย์ดำ 2 อัน** ที่ติดกัน — คีย์ขาวที่อยู่ **ทางซ้ายของกลุ่มนั้น** คือ **C** เสมอ ทั้งคีย์บอร์ด ไม่มีข้อยกเว้น ตัวที่อยู่กลางเปียโนเรียกว่า **middle C**

จากนั้นวางมือขวาห้านิ้วลงบน **C D E F G** — นี่เรียกว่า **ตำแหน่งห้านิ้ว (five-finger position)** เล่นเพลงง่าย ๆ ได้เป็นร้อยเพลงโดยไม่ต้องขยับมือเลยสักครั้ง

**เลขนิ้ว** (เหมือนกันทั้งสองมือ นับจากนิ้วโป้งออกเสมอ):
**1** โป้ง · **2** ชี้ · **3** กลาง · **4** นาง · **5** ก้อย

**ท่ามือ:** งอนิ้วเบา ๆ เหมือนกำลังถือลูกบอลเล็ก ๆ ไว้ในอุ้งมือ อย่าให้ฝ่ามือแบนราบ แล้วเคาะลงด้วยปลายนิ้ว ข้อมือผ่อนคลาย ไม่เกร็ง

ลองกดตามผมดูครับ 👆`,
    demo: [
      { n: ["C4"], d: 480, f: { C4: 1 } },
      { n: ["D4"], d: 480, f: { D4: 2 } },
      { n: ["E4"], d: 480, f: { E4: 3 } },
      { n: ["F4"], d: 480, f: { F4: 4 } },
      { n: ["G4"], d: 900, f: { G4: 5 } },
    ],
  },
  {
    id: "triad",
    chip: "🎵 สอน Triad",
    ask: "สอน Triad หน่อย",
    demoLabel: "MAJOR → MINOR",
    answer:
`**Triad** คือคอร์ด 3 เสียง สร้างจากการวาง "คู่สาม" ซ้อนกันสองชั้น

**C major triad = C – E – G**
· **C** คือ **root** (ราก)
· **E** คือ **third** — ห่างจาก C ขึ้นไป **4 ครึ่งเสียง**
· **G** คือ **fifth** — ห่างจาก E ขึ้นไปอีก **3 ครึ่งเสียง**

ทีนี้ของสนุกครับ — **ลด third ลงครึ่งเสียงเดียว** (E กลายเป็น **E♭**) มันจะกลายเป็น **C minor** ทันที เสียงเศร้าลงแบบได้ยินชัดเลย ฟังสองคอร์ดที่ผมเล่นให้ดูข้างบนเทียบกันสิครับ

จำแค่สองบรรทัดนี้ คุณสร้าง triad ได้ครบทั้ง 12 คีย์:
**4 + 3 = major** (สว่าง)
**3 + 4 = minor** (เศร้า)`,
    demo: [
      { n: ["C4", "E4", "G4"], d: 1100, f: { C4: 1, E4: 3, G4: 5 }, say: "C MAJOR" },
      { n: [], d: 260 },
      { n: ["C4", "D#4", "G4"], d: 1300, f: { C4: 1, "D#4": 3, G4: 5 }, say: "C MINOR" },
    ],
  },
  {
    id: "chords",
    chip: "🎸 สอนคอร์ดพื้นฐาน",
    ask: "สอนคอร์ดพื้นฐานหน่อย",
    demoLabel: "C · G · Am · F",
    answer:
`มีคอร์ดอยู่ **4 ตัว** ที่ถ้าเล่นได้ คุณจะเล่นเพลงป็อปได้เป็นพัน ๆ เพลง:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

เรียงวนแบบนี้ **C → G → Am → F** แล้วซ้ำไปเรื่อย ๆ นี่คือชุดคอร์ดที่อยู่ในเพลงดังนับไม่ถ้วน ตั้งแต่ Let It Be มาจนถึงเพลงไทยที่คุณเพิ่งฟังเมื่อเช้านี้

ข้อสังเกตที่ช่วยได้มาก: ทั้งสี่คอร์ดนี้ **ใช้คีย์ขาวล้วน** เพราะทุกตัวอยู่ในคีย์ C หมด — ไม่ต้องแตะคีย์ดำสักอันเดียว

และถ้าสังเกตดี ๆ: **Am ก็คือ C ที่เลื่อนขึ้นไปหนึ่งตัวโน้ต** เท่านั้นเอง ดูตอนผมเล่นให้ดูข้างบนครับ 👆`,
    demo: [
      { n: ["C4", "E4", "G4"], d: 900, say: "C" },
      { n: ["G4", "B4", "D5"], d: 900, say: "G" },
      { n: ["A4", "C5", "E5"], d: 900, say: "Am" },
      { n: ["F4", "A4", "C5"], d: 1200, say: "F" },
    ],
  },
];
