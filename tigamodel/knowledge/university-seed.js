/* ── tigamodel/knowledge/university-seed.js ──
   University-sourced knowledge entries (owner directive 2026-09-17: gather
   music knowledge from leading music universities/conservatories of each
   country). Every entry's `source` field points at a URL that was actually
   read on 2026-09-17 (see university-sources.js) — facts are paraphrased
   pedagogy, never copied text, and confidence reflects how directly the
   source supports the claim. Entries about teaching PRACTICE derived from
   an institution's known tradition are typed "expert-opinion" (honest
   typing per §10: opinion ≠ fact). ── */

import { createKnowledgeBase, seedKnowledgeBase } from "./knowledge-base.js";
import { SOURCES } from "./university-sources.js";

export function seedUniversityKnowledge(kb) {
  const src = (id) => {
    if (!SOURCES[id]) throw new Error(`unknown source id: ${id} — no fake citations`);
    return id;
  };

  /* ── ประเทศไทย — College of Music, Mahidol University ── */
  kb.add({
    id: "uni:th-mahidol-continuum",
    type: "fact", domain: "pedagogy", country: "TH",
    title: "แนวทางไทย (Mahidol): การเรียนดนตรีเป็นแถบต่อเนื่องทั้งชีวิต",
    body: "โมเดลการสอนของคณะดุริยางคศิลป์ มหิดล ครอบคลุมตั้งแต่เด็กเล็ก (อายุ ~3 ปี) จนถึงปริญญาเอก และมีหลักสูตรเปิดกว้างสำหรับบุคคลทั่วไปจำนวนมาก — หลักการที่นำมาใช้ได้: ผู้เรียนทุกวัยควรมีเส้นทางของตัวเอง ไม่ใช่มีเส้นทางเดียวสำหรับเด็กเก่งเท่านั้น",
    confidence: 0.75, source: src("mahidol-music-wiki"),
  });
  kb.add({
    id: "uni:th-mahidol-general-public",
    type: "expert-opinion", domain: "pedagogy", country: "TH",
    title: "แนวทางไทย (Mahidol): การเรียนเพื่อคนทั่วไปเป็นภารกิจหลัก",
    body: "การที่สถาบันดนตรีชั้นนำของไทยเปิดรับผู้เรียนทั่วไปจำนวนหลักพัน (นอกเหนือจากนักเรียนปริญญา) สะท้อนหลักการสอนว่า: ครูเปียโน AI ควรออกแบบประสบการณ์สำหรับ 'ผู้เรียนทั่วไป' เป็นฐานหลัก แล้วค่อยขยายสำหรับผู้เรียนขั้นสูง — ตรงกับผู้ใช้แอป TIGA ส่วนใหญ่",
    confidence: 0.7, source: src("mahidol-music-wiki"),
  });

  /* ── สหรัฐอเมริกา — Berklee (contemporary/jazz) ── */
  kb.add({
    id: "uni:us-berklee-harmony-core",
    type: "fact", domain: "harmony", country: "US",
    title: "แนวทางอเมริกัน (Berklee): harmony + ear training เป็นแกนหลักของหลักสูตร",
    body: "Berklee จัดให้ Music Theory, Ear Training, Harmony เป็นกลุ่มวิชาเฉพาะตั้งแต่ระดับรากฐาน — หลักการ: ฝึกฟัง (ear training) ต้องเดินคู่กับทฤษฎีและคอร์ด ไม่ใช่เรียนแยกขาดจากกัน",
    confidence: 0.8, source: src("berklee-home"),
  });
  kb.add({
    id: "uni:us-berklee-contemporary",
    type: "fact", domain: "jazz", country: "US",
    title: "แนวทางอเมริกัน (Berklee): ดนตรีร่วมสมัยเรียนจากผู้ปฏิบัติจริง",
    body: "Berklee ก่อตั้งราวระบบ Schillinger (harmony/composition แบบเชิงระบบ) และเน้นจ้างนักดนตรีที่ทำงานจริงเป็นครู — หลักการสอน: ให้ผู้เรียนเล่นเพลงแนวที่ตัวเองฟัง/ชอบจริง (jazz/pop) ควบคู่เทคนิคพื้นฐาน แทนที่จะเริ่มจาก classical เท่านั้น",
    confidence: 0.75, source: src("berklee-wiki"),
  });

  /* ── สหรัฐอเมริกา — Juilliard (conservatory ladder) ── */
  kb.add({
    id: "uni:us-juilliard-ladder",
    type: "fact", domain: "pedagogy", country: "US",
    title: "แนวทางอเมริกัน (Juilliard): pre-college → ปริญญา → อาชีพ เป็นทางเดินเดียวกัน",
    body: "Juilliard รวม pre-college, ปริญญาตรี-โท-เอก และการเตรียมอาชีพไว้ในสถาบันเดียวตั้งแต่ 1905 — หลักการ: เป้าหมายการสอนควรตั้งตามระยะของผู้เรียน (พัฒนาพื้นฐาน / พัฒนาสู่ระดับสูง / เตรียมแสดงจริง) แล้วเลือกแบบฝึกให้ตรงระยะ",
    confidence: 0.75, source: src("juilliard-wiki"),
  });

  /* ── รัสเซีย — Moscow Tchaikovsky Conservatory ── */
  kb.add({
    id: "uni:ru-moscow-since-1866",
    type: "fact", domain: "pedagogy", country: "RU",
    title: "แนวทางรัสเซีย (Moscow Conservatory): รากฐานวิชาการแน่นตั้งแต่วันเปิด",
    body: "ก่อตั้ง 1866 โดย Nikolai Rubinstein; Tchaikovsky เป็นอาจารย์ทฤษฎี/harmony ตั้งแต่ปีเปิด; วิชาเปียโนสอนมาตั้งแต่รุ่นแรก — หลักการ: ทฤษฎี (harmony) และการเล่นเป็นองค์รวมเดียวตั้งแต่เริ่ม ไม่แยก 'เรียนเล่นก่อนแล้วค่อยเรียนทฤษฎี'",
    confidence: 0.75, source: src("moscow-conservatory-wiki"),
  });
  kb.add({
    id: "uni:ru-russian-school-weight",
    type: "expert-opinion", domain: "technique", country: "RU",
    title: "แนวทางรัสเซีย: น้ำหนักแขน + เสียงร้องจากคีย์ (singing tone)",
    body: "แนวปฏิบัติที่โลกยอมรับของสำนักรัสเซีย (สืบทอดผ่าน Rubinsteins → รุ่นหลัง): ใช้น้ำหนักแขน/แขนเป็นแหล่งเสียง ไม่กำมือ และมุ่งให้เสียงเปียโน 'ร้อง' — นำมาเป็นหลักสอน technique: สอนน้ำหนักและการฟังเสียงก่อนความเร็ว",
    confidence: 0.65, source: src("moscow-conservatory-wiki"), // tradition widely documented; direct page covers institution history
  });

  /* ── ฝรั่งเศส — Conservatoire de Paris ── */
  kb.add({
    id: "uni:fr-paris-french-school",
    type: "fact", domain: "pedagogy", country: "FR",
    title: "แนวทางฝรั่งเศส (Conservatoire de Paris): สำนัก 'French School'",
    body: "ก่อตั้ง 1795 สอนตามประเพณี 'French School' ที่เน้น clarity, สีสันเสียง (timbre) และ finger technique ประณีต — อาจารย์เปียโนยุคแรก ๆ เช่น Louise Farrenc, Henri Herz, Marmontel — หลักการ: ความชัดเจนของเสียงและนิ้วมาก่อนความหนัก",
    confidence: 0.75, source: src("paris-conservatory-wiki"),
  });

  /* ── จีน — Central Conservatory of Music ── */
  kb.add({
    id: "uni:cn-ccom-structure",
    type: "fact", domain: "pedagogy", country: "CN",
    title: "แนวทางจีน (Central Conservatory): บันไดสอนต่อเนื่อง ประถม→ปริญญาเอก",
    body: "CCOM มีโรงเรียนประถม/มัธยมดนตรีในระบบจนถึงปริญญาเอก และเปียโนเป็นหลักสูตรแกนหลัก (สถาบันมีเปียโน 500+ เครื่อง) — หลักการ: การฝึกประจำวันที่เป็นระบบและวัดผลได้ต่อเนื่อยานเป็นแกนของการพัฒนาเปียโน — สอดคล้องกับ streak/progress tracking ของ TIGA",
    confidence: 0.75, source: src("ccom-wiki"),
  });

  /* ── ญี่ปุ่น — Tokyo University of the Arts ── */
  kb.add({
    id: "uni:jp-geidai-lineage",
    type: "fact", domain: "pedagogy", country: "JP",
    title: "แนวทางญี่ปุ่น (Tokyo Geidai): รากเก่ากว่า 130 ปี + เปิดรับสากล",
    body: "สายวิชาดนตรีสืบจาก Tokyo Music School (1887) และแลกเปลี่ยนกับสถาบันยุโรปโดยตรง — หลักการ: การเรียนดนตรีเอเชียพัฒนาได้เร็วเมื่อผสานประเพณีท้องถิ่นกับวิธีการสากล — TIGA ใช้หลักนี้: ตัวอย่างเพลงควรมีทั้งสากลและเพลงที่ผู้เรียนในแต่ละประเทศคุ้นเคย",
    confidence: 0.7, source: src("tokyo-geidai-wiki"),
  });

  /* ── เกาหลีใต้ — K-Arts ── */
  kb.add({
    id: "uni:kr-karts-model",
    type: "fact", domain: "pedagogy", country: "KR",
    title: "แนวทางเกาหลี (K-Arts): สถาบันศิลปะรวมที่มี School of Music เฉพาะ",
    body: "ก่อตั้ง 1993 เป็นมหาวิทยาลัยศิลปะแห่งชาติ มี 6 schools รวม School of Music — หลักการ: ดนตรีเรียนควบคู่ศิลปะอื่นได้ (เสียง/การแสดง/มัลติมีเดีย) — สนับสนุนแนวทาง TIGA ที่ผสาน voice/vision/performance เข้ากับการสอนเปียโน",
    confidence: 0.7, source: src("karts-wiki"),
  });

  /* ── สหราชอาณาจักร — Royal College of Music ── */
  kb.add({
    id: "uni:uk-rcm-performance-science",
    type: "fact", domain: "practice-science", country: "UK",
    title: "แนวทางอังกฤษ (RCM): performance science — ศาสตร์วิจัยการแสดงจริง",
    body: "RCM มี Centre for Performance Science วิจัยสภาพจิตใจ/ร่างกายตอนแสดงและซ้อม — หลักการที่นำมาใช้: การซ้อมควรถูกออกแบบเหมือนการวิจัย (ตั้งเป้า เก็บผล ปรับวิธี) — ตรงกับ teaching loop + outcome dataset ของ TIGA",
    confidence: 0.75, source: src("rcm-home"),
  });
  kb.add({
    id: "uni:uk-rcm-performance-opportunity",
    type: "expert-opinion", domain: "practice-science", country: "UK",
    title: "แนวทางอังกฤษ (RCM): เวทีจริงบ่อย ๆ เป็นหัวใจของหลักสูตร",
    body: "RCM ถูกยกว่ามีโปรแกรมการแสดงสาธารณะ 'หนึ่งในหนาแน่นที่สุดในโลก' — หลักการสอนที่ได้: ให้ผู้เรียนได้ 'แสดง' (แม้แค่บันทึกวิดีโอ/เล่นให้ AI ฟัง) เป็นประจำ เพราะเป้าหมายการแสดงเปลี่ยนคุณภาพการซ้อม",
    confidence: 0.7, source: src("rcm-home"),
  });

  return kb;
}

/* Factory: fresh KB seeded with tiga-original pedagogy + university knowledge.
   The BASE seed (the skill/exercise/strategy entries the app's own loop
   relies on) must be in too — web.js REPLACES the singleton's kb with this
   factory's result, so anything missing here is missing in production
   (found by the GROUP-4 test 2026-09-17: exercise/strategy relations from
   university-links.js dangled because the base seed never made it in). */
export function createUniversitySeededKnowledgeBase() {
  const kb = createKnowledgeBase();
  seedKnowledgeBase(kb);
  seedUniversityKnowledge(kb);
  return kb;
}
