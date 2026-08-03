-- Multiple Google Calendar accounts connected purely for *viewing* on the
-- Calendar page (up to 3, filterable) — separate from the existing single
-- Google Calendar connection in integration_settings, which stays as the
-- one booking-sync target (createEvent/updateEvent for lessons). Mixing
-- the two would mean picking one of N connections as "the" booking
-- calendar, which isn't what was asked for and risks the working sync.

create table google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  google_account_email text,
  calendar_id text not null default 'primary',
  refresh_token text not null,
  color text not null default '#7C3AED',
  connected_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null
);

alter table google_calendar_connections enable row level security;

-- Same tier as integration_settings — owner/admin only. The frontend must
-- never select refresh_token; repository methods restrict the column list.
create policy "google_calendar_connections: owner reads" on google_calendar_connections for select using (is_owner_or_admin());
create policy "google_calendar_connections: owner writes" on google_calendar_connections for all using (is_owner_or_admin()) with check (is_owner_or_admin());
