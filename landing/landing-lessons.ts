/* ── landing/landing-lessons.ts ──
   The four lessons behind the four example questions on marketing landing
   page 1, in all three languages.

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

   Every `demo` plays on the real keyboard above the chat, so the claim "it
   explains AND shows you" is literally true on the page. Notes are the app's
   own names (C4 = middle C); `f` is the finger number drawn under a key while
   it sounds; `say` is the chord name shown on the pill, which is notation and
   so is not translated. ── */

export const LESSONS = [
  {
    id: "cmajor",
    chip: { th: "🎼 สอน C major scale", en: "🎼 The C major scale", zh: "🎼 讲讲 C 大调音阶" },
    ask: { th: "สอน C major scale หน่อย", en: "Teach me the C major scale", zh: "教我 C 大调音阶" },
    demoLabel: { th: "C MAJOR SCALE", en: "C MAJOR SCALE", zh: "C 大调音阶" },
    answer: {
      th:
`**C major scale** คือบันไดเสียงพื้นฐานที่สุด และเป็นอันเดียวที่ **ใช้คีย์ขาวล้วน** ไม่มีคีย์ดำสักอัน

โน้ต 8 ตัว: **C D E F G A B C**
(โด เร มี ฟา ซอล ลา ที โด)

เคล็ดลับที่จะทำให้คุณจำได้ตลอดชีวิต — ระยะห่างของมันคือ
**เต็ม–เต็ม–ครึ่ง–เต็ม–เต็ม–เต็ม–ครึ่ง**

"ครึ่งเสียง" สองจุดนั้นอยู่ตรง **E→F** กับ **B→C** พอดี ซึ่งเป็นสองคู่เดียวบนคีย์บอร์ดที่ไม่มีคีย์ดำคั่นกลาง เลยไม่ต้องท่องเลย แค่มองก็เห็น

นิ้วมือขวา: **1-2-3** แล้ว **สอดนิ้วโป้งลอดใต้ฝ่ามือ** ไปเล่น F ต่อด้วย **1-2-3-4-5**

ดูคีย์บอร์ดข้างบนสิครับ ผมกำลังเล่นให้ดูทีละนิ้ว 👆`,
      en:
`The **C major scale** is the most fundamental scale there is, and the only one played entirely on **white keys** — not a single black key in it.

Eight notes: **C D E F G A B C**
(do re mi fa sol la ti do)

Here is the trick that makes it stick for life — the gaps between the notes go
**whole–whole–half–whole–whole–whole–half**

Those two half steps land exactly on **E→F** and **B→C**, the only two pairs on the whole keyboard with no black key between them. So there is nothing to memorise: you can simply see it.

Right hand: **1-2-3**, then **tuck your thumb under your palm** to reach F, and carry on **1-2-3-4-5**

Look at the keyboard above — I'm playing it for you, one finger at a time 👆`,
      zh:
`**C 大调音阶**是最基础的音阶，也是唯一一个**全部用白键**弹的音阶——一个黑键都不碰。

八个音：**C D E F G A B C**
（do re mi fa sol la si do）

有一个诀窍能让你终生不忘——它们之间的音程是
**全–全–半–全–全–全–半**

那两个"半音"正好落在 **E→F** 和 **B→C** 上，这是整个键盘上仅有的两对中间没有黑键的白键。所以根本不用背，看一眼就知道。

右手指法：**1-2-3**，然后**大拇指从掌下穿过**去够 F，接着 **1-2-3-4-5**

看上面的键盘，我正一个音一个音弹给你看 👆`,
    },
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
    id: "chords",
    chip: { th: "🎸 สอนคอร์ดพื้นฐาน", en: "🎸 The four chords", zh: "🎸 最基础的和弦" },
    ask: { th: "สอนคอร์ดพื้นฐานหน่อย", en: "Teach me the basic chords", zh: "教我最基础的和弦" },
    demoLabel: { th: "C · G · Am · F", en: "C · G · Am · F", zh: "C · G · Am · F" },
    answer: {
      th:
`มีคอร์ดอยู่ **4 ตัว** ที่ถ้าเล่นได้ คุณจะเล่นเพลงป็อปได้เป็นพัน ๆ เพลง:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

เรียงวนแบบนี้ **C → G → Am → F** แล้วซ้ำไปเรื่อย ๆ นี่คือชุดคอร์ดที่อยู่ในเพลงดังนับไม่ถ้วน ตั้งแต่ Let It Be มาจนถึงเพลงไทยที่คุณเพิ่งฟังเมื่อเช้านี้

ข้อสังเกตที่ช่วยได้มาก: ทั้งสี่คอร์ดนี้ **ใช้คีย์ขาวล้วน** เพราะทุกตัวอยู่ในคีย์ C หมด — ไม่ต้องแตะคีย์ดำสักอันเดียว

และถ้าสังเกตดี ๆ: **Am ก็คือ C ที่เลื่อนขึ้นไปหนึ่งตัวโน้ต** เท่านั้นเอง ดูตอนผมเล่นให้ดูข้างบนครับ 👆`,
      en:
`There are **four chords** that, once you can play them, unlock thousands of pop songs:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

Go round them in this order — **C → G → Am → F** — then repeat. This is the progression sitting inside a staggering number of hits, from Let It Be to whatever was playing in the café this morning.

One observation that helps enormously: all four are **played on white keys only**, because every one of them belongs to the key of C. You never touch a black key.

And look closely: **Am is simply C shifted up by one note**. Watch while I play them above 👆`,
      zh:
`有**四个和弦**，只要你会弹，就能解锁成千上万首流行歌：

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

按这个顺序循环——**C → G → Am → F**——然后一直重复。从 Let It Be 到今天早上咖啡馆里放的那一首，数不清的金曲里都是这套和弦。

一个特别有用的观察：这四个和弦**全部只用白键**，因为它们都属于 C 大调——一个黑键都不用碰。

再仔细看：**Am 其实就是 C 整体往上挪一个音**。看我在上面弹给你看 👆`,
    },
    demo: [
      { n: ["C4", "E4", "G4"], d: 900, say: "C" },
      { n: ["G4", "B4", "D5"], d: 900, say: "G" },
      { n: ["A4", "C5", "E5"], d: 900, say: "Am" },
      { n: ["F4", "A4", "C5"], d: 1200, say: "F" },
    ],
  },
  {
    id: "basics",
    chip: { th: "🎹 สอน Piano ขั้นพื้นฐาน", en: "🎹 Piano from scratch", zh: "🎹 钢琴入门基础" },
    ask: { th: "สอน Piano ขั้นพื้นฐานให้หน่อย", en: "Teach me the piano basics", zh: "教我钢琴的基础" },
    demoLabel: { th: "5-FINGER POSITION", en: "5-FINGER POSITION", zh: "五指位置" },
    answer: {
      th:
`เริ่มจากสิ่งเดียวที่ต้องจำให้ได้ก่อนเลยครับ: **หา C ให้เจอ**

มองหากลุ่ม **คีย์ดำ 2 อัน** ที่ติดกัน — คีย์ขาวที่อยู่ **ทางซ้ายของกลุ่มนั้น** คือ **C** เสมอ ทั้งคีย์บอร์ด ไม่มีข้อยกเว้น ตัวที่อยู่กลางเปียโนเรียกว่า **middle C**

จากนั้นวางมือขวาห้านิ้วลงบน **C D E F G** — นี่เรียกว่า **ตำแหน่งห้านิ้ว (five-finger position)** เล่นเพลงง่าย ๆ ได้เป็นร้อยเพลงโดยไม่ต้องขยับมือเลยสักครั้ง

**เลขนิ้ว** (เหมือนกันทั้งสองมือ นับจากนิ้วโป้งออกเสมอ):
**1** โป้ง · **2** ชี้ · **3** กลาง · **4** นาง · **5** ก้อย

**ท่ามือ:** งอนิ้วเบา ๆ เหมือนกำลังถือลูกบอลเล็ก ๆ ไว้ในอุ้งมือ อย่าให้ฝ่ามือแบนราบ แล้วเคาะลงด้วยปลายนิ้ว ข้อมือผ่อนคลาย ไม่เกร็ง

ลองกดตามผมดูครับ 👆`,
      en:
`Start with the one thing you have to know before anything else: **find C**.

Look for a group of **two black keys** side by side. The white key **immediately to their left** is always **C** — everywhere on the keyboard, no exceptions. The one near the middle of the piano is called **middle C**.

Now rest your right hand on **C D E F G**. This is the **five-finger position**, and hundreds of simple pieces are playable from it without moving your hand once.

**Finger numbers** (the same on both hands, always counted outward from the thumb):
**1** thumb · **2** index · **3** middle · **4** ring · **5** little

**Hand shape:** curve your fingers gently, as though holding a small ball in your palm. Never let the palm go flat. Strike with the fingertips and keep the wrist loose.

Try it along with me 👆`,
      zh:
`先记住一件事，比什么都重要：**找到 C**。

找那组**两个黑键**挨在一起的地方——紧挨在它们**左边**的那个白键永远是 **C**。整个键盘都这样，没有例外。靠近钢琴正中的那一个叫 **中央 C (middle C)**。

然后把右手五个手指放在 **C D E F G** 上——这叫**五指位置**。光靠这个位置，手一次都不用挪，就能弹下几百首简单的曲子。

**指法编号**（左右手一样，永远从大拇指往外数）：
**1** 拇指 · **2** 食指 · **3** 中指 · **4** 无名指 · **5** 小指

**手型：** 手指轻轻弯曲，像掌心里握着一个小球，千万别让手掌塌平。用指尖触键，手腕保持放松。

跟着我一起弹弹看 👆`,
    },
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
    chip: { th: "🎵 สอน Triad", en: "🎵 What a triad is", zh: "🎵 什么是三和弦" },
    ask: { th: "สอน Triad หน่อย", en: "Teach me what a triad is", zh: "教我什么是三和弦" },
    demoLabel: { th: "MAJOR → MINOR", en: "MAJOR → MINOR", zh: "大三 → 小三" },
    answer: {
      th:
`**Triad** คือคอร์ด 3 เสียง สร้างจากการวาง "คู่สาม" ซ้อนกันสองชั้น

**C major triad = C – E – G**
· **C** คือ **root** (ราก)
· **E** คือ **third** — ห่างจาก C ขึ้นไป **4 ครึ่งเสียง**
· **G** คือ **fifth** — ห่างจาก E ขึ้นไปอีก **3 ครึ่งเสียง**

ทีนี้ของสนุกครับ — **ลด third ลงครึ่งเสียงเดียว** (E กลายเป็น **E♭**) มันจะกลายเป็น **C minor** ทันที เสียงเศร้าลงแบบได้ยินชัดเลย ฟังสองคอร์ดที่ผมเล่นให้ดูข้างบนเทียบกันสิครับ

จำแค่สองบรรทัดนี้ คุณสร้าง triad ได้ครบทั้ง 12 คีย์:
**4 + 3 = major** (สว่าง)
**3 + 4 = minor** (เศร้า)`,
      en:
`A **triad** is a three-note chord, built by stacking two "thirds" on top of one another.

**C major triad = C – E – G**
· **C** is the **root**
· **E** is the **third** — **4 semitones** above C
· **G** is the **fifth** — another **3 semitones** above E

Now the fun part: **lower the third by one single semitone** (E becomes **E♭**) and it turns into **C minor** on the spot. You can hear it go sad. Compare the two chords I just played above.

Remember these two lines and you can build a triad in all 12 keys:
**4 + 3 = major** (bright)
**3 + 4 = minor** (sad)`,
      zh:
`**三和弦 (triad)** 是三个音组成的和弦，由两个"三度"叠起来构成。

**C 大三和弦 = C – E – G**
· **C** 是 **根音 (root)**
· **E** 是 **三音 (third)**——比 C 高 **4 个半音**
· **G** 是 **五音 (fifth)**——再比 E 高 **3 个半音**

有意思的来了：**只把三音降低半个音**（E 变成 **E♭**），它立刻就变成 **C 小三和弦**，情绪马上转为忧伤。对比一下我刚才在上面弹的那两个和弦。

记住这两行，你就能推出全部 12 个调的三和弦：
**4 + 3 = 大三和弦**（明亮）
**3 + 4 = 小三和弦**（忧伤）`,
    },
    demo: [
      { n: ["C4", "E4", "G4"], d: 1100, f: { C4: 1, E4: 3, G4: 5 }, say: "C MAJOR" },
      { n: [], d: 260 },
      { n: ["C4", "D#4", "G4"], d: 1300, f: { C4: 1, "D#4": 3, G4: 5 }, say: "C MINOR" },
    ],
  },

];
