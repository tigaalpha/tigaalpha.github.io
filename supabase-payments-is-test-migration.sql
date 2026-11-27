-- supabase-payments-is-test-migration.sql
--
-- NOT APPLIED. Written 2026-11-26 (Step 3.3). Run only with the owner's explicit approval for THIS file (AGENTS.md hard rule).
-- Optional: the admin Payments page already works without it (it marks a row as "test" when its amount is 0 and as "admin" when it belongs to an admin account). This column lets the owner mark a
-- real-money test (for example the 799 THB card test from the Step 3.2 checklist, or a refunded one) so it never counts as a customer.
--
-- What it does, in one transaction: adds public.payments.is_test boolean not null default false and backfills it to true for rows with amount = 0. Nothing else is touched.
-- To mark a row afterwards (owner only, in the SQL editor): update public.payments set is_test = true where id = '<payment id>';
-- To undo: alter table public.payments drop column is_test;

begin;

alter table public.payments add column if not exists is_test boolean not null default false;
update public.payments set is_test = true where coalesce(amount, 0) = 0 and is_test = false;
comment on column public.payments.is_test is 'true = not a customer payment (a test or a zero-amount row); the admin Payments page leaves these out of the totals';

commit;
