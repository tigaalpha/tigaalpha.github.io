-- supabase-blog-price-usd-migration.sql
--
-- WRITTEN, NOT APPLIED. AGENTS.md hard rule: SQL against the live database is run only with the owner's explicit approval for THIS file.
--
-- Why (owner, 2026-11-17: "the new price is US$24.99"): almost every published article (2,499 of the 2,508 rows outside Thai) ends with the same
-- call-to-action paragraph that quotes the old baht price — "... then 799 THB/month" in English, Hindi, Spanish, French, Arabic and Russian,
-- "月額799タイバーツ" in Japanese, "월 799바트예요" in Korean, "每月799泰铢" in Chinese. The app charges US dollars to English and every extra
-- language and yuan to Chinese (payment.tsx currencyOf), so an English reader was promised 799 baht and then asked for US$24.99. Thai keeps ฿799
-- and is NOT touched. Read-only counts taken on 2026-11-17 (rows with the old price): ar 11, en 511, es 11, fr 11, hi 11, ja 211, ko 211, ru 211,
-- zh 1311; no title or excerpt carries the price; a handful of zh rows mention "1799" as a YEAR, which none of the patterns below can match.
--
-- What it does, in ONE transaction:
--   1. copies the affected rows' bodies into public.blog_posts_backup_price_usd (RLS on, no policy: nobody reads it through the API);
--   2. replaces the baht price in the BODY only: "799 THB" (a space or a no-break space between) -> "US$24.99" for en ja ko ru hi es fr ar,
--      "799タイバーツ" -> "US$24.99" (ja), "799바트" -> "US$24.99" (ko), "799 泰铢" / "799泰铢" -> "¥176" (zh);
--   3. reads back inside the same transaction and raises (so nothing is committed) if a row outside Thai still quotes the baht price.
-- Idempotent: a second run finds nothing to replace (the backup insert skips rows already saved, every UPDATE has a matching WHERE).
-- The article-writing automation that adds new articles every day must be told the same price, or its template (which quotes "799 THB/month")
-- puts the old number back into every new article.
--
-- To undo: update public.blog_posts p set body = b.body from public.blog_posts_backup_price_usd b where b.id = p.id;

begin;

create table if not exists public.blog_posts_backup_price_usd (
  id uuid primary key,
  lang text not null,
  slug text not null,
  body text not null,
  backed_up_at timestamptz not null default now()
);
alter table public.blog_posts_backup_price_usd enable row level security;

insert into public.blog_posts_backup_price_usd (id, lang, slug, body)
select id, lang, slug, body
  from public.blog_posts
 where lang <> 'th'
   and (body ~ ('799[ ' || chr(160) || ']?THB') or body like '%799タイバーツ%' or body like '%799바트%' or body ~ '799 ?泰铢')
on conflict (id) do nothing;

update public.blog_posts
   set body = regexp_replace(body, '799[ ' || chr(160) || ']?THB', 'US$24.99', 'g')
 where lang in ('en', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar')
   and body ~ ('799[ ' || chr(160) || ']?THB');

update public.blog_posts set body = replace(body, '799タイバーツ', 'US$24.99') where lang = 'ja' and body like '%799タイバーツ%';
update public.blog_posts set body = replace(body, '799바트', 'US$24.99') where lang = 'ko' and body like '%799바트%';
update public.blog_posts set body = regexp_replace(body, '799 ?泰铢', '¥176', 'g') where lang = 'zh' and body ~ '799 ?泰铢';

do $$
declare n integer;
begin
  select count(*) into n
    from public.blog_posts
   where lang <> 'th'
     and (body ~ ('799[ ' || chr(160) || ']?THB') or body like '%799タイバーツ%' or body like '%799바트%' or body ~ '799 ?泰铢');
  if n <> 0 then
    raise exception 'blog price migration: % article(s) outside Thai still quote the baht price', n;
  end if;
end $$;

commit;
