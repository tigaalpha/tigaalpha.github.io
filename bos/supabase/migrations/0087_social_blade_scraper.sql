-- Social Blade scraper: profile URLs stored in integration_settings.
-- The social-blade-scraper Edge Function reads these keys to know which
-- profiles to scrape. No API key needed — scrapes public HTML.
--
-- integration_settings keys:
--   social_blade_youtube   → https://socialblade.com/youtube/user/USERNAME
--   social_blade_tiktok    → https://socialblade.com/tiktok/user/USERNAME
--   social_blade_instagram → https://socialblade.com/instagram/user/USERNAME
--   social_blade_facebook  → https://socialblade.com/facebook/page/USERNAME

-- Cron job: run social-blade-scraper every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
-- Uses pg_cron + pg_net to call the Edge Function with vault secrets.
SELECT cron.schedule(
  'social-blade-scraper',
  '0 */6 * * *',
  $CRON$
  select net.http_post(
    url := 'https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/social-blade-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $CRON$
);
