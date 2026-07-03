import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { KnowledgeManager } from "@/features/knowledge/components/knowledge-manager";

export default async function KnowledgePage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);
  const documents = await repos.knowledge.listDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Knowledge Base</h1>
        <p className="text-sm text-secondary/50">The AI always searches this before answering a customer</p>
      </div>
      <KnowledgeManager documents={documents} />
    </div>
  );
}
