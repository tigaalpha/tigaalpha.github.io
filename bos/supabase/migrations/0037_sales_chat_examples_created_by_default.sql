-- Confirming an example happens as a direct client insert (RLS-scoped),
-- not through an edge function, so there's no server-side requireStaff()
-- call to stamp created_by explicitly -- default it to the caller instead.
alter table sales_chat_examples alter column created_by set default auth.uid();
