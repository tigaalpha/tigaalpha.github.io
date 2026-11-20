-- supabase-blog-de-migration.sql
--
-- German (de) joins the blog (2026-11-20), the way hi / es / fr / ar did in supabase-blog-hi-es-fr-ar-migration.sql (PART A of it): the database learns the eleventh language.
-- WRITTEN, NOT APPLIED: needs the owner's approval (AGENTS.md hard rule); run it in the Supabase SQL editor or through the connector, ONE execution. Idempotent: every statement is
-- drop-constraint-if-exists + add, create or replace, or insert ... on conflict; a second run changes nothing.
-- There are NO article rows in this file. German articles are public.blog_posts rows with lang = 'de' and live_only = true, written by the translation queue
-- (supabase-blog-translation-ops.sql) and served live by api/blog-page and api/blog-sitemap; nothing about German is committed under blog-src/.
-- Run it AFTER supabase-blog-views-migration.sql, supabase-blog-hi-es-fr-ar-migration.sql, supabase-blog-translation-queue-migration.sql and supabase-blog-translation-ops.sql (it stops with a message when a piece of them is missing).
-- Never run supabase-blog-ja-ko-ru-migration.sql or supabase-blog-hi-es-fr-ar-migration.sql again AFTER this file: they write the shorter lists back.
--
-- What it does:
--   1. widens blog_posts_lang_check, blog_hits_lang_check, blog_view_totals_lang_check to the eleven languages (th en zh ja ko ru hi es fr ar de) and the two queue tables'
--      lang checks (blog_translation_jobs, blog_translation_cta; they never allowed zh) to th en ja ko ru hi es fr ar de;
--   2. recreates blog_hit() and blog_view_counts() with 'de' known (same bodies as supabase-blog-views-migration.sql, security definer, search_path empty, same grants);
--   3. inserts the German row of blog_translation_cta (the fixed promo paragraph and the three links that every translated article carries verbatim; docs/blog-promo-template.md);
--   4. recreates blog_check_staged (the validator) with German: average length 6,800 characters, script share = Latin letters (the else branch of blog_script_share, like es / fr),
--      the stop-word check 'not_german' (German function words must be at least 15 % of the words, English ones at most 4 %), the price rule US$24.99 like every language but Thai.
--   The other functions of the queue (blog_claim_jobs, blog_claim_sources, blog_stage_translation, blog_requeue_failed, blog_publish_validated, blog_target_slug, blog_fix_price_text) take the language
--   as a parameter and carry no list, so they need no change: the slug of a German article is "<stem>-de".
--
-- After applying: create the German jobs (the optional block at the end), then run the workers for 'de'. Undo: put the ten-language lists back (the two older files hold them in git history) and
-- delete from public.blog_translation_cta where lang = 'de'; delete the German rows first (delete from public.blog_posts where lang = 'de') or the old checks refuse to come back.

begin;

-- 0. Stop before anything is changed when a piece this file widens is missing.
do $pre$
begin
  if to_regclass('public.blog_posts') is null or to_regclass('public.blog_hits') is null or to_regclass('public.blog_view_totals') is null
     or to_regclass('public.blog_translation_jobs') is null or to_regclass('public.blog_translation_cta') is null then
    raise exception 'de blog migration: a blog table is missing; apply supabase-blog-views-migration.sql and supabase-blog-translation-queue-migration.sql first';
  end if;
  if to_regprocedure('public.blog_hit(text,text,text,text)') is null or to_regprocedure('public.blog_view_counts(text)') is null
     or to_regprocedure('public.blog_check_staged(text,boolean)') is null or to_regprocedure('public.blog_script_share(text,text)') is null
     or to_regprocedure('public.blog_word_share(text,text[])') is null then
    raise exception 'de blog migration: a blog function is missing; apply supabase-blog-translation-validate.sql and supabase-blog-translation-ops.sql first';
  end if;
end
$pre$;

-- 1. The language checks.
alter table public.blog_posts drop constraint if exists blog_posts_lang_check;
alter table public.blog_posts add constraint blog_posts_lang_check check (lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar','de'));
alter table public.blog_hits drop constraint if exists blog_hits_lang_check;
alter table public.blog_hits add constraint blog_hits_lang_check check (lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar','de'));
alter table public.blog_view_totals drop constraint if exists blog_view_totals_lang_check;
alter table public.blog_view_totals add constraint blog_view_totals_lang_check check (lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar','de'));
alter table public.blog_translation_jobs drop constraint if exists blog_translation_jobs_lang_check;
alter table public.blog_translation_jobs add constraint blog_translation_jobs_lang_check check (lang in ('th','en','ja','ko','ru','hi','es','fr','ar','de'));
alter table public.blog_translation_cta drop constraint if exists blog_translation_cta_lang_check;
alter table public.blog_translation_cta add constraint blog_translation_cta_lang_check check (lang in ('th','en','ja','ko','ru','hi','es','fr','ar','de'));

-- 2. The two functions that carry the list: the text of supabase-blog-views-migration.sql with 'de' added (same grants, security definer, search_path).
create or replace function public.blog_hit(p_lang text, p_slug text, p_vid text, p_kind text default 'view')
returns bigint
language plpgsql security definer set search_path = '' as $$
declare n bigint; added int; spent int; today date := ((now() at time zone 'Asia/Bangkok')::date);
begin
  if p_lang is null or p_lang not in ('th','en','zh','ja','ko','ru','hi','es','fr','ar','de') then return -1; end if;
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
   where v.lang = p_lang and p_lang in ('th','en','zh','ja','ko','ru','hi','es','fr','ar','de')
     and exists (select 1 from public.blog_posts b where b.lang = v.lang and b.slug = v.slug and b.published);   -- a take-down article's slug and number are not listed
$$;
revoke all on function public.blog_view_counts(text) from public;
grant execute on function public.blog_view_counts(text) to anon, authenticated;

-- 3. The German promo block: every translated article carries this paragraph and these three links VERBATIM (the validator checks it with position()).
--    Plain ASCII spaces and straight quotes only, so a translating agent can reproduce it exactly; du-form. Same facts and sentence order as the Spanish row.
insert into public.blog_translation_cta (lang, paragraph, bullets) values ('de',
$cta$TIGA ALPHA ist eine KI-Klavierlern-App von einem Team in Thailand. Die App gibt es in 11 Sprachen: Thai, Englisch, Chinesisch, Arabisch, Japanisch, Russisch, Spanisch, Französisch, Hindi, Koreanisch und Deutsch. Teacher Aum, CEO von TIGA ALPHA, hat 20 Jahre Erfahrung im Klavierunterricht, und diese Lehrerfahrung prägt jede Lektion. Wenn du spielst, hört die App dir zu und sagt dir, welche Noten oder welche Zählzeiten du als Nächstes üben solltest, damit dein Feedback konkret statt allgemein ausfällt. Nutze sie als App für Online-Klavierunterricht für kurze tägliche Einheiten, folge ihr als komplettem Online-Klavierkurs oder kombiniere sie mit dem Unterricht bei einer Lehrkraft. Egal, ob du bei null anfängst, nach einer langen Pause wieder einsteigst, gemeinsam mit deinen Kindern Musik lernst oder einfach nur zum Spaß spielst: Dein nächster Schritt bleibt immer klar. Wer neu dabei ist, testet Premium 7 Tage lang kostenlos, danach kostet es US$24.99 pro Monat.$cta$,
$cta$- Herunterladen und loslegen: [TIGA ALPHA](https://www.tigaalpha.com/landing-de/)
- Unterricht vor Ort in Thailand: [TIGA Studio](https://www.tigastudio.net/)
- Über das Unternehmen: [tigaalpha.com](https://www.tigaalpha.com)$cta$)
on conflict (lang) do update set paragraph = excluded.paragraph, bullets = excluded.bullets, updated_at = now();

-- 4. The validator, CURRENT version of supabase-blog-translation-ops.sql plus German (avgs row, not_german).
create or replace function public.blog_check_staged(p_lang text, p_only_unpublished boolean default true)
returns table(id uuid, slug text, ok boolean, problems text[], len_ratio numeric, share numeric)
language sql stable as $function$
  with avgs(l, a) as (values ('zh', 2369), ('en', 5983), ('th', 4629), ('ja', 3072), ('ko', 3235), ('ru', 6632), ('hi', 5081), ('es', 5745), ('fr', 6204), ('ar', 4532), ('de', 6800)),
  cfg as (
    select
      case p_lang when 'ja' then 0.75 when 'ko' then 0.70 when 'ru' then 0.85 when 'hi' then 0.80 when 'ar' then 0.80 when 'th' then 0.78 else 0.97 end as min_share,
      (p_lang in ('ja', 'ko', 'zh')) as cjk,
      (select a from avgs where l = p_lang)::numeric as avg_t,
      (select c.paragraph from public.blog_translation_cta c where c.lang = p_lang) as cta_p,
      (select c.bullets from public.blog_translation_cta c where c.lang = p_lang) as cta_b
  ),
  j as (
    select t.id, t.slug, t.title, t.excerpt, t.body, t.cover_url, z.title as ztitle, z.body as zbody, z.cover_url as zcover,
           (select a from avgs where l = z.lang)::numeric as avg_s
      from public.blog_posts t
      left join public.blog_translation_jobs jb on jb.lang = t.lang and jb.target_slug = t.slug
      left join public.blog_posts z on z.id = jb.zh_id
     where t.lang = p_lang and t.live_only and (not p_only_unpublished or not t.published)
  )
  select j.id, j.slug, cardinality(pr.problems) = 0, pr.problems,
         round(length(j.body)::numeric / nullif(length(j.zbody), 0), 2),
         round(public.blog_script_share(j.body, p_lang), 3)
    from j cross join cfg
    cross join lateral (select array_remove(array[
      case when j.zbody is null then 'no_source' end,
      case when p_lang <> 'ja' and (j.body || j.title || j.excerpt) ~ '[㐀-䶿一-鿿]' then 'han_characters' end,
      case when p_lang <> 'ja' and (j.body || j.title || j.excerpt) ~ '[　-〿＀-￯]' then 'cjk_punctuation' end,
      case when public.blog_script_share(j.body, p_lang) < cfg.min_share then 'body_script_share' end,
      case when public.blog_script_share(j.title, p_lang) < cfg.min_share - 0.2 then 'title_script_share' end,
      case when public.blog_script_share(j.excerpt, p_lang) < cfg.min_share - 0.1 then 'excerpt_script_share' end,
      case when p_lang = 'en' and (public.blog_word_share(j.body, array['the','and','of','to','is','in','that','with','for','you','your','are','it','on']) < 0.12
                                   or public.blog_word_share(j.body, array['el','los','las','de','que','por','para','une','les','des','est','pour']) > 0.05) then 'not_english' end,
      case when p_lang = 'es' and (public.blog_word_share(j.body, array['el','la','los','las','de','que','y','en','un','una','para','con','por','se','es']) < 0.15
                                   or public.blog_word_share(j.body, array['the','and','of','le','les','des','est','pour','une']) > 0.04) then 'not_spanish' end,
      case when p_lang = 'fr' and (public.blog_word_share(j.body, array['le','la','les','des','de','et','en','un','une','pour','avec','que','est','vous','du']) < 0.15
                                   or public.blog_word_share(j.body, array['the','and','of','el','los','las','que','una','para']) > 0.04) then 'not_french' end,
      case when p_lang = 'de' and (public.blog_word_share(j.body, array['der','die','das','und','ist','nicht','ein','eine','zu','den','mit','für','auf','sie','ich','du','von','dem','im','es','sich','auch','als','an','bei','nach','wie','wird','kann']) < 0.15
                                   or public.blog_word_share(j.body, array['the','and','of','to','is','that','with']) > 0.04) then 'not_german' end,
      case when p_lang <> 'th' and j.body !~ 'US\$24\.99' then 'price_missing' end,
      case when p_lang = 'th' and j.body !~ '799' then 'price_missing' end,
      case when p_lang <> 'th' and j.body ~ '(¥|￥)\s*176|799|THB|฿' then 'wrong_price_text' end,
      case when p_lang = 'th' and j.body ~ 'US\$|¥\s*176|THB' then 'wrong_price_text' end,
      case when j.zbody ~ 'tigastudio\.net' and cfg.cta_p is null then 'cta_row_missing' end,
      case when j.zbody ~ 'tigastudio\.net' and cfg.cta_p is not null and position(cfg.cta_p in j.body) = 0 then 'cta_paragraph_missing' end,
      case when j.zbody ~ 'tigastudio\.net' and cfg.cta_b is not null and position(cfg.cta_b in j.body) = 0 then 'cta_links_missing' end,
      case when j.cover_url is distinct from j.zcover then 'cover_differs' end,
      case when (select coalesce(array_agg(m[1] order by m[1]), '{}') from regexp_matches(j.body, '!\[[^]]*\]\((https?://[^)[:space:]]+)\)', 'g') m)
              is distinct from (select coalesce(array_agg(m[1] order by m[1]), '{}') from regexp_matches(j.zbody, '!\[[^]]*\]\((https?://[^)[:space:]]+)\)', 'g') m) then 'image_urls_differ' end,
      case when abs((select count(*) from regexp_matches(j.body, E'(^|\n)## ', 'g')) - (select count(*) from regexp_matches(j.zbody, E'(^|\n)## ', 'g'))) > 2 then 'heading_count' end,
      case when j.body ~ '##[ \t]+##' then 'double_heading_marker' end,
      case when abs((select count(*) from regexp_matches(j.body, E'(^|\n)- ', 'g')) - (select count(*) from regexp_matches(j.zbody, E'(^|\n)- ', 'g'))) > 4 then 'bullet_count' end,
      case when abs((select count(*) from regexp_matches(j.body, E'(^|\n)\\*\\*', 'g')) - (select count(*) from regexp_matches(j.zbody, E'(^|\n)\\*\\*', 'g'))) > 3 then 'faq_count' end,
      case when length(j.body)::numeric / nullif(length(j.zbody), 0) < 0.55 * cfg.avg_t / j.avg_s then 'too_short' end,
      case when length(j.body)::numeric / nullif(length(j.zbody), 0) > 1.9 * cfg.avg_t / j.avg_s then 'too_long' end,
      case when length(j.title) < (case when cfg.cjk then 4 else 8 end) or length(j.title) > (case when cfg.cjk then 60 else 130 end) then 'title_length' end,
      case when j.title = j.ztitle then 'title_unchanged' end,
      case when length(j.excerpt) < (case when cfg.cjk then 20 else 40 end) or length(j.excerpt) > (case when cfg.cjk then 220 else 340 end) then 'excerpt_length' end,
      case when j.excerpt ~ '[*#`]|\[|\n' then 'excerpt_markdown' end,
      case when j.body ~* '(here is the translation|translation:|translator|翻译|译文|lorem ipsum|as an ai|\[object|undefined)' or j.body ~ '\mTODO\M' or j.body ~ '\mNaN\M' then 'junk_text' end,
      case when length(j.body) > 1500 and position(E'\n' in j.body) = 0 then 'single_line_body' end
    ], null) as problems) pr
$function$;
revoke all on function public.blog_check_staged(text, boolean) from public, anon, authenticated;   -- read-only, but it reads unpublished rows

-- 5. Read back inside the same transaction: nothing is committed when a check still refuses German or the promo row is not the text above.
do $post$
declare bad text;
begin
  select string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ') into bad
    from pg_constraint c
   where c.contype = 'c' and c.conrelid in ('public.blog_posts'::regclass, 'public.blog_hits'::regclass, 'public.blog_view_totals'::regclass, 'public.blog_translation_jobs'::regclass, 'public.blog_translation_cta'::regclass)
     and pg_get_constraintdef(c.oid) ~ '\mlang\M' and pg_get_constraintdef(c.oid) !~ '''de''';
  if bad is not null then raise exception 'de blog migration: a language check still refuses German: %', bad; end if;
  if (select count(*) from public.blog_translation_cta where lang = 'de' and paragraph like 'TIGA ALPHA ist eine KI-Klavierlern-App%' and paragraph like '%US$24.99 pro Monat.' and bullets like '%/landing-de/)%') <> 1 then
    raise exception 'de blog migration: the German promo row is missing or not what this file says';
  end if;
  if pg_get_functiondef('public.blog_hit(text,text,text,text)'::regprocedure) !~ '''de''' or pg_get_functiondef('public.blog_view_counts(text)'::regprocedure) !~ '''de''' then
    raise exception 'de blog migration: blog_hit or blog_view_counts does not know de';
  end if;
  if pg_get_functiondef('public.blog_check_staged(text,boolean)'::regprocedure) !~ 'not_german' then raise exception 'de blog migration: blog_check_staged does not know de'; end if;
end
$post$;

commit;

-- OPTIONAL, run later and on its own when the German translation starts (not part of the transaction above; the queue is stopped and resumed at will): one job per Chinese article,
-- the same statement supabase-blog-translation-queue-migration.sql used for the nine languages. Sources of other languages (prio 1, src_lang) are queued by the translation tooling, not here.
--   insert into public.blog_translation_jobs (zh_id, lang, zh_slug, target_slug)
--   select z.id, 'de', z.slug, public.blog_target_slug(z.slug, 'de') from public.blog_posts z where z.lang = 'zh'
--   on conflict (zh_id, lang) do nothing;
--   update public.blog_translation_jobs j set status = 'skip_dup', dup_of = t.slug, note = 'the slug already exists in the target language'
--     from public.blog_posts z, public.blog_posts t
--    where j.lang = 'de' and j.status = 'pending' and z.id = j.zh_id and t.lang = 'de' and (t.slug = z.slug or t.slug = j.target_slug);

-- Verification (read-only, run after applying):
--   select public.blog_view_counts('de');                       -- empty list, no error
--   select lang, left(paragraph, 60), bullets from public.blog_translation_cta where lang = 'de';
--   select * from public.blog_check_staged('de');               -- empty until the first German article is staged
