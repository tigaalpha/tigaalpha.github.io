import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate } from "./ai-provider.ts";
import type { GenerateResult } from "./ai-types.ts";
import { PROMPTS } from "./prompts.ts";
import { sumTransactions, countByStatus, computeCAC, computeLTV, computeCashFlowForecast } from "./business-metrics.ts";

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

  const statusCounts = countByStatus(statusRows.data ?? []);

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

async function fetchCashFlowForecast(admin: SupabaseClient) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const { data } = await admin.from("transactions").select("type, amount, transaction_date").gte("transaction_date", ninetyDaysAgo.toISOString().slice(0, 10));

  const fortyFiveDaysAgoStr = fortyFiveDaysAgo.toISOString().slice(0, 10);
  const recentRows = (data ?? []).filter((t) => t.transaction_date >= fortyFiveDaysAgoStr);
  const olderRows = (data ?? []).filter((t) => t.transaction_date < fortyFiveDaysAgoStr);

  const forecast = computeCashFlowForecast(recentRows, olderRows, 45);
  return {
    avgDailyNetLast45Days: forecast.avgDailyNet,
    projectedNet30Days: forecast.avgDailyNet * 30,
    projectedNet60Days: forecast.avgDailyNet * 60,
    projectedNet90Days: forecast.avgDailyNet * 90,
    trend: forecast.trend,
    confidence: forecast.confidence,
  };
}

// CAC over a trailing window: total marketing/ads expense divided by
// distinct customers who reached "won" in that same window.
async function fetchCAC(admin: SupabaseClient, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [spendResult, wonResult] = await Promise.all([
    admin.from("transactions").select("amount").eq("type", "expense").eq("category", MARKETING_EXPENSE_CATEGORY).gte("transaction_date", since.toISOString().slice(0, 10)),
    admin.from("sales_status_history").select("customer_id").eq("to_status", "won").gte("created_at", since.toISOString()),
  ]);
  return computeCAC(spendResult.data ?? [], (wonResult.data ?? []).map((r) => r.customer_id));
}

// LTV proxy: average all-time income revenue per distinct paying customer.
// Simple and defensible with the data actually available (no churn/retention
// modeling) -- explicitly a proxy, not a modeled lifetime value.
async function fetchLTV(admin: SupabaseClient) {
  const { data } = await admin.from("transactions").select("amount, customer_id").eq("type", "income").not("customer_id", "is", null);
  return computeLTV(data ?? []);
}

export async function runFinanceAgentTask(admin: SupabaseClient, question: string): Promise<AgentTaskResult> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: transactions, error } = await admin.from("transactions").select("type, category, amount, transaction_date").gte("transaction_date", monthAgo);
  if (error) throw error;

  const revenueByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};
  for (const t of transactions ?? []) {
    if (t.type === "income") revenueByCategory[t.category] = (revenueByCategory[t.category] ?? 0) + t.amount;
    else expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + t.amount;
  }
  const { revenue: totalRevenue, expense: totalExpense, profit: netProfit } = sumTransactions(transactions ?? []);

  const [cashFlowForecast, cac90Days, ltv] = await Promise.all([fetchCashFlowForecast(admin), fetchCAC(admin, 90), fetchLTV(admin)]);

  return runAgentPrompt("finance_agent", question, {
    periodDays: 30,
    totalRevenue,
    totalExpense,
    netProfit,
    revenueByCategory,
    expenseByCategory,
    cashFlowForecast,
    computedCAC90Days: cac90Days.value,
    cacConfidence: cac90Days.confidence,
    computedLTV: ltv.value,
    ltvConfidence: ltv.confidence,
    ltvToCacRatio: cac90Days.value && ltv.value ? Number((ltv.value / cac90Days.value).toFixed(1)) : null,
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
