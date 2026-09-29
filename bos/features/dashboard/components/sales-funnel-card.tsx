import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/language-context";
import type { DictKey } from "@/lib/i18n";
import type { SalesStatus } from "@/types/database";

const LABELS: Record<SalesStatus, DictKey> = {
  new_lead: "funnel.newLead",
  contacted: "funnel.contacted",
  qualified: "funnel.qualified",
  interested: "funnel.interested",
  trial_booked: "funnel.trialBooked",
  trial_completed: "funnel.trialCompleted",
  negotiating: "funnel.negotiating",
  waiting_decision: "funnel.waitingDecision",
  won: "funnel.won",
  lost: "funnel.lost",
  renew_pending: "funnel.renewPending",
  renewed: "funnel.renewed",
};

export function SalesFunnelCard({ counts }: { counts: Record<SalesStatus, number> }) {
  const t = useT();
  const max = Math.max(1, ...Object.values(counts));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("funnel.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(Object.keys(LABELS) as SalesStatus[]).map((status) => (
          <div key={status} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-secondary/60">{t(LABELS[status])}</span>
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
