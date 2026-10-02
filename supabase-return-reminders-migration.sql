-- Day-1 / 3 / 7 "come back" reminders — the table, the off-by-default switch and the cron job
-- (users report 2026-10-02, platform rec #3). Pairs with supabase/functions/return-reminders/index.ts.
--
-- WRITTEN, NOT APPLIED (AGENTS.md hard rule: no migration and no function deploy without the
-- owner's explicit approval, one by one). Additive and re-runnable: if-not-exists / on conflict.
-- Order: (1) apply this file, (2) deploy the function, set its secrets, (3) run the cron block at
-- the bottom, (4) flip the switch from the admin side only when ready:
--   update public.app_settings set value = jsonb_set(value, '{enabled}', 'true') where key = 'return_reminders';
--
-- What it stores: one row per (person, day) that was nudged, so nobody is nudged twice for the
-- same day. Nothing else about a person is copied; the push body is a fixed sentence per day.

create table if not exists public.return_reminders_log (
  user_id  uuid     not null references auth.users (id) on delete cascade,
  day      smallint not null check (day in (1, 3, 7)),
  sent_at  timestamptz not null default now(),
  primary key (user_id, day)
);

-- Service role only: the edge function is the sole reader and writer. No policy = no client access.
alter table public.return_reminders_log enable row level security;

insert into public.app_settings (key, value)
values ('return_reminders', jsonb_build_object('enabled', false, 'days', jsonb_build_array(1, 3, 7)))
on conflict (key) do nothing;

-- ── cron (run AFTER the function is deployed and CRON_SECRET is set on it) ───────────────────────
-- 12:00 Bangkok time = 05:00 UTC, every day. Replace <CRON_SECRET> with the secret you set on the
-- function; never commit the real value.
--
-- select cron.schedule(
--   'return-reminders', '0 5 * * *',
--   $$ select net.http_post(
--        url := 'https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/return-reminders',
--        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--        body := '{}'::jsonb
--      ) $$
-- );
--
-- To stop it for good: select cron.unschedule('return-reminders');

-- ── verification after applying ──────────────────────────────────────────────────────────────────
-- select key, value from public.app_settings where key = 'return_reminders';   -- enabled = false
-- select count(*) from public.return_reminders_log;                             -- 0 until the switch is on
