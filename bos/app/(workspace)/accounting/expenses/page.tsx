"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { ExpenseBreakdown } from "@/features/accounting/components/expense-breakdown";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function ExpenseBreakdownPage() {
  const [transactions, setTransactions] = useState<Tables<"transactions">[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.transactions.listAll().then(setTransactions);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">รายจ่ายทั้งหมด</h1>
        <p className="text-sm text-secondary/50">ดูรายจ่ายย้อนหลัง แยกตามช่วงเวลา — เห็นได้เฉพาะเจ้าของ/แอดมิน</p>
      </div>
      {transactions ? <ExpenseBreakdown transactions={transactions} /> : <Skeleton className="h-96" />}
    </div>
  );
}
