// Single home for the revenue/expense and pipeline aggregation math that
// used to be independently hand-rolled in 5 places (agent-tasks.ts's
// computeCashFlowForecast/computeCAC/computeLTV, growth-metrics.repository.ts,
// ai-reports.ts's generateDailyBriefing/generateWeeklyBusinessReport,
// automation-engine-runner.ts's processRevenueDropRule) and the sales
// funnel count in 2 places (sales.repository.ts vs ai-reports.ts). Pure
// functions only -- callers keep their own DB queries (they legitimately
// fetch different windows/columns), only the aggregation math is shared.
//
// Kept byte-identical with supabase/functions/_shared/business-metrics.ts
// (same precedent as _shared/categories.ts <-> lib/category-sync.test.ts,
// _shared/schedule.ts <-> lib/compute-next-run.ts) so it's both
// Deno-importable and vitest-testable from the same source, verified by
// lib/business-metrics-sync.test.ts.

export interface TransactionRow {
  type: "income" | "expense";
  amount: number;
}

export interface TransactionSums {
  revenue: number;
  expense: number;
  profit: number;
}

export function sumTransactions(rows: TransactionRow[]): TransactionSums {
  let revenue = 0;
  let expense = 0;
  for (const t of rows) {
    if (t.type === "income") revenue += t.amount;
    else expense += t.amount;
  }
  return { revenue, expense, profit: revenue - expense };
}

export function countByStatus(rows: { sales_status: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.sales_status] = (counts[row.sales_status] ?? 0) + 1;
  return counts;
}

export interface MetricWithConfidence {
  value: number | null;
  // "low" means the number is real but thin (few data points) -- shown,
  // not hidden, but callers (AI prompts, dashboard tiles) should say so
  // rather than presenting it with the same weight as a solid number.
  confidence: "high" | "low";
}

const MIN_WON_CUSTOMERS_FOR_CONFIDENCE = 3;

// CAC over whatever window the caller already filtered spendRows/
// wonCustomerIds to. Null value (not 0) when there's no won customer in
// the window, so a prompt/UI doesn't treat an undefined ratio as a real
// zero-cost acquisition.
export function computeCAC(spendRows: { amount: number }[], wonCustomerIds: string[]): MetricWithConfidence {
  const totalSpend = spendRows.reduce((sum, t) => sum + t.amount, 0);
  const uniqueWonCustomers = new Set(wonCustomerIds).size;
  if (uniqueWonCustomers === 0) return { value: null, confidence: "low" };
  return {
    value: Math.round(totalSpend / uniqueWonCustomers),
    confidence: uniqueWonCustomers >= MIN_WON_CUSTOMERS_FOR_CONFIDENCE ? "high" : "low",
  };
}

const MIN_PAYING_CUSTOMERS_FOR_CONFIDENCE = 3;

// LTV proxy: average all-time income per distinct paying customer. No
// churn/retention modeling -- explicitly a proxy, not a modeled lifetime
// value.
export function computeLTV(incomeRows: { amount: number; customer_id: string | null }[]): MetricWithConfidence {
  const revenueByCustomer: Record<string, number> = {};
  for (const t of incomeRows) {
    if (!t.customer_id) continue;
    revenueByCustomer[t.customer_id] = (revenueByCustomer[t.customer_id] ?? 0) + t.amount;
  }
  const values = Object.values(revenueByCustomer);
  if (values.length === 0) return { value: null, confidence: "low" };
  return {
    value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    confidence: values.length >= MIN_PAYING_CUSTOMERS_FOR_CONFIDENCE ? "high" : "low",
  };
}

export interface CashFlowForecast {
  avgDailyNet: number;
  trend: "up" | "down" | "stable";
  confidence: "high" | "low";
}

const MIN_TRANSACTIONS_FOR_CONFIDENCE = 5;

// Trend-based, not a modeled cash-flow prediction: compares net cash flow
// (income - expense) across two caller-supplied windows (e.g. trailing 45
// days vs. the 45 before that, or trailing 7 vs. the 7 before that) and
// projects the recent window's daily average forward. Good enough for "is
// this heading up or down," not a substitute for real accounting
// forecasting.
export function computeCashFlowForecast(recentRows: TransactionRow[], olderRows: TransactionRow[], recentWindowDays: number): CashFlowForecast {
  const netRecent = sumTransactions(recentRows).profit;
  const netOlder = sumTransactions(olderRows).profit;
  const avgDailyNet = netRecent / recentWindowDays;
  const changeRatio = netOlder !== 0 ? (netRecent - netOlder) / Math.abs(netOlder) : 0;
  const trend: "up" | "down" | "stable" = changeRatio > 0.1 ? "up" : changeRatio < -0.1 ? "down" : "stable";
  return {
    avgDailyNet: Math.round(avgDailyNet),
    trend,
    confidence: recentRows.length + olderRows.length >= MIN_TRANSACTIONS_FOR_CONFIDENCE ? "high" : "low",
  };
}
