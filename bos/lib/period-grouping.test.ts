import { describe, expect, it } from "vitest";
import { getPeriodKey, periodLabel } from "./period-grouping";

describe("getPeriodKey", () => {
  it("groups by month", () => {
    expect(getPeriodKey(new Date(2026, 0, 15), "month")).toEqual({ key: "2026-01", sortKey: 2026 * 12 + 0 });
    expect(getPeriodKey(new Date(2026, 11, 1), "month")).toEqual({ key: "2026-12", sortKey: 2026 * 12 + 11 });
  });

  it("groups by quarter", () => {
    expect(getPeriodKey(new Date(2026, 0, 1), "quarter")).toEqual({ key: "2026-Q1", sortKey: 2026 * 4 + 0 });
    expect(getPeriodKey(new Date(2026, 3, 1), "quarter")).toEqual({ key: "2026-Q2", sortKey: 2026 * 4 + 1 });
    expect(getPeriodKey(new Date(2026, 6, 1), "quarter")).toEqual({ key: "2026-Q3", sortKey: 2026 * 4 + 2 });
    expect(getPeriodKey(new Date(2026, 9, 1), "quarter")).toEqual({ key: "2026-Q4", sortKey: 2026 * 4 + 3 });
  });

  it("groups by half-year", () => {
    expect(getPeriodKey(new Date(2026, 0, 1), "half")).toEqual({ key: "2026-H1", sortKey: 2026 * 2 });
    expect(getPeriodKey(new Date(2026, 5, 1), "half")).toEqual({ key: "2026-H1", sortKey: 2026 * 2 });
    expect(getPeriodKey(new Date(2026, 6, 1), "half")).toEqual({ key: "2026-H2", sortKey: 2026 * 2 + 1 });
    expect(getPeriodKey(new Date(2026, 11, 31), "half")).toEqual({ key: "2026-H2", sortKey: 2026 * 2 + 1 });
  });

  it("groups by year", () => {
    expect(getPeriodKey(new Date(2026, 5, 15), "year")).toEqual({ key: "2026", sortKey: 2026 });
  });

  it("sortKey orders consecutive months/quarters/halves correctly across a year boundary", () => {
    const dec = getPeriodKey(new Date(2026, 11, 1), "month");
    const jan = getPeriodKey(new Date(2027, 0, 1), "month");
    expect(jan.sortKey).toBeGreaterThan(dec.sortKey);

    const q4 = getPeriodKey(new Date(2026, 9, 1), "quarter");
    const q1next = getPeriodKey(new Date(2027, 0, 1), "quarter");
    expect(q1next.sortKey).toBeGreaterThan(q4.sortKey);
  });
});

describe("periodLabel", () => {
  it("formats a month label in Thai", () => {
    expect(periodLabel("2026-01", "month")).toBe("มกราคม 2569");
  });

  it("formats a quarter label", () => {
    expect(periodLabel("2026-Q3", "quarter")).toBe("ไตรมาส 3 ปี พ.ศ. 2569");
  });

  it("formats a half-year label", () => {
    expect(periodLabel("2026-H2", "half")).toBe("ครึ่งปี 2 ปี พ.ศ. 2569");
  });

  it("formats a year label", () => {
    expect(periodLabel("2026", "year")).toBe("ปี พ.ศ. 2569");
  });
});
