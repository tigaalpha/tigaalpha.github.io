"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Granularity = "month" | "quarter" | "half" | "year";

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "month", label: "รายเดือน" },
  { value: "quarter", label: "รายไตรมาส" },
  { value: "half", label: "รายหกเดือน" },
  { value: "year", label: "รายปี" },
];

interface Period {
  key: string;
  label: string;
  sortKey: number;
  transactions: Tables<"transactions">[];
  total: number;
}

function getPeriodKey(date: Date, granularity: Granularity): { key: string; sortKey: number } {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (granularity === "month") {
    return { key: `${year}-${String(month + 1).padStart(2, "0")}`, sortKey: year * 12 + month };
  }
  if (granularity === "quarter") {
    const q = Math.floor(month / 3) + 1;
    return { key: `${year}-Q${q}`, sortKey: year * 4 + (q - 1) };
  }
  if (granularity === "half") {
    const h = month < 6 ? 1 : 2;
    return { key: `${year}-H${h}`, sortKey: year * 2 + (h - 1) };
  }
  return { key: `${year}`, sortKey: year };
}

function periodLabel(key: string, granularity: Granularity): string {
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y!, m! - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  }
  if (granularity === "quarter") {
    const [y, q] = key.split("-Q");
    return `ไตรมาส ${q} ปี ${new Date(Number(y), 0, 1).toLocaleDateString("th-TH", { year: "numeric" })}`;
  }
  if (granularity === "half") {
    const [y, h] = key.split("-H");
    return `ครึ่งปี ${h} ปี ${new Date(Number(y), 0, 1).toLocaleDateString("th-TH", { year: "numeric" })}`;
  }
  return `ปี ${new Date(Number(key), 0, 1).toLocaleDateString("th-TH", { year: "numeric" })}`;
}

interface ExpenseBreakdownProps {
  transactions: Tables<"transactions">[];
}

export function ExpenseBreakdown({ transactions }: ExpenseBreakdownProps) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const expenses = useMemo(() => transactions.filter((t) => t.type === "expense"), [transactions]);

  const periods = useMemo(() => {
    const map = new Map<string, Period>();
    for (const t of expenses) {
      const date = new Date(t.transaction_date);
      const { key, sortKey } = getPeriodKey(date, granularity);
      const existing = map.get(key);
      if (existing) {
        existing.transactions.push(t);
        existing.total += t.amount;
      } else {
        map.set(key, { key, sortKey, label: periodLabel(key, granularity), transactions: [t], total: t.amount });
      }
    }
    return Array.from(map.values())
      .map((p) => ({
        ...p,
        transactions: [...p.transactions].sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1)),
      }))
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [expenses, granularity]);

  const grandTotal = useMemo(() => expenses.reduce((sum, t) => sum + t.amount, 0), [expenses]);

  function toggle(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/accounting" className="inline-flex items-center gap-1.5 text-sm text-secondary/60 hover:text-secondary">
        <ArrowLeft className="h-4 w-4" />
        กลับหน้าบัญชี
      </Link>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-danger" />
              รายจ่ายทั้งหมด
            </CardTitle>
            <CardDescription>ย้อนหลังตั้งแต่รายการแรกจนถึงปัจจุบัน — รวม {formatCurrency(grandTotal)}</CardDescription>
          </div>
          <div className="flex flex-wrap overflow-hidden rounded-xl border border-line/10">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGranularity(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium",
                  granularity === opt.value ? "bg-danger/10 text-danger" : "text-secondary/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {periods.length === 0 ? (
        <EmptyState icon={TrendingDown} title="ยังไม่มีรายจ่าย" description="ยังไม่มีรายการรายจ่ายบันทึกไว้" />
      ) : (
        <div className="space-y-3">
          {periods.map((period) => {
            const isOpen = !collapsedKeys.has(period.key);
            return (
              <Card key={period.key}>
                <button type="button" onClick={() => toggle(period.key)} className="flex w-full items-center justify-between p-4 text-left">
                  <div>
                    <p className="text-sm font-semibold text-secondary">{period.label}</p>
                    <p className="text-xs text-secondary/50">{period.transactions.length} รายการ</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-danger">{formatCurrency(period.total)}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-secondary/40" /> : <ChevronDown className="h-4 w-4 text-secondary/40" />}
                  </div>
                </button>
                {isOpen ? (
                  <CardContent className="pt-0">
                    <ul className="space-y-2 border-t border-line/5 pt-3">
                      {period.transactions.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line/5 px-4 py-3">
                          <div className="min-w-0">
                            <Badge variant="danger">{t.category}</Badge>
                            <p className="mt-1 truncate text-xs text-secondary/50">
                              {t.transaction_date} {t.description ? `— ${t.description}` : ""} {t.payment_method ? `(${t.payment_method})` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-danger">-{formatCurrency(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
