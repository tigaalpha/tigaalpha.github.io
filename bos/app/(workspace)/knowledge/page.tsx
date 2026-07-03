"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { KnowledgeManager } from "@/features/knowledge/components/knowledge-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<Tables<"knowledge_documents">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.knowledge.listDocuments().then(setDocuments);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Knowledge Base</h1>
        <p className="text-sm text-secondary/50">The AI always searches this before answering a customer</p>
      </div>
      {documents ? <KnowledgeManager documents={documents} onChanged={reload} /> : <Skeleton className="h-64" />}
    </div>
  );
}
