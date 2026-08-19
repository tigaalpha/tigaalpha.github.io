-- Automatic hour tracking: when a booking transitions to 'completed',
-- the linked course's current_hour +1 / remaining_hour -1.
-- When current_hour reaches total_hours, the customer moves to renew_pending
-- and an ai_needs_review-free 'customer_near_end_course' notification fires
-- one lesson before completion (remaining_hour = 1), per the renewal PRD flow.

create or replace function apply_completed_booking() returns trigger as $$
declare
  v_course courses%rowtype;
begin
  if new.status <> 'completed' or old.status = 'completed' or new.course_id is null then
    return new;
  end if;

  select * into v_course from courses where id = new.course_id for update;
  if not found then
    return new;
  end if;

  if v_course.remaining_hour <= 0 then
    raise exception 'Course % has no remaining hours to consume', v_course.id;
  end if;

  update courses
  set current_hour = current_hour + 1,
      remaining_hour = remaining_hour - 1
  where id = v_course.id;

  if v_course.remaining_hour - 1 = 1 then
    insert into notifications (type, title, body, customer_id, booking_id)
    values (
      'customer_near_end_course',
      'Customer nearing course completion',
      'One lesson remaining — prepare renewal offer.',
      v_course.customer_id,
      new.id
    );
  elsif v_course.remaining_hour - 1 = 0 then
    update customers set sales_status = 'renew_pending' where id = v_course.customer_id;
    insert into notifications (type, title, body, customer_id, booking_id)
    values (
      'customer_near_end_course',
      'Course completed — renewal needed',
      'Final lesson done. AI should request renewal.',
      v_course.customer_id,
      new.id
    );
  end if;

  return new;
end;
$$ language plpgsql;

create trigger bookings_apply_completed
  after update on bookings
  for each row execute function apply_completed_booking();
