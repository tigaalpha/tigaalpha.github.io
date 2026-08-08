import { describe, expect, it } from "vitest";
import { toRows } from "./students-import";

describe("toRows", () => {
  it("maps English headers to customer fields", () => {
    const rows = toRows([{ name: "Somchai", phone: "0812345678", age: "10" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.error).toBeUndefined();
    expect(rows[0]?.data).toMatchObject({ name: "Somchai", phone: "0812345678", age: 10 });
  });

  it("maps Thai header aliases to the same fields", () => {
    const rows = toRows([{ ชื่อ: "สมชาย", เบอร์โทร: "0899999999", สถานะ: "won" }]);
    expect(rows[0]?.data).toMatchObject({ name: "สมชาย", phone: "0899999999", sales_status: "won" });
  });

  it("returns an error row when name is missing, without throwing", () => {
    const rows = toRows([{ phone: "0812345678" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.error).toMatch(/ไม่มีชื่อ/);
    expect(rows[0]?.data.name).toBe("");
  });

  it("falls back to new_lead for an invalid sales_status", () => {
    const rows = toRows([{ name: "Somchai", sales_status: "made_up_status" }]);
    expect(rows[0]?.data.sales_status).toBe("new_lead");
  });

  it("normalizes sales_status case and spaces before matching", () => {
    const rows = toRows([{ name: "Somchai", sales_status: "Trial Booked" }]);
    expect(rows[0]?.data.sales_status).toBe("trial_booked");
  });

  it("defaults lead_source to CSV Import when not provided", () => {
    const rows = toRows([{ name: "Somchai" }]);
    expect(rows[0]?.data.lead_source).toBe("CSV Import");
  });

  it("keeps an explicit lead_source when provided", () => {
    const rows = toRows([{ name: "Somchai", source: "Facebook Ads" }]);
    expect(rows[0]?.data.lead_source).toBe("Facebook Ads");
  });

  it("leaves optional fields null when blank or absent", () => {
    const rows = toRows([{ name: "Somchai", phone: "" }]);
    expect(rows[0]?.data.phone).toBeNull();
    expect(rows[0]?.data.parent_phone).toBeNull();
  });

  it("ignores unrecognized columns entirely", () => {
    const rows = toRows([{ name: "Somchai", favorite_color: "blue" }]);
    expect(rows[0]?.data).not.toHaveProperty("favorite_color");
  });

  it("processes multiple rows independently", () => {
    const rows = toRows([{ name: "A" }, { phone: "0800000000" }, { name: "C", sales_status: "won" }]);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.error).toBeUndefined();
    expect(rows[1]?.error).toBeDefined();
    expect(rows[2]?.data.sales_status).toBe("won");
  });
});
