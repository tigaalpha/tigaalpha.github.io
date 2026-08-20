"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, RefreshCw } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VoiceCallWithCustomer } from "@/services/repositories/ai-ops.repository";

const STATUS_LABELS: Record<string, string> = {
  booked: "นัดหมายสำเร็จ",
  callback: "ขอให้โทรกลับ",
  no_answer: "ไม่รับสาย",
  completed: "คุยจบ",
  failed: "ล้มเหลว",
};

export function VoiceCallsSection() {
  const [calls, setCalls] = useState<VoiceCallWithCustomer[] | null>(null);

  async function load() {
    createRepositories(createClient())
      .aiOps.listVoiceCalls()
      .then(setCalls)
      .catch(() => setCalls([]));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary-accent" />
          สายเรียกเข้า — AI Receptionist
          <Badge variant={calls && calls.length > 0 ? "default" : "outline"}>{calls?.length ?? "…"}</Badge>
        </CardTitle>
        <CardDescription>สายที่ AI รับให้อัตโนมัติ (เช่น Bland AI) — สรุปเรื่อง + ลิงก์ลูกค้าเข้า CRM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {calls === null ? (
          <Skeleton className="h-24" />
        ) : calls.length === 0 ? (
          <EmptyState icon={Phone} title="ยังไม่มีสาย" description="เมื่อตั้งค่า AI Receptionist แล้ว สายทั้งหมดจะบันทึกที่นี่" />
        ) : (
          calls.map((call) => {
            const Out = call.direction === "outbound" ? PhoneOutgoing : PhoneIncoming;
            return (
              <div key={call.id} className="flex items-start justify-between gap-3 rounded-xl border border-line/10 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Out className={cn("h-4 w-4", call.direction === "outbound" ? "text-primary-accent" : "text-success")} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-secondary">{call.customerName ?? call.phone ?? "ไม่ทราบผู้โทร"}</p>
                    <p className="text-xs text-secondary/50">
                      {new Date(call.created_at).toLocaleString("th-TH")}
                      {call.phone ? ` · ${call.phone}` : ""}
                    </p>
                    {call.summary ? <p className="mt-1 text-sm text-secondary/70">{call.summary}</p> : null}
                  </div>
                </div>
                <Badge variant={call.status === "booked" ? "success" : call.status === "callback" ? "warning" : "outline"}>
                  {STATUS_LABELS[call.status ?? ""] ?? call.status ?? "โทรเข้า"}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
      <div className="flex justify-end px-6 pb-4">
        <Button variant="ghost" size="sm" onClick={() => load()}>
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>
    </Card>
  );
}
