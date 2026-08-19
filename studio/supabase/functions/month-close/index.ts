import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { push } from "../_shared/line.ts";

// งาน #3 — AI Financial Controller: "ปิดเดือน" อัตโนมัติ วันที่ 1 ของเดือน
// (08:30 BKK, หลัง monthly-report) — รวม transactions/ใบเสร็จ/เงินเดือนครู/
// VAT/ค้างชำระ เป็น checklist เดียว ตรวจความผิดปกติ (รายการไร้หมวดหมู่, รายได้
// ที่ยังไม่มีใบเสร็จ) บันทึกใน month_closings และส่งสรุปทาง LINE ให้เจ้าของ —
// เจ้าของเหลือแค่ดูสรุป ไม่ต้องนั่งรวมเอง
const VAT_RATE = 0.07;
const WITHHOLDING_RATE = 0.03;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    // เดือนที่จะปิด: ระบุมาได้ (YYYY-MM) หรือ default = เดือนก่อนหน้า
    let month: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.month === "string" && /^\d{4}-\d{2}$/.test(body.month)) month = body.month;
    } catch {
      // no body — fine
    }
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
    }

    const [y, m] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    const endDate = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));

    const [txRes, rcRes, pendingRes, vatRes, ratesRes, lessonsRes] = await Promise.all([
      admin.from("transactions").select("id, type, category, amount").gte("transaction_date", startDate).lt("transaction_date", endDate),
      admin.from("receipts").select("id, amount").gte("issued_at", `${startDate}T00:00:00Z`).lt("issued_at", `${endDate}T00:00:00Z`),
      admin.from("payments").select("id").eq("status", "pending"),
      admin.from("integration_settings").select("value").eq("key", "vat_registered").maybeSingle(),
      admin.from("teacher_rates").select("teacher_id, rate_per_hour").eq("active", true),
      admin.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed").gte("start_time", `${startDate}T00:00:00Z`).lt("start_time", `${endDate}T00:00:00Z`),
    ]);
    if (txRes.error) throw txRes.error;
    if (rcRes.error) throw rcRes.error;
    if (pendingRes.error) throw pendingRes.error;

    const txns = (txRes.data ?? []) as { id: string; type: string; category: string | null; amount: number }[];
    let income = 0;
    let expense = 0;
    let uncategorized = 0;
    const incomeTxIds = new Set<string>();
    for (const t of txns) {
      const amount = Number(t.amount) || 0;
      if (t.type === "income") {
        income += amount;
        incomeTxIds.add(t.id);
      } else if (t.type === "expense") expense += amount;
      if (!t.category || !String(t.category).trim()) uncategorized += 1;
    }

    const receipts = (rcRes.data ?? []) as { id: string; amount: number }[];
    const receiptsTotal = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const pendingCount = (pendingRes.data ?? []).length;

    // เงินเดือนครูจาก completed bookings × rate (เหมือน tax-report)
    let payrollGross = 0;
    let withholding = 0;
    for (const rate of (ratesRes.data ?? []) as { teacher_id: string; rate_per_hour: number }[]) {
      const { data: bookings } = await admin
        .from("bookings")
        .select("start_time, end_time")
        .eq("teacher_id", rate.teacher_id)
        .eq("status", "completed")
        .gte("start_time", `${startDate}T00:00:00Z`)
        .lt("start_time", `${endDate}T00:00:00Z`);
      const minutes = (bookings ?? []).reduce((sum, b) => {
        const ms = new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
        return sum + (Number.isFinite(ms) && ms > 0 ? ms / 60000 : 0);
      }, 0);
      const gross = Math.round((minutes / 60) * Number(rate.rate_per_hour) * 100) / 100;
      if (gross > 0) {
        payrollGross += gross;
        withholding += Math.round(gross * WITHHOLDING_RATE * 100) / 100;
      }
    }

    const vatRegistered = vatRes.data?.value === "true";
    const vatAmount = vatRegistered ? Math.round(income * VAT_RATE * 100) / 100 : 0;
    const profit = Math.round((income - expense) * 100) / 100;

    // checklist + คำเตือน
    const warnings: string[] = [];
    if (uncategorized > 0) warnings.push(`มี ${uncategorized} รายการที่ยังไม่ได้จัดหมวดหมู่ — ไปจัดที่หน้า Accounting ก่อน`);
    const incomeWithReceipt = receiptsTotal > 0 ? true : income === 0;
    if (!incomeWithReceipt) warnings.push("รายได้บางส่วนยังไม่มีใบเสร็จ — ตรวจ receipt-drive-sync ทำงานครบไหม");
    if (pendingCount > 0) warnings.push(`ค้างชำระ ${pendingCount} ใบ — ทวงตามขั้นบันไดในงาน Guardian`);

    const checklist = [
      { item: "รายได้", status: "ok", detail: `${Math.round(income).toLocaleString("th-TH")} บาท` },
      { item: "รายจ่าย", status: "ok", detail: `${Math.round(expense).toLocaleString("th-TH")} บาท` },
      { item: "กำไร", status: profit >= 0 ? "ok" : "warning", detail: `${Math.round(profit).toLocaleString("th-TH")} บาท` },
      { item: "หมวดหมู่ครบ", status: uncategorized === 0 ? "ok" : "warning", detail: uncategorized === 0 ? "ครบ" : `ขาด ${uncategorized}` },
      { item: "ใบเสร็จ", status: incomeWithReceipt ? "ok" : "warning", detail: `${receipts.length} ใบ รวม ${Math.round(receiptsTotal).toLocaleString("th-TH")} บาท` },
      { item: "เงินเดือนครู", status: "ok", detail: `${Math.round(payrollGross).toLocaleString("th-TH")} บาท (หัก ณ ที่จ่าย ${Math.round(withholding).toLocaleString("th-TH")})` },
      { item: "VAT", status: vatRegistered ? "ok" : "skip", detail: vatRegistered ? `${Math.round(vatAmount).toLocaleString("th-TH")} บาท` : "ไม่ได้ลงทะเบียน" },
      { item: "ค้างชำระ", status: pendingCount === 0 ? "ok" : "warning", detail: pendingCount === 0 ? "ไม่มี" : `${pendingCount} ใบ` },
      { item: "คาบเรียน", status: "ok", detail: `${lessonsRes.count ?? 0} คาบ` },
    ];

    // บันทึกการปิดเดือน (idempotent ต่อเดือน)
    await admin.from("month_closings").upsert(
      {
        month,
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        profit,
        receipts_count: receipts.length,
        payroll_gross: Math.round(payrollGross * 100) / 100,
        vat_amount: vatAmount,
        pending_payments: pendingCount,
        warnings,
      },
      { onConflict: "month" }
    );

    // สรุปทาง LINE
    const lines: string[] = [];
    lines.push(`📊 ปิดเดือน ${monthLabel}`);
    lines.push(`รายได้ ${Math.round(income).toLocaleString("th-TH")} · ค่าใช้จ่าย ${Math.round(expense).toLocaleString("th-TH")} · กำไร ${Math.round(profit).toLocaleString("th-TH")} บาท`);
    lines.push(`ใบเสร็จ ${receipts.length} ใบ · เงินเดือนครู ${Math.round(payrollGross).toLocaleString("th-TH")} · คาบเรียน ${lessonsRes.count ?? 0}`);
    if (warnings.length > 0) {
      lines.push("");
      lines.push("⚠️ ต้องจัดการ:");
      for (const w of warnings) lines.push(`  • ${w}`);
    } else {
      lines.push("");
      lines.push("✅ ทุกอย่างครบ — เดือนนี้ปิดได้เลย");
    }
    const text = lines.join("\n");

    const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    if (ownerRow?.value) {
      try {
        await push(ownerRow.value, text);
      } catch {
        // dashboard notification below is the record
      }
    }
    await admin.from("notifications").insert({
      type: "monthly_report",
      title: `ปิดเดือน ${monthLabel}`,
      body: `รายได้ ${Math.round(income).toLocaleString("th-TH")} · กำไร ${Math.round(profit).toLocaleString("th-TH")} · ${warnings.length > 0 ? `${warnings.length} รายการต้องจัดการ` : "ครบถ้วน ✅"}`,
    });

    return jsonResponse({ month, income, expense, profit, checklist, warnings, payrollGross, vatAmount, pendingCount });
  } catch (error) {
    console.error("month-close failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }, 500);
  }
});
