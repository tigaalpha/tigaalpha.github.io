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
}
