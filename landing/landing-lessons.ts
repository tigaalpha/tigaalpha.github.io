/* ── landing/landing-lessons.ts ──
   The four lessons behind the four example questions on marketing landing
   page 1, in all ten languages (th, en, zh, ja, ko, ru, hi, es, fr, ar; de added 2026-11-20).

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
    chip: { th: "🎼 สอน C major scale", en: "🎼 The C major scale", zh: "🎼 讲讲 C 大调音阶",
      ja: "🎼 Cメジャー・スケール", ko: "🎼 C 메이저 스케일", ru: "🎼 Гамма до мажор (C)",
      hi: "🎼 C मेजर स्केल", es: "🎼 La escala de Do mayor", fr: "🎼 La gamme de Do majeur", ar: "🎼 سلم C ماجور", de: "🎼 Die C-Dur-Tonleiter" },
    ask: { th: "สอน C major scale หน่อย", en: "Teach me the C major scale", zh: "教我 C 大调音阶",
      ja: "Cメジャー・スケールを教えて", ko: "C 메이저 스케일을 알려 주세요", ru: "Научите меня гамме до мажор",
      hi: "मुझे C मेजर स्केल सिखाइए", es: "Enséñame la escala de Do mayor", fr: "Apprenez-moi la gamme de Do majeur", ar: "علّمني سلم C ماجور", de: "Erkläre mir die C-Dur-Tonleiter" },
    demoLabel: { th: "C MAJOR SCALE", en: "C MAJOR SCALE", zh: "C 大调音阶", ja: "Cメジャー・スケール", ko: "C 메이저 스케일", ru: "ГАММА ДО МАЖОР",
      hi: "C मेजर स्केल", es: "ESCALA DE DO MAYOR", fr: "GAMME DE DO MAJEUR", ar: "سلم C ماجور", de: "C-DUR-TONLEITER" },
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
      ja:
`**Cメジャー・スケール**は、いちばん基本のスケールです。しかも**白鍵だけ**で弾ける唯一のスケールで、黒鍵は1つも使いません。

8つの音：**C D E F G A B C**
（ド レ ミ ファ ソ ラ シ ド）

一生忘れなくなるコツがあります。音と音の間隔は
**全音–全音–半音–全音–全音–全音–半音**

2か所の「半音」は、ちょうど **E→F** と **B→C** にあたります。鍵盤全体で、間に黒鍵がない白鍵の組み合わせはこの2つだけ。だから暗記は不要で、見ればわかります。

右手の指づかい：**1-2-3**、そのあと**親指を手のひらの下にくぐらせて** F を弾き、続けて **1-2-3-4-5**

上の鍵盤を見てください。指を一本ずつ、ゆっくり弾いてお見せしています 👆`,
      ko:
`**C 메이저 스케일**은 가장 기본이 되는 스케일이고, **흰 건반만으로** 칠 수 있는 유일한 스케일이에요. 검은 건반이 하나도 없어요.

여덟 개의 음: **C D E F G A B C**
(도 레 미 파 솔 라 시 도)

평생 기억에 남는 비결이 있어요. 음과 음 사이의 간격은
**온음–온음–반음–온음–온음–온음–반음**

두 군데의 '반음'은 정확히 **E→F**와 **B→C**에 있어요. 건반 전체에서 사이에 검은 건반이 없는 흰 건반 쌍은 이 두 곳뿐이에요. 그래서 외울 필요 없이 눈으로 보면 바로 알 수 있어요.

오른손 손가락 번호: **1-2-3**, 그다음 **엄지를 손바닥 밑으로 넘겨서** F를 치고, 이어서 **1-2-3-4-5**

위의 건반을 보세요. 제가 손가락 하나씩 천천히 쳐서 보여드리고 있어요 👆`,
      ru:
`**Гамма до мажор (C major)** — самая основная гамма и единственная, которая играется **только на белых клавишах**: ни одной чёрной в ней нет.

Восемь нот: **C D E F G A B C**
(до ре ми фа соль ля си до)

Вот приём, который запомнится на всю жизнь: интервалы между нотами идут так —
**тон–тон–полутон–тон–тон–тон–полутон**

Оба полутона приходятся ровно на **E→F** и **B→C** — это единственные две пары белых клавиш на всей клавиатуре, между которыми нет чёрной. Поэтому ничего заучивать не нужно: это видно глазами.

Правая рука: **1-2-3**, затем **подведите большой палец под ладонь**, чтобы взять F, и дальше **1-2-3-4-5**

Посмотрите на клавиатуру выше — я играю для вас по одному пальцу за раз 👆`,
      hi:
`**C मेजर स्केल** सबसे बुनियादी स्केल है, और अकेला ऐसा स्केल जो पूरी तरह **सफ़ेद कीज़** पर बजता है — इसमें एक भी काली की नहीं है।

आठ नोट: **C D E F G A B C**
(डो रे मी फा सो ला सी डो)

एक तरकीब है जो इसे उम्र भर के लिए याद करा देती है — नोटों के बीच की दूरियाँ इस क्रम में चलती हैं
**होल–होल–हाफ़–होल–होल–होल–हाफ़**

ये दोनों हाफ़ स्टेप ठीक **E→F** और **B→C** पर आते हैं — पूरे कीबोर्ड पर बस यही दो जोड़े हैं जिनके बीच कोई काली की नहीं होती। इसलिए रटने की ज़रूरत ही नहीं: बस देखिए, साफ़ दिख जाता है।

दायाँ हाथ: **1-2-3**, फिर F तक पहुँचने के लिए **अँगूठे को हथेली के नीचे से ले जाइए**, और आगे **1-2-3-4-5**

ऊपर का कीबोर्ड देखिए — मैं एक-एक उँगली से बजाकर दिखा रहा हूँ 👆`,
      es:
`La **escala de Do mayor** es la escala más básica que existe y la única que se toca solo con **teclas blancas**: no lleva ni una sola tecla negra.

Ocho notas: **C D E F G A B C**
(do re mi fa sol la si do)

Este es el truco para no olvidarla nunca. Las distancias entre notas seguidas siguen este patrón:
**tono–tono–semitono–tono–tono–tono–semitono**

Esos dos semitonos caen justo en **E→F** y **B→C**, los dos únicos pares de teclas vecinas de todo el teclado sin tecla negra en medio. Así que no hay nada que memorizar: se ve a simple vista.

Mano derecha: **1-2-3**, luego **pasa el pulgar por debajo de la palma** para llegar a F, y sigue con **1-2-3-4-5**

Mira el teclado de arriba: te la estoy tocando, un dedo a la vez 👆`,
      fr:
`La **gamme de Do majeur (C major)** est la gamme la plus fondamentale qui soit, et la seule qui se joue entièrement sur les **touches blanches**\u00a0: pas une seule touche noire.

Huit notes\u00a0: **C D E F G A B C**
(do ré mi fa sol la si do)

Voici l'astuce pour ne plus jamais l'oublier\u00a0: les écarts entre les notes suivent ce schéma
**ton–ton–demi-ton–ton–ton–ton–demi-ton**

Les deux demi-tons tombent exactement sur **E→F** et **B→C**, les deux seules paires de touches blanches de tout le clavier sans touche noire entre elles. Rien à apprendre par cœur\u00a0: il suffit de regarder.

Main droite\u00a0: **1-2-3**, puis **passez le pouce sous la paume** pour atteindre F, et continuez avec **1-2-3-4-5**

Regardez le clavier ci-dessus\u00a0: je vous la joue, un doigt à la fois 👆`,
      ar:
`**سلم C ماجور** هو أكثر السلالم أساسيةً، والوحيد الذي يُعزف كله على **المفاتيح البيضاء** — ولا مفتاح أسود واحد فيه.

ثماني نوتات: **C D E F G A B C**
(دو ري مي فا صول لا سي دو)

وإليك الحيلة التي تثبّته في ذاكرتك مدى الحياة — المسافات بين النوتات تسير هكذا:
**نغمة–نغمة–نصف–نغمة–نغمة–نغمة–نصف**

ويقع نصف النغمة في موضعين بالضبط: عند **E→F** وعند **B→C**، وهما الزوجان الوحيدان على لوحة المفاتيح كلها اللذان لا يفصل بينهما مفتاح أسود. لذلك لا تحتاج إلى حفظ شيء، يكفي أن تراه بعينك.

اليد اليمنى: **1-2-3**، ثم **مرّر إبهامك تحت راحة يدك** لتصل إلى F، وتابع **1-2-3-4-5**

انظر إلى لوحة المفاتيح أعلاه — أنا أعزفه لك إصبعًا إصبعًا 👆`,
      de:
`Die **C-Dur-Tonleiter** ist die grundlegendste Tonleiter überhaupt und die einzige, die ausschließlich auf **weißen Tasten** gespielt wird — keine einzige schwarze Taste kommt darin vor.

Acht Töne: **C D E F G A B C**
(do re mi fa sol la si do)

Hier ist der Trick, mit dem du sie nie wieder vergisst — die Abstände zwischen den Noten folgen diesem Muster:
**Ganzton–Ganzton–Halbton–Ganzton–Ganzton–Ganzton–Halbton**

Die beiden Halbtonschritte liegen genau bei **E→F** und **B→C**, den einzigen zwei Paaren auf der ganzen Tastatur, zwischen denen keine schwarze Taste liegt. Du musst also nichts auswendig lernen: Du kannst es einfach sehen.

Rechte Hand: **1-2-3**, dann **setze den Daumen unter der Handfläche durch**, um F zu erreichen, und weiter mit **1-2-3-4-5**

Schau auf die Tastatur oben — ich spiele sie dir vor, Finger für Finger 👆`,
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
    chip: { th: "🎸 สอนคอร์ดพื้นฐาน", en: "🎸 The four chords", zh: "🎸 最基础的和弦",
      ja: "🎸 基本の4つのコード", ko: "🎸 기본 4가지 코드", ru: "🎸 Четыре главных аккорда",
      hi: "🎸 चार कॉर्ड", es: "🎸 Los cuatro acordes", fr: "🎸 Les quatre accords", ar: "🎸 الأكوردات الأربعة", de: "🎸 Die vier Akkorde" },
    ask: { th: "สอนคอร์ดพื้นฐานหน่อย", en: "Teach me the basic chords", zh: "教我最基础的和弦",
      ja: "基本のコードを教えて", ko: "기본 코드를 알려 주세요", ru: "Научите меня основным аккордам",
      hi: "मुझे बेसिक कॉर्ड सिखाइए", es: "Enséñame los acordes básicos", fr: "Apprenez-moi les accords de base", ar: "علّمني الأكوردات الأساسية", de: "Erkläre mir die Grundakkorde" },
    demoLabel: { th: "C · G · Am · F", en: "C · G · Am · F", zh: "C · G · Am · F", ja: "C · G · Am · F", ko: "C · G · Am · F", ru: "C · G · Am · F",
      hi: "C · G · Am · F", es: "C · G · Am · F", fr: "C · G · Am · F", ar: "C · G · Am · F", de: "C · G · Am · F" },
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
      ja:
`弾けるようになると、何千ものポップスが弾けるようになる**4つのコード**があります：

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

この順番で回します — **C → G → Am → F** — そして繰り返し。Let It Be から今朝カフェで流れていた曲まで、数えきれないほどのヒット曲に、このコード進行が入っています。

とても役に立つ気づきがひとつ。4つとも**白鍵だけ**で弾けます。どれもキー C に属しているからです。黒鍵には一度も触れません。

そしてよく見てください：**Am は、C の G を A に1つ上げただけ**です。C と E は同じ音のまま。上で弾いてお見せするので、見ていてください 👆`,
      ko:
`다 칠 수 있게 되면 수천 곡의 팝송이 열리는 **네 가지 코드**가 있어요:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

이 순서로 돌려 보세요 — **C → G → Am → F** — 그리고 계속 반복해요. Let It Be부터 오늘 아침 카페에서 흘러나온 노래까지, 수많은 히트곡에 이 코드 진행이 들어 있어요.

아주 도움이 되는 점 하나: 이 네 코드는 모두 **흰 건반만으로** 칠 수 있어요. 전부 C 키에 속해 있기 때문이에요. 검은 건반은 한 번도 누르지 않아요.

그리고 자세히 보세요: **Am은 C에서 G를 A로 한 음만 올린 것**이에요. C와 E는 그대로예요. 제가 위에서 쳐 드리는 걸 보세요 👆`,
      ru:
`Есть **четыре аккорда**, освоив которые, вы сможете играть тысячи популярных песен:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

Играйте их по кругу в таком порядке — **C → G → Am → F** — и повторяйте. Эта последовательность скрывается в огромном числе хитов: от Let It Be до того, что звучало сегодня утром в кафе.

Одно наблюдение, которое очень помогает: все четыре аккорда играются **только на белых клавишах**, потому что все они принадлежат тональности до мажор (C). Чёрных клавиш вы не касаетесь вовсе.

И присмотритесь: **Am — это просто C, в котором нота G поднята до A.** Ноты C и E остаются теми же. Смотрите, как я играю их выше 👆`,
      hi:
`**चार कॉर्ड** ऐसे हैं कि इन्हें सीख लेने पर आप हज़ारों पॉप गाने बजा सकते हैं:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

इन्हें इसी क्रम में बारी-बारी से बजाइए — **C → G → Am → F** — और फिर दोहराइए। यही कॉर्ड प्रोग्रेशन अनगिनत हिट गानों में मौजूद है: Let It Be से लेकर आज सुबह कैफ़े में बज रहे गाने तक।

एक बात जो बहुत काम आती है: चारों कॉर्ड **सिर्फ़ सफ़ेद कीज़ पर बजते हैं**, क्योंकि चारों C मेजर स्केल के ही नोटों से बने हैं। काली कीज़ को छूने की नौबत ही नहीं आती।

और ज़रा ग़ौर से देखिए: **Am दरअसल C ही है, बस G को एक नोट ऊपर खिसकाकर A कर दिया गया है।** C और E वही रहते हैं। ऊपर मैं इन्हें बजाकर दिखा रहा हूँ — देखिए 👆`,
      es:
`Hay **cuatro acordes** que, cuando los dominas, te abren la puerta a miles de canciones pop:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

Tócalos en este orden, **C → G → Am → F**, y vuelve a empezar. Es la progresión que se esconde en una cantidad asombrosa de éxitos, desde Let It Be hasta lo que sonaba esta mañana en la cafetería.

Una observación que ayuda muchísimo: los cuatro se tocan **solo con teclas blancas**, porque todos pertenecen a la tonalidad de Do. No tocas ninguna tecla negra.

Y fíjate bien: **Am es simplemente C con la nota G subida hasta A**. C y E se quedan igual. Mira cómo los toco arriba 👆`,
      fr:
`Il y a **quatre accords** qui, dès que vous savez les jouer, ouvrent la porte à des milliers de chansons pop\u00a0:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

Enchaînez-les dans cet ordre — **C → G → Am → F** — puis repartez du début. Cette progression se cache derrière un nombre incroyable de tubes, de Let It Be à la chanson qui passait ce matin au café.

Une remarque qui aide énormément\u00a0: les quatre se jouent **uniquement sur les touches blanches**, car ils appartiennent tous à la tonalité de Do majeur. Vous ne touchez jamais une touche noire.

Et observez bien\u00a0: **Am, c'est simplement C dont la note G monte jusqu'à A.** C et E ne bougent pas. Regardez-moi les jouer sur le clavier ci-dessus 👆`,
      ar:
`هناك **أربعة أكوردات** إذا أتقنت عزفها فتحت لك الباب إلى آلاف أغاني البوب:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

اعزفها بهذا الترتيب — **C → G → Am → F** — ثم ابدأ من جديد. هذا التتابع موجود في عدد هائل من الأغاني الناجحة، من Let It Be إلى الأغنية التي كانت تُسمع في المقهى هذا الصباح.

ملاحظة تفيدك كثيرًا: الأكوردات الأربعة كلها **تُعزف على المفاتيح البيضاء فقط**، لأنها جميعًا من درجة C. فلن تلمس أي مفتاح أسود أبدًا.

وانظر جيدًا: **Am هو ببساطة C بعد رفع نوتة G إلى A**. تبقى النوتتان C و E كما هما. شاهدني أعزفها أعلاه 👆`,
      de:
`Es gibt **vier Akkorde**, die dir Tausende Pop-Lieder öffnen, sobald du sie spielen kannst:

**C** = C–E–G
**G** = G–B–D
**Am** = A–C–E
**F** = F–A–C

Spiele sie in dieser Reihenfolge — **C → G → Am → F** — und fange dann wieder von vorn an. Diese Abfolge steckt in unglaublich vielen Hits, von Let It Be bis zu dem Lied, das heute Morgen im Café lief.

Eine Beobachtung, die enorm hilft: Alle vier werden **nur auf weißen Tasten** gespielt, denn alle gehören zur Tonart C-Dur. Du berührst nie eine schwarze Taste.

Und schau genau hin: **Am ist einfach C, bei dem die Note G auf A hochgerückt ist.** C und E bleiben gleich. Sieh zu, wie ich sie oben spiele 👆`,
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
    chip: { th: "🎹 สอน Piano ขั้นพื้นฐาน", en: "🎹 Piano from scratch", zh: "🎹 钢琴入门基础",
      ja: "🎹 ピアノの基礎から", ko: "🎹 피아노 기초부터", ru: "🎹 Пианино с нуля",
      hi: "🎹 शुरू से पियानो", es: "🎹 Piano desde cero", fr: "🎹 Le piano de zéro", ar: "🎹 البيانو من الصفر", de: "🎹 Klavier von Grund auf" },
    ask: { th: "สอน Piano ขั้นพื้นฐานให้หน่อย", en: "Teach me the piano basics", zh: "教我钢琴的基础",
      ja: "ピアノの基礎を教えて", ko: "피아노 기초를 알려 주세요", ru: "Научите меня основам игры на пианино",
      hi: "मुझे पियानो की बुनियादी बातें सिखाइए", es: "Enséñame lo básico del piano", fr: "Apprenez-moi les bases du piano", ar: "علّمني أساسيات البيانو", de: "Erkläre mir die Klavier-Grundlagen" },
    demoLabel: { th: "5-FINGER POSITION", en: "5-FINGER POSITION", zh: "五指位置", ja: "5本指ポジション", ko: "다섯 손가락 자리", ru: "ПЯТИПАЛАЯ ПОЗИЦИЯ",
      hi: "5 उँगलियों की पोज़ीशन", es: "POSICIÓN DE 5 DEDOS", fr: "POSITION DES 5 DOIGTS", ar: "وضعية 5 أصابع", de: "5-FINGER-POSITION" },
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
      ja:
`まず何よりも覚えてほしいことがひとつ：**C を見つける**ことです。

**黒鍵が2つ並んでいる**ところを探してください。そのすぐ**左**にある白鍵が、鍵盤のどこでも必ず **C（ド）** です。例外はありません。ピアノの真ん中あたりにあるものを **middle C（中央のド）** と呼びます。

次に、右手を **C D E F G** の上に置きます。これが**5本指ポジション**で、ここから手を一度も動かさずに弾ける簡単な曲が何百曲もあります。

**指番号**（両手とも同じで、いつも親指から外側へ数えます）：
**1** 親指 · **2** 人差し指 · **3** 中指 · **4** 薬指 · **5** 小指

**手の形：** 手のひらに小さなボールを持っているように、指をやさしく丸めます。手のひらを平らにしてはいけません。指先で打鍵し、手首は力を抜きます。

私と一緒に弾いてみましょう 👆`,
      ko:
`무엇보다 먼저 꼭 알아야 할 한 가지부터 시작해요: **C 찾기**예요.

검은 건반이 **두 개** 나란히 있는 곳을 찾아보세요. 그 **바로 왼쪽**의 흰 건반이 건반 어디에서든 항상 **C(도)**예요. 예외는 없어요. 피아노 한가운데 근처에 있는 C를 **가운데 도(middle C)**라고 불러요.

이제 오른손을 **C D E F G** 위에 올려놓으세요. 이것이 **다섯 손가락 자리(five-finger position)**예요. 손을 한 번도 옮기지 않고도 칠 수 있는 쉬운 곡이 수백 곡이나 있어요.

**손가락 번호** (양손 모두 같고, 항상 엄지부터 바깥쪽으로 세요):
**1** 엄지 · **2** 검지 · **3** 중지 · **4** 약지 · **5** 새끼손가락

**손 모양:** 손바닥에 작은 공을 쥔 것처럼 손가락을 부드럽게 둥글게 구부리세요. 손바닥이 납작해지면 안 돼요. 손가락 끝으로 누르고 손목은 힘을 빼고 편안하게 두세요.

저와 함께 따라 해 보세요 👆`,
      ru:
`Начнём с того, что нужно знать прежде всего: **найти C**.

Найдите группу из **двух чёрных клавиш** рядом. Белая клавиша **сразу слева от них** — всегда **C** («до»), по всей клавиатуре, без исключений. Та, что ближе к середине пианино, называется **«до» первой октавы (middle C)**.

Теперь положите правую руку на **C D E F G**. Это **пятипальцевая позиция**: из неё можно сыграть сотни простых пьес, ни разу не сдвигая руку.

**Номера пальцев** (одинаковые на обеих руках, всегда считаются от большого пальца):
**1** большой · **2** указательный · **3** средний · **4** безымянный · **5** мизинец

**Форма руки:** мягко округлите пальцы, будто держите в ладони маленький мячик. Ладонь ни в коем случае не должна быть плоской. Нажимайте подушечками пальцев, запястье держите свободным.

Попробуйте вместе со мной 👆`,
      hi:
`सबसे पहले वह एक बात, जो हर चीज़ से पहले पता होनी चाहिए: **C ढूँढना**।

**दो काली कीज़** का एक जोड़ा खोजिए, जो साथ-साथ हों। उनके **ठीक बाईं ओर** वाली सफ़ेद की हमेशा **C** होती है — पूरे कीबोर्ड पर, बिना किसी अपवाद के। पियानो के बीच के पास वाली C को **मिडिल C (middle C)** कहते हैं।

अब अपना दायाँ हाथ **C D E F G** पर रखिए। यह है **पाँच उँगलियों की पोज़ीशन**, और इसी से सैकड़ों आसान धुनें हाथ को एक बार भी हिलाए बिना बजाई जा सकती हैं।

**उँगलियों के नंबर** (दोनों हाथों में एक जैसे, हमेशा अँगूठे से बाहर की ओर गिने जाते हैं):
**1** अँगूठा · **2** तर्जनी · **3** मध्यमा · **4** अनामिका · **5** कनिष्ठा

**हाथ का आकार:** उँगलियों को हल्का-सा मोड़िए, जैसे हथेली में छोटी गेंद पकड़ी हो। हथेली को कभी सपाट न होने दीजिए। उँगलियों के सिरों से कीज़ दबाइए और कलाई ढीली रखिए।

मेरे साथ-साथ बजाकर देखिए 👆`,
      es:
`Empieza por lo único que tienes que saber antes que nada: **encontrar C**.

Busca un grupo de **dos teclas negras** juntas. La tecla blanca **justo a su izquierda** es siempre **C**, en todo el teclado y sin excepciones. La que está cerca del centro del piano se llama **Do central (middle C)**.

Ahora apoya la mano derecha sobre **C D E F G**. Esta es la **posición de cinco dedos**, y desde ella se pueden tocar cientos de piezas sencillas sin mover la mano ni una sola vez.

**Números de los dedos** (iguales en las dos manos, siempre se cuentan desde el pulgar hacia fuera):
**1** pulgar · **2** índice · **3** corazón · **4** anular · **5** meñique

**Forma de la mano:** curva los dedos con suavidad, como si sostuvieras una pelota pequeña en la palma. Nunca dejes la palma plana. Toca con la yema de los dedos y mantén la muñeca relajada.

Pruébalo conmigo 👆`,
      fr:
`Commençons par la seule chose à savoir avant toute autre\u00a0: **trouver le Do (C)**.

Repérez un groupe de **deux touches noires** côte à côte. La touche blanche **juste à leur gauche** est toujours un **C** («\u00a0do\u00a0»), partout sur le clavier, sans exception. Celui qui se trouve vers le milieu du piano s'appelle le **Do central (middle C)**.

Maintenant, posez la main droite sur **C D E F G**. C'est la **position des cinq doigts**, et des centaines de morceaux simples se jouent à partir de cette position, sans jamais bouger la main.

**Numéros des doigts** (les mêmes aux deux mains, toujours comptés à partir du pouce)\u00a0:
**1** pouce · **2** index · **3** médius · **4** annulaire · **5** auriculaire

**Position de la main\u00a0:** arrondissez doucement les doigts, comme si vous teniez une petite balle au creux de la paume. Ne laissez jamais la paume s'aplatir. Jouez avec le bout des doigts et gardez le poignet souple.

Essayez avec moi 👆`,
      ar:
`ابدأ بالشيء الوحيد الذي يجب أن تعرفه قبل أي شيء آخر: **اعثر على C**.

ابحث عن مجموعة من **مفتاحين أسودين** متجاورين. المفتاح الأبيض **على يسارهما مباشرةً** هو دائمًا **C** — في كل مكان على لوحة المفاتيح، بلا استثناء. ويُسمّى المفتاح الذي يقع قرب منتصف البيانو **C الوسطى (middle C)**.

الآن ضع يدك اليمنى على **C D E F G**. هذه هي **وضعية الأصابع الخمسة**، ويمكن عزف مئات المقطوعات البسيطة انطلاقًا منها دون تحريك يدك ولو مرة واحدة.

**أرقام الأصابع** (هي نفسها في اليدين، وتُعدّ دائمًا من الإبهام إلى الخارج):
**1** الإبهام · **2** السبابة · **3** الوسطى · **4** البنصر · **5** الخنصر

**شكل اليد:** قوّس أصابعك برفق كأنك تمسك كرة صغيرة في راحة يدك. لا تدع راحة يدك تنبسط أبدًا. اضغط بأطراف الأصابع وأبقِ المعصم مرتخيًا.

جرّب معي 👆`,
      de:
`Fangen wir mit dem Einen an, das du vor allem anderen wissen musst: **Finde das C**.

Suche eine Gruppe aus **zwei schwarzen Tasten** nebeneinander. Die weiße Taste **direkt links davon** ist immer ein **C** — überall auf der Tastatur, ohne Ausnahme. Das C etwa in der Mitte des Klaviers heißt **eingestrichenes C (middle C)**.

Lege jetzt die rechte Hand auf **C D E F G**. Das ist die **Fünf-Finger-Lage**, und Hunderte einfache Stücke lassen sich daraus spielen, ohne die Hand ein einziges Mal zu bewegen.

**Fingernummern** (an beiden Händen gleich, immer vom Daumen aus nach außen gezählt):
**1** Daumen · **2** Zeigefinger · **3** Mittelfinger · **4** Ringfinger · **5** kleiner Finger

**Handhaltung:** Runde die Finger sanft, als würdest du einen kleinen Ball in der Handfläche halten. Lass die Handfläche nie flach werden. Spiele mit den Fingerspitzen und halte das Handgelenk locker.

Probiere es gleich mit mir aus 👆`,
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
    chip: { th: "🎵 สอน Triad", en: "🎵 What a triad is", zh: "🎵 什么是三和弦",
      ja: "🎵 三和音とは", ko: "🎵 3화음이란", ru: "🎵 Что такое трезвучие",
      hi: "🎵 ट्रायड क्या होता है", es: "🎵 Qué es una tríada", fr: "🎵 Ce qu'est une triade", ar: "🎵 ما هو الأكورد الثلاثي", de: "🎵 Was ein Dreiklang ist" },
    ask: { th: "สอน Triad หน่อย", en: "Teach me what a triad is", zh: "教我什么是三和弦",
      ja: "三和音とは何か教えて", ko: "3화음이 뭔지 알려 주세요", ru: "Объясните, что такое трезвучие",
      hi: "मुझे सिखाइए कि ट्रायड क्या होता है", es: "Enséñame qué es una tríada", fr: "Apprenez-moi ce qu'est une triade", ar: "علّمني ما هو الأكورد الثلاثي", de: "Erkläre mir, was ein Dreiklang ist" },
    demoLabel: { th: "MAJOR → MINOR", en: "MAJOR → MINOR", zh: "大三 → 小三", ja: "メジャー → マイナー", ko: "메이저 → 마이너", ru: "МАЖОР → МИНОР",
      hi: "मेजर → माइनर", es: "MAYOR → MENOR", fr: "MAJEUR → MINEUR", ar: "ماجور ← مينور", de: "DUR → MOLL" },
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
      ja:
`**三和音（トライアド）**は3つの音からなるコードで、「3度」を2つ積み重ねて作ります。

**Cメジャー・トライアド = C – E – G**
· **C** は**根音（ルート）**
· **E** は**第3音（サード）** — C から **4半音** 上
· **G** は**第5音（フィフス）** — E からさらに **3半音** 上

ここからが面白いところです。**第3音を半音ひとつだけ下げる**（E が **E♭** になる）と、その場で **Cマイナー** に変わります。悲しい響きになるのがはっきり聞こえますよ。上で弾いた2つのコードを聴き比べてみてください。

この2行を覚えれば、12のキーすべてで三和音が作れます：
**4 + 3 = メジャー**（明るい）
**3 + 4 = マイナー**（悲しい）`,
      ko:
`**3화음(triad)**은 세 음으로 이루어진 코드로, '3도'를 두 번 쌓아 올려서 만들어요.

**C 메이저 3화음 = C – E – G**
· **C**는 **근음(root)**
· **E**는 **3음(third)** — C보다 **반음 4개** 위
· **G**는 **5음(fifth)** — E보다 다시 **반음 3개** 위

이제 재미있는 부분이에요. **3음을 반음 하나만 내리면**(E가 **E♭**이 돼요) 그 자리에서 **C 마이너**로 바뀌어요. 소리가 슬퍼지는 게 또렷이 들려요. 위에서 제가 친 두 코드를 비교해서 들어 보세요.

이 두 줄만 기억하면 12개 키 모두에서 3화음을 만들 수 있어요:
**4 + 3 = 메이저** (밝은 소리)
**3 + 4 = 마이너** (슬픈 소리)`,
      ru:
`**Трезвучие (triad)** — это аккорд из трёх нот, который строится как две «терции», поставленные друг на друга.

**Мажорное трезвучие от C = C – E – G**
· **C** — это **основной тон (root)**
· **E** — это **терция (third)**: на **4 полутона** выше C
· **G** — это **квинта (fifth)**: ещё на **3 полутона** выше E

А теперь самое интересное: **опустите терцию всего на один полутон** (E станет **E♭**) — и аккорд тут же превратится в **C minor** (до минор). Вы услышите, как звучание становится грустным. Сравните два аккорда, которые прозвучали выше.

Запомните две строки — и сможете построить трезвучие в любой из 12 тональностей:
**4 + 3 = мажор** (светлое звучание)
**3 + 4 = минор** (грустное звучание)`,
      hi:
`**ट्रायड** तीन नोट का कॉर्ड होता है, जो दो “थर्ड” को एक के ऊपर एक रखकर बनता है।

**C मेजर ट्रायड = C – E – G**
· **C** है **रूट**
· **E** है **थर्ड** — C से **4 सेमीटोन** ऊपर
· **G** है **फ़िफ़्थ** — E से और **3 सेमीटोन** ऊपर

अब मज़े की बात: **थर्ड को सिर्फ़ एक सेमीटोन नीचे कर दीजिए** (E बन जाता है **E♭**) और यह उसी पल **C माइनर** बन जाता है। आवाज़ का उदास हो जाना साफ़ सुनाई देता है। ऊपर मैंने जो दो कॉर्ड बजाए, उनकी तुलना कीजिए।

ये दो पंक्तियाँ याद रखिए, और आप सभी 12 नोटों से शुरू करके ट्रायड बना सकते हैं:
**4 + 3 = मेजर** (उजला)
**3 + 4 = माइनर** (उदास)`,
      es:
`Una **tríada** es un acorde de tres notas que se forma apilando dos «terceras» una sobre otra.

**Tríada de Do mayor = C – E – G**
· **C** es la **fundamental**
· **E** es la **tercera**: **4 semitonos** por encima de C
· **G** es la **quinta**: otros **3 semitonos** por encima de E

Ahora viene lo divertido: **baja la tercera un solo semitono** (E pasa a ser **E♭**) y se convierte al instante en **Do menor**. Se oye cómo se vuelve triste. Compara los dos acordes que acabo de tocar arriba.

Recuerda estas dos líneas y podrás formar una tríada en las 12 tonalidades:
**4 + 3 = mayor** (brillante)
**3 + 4 = menor** (triste)`,
      fr:
`Une **triade** est un accord de trois notes, construit en empilant deux «\u00a0tierces\u00a0» l'une sur l'autre.

**Triade de Do majeur = C – E – G**
· **C** est la **fondamentale**
· **E** est la **tierce** — **4\u00a0demi-tons** au-dessus de C
· **G** est la **quinte** — encore **3\u00a0demi-tons** au-dessus de E

Voici la partie amusante\u00a0: **baissez la tierce d'un seul demi-ton** (E devient **E♭**) et vous obtenez aussitôt un accord de **Do mineur**. On entend tout de suite qu'il devient triste. Comparez les deux accords que je viens de jouer ci-dessus.

Retenez ces deux lignes et vous saurez construire une triade dans les 12\u00a0tonalités\u00a0:
**4 + 3 = majeur** (lumineux)
**3 + 4 = mineur** (triste)`,
      ar:
`**الأكورد الثلاثي** هو أكورد من ثلاث نوتات، يُبنى بوضع «ثالثتين» إحداهما فوق الأخرى.

**الأكورد الثلاثي C ماجور = C – E – G**
· **C** هي **الجذر**
· **E** هي **الثالثة** — فوق C بمقدار **4 أنصاف نغمة**
· **G** هي **الخامسة** — فوق E بمقدار **3 أنصاف نغمة** أخرى

والآن الجزء الممتع: **اخفض الثالثة نصف نغمة واحدة فقط** (تصبح E هي **E♭\u200e**) فيتحوّل الأكورد فورًا إلى **C مينور**. ستسمعه يصير حزينًا. قارن بين الأكوردين اللذين عزفتهما لك للتو أعلاه.

تذكّر هذين السطرين وستتمكن من بناء أكورد ثلاثي في الدرجات كلها، وعددها 12:
**4 + 3 = ماجور** (مشرق)
**3 + 4 = مينور** (حزين)`,
      de:
`Ein **Dreiklang** ist ein Akkord aus drei Noten, aufgebaut aus zwei übereinandergestapelten „Terzen“.

**C-Dur-Dreiklang = C – E – G**
· **C** ist der **Grundton**
· **E** ist die **Terz** — **4 Halbtöne** über C
· **G** ist die **Quinte** — noch einmal **3 Halbtöne** über E

Jetzt kommt der spannende Teil: **Senke die Terz um nur einen einzigen Halbton** (E wird zu **E♭**), und sofort wird daraus **C-Moll**. Du hörst, wie er traurig wird. Vergleiche die beiden Akkorde, die ich eben oben gespielt habe.

Merke dir diese zwei Zeilen, und du kannst in allen 12 Tonarten einen Dreiklang bauen:
**4 + 3 = Dur** (hell)
**3 + 4 = Moll** (traurig)`,
    },
    demo: [
      { n: ["C4", "E4", "G4"], d: 1100, f: { C4: 1, E4: 3, G4: 5 }, say: "C MAJOR" },
      { n: [], d: 260 },
      { n: ["C4", "D#4", "G4"], d: 1300, f: { C4: 1, "D#4": 3, G4: 5 }, say: "C MINOR" },
    ],
  },

];
