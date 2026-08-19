import { describe, expect, it } from "vitest";
import * as frontend from "./business-metrics";
import * as backend from "../supabase/functions/_shared/business-metrics";

// _shared/business-metrics.ts (used by agent-tasks.ts, ai-reports.ts,
// automation-engine-runner.ts) is a hand-duplicated copy of this file
// (Deno can't import repo files outside supabase/functions at runtime,
// same reason schedule.ts/categories.ts are duplicated) -- cross-checks
// both copies against the same inputs instead of trusting a comment.

describe("_shared/business-metrics.ts stays behaviorally identical to lib/business-metrics.ts", () => {
  const transactionRows = [
    { type: "income" as const, amount: 10000 },
    { type: "expense" as const, amount: 3000 },
    { type: "income" as const, amount: 5000 },
  ];

  it("sumTransactions", () => {
    expect(backend.sumTransactions(transactionRows)).toEqual(frontend.sumTransactions(transactionRows));
  });

  it("countByStatus", () => {
    const rows = [{ sales_status: "won" }, { sales_status: "won" }, { sales_status: "lost" }];
    expect(backend.countByStatus(rows)).toEqual(frontend.countByStatus(rows));
  });

  it("computeCAC", () => {
    const spendRows = [{ amount: 1000 }, { amount: 2000 }];
    const wonCustomerIds = ["a", "b", "c"];
    expect(backend.computeCAC(spendRows, wonCustomerIds)).toEqual(frontend.computeCAC(spendRows, wonCustomerIds));
  });

  it("computeLTV", () => {
    const incomeRows = [
      { amount: 1000, customer_id: "a" },
      { amount: 500, customer_id: "a" },
      { amount: 2000, customer_id: "b" },
    ];
    expect(backend.computeLTV(incomeRows)).toEqual(frontend.computeLTV(incomeRows));
  });

  it("computeCashFlowForecast", () => {
    const recent = [{ type: "income" as const, amount: 5000 }, { type: "expense" as const, amount: 1000 }];
    const older = [{ type: "income" as const, amount: 3000 }, { type: "expense" as const, amount: 1500 }];
    expect(backend.computeCashFlowForecast(recent, older, 45)).toEqual(frontend.computeCashFlowForecast(recent, older, 45));
  });
});
