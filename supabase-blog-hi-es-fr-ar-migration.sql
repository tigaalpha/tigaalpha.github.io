-- Blog in Hindi, Spanish, French and Arabic (owner, 2026-11-16).
-- WRITTEN, NOT APPLIED. Do not run this until the owner says so, in the Supabase SQL editor.
-- Re-runnable. It does not insert, update or delete any row. Existing articles stay as they are.
-- Lang codes stored in blog_posts.lang are exactly hi, es, fr, ar (not hi-IN, es-ES, fr-FR, ar-AR).
--
-- What it changes, on a database that already allows ('th','en','zh','ja','ko','ru'):
--   1. public.blog_posts: blog_posts_lang_check now also allows hi, es, fr, ar.
--   2. public.blog_hits and public.blog_view_totals: the same allow-list (a leftover inline check that
--      still names only the older set is dropped first, whatever its generated name).
--   3. public.blog_hit() and public.blog_view_counts(): the same allow-list inside the functions.
--      blog_stats() and blog_purge() do not filter by language and are left as they are.
-- A second run drops the new checks and creates them again. No article is seeded: these languages
-- start empty and are written from the Admin Blog page.
--
-- After applying, check (read-only):
--   select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) as def
--     from pg_constraint
--    where conname in ('blog_posts_lang_check', 'blog_hits_lang_check', 'blog_view_totals_lang_check')
--    order by 1;
--   -- each def must list 'hi', 'es', 'fr' and 'ar'
--   select count(*) from public.blog_posts;  -- same count as before this file
--   select public.blog_hit('hi', 'no-such-article', 'abcdefgh12345678', 'view');  -- -1 (lang is accepted; the article is missing)
--   select public.blog_hit('xx', 'no-such-article', 'abcdefgh12345678', 'view');  -- -1 (lang refused)
--   select * from public.blog_view_counts('ar');  -- empty result, not an error

-- Drop any language check that does not yet name Hindi, including an auto-named copy of the old six-language check.
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as rel
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname in ('blog_posts', 'blog_hits', 'blog_view_totals')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%lang%'
       and pg_get_constraintdef(c.oid) not ilike '%''hi''%'
  loop
    execute format('alter table %s drop constraint if exists %I', r.rel, r.conname);
  end loop;
end $$;

alter table public.blog_posts drop constraint if exists blog_posts_lang_check;
alter table public.blog_posts add constraint blog_posts_lang_check check (lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar'));

alter table public.blog_hits drop constraint if exists blog_hits_lang_check;
alter table public.blog_hits add constraint blog_hits_lang_check check (lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar'));

alter table public.blog_view_totals drop constraint if exists blog_view_totals_lang_check;
alter table public.blog_view_totals add constraint blog_view_totals_lang_check check (lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar'));

create or replace function public.blog_hit(p_lang text, p_slug text, p_vid text, p_kind text default 'view')
returns bigint
language plpgsql security definer set search_path = '' as $$
declare n bigint; added int; spent int; today date := ((now() at time zone 'Asia/Bangkok')::date);
begin
  if p_lang is null or p_lang not in ('th','en','zh','ja','ko','ru','hi','es','fr','ar') then return -1; end if;
  if p_kind is null or p_kind not in ('view','read','gate','click') then return -1; end if;
  if p_slug is null or char_length(p_slug) not between 1 and 200 then return -1; end if;
  if p_vid is null or p_vid !~ '^[A-Za-z0-9_-]{8,64}$' then return -1; end if;
  if not exists (select 1 from public.blog_posts b where b.lang = p_lang and b.slug = p_slug and b.published) then return -1; end if;
  insert into public.blog_hits (lang, slug, vid, day, kind) values (p_lang, p_slug, p_vid, today, p_kind) on conflict do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    insert into public.blog_day_budget as bd (day, slot, n) values (today, (hashtext(p_vid) & 15)::smallint, 1)
      on conflict (day, slot) do update set n = bd.n + 1 where bd.n < 12500;
    get diagnostics spent = row_count;
    if spent = 0 then
      delete from public.blog_hits h where h.lang = p_lang and h.slug = p_slug and h.vid = p_vid and h.day = today and h.kind = p_kind;
      return -3;
    end if;
  end if;
  if p_kind = 'view' and added > 0 then
    insert into public.blog_view_totals (lang, slug, views) values (p_lang, p_slug, 1)
      on conflict (lang, slug) do update set views = public.blog_view_totals.views + 1;
  end if;
  select coalesce(v.views, 0) into n from public.blog_view_totals v where v.lang = p_lang and v.slug = p_slug;
  return coalesce(n, 0);
end $$;
revoke all on function public.blog_hit(text, text, text, text) from public;
grant execute on function public.blog_hit(text, text, text, text) to anon, authenticated;

create or replace function public.blog_view_counts(p_lang text)
returns table (slug text, views bigint)
language sql stable security definer set search_path = '' as $$
  select v.slug, v.views from public.blog_view_totals v
   where v.lang = p_lang and p_lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar')
     and exists (select 1 from public.blog_posts b where b.lang = v.lang and b.slug = v.slug and b.published);
$$;
revoke all on function public.blog_view_counts(text) from public;
grant execute on function public.blog_view_counts(text) to anon, authenticated;
