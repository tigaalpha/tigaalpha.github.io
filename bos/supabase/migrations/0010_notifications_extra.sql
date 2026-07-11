-- Fills in the remaining PRD notification types that had no trigger yet:
-- new_customer (fires on insert) and lesson_today (a daily digest via pg_cron).
-- conflict_booking and payment_reminder are handled at the application layer
-- (supabase/functions/bookings, supabase/functions/_shared/tools.ts) since
-- they need context — the attempted time, the reason — that a bare row-level
-- trigger doesn't have.

create or replace function notify_new_customer() returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into notifications (type, title, body, customer_id)
  values ('new_customer', 'New customer', new.name || ' was added to the CRM.', new.id);
  return new;
end;
$$;

create trigger customers_notify_new
  after insert on customers
  for each row execute function notify_new_customer();

-- Daily digest: one lesson_today notification per booking happening today,
-- only inserted once (guarded by the "already notified today" check) so a
-- job re-run or a later manual trigger doesn't spam duplicates.
create or replace function notify_lessons_today() returns void
language plpgsql
set search_path = public
as $$
begin
  insert into notifications (type, title, body, customer_id, booking_id)
  select
    'lesson_today',
    'Lesson today: ' || b.title,
    'Scheduled ' || to_char(b.start_time, 'HH24:MI') || ' today.',
    b.customer_id,
    b.id
  from bookings b
  where b.status in ('pending', 'confirmed', 'rescheduled')
    and b.start_time >= date_trunc('day', now())
    and b.start_time < date_trunc('day', now()) + interval '1 day'
    and not exists (
      select 1 from notifications n
      where n.booking_id = b.id
        and n.type = 'lesson_today'
        and n.created_at >= date_trunc('day', now())
    );
end;
$$;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'notify-lessons-today',
  '0 0 * * *', -- 00:00 UTC = 07:00 Asia/Bangkok
  $$select notify_lessons_today()$$
);
