import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";
import { computePayroll } from "../_shared/payroll.ts";

/**
 * Feature #10 — teacher payroll. Runs on the 1st of each month (pg_cron,
 * 09:00). For every teacher with a rate in teacher_rates, sums the minutes
 * of completed lessons last month (attendance-confirmed lessons count at
 * full length; declined lessons were never taught) and pushes a summary to
 * the owner on LINE — no more manual spreadsheet math at month end.
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
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(monthStart);

  const { data: rates, error: ratesErr } = await admin
    .from("teacher_rates")
    .select("teacher_id, rate_per_hour, teachers(name)")
    .eq("active", true);
  if (ratesErr) throw ratesErr;

  const entries: { teacherId: string; teacherName: string; ratePerHour: number; minutes: number }[] = [];
  for (const rate of rates ?? []) {
    const teacher = (rate as { teachers?: { name?: string } | null }).teachers;
    const { data: bookings, error: bErr } = await admin
      .from("bookings")
      .select("start_time, end_time")
      .eq("teacher_id", rate.teacher_id)
      .eq("status", "completed")
      .gte("start_time", monthStart.toISOString())
      .lt("start_time", monthEnd.toISOString());
    if (bErr) throw bErr;
    const minutes = (bookings ?? []).reduce((sum, b) => {
      const ms = new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
      return sum + (Number.isFinite(ms) && ms > 0 ? ms / 60000 : 0);
    }, 0);
    entries.push({ teacherId: rate.teacher_id, teacherName: teacher?.name ?? "ครู", ratePerHour: Number(rate.rate_per_hour), minutes });
  }

  const results = computePayroll(entries);
  const total = results.reduce((s, r) => s + r.amount, 0);

  const lines = [`💰 สรุปเงินเดือนครู ประจำเดือน ${monthLabel}`, ``];
  if (results.length === 0) {
    lines.push("- ยังไม่ได้ตั้งอัตราค่าเรียนรายชั่วโมงใน teacher_rates");
  } else {
    for (const r of results) {
      lines.push(`- ${r.teacherName}: ${r.hours} ชม. × ${r.amount / r.hours > 0 ? `${Math.round((r.amount / r.hours) * 100) / 100} บาท/ชม.` : "-"} = ${r.amount.toLocaleString("th-TH")} บาท`);
    }
    lines.push(``, `รวมทั้งสิ้น: ${total.toLocaleString("th-TH")} บาท`);
  }
  const text = lines.join("\n");

  const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerRow?.value) {
    try {
      await push(ownerRow.value, text);
    } catch {
      // owner LINE down — notification below is the record
    }
  }

  await admin.from("notifications").insert({ type: "payroll_report", title: `สรุปเงินเดือนครู ${monthLabel}`, body: `รวม ${total.toLocaleString("th-TH")} บาท (${results.length} ครู)` });

  return jsonResponse({ month: monthLabel, teachers: results.length, total });
});
