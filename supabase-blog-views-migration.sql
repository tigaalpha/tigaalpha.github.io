-- Blog reader counts (owner, 2026-11-07): how many people read each article, shown on the article page and in the admin analytics.
-- WRITTEN, NOT APPLIED: the owner runs it (or approves it) in the Supabase SQL editor. Additive and re-runnable; nothing existing is changed.
-- Until it is applied every client call below fails soft: the article page simply shows no number and the admin card says the migration is missing.
--
-- What is counted, and how:
--   kind 'view'  = the article page was opened          (one row per device per article per day)
--   kind 'read'  = the reader stayed 30 seconds          (one row per device per article per day)
--   kind 'gate'  = the log-in pop-up was shown
--   kind 'click' = the reader tapped Google / sign up / log in in it
-- A device is a random id the page makes for itself (localStorage `tg_blog_vid`), never an account, an IP or a name. The primary key makes every counter
-- idempotent: a reload, or a spoofed repeat of the same device on the same day, adds nothing. The public number is therefore "device-days", honestly a
-- little higher than unique readers and lower than raw page loads. Someone who deliberately invents new ids can still inflate it: the functions refuse
-- unknown articles and malformed ids, but no anonymous endpoint can stop a determined script, so it is a vanity counter and nothing may pay for it.

create table if not exists public.blog_hits (
  lang  text not null check (lang in ('th','en','zh')),
  slug  text not null check (char_length(slug) between 1 and 200),
  vid   text not null check (vid ~ '^[A-Za-z0-9_-]{8,64}$'),
  day   date not null default ((now() at time zone 'Asia/Bangkok')::date),
  kind  text not null check (kind in ('view','read','gate','click')),
  created_at timestamptz not null default now(),
  primary key (lang, slug, vid, day, kind)
);
create index if not exists blog_hits_day_idx  on public.blog_hits (day, kind);
create index if not exists blog_hits_slug_idx on public.blog_hits (lang, slug, day);
alter table public.blog_hits enable row level security;       -- no policy on purpose: only the functions below read or write it

-- the all-time number shown on the page, kept as one row per article so a page load never has to count thousands of rows
create table if not exists public.blog_view_totals (
  lang  text not null check (lang in ('th','en','zh')),
  slug  text not null,
  views bigint not null default 0,
  primary key (lang, slug)
);
alter table public.blog_view_totals enable row level security;

-- A daily budget of NEW rows (review 2026-11-07): the anon key is public, so without a ceiling a loop of invented device ids could fill the database, and a full project goes read-only for
-- everything (profiles, payments), not only the blog. 16 shards (by hash of the device id) keep concurrent writers off one hot row; 16 x 12,500 = 200,000 new rows a day, far above any
-- real day of reading. Past it blog_hit refuses (-3) and the page shows no new number. Raise the figure in blog_hit if the blog ever really grows past it.
create table if not exists public.blog_day_budget (
  day  date not null,
  slot smallint not null,
  n    int not null default 0,
  primary key (day, slot)
);
alter table public.blog_day_budget enable row level security;

-- the tables are reached only through the functions below: take every direct grant away (RLS has no policy, this also closes TRUNCATE)
revoke all on public.blog_hits, public.blog_view_totals, public.blog_day_budget from anon, authenticated;

-- Count one event and return the article's all-time view number; -1 = refused (unknown or unpublished article, bad id, bad kind), -3 = today's row budget is spent.
create or replace function public.blog_hit(p_lang text, p_slug text, p_vid text, p_kind text default 'view')
returns bigint
language plpgsql security definer set search_path = '' as $$
declare n bigint; added int; spent int; today date := ((now() at time zone 'Asia/Bangkok')::date);
begin
  if p_lang is null or p_lang not in ('th','en','zh') then return -1; end if;
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

-- The view number of every article of one language, for the article lists.
create or replace function public.blog_view_counts(p_lang text)
returns table (slug text, views bigint)
language sql stable security definer set search_path = '' as $$
  select v.slug, v.views from public.blog_view_totals v
   where v.lang = p_lang and p_lang in ('th','en','zh')
     and exists (select 1 from public.blog_posts b where b.lang = v.lang and b.slug = v.slug and b.published);   -- a take-down article's slug and number are not listed
$$;
revoke all on function public.blog_view_counts(text) from public;
grant execute on function public.blog_view_counts(text) to anon, authenticated;

-- The admin analytics: totals, per article and per day for the last p_days days (null or 0 = all time). Top admin only.
create or replace function public.blog_stats(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since date; res jsonb;
begin
  if not public.is_top_admin() then raise exception 'not allowed'; end if;
  since := case when coalesce(p_days, 0) <= 0 then date '2000-01-01' else ((now() at time zone 'Asia/Bangkok')::date - (p_days - 1)) end;
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'views',   count(*) filter (where kind = 'view'),
        'readers', count(*) filter (where kind = 'read'),
        'gates',   count(*) filter (where kind = 'gate'),
        'clicks',  count(*) filter (where kind = 'click'),
        'devices', count(distinct vid) filter (where kind = 'view'))
      from public.blog_hits where day >= since),
    'rows', coalesce((select jsonb_agg(r order by r.views desc, r.total desc) from (
        select h.lang, h.slug, coalesce(max(b.title), h.slug) as title,
               count(*) filter (where h.kind = 'view')  as views,
               count(*) filter (where h.kind = 'read')  as readers,
               count(*) filter (where h.kind = 'gate')  as gates,
               count(*) filter (where h.kind = 'click') as clicks,
               coalesce(max(t.views), 0) as total
          from public.blog_hits h
          left join public.blog_posts b on b.lang = h.lang and b.slug = h.slug
          left join public.blog_view_totals t on t.lang = h.lang and t.slug = h.slug
         where h.day >= since group by h.lang, h.slug) r), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(d order by d.day) from (
        select day, count(*) filter (where kind = 'view') as views, count(*) filter (where kind = 'read') as readers
          from public.blog_hits where day >= since group by day) d), '[]'::jsonb),
    'allTime', coalesce((select sum(views) from public.blog_view_totals), 0)
  ) into res;
  return res;
end $$;
revoke all on function public.blog_stats(int) from public, anon;
grant execute on function public.blog_stats(int) to authenticated;

-- Retention: the per-day rows older than p_keep_days are deleted (the all-time view number lives in blog_view_totals and is NOT touched), so "all" in the admin card means "all that is kept".
-- Nothing calls this by itself. To run it every night turn on pg_cron (Supabase: Database > Extensions) and uncomment the schedule below; that is the owner's decision, so it stays commented.
create or replace function public.blog_purge(p_keep_days int default 120)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  delete from public.blog_hits where day < ((now() at time zone 'Asia/Bangkok')::date - greatest(coalesce(p_keep_days, 120), 7));
  get diagnostics n = row_count;
  delete from public.blog_day_budget where day < ((now() at time zone 'Asia/Bangkok')::date - 7);
  return n;
end $$;
revoke all on function public.blog_purge(int) from public, anon, authenticated;
-- select cron.schedule('blog-purge', '17 20 * * *', $$select public.blog_purge(120)$$);   -- 03:17 Bangkok, every night

-- Verification (read-only, run after applying):
--   select public.blog_view_counts('th');                       -- empty list at first, no error
--   select public.blog_hit('th', '<a real published slug>', 'abcdefgh12345678', 'view');   -- 1, and 1 again on a repeat
--   select public.blog_hit('th', 'no-such-article', 'abcdefgh12345678', 'view');           -- -1
--   (-3 means the day's row budget of 200,000 new rows is spent)
