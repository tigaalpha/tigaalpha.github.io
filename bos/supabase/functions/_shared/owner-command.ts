// Owner Command Center (feature #10) — when the owner's LINE userId sends a
// message that looks like a business command (or starts with "/"), line-webhook
// routes it here instead of the normal chat loop. Every reply is plain text:
// no markdown symbols, no strikethrough, no bullet dashes (same convention as
// cleanReplyText). Returns null when the message is NOT a command, so the
// caller falls back to the normal AI reply path.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const HELP_TEXT = [
  "คำสั่งที่ใช้ได้ ตัวอย่าง:",
  "ยอดขายวันนี้ หรือ ยอดขายสัปดาห์นี้ หรือ ยอดขายเดือนนี้",
  "ใครค้างเงิน (รายการที่ยังไม่ได้ชำระ)",
  "ลูกค้าใหม่ (ที่เพิ่มวันนี้)",
  "คาบเรียนวันนี้",
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
    lines.push(`${p.customers?.name ?? "ลูกค้า"} ค้าง ${fmtMoney(Number(p.amount))} (${days} วัน)`);
  }
  lines.push("ดูรายละเอียดได้ในแอป หน้าการชำระเงิน");
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

async function lessonsToday(admin: SupabaseClient): Promise<string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data } = await admin
    .from("bookings")
    .select("title, start_time, status, customers(name)")
    .gte("start_time", start.toISOString())
    .lt("start_time", end.toISOString())
    .order("start_time", { ascending: true })
    .limit(15);
  if (!data || data.length === 0) return "วันนี้ไม่มีคาบเรียน";
  const lines = [`คาบเรียนวันนี้ ${data.length} คาบ:`];
  for (const b of data as { title: string; start_time: string; status: string; customers?: { name?: string | null } | null }[]) {
    const time = new Date(b.start_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    lines.push(`${time} ${b.customers?.name ?? b.title} (${b.status})`);
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
  if (/คาบเรียน|ตารางวันนี้|lesson/.test(lower)) return lessonsToday(admin);
  if (startsWithSlash) return HELP_TEXT;

  return null;
}
