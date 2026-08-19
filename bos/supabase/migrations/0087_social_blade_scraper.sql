-- Social Blade scraper: profile URLs stored in integration_settings.
-- The social-blade-scraper Edge Function reads these keys to know which
-- profiles to scrape. No API key needed — scrapes public HTML.
--
-- integration_settings keys:
--   social_blade_youtube   → https://socialblade.com/youtube/user/USERNAME
--   social_blade_tiktok    → https://socialblade.com/tiktok/user/USERNAME
--   social_blade_instagram → https://socialblade.com/instagram/user/USERNAME

-- Cron job: run social-blade-scraper every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
-- Uses pg_cron + pg_net to call the Edge Function with the cron secret.
SELECT cron.schedule(
  'social-blade-scraper',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/social-blade-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'x-cron-secret', (SELECT value FROM integration_settings WHERE key = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
