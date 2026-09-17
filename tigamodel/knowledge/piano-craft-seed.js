/* ── tigamodel/knowledge/piano-craft-seed.js ──
   GROUP 1 of the owner's gap audit (2026-09-17): topics the app TEACHES but
   the KB had zero support for — pedal, dynamics/expression, posture/hand
   position, extended/slash/pad chords, intervals, jazz piano. The AI teacher
   answered these from raw LLM general knowledge; now every answer can be
   anchored to a curated, sourced entry. Every `source` points at a page
   actually read on 2026-09-17 (see university-sources.js); content is
   paraphrased pedagogy, never copied text. ── */

import { SOURCES } from "./university-sources.js";

export function seedPianoCraft(kb) {
  const src = (id) => {
    if (!SOURCES[id]) throw new Error(`unknown source id: ${id} — no fake citations`);
    return id;
  };

  /* ── Pedal: the piano's own voice ── */
  kb.add({
    id: "craft:pedal-sustain-basics", type: "fact", domain: "pedal",
    title: "แป้นเหยียบขวา (sustain) = ยกเซ็นเซอร์ให้สายดังต่อ ไม่ใช่ปุ่มทำเสียงดัง",
    body: "เปียโนสมัยใหม่มี 3 แป้น: sustain (ขวา), una corda/soft (ซ้าย), sostenuto (กลาง — พบใช้จริงน้อย) แป้นขวายก dampers ออกจากสายทำให้เสียงดังต่อไปหลังปล่อยคีย์ — มันยืดเสียง ไม่ได้เพิ่มความดังของโน้ตที่กดอยู่ การเหยียบผิดจึงไม่ได้แค่ 'เสียงเละ' แต่ทำให้คอร์ดต่างเสียงมาทับกัน",
    teach: "สอนลำดับ: (1) เล่นทำนองไม่ใช้แป้นจนฟังสะอาด (2) ฝึก 'แป้นตามคอร์ด' — เหยียบทุกครั้งที่เปลี่ยนคอร์ด ปล่อย-กดใหม่พร้อมมือ (3) ค่อยลองเก็บเสียงคั่นระหว่างท่อนเดียวกัน",
    confidence: 0.85, source: src("piano-pedals-wiki"),
  });
  kb.add({
    id: "craft:pedal-legato-listen", type: "principle", domain: "pedal",
    title: "หูเป็นกรรมการของแป้น — ฟังจนเสียงเละ = ปล่อยช้าไป",
    body: "การเหยียบ sustain ให้ถูกต้องตัดสินจากหู ไม่ใช่จากเท้า: ถ้าเสียงของคอร์ดเก่าทับคอร์ดใหม่จนฟังไม่ชัด = ต้องปล่อยแป้นก่อนเปลี่ยน แบบฝึกที่ใช้ได้กับผู้เรียนทุกระดับคือเล่นคอร์ดเดียว เหยียบค้าง ฟังเสียงที่ค้างอยู่ แล้วปล่อยพร้อมมือ — จนเท้าจับจังหวะ 'ปล่อย-กด' ได้เอง",
    teach: "ให้ผู้เรียนถามตัวเองทุกคอร์ดว่า 'ฟังชัดไหม' ถ้าเละให้ลองปล่อยแป้นเร็วขึ้นครึ่งจังหวะ — แก้ที่เท้าไม่ใช่ที่มือ",
    confidence: 0.8, source: src("sustain-pedal-wiki"),
  });

  /* ── Dynamics: making it music ── */
  kb.add({
    id: "craft:dynamics-vocabulary", type: "fact", domain: "expression",
    title: "สัญลักษณ์ dynamics คือระดับ 'สัมพัทธ์' ไม่ใช่เดซิเบลตายตัว",
    body: "pp→ff (และ ppp/fff) บอกความดังแบบเปรียบเทียบ ไม่ใช่ค่าวัดแน่นอน; mp/mf อยู่ระหว่างกลาง; crescendo/diminuendo คือค่อย ๆ ดัง/เบาลง; sforzando คือเน้นโน้ตนั้น ๆ — เครื่องดนตรีเองก็ตั้งชื่อจากคุณสมบัตินี้ (piano = เบา, forte = ดัง) จุดสอนสำคัญ: p ของคนหนึ่งกับของอีกคนไม่เท่ากัน ที่สำคัญคือความต่าง 'ภายในการเล่นของตัวเอง'",
    teach: "ฝึกเดียวกัน 3 ระดับ: เล่นท่อนเดิม p → mf → f ให้ตัวเองฟังว่า 'ต่างกันชัดไหม' โดยรักษาจังหวะกับความชัดของโน้ตเท่าเดิม",
    confidence: 0.85, source: src("dynamics-wiki"),
  });
  kb.add({
    id: "craft:melody-above-accompaniment", type: "strategy", domain: "expression",
    title: "ทำนองต้องดังกว่าคอร์ดประกอบเสมอ — นี่คือทักษะ ไม่ใช่พรสวรรค์",
    body: "เวลาเล่นทำนองพร้อมคอร์ด (ขวานำ ซ้ายประกอบ) มือสองข้างต้องออกแรงไม่เท่ากัน: ทำนองชัดหน้า คอร์ดรองเบากว่า นี่คือหัวใจของ 'เล่นเป็นเพลง' ที่ผู้เริ่มต้นพลาดบ่อยที่สุดเพราะทั้งสองมือออกแรงเท่ากันหมด แบบฝึก: เล่นทำนอง mf ค้างไว้ แล้วเติมคอร์ดซ้ายเริ่มจาก pp — ค่อยเพิ่มคอร์ดจน 'แทบไม่ทับทำนอง'",
    teach: "บอกผู้เรียนตรง ๆ: มือซ้ายคือวง, มือขวาคือนักร้อง — วงต้องไม่ดังกว่านักร้อง",
    confidence: 0.8, source: src("dynamics-wiki"),
  });

  /* ── Posture/technique: what Camera Coach checks, in words ── */
  kb.add({
    id: "craft:posture-foundation", type: "fact", domain: "technique",
    title: "ท่านั่งมาก่อนเสียง: ศอกระดับหรือสูงกว่าคีย์เล็กน้อย ไหล่หลวม ข้อมือลอย",
    body: "ครูเปียโนเริ่มบทเรียนด้วยท่าทางเสมอ: นั่งหลังตรงครึ่งเก้าอี้ เอาตัวเข้าใกล้เปียโนพอให้ศอกอยู่ระดับคีย์ (หรือสูงกว่าเล็กน้อย) ไหล่ไม่ยก ข้อมือลอยเป็นเส้นตรงธรรมชาติไม่ยก/ไม่กด นิ้วโค้งรองบนคีย์ — ท่าที่ถูกคือท่าที่ใช้น้ำหนักแขนได้โดยไม่ตึงกล้ามเนื้อส่วนเกิน ถ้ากล้ามเนื้อไหล่-คอ-แขนตึงหลังซ้อม = ท่ามีปัญหา ไม่ใช่ซ้อมน้อยไป",
    teach: "เช็ค 3 จุดก่อนเล่นทุกครั้ง: ศอกไม่ต่ำกว่าคีย์ · ไหล่ไม่ยุ่นขึ้นหาหู · ข้อมือไม่พับลง — แอปมี Camera Coach ตรวจให้ แต่ผู้เรียนต้องรู้ 'ทำไม'",
    confidence: 0.7, source: src("music-lesson-wiki"),
  });
  kb.add({
    id: "craft:pain-is-motion", type: "principle", domain: "technique",
    title: "เจ็บ = เคลื่อนไหวผิด ห้ามฝืน — หยุด ช้าลงครึ่ง แก้ที่แขน",
    body: "ความเจ็บ/เมื่อยแปลก ๆ ระหว่างซ้อมเป็นสัญญาณของการเคลื่อนไหวที่ตึงเกินจำเป็น (ยืดนิ้วไปถึงคีย์แทนที่จะขยับแขน, กำแรงเกิน, ข้อมือพับ) หลัก Taubman: เสียงมาจากการประสานของแขน-ข้อมือ-นิ้ว ไม่ใช่แรงกำนิ้วล้วน เมื่อเจ็บ: หยุดทันที ลดความเร็วครึ่งหนึ่ง แก้ที่การเคลื่อนไหวของแขน ไม่ใช่ออกแรงนิ้วมากขึ้น — ฝืนซ้อมต่อคือสะสมการบาดเจ็บ",
    teach: "สอนผู้เรียนตรง ๆ ว่า 'เจ็บไม่ใช่เกมที่ต้องชนะ' — ลดระดับ ลดความเร็ว หรือพักวันนี้ แล้วค่อยกลับมา ครู AI ห้ามชมคนที่ซ้อมทั้งที่เจ็บ",
    confidence: 0.75, source: src("taubman-wiki"),
  });

  /* ── Chords the pathway teaches: tensions, slash, pad ── */
  kb.add({
    id: "craft:extended-chords", type: "fact", domain: "harmony",
    title: "คอร์ดต่อยอด 9/11/13 = ไล่สามชั้นต่อจาก 7 — สีสันของ jazz/R&B",
    body: "ต่อจากคอร์ด 7th ให้ไล่ third ต่อไป: 9th (ราก+ออกเทฟ), 11th, 13th — Cmaj9 = C E G B D คอร์ดกลุ่มนี้ให้ 'สีเสียง' ลุ่มลึกแบบ jazz/R&B/เพลงประกอบ เล่นจริงมักตัดโน้ตที่ไม่จำเป็น (รากมักให้เบส/มือซ้ายรับ) เพื่อไม่ให้เสียงถี่เกิน — ตรงกับบทเรียน 'คอร์ดสี' ใน pathway ของแอป",
    teach: "สอนจากที่รู้แล้ว: C7 → เติม D บน = C9 เล่นคู่กันให้ฟังว่า 'สีเปลี่ยน' แล้วลองแทนที่ในเพลงจริงที่มี C7",
    confidence: 0.8, source: src("extended-chord-wiki"),
  });
  kb.add({
    id: "craft:slash-chords", type: "fact", domain: "harmony",
    title: "Slash chord (C/E) = คอร์ดนี้แต่เบสเป็นโน้ตหลังเฉียง",
    body: "สัญลักษณ์ C/E อ่านว่า 'คอร์ด C เหนือเสียง E' — คอร์ด C major เล่นปกติ แต่โน้ตต่ำสุดคือ E (คือการเล่น inversion แบบระบุชัด) ใช้เมื่อ (1) ต้องการเบสเดินไล่ระยะสวย ๆ เช่น C → C/E → F (2) กำหนดตำแหน่งคอร์ดให้ตรงกัน จุดพลาดของผู้เรียน: กดคอร์ดถูกแต่เบสไม่ใช่โน้ตหลังเฉียง เสียงที่ได้จึงไม่ตรงเพลง",
    teach: "ฝึกเดินเบส 1-2-3: C → C/E → F ฟังว่าเบาลอยขึ้น แล้วเทียบกับ C → F แบบกระโดด — นี่คือเหตุผลที่นักแต่งเพลงใช้ slash",
    confidence: 0.8, source: src("slash-chord-wiki"),
  });
  kb.add({
    id: "craft:pad-voicing", type: "strategy", domain: "harmony",
    title: "Pad chord = คอร์ดตัวยาวเป็นพื้น — เลือกโน้ตให้เว้นช่วง ไม่อัดกัน",
    body: "การเล่นคอร์ดแบบ pad (ยืดเสียงยาวเป็นพื้นหลัง) ให้เลือก voicing เว้นระยะห่าง: รากต่ำ แล้วเว้นช่วงกว้างก่อนวางเสียงถัด ๆ ไป แทนที่จะกดโน้ตชิดกันต่ำ ๆ (ทำให้ขุ่น) — บทเรียน 'คอร์ด pad' ของ pathway คือทักษะนี้ ใช้ร่วมกับ sustain pedal ได้ แต่ต้องเปลี่ยนแป้นตามคอร์ด",
    teach: "เปรียบเทียบให้ฟัง: คอร์ดชิดต่ำ (ขุ่น) กับคอร์ดเว้นช่วง (โปร่ง) — แล้วให้ผู้เรียนเลือกเองว่าแบบไหนฟังดี",
    confidence: 0.7, source: src("extended-chord-wiki"),
  });

  /* ── Intervals: the app drills all 12 — KB now backs it ── */
  kb.add({
    id: "craft:interval-naming", type: "fact", domain: "theory",
    title: "คู่เสียงมี 2 คำตอบรวมกัน: ลำดับที่ + คุณภาพ (major 3rd = C→E)",
    body: "คู่เสียง (interval) คือระยะห่างระหว่างเสียงสองเสียง อ่านสองชั้น: 'ลำดับที่' นับจากตัวอักษร (C→E = 3rd เพราะนับ C,D,E) แล้ว 'คุณภาพ' จากระยะเซมิโทน (major 3rd = 4 เซมิโทน, minor 3rd = 3) — harmonic คือเสียงพร้อมกัน melodic คือเสียงไล่กัน จุดพลาดคลาสสิก: นับเซมิโทนอย่างเดียวแล้วเรียกผิดชื่อ (F#→G# คือ major 2nd เพราะตัวอักษรติดกัน แม้ระยะเท่า C→D)",
    teach: "สอนสองคำถามติดกันเสมอ: 'ตัวอักษรห่างกันกี่ตัว?' ก่อน แล้ว 'ระยะจริงกี่เซมิโทน?' — ตอบสองอย่างแล้วจึงตั้งชื่อ",
    confidence: 0.85, source: src("interval-wiki"),
  });
  kb.add({
    id: "craft:interval-by-song", type: "strategy", domain: "ear-training",
    title: "จำคู่เสียงด้วยเพลงคู่กัน — หูจับรูปเสียง ไม่ใช่นับเซมิโทน",
    body: "วิธีฝึกหูรู้จักคู่เสียงที่ใช้ทั่วโลก: ผูกคู่เสียงกับเพลงที่เปิดด้วยคู่เสียงนั้น (เช่น interval เสียงเดียวกันกับช่วงเปิดเพลงที่ผู้เรียนคุ้น) — แอป TIGA มีเกมฝึกหูพร้อมเพลงอ้างอิงตามรูปแบบนี้ หลักการ: หูจำ 'รูปเสียง' ได้ดีกว่าการคำนวณ การนับเซมิโทนคือการตรวจสอบ ไม่ใช่วิธีฟัง",
    teach: "ฝึกลำดับ: (1) ฟังคู่เสียงจากเพลงที่คุ้น (2) เล่นมันบนคีย์ (3) เทียบกับโจทย์สุ่ม — ค่อยเลิกพึ่งเพลงอ้างอิงเมื่อหูจำได้เอง",
    confidence: 0.75, source: src("ear-training-wiki"),
  });

  /* ── Jazz: the app has Jazz Swing/Waltz songs — KB now backs it ── */
  kb.add({
    id: "craft:jazz-comping", type: "strategy", domain: "jazz",
    title: "Comping = เล่นคอร์ดเป็นจังหวะ 'ตอบโต้' ไม่ใช่ประกอบตายตัว",
    body: "ใน jazz เปียโนทำหน้าที่ comp (accompany) — วางคอร์ด voicing เป็นจังหวะสั้น ๆ ตอบโต้ทำนอง/กลอง ไม่ได้เล่นคอร์ดต่อเนื่องแบบ pop ทักษะหลัก: (1) voicing ที่โปร่ง (รากมักตัดทิ้งให้เบสรับ) (2) จังหวะวางเป็น syncopation ไม่ตรง beat หมด (3) ฟังคนอื่นในวงแล้วเว้นที่ให้ ผู้เรียนจาก classical ต้องปรับสองอย่าง: อ่านคอร์ดสัญลักษณ์แทนโน้ต และ 'เว้น' ให้เสียงอื่นมีที่",
    teach: "ฝึกแรก: รับเพลง 12-bar blues เล่นแค่ราก-5 มือซ้ายตามคอร์ด ให้ฟังรู้สึกวงกว้างก่อน แล้วค่อยเติม voicing",
    confidence: 0.75, source: src("jazz-piano-wiki"),
  });
  kb.add({
    id: "craft:twelve-bar-blues", type: "fact", domain: "jazz",
    title: "12-bar blues = กรอบ I-IV-V 12 ห้อง — รากฐานของ jazz/rock 'n' roll",
    body: "โครงสร้าง 12 ห้อง: 4 ห้อง I → 2 ห้อง IV → 2 ห้อง I → 1 ห้อง V → (1 ห้อง IV) → 2 ห้องกลับ I — เพลง jazz/R&B/rock ส่วนใหญ่ยืนบนกรอบนี้หรือดัดแปลงจากมัน blue notes (เสียงที่ต่ำกว่า major 3rd/5th/7th เล็กน้อยหรือ b3/b7) คือสีเสียงเฉพาะ แอปมีเพลง Jazz Swing/Jazz Waltz — ฝึก 12-bar เป็นฐานแล้วเข้าเพลงเหล่านั้นจะง่ายขึ้น",
    teach: "สอนเป็นเกมฟังรูป: ให้ผู้เรียนยกมือตอนที่เพลง 'เปลี่ยนห้อง' — จับรูป I-I-I-I ได้ก่อน แล้วค่อยเล่นตาม",
    confidence: 0.8, source: src("twelve-bar-blues-wiki"),
  });

  return kb;
}
