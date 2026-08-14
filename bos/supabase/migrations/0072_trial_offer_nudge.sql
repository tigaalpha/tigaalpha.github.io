-- Chatbot sales optimization: the free trial lesson offer no longer appears
-- in the opening pitch (per the owner's request) -- instead it's offered as
-- a separate, one-time nudge if a brand-new customer goes quiet for about
-- an hour after the opening exchange. trial_offer_sent guards against
-- sending it more than once per conversation.
alter table conversations add column trial_offer_sent boolean not null default false;

-- Needs a tight ~1h window (unlike the 6h-interval abandoned-conversation
-- follow-up), so this runs every 15 minutes.
select cron.schedule(
  'trial-offer-nudge',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/trial-offer-nudge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
