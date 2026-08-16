import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Every cron function validates the same way (x-cron-secret header vs the
// CRON_SECRET env var — the repo's established pattern, see
// agent-schedule-runner / ai-briefing-runner). Falls back to the
// integration_settings `cron_secret` value for setups that store it there
// (system-health-check's pattern). One helper so the AI-first cron jobs
// can't drift.
export async function checkCronSecret(admin: SupabaseClient, req: Request): Promise<boolean> {
  const envSecret = Deno.env.get("CRON_SECRET");
  if (envSecret) return req.headers.get("x-cron-secret") === envSecret;
  const { data } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  return Boolean(data?.value && req.headers.get("x-cron-secret") === data.value);
}
