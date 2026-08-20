import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export interface WorkflowWithTasks {
  workflow: Tables<"agent_workflow_runs">;
  tasks: Tables<"agent_task_runs">[];
}

export class AgentWorkflowsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRuns(limit = 20): Promise<Tables<"agent_workflow_runs">[]> {
    const { data, error } = await this.db.from("agent_workflow_runs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async getRun(id: string): Promise<WorkflowWithTasks | null> {
    const { data: workflow, error: workflowErr } = await this.db.from("agent_workflow_runs").select("*").eq("id", id).maybeSingle();
    if (workflowErr) throw workflowErr;
    if (!workflow) return null;

    const { data: tasks, error: tasksErr } = await this.db.from("agent_task_runs").select("*").eq("workflow_run_id", id).order("started_at", { ascending: true });
    if (tasksErr) throw tasksErr;

    return { workflow, tasks: tasks ?? [] };
  }

  async listActions(workflowId: string): Promise<Tables<"agent_actions">[]> {
    const { data, error } = await this.db.from("agent_actions").select("*").eq("workflow_run_id", workflowId).order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async setFeedback(workflowId: string, feedback: "useful" | "not_useful"): Promise<void> {
    const { error } = await this.db.from("agent_workflow_runs").update({ feedback }).eq("id", workflowId);
    if (error) throw error;
  }

  async agentPerformanceCounts(days = 30): Promise<Record<string, { success: number; failed: number }>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db.from("agent_task_runs").select("agent_id, status").gte("started_at", since);
    if (error) throw error;

    const counts: Record<string, { success: number; failed: number }> = {};
    for (const row of data ?? []) {
      const bucket = (counts[row.agent_id] ??= { success: 0, failed: 0 });
      if (row.status === "success") bucket.success += 1;
      else bucket.failed += 1;
    }
    return counts;
  }

  // successRate/avgLatencyMs computed straight from agent_task_runs, no
  // invented weighting formula -- score is just round(successRate * 100).
  async agentHealthScores(days = 30): Promise<Record<string, { score: number; avgLatencyMs: number | null }>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db.from("agent_task_runs").select("agent_id, status, started_at, finished_at").gte("started_at", since);
    if (error) throw error;

    const buckets: Record<string, { success: number; total: number; latencySumMs: number; latencyCount: number }> = {};
    for (const row of data ?? []) {
      const bucket = (buckets[row.agent_id] ??= { success: 0, total: 0, latencySumMs: 0, latencyCount: 0 });
      bucket.total += 1;
      if (row.status === "success") bucket.success += 1;
      if (row.finished_at) {
        bucket.latencySumMs += new Date(row.finished_at).getTime() - new Date(row.started_at).getTime();
        bucket.latencyCount += 1;
      }
    }

    const scores: Record<string, { score: number; avgLatencyMs: number | null }> = {};
    for (const [agentId, bucket] of Object.entries(buckets)) {
      scores[agentId] = {
        score: bucket.total > 0 ? Math.round((bucket.success / bucket.total) * 100) : 0,
        avgLatencyMs: bucket.latencyCount > 0 ? Math.round(bucket.latencySumMs / bucket.latencyCount) : null,
      };
    }
    return scores;
  }

  // Flattens recommended_actions across the last few completed workflows,
  // keeping only priority: "high" -- the Control Center's "AI-flagged"
  // tile, grounded in what the CEO Agent actually said rather than a new
  // detection engine.
  async recentHighPriorityActions(limit = 5): Promise<{ workflowId: string; goal: string; title: string; description: string }[]> {
    const { data, error } = await this.db
      .from("agent_workflow_runs")
      .select("id, goal, recommended_actions")
      .eq("status", "completed")
      .not("recommended_actions", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;

    const flattened: { workflowId: string; goal: string; title: string; description: string }[] = [];
    for (const run of data ?? []) {
      for (const action of run.recommended_actions ?? []) {
        if (action.priority !== "high") continue;
        flattened.push({ workflowId: run.id, goal: run.goal, title: action.title, description: action.description });
        if (flattened.length >= limit) return flattened;
      }
    }
    return flattened;
  }
}
