-- Level 2 receipts: the checklist assumed a receipt system already
-- existed ("ระบบ Receipt มีอยู่แล้ว") — it doesn't; nothing in this schema
-- ever created one. Built from scratch here, but scoped to what's real
-- right now: there's no payment gateway/webhook in this app (transactions
-- are recorded manually by staff in the Accounting UI), so "automatic
-- receipt generation after payment succeeds" is wired to the existing
-- transactions table instead of a payment webhook that doesn't exist --
-- every income transaction linked to a customer gets a receipt the moment
-- it's recorded. Drive upload + LINE delivery happen asynchronously via
-- receipt-drive-sync (0056), not in this trigger, since those are network
-- calls a DB trigger shouldn't block an insert on.

create sequence receipt_number_seq;
grant usage, select on sequence receipt_number_seq to authenticated;

create table receipts (
  id uuid primary key default uuid_generate_v4(),
  receipt_number text not null unique,
  transaction_id uuid not null references transactions (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  course_id uuid references courses (id) on delete set null,
  amount numeric(12, 2) not null,
  issued_at timestamptz not null default now(),
  drive_file_id text,
  drive_file_url text,
  sent_at timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index receipts_customer_idx on receipts (customer_id);
create index receipts_transaction_idx on receipts (transaction_id);
create index receipts_pending_drive_idx on receipts (created_at) where drive_file_id is null;

alter table receipts enable row level security;

-- Same tier as transactions -- a receipt is a financial record derived
-- directly from one.
create policy "receipts: owner manages" on receipts for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());

create trigger receipts_audit after insert or update or delete on receipts
  for each row execute function log_audit_event();

create or replace function next_receipt_number() returns text
language plpgsql
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_seq bigint := nextval('receipt_number_seq');
begin
  return 'RC-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

create or replace function trg_auto_create_receipt() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type = 'income' and new.customer_id is not null then
    insert into receipts (receipt_number, transaction_id, customer_id, amount, created_by)
    values (next_receipt_number(), new.id, new.customer_id, new.amount, new.created_by);
  end if;
  return new;
end;
$$;

create trigger auto_create_receipt after insert on transactions
  for each row execute function trg_auto_create_receipt();
