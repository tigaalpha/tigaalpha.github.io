// Owner Command Center (feature #10) — when the owner's LINE userId sends a
// message that looks like a business command (or starts with "/"), line-webhook
// routes it here instead of the normal chat loop. Every reply is plain text:
// no markdown symbols, no strikethrough, no bullet dashes (same convention as
// cleanReplyText). Returns null when the message is NOT a command, so the
// caller falls back to the normal AI reply path.
//
// Commands (plain Thai, no prefix needed):
//   ยอดขายวันนี้ / ยอดขายสัปดาห์นี้ / ยอดขายเดือนนี้
//   ใครค้างเงิน, ลูกค้าใหม่, คาบเรียนวันนี้, คาบเรียนพรุ่งนี้
//   ออกใบแจ้ง [ชื่อลูกค้า] [จำนวน]      → สร้างใบแจ้งชำระ + ส่ง LINE ให้ลูกค้า
//   ยืนยันเงิน [อ้างอิง]                → ยืนยันว่าได้รับเงินแล้ว (ต้องเช็คแอปธนาคารก่อน)
//   งานวันนี้ / ต้องทำ                  → รายการลูกค้าที่ต้องดูแลตอนนี้
//   อนุมัติค้าง                          → งานที่รออนุมัติ
//   คุณภาพ AI                          → คะแนนคุณภาพคำตอบ AI ล่าสุด
//   ค่าใช้จ่ายเดือนนี้                  → สรุปค่าใช้จ่าย 30 วันล่าสุด

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createPayment, confirmPayment } from "./payments.ts";

const HELP_TEXT = [
  "คำสั่งที่ใช้ได้ ตัวอย่าง:",
  "ยอดขายวันนี้ หรือ ยอดขายสัปดาห์นี้ หรือ ยอดขายเดือนนี้",
  "ใครค้างเงิน (รายการที่ยังไม่ได้ชำระ)",
  "ลูกค้าใหม่ (ที่เพิ่มวันนี้)",
  "คาบเรียนวันนี้ หรือ คาบเรียนพรุ่งนี้",
  "ออกใบแจ้ง [ชื่อลูกค้า] [จำนวน] เช่น ออกใบแจ้ง สมชาย 3000",
  "ยืนยันเงิน [รหัสอ้างอิง] เช่น ยืนยันเงิน PPABC123 (เช็คเงินเข้าธนาคารก่อนนะ)",
  "งานวันนี้ (รายการที่ต้องดูแล)",
  "อนุมัติค้าง (งานที่รออนุมัติ)",
  "คุณภาพ AI (คะแนนความดีของคำตอบ)",
  "ค่าใช้จ่ายเดือนนี้",
  "ถ้าอยากคุยกับระบบแบบทั่วไป พิมพ์คำถามได้เลย",
].join("\n");

function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " บาท";
}

async function businessSummary(admin: SupabaseClient, period: "today" | "week" | "month"): Promise<string> {
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  const start = new Date();
  if (period === "today") start.setHours(0, 0, 0, 0);
  else start.setTime(Date.now() - days * 24 * 60 * 60 * 1000);
  const startISO = start.toISOString();
  const startDateStr = startISO.slice(0, 10);

  const [tx, lessons, leads, won] = await Promise.all([
    admin.from("transactions").select("type, amount").gte("transaction_date", startDateStr),
    admin.from("bookings").select("id", { count: "exact", head: true }).gte("start_time", startISO).neq("status", "cancelled"),
    admin.from("customers").select("id", { count: "exact", head: true }).gte("created_at", startISO),
    admin.from("customers").select("id", { count: "exact", head: true }).gte("updated_at", startISO).in("sales_status", ["won", "renewed"]),
  ]);

  let income = 0;
  let expense = 0;
  for (const t of (tx.data ?? []) as { type: string; amount: number }[]) {
    if (t.type === "income") income += Number(t.amount);
    else if (t.type === "expense") expense += Number(t.amount);
  }

  const label = period === "today" ? "วันนี้" : period === "week" ? "7 วันล่าสุด" : "30 วันล่าสุด";
  return [
    `สรุป ${label}`,
    `รายรับ ${fmtMoney(income)}`,
    `รายจ่าย ${fmtMoney(expense)}`,
    `กำไร ${fmtMoney(income - expense)}`,
    `คาบเรียน ${lessons.count ?? 0} คาบ`,
    `ลูกค้าใหม่ ${leads.count ?? 0} ราย`,
    `ปิดการขาย ${won.count ?? 0} ราย`,
  ].join("\n");
}

async function whoOwes(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from("payments")
    .select("id, amount, reference_code, created_at, customers(name, line_user_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) throw error;

  if (!data || data.length === 0) return "ไม่มีใบแจ้งชำระค้างอยู่ ดีมาก";

  const lines = [`รายการค้างชำระ ${data.length} รายการ:`];
  for (const p of data as { amount: number; reference_code: string; created_at: string; customers?: { name?: string | null } | null }[]) {
    const days = Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000));
    lines.push(`${p.customers?.name ?? "ลูกค้า"} ค้าง ${fmtMoney(Number(p.amount))} (${days} วัน) รหัส ${p.reference_code}`);
  }
  lines.push("เช็คยอดโอนในแอปธนาคาร แล้วพิมพ์ ยืนยันเงิน [รหัส] ได้เลย");
  return lines.join("\n");
}

async function newLeadsToday(admin: SupabaseClient): Promise<string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await admin
    .from("customers")
    .select("name, lead_source")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  if (!data || data.length === 0) return "วันนี้ยังไม่มีลูกค้าใหม่";
  const lines = [`ลูกค้าใหม่วันนี้ ${data.length} ราย:`];
  for (const c of data as { name: string; lead_source?: string | null }[]) {
    lines.push(`${c.name}${c.lead_source ? ` (${c.lead_source})` : ""}`);
  }
  return lines.join("\n");
}

async function lessonsOn(admin: SupabaseClient, dayOffset: number): Promise<string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data } = await admin
    .from("bookings")
    .select("title, start_time, status, customers(name)")
    .gte("start_time", start.toISOString())
    .lt("start_time", end.toISOString())
    .order("start_time", { ascending: true })
    .limit(15);
  if (!data || data.length === 0) return dayOffset === 0 ? "วันนี้ไม่มีคาบเรียน" : "พรุ่งนี้ไม่มีคาบเรียน";
  const lines = [`${dayOffset === 0 ? "คาบเรียนวันนี้" : "คาบเรียนพรุ่งนี้"} ${data.length} คาบ:`];
  for (const b of data as { title: string; start_time: string; status: string; customers?: { name?: string | null } | null }[]) {
    const time = new Date(b.start_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    lines.push(`${time} ${b.customers?.name ?? b.title} (${b.status})`);
  }
  return lines.join("\n");
}

// ออกใบแจ้ง [ชื่อลูกค้า] [จำนวน] — finds the customer by name fragment,
// creates a bank-transfer payment, and pushes the details (QR when
// available) to the customer's LINE automatically. Same createPayment path
// as the Payments page, so it can never drift from the app.
async function createInvoice(admin: SupabaseClient, name: string, amount: number): Promise<string> {
  const { data: customers, error } = await admin
    .from("customers")
    .select("id, name, line_user_id")
    .ilike("name", `%${name}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  if (!customers || customers.length === 0) {
    return `ไม่พบลูกค้าชื่อ "${name}" — ตรวจชื่อในแอปหน้านักเรียนแล้วลองใหม่`;
  }
  if (customers.length > 1) {
    const names = (customers as { name: string }[]).map((c) => c.name).join(", ");
    return `พบลูกค้าหลายคนชื่อใกล้เคียง (${names}) — พิมพ์ชื่อให้ชัดขึ้น หรือระบุชื่อเต็ม`;
  }

  const customer = customers[0] as { id: string; name: string; line_user_id?: string | null };
  if (!customer.line_user_id) {
    return `ลูกค้า ${customer.name} ยังไม่ได้ผูก LINE — สร้างใบแจ้งจากหน้า การชำระเงิน ในแอพแทน แล้วค่อยส่งเอง`;
  }

  const result = await createPayment(admin, { customerId: customer.id, amount, notifyCustomer: true });
  return [
    `สร้างใบแจ้งให้ ${customer.name} แล้ว ${fmtMoney(result.amount)}`,
    `อ้างอิง ${result.referenceCode}`,
    result.notified ? `ส่งรายละเอียดให้ลูกค้าทาง LINE แล้ว` : "ส่ง LINE ให้ลูกค้าไม่สำเร็จ (ลูกค้าอาจบล็อกแชท) — ส่งเองในแอพ",
    `เมื่อลูกค้าโอนแล้ว เช็คเงินเข้า แล้วพิมพ์ ยืนยันเงิน ${result.referenceCode}`,
  ].join("\n");
}

// ยืนยันเงิน [reference] — marks a pending payment paid (owner/admin gate).
// The owner confirms the transfer actually arrived first; this records the
// income transaction, moves the customer to won/renewed, and thanks them on
// LINE.
async function confirmInvoice(admin: SupabaseClient, reference: string): Promise<string> {
  const { data: payment, error } = await admin
    .from("payments")
    .select("id, amount, reference_code, status, customers(name)")
    .ilike("reference_code", `%${reference.toUpperCase()}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  if (!payment || payment.length === 0) {
    return `ไม่พบใบแจ้งชำระรหัส "${reference}" — ลองเช็คที่หน้า การชำระเงิน ก่อน`;
  }
  const pending = (payment as { id: string; status: string }[]).filter((p) => p.status === "pending");
  if (pending.length === 0) return "ใบแจ้งนี้ถูกยืนยันไปแล้ว (หรือไม่มีรายการค้างที่ตรงรหัสนี้)";
  if (pending.length > 1) {
    return `พบหลายใบที่ตรงรหัสนี้ (${pending.length} ใบ) — ระบุรหัสให้ครบถ้วน (เช่น ${(payment as { reference_code: string }[])[0].reference_code})`;
  }

  const result = await confirmPayment(admin, { paymentId: pending[0].id, confirmedBy: null, note: "ยืนยันผ่าน LINE Command Center" });
  const p = result.payment as { amount: number; reference_code: string; customers?: { name?: string | null } | null };
  return `ยืนยันเงิน ${fmtMoney(Number(p.amount))} (${p.reference_code}) ของ ${p.customers?.name ?? "ลูกค้า"} แล้ว บันทึกรายได้และแจ้งลูกค้าทาง LINE เรียบร้อย`;
}

// งานวันนี้ — the same "customers needing attention" list the dashboard
// shows: low remaining hours, quiet leads, trials coming up, pending
// bookings.
async function needingAttention(admin: SupabaseClient): Promise<string> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dayAfterTomorrow = new Date(todayStart);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  const inactiveCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [coursesResult, customersResult, bookingsResult, pendingResult] = await Promise.all([
    admin.from("courses").select("remaining_hour, total_hours, customers(name, sales_status)").gt("remaining_hour", 0).lte("remaining_hour", 3),
    admin.from("customers").select("name, last_contact_at, created_at, sales_status").not("sales_status", "in", "(won,lost)"),
    admin.from("bookings").select("title, start_time, customer_id, is_trial").neq("status", "cancelled").gte("start_time", todayStart.toISOString()).lt("start_time", dayAfterTomorrow.toISOString()),
    admin.from("bookings").select("id, title, start_time").eq("status", "pending").order("start_time", { ascending: true }).limit(5),
  ]);

  const lines: string[] = [];
  const renewals = (coursesResult.data ?? [])
    .filter((c) => {
      const cust = (c as { customers?: { sales_status?: string } | null }).customers;
      return !cust?.sales_status || !["renew_pending", "renewed", "lost"].includes(cust.sales_status ?? "");
    })
    .slice(0, 4);
  if (renewals.length > 0) {
    lines.push(`ชั่วโมงเหลือน้อย: ${(renewals as { customers?: { name?: string } | null; remaining_hour: number }[]).map((c) => `${c.customers?.name ?? "?"} เหลือ ${c.remaining_hour} ชม.`).join(", ")}`);
  }

  const inactive = (customersResult.data ?? [])
    .map((c) => ({ name: c.name, last: c.last_contact_at ?? c.created_at }))
    .filter((c) => c.last < inactiveCutoff)
    .sort((a, b) => (a.last < b.last ? -1 : 1))
    .slice(0, 3);
  if (inactive.length > 0) {
    lines.push(`ลูกค้าเงียบ 7+ วัน: ${inactive.map((c) => c.name).join(", ")}`);
  }

  if ((pendingResult.data?.length ?? 0) > 0) {
    lines.push(`คาบรออนุมัติ ${pendingResult.data?.length} คาบ`);
  }
  const trials = (bookingsResult.data ?? []).filter((b) => b.is_trial).length;
  if (trials > 0) lines.push(`คาบทดลองเร็วๆ นี้ ${trials} คาบ`);

  if (lines.length === 0) return "วันนี้ไม่มีอะไรต้องดูแลเป็นพิเศษ ดีมาก";
  lines.push("ดูรายละเอียดในแอพหน้า Dashboard");
  return lines.join("\n");
}

// อนุมัติค้าง — pending approval requests + CEO agent actions.
async function approvalsQueue(admin: SupabaseClient): Promise<string> {
  const [approvals, actions] = await Promise.all([
    admin.from("approval_requests").select("id, type, reason, created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(10),
    admin.from("agent_actions").select("id, title, priority").eq("status", "pending_approval").order("created_at", { ascending: true }).limit(10),
  ]);

  const lines: string[] = [];
  if ((approvals.data?.length ?? 0) > 0) {
    lines.push(`งานรออนุมัติ ${approvals.data?.length} รายการ:`);
    for (const a of approvals.data as { type: string; reason: string }[]) {
      const label = a.type === "cancel_paid_lesson" ? "ยกเลิกคาบ" : a.type === "bulk_sales_status_change" ? "เปลี่ยนสถานะหลายคน" : a.type === "ad_campaign_spend" ? "งบโฆษณา" : a.type === "ai_drafted_message" ? "ข้อความที่ AI ร่าง" : a.type;
      lines.push(`${label}: ${(a.reason ?? "").slice(0, 80)}`);
    }
  }
  if ((actions.data?.length ?? 0) > 0) {
    lines.push(`CEO Agent เสนอ ${actions.data?.length} รายการ:`);
    for (const a of actions.data as { title: string; priority: string }[]) {
      lines.push(`${a.title} (${a.priority})`);
    }
  }
  if (lines.length === 0) return "ไม่มีงานรออนุมัติ";
  lines.push("กดอนุมัติได้ที่หน้า การอนุมัติ ในแอพ");
  return lines.join("\n");
}

// คุณภาพ AI — average eval score over the last 7 days + count of flagged
// conversations, so the owner can see at a glance whether the AI is
// improving without opening the dashboard.
async function aiQuality(admin: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [evals, flagged] = await Promise.all([
    admin.from("ai_evals").select("score").gte("created_at", since),
    admin.from("conversations").select("id", { count: "exact", head: true }).eq("needs_review", true),
  ]);
  const scores = (evals.data ?? []) as { score: number }[];
  if (scores.length === 0) return "ยังไม่มีคะแนนคุณภาพ AI ใน 7 วันนี้ (ระบบจะประเมินวันละครั้ง)";
  const avg = scores.reduce((s, e) => s + Number(e.score), 0) / scores.length;
  const low = scores.filter((e) => Number(e.score) <= 2).length;
  return [
    `คุณภาพ AI 7 วันล่าสุด: ${avg.toFixed(1)}/5 (ประเมิน ${scores.length} ข้อความ)`,
    `คะแนนต่ำ (≤2) ${low} ข้อความ — AI จะร่างคำตอบแก้ให้อนุมัติใน Knowledge อัตโนมัติ`,
    `แชทที่รอตรวจ ${flagged.count ?? 0} รายการ`,
  ].join("\n");
}

// ค่าใช้จ่ายเดือนนี้ — expense summary for the last 30 days by category.
async function expenseSummary(admin: SupabaseClient): Promise<string> {
  const startDateStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await admin.from("transactions").select("category, amount").eq("type", "expense").gte("transaction_date", startDateStr);
  const byCat = new Map<string, number>();
  let total = 0;
  for (const t of (data ?? []) as { category?: string | null; amount: number }[]) {
    total += Number(t.amount);
    const cat = t.category ?? "อื่นๆ";
    byCat.set(cat, (byCat.get(cat) ?? 0) + Number(t.amount));
  }
  if (total === 0) return "30 วันล่าสุดยังไม่มีค่าใช้จ่ายที่บันทึก";
  const lines = [`ค่าใช้จ่าย 30 วันล่าสุด ${fmtMoney(total)}:`];
  for (const [cat, amt] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${cat} ${fmtMoney(amt)}`);
  }
  return lines.join("\n");
}

/**
 * Returns a plain-text reply if the message is an owner business command,
 * or null if it's a normal chat message.
 */
export async function handleOwnerCommand(admin: SupabaseClient, text: string): Promise<string | null> {
  const t = text.trim();
  if (!t) return null;

  const lower = t.toLowerCase();
  const startsWithSlash = t.startsWith("/");

  if (startsWithSlash || /ยอดขาย|รายได้|รายรับ/.test(lower)) {
    if (startsWithSlash && /^(help|ช่วย|คำสั่ง)/.test(lower.slice(1))) return HELP_TEXT;
    if (/สัปดาห์|7 วัน|week/.test(lower)) return businessSummary(admin, "week");
    if (/เดือน|30 วัน|month/.test(lower)) return businessSummary(admin, "month");
    return businessSummary(admin, "today");
  }
  if (/ค้าง|ทวง|ยังไม่จ่าย|pending/.test(lower)) return whoOwes(admin);
  if (/ลูกค้าใหม่|lead ใหม่|ลีด/.test(lower)) return newLeadsToday(admin);
  if (/คาบเรียนพรุ่งนี้|พรุ่งนี้/.test(lower)) return lessonsOn(admin, 1);
  if (/คาบเรียน|ตารางวันนี้|lesson/.test(lower)) return lessonsOn(admin, 0);
  if (/งานวันนี้|ต้องทำ|สิ่งที่ต้อง/.test(lower)) return needingAttention(admin);
  if (/อนุมัติค้าง|รออนุมัติ/.test(lower)) return approvalsQueue(admin);
  if (/คุณภาพ AI|คะแนน AI|ai quality/.test(lower)) return aiQuality(admin);
  if (/ค่าใช้จ่าย/.test(lower)) return expenseSummary(admin);

  // ออกใบแจ้ง [ชื่อ] [จำนวน]
  const invoiceMatch = t.match(/ออกใบแจ้ง\s+(.+?)\s+([\d,]+)\s*บาท?\s*$/);
  if (invoiceMatch) {
    const name = invoiceMatch[1].trim();
    const amount = Number(invoiceMatch[2].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return "จำนวนเงินไม่ถูกต้อง (ต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท)";
    return createInvoice(admin, name, amount);
  }

  // ยืนยันเงิน [reference]
  const confirmMatch = t.match(/ยืนยันเงิน\s+([A-Za-z0-9]+)/i);
  if (confirmMatch) return confirmInvoice(admin, confirmMatch[1].trim());

  if (startsWithSlash) return HELP_TEXT;

  return null;
}
