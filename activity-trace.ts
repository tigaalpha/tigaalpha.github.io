/* ── activity-trace.ts — ทำให้ "ทุกอย่างที่ซ้อม" กลายเป็นหลักฐานหนึ่งรอบ (แผน 18) ──
   P0 แก้ประตูแล้ว แต่ยังมีรูรั่วอีกอัน: ตาราง learning_* รับ trace จาก
   practice-mode เท่านั้น (learning-data.recordPracticeResult ผูกกับ event
   "tiga:practice-done") — การซ้อมโหมดอื่น (ear gym / อ่านโน้ต / drill) ไม่เคย
   เขียนอะไรลงเซิร์ฟเวอร์เลย แม้ผู้เรียนจะซ้อมจริงทุกวัน กล่าวคือ "ไม่มีข้อมูล = ไม่มีครู"
   ยังเป็นจริงในอีกทางหนึ่ง

   ไฟล์นี้ทำสองอย่างเท่านั้น และ pure ทั้งคู่:
   1) shouldTraceActEntry(entry, state) — ตัดสินใจ "แถวนี้ควรเป็น trace ไหม"
      พร้อมเกณฑ์กันปริมาณที่เขียนไว้ (ดู TRACE_MIN_*)
   2) actEntryToTrace(entry) — แปลงแถว act log เป็น payload ของ learning_*
   ไม่มี localStorage, ไม่มี network — ผู้เรียน state เข้ามาเป็น argument คืนค่ากลับ
   จึงทดสอบด้วย fixture ได้ (tigamodel/scripts/smoke-activity-trace.mjs) */

/* เกณฑ์กันปริมาณ — เหตุผลที่ต้องมี ไม่ใช่เลือกเฉย ๆ:
   • แถว act log มีได้ถึง 1,500 แถว แต่ "หนึ่งรอบซ้อม" ที่ครูต้องเข้าใจคือหนึ่งแถว
     ที่มีตัวเลขพอ (≥ TRACE_MIN_ATTEMPTS ครั้ง) ไม่ใช่ทุกการแตะปุ่ม
   • หนึ่งทักษะต่อวัน: ถ้าเขียนทุกแถวของ ear/chord วันเดียวกัน เราจะได้ 40 observation
     ของสิ่งเดียวกันและ "นับเรียน" ได้เกินจริง — เก็บไว้แถวล่าสุดของวันแทน
   • ปิดไว้เป็นค่าเริ่มต้นตามกติกาความซื่อสัตย์ของโปรเจกต์นี้: ต่อไปนี้คือพฤติกรม
     ใหม่ (มีแถวในตารางที่ก่อนหน้านี้ไม่เคยมี) เจ้าของจึงเป็นคนเปิด ไม่ใช่โค้ด */
export const TRACE_MIN_ATTEMPTS = 5;   // ต่ำกว่านี้คือการแตะเล่น ไม่ใช่รอบซ้อม
export const TRACE_MAX_PER_DAY = 8;    // เพดานต่อวันต่อทั้งเครื่อง (เกิน = ทิ้ง ไม่ยัด)
export const TRACE_KINDS = ["ear", "read", "drill"];

/* state = { day, sent } — { day: "YYYY-MM-DD", sent: { "<kind>|<id>": n } }
   ผู้เรียนเข้ามา (เรียกจาก learning-data ซึ่งอ่าน localStorage) เพื่อให้ตัวนี้ไม่แตะ
   storage เอง — ทำให้ทดสอบได้จริงโดยไม่ต้องหลอก DOM */
export function shouldTraceActEntry(entry, state, now = Date.now()) {
  if (!entry || !TRACE_KINDS.includes(entry.k)) return { ok: false, why: "kind" };
  const n = (entry.ok || 0) + (entry.miss || 0);
  if (n < TRACE_MIN_ATTEMPTS) return { ok: false, why: "too-few" };
  /* เฉพาะของ "วันนี้" เท่านั้นที่นับ — state ของเมื่อวานต้องไม่มาปิดปัจจุบัน
     (มิฉะนั้นผู้เรียนที่ซ้อมเมื่อวานแล้วเงียบไปตลอดวันนี้) */
  const today = new Date(now).toISOString().slice(0, 10);
  const sent = (state && state.day === today && state.sent) ? state.sent : {};
  const used = Object.keys(sent).reduce((a, k) => a + (Number(sent[k]) || 0), 0);
  if (used >= TRACE_MAX_PER_DAY) return { ok: false, why: "day-cap" };
  const key = entry.k + "|" + entry.id;
  // one per skill per day — the LAST one of the day wins (bumpTraceState keeps the newest)
  if (sent[key]) return { ok: false, why: "already-today" };
  return { ok: true, why: "new", key };
}

/* คืน state ใหม่ (pure — ไม่แก้ของเดิม) พร้อมจำนวนที่ส่งวันนี้ */
export function bumpTraceState(state, key, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const prev = state && state.day === day ? (state.sent || {}) : {};
  return { day, sent: { ...prev, [key]: (Number(prev[key]) || 0) + 1 } };
}
export function traceDayCount(state) {
  if (!state || !state.sent) return 0;
  return Object.keys(state.sent).reduce((a, k) => a + (Number(state.sent[k]) || 0), 0);
}

/* แถว act log → ข้อมูลของ learning_* (ข้อเท็จจริงล้วน: ไม่มีการตัดสินใจใด ๆ)
   §2 says observations are FACTS the system detected — this is exactly that:
   the counts the engine measured, never an opinion about the learner. */
export function actEntryToTrace(entry, label) {
  if (!entry) return null;
  const ok = Math.max(0, Math.round(entry.ok || 0));
  const miss = Math.max(0, Math.round(entry.miss || 0));
  const total = ok + miss;
  if (total < 1) return null;
  const acc = Math.round((ok / total) * 100);
  const metric = entry.skill || (entry.k === "ear" ? "ear_training" : entry.k === "read" ? "sight_reading" : "note_accuracy");
  return {
    source_kind: entry.k,
    source_id: String(entry.id || ""),
    label: typeof label === "string" ? label : String(entry.id || ""),
    skill: metric,
    attempts: total,
    misses: miss,
    seconds: Math.max(0, Math.round(entry.sec || 0)),
    accuracy: acc,
  };
}