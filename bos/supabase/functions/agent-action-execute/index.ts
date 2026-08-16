import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireOwnerOrAdmin, requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { executeAgentAction } from "../_shared/agent-actions-db.ts";
import { classifyAgentAction } from "../_shared/agent-actions.ts";

// Owner/admin only: turns a pending_approval CEO Agent action into a real
// executed action (send LINE, create a schedule, ...) or rejects it. The
// low-risk types never come here — they auto-execute when the workflow
// completes; this endpoint exists for the money- and customer-facing ones.
const RATE_LIMIT = { windowMinutes: 60, maxRequests: 30 };

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await requireOwnerOrAdmin(admin, userId);
    await enforceRateLimit(admin, userId, "agent-action-execute", RATE_LIMIT);

    const { actionId, decision } = await req.json();
    if (!actionId || typeof actionId !== "string") return jsonResponse({ error: "actionId is required" }, 400);
    if (decision !== "approve" && decision !== "reject") return jsonResponse({ error: "decision must be approve or reject" }, 400);

    const { data: action, error: fetchErr } = await admin.from("agent_actions").select("*").eq("id", actionId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!action) return jsonResponse({ error: "Action not found" }, 404);
    if (action.status !== "pending_approval") return jsonResponse({ error: `Action is already ${action.status}` }, 409);

    if (decision === "reject") {
      await admin.from("agent_actions").update({ status: "rejected", result: "เจ้าของปฏิเสธ", executed_at: new Date().toISOString() }).eq("id", actionId);
      return jsonResponse({ status: "rejected" });
    }

    const result = await executeAgentAction(admin, action.action_type, action.action_payload as Record<string, unknown>, action.workflow_run_id);
    await admin
      .from("agent_actions")
      .update({
        status: result.ok ? "executed" : "failed",
        result: result.message,
        executed_at: new Date().toISOString(),
      })
      .eq("id", actionId);

    if (!result.ok) return jsonResponse({ status: "failed", message: result.message }, 502);
    return jsonResponse({ status: "executed", message: result.message, classification: classifyAgentAction(action.action_type) });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return await handleUnexpectedError(admin, "agent-action-execute", error);
  }
});
