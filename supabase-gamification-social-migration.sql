-- Persistent friends + async duels (also powers async Family Battle via the
-- same table, distinguished only by a `mode` flavor column).
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- Safe to re-run.
--
-- Deliberately additive only — does not touch profiles or any existing table.
-- Every write goes through a SECURITY DEFINER RPC that re-checks auth.uid(),
-- same pattern as every other table added this session.

-- ── friends ────────────────────────────────────────────────────────────────
create table if not exists friends (
  id            uuid primary key default uuid_generate_v4(),
  requester_id  uuid not null references auth.users (id) on delete cascade,
  addressee_id  uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friends_no_self check (requester_id <> addressee_id),
  constraint friends_unique_pair unique (requester_id, addressee_id)
);
create index if not exists friends_addressee_idx on friends (addressee_id, status);
create index if not exists friends_requester_idx on friends (requester_id, status);

alter table friends enable row level security;
drop policy if exists "friends: parties select" on friends;
create policy "friends: parties select" on friends for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());
-- no client insert/update/delete policy — everything below goes through an RPC

create or replace function public.friend_request(p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_target uuid; v_existing friends%rowtype; v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_target from profiles where lower(email) = lower(trim(p_email)) limit 1;
  if v_target is null then raise exception 'no user with that email'; end if;
  if v_target = v_uid then raise exception 'cannot friend yourself'; end if;

  -- if they already sent ME a pending request, accept it instead of duplicating
  select * into v_existing from friends where requester_id = v_target and addressee_id = v_uid limit 1;
  if found then
    if v_existing.status = 'pending' then
      update friends set status = 'accepted', responded_at = now() where id = v_existing.id;
      return jsonb_build_object('status', 'accepted', 'id', v_existing.id);
    end if;
    return jsonb_build_object('status', v_existing.status, 'id', v_existing.id);
  end if;

  insert into friends (requester_id, addressee_id) values (v_uid, v_target)
    on conflict (requester_id, addressee_id) do nothing
    returning id into v_id;
  if v_id is null then
    select id into v_id from friends where requester_id = v_uid and addressee_id = v_target;
  end if;
  return jsonb_build_object('status', 'pending', 'id', v_id);
end; $$;

create or replace function public.friend_respond(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_accept then
    update friends set status = 'accepted', responded_at = now()
      where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from friends where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;
end; $$;

create or replace function public.friend_remove(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from friends where id = p_id and (requester_id = auth.uid() or addressee_id = auth.uid());
end; $$;

-- One round trip for the whole Friends tab: accepted friends (with live stats
-- for a quick leaderboard-style glance) + pending incoming/outgoing requests.
create or replace function public.friend_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_friends jsonb; v_incoming jsonb; v_outgoing jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'user_id', other.id,
      'name', coalesce(nullif(trim(other.full_name), ''), other.email, 'Player'),
      'exp', other.exp, 'streak', other.streak
    )), '[]'::jsonb) into v_friends
    from friends f
    join profiles other on other.id = (case when f.requester_id = v_uid then f.addressee_id else f.requester_id end)
    where f.status = 'accepted' and (f.requester_id = v_uid or f.addressee_id = v_uid);

  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Player'))), '[]'::jsonb)
    into v_incoming
    from friends f join profiles p on p.id = f.requester_id
    where f.status = 'pending' and f.addressee_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Player'))), '[]'::jsonb)
    into v_outgoing
    from friends f join profiles p on p.id = f.addressee_id
    where f.status = 'pending' and f.requester_id = v_uid;

  return jsonb_build_object('friends', v_friends, 'incoming', v_incoming, 'outgoing', v_outgoing);
end; $$;

-- ── duels (async head-to-head; mode='family' is the same mechanic under a
--    different label for the Family Battle feature — no separate "family
--    group" concept exists in this app, so it reuses the same friends graph) ──
create table if not exists duels (
  id          uuid primary key default uuid_generate_v4(),
  mode        text not null default 'duel' check (mode in ('duel','family')),
  song_id     text not null,
  a_id        uuid not null references auth.users (id) on delete cascade,
  b_id        uuid not null references auth.users (id) on delete cascade,
  a_score     int,
  b_score     int,
  status      text not null default 'pending' check (status in ('pending','done')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '48 hours'),
  constraint duels_no_self check (a_id <> b_id)
);
create index if not exists duels_participant_idx on duels (a_id, b_id, status);

alter table duels enable row level security;
drop policy if exists "duels: participants select" on duels;
create policy "duels: participants select" on duels for select
  using (a_id = auth.uid() or b_id = auth.uid());

-- Caller has already played (p_score is their real result) and is challenging
-- an existing accepted friend to beat it within the response window. Requires
-- an accepted friendship — prevents this from becoming an unsolicited-spam vector.
create or replace function public.duel_challenge(p_friend_id uuid, p_song_id text, p_score int, p_mode text default 'duel') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_friend_id = v_uid then raise exception 'cannot challenge yourself'; end if;
  if p_mode not in ('duel', 'family') then raise exception 'invalid mode'; end if;
  if coalesce(trim(p_song_id), '') = '' then raise exception 'song_id required'; end if;
  if p_score is null or p_score < 0 or p_score > 100000 then raise exception 'invalid score'; end if;
  if not exists (
    select 1 from friends where status = 'accepted'
      and ((requester_id = v_uid and addressee_id = p_friend_id) or (requester_id = p_friend_id and addressee_id = v_uid))
  ) then raise exception 'not friends with that player'; end if;

  insert into duels (mode, song_id, a_id, b_id, a_score)
    values (p_mode, p_song_id, v_uid, p_friend_id, p_score)
    returning id into v_id;
  return jsonb_build_object('id', v_id);
end; $$;

-- The invited party submits their own real result within the window.
create or replace function public.duel_respond(p_id uuid, p_score int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_score is null or p_score < 0 or p_score > 100000 then raise exception 'invalid score'; end if;
  update duels set b_score = p_score, status = 'done'
    where id = p_id and b_id = auth.uid() and status = 'pending' and expires_at > now();
end; $$;

-- Last 30 days of the caller's duels, oriented so the client never has to
-- figure out which side it's on. A still-pending duel past its window is
-- reported as 'expired' here WITHOUT a write (lazy, read-time only — same
-- no-background-job approach as the weekly leagues migration).
create or replace function public.duel_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'mode', d.mode, 'song_id', d.song_id,
      'status', case when d.status = 'pending' and d.expires_at < now() then 'expired' else d.status end,
      'i_am_a', d.a_id = v_uid,
      'my_score', case when d.a_id = v_uid then d.a_score else d.b_score end,
      'opp_score', case when d.a_id = v_uid then d.b_score else d.a_score end,
      'opp_name', coalesce(nullif(trim(op.full_name), ''), op.email, 'Player'),
      'expires_at', d.expires_at, 'created_at', d.created_at
    ) order by d.created_at desc), '[]'::jsonb)
    into v_result
    from duels d
    join profiles op on op.id = (case when d.a_id = v_uid then d.b_id else d.a_id end)
    where (d.a_id = v_uid or d.b_id = v_uid) and d.created_at > now() - interval '30 days'
    limit 100;
  return v_result;
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying (use two real logged-in test accounts, A and B):
-- 1. As A: select friend_request('b@example.com');  -> status 'pending'
-- 2. As B: select friend_list();                     -> B sees A in `incoming`
-- 3. As B: select friend_respond('<id from step1>', true);
-- 4. As A or B: select friend_list();                -> both now see each other in `friends`
-- 5. As A: select duel_challenge('<B's uuid>', 'furelise', 890, 'duel');
-- 6. As B: select duel_list();                       -> sees the pending duel from A
-- 7. As B: select duel_respond('<id from step5>', 910);
-- 8. As A: select duel_list();                       -> status 'done', both scores visible
-- 9. As a THIRD, non-friend account: select duel_challenge('<A's uuid>', 'x', 1, 'duel');
--    -> must FAIL with 'not friends with that player'
-- ═══════════════════════════════════════════════════════════════════════════
