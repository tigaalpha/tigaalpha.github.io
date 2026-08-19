-- A single current snapshot of owner-facing business health metrics (active
-- students, teaching load, CAC/LTV) shown on the Dashboard. These numbers
-- come from the owner's own periodic calculations, not derived from other
-- tables here, so they're stored as one editable row rather than computed.

create table business_snapshot (
  id uuid primary key default gen_random_uuid(),
  active_students integer,
  teaching_hours_per_week numeric(6, 1),
  avg_monthly_hours numeric(6, 1),
  sales_policy text,
  cac numeric(10, 2),
  ltv_min numeric(10, 2),
  ltv_max numeric(10, 2),
  note text,
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger business_snapshot_set_updated_at
  before update on business_snapshot
  for each row execute function set_updated_at();

alter table business_snapshot enable row level security;

-- Same sensitivity tier as transactions/audit_log — owner/admin only.
create policy "business_snapshot: owner reads" on business_snapshot for select using (is_owner_or_admin());
create policy "business_snapshot: owner writes" on business_snapshot for all using (is_owner_or_admin()) with check (is_owner_or_admin());
