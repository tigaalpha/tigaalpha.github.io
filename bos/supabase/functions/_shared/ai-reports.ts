import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate } from "./ai-provider.ts";
import { PROMPTS } from "./prompts.ts";
import { requestApproval } from "./approvals.ts";
import { logAiUsage } from "./usage-logging.ts";
import { sumTransactions, countByStatus } from "./business-metrics.ts";

// The one shared "AI does an analysis/drafting job" primitive for Level 3
// (see the "AI Workforce" plan) -- every report_type here follows the same
// shape: pull real CRM data with plain .from() queries (same style as
// every repository in this codebase), hand it to generate() as JSON
// alongside a fixed prompt from prompts.ts, log token usage, store the
// result in ai_reports. Adding a future report is a new case here + a new
// prompt, not a new subsystem.

async function saveReport(
  admin: SupabaseClient,
  params: { reportType: string; entityType?: string; entityId?: string; title: string; content: string; data: Record<string, unknown> }
): Promise<{ id: string; content: string }> {
  const { data, error } = await admin
    .from("ai_reports")
    .insert({
      report_type: params.reportType,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      title: params.title,
      content: params.content,
      data: params.data,
    })
    .select("id, content")
    .single();
  if (error) throw error;
  return data;
}

export async function generateDailyBriefing(admin: SupabaseClient): Promise<{ id: string; content: string }> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStart = yesterday.toISOString().slice(0, 10);
  const todayStart = now.toISOString().slice(0, 10);

  const [transactions, newLeads, todaysBookings, overdueTasks, failedRuns] = await Promise.all([
    admin.from("transactions").select("type, amount").eq("transaction_date", yesterdayStart),
    admin.from("customers").select("id", { count: "exact", head: true }).gte("created_at", yesterday.toISOString()),
    admin.from("bookings").select("id", { count: "exact", head: true }).gte("start_time", `${todayStart}T00:00:00`).lt("start_time", `${todayStart}T23:59:59`).neq("status", "cancelled"),
    admin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "open").eq("priority", "high").lt("due_at", now.toISOString()),
    admin.from("automation_runs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("started_at", yesterday.toISOString()),
  ]);

  const { revenue, expense: expenses } = sumTransactions(transactions.data ?? []);

  const kpis = {
    date: todayStart,
    yesterdayRevenue: revenue,
    yesterdayExpenses: expenses,
    newLeadsYesterday: newLeads.count ?? 0,
    bookingsToday: todaysBookings.count ?? 0,
    overdueHighPriorityTasks: overdueTasks.count ?? 0,
    failedAutomationsYesterday: failedRuns.count ?? 0,
  };

  const result = await generate(
    [
      { role: "system", content: PROMPTS.daily_briefing },
      { role: "user", content: JSON.stringify(kpis) },
    ],
    undefined,
    0.5,
    1024
  );
  await logAiUsage(admin, result.usage, "ai-briefing-runner:daily_briefing");

  return saveReport(admin, {
    reportType: "daily_briefing",
    title: `สรุปประจำวัน ${todayStart}`,
    content: result.message.content,
    data: kpis,
  });
}

export async function generateWeeklyBusinessReport(admin: SupabaseClient): Promise<{ id: string; content: string }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [salesStatus, transactions, expiringCourses] = await Promise.all([
    admin.from("customers").select("sales_status"),
    admin.from("transactions").select("type, category, amount, transaction_date").gte("transaction_date", weekAgo.toISOString().slice(0, 10)),
    admin.from("courses").select("id, customer_id, remaining_hour").lte("remaining_hour", 2).gt("remaining_hour", 0),
  ]);

  const statusCounts = countByStatus(salesStatus.data ?? []);

  const revenueByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};
  for (const t of transactions.data ?? []) {
    if (t.type === "income") revenueByCategory[t.category] = (revenueByCategory[t.category] ?? 0) + t.amount;
    else expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + t.amount;
  }
  const { revenue: weeklyRevenue, expense: weeklyExpense } = sumTransactions(transactions.data ?? []);

  const kpis = {
    weekOf: weekAgo.toISOString().slice(0, 10),
    salesPipelineByStatus: statusCounts,
    weeklyRevenue,
    weeklyExpense,
    revenueByCategory,
    expenseByCategory,
    customersNearCourseEnd: expiringCourses.data?.length ?? 0,
  };

  const result = await generate(
    [
      { role: "system", content: PROMPTS.weekly_business_report },
      { role: "user", content: JSON.stringify(kpis) },
    ],
    undefined,
    0.5,
    1536
  );
  await logAiUsage(admin, result.usage, "ai-briefing-runner:weekly_business_report");

  return saveReport(admin, {
    reportType: "weekly_business_report",
    title: `สรุปประจำสัปดาห์ ${kpis.weekOf}`,
    content: result.message.content,
    data: kpis,
  });
}

export async function generateStudentProgress(admin: SupabaseClient, customerId: string): Promise<{ id: string; content: string }> {
  const [customer, courses, bookings] = await Promise.all([
    admin.from("customers").select("name").eq("id", customerId).single(),
    admin.from("courses").select("total_hours, current_hour, remaining_hour, started_at").eq("customer_id", customerId).order("started_at", { ascending: false }),
    admin
      .from("bookings")
      .select("start_time, status, lesson_type")
      .eq("customer_id", customerId)
      .order("start_time", { ascending: false })
      .limit(20),
  ]);
  if (customer.error || !customer.data) throw new Error("Customer not found");

  const completed = (bookings.data ?? []).filter((b) => b.status === "completed").length;
  const cancelled = (bookings.data ?? []).filter((b) => b.status === "cancelled").length;

  const kpis = {
    studentName: customer.data.name,
    courses: courses.data ?? [],
    recentLessons: bookings.data ?? [],
    completedLessonsRecent: completed,
    cancelledLessonsRecent: cancelled,
  };

  const result = await generate(
    [
      { role: "system", content: PROMPTS.student_progress },
      { role: "user", content: JSON.stringify(kpis) },
    ],
    undefined,
    0.6,
    1024
  );
  await logAiUsage(admin, result.usage, "generate-student-progress");

  return saveReport(admin, {
    reportType: "student_progress",
    entityType: "customer",
    entityId: customerId,
    title: `สรุปพัฒนาการ: ${customer.data.name}`,
    content: result.message.content,
    data: kpis,
  });
}

// Called by the automation engine's draft_followup_message action
// (_shared/automation-actions.ts) — never sends anything itself. It writes
// the draft to ai_reports for the record, then files an ai_drafted_message
// approval request so a human reviews/edits/sends it (see approvals/index.ts).
export async function draftSalesFollowup(admin: SupabaseClient, customerId: string): Promise<{ reportId: string; approvalId: string }> {
  const { data: customer, error } = await admin
    .from("customers")
    .select("name, learning_goal, sales_status, notes, last_contact_at, created_at, line_user_id")
    .eq("id", customerId)
    .single();
  if (error || !customer) throw new Error("Customer not found");

  const daysSinceContact = Math.floor((Date.now() - new Date(customer.last_contact_at ?? customer.created_at).getTime()) / (24 * 60 * 60 * 1000));

  const context = {
    name: customer.name,
    learningGoal: customer.learning_goal,
    salesStatus: customer.sales_status,
    notes: customer.notes,
    daysSinceLastContact: daysSinceContact,
  };

  const result = await generate(
    [
      { role: "system", content: PROMPTS.sales_followup_draft },
      { role: "user", content: JSON.stringify(context) },
    ],
    undefined,
    0.7,
    512
  );
  await logAiUsage(admin, result.usage, "automation-engine-runner:draft_followup_message");

  const report = await saveReport(admin, {
    reportType: "sales_followup_draft",
    entityType: "customer",
    entityId: customerId,
    title: `ร่างข้อความติดตาม: ${customer.name}`,
    content: result.message.content,
    data: context,
  });

  const { id: approvalId } = await requestApproval(
    admin,
    "ai_drafted_message",
    { customerId, customerName: customer.name, message: result.message.content, hasLineConnection: Boolean(customer.line_user_id) },
    `ลูกค้าไม่มีความเคลื่อนไหว ${daysSinceContact} วัน — AI ร่างข้อความติดตามให้`
  );

  return { reportId: report.id, approvalId };
}
