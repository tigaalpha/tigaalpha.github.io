-- No AI-cost edge function (ai-chat, generate-image, generate-article,
-- generate-video-script, generate-voiceover, knowledge-upload) had any
-- per-user throttle — requireStaff only checks identity, never usage. Any
-- single staff credential could loop-call these endpoints with no cap,
-- exhausting the shared Gemini quota (the exact failure the raw-error-JSON
-- screenshots showed) or running up real API costs. This is a fixed-window
-- counter checked/incremented atomically in one statement via the RPC below
-- so concurrent requests from the same user can't race past the limit.
create table if not exists ai_rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

comment on table ai_rate_limits is 'Fixed-window per-user request counters for AI-cost edge functions.';

create or replace function increment_rate_limit(p_user_id uuid, p_bucket text, p_window_minutes int)
returns integer as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));
  v_count integer;
begin
  insert into ai_rate_limits (user_id, bucket, window_start, count)
  values (p_user_id, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = ai_rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public;

-- Old windows accumulate forever otherwise (same unbounded-growth class the
-- DB audit flagged for audit_log/messages/ai_response_cache) — prune
-- anything more than a day past its window on a daily cron tick.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'prune_ai_rate_limits',
  '0 3 * * *',
  $$ delete from ai_rate_limits where window_start < now() - interval '1 day' $$
);
