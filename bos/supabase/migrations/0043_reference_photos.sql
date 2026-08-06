-- Reference photos: real photos of the owner/staff (or other subjects the
-- business wants consistently featured), stored alongside the Knowledge
-- Base so they're managed in one place. Used to condition AI image
-- generation (Image Studio) so generated marketing stills/video source
-- images can feature a real, recognizable person instead of a generic one.

create table reference_photos (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  mime_type text not null,
  image_base64 text not null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table reference_photos enable row level security;

create policy "reference_photos: staff read" on reference_photos for select using (is_staff());
create policy "reference_photos: staff write" on reference_photos for all using (is_staff()) with check (is_staff());
