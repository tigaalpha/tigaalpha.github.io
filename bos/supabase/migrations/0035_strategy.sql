-- AI Strategy Room: staff ask a business-strategy question once, several
-- frontier AI providers (Gemini + whichever of Claude/GPT/Grok/DeepSeek/
-- Kimi/GLM have keys configured) answer side-by-side in the same turn, and
-- every session/message persists so past brainstorms stay browsable.

create table strategy_sessions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index strategy_sessions_created_at_idx on strategy_sessions (created_at desc);

create trigger strategy_sessions_set_updated_at
  before update on strategy_sessions
  for each row execute function set_updated_at();

create table strategy_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references strategy_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  model text, -- null for role='user'; e.g. 'gemini' | 'claude' | 'gpt' | 'grok' | 'deepseek' | 'kimi' | 'glm'
  content text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index strategy_messages_session_idx on strategy_messages (session_id, created_at);
create index strategy_messages_pinned_idx on strategy_messages (pinned) where pinned;

alter table strategy_sessions enable row level security;
alter table strategy_messages enable row level security;

create policy "strategy_sessions: staff read" on strategy_sessions for select using (is_staff());
create policy "strategy_sessions: staff write" on strategy_sessions for all using (is_staff()) with check (is_staff());

create policy "strategy_messages: staff read" on strategy_messages for select using (is_staff());
create policy "strategy_messages: staff write" on strategy_messages for all using (is_staff()) with check (is_staff());
