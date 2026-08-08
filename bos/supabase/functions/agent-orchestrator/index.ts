import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireOwnerOrAdmin, requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { runWorkflow } from "../_shared/agent-orchestrator.ts";

// Triggers a CEO Agent workflow (goal -> plan -> parallel specialist
// agents -> synthesis). Runs synchronously within the request -- 5-6 AI
// calls, expect 15-40s. Owner/admin only (same tier as record_transaction:
// this is a strategic feature that spends real AI tokens on every click).
const RATE_LIMIT = { windowMinutes: 60, maxRequests: 10 };

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
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
