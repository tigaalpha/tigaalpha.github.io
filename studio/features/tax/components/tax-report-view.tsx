"use client";

import { useState } from "react";
import { FileSpreadsheet, Landmark, RefreshCw } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { describeFunctionError, formatCurrency } from "@/lib/utils";

interface PayrollEntry {
  teacherId: string;
  teacherName: string;
  gross: number;
  withholding: number;
}

interface TaxReport {
  month: string;
  monthLabel: string;
  income: number;
  expense: number;
  profit: number;
  vatRegistered: boolean;
  vatAmount: number;
  withholdingRate: number;
  teacherPayroll: number;
  totalWithholding: number;
  payrollEntries: PayrollEntry[];
  byCategory: Record<string, { income: number; expense: number }>;
  disclaimer: string;
}

export function TaxReportView() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [report, setReport] = useState<TaxReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await createClient().functions.invoke<TaxReport>("tax-report", { body: { month } });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        return;
      }
      setReport(data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "คำนวณไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!report) return;
    const rows: string[][] = [
      ["หมวดหมู่", "รายรับ", "รายจ่าย"],
      ...Object.entries(report.byCategory).map(([cat, v]) => [cat, String(v.income), String(v.expense)]),
      ["", "", ""],
      ["ครู", "ยอดรวม", "หัก ณ ที่จ่าย 3%"],
      ...report.payrollEntries.map((p) => [p.teacherName, String(p.gross), String(p.withholding)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-${report.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">ภาษีอัตโนมัติ</h1>
        <p className="text-sm text-secondary/50">คำนวณ VAT / หัก ณ ที่จ่าย / สรุปเงินได้จากข้อมูลจริงในระบบ — ช่วยยื่นภาษี</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
          />
          <Button onClick={load} disabled={busy}>
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
            คำนวณภาษี
          </Button>
          {report ? (
            <Button variant="ghost" onClick={exportCsv}>
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </CardContent>
      </Card>

      {!report ? (
        <EmptyState
          icon={Landmark}
          title="ยังไม่ได้คำนวณ"
          description="เลือกเดือนแล้วกดคำนวณ — ระบบจะอ่าน transactions และ payroll ครูของเดือนนั้น"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary/60">รายรับรวม</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-success">{formatCurrency(report.income)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary/60">รายจ่ายรวม</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-danger">{formatCurrency(report.expense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary/60">กำไร (ฐาน PND 90)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-secondary">{formatCurrency(report.profit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-secondary/60">
                  ค่าแรงครู
                  <Badge variant={report.vatRegistered ? "warning" : "outline"}>{report.vatRegistered ? "จด VAT" : "ยังไม่จด VAT"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-secondary">{formatCurrency(report.teacherPayroll)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ภาษีที่ต้องชำระ/นำส่ง</CardTitle>
                <CardDescription>ตัวเลขช่วยยื่น — ตรวจกับเอกสารจริงก่อนยื่นผ่านระบบสรรพากร</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-line/10 p-3">
                  <div>
                    <p className="text-sm font-medium text-secondary">VAT 7% จากรายรับ</p>
                    <p className="text-xs text-secondary/50">เฉพาะเมื่อจด VAT — ตั้งค่าได้ที่ Settings (vat_registered)</p>
                  </div>
                  <p className="font-semibold text-secondary">{formatCurrency(report.vatAmount)}</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line/10 p-3">
                  <div>
                    <p className="text-sm font-medium text-secondary">หัก ณ ที่จ่ายครู (PND 3) {Math.round(report.withholdingRate * 100)}%</p>
                    <p className="text-xs text-secondary/50">ยอดจ่ายครู {formatCurrency(report.teacherPayroll)}</p>
                  </div>
                  <p className="font-semibold text-warning">{formatCurrency(report.totalWithholding)}</p>
                </div>
                <p className="rounded-lg bg-secondary/5 px-3 py-2 text-xs text-secondary/50">{report.disclaimer}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>สรุปรายครู (PND 3)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.payrollEntries.length === 0 ? (
                  <p className="text-sm text-secondary/50">เดือนนี้ยังไม่มีข้อมูลชั่วโมงสอน</p>
                ) : (
                  report.payrollEntries.map((p) => (
                    <div key={p.teacherId} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                      <p className="text-sm text-secondary">{p.teacherName}</p>
                      <p className="text-sm text-secondary/70">
                        {formatCurrency(p.gross)} — หัก ณ ที่จ่าย <span className="text-warning">{formatCurrency(p.withholding)}</span>
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
