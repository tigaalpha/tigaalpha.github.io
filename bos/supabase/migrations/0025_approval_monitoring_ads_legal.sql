-- Foundations for four capabilities: (9) human-in-the-loop approval for
-- high-risk AI actions, (10) system health monitoring/alerting, (5) paid ad
-- campaign drafting with a mandatory human approval gate before any money
-- moves, (12) AI-drafted legal document templates (contracts/consent forms).

-- ---------------------------------------------------------------------
-- (9) Approval workflow
-- ---------------------------------------------------------------------
create type approval_status as enum ('pending', 'approved', 'rejected');
create type approval_type as enum ('cancel_paid_lesson', 'ad_campaign_spend');

create table approval_requests (
  id uuid primary key default uuid_generate_v4(),
  type approval_type not null,
  payload jsonb not null,
  reason text,
  status approval_status not null default 'pending',
  requested_by text not null default 'ai',
  resolved_by uuid references profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index approval_requests_status_idx on approval_requests (status, created_at desc);

alter table approval_requests enable row level security;
create policy "approval_requests: staff read" on approval_requests for select using (is_staff());
create policy "approval_requests: staff write" on approval_requests for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------
-- (10) System health monitoring
-- ---------------------------------------------------------------------
create table system_events (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  severity text not null check (severity in ('info', 'warning', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);

create index system_events_created_idx on system_events (created_at desc);
create index system_events_severity_idx on system_events (severity, created_at desc);

alter table system_events enable row level security;
create policy "system_events: staff read" on system_events for select using (is_staff());

alter type notification_type add value if not exists 'system_alert';

-- ---------------------------------------------------------------------
-- (5) Ad campaign drafting — AI never spends money directly. A campaign
-- only reaches 'approved' via the approval_requests flow above, and even
-- then this app has no ad-platform API credentials connected, so approval
-- produces a ready-to-execute brief for staff to paste into Meta/Google
-- Ads Manager themselves, not an autonomous spend.
-- ---------------------------------------------------------------------
create type ad_campaign_status as enum ('draft', 'pending_approval', 'approved', 'rejected');

create table ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  platform text not null,
  objective text not null,
  target_audience text,
  budget_suggestion text,
  ad_copy text not null,
  creative_brief text,
  status ad_campaign_status not null default 'draft',
  created_by uuid references profiles (id) on delete set null,
  approved_by uuid references profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table ad_campaigns enable row level security;
create policy "ad_campaigns: staff read" on ad_campaigns for select using (is_staff());
create policy "ad_campaigns: staff write" on ad_campaigns for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------
-- (12) Legal document drafting — AI output only, never legally reviewed.
-- Every generated document and every UI surface showing one must carry a
-- visible disclaimer; enforced in the edge function and frontend, not here.
-- ---------------------------------------------------------------------
create type legal_document_type as enum ('enrollment_contract', 'parental_consent');

create table legal_documents (
  id uuid primary key default uuid_generate_v4(),
  type legal_document_type not null,
  customer_id uuid references customers (id) on delete set null,
  content text not null,
  variables jsonb not null default '{}',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index legal_documents_customer_idx on legal_documents (customer_id);

alter table legal_documents enable row level security;
create policy "legal_documents: staff read" on legal_documents for select using (is_staff());
create policy "legal_documents: staff write" on legal_documents for all using (is_staff()) with check (is_staff());
