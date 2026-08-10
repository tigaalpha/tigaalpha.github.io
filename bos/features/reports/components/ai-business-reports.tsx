"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/types/database";

// Fed by ai-briefing-runner (pg_cron, daily + weekly — see the Level 3 AI
// Workforce plan). Self-fetching rather than threaded through the Reports
// page's existing props chain, same pattern as CustomerTimeline/
// StudentProgressAi on the student detail page.
export function AiBusinessReports() {
  const [reports, setReports] = useState<Tables<"ai_reports">[] | null>(null);
  const [generating, setGenerating] = useState(false);

  function reload() {
    const repos = createRepositories(createClient());
    Promise.all([repos.aiReports.listByType("daily_briefing", 3), repos.aiReports.listByType("weekly_business_report", 3)]).then(([daily, weekly]) => {
      setReports([...daily, ...weekly].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });
  }

  useEffect(() => {
    reload();
  }, []);

  async function generateNow() {
    setGenerating(true);
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("ai-briefing-runner", { body: { reportType: "daily_briefing" } });
    setGenerating(false);
    if (!error) reload();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-accent" />
            สรุปธุรกิจโดย AI
          </CardTitle>
          <CardDescription>สรุปประจำวัน (07:00) และประจำสัปดาห์ (จันทร์) สร้างและส่งแจ้งเตือนให้อัตโนมัติ</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void generateNow()} disabled={generating}>
          {generating ? "กำลังสร้าง…" : "สร้างสรุปตอนนี้"}
        </Button>
      </CardHeader>
      <CardContent>
        {reports === null ? null : reports.length === 0 ? (
          <EmptyState icon={Sparkles} title="ยังไม่มีสรุป" description="รอบแรกจะมาตอน 07:00 ของวันถัดไป" />
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="rounded-xl border border-line/10 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-secondary">{report.title}</p>
                  <p className="text-xs text-secondary/40">{new Date(report.created_at).toLocaleString("th-TH")}</p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-secondary/70">{report.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
