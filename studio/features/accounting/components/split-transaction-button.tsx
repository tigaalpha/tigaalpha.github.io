"use client";

import { useState } from "react";
import { Split, Search, X } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeFunctionError, formatCurrency } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface SplitRow {
  customer: Tables<"customers">;
  amount: string;
}

/**
 * แยกยอดรวมเป็นรายลูกค้า — ยอดที่บันทึกเป็นก้อนเดียวหลายคน (เช่น
 * "แดง, Angelica, Harmess... 95,401 บาท") จะถูกแยกเป็นรายการต่อคน + ผูก
 * customer_id เพื่อให้ pipeline/การต่อคอร์ส/CAC เห็นเงินต่อคน เรียก
 * split-transaction ซึ่งสร้างรายการย่อยและลด/ลบรายการเดิม
 */
export function SplitTransactionButton({
  transaction,
  onDone,
}: {
  transaction: Tables<"transactions">;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tables<"customers">[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      setResults(await createRepositories(createClient()).customers.search(q.trim(), 5));
    } catch {
      setResults([]);
    }
  }

  function addCustomer(c: Tables<"customers">) {
    setRows((r) => [...r, { customer: c, amount: "" }]);
    setQuery("");
    setResults(null);
  }

  async function handleSplit() {
    const splits = rows
      .map((r) => ({ customerId: r.customer.id, amount: Number(r.amount) }))
      .filter((s) => Number.isFinite(s.amount) && s.amount > 0);
    if (splits.length === 0 || splits.length !== rows.length) {
      setError("กรอกจำนวนเงินให้ครบทุกคน (มากกว่า 0)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: fnError } = await createClient().functions.invoke("split-transaction", {
        body: { transactionId: transaction.id, splits },
      });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        return;
      }
      setOpen(false);
      setRows([]);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "แยกยอดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const remaining = Number(transaction.amount) - rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} className="h-7 gap-1.5 px-2.5 text-xs">
        <Split className="h-3.5 w-3.5" />
        แยกยอด
      </Button>
      {open ? (
        <div className="w-full max-w-sm space-y-2 rounded-xl border border-line/10 bg-background p-3 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-secondary">แยกยอด {formatCurrency(Number(transaction.amount))} ต่อลูกค้า</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="ปิด">
              <X className="h-4 w-4 text-secondary/50" />
            </button>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {rows.map((r, i) => (
            <div key={r.customer.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-secondary">{r.customer.name}</span>
              <Input
                value={r.amount}
                onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, amount: e.target.value } : row)))}
                inputMode="numeric"
                placeholder="บาท"
                className="h-8 w-24"
              />
              <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} aria-label="ลบ">
                <X className="h-4 w-4 text-secondary/40" />
              </button>
            </div>
          ))}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary/40" />
            <Input value={query} onChange={(e) => search(e.target.value)} placeholder="เพิ่มลูกค้า (ชื่อ 2 ตัวอักษรขึ้นไป)" className="h-8 pl-8 text-xs" />
            {results ? (
              <div className="absolute z-10 mt-1 max-h-40 w-full space-y-0.5 overflow-y-auto rounded-lg border border-line/10 bg-background p-1 shadow-md">
                {results.length === 0 ? <p className="px-2 py-1 text-xs text-secondary/50">ไม่พบลูกค้า</p> : null}
                {results.map((c) => (
                  <button key={c.id} type="button" onClick={() => addCustomer(c)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-secondary hover:bg-primary/10">
                    {c.name} <span className="text-secondary/40">{c.phone ?? ""}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <p className="text-[11px] text-secondary/50">
            คงเหลือในรายการเดิม: {formatCurrency(Math.max(remaining, 0))} {remaining < 0 ? "(เกินยอด!)" : ""}
          </p>
          <Button size="sm" onClick={handleSplit} disabled={busy || rows.length === 0} className="w-full">
            {busy ? "กำลังแยก…" : "แยกยอด"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
