-- Fires automation-engine-runner every 5 minutes via pg_cron + pg_net,
-- same heartbeat pattern as agent-schedule-runner (0040) and the same
-- CRON_SECRET already set as an Edge Function secret -- no new secret
-- needed. The function decides what's actually due (unprocessed events +
-- periodic-condition rules); this job is just the heartbeat.

select cron.schedule(
  'automation-engine-runner',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/automation-engine-runner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
