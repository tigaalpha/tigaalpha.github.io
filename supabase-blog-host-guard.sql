-- supabase-blog-host-guard.sql
--
-- NOT APPLIED. Written 2026-11-27. Run only with the owner's explicit approval for THIS file.
-- Why: the external article automation (it lives outside this repo: no file, edge function or workflow here writes the old host) kept inserting article bodies whose promo block links to
-- https://tigaalpha.github.io/landing-<xx>/ — 10 English articles on 2026-11-26 20:46-20:51 UTC, fixed by hand the next day; 90 rows in all still held the old host when this was written.
-- What it does: a BEFORE INSERT OR UPDATE trigger on public.blog_posts that rewrites, in body only, https://tigaalpha.github.io/landing[-xx]/ to https://www.tigaalpha.com/landing[-xx]/ and adds
-- ?utm_source=blog&utm_medium=seo&utm_campaign=<slug> when the link has no query, and any other https://tigaalpha.github.io/ to https://www.tigaalpha.com/. Same rules as
-- supabase-blog-old-domain-links-migration.sql. It never raises (a problem must not block a publish). Idempotent. To undo: drop trigger trg_blog_host_guard on public.blog_posts; drop function public.blog_host_guard().
begin;
create or replace function public.blog_host_guard() returns trigger language plpgsql as $$
begin
  if new.body like '%tigaalpha.github.io%' then
    new.body := regexp_replace(new.body, 'https://tigaalpha\.github\.io/(landing[a-z-]*/?)(?![?a-z0-9_.~%/-])', 'https://www.tigaalpha.com/\1?utm_source=blog&utm_medium=seo&utm_campaign=' || new.slug, 'g');
    new.body := replace(new.body, 'https://tigaalpha.github.io/', 'https://www.tigaalpha.com/');
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists trg_blog_host_guard on public.blog_posts;
create trigger trg_blog_host_guard before insert or update of body on public.blog_posts for each row execute function public.blog_host_guard();
commit;
