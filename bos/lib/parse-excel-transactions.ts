import { format } from "date-fns";
import type { TransactionType } from "@/types/database";

export interface ParsedTransactionRow {
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  payment_method: string | null;
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ParseExcelResult {
  rows: ParsedTransactionRow[];
  skipped: SkippedRow[];
}

const DATE_FMT = "yyyy-MM-dd";

// Accepts either Thai or English headers so an owner's own bookkeeping
// export (however it's labeled) usually works without reformatting first.
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "วันที่"],
  type: ["type", "ประเภท"],
  category: ["category", "หมวดหมู่"],
  amount: ["amount", "จำนวนเงิน", "จำนวน"],
  description: ["description", "รายละเอียด", "หมายเหตุ"],
  payment_method: ["payment method", "payment_method", "ช่องทางชำระ", "วิธีชำระเงิน"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function detectType(raw: unknown): TransactionType | null {
  const value = normalizeHeader(raw);
  if (!value) return null;
  if (value.includes("expense") || value.includes("รายจ่าย") || value.includes("จ่าย")) return "expense";
  // Accepts both the current wording (รายได้) and the older one (รายรับ) so past exports still import cleanly.
  if (value.includes("income") || value.includes("รายได้") || value.includes("รายรับ") || value.includes("รับ")) return "income";
  return null;
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return raw > 0 ? raw : null;
  const cleaned = String(raw ?? "").replace(/[,\s฿]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return format(raw, DATE_FMT);
  }
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, DATE_FMT);
}

function cellText(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  return text.length > 0 ? text : null;
}

/** Parses a .xlsx file entirely client-side (via exceljs) — no upload of the raw file to a server. */
export async function parseExcelTransactions(file: File): Promise<ParseExcelResult> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("ไม่พบชีตข้อมูลในไฟล์ Excel นี้");

  const headerRow = sheet.getRow(1);
  const columnIndex: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(cell.value);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((alias) => normalized === alias)) {
        columnIndex[field as keyof typeof HEADER_ALIASES] = colNumber;
      }
    }
  });

  if (!columnIndex.amount) {
    throw new Error('ไม่พบคอลัมน์ "จำนวนเงิน" (amount) ในไฟล์ — กรุณาตรวจสอบหัวตารางแถวแรก');
  }

  const rows: ParsedTransactionRow[] = [];
  const skipped: SkippedRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const isBlank = row.values == null || (Array.isArray(row.values) && row.values.every((v) => v == null || v === ""));
    if (isBlank) return;

    const amount = parseAmount(columnIndex.amount ? row.getCell(columnIndex.amount).value : null);
    if (amount == null) {
      skipped.push({ row: rowNumber, reason: "จำนวนเงินไม่ถูกต้องหรือว่างเปล่า" });
      return;
    }

    const type = columnIndex.type ? detectType(row.getCell(columnIndex.type).value) : null;
    if (!type) {
      skipped.push({ row: rowNumber, reason: 'ระบุประเภทไม่ได้ (ต้องเป็น "รายได้"/"income" หรือ "รายจ่าย"/"expense")' });
      return;
    }

    const transactionDate = columnIndex.date ? parseDate(row.getCell(columnIndex.date).value) : null;
    if (!transactionDate) {
      skipped.push({ row: rowNumber, reason: "วันที่ไม่ถูกต้องหรือว่างเปล่า" });
      return;
    }

    const category = (columnIndex.category ? cellText(row.getCell(columnIndex.category).value) : null) ??
      (type === "income" ? "รายได้อื่นๆ" : "ค่าใช้จ่ายอื่นๆ");

    rows.push({
      type,
      category,
      amount,
      description: columnIndex.description ? cellText(row.getCell(columnIndex.description).value) : null,
      transaction_date: transactionDate,
      payment_method: columnIndex.payment_method ? cellText(row.getCell(columnIndex.payment_method).value) : null,
    });
  });

  return { rows, skipped };
}
