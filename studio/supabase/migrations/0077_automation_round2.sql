-- ============================================================================
-- 0077: Automation Round 2 — 14 features that replace human busywork:
--   1. Auto payment confirmation from transfer slips (vision)
--   2. Post-trial follow-up automation
--   3. Auto-reschedule aid + waitlist offers
--   4. New channels: Messenger PSID + public web chat
--   5. AI lesson summaries after class
--   6. Reactivation nudges for lapsed students
--   7. Drip marketing + lead scoring
--   8. Course renewal/upsell nudges
--   9. Monthly business report
--  10. Teacher payroll report
--  11. Reviews + referrals
--  12. Auto-KB learning from staff replies
--  13. Foundation: AI token budget guard (+ tests/retry live in code)
--  14. LINE voice messages -> transcript -> AI
-- ============================================================================

-- ---------- #1 transfer slips ----------
alter table payments add column slip_image_url text;
alter table payments add column slip_verified_at timestamptz;

create table transfer_slips (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers (id) on delete set null,
  payment_id uuid references payments (id) on delete set null,
  image_url text,
  extracted_amount numeric(10,2),
  extracted_reference text,
  extracted_date timestamptz,
  confidence numeric(4,3),
  match_status text not null default 'pending'
    check (match_status in ('pending','matched','unmatched','not_a_slip')),
  raw_extraction jsonb,
  created_at timestamptz not null default now()
);

create index transfer_slips_customer_idx on transfer_slips (customer_id);
alter table transfer_slips enable row level security;
create policy "transfer_slips: staff read" on transfer_slips for select using (is_staff());
create policy "transfer_slips: owner manages" on transfer_slips for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- ---------- #2 post-trial ----------
alter table bookings add column is_trial boolean not null default false;
alter table bookings add column post_trial_feedback_sent_at timestamptz;
alter table bookings add column post_trial_offer_sent_at timestamptz;

-- ---------- #3 waitlist + freed-slot offers ----------
alter table bookings add column waitlist_offered_at timestamptz;

create table waitlist (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  teacher_id uuid references teachers (id) on delete set null,
  preferred_day smallint check (preferred_day between 0 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index waitlist_active_teacher_idx on waitlist (teacher_id) where active;
alter table waitlist enable row level security;
create policy "waitlist: staff manage" on waitlist for all using (is_staff()) with check (is_staff());

-- ---------- #4 channels ----------
alter type conversation_channel add value if not exists 'messenger';
alter table customers add column messenger_psid text unique;

-- ---------- #5 lesson notes ----------
create table lesson_notes (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references bookings (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  teacher_id uuid references teachers (id) on delete set null,
  summary text not null,
  homework text,
  raw_input text,
  created_by uuid references profiles (id) on delete set null,
  sent_to_customer boolean not null default false,
  created_at timestamptz not null default now()
);
create index lesson_notes_customer_idx on lesson_notes (customer_id);
alter table lesson_notes enable row level security;
create policy "lesson_notes: staff read" on lesson_notes for select using (is_staff());
create policy "lesson_notes: staff insert" on lesson_notes for insert with check (is_staff());

-- ---------- #6 reactivation ----------
alter table customers add column last_reactivation_at timestamptz;

create table reactivation_log (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers (id) on delete cascade,
  message text,
  sent_at timestamptz not null default now()
);
alter table reactivation_log enable row level security;
create policy "reactivation_log: staff read" on reactivation_log for select using (is_staff());

-- ---------- #7 drip + lead scoring ----------
create table drip_campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  segment jsonb not null default '{}'::jsonb, -- {"sales_statuses": ["new_lead","contacted"]}
  message_template text not null,             -- {name} placeholder supported
  interval_days int not null default 7 check (interval_days >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table drip_sends (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references drip_campaigns (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);
alter table drip_campaigns enable row level security;
create policy "drip_campaigns: staff manage" on drip_campaigns for all using (is_staff()) with check (is_staff());
alter table drip_sends enable row level security;
create policy "drip_sends: staff manage" on drip_sends for all using (is_staff()) with check (is_staff());

-- lead_score column already exists (migration 0059, trigger-based). This
-- round EXTENDS that system: the same column, but the formula now also
-- rewards real activity (recent messages, booked lessons, paid money) on
-- top of the 0059 base (status + qualification + recency). The trigger is
-- replaced so both the trigger path and the event-driven recompute path
-- (chat-core on every customer message, confirmPayment on every payment)
-- agree on one formula.
create or replace function recompute_lead_score(p_customer uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_base int;
  v_messages int;
  v_bookings int;
  v_payments int;
  v_score int;
begin
  select compute_lead_score_row(c.sales_status, c.learning_goal, c.budget, c.last_contact_at, c.created_at)
  into v_base from customers c where c.id = p_customer;
  v_base := coalesce(v_base, 0);

  select count(*) into v_messages from messages m
    join conversations c on c.id = m.conversation_id
    where c.customer_id = p_customer and m.sender = 'customer'
      and m.created_at > now() - interval '30 days';

  select count(*) into v_bookings from bookings
    where customer_id = p_customer and status <> 'cancelled';

  select count(*) into v_payments from payments
    where customer_id = p_customer and status = 'paid';

  v_score := v_base
    + least(v_messages, 25)
    + least(v_bookings * 10, 40)
    + least(v_payments * 30, 60);
  v_score := greatest(0, least(v_score, 100));
  -- The customers_lead_score trigger recomputes the identical value on this
  -- write (same formula) — idempotent, no recursion.
  update customers set lead_score = v_score where id = p_customer;
  return v_score;
end $$;

-- Replace the 0059 trigger body with the same activity-aware formula.
drop trigger if exists customers_lead_score on customers;
create or replace function trg_customers_lead_score() returns trigger
language plpgsql set search_path = public as $$
begin
  new.lead_score := greatest(0, least(100,
    compute_lead_score_row(new.sales_status, new.learning_goal, new.budget, new.last_contact_at, new.created_at)
    + (select least(count(*), 25) from messages m join conversations c on c.id = m.conversation_id
       where c.customer_id = new.id and m.sender = 'customer' and m.created_at > now() - interval '30 days')
    + (select least(count(*) * 10, 40) from bookings where customer_id = new.id and status <> 'cancelled')
    + (select least(count(*) * 30, 60) from payments where customer_id = new.id and status = 'paid')
  ));
  return new;
end;
$$;
create trigger customers_lead_score before insert or update on customers
  for each row execute function trg_customers_lead_score();

-- ---------- #8 renewal ----------
alter table customers add column renewal_offer_sent_at timestamptz;

-- ---------- #9 monthly report (no table — notification + LINE push only) ----------

-- ---------- #10 teacher payroll ----------
create table teacher_rates (
  teacher_id uuid primary key references teachers (id) on delete cascade,
  rate_per_hour numeric(10,2) not null check (rate_per_hour >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table teacher_rates enable row level security;
create policy "teacher_rates: staff read" on teacher_rates for select using (is_staff());
create policy "teacher_rates: owner manages" on teacher_rates for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- ---------- #11 reviews + referrals ----------
alter table customers add column review_asked_at timestamptz;
alter table customers add column referral_code text unique;

create table referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_customer_id uuid not null references customers (id) on delete cascade,
  referral_code text not null unique,
  referred_customer_id uuid references customers (id) on delete set null,
  reward_granted boolean not null default false,
  created_at timestamptz not null default now()
);
alter table referrals enable row level security;
create policy "referrals: staff read" on referrals for select using (is_staff());
create policy "referrals: owner manages" on referrals for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- ---------- #12 auto-KB ----------
alter table knowledge_documents add column auto_generated boolean not null default false;

create table kb_learning_log (
  id uuid primary key default uuid_generate_v4(),
  question_hash text not null unique,
  customer_id uuid references customers (id) on delete set null,
  question text not null,
  answer text not null,
  document_id uuid references knowledge_documents (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table kb_learning_log enable row level security;
create policy "kb_learning_log: staff read" on kb_learning_log for select using (is_staff());
create policy "kb_learning_log: owner manages" on kb_learning_log for all using (is_owner_or_admin()) with check (is_owner_or_admin());

-- ---------- #13 notification types (used across the round) ----------
alter type notification_type add value if not exists 'slip_matched';
alter type notification_type add value if not exists 'slip_unmatched';
alter type notification_type add value if not exists 'post_trial';
alter type notification_type add value if not exists 'renewal_offer';
alter type notification_type add value if not exists 'monthly_report';
alter type notification_type add value if not exists 'payroll_report';
alter type notification_type add value if not exists 'reactivation';
alter type notification_type add value if not exists 'review_request';
alter type notification_type add value if not exists 'referral_created';
alter type notification_type add value if not exists 'lesson_summary';
alter type notification_type add value if not exists 'waitlist_offer';
alter type notification_type add value if not exists 'kb_auto_learned';
alter type notification_type add value if not exists 'ai_budget_exceeded';
alter type notification_type add value if not exists 'drip_sent';
alter type notification_type add value if not exists 'voice_transcript';

-- ---------- cron schedules ----------
-- Post-trial follow-up (feedback ~1h after the trial, offer ~24h later).
select cron.schedule(
  'trial-followup',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/trial-followup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Reactivation / renewal / review / waitlist passes (hourly, each guarded
-- by its own "last sent" column so a hourly tick can never spam).
select cron.schedule(
  'automation-nudges',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/automation-nudges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Drip campaigns (every 6 hours).
select cron.schedule(
  'drip-runner',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/drip-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Monthly business report (1st of month, 08:00).
select cron.schedule(
  'monthly-report',
  '0 8 1 * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/monthly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Teacher payroll report (1st of month, 09:00).
select cron.schedule(
  'payroll-report',
  '0 9 1 * *',
  $$
  select net.http_post(
    url := 'https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/payroll-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from integration_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
