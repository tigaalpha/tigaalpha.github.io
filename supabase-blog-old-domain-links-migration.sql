-- supabase-blog-old-domain-links-migration.sql
--
-- NOT APPLIED. Written on 2026-11-26 (Step 1.4) and WAITING FOR THE OWNER'S APPROVAL (AGENTS.md hard rule: SQL against the live database is run only with
-- the owner's explicit approval for this file). Nothing has been run, and no read-only count was taken against the live table either: the numbers below are unknown.
--
-- Why (owner, 2026-11-26): the call-to-action block at the end of many articles links to the OLD domain, https://tigaalpha.github.io/landing/ (and /landing-en/,
-- /landing-zh/ ... /landing-de/), which is not where the product lives. The committed sources (blog-src/, ja ko ru hi es fr ar) were already fixed by
-- scripts/fix-old-domain-links.mjs; the th / en / zh articles and every article the translation queue wrote live ONLY in public.blog_posts, so they need this.
-- The static blog pages (blog/**) are generated from the database by a real `npm run build` (it fetches the live catalog), so they follow once this has been applied and the site is built again.
--
-- What it does, in ONE transaction, on public.blog_posts.body ONLY (no title, excerpt or any other column):
--   1. copies the bodies it is about to change into public.blog_posts_backup_old_domain (RLS on, no policy: nobody reads it through the API);
--   2. https://tigaalpha.github.io/landing<xx>/  ->  https://www.tigaalpha.com/landing<xx>/  (the language of the link is kept) and, for a link without utm_source,
--      adds ?utm_source=blog&utm_medium=seo&utm_campaign=<the article's slug> (a link that already has a query gets the three parameters in front of it and "&" after them;
--      a link that already has utm_source only changes host);
--   3. any other https://tigaalpha.github.io/<path>  ->  https://www.tigaalpha.com/<path>  (path kept);
--   4. reads back in the same transaction and raises (so nothing is committed) if a body still holds a link to tigaalpha.github.io/landing.
-- Idempotent: after one run nothing matches, a second run backs up and changes 0 rows (the backup insert skips rows already saved).
-- NOT touched: the OTA / update manifest (it stays on github.io), studio, bos, the already-applied supabase-blog-*-migration files, blog_translation_cta (its rows already link to www.tigaalpha.com).
--
-- To undo: update public.blog_posts p set body = b.body from public.blog_posts_backup_old_domain b where b.id = p.id;

begin;

create table if not exists public.blog_posts_backup_old_domain (
  id uuid primary key,
  lang text not null,
  slug text not null,
  body text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.blog_posts_backup_old_domain enable row level security;

insert into public.blog_posts_backup_old_domain (id, lang, slug, body)
select id, lang, slug, body
  from public.blog_posts
 where body like '%tigaalpha.github.io%'
on conflict (id) do nothing;

-- (a) a landing link with a query that has no utm_source yet: new host, the three UTM parameters in front, "&" before the old query
update public.blog_posts
   set body = regexp_replace(body,
         'https://tigaalpha\.github\.io/(landing[a-z-]*/?)\?(?![^[:space:])"''<]*utm_source=)',
         'https://www.tigaalpha.com/\1?utm_source=blog&utm_medium=seo&utm_campaign=' || slug || '&', 'g')
 where body like '%tigaalpha.github.io/landing%';

-- (b) a landing link with no query at all: new host + the UTM parameters
update public.blog_posts
   set body = regexp_replace(body,
         'https://tigaalpha\.github\.io/(landing[a-z-]*/?)(?![?a-z0-9_.~%/-])',
         'https://www.tigaalpha.com/\1?utm_source=blog&utm_medium=seo&utm_campaign=' || slug, 'g')
 where body like '%tigaalpha.github.io/landing%';

-- (c) everything else a reader can tap on the old host (a landing link that already carried utm_source, any other path): host only
update public.blog_posts
   set body = replace(body, 'https://tigaalpha.github.io/', 'https://www.tigaalpha.com/')
 where body like '%https://tigaalpha.github.io/%';

do $$
declare n integer;
begin
  select count(*) into n from public.blog_posts where body like '%tigaalpha.github.io/landing%';
  if n > 0 then raise exception 'old-domain landing links remain in % blog_posts rows: nothing is committed', n; end if;
end $$;

commit;
