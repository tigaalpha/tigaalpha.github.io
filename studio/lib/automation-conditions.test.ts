import { describe, expect, it } from "vitest";
import { evaluateConditions } from "../supabase/functions/_shared/automation-conditions";

// A rule with no conditions or a wrong operator/type match should never
// silently fire an action (send a LINE message, create a task) against
// data it wasn't actually meant to react to.
describe("evaluateConditions", () => {
  it("passes with no conditions", () => {
    expect(evaluateConditions([], { to: "lost" })).toBe(true);
  });

  it("matches eq", () => {
    expect(evaluateConditions([{ field: "to", operator: "eq", value: "lost" }], { to: "lost" })).toBe(true);
    expect(evaluateConditions([{ field: "to", operator: "eq", value: "lost" }], { to: "won" })).toBe(false);
  });

  it("matches neq", () => {
    expect(evaluateConditions([{ field: "to", operator: "neq", value: "lost" }], { to: "won" })).toBe(true);
  });

  it("matches numeric comparisons", () => {
    const data = { remainingHour: 2 };
    expect(evaluateConditions([{ field: "remainingHour", operator: "lte", value: 2 }], data)).toBe(true);
    expect(evaluateConditions([{ field: "remainingHour", operator: "lt", value: 2 }], data)).toBe(false);
    expect(evaluateConditions([{ field: "remainingHour", operator: "gt", value: 1 }], data)).toBe(true);
    expect(evaluateConditions([{ field: "remainingHour", operator: "gte", value: 3 }], data)).toBe(false);
  });

  it("rejects numeric comparisons against non-numeric data", () => {
    expect(evaluateConditions([{ field: "to", operator: "gt", value: 1 }], { to: "lost" })).toBe(false);
  });

  it("matches contains", () => {
    expect(evaluateConditions([{ field: "note", operator: "contains", value: "urgent" }], { note: "this is urgent" })).toBe(true);
    expect(evaluateConditions([{ field: "note", operator: "contains", value: "urgent" }], { note: "fine" })).toBe(false);
  });

  it("requires every condition to pass (AND, not OR)", () => {
    const conditions = [
      { field: "to", operator: "eq" as const, value: "lost" },
      { field: "from", operator: "eq" as const, value: "won" },
    ];
    expect(evaluateConditions(conditions, { to: "lost", from: "won" })).toBe(true);
    expect(evaluateConditions(conditions, { to: "lost", from: "negotiating" })).toBe(false);
  });

  it("treats a missing field as not matching eq", () => {
    expect(evaluateConditions([{ field: "missing", operator: "eq", value: "x" }], { to: "lost" })).toBe(false);
  });
});
