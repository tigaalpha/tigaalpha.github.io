-- supabase-blog-translation-validate.sql
--
-- APPLIED on 2026-11-17 (owner: "if SQL is what blocks you, just run it"), together with supabase-blog-translation-queue-migration.sql.
-- Read-only helpers that judge STAGED translations (published = false, live_only = true) before anything is published:
--
--   select * from public.blog_check_staged('ar');            -- one row per staged article: ok, problems[], len_ratio (translation / Chinese length), share (target-script share)
--   select * from public.blog_check_staged('ar', false);     -- the same for the already published live_only rows
--
-- 2026-11-20: German (de) added: length band 1.7 .. 4.9 (average German article about 6,800 characters), stop-word check not_german, Latin-letter script share (the else branch of blog_script_share).
--
-- What a row is checked for: the Chinese source exists; no Han characters or CJK punctuation (except Japanese); the share of the target script among the letters
-- (title / excerpt / body); for en / es / fr / de a stop-word language check; the price text (US$24.99 everywhere except Thai, which keeps 799; no yuan, no baht, no THB elsewhere);
-- the stored promo block (public.blog_translation_cta) present verbatim; the same image URLs as the source; heading, bullet and FAQ counts within a small tolerance;
-- body length against the Chinese length (bands per language); title and excerpt shape (length, no markdown); junk phrases ("translation:", "TODO", ...).
-- The thresholds were set from the existing published articles of each language (script shares: ar .90-.95, en/es/fr 1.0, hi .91-.95, ja .87-.92, ko .83-.92, ru .94-.97, th .86-.96)
-- and are meant to catch a wrong language, leftover Chinese, a lost block or a truncated body, not to grade style.

create or replace function public.blog_script_share(p text, p_lang text) returns numeric
language sql immutable as $$
  select case when length(l.s) = 0 then 0::numeric else
    length(regexp_replace(l.s,
      case p_lang
        when 'ja' then '[^ぁ-んァ-ヶー一-龯]'
        when 'ko' then '[^가-힣]'
        when 'ru' then '[^а-яА-ЯёЁ]'
        when 'hi' then '[^ऀ-ॿ]'
        when 'ar' then '[^؀-ۿݐ-ݿ]'
        when 'th' then '[^฀-๿]'
        else '[^A-Za-zÀ-ÿĀ-ſ]' end, '', 'g'))::numeric / length(l.s) end
  from (select regexp_replace(p, '[^[:alpha:]฀-๿ऀ-ॿ]', '', 'g') as s) l
$$;

create or replace function public.blog_word_share(p text, p_words text[]) returns numeric
language sql immutable as $$
  select case when count(*) = 0 then 0::numeric else (count(*) filter (where w = any(p_words)))::numeric / count(*) end
    from (select lower(m[1]) as w from regexp_matches(p, '[[:alpha:]À-ÿ]+', 'g') as m) x
$$;

create or replace function public.blog_check_staged(p_lang text, p_only_unpublished boolean default true)
returns table (id uuid, slug text, ok boolean, problems text[], len_ratio numeric, share numeric)
language sql stable as $$
  with cfg as (
    select
      case p_lang when 'ja' then 0.75 when 'ko' then 0.70 when 'ru' then 0.85 when 'hi' then 0.80 when 'ar' then 0.80 when 'th' then 0.78 else 0.97 end as min_share,
      case p_lang when 'en' then 1.4 when 'th' then 1.1 when 'ja' then 0.9 when 'ko' then 0.9 when 'ru' then 1.5 when 'hi' then 1.3 when 'es' then 1.5 when 'fr' then 1.6 when 'ar' then 1.2 when 'de' then 1.7 end as lo,
      case p_lang when 'en' then 4.0 when 'th' then 3.2 when 'ja' then 2.2 when 'ko' then 2.4 when 'ru' then 4.5 when 'hi' then 3.8 when 'es' then 4.2 when 'fr' then 4.5 when 'ar' then 3.4 when 'de' then 4.9 end as hi,
      (p_lang in ('ja', 'ko', 'zh')) as cjk,
      (select c.paragraph from public.blog_translation_cta c where c.lang = p_lang) as cta_p,
      (select c.bullets from public.blog_translation_cta c where c.lang = p_lang) as cta_b
  ),
  j as (
    select t.id, t.slug, t.title, t.excerpt, t.body, z.title as ztitle, z.body as zbody
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
      case when position('免费试用高级版7天' in j.zbody) > 0 and cfg.cta_p is null then 'cta_row_missing' end,
      case when position('免费试用高级版7天' in j.zbody) > 0 and cfg.cta_p is not null and position(cfg.cta_p in j.body) = 0 then 'cta_paragraph_missing' end,
      case when position('免费试用高级版7天' in j.zbody) > 0 and cfg.cta_b is not null and position(cfg.cta_b in j.body) = 0 then 'cta_links_missing' end,
      case when (select coalesce(array_agg(m[1] order by m[1]), '{}') from regexp_matches(j.body, '!\[[^]]*\]\((https?://[^)[:space:]]+)\)', 'g') m)
              is distinct from (select coalesce(array_agg(m[1] order by m[1]), '{}') from regexp_matches(j.zbody, '!\[[^]]*\]\((https?://[^)[:space:]]+)\)', 'g') m) then 'image_urls_differ' end,
      case when abs((select count(*) from regexp_matches(j.body, E'(^|\n)## ', 'g')) - (select count(*) from regexp_matches(j.zbody, E'(^|\n)## ', 'g'))) > 2 then 'heading_count' end,
      case when j.body ~ '##[ \t]+##' then 'double_heading_marker' end,
      case when abs((select count(*) from regexp_matches(j.body, E'(^|\n)- ', 'g')) - (select count(*) from regexp_matches(j.zbody, E'(^|\n)- ', 'g'))) > 4 then 'bullet_count' end,
      case when abs((select count(*) from regexp_matches(j.body, E'(^|\n)\\*\\*', 'g')) - (select count(*) from regexp_matches(j.zbody, E'(^|\n)\\*\\*', 'g'))) > 3 then 'faq_count' end,
      case when length(j.body)::numeric / nullif(length(j.zbody), 0) < cfg.lo then 'too_short' end,
      case when length(j.body)::numeric / nullif(length(j.zbody), 0) > cfg.hi then 'too_long' end,
      case when length(j.title) < (case when cfg.cjk then 4 else 8 end) or length(j.title) > (case when cfg.cjk then 60 else 130 end) then 'title_length' end,
      case when j.title = j.ztitle then 'title_unchanged' end,
      case when length(j.excerpt) < (case when cfg.cjk then 20 else 40 end) or length(j.excerpt) > (case when cfg.cjk then 220 else 340 end) then 'excerpt_length' end,
      case when j.excerpt ~ '[*#`]|\[|\n' then 'excerpt_markdown' end,
      case when j.body ~* '(here is the translation|translation:|translator|翻译|译文|todo|lorem ipsum|as an ai|i cannot|\[object|undefined|nan[^a-z])' then 'junk_text' end,
      case when j.body ~ '[^\n]{1500,}' and j.body !~ E'\n' then 'single_line_body' end
    ], null) as problems) pr
$$;
