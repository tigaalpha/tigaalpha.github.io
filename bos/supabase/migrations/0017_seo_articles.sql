-- SEO/AEO content writer: AI generates ready-to-publish articles grounded in
-- the real knowledge base, staff review/edit here, then copy into the
-- public marketing site (this app doesn't manage that site directly).

create type article_status as enum ('draft', 'published');

create table articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null,
  target_keyword text not null,
  meta_description text not null,
  content text not null, -- markdown body
  faq jsonb not null default '[]'::jsonb, -- [{ "question": "...", "answer": "..." }]
  internal_link_ideas text[] not null default '{}',
  language text not null default 'th',
  status article_status not null default 'draft',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_status_idx on articles (status);
create index articles_created_at_idx on articles (created_at desc);

create trigger articles_set_updated_at
  before update on articles
  for each row execute function set_updated_at();

alter table articles enable row level security;

create policy "articles: staff read" on articles for select using (is_staff());
create policy "articles: staff write" on articles for all using (is_staff()) with check (is_staff());
