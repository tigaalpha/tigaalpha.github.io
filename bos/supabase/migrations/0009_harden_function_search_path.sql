-- Pin search_path on all functions to close the "role mutable search_path"
-- security advisory (prevents search_path hijacking via session settings).

alter function set_updated_at() set search_path = public;
alter function bookings_no_overlap() set search_path = public;
alter function match_knowledge_chunks(vector, int, float) set search_path = public;
alter function is_staff() set search_path = public;
alter function is_owner_or_admin() set search_path = public;
alter function apply_completed_booking() set search_path = public;
