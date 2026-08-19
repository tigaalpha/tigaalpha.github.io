-- Level 5 Wave 4, chunk 1: CEO Autonomous Loop + self-healing circuit
-- breaker for automation rules.

alter table automation_rules add column consecutive_failures int not null default 0;

-- Weekly self-triggered CEO Agent run (Monday 03:00 UTC, two hours after
-- the existing ai-weekly-business-report at 01:00 UTC so they don't land
-- in the same tick). agent-orchestrator now accepts this same
-- x-cron-secret header (see agent-orchestrator/index.ts) and falls back
-- to a fixed default goal when triggered this way -- same CRON_SECRET
-- every other heartbeat job in this project already uses, no new secret
-- needed.
select cron.schedule(
  'ceo-agent-weekly-run',
  '0 3 * * 1',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/agent-orchestrator',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
