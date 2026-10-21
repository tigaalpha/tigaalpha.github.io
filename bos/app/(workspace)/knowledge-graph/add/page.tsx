import type { Metadata } from "next";
import { OwnerOnlyGuard } from "@/features/auth/components/owner-only-guard";
import { KnowledgeInput } from "@/features/knowledge-graph/components/knowledge-input";

export const metadata: Metadata = {
  title: "Add Data & Knowledge — TIGA Agent",
};

/** Input page opened by the knowledge-graph header's "เพิ่มข้อมูล &
    องค์ความรู้" button — text or any file type, saved into the graph's
    knowledge domain. Owner/admin only, same guard as the graph itself. */
export default function AddKnowledgePage() {
  return (
    <OwnerOnlyGuard>
      <KnowledgeInput />
    </OwnerOnlyGuard>
  );
}
