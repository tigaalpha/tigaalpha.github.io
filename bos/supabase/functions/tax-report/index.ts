import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

// Feature #3 — Thai tax automation. Reads transactions (income/expense) and
// teacher payroll for a month and computes what the owner needs for filing:
// VAT 7% on income (only when vat_registered is on), 3% withholding on
// teacher payments (PND 3), gross income for PND 90. The UI renders this and
// exports a CSV. Numbers are a filing aid — the owner still files.
const WITHHOLDING_RATE = 0.03; // services from individuals, PND 3
const VAT_RATE = 0.07;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireOwnerOrAdmin(admin, req);
    const { month } = await req.json();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return jsonResponse({ error: "month must be YYYY-MM" }, 400);

    const [y, m] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    const endDate = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

    const [txRes, vatRes, ratesRes] = await Promise.all([
      admin.from("transactions").select("type, category, amount, transaction_date").gte("transaction_date", startDate).lt("transaction_date", endDate),
      admin.from("integration_settings").select("value").eq("key", "vat_registered").maybeSingle(),
      admin.from("teacher_rates").select("teacher_id, rate_per_hour, teachers(name)").eq("active", true),
    ]);
    if (txRes.error) throw txRes.error;

    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, { income: number; expense: number }>();
    for (const t of (txRes.data ?? []) as { type: string; category: string; amount: number }[]) {
      const amount = Number(t.amount) || 0;
      if (t.type === "income") income += amount;
      else if (t.type === "expense") expense += amount;
      const cat = byCategory.get(t.category) ?? { income: 0, expense: 0 };
      if (t.type === "income") cat.income += amount;
      else if (t.type === "expense") cat.expense += amount;
      byCategory.set(t.category, cat);
    }

    // Teacher payroll for the month: completed bookings × rate.
    const payrollEntries: { teacherId: string; teacherName: string; gross: number; withholding: number }[] = [];
    for (const rate of (ratesRes.data ?? []) as { teacher_id: string; rate_per_hour: number; teachers?: { name?: string } | null }[]) {
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
      const hours = Math.round((minutes / 60) * 100) / 100;
      const gross = Math.round(hours * Number(rate.rate_per_hour) * 100) / 100;
      if (gross > 0) {
        payrollEntries.push({
          teacherId: rate.teacher_id,
          teacherName: rate.teachers?.name ?? "ครู",
          gross,
          withholding: Math.round(gross * WITHHOLDING_RATE * 100) / 100,
        });
      }
    }
    const teacherPayroll = payrollEntries.reduce((s, e) => s + e.gross, 0);
    const totalWithholding = payrollEntries.reduce((s, e) => s + e.withholding, 0);

    const vatRegistered = vatRes.data?.value === "true";
    const vatAmount = vatRegistered ? Math.round(income * VAT_RATE * 100) / 100 : 0;

    const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));

    return jsonResponse({
      month,
      monthLabel,
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      profit: Math.round((income - expense) * 100) / 100,
      vatRegistered,
      vatAmount,
      withholdingRate: WITHHOLDING_RATE,
      teacherPayroll: Math.round(teacherPayroll * 100) / 100,
      totalWithholding,
      payrollEntries,
      byCategory: Object.fromEntries(byCategory),
      generatedBy: userId,
      disclaimer: "ตัวเลขนี้เป็นข้อมูลช่วยยื่นภาษี — ยังต้องตรวจกับเอกสารจริงและยื่นผ่านระบบสรรพากรเอง",
    });
  } catch (error) {
    return await handleUnexpectedError(admin, "tax-report", error);
  }
});
