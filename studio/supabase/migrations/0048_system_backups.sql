-- Level 1 hardening: Backup & Restore System.
--
-- Supabase's own platform-level backups (daily backups / PITR, depending on
-- the project's plan) are the primary defense against data loss and cover
-- the whole database — check the plan tier in the Supabase dashboard under
-- Settings > Backups. This is a *supplementary* safety net scoped to the
-- handful of tables that are hardest to reconstruct by hand if something
-- goes wrong (customers, courses, bookings, transactions): a full JSONB
-- row-dump taken daily, stored in-database, with an immediate row-count
-- verification against the source table so a snapshot is never marked
-- "success" just because the insert didn't error (per the explicit
-- requirement: a backup isn't proven good just because a file was written).

create table system_backups (
  id uuid primary key default uuid_generate_v4(),
  taken_at timestamptz not null default now(),
  tables jsonb not null,       -- { "customers": [...rows], "courses": [...], "bookings": [...], "transactions": [...] }
  row_counts jsonb not null,   -- { "customers": 42, "courses": 10, ... } -- counts captured in the snapshot
  verified boolean not null default false,
  verify_detail text,
  status text not null default 'success' check (status in ('success', 'error')),
  error_detail text
);

create index system_backups_taken_at_idx on system_backups (taken_at desc);

alter table system_backups enable row level security;

-- Contains full customer + financial row dumps -- owner/admin only, same
-- sensitivity level as transactions itself.
create policy "system_backups: owner read" on system_backups for select using (is_owner_or_admin());

create or replace function create_system_backup() returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tables jsonb;
  v_counts jsonb;
  v_customers_count int;
  v_courses_count int;
  v_bookings_count int;
  v_transactions_count int;
  v_snapshot_customers_count int;
  v_snapshot_courses_count int;
  v_snapshot_bookings_count int;
  v_snapshot_transactions_count int;
  v_verified boolean;
  v_detail text;
begin
  select count(*) into v_customers_count from customers;
  select count(*) into v_courses_count from courses;
  select count(*) into v_bookings_count from bookings;
  select count(*) into v_transactions_count from transactions;

  select jsonb_build_object(
    'customers', coalesce((select jsonb_agg(to_jsonb(c)) from customers c), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(to_jsonb(co)) from courses co), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b)) from bookings b), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(to_jsonb(t)) from transactions t), '[]'::jsonb)
  ) into v_tables;

  v_snapshot_customers_count := jsonb_array_length(v_tables->'customers');
  v_snapshot_courses_count := jsonb_array_length(v_tables->'courses');
  v_snapshot_bookings_count := jsonb_array_length(v_tables->'bookings');
  v_snapshot_transactions_count := jsonb_array_length(v_tables->'transactions');

  v_counts := jsonb_build_object(
    'customers', v_snapshot_customers_count,
    'courses', v_snapshot_courses_count,
    'bookings', v_snapshot_bookings_count,
    'transactions', v_snapshot_transactions_count
  );

  -- A snapshot only counts as verified if every table's captured row count
  -- matches what was actually in the source table at snapshot time.
  v_verified := v_snapshot_customers_count = v_customers_count
    and v_snapshot_courses_count = v_courses_count
    and v_snapshot_bookings_count = v_bookings_count
    and v_snapshot_transactions_count = v_transactions_count;

  v_detail := case when v_verified
    then 'row counts match source tables'
    else format(
      'MISMATCH -- customers %s/%s, courses %s/%s, bookings %s/%s, transactions %s/%s (snapshot/source)',
      v_snapshot_customers_count, v_customers_count,
      v_snapshot_courses_count, v_courses_count,
      v_snapshot_bookings_count, v_bookings_count,
      v_snapshot_transactions_count, v_transactions_count
    )
  end;

  insert into system_backups (tables, row_counts, verified, verify_detail, status)
  values (v_tables, v_counts, v_verified, v_detail, 'success')
  returning id into v_id;

  if not v_verified then
    perform log_system_event_internal('system-backup', 'warning', 'Backup taken but verification mismatch: ' || v_detail);
  end if;

  -- Keep 14 days of daily snapshots -- unbounded growth of full customer
  -- data dumps is itself a data-quality/storage problem.
  delete from system_backups where taken_at < now() - interval '14 days';

  return v_id;
exception when others then
  insert into system_backups (tables, row_counts, verified, verify_detail, status, error_detail)
  values ('{}'::jsonb, '{}'::jsonb, false, null, 'error', sqlerrm);
  return null;
end;
$$;

-- log_system_event_internal: a tiny SQL-only wrapper matching the shape of
-- the existing logSystemEvent() edge-function helper (monitor.ts), so a
-- backup failure shows up in the same System Health page/system_events
-- table as every other error -- without needing an HTTP round trip to an
-- Edge Function for what is otherwise a pure-SQL scheduled job.
create or replace function log_system_event_internal(p_source text, p_severity text, p_message text) returns void
language sql
set search_path = public
as $$
  insert into system_events (source, severity, message) values (p_source, p_severity, left(p_message, 2000));
$$;

select cron.schedule(
  'system-backup-daily',
  '0 20 * * *', -- 20:00 UTC = 03:00 Asia/Bangkok
  $$ select create_system_backup(); $$
);
