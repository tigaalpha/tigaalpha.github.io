-- AI Sales Employee (PRD): "Recover abandoned conversations" — a lead who
-- went quiet mid-funnel gets a natural AI follow-up on LINE instead of just
-- sitting in the pipeline forever.

alter table conversations add column last_followed_up_at timestamptz;

create extension if not exists pg_net with schema extensions;

-- The cron secret authenticates net.http_post -> the follow-up-conversations
-- Edge Function (verify_jwt=false, since pg_net has no Supabase session to
-- attach). Generated server-side so the actual value never appears in this
-- migration file / git history — same integration_settings table already
-- used for the Google Calendar OAuth values.
insert into integration_settings (key, value)
values ('cron_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

select cron.schedule(
  'follow-up-abandoned-conversations',
  '0 */6 * * *', -- every 6 hours
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/follow-up-conversations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
