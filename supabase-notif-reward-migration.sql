-- ─────────────────────────────────────────────────────────────────────────────
-- Notification sign-up reward: turn on notifications → 10,000 coins + 10,000 gems
--
-- STATUS: APPLIED 2026-09-25 on project gsaqgbracxnucdmtmcxz with the owner's
-- explicit approval (AGENTS.md hard rule).
--
-- Additive + server-gated, per the repo's currency rules:
--   * credits with coins = coins + 10000 / gems = gems + 10000 (never a client value)
--   * only if the caller really has a push subscription (push_subscriptions row)
--   * once per account, ever — notif_reward_claims has one row per user (PK)
-- The existing clamp/protect triggers only block writes made as the
-- 'authenticated' role, so this SECURITY DEFINER function credits normally,
-- the same way grant_practice_gem / grant_quiz_gem do.
-- Re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notif_reward_claims (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins int not null,
  gems int not null,
  claimed_at timestamptz not null default now()
);
alter table public.notif_reward_claims enable row level security;
drop policy if exists notif_reward_claims_self on public.notif_reward_claims;
create policy notif_reward_claims_self on public.notif_reward_claims
  for select to authenticated using (user_id = auth.uid());

-- { ok, reason?, coins, gems } — reason: 'not_signed_in' | 'no_subscription' | 'already_claimed'
create or replace function public.claim_notif_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_ins int; v_c int; v_g int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if not exists (select 1 from public.push_subscriptions where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'no_subscription');
  end if;
  insert into public.notif_reward_claims (user_id, coins, gems) values (v_uid, 10000, 10000)
  on conflict (user_id) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    select coins, gems into v_c, v_g from public.profiles where id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'already_claimed', 'coins', coalesce(v_c,0), 'gems', coalesce(v_g,0));
  end if;
  update public.profiles set coins = coalesce(coins, 0) + 10000, gems = coalesce(gems, 0) + 10000
   where id = v_uid returning coins, gems into v_c, v_g;
  return jsonb_build_object('ok', true, 'coins', v_c, 'gems', v_g);
end $$;
revoke all on function public.claim_notif_reward() from public;
grant execute on function public.claim_notif_reward() to authenticated;

-- has this account already claimed? (for hiding the invite)
create or replace function public.notif_reward_claimed() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.notif_reward_claims where user_id = auth.uid());
$$;
grant execute on function public.notif_reward_claimed() to authenticated;
