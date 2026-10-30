-- Blog: articles in Thai / English / Mandarin. Everyone may read published posts; only the top admin (admin_tier >= 3, public.is_top_admin()) may write.
-- Additive and re-runnable.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('th','en','zh')),
  slug text not null,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  category text not null default 'tips' check (category in ('tips','theory','songs','news','story')),
  cover_url text,
  published boolean not null default false,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lang, slug)
);
create index if not exists blog_posts_lang_pub_idx on public.blog_posts (lang, published, created_at desc);
alter table public.blog_posts add column if not exists category text not null default 'tips';
alter table public.blog_posts enable row level security;
drop policy if exists blog_read_published on public.blog_posts;
create policy blog_read_published on public.blog_posts for select using (published or public.is_top_admin());
drop policy if exists blog_admin_insert on public.blog_posts;
create policy blog_admin_insert on public.blog_posts for insert with check (public.is_top_admin());
drop policy if exists blog_admin_update on public.blog_posts;
create policy blog_admin_update on public.blog_posts for update using (public.is_top_admin()) with check (public.is_top_admin());
drop policy if exists blog_admin_delete on public.blog_posts;
create policy blog_admin_delete on public.blog_posts for delete using (public.is_top_admin());

-- Images for articles: a public bucket (anyone can view), only the top admin can upload / change / delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists blog_images_read on storage.objects;
create policy blog_images_read on storage.objects for select using (bucket_id = 'blog-images');
drop policy if exists blog_images_admin_insert on storage.objects;
create policy blog_images_admin_insert on storage.objects for insert with check (bucket_id = 'blog-images' and public.is_top_admin());
drop policy if exists blog_images_admin_update on storage.objects;
create policy blog_images_admin_update on storage.objects for update using (bucket_id = 'blog-images' and public.is_top_admin());
drop policy if exists blog_images_admin_delete on storage.objects;
create policy blog_images_admin_delete on storage.objects for delete using (bucket_id = 'blog-images' and public.is_top_admin());
