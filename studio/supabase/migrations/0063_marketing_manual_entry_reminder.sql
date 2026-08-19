-- Weekly LINE nudge so the owner doesn't have to remember to log
-- TikTok/X/Instagram's remaining manual metrics herself. Monday 09:00
-- Bangkok (02:00 UTC).
select cron.schedule(
  'marketing-manual-entry-reminder',
  '0 2 * * 1',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/marketing-manual-entry-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
