"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { VoiceoverManager } from "@/features/video/components/voiceover-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function VoiceOverPage() {
  const [scripts, setScripts] = useState<Tables<"voiceover_scripts">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.voiceoverScripts.list().then(setScripts);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Voice Over Scripts</h1>
        <p className="text-sm text-secondary/50">เขียนบท Voice Over สำหรับวิดีโอไลฟ์สไตล์และท่องเที่ยว</p>
      </div>
      {scripts ? <VoiceoverManager scripts={scripts} onChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
