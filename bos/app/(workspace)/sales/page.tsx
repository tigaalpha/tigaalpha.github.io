import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { PipelineBoard } from "@/features/sales/components/pipeline-board";

export default async function SalesPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);
  const customers = await repos.customers.listPipeline();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Sales Pipeline</h1>
        <p className="text-sm text-secondary/50">Drag customers through the funnel as the AI (or you) qualifies them</p>
      </div>
      <PipelineBoard customers={customers} />
    </div>
  );
}
