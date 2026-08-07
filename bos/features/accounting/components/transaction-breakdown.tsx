"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import { getPeriodKey, periodLabel, type Granularity } from "@/lib/period-grouping";
import type { Tables, TransactionType } from "@/types/database";

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

const TYPE_CONFIG: Record<
  TransactionType,
  { title: string; empty: string; icon: typeof TrendingUp; tone: "success" | "danger"; sign: string }
> = {
  income: { title: "รายได้ทั้งหมด", empty: "ยังไม่มีรายได้", icon: TrendingUp, tone: "success", sign: "+" },
  expense: { title: "รายจ่ายทั้งหมด", empty: "ยังไม่มีรายจ่าย", icon: TrendingDown, tone: "danger", sign: "-" },
};

interface TransactionBreakdownProps {
  transactions: Tables<"transactions">[];
  type: TransactionType;
}

export function TransactionBreakdown({ transactions, type }: TransactionBreakdownProps) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const config = TYPE_CONFIG[type];
  const toneClass = config.tone === "success" ? "text-success" : "text-danger";
  const toneBgClass = config.tone === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger";
  const badgeVariant = config.tone;

  const filtered = useMemo(() => transactions.filter((t) => t.type === type), [transactions, type]);

  const periods = useMemo(() => {
    const map = new Map<string, Period>();
    for (const t of filtered) {
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
  }, [filtered, granularity]);

  const grandTotal = useMemo(() => filtered.reduce((sum, t) => sum + t.amount, 0), [filtered]);

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
            <CardTitle className={cn("flex items-center gap-2")}>
              <config.icon className={cn("h-4 w-4", toneClass)} />
              {config.title}
            </CardTitle>
            <CardDescription>ย้อนหลังตั้งแต่รายการแรกจนถึงปัจจุบัน — รวม {formatCurrency(grandTotal)}</CardDescription>
          </div>
          <div className="flex flex-wrap overflow-hidden rounded-xl border border-line/10">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGranularity(opt.value)}
                className={cn("px-3 py-1.5 text-xs font-medium", granularity === opt.value ? toneBgClass : "text-secondary/50")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {periods.length === 0 ? (
        <EmptyState icon={config.icon} title={config.empty} description="ยังไม่มีรายการบันทึกไว้" />
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
                    <span className={cn("text-base font-semibold", toneClass)}>{formatCurrency(period.total)}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-secondary/40" /> : <ChevronDown className="h-4 w-4 text-secondary/40" />}
                  </div>
                </button>
                {isOpen ? (
                  <CardContent className="pt-0">
                    <ul className="space-y-2 border-t border-line/5 pt-3">
                      {period.transactions.map((t) => (
                        <li key={t.id} className="flex flex-col gap-2 rounded-xl border border-line/5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={badgeVariant}>{t.category}</Badge>
                              <span className="text-xs text-secondary/50">{t.transaction_date}</span>
                              {t.payment_method ? <span className="text-xs text-secondary/40">{t.payment_method}</span> : null}
                            </div>
                            {t.description ? (
                              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-secondary/80">{t.description}</p>
                            ) : null}
                          </div>
                          <span className={cn("shrink-0 text-sm font-semibold sm:pl-3", toneClass)}>
                            {config.sign}
                            {formatCurrency(t.amount)}
                          </span>
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
