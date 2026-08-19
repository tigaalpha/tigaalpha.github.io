-- Online Course Writer: builds lesson/module articles for an online piano
-- course. Unlike `articles` (marketing SEO content grounded in the
-- business's own Knowledge Base), this content is grounded in real web
-- research on piano technique/theory/pedagogy via Gemini's search-grounding
-- tool -- `sources` stores the citations returned from that research so the
-- owner can verify every claim.

create table course_articles (
  id uuid primary key default uuid_generate_v4(),
  module_title text not null,
  topic text not null,
  title text not null,
  summary text,
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  language text not null default 'th',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger course_articles_set_updated_at
  before update on course_articles
  for each row execute function set_updated_at();

alter table course_articles enable row level security;

create policy "course_articles: staff read" on course_articles for select using (is_staff());
create policy "course_articles: staff write" on course_articles for all using (is_staff()) with check (is_staff());
