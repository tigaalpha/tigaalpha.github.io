import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseExcelTransactions } from "./parse-excel-transactions";

async function buildFile(headers: string[], rows: unknown[][]): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer as BlobPart], "test.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("parseExcelTransactions", () => {
  it("parses valid English-header rows", async () => {
    const file = await buildFile(
      ["date", "type", "category", "amount", "description", "payment method"],
      [["2026-01-15", "income", "Lessons", 1500, "Piano lesson", "cash"]]
    );
    const { rows, skipped } = await parseExcelTransactions(file);
    expect(skipped).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "income",
      category: "Lessons",
      amount: 1500,
      description: "Piano lesson",
      transaction_date: "2026-01-15",
      payment_method: "cash",
    });
  });

  it("parses Thai headers and values, including the legacy รายรับ wording", async () => {
    const file = await buildFile(
      ["วันที่", "ประเภท", "หมวดหมู่", "จำนวนเงิน"],
      [["2026-02-01", "รายรับ", "ค่าเรียนเปียโน", "2,500"]]
    );
    const { rows } = await parseExcelTransactions(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("income");
    expect(rows[0]?.amount).toBe(2500);
  });

  it("recognizes expense rows via the Thai word จ่าย", async () => {
    const file = await buildFile(["date", "type", "amount"], [["2026-01-01", "รายจ่าย", "300"]]);
    const { rows } = await parseExcelTransactions(file);
    expect(rows[0]?.type).toBe("expense");
  });

  it("defaults category when the column is blank", async () => {
    const file = await buildFile(["date", "type", "amount"], [["2026-01-01", "income", "100"]]);
    const { rows } = await parseExcelTransactions(file);
    expect(rows[0]?.category).toBe("รายได้อื่นๆ");
  });

  it("skips rows with a missing or non-positive amount", async () => {
    const file = await buildFile(
      ["date", "type", "amount"],
      [
        ["2026-01-01", "income", ""],
        ["2026-01-02", "income", "-50"],
      ]
    );
    const { rows, skipped } = await parseExcelTransactions(file);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(2);
    expect(skipped[0]?.reason).toMatch(/จำนวนเงิน/);
  });

  it("skips rows with an unrecognized type", async () => {
    const file = await buildFile(["date", "type", "amount"], [["2026-01-01", "gift", "100"]]);
    const { rows, skipped } = await parseExcelTransactions(file);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toMatch(/ประเภท/);
  });

  it("skips rows with a missing or invalid date", async () => {
    const file = await buildFile(["date", "type", "amount"], [["", "income", "100"]]);
    const { rows, skipped } = await parseExcelTransactions(file);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toMatch(/วันที่/);
  });

  it("skips fully blank rows without recording them as errors", async () => {
    const file = await buildFile(["date", "type", "amount"], [["2026-01-01", "income", "100"], [], []]);
    const { rows, skipped } = await parseExcelTransactions(file);
    expect(rows).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it("throws a clear error when the amount column is missing entirely", async () => {
    const file = await buildFile(["date", "type"], [["2026-01-01", "income"]]);
    await expect(parseExcelTransactions(file)).rejects.toThrow(/amount/);
  });
});
