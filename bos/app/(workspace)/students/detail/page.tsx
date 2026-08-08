"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { StudentDetail } from "@/features/students/components/student-detail";
import { CustomerTimeline } from "@/features/students/components/customer-timeline";
import { StudentProgressAi } from "@/features/students/components/student-progress-ai";
import { SalesStatusChanger } from "@/features/students/components/sales-status-changer";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { UserX } from "lucide-react";
import type { Tables } from "@/types/database";

interface DetailData {
  customer: Tables<"customers">;
  courses: Tables<"courses">[];
  history: Tables<"sales_status_history">[];
}

function StudentDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [data, setData] = useState<DetailData | null | "not_found">(null);

  async function fetchDetail(customerId: string): Promise<DetailData | "not_found"> {
    const repos = createRepositories(createClient());
    const customer = await repos.customers.findById(customerId);
    if (!customer) return "not_found";
    const [courses, history] = await Promise.all([repos.courses.listForCustomer(customerId), repos.sales.history(customerId)]);
    return { customer, courses, history };
  }

  useEffect(() => {
    if (!id) {
      setData("not_found");
      return;
    }

    // Without this flag, clicking through the student list quickly (id A
    // then id B before A's fetch resolves) could let A's slower response
    // land after B's and overwrite the screen with the wrong customer —
    // the same pattern message-thread.tsx already guards against.
    let cancelled = false;
    fetchDetail(id).then((result) => {
      if (!cancelled) setData(result);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function reload() {
    if (id) fetchDetail(id).then(setData);
  }

  if (data === null) return <Skeleton className="h-96" />;
  if (data === "not_found") return <EmptyState icon={UserX} title="Customer not found" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">{data.customer.name}</h1>
        <p className="text-sm text-secondary/50">Customer profile</p>
      </div>
      <StudentDetail customer={data.customer} courses={data.courses} history={data.history} />
      <SalesStatusChanger customerId={data.customer.id} currentStatus={data.customer.sales_status} onChanged={reload} />
      <StudentProgressAi customerId={data.customer.id} />
      <CustomerTimeline customerId={data.customer.id} />
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <StudentDetailContent />
    </Suspense>
  );
}
