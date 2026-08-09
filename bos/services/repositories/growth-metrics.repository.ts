import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeCAC, computeLTV, computeCashFlowForecast, type MetricWithConfidence } from "@/lib/business-metrics";

const MARKETING_EXPENSE_CATEGORY = "การตลาด/โฆษณา";

export class GrowthMetricsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  // CAC over a trailing window: marketing/ads spend / distinct customers
  // that reached "won" in that window.
  async cac90Days(): Promise<MetricWithConfidence> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [spendResult, wonResult] = await Promise.all([
      this.db.from("transactions").select("amount").eq("type", "expense").eq("category", MARKETING_EXPENSE_CATEGORY).gte("transaction_date", since.toISOString().slice(0, 10)),
      this.db.from("sales_status_history").select("customer_id").eq("to_status", "won").gte("created_at", since.toISOString()),
    ]);
    return computeCAC(spendResult.data ?? [], (wonResult.data ?? []).map((r) => r.customer_id));
  }

  // LTV proxy: average all-time income revenue per distinct paying
  // customer. No churn/retention modeling.
  async ltv(): Promise<MetricWithConfidence> {
    const { data } = await this.db.from("transactions").select("amount, customer_id").eq("type", "income").not("customer_id", "is", null);
    return computeLTV(data ?? []);
  }

  // Trend-based forecast, not a modeled cash-flow prediction: compares net
  // cash flow across two trailing 45-day windows, projects the recent
  // daily average forward.
  async cashFlowForecast(): Promise<{ projectedNet30Days: number; trend: "up" | "down" | "stable"; confidence: "high" | "low" }> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const { data } = await this.db.from("transactions").select("type, amount, transaction_date").gte("transaction_date", ninetyDaysAgo.toISOString().slice(0, 10));

    const fortyFiveDaysAgoStr = fortyFiveDaysAgo.toISOString().slice(0, 10);
    const recentRows = (data ?? []).filter((t) => t.transaction_date >= fortyFiveDaysAgoStr);
    const olderRows = (data ?? []).filter((t) => t.transaction_date < fortyFiveDaysAgoStr);

    const forecast = computeCashFlowForecast(recentRows, olderRows, 45);
    return { projectedNet30Days: forecast.avgDailyNet * 30, trend: forecast.trend, confidence: forecast.confidence };
  }
}
