-- Public bucket for images attached to admin popup announcements.
-- Anyone can view (public bucket); only app admins can upload/replace/delete,
-- mirroring the lesson-videos policies. Images only, 5 MB each.
-- Re-runnable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcements', 'announcements', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists announcements_storage_insert on storage.objects;
create policy announcements_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'announcements' and public.is_app_admin());

drop policy if exists announcements_storage_update on storage.objects;
create policy announcements_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'announcements' and public.is_app_admin())
  with check (bucket_id = 'announcements' and public.is_app_admin());

drop policy if exists announcements_storage_delete on storage.objects;
create policy announcements_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'announcements' and public.is_app_admin());
