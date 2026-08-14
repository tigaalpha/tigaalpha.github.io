-- Attendance confirmation reminders: 24h before each student's ("น้อง")
-- weekly recurring lesson slot, an automatic LINE message asks them to
-- confirm they're coming. One row per weekly time slot -- a student with
-- 2 lessons/week (the app's standard lesson format) gets 2 rows.
create table attendance_reminder_schedules (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  time_of_day time not null,
  active boolean not null default true,
  next_occurrence_at timestamptz not null,
  last_reminded_occurrence timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index attendance_reminder_schedules_due_idx on attendance_reminder_schedules (next_occurrence_at) where active;

create trigger attendance_reminder_schedules_set_updated_at
  before update on attendance_reminder_schedules
  for each row execute function set_updated_at();

alter table attendance_reminder_schedules enable row level security;

create policy "attendance_reminder_schedules: staff manage" on attendance_reminder_schedules for all
  using (is_staff()) with check (is_staff());

-- 30 min granularity is plenty for a "24h before" reminder window (unlike
-- trial-offer-nudge's tight ~1h window) -- see attendance-reminder edge fn.
select cron.schedule(
  'attendance-reminder',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/attendance-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
