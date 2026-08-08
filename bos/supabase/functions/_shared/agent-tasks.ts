import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate } from "./ai-provider.ts";
import type { GenerateResult } from "./ai-types.ts";
import { PROMPTS } from "./prompts.ts";

// One task-runner per agent id in agents.ts, all the same shape: pull real
// CRM data with plain queries (same style as ai-reports.ts), hand it to
// generate() as JSON alongside that agent's fixed prompt, return plain
// text. No embedded-join selects (same typing reason automation.repository.ts
// avoided them) -- separate small queries instead.

export interface AgentTaskResult {
  output: string;
  usage?: GenerateResult["usage"];
}

async function runAgentPrompt(promptKey: keyof typeof PROMPTS, question: string, data: Record<string, unknown>): Promise<AgentTaskResult> {
  const result = await generate(
    [
      { role: "system", content: PROMPTS[promptKey] },
      { role: "user", content: JSON.stringify({ question, data }) },
    ],
    undefined,
    0.5,
    768
  );
  return { output: result.message.content, usage: result.usage };
}

export async function runSalesAgentTask(admin: SupabaseClient, question: string): Promise<AgentTaskResult> {
  const [statusRows, scoreRows, lostReasons] = await Promise.all([
    admin.from("customers").select("sales_status"),
    admin.from("customers").select("lead_score").not("sales_status", "in", "(won,lost)"),
    admin.from("sales_status_history").select("lost_reason").eq("to_status", "lost").not("lost_reason", "is", null),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of statusRows.data ?? []) statusCounts[row.sales_status] = (statusCounts[row.sales_status] ?? 0) + 1;

  const scores = (scoreRows.data ?? []).map((r) => r.lead_score);
  const avgLeadScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const highScoreLeadCount = scores.filter((s) => s >= 70).length;

  const lostReasonCounts: Record<string, number> = {};
  for (const row of lostReasons.data ?? []) {
    if (row.lost_reason) lostReasonCounts[row.lost_reason] = (lostReasonCounts[row.lost_reason] ?? 0) + 1;
  }

  return runAgentPrompt("sales_agent", question, { pipelineByStatus: statusCounts, avgLeadScore, highScoreLeadCount, lostReasonCounts });
}

export async function runMarketingAgentTask(admin: SupabaseClient, question: string): Promise<AgentTaskResult> {
  const [leadSources, channelStats, trendItems] = await Promise.all([
    admin.from("customers").select("lead_source"),
    admin.from("marketing_channel_manual_stats").select("channel, followers, note"),
    admin.from("social_trend_manual_items").select("platform, topic, rank").order("rank").limit(10),
  ]);

  const leadSourceCounts: Record<string, number> = {};
  for (const row of leadSources.data ?? []) {
    const source = row.lead_source ?? "ไม่ระบุ";
    leadSourceCounts[source] = (leadSourceCounts[source] ?? 0) + 1;
  }

  return runAgentPrompt("marketing_agent", question, {
    leadSourceCounts,
    socialChannelFollowers: channelStats.data ?? [],
    trendingContent: trendItems.data ?? [],
  });
}

const MARKETING_EXPENSE_CATEGORY = "การตลาด/โฆษณา";

// Trend-based forecast, not a real cash-flow model: compares net cash flow
// (income - expense) across two trailing 45-day windows to catch direction,
// then projects the recent daily average forward. Good enough for "is this
// heading up or down," not a substitute for real accounting forecasting.
async function computeCashFlowForecast(admin: SupabaseClient): Promise<{
  avgDailyNetLast45Days: number;
  projectedNet30Days: number;
  projectedNet60Days: number;
  projectedNet90Days: number;
  trend: "up" | "down" | "stable";
}> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const { data } = await admin.from("transactions").select("type, amount, transaction_date").gte("transaction_date", ninetyDaysAgo.toISOString().slice(0, 10));

  let netOlderHalf = 0;
  let netRecentHalf = 0;
  for (const t of data ?? []) {
    const signedAmount = t.type === "income" ? t.amount : -t.amount;
    if (t.transaction_date >= fortyFiveDaysAgo.toISOString().slice(0, 10)) {
      netRecentHalf += signedAmount;
    } else {
      netOlderHalf += signedAmount;
    }
  }

  const avgDailyNetLast45Days = netRecentHalf / 45;
  const changeRatio = netOlderHalf !== 0 ? (netRecentHalf - netOlderHalf) / Math.abs(netOlderHalf) : 0;
  const trend: "up" | "down" | "stable" = changeRatio > 0.1 ? "up" : changeRatio < -0.1 ? "down" : "stable";

  return {
    avgDailyNetLast45Days: Math.round(avgDailyNetLast45Days),
    projectedNet30Days: Math.round(avgDailyNetLast45Days * 30),
    projectedNet60Days: Math.round(avgDailyNetLast45Days * 60),
    projectedNet90Days: Math.round(avgDailyNetLast45Days * 90),
    trend,
  };
}

// CAC over a trailing window: total marketing/ads expense divided by
// distinct customers who reached "won" in that same window. Null (not 0)
// when there's no won customer in the window, so the prompt doesn't treat
// an undefined ratio as a real zero-cost acquisition.
async function computeCAC(admin: SupabaseClient, days: number): Promise<number | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [spendResult, wonResult] = await Promise.all([
    admin.from("transactions").select("amount").eq("type", "expense").eq("category", MARKETING_EXPENSE_CATEGORY).gte("transaction_date", since.toISOString().slice(0, 10)),
    admin.from("sales_status_history").select("customer_id").eq("to_status", "won").gte("created_at", since.toISOString()),
  ]);

  const totalSpend = (spendResult.data ?? []).reduce((sum, t) => sum + t.amount, 0);
  const uniqueWonCustomers = new Set((wonResult.data ?? []).map((r) => r.customer_id)).size;

  return uniqueWonCustomers > 0 ? Math.round(totalSpend / uniqueWonCustomers) : null;
}

// LTV proxy: average all-time income revenue per distinct paying customer.
// Simple and defensible with the data actually available (no churn/retention
// modeling) -- explicitly a proxy, not a modeled lifetime value.
async function computeLTV(admin: SupabaseClient): Promise<number | null> {
  const { data } = await admin.from("transactions").select("amount, customer_id").eq("type", "income").not("customer_id", "is", null);

  const revenueByCustomer: Record<string, number> = {};
  for (const t of data ?? []) {
    if (!t.customer_id) continue;
    revenueByCustomer[t.customer_id] = (revenueByCustomer[t.customer_id] ?? 0) + t.amount;
  }

  const values = Object.values(revenueByCustomer);
  return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export async function runFinanceAgentTask(admin: SupabaseClient, question: string): Promise<AgentTaskResult> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: transactions, error } = await admin.from("transactions").select("type, category, amount, transaction_date").gte("transaction_date", monthAgo);
  if (error) throw error;

  const revenueByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};
  let totalRevenue = 0;
  let totalExpense = 0;
  for (const t of transactions ?? []) {
    if (t.type === "income") {
      totalRevenue += t.amount;
      revenueByCategory[t.category] = (revenueByCategory[t.category] ?? 0) + t.amount;
    } else {
      totalExpense += t.amount;
      expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + t.amount;
    }
  }

  const [cashFlowForecast, computedCAC90Days, computedLTV] = await Promise.all([computeCashFlowForecast(admin), computeCAC(admin, 90), computeLTV(admin)]);

  return runAgentPrompt("finance_agent", question, {
    periodDays: 30,
    totalRevenue,
    totalExpense,
    netProfit: totalRevenue - totalExpense,
    revenueByCategory,
    expenseByCategory,
    cashFlowForecast,
    computedCAC90Days,
    computedLTV,
    ltvToCacRatio: computedCAC90Days && computedLTV ? Number((computedLTV / computedCAC90Days).toFixed(1)) : null,
  });
}

export async function runBusinessAnalystAgentTask(admin: SupabaseClient, question: string): Promise<AgentTaskResult> {
  const [recentReports, runCounts] = await Promise.all([
    admin.from("ai_reports").select("report_type, title, created_at").order("created_at", { ascending: false }).limit(5),
    admin.from("automation_runs").select("status").gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const automationCounts: Record<string, number> = { success: 0, failed: 0, skipped: 0 };
  for (const row of runCounts.data ?? []) automationCounts[row.status] = (automationCounts[row.status] ?? 0) + 1;

  return runAgentPrompt("business_analyst_agent", question, {
    recentAiReports: recentReports.data ?? [],
    automationRunCountsLast7Days: automationCounts,
  });
}

export async function runAgentTask(admin: SupabaseClient, agentId: string, question: string): Promise<AgentTaskResult> {
  switch (agentId) {
    case "sales":
      return runSalesAgentTask(admin, question);
    case "marketing":
      return runMarketingAgentTask(admin, question);
    case "finance":
      return runFinanceAgentTask(admin, question);
    case "business_analyst":
      return runBusinessAnalystAgentTask(admin, question);
    default:
      throw new Error(`Unknown agent id: ${agentId}`);
  }
}
