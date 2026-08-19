"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Coins, Cpu, FolderKanban, RefreshCw, TrendingUp } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { estimateCost, modelCost, UNKNOWN_MODEL_COST } from "@/lib/ai-cost";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AiUsageRow } from "@/services/repositories/ai-usage.repository";

const SOURCE_LABELS: Record<string, string> = {
  "chat-core:respond": "แชทลูกค้า (AI พนักงาน)",
  "chat-core:summarize": "สรุปบทสนทนา",
  "follow-up-conversations": "ไล่ตามลูกค้า (nudge)",
  "agent-orchestrator": "CEO Agent",
  "agent-action-execute": "Agent Action",
  "strategy-ask": "Strategy Room",
  "generate-article": "เขียนบทความ SEO",
  "generate-course-article": "Course Writer",
  "generate-ad-campaign": "แคมเปญโฆษณา",
  "generate-app-ad-kit": "App Ad Kit",
  "generate-legal-document": "เอกสาร/สัญญา",
  "generate-video-script": "Video Script",
  "generate-voiceover": "Voice Over",
  "generate-competitor-analysis": "วิเคราะห์คู่แข่ง",
  "generate-student-progress": "สรุปความก้าวหน้านักเรียน",
  "ai-briefing-runner": "Daily Briefing",
  "monthly-report": "รายงานรายเดือน",
  "payroll-report": "รายงานเงินเดือน",
  "lesson-summary": "สรุปคาบเรียน",
  "marketing-metrics-snapshot": "Marketing Metrics",
  "suggest-course-topics": "Course Topics",
  "sales_followup_draft": "ร่างข้อความติดตาม",
  "renewal_draft": "ร่างข้อความต่อคอร์ส",
  "ceo_planner": "CEO Planner",
  "ceo_synthesis": "CEO Synthesis",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

interface Bucket {
  key: string;
  label: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

function bucketize(rows: AiUsageRow[], keyOf: (r: AiUsageRow) => string, labelOf: (key: string) => string): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const key = keyOf(row);
    const b = map.get(key) ?? { key, label: labelOf(key), promptTokens: 0, completionTokens: 0, cost: 0 };
    b.promptTokens += row.prompt_tokens ?? 0;
    b.completionTokens += row.completion_tokens ?? 0;
    b.cost += estimateCost(row.model ?? "unknown", row.prompt_tokens ?? 0, row.completion_tokens ?? 0);
    map.set(key, b);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

export function AiCostView() {
  const [rows, setRows] = useState<AiUsageRow[] | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const repos = createRepositories(createClient());
      const [usage, budgetRow] = await Promise.all([repos.aiUsage.listRecent(30), repos.integrations.get("ai_budget_daily_tokens")]);
      setRows(usage);
      const b = Number(budgetRow ?? 0);
      setBudget(Number.isFinite(b) && b > 0 ? b : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byModel = useMemo(() => bucketize(rows ?? [], (r) => r.model ?? "unknown", (key) => modelCost(key).label), [rows]);
  const bySource = useMemo(() => bucketize(rows ?? [], (r) => r.source, sourceLabel), [rows]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const daily = useMemo(() => {
    const days = new Map<number, { tokens: number; cost: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.set(d.getTime(), { tokens: 0, cost: 0 });
    }
    for (const row of rows ?? []) {
      const day = new Date(row.created_at);
      day.setHours(0, 0, 0, 0);
      const slot = days.get(day.getTime());
      if (!slot) continue;
      slot.tokens += (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0);
      slot.cost += estimateCost(row.model ?? "unknown", row.prompt_tokens ?? 0, row.completion_tokens ?? 0);
    }
    return Array.from(days.entries()).map(([ts, v]) => ({ ts, ...v }));
  }, [rows]);

  const totals = useMemo(() => {
    const cost = (rows ?? []).reduce((sum, r) => sum + estimateCost(r.model ?? "unknown", r.prompt_tokens ?? 0, r.completion_tokens ?? 0), 0);
    const tokens = (rows ?? []).reduce((sum, r) => sum + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0), 0);
    const today = daily.find((d) => d.ts === todayStart);
    return { cost, tokens, todayTokens: today?.tokens ?? 0, todayCost: today?.cost ?? 0 };
  }, [rows, daily, todayStart]);

  const overBudget = budget !== null && totals.todayTokens >= budget;
  const maxDailyTokens = Math.max(...daily.map((d) => d.tokens), 1);
  const maxModelCost = Math.max(...byModel.map((b) => b.cost), 0.001);
  const maxSourceCost = Math.max(...bySource.map((b) => b.cost), 0.001);

  if (rows === null) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      {overBudget ? (
        <Card className="border-danger/30">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div>
              <p className="font-medium text-danger">เกินงบ AI ประจำวันแล้ววันนี้</p>
              <p className="text-secondary/70">
                ใช้ไป {totals.todayTokens.toLocaleString("th-TH")} tokens จากงบ {budget?.toLocaleString("th-TH")} — ระบบจะหยุดตอบลูกค้าอัตโนมัติและแจ้งเจ้าของ
                (เพิ่มงบได้ที่ Settings → Integrations)
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Coins className="h-5 w-5 text-primary-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary/50">ค่าใช้จ่าย AI โดยประมาณ — 30 วัน</p>
              <p className="truncate text-lg font-semibold text-secondary">
                ${totals.cost.toFixed(2)}
                <span className="ml-1 text-xs font-normal text-secondary/50">({totals.tokens.toLocaleString("th-TH")} tokens)</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary/50">วันนี้ (โดยประมาณ)</p>
              <p className="truncate text-lg font-semibold text-secondary">
                ${totals.todayCost.toFixed(2)}
                <span className="ml-1 text-xs font-normal text-secondary/50">{totals.todayTokens.toLocaleString("th-TH")} tokens</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", overBudget ? "bg-danger/10" : "bg-warning/10")}>
              <AlertTriangle className={cn("h-5 w-5", overBudget ? "text-danger" : "text-warning")} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary/50">งบ AI ต่อวัน (tokens)</p>
              <p className="truncate text-lg font-semibold text-secondary">
                {budget !== null ? budget.toLocaleString("th-TH") : "ไม่ได้ตั้ง"}
                {overBudget ? <Badge variant="danger" className="ml-2">เกินงบ</Badge> : null}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* daily trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-accent" />
            แนวโน้มรายวัน — 14 วันล่าสุด
          </CardTitle>
          <CardDescription>ความสูงของแท่ง = จำนวน tokens ต่อวัน (สีแดง = เกินงบวันนั้น)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1.5">
            {daily.map((d) => {
              const dayOver = budget !== null && d.tokens >= budget;
              return (
                <div key={d.ts} className="group relative flex-1" title={`${new Date(d.ts).toLocaleDateString("th-TH")} — ${d.tokens.toLocaleString("th-TH")} tokens (~$${d.cost.toFixed(2)})`}>
                  <div
                    className={cn("w-full rounded-t-md transition-colors", dayOver ? "bg-danger/70" : "bg-primary-gradient")}
                    style={{ height: `${Math.max((d.tokens / maxDailyTokens) * 100, 2)}%` }}
                  />
                  <div className="mt-1 truncate text-center text-[10px] text-secondary/40">{new Date(d.ts).getDate()}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* by model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary-accent" />
            ต้นทุนแยกตามโมเดล
          </CardTitle>
          <CardDescription>ประมาณการจากราคา list ต่อ 1M tokens — อัปเดตได้ที่ lib/ai-cost.ts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {byModel.length === 0 ? (
            <EmptyState icon={Cpu} title="ยังไม่มีข้อมูลการใช้งาน AI" description="เมื่อมีข้อความผ่าน AI (แชท/Agent/งานเนื้อหา) จะแสดงที่นี่" />
          ) : (
            byModel.map((b) => {
              const cost = modelCost(b.key);
              const unknown = cost === UNKNOWN_MODEL_COST;
              return (
                <div key={b.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-secondary">
                      {b.label}
                      {unknown ? <span className="ml-1 text-xs text-secondary/40">(โมเดลใหม่ — ราคายังไม่รู้ ใช้ค่ากลาง)</span> : null}
                    </span>
                    <span className="text-secondary/70">
                      ${b.cost.toFixed(2)} · {(b.promptTokens + b.completionTokens).toLocaleString("th-TH")} tokens
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line/5">
                    <div className="h-full rounded-full bg-primary-gradient" style={{ width: `${(b.cost / maxModelCost) * 100}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* by source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary-accent" />
            ต้นทุนแยกตามงาน
          </CardTitle>
          <CardDescription>ฟีเจอร์ไหนกินงบ AI มากที่สุด — ตัดสินใจว่าจะปิด/ลดงานไหน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bySource.length === 0 ? (
            <EmptyState icon={FolderKanban} title="ยังไม่มีข้อมูล" />
          ) : (
            bySource.map((b) => (
              <div key={b.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-secondary">{b.label}</span>
                  <span className="shrink-0 pl-3 text-secondary/70">
                    ${b.cost.toFixed(2)} · {(b.promptTokens + b.completionTokens).toLocaleString("th-TH")} tokens
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line/5">
                  <div className="h-full rounded-full bg-primary-gradient" style={{ width: `${(b.cost / maxSourceCost) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-secondary/40">
          ตัวเลขเป็นประมาณการจากราคา list ของแต่ละโมเดล ไม่ใช่ยอดเรียกเก็บจริงของผู้ให้บริการ · งบต่อวันตั้งได้ที่{" "}
          <Link href="/settings" className="text-primary-accent underline">Settings → Integrations</Link>
        </p>
        <Button variant="ghost" size="sm" onClick={() => load()}>
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>
    </div>
  );
}
