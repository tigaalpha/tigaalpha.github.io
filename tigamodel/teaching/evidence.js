/* ── tigamodel/teaching/evidence.js — plan v3 ระลอก 7 (7.1/7.2) — LEARNER
   EVIDENCE v1. หลักฐานจากผู้เรียนจริง, รวมแบบ local ไม่แตะ network.

   แหล่งข้อมูล: tg_atip_outcomes (use-autoteach.ts เขียนจากวงจรปิดเดิม —
   openAdvice จดสถานะจุดอ่อน "ก่อน", recordTipOutcome เทียบผลซ้อมถัดไป "หลัก")
   แต่ละแถวที่ใช้ได้มีรูป: { strategyId, topic?, before:[{label,acc}],
   resolved:true, outcome:{ delta, improved, after } } — นี่คือคู่
   accuracy before/after ต่อ strategy_id ตามข้อความของ 7.1 (practice log
   เองไม่ผูกกลยุทธ์ — วงจร atip คือสิ่งที่ผูกให้อยู่แล้ว)

   กติกา 7.2 ที่ต้องไม่แตก:
   • รวม "ต่อกลยุทธ์" เท่านั้น — แถวไม่มี strategy_id นับเป็น unattributed
     (รายงานจำนวนจริง ไม่เดาให้), ห้ามเอาไปกองรวมกับกลยุทธ์อื่น
   • n < 30 = "หลักฐานไม่พอ" (enough:false) — โชว์ตัวเลขได้แต่ต้องติดธง
     และผู้อ่านต้องเห็นว่ายังตัดสินไม่ได้
   • honest-null: ไม่มีแถวจริง = null ทั้ง object — ห้ามสร้างศูนย์แต่ง
   • delta ที่ไม่ใช่ตัวเลข (ผลลอย) ห้ามเข้า meanDelta แต่ยังนับใน n
   • โมดูลนี้ PURE + SYNC: อ่านจาก array ที่ caller ส่งเข้ามาเท่านั้น
     (ห้ามอ่าน localStorage เอง — smoke/bench/Lab จะได้ทดสอบเส้นเดียวกัน)

   ผู้บริโภค: web.js strategyEvidenceFromRows() → Model Lab scoreboard 7.2
   (แท็บใหม่) → และเป็นฐานของ 7.3 (workOrder ถ่วงหลักฐาน) กับ 9.4
   (provenance) ตามแผน ── */

export const STRATEGY_EVIDENCE_MIN_N = 30;

function isRow(r) {
  return !!(r && typeof r === "object" && r.resolved === true && r.outcome && typeof r.outcome === "object" && typeof r.strategyId === "string" && r.strategyId.length > 0);
}

/* after-accuracy of one row: outcome.after เมื่อมีจริง, ไม่งั้น before.acc +
   delta (recordTipOutcome กรณี "หายจากจุดอ่อน" ให้ after=null delta=100 —
   ที่มาเดียวที่ delta=100 ถูกต้อง) — ไม่คำนวณได้ = null ห้ามเดา */
function afterAcc(r) {
  const o = r.outcome || {};
  if (typeof o.after === "number" && isFinite(o.after)) return o.after;
  const d = o.delta;
  if (typeof d === "number" && isFinite(d) && Array.isArray(r.before)) {
    const b = r.before.find(x => x && x.label === r.topic) || r.before[0];
    if (b && typeof b.acc === "number" && isFinite(b.acc)) return b.acc + d;
  }
  return null;
}

/* 7.1 — aggregate rows → per-strategy evidence. Returns
   { strategies:[{strategyId,n,improved,worse,flat,winRate,meanAfter,meanDelta,
     enough,enoughNote}], unattributed, total, strategiesWithEvidence,
     strategiesDecidable } sorted by n desc, or null when nothing real exists.
   enoughNote มี 3 ภาษาเหมือนทุก surface ของโมเดล. */
export function strategyEvidence(rows) {
  try {
    if (!Array.isArray(rows)) return null;
    const byId = new Map();
    let unattributed = 0;
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      if (!isRow(r)) continue;
      const id = r.strategyId;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(r);
    }
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      if (r.resolved === true && r.outcome && typeof r.outcome === "object" && !(typeof r.strategyId === "string" && r.strategyId.length > 0)) unattributed++;
    }
    if (!byId.size && !unattributed) return null;
    const min = STRATEGY_EVIDENCE_MIN_N;
    const note = (n) => ({
      th: `หลักฐานยังไม่พอ (${n}/${min} รอบจริง) — ดูได้ ยังตัดสินไม่ได้`,
      en: `Not enough evidence (${n}/${min} real rounds) — viewable, not yet decidable`,
      zh: `证据不足（${n}/${min}次真实记录）——可查看，还不能据此决策`,
    });
    const strategies = [];
    for (const [strategyId, list] of byId) {
      const n = list.length;
      let improved = 0, worse = 0, flat = 0;
      let deltaSum = 0, deltaN = 0, afterSum = 0, afterN = 0;
      for (const r of list) {
        const imp = r.outcome.improved;
        if (imp === true) improved++;
        else if (imp === false) worse++;
        else flat++;
        const d = r.outcome.delta;
        if (typeof d === "number" && isFinite(d)) { deltaSum += d; deltaN++; }
        const a = afterAcc(r);
        if (a != null) { afterSum += a; afterN++; }
      }
      const enough = n >= min;
      strategies.push({
        strategyId,
        n,
        improved, worse, flat,
        winRate: n ? Math.round((improved / n) * 1000) / 1000 : null,
        meanAfter: afterN ? Math.round((afterSum / afterN) * 10) / 10 : null,
        meanDelta: deltaN ? Math.round((deltaSum / deltaN) * 10) / 10 : null,
        enough,
        enoughNote: enough ? null : note(n),
      });
    }
    strategies.sort((a, b) => b.n - a.n || (b.winRate || 0) - (a.winRate || 0) || String(a.strategyId).localeCompare(String(b.strategyId)));
    const out = {
      strategies,
      unattributed,
      total: strategies.reduce((s, x) => s + x.n, 0),
      strategiesWithEvidence: strategies.filter(x => x.n > 0).length,
      strategiesDecidable: strategies.filter(x => x.enough).length,
      minN: min,
    };
    if (!out.total && !out.unattributed) return null;
    return out;
  } catch (e) { return null; }
}
