-- PromptPay direct bank-transfer payments — same model as the TiGA Piano
-- consumer app: an EMVCo QR payload is generated against the studio's own
-- PromptPay ID (mobile number or national/tax ID) and the money lands
-- straight in the owner's bank account. No gateway, no fees.
--
-- Flow:
--   1. The AI (or a staff member) creates a payment via the
--      create_payment_link tool / create-payment edge function — the QR is
--      stored here (base64 for the web UI, qr_url when a public storage
--      upload succeeded) alongside the raw payload + reference code the
--      customer quotes in their bank transfer.
--   2. The customer pays by scanning the QR (or typing the PromptPay
--      number + amount + reference into their banking app).
--   3. The OWNER confirms the transfer arrived in their bank app via the
--      mark_payment_paid tool / verify-payment edge function — that
--      records the income transaction, moves the customer to won/renewed,
--      and notifies them on LINE. Money-adjacent writes are owner/admin
--      only (same RLS shape as transactions).

create table payments (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  course_id uuid references courses (id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  promptpay_target text not null,        -- the configured PromptPay number/ID
  promptpay_payload text not null,       -- full EMVCo payload (for re-rendering the QR)
  qr_base64 text,                        -- QR PNG data URL (web UI)
  qr_url text,                           -- public image URL (LINE push), when upload succeeded
  reference_code text not null unique,   -- quoted by the customer in their transfer
  note text,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  confirmed_by uuid references profiles (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_customer_idx on payments (customer_id);
create index payments_status_idx on payments (status);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();

alter table payments enable row level security;

-- Readable by all staff; writes (especially status → paid) happen through
-- the owner/admin-gated edge functions using the service-role client.
create policy "payments: staff read" on payments for select using (is_staff());
create policy "payments: owner manages" on payments for all using (is_owner_or_admin()) with check (is_owner_or_admin());

alter type notification_type add value if not exists 'payment_received';
