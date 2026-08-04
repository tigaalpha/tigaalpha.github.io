-- Fires agent-schedule-runner every 5 minutes via pg_cron + pg_net (both
-- already enabled on this project). The function itself decides which
-- agent_schedules rows are actually due (next_run_at <= now()) -- this job
-- is just the heartbeat. verify_jwt is off on that function since pg_cron
-- can't attach a user JWT, so it's protected by the x-cron-secret header
-- instead -- CRON_SECRET must be set as an Edge Function secret with this
-- exact value before this job's calls will succeed.

select cron.schedule(
  'agent-schedule-runner',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/agent-schedule-runner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
