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
  lang            text,        -- th | en | zh (from item_id "page:<lang>")
  door            text,        -- google | email-otp | email | null (aggregate rows have door = "all")
  visitors        bigint,      -- clean distinct people (bot-filtered)
  visitors_raw    bigint,      -- unfiltered, so the filter's size is visible
  touched         bigint,      -- played at least one key themselves
  aha_heard       bigint,      -- sounded their first note (B4)
  aha_watched     bigint,      -- watched a full AI answer play out (B4)
  asked           bigint,      -- spent a question
  ai_answered     bigint,      -- received a real AI answer
  saw_signup      bigint,      -- reached the signup card / gate
  tried           bigint,      -- tapped any signup door
  signed_up       bigint,      -- completed signup (email events + signup:google)
  signed_up_landing bigint,    -- accounts carrying profiles.signup_landing (cross-check)
  returning_share numeric,    -- returning_user people / visitors (0..1)
  dwell_med       bigint,      -- median on-page seconds (clean)
  se_visitors     numeric      -- sqrt(p(1-p)/n) on the touched step, for the
                               -- "not yet conclusive" display (plan §3 rule 2)
)
language sql stable security definer set search_path = public as $$
  with span as (select now() - make_interval(days => greatest(coalesce(p_days, 30), 1)) as since),
  ev as (
    select
      e.*,
      case
        when e.item_id = 'page:th' then 'th'
        when e.item_id = 'page:en' then 'en'
        when e.item_id = 'page:zh' then 'zh'
        else null
      end as page_lang,
      case
        when e.item_id like 'try:google%' or e.item_id = 'signup:google' then 'google'
        when e.item_id like 'try:email-otp%' or e.item_id = 'signup:email-otp' then 'email-otp'
        when e.item_id like 'try:email%'  or e.item_id = 'signup:email'  then 'email'
        else null
      end as door_guess
    from public.usage_events e, span s
    where e.kind = 'land'
      and e.created_at >= s.since
      and e.item_id not like 'page:%'          -- page:xx is a label, not a step
  ),
  bots as (  -- ua strings that are not people (kept in ONE place, plan §S2)
    select anon_id from ev
    where lower(coalesce(ua, '')) ~ 'bot|crawl|spider|headless|preview|slurp|curl|wget|python|okhttp|monitor|uptime'
    group by 1
  ),
  people as (  -- clean population: distinct (lang, anon_id) with a bot filter
    select distinct
      coalesce(e.page_lang, 'th') as lang,
      e.anon_id,
      (e.anon_id in (select anon_id from bots)) as is_bot
    from ev e
    where e.page_lang is not null
  ),
  per as (
    select
      p.lang,
      count(*) filter (where true) as visitors_raw,
      count(*) filter (where not p.is_bot) as visitors,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id = 'piano') as touched,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id = 'aha:heard') as aha_heard,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id = 'aha:watched') as aha_watched,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id in ('ask','q:spend')) as asked,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id = 'ai') as ai_answered,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id in ('gate:shown','nudge:shown')) as saw_signup,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id like 'try:%') as tried,
      count(distinct e.anon_id) filter (where not p.is_bot and (e.item_id like 'signup:%' or e.item_id = 'signed_up_landing:' || 'th' or e.item_id like 'signed_up_landing:%')) as signed_up,
      count(distinct e.anon_id) filter (where not p.is_bot and e.item_id = 'returning_user') as returning
    from people p
    left join ev e on e.anon_id = p.anon_id and coalesce(e.page_lang,'th') = p.lang
    group by p.lang
  ),
  dwell as (
    select coalesce(e.page_lang,'th') as lang,
      percentile_cont(0.5) within group (order by e.duration_ms) filter (where not (e.anon_id in (select anon_id from bots))) as d50
    from ev e where e.item_id = 'leave' and e.duration_ms is not null
    group by 1
  ),
  doors as (
    select coalesce(e.page_lang,'th') as lang, e.door_guess as door,
      count(distinct e.anon_id) filter (where e.item_id like 'try:%') as tried,
      count(distinct e.anon_id) filter (where e.item_id like 'signup:%') as signed
    from ev e
    where e.door_guess is not null
    group by 1, 2
  ),
  camp as (  -- campaign attribution: src column carries trafficSource()
    select coalesce(e.page_lang,'th') as lang, coalesce(nullif(trim(e.src), ''), 'direct') as src,
      count(distinct e.anon_id) as people
    from ev e, people p2
    where e.anon_id = p2.anon_id and coalesce(e.page_lang,'th') = p2.lang and not p2.is_bot
    group by 1, 2
  )
  -- one aggregate row per language (door = 'all'), then one row per door
  select
    f.lang,
    'all' as door,
    f.visitors, f.visitors_raw, f.touched, f.aha_heard, f.aha_watched,
    f.asked, f.ai_answered, f.saw_signup, f.tried, f.signed_up,
    (select count(*) from public.profiles pr
       where pr.signup_landing = f.lang
         and pr.created_at >= (select since from span)) as signed_up_landing,
    case when f.visitors > 0 then round(f.returning::numeric / f.visitors, 3) else 0 end as returning_share,
    (select greatest(0, round(coalesce(d.d50,0)/1000)) from dwell d where d.lang = f.lang) as dwell_med,
    case when f.visitors > 0
      then round(sqrt(greatest(f.touched,1)::numeric * (1 - least(f.touched::numeric / f.visitors, 1)) / f.visitors), 4)
      else null end as se_visitors
  from per f left join dwell d on d.lang = f.lang
  union all
  select
    doo.lang, doo.door,
    null::bigint, null::bigint, null::bigint, null::bigint, null::bigint,
    null::bigint, null::bigint, null::bigint, doo.tried, doo.signed,
    null::bigint, null::numeric, null::bigint, null::numeric
  from doors doo
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
    substr(e.item_id from length('signed_up_from:') + 1) as anon_id,
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
