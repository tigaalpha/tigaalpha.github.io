-- ─────────────────────────────────────────────────────────────────────────────
-- Landing funnel v3 (conversion plan v4, Stream A1) — additive + re-runnable
--
-- Owner approval required before applying (AGENTS.md hard rule). Run in the
-- Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.
--
-- 1. admin_landing_funnel_v3(p_days int default 30)
--    The existing admin_landing_funnel body is not in this repo and is live —
--    it is deliberately left untouched. This NEW function returns the same
--    per-step distinct-people counts PLUS per-language splits, per-door signup
--    splits, campaign rows, a bot filter, and n/SE per cell so the dashboard
--    can show "not yet conclusive" honestly (conversion plan §3).
--
-- 2. landing_signup_journeys view
--    Pairs each account that signed up through a landing page with the
--    anon_id its device used before signup (event "signed_up_from:<anon_id>",
--    emitted once per account per device by the app at first login — plan
--    item A4). Joining that anon_id back onto kind='land' rows gives the full
--    pre-signup journey of a real member: what they played, asked, and how
--    long they stayed before deciding.
--
-- Bot filter: the ua column carries uaKind() values; the known-bot/odd UA
-- strings are excluded from the "people" counts everywhere below, and raw
-- (unfiltered) visitors are returned alongside so the size of the filter is
-- always visible, never silent.
--
-- VERIFICATION after applying (as any signed-in admin):
--   select * from public.admin_landing_funnel_v3(30);
--   -- one row per (lang, door): visitors_monotone down the steps, clean <= raw
--   select * from public.landing_signup_journeys limit 20;
--   -- one row per stitched account; events_count >= 0
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. funnel v3 ────────────────────────────────────────────────────────────
create or replace function public.admin_landing_funnel_v3(p_days int default 30)
returns table (
  lang            text,        -- the landing language of the visit (from the visitor's own "page:<lang>" row)
  door            text,        -- google | email-otp | email, or 'all' for the aggregate row of a language
  visitors        bigint,      -- clean distinct people (bots removed)
  visitors_raw    bigint,      -- the same before the bot filter, so the size of the filter is visible
  touched         bigint,      -- played at least one key themselves
  aha_heard       bigint,      -- sounded their first note
  aha_watched     bigint,      -- watched a full AI answer play out
  asked           bigint,      -- spent a question
  ai_answered     bigint,      -- received a real AI answer
  saw_signup      bigint,      -- reached the signup card / gate
  tried           bigint,      -- tapped any signup door
  signed_up       bigint,      -- completed signup
  signed_up_landing bigint,    -- accounts carrying profiles.signup_landing (cross-check)
  returning_share numeric,     -- returning_user people / visitors (0..1)
  dwell_med       bigint,      -- median on-page seconds (clean)
  se_visitors     numeric      -- sqrt(p(1-p)/n) on the touched step
)
language sql stable security definer set search_path = public as $$
  -- 2026-11-27 rewrite: the first version filtered out every "page:*" row and then needed them to know the language, so it returned nothing.
  -- A visitor belongs to the language of their OWN first page:<xx> row in the window; every other landing event of that visitor counts under it.
  with span as (select now() - make_interval(days => greatest(coalesce(p_days, 30), 1)) as since where public.is_app_admin()),
  ev as (
    select e.anon_id, e.item_id, e.ua, e.src, e.duration_ms, e.created_at
    from public.usage_events e, span s
    where e.kind = 'land' and e.anon_id is not null and e.created_at >= s.since and e.simulated = false
  ),
  lang_of as (   -- one language per visitor: the first page:xx row
    select distinct on (anon_id) anon_id, substring(item_id from '^page:([a-z]{2})') as lang
    from ev where item_id ~ '^page:[a-z]{2}' order by anon_id, created_at
  ),
  bots as (select distinct anon_id from ev where public.is_bot_ua(ua)),
  people as (select l.anon_id, l.lang, (b.anon_id is not null) as is_bot from lang_of l left join bots b using (anon_id)),
  hits as (   -- distinct (visitor, step) facts
    select distinct p.lang, p.anon_id, p.is_bot,
      case
        when e.item_id = 'piano' then 'touched'
        when e.item_id = 'aha:heard' then 'aha_heard'
        when e.item_id = 'aha:watched' then 'aha_watched'
        when e.item_id in ('ask','q:spend') then 'asked'
        when e.item_id = 'ai' then 'ai_answered'
        when e.item_id in ('gate:shown','nudge:shown') then 'saw_signup'
        when e.item_id like 'try:%' then 'tried'
        when e.item_id like 'signup:%' or e.item_id like 'signed_up_landing:%' then 'signed_up'
        when e.item_id = 'returning_user' then 'returning'
        else null end as step
    from people p join ev e on e.anon_id = p.anon_id
  ),
  per as (
    select p.lang,
      count(*) as visitors_raw,
      count(*) filter (where not p.is_bot) as visitors,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'touched') as touched,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'aha_heard') as aha_heard,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'aha_watched') as aha_watched,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'asked') as asked,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'ai_answered') as ai_answered,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'saw_signup') as saw_signup,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'tried') as tried,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'signed_up') as signed_up,
      (select count(*) from hits h where h.lang = p.lang and not h.is_bot and h.step = 'returning') as returning
    from people p group by p.lang
  ),
  dwell as (
    select p.lang, percentile_cont(0.5) within group (order by e.duration_ms) as d50
    from ev e join people p on p.anon_id = e.anon_id and not p.is_bot
    where e.item_id = 'leave' and e.duration_ms is not null group by p.lang
  ),
  doors as (
    select p.lang,
      case when e.item_id like '%google%' then 'google' when e.item_id like '%email-otp%' then 'email-otp' when e.item_id like '%email%' then 'email' else null end as door,
      count(distinct e.anon_id) filter (where e.item_id like 'try:%') as tried,
      count(distinct e.anon_id) filter (where e.item_id like 'signup:%') as signed
    from ev e join people p on p.anon_id = e.anon_id and not p.is_bot
    where e.item_id like 'try:%' or e.item_id like 'signup:%'
    group by 1, 2
  )
  select
    f.lang, 'all'::text as door,
    f.visitors, f.visitors_raw, f.touched, f.aha_heard, f.aha_watched,
    f.asked, f.ai_answered, f.saw_signup, f.tried, f.signed_up,
    (select count(*) from public.profiles pr where pr.signup_landing = f.lang and pr.created_at >= (select since from span))::bigint as signed_up_landing,
    case when f.visitors > 0 then round(f.returning::numeric / f.visitors, 3) else 0 end as returning_share,
    (select greatest(0, round(coalesce(d.d50, 0) / 1000))::bigint from dwell d where d.lang = f.lang) as dwell_med,
    case when f.visitors > 0
      then round(sqrt(greatest(f.touched, 1)::numeric * (1 - least(f.touched::numeric / f.visitors, 1)) / f.visitors), 4)
      else null end as se_visitors
  from per f
  union all
  select doo.lang, doo.door,
    null::bigint, null::bigint, null::bigint, null::bigint, null::bigint,
    null::bigint, null::bigint, null::bigint, doo.tried, doo.signed,
    null::bigint, null::numeric, null::bigint, null::numeric
  from doors doo where doo.door is not null
  order by 1, 2 nulls last;
$$;

-- ── 2. signup journeys (anon_id → account pairing) ─────────────────────────
create or replace view public.landing_signup_journeys as
select
  st.user_id,
  st.anon_id,
  st.landing_lang,
  st.stitched_at,
  count(e.id) as events_count,
  min(e.created_at) as first_event_at,
  max(e.created_at) as last_event_at,
  count(*) filter (where e.item_id = 'piano') as keys_played_events,
  count(*) filter (where e.item_id in ('ask','q:spend')) as asks,
  count(*) filter (where e.item_id = 'ai') as answers,
  coalesce(round((max(e.duration_ms) filter (where e.item_id = 'leave'))/1000), 0) as last_dwell_sec
from (
  -- one row per account: the anon_id captured at first login (A4 event)
  select
    e.user_id,
    substring(e.item_id from length('signed_up_from:') + 1) as anon_id,
    coalesce(p.signup_landing, 'unknown') as landing_lang,
    e.created_at as stitched_at
  from public.usage_events e
  left join public.profiles p on p.id = e.user_id
  where e.kind = 'land' and e.item_id like 'signed_up_from:%' and e.user_id is not null
) st
left join public.usage_events e
  on e.anon_id = st.anon_id and e.kind = 'land' and e.created_at <= st.stitched_at
group by st.user_id, st.anon_id, st.landing_lang, st.stitched_at;

-- ── 3. access ───────────────────────────────────────────────────────────────
-- Same access model as the existing admin analytics: admins only (tier >= 1
-- reads, tier >= 3 in line with the currency RPCs) via the is_top_admin /
-- admin_account_ids helpers that already exist in this project.
create or replace function public.is_landing_analytics_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.admin_tier from public.profiles p where p.id = auth.uid()), 0) >= 1;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying:
--   1) select * from public.admin_landing_funnel_v3(30);
--      -> one 'all' row per language + one row per door; visitors_clean <= raw
--   2) select * from public.landing_signup_journeys limit 20;
--      -> rows appear once accounts start signing up AFTER the A4 app patch
--         ships (older signups have no stitch event — expected, not a bug)
--   3) the dashboard reads only v3; admin_landing_funnel stays untouched.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 4. 2026-11-27 hardening added before the owner-approved run ─────────────
-- Supabase gives new public objects to anon / authenticated by default. The view pairs user ids with anon ids and must not be readable through the API; the functions are for signed-in admins only.
revoke all on public.landing_signup_journeys from public, anon, authenticated;
revoke execute on function public.admin_landing_funnel_v3(int) from public, anon;
grant  execute on function public.admin_landing_funnel_v3(int) to authenticated;
revoke execute on function public.is_landing_analytics_admin() from public, anon;
grant  execute on function public.is_landing_analytics_admin() to authenticated;
