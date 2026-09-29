import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useT } from "@/lib/language-context";
import type { DictKey } from "@/lib/i18n";
import type { SalesStatus } from "@/types/database";

const STAGES: { key: SalesStatus; labelKey: DictKey }[] = [
  { key: "new_lead", labelKey: "pipeline.newLead" },
  { key: "contacted", labelKey: "pipeline.contacted" },
  { key: "interested", labelKey: "pipeline.interested" },
  { key: "trial_booked", labelKey: "pipeline.trialBooked" },
  { key: "trial_completed", labelKey: "pipeline.trialDone" },
  { key: "won", labelKey: "pipeline.won" },
];

export function StudentsProgressCard({ counts }: { counts: Record<SalesStatus, number> }) {
  const t = useT();
  const values = STAGES.map((stage) => counts[stage.key] ?? 0);
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, v) => sum + v, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t("pipeline.title")}</CardTitle>
        <Link href="/sales" className="text-xs font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300">
          {t("activity.viewAll")}
        </Link>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState icon={TrendingUp} title={t("pipeline.empty")} />
        ) : (
          <ul className="space-y-4">
            {STAGES.map((stage, i) => {
              const value = values[i] ?? 0;
              const pct = Math.round((value / max) * 100);
              return (
                <li key={stage.key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-secondary/60">{t(stage.labelKey)}</span>
                    <span className="font-semibold text-secondary dark:text-white">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line/[0.06] dark:bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.6)] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
