"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { AppAdKitManager } from "@/features/app-ad-kit/components/app-ad-kit-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function AppAdKitPage() {
  const [kits, setKits] = useState<Tables<"app_ad_kits">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.appAdKits.list().then(setKits);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">App Ad Kit</h1>
        <p className="text-sm text-secondary/50">วางลิงก์แอปพลิเคชัน แล้วให้ AI สร้างชุดโฆษณาครบวงจร (บทความ ภาพ และแนวคิดวิดีโอ)</p>
      </div>
      {kits ? <AppAdKitManager kits={kits} onChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
