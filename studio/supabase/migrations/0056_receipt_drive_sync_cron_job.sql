-- Fires receipt-drive-sync every 5 minutes, same heartbeat pattern and
-- CRON_SECRET as agent-schedule-runner (0040) and automation-engine-runner
-- (0054) -- no new secret needed.

select cron.schedule(
  'receipt-drive-sync',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/receipt-drive-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
