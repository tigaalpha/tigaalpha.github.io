import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users2, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { SalesStatus } from "@/types/database";

interface TeacherPerformanceRow {
  teacherId: string;
  teacherName: string;
  completedLessons: number;
}

interface ReportsViewProps {
  funnel: Record<SalesStatus, number>;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  revenue: number;
  teacherPerformance: TeacherPerformanceRow[];
  leadSources: Record<string, number>;
}

export function ReportsView({
  funnel,
  totalBookings,
  completedBookings,
  cancelledBookings,
  revenue,
  teacherPerformance,
  leadSources,
}: ReportsViewProps) {
  const conversionRate = funnel.new_lead + funnel.won > 0 ? Math.round((funnel.won / (funnel.new_lead + funnel.won || 1)) * 100) : 0;
  const renewalRate = funnel.renew_pending + funnel.renewed > 0 ? Math.round((funnel.renewed / (funnel.renew_pending + funnel.renewed)) * 100) : 0;

  const metrics = [
    { label: "Revenue", value: formatCurrency(revenue) },
    { label: "Total Bookings", value: totalBookings },
    { label: "Completed Lessons", value: completedBookings },
    { label: "Cancelled Lessons", value: cancelledBookings },
    { label: "Conversion Rate", value: `${conversionRate}%` },
    { label: "Renewal Rate", value: `${renewalRate}%` },
    { label: "Won Deals", value: funnel.won },
  ];

  const sortedTeachers = [...teacherPerformance].sort((a, b) => b.completedLessons - a.completedLessons);
  const sortedLeadSources = Object.entries(leadSources).sort(([, a], [, b]) => b - a);
  const leadSourceTotal = sortedLeadSources.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-secondary/60">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-3xl font-semibold text-secondary">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Teacher Performance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {sortedTeachers.length === 0 ? (
              <EmptyState icon={Users2} title="No completed lessons yet" />
            ) : (
              <ul className="divide-y divide-line/5">
                {sortedTeachers.map((row) => (
                  <li key={row.teacherId} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-secondary">{row.teacherName}</span>
                    <span className="font-medium text-secondary/70">{row.completedLessons} lessons</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {sortedLeadSources.length === 0 ? (
              <EmptyState icon={BarChart3} title="No leads yet" />
            ) : (
              <ul className="space-y-2.5">
                {sortedLeadSources.map(([source, count]) => {
                  const pct = leadSourceTotal > 0 ? Math.round((count / leadSourceTotal) * 100) : 0;
                  return (
                    <li key={source} className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-secondary">{source}</span>
                        <span className="font-medium text-secondary/70">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line/10">
                        <div className="h-full rounded-full bg-primary-gradient" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
