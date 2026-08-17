"use client";

import { useState } from "react";
import { CheckCircle2, History, Search } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, describeFunctionError, formatCurrency } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface RecordRevenueResult {
  reference: string;
  paymentId: string;
  customerName: string;
}

/**
 * บันทึกยอดขายเก่า — สำหรับยอดที่ขาย/รับเงินไปแล้วจริง (โอนเข้าธนาคารแล้ว)
 * แต่ยังไม่เคยเข้าระบบ (เช่น ช่วงแรกๆ ที่ยังคีย์มือ): กรอกข้อมูล → ระบบสร้าง
 * ใบชำระสถานะจ่ายแล้ว + ตัดรายได้ + อัปเดต pipeline ให้ลูกค้า
 */
export function RecordRevenueCard({ onRecorded }: { onRecorded?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tables<"customers">[] | null>(null);
  const [customer, setCustomer] = useState<Tables<"customers"> | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RecordRevenueResult | null>(null);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      setResults(await createRepositories(createClient()).customers.search(q.trim()));
    } catch {
      setResults([]);
    }
  }

  async function handleRecord() {
    const n = Number(amount);
    if (!customer) {
      setError("เลือกลูกค้าก่อน");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError("กรอกจำนวนเงินให้ถูกต้อง (มากกว่า 0)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await createClient().functions.invoke("record-revenue", {
        body: {
          customerId: customer.id,
          amount: n,
          date: date.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        return;
      }
      setDone(data as RecordRevenueResult);
      setAmount("");
      setDate("");
      setNote("");
      setCustomer(null);
      setQuery("");
      setResults(null);
      onRecorded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกยอดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary-accent" />
          บันทึกยอดขายเก่า
        </CardTitle>
        <CardDescription>ยอดที่รับเงินไปแล้วจริงแต่ยังไม่เคยเข้าระบบ (ย้อนหลังได้) — สร้างใบชำระสถานะจ่ายแล้ว + ตัดรายได้ทันที</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}
        {done ? (
          <div className="space-y-2 rounded-xl border border-success/20 bg-success/5 p-4">
            <p className="flex items-start gap-2 text-sm font-medium text-secondary">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              บันทึกแล้ว: {done.customerName} — อ้างอิง {done.reference} ตัดเป็นรายได้และอัปเดต pipeline แล้ว
            </p>
            <Button variant="outline" size="sm" onClick={() => setDone(null)}>
              บันทึกรายการถัดไป
            </Button>
          </div>
        ) : (
          <>
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/40" />
                <Input
                  value={query}
                  onChange={(e) => search(e.target.value)}
                  placeholder="ค้นหาลูกค้า (พิมพ์ชื่ออย่างน้อย 2 ตัวอักษร)"
                  className="pl-9"
                />
              </div>
              {results ? (
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line/10 p-1.5">
                  {results.length === 0 ? <p className="px-2 py-1 text-sm text-secondary/50">ไม่พบลูกค้า</p> : null}
                  {results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomer(c);
                        setResults(null);
                        setQuery(c.name);
                      }}
                      className={cn(
                        "block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10",
                        customer?.id === c.id ? "bg-primary/10 text-primary-accent" : "text-secondary"
                      )}
                    >
                      {c.name}
                      <span className="ml-2 text-xs text-secondary/40">{c.phone ?? ""}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="จำนวนเงิน (บาท)" />
              <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="วันที่ (ว่าง = วันนี้)" type="date" />
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (เช่น คอร์ส 40 ชม. รอบ มิ.ย.)" />
            <Button onClick={handleRecord} disabled={busy || !customer || !amount} className="w-full">
              {busy ? "กำลังบันทึก…" : customer ? `บันทึกยอด ${formatCurrency(Number(amount) || 0)} ให้ ${customer.name}` : "บันทึกยอด"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
