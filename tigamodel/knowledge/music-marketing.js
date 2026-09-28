/* ── tigamodel/knowledge/music-marketing.js — plan v3.4 6.1 (KB การตลาดดนตรี)
   Hook-first · เลือกเพลงตามกลุ่มเป้าหมาย · sequencing · arrangement thinking · positioning
   กติกาเหล็ก: เชิงคุณภาพล้วน — ไม่มีสถิติ/เปอร์เซ็นต์/ตัวเลขอ้างว่างใด ๆ (No invented data)
   ทุก entry เป็น craft knowledge ที่ยอมรับกว้างในวงการ · เขียน 3 ภาษา (th/en/zh)
   ตามกติกาแผน: ภาษาหลักใน title/body, en/zh อยู่ใน gloss — ครู AI เลือกตาม lang ของผู้เรียน ── */

/* เพลงติดหูมีโครงแบบไหน — hook-first craft (5 หลักการ) */
export function genMarketingHookFirst(kb) {
  const out = [];
  const HOOKS = [
    ["chorus-first", "เปิดฮุคก่อน", "เปิดด้วยท่อนฮุคก่อนเข้า verse — ผู้ฟังจับจุดจำได้ทันทีตั้งแต่วินาทีแรก",
      "Start with the hook before the verse — the listener's ear catches the memorable part in the first seconds.",
      "先副歌后主歌——听众在开头几秒就抓住记忆点。"],
    ["short-intro", "อินโทรสั้น", "อินโทรนานเกินจะทำให้ผู้ฟังเลื่อนหนี — สั้นและเข้าท่อนหลักเร็วคือกติกายุคนี้",
      "A long intro invites skipping — keep it short and reach the main section fast.",
      "前奏太长听众就划走——要短，尽快进入主题段。"],
    ["one-take-melody", "ทำนองจำได้ในรอบเดียว", "เส้นทำนองที่ดีจำได้ตั้งแต่ฟังรอบแรก ลองร้องกลับได้ทันทีโดยไม่ต้องเปิดซ้ำ",
      "A strong melody is singable back after one listen — no replay needed.",
      "好旋律听一遍就能哼回来，无需重放。"],
    ["repetition-with-variation", "ซ้ำแต่ไม่จำเจ", "ท่อนฮุคต้องกลับมาซ้ำพอให้จำ แต่เปลี่ยนรายละเอียดเล็ก ๆ กันเบื่อ",
      "Hooks must repeat enough to stick, with small variations to stay fresh.",
      "副歌要重复到记住，但用小变化保持新鲜感。"],
    ["title-in-hook", "ชื่อเพลงอยู่ในฮุค", "วางชื่อเพลงไว้ในท่อนที่จำได้ง่ายที่สุด — ผู้ฟังจะค้นหาเจอจากท่อนเดียวที่จำได้",
      "Put the title in the most memorable line — that's the phrase people search for.",
      "把歌名放进最抓耳的一句——听众就靠这一句来搜歌。"],
  ];
  for (const [id, th, bodyTh, en, zh] of HOOKS) {
    kb.add({
      id: `mkt:hook:${id}`, type: "principle", domain: "music-marketing",
      title: `Hook-first: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "เลือกเพลงที่ผู้เรียนรักแล้วชวนสังเกตว่า 'ฮุคอยู่ที่ไหน เข้าเร็วแค่ไหน' — สอนผ่านเพลงที่ผู้เรียนชอบอยู่แล้ว",
      confidence: 0.75, source: "tiga-industry-craft",
      tags: ["marketing", "hook-first", id], meta: { family: "hook-first" },
    });
    out.push(`mkt:hook:${id}`);
  }
  return out;
}

/* เลือกเพลงตามกลุ่มเป้าหมาย — จับคู่กลุ่มผู้เรียนกับแนวเพลง (เชิงแนวทาง ไม่อ้างสถิติ) */
export function genMarketingAudience(kb) {
  const out = [];
  const AUD = [
    ["th-home", "ผู้เรียนไทย", "เพลงไทยเป็นบ้าน: เริ่มจากเพลงไทยที่ผู้เรียนได้ยินทุกวัน — ความคุ้นเคยคือแรงดึงที่แรกที่สุดของการฝึก",
      "Thai learners start with songs they already hear daily — familiarity is the strongest pull for practice.",
      "泰国学习者从每天听到的歌开始——熟悉感是练琴最强的动力。"],
    ["global-pop", "ผู้เรียนที่ชอบเพลงฮิตสากล", "ป๊อปสากลที่เล่นง่าย (คอร์ดไม่กี่ตัว ทำนองไล่ตามมือ) เหมาะเป็นเป้าถัดไปเมื่อพื้นฐานนิ่ง",
      "Easy global pop (few chords, hand-friendly lines) is a natural next step once basics are steady.",
      "简单流行的国际金曲（和弦少、旋律顺手）是基础扎实后的自然下一步。"],
    ["c-pop", "ผู้เรียนภาษาจีน", "C-pop ที่ผู้เรียนฟังอยู่แล้วสร้างการเชื่อมต่อทันที แล้วขยายไปคลาสสิกทีหลัง",
      "C-pop the learner already listens to creates instant connection; classical expands later.",
      "学习者已在听的中文流行歌能立刻建立连接，之后再拓展到古典。"],
    ["classical-adult", "ผู้เรียนผู้ใหญ่สายคลาสสิก", "ผู้ใหญ่ที่ตั้งใจสายคลาสสิกเรียนจากชิ้นเล็กที่จบได้จริง — ความสำเร็จที่จบเร็วดึงกลับมามากกว่าชิ้นใหญ่ที่ค้าง",
      "Adult classical learners thrive on small pieces they can finish — completed wins pull more than stalled epics.",
      "成年古典学习者靠能完成的小曲进步——完成的小胜利比卡住的大曲更有吸引力。"],
    ["kids-family", "เด็กและครอบครัว", "เด็กเรียนผ่านเพลงที่ครอบครัวร้องตามได้ — บ้านที่ร้องตามได้คือบ้านที่ฝึกต่อเนื่อง",
      "Kids learn through songs the family can sing along — a sing-along home keeps practice going.",
      "孩子通过全家能跟着唱的歌学习——能合唱的家庭让练琴持续。"],
  ];
  for (const [id, th, bodyTh, en, zh] of AUD) {
    kb.add({
      id: `mkt:audience:${id}`, type: "strategy", domain: "music-marketing",
      title: `เลือกเพลงตามกลุ่มผู้เรียน: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ถามผู้เรียนว่า 'อยากเล่นเพลงไหนให้ได้' แล้วย้อนวางแผนจากเพลงนั้น — แรงจูงใจมาจากเพลงที่ผู้เรียนเลือกเอง",
      confidence: 0.72, source: "tiga-industry-craft",
      tags: ["marketing", "audience", id], meta: { family: "audience" },
    });
    out.push(`mkt:audience:${id}`);
  }
  return out;
}

/* Sequencing: จบเพลงหนึ่ง → เพลงถัดไปยก 1 ขั้น (ต่อยอด skill-graph) */
export function genMarketingSequencing(kb) {
  const out = [];
  const SEQ = [
    ["one-level-up", "ยกหนึ่งขั้น", "เพลงถัดไปควรยากกว่าเพลงที่เพิ่งจบเพียง 'ขั้นเดียว' — มือใหม่ที่เจอกำแพงสูงไปเลิกเรียน มือที่ไต้บันไดทีละขั้นอยู่ต่อ",
      "The next song should be exactly one step harder — one-step ladders keep learners; tall walls end them.",
      "下一首歌只应难一级——一级一级的阶梯留住学习者，高墙只会吓退他们。"],
    ["same-groove-first", "ก่อนแกะเพลงใหม่ ย้ำเพลงเก่าให้คล่อง", "เล่นเพลงเก่าได้ลื่นจริงก่อนเปิดเพลงใหม่ — ความคล่องที่รู้สึกได้คือเชื้อเพลิงของความมั่นใจ",
      "Get the old song truly smooth before opening the new one — felt fluency fuels confidence.",
      "把旧曲弹顺再开新曲——感受到的流畅是自信的燃料。"],
    ["recital-ready-checkpoint", "จุด 'เล่นให้คนอื่นฟังได้'", "ทุก 3-4 เพลง มีเพลงหนึ่งที่พร้อมเล่นให้ครอบครัวฟัง — การแสดงเล็ก ๆ คือเหตุผลที่การฝึกมีความหมาย",
      "Every 3-4 songs, one becomes performable for family — small performances give practice its meaning.",
      "每学三四首，就有一首能弹给家人听——小型演出让练习有了意义。"],
  ];
  for (const [id, th, bodyTh, en, zh] of SEQ) {
    kb.add({
      id: `mkt:seq:${id}`, type: "principle", domain: "music-marketing",
      title: `Sequencing: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "จบเพลงแล้วชวนผู้เรียนเลือกเพลงถัดไปจากสองทาง: 'ทำนองที่รัก' หรือ 'ขั้นถัดไปที่เตรียมไว้' — ให้เลือกเองทั้งสองทางถูกต้อง",
      confidence: 0.75, source: "tiga-industry-craft",
      tags: ["marketing", "sequencing", id], meta: { family: "sequencing" },
    });
    out.push(`mkt:seq:${id}`);
  }
  return out;
}

/* Arrangement thinking: สอนผู้เรียนคิดแบบโปรดิวเซอร์ — เพลงยากทำให้เล่นได้ */
export function genMarketingArrangement(kb) {
  const out = [];
  const ARR = [
    ["lower-key", "เลื่อนคีย์ให้มือพอดี", "เพลงยากไม่ต้องเล่นตามต้นฉบับ — เลื่อนคีย์ให้จับมือพอดี ผู้ฟังไม่เปรียบเทียบ ผู้เล่นได้ความภูมิใจ",
      "Hard songs don't need the original key — transpose to fit the hand; listeners don't compare, players gain pride.",
      "难曲不必照原调——移调到顺手的位置；听众不比较，弹奏者收获自豪。"],
    ["simplify-texture", "ลดเนื้อเพลงให้เหลือแกน", "แผนเดิมยากเกิน → เอาเฉพาะทำนอง + คอร์ดฐาน ให้เพลง 'รู้เรื่อง' ก่อน แล้วเติมความหนาทีหลัง",
      "If the original arrangement is too hard: melody + root chords first — make it make sense, then thicken.",
      "原版太难就先留旋律加根音和弦——先让曲子成立，再加厚。"],
    ["rhythm-over-notes", "จังหวะมาก่อนโน้ต", "เพลงที่จังหวะถูกน่าฟังกว่าเพลงที่โน้ตครบแต่จังหวะพัง — เลือกเวอร์ชันที่ 'จังหวะนิ่ง' ได้จริง",
      "Right rhythm beats complete-but-shaky notes — pick the version where the beat stays steady.",
      "节奏对了比音符全但节奏乱更好听——选节奏稳得住的版本。"],
    ["capo-thinking", "คิดแบบมีตัวช่วย", "โปรดิวเซอร์ใช้เครื่องมือเสมอ (คีย์บอร์ด transpose · capo · เมโทรนอม) — ใช้ตัวช่วยไม่ใช่ความอ่อนแอ คือวิธีทำงานมืออาชีพ",
      "Pros always use tools (transpose, capo, metronome) — helpers aren't weakness, they're the professional workflow.",
      "专业人士永远用工具（移调、变调夹、节拍器）——借助工具不是弱，而是职业工作方式。"],
  ];
  for (const [id, th, bodyTh, en, zh] of ARR) {
    kb.add({
      id: `mkt:arr:${id}`, type: "strategy", domain: "music-marketing",
      title: `Arrangement thinking: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ชวนผู้เรียนเลือก 'เวอร์ชันของตัวเอง' ของเพลงที่รัก — ผู้เรียนที่คิดเป็นจะเล่นต่อได้ทุกเพลงในอนาคต",
      confidence: 0.72, source: "tiga-industry-craft",
      tags: ["marketing", "arrangement", id], meta: { family: "arrangement" },
    });
    out.push(`mkt:arr:${id}`);
  }
  return out;
}

/* Positioning: อ่านจุดแข็งผู้เรียน → เล่าให้ผู้ปกครองฟัง (6.4 ต่อยอดจาก entry เหล่านี้) */
export function genMarketingPositioning(kb) {
  const out = [];
  const POS = [
    ["strength-lens", "มองผ่านเลนส์จุดแข็ง", "เวลาเล่าผลคืบหน้า เริ่มจากสิ่งที่ผู้เรียน 'ทำได้แล้ว' ก่อนสิ่งที่ต้องฝึกต่อ — ความภูมิใจเปิดหูให้คำแนะนำ",
      "Report progress starting from what the learner CAN do before what needs work — pride opens ears to advice.",
      "汇报进步先说能做到的，再说要改进的——自豪感让人听得进建议。"],
    ["genre-fit", "จับคู่แนวกับตัวตน", "ผู้เรียนที่เล่นแนวที่ 'ใช่ตัวเอง' จะฝึกเองโดยไม่ต้องเรียก — สังเกตว่าผู้เรียนฟังอะไรเพื่อชี้เส้นทาง",
      "Learners who play 'their' genre practice unprompted — watch what they listen to and point the path there.",
      "弹'属于自己'风格的学员会主动练琴——观察他们听什么，把路指向那里。"],
    ["progress-story", "เล่าเป็นเรื่อง ไม่ใช่ตัวเลข", "ความคืบหน้าที่ผู้ปกครองจำได้คือเรื่องเล่า: 'เดือนก่อนเล่นไม่ได้ วันนี้เล่นจบหนึ่งเพลง' — ไม่ใช่คะแนน",
      "Progress parents remember is a story: 'last month it wouldn't come, today a full song' — not a score.",
      "家长记得住的进步是故事：'上个月弹不成，今天完整一首'——而不是分数。"],
  ];
  for (const [id, th, bodyTh, en, zh] of POS) {
    kb.add({
      id: `mkt:pos:${id}`, type: "principle", domain: "music-marketing",
      title: `Positioning: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ใช้หลักนี้ใน Report Card และข้อความตอบผู้ปกครองทุกครั้ง — เล่าจากของจริงใน log เท่านั้น ไม่มีข้อมูล → ซ่อน (honest-null)",
      confidence: 0.75, source: "tiga-industry-craft",
      tags: ["marketing", "positioning", id], meta: { family: "positioning" },
    });
    out.push(`mkt:pos:${id}`);
  }
  return out;
}

/* Seed entry point — called from web.js next to the other expansion waves */
export function seedMusicMarketing(kb) {
  genMarketingHookFirst(kb);
  genMarketingAudience(kb);
  genMarketingSequencing(kb);
  genMarketingArrangement(kb);
  genMarketingPositioning(kb);
}
