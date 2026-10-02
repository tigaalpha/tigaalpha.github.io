/* ── tigamodel/knowledge/global-coverage-wave.js — docs/16 §3 (m52) ──
   The owner's coverage directive (2026-09-30): the KB must KNOW music
   knowledge, piano pedagogy, music MARKETING, music INNOVATION and music
   THERAPY from around the world. Coverage audit (measured 2026-09-30,
   17,148 entries): music 14,916 ✓ · pedagogy 2,296 ✓ · marketing 48 (thin)
   · innovation records scattered/thin · therapy 10 (thin). This wave fills
   the thin categories with REAL, widely-accepted craft principles — the
   same legal shape the existing waves use:

   * steel rule 7 (docs/07): every entry keeps an honest tiga-* source
     (original/anonymous common-knowledge, written in our own words) — the
     compliance auditor checks it; no stats, no invented numbers, no
     institution names in commercial phrasing.
   * therapy stays inside the WELLBEING frame: teaching principles for
     caring teaching, never medical claims, never replacing a professional.
   * "จากทั่วโลก" is honored by CONTENT (practices that are genuinely
     global: streaming economics, lesson-market economics, ISO principle,
     community music, tech-assisted teaching) not by decorative geography.
   * trilingual like every wave (th lead, en/zh in gloss).

   Wave 2 (same owner directive, same day): +10 entries per thin category
   (marketing/innovation/therapy → +30), moving the three thin pillars from
   token coverage to real depth. Same rules as wave 1. ── */

export function seedGlobalCoverageWave(kb) {
  /* ── การตลาดดนตรี (music marketing) — world craft, quality-only ── */
  const MARKETING = [
    ["mkt:world:release-cadence", "จังหวะปล่อยผลงานสม่ำเสมอ", "ศิลปินที่ปล่อยผลงานต่อเนื่อง (ซิงเกิลสั้นแทนอัลบั้มยาว) ทั่วโลกใช้เพื่อรักษาการมองเห็นในอัลกอริทึมแพลตฟอร์ม — ครูสอนเปียโนยืมได้: ปล่อยคลิปสั้น/คลิปสอนสม่ำเสมอแทนรอผลงานใหญ่ทีเดียว",
      "A steady release cadence (singles over long albums) keeps artists visible in platform feeds worldwide — teachers can borrow it: regular short clips beat rare big productions.",
      "稳定的发布节奏（单曲代替长专辑）维持平台曝光——教师同理：规律更新短视频胜过偶尔的大制作。"],
    ["mkt:world:niche-positioning", "จับกลุ่มเฉพาะก่อนขยาย", "กลยุทธ์ที่ได้ผลทั่วโลก: เริ่มจากกลุ่มเฉพาะที่โตของแพลตฟอร์มทั่วโลก (adult beginners / returning players / parents) ทำให้ลึกก่อนแล้วค่อยขยาย — ครูเปียโนก็เลือกเฉพาะทางได้ (เด็กเล็ก/ผู้ใหญ่กลับมาเล่น/สอบ grade)",
      "Niche-first works worldwide: own a specific audience deeply (adult beginners, returning players, exam families) before widening.",
      "先深耕细分人群（成人初学者/回归者/考级家庭）再扩展。"],
    ["mkt:world:teach-content-marketing", "สอนฟรีคือการตลาดที่แรงที่สุด", "ครูดนตรีทั่วโลกที่โตจากคอนเทนต์ใช้หลักเดียวกัน: สอนสิ่งที่ใช้ได้จริงให้ฟรี — คนเรียนรู้ว่าครูสอนดีจากของฟรี แล้วจ่ายเพื่อเรียนกับตัวครูเอง (teach, don't tease)",
      "Music teachers who grow through content share one rule: teach something genuinely useful for free — people pay for the teacher, not the teaser.",
      "免费教真东西是最强的营销——人们为老师付费，而不是为噱头。"],
    ["mkt:world:social-proof", "หลักฐานทางสังคมต้องจริง", "รีวิว/ผลสอบ/คลิปนักเรียนเล่นได้จริงคือหลักฐานที่ทรงพลังที่สุดของสถานกวดวิชาดนตรีทั่วโลก — ใช้ของจริงเท่านั้น ห้ามอวดอ้าง (ตัวเลขผลสอบต้องมาจากนักเรียนจริง)",
      "Real reviews, real exam results, real student performances are the strongest proof — show only what actually happened.",
      "真实评价、真实考级、真实演奏是最有力的证明——只展示真实发生的。"],
    ["mkt:world:retention-over-acquisition", "รักษานักเรียนเดิมแพงกว่าหาใหม่", "ธุรกิจสอนดนตรีทั่วโลกเรียนรู้ตรงกัน: นักเรียนที่เลิกกลางทางคือรายได้ที่หายไปมากที่สุด — โฟกัสความก้าวหน้าที่มองเห็นได้ (บันทึกก่อน-หลัง งานแสดงปลายเทอม) ก่อนโฆษณาหาคนใหม่",
      "Worldwide lesson businesses converge on one truth: churned students are the biggest lost revenue — visible progress (before/after recordings, term-end recitals) beats ads for new ones.",
      "留存学员优先于拉新——看得见的进步（前后录音、期末演奏会）胜过广告。"],
    ["mkt:world:pricing-transparency", "ราคาชัดคือความไว้วางใจ", "หน้าราคาที่โปร่งใส (คอร์ส/รอบ/เงื่อนไข) ลดแรงเสียดทานการตัดสินใจ — แพร่หลายในสตูดิโอดนตรีทั่วโลกยุคออนไลน์ ผู้ปกครองเทียบราคาได้ในคลิกเดียว",
      "Transparent pricing (course/session/terms) lowers decision friction — parents can compare in one click.",
      "定价透明降低决策摩擦——家长一键即可比价。"],
    ["mkt:world:know-your-audience", "รู้ว่าใครคือคนฟังก่อนทำ", "สตูดิโอที่โตทั่วโลกเริ่มจากการรู้ชัดว่าใครคือผู้ฟัง (ผู้ปกครองเด็กเล็ก ผู้ใหญ่กลับมาเล่น วัยรุ่นเล่นเพลงฮิต) แล้วค่อยเลือกช่องทางและข้อความให้ตรง — ครูเปียโนใช้เขียนคำอธิบายคอร์สให้คนกลุ่มนั้นฟัง ไม่ใช่พูดกับ 'ทุกคน'",
      "Studios that grow worldwide start by naming their audience (parents of young children, adults returning, teens playing hits), then pick channels and messages to match — write the course description for those people, not for 'everyone'.",
      "全球成长的工作室先明确受众（幼儿家长、重返琴键的成年人、爱弹热门曲的青少年），再选渠道与文案——课程简介写给这群人看，而非“所有人”。"],
    ["mkt:world:trial-lesson-funnel", "คลาสทดลองคือประตูแรก", "การให้ทดลองเรียนสั้น ๆ ก่อนตัดสินใจเป็นธรรมเนียมที่แพร่หลายในสตูดิโอทั่วโลก — นักเรียนได้สัมผัสห้องเรียนจริง ครูได้เห็นระดับและความตั้งใจก่อนพูดเรื่องค่าเรียน — เสนอชัดเจน ไม่กดดัน",
      "A short trial lesson before commitment is common practice in studios worldwide — the student experiences a real class, the teacher sees level and intent before fees are discussed — offer it clearly, without pressure.",
      "先上一节短体验课再决定，是全球工作室的通行做法——学生真实感受课堂，老师先了解程度与态度再谈学费——明确提供，不施压。"],
    ["mkt:world:recital-as-marketing", "งานแสดงคือการตลาดที่ดีที่สุด", "คอนเสิร์ตปลายเทอม/งานแสดงของนักเรียนเป็นหลักฐานที่ทรงพลังที่สุดที่สตูดิโอทั่วโลกมี — ผู้ปกครองเห็นลูกเล่นได้จริง เพื่อนเห็นแล้วอยากเรียน — จัดให้เป็นเรื่องปกติทุกช่วง ไม่ใช่กิจกรรมพิเศษนาน ๆ ครั้ง",
      "Term-end recitals are the most powerful proof music studios worldwide have — parents see their child really play, friends watch and want lessons — hold them as a regular rhythm, not a rare event.",
      "学期末音乐会是全球音乐工作室最有力的证明——家长看到孩子真的会弹，朋友看了也想学——把它办成固定节奏，而非偶发活动。"],
    ["mkt:world:word-of-mouth-engine", "บอกต่อคือช่องทางหลัก", "ธุรกิจสอนดนตรีทั่วโลกเติบโตจากปากต่อปากมากกว่าโฆษณาจ่ายเงิน — นักเรียนที่เห็นความก้าวหน้าและผู้ปกครองที่รู้สึกได้ถึงการดูแลจะชวนคนมาเอง — สร้างจังหวะให้เขาเล่าได้ (งานแสดง คลิปนักเรียน รายงานความคืบหน้า)",
      "Music teaching businesses worldwide grow more from word of mouth than paid ads — students who feel progress and parents who feel cared for invite others naturally — give them moments to retell (recitals, student clips, progress reports).",
      "全球音乐教学业务更多靠口碑而非付费广告——看得见进步的学生与感到被照顾的家长会自发邀请他人——给他们可转述的素材（音乐会、学生片段、进度汇报）。"],
    ["mkt:world:one-voice-everywhere", "เสียงเดียวทุกช่องทาง", "ชื่อ โทนสี คำพูดที่ใช้บนเว็บ ในคลิป และในห้องเรียนควรเป็นเสียงเดียวกัน — สตูดิโอที่สอดคล้องกันทั่วโลกถูกจดจำง่ายกว่าและถูกมองว่าน่าเชื่อถือกว่า — ครูคนเดียวก็มี 'แบรนด์' ได้ด้วยความสม่ำเสมอ",
      "Name, colours and voice on the site, in clips and in the classroom should match — consistent studios worldwide are easier to remember and read as more trustworthy — a single teacher builds a 'brand' through consistency.",
      "网站、视频与课堂中的名称、配色和语气应保持一致——全球一致的工作室更易被记住、更显可信——一位老师也能靠一致性形成“个人品牌”。"],
    ["mkt:world:term-calendar-launch", "จังหวะเปิดเทอมคือฤดูกาลขาย", "สตูดิโอทั่วโลกรอจังหวะธรรมชาติของฤดูกาล (เปิดเทอม ปีใหม่ ช่วงเปลี่ยนงานอดิเรก) เพื่อเปิดคอร์สใหม่ — ครูเตรียมข้อความและตารางก่อนจังหวะมาถึง ไม่ใช่เริ่มโปรโมทเมื่อฤดูกาลผ่านไปแล้ว",
      "Studios worldwide time new courses to natural seasons (term start, new year, life changes) — prepare the message and schedule before the season arrives, not after it has passed.",
      "全球工作室把新课程对准自然时节（开学、新年、生活转折）——在时节到来前备好文案与课表，而非错过才推广。"],
    ["mkt:world:show-progress-not-ads", "โชว์ความคืบหน้าแทนการโฆษณา", "คลิปก่อน-หลัง หรือเส้นทางการเล่นที่เห็นได้ชัด คือสิ่งที่คนแชร์เองได้ — สตูดิโอทั่วโลกเลิกพูดว่า 'สอนดีแค่ไหน' แล้วหันมาให้เห็นของจริง — ครูขออนุญาตนักเรียน/ผู้ปกครองก่อนโชว์ เสมอ",
      "Before-after clips and visible learning journeys are what people share on their own — studios worldwide stop saying 'we teach well' and show the real thing — always ask the student/parent first.",
      "前后对比片段与可见的学习历程会被人自发转发——全球工作室不再空谈“教得好”，而是展示真实成果——展示前务必征得学生/家长同意。"],
    ["mkt:world:local-presence", "ปรากฏตัวในชุมชน", "การปรากฏตัวในพื้นที่ (โรงเรียน ห้าง งานชุมชน) เป็นช่องทางที่สตูดิโอทั่วโลกใช้คู่กับออนไลน์ — โชว์สั้น การจัดบูธ โปสเตอร์ในพื้นที่ที่กลุ่มเป้าหมายอยู่จริง — ออนไลน์คนเจอ แต่ที่นี่คนไว้ใจ",
      "Showing up locally (schools, malls, community events) is a channel studios worldwide pair with online — short sets, a booth, posters where the audience actually is — online gets seen, local gets trusted.",
      "线下出现（学校、商场、社区活动）是全球工作室与线上并用的渠道——短演出、摊位、目标人群所在处的海报——线上被看见，线下被信任。"],
    ["mkt:world:own-your-channel", "เป็นเจ้าของช่องทางติดต่อ", "การพึ่งแพลตฟอร์มเดียวเสี่ยงที่การมองเห็นจะหายเมื่อกฎเปลี่ยน — สตูดิโอทั่วโลกเก็บช่องทางติดต่อตรง (รายชื่อ LINE/อีเมลนักเรียนและผู้ปกครอง) ไว้เอง — ครูคนเดียวก็เก็บรายชื่อไว้สื่อสารตรงได้",
      "Relying on one platform risks visibility vanishing when its rules change — studios worldwide keep direct contact channels (their own LINE/email list of students and parents) — even a single teacher can own that list.",
      "依赖单一平台，规则一变曝光就消失——全球工作室自留直接联络渠道（学生与家长的 LINE/邮件名单）——单个老师同样可以拥有这份名单。"],
    ["mkt:world:benchmark-not-copy", "เรียนรู้จากคู่แข่งโดยไม่ลอก", "สตูดิโอที่เก่งทั่วโลกดูว่าคนอื่นทำอะไรได้ผล (หัวข้อคลิป รูปแบบคลาส วิธีสื่อสาร) แล้วนำมาปรับกับจุดแข็งของตัวเอง — การคัดลอกทั้งหมดทำให้เหมือนกันหมด แต่การหยิบหลักการมาใช้ทำให้โดดเด่น",
      "Strong studios worldwide study what works for others (clip topics, class formats, communication) and adapt it to their own strengths — copying everything makes you identical; borrowing principles makes you distinct.",
      "优秀的全球工作室研究他人有效之处（选题、课型、沟通方式），再结合自身优势调整——全盘模仿会变得毫无特色，借鉴原则才能脱颖而出。"],
  ];
  for (const [id, th, bodyTh, en, zh] of MARKETING) {
    kb.add({
      id, type: "principle", domain: "music-marketing",
      title: th,
      body: `${bodyTh}\n(EN: ${en}) (ZH: ${zh})`,
      teach: "ใช้เป็นหลักคิดช่วยครู/สถานกวดวิชาวางแผนการมองเห็นและการรักษานักเรียน — ไม่อ้างตัวเลข ไม่อวดอ้าง",
      confidence: 0.7, source: "tiga-industry-craft",
      tags: ["marketing", "world-craft"],
    });
  }

  /* ── นวัตกรรมดนตรี (music innovation) — technology-assisted music, quality-only ── */
  const INNOVATION = [
    ["inn:world:digital-piano-evolution", "เปียโนไฟฟ้า: จากเสียงสังเคราะห์สู่เสียงเสมือนจริง", "วิวัฒนาการที่เปลี่ยนการเรียนเปียโนทั่วโลก: จากเสียงสังเคราะห์ยุคแรก สู่ sampling เสียงเปียโนคอนเสิร์ตจริง สู่ modeling ที่จำลองกลไกสาย/ค้อนแบบเรียลไทม์ — ผู้เรียนเริ่มต้นบนเครื่องราคาเข้าถึงได้โดยไม่เสียพื้นฐานการสัมผัส",
      "Digital pianos evolved from early synthesis to sampled concert grands to real-time physical modeling — beginners worldwide can start affordably without losing touch fundamentals.",
      "电钢琴从合成到采样再到物理建模——全球初学者以可负担的价格起步。"],
    ["inn:world:apps-practice-loop", "แอปซ้อม: วงจรตอบกลับทันที", "นวัตกรรมที่แพร่หลายที่สุดในการเรียนดนตรียุคนี้: แอปที่ 'ฟังแล้วบอกทันที' ว่าโน้ต/จังหวะถูกไหม — วงจรตอบกลับที่เคยต้องรอครูมาแก้ทุกสัปดาห์ ตอนนี้เกิดขึ้นได้ทุกโน้ต (แอปนี้ก็คือหนึ่งในนั้น)",
      "The era's most widespread music-learning innovation: apps that listen and respond note-by-note — feedback that used to wait a week now happens per note (this app is one of them).",
      "能听音即时反馈的练习应用是本时代最普及的音乐学习创新。"],
    ["inn:world:midi-standard", "มาตรฐาน MIDI: ภาษากลางของเครื่องดนตรีดิจิทัล", "ตั้งแต่ต้นยุคดิจิทัล มาตรฐานสื่อสารระหว่างเครื่องดนตรีอิเล็กทรอนิกส์ทำให้คีย์บอร์ด คอมพิวเตอร์ และซอฟต์แวร์คุยกันได้ทั่วโลก — รากฐานของทั้งงานสร้างสรรค์และเครื่องมือการสอนยุคใหม่",
      "The MIDI standard let keyboards, computers and software speak one language worldwide — the foundation of modern creation and teaching tools.",
      "MIDI 标准让乐器与软件全球通用——现代创作与教学工具的基石。"],
    ["inn:world:online-lessons", "บทเรียนออนไลน์: ครูไกลกลายเป็นครูข้างบ้าน", "การเรียนสอนผ่านวิดีโอเปลี่ยนข้อจำกัดทางภูมิศาสตร์ของการเรียนเปียโนทั่วโลก — ครูดีที่เคยเข้าถึงเฉพาะคนในเมืองนั้น ตอนนี้สอนข้ามประเทศได้; เคล็ดลับที่ยอมรับกว้าง: กล้องเห็นมือ/คีย์ชัด มาก่อนภาพสวย",
      "Online lessons removed geography from piano learning — great teachers now teach across borders; the widely-accepted setup rule: a clear view of hands and keys beats pretty video.",
      "在线课打破地理限制——镜头里手与键盘清晰比画面精美更重要。"],
    ["inn:world:notation-software", "ซอฟต์แวร์เขียนโน้ต: ใครก็แต่งเพลงได้", "โปรแกรมเขียนโน้ตและ DAW ทำให้การแต่งและจัดจำหน่ายโน้ต/เพลงไม่ต้องมีสำนักพิมพ์ — นักเรียนเปียโนแต่งท่อนของตัวเอง เห็นเป็นพาร์ติชั่นจริง เล่นกลับได้ทันที คือวงจรสร้างสรรค์ที่ปิดวงในตัว",
      "Notation software and DAWs removed the publisher from the loop — piano students can compose, see real notation, and play it back instantly.",
      "打谱软件与 DAW 让创作闭环——学生作曲即刻看到乐谱并回放。"],
    ["inn:world:ai-companion-teaching", "AI ผู้ช่วยสอน: ครูเสริม ไม่ใช่ครูแทน", "แนวปฏิบัติที่กำลังก่อตัวทั่วโลก: AI ช่วยวิเคราะห์การซ้อม ให้กำลังใจ และเตรียมคำถาม ส่วนครูมนุษย์เป็นผู้ตัดสินทางดนตรีและความเข้าใจนักเรียน — เครื่องมือเสริมความสัมพันธ์ ไม่ใช่แทนที่",
      "An emerging worldwide practice: AI analyzes practice, encourages, and prepares questions, while the human teacher keeps musical judgment and student understanding — a relationship amplifier, not a replacement.",
      "AI 辅助练习分析与鼓励，人类教师保持音乐判断——是关系的放大器，不是替代。"],
    ["inn:world:recording-as-feedback", "อัดเสียงฟังกลับ: เปลี่ยนหูนักเรียน", "การอัดเสียงการซ้อมแล้วฟังย้อนหลังเป็นเครื่องมือที่แพร่หลายในยุคดิจิทัล — นักเรียนได้ยินตัวเองแบบผู้ฟัง จับจังหวะเพี้ยนและน้ำเสียงได้เอง — ไม่ต้องรอครูบอกทุกจุด",
      "Recording practice and listening back is a widespread digital-age tool — the student hears themselves as a listener, catching timing and tone issues alone — no need to wait for the teacher's every note.",
      "录下练习再回放是数字时代的普遍工具——学生以听众视角听见自己，自行发现节奏与音色问题——不必事事等老师指正。"],
    ["inn:world:adaptive-practice-software", "ซอฟต์แวร์ปรับโจทย์ตามผู้เรียน", "ซอฟต์แวร์ที่ให้โจทย์ง่าย/ยากตามผลงานที่เพิ่งผ่านมา คือการประยุกต์การเรียนแบบปรับระดับที่แพร่หลาย — เครื่องมือทำรอบซ้ำได้ไม่เหนื่อย ส่วนครูตัดสินใจว่าทิศทางนั้นเหมาะกับนักเรียนไหม",
      "Software that scales difficulty to recent performance is a widespread form of adaptive learning — machines drill tirelessly, while the teacher judges whether that direction suits the student.",
      "根据最近表现调整难度的软件是自适应学习的普及形态——机器不知疲倦地陪练，而方向是否适合学生由老师判断。"],
    ["inn:world:light-guided-keys", "ไฟนำบนคีย์: ตามได้ทันที", "ระบบไฟแสดงโน้ตบนคีย์หรือแท่นวางมือ ช่วยให้ผู้เริ่มต้นเล่นตามได้ทันทีโดยไม่อ่านโน้ตก่อน — แพร่หลายในเครื่องเรียนรุ่นใหม่และแอปต่าง ๆ — จุดสำคัญ: ใช้เป็นทางเข้า แล้วค่อยพาไปอ่านโน้ตจริง",
      "Light guides on keys let beginners play immediately without reading notation first — common in modern learning keyboards and apps — the key point: use it as an entry door, then lead to real notation.",
      "键上的灯光引导让初学者不识谱也能立即弹奏——常见于新款学习键盘与应用——要点是：把它当入口，随后引导至真实乐谱。"],
    ["inn:world:sound-libraries-motivation", "คลังเสียง: เปลี่ยนบรรยากาศให้อยากซ้อม", "การเลือกเสียงเปียโนคอนเสิร์ต เสียงเครื่องดนตรีอื่น หรือเสียงบรรยากาศ ทำให้การซ้อมไม่จำเจ — คุณสมบัติมาตรฐานของเปียโนไฟฟ้าและแอปยุคนี้ — ครูใช้สลับเสียงตามอารมณ์เพลงเพื่อให้นักเรียนฟังเป็น",
      "Choosing a concert-grand tone, other instruments or ambient sound keeps practice from going stale — standard in today's digital pianos and apps — teachers switch tones to match the music's mood so students learn to listen.",
      "选择三角钢琴音色、其他乐器或氛围声，让练习不再单调——当今电钢琴与应用的标配——老师按乐曲情绪切换音色，培养聆听。"],
    ["inn:world:gamified-practice-loops", "วงจรเกมในแอปซ้อม: แรงใจจากความคืบหน้า", "แต้ม ดาว แถบความคืบหน้า และการปลดล็อก เป็นรูปแบบที่แอปเรียนดนตรีทั่วโลกใช้รักษาแรงใจในการซ้อม — หลักการเดียวกับงานแสดงที่เห็นความก้าวหน้า: มองเห็นได้ก็ไปต่อได้ — ใช้พอดี ไม่ทำให้เล่นเพื่อแต้มอย่างเดียว",
      "Points, stars, progress bars and unlocks are how music-learning apps worldwide sustain practice motivation — the same principle as recitals: visible progress keeps you going — use them in measure, not as the only reason to play.",
      "积分、星星、进度条与解锁是全球音乐学习应用维持练习动力的通行做法——与音乐会同一原理：看得见的进步让人继续——适度使用，别让分数成为唯一目的。"],
    ["inn:world:remote-lesson-setup", "ห้องเรียนออนไลน์: อุปกรณ์ที่ใช่สำคัญกว่าแพง", "การสอนผ่านวิดีโอที่ใช้ได้จริงในระดับทั่วโลก ไม่ได้ต้องการอุปกรณ์ราคาแพง — กล้องเห็นมือสองข้างและคีย์ชัด เสียงไม่แตก แสงพอเห็นนิ้ว — เคล็ดลับที่ยอมรับกันกว้าง: เสียบสายมากกว่าพึ่งไวไฟ",
      "Video teaching that works worldwide does not need expensive gear — a camera showing both hands and keys clearly, undistorted sound, light enough to see fingers — the widely accepted tip: cable over wifi.",
      "全球通行的视频教学无需昂贵设备——镜头看清双手与琴键、声音不失真、光线够看清手指——公认经验：优先有线，少依赖无线。"],
    ["inn:world:backing-track-practice", "ซ้อมกับวงจำลอง: เล่นเป็นเพลง", "การซ้อมคู่กับเพลงประกอบ (กลอง เบส ชิ้นส่วนวงจำลอง) ช่วยให้จังหวะและการเล่นร่วมกันถูกฝึกแบบเดียวกับเล่นกับคนจริง — มีในเครื่องดนตรีสมัยใหม่และแอปมากมาย — ครูใช้แทนการตบมือนับจังหวะได้",
      "Practising with a backing band (drums, bass, simulated ensemble) trains timing and playing-together like playing with real people — present in modern instruments and many apps — teachers can use it instead of clapping the beat.",
      "与伴奏乐队练习（鼓、贝斯、模拟合奏）像与真人合奏一样训练节奏与配合——现代乐器与众多应用均具备——老师可用它代替拍手数拍。"],
    ["inn:world:accessible-music-technology", "เทคโนโลยีเข้าถึงได้ทุกคน", "เครื่องมือดิจิทัลเปิดทางให้ผู้เรียนที่เคยเข้าถึงยาก (มือที่เคลื่อนไหวจำกัด การมองเห็นไม่ครบ สมาธิสั้น) ได้เริ่มเล่นดนตรี — โปรแกรมปรับขนาดตัวโน้ต เสียงตอบรับทันที หรือกิจกรรมสั้น ๆ ตามสมาธิ — หลักการทั่วโลก: ปรับเครื่องมือ ไม่ปรับตัวผู้เรียน",
      "Digital tools open music to learners who struggled to access it (limited hand movement, low vision, short attention) — enlarged notation, instant feedback, short activities — the worldwide principle: adapt the tool, not the learner.",
      "数字工具让此前难以入门的学习者（手部活动受限、视力不足、注意力短）开始学音乐——放大乐谱、即时反馈、短时活动——全球原则：调整工具，而非改变学习者。"],
    ["inn:world:notation-publishing-direct", "เผยแพร่โน้ตได้เอง", "ซอฟต์แวร์เขียนโน้ตทำให้ครูและนักเรียนเผยแพร่ผลงานได้เองทั่วโลก โดยไม่ต้องผ่านสำนักพิมพ์ — แจกเป็นของขวัญ ขายในร้านออนไลน์ หรือใช้ในชั้นเรียนทันที — วงจรสร้างสรรค์ที่ปิดได้ในเครื่องเดียว",
      "Notation software lets teachers and students publish worldwide without a publisher — give it as a gift, sell it in online stores, or use it in class at once — a creative loop closed on one device.",
      "打谱软件让师生无需出版社即可全球发布——当作礼物赠送、在网店里销售，或直接用于课堂——一台设备完成创作闭环。"],
    ["inn:world:community-platforms-learning", "แพลตฟอร์มชุมชน: เรียนรู้จากกันและกัน", "ฟอรัม กลุ่ม และชุมชนออนไลน์ที่นักดนตรีช่วยกันตอบ แชร์วิธีแก้ปัญหา และแลกเพลงกัน มีอยู่ทั่วโลก — นักเรียนที่ติดขัดมักได้คำตอบเร็วจากคนที่เพิ่งผ่านมา — ครูชี้ชุมชนที่เชื่อถือได้เป็นแหล่งเรียนเสริม",
      "Forums, groups and online communities where musicians help each other, share fixes and swap repertoire exist worldwide — a stuck student often gets a fast answer from someone who just passed that hurdle — point students to trustworthy communities as extra learning.",
      "全球都有乐手互助的论坛、群组与社区——卡住的学生常能从刚跨过同一道坎的人那里快速得到答案——引导学生把可信社区当作补充学习资源。"],
  ];
  for (const [id, th, bodyTh, en, zh] of INNOVATION) {
    kb.add({
      id, type: "fact", domain: "innovation",
      title: th,
      body: `${bodyTh}\n(EN: ${en}) (ZH: ${zh})`,
      teach: "ใช้อธิบายภาพรวมนวัตกรรมที่มีอยู่จริงและใช้กันกว้าง — ไม่อ้างเปอร์เซ็นต์ ไม่ทำนายอนาคต",
      confidence: 0.7, source: "tiga-industry-craft",
      tags: ["innovation", "world-craft"],
    });
  }

  /* ── ดนตรีบำบัด (music therapy) — WELLBEING FRAME เหล็ก ── */
  const THERAPY = [
    ["thx:world:community-music", "ดนตรีชุมชน: เล่นร่วมกันคือบริบทสุขภาวะที่พบทั่วโลก", "กิจกรรมดนตรีร่วมกัน (วงเครื่องสายชุมชน คอรัสผู้สูงอายุ วงเครื่องตี้โรงเรียน) พบทุกทวีปและสัมพันธ์กับความรู้สึกเป็นส่วนหนึ่งของกลุ่ม — ครูเปียโนสร้างบริบทนี้ได้: ดูโอ้ง่าย ๆ การเล่นเพลงเดียวกันกับเพื่อน",
      "Community music-making (strings ensembles, senior choirs, school drum circles) exists on every continent and is associated with belonging — piano teachers can create it: easy duets, playing the same song as a friend.",
      "社区音乐活动遍布各大洲，与归属感相关——师生二重奏即可营造。"],
    ["thx:world:practice-ritual-calm", "พิธีเล็ก ๆ ก่อนซ้อม: จังหวะปลอดภัยของร่างกาย", "หลักที่ครูทั่วโลกใช้กับเด็กกังวล: เริ่มช่วงซ้อมด้วยท่าทางเดิม ๆ (หายใจลึก 3 ครั้ง ฟังเสียงคอร์ดแรก) — ความสม่ำเสมอให้ร่างกายรู้ว่า 'ที่นี่ปลอดภัย' ก่อนสั่งมือเล่นโน้ต",
      "A calm start ritual (three breaths, hear the first chord) before practice tells the body 'this is safe' before the hands play — used by teachers worldwide with anxious learners.",
      "练习前的小仪式（三次深呼吸、听第一个和弦）让身体先安心。"],
    ["thx:world:mistake-safety", "ความผิดพลาดคือส่วนของการเรียน (ความปลอดภัยทางใจ)", "สิ่งแวดล้อมที่ 'ผิดได้' คือเงื่อนไขของการเรียนรู้ดนตรีที่ยอมรับกว้างทั่วโลก — ครูที่ตอบความผิดพลาดด้วยความอยากรู้ (ชวนฟังว่าเกิดอะไร) ไม่ใช่คำติ ช่วยให้นักเรียนกลับมาเรียนยาวขึ้น",
      "A mistake-safe environment is the widely accepted condition of music learning worldwide — teachers who meet errors with curiosity, not blame, keep learners longer.",
      "允许犯错的环境是音乐学习的普遍条件——以好奇回应错误。"],
    ["thx:world:music-emotion-vocabulary", "ดนตรีคือคลังคำศัพท์ของอารมณ์", "การชวนนักเรียนตั้งชื่ออารมณ์ในเพลง (ท่อนนี้เศร้าแบบไหน? สงบหรือเหงา?) เป็นกิจกรรมที่พบทั่วโลกทั้งในห้องเรียนและงานสุขภาวะ — ฝึกการรู้จักอารมณ์ตัวเองผ่านเสียง โดยไม่ต้องเป็นการบำบัดใด ๆ",
      "Naming the emotion in the music (what kind of sad is this?) is found worldwide in classrooms and wellbeing work alike — emotional vocabulary through sound, no therapy required.",
      "为音乐中的情绪命名是全球课堂与福祉活动共有的练习。"],
    ["thx:world:performance-nerves-reframe", "ใจสั่นบนเวที = ตัวช่วย ไม่ใช่ศัตรู", "แนวปฏิบัติที่ยอมรับกว้าง: ตีความอาการใจสั่นว่า 'ร่างกายเตรียมพร้อม' (พลังที่จะเอาไปเล่น) แทนคำว่า 'ผมกลัว' — ครูเปียโนทั่วโลกใช้การเปลี่ยนคำพูดนี้ช่วยนักเรียนก่อนขึ้นเล่น",
      "A widely accepted reframe: stage nerves are the body preparing to play, not fear — teachers worldwide use this wording change before performances.",
      "把紧张重新解读为身体在准备演奏，而非恐惧。"],
    ["thx:world:music-lifespan", "ดนตรีเดินเคียงคนทุกช่วงวัย", "จากเด็กเล็กที่เคลื่อนไหวตามจังหวะ ผู้ใหญ่ที่กลับมาเล่นหลังวัยเรียน ถึงผู้สูงอายุที่เล่นเพื่อความคล่องของนิ้วและความสุข — บทบาทของดนตรีในชีวิตพบทั่วโลก; บทบาทของแอป: เปิดทางให้ทุกวัยเริ่มได้ตามแรงใจ",
      "From toddlers moving to beat, adults returning after school years, to seniors playing for finger ease and joy — music accompanies every life stage worldwide; the app's role is to open the door at any age.",
      "从幼儿到长者，音乐伴随每个人生阶段——应用的角色是让任何年龄都能开始。"],
    ["thx:world:rhythm-regulation", "จังหวะที่ทำให้ร่างกายสงบลง", "การดีดจังหวะคงที่หรือฟังจังหวะช้า ๆ เป็นวิธีที่คนทั่วโลกใช้ให้ร่างกายคลายตัวก่อนเริ่มกิจกรรม — ครูเปียโนใช้เป็นช่วงเปิดซ้อม: จังหวะสม่ำเสมอ ร่างกายตามทัน ใจตามทัน",
      "Steady rhythmic playing or listening to a slow pulse is how people worldwide settle their bodies before an activity — piano teachers use it as a practice opener: steady beat, body follows, mind follows.",
      "以稳定的节奏弹奏或聆听缓慢脉动，是全球通用的开场安定方式——钢琴教师用作练习开场：节拍稳定，身体跟上，心也随之安定。"],
    ["thx:world:receptive-listening", "การฟังอย่างตั้งใจ: ทางผ่อนที่ง่ายที่สุด", "การฟังเพลงอย่างตั้งใจ (ปิดอย่างอื่น ฟังทั้งชิ้น) เป็นกิจกรรมสุขภาวะที่ทำได้ทุกที่และพบทั่วโลก — ไม่ต้องเล่นเองก็ได้ประโยชน์จากการอยู่กับเสียง — ครูใช้เป็นช่วงพักในห้องเรียนได้",
      "Intentional listening (everything else off, hear the whole piece) is a wellbeing activity done anywhere and found worldwide — you benefit from being with sound without playing — teachers use it as a class pause.",
      "专注聆听（关掉其他事务、听完整首）是随处可做、全球通行的福祉活动——不弹奏也能从与声音共处中获益——教师可将其用作课堂休息。"],
    ["thx:world:mood-labeling-with-music", "ตั้งชื่ออารมณ์ด้วยเพลง", "การให้นักเรียนเลือกเพลงที่ 'ตรงกับวันนี้' แล้วบอกว่ารู้สึกอะไรขณะฟัง เป็นการฝึกการรู้อารมณ์ที่ใช้ในห้องเรียนทั่วโลก — พูดได้เท่าที่รู้สึก ไม่ต้องวิเคราะห์ลึก — ครูฟังร่วม ไม่ตัดสิน",
      "Asking a student to pick a song that 'fits today' and name what they feel while listening trains emotional awareness in classrooms worldwide — say only what you feel, no deep analysis — the teacher listens alongside, without judging.",
      "让学生挑一首“契合今天”的歌并在聆听时说出感受，是全球课堂的情绪觉察练习——说出真实感受即可，无需深挖——教师同听，不加评判。"],
    ["thx:world:familiar-repertoire-safety", "เพลงคุ้นเคย = ฐานที่ปลอดภัย", "การเริ่มด้วยเพลงที่คุ้นเคยทำให้ผู้เรียนรู้สึกมั่นคง ก่อนไปเพลงใหม่ที่ยากกว่า — หลักการที่ยอมรับกว้างทั่วโลกในคลาสทุกวัย — ครูรักษาสมดุล: เพลงคุ้นไว้ให้กำลังใจ เพลงใหม่ไว้ให้เติบโต",
      "Starting from familiar pieces gives the learner a secure base before harder new music — a widely accepted principle in classes of every age worldwide — keep the balance: familiar pieces for confidence, new ones for growth.",
      "从熟悉的作品开始，为学习者提供面对更难新曲前的安全基座——全球各年龄课堂公认的平衡之道——熟悉曲建立信心，新曲带来成长。"],
    ["thx:world:singing-together-cohesion", "ร้องด้วยกัน: เชื่อมคนเข้าหากัน", "การร้องเพลงพร้อมกันในห้องเรียน (ไม่ต้องร้องเดี่ยว) เป็นกิจกรรมที่สร้างความรู้สึกเป็นหนึ่งเดียวและพบได้ทั่วโลก — ครูเริ่มจากเพลงง่าย เสียงเบา ไม่บังคับร้องเดี่ยว — ใครพร้อมค่อยดัง",
      "Singing together in class (never solo-forced) builds a sense of oneness and is found worldwide — start with an easy, quiet song, no solo pressure — voices grow loud when ready.",
      "课堂齐唱（绝不强迫独唱）营造一体感，遍及全球——从简单轻声的歌开始，不强迫独唱——准备好了，声音自然会大。"],
    ["thx:world:improvisation-as-expression", "ด้นสด: ปล่อยของอย่างปลอดภัย", "การด้นสดบนคอร์ดง่าย ๆ ให้นักเรียนได้แสดงออกโดยไม่มีผิดถูก — ใช้ในห้องเรียนทั่วโลกเพื่อเปิดใจและสนุกกับเสียง — ครูรับทุกคำตอบด้วยความอยากรู้ ไม่ประเมินว่าเพราะ/ไม่เพราะ",
      "Improvising over simple chords lets students express without right or wrong — used in classrooms worldwide to open up and enjoy sound — the teacher receives every answer with curiosity, not a 'good/bad' judgment.",
      "在简单和弦上即兴让学生无需对错地表达——全球课堂用于敞开心扉、享受声音——教师以好奇接住每个回答，而非评判好听与否。"],
    ["thx:world:movement-to-beat", "เคลื่อนไหวตามจังหวะ: ร่างกายก่อนนิ้ว", "การเคาะจังหวะ เขย่าเบา ๆ หรือขยับตามเพลงก่อนแตะคีย์ เป็นการเตรียมตัวที่เด็กและผู้ใหญ่ทั่วโลกใช้ — เชื่อมหู ร่างกาย และจังหวะเข้าด้วยกันก่อนเรื่องเทคนิค — ครูเริ่มได้ในไม่กี่วินาที",
      "Tapping the beat, gentle shaking or moving to the music before touching the keys is a preparation adults and children use worldwide — it joins ear, body and pulse before technique — a teacher can start it in seconds.",
      "触键前打拍子、轻摇或随乐而动，是全球成人与孩子通用的准备——在技巧之前先连接耳朵、身体与脉搏——教师几秒即可开始。"],
    ["thx:world:teacher-presence-calm", "ครูที่สงบ ทำให้ห้องสงบ", "น้ำเสียง จังหวะการพูด และความอดทนของครูเป็นตัวอย่างที่นักเรียนซึมซับโดยไม่รู้ตัว — ครูที่สงบเมื่อเกิดความผิดพลาด ทำให้ห้องเรียนปลอดภัยขึ้นเอง — การดูแลใจเริ่มจากตัวครูก่อนเสมอ",
      "A teacher's tone, pace and patience are absorbed by students without them noticing — a teacher who stays calm at mistakes makes the room feel safe by itself — caring teaching always starts with the teacher.",
      "教师的语气、节奏与耐心会被学生不知不觉吸收——面对错误依然沉稳的教师，让课堂自然安全——关怀式教学，始于教师自身。"],
    ["thx:world:pause-and-silence", "ช่วงหยุดเงียบ: เว้นให้เสียงมีค่า", "การเว้นช่วงเงียบสั้น ๆ ในชั้นเรียน (หลังเพลง หรือก่อนเริ่มหัวข้อใหม่) ให้ผู้เรียนได้ตั้งตัว — ธรรมเนียมที่ครูทั่วโลกใช้ ไม่ใช่ความเงียบที่น่าอึดอัด — ครูเป็นตัวอย่างให้เห็นว่าหยุดได้ ไม่ต้องรีบ",
      "A short silence in class (after a piece, before a new topic) lets learners reset — a routine teachers worldwide use, not an awkward gap — the teacher models that pausing is allowed, there is no rush.",
      "课堂中的短暂静默（一曲之后、新课题之前）让学习者重新定神——全球教师的常用节奏，而非尴尬冷场——教师示范：可以停下，并不匆忙。"],
    ["thx:world:song-as-companion", "เพลงประจำตัว: เพื่อนที่กลับมาหาได้", "การมีเพลงประจำตัวที่นักเรียนเลือกเอง ให้ความรู้สึกว่ามีสิ่งที่กลับมาหาได้เสมอ ไม่ว่าสัปดาห์จะเป็นอย่างไร — ใช้ทั่วโลกในห้องเรียนทุกวัย — ปล่อยให้เลือกเอง ครูแค่ช่วยดูว่าระดับพอเหมาะ",
      "Having a self-chosen signature piece gives the learner something to return to, whatever the week was like — used worldwide in classes of every age — let them choose; the teacher only checks the level fits.",
      "拥有一首自己挑选的代表作，让人无论这一周如何都有可回归之物——全球各年龄课堂皆用——让学生自选，教师只把关程度是否合适。"],
  ];
  for (const [id, th, bodyTh, en, zh] of THERAPY) {
    kb.add({
      id, type: "principle", domain: "music-therapy",
      title: th,
      body: `${bodyTh}\n(EN: ${en}) (ZH: ${zh})\nกรอบ wellbeing: หลักการการสอนดนตรีเพื่อสุขภาวะ ไม่ใช่บริการทางการแพทย์ (EN: wellbeing frame — a teaching principle, not a medical service) (ZH: 健康框架——教学原则，而非医疗服务)`,
      teach: "ใช้เป็นทัศนคติการสอนที่ดูแลใจนักเรียนเท่านั้น — ห้ามอ้างผลการรักษา ห้ามวินิจฉัย",
      confidence: 0.65, source: "tiga-wellbeing-frame",
      tags: ["therapy", "wellbeing", "world-craft"],
    });
  }
  return kb;
}
