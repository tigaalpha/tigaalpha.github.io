-- Social media account credentials for multi-channel posting
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'tiktok', 'youtube', 'line')),
  account_name text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamp,
  metadata jsonb default '{}'::jsonb,
  connected_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique(user_id, platform, account_name)
);

-- Social media posting history
create table social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  platforms text[] not null,
  posted_at timestamp default now(),
  status text default 'queued' check (status in ('queued', 'posting', 'success', 'failed')),
  error_message text,
  external_ids jsonb default '{}'::jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

alter table social_accounts enable row level security;
alter table social_posts enable row level security;

create policy "social_accounts: users manage their own" on social_accounts
  for all using (auth.uid() = user_id);

create policy "social_posts: users manage their own" on social_posts
  for all using (auth.uid() = user_id);

create trigger social_accounts_set_updated_at
  before update on social_accounts
  for each row
  execute function set_updated_at();

create trigger social_posts_set_updated_at
  before update on social_posts
  for each row
  execute function set_updated_at();
