"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// The owner's kill switch for AI auto-replies to LINE customers (see
// line-webhook/index.ts's isSafeModeOn). Reads/writes the same
// schema-free integration_settings key/value store every other toggle
// on this page already uses -- no migration needed.
export function SafeModeCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.integrations.get("safe_mode").then((v) => setEnabled(v === "true"));
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setSaving(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("safe_mode", next ? "true" : "false");
    setEnabled(next);
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-danger" />
          Safe Mode
        </CardTitle>
        <CardDescription>ปิดการตอบลูกค้าอัตโนมัติทาง LINE ชั่วคราว ให้เจ้าของตอบเองแทน</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {enabled === null ? (
          <Skeleton className="h-16" />
        ) : (
          <>
            <p className="text-sm text-secondary/70">
              เมื่อเปิด Safe Mode: ข้อความจากลูกค้าทาง LINE จะ<b>ไม่ถูก AI ตอบกลับใดๆ เลย</b> (ไม่มีแม้ข้อความสำรอง) — ระบบจะแจ้งเตือนเจ้าของทันที
              (ในแอปและ LINE ถ้าตั้งค่า LINE User ID เจ้าของไว้แล้ว) พร้อมชื่อลูกค้าและข้อความ ให้เจ้าของไปตอบลูกค้าเองนอกระบบระหว่างที่เปิดโหมดนี้
              — ไม่กระทบผู้ช่วย AI ส่วนตัวของเจ้าของ (TIGA AI Agent) ซึ่งยังใช้งานได้ตามปกติ
            </p>
            <div className="flex items-center justify-between rounded-xl border border-line/10 p-3">
              <Badge variant={enabled ? "danger" : "outline"}>{enabled ? "เปิดอยู่ — AI หยุดตอบลูกค้า" : "ปิดอยู่ — AI ตอบลูกค้าปกติ"}</Badge>
              <Button variant={enabled ? "outline" : "primary"} size="sm" onClick={() => void toggle()} disabled={saving}>
                {saving ? "กำลังบันทึก…" : enabled ? "ปิด Safe Mode" : "เปิด Safe Mode"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
