import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Business Memory for the CEO Agent (Level 5 Wave 2): before this,
// runWorkflow() started from nothing every time -- no memory of what it
// analyzed last, what it recommended, or whether the owner acted on it.
// Bounded to the last 3 completed runs with short excerpts, specifically
// to keep prompt token cost small -- this is a targeted memory, not a
// full transcript replay. The other memory "tiers" the Level 5 spec lists
// (working/episodic/semantic) are deliberately not built here -- see the
// Wave 2 plan for why each already has a real equivalent or no consumer.

export interface MemoryEntry {
  goal: string;
  summary: string;
  actedOn: boolean;
  createdAt: string;
}

const RECENT_RUN_LIMIT = 3;
const SUMMARY_EXCERPT_LENGTH = 200;

export async function fetchRecentMemory(admin: SupabaseClient): Promise<MemoryEntry[]> {
  const { data: runs } = await admin
    .from("agent_workflow_runs")
    .select("id, goal, final_report, created_at")
    .eq("status", "completed")
    .not("final_report", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_RUN_LIMIT);
  if (!runs || runs.length === 0) return [];

  // "Acted on" = at least one task now traces back to this run via
  // tasks.source_workflow_run_id (set when the owner clicks "สร้างงาน" on
  // a recommended action in AiCompanyView).
  const runIds = runs.map((r) => r.id);
  const { data: actedTasks } = await admin.from("tasks").select("source_workflow_run_id").in("source_workflow_run_id", runIds);
  const actedOnIds = new Set((actedTasks ?? []).map((t) => t.source_workflow_run_id));

  return runs.map((run) => ({
    goal: run.goal,
    summary: (run.final_report ?? "").slice(0, SUMMARY_EXCERPT_LENGTH),
    actedOn: actedOnIds.has(run.id),
    createdAt: run.created_at,
  }));
}
