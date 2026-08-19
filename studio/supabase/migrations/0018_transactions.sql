-- Accounting: a general ledger for the owner's own business finances
-- (rent, salaries, marketing spend, tuition income, etc.) — separate from
-- the CRM/sales pipeline revenue metric, which only tracks course pricing.

create type transaction_type as enum ('income', 'expense');

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  type transaction_type not null,
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  transaction_date date not null default current_date,
  payment_method text,
  customer_id uuid references customers (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_date_idx on transactions (transaction_date desc);
create index transactions_type_idx on transactions (type);

create trigger transactions_set_updated_at
  before update on transactions
  for each row execute function set_updated_at();

alter table transactions enable row level security;

-- Financial records are more sensitive than general staff data (customer
-- records, bookings) — restrict to owner/admin, same tier as profiles and
-- audit_log, not every staff member.
create policy "transactions: owner reads" on transactions for select using (is_owner_or_admin());
create policy "transactions: owner writes" on transactions for all using (is_owner_or_admin()) with check (is_owner_or_admin());
