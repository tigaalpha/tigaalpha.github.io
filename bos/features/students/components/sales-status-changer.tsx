"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { PIPELINE_ORDER } from "@/services/repositories/sales.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { SalesStatus } from "@/types/database";

const LOST_REASONS: { value: string; label: string }[] = [
  { value: "price", label: "ราคา/งบประมาณ" },
  { value: "timing", label: "จังหวะเวลาไม่เหมาะ" },
  { value: "competitor", label: "ไปเรียนที่อื่น" },
  { value: "no_response", label: "ติดต่อไม่ได้/เงียบหาย" },
  { value: "not_interested", label: "ไม่สนใจแล้ว" },
  { value: "other", label: "อื่นๆ" },
];

// This is the only place sales_status actually gets changed by a human
// (previously only the AI's change_sales_status tool could do it) —
// requires a lost_reason when moving to "lost" so Reports can show a real
// breakdown instead of an empty one.
export function SalesStatusChanger({
  customerId,
  currentStatus,
  onChanged,
}: {
  customerId: string;
  currentStatus: SalesStatus;
  onChanged: () => void;
}) {
  const [nextStatus, setNextStatus] = useState<SalesStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState(LOST_REASONS[0]!.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (nextStatus === currentStatus) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const repos = createRepositories(supabase);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await repos.sales.changeStatus(customerId, nextStatus, note || undefined, user?.id, nextStatus === "lost" ? lostReason : undefined);
      setNote("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary-accent" />
          เปลี่ยนสถานะการขาย
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value as SalesStatus)}
          className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {PIPELINE_ORDER.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        {nextStatus === "lost" && nextStatus !== currentStatus ? (
          <select
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {LOST_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        ) : null}

        <Textarea placeholder="หมายเหตุ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />

        <Button onClick={() => void handleSave()} disabled={saving || nextStatus === currentStatus}>
          {saving ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนสถานะ"}
        </Button>
      </CardContent>
    </Card>
  );
}
