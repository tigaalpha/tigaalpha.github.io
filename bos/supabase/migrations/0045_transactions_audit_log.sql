-- Level 1 hardening: transactions is the most sensitive owner/admin-only
-- table (real money) but was never wired into the audit_log trigger from
-- 0011_audit_log_triggers.sql — extend the existing log_audit_event()
-- function to it so every income/expense create, edit, and delete is
-- attributed and diffed like customers/bookings/courses already are.

create trigger transactions_audit
  after insert or update or delete on transactions
  for each row execute function log_audit_event();
