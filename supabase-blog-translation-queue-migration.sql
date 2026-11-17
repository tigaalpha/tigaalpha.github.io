-- supabase-blog-translation-queue-migration.sql
--
-- Owner, 2026-11-17: "translate the articles of the Chinese blog into the other languages, only the ones that are not duplicates, every language complete"
-- and "if SQL is what blocks you, just run it" (applied the same day, in one transaction).
--
-- Scale: 1,312 Chinese articles x 9 languages (th en ja ko ru hi es fr ar) is about 11,000 articles. This file adds the plumbing that makes that safe:
--
--   1. blog_posts.live_only  (boolean, default false). A row with live_only = true is served live from the database (api/blog-page.js, the dynamic sitemap-blog.xml)
--      and scripts/build-blog-pages.mjs writes NO static file for it. Without this flag the next CI release build would write one static page per published row,
--      about 340 MB of HTML, into blog/, into the Vercel deployment and into the OTA zip every phone downloads.
--   2. blog_translation_jobs  one row per (Chinese article, target language): pending / claimed / staged / published / skip_dup / failed. RLS on, no policy: the API cannot read it.
--      Workers claim rows with blog_claim_jobs (FOR UPDATE SKIP LOCKED), so several workers never translate the same article, a dead worker's claim expires after 60 minutes,
--      and the whole job can be stopped and resumed at any time.
--   3. blog_stage_translation(...)  inserts the translated article as an UNPUBLISHED live_only row (slug from the job, category / cover / author / date copied from the Chinese
--      original) and marks the job staged. Nothing becomes visible until a separate, deliberate "published = true" step after validation.
--   4. blog_translation_cta  the fixed promo block of each language (the Chinese promo paragraph is NOT translated; each article gets the same reviewed block per language).
--
-- Slug rule (blog_target_slug): the Chinese slug is "<stem>-zh". en and th follow their own convention (no suffix): "<stem>". Every other language: "<stem>-<lang>".
-- "Not duplicates": a job whose target language already has the same slug (or the target slug) is skip_dup from the start; a topic-level pass marks near-identical topics later (dup_of).
--
-- Idempotent: every statement is create-if-not-exists / insert-on-conflict-do-nothing / create-or-replace.
-- Undo: drop the three functions and two tables, then: alter table public.blog_posts drop column live_only;   (delete the staged rows first: delete from public.blog_posts where live_only)

begin;

alter table public.blog_posts add column if not exists live_only boolean not null default false;
comment on column public.blog_posts.live_only is 'true = served live from the database only; scripts/build-blog-pages.mjs writes no static page for it';

create or replace function public.blog_target_slug(p_zh_slug text, p_lang text) returns text
language sql immutable as $$
  select case when p_lang in ('en', 'th') then regexp_replace(p_zh_slug, '-zh$', '')
              else regexp_replace(p_zh_slug, '-zh$', '') || '-' || p_lang end
$$;

create table if not exists public.blog_translation_jobs (
  zh_id uuid not null references public.blog_posts(id) on delete cascade,
  lang text not null check (lang in ('th','en','ja','ko','ru','hi','es','fr','ar')),
  zh_slug text not null,
  target_slug text not null,
  status text not null default 'pending' check (status in ('pending','claimed','staged','published','skip_dup','failed')),
  dup_of text,
  attempts integer not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  staged_at timestamptz,
  note text,
  primary key (zh_id, lang)
);
create index if not exists blog_translation_jobs_queue on public.blog_translation_jobs (lang, status, zh_slug);
alter table public.blog_translation_jobs enable row level security;

create table if not exists public.blog_translation_cta (
  lang text primary key check (lang in ('th','en','ja','ko','ru','hi','es','fr','ar')),
  paragraph text not null,
  bullets text not null,
  updated_at timestamptz not null default now()
);
alter table public.blog_translation_cta enable row level security;

insert into public.blog_translation_jobs (zh_id, lang, zh_slug, target_slug)
select z.id, l.lang, z.slug, public.blog_target_slug(z.slug, l.lang)
  from public.blog_posts z
 cross join (values ('th'),('en'),('ja'),('ko'),('ru'),('hi'),('es'),('fr'),('ar')) as l(lang)
 where z.lang = 'zh'
on conflict (zh_id, lang) do nothing;

-- exact duplicates: the target language already has this slug (the two articles the Chinese blog shares with every language) or the slug the translation would get
update public.blog_translation_jobs j
   set status = 'skip_dup', dup_of = t.slug, note = 'the slug already exists in the target language'
  from public.blog_posts z, public.blog_posts t
 where j.status = 'pending' and z.id = j.zh_id and t.lang = j.lang and (t.slug = z.slug or t.slug = j.target_slug);

create or replace function public.blog_claim_jobs(p_lang text, p_n integer, p_by text)
returns table (zh_id uuid, zh_slug text, target_slug text)
language plpgsql as $$
begin
  update public.blog_translation_jobs x set status = 'pending', claimed_by = null, claimed_at = null
   where x.lang = p_lang and x.status = 'claimed' and x.claimed_at < now() - interval '60 minutes';
  return query
  with c as (
    select j.zh_id from public.blog_translation_jobs j
     where j.lang = p_lang and j.status = 'pending'
     order by j.zh_slug limit greatest(1, least(p_n, 40)) for update skip locked)
  update public.blog_translation_jobs j
     set status = 'claimed', claimed_by = p_by, claimed_at = now(), attempts = j.attempts + 1
    from c where j.zh_id = c.zh_id and j.lang = p_lang
  returning j.zh_id, j.zh_slug, j.target_slug;
end $$;

create or replace function public.blog_stage_translation(p_zh_id uuid, p_lang text, p_title text, p_excerpt text, p_body text)
returns text
language plpgsql as $$
declare j public.blog_translation_jobs; z public.blog_posts; n integer;
begin
  select * into j from public.blog_translation_jobs where zh_id = p_zh_id and lang = p_lang for update;
  if not found then return 'no such job'; end if;
  if j.status in ('staged', 'published') then return 'already ' || j.status; end if;
  if j.status = 'skip_dup' then return 'skip_dup'; end if;
  select * into z from public.blog_posts where id = p_zh_id;
  insert into public.blog_posts (lang, slug, title, excerpt, body, category, cover_url, published, author_id, created_at, updated_at, live_only)
  values (p_lang, j.target_slug, btrim(p_title), btrim(p_excerpt), p_body, z.category, z.cover_url, false, z.author_id, z.created_at, now(), true)
  on conflict (lang, slug) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    update public.blog_translation_jobs set status = 'skip_dup', dup_of = j.target_slug, note = 'the slug was taken at insert time' where zh_id = p_zh_id and lang = p_lang;
    return 'skip_dup(conflict)';
  end if;
  update public.blog_translation_jobs set status = 'staged', staged_at = now() where zh_id = p_zh_id and lang = p_lang;
  return 'staged';
end $$;

-- nobody but the database owner (the SQL editor / the service role) may call these: they write rows
revoke all on function public.blog_claim_jobs(text, integer, text) from public, anon, authenticated;
revoke all on function public.blog_stage_translation(uuid, text, text, text, text) from public, anon, authenticated;

commit;
