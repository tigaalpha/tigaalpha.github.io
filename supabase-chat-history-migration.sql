-- TIGA CHAT history, synced to the account (owner, 2026-10-11).
-- WRITTEN, NOT APPLIED. Per AGENTS.md this runs only when the owner approves it, in the Supabase SQL editor.
-- Additive and re-runnable (if not exists / drop policy if exists). The app works without it:
-- chat history is kept on the device first, and sync quietly switches itself off while this table is missing.
--
-- One row per conversation; the messages ride along as a jsonb array (capped by the client at 80),
-- so there is one table, one policy set and one upsert. Every row belongs to exactly one user and can
-- only be read or changed by that user.

create table if not exists public.chat_threads (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default '',
  category    text not null default 'other',
  pinned      boolean not null default false,
  lang        text not null default 'en',
  msgs        jsonb not null default '[]'::jsonb,
  deleted     boolean not null default false,   -- a tombstone, so a delete on one device reaches the others
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chat_threads_category_ck check (category in ('theory','technique','ear','reading','songs','other')),
  constraint chat_threads_msgs_ck check (jsonb_typeof(msgs) = 'array' and jsonb_array_length(msgs) <= 120),
  constraint chat_threads_title_ck check (char_length(title) <= 200)
);

create index if not exists chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);

alter table public.chat_threads enable row level security;

drop policy if exists chat_threads_select_own on public.chat_threads;
create policy chat_threads_select_own on public.chat_threads for select using (user_id = auth.uid());

drop policy if exists chat_threads_insert_own on public.chat_threads;
create policy chat_threads_insert_own on public.chat_threads for insert with check (user_id = auth.uid());

drop policy if exists chat_threads_update_own on public.chat_threads;
create policy chat_threads_update_own on public.chat_threads for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists chat_threads_delete_own on public.chat_threads;
create policy chat_threads_delete_own on public.chat_threads for delete using (user_id = auth.uid());

-- the client never sets user_id or timestamps it does not own
revoke all on public.chat_threads from anon;
grant select, insert, update, delete on public.chat_threads to authenticated;

-- verification (read-only), run after the statements above:
--   select count(*) from public.chat_threads;                       -- 0 on a fresh table
--   select polname from pg_policy where polrelid = 'public.chat_threads'::regclass;   -- four chat_threads_* policies
