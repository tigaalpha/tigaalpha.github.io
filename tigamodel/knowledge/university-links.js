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

  return kb;
}
