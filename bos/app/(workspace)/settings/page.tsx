"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { TeachersManager } from "@/features/settings/components/teachers-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function SettingsPage() {
  const [teachers, setTeachers] = useState<Tables<"teachers">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.teachers.listActive().then(setTeachers);
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
            <CardTitle>AI Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-secondary/70">
            <p>AI provider, model, and integration credentials are configured as Supabase Edge Function secrets — never shipped to the browser.</p>
            <p>See <code className="rounded bg-line/5 px-1 py-0.5 text-xs">supabase/functions/*</code> and the README for the full list (AI_PROVIDER, AI_MODEL, GEMINI_API_KEY, GOOGLE_*, LINE_*).</p>
            <p>Edit AI behavior by updating the markdown files in <code className="rounded bg-line/5 px-1 py-0.5 text-xs">/prompts</code> and redeploying the Edge Functions — no frontend rebuild required.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
