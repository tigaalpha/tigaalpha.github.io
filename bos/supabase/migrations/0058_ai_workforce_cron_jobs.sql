-- Daily briefing at 07:00 Asia/Bangkok (00:00 UTC), weekly business report
-- every Monday at the same time (01:00 UTC = 08:00 Bangkok, offset by an
-- hour from the daily one so they don't both land in the same tick on
-- Mondays). Same CRON_SECRET as every other heartbeat job this project
-- uses -- no new secret needed. ai-briefing-runner reads reportType from
-- the request body to know which of the two to generate.

select cron.schedule(
  'ai-daily-briefing',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/ai-briefing-runner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := jsonb_build_object('reportType', 'daily_briefing')
  );
  $$
);

select cron.schedule(
  'ai-weekly-business-report',
  '0 1 * * 1',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/ai-briefing-runner',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := jsonb_build_object('reportType', 'weekly_business_report')
  );
  $$
);
