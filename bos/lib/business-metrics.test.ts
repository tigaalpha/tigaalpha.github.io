import { describe, expect, it } from "vitest";
import { sumTransactions, countByStatus, computeCAC, computeLTV, computeCashFlowForecast } from "./business-metrics";

describe("sumTransactions", () => {
  it("sums income and expense separately and computes profit", () => {
    expect(sumTransactions([{ type: "income", amount: 10000 }, { type: "expense", amount: 3000 }])).toEqual({ revenue: 10000, expense: 3000, profit: 7000 });
  });

  it("returns zeros for an empty list", () => {
    expect(sumTransactions([])).toEqual({ revenue: 0, expense: 0, profit: 0 });
  });

  it("handles all-expense (no income) rows", () => {
    expect(sumTransactions([{ type: "expense", amount: 500 }])).toEqual({ revenue: 0, expense: 500, profit: -500 });
  });
});

describe("countByStatus", () => {
  it("counts rows per status", () => {
    expect(countByStatus([{ sales_status: "won" }, { sales_status: "won" }, { sales_status: "lost" }])).toEqual({ won: 2, lost: 1 });
  });

  it("returns an empty object for no rows", () => {
    expect(countByStatus([])).toEqual({});
  });
});

describe("computeCAC", () => {
  it("returns null with low confidence when there are no won customers", () => {
    expect(computeCAC([{ amount: 1000 }], [])).toEqual({ value: null, confidence: "low" });
  });

  it("computes spend / unique won customers, low confidence under the threshold", () => {
    expect(computeCAC([{ amount: 900 }], ["a", "b"])).toEqual({ value: 450, confidence: "low" });
  });

  it("is high confidence at or above the won-customer threshold", () => {
    expect(computeCAC([{ amount: 900 }], ["a", "b", "c"])).toEqual({ value: 300, confidence: "high" });
  });

  it("deduplicates repeated won customer ids", () => {
    expect(computeCAC([{ amount: 300 }], ["a", "a", "a"])).toEqual({ value: 300, confidence: "low" });
  });
});

describe("computeLTV", () => {
  it("returns null with low confidence when there are no paying customers", () => {
    expect(computeLTV([])).toEqual({ value: null, confidence: "low" });
  });

  it("ignores rows with no customer_id", () => {
    expect(computeLTV([{ amount: 1000, customer_id: null }])).toEqual({ value: null, confidence: "low" });
  });

  it("averages per-customer totals, low confidence under the threshold", () => {
    expect(computeLTV([{ amount: 1000, customer_id: "a" }, { amount: 2000, customer_id: "b" }])).toEqual({ value: 1500, confidence: "low" });
  });

  it("is high confidence at or above the paying-customer threshold", () => {
    expect(
      computeLTV([
        { amount: 1000, customer_id: "a" },
        { amount: 2000, customer_id: "b" },
        { amount: 3000, customer_id: "c" },
      ])
    ).toEqual({ value: 2000, confidence: "high" });
  });
});

describe("computeCashFlowForecast", () => {
  it("flags an upward trend when the recent window improved by more than 10%", () => {
    const recent = [{ type: "income" as const, amount: 2000 }];
    const older = [{ type: "income" as const, amount: 1000 }];
    const result = computeCashFlowForecast(recent, older, 45);
    expect(result.trend).toBe("up");
  });

  it("flags a downward trend when the recent window worsened by more than 10%", () => {
    const recent = [{ type: "income" as const, amount: 500 }];
    const older = [{ type: "income" as const, amount: 1000 }];
    const result = computeCashFlowForecast(recent, older, 45);
    expect(result.trend).toBe("down");
  });

  it("flags stable when the change is within 10%", () => {
    const recent = [{ type: "income" as const, amount: 1030 }];
    const older = [{ type: "income" as const, amount: 1000 }];
    expect(computeCashFlowForecast(recent, older, 45).trend).toBe("stable");
  });

  it("treats a zero older-window net as stable rather than dividing by zero", () => {
    const recent = [{ type: "income" as const, amount: 100 }];
    const older: { type: "income" | "expense"; amount: number }[] = [];
    expect(computeCashFlowForecast(recent, older, 45).trend).toBe("stable");
  });

  it("is low confidence with too few transactions", () => {
    const recent = [{ type: "income" as const, amount: 100 }];
    const older: { type: "income" | "expense"; amount: number }[] = [];
    expect(computeCashFlowForecast(recent, older, 45).confidence).toBe("low");
  });
});
