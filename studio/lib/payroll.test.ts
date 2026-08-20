import { describe, expect, it } from "vitest";
import { computePayroll } from "../supabase/functions/_shared/payroll";

describe("computePayroll", () => {
  it("computes hours and amount from minutes", () => {
    const results = computePayroll([
      { teacherId: "t1", teacherName: "ครูเจน", ratePerHour: 500, minutes: 4 * 60 },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.hours).toBe(4);
    expect(results[0]?.amount).toBe(2000);
  });

  it("sorts by amount descending", () => {
    const results = computePayroll([
      { teacherId: "t1", teacherName: "ครูน้อย", ratePerHour: 300, minutes: 10 * 60 },
      { teacherId: "t2", teacherName: "ครูเจน", ratePerHour: 500, minutes: 4 * 60 },
    ]);
    expect(results[0]?.teacherName).toBe("ครูน้อย"); // 3000 > 2000
    expect(results[1]?.teacherName).toBe("ครูเจน");
  });

  it("skips teachers without a rate or lessons", () => {
    const results = computePayroll([
      { teacherId: "t1", teacherName: "ครูว่าง", ratePerHour: 0, minutes: 120 },
      { teacherId: "t2", teacherName: "ครูไม่สอน", ratePerHour: 400, minutes: 0 },
      { teacherId: "t3", teacherName: "ครูเจน", ratePerHour: 500, minutes: 60 },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.teacherName).toBe("ครูเจน");
  });

  it("rounds to 2 decimals", () => {
    const results = computePayroll([{ teacherId: "t1", teacherName: "ครูเจน", ratePerHour: 100, minutes: 90 }]);
    expect(results[0]?.hours).toBe(1.5);
    expect(results[0]?.amount).toBe(150);
  });
});
