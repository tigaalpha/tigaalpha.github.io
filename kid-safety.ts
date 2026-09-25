/* ── Kid-Safety Gate (Gem plan v4 §3, items 3 — M1+M2+M3) ─────────────────
   ผู้ใช้หลักของแอปคือเด็กเรียนเปียโน แต่ร้าน Gems/Coins ยังไม่มีกลไกคุมการใช้จ่าย
   แม้แต่ตัวเดียว (ตรวจแล้ว: ไม่มี parentPin/spendCap ใน repo ก่อนไฟล์นี้)
   แผน v4 กำหนดให้เบรกนี้ต้องพร้อมก่อนเปิดขาย consumable หมุนเวียน และก่อน
   ทุก popup กระตุ้นการซื้อ (kill list §12: ห้ามกระตุ้นซื้อเด็กนอกเบรก §3)

   M1 โหมดผู้ปกครอง + PIN 4 หลัก:
     • ตั้ง PIN ครั้งแรกเมื่อซื้อครั้งแรกเท่านั้น (ไม่บังคับตั้งก่อน — กัน friction
       ตอนยังไม่มีเด็กจ่าย) — หลังจากตั้งแล้ว การซื้อทุกครั้ง > PIN_THRESHOLD_THB
       ต้องใส่ PIN ก่อน เด็กจึงกดเองเกินเพดานไม่ได้
     • เก็บใน localStorage ต่ออุปกรณ์ (hash แบบ SHA-256 + salt คงที่ — ไม่เก็บ
       PIN ตรง ๆ เพื่อไม่ให้อ่านออกจาก devtools ตรง ๆ) และผูกกับ uid ของบัญชี
       ผู้ซื้อ เพื่อไม่ให้ PIN ข้ามบัญชี พร้อมกันลืมด้วยรหัส admin (OWNER code)
   M2 เพดานรายเดือน (default 500฿ แก้ได้ 100–2000฿, เฉพาะด้วย PIN):
     • นับ "ยอดจ่ายจริงเดือนนี้" จาก usage event ฝั่ง client ที่เขียนตอนกดซื้อ
       (`spend:approved:...`) — สาย slip เข้าหลังอนุมัติ อาจต่างจากวันกดซื้อ
       1-2 วัน ซึ่งยอมรับได้สำหรับเบรกหน้าร้าน (แผนกำหนดให้ฝั่ง edge function
       ตรวจซ้ำ server-side ก่อนสร้าง pending row เป็นขั้นถัดไป — ยังไม่ทำใน
       รอบนี้ ไม่มี SQL/edge ใหม่) — ใช้เป็นตัว lock ปุ่มซื้อ + ข้อความ
       "ครบโควตาเดือนนี้ ผู้ปกครองปรับได้"
   M3 ประวัติการซื้อให้ผู้ปกครองเห็น:
     • แท็บ "การซื้อของลูก" ในหน้า Profile — ดึงจากตาราง `payments`
       (kind='currency') ที่มีอยู่แล้ว ไม่แตะ schema แถมสรุปยอดเดือนนี้
       เทียบเพดาน ─────────────────────────────────────────────────────── */

export const PIN_THRESHOLD_THB = 99;     // ซื้อ > 99฿ ต้องใส่ PIN (เหนือขั้นต่ำสุด 59฿)
export const SPEND_CAP_DEFAULT = 500;    // ฿/เดือน
export const SPEND_CAP_MIN = 100;
export const SPEND_CAP_MAX = 2000;

const LS_PIN = "tg_parent_pin";          // value = JSON {uid, salt, hash}
const LS_CAP = "tg_parent_cap";          // value = number ฿/เดือน
const LS_SPEND = "tg_spend_month";       // value = JSON {month: "YYYY-MM", total: ฿}

/* SHA-256 ผ่าน WebCrypto ทุก browser ปัจจุบัน (แอปรัน https + Capacitor WebView) */
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function pinHash(pin, salt) { return sha256Hex("tiga-kid-safety:" + salt + ":" + pin); }

function readJSON(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function writeLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
function delLS(key) { try { localStorage.removeItem(key); } catch (e) {} }

/* ── M1: PIN lifecycle ────────────────────────────────────────────────── */
export function hasParentPin(uid) { const p = readJSON(LS_PIN); return !!(p && p.hash && (!uid || p.uid === uid)); }

export async function setParentPin(uid, pin) {
  const salt = (crypto.getRandomValues(new Uint8Array(8))[0] + Date.now().toString(36)).slice(0, 12);
  writeLS(LS_PIN, { uid: uid || "", salt, hash: await pinHash(String(pin), salt) });
}

export async function verifyParentPin(uid, pin) {
  const p = readJSON(LS_PIN);
  if (!p || !p.hash) return false;
  if (uid && p.uid && p.uid !== uid) return false;
  return (await pinHash(String(pin), p.salt)) === p.hash;
}

export function clearParentPin() { delLS(LS_PIN); }

/* ── M2: monthly cap ──────────────────────────────────────────────────── */
export function getMonthKey(d) {
  const t = d || new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0");
}
export function getSpendCap() {
  try { const v = parseInt(localStorage.getItem(LS_CAP), 10); if (v >= SPEND_CAP_MIN && v <= SPEND_CAP_MAX) return v; } catch (e) {}
  return SPEND_CAP_DEFAULT;
}
/* เขียนได้เฉพาะหลัง verify PIN แล้ว — caller รับผิดชอบการ verify */
export function setSpendCap(thb) {
  const v = Math.max(SPEND_CAP_MIN, Math.min(SPEND_CAP_MAX, Math.round(Number(thb) || 0)));
  try { localStorage.setItem(LS_CAP, String(v)); } catch (e) {}
  return v;
}
/* ยอดจ่ายเดือนนี้ — นับจาก event ที่ logUsage เขียนตอนซื้อสำเร็จ */
export function getMonthSpend() {
  const s = readJSON(LS_SPEND);
  if (!s || s.month !== getMonthKey()) return 0;
  return Math.max(0, Number(s.total) || 0);
}
/* เรียกตอน "ซื้อสำเร็จ" เท่านั้น (สลิปอนุมัติ / บัตรชำระผ่าน) — ไม่ใช่ตอนกด */
export function recordSpend(thb) {
  const n = Math.max(0, Math.round(Number(thb) || 0));
  if (!n) return getMonthSpend();
  const mk = getMonthKey();
  const s = readJSON(LS_SPEND);
  writeLS(LS_SPEND, { month: mk, total: (s && s.month === mk ? Math.max(0, Number(s.total) || 0) : 0) + n });
  return getMonthSpend();
}
export function isOverCap(spend, cap) { return (spend || 0) >= (cap || 0); }

/* ── M3: purchase history (server truth) ─────────────────────────────── */
/* ดึงจากตาราง payments ที่มีอยู่แล้ว — RLS ฝั่ง server เป็นตัวกำหนดว่าเห็นแถวไหน
   ได้ (ถ้าตารางปิด RLS ต่อ user จะได้ [] และ UI จะแสดง "ยังไม่มีประวัติ")
   ตัว fetch เดียวกับที่ supabase-client ป้อนเข้ามาตอนบูต (_installSbFetch ด้านล่าง) */
let _sbFetch = null;
export function fetchPurchaseHistory(uid, limit = 50) {
  if (!uid || !_sbFetch) return Promise.resolve({ data: [], error: null });
  return _sbFetch(uid, limit);
}
/* injected จาก supabase-client.ts เพื่อไม่ให้ไฟล์นี้ import sb กลับ (กัน dependency วน) */
export function _installSbFetch(fn) { _sbFetch = fn; }
