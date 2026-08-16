-- 0082: AI-first ops round 2 — close the loops the data audit showed were
-- open. Three new automation crons:
--   * categorize-transactions (daily): LLM assigns a proper category to
--     transactions with a generic/missing category.
--   * content-publish (hourly): approved content_calendar items that are
--     due are turned into queued social_posts rows so the owner publishes
--     with one click (closes the "สร้าง→อนุมัติ→โพสต์" loop).
-- No new tables: kb_drafts (eval→KB corrections), content_calendar,
-- social_posts, ai_evals all already exist.

-- 1) social_posts link back to the content_calendar item that spawned it,
-- so the Content page can show publish status in one place.
alter table social_posts add column if not exists content_calendar_id uuid references content_calendar (id) on delete set null;
create index if not exists social_posts_content_calendar_idx on social_posts (content_calendar_id);

-- 2) Cron jobs (same hardcoded x-cron-secret literal as 0078/0079 — matches
-- the deployed CRON_SECRET).
select cron.schedule(
  'categorize-transactions-daily',
  '30 1 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/categorize-transactions',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'content-publish-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/content-publish',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
