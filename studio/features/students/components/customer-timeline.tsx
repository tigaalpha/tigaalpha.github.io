"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus,
  Wallet,
  MessageSquare,
  TrendingUp,
  Bell,
  ListTodo,
  Receipt as ReceiptIcon,
  Workflow,
  History,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { TimelineEntry, TimelineEntryType } from "@/services/repositories/timeline.repository";

const ICONS: Record<TimelineEntryType, typeof CalendarPlus> = {
  booking: CalendarPlus,
  transaction: Wallet,
  message: MessageSquare,
  sales_status: TrendingUp,
  notification: Bell,
  task: ListTodo,
  receipt: ReceiptIcon,
  automation: Workflow,
};

export function CustomerTimeline({ customerId }: { customerId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const repos = createRepositories(createClient());
    repos.timeline.getTimeline(customerId).then((result) => {
      if (!cancelled) setEntries(result);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ไทม์ไลน์ลูกค้า</CardTitle>
        <CardDescription>ทุก interaction, transaction, และ automation event ของลูกค้าคนนี้ในที่เดียว</CardDescription>
      </CardHeader>
      <CardContent>
        {entries === null ? null : entries.length === 0 ? (
          <EmptyState icon={History} title="ยังไม่มีความเคลื่อนไหว" />
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => {
              const Icon = ICONS[entry.type];
              return (
                <li key={entry.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line/10">
                    <Icon className="h-3.5 w-3.5 text-secondary/60" />
                  </div>
                  <div className="min-w-0 flex-1 border-b border-line/5 pb-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-secondary">{entry.title}</p>
                      <p className="shrink-0 text-xs text-secondary/40">{new Date(entry.timestamp).toLocaleString("th-TH")}</p>
                    </div>
                    {entry.detail ? <p className="mt-0.5 truncate text-xs text-secondary/60">{entry.detail}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
