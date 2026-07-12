"use client";

import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Wallet, TrendingUp, TrendingDown, Trash2, Download, Plus } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/features/accounting/categories";
import type { Tables, TransactionType } from "@/types/database";

interface AccountingManagerProps {
  transactions: Tables<"transactions">[];
  startDate: string;
  endDate: string;
  onRangeChange: (startDate: string, endDate: string) => void;
  onChanged: () => void;
}

const DATE_FMT = "yyyy-MM-dd";

export function AccountingManager({ transactions, startDate, endDate, onRangeChange, onChanged }: AccountingManagerProps) {
  const [type, setType] = useState<TransactionType>("income");
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]!);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(format(new Date(), DATE_FMT));
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]!);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const summary = useMemo(() => {
    const totalIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return { totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
  }, [transactions]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { type: TransactionType; total: number }>();
    for (const t of transactions) {
      const existing = map.get(t.category);
      map.set(t.category, { type: t.type, total: (existing?.total ?? 0) + t.amount });
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  function handleTypeChange(next: TransactionType) {
    setType(next);
    setCategory(next === "income" ? INCOME_CATEGORIES[0]! : EXPENSE_CATEGORIES[0]!);
  }

  function setThisMonth() {
    const now = new Date();
    onRangeChange(format(startOfMonth(now), DATE_FMT), format(endOfMonth(now), DATE_FMT));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const repos = createRepositories(createClient());
      await repos.transactions.create({
        type,
        category,
        amount: parsedAmount,
        description: description || null,
        transaction_date: transactionDate,
        payment_method: paymentMethod,
      });
      setAmount("");
      setDescription("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.transactions.delete(id);
    onChanged();
  }

  function handleExportCsv() {
    const header = "Date,Type,Category,Amount,Description,Payment Method\n";
    const rows = transactions
      .map((t) =>
        [t.transaction_date, t.type, t.category, t.amount, (t.description ?? "").replace(/,/g, " "), t.payment_method ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="รายรับ" value={formatCurrency(summary.totalIncome)} icon={TrendingUp} tone="success" />
        <SummaryCard label="รายจ่าย" value={formatCurrency(summary.totalExpense)} icon={TrendingDown} tone="danger" />
        <SummaryCard
          label="กำไรสุทธิ"
          value={formatCurrency(summary.netProfit)}
          icon={Wallet}
          tone={summary.netProfit >= 0 ? "success" : "danger"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>บันทึกรายการ</CardTitle>
          <CardDescription>บันทึกรายรับ-รายจ่ายของธุรกิจ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="flex overflow-hidden rounded-xl border border-line/10 md:col-span-1">
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={cn("flex-1 px-3 py-2 text-sm font-medium", type === "income" ? "bg-success/10 text-success" : "text-secondary/50")}
              >
                รายรับ
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={cn("flex-1 px-3 py-2 text-sm font-medium", type === "expense" ? "bg-danger/10 text-danger" : "text-secondary/50")}
              >
                รายจ่าย
              </button>
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 md:col-span-1"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="จำนวนเงิน"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="md:col-span-1"
            />

            <Input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              className="md:col-span-1"
            />

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 md:col-span-1"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <Input
              placeholder="รายละเอียด (ไม่บังคับ)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="md:col-span-1"
            />

            {error ? <p className="text-xs text-danger md:col-span-6">{error}</p> : null}
            <Button type="submit" className="md:col-span-6" disabled={submitting}>
              <Plus className="h-4 w-4" />
              {submitting ? "กำลังบันทึก…" : "บันทึกรายการ"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>รายการ ({transactions.length})</CardTitle>
              <CardDescription>
                {startDate} ถึง {endDate}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={startDate} onChange={(e) => onRangeChange(e.target.value, endDate)} className="h-9 w-36" />
              <Input type="date" value={endDate} onChange={(e) => onRangeChange(startDate, e.target.value)} className="h-9 w-36" />
              <Button variant="outline" size="sm" onClick={setThisMonth}>
                เดือนนี้
              </Button>
              <Button variant="ghost" size="icon" onClick={handleExportCsv} disabled={transactions.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <EmptyState icon={Wallet} title="ยังไม่มีรายการในช่วงนี้" description="บันทึกรายการแรกด้านบน" />
            ) : (
              <ul className="space-y-2">
                {transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line/5 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={t.type === "income" ? "success" : "danger"}>{t.type === "income" ? "รายรับ" : "รายจ่าย"}</Badge>
                        <span className="text-sm font-medium text-secondary">{t.category}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-secondary/50">
                        {t.transaction_date} {t.description ? `— ${t.description}` : ""} {t.payment_method ? `(${t.payment_method})` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-sm font-semibold", t.type === "income" ? "text-success" : "text-danger")}>
                        {t.type === "income" ? "+" : "-"}
                        {formatCurrency(t.amount)}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>สรุปตามหมวดหมู่</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <EmptyState icon={Wallet} title="ยังไม่มีข้อมูล" />
            ) : (
              <ul className="space-y-2">
                {byCategory.map((c) => (
                  <li key={c.category} className="flex items-center justify-between text-sm">
                    <span className="text-secondary/70">{c.category}</span>
                    <span className={cn("font-medium", c.type === "income" ? "text-success" : "text-danger")}>
                      {formatCurrency(c.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs text-secondary/50">{label}</p>
          <p className={cn("mt-1 text-xl font-semibold", tone === "success" ? "text-success" : "text-danger")}>{value}</p>
        </div>
        <div className={cn("rounded-full p-2.5", tone === "success" ? "bg-success/10" : "bg-danger/10")}>
          <Icon className={cn("h-5 w-5", tone === "success" ? "text-success" : "text-danger")} />
        </div>
      </CardContent>
    </Card>
  );
}
