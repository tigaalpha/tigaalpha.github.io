-- Vertical video scripts (TikTok/Reels/Shorts content for Tiga Studio).
create table video_scripts (
  id uuid primary key default uuid_generate_v4(),
  topic text not null,
  hook text not null,
  script text not null,
  caption text not null,
  hashtags text[] not null default '{}',
  language text not null default 'th',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index video_scripts_created_at_idx on video_scripts (created_at desc);
alter table video_scripts enable row level security;
create policy "video_scripts: staff read" on video_scripts for select using (is_staff());
create policy "video_scripts: staff write" on video_scripts for all using (is_staff()) with check (is_staff());

-- Voice-over scripts for lifestyle/travel content (separate audience/tone from video_scripts).
create table voiceover_scripts (
  id uuid primary key default uuid_generate_v4(),
  topic text not null,
  script text not null,
  language text not null default 'th',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index voiceover_scripts_created_at_idx on voiceover_scripts (created_at desc);
alter table voiceover_scripts enable row level security;
create policy "voiceover_scripts: staff read" on voiceover_scripts for select using (is_staff());
create policy "voiceover_scripts: staff write" on voiceover_scripts for all using (is_staff()) with check (is_staff());
