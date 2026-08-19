"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Wallet, TrendingUp, TrendingDown, Trash2, Download, Plus, FileSpreadsheet, Upload, X } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/features/accounting/categories";
import { parseExcelTransactions, type ParseExcelResult } from "@/lib/parse-excel-transactions";
import type { Tables, TransactionType } from "@/types/database";

interface AccountingManagerProps {
  transactions: Tables<"transactions">[];
  startDate: string;
  endDate: string;
  onRangeChange: (startDate: string, endDate: string) => void;
  onChanged: () => void;
  initialCustomerId?: string;
  initialCourseId?: string;
}

const DATE_FMT = "yyyy-MM-dd";

export function AccountingManager({ transactions, startDate, endDate, onRangeChange, onChanged, initialCustomerId, initialCourseId }: AccountingManagerProps) {
  const [type, setType] = useState<TransactionType>("income");
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]!);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(format(new Date(), DATE_FMT));
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]!);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional customer/course link (e.g. a renewal payment) -- same
  // debounced-search pattern as legal-document-manager.tsx's customer
  // picker, the only precedent for this in the codebase.
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Tables<"customers">[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Tables<"customers"> | null>(null);
  const [customerCourses, setCustomerCourses] = useState<Tables<"courses">[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  useEffect(() => {
    if (!initialCustomerId) return;
    const repos = createRepositories(createClient());
    repos.customers.findById(initialCustomerId).then((c) => {
      if (c) setSelectedCustomer(c);
    });
  }, [initialCustomerId]);

  useEffect(() => {
    if (!customerQuery.trim()) {
      setCustomerResults([]);
      return;
    }
    const repos = createRepositories(createClient());
    const timeout = setTimeout(() => {
      repos.customers.search(customerQuery.trim(), 5).then(setCustomerResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerQuery]);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerCourses([]);
      setSelectedCourseId("");
      return;
    }
    const repos = createRepositories(createClient());
    repos.courses.listForCustomer(selectedCustomer.id).then((courses) => {
      setCustomerCourses(courses);
      setSelectedCourseId((current) => (initialCourseId && courses.some((c) => c.id === initialCourseId) ? initialCourseId : current));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer]);

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
  }

  const [importPreview, setImportPreview] = useState<ParseExcelResult | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [importingRows, setImportingRows] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        customer_id: selectedCustomer?.id ?? null,
        course_id: selectedCourseId || null,
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

  async function handleExcelFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportPreview(null);
    setImportFileName(file.name);
    setParsingFile(true);
    try {
      const result = await parseExcelTransactions(file);
      setImportPreview(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setParsingFile(false);
    }
  }

  async function handleConfirmImport() {
    if (!importPreview || importPreview.rows.length === 0) return;
    setImportingRows(true);
    setImportError(null);
    try {
      const repos = createRepositories(createClient());
      await repos.transactions.createMany(importPreview.rows);
      setImportPreview(null);
      setImportFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onChanged();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setImportingRows(false);
    }
  }

  function handleCancelImport() {
    setImportPreview(null);
    setImportFileName(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="รายได้"
          value={formatCurrency(summary.totalIncome)}
          icon={TrendingUp}
          tone="success"
          href="/accounting/income"
        />
        <SummaryCard
          label="รายจ่าย"
          value={formatCurrency(summary.totalExpense)}
          icon={TrendingDown}
          tone="danger"
          href="/accounting/expenses"
        />
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
          <CardDescription>บันทึกรายได้-รายจ่ายของธุรกิจ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="flex overflow-hidden rounded-xl border border-line/10 md:col-span-1">
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={cn("flex-1 px-3 py-2 text-sm font-medium", type === "income" ? "bg-success/10 text-success" : "text-secondary/50")}
              >
                รายได้
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

            <div className="md:col-span-3">
              <div className="relative">
                <Input
                  placeholder="ผูกกับลูกค้า / คอร์ส (ไม่บังคับ)"
                  value={selectedCustomer ? selectedCustomer.name : customerQuery}
                  onChange={(e) => {
                    setSelectedCustomer(null);
                    setCustomerQuery(e.target.value);
                  }}
                  disabled={Boolean(selectedCustomer)}
                />
                {customerResults.length > 0 && !selectedCustomer ? (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-line/10 bg-card shadow-card">
                    {customerResults.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-line/5"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerResults([]);
                        }}
                      >
                        {c.name} {c.phone ? `— ${c.phone}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedCustomer ? (
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary/50 hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {selectedCustomer && customerCourses.length > 0 ? (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 md:col-span-3"
              >
                <option value="">ไม่ระบุคอร์ส</option>
                {customerCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    คอร์ส {c.total_hours} ชม. (เหลือ {c.remaining_hour} ชม.)
                  </option>
                ))}
              </select>
            ) : null}

            {error ? <p className="text-xs text-danger md:col-span-6">{error}</p> : null}
            <Button type="submit" className="md:col-span-6" disabled={submitting}>
              <Plus className="h-4 w-4" />
              {submitting ? "กำลังบันทึก…" : "บันทึกรายการ"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>นำเข้าจาก Excel</CardTitle>
          <CardDescription>
            อัปโหลดไฟล์ .xlsx ที่มีแถวหัวตาราง (แถวแรก) เป็น: วันที่, ประเภท (รายได้/รายจ่าย), หมวดหมู่, จำนวนเงิน,
            รายละเอียด (ไม่บังคับ), ช่องทางชำระ (ไม่บังคับ) — ข้อมูลจะถูกอ่านในเบราว์เซอร์ ไม่มีการอัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileSelected}
              className="block w-full text-sm text-secondary/70 file:mr-3 file:rounded-xl file:border-0 file:bg-line/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary hover:file:bg-line/20"
            />
            {parsingFile ? <span className="whitespace-nowrap text-xs text-secondary/50">กำลังอ่านไฟล์…</span> : null}
          </div>

          {importError ? <p className="text-sm text-danger">{importError}</p> : null}

          {importPreview ? (
            <div className="space-y-3 rounded-xl border border-line/10 p-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-secondary/50" />
                <p className="text-sm font-medium text-secondary">{importFileName}</p>
              </div>
              <p className="text-sm text-secondary/70">
                พบ <span className="font-semibold text-success">{importPreview.rows.length}</span> รายการที่พร้อมนำเข้า
                {importPreview.skipped.length > 0 ? (
                  <>
                    {" "}
                    และ <span className="font-semibold text-danger">{importPreview.skipped.length}</span> แถวที่ข้าม
                  </>
                ) : null}
              </p>

              {importPreview.skipped.length > 0 ? (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-secondary/50">
                  {importPreview.skipped.map((s, i) => (
                    <li key={i}>
                      แถวที่ {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex gap-2">
                <Button onClick={handleConfirmImport} disabled={importingRows || importPreview.rows.length === 0}>
                  <Upload className="h-4 w-4" />
                  {importingRows ? "กำลังนำเข้า…" : `ยืนยันนำเข้า ${importPreview.rows.length} รายการ`}
                </Button>
                <Button variant="outline" onClick={handleCancelImport} disabled={importingRows}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          ) : null}
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
                        <Badge variant={t.type === "income" ? "success" : "danger"}>{t.type === "income" ? "รายได้" : "รายจ่าย"}</Badge>
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
  href,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "danger";
  href?: string;
}) {
  const content = (
    <CardContent className="flex items-center justify-between p-5">
      <div>
        <p className="text-xs text-secondary/50">{label}</p>
        <p className={cn("mt-1 text-xl font-semibold", tone === "success" ? "text-success" : "text-danger")}>{value}</p>
      </div>
      <div className={cn("rounded-full p-2.5", tone === "success" ? "bg-success/10" : "bg-danger/10")}>
        <Icon className={cn("h-5 w-5", tone === "success" ? "text-success" : "text-danger")} />
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className={cn("transition-colors", tone === "success" ? "hover:border-success/30" : "hover:border-danger/30")}>{content}</Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
