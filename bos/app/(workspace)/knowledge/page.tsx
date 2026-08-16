"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { KnowledgeManager } from "@/features/knowledge/components/knowledge-manager";
import { CoverageChecker } from "@/features/knowledge/components/coverage-checker";
import { SalesStyleLearner } from "@/features/knowledge/components/sales-style-learner";
import { ReferencePhotosManager } from "@/features/knowledge/components/reference-photos-manager";
import { KbDraftsSection } from "@/features/knowledge/components/kb-drafts-section";
import { PoliciesSection } from "@/features/knowledge/components/policies-section";
import { Skeleton } from "@/components/ui/skeleton";
import type { KnowledgeSourceType, Tables } from "@/types/database";

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<Tables<"knowledge_documents">[] | null>(null);
  const [salesChatExamples, setSalesChatExamples] = useState<Tables<"sales_chat_examples">[] | null>(null);
  const [referencePhotos, setReferencePhotos] = useState<Tables<"reference_photos">[] | null>(null);
  const [focusSourceType, setFocusSourceType] = useState<KnowledgeSourceType | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.knowledge.listDocuments().then(setDocuments);
  }, []);

  const reloadSalesChatExamples = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.salesChatExamples.list().then(setSalesChatExamples);
  }, []);

  const reloadReferencePhotos = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.referencePhotos.list().then(setReferencePhotos);
  }, []);

  useEffect(() => {
    reload();
    reloadSalesChatExamples();
    reloadReferencePhotos();
  }, [reload, reloadSalesChatExamples, reloadReferencePhotos]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Knowledge Base</h1>
        <p className="text-sm text-secondary/50">The AI always searches this before answering a customer</p>
      </div>
      <PoliciesSection />
      <KbDraftsSection />
      {documents ? <CoverageChecker documents={documents} onSelectEmpty={setFocusSourceType} /> : null}
      {documents ? (
        <KnowledgeManager documents={documents} onChanged={reload} focusSourceType={focusSourceType} />
      ) : (
        <Skeleton className="h-64" />
      )}
      {salesChatExamples ? (
        <SalesStyleLearner examples={salesChatExamples} onChanged={reloadSalesChatExamples} />
      ) : (
        <Skeleton className="h-64" />
      )}
      {referencePhotos ? (
        <ReferencePhotosManager photos={referencePhotos} onChanged={reloadReferencePhotos} />
      ) : (
        <Skeleton className="h-64" />
      )}
    </div>
  );
}
