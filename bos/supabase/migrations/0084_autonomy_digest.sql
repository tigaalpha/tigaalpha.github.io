-- 0084: Autonomy Tier 2 (งาน #1) — ระดับ autonomy ของทีม AI + สรุปงานประจำวัน
--
-- 1) agent_autonomy_level (integration_settings) — เจ้าของเลือกระดับผ่านหน้า
--    AI Company: conservative (ค่าเริ่มต้น) / balanced / high ขั้นตอนโค้ด
--    (agent-actions.ts + agent-actions-db.ts) ใช้ค่านี้ตัดสินว่า action
--    ชนิดใด auto-execute ได้ พร้อม hard guards (วงเงินรายวัน, เวลาทำการ,
--    lead score) ที่ระดับไหนก็ปิดไม่ได้
-- 2) Cron สรุปงานประจำวัน (agent-action-digest) 07:30 BKK ทุกวัน — ส่ง LINE
--    ให้เจ้าของว่าวันก่อน AI ทำอะไรไปบ้างอัตโนมัติ และมีอะไรค้างรออนุมัติ

insert into integration_settings (key, value)
values ('agent_autonomy_level', 'conservative')
on conflict (key) do nothing;

select cron.schedule(
  'agent-action-digest-daily',
  '30 0 * * *', -- 07:30 เวลาไทย (UTC+7) = 00:30 UTC
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/agent-action-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
