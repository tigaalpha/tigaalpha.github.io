-- Marketing Dashboard: historical follower/engagement metrics across
-- channels. Nothing today persists any of this -- /marketing-channels
-- live-fetches Website/YouTube/Facebook/Search Console status on every
-- page load and never stores it, and marketing_channel_manual_stats
-- (TikTok/X/Instagram) is a single overwritable row per channel with no
-- history. This table is append-only snapshots so a date-range dashboard
-- becomes possible; marketing_channel_manual_stats is left untouched and
-- kept in sync for the 'followers' metric specifically (see
-- marketing-metrics.repository.ts).

create table marketing_metric_snapshots (
  id uuid primary key default uuid_generate_v4(),
  channel text not null check (channel in ('website', 'youtube', 'facebook', 'tiktok', 'instagram', 'x')),
  metric text not null check (metric in ('followers', 'likes', 'views', 'shares', 'comments', 'saves', 'reposts')),
  value integer not null,
  source text not null check (source in ('auto', 'manual')),
  captured_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null
);

create index marketing_metric_snapshots_range_idx on marketing_metric_snapshots (channel, metric, captured_at desc);

alter table marketing_metric_snapshots enable row level security;

create policy "marketing_metric_snapshots: staff read" on marketing_metric_snapshots for select using (is_staff());
create policy "marketing_metric_snapshots: staff write" on marketing_metric_snapshots for all using (is_staff()) with check (is_staff());

-- Hourly -- YouTube's Data API has a fixed daily quota (already a
-- documented concern in marketing-channel-status/index.ts) and Facebook's
-- Graph API rate-limits per app/user, so this is "as often as practical,"
-- not literal real-time; a "sync now" button on the dashboard covers the
-- on-demand case between ticks.
select cron.schedule(
  'marketing-metrics-snapshot',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/marketing-metrics-snapshot',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9e93110140925da5816dc4163167fab8b8b106ea413c3040304051122ac8b38a'),
    body := '{}'::jsonb
  );
  $$
);
