-- supabase-blog-price-guard.sql
--
-- APPLIED on 2026-11-17 with the owner's approval ("fix the 799 THB template of the external article-writing system, otherwise new articles come back with the old price").
--
-- The system that writes the daily articles (about 100 a day, author = one admin account, covers uploaded to the blog-images bucket) is NOT reachable from this repo, from
-- the scheduled tasks of this account, from Supabase cron or from an edge function, so its template cannot be edited from here. Its promo paragraph still says
-- "... then 799 THB/month" (zh: "每月799泰铢"). This file makes the DATABASE correct whatever that system writes: a BEFORE INSERT / UPDATE trigger on blog_posts rewrites the
-- old baht price in the body of every article outside Thai:
--     799 THB, 799 THB (no-break space), THB 799, ฿799, 799 baht, 799タイバーツ, 799バーツ, 799바트   ->  US$24.99      (en ja ko ru hi es fr ar de)
--     799泰铢, 799 泰铢, 799 THB                                                                      ->  ¥176         (zh)
-- Thai (th) is never touched: Thai readers pay 799 baht. A number that merely contains 799 (1799, 2799 THB, 7990) is left alone.
-- The pure function blog_fix_price_text(lang, body) is what the trigger calls, so it can be tested with plain SELECTs (12 cases were run on 2026-11-17, all as expected).
-- The article CONTENT claim "lessons in Thai, English and Mandarin" in that template is stale too (the app speaks ten languages): the corrected promo texts are in
-- docs/blog-promo-template.md for whoever maintains the external system.
--
-- Undo: drop trigger blog_posts_normalize_price on public.blog_posts; drop function public.blog_normalize_price(); drop function public.blog_fix_price_text(text, text);

create or replace function public.blog_fix_price_text(p_lang text, p_body text) returns text
language plpgsql immutable as $$
declare b text := p_body; nb text := chr(160);
begin
  if b is null or p_lang is not distinct from 'th' then return b; end if;
  if p_lang = 'zh' then
    b := regexp_replace(b, '(^|[^0-9])799 ?泰铢', '\1¥176', 'g');
    b := regexp_replace(b, '(^|[^0-9])799[ ' || nb || ']?THB', '\1¥176', 'g');
  else
    b := regexp_replace(b, '(^|[^0-9])799[ ' || nb || ']?THB', '\1US$24.99', 'g');
    b := regexp_replace(b, '(^|[^0-9])THB[ ' || nb || ']?799(?![0-9])', '\1US$24.99', 'g');
    b := regexp_replace(b, '(^|[^0-9])฿[ ' || nb || ']?799(?![0-9])', '\1US$24.99', 'g');
    b := regexp_replace(b, '(^|[^0-9])799(?![0-9])[ ' || nb || ']?(baht|Baht|BAHT)', '\1US$24.99', 'g');
    b := regexp_replace(b, '(^|[^0-9])799タイバーツ', '\1US$24.99', 'g');
    b := regexp_replace(b, '(^|[^0-9])799バーツ', '\1US$24.99', 'g');
    b := regexp_replace(b, '(^|[^0-9])799바트', '\1US$24.99', 'g');
  end if;
  return b;
end $$;

create or replace function public.blog_normalize_price() returns trigger
language plpgsql as $$
begin
  new.body := public.blog_fix_price_text(new.lang, new.body);
  return new;
end $$;

create or replace trigger blog_posts_normalize_price
  before insert or update of body, lang on public.blog_posts
  for each row execute function public.blog_normalize_price();
