import { readMemory, writeMemory } from "./ai-chat-context";
import { logUsage } from "./shared-infra";

/* ── use-autoteach.ts — แม่นยำสุดของระบบ Auto Teaching (แผน 10 ข้อ อนุมัติ 2026-09-19)
   หน้าที่ของไฟล์นี้ (ทุกอย่าง pure/local — ไม่ network ไม่ SQL):
   1. weightedStruggles()  — จุดอ่อนเรียงตาม "น้ำหนักความสด" (ข้อ 2): จุดอ่อนเก่า
      จางลงทุกวัน (half-life 6 วัน) และหมดอายุ 21 วัน (SM-2 interval เดิมยังคุม
      SRS เหมือนเดิม — นี่คือชั้นความแม่นของ "ครูควรพูดถึงอะไรตอนนี้")
   2. recordNoteMisses()   — โน้ตระดับ pitch-class ที่พลาดจริงตอนซ้อม (ข้อ 1+3)
   3. decideStrategy()     — TIGA Piano Model (teaching loop) วิเคราะห์ก่อนเสมอ
      (ข้อ 4) — AI ภายนอกแค่เรียบเรียงภาษาตามกลยุทธ์ที่โมเดลเลือก
   4. validateTip()        — ตรวจคำตอบ AI ก่อนแสดง (ข้อ 5): กันคำแนะนำที่หลุด
      ขอบเขต (ทฤษฎีสูง/เพลงที่ไม่มี/คำสั่งซ้อมสากล) — ปัดเป็น fallback
      ในภาษาของผู้เรียนเสมอ ไม่มี popup เปล่า
   5. openAdvice + recordTipOutcome() — วงจรปิด (ข้อ 6): ตอนยิง tip จด "สถานะ
      จุดอ่อน ณ ตอนนั้น" ไว้ แล้วตอนซ้อมถัดไปจบ เทียบว่าดีขึ้นกี่ % — ผลถูก
      บันทึกลง tg_atip_outcomes (สำหรับการ์ด admin ข้อ 10) และแหล่งกำเนิด
      "กลยุทธ์ไหนได้ผลกับคนกลุ่มไหน"
   6. recordTipAction()    — เรียนรู้พฤติกรรม (ข้อ 7): กดตาม/ปิดทิ้ง/หมดเวลา
      เพื่อให้ tip ถัดไปถูกจังหวะและตรงใจขึ้น
   7. promptFor()          — ปรับโทนตามระดับผู้เรียน (ข้อ 9): ยังไม่ผ่านขั้นแรก
      → ภาษาง่ายสั้น, ขั้นกลาง → ปกติ, ระดับสูง (boss/exp สูง) → เทคนิคลึกได้ ── */

const LS_OUT = "tg_atip_outcomes";
const DAY = 86400000;
const HALF_LIFE = 6 * DAY;      // จุดอ่อนอายุ 6 วัน = น้ำหนักเหลือครึ่ง
const EXPIRE = 21 * DAY;        // 21 วันไม่เจอซ้ำ = ถือว่าหายแล้ว หยุดพูดถึง

export function readAutoTeachOutcomes() {
  try { return JSON.parse(localStorage.getItem(LS_OUT) || "[]") || []; } catch (e) { return []; }
}
function writeOutcomes(list) { try { localStorage.setItem(LS_OUT, JSON.stringify(list.slice(-40))); } catch (e) {} }

/* ข้อ 2 — จุดอ่อนถ่วงน้ำหนัก + หมดอายุ */
export function weightedStruggles(now = Date.now()) {
  const m = readMemory();
  return (m.struggles || [])
    .filter(s => s.last && (now - s.last) <= EXPIRE)             // หมดอายุ → ตัดทิ้ง
    .map(s => {
      const age = Math.max(0, now - s.last);
      const recency = Math.pow(0.5, age / HALF_LIFE);            // 1.0 สดใหม่ → 0.5 ทุก 6 วัน
      const severity = 1 - Math.min(1, Math.max(0, (s.acc || 0) / 100)); // ยิ่งแม่นยำต่ำ ยิ่งหนัก
      const freq = Math.min(1, (s.count || 1) / 5);              // พลาดบ่อย = หนักขึ้น
      return { ...s, weight: +(0.5 * recency + 0.3 * severity + 0.2 * freq).toFixed(3), ageDays: Math.floor(age / DAY) };
    })
    .sort((a, b) => b.weight - a.weight);
}

/* ข้อ 1+3 — โน้ตที่พลาดจริงระหว่างซ้อม (pitch class เพราะ octave สลับได้ในโน้ตเดียวกัน)
   เก็บใน tg_memory.noteMisses — เก่าสุด 12 รายการ อัปเดต count/last ทับรายการเดิม */
export function recordNoteMisses(labels) {
  if (!Array.isArray(labels) || !labels.length) return;
  try {
    const m = readMemory();
    const now = Date.now();
    const cur = m.noteMisses || [];
    for (const raw of labels) {
      const label = String(raw || "").trim();
      if (!label) continue;
      const hit = cur.find(n => n.label === label);
      if (hit) { hit.count = (hit.count || 1) + 1; hit.last = now; }
      else cur.push({ label, count: 1, last: now });
    }
    m.noteMisses = cur.sort((a, b) => b.last - a.last).slice(0, 12);
    writeMemory(m);
  } catch (e) { /* memory best-effort — never crash practice */ }
}
export function topNoteMisses(k = 2) {
  const now = Date.now();
  try {
    return (readMemory().noteMisses || [])
      .filter(n => n.last && (now - n.last) <= 10 * DAY)          // 10 วันไม่พลาดซ้ำ = เลิกกล่าวถึง
      .sort((a, b) => (b.count * Math.max(0.25, Math.pow(0.5, (now - b.last) / HALF_LIFE))) - (a.count * Math.max(0.25, Math.pow(0.5, (now - a.last) / HALF_LIFE))))
      .slice(0, k);
  } catch (e) { return []; }
}

/* ข้อ 4 — โมเดลเลือกกลยุทธ์ก่อน: ห่อ runTeachingLoopForPractice ให้เป็น "คำสั่งสอน"
   ที่ AI ภายนอกต้องทำตาม (เหมือนที่หน้าสรุปผลฝึกทำอยู่ — ที่นี่ใช้กับ popup)
   async-aware: runOnce ของ teaching-loop เป็น async เสมอ — รอ promise ให้จบ */
export async function decideStrategy(stats, loopFn) {
  try {
    if (typeof loopFn !== "function") return null;
    const loop = await Promise.resolve(loopFn(stats));
    if (!loop || !loop.response) return null;
    return {
      strategyId: loop.decision ? loop.decision.strategy_id : null,
      states: Array.isArray(loop.states) ? loop.states : [],
      issues: loop.diagnosis && Array.isArray(loop.diagnosis.issues) ? loop.diagnosis.issues : [],
      text: loop.response.text || "",
    };
  } catch (e) { return null; }
}
const STRATEGY_TH = { praise: "ชมความก้าวหน้าแล้วค่อยแนะนำ", micro_challenge: "ท้าทายสั้น ๆ ที่ทำได้แน่", tiny_task: "ให้งานเล็กที่ทำเสร็จได้ใน 2 นาที", normalize_struggle: "ปลอบว่าติดตรงนี้เป็นเรื่องปกติของทุกคน", encourage: "ให้กำลังใจเป็นหลัก", check_in: "ถามอาการก่อนว่าเหนื่อยไหม" };
export function strategyHint(dec) {
  if (!dec) return null;
  const name = STRATEGY_TH[dec.strategyId] || dec.strategyId || null;
  if (!name && !dec.text) return null;
  return { name, modelText: dec.text || "", states: dec.states.map(s => `${s.state}@${typeof s.probability === "number" ? s.probability.toFixed(2) : s.probability}`).join(", ") };
}

/* ข้อ 5 — ตรวจคำตอบ AI ก่อนแสดง: JSON ครบ + feature จริง + ไม่หลุดขอบเขต */
const GENERIC = /(ฝึกอย่างสม่ำเสมอ|ฝึกบ่อยๆ|ฝึกบ่อย ๆ|ตั้งใจฝึก|ขยันฝึก|practice regularly|practice more|keep practicing|多练习|经常练习)/i;
const ADVANCED = /(jazz voicing|polychord|quartal|twelve-tone|12-tone|atonal|set theory|counterpoint species|和声分析|advanced harmony)/i;
export function validateTip(obj, featureKeys) {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.weakness || typeof obj.weakness !== "string" || obj.weakness.length < 4 || obj.weakness.length > 160) return false;
  if (!Array.isArray(obj.steps) || !obj.steps.length || obj.steps.length > 3) return false;
  if (!obj.steps.every(s => typeof s === "string" && s.length >= 4 && s.length <= 220)) return false;
  if (obj.feature && !featureKeys.includes(obj.feature)) return false;
  const all = [obj.weakness, ...obj.steps].join(" ");
  if (GENERIC.test(all) || ADVANCED.test(all)) return false;   // กว้างเกิน/หลุดขอบเขต → ปัด
  return true;
}

/* ข้อ 9 — โทนตามระดับ: ขั้นต้น ๆ = สั้นง่าย, เลเวลสูง = เทคนิคได้ */
export function learnerTone(profile) {
  const lvl = (profile && profile.level) || 0;
  const boss = profile && Array.isArray(profile.progress) && profile.progress.some(p => p && p.boss);
  if (lvl <= 2) return { tier: "beginner", rule: "ประโยคสั้น คำง่าย ห้ามศัพท์ทฤษฎี สูงสุด 2 ขั้นตอน" };
  if (lvl >= 8 || boss) return { tier: "advanced", rule: "ให้เหตุผลเชิงเทคนิคสั้น ๆ ได้ เช่น การนิ้ว น้ำหนักตัว เสียงประสาน" };
  return { tier: "intermediate", rule: "เจาะจง มีเหตุผลสั้น ๆ ประกอบ 1 ประโยค" };
}

/* ข้อ 6 — วงจรปิด: ตอนยิง tip จด snapshot จุดอ่อนไว้ แล้วเทียบผลซ้อมถัดไป */
export function openAdvice(tip, strugglesNow) {
  try {
    const rec = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, t: Date.now(), topic: (tip && tip.topic) || (tip && tip.weakness) || null, strategyId: (tip && tip.strategyId) || null, before: (strugglesNow || []).slice(0, 3).map(s => ({ label: s.label, acc: s.acc })), resolved: false, outcome: null };
    writeOutcomes([...readAutoTeachOutcomes(), rec]);
    return rec.id;
  } catch (e) { return null; }
}
export function recordTipOutcome(topic, afterStruggles) {
  try {
    const list = readAutoTeachOutcomes();
    const rec = [...list].reverse().find(r => !r.resolved && r.topic && topic && (r.topic === topic || topic.includes(r.topic) || r.topic.includes(topic)));
    if (!rec) return false;
    const before = (rec.before || []).find(b => b.label === topic);
    const afterEntry = (afterStruggles || []).find(s => s.label === topic);
    const afterAcc = afterEntry ? afterEntry.acc : null;
    if (before && afterAcc == null) { /* หายจากจุดอ่อนไปเลย = ดีขึ้นเต็มที่ */ rec.outcome = { delta: 100, improved: true }; }
    else if (before && afterAcc != null) { const delta = afterAcc - before.acc; rec.outcome = { delta, improved: delta > 0 }; }
    else rec.outcome = { delta: null, improved: null };
    rec.resolved = true;
    writeOutcomes(list);
    // ข้อ 10: ผลก่อน/หลังขึ้น server ด้วย (usage_events kind="atip") เพื่อการ์ด admin รวมทุกเครื่อง
    try { if (rec.outcome && rec.outcome.improved === true) logUsage("atip", "win"); else if (rec.outcome && rec.outcome.improved === false) logUsage("atip", "loss"); } catch (e) {}
    return true;
  } catch (e) { return false; }
}

/* ข้อ 7 — พฤติกรรมต่อ tip: follow (กดตาม) / dismiss / expire */
export function recordTipAction(action, feature) {
  try {
    const list = readAutoTeachOutcomes();
    const rec = [...list].reverse().find(r => !r.action);
    if (rec) { rec.action = action; if (feature) rec.feature = feature; writeOutcomes(list); }
  } catch (e) { /* best-effort */ }
}
export function actionStats() {
  const list = readAutoTeachOutcomes();
  const followed = list.filter(r => r.action === "follow").length;
  const dismissed = list.filter(r => r.action === "dismiss" || r.action === "expire").length;
  const resolved = list.filter(r => r.resolved && r.outcome);
  const improved = resolved.filter(r => r.outcome.improved === true).length;
  return {
    total: list.length,
    followRate: followed + dismissed ? Math.round((followed / (followed + dismissed)) * 100) : null,
    improvedRate: resolved.length ? Math.round((improved / resolved.length) * 100) : null,
    avgDelta: resolved.length ? Math.round(resolved.reduce((a, r) => a + (r.outcome.delta || 0), 0) / resolved.length) : null,
    followed, dismissed, resolved: resolved.length, improved,
  };
}
