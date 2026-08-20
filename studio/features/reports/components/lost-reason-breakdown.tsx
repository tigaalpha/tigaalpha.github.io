"use client";

import { useEffect, useState } from "react";
import { XCircle } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const LABELS: Record<string, string> = {
  price: "ราคา/งบประมาณ",
  timing: "จังหวะเวลาไม่เหมาะ",
  competitor: "ไปเรียนที่อื่น",
  no_response: "ติดต่อไม่ได้/เงียบหาย",
  not_interested: "ไม่สนใจแล้ว",
  other: "อื่นๆ",
};

export function LostReasonBreakdown() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.sales.lostReasonCounts().then(setCounts);
  }, []);

  const entries = counts ? Object.entries(counts).sort(([, a], [, b]) => b - a) : [];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-danger" />
          สาเหตุที่เสียลูกค้า (Lost Reasons)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {counts === null ? null : entries.length === 0 ? (
          <EmptyState icon={XCircle} title="ยังไม่มีข้อมูล" description="จะเก็บให้เองเมื่อมีการเปลี่ยนสถานะลูกค้าเป็น Lost พร้อมระบุสาเหตุ" />
        ) : (
          <ul className="space-y-2.5">
            {entries.map(([reason, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <li key={reason} className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">{LABELS[reason] ?? reason}</span>
                    <span className="font-medium text-secondary/70">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line/10">
                    <div className="h-full rounded-full bg-danger/60" style={{ width: `${pct}%` }} />
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
