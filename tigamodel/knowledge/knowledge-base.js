/* ── tigamodel/knowledge/knowledge-base.js ──
   Structured Knowledge Base (spec §10, §11): entries are TYPED (fact /
   principle / strategy / hypothesis / expert-opinion / uncertain /
   source-required), carry confidence + provenance metadata, and link to
   each other (Skill A requires B; Exercise X improves Skill Y; ...).
   Nothing here is a long-text blob — everything is queryable structure so
   reasoning engines (diagnosis → prerequisite, exercise selection) can use
   it. Copyright (§12): seed content below is original/anonymous pedagogy
   common-knowledge; source metadata exists from day one so future imported
   content MUST carry its real license or be rejected.

   The exercise templates reference skills that exist in the app's own
   curriculum (pathway-data.ts/songs-data.ts own the authoritative curriculum
   — KB complements it, never duplicates it). ── */

import { PRINCIPLES } from "../teaching/philosophy.js";

export const ENTRY_TYPES = ["fact", "principle", "strategy", "hypothesis", "expert-opinion", "uncertain", "source-required"];

export function createKnowledgeBase() {
  const entries = new Map(); // id → entry
  const relations = []; // { from, to, type, note }

  function add({ id, type, domain, title, body, teach = null, confidence = 0.7, source = "tiga-original", ageGroups = null, difficulty = null, prerequisites = [], improves = [], relates = [], tags = [] }) {
    if (!ENTRY_TYPES.includes(type)) throw new Error(`unknown entry type: ${type}`);
    entries.set(id, {
      id, type, domain, title, body,
      teach, // how to teach it to a beginner — seeds carry it; getKBContext() serves it to the student-facing teacher
      confidence: Math.max(0, Math.min(1, Number(confidence))),
      source, // { source_id, license, permission_status } objects allowed; string = tiga-original
      age_groups: ageGroups,
      difficulty,
      tags: Array.isArray(tags) ? tags : [], // used by lab search + smoke checks
      created_at: new Date().toISOString(),
    });
    prerequisites.forEach(p => relations.push({ from: id, to: p, type: "requires" }));
    improves.forEach(s => relations.push({ from: id, to: s, type: "improves" }));
    relates.forEach(r => relations.push({ from: id, to: r.id, type: r.rel || "relates", note: r.note || "" }));
    return id;
  }

  function get(id) { return entries.get(id) || null; }
  function byDomain(domain) { return Array.from(entries.values()).filter(e => e.domain === domain); }
  function prerequisitesOf(skillId) {
    return relations.filter(r => r.to === skillId && r.type === "requires").map(r => get(r.from)).filter(Boolean);
  }
  function exercisesFor(skillId) {
    return relations.filter(r => r.to === skillId && r.type === "improves").map(r => get(r.from)).filter(Boolean);
  }
  function count() { return entries.size; }

  return { add, get, byDomain, prerequisitesOf, exercisesFor, count, relations, _entries: entries };
}

/* ── Seed content: original pedagogy aligned with the app's curriculum.
   Confidence: pedagogy-common-knowledge = 0.8; technique specifics = 0.6-0.7. ── */
export function seedKnowledgeBase(kb) {
  // skills
  kb.add({ id: "skill:steady-beat", type: "fact", domain: "rhythm", title: "จังหวะนิ่งเป็นฐานของทุกอย่าง", body: "ความสามารถรักษา beat คงที่ต้องมาก่อนความเร็ว", confidence: 0.8 });
  kb.add({ id: "skill:note-reading", type: "fact", domain: "sight-reading", title: "อ่านโน้ตพื้นฐาน", body: "จำตำแหน่งโน้ตบนบันไดานุภาพ + แปลงเป็นคีย์ได้คล่อง", confidence: 0.8 });
  kb.add({ id: "skill:hand-independence", type: "fact", domain: "technique", title: "มือสองข้างแยกอิสระ", body: "มือซ้าย-ขวาทำงานต่างรูปแบบได้พร้อมกัน", confidence: 0.75 });
  kb.add({ id: "skill:basic-chords", type: "fact", domain: "harmony", title: "คอร์ดพื้นฐาน", body: "เล่น triads ที่นิยม (C F G Am ฯลฯ) เสียงไม่แตก สลับได้ลื่น", confidence: 0.8 });

  // prerequisites (practice science: rhythm/reading first)
  kb.add({ id: "rel:hand-indep-needs-steady-beat", type: "principle", domain: "pedagogy", title: "อิสระมือต้องมีจังหวะนิ่งก่อน", body: "ฝึก hand independence บนจังหวะที่ยังไม่นิ่ง = ฝึกความผิด", confidence: 0.7, relates: [{ id: "skill:steady-beat", rel: "requires-note" }] });

  // exercises that improve skills
  kb.add({ id: "ex:slow-count-aloud", type: "strategy", domain: "rhythm", title: "เล่นช้า + นับออกเสียง", body: "เลือกท่อน 2-4 ห้อง เล่นช้ากว่าเป้า 50% พร้อมนับออกเสียงทุก beat", confidence: 0.75, improves: ["skill:steady-beat"], difficulty: "beginner" });
  kb.add({ id: "ex:hands-separate-then-together", type: "strategy", domain: "technique", title: "แยกมือแล้วรวม", body: "ซ้อมมือเดียวจนลื่น → อีกมือ → รวมช้า ๆ", confidence: 0.75, improves: ["skill:hand-independence", "skill:steady-beat"], difficulty: "beginner" });
  kb.add({ id: "ex:chord-pairs", type: "strategy", domain: "harmony", title: "จับคู่คอร์ดสลับ", body: "เลือกคอร์ด 2 ตัว สลับช้า ๆ ตาม beat 8 ครั้ง แล้วเปลี่ยนคู่", confidence: 0.7, improves: ["skill:basic-chords"], difficulty: "beginner" });

  // common errors → possible causes (§11: Error Z may be caused by Concept Q)
  kb.add({ id: "err:rushing", type: "hypothesis", domain: "rhythm", title: "เร่งจังหวะตอนท่องที่ถนัด", body: "มักเกิดจากความคุ้นเคย (มือเร็วกว่าสมองนับ) ไม่ใช่เจตนา", teach: "อย่าบอกว่า 'อย่ารีบ' — ให้เล่นช้าลงพร้อมนับออกเสียงทุก beat แล้วชมจุดที่นิ่งขึ้นจริง", confidence: 0.6, improves: ["skill:steady-beat"] });

  // teaching strategies mapped to philosophy ids
  PRINCIPLES.forEach(p => {
    if (["decompose", "no-overload"].includes(p.id)) {
      kb.add({ id: `strat:${p.id}`, type: "principle", domain: "pedagogy", title: p.th, body: "แบ่งงานเป็นขั้นเล็กที่เห็นความสำเร็จได้ใน 2-5 นาที", confidence: 0.7 });
    }
  });
  return kb;
}

/* Factory used by index.js */
export function createSeededKnowledgeBase() {
  const kb = createKnowledgeBase();
  seedKnowledgeBase(kb);
  return kb;
}
