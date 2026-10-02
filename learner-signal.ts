/* ── learner-signal.ts — หน่วยตัดสินใจเดียวของครู (แผน 18 §P1) ──
   ปัญหาที่ไฟล์นี้แก้: "ครูในป๊อปอัป" (Auto Teaching) กับ "หน้า Daily Mentor"
   ตอบคำถามเดียวกัน ("ตอนนี้ควรให้เขาฝึกอะไร") ออกมาคนละชิด เพราะอ่านคนละ
   localStorage key: ป๊อปอัปอ่าน tg_memory.struggles (use-autoteach.ts) · หน้า Mentor
   อ่าน tg_act_log (computeCoachStats) — ผู้เรียนจึงเจอสองคำแนะนำที่ขัดกันโดยไม่มีใคร
   อธิบายว่าทำไม. ไฟล์นี้รวมกติกาทั้งสามชุด (น้ำหนักจุดอ่อน + คะแนนทักษะ + แผน drill)
   ไว้ที่เดียว แล้วคืน "nextAction" อันเดียวที่ทั้งสองหน้าใช้ร่วมกัน

   กติกาเหล็กที่คงไว้ทุกข้อ (ย้ายมาจากโค้ดเดิม ไม่ใช่ของใหม่):
   • ไม่มีข้อมูล = null ไม่เคยเดา · ไม่มีตัวเลขปลอม · ไม่มี 0% แทน "ยังไม่มีข้อมูล"
   • คะแนนทักษะต้องมี ≥ 8 ครั้ง (SKILL_MIN_N) ถึงขึ้นตัวเลข · half-life 14 วัน
   • จุดอ่อนต้องมี ≥ 4 ครั้งและพลาดจริง ≥ 1 ครั้ง · half-life 6 วัน · หมดอายุ 21 วัน
   • confidence < 0.5 → มองต่อ ไม่ขยับระดับ (อยู่ใน pickDrillPlan)
   • deterministic: input เดิม → ผลลัพธ์เดิมเสมอ (ไม่มี Math.random / Date.now ในตัว)

   ไฟล์นี้ PURE: ไม่มี localStorage, ไม่มี network, ไม่ import อะไรจาก React —
   ผู้เรียนข้อมูลเข้ามาเป็น argument คืนค่ากลับเป็น object จึงทดสอบด้วย fixture
   ได้ตรง ๆ (tigamodel/scripts/smoke-learner-signal.mjs) */

import { pickDrillPlan } from "./tigamodel/teaching/skill-state-plans.js";

/* ── ทักษะ 7 ด้าน (ย้ายจาก App.tsx ที่เดียวเพื่อไม่ให้สองชุดกติกาเปลี่ยนแยกกันไป) ── */
export const SKILLS = ["note_accuracy", "sight_reading", "ear_training", "chord_knowledge", "dynamics", "rhythm", "technique"];
export const SKILL_MIN_N = 8;            // น้อยกว่านี้ = "ข้อมูลยังไม่พอ" ไม่ใช่ 0%
export const SKILL_HALFLIFE_DAYS = 14;
export const TOPIC_MIN_N = 4;            // จุดอ่อนรายหัวข้อต้องมีอย่างน้อย 4 ครั้ง
export const SKILL_ACTION_MAX = 55;      // ทักษะที่ "ดีแล้ว" ไม่ต้องมาเป็นคำสั่ง (ค่าเดิมของ CRITICAL_SKILL_SCORE)
export const STRUGGLE_HALFLIFE_DAYS = 6;
export const STRUGGLE_EXPIRE_DAYS = 21;

/* ทักษะไหนแก้ตรงไหน — เดิมอยู่ใน App.tsx (SKILL_REMEDIATION) ย้ายมาเป็นแหล่งเดียว
   เพราะ now nextAction ต้องบอกปุ่ม "ฝึกเลย" ว่าจะพาไปไหน */
export const SKILL_FEATURE = {
  sight_reading: "reading_course", ear_training: "ear_training", chord_knowledge: "ear_training",
  technique: "hand_coach",
};
/* จากหัวข้อที่ซ้อม (act log) ไปหน้าปลายทาง — คีย์เดียวกับ handleCoachNavigate */
const KIND_FEATURE = {
  game: "play_along", ear: "ear_training", read: "sight_reading",
  lesson: "pathway", "read-chapter": "pathway", drill: "pathway", voice: "pathway",
};

const DAY = 86400000;

/* กิจกรรมหนึ่งครั้งให้ข้อมูลทักษะอะไร (คงเดิม: ไม่มีการเขียน tag ใหม่ทุกจุด) */
export function skillsOfActivity(e) {
  if (!e || typeof e !== "object") return [];
  if (e.skill) return [e.skill];          // tag ชัดเจน (Dynamics/Rhythm/Technique) เชื่อมันก่อน
  switch (e.k) {
    case "drill": case "game": return ["note_accuracy"];
    case "read": return ["sight_reading"];
    case "ear": return e.id === "chord" ? ["ear_training", "chord_knowledge"] : ["ear_training"];
    default: return [];                    // voice/lesson/read-chapter ไม่มีสัญญาณความถูกต้อง
  }
}

/* ── คะแนนทักษะจาก act log (คืนทุกทักษะเสมอ; score=null = ยังไม่พอข้อมูล) ── */
export function skillScoresOf(log, now = Date.now()) {
  const entries = Array.isArray(log) ? log : [];
  const buckets = {};
  for (const e of entries) {
    if (!e || e.ok + e.miss < 1) continue;
    const w = Math.pow(0.5, (now - e.t) / DAY / SKILL_HALFLIFE_DAYS);
    for (const sk of skillsOfActivity(e)) {
      const b = buckets[sk] || (buckets[sk] = { wOk: 0, wTot: 0, n: 0 });
      b.wOk += e.ok * w; b.wTot += (e.ok + e.miss) * w; b.n += e.ok + e.miss;
    }
  }
  return SKILLS.map(sk => {
    const b = buckets[sk];
    return { skill: sk, score: b && b.n >= SKILL_MIN_N ? Math.round(b.wOk / b.wTot * 100) : null, n: b ? b.n : 0 };
  });
}
export function weakestSkills(scores, n = 2) {
  if (!Array.isArray(scores)) return [];
  return scores.filter(s => s && s.score != null).sort((a, b) => a.score - b.score).slice(0, n);
}

/* ── จุดอ่อนถ่วงน้ำหนัก (half-life 6 วัน · หมดอายุ 21 วัน — คงเดิมทุกตัวเลข) ──
   รับ array เข้ามา (ไม่อ่าน tg_memory เอง) → use-autoteach ส่ง readMemory().struggles ให้ */
export function weightedStrugglesOf(struggles, now = Date.now()) {
  const list = Array.isArray(struggles) ? struggles : [];
  return list
    .filter(s => s && s.last && (now - s.last) <= STRUGGLE_EXPIRE_DAYS * DAY)
    .map(s => ({ ...s, label: asText(s.label) }))
    .map(s => {
      const age = Math.max(0, now - s.last);
      const recency = Math.pow(0.5, age / DAY / STRUGGLE_HALFLIFE_DAYS);
      const severity = 1 - Math.min(1, Math.max(0, (s.acc || 0) / 100));
      const freq = Math.min(1, (s.count || 1) / 5);
      return { ...s, weight: +(0.5 * recency + 0.3 * severity + 0.2 * freq).toFixed(3), ageDays: Math.floor(age / DAY) };
    })
    .sort((a, b) => (b.weight - a.weight) || String(a.label || "").localeCompare(String(b.label || "")));
}

/* ── หัวข้อที่พลาดมากที่สุดจาก act log (หลักฐานหนักกว่า memory: นับจริงทุกครั้ง) ── */

/* ป้ายที่การ์ดจะวาดต้องเป็นข้อความเสมอ — object {th,en,zh} ที่หลุดมาถึง JSX คือ
   React #31 ("objects are not valid as a React child") ซึ่งเคยทำให้ทั้งหน้า
   Mentor พัง ผู้เรียนที่ส่ง label มาเป็น object จึงถูกแปลงเป็นข้อความที่นี่
   แทนที่จ�ไปถึงชั้น UI (ชั้น UI ยังเรียก tr() ได้ถ้าอยากได้หลายภาษา) */
export function asText(v) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const pick = v.th || v.en || v.zh || Object.values(v)[0];
    return typeof pick === "string" ? pick : "";
  }
  return "";
}

export function weakestTopicOf(log, now = Date.now(), labelOf) {
  const entries = Array.isArray(log) ? log : [];
  const label = typeof labelOf === "function" ? (e => asText(labelOf(e))) : (e => asText((e && e.id) || ""));
  const byTopic = {};
  for (const e of entries) {
    if (!e || e.k === "voice" || e.ok + e.miss < 1) continue;
    const key = e.k + "|" + e.id;
    const b = byTopic[key] || (byTopic[key] = { e, ok: 0, miss: 0 });
    b.ok += e.ok || 0; b.miss += e.miss || 0;
  }
  return Object.values(byTopic)
    .filter(b => b.ok + b.miss >= TOPIC_MIN_N && b.miss > 0)
    .map(b => ({
      kind: "topic", entry: b.e,
      label: label(b.e),
      n: b.ok + b.miss,
      miss: b.miss,
      rate: Math.round(b.miss / (b.ok + b.miss) * 100),
    }))
    .sort((a, b) => (b.rate - a.rate) || (b.n - a.n) || a.label.localeCompare(b.label))[0] || null;
}

/* ── นาทีที่แนะนำ: กติกาเดิมของหน้า Mentor (พลาดเยอะ = ลงเวลามากขึ้น) ── */
export function minutesForMissRate(rate) {
  return rate > 50 ? 15 : rate > 20 ? 10 : 5;
}

/* ── หน่วยตัดสินใจเดียว ──
   input : { log, struggles, ability, drills, labelOf, now }
   output: { weakest, skillScores, drillPlan, minutes, confidence, evidence, nextAction }
   nextAction = null เมื่อ "ยังบอกไม่ได้ว่าให้ฝึกอะไร" — หน้าจอต้องบอกว่ายังซ้อมไม่พอ
   แทนการเดา (กติกาข้อ 2 ของแผน 18) */
export function learnerSignal(input = {}) {
  const inp = input && typeof input === "object" ? input : {};
  const now = typeof inp.now === "number" ? inp.now : Date.now();
  const log = Array.isArray(inp.log) ? inp.log : [];
  const skillScores = skillScoresOf(log, now);
  const topic = weakestTopicOf(log, now, inp.labelOf);
  const struggles = weightedStrugglesOf(inp.struggles, now);
  // แผน drill ต้องมีทั้งความสามารถจากเซิร์ฟเวอร์และคลัง drill — ยัง null ได้ตรง ๆ
  // จนกว่า learner_skill_state จะมีแถวจริง และนั่นคือคำตอบที่ถูกต้อง ไม่ใช่ของที่หายไป
  const drillPlan = pickDrillPlan(inp.ability, inp.drills) || null;

  /* ลำดับการเลือก "อะไรคือสิ่งที่ควรฝึกต่อ" — หลักฐานหนักสุดก่อนเสมอ:
     1) หัวข้อที่นับพลาดจริงใน act log (มีตัวเลข n/miss/rate ตรวจย้อนได้)
     2) จุดอ่อนใน memory ที่ยังไม่หมดอายุ (มี acc/count/อายุ)
     3) ทักษะที่คะแนนต่ำจริงและมีหน้าปลายทางให้กด
     ไม่มีสักทางไหน = null */
  let nextAction = null;
  if (topic) {
    nextAction = {
      id: `topic:${topic.label}`,
      kind: "topic",
      label: topic.label,
      feature: KIND_FEATURE[topic.entry.k] || "pathway",
      tab: topic.entry.k === "ear" && topic.entry.id === "chord" ? "chord" : undefined,
      stepText: topic.label,               // ให้ goToCoachStep() resolve เป็นเพลง/บทจริง
      minutes: minutesForMissRate(topic.rate),
      reasonKind: "miss_rate",
      confidence: null,                    // ยังไม่มีแบบจำลองความมั่นใจของ act log — ไม่แต่ง
      evidence: [{ kind: "topic", label: topic.label, n: topic.n, miss: topic.miss, rate: topic.rate }],
    };
  } else if (struggles.length) {
    const s = { ...struggles[0], label: asText(struggles[0].label) };
    nextAction = {
      id: `struggle:${s.label}`,
      kind: "topic",
      label: s.label,
      feature: "pathway",
      tab: undefined,
      stepText: s.label,
      minutes: minutesForMissRate(Math.round(100 - (s.acc || 0))),
      reasonKind: "recent_struggle",
      confidence: null,
      evidence: [{ kind: "struggle", label: s.label, acc: s.acc, count: s.count, ageDays: s.ageDays, weight: s.weight }],
    };
  } else {
    // เฉพาะทักษะที่ "ยังไม่ดี" เท่านั้น — ทักษะที่ได้ 100/100 ไม่ใช่คำสั่งให้ฝึก
    const weakest = weakestSkills(skillScores, 1).filter(s => s.score < SKILL_ACTION_MAX)[0];
    const feature = weakest && SKILL_FEATURE[weakest.skill];
    if (feature) {
      nextAction = {
        id: `skill:${weakest.skill}`,
        kind: "skill",
        skill: weakest.skill,
        label: weakest.skill,               // ป้ายภาษาอยู่ที่ชั้น UI (tr()) ไม่ปนมาที่นี่
        feature,
        tab: weakest.skill === "chord_knowledge" ? "chord" : undefined,
        stepText: null,                     // ทักษะไม่มีชื่อเพลงให้ resolve — ใช้ feature ตรง ๆ
        minutes: weakest.score < 55 ? 10 : 5,
        reasonKind: "skill_low",
        confidence: drillPlan && drillPlan.skill_id === weakest.skill ? drillPlan.confidence : null,
        evidence: [{ kind: "skill", skill: weakest.skill, score: weakest.score, n: weakest.n }],
      };
    }
  }

  return {
    weakest: topic || null,
    skillScores,
    drillPlan,
    minutes: nextAction ? nextAction.minutes : null,
    confidence: nextAction ? nextAction.confidence : null,
    evidence: nextAction ? nextAction.evidence : [],
    nextAction,
  };
}

/* ── "ป๊อปอัปกับการ์ดต้องเป็นคำเดียวกัน": ถ้าคำนี้เพิ่งถูกส่งไปใน 24 ชม.
   ถือว่าส่งแล้ว ไม่ยิงซ้ำ (ผู้เรียนเจอคำเดียวกันสองที่ = ครูสองคนที่ไม่รู้จักกัน) ──
   marks = [{ id, t }] · pure: คืน true เมื่อ "ไม่ควรยิงซ้ำ" */
export function repeatWindowOpen(marks, id, now = Date.now(), windowMs = 24 * 3600 * 1000) {
  if (!id) return false;
  const list = Array.isArray(marks) ? marks : [];
  const hit = list.find(m => m && m.id === id && typeof m.t === "number");
  return !!hit && (now - hit.t) < windowMs;
}

/* ── โควตาฟรีต่อวัน (เจ้าของตัดสิน 2026-10-02: ฟรี 2 ครั้ง/วัน แล้วชี้ไปแผน) ──
   used = จำนวนครั้งที่ยิงไปแล้ววันนี้ (นับจาก timestamps จริงของวันนี้เท่านั้น) */
export function freeQuotaState(usedToday, freePerDay = 2) {
  const used = Math.max(0, Math.round(usedToday || 0));
  const cap = Math.max(0, Math.round(freePerDay));
  return { used, cap, left: Math.max(0, cap - used), spent: used >= cap };
}

/* ── จังหวะการส่ง (เจ้าของ 2026-10-02: "ตอนเล่น play along / pvp ไม่ให้ขึ้น ขอตอนจบ") ──
   blocked = กำลังเล่นอยู่ (เพลงเปิดอยู่ · อยู่หน้าสนาม · หน้าเกม) — ตอนนี้ป๊อปอัป
   จะบังหมอก/ตัวโน้ตตรงจังหวะที่ผู้เรียนกำลังตัดสินใจกด จึง "จดค้าง" ไว้แล้วไป
   ยิงตอนจบกิจกรรมทีเดียว แทนที่จะทิ้งคำแนะนำทั้งใบ
   pure → ทดสอบได้โดยไม่ต้องเปิดเบราว์เซอร์ */
export function atipDelivery({ blocked = false, tipShown = false, busy = false } = {}) {
  if (tipShown) return "skip";        // ยังไม่ได้อ่านการ์ดเดิม → อย่าทับ
  if (busy) return "skip";            // กำลังดึงอยู่ → ไม่ยิงซ้อน
  return blocked ? "defer" : "send";
}