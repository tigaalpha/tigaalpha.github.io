-- Level 1 hardening: Data Quality & Integrity System.
--
-- Most structural integrity is already enforced at the DB level (foreign
-- keys, courses_hours_consistent, transactions.amount > 0, the booking
-- no-overlap exclusion constraint) — bad data of those shapes literally
-- cannot be written. This function covers what constraints can't catch:
-- duplicates, missing/malformed contact info, and cross-table state that's
-- individually valid but contradicts itself (e.g. a "won" customer with no
-- course, or a booking against a course that's already fully consumed).
--
-- Read-only by design (see 0007 for why: is_staff() can select, nothing
-- writes here) — the owner decides what to do with each finding; this
-- never edits or deletes data on its own.

create or replace function data_health_report()
returns table (
  category text,
  severity text,
  description text,
  entity_type text,
  entity_id uuid,
  suggested_fix text
)
language sql
stable
set search_path = public
as $$
  -- Duplicate customers sharing the same phone number.
  select
    'duplicate' as category,
    'warning' as severity,
    'ลูกค้าหลายรายใช้เบอร์โทร ' || phone || ' ร่วมกัน (' || count(*) || ' ราย)' as description,
    'customers' as entity_type,
    null::uuid as entity_id,
    'ตรวจสอบว่าเป็นคนเดียวกันที่ถูกสร้างซ้ำหรือไม่ ถ้าใช่ให้รวมประวัติแล้วลบรายการซ้ำด้วยตนเอง' as suggested_fix
  from customers
  where phone is not null and trim(phone) <> ''
  group by phone
  having count(*) > 1

  union all

  -- Duplicate customers sharing the same parent phone number.
  select
    'duplicate',
    'warning',
    'ลูกค้าหลายรายใช้เบอร์โทรผู้ปกครอง ' || parent_phone || ' ร่วมกัน (' || count(*) || ' ราย)',
    'customers',
    null::uuid,
    'ตรวจสอบว่าเป็นพี่น้องกันจริง (ปกติ) หรือถูกสร้างซ้ำโดยไม่ตั้งใจ'
  from customers
  where parent_phone is not null and trim(parent_phone) <> ''
  group by parent_phone
  having count(*) > 1

  union all

  -- Customers with no way to reach them at all.
  select
    'missing_data',
    'warning',
    'ลูกค้า "' || name || '" ไม่มีเบอร์โทร, เบอร์ผู้ปกครอง, หรือ LINE เลย ติดต่อไม่ได้',
    'customers',
    id,
    'เพิ่มช่องทางติดต่ออย่างน้อยหนึ่งช่องทาง หรือลบรายการนี้ถ้าเป็นข้อมูลทดสอบ'
  from customers
  where (phone is null or trim(phone) = '')
    and (parent_phone is null or trim(parent_phone) = '')
    and (line_user_id is null or trim(line_user_id) = '')

  union all

  -- Phone numbers too short to be real (digits-only length under 7).
  select
    'malformed',
    'warning',
    'เบอร์โทรของลูกค้า "' || name || '" ("' || phone || '") สั้นผิดปกติ อาจพิมพ์ผิด',
    'customers',
    id,
    'ตรวจสอบและแก้เบอร์โทรให้ถูกต้องในหน้า Students / CRM'
  from customers
  where phone is not null
    and trim(phone) <> ''
    and length(regexp_replace(phone, '\D', '', 'g')) < 7

  union all

  -- Sales pipeline says "won"/"renewed" but no course was ever created.
  select
    'inconsistent_status',
    'warning',
    'ลูกค้า "' || c.name || '" สถานะ "' || c.sales_status || '" (ปิดการขายแล้ว) แต่ไม่มีคอร์สในระบบเลย',
    'customers',
    c.id,
    'สร้างคอร์สให้ลูกค้ารายนี้ ถ้ายังไม่ได้สร้าง หรือแก้สถานะให้ตรงกับความเป็นจริง'
  from customers c
  where c.sales_status in ('won', 'renewed')
    and not exists (select 1 from courses co where co.customer_id = c.id)

  union all

  -- A booking is scheduled (pending/confirmed, in the future) against a
  -- course that has already fully used up its hours.
  select
    'inconsistent_status',
    'critical',
    'มีการจองเรียนล่วงหน้าสำหรับลูกค้า "' || c.name || '" แต่คอร์สที่ผูกไว้ใช้ครบชั่วโมงแล้ว',
    'bookings',
    b.id,
    'ต่ออายุคอร์สให้ลูกค้าก่อนถึงวันนัด หรือยกเลิก/ย้ายการจองนี้ไปคอร์สใหม่'
  from bookings b
  join courses co on co.id = b.course_id
  join customers c on c.id = b.customer_id
  where b.status in ('pending', 'confirmed')
    and b.start_time > now()
    and co.remaining_hour = 0;
$$;

comment on function data_health_report() is
  'Level 1 hardening: read-only data quality findings (duplicates, missing/malformed contact info, cross-table status conflicts) for the Data Health dashboard. Never writes or deletes.';
