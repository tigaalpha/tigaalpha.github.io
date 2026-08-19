-- Competitor Analysis: AI-researched snapshot of the piano-school
-- competitive landscape -- direct competitors (piano schools/studios in
-- Thailand) and indirect competitors (global piano-learning apps), grounded
-- in real web research via Gemini's search-grounding tool (same mechanism
-- as course_articles). `competitors` and `strategies` are structured jsonb
-- so the frontend can render cards/lists without re-parsing markdown;
-- `sources` stores citations so the owner can verify every claim. Each run
-- is kept as its own row so the owner can browse how the landscape changes
-- over time, same pattern as course_articles.

create table competitor_analyses (
  id uuid primary key default uuid_generate_v4(),
  summary text not null,
  competitors jsonb not null default '[]'::jsonb,
  strategies jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table competitor_analyses enable row level security;

create policy "competitor_analyses: staff read" on competitor_analyses for select using (is_staff());
create policy "competitor_analyses: staff write" on competitor_analyses for all using (is_staff()) with check (is_staff());
