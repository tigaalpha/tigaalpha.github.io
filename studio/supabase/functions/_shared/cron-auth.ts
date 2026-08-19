import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Every cron function validates the same way (x-cron-secret header vs the
// CRON_SECRET env var — the repo's established pattern, see
// agent-schedule-runner / ai-briefing-runner). Accepts EITHER the env value
// or the integration_settings `cron_secret` value: some crons bake the env
// secret into their pg_net request at creation, while older ones (e.g.
// system-health-check) read integration_settings live on every tick — so a
// function must accept both or a real cron silently 401s. One helper so the
// AI-first cron jobs can't drift.
export async function checkCronSecret(admin: SupabaseClient, req: Request): Promise<boolean> {
  const header = req.headers.get("x-cron-secret");
  if (!header) return false;
  const envSecret = Deno.env.get("CRON_SECRET");
  if (envSecret && header === envSecret) return true;
  const { data } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  return Boolean(data?.value && header === data.value);
}
