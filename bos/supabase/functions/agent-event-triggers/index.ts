import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { checkEventTriggers } from "../_shared/agent-event-triggers.ts";

// Hourly heartbeat (see migration 0078 cron): watches for business events
// that warrant a CEO Agent analysis even when no schedule fired — a sharp
// drop in won sales, or a week with zero new won customers. Fires a
// workflow for each event (deduped to once a week per event type) and
// records the trigger in agent_event_trigger_log.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  try {
    const fired = await checkEventTriggers(admin);
    return jsonResponse({ checked: true, fired });
  } catch (error) {
    return await handleUnexpectedError(admin, "agent-event-triggers", error);
  }
});
