-- Conversation memory for LINE / web chat, feeding the AI Receptionist / Sales Employee

create type conversation_channel as enum ('line', 'web', 'phone', 'walk_in');
create type message_sender as enum ('customer', 'ai', 'owner');

create table conversations (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers (id) on delete set null,
  channel conversation_channel not null,
  line_user_id text,
  summary text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_customer_idx on conversations (customer_id);
create index conversations_line_user_idx on conversations (line_user_id);
create index conversations_needs_review_idx on conversations (needs_review) where needs_review;

create trigger conversations_set_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender message_sender not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on messages (conversation_id, created_at);
