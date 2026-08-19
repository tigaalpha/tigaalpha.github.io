-- Level 5 Wave 1, chunk 1: fixes for three real idempotency races found by
-- audit (not hypothetical) -- approval double-execution, LINE webhook
-- redelivery, automation-engine-runner overlap -- plus one real RLS gap
-- (ai_rate_limits was the only table across 63 prior migrations missing
-- row level security).

-- --- 1. LINE webhook dedup ---------------------------------------------

-- Insert-first dedup: line-webhook/index.ts inserts the event's
-- webhookEventId before processing; a unique-violation means this event
-- was already handled (LINE retries deliveries on timeout/non-200).
create table line_webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

alter table line_webhook_events enable row level security;
-- Only ever touched by line-webhook (service-role admin client, a public
-- unauthenticated endpoint protected by LINE signature verification, not
-- a Supabase JWT) -- no anon/authenticated policy needed.

-- --- 2. automation-engine-runner re-entrancy guard ----------------------

-- Fixed advisory-lock key for this one function -- pg_try_advisory_lock
-- takes a bigint; an arbitrary stable constant is sufficient since this
-- is the only caller of either function.
create or replace function try_lock_automation_engine() returns boolean
language sql security definer set search_path = public as $$
  select pg_try_advisory_lock(918273645);
$$;

create or replace function unlock_automation_engine() returns void
language sql security definer set search_path = public as $$
  select pg_advisory_unlock(918273645);
$$;

-- --- 3. ai_rate_limits RLS gap -------------------------------------------

-- Only ever touched via increment_rate_limit() (security definer, 0024)
-- from the service-role admin client -- no anon/authenticated policy
-- needed, this just closes the "table created without RLS" gap itself.
alter table ai_rate_limits enable row level security;
