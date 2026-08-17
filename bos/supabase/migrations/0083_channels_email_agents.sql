-- 0083: เปิดช่องทาง TikTok + X (Twitter) ให้โพสต์อัตโนมัติ, เพิ่มอีเมลลูกค้า,
-- และขยาย action types ของ CEO Agent (draft_content / update_customer /
-- send_email) — ตามแผน "องค์กรคนเดียวที่ AI รันแทนทั้งบริษัท" (รอบที่ 1)

-- 1) social_accounts: เพิ่ม platform 'x' (tiktok มีอยู่แล้วใน constraint เดิม)
alter table social_accounts drop constraint if exists social_accounts_platform_check;
alter table social_accounts add constraint social_accounts_platform_check
  check (platform in ('facebook', 'instagram', 'tiktok', 'youtube', 'line', 'x'));

-- 2) customers.email — ใช้ส่งใบแจ้งชำระ / ใบเสร็จ / จดหมายข่าว (ช่องทาง Email)
alter table customers add column if not exists email text;
create index if not exists customers_email_idx on customers (email) where email is not null;

-- 3) agent_actions: ขยาย action types ที่ CEO Agent execute ได้
alter table agent_actions drop constraint if exists agent_actions_action_type_check;
alter table agent_actions add constraint agent_actions_action_type_check
  check (action_type in ('create_task', 'send_notification', 'send_line', 'create_schedule', 'draft_content', 'update_customer', 'send_email'));
