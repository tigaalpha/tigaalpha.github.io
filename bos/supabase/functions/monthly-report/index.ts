import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";

/**
 * Feature #9 — monthly business report. Runs on the 1st of each month
 * (pg_cron, 08:00). Aggregates the previous calendar month from the real
 * ledger/pipeline data and pushes a plain-text summary to the owner on
 * LINE, plus a dashboard notification.
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  if (!secretRow?.value || req.headers.get("x-cron-secret") !== secretRow.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDateStr = monthStart.toISOString().slice(0, 10);
  const endDateStr = monthEnd.toISOString().slice(0, 10);
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(monthStart);

  const [txResult, lessonsResult, leadsResult, wonResult, pendingResult, sourceResult] = await Promise.all([
    admin.from("transactions").select("type, amount, category").gte("transaction_date", startDateStr).lt("transaction_date", endDateStr),
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed").gte("start_time", monthStart.toISOString()).lt("start_time", monthEnd.toISOString()),
    admin.from("customers").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()).lt("created_at", monthEnd.toISOString()),
    admin.from("sales_status_history").select("id", { count: "exact", head: true }).eq("to_status", "won").gte("created_at", monthStart.toISOString()).lt("created_at", monthEnd.toISOString()),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("customers").select("lead_source"),
  ]);
  if (txResult.error) throw txResult.error;
  if (lessonsResult.error) throw lessonsResult.error;
  if (leadsResult.error) throw leadsResult.error;
  if (wonResult.error) throw wonResult.error;
  if (pendingResult.error) throw pendingResult.error;
  if (sourceResult.error) throw sourceResult.error;

  const income = (txResult.data ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = (txResult.data ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const sourceCounts = new Map<string, number>();
  for (const c of sourceResult.data ?? []) {
    const key = (c.lead_source ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `- ${k}: ${v} คน`).join("\n") || "- ไม่มีข้อมูล";

  const lines = [
    `📊 รายงานธุรกิจประจำเดือน ${monthLabel}`,
    ``,
    `💰 รายได้: ${income.toLocaleString("th-TH")} บาท`,
    `💸 รายจ่าย: ${expenses.toLocaleString("th-TH")} บาท`,
    `📈 กำไร: ${(income - expenses).toLocaleString("th-TH")} บาท`,
    ``,
    `🎹 คาบเรียนที่สอนแล้ว: ${lessonsResult.count ?? 0} คาบ`,
    `👥 ลูกค้าใหม่: ${leadsResult.count ?? 0} คน`,
    `🏆 ปิดการขายสำเร็จ (won): ${wonResult.count ?? 0} คน`,
    `⏳ ใบชำระค้าง: ${pendingResult.count ?? 0} ใบ`,
    ``,
    `📍 ช่องทางที่ได้ลูกค้า:`,
    topSources,
  ];

  const text = lines.join("\n");
  const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerRow?.value) {
    try {
      await push(ownerRow.value, text);
    } catch {
      // owner's LINE may be down — dashboard notification below is the record
    }
  }

  await admin.from("notifications").insert({ type: "monthly_report", title: `รายงานประจำเดือน ${monthLabel}`, body: `รายได้ ${income.toLocaleString("th-TH")} บาท · กำไร ${(income - expenses).toLocaleString("th-TH")} บาท · won ${wonResult.count ?? 0}` });

  return jsonResponse({ month: monthLabel, income, expenses, lessons: lessonsResult.count ?? 0, newLeads: leadsResult.count ?? 0, won: wonResult.count ?? 0 });
});
