"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types/database";

// Validated categorical order (dataviz skill, references/palette.md) — fixed
// order, never cycled: slot 1 (blue) / slot 2 (orange) / slot 3 (aqua).
// Revenue keeps slot 1 everywhere; Expense/Profit keep slots 2/3 everywhere
// including the pie, so the same entity is always the same color.
const COLORS = {
  light: { revenue: "#2a78d6", expense: "#eb6834", profit: "#1baf7a", grid: "rgb(28 22 14 / 0.08)", text: "rgb(28 22 14 / 0.5)" },
  dark: { revenue: "#3987e5", expense: "#d95926", profit: "#199e70", grid: "rgb(237 232 224 / 0.1)", text: "rgb(237 232 224 / 0.5)" },
};

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

interface MonthlyPoint {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  expense: number;
  profit: number;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
}

function formatBaht(value: number): string {
  return `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-line/10 bg-card px-3 py-2 text-xs shadow-soft">
      <p className="mb-1 font-medium text-secondary">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatBaht(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function FinanceCharts() {
  const [monthly, setMonthly] = useState<MonthlyPoint[] | null>(null);
  const [showTable, setShowTable] = useState(false);
  const isDark = useIsDarkMode();
  const palette = isDark ? COLORS.dark : COLORS.light;

  useEffect(() => {
    const repos = createRepositories(createClient());
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);
    repos.transactions.listBetween(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)).then((transactions) => {
      setMonthly(aggregateByMonth(transactions, start, end));
    });
  }, []);

  const totals = useMemo(() => {
    if (!monthly) return null;
    const revenue = monthly.reduce((sum, m) => sum + m.revenue, 0);
    const expense = monthly.reduce((sum, m) => sum + m.expense, 0);
    return { revenue, expense, profit: revenue - expense };
  }, [monthly]);

  const pieData = totals
    ? [
        { name: "ค่าใช้จ่าย", value: Math.max(totals.expense, 0), color: palette.expense },
        { name: "กำไร", value: Math.max(totals.profit, 0), color: palette.profit },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>รายได้ / ค่าใช้จ่าย / กำไร</CardTitle>
          <CardDescription>ตั้งแต่ต้นปีถึงปัจจุบัน จากรายการในหน้า Accounting</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          {showTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
        </Button>
      </CardHeader>
      <CardContent>
        {!monthly || !totals ? (
          <div className="h-64 animate-pulse rounded-xl bg-line/5" />
        ) : showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line/10 text-left text-secondary/50">
                  <th className="py-2 pr-4">เดือน</th>
                  <th className="py-2 pr-4">รายได้</th>
                  <th className="py-2 pr-4">ค่าใช้จ่าย</th>
                  <th className="py-2">กำไร</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.monthKey} className="border-b border-line/5 text-secondary">
                    <td className="py-2 pr-4">{m.monthLabel}</td>
                    <td className="py-2 pr-4">{formatBaht(m.revenue)}</td>
                    <td className="py-2 pr-4">{formatBaht(m.expense)}</td>
                    <td className="py-2">{formatBaht(m.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <p className="mb-2 text-xs font-medium text-secondary/50">แนวโน้มรายเดือน</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="monthLabel" stroke={palette.text} fontSize={12} tickLine={false} axisLine={{ stroke: palette.grid }} />
                  <YAxis stroke={palette.text} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="รายได้" stroke={palette.revenue} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="expense" name="ค่าใช้จ่าย" stroke={palette.expense} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="profit" name="กำไร" stroke={palette.profit} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-secondary/50">เทียบรายเดือน</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                    <XAxis dataKey="monthLabel" stroke={palette.text} fontSize={12} tickLine={false} axisLine={{ stroke: palette.grid }} />
                    <YAxis stroke={palette.text} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="รายได้" fill={palette.revenue} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="ค่าใช้จ่าย" fill={palette.expense} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="กำไร" fill={palette.profit} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-secondary/50">
                  สัดส่วนรายได้ตั้งแต่ต้นปี — {formatBaht(totals.revenue)} = ค่าใช้จ่าย + กำไร
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatBaht(Number(value))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function aggregateByMonth(transactions: Tables<"transactions">[], start: Date, end: Date): MonthlyPoint[] {
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
