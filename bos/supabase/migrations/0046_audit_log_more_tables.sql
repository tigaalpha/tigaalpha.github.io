-- Level 1 hardening: extend the existing log_audit_event() trigger (from
-- 0011, extended to transactions in 0045) to the remaining sensitive,
-- owner/admin-relevant tables that were never wired in.

create trigger profiles_audit
  after insert or update or delete on profiles
  for each row execute function log_audit_event();

create trigger approval_requests_audit
  after insert or update or delete on approval_requests
  for each row execute function log_audit_event();

create trigger ad_campaigns_audit
  after insert or update or delete on ad_campaigns
  for each row execute function log_audit_event();

create trigger legal_documents_audit
  after insert or update or delete on legal_documents
  for each row execute function log_audit_event();
