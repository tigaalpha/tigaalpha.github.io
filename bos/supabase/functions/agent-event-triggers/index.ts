import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { checkEventTriggers } from "../_shared/agent-event-triggers.ts";

// Hourly heartbeat (see migration 0078 cron): watches for business events
// that warrant a CEO Agent analysis even when no schedule fired — a sharp
// drop in won sales, no new won customer in a week, dormant customers,
// overdue payments, stale leads, or a content drought. Fires a workflow
// for each event (deduped to once a week per event type) and records the
// trigger in agent_event_trigger_log.
//
// Auth uses the shared checkCronSecret (env CRON_SECRET first, then the
// integration_settings cron_secret value) — the old env-only check 401'd
// every tick whenever the env secret drifted from the DB value, silently
// killing this whole heartbeat (same bug system-health-check had).
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const fired = await checkEventTriggers(admin);
    return jsonResponse({ checked: true, fired });
  } catch (error) {
    return await handleUnexpectedError(admin, "agent-event-triggers", error);
  }
});
