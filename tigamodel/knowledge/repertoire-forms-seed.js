/* ── tigamodel/knowledge/repertoire-forms-seed.js ──
   Gap-report items #1, #4, #5 (owner directive 2026-09-17: "the teacher
   doesn't know the SONGS"). The app ships 192 songs; the KB had zero
   repertoire knowledge. This seed adds:
     #1 eras + what each era asks of a piano student (Baroque/Classical/
        Romantic outlines with their sound-world and technique demands)
     #4 the small set of FORMS students actually meet (ternary ABA,
        theme & variations, sonatina/sonata-allegro, rondo)
     #5 left-hand/accompaniment PATTERNS (Alberti, ostinato/riff,
        broken-chord ballad, block-chord) — what pop/jazz/classical songs
        put under the right hand
   Every `source` points at a page actually read on 2026-09-17 (see
   university-sources.js); paraphrased pedagogy, never copied text. ── */

import { SOURCES } from "./university-sources.js";

export function seedRepertoireForms(kb) {
  const src = (id) => {
    if (!SOURCES[id]) throw new Error(`unknown source id: ${id} — no fake citations`);
    return id;
  };

  /* ── #1 Eras: what the student hears + what it asks of the hands ── */
  kb.add({
    id: "rep:era-baroque", type: "fact", domain: "repertoire",
    title: "Baroque (1600-1750): เส้นเสียงหลายเส้นเดินพร้อมกัน — เล่น 'ร้อง' แต่ละเส้น ไม่ใช่ทำนองเดียว",
    body: "Baroque คือยุค 1600-1750 (Bach, Handel, Corelli) เสียงเด่นคือ polyphony — เส้นเมโลดี้หลายเส้นเป็นอิสระและดำเนินพร้อมกัน ยุคนี้ยังเป็นช่วงที่ tonality (ระบบคีย์) ถูกวางราก และเกิด figured bass, โอเปรา, คอนแชร์โต, โซนาตา สำหรับผู้เล่นเปียโน: เพลงยุคนี้ (เช่น Minuet, Invention) ต้องฟังเส้นเสียงแยกกัน — นิ้วแต่ละตัว 'ร้อง' เส้นของตัวเอง ไม่ใช่เน้นทำนองบนอย่างเดียว",
    teach: "ฝึกแยกเสียง: เล่นเฉพาะเส้นบน → เฉพาะเส้นล่าง → รวมโดยเน้นเสียงละครั้งสลับกัน จนหูแยกได้ว่าแต่ละเส้นกำลังไปไหน",
    confidence: 0.85, source: src("baroque-music-wiki"),
  });
  kb.add({
    id: "rep:era-classical", type: "fact", domain: "repertoire",
    title: "Classical (1750-1820): ทำนองชัดบนคอร์ดประกอบ — เปียโนกลายเป็นเครื่องที่ 'ดัง-เบาได้'",
    body: "ยุคคลาสสิก (Mozart, Haydn, ต้น Beethoven) เด่นด้วย homophony: เส้นทำนองชัดเจนบนคอร์ดประกอบที่ยอมเป็นรอง วาไรตี้และคอนทราสต์ในเพลงเพิ่มชัดกว่า Baroque และเป็นยุคที่เปียโน (fortepiano — 'ดังเบา') แทนที่ harpsichord ซึ่งกดเบาดังเท่าเดิมเสมอ — เพลงยุคนี้จึงเป็นสนามหลักของ dynamics และแบบแผนมือซ้ายอย่าง Alberti bass",
    teach: "สอนคู่กับ dynamics: ยุคนี้คือที่ที่ 'mf ทำนอง, pp คอร์ด' เริ่มมีความหมายจริง — ใช้เพลง Sonatina ฝึกแยกน้ำหนักมือ",
    confidence: 0.85, source: src("classical-period-wiki"),
  });
  kb.add({
    id: "rep:era-romantic", type: "fact", domain: "repertoire",
    title: "Romantic (1800-1910): อารมณ์นำ — chromatic เพิ่ม เล่าเรื่อง/ภาพ ผ่านเสียง",
    body: "ยุคโรแมนติก (Chopin, Liszt, Schumann, ปลาย Beethoven) มองดนตรีเป็นการแสดงออกเชิงบุคคล: อารมณ์ จินตนิยา ภาพจากบทกวี/ธรรมชาติ chromaticism เพิ่มขึ้น และฟอร์มดั้งเดิมถูกยืดให้ตามเนื้อเรื่องของเพลง สำหรับผู้เล่น: rubato (ยืด-หดจังหวะเชิงอารมณ์) เสียงร้องแบบ cantabile และช่วง dynamics กว้าง (ppp→fff) คือภาษาหลัก",
    teach: "ให้ผู้เรียนเล่าเป็นคำ 'ท่อนนี้อารมณ์อะไร' ก่อนเล่น แล้วใช้คำนั้นกำหนด dynamics/rubato — ไม่ใช่ท่องว่า 'ตรงนี้เบาเพราะโน้ตเขียว่า p'",
    confidence: 0.85, source: src("romantic-music-wiki"),
  });

  /* ── #4 Forms: the map a student uses to chunk a whole song ── */
  kb.add({
    id: "rep:form-ternary-aba", type: "fact", domain: "form",
    title: "ABA (ternary): เพลงเปิด-กลางเปลี่ยน-กลับมา — รูปแบบที่พบมากที่สุดในเพลงเรียนเปียโน",
    body: "ฟอร์ม ABA (ternary) คือทำนอง A เล่นแล้ว B เปลี่ยนบรรยากาศ/คีย์/รูปคอร์ด แล้วกลับมา A อีกครั้ง — โครงที่พบใน Minuet, เพลงเด็ก, pop verse-chorus-verse โดยธรรมชาติ คือการฝึกที่คุ้มค่าที่สุด: ซ้อม A ครั้งเดียว ใช้ได้สองครั้ง และ B มักสั้นกว่า",
    teach: "ให้ผู้เรียนหูฟังแล้วชูมือตอน 'กลับมาที่เดิม' — จับ ABA ได้ด้วยหูก่อน แล้วแผนซ้อมก็แบ่งตาม A/B ไม่ใช่ตามห้องเลข 1-24",
    confidence: 0.85, source: src("musical-form-wiki"),
  });
  kb.add({
    id: "rep:form-theme-variations", type: "fact", domain: "form",
    title: "Theme & Variations: ทำนองเดิม แต่งใหม่ทีละรอบ (เปลี่ยนจังหวะ/คอร์ด/รูปแบบ)",
    body: "ฟอร์ม theme and variations คือยกทำนองเดิมมาเล่นซ้ำหลายรอบ โดยแต่ละรอบเปลี่ยน: ตกแต่งทำนอง (melodic), เปลี่ยนจังหวะเป็น syncopation (rhythmic), เปลี่ยนคอร์ดรอง (harmonic), หรือพลิก major→minor — Mozart K.265 ('Twinkle Twinkle') คือตัวอย่างที่เด็กรู้จัก เทคนิคนี้ยังโผล่ 'ใน' เพลงทั่วไปเมื่อท่อนเปิดกลับมาในรูปแต่งใหม่",
    teach: "เล่นเกมในคาบ: เปิดทำนองที่รู้จัก ให้ผู้เรียนเปลี่ยนรอบเดียวอย่างเดียว (เฉพาะจังหวะ หรือเฉพาะคอร์ดท้าย) — เหมือน variation ของ Mozart แต่สร้างเอง",
    confidence: 0.8, source: src("theme-variations-wiki"),
  });
  kb.add({
    id: "rep:form-sonatina", type: "fact", domain: "form",
    title: "Sonatina = 'โซนาตาน้องเล็ก' — สั้น เบา สำหรับผู้เรียน (Clementi Op.36 คือชุดคลาสสิก)",
    body: "sonatina คือโซนาตาที่สั้นลง เบากว่า และมักง่ายกว่าทางเทคนิค — คำที่ครูใช้กับเพลงฝึกคลาสสิกแทบทุกชุด (Clementi Op.36 No.1 in C คือชิ้นแรกที่คนเรียนเจอทั่วโลก) โครง movement แรกมักเป็น mini sonata-allegro: ธีมหลัก → ธีมรอง (อีกคีย์) → พัฒนาสั้น ๆ → กลับธีมแรก ประโยชน์ต่อผู้เรียน: มันคือ 'ฟอร์มจริง' ที่เล็กพอจับได้",
    teach: "ให้ผู้เรียนทำสีธีม A/B บนโน้ต แล้วซ้อม 'แผนที่' (เปลี่ยนที่ห้องไหน) ก่อนซ้อมตัวโน้ต — จับโครงได้แล้วตัวเพลงง่ายขึ้นเอง",
    confidence: 0.85, source: src("sonatina-wiki"),
  });
  kb.add({
    id: "rep:form-rondo", type: "fact", domain: "form",
    title: "Rondo (ABACA): ธีมหลักวนกลับทุกครั้งที่ท่อนใหม่จบ",
    body: "rondo คือธีม A กลับมาวนระหว่างธีมใหม่ (ABACA หรือ ABACABA) — ท่อนจบของ sonatina/sonata มักเป็น rondo เพราะผู้ฟังได้ยิน 'บ้าน' บ่อย ๆ สำหรับผู้เรียนคือข่าวดี: A ซ้อมครั้งเดียวใช้หลายรอบ และท่อน B/C ต่างกันชัด จึงไม่งงว่าเล่นถึงไหน",
    teach: "ติดป้าย A-B-A-C-A บนพาร์ติชั่น แล้วซ้อมเป็น 'ทางผ่านจุดสี' — จบทุกท่อนสั้น ๆ ให้ทันก่อนค่อยเชื่อม",
    confidence: 0.8, source: src("rondo-wiki"),
  });

  /* ── #5 Left-hand / accompaniment patterns ── */
  kb.add({
    id: "rep:alberti-bass", type: "fact", domain: "accompaniment",
    title: "Alberti bass: ต่ำ-สูง-กลาง-สูง วนไปเรื่อง ๆ — เสียงประกอบยุคคลาสสิกของมือซ้าย",
    body: "Alberti bass คือคอร์ดแตกเรียง 'ต่ำ-สูง-กลาง-สูง' วนซ้ำ (C-G-E-G…) — รูปแบบประกอบจำเพาะของยุคคลาสสิก โดยเฉพาะ Mozart (โซนาตา K.545 เปิดด้วยอันนี้) มันสร้างเสียงไหลต่อเนื่องจากคอร์ดที่แตกออก และ 'ขับจังหวะ' แทน basso continuo ของบาโรก จุดฝึก: นิ้ว 5-3-1 ของมือซ้ายต้องเสมอกัน ไม่ให้นิ้วโป้งดังเกิน — เสียงควรเท่ากันจนฟังเหมือนคลื่น",
    teach: "ฝึกเป็นบล็อกคอร์ดก่อน (จับทั้งคอร์ดพร้อมกัน) → แตกเป็น ต่ำ-สูง-กลาง-สูง ช้า ๆ → แล้วค่อยให้ทำนองมือขวานั่งทับ — ทำนองต้องดังกว่าคลื่นเสมอ",
    confidence: 0.85, source: src("alberti-bass-wiki"),
  });
  kb.add({
    id: "rep:ostinato-riff", type: "fact", domain: "accompaniment",
    title: "Ostinato/riff: รูปสั้น ๆ วนซ้ำ — ใบเบิกของ pop/rock และดนตรีภาพยนตร์",
    body: "ostinato คือรูปจังหวะ/ทำนองสั้นที่วนซ้ำในเสียงเดียวกัน — Boléro ของ Ravel, Carol of the Bells และแทบทุกเพลง pop (ใน rock/jazz เรียก riff หรือ vamp) มันคือ 'เครื่องยนต์' ของเพลง: ผู้เล่นเปียโนที่จับ ostinato ได้จะประกอบเพลงสมัยใหม่ได้ทันที เพราะเพลงเหล่านั้นยืนบนรูปวนซ้ำของมือซ้าย โดยทำนองวางทับ",
    teach: "ฝึก ostinato จน 'เล่นได้โดยไม่คิด' แล้วค่อยใส่ทำนอง — ใช้ลำดับเดียวกับ hands-separate-then-together แต่เน้นว่ามือซ้ายต้องวนได้เองจริง ๆ ก่อนรวม",
    confidence: 0.85, source: src("ostinato-wiki"),
  });
  kb.add({
    id: "rep:ballad-pattern", type: "strategy", domain: "accompaniment",
    title: "แบบประกอบเพลงช้า: ราก+คอร์ดทีละจังหวะ — สูตรเดียวเล่นเพลงช้าได้ทั้งอัลบั้ม",
    body: "เพลงช้า/บัลลาดส่วนใหญ่ยืนบนสูตรประกอบง่าย ๆ ของมือซ้าย: จังหวะ 1 เล่นราก (octave/โน้ตเดียว) จังหวะ 2-3 คอร์ดบล็อก — เปลี่ยนคอร์ดตามแผนเพลง เสียงที่ได้คือ 'วงดนตรีเต็มวง' จากมือเดียว ผู้เรียนที่กลัวเพลงยาวมักกลัวทำนอง แต่จริง ๆ ตัวที่ยันเพลงคือสูตรมือซ้ายนี้",
    teach: "ซ้อมสูตรกับคอร์ด 4 ตัวของเพลงที่ผู้เรียนชอบ (I-V-vi-IV) จนเปลี่ยนลื่น แล้วค่อยร้อง/hum ทำนองทับ — เพลงเต็มกลายเป็น 'สูตร + ทำนอง'",
    confidence: 0.8, source: src("jazz-piano-wiki"),
  });
  kb.add({
    id: "rep:block-chord-accomp", type: "fact", domain: "accompaniment",
    title: "Block-chord ประกอบ: คอร์ดทั้งวงกดพร้อมจังหวะ — หนักแน่น ใช้กับเพลงจังหวะชัด",
    body: "การประกอบแบบบล็อกคอร์ด (กดคอร์ดทั้งชุดตามจังหวะ แทนการแตกเสียง) ให้ความหนักแน่นตรงเวลา — เหมาะกับ march, เพลงสนุกจังหวะชัด, และการ comp ของ gospel/pop จุดเทคนิค: ข้อมือต้องลอยและใช้น้ำหนักแขนตกทั้งมือ (ไม่ตบด้วยนิ้ว) เสียงจึงเท่ากันทุกโน้ตและไม่เมื่อย",
    teach: "ฝึกบล็อกคอร์ดเป็น 'จังหวะเดียวต่อหนึ่งชีพจร' กับเพลงจังหวะชัด แล้วฟังว่าคอร์ดช่วยผลักจังหวะ ไม่ใช่กลบทำนอง",
    confidence: 0.8, source: src("alberti-bass-wiki"),
  });

  return kb;
}
