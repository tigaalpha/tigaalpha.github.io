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

  /* ── GROUP 1 cross-links (piano-craft): pedal/dynamics/jazz join the map.
     owner gap audit 2026-09-17: the craft topics must hang off the theory
     and pedagogy nodes that ground them, not float alone. ── */
  rel("craft:pedal-sustain-basics", "craft:pedal-legato-listen", "requires",
      "รู้ว่าแป้นทำอะไรก่อน จึงจะฝึก 'หูตัดสิน' ได้");
  rel("craft:pedal-legato-listen", "theory:harmony-two-dimensions", "relates",
      "แป้นยืดเสียงแนวนอน (คอร์ดไหลต่อ) — เหตุผลที่ต้องปล่อยทุกครั้งที่คอร์ดเปลี่ยน");
  rel("craft:dynamics-vocabulary", "craft:melody-above-accompaniment", "requires",
      "ควบคุมระดับเสียงได้ก่อน จึงจะแยกทำนอง-คอร์ดด้วยน้ำหนักมือได้");
  rel("craft:melody-above-accompaniment", "theory:harmony-two-dimensions", "relates",
      "แนวตั้ง (คอร์ด) รองแนวนอน (ทำนอง) — สองมิติของ harmony ในมือเดียวกัน");
  rel("craft:pain-is-motion", "ped:taubman-coordination", "relates",
      "เจ็บ = เคลื่อนไหวผิด — หัวใจเดียวกับแนว Taubman ที่ KB มีอยู่แล้ว");
  rel("craft:posture-foundation", "craft:pain-is-motion", "improves",
      "ท่าที่ถูกช่วยกันความเจ็บตั้งแต่ต้นทาง");
  rel("craft:extended-chords", "theory:dominant-seventh", "requires",
      "เข้าใจคอร์ด 7th ก่อนจึงไล่ต่อเป็น 9/11/13 ได้");
  rel("craft:slash-chords", "tcraft:inversions-bass", "requires",
      "C/E คือการระบุ inversion ด้วยสัญลักษณ์ — ต้องรู้ inversion ก่อน");
  rel("craft:pad-voicing", "tcraft:voice-leading-smooth", "relates",
      "การวางโน้ตให้เว้นช่วง = voice leading ในรูปแบบ pad");
  rel("craft:interval-naming", "craft:interval-by-song", "requires",
      "ตั้งชื่อคู่เสียงถูกก่อน จึงจะผูกกับเพลงอ้างอิงได้ไม่สับสน");
  rel("craft:interval-naming", "theory:consonance-dissonance", "relates",
      "คู่เสียงคือวัตถุดิบของ ตึง-คลาย ที่หูจับได้");
  rel("craft:jazz-comping", "craft:twelve-bar-blues", "requires",
      "เล่นบนกรอบ 12-bar ก่อน จึงจะ comp ได้ไม่หลงโครง");
  rel("craft:twelve-bar-blues", "theory:function-bsd", "relates",
      "I-IV-V ของ blues คือฟังก์ชัน T/S/D ในรูปแบบแปลงตัว");
  rel("craft:jazz-comping", "uni:us-berklee-contemporary", "relates",
      "jazz ของแอปมี Berklee เป็นสำนักอ้างอิงหลัก");

  /* ── GROUP 2+3 cross-links (teacher-craft) ── */
  rel("tcraft:memory-three-channels", "ped:suzuki-mother-tongue", "relates",
      "Suzuki ท่องจำทุกเพลง — สามช่องทางคือวิธีที่ทำให้ทำได้จริง");
  rel("tcraft:rote-foundations-ok", "sci:retrieval-practice", "relates",
      "ท่องจำแบบ rote ได้ฐาน แต่การดึงจากความจำ (testing effect) คือสิ่งที่ตอกมันให้แน่");
  rel("tcraft:ear-ladder", "craft:interval-by-song", "improves",
      "เพลงอ้างอิงคือขั้นบันไดฝึกหูชั้นคู่เสียง");
  rel("tcraft:ear-ladder", "uni:us-berklee-harmony-core", "relates",
      "Berklee จัด ear training เดินคู่กับทฤษฎี — บันไดฝึกหูคือหลักนั้นในทางปฏิบัติ");
  rel("tcraft:session-by-age", "sci:spaced-repetition", "relates",
      "ซ้อมสั้นทุกวันชนะยาว ๆ นาน ๆ ครั้ง — spaced repetition ตัดสิน");
  rel("tcraft:session-shape", "sci:deliberate-practice", "relates",
      "ช่วงกลางของเซสชันคือ deliberate practice ที่ขอบความสามารถ");
  rel("tcraft:session-shape", "tcraft:sdt-three-needs", "improves",
      "ปิดท้ายด้วยเพลงที่ชอบ = relatedness+competence ทำงานทุกเซสชัน");
  rel("tcraft:stage-fright-normal", "uni:uk-rcm-performance-opportunity", "relates",
      "เวทีบ่อย ๆ ของ RCM คือยาของ stage fright ในทางปฏิบัติ");
  rel("tcraft:sdt-three-needs", "tcraft:gamification-feedback-first", "improves",
      "แต้ม/ป้ายที่ดีสะท้อน competence จริง — หัวใจ SDT ข้อที่สอง");
  rel("tcraft:gamification-feedback-first", "sci:retrieval-practice", "relates",
      "แต้มที่วัดความก้าวหน้าจริงต้องมาจากการทดสอบจริง ไม่ใช่เวลาที่นั่งไว้");
  rel("tcraft:thai-music-context", "theory:universal", "relates",
      "ระบบเสียงไทย/ลูกทุ่งมีตรรกะของตัวเอง — สอนตะวันตกโดยไม่ลบวัฒนธรรมผู้เรียน");
  rel("tcraft:note-value-names", "theory:beat-metre-rhythm", "requires",
      "อ่านค่าโน้ตได้ก่อน จึงจะจัดกลุ่มเป็น metre ได้");
  rel("tcraft:modes-seven", "theory:circle-of-fifths-map", "relates",
      "7 modes คือ 'จุดเริ่มต้นต่างกันบนชุดเดิม' — เดียวกับมุมมองของวงกลม fifths");
  rel("tcraft:inversions-bass", "tcraft:voice-leading-smooth", "improves",
      "เลือก inversion ให้เสียงเดินน้อย = หัวใจของ voice leading");
  rel("tcraft:voice-leading-smooth", "theory:harmony-two-dimensions", "relates",
      "เส้นเสียงเดิน (แนวนอน) ภายในคอร์ดซ้อน (แนวตั้ง) — สองมิติรวมกัน");
  rel("tcraft:modulation-pivot", "theory:circle-of-fifths-map", "requires",
      "เข้าใจวงกลม fifths ก่อน จึงเห็นว่าคีย์ 'ใกล้เครียตัว' คือไหน");
  rel("tcraft:modulation-pivot", "theory:function-bsd", "relates",
      "คอร์ด pivot ต้องมีฟังก์ชันในสองคีย์พร้อมกัน");

  return kb;
}
