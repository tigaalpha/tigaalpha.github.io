create type notification_type as enum (
  'lesson_today', 'conflict_booking', 'customer_near_end_course',
  'payment_reminder', 'ai_needs_review', 'new_customer'
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  type notification_type not null,
  title text not null,
  body text,
  customer_id uuid references customers (id) on delete cascade,
  booking_id uuid references bookings (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_read_idx on notifications (read) where not read;
create index notifications_customer_idx on notifications (customer_id);

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_actor_idx on audit_log (actor_id);
