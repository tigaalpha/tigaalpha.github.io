"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { TransactionBreakdown } from "@/features/accounting/components/transaction-breakdown";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function IncomeBreakdownPage() {
  const [transactions, setTransactions] = useState<Tables<"transactions">[] | null>(null);

  async function load() {
    const repos = createRepositories(createClient());
    setTransactions(await repos.transactions.listAll());
  }

  useEffect(() => {
    load().catch(() => setTransactions([]));
  }, []);

  return (
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">รายได้ทั้งหมด</h1>
          <p className="text-sm text-secondary/50">ดูรายได้ย้อนหลัง แยกตามช่วงเวลา — เห็นได้เฉพาะเจ้าของ/แอดมิน</p>
        </div>
        {transactions ? <TransactionBreakdown transactions={transactions} type="income" onChanged={load} /> : <Skeleton className="h-96" />}
      </div>
    </OwnerOnlyGuard>
  );
}
