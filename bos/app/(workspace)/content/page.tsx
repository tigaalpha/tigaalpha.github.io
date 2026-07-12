"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { ContentManager } from "@/features/content/components/content-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function ContentPage() {
  const [articles, setArticles] = useState<Tables<"articles">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.articles.list().then(setArticles);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">SEO/AEO Content</h1>
        <p className="text-sm text-secondary/50">
          AI เขียนบทความให้ติด SEO และ AI Answer Engines โดยอิงข้อมูลจริงจาก Knowledge Base
        </p>
      </div>
      {articles ? <ContentManager articles={articles} onChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
