import { describe, expect, it } from "vitest";
import { isDripDue, renderDripTemplate, customerInSegment } from "../supabase/functions/_shared/drip";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("isDripDue", () => {
  const now = Date.parse("2026-08-15T10:00:00Z");

  it("first contact is always due", () => {
    expect(isDripDue(null, 7, now)).toBe(true);
  });

  it("not due inside the interval", () => {
    expect(isDripDue(new Date(now - 3 * DAY_MS).toISOString(), 7, now)).toBe(false);
  });

  it("due once the interval has passed", () => {
    expect(isDripDue(new Date(now - 8 * DAY_MS).toISOString(), 7, now)).toBe(true);
  });

  it("treats an unparseable date as due", () => {
    expect(isDripDue("garbage", 7, now)).toBe(true);
  });
});

describe("renderDripTemplate", () => {
  it("replaces {name} and {code}", () => {
    expect(renderDripTemplate("สวัสดี {name} ใช้โค้ด {code} นะคะ", { name: "น้องต้น", code: "TIGA123" })).toBe("สวัสดี น้องต้น ใช้โค้ด TIGA123 นะคะ");
  });
});

describe("customerInSegment", () => {
  it("empty segment matches everyone", () => {
    expect(customerInSegment("won", undefined)).toBe(true);
    expect(customerInSegment("new_lead", {})).toBe(true);
  });

  it("matches only listed statuses", () => {
    const segment = { sales_statuses: ["new_lead", "contacted"] };
    expect(customerInSegment("new_lead", segment)).toBe(true);
    expect(customerInSegment("won", segment)).toBe(false);
  });
});
