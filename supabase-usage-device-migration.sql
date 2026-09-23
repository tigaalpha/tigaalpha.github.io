-- ─────────────────────────────────────────────────────────────────────────────
-- Usage-device analytics migration (additive + re-runnable)
--
-- Client side (already shipped in local-identity.ts / shared-infra.ts /
-- landing/land-log.ts) now stamps every usage_events row with:
--   dev    — phone | tablet | desktop  (classified ONCE per visit, stored in
--            localStorage so a rotating tablet can't split its own rows)
--   dev_w  — window.innerWidth at first paint, clamped 200..4000
--
-- This migration is the backend half:
--   1. columns + index  (if not exists — safe to run on a live table)
--   2. admin_device_mix() — per-device people + events + median/avg session
--      time, split signed-in vs signed-out (user_id null = signed-out). This
--      is the split the owner asked for: BOTH groups land in the same rows,
--      so both are visible without login.
--   3. admin_device_widths() — the width histogram, so "iPad 4 octaves,
--      desktop 6-8" can be checked against what people actually open the app
--      on instead of guessed.
--
-- Every RPC is gated to is_top_admin() (admin_tier >= 3, the owner only),
-- same as the rest of the admin analytics family.
--
-- Matches the style of the other supabase-*.sql files: if-not-exists / or
-- replace, safe to run repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. columns + index ──────────────────────────────────────────────────────
alter table public.usage_events add column if not exists dev text;
alter table public.usage_events add column if not exists dev_w integer;

create index if not exists usage_events_dev_idx on public.usage_events (dev, created_at desc);

-- ── 2. device mix: people, events and session time per device ──────────────
-- "People" is distinct anon_id — usage_events has carried anon_id on every row
-- (signed-in or not) since the anonymous-visitors migration, and a person keeps
-- the same anon_id before AND after they sign up, so the same human is never
-- double-counted across the login split.
create or replace function public.admin_device_mix(p_since timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;
  return jsonb_build_object(
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dev',      t.dev,
        'people',   t.people,
        'signed_in', t.signed_in,
        'signed_out', t.signed_out,
        'events',   t.events,
        'page_ms',  t.page_ms,
        'med_ms',   t.med_ms))
      from (
        select coalesce(e.dev, '?') as dev,
               count(distinct e.anon_id) as people,
               count(*) filter (where e.user_id is not null) as signed_in,
               count(*) filter (where e.user_id is null) as signed_out,
               count(*) as events,
               coalesce(sum(e.duration_ms), 0) as page_ms,
               coalesce(percentile_cont(0.5) within group (order by e.duration_ms)
                        filter (where e.duration_ms is not null), 0) as med_ms
        from public.usage_events e
        where (p_since is null or e.created_at >= p_since)
        group by coalesce(e.dev, '?')
        order by count(distinct e.anon_id) desc
      ) t), '[]'::jsonb),
    'total_people', coalesce((select count(distinct anon_id) from public.usage_events
                              where (p_since is null or created_at >= p_since)), 0),
    'webviews_people', coalesce((select count(distinct anon_id) from public.usage_events
                                 where (p_since is null or created_at >= p_since)
                                   and ua like '%webview%'), 0)
  );
end;
$$;

revoke execute on function public.admin_device_mix(timestamptz) from public, anon;
grant execute on function public.admin_device_mix(timestamptz) to authenticated;

-- ── 3. screen-width histogram: what people actually open the app on ────────
-- Buckets line up with the piano-key layout decision this data was collected
-- for (phone stays as-is; tablet 4 octaves; desktop 6-8), and the median width
-- inside each bucket is the number to design against.
create or replace function public.admin_device_widths(p_since timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_top_admin() then
    raise exception 'top admin only';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'bucket',   t.bucket,
      'people',   t.people,
      'events',   t.events,
      'med_w',    t.med_w)), '[]'::jsonb)
  from (
    select case
             when e.dev_w is null then '?'
             when e.dev_w < 400 then '<400 (มือถือแนวตั้ง)'
             when e.dev_w < 600 then '400-599 (มือถือแนวนอน)'
             when e.dev_w < 900 then '600-899 (แท็บเล็ต)'
             else '900+ (เดสก์ท็อป)'
           end as bucket,
           count(distinct e.anon_id) as people,
           count(*) as events,
           coalesce(percentile_cont(0.5) within group (order by e.dev_w)
                    filter (where e.dev_w is not null), 0) as med_w
    from public.usage_events e
    where (p_since is null or e.created_at >= p_since)
    group by 1
    order by min(coalesce(e.dev_w, 0))
  ) t);
end;
$$;

revoke execute on function public.admin_device_widths(timestamptz) from public, anon;
grant execute on function public.admin_device_widths(timestamptz) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST after applying (as the owner account, admin_tier >= 3):
-- 1. select jsonb_pretty(public.admin_device_mix(now() - interval '7 days'));
--    -> { devices: [...{dev, people, signed_in, signed_out, ...}], total_people, webviews_people }
--    Rows written before this migration show dev='?' and are counted in
--    people/events but not in any device bucket name you'd act on — expected.
-- 2. select jsonb_pretty(public.admin_device_widths(now() - interval '7 days'));
--    -> [...{bucket, people, events, med_w}]
-- 3. As a NON-admin account: select public.admin_device_mix(null);
--    -> must FAIL (permission denied), never return rows.
-- ═══════════════════════════════════════════════════════════════════════════
