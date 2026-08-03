-- Track whether a generated image has been uploaded to Google Drive, and
-- where — lets the UI show "Saved" / a link instead of re-uploading.
alter table generated_images add column drive_file_id text;
alter table generated_images add column drive_view_url text;
