-- App Ad Kit: given an app's URL, AI researches it and produces a full
-- marketing kit (article, 5 standout features with image prompts, and 2
-- video concepts) that staff then turn into real images/video clips using
-- the existing Image Studio and Vertical Video pipelines (image_ids /
-- video_clip_ids just reference rows already created there — this table
-- does not duplicate generated_images/video_clips).
create table app_ad_kits (
  id uuid primary key default uuid_generate_v4(),
  app_url text not null,
  app_name text not null,
  summary text not null,
  top_features jsonb not null default '[]'::jsonb,
  article_markdown text not null,
  video_concepts jsonb not null default '[]'::jsonb,
  image_ids uuid[] not null default '{}',
  video_clip_ids uuid[] not null default '{}',
  sources jsonb not null default '[]'::jsonb,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index app_ad_kits_created_at_idx on app_ad_kits (created_at desc);

alter table app_ad_kits enable row level security;
create policy "app_ad_kits: staff read" on app_ad_kits for select using (is_staff());
create policy "app_ad_kits: staff write" on app_ad_kits for all using (is_staff()) with check (is_staff());
