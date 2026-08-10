-- Priority 6, Chunk 2: let a transaction be tied to the course it's paying
-- for (renewal payments, mainly) -- transactions.customer_id already
-- existed but was never exposed anywhere in the UI; this adds the missing
-- course link so both can be recorded together. Additive only, no backfill
-- -- existing rows simply have course_id null, same as they do customer_id
-- today.

alter table transactions add column course_id uuid references courses(id) on delete set null;
