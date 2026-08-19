// Single source of truth for the TIGA AI AGENT's record_transaction tool.
// Deno can't read repo files outside supabase/functions at runtime, so this
// can't just import features/accounting/categories.ts directly (same reason
// prompts.ts embeds its content instead of importing .md files) — but unlike
// the old inline consts in tools.ts, this file has zero Deno-specific syntax,
// so lib/category-sync.test.ts can import it straight into a Node/vitest run
// and assert it stays byte-for-byte identical to the frontend's copy.
export const INCOME_CATEGORIES = ["ค่าเรียนเปียโน/ดนตรี", "ขายคอร์สออนไลน์", "รายได้อื่นๆ"];
export const EXPENSE_CATEGORIES = [
  "ค่าเช่าสถานที่", "เงินเดือนครู/พนักงาน", "ค่าน้ำค่าไฟ", "การตลาด/โฆษณา",
  "อุปกรณ์/เครื่องดนตรี", "ค่าซอฟต์แวร์/สมาชิก", "ค่าใช้จ่ายอื่นๆ",
];
export const PAYMENT_METHODS = ["เงินสด", "โอนเงิน", "บัตรเครดิต", "อื่นๆ"];
