"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { CompetitorCategoryView } from "@/features/competitors/components/competitor-category-view";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function DirectCompetitorsPage() {
  const [analysis, setAnalysis] = useState<Tables<"competitor_analyses"> | null | undefined>(undefined);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.competitorAnalyses.list().then((list) => setAnalysis(list[0] ?? null));
  }, []);

  return analysis === undefined ? <Skeleton className="h-96" /> : <CompetitorCategoryView analysis={analysis} kind="direct" />;
}
