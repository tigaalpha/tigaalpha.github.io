-- Knowledge-files bucket: attachments from the knowledge-graph "เพิ่มข้อมูล &
-- องค์ความรู้" page (/studio/knowledge-graph/add). PDF/Word/plain text are
-- read client-side into RAG text and never need storage; every other file
-- type (video, audio, images, archives, …) is stored here as the original
-- binary and linked from knowledge_documents.file_path.
--
-- Private bucket (staff read, owner/admin write), NO mime whitelist and a
-- generous size cap — the whole point of that page is "any file type".
-- Until this has been run, the upload page falls back to the existing
-- `slips` bucket (which the payment flow already uploads to from the
-- client), and if that also rejects the file it saves the file's info
-- anyway and says the original was not kept.
-- Re-runnable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('knowledge-files', 'knowledge-files', false, 1073741824, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists knowledge_files_storage_select on storage.objects;
create policy knowledge_files_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'knowledge-files' and public.is_staff());

drop policy if exists knowledge_files_storage_insert on storage.objects;
create policy knowledge_files_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'knowledge-files' and public.is_owner_or_admin());

drop policy if exists knowledge_files_storage_update on storage.objects;
create policy knowledge_files_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'knowledge-files' and public.is_owner_or_admin())
  with check (bucket_id = 'knowledge-files' and public.is_owner_or_admin());

drop policy if exists knowledge_files_storage_delete on storage.objects;
create policy knowledge_files_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'knowledge-files' and public.is_owner_or_admin());
