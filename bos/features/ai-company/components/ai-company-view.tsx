"use client";

import { useEffect, useState } from "react";
import { Building2, Sparkles, Clock, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/types/database";
import type { WorkflowWithTasks } from "@/services/repositories/agent-workflows.repository";

// Mirrors supabase/functions/_shared/agents.ts -- Deno can't read this
// frontend file at runtime, same reason chat-models.ts duplicates
// ai-provider.ts's CHAT_MODELS instead of importing it.
const AGENT_LABELS: Record<string, string> = {
  sales: "Sales Agent",
  marketing: "Marketing Agent",
  finance: "Finance Agent",
  business_analyst: "Business Analyst Agent",
};

function TaskStatusIcon({ status }: { status: string }) {
  return status === "success" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />;
}

export function AiCompanyView() {
  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<WorkflowWithTasks | null>(null);
  const [history, setHistory] = useState<Tables<"agent_workflow_runs">[] | null>(null);

  function loadHistory() {
    const repos = createRepositories(createClient());
    repos.agentWorkflows.listRuns().then(setHistory);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleRun() {
    if (!goal.trim()) return;
    setRunning(true);
    setError(null);
    setCurrent(null);
    try {
      const supabase = createClient();
      const { data, error: invokeError } = await supabase.functions.invoke<{ workflowId: string }>("agent-orchestrator", { body: { goal: goal.trim() } });
      if (invokeError || !data) throw invokeError ?? new Error("ไม่สำเร็จ");

      const repos = createRepositories(supabase);
      const result = await repos.agentWorkflows.getRun(data.workflowId);
      setCurrent(result);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setRunning(false);
    }
  }

  async function openHistoryRun(id: string) {
    const repos = createRepositories(createClient());
    const result = await repos.agentWorkflows.getRun(id);
    setCurrent(result);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary-accent" />
            CEO Agent
          </CardTitle>
          <CardDescription>
            บอกเป้าหมายทางธุรกิจ — CEO Agent จะแบ่งงานให้ทีม (Sales, Marketing, Finance, Business Analyst) วิเคราะห์คู่ขนาน แล้วสรุปเป็นรายงานกลยุทธ์เดียว
            (ใช้เวลาประมาณ 15-40 วินาที ไม่มีการดำเนินการอะไรอัตโนมัติ — เป็นแค่รายงานให้คุณตัดสินใจเอง)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
          <Textarea
            placeholder='เช่น "เพิ่มยอดขายคอร์สเดือนหน้า 30%" หรือ "ทำไมเดือนนี้กำไรลดลง"'
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="min-h-20"
            disabled={running}
          />
          <Button onClick={() => void handleRun()} disabled={running || !goal.trim()}>
            <Sparkles className="h-4 w-4" />
            {running ? "กำลังวิเคราะห์…" : "เริ่มวิเคราะห์"}
          </Button>
        </CardContent>
      </Card>

      {current ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-secondary/40">เป้าหมาย</p>
            <p className="text-sm font-medium text-secondary">{current.workflow.goal}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {current.tasks.map((task) => (
              <Card key={task.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">{AGENT_LABELS[task.agent_id] ?? task.agent_id}</CardTitle>
                  <TaskStatusIcon status={task.status} />
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-xs italic text-secondary/50">&quot;{task.question}&quot;</p>
                  {task.status === "success" ? (
                    <p className="whitespace-pre-wrap text-sm text-secondary/80">{task.output}</p>
                  ) : (
                    <p className="text-sm text-danger">{task.error}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>รายงานสรุปจาก CEO Agent</CardTitle>
            </CardHeader>
            <CardContent>
              {current.workflow.status === "completed" && current.workflow.final_report ? (
                <p className="whitespace-pre-wrap text-sm text-secondary/80">{current.workflow.final_report}</p>
              ) : (
                <p className="text-sm text-danger">วิเคราะห์ไม่สำเร็จ — ลองใหม่อีกครั้งหรือลองปรับเป้าหมายให้ชัดเจนขึ้น</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>ประวัติการวิเคราะห์</CardTitle>
        </CardHeader>
        <CardContent>
          {history === null ? null : history.length === 0 ? (
            <EmptyState icon={Clock} title="ยังไม่มีประวัติ" />
          ) : (
            <div className="space-y-2">
              {history.map((run) => (
                <button
                  key={run.id}
                  onClick={() => void openHistoryRun(run.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-line/5 px-3 py-2 text-left hover:bg-line/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-secondary">{run.goal}</p>
                    <p className="text-xs text-secondary/40">{new Date(run.created_at).toLocaleString("th-TH")}</p>
                  </div>
                  <Badge variant={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "outline"}>{run.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
