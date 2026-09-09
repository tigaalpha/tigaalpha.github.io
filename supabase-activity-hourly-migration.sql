-- ─────────────────────────────────────────────────────────────────────────────
-- Activity-by-hour migration (additive + re-runnable)
--
-- Adds ONE new RPC: admin_activity_hourly(p_since, p_include_sim) → jsonb
--   { hours: [ { h: 0..23, events, users, time_ms }, ... 24 rows always ] }
--
-- Purpose: the owner asked the admin console's User Activity panel to also show
-- WHAT TIME OF DAY users come in ("อยากให้มีบอกด้วยว่าเข้ามาตอนเวลาไหนในแต่ละวัน").
-- This buckets usage_events by hour and, per hour, returns:
--   events  — how many tracked events happened
--   users   — how many DISTINCT users were active
--   time_ms — total page-dwell time credited to that hour
--
-- Hour bucketing is done in Asia/Bangkok wall-clock time (the audience is
-- Thai; the admin reads the chart in Bangkok time). This is stated in the UI
-- label so there is no ambiguity.
--
-- Gated: is_top_admin() (admin_tier >= 3, owner only) — same guard pattern as
-- admin_sim_config/sim_purge. Execute is additionally revoked from anon so the
-- function is not even callable signed-out.
--
-- No table or column changes. Does not touch any existing function.
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_activity_hourly(
  p_since timestamptz default null,
  p_include_sim boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;

  return jsonb_build_object(
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'h', s.h,
               'events', coalesce(c.events, 0),
               'users',  coalesce(c.users, 0),
               'time_ms', coalesce(c.time_ms, 0)
             ) order by s.h)
      from generate_series(0, 23) as s(h)
      left join (
        select
          extract(hour from (created_at at time zone 'Asia/Bangkok'))::int as h,
          count(*)::bigint                       as events,
          count(distinct user_id)::bigint        as users,
          coalesce(sum(duration_ms), 0)::bigint  as time_ms
        from public.usage_events
        where (p_since is null or created_at >= p_since)
          and (p_include_sim or not simulated)
        group by 1
      ) c on c.h = s.h
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_activity_hourly(timestamptz, boolean) from anon;
grant  execute on function public.admin_activity_hourly(timestamptz, boolean) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying (as the owner account):
--   select admin_activity_hourly(null, true);
-- -- expect: {"hours":[{h:0,...},...]} — exactly 24 entries, h 0..23.
--   select admin_activity_hourly(null, true) from (select 1) where not is_top_admin();
-- -- as a NON-admin: the RPC must raise 'top admin only'.
-- ═════════════════════════════════════════════════════════════════════════════
