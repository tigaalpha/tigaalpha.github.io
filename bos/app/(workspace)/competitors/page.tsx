"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { CompetitorAnalysisManager } from "@/features/competitors/components/competitor-analysis-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function CompetitorsPage() {
  const [analyses, setAnalyses] = useState<Tables<"competitor_analyses">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.competitorAnalyses.list().then(setAnalyses);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">วิเคราะห์คู่แข่ง</h1>
        <p className="text-sm text-secondary/50">
          ติดตามคู่แข่งทางตรง (โรงเรียนสอนเปียโนในไทย) และคู่แข่งทางอ้อม (แอปสอนเปียโนทั่วโลก) พร้อมกลยุทธ์ที่ควรเอาชนะหรือหลบเลี่ยง
        </p>
      </div>
      {analyses ? <CompetitorAnalysisManager analyses={analyses} onChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
