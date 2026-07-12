"use client";

import { useCallback, useEffect, useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { AccountingManager } from "@/features/accounting/components/accounting-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

const DATE_FMT = "yyyy-MM-dd";

export default function AccountingPage() {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), DATE_FMT));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), DATE_FMT));
  const [transactions, setTransactions] = useState<Tables<"transactions">[] | null>(null);

  const reload = useCallback((start: string, end: string) => {
    const repos = createRepositories(createClient());
    repos.transactions.listBetween(start, end).then(setTransactions);
  }, []);

  useEffect(() => {
    reload(startDate, endDate);
  }, [reload, startDate, endDate]);

  function handleRangeChange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Accounting</h1>
        <p className="text-sm text-secondary/50">บันทึกรายรับ-รายจ่ายของธุรกิจ — เห็นได้เฉพาะเจ้าของ/แอดมิน</p>
      </div>
      {transactions ? (
        <AccountingManager
          transactions={transactions}
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleRangeChange}
          onChanged={() => reload(startDate, endDate)}
        />
      ) : (
        <Skeleton className="h-96" />
      )}
    </div>
  );
}
