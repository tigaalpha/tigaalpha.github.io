-- supabase-referral-migration.sql
--
-- NOT APPLIED. Written 2026-11-26 (Step 3.4). Run only with the owner's explicit approval for THIS file (AGENTS.md hard rule). Independent of the other waiting files.
--
-- Server-side referrals. Until now ReferralDashboard.tsx only kept a made-up code in localStorage; nothing could be counted. This file adds, in ONE transaction:
--   1. profiles.referral_code (unique, 7 characters from an alphabet without 0 O 1 I L) + profiles.referred_by, a trigger that gives every NEW profile a code, and a backfill for existing profiles.
--   2. public.referrals (referrer_id, referee_id UNIQUE, code, utm_source, utm_medium, created_at, rewarded_at). RLS on: a member reads only the rows where they are the referrer, an admin reads all; nobody
--      can insert / update from the client (only the security definer functions below write).
--   3. claim_referral(p_code, p_utm_source, p_utm_medium): once per account, never your own code, only for an account created in the last 7 days. It answers with a status string and never raises, so a
--      sign-in can never fail because of it.
--   4. The REWARD is OFF. It is read from app_settings key 'referral' = {"reward_enabled": false, "reward_days": 7, "max_rewards_per_referrer": 5}; the row is inserted with reward_enabled false (it is not
--      overwritten if it exists). While it is false a claim only counts the friend. When the owner sets reward_enabled to true, each NEW claim gives the referrer `reward_days` of Premium (plan / plan_until;
--      time on top of a live subscription, from now for a free or trial member), at most `max_rewards_per_referrer` times per referrer. Premium days only: no money, no coins, no gems.
--   5. my_referral_stats() for the member's own screen (a friend appears as an initial and a date: no e-mail, no full name) and admin_top_referrers() for the admin tab.
-- To undo: drop function claim_referral / my_referral_stats / admin_top_referrers / referral_set_code; drop table public.referrals; alter table public.profiles drop column referral_code, drop column referred_by.

begin;

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code) where referral_code is not null;

create or replace function public.gen_referral_code()
returns text
language plpgsql volatile as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..7 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;
  return c;
end;
$$;

create or replace function public.referral_set_code()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.referral_code is null then new.referral_code := public.gen_referral_code(); end if;
  return new;
end;
$$;
drop trigger if exists trg_referral_set_code on public.profiles;
create trigger trg_referral_set_code before insert on public.profiles for each row execute function public.referral_set_code();

update public.profiles set referral_code = public.gen_referral_code() where referral_code is null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null,
  referee_id uuid not null unique,
  code text not null,
  utm_source text,
  utm_medium text,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;
drop policy if exists referrals_read_own on public.referrals;
create policy referrals_read_own on public.referrals for select to authenticated using (referrer_id = auth.uid() or public.is_app_admin());

insert into public.app_settings (key, value)
values ('referral', '{"reward_enabled": false, "reward_days": 7, "max_rewards_per_referrer": 5}'::jsonb)
on conflict (key) do nothing;

create or replace function public.claim_referral(p_code text, p_utm_source text default null, p_utm_medium text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_ref uuid; v_created timestamptz; v_cfg jsonb; v_days int; v_max int; v_n int; v_reward boolean := false;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if me is null then return jsonb_build_object('status', 'not_signed_in'); end if;
  if v_code !~ '^[A-Z0-9]{6,8}$' then return jsonb_build_object('status', 'bad_code'); end if;
  select created_at into v_created from public.profiles where id = me;
  if v_created is null then return jsonb_build_object('status', 'no_profile'); end if;
  if v_created < now() - interval '7 days' then return jsonb_build_object('status', 'too_old'); end if;
  if exists (select 1 from public.referrals where referee_id = me) then return jsonb_build_object('status', 'already'); end if;
  select id into v_ref from public.profiles where referral_code = v_code;
  if v_ref is null then return jsonb_build_object('status', 'unknown_code'); end if;
  if v_ref = me then return jsonb_build_object('status', 'self'); end if;

  insert into public.referrals (referrer_id, referee_id, code, utm_source, utm_medium)
  values (v_ref, me, v_code, left(p_utm_source, 40), left(p_utm_medium, 40));
  update public.profiles set referred_by = v_ref where id = me and referred_by is null;

  select value into v_cfg from public.app_settings where key = 'referral';
  if coalesce((v_cfg ->> 'reward_enabled')::boolean, false) then
    v_days := greatest(1, least(coalesce((v_cfg ->> 'reward_days')::int, 7), 30));
    v_max  := greatest(0, coalesce((v_cfg ->> 'max_rewards_per_referrer')::int, 5));
    select count(*) into v_n from public.referrals where referrer_id = v_ref and rewarded_at is not null;
    if v_n < v_max then
      update public.profiles
         set plan = 'premium',
             plan_until = case when coalesce(plan, 'free') <> 'free' and plan_until is not null and plan_until > now()
                               then plan_until + make_interval(days => v_days)
                               else now() + make_interval(days => v_days) end
       where id = v_ref;
      update public.referrals set rewarded_at = now() where referee_id = me;
      v_reward := true;
    end if;
  end if;
  return jsonb_build_object('status', 'ok', 'rewarded', v_reward);
end;
$$;
revoke execute on function public.claim_referral(text, text, text) from public, anon;
grant  execute on function public.claim_referral(text, text, text) to authenticated;

create or replace function public.my_referral_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); v jsonb;
begin
  if me is null then return null; end if;
  select jsonb_build_object(
    'code', (select referral_code from public.profiles where id = me),
    'total', (select count(*) from public.referrals where referrer_id = me),
    'rewarded', (select count(*) from public.referrals where referrer_id = me and rewarded_at is not null),
    'friends', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('initial', upper(left(coalesce(nullif(btrim(p.full_name), ''), '?'), 1)), 'at', r.created_at, 'rewarded', r.rewarded_at is not null) as x
        from public.referrals r left join public.profiles p on p.id = r.referee_id
        where r.referrer_id = me order by r.created_at desc limit 50) t)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.my_referral_stats() from public, anon;
grant  execute on function public.my_referral_stats() to authenticated;

create or replace function public.admin_top_referrers(p_limit integer default 20)
returns table(referrer_id uuid, code text, referrals bigint, rewarded bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'admin only'; end if;
  return query
  select r.referrer_id, max(r.code), count(*), count(*) filter (where r.rewarded_at is not null), max(r.created_at)
  from public.referrals r group by r.referrer_id order by count(*) desc, max(r.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;
revoke execute on function public.admin_top_referrers(integer) from public, anon;
grant  execute on function public.admin_top_referrers(integer) to authenticated;

commit;
