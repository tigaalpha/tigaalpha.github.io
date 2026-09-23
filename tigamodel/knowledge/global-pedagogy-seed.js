/* ── tigamodel/knowledge/global-pedagogy-seed.js ──
   Global TEACHING methods + practice science (owner directive 2026-09-17:
   the model must be good at teaching and at practice, not only theory).
   Every entry's `source` points at a page actually read on 2026-09-17;
   content is paraphrased pedagogy, never copied text. Institution-specific
   teaching TRADITIONS are typed "expert-opinion" (honest typing: opinion ≠
   fact), established learning science is typed "fact"/"principle", and
   anything this app should A/B-test before adopting is typed "hypothesis". ── */

import { SOURCES } from "./university-sources.js";

export function seedGlobalPedagogy(kb) {
  const src = (id) => {
    if (!SOURCES[id]) throw new Error(`unknown source id: ${id} — no fake citations`);
    return id;
  };

  /* ── The method families (each: what it claims + what TIGA takes from it) ── */
  kb.add({
    id: "ped:suzuki-mother-tongue", type: "expert-opinion", domain: "pedagogy",
    title: "Suzuki: ภาษาแม่ — ฟังก่อนอ่าน สิ่งแวดล้อมสร้างความสามารถ",
    body: "Suzuki ตั้ง 'Talent Education' บนข้อสังเกตว่าเด็กทุกคนพูดภาษาแม่ได้คล่องโดยไม่มีสอบวัดพรสวรรค์ — ฉะนั้นความสามารถทางดนตรีถูกสร้างด้วยสิ่งแวดล้อม ไม่ใช่กำเนิด: ฟังเพลงที่จะเรียนทุกวัน เรียนเล่นจากหูก่อนอ่านโน้ต (เด็กพูดก่อนอ่าน) ท่องจำทุกเพลง และ review เพลงเก่าตลอดชีวิตการเรียน พร้อมย่อยขั้นให้เล็กพอสำหรับเด็ก 3-5 ขวบ",
    teach: "TIGA ใช้: เล่นเพลงให้ฟังเป็นตัวอย่างก่อนสอนอ่าน, ทบทวนเพลงเก่าในหน้า pathway เสมอ, ไม่มีประตูกันคนเริ่มเรียน",
    confidence: 0.75, source: src("suzuki-wiki"),
  });
  kb.add({
    id: "ped:koday-voice-first", type: "expert-opinion", domain: "pedagogy",
    title: "Kodály: ร้องก่อนเล่น — ประสบการณ์นำสัญลักษณ์",
    body: "Kodály วางเสียงร้องเป็นเครื่องดนตรีแรก (ทุกคนมีเสียงติดตัว) ลำดับการสอน: ฟัง/ร้อง/ขยับ 'ก่อน' เรียนสัญลักษณ์ — เหมือนพูดก่อนอ่าน ใช้พยางค์จังหวะ (ta, ti-ti) ให้จังหวะกลายเป็นคำที่พูดได้ เรียนจากง่ายสุดของเด็กไปหายาก และทบทวนผ่านเกมตลอด — จนกลายเป็นมรดกภูมิปัญญา UNESCO (2016)",
    teach: "TIGA ใช้: ให้ร้อง/hum ทำนองก่อนกดคีย์ (ร้องตามโน้ตที่ไหลใน Play Along), ตั้งชื่อจังหวะเป็นพยางค์พูดได้",
    confidence: 0.75, source: src("koday-wiki"),
  });
  kb.add({
    id: "ped:orff-elemental-doing", type: "expert-opinion", domain: "pedagogy",
    title: "Orff: เรียนด้วยการทำ — ย่อยจนง่ายสุดแล้วไล่ทีละขั้น",
    body: "Orff Schulwerk ทำให้ดนตรีเป็น 'elemental' — ใกล้โลกของการเล่นของเด็ก: ทุกคอนเซปต์เรียนจากการลงมือทำ ไม่ใช่ฟังอธิบาย ครูย่อยกิจกรรมเป็นรูปง่ายที่สุดแล้วนำเสนอทีละขั้นจนรวมเป็นบทเล่นเต็ม ใช้ ostinato (รูปซ้ำ) และการด้นสดเป็นวัสดุหลัก และออกแบบให้ไม่รู้สึกถูกตัดสิน — เด็กกล้าลองเพราะผิดแล้วไม่เสียหาย",
    teach: "TIGA ใช้: ทุกบทเรียนย่อยเป็นขั้นที่สำเร็จได้ใน 2-5 นาที, ให้ลองผิดได้โดยไม่มี penalty, รูปซ้ำ (ostinato) เป็นแบบฝึกแรก",
    confidence: 0.75, source: src("orff-wiki"),
  });
  kb.add({
    id: "ped:dalcroze-body-first", type: "expert-opinion", domain: "pedagogy",
    title: "Dalcroze: จังหวะอยู่ในกาย — ขยับก่อนอ่านสัญลักษณ์",
    body: "Jaques-Dalcroze พบว่านักเรียนขาด 'การรับรู้ทางกาย' ของจังหวะ จึงสอนให้ประสบการณ์คอนเซปต์ผ่านการเคลื่อนไหวก่อนเห็นสัญลักษณ์ (eurhythmics) — รากฐาน steady beat ต้องอยู่ในร่างกายก่อนอยู่ในหน้าโน้ต แนวนี้มีอิทธิพลต่อ Kodály/Orff/Suzuki ทั้งหมด และมี 3 เสา: ขยับตามเสียง, ฟัง-เข้าใจ-แสดงออก, ด้นสดอิสระ",
    teach: "TIGA ใช้: ก่อนแก้จังหวะเพี้ยน ให้เคาะ/ขยับตาม beat จริง (ประสบการณ์ในกาย) แล้วค่อยกลับมาเล่น — ไม่ใช่แค่พูดว่า 'เล่นช้าลง'",
    confidence: 0.7, source: src("dalcroze-wiki"),
  });
  kb.add({
    id: "ped:gordon-audiation", type: "expert-opinion", domain: "pedagogy",
    title: "Gordon: audiation — 'ได้ยินในหัว' คือความคิดของดนตรี",
    body: "Gordon บัญญัติคำ audiation (1975): การได้ยินและเข้าใจเสียงที่ไม่ได้ดังอยู่จริง — 'audiation ต่อดนตรี เท่ากับ ความคิดต่อภาษา' เรียนเป็นบันได: ฟัง-ทำตาม → ผูกคำ (พยางค์/ชื่อโน้ต) → ผูกสัญลักษณ์ โดยเน้น 'แพตเทิร์น' (กลุ่มเสียง) ไม่ใช่โน้ตเดี่ยว ๆ — คนที่ audiate ได้จะเล่นผิดแล้ว 'รู้ตัวว่าผิด' ซึ่งเป็นเป้าหมายการฝึกหูที่แท้จริง",
    teach: "TIGA ใช้: ก่อนเล่นท่อนใหม่ ให้ฟังตัวอย่างแล้วถาม 'ขึ้นหรือลง เร็วหรือช้า' — ฝึกคาดเดาเสียงก่อนกดคีย์",
    confidence: 0.75, source: src("gordon-wiki"),
  });
  kb.add({
    id: "ped:teacher-fit-factor", type: "fact", domain: "pedagogy",
    title: "คุณภาพครูวัดที่ 'ปรับให้เข้ากับนักเรียน' ไม่ใช่ที่วิธีเดียวสำหรับทุกคน",
    body: "Piano pedagogy ระบุปัจจัยคุณภาพของครู: ฝีมือการเล่น ความรู้ repertoire/ทฤษฎี/ประวัติ ประสบการณ์สอน และที่สำคัญที่สุดต่อ AI: 'ความสามารถปรับวิธีสอนให้เข้ากับบุคลิกและ learning style ที่ต่างกันของนักเรียนแต่ละคน' — วิธีเดียวบังคับทุกคนจึงเป็นจุดอ่อนที่สาขานี้ยอมรับเอง สายครูใหญ่ (Czerny→Leschetizky→Neuhaus) สืบทอดผ่านการสอนต่อบุคคล ไม่ใช่ตำราเดียว",
    teach: "TIGA ใช้: ปรับคำอธิบาย/ความยาก/อุปมา ตามพฤติกรรมจริงของผู้เรียนในแอป (accuracy, pauses, self-report) ไม่ใช่สคริปต์เดียวทุกคน",
    confidence: 0.8, source: src("piano-pedagogy-wiki"),
  });
  kb.add({
    id: "ped:taubman-coordination", type: "expert-opinion", domain: "technique",
    title: "Taubman: เทคนิคคือการเคลื่อนไหวที่ประสานกัน ไม่ใช่แรงนิ้ว",
    body: "Dorothy Taubman วิเคราะห์การเล่นเปียโนเป็นระบบการเคลื่อนไหวของแขนทั้งข้าง: forearm rotation, shaping (มือเลื่อนตามรูปเพลง), grouping (จัดโน้ตเป็นกลุ่มที่มือทำพร้อมกัน), in-and-out — แนวนี้โด่งดังจากการช่วยฟื้นฟูนักเปียโนที่บาดเจ็บ (รวมถึง Leon Fleisher) ใจความ: ความเร็ว/ความแน่นมาจากการประสานมากกว่าการกำ ถ้าเจ็บ = ทำผิดวิธี ไม่ใช่ซ้อมไม่พอ",
    teach: "Wrist เกร็ง/เจ็บเมื่อไหร่ ให้หยุดเล่นทันที ลดความเร็วครึ่งหนึ่ง และเช็ก: ข้อมือนิ่งเกินไปหรือกำแรงเกิน — ความปลอดภัยทางกายมาก่อนความคืบหน้าเสมอ",
    confidence: 0.7, source: src("taubman-wiki"),
  });
  kb.add({
    id: "ped:method-map", type: "fact", domain: "pedagogy",
    title: "แผนที่ระบบสอนศตวรรษที่ 20: ห้าสำนักใหญ่ ต่างกันที่จุดเริ่ม",
    body: "Dalcroze เริ่มที่การเคลื่อนไหว Kodály เริ่มที่เสียงร้อง Orff เริ่มที่การเล่นแบบ elemental Suzuki เริ่มที่สิ่งแวดล้อมแบบภาษาแม่ Gordon เริ่มที่ audiation (ได้ยินในหัว) — ทุกสำนักเห็นตรงกันสามข้อ: ประสบการณ์มาก่อนสัญลักษณ์, ย่อยขั้นให้เล็ก, ทบทวนต่อเนื่อง ต่างกันแค่ 'ประตูทางเข้า' ระบบดิจิทัลอย่าง TIGA จึงเลือกประตูได้ตามผู้เรียน (ฟังก่อน/ร้องก่อน/ขยับก่อน) แทนการผูกตายที่สำนักเดียว",
    teach: "ถ้าผู้เรียนไม่ตอบสนองกับการอธิบาย ลองสลับประตู: เล่นให้ฟังก่อน (Suzuki), ให้ร้องก่อน (Kodály), ให้เคาะก่อน (Dalcroze)",
    confidence: 0.8, source: src("music-education-wiki"),
  });

  /* ── Practice science (the 'how to practise' half of the request) ── */
  kb.add({
    id: "sci:deliberate-practice", type: "fact", domain: "practice-science",
    title: "ฝึกแบบตั้งใจ (deliberate practice): วิธีฝึกชนะจำนวนชั่วโมง",
    body: "งานวิจัย Ericsson สรุป: ผู้เชี่ยวชาญต่างจากคนทั่วไปที่ 'วิธีฝึก' ไม่ใช่จำนวนครั้ง — ย่อยทักษะเป็น chunk เล็ก โฟกัสจุดอ่อนที่ขอบความสามารถ (ไม่ใช่เล่นแต่ท่อนที่เล่นได้แล้ว) และมี feedback ทันที ข้อควรระวังที่พิมพ์ชัด: ถ้า feedback ไม่เหมาะสม การฝึก 'ไม่ได้ผลหรือแม้แต่เป็นโทษ' — ซ้อม 10 ชั่วโมงแบบเล่นวนทั้งเพลงแบบสบาย ๆ แพ้ซ้อม 20 นาทีแบบแก้จุดเดียว",
    teach: "TIGA ใช้: ชี้จุดพลาดซ้ำเป็นขั้นเล็กให้ฝึกเฉพาะจุด, feedback ทันทีที่กดผิด (Practice Mode), ห้ามปล่อยให้เล่นวนทั้งเพลงโดยไม่แก้จุดติด",
    confidence: 0.85, source: src("practice-wiki"),
  });
  kb.add({
    id: "sci:spaced-repetition", type: "fact", domain: "practice-science",
    title: "ทบทวนเว้นระยะ: ช่วงห่างที่ขยายขึ้น ชนะการยัดซ้ำ",
    body: "Ebbinghaus (1880s) เสนอ forgetting curve: ความจำตกแบบชันหลังเรียน และการทบทวน 'เว้นระยะที่ขยายขึ้นเรื่อย ๆ' แตะจุดตกของเส้นนั้นได้ — จำได้ถูก ให้เว้นยาวขึ้นเท่าตัว จำไม่ได้ ให้รีเซ็ตกลับระยะสั้น หลักการนี้คือเหตุผลของการมี 'เพลงเก่า' กลับมาในหน้า pathway (Suzuki เรียก review) ไม่ใช่การทำซ้ำเพื่อความรู้สึกดี แต่เป็นตารางกันลืมที่ออกแบบด้วยหลักวิทยาศาสตร์",
    teach: "TIGA ใช้: เพลง/คอร์ดที่เรียนแล้ววนกลับมาเป็นแบบฝึกอุ่นเครื่องตามระยะ ไม่ใช่ปล่อยจนลืมแล้วเริ่มศูนย์",
    confidence: 0.85, source: src("spaced-repetition-wiki"),
  });
  kb.add({
    id: "sci:retrieval-practice", type: "fact", domain: "practice-science",
    title: "ดึงจากความจำ > อ่านซ้ำ: การทดสอบตัวเองคือการเรียน",
    body: "testing effect (retrieval practice): การอุทิศส่วนของเวลาเรียนไป 'ดึงข้อมูลออกจากความจำ' เพิ่มความจำระยะยาวมากกว่าการอ่าน/ฟังซ้ำ — เอกสารอ้าง Bacon (1620), James (1890): พอเกือบจำได้ ให้พยายามนึกเองก่อนเปิดดู สำหรับเปียโนคือ: เล่นท่อนสั้น ๆ 'จากความจำ' หรือตอบ 'คอร์ดนี้คืออะไร' ก่อนดีกว่าจ้องโน้ตเล่นวน — การทดสอบไม่ใช่แค่วัด แต่คือการเรียนเอง",
    teach: "TIGA ใช้: ชวนเล่นท่อนที่จำได้โดยปิดหน้าโน้ต/ปิดไฮไลต์, ถามชื่อคอร์ดที่เพิ่งเล่น ก่อนเฉลย",
    confidence: 0.85, source: src("testing-effect-wiki"),
  });
  kb.add({
    id: "sci:chunking", type: "fact", domain: "practice-science",
    title: "chunking: หัวสมองจำ 'กลุ่ม' ได้ ไม่ใช่ 'รายการ'",
    body: "Working memory จำของได้ไม่กี่ชิ้น แต่ chunk (กลุ่ม 2-6 ชิ้นที่ผูกกันเป็นความหมายเดียว) นับเป็น 'หนึ่ง' — เบอร์โทรจึงจำเป็นกลุ่ม ไม่ใช่ทีละหลัก ในเปียโน: นักเล่นเก่งเห็น 'ท่อน/รูปคอร์ด/แพตเทิร์น' ไม่ใช่ 'โน้ตทีละตัว' การฝึกที่ตัดเป็นท่อนเล็ก (hands separate, 2 ห้อง) ได้ผลเพราะสร้าง chunk ให้สมองเก็บ — ไม่ใช่เพราะ 'มือต้องอุ่น'",
    teach: "TIGA ใช้: ตัดบทเรียนยากเป็น 2 ห้อง/มือเดียว ให้ครบ 'chunk เดียวจบได้ในความสนใจหนึ่งรอบ' แล้วค่อยประกอบ",
    confidence: 0.85, source: src("chunking-wiki"),
  });

  /* ── Hypotheses this app can actually test (§ honest typing) ── */
  kb.add({
    id: "hyp:audiation-pre-play", type: "hypothesis", domain: "practice-science",
    title: "สมมติฐาน: ฟังตัวอย่างก่อนเล่นทุกครั้ง ลดจำนวนครั้งที่กดผิด",
    body: "ถ้าระบบสอนทั้งห้า (Suzuki/Gordon โดยตรง) ถูกต้อง การให้ฟังท่อนก่อนเล่นจะลดความผิดพลาดใน Practice Mode — TIGA มีข้อมูลอยู่แล้ว (accuracy ก่อน/หลังใส่ตัวอย่างเสียง) ควรทดสอบและยกเป็น fact เมื่อตัวเลขยืนยัน",
    teach: "ยังไม่สอนเป็นความจริง — เก็บข้อมูลก่อน",
    confidence: 0.5, source: src("gordon-wiki"),
  });

  return kb;
}
