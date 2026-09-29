/* ── tigamodel/knowledge/music-education-market.js — plan v3.4 6.8
   (KB ตลาดการเรียนดนตรี: วงจรผู้เรียน · แรงจูงใจผู้ปกครอง · เหตุผลการเลิกเรียน ·
   โครงสร้างระบบเกรดซ้อม — เชิงคุณภาพ ไม่อ้างตัวเลขของสถาบันใด)
   กติกาเหล็ก: zero fabricated statistics · 3 ภาษาในทุก body ── */

export function seedMusicEducationMarket(kb) {
  /* วงจรผู้เรียน (learner lifecycle) */
  const LIFECYCLE = [
    ["trial-hope", "ทดลอง: มาด้วยความหวัง", "ผู้เรียนใหม่มาพร้อมภาพฝัน ('อยากเล่นเพลงนั้นได้') — คาบแรกที่ทำให้ฝันนั้นรู้สึก 'ใกล้ขึ้นจริง' คือคาบที่กำหนดทั้งวงจร",
      "New learners arrive with a dream ('I want to play that song') — the first lesson that makes the dream feel closer sets the whole lifecycle.",
      "新学员带着梦想而来（'我想弹会那首歌'）——让梦想显得更近的第一课决定整个旅程。"],
    ["hook-attachment", "ติดหัว: ผูกกับเพลงที่รัก", "ช่วงต่อมาผู้เรียนต้องผูกกับเพลงที่ตัวเองรัก — คนที่ซ้อมเพราะ 'เพลงของฉัน' อยู่ได้ยาว คนที่ซ้อมเพราะ 'ถูกสั่ง' เหลือน้อยลงทุกรอบ",
      "Next, learners must attach to a song they love — 'my song' practice lasts; 'because I was told' practice fades.",
      "接着学员要和自己喜欢的歌绑定——为'我的歌'而练能长久，为'被要求'而练会消退。"],
    ["milestone-climb", "ไต่ระดับด้วยเป้าที่เห็นจุดจบ", "ผู้เรียนอยู่ต่อเพราะเห็น 'ชั้นถัดไป' ชัดเจน: เพลงที่จบได้ · เกรดที่สอบได้ · เวทีที่ขึ้นได้ — เป้าต้องจบได้จริง ไม่ใช่เมฆ",
      "Learners stay when the next level is concrete: a finishable song, a gradeable exam, a reachable stage — goals must end, not float.",
      "学习者留下是因为'下一级'具体：能弹完的歌、能考的级、能上的台——目标必须能完成，不能悬空。"],
    ["identity-shift", "ผู้เรียนกลายเป็น 'คนเล่นเปียโน'", "จุดที่ผู้เรียนเรียกตัวเองว่า 'ผมเล่นเปียโน' คือจุดที่ฝึกไม่ต้องใช้แรงผลักอีก — อัตลักษณ์แรงกว่าวินัย",
      "When a learner starts saying 'I play piano,' practice stops needing pushing — identity beats discipline.",
      "当学员开始说'我弹钢琴'时，练琴不再需要推——身份认同胜过自律。"],
  ];
  for (const [id, th, bodyTh, en, zh] of LIFECYCLE) {
    kb.add({
      id: `edu:lifecycle:${id}`, type: "principle", domain: "music-education-market",
      title: `วงจรผู้เรียน: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "จับคู่กับคิวการสอนจริง: คาบแรกให้เล่นอะไรสวยได้ทันที · สัปดาห์ต่อมาผูกเพลงรัก · ทุกเดือนมีเป้าที่จบได้",
      confidence: 0.72, source: "tiga-pedagogy-market",
      tags: ["education-market", "lifecycle", id], meta: { family: "lifecycle" },
    });
  }

  /* แรงจูงใจของผู้ปกครอง */
  const PARENTS = [
    ["future-skills", "ผู้ปกครองซื้อ 'ทักษะที่ติดตัว' ไม่ใช่แค่เพลง", "สิ่งที่ผู้ปกครองมักหวังคือวินัย · ความมั่นใจ · ความอดทนที่ไปกับลูกทั้งชีวิต — การรายงานความคืบหน้าจึงควรพูดถึงสิ่งเหล่านี้ ไม่ใช่แค่เพลงที่เล่นผ่าน",
      "Parents usually hope for discipline, confidence, perseverance that outlast childhood — progress reports should speak to those, not just songs completed.",
      "家长通常期待的是纪律、自信、坚持这些伴随一生的素质——进度汇报应该说到这些，不只是弹了几首曲子。"],
    ["visible-progress", "ผู้ปกครองต้อง 'เห็น' ความคืบหน้า", "การซ้อมที่ไม่เห็นผลรู้สึกเหมือนเสียเปล่าในสายตาผู้ปกครอง — บ้านที่ผู้ปกครองได้ยินเพลงที่คืบหน้าจริงคือบ้านที่ต่อคอร์ส",
      "Progress parents can't see feels wasted — a home that hears real improvement keeps renewing.",
      "看不见进步的练琴在家长眼里像白费——能听到真实进步的家庭会一直续费。"],
    ["pride-moment", "โมเมนต์ภาคภูมิใจ: ลูกเล่นให้ญาติฟัง", "เทศกาลครอบครัวที่ลูกเล่นเพลงจบหนึ่งเพลงคือความทรงจำที่ผู้ปกครองเล่าซ้ำได้ปี — ช่วยจัดโมเมนต์นี้เป็นบริการ ไม่ใช่บังเอิญ",
      "A family moment where the child finishes a whole song becomes a memory retold for years — engineer it as a service, not luck.",
      "孩子完整弹完一首的家庭时刻会成为讲多年的记忆——把它设计成服务，而不是运气。"],
  ];
  for (const [id, th, bodyTh, en, zh] of PARENTS) {
    kb.add({
      id: `edu:parents:${id}`, type: "principle", domain: "music-education-market",
      title: `ผู้ปกครอง: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ใช้ใน Report Card (6.10) และข้อความครอบครัวทุกชิ้น — พูดถึงทักษะชีวิต + โมเมนต์ที่เห็นได้ จาก log จริงเท่านั้น",
      confidence: 0.72, source: "tiga-pedagogy-market",
      tags: ["education-market", "parents", id], meta: { family: "parents" },
    });
  }

  /* เหตุผลที่คนเลิกเรียน — คู่ตรงข้ามของวงจรข้างบน */
  const CHURN = [
    ["wall-too-high", "กำแพงสูงเกินตัว", "สาเหตุอันดับต้นของการเลิกเรียนคือเจอเพลง/แบบฝึกที่ยาก 'กระโดดไม่ถึง' — ทางแก้คือแตกขั้นให้เล็กลง (มีในเอนจินแล้ว) ไม่ใช่บอกให้พยายามมากขึ้น",
      "The leading cause of quitting is hitting material too hard to reach — the fix is smaller steps, not 'try harder.'",
      "退课的首要原因是遇到够不着的内容——解法是拆小步骤，而不是'更努力'。"],
    ["invisible-progress", "ซ้อมแล้วไม่เห็นความคืบหน้า", "คนเลิกเมื่อ 'ซ้อมทุกวันแต่รู้สึกเหมือนยืนที่เดิม' — ต้องมีการวัดที่เห็นจริง (เทปเก่าเทียบวันนี้) ทุก 1-2 สัปดาห์",
      "Learners quit when 'practicing daily but standing still' — visible measurement (old recording vs today) every 1-2 weeks.",
      "每天练却像原地踏步就会退课——每一两周要有看得见的对比（旧录音 vs 今天）。"],
    ["no-song-love", "ไม่มีเพลงที่รักในหลักสูตร", "หลักสูตรที่ไม่มีเพลงที่ผู้เรียน 'ชอบเอง' แม้แต่เพลงเดียวจะหมดแรงดึงในไม่ช้า — เพลงรักคือเชื้อเพลิง ไม่ใช่ของรางวัล",
      "A curriculum with zero songs the learner personally loves loses pull fast — the loved song is fuel, not a reward.",
      "课程里没有一首学员真心喜欢的歌，吸引力很快耗尽——喜欢的歌是燃料，不是奖励。"],
    ["lonely-practice", "ซ้อมคนเดียวรู้สึกโดดเดี่ยว", "การซ้อมที่ไม่มีใคร 'เห็น' ทำให้แรงหมดเร็ว — ระบบชุมชน/ครูที่สังเกตความคืบหน้าสม่ำเสมอช่วยตรงนี้โดยตรง",
      "Unseen practice loses steam — regular teacher/community acknowledgment addresses this directly.",
      "无人看见的练习容易泄气——老师和社群的持续关注正解决这一点。"],
  ];
  for (const [id, th, bodyTh, en, zh] of CHURN) {
    kb.add({
      id: `edu:churn:${id}`, type: "principle", domain: "music-education-market",
      title: `ทำไมถึงเลิกเรียน: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ครู AI ใช้ entry กลุ่มนี้จับสัญญาณท้อก่อนยอมแพ้: ผลซ้อมถอย + ห่างหาย → เช็ก 4 สาเหตุนี้แล้วปรับ (ผูกกับ self-report เดิม)",
      confidence: 0.7, source: "tiga-pedagogy-market",
      tags: ["education-market", "churn", id], meta: { family: "churn" },
    });
  }

  /* โครงสร้างระบบเกรดซ้อม (เชิงคุณภาพ — ไม่อ้างเกณฑ์ของสถาบันใด) */
  const GRADES = [
    ["grade-logic", "ระบบเกรดให้ 'บันไดที่ใครก็เห็นภาพ'", "ระบบสอบเกรดของสถาบันต่าง ๆ ทั่วโลกมีโครงคล้ายกัน: เริ่มจากพื้นฐานอ่านโน้ต/จังหวะ → สเกลและอาร์เปจโจ → รีพีเทอร์ระดับต่าง ๆ → ขั้นสูงเน้นการตีความ — ผู้เรียนเข้าใจว่าตัวเองอยู่ 'ก้าวที่เท่าไร'",
      "Grade systems worldwide share a shape: basics of reading/rhythm → scales and arpeggios → graded repertoire → advanced interpretation — learners can see which step they're on.",
      "全球考级体系结构相似：读谱/节奏基础→音阶琶音→分级曲目→高级演绎——学习者能看清自己站在哪一级。"],
    ["exam-as-milestone", "สอบเกรดคือเป้าหมายที่มีวันจบ", "ความดีของเป้าหมายสอบคือ 'มีวันสอบจริง' — ผู้เรียนที่ลอยอยู่ได้ผลดีเมื่อมีวันที่แน่นอนรออยู่ แต่ไม่ใช่ทุกคนต้องสายสอบ (เส้นทางเวที/แต่งเพลงก็จริง)",
      "Exams work because the date is real — floaters benefit from a fixed date, but exams aren't for everyone (stage and writing paths are real too).",
      "考试有效因为日期是真的——漂着的人受益于固定日期，但不是人人都要考级（舞台和创作路线同样真实）。"],
    ["piece-vs-technique", "เกรดซ้อมเชิงเทคนิคต้องคู่เพลงที่รัก", "ซ้อมเฉพาะสเกล/เทคนิคโดยไม่มีเพลงที่อยากเล่นรออยู่ปลายทาง = ซ้อมแห้ง — โครงที่ยั่งยืนคือเทคนิคหนึ่งคู่เพลงรักหนึ่งสลับกันไป",
      "Scales without a loved song waiting at the end = dry practice — the sustainable structure alternates technique with the loved piece.",
      "只练音阶没有想弹的曲子在终点等着=干练——可持续的结构是技巧与爱曲交替。"],
  ];
  for (const [id, th, bodyTh, en, zh] of GRADES) {
    kb.add({
      id: `edu:grades:${id}`, type: "fact", domain: "music-education-market",
      title: `ระบบเกรด: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "อธิบายเชิงภาพรวมเท่านั้น — ไม่อ้างเกณฑ์คะแนน/ชื่อสถาบันใด (แหล่งที่มาไม่มีในไฟล์ → ห้ามกล่าวถึง)",
      confidence: 0.7, source: "tiga-pedagogy-market",
      tags: ["education-market", "grades", id], meta: { family: "grades" },
    });
  }
}
