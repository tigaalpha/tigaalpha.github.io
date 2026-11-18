-- supabase-blog-translation-ops.sql
--
-- APPLIED on 2026-11-17 (owner: "if SQL is what blocks you, just run it" and "do all of these, approved"). This file is the repo copy of what the database holds NOW
-- for the blog translation queue after the first migration (supabase-blog-translation-queue-migration.sql) and the validators (supabase-blog-translation-validate.sql):
-- every function below was read back from the live database with pg_get_functiondef, so it supersedes the older bodies in those two files
-- (blog_claim_jobs, blog_stage_translation and blog_check_staged here are the CURRENT versions). Idempotent: create or replace / if not exists.
--
-- What was added on top of the first migration:
--   * blog_translation_jobs.prio (0 = the Chinese articles, 1 = articles of en th ja ko ru that are also translated into hi es fr ar) and .src_lang (the language of the source
--     article; zh_id holds the id of the SOURCE article whatever its language); a unique index on (lang, target_slug) so two jobs can never write the same article;
--   * blog_target_slug2(src_slug, src_lang, lang): the slug rule for sources that are not Chinese;
--   * blog_claim_jobs: claims in prio order; blog_claim_sources: claim + the source text + the fixed promo block in ONE call (what the translator workers use);
--   * blog_stage_translation: v2, overwrites an UNPUBLISHED live_only row of the same job (so a failed article can be redone), refuses to touch a published one;
--   * blog_check_staged: v2 (length bands from the average article length of each language pair, promo block detected by the tigastudio.net link, cover must equal the source's);
--   * blog_requeue_failed(lang): staged rows that fail the validator go back to pending (3 attempts, then failed);
--   * blog_publish_validated(lang, limit): sets published = true on validated rows, ONLY while app_settings.blog_translation_publish.enabled is true (it is false until the
--     live_only change of scripts/build-blog-pages.mjs is on main, otherwise the next CI build would write one static page per published row).
-- Nobody but the database owner (the SQL editor / the service role) can call the functions that write: anon and authenticated are revoked.

begin;

alter table public.blog_translation_jobs add column if not exists prio smallint not null default 0;
alter table public.blog_translation_jobs add column if not exists src_lang text not null default 'zh';
create unique index if not exists blog_translation_jobs_target_uq on public.blog_translation_jobs (lang, target_slug) where status <> 'skip_dup';

create or replace function public.blog_target_slug2(p_src_slug text, p_src_lang text, p_lang text)
returns text language sql immutable as $function$
  select case when p_lang in ('en', 'th') then regexp_replace(p_src_slug, '-' || p_src_lang || '$', '')
              else regexp_replace(p_src_slug, '-' || p_src_lang || '$', '') || '-' || p_lang end
$function$;

create or replace function public.blog_claim_jobs(p_lang text, p_n integer, p_by text)
returns table(zh_id uuid, zh_slug text, target_slug text)
language plpgsql as $function$
begin
  update public.blog_translation_jobs x set status = 'pending', claimed_by = null, claimed_at = null
   where x.lang = p_lang and x.status = 'claimed' and x.claimed_at < now() - interval '60 minutes';
  return query
  with c as (
    select j.zh_id from public.blog_translation_jobs j
     where j.lang = p_lang and j.status = 'pending'
     order by j.prio, j.zh_slug limit greatest(1, least(p_n, 40)) for update skip locked)
  update public.blog_translation_jobs j
     set status = 'claimed', claimed_by = p_by, claimed_at = now(), attempts = j.attempts + 1
    from c where j.zh_id = c.zh_id and j.lang = p_lang
  returning j.zh_id, j.zh_slug, j.target_slug;
end $function$;

create or replace function public.blog_claim_sources(p_lang text, p_n integer, p_by text)
returns table(zh_id uuid, src_lang text, src_slug text, target_slug text, category text, title text, excerpt text, body text, cta_paragraph text, cta_bullets text)
language plpgsql as $function$
begin
  return query
  with c as (select * from public.blog_claim_jobs(p_lang, p_n, p_by)),
  j as (
    select c.zh_id as jid, c.target_slug as tslug, p.lang as slang, p.slug as sslug, p.category as cat, p.title as ttl, p.excerpt as exc, p.body as bdy,
           row_number() over (order by c.zh_slug) as rn
      from c join public.blog_posts p on p.id = c.zh_id
  )
  select j.jid, j.slang, j.sslug, j.tslug, j.cat, j.ttl, j.exc, j.bdy,
         case when j.rn = 1 then t.paragraph end, case when j.rn = 1 then t.bullets end
    from j left join public.blog_translation_cta t on t.lang = p_lang
   order by j.rn;
end $function$;

create or replace function public.blog_stage_translation(p_zh_id uuid, p_lang text, p_title text, p_excerpt text, p_body text)
returns text
language plpgsql as $function$
declare j public.blog_translation_jobs; z public.blog_posts; ex public.blog_posts;
begin
  select * into j from public.blog_translation_jobs where zh_id = p_zh_id and lang = p_lang for update;
  if not found then return 'no such job'; end if;
  if j.status = 'published' then return 'already published'; end if;
  if j.status = 'skip_dup' then return 'skip_dup'; end if;
  select * into z from public.blog_posts where id = p_zh_id;
  if z.id is null then return 'no source'; end if;
  select * into ex from public.blog_posts where lang = p_lang and slug = j.target_slug;
  if found then
    if ex.live_only and not ex.published then
      update public.blog_posts
         set title = btrim(p_title), excerpt = btrim(p_excerpt), body = p_body, category = z.category, cover_url = z.cover_url, updated_at = now()
       where id = ex.id;
    else
      update public.blog_translation_jobs set status = 'skip_dup', dup_of = j.target_slug, note = 'the slug belongs to a different article' where zh_id = p_zh_id and lang = p_lang;
      return 'skip_dup(conflict)';
    end if;
  else
    insert into public.blog_posts (lang, slug, title, excerpt, body, category, cover_url, published, author_id, created_at, updated_at, live_only)
    values (p_lang, j.target_slug, btrim(p_title), btrim(p_excerpt), p_body, z.category, z.cover_url, false, z.author_id, z.created_at, now(), true);
  end if;
  update public.blog_translation_jobs set status = 'staged', staged_at = now(), note = null where zh_id = p_zh_id and lang = p_lang;
  return 'staged';
end $function$;

create or replace function public.blog_requeue_failed(p_lang text)
returns table(requeued integer, gave_up integer)
language plpgsql as $function$
declare a integer := 0; b integer := 0;
begin
  with bad as (
    select p.slug, array_to_string(c.problems, ',') as why
      from public.blog_check_staged(p_lang, true) c join public.blog_posts p on p.id = c.id
     where not c.ok
  ), up as (
    update public.blog_translation_jobs j
       set status = case when j.attempts >= 3 then 'failed' else 'pending' end, note = left('validator: ' || bad.why, 300), claimed_by = null, claimed_at = null
      from bad
     where j.lang = p_lang and j.target_slug = bad.slug and j.status = 'staged'
    returning j.status
  )
  select count(*) filter (where status = 'pending'), count(*) filter (where status = 'failed') into a, b from up;
  return query select a, b;
end $function$;

create or replace function public.blog_publish_validated(p_lang text, p_limit integer default 200)
returns table(published_count integer)
language plpgsql as $function$
declare enabled boolean; n integer := 0;
begin
  select coalesce((select (s.value ->> 'enabled')::boolean from public.app_settings s where s.key = 'blog_translation_publish'), false) into enabled;
  if not enabled then raise exception 'blog translation publishing is switched off: app_settings.blog_translation_publish.enabled is not true'; end if;
  with good as (
    select p.id, p.slug
      from public.blog_check_staged(p_lang, true) c
      join public.blog_posts p on p.id = c.id
      join public.blog_translation_jobs j on j.lang = p_lang and j.target_slug = p.slug
     where c.ok and j.status = 'staged' and p.live_only and not p.published
     order by p.created_at, p.slug
     limit greatest(1, least(coalesce(p_limit, 200), 3000))
  ), up as (
    update public.blog_posts p set published = true, updated_at = now() from good where p.id = good.id returning p.slug
  ), jb as (
    update public.blog_translation_jobs j set status = 'published' from up where j.lang = p_lang and j.target_slug = up.slug returning 1
  )
  select count(*) into n from jb;
  return query select n;
end $function$;

-- the validator (CURRENT version). The average article length per language (avgs) was measured on the published articles on 2026-11-17; the length band of a pair is
-- 0.55 .. 1.9 x (average of the target / average of the source). Everything it flags is something a script can see: a wrong language, leftover Chinese, a lost promo block,
-- a changed image URL, a truncated or doubled body. It does not grade style.
create or replace function public.blog_check_staged(p_lang text, p_only_unpublished boolean default true)
returns table(id uuid, slug text, ok boolean, problems text[], len_ratio numeric, share numeric)
language sql stable as $function$
  with avgs(l, a) as (values ('zh', 2369), ('en', 5983), ('th', 4629), ('ja', 3072), ('ko', 3235), ('ru', 6632), ('hi', 5081), ('es', 5745), ('fr', 6204), ('ar', 4532)),
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
      case when j.body ~* '(here is the translation|translation:|translator|翻译|译文|lorem ipsum|as an ai|i cannot|\[object|undefined)' or j.body ~ '\mTODO\M' or j.body ~ '\mNaN\M' then 'junk_text' end,
      case when length(j.body) > 1500 and position(E'\n' in j.body) = 0 then 'single_line_body' end
    ], null) as problems) pr
$function$;

-- nobody but the database owner may call the functions that write or publish
revoke all on function public.blog_claim_jobs(text, integer, text) from public, anon, authenticated;
revoke all on function public.blog_claim_sources(text, integer, text) from public, anon, authenticated;
revoke all on function public.blog_stage_translation(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.blog_requeue_failed(text) from public, anon, authenticated;
revoke all on function public.blog_publish_validated(text, integer) from public, anon, authenticated;
revoke all on function public.blog_check_staged(text, boolean) from public, anon, authenticated;   -- read-only, but it reads unpublished rows

commit;

-- Undo (the queue only; the staged rows are deleted first): delete from public.blog_posts where live_only; drop function public.blog_claim_sources(text, integer, text);
--   drop function public.blog_requeue_failed(text); drop function public.blog_publish_validated(text, integer); drop function public.blog_target_slug2(text, text, text);
