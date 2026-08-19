-- Real AI-generated motion video clips (Veo, image-to-video) — distinct from
-- the free client-side slideshow renderer, which just crossfades still
-- images and never leaves the browser. Generation is async (can take
-- minutes), so this table tracks the Google operation until it resolves.
create table video_clips (
  id uuid primary key default uuid_generate_v4(),
  source_image_id uuid references generated_images (id) on delete set null,
  status text not null default 'processing' check (status in ('processing', 'done', 'error')),
  operation_name text,
  duration_seconds integer not null,
  mime_type text,
  video_base64 text,
  error_message text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index video_clips_created_at_idx on video_clips (created_at desc);

alter table video_clips enable row level security;
create policy "video_clips: staff read" on video_clips for select using (is_staff());
create policy "video_clips: staff write" on video_clips for all using (is_staff()) with check (is_staff());
