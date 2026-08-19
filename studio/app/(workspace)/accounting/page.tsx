"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startOfYear, endOfMonth, format } from "date-fns";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { AccountingManager } from "@/features/accounting/components/accounting-manager";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

const DATE_FMT = "yyyy-MM-dd";

function AccountingPageContent() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") ?? undefined;
  const initialCourseId = searchParams.get("courseId") ?? undefined;

  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfYear(now), DATE_FMT));
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
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">Accounting</h1>
          <p className="text-sm text-secondary/50">บันทึกรายได้-รายจ่ายของธุรกิจ — เห็นได้เฉพาะเจ้าของ/แอดมิน</p>
        </div>
        {transactions ? (
          <AccountingManager
            transactions={transactions}
            startDate={startDate}
            endDate={endDate}
            onRangeChange={handleRangeChange}
            onChanged={() => reload(startDate, endDate)}
            initialCustomerId={initialCustomerId}
            initialCourseId={initialCourseId}
          />
        ) : (
          <Skeleton className="h-96" />
        )}
      </div>
    </OwnerOnlyGuard>
  );
}

export default function AccountingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AccountingPageContent />
    </Suspense>
  );
}
