-- Still images generated via Gemini for future vertical-video content.
-- Stored as base64 directly (small business scale, no Storage bucket needed).
create table generated_images (
  id uuid primary key default uuid_generate_v4(),
  prompt text not null,
  mime_type text not null,
  image_base64 text not null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index generated_images_created_at_idx on generated_images (created_at desc);

alter table generated_images enable row level security;
create policy "generated_images: staff read" on generated_images for select using (is_staff());
create policy "generated_images: staff write" on generated_images for all using (is_staff()) with check (is_staff());
