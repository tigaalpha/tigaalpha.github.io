-- Growth analytics for the TIGA back office (📈 การเติบโต tab)
-- ---------------------------------------------------------------------
-- Backs the Growth tab in TigamodelBackoffice: weekly signup series,
-- payer counts, revenue, and a "last seen" stamp. Read-only, no new
-- tables — everything is derived from profiles / payments which already
-- exist (supabase-payment-and-security-hardening.sql, currency-purchase).
-- Owner approved 2026-09-20 for the growth-dashboard work.
--
-- Gated to top admin (admin_tier >= 3) exactly like
-- admin_strategy_effectiveness — profiles rows are otherwise invisible
-- across users by RLS, so the aggregation must run server-side.
-- Re-runnable: create-or-replace everywhere, revoke/grant idempotent.

create or replace function public.admin_growth_overview(p_weeks int default 26)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_weeks int;
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;

  -- sanity clamp: between 4 and 104 weeks
  v_weeks := greatest(4, least(104, coalesce(p_weeks, 26)));

  return jsonb_build_object(
    'generated_at', now(),

    -- Cumulative: everyone who ever logged in
    'total_users',       (select count(*)::int from public.profiles),

    -- Weekly signup series (oldest → newest), N weeks back from now.
    -- week_start is the Monday (UTC) of each bucket.
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object(
               'week_start', w.week_start::date,
               'signups',    coalesce(s.n, 0)) order by w.week_start)
      from generate_series(
             date_trunc('week', now()) - ((v_weeks - 1) || ' weeks')::interval,
             date_trunc('week', now()),
             interval '1 week') as w(week_start)
      left join (
        select date_trunc('week', created_at) as wk, count(*) as n
        from public.profiles
        where created_at is not null
        group by 1
      ) s on s.wk = w.week_start
    ), '[]'::jsonb),

    -- Payers: distinct users with an approved payment ever
    'payers_ever',       (select count(distinct user_id)::int from public.payments where status = 'approved' and user_id is not null),

    -- Direct revenue total (THB, sums stripe + manual approved rows)
    'revenue_thb',       (select coalesce(sum(amount), 0)::numeric from public.payments where status = 'approved'),

    -- Currently-active paid plans (premium window still open)
    'active_paid_plans', (select count(*)::int from public.profiles where plan is not null and plan <> 'free' and (plan_until is null or plan_until > now())),

    -- Recent-week conversion context
    'signups_last7',     (select count(*)::int from public.profiles where created_at >= now() - interval '7 days'),
    'signups_prev7',     (select count(*)::int from public.profiles
                          where created_at >= now() - interval '14 days'
                            and created_at <  now() - interval '7 days'),

    -- Engagement proxy: how many users were seen recently
    'active_last7',      (select count(*)::int from public.profiles where last_active >= now() - interval '7 days'),
    'active_prev7',      (select count(*)::int from public.profiles
                          where last_active >= now() - interval '14 days'
                            and last_active <  now() - interval '7 days')
  );
end;
$$;

revoke execute on function public.admin_growth_overview(int) from public, anon;
grant execute on function public.admin_growth_overview(int) to authenticated;
