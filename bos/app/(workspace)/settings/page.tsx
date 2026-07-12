"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { TeachersManager } from "@/features/settings/components/teachers-manager";
import { AuditLogCard } from "@/features/settings/components/audit-log-card";
import { IntegrationsCard } from "@/features/settings/components/integrations-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function SettingsPage() {
  const [teachers, setTeachers] = useState<Tables<"teachers">[] | null>(null);
  const [auditLog, setAuditLog] = useState<Tables<"audit_log">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.teachers.listActive().then(setTeachers);
    repos.audit.listRecent(50).then(setAuditLog);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Settings</h1>
        <p className="text-sm text-secondary/50">Studio configuration</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {teachers ? <TeachersManager teachers={teachers} onChanged={reload} /> : <Skeleton className="h-48" />}

        <Card>
          <CardHeader>
            <CardTitle>Prompt Editing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-secondary/70">
            <p>Edit AI behavior by updating the markdown files in <code className="rounded bg-line/5 px-1 py-0.5 text-xs">/prompts</code> and redeploying the Edge Functions — no frontend rebuild required.</p>
            <p>For everyday teaching (pricing corrections, sales scripts, objection handling, rules, examples), use the Knowledge Base page or the &quot;Correct this reply&quot; button in Inbox instead — no code changes needed.</p>
          </CardContent>
        </Card>
      </div>

      <IntegrationsCard />

      {auditLog ? <AuditLogCard entries={auditLog} /> : <Skeleton className="h-48" />}
    </div>
  );
}
