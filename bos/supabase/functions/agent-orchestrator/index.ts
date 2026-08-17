import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireOwnerOrAdmin, requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { runWorkflow } from "../_shared/agent-orchestrator.ts";

// Triggers a CEO Agent workflow (goal -> plan -> parallel specialist
// agents -> synthesis). Runs synchronously within the request -- 5-6 AI
// calls, expect 15-40s. Owner/admin only (same tier as record_transaction:
// this is a strategic feature that spends real AI tokens on every click).
const RATE_LIMIT = { windowMinutes: 60, maxRequests: 10 };

// Wave 4: also runs weekly on its own via pg_cron (0067_wave4_ceo_loop_
// self_healing.sql), same x-cron-secret header pattern as
// marketing-metrics-snapshot -- no goal in the body then, so a fixed
// default goal is used and the run is attributed to no user (createdBy
// null, same as ai-briefing-runner's system-generated reports).
const DEFAULT_CRON_GOAL = "ตรวจสอบภาพรวมธุรกิจประจำสัปดาห์: มีอะไรน่าเป็นห่วงหรือควรทำต่อบ้าง";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  const isCron = await checkCronSecret(admin, req);

  try {
    if (isCron) {
      const workflowId = await runWorkflow(admin, DEFAULT_CRON_GOAL, null);
      return jsonResponse({ workflowId }, 201);
    }

    const userId = await requireStaff(admin, req);
    await requireOwnerOrAdmin(admin, userId);
    await enforceRateLimit(admin, userId, "agent-orchestrator", RATE_LIMIT);

    const { goal } = await req.json();
    if (!goal || typeof goal !== "string" || !goal.trim()) return jsonResponse({ error: "goal is required" }, 400);

    const workflowId = await runWorkflow(admin, goal.trim(), userId);
    return jsonResponse({ workflowId }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return await handleUnexpectedError(admin, "agent-orchestrator", error);
  }
});
