"use client";

import { useCallback, useEffect, useState } from "react";
import { Gauge, AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

type Eval = Tables<"ai_evals">;

export function AiQualityView() {
  const [evals, setEvals] = useState<Eval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const reload = useCallback(() => {
    createRepositories(createClient())
      .aiOps.listEvals(200)
      .then(setEvals)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      const { error: fnError } = await createClient().functions.invoke("ai-eval-runner", { body: {} });
      if (fnError) setError("รันประเมินไม่สำเร็จ");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "รันประเมินไม่สำเร็จ");
    } finally {
      setRunning(false);
    }
  }

  const rows = evals ?? [];
  const avg = rows.length > 0 ? rows.reduce((s, e) => s + e.score, 0) / rows.length : null;
  const violations = rows.filter((e) => e.score <= 2);

  // last 14 days trend
  const days: { label: string; avg: number | null; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const dayRows = rows.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= day.getTime() && t < next.getTime();
    });
    days.push({
      label: day.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      avg: dayRows.length > 0 ? dayRows.reduce((s, e) => s + e.score, 0) / dayRows.length : null,
      count: dayRows.length,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">คุณภาพคำตอบ AI</h1>
          <p className="text-sm text-secondary/50">LLM-as-judge ประเมินคำตอบจริงของบอททุกวัน — คะแนน 1-5 ยิ่งสูงยิ่งดี</p>
        </div>
        <Button onClick={runNow} disabled={running}>
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
          ประเมินทันที
        </Button>
      </div>

      {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {evals === null ? (
        <Skeleton className="h-48" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="ยังไม่มีผลประเมิน"
          description="cron รันทุกเช้า 02:00 — หรือกดประเมินทันทีเพื่อสุ่มตรวจคำตอบล่าสุด"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary/60">คะแนนเฉลี่ย</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-secondary">{avg ? avg.toFixed(1) : "-"} <span className="text-base text-secondary/40">/ 5</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary/60">คำตอบที่ตรวจแล้ว</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-secondary">{rows.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary/60">คำตอบปัญหา (≤ 2)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-semibold ${violations.length > 0 ? "text-danger" : "text-success"}`}>{violations.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>แนวโน้ม 14 วัน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 overflow-x-auto pb-2">
                {days.map((d) => (
                  <div key={d.label} className="flex min-w-[28px] flex-col items-center gap-1">
                    <div
                      className="w-6 rounded-t-md bg-primary-accent/70"
                      style={{
                        height: `${d.avg ? Math.max(8, (d.avg / 5) * 96) : 4}px`,
                        opacity: d.avg ? 1 : 0.25,
                      }}
                    />
                    <span className="text-[10px] text-secondary/40">{d.label}</span>
                    {d.avg ? <span className="text-[10px] font-medium text-secondary/60">{d.avg.toFixed(1)}</span> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {violations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  คำตอบที่ต้องแก้
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {violations.map((e) => (
                  <div key={e.id} className="rounded-xl border border-danger/15 bg-danger/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="danger">คะแนน {e.score}</Badge>
                      <span className="text-xs text-secondary/40">{new Date(e.created_at).toLocaleString("th-TH")}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{e.reply_text}</p>
                    {e.reason ? <p className="mt-1 text-xs text-secondary/50">เหตุผล: {e.reason}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>ประวัติล่าสุด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.slice(0, 20).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-line/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-secondary">{e.reply_text.slice(0, 120)}</p>
                    <p className="text-xs text-secondary/40">{new Date(e.created_at).toLocaleString("th-TH")} · {e.channel ?? "unknown"}</p>
                  </div>
                  <Badge variant={e.score >= 4 ? "success" : e.score >= 3 ? "warning" : "danger"}>{e.score}/5</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
