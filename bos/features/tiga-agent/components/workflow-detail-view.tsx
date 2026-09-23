"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Zap, ThumbsUp, ThumbsDown } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

const AGENT_LABELS: Record<string, string> = {
  ceo: "CEO Agent",
  sales: "Sales Agent",
  marketing: "Marketing Agent",
  finance: "Finance Agent",
  business_analyst: "Business Analyst",
  content: "Content Agent",
  ops: "Ops Agent",
  research: "Research Agent",
};

function AgentBadge({ agentId }: { agentId: string }) {
  const label = AGENT_LABELS[agentId] ?? agentId;
  return <Badge variant="outline">{label}</Badge>;
}

export function WorkflowDetailView({
  workflowId,
  onBack,
}: {
  workflowId: string;
  onBack: () => void;
}) {
  const [workflow, setWorkflow] = useState<Tables<"agent_workflow_runs"> | null>(null);
  const [tasks, setTasks] = useState<Tables<"agent_task_runs">[]>([]);
  const [actions, setActions] = useState<Tables<"agent_actions">[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);

    Promise.all([
      repos.agentWorkflows.getRun(workflowId),
      repos.agentWorkflows.listActions(workflowId),
    ]).then(([runData, actionsData]) => {
      if (runData) {
        setWorkflow(runData.workflow);
        setTasks(runData.tasks);
      }
      setActions(actionsData);
      setLoading(false);
    });
  }, [workflowId]);

  async function handleFeedback(feedback: "useful" | "not_useful") {
    const repos = createRepositories(createClient());
    await repos.agentWorkflows.setFeedback(workflowId, feedback);
    setFeedbackGiven(feedback);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </Button>
        <p className="text-secondary/50">ไม่พบข้อมูล workflow นี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-secondary break-words">{workflow.goal}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary/50">
            <Badge variant={workflow.status === "completed" ? "success" : workflow.status === "failed" ? "danger" : "outline"}>
              {workflow.status === "completed" ? "สำเร็จ" : workflow.status === "failed" ? "ล้มเหลว" : "กำลังทำงาน"}
            </Badge>
            <span>สร้างเมื่อ {new Date(workflow.created_at).toLocaleString("th-TH")}</span>
            {workflow.completed_at && (
              <span>· เสร็จ {new Date(workflow.completed_at).toLocaleString("th-TH")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Final Report */}
      {workflow.final_report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">รายงานผลลัพธ์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm text-secondary/80 leading-relaxed">
              {workflow.final_report}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Actions */}
      {workflow.recommended_actions && workflow.recommended_actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">สิ่งที่แนะนำให้ทำต่อ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(workflow.recommended_actions as Array<{ title: string; description: string; priority?: string }>).map(
              (action, i) => (
                <div key={i} className="rounded-lg border border-line/10 bg-line/5 p-3">
                  <div className="flex items-start gap-2">
                    {action.priority === "high" && <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />}
                    <div>
                      <p className="text-sm font-medium text-secondary">{action.title}</p>
                      <p className="text-xs text-secondary/60">{action.description}</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Agent Tasks */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">งานที่สั่งให้ Agent แต่ละคนทำ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-line/10 p-3">
                <div className="flex items-center gap-2">
                  {task.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-danger" />
                  )}
                  <AgentBadge agentId={task.agent_id} />
                  <span className="text-xs text-secondary/40">
                    {task.finished_at && (
                      <>
                        <Clock className="inline h-3 w-3" />{" "}
                        {Math.round(
                          (new Date(task.finished_at).getTime() - new Date(task.started_at).getTime()) / 1000
                        )}s
                      </>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-secondary/70">{task.question}</p>
                {task.output && (
                  <div className="mt-2 whitespace-pre-wrap rounded bg-line/5 px-3 py-2 text-xs text-secondary/60">
                    {task.output}
                  </div>
                )}
                {task.error && (
                  <div className="mt-2 whitespace-pre-wrap rounded bg-danger/5 px-3 py-2 text-xs text-danger/80">
                    {task.error}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions Taken */}
      {actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">การกระทำที่ทำไปแล้ว</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions.map((action) => (
              <div key={action.id} className="flex items-center gap-2 text-sm">
                <Badge variant={action.status === "executed" || action.status === "auto_executed" ? "success" : action.status === "rejected" ? "danger" : "outline"}>
                  {action.status}
                </Badge>
                <span className="text-secondary/70">{action.action_type}</span>
                <span className="text-xs text-secondary/40">
                  {new Date(action.created_at).toLocaleString("th-TH")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {workflow.status === "completed" && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="text-sm text-secondary/50">รายงานนี้มีประโยชน์ไหม?</span>
            <div className="flex gap-2">
              <Button
                variant={feedbackGiven === "useful" ? "primary" : "outline"}
                size="sm"
                onClick={() => void handleFeedback("useful")}
                disabled={feedbackGiven !== null}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                มีประโยชน์
              </Button>
              <Button
                variant={feedbackGiven === "not_useful" ? "danger" : "outline"}
                size="sm"
                onClick={() => void handleFeedback("not_useful")}
                disabled={feedbackGiven !== null}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                ไม่ค่อยมี
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
