import { describe, expect, it } from "vitest";
import { salesDropRatio, shouldTriggerSalesDrop, shouldTriggerNoNewWon } from "../supabase/functions/_shared/agent-event-conditions";

describe("salesDropRatio", () => {
  it("returns null when there is no previous baseline", () => {
    expect(salesDropRatio(3, 0)).toBeNull();
  });

  it("is 0 when flat or up", () => {
    expect(salesDropRatio(10, 10)).toBe(0);
    expect(salesDropRatio(15, 10)).toBe(0);
  });

  it("computes the relative drop", () => {
    expect(salesDropRatio(7, 10)).toBeCloseTo(0.3);
    expect(salesDropRatio(4, 10)).toBeCloseTo(0.6);
  });
});

describe("shouldTriggerSalesDrop", () => {
  it("triggers at or above the threshold", () => {
    expect(shouldTriggerSalesDrop(7, 10)).toBe(true); // -30%
    expect(shouldTriggerSalesDrop(6, 10)).toBe(true); // -40%
  });

  it("does not trigger below the threshold", () => {
    expect(shouldTriggerSalesDrop(8, 10)).toBe(false); // -20%
  });

  it("does not trigger on a thin baseline", () => {
    expect(shouldTriggerSalesDrop(0, 1)).toBe(false); // only 1 win before — too thin to read a trend
  });

  it("triggers on a steep drop even from a small baseline", () => {
    expect(shouldTriggerSalesDrop(1, 2)).toBe(true); // -50% with baseline >= 2
  });
});

describe("shouldTriggerNoNewWon", () => {
  it("triggers only when the recent window is empty but the prior had wins", () => {
    expect(shouldTriggerNoNewWon(0, 3)).toBe(true);
    expect(shouldTriggerNoNewWon(0, 0)).toBe(false);
    expect(shouldTriggerNoNewWon(1, 3)).toBe(false);
  });
});
