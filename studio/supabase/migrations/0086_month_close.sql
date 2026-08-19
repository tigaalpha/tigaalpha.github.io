-- 0086: AI Financial Controller (งาน #3) — ปิดเดือนอัตโนมัติ
-- month-close ฟังก์ชันรวม transactions/ใบเสร็จ/เงินเดือนครู/VAT/ค้างชำระ
-- เป็น checklist เดียว บันทึกผลรายเดือนไว้ใน month_closings (สำหรับหน้า
-- ประวัติการปิดเดือน) และส่งสรุปทาง LINE ให้เจ้าของวันที่ 1 ของเดือน

create table if not exists month_closings (
  id uuid primary key default uuid_generate_v4(),
  month text not null unique,           -- YYYY-MM
  income numeric(12,2) not null default 0,
  expense numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  receipts_count int not null default 0,
  payroll_gross numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  pending_payments int not null default 0,
  warnings text[] not null default '{}',
  closed_at timestamptz not null default now()
);

alter table month_closings enable row level security;
create policy "month_closings: owner manages" on month_closings for all
  using (is_owner_or_admin()) with check (is_owner_or_admin());

-- ปิดเดือนอัตโนมัติ วันที่ 1 ทุกเดือน 08:30 BKK (01:30 UTC)
select cron.schedule(
  'month-close-daily',
  '30 1 1 * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/month-close',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
