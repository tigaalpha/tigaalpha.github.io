-- Knowledge contributions — docs/09 layer 1, plan-v3 m26: the STORE and the
-- adult-approval page behind the contribution gate (tigamodel/compliance/
-- contribution-gate.js, m25). The gate decides legality and format; this file
-- only gives the decision somewhere to live and makes sure a MODEL can never
-- approve anything on its own.
--
-- ⚠️ NOT APPLIED. Run it only after the owner approves it in the conversation
-- (repo hard rule: no migration reaches the live project unasked). Re-running
-- it is a no-op, so a later apply needs no rollback.
--
-- WHAT IT ADDS (nothing existing is touched):
--   1. knowledge_contributions — one row per submitted piece of knowledge,
--      status pending / approved / rejected, plus the gate's verdict, its
--      reasons, the license and the source the contributor declared.
--   2. RLS: a contributor reads ONLY their own submissions; INSERT only their
--      own row and only with status 'pending' — a client cannot insert an
--      already-approved contribution, and UPDATE/DELETE are never allowed.
--   3. admin_* RPCs (security definer, gated on the existing admin guards):
--      a queue to read, one function to approve/reject with a written reason,
--      and the count for the badge. Approval is a HUMAN decision, recorded
--      with who decided and why.
--   4. A trigger that stamps reviewed_at/reviewed_by/review_note whenever the
--      status leaves 'pending', so an approval can never be an anonymous edit.
--
-- DESIGN RULES HONORED (docs/09 §1, repo hard rules):
--   * the model has no path into this table at all: no client UPDATE, no
--     client-chosen status, no client-chosen reviewer
--   * append-only in spirit: a rejected row keeps its reasons for the audit
--   * additive + re-runnable throughout (if-not-exists / or-replace)
--
-- VERIFICATION after applying (run these three):
--   -- 1. the table exists with the three statuses
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='knowledge_contributions'
--    order by ordinal_position;
--   -- expect: status | text, license | text, gate_reasons | jsonb,
--   --         reviewed_by | uuid, reviewed_at | timestamptz
--   -- 2. an ordinary learner CANNOT write a status other than 'pending'
--   insert into knowledge_contributions
--     (contributor_id, title, body, domain, license, source_kind, status)
--   values (auth.uid(), 'ทดสอบ', 'เนื้อหาทดสอบ', 'pedagogy',
--           'contributor-own-work', 'own-work', 'approved');
--   -- expect: ERROR new row violates row-level security policy
--   -- 3. the queue RPC refuses a non-admin
--   select * from admin_contributions_queue();
--   -- expect: ERROR admin only
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. the table ────────────────────────────────────────────────────────────
create table if not exists public.knowledge_contributions (
  id            uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),

  -- what was proposed (the same shape contribution-gate.js reviews)
  title         text not null,
  body          text not null,
  teach         text,
  domain        text not null default 'pedagogy',

  -- what the contributor declared — the gate's input, kept verbatim for audit
  license       text not null,
  source_kind   text not null,                 -- 'own-work' | 'public-fact'
  source_url    text,
  source_excerpt text,

  -- what the gate said (deterministic; reasons are Thai, one per failed check)
  gate_verdict  text not null default 'clean', -- 'clean' | 'rejected'
  gate_reasons  jsonb not null default '[]'::jsonb,
  gate_checks   jsonb not null default '{}'::jsonb,

  -- the human decision. DEFAULT 'pending' and the RLS below forbids a client
  -- from choosing anything else — only admin_moderate_contribution() moves it.
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  review_note   text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz
);

create index if not exists knowledge_contributions_contributor_idx
  on public.knowledge_contributions (contributor_id, created_at desc);
create index if not exists knowledge_contributions_status_idx
  on public.knowledge_contributions (status, created_at desc);

-- ── 2. RLS: own rows in, own rows out, nothing editable ─────────────────────
alter table public.knowledge_contributions enable row level security;

drop policy if exists "knowledge_contributions insert own pending" on public.knowledge_contributions;
create policy "knowledge_contributions insert own pending" on public.knowledge_contributions
  for insert to authenticated
  with check (
    contributor_id = auth.uid()
    and status = 'pending'                 -- a client can never pre-approve
    and coalesce(length(trim(title)), 0) > 0
    and coalesce(length(trim(body)), 0) > 0
  );

drop policy if exists "knowledge_contributions select own" on public.knowledge_contributions;
create policy "knowledge_contributions select own" on public.knowledge_contributions
  for select to authenticated
  using (contributor_id = auth.uid());

-- no UPDATE and no DELETE policy on purpose: a contribution's verdict is a
-- record, not an editable field. Admins act through the RPC below.

-- ── 3. the review stamp: an approval is never an anonymous edit ─────────────
create or replace function public.stamp_contribution_review()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from 'pending'
     and (new.reviewed_at is null or new.reviewed_by is null) then
    new.reviewed_at = coalesce(new.reviewed_at, now());
    new.reviewed_by = coalesce(new.reviewed_by, auth.uid());
  end if;
  return new;
end; $$;

drop trigger if exists knowledge_contributions_review_stamp on public.knowledge_contributions;
create trigger knowledge_contributions_review_stamp
  before update on public.knowledge_contributions
  for each row execute function public.stamp_contribution_review();

-- ── 4. the admin side: queue, count, and the one decision function ──────────
-- is_app_admin() / is_top_admin() already exist in this project; the gate below
-- mirrors the pattern every other admin RPC uses, so this file adds no new
-- notion of "who is an admin".

create or replace function public.admin_contributions_queue(
  p_status text default 'pending',
  p_limit  int  default 50
)
returns table (
  id            uuid,
  contributor_id uuid,
  created_at    timestamptz,
  title         text,
  body          text,
  teach         text,
  domain        text,
  license       text,
  source_kind   text,
  source_url    text,
  gate_verdict  text,
  gate_reasons  jsonb,
  status        text,
  review_note   text,
  reviewed_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.contributor_id, c.created_at, c.title, c.body, c.teach, c.domain,
         c.license, c.source_kind, c.source_url, c.gate_verdict, c.gate_reasons,
         c.status, c.review_note, c.reviewed_at
    from public.knowledge_contributions c
   where (p_status is null or trim(p_status) = '' or c.status = p_status)
   order by c.created_at asc                     -- oldest first: nobody starves
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.admin_contributions_count()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pending',  (select count(*) from public.knowledge_contributions where status = 'pending'),
    'approved', (select count(*) from public.knowledge_contributions where status = 'approved'),
    'rejected', (select count(*) from public.knowledge_contributions where status = 'rejected')
  );
$$;

-- The ONLY way a status changes. Additive by nature (it writes the columns the
-- trigger stamps), and it refuses a decision without a written reason: a
-- contributor whose work was turned down can always read why.
create or replace function public.admin_moderate_contribution(
  p_id     uuid,
  p_status text,
  p_note   text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tier smallint;
  v_note text := trim(coalesce(p_note, ''));
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;
  if v_note = '' then
    raise exception 'a written reason is required (review_note)';
  end if;

  select coalesce(admin_tier, 0) into v_tier from public.profiles where id = auth.uid();
  if coalesce(v_tier, 0) < 1 then raise exception 'admin only'; end if;

  update public.knowledge_contributions
     set status = p_status,
         review_note = v_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id and status = 'pending';

  if not found then
    raise exception 'contribution not found or already reviewed';
  end if;
end; $$;

-- ── VERIFICATION tail (expected after apply) ───────────────────────────────
-- select public.admin_contributions_count();
--   -> {"approved":0,"pending":0,"rejected":0} on a fresh table
-- select count(*) from pg_policies where tablename = 'knowledge_contributions';
--   -> 2 (insert own pending + select own) — an UPDATE/DELETE policy here would
--      mean the table is editable by a client, which is the bug to catch.