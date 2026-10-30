-- Blog: articles in Thai / English / Mandarin. Everyone may read published posts; only the top admin (admin_tier >= 3, public.is_top_admin()) may write.
-- Additive and re-runnable.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('th','en','zh')),
  slug text not null,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  cover_url text,
  published boolean not null default false,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lang, slug)
);
create index if not exists blog_posts_lang_pub_idx on public.blog_posts (lang, published, created_at desc);
alter table public.blog_posts enable row level security;
drop policy if exists blog_read_published on public.blog_posts;
create policy blog_read_published on public.blog_posts for select using (published or public.is_top_admin());
drop policy if exists blog_admin_insert on public.blog_posts;
create policy blog_admin_insert on public.blog_posts for insert with check (public.is_top_admin());
drop policy if exists blog_admin_update on public.blog_posts;
create policy blog_admin_update on public.blog_posts for update using (public.is_top_admin()) with check (public.is_top_admin());
drop policy if exists blog_admin_delete on public.blog_posts;
create policy blog_admin_delete on public.blog_posts for delete using (public.is_top_admin());
