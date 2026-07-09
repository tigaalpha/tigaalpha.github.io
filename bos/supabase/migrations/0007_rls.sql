-- Row Level Security: every table is staff-only. All access goes through
-- authenticated internal users (owner/admin/teacher/staff); public/customer-facing
-- access happens exclusively through server-side edge functions using the
-- service role key, never directly from the browser.

alter table profiles enable row level security;
alter table teachers enable row level security;
alter table customers enable row level security;
alter table sales_status_history enable row level security;
alter table courses enable row level security;
alter table bookings enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;

create or replace function is_staff() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid());
$$ language sql stable security definer;

create or replace function is_owner_or_admin() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'admin'));
$$ language sql stable security definer;

create policy "profiles: self read" on profiles for select using (id = auth.uid());
create policy "profiles: owner manages" on profiles for all using (is_owner_or_admin()) with check (is_owner_or_admin());

create policy "teachers: staff read" on teachers for select using (is_staff());
create policy "teachers: owner manages" on teachers for all using (is_owner_or_admin()) with check (is_owner_or_admin());

create policy "customers: staff read" on customers for select using (is_staff());
create policy "customers: staff write" on customers for all using (is_staff()) with check (is_staff());

create policy "sales_status_history: staff read" on sales_status_history for select using (is_staff());
create policy "sales_status_history: staff insert" on sales_status_history for insert with check (is_staff());

create policy "courses: staff read" on courses for select using (is_staff());
create policy "courses: staff write" on courses for all using (is_staff()) with check (is_staff());

create policy "bookings: staff read" on bookings for select using (is_staff());
create policy "bookings: staff write" on bookings for all using (is_staff()) with check (is_staff());

create policy "conversations: staff read" on conversations for select using (is_staff());
create policy "conversations: staff write" on conversations for all using (is_staff()) with check (is_staff());

create policy "messages: staff read" on messages for select using (is_staff());
create policy "messages: staff write" on messages for all using (is_staff()) with check (is_staff());

create policy "knowledge_documents: staff read" on knowledge_documents for select using (is_staff());
create policy "knowledge_documents: staff write" on knowledge_documents for all using (is_staff()) with check (is_staff());

create policy "knowledge_chunks: staff read" on knowledge_chunks for select using (is_staff());
create policy "knowledge_chunks: staff write" on knowledge_chunks for all using (is_staff()) with check (is_staff());

create policy "notifications: staff read" on notifications for select using (is_staff());
create policy "notifications: staff write" on notifications for all using (is_staff()) with check (is_staff());

create policy "audit_log: owner read" on audit_log for select using (is_owner_or_admin());
create policy "audit_log: staff insert" on audit_log for insert with check (is_staff());
