"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types/database";

export function StudentProgressAi({ customerId }: { customerId: string }) {
  const [reports, setReports] = useState<Tables<"ai_reports">[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    const repos = createRepositories(createClient());
    repos.aiReports.listForCustomer(customerId, "student_progress").then(setReports);
  }

  useEffect(() => {
    reload();
  }, [customerId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: invokeError } = await supabase.functions.invoke("generate-student-progress", { body: { customerId } });
      if (invokeError) throw invokeError;
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างสรุปไม่สำเร็จ");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>สรุปพัฒนาการ (AI)</CardTitle>
          <CardDescription>วิเคราะห์การเข้าเรียน/ชั่วโมงคงเหลือ แล้วสรุปเป็นภาษาที่อ่านง่าย</CardDescription>
        </div>
        <Button size="sm" onClick={() => void handleGenerate()} disabled={generating}>
          <Sparkles className="h-3.5 w-3.5" />
          {generating ? "กำลังสร้าง…" : "สร้างสรุปพัฒนาการ"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        {reports === null || reports.length === 0 ? (
          <p className="text-sm text-secondary/50">ยังไม่มีสรุปพัฒนาการ — กดปุ่มด้านบนเพื่อสร้างครั้งแรก</p>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="rounded-xl border border-line/10 p-4">
              <p className="mb-1 text-xs text-secondary/40">{new Date(report.created_at).toLocaleString("th-TH")}</p>
              <p className="whitespace-pre-wrap text-sm text-secondary/80">{report.content}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
