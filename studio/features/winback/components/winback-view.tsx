"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Send, X, Sparkles } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Campaign = Tables<"winback_campaigns"> & { customerName: string | null };

const STATUS_LABELS: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปัดทิ้ง",
  sent: "ส่งแล้ว",
  converted: "กลับมาเรียน",
  dismissed: "ปิดแล้ว",
};
const STATUS_VARIANT: Record<string, "warning" | "success" | "danger" | "outline"> = {
  pending: "warning",
  sent: "success",
  converted: "success",
  rejected: "danger",
  dismissed: "outline",
  approved: "outline",
};

export function WinbackView() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    createRepositories(createClient())
      .aiOps.listWinbackCampaigns()
      .then(setCampaigns)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function decide(campaign: Campaign, action: "approve" | "reject" | "dismiss") {
    setBusyId(campaign.id);
    setError(null);
    try {
      const { error: fnError } = await createClient().functions.invoke("winback-action", { body: { id: campaign.id, action } });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        return;
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "จัดการไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  const pending = (campaigns ?? []).filter((c) => c.status === "pending");
  const history = (campaigns ?? []).filter((c) => c.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Win-back — ไล่ตามลูกค้าที่หายไป</h1>
        <p className="text-sm text-secondary/50">
          AI หานักเรียนที่เงียบไป 45+ วัน หรือชั่วโมงเหลือ ≤ 2 ชม. และร่างข้อความไล่ตามเฉพาะบุคคล — อนุมัติแล้วระบบจะส่ง LINE + ใบแจ้งชำระให้อัตโนมัติ
        </p>
      </div>

      {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {campaigns === null ? (
        <Skeleton className="h-48" />
      ) : pending.length === 0 && history.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="ยังไม่มีแคมเปญ"
          description="cron รันทุกเช้า 03:00 — ถ้าเจอนักเรียนที่เงียบไป ระบบจะร่างข้อเสนอให้อนุมัติที่นี่"
        />
      ) : (
        <>
          <div className="space-y-3">
            {pending.map((c) => (
              <Card key={c.id} className="border-warning/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {c.customerName ?? "ลูกค้า"}
                    <Badge variant="warning">รออนุมัติ</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-wrap text-sm text-secondary/80">{c.offer_text}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(c, "approve")} disabled={busyId === c.id}>
                      <Send className="h-4 w-4" />
                      อนุมัติ + ส่ง LINE
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(c, "reject")} disabled={busyId === c.id}>
                      <X className="h-4 w-4" />
                      ปัดทิ้ง
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(c, "dismiss")} disabled={busyId === c.id}>
                      เก็บไว้ก่อน
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {history.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ประวัติ</CardTitle>
                <CardDescription>{history.length} แคมเปญก่อนหน้า</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.slice(0, 20).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-secondary">
                        {c.customerName ?? "ลูกค้า"} — {c.offer_text.slice(0, 80)}
                      </p>
                      <p className="text-xs text-secondary/40">{new Date(c.created_at).toLocaleString("th-TH")}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.status === "sent" ? <Check className="h-4 w-4 text-success" /> : null}
                      <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{STATUS_LABELS[c.status] ?? c.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
