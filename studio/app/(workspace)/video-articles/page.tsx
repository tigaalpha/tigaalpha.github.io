"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { VideoScriptManager } from "@/features/video/components/video-script-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function VideoArticlesPage() {
  const [scripts, setScripts] = useState<Tables<"video_scripts">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.videoScripts.list().then(setScripts);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Video Articles</h1>
        <p className="text-sm text-secondary/50">เขียนสคริปต์สำหรับวิดีโอแนวตั้ง (TikTok / Reels / Shorts)</p>
      </div>
      {scripts ? <VideoScriptManager scripts={scripts} onChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
