/* ── tigamodel/knowledge/global-theory-seed.js ──
   Global music-THEORY knowledge (owner directive 2026-09-17: gather theory
   from around the world so the model is strong at theory AND at teaching).
   Every entry's `source` points at a page actually read on 2026-09-17 —
   facts are paraphrased pedagogy, never copied text (see university-sources.js
   for the provenance rules). Typed per knowledge-base.js so reasoning engines
   can separate established fact from teaching choice. Entries carry
   `teach` (how to teach it to a beginner) alongside `body` (the fact) —
   knowledge in this KB must be TEACHABLE, not just true. ── */

import { SOURCES } from "./university-sources.js";

export function seedGlobalTheory(kb) {
  const src = (id) => {
    if (!SOURCES[id]) throw new Error(`unknown source id: ${id} — no fake citations`);
    return id;
  };

  /* ── What music theory IS (frame the subject honestly) ── */
  kb.add({
    id: "theory:what-it-is", type: "fact", domain: "theory",
    title: "ทฤษฎีดนตรีมี 3 ชั้น: พื้นฐานอ่านโน้ต · หลักการ · วิชาการ",
    body: "ศัพท์ 'ทฤษฎีดนตรี' ใช้ 3 ความหมายที่เกี่ยวเนื่องกัน: (1) พื้นฐานที่ต้องมีเพื่ออ่านโน้ตได้ — กุญแจเพลง คีย์ จังหวะ สัญลักษณ์ความยาวเสียง (2) การศึกษามุมมองของนักทฤษฎีตั้งแต่โบราณถึงปัจจุบัน (3) การหาหลักการทั่วไปว่าดนตรีทำงานอย่างไร ผู้เริ่มต้นต้องได้ชั้น (1) ก่อนเสมอ และห้ามสอนชั้น (2)(3) แทนชั้น (1)",
    teach: "บอกผู้เรียนตรง ๆ ว่าวันนี้เราเรียน 'ตัวอักษร' ของดนตรี (อ่านโน้ต/จังหวะ) ไม่ใช่ 'วรรณคดี' (วิเคราะห์) — ลำดับผิดไม่ได้",
    confidence: 0.85, source: src("theory-overview-wiki"),
  });
  kb.add({
    id: "theory:universal", type: "fact", domain: "theory",
    title: "ทุกวัฒนธรรมมีทฤษฎีดนตรีของตัวเอง",
    body: "หลักฐานจารึกสุเมเรียน/อัคคาเดียน (ก่อน 1500 ปีก่อน ค.ศ.) แสดงรายชื่อระยะเสียงและระบบตั้งเสียง ซึ่งเก่ากว่าหลักฐานวัฒนธรรมอื่นที่เทียบได้ราวพันปี ทฤษฎีจีนตั้งต้นจากตัวเลข 12-5-8 (12 เสียง เพนทาโทนิก 5 เสียง หมวดหมู่เสียง 8) ระบบอินเดียมีราคา ระบบอาหรับมีมักอัม — ตะวันตกเป็นเพียงหนึ่งในหลายระบบ สอนแบบตะวันตกได้แต่ต้องไม่พูดว่าเป็น 'กฎสากลของดนตรีทั้งหมด'",
    teach: "เมื่อผู้เรียนไทยถามถึงเพลงไทย/เพลงเอเชีย ให้ชี้ว่าระบบเสียงต่างกันโดยตั้งใจ ไม่ใช่ผิด",
    confidence: 0.8, source: src("theory-overview-wiki"),
  });

  /* ── Harmony: the core of Western teaching ── */
  kb.add({
    id: "theory:harmony-two-dimensions", type: "fact", domain: "harmony",
    title: "harmony = เสียงซ้อนกัน (แนวตั้ง) ไหลไปเรื่อง (แนวนอน)",
    body: "harmony คือการรวมเสียงต่างความสูงเข้าด้วยกันเพื่อสร้างความคิดทางดนตรีใหม่ มี 2 มิติพร้อมกัน: แนวตั้ง = โน้ตหลายเสียงดังพร้อมกันเป็นคอร์ด แนวนอน = คอร์ดต่อเนื่องกันไปตามเวลาเป็น progression การสอนที่ดีต้องให้ผู้เรียนเห็นสองมิตินี้พร้อมกัน — จับคอร์ด (แนวตั้ง) ขณะมันเปลี่ยนไปตามเพลง (แนวนอน)",
    teach: "ฝึกคอร์ดเดียวก่อน แล้วสลับ 2 คอร์ดตามเพลงจริง — จบในตัวเดียวไม่ได้ยินความหมาย",
    confidence: 0.85, source: src("harmony-wiki"),
  });
  kb.add({
    id: "theory:consonance-dissonance", type: "fact", domain: "harmony",
    title: "ดิสโซแนนซ์ไม่ใช่เสียงผิด — มันคือแรงดึงที่ต้องคลาย",
    body: "คอนโซแนนซ์ (เสียงนิ่ง สบายหู) กับดิสโซแนนซ์ (เสียงตึง) เป็นเครื่องมือหลักของ harmony ในดนตรีคลาสสิก คอร์ดที่มีดิสโซแนนซ์จะ 'คลาย' (resolve) ไปสู่คอร์ดที่คอนโซแนนซ์ — ดนตรีที่ดีจัดสมดุลช่วงตึง/คลายเหมือนหายใจ ผู้เริ่มต้นมักคิดว่าเสียงตึง = เล่นผิด ครูต้องแยกให้ออก: 'ผิด' คือเล่นไม่ตรงโน้ต ส่วน 'ตึง' คือดีไซน์ของผู้แต่ง",
    teach: "ให้เล่น C ค้างแล้วแทรก B♭ ทีละจังหวะ ถามว่า 'อยากให้ไปไหนต่อ' — หูจะบอกเองว่าอยากคลายกลับ C",
    confidence: 0.8, source: src("harmony-wiki"),
  });
  kb.add({
    id: "theory:triad-first", type: "fact", domain: "harmony",
    title: "triad คือคอร์ดที่พบมากที่สุด — ราก สาม ห้า",
    body: "คอร์ดที่พบบ่อยที่สุดคือ triad (3 เสียง): ราก + ระยะที่ 3 + ระยะที่ 5 คอร์ดที่มีมากกว่า 3 เสียง (added-tone, extended, tone cluster) พบในดนตรีคลาสสิกร่วมสมัยและเจซซ์ arpeggio คือคอร์ดที่เล่นทีละเสียงแทนพร้อมกัน (broken chord) — ซึ่งเป็นรูปแบบฝึกมาตรฐานของเปียโนเพราะมือจำรูปทรงของคอร์ดได้จากการไล่เสียง",
    teach: "สอน triad แบบ block (จับพร้อมกัน) ก่อน แล้วเล่น broken/arpeggio เพื่อให้มือจำรูปคอร์ด",
    confidence: 0.85, source: src("chord-wiki"),
  });
  kb.add({
    id: "theory:dominant-seventh", type: "fact", domain: "harmony",
    title: "dominant 7th คือคอร์ดหลักของยุค common practice",
    body: "ในยุคบาโรก คอร์ดเจ็ดเสียงเริ่มทำหน้าที่เฉพาะเจาะจง โดย dominant seventh (1-3-5-b7) กลายเป็นคอร์ดหลักที่ผลักดันเสียงกลับสู่ tonic ยุคคลาสสิก-โรแมนติกต่อยอดจนเป็นหมุดหมายของดนตรี western ทั้งยุค นี่คือเหตุผลที่ทางคอร์ด V7→I พบทุกที่ — มันคือ 'แรงดึง' ที่แข็งแรงที่สุดของระบบ tonal",
    teach: "เล่น G7 ตามด้วย C ให้ฟังว่า 'ลอย → แลนด์' แล้วให้ผู้เรียนลองเอง — หูจะจำแรงดึงนี้ไปตลอด",
    confidence: 0.8, source: src("chord-wiki"),
  });
  kb.add({
    id: "theory:cadence-four-types", type: "fact", domain: "harmony",
    title: "cadence 4 แบบ: authentic · half · plagal · deceptive",
    body: "cadence = จุดจบวรรคเพลงที่ให้ความรู้สึกคลายหรือค้าง 4 แบบหลัก: authentic (V→I จบเต็ม) half (อะไร→V ค้างไว้) plagal (IV→I เหมือน 'อเมน') deceptive (V→vi หลอก — คาดจบแต่ไม่จบ) ชื่อต่างกันตามประเทศ: US ใช้ authentic/deceptive ส่วน UK ใช้ perfect/interrupted — ต้องรู้ทั้งสองชุดเพราะสื่อสอนทั่วโลกใช้ปนกัน cadence เป็นตัวชี้ tonic ที่ชัดที่สุดในเพลง",
    teach: "เป่าเพลงเด็กจบแบบ authentic แล้วลองจบแบบ half — ถามว่า 'จบแล้วหรือยังอยากฟังต่อ' ผู้เรียนจะเข้าใจคำว่าค้างทันที",
    confidence: 0.85, source: src("cadence-wiki"),
  });
  kb.add({
    id: "theory:function-bsd", type: "fact", domain: "harmony",
    title: "ฟังก์ชันคอร์ดมี 3 หน้าที่: Tonic · Subdominant · Dominant",
    body: "ทฤษฎี Riemann (1893) จัดคอร์ดเป็น 3 ฟังก์ชัน: T (พัก) S (ออกเดินทาง) D (ตึงกลับบ้าน) สามทริอัดหลัก F-C-G ผลิตโน้ตในสเกล C major ได้ครบ — นี่คือเหตุผลที่ I-IV-V เป็นแกนของเพลงเกือบทั้งหมดที่ผู้เรียนเจอ อีกสาย (Viennese: Sechter→Schoenberg→Schenker) ใช้เลขโรมันแทน ทั้งสองสายบอกสิ่งเดียวกัน: คอร์ดมีหน้าที่ ไม่ใช่แค่ชื่อ",
    teach: "เล่าเป็นเรื่อง 'บ้าน (I) - ออกเดิน (IV) - ตึงกลับ (V) - กลับบ้าน (I)' — ผู้เรียนจำฟังก์ชันได้ดีกว่าจำชื่อคอร์ด",
    confidence: 0.8, source: src("harmonic-function-wiki"),
  });
  kb.add({
    id: "theory:circle-of-fifths-map", type: "fact", domain: "theory",
    title: "วงกลม fifths คือแผนที่ความใกล้ของคีย์",
    body: "วาง 12 เสียงเป็นวงกลมไล่ควินต์ขึ้น (C→G→D→A→E→B→F#…) คีย์ที่อยู่ติดกันคือคีย์ที่ใกล้กันที่สุด (เพิ่ม/ลด sharp-flat ทีละตัว) จึงเปลี่ยนคีย์ไปหากันได้ลื่นที่สุด harmonic progression ในดนตรีตะวันตกมักวิ่งตามเส้นรอบวงนี้ และที่ก้นวงกลมคือโซนที่สะกดได้ทั้ง sharp และ flat (enharmonic) วงกลมยังอธิบายว่าทำไม 12 ควินต์แท้รวมกันแล้วไม่กลับมาเจอเสียงเดิมพอดี (Pythagorean comma) จึงต้องมี equal temperament",
    teach: "ใช้แผ่นวงกลมกระดาษให้หมุนหา 'เพื่อนบ้าน' ของคีย์ที่กำลังเรียน — เห็นภาพก่อนท่องจำ key signature",
    confidence: 0.8, source: src("circle-of-fifths-wiki"),
  });

  /* ── Rhythm & metre ── */
  kb.add({
    id: "theory:beat-metre-rhythm", type: "fact", domain: "rhythm",
    title: "แยกให้ออก: pulse · metre · rhythm เป็นคนละชั้นกัน",
    body: "pulse = เสียงเต้นสม่ำเสมอที่เราเดินตาม metre = กรอบการเน้นทับเสียง pulse เป็นกลุ่ม (2/4/6/8) rhythm = วิธีจัดเสียงเบารอบเสียงดังภายในกรอบนั้น จุดสำคัญ: metre เกิดขึ้นได้ต่อเมื่อบาง pulse ถูกเน้น (เราได้ยิน tick-tock แม้นาฬิกาดังเท่ากันทุกจังหวะ) และผู้ฟังจะรักษากรอบ metre ต่อไปแม้ข้อมูลน้อยนิด — จังหวะที่เล่นแล้วผู้ฟัง 'หลง' มักแก้ที่ metre ไม่ใช่ที่ความเร็ว",
    teach: "ฝึก 3 ชั้น: เดินตาม metronome (pulse) → ตบจังหวะเน้น (metre) → อ่านโน้ตในกรอบนั้น (rhythm) — ห้ามข้ามขั้น",
    confidence: 0.8, source: src("metre-wiki"),
  });
  kb.add({
    id: "theory:rhythm-vs-pulse", type: "fact", domain: "rhythm",
    title: "rhythm คือการจับกลุ่มเสียงเบารอบเสียงดัง",
    body: "นิยามที่ใช้ได้จริง: rhythm คือการจัดกลุ่มของ beat ที่ไม่ถูกเน้นรอบ beat ที่ถูกเน้น — เห็นได้จากทุกวัฒนธรรม (ทาลาของอินเดีย ระบบแอฟริกัน-อาหรับ) เพราะหูมนุษย์จับ 'เสียงดัง-เบา' ได้ดีกว่า 'ยาว-สั้น' ลอย ๆ การสอนจังหวะที่เริ่มจากความยาวโน้ต (ตัวเต็ม ครึ่ง โด) ก่อนความรู้สึกเน้น คือการสอนย้อนลำดับที่หูทำงาน",
    teach: "ให้ตบแบบหนัก-เบา-เบา ก่อนพูดถึงตัวเลข 3/4 เลย — ความรู้สึกนำ สัญลักษณ์ตาม",
    confidence: 0.75, source: src("rhythm-wiki"),
  });

  /* ── Ear training tools ── */
  kb.add({
    id: "theory:solfege-two-systems", type: "fact", domain: "sight-reading",
    title: "solfège มี 2 ระบบ: fixed do · movable do — เลือกให้ตรงเป้า",
    body: "solfège (do-re-mi) มาจากคำเริ่มบรรทัดเพลงสรรเสริญนักบุญยอห์นของ Guido แห่ง Arezzo (ศตวรรษที่ 11) มี 2 ระบบ: fixed do = 'do' คือเสียง C เสมอ (ฝรั่งเศส สเปน อิตาลี ใช้สอนอ่านโน้ต) movable do = 'do' คือระดับที่ 1 ของคีย์ที่กำลังเล่น (สหรัฐ/UK ใช้สอนฟังหา tonic) เครื่องมือเดียวกันแต่เป้าต่างกัน: อ่านตรง vs ฟังรู้เรื่อง เลือกผิดระบบจะทำให้ผู้เรียนสับสนว่าทำไมเพลง C กับ G ใช้ do-re-mi เหมือนกัน",
    teach: "ถ้าเป้าคือ 'ฟังเพลงแล้วหาคีย์เจอ' ใช้ movable do; ถ้าเป้าคือ 'อ่านโน้ตหน้าปรากฏตรงเป๊ะ' ใช้ fixed do — ประกาศระบบที่ใช้ให้ชัดทุกครั้ง",
    confidence: 0.8, source: src("solfege-wiki"),
  });
  kb.add({
    id: "theory:eye-hand-span", type: "fact", domain: "sight-reading",
    title: "อ่านโน้ตเก่ง = มองไปข้างหน้าได้ไกล (eye-hand span)",
    body: "งานวิจัย eye-tracker พบว่านักอ่านโน้ตที่เก่งมองไปข้างหน้าในแผ่นโน้ตไกลกว่า แล้วเก็บโน้ตไว้ใน working memory ระหว่างรอเล่น (eye-hand span) ทักษะนี้จึงผูกกับความจำระยะสั้นทางดนตรีโดยตรง และการที่เล่นตามหน้าโน้ตแบบเครื่องจักรโดยไม่ 'ได้ยินในหัว' คือสัญญาณเตือนว่าเรียนผิดทาง — การได้ยินก่อนเล่น (audiation) คือรากของการอ่านที่ดี",
    teach: "ฝึก 'อ่านล่วงหน้า 1 จังหวะ': ตาต้องอยู่หน้ามือเสมอ เริ่มช้ามากแล้วค่อยเพิ่มความเร็ว",
    confidence: 0.75, source: src("sight-reading-wiki"),
  });
  kb.add({
    id: "theory:improv-history", type: "fact", domain: "improvisation",
    title: "ครูใหญ่ทั้งยุคล้วนแต่งสด — การแต่งสดคือรากไม้ของตะวันตก",
    body: "Bach, Handel, Mozart, Beethoven, Chopin, Liszt ล้นด้วยชื่อเสียงด้านการด้นสด: cadenza ในคอนแชร์โต prelude ที่ดอกไม้เสียงต่อจากคอร์ด figured bass ที่คีย์บอร์ดต้องเติมเอง การใส่ออร์นาเมนต์ — การแต่งสดเสียส่วนในศตวรรษที่ 20 เพราะการแสดงถูกแปลเป็นตัวโน้ต 100% การคืนการด้นสดเล็ก ๆ ให้ผู้เรียน (เล่นเพลงที่คุ้นแต่เปลี่ยนจบ) จึงเป็นการคืนทักษะดั้งเดิมของนักดนตรี ไม่ใช่ของแปลก",
    teach: "เริ่มง่ายสุด: เพลงที่เล่นได้แล้ว 1 เพลง ให้เปลี่ยนจังหวะหรือเติมโน้ตท้ายวรรค 1 จุด — 'แต่งได้' ต้องมาก่อน 'แต่งเก่ง'",
    confidence: 0.75, source: src("improvisation-wiki"),
  });
  kb.add({
    id: "theory:graded-ladder-global", type: "fact", domain: "assessment",
    title: "โลกใช้บันได 8 เกรดเป็นตัวชี้วัดร่วม (ABRSM/Trinity/RCM)",
    body: "สามระบบสอบใหญ่ของโลกทำงานรูปเดียวกัน: ABRSM (1889, 90+ ประเทศ, 600k คน/ปี) Trinity (1877, Initial-8 แล้วต่อ diploma) RCM Toronto (1886, เกรด 1-10 + ARCT) ทั้งหมดวัด 3 หมวดเหมือนกัน: เพลง + ทักษะพื้นฐาน (สเกล/คอร์ด) + ทดสอบเสริม (อ่านโน้ตเห็นแปลบ/ฟัง) บันได 8 เกรดจึงเป็นภาษากลางที่ผู้เรียนทั่วโลกเข้าใจตรงกัน และเป็นเหตุผลที่หลักสูตร TIGA จัดเป็นระยะตามเกรดได้",
    teach: "ให้ผู้เรียนรู้ว่าตัวเองอยู่ 'ช่วงไหน' ของบันได — ความก้าวหน้าต้องวัดเทียบบันไดนี้ ไม่ใช่เทียบคนอื่น",
    confidence: 0.8, source: src("abrsm-wiki"),
  });

  return kb;
}
