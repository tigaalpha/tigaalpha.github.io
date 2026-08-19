-- Solo Founder priority 3: bulk_update_sales_status owner tool files an
-- approval request instead of executing directly (same pattern as
-- cancel_paid_lesson) -- needs a new approval_type value, same mechanism
-- ai_drafted_message was added with in 0057_ai_workforce.sql.

alter type approval_type add value if not exists 'bulk_sales_status_change';
