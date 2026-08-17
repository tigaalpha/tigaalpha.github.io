-- Cloud State Sync: two-way sync of the learner's localStorage learning
-- state (pathway progress, SRS schedule, learner memory, best scores,
-- favorites, activity log, user songs...) so a member's progress survives
-- device switches and browser cache clears, and so the business finally has
-- the real per-learner data the AI features (weakness coaching, weekly
-- reports, personalized plans) are supposed to run on.
--
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human
-- review. Safe to re-run: every object uses if-not-exists / or-replace.
--
-- Design (matches every other table this project has added):
--   * One row per user per localStorage key; RLS is SELECT-only for self.
--   * ALL writes go through the SECURITY DEFINER RPC sync_cloud_state(),
--     same pattern as upsert_skill_snapshot / league RPCs.
--   * Conflict resolution is per-key last-write-wins by the CLIENT's wall
--     clock (client_ts) — the only timestamp that makes sense for merging
--     two devices. client_ts is clamped to [2000-01-01, server_now + 5min]
--     so a tampered/insane clock can't stamp a far-future row that would
--     permanently shadow every other device.
--   * The CLIENT does the value-level merging (union of done-sets, max of
--     best-scores/counters, per-topic SRS merge...) with shape-aware rules
--     in cloud-sync.ts, because the server can't know which keys are
--     additive vs last-write-wins without a config table. The RPC keeps the
--     per-key newest row; the client reconciles the rest. Consequence: two
--     devices writing the SAME key in the same second can still lose one
--     write (LWW), which matches the max()-based merge the app already uses
--     for coins/exp on login — accepted for v1, and the client's pull-merge
--     covers the actual common case (device switches, offline edits).

create table if not exists user_cloud_state (
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  client_ts  timestamptz not null,                     -- client wall clock at write (merge winner)
  updated_at timestamptz not null default now(),       -- server write time (debug/audit only)
  primary key (user_id, key)
);
create index if not exists user_cloud_state_user_idx on user_cloud_state (user_id, updated_at);

alter table user_cloud_state enable row level security;
drop policy if exists "user_cloud_state: self select" on user_cloud_state;
create policy "user_cloud_state: self select" on user_cloud_state for select
  using (user_id = auth.uid());
-- no client insert/update/delete policy at all — every write goes through
-- sync_cloud_state() below, the same SELECT-only-RLS-plus-SECURITY-DEFINER
-- pattern used by every table added to this project.

-- Two-way sync RPC. Payload shape (one object, all dirty keys):
--   { "<key>": { "v": <json value or null for delete>, "ts": <client epoch ms> }, ... }
-- For each key: keeps the newer of (existing row, incoming) by client_ts,
-- then RETURNS every row the caller has on record so the client can
-- reconcile its local copy in one round trip. Passing an empty object `{}`
-- is therefore a plain "pull all my state" call.
create or replace function public.sync_cloud_state(p_updates jsonb)
returns table (key text, value jsonb, updated_at timestamptz, client_ts timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  k text;
  e jsonb;
  v jsonb;
  ts bigint;
  ts_ts timestamptz;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception 'invalid payload';
  end if;
  for k, e in select * from jsonb_each(p_updates)
  loop
    if length(k) > 64 or k = '' then continue; end if;  -- bad key: skip, don't fail the batch
    if not (e ? 'v') or not (e ? 'ts') then continue; end if;
    v := coalesce(e->'v', 'null'::jsonb);                -- explicit null = tombstone (key deleted)
    begin
      ts := (e->>'ts')::bigint;
    exception when others then continue;
    end;
    if ts is null or ts <= 0 then continue; end if;
    ts_ts := to_timestamp(ts / 1000.0);
    -- clamp a lying/insane client clock: never before 2000, never more than
    -- 5 minutes in the future (covers NTP drift without letting a tampered
    -- ts permanently shadow every other device)
    ts_ts := least(greatest(ts_ts, '2000-01-01'::timestamptz), now() + interval '5 minutes');
    insert into user_cloud_state (user_id, key, value, client_ts)
      values (u, k, v, ts_ts)
    on conflict (user_id, key) do update
      set value = excluded.value, client_ts = excluded.client_ts, updated_at = now()
      where user_cloud_state.client_ts < excluded.client_ts;
  end loop;
  return query
    select s.key, s.value, s.updated_at, s.client_ts
    from user_cloud_state s
    where s.user_id = u
    order by s.key;
end; $$;
