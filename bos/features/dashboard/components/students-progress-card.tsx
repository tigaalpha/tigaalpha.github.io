import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { SalesStatus } from "@/types/database";

const STAGES: { key: SalesStatus; label: string }[] = [
  { key: "new_lead", label: "New Leads" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "trial_booked", label: "Trial Booked" },
  { key: "trial_completed", label: "Trial Done" },
  { key: "won", label: "Won" },
];

export function StudentsProgressCard({ counts }: { counts: Record<SalesStatus, number> }) {
  const values = STAGES.map((stage) => counts[stage.key] ?? 0);
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, v) => sum + v, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Students Pipeline</CardTitle>
        <Link href="/sales" className="text-xs font-medium text-purple-400 hover:text-purple-300">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState icon={TrendingUp} title="No pipeline data yet" />
        ) : (
          <ul className="space-y-4">
            {STAGES.map((stage, i) => {
              const value = values[i] ?? 0;
              const pct = Math.round((value / max) * 100);
              return (
                <li key={stage.key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-secondary/60">{stage.label}</span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
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
