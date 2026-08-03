-- The PRD originally scoped course lengths to 20/40/80 hours, but real
-- sales data (e.g. Angelica's course) includes a 10-hour package too —
-- grandfathered pricing still sold to some existing customers even though
-- new customers are only offered the 40-hour package. Widen the check
-- constraint to match actual business practice.

alter table courses drop constraint courses_total_hours_check;
alter table courses add constraint courses_total_hours_check check (total_hours in (10, 20, 40, 80));
