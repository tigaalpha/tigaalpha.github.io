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

// Wave 4: which specialist agents have recently been unreliable, so the
// planner/synthesis can disclose that uncertainty instead of treating
// every agent's output as equally trustworthy. Deliberately just a
// disclosed success rate, not a routing/weighting decision -- this app's
// volume isn't enough to justify anything more precise than "this one
// has been failing a lot lately."
export interface AgentReliability {
  agentId: string;
  recentSuccessRate: number;
}

export interface RecentMemory {
  recentRuns: MemoryEntry[];
  agentReliability: AgentReliability[];
}

const RECENT_RUN_LIMIT = 3;
const SUMMARY_EXCERPT_LENGTH = 200;
const RELIABILITY_SAMPLE_LIMIT = 20;

export async function fetchRecentMemory(admin: SupabaseClient): Promise<RecentMemory> {
  const [recentRuns, agentReliability] = await Promise.all([fetchRecentRuns(admin), fetchAgentReliability(admin)]);
  return { recentRuns, agentReliability };
}

async function fetchRecentRuns(admin: SupabaseClient): Promise<MemoryEntry[]> {
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

// Same success/total math as agentHealthScores (services/repositories/
// agent-workflows.repository.ts) -- inlined here rather than shared
// since one is a frontend Supabase client and the other a Deno edge
// function, matching this project's established dual-file pattern.
async function fetchAgentReliability(admin: SupabaseClient): Promise<AgentReliability[]> {
  const { data: rows } = await admin.from("agent_task_runs").select("agent_id, status").order("started_at", { ascending: false }).limit(RELIABILITY_SAMPLE_LIMIT * 10);
  if (!rows || rows.length === 0) return [];

  const buckets = new Map<string, { success: number; total: number }>();
  for (const row of rows) {
    const bucket = buckets.get(row.agent_id) ?? { success: 0, total: 0 };
    if (bucket.total >= RELIABILITY_SAMPLE_LIMIT) continue;
    bucket.total += 1;
    if (row.status === "success") bucket.success += 1;
    buckets.set(row.agent_id, bucket);
  }

  const reliability: AgentReliability[] = [];
  for (const [agentId, bucket] of buckets) {
    const rate = bucket.total > 0 ? bucket.success / bucket.total : 1;
    if (rate < 1) reliability.push({ agentId, recentSuccessRate: Math.round(rate * 100) / 100 });
  }
  return reliability;
}
