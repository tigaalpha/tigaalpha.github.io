-- Level 5 Wave 2, chunk 1: lets a task created from a CEO Agent
-- recommendation trace back to the workflow run that suggested it, so a
-- future CEO Agent run can tell whether a past recommendation was acted
-- on (see _shared/agent-memory.ts). Nullable, additive -- existing tasks
-- rows are unaffected.

alter table tasks add column source_workflow_run_id uuid references agent_workflow_runs (id) on delete set null;
