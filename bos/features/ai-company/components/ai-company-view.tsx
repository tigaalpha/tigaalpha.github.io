"use client";

import { useEffect, useState } from "react";
import { Building2, Sparkles, Clock, CheckCircle2, XCircle, ListTodo, ThumbsUp, ThumbsDown, Zap, Ban } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/types/database";
import type { WorkflowWithTasks } from "@/services/repositories/agent-workflows.repository";

const PRIORITY_LABELS: Record<string, string> = { high: "สำคัญมาก", medium: "สำคัญปานกลาง", low: "สำคัญน้อย" };
const PRIORITY_VARIANT: Record<string, "danger" | "outline"> = { high: "danger", medium: "outline", low: "outline" };

const GOAL_TEMPLATES: { label: string; goal: string }[] = [
  { label: "📈 สรุปยอดขายประจำสัปดาห์", goal: "สรุปยอดขายและ pipeline ประจำสัปดาห์: มีอะไรน่าเป็นห่วงหรือควรทำต่อบ้าง" },
  { label: "🔍 วิเคราะห์คู่แข่ง", goal: "วิเคราะห์คู่แข่งโรงเรียนสอนเปียโน: จุดแข็งจุดอ่อนของเราเทียบกับคู่แข่ง และสิ่งที่ควรทำ" },
  { label: "💸 ทำไมเดือนนี้กำไรลดลง", goal: "ทำไมเดือนนี้กำไรลดลง? วิเคราะห์รายรับ-รายจ่ายและหาแนวทางแก้ไข" },
  { label: "🚀 หาโอกาสเพิ่มยอดขาย", goal: "หาโอกาสเพิ่มยอดขายคอร์สเดือนหน้า 30%: วิเคราะห์ pipeline, lead score และช่องทางการตลาด" },
  { label: "🏥 ตรวจสุขภาพธุรกิจ", goal: "ตรวจสุขภาพธุรกิจภาพรวม: การเงิน, การตลาด, การขาย และสิ่งที่ต้องเร่งแก้ไข" },
];

// Mirrors supabase/functions/_shared/agents.ts -- Deno can't read this
// frontend file at runtime, same reason chat-models.ts duplicates
// ai-provider.ts's CHAT_MODELS instead of importing it.
const AGENT_LABELS: Record<string, string> = {
  sales: "Sales Agent",
  marketing: "Marketing Agent",
  finance: "Finance Agent",
  content: "Content Agent",
  ops: "Ops Agent",
  research: "Research Agent",
  business_analyst: "Business Analyst Agent",
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: "สร้างงานในระบบ",
  send_notification: "แจ้งเตือนในระบบ",
  send_line: "ส่งข้อความ LINE",
  create_schedule: "สร้างกำหนดการอัตโนมัติ",
  draft_content: "ร่างคอนเทนต์เข้าปฏิทิน",
  update_customer: "อัปเดตข้อมูลลูกค้า",
  send_email: "ส่งอีเมล",
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
  executed: "ดำเนินการแล้ว",
  auto_executed: "รันอัตโนมัติ",
  failed: "ล้มเหลว",
};

function TaskStatusIcon({ status }: { status: string }) {
  return status === "success" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />;
}

export function AiCompanyView() {
  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<WorkflowWithTasks | null>(null);
  const [actions, setActions] = useState<Tables<"agent_actions">[]>([]);
  const [history, setHistory] = useState<Tables<"agent_workflow_runs">[] | null>(null);
  const [creatingTaskIndex, setCreatingTaskIndex] = useState<number | null>(null);
  const [createdTaskIndices, setCreatedTaskIndices] = useState<Set<number>>(new Set());
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  function loadHistory() {
    const repos = createRepositories(createClient());
    repos.agentWorkflows.listRuns().then(setHistory);
  }

  function loadActions(workflowId: string) {
    const repos = createRepositories(createClient());
    repos.agentWorkflows.listActions(workflowId).then(setActions);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (current) loadActions(current.workflow.id);
  }, [current]);

  async function handleRun() {
    if (!goal.trim()) return;
    setRunning(true);
    setError(null);
    setCurrent(null);
    setActions([]);
    try {
      const supabase = createClient();
      const { data, error: invokeError } = await supabase.functions.invoke<{ workflowId: string }>("agent-orchestrator", { body: { goal: goal.trim() } });
      if (invokeError || !data) throw invokeError ?? new Error("ไม่สำเร็จ");

      const repos = createRepositories(supabase);
      const result = await repos.agentWorkflows.getRun(data.workflowId);
      setCurrent(result);
      setCreatedTaskIndices(new Set());
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
    setCreatedTaskIndices(new Set());
  }

  async function handleCreateTask(action: { title: string; description: string; priority: string }, index: number) {
    if (!current) return;
    setCreatingTaskIndex(index);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const repos = createRepositories(supabase);
      await repos.tasks.create(
        {
          title: action.title,
          description: `${action.description}\n\n(จาก CEO Agent เป้าหมาย: "${current.workflow.goal}")`,
          priority: (action.priority === "high" || action.priority === "medium" || action.priority === "low" ? action.priority : "medium") as "high" | "medium" | "low",
          sourceWorkflowRunId: current.workflow.id,
        },
        userData.user?.id ?? null
      );
      setCreatedTaskIndices((prev) => new Set(prev).add(index));
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างงานไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setCreatingTaskIndex(null);
    }
  }

  async function handleActionDecision(actionId: string, decision: "approve" | "reject") {
    setActionBusyId(actionId);
    setError(null);
    try {
      const supabase = createClient();
      const { error: invokeError } = await supabase.functions.invoke("agent-action-execute", { body: { actionId, decision } });
      if (invokeError) throw invokeError;
      if (current) loadActions(current.workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleFeedback(feedback: "useful" | "not_useful") {
    if (!current || feedbackSaving) return;
    setFeedbackSaving(true);
    try {
      const repos = createRepositories(createClient());
      await repos.agentWorkflows.setFeedback(current.workflow.id, feedback);
      setCurrent({ ...current, workflow: { ...current.workflow, feedback } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึก feedback ไม่สำเร็จ");
    } finally {
      setFeedbackSaving(false);
    }
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
            (ใช้เวลาประมาณ 15-40 วินาที — งานเสี่ยงต่ำอย่างสร้างงาน/แจ้งเตือนรันอัตโนมัติ ส่วนการส่ง LINE หรือสร้างกำหนดการต้องรอคุณกดอนุมัติ)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-1.5">
            {GOAL_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setGoal(t.goal)}
                className="rounded-full border border-line/10 bg-line/5 px-3 py-1 text-xs text-secondary/70 transition-colors hover:border-primary/40 hover:text-secondary"
              >
                {t.label}
              </button>
            ))}
          </div>
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
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>รายงานสรุปจาก CEO Agent</CardTitle>
                <CardDescription>กด 👍/👎 เพื่อบอกว่า CEO Agent วิเคราะห์ได้ตรงกับที่ต้องการหรือไม่ — ระบบจะนำไปปรับปรุงรอบถัดไป</CardDescription>
              </div>
              {current.workflow.status === "completed" ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={feedbackSaving} onClick={() => void handleFeedback("useful")}>
                    <ThumbsUp className={current.workflow.feedback === "useful" ? "h-4 w-4 text-success" : "h-4 w-4 text-secondary/50"} />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={feedbackSaving} onClick={() => void handleFeedback("not_useful")}>
                    <ThumbsDown className={current.workflow.feedback === "not_useful" ? "h-4 w-4 text-danger" : "h-4 w-4 text-secondary/50"} />
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {current.workflow.status === "completed" && current.workflow.final_report ? (
                <p className="whitespace-pre-wrap text-sm text-secondary/80">{current.workflow.final_report}</p>
              ) : (
                <p className="text-sm text-danger">วิเคราะห์ไม่สำเร็จ — ลองใหม่อีกครั้งหรือลองปรับเป้าหมายให้ชัดเจนขึ้น</p>
              )}
            </CardContent>
          </Card>

          {actions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary-accent" />
                  งานที่สั่งให้ระบบทำต่อ
                </CardTitle>
                <CardDescription>
                  งานเสี่ยงต่ำ (สร้างงาน/แจ้งเตือน/ร่างคอนเทนต์) รันอัตโนมัติทันที — งานที่แตะลูกค้า เงิน หรือระบบอัตโนมัติ
                  (LINE/กำหนดการ/อีเมล/อัปเดตลูกค้า) ต้องกดอนุมัติเอง
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {actions.map((action) => (
                  <div key={action.id} className="flex items-start justify-between gap-3 rounded-lg bg-line/5 p-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-secondary">{action.title}</p>
                        <Badge variant={PRIORITY_VARIANT[action.priority] ?? "outline"}>{PRIORITY_LABELS[action.priority] ?? action.priority}</Badge>
                        <Badge variant="outline">{ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}</Badge>
                        <Badge variant={action.status === "failed" ? "danger" : action.status === "pending_approval" ? "outline" : "success"}>
                          {ACTION_STATUS_LABELS[action.status] ?? action.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-secondary/60">{action.description}</p>
                      {action.result ? <p className="mt-1 text-xs text-secondary/50">{action.result}</p> : null}
                    </div>
                    {action.status === "pending_approval" ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="outline" size="sm" disabled={actionBusyId === action.id} onClick={() => void handleActionDecision(action.id, "reject")}>
                          <Ban className="h-4 w-4" />
                          ปฏิเสธ
                        </Button>
                        <Button size="sm" disabled={actionBusyId === action.id} onClick={() => void handleActionDecision(action.id, "approve")}>
                          {actionBusyId === action.id ? "กำลังรัน…" : (
                            <>
                              <Zap className="h-4 w-4" />
                              อนุมัติและรัน
                            </>
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {current.workflow.recommended_actions && current.workflow.recommended_actions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary-accent" />
                  สิ่งที่แนะนำให้ทำต่อ
                </CardTitle>
                <CardDescription>คำแนะนำแบบไม่มี action อัตโนมัติ — กดสร้างงานเพื่อบันทึกเข้าไปในรายการงาน</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {current.workflow.recommended_actions.map((action, index) => (
                  <div key={index} className="flex items-start justify-between gap-3 rounded-lg bg-line/5 p-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-medium text-secondary">{action.title}</p>
                        <Badge variant={PRIORITY_VARIANT[action.priority] ?? "outline"}>{PRIORITY_LABELS[action.priority] ?? action.priority}</Badge>
                      </div>
                      <p className="text-xs text-secondary/60">{action.description}</p>
                    </div>
                    {createdTaskIndices.has(index) ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-4 w-4" /> สร้างงานแล้ว
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" className="shrink-0" disabled={creatingTaskIndex === index} onClick={() => void handleCreateTask(action, index)}>
                        {creatingTaskIndex === index ? "กำลังสร้าง…" : "สร้างงาน"}
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
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
