-- Backs the in-app "Integrations" settings UI. Lets the owner connect
-- Google Calendar by clicking a button (OAuth flow) instead of manually
-- obtaining a refresh token via curl/Postman, which was the only path
-- before this. Values here are read by Edge Functions via the service-role
-- client (bypasses RLS); RLS below only governs direct browser access,
-- and is intentionally owner/admin-only since a refresh token here is as
-- sensitive as the Google Calendar itself.

create table integration_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table integration_settings enable row level security;
create policy "integration_settings: owner manages" on integration_settings for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());

create trigger integration_settings_set_updated_at
  before update on integration_settings
  for each row execute function set_updated_at();
