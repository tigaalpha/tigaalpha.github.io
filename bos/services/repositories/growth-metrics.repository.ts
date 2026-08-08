import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const MARKETING_EXPENSE_CATEGORY = "การตลาด/โฆษณา";

// Frontend counterpart of the CAC/LTV/cash-flow-forecast logic in
// supabase/functions/_shared/agent-tasks.ts (Finance Agent) -- same
// computation shape, reimplemented as its own queries rather than shared,
// same precedent as sales.repository.ts's lostReasonCounts().
export class GrowthMetricsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  // CAC over a trailing window: marketing/ads spend / distinct customers
  // that reached "won" in that window. Null (not 0) when there's no won
  // customer in the window.
  async cac90Days(): Promise<number | null> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [spendResult, wonResult] = await Promise.all([
      this.db.from("transactions").select("amount").eq("type", "expense").eq("category", MARKETING_EXPENSE_CATEGORY).gte("transaction_date", since.toISOString().slice(0, 10)),
      this.db.from("sales_status_history").select("customer_id").eq("to_status", "won").gte("created_at", since.toISOString()),
    ]);

    const totalSpend = (spendResult.data ?? []).reduce((sum, t) => sum + t.amount, 0);
    const uniqueWonCustomers = new Set((wonResult.data ?? []).map((r) => r.customer_id)).size;
    return uniqueWonCustomers > 0 ? Math.round(totalSpend / uniqueWonCustomers) : null;
  }

  // LTV proxy: average all-time income revenue per distinct paying
  // customer. No churn/retention modeling.
  async ltv(): Promise<number | null> {
    const { data } = await this.db.from("transactions").select("amount, customer_id").eq("type", "income").not("customer_id", "is", null);

    const revenueByCustomer: Record<string, number> = {};
    for (const t of data ?? []) {
      if (!t.customer_id) continue;
      revenueByCustomer[t.customer_id] = (revenueByCustomer[t.customer_id] ?? 0) + t.amount;
    }

    const values = Object.values(revenueByCustomer);
    return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  }

  // Trend-based forecast, not a modeled cash-flow prediction: compares net
  // cash flow across two trailing 45-day windows, projects the recent
  // daily average forward.
  async cashFlowForecast(): Promise<{ projectedNet30Days: number; trend: "up" | "down" | "stable" }> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const { data } = await this.db.from("transactions").select("type, amount, transaction_date").gte("transaction_date", ninetyDaysAgo.toISOString().slice(0, 10));

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

    const avgDailyNet = netRecentHalf / 45;
    const changeRatio = netOlderHalf !== 0 ? (netRecentHalf - netOlderHalf) / Math.abs(netOlderHalf) : 0;
    const trend: "up" | "down" | "stable" = changeRatio > 0.1 ? "up" : changeRatio < -0.1 ? "down" : "stable";

    return { projectedNet30Days: Math.round(avgDailyNet * 30), trend };
  }
}
