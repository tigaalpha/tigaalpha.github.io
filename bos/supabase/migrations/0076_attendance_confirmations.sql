-- Attendance confirmations: the 24h-before LINE reminder (attendance-reminder)
-- asks the student to confirm they're coming; the answer is recorded here by
-- the AI (record_attendance_confirmation tool) and mirrored onto the Google
-- Calendar event (see calendar.ts updateAttendanceInCalendar) so the owner
-- sees confirmed/declined at a glance in the calendar.
--
-- Two surfaces are covered:
--   * bookings           — one-off lessons (incl. every lesson the AI books)
--   * attendance_reminder_schedules — weekly recurring slots (the "น้อง" rows)

alter table bookings add column attendance_status text not null default 'unconfirmed'
  check (attendance_status in ('unconfirmed','confirmed','declined'));
alter table bookings add column attendance_confirmed_at timestamptz;
-- set once the 24h reminder has been pushed, so the 30-min cron tick
-- doesn't re-ask for the same lesson in the same window
alter table bookings add column attendance_reminded_at timestamptz;

alter table attendance_reminder_schedules add column attendance_status text not null default 'unconfirmed'
  check (attendance_status in ('unconfirmed','confirmed','declined'));
alter table attendance_reminder_schedules add column attendance_confirmed_at timestamptz;

alter type notification_type add value if not exists 'attendance_declined';
