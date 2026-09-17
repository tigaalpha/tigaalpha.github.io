/* ── tigamodel/knowledge/teacher-craft-seed.js ──
   GROUP 2 (knowledge every piano teacher needs) + GROUP 3 (topics that were
   only one-line prompt mentions) of the owner's gap audit (2026-09-17):
   memorization, ear training, practice plans by age, stage fright, injury
   prevention, motivation science (SDT + gamification done right), Thai
   music for a Thai-market app, graded-ladder specifics, and the four deep
   theory topics that existed only as prompt strings. Every `source` points
   at a page actually read on 2026-09-17; paraphrased pedagogy, never copied
   text. ── */

import { SOURCES } from "./university-sources.js";

export function seedTeacherCraft(kb) {
  const src = (id) => {
    if (!SOURCES[id]) throw new Error(`unknown source id: ${id} — no fake citations`);
    return id;
  };

  /* ── Memorization (Suzuki requires it; the KB had no "how") ── */
  kb.add({
    id: "tcraft:memory-three-channels", type: "fact", domain: "memorization",
    title: "จำเพลงด้วย 3 ช่องทางพร้อมกัน: ตา หู กล้ามเนื้อ — ช่องเดียวพังง่าย",
    body: "การท่องจำเพลงของนักแสดงดนตรีอาศัยหลายช่องทางชัดเจน: visual (ภาพโน้ต/ภาพมือบนคีย์), auditory (ได้ยินในหัว), kinesthetic (จำการเคลื่อนไหวมือ) การพึ่ง kinesthetic อย่างเดียว (เล่นจนมือจำเอง) เปราะที่สุด — พอเวทีกดดัน มือสั่นแล้วช่องเดียวพังทันที การจำที่แข็งคือ 'รู้ว่าเพลงนี้หูฟังแล้วไปไหน ตาเห็นตำแหน่ง และมือจำรูป' พร้อมกัน",
    teach: "ทดสอบทีละช่อง: เล่นโดยนึกภาพโน้ต (ไม่ดูมือ) → หูร้องทำนองนำมือ → เปลี่ยนตำแหน่งนั่งเล็กน้อยแล้วเล่น (กันพึ่งตำแหน่งมือเปล่า ๆ)",
    confidence: 0.8, source: src("music-memory-wiki"),
  });
  kb.add({
    id: "tcraft:rote-foundations-ok", type: "principle", domain: "memorization",
    title: "ท่องจำซ้ำ ๆ ใช้ได้กับ 'พื้นฐาน' แต่ต้องเติมความเข้าใจจึงจะต่อยอด",
    body: "การท่องจำด้วยการทำซ้ำ (rote) เป็นเครื่องมือจริงสำหรับความรู้ฐาน: ชื่อโน้ต ตำแหน่งคีย์ รูปคอร์ด สูตรบันได — เหมือนที่ใช้ท่องสูตรคูณ แต่ด้วยตัวมันเองไม่สร้างความเข้าใจลึก: ผู้เรียนที่ท่อง 'C-E-G คือ C' โดยไม่เคยฟัง/แยกเสียง จะต่อยอดไป inversion ไม่ได้ หลักการ: rote สำหรับฐานที่ต้องเร็ว, ความเข้าใจสำหรับทุกอย่างที่ต้องยืดหยุ่น",
    teach: "ใช้ rote เร่งตัวพยัญชนะ (ชื่อโน้ต/รูปคอร์ด) แต่ทุกครั้งให้ผู้เรียน 'ใช้มันกับเสียงจริง' อย่างน้อยหนึ่งอย่าง — ท่องแล้วเล่น เล่นแล้วฟัง",
    confidence: 0.8, source: src("rote-learning-wiki"),
  });

  /* ── Ear training ladder ── */
  kb.add({
    id: "tcraft:ear-ladder", type: "strategy", domain: "ear-training",
    title: "ฝึกหูไล่บันได: จังหวะ → ทำนองเทียบ → คู่เสียง → คุณภาพคอร์ด",
    body: "การฝึกหู (ear training) เป็นวิชาหลักของสถาบันดนตรี — เรียงจากง่ายไปยากได้เป็นบันได: (1) จังหวะ: ฟังแล้วตีกลับได้ (2) ทำนองเทียบ: ฟังทำนองสั้นแล้วเล่นกลับ (3) คู่เสียง: แยกว่าสูงขึ้นกี่ระยะ (4) คุณภาพคอร์ด: แยก major/minor ฟัง ๆ ข้ามขั้นคือสาเหตุที่ผู้เรียน 'ฟังไม่ออกแล้วถอย' — ต้องชนะขั้นล่างก่อนจึงมีฐานให้ขั้นบน",
    teach: "แอปมีเกมฝึกหูอยู่แล้ว — เลือกระดับให้ 'ชนะ 8 ใน 10' ก่อนขยับขึ้น ไม่ใช่กระโดดไประดับที่โหดแต่แพ้ทุกครั้ง",
    confidence: 0.75, source: src("ear-training-wiki"),
  });

  /* ── Practice plans by age/time ── */
  kb.add({
    id: "tcraft:session-by-age", type: "expert-opinion", domain: "practice-planning",
    title: "ยาวซ้อมตามวัย: 4-6 ขวบ ~10-15 นาที · 7-11 ~20-30 · วัยรุ่น+ 30-45 · ผู้ใหญ่เริ่มใหม่ 15-20 แต่ทุกวัน",
    body: "ความยาวการซ้อมที่ 'ควร' ผูกกับสมาธิ ไม่ใช่กับความเก่ง: เด็ก 4-6 ขวบสมาธิจับงานเดียว ~10-15 นาที (แบ่งเป็นหลายช่วงสั้นดีกว่ายาว) เด็ก 7-11 ~20-30 นาที วัยรุ่นขึ้นไป 30-45 นาที ผู้ใหญ่ที่เริ่มใหม่และมีเวลาน้อย 15-20 นาทีทุกวันชนะ 2 ชั่วโมงสัปดาห์ละครั้งเพราะ spaced repetition ทำงานกับความถี่ ไม่ใช่ระยะยาว",
    teach: "ถ้าผู้เรียนบอก 'เบื่อ/เหนื่อย' ก่อนครบเวลา = เซสชันยาวเกินวัย — ตัดให้สั้นลงแต่ให้ครบวง (ทบทวน→ซ้อมใหม่→เล่นเพลงชอบ)",
    confidence: 0.7, source: src("practice-wiki"),
  });
  kb.add({
    id: "tcraft:session-shape", type: "strategy", domain: "practice-planning",
    title: "รูปเซสชันที่ได้ผล: ทบทวนเก่า 3 นาที → ซ้อมจุดติด 4 → เล่นเพลงชอบปิด 3",
    body: "โครงเซสชันสั้นที่เว็บเปียโนใช้กันจริง: (1) ทบทวนเพลง/ทักษะเก่าสั้น ๆ (spaced repetition ทำงานที่นี่) (2) ซ้อมสิ่งใหม่/จุดที่ติด แบบช้า-แบ่งท่อน (deliberate practice ที่นี่) (3) จบด้วยเล่นเพลงที่ชอบจริง ๆ (ปิดท้ายด้วยความสำเร็จ — แรงจูงใจมาจากที่นี่) สัดส่วนปรับตามเวลาที่มี แต่ห้ามตัดส่วนที่ 3 ทิ้งซ้ำ ๆ — นั่นคือทางตันสู่การเลิกเรียน",
    teach: "แอปมี practice-planner อยู่แล้ว — ตรวจว่าแผนที่สร้างให้มีสามส่วนนี้ ถ้าผู้เรียนพลาดสองวันติด ให้แผนถัดไป 'สั้นลงครึ่งหนึ่ง' ก่อน ไม่ใช่ตามปกติ",
    confidence: 0.75, source: src("practice-wiki"),
  });

  /* ── Stage fright ── */
  kb.add({
    id: "tcraft:stage-fright-normal", type: "fact", domain: "performance",
    title: "ใจสั่นก่อนขึ้นเล่นคือกลไกธรรมชาติของร่างกาย — ไม่ใช่ความอ่อนแอ",
    body: "อาการใจเต้นเร็ว มือสั่น ปากแห้ง ก่อน/ระหว่างขึ้นเล่นเกิดจาก adrenaline ที่ร่างกายปล่อยเข้ากระแสเลือด (สู้-หนี) เกิดได้กับทั้งมือใหม่และนักแสดงอาชีพ บางคนยิ่งเห็นหน้าคนรู้จักยิ่งตื่น วิธีที่งานวิจัยแนะนำคือการเตรียมซ้ำ ๆ + โอกาสเล่นต่อหน้าคนบ่อย ๆ จนร่างกายเรียนว่า 'สถานการณ์นี้ปลอดภัย' — ไม่ใช่การสั่งให้ตัวเอง 'อย่าตื่น'",
    teach: "บอกผู้เรียนว่า 'มือสั่น = ร่างกายปลุกพลังให้ ไม่ใช่บอกว่าเธอแย่' แล้วเริ่มจากเวทีเล็ก: เล่นให้ครู AI ฟัง → ครอบครัว → เพื่อน — แอปมีโหมดเล่นให้ฟังจบเพลงอยู่แล้ว ใช้มันเป็นเวทีซ้อม",
    confidence: 0.8, source: src("stage-fright-wiki"),
  });

  /* ── Motivation science: SDT + gamification done right ── */
  kb.add({
    id: "tcraft:sdt-three-needs", type: "fact", domain: "motivation",
    title: "แรงจูงใจภายในเติบโตด้วย 3 ความต้องการ: เลือกเอง · รู้สึกเก่งขึ้น · มีคนร่วมทาง",
    body: "Self-Determination Theory สรุปจากงานวิจัยทั่วโลก: แรงจูงใจภายใน (ทำเพราะอยากทำ) เติบโตเมื่อ (1) autonomy — มีทางเลือกจริง (เพลงไหน ทางไหน เร็วแค่ไหน) (2) competence — เห็นตัวเองดีขึ้นจริงและรู้สึกได้ (3) relatedness — รู้สึกมีคนเดินด้วย ข้อควรระวัง: รางวัลภายนอกที่ใช้ผิด (คุมทุกก้าว/แข่งเป็นตัวเดียว) สามารถ 'กัดกิน' แรงจูงใจภายในที่มีอยู่แล้วได้",
    teach: "ออกแบบบทสนทนาให้มี 'ทางเลือก' เสมอ ('วันนี้อยากฝึกคอร์ดต่อ หรือเปลี่ยนเพลง?') และชมแบบมีหลักฐานจากความก้าวหน้าจริง (competence) ไม่ใช่ชมลอย ๆ",
    confidence: 0.8, source: src("sdt-wiki"),
  });
  kb.add({
    id: "tcraft:gamification-feedback-first", type: "principle", domain: "motivation",
    title: "แต้ม/เหรียญ/ป้าย = ตัวสะท้อนความก้าวหน้า — ถ้ามันแทนที่ 'การรู้สึกเก่งขึ้นจริง' มันจะกลายเป็นยาเสพติด",
    body: "งานสรุป gamification: แต้มให้ feedback ต่อเนื่องทันทีและวัดความก้าวหน้าได้, ป้าย/badge คือตัวแทนความสำเร็จที่มองเห็น, เกมดึงคนด้วยความอยากเก่ง (mastery) ไม่ใช่แค่รางวัล — ระบบที่ดีทำให้ผู้เรียน 'เห็นว่าตัวเองดีขึ้น' ผ่านแต้ม ระบบที่พังคือแต้มมาง่ายจนไม่สะท้อนความจริง หรือดุลภัยทำให้ผู้เรียนซ้อมเพื่อแต้มแทนที่จะซ้อมเพื่อเสียง",
    teach: "กฎของครู AI: ชมควรอ้างสิ่งที่ดีขึ้นจริง ('วันนี้จังหวะนิ่งกว่าเมื่อวาน') แล้วค่อยพูดถึงแต้ม/EXP — ห้ามใช้รางวัลเป็นคำชมหลัก",
    confidence: 0.7, source: src("gamification-wiki"),
  });

  /* ── Thai music for a Thai-market app ── */
  kb.add({
    id: "tcraft:thai-music-context", type: "fact", domain: "culture",
    title: "ดนตรีไทยมีเครื่องจากหลายแหล่ง (ขิม-เปอร์เซีย, จะเข้-อินเดีย, กลองจีน-จีน) — ลำดับ 'รับมาปรับ' ยาวนาน",
    body: "ดนตรีไทยรับเครื่องดนตรีและแนวคิดจากหลายวัฒนธรรมแล้วปรับเป็นของตัวเอง: ขิมมีต้นทางเปอร์เซีย, จะเข้มีต้นทางอินเดีย, กลองจีน (klong chin) มาจากจีน สองแนวที่นิยมที่สุดในดนตรีไทยดั้งเดิมคือลูกทุ่งและหมอลำ (หมอลำใกล้ชิดดนตรีลาว) ไทยไม่เคยตกเป็นอาณานิคม ดนตรีไทยจึงพัฒนาต่อเนื่องไม่ถูกตัด — สำหรับครูเปียโนในไทย: ผู้เรียนที่คุ้นเสียงเพลงไทย/ลูกทุ่งจะมีหูจังหวะที่ต่างจากตะวันตก และนั่นเป็นทรัพย์ไม่ใช่อุปสรรค",
    teach: "เมื่อผู้เรียนถามถึงเพลงไทย ให้ยกหลักทฤษฎีที่แชร์กันได้จริง (ระยะเสียง/จังหวะ/รูปคอร์ด) โดยไม่บังคับให้เพลงไทยต้อง 'เข้ากรอบตะวันตก' ทั้งหมด",
    confidence: 0.8, source: src("thai-music-wiki"),
  });

  /* ── Note-value vocabulary (British/American) ── */
  kb.add({
    id: "tcraft:note-value-names", type: "fact", domain: "rhythm",
    title: "ค่าโน้ตแบ่งครึ่งลงไป: whole→half→quarter→eighth — ชื่ออังกฤษ 2 ระบบ",
    body: "ค่าของโน้ตเรียงความยาวแบบหารสองลงไป: whole (semibreve) → half (minim) → quarter (crotchet) → eighth (quaver) → sixteenth (semiquaver) — ชื่ออเมริกัน (whole/half/quarter) บอกอัตราส่วนชัด ชื่ออังกฤษเดิม (semibreve/minim/crotchet) ยังพบในหนังสือเกรดเก่าและสำนักพิมพ์อังกฤษ ผู้เรียนที่เปิดหนังสือสองแบบจะเจอชื่อไม่ตรงกัน — ไม่ใช่โน้ตต่างกัน",
    teach: "สอนชื่ออเมริกันเป็นหลัก (บอกสัดส่วนในตัว) แต่ให้รู้จักชื่ออังกฤษคู่กันเมื่อผู้เรียนเจอหนังสือเกรด ABRSM/Trinity ฉบับเก่า",
    confidence: 0.8, source: src("musical-note-wiki"),
  });

  /* ── GROUP 3: the four deep-theory topics (were prompt-only) ── */
  kb.add({
    id: "tcraft:modes-seven", type: "fact", domain: "theory",
    title: "7 modes = เปลี่ยน 'ตัวตนของเสียง' ด้วยโน้ตชุดเดิม",
    body: "โน้ตชุดเดียว (เช่น ปุ่มขาวทั้งชุด) สร้างบันไดได้ 7 แบบตามว่า 'โน้ตแรก' อยู่ไหน: Ionian (เริ่ม C = บันไดใหญ่ปกติ), Dorian (D — minor ที่โทนที่ 6 สูง), Phrygian (E — minor ที่โทนที่ 2 ต่ำ, กลิ่นสเปน/ตะวันออก), Lydian (F — major ที่โทนที่ 4 สูง, ลอยฟ้า), Mixolydian (G — major ที่โทนที่ 7 ต่ำ, กลิ่น blues/rock), Aeolian (A = natural minor), Locrian (B — ไม่เสถียร พบน้อย) — jazz/rock/เพลงประกอบเรียกใช้ด้วยชื่อตรง ๆ",
    teach: "ฝึกทีเดียวหนึ่ง mode: เล่น D Dorian (ปุ่มขาว C→C แต่เริ่ม D) แล้วฟัง 'อารมณ์ minor แต่สว่างกว่า' — อย่าสอนทั้ง 7 พร้อมกัน",
    confidence: 0.8, source: src("mode-wiki"),
  });
  kb.add({
    id: "tcraft:inversions-bass", type: "fact", domain: "harmony",
    title: "inversion = โน้ตไหนอยู่ล่างสุด (ไม่ใช่การเรียงใหม่แบบใดก็ได้)",
    body: "คอร์ดเดิมโน้ตเดิม แต่ 'เสียงต่ำสุด' เปลี่ยน = คนละ inversion: รากล่าง = root position, เสียงที่ 3 ล่าง = 1st inversion (C/E), เสียงที่ 5 ล่าง = 2nd inversion (C/G) — เสียงเดิมทุกตัว แต่ความมั่นคงของเสียงต่าง: root position นิ่งสุด, 2nd inversion ลอยที่สุดมักใช้ผ่าน จุดพลาดของผู้เรียน: เรียงโน้ตใหม่ด้านบนแล้วคิดว่าเปลี่ยน inversion — ผลตัดสินที่ 'โน้ตล่างสุด' เท่านั้น",
    teach: "ฝึกสามรูปของ C: C-E-G → E-G-C → G-C-E ตั้งชื่อพร้อมกันทุกครั้ง แล้วฟังว่า 'นิ่ง-กลาง-ลอย' ต่างกันยังไง",
    confidence: 0.8, source: src("inversion-wiki"),
  });
  kb.add({
    id: "tcraft:voice-leading-smooth", type: "principle", domain: "harmony",
    title: "voice leading = เดินแต่ละเสียงน้อยที่สุด — คอร์ดต่อกันจึงลื่น",
    body: "หัวใจของการเชื่อมคอร์ดให้ไหล: เสียงแต่ละเสียง (แต่ละ 'เสียงร้อง' ในคอร์ด) เดินระยะสั้นที่สุดไปคอร์ดถัดไป โน้ตที่ซ้ำกันอยู่กับที่ — นี่คือหลัก voice leading ของดนตรีคลาสสิก (ระบบ common-practice มีกฎเคร่ง เช่น ห้ามเดิน parallel 5th/8ve) และเป็นเหตุผลที่นักเปียโน pop/jazz เลือก inversion ให้มือขวา 'เดินน้อย' ระหว่างคอร์ด ไม่ใช่กระโดดทั้งมือ",
    teach: "ฝึก C→F สองแบบ: (1) ทั้งมือกระโดด (2) ขยับเฉพาะที่ต้องขยับ — ให้หูเลือกว่าแบบไหน 'ลื่น' แล้วใช้แบบลื่นเป็นค่าเริ่มต้น",
    confidence: 0.8, source: src("voice-leading-wiki"),
  });
  kb.add({
    id: "tcraft:modulation-pivot", type: "fact", domain: "harmony",
    title: "เปลี่ยนคีย์กลางเพลงด้วย pivot chord — คอร์ดที่ 'อยู่ได้ทั้งสองคีย์'",
    body: "modulation = เปลี่ยนคีย์กลางเพลง ทางที่สอนได้ง่ายคือ pivot chord: คอร์ดที่มีความหมายใน 'ทั้งสองคีย์' (เช่น C major คือคอร์ด VI ของ E minor) — วางคอร์ดนั้นไว้เป็นสะพาน แล้วความหมายของมันเปลี่ยนไปกับคีย์ใหม่ คีย์ปลายทางที่พบบ่อยคือคีย์ 'ใกล้เครียตัว': dominant (ขึ้น 5) หรือ relative minor — โดยตรงต่อวงกลม fifths ที่โมเดลรู้อยู่แล้ว",
    teach: "ฝึกทางสั้น: C → Am → (มอง Am ใหม่เป็น i ของ A minor) → E7 → Am — ให้ฟังว่า Am เป็น 'ประตู' ระหว่างสองโลก",
    confidence: 0.75, source: src("modulation-wiki"),
  });

  return kb;
}
