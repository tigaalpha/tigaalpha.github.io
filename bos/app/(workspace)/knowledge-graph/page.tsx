import type { Metadata } from "next";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";
import { KnowledgeGraph } from "@/features/knowledge-graph/components/knowledge-graph";

export const metadata: Metadata = {
  title: "Knowledge Graph — TIGA Agent",
};

export default function KnowledgeGraphPage() {
  return (
    <OwnerOnlyGuard>
      <KnowledgeGraph />
    </OwnerOnlyGuard>
  );
}
