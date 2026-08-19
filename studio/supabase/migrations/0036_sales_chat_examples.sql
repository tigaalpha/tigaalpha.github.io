-- Owner uploads screenshots of past customer chats that closed well; Gemini
-- vision extracts each into structured turns here for review before they
-- ever touch the live sales prompt or the knowledge base (see
-- extract-chat-screenshot / analyze-sales-style edge functions).

create table sales_chat_examples (
  id uuid primary key default uuid_generate_v4(),
  extracted_turns jsonb not null default '[]'::jsonb, -- [{ "speaker": "customer"|"owner", "text": "..." }]
  confirmed boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sales_chat_examples_confirmed_idx on sales_chat_examples (confirmed);

alter table sales_chat_examples enable row level security;

create policy "sales_chat_examples: staff read" on sales_chat_examples for select using (is_staff());
create policy "sales_chat_examples: staff write" on sales_chat_examples for all using (is_staff()) with check (is_staff());
