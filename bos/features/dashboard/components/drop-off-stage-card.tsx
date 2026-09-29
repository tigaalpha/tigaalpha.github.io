import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/language-context";
import type { DictKey } from "@/lib/i18n";

const LABELS: Record<string, DictKey> = {
  opening: "dropoff.opening",
  general: "dropoff.general",
  tool_used: "dropoff.toolUsed",
  handoff: "dropoff.handoff",
  fallback: "dropoff.fallback",
};

const ORDER = ["opening", "general", "tool_used", "handoff", "fallback"];

/** "Where do customers drop off in the conversation" -- see conversations.repository.ts dropOffStageCounts(). */
export function DropOffStageCard({ counts }: { counts: Record<string, number> }) {
  const t = useT();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const max = Math.max(1, ...Object.values(counts));

  if (total === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dropoff.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ORDER.filter((stage) => counts[stage]).map((stage) => {
          const count = counts[stage] ?? 0;
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-52 shrink-0 text-xs text-secondary/60">{LABELS[stage] ? t(LABELS[stage]) : stage}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/5">
                <div className="h-full rounded-full bg-primary-gradient" style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-medium text-secondary">{count}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
