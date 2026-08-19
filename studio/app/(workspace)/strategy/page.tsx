"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { StrategyWorkspace } from "@/features/strategy/components/strategy-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function StrategyPage() {
  const [sessions, setSessions] = useState<Tables<"strategy_sessions">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.strategy.listSessions().then(setSessions);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">AI Strategy Room</h1>
        <p className="text-sm text-secondary/50">
          ถามคำถามกลยุทธ์ธุรกิจครั้งเดียว ให้ AI ระดับ frontier หลายตัวช่วยคิดพร้อมกันแบบเทียบคำตอบข้างกัน
        </p>
      </div>
      {sessions ? <StrategyWorkspace initialSessions={sessions} onSessionsChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
