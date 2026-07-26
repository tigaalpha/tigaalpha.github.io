-- Piano App: Video Lessons tables + RPC
-- Run this in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) if the
-- lesson_videos / video_likes tables don't exist yet.

-- ── helper: piano admin check ────────────────────────────────────────────────
create or replace function is_piano_admin() returns boolean
language sql stable security definer as $$
  select coalesce(
    (select is_admin or admin_tier > 0
     from profiles where id = auth.uid() limit 1),
    false
  );
$$;

-- ── lesson_videos ─────────────────────────────────────────────────────────────
create table if not exists lesson_videos (
  id              uuid        primary key default uuid_generate_v4(),
  title           text        not null,
  description     text,
  published       boolean     not null default true,
  drive_file_id   text,       -- single video file from Google Drive
  drive_folder_id text,       -- folder of videos from Google Drive
  created_at      timestamptz not null default now()
);

create index if not exists lesson_videos_created_at_idx
  on lesson_videos (created_at desc);
alter table lesson_videos enable row level security;

-- everyone can see published videos
drop policy if exists "lesson_videos: public read" on lesson_videos;
create policy "lesson_videos: public read"
  on lesson_videos for select
  using (published = true);

-- admins can see all + write
drop policy if exists "lesson_videos: admin select" on lesson_videos;
create policy "lesson_videos: admin select"
  on lesson_videos for select
  using (is_piano_admin());

drop policy if exists "lesson_videos: admin write" on lesson_videos;
create policy "lesson_videos: admin write"
  on lesson_videos for all
  using  (is_piano_admin())
  with check (is_piano_admin());

-- ── video_likes ───────────────────────────────────────────────────────────────
create table if not exists video_likes (
  user_id    uuid  not null references auth.users (id) on delete cascade,
  file_id    text  not null,
  created_at timestamptz not null default now(),
  primary key (user_id, file_id)
);

create index if not exists video_likes_file_id_idx
  on video_likes (file_id);
alter table video_likes enable row level security;

-- anyone can read likes (for public like counts)
drop policy if exists "video_likes: public read" on video_likes;
create policy "video_likes: public read"
  on video_likes for select using (true);

-- users can only manage their own likes
drop policy if exists "video_likes: user write" on video_likes;
create policy "video_likes: user write"
  on video_likes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── get_video_like_counts RPC ──────────────────────────────────────────────────
-- Called from Piano app as:
--   sb.rpc("get_video_like_counts", { ids: ["fileId1", "fileId2", ...] })
-- Returns rows: { file_id text, likes bigint, liked_by_me boolean }
create or replace function get_video_like_counts(ids text[])
returns table (file_id text, likes bigint, liked_by_me boolean)
language sql stable security definer as $$
  select
    vl.file_id,
    count(*)::bigint                             as likes,
    bool_or(vl.user_id = auth.uid())             as liked_by_me
  from video_likes vl
  where vl.file_id = any(ids)
  group by vl.file_id;
$$;
