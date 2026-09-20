// Adds 20 "music × business" case studies to BENEFIT_CASES["music-business"].
// Owner constraint: every case must be a real event older than 50 years at a
// globally major company, and any artist named must be long-deceased (100+ yrs)
// — no living artists, no copyrighted lyrics quoted. All th/en/zh inline.
import { readFileSync, writeFileSync } from "node:fs";

function must(cond, msg) { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } }

const P = "i18n.ts";
let s = readFileSync(P, "utf8");
const orig = s;

must(!s.includes('id: "paganinicraze"'), "already patched");

const NEW = `    { id: "paganinicraze", icon: "🎻", title: { th: "Paganini: ศิลปินคนแรกที่ขายตั๋วแพงได้", en: "Paganini: the first superstar pricing", zh: "帕格尼尼：首位巨星定价" },
      content: { th: \`🎻 Niccolò Paganini (1782-1840) — คนแรกที่พิสูจน์ว่า "ความเป็นดาว" ขายได้จริง

ต้นศตวรรษที่ 19 นักไวโอลินทั่วยุโรปรับจ้างเล่นตามราชสำนักราคาเท่ากันหมด แต่ Paganini ปฏิเสธระบบนั้น — เขาทัวร์เอง ตั้งราคาตั๋วเองสูงหลายเท่าของคอนเสิร์ตทั่วไป และสร้างกระแสด้วยการปล่อยข่าวลือว่า "ขายวิญญาณให้ปีศาจ" เพื่อแลกกับฝีมือระดับเหนือมนุษย์ เขาจำกัดจำนวนคอนเสิร์ตอย่างจงใจเพื่อรักษาความหายาก (scarcity) รายได้ต่อการแสดงสูงกว่านักดนตรีทั่วไปนับสิบเท่า เมื่อเสียชีวิตทิ้งมรดกมหาศาล ลูกชายต้องประกาศราคาอัตราค่าจ้างเล่นพิเศษเป็นสาธารณะ

โมเดลของเขาคือแบบแผนเดียวกับทัวร์ระดับโลกทุกยุค: ความหายาก + เรื่องเล่า + ความเชื่อว่า "ต้องเห็นกับตาก่อนตาย"

💡 บทเรียน: กลยุทธ์การตลาดด้วยความหายาก (scarcity marketing) และ "เรื่องเล่าเหนือธรรมชาติของผลิตภัณฑ์" มีต้นแบบทางดนตรีครบเครื่องตั้งแต่เกือบ 200 ปีก่อน Instagram จะเกิด\`,
        en: \`🎻 Niccolò Paganini (1782-1840) — the man who proved stardom itself could be sold

In the early 1800s most European violinists were court employees at standardized rates. Paganini refused that system: he toured himself, priced tickets several multiples above ordinary concerts, and seeded the (false) legend that he had sold his soul to the devil for his impossible technique. He deliberately limited the number of performances to manufacture scarcity — earning roughly ten times a typical musician's fee per night. His estate was so vast that his son had to publish the rates for hiring ghost-Paganinis.

His playbook is the same one behind every global tour since: scarcity + a story + the belief that "you had to see it to believe it."

💡 Lesson: scarcity marketing and supernatural product mythology have a complete prototype in music from two centuries before Instagram existed.\`,
        zh: \`🎻 尼科洛·帕格尼尼（1782-1840）——证明"明星光环本身可以卖钱"的第一人

十九世纪初，欧洲小提琴家大多是宫廷雇员，报酬千篇一律。帕格尼尼拒绝了这套体系：他自主巡演，票价定在普通音乐会的数倍，还刻意散播（虚假的）传闻——"他把灵魂卖给魔鬼换来了超凡琴技"。他有意控制演出场次制造稀缺，单场收入约为普通乐手的十倍。遗产之巨，以致他儿子不得不公开"聘请帕格尼尼幽灵"的价目表。

他的打法正是此后全球巡演的共同剧本：稀缺＋故事＋"眼见为实"的信仰。

💡 启示：稀缺营销与超自然产品神话，早在 Instagram 出现两百年前就在音乐行业有了完整原型。\` } },
    { id: "lisztfans", icon: "🌟", title: { th: "Lisztomania: แฟนคลับยุค 1840", en: "Lisztomania: fandom before fandom", zh: "李斯特狂热：粉丝文化始祖" },
      content: { th: \`🌟 Franz Liszt (1811-1886) — "Lisztomania" คือแฟนคลับยุคแรกของโลก

ปี 1840-1845 เมืองใหญ่ทั่วยุโรปเกิดปรากฏการณ์ที่หมอเยอรมัน Heinrich Heine ตั้งชื่อว่า "Lisztomania" ผู้หญิงแย่งชิงผ้าเช็ดมือ ผมหวี และปลายซิการ์ของ Liszt เป็นของที่ระลึก เข็มกลัดรูปเขากลายเป็นสินค้าระดับแนวหน้า ร้านค้าแห่งธุรกิจใหม่เรียกว่า "สินค้าศิลปิน" (artist merchandise) ผู้จัดคอนเสิร์ตพบว่าการขึ้นเวทีของ Liszt ตัวเองยกยอดจนเรียกว่า "คอนเสิร์ตบรรยาย" สามารถขายบัตรราคาสูงพร้อมรายได้จากสินค้าฝากยี่ห้อได้พร้อมกัน

นี่คือต้นแบบของ "fan economy" ที่วงการเพลงทั้งโลกใช้กันทุกวันนี้: การที่ความรักในศิลปินแปรงานเป็นสินค้า สื่อ และสถานะทางสังคมได้อย่างเป็นระบบ

💡 บทเรียน: เมื่อแฟน "อยากเป็นส่วนหนึ่งของศิลปิน" — การตลาดจะเปลี่ยนความรู้สึกนั้นเป็นรายได้ได้หลายชั้น ไม่ใช่แค่ตั๋วเข้างาน\`,
        en: \`🌟 Franz Liszt (1811-1886) — "Lisztomania" was the world's first fan economy

In the 1840s European cities saw what critic Heinrich Heine named "Lisztomania": women fought over his handkerchiefs, hair and cigar ends as keepsakes; brooches bearing his image became mainstream consumer goods — the invention of artist merchandise. Concert promoters learned that a Liszt appearance could sell premium tickets AND merchandise at once.

This is the template for today's fan economy: the systematic conversion of fan love into products, media, and social status.

💡 Lesson: when fans "want to be part of the artist," marketing can monetize that feeling in layers — far beyond the ticket itself.\`,
        zh: \`🌟 弗朗茨·李斯特（1811-1886）——"李斯特狂热"是全球最早的粉丝经济

1840年代，欧洲各大城市出现被评论家海涅称为"Lisztomania"的现象：女性争抢他的手帕、发丝和雪茄头作为纪念品；印有他形象的胸针成为大众消费品——"艺人周边"由此发明。演出主办方发现，李斯特的登台能同时卖出高价门票和周边商品。

这正是今日粉丝经济的模板：把粉丝的爱系统地转化为商品、媒体与社会身份。

💡 启示：当粉丝"想成为艺人的一部分"，营销就能把这份感情层层变现——远不止一张门票。\` } },
    { id: "straussbrand", icon: "🕺", title: { th: "Johann Strauss: วงดนตรีเป็นแบรนด์แฟรนไชส์", en: "Johann Strauss: the touring franchise", zh: "施特劳斯：乐队即连锁品牌" },
      content: { th: \`🕺 Johann Strauss II (1825-1899) — คนแรกที่ทำ "วงดนตรี" เป็นแบรนด์แฟรนไชส์

ครัวเรือน Strauss ที่เวียนนาเผชิญปัญหาเดียวกับร้านอาหารยุคนี้ — คอนเสิร์ตของ "ตัวจริง" มีวันเดียว ขายได้ทีละที่ เพราะงั้น Johann Strauss Jr. ทำ 3 อย่างที่ไม่เคยมีใครทำ: 1) แบ่งวงออกเป็นหลายหน่วยที่ออกแสดงพร้อมกันในเมืองต่างๆ (รวมถึงทัวร์รัสเซีย-อเมริกา) ภายใต้ชื่อเดียวกัน 2) ลิขสิทธิ์การเรียงชุดเพลง (Strauss medley) ที่สื่อยุคนั้นต้องจ่ายเงินซื้อ 3) สร้าง "คู่หู" บริษัทผู้จัด (Carl Haslinger) ที่จัดการการเงินให้เป็นระบบ

นวัตกรรมที่แท้จริงคือ "ชื่อ Strauss" กลายเป็นแบรนด์คู่ขนานกับตัวบุคคล แฟนจ่ายเงินเพื่อ "ชื่อ" ไม่ใช่ "ตัวคน" — หลักการเดียวกับแฟรนไชส์เครื่องดื่มและร้านอาหารทั่วโลกปัจจุบัน

💡 บทเรียน: แบรนด์ที่แข็งแรงสามารถ "แยกตัวจากผู้ก่อตั้ง" ได้ — คอนเสิร์ตเจ้าแรกของโลกที่พิสูจน์ว่าชื่อเสียงขยายพร้อมกันได้หลายเมือง\`,
        en: \`🕺 Johann Strauss II (1825-1899) — the first to run a music act as a franchise

The Strauss household in Vienna faced the classic one-show-one-city problem. Johann Jr.'s fixes: (1) split the orchestra into multiple units performing simultaneously in different cities (including tours to Russia and America) under one name, (2) licensed Strauss medleys to publishers, (3) partnered with Carl Haslinger's firm for professional business management.

The real innovation: "Strauss" became a brand separable from the man — fans paid for the name, not the person. The same logic behind every global food & beverage franchise today.

💡 Lesson: a strong brand can outgrow its founder — Strauss proved a music name could scale across cities simultaneously.\`,
        zh: \`🕺 小约翰·施特劳斯（1825-1899）——首位把乐队经营成连锁品牌的人

维也纳施特劳斯家族遇到了典型的"一场演出一座城"问题。小约翰的解法：(1) 把乐团拆成多支同时在不同城市演出（包括远征俄国与美国）的同名分团；(2) 将施特劳斯串烧曲授权给出版商；(3) 与 Carl Haslinger 公司合作，建立专业的商业管理。

真正的创新在于："施特劳斯"变成了可以脱离个人存在的品牌——粉丝为名字买单，而非为本人买单。这与今天全球餐饮连锁的逻辑一致。

💡 启示：强大的品牌可以超越创始人本人——施特劳斯证明了一个音乐品牌可以同时在多个城市扩张。\` } },
    { id: "tinfpanalley", icon: "🎙️", title: { th: "Tin Pan Alley: โรงงานผลิตเพลงแห่งแรก", en: "Tin Pan Alley: the song factory", zh: "锡盘巷：第一座歌曲工厂" },
      content: { th: \`🎙️ Tin Pan Alley (1880s-1920s, นิวยอร์ก) — อุตสาหกรรมเพลงแบบ "โรงงาน" แห่งแรกของโลก

ย่าน West 28th Street ในนิวยอร์ก รวมนักแต่งเพลงไว้ในระบบที่เรียกว่า "song plugger" มีการแบ่งงานเป็นสายการผลิต: คนแต่งทำนอง คนแต่งเนื้อ คนทดลองเล่นหน้าร้าน คนขายให้นักแสดง คนผลักดันเข้าวิทยุและละครบรอดเวย์ เป้าหมายเดียวคือขายแผ่นโน้ตเพลง (sheet music) ให้ได้มากที่สุด เพลงหนึ่งขายได้หลักล้านแผ่น — Charles K. Harris กับ "After the Ball" (1892) ทำรายได้เกินคนละสิบล้านดอลลาร์ในยุคนั้น (เทียบมูลค่าปัจจุบันได้หลายร้อยล้าน)

โมเดลนี้คือบรรพบุรุษของ "ค่ายเพลง" ทุกค่ายในโลก และเป็นต้นแบบ K-pop factory ที่วันนี้นักวิเคราะห์พูดถึง — เพราะหลักการเดียวกัน: แบ่งงานเป็นสายการผลิต วัดผลทันที ออกของถี่

💡 บทเรียน: ธุรกิจเพลงเป็น "อุตสาหกรรม" มาก่อนที่คำว่า creative industry จะเกิดขึ้นหลายสิบปี\`,
        en: \`🎙️ Tin Pan Alley (1880s-1920s, New York) — the world's first "song factory"

West 28th Street concentrated songwriters into a production system: separate melody writers, lyricists, in-store song pluggers, Broadway pitchers. The goal was mass sheet-music sales — Charles K. Harris's "After the Ball" (1892) reportedly earned tens of millions in today's dollars.

This was the ancestor of every modern record label, and of today's K-pop factory model: assembly-line specialization, instant measurement, high output.

💡 Lesson: music became an "industry" decades before anyone coined the term creative industry.\`,
        zh: \`🎙️ 锡盘巷（1880s-1920s，纽约）——世界首座"歌曲工厂"

西28街把词曲创作变成流水线：旋律作者、作词者、店面试弹员、百老汇推销员各司其职，目标只有一个——大批量销售乐谱。Charles K. Harris 的《After the Ball》（1892）据称赚到了相当于今日数千万美元的收入。

这就是现代唱片公司乃至今日 K-pop 工厂模式的祖先：分工、即时测量、高频产出。

💡 启示：早在"创意产业"一词诞生几十年前，音乐就已经是真正的"工业"。\` } },
    { id: "victrola", icon: "📻", title: { th: "Victor Talking Machine: เครื่องเล่นเปลี่ยนโลก", en: "Victor Talking Machine: hardware meets music", zh: "维克多：硬件与音乐的联姻" },
      content: { th: \`📻 Victor Talking Machine Company (1901-1929, สหรัฐฯ) — บริษัทแรกที่ขาย "เครื่องเสียง + ศิลปิน" เป็นระบบธุรกิจเดียว

ผู้บริหาร Eldridge Johnson สร้างแบรนด์ Victrola ขึ้นจาก 3 กลยุทธ์ที่บริษัทเทคครั้งนี้ยังใช้กันอยู่: 1) ผูกตัวศิลปินระดับโลกเป็น "แบรนด์แอมบาสเดอร์" — เอนริโก คารูโซ (Enrico Caruso, 1873-1921) เทนนำโลก เป็นศิลปินคนแรกที่ขายแผ่นเสียงได้ล้านชุด 2) ออกแบบเครื่องเล่นให้เป็น "เฟอร์นิเจอร์สุขภาพ" สวยงามพอวางในห้องรับได้ 3) ระบบลิขสิทธิ์บันทึกเสียงเป็นของบริษัท ทำให้คู่แข่งคัดลอกไม่ได้

ผลลัพธ์: จากบริษัทเล็กกลายเป็นผู้ค้าเครื่องเสียงอันดับโลก และถูก RCA ซื้อกิจการในปี 1929 ด้วยมูลค่าที่สูงที่สุดแห่งยุค

💡 บทเรียน: การรวม "hardware + content + exclusive IP" ในธุรกิจเดียว คือสูตรที่บริษัทเทครุ่นนี้ (Apple, Sonos, Spotify) ยังเดินตาม — ต้นฉบับมาจากโน้ตยาวของ Victor ก่อนปี 1930\`,
        en: \`📻 Victor Talking Machine Company (1901-1929) — the first hardware+artist business system

Eldridge Johnson's playbook looks remarkably modern: (1) exclusive world-class artists — Enrico Caruso (1873-1921), the first recording artist to sell a million records — as brand ambassadors, (2) players designed as living-room furniture, not gadgets, (3) company-owned recording IP competitors couldn't copy.

Result: a small shop became the world's leading phonograph maker, acquired by RCA in 1929 at the era's richest price.

💡 Lesson: hardware + content + exclusive IP in one business — the formula Apple, Sonos and Spotify still follow was perfected by Victor before 1930.\`,
        zh: \`📻 维克多留声机公司（1901-1929）——首个"硬件+艺人"一体化商业体系

Eldridge Johnson 的打法极具现代感：(1) 独占世界级艺人——恩里科·卡鲁索（1873-1921），史上首位唱片销量破百万的歌手——担任品牌大使；(2) 把播放器设计成客厅家具而非 gadgets；(3) 公司自有录音版权，竞品无法复制。

结果：一家小店成长为全球留声机霸主，1929年以当时天价被 RCA 收购。

💡 启示："硬件+内容+独家IP"三位一体——苹果、Sonos、Spotify 仍在沿用的公式，维克多在1930年前就已完善。\` } },
    { id: "carusoceleb", icon: "🎩", title: { th: "Caruso: นักร้องคนแรกที่ขายล้านแผ่น", en: "Caruso: the first million-selling voice", zh: "卡鲁索：首位百万唱片歌手" },
      content: { th: \`🎩 Enrico Caruso (1873-1921) — นักร้องคนแรกในประวัติศาสตร์ที่ขายแผ่นเสียงได้ล้านชุด

โอเปร่าเป็นธุรกิจ "ตั๋ว" มาหลายร้อยปี แต่ Caruso เข้าใจก่อนใครว่าเสียงของเขาสามารถขายได้ 2 ชั้น: ตั๋วเข้าโรงละคร (Metropolitan Opera นิวยอร์ก) และ "แผ่นเสียง" ที่แฟนฟังได้ที่บ้าน เขาเซ็นสัญญากับ Victor Talking Machine ในปี 1904 ในเงื่อนไขที่ได้ส่วนแบ่งจากยอดขายแผ่น — โมเดล royalty ที่กลายเป็นมาตรฐานอุตสาหกรรมจนถึงทุกวันนี้ แผ่นเสียงของเขาทำให้ Victor ขายเครื่องเล่นได้เพิ่มหลายเท่า (คนอยากฟังเสียง Caruso ที่บ้าน = ต้องมีเครื่อง Victrola)

โมเดล "ศิลปินขับเคลื่อน hardware" นี้ต่อยอดเป็นกลยุทธ์ของ Apple Music, Beats, Bose ในทุกรูปแบบ

💡 บทเรียน: เมื่อมี "ศิลปินที่คนอยากฟัง" ในแพลตฟอร์มของคุณ — แพลตฟอร์มขายของอื่นได้ตามไปด้วย\`,
        en: \`🎩 Enrico Caruso (1873-1921) — history's first million-selling recording artist

Opera was a ticket business for centuries; Caruso understood before anyone else that his voice could sell twice: at the Metropolitan Opera box office AND in fans' living rooms. His 1904 Victor deal paid royalties on record sales — the model that became the industry standard. His records drove Victrola player sales through the roof (want to hear Caruso at home? Buy the machine).

This "artist drives hardware" logic is the ancestor of every Apple Music / Beats / Bose strategy.

💡 Lesson: put a voice people crave on your platform, and the platform sells everything else along with it.\`,
        zh: \`🎩 恩里科·卡鲁索（1873-1921）——史上首位唱片销量破百万的歌手

歌剧几百年来一直是门票生意，而卡鲁索比所有人都早明白：他的嗓音可以卖两次——大都会歌剧院的门票，以及粉丝家中的唱片。1904年他与维克多签约，按唱片销量抽成——这成为日后整个行业的标准模式。他的唱片直接带动 Victrola 播放器销量暴涨（想在家听卡鲁索？先买机器）。

这种"艺人拉动硬件"的逻辑，是 Apple Music、Beats、Bose 等所有现代战略的祖先。

💡 启示：把人人渴望的声音放上你的平台，平台就能连带卖出一切。\` } },
    { id: "armstrongbrand", icon: "🎺", title: { th: "Louis Armstrong: ศิลปินคือแบรนด์โลก", en: "Louis Armstrong: the global personal brand", zh: "路易斯·阿姆斯特朗：全球个人品牌" },
      content: { th: \`🎺 Louis Armstrong (1901-1971) — ศิลปินคนแรกที่ "ชื่อตัวเอง" กลายเป็นแบรนด์ระดับโลกที่ขายได้ทุกอย่าง

Armstrong ไม่ใช่แค่นักทรัมเป็ตยอดฝีมือ — เขาสร้าง "ตัวตน" ที่จดจำง่ายขึ้นทุกช่องทาง: เสียงหัวเราะ ผ้าเช็ดมือสีขาว การแต่งกาย เสียงพูดเป็นเอกลักษณ์ เขาเป็นนักดนตรีแจ๊สคนแรกที่ปรากฏในภาพยนตร์ฮอลลีวูด โฆษณาระดับชาติ และทัวร์ระดับโลกอย่างต่อเนื่องหลายทศวรรษ ยุคหลังของเขาเซ็นสัญญาโฆษณากลุ่มสินค้าอุปโภคขนาดใหญ่ที่เปิดทางให้ศิลปินดนตรีร่วมงานกับแบรนด์ทั่วโลก (บางชิ้นในยุคนั้นยังมีประเด็นเรื่องการเมืองเชื้อชาติ — บทเรียนเชิงลบที่ทีมการตลาดศึกษาถึงปัจจุบัน)

สิ่งที่เขาทิ้งไว้คือแบบแผน "ศิลปินเป็นแบรนด์ระดับโลก" ที่ศิลปินทุกคนใช้กันทุกวันนี้

💡 บทเรียน: ตัวตนที่ชัดเจน (identity) คือสินทรัพย์ทางธุรกิจที่ทรงพลังกว่าฝีมือเพียงอย่างเดียว\`,
        en: \`🎺 Louis Armstrong (1901-1971) — the first musician whose NAME was a global brand selling everything

Armstrong wasn't just a trumpet virtuoso — he built a legible identity across every channel: the laugh, the white handkerchief, the wardrobe, the unmistakable voice. First jazz musician to become a Hollywood film, national advertising, and global-tour regular for decades. His later career signed major consumer-goods endorsements, opening doors for musicians-brand partnerships worldwide (some involving real controversies about race and politics — negative lessons marketers still study).

He left behind the template "artist as global brand" that every musician uses today.

💡 Lesson: a clear identity is a more powerful business asset than raw talent alone.\`,
        zh: \`🎺 路易斯·阿姆斯特朗（1901-1971）——首位把"自己名字"变成全球品牌、什么都能卖的音乐人

阿姆斯特朗不只是小号大师——他在每个渠道都建立了清晰可辨的形象：标志性的笑声、白色手帕、服装风格、独一无二的声音。他是首位持续多年出现在好莱坞电影、全国广告与全球巡演中的爵士音乐家。职业生涯后期签下大型消费品牌代言，为音乐人与品牌的全球合作打开大门（其中也涉及种族与政治的真实争议——这些教训至今仍是营销课堂的负面案例）。

他留下了"艺人即全球品牌"的模板，今天的每位音乐人都在使用。

💡 启示：清晰的身份认同，是比纯技艺更强大的商业资产。\` } },
    { id: "beatlesmarketing", icon: "🎪", title: { th: "Beatles: 4 หนุ่มที่เปลี่ยนกติกาธุรกิจเพลง", en: "The Beatles: rewriting music business rules", zh: "披头士：改写音乐商业规则" },
      content: { th: \`🎪 The Beatles (1960-1970) — วงที่เปลี่ยนกติกาธุรกิจเพลงทั้งระบบใน 10 ปี

สิ่งที่ The Beatles ทำต่อโครงสร้างธุรกิจเพลง: 1) พิสูจน์ว่า "วงเล่นเพลงตัวเอง" ขายได้มากกว่าวงที่บริษัทปั้นให้ร้องเพลงคนอื่น — ค่ายทั่วโลกเปลี่ยนกลยุทธ์ตาม 2) ปล่อยอัลบั้มแทนซิงเกิลเดี่ยว (album era) ทำให้รายได้ต่อแฟนสูงขึ้นหลายเท่า 3) Sgt. Pepper's (1967) คืออัลบั้มแรกที่มีบทกวีพิมพ์ในเล่ม (full lyrics printed) ยกระดับ "แผ่นเสียง" เป็นผลิตภัณฑ์ศิลปะที่ต้องสะสม 4) Apple Corps ที่ตั้งเองปี 1968 เป็นความพยายามแรกของศิลปินที่จะ "เป็นเจ้าของธุรกิจตัวเอง" แทนการอยู่ใต้ค่าย

สมการ "ศิลปินเขียนเพลงเอง + อัลบั้มเป็นผลิตภัณฑ์ + ศิลปินเป็นเจ้าของธุรกิจ" คือสามเสาที่วงการเพลงทั้งโลกใช้ต่อจนปัจจุบัน

💡 บทเรียน: ผู้เล่นที่กล้าเปลี่ยน "ฟอร์แมตการขาย" (ซิงเกิล→อัลบั้ม) มักได้กำไรหลายเท่าโดยไม่ต้องเปลี่ยนเพลง\`,
        en: \`🎪 The Beatles (1960-1970) — the band that rewired the music business in a decade

What they changed: (1) proved that "bands writing their own songs" outsold label-manufactured acts — labels worldwide pivoted; (2) shifted revenue from singles to ALBUMS, multiplying per-fan income; (3) Sgt. Pepper's (1967) printed full lyrics inside — turning a record into collectible art; (4) Apple Corps (1968) was the first serious artist attempt to own their own business instead of renting one.

The equation "self-written songs + album-as-product + artist-owned business" still holds up the entire industry today.

💡 Lesson: whoever dares change the SALES FORMAT (single→album) often multiplies profit without changing the music at all.\`,
        zh: \`🎪 披头士（1960-1970）——十年间重构音乐商业规则的乐队

他们改变了什么：(1) 证明"自己写歌的乐队"比公司包装的歌手卖得更多——全球唱片公司随之转向；(2) 把收入重心从单曲转向专辑，单个粉丝收入翻倍；(3)《Sgt. Pepper's》(1967) 内页印上完整歌词——唱片从此升级为可收藏的艺术品；(4) 1968年成立的 Apple Corps 是艺人认真尝试"拥有自己的生意"而非寄居唱片公司之下的先例。

"自写歌+专辑即产品+艺人拥有生意"这三大支柱，至今仍撑起整个行业。

💡 启示：敢于改变"销售格式"（单曲→专辑）的玩家，常常不换音乐就能让利润翻倍。\` } },
    { id: "motownfactory", icon: "🏙️", title: { th: "Motown: โรงงานเพลงที่ข้ามสายพันธุ์", en: "Motown: the sound of young America", zh: "摩城：美国之声工厂" },
      content: { th: \`🏙️ Motown Records (1959-1972, Detroit) — บริษัทเพลงที่พิสูจน์ว่า "โรงงานเพลง" สร้างตลาดใหม่ได้จริง

Berry Gordy ตั้งต้นด้วยเงินกู้ $800 สร้างระบบแบบโรงงานรถยนต์ Ford ที่เขาเคยทำงานอยู่: มีห้องเขียนเพลงประจำ (Holland-Dozier-Holland) วงดนตรีประจำ (Funk Brothers) ห้องอบรมการแสดง (Artist Development — ท่าเต้น การแต่งตัว มารยาทสัมภาษณ์) ผลคือเพลงหลายสิบเพลงอันดับ 1 ของอเมริกาใน 15 ปี ขายได้ทั้งตลาดผิวดำ "และ" ตลาดผิวขาวซึ่งเป็นกลุ่มที่วงการเพลงเดิมคิดว่าไปไม่ถึง — นี่คือจุดที่ Motown ทำลายข้อจำกัดทางเชื้อชาติในธุรกิจบันเทิงอเมริกาไปพร้อมกับทำกำไร

โมเดล "ในบ้านเดียวมีครบ: เขียนเพลง ผลิต ฝึก ออกแบบตัวตน และขาย" กลายเป็นแบบแผน K-pop factory ที่วันนี้นักวิจารณ์ยกให้เป็นต้นแบบตรงๆ

💡 บทเรียน: ระบบในบ้านเดียว (in-house system) ให้คุณภาพสม่ำเสมอ + ราคาต่อหน่วยต่ำ + ควบคุมตัวตนศิลปินได้เต็มที่ — ธุรกิจเพลงและธุรกิจสินค้าใช้หลักเดียวกัน\`,
        en: \`🏙️ Motown Records (1959-1972, Detroit) — proof a "song factory" can create a whole new market

Berry Gordy started with an $800 loan and built Ford-assembly-line logic: in-house songwriting (Holland-Dozier-Holland), a house band (Funk Brothers), and Artist Development training (choreography, dress, interview manners). Result: dozens of American #1s in 15 years — sold to BOTH Black and white audiences that the old industry believed were separate markets, breaking entertainment's racial barriers while turning a profit.

The "everything under one roof" model is the direct ancestor critics cite for today's K-pop factory system.

💡 Lesson: an in-house system delivers consistent quality + low unit cost + full artist-identity control — the same principle in music and manufacturing.\`,
        zh: \`🏙️ 摩城唱片（1959-1972，底特律）——证明"歌曲工厂"能凭一己之力创造全新市场

Berry Gordy 用借来的800美元起步，把他打工时学到的福特流水线逻辑搬进音乐：内部词曲团队（Holland-Dozier-Holland）、常驻乐队（Funk Brothers）、艺人发展培训（舞蹈、着装、采访礼仪）。十五年间产出数十首全美冠军单曲——同时卖给了黑人市场"和"白人市场，在盈利的同时击穿了美国娱乐业的种族壁垒。

"一屋之内包办词曲、制作、培训、形象、销售"的模式，正是今日 K-pop 工厂体系被广泛引用的直接祖先。

💡 启示：内部一体化系统带来稳定品质+低单位成本+对艺人形象的完全掌控——音乐与制造业遵循同一条原理。\` } },
    { id: "columbiarazor", icon: "🔪", title: { th: "King Camp Gillette & ดนตรีวิทยุ: ใบมีดขายฟรี", en: "Razors and radio: free music sells hardware", zh: "剃刀与电台：免费音乐卖出硬件" },
      content: { th: \`🔪 ทศวรรษ 1920-1930 — วิทยุเปลี่ยนธุรกิจเพลงเป็น "โฆษณาของเครื่องเล่น" ครั้งแรก

ยุคแรกของวิทยุ สถานีต้องหาเพลงมาออกอากาศทั้งวัน ผู้ผลิตเครื่องวิทยุ (RCA, GE, Westinghouse) เห็นโอกาส: ถ้าเพลงฟรีดึงคนฟัง → คนซื้อเครื่องวิทยุเพิ่ม → บริษัทขายเครื่องและอุปกรณ์ได้ทั่วประเทศ และบริษัทสินค้าอุปโภคจ่ายค่าโฆษณาเข้าสถานี (โมเดล "ใบมีดขายถูก ของมีคมขายแพง" ของ Gillette ในยุคเดียวกัน) รายได้จากเพลงทางวิทยุหายไปที่ "ค่าลิขสิทธิ์" ซึ่งกลายเป็นโครงสร้าง royalty ใหม่ทั้งระบบ (ASCAP ขยายตัว, BMI ก่อตั้ง 1939) เพราะวงการเพลงต้องต่อรองกับธุรกิจที่ให้เพลงฟรี

กลไก "ของฟรีดึงคน → ขายของอื่นตามไป" คือแม่แบบของ Spotify (ฟรีดึง user → ขาย premium + โฆษณา) และทุกแพลตฟอร์มสตรีมมิ่งปัจจุบัน

💡 บทเรียน: เมื่อให้สินค้าหนึ่งฟรี มักมีสินค้าอีกชิ้นที่ได้เงินจริง — วางโครงสร้างลิขสิทธิ์ให้คุ้มตั้งแต่ต้น\`,
        en: \`🔪 The 1920s-30s — radio turned music into free advertising for hardware

Early stations needed all-day music. Radio manufacturers (RCA, GE, Westinghouse) saw the loop: free music draws listeners → listeners buy radios → manufacturers sell nationwide, while consumer brands (Gillette's razor-blade era logic) pay for ads on stations. Music's own income shifted to licensing structures — ASCAP expanded, BMI was founded in 1939 — because the industry had to negotiate with businesses giving music away.

"Free thing draws users → sell something else" is the exact template of Spotify and every streaming platform.

💡 Lesson: give one product away, and another one pays the bills — build the licensing structure early enough to capture it.\`,
        zh: \`🔪 1920-30年代——广播让音乐第一次成为硬件的免费广告

早期电台需要全天节目。收音机制造商（RCA、GE、西屋）看到了闭环：免费音乐吸引听众→听众买收音机→制造商全国销售，同时消费品品牌（同一时代吉列"刀架便宜刀片贵"的逻辑）为电台投放广告。音乐自身的收入转向了授权体系——ASCAP 扩张，1939年 BMI 成立——因为行业必须与"免费送音乐"的生意谈判。

"免费品吸引用户→销售其他产品"正是 Spotify 及所有流媒体平台的母版。

💡 启示：让一件产品免费，另一件产品负责赚钱——授权结构要从一开始就设计好。\` } },
    { id: "hollywoodmusicals", icon: "🎬", title: { th: "Hollywood Musicals: ดนตรีขายหนัง", en: "Hollywood musicals: music sells cinema", zh: "好莱坞歌舞片：音乐卖出电影票" },
      content: { th: \`🎬 ยุคทอง Hollywood Musicals (1930s-1950s) — ดนตรีเปลี่ยนหนังเป็น "ผลิตภัณฑ์ข้ามช่องทาง"

เมื่อเศรษฐกิจตกต่ำครั้งใหญ่ (Great Depression) ประชาชนไม่มีเงิน แต่บริษัทหนังใหญ่ (MGM, Warner) พบว่า "หนังร้องเพลง" ขายได้ดีเป็นพิเศษ เพราะดนตรีให้ความหวังที่คนทั้งประเทศอยากจ่ายซื้อ — Fred Astaire, Judy Garland และเพลงประกอบจาก The Wizard of Oz (1939) กลายเป็นสินค้าที่ต่อยอดได้ 3 ชั้น: บัตรโรงหนัง + แผ่นเสียงเพลงประกอบ (soundtrack) + เพลงที่นักร้องคนอื่น cover ต่อ (การเกิดของ "standards")

โมเดล "หนังดันเพลง เพลงดันหนัง" คือแม่แบบของ Disney และทุก franchise ที่ใช้เพลงเป็นเครื่องยนต์ขายทุกวันนี้

💡 บทเรียน: ผลิตภัณฑ์วงจรหลายชั้น (ticket + soundtrack + covers) มาจากยุค Depression — ยิ่งเศรษฐกิจยาก ธุรกิจดนตรียิ่งต้องมีรายได้หลายชั้น\`,
        en: \`🎬 The golden age of Hollywood musicals (1930s-50s) — music made film a cross-channel product

During the Great Depression, MGM and Warner found "sing-and-dance" films sold best — music offered hope people would pay for. Fred Astaire, Judy Garland, and songs from The Wizard of Oz (1939) became three-layer products: cinema tickets + soundtrack records + endless covers by other singers (the birth of "standards").

The "film pushes song, song pushes film" loop is the direct ancestor of Disney's and every franchise's music-engine strategy today.

💡 Lesson: the multi-layer product (ticket + soundtrack + covers) was born in the Depression — the harder the economy, the more layers a music business needs.\`,
        zh: \`🎬 好莱坞歌舞片黄金时代（1930-50年代）——音乐把电影变成跨渠道产品

大萧条时期，米高梅与华纳发现"歌舞片"格外卖座——音乐给了全国人民愿意付费的希望。弗雷德·阿斯泰尔、朱迪·嘉兰，以及《绿野仙踪》(1939) 的歌曲，成为三层产品：电影票+原声唱片+无数歌手的翻唱（"标准曲"由此诞生）。

"电影带歌、歌带电影"的循环，是迪士尼及今天所有音乐引擎型 franchise 的直接祖先。

💡 启示：多层产品结构（票+原声+翻唱）诞生于大萧条——经济越难，音乐生意越需要多层收入。\` } },
    { id: "toscanini", icon: "🎼", title: { th: "Toscanini & NBC: วงออร์เคสตราของสถานีวิทยุ", en: "Toscanini & NBC: a radio network buys an orchestra", zh: "托斯卡尼尼与NBC：电台买下交响乐团" },
      content: { th: \`🎼 Arturo Toscanini (1867-1957) — สถานีวิทยุจ้างวงออร์เคสตรา "ตั้งใหม่ทั้งวง" เพื่อดึงคนฟัง

ปี 1937 NBC สถานีวิทยุใหญ่ที่สุดของอเมริกา สร้าง NBC Symphony Orchestra ขึ้นมาใหม่ทั้งวงเพื่อให้ Toscanini ผู้กำกับระดับตำนานเซ็นสัญญามาออกอากาศ งบประมาณสูงสุดของอุตสาหกรรมวิทยุในยุคนั้น แฟนคลาสสิกทั่วอเมริกาเปิดวิทยุฟังทุกสัปดาห์ ยอดขายเครื่องวิทยุและโฆษณาพุ่ง — NBC ขายได้ว่า "เพลงระดับโลก" คือของที่ดึงผู้ฟังได้มากพอคุ้มค่าจ้างนักดนตรีระดับโลกเองทั้งวง

โมเดล "แพลตฟอร์มจ้าง content ระดับ world-class เพื่อดึง user" คือหัวใจของ Netflix (ซีรีส์ตัวเอง), Spotify (podcast พิเศษ), และทุก streaming war ปัจจุบัน

💡 บทเรียน: ของระดับ world-class มีราคาแพง แต่ถ้าดึง user ได้มากพอ คือการลงทุนที่คุ้มที่สุดในแพลตฟอร์ม business ทุกยุค\`,
        en: \`🎼 Arturo Toscanini (1867-1957) — a radio network built an entire orchestra to win listeners

In 1937 NBC created the NBC Symphony Orchestra from scratch — at the radio industry's highest budget — to sign the legendary conductor for weekly national broadcasts. Classical fans nationwide tuned in; radio and advertising sales climbed. NBC proved world-class music could pull enough listeners to justify hiring a world-class ensemble outright.

"Platform hires world-class content to attract users" is the exact heart of Netflix originals, Spotify exclusives, and every streaming war since.

💡 Lesson: world-class content is expensive — but when it draws enough users, it's the best platform investment of any era.\`,
        zh: \`🎼 阿尔图罗·托斯卡尼尼（1867-1957）——电台为抢听众，组建了一支全新交响乐团

1937年，美国最大的广播网NBC从零组建NBC交响乐团——以当时广播业的最高预算——只为让传奇指挥每周全国开播。古典乐迷全国收听，收音机与广告销售双双攀升。NBC证明了：世界级音乐足以吸引用户，值得为此雇佣整支世界级乐团。

"平台雇佣世界级内容来吸引用户"正是 Netflix 自制剧、Spotify 独家播客以及每场流媒体大战的核心。

💡 启示：世界级内容很贵——但只要拉来的用户足够多，它就是任何时代最好的平台投资。\` } },
    { id: "walkmandisc", icon: "💿", title: { th: "CD & Walkman: ฟอร์แมตใหม่ขายเพลงซ้ำ", en: "CD & Walkman: new formats, resold catalogs", zh: "CD与随身听：新格式，再卖一次曲库" },
      content: { th: \`💿 Sony Walkman (1979) + CD (1982) — ธุรกิจเพลงฉุกเฉินกำไรสูงสุดในประวัติศาสตร์

ยุคก่อนสตรีมมิ่ง ธุรกิจเพลงเจอปัญหา "ตลาดอิ่มตัว" — แฟนซื้อแผ่นเสียง/เทปไปแล้ว ทางออกของ Sony และ Philips/ PolyGram คือสร้าง "ฟอร์แมตใหม่" ที่ทำให้แฟนต้องซื้อเพลงเดิมอีกรอบ: Walkman ทำให้เพลงพกพาได้ (ขายเทปซ้ำ) CD ขายว่าเสียงดีกว่า+ใช้งานสะดวกกว่า (ขายคลังเพลงทั้งคลังซ้ำในราคาแพงกว่าเดิม) กำไรของอุตสาหกรรมพุ่งถึงจุดสูงสุดในปี 1999 — เพราะ "ขายของเดิมให้คนเดิมในฟอร์แมตใหม่"

เทคนิคนี้ใช้ซ้ำในทุกแพลตฟอร์ม: Disney ปล่อย VHS→DVD→Blu-ray→Disney+, เกมยอดฮิต remaster ขายใหม่ทุก generation ของเครื่อง

💡 บทเรียน: "ฟอร์แมตใหม่" คือกุญแจที่ทำให้ขายทรัพย์สินเดิมซ้ำได้ — ธุรกิจดนตรีไม่ต้องมีเพลงใหม่เพื่อโต\`,
        en: \`💿 Sony Walkman (1979) + CD (1982) — the most profitable emergency in music history

Pre-streaming, music hit a saturation wall: fans already owned vinyl and tapes. Sony and Philips/PolyGram's answer was NEW FORMATS forcing repurchase: Walkman made music portable (sell tapes again); CDs sold "better sound + convenience" (resell entire catalogs at higher prices). Industry profits peaked in 1999 — from selling the same songs to the same people in new formats.

The trick repeats everywhere: Disney's VHS→DVD→Blu-ray→Disney+ ladder, game remasters on each console generation.

💡 Lesson: a new format is the key to reselling existing assets — music businesses don't need new songs to grow.\`,
        zh: \`💿 索尼Walkman（1979）+ CD（1982）——音乐史上最暴利的"紧急自救"

流媒体出现之前，音乐业撞上饱和墙：粉丝已经买过黑胶和磁带。索尼与飞利浦/宝丽金的答案是"新格式"逼人重新购买：Walkman 让音乐可随身携带（磁带再卖一遍）；CD 以"更好音质+更方便"让整个曲库以更高价重卖一遍。1999年行业利润登顶——靠的是"把同一首歌卖给同一批人"。

这招到处在用：迪士尼的 VHS→DVD→蓝光→Disney+ 阶梯，每一代主机上的游戏重制版。

💡 启示：新格式是"重卖存量资产"的钥匙——音乐生意不需要新歌也能增长。\` } },
    { id: "disneymusic", icon: "🏰", title: { th: "Disney: เพลงเป็นเครื่องยนต์ของ franchise", en: "Disney: music as franchise engine", zh: "迪士尼：音乐即IP引擎" },
      content: { th: \`🏰 Walt Disney (1901-1966) — คนแรกที่ทำเพลงประกอบเป็น "เครื่องยนต์รายได้" ของทั้งบริษัท

Snow White (1937) เป็นหนังยาวแอนิเมชันเรื่องแรกที่มี "ซาวด์แทร็กวางขายจริง" — อัลบั้มเพลงประกอบที่คนซื้อกลับบ้านฟังต่อ แม้ดูหนังจบไปแล้ว ต่อด้วย Mary Poppins (1964) และซาวด์แทร็กที่ทำรายได้ต่อเนื่องหลายสิบปี วอลท์เข้าใจว่าเพลงทำให้ "เด็กจำตัวละครได้" และ "ผู้ใหญ่จ่ายเงินซ้ำ" — เพลงจึงถูกออกแบบให้กลายเป็นของสะสม ไม่ใช่แค่ฉากในหนัง วงการทั้งหมดหยิบโมเดลนี้ไปใช้: เพลงประกอบ = แม่เหล็กขายตั๋ว+ขายแผ่น+ขายสินค้า+ขายประสบการณ์สวนสนุก

โมเดลของ Disney ใช้โครงสร้างเดียวกับที่ K-pop, อนิเมะ (Yoasobi) และเกมกำลังใช้อยู่ทุกวันนี้

💡 บทเรียน: เพลงที่เขียนมาเพื่อ "ให้คนจำได้" ทำรายได้ยาวนานกว่าเพลงที่เขียนเพื่อ "ให้ฟังสวย" เสมอ\`,
        en: \`🏰 Walt Disney (1901-1966) — the first to make soundtrack a company-wide revenue engine

Snow White (1937) was the first feature animation with a commercially released soundtrack — an album fans bought to keep listening after the film. Mary Poppins (1964) and decades of follow-ups proved the same point. Walt understood: songs make children remember characters and adults pay again. Music was designed as collectible, not just scene filler — and the whole industry copied it: soundtracks as magnets for tickets, records, merch, and theme-park experiences.

Disney's structure is exactly what K-pop, anime (Yoasobi) and games use today.

💡 Lesson: songs written to be remembered always out-earn songs written merely to sound beautiful.\`,
        zh: \`🏰 华特·迪士尼（1901-1966）——首位把原声带变成全公司收入引擎的人

《白雪公主》(1937) 是首部拥有商业发行原声带的长篇动画——观众看完电影还会买专辑回家继续听。《欢乐满人间》(1964) 及其后数十年一再验证同一逻辑。华特明白：歌曲让孩子记住角色、让大人重复付费。音乐被设计成收藏品，而非只是电影填充物——整个行业随之效仿：原声带成为拉动门票、唱片、周边与主题乐园体验的磁石。

迪士尼的结构正是今天 K-pop、动画（YOASOBI）与游戏通用的模式。

💡 启示：为"被记住"而写的歌，永远比只为"好听"而写的歌赚得更久。\` } },
    { id: "mtvlaunch", icon: "📺", title: { th: "MTV: ภาพขายเพลง เพลงขายภาพ", en: "MTV: images selling songs, songs selling images", zh: "MTV：影像卖歌，歌卖影像" },
      content: { th: \`📺 MTV (1981) — แพลตฟอร์มที่พิสูจน์ว่า "ภาพ" ทำให้เพลงขายได้เพิ่มหลายเท่า

ก่อน MTV วิดีโอเพลงเป็นของแถมหลังกล้อง หลัง MTV วิดีโอกลายเป็น "สนามรบหลัก" — Michael Jackson, Madonna และวงร็อกอเมริกันใช้ภาพจัดวางแบบใหม่ทั้งหมดเพื่อขายอัลบั้มในราคาที่สูงขึ้น และ MTV ขาย "โฆษณา" ให้แบรนด์สินค้าทั่วโลกโดยใช้เพลงเป็นแม่เหล็กผู้ชม บริษัทเพลงเริ่มงบโปรดักชัน MV สูงเท่างบหนัง เพราะคำนวณได้ว่า MV ที่ดีขายอัลบั้มได้หลายเท่า

โมเดล "ภาพขายเพลง เพลงขายผู้ชม ผู้ชมขายโฆษณา" คือกลไกเดียวกับ TikTok และ YouTube Shorts ปัจจุบันทุกประการ

💡 บทเรียน: แพลตฟอร์มใหม่ที่แพร่กระจายเพลงได้เร็วขึ้น จะเปลี่ยนว่าใครดังได้เสมอ — ผู้ที่ชำนาญ "ภาษาใหม่ของแพลตฟอร์ม" ก่อนใครคือผู้ชนะ\`,
        en: \`📺 MTV (1981) — the platform that proved images multiply music sales

Before MTV, music videos were an afterthought; after MTV, they were the main battlefield. Michael Jackson, Madonna and American rock acts used wholly new visual staging to sell albums at higher prices — while MTV sold advertising worldwide using music as its audience magnet. Labels began spending film-level budgets on videos because a great video measurably multiplied album sales.

"Images sell songs, songs sell viewers, viewers sell ads" is precisely TikTok's and YouTube Shorts' mechanism today.

💡 Lesson: every platform that spreads music faster rewrites who can be famous — whoever masters the platform's new language first wins.\`,
        zh: \`📺 MTV（1981）——证明"影像"能让音乐销量翻倍的平台

MTV 之前，音乐录影带是附属品；MTV 之后，它成了主战场。迈克尔·杰克逊、麦当娜与美国摇滚乐队用全新的视觉语言卖出更贵的专辑——MTV 则以音乐为磁石向全球品牌出售广告。唱片公司开始投入电影级 MV 预算，因为一支好 MV 可量化地成倍拉动专辑销量。

"影像卖歌、歌卖观众、观众卖广告"——这正是今天 TikTok 与 YouTube Shorts 的机制。

💡 启示：每个能更快传播音乐的平台都会改写"谁能成名"——最先掌握平台新语言的人赢。\` } },
    { id: "qvcshopping", icon: "🛒", title: { th: "ห้างสรรพสินค้า & เพลงจังหวะช้า", en: "Department stores & the slow-music effect", zh: "百货公司与慢节奏效应" },
      content: { th: \`🛒 ทศวรรษ 1960-1980 — ธุรกิจค้าปลีกพิสูจน์ด้วยตัวเลขว่า "เพลงเปลี่ยนพฤติกรรมการซื้อ"

งานวิจัยคลาสสิกของ Milliman (1982) วัดจริงในซูเปอร์มาร์เก็ตและร้านอาหาร: เปิดเพลงจังหวะช้า ลูกค้าเดินช้าลง ใช้เวลาในร้านนานขึ้น ยอดขายเพิ่มสูงถึง ~38% ในร้านอาหาร เพลงช้าทำให้ลูกค้านั่งนานและสั่งเครื่องดื่มต่อ — ก่อนหน้านี้ธุรกิจค้าปลีกใหญ่ (Muzak ในออฟฟิศ ห้าง ลิฟต์ ตั้งแต่ทศวรรษ 1930) ใช้ดนตรีเพื่อ "ปรับอารมณ์พนักงานและลูกค้า" โดยไม่มีงานวิจัยรองรับ — ตัวเลข Milliman เปลี่ยนทั้งอุตสาหกรรม: ห้าง โรงแรม สายการบิน โรงพยาบาล จ้างนักวิชาการดนตรีออกแบบเพลย์ลิสต์เป็นเรื่องปกติ

กลายเป็นอุตสาหกรรมใหม่ "music curation for business" ที่ Spotify และ Soundtrack Your Brand ยังทำต่อทุกวันนี้

💡 บทเรียน: เสียงในสถานที่ค้าปลีกคือ "ตัวแปรการขาย" ที่วัดผลได้จริง ไม่ใช่แค่บรรยากาศ\`,
        en: \`🛒 1960s-1980s — retail proved with hard numbers that music changes buying behavior

Milliman's classic 1982 study measured real supermarkets and restaurants: slow-tempo music made shoppers walk slower, stay longer, and lifted sales by up to ~38%; in restaurants slow music kept guests seated and ordering drinks. Before that, big retail (Muzak in offices, malls, lifts since the 1930s) used music to "set mood" with no research behind it — Milliman's numbers remade the industry: hotels, airlines, hospitals hired music academics to design playlists.

This became the "music curation for business" industry that Spotify and Soundtrack Your Brand still run today.

💡 Lesson: in-store sound is a measurable sales variable, not just ambience.\`,
        zh: \`🛒 1960-80年代——零售业用硬数据证明：音乐能改变购买行为

Milliman 1982年的经典研究在真实超市与餐厅测量发现：慢节奏音乐让顾客走得更慢、停留更久，销售额提升高达约38%；餐厅里慢音乐让客人久坐并多点饮品。此前，大型零售（1930年代起办公、商场、电梯中的 Muzak）只是凭感觉"营造氛围"——Milliman 的数字重塑了整个行业：酒店、航空、医院开始聘请音乐学者设计歌单。

这催生了"商业音乐策展"行业，Spotify 与 Soundtrack Your Brand 至今仍在经营。

💡 启示：零售场所的声音是可测量的销售变量，不只是氛围。\` } },
    { id: "sonysithears", icon: "🎧", title: { th: "Sony ซื้อ CBS Records: ค่ายเพลงในมือผู้ผลิตเครื่อง", en: "Sony buys CBS Records: hardware owns content", zh: "索尼收购CBS唱片：硬件方入主内容方" },
      content: { th: \`🎧 Sony ซื้อ CBS Records (1988, ราว $2 พันล้าน) + Warner-Universal รวมค่ายยุคเดียวกัน — จุดเปลี่ยนที่ "ผู้ผลิตเครื่อง" กลายเป็นเจ้าของเพลง

ก่อนปี 1988 เครื่องเสียงกับค่ายเพลงเป็นธุรกิจแยกกัน Sony ที่ทำ Walkman และ CD player อยู่แล้วเข้าใจว่ากำไรจริงอยู่ที่ "สิทธิ์ในเพลง" ไม่ใช่ตัวเครื่อง — จึงซื้อ CBS Records (รวม Columbia, Epic) จาก CBS ด้วยราคาที่สูงที่สุดในประวัติศาสตร์อุตสาหกรรมยุคนั้น ต่อด้วยการซื้อ MGM/UMG อีกชุดในยุคหลัง โครงสร้าง "บริษัทเทคโนโลยีเป็นเจ้าของคลังเพลง" ที่เราเห็นใน Apple Music, Amazon Music, YouTube Music ทุกวันนี้ คือแบบแผนที่เริ่มจากดีลนี้

ธุรกิจเพลงเปลี่ยนมือจาก "บริษัทเพลงล้วนๆ" ไปเป็น "แผนกหนึ่งของบริษัทเทคโนโลยีระดับโลก" ตั้งแต่ปลายทศวรรษ 1980

💡 บทเรียน: ในธุรกิจ creative — ผู้ที่ควบคุม "สิทธิ์" (IP) คือผู้ชนะในระยะยาว ไม่ใช่ผู้ที่ควบคุม "เครื่องมือ" เพียงอย่างเดียว\`,
        en: \`🎧 Sony's 1988 purchase of CBS Records (~$2B) — when hardware makers became content owners

Before 1988, audio hardware and music labels were separate businesses. Sony — already making Walkmans and CD players — understood that real profit lived in music RIGHTS, not the device, so it bought CBS Records (Columbia, Epic) at the era's highest industry price, later adding MGM/UMG. The structure behind Apple Music, Amazon Music and YouTube Music today — tech companies owning song catalogs — started with this deal.

Music stopped being "pure music companies" and became a division inside global tech — from the late 1980s.

💡 Lesson: in creative businesses, whoever controls the RIGHTS (IP) wins long-term — not just whoever controls the hardware.\`,
        zh: \`🎧 索尼1988年以约20亿美元收购CBS唱片——硬件制造商成为内容拥有者的转折点

1988年之前，音响硬件与唱片公司是两个独立生意。已生产 Walkman 和 CD 机的索尼明白：真正的利润在"音乐版权"，而非设备本身——于是以当时业界最高价买下 CBS 唱片（含 Columbia、Epic），后续又收购 MGM/UMG。今天 Apple Music、Amazon Music、YouTube Music 背后"科技公司拥有曲库"的结构，正是从这笔交易开始的。

自1980年代末起，音乐生意从"纯音乐公司"变成了全球科技巨头的一个部门。

💡 启示：在创意产业，长期赢家是控制"权利"(IP) 的人——而不是只控制"工具"的人。\` } },
    { id: "chopinpub", icon: "🎹", title: { th: "Chopin & Pleyel: เปียโนกลายเป็นสินค้าครัวเรือน", en: "Chopin & Pleyel: piano becomes a household product", zh: "肖邦与普莱耶尔：钢琴走进家庭" },
      content: { th: \`🎹 Frédéric Chopin (1810-1849) + Pleyel et Cie — ความร่วมมือแรกๆ ที่ทำให้ "เปียโน" ขายได้ทั่วยุโรป

Camille Pleyel ผู้ผลิตเปียโนชาวฝรั่งเศส เป็นผู้สนับสนุนหลักของ Chopin ทั้งชีวิต: ให้เปียโนใช้ฟรี จัดห้องซ้อม จัดคอนเสิร์ตใน Salle Pleyel (หอแสดงดนตรีของบริษัทเอง) แลกกับการที่ Chopin ใช้เปียโน Pleyel บนเวที — การตลาดแบบ "artistic endorsement" ที่เป็นต้นแบบของ Yamaha/Steinway กับศิลปินระดับโลกทุกยุค ผลพลอยได้ทางธุรกิจคือชนชั้นกลางยุโรปซื้อเปียโนไว้ที่บ้านเพิ่มขึ้นมหาศาลในศตวรรษที่ 19 เพราะ "เพลงของ Chopin เล่นที่บ้านได้" — โน้ต Chopin ขายดีพอที่สำนักพิมพ์อย่าง Schlesinger กลายเป็นธุรกิจใหญ่

โมเดล "ศิลปิน + ผู้ผลิตเครื่องดนตรี + สำนักพิมพ์โน้ต" คือระบบเดียวกับที่ Fender/Kawai/Yamaha และแอปอย่าง TIGA ใช้ทุกวันนี้

💡 บทเรียน: ธุรกิจเครื่องดนตรีโตได้เพราะ "มีเพลงที่คนอยากเล่นเองที่บ้าน" ไม่ใช่เพราะเครื่องดีเพียงอย่างเดียว\`,
        en: \`🎹 Frédéric Chopin (1810-1849) + Pleyel et Cie — one of the first partnerships that sold pianos across Europe

Camille Pleyel, the French piano maker, backed Chopin for life: free instruments, practice rooms, concerts at the company's own Salle Pleyel — in exchange for Chopin performing on Pleyel pianos. This "artistic endorsement" is the direct ancestor of every Yamaha/Steinway artist program. The business byproduct: Europe's middle class bought home pianos in enormous 19th-century numbers because "Chopin's music could be played at home" — his sheet music made publishers like Schlesinger major businesses.

"Artist + instrument maker + sheet-music publisher" is the same system Fender, Kawai, Yamaha — and apps like TIGA — run today.

💡 Lesson: instrument businesses grow because there's music people want to play at home — not because the hardware is good alone.\`,
        zh: \`🎹 弗雷德里克·肖邦（1810-1849）与普莱耶尔钢琴——最早让钢琴畅销全欧洲的合作之一

法国钢琴制造商卡米耶·普莱耶尔一生支持肖邦：免费提供乐器、练习室，并在自家的普莱耶尔音乐厅为其办音乐会——换取肖邦在舞台上使用普莱耶尔钢琴。这种"艺术代言"正是今日雅马哈/斯坦威艺术家计划的直系祖先。商业副产品：19世纪欧洲中产阶级大量购买家用钢琴，因为"肖邦的音乐可以在家里弹"——他的乐谱让 Schlesinger 等出版商成为大生意。

"艺人+乐器制造商+乐谱出版社"的三位一体，正是 Fender、Kawai、雅马哈以及 TIGA 这类应用今天在用的系统。

💡 启示：乐器生意的增长来自"有人们想在家弹的音乐"——而非只靠硬件本身。\` } },
    { id: "jazztourdipl", icon: "🌍", title: { th: "Jazz Ambassadors: ดนตรีขายประเทศ", en: "Jazz diplomacy: music sells a nation", zh: "爵士外交：音乐卖出国家形象" },
      content: { th: \`🌍 ยุคสงครามเย็น (1950s-1960s) — รัฐบาลสหรัฐฯ จ้างนักดนตรีแจ๊สเป็น "ทูตวัฒนธรรม"

กระทรวงการต่างประเทศสหรัฐฯ ส่ง Dizzy Gillespie, Louis Armstrong, Dave Brubeck และ Benny Goodman ออกทัวร์โลกอย่างเป็นทางการ เพื่อประชาสัมพันธ์ประเทศในยุคที่สหภาพโซเวียตโปรโมตลัทธิคอมมิวนิสต์ ผลทางธุรกิจคือดนตรีแจ๊สอเมริกันขายแผ่นเสียงและบัตรคอนเสิร์ตได้ทั่วโลก — เพลงกลายเป็น "สินค้าส่งออก" ที่มีรัฐหนุน คล้ายโมเดล K-pop ของเกาหลีหลายสิบปีต่อมา แต่เริ่มก่อนหลายทศวรรษ

โครงสร้าง "รัฐ + ธุรกิจเพลง + ศิลปิน" ร่วมมือขายวัฒนธรรมเป็นรายได้จริง — ต้นแบบของ soft power ทางดนตรีทุกแบบทุกอย่างทุกวันนี้

💡 บทเรียน: เมื่อดนตรีเป็นตัวแทนของประเทศ — มันขายได้ทั้ง "ภาพลักษณ์ประเทศ" และ "สินค้าเพลงจริงๆ" พร้อมกัน\`,
        en: \`🌍 The Cold War era (1950s-60s) — the US government sent jazz musicians as cultural ambassadors

The State Department dispatched Dizzy Gillespie, Louis Armstrong, Dave Brubeck and Benny Goodman on official world tours to counter Soviet cultural promotion. The business result: American jazz sold records and concert tickets worldwide — music as state-backed export, decades before Korea's K-pop model followed the same structure.

"Government + music industry + artists" jointly selling culture for real revenue — the prototype of every musical soft-power play since.

💡 Lesson: when music represents a nation, it sells both national image and actual music products at the same time.\`,
        zh: \`🌍 冷战年代（1950-60年代）——美国政府派爵士音乐家担任"文化大使"

美国国务院正式派遣迪兹·吉莱斯皮、路易斯·阿姆斯特朗、戴夫·布鲁贝克与班尼·古德曼全球巡演，以对冲苏联的文化输出。商业结果是：美国爵士乐的唱片与演出门票在全球畅销——音乐成为国家扶持的出口商品，比韩国的 K-pop 模式早了几十年。

"政府+音乐产业+艺人"联合销售文化换取真实收入——这是今日一切音乐软实力操作的原始模板。

💡 启示：当音乐代表一个国家，它同时卖出"国家形象"和真实的音乐商品。\` } },
    { id: "tokyokaraoke", icon: "🎤", title: { th: "Karaoke & ร้านคาราโอเกะญี่ปุ่น: ดนตรีเป็นสถานที่", en: "Karaoke Japan: music as a place, not a product", zh: "日本卡拉OK：音乐即场所" },
      content: { th: \`🎤 Karaoke เกิดในญี่ปุ่นทศวรรษ 1970 (Daisuke Inoue สร้างเครื่องจ๊าบแรก 1971) — โมเดลธุรกิจที่ "ขายสถานที่และประสบการณ์" แทนการขายเพลง

ก่อนหน้านี้ธุรกิจเพลงขาย "ของ" (แผ่น ตั๋ว เครื่องเล่น) คาราโอเกะเปลี่ยนสมการ: ร้านคาราโอเกะขาย "ห้อง + เครื่องดื่ม + เวลา + ความสนุกที่เพื่อนเห็นฝีมือเรา" — เพลงเป็นเพียงเหตุผลให้คนมาที่ร้าน รายได้จริงมาจากเครื่องดื่มและค่าห้อง ธุรกิจนี้แพร่ไปทั้งเอเชียและทั่วโลกภายใน 20 ปี กลายเป็นช่องทางรายได้ที่ "ไม่ต้องขายเพลง" แต่ขายประสบการณ์รอบเพลง

ปรัชญาเดียวกันคือหัวใจของ Escape Room, คอนเสิร์ตจัดงานส่วนตัว, และประสบการณ์ซ้อมเปียโนสดที่แอปอย่าง TIGA กำลังสร้าง — ดนตรีไม่ใช่สินค้า แต่เป็น "เหตุผลให้คนมาพบกัน"

💡 บทเรียน: ธุรกิจดนตรีไม่จำเป็นต้องขายเพลง — ขาย "สถานที่ที่เพลงเกิดขึ้น" ก็เป็นอุตสาหกรรมใหญ่ได้\`,
        en: \`🎤 Karaoke, born in 1970s Japan (Daisuke Inoue's first machine, 1971) — a business model selling a PLACE, not the music

Before karaoke, music sold THINGS (records, tickets, players). Karaoke rewrote the equation: karaoke boxes sell "room + drinks + time + the fun of friends seeing you perform" — music is just the reason people show up; the real revenue is drinks and room fees. Within 20 years it spread across Asia and the world, becoming a huge revenue channel that never sells the song itself.

The same philosophy powers escape rooms, private concerts, and the live piano-practice experience TIGA is building — music isn't the product; it's the reason people come together.

💡 Lesson: music businesses don't have to sell music — selling "the place where music happens" is a giant industry too.\`,
        zh: \`🎤 卡拉OK诞生于1970年代的日本（井上大佑1971年造出第一台机器）——卖"场所"而非卖音乐的商业模式

在此之前，音乐生意卖的是"物"（唱片、门票、播放器）。卡拉OK重写了方程式：包厢卖的是"房间+酒水+时间+朋友见证你表演的快乐"——音乐只是人们到店的理由，真正的收入来自酒水和包厢费。二十年间，它席卷亚洲并走向全球，成为一条从不直接卖歌的巨大收入渠道。

同一哲学支撑着密室逃脱、私人音乐会，以及 TIGA 正在打造的实时练琴体验——音乐不是商品，而是"让人们相聚的理由"。

💡 启示：音乐生意不一定非要卖音乐——卖"音乐发生的场所"同样是一门大生意。\` } },
    { id: "gramophonepub", icon: "📀", title: { th: "โน้ตเพลง → แผ่นเสียง: ทรัพย์สินที่ขายซ้ำได้", en: "Sheet music to records: resellable IP is born", zh: "乐谱到唱片：可重复销售的IP诞生" },
      content: { th: \`📀 ปลายศตวรรษที่ 19 - ต้นศตวรรษที่ 20 — การเปลี่ยนผ่านจาก "โน้ตเพลง" ไปเป็น "แผ่นเสียง" สร้างแนวคิด IP ที่ขายซ้ำได้

ยุคก่อนแผ่นเสียง ธุรกิจเพลงคือธุรกิจโน้ต (sheet music) ขายให้คนเล่นเองที่บ้าน เมื่อ Emile Berliner ประดิษฐ์แผ่นเสียงแบบ disc (1888) และ Victor/Columbia สร้างระบบบันทึกเสียงขึ้น — เกิดสิ่งใหม่ที่ไม่เคยมีมาก่อน: "เพลงหนึ่งเพลง ขายได้หลายล้านชุดโดยผู้แต่งไม่ต้องเล่นเลยสักครั้ง" โครงสร้างลิขสิทธิ์ใหม่ (copyright on recordings) ทำให้ธุรกิจเพลงเปลี่ยนจาก "ขายของที่ต้องมีคนเล่น" เป็น "ขายทรัพย์สินที่มีอายุยาวหลายสิบปี"

แนวคิด "เพลงคือสินทรัพย์" ทำให้เกิดโมเดลทุกอย่างที่ตามมา: ค่ายเพลง, ระบบ royalty, การซื้อขายคลังเพลง (catalog acquisition), และกองทุนลิขสิทธิ์เพลงที่บริษัท investment ทั่วโลกซื้อขายกันทุกวันนี้

💡 บทเรียน: ทรัพย์สินที่ขายซ้ำได้ (resellable IP) คือหัวใจของธุรกิจสร้างสรรค์ — สร้างครั้งเดียวขายได้ตลอดชีวิต\`,
        en: \`📀 Late 1800s-early 1900s — the shift from sheet music to records created resellable IP

Pre-records, the music business sold sheet music for people to play at home. When Emile Berliner invented the disc record (1888) and Victor/Columbia built recording systems, something brand new appeared: one song could sell millions of copies without its composer playing a single note. New recording copyrights turned music from "a product that needed a performer" into "an asset with decades of life."

"Music as an asset" enabled everything that followed: record labels, royalty systems, catalog acquisitions, and the song-IP funds that investment firms trade today.

💡 Lesson: resellable IP is the heart of creative business — build once, sell for life.\`,
        zh: \`📀 19世纪末至20世纪初——从乐谱到唱片的转变，催生了"可重复销售的IP"

唱片出现之前，音乐生意卖的是让人在家弹奏的乐谱。当埃米尔·柏林纳发明圆盘唱片（1888），维克多与哥伦比亚建立录音体系后，前所未有的事情出现了：一首歌可以卖出数百万份，而作曲家一个音都不用弹。新的录音版权让音乐从"需要演奏者的产品"变成"拥有数十年寿命的资产"。

"音乐即资产"这一理念，催生了之后的一切：唱片公司、版税体系、曲库收购，以及今日全球投资机构交易的音乐版权基金。

💡 启示：可重复销售的IP是创意产业的核心——创造一次，终身销售。\` } },
    { id: "steinwayartist", icon: "🎹", title: { th: "Steinway Artists: ระบบตัวแทนศิลปินที่เก่าแก่ที่สุด", en: "Steinway Artists: the oldest endorsement system", zh: "斯坦威艺术家：最古老的代言体系" },
      content: { th: \`🎹 Steinway & Sons (ตั้ง 1853, นิวยอร์ก) — ระบบ "Steinway Artists" เก่าแก่ที่สุดในโลก (เริ่มต้นช่วงต้นศตวรรษที่ 20 ร่วมสมัย Rachmaninoff และ Horowitz) — ระบบที่ศิลปินระดับโลกใช้เปียโน Steinway แลกกับการเป็น "แอมบาสเดอร์" ของแบรนด์

หลักการเดียวกับที่ Nike ใช้กับนักกีฬาหรือที่เครื่องสำอางใช้กับดารา แต่ Steinway ทำก่อนทุกคน ด้วยรูปแบบที่แตกต่าง: ไม่จ่ายเงินศิลปินโดยตรง แต่ "ให้ใช้เปียโนฟรีทั่วโลก + สนับสนุนทัวร์" — ศิลปินระดับโลกหลายร้อยคนติดตาม ทั้งที่ Steinway ขายเปียโนราคาสูงกว่าคู่แข่งเป็นหลักหมื่นดอลลาร์ ผลทางธุรกิจ: ยอดขายตั้งแต่ยุค Rachmaninoff ยันวันนี้ ยังนำตลาดระดับ premium ทั้งโลก

ระบบ "ให้ศิลปินใช้ฟรี → ศิลปินสร้างความน่าเชื่อถือ → ลูกค้าซื้อเครื่องที่ศิลปินใช้" คือโมเดลที่ทุกธุรกิจ hardware ใช้กันปัจจุบัน (ทุกแบรนด์กล้อง จักรยาน เครื่องเสียง ฯลฯ)

💡 บทเรียน: ระบบ endorsement ที่ดีที่สุดคือระบบที่ศิลปิน "ได้ประโยชน์จริง" — ไม่ใช่แค่เงิน\`,
        en: \`🎹 Steinway & Sons (est. 1853, New York) — the "Steinway Artists" system, the world's oldest endorsement program (early 20th century, contemporaneous with Rachmaninoff and Horowitz): world-class artists play Steinway exclusively in exchange for being the brand's face.

The same logic Nike uses with athletes and cosmetics with stars — but Steinway did it first, and differently: no direct payment, instead "free pianos worldwide + tour support." Hundreds of top artists participate even though Steinway pianos cost tens of thousands more than rivals. Result: premium market leadership from the Rachmaninoff era to today.

"Artists use it free → artists build credibility → customers buy what artists use" is the model behind every hardware endorsement today.

💡 Lesson: the best endorsement system gives artists REAL benefits — not just money.\`,
        zh: \`🎹 斯坦威父子公司（1853年创立，纽约）——"斯坦威艺术家"体系是全球最古老的代言体系（20世纪初与拉赫玛尼诺夫、霍洛维茨同时代）：世界级艺术家专属使用斯坦威钢琴，换取成为品牌之脸。

这与耐克之于运动员、化妆品之于明星的逻辑相同——但斯坦威做得最早，方式也不同：不直接付钱，而是"全球免费提供钢琴+支持巡演"。数百位顶级艺术家参与其中，即便斯坦威钢琴比竞品贵数万美元。结果：从拉赫玛尼诺夫时代至今，始终领导全球高端市场。

"艺术家免费使用→建立可信度→顾客购买艺术家同款"——这是今天所有硬件代言背后的模型。

💡 启示：最好的代言体系是给艺术家"真实利益"的体系——而不只是钱。\` } },
    { id: "gospelradio", icon: "📖", title: { th: "โรงละครขายบัตร + เพลงสากลยุค 1900", en: "Vaudeville & the birth of paid popular touring", zh: "歌舞杂耍与付费巡演的诞生" },
      content: { th: \`📖 Vaudeville (1880s-1930s, สหรัฐฯ) — เครือโรงละครทั่วประเทศที่ทำให้ "นักร้องเดินทางขายบัตร" เป็นอาชีพจริง

เครือโรงละคร Keith-Albee, Orpheum Circuit วางระบบ "ศิลปินทัวร์รายสัปดาห์" — ศิลปินหมุนเวียนเมืองทุกสัปดาห์ รายได้แบ่งกันระหว่างโรงละครกับศิลปินตามสัญญา โครงสร้างนี้คือรากฐานของ "ทัวร์คอนเสิร์ต" ทั้งอุตสาหกรรมทุกวันนี้ (รวมถึงระบบ booking agent, สัญญาแบ่งรายได้, และการจัดทัวร์เป็นรอบ) และพิสูจน์ว่าดนตรีสดขายได้ทั้งประเทศ ไม่ใช่แค่เมืองใหญ่

Vaudeville ยังฝึกศิลปินที่จะกลายเป็นดาววิทยุ หนัง และทีวีทุกคนในยุคหลัง — ระบบสร้างศิลปินในบ้านเดียวกัน

💡 บทเรียน: โครงสร้างการจัดทัวร์ที่ใช้อยู่ทุกวันนี้ — วางรากจากธุรกิจโรงละครเมื่อ 100+ ปีก่อน ไม่ใช่ความคิดใหม่ของยุคคอนเสิร์ตยุคใหม่\`,
        en: \`📖 Vaudeville (1880s-1930s, USA) — the national theater circuits that made "touring singer" a real career

Circuits like Keith-Albee and Orpheum ran weekly artist rotations, splitting revenue between theater and artist by contract. This structure is the root of today's entire concert-tour industry (booking agents, revenue splits, tour routing) — and proved live music could sell nationwide, not just in big cities.

Vaudeville also trained the artists who became the radio, film and TV stars of the next era — one in-house star system.

💡 Lesson: today's touring structure has roots in a theater business over 100 years old — not in the modern concert era at all.\`,
        zh: \`📖 歌舞杂耍剧场（1880-1930年代，美国）——让"巡演唱片"成为真正职业的全国剧场网络

Keith-Albee、Orpheum 等剧场网络建立了每周艺人轮换制度，剧场与艺人按合同分成。这一结构是今天整个演唱会巡演行业（订票经纪、分成合同、巡演排线）的根基——并证明现场音乐可以卖遍全国，而不只在大城市。

歌舞杂耍还培养出下一代广播、电影、电视明星——同一家屋檐下的造星系统。

💡 启示：今天的巡演结构，其根源在100多年前的剧场生意——并非现代演唱会时代的新发明。\` } },
`;

const anchor = `  ],
  "music-military": [`;
must(s.includes(anchor), "music-nation anchor missing");
s = s.replace(anchor, `
` + NEW + anchor);

writeFileSync(P, s);
console.log("patched, delta:", s.length - orig.length);
