"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import { aggregateByMonth, formatBaht, type MonthlyPoint } from "@/lib/finance";

// Neon palette — revenue keeps purple, expense orange, profit green everywhere
// (including the donut), so the same entity is always the same color.
const PALETTE = {
  revenue: "#8b5cf6",
  expense: "#f97316",
  profit: "#22c55e",
  grid: "rgba(100, 116, 139, 0.14)",
  text: "rgba(100, 116, 139, 0.55)",
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-line/10 bg-card px-3 py-2 text-xs shadow-card dark:border-white/10 dark:bg-[#12141d]">
      <p className="mb-1 font-medium text-secondary/50">{label}</p>
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

  const expensePct = totals && totals.revenue > 0 ? (totals.expense / totals.revenue) * 100 : 0;
  const profitPct = totals && totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const donutData = totals
    ? [
        { name: "ค่าใช้จ่าย", value: Math.max(totals.expense, 0), pct: expensePct, color: PALETTE.expense },
        { name: "กำไร", value: Math.max(totals.profit, 0), pct: profitPct, color: PALETTE.profit },
      ]
    : [];

  return (
    <div className="space-y-6">
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
            <div className="h-64 animate-pulse rounded-xl bg-line/[0.03] dark:bg-white/[0.03]" />
          ) : showTable ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line/10 text-left text-[11px] uppercase tracking-wider text-secondary/35 dark:border-white/5">
                    <th className="py-2 pr-4 font-medium">เดือน</th>
                    <th className="py-2 pr-4 font-medium">รายได้</th>
                    <th className="py-2 pr-4 font-medium">ค่าใช้จ่าย</th>
                    <th className="py-2 font-medium">กำไร</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.monthKey} className="border-b border-line/10 text-secondary last:border-0 dark:border-white/5">
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
            <div>
              <p className="mb-2 text-xs font-medium text-secondary/45">เทียบรายเดือน</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} vertical={false} />
                  <XAxis dataKey="monthLabel" stroke={PALETTE.text} fontSize={12} tickLine={false} axisLine={{ stroke: PALETTE.grid }} />
                  <YAxis stroke={PALETTE.text} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="รายได้" fill={PALETTE.revenue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="ค่าใช้จ่าย" fill={PALETTE.expense} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="กำไร" fill={PALETTE.profit} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สัดส่วนรายได้</CardTitle>
          <CardDescription>
            {totals
              ? `รายได้ ${formatBaht(totals.revenue)} (100%) = ค่าใช้จ่าย ${expensePct.toFixed(1)}% + กำไร ${profitPct.toFixed(1)}%`
              : "กำลังโหลด…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!totals ? (
            <div className="h-72 animate-pulse rounded-xl bg-line/[0.03] dark:bg-white/[0.03]" />
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
              <div className="relative h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3} strokeWidth={0}>
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, entry) => [`${formatBaht(Number(value))} (${(entry.payload as { pct: number }).pct.toFixed(1)}%)`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-secondary/40">Total</span>
                  <span className="text-xl font-bold text-secondary dark:text-white">{formatBaht(totals.revenue)}</span>
                  <span className="text-[10px] uppercase tracking-widest text-secondary/35">THB</span>
                </div>
              </div>
              <ul className="w-full max-w-xs space-y-3">
                {donutData.map((entry) => (
                  <li key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-secondary/70">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </span>
                    <span className="font-medium text-secondary dark:text-white">
                      {entry.pct.toFixed(0)}% <span className="text-secondary/40">({formatBaht(entry.value)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
