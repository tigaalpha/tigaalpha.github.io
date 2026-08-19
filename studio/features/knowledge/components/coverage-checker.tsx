"use client";

import { useMemo } from "react";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SOURCE_TYPES } from "./knowledge-manager";
import type { KnowledgeSourceType, Tables } from "@/types/database";

interface CoverageCheckerProps {
  documents: Tables<"knowledge_documents">[];
  onSelectEmpty: (sourceType: KnowledgeSourceType) => void;
}

// Category-completeness check: for each of the 12 owner-authored
// knowledge categories, is there at least one document? Reuses the
// already-fetched documents list (no new query) -- a real, non-fabricated
// stand-in for "would the AI have an answer if a customer asked about
// this" that doesn't require inventing a question bank that doesn't
// exist. Same category-bucket + badge pattern as Data Health.
export function CoverageChecker({ documents, onSelectEmpty }: CoverageCheckerProps) {
  const counts = useMemo(() => {
    const map = new Map<KnowledgeSourceType, number>();
    for (const doc of documents) {
      map.set(doc.source_type, (map.get(doc.source_type) ?? 0) + 1);
    }
    return map;
  }, [documents]);

  const coveredCount = SOURCE_TYPES.filter((t) => (counts.get(t) ?? 0) > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary-accent" />
          ความครบถ้วนของความรู้
        </CardTitle>
        <CardDescription>
          {coveredCount}/{SOURCE_TYPES.length} หมวดมีข้อมูลแล้ว — หมวดที่ยังว่างหมายความว่า AI จะไม่มีข้อมูลตอบถ้าลูกค้าถามเรื่องนั้น
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {SOURCE_TYPES.map((t) => {
          const count = counts.get(t) ?? 0;
          const label = t.replace(/_/g, " ");
          return count > 0 ? (
            <Badge key={t} variant="success">
              {label} ({count})
            </Badge>
          ) : (
            <button key={t} type="button" onClick={() => onSelectEmpty(t)}>
              <Badge variant="outline" className="cursor-pointer hover:bg-line/10">
                {label} — ว่าง
              </Badge>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
