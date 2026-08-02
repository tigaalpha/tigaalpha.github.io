-- Schedules system-health-check to run every 15 minutes, matching that
-- function's WINDOW_MINUTES. Reuses the cron_secret already generated in
-- migration 0015 for the same pg_net -> Edge Function auth pattern.

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'system-health-check',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/system-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
