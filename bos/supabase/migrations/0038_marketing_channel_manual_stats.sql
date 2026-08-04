-- Marketing Channel Status page: TikTok, X, and Instagram have no free
-- real-time API for follower counts (TikTok needs business API approval, X
-- needs a paid tier, Instagram needs Meta app review beyond what's already
-- connected) -- the owner enters these by hand instead. Website/YouTube/
-- Facebook are checked live on every page load and never persisted here.

create table marketing_channel_manual_stats (
  id uuid primary key default uuid_generate_v4(),
  channel text not null unique check (channel in ('tiktok', 'x', 'instagram')),
  followers integer not null default 0,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

create trigger marketing_channel_manual_stats_set_updated_at
  before update on marketing_channel_manual_stats
  for each row execute function set_updated_at();

alter table marketing_channel_manual_stats enable row level security;

create policy "marketing_channel_manual_stats: staff read" on marketing_channel_manual_stats for select using (is_staff());
create policy "marketing_channel_manual_stats: staff write" on marketing_channel_manual_stats for all using (is_staff()) with check (is_staff());
