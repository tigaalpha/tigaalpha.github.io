"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { PipelineBoard } from "@/features/sales/components/pipeline-board";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function SalesPage() {
  const [customers, setCustomers] = useState<Tables<"customers">[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.customers.listPipeline().then(setCustomers);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Sales Pipeline</h1>
        <p className="text-sm text-secondary/50">Drag customers through the funnel as the AI (or you) qualifies them</p>
      </div>
      {customers ? <PipelineBoard customers={customers} /> : <Skeleton className="h-64" />}
    </div>
  );
}
