-- Cover description for a blog article (optional alt text on the cover image).
-- WRITTEN, NOT APPLIED. Needs the owner's approval; run it in the Supabase SQL editor.
-- Additive only: adds one nullable column if it is missing. Does not drop, rename, or rewrite any column, row, policy, or constraint.
-- Until this runs, the admin form still publishes: it retries the save without cover_alt when the column is absent.
alter table public.blog_posts add column if not exists cover_alt text;
