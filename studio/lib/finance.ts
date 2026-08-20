import type { Tables } from "@/types/database";

export interface MonthlyPoint {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  expense: number;
  profit: number;
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
}

export function formatBaht(value: number): string {
  return `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

export function aggregateByMonth(transactions: Tables<"transactions">[], start: Date, end: Date): MonthlyPoint[] {
  const buckets = new Map<string, { revenue: number; expense: number }>();

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { revenue: 0, expense: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const t of transactions) {
    const key = t.transaction_date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.type === "income") bucket.revenue += t.amount;
    else bucket.expense += t.amount;
  }

  return Array.from(buckets.entries()).map(([monthKey, { revenue, expense }]) => ({
    monthKey,
    monthLabel: monthLabel(monthKey),
    revenue,
    expense,
    profit: revenue - expense,
  }));
}
