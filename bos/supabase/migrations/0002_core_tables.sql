-- Core identity, teachers, customers (CRM), courses/hour tracking

create type user_role as enum ('owner', 'admin', 'teacher', 'staff');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role user_role not null default 'staff',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table teachers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  bio text,
  specialties text[] not null default '{}',
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create type sales_status as enum (
  'new_lead', 'contacted', 'qualified', 'interested', 'trial_booked',
  'trial_completed', 'negotiating', 'waiting_decision', 'won', 'lost',
  'renew_pending', 'renewed'
);

create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  line_user_id text unique,
  age int,
  learning_goal text,
  budget text,
  experience_level text,
  preferred_teacher_id uuid references teachers (id) on delete set null,
  preferred_schedule text,
  parent_name text,
  parent_phone text,
  sales_status sales_status not null default 'new_lead',
  lead_source text,
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_sales_status_idx on customers (sales_status);
create index customers_line_user_id_idx on customers (line_user_id);

create table sales_status_history (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  from_status sales_status,
  to_status sales_status not null,
  note text,
  changed_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sales_status_history_customer_idx on sales_status_history (customer_id);

-- Supported course lengths per PRD: 20 / 40 / 80 hours
create table courses (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  teacher_id uuid references teachers (id) on delete set null,
  total_hours smallint not null check (total_hours in (20, 40, 80)),
  current_hour smallint not null default 0 check (current_hour >= 0),
  remaining_hour smallint not null,
  price numeric(10, 2),
  started_at timestamptz not null default now(),
  renewed_from_course_id uuid references courses (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint courses_hours_consistent check (current_hour + remaining_hour = total_hours)
);

create index courses_customer_idx on courses (customer_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();
