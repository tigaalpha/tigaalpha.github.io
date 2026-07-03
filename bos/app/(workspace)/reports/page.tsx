import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { ReportsView } from "@/features/reports/components/reports-view";

export default async function ReportsPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const [funnel, bookingCounts] = await Promise.all([repos.sales.funnelCounts(), repos.bookings.countAll()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Reports</h1>
        <p className="text-sm text-secondary/50">Revenue, conversion, and renewal performance</p>
      </div>
      <ReportsView
        funnel={funnel}
        totalBookings={bookingCounts.total}
        completedBookings={bookingCounts.completed}
        cancelledBookings={bookingCounts.cancelled}
      />
    </div>
  );
}
