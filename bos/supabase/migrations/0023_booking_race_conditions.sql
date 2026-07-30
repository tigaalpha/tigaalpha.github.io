-- The bookings_no_overlap trigger (0003) does SELECT-then-INSERT, which is
-- not atomic under READ COMMITTED: two concurrent transactions booking the
-- same teacher/time can each pass the check before either commits, both
-- insert, and the teacher ends up double-booked. An EXCLUDE constraint is
-- enforced by Postgres itself at commit time using an index, so it can't be
-- raced — this is the real fix; the trigger stays only because it gives a
-- friendlier error message on the common (non-concurrent) case.
create extension if not exists btree_gist;

alter table bookings
  add constraint bookings_no_overlap_excl
  exclude using gist (
    teacher_id with =,
    tstzrange(start_time, end_time) with &&
  )
  where (status <> 'cancelled' and teacher_id is not null);

-- Enforce at most one currently-active course per customer at the DB level.
-- Previously nothing stopped a renewal course from being created before the
-- prior course's remaining_hour reached 0, silently orphaning its hours.
create unique index courses_one_active_per_customer
  on courses (customer_id)
  where remaining_hour > 0;
