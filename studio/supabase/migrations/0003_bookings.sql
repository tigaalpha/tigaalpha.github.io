-- Bookings synced to Google Calendar. Title format: "<hour><StudentName>", e.g. 1TONY..40TONY.
-- Color rule: normal lesson = yellow, final lesson (collect payment / renew) = green.

create type lesson_event_type as enum ('normal', 'final');
create type booking_status as enum ('pending', 'confirmed', 'rescheduled', 'cancelled', 'completed');

create table bookings (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  course_id uuid references courses (id) on delete set null,
  teacher_id uuid references teachers (id) on delete set null,
  google_event_id text,
  title text not null,
  lesson_type lesson_event_type not null default 'normal',
  status booking_status not null default 'pending',
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (end_time > start_time)
);

create index bookings_customer_idx on bookings (customer_id);
create index bookings_teacher_time_idx on bookings (teacher_id, start_time);
create index bookings_google_event_idx on bookings (google_event_id);

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- Prevent double-booking the same teacher for overlapping times.
create or replace function bookings_no_overlap() returns trigger as $$
begin
  if new.teacher_id is null or new.status = 'cancelled' then
    return new;
  end if;

  if exists (
    select 1 from bookings b
    where b.teacher_id = new.teacher_id
      and b.id <> new.id
      and b.status <> 'cancelled'
      and tstzrange(b.start_time, b.end_time) && tstzrange(new.start_time, new.end_time)
  ) then
    raise exception 'Booking conflict: teacher already has a lesson in this time range';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger bookings_check_overlap
  before insert or update on bookings
  for each row execute function bookings_no_overlap();
