"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Check, Clapperboard, FileText, Megaphone, SkipForward } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

type ContentItem = Tables<"content_calendar">;
type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "outline";

const KIND_UI: Record<ContentItem["kind"], { label: string; icon: typeof FileText; variant: BadgeVariant }> = {
  article: { label: "บทความ", icon: FileText, variant: "secondary" },
  short: { label: "วิดีโอสั้น", icon: Clapperboard, variant: "warning" },
  social: { label: "โซเชียล", icon: Megaphone, variant: "outline" },
  ad: { label: "โฆษณา", icon: Megaphone, variant: "outline" },
};

const STATUS_UI: Record<ContentItem["status"], { label: string; variant: BadgeVariant }> = {
  draft: { label: "ร่าง", variant: "outline" },
  approved: { label: "อนุมัติแล้ว", variant: "success" },
  published: { label: "เผยแพร่แล้ว", variant: "default" },
  skipped: { label: "ข้าม", variant: "secondary" },
};

export function ContentCalendarSection() {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    createRepositories(createClient())
      .aiOps.listContentCalendar()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function setStatus(item: ContentItem, status: ContentItem["status"]) {
    setBusy(item.id);
    try {
      await createClient().from("content_calendar").update({ status }).eq("id", item.id);
      reload();
    } finally {
      setBusy(null);
    }
  }

  const active = (items ?? []).filter((i) => i.status === "draft" || i.status === "approved");
  const done = (items ?? []).filter((i) => i.status === "published" || i.status === "skipped");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary-accent" />
          Content Calendar — AI วางแผนเนื้อหาให้
          <Badge variant={active.length > 0 ? "warning" : "outline"}>{active.length ?? "…"}</Badge>
        </CardTitle>
        <CardDescription>AI เสนอเนื้อหาสัปดาห์หน้า (บทความ/วิดีโอสั้น/โซเชียล) — อนุมัติแล้วค่อยนำไปเผยแพร่</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items === null ? (
          <Skeleton className="h-24" />
        ) : active.length === 0 && done.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="ยังไม่มีเนื้อหาในคิว" description="AI จะวางแผนเนื้อหาใหม่ทุกสัปดาห์ (จันทร์) มาตรวจที่นี่ได้เลย" />
        ) : (
          <>
            {active.map((item) => {
              const kind = KIND_UI[item.kind];
              const Icon = kind.icon;
              return (
                <div key={item.id} className="rounded-xl border border-line/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-secondary/50" />
                        <p className="font-medium text-secondary">{item.title}</p>
                      </div>
                      {item.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-secondary/70">{item.body}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={kind.variant}>{kind.label}</Badge>
                        {item.planned_date ? <span className="text-xs text-secondary/40">วันที่ {item.planned_date}</span> : null}
                        <Badge variant={STATUS_UI[item.status].variant}>{STATUS_UI[item.status].label}</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      {item.status === "draft" ? (
                        <Button size="sm" onClick={() => setStatus(item, "approved")} disabled={busy === item.id}>
                          <Check className="h-4 w-4" /> อนุมัติ
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setStatus(item, "published")} disabled={busy === item.id}>
                          เผยแพร่แล้ว
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setStatus(item, "skipped")} disabled={busy === item.id}>
                        <SkipForward className="h-4 w-4" /> ข้าม
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {done.length > 0 ? (
              <p className="pt-1 text-xs text-secondary/40">
                เผยแพร่/ข้ามแล้ว {done.length} ชิ้น — {done.slice(0, 5).map((i) => i.title).join(" · ")}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
