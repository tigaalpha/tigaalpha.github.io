import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate } from "./ai-provider.ts";
import { PROMPTS } from "./prompts.ts";
import { AGENTS, isKnownAgentId } from "./agents.ts";
import { runAgentTask } from "./agent-tasks.ts";
import type { ToolDefinition } from "./ai-types.ts";
import * as line from "./line.ts";
import { logAiUsage } from "./usage-logging.ts";
import { fetchRecentMemory } from "./agent-memory.ts";

const MAX_TASKS = 4;

const RETURN_TASK_PLAN_TOOL: ToolDefinition = {
  name: "return_task_plan",
  description: "Return which specialist agents to assign and what specific question each should answer.",
  parameters: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            agentId: { type: "string", enum: AGENTS.map((a) => a.id) },
            question: { type: "string" },
          },
          required: ["agentId", "question"],
        },
      },
    },
    required: ["tasks"],
  },
};

interface PlannedTask {
  agentId: string;
  question: string;
}

const MAX_RECOMMENDED_ACTIONS = 5;

const RETURN_SYNTHESIS_TOOL: ToolDefinition = {
  name: "return_synthesis",
  description: "Return the strategic report and a short list of concrete, assignable recommended next actions.",
  parameters: {
    type: "object",
    properties: {
      report: { type: "string", description: "The full strategic report in Thai, synthesizing all agent findings." },
      recommendedActions: {
        type: "array",
        description: "0-5 concrete, assignable next steps. Omit if nothing concrete to recommend.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["title", "description", "priority"],
        },
      },
    },
    required: ["report"],
  },
};

interface RecommendedAction {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

// The CEO Agent: goal -> plan (which specialists answer what) -> run them
// in parallel against real CRM data -> synthesize one strategic report.
// Nothing this produces executes automatically -- it's a report for the
// owner to act on, same human-in-the-loop principle as every other
// AI-drafted output in this app.
export async function runWorkflow(admin: SupabaseClient, goal: string, createdBy: string | null): Promise<string> {
  const { data: workflow, error: insertErr } = await admin.from("agent_workflow_runs").insert({ goal, status: "running", created_by: createdBy }).select("id").single();
  if (insertErr) throw insertErr;
  const workflowId = workflow.id as string;

  try {
    const recentMemory = await fetchRecentMemory(admin);

    const planResult = await generate(
      [
        { role: "system", content: PROMPTS.ceo_planner },
        { role: "user", content: JSON.stringify({ goal, recentRuns: recentMemory.recentRuns, agentReliability: recentMemory.agentReliability }) },
      ],
      [RETURN_TASK_PLAN_TOOL],
      0.4,
      1024
    );
    await logAiUsage(admin, planResult.usage, "agent-orchestrator:ceo_planner");

    const call = planResult.message.toolCalls?.find((c) => c.name === "return_task_plan");
    const rawTasks = (call?.arguments as { tasks?: PlannedTask[] } | undefined)?.tasks ?? [];
    // A hallucinated agent id would crash runAgentTask's switch -- drop
    // instead of failing the whole workflow over one bad plan entry.
    const tasks = rawTasks.filter((t) => isKnownAgentId(t.agentId) && t.question).slice(0, MAX_TASKS);

    if (tasks.length === 0) {
      await admin.from("agent_workflow_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", workflowId);
      return workflowId;
    }

    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        const startedAt = new Date().toISOString();
        try {
          const result = await runAgentTask(admin, task.agentId, task.question);
          await logAiUsage(admin, result.usage, `agent-orchestrator:${task.agentId}`);
          await admin.from("agent_task_runs").insert({
            workflow_run_id: workflowId,
            agent_id: task.agentId,
            question: task.question,
            status: "success",
            output: result.output,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
          });
          return { agentId: task.agentId, question: task.question, output: result.output };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          await admin.from("agent_task_runs").insert({
            workflow_run_id: workflowId,
            agent_id: task.agentId,
            question: task.question,
            status: "failed",
            error: message,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
          });
          return null;
        }
      })
    );

    const successfulOutputs = results.filter((r): r is PromiseFulfilledResult<{ agentId: string; question: string; output: string }> => r.status === "fulfilled" && r.value !== null).map((r) => r.value);

    if (successfulOutputs.length === 0) {
      await admin.from("agent_workflow_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", workflowId);
      return workflowId;
    }

    const synthesisResult = await generate(
      [
        { role: "system", content: PROMPTS.ceo_synthesis },
        {
          role: "user",
          content: JSON.stringify({
            goal,
            agentFindings: successfulOutputs,
            failedAgentCount: tasks.length - successfulOutputs.length,
            recentRuns: recentMemory.recentRuns,
            agentReliability: recentMemory.agentReliability,
          }),
        },
      ],
      [RETURN_SYNTHESIS_TOOL],
      0.5,
      1536
    );
    await logAiUsage(admin, synthesisResult.usage, "agent-orchestrator:ceo_synthesis");

    // Fall back to raw prose if the model didn't use the tool call -- never
    // fail a completed workflow over a formatting miss.
    const synthesisCall = synthesisResult.message.toolCalls?.find((c) => c.name === "return_synthesis");
    const synthesisArgs = synthesisCall?.arguments as { report?: string; recommendedActions?: RecommendedAction[] } | undefined;
    const report = synthesisArgs?.report ?? synthesisResult.message.content;
    const recommendedActions = (synthesisArgs?.recommendedActions ?? []).slice(0, MAX_RECOMMENDED_ACTIONS);

    await admin
      .from("agent_workflow_runs")
      .update({ status: "completed", final_report: report, recommended_actions: recommendedActions, completed_at: new Date().toISOString() })
      .eq("id", workflowId);

    await admin.from("notifications").insert({
      type: "automation",
      title: "CEO Agent วิเคราะห์เสร็จแล้ว",
      body: `เป้าหมาย: ${goal}`.slice(0, 300),
    });

    const { data: ownerLineIdRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    if (ownerLineIdRow?.value) {
      await line.push(ownerLineIdRow.value, `CEO Agent วิเคราะห์เป้าหมาย "${goal}" เสร็จแล้ว — ดูรายงานเต็มได้ในระบบ`);
    }

    return workflowId;
  } catch (error) {
    await admin.from("agent_workflow_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", workflowId);
    throw error;
  }
}
