"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { TeachersManager } from "@/features/settings/components/teachers-manager";
import { AuditLogCard } from "@/features/settings/components/audit-log-card";
import { IntegrationsCard } from "@/features/settings/components/integrations-card";
import { LanguageCard } from "@/features/settings/components/language-card";
import { SafeModeCard } from "@/features/settings/components/safe-mode-card";
import { ChatbotSettingsCard } from "@/features/settings/components/chatbot-settings-card";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";
import { useLang } from "@/lib/language-context";
import { translate } from "@/lib/i18n";

export default function SettingsPage() {
  const { lang } = useLang();
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
    <OwnerOnlyGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">{translate(lang, "page.settings")}</h1>
          <p className="text-sm text-secondary/50">{translate(lang, "page.settingsSub")}</p>
        </div>

        <LanguageCard />

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

        <SafeModeCard />

        <ChatbotSettingsCard />

        <IntegrationsCard />

        {auditLog ? <AuditLogCard entries={auditLog} /> : <Skeleton className="h-48" />}
      </div>
    </OwnerOnlyGuard>
  );
}
