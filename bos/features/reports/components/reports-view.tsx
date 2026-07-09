import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesStatus } from "@/types/database";

interface ReportsViewProps {
  funnel: Record<SalesStatus, number>;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
}

export function ReportsView({ funnel, totalBookings, completedBookings, cancelledBookings }: ReportsViewProps) {
  const conversionRate = funnel.new_lead + funnel.won > 0 ? Math.round((funnel.won / (funnel.new_lead + funnel.won || 1)) * 100) : 0;
  const renewalRate = funnel.renew_pending + funnel.renewed > 0 ? Math.round((funnel.renewed / (funnel.renew_pending + funnel.renewed)) * 100) : 0;

  const metrics = [
    { label: "Total Bookings", value: totalBookings },
    { label: "Completed Lessons", value: completedBookings },
    { label: "Cancelled Lessons", value: cancelledBookings },
    { label: "Conversion Rate", value: `${conversionRate}%` },
    { label: "Renewal Rate", value: `${renewalRate}%` },
    { label: "Won Deals", value: funnel.won },
  ];

  return (
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
  );
}
