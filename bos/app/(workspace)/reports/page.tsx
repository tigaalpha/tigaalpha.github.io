"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { ReportsView } from "@/features/reports/components/reports-view";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesStatus } from "@/types/database";

interface ReportsData {
  funnel: Record<SalesStatus, number>;
  bookingCounts: { total: number; completed: number; cancelled: number };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    Promise.all([repos.sales.funnelCounts(), repos.bookings.countAll()]).then(([funnel, bookingCounts]) => {
      setData({ funnel, bookingCounts });
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Reports</h1>
        <p className="text-sm text-secondary/50">Revenue, conversion, and renewal performance</p>
      </div>
      {data ? (
        <ReportsView
          funnel={data.funnel}
          totalBookings={data.bookingCounts.total}
          completedBookings={data.bookingCounts.completed}
          cancelledBookings={data.bookingCounts.cancelled}
        />
      ) : (
        <Skeleton className="h-64" />
      )}
    </div>
  );
}
