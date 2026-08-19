import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LABELS: Record<string, string> = {
  opening: "ทักทาย/รับข้อมูลคอร์สแล้วเงียบ",
  general: "คุยทั่วไปแล้วเงียบ",
  tool_used: "กำลังจอง/เช็คตารางแล้วเงียบ",
  handoff: "ขอคุยกับคนจริง",
  fallback: "บอทตอบไม่ได้",
};

const ORDER = ["opening", "general", "tool_used", "handoff", "fallback"];

/** "Where do customers drop off in the conversation" -- see conversations.repository.ts dropOffStageCounts(). */
export function DropOffStageCard({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const max = Math.max(1, ...Object.values(counts));

  if (total === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ลูกค้าหยุดคุยตรงไหน</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ORDER.filter((stage) => counts[stage]).map((stage) => {
          const count = counts[stage] ?? 0;
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-52 shrink-0 text-xs text-secondary/60">{LABELS[stage] ?? stage}</span>
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
