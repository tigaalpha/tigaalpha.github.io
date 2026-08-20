-- Voice Over History: permanent storage for generated voice-over scripts
-- Safe to re-run: uses if-not-exists.

create table if not exists voiceover_history (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  title      text not null default '',
  voice_name text not null default '',
  voice_lang text not null default 'th-TH',
  ai_model   text not null default 'gemini',
  created_at timestamptz not null default now()
);

create index if not exists voiceover_history_user_idx on voiceover_history (user_id, created_at desc);

alter table voiceover_history enable row level security;

-- Each user can only see and manage their own voice-over history
drop policy if exists "voiceover_history: self CRUD" on voiceover_history;
create policy "voiceover_history: self CRUD" on voiceover_history
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
