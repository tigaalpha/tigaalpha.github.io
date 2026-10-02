/* ── learning-session-gate.ts — "do we still try to write?" ในรูปที่ทดสอบได้
   เหตุผลที่มีไฟล์นี้ขึ้นมา (หลักฐานจาก live DB + จากโค้ด):

   ก่อนหน้านี้ learning-data.ts ถามว่า "ล็อกอินอยู่ไหม" ด้วย `sb.auth._sessionReady()`.
   ฟังก์ชันนั้นไม่มีอยู่จริงใน @supabase/supabase-js 2.x (ยืนยันแล้ว: grep ไม่เจอใน
   auth-js/supabase-js ที่ติดตั้ง) → `_sessionReady` เป็น undefined → นิพจน์หลัง &&
   เป็น falsy → ฟังก์ชันคืน false "ไม่ได้ล็อกอิน" **เสมอ** แม้ผู้เรียนล็อกอินจริง

   ผลคือ: learning_start_session ไม่มีเช็ค signedIn() → session ถูกสร้าง (160 แถว
   บน live) แต่ learning_observe / learning_diagnose / learning_intervene /
   learning_practice มีเช็ค → return null ก่อนออกไปเรียก RPC → ตารางหลังหมด
   เป็น 0 แถวมาเป็นเดือน โดยไม่มี error ที่เห็นได้ (การกลืน error เป็นการออกแบบ
   §20 "never crash teaching" — ซึ่งถูกต้อง แต่ต้องไม่กลืนความจริงว่า "ไม่มีข้อมูล")

   กติกาที่ต้องยึด (เรียงตามความปลอดภัย):
   - "ยังไม่รู้" (undefined) → ลองเขียน — ปล่อยให้ RLS ของเซิร์ฟเวอร์ตัดสิน
     (นี่คือประตูจริงตามที่โปรเจกต์ออกแบบไว้ ไม่ใช่การเดาในเครื่อง)
   - "รู้แล้วว่าไม่ได้ล็อกอิน" (null) → ไม่เขียน และทิ้งคิวที่ค้างไว้ มิฉะนั้นคิวจะ
     เต็ม 300 รายการจากผู้ใช้ที่ไม่มีสิทธิ์เขียนอยู่แล้ว
   - มี user id → เขียน ── */

/* state: undefined = ยังไม่รู้ · null = รู้แล้วว่าไม่ได้ล็อกอิน · string = user id */
export type SessionUser = string | null | undefined;

/** true = ควรลองเขียน trace ต่อไป (ปล่อยให้ RLS/เซิร์ฟเวอร์ตัดสินเป็นประตูจริง) */
export function shouldAttemptWrite(user: SessionUser): boolean {
  return user !== null;
}

/** true = ผู้ใช้คนนี้ยืนยันแล้วว่าไม่ได้ล็อกอิน → ทิ้งคิวที่ค้าง (ไม่ใช่รอ retry) */
export function shouldDropQueue(user: SessionUser): boolean {
  return user === null;
}

/** อ่าน user id จากผลของ sb.auth.getSession() ให้เป็นรูปแบบเดียวกัน (null = ไม่ได้ล็อกอิน) */
export function userFromSession(session: unknown): SessionUser {
  try {
    const s = session as { user?: { id?: unknown } } | null;
    const id = s && s.user && typeof s.user.id === "string" ? s.user.id : "";
    return id || null;
  } catch (e) { return null; }
}