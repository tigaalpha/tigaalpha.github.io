/* ── tigamodel/knowledge/university-links.js ──
   Cross-links BETWEEN knowledge entries (owner request 2026-09-17: show what
   the model knows as a connected map, Obsidian-style). The university seed
   added entries but no relations, so the graph rendered as isolated dots.

   Everything here points at ids that already exist in university-seed.js —
   knowledge-base.add() silently drops relations to unknown ids (Map lookup),
   so a typo here could never corrupt the KB; it would only vanish from the
   graph. Relation vocabulary matches knowledge-base.js:
     requires  → A needs B to exist first (arrow A → B)
     improves  → practicing A strengthens B
     relates   → they belong together (with an optional note) ── */

export function linkUniversityKnowledge(kb) {
  const rel = (from, to, type, note) => kb.relations.push({ from, to, type, note: note || "" });

  /* Skills need skills: the pedagogy chain the entries describe. */
  rel("uni:th-mahidol-continuum", "uni:us-juilliard-ladder", "relates",
      "ทั้งคู่วางเส้นทางผู้เรียนเป็นระยะต่อเนื่อง — ต่างกันที่ปลายทาง (ทั่วไป vs อาชีพ)");
  rel("uni:us-berklee-harmony-core", "uni:ru-moscow-since-1866", "relates",
      "harmony คู่กับการเล่น — Berklee แยกเป็นกลุ่มวิชา, Moscow ผสมตั้งแต่วันเปิด");
  rel("uni:us-berklee-contemporary", "uni:jp-geidai-lineage", "relates",
      "ดนตรีที่ผู้เรียนคุ้นเคยเป็นจุดเริ่ม — contemporary (US) และทำนองท้องถิ่น (JP)");
  rel("uni:ru-russian-school-weight", "uni:fr-paris-french-school", "relates",
      "สองสำนักเทคนิค: น้ำหนักแขน (RU) vs ความประณีตของนิ้ว/สีสันเสียง (FR)");
  rel("uni:cn-ccom-structure", "uni:uk-rcm-performance-science", "relates",
      "การฝึกที่เป็นระบบและวัดผลได้ — โครงสร้างสถาบัน (CN) และแนววิจัย (UK)");
  rel("uni:uk-rcm-performance-opportunity", "uni:uk-rcm-performance-science", "relates",
      "เวทีบ่อย ๆ คือการเก็บข้อมูลเพื่อปรับการซ้อม — คนละด้านของ performance science เดียวกัน");
  rel("uni:kr-karts-model", "uni:jp-geidai-lineage", "relates",
      "ดนตรีผสานศิลปะอื่น/สากล — โมเดลสถาบันเอเชียร่วมสมัย");

  /* ── Cross-domain links: theory ↔ pedagogy ↔ practice (owner directive
     2026-09-17: the model must connect knowing to teaching to practising) ── */
  // what we teach sits ON the graded ladder
  rel("theory:graded-ladder-global", "uni:us-juilliard-ladder", "relates",
      "บันได 8 เกรด (ABRSM/Trinity/RCM) คือฉบับ 'สามัญ' ของ ladder สถาบัน");
  rel("theory:graded-ladder-global", "uni:th-mahidol-continuum", "relates",
      "หลักสูตรไทยก็วางบนบันไดระดับเดียวกัน");
  // harmony knowledge feeds the chord-teaching tradition
  rel("theory:function-bsd", "uni:us-berklee-harmony-core", "relates",
      "ฟังก์ชัน T/S/D คือศัพท์ของ harmony core ที่ Berklee ใช้เป็นกลุ่มวิชา");
  rel("theory:dominant-seventh", "theory:cadence-four-types", "requires",
      "เข้าใจ V7 ก่อนจึงจะเห็นว่าทำไม authentic cadence จบเต็ม");
  rel("theory:circle-of-fifths-map", "theory:function-bsd", "relates",
      "วงกลม fifths อธิบายว่าทำไม V กับ IV คือ 'เพื่อนบ้าน' ของ I");
  rel("theory:consonance-dissonance", "theory:dominant-seventh", "requires",
      "รู้จักคู่ ตึง-คลาย ก่อนจึงจะฟังแรงดึงของ V7 ออก");
  // rhythm chain
  rel("theory:rhythm-vs-pulse", "theory:beat-metre-rhythm", "requires",
      "แยก pulse/metre/rhythm ได้ก่อน จึงจะจัดกลุ่มเสียงเบารอบเสียงดังถูก");
  rel("theory:beat-metre-rhythm", "ped:dalcroze-body-first", "relates",
      "metre คือกรอบที่ Dalcroze ให้ร่างกายฝึกผ่านการเคลื่อนไหว");
  // ear-training chain
  rel("theory:solfege-two-systems", "ped:koday-voice-first", "relates",
      "movable do คือเครื่องมือหลักของสายร้องก่อนเล่น");
  rel("theory:solfege-two-systems", "ped:gordon-audiation", "relates",
      "solfège คือสะพานจากเสียงสู่ชื่อ ในบันได audiation ของ Gordon");
  rel("theory:eye-hand-span", "ped:gordon-audiation", "relates",
      "อ่านข้างหน้าได้ไกล ต้องอาศัยได้ยินในหัว (audiation) ค้ำ");
  // practice science chains onto the app's own loop
  rel("sci:deliberate-practice", "uni:uk-rcm-performance-science", "relates",
      "ซ้อมแบบวิจัย (ตั้งเป้า เก็บผล ปรับ) — Ericsson กับ RCM บอกตรงกัน");
  rel("sci:chunking", "ex:hands-separate-then-together", "improves",
      "เหตุผลเบื้องหลัง 'แยกมือแล้วรวม': สร้าง chunk ที่ working memory เก็บไหว");
  rel("sci:spaced-repetition", "uni:cn-ccom-structure", "relates",
      "การฝึกประจำวันที่วัดผลได้ของ CCOM คือ spaced repetition ในทางปฏิบัติ");
  rel("sci:retrieval-practice", "ex:slow-count-aloud", "improves",
      "นับออกเสียง = ดึงการนับจากความจำ ไม่ใช่ฟังเครื่องระบุเงียบ ๆ");
  // methods ↔ the app's own principles
  rel("ped:orff-elemental-doing", "strat:decompose", "relates",
      "ย่อยกิจกรรมเป็นขั้นง่ายสุดไล่ทีละขั้น — หัวใจเดียวกับ principle ของ TIGA");
  rel("ped:suzuki-mother-tongue", "uni:th-mahidol-general-public", "relates",
      "ไม่กันคนเริ่มเรียน: แนวทางภาษาแม่ (JP) กับเปิดกว้างสู่คนทั่วไป (TH)");
  rel("ped:taubman-coordination", "uni:ru-russian-school-weight", "relates",
      "เสียงมาจากการเคลื่อนไหวที่ประสาน ไม่ใช่การกำ — สองสำนักครึบกัน");
  rel("ped:teacher-fit-factor", "uni:us-berklee-contemporary", "relates",
      "ปรับให้เข้ากับผู้เรียน: เพลงที่เขาฟังจริงคือสะพานที่ดีที่สุด");
  rel("theory:improv-history", "ped:orff-elemental-doing", "relates",
      "การด้นสดในกรอบคอร์ด — ประเพณีเก่าที่ Orff คืนให้เด็ก");

  return kb;
}
