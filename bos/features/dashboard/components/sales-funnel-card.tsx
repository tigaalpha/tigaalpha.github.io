import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesStatus } from "@/types/database";

const LABELS: Record<SalesStatus, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  interested: "Interested",
  trial_booked: "Trial Booked",
  trial_completed: "Trial Completed",
  negotiating: "Negotiating",
  waiting_decision: "Waiting Decision",
  won: "Won",
  lost: "Lost",
  renew_pending: "Renew Pending",
  renewed: "Renewed",
};

export function SalesFunnelCard({ counts }: { counts: Record<SalesStatus, number> }) {
  const max = Math.max(1, ...Object.values(counts));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(Object.keys(LABELS) as SalesStatus[]).map((status) => (
          <div key={status} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-secondary/60">{LABELS[status]}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/5">
              <div
                className="h-full rounded-full bg-primary-gradient"
                style={{ width: `${(counts[status] / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium text-secondary">{counts[status]}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
