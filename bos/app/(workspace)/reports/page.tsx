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
  revenue: number;
  teacherPerformance: { teacherId: string; teacherName: string; completedLessons: number }[];
  leadSources: Record<string, number>;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    Promise.all([
      repos.sales.funnelCounts(),
      repos.bookings.countAll(),
      repos.courses.totalRevenue(),
      repos.bookings.countCompletedByTeacher(),
      repos.teachers.listActive(),
      repos.customers.countByLeadSource(),
    ]).then(([funnel, bookingCounts, revenue, completedByTeacher, teachers, leadSources]) => {
      const teacherPerformance = teachers.map((teacher) => ({
        teacherId: teacher.id,
        teacherName: teacher.name,
        completedLessons: completedByTeacher[teacher.id] ?? 0,
      }));
      setData({ funnel, bookingCounts, revenue, teacherPerformance, leadSources });
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
          revenue={data.revenue}
          teacherPerformance={data.teacherPerformance}
          leadSources={data.leadSources}
        />
      ) : (
        <Skeleton className="h-64" />
      )}
    </div>
  );
}
