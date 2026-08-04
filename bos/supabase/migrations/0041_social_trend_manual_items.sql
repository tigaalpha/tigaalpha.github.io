-- Social Trends page: Google and YouTube have real trending-topic sources
-- (Google's unofficial daily-trends endpoint, YouTube Data API
-- chart=mostPopular) and are fetched live on every page load, never
-- persisted here. TikTok, Instagram, Facebook, WeChat, Alipay, and
-- Xiaohongshu (Little Red Note) have no free public trending-topics API --
-- the owner logs what they're observing on each platform by hand instead,
-- ranked like a top-N list.

create table social_trend_manual_items (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('tiktok', 'instagram', 'facebook', 'wechat', 'alipay', 'xiaohongshu')),
  rank smallint not null default 1,
  topic text not null,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

create index social_trend_manual_items_platform_idx on social_trend_manual_items (platform, rank);

create trigger social_trend_manual_items_set_updated_at
  before update on social_trend_manual_items
  for each row execute function set_updated_at();

alter table social_trend_manual_items enable row level security;

create policy "social_trend_manual_items: staff read" on social_trend_manual_items for select using (is_staff());
create policy "social_trend_manual_items: staff write" on social_trend_manual_items for all using (is_staff()) with check (is_staff());
