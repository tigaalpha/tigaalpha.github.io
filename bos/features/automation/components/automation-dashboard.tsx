"use client";

import { useEffect, useState } from "react";
import { Workflow, CheckCircle2, XCircle, MinusCircle, ListTodo, Trash2, Play, Pause, Sparkles } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

const TRIGGER_LABELS: Record<string, string> = {
  customer_created: "ลูกค้าใหม่",
  sales_status_changed: "เปลี่ยนสถานะการขาย",
  booking_created: "จองคาบเรียนใหม่",
  booking_cancelled: "ยกเลิกคาบเรียน",
  course_ending_soon: "คอร์สใกล้หมดชั่วโมง",
  course_expired: "คอร์สหมดชั่วโมง",
  customer_inactive: "ลูกค้าเงียบหายไปนาน",
  booking_starting_soon: "ใกล้ถึงเวลาเรียน",
  revenue_drop: "รายได้ลดลงผิดปกติ",
  cash_flow_risk: "ความเสี่ยงกระแสเงินสด",
};

const ACTION_LABELS: Record<string, string> = {
  notify_owner: "แจ้งเตือนเจ้าของ",
  send_line_message: "ส่งข้อความ LINE",
  create_task: "สร้างงานติดตาม",
  change_sales_status: "เปลี่ยนสถานะการขาย",
  draft_followup_message: "AI ร่างข้อความติดตาม (รออนุมัติ)",
};

function RunStatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="success">สำเร็จ</Badge>;
  if (status === "failed") return <Badge variant="danger">ล้มเหลว</Badge>;
  return <Badge variant="outline">ข้าม</Badge>;
}

export function AutomationDashboard() {
  const [rules, setRules] = useState<Tables<"automation_rules">[] | null>(null);
  const [runs, setRuns] = useState<Tables<"automation_runs">[] | null>(null);
  const [counts, setCounts] = useState<{ success: number; failed: number; skipped: number } | null>(null);
  const [tasks, setTasks] = useState<Tables<"tasks">[] | null>(null);
  const [aiUsage, setAiUsage] = useState<{ calls: number; promptTokens: number; completionTokens: number } | null>(null);

  function reload() {
    const repos = createRepositories(createClient());
    repos.automation.listRules().then(setRules);
    repos.automation.listRecentRuns().then(setRuns);
    repos.automation.runCounts().then(setCounts);
    repos.tasks.listOpen().then(setTasks);
    repos.aiReports.usageLast7Days().then(setAiUsage);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleToggleRule(rule: Tables<"automation_rules">) {
    const repos = createRepositories(createClient());
    await repos.automation.toggleRule(rule.id, !rule.enabled);
    reload();
  }

  async function handleDeleteRule(id: string) {
    const repos = createRepositories(createClient());
    await repos.automation.deleteRule(id);
    reload();
  }

  async function handleCompleteTask(id: string) {
    const repos = createRepositories(createClient());
    await repos.tasks.setStatus(id, "done");
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{counts?.success ?? "—"}</p>
              <p className="text-xs text-secondary/50">สำเร็จ (7 วันล่าสุด)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <XCircle className="h-8 w-8 text-danger" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{counts?.failed ?? "—"}</p>
              <p className="text-xs text-secondary/50">ล้มเหลว (7 วันล่าสุด)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ListTodo className="h-8 w-8 text-primary-accent" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{tasks?.length ?? "—"}</p>
              <p className="text-xs text-secondary/50">งานที่ยังไม่เสร็จ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Sparkles className="h-8 w-8 text-primary-accent" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{aiUsage?.calls ?? "—"}</p>
              <p className="text-xs text-secondary/50">
                AI เรียกใช้ (7 วันล่าสุด){aiUsage ? ` · ${(aiUsage.promptTokens + aiUsage.completionTokens).toLocaleString("th-TH")} tokens` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>กฎอัตโนมัติ (Automation Rules)</CardTitle>
          <CardDescription>ระบบจะทำตามกฎเหล่านี้เองเมื่อเงื่อนไขตรง (เช็คทุก 5 นาที) — เปิด/ปิดได้ตามต้องการ</CardDescription>
        </CardHeader>
        <CardContent>
          {rules === null ? null : rules.length === 0 ? (
            <EmptyState icon={Workflow} title="ยังไม่มีกฎอัตโนมัติ" />
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className={cn("rounded-xl border border-line/10 p-4", !rule.enabled && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-secondary">{rule.name}</p>
                      {rule.description ? <p className="text-xs text-secondary/50">{rule.description}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="outline">เมื่อ: {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}</Badge>
                        {rule.actions.map((action, i) => (
                          <Badge key={i} variant="outline">
                            → {ACTION_LABELS[action.type] ?? action.type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={rule.enabled ? "success" : "outline"}>{rule.enabled ? "เปิดใช้งาน" : "ปิดอยู่"}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => void handleToggleRule(rule)}>
                        {rule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void handleDeleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>งานติดตาม (Tasks)</CardTitle>
          <CardDescription>รวมงานที่สร้างเองและที่ระบบอัตโนมัติสร้างให้</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks === null ? null : tasks.length === 0 ? (
            <EmptyState icon={ListTodo} title="ไม่มีงานค้าง" />
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-line/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-secondary">{task.title}</p>
                    <p className="text-xs text-secondary/40">
                      {task.due_at ? `กำหนด ${new Date(task.due_at).toLocaleDateString("th-TH")}` : "ไม่มีกำหนด"} ·{" "}
                      <span
                        className={cn(
                          task.priority === "high" && "text-danger",
                          task.priority === "medium" && "text-warning",
                          task.priority === "low" && "text-secondary/40"
                        )}
                      >
                        {task.priority === "high" ? "สำคัญมาก" : task.priority === "medium" ? "ปานกลาง" : "ไม่เร่งด่วน"}
                      </span>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void handleCompleteTask(task.id)}>
                    เสร็จแล้ว
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ประวัติการทำงาน (Automation History)</CardTitle>
        </CardHeader>
        <CardContent>
          {runs === null ? null : runs.length === 0 ? (
            <EmptyState icon={MinusCircle} title="ยังไม่มีประวัติการทำงาน" />
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="flex items-start justify-between gap-3 rounded-lg bg-line/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-secondary">{rules?.find((r) => r.id === run.rule_id)?.name ?? "—"}</p>
                    <p className="text-xs text-secondary/40">{new Date(run.started_at).toLocaleString("th-TH")}</p>
                    {run.error ? <p className="text-xs text-danger">{run.error}</p> : null}
                  </div>
                  <RunStatusBadge status={run.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
