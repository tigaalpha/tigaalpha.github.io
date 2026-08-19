-- Chat features (Human-in-the-loop everywhere + on/off per feature)
--
-- 1) ai_outbox: ทุกข้อความที่ AI "ส่งออกไปหาลูกค้า" (outbound nurture, เตือน
--    คาบเรียน, broadcast) ต้องผ่านคิวนี้ก่อน — โหมด "suggest" (ค่าเริ่มต้น)
--    เจ้าของตรวจ/แก้/อนุมัติ/ปฏิเสธในหน้า Inbox > AI Outbox, โหมด "auto"
--    AI ส่งเองตามวงเงิน ข้อความที่ถูกปฏิเสธพร้อมเหตุผลจะถูกเก็บใน
--    chat_feedback ไปสอน AI รอบถัดไป
-- 2) chat_feedback: บันทึกคำสอนจากเจ้าของ (ปฏิเสธ/แก้) เพื่อให้การสร้าง
--    ข้อความถัดไปไม่พลาดซ้ำ
-- 3) customers.marketing_opt_out: ลูกค้าขอเลิกแจ้ง (พิมพ์ "เลิกแจ้ง"/"stop"
--    ทาง LINE หรือถูก unfollow) — broadcast/outbound จะข้ามคนนี้

create table if not exists ai_outbox (
  id uuid primary key default uuid_generate_v4(),
  feature text not null,                       -- outbound_nurture | lesson_reminder | broadcast | welcome
  status text not null default 'pending_review', -- pending_review | approved | sent | rejected | failed
  mode text not null default 'suggest',        -- suggest (รอคนตรวจ) | auto (AI ส่งเอง)
  channel text not null default 'line',
  customer_id uuid references customers (id) on delete set null,
  recipient_line_user_id text,
  message text not null,
  message_type text not null default 'text',   -- text | flex
  flex_payload jsonb,
  reason text,                                 -- เหตุผลที่ AI อยากส่งข้อความนี้
  reference_id text,                           -- booking:{id}:24h ฯลฯ ใช้ dedupe
  rejected_note text,
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  sent_at timestamptz,
  error text,
  created_by text not null default 'ai',
  created_at timestamptz not null default now()
);

create index if not exists ai_outbox_status_idx on ai_outbox (status);
create index if not exists ai_outbox_feature_idx on ai_outbox (feature, status);
create index if not exists ai_outbox_ref_idx on ai_outbox (reference_id) where reference_id is not null;

create table if not exists chat_feedback (
  id uuid primary key default uuid_generate_v4(),
  feature text not null,
  customer_id uuid references customers (id) on delete set null,
  original_message text,
  feedback_type text not null,                 -- rejected | edited | suggested
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists chat_feedback_feature_idx on chat_feedback (feature, created_at);

alter table customers add column if not exists marketing_opt_out boolean not null default false;

-- RLS: เฉพาะ staff (มี row ใน profiles) อ่าน/เขียนได้ — pattern เดียวกับตารางอื่น
alter table ai_outbox enable row level security;
alter table chat_feedback enable row level security;

drop policy if exists "staff read ai_outbox" on ai_outbox;
create policy "staff read ai_outbox" on ai_outbox for select using (is_staff());
drop policy if exists "staff insert ai_outbox" on ai_outbox;
create policy "staff insert ai_outbox" on ai_outbox for insert with check (is_staff());
drop policy if exists "staff update ai_outbox" on ai_outbox;
create policy "staff update ai_outbox" on ai_outbox for update using (is_staff());

drop policy if exists "staff read chat_feedback" on chat_feedback;
create policy "staff read chat_feedback" on chat_feedback for select using (is_staff());
drop policy if exists "staff insert chat_feedback" on chat_feedback;
create policy "staff insert chat_feedback" on chat_feedback for insert with check (is_staff());

-- Cron jobs (pattern เดียวกับ 0084/0086 — pg_net + x-cron-secret จาก integration_settings)
select cron.unschedule('chat-outbound-nurture-hourly') where exists (select 1 from cron.job where jobname = 'chat-outbound-nurture-hourly');
select cron.schedule(
  'chat-outbound-nurture-hourly',
  '0 * * * *', -- ทุกชั่วโมง
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/chat-outbound-nurture',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.unschedule('chat-lesson-reminder-15m') where exists (select 1 from cron.job where jobname = 'chat-lesson-reminder-15m');
select cron.schedule(
  'chat-lesson-reminder-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/chat-lesson-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.unschedule('chat-memory-sync-daily') where exists (select 1 from cron.job where jobname = 'chat-memory-sync-daily');
select cron.schedule(
  'chat-memory-sync-daily',
  '0 20 * * *', -- 03:00 เวลาไทย
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/chat-memory-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.unschedule('chat-line-setup-weekly') where exists (select 1 from cron.job where jobname = 'chat-line-setup-weekly');
select cron.schedule(
  'chat-line-setup-weekly',
  '0 2 * * 1', -- ทุกวันจันทร์ 09:00 เวลาไทย
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/chat-line-setup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ค่าเริ่มต้น: ทุกฟีเจอร์เปิด (ให้ AI ทำงาน) + โหมด review = "always" (มนุษย์ตรวจก่อน)
insert into integration_settings (key, value) values
  ('chat_review_mode', 'always'),
  ('chat_feature_outbound_nurture', 'on'),
  ('chat_feature_lesson_reminder', 'on'),
  ('chat_feature_rich_menu', 'on'),
  ('chat_feature_flex_messages', 'on'),
  ('chat_feature_customer_memory', 'on'),
  ('chat_feature_owner_mode', 'on'),
  ('chat_feature_broadcast', 'on'),
  ('chat_feature_owner_notify', 'on'),
  ('chat_feature_multilang', 'on')
on conflict (key) do nothing;
